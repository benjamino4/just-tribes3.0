// TRIBES-FILE: web/src/lib/notifStream.js
// PHASE: 7 — Meta & Admin
// EventSource for /api/notifications/stream. Broadcasts a ping
// whenever a new row lands; the client refetches.

import { initData } from './telegram.js';

export function openNotifStream(handlers = {}) {
  const id = initData();
  if (!id) return null;   // no Telegram → no stream (guest mode polls)
  const params = new URLSearchParams({ initData: id });
  const es = new EventSource(`/api/notifications/stream?${params}`);

  es.onopen = () => handlers.onOpen?.();
  es.onerror = () => handlers.onError?.();
  es.onmessage = (ev) => {
    try { handlers.onEvent?.(JSON.parse(ev.data)); } catch {}
  };
  return es;
}