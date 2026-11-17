// «Вішліст» — gifts, things to watch, dreams.
import { S, on, act, openSheet, openForm, ui, partnerId, partner, meM, closeSheet } from '../store.js';
import { esc, icon, emptyState, avatar } from '../ui.js';

const KINDS = { film: '🎬 Фільм', series: '📺 Серіал', cartoon: '🧸 Мультфільм', show: '🎤 Шоу / концерт', other: '✨ Інше' };

export function wishView() {
  const tab = ui('wishTab', 'gifts');
  return `
  <div class="page-h"><div><h1>Наш вішліст</h1><p class="muted">Те, що хочеться отримати, побачити й прожити.</p></div>
    <button class="fab" data-a="wishAdd" aria-label="Додати">${icon('plus', 26)}</button></div>
  <div class="seg big three">
    <button class="seg-b ${tab === 'gifts' ? 'on' : ''}" data-a="wishTab" data-v="gifts">${icon('gift', 18)} Подарунки</button>
    <button class="seg-b ${tab === 'watch' ? 'on' : ''}" data-a="wishTab" data-v="watch">${icon('eye', 18)} Подивитися</button>
    <button class="seg-b ${tab === 'dreams' ? 'on' : ''}" data-a="wishTab" data-v="dreams">${icon('sparkle', 18)} Мрії</button>
  </div>
  ${tab === 'gifts' ? giftsView() : tab === 'watch' ? watchView() : dreamsView()}
  <p class="center muted small pad">${icon('heart', 14)} Помічати, що робить вас щасливими</p>`;
}

function giftsView() {
  const pid = partnerId();
  const whose = ui('giftWhose', 'me');
  const owner = whose === 'me' ? S.me.id : pid;
  const list = owner ? S.room.gifts.filter((g) => g.owner === owner) : [];
  return `
  <div class="pills">
    <button class="pill ${whose === 'me' ? 'on' : ''}" data-a="giftWhose" data-v="me">${avatar(meM(), S.me.id, 26)} Хочу я</button>
    <button class="pill ${whose === 'them' ? 'on' : ''}" data-a="giftWhose" data-v="them">${avatar(partner(), pid || '', 26)} ${pid ? `Хоче ${esc(partner().name)}` : 'Партнер'}</button>
  </div>
  <button class="info-bar" data-a="giftInfo">${icon('lock', 18)}<span class="grow">Підготовка подарунка видна лише дарувальнику</span>${icon('help', 18)}</button>
  ${!owner ? `<p class="center muted pad">Коли партнер приєднається, тут буде його список бажань.</p>`
    : list.length ? `<div class="cards">${list.map((g) => giftCard(g, whose)).join('')}</div>`
    : emptyState(whose === 'me' ? 'Поки порожньо — додай те, про що мрієш.' : `${partner().name} ще нічого не додав(-ла).`, '', whose === 'me' ? `<button class="btn" data-a="wishAdd">${icon('plus', 18)} Додати</button>` : '')}`;
}

function giftCard(g, whose) {
  const safeLink = /^https?:\/\//i.test(g.link || '') ? g.link : '';
  const prep = g.prep;
  const prepMine = prep?.by === S.me.id;
  return `<section class="card gift ${g.received ? 'visited' : ''}">
    <div class="row"><span class="place-em">🎁</span><div class="grow"><b>${esc(g.title)}</b>${g.price ? ` <span class="muted small nowrap">· ${esc(g.price)}</span>` : ''}
      ${g.note ? `<div class="muted small">${esc(g.note)}</div>` : ''}${g.received ? `<div class="small ok-t">${icon('check', 14)} Отримано</div>` : ''}</div>
      ${whose === 'me' || g.by === S.me.id ? `<button class="icon-btn xs ghost" data-a="giftEdit" data-id="${g.id}" aria-label="Редагувати">${icon('pencil', 16)}</button>` : ''}</div>
    ${safeLink ? `<a class="small link-out" href="${esc(safeLink)}" target="_blank" rel="noopener">${icon('link', 14)} ${esc(safeLink.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40))}</a>` : ''}
    ${whose === 'them' && !g.received ? `<div class="row gap mt">
      ${prep && !prepMine ? `<span class="chip">${icon('lock', 14)} Вже хтось готує</span>` : `
      <button class="btn sm ${prepMine && prep.status === 'prep' ? '' : 'secondary'}" data-a="giftPrep" data-id="${g.id}" data-s="prep">🎁 ${prepMine && prep.status === 'prep' ? 'Готую' : 'Буду дарувати'}</button>
      <button class="btn sm ${prepMine && prep.status === 'bought' ? '' : 'secondary'}" data-a="giftPrep" data-id="${g.id}" data-s="bought">${icon('check', 16)} Куплено</button>`}
    </div>` : ''}
  </section>`;
}

function watchView() {
  const list = [...S.room.watch].sort((a, b) => a.watched - b.watched);
  if (!list.length) return emptyState('Поки порожньо — додайте фільми й серіали на вечір.', '', `<button class="btn" data-a="wishAdd">${icon('plus', 18)} Додати</button>`);
  return `<section class="card list">${list.map((w) => `<div class="li ${w.watched ? 'done' : ''}">
    <button class="check-b ${w.watched ? 'on' : ''}" data-a="toggle" data-col="watch" data-f="watched" data-id="${w.id}" aria-label="Переглянуто">${w.watched ? icon('check', 16) : ''}</button>
    <button class="grow left" data-a="watchEdit" data-id="${w.id}"><span class="txt">${esc(w.title)}</span><br><span class="muted small">${KINDS[w.kind] || ''}${w.note ? ' · ' + esc(w.note) : ''}</span></button></div>`).join('')}</section>`;
}

