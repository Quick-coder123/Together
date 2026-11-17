import { applyAction, newRoom, viewFor, ActionError, isDate } from '../lib/core.js';

// Storage: Upstash Redis over REST (Vercel → Storage → Upstash for Redis).
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const memory = globalThis.__ottershipMemory || (globalThis.__ottershipMemory = new Map());
const useMemory = !REDIS_URL && process.env.DEV_MEMORY === '1';
const configured = () => useMemory || (REDIS_URL && REDIS_TOKEN);

async function redis(cmd) {
  const r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error('Redis ' + r.status);
  return (await r.json()).result;
}

async function load(code) {
  if (useMemory) return memory.has(code) ? structuredClone(memory.get(code)) : null;
  const raw = await redis(['GET', 'room:' + code]);
  return raw ? JSON.parse(raw) : null;
}
async function save(state) {
  if (useMemory) return void memory.set(state.code, structuredClone(state));
  await redis(['SET', 'room:' + state.code, JSON.stringify(state)]);
}
async function createUnique(state) {
  if (useMemory) {
    if (memory.has(state.code)) return false;
    memory.set(state.code, structuredClone(state));
    return true;
  }
  return (await redis(['SET', 'room:' + state.code, JSON.stringify(state), 'NX'])) === 'OK';
}

// Short lock so two simultaneous edits don't overwrite each other.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function withLock(code, fn) {
  if (useMemory) return fn();
  const key = 'lock:' + code;
  const token = Math.random().toString(36).slice(2);
  for (let i = 0; i < 25; i++) {
    if ((await redis(['SET', key, token, 'NX', 'PX', '4000'])) === 'OK') {
      try { return await fn(); } finally {
        if ((await redis(['GET', key])) === token) await redis(['DEL', key]);
      }
    }
    await sleep(120);
  }
  throw new Error('busy');
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
const cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
const cleanId = (m) => String(m || '').slice(0, 40);

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export async function GET(request) {
  if (!configured()) return json({ error: 'not_configured' }, 503);
  const q = new URL(request.url).searchParams;
  const code = cleanCode(q.get('code'));
  const mid = cleanId(q.get('member'));
  const today = isDate(q.get('today')) ? q.get('today') : null;
  if (code.length !== 6) return json({ error: 'Невірний код' }, 400);
  const state = await load(code);
  if (!state) return json({ error: 'Пару не знайдено' }, 404);
  // Sign-in on another device / home-screen app: show who is in the pair, so the person can pick themselves.
  // Profiles protected by a login don't reveal their id: they are opened only with the password.
  if (q.get('peek')) return json({ code, members: Object.entries(state.members).map(([id, m], slot) => ({ slot, id: m.login ? null : id, name: m.name, avatar: m.avatar || null, login: !!m.login })) });
  if (!state.members[mid]) return json({ error: 'not_member' }, 403);
  if (q.get('rev') && Number(q.get('rev')) === state.rev && !q.get('force')) return json({ unchanged: true, rev: state.rev });
  return json(viewFor(state, mid, today));
}

export async function POST(request) {
  if (!configured()) return json({ error: 'not_configured' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Невірний запит' }, 400); }
  const { member, action } = body || {};
  const today = isDate(body?.today) ? body.today : null;

  try {
    if (body.create) {
      for (let i = 0; i < 8; i++) {
        let state = newRoom(makeCode());
        state = applyAction(state, member, { type: 'join', name: action?.name }, today);
        if (await createUnique(state)) return json(viewFor(state, member.id, today));
      }
      return json({ error: 'Спробуй ще раз' }, 500);
    }
    const code = cleanCode(body.code);
    const result = await withLock(code, async () => {
      const state = await load(code);
      if (!state) return json({ error: 'Пару не знайдено' }, 404);
      const next = applyAction(state, member, action || {}, today);
      if (next.rev !== state.rev || action?.type === 'ping') await save(next);
      return json(viewFor(next, member.id, today));
    });
    return result;
  } catch (e) {
    if (e instanceof ActionError) return json({ error: e.message }, 400);
    if (e.message === 'busy') return json({ error: 'Сервер зайнятий, спробуй ще раз' }, 503);
    console.error(e);
    return json({ error: 'Помилка сервера' }, 500);
  }
}
