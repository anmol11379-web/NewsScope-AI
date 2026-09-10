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
export function getChats() {
  return getJSON(KEYS.CHATS, []);
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

  // Auto-title from first user message
  if (chats[idx].title === 'New Chat' && message.role === 'user') {
    chats[idx].title = message.content.slice(0, 50) + (message.content.length > 50 ? '…' : '');
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
