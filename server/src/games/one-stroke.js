// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/games/one-stroke.js
// PURPOSE: Score one-stroke puzzle games. Puzzles solved + speed.
// DEPENDS ON: nothing
// ═══════════════════════════════════════════════════════════════════
export function oneStrokeScore(_slug, payload) {
  const solved = Math.max(0, Math.floor(Number(payload?.solved) || 0));
  const timeMs = Math.max(1, Math.floor(Number(payload?.time_ms) || 1));
  const base = Math.min(75, solved * 15);
  const speedBonus = Math.max(0, Math.min(25, Math.round(30000 / timeMs)));
  return Math.max(0, Math.min(100, base + speedBonus));
}