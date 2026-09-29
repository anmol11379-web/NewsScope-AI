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
    if (user.picture) {
      topbarAvatar.innerHTML = `<img src="${user.picture}" alt="${user.name || 'User'}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;" />`;
    } else {
      topbarAvatar.textContent = user.initials || (user.name ? user.name.slice(0, 2).toUpperCase() : 'DU');
    }
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

function openProfileModal() {
  const user = getUser() || {};
  const modalBackdrop = document.getElementById('profile-modal-backdrop');
  if (!modalBackdrop) return;

  const avatarEl = document.getElementById('profile-modal-avatar');
  const nameEl = document.getElementById('profile-modal-name');
  const emailEl = document.getElementById('profile-modal-email');
  const phoneEl = document.getElementById('profile-modal-phone');

  // 1. Profile Icon (Image if Google/uploaded, else gradient with initials)
  if (avatarEl) {
    if (user.picture) {
      avatarEl.innerHTML = `<img src="${user.picture}" alt="${user.name || 'User'}" />`;
    } else {
      avatarEl.textContent = user.initials || (user.name ? user.name.slice(0, 2).toUpperCase() : 'NS');
    }
  }

  // 2. Name
  if (nameEl) {
    nameEl.textContent = user.name || 'Not provided';
  }

  // 3. Email
  if (emailEl) {
    emailEl.textContent = user.email || 'Not provided';
  }

  // 4. Phone Number
  if (phoneEl) {
    if (user.phone && user.phone.trim()) {
      phoneEl.textContent = user.phone.trim();
      phoneEl.className = 'profile-info-val';
    } else {
      phoneEl.textContent = 'Empty';
      phoneEl.className = 'profile-info-val empty';
    }
  }

  // Ensure edit mode is closed on opening
  const phoneDisplayWrap = document.getElementById('profile-phone-display-wrap');
  const phoneEditWrap = document.getElementById('profile-phone-edit-wrap');
  if (phoneDisplayWrap) phoneDisplayWrap.style.display = 'flex';
  if (phoneEditWrap) phoneEditWrap.style.display = 'none';

  modalBackdrop.classList.add('active');
}

function closeProfileModal() {
  const modalBackdrop = document.getElementById('profile-modal-backdrop');
  if (modalBackdrop) modalBackdrop.classList.remove('active');
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

  // Topbar dropdown Profile button
  const profileBtn = document.getElementById('profile-btn');
  if (profileBtn) {
    profileBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (dropdown) dropdown.classList.remove('active');
      openProfileModal();
    });
  }

  // Sidebar user row opens profile modal
  const sidebarUserRow = document.getElementById('sidebar-user-row');
  if (sidebarUserRow) {
    sidebarUserRow.addEventListener('click', (e) => {
      // Don't open profile if they clicked the quick logout button inside the row
      if (e.target.closest('#sidebar-logout-btn')) return;
      openProfileModal();
    });
  }

  // Profile modal close buttons
  const modalCloseBtn = document.getElementById('profile-modal-close');
  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeProfileModal);
  }

  const modalFooterCloseBtn = document.getElementById('profile-modal-close-btn');
  if (modalFooterCloseBtn) {
    modalFooterCloseBtn.addEventListener('click', closeProfileModal);
  }

  // Pencil button to add/edit phone number
  const pencilBtn = document.getElementById('profile-pencil-btn');
  const phoneDisplayWrap = document.getElementById('profile-phone-display-wrap');
  const phoneEditWrap = document.getElementById('profile-phone-edit-wrap');
  const phoneInput = document.getElementById('profile-phone-input');
  const phoneSaveBtn = document.getElementById('profile-phone-save-btn');
  const phoneCancelBtn = document.getElementById('profile-phone-cancel-btn');
  const phoneEl = document.getElementById('profile-modal-phone');

  if (pencilBtn && phoneEditWrap && phoneDisplayWrap && phoneInput) {
    pencilBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const user = getUser() || {};
      phoneInput.value = user.phone || '';
      phoneDisplayWrap.style.display = 'none';
      phoneEditWrap.style.display = 'block';
      phoneInput.focus();
    });

    const savePhone = () => {
      const val = phoneInput.value.trim();
      const user = getUser() || {};
      user.phone = val;
      saveUser(user);

      if (val) {
        phoneEl.textContent = val;
        phoneEl.className = 'profile-info-val';
      } else {
        phoneEl.textContent = 'Empty';
        phoneEl.className = 'profile-info-val empty';
      }

      phoneEditWrap.style.display = 'none';
      phoneDisplayWrap.style.display = 'flex';
    };

    if (phoneSaveBtn) {
      phoneSaveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        savePhone();
      });
    }

    phoneInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        savePhone();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        phoneEditWrap.style.display = 'none';
        phoneDisplayWrap.style.display = 'flex';
      }
    });

    if (phoneCancelBtn) {
      phoneCancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        phoneEditWrap.style.display = 'none';
        phoneDisplayWrap.style.display = 'flex';
      });
    }
  }

  // Backdrop click to close profile modal
  const profileBackdrop = document.getElementById('profile-modal-backdrop');
  if (profileBackdrop) {
    profileBackdrop.addEventListener('click', (e) => {
      if (e.target === profileBackdrop) closeProfileModal();
    });
  }

  // Escape key closes modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeProfileModal();
  });

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
