// «Шептунчик» — the pair's AI helper (Google Gemini, free tier).
// Understands ordinary Ukrainian ("у суботу о 19 кіно, купити молоко 2 л, нагадай у пт про квіти"),
// answers questions about the pair's plans and suggests ideas. It never changes anything itself:
// it returns proposed actions, the app shows them as cards and adds only what the user confirms.
import { kv, roomKey } from './_notify.js';
import { itemsBetween } from '../js/derive.js';
import { addDays } from '../lib/core.js';
import { kyivParts } from './_remind.js';
import { geminiJson } from './_gemini.js';

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const DAILY_LIMIT = Number(process.env.WHISPER_DAILY_LIMIT || 80);

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
const str = (v, n) => String(v ?? '').trim().slice(0, n);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isTime = (v) => typeof v === 'string' && /^\d{2}:\d{2}$/.test(v);
const WD = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', "п'ятниця", 'субота'];

function context(room, mid, now) {
  const { date: today, hour, minute } = kyivParts(now);
  const pid = Object.keys(room.members).find((x) => x !== mid);
  const me = room.members[mid]?.name, partner = pid ? room.members[pid]?.name : null;
  const week = Array.from({ length: 14 }, (_, i) => { const d = addDays(today, i); return `${d} (${WD[new Date(d + 'T12:00:00Z').getUTCDay()]})`; });
  const plans = itemsBetween(room, today, addDays(today, 30)).filter((x) => x.kind !== 'trip' || x.first).slice(0, 25)
    .map((x) => `${x.date}${x.time ? ' ' + x.time : ''} — ${x.kind === 'blind' ? 'побачення наосліп' : x.title} [${x.kind}]`);
  const shop = (room.shopping || []).filter((x) => !x.done).slice(0, 30).map((x) => x.text + (x.qty ? ` (${x.qty})` : ''));
  const chores = (room.chores || []).filter((c) => !c.done).slice(0, 15).map((c) => c.text + (c.who ? ` — ${room.members[c.who]?.name || ''}` : ''));
  const spont = (room.places || []).filter((p) => p.mode !== 'plan' && !p.visited).slice(0, 15).map((p) => p.name);
  const wishP = pid ? (room.gifts || []).filter((g) => g.owner === pid && !g.received).slice(0, 10).map((g) => g.title + (g.price ? ` (${g.price})` : '')) : [];
  const watch = (room.watch || []).filter((w) => !w.watched).slice(0, 10).map((w) => w.title);
  const goals = (room.goals || []).filter((g) => !g.archived).slice(0, 6).map((g) => `${g.title}: ${g.saved || 0}/${g.target}`);
  const dates = (room.dates || []).slice(0, 10).map((d) => `${d.title} ${d.date}${d.yearly ? ' (щороку)' : ''}`);
  return `Сьогодні ${today} (${WD[new Date(today + 'T12:00:00Z').getUTCDay()]}), зараз ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} за Києвом.
Найближчі дні: ${week.join(', ')}.
Пишу я: ${me}. Моя пара: ${partner || 'ще не приєдналася'}.${room.startDate ? ` Разом з ${room.startDate}.` : ''}
Плани на місяць: ${plans.join('; ') || 'немає'}.
Список покупок (не куплено): ${shop.join(', ') || 'порожній'}.
Справи: ${chores.join('; ') || 'немає'}.
Місця, куди хочемо сходити: ${spont.join(', ') || 'немає'}.
Вішліст ${partner || 'пари'}: ${wishP.join(', ') || 'порожній'}.
Хочемо подивитися: ${watch.join(', ') || 'нічого'}.
Скарбнички: ${goals.join('; ') || 'немає'}.
Важливі дати: ${dates.join('; ') || 'немає'}.`;
}

