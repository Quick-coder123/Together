// «Ще» and its sections: trips, calendar, goals, check-in, notes, settings, FAQ.
import { S, on, act, go, openSheet, closeSheet, openForm, toast, today, partnerId, partner, meM, nameOf, ui, LS, leave } from '../store.js';
import { esc, icon, emptyState, avatar, fmtDate, fmtRange, money, MONTHS, WEEKDAYS, ago, plural, resizeImage, otter } from '../ui.js';
import { addDays, weekStart, checkinWeek, CHECKIN_QUESTIONS, levelInfo } from '/lib/core.js';
import { itemsBetween, KIND } from '../derive.js';
import { piggy, share } from './me.js';
import { placeForm, blindForm } from './places.js';

const back = () => `<button class="back" data-a="go" data-tab="more">${icon('back', 18)} Ще</button>`;

export function moreView(sub) {
  if (!sub) return moreHome();
  if (sub === 'trips') return tripsView();
  if (sub.startsWith('trip:')) return tripView(sub.slice(5));
  if (sub === 'calendar') return calendarView();
  if (sub === 'goals') return goalsView();
  if (sub.startsWith('goal:')) return goalView(sub.slice(5));
  if (sub === 'checkin') return checkinView();
  if (sub === 'notes') return notesView();
  if (sub === 'settings') return settingsView();
  if (sub === 'faq') return faqView();
  return moreHome();
}

function moreHome() {
  const seen = LS.get('seenNotes', 0);
  const fresh = S.room.notes.filter((n) => n.from !== S.me.id && n.ts > seen).length;
  const row = (attrs, ic, grad, title, text, extra = '') => `<button class="li menu" ${attrs}>
    <span class="menu-ic" style="background:${grad}">${icon(ic, 20)}</span>
    <span class="grow"><b>${title}</b>${extra}<br><span class="muted small">${text}</span></span>${icon('chev', 18)}</button>`;
  const sub = (k) => `data-a="go" data-tab="more" data-sub="${k}"`;
  return `<div class="page-h"><div><h1>Ще</h1><p class="muted">Решта розділів застосунку.</p></div></div>
  <div class="sec-label">РАЗОМ</div>
  <section class="card list flush menu-card">
    ${row(sub('calendar'), 'cal', 'linear-gradient(135deg,#F2545B,#F59E42)', 'Календар', 'Усі зустрічі й події')}
    ${row(sub('notes'), 'send', 'linear-gradient(135deg,#FF8A8A,#E6566E)', 'Записки', 'Листи й сюрпризи одне одному', fresh ? ` <span class="badge">${fresh}</span>` : '')}
    ${row(sub('checkin'), 'hearthand', 'linear-gradient(135deg,#E14FD3,#8B5CF6)', 'Чек-ін пари', 'Як минув ваш тиждень')}
    ${row('data-a="blindNew"', 'mask', 'linear-gradient(135deg,#B06AB3,#4568DC)', 'Побачення наосліп', 'Спланувати сюрприз')}
  </section>
  <div class="sec-label">ПЛАНИ</div>
  <section class="card list flush menu-card">
    ${row(sub('trips'), 'pin', 'linear-gradient(135deg,#22C1EE,#3B6FF0)', 'Подорожі', 'Напрямки, місця й бюджет')}
    ${row(sub('goals'), 'piggy', 'linear-gradient(135deg,#F7A531,#EE4D8A)', 'Цілі й скарбнички', 'Копіть разом на важливе')}
  </section>
  <div class="sec-label">НАЛАШТУВАННЯ І ПІДТРИМКА</div>
  <section class="card list flush menu-card">
    ${row(sub('settings'), 'gear', 'linear-gradient(135deg,#8E8E93,#5E5E66)', 'Налаштування', 'Профіль, вхід, оформлення')}
    ${row(sub('faq'), 'help', 'linear-gradient(135deg,#5FB98A,#2F8F6A)', 'Часті питання', 'Відповіді на популярні питання')}
  </section>`;
}
on('blindNew', () => blindForm());

/* ================= trips ================= */
function tripsView() {
  const r = S.room;
  return `${back()}<div class="page-h"><div><h1>Подорожі</h1><p class="muted">Планер поїздок: напрямки, свої місця всередині кожного й орієнтовний бюджет.</p></div></div>
  <div class="sec-label">${icon('globe', 16)} НАПРЯМКИ</div>
  <p class="muted small">Повноцінний планер: місця всередині, дати, бюджет і збори.</p>
  <button class="dashed-btn" data-a="tripForm">+ Додати напрямок</button>
  ${r.trips.length ? `<div class="cards">${r.trips.map((t) => {
    const spent = (t.expenses || []).reduce((s, e) => s + e.amount, 0);
    return `<button class="card place" data-a="go" data-tab="more" data-sub="trip:${t.id}"><span class="place-em">🧳</span><span class="grow"><b>${esc(t.name)}</b><br>
      <span class="muted small">${t.start ? fmtRange(t.start, t.end) : 'Дати ще не обрані'} · ${t.places.length} ${plural(t.places.length, 'місце', 'місця', 'місць')}${t.budget ? ` · ${money(spent)} з ${money(t.budget)}` : ''}</span></span>${icon('chev', 18)}</button>`;
  }).join('')}</div>` : `<div class="dashed muted center">Поки немає напрямків — додай перший.</div>`}
  <div class="sec-label mt2">${icon('plane', 16)} ШВИДКІ ВІДМІТКИ</div>
  <p class="muted small">Просто відмітити, куди й коли їздили, — без планера.</p>
  ${r.tripLog.length ? `<section class="card list">${[...r.tripLog].sort((a, b) => String(b.date).localeCompare(String(a.date))).map((x) => `<button class="li" data-a="tripLogForm" data-id="${x.id}"><span class="li-ic">📍</span><span class="grow"><b>${esc(x.place)}</b><br><span class="muted small">${x.date ? fmtDate(x.date, { year: true }) : ''}${x.note ? ' · ' + esc(x.note) : ''}</span></span></button>`).join('')}</section>`
    : `<p class="muted">Поки не додано жодної поїздки.</p>`}
  <button class="dashed-btn" data-a="tripLogForm">+ Додати поїздку</button>`;
}

