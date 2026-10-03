// ═══════════════════════════════════════════════════════════════════
// FILE: web/src/lib/raf.js
// PURPOSE: The one and only requestAnimationFrame loop.
//          Subscribers add/remove. Loop sleeps when nobody subscribes.
// DEPENDS ON: nothing
// ═══════════════════════════════════════════════════════════════════
let running = false;
let rafId = 0;
const subscribers = new Set();

function tick(t) {
  if (!running) return;
  for (const fn of subscribers) {
    try { fn(t); } catch (e) { console.warn('[raf]', e); }
  }
  rafId = requestAnimationFrame(tick);
}

export function subscribe(fn) {
  subscribers.add(fn);
  if (!running) {
    running = true;
    rafId = requestAnimationFrame(tick);
  }
  return () => {
    subscribers.delete(fn);
    if (!subscribers.size) {
      running = false;
      cancelAnimationFrame(rafId);
    }
  };
}

export function isRunning() { return running; }