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
const whoName = (w) => (w === 'me' ? 'тільки тобі 🔒' : w === 'partner' ? (partner()?.name || 'парі') : 'обом');

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
  if (m.role === 'user') return `<div class="wh-msg me ${m.voice ? 'voice' : ''}">${m.voice ? '🎤 ' : ''}${esc(m.text)}</div>`;
  if (m.role === 'err') return `<div class="wh-msg bot err">${esc(m.text)}</div>`;
  const acts = m.actions || [];
  return `<div class="wh-row">${whisperer(30)}<div class="wh-msg bot">${esc(m.text)}
    ${acts.length ? `<div class="wh-acts" data-m="${i}">${acts.map((a, j) => { const [e, t, sub] = label(a); return `<label class="wh-act ${m.done ? 'done' : ''}">
      <input type="checkbox" data-j="${j}" ${m.done ? 'disabled' : ''} ${a.off ? '' : 'checked'}><span class="wh-e">${e}</span><span class="grow"><b>${esc(t)}</b>${sub ? `<br><span class="muted small">${esc(sub)}</span>` : ''}</span></label>`; }).join('')}
      ${m.done ? `<div class="small ok-t mt-s">${icon('check', 14)} ${esc(m.done)}</div>`
        : m.autoAt ? `<div class="row gap mt-s"><button class="btn sm" data-apply="${i}">${icon('check', 16)} Зробити зараз</button><button class="btn sm ghost" data-skip="${i}">Скасувати</button></div><div class="small muted mt-s wh-auto" data-auto="${i}">Виконаю сам за <b>${Math.max(0, Math.ceil((m.autoAt - Date.now()) / 1000))}</b> с…</div>`
        : `<div class="row gap mt-s"><button class="btn sm" data-apply="${i}">${icon('check', 16)} ${acts.length > 1 ? 'Додати вибране' : 'Додати'}</button><button class="btn sm ghost" data-skip="${i}">Не треба</button></div>`}</div>` : ''}
  </div></div>`;
}

function draw(sh, thinking = false) {
  const list = chat();
  const log = sh.querySelector('.wh-log');
  log.innerHTML = list.length ? list.map(msgHtml).join('') + (thinking ? `<div class="wh-row">${whisperer(30)}<div class="wh-msg bot typing"><i></i><i></i><i></i></div></div>` : '')
    : `<div class="wh-hello">${whisperer(92)}<p><b>Привіт, я Шептунчик!</b></p><p class="muted small">Напиши або натисни 🎤 і скажи звичайними словами — я додам у календар, покупки чи нагадування. Голосові команди виконую сам за кілька секунд (можна скасувати).</p>
      <div class="wh-chips">${CHIPS.map((c) => `<button class="chip-btn" data-chip="${esc(c)}">${esc(c)}</button>`).join('')}</div></div>`;
  log.scrollTop = log.scrollHeight;
}

