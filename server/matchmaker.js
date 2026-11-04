/* ============================================
   SERVER/MATCHMAKER.JS - Matchmaking queue
   Random matchmaking based on ELO range
   ============================================ */

function create(presence) {
    // Queue: array of { socket, elo, joinedAt }
    const queue = [];
    // Private rooms: code -> { player1, roomId }
    const privateRooms = new Map();

    const ELO_RANGE = 100;     // initial range
    const ELO_EXPAND_MS = 5000; // expand range every 5s
    const MAX_RANGE = 500;     // max range

    function getEffectiveRange(waitTimeMs) {
        const expansions = Math.floor(waitTimeMs / ELO_EXPAND_MS);
        return Math.min(ELO_RANGE + expansions * 50, MAX_RANGE);
    }

    /**
     * Add player to queue. Callback when matched.
     */
    function joinQueue(socket, elo, onMatch) {
        // Don't add if already in queue
        const existing = queue.find(q => q.socket.id === socket.id);
        if (existing) return;

        const entry = { socket, elo, joinedAt: Date.now(), onMatch };
        queue.push(entry);
        socket.emit('match:status', { status: 'searching', position: queue.length });

        // Try to find a match immediately
        tryMatch(entry);
    }

    function tryMatch(entry) {
        const now = Date.now();
        const waitTime = now - entry.joinedAt;
        const range = getEffectiveRange(waitTime);

        // Find another player in range (closest ELO)
        let bestMatch = null;
        let bestDiff = Infinity;
        for (const other of queue) {
            if (other.socket.id === entry.socket.id) continue;
            const diff = Math.abs(other.elo - entry.elo);
            if (diff <= range && diff < bestDiff) {
                bestDiff = diff;
                bestMatch = other;
            }
        }

        if (bestMatch) {
            // Remove both from queue
            const idx1 = queue.indexOf(entry);
            if (idx1 >= 0) queue.splice(idx1, 1);
            const idx2 = queue.indexOf(bestMatch);
            if (idx2 >= 0) queue.splice(idx2, 1);

            // Notify both
            entry.socket.emit('match:found', {
                opponent: { username: bestMatch.socket.username, elo: bestMatch.elo },
                yourElo: entry.elo,
            });
            bestMatch.socket.emit('match:found', {
                opponent: { username: entry.socket.username, elo: entry.elo },
                yourElo: bestMatch.elo,
            });

            // Trigger callback (server will create the room)
            if (entry.onMatch) entry.onMatch(entry.socket, bestMatch.socket);
        }
    }

    function leaveQueue(socket) {
        const idx = queue.findIndex(q => q.socket.id === socket.id);
        if (idx >= 0) {
            queue.splice(idx, 1);
            socket.emit('match:status', { status: 'cancelled' });
        }
        // Also clean up private rooms created by this socket
        for (const [code, room] of privateRooms) {
            if (room.player1.id === socket.id) {
                privateRooms.delete(code);
            }
        }
    }

    /**
     * Create a private room with an invite code.
     */
    function createPrivateRoom(socket, code, roomId) {
        privateRooms.set(code, {
            player1: socket,
            roomId,
            createdAt: Date.now(),
        });
        // Auto-expire after 5 min
        setTimeout(() => {
            if (privateRooms.has(code)) {
                const room = privateRooms.get(code);
                if (room.player1.id === socket.id) {
                    privateRooms.delete(code);
                    socket.emit('match:private-expired', { code });
                }
            }
        }, 5 * 60 * 1000);
    }

    /**
     * Join a private room by code.
     */
    function joinPrivateRoom(socket, code) {
        const room = privateRooms.get(code);
        if (!room) {
            return { ok: false, error: 'کد اتاق یافت نشد' };
        }
        if (room.player1.id === socket.id) {
            return { ok: false, error: 'نمی‌توانید به اتاق خودتان بپیوندید' };
        }
        privateRooms.delete(code);
        return {
            ok: true,
            roomId: room.roomId,
            player1: room.player1,
        };
    }

    // Periodic matching attempt (every 1s)
    setInterval(() => {
        for (const entry of queue) {
            tryMatch(entry);
        }
    }, 1000);

    return {
        joinQueue,
        leaveQueue,
        createPrivateRoom,
        joinPrivateRoom,
        getQueueSize: () => queue.length,
    };
}

module.exports = { create };
