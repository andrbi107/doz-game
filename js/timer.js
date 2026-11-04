/* ============================================
   TIMER.JS - Per-turn move timer (chess clock)
   Optional feature: counts down per turn.
   ============================================ */

const MoveTimer = (function () {
    'use strict';

    let intervalId = null;
    let endTime = 0;
    let duration = 15;
    let onTick = null;
    let onExpire = null;
    let paused = false;
    let remainingAtPause = 0;

    function start(seconds, callbacks = {}) {
        stop();
        duration = seconds;
        endTime = Date.now() + seconds * 1000;
        onTick = callbacks.onTick || null;
        onExpire = callbacks.onExpire || null;
        paused = false;
        intervalId = setInterval(tick, 100);
        tick(); // immediate first tick
    }

    function tick() {
        if (paused) return;
        const remaining = Math.max(0, endTime - Date.now());
        const secs = Math.ceil(remaining / 1000);
        if (onTick) onTick(secs, remaining / (duration * 1000));
        if (remaining <= 0) {
            stop();
            if (onExpire) onExpire();
        }
    }

    function stop() {
        if (intervalId !== null) {
            clearInterval(intervalId);
            intervalId = null;
        }
        onTick = null;
        onExpire = null;
        paused = false;
    }

    function pause() {
        if (paused || intervalId === null) return;
        paused = true;
        remainingAtPause = Math.max(0, endTime - Date.now());
    }

    function resume() {
        if (!paused) return;
        paused = false;
        endTime = Date.now() + remainingAtPause;
    }

    function isRunning() {
        return intervalId !== null && !paused;
    }

    function getRemaining() {
        if (paused) return Math.ceil(remainingAtPause / 1000);
        return Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
    }

    return { start, stop, pause, resume, isRunning, getRemaining };
})();
