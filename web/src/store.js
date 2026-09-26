import { create } from 'zustand';
import { api, ApiError } from './lib/api.js';

// Demo state lets the new UI render fully even when no backend/DB is wired
// yet (e.g. previewing the design). Once the Express API responds, real
// state replaces this seamlessly.
function demoState() {
  const now = Date.now();
  return {
    demo: true,
    user: {
      id: 0, username: 'wanderer', first_name: 'Wanderer', role: 'Hunter',
      ember: 12480, stars: 3, loyalty: 8600, streak: 6,
      last_checkin: null, ash_ready_at: new Date(now + 1000 * 60 * 12).toISOString(),
      ash_count: 3,
    },
    tribe: {
      id: 1, name: 'Ashborn', role: 'Hunter', level: 4, members: 28,
      treasury: 184200, motto: 'From the ash, we rise.', crest: 'totem',
      rank: 3, loyalty_total: 240900,
    },
    ash: { ready: false, per_pool: 420, pools_stored: 3, next_ready_in_ms: 1000 * 60 * 12, interval_min: 30 },
    daily: [
      { id: 'checkin', title: 'Feed the Fire', reward: 120, done: true },
      { id: 'stoke', title: 'Stoke the Great Pyre', reward: 200, done: false },
      { id: 'gather', title: 'Gather the Ash twice', reward: 150, done: false },
    ],
    war: { active: true, opponent: 'Stormfang', attacker_score: 6120, defender_score: 5890, ends_in_ms: 1000 * 60 * 60 * 5, goal: 10000 },
    bonfire: { active: true, title: 'Double Ash Hour', multiplier: 2, ends_in_ms: 1000 * 60 * 42 },
  };
}

export const useGame = create((set, get) => ({
  loading: true,
  error: null,
  data: null,

  async load() {
    set({ loading: true, error: null });
    try {
      const data = await api.state();
      set({ data, loading: false });
    } catch (e) {
      // Fall back to demo so the experience is never a blank screen.
      const isAuth = e instanceof ApiError && (e.status === 401 || e.status === 403);
      set({ data: demoState(), loading: false, error: isAuth ? 'guest' : (e.message || 'offline') });
    }
  },

  patch(partial) {
    set({ data: { ...(get().data || {}), ...partial } });
  },

  // Optimistically bump ember and merge server truth when it returns.
  async act(fn, optimistic) {
    const prev = get().data;
    if (optimistic) set({ data: { ...prev, ...optimistic } });
    try {
      const res = await fn();
      if (res && typeof res === 'object') set({ data: { ...get().data, ...res } });
      return res;
    } catch (e) {
      set({ data: prev }); // rollback
      throw e;
    }
  },
}));
