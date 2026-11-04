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
         * @param {object} meta - { mode: 'pvp'|'ai', difficulty: 'easy'|'medium'|'hard', moves: number }
         */
        recordGame(result, playerName, meta = {}) {
            const stats = this.getStats();
            stats.totalGames += 1;
            stats.totalMoves += meta.moves || 0;

            if (result === 'win') {
                stats.wins += 1;
                stats.currentStreak += 1;
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
            } else if (result === 'loss') {
                stats.losses += 1;
                stats.currentStreak = 0;
            } else if (result === 'draw') {
                stats.draws += 1;
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
