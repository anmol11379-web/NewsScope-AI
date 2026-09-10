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
  edit: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  trash: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  inbox: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
};

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
          <span class="chat-item-icon">${icons.message}</span>
          <span class="chat-title">${escapeHtml(chat.title)}</span>
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
  const nameEl = document.querySelector('.sidebar-user-name');
  const emailEl = document.querySelector('.sidebar-user-email');
  const avatarEl = document.querySelector('.sidebar-footer .avatar');
  if (nameEl) nameEl.textContent = user.name;
  if (emailEl) emailEl.textContent = user.email;
  if (avatarEl) avatarEl.textContent = user.initials || user.name.slice(0, 2).toUpperCase();
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
