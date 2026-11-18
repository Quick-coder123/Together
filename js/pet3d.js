// Real 3D Хамі: a WebGL renderer for the chameleon mesh (img/hami3d.bin, built by scripts/build-hami3d.py).
// No skeleton in the mesh, so the body is "rigged" procedurally: every vertex gets weights for the four legs,
// the tail and the head, and the vertex shader bends them (walk cycle, wave, tail sway/curl, head turns).
// Eyes and pupils are painted in the fragment shader, so each eye can roll on its own — like a real chameleon.
// If WebGL is unavailable, nothing happens and the sprite version stays.
import { buildAcc } from './pet3d-acc.js';

const FEET = [[0.335, 0.301], [0.385, -0.298], [-0.316, 0.333], [-0.39, -0.328]]; // front +z (near camera), front -z, back +z, back -z
const HEAD = [0.12, 0.62, 0.0];
const TAIL = [-0.5, 0.36, 0.0];
const EYES = [
  { c: [0.365, 0.855, 0.27], r: 0.16, ax: [0.1, -0.03, 0.99] },
  { c: [0.53, 0.975, -0.125], r: 0.17, ax: [0.99, -0.04, 0.16] },
];
const MOUTH = [0.64, 0.73, 0.15], TDIR = [0.8, -0.12, 0.58];
const SPOTS = [ // dorsal patches, flank spots and tail dots: [x, y, z, radius]
  [-0.491, 0.816, 0.016, 0.075], [-0.273, 0.865, -0.025, 0.08], [-0.098, 0.879, -0.047, 0.07],
  [-0.446, 0.609, 0.178, 0.07], [-0.27, 0.53, 0.235, 0.065], [0.002, 0.569, 0.205, 0.055],
  [-0.425, 0.57, -0.199, 0.07], [-0.235, 0.574, -0.247, 0.065], [-0.002, 0.62, -0.271, 0.055],
  [-0.737, 0.626, 0.062, 0.05], [-0.923, 0.475, 0.092, 0.045], [-1.146, 0.388, 0.113, 0.04], [-1.343, 0.425, 0.105, 0.035],
];
const CX = -0.42; // horizontal centre of the model
export const COLORS = {
  green: [0.36, 0.78, 0.33], emerald: [0.16, 0.62, 0.4], mint: [0.45, 0.86, 0.66], turquoise: [0.18, 0.74, 0.76], blue: [0.33, 0.6, 0.92],
  night: [0.25, 0.3, 0.6], violet: [0.6, 0.42, 0.88], pink: [0.95, 0.5, 0.74], coral: [1, 0.55, 0.42], golden: [0.95, 0.74, 0.25],
  yellow: [0.9, 0.8, 0.28], grey: [0.6, 0.63, 0.62],
};
const STAGE = { baby: [0.66, 0.3], kid: [0.76, 0.2], teen: [0.88, 0.08], adult: [1, 0] }; // [size, extra head size]

/* ---------------- tiny math ---------------- */
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;
const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function mul(a, b) { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; }
const ident = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const trans = (x, y, z) => { const m = ident(); m[12] = x; m[13] = y; m[14] = z; return m; };
const scal = (x, y, z) => { const m = ident(); m[0] = x; m[5] = y; m[10] = z; return m; };
const rotY = (a) => { const c = Math.cos(a), s = Math.sin(a), m = ident(); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; };
function persp(fov, asp, n, f) { const t = 1 / Math.tan(fov / 2), m = new Float32Array(16); m[0] = t / asp; m[5] = t; m[10] = (f + n) / (n - f); m[11] = -1; m[14] = (2 * f * n) / (n - f); return m; }
function lookAt(e, c, up) {
  const z = norm([e[0] - c[0], e[1] - c[1], e[2] - c[2]]), x = norm(cross(up, z)), y = cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1]);
}

