// «Живий» Хамі — a small behaviour brain on top of the sprite frames.
// He is never still: breathes and blinks frame by frame, wanders around the scene (turning to face where he goes),
// sits, looks around, waves, jumps, catches flies, talks — and reacts to touches and to what happens in the app.
// No network / no AI calls: it is instant, free and works offline.
import { S, today, partnerId, partner } from './store.js';
import { mealsDone, mealAt, mealsOf } from '/lib/core.js';
import { itemsBetween } from './derive.js';
import { hamiSrc, STAGE_SCALE, HAMI_STAGES } from './ui.js';

const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const el = () => document.getElementById('pet-live');
const now = () => Date.now();

// frame sets; "own" = drawn for this stage (no scaling), otherwise adult frames scaled to the stage
const IDLE = { baby: 'babyidle', kid: 'kididle', teen: 'teenidle', adult: 'idle' };
function framesFor(kind, stage) {
  switch (kind) {
    case 'idle': return { names: [1, 2, 3, 4, 5].map((i) => IDLE[stage] + i), own: true };
    case 'wave': return stage === 'baby' ? { names: [1, 2, 3, 2, 3, 4].map((i) => 'babywave' + i), own: true } : { names: [1, 2, 3, 4, 5, 4, 3, 4, 5, 1].map((i) => 'wave' + i), own: stage === 'adult' };
    case 'jump': return { names: [1, 2, 3, 4].map((i) => 'jump' + i), own: stage === 'adult' };
    case 'tongue': return { names: [1, 2, 3, 3, 4, 5].map((i) => 'tongue' + i), own: stage === 'adult' };
    case 'zz': return { names: [1, 2, 3, 4].map((i) => 'zz' + i), own: stage === 'adult' };
    default: return null;
  }
}

/* ---------- state kept across page re-renders ---------- */
const st = { x: 0, z: 0, face: 1, act: null, temp: null, bubbleUntil: 0, text: '', nextAct: now() + 2500, taps: [], snap: null, walking: false };

/* ---------- drawing ---------- */
function setImg(name, own) {
  const p = el(); const img = p?.querySelector('img'); if (!img) return;
  const src = hamiSrc(name);
  if (!img.src.endsWith(src)) img.src = src;
  const k = own || HAMI_STAGES.includes(name) ? 1 : STAGE_SCALE[p.dataset.stage] || 1;
  img.style.width = k === 1 ? '' : Math.round(k * 100) + '%';
}
function place(animate = true) {
  const p = el(); if (!p) return;
  p.style.transition = animate ? '' : 'none';
  // pseudo-3D depth: further back = higher and smaller
  const k = 1 - st.z * 0.2;
  p.style.transform = `translateX(${st.x}px) translateY(${-st.z * 34}px) scale(${k * st.face}, ${k})`;
  p.style.zIndex = String(2 + Math.round((1 - st.z) * 2));
  const say = p.parentElement?.querySelector('.pet-say');
  if (say) say.style.marginLeft = `${st.x}px`;
}
function swapFx() { const p = el(); if (!p) return; p.classList.remove('swap'); void p.offsetWidth; p.classList.add('swap'); }
function animClass(a) { const p = el(); if (!p) return; p.classList.remove('a-hop', 'a-jump', 'a-shake', 'a-melt', 'walking'); if (a) { void p.offsetWidth; p.classList.add(a); } }

/* ---------- speech ---------- */
export function say(text, ms = 3200) {
  const p = el(); if (!p || !text) return;
  let b = p.parentElement.querySelector('.pet-say');
  if (!b) { b = document.createElement('span'); b.className = 'pet-say'; p.parentElement.appendChild(b); }
  b.textContent = text; st.text = text; b.classList.remove('out'); b.classList.add('in');
  b.style.marginLeft = `${st.x}px`;
  st.bubbleUntil = now() + ms;
}
function burst(emojis, n = 5) {
  const stage = document.getElementById('stage'); if (!stage) return;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'floaty'; s.textContent = rnd(emojis);
    s.style.setProperty('--dx', `${(Math.random() - 0.5) * 160 + st.x}px`); s.style.animationDelay = `${i * 0.08}s`;
    stage.appendChild(s); setTimeout(() => s.remove(), 1600);
  }
}

