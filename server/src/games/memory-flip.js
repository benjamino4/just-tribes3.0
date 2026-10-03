// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/games/memory-flip.js
// PURPOSE: Score memory-flip games. Matches + speed.
// DEPENDS ON: nothing
// ═══════════════════════════════════════════════════════════════════
export function memoryFlipScore(_slug, payload) {
  const matches = Math.max(0, Math.floor(Number(payload?.matches) || 0));
  const misses = Math.max(0, Math.floor(Number(payload?.misses) || 0));
  const timeMs = Math.max(1, Math.floor(Number(payload?.time_ms) || 1));
  const base = Math.min(70, matches * 8);
  const accuracy = Math.max(0, Math.min(20, matches * 3 - misses * 2));
  const speed = Math.max(0, Math.min(10, Math.round(20000 / timeMs)));
  return Math.max(0, Math.min(100, base + accuracy + speed));
}