// Midnight Burn - the bodies of the pedestrians (Upgrade 23).
// Eight kinds of person, each one a single smooth mesh built from lofted rings (so limbs are round and tapered, not boxes):
//   0 man in jeans and a shirt        1 man in office trousers and a long-sleeved shirt   2 man in a T-shirt and shorts
//   3 woman in a kurta, leggings and a dupatta   4 woman in a saree   5 woman in jeans and a top, with a ponytail and a sling bag
//   6 older man in a kurta-pyjama and a white topi        7 schoolchild in uniform with a backpack
// Every vertex carries aJ = (limb, joint, flags) so the vertex shader can walk the person with bending knees and elbows:
//   limb: 0 body, +-1 leg (left/right), +-2 arm;  joint: 1 upper limb ... 2 lower limb (1.5 = at the knee/elbow, blends the bend);
//   flags: tint class (0 fixed colour, 1 clothes tint of this person, 2 skin tone of this person) + 4 if the person wears a long skirt (shorter stride).
// The geometry is built once per kind; hundreds of people share it (instancing), so a crowd costs a handful of draw calls.
import * as THREE from "three";
import { IS_TOKYO } from "./mapId";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const HIP_Y = 0.92, KNEE_Y = 0.49, SH_Y = 1.4, EL_Y = 1.13, SH_X = 0.2; // the skeleton every kind shares (the shader pivots about these)
export const KINDS = 8;
// how common each kind is on the street
// Upgrade 56: Tokyo has no sarees or kurtas - office workers, shoppers, tourists in T-shirts and schoolchildren
export const KIND_W = IS_TOKYO ? [0.2, 0.26, 0.14, 0, 0, 0.26, 0, 0.14] : [0.15, 0.12, 0.08, 0.15, 0.12, 0.11, 0.1, 0.17];
export function pickKind(u) { let a = 0; for (let i = 0; i < KINDS; i++) { a += KIND_W[i]; if (u < a) return i; } return KINDS - 1; }
// scale of a person of this kind (children are small, women a touch shorter), as [min, max]
export const KIND_SCALE = [[0.97, 1.08], [0.97, 1.07], [0.95, 1.06], [0.92, 1.0], [0.91, 0.99], [0.92, 1.0], [0.93, 1.0], [0.6, 0.74]];

const TAU = Math.PI * 2;
const FIX = 0, CLOTH = 1, SKIN = 2;
const lin = (h) => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };

// ---- piecewise tables: [y, radius across (x), radius front-to-back (z), joint, forward shift of the ring centre] ascending in y ----
const LEG = [[0.07, 0.046, 0.05, 2, 0], [0.17, 0.052, 0.056, 2, -0.004], [0.31, 0.06, 0.066, 2, -0.01], [0.44, 0.062, 0.066, 2, -0.004], [0.49, 0.064, 0.068, 1.5, 0], [0.64, 0.076, 0.086, 1, 0.004], [0.78, 0.088, 0.098, 1, 0.004], [0.93, 0.094, 0.106, 1, 0]];
const ARM = [[0.87, 0.026, 0.026, 2, 0], [0.98, 0.036, 0.036, 2, 0], [1.07, 0.04, 0.041, 2, 0], [1.13, 0.043, 0.044, 1.5, 0], [1.3, 0.051, 0.051, 1, 0], [1.41, 0.056, 0.056, 1, 0], [1.455, 0.03, 0.03, 1, 0]];
const TORSO_M = [[0.9, 0.166, 0.108, 0, 0], [1.04, 0.154, 0.1, 0, 0], [1.16, 0.164, 0.103, 0, 0.003], [1.27, 0.19, 0.112, 0, 0.005], [1.36, 0.202, 0.108, 0, 0.002], [1.42, 0.205, 0.096, 0, 0], [1.455, 0.14, 0.082, 0, 0], [1.485, 0.062, 0.06, 0, 0]];
const TORSO_F = [[0.9, 0.172, 0.114, 0, 0], [1.03, 0.15, 0.098, 0, 0], [1.11, 0.134, 0.088, 0, 0], [1.2, 0.148, 0.098, 0, 0.004], [1.28, 0.165, 0.124, 0, 0.012], [1.36, 0.17, 0.108, 0, 0.004], [1.42, 0.173, 0.094, 0, 0], [1.455, 0.12, 0.075, 0, 0], [1.485, 0.055, 0.055, 0, 0]];
const TORSO_O = [[0.9, 0.172, 0.12, 0, 0], [1.04, 0.168, 0.135, 0, 0.012], [1.16, 0.172, 0.138, 0, 0.012], [1.27, 0.19, 0.122, 0, 0.006], [1.36, 0.2, 0.108, 0, 0], [1.42, 0.2, 0.098, 0, -0.004], [1.455, 0.14, 0.085, 0, -0.006], [1.485, 0.062, 0.062, 0, -0.008]];
const HEAD = [[1.52, 0.03, 0.045, 0, 0.02], [1.545, 0.062, 0.075, 0, 0.018], [1.58, 0.083, 0.092, 0, 0.012], [1.62, 0.095, 0.104, 0, 0.008], [1.66, 0.099, 0.108, 0, 0.005], [1.7, 0.096, 0.105, 0, 0.003], [1.74, 0.082, 0.092, 0, 0], [1.765, 0.05, 0.06, 0, 0], [1.78, 0.012, 0.016, 0, 0]];