function tripView(id) {
  const t = S.room.trips.find((x) => x.id === id);
  if (!t) return `${back()}<p class="muted pad">Поїздку не знайдено.</p>`;
  const tab = ui('tripTab', 'places');
  const spent = (t.expenses || []).reduce((s, e) => s + e.amount, 0);
  const list = t[tab] || [];
  return `<button class="back" data-a="go" data-tab="more" data-sub="trips">${icon('back', 18)} Подорожі</button>
  <section class="card trip-head">
    <div class="row"><span class="place-em">🧳</span><div class="grow"><h2 class="h2">${esc(t.name)}</h2><div class="muted small">${t.start ? fmtRange(t.start, t.end) : 'Дати ще не обрані'}</div></div>
    <button class="icon-btn sm" data-a="tripForm" data-id="${t.id}" aria-label="Редагувати">${icon('pencil', 18)}</button></div>
    ${t.note ? `<p class="small">${esc(t.note)}</p>` : ''}
    ${t.budget ? `<div class="row small mt"><span>Бюджет</span><span class="grow"></span><b>${money(spent)} / ${money(t.budget)}</b></div><div class="bar-track"><div class="bar-fill ${spent > t.budget ? 'over' : ''}" style="width:${Math.min(100, (spent / t.budget) * 100)}%"></div></div>`
      : spent ? `<div class="small mt">Витрачено: <b>${money(spent)}</b></div>` : ''}
  </section>
  <div class="seg big three">
    <button class="seg-b ${tab === 'places' ? 'on' : ''}" data-a="tripTab" data-v="places">📍 Місця</button>
    <button class="seg-b ${tab === 'pack' ? 'on' : ''}" data-a="tripTab" data-v="pack">🎒 Збори</button>
    <button class="seg-b ${tab === 'expenses' ? 'on' : ''}" data-a="tripTab" data-v="expenses">💸 Витрати</button>
  </div>
  <form class="add-line" data-form="tripSub" data-id="${t.id}" data-list="${tab}">${icon('plus', 22)}
    <input id="trip-in" placeholder="${tab === 'places' ? 'Що побачити або куди сходити…' : tab === 'pack' ? 'Що взяти з собою…' : 'На що витратили…'}" maxlength="100" autocomplete="off">
    ${tab === 'expenses' ? '<input id="trip-amt" class="amt" type="number" inputmode="decimal" placeholder="₴">' : ''}<button class="send sm" type="submit" aria-label="Додати">${icon('plus', 18)}</button></form>
  ${list.length ? `<section class="card list">${list.map((x) => `<div class="li ${x.done ? 'done' : ''}">
    ${tab === 'expenses' ? `<span class="li-ic">💸</span>` : `<button class="check-b ${x.done ? 'on' : ''}" data-a="tripSubToggle" data-id="${t.id}" data-sid="${x.id}" data-list="${tab}">${x.done ? icon('check', 16) : ''}</button>`}
    <span class="grow">${esc(x.text)}${tab === 'expenses' ? `<br><span class="muted small">${esc(nameOf(x.by))}</span>` : ''}</span>
    ${tab === 'expenses' ? `<b>${money(x.amount)}</b>` : ''}
    <button class="icon-btn xs ghost" data-a="tripSubDel" data-id="${t.id}" data-sid="${x.id}" data-list="${tab}" aria-label="Видалити">${icon('x', 16)}</button></div>`).join('')}</section>`
    : `<p class="center muted pad">Поки порожньо.</p>`}`;
}

