// «Ми» — the main screen.
import { S, on, act, go, openSheet, closeSheet, openForm, toast, today, partnerId, partner, meM, nameOf, LS } from '../store.js';
import { esc, icon, otter, avatar, fmtDate, plural, money, emptyState } from '../ui.js';
import { levelInfo, streakOf, tasksFor, TASKS, OUTFITS, MOODS, checkinWeek, dayDiff, addDays } from '/lib/core.js';
import { itemsBetween, stats, firstSteps, KIND } from '../derive.js';

const MOOD_FACE = { great: 'love', ok: 'ok', sad: 'sad' };

export function meView() {
  const r = S.room;
  const pid = partnerId();
  const p = partner();
  const t = today();
  const st = stats(r);

  return `
  ${coupleCard(r, pid, p, st)}
  ${unreadNotesBanner(r)}
  ${stepsCard(r, pid)}
  ${petCard(r, t)}
  ${moodCard(r, pid, t)}
  ${upcoming(r, t)}
  <div class="grid2">
    <button class="tile warm" data-a="noteSheet"><span class="tile-ic">${icon('send')}</span><b>Записка</b><span>Надіслати сюрприз</span></button>
    <button class="tile" data-a="evening"><span class="tile-ic">${icon('wand')}</span><b>Вечір</b><span>Кіно + рецепт</span></button>
  </div>
  ${checkinCard(r, pid, t)}
  ${goalsCard(r)}
  ${datesSection(r, t)}`;
}

function coupleCard(r, pid, p, st) {
  const days = r.startDate ? Math.max(0, dayDiff(r.startDate, today())) : null;
  return `<section class="card couple">
    <button class="icon-btn sm corner" data-a="settings" aria-label="Профіль">${icon('pencil', 18)}</button>
    <div class="couple-avas">${avatar(meM(), S.me.id, 92)}<span class="couple-heart">${icon('heart', 18)}</span>${p ? avatar(p, pid, 92) : `<button class="ava add" style="width:92px;height:92px" data-a="invite">${icon('plus', 30)}</button>`}</div>
    <h2 class="couple-names">${esc(meM()?.name)}${p ? ` &amp; ${esc(p.name)}` : ''}</h2>
    ${p ? '' : `<div class="invite"><div class="small muted">Твоя пара ще не приєдналася. Надішли їй код:</div><div class="code">${esc(r.code)}</div><button class="btn" data-a="invite">${icon('link', 18)} Запросити</button></div>`}
    <div class="stats">
      ${days !== null
        ? `<button class="stat" data-a="addStart"><b>${days}</b><span>${plural(days, 'день', 'дні', 'днів')} разом</span><i>${icon('pencil', 14)}</i></button>`
        : `<button class="stat outline" data-a="addStart"><b class="accent">+</b><span class="accent">Додати дату</span><i>${icon('pencil', 14)}</i></button>`}
      <button class="stat" data-a="go" data-tab="places"><b>${st.dates}</b><span>${plural(st.dates, 'побачення', 'побачення', 'побачень')}</span><i>${icon('heart', 14)}</i></button>
      <button class="stat" data-a="go" data-tab="more" data-sub="trips"><b>${st.trips}</b><span>${plural(st.trips, 'поїздка', 'поїздки', 'поїздок')}</span><i>${icon('pin', 14)}</i></button>
    </div>
  </section>`;
}

function unreadNotesBanner(r) {
  const seen = LS.get('seenNotes', 0);
  const fresh = r.notes.filter((n) => n.from !== S.me.id && n.ts > seen);
  if (!fresh.length) return '';
  return `<button class="card banner" data-a="go" data-tab="more" data-sub="notes">
    <span class="banner-ic">💌</span><span class="grow"><b>${fresh.length === 1 ? 'Нова записка' : `Нових записок: ${fresh.length}`}</b><br><span class="muted small">автор: ${esc(nameOf(fresh[0].from))}${fresh[0].sealed ? ' · відкриється пізніше 🔒' : ''}</span></span>${icon('chev', 20)}</button>`;
}

