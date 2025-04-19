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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

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
async function createUser(id, username, accessToken, refreshToken) {
    await pool.query(
        'INSERT INTO users (id, username, access_token, refresh_token) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET access_token = $3, refresh_token = $4',
        [id, username, accessToken, refreshToken]
    );
}

async function getUser(id) {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
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
    getUser
}; 