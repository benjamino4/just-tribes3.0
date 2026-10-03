// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/games/sorter.js
// PURPOSE: Score sorter games. Levels + speed.
// DEPENDS ON: nothing
// ═══════════════════════════════════════════════════════════════════
export function sorterScore(_slug, payload) {
  const levels = Math.max(0, Math.floor(Number(payload?.levels) || 0));
  const timeMs = Math.max(1, Math.floor(Number(payload?.time_ms) || 1));
  const base = Math.min(80, levels * 12);
  const speedBonus = Math.max(0, Math.min(20, Math.round(20000 / timeMs)));
  return Math.max(0, Math.min(100, base + speedBonus));
}