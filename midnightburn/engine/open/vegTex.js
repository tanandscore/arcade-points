// Midnight Burn — painted plants. Everything here is drawn in code: a 4 x 4 atlas of leaf, needle, frond, grass and flower
// sprites (with soft light-to-dark shading painted into every leaf), and a bark / palm-trunk / rock atlas.
// Nothing is a stock photo: each leaf is a little bezier shape with a midrib and veins, piled up in dark-to-light layers.
import * as THREE from "three";
import { mulberry } from "./geo";

const cv = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const TAU = Math.PI * 2;
const rgbs = (c, k = 1) => `rgb(${Math.max(0, Math.min(255, c[0] * k | 0))},${Math.max(0, Math.min(255, c[1] * k | 0))},${Math.max(0, Math.min(255, c[2] * k | 0))})`;
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const jit = (c, rnd, a = 14) => [c[0] + (rnd() - 0.5) * a, c[1] + (rnd() - 0.5) * a, c[2] + (rnd() - 0.5) * a * 0.6];

// the atlas cells, in reading order (4 columns x 4 rows, 256 px each)
export const CELL = { leafA: 0, leafB: 1, conifer: 2, frond: 3, bush: 4, grass: 5, tall: 6, bougain: 7, fern: 8, gulmohar: 9, casuarina: 10, banana: 11, flowerO: 12, flowerW: 13, pinnate: 14, leafC: 15 };
// uv rectangle of a cell: [u0, v0, u1, v1] (v points up, like a CanvasTexture)
export const cellUV = (c, pad = 0.003) => { const cx = c % 4, cy = Math.floor(c / 4); return [cx / 4 + pad, 1 - (cy + 1) / 4 + pad, (cx + 1) / 4 - pad, 1 - cy / 4 - pad]; };

// one leaf: a pointed oval with light on one edge, a midrib and a few veins. (x,y) is the stalk end, ang the direction it points.
function leaf(g, x, y, ang, len, wid, cA, cB, rib = true, curl = 0) {
  g.save(); g.translate(x, y); g.rotate(ang);
  const gr = g.createLinearGradient(0, -wid, 0, wid); gr.addColorStop(0, rgbs(cA)); gr.addColorStop(1, rgbs(cB));
  g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0);
  g.bezierCurveTo(len * 0.2, -wid * 1.2 + curl, len * 0.7, -wid * 0.95 + curl, len, curl * 0.5);
  g.bezierCurveTo(len * 0.7, wid * 0.95 + curl, len * 0.2, wid * 1.2 + curl, 0, 0); g.fill();
  if (rib && wid > 2.4) {
    g.strokeStyle = rgbs(mix(cA, [210, 230, 150], 0.4)); g.globalAlpha = 0.75; g.lineWidth = Math.max(0.7, wid * 0.11);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.5, curl * 0.9, len * 0.94, curl * 0.5); g.stroke();
    if (wid > 6) { g.lineWidth = 0.6; g.globalAlpha = 0.3; g.beginPath(); for (let k = 1; k < 5; k++) { const t = k / 5.2; g.moveTo(len * t, curl * t); g.lineTo(len * (t + 0.17), -wid * 0.78 * (1 - t * 0.5)); g.moveTo(len * t, curl * t); g.lineTo(len * (t + 0.17), wid * 0.78 * (1 - t * 0.5)); } g.stroke(); }
    g.globalAlpha = 1;
  }
  g.restore();
}
// a five-petal blossom
function blossom(g, x, y, r, col, rnd, centre = [250, 210, 70]) {
  g.save(); g.translate(x, y); g.rotate(rnd() * TAU);
  for (let k = 0; k < 5; k++) { g.rotate(TAU / 5); g.fillStyle = rgbs(mix(col, [255, 255, 255], rnd() * 0.16), 0.9 + rnd() * 0.14); g.beginPath(); g.ellipse(r * 0.55, 0, r * 0.62, r * 0.4, 0, 0, TAU); g.fill(); }
  g.fillStyle = rgbs(centre); g.beginPath(); g.arc(0, 0, r * 0.24, 0, TAU); g.fill(); g.restore();
}
// a papery bougainvillea bract: three overlapping heart-ish petals
function bract(g, x, y, r, col, rnd) {
  g.save(); g.translate(x, y); g.rotate(rnd() * TAU);
  for (let k = 0; k < 3; k++) { g.rotate(TAU / 3 + (rnd() - 0.5) * 0.4); g.fillStyle = rgbs(mix(col, [255, 255, 255], rnd() * 0.2), 0.82 + rnd() * 0.3); g.beginPath(); g.ellipse(r * 0.5, 0, r * 0.6, r * 0.45, 0, 0, TAU); g.fill(); }
  g.fillStyle = "rgb(245,235,170)"; g.beginPath(); g.arc(0, 0, r * 0.14, 0, TAU); g.fill(); g.restore();
}

