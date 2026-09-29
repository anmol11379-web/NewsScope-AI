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
  const verifiedBadge = document.getElementById('profile-phone-verified-badge');
  if (phoneEl) {
    if (user.phone && user.phone.trim()) {
      phoneEl.textContent = user.phone.trim();
      phoneEl.className = 'profile-info-val';
      if (verifiedBadge) verifiedBadge.style.display = user.phoneVerified ? 'inline-flex' : 'none';
    } else {
      phoneEl.textContent = 'Empty';
      phoneEl.className = 'profile-info-val empty';
      if (verifiedBadge) verifiedBadge.style.display = 'none';
    }
  }

  // Ensure edit mode and OTP verification are reset on opening
  const phoneDisplayWrap = document.getElementById('profile-phone-display-wrap');
  const phoneEditWrap = document.getElementById('profile-phone-edit-wrap');
  const otpWrap = document.getElementById('profile-otp-wrap');
  const phoneError = document.getElementById('profile-phone-error');
  const otpError = document.getElementById('profile-otp-error');
  const phoneInput = document.getElementById('profile-phone-input');
  const otpInput = document.getElementById('profile-otp-input');

  if (phoneDisplayWrap) phoneDisplayWrap.style.display = 'flex';
  if (phoneEditWrap) phoneEditWrap.style.display = 'none';
  if (otpWrap) otpWrap.style.display = 'none';
  if (phoneError) { phoneError.textContent = ''; phoneError.style.display = 'none'; }
  if (otpError) { otpError.textContent = ''; otpError.style.display = 'none'; }
  if (phoneInput) phoneInput.value = user.phone || '';
  if (otpInput) otpInput.value = '';

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

  // Pencil button to add/edit phone number with OTP verification
  const pencilBtn = document.getElementById('profile-pencil-btn');
  const phoneDisplayWrap = document.getElementById('profile-phone-display-wrap');
  const phoneEditWrap = document.getElementById('profile-phone-edit-wrap');
  const otpWrap = document.getElementById('profile-otp-wrap');
  const phoneInput = document.getElementById('profile-phone-input');
  const phoneSaveBtn = document.getElementById('profile-phone-save-btn');
  const phoneCancelBtn = document.getElementById('profile-phone-cancel-btn');
  const phoneError = document.getElementById('profile-phone-error');
  const phoneEl = document.getElementById('profile-modal-phone');
  const verifiedBadge = document.getElementById('profile-phone-verified-badge');

  // OTP elements
  const otpInput = document.getElementById('profile-otp-input');
  const otpVerifyBtn = document.getElementById('profile-otp-verify-btn');
  const otpCancelBtn = document.getElementById('profile-otp-cancel-btn');
  const otpResendBtn = document.getElementById('profile-otp-resend-btn');
  const otpError = document.getElementById('profile-otp-error');
  const otpBannerText = document.getElementById('profile-otp-banner-text');
  const otpDemoCode = document.getElementById('profile-otp-demo-code');

  let pendingPhoneNumber = '';
  let generatedOtp = '4829';

  const generateOtpCode = () => {
    return String(Math.floor(1000 + Math.random() * 9000));
  };

  if (pencilBtn && phoneEditWrap && phoneDisplayWrap && phoneInput) {
    pencilBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const user = getUser() || {};
      phoneInput.value = user.phone || '';
      if (phoneError) phoneError.style.display = 'none';
      phoneDisplayWrap.style.display = 'none';
      if (otpWrap) otpWrap.style.display = 'none';
      phoneEditWrap.style.display = 'block';
      phoneInput.focus();
    });

    // Step 1: User enters phone number and clicks "Save" -> sends/shows OTP
    const requestPhoneOtp = () => {
      const val = phoneInput.value.trim();
      const digits = val.replace(/\D/g, '');
      if (!val || digits.length < 7) {
        if (phoneError) {
          phoneError.textContent = 'Please enter a valid phone number (at least 7 digits).';
          phoneError.style.display = 'block';
        }
        phoneInput.focus();
        return;
      }

      if (phoneError) phoneError.style.display = 'none';
      pendingPhoneNumber = val;
      generatedOtp = generateOtpCode();

      if (otpBannerText) {
        otpBannerText.innerHTML = `OTP sent to <strong>${val}</strong>`;
      }
      if (otpDemoCode) {
        otpDemoCode.textContent = generatedOtp;
      }
      if (otpInput) {
        otpInput.value = '';
      }
      if (otpError) {
        otpError.textContent = '';
        otpError.style.display = 'none';
      }

      phoneEditWrap.style.display = 'none';
      if (otpWrap) {
        otpWrap.style.display = 'block';
      }
      if (otpInput) {
        otpInput.focus();
      }
    };

    if (phoneSaveBtn) {
      phoneSaveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        requestPhoneOtp();
      });
    }

    phoneInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        requestPhoneOtp();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        phoneEditWrap.style.display = 'none';
        phoneDisplayWrap.style.display = 'flex';
        if (phoneError) phoneError.style.display = 'none';
      }
    });

    if (phoneCancelBtn) {
      phoneCancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        phoneEditWrap.style.display = 'none';
        phoneDisplayWrap.style.display = 'flex';
        if (phoneError) phoneError.style.display = 'none';
      });
    }

    // Step 2: User verifies OTP and saves phone number
    const verifyAndSaveOtp = () => {
      const enteredCode = otpInput ? otpInput.value.trim() : '';
      if (!enteredCode) {
        if (otpError) {
          otpError.textContent = 'Please enter the 4-digit OTP code.';
          otpError.style.color = '#ef4444';
          otpError.style.display = 'block';
        }
        if (otpInput) otpInput.focus();
        return;
      }

      // Check entered code against generated OTP or universal testing codes
      if (enteredCode === generatedOtp || enteredCode === '4829' || enteredCode === '1234') {
        // Success: persist to storage
        const user = getUser() || {};
        user.phone = pendingPhoneNumber;
        user.phoneVerified = true;
        saveUser(user);

        if (phoneEl) {
          phoneEl.textContent = pendingPhoneNumber;
          phoneEl.className = 'profile-info-val';
        }
        if (verifiedBadge) {
          verifiedBadge.style.display = 'inline-flex';
        }

        if (otpWrap) otpWrap.style.display = 'none';
        phoneDisplayWrap.style.display = 'flex';
      } else {
        if (otpError) {
          otpError.textContent = 'Invalid OTP code. Please enter the correct code.';
          otpError.style.color = '#ef4444';
          otpError.style.display = 'block';
        }
        if (otpInput) otpInput.focus();
      }
    };

    if (otpVerifyBtn) {
      otpVerifyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        verifyAndSaveOtp();
      });
    }

    if (otpInput) {
      otpInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          verifyAndSaveOtp();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          if (otpWrap) otpWrap.style.display = 'none';
          phoneDisplayWrap.style.display = 'flex';
        }
      });
    }

    // Change Number button on OTP card
    if (otpCancelBtn) {
      otpCancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (otpWrap) otpWrap.style.display = 'none';
        phoneEditWrap.style.display = 'block';
        phoneInput.focus();
      });
    }

    // Resend OTP button
    if (otpResendBtn) {
      otpResendBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        generatedOtp = generateOtpCode();
        if (otpDemoCode) otpDemoCode.textContent = generatedOtp;
        if (otpError) {
          otpError.textContent = 'New OTP sent!';
          otpError.style.color = '#10b981';
          otpError.style.display = 'block';
          setTimeout(() => {
            if (otpError.textContent === 'New OTP sent!') otpError.style.display = 'none';
          }, 2000);
        }
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
