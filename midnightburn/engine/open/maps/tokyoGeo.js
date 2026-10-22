// Midnight Burn: Tokyo Drift — the shape of the land.
// A stylised Greater Tokyo drawn from real latitude / longitude: Tokyo Bay in the middle, the Tokyo core on its north-west shore, Yokohama and Kawasaki to the
// south-west, Chiba and the Boso hills on the east side, Saitama to the north, the Tama and Sagami uplands rising on the west edge, the Shonan coast and
// the mouth of the bay along the south. The middle of the map is stretched (about 2.9 real metres per map metre) so the 23 wards have room to be driven;
// the outskirts are squeezed more (up to 12) so a whole region fits in 22 km. Units are metres, x runs east and z runs south, like the Mumbai map.

// ---- projection -----------------------------------------------------------------------------------------------------------------------
const LAT0 = 35.6812, LON0 = 139.7671, KX = 91.0, KY = 111.0;    // Tokyo Station; kilometres per degree of longitude / latitude here
const CX = 11200, CZ = 8700;                                          // where Tokyo Station sits on the map (metres)
const R1 = 20, S0 = 1 / 2.9, S1 = 1 / 12, A = 8;                    // real km out to which the map is stretched, then the squeeze
const rad = (r) => (r <= R1 ? r * 1000 * S0 : R1 * 1000 * S0 + 1000 * (S1 * (r - R1) + (S0 - S1) * A * (1 - Math.exp(-(r - R1) / A))));
export function ll(lat, lon) {
  const e = (lon - LON0) * KX, s = (LAT0 - lat) * KY, r = Math.hypot(e, s);
  if (r < 1e-6) return [CX, CZ];
  const k = rad(r) / (r * 1000);
  let x = CX + e * 1000 * k; if (x < CX) x += 950 * (1 - x / CX); // the far west (Takao, Okutama) is pushed in from the map edge so it stays on the map
  return [x, CZ + s * 1000 * k];
}
export const LLs = (arr) => arr.map(([a, b]) => ll(a, b));

// ---- small helpers --------------------------------------------------------------------------------------------------------------------
const hash = (x, z, s) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(z | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967295; };
function vn(x, z, s) { const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, a = hash(ix, iz, s), b = hash(ix + 1, iz, s), c = hash(ix, iz + 1, s), d = hash(ix + 1, iz + 1, s), u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
// Chaikin corner-cutting: turns a rough polygon into a soft, natural-looking coast
function chaikin(pts, iters) {
  let p = pts;
  for (let it = 0; it < iters; it++) {
    const out = [];
    for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
    p = out;
  }
  return p;
}
// roughen a coast a little (inlets and headlands a couple of hundred metres across) so it does not look drawn with a ruler
function rough(pts, amp, seed) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], a = pts[(i + pts.length - 1) % pts.length], b = pts[(i + 1) % pts.length];
    const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, n = (vn(p[0] * 0.004, p[1] * 0.004, seed) - 0.5) * 2 * amp;
    out.push([p[0] - (dz / l) * n, p[1] + (dx / l) * n]);
  }
  return out;
}
// scan-line fill of a polygon into a G x G mask (cell centres at (i+.5)*CELL)
function fillPoly(mask, G, CELL, poly, v) {
  let zmin = 1e18, zmax = -1e18; for (const p of poly) { if (p[1] < zmin) zmin = p[1]; if (p[1] > zmax) zmax = p[1]; }
  const j0 = Math.max(0, Math.floor(zmin / CELL - 0.5)), j1 = Math.min(G - 1, Math.ceil(zmax / CELL - 0.5));
  for (let j = j0; j <= j1; j++) {
    const z = (j + 0.5) * CELL, xs = [];
    for (let i = 0, k = poly.length - 1; i < poly.length; k = i++) {
      const a = poly[i], b = poly[k];
      if ((a[1] > z) !== (b[1] > z)) xs.push(a[0] + ((z - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
    }
    xs.sort((p, q) => p - q);
    for (let t = 0; t + 1 < xs.length; t += 2) {
      const i0 = Math.max(0, Math.ceil(xs[t] / CELL - 0.5)), i1 = Math.min(G - 1, Math.floor(xs[t + 1] / CELL - 0.5));
      for (let i = i0; i <= i1; i++) mask[j * G + i] = v;
    }
  }
}
// a river: a ribbon of given half-width along a polyline, wandering gently
function stampRiver(mask, G, CELL, pts, hw, v, seed) {
  const dense = []; // resample every ~40 m and add a slow meander
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i], b = pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 40));
    for (let k = 0; k < n; k++) dense.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
  }
  dense.push(pts[pts.length - 1]);
  for (let i = 0; i < dense.length; i++) {
    const p = dense[i], q = dense[Math.min(dense.length - 1, i + 1)], o = dense[Math.max(0, i - 1)];
    const dx = q[0] - o[0], dz = q[1] - o[1], l = Math.hypot(dx, dz) || 1, w = (vn(i * 0.07, seed, seed) - 0.5) * 2 * hw * 0.9, hwi = hw * (0.8 + 0.5 * vn(i * 0.11, seed + 3, seed + 1));
    const cx = p[0] - (dz / l) * w, cz = p[1] + (dx / l) * w;
    const i0 = Math.max(0, Math.floor((cx - hwi) / CELL)), i1 = Math.min(G - 1, Math.floor((cx + hwi) / CELL)), j0 = Math.max(0, Math.floor((cz - hwi) / CELL)), j1 = Math.min(G - 1, Math.floor((cz + hwi) / CELL));
    for (let j = j0; j <= j1; j++) for (let ii = i0; ii <= i1; ii++) { const x = (ii + 0.5) * CELL - cx, z = (j + 0.5) * CELL - cz; if (x * x + z * z <= hwi * hwi) mask[j * G + ii] = v; }
  }
}

