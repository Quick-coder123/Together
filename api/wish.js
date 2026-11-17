// «Хамі-Нишпорка»: reads a shop page by link and fills a wish (name, photo, price, description, link).
// 1) The page is fetched here and the facts are taken from the shop's own markup
//    (schema.org Product JSON-LD, Open Graph, product:price meta, itemprop).
// 2) Gemini (free tier, GEMINI_API_KEY) tidies the name, writes a short Ukrainian description
//    and finds the price in the text if the markup had none. If the shop blocks our server,
//    Gemini reads the link itself (url_context tool).
import { kv, roomKey } from './_notify.js';

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const DAILY_LIMIT = Number(process.env.WISH_DAILY_LIMIT || 40);
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const str = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const CUR = { UAH: '₴', грн: '₴', USD: '$', EUR: '€', PLN: 'zł', GBP: '£' };

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", hellip: '…', laquo: '«', raquo: '»', ndash: '–', mdash: '—' };
const decode = (s) => String(s || '').replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
  return ENT[e.toLowerCase()] ?? m;
});

export function fmtPrice(amount, currency) {
  const n = Number(String(amount ?? '').replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(n) || n <= 0) return '';
  const num = (Math.round(n * 100) / 100).toLocaleString('uk-UA', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }).replace(/ |,(?=\d{3})/g, ' ');
  const sym = CUR[String(currency || '').toUpperCase()] || CUR[currency] || (currency ? ' ' + currency : '₴');
  return sym === '$' || sym === '€' || sym === '£' ? sym + num : num + ' ' + sym.trim();
}

