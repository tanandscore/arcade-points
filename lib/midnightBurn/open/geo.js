// Midnight Burn — the city's shape: sea, creek, hills and districts.
// A stylised, compressed "Mumbai – Thane – Navi Mumbai": the island city on the west with its
// sea-facing coast, Thane Creek running north-south, Navi Mumbai's planned grid on the east bank,
// the harbour and port to the south, and the Sahyadri hills on the far east edge.
// Units are metres. x runs east, z runs south (north is the top of the map).

export const W = 6400;
export const CELL = 20;
export const G = W / CELL;
const K = 1000;

export function mulberry(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash2 = (x, z, s = 0) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; };
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function vnoise(x, z, s = 0) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const a = hash2(ix, iz, s), b = hash2(ix + 1, iz, s), c = hash2(ix, iz + 1, s), d = hash2(ix + 1, iz + 1, s);
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export const fbm = (x, z, s = 0) => vnoise(x, z, s) * 0.55 + vnoise(x * 2.1, z * 2.1, s + 5) * 0.28 + vnoise(x * 4.3, z * 4.3, s + 9) * 0.17;

function pip(poly, x, z) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
const P = (pts) => pts.map(([x, z]) => [x * K, z * K]);

// ---- coastline (km) --------------------------------------------------------------------------
// The island city and Thane (west of the creek)
const WEST_LAND = P([
  [0.55, -0.3], [0.62, 0.8], [0.78, 1.5], [0.95, 2.1], [1.1, 2.6], [1.18, 2.85],
  [1.5, 3.05], [1.88, 3.3], [1.9, 3.7], [1.72, 4.0], [1.42, 4.3],
  [1.52, 4.62], [1.68, 4.8], [1.55, 5.2], [1.5, 5.55], [1.6, 6.05], [1.75, 6.25], [1.98, 6.08],
  [2.1, 5.6], [2.35, 5.0], [2.55, 4.4], [2.68, 3.8], [2.82, 3.1], [3.0, 2.4], [3.12, 1.8], [3.22, 1.2], [3.38, 0.6], [3.42, -0.3],
]);
// Navi Mumbai and everything east of the creek, up to the hills
const EAST_LAND = P([
  [3.98, -0.3], [3.93, 0.6], [3.78, 1.3], [3.7, 2.0], [3.62, 2.7], [3.6, 3.4], [3.66, 4.1], [3.86, 4.7], [4.2, 5.15], [4.7, 5.5], [5.3, 5.8], [5.9, 6.1], [6.5, 6.5],
  [6.5, -0.3],
]);
// Uran / the port peninsula in the south (joined to the mainland by the harbour bridge)
const PORT_LAND = P([[3.5, 5.95], [4.2, 5.7], [4.85, 5.8], [4.95, 6.5], [3.4, 6.5], [3.35, 6.15]]);
// lakes (km centre + radii)
export const LAKES = [
  { id: "upvan", name: "Upvan Lake", x: 3.0 * K, z: 0.72 * K, rx: 190, rz: 140, rot: 0.4 },
  { id: "powai", name: "Powai Lake", x: 2.55 * K, z: 2.3 * K, rx: 230, rz: 150, rot: -0.6 },
  { id: "vihar", name: "Vihar Lake", x: 2.1 * K, z: 1.25 * K, rx: 210, rz: 160, rot: 0.9 },
  { id: "kharghar", name: "Kharghar Wetlands", x: 4.95 * K, z: 4.55 * K, rx: 240, rz: 130, rot: 0.2 },
];

