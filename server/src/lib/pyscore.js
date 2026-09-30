// TRIBES-FILE: server/src/lib/pyscore.js
// PHASE: 4 — Rise of the Eternal Flame
//
// Bridge to the Python scoring microservice (pyscore/app.py). This is the
// "Python into the system" hybrid: the Node server delegates reflex scoring
// to Python WHEN a PYSCORE_URL env var is configured, and otherwise falls
// back to an identical Node implementation — so the existing Node-only Render
// deploy keeps working with zero new infra. Scoring stays server-authoritative
// either way: the client sends raw reaction times, never a trusted score.

// Node-native twin of pyscore/app.py :: reflex_score().
export function reflexScoreLocal(times) {
  const arr = (Array.isArray(times) ? times : [])
    .map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (!arr.length) return 0;
  const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
  return clamp(Math.round(120 - (avg - 200) / 6));
}

function clamp(n) { return Math.max(0, Math.min(100, Number(n) || 0)); }

// Returns a 0..100 integer. Delegates to Python if PYSCORE_URL is set; any
// network/parse failure degrades gracefully to the Node twin.
export async function reflexScore(times) {
  const base = process.env.PYSCORE_URL;
  if (!base) return reflexScoreLocal(times);
  try {
    const res = await fetch(base.replace(/\/+$/, '') + '/score/reflex', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ times }),
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) throw new Error('pyscore http ' + res.status);
    const j = await res.json();
    const n = Number(j?.score);
    return Number.isFinite(n) ? clamp(Math.round(n)) : reflexScoreLocal(times);
  } catch {
    return reflexScoreLocal(times); // never let scoring take down a duel
  }
}