// ---- cell painters: each draws into the 256 x 256 square starting at (ox, oy) and clips itself to it ------------------------------------------------
function cellBegin(g, ox, oy) { g.save(); g.beginPath(); g.rect(ox, oy, 256, 256); g.clip(); }
function cellEnd(g) { g.restore(); }

// a small leaf drawn with flat fills (fast): used when a card carries thousands of them
function leafFast(g, x, y, ang, len, wid, col, hi) {
  g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = rgbs(col);
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * 0.45, -wid * 1.25, len, 0); g.quadraticCurveTo(len * 0.45, wid * 1.25, 0, 0); g.fill();
  if (hi) { g.strokeStyle = rgbs(hi); g.globalAlpha = 0.55; g.lineWidth = Math.max(0.6, wid * 0.16); g.beginPath(); g.moveTo(len * 0.05, 0); g.lineTo(len * 0.9, 0); g.stroke(); g.globalAlpha = 1; }
  g.restore();
}
// a ragged sprig: several lobes of small leaves joined by thin twigs, with gaps between them, lit from the upper left
function leafLobes(g, ox, oy, rnd, o) {
  cellBegin(g, ox, oy);
  const cx = ox + 128, cy = oy + 128 + (o.cy || 0), nl = o.lobes, ry = o.ry || 0.92;
  const L = [{ x: cx, y: cy, r: o.r0 }];
  for (let i = 0; i < nl; i++) { const a = (i / nl) * TAU + rnd() * 0.8, d = o.dmin + rnd() * (o.dmax - o.dmin); L.push({ x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * ry, r: o.rmin + rnd() * (o.rmax - o.rmin) }); }
  g.lineCap = "round"; g.strokeStyle = "rgb(58,44,30)"; g.lineWidth = 2.6; for (let i = 1; i < L.length; i++) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(L[i].x, L[i].y); g.stroke(); }
  const total = o.n; const share = total / L.length;
  L.sort((a, b) => a.y - b.y);
  for (const lb of L) {
    g.fillStyle = rgbs(mix(o.dark, [0, 0, 0], 0.4)); g.beginPath(); g.ellipse(lb.x, lb.y, lb.r * 0.55, lb.r * 0.55 * ry, 0, 0, TAU); g.fill();
    const cnt = (share * (lb.r / ((o.rmin + o.rmax) / 2))) | 0;
    for (let i = 0; i < cnt; i++) {
      const a = rnd() * TAU, d = Math.pow(rnd(), 0.58) * lb.r, x = lb.x + Math.cos(a) * d, y = lb.y + Math.sin(a) * d * ry;
      const lit = clamp01(0.5 + 0.5 * (-Math.cos(a) * 0.55 - Math.sin(a) * 0.83) * (0.4 + 0.6 * d / lb.r) + (rnd() - 0.5) * 0.3 + (1 - (y - oy) / 256 - 0.5) * 0.35);
      const dx = Math.cos(a + (rnd() - 0.5) * 1.8) * (1 - o.droop), dy = Math.sin(a + (rnd() - 0.5) * 1.8) * (1 - o.droop) + o.droop;
      const len = o.len[0] + rnd() * (o.len[1] - o.len[0]), wid = o.wid[0] + rnd() * (o.wid[1] - o.wid[0]);
      let c = lit < 0.5 ? mix(o.dark, o.mid, lit * 2) : mix(o.mid, o.light, (lit - 0.5) * 2); c = jit(c, rnd, 18); if (o.accent && rnd() < 0.08) c = mix(c, o.accent, 0.7);
      leafFast(g, x, y, Math.atan2(dy, dx), len, wid, c, lit > 0.62 ? mix(c, [220, 235, 160], 0.4) : null);
    }
  }
  cellEnd(g);
}
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// a round puff of leaves in three layers (deep shadow, middle, sunlit), radiating outward with a little droop
function leafCluster(g, ox, oy, rnd, o) {
  cellBegin(g, ox, oy);
  const cx = ox + 128, cy = oy + 128 + (o.cy || 0), R = o.R, ry = o.ry || 0.9;
  g.fillStyle = rgbs(mix(o.dark, [0, 0, 0], 0.35)); g.beginPath(); g.ellipse(cx, cy, R * 0.58, R * 0.58 * ry, 0, 0, TAU); g.fill(); // solid core so the middle never shows through
  const layers = [[0.36, o.dark, 0.78], [0.4, o.mid, 0.94], [0.34, o.light, 1.0]];
  for (const [share, col, reach] of layers) {
    const cnt = (o.n * share) | 0;
    for (let i = 0; i < cnt; i++) {
      const a = rnd() * TAU, d = Math.pow(rnd(), 0.62) * R * reach; const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * ry;
      const dx = Math.cos(a + (rnd() - 0.5) * 1.7) * (1 - o.droop), dy = Math.sin(a + (rnd() - 0.5) * 1.7) * (1 - o.droop) + o.droop;
      const up = 1 - (y - oy) / 256; // 1 at the top of the cell: leaves up there catch the light
      const len = o.len[0] + rnd() * (o.len[1] - o.len[0]), wid = o.wid[0] + rnd() * (o.wid[1] - o.wid[0]);
      const c = mix(jit(col, rnd, 16), o.light, Math.max(0, up - 0.35) * 0.55 * (d / R));
      leaf(g, x, y, Math.atan2(dy, dx), len, wid, mix(c, o.light, 0.18), mix(c, o.dark, 0.4), true, (rnd() - 0.5) * 3);
    }
  }
  cellEnd(g);
}

