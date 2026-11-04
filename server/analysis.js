/* ============================================
   SERVER/ANALYSIS.JS - Post-game analysis
   Uses AI (minimax) to find best moves and mistakes
   ============================================ */

// Inline minimax for analysis (avoid circular deps)
function analyzeBoard(board, player, size = 3, winLength = 3) {
    // For 3x3, use full minimax
    if (size === 3) {
        return analyze3x3(board, player);
    }
    // For larger boards, use heuristic
    return analyzeHeuristic(board, player, size, winLength);
}

const WIN_LINES_3X3 = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
];

function checkWinner3x3(board) {
    for (const line of WIN_LINES_3X3) {
        const [a, b, c] = line;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return { winner: board[a], line };
        }
    }
    return { winner: null, line: null };
}

function getEmpty3x3(board) {
    const out = [];
    for (let i = 0; i < 9; i++) if (board[i] === null) out.push(i);
    return out;
}

function minimax3x3(board, aiPlayer, depth, alpha, beta, maximizing) {
    const result = checkWinner3x3(board);
    if (result.winner === aiPlayer) return { score: 10 + depth, index: null };
    if (result.winner === (aiPlayer === 'x' ? 'o' : 'x')) return { score: -10 - depth, index: null };
    if (getEmpty3x3(board).length === 0 || depth === 0) return { score: 0, index: null };

    const empties = getEmpty3x3(board);
    let bestMove = null;
    if (maximizing) {
        let best = -Infinity;
        for (const idx of empties) {
            board[idx] = aiPlayer;
            const r = minimax3x3(board, aiPlayer, depth - 1, alpha, beta, false);
            board[idx] = null;
            if (r.score > best) { best = r.score; bestMove = idx; }
            alpha = Math.max(alpha, best);
            if (beta <= alpha) break;
        }
        return { score: best, index: bestMove };
    } else {
        let best = Infinity;
        const opp = aiPlayer === 'x' ? 'o' : 'x';
        for (const idx of empties) {
            board[idx] = opp;
            const r = minimax3x3(board, aiPlayer, depth - 1, alpha, beta, true);
            board[idx] = null;
            if (r.score < best) { best = r.score; bestMove = idx; }
            beta = Math.min(beta, best);
            if (beta <= alpha) break;
        }
        return { score: best, index: bestMove };
    }
}

function analyze3x3(board, player) {
    const result = minimax3x3(board.slice(), player, 9, -Infinity, Infinity, true);
    return result.index;
}

function analyzeHeuristic(board, player, size, winLength) {
    // Find winning move, then blocking move, then center
    const empties = getEmpty3x3(board);
    // Win
    for (const idx of empties) {
        const trial = board.slice();
        trial[idx] = player;
        if (checkWinnerSized(trial, size, winLength)) return idx;
    }
    // Block
    const opp = player === 'x' ? 'o' : 'x';
    for (const idx of empties) {
        const trial = board.slice();
        trial[idx] = opp;
        if (checkWinnerSized(trial, size, winLength)) return idx;
    }
    // Center
    return empties[Math.floor(empties.length / 2)];
}

function checkWinnerSized(board, size, winLength) {
    // Simplified - just check if any player has won
    // For analysis purposes, this is enough
    const lines = generateLines(size, winLength);
    for (const line of lines) {
        const first = board[line[0]];
        if (!first) continue;
        if (line.every(i => board[i] === first)) return true;
    }
    return false;
}

function generateLines(size, winLength) {
    const lines = [];
    // Horizontal
    for (let r = 0; r < size; r++) {
        for (let c = 0; c <= size - winLength; c++) {
            const line = [];
            for (let k = 0; k < winLength; k++) line.push(r * size + c + k);
            lines.push(line);
        }
    }
    // Vertical
    for (let c = 0; c < size; c++) {
        for (let r = 0; r <= size - winLength; r++) {
            const line = [];
            for (let k = 0; k < winLength; k++) line.push((r + k) * size + c);
            lines.push(line);
        }
    }
    // Diagonals
    for (let r = 0; r <= size - winLength; r++) {
        for (let c = 0; c <= size - winLength; c++) {
            const line = [];
            for (let k = 0; k < winLength; k++) line.push((r + k) * size + c + k);
            lines.push(line);
        }
        for (let c = winLength - 1; c < size; c++) {
            const line = [];
            for (let k = 0; k < winLength; k++) line.push((r + k) * size + c - k);
            lines.push(line);
        }
    }
    return lines;
}

