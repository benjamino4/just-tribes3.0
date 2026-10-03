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

  // Silent refresh: pulls fresh state WITHOUT flipping the `loading` flag, so the
  // UI swaps in new numbers in place instead of flashing a skeleton/spinner.
  // Used for event-driven, near-real-time updates (no flicker).
  const reloadSilent = useCallback(async () => {
    try {
      const j = await Endpoints.state();
      setData(j.data || j);
    } catch { /* keep showing last-known state on a transient failure */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const patch = useCallback((p) => setData((d) => ({ ...(d || {}), ...p })), []);

  return (
    <Ctx.Provider value={{ data, loading, error, reload: load, reloadSilent, patch }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp outside AppProvider');
  return c;
}