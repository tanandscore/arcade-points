// "Foundry Yard" — the flagship Operation Blacksite map.
// A night-time industrial compound with two bomb sites, a long west lane, a mid corridor,
// a dark tunnel route and two rotation links. Everything is built from the same boxes the
// game collides with, shoots through and navigates around, so what you see is what you hit.
//
// Units are metres. One grid cell is CELL metres. x runs west->east, z runs north->south.

export const CELL = 2.5;
export const COLS = 56;
export const ROWS = 46;
export const WALL_H = 6.4;
export const STEP_H = 0.62; // the tallest ledge a player walks up without jumping

// Named areas. rect = [x0, z0, x1, z1] in cells (inclusive). Later entries overwrite earlier ones
// where they overlap, which is also how callout names are picked.
export const ZONES = [
  { id: "ct", name: "CT Spawn", rect: [22, 2, 33, 8], floor: "concrete", lamp: 0x9fd0ff },
  { id: "a", name: "A Site", rect: [4, 2, 17, 12], floor: "tiles", lamp: 0xffb04a },
  { id: "b", name: "B Site", rect: [38, 2, 51, 12], floor: "tiles", lamp: 0x6fe0b4 },
  { id: "actc", name: "CT Link A", rect: [17, 4, 21, 7], floor: "concrete", roof: true, lamp: 0x9fd0ff },
  { id: "bctc", name: "CT Link B", rect: [34, 4, 38, 7], floor: "concrete", roof: true, lamp: 0x9fd0ff },
  { id: "mid", name: "Mid", rect: [25, 9, 30, 29], floor: "asphalt", lamp: 0xffd08a },
  { id: "midl", name: "Mid Nook West", rect: [21, 12, 24, 15], floor: "asphalt", lamp: 0xffd08a },
  { id: "midr", name: "Mid Nook East", rect: [31, 12, 34, 15], floor: "asphalt", lamp: 0xffd08a },
  { id: "plaza", name: "Mid Plaza", rect: [20, 26, 35, 33], floor: "asphalt", lamp: 0xffd08a },
  { id: "along", name: "A Long", rect: [4, 13, 9, 33], floor: "asphalt", lamp: 0xffa040 },
  { id: "hall", name: "A Hall", rect: [13, 12, 17, 21], floor: "concrete", roof: true, lamp: 0xffb04a },
  { id: "short", name: "Short", rect: [10, 18, 24, 21], floor: "grate", roof: true, lamp: 0xff6a4a },
  { id: "shortb", name: "Short B", rect: [31, 22, 39, 25], floor: "grate", roof: true, lamp: 0xff6a4a },
  { id: "tun", name: "Tunnels", rect: [40, 13, 43, 33], floor: "grate", roof: true, lamp: 0x6fe0b4 },
  { id: "alley", name: "B Alley", rect: [47, 13, 51, 33], floor: "asphalt", lamp: 0x6fe0b4 },
  { id: "bwin", name: "B Window", rect: [44, 26, 46, 28], floor: "concrete", roof: true, lamp: 0x6fe0b4 },
  { id: "wyard", name: "West Yard", rect: [4, 34, 14, 43], floor: "asphalt", lamp: 0xffa040 },
  { id: "eyard", name: "East Yard", rect: [41, 34, 51, 43], floor: "asphalt", lamp: 0x6fe0b4 },
  { id: "tdw", name: "West Gate", rect: [15, 38, 19, 41], floor: "concrete", roof: true, lamp: 0xff6a4a },
  { id: "tde", name: "East Gate", rect: [36, 38, 40, 41], floor: "concrete", roof: true, lamp: 0xff6a4a },
  { id: "tlink", name: "Plaza Ramp", rect: [25, 34, 30, 36], floor: "concrete", roof: true, lamp: 0xff6a4a },
  { id: "t", name: "T Spawn", rect: [20, 37, 35, 43], floor: "concrete", lamp: 0xff7a4a },
];

