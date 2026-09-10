/* ═══════════════════════════════════════════════════════
   NewsScope 2.0 — Main App Entry Point
   ═══════════════════════════════════════════════════════ */

import { getUser, removeUser } from './storage.js';
import { initTheme, toggleTheme } from './theme.js';
import { initAuth } from './auth.js';
import { initVoice } from './voice.js';
import { initSidebar, updateUserInfo, refreshSidebar } from './sidebar.js';
import { initChat, loadChat, setVoiceTranscript, handleSend } from './chat.js';

// ══════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // 1. Init theme first (no flash of wrong theme)
  initTheme();

  // 2. Check auth state
  const user = getUser();
  if (user) {
    showChatView(user);
  } else {
    showAuthView();
  }
});

// ══════════════════════════════════════════════════════
// VIEW SWITCHING
// ══════════════════════════════════════════════════════
function showAuthView() {
  document.getElementById('auth-view').classList.add('active');
  document.getElementById('chat-view').classList.remove('active');

  initAuth((user) => {
    // Auth success callback
    document.getElementById('auth-view').classList.remove('active');
    showChatView(user);
  });
}

function showChatView(user) {
  document.getElementById('auth-view')?.classList.remove('active');
  document.getElementById('chat-view').classList.add('active');

  // Init modules
  initSidebar({
    onChatSelect: (chatId) => {
      loadChat(chatId);
    },
    onNewChat: (chat) => {
      loadChat(chat.id);
    },
  });

  initChat();

  initVoice((transcript, isFinal) => {
    setVoiceTranscript(transcript);
    if (isFinal) {
      // Auto-send after final transcript
      setTimeout(() => handleSend(), 300);
    }
  });

  // Update user info in sidebar
  updateUserInfo(user);

  // Theme toggle button
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // User dropdown
  setupUserDropdown(user);
}

// ══════════════════════════════════════════════════════
// USER DROPDOWN
// ══════════════════════════════════════════════════════
function setupUserDropdown(user) {
  const avatarBtn = document.getElementById('user-avatar-btn');
  const dropdown = document.getElementById('user-dropdown');
  const topbarAvatar = document.querySelector('.topbar .avatar');

  if (topbarAvatar) topbarAvatar.textContent = user.initials || user.name.slice(0, 2).toUpperCase();

  if (avatarBtn && dropdown) {
    avatarBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('active');
    });

    document.addEventListener('click', () => {
      dropdown.classList.remove('active');
    });

    dropdown.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      removeUser();
      document.getElementById('chat-view').classList.remove('active');
      showAuthView();
    });
  }
}