const RULES = `Ти — Шептунчик, добрий і трохи грайливий хамелеон-помічник у застосунку для пари «Хамелеончики».
Пиши українською, коротко (1–3 речення), тепло, на «ти». Можеш вставити одне емодзі.
Твоє завдання: зрозуміти, що людина хоче зробити, і запропонувати дії для застосунку; або відповісти на питання про їхні плани; або підкинути ідею (побачення, вечеря, подарунок) з урахуванням їхніх даних.
Дати рахуй від сьогодні (формат YYYY-MM-DD), час — HH:MM (24 год). «Завтра», «в суботу», «через тиждень» перетворюй на конкретну дату. Якщо час не названо — не вигадуй (лиши порожнім), крім нагадувань: для них ставь 09:00, якщо не сказано інакше.
Нічого не вигадуй про людей і їхні плани понад дані. Не пропонуй дій, про які не просили, — хіба одну доречну (наприклад, нагадування перед побаченням), і поясни це у reply.
Типи дій (поле type):
- "event": подія/побачення в календарі {title, date, time, kind:"date"|"event", note}
- "reminder": нагадування-пуш {title, date, time, who:"me"|"partner"|"both"}
- "shop": покупки {items:[{text, qty, note}], cat:"food"|"other"} — qty обовʼязково (якщо не сказано: "1" або "1 шт", для ваги/обʼєму — розумна кількість)
- "place": місце, куди сходити {name, cat:"cafe"|"restaurant"|"bar"|"park"|"museum"|"cinema"|"nature"|"active"|"home"|"other", date, time, address, note} (з датою — заплановане)
- "blind": побачення наосліп-сюрприз для пари {date, time, meet (місце зустрічі: адреса або посилання), hint, dress, details}
- "chore": домашня справа {text, repeat:"none"|"daily"|"weekly"|"monthly", who:"me"|"partner"|"none"}
- "gift": бажання у мій вішліст {title, note, price}
- "watch": фільм/серіал подивитися {title, kind:"film"|"series"|"cartoon"|"show"|"other"}
- "dream": спільна мрія {title, note}
- "important": важлива дата {title, date, yearly}
- "note": записка партнеру {text}
Якщо прийшло голосове повідомлення — спершу точно розпізнай українську (або іншу) мову і запиши дослівно, що сказано, у поле "heard"; далі дій так само, як із текстом. Якщо в записі нічого не чути або це не прохання — поверни "heard":"" і попроси повторити.
Поверни ЛИШЕ JSON: {"heard":"…(лише для голосу)","reply":"…","actions":[…]} (actions може бути порожнім).`;

async function gemini(contents) {
  return geminiJson({ systemInstruction: { parts: [{ text: RULES }] }, contents, generationConfig: { temperature: 0.4, responseMimeType: 'application/json' } });
}

