import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { apiGet } from './api.js';

const FALLBACK = { custom: {}, sets: [], free: [], ready: false };

const Ctx = createContext({
  ...FALLBACK,
  reload: async () => {},
  resolve: () => null
});

export function EmojiProvider({ children }) {
  const [state, setState] = useState(FALLBACK);

  const load = useCallback(async () => {
    try {
      const r = await apiGet('/api/emoji/state');
      const body = r.data || r;
      setState({
        custom: body.custom || {},
        sets: body.sets || [],
        free: body.free || [],
        ready: true
      });
    } catch {
      setState((s) => ({ ...s, ready: true }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolve = useCallback((key) => {
    if (!key) return null;
    return state.custom[key] || null;
  }, [state.custom]);

  const value = useMemo(() => ({ ...state, reload: load, resolve }), [state, load, resolve]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEmojiRegistry() { return useContext(Ctx); }