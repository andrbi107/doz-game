/* ============================================
   APP.JS - Main application controller for Doz
   Wires together: UI, Game logic, AI, Audio, Storage
   ============================================ */

(function () {
    'use strict';

    /* ---------- State ---------- */
    const state = {
        mode: null,                // 'pvp' | 'ai'
        difficulty: 'easy',        // 'easy' | 'medium' | 'hard'
        aiPlayer: 'o',             // which mark the AI plays
        playerNames: { x: 'بازیکن ۱', o: 'بازیکن ۲' },
        winTarget: 1,              // games needed to win the series
        starter: 'random',         // 'x' | 'o' | 'random'

        // Per round
        board: Game.emptyBoard(),
        currentPlayer: 'x',
        moves: [],                 // [{ player, index, playerName }]
        history: [],               // same as moves but kept for series
        roundOver: false,

        // Series state
        seriesXScore: 0,
        seriesOScore: 0,
        seriesDraws: 0,
        roundNumber: 1,
        seriesStarter: 'x',        // who started the very first round
    };

    let settings = Storage.getSettings();
    let aiThinking = false;

    /* ---------- Init ---------- */
    function init() {
        // Apply persisted settings
        UI.applyTheme(settings.theme);
        UI.applyAccentColor(settings.accentColor);
        UI.applyAnimations(settings.animationsEnabled);
        UI.syncSettingsUI(settings);
        UI.setSoundButtonState(settings.soundEnabled);
        UI.setHintsButtonState(settings.hintsEnabled);
        Audio.setEnabled(settings.soundEnabled);
        Audio.setVolume(settings.volume / 100);

        // Theme auto-update listener
        if (settings.theme === 'auto') {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                UI.applyTheme('auto');
            });
        }

        // Bind all events
        bindEvents();

        // Show home
        UI.showScreen('home');

        // Render initial empty board (so cells have number labels)
        UI.renderBoard(state.board);

        // Listen for system theme changes (always)
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (Storage.getSettings().theme === 'auto') UI.applyTheme('auto');
        });
    }

    /* ---------- Event binding ---------- */
    function bindEvents() {
        // Use event delegation for [data-action] buttons
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            const action = target.dataset.action;
            handleAction(action, target, e);
        });

        // Cell clicks (board)
        UI.els.board.addEventListener('click', (e) => {
            const cell = e.target.closest('.cell');
            if (!cell) return;
            const index = parseInt(cell.dataset.index, 10);
            handleCellClick(index);
        });

        // Difficulty pills
        UI.els.difficultyPills.forEach(pill => {
            pill.addEventListener('click', (e) => {
                e.stopPropagation();
                const diff = pill.dataset.diff;
                UI.setSelectedDifficulty(diff);
                state.difficulty = diff;
                Audio.click();
            });
        });

        // Setup: win target / starter segmented controls
        bindSegmented(UI.els.winTargetControl, (value) => {
            state.winTarget = parseInt(value, 10);
            UI.setSelectedWinTarget(state.winTarget);
            Audio.click();
        });
        bindSegmented(UI.els.starterControl, (value) => {
            state.starter = value;
            Audio.click();
        });

        // Theme toggle (home)
        UI.els.themeToggle.addEventListener('click', () => {
            const cur = Storage.getSettings().theme;
            const next = cur === 'dark' ? 'light' : 'dark';
            settings = Storage.saveSettings({ theme: next });
            UI.applyTheme(next);
            UI.syncSettingsUI(settings);
            Audio.click();
        });

        // Settings: theme control
        bindSegmented(UI.els.themeControl, (value) => {
            settings = Storage.saveSettings({ theme: value });
            UI.applyTheme(value);
            UI.syncSettingsUI(settings);
            Audio.click();
        });

        // Settings: accent color
        UI.els.boardColorSwatches.addEventListener('click', (e) => {
            const sw = e.target.closest('.swatch');
            if (!sw) return;
            const color = sw.dataset.color;
            settings = Storage.saveSettings({ accentColor: color });
            UI.applyAccentColor(color);
            UI.syncSettingsUI(settings);
            Audio.click();
        });

        // Settings: sound toggle
        UI.els.soundEnabled.addEventListener('change', (e) => {
            settings = Storage.saveSettings({ soundEnabled: e.target.checked });
            Audio.setEnabled(e.target.checked);
            UI.setSoundButtonState(e.target.checked);
            if (e.target.checked) Audio.click();
        });

        // Settings: volume
        UI.els.volumeRange.addEventListener('input', (e) => {
            const vol = parseInt(e.target.value, 10);
            settings = Storage.saveSettings({ volume: vol });
            Audio.setVolume(vol / 100);
        });

        // Settings: animations
        UI.els.animationsEnabled.addEventListener('change', (e) => {
            settings = Storage.saveSettings({ animationsEnabled: e.target.checked });
            UI.applyAnimations(e.target.checked);
        });

        // Settings: haptics
        UI.els.hapticsEnabled.addEventListener('change', (e) => {
            settings = Storage.saveSettings({ hapticsEnabled: e.target.checked });
        });

        // Settings: hints
        UI.els.hintsEnabled.addEventListener('change', (e) => {
            settings = Storage.saveSettings({ hintsEnabled: e.target.checked });
            UI.setHintsButtonState(e.target.checked);
        });

        // History toggle (collapse)
        UI.els.historyToggle.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                UI.toggleHistoryPanel();
            });
        });
        // Also allow click on header
        const histHeader = UI.els.historyPanel.querySelector('.history-header');
        if (histHeader) {
            histHeader.addEventListener('click', () => UI.toggleHistoryPanel());
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboard);

        // First user gesture: unlock audio
        const unlock = () => {
            Audio.unlock();
            document.removeEventListener('click', unlock);
            document.removeEventListener('keydown', unlock);
        };
        document.addEventListener('click', unlock);
        document.addEventListener('keydown', unlock);
    }

    function bindSegmented(control, callback) {
        if (!control) return;
        control.addEventListener('click', (e) => {
            const btn = e.target.closest('.seg-btn');
            if (!btn) return;
            control.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            callback(btn.dataset.value);
        });
    }

    /* ---------- Action routing ---------- */
    function handleAction(action, target, e) {
        switch (action) {
            case 'go-home':       goHome(); break;
            case 'go-mode-select': UI.showScreen('modeSelect'); Audio.click(); break;
            case 'go-stats':      showStats(); break;
            case 'go-settings':   UI.showScreen('settings'); Audio.click(); break;
            case 'go-help':       UI.showScreen('help'); Audio.click(); break;

            case 'select-mode':   selectMode(target.dataset.mode); break;
            case 'start-game':    startMatch(); break;

            case 'restart-game':  restartRound(); break;
            case 'quit-game':     quitMatch(); break;
            case 'next-round':    nextRound(); break;
            case 'rematch':       rematch(); break;

            case 'undo-move':     undoMove(); break;
            case 'toggle-sound':  toggleSound(); break;
            case 'toggle-hints':  toggleHints(); break;

            case 'reset-stats':   resetStats(); break;
        }
    }

    /* ---------- Navigation ---------- */
    function goHome() {
        Audio.click();
        UI.hideRoundEnd();
        UI.hideMatchEnd();
        UI.showScreen('home');
    }

    /* ---------- Mode selection ---------- */
    function selectMode(mode) {
        Audio.click();
        // mode is 'pvp' | 'ai-easy' | 'tournament' | 'ai-...'
        if (mode === 'pvp') {
            state.mode = 'pvp';
            state.aiPlayer = null;
            UI.setAIPlayer2UI(false);
            UI.els.starterRow.style.display = 'flex';
        } else if (mode.startsWith('ai-')) {
            state.mode = 'ai';
            const diff = mode.replace('ai-', '');
            state.difficulty = diff;
            state.aiPlayer = 'o';
            UI.setAIPlayer2UI(true);
            UI.setSelectedDifficulty(diff);
            UI.els.starterRow.style.display = 'flex';
        } else if (mode === 'tournament') {
            UI.toast('به‌زودی! فعلاً از حالت‌های دیگر استفاده کنید.');
            return;
        }

        // Pre-fill player names with last-used values if any
        if (!UI.els.player1Name.value) UI.els.player1Name.value = 'بازیکن ۱';
        if (state.mode === 'pvp' && !UI.els.player2Name.value) {
            UI.els.player2Name.value = 'بازیکن ۲';
        }

        UI.showScreen('setup');
    }

    /* ---------- Match flow ---------- */
    function startMatch() {
        // Read player names
        const name1 = (UI.els.player1Name.value || 'بازیکن ۱').trim().slice(0, 20);
        let name2;
        if (state.mode === 'ai') {
            const diffLabel = { easy: 'آسان', medium: 'متوسط', hard: 'سخت' }[state.difficulty];
            name2 = `ربات (${diffLabel})`;
        } else {
            name2 = (UI.els.player2Name.value || 'بازیکن ۲').trim().slice(0, 20);
        }
        state.playerNames = { x: name1, o: name2 };

        // Read series options
        state.winTarget = UI.getSelectedWinTarget();
        state.starter = UI.getSelectedStarter();

        // Reset series state
        state.seriesXScore = 0;
        state.seriesOScore = 0;
        state.seriesDraws = 0;
        state.roundNumber = 1;

        // Determine who starts
        state.seriesStarter = pickStarter(state.starter);
        state.currentPlayer = state.seriesStarter;

        // Build match title
        let title = `${name1} در برابر ${name2}`;
        if (state.winTarget > 1) title += ` · بهترین از ${state.winTarget}`;
        UI.setMatchTitle(title);

        // Update UI
        UI.updatePlayerNames(name1, name2);
        UI.updateScore(0, 0, 0, 1);

        // Start fresh round
        newRound(state.currentPlayer);

        UI.showScreen('game');
        Audio.startGame();

        // If AI starts, schedule its move
        if (state.mode === 'ai' && state.currentPlayer === state.aiPlayer) {
            scheduleAIMove();
        }
    }

    function pickStarter(pref) {
        if (pref === 'x') return 'x';
        if (pref === 'o') return 'o';
        return Math.random() < 0.5 ? 'x' : 'o';
    }

    function newRound(starter) {
        state.board = Game.emptyBoard();
        state.moves = [];
        state.roundOver = false;
        state.currentPlayer = starter;

        UI.clearWinningLine();
        UI.clearHints();
        UI.renderBoard(state.board);
        UI.setBoardDisabled(false);
        UI.updateScore(state.seriesXScore, state.seriesOScore, state.seriesDraws, state.roundNumber);
        UI.setActivePlayer(starter);
        UI.setTurnText(`نوبت: <strong>${escapeHtml(state.playerNames[starter])}</strong>`);
        UI.renderHistory([]);
        UI.setUndoEnabled(false);
    }

    function restartRound() {
        if (aiThinking) return;
        Audio.click();
        // Restart current round with the same starter as before
        newRound(state.seriesStarter);
        if (state.mode === 'ai' && state.currentPlayer === state.aiPlayer) {
            scheduleAIMove();
        }
    }

    function nextRound() {
        Audio.click();
        UI.hideRoundEnd();
        // Alternate starter each round for fairness, unless win target is 1
        let nextStarter;
        if (state.winTarget > 1) {
            nextStarter = state.seriesStarter === 'x' ? 'o' : 'x';
            state.seriesStarter = nextStarter;
        } else {
            nextStarter = state.seriesStarter;
        }
        state.roundNumber += 1;
        newRound(nextStarter);
        if (state.mode === 'ai' && state.currentPlayer === state.aiPlayer) {
            scheduleAIMove();
        }
    }

    function rematch() {
        Audio.click();
        UI.hideMatchEnd();
        state.seriesXScore = 0;
        state.seriesOScore = 0;
        state.seriesDraws = 0;
        state.roundNumber = 1;
        state.seriesStarter = pickStarter(state.starter);
        newRound(state.seriesStarter);
        if (state.mode === 'ai' && state.currentPlayer === state.aiPlayer) {
            scheduleAIMove();
        }
    }

    function quitMatch() {
        Audio.click();
        UI.hideRoundEnd();
        UI.hideMatchEnd();
        UI.showScreen('home');
    }

    /* ---------- Cell click (player move) ---------- */
    function handleCellClick(index) {
        if (state.roundOver) return;
        if (aiThinking) return;
        // Don't allow human to move on AI's turn
        if (state.mode === 'ai' && state.currentPlayer === state.aiPlayer) return;
        // Validate
        if (state.board[index] !== null) {
            Audio.invalid();
            UI.shake(UI.els.cells[index]);
            UI.vibrate(20);
            return;
        }
        makeMove(index, state.currentPlayer);
    }

    function makeMove(index, player) {
        const next = Game.applyMove(state.board, index, player);
        if (!next) return;

        state.board = next;
        state.moves.push({
            player,
            index,
            playerName: state.playerNames[player],
        });

        // Audio + haptics
        Audio.placeMark(player);
        UI.vibrate(player === 'x' ? 20 : 30);

        // Render
        UI.renderBoard(state.board, index);
        UI.renderHistory(state.moves);
        UI.setUndoEnabled(state.moves.length > 0 && !isAIsTurn(player));

        // Check game over
        const result = Game.checkWinner(state.board);
        if (result.winner) {
            finishRound(result);
            return;
        }
        if (Game.isFull(state.board)) {
            finishRound({ winner: null, line: null });
            return;
        }

        // Next player
        state.currentPlayer = state.currentPlayer === 'x' ? 'o' : 'x';
        UI.setActivePlayer(state.currentPlayer);
        UI.setTurnText(`نوبت: <strong>${escapeHtml(state.playerNames[state.currentPlayer])}</strong>`);

        // AI turn?
        if (state.mode === 'ai' && state.currentPlayer === state.aiPlayer) {
            scheduleAIMove();
        } else if (Storage.getSettings().hintsEnabled && state.mode !== 'ai') {
            // Show subtle hint when enabled
            // (do nothing automatically; user toggles via button)
        }
    }

    function isAIsTurn(justPlayed) {
        return state.mode === 'ai' && justPlayed !== state.aiPlayer;
    }

    /* ---------- AI scheduling ---------- */
    function scheduleAIMove() {
        if (state.roundOver) return;
        aiThinking = true;
        UI.setBoardDisabled(true);
        UI.setTurnText(`<strong>${escapeHtml(state.playerNames[state.aiPlayer])}</strong> در حال فکر کردن…`);

        // Slight delay for realism
        const delay = state.difficulty === 'easy' ? 400 : (state.difficulty === 'medium' ? 600 : 500);
        setTimeout(() => {
            try {
                const move = AI.chooseMove(state.board, state.aiPlayer, state.difficulty);
                aiThinking = false;
                UI.setBoardDisabled(false);
                if (move >= 0) {
                    makeMove(move, state.aiPlayer);
                }
            } catch (err) {
                console.error('AI error', err);
                aiThinking = false;
                UI.setBoardDisabled(false);
            }
        }, delay + Math.random() * 200);
    }

    /* ---------- Round end ---------- */
    function finishRound(result) {
        state.roundOver = true;
        UI.setBoardDisabled(true);
        UI.setUndoEnabled(false);

        const winner = result.winner;
        const loser = winner === 'x' ? 'o' : 'x';

        let titleText, subtitleText, iconText, statsHtml = '';

        if (winner) {
            const winnerName = state.playerNames[winner];
            const loserName = state.playerNames[loser];
            UI.highlightWinning(result.line, winner);
            titleText = 'پیروزی!';
            subtitleText = `${winnerName} برنده شد`;
            iconText = '🎉';

            // Update series score
            if (winner === 'x') state.seriesXScore += 1;
            else state.seriesOScore += 1;

            statsHtml = `
                <div class="stat-row"><span>${escapeHtml(state.playerNames.x)}</span><strong>${state.seriesXScore}</strong></div>
                <div class="stat-row"><span>${escapeHtml(state.playerNames.o)}</span><strong>${state.seriesOScore}</strong></div>
                <div class="stat-row"><span>تعداد حرکات</span><strong>${state.moves.length}</strong></div>
            `;

            // Record stats (only when human plays)
            const humanPlayer = state.mode === 'ai' ? (state.aiPlayer === 'x' ? 'o' : 'x') : null;
            if (state.mode === 'ai') {
                const humanWon = winner === humanPlayer;
                const humanName = state.playerNames[humanPlayer];
                Storage.recordGame(humanWon ? 'win' : 'loss', humanName, true);
            } else {
                // For PvP, record from the perspective of the winner as a "win"
                Storage.recordGame('win', winnerName, true);
                Storage.recordGame('loss', loserName, true);
            }

            // Sound
            if (state.mode === 'ai') {
                const humanWon = winner === humanPlayer;
                if (humanWon) Audio.win();
                else Audio.lose();
            } else {
                Audio.win();
            }
            UI.vibrate([30, 40, 30]);

        } else {
            // Draw
            state.seriesDraws += 1;
            titleText = 'مساوی!';
            subtitleText = 'هیچ‌کس برنده نشد';
            iconText = '🤝';

            statsHtml = `
                <div class="stat-row"><span>${escapeHtml(state.playerNames.x)}</span><strong>${state.seriesXScore}</strong></div>
                <div class="stat-row"><span>${escapeHtml(state.playerNames.o)}</span><strong>${state.seriesOScore}</strong></div>
                <div class="stat-row"><span>مساوی</span><strong>${state.seriesDraws}</strong></div>
            `;

            if (state.mode === 'ai') {
                const humanPlayer = state.aiPlayer === 'x' ? 'o' : 'x';
                Storage.recordGame('draw', state.playerNames[humanPlayer], true);
            } else {
                Storage.recordGame('draw', state.playerNames.x, true);
            }
            Audio.draw();
            UI.vibrate(60);
        }

        // Update score bar
        UI.updateScore(state.seriesXScore, state.seriesOScore, state.seriesDraws, state.roundNumber);

        // Check series end
        const seriesWinner = checkSeriesEnd();
        if (seriesWinner) {
            // Show match-end modal after a short delay
            setTimeout(() => {
                showSeriesEnd(seriesWinner);
            }, 1400);
        } else {
            // Show round-end modal
            setTimeout(() => {
                UI.showRoundEnd({
                    icon: iconText,
                    title: titleText,
                    subtitle: subtitleText,
                    stats: statsHtml,
                });
            }, 900);
        }
    }

    function checkSeriesEnd() {
        if (state.winTarget <= 1) {
            // Single round = series ends after the round
            if (state.seriesXScore > state.seriesOScore) return 'x';
            if (state.seriesOScore > state.seriesXScore) return 'o';
            return 'draw';
        }
        if (state.seriesXScore >= state.winTarget) return 'x';
        if (state.seriesOScore >= state.winTarget) return 'o';
        return null;
    }

    function showSeriesEnd(seriesWinner) {
        let title, subtitle;
        if (seriesWinner === 'draw') {
            title = 'مساوی شد!';
            subtitle = 'بازی به تساوی رسید';
        } else {
            const winnerName = state.playerNames[seriesWinner];
            title = 'قهرمان!';
            subtitle = `${winnerName} قهرمان شد`;
        }

        const statsHtml = `
            <div class="stat-row"><span>${escapeHtml(state.playerNames.x)}</span><strong>${state.seriesXScore} برد</strong></div>
            <div class="stat-row"><span>${escapeHtml(state.playerNames.o)}</span><strong>${state.seriesOScore} برد</strong></div>
            <div class="stat-row"><span>مساوی</span><strong>${state.seriesDraws}</strong></div>
            <div class="stat-row"><span>تعداد دور</span><strong>${state.roundNumber}</strong></div>
        `;

        UI.showMatchEnd({ title, subtitle, stats: statsHtml });
        Audio.matchWin();
        UI.vibrate([50, 80, 50, 80, 100]);

        // Also update stats screen if user navigates there later
    }

    /* ---------- Undo ---------- */
    function undoMove() {
        if (aiThinking) return;
        if (state.roundOver) return;
        if (state.moves.length === 0) return;

        // In AI mode, undo both the AI's move and the human's move
        if (state.mode === 'ai') {
            // If it's currently AI's turn, that means human just played; undo 1
            // If it's human's turn, that means AI just played; undo 2 (AI + human)
            if (state.currentPlayer !== state.aiPlayer) {
                // human's turn, AI just moved - undo both
                state.moves.pop();
                if (state.moves.length > 0) state.moves.pop();
            } else {
                // AI's turn, human just moved - undo just human
                state.moves.pop();
            }
        } else {
            state.moves.pop();
        }

        // Rebuild board from moves
        state.board = Game.emptyBoard();
        state.moves.forEach(m => { state.board[m.index] = m.player; });

        state.currentPlayer = Game.nextPlayer(state.board);
        UI.renderBoard(state.board);
        UI.renderHistory(state.moves);
        UI.setActivePlayer(state.currentPlayer);
        UI.setTurnText(`نوبت: <strong>${escapeHtml(state.playerNames[state.currentPlayer])}</strong>`);
        UI.setUndoEnabled(state.moves.length > 0);
        Audio.click();
        UI.toast('حرکت برگشت داده شد');
    }

    /* ---------- Toggles ---------- */
    function toggleSound() {
        const next = !Storage.getSettings().soundEnabled;
        settings = Storage.saveSettings({ soundEnabled: next });
        Audio.setEnabled(next);
        UI.setSoundButtonState(next);
        UI.els.soundEnabled.checked = next;
        UI.syncSettingsUI(settings);
        if (next) Audio.click();
        UI.toast(next ? 'صدا روشن' : 'صدا خاموش');
    }

    function toggleHints() {
        const next = !Storage.getSettings().hintsEnabled;
        settings = Storage.saveSettings({ hintsEnabled: next });
        UI.setHintsButtonState(next);
        UI.els.hintsEnabled.checked = next;
        UI.syncSettingsUI(settings);
        Audio.click();
        UI.toast(next ? 'راهنما فعال شد' : 'راهنما غیرفعال شد');

        if (next && !state.roundOver && !aiThinking) {
            const hint = AI.getHint(state.board, state.currentPlayer);
            if (hint >= 0) UI.showHint(hint);
        }
    }

    /* ---------- Stats screen ---------- */
    function showStats() {
        const stats = Storage.getStats();
        const board = Storage.getLeaderboard();
        UI.renderStats(stats, board);
        UI.showScreen('stats');
        Audio.click();
    }

    function resetStats() {
        if (!confirm('آیا از پاک کردن تمام آمار مطمئن هستید؟ این عمل قابل بازگشت نیست.')) return;
        Storage.resetStats();
        UI.renderStats(Storage.getStats(), Storage.getLeaderboard());
        UI.toast('آمار پاک شد');
        Audio.click();
    }

    /* ---------- Keyboard ---------- */
    function handleKeyboard(e) {
        // Only when on game screen
        const onGameScreen = UI.screens.game.classList.contains('active');
        if (!onGameScreen) {
            if (e.key === 'Escape' && !UI.screens.home.classList.contains('active')) {
                goHome();
            }
            return;
        }

        // Number keys 1-9 -> numpad-style cell
        if (e.key >= '1' && e.key <= '9') {
            const idx = Game.labelToIndex(parseInt(e.key, 10));
            if (idx !== undefined) handleCellClick(idx);
            return;
        }

        // Numpad 1-9
        if (e.code.startsWith('Numpad')) {
            const num = parseInt(e.code.replace('Numpad', ''), 10);
            if (num >= 1 && num <= 9) {
                const idx = Game.labelToIndex(num);
                if (idx !== undefined) handleCellClick(idx);
            }
            return;
        }

        switch (e.key.toLowerCase()) {
            case 'u':
                undoMove();
                break;
            case 'r':
                restartRound();
                break;
            case 'escape':
                quitMatch();
                break;
            case 'h':
                if (!state.roundOver) {
                    const hint = AI.getHint(state.board, state.currentPlayer);
                    if (hint >= 0) {
                        UI.showHint(hint);
                        Audio.click();
                    }
                }
                break;
        }
    }

    /* ---------- Helpers ---------- */
    function escapeHtml(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /* ---------- Boot ---------- */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
