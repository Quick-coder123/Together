// «Дім» — shopping, chores, recipes.
import { S, on, act, openSheet, closeSheet, openForm, toast, today, nameOf, ui, partnerId } from '../store.js';
import { esc, icon, emptyState, fmtDate } from '../ui.js';
import { dayDiff } from '/lib/core.js';

const REPEAT = { none: 'Один раз', daily: 'Щодня', weekly: 'Щотижня', monthly: 'Щомісяця' };
const REPEAT_DAYS = { daily: 1, weekly: 7, monthly: 30 };

export function homeView() {
  const tab = ui('homeTab', 'shop');
  return `
  <div class="page-h"><div><h1>Дім</h1><p class="muted">Покупки, справи, рецепти й нагадування для дому — спільний список на двох.</p></div>
    <button class="fab" data-a="homeAdd" aria-label="Додати">${icon('plus', 26)}</button></div>
  <div class="seg big three">
    <button class="seg-b ${tab === 'shop' ? 'on' : ''}" data-a="homeTab" data-v="shop">${icon('cart', 18)} Покупки</button>
    <button class="seg-b ${tab === 'chores' ? 'on' : ''}" data-a="homeTab" data-v="chores">${icon('repeat', 18)} Справи</button>
    <button class="seg-b ${tab === 'recipes' ? 'on' : ''}" data-a="homeTab" data-v="recipes">${icon('chef', 18)} Рецепти</button>
  </div>
  ${tab === 'shop' ? shopView() : tab === 'chores' ? choresView() : recipesView()}`;
}

function shopView() {
  const cat = ui('shopCat', 'food');
  const items = S.room.shopping.filter((x) => x.cat === cat);
  const open = items.filter((x) => !x.done), done = items.filter((x) => x.done);
  return `
  <div class="pills">
    <button class="pill ${cat === 'food' ? 'on' : ''}" data-a="shopCat" data-v="food">Продукти</button>
    <button class="pill ${cat === 'other' ? 'on' : ''}" data-a="shopCat" data-v="other">Інші покупки</button>
  </div>
  <form class="add-line" data-form="shop">${icon('plus', 22)}<input id="shop-in" placeholder="${cat === 'food' ? 'Додати молоко, сир, фрукти…' : 'Додати мило, батарейки…'}" maxlength="80" enterkeyhint="done" autocomplete="off"></form>
  ${cat === 'food' ? `<div class="tags">${S.room.tags.map((t) => `<span class="tag"><button data-a="tagAdd" data-t="${esc(t)}">+ ${esc(t)}</button><button class="tag-x" data-a="tagDel" data-t="${esc(t)}" aria-label="Прибрати тег">${icon('x', 14)}</button></span>`).join('')}
    <button class="tag dashed" data-a="tagNew">${icon('plus', 14)} Свій тег</button></div>` : ''}
  ${items.length ? `<section class="card list">${open.map(shopItem).join('')}${done.length ? `<div class="li-sep"><span>Куплено · ${done.length}</span><button class="link accent" data-a="clearDone" data-v="${cat}">Очистити</button></div>${done.map(shopItem).join('')}` : ''}</section>`
    : emptyState('Список порожній — додай, що треба купити.')}`;
}
const shopItem = (x) => `<div class="li ${x.done ? 'done' : ''}">
  <button class="check-b ${x.done ? 'on' : ''}" data-a="shopToggle" data-id="${x.id}" aria-label="Куплено">${x.done ? icon('check', 16) : ''}</button>
  <span class="grow">${esc(x.text)}</span><button class="icon-btn xs ghost" data-a="del" data-col="shopping" data-id="${x.id}" aria-label="Видалити">${icon('x', 16)}</button></div>`;

