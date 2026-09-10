/* ═══════════════════════════════════════════════════════
   NewsScope 2.0 — Storage Module
   LocalStorage abstraction for chat history, auth, prefs
   ═══════════════════════════════════════════════════════ */

const KEYS = {
  AUTH_USER: 'newsscope_auth_user',
  CHATS: 'newsscope_chats',
  ACTIVE_CHAT: 'newsscope_active_chat',
  THEME: 'newsscope_theme',
};

// ── Helpers ──
function getJSON(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function setJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ══════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════
export function getUser() {
  return getJSON(KEYS.AUTH_USER);
}
export function saveUser(user) {
  setJSON(KEYS.AUTH_USER, user);
}
export function removeUser() {
  localStorage.removeItem(KEYS.AUTH_USER);
}
export function getRegisteredUsers() {
  return getJSON('newsscope_registered_users', []);
}
export function registerUser(user) {
  const users = getRegisteredUsers();
  users.push(user);
  setJSON('newsscope_registered_users', users);
}
export function findUser(email) {
  return getRegisteredUsers().find(u => u.email === email);
}

// ══════════════════════════════════════════════════════
// CHATS
// ══════════════════════════════════════════════════════
export function generateSimplifiedTitle(text) {
  if (!text || typeof text !== 'string') return 'New Chat';

  let clean = text.trim();

  // Remove quotes and markdown artifacts
  clean = clean.replace(/^[“"']+|[”"']+$/g, '').trim();

  // Handle common greetings or casual openers
  const greetings = ['hi', 'hello', 'hey', 'yo', 'sup', 'good morning', 'good evening', 'test', 'help'];
  if (greetings.includes(clean.toLowerCase())) {
    return 'General Chat';
  }

  // If text starts with an intro directive ending in colon/dash, extract the actual claim after it
  const colonIntroMatch = clean.match(/^(?:can you|please|i want to)?\s*(?:verify|fact-?check|check|analyze|investigate)?\s*(?:this|the)?\s*(?:headline|claim|article|story|news|statement|credibility)?\s*(?:for me)?\s*[:—\-]\s*(.+)$/i);
  if (colonIntroMatch && colonIntroMatch[1]) {
    clean = colonIntroMatch[1].trim();
  } else {
    // Strip common prompt boilerplate prefixes
    const prefixes = [
      /^(?:can you\s+)?(?:please\s+)?(?:verify|fact-?check|check)\s+(?:this\s+)?(?:headline|claim|article|story|news|statement)?\s*(?:for me)?\s*[:—\-]?\s*/i,
      /^(?:i want to\s+)?(?:verify|check)\s+(?:the credibility of)?\s*[:—\-]?\s*/i,
      /^(?:analyze\s+)?(?:this\s+)?(?:article|claim)\s+for\s+(?:political bias and framing|bias)?\s*[:—\-]?\s*/i,
      /^(?:is it true that|did|does|is|are|can)\s+/i,
      /^(?:what do you know about|tell me about)\s+/i,
      /^for me\s*[:—\-]?\s*/i,
    ];

    for (const reg of prefixes) {
      clean = clean.replace(reg, '').trim();
    }
  }

  // Remove surrounding quotes and trailing punctuation
  clean = clean.replace(/^[“"']+|[”"']+$/g, '').trim();
  clean = clean.replace(/[?.:!]+$/, '').trim();

  if (!clean || clean.length < 2) return 'General Chat';

  // Truncate cleanly at word boundary (max ~26 chars)
  const maxLength = 26;
  if (clean.length > maxLength) {
    const cut = clean.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(' ');
    clean = (lastSpace > 10 ? cut.slice(0, lastSpace) : cut).trim() + '…';
  }

  // Capitalize first letter
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function getChats() {
  const chats = getJSON(KEYS.CHATS, []);
  let changed = false;

  // Sanitize any existing raw or casual titles like "hi"
  for (const c of chats) {
    const rawTitle = (c.title || '').trim().toLowerCase();
    if (['hi', 'hello', 'hey', 'test', 'sup', 'yo'].includes(rawTitle)) {
      const substantiveMsg = (c.messages || []).find(
        m => m.role === 'user' && !['hi', 'hello', 'hey', 'test'].includes(m.content.trim().toLowerCase())
      );
      c.title = substantiveMsg ? generateSimplifiedTitle(substantiveMsg.content) : 'General Chat';
      changed = true;
    } else if (c.title && c.title.length > 35) {
      c.title = generateSimplifiedTitle(c.title);
      changed = true;
    }
  }

  if (changed) {
    setJSON(KEYS.CHATS, chats);
  }

  return chats;
}
export function saveChats(chats) {
  setJSON(KEYS.CHATS, chats);
}
export function getActiveChatId() {
  return localStorage.getItem(KEYS.ACTIVE_CHAT);
}
export function setActiveChatId(id) {
  if (id) {
    localStorage.setItem(KEYS.ACTIVE_CHAT, id);
  } else {
    localStorage.removeItem(KEYS.ACTIVE_CHAT);
  }
}

export function createChat(title = 'New Chat') {
  const chats = getChats();
  const chat = {
    id: 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    title,
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  chats.unshift(chat);
  saveChats(chats);
  setActiveChatId(chat.id);
  return chat;
}

export function getChat(id) {
  return getChats().find(c => c.id === id) || null;
}

export function updateChat(id, updates) {
  const chats = getChats();
  const idx = chats.findIndex(c => c.id === id);
  if (idx === -1) return null;
  chats[idx] = { ...chats[idx], ...updates, updatedAt: new Date().toISOString() };
  saveChats(chats);
  return chats[idx];
}

export function addMessage(chatId, message) {
  const chats = getChats();
  const idx = chats.findIndex(c => c.id === chatId);
  if (idx === -1) return null;
  const msg = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    ...message,
    timestamp: new Date().toISOString(),
  };
  chats[idx].messages.push(msg);
  chats[idx].updatedAt = new Date().toISOString();

  // Auto-title always using simplified formatting
  const currentTitle = chats[idx].title || '';
  const isGeneric = ['New Chat', 'General Chat', 'hi', 'hello', 'hey'].includes(currentTitle.trim());

  if (message.role === 'user') {
    const isGreeting = ['hi', 'hello', 'hey', 'yo', 'sup'].includes(message.content.trim().toLowerCase());
    if (isGeneric) {
      chats[idx].title = generateSimplifiedTitle(message.content);
    } else if (currentTitle === 'General Chat' && !isGreeting) {
      // Upgrade from General Chat to the actual topic
      chats[idx].title = generateSimplifiedTitle(message.content);
    }
  }

  saveChats(chats);
  return msg;
}

export function deleteChat(id) {
  const chats = getChats().filter(c => c.id !== id);
  saveChats(chats);
  if (getActiveChatId() === id) {
    setActiveChatId(chats.length > 0 ? chats[0].id : null);
  }
  return chats;
}

export function renameChat(id, title) {
  return updateChat(id, { title });
}

export function searchChats(query) {
  if (!query) return getChats();
  const q = query.toLowerCase();
  return getChats().filter(c =>
    c.title.toLowerCase().includes(q) ||
    c.messages.some(m => m.content.toLowerCase().includes(q))
  );
}

// ══════════════════════════════════════════════════════
// THEME
// ══════════════════════════════════════════════════════
export function getTheme() {
  return localStorage.getItem(KEYS.THEME) || 'dark';
}
export function saveTheme(theme) {
  localStorage.setItem(KEYS.THEME, theme);
}
