/* ============================================
   UI.JS - DOM rendering & interactions for Doz v2
   All DOM manipulation lives here.
   ============================================ */

const UI = (function () {
    const $ = (sel, root = document) => root.querySelector(sel);
    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

    const screens = {
        home: $('#homeScreen'),
        modeSelect: $('#modeSelectScreen'),
        setup: $('#setupScreen'),
        game: $('#gameScreen'),
        stats: $('#statsScreen'),
        settings: $('#settingsScreen'),
        help: $('#helpScreen'),
        achievements: $('#achievementsScreen'),
        replay: $('#replayScreen'),
    };

    const els = {
        // Home
        themeToggle: $('#themeToggle'),
        achievementBadge: $('#achievementBadge'),
        replayMenuBtn: $('#replayMenuBtn'),
        // Setup
        player1Name: $('#player1Name'),
        player2Name: $('#player2Name'),
        player2Label: $('#player2Label'),
        player2SetupCard: $('#player2SetupCard'),
        winTargetControl: $('#winTargetControl'),
        starterControl: $('#starterControl'),
        starterRow: $('#starterRow'),
        timerControl: $('#timerControl'),
        timerRow: $('#timerRow'),
        avatarXBtn: $('#avatarXBtn'),
        avatarOBtn: $('#avatarOBtn'),
        avatarX: $('#avatarX'),
        avatarO: $('#avatarO'),
        // Game
        board: $('#board'),
        cells: $$('#board .cell'),
        winningLine: $('#winningLine'),
        matchTitle: $('#matchTitle'),
        scoreNameX: $('#scoreNameX'),
        scoreNameO: $('#scoreNameO'),
        scoreValueX: $('#scoreValueX'),
        scoreValueO: $('#scoreValueO'),
        scoreCardX: $('#scoreCardX'),
        scoreCardO: $('#scoreCardO'),
        scoreAvatarX: $('#scoreAvatarX'),
        scoreAvatarO: $('#scoreAvatarO'),
        drawsValue: $('#drawsValue'),
        roundNumber: $('#roundNumber'),
        turnText: $('#turnText'),
        turnIndicator: $('#turnIndicator'),
        moveTimer: $('#moveTimer'),
        timerValue: $('#timerValue'),
        timerFgCircle: $('#timerFgCircle'),
        undoBtn: $('#undoBtn'),
        soundBtn: $('#soundBtn'),
        hintsBtn: $('#hintsBtn'),
        historyPanel: $('#historyPanel'),
        historyList: $('#historyList'),
        historyToggle: $$('.history-toggle'),
        // Modals
        roundEndModal: $('#roundEndModal'),
        roundEndIcon: $('#roundEndIcon'),
        roundEndTitle: $('#roundEndTitle'),
        roundEndSubtitle: $('#roundEndSubtitle'),
        roundEndStats: $('#roundEndStats'),
        matchEndModal: $('#matchEndModal'),
        matchEndTitle: $('#matchEndTitle'),
        matchEndSubtitle: $('#matchEndSubtitle'),
        matchEndStats: $('#matchEndStats'),
        celebrateConfetti: $('#celebrateConfetti'),
        avatarPickerModal: $('#avatarPickerModal'),
        avatarPickerTitle: $('#avatarPickerTitle'),
        avatarGrid: $('#avatarGrid'),
        onboardingModal: $('#onboardingModal'),
        onboardingSlides: $('#onboardingSlides'),
        onboardingDots: $('#onboardingDots'),
        onboardingNextBtn: $('#onboardingNextBtn'),
        resumeModal: $('#resumeModal'),
        // Stats
        statTotalGames: $('#statTotalGames'),
        statWins: $('#statWins'),
        statLosses: $('#statLosses'),
        statDraws: $('#statDraws'),
        statWinRate: $('#statWinRate'),
        statStreak: $('#statStreak'),
        leaderboardList: $('#leaderboardList'),
        donutChart: $('#donutChart'),
        resultsChart: $('#resultsChart'),
        diffEasyW: $('#diffEasyW'),
        diffEasyL: $('#diffEasyL'),
        diffEasyD: $('#diffEasyD'),
        diffMediumW: $('#diffMediumW'),
        diffMediumL: $('#diffMediumL'),
        diffMediumD: $('#diffMediumD'),
        diffHardW: $('#diffHardW'),
        diffHardL: $('#diffHardL'),
        diffHardD: $('#diffHardD'),
        importFile: $('#importFile'),
        // Achievements
        achUnlocked: $('#achUnlocked'),
        achTotal: $('#achTotal'),
        achProgressFill: $('#achProgressFill'),
        achievementsGrid: $('#achievementsGrid'),
        // Replay
        replayBoard: $('#replayBoard'),
        replayCells: $$('#replayBoard .cell'),
        replayWinningLine: $('#replayWinningLine'),
        replayInfo: $('#replayInfo'),
        replayStep: $('#replayStep'),
        replayPlayBtn: $('#replayPlayBtn'),
        // Settings
        themeControl: $('#themeControl'),
        boardColorSwatches: $('#boardColorSwatches'),
        soundEnabled: $('#soundEnabled'),
        volumeRange: $('#volumeRange'),
        animationsEnabled: $('#animationsEnabled'),
        hapticsEnabled: $('#hapticsEnabled'),
        hintsEnabled: $('#hintsEnabled'),
        colorBlindMode: $('#colorBlindMode'),
        highContrastMode: $('#highContrastMode'),
        // Toast
        toastContainer: $('#toastContainer'),
        // Difficulty pills
        difficultyPills: $$('.pill'),
    };

    /* ---------- Screen navigation ---------- */

    function showScreen(name) {
        Object.values(screens).forEach(s => s && s.classList.remove('active'));
        if (screens[name]) screens[name].classList.add('active');
        if (screens[name]) screens[name].scrollTop = 0;
    }

    /* ---------- Board rendering ---------- */

    function renderBoard(board, lastMove = null, cells = els.cells) {
        cells.forEach((cell, i) => {
            cell.classList.remove('x', 'o', 'filled', 'winning', 'hint');
            const oldMark = cell.querySelector('.mark');
            if (oldMark) oldMark.remove();
            const oldNum = cell.querySelector('.cell-number');
            if (oldNum) oldNum.remove();

            const val = board[i];
            if (val) {
                cell.classList.add(val, 'filled');
                const mark = document.createElement('span');
                mark.className = 'mark';
                mark.textContent = val === 'x' ? '×' : '○';
                cell.appendChild(mark);

                if (lastMove !== i) {
                    mark.style.animation = 'none';
                    mark.style.opacity = '1';
                }
            }

            const num = document.createElement('span');
            num.className = 'cell-number';
            num.textContent = Game.cellLabel(i);
            cell.appendChild(num);
        });
    }

    function highlightWinning(line, winner, cells = els.cells, container = els.winningLine) {
        if (!line) return;
        line.forEach(idx => {
            if (cells[idx]) cells[idx].classList.add('winning', winner);
        });
        drawWinningLine(line, cells, container);
    }

    function drawWinningLine(line, cells = els.cells, container = els.winningLine) {
        container.innerHTML = '';
        if (!line || line.length < 3) return;

        const boardRect = cells[0].parentElement.getBoundingClientRect();
        const cell0 = cells[line[0]].getBoundingClientRect();
        const cell2 = cells[line[2]].getBoundingClientRect();

        const x1 = (cell0.left + cell0.width / 2) - boardRect.left;
        const y1 = (cell0.top + cell0.height / 2) - boardRect.top;
        const x2 = (cell2.left + cell2.width / 2) - boardRect.left;
        const y2 = (cell2.top + cell2.height / 2) - boardRect.top;

        const w = boardRect.width;
        const h = boardRect.height;

        container.innerHTML = `
            <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
                <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />
            </svg>
        `;
    }

    function clearWinningLine() {
        els.winningLine.innerHTML = '';
    }

    function clearHints() {
        els.cells.forEach(c => c.classList.remove('hint'));
    }

    function showHint(index) {
        clearHints();
        if (index >= 0 && index < els.cells.length) {
            els.cells[index].classList.add('hint');
            setTimeout(clearHints, 2000);
        }
    }

    function setBoardDisabled(disabled) {
        els.cells.forEach(c => {
            c.classList.toggle('disabled', disabled);
        });
    }

    /* ---------- Score / turn UI ---------- */

    function updateScore(xScore, oScore, draws, round) {
        els.scoreValueX.textContent = xScore;
        els.scoreValueO.textContent = oScore;
        els.drawsValue.textContent = draws;
        els.roundNumber.textContent = round;
    }

    function updatePlayerNames(nameX, nameO) {
        els.scoreNameX.textContent = nameX;
        els.scoreNameO.textContent = nameO;
    }

    function updateAvatars(avatarX, avatarO) {
        els.scoreAvatarX.textContent = avatarX;
        els.scoreAvatarO.textContent = avatarO;
        els.avatarX.textContent = avatarX;
        els.avatarO.textContent = avatarO;
    }

    function setActivePlayer(player) {
        els.scoreCardX.classList.toggle('active', player === 'x');
        els.scoreCardO.classList.toggle('active', player === 'o');
    }

    function setTurnText(text) {
        els.turnText.innerHTML = text;
    }

    function setMatchTitle(title) {
        els.matchTitle.textContent = title;
    }

    /* ---------- Move timer ---------- */

    function showTimer(show) {
        els.moveTimer.style.display = show ? 'block' : 'none';
    }

    function updateTimer(seconds, fraction) {
        els.timerValue.textContent = seconds;
        const circumference = 100.5; // 2 * PI * 16
        const offset = circumference * (1 - fraction);
        els.timerFgCircle.style.strokeDashoffset = offset;
        // Color states
        els.moveTimer.classList.remove('warn', 'danger');
        if (seconds <= 3) els.moveTimer.classList.add('danger');
        else if (seconds <= 6) els.moveTimer.classList.add('warn');
    }

    /* ---------- History ---------- */

    function renderHistory(moves) {
        els.historyList.innerHTML = '';
        if (!moves || moves.length === 0) {
            els.historyList.innerHTML = '<p class="empty-state" style="padding:8px;font-size:12px">حرکتی ثبت نشده</p>';
            return;
        }
        moves.forEach((m, i) => {
            const row = document.createElement('div');
            row.className = 'history-item';
            row.innerHTML = `
                <span class="move-num">#${i + 1}</span>
                <span class="move-mark ${m.player}">${m.player === 'x' ? '×' : '○'}</span>
                <span>خانه ${Game.cellLabel(m.index)} (${escapeHtml(m.playerName || '')})</span>
            `;
            els.historyList.appendChild(row);
        });
        els.historyList.scrollTop = els.historyList.scrollHeight;
    }

    function toggleHistoryPanel() {
        els.historyPanel.classList.toggle('collapsed');
    }

    /* ---------- Modal ---------- */

    function showRoundEnd({ icon, title, subtitle, stats }) {
        els.roundEndIcon.textContent = icon;
        els.roundEndTitle.textContent = title;
        els.roundEndSubtitle.textContent = subtitle;
        els.roundEndStats.innerHTML = stats;
        els.roundEndModal.classList.add('active');
    }

    function hideRoundEnd() {
        els.roundEndModal.classList.remove('active');
    }

    function showMatchEnd({ title, subtitle, stats }) {
        els.matchEndTitle.textContent = title;
        els.matchEndSubtitle.textContent = subtitle;
        els.matchEndStats.innerHTML = stats;
        els.matchEndModal.classList.add('active');
        spawnConfetti(els.celebrateConfetti, 40);
    }

    function hideMatchEnd() {
        els.matchEndModal.classList.remove('active');
    }

    function spawnConfetti(container, count) {
        container.innerHTML = '';
        const colors = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#06b6d4', '#8b5cf6'];
        for (let i = 0; i < count; i++) {
            const piece = document.createElement('div');
            piece.className = 'confetti-piece';
            piece.style.left = Math.random() * 100 + '%';
            piece.style.background = colors[Math.floor(Math.random() * colors.length)];
            piece.style.animationDelay = (Math.random() * 0.5) + 's';
            piece.style.animationDuration = (1.5 + Math.random() * 1.5) + 's';
            piece.style.transform = `rotate(${Math.random() * 360}deg)`;
            container.appendChild(piece);
        }
        setTimeout(() => { container.innerHTML = ''; }, 4000);
    }

    /* ---------- Toast ---------- */

    function toast(message, duration = 2700) {
        const t = document.createElement('div');
        t.className = 'toast';
        t.textContent = message;
        els.toastContainer.appendChild(t);
        setTimeout(() => t.remove(), duration);
    }

    function achievementToast(achievement) {
        const t = document.createElement('div');
        t.className = 'achievement-toast';
        t.innerHTML = `
            <div class="ach-toast-icon">${achievement.icon}</div>
            <div class="ach-toast-text">
                <div class="ach-toast-label">دستاورد جدید!</div>
                <div class="ach-toast-title">${escapeHtml(achievement.title)}</div>
            </div>
        `;
        els.toastContainer.appendChild(t);
        setTimeout(() => t.remove(), 4200);
    }

    /* ---------- Screen-shake / haptics ---------- */

    function shake(element = null) {
        const target = element || screens.game;
        target.classList.remove('shake');
        void target.offsetWidth;
        target.classList.add('shake');
    }

    function vibrate(pattern = 30) {
        if (navigator.vibrate && Storage.getSettings().hapticsEnabled) {
            try { navigator.vibrate(pattern); } catch (e) {}
        }
    }

    /* ---------- Settings sync ---------- */

    function syncSettingsUI(settings) {
        $$('#themeControl .seg-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.value === settings.theme);
        });
        $$('#boardColorSwatches .swatch').forEach(b => {
            b.classList.toggle('active', b.dataset.color === settings.accentColor);
        });
        els.soundEnabled.checked = settings.soundEnabled;
        els.volumeRange.value = settings.volume;
        els.animationsEnabled.checked = settings.animationsEnabled;
        els.hapticsEnabled.checked = settings.hapticsEnabled;
        els.hintsEnabled.checked = settings.hintsEnabled;
        els.colorBlindMode.checked = !!settings.colorBlindMode;
        els.highContrastMode.checked = false; // managed separately
    }

    function applyTheme(theme) {
        document.body.classList.remove('theme-light', 'theme-dark');
        if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.body.classList.add(prefersDark ? 'theme-dark' : 'theme-light');
        } else {
            document.body.classList.add('theme-' + theme);
        }
    }

    function applyAccentColor(color) {
        document.body.classList.remove(
            'theme-color-indigo', 'theme-color-emerald', 'theme-color-rose',
            'theme-color-amber', 'theme-color-cyan', 'theme-color-violet'
        );
        document.body.classList.add('theme-color-' + color);
    }

    function applyAnimations(enabled) {
        document.body.classList.toggle('no-animations', !enabled);
    }

    function applyColorBlindMode(enabled) {
        document.body.classList.toggle('color-blind-mode', enabled);
    }

    function applyHighContrast(enabled) {
        document.body.classList.toggle('high-contrast', enabled);
    }

    /* ---------- Stats ---------- */

    function renderStats(stats, leaderboard) {
        els.statTotalGames.textContent = stats.totalGames;
        els.statWins.textContent = stats.wins;
        els.statLosses.textContent = stats.losses;
        els.statDraws.textContent = stats.draws;
        const rate = stats.totalGames > 0
            ? Math.round((stats.wins / stats.totalGames) * 100)
            : 0;
        els.statWinRate.textContent = rate + '٪';
        els.statStreak.textContent = stats.bestStreak;

        // Per-difficulty
        const e = stats.aiEasy || { wins: 0, losses: 0, draws: 0 };
        const m = stats.aiMedium || { wins: 0, losses: 0, draws: 0 };
        const h = stats.aiHard || { wins: 0, losses: 0, draws: 0 };
        els.diffEasyW.textContent = e.wins;
        els.diffEasyL.textContent = e.losses;
        els.diffEasyD.textContent = e.draws;
        els.diffMediumW.textContent = m.wins;
        els.diffMediumL.textContent = m.losses;
        els.diffMediumD.textContent = m.draws;
        els.diffHardW.textContent = h.wins;
        els.diffHardL.textContent = h.losses;
        els.diffHardD.textContent = h.draws;

        // Charts
        if (els.donutChart && typeof Chart !== 'undefined') {
            Chart.drawDonut(els.donutChart, stats);
        }
        if (els.resultsChart && typeof Chart !== 'undefined') {
            Chart.drawResultsBar(els.resultsChart, stats.recentResults || []);
        }

        // Leaderboard
        if (!leaderboard || leaderboard.length === 0) {
            els.leaderboardList.innerHTML = '<p class="empty-state">هنوز بازی‌ای ثبت نشده</p>';
            return;
        }
        els.leaderboardList.innerHTML = '';
        leaderboard.forEach((entry, i) => {
            const row = document.createElement('div');
            row.className = 'leaderboard-row';
            const rate = entry.games > 0 ? Math.round(entry.wins / entry.games * 100) : 0;
            row.innerHTML = `
                <div class="leaderboard-rank">${i + 1}</div>
                <div class="leaderboard-name">${escapeHtml(entry.name)}</div>
                <div class="leaderboard-score">${entry.wins} برد / ${entry.games} بازی (${rate}٪)</div>
            `;
            els.leaderboardList.appendChild(row);
        });
    }

    /* ---------- Achievements ---------- */

    function renderAchievements(allAchievements) {
        const unlocked = allAchievements.filter(a => a.unlocked).length;
        const total = allAchievements.length;
        els.achUnlocked.textContent = unlocked;
        els.achTotal.textContent = total;
        els.achProgressFill.style.width = (total > 0 ? (unlocked / total * 100) : 0) + '%';

        els.achievementsGrid.innerHTML = '';
        allAchievements.forEach(a => {
            const card = document.createElement('div');
            card.className = 'achievement-card' + (a.unlocked ? ' unlocked' : '');
            const dateStr = a.unlockedAt ? new Date(a.unlockedAt).toLocaleDateString('fa-IR') : '';
            card.innerHTML = `
                <div class="achievement-icon">${a.icon}</div>
                <div class="achievement-title">${escapeHtml(a.title)}</div>
                <div class="achievement-desc">${escapeHtml(a.description)}</div>
                ${a.unlocked ? `<div class="achievement-date">${dateStr}</div>` : ''}
            `;
            els.achievementsGrid.appendChild(card);
        });
    }

    function updateAchievementBadge(count) {
        if (count > 0) {
            els.achievementBadge.style.display = 'inline-block';
            els.achievementBadge.textContent = count;
        } else {
            els.achievementBadge.style.display = 'none';
        }
    }

    /* ---------- Replay screen ---------- */

    function renderReplayBoard(board, lastMove = null) {
        renderBoard(board, lastMove, els.replayCells);
    }

    function setReplayInfo(html) {
        els.replayInfo.innerHTML = html;
    }

    function setReplayStep(current, total) {
        els.replayStep.textContent = `${current} / ${total}`;
    }

    function setReplayPlaying(playing) {
        els.replayPlayBtn.innerHTML = playing ? '⏸ توقف' : '▶ پخش';
    }

    function highlightReplayWin(line, winner) {
        highlightWinning(line, winner, els.replayCells, els.replayWinningLine);
    }

    function clearReplayWinningLine() {
        els.replayWinningLine.innerHTML = '';
    }

    /* ---------- Avatar picker ---------- */

    function showAvatarPicker(title, current, options, onSelect) {
        els.avatarPickerTitle.textContent = title;
        els.avatarGrid.innerHTML = '';
        options.forEach(emoji => {
            const btn = document.createElement('button');
            btn.className = 'avatar-option' + (emoji === current ? ' selected' : '');
            btn.textContent = emoji;
            btn.addEventListener('click', () => {
                $$('#avatarGrid .avatar-option').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                if (onSelect) onSelect(emoji);
            });
            els.avatarGrid.appendChild(btn);
        });
        els.avatarPickerModal.classList.add('active');
    }

    function hideAvatarPicker() {
        els.avatarPickerModal.classList.remove('active');
    }

    /* ---------- Onboarding ---------- */

    function showOnboarding() {
        // Build dots
        els.onboardingDots.innerHTML = '';
        const slides = $$('#onboardingSlides .onboarding-slide');
        slides.forEach((_, i) => {
            const dot = document.createElement('div');
            dot.className = 'onboarding-dot' + (i === 0 ? ' active' : '');
            dot.dataset.slide = i;
            els.onboardingDots.appendChild(dot);
        });
        goToOnboardingSlide(0);
        els.onboardingModal.classList.add('active');
    }

    function hideOnboarding() {
        els.onboardingModal.classList.remove('active');
    }

    function goToOnboardingSlide(index) {
        const slides = $$('#onboardingSlides .onboarding-slide');
        const dots = $$('#onboardingDots .onboarding-dot');
        slides.forEach((s, i) => s.classList.toggle('active', i === index));
        dots.forEach((d, i) => d.classList.toggle('active', i === index));
        els.onboardingNextBtn.textContent = (index === slides.length - 1) ? 'شروع!' : 'بعدی';
    }

    function nextOnboardingSlide() {
        const active = $('#onboardingSlides .onboarding-slide.active');
        if (!active) return false;
        const idx = parseInt(active.dataset.slide, 10);
        const slides = $$('#onboardingSlides .onboarding-slide');
        if (idx >= slides.length - 1) return true; // signal "done"
        goToOnboardingSlide(idx + 1);
        return false;
    }

    /* ---------- Resume modal ---------- */

    function showResumeModal() {
        els.resumeModal.classList.add('active');
    }

    function hideResumeModal() {
        els.resumeModal.classList.remove('active');
    }

    /* ---------- Install banner ---------- */

    function showInstallBanner(onInstall, onDismiss) {
        // Remove existing
        const existing = $('.install-banner');
        if (existing) existing.remove();
        const banner = document.createElement('div');
        banner.className = 'install-banner';
        banner.innerHTML = `
            <span class="install-banner-text">نصب بازی روی دستگاه</span>
            <div class="install-banner-actions">
                <button class="btn btn-ghost" data-action="dismiss-install">بعداً</button>
                <button class="btn btn-primary" data-action="accept-install">نصب</button>
            </div>
        `;
        document.body.appendChild(banner);
        banner.querySelector('[data-action="dismiss-install"]').addEventListener('click', () => {
            banner.remove();
            if (onDismiss) onDismiss();
        });
        banner.querySelector('[data-action="accept-install"]').addEventListener('click', () => {
            if (onInstall) onInstall();
        });
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

    /* ---------- Setup screen helpers ---------- */

    function getSelectedDifficulty() {
        const active = $$('.pill.active')[0];
        return active ? active.dataset.diff : 'easy';
    }

    function setSelectedDifficulty(diff) {
        els.difficultyPills.forEach(p => {
            p.classList.toggle('active', p.dataset.diff === diff);
        });
    }

    function getSelectedWinTarget() {
        const active = $('#winTargetControl .seg-btn.active');
        return active ? parseInt(active.dataset.value, 10) : 1;
    }

    function setSelectedWinTarget(value) {
        $$('#winTargetControl .seg-btn').forEach(b => {
            b.classList.toggle('active', parseInt(b.dataset.value, 10) === value);
        });
    }

    function getSelectedStarter() {
        const active = $('#starterControl .seg-btn.active');
        return active ? active.dataset.value : 'random';
    }

    function setSelectedStarter(value) {
        $$('#starterControl .seg-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.value === value);
        });
    }

    function getSelectedTimer() {
        const active = $('#timerControl .seg-btn.active');
        return active ? parseInt(active.dataset.value, 10) : 0;
    }

    function setSelectedTimer(value) {
        $$('#timerControl .seg-btn').forEach(b => {
            b.classList.toggle('active', parseInt(b.dataset.value, 10) === value);
        });
    }

    function setAIPlayer2UI(isAI) {
        if (isAI) {
            els.player2Name.value = 'ربات';
            els.player2Name.disabled = true;
            els.player2Label.textContent = 'نام ربات (O)';
            els.player2SetupCard.classList.add('ai');
        } else {
            els.player2Name.disabled = false;
            els.player2Label.textContent = 'نام بازیکن دوم (O)';
            els.player2SetupCard.classList.remove('ai');
        }
    }

    function setSoundButtonState(enabled) {
        els.soundBtn.querySelector('.btn-icon').textContent = enabled ? '🔊' : '🔇';
        els.soundBtn.classList.toggle('active', enabled);
    }

    function setHintsButtonState(enabled) {
        els.hintsBtn.classList.toggle('active', enabled);
    }

    function setUndoEnabled(enabled) {
        els.undoBtn.disabled = !enabled;
        els.undoBtn.style.opacity = enabled ? '1' : '0.4';
    }

    function setReplayMenuEnabled(enabled) {
        if (els.replayMenuBtn) {
            els.replayMenuBtn.disabled = !enabled;
            els.replayMenuBtn.style.opacity = enabled ? '1' : '0.4';
        }
    }

    return {
        els,
        screens,
        showScreen,
        renderBoard,
        highlightWinning,
        clearWinningLine,
        clearHints,
        showHint,
        setBoardDisabled,
        updateScore,
        updatePlayerNames,
        updateAvatars,
        setActivePlayer,
        setTurnText,
        setMatchTitle,
        showTimer,
        updateTimer,
        renderHistory,
        toggleHistoryPanel,
        showRoundEnd,
        hideRoundEnd,
        showMatchEnd,
        hideMatchEnd,
        toast,
        achievementToast,
        shake,
        vibrate,
        syncSettingsUI,
        applyTheme,
        applyAccentColor,
        applyAnimations,
        applyColorBlindMode,
        applyHighContrast,
        renderStats,
        renderAchievements,
        updateAchievementBadge,
        renderReplayBoard,
        setReplayInfo,
        setReplayStep,
        setReplayPlaying,
        highlightReplayWin,
        clearReplayWinningLine,
        showAvatarPicker,
        hideAvatarPicker,
        showOnboarding,
        hideOnboarding,
        nextOnboardingSlide,
        showResumeModal,
        hideResumeModal,
        showInstallBanner,
        getSelectedDifficulty,
        setSelectedDifficulty,
        getSelectedWinTarget,
        setSelectedWinTarget,
        getSelectedStarter,
        setSelectedStarter,
        getSelectedTimer,
        setSelectedTimer,
        setAIPlayer2UI,
        setSoundButtonState,
        setHintsButtonState,
        setUndoEnabled,
        setReplayMenuEnabled,
    };
})();
