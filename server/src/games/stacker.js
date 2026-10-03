// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/games/stacker.js
// PURPOSE: Score stacker games. Height + perfect stacks.
// DEPENDS ON: nothing
// ═══════════════════════════════════════════════════════════════════
export function stackerScore(_slug, payload) {
  const height = Math.max(0, Math.floor(Number(payload?.height) || 0));
  const perfects = Math.max(0, Math.floor(Number(payload?.perfects) || 0));
  const base = Math.min(70, height * 3);
  const bonus = Math.min(30, perfects * 4);
  return Math.max(0, Math.min(100, base + bonus));
}