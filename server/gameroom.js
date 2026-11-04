/* ============================================
   SERVER/GAMEROOM.JS - Manages a single game room
   Handles moves, validation, win detection, ELO update

   BUG-014 fix: Send individual game:start to each player with their role
   BUG-016 fix: Include roomId in all events so client can track it
   ============================================ */

const { v4: uuidv4 } = require('uuid');

// Game state constants
const BOARD_SIZE = 3;
const WIN_LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
];

let onGameEndCallback = null;

function setOnGameEnd(fn) {
    onGameEndCallback = fn;
}

function create(roomId, player1, player2, io) {
    // Assign X/O randomly
    const p1Role = Math.random() < 0.5 ? 'x' : 'o';
    const p2Role = p1Role === 'x' ? 'o' : 'x';

    const room = {
        id: roomId,
        player1,
        player2,
        board: new Array(9).fill(null),
        currentPlayer: 'x',
        moves: [],
        winner: null,
        finished: false,
        rematchVotes: new Set(),
        roles: {},
        line: null,
    };
    room.roles[player1.id] = p1Role;
    room.roles[player2.id] = p2Role;

    function getPlayerRole(socket) {
        return room.roles[socket.id];
    }

    function getPlayerName(role) {
        if (room.roles[player1.id] === role) return player1.username;
        if (room.roles[player2.id] === role) return player2.username;
        return '?';
    }

    function start() {
        // Join both sockets to the room
        player1.join(roomId);
        player2.join(roomId);

        // BUG-014 fix: Send individual game:start to each player with their role
        // This ensures each player knows their own role
        const baseData = {
            roomId,
            board: room.board,
            currentPlayer: room.currentPlayer,
            players: {
                x: getPlayerName('x'),
                o: getPlayerName('o'),
            },
        };

        player1.emit('game:start', { ...baseData, yourRole: p1Role });
        player2.emit('game:start', { ...baseData, yourRole: p2Role });
    }

    function handleMove(socket, index) {
        if (room.finished) return;
        const role = getPlayerRole(socket);
        if (!role) {
            socket.emit('game:error', { error: 'شما در این بازی نیستید' });
            return;
        }
        if (role !== room.currentPlayer) {
            socket.emit('game:error', { error: 'نوبت شما نیست' });
            return;
        }
        if (index < 0 || index >= 9) {
            socket.emit('game:error', { error: 'حرکت نامعتبر' });
            return;
        }
        if (room.board[index] !== null) {
            socket.emit('game:error', { error: 'این خانه پر است' });
            return;
        }

        // Apply move
        room.board[index] = role;
        room.moves.push({ player: role, index, by: socket.username });

        // Check winner
        const result = checkWinner(room.board);
        if (result.winner) {
            room.winner = result.winner;
            room.line = result.line;
            room.finished = true;
            // Broadcast move
            io.to(roomId).emit('game:move', {
                roomId,
                index, player: role, board: room.board,
            });
            // Broadcast end
            io.to(roomId).emit('game:end', {
                roomId,
                winner: result.winner,
                line: result.line,
                board: room.board,
            });
            // Update ELO
            const winnerSocket = role === room.roles[player1.id] ? player1 : player2;
            const loserSocket = winnerSocket === player1 ? player2 : player1;
            if (onGameEndCallback) {
                onGameEndCallback(room, winnerSocket, loserSocket, false);
            }
            return;
        }
        if (room.board.every(c => c !== null)) {
            // Draw
            room.finished = true;
            io.to(roomId).emit('game:move', {
                roomId,
                index, player: role, board: room.board,
            });
            io.to(roomId).emit('game:end', {
                roomId,
                winner: null,
                line: null,
                board: room.board,
            });
            if (onGameEndCallback) {
                onGameEndCallback(room, player1, player2, true);
            }
            return;
        }

        // Switch player
        room.currentPlayer = role === 'x' ? 'o' : 'x';
        io.to(roomId).emit('game:move', {
            roomId,
            index, player: role, board: room.board, currentPlayer: room.currentPlayer,
        });
    }

    function handleResign(socket) {
        if (room.finished) return;
        const role = getPlayerRole(socket);
        if (!role) return;
        const winner = role === 'x' ? 'o' : 'x';
        room.winner = winner;
        room.finished = true;
        io.to(roomId).emit('game:end', {
            roomId,
            winner,
            line: null,
            board: room.board,
            resigned: true,
        });
        const winnerSocket = winner === room.roles[player1.id] ? player1 : player2;
        const loserSocket = winnerSocket === player1 ? player2 : player1;
        if (onGameEndCallback) {
            onGameEndCallback(room, winnerSocket, loserSocket, false);
        }
    }

    function handleRematchRequest(socket) {
        room.rematchVotes.add(socket.id);
        io.to(roomId).emit('game:rematch-request', { by: socket.username });
        if (room.rematchVotes.size === 2) {
            // Both agreed - reset room
            room.board = new Array(9).fill(null);
            room.currentPlayer = 'x';
            room.moves = [];
            room.winner = null;
            room.line = null;
            room.finished = false;
            room.rematchVotes.clear();
            // Swap roles
            const tmp = room.roles[player1.id];
            room.roles[player1.id] = room.roles[player2.id];
            room.roles[player2.id] = tmp;
            // Send rematch-start to each player with their new role
            const baseData = {
                roomId,
                board: room.board,
                currentPlayer: room.currentPlayer,
                players: {
                    x: getPlayerName('x'),
                    o: getPlayerName('o'),
                },
            };
            player1.emit('game:rematch-start', { ...baseData, yourRole: room.roles[player1.id] });
            player2.emit('game:rematch-start', { ...baseData, yourRole: room.roles[player2.id] });
        }
    }

    function handleDisconnect(socket) {
        if (room.finished) return;
        const role = getPlayerRole(socket);
        if (!role) return;
        // Auto-loss for disconnected player
        const winner = role === 'x' ? 'o' : 'x';
        room.winner = winner;
        room.finished = true;
        io.to(roomId).emit('game:end', {
            roomId,
            winner,
            line: null,
            board: room.board,
            disconnected: true,
        });
        const winnerSocket = winner === room.roles[player1.id] ? player1 : player2;
        const loserSocket = winnerSocket === player1 ? player2 : player1;
        if (onGameEndCallback && loserSocket.id === socket.id) {
            onGameEndCallback(room, winnerSocket, loserSocket, false);
        }
    }

    function broadcastEmote(socket, emote) {
        io.to(roomId).emit('chat:emote', {
            by: socket.username,
            emote,
        });
    }

    function hasPlayer(socket) {
        return socket.id === player1.id || socket.id === player2.id;
    }

    // Return the room object with methods attached, keeping live references
    room.start = start;
    room.handleMove = handleMove;
    room.handleResign = handleResign;
    room.handleRematchRequest = handleRematchRequest;
    room.handleDisconnect = handleDisconnect;
    room.broadcastEmote = broadcastEmote;
    room.hasPlayer = hasPlayer;
    return room;
}

function checkWinner(board) {
    for (const line of WIN_LINES) {
        const [a, b, c] = line;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return { winner: board[a], line };
        }
    }
    return { winner: null, line: null };
}

function getActiveCount() {
    return 0; // placeholder - actual count tracked in index.js
}

module.exports = {
    create,
    checkWinner,
    getActiveCount,
    set onGameEnd(fn) { onGameEndCallback = fn; },
};