on('tripTab', (el) => { S.ui.tripTab = el.dataset.v; S.render(); });
on('tripForm', (el) => {
  const t = el?.dataset?.id ? S.room.trips.find((x) => x.id === el.dataset.id) : null;
  openForm({
    title: t ? 'Напрямок' : 'Новий напрямок',
    fields: [
      { key: 'name', label: 'Куди', value: t?.name, placeholder: 'Карпати, Львів, Італія…', required: true, max: 80 },
      { key: 'start', label: 'Початок', type: 'date', value: t?.start },
      { key: 'end', label: 'Кінець', type: 'date', value: t?.end },
      { key: 'budget', label: 'Бюджет, ₴', type: 'number', value: t?.budget },
      { key: 'note', label: 'Нотатки', type: 'textarea', value: t?.note, max: 600 },
    ],
    onSubmit: async (v) => {
      if (v.start && v.end && v.end < v.start) { toast('Кінець раніше за початок'); return false; }
      if (t) return act({ type: 'update', col: 'trips', id: t.id, patch: v });
      const ok = await act({ type: 'add', col: 'trips', item: v }, { render: false });
      if (ok) go('more', 'trip:' + S.room.trips[0].id);
      return ok;
    },
    onDelete: t ? async () => { const ok = await act({ type: 'remove', col: 'trips', id: t.id }, { render: false }); if (ok) go('more', 'trips'); return ok; } : null,
  });
});
on('tripLogForm', (el) => {
  const x = el?.dataset?.id ? S.room.tripLog.find((i) => i.id === el.dataset.id) : null;
  openForm({
    title: x ? 'Поїздка' : 'Відмітити поїздку',
    fields: [
      { key: 'place', label: 'Куди їздили', value: x?.place, required: true, max: 80 },
      { key: 'date', label: 'Коли', type: 'date', value: x?.date || today() },
      { key: 'note', label: 'Коротко', value: x?.note, max: 200 },
    ],
    onSubmit: (v) => (x ? act({ type: 'update', col: 'tripLog', id: x.id, patch: v }) : act({ type: 'add', col: 'tripLog', item: v })),
    onDelete: x ? () => act({ type: 'remove', col: 'tripLog', id: x.id }) : null,
  });
});
on('tripSubToggle', (el) => act({ type: 'sub', id: el.dataset.id, list: el.dataset.list, op: 'toggle', sid: el.dataset.sid }));
on('tripSubDel', (el) => act({ type: 'sub', id: el.dataset.id, list: el.dataset.list, op: 'remove', sid: el.dataset.sid }));
on('form:tripSub', async (form) => {
  const text = form.querySelector('#trip-in').value.trim();
  const amt = form.querySelector('#trip-amt')?.value;
  if (!text) return;
  if (form.dataset.list === 'expenses' && !(Number(amt) > 0)) { toast('Вкажи суму'); return; }
  if (await act({ type: 'sub', id: form.dataset.id, list: form.dataset.list, op: 'add', text, amount: amt })) document.getElementById('trip-in')?.focus();
});

/* ================= calendar ================= */
function calendarView() {
  const t = today();
  const mode = ui('calMode', 'month');
  const sel = ui('calDay', t);
  const hidden = ui('calHidden', []);
  const visible = (x) => !hidden.includes(x.kind);
  let body;
  if (mode === 'month') {
    const month = ui('calMonth', sel.slice(0, 7));
    const first = month + '-01';
    const gridStart = weekStart(first);
    const [yy, mm] = month.split('-').map(Number);
    const last = new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10);
    const gridEnd = addDays(weekStart(last), 6);
    const items = itemsBetween(S.room, gridStart, gridEnd).filter(visible);
    const byDay = {};
    for (const x of items) (byDay[x.date] ||= []).push(x);
    const cells = [];
    for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
      const dots = [...new Set((byDay[d] || []).map((x) => KIND[x.kind].color))].slice(0, 3);
      cells.push(`<button class="cal-d ${d.slice(0, 7) !== month ? 'out' : ''} ${d === t ? 'today' : ''} ${d === sel ? 'sel' : ''}" data-a="calPick" data-d="${d}">
        <span>${+d.slice(8)}</span><i>${dots.map((c) => `<b style="background:${c}"></b>`).join('')}</i></button>`);
    }
    const [y, m] = month.split('-').map(Number);
    body = `<div class="cal-nav">
      <button class="icon-btn ghost" data-a="calMonth" data-n="-12" aria-label="Попередній рік">«</button>
      <button class="icon-btn ghost" data-a="calMonth" data-n="-1" aria-label="Попередній місяць">‹</button>
      <b>${MONTHS[m - 1]} ${y}</b>
      <button class="icon-btn ghost" data-a="calMonth" data-n="1" aria-label="Наступний місяць">›</button>
      <button class="icon-btn ghost" data-a="calMonth" data-n="12" aria-label="Наступний рік">»</button></div>
    <div class="cal-grid">${WEEKDAYS.map((w) => `<span class="cal-w">${w}</span>`).join('')}${cells.join('')}</div>
    ${dayList(sel, byDay[sel] || [])}`;
  } else {
    const ws = weekStart(sel);
    const items = itemsBetween(S.room, ws, addDays(ws, 6)).filter(visible);
    body = `<div class="cal-nav"><button class="icon-btn ghost" data-a="calWeek" data-n="-7">‹</button><b>${fmtRange(ws, addDays(ws, 6))}</b><button class="icon-btn ghost" data-a="calWeek" data-n="7">›</button></div>
      ${Array.from({ length: 7 }, (_, i) => addDays(ws, i)).map((d) => dayList(d, items.filter((x) => x.date === d), true)).join('')}`;
  }
  return `${back()}<div class="page-h"><div><h1>Календар</h1><p class="muted">Усі зустрічі й події на двох в одному місці.</p></div>
    <button class="icon-btn lg" data-a="eventForm" data-d="${sel}" aria-label="Нова подія">${icon('calheart', 22)}</button></div>
  <div class="row gap"><div class="seg grow"><button class="seg-b ${mode === 'month' ? 'on' : ''}" data-a="calMode" data-v="month">Місяць</button><button class="seg-b ${mode === 'week' ? 'on' : ''}" data-a="calMode" data-v="week">Тиждень</button></div>
    <button class="btn secondary ${hidden.length ? 'on' : ''}" data-a="calFilter">${icon('filter', 18)} Фільтр</button></div>
  ${body}`;
}

