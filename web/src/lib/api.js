// API client for the TRIBES Express backend. Sends Telegram initData in a
// header so the server can authenticate the WebApp session.
import { initData } from './telegram.js';

const BASE = ''; // same-origin (Express serves both API and this SPA)

// Stable per-device guest id for local/preview play (server must allow guests).
function guestId() {
  try {
    let g = localStorage.getItem('tribes.guest');
    if (!g) { g = 'g' + Math.floor(1e6 + Math.random() * 9e6); localStorage.setItem('tribes.guest', g); }
    return g;
  } catch (e) { return 'g100000'; }
}

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const id = initData();
  // The backend authenticates via the X-Init-Data header (Telegram initData).
  if (id) headers['X-Init-Data'] = id;
  // Dev/guest fallback: backend accepts X-Guest-Id (g + digits) when
  // ALLOW_GUEST=1 is set on the server. Harmless otherwise.
  if (!id) headers['X-Guest-Id'] = guestId();

  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    throw new ApiError('network', 'Network error — check your connection.');
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
  if (!res.ok) {
    throw new ApiError(res.status, (data && (data.error || data.detail)) || 'Request failed', data);
  }
  return data;
}

export class ApiError extends Error {
  constructor(status, message, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: 'POST', body }),

  // ---- concept endpoints (match the existing backend contract) ----
  state: () => request('/api/state'),
  checkin: () => request('/api/checkin', { method: 'POST' }),
  collectAsh: () => request('/api/ash/collect', { method: 'POST' }),
  trials: () => request('/api/trials'),
  runTrial: (slug, body) => request('/api/trials/' + slug, { method: 'POST', body }),
  claimDaily: (id) => request('/api/daily/' + id + '/claim', { method: 'POST' }),
  spin: () => request('/api/spin', { method: 'POST' }),
  share: (body) => request('/api/share', { method: 'POST', body }),

  tribes: () => request('/api/tribes'),
  war: () => request('/api/war'),
  warLeaderboard: () => request('/api/war/leaderboard'),
  bonfire: () => request('/api/bonfire'),
  relics: () => request('/api/relics'),
};
