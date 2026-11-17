// UI helpers: escaping, dates, icons, otter mascot, avatars.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function localDate(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
const MONTHS_GEN = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
export const MONTHS = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд'];
const WEEKDAYS_LONG = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота'];

export function fmtDate(key, { year = false, weekday = false } = {}) {
  if (!key) return '';
  const d = new Date(key + 'T12:00:00');
  let s = `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
  if (year) s += ` ${d.getFullYear()}`;
  if (weekday) s = `${WEEKDAYS_LONG[d.getDay()]}, ${s}`;
  return s;
}
export function fmtRange(a, b) {
  if (!a) return '';
  if (!b || a === b) return fmtDate(a);
  const da = new Date(a + 'T12:00:00'), db = new Date(b + 'T12:00:00');
  if (da.getMonth() === db.getMonth()) return `${da.getDate()} – ${db.getDate()} ${MONTHS_GEN[db.getMonth()]}`;
  return `${fmtDate(a)} – ${fmtDate(b)}`;
}
export function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'щойно';
  if (m < 60) return `${m} хв тому`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} год тому`;
  const d = Math.round(h / 24);
  return d === 1 ? 'вчора' : `${d} дн. тому`;
}
export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
export const money = (n) => (Math.round((n || 0) * 100) / 100).toLocaleString('uk-UA').replace(/,/g, ' ') + '₴';

