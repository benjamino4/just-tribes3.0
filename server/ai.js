import { q } from './db.js';

// ═════════════════════════════════════════════════════════
// AI judges + freeform chat.
//
// Providers come from TWO sources, merged at call time:
//   1. ENV — the three free providers baked in (groq / cerebras / gemini).
//      Present only when their API key env var is set.
//   2. DB  — extra OpenAI-compatible providers the admin registers later
//      from the admin bot (name | url | model | key), stored in ai_providers.
//
// Every provider is normalised to:
//   { id, dbId?, name, url, model, key, active, source, hasKey }
// so judging + chat treat env and db providers identically.
// ═════════════════════════════════════════════════════════

const ENV_PROVIDERS = [
  {
    name: 'groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: () => process.env.GROQ_API_KEY,
    model: 'llama-3.1-8b-instant',
  },
  {
    name: 'cerebras',
    url: 'https://api.cerebras.ai/v1/chat/completions',
    key: () => process.env.CEREBRAS_API_KEY,
    model: 'llama3.1-8b',
  },
  {
    name: 'gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    key: () => process.env.GEMINI_API_KEY,
    model: 'gemini-2.0-flash',
  },
];

// ─── Provider registry (env + db merged) ────────────────
export async function listProviders() {
  const env = ENV_PROVIDERS.map((p) => {
    const key = p.key();
    return {
      id: 'env:' + p.name,
      name: p.name,
      url: p.url,
      model: p.model,
      key,
      active: true,
      source: 'env',
      hasKey: !!key,
    };
  });

  let db = [];
  try {
    const { rows } = await q('SELECT * FROM ai_providers ORDER BY id');
    db = rows.map((r) => ({
      id: 'db:' + r.id,
      dbId: r.id,
      name: r.name,
      url: r.url,
      model: r.model,
      key: r.api_key,
      active: r.active,
      source: 'db',
      hasKey: !!r.api_key,
    }));
  } catch {
    // ai_providers table may not exist yet (fresh DB before migrate) — ignore.
  }

  return [...env, ...db];
}

// Only providers that can actually be called: active AND have a key.
export async function activeProviders() {
  const all = await listProviders();
  return all.filter((p) => p.active && p.hasKey);
}

export async function getProvider(id) {
  const all = await listProviders();
  return all.find((p) => p.id === id) || null;
}

// ─── Provider CRUD (db-backed, admin-managed) ───────────
export async function addProvider(name, url, model, key) {
  const { rows } = await q(
    `INSERT INTO ai_providers (name, url, model, api_key, active)
     VALUES ($1,$2,$3,$4,TRUE) RETURNING id`,
    [name, url, model, key]);
  return rows[0].id;
}

export async function toggleProvider(dbId) {
  const { rows } = await q(
    `UPDATE ai_providers SET active = NOT active WHERE id=$1 RETURNING active`,
    [dbId]);
  return rows[0]?.active;
}

export async function deleteProvider(dbId) {
  await q(`DELETE FROM ai_providers WHERE id=$1`, [dbId]);
}

// ─── Ranking (judge) ────────────────────────────────────
function buildRankingPrompt(question, outcome, options) {
  const ids = options.map(o => o.id).join(', ');
  const lines = options.map(o => `${o.id}: ${o.text}`).join('\n');
  return `You are a strict judge for a prediction game.

Question: ${question}
What actually happened: ${outcome}

Options:
${lines}

Rank ALL options from BEST to WORST based on how well they match what actually happened.
Every option must appear exactly once.

Return ONLY valid JSON in this exact shape:
{
  "ranking": ["<best_id>", "<2nd_id>", "<3rd_id>", ...],
  "reason": "max 20 words"
}

Allowed ids: ${ids}`;
}

// Robust JSON extraction: strips ```fences``` and pulls the first {...} block
// so providers that ignore response_format (or wrap it in prose) still parse.
function extractJson(text) {
  if (!text) return null;
  let t = String(text).trim();
  t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(t); } catch {}
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s !== -1 && e > s) { try { return JSON.parse(t.slice(s, e + 1)); } catch {} }
  return null;
}

