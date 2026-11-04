/* ============================================
   SERVER/TOURNAMENT.JS - Weekly tournament system
   Single-elimination bracket with ELO-based seeding
   ============================================ */

const { v4: uuidv4 } = require('uuid');

function create(io, store, presence, GameRoom, ELO) {
    // Active tournaments: id -> tournament
    const tournaments = new Map();
    // Current weekly tournament
    let weeklyTournament = null;

    const SIGNUP_DURATION = 24 * 60 * 60 * 1000; // 24h signup
    const ROUND_DURATION = 30 * 60 * 1000; // 30 min per round
    const MIN_PLAYERS = 4;
    const MAX_PLAYERS = 64;

    /**
     * Create a new weekly tournament.
     */
    function createWeekly() {
        const id = uuidv4();
        const now = Date.now();
        const tournament = {
            id,
            name: 'تورنمنت هفتگی ' + new Date().toLocaleDateString('fa-IR'),
            createdAt: now,
            signupDeadline: now + SIGNUP_DURATION,
            status: 'signup', // signup | running | finished
            participants: [],  // [{ username, elo, seed }]
            bracket: [],       // array of rounds, each round is array of matches
            currentRound: 0,
            champion: null,
            winners: [],
        };
        tournaments.set(id, tournament);
        weeklyTournament = tournament;
        io.emit('tournament:created', { id, name: tournament.name, signupDeadline: tournament.signupDeadline });
        return tournament;
    }

    /**
     * Get the current weekly tournament (create if none).
     */
    function getWeekly() {
        if (!weeklyTournament || weeklyTournament.status === 'finished') {
            createWeekly();
        }
        return weeklyTournament;
    }

    /**
     * Sign up a player for the tournament.
     */
    function signup(username) {
        const t = getWeekly();
        if (t.status !== 'signup') return { ok: false, error: 'ثبت‌نام بسته شده' };
        if (t.participants.find(p => p.username === username)) {
            return { ok: false, error: 'قبلاً ثبت‌نام کرده‌اید' };
        }
        if (t.participants.length >= MAX_PLAYERS) {
            return { ok: false, error: 'ظرفیت تورنمنت پر شده' };
        }
        const user = store.users.get(username);
        if (!user) return { ok: false, error: 'کاربر یافت نشد' };
        t.participants.push({
            username,
            elo: user.elo,
            seed: t.participants.length + 1,
        });
        io.emit('tournament:signup', { username, count: t.participants.length });
        return { ok: true, count: t.participants.length };
    }

    /**
     * Start the tournament: seed players, create bracket.
     */
    function startTournament() {
        const t = getWeekly();
        if (t.status !== 'signup') return { ok: false, error: 'تورنمنت قابل شروع نیست' };
        if (t.participants.length < MIN_PLAYERS) {
            return { ok: false, error: 'حداقل ' + MIN_PLAYERS + ' بازیکن لازم است' };
        }

        // Sort by ELO for seeding (best first)
        t.participants.sort((a, b) => b.elo - a.elo);
        t.participants.forEach((p, i) => { p.seed = i + 1; });

        // Generate single-elimination bracket
        t.bracket = generateBracket(t.participants);
        t.status = 'running';
        t.currentRound = 0;
        io.emit('tournament:started', { id: t.id, bracket: t.bracket });
        return { ok: true };
    }

    /**
     * Generate single-elimination bracket.
     * Returns array of rounds, each round is array of matches.
     */
    function generateBracket(participants) {
        // Pad to next power of 2 with byes
        let size = 2;
        while (size < participants.length) size *= 2;
        const rounds = [];
        const firstRound = [];
        for (let i = 0; i < size / 2; i++) {
            const p1 = participants[i];
            const p2 = participants[size - 1 - i];
            firstRound.push({
                id: uuidv4(),
                round: 0,
                matchIndex: i,
                player1: p1 ? p1.username : null,
                player2: p2 ? p2.username : null,
                winner: null,
                status: p1 && p2 ? 'pending' : (p1 ? 'bye' : 'bye'),
                roomId: null,
            });
        }
        rounds.push(firstRound);
        // Create empty rounds for the rest
        let prevSize = size / 2;
        while (prevSize > 1) {
            prevSize /= 2;
            const round = [];
            for (let i = 0; i < prevSize; i++) {
                round.push({
                    id: uuidv4(),
                    round: rounds.length,
                    matchIndex: i,
                    player1: null,
                    player2: null,
                    winner: null,
                    status: 'pending',
                    roomId: null,
                });
            }
            rounds.push(round);
        }
        return rounds;
    }

    /**
     * Get tournament info.
     */
    function getInfo() {
        const t = getWeekly();
        return {
            id: t.id,
            name: t.name,
            status: t.status,
            signupDeadline: t.signupDeadline,
            participantsCount: t.participants.length,
            bracket: t.bracket,
            currentRound: t.currentRound,
            champion: t.champion,
        };
    }

    /**
     * Get participant list.
     */
    function getParticipants() {
        const t = getWeekly();
        return t.participants;
    }

    /**
     * Record a match result and advance the bracket.
     */
    function recordResult(matchId, winnerUsername) {
        const t = getWeekly();
        if (t.status !== 'running') return { ok: false, error: 'تورنمنت در حال اجرا نیست' };

        // Find match
        let match = null;
        let roundIdx = -1;
        let matchIdx = -1;
        for (let r = 0; r < t.bracket.length; r++) {
            for (let m = 0; m < t.bracket[r].length; m++) {
                if (t.bracket[r][m].id === matchId) {
                    match = t.bracket[r][m];
                    roundIdx = r;
                    matchIdx = m;
                    break;
                }
            }
            if (match) break;
        }
        if (!match) return { ok: false, error: 'مسابقه یافت نشد' };

        match.winner = winnerUsername;
        match.status = 'finished';
        io.emit('tournament:match-result', { matchId, winner: winnerUsername });

        // Advance winner to next round
        if (roundIdx < t.bracket.length - 1) {
            const nextMatchIdx = Math.floor(matchIdx / 2);
            const nextMatch = t.bracket[roundIdx + 1][nextMatchIdx];
            if (matchIdx % 2 === 0) {
                nextMatch.player1 = winnerUsername;
            } else {
                nextMatch.player2 = winnerUsername;
            }
        }

        // Check if round is complete
        const currentRoundMatches = t.bracket[roundIdx];
        const allDone = currentRoundMatches.every(m => m.status === 'finished' || m.status === 'bye');
        if (allDone) {
            // Check if tournament is over (final match)
            if (roundIdx === t.bracket.length - 1) {
                t.champion = winnerUsername;
                t.status = 'finished';
                t.winners.push(winnerUsername);
                io.emit('tournament:finished', { champion: winnerUsername });
                // Award champion (could give bonus ELO)
                const champUser = store.users.get(winnerUsername);
                if (champUser) {
                    champUser.elo += 50; // champion bonus
                }
            } else {
                t.currentRound = roundIdx + 1;
                io.emit('tournament:round-complete', { round: roundIdx, nextRound: t.currentRound });
                // Auto-start byes in next round
                autoAdvanceByes(t);
            }
        }
        return { ok: true };
    }

    /**
     * Auto-advance players with byes (no opponent).
     */
    function autoAdvanceByes(t) {
        const round = t.bracket[t.currentRound];
        for (const match of round) {
            if (match.status === 'pending') {
                if (match.player1 && !match.player2) {
                    match.winner = match.player1;
                    match.status = 'bye';
                } else if (match.player2 && !match.player1) {
                    match.winner = match.player2;
                    match.status = 'bye';
                }
            }
        }
    }

    /**
     * Check if signup deadline has passed and auto-start.
     */
    function checkAutoStart() {
        const t = weeklyTournament;
        if (!t || t.status !== 'signup') return;
        if (Date.now() >= t.signupDeadline && t.participants.length >= MIN_PLAYERS) {
            startTournament();
        }
    }

    // Auto-check every minute
    setInterval(checkAutoStart, 60 * 1000);

    return {
        createWeekly,
        getWeekly,
        signup,
        startTournament,
        getInfo,
        getParticipants,
        recordResult,
        tournaments,
    };
}

module.exports = { create };