/* ---------------- icons (stroke) ---------------- */
const P = {
  pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  home: '<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>',
  heart: '<path d="M12 20s-7.5-4.6-9.2-9.3C1.6 7.3 3.8 4.5 7 4.5c2 0 3.6 1.1 5 2.9 1.4-1.8 3-2.9 5-2.9 3.2 0 5.4 2.8 4.2 6.2C19.5 15.4 12 20 12 20z"/>',
  sparkle: '<path d="M10 3.5l1.6 4.4 4.4 1.6-4.4 1.6L10 15.5l-1.6-4.4L4 9.5l4.4-1.6zM18 13l.8 2.2 2.2.8-2.2.8L18 19l-.8-2.2-2.2-.8 2.2-.8z"/>',
  dots: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  chev: '<path d="M9 6l6 6-6 6"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="15" r="1.2"/><circle cx="15" cy="9" r="1.2"/><circle cx="9" cy="15" r="1.2"/>',
  mask: '<path d="M3 8c3-1.5 6-1.5 9 0 3-1.5 6-1.5 9 0 0 5-2.5 8-5 8-1.6 0-2.6-1.3-4-1.3S9.6 16 8 16c-2.5 0-5-3-5-8z"/><path d="M7 10.5h2.5M14.5 10.5H17"/>',
  bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
  cart: '<path d="M3 4h2.2l2.3 11h10.2l2-8H6.3"/><circle cx="9.5" cy="19" r="1.3"/><circle cx="17" cy="19" r="1.3"/>',
  repeat: '<path d="M4 9h13l-3-3M20 15H7l3 3"/>',
  chef: '<path d="M7 14.5V20h10v-5.5"/><path d="M7 14.5a4 4 0 0 1-1.2-7.6A4.5 4.5 0 0 1 12 4a4.5 4.5 0 0 1 6.2 2.9A4 4 0 0 1 17 14.5z"/>',
  gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8S10.5 4 8.5 4.5 7.5 8 12 8zm0 0s1.5-4 3.5-3.5S16.5 8 12 8z"/>',
  eye: '<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  send: '<path d="M4 12 20 4l-4 16-4.5-6.5z"/><path d="M11.5 13.5 20 4"/>',
  wand: '<path d="M4 20 15 9M14 4v3M12.5 5.5h3M19 10v3M17.5 11.5h3M18 3.5l.7 1.3 1.3.7-1.3.7-.7 1.3-.7-1.3-1.3-.7 1.3-.7z"/>',
  piggy: '<path d="M5 11c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5c0 1.8-.9 3.3-2.3 4.4V19h-2.5v-2.2a9 9 0 0 1-4.4 0V19H7.3v-3.6A5.4 5.4 0 0 1 5 11z"/><path d="M19 9.5h1.5M9.5 6.5l1-2.5"/>',
  hearthand: '<path d="M12 18.5s-6-3.7-7.4-7.5C3.6 8.3 5.4 6 8 6c1.6 0 2.9.9 4 2.3C13.1 6.9 14.4 6 16 6c2.6 0 4.4 2.3 3.4 5-1.4 3.8-7.4 7.5-7.4 7.5z"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.8 2.5 14.2 0 17M12 3.5c-2.5 2.8-2.5 14.2 0 17"/>',
  plane: '<path d="M10.5 13.5 4 11l1.5-1.5 7 1 4-4c1-1 2.5-1.3 3-.8s.2 2-.8 3l-4 4 1 7L14.5 21 12 14.5l-3 3V20l-1.2 1.2L6 18l-3.2-1.8L4 15h2.5z"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.8 9.5a2.3 2.3 0 1 1 3.4 2c-.8.5-1.2 1-1.2 1.8v.4M12 16.8v.2"/>',
  filter: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  shirt: '<path d="M8.5 4 4 6.5l1.8 4 2-1V20h8.4V9.5l2 1 1.8-4L15.5 4c-.7 1.3-2 2-3.5 2s-2.8-.7-3.5-2z"/>',
  hand: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v8c0 3.9-2.6 6.5-6 6.5-2.6 0-4-1.3-5.4-3.3L4 14.4a1.5 1.5 0 0 1 2.4-1.8L8 14.5"/>',
  steps: '<path d="M8.5 3c1.9 0 3 2.3 3 5s-1 4.2-3 4.2S5.5 10.7 5.5 8 6.6 3 8.5 3zM6 14.5h5V16a2.5 2.5 0 0 1-5 0zM15.5 7c1.9 0 3 2.3 3 5s-1 4.2-3 4.2-3-1.5-3-4.2S13.6 7 15.5 7zM13 18.5h5V20a2.5 2.5 0 0 1-5 0z"/>',
  smile: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14c.8 1.3 2 2 3.5 2s2.7-.7 3.5-2M9 9.5v.5M15 9.5v.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.8"/><path d="M20.5 16l-5-5-9 8.5"/>',
  bag: '<path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
  out: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  clip: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h4"/>',
  calheart: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><path d="M12 18s-2.8-1.6-2.8-3.3c0-.9.7-1.5 1.4-1.5.6 0 1 .3 1.4.8.4-.5.8-.8 1.4-.8.7 0 1.4.6 1.4 1.5 0 1.7-2.8 3.3-2.8 3.3z"/>',
  trash: '<path d="M4.5 7h15M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  archive: '<rect x="3.5" y="4" width="17" height="4.5" rx="1"/><path d="M5 8.5V20h14V8.5M10 12h4"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  camera: '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.5"/>',
  minus: '<path d="M5 12h14"/>',
  star: '<path d="M12 4l2.4 5 5.4.6-4 3.7 1.1 5.3L12 16l-4.9 2.6 1.1-5.3-4-3.7 5.4-.6z"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 0 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.6-1-2.6 0-.9.7-1.6 1.6-1.6h2.1a4 4 0 0 0 4-4C20.5 6.6 16.7 3.5 12 3.5z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="14.5" cy="7.5" r="1"/>',
  door: '<path d="M14 4H6v16h8M10 12h10M17 9l3 3-3 3"/>',
};
export const icon = (name, size = 22, extra = '') =>
  `<svg class="ico ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

/* ---------------- chameleon mascot ---------------- */
// Colour follows the mood: great → green, ok → sunny yellow, sad → blue, love → pink.
export const PALETTE = {
  green: ['#6CC46A', '#3E9A4F', '#DDF5CF'],
  yellow: ['#F2C14E', '#C9922B', '#FFF1C9'],
  blue: ['#6FA8DC', '#3F78B5', '#DCEBFA'],
  pink: ['#F28DB2', '#C95A86', '#FFE0EC'],
  grey: ['#9FB3A3', '#6F8475', '#E3ECE5'],
  violet: ['#B48CF0', '#7E57C2', '#EFE4FF'],
  mint: ['#6FD3BC', '#2F9C84', '#DDF7F0'],
};
// face: happy | ok | sad | love | sleep ; pose: sit | wave ; water (kept name) → branch with leaves
export function otter({ face = 'happy', pose = 'sit', water = false, outfit = '', size = 160, bob = false, color, branch: showBranch = true } = {}) {
  const col = color || { love: 'pink', sad: 'blue', ok: 'yellow' }[face] || 'green';
  const [c, d, l] = PALETTE[col] || PALETTE.green;
  const ink = '#2B2420', blush = '#F49A9A';
  const eye = (cx, cy) => {
    const ring = `<circle cx="${cx}" cy="${cy}" r="21" fill="${c}" stroke="${d}" stroke-width="3"/><circle cx="${cx}" cy="${cy}" r="13" fill="#fff"/>`;
    if (face === 'love') return ring + `<path d="M${cx} ${cy + 7}l-7 -7a4.2 4.2 0 1 1 7 -4.5a4.2 4.2 0 1 1 7 4.5z" fill="#E6566E"/>`;
    if (face === 'sleep') return ring + `<path d="M${cx - 13} ${cy}h26v-14h-26z" fill="${c}"/><path d="M${cx - 10} ${cy + 1}q10 7 20 0" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    if (face === 'sad') return ring + `<path d="M${cx - 14} ${cy - 2}h28v-12h-28z" fill="${c}"/><path d="M${cx - 14} ${cy - 2}h28" stroke="${d}" stroke-width="3"/><circle cx="${cx}" cy="${cy + 4}" r="5.5" fill="${ink}"/>`;
    const r = face === 'ok' ? 5.5 : 6.5;
    return ring + `<circle cx="${cx + (cx < 100 ? 2 : -2)}" cy="${cy + 1}" r="${r}" fill="${ink}"/><circle cx="${cx + (cx < 100 ? 4 : 0)}" cy="${cy - 2}" r="2.2" fill="#fff"/>`;
  };
  const mouth = face === 'sad'
    ? `<path d="M84 122 Q100 112 116 122" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M58 100q-3 8 1 11q4-3 1-11z" fill="#7EC8E3"/>`
    : face === 'ok'
      ? `<path d="M84 116 Q100 124 116 116" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`
      : `<path d="M78 112 Q100 132 122 112" stroke="${ink}" stroke-width="3.5" fill="${face === 'sleep' ? 'none' : '#E77B83'}" stroke-linecap="round"/>`;
  const arms = pose === 'wave'
    ? `<path d="M64 140 q-20 -14 -16 -40" stroke="${c}" stroke-width="13" stroke-linecap="round" fill="none"/><circle cx="48" cy="98" r="8" fill="${d}"/><ellipse cx="126" cy="170" rx="10" ry="7" fill="${d}"/>`
    : `<ellipse cx="76" cy="170" rx="10" ry="7" fill="${d}"/><ellipse cx="124" cy="170" rx="10" ry="7" fill="${d}"/>`;
  const branch = water
    ? `<path d="M-20 178 Q60 168 110 176 T230 172" stroke="#7A5233" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M30 172q-14 -18 6 -26q8 14 -6 26z" fill="#4FA35A"/><path d="M168 170q18 -16 4 -28q-14 10 -4 28z" fill="#4FA35A"/>`
    : `<path d="M30 176 Q100 168 170 176" stroke="#7A5233" stroke-width="9" fill="none" stroke-linecap="round"/>`;
  return `<svg class="otter mascot ${bob ? 'bob' : ''}" width="${size}" height="${size}" viewBox="0 0 200 200" aria-hidden="true">
    <path d="M132 164 q40 6 42 -22 q2 -24 -20 -24 q-17 0 -17 15 q0 12 12 12 q8 0 8 -7" stroke="${c}" stroke-width="12" fill="none" stroke-linecap="round"/>
    <path d="M132 164 q40 6 42 -22 q2 -24 -20 -24 q-17 0 -17 15 q0 12 12 12 q8 0 8 -7" stroke="${d}" stroke-width="2.5" fill="none" stroke-dasharray="3 9" stroke-linecap="round"/>
    <ellipse cx="100" cy="150" rx="40" ry="32" fill="${c}"/>
    <ellipse cx="100" cy="158" rx="23" ry="21" fill="${l}"/>
    <g fill="${d}" opacity=".55"><circle cx="72" cy="142" r="4"/><circle cx="128" cy="140" r="4"/><circle cx="80" cy="162" r="3"/><circle cx="121" cy="160" r="3"/></g>
    ${showBranch ? branch : ''}
    ${arms}
    <path d="M70 70 Q100 26 130 70 Z" fill="${d}"/>
    <path d="M80 66 Q100 38 120 66" stroke="${c}" stroke-width="4" fill="none" opacity=".7"/>
    <ellipse cx="100" cy="98" rx="50" ry="38" fill="${c}"/>
    <ellipse cx="100" cy="112" rx="32" ry="16" fill="${l}" opacity=".7"/>
    <ellipse cx="70" cy="114" rx="8" ry="5" fill="${blush}" opacity=".7"/><ellipse cx="130" cy="114" rx="8" ry="5" fill="${blush}" opacity=".7"/>
    <g class="eyes">${eye(64, 86)}${eye(136, 86)}</g>
    <g fill="${d}"><circle cx="94" cy="104" r="1.8"/><circle cx="106" cy="104" r="1.8"/></g>
    ${mouth}
    ${outfit ? `<text x="${outfit === '🕶️' ? 100 : outfit === '🧣' ? 100 : 100}" y="${outfit === '🕶️' ? 98 : outfit === '🧣' ? 142 : 48}" font-size="${outfit === '🕶️' ? 50 : 36}" text-anchor="middle">${outfit}</text>` : ''}
  </svg>`;
}
export const mascot = otter;

