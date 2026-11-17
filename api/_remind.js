// Шептунчик's timed reminders. Not a route. Nothing is queued: every tick (each ~10 min, QStash)
// recomputes from the room what is due right now, so edited or deleted plans never fire stale reminders.
// Each reminder is sent once (Redis "claim" key with expiry).
import { itemsBetween } from '../js/derive.js';
import { addDays, mealsOf, MEALS } from '../lib/core.js';

export const TZ = 'Europe/Kyiv';
const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export function kyivParts(ms) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: +p.hour, minute: +p.minute };
}
// Kyiv wall-clock date + "HH:MM" → UTC milliseconds (handles summer/winter time).
export function kyivMs(date, time = '00:00') {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  let guess = wall - 2 * 3600e3;
  for (let i = 0; i < 2; i++) {
    const p = kyivParts(guess);
    const [py, pm, pd] = p.date.split('-').map(Number);
    guess += wall - Date.UTC(py, pm - 1, pd, p.hour, p.minute);
  }
  return guess;
}
const hm = (t) => t || '';
const dayName = (d) => new Intl.DateTimeFormat('uk-UA', { weekday: 'long', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
const listOf = (arr, n = 4) => arr.slice(0, n).join(', ') + (arr.length > n ? ` і ще ${arr.length - n}` : '');

const EVE_HOUR = '19:00'; // "tomorrow you have…" reminder time
const SHOP_EVERY_H = 3; // shopping list reminders every 3 hours…
const SHOP_UNTIL_H = 21; // …until 21:00 of the day the list was made
const SHOP_FROM_H = 8;

/** All reminders of a room that are due in (from, to]. Each: { key, to: memberId[], body, title?, tag? } */
export function remindersDue(room, from, to) {
  const out = [];
  const members = Object.keys(room.members || {});
  if (!members.length) return out;
  const name = (id) => room.members[id]?.name || 'Партнер';
  const other = (id) => members.find((x) => x !== id);
  const at = (ms) => ms > from && ms <= to;
  const today = kyivParts(to).date;
  const items = itemsBetween(room, addDays(today, -1), addDays(today, 2));

  for (const it of items) {
    const [col, id] = it.ref || [];
    const src = col ? (room[col] || []).find((x) => x.id === id) : null;
    const k = `${col}:${id}:${it.date}:${it.time || ''}`;
    if (it.kind === 'important' || !src) continue;

    if (it.kind === 'reminder') {
      const ms = kyivMs(it.date, it.time || '09:00');
      if (at(ms)) out.push({ key: `rem:${k}`, to: src.who && members.includes(src.who) ? [src.who] : members, title: 'Шептунчик нагадує 🤫', body: `⏰ ${it.title}${src.note ? ' — ' + src.note : ''}`, tag: 'rem-' + id, urgent: true });
      continue;
    }
    if (it.kind === 'trip') {
      if (!it.first) continue;
      const ms = kyivMs(addDays(it.date, -1), EVE_HOUR);
      if (at(ms)) {
        const left = (src.pack || []).filter((p) => !p.done).length;
        out.push({ key: `trip:${k}`, to: members, title: 'Завтра в дорогу 🧳', body: `${it.title} — вже завтра!${left ? ` Ще не спаковано: ${left} ${left === 1 ? 'річ' : 'речей'}.` : ' Все спаковано 👌'}`, tag: 'trip' });
      }
      continue;
    }
    // dates, events, planned places, blind dates
    const eve = kyivMs(addDays(it.date, -1), EVE_HOUR);
    const soon = it.time ? kyivMs(it.date, it.time) - 2 * 3600e3 : null;
    const when = it.time ? ` о ${hm(it.time)}` : '';
    if (it.kind === 'blind') {
      const org = src.by, guest = other(org);
      if (at(eve)) {
        out.push({ key: `eve:${k}`, to: [org], title: 'Завтра сюрприз 🎭', body: `Завтра${when} — твоє побачення-сюрприз. ${guest ? name(guest) + ' ще нічого не знає 😉 ' : ''}Все готово?`, tag: 'blind' });
        if (guest) out.push({ key: `eve2:${k}`, to: [guest], title: 'Тссс… 🤫', body: `Завтра${when} на тебе чекає побачення-сюрприз! Організатор: ${name(org)}.${src.meet ? (/^https?:/i.test(src.meet) ? ' Місце зустрічі — в застосунку.' : ` Зустріч: ${src.meet}.`) : ''}${src.dress ? ` Дрес-код: ${src.dress}.` : ''}`, tag: 'blind' });
      }
      if (soon && at(soon)) out.push({ key: `soon:${k}`, to: members, title: 'Через 2 години 🎭', body: `Побачення наосліп${when}.${src.meet && !/^https?:/i.test(src.meet) ? ` Зустріч: ${src.meet}.` : ''} ${guest ? `${name(guest)}, готуйся до сюрпризу!` : ''}`.trim(), tag: 'blind', urgent: true });
      continue;
    }
    const emoji = it.kind === 'place' ? '📍' : src.kind === 'date' ? '💞' : '📅';
    if (at(eve)) out.push({ key: `eve:${k}`, to: members, title: 'Завтра в планах', body: `${emoji} ${it.title}${when}${src.address ? ' · ' + src.address : ''}`, tag: 'eve-' + id });
    if (soon && at(soon)) out.push({ key: `soon:${k}`, to: members, title: 'Через 2 години', body: `${emoji} ${it.title}${when}`, tag: 'soon-' + id, urgent: true });
  }

  // Pet meals: a nudge near the end of each meal window if nobody fed the chameleon yet.
  if (room.pet) {
    const pet = room.pet, meals = mealsOf(pet, today), nm = pet.name || 'Хамі';
    for (const [k, t, txt] of [['b', '10:15', `${MEALS.b.e} ${nm} чекає на сніданок! До 11:00 ще встигнете.`], ['l', '16:15', `${MEALS.l.e} ${nm} зголоднів — час обіду (до 17:00).`], ['d', '21:00', `${MEALS.d.e} ${nm} чекає на вечерю. Без неї день не зарахується 🥺`]]) {
      if (meals[k]) continue;
      const ms = kyivMs(today, t);
      if (at(ms)) out.push({ key: `meal:${today}:${k}`, to: members, title: 'Годування хамелеона', body: txt, tag: 'meal' });
    }
  }

  // Shopping: the whole day the list was made, every few hours while something is still not bought.
  for (const [cat, m] of Object.entries(room.shopMeta || {})) {
    if (!m?.ts) continue;
    const open = (room.shopping || []).filter((x) => x.cat === cat && !x.done);
    if (!open.length) continue;
    const day = kyivParts(m.ts).date;
    for (let n = 1; n <= 6; n++) {
      const ms = m.ts + n * SHOP_EVERY_H * 3600e3;
      const p = kyivParts(ms);
      if (p.date !== day || p.hour >= SHOP_UNTIL_H) break;
      if (p.hour < SHOP_FROM_H || !at(ms)) continue;
      const names = open.map((x) => (x.qty ? `${x.text} (${x.qty})` : x.text));
      out.push({ key: `shop:${cat}:${m.ts}:${n}`, to: members, title: 'Не забудьте зайти в магазин 🛒', body: `У списку ще ${open.length}: ${listOf(names)}`, tag: 'shop-' + cat });
    }
  }
  return out;
}

export { dayName };