function stepsCard(r, pid) {
  if (r.stepsSkipped) return '';
  const steps = firstSteps(r, S.me.id, !!pid);
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return '';
  return `<section class="card">
    <div class="row"><span class="ic-box">${icon('steps')}</span><div class="grow"><h3 class="h3">Перші кроки</h3><div class="muted small">${done} з ${steps.length}</div></div><button class="link muted" data-a="skipSteps">Пропустити</button></div>
    <div class="bar-track mt"><div class="bar-fill" style="width:${(done / steps.length) * 100}%"></div></div>
    <div class="list mt">${steps.map((s) => `<button class="li ${s.done ? 'done' : ''}" data-a="step" data-id="${s.id}"><span class="li-ic">${s.done ? icon('check', 18) : icon(s.icon, 18)}</span><span class="grow">${esc(s.title)}</span>${s.done ? '' : icon('chev', 18)}</button>`).join('')}</div>
  </section>`;
}

function petCard(r, t) {
  const pet = r.pet;
  const lv = levelInfo(pet.xp);
  const streak = streakOf(pet, t);
  const fed = pet.lastFed === t;
  const myMood = r.moods[S.me.id];
  const face = !fed ? 'sad' : myMood?.date === t && myMood.value === 'great' ? 'love' : 'happy';
  const outfit = OUTFITS.find((o) => o.id === pet.outfit)?.emoji || '';
  const tasks = tasksFor(t);
  const claimed = r.daily?.[t]?.[S.me.id]?.claimed || {};
  const doneN = tasks.filter((k) => claimed[k]).length;
  return `<section class="card pet">
    <div class="row">
      <h3 class="h3">Твій улюбленець</h3>
      <button class="icon-btn xs ghost" data-a="petName" aria-label="Перейменувати">${icon('pencil', 16)}</button>
      ${streak ? `<span class="chip fire">🔥 ${streak} дн.</span>` : ''}
      <span class="grow"></span>
      <button class="icon-btn sm" data-a="petHelp" aria-label="Як це працює">${icon('help', 20)}</button>
    </div>
    <div class="muted small">${esc(pet.name)} · ${lv.stage} · рівень ${lv.level}</div>
    <div class="pet-scene" id="stage" data-a="tap">
      ${fed ? `<span class="chip ok">${icon('check', 14)} Нагодований</span>` : `<button class="chip warn" data-a="feed">🐟 Нагодувати</button>`}
      <button class="wardrobe" data-a="wardrobe" aria-label="Гардероб">${icon('shirt', 20)}</button>
      <div class="pet-otter">${otter({ face, outfit, size: 150, bob: true })}</div>
      <span class="tap-pill">${icon('hand', 16)} ТАП ТАП</span>
    </div>
    <div class="pet-foot">
      <div class="grow"><div class="row small"><span>Досвід</span><span class="grow"></span><b>${lv.cur} / ${lv.need}</b></div><div class="bar-track"><div class="bar-fill" style="width:${(lv.cur / lv.need) * 100}%"></div></div></div>
      <button class="pill-btn" data-a="tasks"><span class="dots3"><i></i><i></i><i></i></span>Завдання дня <b>${doneN}/3</b></button>
    </div>
  </section>`;
}

function moodCard(r, pid, t) {
  const mine = r.moods[S.me.id];
  const theirs = pid && r.moods[pid];
  return `<section class="card" id="mood">
    <h3 class="h3">Як ти сьогодні?</h3>
    <div class="moods">${Object.entries(MOODS).map(([k, label]) => `
      <button class="mood m-${k} ${mine?.date === t && mine.value === k ? 'on' : ''}" data-a="mood" data-v="${k}">
        <span class="mood-face">${otter({ face: MOOD_FACE[k], size: 34 })}</span>${label}</button>`).join('')}</div>
    ${pid ? `<div class="center muted small mt">Партнер зараз: ${theirs?.date === t ? `<span class="inline-face">${otter({ face: MOOD_FACE[theirs.value], size: 26 })}</span> ${MOODS[theirs.value]}` : 'ще не відмітив(-ла)'}</div>` : ''}
  </section>`;
}

