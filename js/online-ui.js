/* ============================================
   JS/ONLINE-UI.JS - UI controller for online multiplayer
   Handles auth modal, matchmaking, and online game screen
   ============================================ */

const OnlineUI = (function () {
    'use strict';

    let authMode = 'login'; // 'login' | 'register'
    let onlineGameState = {
        roomId: null,
        myRole: null,        // 'x' or 'o'
        board: new Array(9).fill(null),
        currentPlayer: 'x',
        finished: false,
    };

    const $ = (s) => document.querySelector(s);
    const $$ = (s) => Array.from(document.querySelectorAll(s));

    const els = {
        // Auth modal
        authModal: $('#authModal'),
        authTitle: $('#authTitle'),
        authUsername: $('#authUsername'),
        authPassword: $('#authPassword'),
        authError: $('#authError'),
        authSubmitBtn: $('#authSubmitBtn'),
        authSwitchText: $('#authSwitchText'),
        authSwitchBtn: $('#authSwitchBtn'),
        // Online screen
        onlineScreen: $('#onlineScreen'),
        onlineUserCard: $('#onlineUserCard'),
        onlineUserAvatar: $('#onlineUserAvatar'),
        onlineUserName: $('#onlineUserName'),
        onlineUserElo: $('#onlineUserElo'),
        onlineUserTier: $('#onlineUserTier'),
        onlineNotLoggedIn: $('#onlineNotLoggedIn'),
        onlineMatchmaking: $('#onlineMatchmaking'),
        onlinePlayersCount: $('#onlinePlayersCount'),
        onlineGamesCount: $('#onlineGamesCount'),
        matchmakingStatus: $('#matchmakingStatus'),
        matchmakingText: $('#matchmakingText'),
        privateRoomInfo: $('#privateRoomInfo'),
        privateRoomCode: $('#privateRoomCode'),
        joinPrivateForm: $('#joinPrivateForm'),
        joinCodeInput: $('#joinCodeInput'),
        // Online game screen
        onlineGameScreen: $('#onlineGameScreen'),
        onlineGameTitle: $('#onlineGameTitle'),
        onlineBoard: $('#onlineBoard'),
        onlineWinningLine: $('#onlineWinningLine'),
        onlineScoreNameX: $('#onlineScoreNameX'),
        onlineScoreNameO: $('#onlineScoreNameO'),
        onlineScoreEloX: $('#onlineScoreEloX'),
        onlineScoreEloO: $('#onlineScoreEloO'),
        onlineScoreCardX: $('#onlineScoreCardX'),
        onlineScoreCardO: $('#onlineScoreCardO'),
        onlineTurnText: $('#onlineTurnText'),
        onlinePlayersBadge: $('#onlinePlayersBadge'),
        emoteBar: $('#emoteBar'),
        emoteDisplay: $('#emoteDisplay'),
    };

    /* ---------- Init ---------- */
    function init() {
        // Setup Online event handlers
        Online.on('connect', handleSocketConnect);
        Online.on('disconnect', handleSocketDisconnect);
        Online.on('matchStatus', handleMatchStatus);
        Online.on('matchFound', handleMatchFound);
        Online.on('gameStart', handleGameStart);
        Online.on('gameMove', handleGameMove);
        Online.on('gameEnd', handleGameEnd);
        Online.on('gameError', handleGameError);
        Online.on('chatEmote', handleChatEmote);
        Online.on('presenceUpdate', handlePresenceUpdate);
        Online.on('rematchRequest', handleRematchRequest);
        Online.on('rematchStart', handleRematchStart);

        // Build online board cells
        buildOnlineBoard();

        // Setup emote bar
        setupEmoteBar();

        // Check if already logged in
        if (Online.isLoggedIn()) {
            refreshOnlineUI();
        }
    }

    function buildOnlineBoard() {
        if (!els.onlineBoard) return;
        els.onlineBoard.innerHTML = '';
        for (let i = 0; i < 9; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.index = i;
            cell.addEventListener('click', () => handleOnlineCellClick(i));
            els.onlineBoard.appendChild(cell);
        }
    }

    function setupEmoteBar() {
        if (!els.emoteBar) return;
        const btns = els.emoteBar.querySelectorAll('.emote-btn');
        btns.forEach(btn => {
            btn.addEventListener('click', () => {
                const emote = btn.dataset.emote;
                if (onlineGameState.roomId) {
                    Online.sendEmote(onlineGameState.roomId, emote);
                    showEmote('شما', emote);
                }
            });
        });
    }

    /* ---------- Auth ---------- */
    function showAuth(mode) {
        authMode = mode;
        els.authTitle.textContent = mode === 'login' ? 'ورود به حساب' : 'ثبت‌نام';
        els.authSubmitBtn.textContent = mode === 'login' ? 'ورود' : 'ثبت‌نام';
        els.authSwitchText.textContent = mode === 'login' ? 'حساب ندارید؟' : 'حساب دارید؟';
        els.authSwitchBtn.textContent = mode === 'login' ? 'ثبت‌نام' : 'ورود';
        els.authError.style.display = 'none';
        els.authUsername.value = '';
        els.authPassword.value = '';
        els.authModal.classList.add('active');
    }

    function hideAuth() {
        els.authModal.classList.remove('active');
    }

    function switchAuthMode() {
        showAuth(authMode === 'login' ? 'register' : 'login');
    }

    async function submitAuth() {
        const username = els.authUsername.value.trim();
        const password = els.authPassword.value;
        if (!username || !password) {
            showAuthError('نام کاربری و رمز عبور را وارد کنید');
            return;
        }
        els.authSubmitBtn.disabled = true;
        els.authSubmitBtn.textContent = '...';
        try {
            if (authMode === 'login') {
                await Online.login(username, password);
            } else {
                await Online.register(username, password);
            }
            hideAuth();
            refreshOnlineUI();
            if (UI && UI.toast) UI.toast(authMode === 'login' ? 'خوش آمدید!' : 'ثبت‌نام موفق!');
            // Try to connect socket
            try {
                Online.connect();
            } catch (e) {
                console.warn('Socket connect failed (server may be down):', e.message);
            }
        } catch (e) {
            showAuthError(e.message);
        }
        els.authSubmitBtn.disabled = false;
        els.authSubmitBtn.textContent = authMode === 'login' ? 'ورود' : 'ثبت‌نام';
    }

    function showAuthError(msg) {
        els.authError.textContent = msg;
        els.authError.style.display = 'block';
    }

    function logout() {
        Online.logout();
        refreshOnlineUI();
        if (UI && UI.toast) UI.toast('از حساب خارج شدید');
    }

    /* ---------- Online screen ---------- */
    function showOnlineScreen() {
        UI.showScreen('online');
        refreshOnlineUI();
        // If logged in but not connected, try to connect
        if (Online.isLoggedIn() && !Online.isConnected()) {
            try {
                Online.connect();
            } catch (e) {
                console.warn('Socket connect failed:', e.message);
                if (UI && UI.toast) UI.toast('سرور آنلاین در دسترس نیست');
            }
        }
    }

    function refreshOnlineUI() {
        const user = Online.getUser();
        if (user) {
            els.onlineNotLoggedIn.style.display = 'none';
            els.onlineMatchmaking.style.display = 'block';
            els.onlineUserCard.style.display = 'flex';
            els.onlineUserName.textContent = user.username;
            els.onlineUserElo.textContent = toPersianDigits(user.elo || 1200);
            // Tier
            const tiers = [
                { min: 2400, icon: '💎', name: 'الماس' },
                { min: 2000, icon: '🥈', name: 'پلاتین' },
                { min: 1700, icon: '🥇', name: 'طلایی' },
                { min: 1400, icon: '⚪', name: 'نقره‌ای' },
                { min: 0, icon: '🥉', name: 'برنزی' },
            ];
            const tier = tiers.find(t => user.elo >= t.min);
            els.onlineUserTier.textContent = tier.icon;
        } else {
            els.onlineNotLoggedIn.style.display = 'block';
            els.onlineMatchmaking.style.display = 'none';
            els.onlineUserCard.style.display = 'none';
        }
    }

    /* ---------- Matchmaking ---------- */
    function quickMatch() {
        if (!Online.isConnected()) {
            if (UI && UI.toast) UI.toast('اتصال به سرور برقرار نیست');
            return;
        }
        Online.quickMatch();
        els.matchmakingStatus.style.display = 'flex';
        els.matchmakingText.textContent = 'در حال جستجوی حریف...';
        // Hide cards
        $$('.matchmaking-cards .mode-card').forEach(c => c.style.display = 'none');
    }

    function cancelMatch() {
        Online.cancelMatch();
        els.matchmakingStatus.style.display = 'none';
        $$('.matchmaking-cards .mode-card').forEach(c => c.style.display = '');
    }

    async function createPrivate() {
        if (!Online.isConnected()) {
            if (UI && UI.toast) UI.toast('اتصال به سرور برقرار نیست');
            return;
        }
        try {
            const result = await Online.createPrivateRoom();
            els.privateRoomInfo.style.display = 'block';
            els.privateRoomCode.textContent = result.code;
            els.matchmakingStatus.style.display = 'none';
            $$('.matchmaking-cards .mode-card').forEach(c => c.style.display = 'none');
        } catch (e) {
            if (UI && UI.toast) UI.toast('خطا در ساخت اتاق');
        }
    }

    function showJoinPrivate() {
        els.joinPrivateForm.style.display = 'flex';
        els.matchmakingStatus.style.display = 'none';
        $$('.matchmaking-cards .mode-card').forEach(c => c.style.display = 'none');
    }

    async function confirmJoinPrivate() {
        const code = els.joinCodeInput.value.trim().toUpperCase();
        if (!code) {
            if (UI && UI.toast) UI.toast('کد را وارد کنید');
            return;
        }
        try {
            await Online.joinPrivateRoom(code);
        } catch (e) {
            if (UI && UI.toast) UI.toast(e.message);
        }
    }

    /* ---------- Socket event handlers ---------- */
    function handleSocketConnect() {
        console.log('[Online] Connected');
        if (UI && UI.toast) UI.toast('به سرور متصل شدید');
    }

    function handleSocketDisconnect() {
        console.log('[Online] Disconnected');
        if (UI && UI.toast) UI.toast('اتصال قطع شد');
    }

    function handleMatchStatus(data) {
        if (data.status === 'searching') {
            els.matchmakingText.textContent = 'در حال جستجو... (موقعیت: ' + (data.position || '?') + ')';
        } else if (data.status === 'cancelled') {
            els.matchmakingStatus.style.display = 'none';
            $$('.matchmaking-cards .mode-card').forEach(c => c.style.display = '');
        } else if (data.status === 'private-expired') {
            els.privateRoomInfo.style.display = 'none';
            $$('.matchmaking-cards .mode-card').forEach(c => c.style.display = '');
            if (UI && UI.toast) UI.toast('اتاق خصوصی منقضی شد');
        }
    }

    function handleMatchFound(data) {
        els.matchmakingStatus.style.display = 'none';
        els.privateRoomInfo.style.display = 'none';
        els.joinPrivateForm.style.display = 'none';
        $$('.matchmaking-cards .mode-card').forEach(c => c.style.display = '');
        if (UI && UI.toast) UI.toast(`حریف یافت شد: ${data.opponent.username} (${data.opponent.elo})`);
    }

    function handleGameStart(data) {
        if (data.role) {
            onlineGameState.myRole = data.role;
            els.onlineGameTitle.textContent = `شما: ${data.role.toUpperCase()}`;
        }
        if (data.board) {
            onlineGameState.board = data.board.slice();
            onlineGameState.currentPlayer = data.currentPlayer || 'x';
            onlineGameState.finished = false;
            // Set player names
            if (data.players) {
                els.onlineScoreNameX.textContent = data.players.x;
                els.onlineScoreNameO.textContent = data.players.o;
            }
            renderOnlineBoard();
            updateOnlineTurn();
            UI.showScreen('onlineGame');
        }
    }

    function handleGameMove(data) {
        if (data.index !== undefined) {
            onlineGameState.board[data.index] = data.player;
            if (data.currentPlayer) onlineGameState.currentPlayer = data.currentPlayer;
            renderOnlineBoard(data.index);
            updateOnlineTurn();
        }
    }

    function handleGameEnd(data) {
        onlineGameState.finished = true;
        if (data.line) {
            highlightOnlineWin(data.line, data.winner);
        }
        let msg;
        if (data.winner === null) {
            msg = 'مساوی!';
        } else if (data.winner === onlineGameState.myRole) {
            msg = '🎉 شما بردید!';
        } else {
            msg = '😢 شما باختید';
        }
        if (data.resigned) msg += ' (تسلیم)';
        if (data.disconnected) msg += ' (قطع اتصال)';
        els.onlineTurnText.innerHTML = `<strong>${msg}</strong>`;
        if (UI && UI.toast) UI.toast(msg);
        // Record for stats
        if (Storage && Achievements) {
            const result = data.winner === onlineGameState.myRole ? 'win' :
                          data.winner === null ? 'draw' : 'loss';
            const user = Online.getUser();
            Storage.recordGame(result, user ? user.username : 'Online', {
                mode: 'ai', // treat as competitive
                difficulty: 'hard',
                moves: onlineGameState.board.filter(c => c !== null).length,
                boardSize: 3,
                humanPlayer: onlineGameState.myRole,
            });
            const stats = Storage.getStats();
            Achievements.checkAll(stats, {});
        }
    }

    function handleGameError(data) {
        if (UI && UI.toast) UI.toast(data.error);
    }

    function handleChatEmote(data) {
        showEmote(data.by, data.emote);
    }

    function handlePresenceUpdate(data) {
        // Could update online players list
    }

    function handleRematchRequest(data) {
        if (UI && UI.toast) UI.toast(`${data.by} درخواست بازی مجدد داد`);
    }

    function handleRematchStart(data) {
        onlineGameState.board = data.board.slice();
        onlineGameState.currentPlayer = data.currentPlayer || 'x';
        onlineGameState.finished = false;
        renderOnlineBoard();
        updateOnlineTurn();
        if (UI && UI.toast) UI.toast('بازی مجدد شروع شد!');
    }

    /* ---------- Online game ---------- */
    function handleOnlineCellClick(index) {
        if (onlineGameState.finished) return;
        if (onlineGameState.board[index] !== null) return;
        if (onlineGameState.currentPlayer !== onlineGameState.myRole) {
            if (UI && UI.toast) UI.toast('نوبت شما نیست');
            return;
        }
        Online.sendMove(onlineGameState.roomId, index);
    }

    function renderOnlineBoard(lastMoveIdx) {
        const cells = els.onlineBoard.querySelectorAll('.cell');
        cells.forEach((cell, i) => {
            cell.classList.remove('x', 'o', 'filled');
            const oldMark = cell.querySelector('.mark');
            if (oldMark) oldMark.remove();
            const val = onlineGameState.board[i];
            if (val) {
                cell.classList.add(val, 'filled');
                const mark = document.createElement('span');
                mark.className = 'mark';
                mark.textContent = val === 'x' ? '×' : '○';
                if (i !== lastMoveIdx) {
                    mark.style.animation = 'none';
                    mark.style.opacity = '1';
                }
                cell.appendChild(mark);
            }
        });
    }

    function updateOnlineTurn() {
        if (onlineGameState.finished) return;
        const isMyTurn = onlineGameState.currentPlayer === onlineGameState.myRole;
        els.onlineScoreCardX.classList.toggle('active', onlineGameState.currentPlayer === 'x');
        els.onlineScoreCardO.classList.toggle('active', onlineGameState.currentPlayer === 'o');
        els.onlineTurnText.innerHTML = isMyTurn
            ? 'نوبت: <strong>شما</strong>'
            : 'نوبت: <strong>حریف</strong>';
    }

    function highlightOnlineWin(line, winner) {
        const cells = els.onlineBoard.querySelectorAll('.cell');
        line.forEach(idx => cells[idx].classList.add('winning', winner));
        // Draw line
        const boardRect = els.onlineBoard.getBoundingClientRect();
        const cell0 = cells[line[0]].getBoundingClientRect();
        const cell2 = cells[line[2]].getBoundingClientRect();
        const x1 = (cell0.left + cell0.width / 2) - boardRect.left;
        const y1 = (cell0.top + cell0.height / 2) - boardRect.top;
        const x2 = (cell2.left + cell2.width / 2) - boardRect.left;
        const y2 = (cell2.top + cell2.height / 2) - boardRect.top;
        els.onlineWinningLine.innerHTML = `
            <svg viewBox="0 0 ${boardRect.width} ${boardRect.height}" preserveAspectRatio="none">
                <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />
            </svg>
        `;
    }

    function showEmote(by, emote) {
        const popup = document.createElement('div');
        popup.className = 'emote-popup';
        popup.textContent = emote;
        // Random horizontal offset
        popup.style.left = (Math.random() * 200 - 100) + 'px';
        els.emoteDisplay.appendChild(popup);
        setTimeout(() => popup.remove(), 1800);
    }

    function quitOnlineGame() {
        if (onlineGameState.roomId && !onlineGameState.finished) {
            Online.resign(onlineGameState.roomId);
        }
        onlineGameState.roomId = null;
        onlineGameState.finished = false;
        UI.showScreen('online');
    }

    function resignOnline() {
        if (!onlineGameState.roomId || onlineGameState.finished) return;
        if (!confirm('آیا مطمئن هستید که می‌خواهید تسلیم شوید؟')) return;
        Online.resign(onlineGameState.roomId);
    }

    /* ---------- Helpers ---------- */
    function toPersianDigits(n) {
        const map = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
        return String(n).replace(/\d/g, d => map[parseInt(d, 10)]);
    }

    return {
        init,
        showAuth,
        hideAuth,
        switchAuthMode,
        submitAuth,
        logout,
        showOnlineScreen,
        quickMatch,
        cancelMatch,
        createPrivate,
        showJoinPrivate,
        confirmJoinPrivate,
        quitOnlineGame,
        resignOnline,
        refreshOnlineUI,
    };
})();