/* ---------------- shaders ---------------- */
const VS = `
attribute vec3 aPos; attribute vec3 aNorm; attribute vec4 aLeg; attribute vec4 aMisc; attribute vec3 aCol; // misc: tail, head, pattern, kind (0 body,1 tongue,2 shadow,3 accessory)
uniform mat4 uProj, uView, uModel, uShadowM; uniform vec3 uNS;
uniform vec4 uLift, uStride; uniform vec2 uTail; uniform vec3 uHead; uniform float uBreath, uHeadBig, uTongue, uShadow;
uniform vec3 uMouth, uTdir, uTside, uTup;
varying vec3 vPos; varying vec3 vN; varying vec3 vW; varying float vPat; varying float vKind; varying vec3 vCol;
const vec3 H = vec3(${HEAD.join(',')}); const vec3 T = vec3(${TAIL.join(',')});
mat3 rx(float a){ float c=cos(a), s=sin(a); return mat3(1.,0.,0., 0.,c,s, 0.,-s,c); }
mat3 ry(float a){ float c=cos(a), s=sin(a); return mat3(c,0.,-s, 0.,1.,0., s,0.,c); }
mat3 rz(float a){ float c=cos(a), s=sin(a); return mat3(c,s,0., -s,c,0., 0.,0.,1.); }
void main(){
  vKind = aMisc.w; vPat = aMisc.z; vCol = aCol;
  if (abs(aMisc.w - 2.) < 0.5) { // ground shadow
    vec4 w = uShadowM * vec4(aPos.x * 1.25 * uShadow, 0.004, aPos.z * 0.62 * uShadow, 1.);
    vPos = aPos; vN = vec3(0.,1.,0.); vW = w.xyz; gl_Position = uProj * uView * w; return;
  }
  vec3 p = aPos; vec3 n = aNorm;
  if (abs(aMisc.w - 1.) < 0.5) { p = uMouth + uTdir * (aPos.x * uTongue) + uTside * aPos.y + uTup * aPos.z; n = normalize(uTside * aNorm.y + uTup * aNorm.z + uTdir * aNorm.x); }
  vPos = aPos;
  // legs
  p.y += dot(aLeg, uLift); p.x += dot(aLeg, uStride);
  // tail: sway around Y, curl around Z, growing toward the tip
  float t = aMisc.x;
  if (t > 0.) { mat3 R = ry(uTail.x * t) * rz(uTail.y * t * t); p = T + R * (p - T); n = R * n; }
  // breathing: the belly swells a little
  float body = (1. - aMisc.y) * (1. - t) * (1. - min(1., dot(aLeg, vec4(1.))));
  p.yz = mix(p.yz, vec2(0.5, 0.) + (p.yz - vec2(0.5, 0.)) * (1. + uBreath * 0.045), body);
  // head (bigger for babies) + turn / nod / tilt
  float h = aMisc.y;
  if (h > 0.) { mat3 R = ry(uHead.x * h) * rz(uHead.y * h) * rx(uHead.z * h); p = H + R * ((p - H) * (1. + uHeadBig * h)); n = R * n; }
  vec4 w = uModel * vec4(p, 1.);
  vW = w.xyz; vN = normalize(mat3(uModel) * (n * uNS));
  gl_Position = uProj * uView * w;
}`;
const FS = `
precision mediump float;
varying vec3 vPos; varying vec3 vN; varying vec3 vW; varying float vPat; varying float vKind; varying vec3 vCol;
uniform vec3 uBody, uCam; uniform float uTime, uBlink, uRainbow, uPupil, uShadowA, uHappy;
uniform vec3 uE0c, uE0a, uE0l, uE1c, uE1a, uE1l; uniform vec2 uER;
uniform vec4 uSpots[${SPOTS.length}]; uniform vec3 uMouthC, uFwd, uSide, uUp; uniform float uSmile, uBrow;
vec3 hue(float h){ return clamp(abs(mod(h*6.+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }
vec4 eye(vec3 c, vec3 ax, vec3 lk, float r){
  vec3 d = vPos - c; float l = length(d); vec3 n = d / l;
  float cap = dot(n, ax);
  if (l > r * 1.2 || cap < 0.55) return vec4(0.);
  // eyelid: closes from the top (and a little from below when happy)
  float lid = n.y * 0.9 + (1. - cap) * 0.2;
  if (lid > 1. - 2.1 * uBlink || -n.y > 1. - 0.9 * uHappy) return vec4(0.);
  float k = dot(n, lk);
  vec3 col = vec3(0.98, 0.98, 0.95);
  float ring = smoothstep(0.55, 0.62, cap); col = mix(vec3(0.78, 0.82, 0.74), col, ring);
  float pr = uPupil;
  float ir = smoothstep(pr - 0.125, pr - 0.11, k);
  vec3 iris = mix(vec3(0.85, 0.55, 0.2), vec3(0.5, 0.27, 0.09), smoothstep(pr - 0.1, pr - 0.01, k)); // warm brown, darker inside
  col = mix(col, vec3(0.32, 0.18, 0.07), ir);                                       // dark rim
  col = mix(col, iris, smoothstep(pr - 0.115, pr - 0.1, k));
  col = mix(col, vec3(0.04, 0.03, 0.03), smoothstep(pr - 0.012, pr, k));             // pupil
  vec3 hl = normalize(lk + vec3(0.25, 0.35, 0.25));
  col = mix(col, vec3(1.), smoothstep(0.986, 0.992, dot(n, hl)));                   // big glint
  vec3 hl2 = normalize(lk + vec3(-0.12, -0.16, -0.1));
  col = mix(col, vec3(1.), smoothstep(0.9955, 0.998, dot(n, hl2)) * 0.85);           // small glint
  return vec4(col, 1.);
}
void main(){
  if (abs(vKind - 2.) < 0.5) { float r = length(vPos.xz); float a = (1. - smoothstep(0.2, 1., r)) * 0.3 * uShadowA; gl_FragColor = vec4(0., 0., 0., a); return; }
  vec3 N = normalize(vN); vec3 V = normalize(uCam - vW);
  if (dot(N, V) < 0.) N = -N;
  vec3 base = uBody;
  if (uRainbow > 0.5) base = mix(base, hue(fract(uTime * 0.05 + vPos.x * 0.35 + vPos.y * 0.2)) * 0.85 + 0.12, 0.85);
  vec3 belly = mix(base, vec3(1., 0.96, 0.72), 0.55);
  vec3 dark = base * vec3(0.62, 0.7, 0.66);
  vec3 col = base;
  float stripe = smoothstep(0.55, 0.9, sin(vPos.x * 13. + vPos.y * 7.)) * step(vPat, 0.2) * step(-0.2, vPat) * 0.12;
  col *= 1. - stripe;
  col = mix(col, belly, clamp(vPat, 0., 1.));
  col = mix(col, dark, clamp(-vPat, 0., 1.));
  // spots
  for (int i = 0; i < ${SPOTS.length}; i++) { float d = length(vPos - uSpots[i].xyz) / uSpots[i].w; col = mix(col, base * vec3(0.35, 0.72, 0.78), (1. - smoothstep(0.75, 1., d)) * 0.85); }
  // smile: a curved line across the snout (frowns when sad)
  vec3 rm = vPos - uMouthC; float sa = dot(rm, uSide), sb = dot(rm, uUp), sf = dot(rm, uFwd);
  float curve = uSmile * (sa * sa * 9. - 0.012) - 0.02;
  float line = (1. - smoothstep(0.006, 0.011, abs(sb - curve))) * (1. - smoothstep(0.065, 0.085, abs(sa))) * step(-0.08, sf);
  col = mix(col, base * vec3(0.28, 0.4, 0.3), line);
  // brows: thick dark-green arcs over the eyes (tilt with the mood)
  for (int i = 0; i < 2; i++) {
    vec3 c = i == 0 ? uE0c : uE1c; vec3 ax = i == 0 ? uE0a : uE1a; float r = i == 0 ? uER.x : uER.y;
    vec3 d = vPos - c; float l = length(d); vec3 n = d / l;
    vec3 rt = normalize(cross(vec3(0., 1., 0.), ax)); float u = dot(n, rt) * (i == 0 ? -1. : 1.);
    float yy = n.y - uBrow * u * 0.35;
    float b = step(r * 1.02, l) * (1. - step(r * 1.45, l)) * step(0.15, dot(n, ax)) * smoothstep(0.66, 0.7, yy) * (1. - smoothstep(0.77, 0.81, yy)) * (1. - smoothstep(0.45, 0.6, abs(u)));
    col = mix(col, base * vec3(0.42, 0.55, 0.45), b * 0.85);
  }
  if (vKind > 2.5) col = vCol;
  else if (vKind > 0.5) col = vec3(0.98, 0.45, 0.58);
  else {
    vec4 e = eye(uE0c, uE0a, uE0l, uER.x); if (e.a < 0.5) e = eye(uE1c, uE1a, uE1l, uER.y);
    if (e.a > 0.5) col = e.rgb;
  }
  vec3 L = normalize(vec3(-0.35, 0.85, 0.6));
  float d = dot(N, L) * 0.5 + 0.5;
  float toon = mix(0.58, 1.06, smoothstep(0.38, 0.62, d)) + smoothstep(0.85, 0.95, d) * 0.06;
  float rim = pow(1. - max(dot(N, V), 0.), 3.) * 0.35;
  float spec = pow(max(dot(N, normalize(L + V)), 0.), 40.) * 0.25;
  vec3 o = col * toon + vec3(rim * 0.9, rim, rim * 0.8) + spec;
  gl_FragColor = vec4(o, 1.);
}`;

