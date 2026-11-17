// «Шептунчик» — AI helper available on every screen.
import { S, on, act, openSheet, closeSheet, toast, partnerId, partner, today } from './store.js';
import { esc, icon, whisperer, fmtDate } from './ui.js';

const CHIPS = [
  'Сплануй нам побачення на вихідні 💞',
  'Що в нас цього тижня?',
  'Нагадай завтра о 9 купити квіти',
  'Що приготувати на вечерю? Додай продукти',
  'Ідея подарунка для пари 🎁',
];
const CAT = { cafe: '☕', restaurant: '🍽️', bar: '🍸', park: '🌳', museum: '🏛️', cinema: '🎬', nature: '🏞️', active: '⚡', home: '🏠', other: '📍' };
const day = (d) => (d === today() ? 'сьогодні' : fmtDate(d, { weekday: true }));
const whoName = (w) => (w === 'me' ? 'тобі' : w === 'partner' ? (partner()?.name || 'парі') : 'обом');

function label(a) {
  switch (a.type) {
    case 'event': return [a.kind === 'date' ? '💞' : '📅', a.title, `${day(a.date)}${a.time ? ' о ' + a.time : ''}`];
    case 'reminder': return ['⏰', a.title, `${day(a.date)} о ${a.time} · ${whoName(a.who)}`];
    case 'shop': return ['🛒', `${a.cat === 'other' ? 'Покупки' : 'Продукти'}: ${a.items.length}`, a.items.map((i) => `${i.text} (${i.qty})`).join(', ')];
    case 'place': return [CAT[a.cat] || '📍', a.name, a.date ? `${day(a.date)}${a.time ? ' о ' + a.time : ''}` : 'у список місць'];
    case 'blind': return ['🎭', 'Побачення наосліп', `${day(a.date)}${a.time ? ' о ' + a.time : ''}${a.meet ? ' · ' + (/^https?:/i.test(a.meet) ? 'місце на мапі' : a.meet) : ''}${a.dress ? ' · ' + a.dress : ''}`];
    case 'chore': return ['🧹', a.text, `${{ none: 'один раз', daily: 'щодня', weekly: 'щотижня', monthly: 'щомісяця' }[a.repeat]}${a.who !== 'none' ? ' · ' + whoName(a.who) : ''}`];
    case 'gift': return ['🎁', a.title, `у мій вішліст${a.price ? ' · ' + a.price : ''}`];
    case 'watch': return ['🎬', a.title, 'подивитися'];
    case 'dream': return ['✨', a.title, 'спільна мрія'];
    case 'important': return ['🎉', a.title, `${fmtDate(a.date)}${a.yearly ? ' · щороку' : ''}`];
    case 'note': return ['💌', 'Записка', a.text];
    default: return ['•', a.type, ''];
  }
}

async function apply(a) {
  const pid = partnerId();
  const who = (w) => (w === 'me' ? S.me.id : w === 'partner' ? pid || null : null);
  const add = (col, item) => act({ type: 'add', col, item }, { render: false });
  switch (a.type) {
    case 'event': return add('events', { title: a.title, date: a.date, time: a.time || null, kind: a.kind, note: a.note });
    case 'reminder': return add('events', { title: a.title, date: a.date, time: a.time, kind: 'reminder', who: who(a.who) });
    case 'shop': {
      const fresh = !S.room.shopping.some((x) => x.cat === a.cat && !x.done);
      return act({ type: 'shopList', cat: a.cat, items: a.items, fresh }, { render: false });
    }
    case 'place': return add('places', { name: a.name, cat: a.cat, address: a.address, note: a.note, mode: a.date ? 'plan' : 'spont', date: a.date || null, time: a.time || null });
    case 'blind': return add('blind', { date: a.date, time: a.time || null, meet: a.meet, hint: a.hint, dress: a.dress, details: a.details });
    case 'chore': return add('chores', { text: a.text, repeat: a.repeat, who: who(a.who) });
    case 'gift': return add('gifts', { title: a.title, note: a.note, price: a.price, owner: S.me.id });
    case 'watch': return add('watch', { title: a.title, kind: a.kind });
    case 'dream': return add('dreams', { title: a.title, note: a.note });
    case 'important': return add('dates', { title: a.title, date: a.date, yearly: a.yearly });
    case 'note': return act({ type: 'note', text: a.text }, { render: false });
    default: return false;
  }
}

const chat = () => (S.ui.whisper ||= []);

