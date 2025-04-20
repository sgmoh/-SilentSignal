const { Pool } = require('pg');

const pool = new Pool({
    connectionString: 'postgresql://SilentSignal_owner:npg_b0qYX6exAyHV@ep-fancy-night-a4q2m423-pooler.us-east-1.aws.neon.tech/SilentSignal?sslmode=require'
});

// Initialize database
async function initializeDatabase() {
    try {
        // Drop existing table if it exists
        await pool.query('DROP TABLE IF EXISTS owner_credentials');

        // Create owner credentials table with correct schema
        await pool.query(`
            CREATE TABLE owner_credentials (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Set up owner credentials
        const username = 'ghsman';
        const password = 'ghsman';

        // Insert new credentials
        await pool.query(`
            INSERT INTO owner_credentials (username, password)
            VALUES ($1, $2)
        `, [username, password]);

        console.log('Database initialized with owner credentials');
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