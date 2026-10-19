// Midnight Burn — the plants themselves: pines, cypresses, mango / neem / rain / gulmohar / banyan / teak crowns, coconut, royal and areca
// palms, flowering bushes, ferns, grass and boulders. Every plant is a handful of painted cards (see vegTex.js) around real tapered
// trunks, with the light baked in: crowns are dark inside and bright at the tips, tree tops catch the moon, and anything near a street
// lamp picks up its warm glow. Cards sway in the wind (a vertex-shader wobble) so the whole forest breathes.
import * as THREE from "three";
import { mulberry } from "./geo";
import { CELL, cellUV, BARK, foliageAtlas, barkAtlas } from "./vegTex";
import { K } from "./vegKinds";

const TAU = Math.PI * 2;
export { K, TRUNK } from "./vegKinds";

// ---- geometry builder with a wind-sway weight and a bark-column tile per vertex -------------------------------------------------------------------------
export class VB {
  constructor() { this.p = []; this.n = []; this.c = []; this.uv = []; this.s = []; this.t = []; this.i = []; }
  v(x, y, z, nx, ny, nz, r, g, b, u, w, sw = 0, tile = 0) { const k = this.p.length / 3; this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(r, g, b); this.uv.push(u, w); this.s.push(sw); this.t.push(tile); return k; }
  get empty() { return this.i.length === 0; }
  get tris() { return this.i.length / 3; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("aSway", new THREE.Float32BufferAttribute(this.s, 1)); g.setAttribute("aTile", new THREE.Float32BufferAttribute(this.t, 1));
    g.setIndex(this.p.length / 3 > 65000 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere(); return g;
  }
}

// ---- materials ------------------------------------------------------------------------------------------------------------------------------------
const timeU = { value: 0 };
export const setWindTime = (t) => { timeU.value = t; };
// three flips a back face's normal; for leaf cards (lit by outward-pointing normals) we want both faces lit the same way
const FRONT_NORMAL = THREE.ShaderChunk.normal_fragment_begin.replace("gl_FrontFacing ? 1.0 : - 1.0", "1.0");
function swayPatch(shader) {
  shader.uniforms.uTime = timeU;
  shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nattribute float aSway; attribute float aTile; varying float vTile; uniform float uTime;")
    .replace("#include <begin_vertex>", `#include <begin_vertex>
      vTile = aTile;
      #ifdef USE_INSTANCING
        vec2 ip = instanceMatrix[3].xz;
      #else
        vec2 ip = vec2(0.0);
      #endif
      float ph = (position.x + ip.x) * 0.31 + (position.z + ip.y) * 0.27;
      float w1 = sin(uTime * 1.35 + ph), w2 = sin(uTime * 2.3 + ph * 1.7 + 1.3);
      transformed.x += (w1 * 0.72 + w2 * 0.28) * aSway * 0.12;
      transformed.z += (cos(uTime * 1.12 + ph * 0.8) * 0.7 + w2 * 0.3) * aSway * 0.1;
      transformed.y += sin(uTime * 1.9 + ph * 1.9) * aSway * 0.025;`);
}
export function vegMaterials() {
  const atlas = foliageAtlas(), bark = barkAtlas();
  const leafMat = () => {
    const m = new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, metalness: 0 });
    m.onBeforeCompile = (sh) => { swayPatch(sh); sh.fragmentShader = sh.fragmentShader.replace("#include <normal_fragment_begin>", FRONT_NORMAL).replace("#include <common>", "#include <common>\nvarying float vTile;"); };
    m.customProgramCacheKey = () => "mbleaf"; return m;
  };
  const barkM = new THREE.MeshStandardMaterial({ map: bark, vertexColors: true, roughness: 0.94, metalness: 0 });
  barkM.onBeforeCompile = (sh) => {
    swayPatch(sh);
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vTile;").replace("#include <map_fragment>", `
      #ifdef USE_MAP
        vec2 gq = vMapUv;
        vec2 loc = vec2(fract(gq.x) * 0.976 + 0.012, fract(gq.y) * 0.98 + 0.01);
        vec2 tuv = vec2((floor(vTile + 0.5) + loc.x) * 0.25, loc.y);
        vec2 dxx = vec2(dFdx(gq.x) * 0.244, dFdx(gq.y) * 0.98), dyy = vec2(dFdy(gq.x) * 0.244, dFdy(gq.y) * 0.98);
        diffuseColor *= textureGrad(map, tuv, dxx, dyy);
      #endif`);
  };
  barkM.customProgramCacheKey = () => "mbbark";
  return { foliage: leafMat(), cover: leafMat(), bark: barkM, atlas, barkTex: bark };
}

