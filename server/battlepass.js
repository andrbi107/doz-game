/* ============================================
   SERVER/BATTLEPASS.JS - Seasonal Battle Pass
   Free and Premium tracks with rewards
   No pay-to-win: only cosmetic rewards
   ============================================ */

const SEASON_DURATION_DAYS = 30;
const BATTLEPASS_LEVELS = 50;
const XP_PER_LEVEL = 500;

// Reward definitions - all cosmetic, no gameplay advantage
const FREE_REWARDS = [
    { level: 1,  type: 'coins', amount: 50, name: '۵۰ کوین' },
    { level: 5,  type: 'avatar', value: '🦊', name: 'آواتار روباه' },
    { level: 10, type: 'coins', amount: 100, name: '۱۰۰ کوین' },
    { level: 15, type: 'emote', value: '😎', name: 'اموجی کول' },
    { level: 20, type: 'theme', value: 'emerald', name: 'تم زمردی' },
    { level: 25, type: 'coins', amount: 150, name: '۱۵۰ کوین' },
    { level: 30, type: 'avatar', value: '🦁', name: 'آواتار شیر' },
    { level: 35, type: 'coins', amount: 200, name: '۲۰۰ کوین' },
    { level: 40, type: 'emote', value: '🔥', name: 'اموجی آتش' },
    { level: 45, type: 'coins', amount: 250, name: '۲۵۰ کوین' },
    { level: 50, type: 'avatar', value: '🐲', name: 'آواتار اژدها (افسانه‌ای)' },
];

const PREMIUM_REWARDS = [
    { level: 1,  type: 'avatar', value: '👑', name: 'آواتار تاج' },
    { level: 5,  type: 'theme', value: 'rose', name: 'تم رز' },
    { level: 10, type: 'avatar', value: '🦄', name: 'آواتار تک‌شاخ' },
    { level: 15, type: 'emote', value: '💎', name: 'اموجی الماس' },
    { level: 20, type: 'theme', value: 'amber', name: 'تم کهربایی' },
    { level: 25, type: 'avatar', value: '🦅', name: 'آواتار عقاب' },
    { level: 30, type: 'theme', value: 'cyan', name: 'تم فیروزه‌ای' },
    { level: 35, type: 'avatar', value: '🐙', name: 'آواتار هشت‌پا' },
    { level: 40, type: 'theme', value: 'violet', name: 'تم بنفش' },
    { level: 45, type: 'avatar', value: '🦈', name: 'آواتار کوسه' },
    { level: 50, type: 'avatar', value: '🌟', name: 'آواتار ستاره افسانه‌ای' },
];

function create(io, store) {
    let currentPass = null;

    function startNewPass() {
        const pass = {
            id: Date.now(),
            season: currentPass ? currentPass.season + 1 : 1,
            startDate: Date.now(),
            endDate: Date.now() + SEASON_DURATION_DAYS * 24 * 60 * 60 * 1000,
            // Per-user: { username: { xp, level, premium, claimed: { free: [], premium: [] } } }
            users: {},
        };
        currentPass = pass;
        io.emit('battlepass:season-start', { season: pass.season, endDate: pass.endDate });
        return pass;
    }

    function getCurrentPass() {
        if (!currentPass || Date.now() > currentPass.endDate) {
            if (currentPass && Date.now() > currentPass.endDate) {
                endPass();
            }
            startNewPass();
        }
        return currentPass;
    }

    function endPass() {
        if (!currentPass) return;
        io.emit('battlepass:season-end', { season: currentPass.season });
    }

    function initUser(pass, username) {
        if (!pass.users[username]) {
            pass.users[username] = {
                xp: 0,
                level: 1,
                premium: false,
                claimed: { free: [], premium: [] },
            };
        }
        return pass.users[username];
    }

    /**
     * Add XP to user's battle pass.
     */
    function addXp(username, xp) {
        const pass = getCurrentPass();
        const user = initUser(pass, username);
        user.xp += xp;
        // Calculate level
        const newLevel = Math.min(BATTLEPASS_LEVELS, Math.floor(user.xp / XP_PER_LEVEL) + 1);
        if (newLevel > user.level) {
            const oldLevel = user.level;
            user.level = newLevel;
            io.emit('battlepass:level-up', { username, level: newLevel });
        }
        return user.level;
    }

    /**
     * Activate premium for a user (after "purchase").
     */
    function activatePremium(username) {
        const pass = getCurrentPass();
        const user = initUser(pass, username);
        user.premium = true;
        return { ok: true };
    }

    /**
     * Claim a reward.
     */
    function claimReward(username, track, level) {
        const pass = getCurrentPass();
        const user = initUser(pass, username);
        if (user.level < level) return { ok: false, error: 'به این لول نرسیده‌اید' };
        if (track === 'premium' && !user.premium) return { ok: false, error: 'پرمیوم فعال نیست' };
        if (user.claimed[track].includes(level)) return { ok: false, error: 'قبلاً گرفته‌اید' };

        const rewards = track === 'premium' ? PREMIUM_REWARDS : FREE_REWARDS;
        const reward = rewards.find(r => r.level === level);
        if (!reward) return { ok: false, error: 'پاداشی برای این لول نیست' };

        user.claimed[track].push(level);

        // Apply reward to user account
        const userAccount = store.users.get(username);
        if (userAccount) {
            if (reward.type === 'coins') {
                userAccount.coins = (userAccount.coins || 0) + reward.amount;
            } else if (reward.type === 'avatar' || reward.type === 'emote' || reward.type === 'theme') {
                if (!userAccount.inventory) userAccount.inventory = [];
                if (!userAccount.inventory.find(i => i.type === reward.type && i.value === reward.value)) {
                    userAccount.inventory.push({ type: reward.type, value: reward.value, name: reward.name });
                }
            }
        }
        return { ok: true, reward };
    }

    /**
     * Get user's battle pass status.
     */
    function getUserPass(username) {
        const pass = getCurrentPass();
        const user = initUser(pass, username);
        const xpInLevel = user.xp % XP_PER_LEVEL;
        return {
            season: pass.season,
            xp: user.xp,
            level: user.level,
            xpInLevel,
            xpForNext: XP_PER_LEVEL,
            progress: xpInLevel / XP_PER_LEVEL,
            premium: user.premium,
            claimed: user.claimed,
            freeRewards: FREE_REWARDS,
            premiumRewards: PREMIUM_REWARDS,
            maxLevel: BATTLEPASS_LEVELS,
            endDate: pass.endDate,
        };
    }

    function getPassInfo() {
        const pass = getCurrentPass();
        return {
            season: pass.season,
            startDate: pass.startDate,
            endDate: pass.endDate,
            maxLevel: BATTLEPASS_LEVELS,
            daysLeft: Math.ceil((pass.endDate - Date.now()) / (24 * 60 * 60 * 1000)),
        };
    }

    return {
        addXp,
        activatePremium,
        claimReward,
        getUserPass,
        getPassInfo,
        FREE_REWARDS,
        PREMIUM_REWARDS,
    };
}

module.exports = { create, BATTLEPASS_LEVELS, XP_PER_LEVEL };
