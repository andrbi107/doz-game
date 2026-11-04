/* ============================================
   GAME.JS - Core game logic for Doz (Tic-Tac-Toe)
   Pure logic, no DOM dependency
   ============================================ */

const Game = (function () {
    const SIZE = 3;
    const TOTAL = SIZE * SIZE;

    // All 8 winning line patterns (3 rows + 3 cols + 2 diagonals)
    const WIN_LINES = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],   // rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8],   // cols
        [0, 4, 8], [2, 4, 6],              // diagonals
    ];

    /**
     * Create an empty board.
     * @returns {Array<string|null>}
     */
    function emptyBoard() {
        return new Array(TOTAL).fill(null);
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
     * @returns {{winner: string|null, line: number[]|null}}
     */
    function checkWinner(board) {
        for (const line of WIN_LINES) {
            const [a, b, c] = line;
            if (board[a] && board[a] === board[b] && board[a] === board[c]) {
                return { winner: board[a], line };
            }
        }
        return { winner: null, line: null };
    }

    /**
     * Check if the game is over (someone won or board full).
     */
    function isGameOver(board) {
        const result = checkWinner(board);
        return !!result.winner || isFull(board);
    }

    /**
     * Get the next player given the current board.
     * X always starts, so the player is determined by the count of marks.
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
        if (index < 0 || index >= TOTAL) return null;
        if (board[index] !== null) return null;
        if (nextPlayer(board) !== player) return null;
        const next = board.slice();
        next[index] = player;
        return next;
    }

    /**
     * Get a human-readable cell label (1-9, like a numpad).
     */
    function cellLabel(index) {
        // Map index 0-8 to numpad-style 1-9
        // 0 1 2  ->  7 8 9
        // 3 4 5  ->  4 5 6
        // 6 7 8  ->  1 2 3
        const map = [7, 8, 9, 4, 5, 6, 1, 2, 3];
        return map[index];
    }

    /**
     * Get a board position from a numpad label (1-9).
     */
    function labelToIndex(label) {
        const map = { 7: 0, 8: 1, 9: 2, 4: 3, 5: 4, 6: 5, 1: 6, 2: 7, 3: 8 };
        return map[label];
    }

    /**
     * Calculate a "score" for AI evaluation purposes (used by minimax).
     * Higher = better for 'x', lower = better for 'o'.
     */
    function evaluateBoard(board) {
        const { winner } = checkWinner(board);
        if (winner === 'x') return 10;
        if (winner === 'o') return -10;
        return 0;
    }

    return {
        SIZE,
        TOTAL,
        WIN_LINES,
        emptyBoard,
        getEmptyCells,
        isFull,
        checkWinner,
        isGameOver,
        nextPlayer,
        applyMove,
        cellLabel,
        labelToIndex,
        evaluateBoard,
    };
})();