/* ---------------- geometry ---------------- */
async function loadMesh() {
  const buf = await (await fetch('/img/hami3d.bin')).arrayBuffer();
  const [nv, nf] = new Uint32Array(buf, 0, 2);
  const hdr = new Float32Array(buf, 8, 6);
  const q = new Int16Array(buf, 32, nv * 3);
  let off = 32 + nv * 6; off += (4 - (off % 4)) % 4;
  const idx = new Uint16Array(buf, off, nf * 3);
  const P = new Float32Array(nv * 3);
  for (let i = 0; i < nv * 3; i++) P[i] = hdr[i % 3] + (q[i] + 32768) * hdr[3 + (i % 3)];
  // smooth normals
  const N = new Float32Array(nv * 3);
  for (let f = 0; f < nf; f++) {
    const a = idx[f * 3] * 3, b = idx[f * 3 + 1] * 3, c = idx[f * 3 + 2] * 3;
    const u = [P[b] - P[a], P[b + 1] - P[a + 1], P[b + 2] - P[a + 2]], v = [P[c] - P[a], P[c + 1] - P[a + 1], P[c + 2] - P[a + 2]];
    const n = cross(u, v);
    for (const k of [a, b, c]) { N[k] += n[0]; N[k + 1] += n[1]; N[k + 2] += n[2]; }
  }
  // per-vertex rig weights + colour pattern
  const LEG = new Float32Array(nv * 4), MISC = new Float32Array(nv * 4);
  for (let i = 0; i < nv; i++) {
    const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    const l = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) || 1;
    N[i * 3] /= l; N[i * 3 + 1] /= l; N[i * 3 + 2] /= l;
    const ny = N[i * 3 + 1];
    const up = 1 - sstep(0.3, 0.55, y);
    FEET.forEach(([fx, fz], k) => { LEG[i * 4 + k] = (1 - sstep(0.13, 0.25, Math.hypot(x - fx, z - fz))) * up; });
    const tail = sstep(-0.5, -1.55, x);
    const head = sstep(0.0, 0.2, x) * sstep(0.5, 0.66, y);
    let pat = 0;
    if (ny < -0.25) pat = Math.min(1, (-ny - 0.25) * 2.2);                         // belly & chin
    if (head > 0.5 && y < 0.7) pat = Math.max(pat, 0.6);                           // lips / jaw
    if (ny > 0.55 && Math.abs(z) < 0.11 && y > 0.6) pat = -Math.min(1, (ny - 0.55) * 3);  // crest along the spine & head
    MISC[i * 4] = tail; MISC[i * 4 + 1] = head; MISC[i * 4 + 2] = pat; MISC[i * 4 + 3] = 0;
  }
  return { P, N, LEG, MISC, idx, nv };
}
function tongueMesh() {
  const S = 14, R = 8, P = [], N = [], I = [];
  for (let s = 0; s <= S; s++) {
    const u = s / S;
    const rad = u < 0.78 ? 0.034 : 0.034 + Math.sin(((u - 0.78) / 0.22) * Math.PI) * 0.045;
    for (let r = 0; r < R; r++) { const a = (r / R) * Math.PI * 2; P.push(u, Math.cos(a) * rad, Math.sin(a) * rad); N.push(0, Math.cos(a), Math.sin(a)); }
  }
  for (let s = 0; s < S; s++) for (let r = 0; r < R; r++) { const a = s * R + r, b = s * R + ((r + 1) % R); I.push(a, b, a + R, b, b + R, a + R); }
  return { P, N, I, n: P.length / 3 };
}
function shadowMesh() {
  const P = [0, 0, 0], I = [];
  for (let i = 0; i <= 32; i++) { const a = (i / 32) * Math.PI * 2; P.push(Math.cos(a), 0, Math.sin(a)); if (i) I.push(0, i, i + 1); }
  I.length -= 3; I.push(0, 32, 1);
  return { P, I, n: P.length / 3 };
}

