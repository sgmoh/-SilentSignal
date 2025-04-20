const http = require('http');
const fs = require('fs');
const path = require('path');
const { initializeDatabase, verifyOwnerCredentials } = require('./db');
const { client } = require('./discord');

// Initialize database
initializeDatabase().catch(console.error);

// Create HTTP server
const server = http.createServer(async (req, res) => {
    // Handle API routes
    if (req.url.startsWith('/api/owner/servers')) {
        if (req.url === '/api/owner/servers') {
            // Get all servers
            try {
                if (!client.isReady()) {
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Bot is not ready, please try again' }));
                    return;
                }

                const servers = client.guilds.cache.map(guild => ({
                    id: guild.id,
                    name: guild.name,
                    icon: guild.iconURL(),
                    memberCount: guild.memberCount
                }));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(servers));
            } catch (error) {
                console.error('Error fetching servers:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to fetch servers' }));
            }
        } else if (req.url.match(/^\/api\/owner\/servers\/([^\/]+)\/members$/)) {
            // Get members from a specific server
            const guildId = req.url.match(/^\/api\/owner\/servers\/([^\/]+)\/members$/)[1];
            try {
                if (!client.isReady()) {
                    res.writeHead(503, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Bot is not ready, please try again' }));
                    return;
                }

                const guild = client.guilds.cache.get(guildId);
                if (!guild) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Server not found' }));
                    return;
                }

                await guild.members.fetch();
                const members = guild.members.cache.map(member => ({
                    id: member.user.id,
                    username: member.user.username,
                    discriminator: member.user.discriminator,
                    avatar: member.user.displayAvatarURL(),
                    bot: member.user.bot
                }));

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(members));
            } catch (error) {
                console.error('Error fetching members:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Failed to fetch members' }));
            }
        }
        return;
    }

    // Handle owner login
    if (req.url === '/api/owner/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const { username, password } = JSON.parse(body);
                const isValid = await verifyOwnerCredentials(username, password);
                
                if (!isValid) {
                    res.writeHead(401);
                    res.end(JSON.stringify({ error: 'Invalid credentials' }));
                    return;
                }

                res.writeHead(200);
                res.end(JSON.stringify({ success: true }));
            } catch (error) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid request' }));
            }
        });
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
        case '.jpg':
        case '.jpeg':
            contentType = 'image/jpeg';
            break;
        case '.gif':
            contentType = 'image/gif';
            break;
        case '.ico':
            contentType = 'image/x-icon';
            break;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if(error.code === 'ENOENT') {
                fs.readFile('./404.html', (error, content) => {
                    res.writeHead(404, { 'Content-Type': 'text/html' });
                    res.end(content, 'utf-8');
                });
            } else {
                res.writeHead(500);
                res.end('Server Error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Handle server errors
server.on('error', (error) => {
    console.error('Server error:', error);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
}); 