export function emptyState(text, sub = '', btn = '') {
  return `<div class="empty">
    <div class="empty-art">${otter({ pose: 'wave', water: true, size: 120 })}<span class="e-heart">❤</span><span class="e-star">✦</span></div>
    <div class="empty-t">${esc(text)}</div>
    ${sub ? `<div class="empty-s">${esc(sub)}</div>` : ''}
    ${btn}
  </div>`;
}

/* ---------------- avatars ---------------- */
const GRADS = ['linear-gradient(135deg,#E79BF0,#B95BE0)', 'linear-gradient(135deg,#F7A88B,#E0607E)', 'linear-gradient(135deg,#8FD3F4,#5B8DEF)', 'linear-gradient(135deg,#A8E6A1,#4CAF7A)'];
export function avatar(member, id = '', size = 44) {
  if (!member) return `<span class="ava" style="width:${size}px;height:${size}px;font-size:${size * 0.42}px;background:var(--card2)">?</span>`;
  if (member.avatar) return `<span class="ava" style="width:${size}px;height:${size}px"><img src="${member.avatar}" alt=""></span>`;
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  h %= GRADS.length;
  const letter = (member.name || '?').trim().charAt(0).toUpperCase();
  return `<span class="ava" style="width:${size}px;height:${size}px;font-size:${size * 0.42}px;background:${GRADS[h]}">${esc(letter)}</span>`;
}

