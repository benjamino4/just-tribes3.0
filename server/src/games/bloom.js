// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/games/bloom.js
// PURPOSE: Score 2048-like games. Highest tier reached.
// DEPENDS ON: nothing
// ═══════════════════════════════════════════════════════════════════
export function bloomScore(_slug, payload) {
  const highestTier = Math.max(0, Math.floor(Number(payload?.highest_tier) || 0));
  const moves = Math.max(0, Math.floor(Number(payload?.moves) || 0));
  const base = Math.min(80, highestTier * 10);
  const efficiency = Math.max(0, Math.min(20, 30 - Math.floor(moves / 10)));
  return Math.max(0, Math.min(100, base + efficiency));
}