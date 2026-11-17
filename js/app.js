import { S, H, on, go, create, join, toast, refresh, partnerId, partner, meM, LS } from './store.js';
import { esc, icon, avatar, otter } from './ui.js';
import { meView } from './views/me.js';
import { placesView } from './views/places.js';
import { homeView, addShop } from './views/home.js';
import { wishView } from './views/wish.js';
import { moreView, applyTheme, onAvatarFile } from './views/more.js';

const app = document.getElementById('app');
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

/* ---------------- welcome ---------------- */
function welcomeView() {
  const mode = S.ui.welcome || 'start';
  return `<div class="welcome">
    <div class="welcome-art">${otter({ face: 'love', pose: 'wave', water: true, size: 170, bob: true, color: 'green' })}</div>
    <h1 class="logo big">Хамелеончики<i class="logo-h">${icon('heart', 22)}</i></h1>
    <p class="lead">Твій затишний куточок для двох</p>
    <label class="field"><span>Як тебе звати?</span><input class="input" id="w-name" maxlength="30" autocomplete="given-name" value="${esc(S.me.name)}" placeholder="Наприклад, Юлія"></label>
    ${mode === 'join' ? `
      <label class="field"><span>Код від твоєї пари</span><input class="input code-input" id="w-code" maxlength="6" autocapitalize="characters" autocomplete="off" placeholder="ABC123"></label>
      <button class="btn block" data-a="wJoin">Приєднатися ❤️</button>
      <button class="btn ghost block" data-a="wMode" data-v="start">Назад</button>`
    : `
      <button class="btn block" data-a="wCreate">Створити нашу пару</button>
      <button class="btn secondary block" data-a="wMode" data-v="join">У мене є код від пари</button>`}
    <p class="muted small center mt">Місця й побачення, спільні покупки, вішліст, подорожі, скарбнички та хамелеон, що змінює колір під ваш настрій — на двох.</p>
  </div>`;
}
on('wMode', (el) => { S.me.name = nameVal(); S.ui.welcome = el.dataset.v; render(); });
const nameVal = () => document.getElementById('w-name')?.value.trim() || '';
on('wCreate', async (el) => {
  const name = nameVal();
  if (!name) return toast('Спершу введи своє імʼя');
  el.disabled = true;
  try { S.me.name = name; LS.set('me', S.me); await create(name); go('me'); toast('Пару створено! Запроси свою половинку 💌'); }
  catch (e) { toast(e.message); el.disabled = false; }
});
on('wJoin', async (el) => {
  const name = nameVal();
  const code = (document.getElementById('w-code')?.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!name) return toast('Спершу введи своє імʼя');
  if (code.length !== 6) return toast('Код має складатися з 6 символів');
  el.disabled = true;
  try { S.me.name = name; LS.set('me', S.me); await join(code, name); go('me'); toast('Ви разом! ❤️'); }
  catch (e) { toast(e.message); el.disabled = false; }
});

/* ---------------- shell ---------------- */
const TABS = [
  ['places', 'pin', 'Місця'],
  ['home', 'home', 'Дім'],
  ['me', 'heart', 'Ми'],
  ['wish', 'sparkle', 'Вішліст'],
  ['more', 'dots', 'Ще'],
];

function header() {
  const pid = partnerId();
  return `<header class="topbar">
    <h1 class="logo">Хамелеончики<i class="logo-h">${icon('heart', 14)}</i></h1>
    <button class="ava-stack" data-a="settings" aria-label="Профіль">${avatar(meM(), S.me.id, 44)}${pid ? avatar(partner(), pid, 44) : ''}</button>
    <button class="icon-btn" data-a="settings" aria-label="Налаштування">${icon('gear', 22)}</button>
  </header>`;
}

function nav() {
  const seen = LS.get('seenNotes', 0);
  const fresh = S.room.notes.some((n) => n.from !== S.me.id && n.ts > seen);
  return `<nav class="tabbar"><div class="tabbar-in">${TABS.map(([k, ic, l]) => k === 'me'
    ? `<button class="tab-me ${S.route.tab === 'me' ? 'on' : ''}" data-a="tab" data-t="me" aria-label="${l}"><span class="tab-me-c">${icon(ic, 30)}</span><span class="tab-l">${l}</span></button>`
    : `<button class="tab ${S.route.tab === k ? 'on' : ''}" data-a="tab" data-t="${k}"><span class="tab-ic">${icon(ic, 24)}</span><span class="tab-l">${l}</span>${k === 'more' && fresh ? '<i class="dot"></i>' : ''}</button>`).join('')}</div></nav>`;
}
on('tab', (el) => go(el.dataset.t));

function render() {
  if (!S.code || !S.room) { app.innerHTML = welcomeView(); return; }
  const focused = document.activeElement;
  const fid = focused?.id, sel = [focused?.selectionStart, focused?.selectionEnd];
  const y = window.scrollY;
  const { tab, sub } = S.route;
  const body = tab === 'places' ? placesView() : tab === 'home' ? homeView() : tab === 'wish' ? wishView() : tab === 'more' ? moreView(sub) : meView();
  app.innerHTML = `${header()}<main class="screen">${body}</main>${nav()}`;
  window.scrollTo(0, y);
  if (fid) {
    const el = document.getElementById(fid);
    if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(sel[0], sel[1]); } catch {} }
  }
}
S.render = render;

/* ---------------- events ---------------- */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el || el.disabled) return;
  const fn = H[el.dataset.a];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  if (form.dataset.form === 'shop') {
    const inp = form.querySelector('input');
    const text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    await addShop(text);
    document.getElementById('shop-in')?.focus();
    return;
  }
  H['form:' + form.dataset.form]?.(form);
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'place-q') { S.ui.placeQ = e.target.value; render(); }
  if (e.target.id === 'w-code') e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'ava-file') onAvatarFile(e.target.files[0]);
});

/* ---------------- boot ---------------- */
render();
refresh(true);
setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 4000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
// Re-render once a minute so "today", timers and sealed notes stay current.
setInterval(() => { if (document.visibilityState === 'visible' && !document.querySelector('.sheet-bg')) refresh(true); }, 60000);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