function interp(tab, y) {
  if (y <= tab[0][0]) { const r = tab[0].slice(); r[0] = y; return r; } if (y >= tab[tab.length - 1][0]) { const r = tab[tab.length - 1].slice(); r[0] = y; return r; }
  for (let i = 0; i < tab.length - 1; i++) { const A = tab[i], B = tab[i + 1]; if (y >= A[0] && y <= B[0]) { const f = (y - A[0]) / (B[0] - A[0] || 1); const r = A.map((v, j) => v + (B[j] - v) * f); r[0] = y; return r; } }
  return tab[0].slice();
}
// rows of a table between two heights (in the order yA -> yB), with interpolated rows at the two ends
function cut(tab, yA, yB) {
  const lo = Math.min(yA, yB), hi = Math.max(yA, yB); const ys = [lo, ...tab.map((r) => r[0]).filter((y) => y > lo + 1e-4 && y < hi - 1e-4), hi]; if (yA > yB) ys.reverse();
  return ys.map((y) => interp(tab, y));
}

class Parts {
  constructor() { this.list = []; this.sx = 1; }
  // rings: [{ t, a, b, ra, rb, seg, c, gap }] (t = position along the axis, a/b = offsets across it, ra/rb = radii, c = shade, gap = front opening in radians)
  loft(rings, o) {
    const n = o.n || 8, axis = o.axis || "y", open = rings.some((r) => r.gap > 0);
    const pos = [], colr = [], aj = [], idx = []; const flags = (o.tint || 0) + (o.skirt ? 4 : 0); const base = o.color || [1, 1, 1];
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i], m = r.c === undefined ? 1 : r.c, seg = r.seg === undefined ? (o.seg || 0) : r.seg;
      for (let k = 0; k < n; k++) {
        const ang = open ? Math.PI / 2 + (r.gap || 0) + (TAU - 2 * (r.gap || 0)) * k / (n - 1) : TAU * k / n; const ca = Math.cos(ang), sa = Math.sin(ang);
        let x, y, z;
        if (axis === "y") { x = (r.a || 0) + ca * r.ra; y = r.t; z = (r.b || 0) + sa * r.rb; } else { x = (r.a || 0) + ca * r.ra; y = (r.b || 0) + sa * r.rb; z = r.t; }
        pos.push(x + (o.x || 0), y, z); colr.push(base[0] * m, base[1] * m, base[2] * m); aj.push(o.limb || 0, seg, flags);
      }
    }
    const asc = rings[rings.length - 1].t > rings[0].t, flip = axis === "y" ? asc : !asc, kmax = open ? n - 1 : n;
    for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < kmax; k++) {
      const a = i * n + k, b = i * n + (k + 1) % n, c = (i + 1) * n + (k + 1) % n, d = (i + 1) * n + k;
      if (flip) idx.push(a, c, b, a, d, c); else idx.push(a, b, c, a, c, d);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(colr, 3)); g.setAttribute("aJ", new THREE.Float32BufferAttribute(aj, 3)); g.setIndex(idx);
    g.computeVertexNormals(); this.list.push(g);
  }
  // an ellipsoid
  blob(cx, cy, cz, rx, ry, rz, o) {
    const R = o.rings || 5, rings = []; for (let i = 0; i <= R; i++) { const v = -1 + 2 * i / R, s = Math.sqrt(Math.max(0, 1 - v * v)); rings.push({ t: cy + ry * v, a: cx, b: cz, ra: Math.max(0.0008, rx * s), rb: Math.max(0.0008, rz * s) }); }
    this.loft(rings, { ...o, axis: "y", n: o.n || 8 });
  }
  // a part taken from a table: rows between y0 and y1, radii scaled by k (+pad), centred at x
  tube(tab, y0, y1, o) {
    const k = o.k || 1, pad = o.pad || 0, kz = o.kz || k;
    const rings = cut(tab, y0, y1).map((r) => ({ t: r[0], a: o.a || 0, b: (r[4] || 0) + (o.b || 0), ra: r[1] * k + pad, rb: r[2] * kz + pad, seg: r[3], c: o.shade ? o.shade(r[0]) : 1 }));
    this.loft(rings, o);
  }
  build() { return mergeGeometries(this.list); }
}

