// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/games/match3.js
// PURPOSE: Score match-3 style games. Combo-based score.
// DEPENDS ON: nothing
// ═══════════════════════════════════════════════════════════════════
export function match3Score(_slug, payload) {
  const score = Math.max(0, Math.floor(Number(payload?.score) || 0));
  const bestCombo = Math.max(1, Math.floor(Number(payload?.best_combo) || 1));
  const base = Math.min(70, Math.round(score / 30));
  const combo = Math.min(30, bestCombo * 4);
  return Math.max(0, Math.min(100, base + combo));
}