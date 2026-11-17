// Map search runs on the phone itself: OpenStreetMap services refuse requests from cloud servers.
// Nominatim (addresses) + Overpass (places). Data © OpenStreetMap contributors (ODbL).

const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const timeout = (ms) => (AbortSignal.timeout ? AbortSignal.timeout(ms) : undefined);
const str = (v, n) => String(v ?? '').trim().slice(0, n);
const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

export async function geocodeCity(q) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=uk&q=${encodeURIComponent(q)}`, { signal: timeout(10000) });
  if (!r.ok) throw new Error('Сервіс адрес не відповідає');
  const d = (await r.json())[0];
  if (!d) return null;
  const big = ['city', 'administrative', 'town'].includes(d.type) || d.class === 'boundary';
  return { lat: +d.lat, lon: +d.lon, label: str(d.display_name.split(',').slice(0, 2).join(','), 80), radius: big ? 4000 : 2500 };
}

export async function reverse(lat, lon) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=12&accept-language=uk&lat=${lat}&lon=${lon}`, { signal: timeout(7000) });
    const a = (await r.json()).address || {};
    return str(a.city || a.town || a.village || a.suburb || a.county || '', 60);
  } catch { return ''; }
}

function category(t) {
  const a = t.amenity, l = t.leisure, tu = t.tourism, n = t.natural;
  if (a === 'cafe' || a === 'ice_cream') return 'cafe';
  if (a === 'restaurant') return 'restaurant';
  if (a === 'bar' || a === 'pub' || a === 'wine_bar') return 'bar';
  if (a === 'cinema' || a === 'theatre' || a === 'arts_centre') return 'cinema';
  if (tu === 'museum' || tu === 'gallery') return 'museum';
  if (l === 'park' || l === 'garden') return 'park';
  if (tu === 'viewpoint' || n === 'beach') return 'nature';
  if (['zoo', 'aquarium', 'theme_park'].includes(tu) || ['water_park', 'bowling_alley', 'escape_game', 'miniature_golf', 'amusement_arcade', 'ice_rink', 'trampoline_park'].includes(l)) return 'active';
  if (tu === 'attraction') return 'other';
  return null;
}

async function overpass(lat, lon, radius) {
  const around = `(around:${Math.round(radius)},${lat.toFixed(5)},${lon.toFixed(5)})`;
  const q = `[out:json][timeout:10];(
node["amenity"~"^(cafe|ice_cream|restaurant|bar|pub|wine_bar|cinema|theatre|arts_centre)$"]["name"]${around};
nw["leisure"~"^(park|garden|water_park|bowling_alley|escape_game|miniature_golf|ice_rink|trampoline_park)$"]["name"]${around};
nw["tourism"~"^(museum|gallery|viewpoint|attraction|zoo|aquarium|theme_park)$"]["name"]${around};
);out center tags 200;`;
  const ask = async (url) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal: timeout(12000) });
    if (!r.ok) throw new Error(new URL(url).host + ' ' + r.status);
    const d = await r.json();
    if (!Array.isArray(d.elements)) throw new Error('bad map answer');
    return d.elements;
  };
  try { return await Promise.any(MIRRORS.map(ask)); }
  catch (e) { const err = new Error('overpass: ' + (e.errors || [e]).map((x) => x.message).join('; ')); err.map = true; throw err; }
}

function distance(a, b, c, d) {
  const R = 6371000, k = Math.PI / 180;
  const x = Math.sin(((c - a) * k) / 2) ** 2 + Math.cos(a * k) * Math.cos(c * k) * Math.sin(((d - b) * k) / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)));
}

const KINDS = { any: null, coffee: ['cafe'], food: ['restaurant'], walk: ['park', 'nature'], culture: ['museum', 'cinema'], active: ['active'], evening: ['bar', 'restaurant', 'cinema'] };