function dayList(d, items, compact = false) {
  const t = today();
  const title = `${WEEKDAYS[(new Date(d + 'T12:00:00').getDay() + 6) % 7].toUpperCase()}, ${fmtDate(d).toUpperCase()}${d === t ? ' · СЬОГОДНІ' : ''}`;
  return `<div class="day-h"><span>${title}</span><button class="icon-btn sm" data-a="eventForm" data-d="${d}" aria-label="Додати">${icon('plus', 18)}</button></div>
  ${items.length ? `<section class="card list">${items.map((x) => `<button class="li" data-a="calItem" data-ref="${x.ref ? x.ref.join(':') : ''}">
      <span class="kdot" style="background:${KIND[x.kind].color}"></span><span class="grow"><b>${esc(x.title)}</b><br><span class="muted small">${KIND[x.kind].label}${x.time ? ' · ' + x.time : ''}</span></span></button>`).join('')}</section>`
    : compact ? '' : `<p class="center muted">Нічого не заплановано.</p><button class="dashed-btn" data-a="eventForm" data-d="${d}">${icon('plus', 18)} Запланувати на цей день</button>`}`;
}

function eventForm(e, date) {
  openForm({
    title: e ? 'Подія' : 'Запланувати',
    fields: [
      { key: 'title', label: 'Що', value: e?.title, placeholder: 'Вечеря в ресторані', required: true, max: 100 },
      { key: 'kind', label: 'Тип', type: 'select', value: e?.kind || 'date', options: [['date', '💞 Побачення'], ['event', '📌 Подія'], ['trip', '✈️ Поїздка'], ['reminder', '⏰ Нагадування']] },
      { key: 'date', label: 'Дата', type: 'date', value: e?.date || date || today(), required: true },
      { key: 'time', label: 'Час', type: 'time', value: e?.time },
      { key: 'note', label: 'Нотатка', type: 'textarea', value: e?.note, max: 300 },
    ],
    onSubmit: (v) => (e ? act({ type: 'update', col: 'events', id: e.id, patch: v }) : act({ type: 'add', col: 'events', item: v })),
    onDelete: e ? () => act({ type: 'remove', col: 'events', id: e.id }) : null,
  });
}
on('eventForm', (el) => eventForm(null, el.dataset.d));
on('calItem', (el) => {
  const [col, id] = (el.dataset.ref || '').split(':');
  const it = col && S.room[col]?.find((x) => x.id === id);
  if (!col) return;
  if (!it) return;
  if (col === 'events') eventForm(it);
  else if (col === 'places') placeForm(it);
  else if (col === 'blind') { if (it.by === S.me.id) blindForm(it); else go('places'); }
  else if (col === 'trips') go('more', 'trip:' + id);
  else if (col === 'dates') go('me');
});
on('calPick', (el) => { S.ui.calDay = el.dataset.d; S.render(); });
on('calMode', (el) => { S.ui.calMode = el.dataset.v; S.render(); });
on('calMonth', (el) => {
  const [y, m] = ui('calMonth', ui('calDay', today()).slice(0, 7)).split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + Number(el.dataset.n), 1));
  S.ui.calMonth = d.toISOString().slice(0, 7);
  S.render();
});
on('calWeek', (el) => { S.ui.calDay = addDays(ui('calDay', today()), Number(el.dataset.n)); S.render(); });
on('calFilter', () => {
  const hidden = ui('calHidden', []);
  openSheet(`<h3 class="h3">Що показувати</h3><div class="list">${Object.entries(KIND).map(([k, v]) => `<label class="check-row"><input type="checkbox" data-k="${k}" ${hidden.includes(k) ? '' : 'checked'}><span class="kdot" style="background:${v.color}"></span><span>${v.label}</span></label>`).join('')}</div>
    <button class="btn block mt" data-ok>Готово</button>`, (el) => {
    el.querySelector('[data-ok]').onclick = () => {
      S.ui.calHidden = [...el.querySelectorAll('[data-k]')].filter((c) => !c.checked).map((c) => c.dataset.k);
      closeSheet(); S.render();
    };
  });
});

/* ================= goals ================= */
function goalsView() {
  const active = S.room.goals.filter((g) => !g.archived);
  const archived = S.room.goals.filter((g) => g.archived);
  return `${back()}<div class="page-h"><div><h1>Ціль / скарбничка</h1><p class="muted">Копіть на щось важливе разом і стежте за прогресом.</p></div>
    <button class="fab" data-a="goalForm" aria-label="Нова ціль">${icon('plus', 26)}</button></div>
  ${active.length ? active.map(goalCard).join('') : emptyState('Цілей поки немає.', 'Відпустка, ремонт, нова техніка — почніть копити разом.', `<button class="btn" data-a="goalForm">${icon('plus', 18)} Створити ціль</button>`)}
  ${archived.length ? `<details class="card"><summary class="muted">Архів · ${archived.length}</summary>${archived.map((g) => `<button class="li" data-a="go" data-tab="more" data-sub="goal:${g.id}"><span class="grow">${esc(g.title)}</span><span class="muted small">${money(g.saved)}</span></button>`).join('')}</details>` : ''}`;
}
const goalCard = (g) => `<button class="card goal-mini" data-a="go" data-tab="more" data-sub="goal:${g.id}">
  <span class="goal-art">${g.emoji ? `<span style="font-size:42px">${esc(g.emoji)}</span>` : piggy(64)}</span>
  <span class="grow"><b class="lg">${esc(g.title)}</b>${g.achieved ? ' ✅' : ''}<br><span class="muted">${money(g.saved)} з ${money(g.target)}</span>
  <span class="bar-track mt"><span class="bar-fill" style="width:${Math.min(100, (g.saved / g.target) * 100)}%"></span></span></span></button>`;