// a flat spray of pine / cypress needles: a woody twig from the left, short side twigs, needles fanned along each
function paintConifer(g, ox, oy, rnd) {
  cellBegin(g, ox, oy); g.lineCap = "round";
  const mid = oy + 128, sag = (t) => mid + 12 * t * t - 4 * t;
  g.strokeStyle = "rgb(84,60,40)"; g.lineWidth = 4.6; g.beginPath(); for (let t = 0; t <= 1.001; t += 0.05) { const x = ox + 5 + t * 244, y = sag(t); if (t === 0) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke();
  for (let pass = 0; pass < 2; pass++) {
    const NB = pass ? 26 : 34, dark = pass ? [34, 82, 52] : [18, 48, 34], light = pass ? [124, 172, 100] : [66, 114, 76];
    for (let i = 0; i < NB; i++) for (const side of [-1, 1]) {
      const t = 0.05 + (i / NB) * 0.92 + (rnd() - 0.5) * 0.03, bx = ox + 5 + t * 244, by = sag(t);
      const prof = Math.pow(Math.min(1, t / 0.3), 0.7) * Math.pow(1 - t * 0.97, 0.6); // longest near the first third, pointed at the tip
      const L = (112 * prof + 8) * (0.6 + rnd() * 0.55) * (pass ? 0.72 : 1);
      const th = side * (0.78 + rnd() * 0.3 - 0.3 * t), ex = bx + Math.cos(th) * L, ey = by + Math.sin(th) * L + L * 0.08;
      g.strokeStyle = "rgb(70,52,36)"; g.lineWidth = pass ? 1.3 : 1.8; g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo((bx + ex) / 2, (by + ey) / 2 + L * 0.1, ex, ey); g.stroke();
      const nN = Math.max(4, (L / 3.0) | 0);
      for (let k = 0; k < nN; k++) {
        const u = (k + 0.5) / nN, px = bx + (ex - bx) * u, py = by + (ey - by) * u; const nl = (22 - 9 * u) * (0.7 + rnd() * 0.6) * (pass ? 0.82 : 1);
        for (const ns of [-1, 1]) {
          const na = th + ns * (0.8 + rnd() * 0.4); const c = mix(dark, light, Math.min(1, u * 0.85 + rnd() * 0.3));
          g.strokeStyle = rgbs(c); g.lineWidth = 1.9 - u * 0.5; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(na) * nl, py + Math.sin(na) * nl); g.stroke();
        }
      }
    }
  }
  cellEnd(g);
}