// ---- rasters: land mask and signed distance to the coast -------------------------------------------------
export const land = new Uint8Array(G * G);
for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
  const x = (i + 0.5) * CELL, z = (j + 0.5) * CELL;
  let l = pip(WEST_LAND, x, z) || pip(EAST_LAND, x, z) || pip(PORT_LAND, x, z);
  if (l) for (const k of LAKES) { const dx = x - k.x, dz = z - k.z, c = Math.cos(k.rot), s = Math.sin(k.rot); const u = (dx * c + dz * s) / k.rx, v = (-dx * s + dz * c) / k.rz; if (u * u + v * v < 1 + (vnoise(x * 0.01, z * 0.01, 4) - 0.5) * 0.3) { l = false; break; } }
  land[j * G + i] = l ? 1 : 0;
}
// distance transform (two sweeps), in metres. positive on land, negative in water
export const sd = new Float32Array(G * G);
{
  const INF = 1e9, a = new Float32Array(G * G), b = new Float32Array(G * G);
  const dt = (mask, out) => {
    for (let k = 0; k < G * G; k++) out[k] = mask[k] ? INF : 0;
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) { const k = j * G + i; if (!out[k]) continue; let v = out[k]; if (i > 0) v = Math.min(v, out[k - 1] + 1); if (j > 0) v = Math.min(v, out[k - G] + 1); if (i > 0 && j > 0) v = Math.min(v, out[k - G - 1] + 1.414); if (i < G - 1 && j > 0) v = Math.min(v, out[k - G + 1] + 1.414); out[k] = v; }
    for (let j = G - 1; j >= 0; j--) for (let i = G - 1; i >= 0; i--) { const k = j * G + i; if (!out[k]) continue; let v = out[k]; if (i < G - 1) v = Math.min(v, out[k + 1] + 1); if (j < G - 1) v = Math.min(v, out[k + G] + 1); if (i < G - 1 && j < G - 1) v = Math.min(v, out[k + G + 1] + 1.414); if (i > 0 && j < G - 1) v = Math.min(v, out[k + G - 1] + 1.414); out[k] = v; }
  };
  const water = new Uint8Array(G * G); for (let k = 0; k < G * G; k++) water[k] = land[k] ? 0 : 1;
  dt(land, a); dt(water, b); // a: cells to nearest water (for land), b: cells to nearest land (for water)
  for (let k = 0; k < G * G; k++) sd[k] = land[k] ? a[k] * CELL : -b[k] * CELL;
}
function bil(arr, x, z) {
  const fx = Math.max(0, Math.min(G - 1.001, x / CELL - 0.5)), fz = Math.max(0, Math.min(G - 1.001, z / CELL - 0.5));
  const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
  return (arr[j * G + i] * (1 - u) + arr[j * G + i + 1] * u) * (1 - v) + (arr[(j + 1) * G + i] * (1 - u) + arr[(j + 1) * G + i + 1] * u) * v;
}
export const shoreDist = (x, z) => bil(sd, x, z);        // metres, > 0 on land
export const isWater = (x, z) => { if (x < 0 || z < 0 || x >= W || z >= W) return true; return !land[Math.floor(z / CELL) * G + Math.floor(x / CELL)]; };

// ---- hills ----------------------------------------------------------------------------------------------------
const HILLS = [
  { x: 1.9 * K, z: 0.8 * K, r: 750, h: 70, n: "Sanjay Gandhi forest" }, { x: 2.45 * K, z: 0.45 * K, r: 520, h: 85, n: "Yeoor hills" },
  { x: 1.45 * K, z: 4.35 * K, r: 260, h: 26, n: "Malabar Hill" }, { x: 4.3 * K, z: 4.8 * K, r: 330, h: 46, n: "Parsik hill" },
  { x: 2.75 * K, z: 2.05 * K, r: 300, h: 26, n: "Powai ridge" }, { x: 4.8 * K, z: 0.8 * K, r: 520, h: 60, n: "Kalwa ridge" },
];
export function baseH(x, z) {
  const d = shoreDist(x, z);
  if (d <= 0) return Math.max(-9, -1.5 + d * 0.06);
  let h = 1.0 + sstep(0, 90, d) * (1.1 + fbm(x * 0.004, z * 0.004, 3) * 1.6);
  for (const k of HILLS) { const dd = Math.hypot(x - k.x, z - k.z) / k.r; if (dd < 1.6) h += k.h * Math.exp(-dd * dd * 2.2) * (0.65 + 0.7 * fbm(x * 0.006, z * 0.006, 8)) * sstep(0, 160, d); }
  const east = sstep(5000, 6300, x); // Sahyadri
  if (east > 0) h += east * (30 + 130 * fbm(x * 0.0035, z * 0.0035, 12)) * sstep(0, 200, d);
  const north = sstep(500, 0, z) * 40 * fbm(x * 0.004, z * 0.004, 21) * sstep(0, 200, d); h += north;
  // world rim: low walls of hills so you never see the edge
  const edge = Math.min(x, z, W - x, W - z);
  if (edge < 240 && d > 0) h += (240 - edge) * 0.11;
  return h;
}

