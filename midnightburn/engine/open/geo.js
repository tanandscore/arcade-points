// Midnight Burn — the city's shape: sea, creek, hills and districts.
// A stylised, compressed "Mumbai – Thane – Navi Mumbai": the island city on the west with its
// sea-facing coast, Thane Creek running north-south, Navi Mumbai's planned grid on the east bank,
// the harbour and port to the south, and the Sahyadri hills on the far east edge.
// Units are metres. x runs east, z runs south (north is the top of the map).

// The map is Greater Mumbai at 2.4x the old size, with room to the north (Vasai–Virar, the Ahmedabad highway) and a long plateau to the
// east (Lonavala and Pune at the end of the expressway). Old coordinates ("km") still describe the geography; mx/mz turn them into metres.
export const SC = 2.4, OX = 1300, OZ = 3500;
export const W = 22000;
export const mx = (k) => k * 1000 * SC + OX;
export const mz = (k) => k * 1000 * SC + OZ;
export const CELL = 20;
export const G = W / CELL;

import { MAP_ID } from "./mapId";
import { makeTokyoGeo } from "./maps/tokyoGeo";
// The active map: null = Mumbai (the data in this file), otherwise a map definition (maps/tokyoGeo.js) that replaces the coast, rivers, hills, districts and airports.
// Everything below reads from it, so the rest of the engine does not care which city it is building.
const DEF = MAP_ID === "tokyo" ? makeTokyoGeo({ mx, mz, W, CELL }) : null;

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
const P = (pts) => pts.map(([x, z]) => [mx(x), mz(z)]);

// ---- coastline (km) --------------------------------------------------------------------------
// The island city and Thane (west of the creek)
const WEST_LAND = P([
  [0.3, -1.6], [0.38, -1.0], [0.46, -0.6], [0.55, -0.3], [0.62, 0.8], [0.78, 1.5], [0.95, 2.1], [1.1, 2.6], [1.18, 2.85],
  [1.5, 3.05], [1.88, 3.3], [1.9, 3.7], [1.72, 4.0], [1.42, 4.3],
  [1.52, 4.62], [1.68, 4.8], [1.55, 5.2], [1.5, 5.55], [1.6, 6.05], [1.75, 6.25], [1.98, 6.08],
  [2.1, 5.6], [2.35, 5.0], [2.55, 4.4], [2.68, 3.8], [2.82, 3.1], [3.0, 2.4], [3.12, 1.8], [3.22, 1.2], [3.38, 0.6], [3.42, -0.3], [3.45, -1.0], [3.5, -1.6],
]);
// Navi Mumbai and everything east of the creek, up to the hills
const EAST_LAND = P([
  [3.98, -1.6], [3.98, -0.3], [3.93, 0.6], [3.78, 1.3], [3.7, 2.0], [3.62, 2.7], [3.6, 3.4], [3.66, 4.1], [3.86, 4.7], [4.2, 5.15], [4.7, 5.5], [5.3, 5.8], [5.9, 6.1], [6.6, 6.5], [7.4, 6.9], [8.0, 7.5], [8.7, 7.95],
  [8.7, -1.6],
]);
// Uran / the port peninsula in the south (joined to the mainland by the harbour bridge)
const PORT_LAND = P([[3.5, 5.95], [4.2, 5.7], [4.85, 5.8], [4.95, 6.5], [3.4, 6.5], [3.35, 6.15]]);
// lakes (km centre + radii)
export const LAKES = DEF ? DEF.lakes : [
  { id: "upvan", name: "Upvan Lake", x: mx(3.0), z: mz(0.72), rx: 190 * SC, rz: 140 * SC, rot: 0.4 },
  { id: "powai", name: "Powai Lake", x: mx(2.55), z: mz(2.3), rx: 230 * SC, rz: 150 * SC, rot: -0.6 },
  { id: "vihar", name: "Vihar Lake", x: mx(2.1), z: mz(1.25), rx: 210 * SC, rz: 160 * SC, rot: 0.9 },
  { id: "kharghar", name: "Kharghar Wetlands", x: mx(4.95), z: mz(4.55), rx: 240 * SC, rz: 130 * SC, rot: 0.2 },
  { id: "pavna", name: "Pavna Lake", x: mx(7.5), z: mz(5.7), rx: 200 * SC, rz: 120 * SC, rot: 0.3 },
  { id: "tungarli", name: "Tungarli Lake", x: mx(6.9), z: mz(4.2), rx: 150 * SC, rz: 90 * SC, rot: -0.5 },
];