// a pinnate palm frond: a curved rib with long drooping leaflets in pairs
function paintFrond(g, ox, oy, rnd) {
  cellBegin(g, ox, oy); g.lineCap = "round";
  const y0 = oy + 108, P = (t) => { const a = 1 - t; return [ox + 5 + (a * a * 0 + 2 * a * t * 128 + t * t * 244), y0 + (a * a * 0 + 2 * a * t * -10 + t * t * 44)]; };
  g.strokeStyle = "rgb(124,150,70)"; g.lineWidth = 3.4; g.beginPath(); for (let t = 0; t <= 1.001; t += 0.05) { const p = P(t); if (t === 0) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); } g.stroke();
  const N = 92;
  for (let i = 0; i < N; i++) {
    const t = 0.05 + 0.93 * (i / N), p = P(t), q = P(Math.min(1, t + 0.02)); const tang = Math.atan2(q[1] - p[1], q[0] - p[0]);
    for (const side of [-1, 1]) {
      const len = (84 * Math.pow(Math.sin(Math.PI * Math.min(1, (t + 0.05) * 1.03)), 0.5) * (1 - 0.3 * t) + 12) * (0.9 + rnd() * 0.2);
      const ang = tang + side * (1.0 - 0.38 * t + (rnd() - 0.5) * 0.16); const c = mix([36, 84, 34], [112, 168, 64], Math.min(1, t * 0.5 + rnd() * 0.3));
      leaf(g, p[0], p[1], ang, len, 2.5 + (1 - t) * 1.2, mix(c, [150, 200, 90], 0.22), mix(c, [20, 54, 24], 0.4), false, side * 2.5);
    }
  }
  cellEnd(g);
}

