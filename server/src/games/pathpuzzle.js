// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/games/pathpuzzle.js
// PURPOSE: Score path puzzle games. Levels + efficiency.
// DEPENDS ON: nothing
// ═══════════════════════════════════════════════════════════════════
export function pathPuzzleScore(_slug, payload) {
  const levels = Math.max(0, Math.floor(Number(payload?.levels) || 0));
  const rotations = Math.max(0, Math.floor(Number(payload?.rotations) || 0));
  const base = Math.min(80, levels * 15);
  const efficiency = Math.max(0, Math.min(20, 40 - rotations));
  return Math.max(0, Math.min(100, base + efficiency));
}