/* ---------------- state ---------------- */
let gl, prog, canvas, U = {}, D = null, raf = 0, failed = false, loading = null, io = null;
const S = {
  stage: 'adult', color: 'green', base: '', mood: '', acc: 'none',
  face: 1, fv: 1, walking: false, walkPhase: 0,
  act: null, actT0: 0, actMs: 0,
  look: null, lookUntil: 0, eyes: [[0, 0], [0, 0]], eyeT: [[0, 0], [0, 0]], nextSacc: [0, 0],
  headT: [0, 0, 0], head: [0, 0, 0], nextHead: 0, blinkAt: 0, lastT: 0,
};

function compile(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
function buffers(P, N, LEG, MISC, I, COL = null) {
  const mk = (data, target = gl.ARRAY_BUFFER) => { const b = gl.createBuffer(); gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW); return b; };
  return { p: mk(P), n: mk(N), leg: mk(LEG), misc: mk(MISC), col: COL ? mk(COL) : null, i: mk(I, gl.ELEMENT_ARRAY_BUFFER), count: I.length };
}
const ACC = {}; // id → buffers (built on first use)
function accBuffers(id) {
  if (!id || id === 'none') return null;
  if (id in ACC) return ACC[id];
  const m = buildAcc(id);
  if (!m) return (ACC[id] = null);
  const n = m.P.length / 3, misc = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { misc[i * 4 + 1] = m.W[i]; misc[i * 4 + 3] = 3; }
  return (ACC[id] = buffers(new Float32Array(m.P), new Float32Array(m.N), new Float32Array(n * 4), misc, new Uint16Array(m.I), new Float32Array(m.C)));
}
async function init() {
  canvas = document.createElement('canvas');
  canvas.className = 'pet3d';
  gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false });
  if (!gl) throw new Error('no webgl');
  prog = gl.createProgram();
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(prog, i); U[u.name] = gl.getUniformLocation(prog, u.name); }
  const m = await loadMesh();
  const t = tongueMesh(), sh = shadowMesh();
  const zeros = (k, v = 0) => new Float32Array(k).fill(v);
  const tm = zeros(t.n * 4); for (let i = 0; i < t.n; i++) { tm[i * 4 + 1] = 1; tm[i * 4 + 3] = 1; }
  const sm = zeros(sh.n * 4); for (let i = 0; i < sh.n; i++) sm[i * 4 + 3] = 2;
  D = {
    body: buffers(m.P, m.N, m.LEG, m.MISC, m.idx),
    tongue: buffers(new Float32Array(t.P), new Float32Array(t.N), zeros(t.n * 4), tm, new Uint16Array(t.I)),
    shadow: buffers(new Float32Array(sh.P), zeros(sh.n * 3), zeros(sh.n * 4), sm, new Uint16Array(sh.I)),
  };
  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); failed = true; document.getElementById('pet-live')?.classList.remove('has3d'); });
}
function draw(b) {
  const at = (name, buf, size) => { const l = gl.getAttribLocation(prog, name); if (l < 0) return; gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0); };
  at('aPos', b.p, 3); at('aNorm', b.n, 3); at('aLeg', b.leg, 4); at('aMisc', b.misc, 4);
  const lc = gl.getAttribLocation(prog, 'aCol');
  if (lc >= 0) { if (b.col) at('aCol', b.col, 3); else { gl.disableVertexAttribArray(lc); gl.vertexAttrib3f(lc, 0, 0, 0); } }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.i);
  gl.drawElements(gl.TRIANGLES, b.count, gl.UNSIGNED_SHORT, 0);
}

