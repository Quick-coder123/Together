// AI recipe finder: Claude searches the web for an interesting recipe and returns it in Ukrainian.
// Needs ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables.

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 20); // per pair per day

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

const KINDS = {
  any: 'будь-яку цікаву страву',
  breakfast: 'сніданок',
  dinner: 'романтичну вечерю на двох',
  dessert: 'десерт',
  quick: 'швидку страву (до 30 хвилин)',
  ukrainian: 'страву української кухні (можна з сучасним твістом)',
  healthy: 'корисну, легку страву',
};
const SPARKS = ['італійська', 'японська', 'грузинська', 'мексиканська', 'тайська', 'французька', 'індійська', 'середземноморська', 'корейська', 'турецька', 'українська', 'скандинавська', 'вʼєтнамська', 'іспанська', 'ліванська'];
const INGR = ['курка', 'гриби', 'гарбуз', 'сир', 'креветки', 'лосось', 'нут', 'баклажан', 'яйця', 'рис', 'паста', 'ягоди', 'шоколад', 'яблука', 'тофу', 'картопля', 'сочевиця', 'авокадо'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const str = (v, n) => String(v ?? '').trim().slice(0, n);

async function askClaude(kind, exclude) {
  const spark = kind === 'ukrainian' ? 'українська' : pick(SPARKS);
  const system = `Ти — кулінарний помічник у застосунку для пари. Знайди в інтернеті (через web_search) ОДИН реальний, цікавий і здійсненний удома рецепт.
Правила:
- Шукай на кулінарних сайтах, обери рецепт з конкретними кількостями інгредієнтів.
- Не обирай страви з цього списку (вже є в пари): ${exclude.length ? exclude.join('; ') : 'немає'}.
- Перекладай і адаптуй усе українською мовою, метричні одиниці (г, мл, ст. л., ч. л.).
- Порції — на 2 особи, якщо можливо.
- Відповідь — ЛИШЕ JSON всередині тегів <recipe></recipe>, без іншого тексту, у форматі:
<recipe>{"title":"…","description":"одне речення, чому це смачно","time":"40 хв","servings":"2 порції","ingredients":["200 г …","…"],"steps":["…","…"],"source_url":"https://…","source_name":"назва сайту"}</recipe>`;
  const user = `Знайди рецепт: ${KINDS[kind] || KINDS.any}. Для різноманіття орієнтуйся на кухню: ${spark}, або використай інгредієнт: ${pick(INGR)}. Здивуй нас!`;

  let messages = [{ role: 'user', content: user }];
  let content = [];
  for (let round = 0; round < 3; round++) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2500,
        system,
        messages,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error?.message || 'AI ' + r.status);
    content = data.content || [];
    if (data.stop_reason !== 'pause_turn') break;
    messages = [...messages, { role: 'assistant', content }];
  }
  const text = content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  const m = text.match(/<recipe>([\s\S]*?)<\/recipe>/) || text.match(/(\{[\s\S]*"ingredients"[\s\S]*\})/);
  if (!m) throw new Error('no_recipe');
  const raw = JSON.parse(m[1]);
  // A source the model actually saw in search results (to cite it honestly).
  const seen = content.filter((b) => b.type === 'web_search_tool_result' && Array.isArray(b.content)).flatMap((b) => b.content.map((x) => x.url)).filter(Boolean);
  let url = str(raw.source_url, 300);
  if (!/^https?:\/\//i.test(url) || (seen.length && !seen.includes(url))) url = seen.find((u) => u === url) || seen[0] || '';
  const recipe = {
    title: str(raw.title, 80),
    description: str(raw.description, 300),
    time: str(raw.time, 30),
    servings: str(raw.servings, 30),
    ingredients: (Array.isArray(raw.ingredients) ? raw.ingredients : []).map((x) => str(x, 80)).filter(Boolean).slice(0, 40),
    steps: (Array.isArray(raw.steps) ? raw.steps : []).map((x) => str(x, 400)).filter(Boolean).slice(0, 25),
    source_url: url,
    source_name: str(raw.source_name, 60) || (url ? new URL(url).hostname.replace(/^www\./, '') : ''),
  };
  if (!recipe.title || !recipe.ingredients.length) throw new Error('no_recipe');
  return recipe;
}

export async function POST(request) {
  if (!API_KEY) return json({ error: 'ai_not_configured' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Невірний запит' }, 400); }
  const code = String(body?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const mid = String(body?.member || '').slice(0, 40);
  if (!useMemory && !(REDIS_URL && REDIS_TOKEN)) return json({ error: 'not_configured' }, 503);
  const room = await loadRoom(code);
  if (!room || !room.members?.[mid]) return json({ error: 'Пару не знайдено' }, 403);
  if ((await countUse(code)) > DAILY_LIMIT) return json({ error: `На сьогодні ліміт ШІ-рецептів (${DAILY_LIMIT}) вичерпано. Завтра — нові!` }, 429);
  const kind = KINDS[body.kind] ? body.kind : 'any';
  const exclude = (room.recipes || []).map((r) => r.title).slice(0, 40);
  try {
    let recipe;
    try { recipe = await askClaude(kind, exclude); } catch (e) { if (e.message === 'no_recipe' || e instanceof SyntaxError) recipe = await askClaude(kind, exclude); else throw e; }
    return json({ recipe });
  } catch (e) {
    console.error(e);
    return json({ error: 'ШІ не зміг знайти рецепт. Спробуй ще раз.' }, 502);
  }
}
