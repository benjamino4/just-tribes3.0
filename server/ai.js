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

function buildPrompt(question, outcome, options) {
  const optLines = options.map(o => `${o.id}: ${o.text}`).join('\n');
  return `You are a strict classifier for a prediction game.
Question: ${question}
What actually happened: ${outcome}

Options:
${optLines}

Return ONLY valid JSON:
{"winner_id": "<one of: ${options.map(o => o.id).join(', ')}>", "confidence": 0.0, "reason": "max 15 words"}`;
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
    return {
      model: provider.model,
      provider: provider.name,
      winner_id: parsed.winner_id,
      confidence: parsed.confidence ?? 0,
      reason: parsed.reason ?? '',
    };
  } catch {
    return null;
  }
}

export async function judgeWithVoting(question, outcome, options) {
  const prompt = buildPrompt(question, outcome, options);
  const results = await Promise.all(PROVIDERS.map(p => callOne(p, prompt)));
  const valid = results.filter(Boolean);

  if (!valid.length) {
    return { winner_id: null, votes: [], error: 'no_ai_response' };
  }

  const counts = {};
  valid.forEach(v => {
    counts[v.winner_id] = (counts[v.winner_id] || 0) + 1;
  });
  const winner_id = Object.keys(counts).reduce((a, b) =>
    counts[a] > counts[b] ? a : b
  );

  const topReason = valid.find(v => v.winner_id === winner_id)?.reason || '';
  return { winner_id, votes: valid, reason: topReason };
}

export async function askAI(prompt, providerIndex = 0) {
  const provider = PROVIDERS[providerIndex] || PROVIDERS[0];
  return callOne(provider, prompt);
}

export async function askAllAIs(prompt) {
  const results = await Promise.all(PROVIDERS.map(p => callOne(p, prompt)));
  return results.filter(Boolean);
}