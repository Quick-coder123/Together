// Accessories for the 3D Хамі, built from simple shapes in the model's own space
// (x = forward, y = up, z = toward the camera). Everything rides on the head (head weight 1),
// so hats turn and nod with him; the scarf and bow tie sit half-way (neck).

const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const add = (a, b, k = 1) => a.map((x, i) => x + b[i] * k);

// frame: centre c + basis (ex, ey, ez), each already scaled
function frame(c, up, fwd = [1, 0, 0], s = [1, 1, 1]) {
  const ey = norm(up); let ex = norm(cross(ey, cross(fwd, ey))); if (!isFinite(ex[0])) ex = [1, 0, 0];
  const ez = cross(ex, ey);
  return { c, ex: ex.map((x) => x * s[0]), ey: ey.map((x) => x * s[1]), ez: ez.map((x) => x * s[2]) };
}

class Mesh {
  constructor() { this.P = []; this.N = []; this.C = []; this.W = []; this.I = []; }
  // push a unit-space shape through a frame
  put(verts, norms, idx, F, col, w = 1) {
    const base = this.P.length / 3;
    const l2 = (v) => v[0] * v[0] + v[1] * v[1] + v[2] * v[2];
    const kx = 1 / l2(F.ex), ky = 1 / l2(F.ey), kz = 1 / l2(F.ez);
    for (let i = 0; i < verts.length; i += 3) {
      const [x, y, z] = [verts[i], verts[i + 1], verts[i + 2]];
      this.P.push(...add(add(add(F.c, F.ex, x), F.ey, y), F.ez, z));
      const [a, b, c] = [norms[i], norms[i + 1], norms[i + 2]];
      this.N.push(...norm(add(add(F.ex.map((v) => v * a * kx), F.ey, b * ky), F.ez, c * kz)));
      this.C.push(...col); this.W.push(w);
    }
    for (const k of idx) this.I.push(base + k);
    return this;
  }
}

/* unit shapes */
function sphere(hemi = false, seg = 16, ring = 10) {
  const P = [], N = [], I = [];
  const r0 = hemi ? ring / 2 : 0;
  for (let r = r0; r <= ring; r++) {
    const t = (r / ring) * Math.PI, y = Math.cos(t), s = Math.sin(t);
    for (let k = 0; k <= seg; k++) { const a = (k / seg) * Math.PI * 2; P.push(Math.cos(a) * s, y, Math.sin(a) * s); N.push(Math.cos(a) * s, y, Math.sin(a) * s); }
  }
  // flip so a hemisphere is the TOP half (y ≥ 0)
  if (hemi) for (let i = 1; i < P.length; i += 3) { P[i] = -P[i]; N[i] = -N[i]; }
  const rows = ring - r0;
  for (let r = 0; r < rows; r++) for (let k = 0; k < seg; k++) { const a = r * (seg + 1) + k, b = a + seg + 1; I.push(a, b, a + 1, b, b + 1, a + 1); }
  return [P, N, I];
}
function cylinder(r2 = 1, seg = 18, caps = true) { // y 0..1, radius 1 at bottom, r2 at top
  const P = [], N = [], I = [];
  const slope = 1 - r2;
  for (let h = 0; h <= 1; h++) for (let k = 0; k <= seg; k++) {
    const a = (k / seg) * Math.PI * 2, r = h ? r2 : 1;
    P.push(Math.cos(a) * r, h, Math.sin(a) * r); const n = norm([Math.cos(a), slope, Math.sin(a)]); N.push(...n);
  }
  for (let k = 0; k < seg; k++) I.push(k, k + seg + 1, k + 1, k + 1, k + seg + 1, k + seg + 2);
  if (caps) for (const [y, r, ny] of [[0, 1, -1], [1, r2, 1]]) {
    if (!r) continue;
    const c = P.length / 3; P.push(0, y, 0); N.push(0, ny, 0);
    for (let k = 0; k <= seg; k++) { const a = (k / seg) * Math.PI * 2; P.push(Math.cos(a) * r, y, Math.sin(a) * r); N.push(0, ny, 0); }
    for (let k = 0; k < seg; k++) I.push(c, c + 1 + k, c + 2 + k);
  }
  return [P, N, I];
}
function torus(minor = 0.2, seg = 28, tube = 10, arc = Math.PI * 2) { // ring in the x-z plane, radius 1
  const P = [], N = [], I = [];
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * arc, ca = Math.cos(a), sa = Math.sin(a);
    for (let j = 0; j <= tube; j++) {
      const b = (j / tube) * Math.PI * 2, cb = Math.cos(b), sb = Math.sin(b);
      P.push((1 + minor * cb) * ca, minor * sb, (1 + minor * cb) * sa); N.push(cb * ca, sb, cb * sa);
    }
  }
  for (let i = 0; i < seg; i++) for (let j = 0; j < tube; j++) { const a = i * (tube + 1) + j, b = a + tube + 1; I.push(a, b, a + 1, b, b + 1, a + 1); }
  return [P, N, I];
}
const SPH = sphere(), HEMI = sphere(true), CYL = cylinder(), CONE = cylinder(0.001), TOR = (m) => torus(m);