function msgHtml(m, i) {
  if (m.role === 'user') return `<div class="wh-msg me">${esc(m.text)}</div>`;
  if (m.role === 'err') return `<div class="wh-msg bot err">${esc(m.text)}</div>`;
  const acts = m.actions || [];
  return `<div class="wh-row">${whisperer(30)}<div class="wh-msg bot">${esc(m.text)}
    ${acts.length ? `<div class="wh-acts" data-m="${i}">${acts.map((a, j) => { const [e, t, sub] = label(a); return `<label class="wh-act ${m.done ? 'done' : ''}">
      <input type="checkbox" data-j="${j}" ${m.done ? 'disabled' : ''} ${a.off ? '' : 'checked'}><span class="wh-e">${e}</span><span class="grow"><b>${esc(t)}</b>${sub ? `<br><span class="muted small">${esc(sub)}</span>` : ''}</span></label>`; }).join('')}
      ${m.done ? `<div class="small ok-t mt-s">${icon('check', 14)} ${esc(m.done)}</div>` : `<div class="row gap mt-s"><button class="btn sm" data-apply="${i}">${icon('check', 16)} ${acts.length > 1 ? 'Додати вибране' : 'Додати'}</button><button class="btn sm ghost" data-skip="${i}">Не треба</button></div>`}</div>` : ''}
  </div></div>`;
}

function draw(sh, thinking = false) {
  const list = chat();
  const log = sh.querySelector('.wh-log');
  log.innerHTML = list.length ? list.map(msgHtml).join('') + (thinking ? `<div class="wh-row">${whisperer(30)}<div class="wh-msg bot typing"><i></i><i></i><i></i></div></div>` : '')
    : `<div class="wh-hello">${whisperer(92)}<p><b>Привіт, я Шептунчик!</b></p><p class="muted small">Скажи звичайними словами — я додам у календар, покупки чи нагадування. Без твого «так» нічого не змінюю.</p>
      <div class="wh-chips">${CHIPS.map((c) => `<button class="chip-btn" data-chip="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>`;
  log.scrollTop = log.scrollHeight;
}

async function send(sh, text) {
  text = text.trim();
  if (!text) return;
  const list = chat();
  const history = list.filter((m) => m.role === 'user' || m.role === 'bot').slice(-6).map((m) => ({ role: m.role === 'bot' ? 'model' : 'user', text: m.role === 'bot' ? JSON.stringify({ reply: m.text, actions: m.actions || [] }) : m.text }));
  list.push({ role: 'user', text });
  draw(sh, true);
  try {
    const res = await fetch('/api/whisper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: S.code, member: S.me.id, text, history }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) list.push({ role: 'err', text: data.error || 'Немає звʼязку з Шептунчиком.' });
    else list.push({ role: 'bot', text: data.reply, actions: data.actions || [] });
  } catch { list.push({ role: 'err', text: 'Немає інтернету 🙈' }); }
  if (sh.isConnected) draw(sh);
}

export function openWhisper(prefill = '') {
  const sh = openSheet(`<div class="wh-head">${whisperer(40)}<div class="grow"><b>Шептунчик</b><div class="muted small">твій помічник по всьому застосунку</div></div>
      ${chat().length ? `<button class="icon-btn sm ghost" data-clear aria-label="Почати спочатку">${icon('trash', 16)}</button>` : ''}</div>
    <div class="wh-log"></div>
    <form class="wh-input"><input id="wh-in" placeholder="Наприклад: у суботу о 19 кіно" maxlength="800" autocomplete="off" enterkeyhint="send" value="${esc(prefill)}"><button class="icon-btn" type="submit" aria-label="Надіслати">${icon('send', 20)}</button></form>`);
  sh.closest('.sheet')?.classList.add('wh-sheet');
  draw(sh);
  const inp = sh.querySelector('#wh-in');
  sh.querySelector('.wh-input').onsubmit = (e) => { e.preventDefault(); const t = inp.value; inp.value = ''; send(sh, t); };
  sh.querySelector('[data-clear]')?.addEventListener('click', () => { S.ui.whisper = []; draw(sh); });
  sh.querySelector('.wh-log').addEventListener('click', async (e) => {
    const chip = e.target.closest('[data-chip]');
    if (chip) return send(sh, chip.dataset.chip);
    const skip = e.target.closest('[data-skip]');
    if (skip) { chat()[+skip.dataset.skip].done = 'Добре, нічого не додаю'; return draw(sh); }
    const ap = e.target.closest('[data-apply]');
    if (!ap) return;
    const m = chat()[+ap.dataset.apply];
    const boxes = [...sh.querySelectorAll(`.wh-acts[data-m="${ap.dataset.apply}"] input`)];
    const chosen = m.actions.filter((_, j) => boxes[j]?.checked);
    if (!chosen.length) return toast('Обери хоча б одну дію');
    ap.disabled = true;
    let ok = 0;
    for (const a of chosen) if (await apply(a)) ok++;
    S.render();
    m.done = ok === chosen.length ? `Готово! Додано: ${ok}` : `Додано ${ok} з ${chosen.length}`;
    if (chosen.some((a) => ['event', 'blind', 'place'].includes(a.type) && a.time)) m.done += ' · нагадаю напередодні й за 2 год 🤫';
    draw(sh);
  });
  if (prefill) send(sh, prefill), (inp.value = '');
  else if (!/iPhone|iPad/.test(navigator.userAgent)) inp.focus();
}

on('whisper', () => openWhisper());
export const whisperFab = () => `<button class="wh-fab" data-a="whisper" aria-label="Шептунчик — помічник">${whisperer(42)}</button>`;
