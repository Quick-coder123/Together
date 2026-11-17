// «Місця» — places and dates.
import { S, on, act, openSheet, closeSheet, openForm, toast, today, nameOf, ui } from '../store.js';
import { esc, icon, emptyState, fmtDate } from '../ui.js';

export const CATS = {
  cafe: ['☕', 'Кафе'], restaurant: ['🍽️', 'Ресторан'], park: ['🌳', 'Парк'], museum: ['🖼️', 'Виставка / музей'],
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
  return `<button class="card place ${p.visited ? 'visited' : ''}" data-a="editPlace" data-id="${p.id}">
    <span class="place-em">${em}</span>
    <span class="grow"><b>${esc(p.name)}</b><br><span class="muted small">${cat}${p.mode === 'plan' && p.date ? ` · ${fmtDate(p.date)}${p.time ? ' ' + p.time : ''}` : ''}${p.address ? ' · ' + esc(p.address) : ''}</span>
    ${p.visited ? `<br><span class="small ok-t">${icon('check', 14)} Були${p.rating ? ' · ' + '★'.repeat(p.rating) : ''}</span>` : ''}</span>
    <span class="check-b ${p.visited ? 'on' : ''}" data-a="visitPlace" data-id="${p.id}" role="checkbox" aria-checked="${!!p.visited}" aria-label="Були тут">${p.visited ? icon('check', 16) : ''}</span>
  </button>`;
}

function blindCard(b) {
  const mineB = b.by === S.me.id;
  const open = mineB || b.revealed || (b.date && b.date <= today());
  return `<section class="card blind" ${mineB ? `data-a="editBlind" data-id="${b.id}"` : ''}>
    <div class="row"><span class="ic-box pink">${icon('mask')}</span><div class="grow"><b>${mineB ? 'Твоє побачення наосліп' : `Сюрприз для тебе · ${esc(nameOf(b.by))}`}</b><br>
    <span class="muted small">${b.date ? fmtDate(b.date, { weekday: true }) : 'Дата ще не обрана'}${b.time ? ' · ' + b.time : ''}</span></div>${mineB ? icon('pencil', 18) : ''}</div>
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
      { key: 'address', label: 'Адреса або посилання', value: v.address, max: 200 },
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
      <button class="btn secondary block" data-again>${icon('dice', 18)} Ще раз</button>`, (el) => {
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
    intro: 'Партнер бачитиме лише дату, час і підказку. Деталі відкриються в день побачення.',
    fields: [
      { key: 'date', label: 'Дата', type: 'date', value: b?.date, required: true },
      { key: 'time', label: 'Час', type: 'time', value: b?.time },
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
