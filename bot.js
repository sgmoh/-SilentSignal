const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

// Create a new client instance with minimal intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// When the client is ready, run this code (only once)
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});

// Handle commands
client.on('messageCreate', async message => {
    // Ignore messages from bots
    if (message.author.bot) return;

    // Check if the message starts with the command prefix
    if (message.content.startsWith('!dm')) {
        // Check if the user has administrator permissions
        if (!message.member?.permissions.has('Administrator')) {
            return message.reply('You need administrator permissions to use this command!');
        }

        // Get the mentioned user and message content
        const args = message.content.slice(3).trim().split(/ +/);
        const user = message.mentions.users.first();
        const dmMessage = args.slice(1).join(' ');

        if (!user) {
            return message.reply('You need to mention a user to DM!');
        }

        if (!dmMessage) {
            return message.reply('You need to provide a message to send!');
        }

        try {
            // Send the DM
            await user.send(dmMessage);
            message.reply(`Message sent to ${user.tag}!`);
        } catch (error) {
            console.error('Error sending DM:', error);
            message.reply(`Could not send message to ${user.tag}. They might have DMs disabled.`);
        }
    }
});

// Login to Discord with your client's token
client.login(process.env.DISCORD_TOKEN); 