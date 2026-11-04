/* ============================================
   SERVER/PRESENCE.JS - Online presence tracker
   Tracks which users are online via their socket connections
   ============================================ */

function create(io) {
    // userId -> { username, socketId, lastSeen }
    const online = new Map();

    function setOnline(userId, username, socketId) {
        online.set(userId, { username, socketId, lastSeen: Date.now() });
        // Broadcast presence update
        io.emit('presence:update', {
            userId,
            username,
            online: true,
        });
    }

    function setOffline(userId) {
        if (online.has(userId)) {
            const entry = online.get(userId);
            online.delete(userId);
            io.emit('presence:update', {
                userId,
                username: entry.username,
                online: false,
            });
        }
    }

    function isOnline(userId) {
        return online.has(userId);
    }

    function getOnlineCount() {
        return online.size;
    }

    function getOnlineUsers() {
        return Array.from(online.entries()).map(([userId, data]) => ({
            userId,
            username: data.username,
        }));
    }

    function getSocketId(userId) {
        const entry = online.get(userId);
        return entry ? entry.socketId : null;
    }

    // Cleanup stale entries (heartbeat)
    setInterval(() => {
        const now = Date.now();
        for (const [userId, data] of online) {
            if (now - data.lastSeen > 5 * 60 * 1000) { // 5 min timeout
                online.delete(userId);
                io.emit('presence:update', {
                    userId,
                    username: data.username,
                    online: false,
                });
            }
        }
    }, 60 * 1000);

    return {
        setOnline,
        setOffline,
        isOnline,
        getOnlineCount,
        getOnlineUsers,
        getSocketId,
    };
}

module.exports = { create };
