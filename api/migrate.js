// ONE-OFF: copies everything from the old Redis store into Supabase, then verifies it.
// Protected by a token derived from SB_SECRET. Removed after the move.
import { createHash } from 'node:crypto';
import { redisRaw, importRows, supabaseReady } from './_db.js';

const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const SKIP = /^(lock:|fail:)/; // short-lived, safe to drop

async function scanAll() {
  const keys = []; let cur = '0';
  do { const [next, batch] = await redisRaw(['SCAN', cur, 'COUNT', 500]); cur = String(next); keys.push(...batch); } while (cur !== '0');
  return keys;
}
async function readKey(k) {
  const type = await redisRaw(['TYPE', k]);
  let value;
  if (type === 'string') { const raw = await redisRaw(['GET', k]); try { value = JSON.parse(raw); } catch { value = raw; } }
  else if (type === 'set') value = await redisRaw(['SMEMBERS', k]);
  else return { k, skip: type };
  const pttl = await redisRaw(['PTTL', k]);
  return { key: k, value, ttl: pttl > 0 ? Math.max(1, Math.ceil(pttl / 1000)) : null };
}

export async function GET(request) {
  const t = new URL(request.url).searchParams.get('t');
  const want = createHash('sha256').update(String(process.env.SB_SECRET) + ':migrate').digest('hex').slice(0, 32);
  if (!supabaseReady() || !redisRaw || t !== want) return json({ error: 'no' }, 404);
  const keys = (await scanAll()).filter((k) => !SKIP.test(k));
  const rows = [], skipped = [];
  for (const k of keys) { const r = await readKey(k); if (r.skip) skipped.push(`${k}:${r.skip}`); else rows.push(r); }
  let n = 0;
  for (let i = 0; i < rows.length; i += 50) n += await importRows(rows.slice(i, i + 50));
  const byPrefix = {};
  for (const r of rows) { const p = r.key.split(':')[0]; byPrefix[p] = (byPrefix[p] || 0) + 1; }
  const rooms = rows.filter((r) => r.key.startsWith('room:')).map((r) => ({ code: r.key.slice(5), rev: r.value?.rev, members: Object.keys(r.value?.members || {}).length, events: r.value?.events?.length, shopping: r.value?.shopping?.length, gifts: r.value?.gifts?.length, xp: r.value?.pet?.xp }));
  console.log('migrate', { total: rows.length, imported: n, byPrefix, skipped });
  return json({ total: rows.length, imported: n, byPrefix, skipped, rooms });
}