// ---- districts -------------------------------------------------------------------------------------------------
// style: how the buildings there look. dens 0..1 how crowded. h = [min,max] storeys' height in metres.
export const DISTRICTS = [
  { id: "colaba", name: "Colaba", x: 1.78 * K, z: 5.85 * K, r: 380, style: "old", dens: 0.95, h: [14, 36] },
  { id: "fort", name: "Fort & CST", x: 1.95 * K, z: 5.35 * K, r: 330, style: "colonial", dens: 0.9, h: [16, 42] },
  { id: "nariman", name: "Nariman Point", x: 1.62 * K, z: 5.0 * K, r: 280, style: "tower", dens: 0.9, h: [40, 110] },
  { id: "malabar", name: "Malabar Hill", x: 1.55 * K, z: 4.45 * K, r: 260, style: "upscale", dens: 0.55, h: [20, 60] },
  { id: "worli", name: "Worli", x: 1.95 * K, z: 4.0 * K, r: 360, style: "tower", dens: 0.85, h: [35, 120] },
  { id: "dadar", name: "Dadar & Dharavi", x: 2.3 * K, z: 3.55 * K, r: 420, style: "dense", dens: 1.0, h: [9, 26] },
  { id: "sewri", name: "Sewri Docks", x: 2.5 * K, z: 4.55 * K, r: 330, style: "industrial", dens: 0.6, h: [8, 20] },
  { id: "bkc", name: "Bandra Kurla Complex", x: 2.2 * K, z: 3.05 * K, r: 330, style: "glass", dens: 0.8, h: [60, 170] },
  { id: "bandra", name: "Bandra", x: 1.5 * K, z: 2.95 * K, r: 360, style: "suburb", dens: 0.7, h: [10, 32] },
  { id: "juhu", name: "Juhu & Andheri", x: 1.3 * K, z: 2.0 * K, r: 480, style: "suburb", dens: 0.65, h: [9, 30] },
  { id: "kurla", name: "Kurla & Sion", x: 2.65 * K, z: 3.7 * K, r: 360, style: "dense", dens: 0.95, h: [10, 30] },
  { id: "powai", name: "Powai", x: 2.6 * K, z: 2.3 * K, r: 360, style: "tower", dens: 0.6, h: [30, 90] },
  { id: "ghatkopar", name: "Ghatkopar & Mulund", x: 2.95 * K, z: 2.9 * K, r: 380, style: "dense", dens: 0.85, h: [12, 38] },
  { id: "thane", name: "Thane", x: 3.05 * K, z: 1.25 * K, r: 520, style: "mixed", dens: 0.75, h: [12, 60] },
  { id: "sgnp", name: "Sanjay Gandhi National Park", x: 1.9 * K, z: 0.8 * K, r: 720, style: "forest", dens: 0.05, h: [6, 12] },
  { id: "yeoor", name: "Yeoor Hills", x: 2.45 * K, z: 0.45 * K, r: 480, style: "forest", dens: 0.05, h: [6, 10] },
  { id: "airoli", name: "Airoli", x: 3.98 * K, z: 1.45 * K, r: 400, style: "planned", dens: 0.55, h: [14, 40] },
  { id: "turbhe", name: "Turbhe MIDC", x: 4.35 * K, z: 2.5 * K, r: 480, style: "industrial", dens: 0.55, h: [9, 22] },
  { id: "vashi", name: "Vashi", x: 3.95 * K, z: 3.3 * K, r: 420, style: "planned", dens: 0.75, h: [18, 55] },
  { id: "nerul", name: "Nerul", x: 4.1 * K, z: 4.2 * K, r: 420, style: "planned", dens: 0.7, h: [16, 46] },
  { id: "belapur", name: "CBD Belapur", x: 4.45 * K, z: 4.95 * K, r: 380, style: "glass", dens: 0.6, h: [30, 90] },
  { id: "kharghar", name: "Kharghar", x: 5.1 * K, z: 5.35 * K, r: 420, style: "planned", dens: 0.55, h: [18, 50] },
  { id: "kalamboli", name: "Kalamboli", x: 5.45 * K, z: 4.85 * K, r: 380, style: "industrial", dens: 0.35, h: [8, 18] },
  { id: "jnpt", name: "JNPT Port", x: 4.2 * K, z: 6.1 * K, r: 520, style: "port", dens: 0.4, h: [6, 16] },
  { id: "ghats", name: "Sahyadri Ghats", x: 5.9 * K, z: 3.0 * K, r: 900, style: "forest", dens: 0.03, h: [5, 9] },
];
export function districtAt(x, z) {
  let best = null, bs = 1e9;
  for (const d of DISTRICTS) { const s = Math.hypot(x - d.x, z - d.z) / d.r; if (s < bs) { bs = s; best = d; } }
  return bs < 1.25 ? best : null;
}
export const districtDens = (x, z) => {
  // the whole built-up land is at least mid-density; forests, the ghats and the far rim thin out
  let forest = 0, m = 0;
  for (const d of DISTRICTS) {
    const s = Math.hypot(x - d.x, z - d.z) / d.r;
    if (d.style === "forest") forest = Math.max(forest, 1 - sstep(0.55, 1.05, s));
    else if (s < 1.15) m = Math.max(m, d.dens * (1 - sstep(0.7, 1.15, s)));
  }
  const rim = sstep(150, 500, Math.min(x, z, W - x, W - z));
  const base = 0.4 * (1 - forest) * rim;
  return Math.max(base, m * (1 - forest * 0.9));
};
export { sstep, hash2, pip, WEST_LAND, EAST_LAND, PORT_LAND };

if (typeof process !== "undefined" && process.argv && process.argv[1] && process.argv[1].endsWith("geo.out.mjs")) {
  const rows = [];
  for (let j = 0; j < G; j += 8) { let r = ""; for (let i = 0; i < G; i += 4) r += land[j * G + i] ? (baseH((i + 0.5) * CELL, (j + 0.5) * CELL) > 40 ? "^" : baseH((i + 0.5) * CELL, (j + 0.5) * CELL) > 12 ? "n" : ".") : "~"; rows.push(r); }
  console.log(rows.join("\n"));
}
