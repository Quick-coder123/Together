// «Дім» — shopping, chores, recipes.
import { S, on, act, openSheet, closeSheet, openForm, toast, today, nameOf, ui, partnerId } from '../store.js';
import { otter, cookScene } from '../ui.js';
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
  ${listHead(cat, open.length, done.length)}
  <form class="add-line" data-form="shop">${icon('plus', 22)}<input id="shop-in" placeholder="${cat === 'food' ? 'Додати молоко, сир, фрукти…' : 'Додати мило, батарейки…'}" maxlength="80" enterkeyhint="done" autocomplete="off"></form>
  ${cat === 'food' ? `<div class="tags">${S.room.tags.map((t) => `<span class="tag"><button data-a="tagAdd" data-t="${esc(t)}">+ ${esc(t)}</button><button class="tag-x" data-a="tagDel" data-t="${esc(t)}" aria-label="Прибрати тег">${icon('x', 14)}</button></span>`).join('')}
    <button class="tag dashed" data-a="tagNew">${icon('plus', 14)} Свій тег</button></div>` : ''}
  ${items.length ? `<section class="card list">${open.map(shopItem).join('')}${done.length ? `<div class="li-sep"><span>Куплено · ${done.length}</span><button class="link accent" data-a="clearDone" data-v="${cat}">Очистити</button></div>${done.map(shopItem).join('')}` : ''}</section>`
    : emptyState('Список порожній — додай, що треба купити.')}`;
}
function listHead(cat, nOpen, nDone) {
  const m = S.room.shopMeta?.[cat];
  const total = nOpen + nDone;
  const when = m ? (() => { const d = new Date(m.ts); const day = localDayKey(d); return (day === today() ? 'сьогодні' : fmtDate(day)) + ' о ' + d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }); })() : '';
  return `<section class="card shop-head">
    <div class="row"><span class="ic-box">${icon('cart', 22)}</span><div class="grow">
      <b>${m ? (m.by === S.me.id ? 'Твій список' : `Список від ${esc(nameOf(m.by))}`) : cat === 'food' ? 'Список продуктів' : 'Список покупок'}</b>
      <div class="muted small">${m ? when + ' · ' : ''}${total ? `куплено ${nDone} з ${total}` : 'поки порожній'}</div></div></div>
    ${total ? `<span class="bar-track mt"><span class="bar-fill" style="width:${Math.round((nDone / total) * 100)}%"></span></span>` : ''}
    <button class="btn block mt" data-a="shopNew" data-v="${cat}">${icon('plus', 18)} Новий список</button>
  </section>`;
}
const localDayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const splitItems = (t) => String(t || '').split(/[\n,;]+/).map((x) => x.replace(/^\s*(?:[-•*·]|\d+[.)])\s*/, '').trim()).filter(Boolean).map((x) => x[0].toLocaleUpperCase('uk') + x.slice(1));

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

const AI_KINDS = [['any', '🎲 Будь-що'], ['dinner', '🕯️ Вечеря на двох'], ['breakfast', '🥞 Сніданок'], ['dessert', '🍰 Десерт'], ['quick', '⚡ До 30 хв'], ['ukrainian', '🇺🇦 Українська'], ['healthy', '🥗 Легке']];
function aiCard() {
  const k = ui('aiKind', 'any');
  return `<section class="card ai-card">
    <div class="row"><span class="ic-box chef-ic">👨‍🍳</span>
      <div class="grow"><b class="lg">Кухар Хамі</b><br><span class="muted small">Знайде цікаву страву з фото й розпише рецепт українською</span></div></div>
    <div class="pills mt">${AI_KINDS.map(([v, l]) => `<button class="pill ${k === v ? 'on' : ''}" data-a="aiKind" data-v="${v}">${l}</button>`).join('')}</div>
    <button class="btn ai-btn block" data-a="aiRecipe">${icon('sparkle', 18)} Знайти випадковий рецепт</button>
  </section>`;
}
function recipesView() {
  const list = S.room.recipes;
  if (!list.length) return aiCard() + emptyState('Рецептів поки немає.', 'Зберігайте улюблені страви — і додавайте інгредієнти в покупки одним дотиком.', `<button class="btn" data-a="recipeForm">${icon('plus', 18)} Додати свій рецепт</button>`);
  return `${aiCard()}<div class="cards">${list.map((r) => `<button class="card place" data-a="recipe" data-id="${r.id}">${/^https:\/\//.test(r.image || '') ? `<img class="place-em img" src="${esc(r.image)}${r.image.includes('themealdb') ? '/preview' : ''}" alt="" loading="lazy">` : `<span class="place-em">${r.ai ? '✨' : '🍲'}</span>`}
    <span class="grow"><b>${esc(r.title)}</b><br><span class="muted small">${r.time ? esc(r.time) + ' · ' : ''}${r.ingredients.length} інгр.${r.ingredients.length ? ' · ' + esc(r.ingredients.slice(0, 3).join(', ')) : ''}</span></span>${icon('chev', 18)}</button>`).join('')}</div>`;
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
  const items = splitItems(text);
  if (!items.length) return;
  if (items.length === 1) await act({ type: 'add', col: 'shopping', item: { text: items[0], cat } });
  else await act({ type: 'shopList', cat, items, fresh: false });
}
on('shopNew', (el) => {
  const cat = el.dataset.v === 'other' ? 'other' : 'food';
  const items = S.room.shopping.filter((x) => x.cat === cat);
  const left = items.filter((x) => !x.done), bought = items.filter((x) => x.done);
  const pid = partnerId();
  openSheet(`<div class="sheet-h"><h3>Новий список ${cat === 'food' ? 'продуктів' : 'покупок'}</h3></div>
    <label class="field"><span>Що купити?</span><textarea class="input" id="sl-items" rows="6" placeholder="${cat === 'food' ? 'Молоко\nХліб\nСир, яйця, банани' : 'Мило\nБатарейки'}"></textarea></label>
    <p class="muted small" style="margin:-4px 0 10px">Кожен продукт з нового рядка або через кому.</p>
    ${left.length || bought.length ? `<div class="carry">
      ${left.length ? `<div>${icon('check', 14)} <b>${left.length}</b> некуплен${left.length === 1 ? 'е' : 'их'} з попереднього списку перейд${left.length === 1 ? 'е' : 'уть'} у новий: <span class="muted">${esc(left.slice(0, 4).map((x) => x.text).join(', '))}${left.length > 4 ? '…' : ''}</span></div>` : ''}
      ${bought.length ? `<div class="mt-s">${icon('trash', 14)} Куплене (${bought.length}) зникне.</div>` : ''}</div>` : ''}
    <button class="btn block mt" data-ok>${icon('cart', 18)} Створити список${pid ? ' і сповістити' : ''}</button>`, (sh) => {
    const ta = sh.querySelector('#sl-items');
    sh.querySelector('[data-ok]').onclick = async (e) => {
      const list = splitItems(ta.value);
      if (!list.length && !left.length) { toast('Додай хоча б один продукт'); ta.focus(); return; }
      e.currentTarget.disabled = true;
      const ok = await act({ type: 'shopList', cat, items: list, fresh: true });
      if (ok) { closeSheet(); toast(pid ? 'Список готовий — пару сповіщено 🛒' : 'Список готовий 🛒'); } else e.currentTarget.disabled = false;
    };
  });
});
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
on('aiKind', (el) => { S.ui.aiKind = el.dataset.v; S.render(); });

function aiPreview(sh, r, note) {
  const safe = /^https?:\/\//i.test(r.source_url || '') ? r.source_url : '';
  sh.innerHTML = `<div class="grab"></div>
    ${/^https:\/\//.test(r.image || '') ? `<img class="rec-img" src="${esc(r.image)}" alt="" loading="lazy">` : ''}
    ${note ? `<div class="info-bar small">🌐 ${note === 'no_translation' ? 'Рецепт англійською. Щоб він був українською, додай безкоштовний ключ Gemini (див. README).' : 'Переклад зараз недоступний, показую оригінал.'}</div>` : ''}
    <div class="muted small">👨‍🍳 Кухар Хамі радить приготувати</div>
    <h3 class="h2" style="margin:4px 0 6px">${esc(r.title)}</h3>
    ${r.description ? `<p class="muted" style="margin:0 0 8px">${esc(r.description)}</p>` : ''}
    <div class="row gap wrap">${r.time ? `<span class="chip">⏱ ${esc(r.time)}</span>` : ''}${r.servings ? `<span class="chip">🍽 ${esc(r.servings)}</span>` : ''}</div>
    <h4 class="sub-h">Інгредієнти</h4><ul class="ing">${r.ingredients.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
    <h4 class="sub-h">Приготування</h4><ol class="ing">${r.steps.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>
    ${safe ? `<a class="ai-src" href="${esc(safe)}" target="_blank" rel="noopener">${icon('link', 14)} Джерело: ${esc(r.source_name || safe)}</a>` : ''}
    <button class="btn block mt" data-add>${icon('plus', 18)} Додати в наші рецепти</button>
    <button class="btn secondary block" data-again>${icon('dice', 18)} Шукати інший</button>
    <button class="btn ghost block" data-cancel>Не зараз</button>`;
  sh.querySelector('[data-again]').onclick = () => aiSearch(sh);
  sh.querySelector('[data-cancel]').onclick = closeSheet;
  sh.querySelector('[data-add]').onclick = async (e) => {
    e.target.disabled = true;
    const ok = await act({ type: 'add', col: 'recipes', item: {
      title: r.title, description: r.description, time: r.time, servings: r.servings, ingredients: r.ingredients,
      steps: r.steps.map((x, i) => `${i + 1}. ${x}`).join('\n'), link: safe, source: r.source_name, ai: true, image: r.image || '', ext: r.ext || '',
    } });
    if (ok) { closeSheet(); toast('Рецепт додано ✨'); } else e.target.disabled = false;
  };
}
async function aiSearch(sh) {
  sh.innerHTML = `<div class="grab"></div><div class="center">${cookScene()}<b class="load-line">Кухар Хамі ставить каструлю…</b><p class="muted small">Кілька секунд</p></div>
    <button class="btn ghost block" data-cancel>Скасувати</button>`;
  sh.querySelector('[data-cancel]').onclick = closeSheet;
  const lines = ['Кухар Хамі ставить каструлю…', 'Гортає кулінарну книгу…', 'Кидає щіпку солі…', 'Куштує з ложечки…', 'Прикрашає зеленню…'];
  let li = 0;
  const lt = setInterval(() => {
    const el = sh.querySelector('.load-line');
    if (!el) { clearInterval(lt); return; }
    li = (li + 1) % lines.length;
    el.classList.remove('swap'); void el.offsetWidth; el.classList.add('swap');
    el.textContent = lines[li];
  }, 2000);
  try {
    const res = await fetch('/api/recipe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: S.code, member: S.me.id, kind: ui('aiKind', 'any') }) });
    const data = await res.json().catch(() => ({}));
    if (!sh.isConnected) return;
    if (!res.ok) {
      const msg = data.error === 'not_configured' ? 'Сервер ще не підключено до бази даних.' : data.error || 'Не вдалося звʼязатися із сервером.';
      sh.innerHTML = `<div class="grab"></div><div class="center pad">${otter({ face: 'sad', size: 100 })}<p>${esc(msg)}</p></div><button class="btn secondary block" data-again>Спробувати ще</button><button class="btn ghost block" data-cancel>Закрити</button>`;
      sh.querySelector('[data-again]').onclick = () => aiSearch(sh);
      sh.querySelector('[data-cancel]').onclick = closeSheet;
      return;
    }
    aiPreview(sh, data.recipe, data.note);
  } catch {
    if (!sh.isConnected) return;
    sh.innerHTML = `<div class="grab"></div><p class="center pad">Немає звʼязку. Перевір інтернет.</p><button class="btn secondary block" data-again>Спробувати ще</button>`;
    sh.querySelector('[data-again]').onclick = () => aiSearch(sh);
  }
}
on('aiRecipe', () => { const sh = openSheet(''); aiSearch(sh); });
on('recipe', (el) => {
  const r = S.room.recipes.find((x) => x.id === el.dataset.id);
  if (!r) return;
  const safeLink = /^https?:\/\//i.test(r.link || '') ? r.link : '';
  openSheet(`<div class="sheet-h"><h3>${esc(r.title)}</h3><button class="icon-btn sm" data-edit aria-label="Редагувати">${icon('pencil', 18)}</button></div>
    ${/^https:\/\//.test(r.image || '') ? `<img class="rec-img" src="${esc(r.image)}" alt="" loading="lazy">` : ''}
    ${r.description ? `<p class="muted" style="margin:0 0 8px">${esc(r.description)}</p>` : ''}
    ${r.time || r.servings ? `<div class="row gap wrap">${r.time ? `<span class="chip">⏱ ${esc(r.time)}</span>` : ''}${r.servings ? `<span class="chip">🍽 ${esc(r.servings)}</span>` : ''}</div>` : ''}
    ${r.ingredients.length ? `<h4 class="sub-h">Інгредієнти</h4><ul class="ing">${r.ingredients.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>
      <button class="btn secondary block" data-shop>${icon('cart', 18)} Додати все в покупки</button>` : ''}
    ${r.steps ? `<h4 class="sub-h">Приготування</h4><div class="prose pre">${esc(r.steps)}</div>` : ''}
    ${safeLink ? `<a class="btn ghost block" href="${esc(safeLink)}" target="_blank" rel="noopener">${icon('link', 18)} ${r.source ? 'Джерело: ' + esc(r.source) : 'Відкрити посилання'}</a>` : ''}`, (sh) => {
    sh.querySelector('[data-edit]').onclick = () => recipeForm(r);
    const b = sh.querySelector('[data-shop]');
    if (b) b.onclick = async () => {
      b.disabled = true;
      await act({ type: 'shopList', cat: 'food', items: r.ingredients, fresh: false });
      closeSheet(); toast('Інгредієнти додано в покупки 🛒');
    };
  });
});

void fmtDate; void partnerId;