// ---- the pieces every body is made of ----
function legs(P, o) { // both legs from y0 (top) to y1 (bottom)
  for (const s of [-1, 1]) P.tube(LEG, o.y0 === undefined ? 0.93 : o.y0, o.y1 === undefined ? 0.075 : o.y1, { x: s * 0.093, k: o.k || 1, kz: o.kz, pad: o.pad || 0, color: o.color, tint: o.tint, skirt: o.skirt, limb: s, n: o.n || 7, shade: o.shade });
}
function shoes(P, o) {
  const dark = lin(o.color || 0x1a1a1e);
  for (const s of [-1, 1]) {
    const k = o.k || 1;
    if (o.sandal) { // bare foot on a thin sole, with a strap
      P.loft([{ t: -0.07, b: 0.012, ra: 0.032, rb: 0.012 }, { t: 0.0, b: 0.014, ra: 0.045, rb: 0.016 }, { t: 0.1, b: 0.016, ra: 0.046, rb: 0.018 }, { t: 0.17, b: 0.014, ra: 0.03, rb: 0.012 }, { t: 0.18, b: 0.013, ra: 0.004, rb: 0.004 }], { axis: "z", x: s * 0.093, limb: s, seg: 2, color: dark, n: 8, skirt: o.skirt });
      P.loft([{ t: -0.05, b: 0.045, ra: 0.036, rb: 0.026 }, { t: 0.04, b: 0.045, ra: 0.047, rb: 0.03 }, { t: 0.11, b: 0.035, ra: 0.044, rb: 0.022 }, { t: 0.14, b: 0.03, ra: 0.01, rb: 0.01 }], { axis: "z", x: s * 0.093, limb: s, seg: 2, tint: SKIN, n: 8, skirt: o.skirt });
    } else {
      P.loft([{ t: -0.075, b: 0.045, ra: 0.034 * k, rb: 0.04 }, { t: -0.04, b: 0.047, ra: 0.046 * k, rb: 0.05 }, { t: 0.05, b: 0.04, ra: 0.052 * k, rb: 0.044 }, { t: 0.13, b: 0.032, ra: 0.047 * k, rb: 0.03 }, { t: 0.178, b: 0.024, ra: 0.027 * k, rb: 0.018 }, { t: 0.186, b: 0.023, ra: 0.004, rb: 0.004 }], { axis: "z", x: s * 0.093, limb: s, seg: 2, color: dark, n: 7, skirt: o.skirt });
      if (o.sole) P.loft([{ t: -0.078, b: 0.008, ra: 0.036, rb: 0.01 }, { t: 0.05, b: 0.008, ra: 0.054, rb: 0.012 }, { t: 0.13, b: 0.008, ra: 0.049, rb: 0.012 }, { t: 0.185, b: 0.006, ra: 0.03, rb: 0.01 }], { axis: "z", x: s * 0.093, limb: s, seg: 2, color: lin(o.sole), n: 8, skirt: o.skirt });
    }
  }
}
function arms(P, o) { // skin arms and hands, then the sleeves
  for (const s of [-1, 1]) {
    const x = s * SH_X, limb = 2 * s, k = o.k || 1;
    P.tube(ARM, 0.87, o.sleeve ? Math.min(1.46, o.sleeve + 0.07) : 1.46, { a: 0, x, k, limb, tint: SKIN, n: 6 });
    P.blob(x, 0.81, 0.004, 0.03 * k, 0.062 * k, 0.019 * k, { limb, seg: 2, tint: SKIN, n: 7, rings: 4 });
    if (o.sleeve) P.tube(ARM, o.sleeve, 1.45, { x, k: k * 1.12, pad: 0.002, limb, tint: o.tint === undefined ? CLOTH : o.tint, color: o.color, n: 6, shade: (y) => (y > 1.36 ? 0.92 : 1) });
    if (o.cuff) P.tube(ARM, o.sleeve, o.sleeve + 0.035, { x, k: k * 1.15, pad: 0.004, limb, tint: o.tint === undefined ? CLOTH : o.tint, color: o.color, n: 6, shade: () => 0.8 });
  }
}
function head(P, o) {
  const hs = o.hs || 1, H = (y) => 1.52 + (y - 1.52) * hs; const skinP = { tint: SKIN };
  // neck
  P.tube([[1.38, 0.05, 0.054, 0, 0], [1.46, 0.047, 0.05, 0, 0.002], [1.56, 0.044, 0.048, 0, 0.012]], 1.38, 1.56, { ...skinP, n: 8 });
  const rows = HEAD.map((r) => [H(r[0]), r[1] * hs, r[2] * hs, 0, r[4] * hs]); P.tube(rows, H(1.52), H(1.78), { ...skinP, n: 10 });
  // ears, nose, eyes
  for (const s of [-1, 1]) { P.blob(s * 0.097 * hs, H(1.635), -0.004 * hs, 0.009 * hs, 0.03 * hs, 0.02 * hs, { ...skinP, n: 6, rings: 3 }); P.blob(s * 0.037 * hs, H(1.645), 0.098 * hs, 0.011 * hs, 0.0075 * hs, 0.01 * hs, { color: [0.015, 0.012, 0.01], n: 5, rings: 2 }); }
  P.loft([{ t: 0.1 * hs, b: H(1.628), ra: 0.016 * hs, rb: 0.026 * hs }, { t: 0.12 * hs, b: H(1.617), ra: 0.013 * hs, rb: 0.02 * hs }, { t: 0.134 * hs, b: H(1.608), ra: 0.008 * hs, rb: 0.01 * hs }, { t: 0.138 * hs, b: H(1.606), ra: 0.002, rb: 0.002 }], { axis: "z", ...skinP, n: 6 });
  // lips
  P.blob(0, H(1.575), 0.1 * hs, 0.026 * hs, 0.007 * hs, 0.01 * hs, { color: [0.4, 0.14, 0.12], n: 6, rings: 3 });
  // hair
  const hair = lin(o.hair || 0x0c0907), hairRows = (ys, gaps, pad) => ys.map((y, i) => { const r = interp(HEAD, y); return { t: H(y), a: 0, b: r[4] * hs - 0.004 * hs, ra: r[1] * hs + pad, rb: r[2] * hs + pad, gap: gaps[i], c: 0.9 + 0.1 * (i / ys.length) }; });
  if (o.hairKind !== "bald") {
    const top = o.hairKind === "short" || o.hairKind === "grey" ? [1.6, 1.65, 1.7, 1.74, 1.765, 1.785] : [1.58, 1.63, 1.69, 1.735, 1.765, 1.785];
    P.loft(hairRows(top, o.hairKind === "grey" ? [1.5, 1.4, 1.2, 0.8, 0.3, 0] : [1.15, 0.95, 0.7, 0.35, 0, 0], 0.007 * hs), { color: hair, n: 10 });
  }
  if (o.hairKind === "long" || o.hairKind === "plait") { // hair hanging down the back
    const rr = []; for (let i = 0; i <= 6; i++) { const y = 1.7 - 0.5 * i / 6; rr.push({ t: y, a: 0, b: -0.1 - 0.01 * i, ra: (0.092 - 0.02 * (i / 6)) * hs, rb: 0.03 - 0.012 * (i / 6), c: 1 }); }
    if (o.hairKind === "long") P.loft(rr, { color: hair, n: 8 });
    else { P.loft(rr.slice(0, 3), { color: hair, n: 8 }); const pl = []; for (let i = 0; i <= 8; i++) { const y = 1.62 - 0.62 * i / 8; pl.push({ t: y, a: 0, b: -0.12 - 0.02 * i / 8, ra: 0.03 - 0.014 * (i / 8), rb: 0.03 - 0.014 * (i / 8), c: 0.9 + 0.1 * (i % 2) }); } P.loft(pl, { color: hair, n: 6 }); }
  }
  if (o.hairKind === "pony") { const pl = []; for (let i = 0; i <= 7; i++) { const t = i / 7; pl.push({ t: 1.73 - 0.24 * t, a: 0, b: -0.095 - 0.2 * t, ra: 0.032 * (1 - 0.35 * t), rb: 0.03 * (1 - 0.35 * t) }); } P.loft(pl, { color: hair, n: 6 }); }
  if (o.hairKind === "bun") P.blob(0, H(1.7), -0.125 * hs, 0.05 * hs, 0.045 * hs, 0.045 * hs, { color: hair, n: 8, rings: 4 });
  if (o.moustache) P.blob(0, H(1.59), 0.103 * hs, 0.034 * hs, 0.0085 * hs, 0.012 * hs, { color: lin(o.mouColor || 0x0c0907), n: 6, rings: 3 });
  if (o.topi) { // a white Gandhi cap
    const rows2 = [1.7, 1.72, 1.75, 1.77, 1.785].map((y, i) => { const r = interp(HEAD, y); return { t: y, a: 0, b: r[4] - 0.006, ra: r[1] + 0.012 - i * 0.002, rb: r[2] + 0.012 - i * 0.002, c: 1 }; });
    rows2.push({ t: 1.79, a: 0, b: -0.01, ra: 0.012, rb: 0.012 }); P.loft(rows2, { color: lin(0xf3f1ea), n: 10 });
  }
}
// the torso in a garment: rows of a table between y0 and y1, a little larger than the body
function garment(P, tab, y0, y1, o) { P.tube(tab, y0, y1, { k: o.k || 1.012, kz: o.kz, pad: o.pad || 0.002, color: o.color, tint: o.tint === undefined ? CLOTH : o.tint, n: 10, shade: o.shade }); }

