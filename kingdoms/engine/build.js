// Turns the list of placed blocks into 3D shapes. Every block looks at its neighbours and
// decides what it needs: walls with windows and doors where it is exposed, a roof (or a
// garden terrace) where nothing sits on top, a stone base at the water, and so on.
import * as THREE from "three";
import { H, BASE, MAXK, hash, key, cellCorners, cellCenter } from "./grid";

export const PALETTE = [
  { name: "Cream", wall: 0xf3e6c8, shutter: 0x4f8f8a },
  { name: "Coral", wall: 0xee9078, shutter: 0xf6efe0 },
  { name: "Mint", wall: 0xa3d6c1, shutter: 0xc65a4c },
  { name: "Sky", wall: 0x8fbbe0, shutter: 0xf6efe0 },
  { name: "Butter", wall: 0xf5d77c, shutter: 0x3e7fa8 },
  { name: "Lilac", wall: 0xbaa7d9, shutter: 0xf3e6c8 },
  { name: "Peach", wall: 0xf6b78a, shutter: 0x4f8f8a },
  { name: "Sage", wall: 0xaecb92, shutter: 0xb5503f },
  { name: "Rose", wall: 0xeaa6bd, shutter: 0x4f7f9a },
  { name: "Sand", wall: 0xe0cba3, shutter: 0x58795f },
];
const ROOFS = [0xc65a43, 0xb64d3a, 0x6a86a3, 0x4a8f88, 0xa8604a, 0x7a5f8c];
const STONE = 0x939aa3, STONE_D = 0x4d5864, TRIM = 0xfff3dc, WOOD = 0x6e4d36, DOOR = 0x5b3b2b, BRICK = 0xa5503a;
const GRASS = 0x8dc06b, LEAF = [0x5e9c5a, 0x79b062, 0x4f8b5e], FLOWER = [0xf2b8c6, 0xf7e07a, 0xffffff, 0xe9885f];

const tmpC = new THREE.Color();
const rgb = (hex, m = 1) => { tmpC.setHex(hex); return [tmpC.r * m, tmpC.g * m, tmpC.b * m]; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

class Geo {
  constructor(uv) { this.pos = []; this.col = []; this.uv = uv ? [] : null; }
  tri(a, b, c, ca, cb, cc, hint) {
    const n = cross(sub(b, a), sub(c, a));
    if (dot(n, hint) < 0) { [b, c] = [c, b]; [cb, cc] = [cc, cb]; }
    this.pos.push(...a, ...b, ...c); this.col.push(...ca, ...cb, ...cc);
  }
  quad(a, b, c, d, ca, cb, cc, cd, hint) { this.tri(a, b, c, ca, cb, cc, hint); this.tri(a, c, d, ca, cc, cd, hint); }
  flat(a, b, c, d, col, hint) { this.quad(a, b, c, d, col, col, col, col, hint); }
  // box from a centre and three half-extent vectors
  box(c, ex, ey, ez, col) {
    const P = (sx, sy, sz) => [c[0] + ex[0] * sx + ey[0] * sy + ez[0] * sz, c[1] + ex[1] * sx + ey[1] * sy + ez[1] * sz, c[2] + ex[2] * sx + ey[2] * sy + ez[2] * sz];
    const f = (a, b, cc, d, h) => this.flat(a, b, cc, d, col, h);
    f(P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1), ex);
    f(P(-1, -1, -1), P(-1, 1, -1), P(-1, 1, 1), P(-1, -1, 1), mul(ex, -1));
    f(P(-1, 1, -1), P(1, 1, -1), P(1, 1, 1), P(-1, 1, 1), ey);
    f(P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1), mul(ey, -1));
    f(P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1), ez);
    f(P(-1, -1, -1), P(1, -1, -1), P(1, 1, -1), P(-1, 1, -1), mul(ez, -1));
  }
  // simple cone / pyramid with N sides
  cone(c, r, h, sides, col, colTop) {
    const peak = [c[0], c[1] + h, c[2]]; const ct = colTop || col;
    for (let s = 0; s < sides; s++) {
      const a0 = (s / sides) * Math.PI * 2, a1 = ((s + 1) / sides) * Math.PI * 2;
      const p0 = [c[0] + Math.cos(a0) * r, c[1], c[2] + Math.sin(a0) * r], p1 = [c[0] + Math.cos(a1) * r, c[1], c[2] + Math.sin(a1) * r];
      const mid = [(p0[0] + p1[0]) / 2 - c[0], r * 0.5, (p0[2] + p1[2]) / 2 - c[2]];
      this.tri(p0, p1, peak, col, col, ct, mid);
    }
  }
  toGeometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.computeVertexNormals();
    return g;
  }
}

