// «Живий» Хамі: breathes, does little things on his own, talks, and reacts to touches and events.
// Works on top of the sticker poses: swaps the picture with small animations, never re-renders the page.
import { S, today, partnerId, partner } from './store.js';
import { mealsDone, mealAt, mealsOf, isHungry, kyivHour } from '/lib/core.js';
import { itemsBetween } from './derive.js';

let temp = null; // { pose, until, anim }
let nextIdle = Date.now() + 6000;
let bubbleUntil = 0;
let taps = [];
let lastSnap = null;
let lastText = '';
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const el = () => document.getElementById('pet-live');

/** Show a pose for a while (then back to the normal state pose). */
export function petDo(pose, ms = 2400, anim = 'pop', text = '') {
  temp = { pose, until: Date.now() + ms, anim };
  apply(true);
  if (text) say(text, Math.min(ms + 600, 3800));
  nextIdle = Date.now() + ms + 7000 + Math.random() * 6000;
}
export function say(text, ms = 3200) {
  const p = el(); if (!p) return;
  let b = p.parentElement.querySelector('.pet-say');
  if (!b) { b = document.createElement('span'); b.className = 'pet-say'; p.parentElement.appendChild(b); }
  b.textContent = text; lastText = text; b.classList.remove('out'); b.classList.add('in');
  bubbleUntil = Date.now() + ms;
}
function hideBubble() { const b = document.querySelector('.pet-say'); if (b && Date.now() > bubbleUntil) { b.classList.remove('in'); b.classList.add('out'); } }
function burst(emojis, n = 5) {
  const stage = document.getElementById('stage'); if (!stage) return;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'floaty'; s.textContent = rnd(emojis);
    s.style.setProperty('--dx', `${(Math.random() - 0.5) * 160}px`); s.style.animationDelay = `${i * 0.08}s`;
    stage.appendChild(s); setTimeout(() => s.remove(), 1600);
  }
}

function apply(animate) {
  const p = el(); if (!p) return;
  const img = p.querySelector('img'); if (!img) return;
  const live = temp && temp.until > Date.now();
  const pose = live ? temp.pose : p.dataset.base;
  const src = `/img/hami/${pose}.webp`;
  if (!img.src.endsWith(src)) {
    img.src = src;
    if (animate) { p.classList.remove('swap'); void p.offsetWidth; p.classList.add('swap'); }
  }
  p.classList.remove('a-hop', 'a-jump', 'a-shake', 'a-flip', 'a-melt');
  if (live && temp.anim && temp.anim !== 'pop') { void p.offsetWidth; p.classList.add('a-' + temp.anim); }
}

/* ---------- what Хамі may say ---------- */
function phrases() {
  const r = S.room, t = today(), pet = r.pet;
  const pn = partner()?.name;
  const out = ['Обійми свою половинку! 🤗', 'Може, побачення на вихідних? 💞', 'Я тут, якщо що 😎', 'Пограємо? 🎮', 'Скажи «люблю» без приводу 💌', 'Не забудь випити води 💧', 'Ви — найкраща пара ✨'];
  const open = (r.shopping || []).filter((x) => !x.done).length;
  if (open) out.push(`У списку ще ${open} ${open === 1 ? 'покупка' : open < 5 ? 'покупки' : 'покупок'} 🛒`);
  const todayItems = itemsBetween(r, t, t).filter((x) => x.kind !== 'important');
  if (todayItems[0]) out.push(`Сьогодні: ${todayItems[0].kind === 'blind' ? 'побачення-сюрприз 🎭' : todayItems[0].title}${todayItems[0].time ? ' о ' + todayItems[0].time : ''}`);
  const pid = partnerId();
  if (pid && r.moods[pid]?.date !== t) out.push(`Спитай, як день у ${pn} 💬`);
  if (pid && r.moods[pid]?.date === t && r.moods[pid].value === 'sad') out.push(`${pn} сумно… напиши щось тепле 💙`);
  if (mealsDone(pet, t) === 3) out.push('Я ситий і щасливий 😌');
  return out;
}

function idle() {
  const p = el(); if (!p || document.querySelector('.sheet-bg') || document.hidden) return;
  const base = p.dataset.base;
  const pet = S.room.pet, t = today();
  if (base === 'sleep') { say(rnd(['Zzz…', 'Хррр… 💤', 'Сниться мушка… 🪰'])); return; }
  if (base === 'tired') { petDo('tired', 2000, 'melt', rnd(['Я такий голодний… 🥺', 'Сил немає… погодуй мене'])); return; }
  if (base === 'hungry' || !mealsOf(pet, t)[mealAt()]) { petDo('hungry', 2600, 'hop', rnd(['Я б з’їв мушку 🥺', 'Бурчить у животику…', 'Час їсти! 🍽️'])); return; }
  const acts = [
    () => petDo('hello', 2400, 'hop', rnd(['Привіт! 👋', 'Агов! 😎'])),
    () => petDo('thinking', 3000, 'pop', rnd(phrases())),
    () => petDo('sit', 3400, 'pop'),
    () => petDo(base, 1600, 'flip'),
    () => petDo('great', 2200, 'hop', rnd(['Ви молодці! 👍', 'Клас! ✨'])),
    () => petDo('think', 3000, 'pop', rnd(phrases())),
    () => { petDo('joy', 2000, 'jump'); burst(['✨', '🎉', '💚'], 4); },
    () => say(rnd(phrases()), 3600),
    () => petDo('whisper', 2800, 'pop', rnd(['Пссс… обійми її 🤫', 'Пссс… скажи комплімент 🤫', 'Пссс… запроси на каву ☕'])),
  ];
  rnd(acts)();
}

