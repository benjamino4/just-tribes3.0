// TRIBES-FILE: web/src/lib/kivaStream.js
// PHASE: 5 — Council & Kiva
// EventSource wrapper for the Kiva stream. Auto-reconnects.

import { initData } from './telegram.js';

const GUEST_KEY = 'tribes.guest';

function guestId() {
  try {
    let g = localStorage.getItem(GUEST_KEY);
    if (!g) { g = 'g' + Math.floor(1e6 + Math.random() * 9e6); localStorage.setItem(GUEST_KEY, g); }
    return g;
  } catch { return 'g100000'; }
}

export function openKivaStream(tribeId, handlers = {}) {
  if (!tribeId) return null;

  const id = initData();
  const params = new URLSearchParams({
    tribeId: String(tribeId),
    initData: id || '',
    guestId: id ? '' : guestId(),
  });

  const es = new EventSource(`/api/kiva/stream?${params}`);

  es.onopen = () => handlers.onOpen?.();
  es.onerror = () => handlers.onError?.();
  es.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      handlers.onEvent?.(msg);
    } catch {}
  };

  return es;
}