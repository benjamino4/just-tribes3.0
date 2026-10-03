// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/lib/store.jsx
// PURPOSE: Global app state. Loads /api/state once. Exposes reload.
// DEPENDS ON: api.js
// ═══════════════════════════════════════════════════════════════════
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
      setData(j.data || j);
    } catch (e) {
      const guest = e instanceof ApiError && (e.status === 401 || e.status === 403);
      setError(guest ? 'guest' : (e.message || 'offline'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = useCallback((p) => setData((d) => ({ ...(d || {}), ...p })), []);

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