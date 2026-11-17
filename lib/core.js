// Хамелеончики: shared state model. Used by the API (server) and the app (client helpers).

export const MAX_MEMBERS = 2;

/* ---------------- dates ---------------- */
export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
export function addDays(dateKey, n) {
  const d = new Date(dateKey + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function dayDiff(a, b) {
  return Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);
}
export function weekStart(dateKey) {
  const dow = (new Date(dateKey + 'T12:00:00Z').getUTCDay() + 6) % 7; // Mon=0
  return addDays(dateKey, -dow);
}
// Check-in is about the previous full week (Mon–Sun).
export const checkinWeek = (today) => addDays(weekStart(today), -7);

/* ---------------- pet ---------------- */
export const OUTFITS = [
  { id: 'none', name: 'Без вбрання', emoji: '', level: 1 },
  { id: 'bow', name: 'Бантик', emoji: '🎀', level: 1 },
  { id: 'cap', name: 'Кепка', emoji: '🧢', level: 2 },
  { id: 'glasses', name: 'Окуляри', emoji: '🕶️', level: 3 },
  { id: 'flower', name: 'Квіточка', emoji: '🌸', level: 4 },
  { id: 'scarf', name: 'Шарфик', emoji: '🧣', level: 5 },
  { id: 'tophat', name: 'Циліндр', emoji: '🎩', level: 6 },
  { id: 'crown', name: 'Корона', emoji: '👑', level: 8 },
];

export function levelInfo(xp = 0) {
  let level = 1, need = 60, rest = xp;
  while (rest >= need) { rest -= need; level++; need = 60 + (level - 1) * 30; }
  const stage = level <= 2 ? 'Малюк' : level <= 5 ? 'Підліток' : level <= 9 ? 'Дорослий' : 'Мудрий';
  return { level, cur: rest, need, stage };
}

export function streakOf(pet, today) {
  if (!pet.lastFed) return 0;
  const gap = dayDiff(pet.lastFed, today);
  return gap <= 1 ? pet.streak || 0 : 0;
}

export const TASKS = {
  feed: { title: 'Погодувати улюбленця', goal: 1 },
  game: { title: 'Зіграти з хамелеоном 2 рази', goal: 2 },
  mood: { title: 'Відмітити свій настрій', goal: 1 },
  note: { title: 'Надіслати записку', goal: 1 },
  home: { title: 'Додати щось у «Дім»', goal: 1 },
  wish: { title: 'Додати щось у вішліст', goal: 1 },
  place: { title: 'Додати місце для побачення', goal: 1 },
};
const TASK_POOL = ['game', 'mood', 'note', 'home', 'wish', 'place'];
export function tasksFor(today) {
  let h = 0;
  for (const ch of today) h = (h * 33 + ch.charCodeAt(0)) >>> 0;
  const a = TASK_POOL[h % TASK_POOL.length];
  const rest = TASK_POOL.filter((t) => t !== a);
  const b = rest[(h >> 3) % rest.length];
  return ['feed', a, b];
}
const TASK_XP = 10;
const GAME_XP = 6;
const GAME_XP_LIMIT = 36; // per member per day

// Things the chameleon finds after a won game. Shared collection of the pair.
export const RARITY = { common: 'звичайна', rare: 'рідкісна', epic: 'епічна', legendary: 'легендарна' };
const RARITY_WEIGHT = { common: 60, rare: 28, epic: 10, legendary: 2 };
export const FINDS = [
  { id: 'leaf', e: '🍃', name: 'Листочок', r: 'common' },
  { id: 'flower', e: '🌼', name: 'Квіточка', r: 'common' },
  { id: 'berry', e: '🫐', name: 'Ягідка', r: 'common' },
  { id: 'twig', e: '🪵', name: 'Гілочка', r: 'common' },
  { id: 'cricket', e: '🦗', name: 'Коник', r: 'common' },
  { id: 'ladybug', e: '🐞', name: 'Сонечко', r: 'rare' },
  { id: 'butterfly', e: '🦋', name: 'Метелик', r: 'rare' },
  { id: 'mushroom', e: '🍄', name: 'Грибочок', r: 'rare' },
  { id: 'dew', e: '💧', name: 'Крапля роси', r: 'rare' },
  { id: 'beetle', e: '🪲', name: 'Золотий жук', r: 'epic' },
  { id: 'hibiscus', e: '🌺', name: 'Тропічна квітка', r: 'epic' },
  { id: 'crystal', e: '💎', name: 'Кристал', r: 'epic' },
  { id: 'rainbow', e: '🌈', name: 'Шматочок веселки', r: 'legendary' },
  { id: 'feather', e: '🪶', name: 'Чарівне перо', r: 'legendary' },
];
function rollFind() {
  const total = FINDS.reduce((s, f) => s + RARITY_WEIGHT[f.r] / FINDS.filter((x) => x.r === f.r).length, 0);
  let x = Math.random() * total;
  for (const f of FINDS) { x -= RARITY_WEIGHT[f.r] / FINDS.filter((y) => y.r === f.r).length; if (x <= 0) return f; }
  return FINDS[0];
}

/* ---------------- mood ---------------- */
export const MOODS = { great: 'Відмінно', ok: 'Норм', sad: 'Сумно' };

/* ---------------- check-in ---------------- */
export const CHECKIN_QUESTIONS = [
  { type: 'scale', q: 'Наскільки близькими ви почувалися цього тижня?' },
  { type: 'scale', q: 'Як вам спілкувалося?' },
  { type: 'scale', q: 'Чи вистачало часу разом?' },
  { type: 'text', q: 'Що було найкращим за тиждень?' },
  { type: 'text', q: 'Чого хочеться більше наступного тижня?' },
];

/* ---------------- schema ---------------- */
// field types: i image (https link or small data:image), s:N string, n number, b bool, d date, t time, e:a|b enum, m member id, l:N list of strings
export const SCHEMA = {
  places: { name: 's:80', cat: 'e:cafe|restaurant|bar|park|museum|cinema|nature|active|home|other', note: 's:400', address: 's:200', map: 's:400', mode: 'e:spont|plan', date: 'd', time: 't', visited: 'b', visitedAt: 'd', rating: 'n' },
  blind: { date: 'd', time: 't', meet: 's:300', hint: 's:120', dress: 's:80', details: 's:600', revealed: 'b' },
  shopping: { text: 's:80', qty: 's:20', note: 's:120', cat: 'e:food|other', done: 'b' },
  chores: { text: 's:100', repeat: 'e:none|daily|weekly|monthly', who: 'm', lastDone: 'd', done: 'b' },
  recipes: { title: 's:80', description: 's:300', time: 's:30', servings: 's:30', ingredients: 'l:80', steps: 's:4000', link: 's:300', source: 's:60', ai: 'b', image: 's:300', ext: 's:30' },
  gifts: { owner: 'm', title: 's:100', link: 's:300', price: 's:30', note: 's:600', image: 'i', site: 's:60', received: 'b' },
  watch: { title: 's:100', kind: 'e:film|series|cartoon|show|other', note: 's:200', watched: 'b' },
  dreams: { title: 's:120', note: 's:300', done: 'b' },
  trips: { name: 's:80', start: 'd', end: 'd', budget: 'n', note: 's:600' },
  tripLog: { place: 's:80', date: 'd', note: 's:200' },
  events: { title: 's:100', date: 'd', time: 't', kind: 'e:date|trip|event|reminder', note: 's:300', who: 'm', address: 's:200' },
  goals: { title: 's:60', target: 'n', deadline: 'd', emoji: 's:4', achieved: 'b', archived: 'b' },
  dates: { title: 's:80', date: 'd', yearly: 'b' },
};
const LIMIT = 300;

export class ActionError extends Error {}

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const str = (v, max) => String(v ?? '').trim().slice(0, max);

function clean(col, input, members, partial) {
  const spec = SCHEMA[col];
  const out = {};
  for (const [k, t] of Object.entries(spec)) {
    if (!(k in (input || {}))) { if (!partial) out[k] = t === 'b' ? false : t.startsWith('l') ? [] : null; continue; }
    const v = input[k];
    const [type, arg] = t.split(':');
    if (type === 's') out[k] = str(v, +arg);
    else if (type === 'n') { const n = Number(v); out[k] = Number.isFinite(n) && v !== '' && v !== null ? Math.round(n * 100) / 100 : null; }
    else if (type === 'b') out[k] = !!v;
    else if (type === 'i') out[k] = typeof v === 'string' && ((/^https:\/\//i.test(v) && v.length <= 600 && !/["'<>\s]/.test(v)) || (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= 70000)) ? v : null;
    else if (type === 'd') out[k] = isDate(v) ? v : null;
    else if (type === 't') out[k] = typeof v === 'string' && /^\d{2}:\d{2}$/.test(v) ? v : null;
    else if (type === 'e') out[k] = arg.split('|').includes(v) ? v : arg.split('|')[0];
    else if (type === 'm') out[k] = members.includes(v) ? v : null;
    else if (type === 'l') out[k] = (Array.isArray(v) ? v : String(v || '').split('\n')).map((x) => str(x, +arg)).filter(Boolean).slice(0, 60);
  }
  return out;
}
const required = { places: 'name', shopping: 'text', chores: 'text', recipes: 'title', gifts: 'title', watch: 'title', dreams: 'title', trips: 'name', tripLog: 'place', events: 'title', goals: 'title', dates: 'title', blind: 'date' };

/* ---------------- room ---------------- */
export function newRoom(code, now = Date.now()) {
  const r = {
    v: 2, code, rev: 0, createdAt: now,
    startDate: null,
    members: {}, moods: {},
    pet: { name: 'Хамі', xp: 0, lastFed: null, streak: 0, outfit: 'none', collection: {} },
    daily: {}, stepsSkipped: false,
    tags: ['Яйця', 'Молоко', 'Хліб'],
    notes: [], checkins: {},
  };
  for (const c of Object.keys(SCHEMA)) r[c] = [];
  return r;
}

function bump(s, mid, today, key, n = 1) {
  if (!isDate(today)) return;
  const day = (s.daily[today] ||= {});
  const me = (day[mid] ||= { claimed: {} });
  me[key] = (me[key] || 0) + n;
  for (const t of tasksFor(today)) {
    if (!me.claimed[t] && (me[t] || 0) >= TASKS[t].goal) { me.claimed[t] = true; s.pet.xp += TASK_XP; }
  }
  const keys = Object.keys(s.daily).sort();
  while (keys.length > 10) delete s.daily[keys.shift()];
}

const HOME_COLS = ['shopping', 'chores', 'recipes'];
const WISH_COLS = ['gifts', 'watch', 'dreams'];

// Applies one action to the room. Returns new state. Throws ActionError.
export function applyAction(state, member, action, today, now = Date.now()) {
  if (!member || typeof member.id !== 'string' || member.id.length < 6 || member.id.length > 40) throw new ActionError('Невідомий користувач');
  const s = structuredClone(state);
  const mid = member.id;
  const ids = Object.keys(s.members);
  const isMember = ids.includes(mid);
  const a = action || {};

  if (a.type === 'join') {
    if (!isMember && ids.length >= MAX_MEMBERS) throw new ActionError('У цій парі вже двоє');
    s.members[mid] = { ...(s.members[mid] || { joinedAt: now, avatar: null }), name: str(a.name, 30) || 'Без імені' };
    s.rev++;
    return s;
  }
  if (!isMember) throw new ActionError('Спочатку приєднайся до пари');
  const me = s.members[mid];
  me.seen = now;
  const partner = ids.find((x) => x !== mid);

  switch (a.type) {
    case 'ping': return s; // no rev bump
    case 'profile': {
      if ('name' in a) me.name = str(a.name, 30) || me.name;
      if ('avatar' in a) {
        const av = a.avatar;
        if (av === null) me.avatar = null;
        else if (typeof av === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(av) && av.length < 60000) me.avatar = av;
        else throw new ActionError('Фото завелике');
      }
      break;
    }
    case 'startDate': s.startDate = isDate(a.date) ? a.date : null; break;
    case 'skipSteps': s.stepsSkipped = true; break;
    case 'mood': {
      if (!MOODS[a.value]) throw new ActionError('Невідомий настрій');
      s.moods[mid] = { value: a.value, date: isDate(today) ? today : null, ts: now };
      bump(s, mid, today, 'mood');
      break;
    }
    case 'petName': s.pet.name = str(a.name, 20) || s.pet.name; break;
    case 'outfit': {
      const o = OUTFITS.find((x) => x.id === a.id);
      if (!o) throw new ActionError('Невідоме вбрання');
      if (levelInfo(s.pet.xp).level < o.level) throw new ActionError(`Відкриється на рівні ${o.level}`);
      s.pet.outfit = o.id;
      break;
    }
    case 'feed': {
      if (!isDate(today)) throw new ActionError('Невірна дата');
      if (s.pet.lastFed === today) throw new ActionError('Улюбленець уже ситий 😊');
      s.pet.streak = s.pet.lastFed && dayDiff(s.pet.lastFed, today) === 1 ? (s.pet.streak || 0) + 1 : 1;
      s.pet.lastFed = today;
      s.pet.fedBy = mid;
      s.pet.xp += 10;
      bump(s, mid, today, 'feed');
      break;
    }
    case 'game': {
      const game = str(a.game, 20);
      const day = s.daily[today]?.[mid];
      const xpBefore = day?.gameXp || 0;
      if (a.win) {
        const gain = Math.max(0, Math.min(GAME_XP, GAME_XP_LIMIT - xpBefore));
        s.pet.xp += gain;
        const f = rollFind();
        s.pet.collection = s.pet.collection || {};
        s.pet.collection[f.id] = (s.pet.collection[f.id] || 0) + 1;
        s.pet.lastFind = { id: f.id, by: mid, ts: now, game, xp: gain };
        bump(s, mid, today, 'gameXp', gain);
      } else {
        s.pet.lastFind = { id: null, by: mid, ts: now, game, xp: 0 };
      }
      bump(s, mid, today, 'game');
      break;
    }
    case 'note': {
      const text = str(a.text, 1000);
      if (!text) throw new ActionError('Порожня записка');
      const openAt = Number(a.openAt) > now ? Math.min(Number(a.openAt), now + 400 * 86400000) : null;
      s.notes.unshift({ id: uid(), from: mid, text, openAt, ts: now, hearts: [] });
      s.notes = s.notes.slice(0, 300);
      bump(s, mid, today, 'note');
      break;
    }
    case 'heartNote': {
      const n = s.notes.find((x) => x.id === a.id);
      if (n) n.hearts = n.hearts.includes(mid) ? n.hearts.filter((x) => x !== mid) : [...n.hearts, mid];
      break;
    }
    case 'delNote': s.notes = s.notes.filter((x) => !(x.id === a.id && x.from === mid)); break;
    case 'tag': {
      const t = str(a.text, 30);
      if (a.remove) s.tags = s.tags.filter((x) => x !== t);
      else if (t && !s.tags.includes(t)) s.tags = [...s.tags, t].slice(0, 30);
      break;
    }
    case 'add': {
      if (!SCHEMA[a.col]) throw new ActionError('Невідомий список');
      const item = clean(a.col, a.item, ids);
      if (!item[required[a.col]]) throw new ActionError('Заповни назву');
      if (a.col === 'gifts' && !item.owner) item.owner = mid;
      if (a.col === 'goals') { if (!(item.target > 0)) throw new ActionError('Вкажи суму цілі'); item.saved = 0; item.history = []; }
      if (a.col === 'trips') { item.places = []; item.pack = []; item.expenses = []; }
      Object.assign(item, { id: uid(), by: mid, ts: now });
      s[a.col].unshift(item);
      s[a.col] = s[a.col].slice(0, LIMIT);
      if (HOME_COLS.includes(a.col)) bump(s, mid, today, 'home');
      if (WISH_COLS.includes(a.col)) bump(s, mid, today, 'wish');
      if (a.col === 'places') bump(s, mid, today, 'place');
      if (a.col === 'blind') bump(s, mid, today, 'note');
      break;
    }
    case 'update': {
      if (!SCHEMA[a.col]) throw new ActionError('Невідомий список');
      const it = s[a.col].find((x) => x.id === a.id);
      if (!it) throw new ActionError('Не знайдено');
      if (a.col === 'blind' && it.by !== mid) throw new ActionError('Це сюрприз не від тебе');
      const patch = clean(a.col, a.patch, ids, true);
      if (a.col === 'places' && patch.visited && !it.visited) patch.visitedAt = isDate(today) ? today : null;
      if (a.col === 'chores' && patch.done && it.repeat !== 'none') { patch.done = false; patch.lastDone = today; }
      Object.assign(it, patch);
      break;
    }
    case 'remove': {
      if (!SCHEMA[a.col]) throw new ActionError('Невідомий список');
      const it = s[a.col].find((x) => x.id === a.id);
      if (it && a.col === 'gifts' && it.owner !== mid && it.by !== mid) throw new ActionError('Видалити може лише автор');
      if (it && a.col === 'blind' && it.by !== mid) throw new ActionError('Видалити може лише автор');
      s[a.col] = s[a.col].filter((x) => x.id !== a.id);
      break;
    }
    case 'shopList': {
      // fresh = a new shopping list: bought items of the old list disappear, unbought ones move over.
      const cat = a.cat === 'other' ? 'other' : 'food';
      const rows = (Array.isArray(a.items) ? a.items : []).map((x) => (typeof x === 'string' ? { text: x } : x || {}))
        .map((x) => ({ text: str(x.text, 80), qty: str(x.qty, 20), note: str(x.note, 120) })).filter((x) => x.text).slice(0, 60);
      if (!rows.length && !a.fresh) throw new ActionError('Додай хоча б один продукт');
      if (a.fresh) s.shopping = s.shopping.filter((x) => !(x.done && x.cat === cat));
      const open = new Map(s.shopping.filter((x) => x.cat === cat && !x.done).map((x) => [x.text.toLowerCase(), x]));
      const added = [];
      for (const r of rows) {
        const ex = open.get(r.text.toLowerCase());
        if (ex) { if (r.qty) ex.qty = r.qty; if (r.note) ex.note = r.note; continue; }
        const it = { id: uid(), text: r.text, qty: r.qty, note: r.note, cat, done: false, by: mid, ts: now };
        open.set(r.text.toLowerCase(), it);
        added.push(it);
      }
      s.shopping = [...added, ...s.shopping].slice(0, LIMIT);
      if (a.fresh) {
        s.shopMeta = { ...(s.shopMeta || {}), [cat]: { by: mid, ts: now, added: added.map((x) => (x.qty ? `${x.text} (${x.qty})` : x.text)).slice(0, 12), carried: s.shopping.filter((x) => x.cat === cat && !x.done).length - added.length } };
      }
      if (added.length) bump(s, mid, today, 'home');
      break;
    }
    case 'shopClear': {
      const cat = a.cat === 'other' ? 'other' : 'food';
      s.shopping = s.shopping.filter((x) => x.cat !== cat);
      if (s.shopMeta) delete s.shopMeta[cat];
      break;
    }
    case 'clearDone': {
      if (!['shopping'].includes(a.col)) throw new ActionError('Не можна');
      s[a.col] = s[a.col].filter((x) => !(x.done && (!a.cat || x.cat === a.cat)));
      break;
    }
    case 'giftPrep': {
      const g = s.gifts.find((x) => x.id === a.id);
      if (!g) throw new ActionError('Не знайдено');
      if (g.owner === mid) throw new ActionError('Свій подарунок готувати не можна 😉');
      g.prep = a.status ? { by: mid, status: a.status === 'bought' ? 'bought' : 'prep', ts: now } : null;
      break;
    }
    case 'sub': { // sub-items inside a trip: places / pack / expenses
      const t = s.trips.find((x) => x.id === a.id);
      if (!t || !['places', 'pack', 'expenses'].includes(a.list)) throw new ActionError('Не знайдено');
      if (a.op === 'add') {
        const text = str(a.text, 100);
        if (!text) throw new ActionError('Порожньо');
        const it = { id: uid(), text, done: false };
        if (a.list === 'expenses') { const n = Number(a.amount); if (!(n > 0)) throw new ActionError('Вкажи суму'); it.amount = Math.round(n * 100) / 100; it.by = mid; }
        t[a.list].push(it);
        t[a.list] = t[a.list].slice(-150);
      } else if (a.op === 'toggle') {
        const it = t[a.list].find((x) => x.id === a.sid); if (it) it.done = !it.done;
      } else if (a.op === 'remove') {
        t[a.list] = t[a.list].filter((x) => x.id !== a.sid);
      }
      break;
    }
    case 'goalMove': {
      const g = s.goals.find((x) => x.id === a.id);
      if (!g) throw new ActionError('Не знайдено');
      const n = Math.round(Number(a.amount) * 100) / 100;
      if (!Number.isFinite(n) || n === 0 || Math.abs(n) > 1e9) throw new ActionError('Вкажи суму');
      if (g.saved + n < 0) throw new ActionError('Стільки ще не накопичено');
      g.saved = Math.round((g.saved + n) * 100) / 100;
      g.history.unshift({ id: uid(), amount: n, by: mid, ts: now, note: str(a.note, 100) });
      g.history = g.history.slice(0, 200);
      break;
    }
    case 'checkin': {
      if (!isDate(a.week)) throw new ActionError('Невірний тиждень');
      const ans = CHECKIN_QUESTIONS.map((q, i) => {
        const v = a.answers?.[i];
        return q.type === 'scale' ? Math.max(1, Math.min(5, Math.round(Number(v) || 0))) : str(v, 600);
      });
      if (ans.some((v, i) => CHECKIN_QUESTIONS[i].type === 'scale' && !v)) throw new ActionError('Дай відповідь на всі питання');
      s.checkins[a.week] = { ...(s.checkins[a.week] || {}), [mid]: { answers: ans, ts: now } };
      const keys = Object.keys(s.checkins).sort();
      while (keys.length > 60) delete s.checkins[keys.shift()];
      break;
    }
    case 'calKey': {
      // Secret part of the calendar-subscription link (Google / iPhone Calendar).
      if (!s.calKey || a.reset) {
        const b = new Uint8Array(12); globalThis.crypto.getRandomValues(b);
        s.calKey = Array.from(b, (x) => x.toString(36).padStart(2, '0')).join('').slice(0, 20);
      }
      break;
    }
    case 'leavePair': {
      delete s.members[mid];
      delete s.moods[mid];
      break;
    }
    default:
      throw new ActionError('Невідома дія');
  }
  void partner;
  s.rev++;
  return s;
}

/* ---------------- privacy filter ---------------- */
export function viewFor(state, mid, today, now = Date.now()) {
  const s = structuredClone(state);
  // Gift preparation is visible only to the giver (never to the owner of the wish).
  s.gifts = s.gifts.map((g) => (g.owner === mid ? { ...g, prep: null } : g));
  // Blind dates: details stay secret from the partner until revealed or the day comes.
  s.blind = s.blind.map((b) => (b.by === mid || b.revealed || (isDate(today) && b.date && b.date <= today) ? b : { ...b, details: '', dress: b.dress ? '🤫' : '' }));
  // Delayed notes stay sealed until their time.
  s.notes = s.notes.map((n) => (n.from !== mid && n.openAt && n.openAt > now ? { ...n, text: '', sealed: true } : n));
  // Check-in answers are private until both answered.
  for (const [w, entry] of Object.entries(s.checkins)) {
    const both = Object.keys(entry).length >= 2;
    if (!both) for (const id of Object.keys(entry)) if (id !== mid) entry[id] = { answered: true, ts: entry[id].ts };
    s.checkins[w] = entry;
  }
  return s;
}
