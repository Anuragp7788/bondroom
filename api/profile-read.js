const SOURCE_TIMEOUT_MS = 3500;

function getApiKey() {
  const key = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '';
  if (!key || /your_(?:openrouter_)?key_here/i.test(key)) return '';
  return key;
}

const LINKEDIN_HOSTS = new Set(['linkedin.com', 'www.linkedin.com', 'uk.linkedin.com', 'ae.linkedin.com']);
const INSTAGRAM_HOSTS = new Set(['instagram.com', 'www.instagram.com']);

function validUrl(value, hosts) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && hosts.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

function handleFromUrl(value) {
  const url = new URL(value);
  return url.pathname.split('/').filter(Boolean).pop() || 'profile';
}

function titleCase(value) {
  return value
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function decodeHtml(value = '') {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function metaValue(html, pattern) {
  const match = html.match(pattern);
  return match ? decodeHtml(match[1].trim()) : '';
}

function extractMeta(html) {
  return {
    title: metaValue(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
      metaValue(html, /<title[^>]*>([^<]+)<\/title>/i),
    description: metaValue(html, /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["'][^>]*>/i),
    image: metaValue(html, /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i)
  };
}

async function fetchPublicMetadata(url, source) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SOURCE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'bondroom-profile-reader/1.0 (+https://bondroom.app)',
        'Accept': 'text/html,application/xhtml+xml'
      }
    });
    const contentType = response.headers.get('content-type') || '';
    const html = contentType.includes('html') ? (await response.text()).slice(0, 500000) : '';
    const meta = extractMeta(html);
    return {
      source,
      url,
      ok: response.ok,
      status: response.status,
      title: meta.title || `${source} public profile`,
      description: meta.description,
      image: meta.image,
      fetched: true
    };
  } catch (error) {
    return {
      source,
      url,
      ok: false,
      status: 0,
      title: `${source} public profile`,
      description: '',
      image: '',
      fetched: false,
      error: error.name === 'AbortError' ? 'timeout' : 'unavailable'
    };
  } finally {
    clearTimeout(timer);
  }
}

function collectSignals(linkedinHandle, instagramHandle, sources) {
  const text = [linkedinHandle, instagramHandle, ...sources.map((source) => `${source.title} ${source.description}`)].join(' ').toLowerCase();
  const vocabulary = [
    ['design', ['design', 'creative', 'product', 'brand', 'visual']],
    ['technology', ['tech', 'software', 'ai', 'engineering', 'developer', 'digital']],
    ['writing', ['author', 'writer', 'book', 'writing', 'newsletter']],
    ['travel', ['travel', 'adventure', 'airbnb', 'city']],
    ['wellness', ['wellness', 'health', 'fitness', 'mind', 'sleep']],
    ['community', ['community', 'people', 'team', 'culture']],
    ['startups', ['startup', 'founder', 'entrepreneur', 'venture']],
    ['storytelling', ['story', 'film', 'media', 'podcast', 'video']],
    ['fashion', ['fashion', 'beauty', 'style', 'retail']],
    ['research', ['research', 'psychology', 'science', 'data', 'analytics']]
  ];
  const tags = vocabulary.filter(([, words]) => words.some((word) => text.includes(word))).map(([tag]) => tag);
  return tags.length ? tags.slice(0, 4) : ['curiosity', 'craft', 'community'];
}

function buildFallbackProfile(linkedin, instagram, sources) {
  const linkedinHandle = handleFromUrl(linkedin);
  const instagramHandle = handleFromUrl(instagram);
  const guessedName = titleCase(linkedinHandle) || titleCase(instagramHandle);
  const tags = collectSignals(linkedinHandle, instagramHandle, sources);
  const category = tags.includes('startups') || tags.includes('technology') ? 'founder' : tags.includes('wellness') || tags.includes('research') ? 'mind' : 'creative';
  const role = sources.find((source) => source.source === 'LinkedIn')?.title || 'new room member';
  const needs = category === 'founder'
    ? ['builder energy', 'optimism with evidence']
    : category === 'mind'
      ? ['curiosity', 'emotional range']
      : ['creative friction', 'room to surprise'];
  const read = sources.some((source) => source.fetched)
    ? `${guessedName}'s public signals point toward ${tags.slice(0, 2).join(' and ')}. The agent is curious about what becomes more specific when this person is not performing for the internet.`
    : `The first read is intentionally light: ${guessedName} arrives with curiosity, craft, and two open doors. The source pages were not available to the server, so the agent is holding its confidence lightly.`;
  return {
    id: `custom-${Date.now()}`,
    name: guessedName,
    role,
    linkedin,
    instagram,
    tags,
    needs,
    voice: read,
    category,
    color: category === 'founder' ? '#c3dccb' : category === 'mind' ? '#d4dfb9' : '#d5e2a4',
    sourceSignals: sources.map(({ source, title, description, fetched, status }) => ({ source, title, description, fetched, status })),
    analysisMode: 'server metadata + local signal model'
  };
}

async function requestModel(profile, sources) {
  const apiKey = getApiKey();
  if (!apiKey) return null;
  const baseUrl = (process.env.OPENROUTER_BASE_URL || process.env.OPENAI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const model = process.env.OPENROUTER_MODEL || process.env.OPENAI_MODEL || 'openrouter/free';
  const prompt = {
    profile,
    sources: sources.map(({ source, title, description }) => ({ source, title, description })),
    output: 'Return JSON with role, tags (3-5 strings), needs (2 strings), voice (one sentence), category (creative|founder|mind). Do not invent facts beyond the supplied metadata.'
  };
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': process.env.SITE_URL || 'http://localhost:4173',
      'X-Title': process.env.SITE_NAME || 'bondroom'
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 3500,
      messages: [
        { role: 'system', content: 'You are the bondroom profile reader. Be precise, cautious, and transparent about limited public metadata. Return only valid JSON, with no markdown fences.' },
        { role: 'user', content: JSON.stringify(prompt) }
      ]
    })
  });
  if (!response.ok) return null;
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function readProfile({ linkedin, instagram }) {
  if (!validUrl(linkedin, LINKEDIN_HOSTS) || !validUrl(instagram, INSTAGRAM_HOSTS)) {
    const error = new Error('Use one public HTTPS LinkedIn URL and one public HTTPS Instagram URL.');
    error.statusCode = 400;
    throw error;
  }
  const sources = await Promise.all([
    fetchPublicMetadata(linkedin, 'LinkedIn'),
    fetchPublicMetadata(instagram, 'Instagram')
  ]);
  const profile = buildFallbackProfile(linkedin, instagram, sources);
  const modelRead = await requestModel(profile, sources).catch(() => null);
  if (modelRead) {
    return {
      ...profile,
      ...modelRead,
      tags: Array.isArray(modelRead.tags) ? modelRead.tags.slice(0, 5) : profile.tags,
      needs: Array.isArray(modelRead.needs) ? modelRead.needs.slice(0, 3) : profile.needs,
      analysisMode: `AI model: ${process.env.OPENROUTER_MODEL || process.env.OPENAI_MODEL || 'configured provider'}`
    };
  }
  return profile;
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    return res.end(JSON.stringify({ error: 'POST only' }));
  }
  try {
    const body = req.body || {};
    const person = await readProfile({ linkedin: String(body.linkedin || '').trim(), instagram: String(body.instagram || '').trim() });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ person }));
  } catch (error) {
    res.statusCode = error.statusCode || 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ error: error.message || 'Unable to read the sources.' }));
  }
}

handler.readProfile = readProfile;
module.exports = handler;
