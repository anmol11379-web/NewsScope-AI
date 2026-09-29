/* ═══════════════════════════════════════════════════════
   NewsScope 2.0 — Sidebar Module
   Chat history, search, create / delete / rename
   ═══════════════════════════════════════════════════════ */

import {
  getChats, createChat, deleteChat, renameChat,
  searchChats, getActiveChatId, setActiveChatId
} from './storage.js';

let onChatSelect = null;
let onNewChat = null;
let isCollapsed = false;

// SVG icons
const icons = {
  message: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  headline: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1 2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>`,
  source: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`,
  bias: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>`,
  factCheck: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="m8 11 2 2 4-4"/></svg>`,
  hoax: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
  guide: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
  edit: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  inbox: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
};

function getChatIcon(title) {
  const t = (title || '').toLowerCase();
  if (t.startsWith('headline') || t.includes('headline')) return icons.headline;
  if (t.startsWith('source') || t.includes('source') || t.includes('outlet')) return icons.source;
  if (t.startsWith('bias') || t.includes('bias') || t.includes('framing')) return icons.bias;
  if (t.startsWith('hoax') || t.includes('hoax') || t.includes('deepfake')) return icons.hoax;
  if (t.startsWith('fact-check') || t.startsWith('fact check') || t.includes('verify') || t.includes('claim')) return icons.factCheck;
  if (t.includes('guide') || t.includes('started') || t.includes('about')) return icons.guide;
  return icons.message;
}

export function initSidebar(callbacks) {
  onChatSelect = callbacks.onChatSelect;
  onNewChat = callbacks.onNewChat;

  // Toggle button
  const toggleBtn = document.getElementById('sidebar-toggle');
  if (toggleBtn) toggleBtn.addEventListener('click', toggleSidebar);

  // New chat button
  const newChatBtn = document.getElementById('new-chat-btn');
  if (newChatBtn) newChatBtn.addEventListener('click', handleNewChat);

  // Search input
  const searchInput = document.getElementById('sidebar-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      renderChatList(searchChats(e.target.value));
    });
  }

  // Sidebar overlay (mobile)
  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) overlay.addEventListener('click', collapseSidebar);

  renderChatList(getChats());
}

export function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar) return;

  isCollapsed = !isCollapsed;
  if (isCollapsed) {
    sidebar.classList.add('collapsed');
    if (overlay) overlay.classList.remove('active');
  } else {
    sidebar.classList.remove('collapsed');
    if (window.innerWidth <= 768 && overlay) {
      overlay.classList.add('active');
    }
  }
}

export function collapseSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar) return;
  isCollapsed = true;
  sidebar.classList.add('collapsed');
  if (overlay) overlay.classList.remove('active');
}

export function expandSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar) return;
  isCollapsed = false;
  sidebar.classList.remove('collapsed');
  if (window.innerWidth <= 768 && overlay) {
    overlay.classList.add('active');
  }
}

function handleNewChat() {
  const chat = createChat();
  renderChatList(getChats());
  if (onNewChat) onNewChat(chat);
  // Close sidebar on mobile
  if (window.innerWidth <= 768) collapseSidebar();
}

export function renderChatList(chats) {
  const container = document.getElementById('chat-history');
  if (!container) return;

  if (!chats || chats.length === 0) {
    container.innerHTML = `
      <div class="no-chats-message">
        ${icons.inbox}
        <p>No conversations yet</p>
      </div>
    `;
    return;
  }

  // Group by date
  const groups = groupByDate(chats);
  const activeChatId = getActiveChatId();

  let html = '';
  for (const [label, items] of Object.entries(groups)) {
    html += `<div class="chat-history-group">`;
    html += `<div class="chat-history-label">${label}</div>`;
    for (const chat of items) {
      const isActive = chat.id === activeChatId ? 'active' : '';
      html += `
        <div class="chat-history-item ${isActive}" data-chat-id="${chat.id}">
          <span class="chat-item-icon" title="${escapeHtml(chat.title)}">${getChatIcon(chat.title)}</span>
          <span class="chat-title" title="${escapeHtml(chat.title)}">${escapeHtml(chat.title)}</span>
          <div class="chat-actions">
            <button class="chat-action-btn" data-action="rename" data-chat-id="${chat.id}" title="Rename">
              ${icons.edit}
            </button>
            <button class="chat-action-btn" data-action="delete" data-chat-id="${chat.id}" title="Delete">
              ${icons.trash}
            </button>
          </div>
        </div>
      `;
    }
    html += `</div>`;
  }

  container.innerHTML = html;

  // Bind events
  container.querySelectorAll('.chat-history-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.chat-action-btn')) return;
      const id = item.dataset.chatId;
      setActiveChatId(id);
      renderChatList(getChats());
      if (onChatSelect) onChatSelect(id);
      if (window.innerWidth <= 768) collapseSidebar();
    });
  });

  container.querySelectorAll('.chat-action-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;
      const chatId = btn.dataset.chatId;
      if (action === 'delete') {
        deleteChat(chatId);
        const remaining = getChats();
        renderChatList(remaining);
        if (onChatSelect) {
          onChatSelect(remaining.length > 0 ? remaining[0].id : null);
        }
      } else if (action === 'rename') {
        const titleEl = btn.closest('.chat-history-item').querySelector('.chat-title');
        const currentTitle = titleEl.textContent;
        const newTitle = prompt('Rename chat:', currentTitle);
        if (newTitle && newTitle.trim()) {
          renameChat(chatId, newTitle.trim());
          renderChatList(getChats());
        }
      }
    });
  });
}

export function refreshSidebar() {
  renderChatList(getChats());
}

export function updateUserInfo(user) {
  if (!user) return;
  const nameEl = document.querySelector('.sidebar-user-name');
  const emailEl = document.querySelector('.sidebar-user-email');
  const avatarEl = document.querySelector('.sidebar-footer .avatar');
  if (nameEl) nameEl.textContent = user.name || 'User';
  if (emailEl) emailEl.textContent = user.email || '';
  if (avatarEl) {
    if (user.picture) {
      avatarEl.innerHTML = `<img src="${user.picture}" alt="${user.name || 'User'}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />`;
    } else {
      avatarEl.textContent = user.initials || (user.name ? user.name.slice(0, 2).toUpperCase() : 'US');
    }
  }
}

// ── Helpers ──
function groupByDate(chats) {
  const groups = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7);

  for (const chat of chats) {
    const date = new Date(chat.updatedAt || chat.createdAt);
    let label;
    if (date >= today) {
      label = 'Today';
    } else if (date >= yesterday) {
      label = 'Yesterday';
    } else if (date >= weekAgo) {
      label = 'Previous 7 Days';
    } else {
      label = 'Older';
    }
    if (!groups[label]) groups[label] = [];
    groups[label].push(chat);
  }
  return groups;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