/* ---------------- animation ---------------- */
const rnd = (a, b) => a + Math.random() * (b - a);
const bump = (x) => (x <= 0 || x >= 1 ? 0 : Math.sin(x * Math.PI)); // 0→1→0
function pose(now) {
  const dt = Math.min(0.05, (now - (S.lastT || now)) / 1000); S.lastT = now;
  const tt = now / 1000;
  const o = { lift: [0, 0, 0, 0], stride: [0, 0, 0, 0], tail: [Math.sin(tt * 0.9) * 0.12, 0.05 + Math.sin(tt * 0.6) * 0.08], head: [...S.head], breath: Math.sin(tt * 2.2), y: 0, sq: 1, blink: 0, happy: 0, pupil: 0.86, tongue: 0, tint: null, shake: 0, smile: 1, brow: 0 };
  const base = S.base;
  // idle head wandering + independent eye saccades
  if (now > S.nextHead) { S.headT = [rnd(-0.35, 0.35), rnd(-0.12, 0.12), rnd(-0.12, 0.12)]; S.nextHead = now + rnd(1500, 4000); }
  for (let e = 0; e < 2; e++) if (now > S.nextSacc[e]) { S.eyeT[e] = Math.random() < 0.15 ? [rnd(-0.9, 0.9), rnd(-0.6, 0.6)] : [rnd(-0.25, 0.25), rnd(-0.2, 0.2)]; S.nextSacc[e] = now + rnd(700, 2600); }
  if (S.look && now < S.lookUntil) { S.headT = [S.look[0] * 0.5, -S.look[1] * 0.25, 0]; S.eyeT = [[S.look[0], -S.look[1]], [S.look[0], -S.look[1]]]; }
  // blinking
  if (!S.blinkAt) S.blinkAt = now + rnd(2000, 5000);
  if (now > S.blinkAt) { o.blink = bump((now - S.blinkAt) / 180); if (now > S.blinkAt + 180) S.blinkAt = now + rnd(2000, 6000); }
  // base states
  if (base === 'sleep') { o.blink = 1; o.head = [0.15, -0.28, 0.1]; S.headT = [0.15, -0.28, 0.1]; o.breath = Math.sin(tt * 1.1) * 1.6; o.sq = 0.94; o.tail = [0.25, 0.5]; }
  else if (base === 'tired' || base === 'hungry') { S.headT = [S.headT[0] * 0.5, -0.22, 0]; o.blink = Math.max(o.blink, base === 'tired' ? 0.45 : 0.15); o.tail = [o.tail[0] * 0.5, -0.15]; o.sq = 0.97; }
  else if (base === 'sad') { o.smile = -0.8; o.brow = -1; S.headT = [S.headT[0] * 0.4, -0.3, 0.08]; o.tail = [o.tail[0] * 0.4, -0.25]; S.eyeT = [[S.eyeT[0][0] * 0.4, -0.6], [S.eyeT[1][0] * 0.4, -0.6]]; o.blink = Math.max(o.blink, 0.25); }
  // walking: diagonal leg pairs, bobbing body, swaying tail
  if (S.walking) {
    S.walkPhase += dt * 11;
    const ph = S.walkPhase, a = Math.sin(ph), b = Math.sin(ph + Math.PI);
    o.lift = [Math.max(0, a) * 0.1, Math.max(0, b) * 0.1, Math.max(0, b) * 0.1, Math.max(0, a) * 0.1];
    o.stride = [Math.cos(ph) * 0.07, Math.cos(ph + Math.PI) * 0.07, Math.cos(ph + Math.PI) * 0.07, Math.cos(ph) * 0.07];
    o.y = Math.abs(Math.sin(ph)) * 0.025; o.tail = [Math.sin(ph * 0.5) * 0.35, 0.1]; S.headT = [Math.sin(ph * 0.5) * 0.12, 0.05, 0];
  }
  // one-off actions
  const A = S.act, k = A ? (now - S.actT0) / S.actMs : 1;
  if (A && k < 1) {
    const t = now - S.actT0;
    switch (A) {
      case 'wave': { const up = Math.min(1, t / 250, (S.actMs - t) / 250); o.lift[0] = 0.42 * up; o.stride[0] = (0.14 + Math.sin(t / 70) * 0.09) * up; S.headT = [0.35, 0.1, 0.18]; o.happy = 0.5 * up; o.tail[1] = 0.35; break; }
      case 'jump': case 'great': case 'joy': case 'win': {
        const n = A === 'joy' ? 2 : 1, j = (k * n) % 1;
        o.y = Math.max(0, Math.sin(j * Math.PI)) * 0.38; o.sq = j < 0.12 || j > 0.9 ? 0.9 : 1.05; o.lift = [0.06, 0.06, 0.06, 0.06]; o.tail = [0, 0.55]; o.happy = 0.7; S.headT = [0.3, 0.15, 0]; break;
      }
      case 'tongue': case 'eat': {
        const shot = A === 'eat' ? (k < 0.5 ? bump(k / 0.25) : 0) : bump(Math.min(1, k / 0.85));
        o.tongue = shot * (A === 'eat' ? 0.9 : 1.25); S.headT = [0.25, -0.05, 0]; S.eyeT = [[0.9, -0.1], [0.4, -0.2]];
        if (A === 'eat' && k > 0.45) { o.head[1] = -0.05 + Math.sin(t / 90) * 0.06; o.happy = 0.8; }
        break;
      }
      case 'heart': case 'stroke': o.happy = 1; o.head[2] = Math.sin(t / 260) * 0.18; o.tail = [Math.sin(t / 200) * 0.3, 0.45]; o.sq = 1 + Math.sin(t / 130) * 0.02; o.tint = [1, 0.75, 0.85]; break;
      case 'angry': o.smile = -0.6; o.brow = 1.3; o.shake = Math.sin(t / 35) * 0.18; o.tint = [1, 0.55, 0.45]; o.blink = Math.max(o.blink, 0.32); o.tail = [Math.sin(t / 60) * 0.4, -0.1]; break;
      case 'sad': case 'lose': o.smile = -0.8; o.brow = -1; S.headT = [0, -0.32, 0.1]; o.tail[1] = -0.3; o.blink = Math.max(o.blink, 0.3); S.eyeT = [[0, -0.7], [0, -0.7]]; o.tint = [0.75, 0.85, 1]; break;
      case 'wow': o.smile = 0.4; o.brow = -0.6; o.pupil = 0.93; S.headT = [0.2, 0.25, 0]; o.y = bump(Math.min(1, k * 3)) * 0.1; break;
      case 'thinking': S.headT = [0.1, 0.22, 0.25]; S.eyeT = [[0.3, 0.8], [0.2, 0.8]]; break;
      case 'letter': case 'normal': case 'hello': S.headT = [0.45, 0.05, 0.1]; o.tail = [Math.sin(t / 150) * 0.35, 0.3]; o.happy = 0.4; break;
      case 'tired': case 'hungry': S.headT = [0.2, -0.25, 0]; o.blink = Math.max(o.blink, 0.45); break;
      case 'turn': break;
    }
  } else if (A) S.act = null;
  // ease head & eyes
  const e = 1 - Math.exp(-dt * 6), ee = 1 - Math.exp(-dt * 14);
  for (let i = 0; i < 3; i++) { S.head[i] = lerp(S.head[i], S.headT[i], e); if (A !== 'eat' && A !== 'heart' && A !== 'stroke') o.head[i] = S.head[i]; }
  if (base === 'sleep') o.head = [0.15, -0.28, 0.1];
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) S.eyes[i][j] = lerp(S.eyes[i][j], S.eyeT[i][j], ee);
  return o;
}
let CAM_M = [0, 1, 4]; // camera position in model space (updated every frame)
function eyeDir(i, u, v) {
  const E = EYES[i], ax = E.ax, right = norm(cross([0, 1, 0], ax)), up = cross(ax, right);
  // look at the viewer, then add the saccade / finger offset
  const toCam = norm(CAM_M.map((c, k) => c - E.c[k]));
  let d = norm(toCam.map((c, k) => c + right[k] * u * 0.55 + up[k] * v * 0.45));
  // keep the pupil inside the visible part of the eye
  for (let it = 0; it < 3; it++) { const k = d[0] * ax[0] + d[1] * ax[1] + d[2] * ax[2]; if (k >= 0.8) break; d = norm(d.map((c, j) => c + ax[j] * (0.8 - k) * 1.5)); }
  return d;
}

