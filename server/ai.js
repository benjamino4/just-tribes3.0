const PROVIDERS = [
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

async function callOne(provider, prompt) {
  const key = provider.key();
  if (!key) return null;
  try {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parsed = JSON.parse(data.choices[0].message.content);
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
  const results = await Promise.all(PROVIDERS.map(p => callOne(p, prompt)));
  const valid = results.filter(Boolean);

  if (!valid.length) {
    return { ranking: [], votes: [], reason: '', error: 'no_ai_response' };
  }

  const optionIds = options.map(o => o.id);
  const ranking = consensusRanking(valid, optionIds);
  const topReason = valid[0]?.reason || '';

  return { ranking, votes: valid, reason: topReason };
}

export async function askAI(prompt, providerIndex = 0) {
  const provider = PROVIDERS[providerIndex] || PROVIDERS[0];
  return callOne(provider, prompt);
}

export async function askAllAIs(prompt) {
  const results = await Promise.all(PROVIDERS.map(p => callOne(p, prompt)));
  return results.filter(Boolean);
}