export async function resizeImage(file, max = 160, quality = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(img.width, img.height);
    const c = document.createElement('canvas');
    c.width = c.height = max;
    c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, max, max);
    return c.toDataURL('image/jpeg', quality);
  } finally { URL.revokeObjectURL(url); }
}

/* ---------------- chameleon studying a map (loading scene) ---------------- */
export function mapScene() {
  return `<div class="map-scene" aria-hidden="true">
    <svg class="map-paper" viewBox="0 0 300 190">
      <path d="M10 22 L100 10 L200 22 L290 10 L290 170 L200 182 L100 170 L10 182 Z" fill="#F3E6C8"/>
      <path d="M100 10 L100 170 M200 22 L200 182" stroke="#D9C79F" stroke-width="2"/>
      <path d="M10 22 L100 10 L100 170 L10 182 Z" fill="#EBDDBB" opacity=".7"/>
      <path d="M200 22 L290 10 L290 170 L200 182 Z" fill="#EBDDBB" opacity=".5"/>
      <path d="M18 120 C70 100 90 150 150 130 S240 90 286 110" stroke="#8CC4E8" stroke-width="12" fill="none" stroke-linecap="round" opacity=".9"/>
      <ellipse cx="62" cy="62" rx="30" ry="20" fill="#A8D5A0"/><ellipse cx="236" cy="150" rx="26" ry="16" fill="#A8D5A0"/>
      <path d="M20 85 H280 M150 18 V178 M40 160 L120 40 M190 60 L285 70" stroke="#FFFFFF" stroke-width="5" opacity=".85"/>
      <path class="route" d="M40 150 C70 120 110 160 150 100 S220 70 250 50" stroke="#E6566E" stroke-width="3.5" fill="none" stroke-dasharray="7 7" stroke-linecap="round"/>
      <g class="pin p1"><path d="M70 74c0-8 6-13 12-13s12 5 12 13c0 9-12 19-12 19S70 83 70 74z" fill="#E6566E"/><circle cx="82" cy="73" r="4.5" fill="#fff"/></g>
      <g class="pin p2"><path d="M140 62c0-8 6-13 12-13s12 5 12 13c0 9-12 19-12 19s-12-10-12-19z" fill="#F2B544"/><circle cx="152" cy="61" r="4.5" fill="#fff"/></g>
      <g class="pin p3"><path d="M226 30c0-8 6-13 12-13s12 5 12 13c0 9-12 19-12 19s-12-10-12-19z" fill="#5FB98A"/><circle cx="238" cy="29" r="4.5" fill="#fff"/></g>
      <g class="pin p4"><path d="M186 118c0-8 6-13 12-13s12 5 12 13c0 9-12 19-12 19s-12-10-12-19z" fill="#9B7FE6"/><circle cx="198" cy="117" r="4.5" fill="#fff"/></g>
      <g class="lens"><circle cx="0" cy="0" r="22" fill="rgba(255,255,255,.35)" stroke="#5B4636" stroke-width="5"/><path d="M15 15 L32 32" stroke="#5B4636" stroke-width="8" stroke-linecap="round"/></g>
    </svg>
    <div class="map-buddy">${otter({ face: 'happy', size: 96, color: 'green' })}</div>
  </div>`;
}