// place a cylinder from point a to point b with radius r (r2 at b)
function rod(m, a, b, r, col, w = 1, r2 = r) {
  const d = add(b, a, -1), L = Math.hypot(...d);
  const F = frame(a, d, Math.abs(d[1]) > 0.9 * L ? [1, 0, 0] : [0, 1, 0], [r, L, r]);
  return m.put(...(r2 === r ? CYL : cylinder(r2 / r)), F, col, w);
}
const ball = (m, c, r, col, w = 1, s = [1, 1, 1], up = [0, 1, 0], fwd = [1, 0, 0]) => m.put(...SPH, frame(c, up, fwd, [r * s[0], r * s[1], r * s[2]]), col, w);

/* anchor points measured on the mesh (see scripts/build-hami3d.py) */
const TOP = [0.3, 1.215, 0.02]; // middle of the casque
const FACE = norm([0.8, -0.12, 0.58]);
const EYES = [
  { c: [0.365, 0.855, 0.27], r: 0.16, ax: [0.1, -0.03, 0.99] },
  { c: [0.53, 0.975, -0.125], r: 0.17, ax: [0.99, -0.04, 0.16] },
];
const C = {
  pink: [0.97, 0.45, 0.62], red: [0.88, 0.2, 0.22], gold: [1, 0.78, 0.22], black: [0.12, 0.12, 0.14], white: [0.97, 0.97, 0.95],
  blue: [0.25, 0.48, 0.92], yellow: [1, 0.86, 0.3], teal: [0.15, 0.62, 0.62], purple: [0.55, 0.35, 0.85], dark: [0.08, 0.08, 0.1], lens: [0.13, 0.13, 0.2],
};

function glasses(m, frameCol, lens) {
  const rims = EYES.map((E) => add(E.c, E.ax, E.r * 1.02));
  EYES.forEach((E, i) => {
    const F = frame(rims[i], E.ax, [0, 1, 0], [E.r * 1.0, E.r, E.r * 1.0]);
    m.put(...TOR(0.11), F, frameCol);
    if (lens) m.put(...cylinder(1, 24), frame(add(rims[i], E.ax, -0.012), E.ax, [0, 1, 0], [E.r * 0.98, 0.02, E.r * 0.98]), lens);
  });
  // bridge over the snout
  const a = add(rims[0], [0.09, 0.05, -0.06]), b = add(rims[1], [-0.02, 0.06, 0.1]);
  rod(m, a, add(a, b, 0).map((x, i) => (a[i] + b[i]) / 2 + (i === 1 ? 0.04 : 0)), 0.018, frameCol);
  rod(m, add(a, b, 0).map((x, i) => (a[i] + b[i]) / 2 + (i === 1 ? 0.04 : 0)), b, 0.018, frameCol);
}

