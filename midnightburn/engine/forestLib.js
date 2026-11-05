// Midnight Burn: real forests (Upgrade 87).
// A dense pine forest scene (cut out of the artist's dirt-road scene: trees, bushes, grass, fallen leaves) is laid over the hill country (Sanjay Gandhi forest, the ghats and so on).
// Every piece remembers its height ABOVE the artist's own ground, so it rides on this game's terrain instead of floating. Cells close to a road are left out, so roads stay clear.
// Credits: app/credits.
import * as THREE from "three";
import { HILLS } from "./open/geo";

const BASE = "/midnightburn/forest/";
export const FOREST = { ready: false, failed: false, man: null, bin: null, materials: [], env: null, promise: null };

export function preloadForest() {
  if (FOREST.promise) return FOREST.promise;
  const tl = new THREE.TextureLoader();
  const tex = (u) => new Promise((res) => { const t = tl.load(u, () => res(t), undefined, () => res(null)); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.RepeatWrapping; });
  FOREST.promise = Promise.all([fetch(BASE + "forest.json").then((r) => r.json()), fetch(BASE + "forest.bin").then((r) => r.arrayBuffer())]).then(async ([man, bin]) => {
    const mats = [];
    for (const m of man.materials) {
      const map = m.map ? await tex(BASE + m.map) : null;
      mats.push(new THREE.MeshStandardMaterial({ map, vertexColors: true, roughness: 0.92, metalness: 0, side: THREE.DoubleSide, alphaTest: m.alpha ? 0.45 : 0, envMap: FOREST.env, envMapIntensity: 0.35 }));
    }
    FOREST.man = man; FOREST.bin = bin; FOREST.materials = mats;
    // views onto the binary file, made once
    for (const c of man.cells) { c.P = new Float32Array(bin, c.p, c.nv * 3); c.N = new Int8Array(bin, c.n, c.nv * 3); c.U = new Float32Array(bin, c.u, c.nv * 2); c.I = new Uint16Array(bin, c.i, c.ni); }
    FOREST.ready = mats.length > 0;
    return FOREST;
  }).catch((e) => { console.warn("forest failed to load", e); FOREST.failed = true; return FOREST; });
  return FOREST.promise;
}

// where forest grows: round the high hills
const ZONES = HILLS.filter((h) => h.h >= 60).map((h) => ({ x: h.x, z: h.z, r: h.r * 0.85 }));
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function density(x, z) { let d = 0; for (const k of ZONES) { const q = Math.hypot(x - k.x, z - k.z) / k.r; if (q < 1) d = Math.max(d, 1 - sstep(0.45, 1, q)); } return d; }
export function chunkHasForest(x0, z0, size) { const cx = x0 + size / 2, cz = z0 + size / 2, rad = size * 0.8 + 40; for (const k of ZONES) if (Math.hypot(cx - k.x, cz - k.z) < k.r + rad) return true; return false; }
const h32 = (a, b, s) => { let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + s, 0xc2b2ae35); h ^= h >>> 13; h = Math.imul(h, 0x27d4eb2f); h ^= h >>> 15; return (h >>> 0) / 4294967296; };

// add every forest piece that lies inside the chunk [x0,x0+size) x [z0,z0+size) to the builders (one per material). Returns how many cells went in.
export function addForestToChunk(builders, x0, z0, size, city, thin = 1) {
  if (!FOREST.ready || !chunkHasForest(x0, z0, size)) return 0;
  const T = FOREST.man.tile, CELL = FOREST.man.cell, ncell = T / CELL, half = T / 2; let added = 0;
  const decided = new Map();
  for (let ti = Math.floor((x0 - T) / T); ti <= Math.floor((x0 + size) / T); ti++) for (let tj = Math.floor((z0 - T) / T); tj <= Math.floor((z0 + size) / T); tj++) {
    const ox = ti * T, oz = tj * T; const rot = Math.floor(h32(ti, tj, 7) * 4), mir = h32(ti, tj, 9) < 0.5;
    const cs = Math.cos(rot * Math.PI / 2), sn = Math.sin(rot * Math.PI / 2);
    for (const c of FOREST.man.cells) {
      // cell centre in world
      let lx = (c.cx + 0.5) * CELL, lz = (c.cz + 0.5) * CELL; if (mir) lx = T - lx; const dx = lx - half, dz = lz - half; const wcx = ox + half + dx * cs - dz * sn, wcz = oz + half + dx * sn + dz * cs;
      if (wcx < x0 || wcx >= x0 + size || wcz < z0 || wcz >= z0 + size) continue;
      const key = ti * 1e6 + tj * 100 + c.cx * 10 + c.cz; let ok = decided.get(key);
      if (ok === undefined) {
        ok = false; const d = density(wcx, wcz);
        if (d > 0 && h32(Math.floor(wcx / CELL), Math.floor(wcz / CELL), 3) < d * 1.15 * thin && city.groundH(wcx, wcz) > 2.0) { ok = !city.nearestRoad(wcx, wcz, CELL * 0.9 + 6); }
        decided.set(key, ok);
      }
      if (!ok) continue;
      const gb = builders[c.m]; if (!gb) continue;
      // the game's ground on a 5 x 5 grid over this cell, interpolated for every vertex
      const gcell = new Float32Array(25); const cx0 = c.cx * CELL, cz0 = c.cz * CELL;
      for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) { let px = cx0 + a * CELL / 4, pz = cz0 + b * CELL / 4; if (mir) px = T - px; const ddx = px - half, ddz = pz - half; gcell[a * 5 + b] = city.groundH(ox + half + ddx * cs - ddz * sn, oz + half + ddx * sn + ddz * cs); }
      const tint = 0.82 + 0.3 * h32(Math.floor(wcx / 64), Math.floor(wcz / 64), 5), base = gb.nv;
      for (let k = 0; k < c.nv; k++) {
        let px = c.P[k * 3], pz = c.P[k * 3 + 2]; const hag = c.P[k * 3 + 1];
        const fa = Math.min(3.999, Math.max(0, (px - cx0) / (CELL / 4))), fb = Math.min(3.999, Math.max(0, (pz - cz0) / (CELL / 4))), ia = Math.floor(fa), ib = Math.floor(fb), ta = fa - ia, tb = fb - ib;
        const gy = (gcell[ia * 5 + ib] * (1 - ta) + gcell[(ia + 1) * 5 + ib] * ta) * (1 - tb) + (gcell[ia * 5 + ib + 1] * (1 - ta) + gcell[(ia + 1) * 5 + ib + 1] * ta) * tb;
        let nx = c.N[k * 3] / 127, nz = c.N[k * 3 + 2] / 127; if (mir) { px = T - px; nx = -nx; }
        const ddx = px - half, ddz = pz - half;
        gb.v(ox + half + ddx * cs - ddz * sn, gy + hag, oz + half + ddx * sn + ddz * cs, nx * cs - nz * sn, c.N[k * 3 + 1] / 127, nx * sn + nz * cs, tint, tint, tint, c.U[k * 2], c.U[k * 2 + 1]);
      }
      if (gb.ni + c.ni > gb.icap) gb.growI(gb.ni + c.ni); const out = gb.i; let o = gb.ni; for (let k = 0; k < c.ni; k++) out[o++] = base + c.I[k]; gb.ni = o;
      added++;
    }
  }
  return added;
}
