// "Куди піти": real places near the user (or in a chosen city) from OpenStreetMap,
// picked and described for a date by Google Gemini (free tier, GEMINI_API_KEY).
// Without the key it still works: picks a varied random set with generic tips.
// Map data © OpenStreetMap contributors (ODbL).

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const DAILY_LIMIT = Number(process.env.PLACES_DAILY_LIMIT || 30);
const UA = 'Hameleonchyky/1.0 (private couples app; https://hameleonchyky.vercel.app)';
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
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

/* ---------------- geocoding (Nominatim) ---------------- */
async function geocodeCity(q) {
  const u = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=uk&q=${encodeURIComponent(q)}`;
  const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: T(8000) });
  if (!r.ok) throw new Error('geocode ' + r.status);
  const d = (await r.json())[0];
  if (!d) return null;
  return { lat: +d.lat, lon: +d.lon, label: str(d.display_name.split(',').slice(0, 2).join(','), 80), big: ['city', 'administrative', 'town'].includes(d.type) || d.class === 'boundary' };
}
async function reverse(lat, lon) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=12&accept-language=uk&lat=${lat}&lon=${lon}`, { headers: { 'User-Agent': UA }, signal: T(6000) });
    const d = await r.json();
    const a = d.address || {};
    return str(a.city || a.town || a.village || a.suburb || a.county || d.name || '', 60);
  } catch { return ''; }
}