function choreState(c, t) {
  if (c.repeat === 'none') return { due: !c.done, label: c.done ? 'Зроблено' : '' };
  if (!c.lastDone) return { due: true, label: 'Ще не робили' };
  const left = REPEAT_DAYS[c.repeat] - dayDiff(c.lastDone, t);
  if (c.lastDone === t) return { due: false, label: 'Зроблено сьогодні', today: true };
  if (left <= 0) return { due: true, label: left === 0 ? 'Сьогодні' : `Прострочено на ${-left} дн.` };
  return { due: false, label: `Наступного разу через ${left} дн.` };
}
function choresView() {
  const t = today();
  const list = S.room.chores.map((c) => ({ c, st: choreState(c, t) })).sort((a, b) => b.st.due - a.st.due);
  if (!list.length) return emptyState('Справ поки немає.', 'Винести сміття, полити квіти, оплатити комуналку — розподіліть справи між собою.', `<button class="btn" data-a="choreForm">${icon('plus', 18)} Додати справу</button>`);
  return `<section class="card list">${list.map(({ c, st }) => `<div class="li ${!st.due ? 'done' : ''}">
    <button class="check-b ${!st.due ? 'on' : ''}" data-a="choreToggle" data-id="${c.id}" aria-label="Зроблено">${!st.due ? icon('check', 16) : ''}</button>
    <button class="grow left" data-a="choreForm" data-id="${c.id}"><span class="txt">${esc(c.text)}</span><br><span class="muted small">${c.repeat !== 'none' ? icon('repeat', 12) + ' ' + REPEAT[c.repeat] : 'Один раз'}${c.who ? ' · ' + esc(nameOf(c.who)) : ''}${st.label ? ' · ' + st.label : ''}</span></button></div>`).join('')}</section>`;
}

function recipesView() {
  const list = S.room.recipes;
  if (!list.length) return emptyState('Рецептів поки немає.', 'Зберігайте улюблені страви — і додавайте інгредієнти в покупки одним дотиком.', `<button class="btn" data-a="recipeForm">${icon('plus', 18)} Додати рецепт</button>`);
  return `<div class="cards">${list.map((r) => `<button class="card place" data-a="recipe" data-id="${r.id}"><span class="place-em">🍲</span>
    <span class="grow"><b>${esc(r.title)}</b><br><span class="muted small">${r.ingredients.length} інгредієнт(ів)${r.ingredients.length ? ' · ' + esc(r.ingredients.slice(0, 3).join(', ')) : ''}</span></span>${icon('chev', 18)}</button>`).join('')}</div>`;
}

/* ---------------- handlers ---------------- */
on('homeTab', (el) => { S.ui.homeTab = el.dataset.v; S.render(); });
on('shopCat', (el) => { S.ui.shopCat = el.dataset.v; S.render(); });
on('homeAdd', () => {
  const tab = ui('homeTab', 'shop');
  if (tab === 'shop') document.getElementById('shop-in')?.focus();
  else if (tab === 'chores') choreForm();
  else recipeForm();
});
export async function addShop(text, cat = ui('shopCat', 'food')) {
  if (!text) return;
  await act({ type: 'add', col: 'shopping', item: { text, cat } });
}
on('tagAdd', (el) => addShop(el.dataset.t, 'food'));
on('tagDel', (el) => act({ type: 'tag', text: el.dataset.t, remove: true }));
on('tagNew', () => openForm({ title: 'Свій тег', intro: 'Те, що ви купуєте найчастіше — додаватиметься одним дотиком.', fields: [{ key: 't', label: 'Назва', max: 30, required: true }], onSubmit: (v) => act({ type: 'tag', text: v.t }) }));
on('shopToggle', (el) => { const x = S.room.shopping.find((i) => i.id === el.dataset.id); if (x) act({ type: 'update', col: 'shopping', id: x.id, patch: { done: !x.done } }); });
on('clearDone', (el) => act({ type: 'clearDone', col: 'shopping', cat: el.dataset.v }));
on('del', (el) => act({ type: 'remove', col: el.dataset.col, id: el.dataset.id }));

