// Every ~10 minutes (QStash schedule): send Шептунчик's reminders that are due now.
import { kv, roomKey, sendTo } from './_notify.js';
import { remindersDue } from './_remind.js';
import { verifySignature } from './_qstash.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const WINDOW = 40 * 60e3; // look back 40 min, so a late or skipped tick still delivers (each reminder is sent once)

export async function runTick(now = Date.now()) {
  const codes = await kv.smembers('push:rooms');
  let sent = 0, due = 0;
  for (const code of codes) {
    try {
      const room = await kv.get(roomKey(code));
      if (!room) continue;
      for (const r of remindersDue(room, now - WINDOW, now)) {
        due++;
        if (!(await kv.claim(`sent:${code}:${r.key}`, 3 * 86400))) continue;
        for (const mid of r.to) sent += await sendTo(code, mid, r);
      }
    } catch (e) { console.error('tick room', code, e.message); }
  }
  return { rooms: codes.length, due, sent };
}

export async function POST(request) {
  const body = await request.text();
  const ok = verifySignature(request.headers.get('upstash-signature'), body)
    || (process.env.CRON_SECRET && request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`);
  if (!ok) { console.warn('tick forbidden', !!request.headers.get('upstash-signature')); return json({ error: 'forbidden' }, 403); }
  const r = await runTick();
  console.log('tick ok', JSON.stringify(r));
  return json({ ok: true, ...r });
}
export const GET = () => json({ error: 'forbidden' }, 403);
