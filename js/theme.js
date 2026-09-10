/* ═══════════════════════════════════════════════════════
   NewsScope 2.0 — Theme Module
   Light / Dark toggle with system detection
   ═══════════════════════════════════════════════════════ */

import { getTheme, saveTheme } from './storage.js';

let currentTheme = 'dark';

const sunIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

const moonIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

export function initTheme() {
  const saved = getTheme();

  if (saved) {
    currentTheme = saved;
  } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
    currentTheme = 'light';
  }

  applyTheme(currentTheme, false);
  updateToggleButton();

  // Listen for system preference changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!getTheme()) {
      currentTheme = e.matches ? 'dark' : 'light';
      applyTheme(currentTheme, true);
      updateToggleButton();
    }
  });
}

export function toggleTheme() {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(currentTheme, true);
  saveTheme(currentTheme);
  updateToggleButton();
}

function applyTheme(theme, animate = true) {
  if (animate) {
    document.body.classList.add('theme-transitioning');
    setTimeout(() => document.body.classList.remove('theme-transitioning'), 600);
  }

  if (theme === 'light') {
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.remove('light-theme');
  }
}

function updateToggleButton() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.innerHTML = currentTheme === 'dark' ? sunIcon : moonIcon;
  btn.setAttribute('data-tooltip', currentTheme === 'dark' ? 'Light mode' : 'Dark mode');
}

export function getCurrentTheme() {
  return currentTheme;
}
