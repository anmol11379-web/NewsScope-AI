/* ═══════════════════════════════════════════════════════
   NewsScope 2.0 — Main App Entry Point
   ═══════════════════════════════════════════════════════ */

import { getUser, removeUser } from './storage.js';
import { initTheme, toggleTheme } from './theme.js';
import { initAuth, resetAuthForms } from './auth.js';
import { initVoice } from './voice.js';
import { initSidebar, updateUserInfo, refreshSidebar } from './sidebar.js';
import { initChat, loadChat, setVoiceTranscript, handleSend } from './chat.js';
import { initDatasetModal } from './dataset-modal.js';
import { API_BASE_URL } from './config.js';

let chatModulesInitialized = false;

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

  // 3. Register auth handlers (only triggered when user logs in / registers)
  initAuth((user) => {
    showChatView(user);
  });

  // 4. Strict check for new vs returning users:
  // If no user session is found in localStorage -> new visitor, strictly show login page first
  // If user session is found -> existing user, show AI chat view
  const user = getUser();
  if (user && user.email) {
    showChatView(user);
  } else {
    showAuthView();
  }
});

// ══════════════════════════════════════════════════════
// VIEW SWITCHING
// ══════════════════════════════════════════════════════
function showAuthView() {
  const authView = document.getElementById('auth-view');
  const chatView = document.getElementById('chat-view');

  if (chatView) chatView.classList.remove('active');
  if (authView) authView.classList.add('active');

  resetAuthForms();
}

function showChatView(user) {
  const authView = document.getElementById('auth-view');
  const chatView = document.getElementById('chat-view');

  if (authView) authView.classList.remove('active');
  if (chatView) chatView.classList.add('active');

  // Initialize interactive chat engine & modules only once to prevent duplicate listeners
  if (!chatModulesInitialized) {
    chatModulesInitialized = true;

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
        setTimeout(() => handleSend(), 300);
      }
    });

    // Theme toggle button
    const themeBtn = document.getElementById('theme-toggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

    // Setup user dropdown and logout triggers
    setupUserControls();
  }

  // Update user profile info across sidebar and topbar
  if (user) {
    updateUserInfo(user);
    updateDropdownUser(user);
  }
}

// ══════════════════════════════════════════════════════
// USER DROPDOWN & LOGOUT CONTROLS
// ══════════════════════════════════════════════════════
function updateDropdownUser(user) {
  const topbarAvatar = document.querySelector('.topbar .avatar');
  if (topbarAvatar && user) {
    topbarAvatar.textContent = user.initials || (user.name ? user.name.slice(0, 2).toUpperCase() : 'DU');
  }
}

function handleLogout() {
  // Clear stored auth session
  removeUser();

  // Close dropdown if open
  const dropdown = document.getElementById('user-dropdown');
  if (dropdown) dropdown.classList.remove('active');

  // Transition back to the login view
  showAuthView();
}

function setupUserControls() {
  const avatarBtn = document.getElementById('user-avatar-btn');
  const dropdown = document.getElementById('user-dropdown');

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

  // Topbar dropdown Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handleLogout();
    });
  }

  // Sidebar footer quick Logout button
  const sidebarLogoutBtn = document.getElementById('sidebar-logout-btn');
  if (sidebarLogoutBtn) {
    sidebarLogoutBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleLogout();
    });
  }
}
