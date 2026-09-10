/* ═══════════════════════════════════════════════════════
   NewsScope 2.0 — Auth Module
   Login / Signup with LocalStorage mock
   ═══════════════════════════════════════════════════════ */

import { saveUser, findUser, registerUser } from './storage.js';

let onAuthSuccess = null;

export function initAuth(callback) {
  onAuthSuccess = callback;

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
  loginForm.addEventListener('submit', handleLogin);

  // Signup form
  const signupForm = document.getElementById('signup-form');
  signupForm.addEventListener('submit', handleSignup);

  // Google button (demo)
  document.querySelectorAll('.btn-google').forEach(btn => {
    btn.addEventListener('click', handleGoogleAuth);
  });

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

function switchTab(target) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.auth-tab[data-tab="${target}"]`).classList.add('active');

  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.getElementById(`${target}-form`).classList.add('active');

  // Clear errors
  document.querySelectorAll('.form-group').forEach(g => g.classList.remove('has-error'));
}

function handleLogin(e) {
  e.preventDefault();
  clearErrors();

  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

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

  // Check credentials
  const user = findUser(email);
  if (!user || user.password !== password) {
    showError('login-email', 'Invalid email or password');
    shakeCard();
    return;
  }

  // Success
  const sessionUser = { name: user.name, email: user.email, initials: getInitials(user.name) };
  saveUser(sessionUser);
  if (onAuthSuccess) onAuthSuccess(sessionUser);
}

function handleSignup(e) {
  e.preventDefault();
  clearErrors();

  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const confirm = document.getElementById('signup-confirm').value;

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

  // Check if user exists
  if (findUser(email)) {
    showError('signup-email', 'An account with this email already exists');
    shakeCard();
    return;
  }

  // Register
  registerUser({ name, email, password });
  const sessionUser = { name, email, initials: getInitials(name) };
  saveUser(sessionUser);
  if (onAuthSuccess) onAuthSuccess(sessionUser);
}

function handleGoogleAuth() {
  // Demo: create a mock Google user
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
