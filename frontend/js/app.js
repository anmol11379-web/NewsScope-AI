/* ═══════════════════════════════════════════════════════
   NewsScope 2.0 — Main App Entry Point
   ═══════════════════════════════════════════════════════ */

import { getUser, removeUser } from './storage.js';
import { initTheme, toggleTheme } from './theme.js';
import { initAuth } from './auth.js';
import { initVoice } from './voice.js';
import { initSidebar, updateUserInfo, refreshSidebar } from './sidebar.js';
import { initChat, loadChat, setVoiceTranscript, handleSend } from './chat.js';
import { initDatasetModal } from './dataset-modal.js';
import { API_BASE_URL } from './config.js';

// ══════════════════════════════════════════════════════
// BACKEND WARMUP (Wakes up Render container immediately on page open)
// ══════════════════════════════════════════════════════
function warmupBackend() {
  const pill = document.getElementById('backend-status-pill');
  const updatePill = (statusClass, text, title) => {
    if (!pill) return;
    pill.className = `backend-status-pill ${statusClass}`;
    if (title) pill.title = title;
    const label = pill.querySelector('.status-label');
    if (label) label.textContent = text;
  };

  updatePill('warming', 'Waking server...', 'Pinging backend to start immediately on page load');

  let attempts = 0;
  const maxAttempts = 20;

  const ping = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/health`, {
        method: 'GET',
        cache: 'no-cache'
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        updatePill('ready', 'Online', `Connected to backend (Model: ${data.gemini_model || 'Gemini Flash'})`);
        return;
      }
    } catch (err) {
      // Backend still cold-starting
    }

    attempts++;
    if (attempts < maxAttempts) {
      setTimeout(ping, 3000);
    } else {
      updatePill('error', 'Offline', 'Backend could not be reached after multiple retries.');
    }
  };

  ping();
}

// ══════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // 1. Instantly wake up the backend container the moment the user opens the page
  warmupBackend();

  // 2. Init theme first (no flash of wrong theme)
  initTheme();

  // 3. Check auth state
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
  initDatasetModal();

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
