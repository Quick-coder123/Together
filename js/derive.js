// Values computed from the room: calendar items, stats, first steps.
import { addDays, dayDiff } from '../lib/core.js';

export const KIND = {
  date: { label: 'Побачення', color: '#E6566E', emoji: '💞' },
  trip: { label: 'Поїздка', color: '#4FA3E0', emoji: '✈️' },
  event: { label: 'Подія', color: '#C9935F', emoji: '📌' },
  reminder: { label: 'Нагадування', color: '#9B7FE6', emoji: '⏰' },
  important: { label: 'Важлива дата', color: '#F2B544', emoji: '🎉' },
  place: { label: 'Місце', color: '#5FB98A', emoji: '📍' },
  blind: { label: 'Побачення наосліп', color: '#D65DB1', emoji: '🎭' },
};

// Next occurrence of a yearly date on/after `from`.
function nextYearly(date, from) {
  const y = +from.slice(0, 4);
  for (const yy of [y, y + 1]) {
    const d = `${yy}${date.slice(4)}`;
    if (d >= from) return d;
  }
  return null;
}

// All calendar items between [from, to] inclusive.
export function itemsBetween(room, from, to) {
  const out = [];
  const inRange = (d) => d && d >= from && d <= to;
  for (const e of room.events) if (inRange(e.date)) out.push({ date: e.date, time: e.time, title: e.title + (e.kind === 'reminder' && e.who && e.who === e.by ? ' 🔒' : ''), kind: e.kind || 'event', ref: ['events', e.id] });
  for (const p of room.places) if (p.mode === 'plan' && inRange(p.date)) out.push({ date: p.date, time: p.time, title: p.name, kind: 'place', ref: ['places', p.id] });
  for (const b of room.blind) if (inRange(b.date)) out.push({ date: b.date, time: b.time, title: 'Побачення наосліп', kind: 'blind', ref: ['blind', b.id] });
  for (const t of room.trips) {
    if (!t.start) continue;
    const end = t.end || t.start;
    for (let d = t.start; d <= end && dayDiff(t.start, d) < 60; d = addDays(d, 1)) if (inRange(d)) out.push({ date: d, title: t.name, kind: 'trip', ref: ['trips', t.id], first: d === t.start });
  }
  for (const im of room.dates) {
    if (!im.date) continue;
    if (im.yearly) {
      let d = nextYearly(im.date, from);
      while (d && d <= to) {
        const years = +d.slice(0, 4) - +im.date.slice(0, 4);
        out.push({ date: d, title: im.title + (years > 0 ? ` · ${years} р.` : ''), kind: 'important', ref: ['dates', im.id] });
        d = nextYearly(im.date, addDays(d, 1));
      }
    } else if (inRange(im.date)) out.push({ date: im.date, title: im.title, kind: 'important', ref: ['dates', im.id] });
  }
  if (room.startDate) {
    let d = nextYearly(room.startDate, from);
    while (d && d <= to) {
      const years = +d.slice(0, 4) - +room.startDate.slice(0, 4);
      if (years > 0) out.push({ date: d, title: `Наша річниця · ${years} р. ❤️`, kind: 'important', ref: null });
      d = nextYearly(room.startDate, addDays(d, 1));
    }
  }
  return out.sort((a, b) => (a.date + (a.time || '99')).localeCompare(b.date + (b.time || '99')));
}

export function stats(room) {
  const dates = room.places.filter((p) => p.visited).length + room.events.filter((e) => e.kind === 'date' && e.date && e.date < new Date().toISOString().slice(0, 10)).length;
  const trips = room.trips.length + room.tripLog.length;
  return { dates, trips };
}

export function firstSteps(room, mid, hasPartner) {
  return [
    { id: 'place', title: 'Додайте перше місце', icon: 'pin', done: room.places.length > 0, go: ['places'] },
    { id: 'mood', title: 'Відмітьте настрій', icon: 'smile', done: !!room.moods[mid], go: ['me', null, 'mood'] },
    { id: 'note', title: 'Сплануйте сюрприз або надішліть записку', icon: 'mask', done: room.notes.length > 0 || room.blind.length > 0, go: ['note'] },
    { id: 'invite', title: 'Запросіть свою половинку', icon: 'link', done: hasPartner, go: ['invite'] },
    { id: 'date', title: 'Додайте важливу дату', icon: 'calheart', done: room.dates.length > 0 || !!room.startDate, go: ['addDate'] },
  ];
}
