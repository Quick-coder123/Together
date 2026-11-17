// Accounts: personal login + password, so a person can open their pair from any device.
// Passwords are stored only as scrypt hashes.
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { viewFor, isDate } from '../lib/core.js';

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const memory = globalThis.__ottershipMemory || (globalThis.__ottershipMemory = new Map());
const useMemory = !REDIS_URL && process.env.DEV_MEMORY === '1';
const MAX_FAILS = 10; // per login per 15 minutes

async function redis(cmd) {
  const r = await fetch(REDIS_URL, { method: 'POST', headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error('Redis ' + r.status);
  return (await r.json()).result;
}
const kv = {
  async get(key) { if (useMemory) return memory.has(key) ? structuredClone(memory.get(key)) : null; const raw = await redis(['GET', key]); return raw ? JSON.parse(raw) : null; },
  async set(key, val) { if (useMemory) return void memory.set(key, structuredClone(val)); await redis(['SET', key, JSON.stringify(val)]); },
  async setNX(key, val) { if (useMemory) { if (memory.has(key)) return false; memory.set(key, structuredClone(val)); return true; } return (await redis(['SET', key, JSON.stringify(val), 'NX'])) === 'OK'; },
  async del(key) { if (useMemory) return void memory.delete(key); await redis(['DEL', key]); },
  async incr(key, ttl) { if (useMemory) { const n = (memory.get(key) || 0) + 1; memory.set(key, n); return n; } const n = await redis(['INCR', key]); if (n === 1) await redis(['EXPIRE', key, ttl]); return n; },
};
// Rooms are stored by the state API under "room:<code>" (in dev memory: under "<code>").
const roomKey = (code) => (useMemory ? code : 'room:' + code);
const userKey = (login) => 'user:' + login;

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
const cleanLogin = (l) => String(l || '').trim().toLowerCase().replace(/\s+/g, '');
const validLogin = (l) => /^[\p{L}\p{N}_.\-@]{3,32}$/u.test(l);

function hash(password, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(String(password), salt, 32).toString('hex') };
}
function verify(password, rec) {
  const h = Buffer.from(scryptSync(String(password), rec.salt, 32).toString('hex'), 'hex');
  const r = Buffer.from(rec.hash, 'hex');
  return h.length === r.length && timingSafeEqual(h, r);
}

async function signedIn(rec, today) {
  const room = await kv.get(roomKey(rec.code));
  if (!room || !room.members[rec.member]) return json({ error: 'Пару цього акаунта не знайдено' }, 404);
  return json({ code: rec.code, member: { id: rec.member, name: room.members[rec.member].name }, login: rec.login, room: viewFor(room, rec.member, today) });
}

async function checkPassword(login, password) {
  const fails = useMemory ? memory.get('fail:' + login) || 0 : Number((await redis(['GET', 'fail:' + login])) || 0);
  if (fails >= MAX_FAILS) return { error: json({ error: 'Забагато спроб. Спробуй через 15 хвилин.' }, 429) };
  const rec = await kv.get(userKey(login));
  if (!rec || !verify(password, rec)) {
    await kv.incr('fail:' + login, 900);
    return { error: json({ error: 'Невірний логін або пароль' }, 401) };
  }
  return { rec };
}

export async function POST(request) {
  if (!useMemory && !(REDIS_URL && REDIS_TOKEN)) return json({ error: 'not_configured' }, 503);
  let b;
  try { b = await request.json(); } catch { return json({ error: 'Невірний запит' }, 400); }
  const today = isDate(b?.today) ? b.today : null;
  const op = b?.op;

  try {
    if (op === 'login') {
      const login = cleanLogin(b.login);
      if (!login || !b.password) return json({ error: 'Введи логін і пароль' }, 400);
      const { rec, error } = await checkPassword(login, b.password);
      if (error) return error;
      return signedIn(rec, today);
    }

    if (op === 'check') {
      const login = cleanLogin(b.login);
      if (!validLogin(login)) return json({ ok: false, error: 'Логін: 3–32 символи, літери, цифри, «_», «.», «-»' });
      return json({ ok: !(await kv.get(userKey(login))), error: 'Такий логін уже зайнятий' });
    }

    if (op === 'claim') { // pick "this is me" on a profile protected by a password
      const code = cleanCode(b.code);
      const room = await kv.get(roomKey(code));
      const entry = room ? Object.entries(room.members)[Number(b.slot)] : null;
      const m = entry?.[1];
      if (!m) return json({ error: 'Профіль не знайдено' }, 404);
      if (!m.login) return json({ error: 'no_login' }, 400);
      const { rec, error } = await checkPassword(m.login, b.password);
      if (error) return error;
      return signedIn(rec, today);
    }

    if (op === 'register') { // set or change the login/password of the current member
      const code = cleanCode(b.code);
      const mid = String(b.member || '').slice(0, 40);
      const login = cleanLogin(b.login);
      const password = String(b.password || '');
      if (!validLogin(login)) return json({ error: 'Логін: 3–32 символи, літери, цифри, «_», «.», «-»' }, 400);
      if (password.length < 4 || password.length > 100) return json({ error: 'Пароль має бути щонайменше з 4 символів' }, 400);
      const room = await kv.get(roomKey(code));
      if (!room || !room.members[mid]) return json({ error: 'Пару не знайдено' }, 404);
      const prev = room.members[mid].login;
      const rec = { login, code, member: mid, ...hash(password), createdAt: Date.now() };
      if (prev === login) await kv.set(userKey(login), rec);
      else {
        if (!(await kv.setNX(userKey(login), rec))) return json({ error: 'Такий логін уже зайнятий' }, 409);
        if (prev) await kv.del(userKey(prev));
      }
      // Re-read the room right before writing to keep concurrent changes.
      const fresh = await kv.get(roomKey(code));
      fresh.members[mid].login = login;
      fresh.rev = (fresh.rev || 0) + 1;
      await kv.set(roomKey(code), fresh);
      return json({ ok: true, login, room: viewFor(fresh, mid, today) });
    }

    return json({ error: 'Невідома дія' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: 'Помилка сервера' }, 500);
  }
}
