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

/* ---------------- otter mascot ---------------- */
// face: happy | ok | sad | love | sleep ; pose: sit | wave ; water: boolean
export function otter({ face = 'happy', pose = 'sit', water = false, outfit = '', size = 160, bob = false } = {}) {
  const fur = '#B8754A', dark = '#8E5534', cream = '#F7E3CB', ink = '#3A2317', blush = '#F29B91';
  const eyes = {
    happy: `<circle cx="84" cy="84" r="5.5" fill="${ink}"/><circle cx="116" cy="84" r="5.5" fill="${ink}"/><circle cx="86" cy="82" r="1.8" fill="#fff"/><circle cx="118" cy="82" r="1.8" fill="#fff"/>`,
    ok: `<circle cx="84" cy="85" r="5" fill="${ink}"/><circle cx="116" cy="85" r="5" fill="${ink}"/><circle cx="85.5" cy="83.5" r="1.5" fill="#fff"/><circle cx="117.5" cy="83.5" r="1.5" fill="#fff"/>`,
    sad: `<path d="M78 82q6 5 12 0M110 82q6 5 12 0" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/><path d="M80 90q-2 6 1 8q3-2 1-8z" fill="#7EC8E3"/>`,
    love: `<path d="M84 90l-6-6a3.5 3.5 0 1 1 6-3.5a3.5 3.5 0 1 1 6 3.5z" fill="#E6566E"/><path d="M116 90l-6-6a3.5 3.5 0 1 1 6-3.5a3.5 3.5 0 1 1 6 3.5z" fill="#E6566E"/>`,
    sleep: `<path d="M78 85q6 4 12 0M110 85q6 4 12 0" stroke="${ink}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`,
  }[face] || '';
  const mouth = face === 'sad'
    ? `<path d="M92 110q8 -6 16 0" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`
    : `<path d="M100 102v4M100 106q-5 6 -10 2M100 106q5 6 10 2" stroke="${ink}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  const arms = pose === 'wave'
    ? `<path d="M62 132q-14 -22 -6 -40" stroke="${fur}" stroke-width="15" stroke-linecap="round" fill="none"/><circle cx="56" cy="90" r="9" fill="${dark}"/><ellipse cx="124" cy="148" rx="11" ry="8" fill="${dark}" transform="rotate(-20 124 148)"/>`
    : `<ellipse cx="78" cy="148" rx="11" ry="8" fill="${dark}" transform="rotate(20 78 148)"/><ellipse cx="122" cy="148" rx="11" ry="8" fill="${dark}" transform="rotate(-20 122 148)"/>`;
  const waterSvg = water ? `<path d="M-35 172q22 -12 45 0t45 0 45 0 45 0 45 0 45 0V200H-35z" fill="#2F5D5A"/><path d="M-35 176q22 -10 45 0t45 0 45 0 45 0 45 0 45 0" stroke="#4B8580" stroke-width="3" fill="none"/>` : '';
  return `<svg class="otter ${bob ? 'bob' : ''}" width="${size}" height="${size}" viewBox="0 0 200 200" aria-hidden="true">
    <ellipse cx="100" cy="160" rx="46" ry="40" fill="${fur}"/>
    <ellipse cx="100" cy="166" rx="28" ry="30" fill="${cream}"/>
    <circle cx="58" cy="66" r="11" fill="${dark}"/><circle cx="58" cy="66" r="5.5" fill="#E2A97F"/>
    <circle cx="142" cy="66" r="11" fill="${dark}"/><circle cx="142" cy="66" r="5.5" fill="#E2A97F"/>
    <ellipse cx="100" cy="90" rx="50" ry="42" fill="${fur}"/>
    <ellipse cx="86" cy="104" rx="22" ry="17" fill="${cream}"/><ellipse cx="114" cy="104" rx="22" ry="17" fill="${cream}"/>
    <ellipse cx="100" cy="94" rx="14" ry="12" fill="${cream}"/>
    <ellipse cx="72" cy="100" rx="8" ry="5" fill="${blush}" opacity=".75"/><ellipse cx="128" cy="100" rx="8" ry="5" fill="${blush}" opacity=".75"/>
    ${eyes}
    <ellipse cx="100" cy="97" rx="9" ry="6.5" fill="${ink}"/><ellipse cx="97.5" cy="95" rx="2.5" ry="1.5" fill="#fff" opacity=".6"/>
    ${mouth}
    <g fill="${dark}"><circle cx="80" cy="106" r="1.6"/><circle cx="85" cy="110" r="1.6"/><circle cx="120" cy="106" r="1.6"/><circle cx="115" cy="110" r="1.6"/></g>
    <path d="M66 104l-16-3M66 109l-15 3M134 104l16-3M134 109l15 3" stroke="${dark}" stroke-width="2" stroke-linecap="round" opacity=".7"/>
    ${arms}
    ${waterSvg}
    ${outfit ? `<text x="${outfit === '🕶️' ? 100 : outfit === '🧣' ? 100 : 128}" y="${outfit === '🕶️' ? 94 : outfit === '🧣' ? 140 : 62}" font-size="${outfit === '🕶️' ? 44 : 34}" text-anchor="middle">${outfit}</text>` : ''}
  </svg>`;
}

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

export async function resizeImage(file, max = 160) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(img.width, img.height);
    const c = document.createElement('canvas');
    c.width = c.height = max;
    c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, max, max);
    return c.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(url); }
}