async function send(sh, text, audio = '') {
  text = text.trim();
  if (!text && !audio) return;
  const list = chat();
  const history = list.filter((m) => (m.role === 'user' && !m.pending) || m.role === 'bot').slice(-6).map((m) => ({ role: m.role === 'bot' ? 'model' : 'user', text: m.role === 'bot' ? JSON.stringify({ reply: m.text, actions: m.actions || [] }) : m.text }));
  const mine = audio ? { role: 'user', text: 'розпізнаю…', voice: true, pending: true } : { role: 'user', text };
  list.push(mine);
  draw(sh, true);
  try {
    const res = await fetch('/api/whisper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: S.code, member: S.me.id, text, audio: audio || undefined, history }) });
    const data = await res.json().catch(() => ({}));
    if (audio) { mine.pending = false; mine.text = data.heard || (res.ok ? '(не розчув)' : 'голосове'); }
    if (!res.ok) list.push({ role: 'err', text: data.error || 'Немає звʼязку з Шептунчиком.' });
    else {
      const m = { role: 'bot', text: data.reply, actions: data.actions || [] };
      if (audio && m.actions.length) m.autoAt = Date.now() + 5000; // voice = do it, unless cancelled
      list.push(m);
      if (m.autoAt) autoRun(sh, list.length - 1);
    }
  } catch { list.push({ role: 'err', text: 'Немає інтернету 🙈' }); }
  if (sh.isConnected) draw(sh);
}

/* ---- voice commands: auto-apply after a short countdown ---- */
function autoRun(sh, i) {
  const tick = setInterval(() => {
    const m = chat()[i];
    if (!m || m.done || !m.autoAt) return clearInterval(tick);
    const left = Math.ceil((m.autoAt - Date.now()) / 1000);
    const b = document.querySelector(`.wh-auto[data-auto="${i}"] b`); if (b) b.textContent = Math.max(0, left);
    if (left <= 0) { clearInterval(tick); applyMsg(document.querySelector('.wh-log')?.parentElement || sh, i); }
  }, 250);
}
async function applyMsg(sh, i) {
  const m = chat()[i]; if (!m || m.done || m.busy) return;
  m.busy = true;
  const boxes = [...(sh.isConnected ? sh : document).querySelectorAll(`.wh-acts[data-m="${i}"] input`)];
  const chosen = m.actions.filter((a, j) => (boxes[j] ? boxes[j].checked : !a.off));
  if (!chosen.length) { m.busy = false; m.autoAt = 0; toast('Обери хоча б одну дію'); if (sh.isConnected) draw(sh); return; }
  let ok = 0;
  for (const a of chosen) if (await apply(a)) ok++;
  S.render();
  m.done = ok === chosen.length ? `Готово! Додано: ${ok}` : `Додано ${ok} з ${chosen.length}`;
  if (chosen.some((a) => ['event', 'blind', 'place'].includes(a.type) && a.time)) m.done += ' · нагадаю напередодні й за 2 год 🤫';
  if (!sh.isConnected) toast('🦎 ' + m.done);
  else draw(sh);
}

/* ---- microphone → 16 kHz mono WAV (Gemini understands it on every phone) ---- */
let rec = null;
function wav(samples, rate) {
  const b = new ArrayBuffer(44 + samples.length * 2), v = new DataView(b);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true);
  return new Blob([b], { type: 'audio/wav' });
}
async function toWavB64(blob) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ac = new AC();
  const buf = await ac.decodeAudioData(await blob.arrayBuffer());
  ac.close?.();
  const rate = 16000, len = Math.ceil(buf.duration * rate);
  const off = new OfflineAudioContext(1, len, rate);
  const src = off.createBufferSource(); src.buffer = buf; src.connect(off.destination); src.start();
  const out = await off.startRendering();
  const data = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(wav(out.getChannelData(0), rate)); });
  return { data, sec: buf.duration };
}
function recUi(sh, on) {
  const f = sh.querySelector('.wh-input'), inp = sh.querySelector('#wh-in'), b = sh.querySelector('[data-mic]');
  if (!f) return;
  f.classList.toggle('rec', on);
  inp.disabled = on;
  inp.placeholder = on ? 'Слухаю… говори 🎤' : 'Наприклад: у суботу о 19 кіно';
  b.innerHTML = icon(on ? 'stop' : 'mic', 20);
  b.setAttribute('aria-label', on ? 'Зупинити й надіслати' : 'Сказати голосом');
}
function stopRec(sendIt = true) {
  if (!rec) return;
  const r = rec; rec = null;
  r.send = sendIt; clearInterval(r.timer); clearTimeout(r.limit);
  try { r.mr.state !== 'inactive' && r.mr.stop(); } catch { /* already stopped */ }
  r.stream.getTracks().forEach((t) => t.stop());
  if (r.sh.isConnected) recUi(r.sh, false);
}
async function startRec(sh) {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return toast('Цей браузер не вміє записувати голос 😔');
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
  catch { return toast('Дозволь доступ до мікрофона в налаштуваннях 🎤'); }
  const mr = new MediaRecorder(stream);
  const r = { sh, stream, mr, chunks: [], t0: Date.now(), send: true };
  rec = r;
  mr.ondataavailable = (e) => e.data.size && r.chunks.push(e.data);
  mr.onstop = async () => {
    if (!r.send) return;
    if (Date.now() - r.t0 < 700) return toast('Затисни довше — скажи хоч кілька слів 🙂');
    try {
      const { data, sec } = await toWavB64(new Blob(r.chunks, { type: mr.mimeType || 'audio/mp4' }));
      if (sec < 0.5) return toast('Нічого не почув 🙉');
      if (sh.isConnected) send(sh, '', data);
    } catch (e) { console.warn('voice', e); toast('Не вдалося обробити запис 😔'); }
  };
  mr.start(250);
  recUi(sh, true);
  navigator.vibrate?.(15);
  const lab = sh.querySelector('.wh-rec-t');
  r.timer = setInterval(() => { const s = Math.floor((Date.now() - r.t0) / 1000); if (lab) lab.textContent = `0:${String(s).padStart(2, '0')}`; if (!sh.isConnected) stopRec(false); }, 250);
  r.limit = setTimeout(() => stopRec(true), 40000);
}

