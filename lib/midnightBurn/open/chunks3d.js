// Midnight Burn — turns one 256 m square of the city into 3D: terrain, roads, flyovers, buildings, lamps, trees.
import * as THREE from "three";
import { CH } from "./world";
import { isWater, shoreDist, districtAt, fbm, W } from "./geo";
import { ROAD_BAND } from "./textures";

// ---- a small geometry builder so each chunk is a handful of draw calls ------------------------------------------------------
export class GB {
  constructor() { this.p = []; this.n = []; this.c = []; this.uv = []; this.i = []; }
  v(x, y, z, nx, ny, nz, r, g, b, u = 0, w = 0) { const k = this.p.length / 3; this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(r, g, b); this.uv.push(u, w); return k; }
  tri(a, b, c) { this.i.push(a, b, c); }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  get empty() { return this.i.length === 0; }
  // a flat or sloped quad from four corners (counter-clockwise seen from the normal side)
  quadV(A, B, C, D, col, uvs) {
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = D[0] - A[0], vy = D[1] - A[1], vz = D[2] - A[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const U = uvs || [0, 0, 1, 0, 1, 1, 0, 1];
    const a = this.v(A[0], A[1], A[2], nx, ny, nz, col.r, col.g, col.b, U[0], U[1]), b = this.v(B[0], B[1], B[2], nx, ny, nz, col.r, col.g, col.b, U[2], U[3]);
    const c = this.v(C[0], C[1], C[2], nx, ny, nz, col.r, col.g, col.b, U[4], U[5]), d = this.v(D[0], D[1], D[2], nx, ny, nz, col.r, col.g, col.b, U[6], U[7]);
    this.quad(a, b, c, d);
  }
  // box centred on (cx, cy-ish): base at y0, height h, rotated about Y
  box(cx, y0, cz, w, h, d, rot, col, topCol) {
    const c = Math.cos(rot), s = Math.sin(rot), hw = w / 2, hd = d / 2;
    const P = (lx, lz) => [cx + lx * c - lz * s, cz + lx * s + lz * c];
    const A = P(-hw, -hd), B = P(hw, -hd), C = P(hw, hd), D = P(-hw, hd), y1 = y0 + h;
    const side = (P, Q) => this.quadV([Q[0], y0, Q[1]], [P[0], y0, P[1]], [P[0], y1, P[1]], [Q[0], y1, Q[1]], col);
    side(A, B); side(B, C); side(C, D); side(D, A);
    this.quadV([A[0], y1, A[1]], [D[0], y1, D[1]], [C[0], y1, C[1]], [B[0], y1, B[1]], topCol || col);
  }
  // another geometry (unit primitives) scaled, turned and moved
  geo(g, x, y, z, sx, sy, sz, rot, col, tilt = 0) {
    const pos = g.attributes.position, nor = g.attributes.normal, idx = g.index; const base = this.p.length / 3;
    const c = Math.cos(rot), s = Math.sin(rot), ct = Math.cos(tilt), st = Math.sin(tilt);
    for (let k = 0; k < pos.count; k++) {
      let px = pos.getX(k) * sx, py = pos.getY(k) * sy, pz = pos.getZ(k) * sz, nx = nor.getX(k), ny = nor.getY(k), nz = nor.getZ(k);
      if (tilt) { const a = px * ct - py * st, b = px * st + py * ct; px = a; py = b; const na = nx * ct - ny * st, nb = nx * st + ny * ct; nx = na; ny = nb; }
      this.p.push(x + px * c - pz * s, y + py, z + px * s + pz * c); this.n.push(nx * c - nz * s, ny, nx * s + nz * c); this.c.push(col.r, col.g, col.b); this.uv.push(0, 0);
    }
    if (idx) for (let k = 0; k < idx.count; k++) this.i.push(base + idx.getX(k)); else for (let k = 0; k < pos.count; k++) this.i.push(base + k);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.c, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.i.length > 65000 || this.p.length / 3 > 65000 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere(); return g;
  }
}

const colCache = new Map();
export const C = (hex, k = 1) => { const key = hex + ":" + k; let c = colCache.get(key); if (!c) { c = new THREE.Color(hex).multiplyScalar(k); colCache.set(key, c); } return c; };
const rgb = (r, g, b) => ({ r, g, b });

const FACADE_OF = { old: "res", colonial: "res", dense: "res", suburb: "res", upscale: "res", mixed: "res", planned: "res", forest: "res", tower: "office", glass: "office", industrial: "ind", port: "ind" };
const unitBox = new THREE.BoxGeometry(1, 1, 1), ico = new THREE.IcosahedronGeometry(1, 0), cone = new THREE.ConeGeometry(1, 1, 6, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
unitBox.translate(0, 0.5, 0); cone.translate(0, 0.5, 0); cyl.translate(0, 0.5, 0);

function pointNormals(r) {
  if (r._nx) return r;
  const n = r.pts.length; r._nx = new Float32Array(n); r._nz = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const a = r.pts[Math.max(0, k - 1)], b = r.pts[Math.min(n - 1, k + 1)]; let dx = b.x - a.x, dz = b.z - a.z; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l; r._nx[k] = -dz; r._nz[k] = dx;
  }
  return r;
}

// ------------------------------------------------------------------------------------------------------------------------------------
export function buildChunk(world, ci, cj, mats, tex) {
  const city = world.city; const x0 = ci * CH, z0 = cj * CH, x1 = x0 + CH, z1 = z0 + CH;
  const group = new THREE.Group(); group.name = `chunk${ci}_${cj}`;
  const ch = world.chunk(ci, cj);

  // ---- terrain ------------------------------------------------------------------------------------------------------------------------
  {
    const N = 16, cell = CH / N, g = new GB(); const H = new Float32Array((N + 3) * (N + 3));
    for (let j = -1; j <= N + 1; j++) for (let i = -1; i <= N + 1; i++) H[(j + 1) * (N + 3) + i + 1] = city.groundH(x0 + i * cell, z0 + j * cell);
    const h = (i, j) => H[(j + 1) * (N + 3) + i + 1]; const idx = [];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const x = x0 + i * cell, z = z0 + j * cell, y = h(i, j);
      const nx = (h(i - 1, j) - h(i + 1, j)) / (2 * cell), nz = (h(i, j - 1) - h(i, j + 1)) / (2 * cell); const nl = Math.hypot(nx, 1, nz);
      const sd = shoreDist(x, z); const d = districtAt(x, z); const forest = d && d.style === "forest";
      const nz1 = fbm(x * 0.02, z * 0.02, 2), slope = Math.hypot(nx, nz);
      let r, gg, b;
      if (y < 0.2) { r = 0.05; gg = 0.07; b = 0.09; }
      else if (sd < 28) { r = 0.19 + nz1 * 0.05; gg = 0.17 + nz1 * 0.04; b = 0.12; }       // sand
      else if (forest || y > 14 || slope > 0.35) { const k = 0.7 + nz1 * 0.6; r = 0.045 * k; gg = 0.1 * k; b = 0.05 * k; } // jungle / hillside
      else { const k = 0.8 + nz1 * 0.5; r = 0.11 * k; gg = 0.115 * k; b = 0.1 * k; }       // city ground
      g.v(x, y, z, nx / nl, 1 / nl, nz / nl, r, gg, b, x * 0.02, z * 0.02);
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i; g.tri(a, a + N + 1, a + 1); g.tri(a + 1, a + N + 1, a + N + 2); }
    const m = new THREE.Mesh(g.build(), mats.terrain); m.receiveShadow = false; group.add(m);
  }