// ---- the eight kinds ----
const SKIRT = { k: 1 };
export function buildKind(kind) {
  const P = new Parts(); const dark = lin(0x25262c);
  const belt = (tab) => P.tube(tab, 0.955, 1.0, { k: 1.03, kz: 1.03, pad: 0.004, color: lin(0x1b1613), n: 10 });
  if (kind === 0) { // man in jeans and a shirt with rolled sleeves
    legs(P, { y0: 0.95, k: 0.97, color: lin(0x2d4268), n: 7, shade: (y) => (y < 0.2 ? 0.8 : 0.93 + 0.07 * Math.sin(y * 14)) });
    P.tube(TORSO_M, 0.86, 0.97, { k: 1.0, pad: 0.001, color: lin(0x2d4268), n: 10 }); belt(TORSO_M);
    garment(P, TORSO_M, 0.96, 1.485, { shade: (y) => (y > 1.45 ? 0.75 : 1) }); arms(P, { sleeve: 1.0, cuff: true });
    head(P, { hair: 0x0b0806, hairKind: "short", moustache: true }); shoes(P, { color: 0xe6e4de, sole: 0x8f8d86 });
  } else if (kind === 1) { // man in office trousers and a long-sleeved shirt, tucked in
    legs(P, { y0: 0.95, k: 1.03, color: lin(0x2b2d34), n: 7, shade: (y) => 0.95 + 0.05 * Math.sin(y * 9) });
    P.tube(TORSO_M, 0.86, 0.97, { k: 1.0, pad: 0.001, color: lin(0x2b2d34), n: 10 }); belt(TORSO_M);
    garment(P, TORSO_M, 0.96, 1.485, { shade: (y) => (y > 1.45 ? 0.7 : 1) }); arms(P, { sleeve: 0.89, cuff: true });
    head(P, { hair: 0x0a0807, hairKind: "short", moustache: true }); shoes(P, { color: 0x15110f });
  } else if (kind === 2) { // man in a T-shirt and shorts
    legs(P, { y0: 0.95, y1: 0.54, k: 1.06, color: lin(0xa89a7c), n: 7 }); // shorts
    legs(P, { y0: 0.545, y1: 0.075, k: 0.97, tint: SKIN, n: 8 });
    P.tube(TORSO_M, 0.86, 0.97, { k: 1.0, pad: 0.001, color: lin(0xa89a7c), n: 10 });
    garment(P, TORSO_M, 0.93, 1.485, { k: 1.016, shade: (y) => (y > 1.45 ? 0.75 : y < 1.0 ? 0.92 : 1) }); arms(P, { sleeve: 1.27 });
    head(P, { hair: 0x0d0a08, hairKind: "short" }); shoes(P, { color: 0x34343c, sole: 0xe8e8e8 });
  } else if (kind === 3) { // woman in a kurta over leggings, with a dupatta
    legs(P, { y0: 0.95, k: 0.9, tint: CLOTH, color: [0.5, 0.5, 0.5], skirt: true, n: 7 });
    P.tube(TORSO_F, 0.86, 1.05, { k: 1.0, color: [0.45, 0.45, 0.45], tint: CLOTH, skirt: true, n: 10 });
    // the kurta: fitted to the chest and flaring to the knee
    const kur = [[0.6, 0.205, 0.145, 0, 0], [0.8, 0.188, 0.13, 0, 0], ...TORSO_F.slice(2)].map((r, i) => (i < 2 ? r : r));
    P.tube(kur, 0.6, 1.485, { k: 1.014, kz: 1.014, pad: 0.002, tint: CLOTH, n: 10, shade: (y) => (y > 1.45 ? 0.8 : y < 0.66 ? 0.82 : 1), skirt: false });
    arms(P, { sleeve: 1.02, k: 0.9, cuff: true });
    // dupatta: a collar round the neck and two ends hanging in front
    P.tube([[1.4, 0.15, 0.115, 0, 0.005], [1.46, 0.105, 0.085, 0, 0.005]], 1.4, 1.465, { k: 1, tint: CLOTH, color: [1.25, 1.25, 1.25], n: 10 });
    for (const s of [-1, 1]) { const rr = []; for (let i = 0; i <= 7; i++) { const y = 1.44 - 0.5 * i / 7; rr.push({ t: y, a: s * (0.07 + 0.02 * i / 7), b: 0.115 + 0.012 * i / 7, ra: 0.045, rb: 0.012, c: 1.2 - 0.12 * (i % 2) }); } P.loft(rr, { tint: CLOTH, color: [1.15, 1.15, 1.15], n: 6 }); }
    head(P, { hair: 0x0a0706, hairKind: "plait" }); shoes(P, { sandal: true, skirt: true, color: 0x3a2a1f });
  } else if (kind === 4) { // woman in a saree
    // the legs are hidden under the saree: only the feet show, walking in short steps
    legs(P, { y0: 0.2, y1: 0.075, k: 0.9, tint: SKIN, skirt: true, n: 8 });
    P.tube(TORSO_F, 0.86, 1.2, { k: 1.0, tint: SKIN, n: 10 });                       // bare midriff
    const sa = [[0.07, 0.17, 0.14, 0, 0], [0.3, 0.205, 0.158, 0, 0], [0.6, 0.2, 0.15, 0, 0], [0.85, 0.185, 0.128, 0, 0], [1.0, 0.162, 0.112, 0, 0], [1.1, 0.142, 0.095, 0, 0], [1.2, 0.15, 0.1, 0, 0.004]];
    P.tube(sa, 0.07, 1.14, { tint: CLOTH, n: 10, shade: (y) => (y < 0.12 ? 0.6 : 0.95 + 0.06 * Math.sin(y * 22)) });
    P.tube(TORSO_F, 1.17, 1.485, { k: 1.014, pad: 0.002, tint: CLOTH, color: [0.5, 0.5, 0.5], n: 10, shade: (y) => (y > 1.45 ? 0.8 : 1) }); // the blouse
    arms(P, { sleeve: 1.27, k: 0.9, tint: CLOTH, color: [0.5, 0.5, 0.5] });
    // the pallu: a drape over the shoulder and down the back
    P.loft([{ t: 1.47, a: 0, b: -0.012, ra: 0.185, rb: 0.115, gap: 0.5 }, { t: 1.35, a: 0, b: -0.01, ra: 0.185, rb: 0.12, gap: 0.45 }, { t: 1.1, a: 0, b: -0.02, ra: 0.19, rb: 0.14, gap: 0.8 }, { t: 0.8, a: 0, b: -0.03, ra: 0.2, rb: 0.16, gap: 1.2 }, { t: 0.62, a: 0, b: -0.035, ra: 0.2, rb: 0.165, gap: 1.35 }], { tint: CLOTH, color: [1.3, 1.3, 1.3], n: 14 });
    head(P, { hair: 0x0b0807, hairKind: "bun" }); shoes(P, { sandal: true, skirt: true, color: 0x2a2018, k: 1 });
  } else if (kind === 5) { // woman in jeans and a fitted top, ponytail and a sling bag
    legs(P, { y0: 0.95, k: 0.9, color: lin(0x3b5886), n: 7, shade: (y) => (y < 0.2 ? 0.8 : 1) });
    P.tube(TORSO_F, 0.86, 1.05, { k: 1.0, color: lin(0x3b5886), n: 10 });
    garment(P, TORSO_F, 1.0, 1.485, { k: 1.016, shade: (y) => (y > 1.45 ? 0.8 : 1) }); arms(P, { sleeve: 1.24, k: 0.9 });
    // the strap runs from the right shoulder across the chest to a bag on the left hip
    P.loft([{ t: 1.44, a: 0.1, b: 0.045, ra: 0.012, rb: 0.012 }, { t: 1.2, a: 0, b: 0.125, ra: 0.012, rb: 0.012 }, { t: 1.0, a: -0.12, b: 0.1, ra: 0.012, rb: 0.012 }], { color: lin(0x3b2a1e), n: 5 });
    P.blob(-0.2, 0.9, 0.02, 0.05, 0.075, 0.11, { color: lin(0x4a3322), n: 8, rings: 4 });
    head(P, { hair: 0x1a0f0a, hairKind: "pony" }); shoes(P, { color: 0xe8e2e0, sole: 0xb7b2ae, k: 0.92 });
  } else if (kind === 6) { // older man: long kurta over loose pyjama, white topi
    legs(P, { y0: 0.95, k: 1.08, color: lin(0xcfc9bb), skirt: true, n: 7, shade: (y) => 0.92 + 0.08 * Math.sin(y * 11) });
    const ku = [[0.55, 0.215, 0.165, 0, 0.004], [0.8, 0.2, 0.15, 0, 0.01], ...TORSO_O.slice(2)];
    P.tube(TORSO_O, 0.86, 1.05, { k: 1.0, color: lin(0xcfc9bb), n: 10 });
    P.tube(ku, 0.55, 1.485, { k: 1.014, kz: 1.014, pad: 0.003, tint: CLOTH, n: 10, shade: (y) => (y > 1.45 ? 0.82 : y < 0.6 ? 0.85 : 1) });
    arms(P, { sleeve: 0.9, cuff: true });
    head(P, { hair: 0xb9b6b0, hairKind: "grey", moustache: true, mouColor: 0xb9b6b0, topi: true }); shoes(P, { sandal: true, skirt: true, color: 0x3a2a1c });
  } else { // schoolchild: white shirt, navy shorts, backpack. Built at the adult skeleton and shrunk by the instance scale; the head is kept large.
    legs(P, { y0: 0.95, y1: 0.58, k: 1.06, color: lin(0x1c2756), n: 8 });
    legs(P, { y0: 0.585, y1: 0.075, k: 0.96, tint: SKIN, n: 8 });
    // socks
    legs(P, { y0: 0.3, y1: 0.075, k: 1.0, pad: 0.003, color: lin(0xf0f0f0), n: 8 });
    P.tube(TORSO_M, 0.86, 0.97, { k: 1.0, color: lin(0x1c2756), n: 10 });
    garment(P, TORSO_M, 0.94, 1.485, { k: 1.02, color: lin(0xf4f4f0), tint: FIX, shade: (y) => (y > 1.45 ? 0.8 : 1) }); arms(P, { sleeve: 1.26, color: lin(0xf4f4f0), tint: FIX, k: 1.04 });
    // backpack
    P.loft([{ t: 0.98, a: 0, b: -0.15, ra: 0.12, rb: 0.05 }, { t: 1.1, a: 0, b: -0.16, ra: 0.145, rb: 0.07 }, { t: 1.3, a: 0, b: -0.16, ra: 0.145, rb: 0.07 }, { t: 1.42, a: 0, b: -0.15, ra: 0.1, rb: 0.05 }, { t: 1.44, a: 0, b: -0.15, ra: 0.02, rb: 0.01 }], { tint: CLOTH, color: [1.1, 1.1, 1.1], n: 10 });
    head(P, { hair: 0x0a0807, hairKind: "short", hs: 1.3 }); shoes(P, { color: 0x15110f, k: 1.0 });
  }
  return P.build();
}

