// Random recipe finder.
// Free by default: a real recipe from TheMealDB (free open recipe database) translated into Ukrainian
// by Google Gemini (free tier, GEMINI_API_KEY). Without any key the recipe comes in English.
// Optional paid alternative: ANTHROPIC_API_KEY (Claude with live web search) — used only if Gemini key is absent.

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 30); // per pair per day
const MEALDB = 'https://www.themealdb.com/api/json/v1/1';

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const memory = globalThis.__ottershipMemory || (globalThis.__ottershipMemory = new Map());
const useMemory = !REDIS_URL && process.env.DEV_MEMORY === '1';

async function redis(cmd) {
  const r = await fetch(REDIS_URL, { method: 'POST', headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  if (!r.ok) throw new Error('Redis ' + r.status);
  return (await r.json()).result;
}
async function loadRoom(code) {
  if (useMemory) return memory.get(code) || null;
  const raw = await redis(['GET', 'room:' + code]);
  return raw ? JSON.parse(raw) : null;
}
async function countUse(code) {
  const key = `ai:${code}:${new Date().toISOString().slice(0, 10)}`;
  if (useMemory) { const n = (memory.get(key) || 0) + 1; memory.set(key, n); return n; }
  const n = await redis(['INCR', key]);
  if (n === 1) await redis(['EXPIRE', key, 172800]);
  return n;
}

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const str = (v, n) => String(v ?? '').trim().slice(0, n);
const getJson = async (url) => { const r = await fetch(url, { signal: AbortSignal.timeout(10000) }); if (!r.ok) throw new Error('fetch ' + r.status); return r.json(); };

/* ---------------- TheMealDB ---------------- */
// kind → list filters to choose from (null = fully random)
const MEALDB_KINDS = {
  any: null,
  breakfast: ['c=Breakfast'],
  dinner: ['c=Seafood', 'c=Chicken', 'c=Pasta', 'c=Beef', 'c=Lamb', 'a=Italian', 'a=French'],
  dessert: ['c=Dessert'],
  quick: ['c=Pasta', 'c=Starter', 'c=Side', 'c=Breakfast'],
  ukrainian: ['a=Ukrainian', 'a=Polish', 'a=Georgian'],
  healthy: ['c=Vegetarian', 'c=Vegan', 'c=Seafood'],
};

async function mealdbRecipe(kind, excludeIds) {
  const filters = MEALDB_KINDS[kind] ?? null;
  for (let attempt = 0; attempt < 4; attempt++) {
    let meal;
    if (!filters) {
      meal = (await getJson(`${MEALDB}/random.php`)).meals?.[0];
    } else {
      const list = (await getJson(`${MEALDB}/filter.php?${pick(filters)}`)).meals || [];
      const fresh = list.filter((m) => !excludeIds.includes(m.idMeal));
      const choice = pick(fresh.length ? fresh : list);
      if (!choice) continue;
      meal = (await getJson(`${MEALDB}/lookup.php?i=${choice.idMeal}`)).meals?.[0];
    }
    if (!meal || (excludeIds.includes(meal.idMeal) && attempt < 3)) continue;
    const ingredients = [];
    for (let i = 1; i <= 20; i++) {
      const ing = str(meal['strIngredient' + i], 60);
      if (ing) ingredients.push(`${str(meal['strMeasure' + i], 30)} ${ing}`.trim());
    }
    const steps = str(meal.strInstructions, 6000).split(/\r?\n+|(?<=\.)\s+(?=[A-Z])/).map((s) => s.replace(/^(step\s*)?\d+[.)]?\s*/i, '').trim()).filter((s) => s.length > 3);
    const src = /^https?:\/\//i.test(meal.strSource || '') ? meal.strSource : `https://www.themealdb.com/meal/${meal.idMeal}`;
    return {
      ext: 'mealdb:' + meal.idMeal,
      title: str(meal.strMeal, 80),
      category: meal.strCategory, area: meal.strArea,
      ingredients, steps,
      image: /^https:\/\//.test(meal.strMealThumb || '') ? meal.strMealThumb : '',
      source_url: src,
      source_name: (() => { try { return new URL(src).hostname.replace(/^www\./, ''); } catch { return 'TheMealDB'; } })(),
      lang: 'en',
    };
  }
  throw new Error('no_recipe');
}

/* ---------------- Gemini (free tier) translation ---------------- */
async function translateGemini(r) {
  const prompt = `Переклади й адаптуй цей рецепт українською мовою для застосунку пари.
Правила: природна українська; одиниці — метричні (г, мл, ст. л., ч. л., шт.); інгредієнти — коротко, з кількістю на початку;
кроки — короткі, по одній дії; оціни загальний час приготування і кількість порцій; додай один рядок опису, чому страва смачна.
Поверни ЛИШЕ JSON: {"title":"…","description":"…","time":"40 хв","servings":"2–3 порції","ingredients":["…"],"steps":["…"]}
Рецепт (${r.area || ''} ${r.category || ''}):
Назва: ${r.title}
Інгредієнти: ${r.ingredients.join('; ')}
Приготування: ${r.steps.join(' ')}`;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
    method: 'POST',
    signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.4 } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || 'Gemini ' + res.status);
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  const t = JSON.parse(text.replace(/^```(json)?|```$/g, '').trim());
  return {
    ...r,
    title: str(t.title, 80) || r.title,
    description: str(t.description, 300),
    time: str(t.time, 30),
    servings: str(t.servings, 30),
    ingredients: (Array.isArray(t.ingredients) ? t.ingredients : []).map((x) => str(x, 80)).filter(Boolean).slice(0, 40),
    steps: (Array.isArray(t.steps) ? t.steps : []).map((x) => str(x, 400)).filter(Boolean).slice(0, 30),
    lang: 'uk',
  };
}

