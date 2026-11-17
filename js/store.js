// App state, server sync, sheets/forms and the click-handler registry.
import { esc, icon, localDate } from './ui.js';

const LS = {
  get: (k, d = null) => { try { return JSON.parse(localStorage.getItem('os.' + k)) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem('os.' + k, JSON.stringify(v)); } catch {} },
  del: (k) => { try { localStorage.removeItem('os.' + k); } catch {} },
};
export { LS };

let me = LS.get('me');
if (!me) { me = { id: (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/-/g, '').slice(0, 20), name: '' }; LS.set('me', me); }

export const S = {
  me,
  code: LS.get('code'),
  room: LS.get('room'),
  route: LS.get('route', { tab: 'me', sub: null }),
  ui: {}, // per-screen UI state (tabs, filters, drafts)
  render: () => {},
};

export const today = () => localDate();
export const partnerId = () => S.room && Object.keys(S.room.members).find((id) => id !== S.me.id);
export const partner = () => S.room?.members[partnerId()];
export const meM = () => S.room?.members[S.me.id];
export const nameOf = (id) => (id === S.me.id ? 'Ти' : S.room?.members[id]?.name || 'Партнер');
export const ui = (key, def) => (key in S.ui ? S.ui[key] : (S.ui[key] = def));

/* ---------------- numbers with thousands separators ---------------- */
// 1234567.5 → "1 234 567,5" (narrow no-break spaces between thousands)
export function fmtNum(v) {
  const [i, d] = String(v).replace('.', ',').split(',');
  const int = i.replace(/\D/g, '').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '\u202F');
  return d !== undefined ? `${int || '0'},${d.replace(/\D/g, '').slice(0, 2)}` : int;
}
export function parseNum(s) {
  const n = Number(String(s ?? '').replace(/[\s\u202F\u00A0]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}
// Live formatting while typing, keeping the cursor after the same digit.
document.addEventListener('input', (e) => {
  const el = e.target;
  if (!el.matches?.('input[data-num]')) return;
  const pos = el.selectionStart ?? el.value.length;
  const digitsBefore = el.value.slice(0, pos).replace(/[^\d,.]/g, '').length;
  const raw = el.value.replace(/[^\d,.]/g, '').replace(/\./g, ',').replace(/,(?=.*,)/g, '');
  const out = raw === '' ? '' : fmtNum(raw);
  el.value = out;
  let seen = 0, caret = out.length;
  for (let k = 0; k < out.length; k++) { if (/[\d,]/.test(out[k])) seen++; if (seen === digitsBefore) { caret = k + 1; break; } }
  if (digitsBefore === 0) caret = 0;
  try { el.setSelectionRange(caret, caret); } catch {}
});

/* ---------------- toast ---------------- */
let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ---------------- api ---------------- */
async function call(method, body, query = '', path = '/api/state') {
  const res = await fetch(path + query, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error === 'not_configured' ? 'Сервер ще не підключено до бази даних' : data.error || 'Немає звʼязку з сервером');
    err.status = res.status;
    err.code = data.error;
    throw err;
  }
  return data;
}

export function setRoom(r) {
  S.room = r;
  S.code = r.code;
  LS.set('room', r);
  LS.set('code', r.code);
}

export async function create(name) {
  const r = await call('POST', { create: true, today: today(), member: { id: S.me.id }, action: { name } });
  setRoom(r);
}
export async function join(code, name) {
  const r = await call('POST', { code, today: today(), member: { id: S.me.id }, action: { type: 'join', name } });
  setRoom(r);
}

export async function peek(code) {
  return call('GET', null, `?code=${encodeURIComponent(code)}&peek=1`);
}
// Become an existing member of the pair on this device (Safari vs home-screen app keep separate storage).
export async function signInAs(code, member) {
  S.me = { id: member.id, name: member.name };
  LS.set('me', S.me);
  const r = await call('GET', null, `?code=${encodeURIComponent(code)}&member=${encodeURIComponent(member.id)}&today=${today()}`);
  setRoom(r);
}

function adopt(r) {
  S.me = { id: r.member.id, name: r.member.name };
  LS.set('me', S.me);
  setRoom(r.room);
}
export async function login(loginName, password) {
  adopt(await call('POST', { op: 'login', login: loginName, password, today: today() }, '', '/api/auth'));
}
export async function claim(code, slot, password) {
  adopt(await call('POST', { op: 'claim', code, slot, password, today: today() }, '', '/api/auth'));
}
export async function checkLogin(loginName) {
  const r = await call('POST', { op: 'check', login: loginName }, '', '/api/auth');
  if (!r.ok) throw new Error(r.error);
}
export async function register(loginName, password) {
  const r = await call('POST', { op: 'register', code: S.code, member: S.me.id, login: loginName, password, today: today() }, '', '/api/auth');
  setRoom(r.room);
  return r.login;
}

export async function act(action, { silent = false, render = true } = {}) {
  if (!S.code) return false;
  try {
    const r = await call('POST', { code: S.code, today: today(), member: { id: S.me.id }, action });
    setRoom(r);
    if (render) S.render();
    return true;
  } catch (e) {
    if (!silent) toast(e.message);
    return false;
  }
}

let refreshing = false;
export async function refresh(force = false) {
  if (!S.code || refreshing) return;
  refreshing = true;
  try {
    const q = `?code=${encodeURIComponent(S.code)}&member=${encodeURIComponent(S.me.id)}&today=${today()}${S.room && !force ? `&rev=${S.room.rev}` : ''}`;
    const r = await call('GET', null, q);
    if (r.unchanged) return;
    setRoom(r);
    if (!isBusy()) S.render();
  } catch (e) {
    if (e.status === 404 || e.code === 'not_member') { leave(); toast(e.status === 404 ? 'Пару не знайдено' : 'Тебе немає в цій парі'); }
  } finally { refreshing = false; }
}
const isBusy = () => !!document.querySelector('.sheet-bg') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

export function leave() {
  S.code = null; S.room = null;
  LS.del('code'); LS.del('room');
  closeSheet();
  S.render();
}

export function go(tab, sub = null) {
  S.route = { tab, sub };
  LS.set('route', S.route);
  closeSheet();
  S.render();
  window.scrollTo(0, 0);
}

/* ---------------- handlers ---------------- */
export const H = {};
export const on = (name, fn) => { H[name] = fn; };

/* ---------------- sheets ---------------- */
let sheetCleanup = null;
// Every sheet has a close button (✕) that stays even when its content is replaced.
export function openSheet(html, mount, { closeBtn = true } = {}) {
  closeSheet();
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${closeBtn ? `<button class="sheet-x" type="button" aria-label="Закрити">${icon('x', 18)}</button>` : ''}<div class="sheet-body"><div class="grab"></div>${html}</div></div>`;
  bg.addEventListener('click', (e) => { if (e.target === bg) closeSheet(); });
  bg.querySelector('.sheet-x')?.addEventListener('click', closeSheet);
  document.body.appendChild(bg);
  document.body.classList.add('noscroll');
  const body = bg.querySelector('.sheet-body');
  sheetCleanup = mount?.(body) || null;
  return body;
}
export function closeSheet() {
  const bg = document.querySelector('.sheet-bg');
  if (!bg) return;
  if (typeof sheetCleanup === 'function') sheetCleanup();
  sheetCleanup = null;
  bg.remove();
  document.body.classList.remove('noscroll');
}

/*
  openForm({ title, fields: [{ key, label, type, value, options, placeholder, required }], submitText,
             onSubmit: async (values) => boolean, onDelete?: async () => boolean })
  types: text | textarea | number | date | time | select | check | lines | seg
*/
export function openForm(cfg) {
  const field = (f) => {
    const v = f.value ?? '';
    const id = 'f-' + f.key;
    const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : '';
    let input;
    switch (f.type) {
      case 'textarea': input = `<textarea class="input" id="${id}" rows="${f.rows || 3}"${ph} maxlength="${f.max || 600}">${esc(v)}</textarea>`; break;
      case 'lines': input = `<textarea class="input" id="${id}" rows="${f.rows || 4}"${ph}>${esc(Array.isArray(v) ? v.join('\n') : v)}</textarea>`; break;
      case 'select': input = `<select class="input" id="${id}">${f.options.map(([val, lab]) => `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`).join('')}</select>`; break;
      case 'seg': input = `<div class="seg" data-seg="${f.key}">${f.options.map(([val, lab]) => `<button type="button" class="seg-b ${String(val) === String(v) ? 'on' : ''}" data-v="${esc(val)}">${lab}</button>`).join('')}</div><input type="hidden" id="${id}" value="${esc(v)}">`; break;
      case 'check': return `<label class="check-row"><input type="checkbox" id="${id}" ${v ? 'checked' : ''}><span>${esc(f.label)}</span></label>`;
      case 'number': input = `<input class="input num-input" id="${id}" type="text" inputmode="decimal" data-num autocomplete="off" value="${esc(v === '' || v == null ? '' : fmtNum(v))}"${ph}>`; break;
      case 'date': case 'time': input = `<input class="input" id="${id}" type="${f.type}" value="${esc(v)}">`; break;
      default: input = `<input class="input" id="${id}" type="text" maxlength="${f.max || 120}" value="${esc(v)}"${ph}>`;
    }
    return `<label class="field"><span>${esc(f.label)}${f.required ? ' *' : ''}</span>${input}</label>`;
  };
  const sheet = openSheet(`
    <div class="sheet-h"><h3>${esc(cfg.title)}</h3><button class="icon-btn sm" data-close>${icon('x', 18)}</button></div>
    ${cfg.intro ? `<p class="muted small" style="margin:-4px 0 14px">${esc(cfg.intro)}</p>` : ''}
    <form class="form" novalidate>
      ${cfg.fields.map(field).join('')}
      <button class="btn block" type="submit">${esc(cfg.submitText || 'Зберегти')}</button>
      ${cfg.onDelete ? `<button class="btn danger block" type="button" data-del>${icon('trash', 18)} Видалити</button>` : ''}
    </form>`, (el) => {
    el.querySelector('[data-close]').onclick = closeSheet;
    el.querySelectorAll('[data-seg]').forEach((seg) => seg.addEventListener('click', (e) => {
      const b = e.target.closest('.seg-b');
      if (!b) return;
      seg.querySelectorAll('.seg-b').forEach((x) => x.classList.toggle('on', x === b));
      el.querySelector('#f-' + seg.dataset.seg).value = b.dataset.v;
    }));
    const form = el.querySelector('form');
    let sending = false;
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (sending) return;
      const vals = {};
      for (const f of cfg.fields) {
        const inp = el.querySelector('#f-' + f.key);
        if (f.type === 'check') vals[f.key] = inp.checked;
        else if (f.type === 'number') vals[f.key] = inp.value.trim() === '' ? null : parseNum(inp.value);
        else if (f.type === 'lines') vals[f.key] = inp.value.split('\n').map((x) => x.trim()).filter(Boolean);
        else vals[f.key] = inp.value.trim();
        if (f.required && (vals[f.key] === '' || vals[f.key] === null)) { toast(`Заповни поле «${f.label}»`); inp.focus(); return; }
      }
      sending = true;
      try { if (await cfg.onSubmit(vals)) closeSheet(); } finally { sending = false; }
    };
    const del = el.querySelector('[data-del]');
    if (del) del.onclick = async () => { if (confirm('Точно видалити?') && (await cfg.onDelete())) closeSheet(); };
    const first = el.querySelector('input:not([type=hidden]):not([type=checkbox]),textarea');
    if (first && !cfg.noFocus && !/iPhone|iPad/.test(navigator.userAgent)) first.focus();
  }, { closeBtn: false });
  return sheet;
}