function upcoming(r, t) {
  const items = itemsBetween(r, t, addDays(t, 30)).filter((x) => x.kind !== 'trip' || x.first);
  return `<div class="sec-h"><span>${icon('cal', 16)} ЩО ПОПЕРЕДУ</span><button class="link accent" data-a="go" data-tab="more" data-sub="calendar">${icon('cal', 16)} Календар</button></div>
  ${items.length
    ? `<section class="card list">${items.slice(0, 6).map((x) => `<button class="li" data-a="go" data-tab="more" data-sub="calendar" data-day="${x.date}">
        <span class="kdot" style="background:${KIND[x.kind].color}"></span>
        <span class="grow"><b>${esc(x.title)}</b><br><span class="muted small">${x.date === t ? 'Сьогодні' : x.date === addDays(t, 1) ? 'Завтра' : fmtDate(x.date, { weekday: true })}${x.time ? ' · ' + x.time : ''}</span></span>
        <span class="muted small">${KIND[x.kind].emoji}</span></button>`).join('')}</section>`
    : `<p class="center muted pad">На найближчий місяць поки нічого не заплановано.</p>`}`;
}

function checkinCard(r, pid, t) {
  const w = checkinWeek(t);
  const entry = r.checkins[w] || {};
  const mine = !!entry[S.me.id];
  const both = mine && pid && entry[pid]?.answers;
  const [title, sub] = both ? ['Результати чек-іну готові', 'Подивіться, як минув ваш тиждень']
    : mine ? ['Ти вже відповів(-ла) на цьому тижні', 'Результат відкриється, щойно відповість партнер.']
    : ['Чек-ін тижня', 'Пара хвилин про те, як минув ваш тиждень'];
  return `<button class="card banner" data-a="go" data-tab="more" data-sub="checkin">
    <span class="ic-box">${icon('hearthand')}</span><span class="grow"><b>${title}</b><br><span class="muted small">${sub}</span></span>${icon('chev', 20)}</button>`;
}

export function piggy(size = 70) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 100 80" aria-hidden="true"><ellipse cx="50" cy="52" rx="38" ry="26" fill="#EE6F98"/><path d="M14 40q2-16 14-14l2 10zM86 40q-2-16-14-14l-2 10z" fill="#EE6F98" stroke="#B83B6A" stroke-width="2"/><rect x="45" y="22" width="10" height="8" rx="2" fill="#B83B6A"/><ellipse cx="50" cy="58" rx="11" ry="8" fill="#F7A3BF" stroke="#B83B6A" stroke-width="2"/><circle cx="46" cy="58" r="2" fill="#B83B6A"/><circle cx="54" cy="58" r="2" fill="#B83B6A"/><circle cx="34" cy="50" r="3" fill="#4A1B2C"/><circle cx="66" cy="50" r="3" fill="#4A1B2C"/><path d="M30 34q8-8 18-8" stroke="#fff" stroke-width="3" fill="none" opacity=".6" stroke-linecap="round"/></svg>`;
}

function goalsCard(r) {
  const goals = r.goals.filter((g) => !g.archived).slice(0, 2);
  return goals.map((g) => `<button class="card goal-mini" data-a="go" data-tab="more" data-sub="goal:${g.id}">
    <span class="goal-art">${g.emoji ? `<span style="font-size:42px">${esc(g.emoji)}</span>` : piggy(64)}</span>
    <span class="grow"><b class="lg">${esc(g.title)}</b>${g.achieved ? ' ✅' : ''}<br><span class="muted">${money(g.saved)} з ${money(g.target)}</span>
    <span class="bar-track mt"><span class="bar-fill" style="width:${Math.min(100, (g.saved / g.target) * 100)}%"></span></span></span></button>`).join('');
}

function datesSection(r, t) {
  const list = r.dates.map((d) => {
    let next = d.date;
    if (d.yearly && d.date) { next = `${t.slice(0, 4)}${d.date.slice(4)}`; if (next < t) next = `${+t.slice(0, 4) + 1}${d.date.slice(4)}`; }
    return { ...d, next, left: next ? dayDiff(t, next) : null };
  }).sort((a, b) => (a.left ?? 1e9) - (b.left ?? 1e9));
  return `<div class="sec-h big"><span class="row"><span class="ic-box sm red">${icon('calheart', 20)}</span><b>Важливі дати пари</b></span><button class="btn sm" data-a="addDate">${icon('plus', 18)} Додати</button></div>
  ${list.length ? `<section class="card list">${list.map((d) => `<button class="li" data-a="editDate" data-id="${d.id}">
      <span class="li-ic">🎉</span><span class="grow"><b>${esc(d.title)}</b><br><span class="muted small">${fmtDate(d.date, { year: !d.yearly })}${d.yearly ? ' · щороку' : ''}</span></span>
      <span class="small ${d.left === 0 ? 'accent' : 'muted'}">${d.left === null ? '' : d.left === 0 ? 'Сьогодні!' : d.left < 0 ? 'минула' : `через ${d.left} ${plural(d.left, 'день', 'дні', 'днів')}`}</span></button>`).join('')}</section>`
    : `<div class="dashed muted center">Поки не додано жодної дати.</div>`}`;
}

