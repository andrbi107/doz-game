/* ============================================
   ACHIEVEMENTS.JS v3 - Achievement system for Doz
   50+ achievements across 6 categories with rarity tiers.
   ============================================ */

const Achievements = (function () {
    'use strict';

    // Rarity tiers
    const RARITY = {
        COMMON: { id: 'common', label: 'معمولی', icon: '🥉', color: '#94a3b8' },
        UNCOMMON: { id: 'uncommon', label: 'غیرمعمولی', icon: '🥈', color: '#10b981' },
        RARE: { id: 'rare', label: 'کمیاب', icon: '🥇', color: '#3b82f6' },
        EPIC: { id: 'epic', label: 'حماسی', icon: '💎', color: '#a855f7' },
        LEGENDARY: { id: 'legendary', label: 'افسانه‌ای', icon: '👑', color: '#f59e0b' },
        SECRET: { id: 'secret', label: 'رازدار', icon: '🌟', color: '#ec4899' },
    };

    // Achievement definitions
    // Each: { id, title, description, icon, rarity, check(stats, gameContext) -> bool }
    const DEFS = [
        // ========== BEGINNER (15) ==========
        {
            id: 'first_game',
            title: 'اولین قدم',
            description: 'اولین بازی خود را انجام دهید',
            icon: '🎯', rarity: 'COMMON',
            check: (s) => s.totalGames >= 1,
        },
        {
            id: 'first_win',
            title: 'اولین پیروزی',
            description: 'اولین پیروزی خود را کسب کنید',
            icon: '🏆', rarity: 'COMMON',
            check: (s) => s.wins >= 1,
        },
        {
            id: 'first_loss',
            title: 'اولین باخت',
            description: 'اولین باخت خود را تجربه کنید',
            icon: '😢', rarity: 'COMMON',
            check: (s) => s.losses >= 1,
        },
        {
            id: 'first_draw',
            title: 'مساوی',
            description: 'اولین بازی مساوی خود را داشته باشید',
            icon: '🤝', rarity: 'COMMON',
            check: (s) => s.draws >= 1,
        },
        {
            id: 'finish_onboarding',
            title: 'خوش‌آمدگویی',
            description: 'معرفی اولیه را کامل کنید',
            icon: '👋', rarity: 'COMMON',
            check: (s) => s.totalGames >= 0 && Storage.hasOnboarded(),
        },
        {
            id: 'read_help',
            title: 'دانش‌آموز',
            description: 'صفحه راهنما را مطالعه کنید',
            icon: '📖', rarity: 'COMMON',
            check: (s) => (s.helpRead || false),
        },
        {
            id: 'change_avatar',
            title: 'خلق شخصیت',
            description: 'آواتار خود را تغییر دهید',
            icon: '🎭', rarity: 'COMMON',
            check: (s) => (s.avatarChanged || false),
        },
        {
            id: 'change_theme',
            title: 'طراح',
            description: 'رنگ تم را تغییر دهید',
            icon: '🎨', rarity: 'COMMON',
            check: (s) => (s.themeChanged || false),
        },
        {
            id: 'toggle_sound',
            title: 'صدا‌ساز',
            description: 'صدا را روشن یا خاموش کنید',
            icon: '🔊', rarity: 'COMMON',
            check: (s) => (s.soundToggled || false),
        },
        {
            id: 'toggle_colorblind',
            title: 'دسترس‌پذیر',
            description: 'حالت کوررنگی را فعال کنید',
            icon: '👁️', rarity: 'COMMON',
            check: (s) => (s.colorBlindToggled || false),
        },
        {
            id: 'first_timer_game',
            title: 'ساعتبان',
            description: 'بازی با تایمر فعال انجام دهید',
            icon: '⏱️', rarity: 'COMMON',
            check: (s) => (s.timerGames || 0) >= 1,
        },
        {
            id: 'first_series_3',
            title: 'سه‌گانه',
            description: 'یک سری ۳ دوری انجام دهید',
            icon: '🔢', rarity: 'COMMON',
            check: (s) => (s.series3Games || 0) >= 1,
        },
        {
            id: 'first_series_5',
            title: 'پنج‌گانه',
            description: 'یک سری ۵ دوری انجام دهید',
            icon: '🔢', rarity: 'UNCOMMON',
            check: (s) => (s.series5Games || 0) >= 1,
        },
        {
            id: 'first_series_7',
            title: 'هفت‌گانه',
            description: 'یک سری ۷ دوری انجام دهید',
            icon: '🔢', rarity: 'UNCOMMON',
            check: (s) => (s.series7Games || 0) >= 1,
        },
        {
            id: 'install_pwa',
            title: 'نصب‌شده',
            description: 'بازی را به‌عنوان PWA نصب کنید',
            icon: '📲', rarity: 'UNCOMMON',
            check: (s) => s.pwaInstalled === true,
        },

        // ========== STREAK (6) ==========
        {
            id: 'streak_3',
            title: 'سه‌گانه',
            description: 'سه پیروزی پشت سر هم',
            icon: '🔥', rarity: 'COMMON',
            check: (s) => s.bestStreak >= 3,
        },
        {
            id: 'streak_5',
            title: 'پنج‌گانه',
            description: 'پنج پیروزی پشت سر هم',
            icon: '🔥', rarity: 'UNCOMMON',
            check: (s) => s.bestStreak >= 5,
        },
        {
            id: 'streak_10',
            title: 'ده‌گانه',
            description: 'ده پیروزی پشت سر هم',
            icon: '⚡', rarity: 'RARE',
            check: (s) => s.bestStreak >= 10,
        },
        {
            id: 'streak_20',
            title: 'افسانه‌ای',
            description: 'بیست پیروزی پشت سر هم',
            icon: '👑', rarity: 'LEGENDARY',
            check: (s) => s.bestStreak >= 20,
        },
        {
            id: 'losing_streak_5',
            title: 'روز سخت',
            description: 'پنج باخت پشت سر هم',
            icon: '💔', rarity: 'COMMON',
            check: (s) => (s.worstStreak || 0) >= 5,
        },
        {
            id: 'losing_streak_10',
            title: 'فاجعه',
            description: 'ده باخت پشت سر هم',
            icon: '💀', rarity: 'UNCOMMON',
            check: (s) => (s.worstStreak || 0) >= 10,
        },

        // ========== AI DEFEATS (4) ==========
        {
            id: 'beat_easy',
            title: 'مبتدی',
            description: 'ربات آسان را شکست دهید',
            icon: '🥉', rarity: 'COMMON',
            check: (s) => s.aiEasy && s.aiEasy.wins >= 1,
        },
        {
            id: 'beat_medium',
            title: 'حرفه‌ای',
            description: 'ربات متوسط را شکست دهید',
            icon: '🥈', rarity: 'UNCOMMON',
            check: (s) => s.aiMedium && s.aiMedium.wins >= 1,
        },
        {
            id: 'beat_hard',
            title: 'استاد',
            description: 'ربات سخت را شکست دهید (غیرممکن!؟)',
            icon: '🥇', rarity: 'LEGENDARY',
            check: (s) => s.aiHard && s.aiHard.wins >= 1,
        },
        {
            id: 'beat_hard_5',
            title: 'افسانه',
            description: 'پنج بار ربات سخت را شکست دهید',
            icon: '🌟', rarity: 'LEGENDARY',
            check: (s) => s.aiHard && s.aiHard.wins >= 5,
        },

        // ========== SPEED (3) ==========
        {
            id: 'fast_win',
            title: 'برق‌و باد',
            description: 'در کمتر از ۵ حرکت پیروز شوید',
            icon: '💨', rarity: 'UNCOMMON',
            check: (s) => s.fastestWin && s.fastestWin.moves <= 5,
        },
        {
            id: 'fast_win_3',
            title: 'صاعقه',
            description: 'در ۳ حرکت پیروز شوید (حداقل ممکن)',
            icon: '⚡', rarity: 'EPIC',
            check: (s) => s.fastestWin && s.fastestWin.moves <= 3,
        },
        {
            id: 'marathon',
            title: 'ماراتن',
            description: 'یک بازی کامل ۹ حرکتی مساوی انجام دهید',
            icon: '🏃', rarity: 'UNCOMMON',
            check: (s) => s.draws >= 1 && s.totalMoves >= 9,
        },

        // ========== VOLUME (4) ==========
        {
            id: 'games_10',
            title: 'عیاش',
            description: 'ده بازی انجام دهید',
            icon: '🎲', rarity: 'COMMON',
            check: (s) => s.totalGames >= 10,
        },
        {
            id: 'games_50',
            title: 'بازی‌باز',
            description: 'پنجاه بازی انجام دهید',
            icon: '🎰', rarity: 'UNCOMMON',
            check: (s) => s.totalGames >= 50,
        },
        {
            id: 'games_100',
            title: 'وسواس',
            description: 'صد بازی انجام دهید',
            icon: '💎', rarity: 'RARE',
            check: (s) => s.totalGames >= 100,
        },
        {
            id: 'games_500',
            title: 'افسانه',
            description: 'پانصد بازی انجام دهید',
            icon: '👑', rarity: 'LEGENDARY',
            check: (s) => s.totalGames >= 500,
        },

        // ========== STRATEGY (10) ==========
        {
            id: 'corner_win',
            title: 'استراتژیست',
            description: 'با حرکت اول گوشه پیروز شوید',
            icon: '📐', rarity: 'UNCOMMON',
            check: (s) => (s.cornerWins || 0) >= 1,
        },
        {
            id: 'center_win',
            title: 'مرکزگرا',
            description: 'با حرکت اول مرکز پیروز شوید',
            icon: '🎯', rarity: 'COMMON',
            check: (s) => (s.centerWins || 0) >= 1,
        },
        {
            id: 'diagonal_win',
            title: 'قطری',
            description: 'با خط قطری پیروز شوید',
            icon: '↗️', rarity: 'COMMON',
            check: (s) => (s.diagonalWins || 0) >= 1,
        },
        {
            id: 'column_win',
            title: 'ستونی',
            description: 'با خط ستونی پیروز شوید',
            icon: '↕️', rarity: 'COMMON',
            check: (s) => (s.columnWins || 0) >= 1,
        },
        {
            id: 'row_win',
            title: 'ردیفی',
            description: 'با خط افقی پیروز شوید',
            icon: '↔️', rarity: 'COMMON',
            check: (s) => (s.rowWins || 0) >= 1,
        },
        {
            id: 'win_as_x',
            title: 'مهاجم',
            description: 'به‌عنوان X پیروز شوید',
            icon: '❌', rarity: 'COMMON',
            check: (s) => (s.winsAsX || 0) >= 1,
        },
        {
            id: 'win_as_o',
            title: 'مدافع',
            description: 'به‌عنوان O پیروز شوید',
            icon: '⭕', rarity: 'COMMON',
            check: (s) => (s.winsAsO || 0) >= 1,
        },
        {
            id: 'no_undo_win',
            title: 'قاطع',
            description: 'بدون استفاده از Undo پیروز شوید',
            icon: '✂️', rarity: 'UNCOMMON',
            check: (s) => (s.winsWithoutUndo || 0) >= 1,
        },
        {
            id: 'no_hint_win',
            title: 'خودساخته',
            description: 'بدون استفاده از راهنما پیروز شوید',
            icon: '🧠', rarity: 'UNCOMMON',
            check: (s) => (s.winsWithoutHint || 0) >= 1,
        },
        {
            id: 'draw_vs_hard',
            title: 'دیپلمات',
            description: 'با ربات سخت مساوی کنید',
            icon: '🕊️', rarity: 'RARE',
            check: (s) => (s.drawsVsHard || 0) >= 1,
        },

        // ========== ENDURANCE (6) ==========
        {
            id: 'play_3_days',
            title: 'سه‌روزه',
            description: 'سه روز پشت سر هم بازی کنید',
            icon: '📅', rarity: 'UNCOMMON',
            check: (s) => (s.bestDayStreak || 0) >= 3,
        },
        {
            id: 'play_7_days',
            title: 'هفته‌نگه‌دار',
            description: 'هفت روز پشت سر هم بازی کنید',
            icon: '📆', rarity: 'RARE',
            check: (s) => (s.bestDayStreak || 0) >= 7,
        },
        {
            id: 'play_30_days',
            title: 'ماهی',
            description: 'سی روز پشت سر هم بازی کنید',
            icon: '🗓️', rarity: 'LEGENDARY',
            check: (s) => (s.bestDayStreak || 0) >= 30,
        },
        {
            id: 'play_night_owl',
            title: 'جغد شب',
            description: 'ساعت ۴ صبح بازی کنید',
            icon: '🦉', rarity: 'EPIC',
            check: (s) => (s.playHours || []).includes(4),
        },
        {
            id: 'play_early_bird',
            title: 'سحرگاه',
            description: 'ساعت ۶ صبح بازی کنید',
            icon: '🐦', rarity: 'UNCOMMON',
            check: (s) => (s.playHours || []).includes(6),
        },
        {
            id: 'play_all_hours',
            title: 'بی‌خواب',
            description: 'در ۱۲ ساعت مختلف بازی کنید',
            icon: '🕐', rarity: 'EPIC',
            check: (s) => (s.playHours || []).length >= 12,
        },

        // ========== SOCIAL (2) ==========
        {
            id: 'pvp_5',
            title: 'رفاقت',
            description: 'پنج بازی دو نفره انجام دهید',
            icon: '👥', rarity: 'COMMON',
            check: (s) => s.pvp && s.pvp.games >= 5,
        },
        {
            id: 'pvp_20',
            title: 'همنشین',
            description: 'بیست بازی دو نفره انجام دهید',
            icon: '👬', rarity: 'UNCOMMON',
            check: (s) => s.pvp && s.pvp.games >= 20,
        },

        // ========== TECHNICAL (5) ==========
        {
            id: 'offline_10',
            title: 'آفلاین',
            description: 'ده بازی آفلاین انجام دهید',
            icon: '✈️', rarity: 'UNCOMMON',
            check: (s) => (s.offlineGames || 0) >= 10,
        },
        {
            id: 'export_data',
            title: 'پشتیبان‌گیر',
            description: 'داده‌های خود را صادر کنید',
            icon: '📤', rarity: 'COMMON',
            check: (s) => (s.exportCount || 0) >= 1,
        },
        {
            id: 'import_data',
            title: 'بازیاب',
            description: 'داده‌ها را وارد کنید',
            icon: '📥', rarity: 'COMMON',
            check: (s) => (s.importCount || 0) >= 1,
        },
        {
            id: 'keyboard_master',
            title: 'کیبوردباز',
            description: 'از ۴ میان‌بر مختلف صفحه‌کلید استفاده کنید',
            icon: '⌨️', rarity: 'UNCOMMON',
            check: (s) => (s.keyboardShortcutsUsed || []).length >= 4,
        },
        {
            id: 'all_shortcuts',
            title: 'نابغه',
            description: 'از همه ۵ میان‌بر صفحه‌کلید استفاده کنید',
            icon: '🎹', rarity: 'RARE',
            check: (s) => (s.keyboardShortcutsUsed || []).length >= 5,
        },

        // ========== LEVEL/XP (4) ==========
        {
            id: 'level_5',
            title: 'تجربه‌اندوز',
            description: 'به لول ۵ برسید',
            icon: '⭐', rarity: 'COMMON',
            check: (s) => (s.level || 1) >= 5,
        },
        {
            id: 'level_10',
            title: 'پیشرو',
            description: 'به لول ۱۰ برسید',
            icon: '🌟', rarity: 'UNCOMMON',
            check: (s) => (s.level || 1) >= 10,
        },
        {
            id: 'level_25',
            title: 'استادکار',
            description: 'به لول ۲۵ برسید',
            icon: '✨', rarity: 'RARE',
            check: (s) => (s.level || 1) >= 25,
        },
        {
            id: 'level_50',
            title: 'افسانه',
            description: 'به لول ۵۰ برسید',
            icon: '💫', rarity: 'LEGENDARY',
            check: (s) => (s.level || 1) >= 50,
        },

        // ========== SECRET (5) ==========
        {
            id: 'logo_clicker',
            title: 'کنجکاو',
            description: '۱۰ بار روی لوگو کلیک کنید',
            icon: '🔍', rarity: 'SECRET',
            check: (s) => (s.logoClicks || 0) >= 10,
        },
        {
            id: 'nowruz',
            title: 'نوروز مبارک',
            description: 'در روز نوروز بازی کنید (۲۰ یا ۲۱ مارس)',
            icon: '🌷', rarity: 'SECRET',
            check: (s) => {
                const now = new Date();
                const m = now.getMonth() + 1;
                const d = now.getDate();
                return (m === 3 && (d === 20 || d === 21));
            },
        },
        {
            id: 'weekend_warrior',
            title: 'آخرهفته‌گرد',
            description: 'روز جمعه یا شنبه بازی کنید',
            icon: '🎉', rarity: 'COMMON',
            check: (s) => {
                const day = new Date().getDay();
                return day === 5 || day === 6; // Friday or Saturday in JS (Sun=0)
            },
        },
        {
            id: 'unbeatable',
            title: 'شکست‌ناپذیر',
            description: 'بدون باخت، ۱۰ بازی پیروز شوید',
            icon: '🛡️', rarity: 'EPIC',
            check: (s) => s.wins >= 10 && s.losses === 0,
        },
        {
            id: 'draw_master',
            title: 'صلح‌جو',
            description: 'پنج بازی مساوی داشته باشید',
            icon: '🕊️', rarity: 'UNCOMMON',
            check: (s) => s.draws >= 5,
        },

        // ========== BOARD VARIANTS (3) ==========
        {
            id: 'try_4x4',
            title: 'کاوشگر',
            description: 'یک بازی در بورد ۴×۴ انجام دهید',
            icon: '🔲', rarity: 'UNCOMMON',
            check: (s) => (s.board4x4Games || 0) >= 1,
        },
        {
            id: 'try_5x5',
            title: 'ماجراجو',
            description: 'یک بازی در بورد ۵×۵ انجام دهید',
            icon: '🔳', rarity: 'RARE',
            check: (s) => (s.board5x5Games || 0) >= 1,
        },
        {
            id: 'variants_master',
            title: 'همه‌کاره',
            description: 'در هر سه اندازه بورد بازی کنید',
            icon: '🎯', rarity: 'EPIC',
            check: (s) => (s.board3x3Games || 0) >= 1 && (s.board4x4Games || 0) >= 1 && (s.board5x5Games || 0) >= 1,
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
            rarity: def.rarity || 'COMMON',
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

    function getByRarity(rarity) {
        return DEFS.filter(d => d.rarity === rarity);
    }

    function getRarityInfo() {
        return RARITY;
    }

    return {
        DEFS,
        RARITY,
        checkAll,
        getAll,
        getUnlockedCount,
        getTotalCount,
        getByRarity,
        getRarityInfo,
        setSoundHook(fn) { onUnlockSound = fn; },
        setToastHook(fn) { onToast = fn; },
    };
})();
