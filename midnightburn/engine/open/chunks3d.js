// Midnight Burn — turns one 256 m square of the city into 3D: terrain, roads, flyovers, buildings, lamps, trees.
import * as THREE from "three";
import { CH } from "./world";
import { IS_TOKYO } from "./mapId";
import { SL, nowMs } from "./slice";
import { isWater, shoreDist, districtAt, districtDens, fbm, W } from "./geo";
import { buildPoles } from "./poles";
import { buildWalkwayGeo } from "./walkgeo";
import { ROAD_BAND, BAND_W, ATLAS_W, BOARD_COUNT, BOARD_LIST, BOARD_ROWS } from "./textures2";
import { buildPlantMeshes } from "./vegetation";
import { pieceUV, pieceAspect, REG_N, MB_N } from "./graffiti";

// graffiti is sprinkled very thinly: a small share of quiet low walls and bridge piers get a street piece, a far smaller share the crew's own
export const GRAF = { wall: 0.013, mb: 0.0013, pier: 0.03 };
const hash01 = (n) => { let h = n | 0; h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return (h >>> 0) / 4294967296; };

// ---- a small geometry builder so each chunk is a handful of draw calls ------------------------------------------------------
// Upgrade 25: the vertex lists are typed arrays borrowed from a small pool and given back when the mesh is built, instead of ever-growing JS arrays. Building a city block used to leave
// tens of megabytes of garbage behind, and every second or so the browser stopped the game for a long clean-up; now almost nothing is left over.
const POOL = new Map(); let pooledBytes = 0; const POOL_MAX = 48 * 1024 * 1024;
function takeBuf(Type, n) { const key = Type.name + n, l = POOL.get(key); if (l && l.length) { const a = l.pop(); pooledBytes -= a.byteLength; return a; } return new Type(n); }
function giveBuf(a) { if (!a || pooledBytes + a.byteLength > POOL_MAX) return; const key = a.constructor.name + a.length; let l = POOL.get(key); if (!l) POOL.set(key, (l = [])); if (l.length < (a.length <= 6144 ? 64 : 8)) { l.push(a); pooledBytes += a.byteLength; } }
function releaseAfterUpload() { this.array = null; }
export class GB {
  constructor() { this.nv = 0; this.ni = 0; this.cap = 1024; this.icap = 3072; this.p = takeBuf(Float32Array, 3 * 1024); this.n = takeBuf(Float32Array, 3 * 1024); this.c = takeBuf(Float32Array, 3 * 1024); this.uv = takeBuf(Float32Array, 2 * 1024); this.i = takeBuf(Uint32Array, 3072); }
  grow() {
    const ncap = this.cap * 2; const mk = (old, k) => { const a = takeBuf(Float32Array, ncap * k); a.set(old); giveBuf(old); return a; };
    this.p = mk(this.p, 3); this.n = mk(this.n, 3); this.c = mk(this.c, 3); this.uv = mk(this.uv, 2); this.cap = ncap;
  }
  growI(need) { let ncap = this.icap; while (ncap < need) ncap *= 2; const a = takeBuf(Uint32Array, ncap); a.set(this.i.subarray(0, this.ni)); giveBuf(this.i); this.i = a; this.icap = ncap; }
  v(x, y, z, nx, ny, nz, r, g, b, u = 0, w = 0) {
    if (this.nv >= this.cap) this.grow(); const k = this.nv++, o = k * 3, q = k * 2;
    const P = this.p, N = this.n, Cc = this.c, U = this.uv; P[o] = x; P[o + 1] = y; P[o + 2] = z; N[o] = nx; N[o + 1] = ny; N[o + 2] = nz; Cc[o] = r; Cc[o + 1] = g; Cc[o + 2] = b; U[q] = u; U[q + 1] = w; return k;
  }
  tri(a, b, c) { if (this.ni + 3 > this.icap) this.growI(this.ni + 3); const I = this.i, o = this.ni; I[o] = a; I[o + 1] = b; I[o + 2] = c; this.ni += 3; }
  quad(a, b, c, d) { if (this.ni + 6 > this.icap) this.growI(this.ni + 6); const I = this.i, o = this.ni; I[o] = a; I[o + 1] = b; I[o + 2] = c; I[o + 3] = a; I[o + 4] = c; I[o + 5] = d; this.ni += 6; }
  get empty() { return this.ni === 0; }
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
  box(cx, y0, cz, w, h, d, rot, col, topCol, uvm = 0) { // uvm: metres per texture tile (0 = one tile per face, the old behaviour)
    const c = Math.cos(rot), s = Math.sin(rot), hw = w / 2, hd = d / 2;
    const P = (lx, lz) => [cx + lx * c - lz * s, cz + lx * s + lz * c];
    const A = P(-hw, -hd), B = P(hw, -hd), C = P(hw, hd), D = P(-hw, hd), y1 = y0 + h;
    const side = (P, Q, len) => this.quadV([Q[0], y0, Q[1]], [P[0], y0, P[1]], [P[0], y1, P[1]], [Q[0], y1, Q[1]], col, uvm ? [0, 0, len / uvm, 0, len / uvm, h / uvm, 0, h / uvm] : undefined);
    side(A, B, w); side(B, C, d); side(C, D, w); side(D, A, d);
    this.quadV([A[0], y1, A[1]], [D[0], y1, D[1]], [C[0], y1, C[1]], [B[0], y1, B[1]], topCol || col, uvm ? [0, 0, d / uvm, 0, d / uvm, w / uvm, 0, w / uvm] : undefined);
  }
  // a New-Jersey crash barrier between two points: stepped, tapered profile, textured concrete, with its base sunk a little into the ground
  jersey(x1, z1, x2, z2, y, col) {
    const dx = x2 - x1, dz = z2 - z1, l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l, nx = -uz, nz = ux; const ex = 0.07; const ax = x1 - ux * ex, az = z1 - uz * ex, bx = x2 + ux * ex, bz = z2 + uz * ex, L = l + ex * 2;
    const prof = [[-0.31, -0.15], [0.31, -0.15], [0.31, 0.1], [0.19, 0.4], [0.12, 0.88], [-0.12, 0.88], [-0.19, 0.4], [-0.31, 0.1], [-0.31, -0.15]];
    for (let k = 0; k < prof.length - 1; k++) {
      const p0 = prof[k], p1 = prof[k + 1]; const v0 = (p0[1] + 0.15) / 1.1 * 0.28, v1 = (p1[1] + 0.15) / 1.1 * 0.28;
      this.quadV([ax + nx * p0[0], y + p0[1], az + nz * p0[0]], [bx + nx * p0[0], y + p0[1], bz + nz * p0[0]], [bx + nx * p1[0], y + p1[1], bz + nz * p1[0]], [ax + nx * p1[0], y + p1[1], az + nz * p1[0]], col, [0, v0, L / 4, v0, L / 4, v1, 0, v1]);
    }
    this.quadV([ax - nx * 0.12, y + 0.88, az - nz * 0.12], [bx - nx * 0.12, y + 0.88, bz - nz * 0.12], [bx + nx * 0.12, y + 0.88, bz + nz * 0.12], [ax + nx * 0.12, y + 0.88, az + nz * 0.12], col, [0, 0.2, L / 4, 0.2, L / 4, 0.25, 0, 0.25]);
  }
  // another geometry (unit primitives) scaled, turned and moved
  geo(g, x, y, z, sx, sy, sz, rot, col, tilt = 0) {
    const pos = g.attributes.position, nor = g.attributes.normal, idx = g.index; const base = this.nv;
    const c = Math.cos(rot), s = Math.sin(rot), ct = Math.cos(tilt), st = Math.sin(tilt);
    for (let k = 0; k < pos.count; k++) {
      let px = pos.getX(k) * sx, py = pos.getY(k) * sy, pz = pos.getZ(k) * sz, nx = nor.getX(k), ny = nor.getY(k), nz = nor.getZ(k);
      if (tilt) { const a = px * ct - py * st, b = px * st + py * ct; px = a; py = b; const na = nx * ct - ny * st, nb = nx * st + ny * ct; nx = na; ny = nb; }
      this.v(x + px * c - pz * s, y + py, z + px * s + pz * c, nx * c - nz * s, ny, nx * s + nz * c, col.r, col.g, col.b, 0, 0);
    }
    if (idx) for (let k = 0; k < idx.count; k++) { if (this.ni + 1 > this.icap) this.growI(this.ni + 1); this.i[this.ni++] = base + idx.getX(k); } else for (let k = 0; k < pos.count; k++) { if (this.ni + 1 > this.icap) this.growI(this.ni + 1); this.i[this.ni++] = base + k; }
  }
  build() {
    const g = new THREE.BufferGeometry(), nv = this.nv, ni = this.ni;
    const att = (src, k) => new THREE.BufferAttribute(src.slice(0, nv * k), k); // an exact copy: the working lists go back to the pool
    g.setAttribute("position", att(this.p, 3)); g.setAttribute("normal", att(this.n, 3)); g.setAttribute("color", att(this.c, 3)); g.setAttribute("uv", att(this.uv, 2));
    g.setIndex(ni > 65000 || nv > 65000 ? new THREE.BufferAttribute(this.i.slice(0, ni), 1) : new THREE.BufferAttribute(Uint16Array.from(this.i.subarray(0, ni)), 1));
    g.computeBoundingSphere();
    this.giveBack(); return g;
  }
  giveBack() { if (this.p) { giveBuf(this.p); giveBuf(this.n); giveBuf(this.c); giveBuf(this.uv); giveBuf(this.i); this.p = this.n = this.c = this.uv = this.i = null; this.nv = this.ni = 0; this.cap = this.icap = 0; } }
}

const colCache = new Map();
export const C = (hex, k = 1) => { const key = hex + ":" + k; let c = colCache.get(key); if (!c) { c = new THREE.Color(hex).multiplyScalar(k); colCache.set(key, c); } return c; };
const rgb = (r, g, b) => ({ r, g, b });

const SIGN_STYLES = { dense: 9, old: 7, mixed: 6, colonial: 6, upscale: 4, planned: 2, suburb: 1 }; // Japan: how many of every ten buildings in each kind of district wear a full signboard front
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
  const m = new Map(); for (const n of city.nodes) { if (n.edges.length < 3) continue; const k = Math.floor(n.x / CH) * 128 + Math.floor(n.z / CH); let l = m.get(k); if (!l) m.set(k, (l = [])); l.push(n); }
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
        const x = p.x - nx * sd * hw, z = p.z - nz * sd * hw; const k = Math.floor(x / CH) * 128 + Math.floor(z / CH); let l = m.get(k); if (!l) m.set(k, (l = []));
        if (l.length < 40) l.push({ x, z, y: p.y, tx: t0x, tz: t0z, sx: nx * sd, sz: nz * sd });
      }
    }
    city._bends = m;
  }
  return city._bends.get(ci * 128 + cj) || [];
}

