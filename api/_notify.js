// Push notifications (Web Push). Not a route: files starting with "_" are helpers.
// VAPID keys are created once and kept in Redis, so nothing has to be configured by hand.
import * as webpush from 'web-push';
import { addDays, dayDiff, streakOf } from '../lib/core.js';

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const memory = globalThis.__ottershipMemory || (globalThis.__ottershipMemory = new Map());
export const useMemory = !REDIS_URL && process.env.DEV_MEMORY === '1';

async function redis(cmd) {
  const r = await fetch(REDIS_URL, { method: 'POST', headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error('Redis ' + r.status);
  return (await r.json()).result;
}
export const kv = {
  async get(key) { if (useMemory) return memory.has(key) ? structuredClone(memory.get(key)) : null; const raw = await redis(['GET', key]); return raw ? JSON.parse(raw) : null; },
  async set(key, val) { if (useMemory) return void memory.set(key, structuredClone(val)); await redis(['SET', key, JSON.stringify(val)]); },
  async setNX(key, val) { if (useMemory) { if (memory.has(key)) return false; memory.set(key, structuredClone(val)); return true; } return (await redis(['SET', key, JSON.stringify(val), 'NX'])) === 'OK'; },
  async claim(key, ttl) { if (useMemory) { if (memory.has(key)) return false; memory.set(key, 1); return true; } return (await redis(['SET', key, '1', 'NX', 'EX', ttl])) === 'OK'; },
  async incr(key, ttl) { if (useMemory) { const n = (memory.get(key) || 0) + 1; memory.set(key, n); return n; } const n = await redis(['INCR', key]); if (n === 1) await redis(['EXPIRE', key, ttl]); return n; },
  async sadd(key, v) { if (useMemory) { const s = new Set(memory.get(key) || []); s.add(v); memory.set(key, [...s]); return; } await redis(['SADD', key, v]); },
  async srem(key, v) { if (useMemory) { memory.set(key, (memory.get(key) || []).filter((x) => x !== v)); return; } await redis(['SREM', key, v]); },
  async smembers(key) { if (useMemory) return memory.get(key) || []; return (await redis(['SMEMBERS', key])) || []; },
};
export const roomKey = (code) => (useMemory ? code : 'room:' + code);
const subsKey = (code) => 'subs:' + code;

let vapid;
export async function getVapid() {
  if (vapid) return vapid;
  let keys = await kv.get('vapid');
  if (!keys) {
    const k = webpush.generateVAPIDKeys();
    await kv.setNX('vapid', k);
    keys = await kv.get('vapid');
  }
  vapid = keys;
  return vapid;
}

/* ---------------- subscriptions: { [memberId]: [subscription, …] } ---------------- */
export async function addSub(code, mid, sub) {
  const all = (await kv.get(subsKey(code))) || {};
  const list = (all[mid] || []).filter((s) => s.endpoint !== sub.endpoint);
  all[mid] = [...list, { endpoint: sub.endpoint, keys: sub.keys, ts: Date.now() }].slice(-5);
  await kv.set(subsKey(code), all);
  await kv.sadd('push:rooms', code);
}
export async function removeSub(code, mid, endpoint) {
  const all = (await kv.get(subsKey(code))) || {};
  all[mid] = (all[mid] || []).filter((s) => s.endpoint !== endpoint);
  await kv.set(subsKey(code), all);
}
export async function hasSubs(code, mid) {
  const all = (await kv.get(subsKey(code))) || {};
  return (all[mid] || []).length;
}

// Send one notification to every device of a member. Dead subscriptions are removed.
export async function sendTo(code, mid, msg) {
  const all = (await kv.get(subsKey(code))) || {};
  const list = all[mid] || [];
  if (!list.length) return 0;
  const { publicKey, privateKey } = await getVapid();
  const payload = JSON.stringify({ title: msg.title || 'Хамелеончики', body: msg.body, tag: msg.tag || undefined, url: msg.url || '/' });
  let sent = 0;
  const dead = [];
  await Promise.all(list.map(async (sub) => {
    if (useMemory) { (globalThis.__pushLog ||= []).push({ code, mid, ...msg }); sent++; return; }
    try {
      await webpush.sendNotification(sub, payload, { TTL: 60 * 60 * 24, urgency: msg.urgent ? 'high' : 'normal', vapidDetails: { subject: 'https://hameleonchyky.vercel.app', publicKey, privateKey }, timeout: 8000 });
      sent++;
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) dead.push(sub.endpoint);
      else console.error('push failed', e.statusCode || '', e.message);
    }
  }));
  if (dead.length) { all[mid] = list.filter((s) => !dead.includes(s.endpoint)); await kv.set(subsKey(code), all); }
  return sent;
}

/* ---------------- what is worth telling the partner ---------------- */
const fmtDay = (d) => { if (!d) return ''; const x = new Date(d + 'T12:00:00Z'); return `${x.getUTCDate()}.${String(x.getUTCMonth() + 1).padStart(2, '0')}`; };
const money = (n) => Math.round(n).toLocaleString('uk-UA').replace(/,/g, ' ') + '₴';

export function messagesFor(action, before, after, mid) {
  const me = after.members[mid]?.name || 'Твоя половинка';
  const pid = Object.keys(after.members).find((x) => x !== mid);
  if (!pid) return [];
  const a = action || {};
  const out = (body, extra = {}) => [{ to: pid, body, ...extra }];
  switch (a.type) {
    case 'join': return before.members[mid] ? [] : out(`${me} приєднується до вашого куточка! 💚`);
    case 'note': {
      const n = after.notes[0];
      if (!n || n.from !== mid) return [];
      return n.openAt ? out(`💌 ${me} залишає тобі запечатану записку. Відкриється пізніше 🔒`, { tag: 'note' }) : out(`💌 ${me} пише тобі: «${n.text.slice(0, 80)}${n.text.length > 80 ? '…' : ''}»`, { tag: 'note', urgent: true });
    }
    case 'mood': {
      const prev = before.moods?.[mid], cur = after.moods?.[mid];
      if (!cur || (prev && prev.value === cur.value && prev.date === cur.date)) return [];
      const changed = prev && prev.date === cur.date;
      const txt = {
        great: [`💚 ${me} почувається чудово!`, `💚 ${me} змінює настрій: тепер чудово!`],
        ok: [`💛 ${me} почувається нормально.`, `💛 ${me} змінює настрій: тепер «норм».`],
        sad: [`💙 ${me} сумує. Може, обійми або тепле слово?`, `💙 ${me} змінює настрій: тепер сумно. Підтримай 🫂`],
      }[cur.value];
      return txt ? out(txt[changed ? 1 : 0], { title: 'Настрій партнера', tag: 'mood', urgent: cur.value === 'sad' }) : [];
    }
    case 'add': {
      const it = after[a.col]?.[0];
      if (!it || it.by !== mid) return [];
      if (a.col === 'blind') return out(`🎭 ${me} планує для тебе побачення наосліп${it.date ? ' на ' + fmtDay(it.date) : ''}!${it.hint ? ' Підказка: ' + it.hint : ''}`, { tag: 'blind' });
      if (a.col === 'chores' && it.who === pid) return out(`🧹 ${me} просить: «${it.text}»`, { tag: 'chore' });
      if (a.col === 'events') return out(`📅 ${me} додає в календар: ${it.title}${it.date ? ' — ' + fmtDay(it.date) + (it.time ? ' о ' + it.time : '') : ''}`, { tag: 'event' });
      if (a.col === 'dates') return out(`🎉 Нова важлива дата: ${it.title} (${fmtDay(it.date)})`, { tag: 'date' });
      if (a.col === 'places' && it.mode === 'plan') return out(`📍 ${me} планує: ${it.name}${it.date ? ' — ' + fmtDay(it.date) : ''}`, { tag: 'place' });
      if (a.col === 'trips') return out(`🧳 ${me} планує подорож: ${it.name}`, { tag: 'trip' });
      if (a.col === 'goals') return out(`🐷 Нова спільна ціль: ${it.title} — ${money(it.target)}`, { tag: 'goal' });
      return [];
    }
    case 'update': {
      if (a.col === 'chores' && a.patch?.who === pid) {
        const it = after.chores.find((x) => x.id === a.id);
        const was = before.chores.find((x) => x.id === a.id);
        if (it && was?.who !== pid) return out(`🧹 ${me} доручає тобі: «${it.text}»`, { tag: 'chore' });
      }
      if (a.col === 'shopping' && a.patch?.done) {
        const it = after.shopping.find((x) => x.id === a.id);
        const openNow = after.shopping.filter((x) => x.cat === it?.cat && !x.done).length;
        const openWas = before.shopping.filter((x) => x.cat === it?.cat && !x.done).length;
        if (it && openWas > 0 && openNow === 0) return out(`✅ ${me} купує все зі списку ${it.cat === 'other' ? 'покупок' : 'продуктів'}. Можна не йти в магазин!`, { title: 'Все куплено', tag: 'shop-' + it.cat });
      }
      if (a.col === 'places' && a.patch?.mode === 'spont') {
        const was = before.places.find((x) => x.id === a.id), it = after.places.find((x) => x.id === a.id);
        if (was?.mode === 'plan' && it) return out(`↩️ ${me} скасовує похід: ${it.name}${was.date ? ' (' + fmtDay(was.date) + ')' : ''}. Місце залишилось у списку спонтанних.`, { tag: 'place' });
      }
      if (a.col === 'blind' && a.patch?.revealed) return out(`🎭 ${me} розкриває план побачення наосліп — подивись!`, { tag: 'blind' });
      return [];
    }
    case 'shopList': {
      if (!a.fresh) return [];
      const m = after.shopMeta?.[a.cat === 'other' ? 'other' : 'food'];
      if (!m || m.by !== mid) return [];
      const names = m.added || [];
      const what = a.cat === 'other' ? 'покупок' : 'продуктів';
      const list = names.slice(0, 5).join(', ') + (names.length > 5 ? ` і ще ${names.length - 5}` : '');
      const carried = m.carried > 0 ? ` Ще ${m.carried} з минулого списку.` : '';
      return out(`🛒 ${me} складає новий список ${what}${list ? ': ' + list : ''}.${carried}`, { title: 'Новий список покупок', tag: 'shop' });
    }
    case 'goalMove': {
      const g = after.goals.find((x) => x.id === a.id);
      if (!g || !(Number(a.amount) > 0)) return [];
      const done = g.saved >= g.target && (before.goals.find((x) => x.id === a.id)?.saved || 0) < g.target;
      return out(done ? `🎉 Ціль «${g.title}» досягнута! Разом ви зібрали ${money(g.saved)}` : `🐷 ${me} поповнює «${g.title}» на ${money(a.amount)}`, { tag: 'goal' });
    }
    case 'checkin': {
      const entry = after.checkins[a.week] || {};
      const had = before.checkins[a.week]?.[mid];
      if (had) return [];
      return entry[pid] ? out(`💜 Обидва відповіли на чек-ін — результати тижня відкрито!`, { tag: 'checkin' }) : out(`💜 ${me} відповідає на чек-ін тижня. Твоя черга!`, { tag: 'checkin' });
    }
    default: return [];
  }
}

export async function notifyAfterAction(code, action, before, after, mid) {
  try {
    const msgs = messagesFor(action, before, after, mid);
    await Promise.all(msgs.map((m) => sendTo(code, m.to, m)));
  } catch (e) { console.error('notify', e.message); }
}

/* ---------------- daily "don't forget" digest ---------------- */
const REPEAT_DAYS = { daily: 1, weekly: 7, monthly: 30 };
export function digestFor(room, mid, today) {
  const lines = [];
  const name = (id) => room.members[id]?.name || '';
  const inDays = (d) => (d ? dayDiff(today, d) : null);
  for (const e of room.events || []) if (e.date === today) lines.push(`📅 ${e.title}${e.time ? ' о ' + e.time : ''}`);
  for (const p of room.places || []) if (p.mode === 'plan' && p.date === today && !p.visited) lines.push(`📍 ${p.name}${p.time ? ' о ' + p.time : ''}`);
  for (const b of room.blind || []) {
    if (b.date === today) lines.push(b.by === mid ? '🎭 Сьогодні твоє побачення наосліп — не забудь!' : `🎭 Сьогодні побачення-сюрприз${b.time ? ' о ' + b.time : ''}! Організатор: ${name(b.by)}`);
  }
  for (const t of room.trips || []) { const n = inDays(t.start); if (n === 0) lines.push(`🧳 Сьогодні подорож: ${t.name}!`); else if (n === 1) lines.push(`🧳 Завтра подорож: ${t.name}. Чи все зібрано?`); }
  const yearly = (d) => { let x = today.slice(0, 4) + d.slice(4); if (x < today) x = (+today.slice(0, 4) + 1) + d.slice(4); return x; };
  for (const d of room.dates || []) {
    if (!d.date) continue;
    const n = inDays(d.yearly ? yearly(d.date) : d.date);
    if (n === 0) lines.push(`🎉 Сьогодні: ${d.title}`);
    else if (n === 3 || n === 7) lines.push(`🎁 Через ${n} дн.: ${d.title}`);
  }
  if (room.startDate && yearly(room.startDate) === today && room.startDate !== today) lines.push(`❤️ Сьогодні ваша річниця!`);
  for (const c of room.chores || []) {
    if (c.who && c.who !== mid) continue;
    if (c.repeat === 'none') { if (!c.done && c.who === mid) lines.push(`🧹 ${c.text}`); continue; }
    if (!c.lastDone || dayDiff(c.lastDone, today) >= REPEAT_DAYS[c.repeat]) lines.push(`🧹 ${c.text}`);
  }
  const fed = room.pet?.lastFed === today;
  const streak = streakOf(room.pet || {}, today);
  if (!fed) lines.push(streak > 1 ? `🦎 ${room.pet.name} чекає на сніданок — не втрачайте вогник 🔥${streak}` : `🦎 ${room.pet?.name || 'Хамі'} зголоднів — погодуй його`);
  if (!lines.length) return null;
  const head = lines.slice(0, 4).join('\n');
  return { title: 'Доброго ранку! Не забудьте сьогодні 🌞', body: head + (lines.length > 4 ? `\n…і ще ${lines.length - 4}` : ''), tag: 'digest' };
}
export const tomorrow = (d) => addDays(d, 1);
