// Builds the battlefield: grass and hills, lakes, groves, gold and stone, and two fair starting
// areas that mirror each other. Same seed = same map.
import { N, NODE } from "./defs.js";

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash2(x, y, s) { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi; const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, s) => vnoise(x, y, s) * 0.55 + vnoise(x * 2.1, y * 2.1, s + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, s + 13) * 0.15;

export const T_GRASS = 0, T_DIRT = 1, T_SAND = 2, T_WATER = 3, T_ROCK = 4;

export function generateMap(seed = 1) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const m = tryGenerate(seed + attempt * 977);
    if (m) { m.seed = seed + attempt * 977; return m; }
  }
  return tryGenerate(seed, true);
}

function tryGenerate(seed, force = false) {
  const rnd = mulberry(seed);
  const terrain = new Uint8Array(N * N);               // T_*
  const blockedBase = new Uint8Array(N * N);           // water & mountains
  const nodes = [];                                    // {kind, ix, iz, amount}
  const used = new Uint8Array(N * N);                  // tiles taken by nodes or reserved
  const idx = (x, z) => z * N + x;
  const inb = (x, z) => x >= 0 && z >= 0 && x < N && z < N;

  const starts = [{ cx: 22, cz: N - 23 }, { cx: N - 23, cz: 22 }];
  const mirror = (x, z) => [N - 1 - x, N - 1 - z];

  // ---- height: gentle hills, flat around bases, tall mountains around the rim --------------
  const H1 = (x, z) => fbm(x * 0.05, z * 0.05, seed) * 2.4 - 0.9;
  const hv = new Float32Array((N + 1) * (N + 1));
  for (let z = 0; z <= N; z++) for (let x = 0; x <= N; x++) {
    let h = (H1(x, z) + H1(N - x, N - z)) / 2;
    for (const s of starts) { const d = Math.hypot(x - s.cx, z - s.cz); h = h * Math.min(1, Math.max(0, (d - 11) / 10)); }
    const edge = Math.min(x, z, N - x, N - z);
    if (edge < 8) h += (8 - edge) * (0.35 + 0.5 * vnoise(x * 0.3, z * 0.3, seed + 3)) * (edge < 3 ? 1.8 : 1);
    hv[z * (N + 1) + x] = h;
  }

  // ---- lakes (symmetrical) -----------------------------------------------------------------------
  const lakes = [];
  lakes.push({ x: N / 2, z: N / 2, rx: 8 + rnd() * 4, rz: 5 + rnd() * 3, rot: rnd() * Math.PI });
  const lx = 22 + rnd() * 8, lz = 28 + rnd() * 10; lakes.push({ x: lx, z: lz, rx: 5 + rnd() * 3, rz: 4 + rnd() * 2, rot: rnd() * 3 });
  lakes.push({ x: N - 1 - lx, z: N - 1 - lz, rx: lakes[1].rx, rz: lakes[1].rz, rot: lakes[1].rot });
  const inLake = (x, z, grow = 0) => lakes.some((l) => {
    const dx = x + 0.5 - l.x, dz = z + 0.5 - l.z, c = Math.cos(l.rot), s = Math.sin(l.rot); const u = (dx * c + dz * s) / (l.rx + grow), v = (-dx * s + dz * c) / (l.rz + grow);
    const wob = 1 + (vnoise(x * 0.25, z * 0.25, seed + 31) - 0.5) * 0.5; return u * u + v * v < wob;
  });

  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const edge = Math.min(x, z, N - 1 - x, N - 1 - z);
    let t = T_GRASS;
    if (edge < 3) { t = T_ROCK; blockedBase[idx(x, z)] = 1; }
    else if (inLake(x, z)) { t = T_WATER; blockedBase[idx(x, z)] = 1; }
    else if (inLake(x, z, 1.6)) t = T_SAND;
    else if (vnoise(x * 0.11, z * 0.11, seed + 5) > 0.7) t = T_DIRT;
    terrain[idx(x, z)] = t;
  }
  // sink lakes
  for (let z = 0; z <= N; z++) for (let x = 0; x <= N; x++) {
    const near = [[x - 1, z - 1], [x, z - 1], [x - 1, z], [x, z]].filter(([a, b]) => inb(a, b) && terrain[idx(a, b)] === T_WATER).length;
    if (near > 0) hv[z * (N + 1) + x] = -0.55 - near * 0.1; else if (near === 0) { /* leave */ }
  }
  // dirt patches around bases
  for (const s of starts) for (let z = s.cz - 8; z <= s.cz + 8; z++) for (let x = s.cx - 8; x <= s.cx + 8; x++) {
    if (!inb(x, z) || terrain[idx(x, z)] !== T_GRASS) continue; const d = Math.hypot(x - s.cx, z - s.cz);
    if (d < 5.5 || (d < 8 && vnoise(x * 0.4, z * 0.4, seed + 9) > 0.55)) terrain[idx(x, z)] = T_DIRT;
  }

  const freeRect = (x, z, w) => { for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) { if (!inb(x + i, z + j) || blockedBase[idx(x + i, z + j)] || used[idx(x + i, z + j)]) return false; } return true; };
  const take = (x, z, w) => { for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) used[idx(x + i, z + j)] = 1; };
  const reserveBase = (s) => { for (let z = s.cz - 6; z <= s.cz + 6; z++) for (let x = s.cx - 6; x <= s.cx + 6; x++) if (inb(x, z)) used[idx(x, z)] = 1; };
  starts.forEach(reserveBase);

  const addNode = (kind, x, z) => {
    const w = NODE[kind].size; if (!freeRect(x, z, w)) return false; take(x, z, w);
    nodes.push({ kind, ix: x, iz: z, amount: NODE[kind].amount }); return true;
  };
  const addBoth = (kind, x, z) => { // symmetrical placement
    const w = NODE[kind].size; const [mx, mz] = mirror(x + w - 1, z + w - 1);
    if (!freeRect(x, z, w) || !freeRect(mx, mz, w)) return false; addNode(kind, x, z); addNode(kind, mx, mz); return true;
  };

  // ---- each base: gold, stone, berries, two groves ---------------------------------------------
  const a0 = -0.6 + rnd() * 0.3;
  const place = (kind, ang, dist, w) => { const x = Math.round(starts[0].cx + Math.cos(ang) * dist - w / 2), z = Math.round(starts[0].cz + Math.sin(ang) * dist - w / 2); return addBoth(kind, x, z); };
  place("gold", a0 - 0.2, 10.5, 2) || place("gold", a0 - 0.5, 11, 2);
  place("stone", a0 - 1.6, 11.5, 2) || place("stone", a0 - 1.9, 12, 2);
  // berries: a tight cluster of 6
  { const ang = a0 + 1.2 + rnd() * 0.3, dist = 9; const bx = Math.round(starts[0].cx + Math.cos(ang) * dist), bz = Math.round(starts[0].cz + Math.sin(ang) * dist); let n = 0;
    for (let j = -1; j <= 1 && n < 6; j++) for (let i = -1; i <= 1 && n < 6; i++) { if ((i + j) % 2 === 0 || n < 4) if (addBoth("berries", bx + i, bz + j)) n++; } }
  const grove = (cx, cz, r, density, both = true) => {
    for (let z = Math.floor(cz - r); z <= cz + r; z++) for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      const d = Math.hypot(x - cx, z - cz); if (d > r) continue; const p = density * (1 - (d / r) ** 2) * (0.55 + vnoise(x * 0.5, z * 0.5, seed + 17));
      if (rnd() < p) { if (both) addBoth("tree", x, z); else addNode("tree", x, z); }
    }
  };
  grove(starts[0].cx + 12 + rnd() * 3, starts[0].cz - 14 - rnd() * 3, 5.5, 0.85);
  grove(starts[0].cx - 3 + rnd() * 4, starts[0].cz - 18, 5, 0.8);
  grove(starts[0].cx + 17, starts[0].cz + 1, 4.5, 0.8);
  grove(starts[0].cx - 14, starts[0].cz - 7, 4, 0.75);

  // ---- the wider map: groves, extra mines, rock ridges ---------------------------------------
  for (let g = 0; g < 14; g++) { const cx = 10 + rnd() * (N - 20), cz = 10 + rnd() * (N / 2); if (Math.hypot(cx - starts[0].cx, cz - starts[0].cz) < 18 || inLake(Math.floor(cx), Math.floor(cz), 2)) continue; grove(cx, cz, 3.5 + rnd() * 4, 0.7); }
  for (let g = 0; g < 4; g++) {
    const x = 18 + Math.floor(rnd() * (N - 40)), z = 18 + Math.floor(rnd() * (N / 2 - 14));
    if (Math.hypot(x - starts[0].cx, z - starts[0].cz) < 20) continue;
    addBoth(g % 2 ? "stone" : "gold", x, z);
  }
  // a couple of ridges (rocky hills that block movement but leave gaps)
  for (let r = 0; r < 3; r++) {
    const cx = 25 + rnd() * (N - 50), cz = 25 + rnd() * (N / 2 - 15), ang = rnd() * Math.PI, len = 10 + rnd() * 8;
    if (Math.hypot(cx - starts[0].cx, cz - starts[0].cz) < 24 || Math.hypot(cx - N / 2, cz - N / 2) < 14) continue;
    for (let s = -len / 2; s <= len / 2; s += 1) {
      if (Math.abs(s) < 2.2 + rnd() * 1.5 && rnd() < 0.7) continue; // gap
      for (const [px, pz] of [[cx + Math.cos(ang) * s, cz + Math.sin(ang) * s], [N - 1 - (cx + Math.cos(ang) * s), N - 1 - (cz + Math.sin(ang) * s)]]) {
        const x = Math.round(px), z = Math.round(pz); if (!inb(x, z) || used[idx(x, z)] || blockedBase[idx(x, z)]) continue;
        terrain[idx(x, z)] = T_ROCK; blockedBase[idx(x, z)] = 1; used[idx(x, z)] = 1;
        for (const [a, b] of [[x, z], [x + 1, z], [x, z + 1], [x + 1, z + 1]]) hv[b * (N + 1) + a] = Math.max(hv[b * (N + 1) + a], 1.6 + rnd() * 0.8);
      }
    }
  }

  // ---- Upgrade 26: shrines, monster dens and relics, always in mirrored pairs so both sides get the same chances ------------------------------------
  const pois = [];
  const nearStart = (x, z) => Math.min(Math.hypot(x - starts[0].cx, z - starts[0].cz), Math.hypot(x - starts[1].cx, z - starts[1].cz));
  const farFromPois = (x, z, d) => pois.every((p) => Math.hypot(p.ix - x, p.iz - z) >= d);
  const roomAround = (x, z, w) => { for (let j = -2; j < w + 2; j++) for (let i = -2; i < w + 2; i++) { if (!inb(x + i, z + j) || blockedBase[idx(x + i, z + j)]) return false; } return true; };
  const addPair = (type, kind, w, dmin, dmax, extra = {}, tries = 900) => {
    for (let t = 0; t < tries; t++) {
      const x = 12 + Math.floor(rnd() * (N - 24)), z = 12 + Math.floor(rnd() * (N / 2 - 6)); // the first half; the second half is its mirror
      const nd = nearStart(x + w / 2, z + w / 2); if (nd < dmin || nd > dmax) continue;
      const [mx, mz] = mirror(x + w - 1, z + w - 1);
      if (Math.hypot(mx - x, mz - z) < 14) continue; // not on the middle line
      if (!freeRect(x, z, w) || !freeRect(mx, mz, w) || !roomAround(x, z, w) || !roomAround(mx, mz, w)) continue;
      if (!farFromPois(x, z, 17) || !farFromPois(mx, mz, 17)) continue;
      take(x, z, w); take(mx, mz, w);
      pois.push({ type, kind, ix: x, iz: z, w, ...extra }, { type, kind, ix: mx, iz: mz, w, ...extra });
      return true;
    }
    return false;
  };
  addPair("lair", "cyclops", 3, 40, 66, { relicSlot: 0 });
  addPair("lair", "satyrs", 3, 26, 46, { relicSlot: 1 });
  addPair("lair", "wolves", 3, 20, 34); addPair("lair", "wolves", 3, 24, 40);
  addPair("shrine", "oracle", 2, 28, 56); addPair("shrine", "oracle", 2, 34, 62);
  // the four relics: the two relic dens of each pair hold different relics (one nearer you, one nearer the enemy)
  { const order = ["spear", "aegis", "fleece", "nectar"]; const slots = [0, 1]; let k = 0;
    for (const sl of slots) { const ls = pois.filter((p) => p.type === "lair" && p.relicSlot === sl); const flip = rnd() < 0.5; ls.forEach((p, i) => { p.relic = order[sl * 2 + ((i + (flip ? 1 : 0)) % 2)]; k++; }); } }

  // ---- make sure the two armies can actually reach each other ---------------------------------
  const occ = new Uint8Array(N * N); // 1 = blocked
  for (let i = 0; i < N * N; i++) occ[i] = blockedBase[i];
  for (const n of nodes) { const w = NODE[n.kind].size; for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) occ[idx(n.ix + i, n.iz + j)] = 1; }
  for (const q of pois) for (let j = 0; j < q.w; j++) for (let i = 0; i < q.w; i++) occ[idx(q.ix + i, q.iz + j)] = 1;
  const reach = (sx, sz, tx, tz) => {
    const seen = new Uint8Array(N * N), q = [idx(sx, sz)]; seen[q[0]] = 1;
    for (let h = 0; h < q.length; h++) { const c = q[h], x = c % N, z = (c / N) | 0; if (Math.abs(x - tx) <= 2 && Math.abs(z - tz) <= 2) return true;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (inb(nx, nz) && !seen[idx(nx, nz)] && !occ[idx(nx, nz)]) { seen[idx(nx, nz)] = 1; q.push(idx(nx, nz)); } } }
    return false;
  };
  let ok = reach(starts[0].cx + 4, starts[0].cz, starts[1].cx, starts[1].cz);
  if (!ok) {
    if (!force) return null;
    // carve a corridor of trees along the diagonal
    for (let t = 0; t < 1; t += 0.004) { const x = Math.round(starts[0].cx + (starts[1].cx - starts[0].cx) * t), z = Math.round(starts[0].cz + (starts[1].cz - starts[0].cz) * t); for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (inb(x + i, z + j)) { occ[idx(x + i, z + j)] = 0; blockedBase[idx(x + i, z + j)] = 0; if (terrain[idx(x + i, z + j)] === T_WATER || terrain[idx(x + i, z + j)] === T_ROCK) terrain[idx(x + i, z + j)] = T_GRASS; } }
    for (let k = nodes.length - 1; k >= 0; k--) if (occ[idx(nodes[k].ix, nodes[k].iz)] === 0) nodes.splice(k, 1);
  }
  // every start must have its own gold and stone close by
  for (const s of starts) {
    for (const kind of ["gold", "stone", "berries"]) if (!nodes.some((n) => n.kind === kind && Math.hypot(n.ix - s.cx, n.iz - s.cz) < 16)) { if (!force) return null; }
  }

  return { N, terrain, blockedBase, height: hv, nodes, pois, starts: starts.map((s) => ({ ...s })), lakes };
}