// ---- the material: one for everybody; the shader walks them ----
export function makePeopleMaterial() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = { value: 0 }; mat.userData.sh = sh;
    sh.vertexShader = `attribute vec3 aJ; attribute vec3 aPA; attribute vec3 aSkinC; uniform float uTime; varying float vSk;
      vec2 rot2(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(v.x * c - v.y * s, v.x * s + v.y * c); }
    ` + sh.vertexShader
      .replace("#include <color_vertex>", `
        float flg = aJ.z; float skirtF = step(3.5, flg); float tn = flg - 4.0 * skirtF; vSk = step(1.5, tn);
        vColor = vec3(1.0);
        #ifdef USE_COLOR
          vColor *= color;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vColor *= (tn < 0.5 ? vec3(1.0) : (tn < 1.5 ? instanceColor.xyz : aSkinC));
        #endif
      `)
      .replace("#include <begin_vertex>", `
        vec3 transformed = vec3(position);
        float amp = aPA.y, up = aPA.z;
        float ph = uTime * 7.0 * (0.6 + amp * 0.4) + aPA.x;
        float sw = sin(ph), cw = cos(ph);
        float limb = aJ.x, jt = aJ.y; float la = abs(limb);
        float stride = 1.0 - 0.5 * skirtF;
        if (la > 0.5 && la < 1.5) { // a leg: swings from the hip, the shin folds back at the knee while the leg is moving forward
          float side = limb; float h = side * sw * 0.55 * amp * stride;
          float kn = 0.95 * max(0.0, -side * cw) * amp * stride * clamp(jt - 1.0, 0.0, 1.0);
          vec3 p = transformed;
          p.y -= ${KNEE_Y.toFixed(3)}; p.yz = rot2(p.yz, kn); p.y += ${KNEE_Y.toFixed(3)};
          p.y -= ${HIP_Y.toFixed(3)}; p.yz = rot2(p.yz, h); p.y += ${HIP_Y.toFixed(3)};
          transformed = p;
        } else if (la > 1.5) { // an arm: swings against the leg on its side, the forearm folds forward; both arms rise when dancing or cheering
          float side = sign(limb); float a = -side * sw * 0.5 * amp * (1.0 - up);
          float el = -(0.12 + 0.6 * max(0.0, -a * 1.6)) * (1.0 - up * 0.6) * clamp(jt - 1.0, 0.0, 1.0);
          vec3 p = transformed;
          p.y -= ${EL_Y.toFixed(3)}; p.yz = rot2(p.yz, el); p.y += ${EL_Y.toFixed(3)};
          p.y -= ${SH_Y.toFixed(3)}; p.yz = rot2(p.yz, a);
          float b = side * up * (2.35 + sin(uTime * 6.0 + aPA.x) * 0.3);
          p.x -= side * ${SH_X.toFixed(3)}; p.xy = rot2(p.xy, b); p.x += side * ${SH_X.toFixed(3)}; p.y += ${SH_Y.toFixed(3)};
          transformed = p;
        }
        // shoulders and chest turn against the hips, and the whole body bobs a little with each step
        if (la < 0.5 || la > 1.5) { float wgt = la > 1.5 ? 1.0 : smoothstep(0.9, 1.25, position.y); transformed.xz = rot2(transformed.xz, sw * 0.09 * amp * wgt); }
        transformed.y += abs(sw) * 0.022 * amp;
      `);
    sh.fragmentShader = "varying float vSk;\n" + sh.fragmentShader
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n roughnessFactor = mix(roughnessFactor, 0.58, vSk);")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance += vSk * vColor * 0.14;");
  };
  return mat;
}
