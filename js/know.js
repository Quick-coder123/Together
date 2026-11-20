// «Хто кого знає краще?» — each round: 5 AI questions; you answer about yourself and guess the partner's
// answers. The partner's answers are hidden (by the server) until you both finish.
import { S, on, act, openSheet, closeSheet, toast, partnerId, partner, refresh } from './store.js';
import { esc, icon, hami } from './ui.js';

const L = ['А', 'Б', 'В', 'Г'];
const game = () => S.room?.know?.cur || null;
const mineDone = (g) => !!g?.ans?.[S.me.id];
const theirsDone = (g) => !!g?.ans?.[partnerId()];

export function knowCard(r) {
  const pid = partnerId();
  if (!pid) return '';
  const g = game(), p = partner();
  const last = r.know?.log?.[0];
  let status, cta;
  if (!g || g.done) {
    status = last ? `Минулого разу: ти ${last.score[S.me.id] ?? 0}/5, ${esc(p.name)} ${last.score[pid] ?? 0}/5` : 'Відповідай про себе й вгадуй відповіді партнера';
    cta = g?.done && Date.now() - g.done < 86400000 ? 'Результати' : 'Нова гра';
  } else if (!mineDone(g)) { status = theirsDone(g) ? `${esc(p.name)} вже відповів(-ла) — твоя черга!` : '5 нових питань чекають'; cta = 'Грати'; }
  else { status = `Чекаємо на ${esc(p.name)}…`; cta = 'Відкрити'; }
  const hot = g && !g.done && !mineDone(g);
  return `<button class="card know-card ${hot ? 'hot' : ''}" data-a="know">
    <span class="know-ic">${hami('thinking', { size: 56 })}</span>
    <span class="grow left"><b>Хто кого знає краще?</b><br><span class="muted small">${status}</span></span>
    <span class="chip ${hot ? 'accent' : ''}">${cta}</span></button>`;
}

async function startGame(btn) {
  if (btn) { btn.disabled = true; btn.innerHTML = '🤔 Шептунчик придумує питання…'; }
  try {
    const res = await fetch('/api/know', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: S.code, member: S.me.id }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 409) { toast(d.error || 'Не вдалося 😔'); if (btn) { btn.disabled = false; btn.textContent = 'Спробувати ще раз'; } return; }
    await refresh(true);
    openKnow();
  } catch { toast('Немає інтернету 🙈'); if (btn) { btn.disabled = false; btn.textContent = 'Спробувати ще раз'; } }
}

function playSheet(g) {
  const p = partner();
  const n = g.qs.length;
  const self = Array(n).fill(null), guess = Array(n).fill(null);
  let step = 0; // 0..2n-1: even = about me, odd = guess partner
  const sh = openSheet('<div class="know-play"></div>');
  const box = sh.querySelector('.know-play');
  const draw = () => {
    const i = Math.floor(step / 2), aboutMe = step % 2 === 0, q = g.qs[i];
    const chosen = aboutMe ? self[i] : guess[i];
    box.innerHTML = `<div class="know-top"><span class="muted small">Питання ${i + 1} з ${n}</span>
        <div class="know-dots">${g.qs.map((_, k) => `<i class="${k < i ? 'done' : k === i ? 'cur' : ''}"></i>`).join('')}</div></div>
      <div class="know-who ${aboutMe ? 'me' : 'them'}">${aboutMe ? '🙋 Про себе' : `🔮 Вгадай: що відповів(-ла) ${esc(p.name)}?`}</div>
      <h3 class="know-q">${esc(q.q)}</h3>
      <div class="know-opts">${q.opts.map((o, k) => `<button class="know-o ${chosen === k ? 'on' : ''}" data-k="${k}"><b>${L[k]}</b><span>${esc(o)}</span></button>`).join('')}</div>
      <div class="row gap mt">${step ? `<button class="btn ghost" data-back>${icon('back', 18)} Назад</button>` : ''}<span class="grow"></span></div>`;
    box.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', async () => {
      const k = +b.dataset.k;
      if (aboutMe) self[i] = k; else guess[i] = k;
      b.classList.add('on');
      if (step < 2 * n - 1) { setTimeout(() => { step++; draw(); }, 180); return; }
      box.innerHTML = `<div class="center pad">${hami('thinking', { size: 90 })}<p class="muted">Зберігаю відповіді…</p></div>`;
      const ok = await act({ type: 'knowAnswer', id: g.id, self, guess });
      if (!ok) { step = 2 * n - 1; draw(); return; }
      openKnow();
    }));
    box.querySelector('[data-back]')?.addEventListener('click', () => { step--; draw(); });
  };
  draw();
}