/* ---------- activities ---------- */
// act = { frames, own, fps, i, loop, hold, nextFrame, until, then }
function play(kind, { fps = 8, loop = false, until = 0, then = null, text = '' } = {}) {
  const p = el(); if (!p) return false;
  const f = framesFor(kind, p.dataset.stage); if (!f) return false;
  st.temp = null;
  st.act = { kind, frames: f.names, own: f.own, fps, i: 0, loop, nextFrame: 0, until: until || (loop ? now() + 4000 : 0), then };
  animClass(null);
  if (text) say(text, Math.max((f.names.length * 1000) / fps + 600, 2200));
  return true;
}
/** Show a still pose for a while with a small animation. */
export function petDo(pose, ms = 2400, anim = 'a-hop', text = '') {
  st.act = null;
  st.temp = { pose, until: now() + ms };
  setImg(pose, false); swapFx(); animClass(anim);
  if (text) say(text, Math.min(ms + 600, 3800));
  st.nextAct = now() + ms + 2500 + Math.random() * 3000;
}
export const playFrames = (kind, fps = 8, text = '', after = null) => play(kind, { fps, text, then: after ? () => petDo(after, 1600, 'a-hop') : null });

function walkTo(x, z = Math.random() < 0.6 ? Math.random() : st.z) {
  const p = el(); if (!p) return;
  const dist = Math.hypot(x - st.x, (z - st.z) * 80); if (dist < 12) return;
  if (Math.abs(x - st.x) > 6) st.face = x > st.x ? 1 : -1;
  st.z = Math.max(0, Math.min(1, z));
  const ms = Math.max(700, dist * 14);
  p.style.transitionDuration = ms + 'ms';
  st.x = x; place(true);
  st.walking = true; animClass('walking');
  play('idle', { fps: 9, loop: true, until: now() + ms });
  setTimeout(() => { st.walking = false; animClass(null); if (Math.random() < 0.5) setTimeout(() => { st.face = 1; place(true); }, 600); }, ms);
}
function range() {
  const stage = document.getElementById('stage'), p = el();
  if (!stage || !p) return { min: 0, max: 0 };
  const vis = p.clientWidth * ({ baby: 0.5, kid: 0.6, teen: 0.7, adult: 0.8 }[p.dataset.stage] || 0.8); // the figure is smaller than its box
  return { min: -Math.max(0, stage.clientWidth / 2 - vis / 2 - 14), max: Math.max(0, stage.clientWidth / 2 - vis / 2 - 66) }; // right side has buttons
}