/* ---------------- handlers ---------------- */
on('go', (el) => { if (el.dataset.day) { S.ui.calDay = el.dataset.day; S.ui.calMonth = el.dataset.day.slice(0, 7); S.ui.calMode = 'month'; } go(el.dataset.tab, el.dataset.sub || null); });
on('skipSteps', () => act({ type: 'skipSteps' }));
on('step', (el) => {
  const id = el.dataset.id;
  if (id === 'place') go('places');
  else if (id === 'mood') document.getElementById('mood')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  else if (id === 'note') H_noteSheet();
  else if (id === 'invite') share();
  else if (id === 'date') addDateForm();
});
on('mood', (el) => act({ type: 'mood', value: el.dataset.v }));
on('feed', async (el, e) => {
  e.stopPropagation();
  if (await act({ type: 'feed' })) { floaty('🐟'); setTimeout(() => floaty('💕'), 300); toast('Ням! +10 досвіду'); }
});

let taps = 0, tapTimer;
on('tap', () => {
  taps++;
  floaty(['💕', '✨', '❤️', '💗'][Math.floor(Math.random() * 4)], 1);
  const o = document.querySelector('.pet-otter');
  if (o) { o.classList.remove('squish'); void o.offsetWidth; o.classList.add('squish'); }
  clearTimeout(tapTimer);
  tapTimer = setTimeout(() => { const n = taps; taps = 0; act({ type: 'tap', n }, { silent: true }); }, 700);
});

function floaty(emoji, count = 3) {
  const stage = document.getElementById('stage');
  if (!stage) return;
  for (let i = 0; i < count; i++) {
    const s = document.createElement('span');
    s.className = 'floaty';
    s.textContent = emoji;
    s.style.setProperty('--dx', `${(Math.random() - 0.5) * 140}px`);
    s.style.animationDelay = `${i * 0.1}s`;
    stage.appendChild(s);
    setTimeout(() => s.remove(), 1500);
  }
}

on('petName', () => openForm({
  title: 'Імʼя улюбленця', fields: [{ key: 'name', label: 'Імʼя', value: S.room.pet.name, max: 20, required: true }],
  onSubmit: (v) => act({ type: 'petName', name: v.name }),
}));

on('petHelp', () => openSheet(`<h3 class="h3">Як доглядати за улюбленцем</h3>
  <div class="prose">
  <p>🐟 <b>Годуйте щодня.</b> Один з вас годує улюбленця раз на день — так росте вогник 🔥 (дні поспіль).</p>
  <p>👆 <b>Тапайте.</b> Кожен тап — крапля досвіду (до 30 за день кожному).</p>
  <p>✅ <b>Завдання дня.</b> Щодня три завдання, кожне дає +10 досвіду.</p>
  <p>👕 <b>Гардероб.</b> З новими рівнями відкривається вбрання.</p>
  <p>🌱 Малюк → Підліток (рівень 3) → Дорослий (6) → Мудрий (10).</p></div>
  <button class="btn block mt" data-close>Зрозуміло</button>`, (el) => { el.querySelector('[data-close]').onclick = closeSheet; }));

on('tasks', () => {
  const t = today();
  const day = S.room.daily?.[t]?.[S.me.id] || {};
  openSheet(`<h3 class="h3">Завдання дня</h3><p class="muted small">Кожне виконане завдання — +10 досвіду. Нові завдання — завтра.</p>
    <div class="list">${tasksFor(t).map((k) => {
      const done = day.claimed?.[k];
      const prog = Math.min(day[k] || 0, TASKS[k].goal);
      return `<div class="li ${done ? 'done' : ''}"><span class="li-ic">${done ? icon('check', 18) : '•'}</span><span class="grow">${TASKS[k].title}</span><span class="muted small">${TASKS[k].goal > 1 ? `${prog}/${TASKS[k].goal}` : done ? '+10' : ''}</span></div>`;
    }).join('')}</div>`);
});

