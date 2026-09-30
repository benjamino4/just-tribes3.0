// TRIBES-FILE: web/src/lib/api.js
// PHASE: 2 — Identity & shell
// Fetch wrapper. Adds X-Init-Data when inside Telegram, X-Guest-Id
// when ALLOW_GUEST is on and no Telegram context exists.

import { initData } from './telegram.js';

const GUEST_KEY = 'tribes.guest';

function guestId() {
  try {
    let g = localStorage.getItem(GUEST_KEY);
    if (!g) {
      g = 'g' + Math.floor(1e6 + Math.random() * 9e6);
      localStorage.setItem(GUEST_KEY, g);
    }
    return g;
  } catch {
    return 'g100000';
  }
}

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };

  const id = initData();
  if (id) headers['X-Init-Data'] = id;
  else headers['X-Guest-Id'] = guestId();

  let r;
  try {
    r = await fetch(path, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('network', 'Network error — check your connection.');
  }

  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }

  if (!r.ok) {
    throw new ApiError(r.status, (json && (json.error || json.detail)) || 'Request failed', json);
  }
  return json;
}

/* ---------- typed endpoints ---------- */
export const apiGet = (p) => api(p);
export const apiPost = (p, body) => api(p, { method: 'POST', body });

export const Endpoints = {
  state:        () => apiGet('/api/state'),

  tribes:       () => apiGet('/api/tribes'),
  tribeNames:   () => apiGet('/api/tribe/names'),
  tribeDetail:  (id) => apiGet('/api/tribe/' + id),
  tribeCreate:  (data) => apiPost('/api/tribe/create', data),
  tribeJoin:    (tribeId) => apiPost('/api/tribe/join', { tribeId }),
  tribeLeave:   () => apiPost('/api/tribe/leave'),
  tribeDonate:  (amount) => apiPost('/api/tribe/donate', { amount }),
  tribeUpgrade: () => apiPost('/api/tribe/upgrade'),

  // --- warband / seat challenges / bot practice (v4) ---
  warband:        () => apiGet('/api/warband'),
  warbandChallenge: (seat_no, game) => apiPost('/api/warband/challenge', { seat_no, game }),
  warbandResolve: (id, payload) => apiPost('/api/warband/challenge/' + id + '/resolve', payload),
  botPractice:    () => apiGet('/api/bot-practice'),
  botPracticeClaim: (payload) => apiPost('/api/bot-practice/claim', payload),

  // --- store / tribe customization (v4 monetization) ---
  store:          () => apiGet('/api/store'),
  storeBuyPerk:   (perk) => apiPost('/api/store/perk/buy', { perk }),
  storeSetName:   (name, font, style) => apiPost('/api/store/tribe-name', { name, font, style }),
  storeSetIcon:   (icon) => apiPost('/api/store/tribe-icon', { icon }),
  storeSetBanner: (style) => apiPost('/api/store/tribe-banner', { style }),
  storePin:       (id) => apiPost('/api/store/pin', { id }),
};