function quickAmounts(target) {
  const nice = (n) => { const p = 10 ** Math.max(0, Math.floor(Math.log10(n)) - 1); return Math.max(1, Math.round(n / p) * p); };
  return [...new Set([0.1, 0.2, 0.4].map((k) => nice(target * k)))];
}
function goalView(id) {
  const g = S.room.goals.find((x) => x.id === id);
  if (!g) return `${back()}<p class="muted pad">Ціль не знайдено.</p>`;
  const left = Math.max(0, g.target - g.saved);
  const pct = Math.min(100, (g.saved / g.target) * 100);
  return `<button class="back" data-a="go" data-tab="more" data-sub="goals">${icon('back', 18)} Скарбнички</button>
  <section class="card">
    <div class="row"><h2 class="h2">${esc(g.title)}</h2><button class="icon-btn xs ghost" data-a="goalForm" data-id="${g.id}" aria-label="Редагувати">${icon('pencil', 16)}</button></div>
    <div class="muted">${g.achieved ? 'Ціль досягнута 🎉' : g.deadline ? `Копимо до ${fmtDate(g.deadline, { year: true })}` : 'Копимо без терміну'}</div>
    <div class="goal-scene">${g.emoji ? `<span class="goal-big">${esc(g.emoji)}</span>` : piggy(150)}<button class="icon-btn sm corner" data-a="goalEmoji" data-id="${g.id}" aria-label="Змінити картинку">${icon('palette', 18)}</button></div>
    <div class="inner">
      <div class="row"><span class="muted">Накопичено</span><span class="grow"></span><b>${money(g.saved)}</b><span class="muted">&nbsp;/ ${money(g.target)}</span></div>
      <div class="bar-track mt"><div class="bar-fill" style="width:${pct}%"></div></div>
      <div class="muted small mt">${left ? `Залишилось накопичити: ${money(left)}` : 'Усе зібрано! 🎉'}</div>
    </div>
    <div class="sec-label">ШВИДКО ПОПОВНИТИ</div>
    <div class="tags">${quickAmounts(g.target).map((n) => `<button class="tag solo" data-a="goalQuick" data-id="${g.id}" data-n="${n}">+${money(n)}</button>`).join('')}</div>
    <div class="grid2 mt"><button class="btn warm" data-a="goalMove" data-id="${g.id}" data-dir="1">${icon('plus', 18)} Поповнити</button><button class="btn secondary" data-a="goalMove" data-id="${g.id}" data-dir="-1">${icon('minus', 18)} Витратити</button></div>
    <div class="row gap mt wrap">
      <button class="chip-btn ok" data-a="goalFlag" data-id="${g.id}" data-f="achieved">${icon('target', 16)} ${g.achieved ? 'Ще не досягнута' : 'Відмітити досягнутою'}</button>
      <button class="chip-btn" data-a="goalFlag" data-id="${g.id}" data-f="archived">${icon('archive', 16)} ${g.archived ? 'З архіву' : 'В архів'}</button>
      <span class="grow"></span><button class="chip-btn danger" data-a="goalDel" data-id="${g.id}">${icon('trash', 16)} видалити</button>
    </div>
    <details class="hist mt"><summary>Історія поповнень</summary>
      ${g.history.length ? g.history.map((h) => `<div class="li"><span class="${h.amount > 0 ? 'ok-t' : 'danger-t'}"><b>${h.amount > 0 ? '+' : '−'}${money(Math.abs(h.amount))}</b></span><span class="grow muted small">${esc(nameOf(h.by))}${h.note ? ' · ' + esc(h.note) : ''}</span><span class="muted small">${ago(h.ts)}</span></div>`).join('') : '<p class="muted small">Поки порожньо.</p>'}
    </details>
  </section>`;
}
on('goalForm', (el) => {
  const g = el?.dataset?.id ? S.room.goals.find((x) => x.id === el.dataset.id) : null;
  openForm({
    title: g ? 'Ціль' : 'Нова ціль',
    fields: [
      { key: 'title', label: 'На що копимо', value: g?.title, placeholder: 'На ремонт', required: true, max: 60 },
      { key: 'target', label: 'Сума цілі, ₴', type: 'number', value: g?.target, required: true },
      { key: 'deadline', label: 'До якої дати (необовʼязково)', type: 'date', value: g?.deadline },
    ],
    onSubmit: async (v) => {
      if (!(v.target > 0)) { toast('Сума має бути більшою за нуль'); return false; }
      if (g) return act({ type: 'update', col: 'goals', id: g.id, patch: v });
      const ok = await act({ type: 'add', col: 'goals', item: v }, { render: false });
      if (ok) go('more', 'goal:' + S.room.goals[0].id);
      return ok;
    },
  });
});
on('goalQuick', async (el) => { if (await act({ type: 'goalMove', id: el.dataset.id, amount: Number(el.dataset.n) })) toast(`+${money(Number(el.dataset.n))} 🐷`); });
on('goalMove', (el) => {
  const dir = Number(el.dataset.dir);
  openForm({
    title: dir > 0 ? 'Поповнити' : 'Витратити',
    fields: [{ key: 'amount', label: 'Сума, ₴', type: 'number', required: true }, { key: 'note', label: 'Коментар', max: 100, placeholder: dir > 0 ? 'Зарплата, кешбек…' : 'На що пішло' }],
    onSubmit: (v) => { if (!(v.amount > 0)) { toast('Вкажи суму'); return false; } return act({ type: 'goalMove', id: el.dataset.id, amount: dir * v.amount, note: v.note }); },
  });
});
on('goalFlag', (el) => { const g = S.room.goals.find((x) => x.id === el.dataset.id); if (g) act({ type: 'update', col: 'goals', id: g.id, patch: { [el.dataset.f]: !g[el.dataset.f] } }); });
on('goalDel', async (el) => { if (confirm('Видалити ціль разом з історією?') && (await act({ type: 'remove', col: 'goals', id: el.dataset.id }, { render: false }))) go('more', 'goals'); });
on('goalEmoji', (el) => {
  const opts = ['', '🏖️', '🏠', '🚗', '💍', '✈️', '💻', '🎓', '🐶', '🛋️', '📱', '🎁'];
  openSheet(`<h3 class="h3">Картинка скарбнички</h3><div class="wardrobe-grid">${opts.map((o) => `<button class="wd" data-e="${o}"><span class="wd-e">${o || '🐷'}</span></button>`).join('')}</div>`, (sh) => {
    sh.querySelectorAll('[data-e]').forEach((b) => b.onclick = async () => { if (await act({ type: 'update', col: 'goals', id: el.dataset.id, patch: { emoji: b.dataset.e } })) closeSheet(); });
  });
});