  // ---- roads ------------------------------------------------------------------------------------------------------------------------------
  {
    const road = new GB(), deck = new GB(), seen = new Set(); const walk = new GB();
    const concrete = C(0x77777f), under = C(0x4a4a52), curb = C(0x3f3e48), white = C(0xffffff);
    city.nearSegs((x0 + x1) / 2, (z0 + z1) / 2, CH / 2 + 40, (r, i) => {
      const key = r.idx * 65536 + i; if (seen.has(key)) return; seen.add(key);
      const p = r.pts[i], q = r.pts[i + 1]; if (Math.max(p.x, q.x) < x0 - 30 || Math.min(p.x, q.x) > x1 + 30 || Math.max(p.z, q.z) < z0 - 30 || Math.min(p.z, q.z) > z1 + 30) return;
      pointNormals(r); const hw = r.width / 2; const band = ROAD_BAND[r.cls] ?? 3;
      const u0 = (band * 128 + 3) / 512, u1 = ((band + 1) * 128 - 3) / 512;
      const bias = (r.cls === "hwy" ? 0.03 : r.cls === "art" ? 0.02 : 0.01) + (r.idx % 7) * 0.0015;
      const nxp = r._nx[i], nzp = r._nz[i], nxq = r._nx[i + 1], nzq = r._nz[i + 1];
      const L = [p.x + nxp * hw, p.y + bias, p.z + nzp * hw], R = [p.x - nxp * hw, p.y + bias, p.z - nzp * hw];
      const L2 = [q.x + nxq * hw, q.y + bias, q.z + nzq * hw], R2 = [q.x - nxq * hw, q.y + bias, q.z - nzq * hw];
      const v0 = p.s / 16, v1 = q.s / 16;
      road.quadV(R, L, L2, R2, white, [u0, v0, u1, v0, u1, v1, u0, v1]);
      const elevated = p.y - p.g > 1.4 || q.y - q.g > 1.4 || p.w > 0.35;
      if (elevated) {
        const t = 1.3; // slab: both sides and underneath
        const Lb = [L[0], L[1] - t, L[2]], Rb = [R[0], R[1] - t, R[2]], L2b = [L2[0], L2[1] - t, L2[2]], R2b = [R2[0], R2[1] - t, R2[2]];
        deck.quadV(L, Lb, L2b, L2, concrete); deck.quadV(R2, R2b, Rb, R, concrete); deck.quadV(Rb, R2b, L2b, Lb, under);
        if (i % 3 === 0 && p.y - p.g > 2.8) { // pier
          const bot = Math.max(p.g, -3), hgt = p.y - 1.3 - bot; if (hgt > 1) { const rot = Math.atan2(q.z - p.z, q.x - p.x); const offs = r.width > 16 ? [-hw * 0.5, hw * 0.5] : [0]; for (const o of offs) deck.box(p.x + nxp * o, bot, p.z + nzp * o, 2.1, hgt, 2.1, rot, concrete); }
        }
      } else if (r.cls !== "hwy") { // pavement strips
        const sw = 2.2, yk = 0.16;
        for (const sgn of [1, -1]) {
          const a = [p.x + nxp * sgn * hw, p.y + yk, p.z + nzp * sgn * hw], b = [p.x + nxp * sgn * (hw + sw), p.y + yk, p.z + nzp * sgn * (hw + sw)];
          const a2 = [q.x + nxq * sgn * hw, q.y + yk, q.z + nzq * sgn * hw], b2 = [q.x + nxq * sgn * (hw + sw), q.y + yk, q.z + nzq * sgn * (hw + sw)];
          if (sgn > 0) walk.quadV(a, b, b2, a2, curb); else walk.quadV(b, a, a2, b2, curb);
          // kerb face
          const a0 = [a[0], p.y, a[2]], a20 = [a2[0], q.y, a2[2]];
          if (sgn > 0) walk.quadV(a0, a, a2, a20, C(0x6a6a74)); else walk.quadV(a20, a2, a, a0, C(0x6a6a74));
        }
      }
    });
    if (!road.empty) group.add(new THREE.Mesh(road.build(), mats.road));
    if (!deck.empty) group.add(new THREE.Mesh(deck.build(), mats.concrete));
    if (!walk.empty) group.add(new THREE.Mesh(walk.build(), mats.concrete));
  }

