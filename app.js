/**
 * BizChat AI - Frontend Application Core Logic
 * High-performance vanilla JavaScript with state management, Markdown parsing,
 * typing indicators, speech synthesis, and Vercel /api/chat integration.
 */

// Storage keys
const STORAGE_CHATS_KEY = 'bizchat_ai_conversations_v1';
const STORAGE_ACTIVE_ID_KEY = 'bizchat_ai_active_id';
const STORAGE_PERSONA_KEY = 'bizchat_ai_active_persona';
const STORAGE_INSTRUCTIONS_KEY = 'bizchat_ai_custom_instructions';

// Application State
const state = {
  conversations: [],
  activeChatId: null,
  activePersona: 'Executive Strategy Advisor',
  customInstructions: '',
  isGenerating: false,
  isSidebarOpenMobile: false,
};

// DOM Elements Cache
const elements = {
  chatMessages: document.getElementById('chatMessages'),
  welcomeScreen: document.getElementById('welcomeScreen'),
  typingIndicator: document.getElementById('typingIndicator'),
  chatForm: document.getElementById('chatForm'),
  userInput: document.getElementById('userInput'),
  sendBtn: document.getElementById('sendBtn'),
  clearInputBtn: document.getElementById('clearInputBtn'),
  charCount: document.getElementById('charCount'),
  historyList: document.getElementById('historyList'),
  newChatBtn: document.getElementById('newChatBtn'),
  personaSelect: document.getElementById('personaSelect'),
  activePersonaBadge: document.getElementById('activePersonaBadge'),
  activeChatTitle: document.getElementById('activeChatTitle'),
  searchHistoryInput: document.getElementById('searchHistoryInput'),
  clearCurrentChatBtn: document.getElementById('clearCurrentChatBtn'),
  clearAllChatsBtn: document.getElementById('clearAllChatsBtn'),
  exportChatBtn: document.getElementById('exportChatBtn'),
  toggleSidebarBtn: document.getElementById('toggleSidebarBtn'),
  closeSidebarBtn: document.getElementById('closeSidebarBtn'),
  sidebar: document.getElementById('sidebar'),
  sidebarOverlay: document.getElementById('sidebarOverlay'),
  settingsModal: document.getElementById('settingsModal'),
  openSettingsBtn: document.getElementById('openSettingsBtn'),
  closeSettingsModalBtn: document.getElementById('closeSettingsModalBtn'),
  customInstructions: document.getElementById('customInstructions'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  exportAllDataBtn: document.getElementById('exportAllDataBtn'),
  purgeAllDataBtn: document.getElementById('purgeAllDataBtn'),
  quickChips: document.getElementById('quickChips'),
};

/**
 * Configure Markdown and Syntax Highlighting
 */
function initializeMarkdown() {
  if (window.marked) {
    window.marked.setOptions({
      breaks: true,
      gfm: true,
      highlight: function (code, lang) {
        if (window.hljs && lang && window.hljs.getLanguage(lang)) {
          try {
            return window.hljs.highlight(code, { language: lang }).value;
          } catch (e) {
            console.warn('Syntax highlight error:', e);
          }
        } else if (window.hljs) {
          try {
            return window.hljs.highlightAuto(code).value;
          } catch (e) {
            console.warn('Auto highlight error:', e);
          }
        }
        return code;
      },
    });
  }
}

/**
 * Persistence Helpers
 */
function loadStateFromStorage() {
  try {
    const savedChats = localStorage.getItem(STORAGE_CHATS_KEY);
    state.conversations = savedChats ? JSON.parse(savedChats) : [];

    const savedPersona = localStorage.getItem(STORAGE_PERSONA_KEY);
    if (savedPersona) state.activePersona = savedPersona;

    const savedInstructions = localStorage.getItem(STORAGE_INSTRUCTIONS_KEY);
    if (savedInstructions) state.customInstructions = savedInstructions;

    const savedActiveId = localStorage.getItem(STORAGE_ACTIVE_ID_KEY);
    if (savedActiveId && state.conversations.some((c) => c.id === savedActiveId)) {
      state.activeChatId = savedActiveId;
    } else if (state.conversations.length > 0) {
      state.activeChatId = state.conversations[0].id;
    } else {
      createNewChat();
    }
  } catch (err) {
    console.error('Failed to load state from localStorage:', err);
    state.conversations = [];
    createNewChat();
  }
}

function saveConversationsToStorage() {
  try {
    localStorage.setItem(STORAGE_CHATS_KEY, JSON.stringify(state.conversations));
    if (state.activeChatId) {
      localStorage.setItem(STORAGE_ACTIVE_ID_KEY, state.activeChatId);
    }
  } catch (err) {
    console.error('Failed to save conversations to storage:', err);
  }
}

/**
 * Conversation Management
 */
function getActiveChat() {
  return state.conversations.find((c) => c.id === state.activeChatId);
}

function createNewChat() {
  const newId = 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  const newChat = {
    id: newId,
    title: 'New Conversation',
    createdAt: new Date().toISOString(),
    persona: state.activePersona,
    messages: [],
  };

  state.conversations.unshift(newChat);
  state.activeChatId = newId;
  saveConversationsToStorage();
  renderHistory();
  renderActiveChat();

  // On mobile, close sidebar after clicking new chat
  closeMobileSidebar();
  elements.userInput.focus();
}

function switchChat(chatId) {
  if (state.activeChatId === chatId) return;
  state.activeChatId = chatId;
  saveConversationsToStorage();
  renderHistory();
  renderActiveChat();
  closeMobileSidebar();
}

function deleteChat(chatId, event) {
  if (event) event.stopPropagation();
  state.conversations = state.conversations.filter((c) => c.id !== chatId);

  if (state.activeChatId === chatId) {
    state.activeChatId = state.conversations.length > 0 ? state.conversations[0].id : null;
    if (!state.activeChatId) {
      createNewChat();
      return;
    }
  }

  saveConversationsToStorage();
  renderHistory();
  renderActiveChat();
}

/**
 * UI Rendering
 */
function renderHistory(filterText = '') {
  elements.historyList.innerHTML = '';
  const search = filterText.toLowerCase().trim();
  const filtered = state.conversations.filter((c) =>
    c.title.toLowerCase().includes(search)
  );

  if (filtered.length === 0) {
    const emptyNotice = document.createElement('div');
    emptyNotice.className = 'history-empty';
    emptyNotice.textContent = search ? 'No matching conversations' : 'No conversations yet';
    elements.historyList.appendChild(emptyNotice);
    return;
  }

  filtered.forEach((chat) => {
    const item = document.createElement('div');
    item.className = `history-item ${chat.id === state.activeChatId ? 'active' : ''}`;
    item.onclick = () => switchChat(chat.id);

    item.innerHTML = `
      <div class="history-item-content">
        <i class="fa-regular fa-message"></i>
        <span class="history-item-title" title="${escapeHtml(chat.title)}">${escapeHtml(chat.title)}</span>
      </div>
      <div class="history-item-actions">
        <button class="history-item-btn delete" title="Delete conversation" aria-label="Delete">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;

    const deleteBtn = item.querySelector('.history-item-btn.delete');
    deleteBtn.onclick = (e) => deleteChat(chat.id, e);

    elements.historyList.appendChild(item);
  });
}

function renderActiveChat() {
  const currentChat = getActiveChat();
  if (!currentChat) return;

  // Update Top Navigation
  elements.activeChatTitle.textContent = currentChat.title;
  elements.activePersonaBadge.innerHTML = `<i class="fa-solid fa-user-tie"></i> ${escapeHtml(currentChat.persona || state.activePersona)}`;
  elements.personaSelect.value = currentChat.persona || state.activePersona;

  // Clear existing rendered messages (except welcome and typing indicator)
  const messageElements = elements.chatMessages.querySelectorAll('.message-row:not(#typingIndicator .message-row)');
  messageElements.forEach((el) => el.remove());

  // Show/Hide Welcome Screen
  if (currentChat.messages.length === 0) {
    elements.welcomeScreen.classList.remove('hidden');
  } else {
    elements.welcomeScreen.classList.add('hidden');
    currentChat.messages.forEach((msg) => {
      appendMessageElement(msg, false);
    });
  }

  scrollToBottom();
}

/**
 * Construct and Append Message Element to Chat
 */
function appendMessageElement(message, scroll = true) {
  elements.welcomeScreen.classList.add('hidden');

  const row = document.createElement('div');
  row.className = `message-row ${message.role}`;
  row.dataset.msgId = message.id || 'msg_' + Date.now();

  const formattedTime = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (message.role === 'user') {
    row.innerHTML = `
      <div class="avatar-user">FA</div>
      <div class="message-bubble-wrapper">
        <div class="message-meta-row">
          <span class="message-author">You</span>
          <span class="message-time">${formattedTime}</span>
        </div>
        <div class="message-bubble">${escapeHtml(message.content)}</div>
      </div>
    `;
  } else {
    // Assistant Message with Markdown
    const rawContent = message.content || '';
    const parsedMarkdown = window.marked ? window.marked.parse(rawContent) : escapeHtml(rawContent);

    row.innerHTML = `
      <div class="avatar-assistant">
        <i class="fa-solid fa-brain"></i>
      </div>
      <div class="message-bubble-wrapper">
        <div class="message-meta-row">
          <span class="message-author">BizChat AI</span>
          <span class="message-time">${formattedTime}</span>
        </div>
        <div class="message-bubble markdown-body">${parsedMarkdown}</div>
        <div class="message-actions-bar">
          <button class="msg-action-btn copy-msg" title="Copy response to clipboard">
            <i class="fa-regular fa-copy"></i> <span>Copy</span>
          </button>
          <button class="msg-action-btn speak-msg" title="Read response aloud">
            <i class="fa-solid fa-volume-high"></i> <span>Speak</span>
          </button>
          <button class="msg-action-btn regen-msg" title="Regenerate this response">
            <i class="fa-solid fa-rotate-right"></i> <span>Retry</span>
          </button>
          <button class="msg-action-btn thumbs-up" title="Helpful response">
            <i class="fa-regular fa-thumbs-up"></i>
          </button>
          <button class="msg-action-btn thumbs-down" title="Unhelpful response">
            <i class="fa-regular fa-thumbs-down"></i>
          </button>
        </div>
      </div>
    `;

    // Attach actions
    attachAssistantMessageEvents(row, rawContent);
  }

  // Insert before the typing indicator
  elements.chatMessages.insertBefore(row, elements.typingIndicator);

  // Enhance Code Blocks with Copy buttons
  enhanceCodeBlocks(row);

  if (scroll) scrollToBottom();
}

/**
 * Code Block Enhancements (Copy button)
 */
function enhanceCodeBlocks(container) {
  const codeBlocks = container.querySelectorAll('pre');
  codeBlocks.forEach((pre) => {
    if (pre.querySelector('.code-header-bar')) return;

    const code = pre.querySelector('code');
    const lang = code ? code.className.replace('language-', '') || 'code' : 'code';

    const header = document.createElement('div');
    header.className = 'code-header-bar';
    header.innerHTML = `
      <span>${lang}</span>
      <button class="copy-code-btn" title="Copy code">
        <i class="fa-regular fa-copy"></i> Copy code
      </button>
    `;

    const copyBtn = header.querySelector('.copy-code-btn');
    copyBtn.addEventListener('click', () => {
      const textToCopy = code ? code.innerText : pre.innerText;
      navigator.clipboard.writeText(textToCopy).then(() => {
        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        setTimeout(() => {
          copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> Copy code';
        }, 2000);
      });
    });

    pre.parentNode.insertBefore(header, pre);
  });
}

/**
 * Assistant Action Bar Listeners (Copy, Speak, Retry)
 */
function attachAssistantMessageEvents(rowElement, textContent) {
  const copyBtn = rowElement.querySelector('.copy-msg');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(textContent).then(() => {
        const span = copyBtn.querySelector('span');
        const originalText = span.textContent;
        span.textContent = 'Copied!';
        copyBtn.classList.add('active');
        setTimeout(() => {
          span.textContent = originalText;
          copyBtn.classList.remove('active');
        }, 2000);
      });
    });
  }

  const speakBtn = rowElement.querySelector('.speak-msg');
  if (speakBtn) {
    speakBtn.addEventListener('click', () => {
      handleTextToSpeech(textContent, speakBtn);
    });
  }

  const regenBtn = rowElement.querySelector('.regen-msg');
  if (regenBtn) {
    regenBtn.addEventListener('click', () => {
      regenerateLastResponse();
    });
  }

  const thumbsUp = rowElement.querySelector('.thumbs-up');
  const thumbsDown = rowElement.querySelector('.thumbs-down');
  if (thumbsUp && thumbsDown) {
    thumbsUp.addEventListener('click', () => {
      thumbsUp.classList.toggle('active');
      thumbsDown.classList.remove('active');
    });
    thumbsDown.addEventListener('click', () => {
      thumbsDown.classList.toggle('active');
      thumbsUp.classList.remove('active');
    });
  }
}

/**
 * Web Speech API Text-to-Speech
 */
let currentUtterance = null;
function handleTextToSpeech(text, buttonElement) {
  if (!('speechSynthesis' in window)) {
    alert('Text-to-speech is not supported by your browser.');
    return;
  }

  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    buttonElement.classList.remove('active');
    buttonElement.querySelector('span').textContent = 'Speak';
    return;
  }

  // Strip Markdown characters for clean speech
  const cleanText = text.replace(/[#*`_~\[\]()>-]/g, '').trim();
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  buttonElement.classList.add('active');
  buttonElement.querySelector('span').textContent = 'Stop';

  utterance.onend = () => {
    buttonElement.classList.remove('active');
    buttonElement.querySelector('span').textContent = 'Speak';
  };

  utterance.onerror = () => {
    buttonElement.classList.remove('active');
    buttonElement.querySelector('span').textContent = 'Speak';
  };

  window.speechSynthesis.speak(utterance);
}

/**
 * Send Message & Communicate with /api/chat
 */
async function handleChatSubmit(e) {
  if (e) e.preventDefault();
  if (state.isGenerating) return;

  const promptText = elements.userInput.value.trim();
  if (!promptText) return;

  const currentChat = getActiveChat();
  if (!currentChat) return;

  // 1. Add User Message to State
  const userMessage = {
    id: 'msg_' + Date.now(),
    role: 'user',
    content: promptText,
    timestamp: new Date().toISOString(),
  };

  currentChat.messages.push(userMessage);

  // If this is first message, update chat title intelligently
  if (currentChat.messages.length === 1) {
    currentChat.title = promptText.length > 38 ? promptText.slice(0, 35) + '...' : promptText;
    elements.activeChatTitle.textContent = currentChat.title;
    renderHistory();
  }

  // 2. Render User Message & Reset Input
  appendMessageElement(userMessage, true);
  elements.userInput.value = '';
  autoResizeTextarea();
  updateInputControlsState();

  // 3. Show Typing Indicator
  setGeneratingState(true);

  // 4. Send POST request to /api/chat
  try {
    const payload = {
      prompt: promptText,
      messages: currentChat.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      persona: currentChat.persona || state.activePersona,
    };

    if (state.customInstructions) {
      payload.customDirectives = state.customInstructions;
    }

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `Server responded with status ${response.status}`);
    }

    const data = await response.json();
    const assistantReply = data.response || 'No response returned from BizChat AI engine.';

    // 5. Add Assistant Message to State & UI
    const assistantMessage = {
      id: 'msg_' + Date.now(),
      role: 'assistant',
      content: assistantReply,
      timestamp: new Date().toISOString(),
      model: data.model || 'gemini-3.8-flash',
    };

    currentChat.messages.push(assistantMessage);
    saveConversationsToStorage();
    appendMessageElement(assistantMessage, true);
  } catch (err) {
    console.error('Chat API Error:', err);
    const errorMessage = {
      id: 'msg_err_' + Date.now(),
      role: 'assistant',
      content: `⚠️ **BizChat AI Encountered An Issue**\n\n${err.message || 'Unable to connect to the Gemini API server.'}\n\nPlease verify that your server environment has the \`GEMINI_API_KEY\` set in the Secrets configuration.`,
      timestamp: new Date().toISOString(),
    };
    currentChat.messages.push(errorMessage);
    saveConversationsToStorage();
    appendMessageElement(errorMessage, true);
  } finally {
    setGeneratingState(false);
  }
}

