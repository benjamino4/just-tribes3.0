import { initData } from './telegram.js';

const GUEST_KEY = 'tribes.guest';
function guestId() {
  try {
    let g = localStorage.getItem(GUEST_KEY);
    if (!g) { g = 'g' + Math.floor(1e6 + Math.random() * 9e6); localStorage.setItem(GUEST_KEY, g); }
    return g;
  } catch { return 'g100000'; }
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
      method, headers,
      body: body != null ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError('network', 'Network error');
  }
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (!r.ok) throw new ApiError(r.status, (json && (json.error || json.detail)) || 'Request failed', json);
  return json;
}

export const apiGet = (p) => api(p);
export const apiPost = (p, body) => api(p, { method: 'POST', body });

export const Endpoints = {
  state: () => apiGet('/api/state'),
  tribes: () => apiGet('/api/tribes'),
  tribeNames: () => apiGet('/api/tribe/names'),
  tribeDetail: (id) => apiGet('/api/tribe/' + id),
  tribeCreate: (data) => apiPost('/api/tribe/create', data),
  tribeJoin: (tribeId) => apiPost('/api/tribe/join', { tribeId }),
  tribeLeave: () => apiPost('/api/tribe/leave'),
  tribeDonate: (amount) => apiPost('/api/tribe/donate', { amount }),
  checkin: () => apiPost('/api/checkin'),
  ashCollect: () => apiPost('/api/ash/collect'),
  arenaRankedFind: () => apiPost('/api/arena/ranked/find', {}),
  arenaRankedResolve: (duel_id, payload) => apiPost('/api/arena/ranked/resolve', { duel_id, ...payload }),
  arenaRecent: () => apiGet('/api/arena/recent'),
  war: () => apiGet('/api/war'),
  warDeclare: () => apiPost('/api/war/declare'),
  warMatch: (front, game, payload) => apiPost('/api/war/match', { front, game, payload }),
  warFront: (front) => apiPost('/api/war/front', { front }),
  kiva: (since) => apiGet('/api/kiva' + (since ? '?since=' + since : '')),
  kivaPost: (body) => apiPost('/api/kiva', { body }),
  kivaRead: (lastSeenId) => apiPost('/api/kiva/read', { lastSeenId }),
  kivaReact: (messageId, emojiKey) => apiPost('/api/kiva/react', { messageId, emojiKey }),
  kivaPin: (messageId) => apiPost('/api/kiva/pin', { messageId }),
  kivaUnpin: (messageId) => apiPost('/api/kiva/unpin', { messageId }),
  relicsState: () => apiGet('/api/relics/state'),
  relicsEquip: (relicId) => apiPost('/api/relics/equip', { relicId }),
  relicsUnequip: (category) => apiPost('/api/relics/unequip', { category }),
  emojiSets: () => apiGet('/api/emoji/sets'),
  emojiUnlock: (slug) => apiPost('/api/emoji/unlock', { slug }),
  giftPreview: (code) => apiPost('/api/gift/preview', { code }),
  giftRedeem: (code) => apiPost('/api/gift/redeem', { code }),
  help: () => apiGet('/api/help'),
  referral: () => apiGet('/api/referral'),
  notifications: () => apiGet('/api/notifications'),
  notificationsSeenOne: (id) => apiPost('/api/notifications/seen/' + id),
  content: () => apiGet('/api/content/all'),
  rankTiers: () => apiGet('/api/rank/tiers'),
  leaderboard: () => apiGet('/api/leaderboard'),
  games: () => apiGet('/api/games'),
  starsInvoice: (itemId) => apiPost('/api/stars/invoice', { itemId }),
};