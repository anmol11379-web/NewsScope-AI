/* ═══════════════════════════════════════════════════════
   NewsScope 2.0 — Auth Module
   Login / Signup with LocalStorage mock
   ═══════════════════════════════════════════════════════ */

import { saveUser, findUser, registerUser } from './storage.js';
import { API_BASE_URL, GOOGLE_CLIENT_ID } from './config.js';

let onAuthSuccess = null;
let authInitialized = false;
let googleTokenClient = null;

export function initAuth(callback) {
  if (callback) onAuthSuccess = callback;
  if (authInitialized) return;
  authInitialized = true;

  // Tab switching
  const tabs = document.querySelectorAll('.auth-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      switchTab(target);
    });
  });

  // Login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  // Signup form
  const signupForm = document.getElementById('signup-form');
  if (signupForm) signupForm.addEventListener('submit', handleSignup);

  // Google button
  document.querySelectorAll('.btn-google').forEach(btn => {
    btn.addEventListener('click', handleGoogleAuth);
  });

  // Initialize Google Identity Services
  initGoogleAuth();

  // Password toggle
  document.querySelectorAll('.password-toggle').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const input = toggle.parentElement.querySelector('input');
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      toggle.innerHTML = isPassword
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    });
  });
}

export function resetAuthForms() {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  if (loginForm) loginForm.reset();
  if (signupForm) signupForm.reset();
  clearErrors();
  switchTab('login');
}