/* ---------------- places (Overpass) ---------------- */
const KINDS = {
  any: null,
  coffee: ['cafe'],
  food: ['restaurant'],
  walk: ['park', 'nature'],
  culture: ['museum', 'cinema'],
  active: ['active'],
  evening: ['bar', 'restaurant', 'cinema'],
};
function category(t) {
  const a = t.amenity, l = t.leisure, tu = t.tourism, n = t.natural;
  if (a === 'cafe' || a === 'ice_cream') return 'cafe';
  if (a === 'restaurant') return 'restaurant';
  if (a === 'bar' || a === 'pub' || a === 'wine_bar') return 'bar';
  if (a === 'cinema' || a === 'theatre' || a === 'arts_centre') return 'cinema';
  if (tu === 'museum' || tu === 'gallery' || tu === 'artwork') return 'museum';
  if (l === 'park' || l === 'garden') return 'park';
  if (tu === 'viewpoint' || n === 'beach' || n === 'peak') return 'nature';
  if (['zoo', 'aquarium', 'theme_park'].includes(tu) || ['water_park', 'bowling_alley', 'escape_game', 'miniature_golf', 'amusement_arcade', 'ice_rink', 'trampoline_park'].includes(l)) return 'active';
  if (tu === 'attraction') return 'other';
  return null;
}
async function overpass(lat, lon, radius) {
  const around = `(around:${Math.round(radius)},${lat.toFixed(5)},${lon.toFixed(5)})`;
  const q = `[out:json][timeout:12];(
nwr["amenity"~"^(cafe|ice_cream|restaurant|bar|pub|wine_bar|cinema|theatre|arts_centre)$"]["name"]${around};
nwr["leisure"~"^(park|garden|water_park|bowling_alley|escape_game|miniature_golf|amusement_arcade|ice_rink|trampoline_park)$"]["name"]${around};
nwr["tourism"~"^(museum|gallery|viewpoint|attraction|zoo|aquarium|theme_park)$"]["name"]${around};
);out center tags 250;`;
  // Ask all mirrors at once, take the first good answer, never wait longer than 16 s.
  const ask = async (url) => {
    const r = await fetch(url, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: 'data=' + encodeURIComponent(q), signal: T(16000) });
    if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
    const d = await r.json();
    if (!Array.isArray(d.elements)) throw new Error('bad overpass answer');
    return d.elements;
  };
  try { return await Promise.any(OVERPASS.map(ask)); }
  catch (e) { throw new Error('overpass: ' + (e.errors || [e]).map((x) => x.message).join('; ')); }
}
function distance(a, b, c, d) {
  const R = 6371000, toR = Math.PI / 180;
  const x = Math.sin(((c - a) * toR) / 2) ** 2 + Math.cos(a * toR) * Math.cos(c * toR) * Math.sin(((d - b) * toR) / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)));
}

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
  const started = Date.now();

  try {
    let lat = Number(body.lat), lon = Number(body.lon), label = '', radius = 2500;
    if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
      label = await reverse(lat, lon);
    } else {
      const city = str(body.city, 80);
      if (!city) return json({ error: 'Вкажи місто або дозволь геолокацію' }, 400);
      const g = await geocodeCity(city);
      if (!g) return json({ error: `Не знайшли «${city}». Спробуй інакше написати.` }, 404);
      ({ lat, lon, label } = g);
      radius = g.big ? 5000 : 3000;
    }

    let els = await overpass(lat, lon, radius);
    if (els.length < 8 && Date.now() - started < 25000) els = await overpass(lat, lon, radius * 2.5).catch(() => els);
    const known = new Set((room.places || []).map((p) => String(p.name).toLowerCase()));
    const seen = new Set();
    const wanted = KINDS[kind];
    const all = [];
    for (const e of els) {
      const t = e.tags || {};
      const name = str(t['name:uk'] || t.name, 80);
      const cat = category(t);
      const plat = e.lat ?? e.center?.lat, plon = e.lon ?? e.center?.lon;
      if (!name || !cat || plat == null || seen.has(name.toLowerCase()) || known.has(name.toLowerCase())) continue;
      if (wanted && !wanted.includes(cat)) continue;
      seen.add(name.toLowerCase());
      const street = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(', ');
      all.push({
        name, cat, type: t.amenity || t.leisure || t.tourism || t.natural, cuisine: str(t.cuisine, 40).replace(/;/g, ', '),
        lat: plat, lon: plon, dist: distance(lat, lon, plat, plon), address: str(street, 120),
        osm: `https://www.openstreetmap.org/${e.type}/${e.id}`,
      });
    }
    if (!all.length) return json({ error: 'Поруч не знайшли підходящих місць. Спробуй інший тип або місто.' }, 404);

    // Varied sample: at most 8 per category, closest first inside each category.
    const byCat = {};
    for (const p of shuffle(all)) (byCat[p.cat] ||= []).push(p);
    const cands = shuffle(Object.values(byCat).flatMap((arr) => arr.slice(0, 8))).slice(0, 40);

    let picks = null, ai = false;
    if (GEMINI_KEY) {
      try { picks = await geminiPick(cands, kind, label); ai = picks.length > 0; } catch (e) { console.error('gemini', e.message); }
    }
    if (picks && picks.length && picks.length < 4) {
      for (const c of cands) { if (picks.length >= 5) break; if (!picks.some((p) => p.name === c.name)) picks.push({ ...c, why: '', idea: TIPS[c.cat][Math.floor(Math.random() * TIPS[c.cat].length)] }); }
    }
    if (!picks || !picks.length) {
      const seenCat = new Set();
      picks = [];
      for (const c of cands) { if (picks.length >= 5) break; if (seenCat.has(c.cat) && cands.length > 8) continue; seenCat.add(c.cat); picks.push(c); }
      for (const c of cands) { if (picks.length >= 5) break; if (!picks.includes(c)) picks.push(c); }
      picks = picks.map((p) => ({ ...p, why: '', idea: TIPS[p.cat][Math.floor(Math.random() * TIPS[p.cat].length)] }));
    }
    picks = picks.map(({ cuisine, type, ...p }) => ({ ...p, map: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${p.lat},${p.lon}`)}` }));
    return json({ where: label, ai, places: picks, attribution: '© OpenStreetMap' });
  } catch (e) {
    console.error('places failed:', e.message);
    return json({ error: e.name === 'TimeoutError' || /abort|timeout/i.test(e.message) ? 'Мапа зараз відповідає повільно. Спробуй ще раз за хвилинку.' : 'Не вдалося знайти місця. Спробуй ще раз за хвилинку.' }, 502);
  }
}

// Health check: /api/places?diag=1 — shows whether map services answer from the server.
export async function GET(request) {
  if (!new URL(request.url).searchParams.get('diag')) return json({ error: 'POST only' }, 405);
  const out = {};
  const time = async (name, fn) => { const t = Date.now(); try { const v = await fn(); out[name] = { ok: true, ms: Date.now() - t, info: v }; } catch (e) { out[name] = { ok: false, ms: Date.now() - t, error: e.message }; } };
  await time('nominatim', async () => (await geocodeCity('Львів'))?.label);
  await time('overpass', async () => (await overpass(49.8419, 24.0315, 1500)).length + ' places');
  await time('gemini_key', async () => (GEMINI_KEY ? 'set' : 'missing'));
  return json(out);
}
