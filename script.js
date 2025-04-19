document.addEventListener('DOMContentLoaded', () => {
    // Get the invite button
    const inviteBtn = document.getElementById('invite-btn');
    const supportBtn = document.getElementById('support-btn');
    const commandsBtn = document.getElementById('commands-btn');
    const useNowBtn = document.getElementById('use-now-btn');
    const modal = document.getElementById('commandsModal');
    const closeButton = document.querySelector('.close-button');

    // Generate invite link using client ID from .env
    const clientId = '1363114298406076627'; // Your client ID from .env
    const permissions = '8'; // Administrator permissions
    const inviteLink = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=bot`;
    
    // Generate OAuth2 authorization link with specific scopes
    const oauthLink = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=https%3A%2F%2Fsilentsignal.onrender.com%2Fauth&response_type=code&scope=identify%20guilds.join%20bot&permissions=${permissions}`;

    // Set invite button href
    inviteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.open(inviteLink, '_blank');
    });

    // Use Now button opens OAuth2 authorization
    useNowBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.open(oauthLink, '_blank');
    });

    supportBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.open('https://discord.gg/swoosh', '_blank');
    });

    // Show modal when commands button is clicked
    commandsBtn.addEventListener('click', (e) => {
        e.preventDefault();
        modal.style.display = 'block';
    });

    // Close modal when close button is clicked
    closeButton.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // Close modal when clicking outside of it
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Add floating animation to buttons
    const buttons = document.querySelectorAll('.floating-button');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'translateY(-10px)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translateY(0)';
        });
    });
}); 