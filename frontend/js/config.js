/* ═══════════════════════════════════════════════════════
   NewsScope 2.0 — API Configuration
   Supports both relative proxy (/api) and direct backend URL
   ═══════════════════════════════════════════════════════ */

export const API_BASE_URL = (import.meta.env?.VITE_API_URL || '').replace(/\/+$/, '');