// a low mound of small leaves, solid at the bottom so it sits on the ground
function paintBush(g, ox, oy, rnd) {
  leafLobes(g, ox, oy, rnd, { lobes: 5, r0: 66, dmin: 34, dmax: 64, rmin: 40, rmax: 58, ry: 0.78, cy: 26, n: 2100, len: [12, 19], wid: [5, 8], dark: [22, 54, 24], mid: [42, 92, 34], light: [92, 146, 52], droop: 0.2, accent: [150, 170, 60] });
}
function paintGrass(g, ox, oy, rnd, o) {
  cellBegin(g, ox, oy); g.lineCap = "round";
  const n = o.n, base = oy + 254;
  for (let i = 0; i < n; i++) {
    const x0 = ox + 128 + (rnd() - 0.5) * o.spread, h = o.h[0] + rnd() * (o.h[1] - o.h[0]), bend = (rnd() - 0.5) * o.bend * (h / 200), w = o.w[0] + rnd() * (o.w[1] - o.w[0]);
    const dry = rnd() < o.dry; const cb = dry ? [96, 90, 44] : [28, 58, 20], ct = dry ? [172, 160, 84] : mix([96, 142, 50], [150, 176, 70], rnd());
    const gr = g.createLinearGradient(0, base, 0, base - h); gr.addColorStop(0, rgbs(cb)); gr.addColorStop(1, rgbs(ct));
    g.fillStyle = gr; g.beginPath(); g.moveTo(x0 - w, base); g.quadraticCurveTo(x0 - w * 0.35 + bend * 0.45, base - h * 0.55, x0 + bend, base - h); g.quadraticCurveTo(x0 + w * 0.35 + bend * 0.45, base - h * 0.55, x0 + w, base); g.closePath(); g.fill();
    if (o.plume && rnd() < 0.5) { g.strokeStyle = "rgba(222,210,168,0.85)"; g.lineWidth = 1.2; for (let k = 0; k < 9; k++) { const a = -Math.PI / 2 + (rnd() - 0.5) * 1.2, l = 26 + rnd() * 24; g.beginPath(); g.moveTo(x0 + bend, base - h); g.lineTo(x0 + bend + Math.cos(a) * l * 0.5 + (rnd() - 0.5) * 6, base - h + Math.sin(a) * l); g.stroke(); } }
  }
  cellEnd(g);
}
function paintFlowerBush(g, ox, oy, rnd, cols, kind) {
  paintBush(g, ox, oy, rnd);
  cellBegin(g, ox, oy);
  const n = kind === "bract" ? 230 : 150;
  for (let i = 0; i < n; i++) {
    const a = rnd() * TAU, d = Math.pow(rnd(), 0.55) * 112, x = ox + 128 + Math.cos(a) * d, y = oy + 150 + Math.sin(a) * d * 0.8 - 6;
    if (y > oy + 244) continue; const c = cols[(rnd() * cols.length) | 0];
    if (kind === "bract") bract(g, x, y, 8 + rnd() * 7, c, rnd); else blossom(g, x, y, 6 + rnd() * 6, c, rnd);
  }
  cellEnd(g);
}
function paintFern(g, ox, oy, rnd) {
  cellBegin(g, ox, oy); g.lineCap = "round";
  const bx = ox + 128, by = oy + 252, F = 11;
  for (let f = 0; f < F; f++) {
    const a = -Math.PI / 2 + ((f / (F - 1)) - 0.5) * 2.35 + (rnd() - 0.5) * 0.25, L = 150 + rnd() * 80, bendS = (a + Math.PI / 2) * 0.55;
    const P = (t) => [bx + Math.cos(a) * L * t + Math.sin(bendS) * 40 * t * t, by + Math.sin(a) * L * t + (t * t) * 54];
    g.strokeStyle = "rgb(64,102,44)"; g.lineWidth = 2.4; g.beginPath(); for (let t = 0; t <= 1.001; t += 0.1) { const p = P(t); if (t === 0) g.moveTo(p[0], p[1]); else g.lineTo(p[0], p[1]); } g.stroke();
    const M = 17;
    for (let i = 2; i < M; i++) {
      const t = i / M, p = P(t), q = P(Math.min(1, t + 0.03)); const tang = Math.atan2(q[1] - p[1], q[0] - p[0]); const len = (40 * Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.1)) + 7) * (0.9 + rnd() * 0.2);
      for (const s of [-1, 1]) { const c = mix([30, 78, 32], [104, 160, 60], t * 0.7 + rnd() * 0.25); leaf(g, p[0], p[1], tang + s * (1.18 - 0.3 * t), len, 7.2, mix(c, [150, 200, 96], 0.2), mix(c, [20, 50, 22], 0.35), false, s * 1.8); }
    }
  }
  cellEnd(g);
}
// fine feathery leaves in rows along thin twigs (rain tree, tamarind, gulmohar); gulmohar adds scarlet blossom on top
function paintPinnate(g, ox, oy, rnd, flowers) {
  cellBegin(g, ox, oy); g.lineCap = "round";
  const cx = ox + 128, cy = oy + 134;
  g.fillStyle = "rgb(24,56,26)"; g.beginPath(); g.ellipse(cx, cy, 70, 62, 0, 0, TAU); g.fill();
  for (let pass = 0; pass < 2; pass++) {
    const dark = pass ? [58, 112, 44] : [30, 70, 32], light = pass ? [122, 176, 70] : [66, 118, 48];
    for (let k = 0; k < 44; k++) {
      const a = rnd() * TAU, L = (50 + rnd() * 62) * (pass ? 0.92 : 1), ex = cx + Math.cos(a) * L, ey = cy + Math.sin(a) * L * 0.86;
      g.strokeStyle = "rgb(60,70,40)"; g.lineWidth = 1.3; g.beginPath(); g.moveTo(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8); g.lineTo(ex, ey); g.stroke();
      const M = 12;
      for (let i = 1; i < M; i++) { const t = i / M, px = cx + (ex - cx) * t, py = cy + (ey - cy) * t; for (const s of [-1, 1]) { const c = mix(dark, light, t * 0.6 + rnd() * 0.4); leaf(g, px, py, a + s * 1.28, 13 + rnd() * 6, 4.6, mix(c, light, 0.2), mix(c, dark, 0.3), false); } }
    }
  }
  if (flowers) for (let i = 0; i < 150; i++) { const a = rnd() * TAU, d = Math.pow(rnd(), 0.6) * 100, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.8 - 10; blossom(g, x, y, 5 + rnd() * 5, flowers[(rnd() * flowers.length) | 0], rnd, [255, 220, 90]); }
  cellEnd(g);
}
// casuarina: fine drooping needles hanging from a branch along the top
function paintCasuarina(g, ox, oy, rnd) {
  cellBegin(g, ox, oy); g.lineCap = "round";
  g.strokeStyle = "rgb(84,62,44)"; g.lineWidth = 5; g.beginPath(); g.moveTo(ox + 4, oy + 10); g.lineTo(ox + 252, oy + 12); g.stroke();
  for (let pass = 0; pass < 2; pass++) for (let i = 0; i < 120; i++) {
    const x0 = ox + 12 + rnd() * 232, len = (140 + rnd() * 100) * (pass ? 0.8 : 1), sw = (rnd() - 0.5) * 50;
    const c = pass ? mix([84, 126, 82], [150, 188, 120], rnd()) : mix([36, 74, 44], [74, 110, 66], rnd());
    g.strokeStyle = rgbs(c); g.lineWidth = 1.5 + rnd() * 1.2; g.beginPath(); g.moveTo(x0, oy + 12); g.quadraticCurveTo(x0 + sw * 0.3, oy + 12 + len * 0.5, x0 + sw, oy + 12 + len); g.stroke();
    g.strokeStyle = rgbs(c, 0.8); g.lineWidth = 1; for (let k = 1; k < 9; k++) { const t = k / 9; const px = x0 + sw * t * t * 0.9 + sw * 0.3 * t * (1 - t), py = oy + 12 + len * t; g.beginPath(); g.moveTo(px - 4, py - 2); g.lineTo(px + 4, py + 1); g.stroke(); }
  }
  cellEnd(g);
}
// one big banana / canna leaf with a stout midrib and torn edges
function paintBanana(g, ox, oy, rnd) {
  cellBegin(g, ox, oy);
  for (const [dx, sc, rot] of [[-36, 0.82, -0.28], [38, 0.78, 0.3], [0, 1, 0]]) {
    g.save(); g.translate(ox + 128 + dx, oy + 254); g.rotate(rot); g.scale(sc, sc);
    const gr = g.createLinearGradient(-60, 0, 60, 0); gr.addColorStop(0, "rgb(50,112,44)"); gr.addColorStop(0.5, "rgb(86,150,60)"); gr.addColorStop(1, "rgb(44,100,40)");
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(-76, -50, -66, -190, -6, -244); g.bezierCurveTo(8, -190, 64, -140, 66, -76); g.bezierCurveTo(60, -34, 20, -6, 0, 0); g.fill();
    g.strokeStyle = "rgb(150,190,96)"; g.lineWidth = 3.4; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-6, -120, -4, -236); g.stroke();
    g.lineWidth = 0.8; g.strokeStyle = "rgba(20,50,20,0.5)"; for (let k = 1; k < 22; k++) { const y = -k * 10.5; g.beginPath(); g.moveTo(-3, y); g.lineTo(-62 + k * 1.2, y - 24 - k * 0.3); g.moveTo(-3, y); g.lineTo(62 - k * 1.2, y - 22 - k * 0.3); g.stroke(); }
    g.globalCompositeOperation = "destination-out"; for (let k = 0; k < 8; k++) { const y = -30 - rnd() * 190, s = rnd() < 0.5 ? -1 : 1; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-3, y); g.lineTo(s * 70, y - 20); g.stroke(); } g.globalCompositeOperation = "source-over";
    g.restore();
  }
  cellEnd(g);
}

