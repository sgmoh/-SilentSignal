# Silent Signal Discord Bot

A Discord bot for managing and sending direct messages to users across multiple servers.

## Features

- Bulk DM functionality
- Member selection from multiple servers
- DM history tracking
- Bot statistics
- User authentication
- Modern web interface

## Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/silent-signal.git
cd silent-signal
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your Discord bot token:
```
DISCORD_TOKEN=your_bot_token_here
```

4. Start the server:
```bash
node index.js
```

## Usage

1. Visit the web interface at `http://localhost:3000`
2. Log in with your Discord account
3. Select members from the member list
4. Enter your message and send DMs

## Security

- User authentication required for all operations
- Session management for persistent login
- Secure token handling
- Rate limiting on API endpoints

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is licensed under the MIT License - see the LICENSE file for details. 