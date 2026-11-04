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
    };
})();
