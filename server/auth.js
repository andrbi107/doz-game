/* ============================================
   SERVER/AUTH.JS - Authentication module
   JWT-based auth with bcrypt password hashing
   ============================================ */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const TOKEN_EXPIRY = '24h';
const REFRESH_EXPIRY_DAYS = 30;

function hashPassword(password) {
    return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
    return bcrypt.compareSync(password, hash);
}

function generateToken(userId, username, secret) {
    return jwt.sign({ userId, username }, secret, { expiresIn: TOKEN_EXPIRY });
}

function verifyToken(token, secret) {
    return jwt.verify(token, secret);
}

/**
 * Register a new user.
 */
function register(req, res, store, secret) {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });
    }
    if (username.length < 3 || username.length > 20) {
        return res.status(400).json({ error: 'نام کاربری باید ۳ تا ۲۰ کاراکتر باشد' });
    }
    if (password.length < 6) {
        return res.status(400).json({ error: 'رمز عبور باید حداقل ۶ کاراکتر باشد' });
    }
    if (store.users.has(username)) {
        return res.status(409).json({ error: 'این نام کاربری قبلاً ثبت شده' });
    }
    const userId = uuidv4();
    const passwordHash = hashPassword(password);
    const user = {
        id: userId,
        username,
        passwordHash,
        elo: 1200,
        wins: 0,
        losses: 0,
        draws: 0,
        createdAt: new Date().toISOString(),
    };
    store.users.set(username, user);
    const token = generateToken(userId, username, secret);
    res.json({
        token,
        user: {
            id: userId,
            username,
            elo: user.elo,
            wins: user.wins,
            losses: user.losses,
            draws: user.draws,
        },
    });
}

/**
 * Login existing user.
 */
function login(req, res, store, secret) {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'نام کاربری و رمز عبور الزامی است' });
    }
    const user = store.users.get(username);
    if (!user || !verifyPassword(password, user.passwordHash)) {
        return res.status(401).json({ error: 'نام کاربری یا رمز عبور اشتباه است' });
    }
    const token = generateToken(user.id, user.username, secret);
    res.json({
        token,
        user: {
            id: user.id,
            username: user.username,
            elo: user.elo,
            wins: user.wins,
            losses: user.losses,
            draws: user.draws,
        },
    });
}

function refresh(req, res, store, secret) {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });
    try {
        const payload = verifyToken(token, secret);
        const newToken = generateToken(payload.userId, payload.username, secret);
        res.json({ token: newToken });
    } catch (e) {
        res.status(401).json({ error: 'Invalid token' });
    }
}

function getProfile(req, res, store) {
    const { username } = req.params;
    const user = store.users.get(username);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
        username: user.username,
        elo: user.elo,
        wins: user.wins,
        losses: user.losses,
        draws: user.draws,
        createdAt: user.createdAt,
    });
}

module.exports = {
    register,
    login,
    refresh,
    getProfile,
    verifyToken,
    generateToken,
    hashPassword,
    verifyPassword,
};