// Upgrade 25: a chunk is built in small slices so a new city block never freezes the picture. `buildChunkSteps` is a generator that pauses (yield) as soon as its
// time slice for this frame has run out; the picture loop (render.js) gives it a few milliseconds a frame. `buildChunk` still builds a whole block in one go (loading screen).
export function setChunkDeadline(t) { SL.t = t; }
const NOW = nowMs;
export function buildChunk(world, ci, cj, mats, tex) { const it = buildChunkSteps(world, ci, cj, mats, tex); SL.t = Infinity; let r; while (!(r = it.next()).done) { /* run to the end */ } return r.value; }
export function* buildChunkSteps(world, ci, cj, mats, tex) {
  const live = []; const GBn = () => { const g = new GB(); live.push(g); return g; }; // every builder of this block, so the unused ones can hand their lists back
  const city = world.city; const x0 = ci * CH, z0 = cj * CH, x1 = x0 + CH, z1 = z0 + CH;
  const group = new THREE.Group(); group.name = `chunk${ci}_${cj}`;
  if (NOW() > SL.t) yield 1;
  const ch = world.chunk(ci, cj);
  if (NOW() > SL.t) yield 2;
  const neon = GBn(); // emissive trim: LED lines, reflectors, signal lamps
  const gr = GBn(); // wall graffiti (flat decals just off the wall)
  const glowExtra = [];

  // ---- terrain ------------------------------------------------------------------------------------------------------------------------
  let hAt = null; // height of the drawn terrain triangles at (x, z) inside this chunk: where plants and rocks are planted
  {
    const N = city.TN, cell = CH / N, g = GBn(); const H = new Float32Array((N + 3) * (N + 3));
    for (let j = -1; j <= N + 1; j++) { for (let i = -1; i <= N + 1; i++) H[(j + 1) * (N + 3) + i + 1] = city.terrainH(x0 + i * cell, z0 + j * cell); if (NOW() > SL.t) yield 3; }
    const h = (i, j) => H[(j + 1) * (N + 3) + i + 1];
    hAt = (x, z) => { const fi = (x - x0) / cell, fj = (z - z0) / cell; const gi = Math.max(-1, Math.min(N, Math.floor(fi))), gj = Math.max(-1, Math.min(N, Math.floor(fj))); const fx = fi - gi, fz = fj - gj; const ha = h(gi, gj), hb = h(gi + 1, gj), hc = h(gi, gj + 1), hd = h(gi + 1, gj + 1); return fx + fz <= 1 ? ha + fx * (hb - ha) + fz * (hc - ha) : hd + (1 - fx) * (hc - hd) + (1 - fz) * (hb - hd); };
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      if (i === 0) { if (NOW() > SL.t) yield 4; }
      const x = x0 + i * cell, z = z0 + j * cell, y = h(i, j);
      const nx = (h(i - 1, j) - h(i + 1, j)) / (2 * cell), nz = (h(i, j - 1) - h(i, j + 1)) / (2 * cell); const nl = Math.hypot(nx, 1, nz);
      const sd = shoreDist(x, z); const d = districtAt(x, z); const forest = d && d.style === "forest";
      const nz1 = fbm(x * 0.02, z * 0.02, 2), nz2 = fbm(x * 0.09, z * 0.09, 6), slope = Math.hypot(nx, nz);
      let r, gg, b;
      if (y < 0.2) { r = 0.05; gg = 0.07; b = 0.09; }
      else if (sd < 28) { r = 0.2 + nz1 * 0.06; gg = 0.175 + nz1 * 0.05; b = 0.12; }
      else if (slope > 0.5) { const k = 0.8 + nz2 * 0.5; r = 0.14 * k; gg = 0.125 * k; b = 0.105 * k; } // bare rock on steep slopes
      else if (forest || y > 14 || slope > 0.35) { const k = 0.75 + nz1 * 0.6 + nz2 * 0.3; r = 0.05 * k; gg = 0.12 * k; b = 0.055 * k; }
      else {
        // away from the dense city the ground is a patchwork of lush grass, dry grass and bare earth; in the city it stays grey paving
        const dens = districtDens(x, z), open = Math.max(0, Math.min(1, 1 - dens * 1.25)), pt = fbm(x * 0.011 + 31, z * 0.011 - 17, 3), pt2 = fbm(x * 0.035 - 9, z * 0.035 + 5, 4);
        const k = 0.8 + nz1 * 0.5 + nz2 * 0.25; let cr = 0.12, cg = 0.122, cb = 0.105;
        const lush = Math.max(0, Math.min(1, (pt - 0.35) * 3.2)), dirt = Math.max(0, Math.min(1, (pt2 - 0.62) * 4));
        cr += open * (lush * (0.055 - 0.12) + (1 - lush) * (0.17 - 0.12)); cg += open * (lush * (0.125 - 0.122) + (1 - lush) * (0.135 - 0.122)); cb += open * (lush * (0.05 - 0.105) + (1 - lush) * (0.07 - 0.105));
        cr += open * dirt * (0.16 - cr); cg += open * dirt * (0.11 - cg); cb += open * dirt * (0.075 - cb);
        r = cr * k; gg = cg * k; b = cb * k;
      }
      g.v(x, y, z, nx / nl, 1 / nl, nz / nl, r, gg, b, x * 0.13, z * 0.13);
    }
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i; g.tri(a, a + N + 1, a + 1); g.tri(a + 1, a + N + 1, a + N + 2); }
    const m = new THREE.Mesh(g.build(), mats.terrain); m.receiveShadow = false; group.add(m);
  }

  if (NOW() > SL.t) yield 5;
  // ---- roads, decks, piers, pavements, crossings, gantries ---------------------------------------------------------------------------------
  {
    const road = GBn(), deck = GBn(), seen = new Set(), walk = GBn(), shoulder = GBn(), decal = GBn(), sign = GBn(), poles = GBn(), tube = GBn(); const era46 = world.era === "2046";
    const concrete = C(0xa0a0aa), under = C(0x70707a), kerbFace = C(0x7a7a84), white = C(0xffffff), pave = C(0xd8d8e0);
    const LED = [HOT(0.75, 0.9, 1, 1.1), HOT(1, 0.62, 0.2, 1.0), HOT(1, 0.85, 0.5, 0.8)];
    const wildCache = new Map(); const isWild = (r, p) => { if (r.cls === "hwy") return true; const k = r.idx * 4096 + ((p.s / 60) | 0); let v = wildCache.get(k); if (v === undefined) { const d = districtAt(p.x, p.z); v = !!(d && d.style === "forest") || districtDens(p.x, p.z) < 0.16; wildCache.set(k, v); } return v; };
    const segList = []; city.nearSegs((x0 + x1) / 2, (z0 + z1) / 2, CH / 2 + 40, (r0, i0) => { segList.push(r0, i0); });
    for (let sq = 0; sq < segList.length; sq += 2) {
      const r = segList[sq], i = segList[sq + 1]; if ((sq & 7) === 0) { if (NOW() > SL.t) yield 6; }
      const key = r.idx * 65536 + i; if (seen.has(key)) continue; seen.add(key);
      const p = r.pts[i], q = r.pts[i + 1]; if (Math.max(p.x, q.x) < x0 - 30 || Math.min(p.x, q.x) > x1 + 30 || Math.max(p.z, q.z) < z0 - 30 || Math.min(p.z, q.z) > z1 + 30) continue;
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
      const elevated = p.y - p.g > 1.4 || q.y - q.g > 1.4 || p.w > 0.35 || p.over || q.over;
      if (elevated) {
        const t = 1.3;
        const Lb = [L[0], L[1] - t, L[2]], Rb = [R[0], R[1] - t, R[2]], L2b = [L2[0], L2[1] - t, L2[2]], R2b = [R2[0], R2[1] - t, R2[2]];
        { const ua = p.s / 4, ub = q.s / 4, vt = t / 4, wd = r.width / 4; deck.quadV(L, Lb, L2b, L2, concrete, [ua, vt, ua, 0, ub, 0, ub, vt]); deck.quadV(R2, R2b, Rb, R, concrete, [ub, vt, ub, 0, ua, 0, ua, vt]); deck.quadV(Rb, R2b, L2b, Lb, under, [0, ua, 0, ub, wd, ub, wd, ua]); }
        // glowing LED fascia along both deck edges
        const led = r.cls === "hwy" ? LED[0] : LED[1]; const o = 0.05;
        neon.quadV([L[0] + nxp * o, L[1] - 0.18, L[2] + nzp * o], [L[0] + nxp * o, L[1] - 0.5, L[2] + nzp * o], [L2[0] + nxq * o, L2[1] - 0.5, L2[2] + nzq * o], [L2[0] + nxq * o, L2[1] - 0.18, L2[2] + nzq * o], led);
        neon.quadV([R2[0] - nxq * o, R2[1] - 0.18, R2[2] - nzq * o], [R2[0] - nxq * o, R2[1] - 0.5, R2[2] - nzq * o], [R[0] - nxp * o, R[1] - 0.5, R[2] - nzp * o], [R[0] - nxp * o, R[1] - 0.18, R[2] - nzp * o], led);
        if (i % 3 === 0 && p.y - p.g > 2.8) { // pier with a T-shaped cap
          const bot = Math.max(p.g, -3), hgt = p.y - 1.3 - bot; if (hgt > 1) {
            const rot = Math.atan2(q.z - p.z, q.x - p.x); const offs = r.width > 16 ? [-hw * 0.5, hw * 0.5] : [0];
            let placed = 0;
            for (const oo of offs) { if (city.blockedByRoad(p.x + nxp * oo, p.z + nzp * oo, p.y + 1.6, r, 2.4, p.g - 2, i)) continue; deck.box(p.x + nxp * oo, bot, p.z + nzp * oo, 2.1, hgt, 2.1, rot, concrete, concrete, 3.5); placed++; }
            if (placed) deck.box(p.x, p.y - 2.5, p.z, 3.2, 1.2, r.width * 0.8, rot, C(0x8a8a94), C(0x8a8a94), 3.5);
            if (placed && hgt > 3.2 && hash01(r.idx * 65536 + i * 3 + 11) < GRAF.pier) { const sg = hash01(r.idx * 977 + i) < 0.5 ? 1 : -1, oo = offs[0], pcx = p.x + nxp * oo + nxp * sg * 1.09, pcz = p.z + nzp * oo + nzp * sg * 1.09; const pi2 = Math.floor(hash01(i * 31 + r.idx) * REG_N), uvp = pieceUV(false, pi2); const pyy = bot + 1.7 + hash01(i + r.idx * 5) * 0.5; gr.panel(pcx, pyy, pcz, nxp * sg, nzp * sg, 1.9, 0.95, C(0xffffff, 0.9), uvp); if (world.grafLog) world.grafLog.push({ x: pcx, y: pyy, z: pcz, nx: nxp * sg, nz: nzp * sg, mb: false, piece: pi2, w: 1.9, h: 0.95, pier: true }); }
          }
        }
      } else if (isWild(r, p)) { // motorways, forest roads and open country: a sloping gravel shoulder in place of a city pavement
        const sw = r.cls === "hwy" ? 2.8 : 1.8, drop = 0.3;
        for (const sgn of [1, -1]) {
          const a = [p.x + nxp * sgn * hw, p.y + 0.004, p.z + nzp * sgn * hw], b = [p.x + nxp * sgn * (hw + sw), p.y - drop, p.z + nzp * sgn * (hw + sw)];
          const a2 = [q.x + nxq * sgn * hw, q.y + 0.004, q.z + nzq * sgn * hw], b2 = [q.x + nxq * sgn * (hw + sw), q.y - drop, q.z + nzq * sgn * (hw + sw)];
          const uv = [0, p.s / 3, sw / 3, p.s / 3, sw / 3, q.s / 3, 0, q.s / 3];
          if (sgn > 0) shoulder.quadV(a, b, b2, a2, white, uv); else shoulder.quadV(b, a, a2, b2, white, [sw / 3, p.s / 3, 0, p.s / 3, 0, q.s / 3, sw / 3, q.s / 3]);
          dq(shoulder, b, [b[0], b[1] - 0.5, b[2]], [b2[0], b2[1] - 0.5, b2[2]], b2, white, [0, 0, 0, 0.2, 0.4, 0.2, 0.4, 0]);
        }
      } else if (r.cls !== "hwy") { // pavement strips with real paving and a kerb
        const sw = 2.2, yk = 0.16, segL = Math.hypot(q.x - p.x, q.z - p.z) || 1;
        // Upgrade 37: a pavement strip stops where another road's carriageway (at the same level) runs across it. Before, every strip ran straight on through
        // every junction, so a kerb and a paved band lay across the lanes of the road that joins there (about one strip in seven, in both cities).
        const onOtherRoad = (t, sgn) => {
          const yy = p.y + (q.y - p.y) * t; let nx = nxp + (nxq - nxp) * t, nz = nzp + (nzq - nzp) * t; const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
          const cx = p.x + (q.x - p.x) * t, cz = p.z + (q.z - p.z) * t; let hit = false;
          for (const off of [hw + 0.35, hw + sw - 0.35]) {
            const X = cx + nx * sgn * off, Z = cz + nz * sgn * off;
            city.nearSegs(X, Z, 1, (o, j) => { if (hit || o === r) return; const lim = o.width / 2 + 0.25; const sg2 = city.seg(o, j, X, Z); if (sg2.d < lim && Math.abs(sg2.y - yy) < 1.3) hit = true; });
            if (hit) break;
          }
          return hit;
        };
        const nAt = (t) => { if (t <= 0) return [nxp, nzp]; if (t >= 1) return [nxq, nzq]; const nx = nxp + (nxq - nxp) * t, nz = nzp + (nzq - nzp) * t, nl = Math.hypot(nx, nz) || 1; return [nx / nl, nz / nl]; };
        const strip = (sgn, t0, t1) => {
          const [m0x, m0z] = nAt(t0), [m1x, m1z] = nAt(t1);
          const x0p = p.x + (q.x - p.x) * t0, z0p = p.z + (q.z - p.z) * t0, y0p = p.y + (q.y - p.y) * t0, s0p = p.s + (q.s - p.s) * t0;
          const x1p = p.x + (q.x - p.x) * t1, z1p = p.z + (q.z - p.z) * t1, y1p = p.y + (q.y - p.y) * t1, s1p = p.s + (q.s - p.s) * t1;
          const a = [x0p + m0x * sgn * hw, y0p + yk, z0p + m0z * sgn * hw], b = [x0p + m0x * sgn * (hw + sw), y0p + yk, z0p + m0z * sgn * (hw + sw)];
          const a2 = [x1p + m1x * sgn * hw, y1p + yk, z1p + m1z * sgn * hw], b2 = [x1p + m1x * sgn * (hw + sw), y1p + yk, z1p + m1z * sgn * (hw + sw)];
          const pv = [0, s0p / 2.4, 1, s0p / 2.4, 1, s1p / 2.4, 0, s1p / 2.4];
          if (sgn > 0) walk.quadV(a, b, b2, a2, pave, pv); else walk.quadV(b, a, a2, b2, pave, [1, s0p / 2.4, 0, s0p / 2.4, 0, s1p / 2.4, 1, s1p / 2.4]);
          const a0 = [a[0], y0p, a[2]], a20 = [a2[0], y1p, a2[2]];
          if (sgn > 0) walk.quadV(a0, a, a2, a20, kerbFace, [0, 0, 0, 0.02, 0, 0.02, 0, 0]); else walk.quadV(a20, a2, a, a0, kerbFace, [0, 0, 0, 0.02, 0, 0.02, 0, 0]);
        };
        for (const sgn of [1, -1]) {
          if (!(onOtherRoad(0, sgn) || onOtherRoad(0.25, sgn) || onOtherRoad(0.5, sgn) || onOtherRoad(0.75, sgn) || onOtherRoad(1, sgn))) { strip(sgn, 0, 1); continue; }
          const N = Math.max(4, Math.ceil(segL / 0.6)); let runFrom = -1;
          for (let k = 0; k <= N; k++) {
            const free = !onOtherRoad(k / N, sgn);
            if (free && runFrom < 0) runFrom = k;
            if ((!free || k === N) && runFrom >= 0) { const kEnd = free ? k : k - 1; if (kEnd > runFrom) strip(sgn, runFrom / N, kEnd / N); runFrom = -1; }
          }
        }
      }
    }
    // ---- Upgrade 37: junction patches -----------------------------------------------------------------------------------------------------------------
    // Where two roads at the same height overlap (a side street running into a main road, a ramp joining a flyover, a link road), both roads used to paint their
    // own lane lines and edge lines over the shared ground, so lines ran on across the other road's lanes and flickered against each other. The overlap is now covered
    // with one plain asphalt patch (no lines), exactly the shape of the overlap, just above both roads. Zebra crossings and stop lines are drawn on top of it as before.
    {
      const pu0 = (3 * BAND_W + 4) / ATLAS_W, pu1 = (4 * BAND_W - 4) / ATLAS_W, um = (pu0 + pu1) / 2;
      const biasOf = (rr) => (rr.cls === "hwy" ? 0.03 : rr.cls === "art" ? 0.02 : 0.01) + (rr.idx % 7) * 0.0015;
      const quadOf = (rr, i) => { const a = rr.pts[i], b = rr.pts[i + 1], hw = rr.width / 2; return [[a.x + rr._nx[i] * hw, a.z + rr._nz[i] * hw], [b.x + rr._nx[i + 1] * hw, b.z + rr._nz[i + 1] * hw], [b.x - rr._nx[i + 1] * hw, b.z - rr._nz[i + 1] * hw], [a.x - rr._nx[i] * hw, a.z - rr._nz[i] * hw]]; };
      const areaOf = (P) => { let a = 0; for (let k = 0; k < P.length; k++) { const A = P[k], B = P[(k + 1) % P.length]; a += A[0] * B[1] - B[0] * A[1]; } return a / 2; };
      const ccw = (P) => (areaOf(P) < 0 ? P.slice().reverse() : P);
      const clipPoly = (S, Cp) => { let out = S; for (let e = 0; e < Cp.length && out.length; e++) { const a = Cp[e], b = Cp[(e + 1) % Cp.length]; const inp = out; out = []; for (let k = 0; k < inp.length; k++) { const P = inp[k], Q = inp[(k + 1) % inp.length]; const dp = (b[0] - a[0]) * (P[1] - a[1]) - (b[1] - a[1]) * (P[0] - a[0]), dq = (b[0] - a[0]) * (Q[1] - a[1]) - (b[1] - a[1]) * (Q[0] - a[0]); if (dp >= 0) out.push(P); if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp - dq); out.push([P[0] + (Q[0] - P[0]) * t, P[1] + (Q[1] - P[1]) * t]); } } } return out; };
      const yOn = (rr, i, x, z) => { const a = rr.pts[i], b = rr.pts[i + 1]; const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2)); return a.y + (b.y - a.y) * t; };
      for (let sq = 0; sq < segList.length; sq += 2) {
        const r = segList[sq], i = segList[sq + 1]; if (r.tunnel) continue; const p = r.pts[i], q = r.pts[i + 1]; if (p.tun || q.tun) continue;
        const mx = (p.x + q.x) / 2, mz = (p.z + q.z) / 2; if (mx < x0 || mx >= x1 || mz < z0 || mz >= z1) continue;
        pointNormals(r); let QA = null;
        city.nearSegs(mx, mz, 1, (o, j) => {
          if (o.idx <= r.idx || o.tunnel) return; const a = o.pts[j], b = o.pts[j + 1]; if (a.tun || b.tun) return;
          const sg = city.seg(o, j, mx, mz); if (sg.d > r.width / 2 + o.width / 2 + 6) return;
          pointNormals(o); if (!QA) QA = ccw(quadOf(r, i));
          const poly = clipPoly(QA, ccw(quadOf(o, j))); if (poly.length < 3) return;
          let cx = 0, cz = 0, ext = 0; for (const v of poly) { cx += v[0]; cz += v[1]; } cx /= poly.length; cz /= poly.length; if (Math.abs(areaOf(poly)) < 0.6) return;
          for (const v of poly) ext = Math.max(ext, Math.hypot(v[0] - cx, v[1] - cz)); if (ext > 24) return; // a long shallow merge is left to the roads' own markings
          const yA = yOn(r, i, cx, cz), yB = yOn(o, j, cx, cz); if (Math.abs(yA - yB) > 0.9) return; // one road passes over the other, not level with it
          const bA = biasOf(r), bB = biasOf(o); const ord = areaOf(poly) > 0 ? poly.slice().reverse() : poly; // up-facing order for the builder
          const ks = ord.map((v) => { const y = Math.max(yOn(r, i, v[0], v[1]) + bA, yOn(o, j, v[0], v[1]) + bB) + 0.013; const du = Math.max(-0.085, Math.min(0.085, ((v[0] - cx) * 0.8 + (v[1] - cz) * 0.6) * 0.012)); return road.v(v[0], y, v[1], 0, 1, 0, white.r, white.g, white.b, um + du, (v[0] * 0.7 + v[1] * 0.7) / 16); });
          for (let k = 1; k + 1 < ks.length; k++) road.tri(ks[0], ks[k], ks[k + 1]);
        });
      }
    }
    if (NOW() > SL.t) yield 7;
    // zebra crossings and traffic signals at junctions
    const nodes = nodesByChunk(city).get(ci * 128 + cj) || [];
    for (const n of nodes) {
      if (NOW() > SL.t) yield 8;
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
          if (IS_TOKYO) { // Japan: a tall mast with an arm reaching out over the lanes, a wide horizontal LED signal at its end (the "green" is blue-green), a small pedestrian signal at the foot
            sig++; const side = (hash2(n.id, sig) < 0.5 ? 1 : -1); const px = cx - dx * 4.5 + nx * side * (hw + 1.3), pz = cz - dz * 4.5 + nz * side * (hw + 1.3);
            const ang = Math.atan2(-nz * side, -nx * side), arm = hw * 1.15, col = C(0xbfc4c8);
            poles.box(px, n.y, pz, 0.28, 7.0, 0.28, 0, col); poles.box(px - nx * side * arm / 2, n.y + 6.6, pz - nz * side * arm / 2, arm, 0.2, 0.2, ang, col);
            const st = hsh(n.id * 7 + eid) < 0.5 ? 0 : 2; const lc = [[1, 0.08, 0.06], [1, 0.7, 0.1], [0.05, 0.95, 0.75]][st];
            for (const f of [0.55, 1.0]) { const hx = px - nx * side * arm * f, hz = pz - nz * side * arm * f; poles.box(hx, n.y + 5.8, hz, 0.4, 0.5, 1.5, ang + Math.PI / 2, C(0x1a1b20));
              for (let q = 0; q < 3; q++) { const sx = (q - 1) * 0.46; const lp = [hx + Math.cos(ang) * 0 + Math.sin(ang) * sx, hz - Math.cos(ang) * sx];
                if (q === st) { neon.box(lp[0], n.y + 6.05, lp[1], 0.3, 0.3, 0.3, ang, HOT(lc[0], lc[1], lc[2], 2.4)); glowExtra.push(lp[0], n.y + 6.05, lp[1], lc[0], lc[1], lc[2], 7); } } }
            poles.box(px, n.y + 2.1, pz, 0.34, 0.5, 0.2, ang, C(0x1a1b20)); neon.box(px - nx * side * 0.1, n.y + 2.2, pz - nz * side * 0.1, 0.18, 0.2, 0.05, ang, HOT(1, 0.15, 0.1, 2));
          } else {
          sig++; const side = (hash2(n.id, sig) < 0.5 ? 1 : -1); const px = cx - dx * 4.5 + nx * side * (hw + 1.1), pz = cz - dz * 4.5 + nz * side * (hw + 1.1);
            poles.box(px, n.y, pz, 0.2, 5.4, 0.2, 0, C(0x30323a)); const ang = Math.atan2(-nz * side, -nx * side); poles.box(px - nx * side * 1.8, n.y + 5.1, pz - nz * side * 1.8, 3.6, 0.14, 0.14, Math.atan2(-nz * side, -nx * side), C(0x30323a));
            const hx = px - nx * side * 3.2, hz = pz - nz * side * 3.2; poles.box(hx, n.y + 4.1, hz, 0.45, 1.3, 0.4, ang, C(0x14151a));
            const st = hsh(n.id * 7 + eid) < 0.5 ? 0 : 2; const lc = [[1, 0.1, 0.08], [1, 0.7, 0.1], [0.12, 1, 0.3]][st];
            neon.box(hx - dx * 0.0, n.y + 4.1 + (st === 0 ? 0.42 : st === 2 ? -0.42 : 0), hz, 0.26, 0.26, 0.42, ang, HOT(lc[0], lc[1], lc[2], 2.2));
            glowExtra.push(hx, n.y + 4.5 + (st === 0 ? 0 : -0.84), hz, lc[0], lc[1], lc[2], 6.5);
            }
        }
      }
    }
    if (NOW() > SL.t) yield 9;
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
    if (NOW() > SL.t) yield 10;
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
      if (NOW() > SL.t) yield 11;
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
      }
      for (const pr of L.piers) { // one central pier with a hammer-head cap under the deck, only where it stands clear of every road
        if (pr.x < x0 || pr.x >= x1 || pr.z < z0 || pr.z >= z1) continue;
        deck.box(pr.x, pr.base - 0.3, pr.z, 2.0, pr.h + 0.3, 2.0, pr.rot, concreteM);
        deck.box(pr.x, pr.y - 2.8, pr.z, 2.8, 1.2, 8.2, pr.rot, concreteM);
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
    if (NOW() > SL.t) yield 12;
    buildWalkwayGeo(world, ci, cj, { deck, neon, glow: glowExtra, C, HOT }); // skywalks and subway entrances (planned in walkways.js)
    if (!tube.empty) group.add(new THREE.Mesh(tube.build(), mats.walk));
    if (!road.empty) group.add(new THREE.Mesh(road.build(), mats.road));
    if (!decal.empty) { const m = new THREE.Mesh(decal.build(), mats.decal); m.renderOrder = 1; group.add(m); }
    if (!deck.empty) group.add(new THREE.Mesh(deck.build(), mats.cement || mats.concrete));
    if (!walk.empty) group.add(new THREE.Mesh(walk.build(), mats.walk));
    if (!shoulder.empty) group.add(new THREE.Mesh(shoulder.build(), mats.gravel || mats.walk));
    if (!sign.empty) group.add(new THREE.Mesh(sign.build(), mats.signs));
    if (!poles.empty) group.add(new THREE.Mesh(poles.build(), mats.props));
  }

  if (NOW() > SL.t) yield 13;
  // ---- crash barriers (the same lines the car collides with), with reflector studs --------------------------------------------------------------
  {
    const g = GBn(); const bar = C(0xcfcfd4);
    let kk = 0;
    for (const w of world.wallsIn(ci, cj)) {
      if (w.cl) continue; // road-end barricades are drawn with the street props
      if ((kk & 15) === 0) { if (NOW() > SL.t) yield 14; }
      const dx = w.x2 - w.x1, dz = w.z2 - w.z1, l = Math.hypot(dx, dz) || 1; const rot = Math.atan2(dz, dx);
      g.jersey(w.x1, w.z1, w.x2, w.z2, w.y, bar);
      if (l > 5 && (kk++ % 2 === 0)) { const nx = -dz / l, nz = dx / l; neon.box((w.x1 + w.x2) / 2 + nx * 0.2, w.y + 0.4, (w.z1 + w.z2) / 2 + nz * 0.2, 0.5, 0.14, 0.06, rot, kk % 4 ? HOT(1, 0.62, 0.15, 1.4) : HOT(0.9, 0.95, 1, 1.2)); }
    }
    if (!g.empty) group.add(new THREE.Mesh(g.build(), mats.cement || mats.props));
  }

  if (NOW() > SL.t) yield 15;
  // ---- buildings -------------------------------------------------------------------------------------------------------------------------------------
  {
    const fac = Object.fromEntries(Object.keys(mats.facade).map((k) => [k, GBn()])), band = { shops0: GBn(), shops1: GBn(), shops2: GBn(), shops3: GBn(), shops4: GBn(), lobby: GBn(), dock: GBn() }, roof = GBn(), glow = [], ads = GBn(), blades = GBn();
    const roofCol = [C(0x2c2b30), C(0x3a3a40), C(0x4a3a30), C(0x28323a)], ledge = C(0x8a867e), ledgeDk = C(0x4c4a48);
    const aoPos = [], aoCol = [], aoIdx = []; // contact shadows: a dark ring fading out from the foot of each building
    for (const b of ch.buildings) {
      if (NOW() > SL.t) yield 16;
      const kind = FACADE_OF[b.style] || "res"; const nvar = kind === "ind" ? 0 : Object.keys(mats.facade).filter((q) => q.startsWith(kind)).length; let fk = kind === "ind" ? "ind" : kind + Math.floor((Math.imul(b.id | 0, 2654435761) >>> 0) / 4294967296 * nvar); const signB = IS_TOKYO && kind === "res" && b.h > 11 && SIGN_STYLES[b.style] && (Math.imul(b.id | 0, 40503) >>> 5) % 10 < SIGN_STYLES[b.style]; if (signB) fk = "sign" + (Math.imul(b.id | 0, 2246822519) >>> 7) % Object.keys(mats.facade).filter((q) => q.startsWith("sign")).length; const g = fac[fk]; const T = tex[fk];
      const c = Math.cos(b.rot), s = Math.sin(b.rot), hw = b.w / 2, hd = b.d / 2;
      let ymin = 1e9, yc = city.groundH(b.x, b.z); const corners = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, lz]) => { const x = b.x + lx * c - lz * s, z = b.z + lx * s + lz * c; ymin = Math.min(ymin, city.groundH(x, z)); return [x, z]; });
      const yb = Math.min(ymin, yc) - 0.6, yt = yb + b.h + Math.max(0, yc - ymin) + 0.6;
      if (mats.ao) {
        const D = 3.2 + Math.min(2.4, b.h * 0.025), al = 0.26 + 0.24 * Math.min(1, b.h / 60), base0 = aoPos.length / 3;
        for (const [lx, lz] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) {
          const ox = (lx > 0 ? D : -D), oz = (lz > 0 ? D : -D), wx = b.x + lx * c - lz * s, wz = b.z + lx * s + lz * c, ex = b.x + (lx + ox) * c - (lz + oz) * s, ez = b.z + (lx + ox) * s + (lz + oz) * c;
          aoPos.push(wx, city.groundH(wx, wz) + 0.07, wz, ex, city.groundH(ex, ez) + 0.07, ez); aoCol.push(0, 0, 0, al, 0, 0, 0, 0);
        }
        for (let q = 0; q < 4; q++) { const q2 = (q + 1) % 4, i0 = base0 + q * 2, i1 = i0 + 1, j1 = base0 + q2 * 2 + 1, j0 = base0 + q2 * 2; aoIdx.push(i0, j0, j1, i0, j1, i1); }
      }
      // stepped towers: the top fifth sits back from the street on a ledge, like real high-rises (the footprint only shrinks, so collisions are unchanged)
      const tierOn = ((kind === "office" && b.h > 40) || (kind === "res" && b.h > 55)) && (Math.imul(b.id | 0, 40503) >>> 3) % 3 !== 1; const tierH = tierOn ? Math.round(Math.min(26, Math.max(9, b.h * 0.2)) / 3.2) * 3.2 : 0; const yTW = yt - tierH, ins = tierOn ? Math.min(hw, hd) * (0.14 + ((b.id * 13) % 5) * 0.025) : 0;
      const topC = tierOn ? [[-(hw - ins), -(hd - ins)], [hw - ins, -(hd - ins)], [hw - ins, hd - ins], [-(hw - ins), hd - ins]].map(([lx, lz]) => [b.x + lx * c - lz * s, b.z + lx * s + lz * c]) : corners;
      const k = kind === "office" ? 0.8 + (b.id % 5) * 0.045 : 0.95; const bc = kind === "office" ? C(b.style === "glass" || b.style === "future" ? b.color : 0xffffff, 1) : C(b.color, 0.62 + (b.id % 4) * 0.08);
      const col = kind === "office" ? rgb(bc.r * k, bc.g * k, bc.b * k) : signB ? C(0xffffff, 0.9) : bc;
      const u0 = ((b.id * 7) % 8) / 8, v0 = ((b.id * 5) % 8) / 8;
      const bkey0 = BAND_OF[b.style]; const bkey = bkey0 === "shops" ? "shops" + (b.id % 5) : bkey0; const useBand = bkey && b.h > (bkey0 === "shops" ? 9 : 14) && (kind !== "ind" || b.h > 7); const bandH = useBand ? 4.2 : 0; const T2 = useBand ? tex[bkey] : null;
      const dark = (m) => rgb(col.r * m, col.g * m, col.b * m);
      for (let e = 0; e < 4; e++) {
        const A = corners[e], B = corners[(e + 1) % 4]; const len = Math.hypot(B[0] - A[0], B[1] - A[1]); const uu = len / T.uvW;
        const yu = yb + bandH, h1 = Math.min(yTW, yu + 16); // upper wall: darker toward the street, lighter above
        if (useBand) {
          const bu = ((b.id * 3 + e * 5) % 7) / 7, uw = len / T2.uvW; band[bkey].quadG([B[0], yb, B[1]], [A[0], yb, A[1]], [A[0], yu, A[1]], [B[0], yu, B[1]], [dark(0.55), dark(0.55), dark(0.8), dark(0.8)], [bu, 0, bu + uw, 0, bu + uw, 1, bu, 1]);
        }
        const va = (yu - yb) / T.uvH, vb = (h1 - yb) / T.uvH, vc = (yTW - yb) / T.uvH;
        g.quadG([B[0], yu, B[1]], [A[0], yu, A[1]], [A[0], h1, A[1]], [B[0], h1, B[1]], [dark(useBand ? 0.82 : 0.58), dark(useBand ? 0.82 : 0.58), dark(1), dark(1)], [u0, v0 + va, u0 + uu, v0 + va, u0 + uu, v0 + vb, u0, v0 + vb]);
        if (yTW > h1 + 0.1) g.quadG([B[0], h1, B[1]], [A[0], h1, A[1]], [A[0], yTW, A[1]], [B[0], yTW, B[1]], [dark(1), dark(1), dark(1.08), dark(1.08)], [u0, v0 + vb, u0 + uu, v0 + vb, u0 + uu, v0 + vc, u0, v0 + vc]);
      }
      if (tierOn) {
        roof.box(b.x, yTW - 0.25, b.z, b.w + 0.5, 0.5, b.d + 0.5, b.rot, ledge); // ledge slab where the tier steps back
        roof.quadV([corners[0][0], yTW + 0.02, corners[0][1]], [corners[3][0], yTW + 0.02, corners[3][1]], [corners[2][0], yTW + 0.02, corners[2][1]], [corners[1][0], yTW + 0.02, corners[1][1]], roofCol[b.id % 4]);
        for (let e = 0; e < 4; e++) { const A = topC[e], B = topC[(e + 1) % 4]; const len = Math.hypot(B[0] - A[0], B[1] - A[1]), uu = len / T.uvW, va = (yTW - yb) / T.uvH, vb = (yt - yb) / T.uvH;
          g.quadG([B[0], yTW, B[1]], [A[0], yTW, A[1]], [A[0], yt, A[1]], [B[0], yt, B[1]], [dark(0.9), dark(0.9), dark(1.08), dark(1.08)], [u0, v0 + va, u0 + uu, v0 + va, u0 + uu, v0 + vb, u0, v0 + vb]); }
      }
      { // wall graffiti: only on low walls without a shopfront band, and only now and then
        const g1 = hash01(b.id * 7 + 1); if (!useBand && kind !== "office" && b.h > 4.5 && b.h < 34 && g1 < GRAF.wall) {
          const mb = g1 < GRAF.mb, wantW = mb ? 8 : 2.4 + hash01(b.id * 3 + 9) * 2.2; let pickE = -1, e0 = Math.floor(hash01(b.id * 11 + 3) * 4);
          for (let q = 0; q < 4; q++) { const e = (e0 + q) % 4, A = corners[e], B = corners[(e + 1) % 4]; if (Math.hypot(B[0] - A[0], B[1] - A[1]) >= wantW + 1.2) { pickE = e; break; } }
          if (pickE >= 0) {
            const A = corners[pickE], B = corners[(pickE + 1) % 4], len = Math.hypot(B[0] - A[0], B[1] - A[1]), tx = (B[0] - A[0]) / len, tz = (B[1] - A[1]) / len; let nx = tz, nz = -tx; const mx = (A[0] + B[0]) / 2, mz = (A[1] + B[1]) / 2; if ((mx - b.x) * nx + (mz - b.z) * nz < 0) { nx = -nx; nz = -nz; }
            const wd = Math.min(wantW, len - 1.0), pa = pieceAspect(mb), ht = wd / pa, off = (hash01(b.id * 5 + 7) - 0.5) * (len - wd - 0.6), pcx = mx + tx * off + nx * 0.05, pcz = mz + tz * off + nz * 0.05; const pi2 = Math.floor(hash01(b.id * 13 + 5) * (mb ? MB_N : REG_N));
            const gyy = city.groundH(pcx, pcz) + 1.0 + ht / 2 + hash01(b.id + 41) * 0.5; gr.panel(pcx, gyy, pcz, nx, nz, wd, ht, C(0xffffff, 0.95), pieceUV(mb, pi2)); if (world.grafLog) world.grafLog.push({ x: pcx, y: gyy, z: pcz, nx, nz, mb, piece: pi2, w: wd, h: ht, bid: b.id, style: b.style });
          }
        }
      }
      const rc = IS_TOKYO ? C(b.id % 3 === 0 ? 0x8a8f96 : b.id % 3 === 1 ? 0x6f757d : 0xa4a8ae) : b.style === "dense" ? (b.id % 3 === 0 ? C(0x2a5fa8, 0.7) : b.id % 3 === 1 ? C(0xb05a28, 0.5) : roofCol[b.id % 4]) : roofCol[b.id % 4];
      roof.quadV([topC[0][0], yt, topC[0][1]], [topC[3][0], yt, topC[3][1]], [topC[2][0], yt, topC[2][1]], [topC[1][0], yt, topC[1][1]], rc);
      // parapet and cornice ring (gives every roof a proper edge)
      if (b.h < 90) for (let e = 0; e < 4; e++) { const A = topC[e], B = topC[(e + 1) % 4]; const len = Math.hypot(B[0] - A[0], B[1] - A[1]); const ang = Math.atan2(B[1] - A[1], B[0] - A[0]); roof.box((A[0] + B[0]) / 2, yt - 0.35, (A[1] + B[1]) / 2, len + 0.3, 0.45, 0.5, ang, ledge); roof.box((A[0] + B[0]) / 2, yt + 0.1, (A[1] + B[1]) / 2, len, kind === "ind" ? 0.7 : 0.9, 0.3, ang, ledgeDk); }
      if (b.h < 60) { if (b.id % 3 === 0 && !IS_TOKYO) { roof.geo(cyl, b.x + c * hw * 0.3, yt, b.z + s * hw * 0.3, 1.1, 1.7, 1.1, 0, C(0x1d5ca8, 0.9)); roof.geo(cyl, b.x + c * hw * 0.3 + 2.7, yt, b.z + s * hw * 0.3, 1.1, 1.7, 1.1, 0, C(0x1d5ca8, 0.7)); } if (b.id % 2 === 0) roof.box(b.x - c * hw * 0.35, yt, b.z - s * hw * 0.35, 2.6, 1.4, 2.0, b.rot, C(0x55555c)); if (b.id % 5 === 1) { roof.geo(cone, b.x + c * hw * 0.5, yt, b.z + s * hw * 0.5, 0.2, 7, 0.2, 0, C(0x666670)); } }
      else { roof.box(b.x, yt, b.z, 3.2, 2.4, 3.2, b.rot, C(0x45454c)); roof.box(b.x, yt + 2.4, b.z, b.w * 0.55, 3.5, b.d * 0.55, b.rot, C(0x3a3e46)); roof.geo(cone, b.x, yt + 5.9, b.z, 0.35, Math.min(26, b.h * 0.12), 0.35, 0, C(0x666670)); glow.push(b.x, yt + 5.9 + Math.min(26, b.h * 0.12), b.z, 1, 0.1, 0.08, 9); }
      { // more rooftop life: a stair bulkhead, rows of AC condensers, satellite dishes, phone masts with a red aviation light
        const loc = (lx, lz) => [b.x + lx * c - lz * s, b.z + lx * s + lz * c], rh = (Math.imul(b.id | 0, 1103515245) >>> 8) % 97, hwT = hw - ins, hdT = hd - ins;
        { const [x1, z1] = loc(hwT * 0.55, -hdT * 0.45); roof.box(x1, yt, z1, Math.min(4.2, b.w * 0.3), 2.6, 3.0, b.rot, C(0x8a867e)); roof.box(x1, yt + 2.6, z1, Math.min(4.6, b.w * 0.3 + 0.4), 0.25, 3.4, b.rot, C(0x5a5852)); }
        if (rh % 4 === 0 && b.h < 90) for (let q = 0; q < 5; q++) { const [x1, z1] = loc(-hwT * 0.6 + q * 1.5, hdT * 0.55); roof.box(x1, yt, z1, 1.1, 0.9, 1.0, b.rot, C(0xb8bcc0)); roof.box(x1, yt + 0.9, z1, 0.8, 0.12, 0.8, b.rot, C(0x2a2c30)); }
        if (rh % 6 === 1 && b.h < 90) { const [x1, z1] = loc(-hwT * 0.2, -hdT * 0.6); roof.box(x1, yt, z1, 0.12, 1.5, 0.12, b.rot, C(0x55555c)); roof.geo(cyl, x1, yt + 1.5, z1, 0.95, 0.12, 0.95, 0, C(0xd8d8dc)); }
        if (rh % 11 === 3 && b.h > 14 && b.h < 80) { const [x1, z1] = loc(-hwT * 0.4, hdT * 0.3); roof.geo(cone, x1, yt, z1, 0.5, 15, 0.5, 0, C(0x8a8a92)); for (let q = 0; q < 3; q++) { const an = q * 2.094 + b.rot; roof.box(x1 + Math.cos(an) * 0.7, yt + 11.5, z1 + Math.sin(an) * 0.7, 0.25, 2.2, 0.15, an, C(0xdadade)); } glow.push(x1, yt + 15.2, z1, 1, 0.08, 0.06, 7); }
      }
      // LED crown and corner strips on tall towers
      if (kind === "office" && b.h > 36) {
        const tint = [[0.25, 0.9, 1], [1, 0.25, 0.7], [1, 0.75, 0.25], [0.75, 0.85, 1]][b.id % 4]; const led = HOT(tint[0], tint[1], tint[2], 1.9); const o = 0.06;
        for (let e = 0; e < 4; e++) { const A = topC[e], B = topC[(e + 1) % 4]; const dx = B[0] - A[0], dz = B[1] - A[1], l = Math.hypot(dx, dz) || 1; const nx = dz / l, nz = -dx / l; neon.quadV([A[0] + nx * o, yt - 1.7, A[1] + nz * o], [B[0] + nx * o, yt - 1.7, B[1] + nz * o], [B[0] + nx * o, yt - 0.7, B[1] + nz * o], [A[0] + nx * o, yt - 0.7, A[1] + nz * o], led); }
        if (IS_TOKYO ? b.id % 2 === 0 : b.id % 3 === 0) for (const ci2 of [0, 2]) { const P = topC[ci2]; neon.box(P[0], yb + bandH + 2, P[1], 0.4, yt - yb - bandH - 4, 0.4, b.rot, HOT(tint[0], tint[1], tint[2], 1.4)); }
      }
      // rooftop billboards and blade signs face the nearest road
      if (b.h > 12 && b.h < 80 && (kind === "res" || kind === "office") && (IS_TOKYO ? (b.id % 5 === 0 || b.id % 7 === 3) : (b.id % 11 === 0 || b.id % 13 === 5))) {
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
      if (useBand && bkey0 === "shops" && (IS_TOKYO ? b.id % 2 === 1 : b.id % 4 === 1)) {
        const nr = city.nearestRoad(b.x, b.z, 80); if (nr) {
          let fx = -s, fz = c; const tx = nr.x - b.x, tz = nr.z - b.z; if (fx * tx + fz * tz < 0) { fx = -fx; fz = -fz; } const ext = Math.abs(fx * (-s) + fz * c) > 0.7 ? hd : hw; const ax = fz, az = -fx;
          const off = ((b.id * 37) % 5 - 2) * 0.28 * (ext === hd ? b.w : b.d); const cx2 = b.x + fx * (ext + 0.62) + ax * off, cz2 = b.z + fz * (ext + 0.62) + az * off; const bi = b.id % 8; const bu = bi / 8; const uvr = [bu + 0.004, 0.01, bu + 0.121, 0.99]; const yy = yb + 6.2;
          { const SH = IS_TOKYO ? Math.min(11, 5 + b.h * 0.16) : 4.0, SW = IS_TOKYO ? 1.5 : 1.0; blades.panel(cx2, yy + (SH - 4) / 2, cz2, ax, az, SW, SH, C(0xffffff, 1.2), uvr); blades.panel(cx2, yy + (SH - 4) / 2, cz2, -ax, -az, SW, SH, C(0xffffff, 1.2), uvr);
            if (IS_TOKYO && b.h > 16) { const bi2 = (b.id + 3) % 8, bu2 = bi2 / 8, uvr2 = [bu2 + 0.004, 0.01, bu2 + 0.121, 0.99], cx3 = cx2 - ax * (ext === hd ? b.w : b.d) * 0.3, cz3 = cz2 - az * (ext === hd ? b.w : b.d) * 0.3; blades.panel(cx3, yy + 1.2, cz3, ax, az, SW, SH, C(0xffffff, 1.2), uvr2); blades.panel(cx3, yy + 1.2, cz3, -ax, -az, SW, SH, C(0xffffff, 1.2), uvr2); glow.push(cx3, yy + 1.2, cz3, 1, 0.6, 0.8, 7); } }
          roof.box(cx2 - fx * 0.3, yy - 2.1, cz2 - fz * 0.3, 0.1, 0.1, 0.8, Math.atan2(fz, fx), C(0x30323a)); glow.push(cx2, yy, cz2, [1, 0.3, 0.2, 0.2, 0.9, 0.5][bi % 6 * 1 % 6] ?? 1, 0.5, 0.8, 6);
        }
      }
      if (IS_TOKYO && b.h > 14 && b.h < 90 && (b.style === "dense" || b.style === "old" || b.style === "mixed" || b.style === "upscale" || b.style === "colonial") && b.id % 6 !== 0) { // Japan: signboard canyons: lit advert panels and tall sign stacks hung flat on the street-facing wall, floor after floor
        const nr = city.nearestRoad(b.x, b.z, 80); if (nr) {
          let fx = -s, fz = c; const tx = nr.x - b.x, tz = nr.z - b.z; if (fx * tx + fz * tz < 0) { fx = -fx; fz = -fz; } const wallW = Math.abs(fx * (-s) + fz * c) > 0.7 ? b.d : b.w, ext = wallW / 2; const ax = fz, az = -fx;
          const nP = Math.min(7, 1 + Math.floor(b.h / 8)); for (let q = 0; q < nP; q++) {
            const hq = (Math.imul(b.id * 31 + q * 7, 2654435761) >>> 0) / 4294967296, off = (hq - 0.5) * (wallW * 0.5), yy2 = yb + 6.5 + q * 5.6; if (yy2 + 3 > yt - 1) break;
            const px = b.x + fx * (ext + 0.18) + ax * off, pz = b.z + fz * (ext + 0.18) + az * off;
            if (q % 2 === 0) { const Wd = Math.min(9, wallW * 0.6), ad = (b.id + q * 5) % 8, au = (ad % 2) * 0.5, av = 1 - Math.floor(ad / 2) / 4; ads.panel(px, yy2, pz, fx, fz, Wd, Wd / 2, C(0xffffff, 1.25), [au + 0.006, av - 0.246, au + 0.494, av - 0.006]); glow.push(px + fx * 1.5, yy2, pz + fz * 1.5, 0.9, 0.85, 0.9, 7); }
            else { const bi3 = (b.id + q) % 8, bu3 = bi3 / 8, SH2 = Math.min(10, 4 + (yt - yy2) * 0.5); blades.panel(px, yy2 + SH2 / 2 - 1.5, pz, fx, fz, 2.0, SH2, C(0xffffff, 1.25), [bu3 + 0.004, 0.01, bu3 + 0.121, 0.99]); glow.push(px + fx * 1.5, yy2 + SH2 / 2, pz + fz * 1.5, 1, 0.6, 0.8, 7); }
          }
        }
      }
    }
    if (NOW() > SL.t) yield 17;
    if (aoPos.length && mats.ao) { const ag = new THREE.BufferGeometry(); ag.setAttribute("position", new THREE.Float32BufferAttribute(aoPos, 3)); ag.setAttribute("color", new THREE.Float32BufferAttribute(aoCol, 4)); ag.setIndex(aoIdx); const am = new THREE.Mesh(ag, mats.ao); am.renderOrder = 1; group.add(am); }
    for (const kd in fac) if (!fac[kd].empty) group.add(new THREE.Mesh(fac[kd].build(), mats.facade[kd]));
    for (const kd of ["shops0", "shops1", "shops2", "shops3", "shops4", "lobby", "dock"]) if (!band[kd].empty) group.add(new THREE.Mesh(band[kd].build(), mats.band[kd]));
    if (!roof.empty) group.add(new THREE.Mesh(roof.build(), mats.props));
    if (!ads.empty) group.add(new THREE.Mesh(ads.build(), mats.ad));
    if (!blades.empty) group.add(new THREE.Mesh(blades.build(), mats.blade));
    group.userData.glow = glow;
  }

  if (NOW() > SL.t) yield 18;
  // ---- lamps, street furniture and trees ------------------------------------------------------------------------------------------------------------
  {
    const g = GBn(), pool = GBn(), ads2 = GBn(); const glowPts = group.userData.glow || []; for (const v of glowExtra) glowPts.push(v);
    const LC = [[1.0, 0.62, 0.25], [1.0, 0.94, 0.82], [0.74, 0.84, 1.0]];
    const pole = IS_TOKYO ? C(0x9c9a92) : C(0x3a3a42); let li = 0, prevL = null;
    for (const l of ch.lamps) {
      li++; if ((li & 7) === 0) { if (NOW() > SL.t) yield 19; }
      g.geo(cyl, l.x, l.y - 0.1, l.z, 0.13, l.h + 0.1, 0.13, 0, pole); g.geo(cyl, l.x, l.y - 0.1, l.z, 0.24, 0.5, 0.24, 0, C(0x2a2a30));
      const ax = -l.tz * -l.side, az = l.tx * -l.side; const hx = l.x + ax * 1.7, hz = l.z + az * 1.7;
      g.box((l.x + hx) / 2, l.y + l.h - 0.1, (l.z + hz) / 2, 1.8, 0.1, 0.1, Math.atan2(hz - l.z, hx - l.x), pole);
      const col = LC[l.c] || LC[0];
      if (IS_TOKYO && districtDens(l.x, l.z) < 0.42) { // Upgrade 34/50: Japanese utility poles only in the quiet suburbs (the busy city centre has clean lamp masts, no cable clutter): a crossarm, insulators, now and then a pole transformer, and wires swagged from pole to pole
        const arot = Math.atan2(az, ax), top = l.y + l.h - 0.7; g.box(l.x, top, l.z, 2.6, 0.14, 0.14, arot, C(0x4a3b2c)); g.box(l.x, top - 0.9, l.z, 2.0, 0.12, 0.12, arot, C(0x4a3b2c));
        if (li % 4 === 0) g.geo(cyl, l.x - ax * 0.45, top - 2.4, l.z - az * 0.45, 0.36, 0.95, 0.36, 0, C(0x8b8f93));
        if (prevL && Math.hypot(prevL.x - l.x, prevL.z - l.z) < 58 && Math.abs(prevL.y - l.y) < 1.6) { const dxw = l.x - prevL.x, dzw = l.z - prevL.z, Lw = Math.hypot(dxw, dzw), rw = Math.atan2(dzw, dxw);
          for (const [off, hy] of [[-1.0, 0], [1.0, 0]]) { const o = off, mx2 = (l.x + prevL.x) / 2 + (-dzw / Lw) * o, mz2 = (l.z + prevL.z) / 2 + (dxw / Lw) * o; g.box(mx2, top + hy - 0.22, mz2, Lw, 0.035, 0.035, rw, C(0x111114)); } }
        prevL = l;
      }
      if (IS_TOKYO && li % 4 === 2 && l.h < 9.5) { // Japan: a bank of glowing drink vending machines by the pole, a small shrine-lantern-red one among them
        const vx = l.x - ax * 1.4 + l.tx * 1.6, vz = l.z - az * 1.4 + l.tz * 1.6, vr = Math.atan2(l.tz, l.tx), nv = 2 + (li % 3);
        for (let q = 0; q < nv; q++) { const ox = vx + l.tx * q * 0.95, oz = vz + l.tz * q * 0.95; const vc = [[0.9, 0.18, 0.16], [0.2, 0.55, 0.95], [0.95, 0.85, 0.3], [0.3, 0.8, 0.5]][(li + q) % 4];
          g.box(ox, l.y + 0.95, oz, 0.9, 1.9, 0.75, vr, C(0xd8dadc)); neon.box(ox - ax * 0.4, l.y + 1.15, oz - az * 0.4, 0.06, 1.1, 0.62, vr, HOT(vc[0], vc[1], vc[2], 1.5)); }
        glowPts.push(vx - ax * 0.9, l.y + 1.2, vz - az * 0.9, 0.95, 0.95, 1, 4.5);
      }
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
    // ---- pavement furniture (positions chosen in world.js): every piece is a handful of boxes ----
    {
      const wood = C(0x74502e), dk = C(0x26262c), steel = C(0x8a8e98), red = C(0xc9262a), white = C(0xe8e8e2), yel = C(0xf0c21c), stone = C(0x9a948a), sh = [C(0x2f7a38), C(0x3e9a44), C(0x286a30)];
      const kiosk = [[C(0x2a6aa8), [0.25, 0.8, 1]], [C(0xc84a2a), [1, 0.55, 0.2]], [C(0x2f8a52), [0.4, 1, 0.55]], [C(0x8a3aa8), [1, 0.4, 0.9]], [C(0xd8a21a), [1, 0.85, 0.3]]];
      const flw = [C(0xe8458a), C(0xf2a21a), C(0xf2f0e8), C(0xd8302a), C(0x9a4ad8)];
      let fi2 = 0;
      for (const f of ch.furniture || []) {
        if ((fi2++ & 7) === 0) { if (NOW() > SL.t) yield 20; }
        const y = f.y, tx = Math.cos(f.rot), tz = Math.sin(f.rot), fx = f.fx, fz = f.fz, R = f.rot; const P = (a, b) => [f.x + tx * a + fx * b, f.z + tz * a + fz * b];
        const bx = (a, b, yy, sx, sy, sz, col, gb = g) => { const p = P(a, b); gb.box(p[0], y + yy, p[1], sx, sy, sz, R, col); };
        const cy = (a, b, yy, r, h, col) => { const p = P(a, b); g.geo(cyl, p[0], y + yy, p[1], r, h, r, 0, col); };
        const bl = (a, b, yy, r, col) => { const p = P(a, b); g.geo(ico, p[0], y + yy, p[1], r, r * 0.8, r, 0, col); };
        const id = f.id;
        switch (f.k) {
          case 0: { // slatted park bench: cast-iron end frames, armrests, seat and back slats, each one a slightly different weathered tone
            const wd = (i2) => C(0x74502e, 0.78 + 0.34 * hash01(id * 13 + i2)), fr = C(0x1f2024, 0.9 + 0.3 * hash01(id));
            for (let q = 0; q < 5; q++) bx(0, -0.2 + q * 0.105, 0.44, 1.78, 0.04, 0.088, wd(q));
            for (let q = 0; q < 4; q++) bx(0, -0.285, 0.56 + q * 0.105, 1.78, 0.085, 0.04, wd(q + 5));
            for (const a2 of [-0.8, 0.8]) { bx(a2, 0, 0, 0.055, 0.44, 0.07, fr); bx(a2, 0.2, 0, 0.055, 0.44, 0.07, fr); bx(a2, 0.05, 0.4, 0.055, 0.045, 0.52, fr); bx(a2, -0.285, 0.4, 0.055, 0.62, 0.06, fr); bx(a2, 0.17, 0.62, 0.07, 0.035, 0.07, fr); bx(a2, 0.17, 0.45, 0.04, 0.2, 0.04, fr); bx(a2, 0.1, 0.62, 0.06, 0.035, 0.28, fr); }
            bx(0, 0.02, 0.003, 2.0, 0.012, 0.8, C(0x4a4a50)); break; }
          case 1: { // two street bins: rimmed bodies with a dark flip lid, a bright recycling label and a mid-height band
            const bc = [[C(0x2f7a4a, 0.85 + 0.3 * hash01(id)), "WET"], [C(0x2a5ca8, 0.85 + 0.3 * hash01(id + 7)), "DRY"]];
            bc.forEach(([col], i2) => { const a2 = i2 ? 0.36 : -0.36; cy(a2, 0, 0, 0.255, 0.8, col); cy(a2, 0, 0.8, 0.285, 0.05, dk); cy(a2, 0, 0.85, 0.27, 0.06, C(0x1a1a1e)); bl(a2, 0, 0.9, 0.22, C(0x1a1a1e)); cy(a2, 0, 0.5, 0.262, 0.035, C(0x15151a)); bx(a2, 0.25, 0.52, 0.3, 0.22, 0.012, white); bx(a2, 0.25, 0.58, 0.16, 0.08, 0.014, col); cy(a2, 0, 0, 0.29, 0.035, dk); bx(a2, 0.2, 0.9, 0.2, 0.07, 0.16, C(0x0c0c10)); });
            break; }
          case 2: { // fire hydrant: flared base plate, barrel, collars, two side nozzles with caps, domed bonnet and an operating nut
            const hr = C(0xc9262a, 0.8 + 0.4 * hash01(id)), cap = C(0xe8c11a);
            bx(0, 0, 0, 0.42, 0.05, 0.42, dk); cy(0, 0, 0.05, 0.17, 0.12, hr); cy(0, 0, 0.17, 0.125, 0.5, hr); cy(0, 0, 0.62, 0.17, 0.05, hr); cy(0, 0, 0.4, 0.15, 0.04, hr); bl(0, 0, 0.72, 0.15, hr); cy(0, 0, 0.84, 0.045, 0.07, cap);
            for (const sd of [-1, 1]) { bx(sd * 0.2, 0, 0.45, 0.2, 0.1, 0.1, hr); bx(sd * 0.31, 0, 0.45, 0.05, 0.14, 0.14, cap); } bx(0, 0.2, 0.45, 0.16, 0.14, 0.16, hr); bx(0, 0.31, 0.45, 0.04, 0.17, 0.17, cap); break; }
          case 3: { // pillar post box: banded body, domed cap, a dark letter slot with a gold plate, collection-time plaque
            const pr = C(0xc9262a, 0.8 + 0.4 * hash01(id));
            cy(0, 0, 0, 0.35, 0.1, dk); cy(0, 0, 0.1, 0.32, 0.95, pr); cy(0, 0, 0.28, 0.335, 0.05, C(0x16161a)); cy(0, 0, 1.05, 0.345, 0.07, C(0x16161a)); { const p = P(0, 0); g.geo(ico, p[0], y + 1.12, p[1], 0.32, 0.17, 0.32, 0, pr); }
            bx(0, 0.31, 0.78, 0.34, 0.07, 0.03, C(0x0c0c10)); bx(0, 0.325, 0.78, 0.4, 0.14, 0.012, C(0xd8b04a)); bx(0, 0.325, 0.55, 0.18, 0.14, 0.012, white); bx(0, 0.325, 0.38, 0.12, 0.03, 0.012, C(0xd8b04a)); break; }
          case 4: { // phone booth: red frame, glazing bars on three sides, roof crown, lit panel and a handset shelf
            const cc = [0.3, 0.9, 1.1], rr = C(0xc9262a, 0.85 + 0.3 * hash01(id)), gl = C(0x14252f);
            for (const a2 of [-0.5, 0.5]) for (const b2 of [-0.5, 0.5]) bx(a2, b2, 0, 0.08, 2.3, 0.08, rr);
            bx(0, 0, 2.3, 1.2, 0.1, 1.2, rr); bx(0, 0, 2.4, 1.0, 0.1, 1.0, rr); bx(0, 0, 2.5, 0.8, 0.06, 0.8, rr); bx(0, 0, 0, 1.1, 0.12, 1.1, C(0x3a3a40));
            bx(0, -0.48, 0.12, 0.92, 2.15, 0.035, gl); bx(-0.48, 0, 0.12, 0.035, 2.15, 0.92, gl); bx(0.48, 0, 0.12, 0.035, 2.15, 0.92, gl);
            for (const t2 of [-0.3, 0, 0.3]) { bx(t2, -0.49, 0.12, 0.03, 2.15, 0.05, rr); bx(-0.49, t2, 0.12, 0.05, 2.15, 0.03, rr); bx(0.49, t2, 0.12, 0.05, 2.15, 0.03, rr); }
            for (const h2 of [0.62, 1.15, 1.68]) { bx(0, -0.49, h2, 0.95, 0.03, 0.05, rr); bx(-0.49, 0, h2, 0.05, 0.03, 0.95, rr); bx(0.49, 0, h2, 0.05, 0.03, 0.95, rr); }
            bx(0, -0.4, 1.0, 0.5, 0.08, 0.18, C(0x2a2a30)); bx(0, -0.43, 1.28, 0.22, 0.28, 0.06, C(0x101014));
            { const p = P(0, -0.4); neon.box(p[0], y + 1.2, p[1], 0.7, 1.2, 0.05, R, HOT(cc[0], cc[1], cc[2], 1.5)); glowPts.push(p[0], y + 1.3, p[1], cc[0], cc[1], cc[2], 5); } break; }
          case 5: { // tea / newspaper kiosk: painted box, serving shelf with stocked goods, scalloped striped awning, hanging packets, crate and a glowing sign
            const kk = kiosk[id % kiosk.length]; const aw = [id % 2 ? white : yel, kk[0]];
            bx(0, -0.4, 0, 2.6, 2.0, 1.5, kk[0]); bx(0, -0.4, 2.0, 2.76, 0.1, 1.64, C(0x3a3a42)); bx(0, 0.5, 0.95, 2.8, 0.08, 0.55, wood); bx(0, 0.3, 0.95, 2.8, 0.05, 0.1, C(0x3a3a42));
            bx(0, 0.36, 1.0, 2.0, 0.55, 0.04, C(0x0c0c10)); // dark serving opening
            for (let q = -4; q <= 4; q++) { const gc = [C(0xe8458a), C(0xf2a21a), C(0x3ea8e0), C(0xe8e8e2), C(0x6bc060)][(id + q + 9) % 5]; bx(q * 0.22, 0.2, 1.04, 0.16, 0.3, 0.08, gc); bx(q * 0.22, 0.2, 1.34, 0.14, 0.2, 0.07, [C(0xd8302a), C(0xf2f0e8), C(0xf2c21c)][(id + q + 9) % 3]); }
            for (let k = 0; k < 12; k++) bx(-1.45 + k * 0.2636, 0.64, 1.33 - (k % 2) * 0.0, 0.2636, 0.04, 1.3, aw[k % 2]);
            for (let k = 0; k < 12; k++) bx(-1.45 + k * 0.2636, 1.18, 1.0, 0.2636, 0.18, 0.04, aw[k % 2]);
            for (const a2 of [-1.45, 1.45]) bx(a2, 1.22, 0, 0.07, 1.35, 0.07, steel);
            for (let q = -2; q <= 2; q++) { bx(q * 0.45, 0.94, 1.6, 0.14, 0.2, 0.03, [C(0xd8302a), C(0xf2c21c), C(0x3ea8e0)][(id + q + 6) % 3]); bx(q * 0.45, 0.94, 1.7, 0.012, 0.18, 0.012, C(0x303030)); }
            { const p = P(0, 0.72); neon.box(p[0], y + 2.28, p[1], 2.2, 0.38, 0.06, R, HOT(kk[1][0], kk[1][1], kk[1][2], 2)); glowPts.push(p[0], y + 2.3, p[1], kk[1][0], kk[1][1], kk[1][2], 8); const q = P(0.5, 0.2); glowPts.push(q[0], y + 1.6, q[1], 1, 0.82, 0.5, 6); }
            bx(-1.65, -0.4, 0, 0.5, 0.45, 0.5, C(0x8a6a3a)); bx(-1.65, -0.4, 0.45, 0.45, 0.4, 0.45, C(0xa07a42)); bx(-1.65, -0.4, 0.002, 0.6, 0.01, 0.6, C(0x4a4a50)); bx(1.7, -0.3, 0, 0.5, 0.7, 0.4, C(0x2a5ca8)); cy(1.7, -0.3, 0.7, 0.2, 0.06, C(0x1a1a1e)); break; }
          case 6: // bollards: domed caps, a reflective band, a darker foot ring
            for (let q = -1.5; q <= 1.5; q += 1.0) { cy(q, 0, 0, 0.1, 0.07, dk); cy(q, 0, 0.07, 0.085, 0.75, C(0x5a5e68, 0.85 + 0.3 * hash01(id + q * 3))); bl(q, 0, 0.84, 0.09, C(0x4e525c)); bx(q, 0, 0.5, 0.19, 0.09, 0.19, white); bx(q, 0, 0.66, 0.18, 0.03, 0.18, C(0xd8302a)); } break;
          case 7: // stone planters: tapered pots with a rim, dark soil, layered shrubs and flowers
            for (const a2 of [-0.7, 0.7]) { cy(a2, 0, 0, 0.42, 0.3, C(0x9a948a, 0.8 + 0.3 * hash01(id + a2 * 5))); cy(a2, 0, 0.3, 0.5, 0.26, stone); cy(a2, 0, 0.54, 0.54, 0.05, C(0xaaa49a)); cy(a2, 0, 0.58, 0.45, 0.03, C(0x2a2018)); const sg = a2 > 0 ? 1 : 0;
              bl(a2, 0, 0.8, 0.5, sh[(id + sg) % 3]); bl(a2 + 0.22, 0.12, 0.9, 0.3, sh[(id + sg + 1) % 3]); bl(a2 - 0.2, -0.14, 0.92, 0.28, sh[(id + sg + 2) % 3]); bl(a2 + 0.15, 0.1, 1.12, 0.18, flw[(id + (a2 > 0 ? 2 : 0)) % 5]); bl(a2 - 0.2, -0.1, 1.05, 0.15, flw[(id + 1) % 5]); bl(a2 + 0.02, -0.2, 1.1, 0.13, flw[(id + 3) % 5]); } break;
          case 8: { // sign pole: capped steel pole, clamps, a parking sign with a white border, and a green street-name plate on brackets
            cy(0, 0, 0, 0.045, 2.75, steel); cy(0, 0, 2.72, 0.06, 0.04, dk); cy(0, 0, 0, 0.07, 0.08, dk); bx(0, 0.05, 2.15, 0.66, 0.66, 0.035, white); bx(0, 0.07, 2.15, 0.6, 0.6, 0.04, C(0x1f55b0)); bx(0, 0.09, 2.15, 0.42, 0.42, 0.04, white); bx(0, 0.11, 2.15, 0.15, 0.34, 0.04, C(0x1f55b0)); bx(0, 0.11, 2.15, 0.34, 0.12, 0.045, C(0x1f55b0));
            bx(0, 0.08, 2.61, 1.0, 0.24, 0.03, white); bx(0, 0.1, 2.61, 0.95, 0.2, 0.04, C(0x0b5d3b)); for (const a2 of [-0.3, 0.3]) bx(a2, 0.03, 2.61, 0.03, 0.28, 0.03, steel); bx(0, 0.03, 2.0, 0.1, 0.05, 0.1, steel); bx(0, 0.03, 2.33, 0.1, 0.05, 0.1, steel); break; }
          case 9: { // electrical transformer cabinet: plinth, doors with louvres, hazard banding, roof overhang, padlock hasp
            const tb = C(0x6d7a70, 0.82 + 0.3 * hash01(id));
            bx(0, 0, 0, 1.64, 0.14, 1.04, C(0x8a8a86)); bx(0, 0, 0.14, 1.5, 1.38, 0.9, tb); bx(0, 0, 1.52, 1.62, 0.07, 1.02, C(0x55605a));
            for (const a2 of [-0.37, 0.37]) { bx(a2, 0.46, 0.3, 0.64, 1.06, 0.02, C(0x5f6c63)); for (let q = 0; q < 5; q++) bx(a2, 0.47, 0.95 + q * 0.07, 0.5, 0.025, 0.02, C(0x2c3430)); }
            bx(0, 0.47, 0.75, 0.04, 0.12, 0.03, C(0x2a2a30)); bx(0, 0.48, 0.66, 0.05, 0.07, 0.04, C(0xd8b04a)); bx(0, 0.46, 0.5, 1.52, 0.11, 0.03, yel); for (let q = -3; q <= 3; q++) bx(q * 0.2, 0.47, 0.5, 0.1, 0.11, 0.035, dk);
            bx(0.6, 0.47, 1.2, 0.24, 0.24, 0.02, yel); bx(0.6, 0.48, 1.22, 0.05, 0.12, 0.02, dk); bx(0, 0.02, 0.003, 1.9, 0.012, 1.3, C(0x4a4a50)); break; }
          case 10: { // road works: hi-vis striped barrier on feet, reflective bands, traffic cones with white collars, amber flasher
            for (let q = -1; q <= 1; q++) { bx(q * 0.8, 0, 0.55, 0.78, 0.22, 0.05, q % 2 ? red : white); bx(q * 0.8, 0, 0.77, 0.78, 0.2, 0.05, q % 2 ? white : red); bx(q * 0.8, 0.03, 0.55, 0.78, 0.01, 0.01, C(0xfff2c8)); }
            for (const a2 of [-1.2, 1.2]) { bx(a2, 0, 0, 0.06, 0.95, 0.06, steel); bx(a2, 0, 0, 0.06, 0.04, 0.7, dk); }
            for (const a2 of [-1.6, 0, 1.6]) { const p = P(a2, 0.9); g.geo(cone, p[0], y, p[1], 0.22, 0.7, 0.22, 0, C(0xf26a1a)); g.geo(cyl, p[0], y + 0.35, p[1], 0.145, 0.09, 0.145, 0, white); g.geo(cyl, p[0], y + 0.5, p[1], 0.11, 0.06, 0.11, 0, white); g.geo(cyl, p[0], y, p[1], 0.26, 0.03, 0.26, 0, C(0x1a1a1e)); }
            { const p = P(0, 0); neon.box(p[0], y + 1.0, p[1], 0.3, 0.2, 0.3, R, HOT(1, 0.62, 0.05, 2.4)); glowPts.push(p[0], y + 1.05, p[1], 1, 0.6, 0.1, 6); } break; }
          case 11: // flower stand: wooden tiers with buckets and bunches in several colours, a price board
            bx(0, 0, 0, 1.3, 0.5, 0.7, wood); bx(0, -0.15, 0.5, 1.2, 0.4, 0.45, wood); bx(0, 0.34, 0.5, 1.34, 0.04, 0.74, C(0x5a3c22)); for (let q = -2; q <= 2; q++) { cy(q * 0.24, 0.1, 0.5, 0.11, 0.12, C(0x8a8e98)); cy(q * 0.24, -0.15, 0.9, 0.1, 0.1, C(0x8a8e98)); bl(q * 0.24, 0.1, 0.72, 0.15, flw[(id + q + 5) % 5]); bl(q * 0.24, 0.1, 0.84, 0.1, sh[(q + 4) % 3]); bl(q * 0.24, -0.15, 1.0, 0.14, flw[(id + q + 7) % 5]); }
            bx(0.55, 0.25, 0.9, 0.34, 0.24, 0.025, white); bx(0.55, 0.25, 0.9, 0.3, 0.2, 0.03, C(0x2a2a30)); break;
          case 13: // CCTV pole: tapered steel pole, base plate, junction box, arm and a dome camera with a status LED
            cy(0, 0, 0, 0.1, 0.1, dk); cy(0, 0, 0.1, 0.07, 5.1, steel); cy(0, 0, 0.1, 0.085, 1.0, C(0x6a6e78)); bx(0, 0.1, 1.2, 0.3, 0.45, 0.2, C(0x3a4048)); bx(0, 0.3, 5.1, 0.9, 0.1, 0.1, steel); bx(0, 0.75, 5.1, 0.05, 0.2, 0.05, steel); bx(0, 0.75, 4.92, 0.28, 0.18, 0.24, white); { const p = P(0, 0.75); g.geo(ico, p[0], y + 4.9, p[1], 0.17, 0.12, 0.17, 0, C(0x181a20)); } bx(0, 0.55, 5.0, 0.35, 0.22, 0.2, white); { const p = P(0, 0.92); neon.box(p[0], y + 5.0, p[1], 0.07, 0.07, 0.07, R, HOT(0.2, 0.6, 1, 3)); glowPts.push(p[0], y + 5.0, p[1], 0.2, 0.6, 1, 3); } break;
          case 15: { // drink vending machines: a bank of lit machines, each with a glowing front of colourful cans, coin slot and an output tray
            const vc = [C(0xd8302a), C(0x2a6ac8), C(0xf2f0e8), C(0x2f9a52)];
            for (let q = -1; q <= 1; q++) { const a2 = q * 0.78, vb = vc[(id + q + 3) % 4];
              bx(a2, 0, 0, 0.72, 1.78, 0.62, vb); bx(a2, 0.3, 0.38, 0.6, 1.0, 0.04, C(0x10141c)); bx(a2, 0.31, 0.12, 0.6, 0.16, 0.05, C(0x20242c));
              for (let rw = 0; rw < 3; rw++) for (let cn = 0; cn < 5; cn++) bx(a2 - 0.24 + cn * 0.12, 0.33, 0.55 + rw * 0.28, 0.08, 0.2, 0.03, [C(0xe83a2a), C(0x2ab0e8), C(0xf2c21c), C(0x7ad04a), C(0xf2f0e8)][(cn + rw + id) % 5]);
              { const p = P(a2, 0.34); neon.box(p[0], y + 1.1, p[1], 0.58, 0.95, 0.03, R, HOT(0.85, 0.95, 1, 1.5)); glowPts.push(p[0], y + 1.1, p[1], 0.85, 0.92, 1, 6); } }
            bx(0, -0.3, 0.003, 2.6, 0.012, 1.2, C(0x4a4a50)); break; }
          case 16: { // bicycle rack: a steel rail with a row of parked bicycles (frames, wheels, baskets)
            bx(0, 0, 0, 2.2, 0.06, 0.06, steel);
            for (let q = -2; q <= 2; q++) { const a2 = q * 0.4, cc = [C(0x2a6ac8), C(0xd8302a), C(0x9aa0aa), C(0x2f9a52), C(0xf2c21c)][(id + q + 4) % 5];
              bx(a2, 0, 0.06, 0.04, 0.9, 1.5, dk); bx(a2, 0, 0.5, 0.05, 0.05, 0.9, cc); bx(a2, 0.5, 0.78, 0.04, 0.35, 0.3, steel); bx(a2, -0.5, 0.4, 0.04, 0.05, 0.2, C(0x1a1a1e)); bx(a2, 0.7, 0.88, 0.3, 0.2, 0.3, steel); }
            break; }
          case 14: { // dumpster: ribbed steel body on small wheels, hinged lids with handles, a recycling label
            const dm = C(0x2c6a40, 0.8 + 0.35 * hash01(id)), dl = C(0x24502f, 0.85 + 0.3 * hash01(id + 1));
            bx(0, 0, 0.2, 2.2, 1.0, 1.1, dm); for (let q = -4; q <= 4; q++) bx(q * 0.25, 0.56, 0.25, 0.06, 0.9, 0.04, dl);
            bx(0, 0, 1.2, 2.3, 0.09, 1.2, dl); bx(0, 0.06, 1.28, 2.2, 0.04, 0.5, C(0x1a3a24)); for (const a2 of [-0.55, 0.55]) bx(a2, 0.66, 1.3, 0.5, 0.05, 0.05, dk);
            bx(0, 0.58, 0.45, 2.0, 0.08, 0.06, C(0xe8e8e2)); bx(-0.7, 0.6, 0.7, 0.55, 0.3, 0.012, white); bx(-0.7, 0.605, 0.7, 0.4, 0.2, 0.014, C(0x2a5ca8)); for (const a2 of [-0.9, 0.9]) { cy(a2, 0.5, 0, 0.1, 0.2, dk); cy(a2, -0.5, 0, 0.1, 0.2, dk); }
            bx(0, 0.02, 0.003, 2.6, 0.012, 1.5, C(0x46464c)); break; }
        }
      }
    }
    // ---- plants: trees, palms, bushes, grass and boulders (plants.js decides where, vegetation.js builds them). Two levels of detail per chunk;
    //      the view shows the rich one near the car and the light one beyond ----
    if (mats.foliage && world.plantsFor) {
      if (NOW() > SL.t) yield 21;
      const list = world.plantsForSteps ? yield* world.plantsForSteps(ci, cj, hAt) : world.plantsFor(ci, cj, hAt); if (NOW() > SL.t) yield 22;
      const lod = buildPlantMeshes(list, ch.lamps, mats, (world.vegQuality || 1) < 0.75 ? 1 : 3);
      for (const nm of ["hi", "mid", "lo"]) for (const m of lod[nm]) group.add(m);
      group.userData.lod = lod; group.userData.plantCount = list.length; group.userData.cx = x0 + CH / 2; group.userData.cz = z0 + CH / 2; group.userData.tier = "hi";
    }
    if (NOW() > SL.t) yield 23;
    // ---- roadside utility poles and sagging power lines ----
    { const placed = buildPoles(world, ci, cj, g, g, { wire: DARK(0.025), concrete: C(0x8d8d88), steel: C(0x4a4b52), glass: C(0x6fb0a0), can: C(0x59625a) });
      if (world.addCollider) { world._poleDone = world._poleDone || new Set(); const pk = ci * 4096 + cj; if (!world._poleDone.has(pk)) { world._poleDone.add(pk); for (const q of placed) world.addCollider({ t: 0, x: q[0], z: q[1], hw: 0.2, hd: 0.2, c: 1, s: 0, y: city.groundH(q[0], q[1]), h: 9 }, q[0] - 1, q[1] - 1, q[0] + 1, q[1] + 1); } } }
    if (!g.empty) group.add(new THREE.Mesh(g.build(), mats.props));
    if (NOW() > SL.t) yield 24;
    // ---- Underground-2 style street dressing: hanging banners, chevron boards on bends, striped hazard posts with amber beacons ----
    {
            const dg = GBn(), ban = GBn(); const bendList = bendsInChunk(city, ci, cj);       // vertical banners hung from every few lamp posts, facing the traffic
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
            // Upgrade 56 (Tokyo only): matsuri lantern strings - a sagging line of little paper lanterns strung across the street from lamp post to lamp post, red / white / pink / orange, glowing softly
      if (IS_TOKYO) {
        const LAN = [[0.95, 0.12, 0.14], [1.0, 0.96, 0.9], [1.0, 0.45, 0.62], [1.0, 0.62, 0.15], [0.98, 0.85, 0.2]]; const recent = []; let pn = 0;
        for (const l of ch.lamps) {
          let q = null, dx = 0, dz = 0, dist = 0;
          if (l.c !== 2 && l.h <= 13 && districtDens(l.x, l.z) >= 0.12) for (const r of recent) {
            if (r.ln) continue; const ex = l.x - r.x, ez = l.z - r.z, ed = Math.hypot(ex, ez);
            if (ed < 11 || ed > 75 || (l.tx * r.tx + l.tz * r.tz) < 0.92 || Math.abs(l.y - r.y) > 2.5) continue;
            q = r; dx = ex; dz = ez; dist = ed; break;
          }
          recent.push(l); if (recent.length > 8) recent.shift();
          if (!q) continue; q.ln = true;
          if (dist < 30 && (++pn & 1) === 0) continue;
          const y0 = Math.min(q.y + q.h, l.y + l.h) - 1.0, n = Math.max(4, Math.round(dist / 3.2)), sag = Math.min(2.2, dist * 0.045); let px = q.x, py = y0, pz = q.z;
          for (let k = 1; k <= n; k++) {
            const t = k / n, x = q.x + dx * t, z = q.z + dz * t, y = y0 - Math.sin(t * Math.PI) * sag, sx = x - px, sy = y - py, sz = z - pz, sl = Math.hypot(sx, sy, sz) || 1;
            dg.box((x + px) / 2, (y + py) / 2, (z + pz) / 2, sl, 0.04, 0.04, Math.atan2(sz, sx), C(0x3a3a40)); px = x; py = y; pz = z;
            if (k < n) { const c = LAN[(k + pn) % LAN.length]; neon.geo(ico, x, y - 0.4, z, 0.55, 0.7, 0.55, 0, HOT(c[0], c[1], c[2], 1.15)); dg.box(x, y - 0.08, z, 0.1, 0.14, 0.1, 0, C(0x2a2a2e)); }
          }
        }
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
        if (w.cl) continue;
        if (hz++ % 5 !== 0) continue; const dx = w.x2 - w.x1, dz = w.z2 - w.z1, l = Math.hypot(dx, dz) || 1; const rot = Math.atan2(dz, dx);
        for (let k = 0; k < 4; k++) dg.box(w.x1, w.y + k * 0.4, w.z1, 0.55, 0.4, 0.55, rot, k % 2 ? C(0x16161a) : C(0xf2c200));
        neon.box(w.x1, w.y + 1.6, w.z1, 0.32, 0.22, 0.32, rot, HOT(1, 0.62, 0.05, 2.2)); glowPts.push(w.x1, w.y + 1.7, w.z1, 1, 0.6, 0.1, 5);
        if (l > 6) for (let k = 0; k < 3; k++) { const t = 0.25 + k * 0.25; dg.box(w.x1 + dx * t, w.y + 0.78, w.z1 + dz * t, 1.3, 0.16, 0.6, rot, k % 2 ? C(0x16161a) : C(0xf2c200)); }
      }
            // road-end barricades: red and white planks on posts right across the road, amber flashers at both ends and a "no entry" sign in the middle
      for (const w of world.wallsIn(ci, cj)) {
        if (!w.cl) continue;
        const dx = w.x2 - w.x1, dz = w.z2 - w.z1, l = Math.hypot(dx, dz) || 1, rot = Math.atan2(dz, dx), np = Math.max(3, Math.round(l / 1.1));
        for (let row = 0; row < 2; row++) for (let k = 0; k < np; k++) { const t = (k + 0.5) / np; dg.box(w.x1 + dx * t, w.y + 0.6 + row * 0.5, w.z1 + dz * t, l / np + 0.02, 0.32, 0.1, rot, (k + row) % 2 ? C(0xeeeeee) : C(0xcf2a22)); }
        const nposts = Math.max(2, Math.round(l / 5) + 1);
        for (let k = 0; k < nposts; k++) { const t = k / (nposts - 1); dg.box(w.x1 + dx * t, w.y, w.z1 + dz * t, 0.16, 1.55, 0.16, rot, C(0x2c2c32)); }
        for (const t of [0, 1]) { const fx = w.x1 + dx * t, fz = w.z1 + dz * t; dg.box(fx, w.y + 1.55, fz, 0.3, 0.1, 0.3, rot, C(0x16161a)); neon.box(fx, w.y + 1.65, fz, 0.26, 0.2, 0.26, rot, HOT(1, 0.62, 0.05, 2.4)); glowPts.push(fx, w.y + 1.75, fz, 1, 0.6, 0.1, 5); }
        { const mx = w.x1 + dx * 0.5 - w.fx * 0.5, mz = w.z1 + dz * 0.5 - w.fz * 0.5, ar = Math.atan2(w.fx, -w.fz); dg.box(mx, w.y, mz, 0.12, 2.3, 0.12, ar, C(0x44444c)); neon.box(mx - w.fx * 0.08, w.y + 2.0, mz - w.fz * 0.08, 0.9, 0.9, 0.05, ar, HOT(0.9, 0.08, 0.06, 1.1)); neon.box(mx - w.fx * 0.12, w.y + 2.0, mz - w.fz * 0.12, 0.62, 0.16, 0.05, ar, HOT(1, 1, 1, 1.2)); }
      }
            if (!dg.empty) group.add(new THREE.Mesh(dg.build(), mats.props));
      if (!ban.empty) group.add(new THREE.Mesh(ban.build(), mats.blade));
    }
    if (NOW() > SL.t) yield 25;
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

  group.traverse((o) => {
    if (!o.isMesh) return; o.matrixAutoUpdate = false; o.updateMatrix();
    // once the picture card has a block's mesh, the processor's own copy of the numbers is not needed (this about halves the memory a block holds); plant shapes are shared, so they stay
    if (!o.isInstancedMesh && o.geometry && !(o.geometry.userData && o.geometry.userData.shared)) { const gg = o.geometry; for (const nm in gg.attributes) gg.attributes[nm].onUpload(releaseAfterUpload); if (gg.index) gg.index.onUpload(releaseAfterUpload); }
  });
  if (!gr.empty) { const gm = new THREE.Mesh(gr.build(), mats.graf); gm.renderOrder = 2; gm.userData.cover = true; group.add(gm); }
  for (const g of live) g.giveBack(); // any builder that stayed empty returns its lists too
  return group;
}
function baseHRef(city, n) { return city.groundH(n.x, n.z); }
function hash2(a, b) { return hsh(a * 7919 + b * 104729); }
export function disposeGroup(group) { group.traverse((o) => { if (o.isInstancedMesh) o.dispose(); if (o.geometry && !(o.geometry.userData && o.geometry.userData.shared)) o.geometry.dispose(); }); } // plant shapes are shared by every chunk, so only the instance data goes
