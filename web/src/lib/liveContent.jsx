import { createContext, useContext, useEffect, useState } from 'react';
import { apiGet } from './api.js';

const Ctx = createContext({ content: {}, refresh: () => {} });
const CACHE_MS = 30000;

export function LiveContentProvider({ children }) {
  const [content, setContent] = useState({});
  const [lastFetch, setLastFetch] = useState(0);

  const refresh = async () => {
    const now = Date.now();
    if (now - lastFetch < CACHE_MS && Object.keys(content).length) return;
    try {
      const r = await apiGet('/api/content/all');
      const data = (r.data || r) || {};
      setContent(data);
      setLastFetch(now);
      if (data.colors) {
        for (const [key, value] of Object.entries(data.colors)) {
          document.documentElement.style.setProperty(`--${key}`, value);
        }
      }
    } catch {}
  };

  useEffect(() => { refresh(); }, []);

  return <Ctx.Provider value={{ content, refresh }}>{children}</Ctx.Provider>;
}

export function useLiveContent() { return useContext(Ctx); }