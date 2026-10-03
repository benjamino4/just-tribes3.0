// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/games/jumper.js
// PURPOSE: Score endless jumper games. Distance + perfects.
// DEPENDS ON: nothing
// ═══════════════════════════════════════════════════════════════════
export function jumperScore(_slug, payload) {
  const distance = Math.max(0, Math.floor(Number(payload?.distance) || 0));
  const perfects = Math.max(0, Math.floor(Number(payload?.perfects) || 0));
  const base = Math.min(70, distance);
  const bonus = Math.min(30, perfects * 3);
  return Math.max(0, Math.min(100, base + bonus));
}