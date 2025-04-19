const { Client, GatewayIntentBits, Partials } = require('discord.js');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { initializeDatabase, createSession, getSession, deleteSession, cleanupExpiredSessions, createUser, getUser, isUserOwner, logDM, getDMHistory, getDMStats, logBotReply, getBotReplies, verifyOwnerCredentials } = require('./db');
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

// Handle incoming messages
client.on('messageCreate', async message => {
    // Only handle DMs
    if (message.channel.type !== 'DM') return;
    
    // Don't handle bot's own messages
    if (message.author.bot) return;

    try {
        // Log the reply
        await logBotReply(
            message.author.id,
            message.author.username,
            message.content
        );
    } catch (error) {
        console.error('Error logging bot reply:', error);
    }
});

// Create HTTP server
const server = http.createServer(async (req, res) => {
    // Handle OAuth2 callback
    if (req.url.startsWith('/api/auth/callback')) {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const code = url.searchParams.get('code');
        
        if (!code) {
            res.writeHead(400);
            res.end('Missing authorization code');
            return;
        }

        try {
            // Exchange code for access token
            const tokenResponse = await fetch('https://discord.com/api/oauth2/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: process.env.CLIENT_ID,
                    client_secret: process.env.CLIENT_SECRET,
                    grant_type: 'authorization_code',
                    code: code,
                    redirect_uri: `${process.env.REDIRECT_URI}/api/auth/callback`
                })
            });

            const tokenData = await tokenResponse.json();
            
            // Get user info
            const userResponse = await fetch('https://discord.com/api/users/@me', {
                headers: {
                    Authorization: `Bearer ${tokenData.access_token}`
                }
            });
            
            const userData = await userResponse.json();
            
            // Check if user is owner
            const isOwner = userData.id === process.env.OWNER_ID;
            
            // Create or update user in database
            await createUser({
                id: userData.id,
                username: userData.username,
                discriminator: userData.discriminator,
                avatar: userData.avatar,
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires_at: new Date(Date.now() + tokenData.expires_in * 1000),
                is_owner: isOwner
            });

            // Generate session token
            const sessionToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
            
            // Store session
            sessions.set(sessionToken, {
                userId: userData.id,
                isOwner: isOwner,
                expiresAt: expiresAt
            });
            
            // Set session cookie
            res.setHeader('Set-Cookie', `session=${sessionToken}; HttpOnly; Path=/; Max-Age=${24 * 60 * 60}`);
            
            // Redirect to appropriate page
            if (isOwner) {
                res.writeHead(302, { Location: '/owner.html' });
            } else {
                res.writeHead(302, { Location: '/index.html' });
            }
            res.end();
        } catch (error) {
            console.error('Auth error:', error);
            res.writeHead(500);
            res.end('Authentication failed');
        }
        return;
    }

    // Add a redirect handler for the old auth URL
    if (req.url.startsWith('/auth')) {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const code = url.searchParams.get('code');
        if (code) {
            res.writeHead(302, {
                Location: `/api/auth/callback?code=${code}`
            });
            res.end();
            return;
        }
    }

    // Handle owner API routes
    if (req.url.startsWith('/api/owner/')) {
        // Check for session cookie
        const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = value;
            return acc;
        }, {}) || {};

        if (!cookies.session) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Not authenticated' }));
            return;
        }

        const session = await getSession(cookies.session);
        if (!session) {
            res.writeHead(401);
            res.end(JSON.stringify({ error: 'Session expired' }));
            return;
        }

        // Check if user is owner
        const isOwner = await isUserOwner(session.user_id);
        if (!isOwner) {
            res.writeHead(403);
            res.end(JSON.stringify({ error: 'Access denied' }));
            return;
        }

        // Add new endpoints for server and member selection
        if (req.url === '/api/owner/servers') {
            const servers = client.guilds.cache.map(guild => ({
                id: guild.id,
                name: guild.name,
                icon: guild.iconURL()
            }));
            
            res.writeHead(200);
            res.end(JSON.stringify({ servers }));
            return;
        }

        if (req.url.match(/^\/api\/owner\/servers\/([^\/]+)\/members$/)) {
            const serverId = req.url.match(/^\/api\/owner\/servers\/([^\/]+)\/members$/)[1];
            const guild = client.guilds.cache.get(serverId);
            
            if (!guild) {
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Server not found' }));
                return;
            }

            // Fetch all members
            await guild.members.fetch();
            
            const members = guild.members.cache.map(member => ({
                id: member.id,
                username: member.user.username,
                discriminator: member.user.discriminator,
                avatar: member.user.displayAvatarURL({ size: 32 }),
                bot: member.user.bot
            })).filter(member => !member.bot); // Exclude bot accounts

            res.writeHead(200);
            res.end(JSON.stringify({ members }));
            return;
        }

        // Handle owner routes
        if (req.url === '/api/owner/check') {
            res.writeHead(200);
            res.end(JSON.stringify({ status: 'ok' }));
            return;
        }

        if (req.url === '/api/owner/dm-history') {
            const history = await getDMHistory();
            res.writeHead(200);
            res.end(JSON.stringify({ history }));
            return;
        }

        if (req.url === '/api/owner/stats') {
            const stats = await getDMStats();
            stats.serverCount = client.guilds.cache.size;
            res.writeHead(200);
            res.end(JSON.stringify(stats));
            return;
        }

        if (req.url === '/api/owner/bulk-dm' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                try {
                    const { userIds, message } = JSON.parse(body);
                    const results = [];
                    
                    for (const userId of userIds) {
                        try {
                            const user = await client.users.fetch(userId);
                            await user.send(message);
                            await logDM(session.user_id, userId, user.username, message);
                            results.push({ userId, status: 'success' });
                        } catch (error) {
                            results.push({ userId, status: 'error', error: error.message });
                        }
                    }
                    
                    res.writeHead(200);
                    res.end(JSON.stringify({ 
                        response: `Bulk DM completed. Results: ${results.filter(r => r.status === 'success').length} successful, ${results.filter(r => r.status === 'error').length} failed.`,
                        results
                    }));
                } catch (error) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Invalid request' }));
                }
            });
            return;
        }

        if (req.url === '/api/owner/bot-replies') {
            const replies = await getBotReplies();
            res.writeHead(200);
            res.end(JSON.stringify({ replies }));
            return;
        }

        if (req.url === '/api/owner/login' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', async () => {
                try {
                    const { username, password } = JSON.parse(body);
                    const credentials = await verifyOwnerCredentials(username, password);
                    
                    if (!credentials) {
                        res.writeHead(401);
                        res.end(JSON.stringify({ error: 'Invalid credentials' }));
                        return;
                    }

                    // Create a session for the owner
                    const sessionToken = crypto.randomBytes(32).toString('hex');
                    await createSession(sessionToken, 'owner-' + credentials.id);

                    res.writeHead(200);
                    res.end(JSON.stringify({ token: sessionToken }));
                } catch (error) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Invalid request' }));
                }
            });
            return;
        }

        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
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
    if (req.url === '/commands.html' || req.url === '/owner.html' || req.url === '/') {
        const cookies = req.headers.cookie?.split(';').reduce((acc, cookie) => {
            const [key, value] = cookie.trim().split('=');
            acc[key] = value;
            return acc;
        }, {}) || {};

        if (!cookies.session) {
            res.writeHead(302, {
                'Location': req.url === '/owner.html' ? '/owner-login.html' : '/index.html'
            });
            res.end();
            return;
        }

        const session = await getSession(cookies.session);
        if (!session) {
            res.writeHead(302, {
                'Location': req.url === '/owner.html' ? '/owner-login.html' : '/index.html'
            });
            res.end();
            return;
        }

        // Check if user is owner for owner.html
        if (req.url === '/owner.html') {
            const isOwner = await isUserOwner(session.user_id) || session.user_id.startsWith('owner-');
            if (!isOwner) {
                res.writeHead(302, {
                    'Location': '/commands.html'
                });
                res.end();
                return;
            }
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
                    await logDM(user.id, userId, targetUser.username, message);
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