export const SITES = {
  A: { id: "A", cx: 10.5 * CELL, cz: 7.2 * CELL, r: 10.5, color: 0xffb04a },
  B: { id: "B", cx: 45.5 * CELL, cz: 9.6 * CELL, r: 10.5, color: 0x6fe0b4 },
};

const cellC = (i) => (i + 0.5) * CELL;
export const TERROR_SPAWNS = [[24, 39], [26, 40], [28, 41], [30, 40], [22, 39], [27, 42], [33, 39]].map(([i, j]) => ({ x: cellC(i), z: cellC(j) }));
export const POLICE_SPAWNS = [[24, 4], [26, 3], [28, 4], [30, 3], [32, 4], [27, 6], [31, 6]].map(([i, j]) => ({ x: cellC(i), z: cellC(j) }));

// Props: R(kind, x0, z0, x1, z1, height, opts) — rectangles given in cell-edge coordinates.
const PROPS_DEF = [];
const R = (kind, x0, z0, x1, z1, h, o = {}) => PROPS_DEF.push({ kind, x0: x0 * CELL, z0: z0 * CELL, x1: x1 * CELL, z1: z1 * CELL, h, y0: o.y0 || 0, color: o.color ?? 0, label: o.label || null });

// ---- A site --------------------------------------------------------------------------------
R("container", 5, 2, 7.6, 3, 2.7, { color: 2 }); R("container", 9, 2, 11.6, 3, 2.7, { color: 0 });
R("gen", 14, 2.2, 16.6, 4, 2.2);
R("crate", 7, 7, 8, 8, 2.6); R("crate", 8, 7, 9, 8, 1.3); R("crate", 7, 8, 8, 9, 1.3);
R("barrel", 13, 9, 13.5, 9.5, 1.1); R("barrel", 13.6, 9.2, 14.1, 9.7, 1.1); R("barrel", 13.2, 9.8, 13.7, 10.3, 1.1);
R("pillar", 11, 9, 12, 10, WALL_H);
R("barrier", 4, 9.6, 7, 10.2, 1.1);
R("crate", 5, 11, 6.2, 12, 1.3);
// ---- links ---------------------------------------------------------------------------------------
R("crate", 19, 4, 20, 5, 1.3); R("crate", 35.2, 6, 36.2, 7, 1.3);
// ---- A long --------------------------------------------------------------------------------------
R("crate", 4, 16, 6, 18, 1.4); R("barrier", 7, 19, 10, 19.6, 1.1);
R("container", 4, 23, 5, 25.6, 2.7, { color: 4 }); R("crate", 8, 26, 9.7, 27.7, 2.6);
R("barrel", 5.5, 30.5, 6, 31, 1.1); R("barrel", 6.1, 30.8, 6.6, 31.3, 1.1);
R("pillar", 6.5, 13.5, 7.5, 14.5, WALL_H);
// ---- hall + short --------------------------------------------------------------------------------------
R("crate", 13, 15, 14.5, 16.5, 1.4); R("pillar", 15, 18, 16, 19, WALL_H);
R("pillar", 17.5, 19.2, 18.5, 20.2, WALL_H); R("crate", 20, 18, 21, 19, 1.3); R("crate", 12, 20, 13, 21, 1.3);
R("barrel", 22.2, 20.2, 22.7, 20.7, 1.1);
// ---- mid -----------------------------------------------------------------------------------------------------
R("container", 27.5, 14, 28.5, 16.6, 2.7, { color: 1 });
R("crate", 25, 20, 26.2, 21.2, 1.3); R("crate", 29.8, 24, 31, 25.2, 1.3);
R("barrier", 26, 26, 28, 26.6, 1.1); R("barrier", 28.4, 11.6, 30.4, 12.2, 1.1);
R("crate", 21, 13, 22.2, 14.2, 1.3); R("crate", 32.8, 12, 34, 13.2, 1.3);
// ---- plaza + lobby ---------------------------------------------------------------------------------
R("container", 21, 28, 23.6, 29, 2.7, { color: 3 }); R("container", 32, 30, 34.6, 31, 2.7, { color: 5 });
R("pillar", 24.5, 30, 25.5, 31, WALL_H); R("pillar", 29.5, 30, 30.5, 31, WALL_H);
R("truck", 20.5, 41.2, 24.8, 43, 2.9); R("crate", 32, 41, 33.4, 42.4, 1.4); R("crate", 33.4, 41.8, 34.6, 43, 1.3);
R("barrier", 27, 37.4, 30, 38, 1.1);
// ---- west + east yards -------------------------------------------------------------------------------
R("container", 5, 36, 7.6, 37, 2.7, { color: 4 }); R("container", 5, 36, 7.6, 37, 2.7, { color: 2, y0: 2.7 });
R("crate", 11, 37, 12.4, 38.4, 1.4); R("barrel", 8, 41, 8.5, 41.5, 1.1); R("barrel", 8.6, 41.2, 9.1, 41.7, 1.1);
R("barrier", 10, 34.6, 13, 35.2, 1.1);
R("container", 48.4, 36, 51, 37, 2.7, { color: 1 }); R("crate", 43, 38, 44.4, 39.4, 1.4); R("barrier", 45, 41, 48, 41.6, 1.1);
R("barrel", 49.4, 41.4, 49.9, 41.9, 1.1);
// ---- tunnels + alley -------------------------------------------------------------------------------------------
R("pillar", 41.5, 18, 42.5, 19, WALL_H); R("pillar", 41.5, 28, 42.5, 29, WALL_H);
R("crate", 40, 23, 41.3, 24.3, 1.3); R("crate", 42.8, 30, 44, 31, 1.3);
R("crate", 49, 20, 51, 22, 1.4); R("barrier", 47, 24.4, 49.6, 25, 1.1); R("barrel", 50.2, 30.2, 50.7, 30.7, 1.1); R("barrel", 49.5, 15, 50, 15.5, 1.1);
R("container", 47.5, 16.5, 48.5, 19.1, 2.7, { color: 0 });
// ---- B site ----------------------------------------------------------------------------------------------------------------
R("container", 47.6, 2, 50.2, 3, 2.7, { color: 5 }); R("container", 39, 2, 41.6, 3, 2.7, { color: 4 });
R("block", 43, 6, 45.6, 8.6, 2.2); R("crate", 45.6, 6, 46.6, 7, 1.3); R("crate", 42, 8.6, 43, 9.6, 1.3);
R("pillar", 48, 9, 49, 10, WALL_H);
R("barrier", 40, 10.4, 43, 11, 1.1); R("barrel", 38.8, 5, 39.3, 5.5, 1.1);

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
  const buckets = new Map();
  boxes.forEach((b) => {
    const i0 = Math.floor(b.x0 / CELL), i1 = Math.floor((b.x1 - 1e-6) / CELL), j0 = Math.floor(b.z0 / CELL), j1 = Math.floor((b.z1 - 1e-6) / CELL);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * COLS + i; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(b); }
  });

  const inGrid = (i, j) => i >= 0 && j >= 0 && i < COLS && j < ROWS;
  const isSolidCell = (i, j) => !inGrid(i, j) || solid[j * COLS + i] === 1;
  const W = COLS * CELL, D = ROWS * CELL;

  const zoneAt = (x, z) => { const i = Math.floor(x / CELL), j = Math.floor(z / CELL); if (!inGrid(i, j)) return null; const zi = zoneIdx[j * COLS + i]; return zi < 0 ? null : ZONES[zi]; };
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
    CELL, COLS, ROWS, W, D, WALL_H, solid, zoneIdx, roof, boxes, ZONES, SITES, isSolidCell, zoneAt, isRoofed,
    collide, groundAt, raycast, hasLineOfSight, findPath, nearbyBoxes,
    isBlocked: (x, z) => blocked[navIdx(x, z)] === 1,
  };
}
