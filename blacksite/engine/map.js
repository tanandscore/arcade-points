// Operation Blacksite map engine. A map is a plain definition (see ./maps/*.js): named walkable zones on a grid, two bomb sites,
// spawns, props, bot routes and a look (theme). loadMap() makes one of them current; createMap() then builds everything the game
// collides with, shoots through and navigates around from it — so what you see is what you hit.
//
// x runs west->east, z runs north->south. The exported ZONES/SITES/spawn arrays are filled in place by loadMap().
import { CELL, WALL_H, STEP_H } from "./mapkit";
import { MAPS, MAP_LIST } from "./maps";

export { CELL, WALL_H, STEP_H, MAP_LIST };
export let COLS = 56;
export let ROWS = 46;
export const ZONES = [];
export const SITES = {};
export const TERROR_SPAWNS = [];
export const POLICE_SPAWNS = [];
let PROPS_DEF = [];
export let CUR = null;

const cellC = (i) => (i + 0.5) * CELL;
export function loadMap(id) {
  const def = MAPS[id] || MAPS.foundry; CUR = def; COLS = def.cols; ROWS = def.rows;
  ZONES.length = 0; ZONES.push(...def.zones);
  for (const k of Object.keys(SITES)) delete SITES[k];
  for (const k of Object.keys(def.sites)) { const s = def.sites[k]; SITES[k] = { id: k, cx: s.cx * CELL, cz: s.cz * CELL, r: s.r, color: s.color }; }
  TERROR_SPAWNS.length = 0; TERROR_SPAWNS.push(...def.tSpawns.map(([i, j]) => ({ x: cellC(i), z: cellC(j) })));
  POLICE_SPAWNS.length = 0; POLICE_SPAWNS.push(...def.pSpawns.map(([i, j]) => ({ x: cellC(i), z: cellC(j) })));
  PROPS_DEF = [];
  const R = (kind, x0, z0, x1, z1, h, o = {}) => PROPS_DEF.push({ kind, x0: x0 * CELL, z0: z0 * CELL, x1: x1 * CELL, z1: z1 * CELL, h, y0: o.y0 || 0, color: o.color ?? 0, label: o.label || null, solid: o.solid });
  def.props(R);
  return def;
}
loadMap("foundry");

