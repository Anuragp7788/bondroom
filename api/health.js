function getApiKey() {
  const key = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '';
  return Boolean(key && !/your_(?:openrouter_)?key_here/i.test(key));
}

module.exports = (req, res) => {
  const configured = getApiKey();
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({
    ok: true,
    service: 'bondroom-api',
    provider: 'openrouter',
    configured,
    mode: configured ? 'ai-enabled' : 'metadata-fallback',
    next: configured ? 'ready' : 'add OPENROUTER_API_KEY to .env and restart npm run dev'
  }));
};
