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
  const q = `[out:json][timeout:15];(
nwr["amenity"~"^(cafe|ice_cream|restaurant|bar|pub|wine_bar|cinema|theatre|arts_centre)$"]["name"]${around};
nwr["leisure"~"^(park|garden|water_park|bowling_alley|escape_game|miniature_golf|amusement_arcade|ice_rink|trampoline_park)$"]["name"]${around};
nwr["tourism"~"^(museum|gallery|viewpoint|attraction|zoo|aquarium|theme_park)$"]["name"]${around};
nwr["natural"="beach"]["name"]${around};
);out center tags 250;`;
  const ask = async (url) => {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(q), signal: timeout(18000) });
    if (!r.ok) throw new Error('map ' + r.status);
    const d = await r.json();
    if (!Array.isArray(d.elements)) throw new Error('bad map answer');
    return d.elements;
  };
  try { return await Promise.any(MIRRORS.map(ask)); }
  catch { throw new Error('Мапа зараз не відповідає. Спробуй ще раз за хвилинку.'); }
}

function distance(a, b, c, d) {
  const R = 6371000, k = Math.PI / 180;
  const x = Math.sin(((c - a) * k) / 2) ** 2 + Math.cos(a * k) * Math.cos(c * k) * Math.sin(((d - b) * k) / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(x)));
}

const KINDS = { any: null, coffee: ['cafe'], food: ['restaurant'], walk: ['park', 'nature'], culture: ['museum', 'cinema'], active: ['active'], evening: ['bar', 'restaurant', 'cinema'] };

// Returns up to 40 varied real places around the point.
export async function nearbyPlaces({ lat, lon, radius = 2500, kind = 'any', exclude = [] }) {
  let els = await overpass(lat, lon, radius);
  if (els.length < 8) els = await overpass(lat, lon, radius * 2.5).catch(() => els);
  const known = new Set(exclude.map((n) => String(n).toLowerCase()));
  const wanted = KINDS[kind] || null;
  const seen = new Set();
  const all = [];
  for (const e of els) {
    const t = e.tags || {};
    const name = str(t['name:uk'] || t.name, 80);
    const cat = category(t);
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