// ---- the coast (latitude, longitude) --------------------------------------------------------------------------------------------------
// Tokyo Bay and the sea to the south-east of it: east shore from the head of the bay (Funabashi) down to Futtsu, out through the mouth, then the west shore
// back up from Yokosuka past Yokohama, Kawasaki and Haneda to the Tokyo waterfront.
const EAST_SHORE = [[35.672, 139.985], [35.668, 140.020], [35.648, 140.046], [35.615, 140.080], [35.592, 140.102], [35.560, 140.106], [35.520, 140.106], [35.482, 140.078], [35.455, 140.026], [35.430, 139.976], [35.405, 139.936], [35.384, 139.914], [35.352, 139.886], [35.318, 139.846], [35.300, 139.816], [35.262, 139.806], [35.200, 139.818]];
const WEST_SHORE = [[35.262, 139.742], [35.281, 139.692], [35.292, 139.662], [35.322, 139.640], [35.350, 139.642], [35.380, 139.646], [35.403, 139.652], [35.426, 139.668], [35.442, 139.678], [35.454, 139.664], [35.466, 139.668], [35.482, 139.684], [35.496, 139.706], [35.506, 139.735], [35.510, 139.760], [35.516, 139.786], [35.534, 139.792],
  [35.576, 139.786], [35.598, 139.791], [35.616, 139.786], [35.626, 139.760], [35.641, 139.766], [35.652, 139.770], [35.652, 139.786], [35.642, 139.800], [35.628, 139.822], [35.634, 139.848], [35.641, 139.868], [35.634, 139.892], [35.641, 139.920], [35.658, 139.954]];
