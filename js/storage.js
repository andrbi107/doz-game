/* ============================================
   STORAGE.JS - Persistent storage for Doz
   Handles: settings, stats, leaderboard, achievements,
            avatars, game state, history, settings backup
   ============================================ */

const Storage = (function () {
    const KEYS = {
        SETTINGS: 'doz.settings.v1',
        STATS: 'doz.stats.v1',
        LEADERBOARD: 'doz.leaderboard.v1',
        ACHIEVEMENTS: 'doz.achievements.v1',
        AVATARS: 'doz.avatars.v1',
        GAME_STATE: 'doz.gamestate.v1',
        HISTORY: 'doz.history.v1',
        ONBOARDED: 'doz.onboarded.v1',
    };

    const DEFAULT_SETTINGS = {
        theme: 'dark',
        accentColor: 'indigo',
        soundEnabled: true,
        volume: 60,
        animationsEnabled: true,
        hapticsEnabled: true,
        hintsEnabled: false,
        // New options
        colorBlindMode: false,     // high-contrast symbols
        moveTimerEnabled: false,   // chess clock per turn
        moveTimerSeconds: 15,      // seconds per move
        lastSetup: null,           // remember last game setup
    };

    const DEFAULT_STATS = {
        totalGames: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        currentStreak: 0,
        bestStreak: 0,
        worstStreak: 0,          // longest losing streak (new v3)
        currentLossStreak: 0,    // current losing streak (new v3)
        // Per-difficulty AI stats
        aiEasy:   { wins: 0, losses: 0, draws: 0 },
        aiMedium: { wins: 0, losses: 0, draws: 0 },
        aiHard:   { wins: 0, losses: 0, draws: 0 },
        // PvP stats
        pvp: { games: 0 },
        // Aggregate move stats
        totalMoves: 0,
        fastestWin: null, // {moves, mode, difficulty, date}
        // Recent results (for chart) - array of 'win'|'loss'|'draw'
        recentResults: [],
        // === v3 new tracking ===
        // Strategy stats
        cornerWins: 0,           // wins starting with a corner move
        centerWins: 0,           // wins starting with center
        diagonalWins: 0,
        columnWins: 0,
        rowWins: 0,
        winsAsO: 0,               // wins when player O
        winsAsX: 0,               // wins when player X
        winsWithoutUndo: 0,
        winsWithoutHint: 0,
        winsWithHint: 0,
        drawsVsHard: 0,
        // Variants
        board4x4Games: 0,
        board5x5Games: 0,
        board3x3Games: 0,
        // Streaks by day
        playDays: [],             // array of 'YYYY-MM-DD' strings (capped)
        currentDayStreak: 0,      // consecutive days played
        bestDayStreak: 0,
        lastPlayDay: null,
        // Hours of play (for variety achievements)
        playHours: [],            // array of hours 0-23 (unique)
        // Technical
        pwaInstalled: false,
        offlineGames: 0,
        exportCount: 0,
        importCount: 0,
        keyboardShortcutsUsed: [], // array of shortcut names
        // Easter eggs
        logoClicks: 0,            // clicks on logo
        // XP & Level (v3)
        xp: 0,
        level: 1,
    };

    function safeGet(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            if (typeof fallback === 'object' && fallback !== null && !Array.isArray(fallback)) {
                return deepMerge(structuredCloneSafe(fallback), parsed);
            }
            return parsed;
        } catch (e) {
            console.warn('Storage read failed for', key, e);
            return fallback;
        }
    }

    function structuredCloneSafe(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function deepMerge(target, source) {
        if (typeof target !== 'object' || typeof source !== 'object') return source;
        if (Array.isArray(target) !== Array.isArray(source)) return source;
        for (const key in source) {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                target[key] = deepMerge(target[key] || {}, source[key]);
            } else {
                target[key] = source[key];
            }
        }
        return target;
    }

    function safeSet(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.warn('Storage write failed for', key, e);
            return false;
        }
    }

    return {
        getSettings() {
            return safeGet(KEYS.SETTINGS, DEFAULT_SETTINGS);
        },

        saveSettings(partial) {
            const current = this.getSettings();
            const next = { ...current, ...partial };
            safeSet(KEYS.SETTINGS, next);
            return next;
        },

        getStats() {
            return safeGet(KEYS.STATS, DEFAULT_STATS);
        },

        saveStats(partial) {
            const current = this.getStats();
            const next = { ...current, ...partial };
            safeSet(KEYS.STATS, next);
            return next;
        },

        /**
         * Record the result of a finished game.
         * @param {string} result - 'win' | 'loss' | 'draw'
         * @param {string} playerName - human player name (for leaderboard)
         * @param {object} meta - { mode, difficulty, moves, winner, line, starter, usedUndo, usedHint, boardSize, humanPlayer }
         */
        recordGame(result, playerName, meta = {}) {
            const stats = this.getStats();
            stats.totalGames += 1;
            stats.totalMoves += meta.moves || 0;

            // Track play day & hour (for endurance/variety achievements)
            this._trackPlayTime(stats);

            // Track board size
            const boardSize = meta.boardSize || 3;
            if (boardSize === 3) stats.board3x3Games = (stats.board3x3Games || 0) + 1;
            else if (boardSize === 4) stats.board4x4Games = (stats.board4x4Games || 0) + 1;
            else if (boardSize === 5) stats.board5x5Games = (stats.board5x5Games || 0) + 1;

            if (result === 'win') {
                stats.wins += 1;
                stats.currentStreak += 1;
                stats.currentLossStreak = 0;
                if (stats.currentStreak > stats.bestStreak) {
                    stats.bestStreak = stats.currentStreak;
                }
                // Track fastest win
                const moves = meta.moves || 0;
                if (moves > 0 && (!stats.fastestWin || moves < stats.fastestWin.moves)) {
                    stats.fastestWin = {
                        moves,
                        mode: meta.mode || 'pvp',
                        difficulty: meta.difficulty || null,
                        date: new Date().toISOString(),
                    };
                }
                // Strategy stats
                if (meta.line) {
                    // line[0], line[1], line[2] are 3 indices forming the win
                    // Diagonal: 0,4,8 or 2,4,6
                    if ((meta.line.includes(0) && meta.line.includes(4) && meta.line.includes(8)) ||
                        (meta.line.includes(2) && meta.line.includes(4) && meta.line.includes(6))) {
                        stats.diagonalWins = (stats.diagonalWins || 0) + 1;
                    }
                    // Column: indices share same column (i % 3)
                    const cols = meta.line.map(i => i % 3);
                    if (cols[0] === cols[1] && cols[1] === cols[2]) {
                        stats.columnWins = (stats.columnWins || 0) + 1;
                    }
                    // Row: indices share same row (Math.floor(i/3))
                    const rows = meta.line.map(i => Math.floor(i / 3));
                    if (rows[0] === rows[1] && rows[1] === rows[2]) {
                        stats.rowWins = (stats.rowWins || 0) + 1;
                    }
                }
                // Track starter position (first move)
                if (meta.firstMove !== undefined) {
                    const corners = [0, 2, 6, 8];
                    if (corners.includes(meta.firstMove)) {
                        stats.cornerWins = (stats.cornerWins || 0) + 1;
                    } else if (meta.firstMove === 4) {
                        stats.centerWins = (stats.centerWins || 0) + 1;
                    }
                }
                // Track wins as X or O
                if (meta.humanPlayer === 'x') stats.winsAsX = (stats.winsAsX || 0) + 1;
                else if (meta.humanPlayer === 'o') stats.winsAsO = (stats.winsAsO || 0) + 1;
                // Win without using undo / hint
                if (meta.usedUndo === false) stats.winsWithoutUndo = (stats.winsWithoutUndo || 0) + 1;
                if (meta.usedHint === false) stats.winsWithoutHint = (stats.winsWithoutHint || 0) + 1;
                if (meta.usedHint === true) stats.winsWithHint = (stats.winsWithHint || 0) + 1;
            } else if (result === 'loss') {
                stats.losses += 1;
                stats.currentStreak = 0;
                stats.currentLossStreak = (stats.currentLossStreak || 0) + 1;
                if (stats.currentLossStreak > (stats.worstStreak || 0)) {
                    stats.worstStreak = stats.currentLossStreak;
                }
            } else if (result === 'draw') {
                stats.draws += 1;
                if (meta.mode === 'ai' && meta.difficulty === 'hard') {
                    stats.drawsVsHard = (stats.drawsVsHard || 0) + 1;
                }
            }

            // Per-difficulty tracking
            if (meta.mode === 'ai' && meta.difficulty) {
                const key = 'ai' + meta.difficulty.charAt(0).toUpperCase() + meta.difficulty.slice(1);
                if (stats[key]) {
                    stats[key][result === 'win' ? 'wins' : result === 'loss' ? 'losses' : 'draws'] += 1;
                }
            } else if (meta.mode === 'pvp') {
                stats.pvp.games = (stats.pvp.games || 0) + 1;
            }

            // Recent results (keep last 30)
            stats.recentResults = stats.recentResults || [];
            stats.recentResults.push({ result, mode: meta.mode, difficulty: meta.difficulty, date: Date.now() });
            if (stats.recentResults.length > 30) {
                stats.recentResults = stats.recentResults.slice(-30);
            }

            // XP & Level (v3)
            this._addXp(stats, result, meta);

            safeSet(KEYS.STATS, stats);

            // Update leaderboard
            if (playerName && (result === 'win' || result === 'draw')) {
                this.updateLeaderboard(playerName, result);
            }

            return stats;
        },

        getLeaderboard() {
            try {
                const raw = localStorage.getItem(KEYS.LEADERBOARD);
                if (!raw) return [];
                const arr = JSON.parse(raw);
                return Array.isArray(arr) ? arr : [];
            } catch (e) {
                return [];
            }
        },

        updateLeaderboard(name, result) {
            const board = this.getLeaderboard();
            let entry = board.find(e => e.name === name);
            if (!entry) {
                entry = { name, wins: 0, draws: 0, games: 0 };
                board.push(entry);
            }
            entry.games += 1;
            if (result === 'win') entry.wins += 1;
            else if (result === 'draw') entry.draws += 1;

            board.sort((a, b) => {
                if (b.wins !== a.wins) return b.wins - a.wins;
                const aRate = a.games ? a.wins / a.games : 0;
                const bRate = b.games ? b.wins / b.games : 0;
                return bRate - aRate;
            });

            const trimmed = board.slice(0, 10);
            safeSet(KEYS.LEADERBOARD, trimmed);
            return trimmed;
        },

        /* ---------- v3 helper functions ---------- */

        /**
         * Track play day and hour for endurance/variety achievements.
         * Mutates stats in place.
         */
        _trackPlayTime(stats) {
            const now = new Date();
            const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
            const hour = now.getHours();

            // Track unique hours
            stats.playHours = stats.playHours || [];
            if (!stats.playHours.includes(hour)) {
                stats.playHours.push(hour);
            }

            // Track day streak
            stats.playDays = stats.playDays || [];
            if (stats.lastPlayDay !== today) {
                if (stats.lastPlayDay) {
                    // Check if yesterday
                    const yesterday = new Date(now);
                    yesterday.setDate(yesterday.getDate() - 1);
                    const yStr = yesterday.toISOString().slice(0, 10);
                    if (stats.lastPlayDay === yStr) {
                        stats.currentDayStreak = (stats.currentDayStreak || 0) + 1;
                    } else {
                        stats.currentDayStreak = 1;
                    }
                } else {
                    stats.currentDayStreak = 1;
                }
                if (stats.currentDayStreak > (stats.bestDayStreak || 0)) {
                    stats.bestDayStreak = stats.currentDayStreak;
                }
                stats.lastPlayDay = today;
                stats.playDays.push(today);
                // Cap playDays to last 100 entries
                if (stats.playDays.length > 100) {
                    stats.playDays = stats.playDays.slice(-100);
                }
            }
        },

        /**
         * Add XP based on game result and calculate level.
         * Mutates stats in place.
         */
        _addXp(stats, result, meta) {
            let xp = 0;
            if (result === 'win') xp = 100;
            else if (result === 'draw') xp = 30;
            else if (result === 'loss') xp = 10;

            // Multipliers
            if (meta.mode === 'ai') xp *= 1.2; // bonus for AI
            if (meta.difficulty === 'hard') xp *= 1.5;
            if (meta.usedUndo === false && result === 'win') xp *= 1.5;
            if (meta.boardSize && meta.boardSize > 3) xp *= 1.3;

            xp = Math.round(xp);
            stats.xp = (stats.xp || 0) + xp;

            // Calculate level: each level needs level*1000 XP (cumulative)
            // Level 1: 0-1000, Level 2: 1000-3000, Level 3: 3000-6000, ...
            // Cumulative: level N needs sum_{i=1}^{N-1} i*1000 = (N-1)*N*500 XP
            let level = 1;
            while (true) {
                const needed = level * (level + 1) * 500;
                if (stats.xp >= needed) level++;
                else break;
                if (level > 999) break; // safety
            }
            stats.level = level;

            return xp;
        },

        /**
         * Get XP needed for next level.
         */
        getXpProgress() {
            const stats = this.getStats();
            const level = stats.level || 1;
            const currentLevelXp = level * (level - 1) * 500;  // xp needed to reach this level
            const nextLevelXp = level * (level + 1) * 500;      // xp needed to reach next level
            const xpInLevel = stats.xp - currentLevelXp;
            const xpForNext = nextLevelXp - currentLevelXp;
            return {
                level,
                xp: stats.xp,
                xpInLevel,
                xpForNext,
                progress: xpForNext > 0 ? xpInLevel / xpForNext : 0,
            };
        },

        /**
         * Increment a counter for technical achievements.
         */
        incrementStat(key, by = 1) {
            const stats = this.getStats();
            stats[key] = (stats[key] || 0) + by;
            safeSet(KEYS.STATS, stats);
            return stats[key];
        },

        /**
         * Push to an array stat (deduped if needed).
         */
        pushStatArray(key, value, unique = false, cap = 100) {
            const stats = this.getStats();
            stats[key] = stats[key] || [];
            if (unique && stats[key].includes(value)) return stats[key];
            stats[key].push(value);
            if (stats[key].length > cap) stats[key] = stats[key].slice(-cap);
            safeSet(KEYS.STATS, stats);
            return stats[key];
        },

        /**
         * Set a flag stat (boolean).
         */
        setStat(key, value) {
            const stats = this.getStats();
            stats[key] = value;
            safeSet(KEYS.STATS, stats);
        },

        /* ---------- Achievements ---------- */

        getAchievements() {
            return safeGet(KEYS.ACHIEVEMENTS, { unlocked: {}, seen: {} });
        },

        unlockAchievement(id, achievement) {
            const data = this.getAchievements();
            if (data.unlocked[id]) return null; // already unlocked
            data.unlocked[id] = {
                id,
                title: achievement.title,
                description: achievement.description,
                icon: achievement.icon,
                date: Date.now(),
            };
            safeSet(KEYS.ACHIEVEMENTS, data);
            return data.unlocked[id];
        },

        markAchievementsSeen(ids) {
            const data = this.getAchievements();
            ids.forEach(id => { data.seen[id] = true; });
            safeSet(KEYS.ACHIEVEMENTS, data);
        },

        resetAchievements() {
            safeSet(KEYS.ACHIEVEMENTS, { unlocked: {}, seen: {} });
        },

        /* ---------- Avatars ---------- */

        getAvatars() {
            return safeGet(KEYS.AVATARS, { x: '⭐', o: '🌙' });
        },

        saveAvatars(partial) {
            const current = this.getAvatars();
            const next = { ...current, ...partial };
            safeSet(KEYS.AVATARS, next);
            return next;
        },

        /* ---------- Game state (auto-save/resume) ---------- */

        getGameState() {
            try {
                const raw = localStorage.getItem(KEYS.GAME_STATE);
                if (!raw) return null;
                const parsed = JSON.parse(raw);
                if (!parsed || !parsed.board) return null;
                // Validate age (auto-expire after 24h)
                if (parsed.savedAt && (Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000)) {
                    localStorage.removeItem(KEYS.GAME_STATE);
                    return null;
                }
                return parsed;
            } catch (e) {
                return null;
            }
        },

        saveGameState(state) {
            const toSave = { ...state, savedAt: Date.now() };
            safeSet(KEYS.GAME_STATE, toSave);
        },

        clearGameState() {
            try { localStorage.removeItem(KEYS.GAME_STATE); } catch (e) {}
        },

        /* ---------- Last finished game (for replay) ---------- */

        getLastGame() {
            try {
                const raw = localStorage.getItem(KEYS.HISTORY);
                if (!raw) return null;
                return JSON.parse(raw);
            } catch (e) {
                return null;
            }
        },

        saveLastGame(gameData) {
            safeSet(KEYS.HISTORY, gameData);
        },

        /* ---------- Onboarding ---------- */

        hasOnboarded() {
            return localStorage.getItem(KEYS.ONBOARDED) === 'true';
        },

        setOnboarded() {
            localStorage.setItem(KEYS.ONBOARDED, 'true');
        },

        /* ---------- Reset all ---------- */

        resetStats() {
            safeSet(KEYS.STATS, structuredCloneSafe(DEFAULT_STATS));
            safeSet(KEYS.LEADERBOARD, []);
            safeSet(KEYS.HISTORY, null);
            try { localStorage.removeItem(KEYS.HISTORY); } catch (e) {}
            return structuredCloneSafe(DEFAULT_STATS);
        },

        /* ---------- Backup / Restore ---------- */

        exportAll() {
            const out = {};
            Object.values(KEYS).forEach(k => {
                const v = localStorage.getItem(k);
                if (v !== null) {
                    try { out[k] = JSON.parse(v); } catch (e) { out[k] = v; }
                }
            });
            out.__exportedAt = new Date().toISOString();
            out.__version = 1;
            return out;
        },

        importAll(data) {
            if (!data || typeof data !== 'object') return false;
            try {
                Object.keys(data).forEach(k => {
                    if (k.startsWith('__')) return;
                    const v = data[k];
                    localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
                });
                return true;
            } catch (e) {
                console.warn('Import failed', e);
                return false;
            }
        },

        isAvailable() {
            try {
                const test = '__doz_test__';
                localStorage.setItem(test, test);
                localStorage.removeItem(test);
                return true;
            } catch (e) {
                return false;
            }
        },
    };
})();
