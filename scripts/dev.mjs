// Local dev server: static files + /api/state with in-memory storage.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import * as stateApi from '../api/state.js';
import * as recipeApi from '../api/recipe.js';
import * as placesApi from '../api/places.js';
import * as wishApi from '../api/wish.js';
import * as authApi from '../api/auth.js';
import * as pushApi from '../api/push.js';
import * as cronApi from '../api/cron.js';
const apis = { '/api/state': stateApi, '/api/recipe': recipeApi, '/api/places': placesApi, '/api/auth': authApi, '/api/wish': wishApi, '/api/push': pushApi, '/api/cron': cronApi };

const root = new URL('..', import.meta.url).pathname;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (apis[url.pathname]) {
    const handler = apis[url.pathname];
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const request = new Request(url, { method: req.method, headers: req.headers, body: req.method === 'POST' ? Buffer.concat(chunks) : undefined });
    const r = await handler[req.method](request);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    return res.end(await r.text());
  }
  const p = normalize(join(root, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
  try {
    const data = await readFile(p);
    res.writeHead(200, { 'Content-Type': types[extname(p)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end('not found'); }
}).listen(process.env.PORT || 3000, () => console.log('http://localhost:' + (process.env.PORT || 3000)));
