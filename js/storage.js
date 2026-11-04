/* ============================================
   STORAGE.JS - Persistent storage for Doz
   Handles: settings, stats, leaderboard
   ============================================ */

const Storage = (function () {
    const SETTINGS_KEY = 'doz.settings.v1';
    const STATS_KEY = 'doz.stats.v1';
    const LEADERBOARD_KEY = 'doz.leaderboard.v1';

    const DEFAULT_SETTINGS = {
        theme: 'dark',          // 'light' | 'dark' | 'auto'
        accentColor: 'indigo',
        soundEnabled: true,
        volume: 60,
        animationsEnabled: true,
        hapticsEnabled: true,
        hintsEnabled: false,
    };

    const DEFAULT_STATS = {
        totalGames: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        currentStreak: 0,
        bestStreak: 0,
    };

    function safeGet(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return { ...fallback, ...parsed };
        } catch (e) {
            console.warn('Storage read failed for', key, e);
            return fallback;
        }
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
            return safeGet(SETTINGS_KEY, DEFAULT_SETTINGS);
        },

        saveSettings(partial) {
            const current = this.getSettings();
            const next = { ...current, ...partial };
            safeSet(SETTINGS_KEY, next);
            return next;
        },

        getStats() {
            return safeGet(STATS_KEY, DEFAULT_STATS);
        },

        saveStats(partial) {
            const current = this.getStats();
            const next = { ...current, ...partial };
            safeSet(STATS_KEY, next);
            return next;
        },

        /**
         * Record the result of a finished game.
         * @param {string} result - 'win' | 'loss' | 'draw'
         * @param {string} playerName - name of the human player (for leaderboard)
         * @param {boolean} isHuman - whether the result is from human's perspective
         */
        recordGame(result, playerName, isHuman = true) {
            if (!isHuman) return this.getStats();

            const stats = this.getStats();
            stats.totalGames += 1;

            if (result === 'win') {
                stats.wins += 1;
                stats.currentStreak += 1;
                if (stats.currentStreak > stats.bestStreak) {
                    stats.bestStreak = stats.currentStreak;
                }
            } else if (result === 'loss') {
                stats.losses += 1;
                stats.currentStreak = 0;
            } else if (result === 'draw') {
                stats.draws += 1;
            }

            safeSet(STATS_KEY, stats);

            // Update leaderboard
            if (playerName && (result === 'win' || result === 'draw')) {
                this.updateLeaderboard(playerName, result);
            }

            return stats;
        },

        getLeaderboard() {
            try {
                const raw = localStorage.getItem(LEADERBOARD_KEY);
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

            // Keep top 10
            const trimmed = board.slice(0, 10);
            safeSet(LEADERBOARD_KEY, trimmed);
            return trimmed;
        },

        resetStats() {
            safeSet(STATS_KEY, DEFAULT_STATS);
            safeSet(LEADERBOARD_KEY, []);
            return DEFAULT_STATS;
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
