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
async function call(method, body, query = '') {
  const res = await fetch('/api/state' + query, {
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
export function openSheet(html, mount) {
  closeSheet();
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  bg.addEventListener('click', (e) => { if (e.target === bg) closeSheet(); });
  document.body.appendChild(bg);
  document.body.classList.add('noscroll');
  sheetCleanup = mount?.(bg.querySelector('.sheet')) || null;
  return bg.querySelector('.sheet');
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
      case 'number': input = `<input class="input" id="${id}" type="number" inputmode="decimal" step="any" value="${esc(v)}"${ph}>`; break;
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
        else if (f.type === 'number') vals[f.key] = inp.value === '' ? null : Number(inp.value);
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
  });
  return sheet;
}
