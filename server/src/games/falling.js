// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/games/falling.js
// PURPOSE: Score falling-blocks games. Lines cleared + score.
// DEPENDS ON: nothing
// ═══════════════════════════════════════════════════════════════════
export function fallingScore(_slug, payload) {
  const lines = Math.max(0, Math.floor(Number(payload?.lines) || 0));
  const score = Math.max(0, Math.floor(Number(payload?.score) || 0));
  const base = Math.min(70, lines * 4);
  const scoreBonus = Math.min(30, Math.round(score / 100));
  return Math.max(0, Math.min(100, base + scoreBonus));
}