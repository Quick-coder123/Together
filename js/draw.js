// Drawing a note instead of writing it: a small paint sheet (colours, brush sizes, eraser, undo),
// exported as a JPEG and sent as a note. The server moves the picture to Supabase Storage.
import { openSheet, closeSheet, toast, partnerId, partner } from './store.js';
import { icon } from './ui.js';

const COLORS = ['#2B2522', '#E5484D', '#F28C28', '#F5C542', '#3DBE6C', '#2F9C84', '#3B82F6', '#8B5CF6', '#EC4899', '#FFFFFF'];
const PAPERS = [['#FFF8EE', 'Крем'], ['#FFFFFF', 'Біле'], ['#FDE2E4', 'Рожеве'], ['#DFF3E8', "М'ятне"], ['#1F1B2E', 'Ніч']];
const SIZES = [4, 9, 18];
const OUT = 900; // exported picture size, px

export function openDrawNote(whenOptions, sendFn) {
  let color = COLORS[1], size = SIZES[1], eraser = false, paper = PAPERS[0][0];
  const strokes = []; let cur = null;
  const sh = openSheet(`<h3 class="h3">Намалюй записку 🎨</h3>
    <p class="muted small">${partnerId() ? `${partner().name} побачить малюнок у «Записках»` : 'Партнер побачить малюнок, щойно приєднається'}.</p>
    <div class="dr-wrap"><canvas class="dr-canvas" width="${OUT}" height="${OUT}"></canvas></div>
    <div class="dr-tools">
      <div class="dr-colors">${COLORS.map((c, i) => `<button type="button" class="dr-c ${i === 1 ? 'on' : ''}" data-c="${c}" style="--c:${c}" aria-label="Колір"></button>`).join('')}</div>
      <div class="dr-row">
        ${SIZES.map((s, i) => `<button type="button" class="dr-s ${i === 1 ? 'on' : ''}" data-s="${s}" aria-label="Пензель ${i + 1}"><i style="width:${Math.max(4, s * 0.9)}px;height:${Math.max(4, s * 0.9)}px"></i></button>`).join('')}
        <button type="button" class="dr-b" data-er aria-label="Гумка">🧽</button>
        <button type="button" class="dr-b" data-undo aria-label="Скасувати">${icon('undo', 18)}</button>
        <button type="button" class="dr-b" data-clear aria-label="Очистити">${icon('trash', 18)}</button>
      </div>
      <div class="dr-row papers">${PAPERS.map(([c, n], i) => `<button type="button" class="dr-p ${i === 0 ? 'on' : ''}" data-p="${c}" style="--c:${c}">${n}</button>`).join('')}</div>
    </div>
    <label class="field"><span>Коли відкрити</span><select class="input" id="dr-when">${whenOptions.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
    <label class="field" id="dr-date-f" hidden><span>Дата відкриття</span><input class="input" type="date" id="dr-date"></label>
    <label class="field"><span>Підпис (необовʼязково)</span><input class="input" id="dr-cap" maxlength="200" placeholder="Наприклад: це ми на морі 🌊"></label>
    <button class="btn block" data-send>Надіслати 🎨</button>`);
  const cv = sh.querySelector('canvas'), ctx = cv.getContext('2d');
  const redraw = () => {
    ctx.fillStyle = paper; ctx.fillRect(0, 0, OUT, OUT);
    for (const s of strokes) paint(s);
    if (cur) paint(cur);
  };
  const paint = (s) => {
    ctx.strokeStyle = s.er ? paper : s.c; ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = s.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const p = s.p;
    if (p.length === 1) { ctx.beginPath(); ctx.arc(p[0][0], p[0][1], s.w / 2, 0, Math.PI * 2); ctx.fill(); return; }
    ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
    for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my); }
    ctx.lineTo(p[p.length - 1][0], p[p.length - 1][1]); ctx.stroke();
  };
  redraw();
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * OUT, ((e.clientY - r.top) / r.height) * OUT]; };
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault(); cv.setPointerCapture(e.pointerId);
    const k = OUT / cv.getBoundingClientRect().width;
    cur = { c: color, w: size * k * (eraser ? 2.2 : 1), er: eraser, p: [pos(e)] }; redraw();
  });
  cv.addEventListener('pointermove', (e) => { if (!cur) return; e.preventDefault(); for (const ev of e.getCoalescedEvents?.() || [e]) cur.p.push(pos(ev)); redraw(); });
  const up = () => { if (cur) { strokes.push(cur); cur = null; redraw(); } };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false }); // don't scroll the sheet while drawing

  const pickOne = (sel, el) => { sh.querySelectorAll(sel).forEach((b) => b.classList.toggle('on', b === el)); };
  sh.querySelectorAll('[data-c]').forEach((b) => b.addEventListener('click', () => { color = b.dataset.c; eraser = false; sh.querySelector('[data-er]').classList.remove('on'); pickOne('[data-c]', b); }));
  sh.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => { size = +b.dataset.s; pickOne('[data-s]', b); }));
  sh.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { paper = b.dataset.p; pickOne('[data-p]', b); redraw(); }));
  sh.querySelector('[data-er]').addEventListener('click', (e) => { eraser = !eraser; e.currentTarget.classList.toggle('on', eraser); });
  sh.querySelector('[data-undo]').addEventListener('click', () => { strokes.pop(); redraw(); });
  sh.querySelector('[data-clear]').addEventListener('click', () => { if (strokes.length && confirm('Очистити малюнок?')) { strokes.length = 0; redraw(); } });
  const when = sh.querySelector('#dr-when');
  when.addEventListener('change', () => { sh.querySelector('#dr-date-f').hidden = when.value !== 'date'; });
  sh.querySelector('[data-send]').addEventListener('click', async (e) => {
    if (!strokes.some((s) => !s.er)) return toast('Спершу щось намалюй 🙂');
    const b = e.currentTarget; b.disabled = true; b.textContent = 'Надсилаю…';
    // shrink until it fits comfortably (~250 KB)
    let q = 0.85, data = cv.toDataURL('image/jpeg', q);
    while (data.length > 330000 && q > 0.45) { q -= 0.1; data = cv.toDataURL('image/jpeg', q); }
    const ok = await sendFn({ image: data, text: sh.querySelector('#dr-cap').value.trim(), when: when.value, date: sh.querySelector('#dr-date').value });
    if (ok) closeSheet(); else { b.disabled = false; b.textContent = 'Надіслати 🎨'; }
  });
}