// Fallback when Overpass is busy: ask Nominatim for each kind of place inside a box (≤1 request/second).
const NOMI_Q = { cafe: 'cafe', restaurant: 'restaurant', bar: 'bar', park: 'park', museum: 'museum', cinema: 'cinema', active: 'bowling', nature: 'viewpoint' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function nominatimPlaces(lat, lon, radius, cats) {
  const dLat = radius / 111000, dLon = radius / (111000 * Math.cos((lat * Math.PI) / 180));
  const box = [lon - dLon, lat + dLat, lon + dLon, lat - dLat].map((x) => x.toFixed(5)).join(',');
  const out = [];
  for (const [i, cat] of cats.entries()) {
    if (i) await sleep(1100);
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=15&accept-language=uk&bounded=1&viewbox=${box}&q=${encodeURIComponent(NOMI_Q[cat])}`, { signal: timeout(8000) });
      if (!r.ok) continue;
      for (const x of await r.json()) {
        out.push({ lat: +x.lat, lon: +x.lon, tags: { name: x.name || String(x.display_name).split(',')[0], [x.category]: x.type, 'addr:street': '' }, fallbackCat: cat });
      }
    } catch { /* next kind */ }
  }
  return out;
}

// Problems on the phone are sent to the server log, so they can be fixed.
export function reportMapError(code, member, message) {
  try { fetch('/api/places', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, member, log: String(message).slice(0, 400), ua: navigator.userAgent.slice(0, 120) }), keepalive: true }); } catch {}
}

// City suggestions while typing (Photon — an OpenStreetMap search made for autocomplete).
export async function suggestCities(q, signal) {
  const r = await fetch(`https://photon.komoot.io/api/?limit=12&lat=49.0&lon=31.4&q=${encodeURIComponent(q)}`, { signal });
  if (!r.ok) return [];
  const d = await r.json();
  const PLACES = ['city', 'town', 'village', 'hamlet', 'suburb', 'borough', 'municipality'];
  const seen = new Set();
  return (d.features || []).filter((f) => {
    const p = f.properties || {};
    return (p.osm_key === 'place' && PLACES.includes(p.osm_value)) || p.type === 'city';
  }).map((f) => {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    const sub = [p.state, p.country].filter(Boolean).join(', ');
    return { name: p.name, sub, lat, lon, radius: ['city', 'municipality'].includes(p.osm_value) ? 4000 : 2500 };
  }).filter((c) => { const k = c.name + c.sub; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 6);
}

const ALL_CATS = ['cafe', 'restaurant', 'park', 'museum', 'cinema', 'bar'];
// Returns up to 40 varied real places around the point.
export async function nearbyPlaces({ lat, lon, radius = 2500, kind = 'any', exclude = [], onFallback }) {
  let els;
  try {
    els = await overpass(lat, lon, radius);
    if (els.length < 8) els = await overpass(lat, lon, radius * 2.5).catch(() => els);
  } catch (e) {
    onFallback?.(e);
    els = await nominatimPlaces(lat, lon, Math.max(radius, 3000), KINDS[kind] ? KINDS[kind].filter((c) => NOMI_Q[c]) : ALL_CATS);
    if (!els.length) { const err = new Error('Мапа зараз не відповідає. Спробуй ще раз за хвилинку.'); err.detail = e.message; throw err; }
  }
  const known = new Set(exclude.map((n) => String(n).toLowerCase()));
  const wanted = KINDS[kind] || null;
  const seen = new Set();
  const all = [];
  for (const e of els) {
    const t = e.tags || {};
    const name = str(t['name:uk'] || t.name, 80);
    const cat = category(t) || e.fallbackCat || null;
    const plat = e.lat ?? e.center?.lat, plon = e.lon ?? e.center?.lon;
    const key = name.toLowerCase();
    if (!name || !cat || plat == null || seen.has(key) || known.has(key)) continue;
    if (wanted && !wanted.includes(cat)) continue;
    seen.add(key);
    all.push({
      name, cat, type: t.amenity || t.leisure || t.tourism || t.natural || '', cuisine: str(t.cuisine, 40).replace(/;/g, ', '),
      lat: +plat.toFixed(6), lon: +plon.toFixed(6), dist: distance(lat, lon, plat, plon),
      address: str([t['addr:street'], t['addr:housenumber']].filter(Boolean).join(', '), 120),
    });
  }
  const byCat = {};
  for (const p of shuffle(all)) (byCat[p.cat] ||= []).push(p);
  return shuffle(Object.values(byCat).flatMap((arr) => arr.slice(0, 8))).slice(0, 40);
}
