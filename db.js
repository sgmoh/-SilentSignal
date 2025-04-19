const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://SilentSignal_owner:npg_b0qYX6exAyHV@ep-fancy-night-a4q2m423-pooler.us-east-1.aws.neon.tech/SilentSignal?sslmode=require'
});

// Create necessary tables if they don't exist
async function initializeDatabase() {
    try {
        // Create sessions table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP NOT NULL
            )
        `);

        // Create users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL,
                access_token TEXT NOT NULL,
                refresh_token TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                is_owner BOOLEAN DEFAULT FALSE
            )
        `);

        // Create owner credentials table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS owner_credentials (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create DM history table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS dm_history (
                id SERIAL PRIMARY KEY,
                sender_id TEXT NOT NULL,
                receiver_id TEXT NOT NULL,
                receiver_username TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (sender_id) REFERENCES users(id)
            )
        `);

        // Create bot replies table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS bot_replies (
                id SERIAL PRIMARY KEY,
                user_id TEXT NOT NULL,
                username TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Insert default owner credentials if not exists
        const crypto = require('crypto');
        const defaultPassword = 'ghsman';
        const passwordHash = crypto.createHash('sha256').update(defaultPassword).digest('hex');
        
        await pool.query(`
            INSERT INTO owner_credentials (username, password_hash)
            VALUES ('admin', $1)
            ON CONFLICT (username) DO NOTHING
        `, [passwordHash]);

        console.log('Database initialized successfully');
    } catch (error) {
        console.error('Error initializing database:', error);
    }
}

// Session management functions
async function createSession(token, userId) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours from now

    await pool.query(
        'INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)',
        [token, userId, expiresAt]
    );
}

async function getSession(token) {
    const result = await pool.query(
        'SELECT * FROM sessions WHERE token = $1 AND expires_at > CURRENT_TIMESTAMP',
        [token]
    );
    return result.rows[0];
}

async function deleteSession(token) {
    await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
}

async function cleanupExpiredSessions() {
    await pool.query('DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP');
}

// User management functions
async function createUser(id, username, accessToken, refreshToken, isOwner = false) {
    await pool.query(
        'INSERT INTO users (id, username, access_token, refresh_token, is_owner) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (id) DO UPDATE SET access_token = $3, refresh_token = $4, is_owner = $5',
        [id, username, accessToken, refreshToken, isOwner]
    );
}

async function getUser(id) {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
}

async function isUserOwner(userId) {
    const result = await pool.query('SELECT is_owner FROM users WHERE id = $1', [userId]);
    return result.rows[0]?.is_owner || false;
}

// DM history functions
async function logDM(senderId, receiverId, receiverUsername, message) {
    await pool.query(
        'INSERT INTO dm_history (sender_id, receiver_id, receiver_username, message) VALUES ($1, $2, $3, $4)',
        [senderId, receiverId, receiverUsername, message]
    );
}

async function getDMHistory(limit = 100) {
    const result = await pool.query(
        'SELECT * FROM dm_history ORDER BY timestamp DESC LIMIT $1',
        [limit]
    );
    return result.rows;
}

// Bot replies functions
async function logBotReply(userId, username, message) {
    await pool.query(
        'INSERT INTO bot_replies (user_id, username, message) VALUES ($1, $2, $3)',
        [userId, username, message]
    );
}

async function getBotReplies(limit = 100) {
    const result = await pool.query(
        'SELECT * FROM bot_replies ORDER BY timestamp DESC LIMIT $1',
        [limit]
    );
    return result.rows;
}

async function getDMStats() {
    const result = await pool.query(`
        SELECT 
            COUNT(*) as total_dms,
            COUNT(DISTINCT receiver_id) as active_users,
            COUNT(*) FILTER (WHERE timestamp > NOW() - INTERVAL '24 hours') as dms_last_24_hours
        FROM dm_history
    `);
    return result.rows[0];
}

// Owner credentials functions
async function verifyOwnerCredentials(username, password) {
    const crypto = require('crypto');
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex');
    
    const result = await pool.query(
        'SELECT * FROM owner_credentials WHERE username = $1 AND password_hash = $2',
        [username, passwordHash]
    );
    return result.rows[0];
}

module.exports = {
    pool,
    initializeDatabase,
    createSession,
    getSession,
    deleteSession,
    cleanupExpiredSessions,
    createUser,
    getUser,
    isUserOwner,
    logDM,
    getDMHistory,
    getDMStats,
    logBotReply,
    getBotReplies,
    verifyOwnerCredentials
}; 