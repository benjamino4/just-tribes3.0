// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/lib/api.js
// PURPOSE: Fetch wrapper. Sends initData header. Typed errors.
// DEPENDS ON: telegram.js
// ═══════════════════════════════════════════════════════════════════
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
    throw new ApiError('network', 'Network error — check your connection.');
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

  arenaRankedFind: (game) => apiPost('/api/arena/ranked/find', { game }),
  arenaRankedResolve: (duel_id, payload) => apiPost('/api/arena/ranked/resolve', { duel_id, ...payload }),
  arenaStakedOpen: (stake, game) => apiPost('/api/arena/staked/open', { stake, game }),
  arenaStakedResolve: (duel_id, payload) => apiPost('/api/arena/staked/resolve', { duel_id, ...payload }),
  arenaRecent: () => apiGet('/api/arena/recent'),

  war: () => apiGet('/api/war'),
  warDeclare: () => apiPost('/api/war/declare'),
  warMatch: (front, game, payload) => apiPost('/api/war/match', { front, game, payload }),

  kiva: (since) => apiGet('/api/kiva' + (since ? '?since=' + since : '')),
  kivaPost: (body) => apiPost('/api/kiva', { body }),
  kivaSeal: (id, sealed) => apiPost('/api/kiva/seal', { id, sealed }),
  kivaCurfew: (data) => apiPost('/api/kiva/curfew', data),
  kivaRead: (lastSeenId) => apiPost('/api/kiva/read', { lastSeenId }),

  relicsState: () => apiGet('/api/relics/state'),
  relicsPacks: () => apiGet('/api/relics/packs'),
  relicsOpen: (slug) => apiPost('/api/relics/pack/open', { slug }),
  relicsEquip: (relicId) => apiPost('/api/relics/equip', { relicId }),
  relicsUnequip: (category) => apiPost('/api/relics/unequip', { category }),

  daily: () => apiGet('/api/daily'),
  dailyClaim: (id) => apiPost('/api/daily/' + id + '/claim'),
  trials: () => apiGet('/api/trials'),
  trialPlay: (slug, payload) => apiPost('/api/trials/' + slug, payload || {}),
  spin: () => apiPost('/api/spin'),
  checkin: () => apiPost('/api/checkin'),
  ashCollect: () => apiPost('/api/ash/collect'),
  share: () => apiPost('/api/share'),

  help: () => apiGet('/api/help'),
  helpArticle: (slug) => apiGet('/api/help/' + slug),

  referral: () => apiGet('/api/referral'),
  referralClaim: (code) => apiPost('/api/referral/claim', { code }),
  firstPackClaim: () => apiPost('/api/first-pack/claim'),
  streakInsurance: () => apiPost('/api/streak-insurance'),

  giftPreview: (code) => apiPost('/api/gift/preview', { code }),
  giftRedeem: (code) => apiPost('/api/gift/redeem', { code }),

  notifications: (since, unread) => apiGet('/api/notifications' + (since || unread ? '?' + new URLSearchParams({ since: since || '', unread: unread ? '1' : '' }) : '')),
  notificationsSeen: (ids) => apiPost('/api/notifications/seen', { ids }),
  notificationsSeenOne: (id) => apiPost('/api/notifications/seen/' + id),

  storeCatalog: () => apiGet('/api/store/catalog'),
  starsInvoice: (itemId) => apiPost('/api/stars/invoice', { itemId }),
  tonIntent: (itemId) => apiPost('/api/ton/intent', { itemId }),
  tonVerify: (nonce) => apiPost('/api/ton/verify', { nonce }),
  tonLink: (address) => apiPost('/api/ton/link', { address }),

  rankTiers: () => apiGet('/api/rank/tiers'),
  rankLeaderboard: () => apiGet('/api/rank/leaderboard'),
  forgottenList: () => apiGet('/api/forgotten/list')
};