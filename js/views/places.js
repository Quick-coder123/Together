// «Місця» — places and dates.
import { S, on, act, openSheet, closeSheet, openForm, toast, today, nameOf, ui, LS } from '../store.js';
import { esc, icon, emptyState, fmtDate, otter, mapScene } from '../ui.js';
import { geocodeCity, reverse, nearbyPlaces, suggestCities, reportMapError } from '../osm.js';

export const CATS = {
  cafe: ['☕', 'Кафе'], restaurant: ['🍽️', 'Ресторан'], bar: ['🍷', 'Бар'], park: ['🌳', 'Парк'], museum: ['🖼️', 'Виставка / музей'],
  cinema: ['🎬', 'Кіно / театр'], nature: ['🏞️', 'Природа'], active: ['🛼', 'Активний відпочинок'], home: ['🏠', 'Вдома'], other: ['✨', 'Інше'],
};

export function placesView() {
  const r = S.room;
  const mode = ui('placeMode', 'spont');
  const q = ui('placeQ', '');
  const f = ui('placeFilter', { cat: '', status: 'all' });
  const list = r.places
    .filter((p) => (mode === 'plan' ? p.mode === 'plan' : p.mode !== 'plan'))
    .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))
    .filter((p) => !f.cat || p.cat === f.cat)
    .filter((p) => f.status === 'all' || (f.status === 'todo' ? !p.visited : p.visited))
    .sort((a, b) => (a.visited - b.visited) || (mode === 'plan' ? String(a.date).localeCompare(String(b.date)) : b.ts - a.ts));
  const t = today();
  const blind = r.blind.filter((b) => !b.date || b.date >= t || b.by === S.me.id).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const filtered = f.cat || f.status !== 'all';

  return `
  <div class="page-h"><h1>Місця і побачення</h1><button class="fab" data-a="addPlace" aria-label="Додати місце">${icon('plus', 26)}</button></div>
  <div class="grid2">
    <button class="tile warm" data-a="randomPlace"><span class="tile-ic">${icon('dice')}</span><b>Випадкове місце</b><span>Довіритися випадку</span></button>
    <button class="tile sparkles" data-a="blind"><span class="tile-ic">${icon('mask')}</span><b>Побачення наосліп</b><span>Сюрприз для партнера</span></button>
  </div>
  ${blind.map(blindCard).join('')}
  <button class="card ai-where" data-a="whereGo">
    <span class="ic-box guide-ic">🦎</span>
    <span class="grow"><b>Куди піти?</b><br><span class="muted small">Гід-хамелеон Хамі знайде цікаві місця біля тебе або в обраному місті</span></span>${icon('chev', 18)}
  </button>
  <div class="seg big">
    <button class="seg-b ${mode === 'spont' ? 'on' : ''}" data-a="placeMode" data-v="spont">${icon('bolt', 18)} Спонтанне</button>
    <button class="seg-b ${mode === 'plan' ? 'on' : ''}" data-a="placeMode" data-v="plan">${icon('cal', 18)} Заплановане</button>
  </div>
  <div class="row gap">
    <label class="search grow">${icon('search', 20)}<input id="place-q" type="search" placeholder="Пошук за назвою місця…" value="${esc(q)}"></label>
    <button class="icon-btn lg ${filtered ? 'on' : ''}" data-a="placeFilter" aria-label="Фільтр">${icon('filter', 22)}</button>
  </div>
  ${list.length ? `<div class="cards">${list.map(placeCard).join('')}</div>`
    : r.places.length ? `<p class="center muted pad">Нічого не знайдено.</p>`
    : emptyState('Поки порожньо — додай перше місце.', 'Кафе, парк, виставка — все, куди хочеться сходити вдвох.', `<button class="btn" data-a="addPlace">${icon('plus', 18)} Додати місце</button>`)}`;
}