// Sagami Bay, along the Shonan coast in the south-west
const SAGAMI = [[35.262, 139.150], [35.300, 139.300], [35.314, 139.352], [35.318, 139.400], [35.311, 139.455], [35.300, 139.482], [35.299, 139.545], [35.290, 139.578], [35.262, 139.592], [35.230, 139.606]];
// reclaimed land and islands that stand in the sea
const HANEDA = [[35.576, 139.790], [35.577, 139.862], [35.566, 139.870], [35.545, 139.866], [35.539, 139.850], [35.540, 139.800], [35.547, 139.790]];
const ODAIBA = [[35.637, 139.767], [35.637, 139.796], [35.621, 139.802], [35.607, 139.791], [35.609, 139.771], [35.623, 139.762]];
const DAIKOKU = [[35.462, 139.676], [35.474, 139.690], [35.466, 139.706], [35.450, 139.696], [35.452, 139.682]];
const UMIHOTARU = [[35.468, 139.862], [35.468, 139.884], [35.459, 139.884], [35.459, 139.862]];
const KEIHIN = [[35.512, 139.742], [35.512, 139.790], [35.495, 139.792], [35.490, 139.748]];     // the industrial islands off Kawasaki
const HONMOKU = [[35.444, 139.668], [35.446, 139.692], [35.428, 139.692], [35.424, 139.672]];
const WAKASU = [[35.630, 139.820], [35.634, 139.840], [35.616, 139.850], [35.610, 139.826]];     // Wakasu / Tokyo Gate Bridge landfill
// rivers: polyline (lat, lon), half-width in map metres
const RIVERS = [
  { id: "sumida", name: "Sumida River", hw: 52, seed: 3, pts: [[35.800, 139.730], [35.772, 139.768], [35.745, 139.800], [35.715, 139.799], [35.693, 139.794], [35.672, 139.796], [35.652, 139.793], [35.632, 139.795]] },
  { id: "arakawa", name: "Arakawa River", hw: 78, seed: 5, pts: [[35.880, 139.640], [35.840, 139.690], [35.800, 139.722], [35.766, 139.755], [35.740, 139.800], [35.722, 139.836], [35.696, 139.857], [35.660, 139.863], [35.640, 139.866], [35.620, 139.868]] },
  { id: "edo", name: "Edo River", hw: 56, seed: 7, pts: [[35.900, 139.880], [35.850, 139.884], [35.800, 139.896], [35.750, 139.904], [35.712, 139.910], [35.676, 139.912], [35.640, 139.912], [35.620, 139.912]] },
  { id: "tama", name: "Tama River", hw: 92, seed: 11, pts: [[35.690, 139.200], [35.668, 139.300], [35.656, 139.400], [35.655, 139.470], [35.640, 139.530], [35.612, 139.618], [35.586, 139.676], [35.556, 139.730], [35.538, 139.758], [35.524, 139.780], [35.512, 139.812], [35.505, 139.850]] },
];
// lakes (centre lat/lon, radii in map metres)
const LAKE_DEFS = [
  { id: "kokyo", name: "Imperial Palace Moat", lat: 35.6852, lon: 139.7528, rx: 250, rz: 195, rot: -0.2 },
  { id: "sayama", name: "Sayama–Tama Lakes", lat: 35.768, lon: 139.425, rx: 360, rz: 170, rot: 0.5 },
  { id: "teganuma", name: "Teganuma Wetlands", lat: 35.835, lon: 140.035, rx: 330, rz: 110, rot: 0.9 },
  { id: "sagamiko", name: "Lake Sagami", lat: 35.610, lon: 139.215, rx: 260, rz: 120, rot: -0.6 },
  { id: "shinobazu", name: "Ueno Pond", lat: 35.7110, lon: 139.7670, rx: 90, rz: 60, rot: 0.2 },
];

// ---- hills (lat, lon, radius m, height m) ----------------------------------------------------------------------------------------------
const HILL_DEFS = [
  { lat: 35.640, lon: 139.240, r: 2900, h: 150, n: "Takao–Jinba range" }, { lat: 35.810, lon: 139.140, r: 3400, h: 175, n: "Okutama mountains" },
  { lat: 35.470, lon: 139.190, r: 3000, h: 165, n: "Tanzawa mountains" }, { lat: 35.620, lon: 139.450, r: 1500, h: 48, n: "Tama hills" },
  { lat: 35.780, lon: 139.420, r: 1500, h: 42, n: "Sayama hills" }, { lat: 35.250, lon: 139.620, r: 1300, h: 52, n: "Miura hills" },
  { lat: 35.220, lon: 140.030, r: 3600, h: 95, n: "Boso hills" }, { lat: 35.400, lon: 140.250, r: 2600, h: 60, n: "Kujukuri uplands" },
  { lat: 35.432, lon: 139.650, r: 650, h: 24, n: "Yamate Bluff" }, { lat: 35.675, lon: 139.700, r: 2500, h: 12, n: "Yamanote uplands" },
  { lat: 35.560, lon: 139.380, r: 2300, h: 55, n: "Sagamihara terraces" },
  { lat: 35.230, lon: 139.100, r: 2600, h: 170, n: "Hakone mountains" }, { lat: 35.960, lon: 139.165, r: 2300, h: 185, n: "Mount Akina" }, { lat: 35.450, lon: 139.070, r: 3000, h: 235, n: "Mount Fuji foothills" },
];

