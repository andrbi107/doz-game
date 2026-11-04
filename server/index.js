/* ============================================
   SERVER/INDEX.JS - Main entry point for Doz game server
   Handles HTTP serving + WebSocket (Socket.io)
   ============================================ */

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid');

const Auth = require('./auth');
const Matchmaker = require('./matchmaker');
const GameRoom = require('./gameroom');
const Presence = require('./presence');
const ELO = require('./elo');
const Friends = require('./friends');
const Tournament = require('./tournament');
const League = require('./league');
const Spectator = require('./spectator');
const Analysis = require('./analysis');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'doz-dev-secret-change-in-prod';

const app = express();
app.use(cors());
app.use(express.json());

// In-memory store (replace with Redis/Postgres in production)
const store = {
    users: new Map(),       // username -> { id, username, passwordHash, elo, wins, losses, draws }
    sessions: new Map(),    // sessionToken -> { userId, username, expiresAt }
    leaderboard: [],
};

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        playersOnline: Presence.getOnlineCount(),
        activeGames: GameRoom.getActiveCount(),
    });
});

// Auth routes
app.post('/api/auth/register', (req, res) => Auth.register(req, res, store, JWT_SECRET));
app.post('/api/auth/login', (req, res) => Auth.login(req, res, store, JWT_SECRET));
app.post('/api/auth/refresh', (req, res) => Auth.refresh(req, res, store, JWT_SECRET));

// Profile routes
app.get('/api/profile/:username', (req, res) => Auth.getProfile(req, res, store));
app.get('/api/leaderboard', (req, res) => {
    const board = Array.from(store.users.values())
        .map(u => ({ username: u.username, elo: u.elo, wins: u.wins, losses: u.losses, draws: u.draws }))
        .sort((a, b) => b.elo - a.elo)
        .slice(0, 100);
    res.json(board);
});

// Friends routes (v5)
const friends = Friends.create(store);

// Tournament, League, Spectator (v6)
const tournament = Tournament.create(io, store, presence, GameRoom, ELO);
const league = League.create(io, store);
const spectator = Spectator.create(io);

// Auth middleware for friend routes
function authMiddleware(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'احراز هویت الزامی است' });
    }
    const token = auth.substring(7);
    try {
        const payload = Auth.verifyToken(token, JWT_SECRET);
        req.username = payload.username;
        next();
    } catch (e) {
        return res.status(401).json({ error: 'توکن نامعتبر' });
    }
}

app.get('/api/friends', authMiddleware, (req, res) => {
    res.json(friends.getFriends(req.username));
});

app.get('/api/friends/requests', authMiddleware, (req, res) => {
    res.json(friends.getFriendRequests(req.username));
});

app.post('/api/friends/request/:username', authMiddleware, (req, res) => {
    const result = friends.sendRequest(req.username, req.params.username);
    if (result.ok) res.json({ ok: true });
    else res.status(400).json({ error: result.error });
});

app.post('/api/friends/accept/:username', authMiddleware, (req, res) => {
    const result = friends.acceptRequest(req.username, req.params.username);
    if (result.ok) res.json({ ok: true });
    else res.status(400).json({ error: result.error });
});

app.post('/api/friends/reject/:username', authMiddleware, (req, res) => {
    const result = friends.rejectRequest(req.username, req.params.username);
    if (result.ok) res.json({ ok: true });
    else res.status(400).json({ error: result.error });
});

app.delete('/api/friends/:username', authMiddleware, (req, res) => {
    const result = friends.removeFriend(req.username, req.params.username);
    if (result.ok) res.json({ ok: true });
    else res.status(400).json({ error: result.error });
});

app.post('/api/friends/block/:username', authMiddleware, (req, res) => {
    const result = friends.blockUser(req.username, req.params.username);
    if (result.ok) res.json({ ok: true });
    else res.status(400).json({ error: result.error });
});

app.get('/api/users/search', authMiddleware, (req, res) => {
    const q = req.query.q || '';
    res.json(friends.searchUsers(q));
});

/* ---------- Tournament routes (v6) ---------- */

app.get('/api/tournament', (req, res) => {
    res.json(tournament.getInfo());
});

app.get('/api/tournament/participants', (req, res) => {
    res.json(tournament.getParticipants());
});

app.post('/api/tournament/signup', authMiddleware, (req, res) => {
    const result = tournament.signup(req.username);
    if (result.ok) res.json(result);
    else res.status(400).json({ error: result.error });
});

app.post('/api/tournament/start', authMiddleware, (req, res) => {
    // Only admin could start; for demo, anyone can
    const result = tournament.startTournament();
    if (result.ok) res.json(result);
    else res.status(400).json({ error: result.error });
});

/* ---------- League routes (v6) ---------- */

app.get('/api/league/season', (req, res) => {
    res.json(league.getSeasonInfo());
});

app.get('/api/league/me', authMiddleware, (req, res) => {
    const stats = league.getPlayerSeason(req.username);
    if (!stats) res.json({ seasonElo: 1200, wins: 0, losses: 0, draws: 0, gamesPlayed: 0, tier: 'برنز', tierIcon: '🥉', rankInTier: 0, tierSize: 0 });
    else res.json(stats);
});

app.get('/api/leaderboard/:tier', (req, res) => {
    res.json(league.getTierLeaderboard(req.params.tier));
});

/* ---------- Spectator routes (v6) ---------- */

app.get('/api/spectate/games', (req, res) => {
    res.json(spectator.getAvailableGames());
});

/* ---------- Analysis routes (v6) ---------- */