/* ---------------- chef chameleon cooking (recipe loading scene) ---------------- */
export function cookScene() {
  const hat = `<svg class="chef-hat" viewBox="0 0 80 64" aria-hidden="true"><path d="M14 40 C2 38 2 18 16 18 C16 4 34 0 40 10 C46 0 64 4 64 18 C78 18 78 38 66 40 Z" fill="#fff"/><rect x="16" y="38" width="48" height="16" rx="4" fill="#F1F1F1"/><path d="M28 40 v12 M40 40 v12 M52 40 v12" stroke="#DDD" stroke-width="2"/></svg>`;
  return `<div class="cook-scene" aria-hidden="true">
    <div class="cook-buddy">${hat}${otter({ face: 'happy', size: 110, color: 'green' })}</div>
    <div class="cook-pot">
      <div class="steam"><i></i><i></i><i></i></div>
      <div class="drops"><span>🍅</span><span>🥕</span><span>🧅</span><span>🧀</span><span>🌿</span></div>
      <svg viewBox="0 0 160 110">
        <g class="ladle"><path d="M118 8 L92 62" stroke="#8E6B4E" stroke-width="7" stroke-linecap="round"/><ellipse cx="88" cy="66" rx="12" ry="6" fill="#8E6B4E"/></g>
        <ellipse cx="80" cy="44" rx="66" ry="12" fill="#E8913A"/>
        <g class="bubbles"><circle cx="52" cy="44" r="4" fill="#F7B35E"/><circle cx="96" cy="42" r="3" fill="#F7B35E"/><circle cx="72" cy="47" r="3.5" fill="#F7B35E"/></g>
        <path d="M12 44 Q14 104 80 104 Q146 104 148 44" fill="#3D3A42"/>
        <path d="M12 44 Q14 104 80 104 Q146 104 148 44" fill="none" stroke="#56525E" stroke-width="3"/>
        <ellipse cx="80" cy="44" rx="68" ry="13" fill="none" stroke="#56525E" stroke-width="5"/>
        <rect x="0" y="50" width="16" height="7" rx="3.5" fill="#56525E"/><rect x="144" y="50" width="16" height="7" rx="3.5" fill="#56525E"/>
        <path d="M30 70 Q34 90 50 96" stroke="#ffffff" stroke-opacity=".12" stroke-width="5" fill="none" stroke-linecap="round"/>
      </svg>
      <div class="flame"><i></i><i></i><i></i></div>
    </div>
  </div>`;
}