// ---- small maths -----------------------------------------------------------------------------------------------------------------------------------
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const nrm = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
const hs = (x, y, z, s) => { let h = (Math.imul(Math.floor(x) | 0, 374761393) + Math.imul(Math.floor(y) | 0, 668265263) + Math.imul(Math.floor(z) | 0, 1274126177) + Math.imul(s | 0, 982451653)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const vn3 = (x, y, z, s) => { // 3D value noise
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz; const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const L = (a, b, t) => a + (b - a) * t;
  return L(L(L(hs(ix, iy, iz, s), hs(ix + 1, iy, iz, s), u), L(hs(ix, iy + 1, iz, s), hs(ix + 1, iy + 1, iz, s), u), v), L(L(hs(ix, iy, iz + 1, s), hs(ix + 1, iy, iz + 1, s), u), L(hs(ix, iy + 1, iz + 1, s), hs(ix + 1, iy + 1, iz + 1, s), u), v), w);
};

// ---- per-plant context: the random stream and the street lamps close enough to light it -----------------------------------------------------------------
const ctx = { rnd: Math.random, near: [], lod: 1, lampGain: 2.3 };
// three levels of detail: 0 = near the car, 1 = middle distance, 2 = far. Plants are built once per level and instanced, so a forest costs memory for a few dozen shapes, not thousands
const lvOf = (lod) => (lod > 0.8 ? 0 : lod > 0.45 ? 1 : 2);
// colour of a vertex: tint x ambient-occlusion, plus the warm light of the one or two nearest street lamps
function vtx(vb, x, y, z, n, col, ao, u, w, sw = 0, tile = 0) {
  let r = col[0] * ao, g = col[1] * ao, b = col[2] * ao;
  for (const L of ctx.near) {
    const dx = L.x - x, dy = L.y - y, dz = L.z - z, d2 = dx * dx + dy * dy + dz * dz; if (d2 > 400) continue; const d = Math.sqrt(d2), f = 1 - d / 20;
    const nd = Math.max(0.2, (n[0] * dx + n[1] * dy + n[2] * dz) / (d || 1)); const k = f * f * nd * ctx.lampGain;
    r += col[0] * k * L.r; g += col[1] * k * L.g; b += col[2] * k * L.b;
  }
  return vb.v(x, y, z, n[0], n[1], n[2], r, g, b, u, w, sw, tile);
}
// one painted quad: corners P (counter-clockwise, base-left first), uv rectangle, per-corner normal / ao / sway
function quad(vb, P, uvr, N, col, ao, sw) {
  const U = [uvr[0], uvr[1], uvr[2], uvr[1], uvr[2], uvr[3], uvr[0], uvr[3]], k = [];
  for (let q = 0; q < 4; q++) k.push(vtx(vb, P[q][0], P[q][1], P[q][2], N[q], col, ao[q], U[q * 2], U[q * 2 + 1], sw[q]));
  vb.i.push(k[0], k[1], k[2], k[0], k[2], k[3]);
}
const tintOf = (t, rnd, a = 0.14) => [t[0] * (1 - a / 2 + rnd() * a), t[1] * (1 - a / 2 + rnd() * a), t[2] * (1 - a / 2 + rnd() * a * 0.8)];

// tapered trunk along a path: ring of `sides` vertices at every point, bark tile `col`, u runs round the trunk, v along it (a bark tile is 4 circumferences tall)
function tube(bb, pts, radii, sides, col, tint, swayTop = 0) {
  const n = pts.length; let len = 0; const cum = [0];
  for (let i = 1; i < n; i++) { len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); cum.push(len); }
  const circ = TAU * radii[0], base = bb.p.length / 3; const rings = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; const T = nrm(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const ref = Math.abs(T[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]; const N = nrm(T[1] * ref[2] - T[2] * ref[1], T[2] * ref[0] - T[0] * ref[2], T[0] * ref[1] - T[1] * ref[0]);
    const B = [T[1] * N[2] - T[2] * N[1], T[2] * N[0] - T[0] * N[2], T[0] * N[1] - T[1] * N[0]];
    const ao = 0.62 + 0.38 * (i / (n - 1)), sw = swayTop * (i / (n - 1)) ** 2; const row = [];
    for (let s = 0; s <= sides; s++) {
      const th = (s / sides) * TAU, c = Math.cos(th), sn = Math.sin(th); const dir = [N[0] * c + B[0] * sn, N[1] * c + B[1] * sn, N[2] * c + B[2] * sn];
      row.push(vtx(bb, pts[i][0] + dir[0] * radii[i], pts[i][1] + dir[1] * radii[i], pts[i][2] + dir[2] * radii[i], dir, tint, ao, (s / sides) * 0.998 + 0.001, cum[i] / (4 * circ), sw, col));
    }
    rings.push(row);
  }
  for (let i = 0; i < n - 1; i++) for (let s = 0; s < sides; s++) { const a = rings[i][s], b = rings[i][s + 1], c = rings[i + 1][s + 1], d = rings[i + 1][s]; bb.i.push(a, b, c, a, c, d); }
}

// a small faceted ball (coconuts, banyan knuckles)
const ICO = new THREE.IcosahedronGeometry(1, 0);
function ball(bb, cx, cy, cz, r, tint, tile = 0) {
  const pos = ICO.attributes.position, base = bb.p.length / 3;
  for (let k = 0; k < pos.count; k += 3) {
    const f = []; for (let q = 0; q < 3; q++) f.push([pos.getX(k + q), pos.getY(k + q), pos.getZ(k + q)]);
    const n = nrm(f[0][0] + f[1][0] + f[2][0], f[0][1] + f[1][1] + f[2][1], f[0][2] + f[1][2] + f[2][2]);
    const ids = f.map((p, q) => vtx(bb, cx + p[0] * r, cy + p[1] * r, cz + p[2] * r, n, tint, 0.8, 0.2 + q * 0.2, 0.5 + p[1] * 0.2, 0, tile));
    bb.i.push(ids[0], ids[1], ids[2]);
  }
}

// ---- trees -----------------------------------------------------------------------------------------------------------------------------------------
const crownAO = (p, c, R) => { const rr = Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) / R; return clamp(0.34 + 0.8 * Math.pow(clamp(rr, 0, 1), 0.85) + 0.24 * clamp((p[1] - c[1]) / R, -1, 1), 0.3, 1.3); };
const BROAD = {
  [K.DOME]: { trunkH: 2.6, trunkR: 0.34, crownR: 4.8, crownH: 3.4, blobs: 15, per: 8, size: 2.9, cells: [CELL.leafA, CELL.leafB, CELL.leafA], tint: [0.8, 1.0, 0.72], limbs: 3, bark: [1, 0.92, 0.86] },
  [K.UMBRELLA]: { trunkH: 5.4, trunkR: 0.5, crownR: 8.6, crownH: 2.4, blobs: 20, per: 8, size: 3.2, cells: [CELL.pinnate, CELL.leafA, CELL.pinnate], tint: [0.92, 1.06, 0.76], limbs: 4, bark: [0.95, 0.9, 0.84] },
  [K.GULMOHAR]: { trunkH: 3.8, trunkR: 0.36, crownR: 6.2, crownH: 2.4, blobs: 16, per: 8, size: 3.0, cells: [CELL.gulmohar, CELL.gulmohar, CELL.pinnate], tint: [1, 1, 1], limbs: 3, bark: [1, 0.9, 0.82] },
  [K.TEAK]: { trunkH: 9, trunkR: 0.4, crownR: 4.6, crownH: 4.8, blobs: 14, per: 8, size: 2.9, cells: [CELL.leafA, CELL.leafC, CELL.leafB], tint: [0.72, 0.92, 0.64], limbs: 3, bark: [0.9, 0.88, 0.84] },
  [K.BANYAN]: { trunkH: 3.6, trunkR: 0.95, crownR: 9.8, crownH: 4.0, blobs: 22, per: 8, size: 3.3, cells: [CELL.leafC, CELL.leafA, CELL.leafC], tint: [0.7, 0.96, 0.7], limbs: 5, roots: 8, bark: [0.82, 0.8, 0.76] },
  [K.PEEPAL]: { trunkH: 3.2, trunkR: 0.42, crownR: 5.4, crownH: 3.8, blobs: 15, per: 8, size: 2.9, cells: [CELL.leafC, CELL.leafC, CELL.leafA], tint: [0.86, 1.02, 0.76], limbs: 3, bark: [1, 0.95, 0.9] },
};
function broadleaf(vb, bb, x, y, z, s, o) {
  const rnd = ctx.rnd, lod = ctx.lod; const trunkH = o.trunkH * s, crownR = o.crownR * s, crownH = o.crownH * s;
  const cy = y + trunkH + crownH * 0.55, C = [x, cy, z], CR = Math.max(crownR, crownH) * 1.05;
  // trunk with a slight bend and a flared foot, forking into limbs that reach the heart of each clump
  const LV = lvOf(lod); const lean = [(rnd() - 0.5) * 0.9 * s, (rnd() - 0.5) * 0.9 * s]; const r0 = o.trunkR * s, sides = [8, 6, 4][LV], NT = [4, 3, 2][LV];
  const tp = [], tr = []; for (let i = 0; i <= NT; i++) { const t = i / NT; tp.push([x + lean[0] * t * t + Math.sin(t * 3 + s) * 0.12 * s, y - 0.12 + trunkH * t, z + lean[1] * t * t]); tr.push(r0 * (1 - 0.34 * t) * (i === 0 ? 1.35 : 1)); }
  tube(bb, tp, tr, sides, BARK.broad, o.bark, 0.1);
  const fork = tp[NT]; const nl = LV === 2 ? 0 : Math.max(2, Math.round(o.limbs * (LV === 0 ? 1 : 0.7)));
  for (let l = 0; l < nl; l++) {
    const a = (l / nl) * TAU + rnd() * 0.9, rr = crownR * (0.34 + rnd() * 0.2), ty = cy + crownH * (0.05 + rnd() * 0.3); const tg = [x + Math.cos(a) * rr, ty, z + Math.sin(a) * rr];
    const mid = [(fork[0] + tg[0]) / 2 + (rnd() - 0.5) * 0.5, (fork[1] + tg[1]) / 2 - 0.2, (fork[2] + tg[2]) / 2 + (rnd() - 0.5) * 0.5];
    tube(bb, [fork, mid, tg], [tr[NT] * 0.8, tr[NT] * 0.5, 0.05 * s + 0.03], 5, BARK.broad, o.bark, 0.3);
  }
  // clumps of leaf cards arranged on a dome, hollow in the middle so the inside of the crown is shadowed
  const nb = Math.max(4, Math.round(o.blobs * [0.9, 0.55, 0.32][LV])), per = Math.max(3, Math.round(o.per * [0.75, 0.55, 0.42][LV])), cardK = [1.12, 1.35, 1.75][LV];
  for (let b = 0; b < nb; b++) {
    const u = (b + 0.5) / nb, rho = crownR * (0.28 + 0.66 * Math.sqrt(u)), a = b * 2.399 + rnd() * 0.6;
    const edge = rho / (crownR * 1.05), hy = cy + crownH * ((rnd() - 0.5) * 0.9 * Math.sqrt(Math.max(0.05, 1 - edge * edge)) + 0.25 * (1 - edge));
    const bc = [x + Math.cos(a) * rho, hy, z + Math.sin(a) * rho], br = Math.max(1.3 * s, crownR * (0.26 + rnd() * 0.1));
    for (let q = 0; q < per; q++) {
      const d = nrm(rnd() - 0.5, (rnd() - 0.5) * 0.9, rnd() - 0.5), rr2 = br * Math.cbrt(rnd()); const p = [bc[0] + d[0] * rr2, bc[1] + d[1] * rr2, bc[2] + d[2] * rr2];
      const az = rnd() * TAU, tl = (rnd() - 0.5) * 1.3, half = o.size * s * cardK * (0.8 + rnd() * 0.45) / 2;
      const ux = Math.cos(az) * half, uz = Math.sin(az) * half, vx = -Math.sin(az) * Math.sin(tl) * half, vy = Math.cos(tl) * half, vz = Math.cos(az) * Math.sin(tl) * half;
      const P = [[p[0] - ux - vx, p[1] - vy, p[2] - uz - vz], [p[0] + ux - vx, p[1] - vy, p[2] + uz - vz], [p[0] + ux + vx, p[1] + vy, p[2] + uz + vz], [p[0] - ux + vx, p[1] + vy, p[2] - uz + vz]];
      const cell = o.cells[(rnd() * o.cells.length) | 0], col = tintOf(o.tint, rnd, 0.22);
      const N = P.map((c) => nrm(c[0] - C[0], c[1] - C[1] + CR * 0.35, c[2] - C[2])), ao = P.map((c) => crownAO(c, C, CR)), sw = P.map((c) => 0.5 + 0.5 * clamp((c[1] - y) / (trunkH + crownH * 2), 0, 1));
      quad(vb, P, cellUV(cell), N, col, ao, sw);
    }
  }
  if (LV === 0) for (let q = 0; q < 5; q++) { // a skirt of hanging sprigs round the lower edge breaks the flat underside
    const a = q * TAU / 5 + rnd() * 0.6, rho = crownR * (0.55 + rnd() * 0.4), px = x + Math.cos(a) * rho, pz = z + Math.sin(a) * rho, py = cy - crownH * (0.1 + rnd() * 0.35), half = o.size * s * 0.45;
    const ux = -Math.sin(a) * half, uz = Math.cos(a) * half; const P = [[px - ux, py - half * 1.5, pz - uz], [px + ux, py - half * 1.5, pz + uz], [px + ux, py + half * 0.6, pz + uz], [px - ux, py + half * 0.6, pz - uz]];
    quad(vb, P, cellUV(CELL.leafB), P.map((c) => nrm(c[0] - C[0], c[1] - C[1] - CR * 0.1, c[2] - C[2])), tintOf(o.tint, rnd, 0.22), P.map((c) => crownAO(c, C, CR) * 0.85), [0.8, 0.8, 0.5, 0.5]);
  }
  if (o.roots && LV === 0) for (let r = 0; r < o.roots; r++) { // banyan prop roots hanging from the limbs
    const a = rnd() * TAU, rr = crownR * (0.5 + rnd() * 0.35), top = [x + Math.cos(a) * rr, cy - crownH * 0.1, z + Math.sin(a) * rr], bot = [top[0] + (rnd() - 0.5) * 0.4, y, top[2] + (rnd() - 0.5) * 0.4];
    tube(bb, [top, [(top[0] + bot[0]) / 2 + (rnd() - 0.5) * 0.3, (top[1] + y) / 2, (top[2] + bot[2]) / 2], bot], [0.06 * s, 0.1 * s, 0.17 * s], 5, BARK.broad, o.bark, 0.6);
  }
}

// ---- cherry trees (Somei-Yoshino style) ---------------------------------------------------------------------------------------------------------------
// A short, dark, flared trunk that forks low into limbs which sweep outwards and up in an open vase; side branches fan out from the limbs; the blossom is clouds of painted
// flower clusters sitting on those branches (so you see dark wood through the gaps), thin sprigs hang from the branch ends, and a drift of fallen petals lies underneath.
function sakura(vb, bb, cb, x, y, z, s) {
  const rnd = ctx.rnd, LV = lvOf(ctx.lod); const trunkH = (1.9 + rnd() * 0.5) * s, crownR = (4.3 + rnd() * 0.8) * s, r0 = 0.27 * s;
  const lean = [(rnd() - 0.5) * 0.6 * s, (rnd() - 0.5) * 0.6 * s], bark = [0.8, 0.72, 0.7];
  const NT = [4, 3, 2][LV], tp = [], tr = [];
  for (let i = 0; i <= NT; i++) { const t = i / NT; tp.push([x + lean[0] * t * t + Math.sin(t * 3 + s) * 0.08 * s, y - 0.12 + trunkH * t, z + lean[1] * t * t]); tr.push(r0 * (1 - 0.3 * t) * (i === 0 ? 1.5 : 1)); }
  tube(bb, tp, tr, [8, 6, 5][LV], BARK.broad, bark, 0.04);
  const fork = tp[NT], fr = tr[NT], C = [x, y + trunkH + crownR * 0.42, z], CR = crownR * 1.08; // C is the middle of the crown, CR its radius
  const anchors = [], hangs = []; // where flower clumps sit, and where sprigs hang from
  const nl = [5, 4, 3][LV], lean0 = rnd() * TAU;
  for (let l = 0; l < nl; l++) {
    const a = lean0 + (l / nl) * TAU + (rnd() - 0.5) * 0.8, ca = Math.cos(a), sa = Math.sin(a), up = (u) => fork[1] + crownR * u;
    const P = [fork, [fork[0] + ca * crownR * 0.2, up(0.26), fork[2] + sa * crownR * 0.2], [fork[0] + ca * crownR * 0.52, up(0.5 + (rnd() - 0.5) * 0.12), fork[2] + sa * crownR * 0.52], [fork[0] + ca * crownR * 0.86, up(0.58 + rnd() * 0.18), fork[2] + sa * crownR * 0.86]];
    tube(bb, P, [fr * 0.86, fr * 0.62, fr * 0.4, 0.04 * s + 0.02], [6, 5, 4][LV], BARK.broad, bark, 0.2);
    anchors.push(P[2], P[3]); hangs.push(P[3]);
    if (LV < 2) for (const t of [0.5, 0.78]) { // side branches fan out from the limb, rising a little and then drooping
      const from = [(P[2][0] * (1 - t) + P[3][0] * t), (P[2][1] * (1 - t) + P[3][1] * t), (P[2][2] * (1 - t) + P[3][2] * t)];
      for (const sd of LV === 0 ? [-1, 1] : [rnd() < 0.5 ? -1 : 1]) {
        const b = a + sd * (0.55 + rnd() * 0.55), L = (1.5 + rnd() * 1.1) * s, bx = Math.cos(b), bz = Math.sin(b);
        const m = [from[0] + bx * L * 0.5, from[1] + 0.35 * s, from[2] + bz * L * 0.5], e = [from[0] + bx * L, from[1] + 0.1 * s - L * 0.18, from[2] + bz * L];
        tube(bb, [from, m, e], [fr * 0.2 + 0.02, fr * 0.13 + 0.015, 0.016 * s + 0.01], 4, BARK.broad, bark, 0.35); anchors.push(e); hangs.push(e);
      }
    }
  }
  // clouds of flower clusters: a clump round every anchor, plus clumps spread over the crown dome so there are no bald patches
  const sizeK = [1.0, 1.28, 1.6][LV], base = 2.0 * s * sizeK, per = [9, 6, 4][LV], fill = [13, 8, 5][LV];
  const clump = (bc, br, nCards) => {
    for (let q = 0; q < nCards; q++) {
      const d = nrm(rnd() - 0.5, (rnd() - 0.5) * 0.8, rnd() - 0.5), rr = br * Math.cbrt(rnd()), p = [bc[0] + d[0] * rr, bc[1] + d[1] * rr * 0.8, bc[2] + d[2] * rr];
      const az = rnd() * TAU, tl = rnd() < 0.22 ? (rnd() < 0.5 ? -1 : 1) * (1.15 + rnd() * 0.4) : (rnd() - 0.5) * 1.3, half = base * (0.8 + rnd() * 0.5) / 2;
      const ux = Math.cos(az) * half, uz = Math.sin(az) * half, vx = -Math.sin(az) * Math.sin(tl) * half, vy = Math.cos(tl) * half, vz = Math.cos(az) * Math.sin(tl) * half;
      const P = [[p[0] - ux - vx, p[1] - vy, p[2] - uz - vz], [p[0] + ux - vx, p[1] - vy, p[2] + uz - vz], [p[0] + ux + vx, p[1] + vy, p[2] + uz + vz], [p[0] - ux + vx, p[1] + vy, p[2] - uz + vz]];
      const t = 1.32 + rnd() * 0.12, col = [t * 1.1, t * (1.36 + rnd() * 0.06), t * (1.0 + rnd() * 0.04)]; // lifted and warmed: pale petals stay pink-white under the cool dusk light, as lit cherry trees do
      quad(vb, P, cellUV(CELL.sakura), P.map((c) => nrm(c[0] - C[0], c[1] - C[1] + CR * 0.4, c[2] - C[2])), col, P.map((c) => Math.max(0.66, crownAO(c, C, CR) * 1.02)), P.map((c) => 0.55 + 0.45 * clamp((c[1] - y) / (trunkH + crownR), 0, 1)));
    }
  };
  for (const a of anchors) clump(a, 1.05 * s, per);
  for (let b = 0; b < fill; b++) { const u = (b + 0.5) / fill, rho = crownR * (0.3 + 0.66 * Math.sqrt(u)), a = b * 2.399 + rnd() * 0.5, edge = rho / (crownR * 1.05); clump([x + Math.cos(a) * rho, C[1] + crownR * ((rnd() - 0.2) * 0.34 * Math.sqrt(Math.max(0.05, 1 - edge * edge)) + 0.14 * (1 - edge)), z + Math.sin(a) * rho], 1.15 * s, per); }
  // weeping sprigs hanging from the branch ends (two crossed cards each, so they have some body)
  if (LV < 2) for (const h of hangs) {
    if (LV === 1 && rnd() < 0.4) continue; const az = rnd() * TAU, H = (1.25 + rnd() * 0.6) * s, W = 1.15 * s;
    for (let k = 0; k < (LV === 0 ? 2 : 1); k++) {
      const a = az + k * 1.5708, ux = Math.cos(a) * W / 2, uz = Math.sin(a) * W / 2, P = [[h[0] - ux, h[1] - H, h[2] - uz], [h[0] + ux, h[1] - H, h[2] + uz], [h[0] + ux, h[1] + 0.05, h[2] + uz], [h[0] - ux, h[1] + 0.05, h[2] - uz]];
      quad(vb, P, cellUV(CELL.sakuraB), P.map((c) => nrm(c[0] - C[0], c[1] - C[1] + CR * 0.2, c[2] - C[2])), [1.4, 1.8, 1.32], P.map((c) => Math.max(0.68, crownAO(c, C, CR))), [0.95, 0.95, 0.4, 0.4]);
    }
  }
  // fallen petals on the ground: a flat card of scattered petals round the foot of the tree
  if (LV < 2) { const hh = 3.9 * s, yy = y + 0.07, P = [[x - hh, yy, z + hh], [x + hh, yy, z + hh], [x + hh, yy, z - hh], [x - hh, yy, z - hh]]; quad(cb, P, cellUV(CELL.petals), [[0, 1, 0], [0, 1, 0], [0, 1, 0], [0, 1, 0]], [1.4, 1.7, 1.35], [1, 1, 1, 1], [0, 0, 0, 0]); }
}

// pines and cypresses: a tapering trunk and whorls of drooping needle sprays, dark and thick near the trunk, bright at the tips
const CONIF = {
  [K.PINE]: { H: 19, R0: 0.42, nw: 18, nb: 9, L: 4.6, taper: 0.8, wide: 0.9, droop: 0.42, t0: 0.15, tint: [0.88, 1.0, 0.92], bark: [1, 0.95, 0.9] },
  [K.CYPRESS]: { H: 13, R0: 0.26, nw: 20, nb: 6, L: 2.3, taper: 0.5, wide: 0.9, droop: -0.5, t0: 0.08, tint: [0.7, 0.92, 0.72], bark: [0.9, 0.85, 0.8] },
};
function conifer(vb, bb, x, y, z, s, o) {
  const rnd = ctx.rnd, lod = ctx.lod; const H = o.H * s * (0.85 + rnd() * 0.3), lean = [(rnd() - 0.5) * 0.9 * s, (rnd() - 0.5) * 0.9 * s];
  const tx = (t) => x + lean[0] * t * t, tz = (t) => z + lean[1] * t * t;
  const LV = lvOf(lod), NR = [6, 3, 2][LV]; const pts = [], rad = []; for (let i = 0; i <= NR; i++) { const t = i / NR; pts.push([tx(t), y - 0.12 + H * 0.985 * t, tz(t)]); rad.push(o.R0 * s * (1 - 0.94 * t) * (i === 0 ? 1.3 : 1) + 0.02); }
  tube(bb, pts, rad, [8, 5, 4][LV], BARK.pine, o.bark, 0.5);
  const nw = Math.max(4, Math.round(o.nw * [0.72, 0.42, 0.24][LV])), widen = [1.12, 1.45, 1.9][LV]; const C = [x, y + H * 0.55, z], CR = H * 0.5;
  for (let k = 0; k < nw; k++) {
    const t = o.t0 + (0.97 - o.t0) * (k / (nw - 1)), yy = y + H * t, Lb = o.L * s * Math.pow(1 - t, o.taper) + 0.45 * s;
    const nb = Math.max(3, Math.round(o.nb * (0.5 + 0.7 * (1 - t)) * [0.8, 0.62, 0.5][LV])), a0 = rnd() * TAU;
    for (let j = 0; j < nb; j++) for (let layer = 0; layer < 1; layer++) {
      const a = a0 + (j + layer * 0.5) * TAU / nb + (rnd() - 0.5) * 0.45, dx = Math.cos(a), dz = Math.sin(a);
      const droop = o.droop * (1 - 0.45 * t) + (rnd() - 0.5) * 0.16, L = Lb * (layer ? 0.78 : 1) * (0.88 + rnd() * 0.24), w = L * o.wide * widen * (0.86 + rnd() * 0.3), roll = (rnd() - 0.5) * 0.7;
      const bx = tx(t) + dx * 0.12, by = yy - layer * 0.35 * s, bz = tz(t) + dz * 0.12;
      const segs = LV === 0 && o.droop > 0 && t < 0.62 ? 2 : 1; let px = bx, py = by, pz = bz; const uv0 = cellUV(CELL.conifer);
      for (let sg = 0; sg < segs; sg++) { // two cards per branch: the outer one droops more, so the branch arches
        const f0 = sg / segs, f1 = (sg + 1) / segs, dr = droop * (sg ? 2.1 : 0.55), Ls = L / segs;
        const Ux = dx * Ls, Uy = -dr * Ls, Uz = dz * Ls; const Vx = -dz * w * Math.cos(roll), Vy = w * Math.sin(roll) * 0.7, Vz = dx * w * Math.cos(roll);
        const P = [[px - Vx / 2, py - Vy / 2, pz - Vz / 2], [px + Ux - Vx / 2, py + Uy - Vy / 2, pz + Uz - Vz / 2], [px + Ux + Vx / 2, py + Uy + Vy / 2, pz + Uz + Vz / 2], [px + Vx / 2, py + Vy / 2, pz + Vz / 2]];
        const nn = nrm(dx * 0.4, 0.78, dz * 0.4), N = [nn, nrm(dx * 0.5, 0.74, dz * 0.5), nrm(dx * 0.5, 0.74, dz * 0.5), nn];
        const lowDark = 0.72 + 0.4 * t, aB = (0.34 + 0.5 * f0 + 0.2 * t) * lowDark, aT = (0.34 + 0.5 * f1 + 0.3 * t) * lowDark * (0.95 + 0.2 * rnd());
        quad(vb, P, [uv0[0] + (uv0[2] - uv0[0]) * f0, uv0[1], uv0[0] + (uv0[2] - uv0[0]) * f1, uv0[3]], N, tintOf(o.tint, rnd, 0.24), [aB, aT, aT, aB], [0.3 * f0 * (0.4 + t), 0.35 * f1 + 0.8 * t * f1, 0.35 * f1 + 0.8 * t * f1, 0.3 * f0 * (0.4 + t)]);
        px += Ux; py += Uy; pz += Uz;
      }
    }
  }
  // the leader: four steep sprays that form the pointed top
  for (let q = 0; q < (LV === 2 ? 2 : 4); q++) {
    const a = q * TAU / (LV === 2 ? 2 : 4) + rnd(), dx = Math.cos(a), dz = Math.sin(a), L = 1.9 * s, w = 1.3 * s, by = y + H * 0.94, bx = tx(0.95), bz = tz(0.95);
    const P = [[bx - dz * w / 2, by, bz + dx * w / 2], [bx + dx * L * 0.35 - dz * w / 2, by + L, bz + dz * L * 0.35 + dx * w / 2], [bx + dx * L * 0.35 + dz * w / 2, by + L, bz + dz * L * 0.35 - dx * w / 2], [bx + dz * w / 2, by, bz - dx * w / 2]];
    quad(vb, P, cellUV(CELL.conifer), P.map(() => nrm(dx * 0.4, 0.8, dz * 0.4)), tintOf(o.tint, rnd, 0.2), [0.7, 1.1, 1.1, 0.7], [0, 1.6, 1.6, 0]);
  }
}

// palms: a ringed, leaning trunk and a crown of long drooping fronds (each frond is two cards so it arches)
const PALM = {
  [K.COCONUT]: { H: 9.5, lean: 1.7, r0: 0.26, nf: 16, len: 4.1, up: 1.0, droop: 0.78, trunk: [1, 0.96, 0.88], tint: [0.95, 1.05, 0.8], nuts: true },
  [K.ROYAL]: { H: 12.5, lean: 0.25, r0: 0.34, nf: 12, len: 4.7, up: 0.8, droop: 0.72, trunk: [1.12, 1.1, 1.05], tint: [0.85, 1.0, 0.75], shaft: true },
  [K.ARECA]: { H: 11, lean: 0.7, r0: 0.13, nf: 9, len: 2.8, up: 1.15, droop: 0.62, trunk: [0.95, 1.0, 0.9], tint: [0.9, 1.05, 0.82] },
};
function palm(vb, bb, x, y, z, s, o) {
  const rnd = ctx.rnd, lod = ctx.lod; const H = o.H * s * (0.85 + rnd() * 0.3), la = rnd() * TAU, lean = o.lean * s * (0.4 + rnd() * 0.8);
  const LV = lvOf(lod), NR = [6, 3, 2][LV]; const pts = [], rad = []; for (let i = 0; i <= NR; i++) { const t = i / NR; pts.push([x + Math.cos(la) * lean * t * t + Math.sin(t * 4 + s * 3) * 0.06 * s, y - 0.12 + H * t, z + Math.sin(la) * lean * t * t]); rad.push(o.r0 * s * (1 - 0.36 * t) * (i === 0 ? 1.4 : 1)); }
  tube(bb, pts, rad, [8, 6, 4][LV], BARK.palm, o.trunk, 0.5);
  const top = pts[NR], nf = Math.max(5, Math.round(o.nf * [0.8, 0.6, 0.42][LV])), segs = LV === 0 ? 2 : 1, a0 = rnd() * TAU;
  if (o.shaft && LV === 0) tube(bb, [top, [top[0], top[1] + 0.9 * s, top[2]]], [rad[NR] * 1.05, rad[NR] * 0.8], 6, BARK.pine, [0.5, 0.75, 0.35], 0.6); // green crown shaft
  const cc = [top[0], top[1] + 0.5 * s, top[2]], CR = o.len * s;
  for (let f = 0; f < nf; f++) {
    const a = a0 + f * 2.399, ring = (f % 3) / 2; const e0 = o.up * (1 - ring) + (-0.15) * ring + (rnd() - 0.5) * 0.3, len = o.len * s * (0.85 + rnd() * 0.3), w = len * (0.95 + rnd() * 0.1);
    let p = [top[0], top[1] + 0.35 * s, top[2]]; const dx = Math.cos(a), dz = Math.sin(a);
    for (let j = 0; j < segs; j++) {
      const e = e0 - j * o.droop * (segs === 1 ? 0.45 : 1) - (segs === 1 ? 0.35 : 0), L = len / segs, ex = dx * Math.cos(e) * L, ey = Math.sin(e) * L, ez = dz * Math.cos(e) * L; const Vx = -dz * w, Vz = dx * w;
      const P = [[p[0] - Vx / 2, p[1], p[2] - Vz / 2], [p[0] + ex - Vx / 2, p[1] + ey, p[2] + ez - Vz / 2], [p[0] + ex + Vx / 2, p[1] + ey, p[2] + ez + Vz / 2], [p[0] + Vx / 2, p[1], p[2] + Vz / 2]];
      const uvr = cellUV(CELL.frond), u0 = uvr[0] + (uvr[2] - uvr[0]) * (j / segs), u1 = uvr[0] + (uvr[2] - uvr[0]) * ((j + 1) / segs);
      const N = P.map((c) => nrm(c[0] - cc[0], c[1] - cc[1] + CR * 0.9, c[2] - cc[2])); const aoB = 0.5 + 0.25 * j + 0.1 * ring, aoT = 0.8 + 0.25 * j;
      // the frond texture is drawn with its stalk on the left and its leaflets spread across v, so v spans the card's width
      quad(vb, P, [u0, uvr[1], u1, uvr[3]], N, tintOf(o.tint, rnd, 0.22), [aoB, aoT, aoT, aoB], [0, 0.5 + 0.9 * (j + 1) / segs, 0.5 + 0.9 * (j + 1) / segs, 0]);
      p = [p[0] + ex, p[1] + ey, p[2] + ez];
    }
  }
  if (o.nuts && LV === 0) for (let q = 0; q < 3; q++) { const a = q * 1.3 + rnd(); ball(bb, top[0] + Math.cos(a) * 0.3 * s, top[1] - 0.15 * s, top[2] + Math.sin(a) * 0.3 * s, 0.17 * s, [0.55, 0.72, 0.32], BARK.pine); }
}

// ---- ground cover: bushes, flowering shrubs, ferns, banana clumps, grass ----------------------------------------------------------------------------------
const SHRUB = {
  [K.BUSH]: { cell: CELL.bush, w: 2.2, h: 1.7, n: 5, tint: [0.8, 1.0, 0.72] },
  [K.BOUGAIN]: { cell: CELL.bougain, w: 2.4, h: 1.9, n: 5, tint: [0.78, 0.74, 0.8] },
  [K.ORANGE]: { cell: CELL.flowerO, w: 2.0, h: 1.6, n: 5, tint: [1, 1, 1] },
  [K.WHITE]: { cell: CELL.flowerW, w: 2.0, h: 1.6, n: 5, tint: [1, 1, 1] },
  [K.FERN]: { cell: CELL.fern, w: 1.8, h: 1.4, n: 4, tint: [0.85, 1.05, 0.8] },
  [K.BANANA]: { cell: CELL.banana, w: 2.4, h: 2.8, n: 3, tint: [0.85, 1.05, 0.8] },
};
function shrub(vb, x, y, z, s, o) {
  const rnd = ctx.rnd, lod = ctx.lod; const n = lod > 0.8 ? o.n : Math.max(2, o.n - 2), az0 = rnd() * TAU; const w = o.w * s * (0.8 + rnd() * 0.5), h = o.h * s * (0.8 + rnd() * 0.5); const cc = [x, y + h * 0.35, z];
  for (let q = 0; q < n; q++) {
    const az = az0 + q * Math.PI / n, ux = Math.cos(az) * w / 2, uz = Math.sin(az) * w / 2, lean = (rnd() - 0.5) * 0.25 * h, lx = Math.cos(az + 1.57) * lean, lz = Math.sin(az + 1.57) * lean;
    const P = [[x - ux, y - 0.05, z - uz], [x + ux, y - 0.05, z + uz], [x + ux + lx, y + h, z + uz + lz], [x - ux + lx, y + h, z - uz + lz]];
    quad(vb, P, cellUV(o.cell), P.map((c) => nrm(c[0] - cc[0], c[1] - cc[1] + h * 0.5, c[2] - cc[2])), tintOf(o.tint, rnd, 0.2), [0.5, 0.5, 1.05, 1.05], [0, 0, 0.4, 0.4]);
  }
  if (lod > 0.8 && o.cell !== CELL.banana && o.cell !== CELL.fern) { // a flat cap of leaves on top so it also reads from above
    const az = rnd() * TAU, ux = Math.cos(az) * w * 0.45, uz = Math.sin(az) * w * 0.45, vx = -Math.sin(az) * w * 0.45, vz = Math.cos(az) * w * 0.45, yy = y + h * 0.72;
    const P = [[x - ux - vx, yy, z - uz - vz], [x + ux - vx, yy, z + uz - vz], [x + ux + vx, yy + 0.05, z + uz + vz], [x - ux + vx, yy + 0.05, z - uz + vz]];
    quad(vb, P, cellUV(o.cell), P.map(() => nrm(0, 1, 0)), tintOf(o.tint, rnd, 0.2), [0.9, 0.9, 1.1, 1.1], [0.3, 0.3, 0.4, 0.4]);
  }
}
function grass(vb, x, y, z, s, tall) {
  const rnd = ctx.rnd; const n = tall ? 2 : 3, az0 = rnd() * TAU; const w = (tall ? 1.5 : 0.95) * s * (0.8 + rnd() * 0.5), h = (tall ? 1.9 : 0.85) * s * (0.8 + rnd() * 0.5);
  const dry = rnd() < 0.18 ? [1.12, 1.0, 0.66] : [0.85 + rnd() * 0.3, 0.95 + rnd() * 0.15, 0.8]; const cell = tall ? CELL.tall : CELL.grass;
  for (let q = 0; q < n; q++) {
    const az = az0 + q * Math.PI / n, ux = Math.cos(az) * w / 2, uz = Math.sin(az) * w / 2;
    const P = [[x - ux, y - 0.03, z - uz], [x + ux, y - 0.03, z + uz], [x + ux, y + h, z + uz], [x - ux, y + h, z - uz]];
    quad(vb, P, cellUV(cell), P.map(() => nrm(Math.cos(az + 1.57) * 0.25, 1, Math.sin(az + 1.57) * 0.25)), dry, [0.5, 0.5, 1.15, 1.15], [0, 0, 1.6, 1.6]);
  }
}

// ---- boulders: a lumpy, faceted stone, half buried, grey with a little moss on top ------------------------------------------------------------------------
const ICO1 = new THREE.IcosahedronGeometry(1, 1);
function rock(bb, cx, cy, cz, rx, ry, rz, yaw, seed, mossy) {
  const pos = ICO1.attributes.position, cs = Math.cos(yaw), sn = Math.sin(yaw), rnd = ctx.rnd;
  const disp = (d) => 1 + 0.3 * (vn3(d[0] * 1.9 + seed, d[1] * 1.9, d[2] * 1.9, seed) - 0.5) * 2 + 0.12 * (vn3(d[0] * 4.7, d[1] * 4.7 + seed, d[2] * 4.7, seed + 3) - 0.5) * 2;
  const P = []; for (let k = 0; k < pos.count; k++) { const d = [pos.getX(k), pos.getY(k), pos.getZ(k)], m = disp(d); let px = d[0] * rx * m, py = Math.max(d[1] * ry * m, -ry * 0.42), pz = d[2] * rz * m; P.push([cx + px * cs - pz * sn, cy + py, cz + px * sn + pz * cs]); }
  const tint = [0.86 + rnd() * 0.16, 0.84 + rnd() * 0.14, 0.8 + rnd() * 0.12];
  for (let k = 0; k < pos.count; k += 3) {
    const A = P[k], B = P[k + 1], Cc = P[k + 2]; const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], e2 = [Cc[0] - A[0], Cc[1] - A[1], Cc[2] - A[2]];
    let fn = nrm(e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]); const ctr = [(A[0] + B[0] + Cc[0]) / 3, (A[1] + B[1] + Cc[1]) / 3, (A[2] + B[2] + Cc[2]) / 3];
    if (fn[0] * (ctr[0] - cx) + fn[1] * (ctr[1] - cy) + fn[2] * (ctr[2] - cz) < 0) fn = [-fn[0], -fn[1], -fn[2]];
    const ax = Math.abs(fn[0]), ay = Math.abs(fn[1]), az = Math.abs(fn[2]); const proj = (p) => (ay >= ax && ay >= az ? [p[0], p[2]] : ax >= az ? [p[2], p[1]] : [p[0], p[1]]);
    const moss = mossy && fn[1] > 0.55 ? mix3(tint, [0.55, 0.72, 0.4], clamp((fn[1] - 0.55) * 1.8, 0, 0.85) * (0.5 + vn3(ctr[0] * 1.3, ctr[2] * 1.3, seed, 9))) : tint;
    const shade = 0.72 + 0.5 * vn3(ctr[0] * 2, ctr[1] * 2, ctr[2] * 2, seed + 1); const ids = [A, B, Cc].map((p) => { const q = proj(p); const ao = 0.5 + 0.55 * clamp((p[1] - (cy - ry * 0.4)) / (ry * 1.6), 0, 1); return vtx(bb, p[0], p[1], p[2], nrm(fn[0] * 0.75 + (p[0] - cx) * 0.1, fn[1] * 0.75 + (p[1] - cy) * 0.1, fn[2] * 0.75 + (p[2] - cz) * 0.1), [moss[0] * shade, moss[1] * shade, moss[2] * shade], ao, q[0] * 0.8, q[1] * 0.8 / 4, 0, BARK.rock); });
    bb.i.push(ids[0], ids[1], ids[2]);
  }
}
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function rockCluster(bb, x, y, z, s, big) {
  const rnd = ctx.rnd, seed = Math.floor(rnd() * 900); const R = (big ? 1.8 + rnd() * 1.4 : 0.55 + rnd() * 0.7) * s;
  rock(bb, x, y + R * 0.3, z, R * (1 + rnd() * 0.5), R * (0.7 + rnd() * 0.3), R * (0.9 + rnd() * 0.4), rnd() * TAU, seed, true);
  const k = ctx.lod > 0.8 ? 1 + ((rnd() * 3) | 0) : 0;
  for (let q = 0; q < k; q++) { const a = rnd() * TAU, d = R * (1.0 + rnd() * 0.8), r2 = R * (0.3 + rnd() * 0.35); rock(bb, x + Math.cos(a) * d, y + r2 * 0.25, z + Math.sin(a) * d, r2 * 1.2, r2 * 0.8, r2, rnd() * TAU, seed + q + 1, rnd() < 0.5); }
}