// ---------------------------------------------------------------------------------------------------------------
export function createMap() {
  const N = COLS * ROWS;
  const solid = new Uint8Array(N).fill(1);
  const zoneIdx = new Int16Array(N).fill(-1);
  const roof = new Uint8Array(N);
  ZONES.forEach((z, zi) => {
    const [x0, z0, x1, z1] = z.rect;
    for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) { const k = j * COLS + i; solid[k] = 0; zoneIdx[k] = zi; if (z.roof) roof[k] = 1; else roof[k] = 0; }
  });

  const boxes = PROPS_DEF.map((p, id) => ({ id, kind: p.kind, x0: p.x0, x1: p.x1, z0: p.z0, z1: p.z1, y0: p.y0, y1: p.y0 + p.h, color: p.color }));
  const def = CUR;
  const buckets = new Map();
  boxes.forEach((b) => {
    const i0 = Math.floor(b.x0 / CELL), i1 = Math.floor((b.x1 - 1e-6) / CELL), j0 = Math.floor(b.z0 / CELL), j1 = Math.floor((b.z1 - 1e-6) / CELL);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * COLS + i; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(b); }
  });

  const inGrid = (i, j) => i >= 0 && j >= 0 && i < COLS && j < ROWS;
  const isSolidCell = (i, j) => !inGrid(i, j) || solid[j * COLS + i] === 1;
  const W = COLS * CELL, D = ROWS * CELL;

  const zoneAt = (x, z) => { const i = Math.floor(x / CELL), j = Math.floor(z / CELL); if (!inGrid(i, j)) return null; const zi = zoneIdx[j * COLS + i]; return zi < 0 ? null : ZONES[zi]; };
  const floorAt = (x, z) => { const zn = zoneAt(x, z); return zn ? zn.floor : "concrete"; };
  const isRoofed = (x, z) => { const i = Math.floor(x / CELL), j = Math.floor(z / CELL); return inGrid(i, j) && roof[j * COLS + i] === 1; };

  // ---- movement: slide a circle along walls and props -------------------------------------------------
  const nearbyBoxes = (x, z, out) => {
    out.length = 0; const ci = Math.floor(x / CELL), cj = Math.floor(z / CELL);
    for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) { const l = buckets.get(j * COLS + i); if (l) for (const b of l) if (out.indexOf(b) < 0) out.push(b); }
    return out;
  };
  const tmp = [];
  // Pushes (pos.x,pos.z) out of anything solid that overlaps a circle of radius r at height feetY..feetY+height.
  function collide(pos, r, feetY, height) {
    for (let it = 0; it < 3; it++) {
      let moved = false;
      const ci = Math.floor(pos.x / CELL), cj = Math.floor(pos.z / CELL);
      for (let j = cj - 1; j <= cj + 1; j++) for (let i = ci - 1; i <= ci + 1; i++) {
        if (!isSolidCell(i, j)) continue;
        const x0 = i * CELL, x1 = x0 + CELL, z0 = j * CELL, z1 = z0 + CELL;
        const qx = Math.max(x0, Math.min(pos.x, x1)), qz = Math.max(z0, Math.min(pos.z, z1));
        const dx = pos.x - qx, dz = pos.z - qz, d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 > 1e-9) { const d = Math.sqrt(d2), k = (r - d) / d; pos.x += dx * k; pos.z += dz * k; }
          else { const e = [pos.x - x0, x1 - pos.x, pos.z - z0, z1 - pos.z]; const m = Math.min(...e); if (m === e[0]) pos.x = x0 - r; else if (m === e[1]) pos.x = x1 + r; else if (m === e[2]) pos.z = z0 - r; else pos.z = z1 + r; }
          moved = true;
        }
      }
      for (const b of nearbyBoxes(pos.x, pos.z, tmp)) {
        if (b.y1 <= feetY + STEP_H || b.y0 >= feetY + height) continue;
        const qx = Math.max(b.x0, Math.min(pos.x, b.x1)), qz = Math.max(b.z0, Math.min(pos.z, b.z1));
        const dx = pos.x - qx, dz = pos.z - qz, d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 > 1e-9) { const d = Math.sqrt(d2), k = (r - d) / d; pos.x += dx * k; pos.z += dz * k; }
          else { const e = [pos.x - b.x0, b.x1 - pos.x, pos.z - b.z0, b.z1 - pos.z]; const m = Math.min(...e); if (m === e[0]) pos.x = b.x0 - r; else if (m === e[1]) pos.x = b.x1 + r; else if (m === e[2]) pos.z = b.z0 - r; else pos.z = b.z1 + r; }
          moved = true;
        }
      }
      if (!moved) break;
    }
  }
  // The highest surface you can stand on at (x,z) that is no more than a step above your feet.
  function groundAt(x, z, feetY, r = 0.3) {
    let g = 0;
    for (const b of nearbyBoxes(x, z, tmp)) {
      if (x > b.x0 - r * 0.5 && x < b.x1 + r * 0.5 && z > b.z0 - r * 0.5 && z < b.z1 + r * 0.5 && b.y1 <= feetY + STEP_H + 0.05 && b.y1 > g) g = b.y1;
    }
    return g;
  }

  // ---- bullets and line of sight ---------------------------------------------------------------------------
  let slabAxis = -1, slabSign = 0;
  const slab = (ox, oy, oz, dx, dy, dz, b, maxT) => {
    let t0 = 0, t1 = maxT; slabAxis = -1;
    for (let a = 0; a < 3; a++) {
      const o = a === 0 ? ox : a === 1 ? oy : oz, d = a === 0 ? dx : a === 1 ? dy : dz;
      const lo = a === 0 ? b.x0 : a === 1 ? b.y0 : b.z0, hi = a === 0 ? b.x1 : a === 1 ? b.y1 : b.z1;
      if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return -1; }
      else { let ta = (lo - o) / d, tb = (hi - o) / d; if (ta > tb) { const s = ta; ta = tb; tb = s; } if (ta > t0) { t0 = ta; slabAxis = a; slabSign = d > 0 ? -1 : 1; } if (tb < t1) t1 = tb; if (t0 > t1) return -1; }
    }
    return t0;
  };
  const wallBox = { x0: 0, x1: 0, y0: 0, y1: WALL_H, z0: 0, z1: 0 };
  // Ray from (ox,oy,oz) along unit direction (dx,dy,dz). Returns { t, kind, box } for the first thing hit, or null.
  function raycast(ox, oy, oz, dx, dy, dz, maxT) {
    let best = maxT, kind = null, hitBox = null, nAxis = -1, nSign = 0;
    if (dy < -1e-6) { const t = -oy / dy; if (t > 0 && t < best) { best = t; kind = "floor"; nAxis = 1; nSign = 1; } }
    if (dy > 1e-6) { const t = (WALL_H + 3 - oy) / dy; if (t > 0 && t < best) { best = t; kind = "sky"; } }
    let i = Math.floor(ox / CELL), j = Math.floor(oz / CELL);
    const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
    const tdx = Math.abs(dx) < 1e-9 ? Infinity : Math.abs(CELL / dx), tdz = Math.abs(dz) < 1e-9 ? Infinity : Math.abs(CELL / dz);
    let tmx = Math.abs(dx) < 1e-9 ? Infinity : ((dx > 0 ? (i + 1) * CELL - ox : ox - i * CELL) / Math.abs(dx));
    let tmz = Math.abs(dz) < 1e-9 ? Infinity : ((dz > 0 ? (j + 1) * CELL - oz : oz - j * CELL) / Math.abs(dz));
    let tEnter = 0;
    for (let n = 0; n < 160; n++) {
      if (tEnter > best) break;
      if (isSolidCell(i, j)) {
        wallBox.x0 = i * CELL; wallBox.x1 = wallBox.x0 + CELL; wallBox.z0 = j * CELL; wallBox.z1 = wallBox.z0 + CELL;
        const t = slab(ox, oy, oz, dx, dy, dz, wallBox, best);
        if (t >= 0 && t < best) { best = t; kind = "wall"; hitBox = null; nAxis = slabAxis; nSign = slabSign; }
        if (t < 0 && !(oy > WALL_H)) { /* ray passes over the top of this wall cell */ }
      } else {
        const l = buckets.get(j * COLS + i);
        if (l) for (const b of l) { const t = slab(ox, oy, oz, dx, dy, dz, b, best); if (t >= 0 && t < best) { best = t; kind = "prop"; hitBox = b; nAxis = slabAxis; nSign = slabSign; } }
      }
      if (tmx < tmz) { tEnter = tmx; tmx += tdx; i += sx; } else { tEnter = tmz; tmz += tdz; j += sz; }
      if (i < -1 || j < -1 || i > COLS || j > ROWS) break;
    }
    return kind ? { t: best, kind, box: hitBox, nx: nAxis === 0 ? nSign : 0, ny: nAxis === 1 ? nSign : 0, nz: nAxis === 2 ? nSign : 0 } : null;
  }
  function hasLineOfSight(ax, ay, az, bx, by, bz) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, L = Math.hypot(dx, dy, dz);
    if (L < 1e-4) return true;
    const h = raycast(ax, ay, az, dx / L, dy / L, dz / L, L - 0.05);
    return !h || h.kind === "sky";
  }

  // ---- walking paths for the computer players --------------------------------------------------------------
  const NAV = 1.25; const NC = Math.round(W / NAV), NR = Math.round(D / NAV);
  const blocked = new Uint8Array(NC * NR);
  {
    const p = { x: 0, z: 0 };
    for (let j = 0; j < NR; j++) for (let i = 0; i < NC; i++) {
      p.x = (i + 0.5) * NAV; p.z = (j + 0.5) * NAV; const sx = p.x, sz = p.z; collide(p, 0.5, 0, 1.8);
      if (Math.hypot(p.x - sx, p.z - sz) > 0.02) blocked[j * NC + i] = 1;
    }
  }
  const navIdx = (x, z) => Math.max(0, Math.min(NR - 1, Math.floor(z / NAV))) * NC + Math.max(0, Math.min(NC - 1, Math.floor(x / NAV)));
  function nearestFree(x, z) {
    let i0 = Math.floor(x / NAV), j0 = Math.floor(z / NAV);
    if (i0 >= 0 && j0 >= 0 && i0 < NC && j0 < NR && !blocked[j0 * NC + i0]) return [i0, j0];
    for (let r = 1; r < 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; const i = i0 + di, j = j0 + dj;
      if (i >= 0 && j >= 0 && i < NC && j < NR && !blocked[j * NC + i]) return [i, j];
    }
    return [i0, j0];
  }
  const gScore = new Float32Array(NC * NR), came = new Int32Array(NC * NR), closed = new Uint8Array(NC * NR), seen = new Uint32Array(NC * NR); let stamp = 1;
  function walkLine(ax, az, bx, bz) {
    const L = Math.hypot(bx - ax, bz - az); const n = Math.ceil(L / 0.6);
    for (let k = 1; k < n; k++) { const t = k / n; const x = ax + (bx - ax) * t, z = az + (bz - az) * t; if (blocked[navIdx(x, z)]) return false; }
    return true;
  }
  // A* over the nav grid; returns an array of {x,z} waypoints (smoothed) or null.
  function findPath(sx, sz, tx, tz) {
    const [si, sj] = nearestFree(sx, sz), [ti, tj] = nearestFree(tx, tz);
    const start = sj * NC + si, goal = tj * NC + ti; stamp++;
    const heap = []; const push = (k, f) => { heap.push([f, k]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { let l = c * 2 + 1, r = l + 1, m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
    seen[start] = stamp; gScore[start] = 0; came[start] = -1; closed[start] = 0; push(start, 0);
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4142], [-1, 1, 1.4142], [1, -1, 1.4142], [-1, -1, 1.4142]];
    let found = false, iter = 0;
    while (heap.length && iter++ < 30000) {
      const [, k] = pop(); if (closed[k] === 1 && seen[k] === stamp) continue; closed[k] = 1;
      if (k === goal) { found = true; break; }
      const ci = k % NC, cj = (k / NC) | 0;
      for (const [di, dj, c] of DIRS) {
        const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= NC || nj >= NR) continue; const nk = nj * NC + ni; if (blocked[nk]) continue;
        if (di !== 0 && dj !== 0 && (blocked[cj * NC + ni] || blocked[nj * NC + ci])) continue;
        const g = gScore[k] + c;
        if (seen[nk] !== stamp || g < gScore[nk]) { seen[nk] = stamp; closed[nk] = 0; gScore[nk] = g; came[nk] = k; push(nk, g + Math.hypot(ni - ti, nj - tj)); }
      }
    }
    if (!found) return null;
    const raw = []; for (let k = goal; k !== -1; k = came[k]) raw.push({ x: ((k % NC) + 0.5) * NAV, z: (((k / NC) | 0) + 0.5) * NAV }); raw.reverse();
    const out = []; let a = 0;
    while (a < raw.length - 1) { let b = raw.length - 1; while (b > a + 1 && !walkLine(raw[a].x, raw[a].z, raw[b].x, raw[b].z)) b--; out.push(raw[b]); a = b; }
    return out;
  }

  return {
    def, CELL, COLS, ROWS, W, D, WALL_H, solid, zoneIdx, roof, boxes, ZONES, SITES, isSolidCell, zoneAt, isRoofed,
    collide, groundAt, raycast, hasLineOfSight, findPath, nearbyBoxes, floorAt,
    isBlocked: (x, z) => blocked[navIdx(x, z)] === 1,
  };
}