// ---- rasters: land mask and signed distance to the coast -------------------------------------------------
export const land = new Uint8Array(G * G);
if (DEF) DEF.fillLand(land); // the sea, bay, rivers and reclaimed land of the active map
for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
  const x = (i + 0.5) * CELL, z = (j + 0.5) * CELL;
  let l = DEF ? land[j * G + i] === 1 : (pip(WEST_LAND, x, z) || pip(EAST_LAND, x, z) || pip(PORT_LAND, x, z));
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

const AIRPORT_FLAT = []; // filled below (airports are declared after baseH)
// ---- hills ----------------------------------------------------------------------------------------------------
export const HILLS = DEF ? DEF.hills : [
  { x: mx(1.9), z: mz(0.8), r: 750 * SC, h: 85, n: "Sanjay Gandhi forest" }, { x: mx(2.45), z: mz(0.45), r: 520 * SC, h: 100, n: "Yeoor hills" },
  { x: mx(1.45), z: mz(4.35), r: 260 * SC, h: 30, n: "Malabar Hill" }, { x: mx(4.3), z: mz(4.8), r: 330 * SC, h: 52, n: "Parsik hill" },
  { x: mx(2.75), z: mz(2.05), r: 300 * SC, h: 30, n: "Powai ridge" }, { x: mx(4.8), z: mz(0.8), r: 520 * SC, h: 70, n: "Kalwa ridge" },
  { x: mx(5.3), z: mz(-0.9), r: 600 * SC, h: 90, n: "Nashik ghats" }, { x: mx(7.3), z: mz(3.1), r: 420 * SC, h: 70, n: "Sinhagad spur" }, { x: mx(8.3), z: mz(4.3), r: 360 * SC, h: 60, n: "Pune hills" },
];
export function baseH(x, z) {
  const d = shoreDist(x, z);
  if (d <= 0) return Math.max(-9, -1.5 + d * 0.06);
  let h = 1.0 + sstep(0, 90, d) * (1.1 + fbm(x * 0.004, z * 0.004, 3) * 1.6);
  for (const k of HILLS) { const dd = Math.hypot(x - k.x, z - k.z) / k.r; if (dd < 1.6) h += k.h * Math.exp(-dd * dd * 2.2) * (0.65 + 0.7 * fbm(x * 0.006, z * 0.006, 8)) * sstep(0, 160, d); }
  if (DEF) h += DEF.relief(x, z, d, h, fbm, sstep);
  else {
  // Sahyadri: the ghats rise east of Navi Mumbai, peak around old-km 6.0, and drop onto the flat Deccan plateau (Lonavala, Pune)
  { const gx = (x - mx(6.0)) / (0.62 * 1000 * SC); const ridge = Math.exp(-gx * gx) * (70 + 130 * fbm(x * 0.0012, z * 0.0012, 12)) * sstep(0, 200, d); const foot = sstep(mx(4.9), mx(5.7), x) * (1 - sstep(mx(6.3), mx(6.9), x)) * 24 * sstep(0, 200, d); const plateau = sstep(mx(6.4), mx(7.0), x) * (14 + 16 * fbm(x * 0.0009, z * 0.0009, 31)) * sstep(0, 200, d); h += ridge + foot + plateau; }
  const north = sstep(500, 0, z) * 40 * fbm(x * 0.004, z * 0.004, 21) * sstep(0, 200, d); h += north;
  }
  // airports are levelled
  for (const ap of AIRPORT_FLAT) { const c = Math.cos(ap.rot), sn = Math.sin(ap.rot); const dx = x - ap.x, dz = z - ap.z; const q = Math.hypot((dx * c + dz * sn) / (ap.rx + 220), (-dx * sn + dz * c) / (ap.rz + 220)); if (q < 1.3) { const k = 1 - sstep(0.8, 1.3, q); h += (ap.h - h) * k; } }
  // world rim: low walls of hills so you never see the edge
  const edge = Math.min(x, z, W - x, W - z);
  if (edge < 240 && d > 0) h += (240 - edge) * 0.11;
  return h;
}