/* ================= check-in ================= */
function checkinView() {
  const t = today();
  const w = checkinWeek(t);
  const pid = partnerId();
  const entry = S.room.checkins[w] || {};
  const mine = entry[S.me.id];
  const theirs = pid && entry[pid];
  const both = mine && theirs?.answers;
  const editing = ui('checkinEdit', false) || !mine;
  const past = Object.keys(S.room.checkins).filter((k) => k < w).sort().reverse();

  const head = `<section class="card ck-head">
    <div class="row"><span class="ava-pair">${avatar(meM(), S.me.id, 56)}${avatar(partner(), pid || '', 56)}<span class="couple-heart sm">${icon('heart', 12)}</span></span>
      <div class="grow"><div class="accent small b">${fmtRange(w, addDays(w, 6)).toUpperCase()}</div><h2 class="h2">Чек-ін тижня</h2></div>
      <button class="icon-btn sm" data-a="ckHelp" aria-label="Як це працює">${icon('help', 20)}</button></div>
    <p class="muted">Питання — про тиждень ${fmtRange(w, addDays(w, 6))}. Відповіді приватні, доки не відповісте обоє.</p>
    <div class="row gap wrap"><span class="chip ${mine ? 'ok' : ''}">${mine ? icon('check', 14) + ' Ти · відповів(-ла)' : icon('clock', 14) + ' Ти · чекаємо'}</span>
    <span class="chip ${theirs ? 'ok' : ''}">${theirs ? icon('check', 14) + ' Партнер · відповів(-ла)' : icon('clock', 14) + ' Партнер · чекаємо'}</span></div>
  </section>`;

  let body;
  if (both && !ui('checkinEdit', false)) {
    body = `<section class="card">${CHECKIN_QUESTIONS.map((q, i) => `<div class="ck-res"><div class="b">${esc(q.q)}</div>
      <div class="ck-pair"><div><span class="muted small">Ти</span>${q.type === 'scale' ? `<div class="stars">${'★'.repeat(mine.answers[i])}<span>${'★'.repeat(5 - mine.answers[i])}</span></div>` : `<div>${esc(mine.answers[i]) || '—'}</div>`}</div>
      <div><span class="muted small">${esc(partner().name)}</span>${q.type === 'scale' ? `<div class="stars">${'★'.repeat(theirs.answers[i])}<span>${'★'.repeat(5 - theirs.answers[i])}</span></div>` : `<div>${esc(theirs.answers[i]) || '—'}</div>`}</div></div></div>`).join('')}
      <button class="btn secondary block mt" data-a="ckEdit">Змінити відповіді</button></section>`;
  } else if (editing) {
    const prev = mine?.answers || [];
    body = `<form class="card" data-form="checkin" data-week="${w}">${CHECKIN_QUESTIONS.map((q, i) => `<div class="ck-q"><div class="b">${i + 1}. ${esc(q.q)}</div>
      ${q.type === 'scale' ? `<div class="scale" data-i="${i}">${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="sc ${prev[i] === n ? 'on' : ''}" data-a="sc" data-n="${n}">${n}</button>`).join('')}</div><input type="hidden" name="q${i}" value="${prev[i] || ''}">`
        : `<textarea class="input" name="q${i}" rows="2" maxlength="600" placeholder="Можна коротко…">${esc(prev[i] || '')}</textarea>`}</div>`).join('')}
      <button class="btn block" type="submit">Надіслати відповіді</button>${mine ? '<button type="button" class="btn ghost block" data-a="ckCancel">Скасувати</button>' : ''}</form>`;
  } else {
    body = `<section class="card center pad">
      <span class="ic-circle">${icon('clock', 30)}</span>
      <h3 class="h3">Ти вже відповів(-ла) на цьому тижні</h3><p class="muted">Результат відкриється, щойно відповість партнер.</p>
      <button class="btn secondary block" data-a="ckEdit">Змінити відповіді</button></section>`;
  }
  const hist = past.length ? `<div class="sec-label">МИНУЛІ ТИЖНІ</div><section class="card list">${past.map((k) => {
    const e = S.room.checkins[k];
    const done = Object.values(e).filter((x) => x.answers).length;
    const avg = (x) => x?.answers ? (x.answers.slice(0, 3).reduce((s, v) => s + v, 0) / 3).toFixed(1) : '—';
    return `<div class="li"><span class="grow">${fmtRange(k, addDays(k, 6))}</span><span class="muted small">${done >= 2 ? `ти ${avg(e[S.me.id])} · ${esc(partner()?.name || '')} ${avg(e[pid])}` : '🔒 не всі відповіли'}</span></div>`;
  }).join('')}</section>` : '';
  return `${back()}${head}${body}${hist}`;
}
on('sc', (el) => {
  const box = el.closest('.scale');
  box.querySelectorAll('.sc').forEach((b) => b.classList.toggle('on', b === el));
  box.parentElement.querySelector(`[name=q${box.dataset.i}]`).value = el.dataset.n;
});
on('ckEdit', () => { S.ui.checkinEdit = true; S.render(); });
on('ckCancel', () => { S.ui.checkinEdit = false; S.render(); });
on('ckHelp', () => openSheet(`<h3 class="h3">Що таке чек-ін</h3><div class="prose"><p>Раз на тиждень ви обоє відповідаєте на кілька коротких питань про минулий тиждень.</p><p>${icon('lock', 14)} Поки не відповіли обоє, відповіді партнера приховані — так ніхто не підлаштовується.</p><p>Це привід поговорити: що було добре і чого хочеться більше.</p></div><button class="btn block mt" data-ok>Зрозуміло</button>`, (el) => { el.querySelector('[data-ok]').onclick = closeSheet; }));
on('form:checkin', async (form) => {
  const answers = CHECKIN_QUESTIONS.map((q, i) => form.querySelector(`[name=q${i}]`).value);
  if (CHECKIN_QUESTIONS.some((q, i) => q.type === 'scale' && !answers[i])) { toast('Оціни всі питання від 1 до 5'); return; }
  if (await act({ type: 'checkin', week: form.dataset.week, answers }, { render: false })) { S.ui.checkinEdit = false; S.render(); toast('Відповіді збережено 💜'); }
});

/* ================= notes ================= */
function notesView() {
  const notes = S.room.notes;
  if (notes[0]) LS.set('seenNotes', Math.max(LS.get('seenNotes', 0), ...notes.filter((n) => n.from !== S.me.id).map((n) => n.ts), 0));
  return `${back()}<div class="page-h"><div><h1>Записки</h1><p class="muted">Листи, теплі слова й запечатані сюрпризи.</p></div>
    <button class="fab" data-a="noteSheet" aria-label="Нова записка">${icon('plus', 26)}</button></div>
  ${notes.length ? `<div class="notes">${notes.map((n) => {
    const mine = n.from === S.me.id;
    const liked = n.hearts.length;
    const sealedForMe = n.sealed;
    const pendingForThem = mine && n.openAt && n.openAt > Date.now();
    return `<div class="note ${mine ? 'mine' : 'theirs'}">
      ${sealedForMe ? `<div class="sealed">💌 Запечатана записка<br><span class="small muted">Відкриється ${new Date(n.openAt).toLocaleString('uk-UA', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</span></div>` : `<div class="ntext">${esc(n.text)}</div>`}
      <div class="meta"><span>${mine ? 'Ти' : esc(nameOf(n.from))} · ${ago(n.ts)}${pendingForThem ? ` · ${icon('lock', 12)} відкриється ${new Date(n.openAt).toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}</span>
      <span>${sealedForMe ? '' : `<button class="${n.hearts.includes(S.me.id) ? 'liked' : ''}" data-a="heartNote" data-id="${n.id}">${liked ? '❤️ ' + liked : '🤍'}</button>`}
      ${mine ? `<button data-a="delNote" data-id="${n.id}" aria-label="Видалити">${icon('trash', 14)}</button>` : ''}</span></div></div>`;
  }).join('')}</div>` : emptyState('Тут будуть ваші записки одне одному.', '', `<button class="btn" data-a="noteSheet">${icon('send', 18)} Написати</button>`)}`;
}
on('heartNote', (el) => act({ type: 'heartNote', id: el.dataset.id }));
on('delNote', (el) => { if (confirm('Видалити записку?')) act({ type: 'delNote', id: el.dataset.id }); });

