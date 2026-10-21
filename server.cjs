const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const profileRead = require('./api/profile-read');
const health = require('./api/health');
const dateChat = require('./api/date-chat');

const root = __dirname;
const localEnv = path.join(root, '.env');
if (fs.existsSync(localEnv)) {
  for (const line of fs.readFileSync(localEnv, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}
const port = Number(process.env.PORT || 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function sendApi(res, statusCode, headers, payload) {
  res.statusCode = statusCode;
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.end(payload);
}

function makeApiResponse(res) {
  const headers = {};
  return {
    get statusCode() { return res.statusCode || 200; },
    set statusCode(value) { res.statusCode = value; },
    setHeader(name, value) { headers[name] = value; res.setHeader(name, value); },
    end(payload = '') { res.end(payload); }
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 100_000) {
        reject(new Error('Request body is too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new Error('Request body must be valid JSON.')); }
    });
    req.on('error', reject);
  });
}

async function handleApi(req, res, requested) {
  if (requested === '/api/health') return health(req, makeApiResponse(res));
  if (requested === '/api/date-chat') {
    let body;
    try { body = await readJsonBody(req); }
    catch (error) { return sendApi(res, 400, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify({ error: error.message })); }
    return dateChat({ method: req.method, headers: req.headers, body }, makeApiResponse(res));
  }
  if (requested !== '/api/profile-read') return sendApi(res, 404, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify({ error: 'API route not found' }));
  let body;
  try { body = await readJsonBody(req); }
  catch (error) { return sendApi(res, 400, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify({ error: error.message })); }
  return profileRead({ method: req.method, headers: req.headers, body }, makeApiResponse(res));
}

const server = http.createServer((req, res) => {
  const requested = decodeURIComponent((req.url || '/').split('?')[0]);
  if (requested.startsWith('/api/')) {
    handleApi(req, res, requested).catch((error) => sendApi(res, 500, { 'Content-Type': 'application/json; charset=utf-8' }, JSON.stringify({ error: error.message || 'Internal server error' })));
    return;
  }

  const relative = requested === '/' ? 'index.html' : requested.replace(/^\/+/, '');
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }

  fs.stat(file, (statError, stats) => {
    const target = !statError && stats.isFile() ? file : path.join(root, 'index.html');
    fs.readFile(target, (readError, data) => {
      if (readError) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        return res.end('Unable to read the requested file.');
      }
      res.writeHead(200, { 'Content-Type': types[path.extname(target).toLowerCase()] || 'application/octet-stream' });
      res.end(data);
    });
  });
});

server.listen(port, () => {
  console.log(`bondroom running at http://localhost:${port}`);
});
