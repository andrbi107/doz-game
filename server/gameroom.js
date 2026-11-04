/* ============================================
   SERVER/GAMEROOM.JS - Manages a single game room
   Handles moves, validation, win detection, ELO update
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
        // Assign X/O randomly
        roles: Math.random() < 0.5
            ? { [player1.id]: 'x', [player2.id]: 'o' }
            : { [player1.id]: 'o', [player2.id]: 'x' },
    };

    function getPlayerRole(socket) {
        return room.roles[socket.id];
    }

    function getOpponent(socket) {
        return socket.id === player1.id ? player2 : player1;
    }

    function start() {
        // Join both sockets to the room
        player1.join(roomId);
        player2.join(roomId);

        // Notify both players
        io.to(roomId).emit('game:start', {
            roomId,
            board: room.board,
            currentPlayer: room.currentPlayer,
            players: {
                x: player1.id === Object.keys(room.roles).find(k => room.roles[k] === 'x') ? player1.username : player2.username,
                o: player1.id === Object.keys(room.roles).find(k => room.roles[k] === 'o') ? player1.username : player2.username,
            },
            yourRole: getPlayerRole(player1),
        });
        // Send individual role info
        player1.emit('game:role', { role: room.roles[player1.id] });
        player2.emit('game:role', { role: room.roles[player2.id] });
    }

    function handleMove(socket, index) {
        if (room.finished) return;
        const role = getPlayerRole(socket);
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
            room.finished = true;
            io.to(roomId).emit('game:move', {
                index, player: role, board: room.board,
            });
            io.to(roomId).emit('game:end', {
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
                index, player: role, board: room.board,
            });
            io.to(roomId).emit('game:end', {
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
            index, player: role, board: room.board, currentPlayer: room.currentPlayer,
        });
    }

    function handleResign(socket) {
        if (room.finished) return;
        const role = getPlayerRole(socket);
        const winner = role === 'x' ? 'o' : 'x';
        room.winner = winner;
        room.finished = true;
        io.to(roomId).emit('game:end', {
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
            room.finished = false;
            room.rematchVotes.clear();
            // Swap roles
            const tmp = room.roles[player1.id];
            room.roles[player1.id] = room.roles[player2.id];
            room.roles[player2.id] = tmp;
            io.to(roomId).emit('game:rematch-start', {
                board: room.board,
                currentPlayer: room.currentPlayer,
            });
            player1.emit('game:role', { role: room.roles[player1.id] });
            player2.emit('game:role', { role: room.roles[player2.id] });
        }
    }

    function handleDisconnect(socket) {
        if (room.finished) return;
        // Auto-loss for disconnected player
        const role = getPlayerRole(socket);
        const winner = role === 'x' ? 'o' : 'x';
        room.winner = winner;
        room.finished = true;
        io.to(roomId).emit('game:end', {
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

let activeCount = 0;
function getActiveCount() {
    return activeCount;
}

module.exports = {
    create,
    checkWinner,
    getActiveCount,
    set onGameEnd(fn) { onGameEndCallback = fn; },
};
