/* ═══════════════════════════════════════════════════════
   NewsScope 2.0 — Dataset Explorer Modal
   Allows users to inspect, search, filter, and test the
   50-item news validity benchmark dataset.
   ═══════════════════════════════════════════════════════ */

import { handleDirectClaimVerify } from './chat.js';

let modalBackdrop = null;
let itemsContainer = null;
let searchInput = null;
let chipsContainer = null;
let statsContainer = null;

let currentCategory = 'all';
let currentSearch = '';
let cachedItems = [];

export function initDatasetModal() {
  modalBackdrop = document.getElementById('dataset-modal-backdrop');
  itemsContainer = document.getElementById('dataset-items-list');
  searchInput = document.getElementById('dataset-search-input');
  chipsContainer = document.getElementById('dataset-category-chips');
  statsContainer = document.getElementById('dataset-stats-bar');

  // Trigger button in topbar
  const openBtn = document.getElementById('dataset-modal-btn');
  openBtn?.addEventListener('click', openModal);

  // Close button
  const closeBtn = document.getElementById('dataset-modal-close');
  closeBtn?.addEventListener('click', closeModal);

  // Backdrop click to close
  modalBackdrop?.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal();
  });

  // Search input with debounce
  let debounceTimer;
  searchInput?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      currentSearch = searchInput.value.trim();
      fetchAndRenderItems();
    }, 250);
  });

  // Category chips
  chipsContainer?.querySelectorAll('.category-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      chipsContainer.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentCategory = chip.dataset.category || 'all';
      fetchAndRenderItems();
    });
  });
}

export function openModal() {
  if (!modalBackdrop) return;
  modalBackdrop.classList.add('active');
  fetchStats();
  fetchAndRenderItems();
}

export function closeModal() {
  if (!modalBackdrop) return;
  modalBackdrop.classList.remove('active');
}

async function fetchStats() {
  if (!statsContainer) return;
  try {
    const res = await fetch('/api/dataset/stats');
    if (!res.ok) return;
    const stats = await res.json();
    statsContainer.innerHTML = `
      <span class="dataset-stat-pill">Benchmark Size: <strong>${stats.total_items} claims</strong></span>
      <span class="dataset-stat-pill">Avg Credibility: <strong>${stats.average_credibility_score}%</strong></span>
      <span class="dataset-stat-pill">Categories: <strong>${Object.keys(stats.category_distribution || {}).length}</strong></span>
      <span class="dataset-stat-pill">Sources: <strong>Reuters, AP, Snopes, PolitiFact, WHO</strong></span>
    `;
  } catch (e) {
    console.warn('Could not fetch dataset stats:', e);
  }
}

async function fetchAndRenderItems() {
  if (!itemsContainer) return;
  itemsContainer.innerHTML = `
    <div style="padding: 2rem; text-align: center; color: var(--text-tertiary);">
      Loading verified benchmark dataset...
    </div>
  `;

  try {
    let url = `/api/dataset?limit=50`;
    if (currentCategory && currentCategory !== 'all') {
      url += `&category=${encodeURIComponent(currentCategory)}`;
    }
    if (currentSearch) {
      url += `&q=${encodeURIComponent(currentSearch)}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch dataset items');
    const data = await res.json();
    cachedItems = data.items || [];
    renderItems(cachedItems);
  } catch (e) {
    console.error('Dataset fetch error:', e);
    itemsContainer.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: var(--text-secondary);">
        Unable to load live dataset. Please verify the backend is running.
      </div>
    `;
  }
}

function renderItems(items) {
  if (!items || items.length === 0) {
    itemsContainer.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: var(--text-tertiary);">
        No matching benchmark claims found.
      </div>
    `;
    return;
  }

  itemsContainer.innerHTML = items.map(item => {
    const verdictClass = item.verdict_class || 'badge-credible';
    const scoreColor = item.credibility_score >= 70 ? '#22c55e' : (item.credibility_score >= 40 ? '#f59e0b' : '#ef4444');

    return `
      <div class="dataset-item-card" data-id="${item.id}">
        <div class="dataset-item-meta">
          <span class="dataset-item-cat">${escapeHtml(item.category)}</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="badge ${verdictClass}">${escapeHtml(item.verdict)}</span>
            <span style="font-size: var(--font-xs); font-weight: 700; color: ${scoreColor};">
              ${item.credibility_score}%
            </span>
          </div>
        </div>
        <div class="dataset-item-headline">${escapeHtml(item.headline)}</div>
        <div class="dataset-item-claim">"${escapeHtml(item.claim)}"</div>
        <div class="dataset-item-footer">
          <div class="dataset-item-source">
            Checked by: <strong>${escapeHtml(item.fact_checker || 'NewsScope AI')}</strong> • ${escapeHtml(item.verification_date || '2024')}
          </div>
          <button class="btn-verify-claim" data-claim="${escapeHtml(item.claim)}">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Verify Claim
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Attach button click listeners
  itemsContainer.querySelectorAll('.btn-verify-claim').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const claim = e.currentTarget.dataset.claim;
      if (claim) {
        closeModal();
        handleDirectClaimVerify(claim);
      }
    });
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