/* ================= settings ================= */
function settingsView() {
  const m = meM();
  const pid = partnerId();
  const theme = LS.get('theme', 'dark');
  return `${back()}<div class="page-h"><h1>Налаштування</h1></div>
  <div class="sec-label">ПРОФІЛЬ</div>
  <section class="card">
    <div class="row gap"><label class="ava-edit">${avatar(m, S.me.id, 72)}<span class="ava-cam">${icon('camera', 16)}</span><input type="file" accept="image/*" id="ava-file" hidden></label>
      <div class="grow"><b class="lg">${esc(m.name)}</b><br><button class="link accent" data-a="rename">Змінити імʼя</button>${m.avatar ? ` · <button class="link muted" data-a="avaDel">Прибрати фото</button>` : ''}</div></div>
  </section>
  <div class="sec-label">ПАРА</div>
  <section class="card list flush">
    <div class="li big"><span class="ic-box">${icon('link')}</span><span class="grow"><b>Код пари</b><br><span class="muted small">${pid ? `Ви разом: ${esc(m.name)} і ${esc(partner().name)}` : 'Надішли його своїй половинці'}</span></span><b class="code-sm">${esc(S.room.code)}</b></div>
    ${pid ? '' : `<button class="li big" data-a="invite"><span class="ic-box">${icon('send')}</span><span class="grow"><b>Запросити партнера</b></span>${icon('chev', 18)}</button>`}
    <button class="li big" data-a="addStart"><span class="ic-box">${icon('calheart')}</span><span class="grow"><b>Дата початку стосунків</b><br><span class="muted small">${S.room.startDate ? fmtDate(S.room.startDate, { year: true }) : 'Не вказано'}</span></span>${icon('chev', 18)}</button>
    <button class="li big" data-a="petName"><span class="ic-box">🦎</span><span class="grow"><b>Імʼя хамелеона</b><br><span class="muted small">${esc(S.room.pet.name)} · рівень ${levelInfo(S.room.pet.xp).level}</span></span>${icon('chev', 18)}</button>
  </section>
  <div class="sec-label">ВХІД З БУДЬ-ЯКОГО ПРИСТРОЮ</div>
  <section class="card list flush">
    <button class="li big" data-a="loginSetup"><span class="ic-box">${icon('lock')}</span><span class="grow"><b>${m.login ? 'Логін: ' + esc(m.login) : 'Створити логін і пароль'}</b><br><span class="muted small">${m.login ? 'Змінити логін чи пароль' : 'Щоб заходити з іншого телефона чи з іконки на головному екрані'}</span></span>${icon('chev', 18)}</button>
  </section>
  <div class="sec-label">ОФОРМЛЕННЯ</div>
  <div class="seg big three">${[['dark', '🌙 Темна'], ['light', '☀️ Світла'], ['auto', '⚙️ Авто']].map(([k, l]) => `<button class="seg-b ${theme === k ? 'on' : ''}" data-a="theme" data-v="${k}">${l}</button>`).join('')}</div>
  <div class="sec-label">ПРИВАТНІСТЬ</div>
  <section class="card prose small">
    <p>${icon('lock', 14)} Дані вашої пари бачите лише ви двоє — за кодом пари. Не діліться кодом з іншими.</p>
    <p>🎁 Позначки «готую подарунок» бачить лише дарувальник. 🎭 План побачення наосліп і 💌 запечатані записки відкриваються в потрібний час. 💜 Відповіді чек-іну відкриваються, коли відповіли обоє.</p>
  </section>
  <section class="card list flush">
    <button class="li big" data-a="logout"><span class="ic-box">${icon('door')}</span><span class="grow"><b>Вийти на цьому пристрої</b><br><span class="muted small">Повернутися можна за кодом пари</span></span></button>
    <button class="li big danger-t" data-a="leavePair"><span class="ic-box">${icon('trash')}</span><span class="grow"><b>Покинути пару</b><br><span class="muted small">Тебе буде видалено з пари</span></span></button>
  </section>
  <p class="center muted small pad">Хамелеончики · куточок для двох 🦎❤️</p>`;
}
on('settings', () => go('more', 'settings'));
on('rename', () => openForm({ title: 'Твоє імʼя', fields: [{ key: 'name', label: 'Імʼя', value: meM().name, required: true, max: 30 }], onSubmit: (v) => { S.me.name = v.name; LS.set('me', S.me); return act({ type: 'profile', name: v.name }); } }));
on('avaDel', () => act({ type: 'profile', avatar: null }));
on('theme', (el) => { LS.set('theme', el.dataset.v); applyTheme(); S.render(); });
on('logout', () => { if (confirm('Вийти на цьому пристрої? Щоб повернутися, введи код пари.')) leave(); });
on('leavePair', async () => {
  if (!confirm('Покинути пару? Тебе буде видалено, а партнер залишиться з даними.')) return;
  if (await act({ type: 'leavePair' }, { render: false })) leave();
});
export function applyTheme() {
  const t = LS.get('theme', 'dark');
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#14100E' : '#FBF5EF');
}
export async function onAvatarFile(file) {
  if (!file) return;
  try {
    const data = await resizeImage(file, 160);
    if (await act({ type: 'profile', avatar: data })) toast('Фото оновлено');
  } catch { toast('Не вдалося обробити фото'); }
}

