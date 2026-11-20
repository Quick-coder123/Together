import { S, H, on, go, create, join, toast, refresh, partnerId, partner, meM, LS, peek, signInAs, login, claim, register, checkLogin, openForm } from './store.js';
import { transitionFor } from './gestures.js';
import { liveSync, liveOn } from './live.js';
import { tilt } from './motion.js';
import { esc, icon, avatar, otter } from './ui.js';
import { meView } from './views/me.js';
import { placesView } from './views/places.js';
import { homeView, addShop } from './views/home.js';
import { whisperFab } from './whisper.js';
import { badgeToast } from './views/me.js';
import { petMount } from './petlive.js';
import { wishView } from './views/wish.js';
import { moreView, applyTheme, onAvatarFile } from './views/more.js';
import { pushState, resyncPush } from './push.js';

const app = document.getElementById('app');
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

/* ---------------- welcome ---------------- */
const credFields = (namePh = 'Наприклад, Віталій', withName = true) => `
  ${withName ? `<label class="field"><span>Як тебе звати?</span><input class="input" id="w-name" maxlength="30" autocomplete="given-name" value="${esc(S.me.name)}" placeholder="${namePh}"></label>` : ''}
  <label class="field"><span>Придумай логін</span><input class="input" id="w-login" maxlength="32" autocapitalize="none" autocomplete="username" spellcheck="false" placeholder="vitalik"></label>
  <label class="field"><span>Придумай пароль (від 4 символів)</span><input class="input" id="w-pass" type="password" maxlength="100" autocomplete="new-password"></label>`;

