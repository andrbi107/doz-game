/* ============================================
   SERVER/FRIENDS.JS - Friends list and social features
   ============================================ */

function create(store) {
    // Each user has a friends array (usernames) and friend requests
    // store.users.get(username).friends = ['user1', 'user2', ...]
    // store.users.get(username).friendRequests = [{ from, date }, ...]

    function initUser(user) {
        if (!user.friends) user.friends = [];
        if (!user.friendRequests) user.friendRequests = [];
        if (!user.blocked) user.blocked = [];
    }

    function sendRequest(fromUsername, toUsername) {
        const fromUser = store.users.get(fromUsername);
        const toUser = store.users.get(toUsername);
        if (!fromUser || !toUser) return { ok: false, error: 'کاربر یافت نشد' };
        initUser(fromUser);
        initUser(toUser);

        if (fromUsername === toUsername) return { ok: false, error: 'نمی‌توانید به خودتان درخواست بدهید' };
        if (fromUser.friends.includes(toUsername)) return { ok: false, error: 'این کاربر از قبل دوست شماست' };
        if (fromUser.blocked.includes(toUsername)) return { ok: false, error: 'این کاربر را مسدود کرده‌اید' };
        if (toUser.blocked.includes(fromUsername)) return { ok: false, error: 'امکان ارسال درخواست وجود ندارد' };

        // Check if already requested
        const existing = toUser.friendRequests.find(r => r.from === fromUsername);
        if (existing) return { ok: false, error: 'درخواست قبلاً ارسال شده' };

        toUser.friendRequests.push({ from: fromUsername, date: Date.now() });
        return { ok: true };
    }

    function acceptRequest(username, fromUsername) {
        const user = store.users.get(username);
        const fromUser = store.users.get(fromUsername);
        if (!user || !fromUser) return { ok: false, error: 'کاربر یافت نشد' };
        initUser(user);
        initUser(fromUser);

        const idx = user.friendRequests.findIndex(r => r.from === fromUsername);
        if (idx < 0) return { ok: false, error: 'درخواستی یافت نشد' };

        // Remove request
        user.friendRequests.splice(idx, 1);
        // Add to both friends lists
        if (!user.friends.includes(fromUsername)) user.friends.push(fromUsername);
        if (!fromUser.friends.includes(username)) fromUser.friends.push(username);
        return { ok: true };
    }

    function rejectRequest(username, fromUsername) {
        const user = store.users.get(username);
        if (!user) return { ok: false, error: 'کاربر یافت نشد' };
        initUser(user);
        const idx = user.friendRequests.findIndex(r => r.from === fromUsername);
        if (idx >= 0) user.friendRequests.splice(idx, 1);
        return { ok: true };
    }

    function removeFriend(username, friendUsername) {
        const user = store.users.get(username);
        const friend = store.users.get(friendUsername);
        if (!user || !friend) return { ok: false, error: 'کاربر یافت نشد' };
        initUser(user);
        initUser(friend);
        user.friends = user.friends.filter(f => f !== friendUsername);
        friend.friends = friend.friends.filter(f => f !== username);
        return { ok: true };
    }

    function blockUser(username, blockedUsername) {
        const user = store.users.get(username);
        if (!user) return { ok: false, error: 'کاربر یافت نشد' };
        initUser(user);
        if (!user.blocked.includes(blockedUsername)) {
            user.blocked.push(blockedUsername);
        }
        // Also remove from friends
        user.friends = user.friends.filter(f => f !== blockedUsername);
        return { ok: true };
    }

    function getFriends(username) {
        const user = store.users.get(username);
        if (!user) return [];
        initUser(user);
        return user.friends.map(f => {
            const friend = store.users.get(f);
            return friend ? {
                username: friend.username,
                elo: friend.elo,
                wins: friend.wins,
                losses: friend.losses,
                draws: friend.draws,
            } : null;
        }).filter(Boolean);
    }

    function getFriendRequests(username) {
        const user = store.users.get(username);
        if (!user) return [];
        initUser(user);
        return user.friendRequests.map(r => {
            const fromUser = store.users.get(r.from);
            return fromUser ? {
                from: r.from,
                elo: fromUser.elo,
                date: r.date,
            } : null;
        }).filter(Boolean);
    }

    function searchUsers(query, limit = 20) {
        if (!query || query.length < 2) return [];
        const results = [];
        const lowerQuery = query.toLowerCase();
        for (const [username, user] of store.users) {
            if (username.toLowerCase().includes(lowerQuery)) {
                results.push({
                    username,
                    elo: user.elo,
                    wins: user.wins,
                    losses: user.losses,
                    draws: user.draws,
                });
                if (results.length >= limit) break;
            }
        }
        return results;
    }

    return {
        sendRequest,
        acceptRequest,
        rejectRequest,
        removeFriend,
        blockUser,
        getFriends,
        getFriendRequests,
        searchUsers,
    };
}

module.exports = { create };