export function buildAcc(id) {
  const m = new Mesh();
  switch (id) {
    case 'bow': {
      const c = [0.3, 1.25, 0.2], side = norm([0.35, 0.15, -1]);
      ball(m, c, 0.045, C.pink);
      for (const s of [-1, 1]) ball(m, add(c, side, 0.085 * s), 0.08, C.pink, 1, [1.15, 0.75, 0.42], [0, 1, 0], side);
      for (const s of [-1, 1]) ball(m, add(add(c, side, 0.04 * s), [0, -0.07, 0.03]), 0.04, C.pink, 1, [0.6, 1.3, 0.35]);
      break;
    }
    case 'flower': {
      const c = [0.22, 1.2, 0.22], up = norm([-0.2, 0.75, 0.6]);
      const F = frame(c, up, [1, 0, 0]);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; const d = add(F.ex.map((x) => x * Math.cos(a)), F.ez, Math.sin(a)); ball(m, add(c, d, 0.065), 0.055, k % 2 ? C.pink : [1, 0.6, 0.75], 1, [1.2, 0.45, 0.8], up, d); }
      ball(m, add(c, up, 0.02), 0.045, C.yellow);
      break;
    }
    case 'glasses': glasses(m, C.black, null); break;
    case 'sunglasses': glasses(m, C.dark, C.lens); break;
    case 'scarf': {
      const c = [0.04, 0.64, 0.0], up = norm([1, 0.4, 0]);
      m.put(...TOR(0.3), frame(c, up, [0, 1, 0], [0.25, 0.25, 0.33]), C.red, 0.4);
      const tip = [0.2, 0.55, 0.3];
      rod(m, tip, add(tip, [0.02, -0.22, 0.03]), 0.05, C.red, 0.4, 0.055);
      for (let k = 0; k < 3; k++) rod(m, add(tip, [0.02 + k * 0.004, -0.225 - k * 0.0, 0.03]), add(tip, [0.02 + (k - 1) * 0.02, -0.27, 0.03 + (k - 1) * 0.02]), 0.012, C.yellow, 0.4);
      break;
    }
    case 'cap': {
      const c = TOP, up = [0.05, 1, -0.02];
      m.put(...HEMI, frame(c, up, FACE, [0.2, 0.15, 0.21]), C.red);
      ball(m, add(c, up, 0.15), 0.025, C.white);
      const fwd = norm([FACE[0], 0, FACE[2]]);
      m.put(...cylinder(1, 24), frame(add(add(c, fwd, 0.17), [0, 0.0, 0]), [0.08, 1, 0], fwd, [0.17, 0.018, 0.13]), C.red);
      break;
    }
    case 'beanie': {
      const c = add(TOP, [0, -0.02, 0]), up = [0, 1, 0];
      m.put(...HEMI, frame(c, up, FACE, [0.22, 0.2, 0.23]), C.blue);
      m.put(...TOR(0.3), frame(add(c, up, 0.015), up, FACE, [0.215, 0.215, 0.225]), C.white);
      ball(m, add(c, up, 0.22), 0.06, C.white);
      break;
    }
    case 'tophat': {
      const c = add(TOP, [0, 0.0, 0]), up = norm([0.05, 1, -0.05]);
      m.put(...cylinder(1, 24), frame(c, up, FACE, [0.24, 0.02, 0.24]), C.black);
      m.put(...cylinder(1.05, 24), frame(add(c, up, 0.015), up, FACE, [0.14, 0.27, 0.14]), C.black);
      m.put(...cylinder(1, 24, false), frame(add(c, up, 0.03), up, FACE, [0.146, 0.05, 0.146]), C.red);
      break;
    }
    case 'crown': {
      const c = add(TOP, [0, 0.0, 0]), up = norm([0.03, 1, 0]);
      m.put(...cylinder(1.1, 24), frame(c, up, FACE, [0.18, 0.08, 0.18]), C.gold);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2 + 0.3, d = [Math.cos(a) * 0.185, 0.075, Math.sin(a) * 0.185];
        m.put(...CONE, frame(add(c, d), up, FACE, [0.055, 0.12, 0.055]), C.gold);
        ball(m, add(c, add(d, up, 0.13)), 0.022, C.gold);
        ball(m, add(c, [Math.cos(a + 0.63) * 0.195, 0.04, Math.sin(a + 0.63) * 0.195]), 0.028, k % 2 ? C.red : C.blue);
      }
      break;
    }
    case 'headphones': {
      const c = [0.06, 0.96, 0.03], up = [0, 1, 0];
      // half-ring over the head in the y-z plane (unit x → world z, unit z → world y)
      m.put(...torus(0.1, 28, 8, Math.PI), { c, ex: [0, 0, 0.33], ey: [0.33, 0, 0], ez: [0, 0.36, 0] }, C.purple);
      for (const s of [-1, 1]) {
        const p = add(c, [0, -0.02, 0.33 * s]);
        m.put(...cylinder(1, 20), frame(add(p, [0, 0, -0.04 * s]), [0, 0, s], [0, 1, 0], [0.1, 0.08, 0.1]), C.purple);
        m.put(...cylinder(1, 20), frame(add(p, [0, 0, 0.035 * s]), [0, 0, s], [0, 1, 0], [0.075, 0.02, 0.075]), C.dark);
      }
      break;
    }
    case 'bowtie': {
      const c = [0.47, 0.64, 0.31], side = norm([0.82, 0, -0.57]), fwd = norm([0.55, -0.25, 0.8]);
      ball(m, c, 0.045, C.red, 0.5);
      for (const s of [-1, 1]) m.put(...CONE, frame(add(c, side, 0.13 * s), side.map((x) => -x * s), fwd, [0.085, 0.13, 0.04]), C.red, 0.5);
      break;
    }
    default: return null;
  }
  return m;
}
