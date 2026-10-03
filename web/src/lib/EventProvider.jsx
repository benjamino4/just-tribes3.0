// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/lib/EventProvider.jsx
// PURPOSE: SSE connection to /api/events/stream. Fan-out to subscribers.
// DEPENDS ON: telegram.js
// ═══════════════════════════════════════════════════════════════════
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { initData } from './telegram.js';

const Ctx = createContext({ subscribe: () => () => {}, lastEvent: null });

export function EventProvider({ children }) {
  const [lastEvent, setLastEvent] = useState(null);
  const handlers = useRef(new Set());

  useEffect(() => {
    const id = initData();
    if (!id) return;
    const params = new URLSearchParams({ initData: id });
    const es = new EventSource(`/api/events/stream?${params}`);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        setLastEvent(data);
        for (const fn of handlers.current) { try { fn(data); } catch {} }
      } catch {}
    };
    es.onerror = () => {};
    return () => es.close();
  }, []);

  const subscribe = (fn) => {
    handlers.current.add(fn);
    return () => handlers.current.delete(fn);
  };

  return <Ctx.Provider value={{ subscribe, lastEvent }}>{children}</Ctx.Provider>;
}

export function useEvents() {
  return useContext(Ctx);
}