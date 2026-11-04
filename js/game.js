/* ============================================
   GAME.JS v3 - Core game logic for Doz (Tic-Tac-Toe)
   Pure logic, no DOM dependency.
   Supports variable board sizes (3x3, 4x4, 5x5).
   ============================================ */

const Game = (function () {
    // Default to 3x3 for backwards compatibility
    const DEFAULT_SIZE = 3;
    const DEFAULT_WIN_LENGTH = 3;

    /**
     * Generate all winning lines for a board of given size and win length.
     * For 3x3 with win=3: 8 lines (3 rows, 3 cols, 2 diagonals)
     * For 4x4 with win=4: 10 lines (4 rows, 4 cols, 2 diagonals)
     * For 5x5 with win=4: 28 lines (5 rows, 5 cols, 2 main diagonals + 6 partial diagonals + ...)
     */
    function generateWinLines(size, winLength) {
        const lines = [];
        const n = size * size;

        // Horizontal lines
        for (let r = 0; r < size; r++) {
            for (let c = 0; c <= size - winLength; c++) {
                const line = [];
                for (let k = 0; k < winLength; k++) {
                    line.push(r * size + c + k);
                }
                lines.push(line);
            }
        }

        // Vertical lines
        for (let c = 0; c < size; c++) {
            for (let r = 0; r <= size - winLength; r++) {
                const line = [];
                for (let k = 0; k < winLength; k++) {
                    line.push((r + k) * size + c);
                }
                lines.push(line);
            }
        }

        // Diagonal lines (top-left to bottom-right)
        for (let r = 0; r <= size - winLength; r++) {
            for (let c = 0; c <= size - winLength; c++) {
                const line = [];
                for (let k = 0; k < winLength; k++) {
                    line.push((r + k) * size + c + k);
                }
                lines.push(line);
            }
        }

        // Diagonal lines (top-right to bottom-left)
        for (let r = 0; r <= size - winLength; r++) {
            for (let c = winLength - 1; c < size; c++) {
                const line = [];
                for (let k = 0; k < winLength; k++) {
                    line.push((r + k) * size + c - k);
                }
                lines.push(line);
            }
        }

        return lines;
    }

    // Pre-compute for default 3x3
    const SIZE = DEFAULT_SIZE;
    const TOTAL = SIZE * SIZE;
    const WIN_LINES = generateWinLines(SIZE, DEFAULT_WIN_LENGTH);

    // Cache for other sizes
    const linesCache = { '3_3': WIN_LINES };

    function getWinLines(size, winLength) {
        const key = size + '_' + winLength;
        if (!linesCache[key]) {
            linesCache[key] = generateWinLines(size, winLength);
        }
        return linesCache[key];
    }

    /**
     * Create an empty board for given size (default 3).
     */
    function emptyBoard(size = 3) {
        const total = size * size;
        return new Array(total).fill(null);
    }

    /**
     * Get all empty cell indices.
     */
    function getEmptyCells(board) {
        const out = [];
        for (let i = 0; i < board.length; i++) {
            if (board[i] === null) out.push(i);
        }
        return out;
    }

    /**
     * Check if a board is full (no empty cells).
     */
    function isFull(board) {
        return board.every(c => c !== null);
    }

    /**
     * Check winner of a board.
     * @param {Array} board
     * @param {number} size - board size (default 3)
     * @param {number} winLength - consecutive marks needed to win (default 3)
     * @returns {{winner: string|null, line: number[]|null}}
     */
    function checkWinner(board, size = 3, winLength = 3) {
        const lines = (size === 3 && winLength === 3) ? WIN_LINES : getWinLines(size, winLength);
        for (const line of lines) {
            const [a, b, c] = [line[0], line[1], line[2]];
            // For winLength > 3, check all positions
            if (line.length > 3) {
                const first = board[line[0]];
                if (!first) continue;
                let win = true;
                for (let i = 1; i < line.length; i++) {
                    if (board[line[i]] !== first) { win = false; break; }
                }
                if (win) return { winner: first, line };
            } else {
                if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                    return { winner: board[a], line };
                }
            }
        }
        return { winner: null, line: null };
    }

    /**
     * Check if the game is over (someone won or board full).
     */
    function isGameOver(board, size = 3, winLength = 3) {
        const result = checkWinner(board, size, winLength);
        return !!result.winner || isFull(board);
    }

    /**
     * Get the next player given the current board.
     */
    function nextPlayer(board) {
        const xCount = board.filter(c => c === 'x').length;
        const oCount = board.filter(c => c === 'o').length;
        return xCount <= oCount ? 'x' : 'o';
    }

    /**
     * Apply a move, returning a NEW board (immutable).
     * Returns null if the move is invalid.
     */
    function applyMove(board, index, player) {
        if (index < 0 || index >= board.length) return null;
        if (board[index] !== null) return null;
        if (player !== 'x' && player !== 'o') return null;
        const next = board.slice();
        next[index] = player;
        return next;
    }

    /**
     * Get a human-readable cell label (1-9 for 3x3 numpad-style).
     * For larger boards, returns 1..N.
     */
    function cellLabel(index, size = 3) {
        if (size === 3) {
            // Numpad-style: 7,8,9 / 4,5,6 / 1,2,3
            const map = [7, 8, 9, 4, 5, 6, 1, 2, 3];
            return map[index];
        }
        // For larger boards, just return 1..N
        return index + 1;
    }

    /**
     * Get a board position from a label.
     */
    function labelToIndex(label, size = 3) {
        if (size === 3) {
            const map = { 7: 0, 8: 1, 9: 2, 4: 3, 5: 4, 6: 5, 1: 6, 2: 7, 3: 8 };
            return map[label];
        }
        // For larger boards, label is 1..N, index is label-1
        const idx = parseInt(label, 10) - 1;
        if (idx >= 0 && idx < size * size) return idx;
        return undefined;
    }

    /**
     * Get recommended win length for a board size.
     */
    function recommendedWinLength(size) {
        if (size === 3) return 3;
        if (size === 4) return 4;
        if (size === 5) return 4; // 4-in-a-row on 5x5
        return Math.min(size, 4);
    }

    /**
     * Calculate a "score" for AI evaluation purposes.
     */
    function evaluateBoard(board, size = 3, winLength = 3) {
        const { winner } = checkWinner(board, size, winLength);
        if (winner === 'x') return 10;
        if (winner === 'o') return -10;
        return 0;
    }

    return {
        SIZE,
        TOTAL,
        WIN_LINES,
        DEFAULT_SIZE,
        DEFAULT_WIN_LENGTH,
        emptyBoard,
        getEmptyCells,
        isFull,
        checkWinner,
        isGameOver,
        nextPlayer,
        applyMove,
        cellLabel,
        labelToIndex,
        recommendedWinLength,
        evaluateBoard,
        generateWinLines,
    };
})();
