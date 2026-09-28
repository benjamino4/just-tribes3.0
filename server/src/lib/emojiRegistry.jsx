// =====================================================================
// Emoji registry — merges the built-in client-side map with the
// server's custom defs. Provides <EmojiProvider> + useEmojiRegistry().
// =====================================================================
import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { apiGet } from './api.js';
import { EMOJI } from '../data/emojis.js';

const Ctx = createContext({
  custom: {},
  sets: [],
  free: [],
  ready: false,
  reload: async () => {},
  resolve: (key) => EMOJI[key] || EMOJI['spark_orbit'],
});

export function EmojiProvider({ children }) {
  const [state, setState] = useState({
    custom: {},
    sets: [],
    free: [],
    ready: false,
  });

  const load = useCallback(async () => {
    try {
      const r = await apiGet('/api/emoji/state');
      setState({
        custom: r.custom || {},
        sets: r.sets || [],
        free: r.free || [],
        ready: true,
      });
    } catch {
      setState((s) => ({ ...s, ready: true }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolve = useCallback((key) => {
    if (!key) return null;
    const c = state.custom[key];
    if (c) return c;
    return EMOJI[key] || null;
  }, [state.custom]);

  const value = useMemo(() => ({ ...state, reload: load, resolve }), [state, load, resolve]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEmojiRegistry() {
  return useContext(Ctx);
}