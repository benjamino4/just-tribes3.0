export function deductionScore(_slug, payload) {
  const won = Math.max(0, Math.floor(Number(payload.rounds_won) || 0));
  const lost = Math.max(0, Math.floor(Number(payload.rounds_lost) || 0));
  const total = won + lost;
  if (total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(won / total * 100)));
}