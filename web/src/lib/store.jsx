// TRIBES-FILE: web/src/lib/store.jsx
// PHASE: 2 — Identity & shell
// Global app state. Wraps /api/state with an optimistic patch() so
// Phase 3+ mutations can update the UI instantly and roll back on error.

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Endpoints, ApiError } from './api.js';

const Ctx = createContext(null);

export function AppProvider({ children }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const j = await Endpoints.state();
      setData(j);
    } catch (e) {
      const guest = e instanceof ApiError && (e.status === 401 || e.status === 403);
      setError(guest ? 'guest' : (e.message || 'offline'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* optimistic mutation wrapper:
   *  - immediately merges `optimistic` into data
   *  - runs `fn` (usually an api call that returns new state)
   *  - on success merges the returned state
   *  - on failure rolls back to the previous snapshot
   */
  const act = useCallback(async (fn, optimistic) => {
    let snapshot = null;
    setData((d) => {
      snapshot = d;
      return optimistic && d ? { ...d, ...optimistic } : d;
    });
    try {
      const res = await fn();
      if (res && typeof res === 'object') {
        setData((d) => ({ ...(d || {}), ...res }));
      }
      return res;
    } catch (e) {
      setData(snapshot);
      throw e;
    }
  }, []);

  const patch = useCallback((p) => {
    setData((d) => ({ ...(d || {}), ...p }));
  }, []);

  return (
    <Ctx.Provider value={{ data, loading, error, reload: load, patch, act }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
}