// Single HTTP call to one OpenAI-compatible provider.
// Returns { ok, status, content, error } and NEVER throws, so every caller can
// surface a precise reason instead of a silent null.
async function rawCall(provider, messages, { json = false, forceJsonFormat = true } = {}) {
  const key = typeof provider.key === 'function' ? provider.key() : provider.key;
  if (!key) return { ok: false, status: 0, error: 'missing_api_key' };
  const body = { model: provider.model, messages, temperature: json ? 0 : 0.7 };
  if (json && forceJsonFormat) body.response_format = { type: 'json_object' };

  let res;
  try {
    res = await fetch(provider.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return { ok: false, status: 0, error: 'network: ' + (e.message || 'fetch failed') };
  }

  const raw = await res.text().catch(() => '');
  if (!res.ok) {
    // Many providers (e.g. some Gemini/Cerebras models) reject response_format.
    // Retry once WITHOUT it before giving up.
    if (json && forceJsonFormat &&
        (res.status === 400 || res.status === 404 || res.status === 422 || /response_format|json|schema/i.test(raw))) {
      return rawCall(provider, messages, { json, forceJsonFormat: false });
    }
    let msg = raw;
    try { msg = JSON.parse(raw)?.error?.message || raw; } catch {}
    return { ok: false, status: res.status, error: String(msg || res.statusText || 'request_failed').slice(0, 300) };
  }

  let data;
  try { data = JSON.parse(raw); } catch { return { ok: false, status: res.status, error: 'bad_json_response' }; }
  const content = data.choices?.[0]?.message?.content ?? '';
  return { ok: true, status: res.status, content };
}

// Ranking/chat wrapper used by the judge path. Returns a normalised vote (json)
// or raw-content object (chat), or null on failure (so callers can filter).
async function callOne(provider, messages, { json = true } = {}) {
  const r = await rawCall(provider, messages, { json });
  if (!r.ok) {
    console.error(`[ai] ${provider.name} failed (${r.status}): ${r.error}`);
    return null;
  }
  if (!json) return { provider: provider.name, model: provider.model, content: r.content };
  const parsed = extractJson(r.content);
  if (!parsed || !Array.isArray(parsed.ranking)) {
    console.error(`[ai] ${provider.name} returned an unparseable ranking`);
    return null;
  }
  return {
    model: provider.model,
    provider: provider.name,
    ranking: parsed.ranking,
    reason: parsed.reason ?? '',
  };
}

// Merge multiple AI rankings into one consensus ranking via Borda count.
function consensusRanking(votes, optionIds) {
  const score = {};
  optionIds.forEach(id => (score[id] = 0));
  const N = optionIds.length;

  for (const v of votes) {
    const r = v.ranking.filter(id => optionIds.includes(id));
    r.forEach((id, i) => {
      score[id] += N - i; // top position = N points
    });
  }

  return [...optionIds].sort((a, b) => score[b] - score[a]);
}

export async function judgeWithRanking(question, outcome, options) {
  const prompt = buildRankingPrompt(question, outcome, options);
  const providers = await activeProviders();
  const results = await Promise.all(
    providers.map(p => callOne(p, [{ role: 'user', content: prompt }], { json: true })));
  const valid = results.filter(Boolean);

  if (!valid.length) {
    return { ranking: [], votes: [], reason: '', error: 'no_ai_response' };
  }

  const optionIds = options.map(o => o.id);
  const ranking = consensusRanking(valid, optionIds);
  const topReason = valid[0]?.reason || '';

  return { ranking, votes: valid, reason: topReason };
}

// ─── Freeform chat (admin ↔ a chosen provider, multi-turn) ──
// `messages` is a standard OpenAI chat array [{role, content}, ...].
export async function chatProvider(id, messages) {
  const p = await getProvider(id);
  if (!p) return { error: 'no_such_provider' };
  if (!p.hasKey) return { error: 'missing_api_key' };
  const r = await rawCall(p, messages, { json: false });
  if (!r.ok) return { error: r.error || 'no_response', status: r.status };
  return { content: r.content, provider: p.name, model: p.model };
}

// Quick liveness probe used by the admin "test" button. Surfaces the real
// HTTP status + error text so a bad key / wrong model / dead endpoint is obvious.
export async function testProvider(id) {
  const p = await getProvider(id);
  if (!p) return { ok: false, error: 'no_such_provider' };
  if (!p.hasKey) return { ok: false, error: 'missing_api_key', provider: p.name, model: p.model };
  const r = await rawCall(p, [{ role: 'user', content: 'Reply with just the word: ok' }], { json: false });
  if (!r.ok) return { ok: false, status: r.status, error: r.error, provider: p.name, model: p.model };
  return { ok: true, provider: p.name, model: p.model, content: (r.content || '').trim().slice(0, 120) };
}

// Back-compat single/all helpers (json ranking style).
export async function askAI(prompt) {
  const providers = await activeProviders();
  if (!providers.length) return null;
  return callOne(providers[0], [{ role: 'user', content: prompt }], { json: true });
}

export async function askAllAIs(prompt) {
  const providers = await activeProviders();
  const results = await Promise.all(
    providers.map(p => callOne(p, [{ role: 'user', content: prompt }], { json: true })));
  return results.filter(Boolean);
}