function welcomeView() {
  const mode = S.ui.welcome || 'start';
  const head = `<div class="welcome-art">${otter({ face: 'love', pose: 'wave', water: true, size: 150, bob: true, color: 'green' })}</div>
    <h1 class="logo big">Хамелеончики<i class="logo-h">${icon('heart', 22)}</i></h1>
    <p class="lead">Твій затишний куточок для двох</p>`;
  const back = (to = 'start') => `<button class="btn ghost block" data-a="wMode" data-v="${to}">Назад</button>`;
  if (mode === 'create') {
    return `<div class="welcome">${head}<h3 class="h3 center">Нова пара</h3>${credFields()}
      <button class="btn block" data-a="wCreate">Створити пару</button>${back()}
      <p class="muted small center mt">З цим логіном і паролем ти зайдеш у вашу пару з будь-якого телефона чи компʼютера.</p></div>`;
  }
  if (mode === 'join') {
    return `<div class="welcome">${head}
      <label class="field"><span>Код вашої пари</span><input class="input code-input" id="w-code" maxlength="6" autocapitalize="characters" autocomplete="off" placeholder="ABC123" value="${esc(S.ui.wCode || '')}"></label>
      <button class="btn block" data-a="wPeek">Далі</button>${back()}
      <p class="muted small center mt">Код є в «Ще → Налаштування → Код пари» у твоєї половинки.</p></div>`;
  }
  if (mode === 'pick') {
    const p = S.ui.wPeek;
    const free = p.members.length < 2;
    const sel = S.ui.wSlot;
    return `<div class="welcome">${head}
      <h3 class="h3 center">Хто ти в цій парі?</h3>
      <div class="pick-list">${p.members.map((m) => `<button class="pick ${sel === m.slot ? 'on' : ''}" data-a="wPick" data-slot="${m.slot}">${avatar(m, m.id || String(m.slot), 44)}<span class="grow"><b>Це я — ${esc(m.name)}</b><br><span class="muted small">${m.login ? '🔒 Захищено паролем' : 'Увійти з цього пристрою'}</span></span>${icon('chev', 18)}</button>
        ${sel === m.slot && m.login ? `<div class="pick-pass"><input class="input" id="w-pass" type="password" placeholder="Пароль" autocomplete="current-password"><button class="btn" data-a="wClaim">Увійти</button></div>` : ''}`).join('')}</div>
      ${free ? `<div class="divider-t">або я — друга половинка</div>${credFields('Наприклад, Юлія')}
        <button class="btn secondary block" data-a="wJoin">Приєднатися ❤️</button>` : ''}
      ${back('join')}</div>`;
  }
  return `<div class="welcome">${head}
    <label class="field"><span>Логін</span><input class="input" id="w-login" maxlength="32" autocapitalize="none" autocomplete="username" spellcheck="false"></label>
    <label class="field"><span>Пароль</span><input class="input" id="w-pass" type="password" maxlength="100" autocomplete="current-password"></label>
    <button class="btn block" data-a="wLogin">Увійти</button>
    <div class="divider-t">ще немає акаунта?</div>
    <div class="grid2"><button class="btn secondary" data-a="wMode" data-v="create">Нова пара</button><button class="btn secondary" data-a="wMode" data-v="join">Є код пари</button></div>
    <p class="muted small center mt">Входь з будь-якого пристрою — усі ваші дані зберігаються на сервері.</p>
  </div>`;
}
const val = (id) => document.getElementById(id)?.value.trim() || '';
const codeVal = () => val('w-code').toUpperCase().replace(/[^A-Z0-9]/g, '');
async function busyBtn(el, fn) { el.disabled = true; try { await fn(); } catch (e) { toast(e.message); } finally { el.disabled = false; } }
function creds() {
  const name = val('w-name'), lg = val('w-login').toLowerCase(), pw = document.getElementById('w-pass')?.value || '';
  if (document.getElementById('w-name') && !name) throw new Error('Введи своє імʼя');
  if (lg.length < 3) throw new Error('Логін — щонайменше 3 символи');
  if (pw.length < 4) throw new Error('Пароль — щонайменше 4 символи');
  return { name, lg, pw };
}
on('wMode', (el) => { if (document.getElementById('w-name')) S.me.name = val('w-name'); S.ui.welcome = el.dataset.v; S.ui.wSlot = null; render(); });
on('wLogin', (el) => busyBtn(el, async () => {
  const lg = val('w-login'), pw = document.getElementById('w-pass')?.value || '';
  if (!lg || !pw) throw new Error('Введи логін і пароль');
  await login(lg, pw); go('me'); toast(`Привіт, ${S.me.name}! 💚`);
}));
on('wCreate', (el) => busyBtn(el, async () => {
  const { name, lg, pw } = creds();
  await checkLogin(lg);
  S.me.name = name; LS.set('me', S.me);
  await create(name);
  await register(lg, pw);
  go('me'); toast('Пару створено! 💌');
}));
on('wPeek', (el) => busyBtn(el, async () => {
  const code = codeVal();
  if (code.length !== 6) throw new Error('Код має складатися з 6 символів');
  S.ui.wCode = code; S.ui.wPeek = await peek(code); S.ui.wSlot = null; S.ui.welcome = 'pick'; render();
}));
on('wPick', (el) => {
  const m = S.ui.wPeek.members[+el.dataset.slot];
  if (m.login) { S.ui.wSlot = m.slot; render(); document.getElementById('w-pass')?.focus(); return; }
  busyBtn(el, async () => {
    await signInAs(S.ui.wCode, m); S.ui.welcome = 'start'; go('me');
    setTimeout(() => loginSetup(true), 400);
  });
});
on('wClaim', (el) => busyBtn(el, async () => {
  const pw = document.getElementById('w-pass')?.value || '';
  if (!pw) throw new Error('Введи пароль');
  await claim(S.ui.wCode, S.ui.wSlot, pw); S.ui.welcome = 'start'; go('me'); toast(`Привіт, ${S.me.name}! 💚`);
}));
on('wJoin', (el) => busyBtn(el, async () => {
  const { name, lg, pw } = creds();
  await checkLogin(lg);
  S.me.name = name; LS.set('me', S.me);
  await join(S.ui.wCode, name);
  await register(lg, pw);
  S.ui.welcome = 'start'; go('me'); toast('Ви разом! ❤️');
}));

