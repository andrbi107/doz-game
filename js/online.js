/* ============================================
   JS/ONLINE.JS - Client for online multiplayer
   Handles auth, matchmaking, and game communication via Socket.io
   ============================================ */

const Online = (function () {
    'use strict';

    let socket = null;
    let token = null;
    let currentUser = null;
    let isConnected = false;

    // Event handlers
    let handlers = {
        onConnect: null,
        onDisconnect: null,
        onMatchStatus: null,
        onMatchFound: null,
        onGameStart: null,
        onGameMove: null,
        onGameEnd: null,
        onGameError: null,
        onChatEmote: null,
        onPresenceUpdate: null,
        onRematchRequest: null,
        onRematchStart: null,
    };

    // Load saved token
    function loadToken() {
        try {
            return localStorage.getItem('doz.token') || null;
        } catch (e) { return null; }
    }

    function saveToken(t) {
        try { localStorage.setItem('doz.token', t); } catch (e) {}
    }

    function clearToken() {
        try { localStorage.removeItem('doz.token'); } catch (e) {}
    }

    function loadUser() {
        try {
            const raw = localStorage.getItem('doz.user');
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }

    function saveUser(u) {
        try { localStorage.setItem('doz.user', JSON.stringify(u)); } catch (e) {}
    }

    function clearUser() {
        try { localStorage.removeItem('doz.user'); } catch (e) {}
    }

    /**
     * Set the server URL.
     */
    function getServerUrl() {
        // For production, replace with your server URL
        return localStorage.getItem('doz.serverUrl') || 'http://localhost:3000';
    }

    function setServerUrl(url) {
        localStorage.setItem('doz.serverUrl', url);
    }

    /**
     * Register a new account.
     */
    async function register(username, password) {
        const url = getServerUrl() + '/api/auth/register';
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Registration failed');
        token = data.token;
        currentUser = data.user;
        saveToken(token);
        saveUser(currentUser);
        return data;
    }

    /**
     * Login.
     */
    async function login(username, password) {
        const url = getServerUrl() + '/api/auth/login';
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error || 'Login failed');
        token = data.token;
        currentUser = data.user;
        saveToken(token);
        saveUser(currentUser);
        return data;
    }

    function logout() {
        token = null;
        currentUser = null;
        clearToken();
        clearUser();
        if (socket) {
            socket.disconnect();
            socket = null;
        }
        isConnected = false;
    }

    function isLoggedIn() {
        return !!token;
    }

    function getUser() {
        return currentUser || loadUser();
    }

    /**
     * Connect to the server with Socket.io.
     * Requires socket.io client to be loaded.
     */
    function connect() {
        if (!token) throw new Error('Not logged in');
        if (typeof io === 'undefined') throw new Error('Socket.io client not loaded');

        if (socket) socket.disconnect();

        socket = io(getServerUrl(), {
            auth: { token },
            transports: ['websocket'],
        });

        socket.on('connect', () => {
            isConnected = true;
            if (handlers.onConnect) handlers.onConnect();
        });

        socket.on('disconnect', () => {
            isConnected = false;
            if (handlers.onDisconnect) handlers.onDisconnect();
        });

        socket.on('match:status', (data) => {
            if (handlers.onMatchStatus) handlers.onMatchStatus(data);
        });

        socket.on('match:found', (data) => {
            if (handlers.onMatchFound) handlers.onMatchFound(data);
        });

        socket.on('match:private-expired', (data) => {
            if (handlers.onMatchStatus) handlers.onMatchStatus({ status: 'private-expired', code: data.code });
        });

        socket.on('game:start', (data) => {
            if (handlers.onGameStart) handlers.onGameStart(data);
        });

        socket.on('game:role', (data) => {
            if (handlers.onGameStart) handlers.onGameStart({ role: data.role });
        });

        socket.on('game:move', (data) => {
            if (handlers.onGameMove) handlers.onGameMove(data);
        });

        socket.on('game:end', (data) => {
            if (handlers.onGameEnd) handlers.onGameEnd(data);
        });

        socket.on('game:error', (data) => {
            if (handlers.onGameError) handlers.onGameError(data);
        });

        socket.on('game:rematch-request', (data) => {
            if (handlers.onRematchRequest) handlers.onRematchRequest(data);
        });

        socket.on('game:rematch-start', (data) => {
            if (handlers.onRematchStart) handlers.onRematchStart(data);
        });

        socket.on('chat:emote', (data) => {
            if (handlers.onChatEmote) handlers.onChatEmote(data);
        });

        socket.on('presence:update', (data) => {
            if (handlers.onPresenceUpdate) handlers.onPresenceUpdate(data);
        });

        // Spectate events (v6)
        socket.on('spectate:state', (data) => {
            if (window.OnlineUI) OnlineUI.handleSpectateState(data);
        });
        socket.on('spectate:move', (data) => {
            if (window.OnlineUI) OnlineUI.handleSpectateMove(data);
        });
        socket.on('spectate:end', (data) => {
            if (window.OnlineUI) OnlineUI.handleSpectateEnd(data);
        });
        socket.on('spectate:spectator-count', (data) => {
            const el = document.getElementById('spectatorCount');
            if (el) el.textContent = data.count;
        });
        socket.on('spectate:emote', (data) => {
            if (window.OnlineUI) OnlineUI.handleSpectateEmote(data);
        });

        return socket;
    }

    function disconnect() {
        if (socket) {
            socket.disconnect();
            socket = null;
        }
        isConnected = false;
    }

    /* ---------- Matchmaking actions ---------- */

    function quickMatch() {
        if (!socket) return;
        socket.emit('match:quick');
    }

    function cancelMatch() {
        if (!socket) return;
        socket.emit('match:cancel');
    }

    function createPrivateRoom() {
        return new Promise((resolve, reject) => {
            if (!socket) return reject(new Error('Not connected'));
            socket.emit('match:create-private', {}, (response) => {
                if (response && response.code) resolve(response);
                else reject(new Error('Failed to create room'));
            });
        });
    }

    function joinPrivateRoom(code) {
        return new Promise((resolve, reject) => {
            if (!socket) return reject(new Error('Not connected'));
            socket.emit('match:join-private', { code }, (response) => {
                if (response && response.ok) resolve(response);
                else reject(new Error(response?.error || 'Failed to join'));
            });
        });
    }

    /* ---------- In-game actions ---------- */

    function sendMove(roomId, index) {
        if (!socket) return;
        socket.emit('game:move', { roomId, index });
    }

    function resign(roomId) {
        if (!socket) return;
        socket.emit('game:resign', { roomId });
    }

    function requestRematch(roomId) {
        if (!socket) return;
        socket.emit('game:rematch', { roomId });
    }

    function sendEmote(roomId, emote) {
        if (!socket) return;
        socket.emit('chat:emote', { roomId, emote });
    }

    /* ---------- Friends (v5) ---------- */

    async function apiGet(path) {
        const resp = await fetch(getServerUrl() + path, {
            headers: { 'Authorization': 'Bearer ' + token },
        });
        if (!resp.ok) throw new Error((await resp.json()).error || 'Request failed');
        return resp.json();
    }

    async function apiPost(path, method = 'POST') {
        const resp = await fetch(getServerUrl() + path, {
            method,
            headers: { 'Authorization': 'Bearer ' + token },
        });
        if (!resp.ok) throw new Error((await resp.json()).error || 'Request failed');
        return resp.json();
    }

    async function getFriends() {
        return apiGet('/api/friends');
    }

    async function getFriendRequests() {
        return apiGet('/api/friends/requests');
    }

    async function sendFriendRequest(username) {
        return apiPost('/api/friends/request/' + encodeURIComponent(username));
    }

    async function acceptFriendRequest(username) {
        return apiPost('/api/friends/accept/' + encodeURIComponent(username));
    }

    async function rejectFriendRequest(username) {
        return apiPost('/api/friends/reject/' + encodeURIComponent(username));
    }

    async function removeFriend(username) {
        return apiPost('/api/friends/' + encodeURIComponent(username), 'DELETE');
    }

    async function blockUser(username) {
        return apiPost('/api/friends/block/' + encodeURIComponent(username));
    }

    async function searchUsers(query) {
        return apiGet('/api/users/search?q=' + encodeURIComponent(query));
    }

    async function getLeaderboard() {
        const resp = await fetch(getServerUrl() + '/api/leaderboard');
        return resp.json();
    }

    async function getProfile(username) {
        const resp = await fetch(getServerUrl() + '/api/profile/' + encodeURIComponent(username));
        if (!resp.ok) throw new Error('کاربر یافت نشد');
        return resp.json();
    }

    /* ---------- Tournament (v6) ---------- */

    async function getTournament() {
        const resp = await fetch(getServerUrl() + '/api/tournament');
        return resp.json();
    }

    async function getTournamentParticipants() {
        const resp = await fetch(getServerUrl() + '/api/tournament/participants');
        return resp.json();
    }

    async function signupTournament() {
        return apiPost('/api/tournament/signup');
    }

    async function startTournament() {
        return apiPost('/api/tournament/start');
    }

    /* ---------- League (v6) ---------- */

    async function getLeagueSeason() {
        const resp = await fetch(getServerUrl() + '/api/league/season');
        return resp.json();
    }

    async function getMyLeagueStats() {
        return apiGet('/api/league/me');
    }

    async function getTierLeaderboard(tier) {
        const resp = await fetch(getServerUrl() + '/api/leaderboard/' + encodeURIComponent(tier));
        return resp.json();
    }

    /* ---------- Spectator (v6) ---------- */

    async function getSpectateGames() {
        const resp = await fetch(getServerUrl() + '/api/spectate/games');
        return resp.json();
    }

    function spectateJoin(roomId) {
        if (!socket) return;
        socket.emit('spectate:join', { roomId });
    }

    function spectateLeave(roomId) {
        if (!socket) return;
        socket.emit('spectate:leave', { roomId });
    }

    function spectateEmote(roomId, emote) {
        if (!socket) return;
        socket.emit('spectate:emote', { roomId, emote });
    }

    /* ---------- Analysis (v6) ---------- */

    async function analyzeGame(moves, boardSize = 3) {
        const resp = await fetch(getServerUrl() + '/api/analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ moves, boardSize }),
        });
        if (!resp.ok) throw new Error('Analysis failed');
        return resp.json();
    }

    /* ---------- Set handlers ---------- */

    function on(event, handler) {
        handlers['on' + event.charAt(0).toUpperCase() + event.slice(1)] = handler;
    }

    return {
        register,
        login,
        logout,
        isLoggedIn,
        getUser,
        connect,
        disconnect,
        quickMatch,
        cancelMatch,
        createPrivateRoom,
        joinPrivateRoom,
        sendMove,
        resign,
        requestRematch,
        sendEmote,
        // Friends (v5)
        getFriends,
        getFriendRequests,
        sendFriendRequest,
        acceptFriendRequest,
        rejectFriendRequest,
        removeFriend,
        blockUser,
        searchUsers,
        getLeaderboard,
        getProfile,
        // v6
        getTournament,
        getTournamentParticipants,
        signupTournament,
        startTournament,
        getLeagueSeason,
        getMyLeagueStats,
        getTierLeaderboard,
        getSpectateGames,
        spectateJoin,
        spectateLeave,
        spectateEmote,
        analyzeGame,
        on,
        getServerUrl,
        setServerUrl,
        isConnected: () => isConnected,
    };
})();
