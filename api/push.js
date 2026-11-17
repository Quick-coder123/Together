// Push subscriptions: GET → public key; POST subscribe / unsubscribe / test.
import { getVapid, addSub, removeSub, sendTo, hasSubs, kv, roomKey } from './_notify.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const cleanCode = (c) => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);

export async function GET() {
  try { return json({ publicKey: (await getVapid()).publicKey }); }
  catch (e) { console.error(e); return json({ error: 'not_configured' }, 503); }
}

export async function POST(request) {
  let b;
  try { b = await request.json(); } catch { return json({ error: 'Невірний запит' }, 400); }
  const code = cleanCode(b.code);
  const mid = String(b.member || '').slice(0, 40);
  const room = await kv.get(roomKey(code));
  if (!room || !room.members?.[mid]) return json({ error: 'Пару не знайдено' }, 403);
  try {
    if (b.op === 'subscribe') {
      const sub = b.sub;
      if (!sub || typeof sub.endpoint !== 'string' || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) return json({ error: 'Невірна підписка' }, 400);
      await addSub(code, mid, sub);
      return json({ ok: true });
    }
    if (b.op === 'unsubscribe') { await removeSub(code, mid, String(b.endpoint || '')); return json({ ok: true }); }
    if (b.op === 'status') return json({ devices: await hasSubs(code, mid) });
    if (b.op === 'test') {
      const n = await sendTo(code, mid, { body: 'Сповіщення працюють! Хамі на звʼязку 🦎💚', tag: 'test', urgent: true });
      return json({ ok: n > 0, sent: n });
    }
    return json({ error: 'Невідома дія' }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: 'Помилка сервера' }, 500);
  }
}
