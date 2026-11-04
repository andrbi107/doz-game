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
        on,
        getServerUrl,
        setServerUrl,
        isConnected: () => isConnected,
    };
})();