/**
 * Regenerate Last Assistant Response
 */
async function regenerateLastResponse() {
  const currentChat = getActiveChat();
  if (!currentChat || currentChat.messages.length === 0 || state.isGenerating) return;

  // If last message was assistant, remove it
  if (currentChat.messages[currentChat.messages.length - 1].role === 'assistant') {
    currentChat.messages.pop();
    renderActiveChat();
  }

  // Find last user prompt
  const lastUserMsg = [...currentChat.messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMsg) return;

  setGeneratingState(true);

  try {
    const payload = {
      messages: currentChat.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      persona: currentChat.persona || state.activePersona,
    };

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || 'Regeneration failed');
    }

    const data = await response.json();
    const assistantMessage = {
      id: 'msg_' + Date.now(),
      role: 'assistant',
      content: data.response || 'No response generated.',
      timestamp: new Date().toISOString(),
      model: data.model || 'gemini-3.8-flash',
    };

    currentChat.messages.push(assistantMessage);
    saveConversationsToStorage();
    appendMessageElement(assistantMessage, true);
  } catch (err) {
    console.error('Regeneration error:', err);
  } finally {
    setGeneratingState(false);
  }
}

/**
 * State Helpers
 */
function setGeneratingState(isBusy) {
  state.isGenerating = isBusy;
  if (isBusy) {
    elements.typingIndicator.classList.remove('hidden');
    elements.sendBtn.disabled = true;
    elements.sendBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    scrollToBottom();
  } else {
    elements.typingIndicator.classList.add('hidden');
    elements.sendBtn.innerHTML = '<i class="fa-solid fa-arrow-up send-icon"></i>';
    updateInputControlsState();
  }
}

