import { reflexScore } from '../lib/pyscore.js';

export function reactionScore(gameSlug, payload) {
  const times = Array.isArray(payload.times) ? payload.times : [];
  const s = reflexScore ? 0 : 0; // placeholder for sync fallback
  // pyscore.js exports an async reflexScore — but reaction is computed locally here
  return reflexScoreLocal(times);
}

function reflexScoreLocal(times) {
  const arr = (Array.isArray(times) ? times : [])
    .map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (!arr.length) return 0;
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.max(0, Math.min(100, Math.round(120 - (avg - 200) / 6)));
}