/* ---------- what Хамі may say ---------- */
function phrases() {
  const r = S.room, t = today(), pet = r.pet;
  const pn = partner()?.name;
  const out = ['Обійми свою половинку! 🤗', 'Може, побачення на вихідних? 💞', 'Я тут, якщо що 😊', 'Пограємо? 🎮', 'Скажи «люблю» без приводу 💌', 'Не забудь випити води 💧', 'Ви — найкраща пара ✨'];
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

/* ---------- the brain: choose the next thing to do ---------- */
function decide() {
  const p = el(); if (!p || document.querySelector('.sheet-bg') || document.hidden) return;
  const base = p.dataset.base, stage = p.dataset.stage, pet = S.room.pet, t = today();
  const R = range();
  const spot = () => R.min + Math.random() * (R.max - R.min);
  if (base === 'sleep') { play('zz', { fps: 3, loop: true, until: now() + 8000 }); if (Math.random() < 0.3) say(rnd(['Zzz…', 'Хррр… 💤', 'Сниться мушка… 🪰'])); st.nextAct = now() + 8000; return; }
  if (base === 'tired') { petDo('tired', 2600, 'a-melt', Math.random() < 0.5 ? rnd(['Я такий голодний… 🥺', 'Сил немає… погодуй мене']) : ''); return; }
  if (base === 'hungry' || !mealsOf(pet, t)[mealAt()]) {
    rnd([() => walkTo(spot()), () => petDo('hungry', 2600, 'a-hop', rnd(['Я б з’їв мушку 🥺', 'Бурчить у животику…', 'Час їсти! 🍽️'])), () => play('tongue', { fps: 7, text: 'Може, хоч мушку… 🪰' })])();
    st.nextAct = now() + 4500 + Math.random() * 3500; return;
  }
  const isIdle = HAMI_STAGES.includes(base);
  const mood = p.dataset.mood; const joy = mood === 'great' ? 2 : 1;
  const options = [
    [28, () => walkTo(spot())],
    [18, () => play('idle', { fps: 6, loop: true, until: now() + 2500 + Math.random() * 2500 })],
    [10, () => { st.face = -st.face; place(true); setTimeout(() => { st.face = -st.face; place(true); }, 900 + Math.random() * 700); }],
    [10 * joy, () => play('wave', { fps: 8, text: Math.random() < 0.6 ? rnd(['Привіт! 👋', 'Агов! 😊', 'Я тут!']) : '' })],
    [7 * joy * joy, () => { play('jump', { fps: 8 }); burst(['✨', '💚'], 3); if (mood === 'great' && Math.random() < 0.5) say(rnd(['Який класний день! 💚', 'Я сьогодні щасливий ✨', 'Ура-ура! 🎉'])); }],
    [10, () => play('tongue', { fps: 7, text: Math.random() < 0.4 ? rnd(['Ням, мушка! 🪰', 'Влучив! 😋']) : '' })],
    [9, () => { play('idle', { fps: 6, loop: true, until: now() + 3200 }); say(rnd(phrases()), 3600); }],
    [5, () => petDo(rnd(['great', 'heart', 'wow', 'thinking']), 2400, 'a-hop', Math.random() < 0.5 ? rnd(phrases()) : '')],
    [5, () => { if (!isIdle) return; petDo('normal', 3000, null); }],
  ];
  const total = options.reduce((s, o) => s + o[0], 0);
  let x = Math.random() * total;
  for (const [w, fn] of options) { x -= w; if (x <= 0) { fn(); break; } }
  st.nextAct = now() + 3000 + Math.random() * 4500;
}

/* ---------- reactions ---------- */
function tap() {
  const n = now();
  st.taps = st.taps.filter((x) => n - x < 2500); st.taps.push(n);
  navigator.vibrate?.(8);
  if (st.taps.length >= 5) { petDo('angry', 2600, 'a-shake', rnd(['Ну досить 😤', 'Щекотно ж! 😤', 'Я тобі не кнопка! 😤'])); st.taps = []; return; }
  if (el()?.dataset.base === 'sleep') { petDo('tired', 2000, 'a-shake', 'Ммм… дай поспати 😴'); return; }
  rnd([() => play('jump', { fps: 9 }), () => play('wave', { fps: 9 }), () => petDo('great', 1800, 'a-hop'), () => petDo('joy', 1800, 'a-jump')])();
  burst(['💚', '💕', '✨'], 3);
  st.nextAct = now() + 4000;
}
function stroke() { petDo('heart', 3000, 'a-melt', rnd(['Мрр… 💚', 'Ще погладь 🥰', 'Як приємно 😌'])); burst(['💕', '💖', '💗'], 7); navigator.vibrate?.([10, 40, 10]); }

export function petEvent(kind) {
  if (!el()) return;
  if (kind === 'feed') { setTimeout(() => burst(['🦗', '😋'], 3), 200); petDo('eat', 3200, 'a-hop', rnd(['Ням-ням! 😋', 'Смакота!', 'Дякую! 💚'])); setTimeout(() => play('jump', { fps: 8 }), 3300); }
  if (kind === 'win') play('jump', { fps: 8, text: rnd(['Перемога! 🎉', 'Ми чемпіони! 🏆']), then: () => petDo('joy', 1800, 'a-jump') });
  if (kind === 'lose') petDo('sad', 2600, 'a-melt', 'Наступного разу вийде 💪');
  if (kind === 'great') { play('jump', { fps: 8, text: 'Ура! 💚', then: () => petDo('great', 1800, 'a-hop') }); burst(['💚', '✨'], 5); }
  if (kind === 'ok') petDo('normal', 2200, null, 'Норм — теж добре 💛');
  if (kind === 'sad') petDo('heart', 3200, null, 'Я поруч. Обійми? 💙');
  st.nextAct = now() + 5000;
}

// Partner did something since the last look → Хамі tells about it.
function partnerNews() {
  const r = S.room, pid = partnerId(); if (!pid) return;
  const snap = { notes: (r.notes || []).filter((n) => n.from === pid).length, mood: r.moods[pid]?.ts || 0, code: r.code };
  const prev = st.snap; st.snap = snap;
  if (!prev || prev.code !== snap.code) return;
  if (snap.notes > prev.notes) petDo('letter', 3600, 'a-hop', `${partner().name} пише тобі! 💌`);
  else if (snap.mood > prev.mood) { const v = r.moods[pid].value; petDo(v === 'sad' ? 'sad' : v === 'great' ? 'great' : 'normal', 3200, 'a-hop', `${partner().name}: ${{ great: 'відмінний настрій 💚', ok: 'настрій норм 💛', sad: 'сумно 💙' }[v]}`); }
}

/* ---------- mount after every page render ---------- */
let preloaded = false;
function preload() {
  if (preloaded) return; preloaded = true;
  const names = ['wave1', 'wave2', 'wave3', 'wave4', 'wave5', 'jump1', 'jump2', 'jump3', 'jump4', 'tongue1', 'tongue2', 'tongue3', 'tongue4', 'tongue5', 'zz1', 'zz2', 'zz3', 'zz4', 'babywave1', 'babywave2', 'babywave3', 'babywave4', 'eat', 'heart', 'great', 'joy', 'angry', 'tired', 'hungry', 'sad', 'normal', 'wow', 'thinking', 'letter'];
  for (const s of Object.values(IDLE)) for (let i = 1; i <= 5; i++) names.push(s + i);
  for (const n of names) { const im = new Image(); im.src = hamiSrc(n); }
}
export function petMount() {
  const p = el(); if (!p) return;
  preload();
  const R = range(); st.x = Math.min(R.max, Math.max(R.min, st.x));
  place(false);
  if (st.temp && st.temp.until > now()) setImg(st.temp.pose, false);
  if (now() < st.bubbleUntil && st.text) say(st.text, st.bubbleUntil - now());
  partnerNews();
  if (p.dataset.bound) return;
  p.dataset.bound = '1';
  let down = 0, moved = 0, lx = 0, ly = 0, long = null, handled = false;
  const stage = document.getElementById('stage');
  if (stage && !stage.dataset.tilt) {
    stage.dataset.tilt = '1';
    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect(); const t = el()?.querySelector('.pet-tilt'); if (!t) return;
      const dx = (e.clientX - r.left) / r.width - 0.5, dy = (e.clientY - r.top) / r.height - 0.5;
      t.style.transform = `rotateY(${dx * 26 * st.face}deg) rotateX(${-dy * 14}deg)`;
    });
    stage.addEventListener('pointerleave', () => { const t = el()?.querySelector('.pet-tilt'); if (t) t.style.transform = ''; });
  }
  p.addEventListener('pointerdown', (e) => { down = now(); moved = 0; lx = e.clientX; ly = e.clientY; handled = false; long = setTimeout(() => { handled = true; stroke(); }, 550); });
  p.addEventListener('pointermove', (e) => {
    if (!down) return;
    moved += Math.hypot(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY;
    if (moved > 90 && !handled) { handled = true; clearTimeout(long); stroke(); }
  });
  const end = () => { clearTimeout(long); down = 0; };
  p.addEventListener('pointerup', end); p.addEventListener('pointercancel', end); p.addEventListener('pointerleave', end);
  p.addEventListener('click', (e) => { e.stopPropagation(); if (!handled) tap(); });
}

