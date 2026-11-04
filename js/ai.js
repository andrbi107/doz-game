/* ============================================
   AI.JS - Opponent AI for Doz
   Three difficulty levels:
   - Easy:   random moves (with 30% tactical)
   - Medium: minimax depth-limited + randomness
   - Hard:   full minimax (unbeatable)
   ============================================ */

const AI = (function () {
    const Game_ = Game; // alias

    /**
     * Easy AI: mostly random, sometimes picks the center / corner.
     * Will block an immediate win or take an immediate win ~40% of the time.
     */
    function easyMove(board, player) {
        const empties = Game_.getEmptyCells(board);
        if (empties.length === 0) return -1;

        // 40% chance to make a "smart" move (win or block)
        if (Math.random() < 0.4) {
            const smart = findCriticalMove(board, player);
            if (smart !== -1) return smart;
        }

        // Otherwise random
        return empties[Math.floor(Math.random() * empties.length)];
    }

    /**
     * Medium AI: minimax with depth-limited lookahead (depth 3),
     * and 25% chance to play a random move instead.
     */
    function mediumMove(board, player) {
        const empties = Game_.getEmptyCells(board);
        if (empties.length === 0) return -1;

        // Always take an immediate win
        const win = findCriticalMove(board, player);
        if (win !== -1) return win;

        // Always block an immediate threat
        const block = findCriticalMove(board, opponent(player));
        if (block !== -1) return block;

        // 25% chance to be "dumb" so the player has a chance
        if (Math.random() < 0.25) {
            return empties[Math.floor(Math.random() * empties.length)];
        }

        // Limited-depth minimax (depth 3)
        const result = minimax(board, player, 3, -Infinity, Infinity, true);
        return result.index !== null ? result.index : empties[0];
    }

    /**
     * Hard AI: full minimax with alpha-beta pruning. Unbeatable.
     * Will always win if possible, always draw if not, never lose.
     */
    function hardMove(board, player) {
        const empties = Game_.getEmptyCells(board);
        if (empties.length === 0) return -1;

        // Optimization: opening move - prefer center, then a corner
        if (empties.length === 9) {
            return 4; // center
        }
        if (empties.length === 8) {
            // If opponent took center, take a corner; otherwise take center
            if (board[4] !== null) {
                return [0, 2, 6, 8][Math.floor(Math.random() * 4)];
            }
            return 4;
        }

        const result = minimax(board, player, 9, -Infinity, Infinity, true);
        return result.index !== null ? result.index : empties[0];
    }

    /**
     * Minimax with alpha-beta pruning.
     * Returns { score, index } for the best move from `player`'s perspective.
     * `maximizing` is true when it's the AI's turn to move (maximize AI's score).
     */
    function minimax(board, aiPlayer, depth, alpha, beta, maximizing) {
        const result = Game_.checkWinner(board);
        const isTerminal = result.winner !== null || Game_.isFull(board) || depth === 0;

        if (isTerminal) {
            if (result.winner === aiPlayer) {
                return { score: 10 + depth, index: null };
            } else if (result.winner === opponent(aiPlayer)) {
                return { score: -10 - depth, index: null };
            } else {
                return { score: 0, index: null };
            }
        }

        const empties = Game_.getEmptyCells(board);
        let bestMove = null;

        if (maximizing) {
            let bestScore = -Infinity;
            for (const idx of empties) {
                const next = board.slice();
                next[idx] = aiPlayer;
                const r = minimax(next, aiPlayer, depth - 1, alpha, beta, false);
                if (r.score > bestScore) {
                    bestScore = r.score;
                    bestMove = idx;
                }
                alpha = Math.max(alpha, bestScore);
                if (beta <= alpha) break; // beta cutoff
            }
            return { score: bestScore, index: bestMove };
        } else {
            let bestScore = Infinity;
            const opp = opponent(aiPlayer);
            for (const idx of empties) {
                const next = board.slice();
                next[idx] = opp;
                const r = minimax(next, aiPlayer, depth - 1, alpha, beta, true);
                if (r.score < bestScore) {
                    bestScore = r.score;
                    bestMove = idx;
                }
                beta = Math.min(beta, bestScore);
                if (beta <= alpha) break; // alpha cutoff
            }
            return { score: bestScore, index: bestMove };
        }
    }

    /**
     * Find a move that either wins immediately for `player` or blocks a loss.
     * Returns the cell index, or -1 if no critical move.
     */
    function findCriticalMove(board, player) {
        const empties = Game_.getEmptyCells(board);
        for (const idx of empties) {
            const trial = board.slice();
            trial[idx] = player;
            const r = Game_.checkWinner(trial);
            if (r.winner === player) return idx;
        }
        return -1;
    }

    function opponent(player) {
        return player === 'x' ? 'o' : 'x';
    }

    /**
     * Public: choose a move based on difficulty.
     * @param {Array} board
     * @param {string} player - 'x' or 'o'
     * @param {string} difficulty - 'easy' | 'medium' | 'hard'
     * @returns {number} cell index 0..8
     */
    function chooseMove(board, player, difficulty) {
        switch (difficulty) {
            case 'easy':   return easyMove(board, player);
            case 'medium': return mediumMove(board, player);
            case 'hard':
            default:       return hardMove(board, player);
        }
    }

    /**
     * Choose a move for a board of any size (v3).
     * For 3x3, uses the optimized minimax. For larger boards, uses heuristic.
     */
    function chooseMoveWithSize(board, player, difficulty, size = 3, winLength = 3) {
        if (size === 3) {
            return chooseMove(board, player, difficulty);
        }
        // For larger boards, use heuristic-based AI
        return heuristicMove(board, player, size, winLength, difficulty);
    }

    /**
     * Heuristic-based AI for larger boards (4x4, 5x5).
     * - Check immediate win
     * - Block immediate threat
     * - Score moves based on position value
     */
    function heuristicMove(board, player, size, winLength, difficulty) {
        const empties = Game_.getEmptyCells(board);
        if (empties.length === 0) return -1;

        const opp = opponent(player);
        const center = Math.floor(size / 2);

        // Easy: 50% random
        if (difficulty === 'easy' && Math.random() < 0.5) {
            return empties[Math.floor(Math.random() * empties.length)];
        }

        // 1. Win immediately if possible
        const win = findCriticalMoveSized(board, player, size, winLength);
        if (win !== -1) return win;

        // 2. Block opponent's immediate win
        const block = findCriticalMoveSized(board, opp, size, winLength);
        if (block !== -1) return block;

        // 3. Score each empty cell
        let bestScore = -Infinity;
        let bestMoves = [];
        for (const idx of empties) {
            const r = Math.floor(idx / size);
            const c = idx % size;
            let score = 0;
            // Prefer center
            const distFromCenter = Math.abs(r - center) + Math.abs(c - center);
            score += (size - distFromCenter) * 2;
            // Bonus for corners
            if ((r === 0 || r === size - 1) && (c === 0 || c === size - 1)) {
                score += 3;
            }
            // Bonus for cells near existing marks
            score += countAdjacentMatches(board, idx, player, size) * 4;
            score += countAdjacentMatches(board, idx, opp, size) * 2; // also good for blocking

            // Add some randomness for non-hard
            if (difficulty !== 'hard') {
                score += Math.random() * 5;
            }

            if (score > bestScore) {
                bestScore = score;
                bestMoves = [idx];
            } else if (score === bestScore) {
                bestMoves.push(idx);
            }
        }
        return bestMoves[Math.floor(Math.random() * bestMoves.length)];
    }

    /**
     * Find a critical move (win or block) for any board size.
     */
    function findCriticalMoveSized(board, player, size, winLength) {
        const empties = Game_.getEmptyCells(board);
        for (const idx of empties) {
            const trial = board.slice();
            trial[idx] = player;
            const r = Game_.checkWinner(trial, size, winLength);
            if (r.winner === player) return idx;
        }
        return -1;
    }

    /**
     * Count how many of the player's marks are adjacent to a cell.
     */
    function countAdjacentMatches(board, idx, player, size) {
        const r = Math.floor(idx / size);
        const c = idx % size;
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const nr = r + dr;
                const nc = c + dc;
                if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
                    if (board[nr * size + nc] === player) count++;
                }
            }
        }
        return count;
    }

    /**
     * Get a hint for the human (uses hard AI on their behalf).
     */
    function getHint(board, player, size = 3, winLength = 3) {
        if (size === 3) {
            return hardMove(board, player);
        }
        return heuristicMove(board, player, size, winLength, 'hard');
    }

    return {
        chooseMove,
        chooseMoveWithSize,
        getHint,
        // exposed for tests
        _minimax: minimax,
        _easyMove: easyMove,
        _mediumMove: mediumMove,
        _hardMove: hardMove,
        _heuristicMove: heuristicMove,
    };
})();
