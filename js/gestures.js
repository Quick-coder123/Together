// Native-feeling touches for the home-screen app:
//  • swipe from the left edge goes "back" on inner pages (trips, calendar, goals…), following the finger;
//  • page transitions slide in the direction you move (tabs left/right, deeper pages from the right).

const TABS = ['places', 'home', 'me', 'wish', 'more'];
let prev = null;
/** Called by render(): which way should the new screen slide in? */
export function transitionFor(route) {
  const p = prev; prev = { ...route };
  if (!p) return '';
  if (p.tab !== route.tab) return TABS.indexOf(route.tab) > TABS.indexOf(p.tab) ? 'go-r' : 'go-l';
  if ((p.sub || '') === (route.sub || '')) return '';
  const depth = (s) => (!s ? 0 : /[:]/.test(s) ? 2 : 1);
  return depth(route.sub) >= depth(p.sub) ? 'go-push' : 'go-pop';
}

/* ---- edge swipe back ---- */
let drag = null;
const EDGE = 24;
const backBtn = () => document.querySelector('main.screen .back');
document.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  if (e.touches.length !== 1 || t.clientX > EDGE || document.querySelector('.sheet-bg') || !backBtn()) return;
  drag = { x0: t.clientX, y0: t.clientY, t0: performance.now(), dx: 0, on: false, main: document.querySelector('main.screen') };
}, { passive: true });
document.addEventListener('touchmove', (e) => {
  if (!drag) return;
  const t = e.touches[0], dx = t.clientX - drag.x0, dy = t.clientY - drag.y0;
  if (!drag.on) {
    if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; } // it's a scroll
    if (dx < 8) return;
    drag.on = true;
    drag.main.classList.add('swiping');
  }
  e.preventDefault();
  drag.dx = Math.max(0, dx);
  drag.main.style.transform = `translateX(${drag.dx}px)`;
  drag.main.style.opacity = String(1 - Math.min(0.35, drag.dx / innerWidth));
}, { passive: false });
const end = () => {
  if (!drag) return;
  const d = drag; drag = null;
  if (!d.on) return;
  const v = d.dx / Math.max(1, performance.now() - d.t0);
  const go = d.dx > innerWidth * 0.33 || (v > 0.5 && d.dx > 40);
  d.main.classList.remove('swiping');
  d.main.classList.add('swipe-end');
  d.main.style.transform = go ? `translateX(${innerWidth}px)` : '';
  d.main.style.opacity = go ? '0' : '';
  setTimeout(() => {
    if (go) backBtn()?.click();
    else d.main.classList.remove('swipe-end');
  }, go ? 180 : 0);
};
document.addEventListener('touchend', end);
document.addEventListener('touchcancel', end);
