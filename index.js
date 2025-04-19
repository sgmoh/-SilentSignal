const { Client, GatewayIntentBits, Partials } = require('discord.js');
const http = require('http');
const fs = require('fs');
const path = require('path');
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

// Create HTTP server
const server = http.createServer((req, res) => {
    // Handle OAuth2 callback
    if (req.url.startsWith('/auth')) {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const code = url.searchParams.get('code');
        
        if (code) {
            res.writeHead(302, {
                'Location': '/commands.html'
            });
            res.end();
        } else {
            res.writeHead(400);
            res.end('Invalid request');
        }
        return;
    }

    // Handle command API
    if (req.url === '/api/command' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const { command } = JSON.parse(body);
                handleCommand(command, res);
            } catch (error) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid request' }));
            }
        });
        return;
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
async function handleCommand(command, res) {
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
                    const user = await client.users.fetch(userId);
                    await user.send(message);
                    res.writeHead(200);
                    res.end(JSON.stringify({ response: `Message sent to ${user.tag}` }));
                } catch (error) {
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: 'Failed to send message' }));
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
        res.writeHead(500);
        res.end(JSON.stringify({ error: 'Internal server error' }));
    }
}

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Discord bot login
client.login(process.env.DISCORD_TOKEN);

// ... rest of your bot code ... 