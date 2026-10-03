// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/lib/liveContent.js
// PURPOSE: Fetch admin-editable content from /api/content/all.
//          Refreshes every 30 seconds. Injects CSS color tokens.
// DEPENDS ON: nothing
// ═══════════════════════════════════════════════════════════════════
let cached = null;
let lastFetch = 0;
let pending = null;
const CACHE_MS = 30000;

export async function getLiveContent(force = false) {
  const now = Date.now();
  if (!force && cached && now - lastFetch < CACHE_MS) return cached;
  if (pending) return pending;

  pending = fetch('/api/content/all')
    .then((r) => r.json())
    .then((data) => {
      cached = data;
      lastFetch = now;
      return data;
    })
    .catch(() => cached || {})
    .finally(() => { pending = null; });

  return pending;
}

export function getCachedContent() {
  return cached || {};
}