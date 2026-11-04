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

        // Auth form: submit on Enter
        if (els.authPassword) {
            els.authPassword.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') submitAuth();
            });
        }
        if (els.authUsername) {
            els.authUsername.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    if (els.authPassword.value) submitAuth();
                    else els.authPassword.focus();
                }
            });
        }

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
        els.authTitle.textContent = mode === 'login' ? 'ورود به حساب' : 'ثبت‌نام حساب جدید';
        els.authSubmitBtn.textContent = mode === 'login' ? 'ورود' : 'ثبت‌نام';
        els.authSwitchText.textContent = mode === 'login' ? 'حساب ندارید؟' : 'حساب دارید؟';
        els.authSwitchBtn.textContent = mode === 'login' ? 'ثبت‌نام' : 'ورود';
        els.authError.style.display = 'none';
        els.authUsername.value = '';
        els.authPassword.value = '';
        // Update hint
        const hint = document.getElementById('authHint');
        if (hint) {
            hint.textContent = mode === 'login'
                ? '💡 اگر قبلاً ثبت‌نام کرده‌اید، نام کاربری و رمز عبور خود را وارد کنید.'
                : '💡 ثبت‌نام رایگان است. نام کاربری و رمز عبور انتخاب کنید.';
        }
        els.authModal.classList.add('active');
        // Focus username field
        setTimeout(() => els.authUsername.focus(), 100);
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
            if (UI && UI.toast) UI.toast(authMode === 'login' ? 'خوش آمدید!' : 'ثبت‌نام موفق! 🎉');
            // Try to connect socket
            try {
                Online.connect();
            } catch (e) {
                console.warn('Socket connect failed (server may be down):', e.message);
                if (UI && UI.toast) UI.toast('اتصال زنده برقرار نشد. بازی آنلاین ممکن است محدود باشد.');
            }
        } catch (e) {
            // Better error messages for common cases
            let msg = e.message;
            if (msg.includes('نام کاربری یا رمز عبور اشتباه')) {
                msg = 'نام کاربری یا رمز عبور اشتباه است. اگر حساب ندارید، روی «ثبت‌نام» کلیک کنید.';
            } else if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
                msg = 'اتصال به سرور برقرار نشد. مطمئن شوید سرور در حال اجراست و آدرس آن صحیح است.';
            }
            showAuthError(msg);
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
        // Check server connectivity first
        checkServerAndConnect();
    }

    /**
     * Check if server is reachable and connect if logged in.
     */
    async function checkServerAndConnect() {
        // Try health check first
        try {
            const resp = await fetch(Online.getServerUrl() + '/health');
            if (!resp.ok) throw new Error('Server returned ' + resp.status);
            // Server is online - if logged in, connect socket
            if (Online.isLoggedIn() && !Online.isConnected()) {
                try {
                    Online.connect();
                } catch (e) {
                    console.warn('Socket connect failed:', e.message);
                    if (UI && UI.toast) UI.toast('اتصال زنده برقرار نشد. برخی ویژگی‌ها محدود است.');
                }
            }
        } catch (e) {
            // Server is offline - show banner
            showConnectionBanner('سرور در دسترس نیست. ابتدا سرور را اجرا کنید: cd server && npm start');
        }
    }

    /**
     * Show a connection banner on the online screen.
     */
    function showConnectionBanner(message, type) {
        const container = document.querySelector('#onlineScreen .online-container');
        if (!container) return;
        // Remove existing banner
        const existing = container.querySelector('.connection-banner');
        if (existing) existing.remove();
        const banner = document.createElement('div');
        banner.className = 'connection-banner' + (type ? ' ' + type : '');
        banner.textContent = message;
        container.insertBefore(banner, container.firstChild);
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

    /* ---------- Friends screen (v5) ---------- */

    async function showFriendsScreen() {
        UI.showScreen('friends');
        if (!Online.isLoggedIn()) {
            if (UI && UI.toast) UI.toast('برای مشاهده دوستان وارد شوید');
            return;
        }
        await refreshFriends();
        await refreshFriendRequests();
    }

    async function refreshFriends() {
        const list = $('#friendsList');
        if (!list) return;
        list.innerHTML = '<p class="empty-state">در حال بارگذاری...</p>';
        try {
            const friends = await Online.getFriends();
            if (friends.length === 0) {
                list.innerHTML = '<p class="empty-state">هنوز دوستی ندارید. از تب جستجو استفاده کنید.</p>';
                return;
            }
            list.innerHTML = '';
            friends.forEach(f => {
                const card = document.createElement('div');
                card.className = 'friend-card';
                card.innerHTML = `
                    <div class="friend-avatar">👤</div>
                    <div class="friend-info">
                        <div class="friend-name">${escapeHtml(f.username)}</div>
                        <div class="friend-stats">${toPersianDigits(f.elo)} ELO · ${toPersianDigits(f.wins)} برد</div>
                    </div>
                    <div class="friend-actions">
                        <button class="btn btn-ghost btn-sm" data-action="view-profile" data-username="${escapeHtml(f.username)}">پروفایل</button>
                        <button class="btn btn-danger btn-sm" data-action="remove-friend" data-username="${escapeHtml(f.username)}">حذف</button>
                    </div>
                `;
                list.appendChild(card);
            });
        } catch (e) {
            list.innerHTML = '<p class="empty-state">خطا در بارگذاری</p>';
        }
    }

    async function refreshFriendRequests() {
        const list = $('#friendRequestsList');
        const badge = $('#friendRequestsBadge');
        const menuBadge = $('#friendRequestsMenuBadge');
        if (!list) return;
        try {
            const requests = await Online.getFriendRequests();
            // Update badges
            if (requests.length > 0) {
                if (badge) { badge.style.display = 'inline-block'; badge.textContent = toPersianDigits(requests.length); }
                if (menuBadge) { menuBadge.style.display = 'inline-block'; menuBadge.textContent = toPersianDigits(requests.length); }
            } else {
                if (badge) badge.style.display = 'none';
                if (menuBadge) menuBadge.style.display = 'none';
            }
            if (requests.length === 0) {
                list.innerHTML = '<p class="empty-state">درخواستی وجود ندارد</p>';
                return;
            }
            list.innerHTML = '';
            requests.forEach(r => {
                const card = document.createElement('div');
                card.className = 'friend-card';
                card.innerHTML = `
                    <div class="friend-avatar">👤</div>
                    <div class="friend-info">
                        <div class="friend-name">${escapeHtml(r.from)}</div>
                        <div class="friend-stats">${toPersianDigits(r.elo)} ELO</div>
                    </div>
                    <div class="friend-actions">
                        <button class="btn btn-primary btn-sm" data-action="accept-friend" data-username="${escapeHtml(r.from)}">پذیرفتن</button>
                        <button class="btn btn-ghost btn-sm" data-action="reject-friend" data-username="${escapeHtml(r.from)}">رد</button>
                    </div>
                `;
                list.appendChild(card);
            });
        } catch (e) {
            list.innerHTML = '<p class="empty-state">خطا در بارگذاری</p>';
        }
    }

    async function searchUsers() {
        const input = $('#friendSearchInput');
        const results = $('#userSearchResults');
        if (!input || !results) return;
        const q = input.value.trim();
        if (q.length < 2) {
            if (UI && UI.toast) UI.toast('حداقل ۲ کاراکتر وارد کنید');
            return;
        }
        results.innerHTML = '<p class="empty-state">در حال جستجو...</p>';
        try {
            const users = await Online.searchUsers(q);
            if (users.length === 0) {
                results.innerHTML = '<p class="empty-state">کاربری یافت نشد</p>';
                return;
            }
            results.innerHTML = '';
            users.forEach(u => {
                const card = document.createElement('div');
                card.className = 'friend-card';
                card.innerHTML = `
                    <div class="friend-avatar">👤</div>
                    <div class="friend-info">
                        <div class="friend-name">${escapeHtml(u.username)}</div>
                        <div class="friend-stats">${toPersianDigits(u.elo)} ELO · ${toPersianDigits(u.wins)} برد</div>
                    </div>
                    <div class="friend-actions">
                        <button class="btn btn-primary btn-sm" data-action="add-friend" data-username="${escapeHtml(u.username)}">دعوت</button>
                        <button class="btn btn-ghost btn-sm" data-action="view-profile" data-username="${escapeHtml(u.username)}">پروفایل</button>
                    </div>
                `;
                results.appendChild(card);
            });
        } catch (e) {
            results.innerHTML = '<p class="empty-state">خطا در جستجو</p>';
        }
    }

    async function addFriend(username) {
        try {
            await Online.sendFriendRequest(username);
            if (UI && UI.toast) UI.toast(`درخواست دوستی به ${username} ارسال شد`);
        } catch (e) {
            if (UI && UI.toast) UI.toast(e.message);
        }
    }

    async function acceptFriend(username) {
        try {
            await Online.acceptFriendRequest(username);
            if (UI && UI.toast) UI.toast(`${username} به دوستان اضافه شد`);
            await refreshFriends();
            await refreshFriendRequests();
        } catch (e) {
            if (UI && UI.toast) UI.toast(e.message);
        }
    }

    async function rejectFriend(username) {
        try {
            await Online.rejectFriendRequest(username);
            await refreshFriendRequests();
        } catch (e) {
            if (UI && UI.toast) UI.toast(e.message);
        }
    }

    async function removeFriend(username) {
        if (!confirm(`حذف ${username} از دوستان؟`)) return;
        try {
            await Online.removeFriend(username);
            if (UI && UI.toast) UI.toast(`${username} حذف شد`);
            await refreshFriends();
        } catch (e) {
            if (UI && UI.toast) UI.toast(e.message);
        }
    }

    function switchFriendsTab(tab) {
        $$('.friends-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        $$('.friends-tab-content').forEach(c => c.classList.remove('active'));
        if (tab === 'friends') $('#friendsListContent').classList.add('active');
        else if (tab === 'requests') $('#friendsRequestsContent').classList.add('active');
        else if (tab === 'search') $('#friendsSearchContent').classList.add('active');
    }

    /* ---------- Profile screen (v5) ---------- */

    async function showProfile(username) {
        UI.showScreen('profile');
        const container = $('#profileContainer');
        if (!container) return;
        container.innerHTML = '<p class="empty-state">در حال بارگذاری...</p>';
        try {
            const profile = await Online.getProfile(username);
            const tiers = [
                { min: 2400, icon: '💎', name: 'الماس' },
                { min: 2000, icon: '🥈', name: 'پلاتین' },
                { min: 1700, icon: '🥇', name: 'طلایی' },
                { min: 1400, icon: '⚪', name: 'نقره‌ای' },
                { min: 0, icon: '🥉', name: 'برنزی' },
            ];
            const tier = tiers.find(t => profile.elo >= t.min);
            const total = profile.wins + profile.losses + profile.draws;
            const winRate = total > 0 ? Math.round(profile.wins / total * 100) : 0;
            const me = Online.getUser();
            const isMe = me && me.username === username;
            container.innerHTML = `
                <div class="profile-header">
                    <div class="profile-avatar-large">${tier.icon}</div>
                    <div class="profile-name">${escapeHtml(profile.username)}</div>
                    <div class="profile-tier">${tier.icon} ${tier.name} · ${toPersianDigits(profile.elo)} ELO</div>
                </div>
                <div class="profile-stats-grid">
                    <div class="profile-stat-tile">
                        <div class="profile-stat-value">${toPersianDigits(profile.wins)}</div>
                        <div class="profile-stat-label">برد</div>
                    </div>
                    <div class="profile-stat-tile">
                        <div class="profile-stat-value">${toPersianDigits(profile.losses)}</div>
                        <div class="profile-stat-label">باخت</div>
                    </div>
                    <div class="profile-stat-tile">
                        <div class="profile-stat-value">${toPersianDigits(profile.draws)}</div>
                        <div class="profile-stat-label">مساوی</div>
                    </div>
                    <div class="profile-stat-tile">
                        <div class="profile-stat-value">${toPersianDigits(winRate)}٪</div>
                        <div class="profile-stat-label">درصد برد</div>
                    </div>
                </div>
                ${!isMe ? `
                    <div class="profile-actions">
                        <button class="btn btn-primary" data-action="add-friend" data-username="${escapeHtml(profile.username)}">➕ افزودن به دوستان</button>
                        <button class="btn btn-ghost" data-action="go-friends">بازگشت</button>
                    </div>
                ` : ''}
            `;
        } catch (e) {
            container.innerHTML = '<p class="empty-state">کاربر یافت نشد</p>';
        }
    }

    /* ---------- Leaderboard (v5) ---------- */

    async function showLeaderboard() {
        UI.showScreen('leaderboard');
        const list = $('#globalLeaderboard');
        if (!list) return;
        list.innerHTML = '<p class="empty-state">در حال بارگذاری...</p>';
        try {
            const board = await Online.getLeaderboard();
            if (!board || board.length === 0) {
                list.innerHTML = '<p class="empty-state">هنوز بازیکنی ثبت نشده</p>';
                return;
            }
            const me = Online.getUser();
            list.innerHTML = '';
            board.forEach((u, i) => {
                const row = document.createElement('div');
                const isMe = me && me.username === u.username;
                row.className = 'leaderboard-row' + (isMe ? ' is-me' : '');
                row.dataset.username = u.username;
                row.innerHTML = `
                    <div class="leaderboard-rank">${toPersianDigits(i + 1)}</div>
                    <div class="leaderboard-name">${escapeHtml(u.username)}${isMe ? ' (شما)' : ''}</div>
                    <div class="leaderboard-score">${toPersianDigits(u.elo)} ELO · ${toPersianDigits(u.wins)} برد</div>
                `;
                row.addEventListener('click', () => showProfile(u.username));
                list.appendChild(row);
            });
        } catch (e) {
            list.innerHTML = '<p class="empty-state">برای مشاهده جدول برترین‌ها وارد شوید</p>';
        }
    }

    /* ---------- Helpers ---------- */
    function escapeHtml(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    /* ---------- Tournament screen (v6) ---------- */

    async function showTournament() {
        UI.showScreen('tournament');
        const container = $('#tournamentContainer');
        if (!container) return;
        container.innerHTML = '<p class="empty-state">در حال بارگذاری...</p>';
        try {
            const info = await Online.getTournament();
            const statusLabels = {
                signup: 'در حال ثبت‌نام',
                running: 'در حال اجرا',
                finished: 'پایان یافته',
            };
            const statusColors = {
                signup: 'var(--success)',
                running: 'var(--warning)',
                finished: 'var(--text-muted)',
            };
            const me = Online.getUser();
            const isParticipant = me && info.participantsCount > 0; // simplified
            container.innerHTML = `
                <div class="tournament-header">
                    <div class="tournament-name">${escapeHtml(info.name)}</div>
                    <div class="tournament-status" style="color:${statusColors[info.status] || '#fff'}">${statusLabels[info.status] || info.status}</div>
                    ${info.status === 'signup' && me ? `
                        <div class="tournament-actions">
                            <button class="btn btn-sm" data-action="signup-tournament">📝 ثبت‌نام</button>
                        </div>
                    ` : ''}
                    ${info.status === 'signup' && me ? `
                        <div class="tournament-actions">
                            <button class="btn btn-sm" data-action="start-tournament">🚀 شروع تورنمنت</button>
                        </div>
                    ` : ''}
                </div>
                <div class="tournament-stats">
                    <div class="tournament-stat-tile">
                        <div class="tournament-stat-value">${toPersianDigits(info.participantsCount)}</div>
                        <div class="tournament-stat-label">شرکت‌کننده</div>
                    </div>
                    <div class="tournament-stat-tile">
                        <div class="tournament-stat-value">${info.bracket ? toPersianDigits(info.bracket.length) : '۰'}</div>
                        <div class="tournament-stat-label">دور</div>
                    </div>
                    <div class="tournament-stat-tile">
                        <div class="tournament-stat-value">${info.currentRound ? toPersianDigits(info.currentRound + 1) : '—'}</div>
                        <div class="tournament-stat-label">دور فعلی</div>
                    </div>
                </div>
                ${info.champion ? `
                    <div class="tournament-header" style="background:linear-gradient(135deg,#f59e0b,#fbbf24);margin-bottom:16px">
                        <div style="font-size:48px">🏆</div>
                        <div class="tournament-name">قهرمان: ${escapeHtml(info.champion)}</div>
                    </div>
                ` : ''}
                ${info.bracket && info.bracket.length > 0 ? `
                    <div class="tournament-bracket">
                        ${info.bracket.map((round, ri) => `
                            <div class="bracket-round">
                                <div class="bracket-round-title">دور ${toPersianDigits(ri + 1)}</div>
                                ${round.map(match => `
                                    <div class="bracket-match ${match.status === 'bye' ? 'bye' : match.status === 'pending' ? 'pending' : ''} ${match.winner === match.player1 ? 'winner-p1' : match.winner === match.player2 ? 'winner-p2' : ''}">
                                        <span class="bracket-player ${match.winner === match.player1 ? 'won' : match.winner && match.winner !== match.player1 ? 'lost' : ''}">${match.player1 ? escapeHtml(match.player1) : '—'}</span>
                                        <span style="color:var(--text-muted)">vs</span>
                                        <span class="bracket-player ${match.winner === match.player2 ? 'won' : match.winner && match.winner !== match.player2 ? 'lost' : ''}">${match.player2 ? escapeHtml(match.player2) : '—'}</span>
                                    </div>
                                `).join('')}
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            `;
        } catch (e) {
            container.innerHTML = '<p class="empty-state">سرور در دسترس نیست</p>';
        }
    }

    async function signupTournament() {
        try {
            await Online.signupTournament();
            if (UI && UI.toast) UI.toast('در تورنمنت ثبت‌نام شدید!');
            await showTournament();
        } catch (e) {
            if (UI && UI.toast) UI.toast(e.message);
        }
    }

    async function startTournament() {
        try {
            await Online.startTournament();
            if (UI && UI.toast) UI.toast('تورنمنت شروع شد!');
            await showTournament();
        } catch (e) {
            if (UI && UI.toast) UI.toast(e.message);
        }
    }

    /* ---------- League screen (v6) ---------- */

    async function showLeague() {
        UI.showScreen('league');
        const container = $('#leagueContainer');
        if (!container) return;
        container.innerHTML = '<p class="empty-state">در حال بارگذاری...</p>';
        try {
            const [season, myStats] = await Promise.all([
                Online.getLeagueSeason(),
                Online.isLoggedIn() ? Online.getMyLeagueStats().catch(() => null) : Promise.resolve(null),
            ]);
            const tiers = [
                { name: 'برنز', icon: '🥉' },
                { name: 'نقره', icon: '⚪' },
                { name: 'طلا', icon: '🥇' },
                { name: 'پلاتین', icon: '🥈' },
                { name: 'الماس', icon: '💎' },
            ];
            container.innerHTML = `
                <div class="league-header">
                    <div class="league-season-num">فصل ${toPersianDigits(season.number)}</div>
                    <div class="league-days-left">${toPersianDigits(season.daysLeft)}</div>
                    <div class="league-days-label">روز تا پایان فصل</div>
                </div>
                ${myStats ? `
                    <div class="league-my-stats">
                        <div class="league-my-tier">
                            <div class="league-tier-icon">${myStats.tierIcon || '🥉'}</div>
                            <div class="league-tier-info">
                                <div class="league-tier-name">${escapeHtml(myStats.tier || 'برنز')}</div>
                                <div class="league-tier-rank">رتبه ${toPersianDigits(myStats.rankInTier)} از ${toPersianDigits(myStats.tierSize)}</div>
                            </div>
                        </div>
                        <div class="league-season-elo">${toPersianDigits(myStats.seasonElo)} ELO</div>
                        <div class="profile-stats-grid">
                            <div class="profile-stat-tile">
                                <div class="profile-stat-value">${toPersianDigits(myStats.wins)}</div>
                                <div class="profile-stat-label">برد</div>
                            </div>
                            <div class="profile-stat-tile">
                                <div class="profile-stat-value">${toPersianDigits(myStats.losses)}</div>
                                <div class="profile-stat-label">باخت</div>
                            </div>
                            <div class="profile-stat-tile">
                                <div class="profile-stat-value">${toPersianDigits(myStats.draws)}</div>
                                <div class="profile-stat-label">مساوی</div>
                            </div>
                            <div class="profile-stat-tile">
                                <div class="profile-stat-value">${toPersianDigits(myStats.gamesPlayed)}</div>
                                <div class="profile-stat-label">بازی</div>
                            </div>
                        </div>
                    </div>
                ` : '<p class="empty-state">برای مشاهده آمار فصلی وارد شوید</p>'}
                <div class="league-tiers-grid">
                    ${tiers.map(t => `
                        <div class="league-tier-card ${myStats && myStats.tier === t.name ? 'active' : ''}">
                            <div class="league-tier-card-icon">${t.icon}</div>
                            <div class="league-tier-card-name">${t.name}</div>
                        </div>
                    `).join('')}
                </div>
                <div class="tournament-stats">
                    <div class="tournament-stat-tile">
                        <div class="tournament-stat-value">${toPersianDigits(season.totalPlayers || 0)}</div>
                        <div class="tournament-stat-label">بازیکن فعال</div>
                    </div>
                </div>
            `;
        } catch (e) {
            container.innerHTML = '<p class="empty-state">سرور در دسترس نیست</p>';
        }
    }

    /* ---------- Spectate screen (v6) ---------- */

    let currentSpectateRoom = null;

    async function showSpectate() {
        UI.showScreen('spectate');
        const list = $('#spectateGamesList');
        if (!list) return;
        list.innerHTML = '<p class="empty-state">در حال بارگذاری...</p>';
        try {
            const games = await Online.getSpectateGames();
            if (games.length === 0) {
                list.innerHTML = '<p class="empty-state">بازی زنده‌ای برای تماشا وجود ندارد</p>';
                return;
            }
            list.innerHTML = '';
            games.forEach(g => {
                const card = document.createElement('div');
                card.className = 'spectate-game-card';
                card.innerHTML = `
                    <div class="spectate-eye">👁️</div>
                    <div class="spectate-players">
                        <div class="spectate-vs">${escapeHtml(g.player1)} vs ${escapeHtml(g.player2)}</div>
                        <div class="spectate-meta">${toPersianDigits(g.spectators)} تماشاچی · حرکت ${toPersianDigits(g.moveCount)}</div>
                    </div>
                    <div style="font-size:20px;color:var(--accent)">▶</div>
                `;
                card.addEventListener('click', () => joinSpectate(g.roomId, g.player1, g.player2));
                list.appendChild(card);
            });
        } catch (e) {
            list.innerHTML = '<p class="empty-state">سرور در دسترس نیست</p>';
        }
    }

    function joinSpectate(roomId, player1, player2) {
        currentSpectateRoom = roomId;
        // Build spectate board
        const board = $('#spectateBoard');
        if (board) {
            board.innerHTML = '';
            for (let i = 0; i < 9; i++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                board.appendChild(cell);
            }
        }
        $('#spectateScoreNameX').textContent = player1;
        $('#spectateScoreNameO').textContent = player2;
        $('#spectateViewerTitle').textContent = 'تماشا · ' + player1 + ' vs ' + player2;
        UI.showScreen('spectateViewer');
        // Join spectator room (socket event handlers are in online.js)
        Online.spectateJoin(roomId);
    }

    function leaveSpectate() {
        if (currentSpectateRoom) {
            Online.spectateLeave(currentSpectateRoom);
            currentSpectateRoom = null;
        }
        UI.showScreen('spectate');
    }

    function handleSpectateState(data) {
        // Update board
        const cells = document.querySelectorAll('#spectateBoard .cell');
        if (!cells.length) return;
        cells.forEach((cell, i) => {
            cell.classList.remove('x', 'o', 'filled');
            const oldMark = cell.querySelector('.mark');
            if (oldMark) oldMark.remove();
            const val = data.board[i];
            if (val) {
                cell.classList.add(val, 'filled');
                const mark = document.createElement('span');
                mark.className = 'mark';
                mark.textContent = val === 'x' ? '×' : '○';
                mark.style.animation = 'none';
                cell.appendChild(mark);
            }
        });
        const countEl = document.getElementById('spectatorCount');
        if (countEl) countEl.textContent = toPersianDigits(data.spectators || 0);
        // Update active player
        document.getElementById('spectateScoreCardX')?.classList.toggle('active', data.currentPlayer === 'x');
        document.getElementById('spectateScoreCardO')?.classList.toggle('active', data.currentPlayer === 'o');
    }

    function handleSpectateMove(data) {
        handleSpectateState(data);
    }

    function handleSpectateEnd(data) {
        const cells = document.querySelectorAll('#spectateBoard .cell');
        if (data.line && cells.length) {
            data.line.forEach(idx => cells[idx]?.classList.add('winning', data.winner));
        }
        const msg = data.winner ? `برنده: ${data.winner === 'x' ? 'X' : 'O'}` : 'مساوی';
        if (UI && UI.toast) UI.toast('بازی پایان یافت - ' + msg);
    }

    function handleSpectateEmote(data) {
        const display = document.getElementById('spectateEmoteDisplay');
        if (!display) return;
        const popup = document.createElement('div');
        popup.className = 'emote-popup';
        popup.textContent = data.emote;
        popup.style.left = (Math.random() * 200 - 100) + 'px';
        display.appendChild(popup);
        setTimeout(() => popup.remove(), 1800);
    }

    function sendSpectateEmote(emote) {
        if (currentSpectateRoom) {
            Online.spectateEmote(currentSpectateRoom, emote);
            handleSpectateEmote({ emote });
        }
    }

    /* ---------- Analysis (v6) ---------- */

    async function analyzeCurrentGame() {
        // Get last game from storage
        const lastGame = Storage.getLastGame();
        if (!lastGame || !lastGame.moves || lastGame.moves.length === 0) {
            if (UI && UI.toast) UI.toast('بازی‌ای برای تحلیل وجود ندارد');
            return;
        }
        const modal = $('#analysisModal');
        const summary = $('#analysisSummary');
        const gradeEl = $('#analysisGrade');
        const insights = $('#analysisInsights');
        if (!modal) return;
        summary.innerHTML = '<p class="empty-state">در حال تحلیل...</p>';
        gradeEl.innerHTML = '';
        insights.innerHTML = '';
        modal.classList.add('active');
        try {
            // Try server analysis first
            let result;
            try {
                result = await Online.analyzeGame(lastGame.moves, lastGame.boardSize || 3);
            } catch (e) {
                // Fallback to local analysis using AI module
                result = localAnalysis(lastGame.moves, lastGame.boardSize || 3);
            }
            summary.innerHTML = `
                <div class="analysis-stat">
                    <div class="analysis-stat-value">${toPersianDigits(result.totalMoves)}</div>
                    <div class="analysis-stat-label">کل حرکات</div>
                </div>
                <div class="analysis-stat">
                    <div class="analysis-stat-value" style="color:var(--success)">${toPersianDigits(result.excellentMoves)}</div>
                    <div class="analysis-stat-label">حرکت عالی</div>
                </div>
                <div class="analysis-stat">
                    <div class="analysis-stat-value" style="color:var(--danger)">${toPersianDigits(result.mistakes)}</div>
                    <div class="analysis-stat-label">اشتباه</div>
                </div>
            `;
            const gradeClass = 'grade-' + result.grade.toLowerCase().replace('+', '');
            gradeEl.innerHTML = `
                <div class="grade-badge ${gradeClass}">${result.grade}</div>
                <div style="margin-top:8px;color:var(--text-secondary);font-size:13px">دقت: ${toPersianDigits(result.accuracy)}٪</div>
            `;
            if (result.insights && result.insights.length > 0) {
                insights.innerHTML = result.insights.map(ins => `
                    <div class="insight-item ${ins.type}">
                        <strong>${escapeHtml(ins.description)}</strong>
                    </div>
                `).join('');
            } else {
                insights.innerHTML = '<p class="empty-state" style="padding:12px">حرکت قابل توجه‌ای یافت نشد. بازی عالی!</p>';
            }
        } catch (e) {
            summary.innerHTML = '<p class="empty-state">خطا در تحلیل</p>';
        }
    }

    /**
     * Local fallback analysis using the client-side AI module.
     */
    function localAnalysis(moves, boardSize) {
        const winLength = boardSize === 3 ? 3 : 4;
        let excellent = 0;
        let mistakes = 0;
        const insights = [];
        const board = new Array(boardSize * boardSize).fill(null);
        moves.forEach((move, i) => {
            const bestMove = AI.getHint(board.slice(), move.player, boardSize, winLength);
            if (bestMove === move.index) {
                excellent++;
            } else {
                // Check if missed a win
                const trialWin = board.slice();
                trialWin[move.index] = move.player;
                const winResult = Game.checkWinner(trialWin, boardSize, winLength);
                if (!winResult.winner && bestMove !== undefined && bestMove !== move.index) {
                    mistakes++;
                    insights.push({
                        moveNumber: i + 1,
                        player: move.player,
                        playedIndex: move.index,
                        bestIndex: bestMove,
                        type: 'suboptimal',
                        description: `حرکت ${i + 1}: ${move.player === 'x' ? 'X' : 'O'} بهتر بود خانه ${bestMove + 1} را بازی می‌کرد`,
                    });
                }
            }
            board[move.index] = move.player;
        });
        const accuracy = moves.length > 0 ? Math.round(excellent / moves.length * 100) : 0;
        let grade = 'F';
        if (accuracy >= 90) grade = 'A+';
        else if (accuracy >= 80) grade = 'A';
        else if (accuracy >= 70) grade = 'B';
        else if (accuracy >= 60) grade = 'C';
        else if (accuracy >= 50) grade = 'D';
        return {
            totalMoves: moves.length,
            excellentMoves: excellent,
            mistakes,
            accuracy,
            grade,
            insights,
        };
    }

    function closeAnalysis() {
        const modal = $('#analysisModal');
        if (modal) modal.classList.remove('active');
    }

    /* ---------- Shop screen (v7) ---------- */

    let shopCurrentTab = 'avatars';

    async function showShop() {
        UI.showScreen('shop');
        await refreshShop();
        // Setup tabs
        document.querySelectorAll('.shop-tab').forEach(tab => {
            tab.onclick = () => {
                shopCurrentTab = tab.dataset.shopTab;
                document.querySelectorAll('.shop-tab').forEach(t => t.classList.toggle('active', t === tab));
                renderShopItems();
            };
        });
    }

    async function refreshShop() {
        const coinsEl = $('#shopCoinsValue');
        if (!coinsEl) return;
        if (!Online.isLoggedIn()) {
            coinsEl.textContent = '۰';
            $('#shopItemsGrid').innerHTML = '<p class="empty-state">برای خرید وارد شوید</p>';
            return;
        }
        try {
            const coinsData = await Online.getCoins();
            coinsEl.textContent = toPersianDigits(coinsData.coins || 0);
            // Update home badge
            const badge = document.getElementById('coinsBadge');
            if (badge && coinsData.coins > 0) {
                badge.style.display = 'inline-block';
                badge.textContent = toPersianDigits(coinsData.coins);
            }
        } catch (e) {
            coinsEl.textContent = '۰';
        }
        await renderShopItems();
    }

    async function renderShopItems() {
        const grid = $('#shopItemsGrid');
        if (!grid) return;
        grid.innerHTML = '<p class="empty-state">در حال بارگذاری...</p>';
        try {
            if (shopCurrentTab === 'inventory') {
                // Show inventory
                const invData = await Online.getInventory();
                const inventory = invData.inventory || [];
                const equipped = invData.equipped || {};
                if (inventory.length === 0) {
                    grid.innerHTML = '<p class="empty-state">کیف شما خالی است</p>';
                    return;
                }
                grid.innerHTML = '';
                inventory.forEach(item => {
                    const isEquipped = equipped[item.type] === item.value;
                    const card = document.createElement('div');
                    card.className = 'shop-item-card' + (isEquipped ? ' equipped' : '');
                    const preview = item.type === 'theme'
                        ? `<div style="width:40px;height:40px;border-radius:50%;background:var(--accent);margin:0 auto 8px"></div>`
                        : `<div class="shop-item-preview">${item.value}</div>`;
                    card.innerHTML = `
                        ${preview}
                        <div class="shop-item-name">${escapeHtml(item.name)}</div>
                        <div class="shop-item-rarity rarity-${item.type}">${item.type}</div>
                        <div class="shop-item-actions">
                            ${isEquipped
                                ? '<button class="btn btn-ghost" disabled>فعال</button>'
                                : `<button class="btn btn-primary" data-equip-type="${item.type}" data-equip-value="${item.value}">فعال‌کردن</button>`
                            }
                        </div>
                    `;
                    const btn = card.querySelector('[data-equip-type]');
                    if (btn) {
                        btn.onclick = () => equipShopItem(btn.dataset.equipType, btn.dataset.equipValue);
                    }
                    grid.appendChild(card);
                });
                return;
            }
            // Show shop items filtered by tab
            const items = await Online.getShopItems();
            const invData = Online.isLoggedIn() ? await Online.getInventory().catch(() => ({ inventory: [] })) : { inventory: [] };
            const ownedItems = (invData.inventory || []).map(i => i.type + ':' + i.value);
            const coins = Online.isLoggedIn() ? (await Online.getCoins().catch(() => ({ coins: 0 }))).coins : 0;
            const filtered = items.filter(i => {
                if (shopCurrentTab === 'avatars') return i.type === 'avatar';
                if (shopCurrentTab === 'themes') return i.type === 'theme';
                if (shopCurrentTab === 'emotes') return i.type === 'emote';
                return false;
            });
            if (filtered.length === 0) {
                grid.innerHTML = '<p class="empty-state">آیتمی یافت نشد</p>';
                return;
            }
            grid.innerHTML = '';
            filtered.forEach(item => {
                const owned = ownedItems.includes(item.type + ':' + item.value);
                const affordable = coins >= item.price;
                const card = document.createElement('div');
                card.className = 'shop-item-card' + (owned ? ' owned' : '');
                const preview = item.type === 'theme'
                    ? `<div style="width:40px;height:40px;border-radius:50%;background:var(--swatch-color, var(--accent));margin:0 auto 8px;background:${getThemeColor(item.value)}</div>`
                    : `<div class="shop-item-preview">${item.value}</div>`;
                card.innerHTML = `
                    ${preview}
                    <div class="shop-item-name">${escapeHtml(item.name)}</div>
                    <div class="shop-item-rarity rarity-${item.rarity}">${item.rarity}</div>
                    <div class="shop-item-price ${affordable ? '' : 'unaffordable'}">🪙 ${toPersianDigits(item.price)}</div>
                    <div class="shop-item-actions">
                        ${owned
                            ? '<button class="btn btn-ghost" disabled>دارد</button>'
                            : `<button class="btn btn-primary" data-item-id="${item.id}" ${affordable ? '' : 'disabled'}>خرید</button>`
                        }
                    </div>
                `;
                const btn = card.querySelector('[data-item-id]');
                if (btn) {
                    btn.onclick = () => purchaseShopItem(item.id, item.name);
                }
                grid.appendChild(card);
            });
        } catch (e) {
            grid.innerHTML = '<p class="empty-state">سرور در دسترس نیست</p>';
        }
    }

    function getThemeColor(value) {
        const colors = {
            indigo: '#6366f1', emerald: '#10b981', rose: '#f43f5e',
            amber: '#f59e0b', cyan: '#06b6d4', violet: '#8b5cf6',
        };
        return colors[value] || 'var(--accent)';
    }

    async function purchaseShopItem(itemId, itemName) {
        try {
            const result = await Online.purchaseItem(itemId);
            if (UI && UI.toast) UI.toast(`${itemName} خریداری شد! 🎉`);
            await refreshShop();
        } catch (e) {
            if (UI && UI.toast) UI.toast(e.message);
        }
    }

    async function equipShopItem(type, value) {
        try {
            await Online.equipItem(type, value);
            if (UI && UI.toast) UI.toast('فعال شد!');
            await renderShopItems();
        } catch (e) {
            if (UI && UI.toast) UI.toast(e.message);
        }
    }

    /* ---------- Battle Pass screen (v7) ---------- */

    async function showBattlePass() {
        UI.showScreen('battlepass');
        const container = $('#battlepassContainer');
        if (!container) return;
        container.innerHTML = '<p class="empty-state">در حال بارگذاری...</p>';
        if (!Online.isLoggedIn()) {
            container.innerHTML = '<p class="empty-state">برای مشاهده Battle Pass وارد شوید</p>';
            return;
        }
        try {
            const [info, bp] = await Promise.all([
                Online.getBattlePassInfo(),
                Online.getBattlePass(),
            ]);
            const progress = bp.progress || 0;
            container.innerHTML = `
                <div class="bp-header">
                    <div class="bp-season-num">Battle Pass فصل ${toPersianDigits(info.season)}</div>
                    <div class="bp-level-display">لول ${toPersianDigits(bp.level)}</div>
                    <div class="bp-level-label">${toPersianDigits(info.daysLeft)} روز تا پایان</div>
                    <div class="bp-progress-bar">
                        <div class="bp-progress-fill" style="width:${progress * 100}%"></div>
                    </div>
                    <div class="bp-progress-text">${toPersianDigits(bp.xpInLevel)} / ${toPersianDigits(bp.xpForNext)} XP</div>
                </div>
                <div class="bp-premium-banner ${bp.premium ? 'active' : ''}">
                    <div class="bp-premium-icon">${bp.premium ? '✅' : '👑'}</div>
                    <div class="bp-premium-info">
                        <div class="bp-premium-title">${bp.premium ? 'پرمیوم فعال' : 'پرمیوم فعال نیست'}</div>
                        <div class="bp-premium-desc">${bp.premium ? 'از تمام پاداش‌ها استفاده کنید' : 'برای پاداش‌های ویژه، از فروشگاه پرمیوم بخرید'}</div>
                    </div>
                    ${!bp.premium ? '<button class="btn btn-primary btn-sm" data-action="go-shop">خرید</button>' : ''}
                </div>
                <div class="bp-tracks">
                    <div class="bp-track-header level">لول</div>
                    <div class="bp-track-header free">رایگان</div>
                    <div class="bp-track-header premium">پرمیوم</div>
                    ${renderBpLevels(bp)}
                </div>
            `;
            // Bind claim buttons
            container.querySelectorAll('[data-claim-track]').forEach(btn => {
                btn.onclick = () => claimBpReward(btn.dataset.claimTrack, parseInt(btn.dataset.claimLevel, 10));
            });
        } catch (e) {
            container.innerHTML = '<p class="empty-state">سرور در دسترس نیست</p>';
        }
    }

    function renderBpLevels(bp) {
        let html = '';
        const maxLevels = bp.maxLevel || 50;
        for (let lvl = 1; lvl <= maxLevels; lvl++) {
            const freeReward = bp.freeRewards.find(r => r.level === lvl);
            const premReward = bp.premiumRewards.find(r => r.level === lvl);
            const freeClaimed = bp.claimed && bp.claimed.free && bp.claimed.free.includes(lvl);
            const premClaimed = bp.claimed && bp.claimed.premium && bp.claimed.premium.includes(lvl);
            const levelReached = bp.level >= lvl;
            const premUnlocked = bp.premium;
            html += `
                <div class="bp-level-cell">${toPersianDigits(lvl)}</div>
                ${renderBpCell(freeReward, freeClaimed, levelReached, true, lvl, 'free')}
                ${renderBpCell(premReward, premClaimed, levelReached && premUnlocked, premUnlocked, lvl, 'premium')}
            `;
        }
        return html;
    }

    function renderBpCell(reward, claimed, canClaim, unlocked, level, track) {
        if (!reward) return '<div class="bp-reward-cell">—</div>';
        const classes = ['bp-reward-cell', track];
        if (claimed) classes.push('claimed');
        else if (canClaim) classes.push('claimable');
        else if (!unlocked) classes.push('locked');
        const icon = reward.type === 'coins' ? '🪙' : reward.value;
        return `
            <div class="${classes.join(' ')}" data-claim-track="${track}" data-claim-level="${level}">
                <div class="bp-reward-icon">${icon}</div>
                <div class="bp-reward-name">${escapeHtml(reward.name)}</div>
                ${claimed ? '<div style="font-size:8px;color:var(--success)">✓ گرفته شد</div>' : ''}
                ${canClaim && !claimed ? '<div style="font-size:8px;color:var(--success)">claim کنید!</div>' : ''}
            </div>
        `;
    }

    async function claimBpReward(track, level) {
        try {
            const result = await Online.claimBattlePassReward(track, level);
            if (result.reward) {
                if (UI && UI.toast) UI.toast(`پاداش دریافت شد: ${result.reward.name} 🎉`);
            }
            await showBattlePass();
        } catch (e) {
            if (UI && UI.toast) UI.toast(e.message);
        }
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
        // v5
        showFriendsScreen,
        refreshFriends,
        refreshFriendRequests,
        searchUsers,
        addFriend,
        acceptFriend,
        rejectFriend,
        removeFriend,
        switchFriendsTab,
        showProfile,
        showLeaderboard,
        // v6
        showTournament,
        signupTournament,
        startTournament,
        showLeague,
        showSpectate,
        leaveSpectate,
        sendSpectateEmote,
        analyzeCurrentGame,
        closeAnalysis,
        handleSpectateState,
        handleSpectateMove,
        handleSpectateEnd,
        handleSpectateEmote,
        // v7
        showShop,
        showBattlePass,
    };
})();