/* ---------------- Claude with web search (optional, paid) ---------------- */
const KINDS_UK = { any: 'будь-яку цікаву страву', breakfast: 'сніданок', dinner: 'романтичну вечерю на двох', dessert: 'десерт', quick: 'швидку страву (до 30 хвилин)', ukrainian: 'страву української кухні', healthy: 'корисну, легку страву' };
async function claudeRecipe(kind, exclude) {
  const system = `Ти — кулінарний помічник. Знайди через web_search ОДИН реальний цікавий рецепт. Не обирай: ${exclude.join('; ') || 'немає'}.
Усе українською, метричні одиниці, порції на 2. Відповідь — ЛИШЕ JSON у тегах <recipe></recipe>:
<recipe>{"title":"…","description":"…","time":"40 хв","servings":"2 порції","ingredients":["…"],"steps":["…"],"source_url":"https://…","source_name":"…"}</recipe>`;
  let messages = [{ role: 'user', content: `Знайди рецепт: ${KINDS_UK[kind] || KINDS_UK.any}. Здивуй нас!` }];
  let content = [];
  for (let round = 0; round < 3; round++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 2500, system, messages, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }] }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error?.message || 'AI ' + r.status);
    content = data.content || [];
    if (data.stop_reason !== 'pause_turn') break;
    messages = [...messages, { role: 'assistant', content }];
  }
  const text = content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const m = text.match(/<recipe>([\s\S]*?)<\/recipe>/);
  if (!m) throw new Error('no_recipe');
  const raw = JSON.parse(m[1]);
  const seen = content.filter((b) => b.type === 'web_search_tool_result' && Array.isArray(b.content)).flatMap((b) => b.content.map((x) => x.url)).filter(Boolean);
  let url = str(raw.source_url, 300);
  if (!/^https?:\/\//i.test(url) || (seen.length && !seen.includes(url))) url = seen[0] || '';
  return {
    title: str(raw.title, 80), description: str(raw.description, 300), time: str(raw.time, 30), servings: str(raw.servings, 30),
    ingredients: (raw.ingredients || []).map((x) => str(x, 80)).filter(Boolean).slice(0, 40),
    steps: (raw.steps || []).map((x) => str(x, 400)).filter(Boolean).slice(0, 25),
    source_url: url, source_name: str(raw.source_name, 60), image: '', lang: 'uk',
  };
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Невірний запит' }, 400); }
  if (!useMemory && !(REDIS_URL && REDIS_TOKEN)) return json({ error: 'not_configured' }, 503);
  const code = String(body?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const mid = String(body?.member || '').slice(0, 40);
  const room = await loadRoom(code);
  if (!room || !room.members?.[mid]) return json({ error: 'Пару не знайдено' }, 403);
  if ((await countUse(code)) > DAILY_LIMIT) return json({ error: `На сьогодні ліміт пошуку рецептів (${DAILY_LIMIT}) вичерпано. Завтра — нові!` }, 429);
  const kind = KINDS_UK[body.kind] ? body.kind : 'any';
  const recipes = room.recipes || [];

  try {
    if (!GEMINI_KEY && ANTHROPIC_KEY) {
      return json({ recipe: await claudeRecipe(kind, recipes.map((r) => r.title).slice(0, 40)), via: 'claude' });
    }
    const excludeIds = recipes.map((r) => String(r.ext || '').replace('mealdb:', '')).filter(Boolean);
    const base = await mealdbRecipe(kind, excludeIds);
    if (!GEMINI_KEY) return json({ recipe: base, via: 'mealdb', note: 'no_translation' });
    try {
      return json({ recipe: await translateGemini(base), via: 'gemini' });
    } catch (e) {
      console.error('gemini', e.message);
      return json({ recipe: base, via: 'mealdb', note: 'translation_failed' });
    }
  } catch (e) {
    console.error(e);
    return json({ error: 'Не вдалося знайти рецепт. Спробуй ще раз.' }, 502);
  }
}
