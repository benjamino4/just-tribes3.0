// ═══════════════════════════════════════════════════════════════════
// FILE: server/src/games/echo.js
// PURPOSE: Score echo rhythm games. Chain of correct echoes.
// DEPENDS ON: nothing
// ═══════════════════════════════════════════════════════════════════
export function echoScore(_slug, payload) {
  const correct = Math.max(0, Math.floor(Number(payload?.correct) || 0));
  const total = Math.max(0, Math.floor(Number(payload?.total) || 0));
  const bestStreak = Math.max(0, Math.floor(Number(payload?.best_streak) || 0));
  if (total <= 0) return 0;
  const base = Math.min(70, Math.round(correct / total * 70));
  const streakBonus = Math.min(30, bestStreak * 2);
  return Math.max(0, Math.min(100, base + streakBonus));
}