// ---- the foliage atlas -------------------------------------------------------------------------------------------------------------------------------
export function foliageAtlas() {
  const S = 1024, c = cv(S, S), g = c.getContext("2d"), rnd = mulberry(4242); g.clearRect(0, 0, S, S);
  const at = (cell) => [(cell % 4) * 256, Math.floor(cell / 4) * 256];
  let o;
  o = at(CELL.leafA); leafLobes(g, o[0], o[1], rnd, { lobes: 6, r0: 48, dmin: 38, dmax: 70, rmin: 32, rmax: 50, n: 2400, len: [13, 21], wid: [6, 9.5], dark: [20, 50, 22], mid: [40, 90, 32], light: [98, 148, 50], droop: 0.14, accent: [150, 168, 56] });
  o = at(CELL.leafB); leafLobes(g, o[0], o[1], rnd, { lobes: 5, r0: 42, dmin: 34, dmax: 66, rmin: 30, rmax: 48, n: 1000, len: [26, 40], wid: [5, 8], dark: [24, 60, 26], mid: [50, 102, 38], light: [112, 158, 58], droop: 0.58, accent: [160, 176, 60] });
  o = at(CELL.conifer); paintConifer(g, o[0], o[1], rnd);
  o = at(CELL.frond); paintFrond(g, o[0], o[1], rnd);
  o = at(CELL.bush); paintBush(g, o[0], o[1], rnd);
  o = at(CELL.grass); paintGrass(g, o[0], o[1], rnd, { n: 54, spread: 110, h: [90, 220], w: [3, 6.5], bend: 70, dry: 0.12 });
  o = at(CELL.tall); paintGrass(g, o[0], o[1], rnd, { n: 30, spread: 90, h: [150, 244], w: [2.4, 4.4], bend: 110, dry: 0.3, plume: true });
  o = at(CELL.bougain); paintFlowerBush(g, o[0], o[1], rnd, [[214, 34, 112], [238, 72, 152], [182, 26, 96]], "bract");
  o = at(CELL.fern); paintFern(g, o[0], o[1], rnd);
  o = at(CELL.gulmohar); paintPinnate(g, o[0], o[1], rnd, [[226, 50, 30], [246, 92, 32], [214, 36, 36]]);
  o = at(CELL.casuarina); paintCasuarina(g, o[0], o[1], rnd);
  o = at(CELL.banana); paintBanana(g, o[0], o[1], rnd);
  o = at(CELL.flowerO); paintFlowerBush(g, o[0], o[1], rnd, [[252, 142, 30], [255, 180, 54], [232, 92, 24]], "blossom");
  o = at(CELL.flowerW); paintFlowerBush(g, o[0], o[1], rnd, [[246, 240, 236], [255, 226, 238], [242, 196, 222]], "blossom");
  o = at(CELL.pinnate); paintPinnate(g, o[0], o[1], rnd, null);
  o = at(CELL.leafC); leafLobes(g, o[0], o[1], rnd, { lobes: 6, r0: 46, dmin: 38, dmax: 70, rmin: 30, rmax: 48, n: 800, len: [20, 30], wid: [11, 15], dark: [22, 58, 26], mid: [42, 98, 36], light: [92, 150, 54], droop: 0.1, accent: [150, 170, 56] });
  return bleed(c, 4, 4);
}
// transparent texels take the average colour of their cell, so mip-mapping never pulls in dark or white fringes around the leaves
function bleed(c, cols, rows) {
  const w = c.width, h = c.height, im = c.getContext("2d").getImageData(0, 0, w, h), d = im.data, cw = w / cols, ch = h / rows;
  for (let cy = 0; cy < rows; cy++) for (let cx = 0; cx < cols; cx++) {
    let r = 0, gg = 0, b = 0, n = 0;
    for (let y = cy * ch; y < (cy + 1) * ch; y += 2) for (let x = cx * cw; x < (cx + 1) * cw; x += 2) { const i = (y * w + x) * 4; if (d[i + 3] > 140) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; } }
    if (!n) continue; r = (r / n) | 0; gg = (gg / n) | 0; b = (b / n) | 0;
    for (let y = cy * ch; y < (cy + 1) * ch; y++) for (let x = cx * cw; x < (cx + 1) * cw; x++) { const i = (y * w + x) * 4; if (d[i + 3] < 140) { d[i] = r; d[i + 1] = gg; d[i + 2] = b; } }
  }
  const out = new Uint8Array(w * h * 4); for (let y = 0; y < h; y++) out.set(d.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4); // rows flipped so v points up like a CanvasTexture
  const t = new THREE.DataTexture(out, w, h, THREE.RGBAFormat); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.anisotropy = 8; t.needsUpdate = true; t.userData.src = c;
  return t;
}

