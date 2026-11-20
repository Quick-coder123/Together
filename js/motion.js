// Small motion pieces, rebuilt in plain JS after designbookmark.com/motion
// (DesignBookmark «Like burst», «Parallax ticket», Kokonut UI «Slide to confirm», «Page flip»).
import { openSheet, closeSheet } from './store.js';
import { esc, icon } from './ui.js';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/* ---------- Like burst: a ring + hearts flying out of the button ---------- */
export function burst(el, emojis = ['❤️', '💖', '💕', '💗', '✨']) {
  if (!el || reduced()) return;
  const r = el.getBoundingClientRect();
  const host = document.createElement('div');
  host.className = 'burst';
  host.style.left = `${r.left + r.width / 2}px`;
  host.style.top = `${r.top + r.height / 2}px`;
  host.innerHTML = '<span class="burst-ring"></span>' + Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2 + Math.random() * 0.4, d = 34 + Math.random() * 26;
    return `<span class="burst-p" style="--x:${(Math.cos(a) * d).toFixed(1)}px;--y:${(Math.sin(a) * d - 8).toFixed(1)}px;--r:${Math.round(Math.random() * 60 - 30)}deg;--d:${Math.round(Math.random() * 80)}ms">${emojis[i % emojis.length]}</span>`;
  }).join('');
  document.body.appendChild(host);
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  navigator.vibrate?.(10);
  setTimeout(() => host.remove(), 900);
}

/* ---------- Parallax ticket: the card tilts toward the finger, shine follows ---------- */
export function tilt(el, max = 9) {
  if (!el || el.dataset.tilt || reduced()) return;
  el.dataset.tilt = '1';
  let raf = 0;
  const set = (x, y) => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      el.style.setProperty('--rx', `${(-y * max).toFixed(2)}deg`);
      el.style.setProperty('--ry', `${(x * max).toFixed(2)}deg`);
      el.style.setProperty('--sx', `${(50 + x * 60).toFixed(1)}%`);
      el.style.setProperty('--sy', `${(50 + y * 60).toFixed(1)}%`);
    });
  };
  const move = (e) => { const r = el.getBoundingClientRect(); set((e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5); el.classList.add('tilting'); };
  const leave = () => { el.classList.remove('tilting'); set(0, 0); };
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerdown', move);
  el.addEventListener('pointerleave', leave);
  el.addEventListener('pointerup', leave);
  el.addEventListener('pointercancel', leave);
}

/* ---------- Slide to confirm (instead of «Are you sure?») ---------- */
export function slideConfirm({ title, text = '', label = 'Проведи, щоб підтвердити', art = '', danger = true }) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; resolve(v); };
    openSheet(`<div class="center pad">${art}<h3 class="h3 mt">${esc(title)}</h3>${text ? `<p class="muted">${esc(text)}</p>` : ''}</div>
      <div class="slide ${danger ? 'danger' : ''}" role="slider" aria-label="${esc(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" tabindex="0">
        <span class="slide-fill"></span><span class="slide-label">${esc(label)}</span>
        <span class="slide-knob">${icon('chev', 22)}</span></div>
      <button class="btn ghost block mt" data-no>Скасувати</button>`, (sh) => {
      const track = sh.querySelector('.slide'), knob = track.querySelector('.slide-knob'), fill = track.querySelector('.slide-fill'), lab = track.querySelector('.slide-label');
      let x0 = 0, dx = 0, max = 0, drag = false;
      const put = (v, anim) => {
        knob.style.transition = fill.style.transition = lab.style.transition = anim ? 'transform .35s cubic-bezier(.23,1,.32,1), width .35s cubic-bezier(.23,1,.32,1), opacity .35s' : 'none';
        knob.style.transform = `translateX(${v}px)`; fill.style.width = `${v + knob.offsetWidth}px`; lab.style.opacity = String(1 - v / max * 1.3);
        track.setAttribute('aria-valuenow', String(Math.round((v / max) * 100)));
      };
      const ok = () => {
        put(max, true); track.classList.add('ok'); knob.innerHTML = icon('check', 22); navigator.vibrate?.(20);
        setTimeout(() => { finish(true); closeSheet(); }, 380);
      };
      knob.addEventListener('pointerdown', (e) => { drag = true; x0 = e.clientX - dx; max = track.clientWidth - knob.offsetWidth - 8; knob.setPointerCapture(e.pointerId); });
      knob.addEventListener('pointermove', (e) => { if (!drag) return; dx = Math.max(0, Math.min(max, e.clientX - x0)); put(dx, false); });
      const up = () => { if (!drag) return; drag = false; if (dx >= max * 0.9) ok(); else { dx = 0; put(0, true); } };
      knob.addEventListener('pointerup', up); knob.addEventListener('pointercancel', up);
      track.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { max = track.clientWidth - knob.offsetWidth - 8; ok(); } });
      sh.querySelector('[data-no]').addEventListener('click', () => { finish(false); closeSheet(); });
      return () => finish(false);
    });
  });
}