on('wardrobe', (el, e) => {
  e.stopPropagation();
  const lv = levelInfo(S.room.pet.xp).level;
  openSheet(`<h3 class="h3">Гардероб</h3><p class="muted small">Нове вбрання відкривається з рівнями.</p>
    <div class="wardrobe-grid">${OUTFITS.map((o) => {
      const locked = lv < o.level;
      return `<button class="wd ${S.room.pet.outfit === o.id ? 'on' : ''} ${locked ? 'locked' : ''}" data-o="${o.id}" ${locked ? 'disabled' : ''}>
        <span class="wd-e">${o.emoji || '🦦'}</span><span>${o.name}</span>${locked ? `<span class="muted small">${icon('lock', 12)} рівень ${o.level}</span>` : ''}</button>`;
    }).join('')}</div>`, (el2) => {
    el2.querySelectorAll('[data-o]').forEach((b) => b.onclick = async () => { if (await act({ type: 'outfit', id: b.dataset.o })) closeSheet(); });
  });
});

/* ----- note / surprise ----- */
function H_noteSheet() {
  const t = today();
  openForm({
    title: 'Записка-сюрприз',
    intro: partnerId() ? `${partner().name} побачить її в розділі «Записки».` : 'Партнер побачить її, щойно приєднається.',
    fields: [
      { key: 'text', label: 'Текст', type: 'textarea', rows: 5, max: 1000, placeholder: 'Напиши щось тепле…', required: true },
      { key: 'when', label: 'Коли відкрити', type: 'select', value: 'now', options: [['now', 'Одразу'], ['1h', 'Через годину'], ['eve', 'Сьогодні о 20:00'], ['morn', 'Завтра о 9:00'], ['date', 'Обрати дату…']] },
      { key: 'date', label: 'Дата відкриття (якщо «Обрати дату»)', type: 'date', value: addDays(t, 1) },
    ],
    submitText: 'Надіслати 💌',
    onSubmit: async (v) => {
      const now = new Date();
      let openAt = null;
      if (v.when === '1h') openAt = Date.now() + 3600000;
      if (v.when === 'eve') { const d = new Date(now); d.setHours(20, 0, 0, 0); openAt = d > now ? +d : null; }
      if (v.when === 'morn') { const d = new Date(now); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); openAt = +d; }
      if (v.when === 'date' && v.date) openAt = +new Date(v.date + 'T09:00:00');
      const ok = await act({ type: 'note', text: v.text, openAt });
      if (ok) toast(openAt ? 'Записку запечатано до потрібного часу 🔒' : 'Записку надіслано 💌');
      return ok;
    },
  });
  const sheet = document.querySelector('.sheet form');
  if (sheet) sheet.insertAdjacentHTML('beforeend', `<button type="button" class="btn ghost block" data-blind>${icon('mask', 18)} Краще сплануй побачення наосліп</button>`);
  document.querySelector('[data-blind]')?.addEventListener('click', () => { closeSheet(); go('places'); setTimeout(() => import('./places.js').then((m) => m.blindForm()), 50); });
}
on('noteSheet', H_noteSheet);