// ---- bark, palm trunk and rock: four columns, each 256 px wide and tall enough to run the length of a trunk ---------------------------------------------
// column 0 broadleaf bark · column 1 pine bark · column 2 palm trunk with ring scars · column 3 rock (the top 256 px, tiled by the rock builder)
export const BARK = { broad: 0, pine: 1, palm: 2, rock: 3 };
export const barkUV = (col) => [col / 4 + 0.012, 0.01, (col + 1) / 4 - 0.012, 0.99];
export function barkAtlas() {
  const W = 1024, H = 1024, c = cv(W, H), g = c.getContext("2d"), rnd = mulberry(909);
  const wrap = (x0, fn) => { for (const o of [-256, 0, 256]) { g.save(); g.beginPath(); g.rect(x0, 0, 256, H); g.clip(); fn(o); g.restore(); } };
  // 0: broadleaf bark — deep vertical furrows
  g.fillStyle = "rgb(88,72,58)"; g.fillRect(0, 0, 256, H);
  wrap(0, (o) => { const r = mulberry(11); for (let i = 0; i < 190; i++) { const x = r() * 256 + o, w = 3 + r() * 9, y0 = -80 + r() * (H + 40), len = 160 + r() * 380, ph = i * 1.7; let y = y0; g.strokeStyle = `rgba(${28 + r() * 14 | 0},${22 + r() * 10 | 0},${18 + r() * 8 | 0},${0.55 + r() * 0.35})`; g.lineWidth = w; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 14; k++) { y += len / 12; g.lineTo(x + Math.sin(k * 0.9 + ph) * 3 + (r() - 0.5) * 3, y); } g.stroke();
    g.strokeStyle = `rgba(146,124,100,${0.22 + r() * 0.25})`; g.lineWidth = w * 0.4; g.beginPath(); y = y0; g.moveTo(x + w * 0.9, y); for (let k = 0; k < 14; k++) { y += len / 12; g.lineTo(x + w * 0.9 + Math.sin(k * 0.9 + ph) * 3, y); } g.stroke(); } });
  for (let i = 0; i < 2600; i++) { const v = 60 + rnd() * 70 | 0; g.fillStyle = `rgba(${v},${v - 8},${v - 16},0.22)`; g.fillRect(rnd() * 256, rnd() * H, 1 + rnd() * 3, 3 + rnd() * 16); }
  // 1: pine bark — plates of rust-brown scale split by dark cracks
  g.fillStyle = "rgb(52,36,28)"; g.fillRect(256, 0, 256, H);
  wrap(256, (o) => { const r = mulberry(21); for (let y = -20; y < H + 40; y += 26) for (let x = 0; x < 256; x += 30) { const px = 256 + x + (((y / 26) | 0) % 2) * 15 + (r() - 0.5) * 8 + o, py = y + (r() - 0.5) * 8, w = 24 + r() * 14, h = 24 + r() * 16; const v = 0.7 + r() * 0.55; g.fillStyle = `rgb(${112 * v | 0},${68 * v | 0},${46 * v | 0})`; g.beginPath(); g.moveTo(px, py + h * 0.2); g.lineTo(px + w * 0.5, py); g.lineTo(px + w, py + h * 0.25); g.lineTo(px + w * 0.9, py + h); g.lineTo(px + w * 0.1, py + h * 0.95); g.closePath(); g.fill(); g.strokeStyle = "rgba(20,12,8,0.5)"; g.lineWidth = 1.2; g.stroke(); g.fillStyle = "rgba(200,140,96,0.18)"; g.fillRect(px + w * 0.2, py + 2, w * 0.4, 2); } });
  // 2: palm trunk — grey fibre with ring scars about every 24 px
  g.fillStyle = "rgb(122,108,90)"; g.fillRect(512, 0, 256, H);
  for (let i = 0; i < 2200; i++) { const v = 90 + rnd() * 60 | 0; g.fillStyle = `rgba(${v},${v - 6},${v - 16},0.3)`; g.fillRect(512 + rnd() * 256, rnd() * H, 1 + rnd() * 2, 8 + rnd() * 30); }
  for (let y = 6; y < H; y += 21 + ((y / 21 | 0) % 3)) { g.fillStyle = "rgba(46,38,30,0.55)"; g.fillRect(512, y, 256, 3.6); g.fillStyle = "rgba(178,162,136,0.3)"; g.fillRect(512, y + 4, 256, 2.4); g.fillStyle = "rgba(40,32,26,0.16)"; g.fillRect(512, y + 7, 256, 5); }
  // 3: rock — layered grey stone, hairline cracks, pale lichen
  g.fillStyle = "rgb(122,116,106)"; g.fillRect(768, 0, 256, H);
  for (let k = 0; k < 4; k++) {
    const y0 = k * 256; wrap(768, (o) => { const r = mulberry(31 + k); for (let i = 0; i < 160; i++) { const v = 78 + r() * 90 | 0, x = 768 + r() * 256 + o, y = y0 + r() * 256; g.fillStyle = `rgba(${v},${v - 3},${v - 10},${0.18 + r() * 0.22})`; g.beginPath(); g.ellipse(x, y, 5 + r() * 40, 2 + r() * 12, (r() - 0.5) * 0.5, 0, TAU); g.fill(); }
      for (let i = 0; i < 9; i++) { g.strokeStyle = `rgba(30,28,26,${0.3 + r() * 0.3})`; g.lineWidth = 0.8 + r() * 1.2; let x = 768 + r() * 256 + o, y = y0 + r() * 256; g.beginPath(); g.moveTo(x, y); for (let q = 0; q < 7; q++) { x += (r() - 0.5) * 36; y += (r() - 0.5) * 26; g.lineTo(x, y); } g.stroke(); }
      for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(${150 + r() * 40 | 0},${158 + r() * 30 | 0},${110 + r() * 30 | 0},${0.22 + r() * 0.22})`; g.beginPath(); g.arc(768 + r() * 256 + o, y0 + r() * 256, 1.5 + r() * 5, 0, TAU); g.fill(); }
      for (let y = y0 + 20; y < y0 + 256; y += 36 + r() * 26) { g.fillStyle = "rgba(24,22,20,0.22)"; g.fillRect(768, y, 256, 2); g.fillStyle = "rgba(190,184,172,0.14)"; g.fillRect(768, y + 2, 256, 2); } });
  }
  const im = g.getImageData(0, 0, W, H), d = im.data; for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * 16; d[i] = Math.max(0, Math.min(255, d[i] + n)); d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n)); d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n)); } g.putImageData(im, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t;
}
