const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const messagesArea = document.getElementById('messagesArea');
const welcomeScreen = document.getElementById('welcomeScreen');
const chatContainer = document.getElementById('chatContainer');

// Settings Elements
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const themeSelect = document.getElementById('themeSelect');
const bgSelect = document.getElementById('bgSelect');

// --- SETTINGS LOGIC ---
function loadSettings() {
    const theme = localStorage.getItem('theme') || 'dark';
    const bg = localStorage.getItem('bg') || 'default';
    
    themeSelect.value = theme;
    bgSelect.value = bg;
    applySettings(theme, bg);
}

function applySettings(theme, bg) {
    // Theme
    if (theme === 'light') {
        document.body.setAttribute('data-theme', 'light');
    } else {
        document.body.removeAttribute('data-theme');
    }
    
    // Background
    document.body.className = ''; 
    if (bg !== 'default') {
        document.body.classList.add(`bg-${bg}`);
    }
}

settingsBtn.addEventListener('click', () => settingsModal.classList.add('active'));
closeModalBtn.addEventListener('click', () => settingsModal.classList.remove('active'));

saveSettingsBtn.addEventListener('click', () => {
    const theme = themeSelect.value;
    const bg = bgSelect.value;
    
    localStorage.setItem('theme', theme);
    localStorage.setItem('bg', bg);
    
    applySettings(theme, bg);
    settingsModal.classList.remove('active');
});

// Load settings on startup
loadSettings();

// --- CHAT LOGIC ---
userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

window.useSuggestion = function(text) {
    userInput.value = text;
    sendMessage();
};

function addMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    
    if (sender === 'ai') {
        msgDiv.innerHTML = marked.parse(text);
    } else {
        msgDiv.textContent = text;
    }
    
    messagesArea.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function showTypingIndicator() {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', 'ai');
    msgDiv.id = 'typingIndicator';
    msgDiv.innerHTML = `<div class="typing-dots"><span></span><span></span><span></span></div>`;
    messagesArea.appendChild(msgDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function removeTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
}

async function sendMessage() {
    const text = userInput.value.trim();
    if (!text) return;

    // Hide welcome screen
    welcomeScreen.style.display = 'none';

    // Show user message
    addMessage(text, 'user');
    userInput.value = '';
    userInput.style.height = 'auto';

    // Show typing
    showTypingIndicator();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: text })
        });

        if (!response.ok) throw new Error('API Error');

        const data = await response.json();
        removeTypingIndicator();
        addMessage(data.reply, 'ai');

    } catch (error) {
        removeTypingIndicator();
        addMessage("Sorry, I couldn't connect to the server. Please try again.", 'ai');
    }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// New Chat Button
document.getElementById('newChatBtn').addEventListener('click', () => {
    messagesArea.innerHTML = '';
    welcomeScreen.style.display = 'block';
    userInput.value = '';
});
