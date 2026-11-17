// «Вішліст» — gifts, things to watch, dreams.
import { S, on, act, openSheet, openForm, ui, partnerId, partner, meM, closeSheet, toast } from '../store.js';
import { esc, icon, emptyState, avatar, nyshporka, scanScene } from '../ui.js';

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
    : whose === 'me' ? `<section class="card center pad">${nyshporka(96)}<p class="mt"><b>Про що мрієш?</b></p><p class="muted small">Додай сам або кинь посилання Нишпорці — він знайде фото, ціну й опис.</p><button class="btn mt" data-a="wishAdd">${icon('plus', 18)} Додати бажання</button></section>`
    : emptyState(`${partner().name} ще нічого не додав(-ла).`, '', '')}`;
}

const okImg = (v) => /^(https:\/\/|data:image\/)/.test(v || '');
function giftCard(g, whose) {
  const safeLink = /^https?:\/\//i.test(g.link || '') ? g.link : '';
  const prep = g.prep;
  const prepMine = prep?.by === S.me.id;
  const site = g.site || (safeLink ? safeLink.replace(/^https?:\/\/(www\.|m\.)?/, '').split('/')[0] : '');
  return `<section class="card gift ${g.received ? 'visited' : ''}">
    <div class="row" style="align-items:flex-start"><span class="g-img">${okImg(g.image) ? `<img src="${esc(g.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith('🎁')">` : '🎁'}</span>
      <div class="grow"><b>${esc(g.title)}</b>
      ${g.price ? `<div><span class="g-price">${esc(g.price)}</span></div>` : ''}
      ${g.note ? `<div class="muted small g-note">${esc(g.note)}</div>` : ''}${g.received ? `<div class="small ok-t">${icon('check', 14)} Отримано</div>` : ''}</div>
      ${whose === 'me' || g.by === S.me.id ? `<button class="icon-btn xs ghost" data-a="giftEdit" data-id="${g.id}" aria-label="Редагувати">${icon('pencil', 16)}</button>` : ''}</div>
    ${safeLink || (whose === 'them' && !g.received) ? `<div class="row gap wrap mt">
      ${safeLink ? `<a class="btn sm secondary buy-btn" href="${esc(safeLink)}" target="_blank" rel="noopener">${icon('bag', 16)} ${whose === 'them' ? 'Купити' : 'Відкрити'}${site ? ` · ${esc(site.slice(0, 22))}` : ''}</a>` : ''}
      ${whose === 'them' && !g.received ? (prep && !prepMine ? `<span class="chip">${icon('lock', 14)} Вже хтось готує</span>` : `
      <button class="btn sm ${prepMine && prep.status === 'prep' ? '' : 'secondary'}" data-a="giftPrep" data-id="${g.id}" data-s="prep">🎁 ${prepMine && prep.status === 'prep' ? 'Готую' : 'Буду дарувати'}</button>
      <button class="btn sm ${prepMine && prep.status === 'bought' ? '' : 'secondary'}" data-a="giftPrep" data-id="${g.id}" data-s="bought">${icon('check', 16)} Куплено</button>`) : ''}
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

function giftOwner(g) {
  const pid = partnerId();
  return g?.owner || (ui('giftWhose', 'me') === 'them' && pid ? pid : S.me.id);
}
function giftForm(g, prefill) {
  const owner = giftOwner(g);
  const v = g || prefill || {};
  openForm({
    title: g ? 'Бажання' : owner === S.me.id ? 'Я хочу…' : `Ідея для ${partner()?.name}`,
    intro: g ? '' : 'Обовʼязкова лише назва — решту можна пропустити.',
    fields: [
      { key: 'title', label: 'Назва', value: v.title, required: true, max: 100, placeholder: 'Наприклад, навушники' },
      { key: 'image', label: 'Фото', type: 'image', value: v.image },
      { key: 'price', label: 'Ціна', value: v.price, max: 30, placeholder: '1 500 ₴' },
      { key: 'note', label: 'Опис', type: 'textarea', value: v.note, max: 600, placeholder: 'Розмір, колір, модель…' },
      { key: 'link', label: 'Посилання на товар', value: v.link, max: 300, placeholder: 'https://…' },
      ...(g && g.owner === S.me.id ? [{ key: 'received', label: 'Вже отримав(-ла)', type: 'check', value: g.received }] : []),
    ],
    onSubmit: (x) => {
      x.image = x.image || null;
      if (x.link && !/^https?:\/\//i.test(x.link)) x.link = 'https://' + x.link;
      if (!g && prefill?.site) x.site = prefill.site;
      return g ? act({ type: 'update', col: 'gifts', id: g.id, patch: x }) : act({ type: 'add', col: 'gifts', item: { ...x, owner } });
    },
    onDelete: g ? () => act({ type: 'remove', col: 'gifts', id: g.id }) : null,
  });
}

/* ---------------- «Нишпорка»: add a wish by link ---------------- */
const SCAN_LINES = ['Нишпорка надягає капелюх…', 'Заглядаю на сторінку магазину 🔍', 'Шукаю найкраще фото 📸', 'Розглядаю цінник 🏷️', 'Пишу короткий опис ✍️', 'Ще трішки — майже знайшов!'];

function addChooser() {
  const owner = giftOwner();
  const forMe = owner === S.me.id;
  const sh = openSheet(`
    <div class="ny-hero">${nyshporka(78)}<div class="grow"><b>Нишпорка</b><div class="ny-bubble mt-s">${forMe ? 'Про що мрієш? Кинь мені посилання — сам знайду фото, ціну й опис!' : `Підглянув щось для ${esc(partner()?.name || 'пари')}? Дай посилання — все оформлю.`}</div></div></div>
    <button class="add-way main" data-way="link"><span class="ic-box">${icon('link', 22)}</span><span class="grow"><b>Вставити посилання</b><br><span class="muted small">Нишпорка сам заповнить фото, назву, ціну й опис</span></span>${icon('chev', 18)}</button>
    <button class="add-way" data-way="manual"><span class="ic-box">${icon('pencil', 20)}</span><span class="grow"><b>Додати вручну</b><br><span class="muted small">Фото, назва, опис, ціна — обовʼязкова лише назва</span></span>${icon('chev', 18)}</button>`);
  sh.querySelector('[data-way=manual]').onclick = () => giftForm();
  sh.querySelector('[data-way=link]').onclick = () => linkSheet(sh);
}

function linkSheet(sh, value = '') {
  sh.innerHTML = `<div class="grab"></div>
    <div class="ny-hero">${nyshporka(64)}<div class="grow"><b>Що шукаємо?</b><div class="muted small">Встав посилання на товар з будь-якого магазину</div></div></div>
    <div class="url-row"><input class="input" id="ny-url" type="url" inputmode="url" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="https://rozetka.com.ua/…" value="${esc(value)}">
      ${navigator.clipboard?.readText ? `<button class="icon-btn" data-paste aria-label="Вставити">${icon('clip', 20)}</button>` : ''}</div>
    <button class="btn block mt" data-go>${icon('search', 18)} Нишпорити!</button>
    <button class="btn ghost block" data-back>Назад</button>`;
  const inp = sh.querySelector('#ny-url');
  sh.querySelector('[data-paste]')?.addEventListener('click', async () => {
    try { const t = (await navigator.clipboard.readText()).trim(); if (t) inp.value = t.match(/https?:\/\/\S+/)?.[0] || t; } catch { toast('Не вдалося вставити — утримуй поле й обери «Вставити»'); }
  });
  sh.querySelector('[data-back]').onclick = () => addChooser();
  const go = () => {
    let url = inp.value.trim().match(/https?:\/\/\S+/)?.[0] || inp.value.trim();
    if (!url) { toast('Встав посилання'); inp.focus(); return; }
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    scan(sh, url);
  };
  sh.querySelector('[data-go]').onclick = go;
  inp.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } };
}

async function scan(sh, url) {
  sh.innerHTML = `<div class="grab"></div>${scanScene()}<p class="center scan-line" id="ny-line">${SCAN_LINES[0]}</p>
    <button class="btn ghost block" data-cancel>Скасувати</button>`;
  let alive = true;
  sh.querySelector('[data-cancel]').onclick = () => { alive = false; linkSheet(sh, url); };
  let li = 0;
  const t = setInterval(() => { const el = sh.querySelector('#ny-line'); if (!el || !alive) return clearInterval(t); li = Math.min(li + 1, SCAN_LINES.length - 1); el.textContent = SCAN_LINES[li]; }, 1800);
  let res, data;
  try {
    res = await fetch('/api/wish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: S.code, member: S.me.id, url }) });
    data = await res.json().catch(() => ({}));
  } catch { data = { error: 'Немає звʼязку. Перевір інтернет.' }; res = { ok: false }; }
  clearInterval(t);
  if (!alive || !sh.isConnected) return;
  if (!res.ok || !data.item) {
    sh.innerHTML = `<div class="grab"></div><div class="center pad">${nyshporka(90, 'sad')}<p>${esc(data.error || 'Не вдалося прочитати сторінку.')}</p></div>
      <button class="btn block" data-manual>${icon('pencil', 18)} Заповнити вручну</button>
      <button class="btn secondary block" data-again>Спробувати ще</button>
      <button class="btn ghost block" data-cancel>Скасувати</button>`;
    sh.querySelector('[data-manual]').onclick = () => giftForm(null, { link: url });
    sh.querySelector('[data-again]').onclick = () => scan(sh, url);
    sh.querySelector('[data-cancel]').onclick = closeSheet;
    return;
  }
  preview(sh, data.item);
}

function preview(sh, it) {
  sh.innerHTML = `<div class="grab"></div>
    <div class="ny-hero">${nyshporka(56, 'love')}<div class="grow"><b>Знайшов!</b><div class="muted small">Перевір і додай у список</div></div></div>
    <div class="wish-prev"><span class="g-img">${okImg(it.image) ? `<img src="${esc(it.image)}" alt="" referrerpolicy="no-referrer" onerror="this.replaceWith('🎁')">` : '🎁'}</span>
      <div class="grow"><b>${esc(it.title)}</b>${it.price ? `<div><span class="g-price">${esc(it.price)}</span></div>` : '<div class="muted small">Ціну не знайшов</div>'}
      ${it.note ? `<div class="muted small mt-s">${esc(it.note)}</div>` : ''}
      <div class="small mt-s link-out">${icon('link', 14)} ${esc(it.site || '')}</div></div></div>
    <button class="btn block mt" data-add>${icon('plus', 18)} Додати в список</button>
    <div class="grid2 mt-s"><button class="btn secondary" data-edit>${icon('pencil', 16)} Змінити</button><button class="btn ghost" data-cancel>Скасувати</button></div>`;
  sh.querySelector('[data-add]').onclick = async (e) => {
    e.currentTarget.disabled = true;
    const ok = await act({ type: 'add', col: 'gifts', item: { title: it.title, price: it.price, note: it.note, image: it.image || null, link: it.link, site: it.site, owner: giftOwner() } });
    if (ok) { closeSheet(); toast('Додано у вішліст 🎁'); } else e.currentTarget.disabled = false;
  };
  sh.querySelector('[data-edit]').onclick = () => giftForm(null, it);
  sh.querySelector('[data-cancel]').onclick = closeSheet;
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
  if (tab === 'gifts') { if (ui('giftWhose', 'me') === 'them' && !partnerId()) return toast('Спершу запроси пару'); addChooser(); } else if (tab === 'watch') watchForm(); else dreamForm();
});