function resultSheet(g) {
  const pid = partnerId(), p = partner(), me = S.me.id;
  const A = g.ans[me], B = g.ans[pid];
  const sm = g.score[me], sp = g.score[pid];
  const verdict = sm > sp ? 'Ти знаєш свою половинку краще! 🏆' : sm < sp ? `${esc(p.name)} знає тебе краще! 🏆` : 'Нічия — ви однаково добре знаєте одне одного 💞';
  openSheet(`<h3 class="h3 center">${verdict}</h3>
    <div class="know-score"><div><b>${sm}/5</b><span>ти вгадав(-ла)</span></div><div>${hami(sm + sp >= 7 ? 'joy' : sm + sp >= 4 ? 'great' : 'thinking', { size: 70 })}</div><div><b>${sp}/5</b><span>${esc(p.name)} вгадав(-ла)</span></div></div>
    <p class="center muted small">Хамі отримав +${(sm + sp) * 3} досвіду за правильні здогадки 🦎</p>
    ${g.qs.map((q, i) => `<div class="know-res">
      <b>${i + 1}. ${esc(q.q)}</b>
      <div class="know-line"><span>Ти: <b>${esc(q.opts[A.self[i]])}</b></span><span class="${B.guess[i] === A.self[i] ? 'ok' : 'no'}">${esc(p.name)} вгадав(-ла): ${B.guess[i] === A.self[i] ? '✅' : `❌ ${esc(q.opts[B.guess[i]])}`}</span></div>
      <div class="know-line"><span>${esc(p.name)}: <b>${esc(q.opts[B.self[i]])}</b></span><span class="${A.guess[i] === B.self[i] ? 'ok' : 'no'}">Ти вгадав(-ла): ${A.guess[i] === B.self[i] ? '✅' : `❌ ${esc(q.opts[A.guess[i]])}`}</span></div>
    </div>`).join('')}
    <button class="btn block mt" data-new>🎲 Нова гра</button>`, (sh) => {
    sh.querySelector('[data-new]').addEventListener('click', (e) => startGame(e.currentTarget));
  });
}

export function openKnow() {
  const g = game();
  if (!partnerId()) return toast('Гра для двох — спершу запроси партнера 💚');
  if (!g || (g.done && Date.now() - g.done > 86400000)) {
    return openSheet(`<div class="center">${hami('thinking', { size: 100 })}</div>
      <h3 class="h3 center">Хто кого знає краще?</h3>
      <p class="center muted">Шептунчик придумає 5 питань, яких у вас ще не було. Ти відповідаєш про себе й вгадуєш, що відповість ${esc(partner().name)}. Відповіді відкриються, коли зіграєте обоє.</p>
      <button class="btn block" data-new>🎲 Почати гру</button>`, (sh) => sh.querySelector('[data-new]').addEventListener('click', (e) => startGame(e.currentTarget)));
  }
  if (g.done) return resultSheet(g);
  if (!mineDone(g)) return playSheet(g);
  openSheet(`<div class="center">${hami('reminder', { size: 100 })}</div>
    <h3 class="h3 center">Твої відповіді збережено ✅</h3>
    <p class="center muted">Чекаємо, поки зіграє ${esc(partner().name)} — ми вже надіслали сповіщення. Результати з'являться тут.</p>
    <button class="btn ghost block" data-close>Добре</button>`, (sh) => sh.querySelector('[data-close]').addEventListener('click', closeSheet));
}
on('know', openKnow);
