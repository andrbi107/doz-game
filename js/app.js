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
        boardSize: 3,             // 3, 4, or 5 (v3)

        board: Game.emptyBoard(),
        currentPlayer: 'x',
        moves: [],
        roundOver: false,

        seriesXScore: 0,
        seriesOScore: 0,
        seriesDraws: 0,
        roundNumber: 1,
        seriesStarter: 'x',

        // Per-round tracking (v3)
        usedUndo: false,
        usedHint: false,
        firstMove: undefined,     // first move index of the round
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

        // Initialize online UI (v4)
        if (typeof OnlineUI !== 'undefined') {
            OnlineUI.init();
        }

        // Update achievement badge on home
        updateAchievementBadge();
        // Update XP bar on home
        updateXpBar();

        // Check for shared replay in URL (v3)
        checkSharedReplay();

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
        // Only register on http/https - file:// protocol doesn't support SW
        if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
            const swPath = './sw.js';
            navigator.serviceWorker.register(swPath)
                .then(reg => {
                    console.log('SW registered:', reg.scope);
                })
                .catch(err => {
                    console.warn('SW registration failed:', err.message);
                });
        } else if (window.location.protocol === 'file:') {
            console.info('SW not available on file:// protocol. Use a local HTTP server for full features.');
        }
    }

    function handleInstall() {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        deferredInstallPrompt.userChoice.then(choice => {
            if (choice.outcome === 'accepted') {
                UI.toast('بازی نصب شد! 🎉');
                Storage.setStat('pwaInstalled', true);
                const stats = Storage.getStats();
                Achievements.checkAll(stats, {});
                updateAchievementBadge();
            }
            deferredInstallPrompt = null;
            const banner = document.querySelector('.install-banner');
            if (banner) banner.remove();
        });
    }

    /**
     * Test server connection (v7.2).
     */
    async function testServerConnection() {
        const statusEl = document.getElementById('serverStatus');
        if (!statusEl) return;
        const urlInput = document.getElementById('serverUrlInput');
        if (urlInput && urlInput.value.trim()) {
            Online.setServerUrl(urlInput.value.trim().replace(/\/$/, ''));
        }
        statusEl.className = 'server-status checking';
        statusEl.textContent = 'در حال بررسی...';
        try {
            const resp = await fetch(Online.getServerUrl() + '/health', { timeout: 5000 });
            if (resp.ok) {
                const data = await resp.json();
                statusEl.className = 'server-status online';
                statusEl.textContent = '✅ آنلاین (' + data.playersOnline + ' بازیکن)';
                UI.toast('اتصال به سرور برقرار شد!');
            } else {
                statusEl.className = 'server-status offline';
                statusEl.textContent = '❌ خطا (' + resp.status + ')';
            }
        } catch (e) {
            statusEl.className = 'server-status offline';
            statusEl.textContent = '❌ آفلاین';
            UI.toast('سرور در دسترس نیست: ' + e.message);
        }
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

        // Board size control (v3)
        bindSegmented(UI.els.boardSizeControl, (value) => {
            state.boardSize = parseInt(value, 10);
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
                trackUiAction('avatar-changed');
                setTimeout(() => UI.hideAvatarPicker(), 200);
            });
        });
        UI.els.avatarOBtn.addEventListener('click', () => {
            Audio.click();
            UI.showAvatarPicker('انتخاب آواتار O', state.avatars.o, AVATAR_OPTIONS, (emoji) => {
                state.avatars.o = emoji;
                Storage.saveAvatars({ o: emoji });
                UI.updateAvatars(state.avatars.x, emoji);
                trackUiAction('avatar-changed');
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
            trackUiAction('theme-changed');
        });

        // Settings: sound toggle
        UI.els.soundEnabled.addEventListener('change', (e) => {
            settings = Storage.saveSettings({ soundEnabled: e.target.checked });
            Audio.setEnabled(e.target.checked);
            UI.setSoundButtonState(e.target.checked);
            if (e.target.checked) Audio.click();
            trackUiAction('sound-toggled');
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
            trackUiAction('colorblind-toggled');
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

        // Logo click easter egg (v3)
        const logoIcon = document.querySelector('.logo-icon');
        if (logoIcon) {
            logoIcon.style.cursor = 'pointer';
            logoIcon.addEventListener('click', () => {
                trackLogoClick();
                Audio.click();
            });
        }

        // Friends tabs (v5)
        document.querySelectorAll('.friends-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                OnlineUI.switchFriendsTab(tab.dataset.tab);
            });
        });

        // Friend search Enter key
        const friendSearchInput = document.querySelector('#friendSearchInput');
        if (friendSearchInput) {
            friendSearchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') OnlineUI.searchUsers();
            });
        }

        // Spectate emote buttons (v6)
        document.querySelectorAll('[data-spectate-emote]').forEach(btn => {
            btn.addEventListener('click', () => {
                OnlineUI.sendSpectateEmote(btn.dataset.spectateEmote);
            });
        });

        // Server URL input (v7.2)
        const serverUrlInput = document.getElementById('serverUrlInput');
        if (serverUrlInput) {
            serverUrlInput.value = Online.getServerUrl();
            serverUrlInput.addEventListener('change', () => {
                const url = serverUrlInput.value.trim().replace(/\/$/, '');
                if (url) {
                    Online.setServerUrl(url);
                    UI.toast('آدرس سرور ذخیره شد: ' + url);
                }
            });
        }

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
            case 'go-help':       UI.showScreen('help'); Audio.click(); trackUiAction('help-read'); break;
            case 'go-achievements': showAchievements(); break;
            case 'go-replay':     showReplay(); break;

            case 'select-mode':   selectMode(target.dataset.mode); break;
            case 'start-game':    startMatch(); break;

            case 'restart-game':  restartRound(); break;
            case 'quit-game':     quitMatch(); break;
            case 'next-round':    nextRound(); break;
            case 'rematch':       rematch(); break;
            case 'share-replay':  shareReplay(); break;

            // Online (v4)
            case 'go-online':         OnlineUI.showOnlineScreen(); break;
            case 'show-login':        OnlineUI.showAuth('login'); break;
            case 'show-register':     OnlineUI.showAuth('register'); break;
            case 'close-auth':        OnlineUI.hideAuth(); break;
            case 'switch-auth':       OnlineUI.switchAuthMode(); break;
            case 'submit-auth':       OnlineUI.submitAuth(); break;
            case 'logout':            OnlineUI.logout(); break;
            case 'quick-match':       OnlineUI.quickMatch(); break;
            case 'cancel-match':      OnlineUI.cancelMatch(); break;
            case 'create-private':    OnlineUI.createPrivate(); break;
            case 'join-private':      OnlineUI.showJoinPrivate(); break;
            case 'confirm-join-private': OnlineUI.confirmJoinPrivate(); break;
            case 'quit-online-game':  OnlineUI.quitOnlineGame(); break;
            case 'resign-online':     OnlineUI.resignOnline(); break;

            // Friends & Profile (v5)
            case 'go-friends':        OnlineUI.showFriendsScreen(); break;
            case 'go-leaderboard':    OnlineUI.showLeaderboard(); break;
            case 'search-users':      OnlineUI.searchUsers(); break;
            case 'add-friend':        OnlineUI.addFriend(target.dataset.username); break;
            case 'accept-friend':     OnlineUI.acceptFriend(target.dataset.username); break;
            case 'reject-friend':     OnlineUI.rejectFriend(target.dataset.username); break;
            case 'remove-friend':     OnlineUI.removeFriend(target.dataset.username); break;
            case 'view-profile':      OnlineUI.showProfile(target.dataset.username); break;

            // Tournament, League, Spectate, Analysis (v6)
            case 'go-tournament':     OnlineUI.showTournament(); break;
            case 'go-league':        OnlineUI.showLeague(); break;
            case 'go-spectate':       OnlineUI.showSpectate(); break;
            case 'signup-tournament': OnlineUI.signupTournament(); break;
            case 'start-tournament':  OnlineUI.startTournament(); break;
            case 'leave-spectate':    OnlineUI.leaveSpectate(); break;
            case 'analyze-game':      OnlineUI.analyzeCurrentGame(); break;
            case 'close-analysis':    OnlineUI.closeAnalysis(); break;

            // Shop and Battle Pass (v7)
            case 'go-shop':           OnlineUI.showShop(); break;
            case 'go-battlepass':     OnlineUI.showBattlePass(); break;

            // Server settings (v7.2)
            case 'test-server':       testServerConnection(); break;

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
        updateXpBar();
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
            if (lastSetup.boardSize !== undefined) {
                state.boardSize = lastSetup.boardSize;
                UI.setSelectedBoardSize(lastSetup.boardSize);
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
        // Get board size from UI (v3)
        state.boardSize = UI.getSelectedBoardSize ? UI.getSelectedBoardSize() : 3;

        // Track series/timer for achievements (v3)
        if (state.moveTimerSeconds > 0) trackUiAction('timer-game');
        if (state.winTarget === 3) trackUiAction('series-3');
        else if (state.winTarget === 5) trackUiAction('series-5');
        else if (state.winTarget === 7) trackUiAction('series-7');

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
                boardSize: state.boardSize,
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
        state.board = Game.emptyBoard(state.boardSize);
        state.moves = [];
        state.roundOver = false;
        state.currentPlayer = starter;
        // Reset per-round tracking
        state.usedUndo = false;
        state.usedHint = false;
        state.firstMove = undefined;

        // Rebuild board DOM for the correct size (v3)
        UI.setBoardSizeClass(state.boardSize);
        rebuildBoardDom(state.boardSize);

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

    /**
     * Rebuild the board DOM cells for the given size (v3).
     */
    function rebuildBoardDom(size) {
        const board = UI.els.board;
        if (!board) return;
        const total = size * size;
        // Check if already correct
        const currentCells = board.querySelectorAll('.cell');
        if (currentCells.length === total) return;
        // Clear and rebuild
        board.innerHTML = '';
        for (let i = 0; i < total; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.index = i;
            board.appendChild(cell);
        }
        // Update UI.els.cells reference
        UI.els.cells = Array.from(board.querySelectorAll('.cell'));
    }

    /**
     * Get the win length for the current board size (v3).
     */
    function getWinLength() {
        return Game.recommendedWinLength(state.boardSize);
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
        updateXpBar();
    }

    /**
     * Share replay as a URL with encoded game data (v3).
     */
    function shareReplay() {
        Audio.click();
        const game = Storage.getLastGame();
        if (!game) {
            UI.toast('بازی‌ای برای اشتراک‌گذاری وجود ندارد');
            return;
        }
        try {
            // Encode game data as base64 URL parameter
            const encoded = btoa(encodeURIComponent(JSON.stringify(game)));
            const url = window.location.origin + window.location.pathname + '?replay=' + encoded;
            // Copy to clipboard
            if (navigator.clipboard) {
                navigator.clipboard.writeText(url).then(() => {
                    UI.toast('لینک بازپخش کپی شد!');
                }).catch(() => {
                    UI.toast('خطا در کپی. لینک در console است.');
                    console.log('Replay URL:', url);
                });
            } else {
                UI.toast('لینک در console است.');
                console.log('Replay URL:', url);
            }
        } catch (e) {
            UI.toast('خطا در ایجاد لینک');
            console.error(e);
        }
    }

    /**
     * Update XP bar display (v3).
     */
    function updateXpBar() {
        if (UI.updateXpBar) {
            const xpProgress = Storage.getXpProgress();
            UI.updateXpBar(xpProgress);
        }
    }

    /**
     * Check for shared replay in URL and load it (v3).
     */
    function checkSharedReplay() {
        try {
            const params = new URLSearchParams(window.location.search);
            const replayParam = params.get('replay');
            if (!replayParam) return;
            const decoded = JSON.parse(decodeURIComponent(atob(replayParam)));
            if (decoded && decoded.moves) {
                Storage.saveLastGame(decoded);
                UI.setReplayMenuEnabled(true);
                UI.toast('بازپخش اشتراک‌گذاری‌شده بارگذاری شد!');
                // Clean URL
                window.history.replaceState({}, '', window.location.pathname);
                // Auto-open replay
                setTimeout(() => showReplay(), 800);
            }
        } catch (e) {
            console.warn('Failed to load shared replay', e);
        }
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

        // Track first move of the round
        if (state.firstMove === undefined) {
            state.firstMove = index;
        }

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

        const result = Game.checkWinner(state.board, state.boardSize, getWinLength());
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
                const move = AI.chooseMoveWithSize(state.board, state.aiPlayer, state.difficulty, state.boardSize, getWinLength());
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
            boardSize: state.boardSize,
            winLength: getWinLength(),
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
                    line: result.line,
                    firstMove: state.firstMove,
                    usedUndo: state.usedUndo,
                    usedHint: state.usedHint,
                    boardSize: state.boardSize,
                    humanPlayer,
                });
                if (humanWon) Audio.win();
                else Audio.lose();
            } else {
                Storage.recordGame('win', winnerName, {
                    mode: 'pvp', moves: state.moves.length, line: result.line,
                    firstMove: state.firstMove, usedUndo: state.usedUndo, usedHint: state.usedHint,
                    boardSize: state.boardSize, humanPlayer: winner,
                });
                Storage.recordGame('loss', loserName, {
                    mode: 'pvp', moves: state.moves.length,
                    boardSize: state.boardSize, humanPlayer: loser,
                });
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
                    boardSize: state.boardSize,
                    humanPlayer,
                });
            } else {
                Storage.recordGame('draw', state.playerNames.x, {
                    mode: 'pvp', moves: state.moves.length, boardSize: state.boardSize,
                });
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

        // Mark undo as used (for achievements)
        state.usedUndo = true;
        // Track keyboard shortcut
        trackKeyboardShortcut('undo');

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

        state.board = Game.emptyBoard(state.boardSize);
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
        trackUiAction('sound-toggled');
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
            showHintForCurrentPlayer();
        }
    }

    /**
     * Show hint for current player and mark hint as used (v3).
     */
    function showHintForCurrentPlayer() {
        if (state.roundOver) return;
        if (isAICurrent()) return;
        const hint = AI.getHint(state.board, state.currentPlayer, state.boardSize, getWinLength());
        if (hint >= 0) {
            UI.showHint(hint);
            state.usedHint = true;
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
        Storage.incrementStat('exportCount');
        const stats = Storage.getStats();
        Achievements.checkAll(stats, {});
        updateAchievementBadge();
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
                    Storage.incrementStat('importCount');
                    const stats = Storage.getStats();
                    Achievements.checkAll(stats, {});
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
                    const replaySize = game.boardSize || 3;
                    const replayWinLength = Game.recommendedWinLength(replaySize);
                    const finalBoard = Game.emptyBoard(replaySize);
                    game.moves.forEach(m => { finalBoard[m.index] = m.player; });
                    const result = Game.checkWinner(finalBoard, replaySize, replayWinLength);
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
        state.boardSize = saved.boardSize || 3;
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
        // Rebuild board for the correct size and render (v3)
        UI.setBoardSizeClass(state.boardSize);
        rebuildBoardDom(state.boardSize);
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
            if (idx !== undefined) {
                handleCellClick(idx);
                trackKeyboardShortcut('number');
            }
            return;
        }

        if (e.code && e.code.startsWith('Numpad')) {
            const num = parseInt(e.code.replace('Numpad', ''), 10);
            if (num >= 1 && num <= 9) {
                const idx = Game.labelToIndex(num);
                if (idx !== undefined) {
                    handleCellClick(idx);
                    trackKeyboardShortcut('number');
                }
            }
            return;
        }

        switch (e.key.toLowerCase()) {
            case 'u':
                undoMove();
                trackKeyboardShortcut('undo');
                break;
            case 'r':
                restartRound();
                trackKeyboardShortcut('restart');
                break;
            case 'escape': quitMatch(); break;
            case 'h':
                if (!state.roundOver) {
                    showHintForCurrentPlayer();
                    Audio.click();
                    trackKeyboardShortcut('hint');
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

    /**
     * Track keyboard shortcut usage for achievements (v3).
     */
    function trackKeyboardShortcut(name) {
        const used = Storage.pushStatArray('keyboardShortcutsUsed', name, true, 20);
        // Check for keyboard achievements
        const stats = Storage.getStats();
        Achievements.checkAll(stats, {});
        updateAchievementBadge();
    }

    /**
     * Track logo clicks for easter egg (v3).
     */
    function trackLogoClick() {
        Storage.incrementStat('logoClicks');
        const clicks = Storage.getStats().logoClicks;
        if (clicks === 10) {
            UI.toast('🔍 دستاورد کشف شد!');
        }
        const stats = Storage.getStats();
        Achievements.checkAll(stats, {});
        updateAchievementBadge();
    }

    /**
     * Track UI interactions for achievements (v3).
     */
    function trackUiAction(action) {
        switch (action) {
            case 'help-read':
                Storage.setStat('helpRead', true);
                break;
            case 'avatar-changed':
                Storage.setStat('avatarChanged', true);
                break;
            case 'theme-changed':
                Storage.setStat('themeChanged', true);
                break;
            case 'sound-toggled':
                Storage.setStat('soundToggled', true);
                break;
            case 'colorblind-toggled':
                Storage.setStat('colorBlindToggled', true);
                break;
            case 'timer-game':
                Storage.incrementStat('timerGames');
                break;
            case 'series-3':
                Storage.incrementStat('series3Games');
                break;
            case 'series-5':
                Storage.incrementStat('series5Games');
                break;
            case 'series-7':
                Storage.incrementStat('series7Games');
                break;
        }
        const stats = Storage.getStats();
        Achievements.checkAll(stats, {});
        updateAchievementBadge();
    }

    /* ---------- Boot ---------- */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
