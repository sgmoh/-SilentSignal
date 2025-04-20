const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
    ]
});

// Handle reconnection
client.on('disconnect', () => {
    console.log('Bot disconnected, attempting to reconnect...');
    client.login(process.env.DISCORD_TOKEN);
});

client.on('error', (error) => {
    console.error('Discord client error:', error);
});

client.once('ready', () => {
    console.log('Bot is ready!');
    // Fetch all members from all guilds
    client.guilds.cache.forEach(guild => {
        guild.members.fetch().catch(console.error);
    });
});

// Keep the bot alive
setInterval(() => {
    if (!client.isReady()) {
        console.log('Bot is not ready, attempting to reconnect...');
        client.login(process.env.DISCORD_TOKEN);
    }
}, 30000); // Check every 30 seconds

client.login(process.env.DISCORD_TOKEN);

module.exports = { client }; 