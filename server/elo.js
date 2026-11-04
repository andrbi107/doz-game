/* ============================================
   SERVER/ELO.JS - ELO rating calculation
   Standard ELO formula with K=32
   ============================================ */

const K = 32;
const DEFAULT_ELO = 1200;

/**
 * Calculate expected score for player A vs player B.
 * EA = 1 / (1 + 10^((RB - RA) / 400))
 */
function expectedScore(ratingA, ratingB) {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Update ELO ratings after a game.
 * @param {number} winnerElo
 * @param {number} loserElo
 * @returns {{ newWinnerElo: number, newLoserElo: number, change: number }}
 */
function update(winnerElo, loserElo) {
    const expectedWinner = expectedScore(winnerElo, loserElo);
    const expectedLoser = expectedScore(loserElo, winnerElo);

    const newWinnerElo = Math.round(winnerElo + K * (1 - expectedWinner));
    const newLoserElo = Math.round(loserElo + K * (0 - expectedLoser));

    return {
        newWinnerElo,
        newLoserElo,
        change: newWinnerElo - winnerElo,
    };
}

/**
 * Update for a draw.
 */
function updateDraw(ratingA, ratingB) {
    const expectedA = expectedScore(ratingA, ratingB);
    const expectedB = expectedScore(ratingB, ratingA);

    const newRatingA = Math.round(ratingA + K * (0.5 - expectedA));
    const newRatingB = Math.round(ratingB + K * (0.5 - expectedB));

    return {
        newRatingA,
        newRatingB,
        changeA: newRatingA - ratingA,
    };
}

/**
 * Get rank tier from ELO.
 */
function getTier(elo) {
    if (elo >= 2400) return { name: 'الماس', icon: '💎', color: '#06b6d4' };
    if (elo >= 2000) return { name: 'پلاتین', icon: '🥈', color: '#94a3b8' };
    if (elo >= 1700) return { name: 'طلایی', icon: '🥇', color: '#f59e0b' };
    if (elo >= 1400) return { name: 'نقره‌ای', icon: '⚪', color: '#cbd5e1' };
    return { name: 'برنزی', icon: '🥉', color: '#b45309' };
}

module.exports = {
    K,
    DEFAULT_ELO,
    expectedScore,
    update,
    updateDraw,
    getTier,
};
