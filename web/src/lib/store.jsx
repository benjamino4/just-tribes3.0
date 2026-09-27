// =====================================================================
// TRIBES — global app state.
// Minimal Zustand-style store via React context. Phase 1: fetch
// /api/state once and expose it. Phase 2 adds auth + mutations.
// =====================================================================
import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const Ctx = createContext(null);

export function AppProvider({ children }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/state', {
        headers: { 'Content-Type': 'application/json' },
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      setData(j);
    } catch (e) {
      setError(e.message || 'offline');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = useCallback((p) => {
    setData((d) => ({ ...(d || {}), ...p }));
  }, []);

  return (
    <Ctx.Provider value={{ data, loading, error, reload: load, patch }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
}
