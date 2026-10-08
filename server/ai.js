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

// Low-level call. `json:true` asks for a JSON ranking object; `json:false`
// returns the raw assistant text (used by chat).
async function callOne(provider, messages, { json = true } = {}) {
  const key = typeof provider.key === 'function' ? provider.key() : provider.key;
  if (!key) return null;
  try {
    const body = {
      model: provider.model,
      messages,
      temperature: json ? 0 : 0.7,
    };
    if (json) body.response_format = { type: 'json_object' };
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? '';
    if (!json) return { provider: provider.name, model: provider.model, content };
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed.ranking)) return null;
    return {
      model: provider.model,
      provider: provider.name,
      ranking: parsed.ranking,
      reason: parsed.reason ?? '',
    };
  } catch {
    return null;
  }
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
  if (!p.hasKey) return { error: 'no_key' };
  const r = await callOne(p, messages, { json: false });
  if (!r) return { error: 'no_response' };
  return { content: r.content, provider: p.name, model: p.model };
}

// Quick liveness probe used by the admin "test" button.
export async function testProvider(id) {
  return chatProvider(id, [{ role: 'user', content: 'Reply with just the word: ok' }]);
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