function safeUrl(raw) {
  let u;
  try { u = new URL(String(raw || '').trim()); } catch { return null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const h = u.hostname.toLowerCase();
  if (!h.includes('.') || h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':')) return null; // no raw IPs
  return u;
}
const abs = (src, base) => { try { const u = new URL(decode(src), base); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch { return ''; } };

/* ---------------- markup parsing ---------------- */
function meta(html, key) {
  const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${key}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  const m = tag?.match(/content\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
  return m ? decode(m[1] ?? m[2] ?? '') : '';
}
function jsonLdProduct(html) {
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
  const flat = [];
  const walk = (x) => { if (!x || typeof x !== 'object') return; if (Array.isArray(x)) return x.forEach(walk); flat.push(x); if (x['@graph']) walk(x['@graph']); };
  for (const b of blocks) { try { walk(JSON.parse(b.trim())); } catch { /* broken JSON-LD is common */ } }
  const isProduct = (o) => [].concat(o['@type'] || []).some((t) => /Product|ProductGroup|Offer/i.test(t));
  const p = flat.find(isProduct);
  if (!p) return null;
  let offers = p.offers || (/(Offer)/i.test(p['@type']) ? p : null);
  if (Array.isArray(offers)) offers = offers[0];
  if (offers?.offers) offers = [].concat(offers.offers)[0] || offers;
  const img = [].concat(p.image || [])[0];
  return {
    title: p.name, description: p.description,
    image: typeof img === 'string' ? img : img?.url || img?.contentUrl,
    price: offers?.price ?? offers?.lowPrice ?? offers?.priceSpecification?.price,
    currency: offers?.priceCurrency || offers?.priceSpecification?.priceCurrency,
    brand: typeof p.brand === 'string' ? p.brand : p.brand?.name,
  };
}
function pageText(html) {
  return decode(html.replace(/<(script|style|noscript|svg|head)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
export function parseProduct(html, url) {
  const ld = jsonLdProduct(html) || {};
  const title = ld.title || meta(html, 'og:title') || meta(html, 'twitter:title') || decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '');
  const price = ld.price ?? (meta(html, 'product:price:amount') || meta(html, 'og:price:amount') || meta(html, 'price'));
  const currency = ld.currency || meta(html, 'product:price:currency') || meta(html, 'og:price:currency') || meta(html, 'priceCurrency');
  const linkImg = html.match(/<link[^>]+rel=["']image_src["'][^>]*>/i)?.[0]?.match(/href=["']([^"']+)["']/i)?.[1];
  const propImg = html.match(/<img[^>]+itemprop=["']image["'][^>]*>/i)?.[0]?.match(/(?:data-src|src)=["']([^"']+)["']/i)?.[1];
  const image = abs(ld.image || meta(html, 'og:image') || meta(html, 'og:image:secure_url') || meta(html, 'og:image:url') || meta(html, 'twitter:image') || meta(html, 'twitter:image:src') || linkImg || propImg || '', url);
  return {
    title: str(title, 200),
    description: str(decode(ld.description || meta(html, 'og:description') || meta(html, 'description')), 1000),
    price: price !== '' && price != null ? String(price) : '',
    currency: str(currency, 5),
    image,
    site: str(meta(html, 'og:site_name'), 60),
    brand: str(ld.brand, 60),
  };
}

/* ---------------- fetching ---------------- */
async function fetchPage(u) {
  const res = await fetch(u.href, {
    redirect: 'follow',
    signal: AbortSignal.timeout(10000),
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'uk-UA,uk;q=0.9,en;q=0.7' },
  });
  if (!res.ok) throw new Error('page ' + res.status);
  if (!/html|xml/i.test(res.headers.get('content-type') || 'text/html')) throw new Error('not html');
  const reader = res.body.getReader();
  const chunks = []; let size = 0;
  while (size < 2_000_000) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); size += value.length; }
  reader.cancel().catch(() => {});
  return new TextDecoder('utf-8').decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
}

async function gemini(parts, { tools, jsonMode = true, timeout = 25000 } = {}) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
    method: 'POST',
    signal: AbortSignal.timeout(timeout),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], ...(tools ? { tools } : {}), generationConfig: { temperature: 0.2, ...(jsonMode ? { responseMimeType: 'application/json' } : {}) } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || 'Gemini ' + res.status);
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  const m = text.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : text);
}

const RULES = `Поверни ЛИШЕ JSON: {"title":"…","description":"…","price":"…","currency":"UAH","image":"https://…"}
- title: коротка назва товару (до 70 символів), з брендом і моделлю, без назви магазину, кодів і слів «купити», «ціна»;
- description: 1–2 речення українською, що це і чим цікаве (без реклами й емодзі); якщо нічого не відомо — "";
- price: лише число поточної ціни (без валюти), якщо є знижка — ціна зі знижкою; не знаєш — "";
- currency: код валюти (UAH, USD, EUR, PLN…), за замовчуванням UAH для українських магазинів;
- image: пряме посилання на головне фото товару, лише якщо воно є у даних; інакше "".`;

async function tidy(found, text, url) {
  const t = await gemini([{ text: `Це дані зі сторінки товару в інтернет-магазині (${url}). ${RULES}
Розмітка сторінки: ${JSON.stringify(found)}
Текст сторінки (уривок): ${text.slice(0, 7000)}` }]);
  return t;
}
async function readByGemini(url) {
  return gemini([{ text: `Відкрий цю сторінку товару й визнач, що це за товар: ${url}\n${RULES}` }], { tools: [{ url_context: {} }], jsonMode: false, timeout: 40000 });
}

/* Photos are saved inside the wish as a small JPEG, so shop hot-link protection,
   http links, webp/avif formats or a deleted product page never break the picture. */
async function grab(url, headers = {}) {
  const r = await fetch(url, { signal: AbortSignal.timeout(9000), headers: { 'User-Agent': UA, Accept: 'image/avif,image/webp,image/*,*/*', ...headers } });
  if (!r.ok) throw new Error('img ' + r.status);
  const type = (r.headers.get('content-type') || '').split(';')[0];
  const buf = Buffer.from(await r.arrayBuffer());
  return { type, buf };
}
export async function embedImage(src, pageUrl) {
  if (!src) return '';
  const tries = [
    async () => grab(`https://wsrv.nl/?url=${encodeURIComponent(src)}&w=260&h=260&fit=cover&a=attention&output=jpg&q=68`),
    async () => grab(src, { Referer: pageUrl }),
  ];
  for (const t of tries) {
    try {
      const { type, buf } = await t();
      if (!/^image\/(jpeg|png|webp)$/.test(type) || buf.length < 300) continue;
      const data = `data:${type};base64,${buf.toString('base64')}`;
      if (data.length <= 45000) return data;
    } catch (e) { console.error('wish img', e.message); }
  }
  return /^https:\/\//.test(src) && src.length <= 600 ? src : '';
}

async function countUse(code) {
  const key = `wish:${code}:${new Date().toISOString().slice(0, 10)}`;
  const n = ((await kv.get(key)) || 0) + 1;
  await kv.set(key, n);
  return n;
}

export async function scan(rawUrl) {
  const u = safeUrl(rawUrl);
  if (!u) throw Object.assign(new Error('Це не схоже на посилання на сторінку магазину'), { status: 400 });
  let found = null, text = '', fetchErr = null;
  try {
    const html = await fetchPage(u);
    found = parseProduct(html, u.href);
    text = pageText(html);
  } catch (e) { fetchErr = e; console.error('wish fetch', u.hostname, e.message); }

  let ai = null;
  if (GEMINI_KEY) {
    try { ai = found && (found.title || text) ? await tidy(found, text, u.href) : await readByGemini(u.href); }
    catch (e) { console.error('wish gemini', e.message); }
  }
  if (!found?.title && !ai?.title) throw Object.assign(new Error(fetchErr ? 'Магазин не пустив Хамі на сторінку. Додай бажання вручну — посилання збережемо.' : 'Не вдалося розпізнати товар на сторінці'), { status: 422 });

  const f = found || {};
  const rawImg = abs((f.image || ai?.image || ''), u.href);
  const image = await embedImage(rawImg, u.href);
  console.log('wish scan', u.hostname, { page: !fetchErr, ai: !!ai, img: rawImg ? rawImg.slice(0, 120) : 'none', saved: image.startsWith('data:') ? 'embedded' : image ? 'link' : 'none' });
  return {
    title: str(ai?.title || f.title, 100),
    note: str(ai?.description || f.description, 600),
    price: fmtPrice(f.price || ai?.price, f.currency || ai?.currency || (/\.ua$/.test(u.hostname) ? 'UAH' : '')) || '',
    image,
    link: u.href.slice(0, 300),
    site: str(f.site || u.hostname.replace(/^www\.|^m\./, ''), 60),
    ai: !!ai,
  };
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Невірний запит' }, 400); }
  const code = String(body?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const mid = String(body?.member || '').slice(0, 40);
  try {
    const room = await kv.get(roomKey(code));
    if (!room || !room.members?.[mid]) return json({ error: 'Пару не знайдено' }, 403);
    if ((await countUse(code)) > DAILY_LIMIT) return json({ error: `На сьогодні Хамі вже переглянув ${DAILY_LIMIT} сторінок. Завтра — знову!` }, 429);
    return json({ item: await scan(body?.url) });
  } catch (e) {
    if (e.status) return json({ error: e.message }, e.status);
    console.error('wish', e);
    return json({ error: 'Хамі не зміг прочитати сторінку. Спробуй ще раз або додай вручну.' }, 502);
  }
}