export function switchTab(target) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.auth-tab[data-tab="${target}"]`)?.classList.add('active');

  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.getElementById(`${target}-form`)?.classList.add('active');

  // Clear errors
  document.querySelectorAll('.form-group').forEach(g => g.classList.remove('has-error'));
}

async function handleLogin(e) {
  e.preventDefault();
  clearErrors();

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const submitBtn = document.getElementById('login-submit-btn');

  // Validate
  let valid = true;
  if (!email || !isValidEmail(email)) {
    showError('login-email', 'Please enter a valid email address');
    valid = false;
  }
  if (!password || password.length < 6) {
    showError('login-password', 'Password must be at least 6 characters');
    valid = false;
  }

  if (!valid) {
    shakeCard();
    return;
  }

  const origBtnContent = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Verifying credentials...</span>';
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.success && data.user) {
        saveUser(data.user);
        if (onAuthSuccess) onAuthSuccess(data.user);
        return;
      }
    } else if (res.status === 401 || res.status === 422) {
      // Legitimate bad credentials from auth server
      const data = await res.json().catch(() => ({}));
      showError('login-email', data.detail || data.message || 'Invalid email or password');
      shakeCard();
      return;
    }
    // If endpoint returned 404 (backend route not yet deployed on Render) or 5xx, fall through to local auth
    console.warn(`Auth backend returned HTTP ${res.status}, verifying locally.`);
  } catch (err) {
    console.warn('Backend auth unreachable, verifying locally:', err);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnContent;
    }
  }

  // Graceful local authentication fallback
  const localUser = findUser(email);
  if (localUser && localUser.password === password) {
    const sessionUser = { name: localUser.name, email: localUser.email, initials: getInitials(localUser.name) };
    saveUser(sessionUser);
    if (onAuthSuccess) onAuthSuccess(sessionUser);
    return;
  }

  showError('login-email', localUser ? 'Incorrect password. Please try again.' : 'No account found with this email. Please sign up first.');
  shakeCard();
}

async function handleSignup(e) {
  e.preventDefault();
  clearErrors();

  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirm = document.getElementById('signup-confirm').value;
  const submitBtn = document.getElementById('signup-submit-btn');

  // Validate
  let valid = true;
  if (!name || name.length < 2) {
    showError('signup-name', 'Name must be at least 2 characters');
    valid = false;
  }
  if (!email || !isValidEmail(email)) {
    showError('signup-email', 'Please enter a valid email address');
    valid = false;
  }
  if (!password || password.length < 6) {
    showError('signup-password', 'Password must be at least 6 characters');
    valid = false;
  }
  if (password !== confirm) {
    showError('signup-confirm', 'Passwords do not match');
    valid = false;
  }

  if (!valid) {
    shakeCard();
    return;
  }

  const origBtnContent = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Creating account...</span>';
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.success && data.user) {
        registerUser({ name, email, password });
        saveUser(data.user);
        if (onAuthSuccess) onAuthSuccess(data.user);
        return;
      }
    } else if (res.status === 400 || res.status === 409 || res.status === 422) {
      // Legitimate validation or duplicate error from auth server
      const data = await res.json().catch(() => ({}));
      showError('signup-email', data.detail || data.message || 'Registration failed');
      shakeCard();
      return;
    }
    // If endpoint returned 404 (not yet deployed on Render) or 5xx, fall through to local registration
    console.warn(`Auth backend returned HTTP ${res.status}, registering locally.`);
  } catch (err) {
    console.warn('Backend auth unreachable, registering in local storage:', err);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnContent;
    }
  }

  // Graceful local registration fallback
  if (findUser(email)) {
    showError('signup-email', 'An account with this email already exists');
    shakeCard();
    return;
  }

  registerUser({ name, email, password });
  const sessionUser = { name, email, initials: getInitials(name) };
  saveUser(sessionUser);
  if (onAuthSuccess) onAuthSuccess(sessionUser);
}

// ══════════════════════════════════════════════════════
// GOOGLE IDENTITY SERVICES (OAuth 2.0)
// ══════════════════════════════════════════════════════
function initGoogleAuth() {
  if (typeof window === 'undefined') return;

  const tryInit = () => {
    // 1. Initialize Google One Tap / Credential listener
    if (window.google?.accounts?.id && GOOGLE_CLIENT_ID) {
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
      } catch (e) {
        console.warn('Google One Tap init note:', e);
      }
    }

    // 2. Initialize OAuth 2.0 Token Client for Google Sign-In popup
    if (window.google?.accounts?.oauth2 && GOOGLE_CLIENT_ID) {
      try {
        googleTokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: GOOGLE_CLIENT_ID,
          scope: 'email profile openid',
          callback: async (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
              await fetchGoogleUserInfo(tokenResponse.access_token);
            }
          },
        });
      } catch (e) {
        console.warn('Google Token Client init note:', e);
      }
    }
  };

  tryInit();
  // If Google script tag is still downloading, retry in 500ms
  if (!window.google?.accounts) {
    setTimeout(tryInit, 500);
    setTimeout(tryInit, 1500);
  }
}

async function fetchGoogleUserInfo(accessToken) {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (res.ok) {
      const data = await res.json();
      const user = {
        name: data.name || data.given_name || 'Google User',
        email: data.email,
        picture: data.picture,
        initials: getInitials(data.name || data.email),
      };
      saveUser(user);
      if (onAuthSuccess) onAuthSuccess(user);
    }
  } catch (err) {
    console.error('Failed to retrieve Google profile:', err);
  }
}

function handleGoogleCredentialResponse(response) {
  if (!response || !response.credential) return;
  const payload = decodeJwt(response.credential);
  if (payload && payload.email) {
    const user = {
      name: payload.name || payload.given_name || 'Google User',
      email: payload.email,
      picture: payload.picture,
      initials: getInitials(payload.name || payload.email),
    };
    saveUser(user);
    if (onAuthSuccess) onAuthSuccess(user);
  }
}

function decodeJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function handleGoogleAuth() {
  // If token client is initialized, trigger Google's real account popup
  if (window.google?.accounts?.oauth2) {
    if (!googleTokenClient) {
      initGoogleAuth();
    }
    if (googleTokenClient) {
      googleTokenClient.requestAccessToken({ prompt: 'select_account' });
      return;
    }
  }

  // If Google One Tap is loaded, show prompt
  if (window.google?.accounts?.id) {
    window.google.accounts.id.prompt();
    return;
  }

  // Graceful fallback for offline / blocked adblocker
  console.warn('Google Identity SDK loading or blocked, using demo account fallback.');
  const user = {
    name: 'Demo User',
    email: 'demo@newsscope.ai',
    initials: 'DU',
  };
  saveUser(user);
  if (onAuthSuccess) onAuthSuccess(user);
}

// ── Utilities ──
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function showError(inputId, message) {
  const group = document.getElementById(inputId)?.closest('.form-group');
  if (!group) return;
  group.classList.add('has-error');
  const errorEl = group.querySelector('.error-message');
  if (errorEl) errorEl.textContent = message;
  const input = group.querySelector('.input-field');
  if (input) input.classList.add('error');
}

function clearErrors() {
  document.querySelectorAll('.form-group').forEach(g => {
    g.classList.remove('has-error');
    const input = g.querySelector('.input-field');
    if (input) input.classList.remove('error');
  });
}

function shakeCard() {
  const card = document.querySelector('.auth-card');
  card.classList.add('shake');
  setTimeout(() => card.classList.remove('shake'), 400);
}