/* ---------- heartbeat ---------- */
setInterval(() => {
  const p = el(); if (!p) return;
  const t = now();
  // speech bubble
  if (t > st.bubbleUntil) { const b = document.querySelector('.pet-say'); if (b?.classList.contains('in')) { b.classList.remove('in'); b.classList.add('out'); } }
  // frame animation
  const a = st.act;
  if (a) {
    if (t >= a.nextFrame) {
      setImg(a.frames[a.i], a.own);
      a.i++;
      a.nextFrame = t + 1000 / a.fps;
      if (a.i >= a.frames.length) {
        if (a.loop && t < a.until) { a.i = 0; if (a.kind === 'idle' && !st.walking) a.nextFrame = t + 400 + Math.random() * 1400; }
        else { st.act = null; const then = a.then; if (then) then(); else { setImg(p.dataset.base, false); } }
      }
    }
    return;
  }
  // still pose finished → back to normal
  if (st.temp && st.temp.until <= t) { st.temp = null; animClass(null); setImg(p.dataset.base, false); swapFx(); }
  if (st.temp) return;
  if (t > st.nextAct) { decide(); return; }
  // never stand frozen: gentle breathing / blinking between actions
  if (HAMI_STAGES.includes(p.dataset.base) && Math.random() < 0.08) play('idle', { fps: 6 });
}, 80);
