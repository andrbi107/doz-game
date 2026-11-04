/* ============================================
   ACHIEVEMENTS.JS - Achievement system for Doz
   Defines achievements, checks unlock conditions,
   shows toast notifications when unlocked.
   ============================================ */

const Achievements = (function () {
    'use strict';

    // Achievement definitions
    // Each: { id, title, description, icon, check(stats, gameContext) -> bool }
    const DEFS = [
        // === Beginner ===
        {
            id: 'first_game',
            title: 'اولین قدم',
            description: 'اولین بازی خود را انجام دهید',
            icon: '🎯',
            check: (s) => s.totalGames >= 1,
        },
        {
            id: 'first_win',
            title: 'اولین پیروزی',
            description: 'اولین پیروزی خود را کسب کنید',
            icon: '🏆',
            check: (s) => s.wins >= 1,
        },
        {
            id: 'first_draw',
            title: 'مساوی',
            description: 'اولین بازی مساوی خود را داشته باشید',
            icon: '🤝',
            check: (s) => s.draws >= 1,
        },

        // === Streak ===
        {
            id: 'streak_3',
            title: 'سه‌گانه',
            description: 'سه پیروزی پشت سر هم',
            icon: '🔥',
            check: (s) => s.bestStreak >= 3,
        },
        {
            id: 'streak_5',
            title: 'پنج‌گانه',
            description: 'پنج پیروزی پشت سر هم',
            icon: '⚡',
            check: (s) => s.bestStreak >= 5,
        },
        {
            id: 'streak_10',
            title: 'افسانه‌ای',
            description: 'ده پیروزی پشت سر هم',
            icon: '👑',
            check: (s) => s.bestStreak >= 10,
        },

        // === AI defeats ===
        {
            id: 'beat_easy',
            title: 'مبتدی',
            description: 'ربات آسان را شکست دهید',
            icon: '🥉',
            check: (s) => s.aiEasy && s.aiEasy.wins >= 1,
        },
        {
            id: 'beat_medium',
            title: 'حرفه‌ای',
            description: 'ربات متوسط را شکست دهید',
            icon: '🥈',
            check: (s) => s.aiMedium && s.aiMedium.wins >= 1,
        },
        {
            id: 'beat_hard',
            title: 'استاد',
            description: 'ربات سخت را شکست دهید (غیرممکن!؟)',
            icon: '🥇',
            check: (s) => s.aiHard && s.aiHard.wins >= 1,
        },

        // === Speed ===
        {
            id: 'fast_win',
            title: 'برق‌و باد',
            description: 'در کمتر از ۵ حرکت پیروز شوید',
            icon: '💨',
            check: (s, ctx) => s.fastestWin && s.fastestWin.moves <= 5,
        },

        // === Volume ===
        {
            id: 'games_10',
            title: 'عیاش',
            description: 'ده بازی انجام دهید',
            icon: '🎲',
            check: (s) => s.totalGames >= 10,
        },
        {
            id: 'games_50',
            title: 'بازی‌باز',
            description: 'پنجاه بازی انجام دهید',
            icon: '🎰',
            check: (s) => s.totalGames >= 50,
        },
        {
            id: 'games_100',
            title: 'وسواس',
            description: 'صد بازی انجام دهید',
            icon: '💎',
            check: (s) => s.totalGames >= 100,
        },

        // === Skill ===
        {
            id: 'draw_master',
            title: 'دیپلمات',
            description: 'پنج بازی مساوی داشته باشید',
            icon: '🕊️',
            check: (s) => s.draws >= 5,
        },
        {
            id: 'unbeatable',
            title: 'شکست‌ناپذیر',
            description: 'بدون باخت، ۱۰ بازی پیروز شوید',
            icon: '🛡️',
            check: (s) => s.wins >= 10 && s.losses === 0,
        },

        // === Social ===
        {
            id: 'pvp_5',
            title: 'رفاقت',
            description: 'پنج بازی دو نفره انجام دهید',
            icon: '👥',
            check: (s) => s.pvp && s.pvp.games >= 5,
        },
    ];

    // Sound hook (set by app)
    let onUnlockSound = null;
    // Toast hook (set by app)
    let onToast = null;

    /**
     * Check all achievements against current stats/gameContext.
     * Returns array of newly unlocked achievements (already persisted).
     */
    function checkAll(stats, gameContext = {}) {
        const newlyUnlocked = [];
        for (const def of DEFS) {
            try {
                if (def.check(stats, gameContext)) {
                    const unlocked = Storage.unlockAchievement(def.id, def);
                    if (unlocked) {
                        newlyUnlocked.push(unlocked);
                    }
                }
            } catch (e) {
                console.warn('Achievement check failed for', def.id, e);
            }
        }
        // Notify
        newlyUnlocked.forEach((a, i) => {
            setTimeout(() => {
                if (onToast) onToast(a);
                if (onUnlockSound) onUnlockSound();
            }, i * 600);
        });
        return newlyUnlocked;
    }

    function getAll() {
        const data = Storage.getAchievements();
        return DEFS.map(def => ({
            ...def,
            unlocked: !!data.unlocked[def.id],
            unlockedAt: data.unlocked[def.id] ? data.unlocked[def.id].date : null,
        }));
    }

    function getUnlockedCount() {
        return Storage.getAchievements().unlocked ? Object.keys(Storage.getAchievements().unlocked).length : 0;
    }

    function getTotalCount() {
        return DEFS.length;
    }

    return {
        DEFS,
        checkAll,
        getAll,
        getUnlockedCount,
        getTotalCount,
        setSoundHook(fn) { onUnlockSound = fn; },
        setToastHook(fn) { onToast = fn; },
    };
})();