  // ---- crash barriers (the same lines the car collides with) ------------------------------------------------------------------------------------
  {
    const g = new GB(); const col = C(0x9a9aa2), top = C(0xb8b8c0);
    for (const w of world.wallsIn(ci, cj)) {
      const dx = w.x2 - w.x1, dz = w.z2 - w.z1, l = Math.hypot(dx, dz) || 1; const rot = Math.atan2(dz, dx);
      g.box((w.x1 + w.x2) / 2, w.y - 0.25, (w.z1 + w.z2) / 2, l + 0.15, 1.25, 0.4, rot, col, top);
    }
    if (!g.empty) group.add(new THREE.Mesh(g.build(), mats.props));
  }

  // ---- buildings ------------------------------------------------------------------------------------------------------------------------------------
  {
    const fac = { res: new GB(), office: new GB(), ind: new GB() }, roof = new GB(), glow = [];
    const roofCol = [C(0x2c2b30), C(0x3a3a40), C(0x4a3a30), C(0x28323a)];
    for (const b of ch.buildings) {
      const kind = FACADE_OF[b.style] || "res"; const g = fac[kind]; const T = tex[kind];
      const c = Math.cos(b.rot), s = Math.sin(b.rot), hw = b.w / 2, hd = b.d / 2;
      let ymin = 1e9, yc = city.groundH(b.x, b.z); const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, lz]) => { const x = b.x + lx * c - lz * s, z = b.z + lx * s + lz * c; ymin = Math.min(ymin, city.groundH(x, z)); return [x, z]; });
      const yb = Math.min(ymin, yc) - 0.6, yt = yb + b.h + Math.max(0, yc - ymin) + 0.6;
      const k = kind === "office" ? 0.78 + (b.id % 5) * 0.045 : 0.92; const bc = kind === "office" ? C(b.style === "glass" ? b.color : 0xffffff, 1) : C(b.color, 0.55 + (b.id % 4) * 0.08);
      const col = kind === "office" ? rgb(bc.r * k, bc.g * k, bc.b * k) : bc;
      const u0 = ((b.id * 7) % 4) / 4, v0 = ((b.id * 5) % 4) / 4;
      for (let e = 0; e < 4; e++) {
        const A = corners[e], B = corners[(e + 1) % 4]; const len = Math.hypot(B[0] - A[0], B[1] - A[1]); const uu = len / T.uvW, vv = (yt - yb) / T.uvH;
        g.quadV([B[0], yb, B[1]], [A[0], yb, A[1]], [A[0], yt, A[1]], [B[0], yt, B[1]], col, [u0 + uu, v0, u0, v0, u0, v0 + vv, u0 + uu, v0 + vv]);
      }
      const rc = b.style === "dense" ? (b.id % 3 === 0 ? C(0x2a5fa8, 0.7) : b.id % 3 === 1 ? C(0xb05a28, 0.5) : roofCol[b.id % 4]) : roofCol[b.id % 4];
      roof.quadV([corners[0][0], yt, corners[0][1]], [corners[3][0], yt, corners[3][1]], [corners[2][0], yt, corners[2][1]], [corners[1][0], yt, corners[1][1]], rc);
      // rooftop things: water tanks, units and, on tall towers, a mast with a red light
      if (b.h < 60) { if (b.id % 3 === 0) roof.geo(cyl, b.x + c * hw * 0.3, yt, b.z + s * hw * 0.3, 1.1, 1.6, 1.1, 0, C(0x1d5ca8, 0.9)); if (b.id % 2 === 0) roof.box(b.x - c * hw * 0.35, yt, b.z - s * hw * 0.35, 2.6, 1.4, 2.0, b.rot, C(0x55555c)); }
      else { roof.box(b.x, yt, b.z, 3.2, 2.4, 3.2, b.rot, C(0x45454c)); roof.geo(cone, b.x, yt + 2.4, b.z, 0.35, Math.min(24, b.h * 0.12), 0.35, 0, C(0x666670)); glow.push(b.x, yt + 2.4 + Math.min(24, b.h * 0.12), b.z, 1, 0.1, 0.08, 9); }
    }
    for (const kd of ["res", "office", "ind"]) if (!fac[kd].empty) group.add(new THREE.Mesh(fac[kd].build(), mats.facade[kd]));
    if (!roof.empty) group.add(new THREE.Mesh(roof.build(), mats.props));
    group.userData.glow = glow;
  }

  // ---- lamps and trees ---------------------------------------------------------------------------------------------------------------------------------
  {
    const g = new GB(), pool = new GB(); const glowPts = group.userData.glow || [];
    const LC = [[1.0, 0.62, 0.25], [1.0, 0.94, 0.82], [0.74, 0.84, 1.0]];
    const pole = C(0x3a3a42);
    for (const l of ch.lamps) {
      g.box(l.x, l.y - 0.1, l.z, 0.18, l.h + 0.1, 0.18, 0, pole);
      const ax = -l.tz * -l.side, az = l.tx * -l.side; // arm toward the road
      const hx = l.x + ax * 1.6, hz = l.z + az * 1.6;
      g.box((l.x + hx) / 2, l.y + l.h - 0.1, (l.z + hz) / 2, 1.7, 0.1, 0.1, Math.atan2(hz - l.z, hx - l.x), pole);
      const col = LC[l.c] || LC[0];
      glowPts.push(hx, l.y + l.h - 0.25, hz, col[0], col[1], col[2], 5.2);
      // soft pool of light on the road
      const R = 9, y = l.y + 0.06, cr = { r: col[0] * 0.5, g: col[1] * 0.5, b: col[2] * 0.5 };
      pool.quadV([hx - R, y, hz - R], [hx - R, y, hz + R], [hx + R, y, hz + R], [hx + R, y, hz - R], cr, [0, 0, 0, 1, 1, 1, 1, 0]);
    }
    const trunk = C(0x4b3a28), leaf = C(0x14301a, 1), leaf2 = C(0x1c4222), leaf3 = C(0x10261a);
    for (const t of ch.trees) {
      const y = t.y - 0.1; const sc = t.s;
      if (t.k === 0) { // palm
        g.geo(cyl, t.x, y, t.z, 0.2 * sc, 7.5 * sc, 0.2 * sc, 0, trunk);
        for (let f = 0; f < 6; f++) { const a = (f / 6) * Math.PI * 2 + t.x; g.geo(unitBox, t.x + Math.cos(a) * 1.5 * sc, y + 7.3 * sc, t.z + Math.sin(a) * 1.5 * sc, 3.4 * sc, 0.08, 0.7 * sc, -a, leaf2, -0.5); }
      } else if (t.k === 1) { g.geo(cyl, t.x, y, t.z, 0.28 * sc, 3.6 * sc, 0.28 * sc, 0, trunk); g.geo(ico, t.x, y + 5.2 * sc, t.z, 3.0 * sc, 2.5 * sc, 3.0 * sc, t.x, leaf); g.geo(ico, t.x + 1.4 * sc, y + 4.6 * sc, t.z + 0.8 * sc, 2.0 * sc, 1.8 * sc, 2.0 * sc, t.z, leaf2); }
      else { g.geo(cyl, t.x, y, t.z, 0.3 * sc, 3 * sc, 0.3 * sc, 0, trunk); g.geo(cone, t.x, y + 2.2 * sc, t.z, 2.4 * sc, 9 * sc, 2.4 * sc, 0, leaf3); }
    }
    if (!g.empty) group.add(new THREE.Mesh(g.build(), mats.props));
    if (!pool.empty) { const m = new THREE.Mesh(pool.build(), mats.pool); m.renderOrder = 2; group.add(m); }
    if (glowPts.length) {
      const n = glowPts.length / 7, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
      for (let k = 0; k < n; k++) { pos[k * 3] = glowPts[k * 7]; pos[k * 3 + 1] = glowPts[k * 7 + 1]; pos[k * 3 + 2] = glowPts[k * 7 + 2]; col[k * 3] = glowPts[k * 7 + 3]; col[k * 3 + 1] = glowPts[k * 7 + 4]; col[k * 3 + 2] = glowPts[k * 7 + 5]; size[k] = glowPts[k * 7 + 6]; }
      const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); pg.setAttribute("color", new THREE.BufferAttribute(col, 3)); pg.setAttribute("size", new THREE.BufferAttribute(size, 1));
      pg.computeBoundingSphere(); const pm = new THREE.Points(pg, mats.glowPts); pm.renderOrder = 3; group.add(pm);
    }
  }
  group.traverse((o) => { if (o.isMesh) { o.matrixAutoUpdate = false; o.updateMatrix(); } });
  return group;
}
export function disposeGroup(group) { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