app.post('/api/analysis', (req, res) => {
    const { moves, boardSize } = req.body;
    if (!moves || !Array.isArray(moves)) {
        return res.status(400).json({ error: 'moves array required' });
    }
    const result = Analysis.analyzeGame(moves, boardSize || 3);
    res.json(result);
});

// HTTP server
const server = http.createServer(app);

// Socket.io
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Auth middleware for socket
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication required'));
    }
    try {
        const payload = Auth.verifyToken(token, JWT_SECRET);
        socket.userId = payload.userId;
        socket.username = payload.username;
        next();
    } catch (e) {
        next(new Error('Invalid or expired token'));
    }
});

// Presence tracker
const presence = Presence.create(io);
const matchmaking = Matchmaker.create(presence);
const gameRooms = new Map();

io.on('connection', (socket) => {
    console.log(`[Connect] ${socket.username} connected`);

    // Mark online
    presence.setOnline(socket.userId, socket.username, socket.id);

    // === Matchmaking ===

    // Quick match (random opponent)
    socket.on('match:quick', (data, ack) => {
        const elo = getUserElo(socket.userId);
        matchmaking.joinQueue(socket, elo, (player1, player2) => {
            // Create game room
            const roomId = uuidv4();
            const room = GameRoom.create(roomId, player1, player2, io);
            gameRooms.set(roomId, room);
            room.start();
        });
        if (ack) ack({ status: 'searching' });
    });

    // Cancel matchmaking
    socket.on('match:cancel', () => {
        matchmaking.leaveQueue(socket);
    });

    // Create private room (invite by code)
    socket.on('match:create-private', (data, ack) => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const roomId = uuidv4();
        // Wait for opponent to join with code
        matchmaking.createPrivateRoom(socket, code, roomId);
        if (ack) ack({ code, roomId });
    });

    // Join private room by code
    socket.on('match:join-private', (data, ack) => {
        const { code } = data;
        const result = matchmaking.joinPrivateRoom(socket, code);
        if (result.ok) {
            const room = GameRoom.create(result.roomId, result.player1, socket, io);
            gameRooms.set(result.roomId, room);
            room.start();
            if (ack) ack({ ok: true, roomId: result.roomId });
        } else {
            if (ack) ack({ ok: false, error: result.error });
        }
    });

    // === In-game ===

    socket.on('game:move', (data) => {
        const { roomId, index } = data;
        const room = gameRooms.get(roomId);
        if (room) room.handleMove(socket, index);
    });

    socket.on('game:resign', (data) => {
        const { roomId } = data;
        const room = gameRooms.get(roomId);
        if (room) room.handleResign(socket);
    });

    socket.on('game:rematch', (data) => {
        const { roomId } = data;
        const room = gameRooms.get(roomId);
        if (room) room.handleRematchRequest(socket);
    });

    // Chat (emotes only for safety)
    socket.on('chat:emote', (data) => {
        const { roomId, emote } = data;
        const room = gameRooms.get(roomId);
        if (room) room.broadcastEmote(socket, emote);
    });

    // === Spectator (v6) ===
    socket.on('spectate:join', (data, ack) => {
        const { roomId } = data;
        const result = spectator.addSpectator(socket, roomId);
        if (ack) ack(result);
    });

    socket.on('spectate:leave', (data) => {
        spectator.removeSpectator(socket, data.roomId);
    });

    socket.on('spectate:emote', (data) => {
        spectator.broadcastSpectatorEmote(data.roomId, socket.username, data.emote);
    });

    // === Tournament (v6) ===
    socket.on('tournament:signup', (data, ack) => {
        const result = tournament.signup(socket.username);
        if (ack) ack(result);
    });

    // === Disconnect ===
    socket.on('disconnect', () => {
        console.log(`[Disconnect] ${socket.username} disconnected`);
        presence.setOffline(socket.userId);
        matchmaking.leaveQueue(socket);
        // Handle active games
        for (const [id, room] of gameRooms) {
            if (room.hasPlayer(socket)) {
                room.handleDisconnect(socket);
            }
        }
        // Remove from spectator rooms
        // (socket.io auto-cleans rooms on disconnect)
    });
});

function getUserElo(userId) {
    const user = store.users.get(userId);
    return user ? user.elo : 1200;
}

// Update ELO after game
GameRoom.onGameEnd = (room, winner, loser, isDraw) => {
    const winnerUser = store.users.get(winner.userId);
    const loserUser = store.users.get(loser.userId);
    if (!winnerUser || !loserUser) return;

    let eloChange = 0;
    if (isDraw) {
        winnerUser.draws = (winnerUser.draws || 0) + 1;
        loserUser.draws = (loserUser.draws || 0) + 1;
        // Record in league (v6)
        league.recordGame(winnerUser.username, 'draw', 0);
        league.recordGame(loserUser.username, 'draw', 0);
    } else {
        const result = ELO.update(winnerUser.elo, loserUser.elo);
        eloChange = result.change;
        winnerUser.elo = result.newWinnerElo;
        loserUser.elo = result.newLoserElo;
        winnerUser.wins = (winnerUser.wins || 0) + 1;
        loserUser.losses = (loserUser.losses || 0) + 1;
        // Record in league (v6)
        league.recordGame(winnerUser.username, 'win', eloChange);
        league.recordGame(loserUser.username, 'loss', eloChange);
    }

    // Notify spectator room (v6)
    spectator.finishGame(room.id, isDraw ? null : room.winner, room.line || null);

    // Cleanup room after delay
    setTimeout(() => gameRooms.delete(room.id), 60000);
};

server.listen(PORT, () => {
    console.log(`Doz game server listening on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
});
