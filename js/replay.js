/* ============================================
   REPLAY.JS - Replay last finished game
   Stores last game's moves and lets user scrub through them.
   ============================================ */

const Replay = (function () {
    'use strict';

    let lastGame = null;
    let playIndex = 0;
    let playing = false;
    let intervalId = null;
    let callbacks = {};

    function load() {
        lastGame = Storage.getLastGame();
        return lastGame;
    }

    function hasReplay() {
        return !!lastGame || !!Storage.getLastGame();
    }

    function getReplay() {
        if (!lastGame) load();
        return lastGame;
    }

    /**
     * Start replay mode.
     * @param {Object} cbs - { onMove(board, moveIndex, moveMeta), onEnd(), onReset() }
     */
    function start(cbs = {}) {
        if (!load()) return false;
        callbacks = cbs;
        playIndex = 0;
        stopPlayback();
        // Show empty board first
        const board = Game.emptyBoard();
        if (callbacks.onMove) callbacks.onMove(board, -1, null);
        return true;
    }

    function stepForward() {
        if (!lastGame) return;
        if (playIndex >= lastGame.moves.length) {
            if (callbacks.onEnd) callbacks.onEnd();
            return;
        }
        const move = lastGame.moves[playIndex];
        const board = Game.emptyBoard();
        for (let i = 0; i <= playIndex; i++) {
            board[lastGame.moves[i].index] = lastGame.moves[i].player;
        }
        playIndex++;
        if (callbacks.onMove) callbacks.onMove(board, move.index, move);
        if (playIndex >= lastGame.moves.length) {
            if (callbacks.onEnd) callbacks.onEnd();
        }
    }

    function stepBackward() {
        if (!lastGame || playIndex === 0) return;
        playIndex--;
        const board = Game.emptyBoard();
        for (let i = 0; i < playIndex; i++) {
            board[lastGame.moves[i].index] = lastGame.moves[i].player;
        }
        const move = playIndex > 0 ? lastGame.moves[playIndex - 1] : null;
        if (callbacks.onMove) callbacks.onMove(board, -1, move);
    }

    function jumpTo(index) {
        if (!lastGame) return;
        playIndex = Math.max(0, Math.min(index, lastGame.moves.length));
        const board = Game.emptyBoard();
        for (let i = 0; i < playIndex; i++) {
            board[lastGame.moves[i].index] = lastGame.moves[i].player;
        }
        if (callbacks.onMove) callbacks.onMove(board, -1, null);
    }

    function play(intervalMs = 800) {
        if (!lastGame) return;
        if (playing) return;
        playing = true;
        // If at end, restart from beginning
        if (playIndex >= lastGame.moves.length) {
            jumpTo(0);
        }
        intervalId = setInterval(() => {
            if (playIndex >= lastGame.moves.length) {
                stopPlayback();
                if (callbacks.onEnd) callbacks.onEnd();
                return;
            }
            stepForward();
        }, intervalMs);
    }

    function pause() {
        stopPlayback();
    }

    function stopPlayback() {
        if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
        }
        playing = false;
    }

    function getState() {
        if (!lastGame) return null;
        return {
            index: playIndex,
            total: lastGame.moves.length,
            playing,
            gameInfo: {
                playerX: lastGame.playerNames.x,
                playerO: lastGame.playerNames.o,
                winner: lastGame.winner,
                mode: lastGame.mode,
                difficulty: lastGame.difficulty,
                date: lastGame.date,
            },
        };
    }

    return {
        load,
        hasReplay,
        getReplay,
        start,
        stepForward,
        stepBackward,
        jumpTo,
        play,
        pause,
        getState,
    };
})();