// ---- districts -------------------------------------------------------------------------------------------------
// style: how the buildings there look. dens 0..1 how crowded. h = [min,max] storeys' height in metres.
export const DISTRICTS = DEF ? DEF.districts : [
  { id: "colaba", name: "Colaba", x: mx(1.78), z: mz(5.85), r: 380 * SC, style: "old", dens: 0.95, h: [14, 36] },
  { id: "fort", name: "Fort & CST", x: mx(1.95), z: mz(5.35), r: 330 * SC, style: "colonial", dens: 0.9, h: [16, 42] },
  { id: "nariman", name: "Nariman Point", x: mx(1.62), z: mz(5.0), r: 280 * SC, style: "tower", dens: 0.9, h: [40, 110] },
  { id: "malabar", name: "Malabar Hill", x: mx(1.55), z: mz(4.45), r: 260 * SC, style: "upscale", dens: 0.55, h: [20, 60] },
  { id: "worli", name: "Worli", x: mx(1.95), z: mz(4.0), r: 360 * SC, style: "tower", dens: 0.85, h: [35, 120] },
  { id: "dadar", name: "Dadar & Dharavi", x: mx(2.3), z: mz(3.55), r: 420 * SC, style: "dense", dens: 1.0, h: [9, 26] },
  { id: "sewri", name: "Sewri Docks", x: mx(2.5), z: mz(4.55), r: 330 * SC, style: "industrial", dens: 0.6, h: [8, 20] },
  { id: "bkc", name: "Bandra Kurla Complex", x: mx(2.2), z: mz(3.05), r: 330 * SC, style: "glass", dens: 0.8, h: [60, 170] },
  { id: "bandra", name: "Bandra", x: mx(1.5), z: mz(2.95), r: 360 * SC, style: "suburb", dens: 0.7, h: [10, 32] },
  { id: "juhu", name: "Juhu & Andheri", x: mx(1.3), z: mz(2.0), r: 480 * SC, style: "suburb", dens: 0.65, h: [9, 30] },
  { id: "kurla", name: "Kurla & Sion", x: mx(2.65), z: mz(3.7), r: 360 * SC, style: "dense", dens: 0.95, h: [10, 30] },
  { id: "powai", name: "Powai", x: mx(2.6), z: mz(2.3), r: 360 * SC, style: "tower", dens: 0.6, h: [30, 90] },
  { id: "ghatkopar", name: "Ghatkopar & Mulund", x: mx(2.95), z: mz(2.9), r: 380 * SC, style: "dense", dens: 0.85, h: [12, 38] },
  { id: "thane", name: "Thane", x: mx(3.05), z: mz(1.25), r: 520 * SC, style: "mixed", dens: 0.75, h: [12, 60] },
  { id: "sgnp", name: "Sanjay Gandhi National Park", x: mx(1.9), z: mz(0.8), r: 720 * SC, style: "forest", dens: 0.05, h: [6, 12] },
  { id: "yeoor", name: "Yeoor Hills", x: mx(2.45), z: mz(0.45), r: 480 * SC, style: "forest", dens: 0.05, h: [6, 10] },
  { id: "airoli", name: "Airoli", x: mx(3.98), z: mz(1.45), r: 400 * SC, style: "planned", dens: 0.55, h: [14, 40] },
  { id: "turbhe", name: "Turbhe MIDC", x: mx(4.35), z: mz(2.5), r: 480 * SC, style: "industrial", dens: 0.55, h: [9, 22] },
  { id: "vashi", name: "Vashi", x: mx(3.95), z: mz(3.3), r: 420 * SC, style: "planned", dens: 0.75, h: [18, 55] },
  { id: "nerul", name: "Nerul", x: mx(4.1), z: mz(4.2), r: 420 * SC, style: "planned", dens: 0.7, h: [16, 46] },
  { id: "belapur", name: "CBD Belapur", x: mx(4.45), z: mz(4.95), r: 380 * SC, style: "glass", dens: 0.6, h: [30, 90] },
  { id: "kharghar", name: "Kharghar", x: mx(5.1), z: mz(5.35), r: 420 * SC, style: "planned", dens: 0.55, h: [18, 50] },
  { id: "kalamboli", name: "Kalamboli", x: mx(5.45), z: mz(4.85), r: 380 * SC, style: "industrial", dens: 0.35, h: [8, 18] },
  { id: "jnpt", name: "JNPT Port", x: mx(4.2), z: mz(6.1), r: 520 * SC, style: "port", dens: 0.4, h: [6, 16] },
  { id: "vasai", name: "Vasai", x: mx(0.95), z: mz(-0.6), r: 400 * SC, style: "suburb", dens: 0.6, h: [10, 30] },
  { id: "virar", name: "Virar", x: mx(1.2), z: mz(-1.2), r: 380 * SC, style: "suburb", dens: 0.55, h: [9, 26] },
  { id: "mira", name: "Mira–Bhayandar", x: mx(1.4), z: mz(0.0), r: 380 * SC, style: "dense", dens: 0.8, h: [12, 36] },
  { id: "bhiwandi", name: "Bhiwandi Warehouses", x: mx(3.95), z: mz(-0.55), r: 420 * SC, style: "industrial", dens: 0.55, h: [8, 18] },
  { id: "kalyan", name: "Kalyan", x: mx(4.45), z: mz(0.4), r: 420 * SC, style: "dense", dens: 0.85, h: [12, 36] },
  { id: "dombivli", name: "Dombivli", x: mx(4.75), z: mz(1.2), r: 380 * SC, style: "dense", dens: 0.75, h: [12, 34] },
  { id: "ambernath", name: "Ambernath", x: mx(5.35), z: mz(0.15), r: 380 * SC, style: "mixed", dens: 0.55, h: [10, 30] },
  { id: "panvel", name: "Panvel", x: mx(5.45), z: mz(5.0), r: 380 * SC, style: "mixed", dens: 0.7, h: [12, 38] },
  { id: "ulwe", name: "Ulwe & Airport City", x: mx(5.55), z: mz(5.6), r: 400 * SC, style: "planned", dens: 0.55, h: [16, 46] },
  { id: "uran", name: "Uran", x: mx(4.6), z: mz(6.25), r: 300 * SC, style: "port", dens: 0.45, h: [6, 16] },
  { id: "lonavala", name: "Lonavala & Khandala", x: mx(7.0), z: mz(3.95), r: 380 * SC, style: "mixed", dens: 0.5, h: [8, 24] },
  { id: "talegaon", name: "Talegaon", x: mx(7.45), z: mz(4.45), r: 380 * SC, style: "mixed", dens: 0.6, h: [10, 30] },
  { id: "hinjewadi", name: "Hinjewadi IT Park", x: mx(7.8), z: mz(4.95), r: 420 * SC, style: "glass", dens: 0.75, h: [30, 110] },
  { id: "pune", name: "Pune", x: mx(8.1), z: mz(5.55), r: 600 * SC, style: "colonial", dens: 0.9, h: [14, 60] },
  { id: "pimpri", name: "Pimpri-Chinchwad", x: mx(7.7), z: mz(6.0), r: 450 * SC, style: "industrial", dens: 0.65, h: [9, 24] },
  { id: "kothrud", name: "Kothrud & Baner", x: mx(8.35), z: mz(5.1), r: 420 * SC, style: "suburb", dens: 0.7, h: [10, 34] },
  { id: "hadapsar", name: "Hadapsar", x: mx(8.2), z: mz(6.5), r: 420 * SC, style: "planned", dens: 0.65, h: [14, 40] },
  { id: "ghats", name: "Sahyadri Ghats", x: mx(5.9), z: mz(3.0), r: 900 * SC, style: "forest", dens: 0.03, h: [5, 9] },
];