let visible = true, lastDraw = 0;
function frame(now) {
  raf = 0;
  if (!canvas?.isConnected || failed || !visible) return; // resumes when it is back on screen
  if (!document.hidden && now - lastDraw > 31) { // ~30 fps is plenty for a pet and saves battery
    lastDraw = now;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (w && h && (canvas.width !== w || canvas.height !== h)) { canvas.width = w; canvas.height = h; }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const o = pose(now);
    // facing: flip through a front view so the turn reads as 3D
    const dt = 0.033;
    S.fv += Math.sign(S.face - S.fv) * Math.min(Math.abs(S.face - S.fv), dt * 9);
    const sx = S.fv, sgn = sx < 0 ? -1 : 1;
    const yaw = sgn * (-0.32 - 1.1 * (1 - Math.abs(sx))) + o.shake;
    const [ks, hb] = STAGE[S.stage] || STAGE.adult;
    const camE = [0, 1.25, 4.9], camC = [0, 0.66, 0];
    const asp = canvas.width / canvas.height;
    gl.uniformMatrix4fv(U.uProj, false, persp(0.46, asp, 0.1, 30));
    gl.uniformMatrix4fv(U.uView, false, lookAt(camE, camC, [0, 1, 0]));
    const flat = Math.max(0.04, Math.abs(sx));
    const M = mul(mul(mul(trans(0, o.y * ks, 0), rotY(yaw)), scal(sgn * flat * ks, ks * o.sq, ks * (2 - o.sq))), trans(-CX, 0, 0));
    const MS = mul(mul(rotY(yaw), scal(sgn * flat * ks, 1, ks)), trans(-CX, 0, 0));
    gl.uniformMatrix4fv(U.uModel, false, M); gl.uniformMatrix4fv(U.uShadowM, false, MS);
    { // camera → model space (undo translate, yaw, scale, centre)
      const px = camE[0], py = camE[1] - o.y * ks, pz = camE[2], c = Math.cos(-yaw), s = Math.sin(-yaw);
      const rx = px * c + pz * s, rz = -px * s + pz * c;
      CAM_M = [rx / (sgn * flat * ks) + CX, py / (ks * o.sq), rz / (ks * (2 - o.sq))];
    }
    gl.uniform3fv(U.uNS, [1 / (flat * flat), 1, 1]);
    gl.uniform3fv(U.uCam, camE);
    gl.uniform4fv(U.uLift, o.lift); gl.uniform4fv(U.uStride, o.stride);
    gl.uniform2fv(U.uTail, o.tail); gl.uniform3fv(U.uHead, o.head);
    gl.uniform1f(U.uBreath, o.breath); gl.uniform1f(U.uHeadBig, hb);
    gl.uniform1f(U.uTongue, o.tongue);
    const td = norm(TDIR), side = norm(cross([0, 1, 0], td)), tup = cross(td, side);
    gl.uniform3fv(U.uMouth, MOUTH); gl.uniform3fv(U.uTdir, td); gl.uniform3fv(U.uTside, side); gl.uniform3fv(U.uTup, tup);
    let body = COLORS[S.color] || COLORS.green;
    if (o.tint) body = body.map((c, i) => c * o.tint[i]);
    gl.uniform3fv(U.uBody, body); gl.uniform1f(U.uRainbow, S.color === 'rainbow' ? 1 : 0);
    gl.uniform1f(U.uTime, now / 1000); gl.uniform1f(U.uBlink, o.blink); gl.uniform1f(U.uHappy, o.happy); gl.uniform1f(U.uPupil, o.pupil);
    gl.uniform1f(U.uShadow, ks * (1 - o.y * 0.8)); gl.uniform1f(U.uShadowA, 1 - o.y * 1.2);
    EYES.forEach((E, i) => {
      gl.uniform3fv(U[`uE${i}c`], E.c); gl.uniform3fv(U[`uE${i}a`], E.ax); gl.uniform3fv(U[`uE${i}l`], eyeDir(i, S.eyes[i][0], S.eyes[i][1]));
    });
    gl.uniform2fv(U.uER, [EYES[0].r, EYES[1].r]);
    gl.uniform4fv(U['uSpots[0]'], SPOTS.flat());
    { const f = norm(TDIR), sd = norm(cross([0, 1, 0], f)), up = cross(f, sd);
      gl.uniform3fv(U.uMouthC, MOUTH); gl.uniform3fv(U.uFwd, f); gl.uniform3fv(U.uSide, sd); gl.uniform3fv(U.uUp, up); }
    gl.uniform1f(U.uSmile, o.smile); gl.uniform1f(U.uBrow, o.brow);
    gl.depthMask(false); draw(D.shadow); gl.depthMask(true);
    draw(D.body);
    const acc = accBuffers(S.acc); if (acc) draw(acc);
    if (o.tongue > 0.02) draw(D.tongue);
  }
  raf = requestAnimationFrame(frame);
}

