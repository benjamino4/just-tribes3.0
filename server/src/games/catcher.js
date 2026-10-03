// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/games/catcher.js
// PURPOSE: Score catcher games. Catch count + waves.
// DEPENDS ON: nothing
// ═══════════════════════════════════════════════════════════════════
export function catcherScore(_slug, payload) {
  const caught = Math.max(0, Math.floor(Number(payload?.caught) || 0));
  const waves = Math.max(0, Math.floor(Number(payload?.waves) || 0));
  const missed = Math.max(0, Math.floor(Number(payload?.missed) || 0));
  const base = Math.min(80, caught * 2);
  const waveBonus = Math.min(20, waves * 5);
  const missPenalty = Math.min(30, missed * 5);
  return Math.max(0, Math.min(100, base + waveBonus - missPenalty));
}