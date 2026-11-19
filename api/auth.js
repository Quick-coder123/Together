// Accounts: personal login + password, so a person can open their pair from any device.
// Passwords are stored only as scrypt hashes.
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
import { viewFor, isDate } from '../lib/core.js';

import { kv, roomKey, configured, updateRoom } from './_db.js';
const MAX_FAILS = 10; // per login per 15 minutes

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
  const fails = Number((await kv.get('fail:' + login)) || 0);
  if (fails >= MAX_FAILS) return { error: json({ error: 'Забагато спроб. Спробуй через 15 хвилин.' }, 429) };
  const rec = await kv.get(userKey(login));
  if (!rec || !verify(password, rec)) {
    await kv.incr('fail:' + login, 900);
    return { error: json({ error: 'Невірний логін або пароль' }, 401) };
  }
  return { rec };
}

export async function POST(request) {
  if (!configured()) return json({ error: 'not_configured' }, 503);
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
      const fresh = await updateRoom(code, (st) => {
        if (!st?.members[mid]) return { out: null };
        const next = { ...st, members: { ...st.members, [mid]: { ...st.members[mid], login } }, rev: (st.rev || 0) + 1 };
        return { next, out: next };
      });
      if (!fresh) return json({ error: 'Пару не знайдено' }, 404);
      return json({ ok: true, login, room: viewFor(fresh, mid, today) });
    }

    return json({ error: 'Невідома дія' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: 'Помилка сервера' }, 500);
  }
}