// Set (or change) login + password for the current profile.
export function loginSetup(first = false) {
  const cur = meM()?.login;
  openForm({
    title: cur ? 'Змінити логін чи пароль' : 'Вхід з будь-якого пристрою',
    intro: cur ? `Зараз твій логін: ${cur}` : first ? 'Створи логін і пароль — і більше не доведеться вводити код пари. Профіль буде захищено.' : 'З логіном і паролем ти зайдеш у пару з будь-якого телефона чи компʼютера.',
    fields: [
      { key: 'login', label: 'Логін', value: cur || '', max: 32, required: true, placeholder: 'vitalik' },
      { key: 'password', label: cur ? 'Новий пароль' : 'Пароль (від 4 символів)', required: true },
    ],
    submitText: 'Зберегти',
    onSubmit: async (v) => {
      if (v.password.length < 4) { toast('Пароль — щонайменше 4 символи'); return false; }
      try { const l = await register(v.login.toLowerCase(), v.password); S.render(); toast(`Готово! Логін: ${l}`); return true; }
      catch (e) { toast(e.message); return false; }
    },
  });
  const pw = document.getElementById('f-password');
  if (pw) { pw.type = 'password'; pw.autocomplete = 'new-password'; }
  const lg = document.getElementById('f-login');
  if (lg) { lg.autocapitalize = 'none'; lg.spellcheck = false; lg.autocomplete = 'username'; }
}
on('loginSetup', () => loginSetup());

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

let lastRoute = '';
function render() {
  if (!S.code || !S.room) { app.innerHTML = welcomeView(); return; }
  const focused = document.activeElement;
  const fid = focused?.id, sel = [focused?.selectionStart, focused?.selectionEnd];
  const y = window.scrollY;
  const { tab, sub } = S.route;
  const body = tab === 'places' ? placesView() : tab === 'home' ? homeView() : tab === 'wish' ? wishView() : tab === 'more' ? moreView(sub) : meView();
  const routeKey = tab + '/' + (sub || '');
  const changed = routeKey !== lastRoute;
  lastRoute = routeKey;
  const dir = transitionFor(S.route);
  app.innerHTML = `${header()}<main class="screen${changed ? ' anim ' + dir : ''}">${body}</main>${whisperFab()}${nav()}`;
  window.scrollTo(0, y);
  petMount();
  liveSync();
  document.querySelectorAll('[data-tilt]').forEach((el) => tilt(el));
  if (!document.querySelector('.sheet-bg')) badgeToast();
  if (fid) {
    const el = document.getElementById(fid);
    if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(sel[0], sel[1]); } catch {} }
  }
}
S.render = render;

/* ---------------- events ---------------- */
document.addEventListener('click', (e) => {
  if (e.target.closest('a[href]')) return; // real links (maps, sources) open normally
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
  if (e.target.id === 'w-code') { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); S.ui.wCode = e.target.value; }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'ava-file') onAvatarFile(e.target.files[0]);
});

/* ---------------- boot ---------------- */
async function checkPush() {
  try { S.ui.pushState = await pushState(); } catch { S.ui.pushState = 'unsupported'; }
  if (S.code) S.render();
}
render();
checkPush();
resyncPush();
navigator.serviceWorker?.addEventListener('message', (e) => { if (e.data?.type === 'refresh') refresh(true); });
refresh(true);
// With live updates connected, the partner's changes arrive instantly — poll rarely; otherwise every 4 s.
let lastPoll = 0;
setInterval(() => { if (document.visibilityState !== 'visible') return; if (liveOn() && Date.now() - lastPoll < 30000) return; lastPoll = Date.now(); refresh(); }, 4000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
// Re-render once a minute so "today", timers and sealed notes stay current.
setInterval(() => { if (document.visibilityState === 'visible' && !document.querySelector('.sheet-bg')) refresh(true); }, 60000);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
