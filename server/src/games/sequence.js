export function sequenceScore(_slug, payload) {
  const chainLen = Math.max(0, Math.floor(Number(payload.chain_len) || 0));
  const won = !!payload.won;
  const base = Math.min(100, chainLen * 8);
  return won ? 100 : Math.min(80, base);
}