/* ---------------- public API ---------------- */
export const pet3dOn = () => !!(D && !failed && canvas?.isConnected && canvas.closest('#pet-live'));
/** Can this device show the 3D pet at all? (checked once, cheaply) */
let capable;
export function pet3dCapable() { if (capable === undefined) { try { capable = !failed && !!document.createElement('canvas').getContext('webgl'); } catch { capable = false; } } return capable && !failed; }
/** Put the 3D canvas into the pet card (keeps one GL context across page re-renders). */
let pinned = null;
/** While a sheet (the wardrobe) shows Хамі, page re-renders must not take him away. */
export function pet3dPin(host) { pinned = host || null; }
export async function pet3dMount(host) {
  if (failed || !host) return false;
  if (pinned && pinned !== host && pinned.isConnected) return false;
  const p = host.closest('.pet-otter');
  if (p) { S.stage = p.dataset.stage || 'adult'; S.base = p.dataset.base || ''; S.mood = p.dataset.mood || ''; S.color = p.dataset.color || 'green'; S.acc = p.dataset.acc || 'none'; }
  try {
    if (!D) { loading ||= init(); await loading; }
  } catch (e) { failed = true; console.warn('pet3d off:', e.message); document.querySelectorAll('.pet-otter.has3d').forEach((x) => x.classList.remove('has3d')); return false; }
  if (!host.isConnected) return false;
  if (canvas.parentElement !== host) host.appendChild(canvas);
  p?.classList.add('has3d');
  if (!io && 'IntersectionObserver' in window) {
    io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(frame); });
    io.observe(canvas);
  }
  if (!raf) raf = requestAnimationFrame(frame);
  return true;
}
const MAP = { idle: null, zz: null, eat: 'eat', heart: 'heart', joy: 'joy', great: 'great', wave: 'wave', jump: 'jump', tongue: 'tongue', angry: 'angry', sad: 'sad', wow: 'wow', thinking: 'thinking', letter: 'letter', normal: 'normal', tired: 'tired', hungry: 'hungry', play: 'jump' };
/** Play a one-off action (names match the sprite poses / frame sets). */
export function pet3dAct(name, ms = 1600) {
  const a = name in MAP ? MAP[name] : 'normal'; if (!a) return;
  S.act = a; S.actT0 = performance.now(); S.actMs = Math.max(500, ms);
}
export function pet3dWalk(ms) { S.walking = true; clearTimeout(S.wt); S.wt = setTimeout(() => { S.walking = false; }, ms); }
export function pet3dFace(f) { S.face = f < 0 ? -1 : 1; }
export function pet3dLook(dx, dy) { S.look = [Math.max(-1, Math.min(1, dx * 2 * (S.fv < 0 ? -1 : 1))), Math.max(-1, Math.min(1, dy * 2))]; S.lookUntil = performance.now() + 1500; }