export function openWhisper(prefill = '') {
  const sh = openSheet(`<div class="wh-head">${whisperer(40)}<div class="grow"><b>Шептунчик</b><div class="muted small">твій помічник по всьому застосунку</div></div>
      ${chat().length ? `<button class="icon-btn sm ghost" data-clear aria-label="Почати спочатку">${icon('trash', 16)}</button>` : ''}</div>
    <div class="wh-log"></div>
    <form class="wh-input"><span class="wh-rec-dot" aria-hidden="true"></span><span class="wh-rec-t">0:00</span><input id="wh-in" placeholder="Наприклад: у суботу о 19 кіно" maxlength="800" autocomplete="off" enterkeyhint="send" value="${esc(prefill)}"><button class="icon-btn mic" type="button" data-mic aria-label="Сказати голосом">${icon('mic', 20)}</button><button class="icon-btn" type="submit" aria-label="Надіслати">${icon('send', 20)}</button></form>`);
  sh.closest('.sheet')?.classList.add('wh-sheet');
  draw(sh);
  const inp = sh.querySelector('#wh-in');
  sh.querySelector('.wh-input').onsubmit = (e) => { e.preventDefault(); if (rec) return stopRec(true); const t = inp.value; inp.value = ''; send(sh, t); };
  sh.querySelector('[data-mic]').addEventListener('click', () => (rec ? stopRec(true) : startRec(sh)));
  sh.querySelector('[data-clear]')?.addEventListener('click', () => { S.ui.whisper = []; draw(sh); });
  sh.querySelector('.wh-log').addEventListener('change', (e) => {
    const box = e.target.closest('.wh-acts input'); if (!box) return;
    const m = chat()[+box.closest('.wh-acts').dataset.m]; const a = m?.actions[+box.dataset.j]; if (a) a.off = !box.checked;
  });
  sh.querySelector('.wh-log').addEventListener('click', async (e) => {
    const chip = e.target.closest('[data-chip]');
    if (chip) return send(sh, chip.dataset.chip);
    const skip = e.target.closest('[data-skip]');
    if (skip) { const m = chat()[+skip.dataset.skip]; m.autoAt = 0; m.done = m.done || 'Добре, нічого не додаю'; return draw(sh); }
    const ap = e.target.closest('[data-apply]');
    if (!ap) return;
    ap.disabled = true;
    applyMsg(sh, +ap.dataset.apply);
  });
  if (prefill) send(sh, prefill), (inp.value = '');
  else if (!/iPhone|iPad/.test(navigator.userAgent)) inp.focus();
}

on('whisper', () => openWhisper());
export const whisperFab = () => `<button class="wh-fab" data-a="whisper" aria-label="Шептунчик — помічник">${whisperer(42)}</button>`;