/* ---------- Star rating (tap a star; stars pop in one after another) ---------- */
export function starsHtml(value, { size = 26, attr = '' } = {}) {
  return `<span class="stars" ${attr} role="radiogroup" aria-label="Оцінка">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="star ${n <= (value || 0) ? 'on' : ''}" data-star="${n}" role="radio" aria-checked="${n === value}" aria-label="${n} з 5" style="--i:${n};font-size:${size}px">★</button>`).join('')}</span>`;
}
export function bindStars(box, onPick) {
  box.addEventListener('click', (e) => {
    const b = e.target.closest('[data-star]'); if (!b) return;
    e.stopPropagation();
    const cur = box.querySelectorAll('.star.on').length, n = +b.dataset.star;
    const v = n === cur ? 0 : n; // tap the same star again to clear
    box.querySelectorAll('.star').forEach((s, i) => { s.classList.toggle('on', i < v); s.setAttribute('aria-checked', String(i + 1 === v)); s.classList.remove('pop'); void s.offsetWidth; if (i < v) s.classList.add('pop'); });
    onPick(v);
  });
}

/* ---------- Wheel picker for time (after Kokonut UI «Wheel picker») ----------
   Two snap-scrolling drums (hours, minutes in 5s); rows curve away from the centre like a real drum. */
const ROW = 40;
function drum(values, cur) {
  return `<div class="wheel-col" tabindex="0"><div class="wheel-pad"></div>${values.map((v) => `<div class="wheel-it ${v === cur ? 'on' : ''}" data-v="${v}">${v}</div>`).join('')}<div class="wheel-pad"></div></div>`;
}
export function wheelTimeHtml(id, value) {
  return `<div class="wheel-field" data-wheel="${id}"><button type="button" class="input wheel-show">${value ? esc(value) : '<span class="muted">Без часу</span>'}</button>
    <div class="wheel" hidden><div class="wheel-band"></div>
      ${drum(Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')))}<b class="wheel-colon">:</b>${drum(Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')))}
      <div class="wheel-acts"><button type="button" class="btn sm ghost" data-wclear>Без часу</button><button type="button" class="btn sm" data-wok>Готово</button></div></div>
    <input type="hidden" id="${id}" value="${esc(value || '')}"></div>`;
}
export function bindWheel(box) {
  const show = box.querySelector('.wheel-show'), wheel = box.querySelector('.wheel'), hid = box.querySelector('input[type=hidden]');
  const cols = [...box.querySelectorAll('.wheel-col')];
  const curve = (col) => {
    const mid = col.scrollTop + col.clientHeight / 2;
    col.querySelectorAll('.wheel-it').forEach((it) => {
      const d = (it.offsetTop + ROW / 2 - mid) / ROW; // rows from the centre
      const a = Math.max(-1, Math.min(1, d / 3));
      it.style.transform = `rotateX(${(-a * 62).toFixed(1)}deg) translateZ(0)`;
      it.style.opacity = String(1 - Math.min(0.75, Math.abs(d) * 0.28));
      it.classList.toggle('on', Math.abs(d) < 0.5);
    });
  };
  const pick = (col) => col.querySelectorAll('.wheel-it')[Math.round(col.scrollTop / ROW)]?.dataset.v;
  const val = () => `${pick(cols[0])}:${pick(cols[1])}`;
  const set = (v) => { hid.value = v; show.innerHTML = v ? esc(v) : '<span class="muted">Без часу</span>'; };
  const open = () => {
    wheel.hidden = false;
    const [h, m] = (hid.value || '19:00').split(':');
    const mi = Math.round(Number(m) / 5) % 12;
    cols[0].scrollTop = Number(h) * ROW; cols[1].scrollTop = mi * ROW;
    cols.forEach(curve);
    navigator.vibrate?.(5);
  };
  let lastTick = {};
  cols.forEach((col, k) => col.addEventListener('scroll', () => {
    curve(col);
    const v = pick(col);
    if (lastTick[k] !== v) { lastTick[k] = v; navigator.vibrate?.(3); }
    if (!wheel.hidden) set(val());
  }, { passive: true }));
  show.addEventListener('click', () => (wheel.hidden ? open() : (wheel.hidden = true)));
  box.querySelector('[data-wok]').addEventListener('click', () => { set(val()); wheel.hidden = true; });
  box.querySelector('[data-wclear]').addEventListener('click', () => { set(''); wheel.hidden = true; });
}

/* ---------- Swipe deck (after DesignBookmark «Swipe deck») ----------
   cards: [{ html }]; drag the top card: right = yes, left = no. onYes(index) / onEnd(). */
export function swipeDeck(host, cards, { onYes, onEnd }) {
  let i = 0;
  host.innerHTML = `<div class="deck"></div><div class="deck-btns"><button type="button" class="deck-b no" aria-label="Ні">✕</button><button type="button" class="deck-b yes" aria-label="Так">❤</button></div>`;
  const deck = host.querySelector('.deck');
  const render = () => {
    deck.innerHTML = cards.slice(i, i + 3).map((c, k) => `<div class="deck-card" style="--k:${k};z-index:${10 - k}"><span class="deck-stamp yes">ХОЧУ</span><span class="deck-stamp no">НІ</span>${c.html}</div>`).reverse().join('');
    if (i >= cards.length) { onEnd?.(); return; }
    bind(deck.querySelector('.deck-card:last-child'));
  };
  const fly = (card, dir) => {
    card.style.transition = 'transform .35s cubic-bezier(.23,1,.32,1), opacity .35s';
    card.style.transform = `translateX(${dir * 520}px) rotate(${dir * 28}deg)`;
    card.style.opacity = '0';
    navigator.vibrate?.(dir > 0 ? 18 : 8);
    const idx = i;
    setTimeout(() => { if (dir > 0) onYes?.(idx); else { i++; render(); } }, 260);
  };
  function bind(card) {
    let x0 = 0, y0 = 0, dx = 0, dy = 0, drag = false;
    card.addEventListener('pointerdown', (e) => { drag = true; x0 = e.clientX; y0 = e.clientY; card.setPointerCapture(e.pointerId); card.style.transition = 'none'; });
    card.addEventListener('pointermove', (e) => {
      if (!drag) return;
      dx = e.clientX - x0; dy = e.clientY - y0;
      card.style.transform = `translate(${dx}px, ${dy * 0.25}px) rotate(${dx / 14}deg)`;
      card.style.setProperty('--yes', Math.max(0, Math.min(1, dx / 90)).toFixed(2));
      card.style.setProperty('--no', Math.max(0, Math.min(1, -dx / 90)).toFixed(2));
    });
    const up = () => {
      if (!drag) return; drag = false;
      if (Math.abs(dx) > 100) return fly(card, Math.sign(dx));
      card.style.transition = 'transform .45s cubic-bezier(.34,1.56,.64,1)'; card.style.transform = ''; card.style.setProperty('--yes', 0); card.style.setProperty('--no', 0);
    };
    card.addEventListener('pointerup', up); card.addEventListener('pointercancel', up);
  }
  host.querySelector('.deck-b.no').addEventListener('click', () => { const c = deck.querySelector('.deck-card:last-child'); if (c && i < cards.length) { c.style.setProperty('--no', 1); fly(c, -1); } });
  host.querySelector('.deck-b.yes').addEventListener('click', () => { const c = deck.querySelector('.deck-card:last-child'); if (c && i < cards.length) { c.style.setProperty('--yes', 1); fly(c, 1); } });
  render();
}
