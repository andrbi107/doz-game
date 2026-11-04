/* ============================================
   SERVER/LEAGUE.JS - Seasonal league system
   Players compete in tiers, with promotion/relegation
   ============================================ */

const SEASON_DURATION_DAYS = 30;
const SEASON_DURATION_MS = SEASON_DURATION_DAYS * 24 * 60 * 60 * 1000;

const TIERS = [
    { name: 'برنز', minElo: 0, color: '#b45309', icon: '🥉' },
    { name: 'نقره', minElo: 1400, color: '#94a3b8', icon: '⚪' },
    { name: 'طلا', minElo: 1700, color: '#f59e0b', icon: '🥇' },
    { name: 'پلاتین', minElo: 2000, color: '#cbd5e1', icon: '🥈' },
    { name: 'الماس', minElo: 2400, color: '#06b6d4', icon: '💎' },
];

function create(io, store) {
    let currentSeason = null;

    /**
     * Start a new season.
     */
    function startNewSeason() {
        const season = {
            id: Date.now(),
            number: currentSeason ? currentSeason.number + 1 : 1,
            startDate: Date.now(),
            endDate: Date.now() + SEASON_DURATION_MS,
            status: 'active',
            // Per-tier leaderboards
            tiers: TIERS.map(t => ({ ...t, players: [] })),
            // Track season ELO (separate from overall ELO)
            playerSeasonElo: {}, // username -> { seasonElo, wins, losses, draws, gamesPlayed }
            rewards: [],
        };
        currentSeason = season;
        io.emit('league:season-start', { number: season.number, endDate: season.endDate });
        return season;
    }

    /**
     * Get current season (create if none).
     */
    function getCurrentSeason() {
        if (!currentSeason || currentSeason.status !== 'active' || Date.now() > currentSeason.endDate) {
            if (currentSeason && currentSeason.status === 'active' && Date.now() > currentSeason.endDate) {
                endSeason();
            } else {
                startNewSeason();
            }
        }
        return currentSeason;
    }

    /**
     * End the current season - distribute rewards, promote/relegate.
     */
    function endSeason() {
        if (!currentSeason) return;
        currentSeason.status = 'ended';
        // Calculate top performers per tier
        const results = {};
        for (const tier of currentSeason.tiers) {
            const sorted = tier.players.slice().sort((a, b) => b.seasonElo - a.seasonElo);
            results[tier.name] = {
                top3: sorted.slice(0, 3),
                totalPlayers: sorted.length,
            };
        }
        // Award rewards (bonus ELO to top performers)
        for (const tierName in results) {
            const top3 = results[tierName].top3;
            top3.forEach((p, i) => {
                const user = store.users.get(p.username);
                if (user) {
                    const bonus = [100, 50, 25][i] || 0;
                    user.elo += bonus;
                }
            });
        }
        io.emit('league:season-end', { number: currentSeason.number, results });
        return results;
    }

    /**
     * Record a game result in the current season.
     */
    function recordGame(username, result, eloChange) {
        const season = getCurrentSeason();
        if (!season.playerSeasonElo[username]) {
            season.playerSeasonElo[username] = {
                seasonElo: 1200,
                wins: 0,
                losses: 0,
                draws: 0,
                gamesPlayed: 0,
            };
        }
        const ps = season.playerSeasonElo[username];
        ps.gamesPlayed++;
        if (result === 'win') {
            ps.wins++;
            ps.seasonElo += Math.max(eloChange || 16, 8);
        } else if (result === 'loss') {
            ps.losses++;
            ps.seasonElo -= Math.max(eloChange || 16, 8);
            ps.seasonElo = Math.max(0, ps.seasonElo);
        } else {
            ps.draws++;
        }
        // Update tier placement
        updateTierPlacement(season, username, ps.seasonElo);
    }

    /**
     * Update which tier a player belongs to.
     */
    function updateTierPlacement(season, username, seasonElo) {
        // Remove from all tiers
        for (const tier of season.tiers) {
            tier.players = tier.players.filter(p => p.username !== username);
        }
        // Add to correct tier
        let correctTier = season.tiers[0];
        for (const tier of season.tiers) {
            if (seasonElo >= tier.minElo) correctTier = tier;
        }
        correctTier.players.push({
            username,
            seasonElo,
            wins: season.playerSeasonElo[username].wins,
            losses: season.playerSeasonElo[username].losses,
            draws: season.playerSeasonElo[username].draws,
        });
    }

    /**
     * Get player's season stats.
     */
    function getPlayerSeason(username) {
        const season = getCurrentSeason();
        const ps = season.playerSeasonElo[username];
        if (!ps) return null;
        // Find tier
        let tier = season.tiers[0];
        for (const t of season.tiers) {
            if (ps.seasonElo >= t.minElo) tier = t;
        }
        // Find rank within tier
        const sortedTier = tier.players.slice().sort((a, b) => b.seasonElo - a.seasonElo);
        const rank = sortedTier.findIndex(p => p.username === username) + 1;
        return {
            seasonElo: ps.seasonElo,
            wins: ps.wins,
            losses: ps.losses,
            draws: ps.draws,
            gamesPlayed: ps.gamesPlayed,
            tier: tier.name,
            tierIcon: tier.icon,
            tierColor: tier.color,
            rankInTier: rank,
            tierSize: tier.players.length,
        };
    }

    /**
     * Get season info.
     */
    function getSeasonInfo() {
        const season = getCurrentSeason();
        return {
            number: season.number,
            startDate: season.startDate,
            endDate: season.endDate,
            status: season.status,
            daysLeft: Math.ceil((season.endDate - Date.now()) / (24 * 60 * 60 * 1000)),
            totalPlayers: Object.keys(season.playerSeasonElo).length,
        };
    }

    /**
     * Get tier leaderboard.
     */
    function getTierLeaderboard(tierName) {
        const season = getCurrentSeason();
        const tier = season.tiers.find(t => t.name === tierName);
        if (!tier) return [];
        return tier.players.slice().sort((a, b) => b.seasonElo - a.seasonElo).slice(0, 50);
    }

    // Auto-end season when time is up
    setInterval(() => {
        if (currentSeason && currentSeason.status === 'active' && Date.now() > currentSeason.endDate) {
            endSeason();
        }
    }, 60 * 1000);

    return {
        startNewSeason,
        getCurrentSeason,
        endSeason,
        recordGame,
        getPlayerSeason,
        getSeasonInfo,
        getTierLeaderboard,
        TIERS,
    };
}

module.exports = { create, TIERS, SEASON_DURATION_DAYS };
