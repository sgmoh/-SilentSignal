const { Client, GatewayIntentBits, Partials } = require('discord.js');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { initializeDatabase, createSession, getSession, deleteSession, cleanupExpiredSessions, createUser, getUser } = require('./db');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Channel]
});

let botReady = false;

// Initialize database
initializeDatabase();

// Bot ready event
client.once('ready', () => {
    console.log('Bot is ready!');
    botReady = true;
});

// Create HTTP server
const server = http.createServer(async (req, res) => {
    // Handle OAuth2 callback
    if (req.url.startsWith('/auth')) {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const code = url.searchParams.get('code');
        
        if (code) {
            try {
                // Exchange code for tokens
                const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams({
                        client_id: process.env.CLIENT_ID,
                        client_secret: process.env.CLIENT_SECRET,
                        code,
                        grant_type: 'authorization_code',
                        redirect_uri: process.env.REDIRECT_URI,
                        scope: 'identify'
                    }),
                });

                const tokens = await tokenResponse.json();
                
                // Get user info
                const userResponse = await fetch('https://discord.com/api/users/@me', {
                    headers: {
                        Authorization: `Bearer ${tokens.access_token}`,
                    },
                });
                
                const user = await userResponse.json();
                
                // Store user and create session
                await createUser(user.id, user.username, tokens.access_token, tokens.refresh_token);
                
                const sessionToken = crypto.randomBytes(32).toString('hex');
                await createSession(sessionToken, user.id);

                // Set cookie and redirect
                res.writeHead(302, {
                    'Location': '/commands.html',
                    'Set-Cookie': `session=${sessionToken}; Path=/; HttpOnly; SameSite=Strict`
                });
                res.end();
            } catch (error) {
                console.error('Auth error:', error);
                res.writeHead(500);
                res.end('Authentication failed');
            }
        } else {
            res.writeHead(400);
            res.end('Invalid request');
        }
        return;
    }

    // Handle command API
    if (req.url === '/api/command' && req.method === 'POST') {
        if (!botReady) {
            res.writeHead(503);
            res.end(JSON.stringify({ error: 'Bot is not ready yet. Please try again in a few seconds.' }));
            return;
        }

        // Check for session cookie
        const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = value;
            return acc;
        }, {}) || {};

        if (!cookies.session) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Not authenticated. Please log in again.' }));
            return;
        }

        const session = await getSession(cookies.session);
        if (!session) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Session expired. Please log in again.' }));
            return;
        }

        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const { command } = JSON.parse(body);
                const user = await getUser(session.user_id);
                await handleCommand(command, res, user);
            } catch (error) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid request' }));
            }
        });
        return;
    }

    // Check authentication for protected routes
    if (req.url === '/commands.html' || req.url === '/') {
        const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = value;
            return acc;
        }, {}) || {};

        if (!cookies.session) {
            res.writeHead(302, {
                'Location': '/index.html'
            });
            res.end();
            return;
        }

        const session = await getSession(cookies.session);
        if (!session) {
            res.writeHead(302, {
                'Location': '/index.html'
            });
            res.end();
            return;
        }
    }

    // Health check endpoint
    if (req.url === '/health') {
        res.writeHead(200);
        res.end('OK');
        return;
    }

    // Serve static files
    let filePath = '.' + req.url;
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = path.extname(filePath);
    let contentType = 'text/html';
    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
        case '.png':
            contentType = 'image/png';
            break;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if(error.code === 'ENOENT') {
                // Page not found
                fs.readFile('./404.html', (error, content) => {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end(content, 'utf-8');
                });
            } else {
                // Server error
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            // Success
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Command handler
async function handleCommand(command, res, user) {
    try {
        // Parse the command
        const [cmd, ...args] = command.split(' ');
        
        switch (cmd.toLowerCase()) {
            case '.dm':
                if (args.length < 2) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Invalid command format. Use: .dm @user message' }));
                    return;
                }
                
                const userId = args[0].replace(/[<@!>]/g, '');
                const message = args.slice(1).join(' ');
                
                try {
                    const targetUser = await client.users.fetch(userId);
                    await targetUser.send(message);
                    res.writeHead(200);
                    res.end(JSON.stringify({ response: `Message sent to ${targetUser.tag}` }));
                } catch (error) {
                    console.error('Error sending message:', error);
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: `Failed to send message: ${error.message}` }));
                }
                break;
                
            case '.help':
                res.writeHead(200);
                res.end(JSON.stringify({ 
                    response: 'Available commands:\n.dm @user message - Send a DM to a user\n.help - Show this help message' 
                }));
                break;
                
            default:
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Unknown command' }));
        }
    } catch (error) {
        console.error('Command handler error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Internal server error' }));
    }
}

// Clean up expired sessions every hour
setInterval(async () => {
    await cleanupExpiredSessions();
}, 60 * 60 * 1000);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Discord bot login
client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('Failed to login:', error);
    process.exit(1);
}); 