// ---- one chunk's plants -> instanced meshes -------------------------------------------------------------------------------------------------------------
// Every kind of plant exists as a few shapes ("variants"), each built once per level of detail and shared by the whole world. A chunk then only stores
// where each plant stands (a 4x4 matrix and a colour): thousands of trees cost a few hundred KB instead of hundreds of MB, and chunks build in a blink.
// list: [{k,x,y,z,s,sd}]; lamps: this chunk's lamp list [{x,y,z,h,c,tx,tz,side}] whose warm glow tints the plants beside them.
const LAMP_RGB = [[1.0, 0.62, 0.25], [1.0, 0.94, 0.82], [0.74, 0.84, 1.0]];
const LOD_OF_TIER = [1, 0.6, 0.3];
const PROTO = new Map();
function protoFor(k, v, tier) {
  const key = (k * 8 + v) * 4 + tier; let pr = PROTO.get(key); if (pr) return pr;
  const out = { leaf: new VB(), cover: new VB(), bark: new VB() };
  ctx.lod = LOD_OF_TIER[tier]; ctx.near = []; ctx.rnd = mulberry(k * 7919 + v * 104729 + 31);
  if (k >= 40) rockCluster(out.bark, 0, 0, 0, 1, k === K.BOULDER);
  else switch (k) {
    case K.PINE: case K.CYPRESS: conifer(out.leaf, out.bark, 0, 0, 0, 1, CONIF[k]); break;
    case K.COCONUT: case K.ROYAL: case K.ARECA: palm(out.leaf, out.bark, 0, 0, 0, 1, PALM[k]); break;
    case K.GRASS: grass(out.cover, 0, 0, 0, 1, false); break;
    case K.TALL: grass(out.cover, 0, 0, 0, 1, true); break;
    case K.SAKURA: sakura(out.leaf, out.bark, out.cover, 0, 0, 0, 1); break;
    default: if (BROAD[k]) broadleaf(out.leaf, out.bark, 0, 0, 0, 1, BROAD[k]); else if (SHRUB[k]) shrub(out.cover, 0, 0, 0, 1, SHRUB[k]);
  }
  pr = {}; for (const kk of ["leaf", "cover", "bark"]) if (!out[kk].empty) { const g = out[kk].build(); g.userData.shared = true; pr[kk] = g; }
  PROTO.set(key, pr); return pr;
}
const h01 = (n) => { let h = Math.imul((n | 0) ^ 0x9e3779b9, 2654435761); h ^= h >>> 15; h = Math.imul(h, 2246822519); h ^= h >>> 13; return (h >>> 0) / 4294967296; };