// ---- districts (lat, lon, radius m, style, density, building height range) -----------------------------------------------------------
// style names are the ones the building code already knows: old, colonial, dense, suburb, upscale, tower, glass, mixed, planned, industrial, port, forest, future
const D = (id, name, lat, lon, r, style, dens, h0, h1) => { const [x, z] = ll(lat, lon); return { id, name, x, z, r, style, dens, h: [h0, h1] }; };
const DISTRICT_LIST = [
  D("marunouchi", "Marunouchi & Tokyo Station", 35.6830, 139.7671, 320, "glass", 0.9, 50, 160),
  D("ginza", "Ginza", 35.6717, 139.7649, 290, "dense", 0.98, 25, 56),
  D("nihonbashi", "Nihonbashi & Tsukiji", 35.6790, 139.7760, 330, "colonial", 0.9, 28, 70),
  D("shiodome", "Shimbashi & Shiodome", 35.6640, 139.7580, 330, "glass", 0.9, 60, 200),
  D("roppongi", "Roppongi & Akasaka", 35.6650, 139.7340, 430, "tower", 0.85, 40, 230),
  D("shibuya", "Shibuya", 35.6590, 139.7016, 420, "dense", 1.0, 25, 95),
  D("meiji", "Meiji Shrine Forest", 35.6763, 139.6993, 300, "forest", 0.05, 6, 12),
  D("harajuku", "Harajuku & Aoyama", 35.6680, 139.7110, 300, "upscale", 0.8, 14, 50),
  D("shinjuku", "Shinjuku", 35.6896, 139.7006, 460, "glass", 0.95, 60, 250),
  D("ikebukuro", "Ikebukuro", 35.7295, 139.7109, 400, "dense", 0.95, 30, 120),
  D("ueno", "Ueno & Akihabara", 35.7090, 139.7745, 420, "dense", 1.0, 20, 62),
  D("asakusa", "Asakusa & Skytree", 35.7125, 139.8040, 430, "old", 0.95, 10, 36),
  D("shinagawa", "Shinagawa", 35.6285, 139.7387, 420, "glass", 0.85, 50, 170),
  D("meguro", "Meguro & Ebisu", 35.6467, 139.7100, 400, "upscale", 0.75, 15, 52),
  D("setagaya", "Setagaya", 35.6450, 139.6500, 720, "suburb", 0.7, 8, 28),
  D("nakano", "Nakano & Koenji", 35.7054, 139.6497, 600, "dense", 0.8, 10, 36),
  D("suginami", "Suginami & Kichijoji", 35.7030, 139.5780, 720, "suburb", 0.68, 8, 26),
  D("nerima", "Nerima", 35.7355, 139.6516, 620, "suburb", 0.66, 8, 26),
  D("itabashi", "Itabashi & Kita", 35.7512, 139.7094, 540, "dense", 0.8, 10, 36),
  D("adachi", "Adachi & Kita-Senju", 35.7494, 139.8050, 560, "dense", 0.8, 10, 32),
  D("katsushika", "Katsushika", 35.7434, 139.8473, 520, "mixed", 0.7, 8, 30),
  D("edogawa", "Edogawa & Kasai", 35.6800, 139.8700, 520, "mixed", 0.7, 10, 36),
  D("toyosu", "Toyosu & Ariake", 35.6430, 139.7960, 430, "future", 0.8, 40, 180),
  D("odaiba", "Odaiba", 35.6240, 139.7840, 300, "future", 0.6, 25, 120),
  D("ota", "Ota & Kamata", 35.5625, 139.7160, 580, "mixed", 0.75, 10, 32),
  D("kawasaki", "Kawasaki", 35.5309, 139.6970, 480, "dense", 0.85, 15, 62),
  D("keihin", "Keihin Industrial Zone", 35.5040, 139.7580, 520, "industrial", 0.6, 8, 24),
  D("tsurumi", "Tsurumi", 35.5081, 139.6764, 420, "mixed", 0.75, 10, 36),
  D("yokohama", "Minato Mirai & Yokohama", 35.4560, 139.6330, 460, "glass", 0.9, 40, 290),
  D("kannai", "Kannai & Chinatown", 35.4437, 139.6500, 320, "old", 0.95, 14, 45),
  D("daikoku", "Daikoku Pier", 35.4620, 139.6930, 380, "port", 0.35, 6, 16),
  D("honmoku", "Honmoku Pier", 35.4340, 139.6800, 360, "port", 0.35, 6, 16),
  D("kohoku", "Kohoku & Shin-Yokohama", 35.5075, 139.6174, 540, "planned", 0.7, 15, 52),
  D("kanazawa", "Kanazawa & Kamiooka", 35.3600, 139.6100, 520, "suburb", 0.6, 8, 26),
  D("yokosuka", "Yokosuka", 35.2830, 139.6720, 420, "port", 0.55, 8, 26),
  D("kamakura", "Kamakura & Zushi", 35.3192, 139.5467, 440, "old", 0.6, 6, 22),
  D("fujisawa", "Fujisawa & Shonan", 35.3382, 139.4900, 540, "suburb", 0.6, 8, 26),
  D("hiratsuka", "Hiratsuka & Chigasaki", 35.3300, 139.3800, 520, "suburb", 0.55, 8, 22),
  D("atsugi", "Atsugi", 35.4423, 139.3607, 500, "mixed", 0.6, 10, 30),
  D("sagamihara", "Sagamihara", 35.5714, 139.3733, 540, "mixed", 0.65, 10, 36),
  D("machida", "Machida", 35.5429, 139.4455, 500, "dense", 0.8, 12, 42),
  D("tama", "Tama New Town", 35.6240, 139.4460, 560, "planned", 0.6, 15, 46),
  D("chofu", "Chofu & Fuchu", 35.6600, 139.5200, 580, "suburb", 0.66, 8, 28),
  D("mitaka", "Mitaka & Musashino", 35.7010, 139.5600, 540, "suburb", 0.7, 8, 28),
  D("tachikawa", "Tachikawa", 35.6979, 139.4140, 500, "mixed", 0.75, 12, 42),
  D("hachioji", "Hachioji", 35.6556, 139.3389, 520, "mixed", 0.7, 10, 36),
  D("takao", "Takao Mountains", 35.6300, 139.2500, 1100, "forest", 0.03, 5, 9),
  D("okutama", "Okutama Mountains", 35.8000, 139.1500, 1500, "forest", 0.03, 5, 9),
  D("tanzawa", "Tanzawa Mountains", 35.4700, 139.1900, 1400, "forest", 0.03, 5, 9),
  D("sayama", "Sayama Hills", 35.7800, 139.4200, 800, "forest", 0.1, 6, 12),
  D("tokorozawa", "Tokorozawa", 35.7990, 139.4720, 540, "suburb", 0.65, 8, 26),
  D("kawagoe", "Kawagoe", 35.9251, 139.4858, 500, "old", 0.7, 8, 26),
  D("omiya", "Omiya & Saitama", 35.8800, 139.6300, 620, "dense", 0.75, 12, 56),
  D("kawaguchi", "Kawaguchi & Warabi", 35.8077, 139.7241, 480, "dense", 0.85, 12, 42),
  D("koshigaya", "Koshigaya & Soka", 35.8700, 139.8000, 540, "suburb", 0.65, 8, 28),
  D("misato", "Misato & Matsudo", 35.8000, 139.9000, 540, "suburb", 0.65, 8, 28),
  D("kashiwa", "Kashiwa", 35.8617, 139.9730, 540, "dense", 0.75, 12, 46),
  D("ichikawa", "Ichikawa", 35.7219, 139.9311, 450, "dense", 0.8, 12, 42),
  D("funabashi", "Funabashi", 35.6947, 139.9826, 500, "mixed", 0.8, 12, 46),
  D("urayasu", "Urayasu & Maihama", 35.6400, 139.9000, 440, "planned", 0.65, 14, 46),
  D("makuhari", "Makuhari", 35.6482, 140.0341, 450, "glass", 0.7, 30, 125),
  D("chiba", "Chiba City", 35.6073, 140.1065, 620, "mixed", 0.8, 12, 62),
  D("ichihara", "Ichihara Industrial Coast", 35.5000, 140.0850, 720, "industrial", 0.55, 8, 26),
  D("kisarazu", "Kisarazu", 35.3811, 139.9168, 450, "mixed", 0.55, 8, 26),
  D("futtsu", "Futtsu & the Cape", 35.3040, 139.8250, 420, "port", 0.4, 6, 18),
  D("boso", "Boso Hills", 35.2400, 140.0200, 1500, "forest", 0.05, 5, 10),
  D("kujukuri", "Kujukuri Uplands", 35.4000, 140.2300, 900, "forest", 0.08, 5, 10),
  D("hanedatown", "Haneda & Omori", 35.5800, 139.7500, 380, "mixed", 0.6, 8, 26),
];