// ---- airports: runways and terminals are drawn by landmarks3d; nothing else is built inside the footprint ----
export const AIRPORTS = DEF ? DEF.airports : [
  { id: "csmia", name: "Chhatrapati Shivaji Maharaj Int'l Airport", x: mx(2.17), z: mz(2.79), rx: 1150, rz: 640, rot: 0.0,
    runways: [{ x: -80, z: -120, len: 2150, ang: 0.0, w: 58, num: "09/27" }, { x: 160, z: 40, len: 1500, ang: 0.92, w: 46, num: "14/32" }], terminal: { x: -120, z: 300, len: 620, ang: 0.0 }, tower: { x: 330, z: 250 } },
  { id: "nmia", name: "Navi Mumbai International Airport", x: mx(5.72), z: mz(5.7), rx: 1100, rz: 600, rot: 0.08,
    runways: [{ x: 0, z: -190, len: 2100, ang: 0.0, w: 58, num: "08L/26R" }, { x: 0, z: 190, len: 2100, ang: 0.0, w: 58, num: "08R/26L" }], terminal: { x: 0, z: 0, len: 700, ang: 0.0 }, tower: { x: 330, z: 0 } },
];
if (!DEF) { AIRPORTS[0].h = 5.5; AIRPORTS[1].h = 7; }
AIRPORT_FLAT.push(...AIRPORTS);
export function inAirport(x, z, pad = 0) {
  for (const a of AIRPORTS) { if (Math.abs(x - a.x) > a.rx + pad + 5 || Math.abs(z - a.z) > a.rx + pad + 5) continue; const c = Math.cos(a.rot), s = Math.sin(a.rot); const dx = x - a.x, dz = z - a.z; const u = (dx * c + dz * s) / (a.rx + pad), v = (-dx * s + dz * c) / (a.rz + pad); if (u * u + v * v < 1) return a; }
  return null;
}
// district lookup is hot (called millions of times while the city is built), so each 250 m cell remembers the few districts that can reach it
const DG = 250, DGN = Math.ceil(W / DG) + 1; let distGrid = null;
function buildDistGrid() {
  distGrid = new Array(DGN * DGN);
  for (let j = 0; j < DGN; j++) for (let i = 0; i < DGN; i++) {
    const cx = (i + 0.5) * DG, cz = (j + 0.5) * DG; const l = [];
    for (const d of DISTRICTS) if (Math.hypot(cx - d.x, cz - d.z) < d.r * 1.3 + DG) l.push(d);
    distGrid[j * DGN + i] = l;
  }
}
const NONE = [];
function nearDistricts(x, z) { if (!distGrid) buildDistGrid(); const i = Math.floor(x / DG), j = Math.floor(z / DG); if (i < 0 || j < 0 || i >= DGN || j >= DGN) return NONE; return distGrid[j * DGN + i]; }
export function districtAt(x, z) {
  let best = null, bs = 1e9;
  for (const d of nearDistricts(x, z)) { const s = Math.hypot(x - d.x, z - d.z) / d.r; if (s < bs) { bs = s; best = d; } }
  return bs < 1.25 ? best : null;
}
export const districtDens = (x, z) => {
  if (inAirport(x, z, 40)) return 0;
  // the whole built-up land is at least mid-density; forests, the ghats and the far rim thin out
  let forest = 0, m = 0;
  for (const d of nearDistricts(x, z)) {
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
