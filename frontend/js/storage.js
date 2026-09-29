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
function formatTopicWithPrefix(prefix, topicText) {
  let clean = (topicText || '').trim();
  clean = clean.replace(/^[“"']+|[”"']+$/g, '').trim();
  clean = clean.replace(/[?.:!]+$/, '').trim();

  // If already starts with prefix or similar, normalize
  if (clean.toLowerCase().startsWith(prefix.toLowerCase() + ':')) {
    clean = clean.slice(prefix.length + 1).trim();
  }

  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 0) return prefix;

  // Pick up to 4 words or max 24 chars
  const maxWords = 4;
  const picked = words.slice(0, maxWords).join(' ');

  let result = picked;
  if (words.length > maxWords || result.length > 24) {
    result = result.slice(0, 24).trim() + '…';
  }

  result = result.charAt(0).toUpperCase() + result.slice(1);
  return `${prefix}: ${result}`;
}

export function generateSimplifiedTitle(text) {
  if (!text || typeof text !== 'string') return 'New Chat';

  let clean = text.trim();
  clean = clean.replace(/^[“"']+|[”"']+$/g, '').trim();

  const lower = clean.toLowerCase();

  // 1. Greetings & Platform guide
  const greetings = ['hi', 'hello', 'hey', 'yo', 'sup', 'namaste', 'hola', 'good morning', 'good evening', 'good afternoon', 'test'];
  if (greetings.includes(lower)) {
    return 'Getting Started';
  }
  if (['who are you', 'what can you do', 'help', 'how does this work', 'how do you work', 'guide', 'about'].some(g => lower.includes(g))) {
    return 'NewsScope Guide';
  }

  // Check if there is an explicit separator (colon or spaced dash) separating directive from the actual content
  const colonMatch = clean.match(/^(?:verify|check|fact-?check|analyze|investigate)?\s*(?:this|the)?\s*(?:headline|claim|article|story|news|statement|source|outlet|credibility)?\s*(?:for me)?\s*(?::|\s+[-—]\s+)\s*(.+)$/i);
  const payloadAfterColon = colonMatch && colonMatch[1] ? colonMatch[1].trim() : null;

  // 2. Headline verification
  const isHeadlineCheck = lower.includes('verify this headline') || lower.includes('check a headline') || lower.includes('headline check') || lower.includes('verify headline') || lower.startsWith('headline:');
  if (isHeadlineCheck) {
    if (payloadAfterColon && payloadAfterColon.length > 2) {
      return formatTopicWithPrefix('Headline', payloadAfterColon);
    }
    let rest = clean.replace(/^(?:can you\s+)?(?:please\s+)?(?:verify|check)\s+(?:this\s+)?(?:headline|news|story)?\s*(?:for me)?\s*[:—\-]?\s*/i, '').trim();
    rest = rest.replace(/[?.:!]+$/, '').trim();
    if (rest.length > 3) {
      return formatTopicWithPrefix('Headline', rest);
    }
    return 'Headline Verification';
  }

  // 3. Source credibility
  const isSourceCheck = lower.includes('verify the credibility of a news source') || lower.includes('verify source') || lower.includes('source credibility') || lower.includes('credibility of') || lower.includes('check source') || lower.includes('verify a source');
  if (isSourceCheck) {
    if (payloadAfterColon && payloadAfterColon.length > 1) {
      return formatTopicWithPrefix('Source', payloadAfterColon);
    }
    const srcMatch = clean.match(/(?:credibility of|source|outlet)\s+([A-Za-z0-9\s\.\-]{2,25})/i);
    if (srcMatch && srcMatch[1]) {
      const candidate = srcMatch[1].trim().replace(/[?.:!]+$/, '');
      const genericWords = ['a news source', 'the source', 'a source', 'this news', 'this source', 'news source', 'source'];
      if (!genericWords.includes(candidate.toLowerCase())) {
        return formatTopicWithPrefix('Source', candidate);
      }
    }
    return 'Source Credibility Check';
  }

  // 4. Bias & Framing analysis
  const isBiasCheck = lower.includes('bias and framing') || lower.includes('political bias') || lower.includes('analyze article bias') || lower.includes('media bias') || lower.includes('framing') || lower.includes('article bias');
  if (isBiasCheck) {
    if (payloadAfterColon && payloadAfterColon.length > 2) {
      return formatTopicWithPrefix('Bias Check', payloadAfterColon);
    }
    let rest = clean.replace(/^(?:analyze\s+)?(?:this\s+)?(?:article|claim|news)?\s+(?:for\s+)?(?:political bias and framing|bias|framing)?\s*[:—\-]?\s*/i, '').trim();
    rest = rest.replace(/[?.:!]+$/, '').trim();
    if (rest.length > 3) {
      return formatTopicWithPrefix('Bias Check', rest);
    }
    return 'Bias & Framing Analysis';
  }

  // 5. Deepfake / Hoax / Media Check
  const isMediaCheck = lower.includes('deepfake') || lower.includes('manipulated video') || lower.includes('ai generated') || lower.includes('viral hoax') || lower.includes('fake image') || lower.includes('hoax');
  if (isMediaCheck) {
    if (payloadAfterColon && payloadAfterColon.length > 2) {
      return formatTopicWithPrefix('Hoax Check', payloadAfterColon);
    }
    let rest = clean.replace(/^(?:is this|check|verify)?\s*(?:deepfake|hoax|fake image|ai generated)?\s*[:—\-]?\s*/i, '').trim();
    rest = rest.replace(/[?.:!]+$/, '').trim();
    if (rest.length > 3) {
      return formatTopicWithPrefix('Hoax Check', rest);
    }
    return 'Media & Deepfake Check';
  }

  // 6. Fact-check / Claim check
  const isClaimCheck = lower.includes('fact-check') || lower.includes('fact check') || lower.includes('verify claim') || lower.startsWith('claim:') || lower.startsWith('is it true');
  if (isClaimCheck) {
    if (payloadAfterColon && payloadAfterColon.length > 2) {
      return formatTopicWithPrefix('Fact-Check', payloadAfterColon);
    }
  }

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

  clean = clean.replace(/^[“"']+|[”"']+$/g, '').trim();
  clean = clean.replace(/[?.:!]+$/, '').trim();

  if (!clean || clean.length < 2) {
    return isClaimCheck ? 'Claim Fact-Check' : 'News Verification';
  }

  return formatTopicWithPrefix('Fact-Check', clean);
}

export function getChats() {
  const chats = getJSON(KEYS.CHATS, []);
  let changed = false;

  // Sanitize existing raw, casual, or generic titles (like "General Chat")
  for (const c of chats) {
    const rawTitle = (c.title || '').trim().toLowerCase();
    const isGeneric = ['general chat', 'new chat', 'hi', 'hello', 'hey', 'test', 'sup', 'yo', 'chat'].includes(rawTitle);

    if (isGeneric && !c.isCustomTitle) {
      // Find substantive assistant or user message
      const assistantWithAnalysis = (c.messages || []).find(m => m.role === 'assistant' && (m.analysis || m.content));
      const firstUserMsg = (c.messages || []).find(m => m.role === 'user' && m.content && m.content.trim());

      let newTitle = null;
      if (assistantWithAnalysis && assistantWithAnalysis.analysis) {
        const ana = assistantWithAnalysis.analysis;
        if (ana.key_claims && ana.key_claims.length > 0) {
          newTitle = generateSimplifiedTitle(ana.key_claims[0]);
        } else if (ana.title && ana.title !== 'Credibility & Fact-Check Report' && ana.title !== 'Credibility Analysis') {
          newTitle = ana.title;
        }
      }

      if (!newTitle && firstUserMsg) {
        newTitle = generateSimplifiedTitle(firstUserMsg.content);
      }

      if (!newTitle && (!c.messages || c.messages.length === 0)) {
        newTitle = 'New Chat';
      }

      if (newTitle && newTitle !== c.title) {
        c.title = newTitle;
        changed = true;
      }
    } else if (c.title && c.title.length > 35 && !c.isCustomTitle) {
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

  // Auto-title based on the type of chat user is doing
  const currentTitle = chats[idx].title || '';
  const isGeneric = ['New Chat', 'General Chat', 'Getting Started', 'hi', 'hello', 'hey', 'chat'].includes(currentTitle.trim());

  if (message.role === 'user' && !chats[idx].isCustomTitle) {
    const isGreeting = ['hi', 'hello', 'hey', 'yo', 'sup'].includes(message.content.trim().toLowerCase());
    if (isGeneric) {
      chats[idx].title = generateSimplifiedTitle(message.content);
    } else if (currentTitle === 'Getting Started' && !isGreeting) {
      // Upgrade from initial greeting to the actual topic
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
  return updateChat(id, { title, isCustomTitle: true });
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