/* ---------- reactions ---------- */
function tap() {
  const now = Date.now();
  taps = taps.filter((x) => now - x < 2500); taps.push(now);
  navigator.vibrate?.(8);
  if (taps.length >= 5) { petDo('angry', 2600, 'shake', rnd(['Ну досить 😤', 'Щекотно ж! 😤', 'Я тобі не кнопка! 😤'])); taps = []; return; }
  const base = el()?.dataset.base;
  if (base === 'sleep') { petDo('tired', 2000, 'shake', 'Ммм… дай поспати 😴'); return; }
  rnd([() => petDo('joy', 1800, 'jump'), () => petDo('great', 1800, 'hop'), () => petDo('hello', 1800, 'hop')])();
  burst(['💚', '💕', '✨'], 3);
}
function pet() { petDo('heart', 3000, 'melt', rnd(['Мрр… 💚', 'Ще погладь 🥰', 'Як приємно 😌'])); burst(['💕', '💖', '💗'], 7); navigator.vibrate?.([10, 40, 10]); }

export function petEvent(kind) {
  if (kind === 'feed') { setTimeout(() => burst(['🦗', '😋'], 3), 200); petDo('eat', 3200, 'hop', rnd(['Ням-ням! 😋', 'Смакота!', 'Дякую! 💚'])); setTimeout(() => el() && petDo('joy', 1800, 'jump'), 3300); }
  if (kind === 'win') petDo('joy', 3000, 'jump', rnd(['Перемога! 🎉', 'Ми чемпіони! 🏆']));
  if (kind === 'lose') petDo('sad', 2600, 'melt', 'Наступного разу вийде 💪');
  if (kind === 'great') { petDo('joy', 2400, 'jump', 'Ура! 💚'); burst(['💚', '✨'], 5); }
  if (kind === 'ok') petDo('normal', 2200, 'pop', 'Норм — теж добре 💛');
  if (kind === 'sad') petDo('heart', 3200, 'pop', 'Я поруч. Обійми? 💙');
}

// Partner did something since the last look → Хамі tells about it.
function partnerNews() {
  const r = S.room, pid = partnerId(); if (!pid) return;
  const snap = { notes: (r.notes || []).filter((n) => n.from === pid).length, mood: r.moods[pid]?.ts || 0 };
  if (lastSnap && lastSnap.code === r.code) {
    if (snap.notes > lastSnap.notes) petDo('letter', 3600, 'hop', `${partner().name} пише тобі! 💌`);
    else if (snap.mood > lastSnap.mood) { const v = r.moods[pid].value; petDo(v === 'sad' ? 'sad' : v === 'great' ? 'great' : 'normal', 3200, 'hop', `${partner().name}: ${{ great: 'відмінний настрій 💚', ok: 'настрій норм 💛', sad: 'сумно 💙' }[v]}`); }
  }
  lastSnap = { ...snap, code: r.code };
}

/** Called after every render of the page. */
export function petMount() {
  const p = el(); if (!p) return;
  apply(false);
  if (Date.now() < bubbleUntil && lastText) say(lastText, bubbleUntil - Date.now());
  partnerNews();
  if (p.dataset.bound) return;
  p.dataset.bound = '1';
  let down = 0, moved = 0, lx = 0, ly = 0, long = null, handled = false;
  p.addEventListener('pointerdown', (e) => {
    down = Date.now(); moved = 0; lx = e.clientX; ly = e.clientY; handled = false;
    long = setTimeout(() => { handled = true; pet(); }, 550);
  });
  p.addEventListener('pointermove', (e) => {
    if (!down) return;
    moved += Math.hypot(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY;
    if (moved > 90 && !handled) { handled = true; clearTimeout(long); pet(); }
  });
  const end = () => { clearTimeout(long); down = 0; };
  p.addEventListener('pointerup', end); p.addEventListener('pointercancel', end); p.addEventListener('pointerleave', end);
  p.addEventListener('click', (e) => { e.stopPropagation(); if (!handled) tap(); });
}

setInterval(() => {
  if (!el()) return;
  if (temp && temp.until <= Date.now()) { temp = null; apply(true); }
  hideBubble();
  if (Date.now() > nextIdle) { nextIdle = Date.now() + 9000 + Math.random() * 7000; idle(); }
}, 500);
void kyivHour; void isHungry;
