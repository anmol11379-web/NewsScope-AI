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

  // Trigger button in topbar and sidebar
  const openBtn = document.getElementById('dataset-modal-btn');
  openBtn?.addEventListener('click', openModal);

  const sidebarOpenBtn = document.getElementById('sidebar-dataset-btn');
  sidebarOpenBtn?.addEventListener('click', openModal);


  // Close button
  const closeBtn = document.getElementById('dataset-modal-close');
  closeBtn?.addEventListener('click', closeModal);

  // Sync button
  const syncBtn = document.getElementById('dataset-sync-btn');
  syncBtn?.addEventListener('click', handleKaggleSync);

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

async function handleKaggleSync() {
  const syncBtn = document.getElementById('dataset-sync-btn');
  if (!syncBtn) return;
  const originalHtml = syncBtn.innerHTML;
  syncBtn.disabled = true;
  syncBtn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spin">
      <line x1="12" y1="2" x2="12" y2="6"></line>
      <line x1="12" y1="18" x2="12" y2="22"></line>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
      <line x1="2" y1="12" x2="6" y2="12"></line>
      <line x1="18" y1="12" x2="22" y2="12"></line>
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
    </svg>
    Syncing Kaggle...
  `;

  try {
    const res = await fetch('/api/dataset/sync?max_items=500', { method: 'POST' });
    const data = await res.json();

    // Poll status until sync finishes
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const sRes = await fetch('/api/dataset/sync/status');
        const status = await sRes.json();
        if (!status.is_syncing || attempts > 25) {
          clearInterval(interval);
          syncBtn.disabled = false;
          syncBtn.innerHTML = originalHtml;
          fetchStats();
          fetchAndRenderItems();
        }
      } catch (err) {
        clearInterval(interval);
        syncBtn.disabled = false;
        syncBtn.innerHTML = originalHtml;
      }
    }, 1500);
  } catch (e) {
    console.error('Kaggle sync trigger failed:', e);
    syncBtn.disabled = false;
    syncBtn.innerHTML = originalHtml;
  }
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
    if (res.ok) {
      const stats = await res.json();
      statsContainer.innerHTML = `
        <span class="dataset-stat-pill">Benchmark Size: <strong>${stats.total_items} claims</strong></span>
        <span class="dataset-stat-pill">Avg Credibility: <strong>${stats.average_credibility_score}%</strong></span>
        <span class="dataset-stat-pill">Categories: <strong>${Object.keys(stats.category_distribution || {}).length}</strong></span>
        <span class="dataset-stat-pill">Sources: <strong>Reuters, AP, Snopes, PolitiFact, WHO</strong></span>
      `;
      return;
    }
  } catch (e) {
    console.warn('Could not fetch dataset stats from API:', e);
  }

  // Graceful fallback stats
  statsContainer.innerHTML = `
    <span class="dataset-stat-pill">Benchmark Size: <strong>50 verified claims</strong></span>
    <span class="dataset-stat-pill">Avg Credibility: <strong>74%</strong></span>
    <span class="dataset-stat-pill">Categories: <strong>6</strong></span>
    <span class="dataset-stat-pill">Sources: <strong>Reuters, AP, Snopes, PolitiFact</strong></span>
  `;
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
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    cachedItems = data.items || [];
    renderItems(cachedItems);
    return;
  } catch (e) {
    console.warn('Live API dataset load failed, falling back to bundled benchmark seed:', e);
  }

  // Fallback to static benchmark seed
  try {
    const fallbackRes = await fetch('/data/benchmark_seed.json');
    if (fallbackRes.ok) {
      let seedItems = await fallbackRes.json();
      if (currentCategory && currentCategory !== 'all') {
        const catLower = currentCategory.toLowerCase();
        seedItems = seedItems.filter(item => (item.category || '').toLowerCase().includes(catLower));
      }
      if (currentSearch) {
        const query = currentSearch.toLowerCase();
        seedItems = seedItems.filter(item => 
          (item.headline || '').toLowerCase().includes(query) ||
          (item.claim || '').toLowerCase().includes(query) ||
          (item.tags || []).some(t => t.toLowerCase().includes(query))
        );
      }
      cachedItems = seedItems;
      renderItems(cachedItems, true);
      return;
    }
  } catch (err) {
    console.error('Fallback benchmark seed also failed:', err);
  }

  itemsContainer.innerHTML = `
    <div style="padding: 2rem; text-align: center; color: var(--text-secondary);">
      <p style="margin-bottom: 14px;">Unable to reach backend server. It may be waking up from sleep or offline.</p>
      <button class="btn-ghost" id="dataset-retry-btn" style="margin: 0 auto; display: inline-flex; align-items: center; gap: 6px; padding: 7px 16px; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); font-weight: 500;">
        🔄 Retry Connection
      </button>
    </div>
  `;
  document.getElementById('dataset-retry-btn')?.addEventListener('click', () => {
    fetchStats();
    fetchAndRenderItems();
  });
}

function renderItems(items, isOfflineFallback = false) {
  if (!items || items.length === 0) {
    itemsContainer.innerHTML = `
      <div style="padding: 2rem; text-align: center; color: var(--text-tertiary);">
        No matching benchmark claims found.
      </div>
    `;
    return;
  }

  const fallbackBanner = isOfflineFallback ? `
    <div style="font-size: var(--font-xs); color: var(--text-secondary); background: var(--bg-surface); padding: 8px 12px; border-radius: var(--radius-md); margin-bottom: 12px; border: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between;">
      <span>Showing 50 ground-truth benchmark claims (Offline Mode / Connecting to Live Feed...)</span>
    </div>
  ` : '';

  itemsContainer.innerHTML = fallbackBanner + items.map(item => {
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
