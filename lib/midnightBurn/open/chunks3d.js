// Midnight Burn — turns one 256 m square of the city into 3D: terrain, roads, flyovers, buildings, lamps, trees.
import * as THREE from "three";
import { CH } from "./world";
import { isWater, shoreDist, districtAt, fbm, W } from "./geo";
import { ROAD_BAND, BAND_W, ATLAS_W, BOARD_COUNT, BOARD_LIST, BOARD_ROWS } from "./textures2";

// ---- a small geometry builder so each chunk is a handful of draw calls ------------------------------------------------------
export class GB {
  constructor() { this.p = []; this.n = []; this.c = []; this.uv = []; this.i = []; }
  v(x, y, z, nx, ny, nz, r, g, b, u = 0, w = 0) { const k = this.p.length / 3; this.p.push(x, y, z); this.n.push(nx, ny, nz); this.c.push(r, g, b); this.uv.push(u, w); return k; }
  tri(a, b, c) { this.i.push(a, b, c); }
  quad(a, b, c, d) { this.i.push(a, b, c, a, c, d); }
  get empty() { return this.i.length === 0; }
  // a quad with a colour at each corner (for ambient-occlusion style shading)
  quadG(A, B, C, D, cols, uvs) {
    const ux = B[0] - A[0], uy = B[1] - A[1], uz = B[2] - A[2], vx = D[0] - A[0], vy = D[1] - A[1], vz = D[2] - A[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const U = uvs || [0, 0, 1, 0, 1, 1, 0, 1]; const P = [A, B, C, D];
    const k = P.map((p, q) => this.v(p[0], p[1], p[2], nx, ny, nz, cols[q].r, cols[q].g, cols[q].b, U[q * 2], U[q * 2 + 1]));
    this.quad(k[0], k[1], k[2], k[3]);
  }
  // a flat panel centred at (cx,cy,cz), facing the horizontal direction (fx,fz), w wide and h tall
  panel(cx, cy, cz, fx, fz, w, h, col, uv) {
    const ax = fz, az = -fx; const hw = w / 2, hh = h / 2; const U = uv || [0, 0, 1, 1];
    this.quadV([cx - ax * hw, cy - hh, cz - az * hw], [cx + ax * hw, cy - hh, cz + az * hw], [cx + ax * hw, cy + hh, cz + az * hw], [cx - ax * hw, cy + hh, cz - az * hw], col, [U[0], U[1], U[2], U[1], U[2], U[3], U[0], U[3]]);
  }
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

const FACADE_OF = { old: "res", colonial: "res", dense: "res", suburb: "res", upscale: "res", mixed: "res", planned: "res", forest: "res", tower: "office", glass: "office", industrial: "ind", port: "ind", future: "office" };
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
// junctions by chunk, found once
function nodesByChunk(city) {
  if (city._nodeChunks) return city._nodeChunks;
  const m = new Map(); for (const n of city.nodes) { if (n.edges.length < 3) continue; const k = Math.floor(n.x / CH) * 64 + Math.floor(n.z / CH); let l = m.get(k); if (!l) m.set(k, (l = [])); l.push(n); }
  city._nodeChunks = m; return m;
}
const hsh = (n) => { n = Math.imul(n ^ (n >>> 15), 2246822519); n = Math.imul(n ^ (n >>> 13), 3266489917); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
const HOT = (r, g, b, k = 1.7) => ({ r: r * k, g: g * k, b: b * k });
const DARK = (v) => ({ r: v, g: v, b: v });
// a double-sided quad made of two oppositely wound quads, so single-sided materials show it from both ways
function dq(gb, A, B, C2, D, col, uv) { gb.quadV(A, B, C2, D, col, uv); gb.quadV(D, C2, B, A, col, uv ? [uv[6], uv[7], uv[4], uv[5], uv[2], uv[3], uv[0], uv[1]] : undefined); }
// a leaf card: centred at c, with half-extent vectors u and v; normal faces away from the crown centre for soft lighting
function card(gb, cx, cy, cz, ux, uy, uz, vx, vy, vz, nx, ny, nz, col) {
  const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  const a = gb.v(cx - ux - vx, cy - uy - vy, cz - uz - vz, nx, ny, nz, col.r, col.g, col.b, 0, 0), b = gb.v(cx + ux - vx, cy + uy - vy, cz + uz - vz, nx, ny, nz, col.r, col.g, col.b, 1, 0);
  const c = gb.v(cx + ux + vx, cy + uy + vy, cz + uz + vz, nx, ny, nz, col.r, col.g, col.b, 1, 1), d = gb.v(cx - ux + vx, cy - uy + vy, cz - uz + vz, nx, ny, nz, col.r, col.g, col.b, 0, 1);
  gb.quad(a, b, c, d);
}
const BAND_OF = { old: "shops", colonial: "shops", dense: "shops", mixed: "shops", planned: "shops", upscale: "shops", tower: "lobby", glass: "lobby", industrial: "dock", port: "dock", future: "lobby" };


// which district a driver travelling from `p` along (dx,dz) is heading for: the one best lined up with where this road ends up
function destBoard(r, p, dx, dz) {
  const e = dx * (r.pts[r.pts.length - 1].x - r.pts[0].x) + dz * (r.pts[r.pts.length - 1].z - r.pts[0].z) >= 0 ? r.pts[r.pts.length - 1] : r.pts[0];
  const ex = e.x + dx * 300, ez = e.z + dz * 300; let best = -1, bs = 1e9;
  BOARD_LIST.forEach((d, i) => {
    const ax = d.x - p.x, az = d.z - p.z, ahead = ax * dx + az * dz; if (ahead < 350 || Math.hypot(ax, az) < d.r + 250) return;
    const sc = Math.hypot(d.x - ex, d.z - ez) + Math.abs(ax * dz - az * dx) * 0.35; if (sc < bs) { bs = sc; best = i; }
  });
  return best;
}

// sharp bends of the road network, found once and filed by chunk: where the red chevron boards go
function bendsInChunk(city, ci, cj) {
  if (!city._bends) {
    const m = new Map();
    for (const r of city.roads) {
      if (r.hasTunnel || r.cls === "str" || r.pts.length < 12) continue; const n = r.pts.length; const hw = r.width / 2 + 1.5;
      for (let i = 4; i < n - 4; i += 2) {
        const a = r.pts[i - 4], p = r.pts[i], b = r.pts[i + 4]; if (p.tun || p.w > 0.3) continue;
        let t0x = p.x - a.x, t0z = p.z - a.z, t1x = b.x - p.x, t1z = b.z - p.z; const l0 = Math.hypot(t0x, t0z) || 1, l1 = Math.hypot(t1x, t1z) || 1; t0x /= l0; t0z /= l0; t1x /= l1; t1z /= l1;
        const ang = Math.acos(Math.max(-1, Math.min(1, t0x * t1x + t0z * t1z))); if (ang < 0.5) continue;
        const nx = -t0z, nz = t0x; const turn = (t1x - t0x) * nx + (t1z - t0z) * nz; const sd = turn >= 0 ? 1 : -1; // road turns toward side sd; the board stands on the other (outer) side
        const x = p.x - nx * sd * hw, z = p.z - nz * sd * hw; const k = Math.floor(x / CH) * 64 + Math.floor(z / CH); let l = m.get(k); if (!l) m.set(k, (l = []));
        if (l.length < 40) l.push({ x, z, y: p.y, tx: t0x, tz: t0z, sx: nx * sd, sz: nz * sd });
      }
    }
    city._bends = m;
  }
  return city._bends.get(ci * 64 + cj) || [];
}

export function buildChunk(world, ci, cj, mats, tex) {
  const city = world.city; const x0 = ci * CH, z0 = cj * CH, x1 = x0 + CH, z1 = z0 + CH;
  const group = new THREE.Group(); group.name = `chunk${ci}_${cj}`;
  const ch = world.chunk(ci, cj);
  const neon = new GB(); // emissive trim: LED lines, reflectors, signal lamps
  const glowExtra = [];

  // ---- terrain ------------------------------------------------------------------------------------------------------------------------
  {
    const N = 24, cell = CH / N, g = new GB(); const H = new Float32Array((N + 3) * (N + 3));
    for (let j = -1; j <= N + 1; j++) for (let i = -1; i <= N + 1; i++) H[(j + 1) * (N + 3) + i + 1] = city.terrainH(x0 + i * cell, z0 + j * cell);
    const h = (i, j) => H[(j + 1) * (N + 3) + i + 1];
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const x = x0 + i * cell, z = z0 + j * cell, y = h(i, j);
      const nx = (h(i - 1, j) - h(i + 1, j)) / (2 * cell), nz = (h(i, j - 1) - h(i, j + 1)) / (2 * cell); const nl = Math.hypot(nx, 1, nz);
      const sd = shoreDist(x, z); const d = districtAt(x, z); const forest = d && d.style === "forest";
      const nz1 = fbm(x * 0.02, z * 0.02, 2), nz2 = fbm(x * 0.09, z * 0.09, 6), slope = Math.hypot(nx, nz);
      let r, gg, b;
      if (y < 0.2) { r = 0.05; gg = 0.07; b = 0.09; }
      else if (sd < 28) { r = 0.2 + nz1 * 0.06; gg = 0.175 + nz1 * 0.05; b = 0.12; }
      else if (forest || y > 14 || slope > 0.35) { const k = 0.75 + nz1 * 0.6 + nz2 * 0.3; r = 0.05 * k; gg = 0.12 * k; b = 0.055 * k; }
      else { const k = 0.8 + nz1 * 0.5 + nz2 * 0.25; r = 0.12 * k; gg = 0.122 * k; b = 0.105 * k; }
      g.v(x, y, z, nx / nl, 1 / nl, nz / nl, r, gg, b, x * 0.13, z * 0.13);
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i; g.tri(a, a + N + 1, a + 1); g.tri(a + 1, a + N + 1, a + N + 2); }
    const m = new THREE.Mesh(g.build(), mats.terrain); m.receiveShadow = false; group.add(m);
  }

  // ---- roads, decks, piers, pavements, crossings, gantries ---------------------------------------------------------------------------------
  {
    const road = new GB(), deck = new GB(), seen = new Set(), walk = new GB(), decal = new GB(), sign = new GB(), poles = new GB(), tube = new GB(); const era46 = world.era === "2046";
    const concrete = C(0x77777f), under = C(0x4a4a52), kerbFace = C(0x7a7a84), white = C(0xffffff), pave = C(0xd8d8e0);
    const LED = [HOT(0.75, 0.9, 1, 1.1), HOT(1, 0.62, 0.2, 1.0), HOT(1, 0.85, 0.5, 0.8)];
    city.nearSegs((x0 + x1) / 2, (z0 + z1) / 2, CH / 2 + 40, (r, i) => {
      const key = r.idx * 65536 + i; if (seen.has(key)) return; seen.add(key);
      const p = r.pts[i], q = r.pts[i + 1]; if (Math.max(p.x, q.x) < x0 - 30 || Math.min(p.x, q.x) > x1 + 30 || Math.max(p.z, q.z) < z0 - 30 || Math.min(p.z, q.z) > z1 + 30) return;
      pointNormals(r); const hw = r.width / 2; const band = ROAD_BAND[r.cls] ?? 3;
      const u0 = (band * BAND_W + 4) / ATLAS_W, u1 = ((band + 1) * BAND_W - 4) / ATLAS_W;
      const bias = (r.cls === "hwy" ? 0.03 : r.cls === "art" ? 0.02 : 0.01) + (r.idx % 7) * 0.0015;
      const nxp = r._nx[i], nzp = r._nz[i], nxq = r._nx[i + 1], nzq = r._nz[i + 1];
      const L = [p.x + nxp * hw, p.y + bias, p.z + nzp * hw], R = [p.x - nxp * hw, p.y + bias, p.z - nzp * hw];
      const L2 = [q.x + nxq * hw, q.y + bias, q.z + nzq * hw], R2 = [q.x - nxq * hw, q.y + bias, q.z - nzq * hw];
      const v0 = p.s / 16, v1 = q.s / 16;
      road.quadV(R, L, L2, R2, white, [u0, v0, u1, v0, u1, v1, u0, v1]);
      if (p.tun && q.tun) { // inside the twin tunnel: concrete walls and ceiling, light strips, reflectors
        const CEIL = 7.6, o2 = 1.0, wc = DARK(0.5), cc = DARK(0.34), ty = (P2, h) => [P2[0], P2[1] - bias + h, P2[2]];
        const Lw = [p.x + nxp * (hw + o2), p.y, p.z + nzp * (hw + o2)], Rw = [p.x - nxp * (hw + o2), p.y, p.z - nzp * (hw + o2)], Lw2 = [q.x + nxq * (hw + o2), q.y, q.z + nzq * (hw + o2)], Rw2 = [q.x - nxq * (hw + o2), q.y, q.z - nzq * (hw + o2)];
        const uA = p.s / 4, uB = q.s / 4;
        dq(tube, Lw, Lw2, ty(Lw2, CEIL), ty(Lw, CEIL), wc, [uA, 0, uB, 0, uB, 2, uA, 2]); dq(tube, Rw2, Rw, ty(Rw, CEIL), ty(Rw2, CEIL), wc, [uB, 0, uA, 0, uA, 2, uB, 2]);
        dq(tube, ty(Lw, CEIL), ty(Lw2, CEIL), ty(Rw2, CEIL), ty(Rw, CEIL), cc, [0, uA, 0, uB, 3, uB, 3, uA]);
        for (const sg of [-0.5, 0.5]) { const a = [p.x + nxp * hw * sg, p.y + CEIL - 0.04, p.z + nzp * hw * sg], b = [q.x + nxq * hw * sg, q.y + CEIL - 0.04, q.z + nzq * hw * sg]; const a2 = [a[0] + nxp * 0.18, a[1], a[2] + nzp * 0.18], b2 = [b[0] + nxq * 0.18, b[1], b[2] + nzq * 0.18]; const a1 = [a[0] - nxp * 0.18, a[1], a[2] - nzp * 0.18], b1 = [b[0] - nxq * 0.18, b[1], b[2] - nzq * 0.18]; dq(neon, a1, b1, b2, a2, HOT(0.85, 0.93, 1, 2.0)); }
        for (const sg of [-1, 1]) { const o = hw + o2 - 0.04; const a = [p.x + nxp * sg * o, p.y + 1.0, p.z + nzp * sg * o], b = [q.x + nxq * sg * o, q.y + 1.0, q.z + nzq * sg * o]; dq(neon, a, b, [b[0], b[1] + 0.14, b[2]], [a[0], a[1] + 0.14, a[2]], HOT(1, 0.6, 0.12, 1.6)); }
        if (i % 3 === 0) glowExtra.push(p.x, p.y + CEIL - 0.4, p.z, 0.85, 0.92, 1, 11);
      }
      if (era46 && !r.ramp && !p.tun && r.cls !== "str" && p.w < 0.35) { // 2046: smart LED lane edges
        const ledc = r.cls === "hwy" ? HOT(0.3, 0.85, 1, 1.5) : HOT(0.7, 1, 0.8, 1.2); const ye = bias + 0.012;
        for (const sg of [-1, 1]) { const o1 = hw - 0.55, o2b = hw - 0.8; const a = [p.x + nxp * sg * o1, p.y + ye, p.z + nzp * sg * o1], a2 = [p.x + nxp * sg * o2b, p.y + ye, p.z + nzp * sg * o2b], b = [q.x + nxq * sg * o1, q.y + ye, q.z + nzq * sg * o1], b2 = [q.x + nxq * sg * o2b, q.y + ye, q.z + nzq * sg * o2b]; if (i % 2 === 0) { if (sg > 0) neon.quadV(a2, a, b, b2, ledc); else neon.quadV(a, a2, b2, b, ledc); } }
      }
      const elevated = p.y - p.g > 1.4 || q.y - q.g > 1.4 || p.w > 0.35;
      if (elevated) {
        const t = 1.3;
        const Lb = [L[0], L[1] - t, L[2]], Rb = [R[0], R[1] - t, R[2]], L2b = [L2[0], L2[1] - t, L2[2]], R2b = [R2[0], R2[1] - t, R2[2]];
        deck.quadV(L, Lb, L2b, L2, concrete); deck.quadV(R2, R2b, Rb, R, concrete); deck.quadV(Rb, R2b, L2b, Lb, under);
        // glowing LED fascia along both deck edges
        const led = r.cls === "hwy" ? LED[0] : LED[1]; const o = 0.05;
        neon.quadV([L[0] + nxp * o, L[1] - 0.18, L[2] + nzp * o], [L[0] + nxp * o, L[1] - 0.5, L[2] + nzp * o], [L2[0] + nxq * o, L2[1] - 0.5, L2[2] + nzq * o], [L2[0] + nxq * o, L2[1] - 0.18, L2[2] + nzq * o], led);
        neon.quadV([R2[0] - nxq * o, R2[1] - 0.18, R2[2] - nzq * o], [R2[0] - nxq * o, R2[1] - 0.5, R2[2] - nzq * o], [R[0] - nxp * o, R[1] - 0.5, R[2] - nzp * o], [R[0] - nxp * o, R[1] - 0.18, R[2] - nzp * o], led);
        if (i % 3 === 0 && p.y - p.g > 2.8) { // pier with a T-shaped cap
          const bot = Math.max(p.g, -3), hgt = p.y - 1.3 - bot; if (hgt > 1) {
            const rot = Math.atan2(q.z - p.z, q.x - p.x); const offs = r.width > 16 ? [-hw * 0.5, hw * 0.5] : [0];
            let placed = 0;
            for (const oo of offs) { if (city.blockedByRoad(p.x + nxp * oo, p.z + nzp * oo, p.y - 1, r, 2.2, p.g - 2)) continue; deck.box(p.x + nxp * oo, bot, p.z + nzp * oo, 2.1, hgt, 2.1, rot, concrete); placed++; }
            if (placed) deck.box(p.x, p.y - 2.5, p.z, 3.2, 1.2, r.width * 0.8, rot, C(0x6c6c76));
          }
        }
      } else if (r.cls !== "hwy") { // pavement strips with real paving and a kerb
        const sw = 2.2, yk = 0.16;
        for (const sgn of [1, -1]) {
          const a = [p.x + nxp * sgn * hw, p.y + yk, p.z + nzp * sgn * hw], b = [p.x + nxp * sgn * (hw + sw), p.y + yk, p.z + nzp * sgn * (hw + sw)];
          const a2 = [q.x + nxq * sgn * hw, q.y + yk, q.z + nzq * sgn * hw], b2 = [q.x + nxq * sgn * (hw + sw), q.y + yk, q.z + nzq * sgn * (hw + sw)];
          const pv = [0, p.s / 2.4, 1, p.s / 2.4, 1, q.s / 2.4, 0, q.s / 2.4];
          if (sgn > 0) walk.quadV(a, b, b2, a2, pave, pv); else walk.quadV(b, a, a2, b2, pave, [1, p.s / 2.4, 0, p.s / 2.4, 0, q.s / 2.4, 1, q.s / 2.4]);
          const a0 = [a[0], p.y, a[2]], a20 = [a2[0], q.y, a2[2]];
          if (sgn > 0) walk.quadV(a0, a, a2, a20, kerbFace, [0, 0, 0, 0.02, 0, 0.02, 0, 0]); else walk.quadV(a20, a2, a, a0, kerbFace, [0, 0, 0, 0.02, 0, 0.02, 0, 0]);
        }
      }
    });
    // zebra crossings and traffic signals at junctions
    const nodes = nodesByChunk(city).get(ci * 64 + cj) || [];
    for (const n of nodes) {
      if (n.y - baseHRef(city, n) > 1.6) continue;
      let sig = 0;
      for (const eid of n.edges) {
        const e = city.edges[eid]; if (e.cls === "hwy" || e.len < 34) continue; const r = city.roads[e.r]; if (r.ramp) continue;
        const fromA = e.a === n.id; const pt = fromA ? r.pts[Math.min(r.pts.length - 1, e.i0 + 1)] : r.pts[Math.max(0, e.i1 - 1)]; const bp = fromA ? r.pts[e.i0] : r.pts[e.i1];
        let dx = pt.x - bp.x, dz = pt.z - bp.z; const l = Math.hypot(dx, dz); if (l < 0.5) continue; dx /= l; dz /= l; const nx = -dz, nz = dx; const hw = r.width / 2;
        const dist = 8.5 + hw * 0.4; const cx = n.x + dx * dist, cz = n.z + dz * dist; const cy = n.y + 0.07;
        const A = [cx - nx * (hw - 0.4) - dx * 1.7, cy, cz - nz * (hw - 0.4) - dz * 1.7], B = [cx + nx * (hw - 0.4) - dx * 1.7, cy, cz + nz * (hw - 0.4) - dz * 1.7], Cc = [cx + nx * (hw - 0.4) + dx * 1.7, cy, cz + nz * (hw - 0.4) + dz * 1.7], D = [cx - nx * (hw - 0.4) + dx * 1.7, cy, cz - nz * (hw - 0.4) + dz * 1.7];
        const zu0 = (4 * BAND_W + 4) / ATLAS_W, zu1 = (5 * BAND_W - 4) / ATLAS_W; // order so the quad faces up
        decal.quadV(A, D, Cc, B, white, [zu0, 0, zu0, 0.2, zu1, 0.2, zu1, 0]);
        // stop line before the crossing
        const sx = cx - dx * 3.2, sz = cz - dz * 3.2; decal.quadV([sx - nx * (hw - 0.3), cy, sz - nz * (hw - 0.3)], [sx - nx * (hw - 0.3) - dx * 0.4, cy, sz - nz * (hw - 0.3) - dz * 0.4], [sx + nx * 0 - dx * 0.4, cy, sz + nz * 0 - dz * 0.4], [sx + nx * 0, cy, sz + nz * 0], white, [zu0, 0, zu0, 0.02, zu1 - 0.03, 0.02, zu1 - 0.03, 0]);
        if (sig < 2 && r.cls === "art") { // signal pole on the near corner
          sig++; const side = (hash2(n.id, sig) < 0.5 ? 1 : -1); const px = cx - dx * 4.5 + nx * side * (hw + 1.1), pz = cz - dz * 4.5 + nz * side * (hw + 1.1);
          poles.box(px, n.y, pz, 0.2, 5.4, 0.2, 0, C(0x30323a)); const ang = Math.atan2(-nz * side, -nx * side); poles.box(px - nx * side * 1.8, n.y + 5.1, pz - nz * side * 1.8, 3.6, 0.14, 0.14, Math.atan2(-nz * side, -nx * side), C(0x30323a));
          const hx = px - nx * side * 3.2, hz = pz - nz * side * 3.2; poles.box(hx, n.y + 4.1, hz, 0.45, 1.3, 0.4, ang, C(0x14151a));
          const st = hsh(n.id * 7 + eid) < 0.5 ? 0 : 2; const lc = [[1, 0.1, 0.08], [1, 0.7, 0.1], [0.12, 1, 0.3]][st];
          neon.box(hx - dx * 0.0, n.y + 4.1 + (st === 0 ? 0.42 : st === 2 ? -0.42 : 0), hz, 0.26, 0.26, 0.42, ang, HOT(lc[0], lc[1], lc[2], 2.2));
          glowExtra.push(hx, n.y + 4.5 + (st === 0 ? 0 : -0.84), hz, lc[0], lc[1], lc[2], 6.5);
        }
      }
    }
    // overhead green gantry boards over the motorways
    for (const r of city.roads) {
      if (r.cls !== "hwy") continue; if (r.pts[0].x > x1 + 600 && r.pts[r.pts.length - 1].x > x1 + 600) continue;
      pointNormals(r); const off = (r.idx * 131) % 520;
      for (let s = 140 + off; s < r.len - 120; s += 520) {
        // slide the gantry along the road until both its legs stand clear of any other road
        let p = null, q = null, tx = 0, tz = 0, nx = 0, nz = 0, hw = r.width / 2 + 1.4;
        for (const dsl of [0, 25, -25, 55, -55, 90, -90]) {
          const s2 = s + dsl; if (s2 < 40 || s2 > r.len - 40) continue; let k = 0; while (k < r.pts.length - 2 && r.pts[k + 1].s < s2) k++; const pp = r.pts[k], qq = r.pts[k + 1]; if (pp.tun) continue;
          const tl2 = Math.hypot(qq.x - pp.x, qq.z - pp.z) || 1; const ux = (qq.x - pp.x) / tl2, uz = (qq.z - pp.z) / tl2; let clear = true;
          for (const sg of [-1, 1]) if (city.blockedByRoad(pp.x - uz * hw * sg, pp.z + ux * hw * sg, pp.y + 8, r, 0.6, pp.y - 3.5)) clear = false;
          if (clear) { p = pp; q = qq; tx = ux; tz = uz; nx = -uz; nz = ux; break; }
        }
        if (!p || p.x < x0 || p.x >= x1 || p.z < z0 || p.z >= z1) continue;
        const rot = Math.atan2(tz, tx); const hgt = 7.6; const y = p.y;
        for (const sg of [-1, 1]) poles.box(p.x + nx * hw * sg, y - 0.3, p.z + nz * hw * sg, 0.55, hgt + 0.3, 0.55, rot, C(0x6f7078));
        poles.box(p.x, y + hgt, p.z, 0.5, 0.7, hw * 2 + 0.6, rot, C(0x6f7078));
        // each face names the place a driver who can read it is actually heading for (the face looking back along the road is read by traffic going forward)
        for (const f of [1, -1]) {
          const bi = destBoard(r, p, -f * tx, -f * tz); if (bi < 0) continue;
          const bu = (bi % 2) * 0.5, bv = 1 - Math.floor(bi / 2) / BOARD_ROWS, vh = 1 / BOARD_ROWS; const uvr = [bu + 0.004, bv - vh * 0.97, bu + 0.496, bv - vh * 0.03];
          const bx = p.x + tx * f * 0.34, bz = p.z + tz * f * 0.34; sign.panel(bx, y + hgt - 1.35, bz, tx * f, tz * f, 8.2, 2.05, C(0xffffff), uvr);
        }
        glowExtra.push(p.x, y + hgt + 0.8, p.z, 0.9, 0.95, 1, 8);
      }
    }
    // tunnel portals: a heavy concrete headwall with a lit amber sign band
    for (const r of city.roads) {
      if (!r.hasTunnel) continue;
      for (const [k, dir] of [[r.tunFrom, 1], [r.tunTo, -1]]) {
        const p = r.pts[k], q = r.pts[Math.max(0, Math.min(r.pts.length - 1, k + dir))]; if (p.x < x0 || p.x >= x1 || p.z < z0 || p.z >= z1) continue;
        const tl = Math.hypot(q.x - p.x, q.z - p.z) || 1; const tx = (q.x - p.x) / tl, tz = (q.z - p.z) / tl; const nx = -tz, nz = tx; const rot = Math.atan2(tz, tx); const hw = r.width / 2 + 1.0;
        const px = p.x - tx * dir * 0.0, pz = p.z - tz * dir * 0.0;
        const wing = 9;
        for (const sg of [-1, 1]) poles.box(px + nx * sg * (hw + wing / 2), p.y - 1, pz + nz * sg * (hw + wing / 2), 3.0, 17, wing, rot, C(0x6a6a72));
        poles.box(px, p.y + 7.6, pz, 3.0, 9, hw * 2 + 0.2, rot, C(0x6a6a72));
        poles.box(px - tx * dir * 0.1, p.y + 7.2, pz - tz * dir * 0.1, 3.3, 0.5, hw * 2 + 0.6, rot, C(0x8a8a92));
        neon.box(px - tx * dir * 1.6, p.y + 7.9, pz - tz * dir * 1.6, 0.2, 0.55, hw * 1.7, rot, HOT(1, 0.62, 0.15, 1.6));
        glowExtra.push(px - tx * dir * 2.4, p.y + 8.1, pz - tz * dir * 2.4, 1, 0.65, 0.2, 14);
      }
    }
    // 2046 metro: elevated viaducts with pier frames, rails, glowing parapets, catenary masts and long stations
    for (const L of city.metro) {
      const col = new THREE.Color(L.color), lc = HOT(col.r, col.g, col.b, 1.8), hwM = 4.9, concreteM = C(0x8a8a94), underM = C(0x55555e), railC = C(0x1a1a20);
      for (let i = 0; i < L.pts.length - 1; i++) {
        const p = L.pts[i], q = L.pts[i + 1]; if (p.x < x0 || p.x >= x1 || p.z < z0 || p.z >= z1) continue;
        const tl = Math.hypot(q.x - p.x, q.z - p.z) || 1; const tx = (q.x - p.x) / tl, tz = (q.z - p.z) / tl; const nx = -tz, nz = tx; const rot = Math.atan2(tz, tx);
        const Lp = [p.x + nx * hwM, p.y, p.z + nz * hwM], Rp = [p.x - nx * hwM, p.y, p.z - nz * hwM], Lq = [q.x + nx * hwM, q.y, q.z + nz * hwM], Rq = [q.x - nx * hwM, q.y, q.z - nz * hwM]; const t = 1.7;
        const dn = (A) => [A[0], A[1] - t, A[2]];
        deck.quadV(Rp, Lp, Lq, Rq, C(0x5c5c66)); deck.quadV(Lp, dn(Lp), dn(Lq), Lq, concreteM); deck.quadV(Rq, dn(Rq), dn(Rp), Rp, concreteM); deck.quadV(dn(Rp), dn(Rq), dn(Lq), dn(Lp), underM);
        for (const sg of [-1, 1]) { const a = [p.x + nx * sg * (hwM - 0.1), p.y, p.z + nz * sg * (hwM - 0.1)], b = [q.x + nx * sg * (hwM - 0.1), q.y, q.z + nz * sg * (hwM - 0.1)]; dq(deck, a, b, [b[0], b[1] + 1.2, b[2]], [a[0], a[1] + 1.2, a[2]], concreteM); const a3 = [a[0] + nx * sg * 0.05, a[1] + 0.35, a[2] + nz * sg * 0.05], b3 = [b[0] + nx * sg * 0.05, b[1] + 0.35, b[2] + nz * sg * 0.05]; dq(neon, a3, b3, [b3[0], b3[1] + 0.12, b3[2]], [a3[0], a3[1] + 0.12, a3[2]], lc); }
        for (const sg of [-1.4, 1.4]) { const a = [p.x + nx * sg - nx * 0.07, p.y + 0.15, p.z + nz * sg - nz * 0.07], a2 = [p.x + nx * sg + nx * 0.07, p.y + 0.15, p.z + nz * sg + nz * 0.07], b = [q.x + nx * sg - nx * 0.07, q.y + 0.15, q.z + nz * sg - nz * 0.07], b2 = [q.x + nx * sg + nx * 0.07, q.y + 0.15, q.z + nz * sg + nz * 0.07]; deck.quadV(a, b, b2, a2, railC); }
        if (i % 5 === 0) { const sx = p.x + nx * (hwM - 0.5), sz = p.z + nz * (hwM - 0.5); poles.box(sx, p.y, sz, 0.3, 7.2, 0.3, rot, C(0x55555e)); poles.box(sx - nx * 2.3, p.y + 6.9, sz - nz * 2.3, 0.2, 0.2, 4.6, rot, C(0x55555e)); glowExtra.push(sx - nx * 4.2, p.y + 6.8, sz - nz * 4.2, 0.6, 0.85, 1, 3.4); }
        if (i % 3 === 0) {
          let okP = 0; for (const sg of [-1, 1]) { const px = p.x + nx * sg * L.halfW, pz = p.z + nz * sg * L.halfW; if (city.blockedByRoad(px, pz, p.y - 2, null, 0.8)) continue; okP++; const gy = city.groundH(px, pz); const hgt = p.y - t - gy + 0.4; if (hgt > 1) deck.box(px, gy - 0.3, pz, 1.8, hgt, 1.8, rot, concreteM); }
          if (okP === 2) deck.box(p.x, p.y - t - 1.5, p.z, 2.4, 1.6, L.halfW * 2 + 1.8, rot, concreteM);
        }
      }
      for (const st of L.stations) {
        if (st.x < x0 || st.x >= x1 || st.z < z0 || st.z >= z1) continue;
        const p = L.pts[st.k], q = L.pts[st.k + 1]; const tl = Math.hypot(q.x - p.x, q.z - p.z) || 1; const tx = (q.x - p.x) / tl, tz = (q.z - p.z) / tl; const nx = -tz, nz = tx; const rot = Math.atan2(tz, tx); const y = st.y;
        deck.box(st.x, y - 1.7, st.z, 100, 1.7, 17.5, rot, C(0x9a9aa4)); // platform slab
        poles.box(st.x, y + 5.6, st.z, 104, 0.45, 19, rot, C(0x2a2e38));
        neon.box(st.x, y + 5.45, st.z, 104.2, 0.16, 19.2, rot, lc);
        for (let c2 = -3; c2 <= 3; c2++) for (const sg of [-1, 1]) poles.box(st.x + tx * c2 * 15, y, st.z + tz * c2 * 15 + 0, 0.5, 5.6, 0.5, rot, C(0x3a3e48)), void sg;
        for (let c2 = -2; c2 <= 2; c2++) glowExtra.push(st.x + tx * c2 * 20, y + 5.0, st.z + tz * c2 * 20, 0.95, 0.98, 1, 12);
        glowExtra.push(st.x + tx * 56, y + 5, st.z + tz * 56, col.r, col.g, col.b, 28); glowExtra.push(st.x - tx * 56, y + 5, st.z - tz * 56, col.r, col.g, col.b, 28);
      }
    }
    if (!tube.empty) group.add(new THREE.Mesh(tube.build(), mats.walk));
    if (!road.empty) group.add(new THREE.Mesh(road.build(), mats.road));
    if (!decal.empty) { const m = new THREE.Mesh(decal.build(), mats.decal); m.renderOrder = 1; group.add(m); }
    if (!deck.empty) group.add(new THREE.Mesh(deck.build(), mats.concrete));
    if (!walk.empty) group.add(new THREE.Mesh(walk.build(), mats.walk));
    if (!sign.empty) group.add(new THREE.Mesh(sign.build(), mats.signs));
    if (!poles.empty) group.add(new THREE.Mesh(poles.build(), mats.props));
  }

  // ---- crash barriers (the same lines the car collides with), with reflector studs --------------------------------------------------------------
  {
    const g = new GB(); const col = C(0x9a9aa2), top = C(0xb8b8c0);
    let kk = 0;
    for (const w of world.wallsIn(ci, cj)) {
      const dx = w.x2 - w.x1, dz = w.z2 - w.z1, l = Math.hypot(dx, dz) || 1; const rot = Math.atan2(dz, dx);
      g.box((w.x1 + w.x2) / 2, w.y - 0.25, (w.z1 + w.z2) / 2, l + 0.15, 1.25, 0.4, rot, col, top);
      g.box((w.x1 + w.x2) / 2, w.y + 0.4, (w.z1 + w.z2) / 2, l + 0.1, 0.1, 0.55, rot, C(0xc9c9d2));
      if (l > 5 && (kk++ % 2 === 0)) { const nx = -dz / l, nz = dx / l; neon.box((w.x1 + w.x2) / 2 + nx * 0.22, w.y + 0.12, (w.z1 + w.z2) / 2 + nz * 0.22, 0.5, 0.14, 0.06, rot, kk % 4 ? HOT(1, 0.62, 0.15, 1.4) : HOT(0.9, 0.95, 1, 1.2)); }
    }
    if (!g.empty) group.add(new THREE.Mesh(g.build(), mats.props));
  }

  // ---- buildings -------------------------------------------------------------------------------------------------------------------------------------
  {
    const fac = { res: new GB(), office: new GB(), ind: new GB() }, band = { shops0: new GB(), shops1: new GB(), shops2: new GB(), shops3: new GB(), shops4: new GB(), lobby: new GB(), dock: new GB() }, roof = new GB(), glow = [], ads = new GB(), blades = new GB();
    const roofCol = [C(0x2c2b30), C(0x3a3a40), C(0x4a3a30), C(0x28323a)], ledge = C(0x8a867e), ledgeDk = C(0x4c4a48);
    for (const b of ch.buildings) {
      const kind = FACADE_OF[b.style] || "res"; const g = fac[kind]; const T = tex[kind];
      const c = Math.cos(b.rot), s = Math.sin(b.rot), hw = b.w / 2, hd = b.d / 2;
      let ymin = 1e9, yc = city.groundH(b.x, b.z); const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, lz]) => { const x = b.x + lx * c - lz * s, z = b.z + lx * s + lz * c; ymin = Math.min(ymin, city.groundH(x, z)); return [x, z]; });
      const yb = Math.min(ymin, yc) - 0.6, yt = yb + b.h + Math.max(0, yc - ymin) + 0.6;
      const k = kind === "office" ? 0.8 + (b.id % 5) * 0.045 : 0.95; const bc = kind === "office" ? C(b.style === "glass" || b.style === "future" ? b.color : 0xffffff, 1) : C(b.color, 0.62 + (b.id % 4) * 0.08);
      const col = kind === "office" ? rgb(bc.r * k, bc.g * k, bc.b * k) : bc;
      const u0 = ((b.id * 7) % 8) / 8, v0 = ((b.id * 5) % 8) / 8;
      const bkey0 = BAND_OF[b.style]; const bkey = bkey0 === "shops" ? "shops" + (b.id % 5) : bkey0; const useBand = bkey && b.h > (bkey0 === "shops" ? 9 : 14) && (kind !== "ind" || b.h > 7); const bandH = useBand ? 4.2 : 0; const T2 = useBand ? tex[bkey] : null;
      const dark = (m) => rgb(col.r * m, col.g * m, col.b * m);
      for (let e = 0; e < 4; e++) {
        const A = corners[e], B = corners[(e + 1) % 4]; const len = Math.hypot(B[0] - A[0], B[1] - A[1]); const uu = len / T.uvW;
        const yu = yb + bandH, h1 = Math.min(yt, yu + 16); // upper wall: darker toward the street, lighter above
        if (useBand) {
          const bu = ((b.id * 3 + e * 5) % 7) / 7, uw = len / T2.uvW; band[bkey].quadG([B[0], yb, B[1]], [A[0], yb, A[1]], [A[0], yu, A[1]], [B[0], yu, B[1]], [dark(0.55), dark(0.55), dark(0.8), dark(0.8)], [bu, 0, bu + uw, 0, bu + uw, 1, bu, 1]);
        }
        const va = (yu - yb) / T.uvH, vb = (h1 - yb) / T.uvH, vc = (yt - yb) / T.uvH;
        g.quadG([B[0], yu, B[1]], [A[0], yu, A[1]], [A[0], h1, A[1]], [B[0], h1, B[1]], [dark(useBand ? 0.82 : 0.58), dark(useBand ? 0.82 : 0.58), dark(1), dark(1)], [u0 + uu, v0 + va, u0, v0 + va, u0, v0 + vb, u0 + uu, v0 + vb]);
        if (yt > h1 + 0.1) g.quadG([B[0], h1, B[1]], [A[0], h1, A[1]], [A[0], yt, A[1]], [B[0], yt, B[1]], [dark(1), dark(1), dark(1.08), dark(1.08)], [u0 + uu, v0 + vb, u0, v0 + vb, u0, v0 + vc, u0 + uu, v0 + vc]);
      }
      const rc = b.style === "dense" ? (b.id % 3 === 0 ? C(0x2a5fa8, 0.7) : b.id % 3 === 1 ? C(0xb05a28, 0.5) : roofCol[b.id % 4]) : roofCol[b.id % 4];
      roof.quadV([corners[0][0], yt, corners[0][1]], [corners[3][0], yt, corners[3][1]], [corners[2][0], yt, corners[2][1]], [corners[1][0], yt, corners[1][1]], rc);
      // parapet and cornice ring (gives every roof a proper edge)
      if (b.h < 90) for (let e = 0; e < 4; e++) { const A = corners[e], B = corners[(e + 1) % 4]; const len = Math.hypot(B[0] - A[0], B[1] - A[1]); const ang = Math.atan2(B[1] - A[1], B[0] - A[0]); roof.box((A[0] + B[0]) / 2, yt - 0.35, (A[1] + B[1]) / 2, len + 0.3, 0.45, 0.5, ang, ledge); roof.box((A[0] + B[0]) / 2, yt + 0.1, (A[1] + B[1]) / 2, len, kind === "ind" ? 0.7 : 0.9, 0.3, ang, ledgeDk); }
      if (b.h < 60) { if (b.id % 3 === 0) { roof.geo(cyl, b.x + c * hw * 0.3, yt, b.z + s * hw * 0.3, 1.1, 1.7, 1.1, 0, C(0x1d5ca8, 0.9)); roof.geo(cyl, b.x + c * hw * 0.3 + 2.7, yt, b.z + s * hw * 0.3, 1.1, 1.7, 1.1, 0, C(0x1d5ca8, 0.7)); } if (b.id % 2 === 0) roof.box(b.x - c * hw * 0.35, yt, b.z - s * hw * 0.35, 2.6, 1.4, 2.0, b.rot, C(0x55555c)); if (b.id % 5 === 1) { roof.geo(cone, b.x + c * hw * 0.5, yt, b.z + s * hw * 0.5, 0.2, 7, 0.2, 0, C(0x666670)); } }
      else { roof.box(b.x, yt, b.z, 3.2, 2.4, 3.2, b.rot, C(0x45454c)); roof.box(b.x, yt + 2.4, b.z, b.w * 0.55, 3.5, b.d * 0.55, b.rot, C(0x3a3e46)); roof.geo(cone, b.x, yt + 5.9, b.z, 0.35, Math.min(26, b.h * 0.12), 0.35, 0, C(0x666670)); glow.push(b.x, yt + 5.9 + Math.min(26, b.h * 0.12), b.z, 1, 0.1, 0.08, 9); }
      // LED crown and corner strips on tall towers
      if (kind === "office" && b.h > 36) {
        const tint = [[0.25, 0.9, 1], [1, 0.25, 0.7], [1, 0.75, 0.25], [0.75, 0.85, 1]][b.id % 4]; const led = HOT(tint[0], tint[1], tint[2], 1.9); const o = 0.06;
        for (let e = 0; e < 4; e++) { const A = corners[e], B = corners[(e + 1) % 4]; const dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz) || 1; const nx = dz / l, nz = -dx / l; neon.quadV([A[0] + nx * o, yt - 1.7, A[1] + nz * o], [B[0] + nx * o, yt - 1.7, B[1] + nz * o], [B[0] + nx * o, yt - 0.7, B[1] + nz * o], [A[0] + nx * o, yt - 0.7, A[1] + nz * o], led); }
        if (b.id % 3 === 0) for (const ci2 of [0, 2]) { const P = corners[ci2]; neon.box(P[0], yb + bandH + 2, P[1], 0.4, yt - yb - bandH - 4, 0.4, b.rot, HOT(tint[0], tint[1], tint[2], 1.4)); }
      }
      // rooftop billboards and blade signs face the nearest road
      if (b.h > 12 && b.h < 80 && (kind === "res" || kind === "office") && (b.id % 11 === 0 || b.id % 13 === 5)) {
        const nr = city.nearestRoad(b.x, b.z, 90); if (nr) {
          let fx = -s, fz = c; const tx = nr.x - b.x, tz = nr.z - b.z; if (fx * tx + fz * tz < 0) { fx = -fx; fz = -fz; }
          const ext = Math.abs(fx * (-s) + fz * c) > 0.7 ? hd : hw; const px = b.x + fx * (ext * 0.6), pz = b.z + fz * (ext * 0.6); const py = yt + 6.6; const W = Math.min(14, Math.max(8, b.w * 0.7));
          const ad = b.id % 8, au = (ad % 2) * 0.5, av = 1 - Math.floor(ad / 2) / 4; const uvr = [au + 0.006, av - 0.246, au + 0.494, av - 0.006];
          ads.panel(px, py, pz, fx, fz, W, W / 2, C(0xffffff, 1.15), uvr); const ad2 = (b.id + 3) % 8; const au2 = (ad2 % 2) * 0.5, av2 = 1 - Math.floor(ad2 / 2) / 4; ads.panel(px - fx * 0.3, py, pz - fz * 0.3, -fx, -fz, W, W / 2, C(0xffffff, 1.15), [au2 + 0.006, av2 - 0.246, au2 + 0.494, av2 - 0.006]);
          const ax = fz, az = -fx; for (const sg of [-0.34, 0.34]) roof.box(px - fx * 0.15 + ax * W * sg, yt, pz - fz * 0.15 + az * W * sg, 0.5, 3.8, 0.5, b.rot, C(0x3c3e46));
          roof.box(px - fx * 0.15, py - W / 4 - 0.35, pz - fz * 0.15, W + 0.5, 0.35, 0.7, Math.atan2(az, ax), C(0x3c3e46));
          for (const sg of [-0.4, 0, 0.4]) glow.push(px + fx * 1.2 + ax * W * sg, py - W / 4 - 0.1, pz + fz * 1.2 + az * W * sg, 1, 0.95, 0.85, 3.2);
          glow.push(px + fx * 2, py, pz + fz * 2, 0.9, 0.85, 0.8, 16);
        }
      }
      if (useBand && bkey0 === "shops" && b.id % 4 === 1) {
        const nr = city.nearestRoad(b.x, b.z, 80); if (nr) {
          let fx = -s, fz = c; const tx = nr.x - b.x, tz = nr.z - b.z; if (fx * tx + fz * tz < 0) { fx = -fx; fz = -fz; } const ext = Math.abs(fx * (-s) + fz * c) > 0.7 ? hd : hw; const ax = fz, az = -fx;
          const off = ((b.id * 37) % 5 - 2) * 0.28 * (ext === hd ? b.w : b.d); const cx2 = b.x + fx * (ext + 0.62) + ax * off, cz2 = b.z + fz * (ext + 0.62) + az * off; const bi = b.id % 8; const bu = bi / 8; const uvr = [bu + 0.004, 0.01, bu + 0.121, 0.99]; const yy = yb + 6.2;
          blades.panel(cx2, yy, cz2, ax, az, 1.0, 4.0, C(0xffffff, 1.2), uvr); blades.panel(cx2, yy, cz2, -ax, -az, 1.0, 4.0, C(0xffffff, 1.2), uvr);
          roof.box(cx2 - fx * 0.3, yy - 2.1, cz2 - fz * 0.3, 0.1, 0.1, 0.8, Math.atan2(fz, fx), C(0x30323a)); glow.push(cx2, yy, cz2, [1, 0.3, 0.2, 0.2, 0.9, 0.5][bi % 6 * 1 % 6] ?? 1, 0.5, 0.8, 6);
        }
      }
    }
    for (const kd of ["res", "office", "ind"]) if (!fac[kd].empty) group.add(new THREE.Mesh(fac[kd].build(), mats.facade[kd]));
    for (const kd of ["shops0", "shops1", "shops2", "shops3", "shops4", "lobby", "dock"]) if (!band[kd].empty) group.add(new THREE.Mesh(band[kd].build(), mats.band[kd]));
    if (!roof.empty) group.add(new THREE.Mesh(roof.build(), mats.props));
    if (!ads.empty) group.add(new THREE.Mesh(ads.build(), mats.ad));
    if (!blades.empty) group.add(new THREE.Mesh(blades.build(), mats.blade));
    group.userData.glow = glow;
  }

  // ---- lamps, street furniture and trees ------------------------------------------------------------------------------------------------------------
  {
    const g = new GB(), pool = new GB(), ads2 = new GB(); const glowPts = group.userData.glow || []; for (const v of glowExtra) glowPts.push(v);
    const LC = [[1.0, 0.62, 0.25], [1.0, 0.94, 0.82], [0.74, 0.84, 1.0]];
    const pole = C(0x3a3a42); let li = 0;
    for (const l of ch.lamps) {
      li++;
      g.geo(cyl, l.x, l.y - 0.1, l.z, 0.13, l.h + 0.1, 0.13, 0, pole); g.geo(cyl, l.x, l.y - 0.1, l.z, 0.24, 0.5, 0.24, 0, C(0x2a2a30));
      const ax = -l.tz * -l.side, az = l.tx * -l.side; const hx = l.x + ax * 1.7, hz = l.z + az * 1.7;
      g.box((l.x + hx) / 2, l.y + l.h - 0.1, (l.z + hz) / 2, 1.8, 0.1, 0.1, Math.atan2(hz - l.z, hx - l.x), pole);
      const col = LC[l.c] || LC[0];
      g.box(hx, l.y + l.h - 0.28, hz, 0.95, 0.14, 0.36, Math.atan2(az, ax), C(0x1c1c22)); neon.box(hx, l.y + l.h - 0.38, hz, 0.8, 0.06, 0.28, Math.atan2(az, ax), HOT(col[0], col[1], col[2], 2.4));
      glowPts.push(hx, l.y + l.h - 0.3, hz, col[0], col[1], col[2], 5.2);
      const R = 9, y = l.y + 0.06, cr = { r: col[0] * 0.5, g: col[1] * 0.5, b: col[2] * 0.5 };
      pool.quadV([hx - R, y, hz - R], [hx - R, y, hz + R], [hx + R, y, hz + R], [hx + R, y, hz - R], cr, [0, 0, 0, 1, 1, 1, 1, 0]);
      if (li % 9 === 0 && l.h < 9) { // a bus shelter with a lit advert, facing the road
        const bx = l.x - ax * 1.2 + l.tx * 3.2, bz = l.z - az * 1.2 + l.tz * 3.2; const fx = ax, fz = az; const rot = Math.atan2(l.tz, l.tx);
        g.box(bx, l.y, bz, 3.4, 0.12, 1.3, rot, C(0x30323a)); g.box(bx, l.y + 2.5, bz, 3.6, 0.12, 1.5, rot, C(0x30323a)); g.box(bx - fx * 0.6, l.y + 0.2, bz - fz * 0.6, 3.3, 2.2, 0.06, rot, C(0x1a2630));
        const ad = (l.x * 13 + l.z * 7) % 8 | 0; const ai = Math.abs(ad); const au = (ai % 2) * 0.5, av = 1 - Math.floor(ai / 2) / 4; ads2.panel(bx + fx * 0.85, l.y + 1.4, bz + fz * 0.85, fx, fz, 1.6, 2.1, C(0xffffff, 1.1), [au + 0.01, av - 0.24, au + 0.2, av - 0.01]);
        glowPts.push(bx + fx * 1.2, l.y + 1.4, bz + fz * 1.2, 0.85, 0.9, 1, 5);
      }
    }
    const trunk = C(0x4b3a28), leaves = [C(0x3a8a40), C(0x4aa04a), C(0x2f7a38), C(0x58b04e)], bloomC = [C(0xe8482a), C(0xf0701e)], leafG = new GB(), frondG = new GB();
    const dcol = (c, k) => ({ r: c.r * k, g: c.g * k, b: c.b * k });
    for (const t of ch.trees) {
      const y = t.y - 0.1; const sc = t.s; const hv = hsh(Math.floor(t.x * 3.1) ^ Math.floor(t.z * 5.7));
      if (t.k === 0) { // coconut palm: curved trunk and ten drooping fronds
        for (let q = 0; q < 4; q++) g.geo(cyl, t.x + q * 0.1 * sc, y + q * 1.9 * sc, t.z, 0.22 * sc - q * 0.025, 2.0 * sc, 0.22 * sc - q * 0.025, 0, trunk, q * 0.03);
        const top = y + 7.5 * sc;
        for (let f = 0; f < 10; f++) { const a = (f / 10) * Math.PI * 2 + hv * 6, dx = Math.cos(a), dz = Math.sin(a), droop = f % 2 ? 0.55 : 0.2; const len = 2.5 * sc; const cx = t.x + 0.3 * sc + dx * len * 0.9, cz = t.z + dz * len * 0.9, cy = top + 0.5 * sc - droop * len * 0.7;
          card(frondG, cx, cy, cz, dx * len, -droop * len * 0.5, dz * len, -dz * len * 0.33, 0, dx * len * 0.33, 0, 1, 0, dcol(C(0x3f9a46), 0.8 + (f % 3) * 0.12)); }
        g.geo(ico, t.x + 0.3 * sc, top - 0.2, t.z, 0.4 * sc, 0.34 * sc, 0.4 * sc, 0, C(0x6a4a22));
      } else if (t.k === 1) { // broad crown: dense ring of leaf cards over a dark core
        const base = hv < 0.18 ? bloomC[hv < 0.09 ? 0 : 1] : leaves[Math.floor(hv * 4) % 4]; g.geo(cyl, t.x, y, t.z, 0.34 * sc, 4.4 * sc, 0.34 * sc, 0, trunk);
        const cy0 = y + 6.0 * sc; g.geo(ico, t.x, cy0, t.z, 2.0 * sc, 1.5 * sc, 2.0 * sc, 0, C(0x1c4a22));
        for (let q = 0; q < 26; q++) { const a = hsh(q * 7 + Math.floor(t.x)) * 6.283, e = (hsh(q * 13 + Math.floor(t.z)) - 0.35) * 2.0, rr = 2.5 * sc; const dx = Math.cos(a) * Math.cos(e), dy = Math.sin(e) * 0.8, dz = Math.sin(a) * Math.cos(e); const sz = (1.7 + hsh(q * 3 + 5) * 0.8) * sc; const rot = hsh(q * 5 + 1) * 3.14;
          const ux = -dz * Math.cos(rot) * sz, uz = dx * Math.cos(rot) * sz, uy = Math.sin(rot) * sz * 0.6; const vx = dx * Math.sin(rot) * sz * 0.5 + 0, vy = sz * Math.cos(rot) * 0.7, vz = dz * Math.sin(rot) * sz * 0.5;
          card(leafG, t.x + dx * rr, cy0 + dy * rr * 0.8, t.z + dz * rr, ux, uy, uz, vx, vy, vz, dx, dy + 0.35, dz, dcol(q % 5 === 0 ? base : leaves[(q + 1) % 4], 0.78 + hsh(q * 11 + 3) * 0.4)); }
      } else { // tall tree: three tiers of cards
        g.geo(cyl, t.x, y, t.z, 0.3 * sc, 3.4 * sc, 0.3 * sc, 0, trunk);
        for (let tier = 0; tier < 3; tier++) for (let q = 0; q < 9; q++) { const a = (q / 9) * 6.283 + tier * 0.7 + hv * 3, rr = (2.0 - tier * 0.5) * sc, cy = y + (3.6 + tier * 2.5) * sc; const dx = Math.cos(a), dz = Math.sin(a); const sz = (1.9 - tier * 0.3) * sc;
          card(leafG, t.x + dx * rr * 0.6, cy, t.z + dz * rr * 0.6, -dz * sz, 0, dx * sz, 0, sz * 0.7, 0, dx, 0.3, dz, dcol(leaves[(tier + q) % 4], 0.62 + hsh(q + tier * 9) * 0.3)); }
      }
    }
    if (!leafG.empty) group.add(new THREE.Mesh(leafG.build(), mats.leaf)); if (!frondG.empty) group.add(new THREE.Mesh(frondG.build(), mats.frond));
    if (!g.empty) group.add(new THREE.Mesh(g.build(), mats.props));
    // ---- Underground-2 style street dressing: hanging banners, chevron boards on bends, striped hazard posts with amber beacons ----
    {
      const dg = new GB(), ban = new GB(); const bendList = bendsInChunk(city, ci, cj);
      // vertical banners hung from every few lamp posts, facing the traffic
      let bi2 = 0;
      for (const l of ch.lamps) {
        bi2++; if (l.c === 2 || bi2 % 3 !== 0 || l.h > 9) continue;
        const ax = l.tz * l.side, az = -l.tx * l.side; const bx = l.x + ax * 0.55, bz = l.z + az * 0.55; const bi = Math.abs(Math.floor(l.x * 0.37 + l.z * 0.61)) % 8, bu = bi / 8, uvr = [bu + 0.004, 0.01, bu + 0.121, 0.99]; const by = l.y + l.h - 3.9;
        dg.box(bx - ax * 0.2, l.y + l.h - 1.0, bz - az * 0.2, 0.9, 0.08, 0.08, Math.atan2(az, ax), C(0x26262c)); dg.box(bx - ax * 0.2, by - 0.05, bz - az * 0.2, 0.9, 0.08, 0.08, Math.atan2(az, ax), C(0x26262c));
        ban.panel(bx, by + 1.45, bz, l.tx, l.tz, 0.95, 2.9, C(0xffffff, 1.1), uvr); ban.panel(bx, by + 1.45, bz, -l.tx, -l.tz, 0.95, 2.9, C(0xffffff, 1.1), uvr);
      }
      // planted verges: a clipped hedge with flowering shrubs on the pavement between lamp posts, like the garden boulevards
      let vi = 0;
      for (const l of ch.lamps) {
        vi++; if (l.c === 2 || vi % 2 !== 0) continue; const ax = l.tz * l.side, az = -l.tx * l.side; const hx = l.x - ax * 1.6 + l.tx * 9, hz = l.z - az * 1.6 + l.tz * 9; const rot = Math.atan2(l.tz, l.tx);
        if (city.blockedByRoad(hx, hz, l.y + 1.5, null, 0.5, l.y - 2)) continue;
        dg.box(hx, l.y, hz, 5.5, 0.8, 1.0, rot, C(0x24602c), C(0x347a38));
        for (let k = -1; k <= 1; k++) { const bl = [C(0xd8458a), C(0xf08a2a), C(0xf2e6f0)][(vi + k + 3) % 3]; dg.geo(ico, hx + l.tx * k * 1.7, l.y + 0.95, hz + l.tz * k * 1.7, 0.55, 0.42, 0.55, 0, bl); }
      }
      // red chevron boards on the outside of sharp bends
      for (const bd of bendList) for (const f of [1, -1]) {
        const fx = -bd.tx * f, fz = -bd.tz * f; const ux = fz, uz = -fx; // viewer's right
        const dir = (bd.sx * ux + bd.sz * uz) > 0 ? 1 : -1; const cx = bd.x, cz = bd.z, y0 = bd.y + 0.9;
        if (f === 1) { dg.box(cx, bd.y - 0.1, cz, 0.12, 2.2, 0.12, 0, C(0x44444c)); dg.box(cx, y0, cz, 1.7, 1.15, 0.08, Math.atan2(-fx, fz), C(0xe8e8e8)); } // post and board
        const P = (u, v) => [cx + ux * u + fx * 0.07, y0 + 0.55 + v, cz + uz * u + fz * 0.07];
        for (const c0 of [-0.42, 0.18]) {
          const q = (a, b, c2, d) => { const V = [a, b, c2, d].map((w) => P(w[0] * dir + c0 * dir, w[1])); const col = HOT(0.95, 0.1, 0.08, 1.15); if (dir > 0) neon.quadV(V[0], V[1], V[2], V[3], col); else neon.quadV(V[3], V[2], V[1], V[0], col); };
          q([-0.2, -0.42], [-0.02, -0.42], [0.28, 0], [0.1, 0]); q([0.1, 0], [0.28, 0], [-0.02, 0.42], [-0.2, 0.42]);
        }
      }
      // striped hazard posts with amber beacons at the start of crash-barrier runs
      let hz = 0; for (const w of world.wallsIn(ci, cj)) {
        if (hz++ % 5 !== 0) continue; const dx = w.x2 - w.x1, dz = w.z2 - w.z1, l = Math.hypot(dx, dz) || 1; const rot = Math.atan2(dz, dx);
        for (let k = 0; k < 4; k++) dg.box(w.x1, w.y + k * 0.4, w.z1, 0.55, 0.4, 0.55, rot, k % 2 ? C(0x16161a) : C(0xf2c200));
        neon.box(w.x1, w.y + 1.6, w.z1, 0.32, 0.22, 0.32, rot, HOT(1, 0.62, 0.05, 2.2)); glowPts.push(w.x1, w.y + 1.7, w.z1, 1, 0.6, 0.1, 5);
        if (l > 6) for (let k = 0; k < 3; k++) { const t = 0.25 + k * 0.25; dg.box(w.x1 + dx * t, w.y + 0.78, w.z1 + dz * t, 1.3, 0.16, 0.6, rot, k % 2 ? C(0x16161a) : C(0xf2c200)); }
      }
      if (!dg.empty) group.add(new THREE.Mesh(dg.build(), mats.props));
      if (!ban.empty) group.add(new THREE.Mesh(ban.build(), mats.blade));
    }
    if (!ads2.empty) group.add(new THREE.Mesh(ads2.build(), mats.ad));
    if (!neon.empty) group.add(new THREE.Mesh(neon.build(), mats.neon));
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
function baseHRef(city, n) { return city.groundH(n.x, n.z); }
function hash2(a, b) { return hsh(a * 7919 + b * 104729); }
export function disposeGroup(group) { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
