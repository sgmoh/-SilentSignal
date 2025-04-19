# Discord DM Bot

A simple Discord bot that can send direct messages to users.

## Setup

1. Install the required dependencies:
```bash
pip install -r requirements.txt
```

2. Create a Discord bot and get your token:
   - Go to the [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Go to the "Bot" section and create a bot
   - Copy the bot token

3. Create a `.env` file:
   - Copy `.env.example` to `.env`
   - Replace `your_bot_token_here` with your actual bot token

4. Invite the bot to your server:
   - Go to OAuth2 > URL Generator
   - Select the following scopes:
     - bot
     - applications.commands
   - Select the following bot permissions:
     - Send Messages
     - Send Messages in Threads
     - Read Message History
     - View Channels

## Usage

The bot uses the prefix `!` for commands.

- `!dm @user message` - Send a direct message to a user (admin only)

## Important Notes

- Only server administrators can use the DM command
- Users must have DMs enabled to receive messages
- Use this bot responsibly and in accordance with Discord's Terms of Service 