const CATS = ['cafe', 'restaurant', 'bar', 'park', 'museum', 'cinema', 'nature', 'active', 'home', 'other'];
const pick = (v, list, def) => (list.includes(v) ? v : def);
export function cleanActions(list) {
  const out = [];
  for (const a of Array.isArray(list) ? list.slice(0, 12) : []) {
    if (!a || typeof a !== 'object') continue;
    const d = isDate(a.date) ? a.date : '', t = isTime(a.time) ? a.time : '';
    switch (a.type) {
      case 'event': if (str(a.title, 100) && d) out.push({ type: 'event', title: str(a.title, 100), date: d, time: t, kind: pick(a.kind, ['date', 'event'], 'event'), note: str(a.note, 300) }); break;
      case 'reminder': if (str(a.title, 100) && d) out.push({ type: 'reminder', title: str(a.title, 100), date: d, time: t || '09:00', who: pick(a.who, ['me', 'partner', 'both'], 'both') }); break;
      case 'shop': {
        const items = (Array.isArray(a.items) ? a.items : []).map((i) => ({ text: str(i?.text, 80), qty: str(i?.qty, 20) || '1', note: str(i?.note, 120) })).filter((i) => i.text).slice(0, 40);
        if (items.length) out.push({ type: 'shop', cat: pick(a.cat, ['food', 'other'], 'food'), items });
        break;
      }
      case 'place': if (str(a.name, 80)) out.push({ type: 'place', name: str(a.name, 80), cat: pick(a.cat, CATS, 'other'), date: d, time: t, address: str(a.address, 200), note: str(a.note, 400) }); break;
      case 'blind': if (d) out.push({ type: 'blind', date: d, time: t, meet: str(a.meet, 300), hint: str(a.hint, 120), dress: str(a.dress, 80), details: str(a.details, 600) }); break;
      case 'chore': if (str(a.text, 100)) out.push({ type: 'chore', text: str(a.text, 100), repeat: pick(a.repeat, ['none', 'daily', 'weekly', 'monthly'], 'none'), who: pick(a.who, ['me', 'partner', 'none'], 'none') }); break;
      case 'gift': if (str(a.title, 100)) out.push({ type: 'gift', title: str(a.title, 100), note: str(a.note, 600), price: str(a.price, 30) }); break;
      case 'watch': if (str(a.title, 100)) out.push({ type: 'watch', title: str(a.title, 100), kind: pick(a.kind, ['film', 'series', 'cartoon', 'show', 'other'], 'film') }); break;
      case 'dream': if (str(a.title, 120)) out.push({ type: 'dream', title: str(a.title, 120), note: str(a.note, 300) }); break;
      case 'important': if (str(a.title, 80) && d) out.push({ type: 'important', title: str(a.title, 80), date: d, yearly: !!a.yearly }); break;
      case 'note': if (str(a.text, 500)) out.push({ type: 'note', text: str(a.text, 500) }); break;
      default:
    }
  }
  return out;
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Невірний запит' }, 400); }
  const code = String(body?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  const mid = String(body?.member || '').slice(0, 40);
  const text = str(body?.text, 800);
  // voice: 16 kHz mono WAV recorded in the app, base64 (≤ ~45 s)
  const audio = typeof body?.audio === 'string' && body.audio.length < 2_000_000 && /^[A-Za-z0-9+/=]+$/.test(body.audio.slice(0, 200)) ? body.audio : '';
  if (!text && !audio) return json({ error: 'Напиши або скажи, що зробити' }, 400);
  try {
    const room = await kv.get(roomKey(code));
    if (!room || !room.members?.[mid]) return json({ error: 'Пару не знайдено' }, 403);
    if (!GEMINI_KEY) return json({ error: 'Шептунчик ще не має ключа ШІ (GEMINI_API_KEY).' }, 503);
    if ((await kv.incr(`whisper:${code}:${kyivParts(Date.now()).date}`, 172800)) > DAILY_LIMIT) return json({ error: 'Шептунчик на сьогодні втомився 😴 Повертайся завтра!' }, 429);
    const history = (Array.isArray(body.history) ? body.history : []).slice(-6)
      .map((h) => ({ role: h?.role === 'model' ? 'model' : 'user', parts: [{ text: str(h?.text, 600) }] })).filter((h) => h.parts[0].text);
    const contents = [{ role: 'user', parts: [{ text: 'Дані пари:\n' + context(room, mid, Date.now()) }] }, { role: 'model', parts: [{ text: '{"reply":"Зрозумів, слухаю 🦎","actions":[]}' }] }, ...history, { role: 'user', parts: audio ? [{ inline_data: { mime_type: 'audio/wav', data: audio } }, { text: 'Це голосове повідомлення від мене. Розпізнай і виконай.' }] : [{ text }] }];
    const r = await gemini(contents);
    if (audio) console.log('whisper voice', { kb: Math.round(audio.length * 0.75 / 1024), heard: str(r.heard, 80) });
    return json({ heard: audio ? str(r.heard, 800) : undefined, reply: str(r.reply, 600) || 'Готово!', actions: cleanActions(r.actions) });
  } catch (e) {
    console.error('whisper', e.message);
    const busy = /high demand|overloaded|503|429|UNAVAILABLE/i.test(e.message);
    return json({ error: busy ? 'ШІ зараз перевантажений (так буває у Google). Спробуй за хвилинку 🙏' : 'Шептунчик задумався й загубив думку. Спробуй ще раз 🙏' }, 502);
  }
}