function choreForm(c) {
  const members = Object.entries(S.room.members).map(([id, m]) => [id, id === S.me.id ? `${m.name} (я)` : m.name]);
  openForm({
    title: c ? 'Справа' : 'Нова справа',
    fields: [
      { key: 'text', label: 'Що зробити', value: c?.text, placeholder: 'Винести сміття', required: true, max: 100 },
      { key: 'repeat', label: 'Як часто', type: 'select', value: c?.repeat || 'weekly', options: Object.entries(REPEAT) },
      { key: 'who', label: 'Хто', type: 'select', value: c?.who || '', options: [['', 'Хто вільний'], ...members] },
    ],
    onSubmit: (v) => (c ? act({ type: 'update', col: 'chores', id: c.id, patch: v }) : act({ type: 'add', col: 'chores', item: v })),
    onDelete: c ? () => act({ type: 'remove', col: 'chores', id: c.id }) : null,
  });
}
on('choreForm', (el) => choreForm(el?.dataset?.id ? S.room.chores.find((x) => x.id === el.dataset.id) : null));
on('choreToggle', (el) => {
  const c = S.room.chores.find((x) => x.id === el.dataset.id);
  if (!c) return;
  if (c.repeat === 'none') act({ type: 'update', col: 'chores', id: c.id, patch: { done: !c.done } });
  else if (c.lastDone === today()) act({ type: 'update', col: 'chores', id: c.id, patch: { lastDone: null } });
  else act({ type: 'update', col: 'chores', id: c.id, patch: { done: true } });
});

function recipeForm(r) {
  openForm({
    title: r ? 'Редагувати рецепт' : 'Новий рецепт',
    fields: [
      { key: 'title', label: 'Назва', value: r?.title, placeholder: 'Сирники як у бабусі', required: true, max: 80 },
      { key: 'ingredients', label: 'Інгредієнти (кожен з нового рядка)', type: 'lines', value: r?.ingredients, rows: 5 },
      { key: 'steps', label: 'Як готувати', type: 'textarea', rows: 6, value: r?.steps, max: 2000 },
      { key: 'link', label: 'Посилання', value: r?.link, max: 300 },
    ],
    onSubmit: (v) => (r ? act({ type: 'update', col: 'recipes', id: r.id, patch: v }) : act({ type: 'add', col: 'recipes', item: v })),
    onDelete: r ? () => act({ type: 'remove', col: 'recipes', id: r.id }) : null,
  });
}
on('recipeForm', () => recipeForm());
on('recipe', (el) => {
  const r = S.room.recipes.find((x) => x.id === el.dataset.id);
  if (!r) return;
  const safeLink = /^https?:\/\//i.test(r.link || '') ? r.link : '';
  openSheet(`<div class="sheet-h"><h3>${esc(r.title)}</h3><button class="icon-btn sm" data-edit aria-label="Редагувати">${icon('pencil', 18)}</button></div>
    ${r.ingredients.length ? `<h4 class="sub-h">Інгредієнти</h4><ul class="ing">${r.ingredients.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      <button class="btn secondary block" data-shop>${icon('cart', 18)} Додати все в покупки</button>` : ''}
    ${r.steps ? `<h4 class="sub-h">Приготування</h4><div class="prose pre">${esc(r.steps)}</div>` : ''}
    ${safeLink ? `<a class="btn ghost block" href="${esc(safeLink)}" target="_blank" rel="noopener">${icon('link', 18)} Відкрити посилання</a>` : ''}`, (sh) => {
    sh.querySelector('[data-edit]').onclick = () => recipeForm(r);
    const b = sh.querySelector('[data-shop]');
    if (b) b.onclick = async () => {
      b.disabled = true;
      for (const i of r.ingredients) await act({ type: 'add', col: 'shopping', item: { text: i, cat: 'food' } }, { render: false });
      S.render(); closeSheet(); toast('Інгредієнти додано в покупки 🛒');
    };
  });
});

void fmtDate; void partnerId;