// returns { hi: [meshes], mid: [...], lo: [...] }; the view shows one of the three sets depending on how far the chunk is from the camera
export function buildPlantMeshes(list, lamps, mats, variants = 3) {
  const lampPts = lamps.map((l) => { const ax = -l.tz * -l.side, az = l.tx * -l.side; const c = LAMP_RGB[l.c] || LAMP_RGB[0]; return { x: l.x + ax * 1.7, z: l.z + az * 1.7, r: c[0], g: c[1], b: c[2] }; });
  const counts = new Map(); for (const p of list) counts.set(p.k, (counts.get(p.k) || 0) + 1);
  const groups = new Map();
  for (const p of list) { // shrubs and grass get one shape (scale, turn and tint make them differ); rare trees get fewer shapes, so fewer draw calls
    const nv = p.k >= 20 && p.k < 40 ? 1 : Math.min(variants, 1 + (counts.get(p.k) >> 4)); const v = Math.min(nv - 1, Math.floor(h01(p.sd) * nv));
    const gk = p.k * 8 + v; let g = groups.get(gk); if (!g) groups.set(gk, (g = { k: p.k, v, items: [] })); g.items.push(p);
  }
  const out = { hi: [], mid: [], lo: [] }, names = ["hi", "mid", "lo"];
  for (const g of groups.values()) {
    const n = g.items.length, mtx = new Float32Array(n * 16), col = new Float32Array(n * 3), isTreeK = g.k < 20;
    for (let i = 0; i < n; i++) {
      const p = g.items[i], yaw = h01(p.sd + 17) * TAU, c = Math.cos(yaw) * p.s, sn = Math.sin(yaw) * p.s, o = i * 16;
      mtx[o] = c; mtx[o + 2] = -sn; mtx[o + 5] = p.s; mtx[o + 8] = sn; mtx[o + 10] = c; mtx[o + 12] = p.x; mtx[o + 13] = p.y; mtx[o + 14] = p.z; mtx[o + 15] = 1;
      const br = 0.88 + h01(p.sd + 5) * 0.24; let r = br * (0.95 + h01(p.sd + 6) * 0.1), gg = br, b = br * (0.95 + h01(p.sd + 7) * 0.1);
      if (g.k < 30) { let da = 400; let a = null; for (const L of lampPts) { const d = (L.x - p.x) ** 2 + (L.z - p.z) ** 2; if (d < da) { da = d; a = L; } } if (a) { const f = 1 - Math.sqrt(da) / 20, kk = f * f * (isTreeK ? 0.9 : 1.2); r *= 1 + kk * a.r; gg *= 1 + kk * a.g; b *= 1 + kk * a.b; } }
      col[i * 3] = r; col[i * 3 + 1] = gg; col[i * 3 + 2] = b;
    }
    const mkAttrs = (m, c) => { const A = new THREE.InstancedBufferAttribute(m, 16), B = new THREE.InstancedBufferAttribute(c, 3); A.setUsage(THREE.StaticDrawUsage); B.setUsage(THREE.StaticDrawUsage); return [A, B]; };
    const [A, B] = mkAttrs(mtx, col);
    for (let tier = 0; tier < 3; tier++) {
      if (!(tier === 0 || (tier === 1 && (g.k < 30 || g.k === K.BOULDER)) || (tier === 2 && isTreeK))) continue; // ground cover only near, trees at every distance
      let attrA = A, attrB = B, cnt = n;
      if (tier === 2 && n > 1) { // far away every second tree is enough
        const mt = new Float32Array(Math.ceil(n / 2) * 16), cl = new Float32Array(Math.ceil(n / 2) * 3); let j = 0;
        for (let i = 0; i < n; i += 2, j++) { mt.set(mtx.subarray(i * 16, i * 16 + 16), j * 16); cl.set(col.subarray(i * 3, i * 3 + 3), j * 3); }
        [attrA, attrB] = mkAttrs(mt, cl); cnt = j;
      }
      const pr = protoFor(g.k, g.v, tier);
      for (const [key, mat] of [["leaf", mats.foliage], ["cover", mats.cover], ["bark", mats.bark]]) if (pr[key]) {
        const m = new THREE.InstancedMesh(pr[key], mat, 1); m.instanceMatrix = attrA; m.instanceColor = attrB; m.count = cnt;
        m.userData.cover = key === "cover"; m.visible = tier === 0; out[names[tier]].push(m);
      }
    }
  }
  return out;
}