/* ----- evening ----- */
const FILMS = ['Про час', 'Ла-Ла Ленд', 'Амелі', 'Перед світанком', 'Віднесені привидами', 'Готель «Гранд Будапешт»', 'Вгору', '500 днів літа', 'Мій сусід Тоторо', 'Римські канікули', 'Вічне сяйво чистого розуму', 'Назад у майбутнє', 'Паддінгтон 2', 'Інтерстеллар', 'Король Лев'];
const RECIPES = [
  ['Паста з томатами й базиліком', 'спагеті, томати, часник, оливкова олія, базилік, пармезан'],
  ['Сирники', 'кисломолочний сир, яйце, борошно, цукор, сметана'],
  ['Шакшука', 'яйця, томати, болгарський перець, цибуля, паприка, хліб'],
  ['Домашня піца', 'тісто, томатний соус, моцарела, шинка або гриби'],
  ['Різотто з грибами', 'рис арборіо, печериці, цибуля, бульйон, вершкове масло, сир'],
  ['Курка теріякі з рисом', 'куряче філе, соус теріякі, рис, кунжут, зелена цибуля'],
  ['Млинці з бананом і шоколадом', 'молоко, яйця, борошно, банан, шоколад'],
  ['Салат із запеченим гарбузом', 'гарбуз, рукола, фета, горіхи, мед, олія'],
  ['Тако з куркою', 'тортильї, курка, авокадо, томати, сир, лайм'],
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function eveningPick() {
  const myFilms = S.room.watch.filter((w) => !w.watched);
  const film = myFilms.length ? { title: pick(myFilms).title, own: true } : { title: pick(FILMS), own: false };
  const recipes = S.room.recipes;
  const rec = recipes.length ? (() => { const r = pick(recipes); return { title: r.title, info: r.ingredients.join(', '), own: true }; })() : (() => { const r = pick(RECIPES); return { title: r[0], info: r[1], own: false }; })();
  return { film, rec };
}
on('evening', () => {
  let e = eveningPick();
  const draw = () => `<h3 class="h3">Вечір удвох ✨</h3>
    <div class="eve"><span class="eve-ic">🎬</span><div class="grow"><div class="muted small">${e.film.own ? 'З вашого списку «Подивитися»' : 'Ідея фільму'}</div><b class="lg">${esc(e.film.title)}</b></div><button class="icon-btn sm" data-r="film" aria-label="Інший фільм">${icon('dice', 18)}</button></div>
    <div class="eve"><span class="eve-ic">🍝</span><div class="grow"><div class="muted small">${e.rec.own ? 'З ваших рецептів' : 'Ідея вечері'}</div><b class="lg">${esc(e.rec.title)}</b><div class="muted small">${esc(e.rec.info)}</div></div><button class="icon-btn sm" data-r="rec" aria-label="Інший рецепт">${icon('dice', 18)}</button></div>
    <button class="btn block mt" data-plan>${icon('cal', 18)} Запланувати на сьогодні</button>`;
  openSheet(draw(), (el) => {
    const bind = () => {
      el.querySelectorAll('[data-r]').forEach((b) => b.onclick = () => {
        const n = eveningPick();
        if (b.dataset.r === 'film') e.film = n.film; else e.rec = n.rec;
        el.innerHTML = '<div class="grab"></div>' + draw();
        bind();
      });
      el.querySelector('[data-plan]').onclick = async () => {
        if (await act({ type: 'add', col: 'events', item: { title: `Вечір: ${e.film.title} + ${e.rec.title}`, date: today(), time: '20:00', kind: 'date' } })) { closeSheet(); toast('Додано в календар 💞'); }
      };
    };
    bind();
  });
});

/* ----- dates ----- */
function addDateForm(d) {
  openForm({
    title: d ? 'Важлива дата' : 'Нова важлива дата',
    fields: [
      { key: 'title', label: 'Назва', value: d?.title, placeholder: 'День народження Юлі, перший поцілунок…', required: true },
      { key: 'date', label: 'Дата', type: 'date', value: d?.date, required: true },
      { key: 'yearly', label: 'Повторювати щороку', type: 'check', value: d ? d.yearly : true },
    ],
    onSubmit: (v) => (d ? act({ type: 'update', col: 'dates', id: d.id, patch: v }) : act({ type: 'add', col: 'dates', item: v })),
    onDelete: d ? () => act({ type: 'remove', col: 'dates', id: d.id }) : null,
  });
}
on('addDate', () => addDateForm());
on('editDate', (el) => addDateForm(S.room.dates.find((x) => x.id === el.dataset.id)));
on('addStart', () => openForm({
  title: 'Коли все почалося?',
  fields: [{ key: 'date', label: 'Дата початку стосунків', type: 'date', value: S.room.startDate || '', required: true }],
  onSubmit: (v) => act({ type: 'startDate', date: v.date }),
  onDelete: S.room.startDate ? () => act({ type: 'startDate', date: null }) : null,
}));

export async function share() {
  const text = `Приєднуйся до нашого куточка в Ottership 🦦❤️\nКод пари: ${S.room.code}\n${location.origin}`;
  try {
    if (navigator.share) await navigator.share({ title: 'Ottership', text });
    else { await navigator.clipboard.writeText(text); toast('Запрошення скопійовано'); }
  } catch {}
}
on('invite', share);
void emptyState;
