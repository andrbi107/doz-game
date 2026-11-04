/* ============================================
   SERVER/SPECTATOR.JS - Spectator mode
   Allows users to watch live games
   ============================================ */

function create(io) {
    // Active spectatable games: roomId -> game state
    const spectatable = new Map();

    /**
     * Register a game as spectatable.
     */
    function registerGame(roomId, gameState, player1Name, player2Name) {
        spectatable.set(roomId, {
            roomId,
            player1: player1Name,
            player2: player2Name,
            board: gameState.board.slice(),
            currentPlayer: gameState.currentPlayer,
            moveCount: 0,
            spectators: new Set(),
            startedAt: Date.now(),
        });
        io.emit('spectate:game-available', {
            roomId,
            player1: player1Name,
            player2: player2Name,
        });
    }

    /**
     * Update spectatable game state (called on each move).
     */
    function updateGame(roomId, board, currentPlayer) {
        const game = spectatable.get(roomId);
        if (!game) return;
        game.board = board.slice();
        game.currentPlayer = currentPlayer;
        game.moveCount++;
        // Broadcast to spectators
        io.to('spectate:' + roomId).emit('spectate:move', {
            roomId,
            board: game.board,
            currentPlayer: game.currentPlayer,
            moveCount: game.moveCount,
        });
    }

    /**
     * Mark game as finished.
     */
    function finishGame(roomId, winner, line) {
        const game = spectatable.get(roomId);
        if (!game) return;
        io.to('spectate:' + roomId).emit('spectate:end', {
            roomId,
            winner,
            line,
            board: game.board,
        });
        // Remove after delay
        setTimeout(() => {
            spectatable.delete(roomId);
            io.emit('spectate:game-removed', { roomId });
        }, 60000);
    }

    /**
     * Add a spectator to a game.
     */
    function addSpectator(socket, roomId) {
        const game = spectatable.get(roomId);
        if (!game) return { ok: false, error: 'بازی یافت نشد' };
        game.spectators.add(socket.id);
        socket.join('spectate:' + roomId);
        // Send current state
        socket.emit('spectate:state', {
            roomId,
            player1: game.player1,
            player2: game.player2,
            board: game.board,
            currentPlayer: game.currentPlayer,
            moveCount: game.moveCount,
            spectators: game.spectators.size,
        });
        // Notify others
        io.to('spectate:' + roomId).emit('spectate:spectator-count', {
            count: game.spectators.size,
        });
        return { ok: true };
    }

    /**
     * Remove a spectator.
     */
    function removeSpectator(socket, roomId) {
        const game = spectatable.get(roomId);
        if (!game) return;
        game.spectators.delete(socket.id);
        socket.leave('spectate:' + roomId);
        io.to('spectate:' + roomId).emit('spectate:spectator-count', {
            count: game.spectators.size,
        });
    }

    /**
     * Get list of spectatable games.
     */
    function getAvailableGames() {
        return Array.from(spectatable.values()).map(g => ({
            roomId: g.roomId,
            player1: g.player1,
            player2: g.player2,
            spectators: g.spectators.size,
            moveCount: g.moveCount,
            startedAt: g.startedAt,
        }));
    }

    /**
     * Broadcast emote from spectator to other spectators.
     */
    function broadcastSpectatorEmote(roomId, username, emote) {
        io.to('spectate:' + roomId).emit('spectate:emote', { by: username, emote });
    }

    return {
        registerGame,
        updateGame,
        finishGame,
        addSpectator,
        removeSpectator,
        getAvailableGames,
        broadcastSpectatorEmote,
    };
}

module.exports = { create };
