// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/games/choice.js
// PURPOSE: Score choice-style games. Win rate.
// DEPENDS ON: nothing
// ═══════════════════════════════════════════════════════════════════
export function choiceScore(_slug, payload) {
  const wins = Math.max(0, Math.floor(Number(payload?.wins) || 0));
  const losses = Math.max(0, Math.floor(Number(payload?.losses) || 0));
  const total = wins + losses;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(wins / total * 100)));
}