export function buildTown(voxels, opts = {}) {
  const has = (i, j, k) => voxels.has(key(i, j, k));
  const main = new Geo(), glass = new Geo(), pickPos = [], pickInfo = [], foam = [];
  const stats = { houses: 0, colors: new Set(), terraces: 0, bridges: 0, maxHeight: 0, towers: 0, windows: 0 };
  const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // edge e goes from corner e to e+1; neighbour across it:

  for (const [q, v] of voxels) {
    const i = Math.floor(q / 1024), j = Math.floor((q % 1024) / 16), k = q % 16;
    const corners = cellCorners(i, j), ctr = cellCenter(i, j);
    const y0 = BASE + k * H, y1 = y0 + H;
    const wallHex = PALETTE[v.c % PALETTE.length].wall, shutHex = PALETTE[v.c % PALETTE.length].shutter;
    stats.houses++; stats.colors.add(v.c % PALETTE.length);
    const below = k > 0 ? has(i, j, k - 1) : true, above = has(i, j, k + 1);
    if (k > 0 && !below) stats.bridges++;
    const P3 = (p, y) => [p[0], y, p[1]];
    let doorDone = false;

    // ---- sides ---------------------------------------------------------------------------
    for (let e = 0; e < 4; e++) {
      const [di, dj] = DIRS[e];
      const ni = i + di, nj = j + dj;
      if (has(ni, nj, k)) continue;
      const a = corners[e], b = corners[(e + 1) % 4];
      const a0 = P3(a, y0), b0 = P3(b, y0), a1 = P3(a, y1), b1 = P3(b, y1);
      const t = norm(sub(b0, a0)); const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      let n = norm([-(b[1] - a[1]), 0, b[0] - a[0]]);
      if (dot(n, [(a[0] + b[0]) / 2 - ctr[0], 0, (a[1] + b[1]) / 2 - ctr[1]]) < 0) n = mul(n, -1);
      // pick surface for the mouse
      pickPos.push(...a0, ...b0, ...b1, ...a0, ...b1, ...a1); pickInfo.push({ i, j, k, di, dj, top: false }, { i, j, k, di, dj, top: false });
      // wall with a soft darker bottom
      main.quad(a0, b0, b1, a1, rgb(wallHex, 0.8), rgb(wallHex, 0.8), rgb(wallHex, 1), rgb(wallHex, 1), n);
      // stone base on the ground floor, flaring into the sea
      if (k === 0) {
        const o = mul(n, 0.06), aS = add(P3(a, -1.3), o), bS = add(P3(b, -1.3), o), aT = add(a0, o), bT = add(b0, o);
        main.quad(aS, bS, bT, aT, rgb(STONE_D), rgb(STONE_D), rgb(STONE), rgb(STONE), n);
        main.box(add(mul(add(a0, b0), 0.5), mul(n, 0.045)), mul(t, len / 2), [0, 0.04, 0], mul(n, 0.07), rgb(0xb7bcc4));
      }
      // cornice band at the top of every floor
      main.box(add(mul(add(a1, b1), 0.5), mul(n, 0.04)), mul(t, len / 2 + 0.02), [0, 0.045, 0], mul(n, 0.075), rgb(TRIM));
      // windows & doors
      const seed = hash(i * 7 + e, j * 13 + k, 3);
      const wantDoor = k === 0 && !doorDone && len > 1.2 && (seed < 0.5 || e === 3);
      const slots = len < 1.9 ? [0.5] : [0.3, 0.7];
      for (let s = 0; s < slots.length; s++) {
        const u = slots[s];
        const base = lerp3(a0, b0, u);
        if (wantDoor && s === (slots.length === 1 ? 0 : seed < 0.25 ? 0 : 1)) {
          doorDone = true;
          const dc = add(add(base, [0, 0.62, 0]), mul(n, 0.035));
          main.box(dc, mul(t, 0.34), [0, 0.62, 0], mul(n, 0.045), rgb(DOOR));
          main.box(add(dc, [0, 0.68, 0]), mul(t, 0.44), [0, 0.06, 0], mul(n, 0.07), rgb(TRIM));
          main.box(add(add(base, [0, 0.03, 0]), mul(n, 0.2)), mul(t, 0.4), [0, 0.04, 0], mul(n, 0.18), rgb(0xc0c4ca));
          // little lantern
          glass.box(add(add(base, [0.0, 1.5, 0]), add(mul(n, 0.1), mul(t, 0.46))), [0.05, 0, 0], [0, 0.07, 0], [0, 0, 0.05], rgb(0xffd58a));
          continue;
        }
        const wc = add(add(base, [0, 0.92, 0]), mul(n, 0.03));
        main.box(wc, mul(t, 0.31), [0, 0.43, 0], mul(n, 0.04), rgb(TRIM));
        glass.box(add(wc, mul(n, 0.035)), mul(t, 0.235), [0, 0.35, 0], mul(n, 0.02), rgb(0x7ab4d6));
        main.box(add(wc, mul(n, 0.045)), [0, 0, 0], [0, 0.38, 0], mul(n, 0.015), rgb(TRIM)); // window bar
        main.box(add(wc, [0, 0, 0]), mul(t, 0.25), [0, 0.02, 0], mul(n, 0.06), rgb(TRIM));
        if (hash(i, j, k * 5 + e * 3 + s) < 0.85) {
          main.box(add(add(wc, mul(t, -0.37)), mul(n, 0.05)), mul(t, 0.075), [0, 0.42, 0], mul(n, 0.02), rgb(shutHex));
          main.box(add(add(wc, mul(t, 0.37)), mul(n, 0.05)), mul(t, 0.075), [0, 0.42, 0], mul(n, 0.02), rgb(shutHex));
        }
        if (hash(i, j, k * 11 + e + s * 5) < 0.3) { // flower box
          const fb = add(add(wc, [0, -0.5, 0]), mul(n, 0.12));
          main.box(fb, mul(t, 0.3), [0, 0.06, 0], mul(n, 0.07), rgb(WOOD));
          for (let f = 0; f < 4; f++) main.box(add(add(fb, [0, 0.12, 0]), mul(t, -0.22 + f * 0.15)), [0.04, 0, 0], [0, 0.07, 0], [0, 0, 0.04], rgb(FLOWER[(f + i + j) % 4]));
        }
        stats.windows++;
      }
      // a balcony now and then
      if (k > 0 && len > 1.6 && hash(i, j, k + 40 + e) < 0.16) {
        const bc = add(add(lerp3(a0, b0, 0.5), [0, 0.06, 0]), mul(n, 0.3));
        main.box(bc, mul(t, 0.55), [0, 0.05, 0], mul(n, 0.3), rgb(TRIM));
        for (let p = -1; p <= 1; p += 1) main.box(add(add(bc, [0, 0.3, 0]), add(mul(t, p * 0.5), mul(n, 0.27))), [0.025, 0, 0], [0, 0.26, 0], [0, 0, 0.025], rgb(0x5a6672));
        main.box(add(add(bc, [0, 0.55, 0]), mul(n, 0.27)), mul(t, 0.55), [0, 0.025, 0], mul(n, 0.025), rgb(0x5a6672));
      }
    }

    // ---- underside of an overhanging block -------------------------------------------------
    if (!below) {
      const c = corners.map((p) => P3(p, y0));
      main.flat(c[0], c[1], c[2], c[3], rgb(WOOD, 0.9), [0, -1, 0]);
      // a beam along the middle
      main.box([ctr[0], y0 - 0.06, ctr[1]], [corners[1][0] - corners[0][0], 0, corners[1][1] - corners[0][1]].map((x) => x * 0.5), [0, 0.06, 0], [0.07, 0, 0.07], rgb(0x4a3425));
      pickPos.push(...c[0], ...c[1], ...c[2], ...c[0], ...c[2], ...c[3]); pickInfo.push({ i, j, k, bottom: true }, { i, j, k, bottom: true });
    }

    // ---- top: roof or terrace ----------------------------------------------------------------
    if (above) continue;
    const c1 = corners.map((p) => P3(p, y1));
    pickPos.push(...c1[0], ...c1[1], ...c1[2], ...c1[0], ...c1[2], ...c1[3]); pickInfo.push({ i, j, k, top: true }, { i, j, k, top: true });

    const nb = DIRS.map(([di, dj]) => has(i + di, j + dj, k));            // same-level neighbours across edges 0..3
    const taller = DIRS.some(([di, dj]) => has(i + di, j + dj, k + 1));
    // column height for towers
    let colH = 1; for (let kk = k - 1; kk >= 0 && has(i, j, kk); kk--) colH++;
    stats.maxHeight = Math.max(stats.maxHeight, colH);

    if (taller) { // ---- garden terrace
      stats.terraces++;
      const up = [0, 0.03, 0], gc = c1.map((p) => add(p, up));
      main.flat(gc[0], gc[1], gc[2], gc[3], rgb(GRASS), [0, 1, 0]);
      for (let e = 0; e < 4; e++) {
        const [di, dj] = DIRS[e]; if (nb[e] || has(i + di, j + dj, k + 1)) continue;
        const a = c1[e], b = c1[(e + 1) % 4]; const t = norm(sub(b, a)); const len = Math.hypot(b[0] - a[0], b[2] - a[2]);
        const mid = mul(add(a, b), 0.5);
        main.box(add(mid, [0, 0.42, 0]), mul(t, len / 2), [0, 0.025, 0], [0.025, 0, 0.025], rgb(TRIM));
        main.box(add(mid, [0, 0.2, 0]), mul(t, len / 2), [0, 0.02, 0], [0.02, 0, 0.02], rgb(TRIM));
        for (const p of [a, b]) main.box(add(p, [0, 0.22, 0]), [0.04, 0, 0], [0, 0.22, 0], [0, 0, 0.04], rgb(TRIM));
      }
      const r = hash(i, j, k + 90);
      if (r < 0.55) { // tree
        const tc = [ctr[0] + (hash(i, j, 5) - 0.5) * 0.4, y1, ctr[1] + (hash(i, j, 6) - 0.5) * 0.4];
        main.box(add(tc, [0, 0.4, 0]), [0.07, 0, 0], [0, 0.4, 0], [0, 0, 0.07], rgb(WOOD));
        const lc = LEAF[(i + j) % 3];
        main.cone(add(tc, [0, 0.55, 0]), 0.62, 0.8, 7, rgb(lc, 0.85), rgb(lc, 1.15));
        main.cone(add(tc, [0, 1.0, 0]), 0.46, 0.75, 7, rgb(lc, 0.95), rgb(lc, 1.25));
      } else if (r < 0.8) { // flower bed
        for (let f = 0; f < 7; f++) {
          const u = hash(i, j, 20 + f), w = hash(i, j, 40 + f);
          const p = lerp3(lerp3(c1[0], c1[1], u), lerp3(c1[3], c1[2], u), w);
          main.box(add(p, [0, 0.13, 0]), [0.06, 0, 0], [0, 0.1, 0], [0, 0, 0.06], rgb(FLOWER[(f + i) % 4]));
          main.box(add(p, [0, 0.04, 0]), [0.02, 0, 0], [0, 0.05, 0], [0, 0, 0.02], rgb(0x5e9c5a));
        }
      } else { // lamp post
        const lc = lerp3(c1[1], c1[3], 0.5);
        main.box(add(lc, [0, 0.55, 0]), [0.03, 0, 0], [0, 0.55, 0], [0, 0, 0.03], rgb(0x5a6672));
        glass.box(add(lc, [0, 1.2, 0]), [0.1, 0, 0], [0, 0.11, 0], [0, 0, 0.1], rgb(0xffd58a));
        main.box(add(lc, [0, 1.36, 0]), [0.14, 0, 0], [0, 0.03, 0], [0, 0, 0.14], rgb(0x5a6672));
      }
      continue;
    }

    // ---- roofs
    const roofHex = ROOFS[(v.c * 3 + ((i * 5 + j * 3) % 2)) % ROOFS.length];
    const rc = (m) => rgb(roofHex, m);
    const isolated = !nb[0] && !nb[1] && !nb[2] && !nb[3];
    const eave = 0.2;
    if (isolated && colH >= 3) { // tower spire
      const slate = rgb(k >= 5 ? 0x4b5d78 : roofHex, 1); const peakY = y1 + 1.5 + colH * 0.22;
      const peak = [ctr[0], peakY, ctr[1]];
      const ec = c1.map((p) => { const d = [p[0] - ctr[0], 0, p[2] - ctr[1]]; return add(add(p, mul(norm(d), eave)), [0, -0.02, 0]); });
      for (let e = 0; e < 4; e++) main.tri(ec[e], ec[(e + 1) % 4], peak, rc(0.85), rc(0.85), rc(1.2), add(mul(sub(add(ec[e], ec[(e + 1) % 4]), [2 * ctr[0], 0, 2 * ctr[1]]), 1), [0, 1.4, 0]));
      main.box([ctr[0], peakY + 0.45, ctr[1]], [0.02, 0, 0], [0, 0.45, 0], [0, 0, 0.02], rgb(0x5a6672));
      main.tri([ctr[0], peakY + 0.85, ctr[1]], [ctr[0] + 0.5, peakY + 0.7, ctr[1] + 0.05], [ctr[0], peakY + 0.55, ctr[1]], rgb(0xd9483b), rgb(0xd9483b), rgb(0xd9483b), [0, 0, 1]);
      main.tri([ctr[0], peakY + 0.85, ctr[1]], [ctr[0] + 0.5, peakY + 0.7, ctr[1] + 0.05], [ctr[0], peakY + 0.55, ctr[1]], rgb(0xd9483b), rgb(0xd9483b), rgb(0xd9483b), [0, 0, -1]);
      void slate; stats.towers++;
      continue;
    }
    if (isolated) { // pyramid (hip) roof
      const peak = [ctr[0], y1 + 1.15, ctr[1]];
      const ec = c1.map((p) => add(add(p, mul(norm([p[0] - ctr[0], 0, p[2] - ctr[1]]), eave)), [0, -0.04, 0]));
      for (let e = 0; e < 4; e++) main.tri(ec[e], ec[(e + 1) % 4], peak, rc(0.9), rc(0.9), rc(1.15), add(sub(add(ec[e], ec[(e + 1) % 4]), [2 * ctr[0], 0, 2 * ctr[1]]), [0, 1.2, 0]));
      if (hash(i, j, k + 7) < 0.3) main.box([ctr[0] + 0.25, y1 + 0.55, ctr[1] + 0.2], [0.13, 0, 0], [0, 0.4, 0], [0, 0, 0.13], rgb(BRICK));
      continue;
    }
    // gable roof: ridge runs along the longer row of neighbours
    const run = (di, dj) => { let c = 1, a = 1; while (has(i + di * a, j + dj * a, k) && a < 8) { c++; a++; } a = 1; while (has(i - di * a, j - dj * a, k) && a < 8) { c++; a++; } return c; };
    const runI = run(1, 0), runJ = run(0, 1);
    const alongI = nb[1] || nb[3] ? (nb[0] || nb[2] ? runI >= runJ : true) : false; // ridge along the i direction?
    // corners: 0=(i,j) 1=(i+1,j) 2=(i+1,j+1) 3=(i,j+1)
    // ridge along i: front edge 0-1, back edge 3-2, ends are edges 3(left: 3-0) and 1(right: 1-2)
    let fa, fb, ba, bb, endA, endB, nbA, nbB;
    if (alongI) { fa = 0; fb = 1; ba = 3; bb = 2; endA = [0, 3]; endB = [1, 2]; nbA = nb[3]; nbB = nb[1]; }
    else { fa = 0; fb = 3; ba = 1; bb = 2; endA = [0, 1]; endB = [3, 2]; nbA = nb[0]; nbB = nb[2]; }
    const midF = (idx0, idx1) => mul(add(c1[idx0], c1[idx1]), 0.5);
    const rA = add(midF(endA[0], endA[1]), [0, 1.05, 0]), rB = add(midF(endB[0], endB[1]), [0, 1.05, 0]);
    const fDir = norm(sub(mul(add(c1[fa], c1[fb]), 0.5), mul(add(c1[ba], c1[bb]), 0.5)));
    const out = (p, s) => add(add(p, mul(fDir, s * eave)), [0, -0.05, 0]);
    // the two slopes
    main.quad(out(c1[fa], 1), out(c1[fb], 1), rB, rA, rc(0.88), rc(0.88), rc(1.12), rc(1.12), add(fDir, [0, 1.1, 0]));
    main.quad(out(c1[ba], -1), out(c1[bb], -1), rB, rA, rc(0.88), rc(0.88), rc(1.12), rc(1.12), add(mul(fDir, -1), [0, 1.1, 0]));
    // ridge cap
    main.box(mul(add(rA, rB), 0.5), mul(sub(rB, rA), 0.5), [0, 0.035, 0], [0.04, 0, 0.04], rc(0.7));
    // gable ends
    const wallC = rgb(wallHex, 1);
    for (const [end, hasN, rr] of [[endA, nbA, rA], [endB, nbB, rB]]) {
      if (hasN) continue;
      main.tri(c1[end[0]], c1[end[1]], rr, wallC, wallC, wallC, add(sub(mul(add(c1[end[0]], c1[end[1]]), 0.5), [ctr[0], 0, ctr[1]]), [0, 0, 0]));
    }
    if (hash(i, j, k + 17) < 0.22) { // chimney
      const cc = add(mul(add(rA, rB), 0.5), mul(fDir, 0.35));
      main.box(add(cc, [0, -0.05, 0]), [0.14, 0, 0], [0, 0.45, 0], [0, 0, 0.14], rgb(BRICK));
      main.box(add(cc, [0, 0.42, 0]), [0.18, 0, 0], [0, 0.04, 0], [0, 0, 0.18], rgb(0x4a4f57));
    }
  }

  // ---- foam rings around everything standing in the water ------------------------------------
  const foamPos = [], foamUv = [];
  for (const [q] of voxels) {
    const k = q % 16; if (k !== 0) continue;
    const i = Math.floor(q / 1024), j = Math.floor((q % 1024) / 16);
    const ctr = cellCenter(i, j), cs = cellCorners(i, j);
    const ex = cs.map((p) => [ctr[0] + (p[0] - ctr[0]) * 1.55, ctr[1] + (p[1] - ctr[1]) * 1.55]);
    const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
    for (const idx of [0, 1, 2, 0, 2, 3]) { foamPos.push(ex[idx][0], 0.06, ex[idx][1]); foamUv.push(...uvs[idx]); }
  }

  const finish = (g) => g.pos.length ? g.toGeometry() : null;
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.Float32BufferAttribute(pickPos, 3));
  const fg = new THREE.BufferGeometry();
  fg.setAttribute("position", new THREE.Float32BufferAttribute(foamPos, 3));
  fg.setAttribute("uv", new THREE.Float32BufferAttribute(foamUv, 2));
  return { main: finish(main), glass: finish(glass), pick: pg, pickInfo, foam: fg, stats };
}
