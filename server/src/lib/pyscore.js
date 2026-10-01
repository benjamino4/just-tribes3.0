function clamp(n) { return Math.max(0, Math.min(100, Number(n) || 0)); }

export function reflexScoreLocal(times) {
  const arr = (Array.isArray(times) ? times : [])
    .map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (!arr.length) return 0;
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  return clamp(Math.round(120 - (avg - 200) / 6));
}

export async function reflexScore(times) {
  const base = process.env.PYSCORE_URL;
  if (!base) return reflexScoreLocal(times);
  try {
    const res = await fetch(base.replace(/\/+$/, '') + '/score/reaction', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ times }),
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) throw new Error('pyscore http ' + res.status);
    const j = await res.json();
    const n = Number(j?.score);
    return Number.isFinite(n) ? clamp(Math.round(n)) : reflexScoreLocal(times);
  } catch { return reflexScoreLocal(times); }
}