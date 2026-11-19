// One storage layer for every API route. Not a route (files starting with "_" are helpers).
//
// Backends, picked by environment:
//   • Supabase Postgres (DB_BACKEND=supabase + SUPABASE_URL, SUPABASE_KEY, SB_SECRET) — the main one.
//     All access goes through SECURITY DEFINER functions that check SB_SECRET; the table itself is closed.
//     Rooms use compare-and-set (version numbers), so two simultaneous edits can never overwrite each other,
//     and every room change pings both phones over Supabase Realtime (see the "room_live_updates" migration).
//   • Upstash Redis (KV_REST_API_URL/TOKEN) — the old store, kept as a fallback.
//   • In-memory (DEV_MEMORY=1) — local development.

const SB_URL = process.env.SUPABASE_URL, SB_KEY = process.env.SUPABASE_KEY, SB_SECRET = process.env.SB_SECRET;
const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const backend = process.env.DB_BACKEND === 'supabase' && SB_URL && SB_KEY && SB_SECRET ? 'supabase'
  : REDIS_URL && REDIS_TOKEN ? 'redis'
  : process.env.DEV_MEMORY === '1' ? 'memory' : null;
export const useMemory = backend === 'memory';
export const configured = () => !!backend;
export const roomKey = (code) => 'room:' + code;

