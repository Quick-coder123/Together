// Calendar subscription feed (iCalendar) for Google Calendar / iPhone Calendar.
// URL: /api/ics?c=<pair code>&k=<secret key from settings>
import { kv, roomKey } from './_notify.js';
import { itemsBetween } from '../js/derive.js';
import { addDays } from '../lib/core.js';
import { kyivMs, kyivParts } from './_remind.js';

const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
const utc = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const ymd = (d) => d.replace(/-/g, '');
// RFC 5545 line folding (75 octets)
const fold = (line) => { const out = []; let cur = ''; for (const ch of line) { if (Buffer.byteLength(cur + ch) > 73) { out.push(cur); cur = ' ' + ch; } else cur += ch; } out.push(cur); return out.join('\r\n'); };

export function buildIcs(room, now = Date.now()) {
  const today = kyivParts(now).date;
  const items = itemsBetween(room, addDays(today, -60), addDays(today, 366));
  const stamp = utc(now);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Hamelyky//UA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Хамелеончики 💚', 'X-WR-TIMEZONE:Europe/Kyiv', 'REFRESH-INTERVAL;VALUE=DURATION:PT15M', 'X-PUBLISHED-TTL:PT15M'];
  const seenTrip = new Set();
  for (const it of items) {
    const [col, id] = it.ref || ['x', it.title];
    const src = col ? (room[col] || []).find((x) => x.id === id) : null;
    let title = it.title, desc = '', loc = '';
    if (it.kind === 'blind') { title = '🎭 Побачення наосліп'; desc = [src?.dress ? 'Дрес-код: ' + src.dress : 'Сюрприз!', /^https?:/i.test(src?.meet || '') ? 'Місце зустрічі: ' + src.meet : ''].filter(Boolean).join('\n'); loc = src?.meet || ''; }
    else if (it.kind === 'place') { title = '📍 ' + it.title; loc = src?.address || ''; desc = src?.note || ''; }
    else if (it.kind === 'important') title = '🎉 ' + it.title;
    else if (it.kind === 'reminder') title = '⏰ ' + it.title;
    else if (src?.kind === 'date') title = '💞 ' + it.title;
    if (it.kind !== 'blind' && it.kind !== 'place' && src?.note) desc = src.note;
    const uid = `${col}-${id}-${it.date}@hamelyky`;
    const ev = ['BEGIN:VEVENT', `UID:${uid}`, `DTSTAMP:${stamp}`, `SUMMARY:${esc(title)}`];
    if (it.kind === 'trip') {
      if (seenTrip.has(id) || !src) continue;
      seenTrip.add(id);
      ev[3] = `SUMMARY:${esc('✈️ ' + src.name)}`;
      ev.push(`DTSTART;VALUE=DATE:${ymd(src.start)}`, `DTEND;VALUE=DATE:${ymd(addDays(src.end || src.start, 1))}`);
    } else if (it.time) {
      const start = kyivMs(it.date, it.time);
      ev.push(`DTSTART:${utc(start)}`, `DTEND:${utc(start + (it.kind === 'reminder' ? 15 : 120) * 60e3)}`);
      ev.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, `TRIGGER:${it.kind === 'reminder' ? 'PT0M' : '-PT2H'}`, 'END:VALARM');
    } else {
      ev.push(`DTSTART;VALUE=DATE:${ymd(it.date)}`, `DTEND;VALUE=DATE:${ymd(addDays(it.date, 1))}`);
    }
    if (desc) ev.push(`DESCRIPTION:${esc(desc)}`);
    if (loc) ev.push(`LOCATION:${esc(loc)}`);
    ev.push('END:VEVENT');
    lines.push(...ev);
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const code = String(q.get('c') || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const key = String(q.get('k') || '');
  const room = code ? await kv.get(roomKey(code)) : null;
  if (!room || !room.calKey || key !== room.calKey) return new Response('Not found', { status: 404 });
  return new Response(buildIcs(room), { headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-cache, no-store, must-revalidate', 'CDN-Cache-Control': 'no-store', 'Content-Disposition': 'inline; filename="hamelyky.ics"' } });
}
