const SOURCE_TIMEOUT_MS = 12000;

function getApiKey() {
  const key = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '';
  if (!key || /your_(?:openrouter_)?key_here/i.test(key)) return '';
  return key;
}

function fallbackDate(personA, personB, mode = 'fallback:provider-error') {
  const aTag = personA.tags?.[0] || 'curiosity';
  const bTag = personB.tags?.[0] || 'craft';
  return {
    mode,
    chemistry: 82,
    messages: [
      { speaker: 'a', text: `I keep coming back to “${aTag}.” What does that look like when nobody is watching?` },
      { speaker: 'b', text: `Probably less polished than the internet thinks. What about ${bTag} still surprises you?` },
      { speaker: 'a', text: 'The part where the idea gets specific. I think you would understand that.' },
      { speaker: 'b', text: 'Then we should keep talking — preferably somewhere with a very long menu.' }
    ],
    read: mode === 'fallback:missing-key' ? 'The fallback date is ready. Add an OpenRouter key to let the agents write a fresh conversation.' : 'OpenRouter returned no usable transcript. Check the selected free model or your account privacy settings.'
  };
}

function safePerson(person = {}) {
  return {
    name: String(person.name || 'Unknown agent').slice(0, 120),
    role: String(person.role || '').slice(0, 180),
    tags: Array.isArray(person.tags) ? person.tags.slice(0, 8).map(String) : [],
    needs: Array.isArray(person.needs) ? person.needs.slice(0, 5).map(String) : [],
    voice: String(person.voice || '').slice(0, 500)
  };
}

function parseModelJson(content) {
  const cleaned = String(content || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(cleaned); } catch { return null; }
}

async function aiDate(personA, personB) {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  const baseUrl = (process.env.OPENROUTER_BASE_URL || process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const model = process.env.OPENROUTER_MODEL || process.env.OPENAI_MODEL || 'openrouter/free';
  const prompt = {
    personA: safePerson(personA),
    personB: safePerson(personB),
    task: 'Write a short first date between these two agents. Make it specific to their signals, warm, slightly surprising, and not generic.',
    output: 'Return only JSON: {"chemistry": number from 60 to 98, "messages": [{"speaker":"a"|"b","text":"..."}, ... exactly 6 messages], "read":"one sentence explaining the spark and friction"}. Each message should be 1-2 sentences and under 180 characters.'
  };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:4173',
        'X-Title': process.env.SITE_NAME || 'bondroom'
      },
      body: JSON.stringify({
        model,
        temperature: 0.85,
        max_tokens: 5000,
        messages: [
          { role: 'system', content: 'You are the bondroom date engine. Do not invent private facts. Use only the supplied public-signal summary. Return valid JSON only.' },
          { role: 'user', content: JSON.stringify(prompt) }
        ]
      })
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    const parsed = parseModelJson(content);
    if (!parsed || !Array.isArray(parsed.messages) || parsed.messages.length < 4) return null;
    const messages = parsed.messages.slice(0, 6).map((message, index) => ({
      speaker: message.speaker === 'b' ? 'b' : index % 2 === 0 ? 'a' : 'b',
      text: String(message.text || '').trim().slice(0, 320)
    })).filter((message) => message.text);
    if (messages.length < 4) return null;
    return {
      mode: `ai:${model}`,
      chemistry: Math.min(98, Math.max(60, Number(parsed.chemistry) || 82)),
      messages,
      read: String(parsed.read || 'Their agents found a specific spark worth a second conversation.').slice(0, 300)
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end(JSON.stringify({ error: 'POST only' }));
  }
  const body = req.body || {};
  const personA = safePerson(body.personA);
  const personB = safePerson(body.personB);
  const aiResult = await aiDate(personA, personB);
  const result = aiResult || fallbackDate(personA, personB, getApiKey() ? 'fallback:provider-error' : 'fallback:missing-key');
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(result));
}

module.exports = handler;