/**
 * Analyze a completed game and return insights.
 * @param {Array} moves - array of { player, index }
 * @param {number} boardSize
 * @returns {Object} analysis
 */
function analyzeGame(moves, boardSize = 3) {
    const winLength = boardSize === 3 ? 3 : 4;
    const insights = [];
    let mistakes = 0;
    let excellentMoves = 0;
    const board = new Array(boardSize * boardSize).fill(null);

    moves.forEach((move, i) => {
        const { player, index } = move;
        // Find best move for this player at this point
        const bestMove = analyzeBoard(board, player, boardSize, winLength);

        // Compare
        if (bestMove === index) {
            excellentMoves++;
        } else {
            // Check if the played move was a mistake (allowed opponent to win)
            const trialBoard = board.slice();
            trialBoard[index] = player;
            const opp = player === 'x' ? 'o' : 'x';
            // Did the player miss a winning move?
            const winningMove = findWinningMove(board, player, boardSize, winLength);
            if (winningMove !== null && winningMove !== index) {
                mistakes++;
                insights.push({
                    moveNumber: i + 1,
                    player,
                    playedIndex: index,
                    bestIndex: bestMove,
                    type: 'missed_win',
                    description: `حرکت ${i + 1}: ${player === 'x' ? 'X' : 'O'} فرصت برد را از دست داد. بهترین: خانه ${bestMove + 1}`,
                });
            } else {
                // Check if they missed a block
                const blockMove = findBlockingMove(board, player, boardSize, winLength);
                if (blockMove !== null && blockMove !== index) {
                    mistakes++;
                    insights.push({
                        moveNumber: i + 1,
                        player,
                        playedIndex: index,
                        bestIndex: bestMove,
                        type: 'missed_block',
                        description: `حرکت ${i + 1}: ${player === 'x' ? 'X' : 'O'} نتوانست حرکت حریف را مسدود کند. بهترین: خانه ${bestMove + 1}`,
                    });
                } else if (bestMove !== null && bestMove !== index) {
                    // Suboptimal but not critical
                    insights.push({
                        moveNumber: i + 1,
                        player,
                        playedIndex: index,
                        bestIndex: bestMove,
                        type: 'suboptimal',
                        description: `حرکت ${i + 1}: بهتر بود خانه ${bestMove + 1} بازی می‌شد`,
                    });
                }
            }
        }

        // Apply the actual move
        board[index] = player;
    });

    // Final summary
    const totalMoves = moves.length;
    const accuracy = totalMoves > 0 ? Math.round(excellentMoves / totalMoves * 100) : 0;
    let grade;
    if (accuracy >= 90) grade = 'A+';
    else if (accuracy >= 80) grade = 'A';
    else if (accuracy >= 70) grade = 'B';
    else if (accuracy >= 60) grade = 'C';
    else if (accuracy >= 50) grade = 'D';
    else grade = 'F';

    return {
        totalMoves,
        excellentMoves,
        mistakes,
        accuracy,
        grade,
        insights,
    };
}

function findWinningMove(board, player, size, winLength) {
    const empties = [];
    for (let i = 0; i < board.length; i++) if (board[i] === null) empties.push(i);
    for (const idx of empties) {
        const trial = board.slice();
        trial[idx] = player;
        if (checkWinnerSized(trial, size, winLength)) return idx;
    }
    return null;
}

function findBlockingMove(board, player, size, winLength) {
    const opp = player === 'x' ? 'o' : 'x';
    return findWinningMove(board, opp, size, winLength);
}

module.exports = {
    analyzeGame,
    analyzeBoard,
};