/* ---------------- «Нишпорка» — the shopping-detective chameleon of the wishlist ---------------- */
const CAP = `<svg class="ny-cap" viewBox="0 0 90 46" aria-hidden="true"><path d="M8 34 C8 12 30 4 46 4 C66 4 84 14 84 32 Z" fill="#5B3F8C"/><path d="M4 34 h80 a3 3 0 0 1 0 7 H4 a3 3 0 0 1 0-7z" fill="#46306E"/><path d="M14 30 C20 16 36 10 50 10" stroke="#fff" stroke-opacity=".18" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="46" cy="5" r="4" fill="#F2C14E"/></svg>`;
const GLASS = `<svg class="ny-glass" viewBox="0 0 60 60" aria-hidden="true"><circle cx="24" cy="24" r="16" fill="#DFF3FF" fill-opacity=".55" stroke="#8E6B4E" stroke-width="5"/><path d="M14 18 a12 12 0 0 1 10-6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M36 36 L52 52" stroke="#8E6B4E" stroke-width="8" stroke-linecap="round"/></svg>`;
export function nyshporka(size = 90, face = 'happy') {
  return `<span class="ny" style="--s:${size}px">${CAP}${otter({ face, size, color: 'violet' })}${GLASS}</span>`;
}
export function scanScene() {
  return `<div class="scan-scene" aria-hidden="true">
    <div class="scan-page">
      <div class="sp-bar"><i></i><i></i><i></i></div>
      <div class="sp-img"><span>🎁</span></div>
      <div class="sp-l w80"></div><div class="sp-l w60"></div>
      <div class="sp-price">₴ <b></b></div>
      <div class="sp-l w90 thin"></div><div class="sp-l w70 thin"></div>
      <div class="sp-beam"></div>
    </div>
    <div class="scan-buddy">${nyshporka(96)}</div>
    <div class="scan-sparks"><span>✨</span><span>🏷️</span><span>📸</span></div>
  </div>`;
}

/* ---------------- «Шептунчик» — the whispering helper ---------------- */
export function whisperer(size = 64, face = 'happy') {
  return `<span class="wh-av" style="--s:${size}px">${otter({ face, size, color: 'mint', branch: size > 50 })}<span class="wh-ps">ш-ш</span></span>`;
}
