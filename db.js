const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://SilentSignal_owner:npg_b0qYX6exAyHV@ep-fancy-night-a4q2m423-pooler.us-east-1.aws.neon.tech/SilentSignal?sslmode=require',
    ssl: {
        rejectUnauthorized: false
    }
});

// Initialize database
async function initializeDatabase() {
    try {
        // Create owner credentials table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS owner_credentials (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Set up owner credentials
        const username = 'ghsman';
        const password = 'ghsman';

        // Check if credentials already exist
        const existing = await pool.query(
            'SELECT * FROM owner_credentials WHERE username = $1',
            [username]
        );

        // Only insert if credentials don't exist
        if (existing.rows.length === 0) {
            await pool.query(`
                INSERT INTO owner_credentials (username, password)
                VALUES ($1, $2)
            `, [username, password]);
            console.log('Owner credentials created');
        } else {
            console.log('Owner credentials already exist');
        }

        console.log('Database initialized');
    } catch (error) {
        console.error('Error initializing database:', error);
        throw error;
    }
}

// Simple credential verification
async function verifyOwnerCredentials(username, password) {
    try {
        const result = await pool.query(
            'SELECT * FROM owner_credentials WHERE username = $1 AND password = $2',
            [username, password]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error verifying credentials:', error);
        return null;
    }
}

module.exports = {
    pool,
    initializeDatabase,
    verifyOwnerCredentials
}; 