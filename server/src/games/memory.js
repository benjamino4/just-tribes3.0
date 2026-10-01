export function memoryScore(_slug, payload) {
  const correct = Math.max(0, Math.floor(Number(payload.correct) || 0));
  const total = Math.max(0, Math.floor(Number(payload.total) || 0));
  const maxLen = Math.max(1, Math.floor(Number(payload.max_len) || 1));
  if (total <= 0) return 0;
  const acc = correct / Math.max(1, total);
  const depth = Math.min(1, maxLen / 12);
  return Math.max(0, Math.min(100, Math.round(acc * 70 + depth * 30)));
}