/* ================= FAQ ================= */
const FAQ = [
  ['Як підключити партнера?', 'Створи пару й надішли партнеру код із 6 символів (кнопка «Запросити»). Партнер відкриває застосунок, вводить своє імʼя та цей код — і ви разом.'],
  ['Як встановити застосунок на телефон?', 'iPhone: відкрий сайт у Safari → «Поділитися» → «На екран “Додому”». Android: у Chrome меню ⋮ → «Додати на головний екран» або «Встановити застосунок».'],
  ['Чи синхронізуються дані між нами?', 'Так. Усе, що додає один, за кілька секунд зʼявляється в іншого.'],
  ['Я змінив(-ла) телефон. Як повернутися?', 'Відкрий застосунок на новому телефоні, введи імʼя і той самий код пари.'],
  ['Що буде з хамелеоном, якщо його не годувати?', 'Він посіріє й засумує, а вогник днів поспіль згасне. Досвід і рівень залишаться.'],
  ['Чому хамелеон змінює колір?', 'Як справжній хамелеон — під настрій. Відміть свій настрій на головному екрані: зелений — відмінно, жовтий — норм, синій — сумно.'],
  ['Чи бачить партнер, що я готую подарунок?', 'Ні. Позначки «Буду дарувати» і «Куплено» бачить лише той, хто дарує.'],
  ['Як працює побачення наосліп?', 'Ти плануєш дату, час, підказку й секретний план. Партнер бачить лише дату, час і підказку, а сам план — у день побачення або коли ти його розкриєш.'],
  ['Чому я не бачу відповідей партнера в чек-іні?', 'Вони відкриваються, коли відповіли обоє — щоб відповіді були щирими.'],
];
function faqView() {
  return `${back()}<div class="page-h"><h1>Часті питання</h1></div>
  ${FAQ.map(([q, a]) => `<details class="card faq"><summary>${esc(q)}</summary><p class="muted">${esc(a)}</p></details>`).join('')}
  <div class="center pad">${otter({ face: 'happy', pose: 'wave', size: 100 })}</div>`;
}

void share; void plural; void closeSheet;