function dreamsView() {
  const list = [...S.room.dreams].sort((a, b) => a.done - b.done);
  if (!list.length) return emptyState('Поки порожньо — запишіть спільні мрії.', 'Побачити північне сяйво, завести собаку, стрибнути з парашутом…', `<button class="btn" data-a="wishAdd">${icon('plus', 18)} Додати мрію</button>`);
  return `<section class="card list">${list.map((d) => `<div class="li ${d.done ? 'done' : ''}">
    <button class="check-b ${d.done ? 'on' : ''}" data-a="toggle" data-col="dreams" data-f="done" data-id="${d.id}" aria-label="Здійснено">${d.done ? icon('check', 16) : ''}</button>
    <button class="grow left" data-a="dreamEdit" data-id="${d.id}"><span class="txt">${esc(d.title)}</span>${d.note ? `<br><span class="muted small">${esc(d.note)}</span>` : ''}</button>${d.done ? '🎉' : ''}</div>`).join('')}</section>`;
}

/* ---------------- handlers ---------------- */
on('wishTab', (el) => { S.ui.wishTab = el.dataset.v; S.render(); });
on('giftWhose', (el) => { S.ui.giftWhose = el.dataset.v; S.render(); });
on('giftInfo', () => openSheet(`<h3 class="h3">Як працюють подарунки</h3><div class="prose">
  <p>Кожен веде свій список бажань. У списку партнера можна відмітити «Буду дарувати» або «Куплено».</p>
  <p>${icon('lock', 14)} Ці позначки бачиш лише ти — партнер не дізнається, що саме ти готуєш. Так сюрприз лишається сюрпризом.</p></div>
  <button class="btn block mt" data-ok>Зрозуміло</button>`, (el) => { el.querySelector('[data-ok]').onclick = closeSheet; }));
on('toggle', (el) => {
  const it = S.room[el.dataset.col].find((x) => x.id === el.dataset.id);
  if (it) act({ type: 'update', col: el.dataset.col, id: it.id, patch: { [el.dataset.f]: !it[el.dataset.f] } });
});
on('giftPrep', (el) => {
  const g = S.room.gifts.find((x) => x.id === el.dataset.id);
  const same = g?.prep?.by === S.me.id && g.prep.status === el.dataset.s;
  act({ type: 'giftPrep', id: el.dataset.id, status: same ? null : el.dataset.s });
});

function giftForm(g) {
  const pid = partnerId();
  const whose = ui('giftWhose', 'me');
  const owner = g?.owner || (whose === 'them' && pid ? pid : S.me.id);
  openForm({
    title: g ? 'Подарунок' : owner === S.me.id ? 'Я хочу…' : `Ідея для ${partner()?.name}`,
    fields: [
      { key: 'title', label: 'Що саме', value: g?.title, required: true, max: 100 },
      { key: 'price', label: 'Орієнтовна ціна', value: g?.price, max: 30, placeholder: '1500₴' },
      { key: 'link', label: 'Посилання', value: g?.link, max: 300 },
      { key: 'note', label: 'Деталі (розмір, колір…)', type: 'textarea', value: g?.note, max: 300 },
      ...(g && g.owner === S.me.id ? [{ key: 'received', label: 'Вже отримав(-ла)', type: 'check', value: g.received }] : []),
    ],
    onSubmit: (v) => (g ? act({ type: 'update', col: 'gifts', id: g.id, patch: v }) : act({ type: 'add', col: 'gifts', item: { ...v, owner } })),
    onDelete: g ? () => act({ type: 'remove', col: 'gifts', id: g.id }) : null,
  });
}
on('giftEdit', (el) => giftForm(S.room.gifts.find((x) => x.id === el.dataset.id)));

function watchForm(w) {
  openForm({
    title: w ? 'Подивитися' : 'Що подивимось?',
    fields: [
      { key: 'title', label: 'Назва', value: w?.title, required: true, max: 100 },
      { key: 'kind', label: 'Тип', type: 'select', value: w?.kind || 'film', options: Object.entries(KINDS) },
      { key: 'note', label: 'Нотатка', value: w?.note, max: 200, placeholder: 'Де дивитися, хто порадив…' },
    ],
    onSubmit: (v) => (w ? act({ type: 'update', col: 'watch', id: w.id, patch: v }) : act({ type: 'add', col: 'watch', item: v })),
    onDelete: w ? () => act({ type: 'remove', col: 'watch', id: w.id }) : null,
  });
}
on('watchEdit', (el) => watchForm(S.room.watch.find((x) => x.id === el.dataset.id)));

function dreamForm(d) {
  openForm({
    title: d ? 'Мрія' : 'Нова мрія',
    fields: [
      { key: 'title', label: 'Мрія', value: d?.title, required: true, max: 120 },
      { key: 'note', label: 'Деталі', type: 'textarea', value: d?.note, max: 300 },
    ],
    onSubmit: (v) => (d ? act({ type: 'update', col: 'dreams', id: d.id, patch: v }) : act({ type: 'add', col: 'dreams', item: v })),
    onDelete: d ? () => act({ type: 'remove', col: 'dreams', id: d.id }) : null,
  });
}
on('dreamEdit', (el) => dreamForm(S.room.dreams.find((x) => x.id === el.dataset.id)));

on('wishAdd', () => {
  const tab = ui('wishTab', 'gifts');
  if (tab === 'gifts') giftForm(); else if (tab === 'watch') watchForm(); else dreamForm();
});