// ---- airport -------------------------------------------------------------------------------------------------------------------------
function airports() {
  const [x, z] = ll(35.5585, 139.8280);
  return [{ id: "hnd", name: "Tokyo International Airport (Haneda)", x, z, rx: 640, rz: 400, rot: 1.22, h: 4.5,
    runways: [{ x: 0, z: -150, len: 1050, ang: 0.0, w: 46, num: "16R/34L" }, { x: 20, z: 110, len: 980, ang: 0.0, w: 46, num: "16L/34R" }, { x: -60, z: -20, len: 800, ang: 1.0, w: 40, num: "04/22" }],
    terminal: { x: -170, z: 260, len: 380, ang: 0.0 }, tower: { x: -40, z: 220 } }];
}

// ---- the whole definition geo.js needs ------------------------------------------------------------------------------------------------
export function makeTokyoGeo({ W, CELL }) {
  const G = W / CELL;
  const sea = [];
  { // Tokyo Bay + the open sea to the south-east
    const east = LLs(EAST_SHORE), west = LLs(WEST_SHORE);
    const poly = [...east, [east[east.length - 1][0] + 200, 24500], ...[[west[0][0] - 200, 24500]], ...west];
    // east shore: keep the open sea off the bottom edge east of Futtsu (the Boso peninsula goes on south as land), so the polygon closes along the bottom
    sea.push(rough(chaikin(poly, 2), 38, 21));
  }
  { const pts = [[-3000, 19500], ...LLs(SAGAMI), [6900, 24500], [-3000, 24500]]; sea.push(rough(chaikin(pts, 2), 30, 33)); }
  const lands = [HANEDA, ODAIBA, DAIKOKU, UMIHOTARU, KEIHIN, HONMOKU, WAKASU].map((p) => rough(chaikin(LLs(p), p === HANEDA ? 0 : 2), p === HANEDA ? 4 : 10, 55));
  const rivers = RIVERS.map((r) => ({ ...r, xy: LLs(r.pts) }));
  const lakes = LAKE_DEFS.map((k) => { const [x, z] = ll(k.lat, k.lon); return { id: k.id, name: k.name, x, z, rx: k.rx, rz: k.rz, rot: k.rot }; });
  const hills = HILL_DEFS.map((h) => { const [x, z] = ll(h.lat, h.lon); return { x, z, r: h.r, h: h.h, n: h.n }; });
  return {
    lakes, hills, districts: DISTRICT_LIST, airports: airports(), rivers, seas: sea, reclaimed: lands,
    fillLand(land) {
      land.fill(1);
      for (const p of sea) fillPoly(land, G, CELL, p, 0);
      for (const p of lands) fillPoly(land, G, CELL, p, 1);
      for (const r of rivers) stampRiver(land, G, CELL, r.xy, r.hw, 0, r.seed);
    },
    // the Kanto plain is flat; the uplands on the west edge climb into mountains (the hills above give the shape, this adds the rugged texture)
    relief(x, z, d, h, fbm, sstep) {
      const west = 1 - sstep(0, 3200, x);
      return west * (14 + 50 * fbm(x * 0.0021, z * 0.0021, 41)) * sstep(0, 200, d);
    },
  };
}
export { RIVERS, LAKE_DEFS, DISTRICT_LIST, HILL_DEFS };
