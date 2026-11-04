/* ============================================
   APP.JS - Main application controller for Doz v2
   Wires together: UI, Game logic, AI, Audio, Storage,
                  Achievements, Timer, Replay, Charts, PWA
   ============================================ */

(function () {
    'use strict';

    /* ---------- State ---------- */
    const state = {
        mode: null,
        difficulty: 'easy',
        aiPlayer: 'o',
        playerNames: { x: 'بازیکن ۱', o: 'بازیکن ۲' },
        avatars: { x: '⭐', o: '🌙' },
        winTarget: 1,
        starter: 'random',
        moveTimerSeconds: 0,

        board: Game.emptyBoard(),
        currentPlayer: 'x',
        moves: [],
        roundOver: false,

        seriesXScore: 0,
        seriesOScore: 0,
        seriesDraws: 0,
        roundNumber: 1,
        seriesStarter: 'x',
    };

    let settings = Storage.getSettings();
    let aiThinking = false;
    let deferredInstallPrompt = null;

    // Available avatar emojis
    const AVATAR_OPTIONS = [
        '⭐', '🌙', '😎', '🤖', '👾', '🦊',
        '🐱', '🐶', '🦁', '🐯', '🐼', '🐨',
        '🦄', '🐲', '🦅', '🦈', '🐙', '🦋',
        '🌸', '🌻', '🍎', '🍓', '🍕', '🌮',
        '⚽', '🏀', '🎮', '🎯', '🏆', '💎',
        '🔥', '⚡', '🌈', '❄️', '☀️', '🌙',
    ];

    /* ---------- Init ---------- */
    function init() {
        // Apply persisted settings
        UI.applyTheme(settings.theme);
        UI.applyAccentColor(settings.accentColor);
        UI.applyAnimations(settings.animationsEnabled);
        UI.applyColorBlindMode(settings.colorBlindMode);
        UI.syncSettingsUI(settings);
        UI.setSoundButtonState(settings.soundEnabled);
        UI.setHintsButtonState(settings.hintsEnabled);
        Audio.setEnabled(settings.soundEnabled);
        Audio.setVolume(settings.volume / 100);

        // Load avatars
        const avs = Storage.getAvatars();
        state.avatars = avs;
        UI.updateAvatars(avs.x, avs.o);

        // Theme auto-update listener
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (Storage.getSettings().theme === 'auto') UI.applyTheme('auto');
        });

        // Bind events
        bindEvents();

        // Show home
        UI.showScreen('home');
        UI.renderBoard(state.board);

        // Register service worker for PWA
        registerServiceWorker();

        // Listen for install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredInstallPrompt = e;
            // Show banner after a delay if user hasn't dismissed
            if (!sessionStorage.getItem('installDismissed')) {
                setTimeout(() => {
                    if (deferredInstallPrompt) {
                        UI.showInstallBanner(handleInstall, () => {
                            sessionStorage.setItem('installDismissed', '1');
                        });
                    }
                }, 8000);
            }
        });

        // Hook achievements
        Achievements.setSoundHook(() => Audio.achievement());
        Achievements.setToastHook((a) => UI.achievementToast(a));

        // Update achievement badge on home
        updateAchievementBadge();

        // Enable replay button if there's a saved game
        if (Replay.hasReplay()) {
            UI.setReplayMenuEnabled(true);
        }

        // Handle URL action (PWA shortcuts)
        handleUrlAction();

        // Onboarding
        if (!Storage.hasOnboarded()) {
            setTimeout(() => UI.showOnboarding(), 600);
        }

        // Resume game state if exists
        const saved = Storage.getGameState();
        if (saved && saved.moves && saved.moves.length > 0 && !saved.roundOver) {
            setTimeout(() => UI.showResumeModal(), 1000);
        }
    }

    function handleUrlAction() {
        const params = new URLSearchParams(window.location.search);
        const action = params.get('action');
        if (!action) return;
        // Remove from URL
        window.history.replaceState({}, '', window.location.pathname);
        switch (action) {
            case 'quick-ai':
                setTimeout(() => {
                    selectMode('ai-easy');
                    setTimeout(() => startMatch(), 400);
                }, 300);
                break;
            case 'quick-pvp':
                setTimeout(() => {
                    selectMode('pvp');
                    setTimeout(() => startMatch(), 400);
                }, 300);
                break;
            case 'stats':
                setTimeout(() => showStats(), 300);
                break;
        }
    }

    function registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            // Use relative path so it works on GitHub Pages subdirectory
            const swPath = './sw.js';
            navigator.serviceWorker.register(swPath)
                .then(reg => {
                    console.log('SW registered:', reg.scope);
                })
                .catch(err => {
                    console.warn('SW registration failed:', err);
                });
        }
    }

    function handleInstall() {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.then(choice => {
            if (choice.outcome === 'accepted') {
                UI.toast('بازی نصب شد! 🎉');
            }
            deferredInstallPrompt = null;
            const banner = document.querySelector('.install-banner');
            if (banner) banner.remove();
        });
    }

    /* ---------- Event binding ---------- */
    function bindEvents() {
        // Action delegation
        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            handleAction(target.dataset.action, target, e);
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

        // Setup controls
        bindSegmented(UI.els.winTargetControl, (value) => {
            state.winTarget = parseInt(value, 10);
            UI.setSelectedWinTarget(state.winTarget);
            Audio.click();
        });
        bindSegmented(UI.els.starterControl, (value) => {
            state.starter = value;
            Audio.click();
        });
        bindSegmented(UI.els.timerControl, (value) => {
            state.moveTimerSeconds = parseInt(value, 10);
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

        // Avatar picker
        UI.els.avatarXBtn.addEventListener('click', () => {
            Audio.click();
            UI.showAvatarPicker('انتخاب آواتار X', state.avatars.x, AVATAR_OPTIONS, (emoji) => {
                state.avatars.x = emoji;
                Storage.saveAvatars({ x: emoji });
                UI.updateAvatars(emoji, state.avatars.o);
                setTimeout(() => UI.hideAvatarPicker(), 200);
            });
        });
        UI.els.avatarOBtn.addEventListener('click', () => {
            Audio.click();
            UI.showAvatarPicker('انتخاب آواتار O', state.avatars.o, AVATAR_OPTIONS, (emoji) => {
                state.avatars.o = emoji;
                Storage.saveAvatars({ o: emoji });
                UI.updateAvatars(state.avatars.x, emoji);
                setTimeout(() => UI.hideAvatarPicker(), 200);
            });
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

        // Settings: color blind
        UI.els.colorBlindMode.addEventListener('change', (e) => {
            settings = Storage.saveSettings({ colorBlindMode: e.target.checked });
            UI.applyColorBlindMode(e.target.checked);
            Audio.click();
        });

        // Settings: high contrast
        UI.els.highContrastMode.addEventListener('change', (e) => {
            UI.applyHighContrast(e.target.checked);
            Audio.click();
        });

        // History toggle
        UI.els.historyToggle.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                UI.toggleHistoryPanel();
            });
        });
        const histHeader = UI.els.historyPanel.querySelector('.history-header');
        if (histHeader) {
            histHeader.addEventListener('click', () => UI.toggleHistoryPanel());
        }

        // Import file change
        if (UI.els.importFile) {
            UI.els.importFile.addEventListener('change', handleImportFile);
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

        // Save state on page hide (for auto-resume)
        window.addEventListener('beforeunload', saveCurrentGameState);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') saveCurrentGameState();
        });
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
            case 'go-achievements': showAchievements(); break;
            case 'go-replay':     showReplay(); break;

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
            case 'export-data':   exportData(); break;
            case 'import-data':   UI.els.importFile.click(); break;

            case 'close-avatar-picker': UI.hideAvatarPicker(); break;

            case 'next-onboarding': handleOnboardingNext(); break;
            case 'skip-onboarding': finishOnboarding(); break;

            case 'resume-game':    resumeGame(); break;
            case 'discard-resume': discardResume(); break;

            case 'replay-prev': Replay.stepBackward(); updateReplayUI(); break;
            case 'replay-next': Replay.stepForward(); updateReplayUI(); break;
            case 'replay-play': toggleReplayPlay(); break;
        }
    }

    /* ---------- Navigation ---------- */
    function goHome() {
        Audio.click();
        UI.hideRoundEnd();
        UI.hideMatchEnd();
        // Stop timer
        MoveTimer.stop();
        UI.showTimer(false);
        UI.showScreen('home');
        updateAchievementBadge();
        if (Replay.hasReplay()) UI.setReplayMenuEnabled(true);
    }

    /* ---------- Mode selection ---------- */
    function selectMode(mode) {
        Audio.click();
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

        // Try to restore last setup
        const lastSetup = settings.lastSetup;
        if (lastSetup) {
            if (lastSetup.player1Name) UI.els.player1Name.value = lastSetup.player1Name;
            if (lastSetup.player2Name && state.mode === 'pvp') UI.els.player2Name.value = lastSetup.player2Name;
            if (lastSetup.winTarget) {
                state.winTarget = lastSetup.winTarget;
                UI.setSelectedWinTarget(lastSetup.winTarget);
            }
            if (lastSetup.starter) {
                state.starter = lastSetup.starter;
                UI.setSelectedStarter(lastSetup.starter);
            }
            if (lastSetup.moveTimerSeconds !== undefined) {
                state.moveTimerSeconds = lastSetup.moveTimerSeconds;
                UI.setSelectedTimer(lastSetup.moveTimerSeconds);
            }
        } else {
            if (!UI.els.player1Name.value) UI.els.player1Name.value = 'بازیکن ۱';
            if (state.mode === 'pvp' && !UI.els.player2Name.value) {
                UI.els.player2Name.value = 'بازیکن ۲';
            }
        }

        UI.showScreen('setup');
    }

    /* ---------- Match flow ---------- */
    function startMatch() {
        const name1 = (UI.els.player1Name.value || 'بازیکن ۱').trim().slice(0, 20);
        let name2;
        if (state.mode === 'ai') {
            const diffLabel = { easy: 'آسان', medium: 'متوسط', hard: 'سخت' }[state.difficulty];
            name2 = `ربات (${diffLabel})`;
        } else {
            name2 = (UI.els.player2Name.value || 'بازیکن ۲').trim().slice(0, 20);
        }
        state.playerNames = { x: name1, o: name2 };

        state.winTarget = UI.getSelectedWinTarget();
        state.starter = UI.getSelectedStarter();
        state.moveTimerSeconds = UI.getSelectedTimer();

        // Save last setup for quick replay
        settings = Storage.saveSettings({
            lastSetup: {
                mode: state.mode,
                difficulty: state.difficulty,
                player1Name: name1,
                player2Name: state.mode === 'pvp' ? name2 : '',
                winTarget: state.winTarget,
                starter: state.starter,
                moveTimerSeconds: state.moveTimerSeconds,
            }
        });

        // Reset series state
        state.seriesXScore = 0;
        state.seriesOScore = 0;
        state.seriesDraws = 0;
        state.roundNumber = 1;

        state.seriesStarter = pickStarter(state.starter);
        state.currentPlayer = state.seriesStarter;

        let title = `${name1} در برابر ${name2}`;
        if (state.winTarget > 1) title += ` · بهترین از ${state.winTarget}`;
        UI.setMatchTitle(title);

        UI.updatePlayerNames(name1, name2);
        UI.updateAvatars(state.avatars.x, state.avatars.o);
        UI.updateScore(0, 0, 0, 1);

        newRound(state.currentPlayer);

        UI.showScreen('game');
        Audio.startGame();

        // Setup timer visibility
        UI.showTimer(state.moveTimerSeconds > 0);

        if (state.mode === 'ai' && state.currentPlayer === state.aiPlayer) {
            scheduleAIMove();
        } else {
            startMoveTimerIfNeeded();
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

        // Restart timer
        MoveTimer.stop();
        if (state.moveTimerSeconds > 0 && !isAITurn(state.currentPlayer)) {
            startMoveTimerIfNeeded();
        }
    }

    function startMoveTimerIfNeeded() {
        if (state.moveTimerSeconds <= 0) return;
        if (state.roundOver) return;
        if (state.mode === 'ai' && isAITurn(state.currentPlayer)) return;

        MoveTimer.start(state.moveTimerSeconds, {
            onTick: (secs, fraction) => {
                UI.updateTimer(secs, fraction);
                if (secs <= 3 && secs > 0) {
                    Audio.timerWarn();
                }
            },
            onExpire: () => {
                Audio.timerExpire();
                UI.vibrate([50, 50, 50]);
                // Auto-play a random valid move for the human
                const empties = Game.getEmptyCells(state.board);
                if (empties.length > 0) {
                    const randomMove = empties[Math.floor(Math.random() * empties.length)];
                    UI.toast('زمان تمام شد! حرکت تصادفی');
                    makeMove(randomMove, state.currentPlayer);
                }
            }
        });
    }

    function restartRound() {
        if (aiThinking) return;
        Audio.click();
        MoveTimer.stop();
        newRound(state.seriesStarter);
        if (state.mode === 'ai' && state.currentPlayer === state.aiPlayer) {
            scheduleAIMove();
        } else {
            startMoveTimerIfNeeded();
        }
    }

    function nextRound() {
        Audio.click();
        UI.hideRoundEnd();
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
        } else {
            startMoveTimerIfNeeded();
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
        } else {
            startMoveTimerIfNeeded();
        }
    }

    function quitMatch() {
        Audio.click();
        UI.hideRoundEnd();
        UI.hideMatchEnd();
        MoveTimer.stop();
        UI.showTimer(false);
        Storage.clearGameState();
        UI.showScreen('home');
    }

    /* ---------- Cell click (player move) ---------- */
    function handleCellClick(index) {
        if (state.roundOver) return;
        if (aiThinking) return;
        if (state.mode === 'ai' && state.currentPlayer === state.aiPlayer) return;
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

        Audio.placeMark(player);
        UI.vibrate(player === 'x' ? 20 : 30);

        UI.renderBoard(state.board, index);
        UI.renderHistory(state.moves);
        UI.setUndoEnabled(state.moves.length > 0 && !isAITurn(player));

        // Save state for resume
        saveCurrentGameState();

        const result = Game.checkWinner(state.board);
        if (result.winner) {
            finishRound(result);
            return;
        }
        if (Game.isFull(state.board)) {
            finishRound({ winner: null, line: null });
            return;
        }

        // Stop timer for current player
        MoveTimer.stop();

        state.currentPlayer = state.currentPlayer === 'x' ? 'o' : 'x';
        UI.setActivePlayer(state.currentPlayer);
        UI.setTurnText(`نوبت: <strong>${escapeHtml(state.playerNames[state.currentPlayer])}</strong>`);

        if (state.mode === 'ai' && state.currentPlayer === state.aiPlayer) {
            scheduleAIMove();
        } else {
            startMoveTimerIfNeeded();
        }
    }

    function isAITurn(justPlayed) {
        return state.mode === 'ai' && justPlayed !== state.aiPlayer;
    }

    function isAICurrent() {
        return state.mode === 'ai' && state.currentPlayer === state.aiPlayer;
    }

    /* ---------- AI scheduling ---------- */
    function scheduleAIMove() {
        if (state.roundOver) return;
        aiThinking = true;
        UI.setBoardDisabled(true);
        UI.setTurnText(`<strong>${escapeHtml(state.playerNames[state.aiPlayer])}</strong> در حال فکر کردن…`);

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
        MoveTimer.stop();
        UI.showTimer(false);

        const winner = result.winner;
        const loser = winner === 'x' ? 'o' : 'x';

        let titleText, subtitleText, iconText, statsHtml = '';

        // Save replay data
        const replayData = {
            moves: state.moves.slice(),
            playerNames: { ...state.playerNames },
            avatars: { ...state.avatars },
            winner,
            mode: state.mode,
            difficulty: state.difficulty,
            winTarget: state.winTarget,
            date: Date.now(),
        };
        Storage.saveLastGame(replayData);
        UI.setReplayMenuEnabled(true);

        if (winner) {
            const winnerName = state.playerNames[winner];
            const loserName = state.playerNames[loser];
            UI.highlightWinning(result.line, winner);
            titleText = 'پیروزی!';
            subtitleText = `${winnerName} برنده شد`;
            iconText = '🎉';

            if (winner === 'x') state.seriesXScore += 1;
            else state.seriesOScore += 1;

            statsHtml = `
                <div class="stat-row"><span>${escapeHtml(state.playerNames.x)}</span><strong>${state.seriesXScore}</strong></div>
                <div class="stat-row"><span>${escapeHtml(state.playerNames.o)}</span><strong>${state.seriesOScore}</strong></div>
                <div class="stat-row"><span>تعداد حرکات</span><strong>${state.moves.length}</strong></div>
            `;

            // Record stats
            if (state.mode === 'ai') {
                const humanPlayer = state.aiPlayer === 'x' ? 'o' : 'x';
                const humanWon = winner === humanPlayer;
                const humanName = state.playerNames[humanPlayer];
                Storage.recordGame(humanWon ? 'win' : 'loss', humanName, {
                    mode: 'ai',
                    difficulty: state.difficulty,
                    moves: state.moves.length,
                });
                if (humanWon) Audio.win();
                else Audio.lose();
            } else {
                Storage.recordGame('win', winnerName, { mode: 'pvp', moves: state.moves.length });
                Storage.recordGame('loss', loserName, { mode: 'pvp', moves: state.moves.length });
                Audio.win();
            }
            UI.vibrate([30, 40, 30]);
        } else {
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
                Storage.recordGame('draw', state.playerNames[humanPlayer], {
                    mode: 'ai',
                    difficulty: state.difficulty,
                    moves: state.moves.length,
                });
            } else {
                Storage.recordGame('draw', state.playerNames.x, { mode: 'pvp', moves: state.moves.length });
            }
            Audio.draw();
            UI.vibrate(60);
        }

        UI.updateScore(state.seriesXScore, state.seriesOScore, state.seriesDraws, state.roundNumber);

        // Check achievements
        const finalStats = Storage.getStats();
        Achievements.checkAll(finalStats, {
            mode: state.mode,
            difficulty: state.difficulty,
            moves: state.moves.length,
            winner,
        });
        updateAchievementBadge();

        // Clear saved game state
        Storage.clearGameState();

        // Check series end
        const seriesWinner = checkSeriesEnd();
        if (seriesWinner) {
            setTimeout(() => showSeriesEnd(seriesWinner), 1400);
        } else {
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
    }

    /* ---------- Undo ---------- */
    function undoMove() {
        if (aiThinking) return;
        if (state.roundOver) return;
        if (state.moves.length === 0) return;

        if (state.mode === 'ai') {
            if (state.currentPlayer !== state.aiPlayer) {
                state.moves.pop();
                if (state.moves.length > 0) state.moves.pop();
            } else {
                state.moves.pop();
            }
        } else {
            state.moves.pop();
        }

        state.board = Game.emptyBoard();
        state.moves.forEach(m => { state.board[m.index] = m.player; });

        // Determine current player: the one who didn't play the last remaining move
        // (or the series starter if board is now empty)
        if (state.moves.length === 0) {
            state.currentPlayer = state.seriesStarter;
        } else {
            const lastMove = state.moves[state.moves.length - 1];
            state.currentPlayer = lastMove.player === 'x' ? 'o' : 'x';
        }
        UI.renderBoard(state.board);
        UI.renderHistory(state.moves);
        UI.setActivePlayer(state.currentPlayer);
        UI.setTurnText(`نوبت: <strong>${escapeHtml(state.playerNames[state.currentPlayer])}</strong>`);
        UI.setUndoEnabled(state.moves.length > 0);
        Audio.click();
        UI.toast('حرکت برگشت داده شد');

        saveCurrentGameState();
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

        if (next && !state.roundOver && !aiThinking && !isAICurrent()) {
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
        // Re-draw charts after layout settles
        setTimeout(() => {
            UI.renderStats(stats, board);
        }, 100);
    }

    function resetStats() {
        if (!confirm('آیا از پاک کردن تمام آمار مطمئن هستید؟ این عمل قابل بازگشت نیست.')) return;
        Storage.resetStats();
        Storage.resetAchievements();
        UI.renderStats(Storage.getStats(), Storage.getLeaderboard());
        UI.toast('آمار پاک شد');
        Audio.click();
        updateAchievementBadge();
    }

    function exportData() {
        const data = Storage.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `doz-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        UI.toast('فایل پشتیبان دانلود شد');
        Audio.click();
    }

    function handleImportFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = JSON.parse(ev.target.result);
                if (!confirm('این عمل تنظیمات و آمار فعلی را جایگزین می‌کند. ادامه؟')) return;
                const ok = Storage.importAll(data);
                if (ok) {
                    UI.toast('داده‌ها با موفقیت وارد شد');
                    // Reload settings
                    settings = Storage.getSettings();
                    UI.applyTheme(settings.theme);
                    UI.applyAccentColor(settings.accentColor);
                    UI.applyAnimations(settings.animationsEnabled);
                    UI.applyColorBlindMode(settings.colorBlindMode);
                    UI.syncSettingsUI(settings);
                    Audio.setEnabled(settings.soundEnabled);
                    Audio.setVolume(settings.volume / 100);
                    showStats();
                    updateAchievementBadge();
                } else {
                    UI.toast('فایل نامعتبر است');
                }
            } catch (err) {
                UI.toast('خطا در خواندن فایل');
                console.error(err);
            }
            e.target.value = '';
        };
        reader.readAsText(file);
    }

    /* ---------- Achievements screen ---------- */
    function showAchievements() {
        const all = Achievements.getAll();
        UI.renderAchievements(all);
        UI.showScreen('achievements');
        Audio.click();
    }

    function updateAchievementBadge() {
        const count = Achievements.getUnlockedCount();
        UI.updateAchievementBadge(count);
    }

    /* ---------- Replay screen ---------- */
    function showReplay() {
        if (!Replay.hasReplay()) {
            UI.toast('بازی‌ای برای بازپخش وجود ندارد');
            return;
        }
        Audio.click();
        UI.showScreen('replay');

        const ok = Replay.start({
            onMove: (board, lastMoveIdx, moveMeta) => {
                UI.renderReplayBoard(board, lastMoveIdx);
                if (moveMeta) {
                    // optional: highlight last move
                }
                updateReplayUI();
            },
            onEnd: () => {
                // Show winning line if there was one
                const game = Replay.getReplay();
                if (game && game.winner) {
                    const finalBoard = Game.emptyBoard();
                    game.moves.forEach(m => { finalBoard[m.index] = m.player; });
                    const result = Game.checkWinner(finalBoard);
                    if (result.line) {
                        UI.highlightReplayWin(result.line, game.winner);
                    }
                }
                updateReplayUI();
            },
        });

        if (!ok) {
            UI.toast('خطا در بارگذاری بازپخش');
        }

        // Show game info
        const game = Replay.getReplay();
        if (game) {
            const dateStr = new Date(game.date).toLocaleString('fa-IR');
            const modeStr = game.mode === 'ai' ? `ربات (${game.difficulty})` : 'دو نفره';
            const winnerStr = game.winner === 'draw' ? 'مساوی' :
                              game.winner ? `${game.playerNames[game.winner]} برنده` : 'مساوی';
            UI.setReplayInfo(`
                <strong>${escapeHtml(game.playerNames.x)}</strong> در برابر <strong>${escapeHtml(game.playerNames.o)}</strong><br>
                حالت: ${modeStr} · نتیجه: ${winnerStr}<br>
                <small>${dateStr}</small>
            `);
        }
    }

    function updateReplayUI() {
        const s = Replay.getState();
        if (!s) return;
        UI.setReplayStep(s.index, s.total);
        UI.setReplayPlaying(s.playing);
    }

    function toggleReplayPlay() {
        const s = Replay.getState();
        if (!s) return;
        if (s.playing) {
            Replay.pause();
            UI.setReplayPlaying(false);
        } else {
            Replay.play(800);
            UI.setReplayPlaying(true);
        }
    }

    /* ---------- Onboarding ---------- */
    function handleOnboardingNext() {
        const done = UI.nextOnboardingSlide();
        if (done) finishOnboarding();
        Audio.click();
    }

    function finishOnboarding() {
        UI.hideOnboarding();
        Storage.setOnboarded();
    }

    /* ---------- Resume game ---------- */
    function saveCurrentGameState() {
        if (state.roundOver) {
            Storage.clearGameState();
            return;
        }
        if (state.moves.length === 0) {
            Storage.clearGameState();
            return;
        }
        if (UI.screens.game.classList.contains('active')) {
            Storage.saveGameState({
                board: state.board,
                moves: state.moves,
                currentPlayer: state.currentPlayer,
                playerNames: state.playerNames,
                avatars: state.avatars,
                mode: state.mode,
                difficulty: state.difficulty,
                aiPlayer: state.aiPlayer,
                winTarget: state.winTarget,
                starter: state.starter,
                moveTimerSeconds: state.moveTimerSeconds,
                seriesXScore: state.seriesXScore,
                seriesOScore: state.seriesOScore,
                seriesDraws: state.seriesDraws,
                roundNumber: state.roundNumber,
                seriesStarter: state.seriesStarter,
            });
        }
    }

    function resumeGame() {
        UI.hideResumeModal();
        const saved = Storage.getGameState();
        if (!saved) {
            UI.toast('بازی ذخیره شده یافت نشد');
            return;
        }
        // Restore state
        state.board = saved.board;
        state.moves = saved.moves || [];
        state.currentPlayer = saved.currentPlayer;
        state.playerNames = saved.playerNames || state.playerNames;
        state.avatars = saved.avatars || state.avatars;
        state.mode = saved.mode;
        state.difficulty = saved.difficulty;
        state.aiPlayer = saved.aiPlayer;
        state.winTarget = saved.winTarget;
        state.starter = saved.starter;
        state.moveTimerSeconds = saved.moveTimerSeconds || 0;
        state.seriesXScore = saved.seriesXScore || 0;
        state.seriesOScore = saved.seriesOScore || 0;
        state.seriesDraws = saved.seriesDraws || 0;
        state.roundNumber = saved.roundNumber || 1;
        state.seriesStarter = saved.seriesStarter || 'x';
        state.roundOver = false;

        // Update UI
        let title = `${state.playerNames.x} در برابر ${state.playerNames.o}`;
        if (state.winTarget > 1) title += ` · بهترین از ${state.winTarget}`;
        UI.setMatchTitle(title);
        UI.updatePlayerNames(state.playerNames.x, state.playerNames.o);
        UI.updateAvatars(state.avatars.x, state.avatars.o);
        UI.updateScore(state.seriesXScore, state.seriesOScore, state.seriesDraws, state.roundNumber);
        UI.renderBoard(state.board);
        UI.renderHistory(state.moves);
        UI.setActivePlayer(state.currentPlayer);
        UI.setTurnText(`نوبت: <strong>${escapeHtml(state.playerNames[state.currentPlayer])}</strong>`);
        UI.showTimer(state.moveTimerSeconds > 0);
        UI.showScreen('game');
        UI.toast('بازی ادامه یافت');

        if (state.mode === 'ai' && state.currentPlayer === state.aiPlayer) {
            scheduleAIMove();
        } else {
            startMoveTimerIfNeeded();
        }
    }

    function discardResume() {
        UI.hideResumeModal();
        Storage.clearGameState();
    }

    /* ---------- Keyboard ---------- */
    function handleKeyboard(e) {
        if (UI.els.avatarPickerModal.classList.contains('active') ||
            UI.els.onboardingModal.classList.contains('active') ||
            UI.els.resumeModal.classList.contains('active')) {
            if (e.key === 'Escape') {
                UI.hideAvatarPicker();
                UI.hideResumeModal();
            }
            return;
        }

        const onGameScreen = UI.screens.game.classList.contains('active');
        if (!onGameScreen) {
            if (e.key === 'Escape' && !UI.screens.home.classList.contains('active')) {
                goHome();
            }
            return;
        }

        if (e.key >= '1' && e.key <= '9') {
            const idx = Game.labelToIndex(parseInt(e.key, 10));
            if (idx !== undefined) handleCellClick(idx);
            return;
        }

        if (e.code && e.code.startsWith('Numpad')) {
            const num = parseInt(e.code.replace('Numpad', ''), 10);
            if (num >= 1 && num <= 9) {
                const idx = Game.labelToIndex(num);
                if (idx !== undefined) handleCellClick(idx);
            }
            return;
        }

        switch (e.key.toLowerCase()) {
            case 'u': undoMove(); break;
            case 'r': restartRound(); break;
            case 'escape': quitMatch(); break;
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