function autoResizeTextarea() {
  const textarea = elements.userInput;
  textarea.style.height = 'auto';
  const newHeight = Math.min(textarea.scrollHeight, 200);
  textarea.style.height = `${newHeight}px`;
}

function updateInputControlsState() {
  const len = elements.userInput.value.length;
  elements.charCount.textContent = `${len}/4000`;
  elements.sendBtn.disabled = len === 0 || state.isGenerating;

  if (len > 0) {
    elements.clearInputBtn.classList.remove('hidden');
  } else {
    elements.clearInputBtn.classList.add('hidden');
  }
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Mobile Sidebar Handlers
 */
function openMobileSidebar() {
  elements.sidebar.classList.add('mobile-open');
  elements.sidebarOverlay.classList.add('active');
  state.isSidebarOpenMobile = true;
}

function closeMobileSidebar() {
  elements.sidebar.classList.remove('mobile-open');
  elements.sidebarOverlay.classList.remove('active');
  state.isSidebarOpenMobile = false;
}

/**
 * Export Active Chat as Markdown
 */
function exportActiveChatMarkdown() {
  const currentChat = getActiveChat();
  if (!currentChat || currentChat.messages.length === 0) {
    alert('No messages to export in current conversation.');
    return;
  }

  let md = `# ${currentChat.title}\n`;
  md += `**Persona:** ${currentChat.persona || state.activePersona}\n`;
  md += `**Date:** ${new Date(currentChat.createdAt).toLocaleString()}\n\n---\n\n`;

  currentChat.messages.forEach((msg) => {
    const roleName = msg.role === 'user' ? '👤 User' : '🤖 BizChat AI';
    md += `### ${roleName} (${new Date(msg.timestamp).toLocaleTimeString()})\n\n`;
    md += `${msg.content}\n\n---\n\n`;
  });

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentChat.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_bizchat.md`;
  a.click();
  URL.revokeObjectURL(a);
}

/**
 * Attach Event Listeners
 */
function setupEventListeners() {
  // Chat form submit
  elements.chatForm.addEventListener('submit', handleChatSubmit);

  // Textarea input handling (Auto resize & character counter)
  elements.userInput.addEventListener('input', () => {
    autoResizeTextarea();
    updateInputControlsState();
  });

  // Keyboard shortcut: Enter to send, Shift+Enter for newline
  elements.userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit();
    }
  });

  // Clear input button
  elements.clearInputBtn.addEventListener('click', () => {
    elements.userInput.value = '';
    autoResizeTextarea();
    updateInputControlsState();
    elements.userInput.focus();
  });

  // New Chat button
  elements.newChatBtn.addEventListener('click', createNewChat);

  // Global Keyboard shortcut for New Chat (Cmd+N or Ctrl+N)
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      createNewChat();
    }
  });

  // Persona select dropdown
  elements.personaSelect.addEventListener('change', (e) => {
    const chosenPersona = e.target.value;
    state.activePersona = chosenPersona;
    localStorage.setItem(STORAGE_PERSONA_KEY, chosenPersona);

    const currentChat = getActiveChat();
    if (currentChat) {
      currentChat.persona = chosenPersona;
      saveConversationsToStorage();
      elements.activePersonaBadge.innerHTML = `<i class="fa-solid fa-user-tie"></i> ${escapeHtml(chosenPersona)}`;
    }
  });

  // Search History Input
  elements.searchHistoryInput.addEventListener('input', (e) => {
    renderHistory(e.target.value);
  });

  // Clear Current Chat messages
  elements.clearCurrentChatBtn.addEventListener('click', () => {
    const currentChat = getActiveChat();
    if (currentChat && confirm('Clear all messages in this conversation?')) {
      currentChat.messages = [];
      saveConversationsToStorage();
      renderActiveChat();
    }
  });

  // Clear All Chats
  elements.clearAllChatsBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to delete all conversation history?')) {
      state.conversations = [];
      createNewChat();
    }
  });

  // Export Chat button
  elements.exportChatBtn.addEventListener('click', exportActiveChatMarkdown);

  // Mobile sidebar toggles
  elements.toggleSidebarBtn.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      openMobileSidebar();
    } else {
      elements.sidebar.classList.toggle('collapsed');
    }
  });

  elements.closeSidebarBtn.addEventListener('click', closeMobileSidebar);
  elements.sidebarOverlay.addEventListener('click', closeMobileSidebar);

  // Suggestion Cards on Welcome Screen
  document.querySelectorAll('.prompt-card').forEach((card) => {
    card.addEventListener('click', () => {
      const prompt = card.dataset.prompt;
      if (prompt) {
        elements.userInput.value = prompt;
        autoResizeTextarea();
        updateInputControlsState();
        handleChatSubmit();
      }
    });
  });

  // Quick Chips
  elements.quickChips.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (chip) {
      const text = chip.dataset.text;
      const current = elements.userInput.value.trim();
      elements.userInput.value = current ? `${current} - ${text}` : text;
      autoResizeTextarea();
      updateInputControlsState();
      elements.userInput.focus();
    }
  });

  // Settings Modal Handlers
  elements.openSettingsBtn.addEventListener('click', () => {
    elements.customInstructions.value = state.customInstructions || '';
    elements.settingsModal.classList.remove('hidden');
  });

  elements.closeSettingsModalBtn.addEventListener('click', () => {
    elements.settingsModal.classList.add('hidden');
  });

  elements.saveSettingsBtn.addEventListener('click', () => {
    state.customInstructions = elements.customInstructions.value.trim();
    localStorage.setItem(STORAGE_INSTRUCTIONS_KEY, state.customInstructions);
    elements.settingsModal.classList.add('hidden');
  });

  elements.exportAllDataBtn.addEventListener('click', () => {
    const dataStr = JSON.stringify(state.conversations, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bizchat_ai_all_conversations_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a);
  });

  elements.purgeAllDataBtn.addEventListener('click', () => {
    if (confirm('Permanently purge all stored history and reset settings?')) {
      localStorage.clear();
      state.conversations = [];
      state.customInstructions = '';
      elements.settingsModal.classList.add('hidden');
      createNewChat();
    }
  });

  // Close modal on escape
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !elements.settingsModal.classList.contains('hidden')) {
      elements.settingsModal.classList.add('hidden');
    }
  });
}

/**
 * Application Bootstrap
 */
function initializeApp() {
  initializeMarkdown();
  loadStateFromStorage();
  renderHistory();
  renderActiveChat();
  setupEventListeners();
  autoResizeTextarea();
  updateInputControlsState();
}

// Start app once DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
