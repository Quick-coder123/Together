// QStash (Upstash): calls /api/tick every 10 minutes so reminders arrive on time.
// The schedule is created automatically once QSTASH_TOKEN is present (Vercel → Upstash QStash integration).
import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { kv } from './_notify.js';

const TOKEN = process.env.QSTASH_TOKEN;
const BASE = (process.env.QSTASH_URL || 'https://qstash.upstash.io').replace(/\/$/, '');
const SITE = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : 'https://hameleonchyky.vercel.app');
export const TICK_CRON = '*/10 * * * *';
const SCHED_KEY = 'qstash:schedule:v1';

let ensured = false;
export async function ensureSchedule() {
  if (ensured || !TOKEN) return { ok: !!TOKEN, skipped: true };
  const have = await kv.get(SCHED_KEY);
  if (have?.url === SITE + '/api/tick' && have.cron === TICK_CRON) { ensured = true; return { ok: true, id: have.id }; }
  const res = await fetch(`${BASE}/v2/schedules/${SITE}/api/tick`, {
    method: 'POST',
    signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Bearer ${TOKEN}`, 'Upstash-Cron': TICK_CRON, 'Upstash-Method': 'POST', 'Upstash-Retries': '1', 'Content-Type': 'application/json' },
    body: '{}',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { console.error('qstash schedule', res.status, JSON.stringify(data).slice(0, 200)); return { ok: false, status: res.status }; }
  await kv.set(SCHED_KEY, { id: data.scheduleId, url: SITE + '/api/tick', cron: TICK_CRON, at: Date.now() });
  ensured = true;
  console.log('qstash schedule created', data.scheduleId);
  return { ok: true, id: data.scheduleId, created: true };
}

const b64u = (buf) => Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
// Verifies the Upstash-Signature JWT (HS256) against the current or next signing key.
export function verifySignature(jwt, body) {
  const keys = [process.env.QSTASH_CURRENT_SIGNING_KEY, process.env.QSTASH_NEXT_SIGNING_KEY].filter(Boolean);
  if (!keys.length || !jwt) return false;
  const [h, p, sig] = String(jwt).split('.');
  if (!h || !p || !sig) return false;
  let claims;
  try { claims = JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()); } catch { return false; }
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== 'Upstash' || (claims.exp && now > claims.exp + 60) || (claims.nbf && now < claims.nbf - 60)) return false;
  if (claims.body && claims.body.replace(/=+$/, '') !== b64u(createHash('sha256').update(body).digest())) return false;
  return keys.some((k) => {
    const want = Buffer.from(b64u(createHmac('sha256', k).update(`${h}.${p}`).digest()));
    const got = Buffer.from(sig);
    return want.length === got.length && timingSafeEqual(want, got);
  });
}
export const qstashOn = () => !!TOKEN;