/* ---------- Supabase (PostgREST RPC) ---------- */
async function rpc(fn, args) {
  for (let attempt = 0; ; attempt++) {
    try {
      const r = await fetch(`${SB_URL}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_secret: SB_SECRET, ...args }),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) throw new Error(`Supabase ${fn} ${r.status} ${(await r.text()).slice(0, 200)}`);
      const t = await r.text();
      return t ? JSON.parse(t) : null;
    } catch (e) {
      if (attempt >= 2 || /\b4\d\d\b/.test(e.message)) throw e;
      await sleep(150 * (attempt + 1));
    }
  }
}

/* ---------- Redis (Upstash REST) ---------- */
async function redis(cmd) {
  const r = await fetch(REDIS_URL, { method: 'POST', headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error('Redis ' + r.status);
  return (await r.json()).result;
}
export const redisRaw = REDIS_URL && REDIS_TOKEN ? redis : null; // used only by the one-off migration

/* ---------- memory ---------- */
const memory = globalThis.__hamelykyMemory || (globalThis.__hamelykyMemory = new Map()); // key → { v, exp, ver }
const memGet = (k) => { const e = memory.get(k); if (!e) return null; if (e.exp && e.exp < Date.now()) { memory.delete(k); return null; } return e; };
const memSet = (k, v, ttl) => { const prev = memory.get(k); memory.set(k, { v: structuredClone(v), exp: ttl ? Date.now() + ttl * 1000 : 0, ver: (prev?.ver || 0) + 1 }); };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const kv = {
  async get(key) {
    if (backend === 'supabase') return rpc('kv_get', { p_key: key });
    if (backend === 'memory') { const e = memGet(key); return e ? structuredClone(e.v) : null; }
    const raw = await redis(['GET', key]); return raw == null ? null : JSON.parse(raw);
  },
  async set(key, val, ttl = null) {
    if (backend === 'supabase') return void (await rpc('kv_set', { p_key: key, p_value: val, p_ttl: ttl }));
    if (backend === 'memory') return memSet(key, val, ttl);
    await redis(ttl ? ['SET', key, JSON.stringify(val), 'EX', ttl] : ['SET', key, JSON.stringify(val)]);
  },
  async setNX(key, val, ttl = null) {
    if (backend === 'supabase') return !!(await rpc('kv_setnx', { p_key: key, p_value: val, p_ttl: ttl }));
    if (backend === 'memory') { if (memGet(key)) return false; memSet(key, val, ttl); return true; }
    return (await redis(ttl ? ['SET', key, JSON.stringify(val), 'NX', 'EX', ttl] : ['SET', key, JSON.stringify(val), 'NX'])) === 'OK';
  },
  /** true once per key while it lives (e.g. "this reminder was already sent") */
  claim(key, ttl) { return kv.setNX(key, 1, ttl); },
  async del(key) {
    if (backend === 'supabase') return void (await rpc('kv_del', { p_key: key }));
    if (backend === 'memory') return void memory.delete(key);
    await redis(['DEL', key]);
  },
  async incr(key, ttl = null) {
    if (backend === 'supabase') return Number(await rpc('kv_incr', { p_key: key, p_ttl: ttl }));
    if (backend === 'memory') { const e = memGet(key), n = (e?.v || 0) + 1; memory.set(key, { v: n, exp: e ? e.exp : ttl ? Date.now() + ttl * 1000 : 0, ver: (e?.ver || 0) + 1 }); return n; }
    const n = await redis(['INCR', key]); if (n === 1 && ttl) await redis(['EXPIRE', key, ttl]); return n;
  },
  async sadd(key, member) {
    if (backend === 'supabase') return void (await rpc('kv_sadd', { p_key: key, p_member: String(member) }));
    if (backend === 'memory') { const s = new Set(memGet(key)?.v || []); s.add(String(member)); return memSet(key, [...s]); }
    await redis(['SADD', key, member]);
  },
  async srem(key, member) {
    if (backend === 'supabase') return void (await rpc('kv_srem', { p_key: key, p_member: String(member) }));
    if (backend === 'memory') return memSet(key, (memGet(key)?.v || []).filter((x) => x !== String(member)));
    await redis(['SREM', key, member]);
  },
  async smembers(key) {
    if (backend === 'supabase') return (await rpc('kv_get', { p_key: key })) || [];
    if (backend === 'memory') return memGet(key)?.v || [];
    return (await redis(['SMEMBERS', key])) || [];
  },
};

/* ---------- rooms ---------- */
export const loadRoom = (code) => kv.get(roomKey(code));
/** Create a brand-new room; false if the code is taken. */
export async function createRoom(state) {
  if (backend === 'supabase') return (await rpc('kv_cas', { p_key: roomKey(state.code), p_value: state, p_ver: 0 })) != null;
  return kv.setNX(roomKey(state.code), state);
}

/**
 * Change a room safely. fn(state) → { next, out }: `next` (or null) is saved, `out` is returned.
 * Supabase: optimistic compare-and-set, re-running fn on the fresh state if someone else saved first.
 * Redis: a short lock. Throws Error('busy') if it can't get through.
 */
export async function updateRoom(code, fn) {
  const key = roomKey(code);
  if (backend === 'supabase') {
    for (let i = 0; i < 8; i++) {
      const cur = await rpc('kv_getv', { p_key: key });
      const res = await fn(cur ? cur.value : null);
      if (!res?.next) return res?.out;
      if ((await rpc('kv_cas', { p_key: key, p_value: res.next, p_ver: cur ? cur.ver : 0 })) != null) { await ping(res.next); return res.out; }
      await sleep(40 + Math.random() * 120); // someone saved in between — try again on their version
    }
    throw new Error('busy');
  }
  if (backend === 'memory') {
    const res = await fn(await kv.get(key));
    if (res?.next) await kv.set(key, res.next);
    return res?.out;
  }
  const lock = 'lock:' + code, token = Math.random().toString(36).slice(2);
  for (let i = 0; i < 25; i++) {
    if ((await redis(['SET', lock, token, 'NX', 'PX', '4000'])) === 'OK') {
      try {
        const res = await fn(await kv.get(key));
        if (res?.next) await kv.set(key, res.next);
        return res?.out;
      } finally { if ((await redis(['GET', lock])) === token) await redis(['DEL', lock]); }
    }
    await sleep(120);
  }
  throw new Error('busy');
}

/** Tell both phones "something changed" (Supabase Realtime broadcast over REST; carries only rev). */
async function ping(room) {
  if (!room?.rt) return;
  try {
    await fetch(`${SB_URL}/realtime/v1/api/broadcast`, {
      method: 'POST', headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: 'room-' + room.rt, event: 'changed', payload: { rev: room.rev }, private: false }] }),
      signal: AbortSignal.timeout(1500),
    });
  } catch { /* the 4-second poll still catches it */ }
}

/** Bulk import (used once to move data from Redis to Supabase). rows: [{ key, value, ttl? }] */
export const importRows = (rows) => rpc('kv_import', { p_rows: rows });
export const supabaseReady = () => !!(SB_URL && SB_KEY && SB_SECRET);