function placeCard(p) {
  const [em, cat] = CATS[p.cat] || CATS.other;
  const addrUrl = isUrl(p.address) ? p.address.trim() : '';
  const link = addrUrl || (isUrl(p.map) ? p.map : '') || (p.address ? mapUrl(p.address) : '');
  const host = addrUrl ? addrUrl.replace(/^https?:\/\/(www\.|m\.)?/i, '').split(/[/?#]/)[0] : '';
  const isMap = !addrUrl || /maps|goo\.gl|openstreetmap|2gis|waze/i.test(host);
  return `<div class="card place ${p.visited ? 'visited' : ''}" data-a="editPlace" data-id="${p.id}" role="button" tabindex="0">
    <span class="place-em">${em}</span>
    <span class="grow"><b>${esc(p.name)}</b><br><span class="muted small">${cat}${p.mode === 'plan' && p.date ? ` · ${fmtDate(p.date)}${p.time ? ' ' + p.time : ''}` : ''}${p.address && !addrUrl ? ' · ' + esc(p.address) : host ? ' · ' + esc(host) : ''}</span>
    ${p.visited ? `<br><span class="small ok-t">${icon('check', 14)} Були${p.rating ? ' · ' + '★'.repeat(p.rating) : ''}</span>` : ''}</span>
    ${link ? `<a class="go-btn" href="${esc(link)}" target="_blank" rel="noopener" aria-label="${isMap ? 'Відкрити на мапі' : 'Перейти за посиланням'}">${icon(isMap ? 'pin' : 'out', 16)}<span>${isMap ? 'Мапа' : 'Відкрити'}</span></a>` : ''}
    <span class="check-b ${p.visited ? 'on' : ''}" data-a="visitPlace" data-id="${p.id}" role="checkbox" aria-checked="${!!p.visited}" aria-label="Були тут">${p.visited ? icon('check', 16) : ''}</span>
  </div>`;
}

const isUrl = (v) => /^https?:\/\//i.test(v || '');
export const mapUrl = (v) => (isUrl(v) ? v : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(v)}`);
function meetRow(v) {
  return `<div class="meet mt"><span class="meet-ic">📍</span><span class="grow"><span class="muted small">Місце зустрічі</span><br><b>${isUrl(v) ? 'Локація на мапі' : esc(v)}</b></span>
    <a class="btn sm secondary" href="${esc(mapUrl(v))}" target="_blank" rel="noopener">${icon('pin', 16)} Мапа</a></div>`;
}
function blindCard(b) {
  const mineB = b.by === S.me.id;
  const open = mineB || b.revealed || (b.date && b.date <= today());
  return `<section class="card blind" ${mineB ? `data-a="editBlind" data-id="${b.id}"` : ''}>
    <div class="row"><span class="ic-box pink">${icon('mask')}</span><div class="grow"><b>${mineB ? 'Твоє побачення наосліп' : `Сюрприз для тебе · ${esc(nameOf(b.by))}`}</b><br>
    <span class="muted small">${b.date ? fmtDate(b.date, { weekday: true }) : 'Дата ще не обрана'}${b.time ? ' · ' + b.time : ''}</span></div>${mineB ? icon('pencil', 18) : ''}</div>
    ${b.meet ? meetRow(b.meet) : ''}
    ${b.hint ? `<div class="hint">💡 ${esc(b.hint)}</div>` : ''}
    ${b.dress ? `<div class="small mt">👗 Дрес-код: ${esc(b.dress)}</div>` : ''}
    ${open && b.details ? `<div class="answer mt">${esc(b.details)}</div>` : !open ? `<div class="small muted mt">${icon('lock', 14)} Деталі відкриються в день побачення</div>` : ''}
    ${mineB && !b.revealed ? `<button class="btn sm ghost mt" data-a="revealBlind" data-id="${b.id}">Розкрити зараз</button>` : ''}
  </section>`;
}

/* ---------------- handlers ---------------- */
export function placeForm(p, preset = {}) {
  const v = p || { mode: ui('placeMode', 'spont'), cat: 'cafe', ...preset };
  openForm({
    title: p ? 'Місце' : 'Нове місце',
    fields: [
      { key: 'name', label: 'Назва', value: v.name, placeholder: 'Кавʼярня на Подолі', required: true, max: 80 },
      { key: 'cat', label: 'Категорія', type: 'select', value: v.cat, options: Object.entries(CATS).map(([k, [e, l]]) => [k, `${e} ${l}`]) },
      { key: 'mode', label: 'Тип', type: 'seg', value: v.mode || 'spont', options: [['spont', '⚡ Спонтанне'], ['plan', '📅 Заплановане']] },
      { key: 'date', label: 'Дата (для запланованого)', type: 'date', value: v.date },
      { key: 'time', label: 'Час', type: 'time', value: v.time },
      { key: 'address', label: 'Адреса або посилання', value: v.address, max: 300, placeholder: 'вул. Хрещатик, 1 або https://…' },
      { key: 'note', label: 'Нотатка', type: 'textarea', value: v.note, max: 400 },
      ...(p ? [{ key: 'visited', label: 'Ми тут уже були', type: 'check', value: p.visited }, { key: 'rating', label: 'Оцінка', type: 'seg', value: p.rating || '', options: [['', '—'], ['1', '★'], ['2', '★★'], ['3', '★★★'], ['4', '★★★★'], ['5', '★★★★★']] }] : []),
    ],
    onSubmit: (val) => {
      if (val.mode === 'plan' && !val.date) { toast('Для запланованого обери дату'); return false; }
      if ('rating' in val) val.rating = val.rating ? Number(val.rating) : null;
      return p ? act({ type: 'update', col: 'places', id: p.id, patch: val }) : act({ type: 'add', col: 'places', item: val });
    },
    onDelete: p ? () => act({ type: 'remove', col: 'places', id: p.id }) : null,
  });
}
on('addPlace', () => placeForm());
on('editPlace', (el) => placeForm(S.room.places.find((x) => x.id === el.dataset.id)));
on('visitPlace', (el) => {
  const p = S.room.places.find((x) => x.id === el.dataset.id);
  if (p) act({ type: 'update', col: 'places', id: p.id, patch: { visited: !p.visited } });
});
on('placeMode', (el) => { S.ui.placeMode = el.dataset.v; S.render(); });
on('placeFilter', () => {
  const f = ui('placeFilter', { cat: '', status: 'all' });
  openForm({
    title: 'Фільтр', noFocus: true,
    fields: [
      { key: 'cat', label: 'Категорія', type: 'select', value: f.cat, options: [['', 'Усі'], ...Object.entries(CATS).map(([k, [e, l]]) => [k, `${e} ${l}`])] },
      { key: 'status', label: 'Статус', type: 'seg', value: f.status, options: [['all', 'Усі'], ['todo', 'Ще не були'], ['done', 'Вже були']] },
    ],
    submitText: 'Показати',
    onSubmit: (v) => { S.ui.placeFilter = v; S.render(); return true; },
  });
});

on('randomPlace', () => {
  const pool = S.room.places.filter((p) => !p.visited);
  if (!pool.length) {
    toast(S.room.places.length ? 'Ви вже побували скрізь зі списку — додайте нові місця!' : 'Спершу додай кілька місць');
    return;
  }
  const show = () => {
    const p = pool[Math.floor(Math.random() * pool.length)];
    const [em, cat] = CATS[p.cat] || CATS.other;
    openSheet(`<div class="center"><div class="dice-big">🎲</div><div class="muted small">Сьогодні йдемо в…</div>
      <div class="rnd-em">${em}</div><h2 class="h2">${esc(p.name)}</h2><div class="muted">${cat}${p.address ? ' · ' + esc(p.address) : ''}</div>
      ${p.note ? `<p class="small">${esc(p.note)}</p>` : ''}</div>
      <button class="btn block mt" data-plan>${icon('cal', 18)} Іти сьогодні</button>
      <button class="btn secondary block" data-again>${icon('dice', 18)} Ще раз</button>
      <button class="btn ghost block" data-cancel>Не зараз</button>`, (el) => {
      el.querySelector('[data-cancel]').onclick = closeSheet;
      el.querySelector('[data-again]').onclick = show;
      el.querySelector('[data-plan]').onclick = async () => {
        if (await act({ type: 'update', col: 'places', id: p.id, patch: { mode: 'plan', date: today() } })) { closeSheet(); toast('Заплановано на сьогодні 💞'); }
      };
    });
  };
  show();
});

export function blindForm(b) {
  openForm({
    title: b ? 'Побачення наосліп' : 'Сплануй побачення наосліп',
    intro: 'Партнер бачитиме дату, час, місце зустрічі й підказку. Секретний план відкриється в день побачення.',
    fields: [
      { key: 'date', label: 'Дата', type: 'date', value: b?.date, required: true },
      { key: 'time', label: 'Час', type: 'time', value: b?.time },
      { key: 'meet', label: 'Місце зустрічі', value: b?.meet, placeholder: 'Адреса або посилання на мапу', max: 300 },
      { key: 'hint', label: 'Підказка для партнера', value: b?.hint, placeholder: 'Візьми теплий светр 😉', max: 120 },
      { key: 'dress', label: 'Дрес-код', value: b?.dress, placeholder: 'Зручне взуття', max: 80 },
      { key: 'details', label: 'Секретний план (видно лише тобі)', type: 'textarea', rows: 4, value: b?.details, max: 600 },
    ],
    submitText: b ? 'Зберегти' : 'Запланувати 🎭',
    onSubmit: (v) => (b ? act({ type: 'update', col: 'blind', id: b.id, patch: v }) : act({ type: 'add', col: 'blind', item: v })),
    onDelete: b ? () => act({ type: 'remove', col: 'blind', id: b.id }) : null,
  });
}
on('blind', () => blindForm());
on('editBlind', (el, e) => { if (e.target.closest('[data-a="revealBlind"]')) return; blindForm(S.room.blind.find((x) => x.id === el.dataset.id)); });
on('revealBlind', (el) => { if (confirm('Розкрити план партнеру зараз?')) act({ type: 'update', col: 'blind', id: el.dataset.id, patch: { revealed: true } }); });

/* ---------------- AI: where to go ---------------- */
const WHERE_KINDS = [['any', '🎲 Будь-що'], ['coffee', '☕ Кава й десерти'], ['food', '🍽️ Поїсти'], ['walk', '🌳 Прогулянка'], ['culture', '🎭 Культура'], ['active', '🛼 Активно'], ['evening', '🌙 Вечір']];
const km = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} м` : `${(m / 1000).toFixed(1).replace('.', ',')} км`);

function whereForm(sh, note = '') {
  const k = ui('whereKind', 'any');
  const city = LS.get('lastCity', '');
  sh.innerHTML = `<div class="grab"></div>
    <div class="sheet-h"><h3>🦎 Гід-хамелеон</h3></div>
    <p class="muted small" style="margin-top:-6px">Хамі розгорне мапу, знайде справжні місця поруч і підкаже, що там зробити удвох.</p>
    ${note ? `<div class="info-bar small">📍 ${esc(note)}</div>` : ''}
    <div class="sec-label">ЩО ХОЧЕТЬСЯ</div>
    <div class="pills wrap-pills">${WHERE_KINDS.map(([v, l]) => `<button class="pill ${k === v ? 'on' : ''}" data-k="${v}">${l}</button>`).join('')}</div>
    <div class="sec-label">ДЕ ШУКАЄМО</div>
    <button class="btn block" data-geo>${icon('pin', 18)} Біля мене</button>
    <div class="divider-t">або в місті</div>
    <div class="city-box">
      <form class="add-line" data-city-form>${icon('search', 20)}<input id="where-city" placeholder="Почни писати місто…" value="${esc(city)}" maxlength="80" autocomplete="off" autocorrect="off" enterkeyhint="search"><button class="send sm" type="submit" aria-label="Шукати">${icon('chev', 18)}</button></form>
      <div class="city-sug" hidden></div>
    </div>`;
  sh.querySelectorAll('[data-k]').forEach((b) => b.onclick = () => { S.ui.whereKind = b.dataset.k; sh.querySelectorAll('[data-k]').forEach((x) => x.classList.toggle('on', x === b)); });
  sh.querySelector('[data-geo]').onclick = () => {
    if (!navigator.geolocation) { toast('Цей браузер не дає геолокацію. Вкажи місто.'); return; }
    whereLoading(sh, ['Хамі визначає, де ви…']);
    let done = false;
    const fail = (err) => {
      if (done) return; done = true;
      const ios = /iPhone|iPad/.test(navigator.userAgent);
      const msg = err?.code === 1
        ? (ios ? 'Доступ до геолокації вимкнено. Увімкни: Параметри → Приватність → Служби локації → Safari (або цей застосунок) → «Під час використання». Або просто вкажи місто.' : 'Доступ до геолокації заборонено. Дозволь його в налаштуваннях браузера або вкажи місто.')
        : 'Не вдалося визначити, де ви. Спробуй ще раз або вкажи місто.';
      whereForm(sh, msg);
    };
    navigator.geolocation.getCurrentPosition(
      (pos) => { if (done) return; done = true; whereSearch(sh, { lat: pos.coords.latitude, lon: pos.coords.longitude }); },
      fail,
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
    );
    setTimeout(() => fail({ code: 3 }), 20000);
  };
  // City suggestions while typing.
  const inp = sh.querySelector('#where-city');
  const box = sh.querySelector('.city-sug');
  let sugTimer, sugCtl, sugList = [];
  const showSug = (list, q) => {
    sugList = list;
    if (!list.length) { box.hidden = !q; box.innerHTML = q ? '<div class="sug-empty muted small">Нічого не знайшли — спробуй інакше</div>' : ''; return; }
    box.hidden = false;
    box.innerHTML = list.map((c, i) => `<button type="button" class="sug" data-i="${i}">📍 <span class="grow"><b>${esc(c.name)}</b>${c.sub ? `<br><span class="muted small">${esc(c.sub)}</span>` : ''}</span></button>`).join('');
    box.querySelectorAll('.sug').forEach((b) => b.onclick = () => {
      const c = sugList[+b.dataset.i];
      LS.set('lastCity', c.name);
      whereSearch(sh, { lat: c.lat, lon: c.lon, radius: c.radius, label: c.name });
    });
  };
  inp.addEventListener('focus', () => setTimeout(() => inp.scrollIntoView({ block: 'start', behavior: 'smooth' }), 300));
  inp.addEventListener('input', () => {
    const q = inp.value.trim();
    clearTimeout(sugTimer); sugCtl?.abort();
    if (q.length < 2) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false; box.innerHTML = '<div class="sug-empty muted small">Хамі шукає на мапі…</div>';
    sugTimer = setTimeout(async () => {
      sugCtl = new AbortController();
      try { showSug(await suggestCities(q, sugCtl.signal), q); } catch (e) { if (e.name !== 'AbortError') { box.hidden = true; } }
    }, 300);
  });
  sh.querySelector('[data-city-form]').onsubmit = (e) => {
    e.preventDefault();
    const c = sh.querySelector('#where-city').value.trim();
    if (!c) { toast('Напиши місто'); return; }
    LS.set('lastCity', c);
    whereSearch(sh, { city: c });
  };
}
let loadTimer;
function whereLoading(sh, lines) {
  clearInterval(loadTimer);
  sh.innerHTML = `<div class="grab"></div><div class="center">${mapScene()}<b class="load-line">${esc(lines[0])}</b><p class="muted small">Зазвичай 5–20 секунд</p></div>
    <button class="btn ghost block" data-cancel>Скасувати</button>`;
  sh.querySelector('[data-cancel]').onclick = () => { clearInterval(loadTimer); closeSheet(); };
  let i = 0;
  loadTimer = setInterval(() => {
    const el = sh.querySelector('.load-line');
    if (!el) { clearInterval(loadTimer); return; }
    i = (i + 1) % lines.length;
    el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap');
    el.textContent = lines[i];
  }, 2200);
}
const SEARCH_LINES = ['Хамі розгортає мапу…', 'Шукає затишні місця поруч…', 'Принюхується до найсмачнішої кави…', 'Ставить сердечка на мапі…', 'Вибирає найкраще для вас двох…'];
async function whereSearch(sh, where) {
  whereLoading(sh, SEARCH_LINES);
  try {
    let point = where;
    let label = where.label || '';
    if (where.city) {
      const g = await geocodeCity(where.city);
      if (!g) throw new Error(`Хамі не знайшов «${where.city}» на мапі. Спробуй написати інакше.`);
      point = g; label = g.label;
    } else if (!label) {
      label = await reverse(where.lat, where.lon);
    }
    const cands = await nearbyPlaces({
      lat: point.lat, lon: point.lon, radius: point.radius || 2500, kind: ui('whereKind', 'any'), exclude: S.room.places.map((p) => p.name),
      onFallback: (e) => reportMapError(S.code, S.me.id, 'fallback: ' + e.message),
    });
    if (!cands.length) throw new Error('Поруч не знайшли підходящих місць. Спробуй інший тип або місто.');
    const res = await fetch('/api/places', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: S.code, member: S.me.id, kind: ui('whereKind', 'any'), where: label, cands }) });
    const data = await res.json().catch(() => ({}));
    if (!sh.isConnected) return;
    if (!res.ok) throw new Error(data.error === 'not_configured' ? 'Сервер ще не підключено до бази даних.' : data.error || 'Не вдалося знайти місця.');
    clearInterval(loadTimer);
    whereResults(sh, data, where);
  } catch (e) {
    clearInterval(loadTimer);
    reportMapError(S.code, S.me.id, (e.detail ? e.detail + ' | ' : '') + e.message);
    if (!sh.isConnected) return;
    const msg = /Failed to fetch|NetworkError|Load failed/i.test(e.message) ? 'Немає звʼязку. Перевір інтернет.' : e.message;
    sh.innerHTML = `<div class="grab"></div><div class="center pad">${otter({ face: 'sad', size: 100 })}<p>${esc(msg)}</p></div>
      <button class="btn block" data-retry>Спробувати ще</button><button class="btn secondary block" data-back>Змінити місце</button><button class="btn ghost block" data-cancel>Закрити</button>`;
    sh.querySelector('[data-cancel]').onclick = closeSheet;
    sh.querySelector('[data-retry]').onclick = () => whereSearch(sh, where);
    sh.querySelector('[data-back]').onclick = () => whereForm(sh);
  }
}
function whereResults(sh, data, where) {
  sh.innerHTML = `<div class="grab"></div>
    <div class="sheet-h"><h3>${data.where ? `📍 ${esc(data.where)}` : '📍 Поруч'}</h3><button class="btn sm secondary" data-back>Змінити</button></div>
    <p class="muted small" style="margin-top:-4px">${data.ai ? '🦎 Хамі вибрав для вас:' : '🦎 Хамі знайшов поруч:'}</p>
    <div class="where-list">${data.places.map((p, i) => {
      const [em, cat] = CATS[p.cat] || CATS.other;
      return `<div class="where-i" style="--i:${i}">
        <div class="row"><span class="place-em">${em}</span><div class="grow"><b>${esc(p.name)}</b><br><span class="muted small">${cat} · ${km(p.dist)}${p.address ? ' · ' + esc(p.address) : ''}</span></div></div>
        ${p.why ? `<p class="small" style="margin:8px 0 0">${esc(p.why)}</p>` : ''}
        ${p.idea ? `<div class="hint small">💡 ${esc(p.idea)}</div>` : ''}
        <div class="row gap mt"><a class="btn sm secondary" href="${esc(p.map)}" target="_blank" rel="noopener">${icon('pin', 16)} Мапа</a><button class="btn sm" data-add="${i}">${icon('plus', 16)} Додати</button></div>
      </div>`;
    }).join('')}</div>
    <button class="btn secondary block" data-more>${icon('dice', 18)} Інші варіанти</button>
    <button class="btn ghost block" data-cancel>Готово, закрити</button>
    <p class="center muted small">Дані мапи © OpenStreetMap</p>`;
  sh.querySelector('[data-back]').onclick = () => whereForm(sh);
  sh.querySelector('[data-cancel]').onclick = closeSheet;
  sh.querySelector('[data-more]').onclick = () => whereSearch(sh, where);
  sh.querySelectorAll('[data-add]').forEach((b) => b.onclick = async () => {
    const p = data.places[+b.dataset.add];
    b.disabled = true;
    const note = [p.why, p.idea && '💡 ' + p.idea].filter(Boolean).join('\n');
    const ok = await act({ type: 'add', col: 'places', item: { name: p.name, cat: p.cat, mode: 'spont', address: p.address, map: p.map, note } });
    if (ok) { b.innerHTML = `${icon('check', 16)} Додано`; b.classList.add('done'); } else b.disabled = false;
  });
}
on('whereGo', () => { const sh = openSheet(''); whereForm(sh); });
