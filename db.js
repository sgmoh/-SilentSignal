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
        // Create owner_credentials table if it doesn't exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS owner_credentials (
                username TEXT PRIMARY KEY,
                password TEXT NOT NULL
            )
        `);

        // Check if credentials exist
        const existing = await pool.query(
            'SELECT * FROM owner_credentials WHERE username = $1',
            [process.env.OWNER_USERNAME || 'ghsman']
        );

        // Only insert if credentials don't exist
        if (existing.rows.length === 0) {
            const username = process.env.OWNER_USERNAME || 'ghsman';
            const password = process.env.OWNER_PASSWORD || 'ghsman';
            
            await pool.query(
                'INSERT INTO owner_credentials (username, password) VALUES ($1, $2)',
                [username, password]
            );
            console.log('Created owner credentials');
        } else {
            console.log('Owner credentials already exist');
        }

        console.log('Database initialized successfully');
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
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error verifying owner credentials:', error);
        return false;
    }
}

module.exports = {
    pool,
    initializeDatabase,
    verifyOwnerCredentials
}; 