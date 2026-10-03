// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/lib/perf.js
// PURPOSE: Performance tier detection and CSS variable injection.
//          5 tiers: ultra120, ultra, high, balanced, low, potato.
// DEPENDS ON: nothing
// ═══════════════════════════════════════════════════════════════════
const PERF_KEY = 'tribes.perf';
let cached = null;

export function initPerf() {
  const raw = localStorage.getItem(PERF_KEY);
  if (raw) {
    try { cached = JSON.parse(raw); } catch { cached = null; }
  } else {
    cached = { tier: 'balanced', score: 60, dpr: 1.5, tests: {}, measuredAt: 0, device: 'unknown' };
  }
  applyTier(cached.tier);
}

export function getPerf() {
  if (!cached) initPerf();
  return cached;
}

export function setTier(tier) {
  cached = { ...(cached || {}), tier, manuallySet: true, measuredAt: Date.now() };
  localStorage.setItem(PERF_KEY, JSON.stringify(cached));
  applyTier(tier);
}

export function savePerf(result) {
  cached = { ...result, measuredAt: Date.now() };
  localStorage.setItem(PERF_KEY, JSON.stringify(cached));
  applyTier(cached.tier);
}

function applyTier(tier) {
  document.documentElement.setAttribute('data-perf', tier);
  if (tier === 'potato' || tier === 'low') {
    document.documentElement.setAttribute('data-fx', 'reduced');
  } else {
    document.documentElement.setAttribute('data-fx', 'full');
  }
}

export function getDPR() {
  const t = getPerf().tier;
  switch (t) {
    case 'ultra120':
    case 'ultra':   return 2.5;
    case 'high':    return 2;
    case 'balanced':return 1.5;
    case 'low':     return 1;
    case 'potato':  return 1;
    default:        return 1.5;
  }
}

export function isStatic() {
  const t = getPerf().tier;
  return t === 'potato';
}