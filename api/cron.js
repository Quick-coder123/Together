// Daily "don't forget" reminders (Vercel Cron, once a day in the morning).
import { kv, roomKey, sendTo, digestFor } from './_notify.js';
import { ensureSchedule } from './_qstash.js';
import { runTick } from './tick.js';
import { gc, backupToRedis } from './_db.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const kyivToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Kyiv' }).format(new Date());

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization') || '';
  const isCron = (request.headers.get('user-agent') || '').startsWith('vercel-cron');
  if (secret ? auth !== `Bearer ${secret}` : !isCron) return json({ error: 'forbidden' }, 403);
  const today = kyivToday();
  const codes = await kv.smembers('push:rooms');
  let sent = 0;
  for (const code of codes) {
    try {
      const room = await kv.get(roomKey(code));
      if (!room) continue;
      for (const mid of Object.keys(room.members)) {
        const msg = digestFor(room, mid, today);
        if (msg) sent += await sendTo(code, mid, msg);
      }
    } catch (e) { console.error('cron room', code, e.message); }
  }
  const sched = await ensureSchedule().catch((e) => ({ ok: false, error: e.message }));
  await gc().catch((e) => console.error('gc', e.message));
  const backup = await backupToRedis(today).catch((e) => ({ error: e.message }));
  console.log('backup', backup);
  const tick = await runTick().catch(() => null); // fallback when QStash is not connected
  return json({ ok: true, today, rooms: codes.length, sent, sched, tick, backup });
}
