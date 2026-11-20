// «Хто кого знає краще?» — starts a new round: Gemini writes 5 fresh questions (never repeating
// the pair's earlier ones), the round is saved into the pair's data and the partner gets a push.
// Answers then go through the ordinary 'knowAnswer' action (lib/core.js).
import { kv, roomKey, sendTo } from './_notify.js';
import { updateRoom } from './_db.js';
import { geminiJson, geminiOn } from './_gemini.js';
import { kyivParts } from './_remind.js';

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const str = (v, n) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const DAILY_LIMIT = 12;
const N = 5;

const TOPICS = ['їжа й смаки', 'подорожі', 'дитинство', 'мрії', 'звички й дрібниці', 'суперсили й фантазії', 'фільми й серіали', 'музика', 'гроші й покупки',
  'побут удома', 'романтика', '«що якби…» ситуації', 'страхи й незручні моменти', 'тварини', 'свята й подарунки', 'майбутнє разом', 'робота й навчання',
  'стиль і одяг', 'ідеальні вихідні', 'спорт і рух', 'ранок і сон', 'соцмережі й телефон', 'характер', 'сімейні традиції', 'погода й пори року',
  'ігри й розваги', 'смішні ситуації', 'кулінарні експерименти', 'природа', 'книжки', 'машини й транспорт', 'перше побачення й знайомство'];
const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

const RULES = `Ти ведучий гри для закоханої пари «Хто кого знає краще?». Кожен відповідає на питання ПРО СЕБЕ і вгадує відповідь партнера.
Склади рівно ${N} питань українською. Вимоги:
- цікаві, живі, з гумором або теплом; щоб після відповідей хотілося обговорити («О, справді?!»);
- питання про вподобання, звички, реакції, вибір у ситуації — на які кожен має власну відповідь;
- формулюй нейтрально щодо статі, звертаючись до гравця на «ти» (напр. «Що ти зробиш першим, якщо…», «Твоя ідеальна…»);
- рівно 4 варіанти відповіді, короткі (до 40 символів), різні й правдоподібні, без «усе з переліченого»;
- без питань «так/ні», без інтимного, без політики й болючих тем;
- кожне питання — з іншої теми; теми підкажу;
- НЕ повторюй і не перефразовуй питання, які вже були (список дам).
Поверни ЛИШЕ JSON: {"qs":[{"q":"…","opts":["…","…","…","…"]}]}`;

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Невірний запит' }, 400); }
  const code = String(body?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const mid = String(body?.member || '').slice(0, 40);
  try {
    const room = await kv.get(roomKey(code));
    if (!room || !room.members?.[mid]) return json({ error: 'Пару не знайдено' }, 403);
    const pid = Object.keys(room.members).find((x) => x !== mid);
    if (!pid) return json({ error: 'Гра для двох — спершу запроси партнера 💚' }, 400);
    const cur = room.know?.cur;
    if (cur && !cur.done && Date.now() - cur.at < 3 * 86400000) return json({ error: 'Спершу дограйте поточну гру 🙂' }, 409);
    if (!geminiOn()) return json({ error: 'Немає ключа ШІ (GEMINI_API_KEY).' }, 503);
    if ((await kv.incr(`know:${code}:${kyivParts(Date.now()).date}`, 172800)) > DAILY_LIMIT) return json({ error: 'На сьогодні ігор досить 😄 Завтра — нові питання!' }, 429);

    const used = room.know?.used || [];
    const topics = shuffle(TOPICS).slice(0, N);
    const r = await geminiJson({
      systemInstruction: { parts: [{ text: RULES }] },
      contents: [{ role: 'user', parts: [{ text: `Теми для цього раунду (по одній на питання): ${topics.join('; ')}.\nУже були (не повторюй): ${used.slice(-150).join(' | ') || 'нічого'}` }] }],
      generationConfig: { temperature: 1.0, responseMimeType: 'application/json' },
    }, { timeout: 20000, budget: 40000 });
    const seen = new Set(used.map((q) => q.toLowerCase()));
    const qs = (Array.isArray(r?.qs) ? r.qs : [])
      .map((x) => ({ q: str(x?.q, 160), opts: (Array.isArray(x?.opts) ? x.opts : []).map((o) => str(o, 50)).filter(Boolean).slice(0, 4) }))
      .filter((x) => x.q && x.opts.length === 4 && new Set(x.opts).size === 4 && !seen.has(x.q.toLowerCase()))
      .slice(0, N);
    if (qs.length < N) return json({ error: 'ШІ не впорався з питаннями, спробуй ще раз 🙏' }, 502);

    const game = { id: Math.random().toString(36).slice(2, 10), by: mid, at: Date.now(), qs, ans: {} };
    const saved = await updateRoom(code, (st) => {
      if (!st) return null;
      const c = st.know?.cur;
      if (c && !c.done && Date.now() - c.at < 3 * 86400000) return { out: null }; // someone started one in the meantime
      const know = { ...(st.know || {}), cur: game, used: [...(st.know?.used || []), ...qs.map((x) => x.q)].slice(-400) };
      return { next: { ...st, know, rev: (st.rev || 0) + 1 }, out: true };
    });
    if (!saved) return json({ error: 'Гру вже розпочато 🙂' }, 409);
    await sendTo(code, pid, { body: `🧠 ${room.members[mid].name} кличе тебе в гру «Хто кого знає краще?» — 5 нових питань!`, tag: 'know' }).catch(() => 0);
    return json({ ok: true, id: game.id });
  } catch (e) {
    console.error('know', e.message);
    return json({ error: e.message === 'busy' ? 'Спробуй ще раз' : 'Не вдалося придумати питання 😔 Спробуй ще раз' }, 500);
  }
}
