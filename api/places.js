// "Куди піти": the phone finds real places on OpenStreetMap (see js/osm.js — OSM refuses cloud servers),
// Гід-хамелеон (Google Gemini, free tier, GEMINI_API_KEY) picks five and suggests a date idea for each.
// Without the key it still works with simple tips.

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const DAILY_LIMIT = Number(process.env.PLACES_DAILY_LIMIT || 30);
const T = (ms) => AbortSignal.timeout(ms);

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
  const key = `pl:${code}:${new Date().toISOString().slice(0, 10)}`;
  if (useMemory) { const n = (memory.get(key) || 0) + 1; memory.set(key, n); return n; }
  const n = await redis(['INCR', key]);
  if (n === 1) await redis(['EXPIRE', key, 172800]);
  return n;
}

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const str = (v, n) => String(v ?? '').trim().slice(0, n);
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

const KINDS = {
  any: null,
  coffee: ['cafe'],
  food: ['restaurant'],
  walk: ['park', 'nature'],
  culture: ['museum', 'cinema'],
  active: ['active'],
  evening: ['bar', 'restaurant', 'cinema'],
};
const TIPS = {
  cafe: ['Візьміть по десерту й поділіться навпіл', 'Спробуйте замовити одне одному напій-сюрприз'],
  restaurant: ['Замовте страви, яких ще ніколи не куштували', 'Кожен обирає страву для іншого'],
  bar: ['Придумайте тост одне за одного', 'Спробуйте коктейль, який порадить бармен'],
  cinema: ['Оберіть фільм наосліп за назвою', 'Після сеансу — обговорення за кавою'],
  museum: ['Знайдіть експонат, що найбільше схожий на вас двох', 'Кожен показує свою улюблену роботу'],
  park: ['Візьміть плед і термос із чаєм', 'Влаштуйте фотополювання на найкрасивіший кадр'],
  nature: ['Прийдіть на захід сонця', 'Візьміть з собою смаколики для пікніка'],
  active: ['Змагання: хто програв — пригощає кавою', 'Зробіть спільне селфі в процесі'],
  other: ['Розкажіть одне одному, що вас тут здивувало', 'Зробіть фото на памʼять'],
};

async function geminiPick(cands, kind, where) {
  const list = cands.map((c, i) => `${i}. ${c.name} — ${c.type}${c.cuisine ? ', кухня: ' + c.cuisine : ''}, ${c.dist} м`).join('\n');
  const prompt = `Ти допомагаєш парі обрати, куди піти на спонтанне побачення ${where ? 'у місці «' + where + '»' : ''}.
Побажання: ${({ any: 'будь-що цікаве', coffee: 'кава й десерти', food: 'смачно поїсти', walk: 'прогулянка на природі', culture: 'культура: музей, кіно, театр', active: 'щось активне й веселе', evening: 'вечір: бар, ресторан чи кіно' })[kind] || 'будь-що цікаве'}.
Ось реальні місця поруч (номер. назва — тип, відстань):
${list}
Обери 5 найцікавіших і різноманітних (різні типи, якщо можливо). Для кожного напиши українською:
"why" — одне коротке речення, чому це гарне місце для побачення; "idea" — одна конкретна мила ідея, що там зробити удвох.
Поверни ЛИШЕ JSON: {"picks":[{"i":0,"why":"…","idea":"…"}]}`;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
    method: 'POST',
    signal: T(15000),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.9 } }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || 'Gemini ' + r.status);
  const text = d.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  const picks = JSON.parse(text.replace(/^```(json)?|```$/g, '').trim()).picks || [];
  return picks.filter((p) => Number.isInteger(p.i) && cands[p.i]).slice(0, 5).map((p) => ({ ...cands[p.i], why: str(p.why, 200), idea: str(p.idea, 200) }));
}

const CATS = ['cafe', 'restaurant', 'bar', 'park', 'museum', 'cinema', 'nature', 'active', 'other'];

// The phone finds real places on the map and sends them here; Гід-хамелеон picks the best five and adds ideas.
export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Невірний запит' }, 400); }
  if (!useMemory && !(REDIS_URL && REDIS_TOKEN)) return json({ error: 'not_configured' }, 503);
  const code = String(body?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const mid = String(body?.member || '').slice(0, 40);
  const room = await loadRoom(code);
  if (!room || !room.members?.[mid]) return json({ error: 'Пару не знайдено' }, 403);
  if ((await countUse(code)) > DAILY_LIMIT) return json({ error: `На сьогодні ліміт пошуку місць (${DAILY_LIMIT}) вичерпано. Завтра — нові!` }, 429);
  const kind = KINDS[body.kind] !== undefined ? body.kind : 'any';
  const where = str(body.where, 80);
  const cands = (Array.isArray(body.cands) ? body.cands : []).slice(0, 40).map((c) => ({
    name: str(c.name, 80), cat: CATS.includes(c.cat) ? c.cat : 'other', type: str(c.type, 30), cuisine: str(c.cuisine, 40),
    lat: Number(c.lat), lon: Number(c.lon), dist: Math.max(0, Math.round(Number(c.dist) || 0)), address: str(c.address, 120),
  })).filter((c) => c.name && Number.isFinite(c.lat) && Number.isFinite(c.lon));
  if (!cands.length) return json({ error: 'Поруч не знайшли підходящих місць. Спробуй інший тип або місто.' }, 404);

  let picks = null, ai = false;
  if (GEMINI_KEY) {
    try { picks = await geminiPick(cands, kind, where); ai = picks.length > 0; } catch (e) { console.error('gemini', e.message); }
  }
  const tip = (c) => TIPS[c.cat][Math.floor(Math.random() * TIPS[c.cat].length)];
  if (picks && picks.length && picks.length < 4) {
    for (const c of cands) { if (picks.length >= 5) break; if (!picks.some((p) => p.name === c.name)) picks.push({ ...c, why: '', idea: tip(c) }); }
  }
  if (!picks || !picks.length) {
    const seenCat = new Set();
    picks = [];
    for (const c of cands) { if (picks.length >= 5) break; if (seenCat.has(c.cat) && cands.length > 8) continue; seenCat.add(c.cat); picks.push(c); }
    for (const c of cands) { if (picks.length >= 5) break; if (!picks.includes(c)) picks.push(c); }
    picks = picks.map((p) => ({ ...p, why: '', idea: tip(p) }));
  }
  picks = picks.map(({ cuisine, type, ...p }) => ({ ...p, map: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.lat},${p.lon}`)}` }));
  return json({ where, ai, places: picks });
}
