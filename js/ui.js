/* ============================================
   UI.JS - DOM rendering & interactions for Doz
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
    };

    const els = {
        // Home
        themeToggle: $('#themeToggle'),
        // Setup
        player1Name: $('#player1Name'),
        player2Name: $('#player2Name'),
        player2Label: $('#player2Label'),
        player2SetupCard: $('#player2SetupCard'),
        winTargetControl: $('#winTargetControl'),
        starterControl: $('#starterControl'),
        starterRow: $('#starterRow'),
        // Game
        board: $('#board'),
        cells: $$('.cell'),
        winningLine: $('#winningLine'),
        matchTitle: $('#matchTitle'),
        scoreNameX: $('#scoreNameX'),
        scoreNameO: $('#scoreNameO'),
        scoreValueX: $('#scoreValueX'),
        scoreValueO: $('#scoreValueO'),
        scoreCardX: $('#scoreCardX'),
        scoreCardO: $('#scoreCardO'),
        drawsValue: $('#drawsValue'),
        roundNumber: $('#roundNumber'),
        turnText: $('#turnText'),
        turnIndicator: $('#turnIndicator'),
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
        // Stats
        statTotalGames: $('#statTotalGames'),
        statWins: $('#statWins'),
        statLosses: $('#statLosses'),
        statDraws: $('#statDraws'),
        statWinRate: $('#statWinRate'),
        statStreak: $('#statStreak'),
        leaderboardList: $('#leaderboardList'),
        // Settings
        themeControl: $('#themeControl'),
        boardColorSwatches: $('#boardColorSwatches'),
        soundEnabled: $('#soundEnabled'),
        volumeRange: $('#volumeRange'),
        animationsEnabled: $('#animationsEnabled'),
        hapticsEnabled: $('#hapticsEnabled'),
        hintsEnabled: $('#hintsEnabled'),
        // Toast
        toastContainer: $('#toastContainer'),
        // Difficulty pills
        difficultyPills: $$('.pill'),
    };

    /* ---------- Screen navigation ---------- */

    function showScreen(name) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        if (screens[name]) screens[name].classList.add('active');
        // Scroll to top
        if (screens[name]) screens[name].scrollTop = 0;
    }

    /* ---------- Board rendering ---------- */

    function renderBoard(board, lastMove = null) {
        els.cells.forEach((cell, i) => {
            cell.classList.remove('x', 'o', 'filled', 'winning', 'hint');
            // Remove old mark node
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

                // Only animate the most recent move
                if (lastMove !== i) {
                    mark.style.animation = 'none';
                    mark.style.opacity = '1';
                }
            }

            // Add numpad number helper
            const num = document.createElement('span');
            num.className = 'cell-number';
            num.textContent = Game.cellLabel(i);
            cell.appendChild(num);
        });
    }

    function highlightWinning(line, winner) {
        if (!line) return;
        line.forEach(idx => {
            els.cells[idx].classList.add('winning', winner);
        });
        drawWinningLine(line);
    }

    function drawWinningLine(line) {
        els.winningLine.innerHTML = '';
        if (!line || line.length < 3) return;

        // Compute SVG line from cell centers
        const boardRect = els.board.getBoundingClientRect();
        const cell0 = els.cells[line[0]].getBoundingClientRect();
        const cell2 = els.cells[line[2]].getBoundingClientRect();

        const x1 = (cell0.left + cell0.width / 2) - boardRect.left;
        const y1 = (cell0.top + cell0.height / 2) - boardRect.top;
        const x2 = (cell2.left + cell2.width / 2) - boardRect.left;
        const y2 = (cell2.top + cell2.height / 2) - boardRect.top;

        // Use viewBox in 0..100 space
        const w = boardRect.width;
        const h = boardRect.height;

        const svg = `
            <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
                <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />
            </svg>
        `;
        els.winningLine.innerHTML = svg;
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
            // Auto-clear after 2 seconds
            setTimeout(clearHints, 2000);
        }
    }

    function setBoardDisabled(disabled) {
        els.cells.forEach(c => {
            if (disabled) c.classList.add('disabled');
            else c.classList.remove('disabled');
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
                <span>خانه ${Game.cellLabel(m.index)} (${m.playerName})</span>
            `;
            els.historyList.appendChild(row);
        });
        // Scroll to bottom
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
        // Clean up after animation
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

    /* ---------- Screen-shake / haptics ---------- */

    function shake(element = null) {
        const target = element || screens.game;
        target.classList.remove('shake');
        // Force reflow so animation restarts
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
        // Theme
        $$('#themeControl .seg-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.value === settings.theme);
        });
        // Accent
        $$('#boardColorSwatches .swatch').forEach(b => {
            b.classList.toggle('active', b.dataset.color === settings.accentColor);
        });
        // Sound
        els.soundEnabled.checked = settings.soundEnabled;
        els.volumeRange.value = settings.volume;
        // Gameplay
        els.animationsEnabled.checked = settings.animationsEnabled;
        els.hapticsEnabled.checked = settings.hapticsEnabled;
        els.hintsEnabled.checked = settings.hintsEnabled;
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
        setActivePlayer,
        setTurnText,
        setMatchTitle,
        renderHistory,
        toggleHistoryPanel,
        showRoundEnd,
        hideRoundEnd,
        showMatchEnd,
        hideMatchEnd,
        toast,
        shake,
        vibrate,
        syncSettingsUI,
        applyTheme,
        applyAccentColor,
        applyAnimations,
        renderStats,
        getSelectedDifficulty,
        setSelectedDifficulty,
        getSelectedWinTarget,
        setSelectedWinTarget,
        getSelectedStarter,
        setSelectedStarter,
        setAIPlayer2UI,
        setSoundButtonState,
        setHintsButtonState,
        setUndoEnabled,
    };
})();
