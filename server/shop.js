/* ============================================
   SERVER/SHOP.JS - Cosmetic shop with coins
   No pay-to-win: only cosmetic items
   ============================================ */

// Shop items - all cosmetic
const SHOP_ITEMS = [
    // Avatars
    { id: 'av_fox',     type: 'avatar', value: '🦊', name: 'روباه',       price: 100, rarity: 'common' },
    { id: 'av_lion',    type: 'avatar', value: '🦁', name: 'شیر',        price: 200, rarity: 'uncommon' },
    { id: 'av_unicorn', type: 'avatar', value: '🦄', name: 'تک‌شاخ',     price: 300, rarity: 'rare' },
    { id: 'av_dragon',  type: 'avatar', value: '🐲', name: 'اژدها',     price: 500, rarity: 'epic' },
    { id: 'av_eagle',   type: 'avatar', value: '🦅', name: 'عقاب',       price: 250, rarity: 'uncommon' },
    { id: 'av_octopus', type: 'avatar', value: '🐙', name: 'هشت‌پا',     price: 350, rarity: 'rare' },
    { id: 'av_shark',   type: 'avatar', value: '🦈', name: 'کوسه',       price: 400, rarity: 'rare' },
    { id: 'av_crown',   type: 'avatar', value: '👑', name: 'تاج',        price: 800, rarity: 'legendary' },
    { id: 'av_star',    type: 'avatar', value: '🌟', name: 'ستاره',      price: 1000, rarity: 'legendary' },
    // Themes
    { id: 'th_emerald', type: 'theme', value: 'emerald', name: 'تم زمردی',    price: 150, rarity: 'common' },
    { id: 'th_rose',    type: 'theme', value: 'rose',    name: 'تم رز',       price: 200, rarity: 'uncommon' },
    { id: 'th_amber',   type: 'theme', value: 'amber',   name: 'تم کهربایی',  price: 250, rarity: 'uncommon' },
    { id: 'th_cyan',    type: 'theme', value: 'cyan',    name: 'تم فیروزه‌ای', price: 300, rarity: 'rare' },
    { id: 'th_violet',  type: 'theme', value: 'violet',  name: 'تم بنفش',     price: 400, rarity: 'epic' },
    // Emotes
    { id: 'em_cool',    type: 'emote', value: '😎', name: 'کول',    price: 80,  rarity: 'common' },
    { id: 'em_fire',    type: 'emote', value: '🔥', name: 'آتش',    price: 100, rarity: 'common' },
    { id: 'em_diamond', type: 'emote', value: '💎', name: 'الماس', price: 200, rarity: 'uncommon' },
    { id: 'em_party',   type: 'emote', value: '🎉', name: 'جشن',    price: 120, rarity: 'common' },
    // Battle Pass Premium
    { id: 'bp_premium', type: 'battlepass', value: 'premium', name: 'پرمیوم Battle Pass', price: 500, rarity: 'epic' },
];

function create(io, store, battlepass) {
    /**
     * Get all shop items.
     */
    function getItems() {
        return SHOP_ITEMS;
    }

    /**
     * Purchase an item.
     */
    function purchase(username, itemId) {
        const item = SHOP_ITEMS.find(i => i.id === itemId);
        if (!item) return { ok: false, error: 'آیتم یافت نشد' };

        const user = store.users.get(username);
        if (!user) return { ok: false, error: 'کاربر یافت نشد' };

        // Check if already owned (for non-consumables)
        if (item.type !== 'battlepass' && item.type !== 'coins') {
            if (!user.inventory) user.inventory = [];
            const owned = user.inventory.find(i => i.type === item.type && i.value === item.value);
            if (owned) return { ok: false, error: 'این آیتم را دارید' };
        }

        // Check balance
        if ((user.coins || 0) < item.price) {
            return { ok: false, error: 'کوین کافی ندارید' };
        }

        // Deduct coins
        user.coins -= item.price;

        // Apply item
        if (item.type === 'battlepass' && item.value === 'premium') {
            battlepass.activatePremium(username);
        } else {
            if (!user.inventory) user.inventory = [];
            user.inventory.push({ type: item.type, value: item.value, name: item.name });
        }

        return { ok: true, item, coinsLeft: user.coins };
    }

    /**
     * Get user's inventory.
     */
    function getInventory(username) {
        const user = store.users.get(username);
        if (!user) return [];
        return user.inventory || [];
    }

    /**
     * Get user's coin balance.
     */
    function getCoins(username) {
        const user = store.users.get(username);
        return user ? (user.coins || 0) : 0;
    }

    /**
     * Award coins (from achievements, tournaments, etc.)
     */
    function awardCoins(username, amount) {
        const user = store.users.get(username);
        if (!user) return 0;
        user.coins = (user.coins || 0) + amount;
        return user.coins;
    }

    /**
     * Equip an item (set as active avatar/theme).
     */
    function equipItem(username, type, value) {
        const user = store.users.get(username);
        if (!user) return { ok: false, error: 'کاربر یافت نشد' };
        if (!user.inventory) user.inventory = [];
        const owned = user.inventory.find(i => i.type === type && i.value === value);
        if (!owned) return { ok: false, error: 'این آیتم را ندارید' };
        if (!user.equipped) user.equipped = {};
        user.equipped[type] = value;
        return { ok: true };
    }

    /**
     * Get equipped items.
     */
    function getEquipped(username) {
        const user = store.users.get(username);
        if (!user) return {};
        return user.equipped || {};
    }

    return {
        getItems,
        purchase,
        getInventory,
        getCoins,
        awardCoins,
        equipItem,
        getEquipped,
    };
}

module.exports = { create, SHOP_ITEMS };
