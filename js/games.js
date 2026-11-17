// Mini-games with the chameleon. Each game renders into a box and calls done(win).
import { esc } from './ui.js';

const rnd = (n) => Math.floor(Math.random() * n);
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = rnd(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function timerBar(box, seconds, onEnd) {
  const bar = box.querySelector('.g-timer i');
  const start = Date.now();
  let stopped = false;
  const tick = () => {
    if (stopped || !box.isConnected) return;
    const left = Math.max(0, 1 - (Date.now() - start) / (seconds * 1000));
    if (bar) bar.style.width = left * 100 + '%';
    if (left <= 0) { stopped = true; onEnd(); return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => { stopped = true; };
}

/* ---------- 1. catch the fish ---------- */
function fish(box, done) {
  const need = 6, secs = 12;
  let got = 0, over = false;
  box.innerHTML = `<p class="g-rule">Хамелеон зголоднів — лови мушок язиком! Треба <b>${need}</b>.</p>
    <div class="g-timer"><i></i></div><div class="g-pond" id="pond"><span class="g-score">0 / ${need}</span></div>`;
  const pond = box.querySelector('#pond');
  const score = box.querySelector('.g-score');
  const spawn = () => {
    if (over || !box.isConnected) return;
    const f = document.createElement('button');
    f.className = 'g-fish';
    f.textContent = Math.random() < 0.15 ? '🦟' : '🪰';
    f.style.left = 6 + rnd(78) + '%';
    f.style.top = 10 + rnd(70) + '%';
    if (Math.random() < 0.5) f.style.transform = 'scaleX(-1)';
    f.onclick = () => {
      if (over) return;
      got++; score.textContent = `${got} / ${need}`;
      f.classList.add('caught'); setTimeout(() => f.remove(), 250);
      if (got >= need) { over = true; stop(); done(true); }
    };
    pond.appendChild(f);
    setTimeout(() => f.remove(), 1100);
    setTimeout(spawn, 450 + rnd(350));
  };
  const stop = timerBar(box, secs, () => { if (!over) { over = true; done(false); } });
  spawn();
}

/* ---------- 2. where is the pearl ---------- */
function shells(box, done) {
  box.innerHTML = `<p class="g-rule">Запамʼятай, під яким листочком сховалося сонечко 🐞, і стеж уважно!</p>
    <div class="g-shells">${[0, 1, 2].map((i) => `<button class="g-shell" data-i="${i}" disabled><span class="g-pearl">${i === 1 ? '🐞' : ''}</span><span class="g-cap">🍃</span></button>`).join('')}</div>`;
  const btns = [...box.querySelectorAll('.g-shell')];
  let order = [0, 1, 2]; // order[slot] = shell index
  const place = () => btns.forEach((b, i) => { b.style.transform = `translateX(${(order.indexOf(i) - i) * 100}%)`; });
  (async () => {
    btns[1].classList.add('lift'); await wait(1100); btns[1].classList.remove('lift'); await wait(400);
    const moves = 5 + rnd(3);
    for (let k = 0; k < moves; k++) {
      const a = rnd(3); let b = rnd(3); if (b === a) b = (a + 1) % 3;
      [order[a], order[b]] = [order[b], order[a]];
      place(); await wait(420);
    }
    btns.forEach((b) => (b.disabled = false));
    box.querySelector('.g-rule').textContent = 'Де сонечко?';
    btns.forEach((b) => b.onclick = async () => {
      btns.forEach((x) => (x.disabled = true));
      btns[1].classList.add('lift'); if (b !== btns[1]) b.classList.add('lift');
      await wait(900); done(b === btns[1]);
    });
  })();
}

/* ---------- 3. memory ---------- */
function memory(box, done) {
  const pool = shuffle(['🐞', '🦋', '🌸', '🍃', '🪲', '🌼', '🍄', '🐛']).slice(0, 4);
  const cards = shuffle([...pool, ...pool]);
  const limit = 10;
  let open = [], found = 0, moves = 0, lock = false;
  box.innerHTML = `<p class="g-rule">Знайди всі пари за <b>${limit}</b> ходів.</p><div class="g-moves">Ходи: 0 / ${limit}</div>
    <div class="g-mem">${cards.map((c, i) => `<button class="g-card" data-i="${i}"><span class="g-back">🦎</span><span class="g-face">${c}</span></button>`).join('')}</div>`;
  const mv = box.querySelector('.g-moves');
  box.querySelectorAll('.g-card').forEach((b) => b.onclick = async () => {
    if (lock || b.classList.contains('up')) return;
    b.classList.add('up'); open.push(b);
    if (open.length < 2) return;
    moves++; mv.textContent = `Ходи: ${moves} / ${limit}`;
    const [x, y] = open; open = [];
    if (cards[x.dataset.i] === cards[y.dataset.i]) {
      found++; x.classList.add('ok'); y.classList.add('ok');
      if (found === pool.length) { await wait(400); done(true); }
    } else {
      lock = true; await wait(700); x.classList.remove('up'); y.classList.remove('up'); lock = false;
    }
    if (moves >= limit && found < pool.length) { lock = true; await wait(500); done(false); }
  });
}

/* ---------- 4. bubbles ---------- */
function bubbles(box, done) {
  const need = 8, secs = 12;
  let got = 0, over = false;
  box.innerHTML = `<p class="g-rule">Хамелеон пускає бульбашки — лопни <b>${need}</b>! Рожеві не чіпай 🙅</p>
    <div class="g-timer"><i></i></div><div class="g-pond sky" id="sky"><span class="g-score">0 / ${need}</span></div>`;
  const sky = box.querySelector('#sky');
  const score = box.querySelector('.g-score');
  const spawn = () => {
    if (over || !box.isConnected) return;
    const bad = Math.random() < 0.2;
    const b = document.createElement('button');
    b.className = 'g-bubble' + (bad ? ' bad' : '');
    const size = 38 + rnd(26);
    b.style.width = b.style.height = size + 'px';
    b.style.left = 4 + rnd(80) + '%';
    b.style.animationDuration = 2.2 + Math.random() * 1.4 + 's';
    b.onclick = () => {
      if (over) return;
      b.classList.add('pop'); setTimeout(() => b.remove(), 200);
      if (bad) { got = Math.max(0, got - 2); } else got++;
      score.textContent = `${got} / ${need}`;
      if (got >= need) { over = true; stop(); done(true); }
    };
    b.addEventListener('animationend', () => b.remove());
    sky.appendChild(b);
    setTimeout(spawn, 380 + rnd(300));
  };
  const stop = timerBar(box, secs, () => { if (!over) { over = true; done(false); } });
  spawn();
}

/* ---------- 5. repeat after the otter ---------- */
function simon(box, done) {
  const items = ['🪰', '🐞', '🦋', '🐛'];
  const len = 4;
  const seq = Array.from({ length: len }, () => rnd(4));
  let pos = 0;
  box.innerHTML = `<p class="g-rule">Хамелеон покаже, кого хоче зловити. Запамʼятай і повтори порядок!</p>
    <div class="g-show">🦎 <span id="want">…</span></div>
    <div class="g-pad">${items.map((e, i) => `<button class="g-key" data-i="${i}" disabled>${e}</button>`).join('')}</div>`;
  const want = box.querySelector('#want');
  const keys = [...box.querySelectorAll('.g-key')];
  (async () => {
    await wait(600);
    for (const i of seq) { want.textContent = items[i]; keys[i].classList.add('hl'); await wait(650); keys[i].classList.remove('hl'); want.textContent = ''; await wait(220); }
    want.textContent = 'Твоя черга!';
    keys.forEach((k) => (k.disabled = false));
    keys.forEach((k) => k.onclick = () => {
      const i = +k.dataset.i;
      k.classList.add('hl'); setTimeout(() => k.classList.remove('hl'), 180);
      if (i !== seq[pos]) { keys.forEach((x) => (x.disabled = true)); want.textContent = `Було: ${seq.map((s) => items[s]).join(' ')}`; setTimeout(() => done(false), 900); return; }
      pos++; want.textContent = seq.slice(0, pos).map((s) => items[s]).join(' ');
      if (pos === len) { keys.forEach((x) => (x.disabled = true)); setTimeout(() => done(true), 500); }
    });
  })();
}

/* ---------- 6. truth or myth ---------- */
const FACTS = [
  ['Хамелеон може рухати очима незалежно одне від одного.', true],
  ['Язик деяких хамелеонів буває довшим за їхнє тіло.', true],
  ['Хамелеони змінюють колір лише для маскування.', false],
  ['Колір хамелеона змінюють особливі клітини з крихітними кристалами в шкірі.', true],
  ['Майже половина всіх видів хамелеонів живе на Мадагаскарі.', true],
  ['Хамелеони — різновид змій.', false],
  ['Пальці хамелеона зрощені в «кліщі», щоб міцно триматися за гілки.', true],
  ['Хамелеони мають чудовий слух.', false],
  ['Хамелеон бачить майже все довкола себе, не повертаючи голови.', true],
  ['Усі хамелеони живуть понад 20 років.', false],
  ['Кістки деяких хамелеонів світяться в ультрафіолеті.', true],
  ['Хамелеони зазвичай пʼють краплі води з листя.', true],
];
function quiz(box, done) {
  const qs = shuffle(FACTS).slice(0, 3);
  let i = 0, right = 0;
  const draw = () => {
    const [q] = qs[i];
    box.innerHTML = `<p class="g-rule">Правда чи міф? Питання ${i + 1} з 3 · потрібно 2 правильні</p>
      <div class="g-fact">${esc(q)}</div>
      <div class="grid2"><button class="btn secondary" data-v="1">✅ Правда</button><button class="btn secondary" data-v="0">❌ Міф</button></div><div class="g-verdict"></div>`;
    box.querySelectorAll('[data-v]').forEach((b) => b.onclick = async () => {
      box.querySelectorAll('[data-v]').forEach((x) => (x.disabled = true));
      const ok = (b.dataset.v === '1') === qs[i][1];
      if (ok) right++;
      box.querySelector('.g-verdict').textContent = ok ? 'Так! 🎉' : qs[i][1] ? 'Насправді це правда 🙂' : 'Насправді це міф 🙂';
      await wait(1100);
      i++;
      if (i < qs.length) draw(); else done(right >= 2);
    });
  };
  draw();
}

/* ---------- 7. rock paper scissors ---------- */
function rps(box, done) {
  const opts = [['✊', 'Камінь'], ['✌️', 'Ножиці'], ['✋', 'Папір']];
  let me = 0, ot = 0;
  const draw = (msg = '') => {
    box.innerHTML = `<p class="g-rule">Камінь, ножиці, папір з хамелеоном — до 2 перемог.</p>
      <div class="g-rps-score">Ти <b>${me}</b> : <b>${ot}</b> 🦎</div><div class="g-show">${msg || 'Обирай!'}</div>
      <div class="g-pad three">${opts.map(([e, n], i) => `<button class="g-key" data-i="${i}" aria-label="${n}">${e}</button>`).join('')}</div>`;
    box.querySelectorAll('.g-key').forEach((k) => k.onclick = async () => {
      box.querySelectorAll('.g-key').forEach((x) => (x.disabled = true));
      const a = +k.dataset.i, b = rnd(3);
      const res = a === b ? 0 : (a + 1) % 3 === b ? 1 : -1; // rock beats scissors, scissors beat paper, paper beats rock
      if (res > 0) me++; else if (res < 0) ot++;
      const m = `${opts[a][0]} проти ${opts[b][0]} — ${res > 0 ? 'твоя перемога!' : res < 0 ? 'хамелеон виграв 😼' : 'нічия'}`;
      draw(m);
      if (me === 2 || ot === 2) { box.querySelectorAll('.g-key').forEach((x) => (x.disabled = true)); await wait(900); done(me === 2); }
    });
  };
  draw();
}

/* ---------- 8. camouflage: find the hidden chameleon ---------- */
function camo(box, done) {
  const rounds = [{ n: 4, d: 26 }, { n: 5, d: 18 }, { n: 5, d: 13 }, { n: 6, d: 10 }];
  let r = 0, lives = 2, over = false;
  box.innerHTML = `<p class="g-rule">Хамелеон замаскувався! Знайди листочок, що трохи інший за кольором. <b>4 раунди</b>, 2 помилки можна.</p>
    <div class="g-timer"><i></i></div><div class="g-camo-h"><span class="g-lives"></span><span class="g-round"></span></div><div class="g-camo"></div>`;
  const grid = box.querySelector('.g-camo');
  const stop = timerBar(box, 25, () => { if (!over) { over = true; done(false); } });
  const draw = () => {
    const { n, d } = rounds[r];
    const h = 80 + rnd(80), sat = 45 + rnd(20), lig = 42 + rnd(12);
    const odd = rnd(n * n);
    box.querySelector('.g-round').textContent = `Раунд ${r + 1} / ${rounds.length}`;
    box.querySelector('.g-lives').textContent = '💚'.repeat(lives) + '🤍'.repeat(2 - lives);
    grid.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
    grid.innerHTML = Array.from({ length: n * n }, (_, i) => `<button class="g-leaf" data-i="${i}" style="background:hsl(${h} ${sat}% ${i === odd ? lig + d * 0.6 : lig}%)"></button>`).join('');
    grid.querySelectorAll('.g-leaf').forEach((b) => (b.onclick = () => {
      if (over) return;
      if (+b.dataset.i === odd) {
        b.textContent = '🦎'; b.classList.add('hit');
        r++;
        if (r >= rounds.length) { over = true; stop(); setTimeout(() => done(true), 450); } else setTimeout(draw, 350);
      } else {
        b.classList.add('miss'); lives--;
        if (lives < 0) { over = true; stop(); grid.children[odd].textContent = '🦎'; setTimeout(() => done(false), 700); } else box.querySelector('.g-lives').textContent = '💚'.repeat(lives) + '🤍'.repeat(2 - lives);
      }
    }));
  };
  draw();
}

/* ---------- 9. tongue sniper ---------- */
function tongue(box, done) {
  const need = 3, tries = 5;
  let hits = 0, used = 0, pos = 0, dir = 1, speed = 0.9, raf, busy = false;
  box.innerHTML = `<p class="g-rule">Муха літає туди-сюди. Тисни «Язик!», коли вона в зеленій зоні. Треба <b>${need}</b> влучання з ${tries} спроб.</p>
    <div class="g-track"><span class="g-zone"></span><span class="g-fly">🪰</span></div>
    <div class="g-tries"></div><button class="btn block mt" data-shoot>👅 Язик!</button>`;
  const fly = box.querySelector('.g-fly'), zone = box.querySelector('.g-zone'), info = box.querySelector('.g-tries');
  let z0 = 0, z1 = 0;
  const newZone = () => { const w = 22 - hits * 4; z0 = 10 + rnd(80 - w); z1 = z0 + w; zone.style.left = z0 + '%'; zone.style.width = w + '%'; };
  const show = () => { info.textContent = `Влучань: ${hits} / ${need} · спроб лишилось: ${tries - used}`; };
  newZone(); show();
  const loop = () => {
    if (!box.isConnected) return;
    pos += dir * speed; if (pos > 96) { pos = 96; dir = -1; } if (pos < 0) { pos = 0; dir = 1; }
    fly.style.left = pos + '%';
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  box.querySelector('[data-shoot]').onclick = async () => {
    if (busy) return; busy = true; used++;
    const ok = pos + 2 >= z0 && pos + 2 <= z1;
    zone.classList.add(ok ? 'ok' : 'bad');
    if (ok) { hits++; fly.textContent = '✨'; speed += 0.45; }
    show();
    await wait(500);
    zone.classList.remove('ok', 'bad'); fly.textContent = '🪰';
    if (hits >= need) { cancelAnimationFrame(raf); done(true); return; }
    if (used >= tries || tries - used < need - hits) { cancelAnimationFrame(raf); done(false); return; }
    if (ok) newZone();
    busy = false;
  };
}

/* ---------- 10. make a word ---------- */
const WORDS = ['ХВІСТ', 'ЯЗИК', 'КОЛІР', 'ЛИСТОК', 'СОНЦЕ', 'ОБІЙМИ', 'МРІЯ', 'КАВА', 'ТЕПЛО', 'ЗІРКА', 'ВЕСНА', 'ДОЩИК', 'ЯГОДА', 'МЕТЕЛИК', 'КВІТКА', 'ПОДАРУНОК', 'ПРОГУЛЯНКА', 'УСМІШКА', 'ПЛЕДИК', 'ВЕЧІР', 'МУЗИКА', 'ЗАКОХАНІ'];
function anagram(box, done) {
  const words = shuffle(WORDS.filter((w) => w.length <= 8)).slice(0, 2);
  let wi = 0, over = false;
  const stop = timerBar(box, 50, () => { if (!over) { over = true; done(false); } });
  const draw = () => {
    const word = words[wi];
    let letters = shuffle([...word]); while (letters.join('') === word) letters = shuffle([...word]);
    const picked = [];
    const render = () => {
      box.innerHTML = `<p class="g-rule">Склади слово з літер. Слово ${wi + 1} з 2 · ${word.length} літер</p><div class="g-timer"><i></i></div>
        <div class="g-ans">${Array.from({ length: word.length }, (_, i) => `<span class="${picked[i] !== undefined ? 'on' : ''}" data-k="${i}">${picked[i] !== undefined ? letters[picked[i]] : ''}</span>`).join('')}</div>
        <div class="g-letters">${letters.map((l, i) => `<button class="g-key" data-i="${i}" ${picked.includes(i) ? 'disabled' : ''}>${l}</button>`).join('')}</div>
        <div class="row gap mt"><button class="btn sm ghost" data-undo>⌫ Стерти</button><span class="grow"></span><button class="btn sm ghost" data-hint>💡 Підказка</button></div>`;
      box.querySelectorAll('.g-letters .g-key').forEach((b) => (b.onclick = () => {
        if (over) return;
        picked.push(+b.dataset.i);
        if (picked.length === word.length) {
          const ok = picked.map((i) => letters[i]).join('') === word;
          if (ok) { wi++; render(); box.querySelector('.g-ans').classList.add('ok'); if (wi >= words.length) { over = true; stop(); setTimeout(() => done(true), 600); } else setTimeout(draw, 600); return; }
          render(); box.querySelector('.g-ans').classList.add('bad'); setTimeout(() => { picked.length = 0; render(); }, 500); return;
        }
        render();
      }));
      box.querySelector('[data-undo]').onclick = () => { picked.pop(); render(); };
      box.querySelector('[data-hint]').onclick = (e) => { e.currentTarget.textContent = `💡 Починається на «${word[0]}»`; e.currentTarget.disabled = true; };
    };
    render();
  };
  draw();
}

/* ---------- 11. colour muddle (Stroop) ---------- */
function stroop(box, done) {
  const C = [['ЧЕРВОНИЙ', '#E5484D'], ['ЗЕЛЕНИЙ', '#30A46C'], ['СИНІЙ', '#3E7BFA'], ['ЖОВТИЙ', '#F5B800']];
  const need = 8;
  let got = 0, miss = 0, over = false;
  box.innerHTML = `<p class="g-rule">Хамелеон плутає кольори! Тисни на <b>колір літер</b>, а не на те, що написано. Треба ${need} правильних, помилок — не більше 2.</p>
    <div class="g-timer"><i></i></div><div class="g-stroop"></div><div class="g-score-l"></div>
    <div class="grid2 mt">${C.map(([n, col], i) => `<button class="btn secondary g-col" data-i="${i}"><span class="dot" style="background:${col}"></span>${n.toLowerCase()}</button>`).join('')}</div>`;
  const word = box.querySelector('.g-stroop'), sc = box.querySelector('.g-score-l');
  let ink = 0;
  const next = () => { const w = rnd(4); do { ink = rnd(4); } while (ink === w && Math.random() < 0.85); word.textContent = C[w][0]; word.style.color = C[ink][1]; sc.textContent = `✅ ${got} / ${need} · ❌ ${miss} / 2`; };
  const stop = timerBar(box, 22, () => { if (!over) { over = true; done(false); } });
  box.querySelectorAll('.g-col').forEach((b) => (b.onclick = () => {
    if (over) return;
    if (+b.dataset.i === ink) got++; else { miss++; word.classList.add('shake'); setTimeout(() => word.classList.remove('shake'), 300); }
    if (got >= need) { over = true; stop(); sc.textContent = `✅ ${got} / ${need}`; setTimeout(() => done(true), 400); return; }
    if (miss > 2) { over = true; stop(); setTimeout(() => done(false), 400); return; }
    next();
  }));
  next();
}

export const GAMES = [
  { id: 'fish', title: 'Лови мушок', icon: '🪰', run: fish },
  { id: 'shells', title: 'Де сонечко?', icon: '🍃', run: shells },
  { id: 'memory', title: 'Лісова памʼять', icon: '🧠', run: memory },
  { id: 'bubbles', title: 'Мильні бульбашки', icon: '🫧', run: bubbles },
  { id: 'simon', title: 'Повтори за хамелеоном', icon: '🦎', run: simon },
  { id: 'quiz', title: 'Правда чи міф?', icon: '🤔', run: quiz },
  { id: 'rps', title: 'Камінь, ножиці, папір', icon: '✌️', run: rps },
  { id: 'camo', title: 'Маскування', icon: '🦎', run: camo },
  { id: 'tongue', title: 'Язик-снайпер', icon: '👅', run: tongue },
  { id: 'anagram', title: 'Склади слово', icon: '🔤', run: anagram },
  { id: 'stroop', title: 'Кольорова плутанина', icon: '🎨', run: stroop },
];

// Random game, avoiding the last few played on this device.
export function pickGame(recent = []) {
  const pool = GAMES.filter((g) => !recent.includes(g.id));
  return (pool.length ? pool : GAMES)[rnd(pool.length ? pool.length : GAMES.length)];
}
