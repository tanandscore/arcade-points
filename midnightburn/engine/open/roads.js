// Midnight Burn — the road network: authored highways and bridges, generated street grids,
// elevation (bridges, flyovers, ghat climbs), and the graph that traffic and racers drive on.
import { buildMetro } from "./metro";
import { W, SC, mx, mz, mulberry, fbm, vnoise, baseH, shoreDist, isWater, districtDens, districtAt, DISTRICTS as DISTS, AIRPORTS, inAirport, pip, WEST_LAND, EAST_LAND, PORT_LAND, sstep, LAKES } from "./geo";

export const CLS = {
  hwy: { w: 22, lane: 3.7, speed: 1.0, rank: 3, deck: 14 },
  art: { w: 14, lane: 3.4, speed: 0.8, rank: 2, deck: 8 },
  str: { w: 9, lane: 2.7, speed: 0.6, rank: 1, deck: 6 },
};
const conv = ([x, z]) => [mx(x), mz(z)];

// ---- authored roads (km) -------------------------------------------------------------------------------------
// ground: true keeps a highway at ground level. twisty roads are drawn with extra points.
const AUTHORED = [
  // ---- the western spine: Ahmedabad highway, WEH, the Sea Link, Marine Drive ----
  { id: "weh", name: "Western Express Highway & Sea Link", cls: "hwy", rimA: true, pts: [[1.06, -1.38], [1.12, -1.15], [1.22, -0.85], [1.34, -0.5], [1.45, -0.2], [1.5, 0.15], [1.45, 0.8], [1.45, 1.45], [1.52, 2.05], [1.6, 2.45], [1.55, 2.68], [1.32, 2.78], [1.12, 3.0], [1.1, 3.35], [1.25, 3.7], [1.55, 3.95], [1.85, 4.05], [1.9, 4.25]], deck: 22 },
  { id: "pedder", name: "Pedder Road", cls: "art", pts: [[1.9, 4.25], [1.82, 4.45], [1.8, 4.7]] },
  { id: "marine", name: "Marine Drive", cls: "art", ground: true, pts: [[1.6, 5.28], [1.74, 5.0], [1.78, 4.82], [1.7, 4.62], [1.58, 4.46], [1.62, 4.32]], scenic: true },
  { id: "coastalS", name: "Mumbai Coastal Road", cls: "hwy", ground: true, scenic: true, pts: [[1.62, 4.32], [1.66, 4.12], [1.78, 3.95], [1.62, 3.85]], deck: 12 },
  { id: "colaba", name: "Colaba Causeway", cls: "art", ground: true, pts: [[1.98, 5.3], [1.9, 5.6], [1.84, 5.9], [1.8, 6.05]] },
  { id: "hbr", name: "Harbour Road", cls: "art", ground: true, pts: [[2.45, 4.75], [2.2, 5.0], [2.05, 5.3], [1.98, 5.5]] },
  { id: "juhu", name: "Juhu Tara Road", cls: "art", ground: true, scenic: true, pts: [[0.9, 1.5], [0.98, 1.9], [1.08, 2.3], [1.18, 2.58], [1.32, 2.72]] },
  { id: "svroad", name: "Swami Vivekanand Road", cls: "art", ground: true, pts: [[1.22, -0.1], [1.3, 0.6], [1.34, 1.3], [1.4, 1.9], [1.42, 2.4], [1.46, 2.95], [1.52, 3.3]] },
  // ---- the eastern spine ----
  { id: "eeh", name: "Eastern Express Highway", cls: "hwy", pts: [[2.05, 5.3], [2.2, 4.9], [2.3, 4.5], [2.45, 4.0], [2.55, 3.5], [2.68, 3.0], [2.85, 2.5], [2.95, 2.0], [3.02, 1.55], [3.02, 1.1]] },
  { id: "efree", name: "Eastern Freeway", cls: "hwy", pts: [[2.28, 4.78], [2.4, 4.35], [2.52, 3.95], [2.66, 3.55], [2.8, 3.2], [2.95, 2.9]], deck: 14 },
  { id: "lbs", name: "LBS Marg", cls: "art", ground: true, pts: [[2.55, 3.55], [2.74, 3.05], [2.86, 2.65], [2.98, 2.25], [3.06, 1.75], [3.08, 1.3]] },
  { id: "jvlr", name: "Jogeshwari–Vikhroli Link Road", cls: "art", ground: true, pts: [[1.52, 2.0], [1.8, 2.1], [2.2, 2.16], [2.6, 2.22], [2.92, 2.28]] },
  { id: "aarey", name: "Aarey–Powai Link Road", cls: "art", ground: true, pts: [[1.5, 1.3], [1.78, 1.6], [2.05, 1.72], [2.3, 1.82], [2.5, 1.95], [2.78, 2.05], [2.96, 2.1]] },
  { id: "sclr", name: "Santacruz–Chembur Link Road", cls: "hwy", pts: [[1.62, 3.12], [1.95, 3.2], [2.3, 3.36], [2.6, 3.42]], deck: 12 },
  { id: "vashi", name: "Vashi Bridge", cls: "hwy", pts: [[2.3, 3.45], [2.78, 3.3], [3.2, 3.28], [3.6, 3.3], [3.95, 3.3], [4.2, 3.3]], deck: 12 },
  // ---- the airport (Mumbai) ----
  { id: "csmia1", name: "Airport Road", cls: "art", ground: true, pts: [[2.117, 2.86], [2.03, 2.97], [1.95, 3.1], [1.9, 3.22]] },
  { id: "csmia2", name: "Airport Approach", cls: "art", ground: true, pts: [[2.117, 2.86], [2.3, 3.0], [2.42, 3.2], [2.46, 3.4]] },
  { id: "csmia3", name: "Airport Loop", cls: "art", ground: true, pts: [[1.62, 2.96], [1.8, 2.9], [1.95, 2.88], [2.117, 2.86]] },
  // ---- Thane, the creek and the north-east ----
  { id: "thanebel", name: "Thane–Belapur Road", cls: "hwy", ground: true, pts: [[3.08, 1.18], [3.45, 1.32], [3.8, 1.45], [4.05, 1.65], [4.25, 2.3], [4.3, 3.0], [4.35, 3.7], [4.5, 4.4], [4.65, 5.0], [4.9, 5.35], [5.2, 5.45]], deck: 11 },
  { id: "thanecoast", name: "Thane Coastal Road", cls: "hwy", ground: true, scenic: true, pts: [[3.0, 2.05], [3.06, 1.65], [3.1, 1.3], [3.2, 0.9], [3.3, 0.5], [3.34, 0.1], [3.34, -0.35], [3.36, -0.8], [3.38, -1.2]], deck: 12 },
  { id: "kalyan", name: "Kalyan–Shil Road", cls: "hwy", ground: true, hill: true, pts: [[3.12, 1.05], [3.4, 0.82], [3.9, 0.68], [4.4, 0.82], [4.9, 1.2], [5.4, 1.5], [5.9, 1.9]], deck: 10 },
  { id: "nashik", name: "Mumbai–Nashik Highway", cls: "hwy", ground: true, hill: true, rimB: true, pts: [[3.12, 1.05], [3.5, 0.62], [3.95, 0.25], [4.3, -0.15], [4.7, -0.7], [5.0, -1.1], [5.25, -1.38]], deck: 11 },
  { id: "ghodbunder", name: "Ghodbunder Road", cls: "hwy", ground: true, hill: true, pts: [[3.05, 1.0], [2.72, 0.62], [2.3, 0.28], [1.9, 0.1], [1.5, 0.15]] },
  { id: "mumbra", name: "Mumbra Bypass", cls: "art", ground: true, pts: [[3.3, 1.3], [3.7, 1.15], [4.1, 0.95], [4.45, 0.45]] },
  { id: "vasaibhi", name: "Vasai–Bhiwandi Road", cls: "art", ground: true, pts: [[0.72, -1.25], [1.1, -1.0], [1.7, -0.85], [2.4, -0.7], [3.0, -0.55], [3.5, -0.45], [3.95, -0.55]] },
  { id: "miraroad", name: "Mira Road", cls: "art", ground: true, pts: [[0.9, -0.8], [1.1, -0.5], [1.3, -0.15], [1.5, 0.15]] },
  { id: "kalyanshil", name: "Kalyan–Dombivli Road", cls: "art", ground: true, pts: [[4.2, 0.55], [4.5, 0.45], [4.8, 0.4], [5.1, 0.28], [5.45, 0.1], [5.8, -0.1]] },
  { id: "dombivli", name: "Dombivli Road", cls: "art", ground: true, pts: [[4.45, 0.45], [4.55, 0.9], [4.75, 1.2], [4.95, 1.55]] },
  { id: "yeoor", name: "Yeoor Hills Road", cls: "art", ground: true, hill: true, pts: [[2.9, 1.15], [2.76, 0.96], [2.84, 0.78], [2.62, 0.7], [2.7, 0.52], [2.46, 0.45], [2.52, 0.3], [2.28, 0.34], [2.2, 0.55], [1.98, 0.62], [2.02, 0.85], [1.8, 0.9], [1.7, 1.1]] },
  // ---- Navi Mumbai ----
  { id: "palm", name: "Palm Beach Road", cls: "hwy", ground: true, scenic: true, pts: [[3.95, 1.45], [3.86, 1.8], [3.8, 2.2], [3.76, 3.0], [3.8, 3.6], [3.92, 4.15], [4.02, 4.5], [4.2, 4.78], [4.42, 4.93]] },
  { id: "airolibr", name: "Airoli Bridge", cls: "hwy", pts: [[2.95, 2.05], [3.3, 1.88], [3.7, 1.72], [3.98, 1.52]], deck: 12 },
  { id: "sionpanvel", name: "Sion–Panvel Highway", cls: "hwy", ground: true, pts: [[4.2, 3.3], [4.2, 3.8], [4.32, 4.3], [4.58, 4.72], [4.95, 5.0], [5.4, 5.05]] },
  { id: "atal", name: "Atal Setu Trans-Harbour Link", cls: "hwy", pts: [[2.28, 4.7], [2.75, 5.0], [3.15, 5.35], [3.5, 5.7], [3.78, 5.98], [4.1, 6.05], [4.5, 6.15], [4.8, 6.22]], deck: 26 },
  { id: "jnpthwy", name: "JNPT Highway", cls: "hwy", ground: true, pts: [[4.2, 6.1], [4.55, 5.9], [4.85, 5.65], [5.1, 5.5], [5.2, 5.45]], deck: 10 },
  // ---- Navi Mumbai International Airport ----
  { id: "nmia1", name: "Airport Expressway", cls: "hwy", ground: true, pts: [[5.72, 5.7], [5.66, 5.55], [5.58, 5.42], [5.55, 5.35]] },
  { id: "nmia2", name: "Airport Link Road", cls: "art", ground: true, pts: [[5.72, 5.7], [5.5, 5.62], [5.3, 5.52], [5.2, 5.45]] },
  { id: "nmia3", name: "Ulwe Road", cls: "art", ground: true, pts: [[5.72, 5.7], [5.9, 5.55], [6.05, 5.35], [6.15, 5.12]] },
  // ---- outstation: Mumbai–Pune Expressway, the old highway and the ghats ----
  { id: "pune", name: "Mumbai–Pune Expressway", cls: "hwy", ground: true, hill: true, pts: [[5.2, 5.45], [5.55, 5.35], [5.9, 5.1], [6.15, 4.7], [6.3, 4.2], [6.55, 3.95], [6.85, 3.85], [7.15, 4.05], [7.45, 4.4], [7.7, 4.85], [7.92, 5.25]] },
  { id: "oldhwy", name: "Old Mumbai–Pune Highway (NH48)", cls: "art", ground: true, hill: true, pts: [[5.35, 5.2], [5.7, 4.95], [6.0, 4.55], [6.22, 4.05], [6.55, 3.72], [6.95, 3.68], [7.3, 4.0], [7.62, 4.55], [7.9, 5.05]] },
  { id: "ghat", name: "Khopoli Ghat Road", cls: "art", ground: true, hill: true, pts: [[5.2, 4.25], [5.5, 4.1], [5.36, 3.82], [5.66, 3.66], [5.5, 3.38], [5.86, 3.2], [5.7, 2.9], [6.04, 2.7], [5.9, 2.4], [6.2, 2.2], [6.5, 2.55], [6.72, 3.1], [6.95, 3.68]] },
  { id: "puneyring", name: "Pune Ring Road", cls: "hwy", ground: true, pts: [[7.45, 4.7], [7.9, 4.5], [8.4, 4.7], [8.58, 5.4], [8.5, 6.2], [8.1, 6.75], [7.55, 6.6], [7.35, 5.85], [7.45, 4.7]] },
  { id: "punesouth", name: "Pune–Bengaluru Highway", cls: "hwy", ground: true, rimB: true, pts: [[8.1, 6.75], [8.2, 7.1], [8.3, 7.4], [8.38, 7.62]] },
  { id: "puneeast", name: "Pune–Solapur Road", cls: "hwy", ground: true, rimB: true, pts: [[8.5, 5.5], [8.56, 5.55]] },
];

// the 2046 additions (km): the coastal road continued north, a ring road, and the tunnel line
const AUTHORED_2046 = [
  { id: "coastal", name: "Mumbai Coastal Road North", cls: "hwy", ground: true, scenic: true, pts: [[1.32, 2.78], [1.2, 2.5], [1.08, 2.1], [0.96, 1.7], [0.88, 1.25], [0.82, 0.85], [0.78, 0.2], [0.8, -0.5]], deck: 14 },
  { id: "ring", name: "Navi Mumbai Ring Expressway", cls: "hwy", ground: true, pts: [[4.1, 1.7], [4.3, 2.4], [4.9, 2.9], [5.1, 3.6], [4.8, 4.3], [4.6, 4.9]], deck: 12 },
  { id: "hyper", name: "Hyperloop Spine Road", cls: "hwy", ground: true, pts: [[3.3, 0.55], [3.9, 0.3], [4.6, 0.2], [5.2, 0.6]] },
];
const TUNNEL_PTS = [[1.46, 0.98], [1.8, 0.9], [2.2, 0.9], [2.6, 0.96], [3.02, 1.1]];

// ---- helpers ---------------------------------------------------------------------------------------------------
function catmull(pts, step) {
  const out = []; const n = pts.length;
  const get = (i) => pts[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]); const m = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k < m; k++) {
      const t = k / m, t2 = t * t, t3 = t2 * t;
      out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]);
    }
  }
  out.push(pts[n - 1].slice()); return out;
}
function smooth(arr, half) { // moving average
  const n = arr.length, out = new Float32Array(n), pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + arr[i];
  for (let i = 0; i < n; i++) { const a = Math.max(0, i - half), b = Math.min(n - 1, i + half); out[i] = (pre[b + 1] - pre[a]) / (b - a + 1); }
  return out;
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function buildCity(seed = 7, era = "now") {
  const F = era === "2046"; const WID = F ? { hwy: 30, art: 19, str: 11.5 } : { hwy: CLS.hwy.w, art: CLS.art.w, str: CLS.str.w };
  const rnd = mulberry(seed * 7919 + 13);
  const roads = [];
  const STEP = 10;

  function addRoad(def) {
    const base = def.raw ? def.raw : def.pts.map(conv);
    const pts = def.raw ? base : catmull(base, STEP);
    // resample to an even spacing
    // (walk the polyline from the PREVIOUS source point, carrying the distance left over, so every sample is exactly STEP apart along the line;
    //  the old version measured from the last sample instead and left a trail of 0-6 m stubs, each of which was a vertical step in the road surface)
    const ev = [pts[0]]; let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      let px = pts[i - 1][0], pz = pts[i - 1][1]; const qx = pts[i][0], qz = pts[i][1];
      let d = Math.hypot(qx - px, qz - pz);
      while (d >= STEP - acc && d > 1e-6) { const t = (STEP - acc) / d; px += (qx - px) * t; pz += (qz - pz) * t; ev.push([px, pz]); d = Math.hypot(qx - px, qz - pz); acc = 0; }
      acc += d;
    }
    const last = pts[pts.length - 1]; if (Math.hypot(last[0] - ev[ev.length - 1][0], last[1] - ev[ev.length - 1][1]) > 3) ev.push(last);
    if (ev.length < 3) return null;
    const r = { id: def.id || `r${roads.length}`, idx: roads.length, name: def.name || "Street", cls: def.cls, width: def.width || WID[def.cls], tunnel: !!def.tunnel, ground: !!def.ground, scenic: !!def.scenic, hill: !!def.hill, deck: def.deck, ramp: def.ramp || null, rimA: !!def.rimA, rimB: !!def.rimB, pts: ev.map(([x, z]) => ({ x, z, y: 0, s: 0, w: 0 })), len: 0 };
    roads.push(r); return r;
  }

  // ---- 1. authored + generated roads -------------------------------------------------------------------------
  for (const a of AUTHORED) addRoad(a);
  if (F) {
    for (const a of AUTHORED_2046) addRoad(a);
    // Goregaon–Mulund twin tunnels under the Sanjay Gandhi National Park: two bores side by side
    const mid = catmull(TUNNEL_PTS.map(conv), STEP);
    for (const side of [-1, 1]) {
      const raw = mid.map((p, i) => { const a = mid[Math.max(0, i - 1)], b = mid[Math.min(mid.length - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; return [p[0] + (-dz / l) * 19 * side, p[1] + (dx / l) * 19 * side]; });
      addRoad({ id: side < 0 ? "tunnelA" : "tunnelB", name: "Goregaon–Mulund Twin Tunnel", cls: "hwy", width: 14, raw, ground: true, tunnel: true });
    }
  }
  const nAuth = roads.length; 

  // lattice: arterials and streets in several zones, each with its own grid direction. A zone only walks its own bounding box.
  const R4 = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]].map(conv);
  const PUNE = R4(6.9, 4.35, 8.65, 7.5);
  const ZONES = [
    { poly: WEST_LAND, ang: 0.2, art: 400, str: 134, wob: 16, name: "Mumbai", hmax: 48 },
    { poly: EAST_LAND, not: PUNE, ang: 0.42, art: 420, str: 140, wob: 0, name: "Navi Mumbai", hmax: 48 },
    { poly: PORT_LAND, ang: 0.0, art: 460, str: 170, wob: 0, name: "Port", hmax: 48 },
    { poly: PUNE, ang: -0.32, art: 400, str: 136, wob: 12, name: "Pune", hmax: 70 },
  ];
  function latticeAllowed(x, z, cls, zone) {
    if (x < 90 || z < 90 || x > W - 90 || z > W - 90) return false;
    if (!pip(zone.poly, x, z)) return false;
    if (zone.not && pip(zone.not, x, z)) return false;
    if (shoreDist(x, z) < 45) return false;
    if (inAirport(x, z, 60)) return false;
    const d = districtDens(x, z);
    if (d < (cls === "art" ? 0.22 : 0.3)) return false;
    if (baseH(x, z) > zone.hmax) return false;
    return true;
  }
  for (const zone of ZONES) {
    const c = Math.cos(zone.ang), s = Math.sin(zone.ang);
    // bounding box of the zone polygon in the zone's own (u across, t along) frame
    const frame = (dir) => { const dx = dir ? -s : c, dz = dir ? c : s, nx = dir ? c : -s, nz = dir ? s : c; let u0 = 1e9, u1 = -1e9, t0 = 1e9, t1 = -1e9; for (const [px, pz] of zone.poly) { const u = nx * (px - W / 2) + nz * (pz - W / 2), t = dx * (px - W / 2) + dz * (pz - W / 2); u0 = Math.min(u0, u); u1 = Math.max(u1, u); t0 = Math.min(t0, t); t1 = Math.max(t1, t); } return { dx, dz, nx, nz, u0, u1, t0, t1 }; };
    for (const cls of ["art", "str"]) {
      const sp = cls === "art" ? zone.art : zone.str;
      for (const dir of [0, 1]) {
        const { dx, dz, nx, nz, u0, u1, t0, t1 } = frame(dir);
        const jitterSeed = dir * 31 + (cls === "art" ? 5 : 9);
        for (let u = Math.floor((u0 - sp) / sp) * sp; u <= u1 + sp; u += sp) {
          if (cls === "str" && Math.abs(((u % zone.art) + zone.art) % zone.art) < 6) continue; // sit on top of arterial
          let run = null; const flush = () => { if (run && run.length >= 8) addRoad({ raw: run.slice(), cls, name: cls === "art" ? "Avenue" : "Lane", lat: true }); run = null; };
          for (let t = t0 - 40; t <= t1 + 40; t += 18) {
            let wob = 0; if (zone.wob) wob = (vnoise(t * 0.004, u * 0.01 + 3, jitterSeed) - 0.5) * zone.wob * 2;
            const x = W / 2 + nx * (u + wob) + dx * t, z = W / 2 + nz * (u + wob) + dz * t;
            if (x < -50 || z < -50 || x > W + 50 || z > W + 50) { flush(); continue; }
            if (latticeAllowed(x, z, cls, zone)) { if (!run) run = []; run.push([x, z]); } else flush();
          }
          flush();
        }
      }
    }
  }

  // ---- 2. heights ------------------------------------------------------------------------------------------------
  for (const r of roads) {
    const n = r.pts.length;
    let s = 0;
    for (let i = 0; i < n; i++) { if (i) s += Math.hypot(r.pts[i].x - r.pts[i - 1].x, r.pts[i].z - r.pts[i - 1].z); r.pts[i].s = s; }
    r.len = s;
    const g = new Float32Array(n), raw = new Float32Array(n), urban = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = r.pts[i]; const sd = shoreDist(p.x, p.z);
      g[i] = sd < 0 ? 1.0 : baseH(p.x, p.z);
      raw[i] = sd < 12 ? 1 : 0;
      urban[i] = districtDens(p.x, p.z) > 0.35 ? 1 : 0;
    }
    let gs = smooth(smooth(smooth(g, r.hill ? 12 : 10), 7), 4); // long, soft rolling profile: no bumps or sudden crests
    if (true) { // authored roads: no wall-steep climbs
      const maxG = (r.hill ? 0.06 : r.cls === "str" ? 0.03 : 0.04) * STEP; const ys = Array.from(gs);
      for (let it = 0; it < 3; it++) { for (let i = 1; i < n; i++) ys[i] = clamp(ys[i], ys[i - 1] - maxG, ys[i - 1] + maxG); for (let i = n - 2; i >= 0; i--) ys[i] = clamp(ys[i], ys[i + 1] - maxG, ys[i + 1] + maxG); }
      gs = smooth(smooth(Float32Array.from(ys), 4), 3); // round off any corner the slope limiter left
    }
    if (r.tunnel) { // the bore dips under the hill: portals at ground level, the middle well below the surface
      const yA = gs[0] + 0.12, yB = gs[n - 1] + 0.12; let first = -1, last = -1;
      for (let i = 0; i < n; i++) { const p = r.pts[i]; const f = p.s / r.len; p.g = gs[i] + 0.12; p.y = yA + (yB - yA) * f - 7 * Math.sin(Math.PI * f); p.w = 0; p.tun = false; if (baseH(p.x, p.z) - p.y > 4.5) { if (first < 0) first = i; last = i; } }
      for (let i = first; i >= 0 && i <= last; i++) r.pts[i].tun = true;
      r.tunFrom = first; r.tunTo = last; r.hasTunnel = first >= 0; continue;
    }
    const deckH = r.deck || CLS[r.cls].deck;
    let w = raw;
    if (r.cls === "hwy" && !r.ground) { w = new Float32Array(n); for (let i = 0; i < n; i++) w[i] = Math.max(raw[i], urban[i] * 0.55); }
    const ramp = r.cls === "hwy" ? 11 : 10;
    const ws = smooth(smooth(w, ramp), ramp >> 1);
    for (let i = 0; i < n; i++) {
      const p = r.pts[i]; const tp = r.idx < nAuth ? sstep(0, 190, Math.min(p.s, r.len - p.s)) : 1;
      p.w = ws[i] * (shoreDist(p.x, p.z) < 12 ? 1 : tp); p.g = gs[i] + 0.12; p.y = gs[i] + 0.12 + p.w * deckH;
    }
    // a road that is under water with no bridge weight (rare) is lifted to the deck
    for (let i = 0; i < n; i++) { const p = r.pts[i]; if (shoreDist(p.x, p.z) < 6 && p.y < 5) p.y = Math.max(p.y, 5); }
  }

  // ---- 3. spatial index ------------------------------------------------------------------------------------------
  const GC = 48;
  let segGrid = new Map();
  const key = (i, j) => i * 4096 + j;
  function indexRoad(rd) {
    for (let i = 0; i < rd.pts.length - 1; i++) {
      const a = rd.pts[i], b = rd.pts[i + 1]; const hw = rd.width / 2 + 4;
      const i0 = Math.floor((Math.min(a.x, b.x) - hw) / GC), i1 = Math.floor((Math.max(a.x, b.x) + hw) / GC), j0 = Math.floor((Math.min(a.z, b.z) - hw) / GC), j1 = Math.floor((Math.max(a.z, b.z) + hw) / GC);
      for (let ci = i0; ci <= i1; ci++) for (let cj = j0; cj <= j1; cj++) { const k = key(ci, cj); let l = segGrid.get(k); if (!l) segGrid.set(k, (l = [])); l.push(rd.idx * 65536 + i); }
    }
  }
  for (const rd of roads) indexRoad(rd);
  function nearSegs(x, z, rad, fn) {
    const i0 = Math.floor((x - rad) / GC), i1 = Math.floor((x + rad) / GC), j0 = Math.floor((z - rad) / GC), j1 = Math.floor((z + rad) / GC);
    for (let ci = i0; ci <= i1; ci++) for (let cj = j0; cj <= j1; cj++) { const l = segGrid.get(key(ci, cj)); if (!l) continue; for (const v of l) fn(roads[v >> 16], v & 65535); }
  }
  // closest point on a segment
  function seg(r, i, x, z) {
    const a = r.pts[i], b = r.pts[i + 1]; const dx = b.x - a.x, dz = b.z - a.z; const L2 = dx * dx + dz * dz;
    let t = L2 > 0 ? ((x - a.x) * dx + (z - a.z) * dz) / L2 : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = a.x + dx * t, pz = a.z + dz * t;
    return { t, px, pz, d: Math.hypot(x - px, z - pz), y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t };
  }
  const city = { roads, nAuth, segGrid, nearSegs, seg };

  // ---- grade separation ------------------------------------------------------------------------------------------------------------------
  // Every place two roads cross must be one of two things: a level junction (both surfaces exactly the same plane) or a proper flyover with headroom.
  //  - two roads that both lie on the ground are one junction, however differently their long profiles rolled over the hills: they are pulled together,
  //    each easing back to its own profile at about a 4% grade;
  //  - a raised road that passes less than HEADROOM above another is lifted over it, with a gentle ramp-up (about 3%) on either side;
  //  - anything closer than 1.5 m is simply one junction.
  function levelCrossings(iters, relax = 0) {
    const X = []; const seenX = new Set();
    const yAt = (r, pos) => { const n = r.pts.length; const k = Math.max(0, Math.min(n - 2, Math.floor(pos))); const f = Math.max(0, Math.min(1, pos - k)); return r.pts[k].y + (r.pts[k + 1].y - r.pts[k].y) * f; };
    const ptAt = (r, pos) => r.pts[Math.max(0, Math.min(r.pts.length - 1, Math.round(pos)))];
    const addX = (a, pa, b, pb) => { const pp = ptAt(a, pa); const k = a.idx + ":" + b.idx + ":" + Math.round(pp.x / 16) + ":" + Math.round(pp.z / 16); if (seenX.has(k)) return; seenX.add(k); X.push({ a, pa, b, pb }); };
    for (const r of roads) { if (r.tunnel) continue;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const a = r.pts[i], b = r.pts[i + 1];
        nearSegs((a.x + b.x) / 2, (a.z + b.z) / 2, 14, (r2, j) => {
          if (r2.idx <= r.idx || r2.tunnel) return; const c = r2.pts[j], d = r2.pts[j + 1];
          const rx = b.x - a.x, rz = b.z - a.z, sx = d.x - c.x, sz = d.z - c.z; const den = rx * sz - rz * sx; if (Math.abs(den) < 1e-6) return;
          const t = ((c.x - a.x) * sz - (c.z - a.z) * sx) / den, u = ((c.x - a.x) * rz - (c.z - a.z) * rx) / den; if (t < -0.04 || t > 1.04 || u < -0.04 || u > 1.04) return;
          addX(r, i + Math.max(0, Math.min(1, t)), r2, j + Math.max(0, Math.min(1, u)));
        });
      }
      // a road that ends against the side of another one (a T) is a junction too
      for (const e of [0, r.pts.length - 1]) { const p = r.pts[e]; nearSegs(p.x, p.z, 16, (r2, j) => { if (r2 === r || r2.tunnel) return; const q = seg(r2, j, p.x, p.z); if (q.d > r2.width / 2 + 1.0) return; addX(r, e, r2, j + q.t); }); }
    }
    const wgt = (r) => (r.ramp ? 0.5 : r.cls === "hwy" ? 3 : r.cls === "art" ? 2 : 1);
    let moved = 0; const over = [], tieList = [];
    const pinLoop = (iters, first) => {
    for (let it = 0; it < iters; it++) {
      for (const r of roads) for (const p of r.pts) p.gd = !p.tun && p.w <= 0.35 && p.y - p.g <= 2.8;
      const pins = new Map(), lifts = new Map(); const put = (m, r, o) => { let l = m.get(r); if (!l) m.set(r, (l = [])); l.push(o); };
      for (const x of X) {
        const ya = yAt(x.a, x.pa), yb = yAt(x.b, x.pb), dy = ya - yb, ad = Math.abs(dy);
        const ga = ptAt(x.a, x.pa).gd, gb = ptAt(x.b, x.pb).gd; const hwj = Math.max(x.a.width, x.b.width) / 2 + 3;
        if (ad < 1.5 || (ga && gb && ad < MERGE_MAX)) {
          if (ad < 0.01) continue; const wa = wgt(x.a), wb = wgt(x.b), ym = (ya * wa + yb * wb) / (wa + wb);
          put(pins, x.a, { pos: x.pa, y: ym, hw: hwj }); put(pins, x.b, { pos: x.pb, y: ym, hw: hwj });
        } else if (ad < HEADROOM) {
          const aUp = dy > 0; const up = aUp ? x.a : x.b, upPos = aUp ? x.pa : x.pb, lo = aUp ? x.b : x.a, loPos = aUp ? x.pb : x.pa;
          put(lifts, up, { pos: upPos, y: Math.min(ya, yb) + HEADROOM, hw: lo.width / 2 + 7 });
          if ((first && it === 0)) over.push({ up, upPos, lo, loPos });
        }
        if ((first && it === 0) && (ad < 1.5 || (ga && gb && ad < MERGE_MAX))) tieList.push(x);
      }
      let any = 0;
      const touched = new Set([...pins.keys(), ...lifts.keys()]);
      for (const r of touched) {
        const n = r.pts.length, dP = new Float32Array(n), dL = new Float32Array(n);
        const ps = pins.get(r), ls = lifts.get(r);
        if (ps) {
          const info = ps.map((q) => ({ pos: q.pos, dl: q.y - yAt(r, q.pos), core: Math.max(1.7, q.hw / STEP), fall: Math.min(45, Math.max(5, Math.abs(q.y - yAt(r, q.pos)) * 2.6)) }));
          const prof = (q, k) => { const dd = Math.abs(k - q.pos) - q.core; if (dd <= 0) return 1; if (dd >= q.fall) return 0; const u = dd / q.fall; return 1 - u * u * (3 - 2 * u); };
          for (let k = 0; k < n; k++) {
            let owner = -1; for (let m = 0; m < info.length; m++) if (Math.abs(k - info[m].pos) <= info[m].core) { owner = m; break; }
            if (owner >= 0) { dP[k] = info[owner].dl; continue; }
            let num = 0, den = 0; for (const q of info) { const w = prof(q, k); if (w > 0) { num += w * q.dl; den += w; } }
            if (den > 0) dP[k] = num / Math.max(1, den);
          }
        }
        if (ls) for (const q of ls) {
          const dl = q.y - yAt(r, q.pos); if (dl <= 0.02) continue; const core = Math.max(1.5, q.hw / STEP), fall = Math.min(60, Math.max(6, dl * 3.2));
          const k0 = Math.max(0, Math.floor(q.pos - core - fall)), k1 = Math.min(n - 1, Math.ceil(q.pos + core + fall));
          for (let k = k0; k <= k1; k++) { const dd = Math.abs(k - q.pos) - core; const w = dd <= 0 ? 1 : dd >= fall ? 0 : 1 - (dd / fall) * (dd / fall) * (3 - 2 * dd / fall); if (dl * w > dL[k]) dL[k] = dl * w; }
        }
        for (let k = 0; k < n; k++) { const dy2 = dP[k] + dL[k]; if (!dy2) continue; const p = r.pts[k]; p.y += dy2; if (p.gd) p.g += dP[k]; moved += Math.abs(dy2); any++; }
      }
      if (!any) break;
    }
    };
    pinLoop(iters, true);
    // The pins above get every crossing right but can leave a short steep stretch where neighbouring crossings disagree (hill roads that were drawn
    // independently). Relax: smooth every profile a little, then pull each pair of crossing roads back together, over and over, so the disagreement is shared
    // out along the roads instead of being squeezed into a few metres. Flyover decks hold their height; roads on the ground are free to move.
    if (relax) {
      const R = roads.filter((r) => !r.tunnel); const ri = new Map(R.map((r, i) => [r, i]));
      for (const r of R) for (const p of r.pts) p.gd = !p.tun && p.w <= 0.35 && p.y - p.g <= 2.8;
      const Y = R.map((r) => Float64Array.from(r.pts, (p) => p.y)), Y0 = Y.map((a) => Float64Array.from(a));
      const AN = R.map((r) => Float32Array.from(r.pts, (p) => (p.gd ? 0.004 : 0.3)));
      const val = (a, pos) => { const n = Y[a].length; const k = Math.max(0, Math.min(n - 2, Math.floor(pos))); const f = Math.max(0, Math.min(1, pos - k)); return [k, f, Y[a][k] * (1 - f) + Y[a][k + 1] * f]; };
      const ties = tieList.map((x) => ({ a: ri.get(x.a), pa: x.pa, b: ri.get(x.b), pb: x.pb, wa: wgt(x.a), wb: wgt(x.b) })).filter((t) => t.a !== undefined && t.b !== undefined);
      const lf = over.map((o) => ({ u: ri.get(o.up), pu: o.upPos, l: ri.get(o.lo), pl: o.loPos })).filter((t) => t.u !== undefined && t.l !== undefined);
      const push = (a, k, f, d) => { const q = (1 - f) * (1 - f) + f * f; Y[a][k] += d * (1 - f) / q; Y[a][k + 1] += d * f / q; };
      for (let sw = 0; sw < relax; sw++) {
        for (let a = 0; a < Y.length; a++) {
          const y = Y[a], y0 = Y0[a], an = AN[a], n = y.length; let prev = y[0];
          for (let k = 1; k < n - 1; k++) { const cur = y[k]; y[k] = cur + 0.45 * (0.5 * (prev + y[k + 1]) - cur) + an[k] * (y0[k] - cur); prev = cur; }
        }
        for (const t of ties) {
          const [ka, fa, ya] = val(t.a, t.pa), [kb, fb, yb] = val(t.b, t.pb); const m = (ya * t.wa + yb * t.wb) / (t.wa + t.wb);
          push(t.a, ka, fa, m - ya); push(t.b, kb, fb, m - yb);
        }
        for (const l of lf) { const [ku, fu, yu] = val(l.u, l.pu), [, , yl] = val(l.l, l.pl); const def = HEADROOM + 0.15 - (yu - yl); if (def > 0) push(l.u, ku, fu, def); }
      }
      let mv = 0, mx2 = 0; R.forEach((r, a) => { for (let k = 0; k < r.pts.length; k++) { const p = r.pts[k], d = Y[a][k] - p.y; if (d) { mv++; mx2 = Math.max(mx2, Math.abs(d)); if (p.gd) p.g += d; p.y = Y[a][k]; } } });
      pinLoop(6, false);
    }
    for (const r of roads) for (const p of r.pts) delete p.gd;
    return moved;
  }

  // ground height: the natural land, cut / filled flat under every road with a level shoulder and a gentle embankment beyond it.
  //  - a point under several roads (an underpass, a flyover crossing a street) takes the LOWEST of them, so a road is never buried by the land raised for another;
  //  - the land is never allowed above the underside of any road deck over it, and never above the surface of a road it lies under;
  //  - the land climbs away from the shoulder at a fixed slope instead of a cliff, so the coarse terrain mesh cannot poke through a road edge.
  const SHOULDER = 6, EMB = 0.8, REACH = 48;
  city.groundH = (x, z) => {
    const b = baseH(x, z);
    if (b < -0.5) return b;
    let lowY = 1e9, lowBd = 1e9, cap = 1e9, ws = 0, wt = 0, nearBd = 1e9;
    nearSegs(x, z, REACH, (r, i) => {
      const a = r.pts[i]; if (a.tun) return;
      const q = seg(r, i, x, z); const edge = q.d - r.width / 2;
      const ground = a.w <= 0.35 && a.y - a.g <= 2.8 && !a.over;
      if (ground) {
        const bd = edge > 0 ? edge : 0;
        if (bd < 3.5) { if (q.y < lowY) lowY = q.y; if (bd < lowBd) lowBd = bd; } // the lowest road within reach of this spot owns the land under it
        if (edge < REACH) { const T = q.y - 0.12; const rel = b - T; const lim = bd > SHOULDER ? EMB * (bd - SHOULDER) : 0; const c = T + (rel > lim ? lim : rel < -lim ? -lim : rel); const k = bd + 1.2; const wgt = 1 / (k * k * k); ws += c * wgt; wt += wgt; if (bd < nearBd) nearBd = bd; }
        if (edge < 1.5) { const c2 = q.y - 0.12; if (c2 < cap) cap = c2; }
      } else if (edge < 2.5) { const c2 = q.y - 1.5; if (c2 < cap) cap = c2; }
    });
    let g = b;
    if (wt > 0) {
      let carved = ws / wt;
      if (lowY < 1e8) { const cov = 1 - sstep(0, 3.5, lowBd); carved = (lowY - 0.12) * cov + carved * (1 - cov); }
      const rel = sstep(REACH * 0.65, REACH, nearBd); g = carved + (b - carved) * rel;
    }
    return g > cap ? cap : g;
  };
  // the terrain mesh is sunk a little under every road so grass can never poke through the tarmac or the car
  city.terrainH = (x, z) => {
    let g = city.groundH(x, z); if (g < -0.5) return g;
    const CELL = 256 / city.TN;
    let bd = 1e9, T = 0; nearSegs(x, z, CELL * 1.5 + 6, (r, i) => { const a = r.pts[i]; if (a.tun || a.over || a.w > 0.35 || a.y - a.g > 2.8) return; const q = seg(r, i, x, z); const edge = q.d - r.width / 2; if (edge < bd) { bd = edge; T = q.y - 0.12; } });
    // a mesh vertex just outside a road edge may not stand higher than the triangle that spans the edge can allow, or the land pokes through the tarmac
    { const Lm = CELL * 1.42; if (bd > 0 && bd < Lm * 0.95) { const allow = T - 0.55 + 0.62 * Lm / (Lm - bd); if (g > allow) g = allow; } }
    return g - 0.55 * (1 - sstep(0, 7, Math.max(0, bd)));
  };
  // exactly the height of the drawn terrain triangles (24 x 24 cells per 256 m chunk), so a car off the tarmac sits ON the grass it sees
  city.TN = 32; // terrain mesh cells per 256 m chunk (chunks3d draws exactly this grid)
  city.meshH = (x, z) => {
    const cell = 256 / city.TN; const gi = Math.floor(x / cell), gj = Math.floor(z / cell); const fx = x / cell - gi, fz = z / cell - gj;
    const ha = city.terrainH(gi * cell, gj * cell), hb = city.terrainH((gi + 1) * cell, gj * cell), hc = city.terrainH(gi * cell, (gj + 1) * cell), hd = city.terrainH((gi + 1) * cell, (gj + 1) * cell);
    return fx + fz <= 1 ? ha + fx * (hb - ha) + fz * (hc - ha) : hd + (1 - fx) * (hc - hd) + (1 - fz) * (hb - hd);
  };
  // the surface a car at (x,z,yRef) is on.
  // Upgrade 26: every road offers just one candidate - the bit of it nearest the car - so the stretch of ramp behind or ahead can never be picked by
  // mistake (that made the ground stair-step under a climbing car). A road that doubles back over itself may offer two. A surface more than `step` (3 m)
  // above the car is overhead, not underfoot (a real underpass has more than 5 m of headroom), and one more than 4.5 m below is out of reach (the car drops). Among the rest the car
  // takes the road whose lane it is in (nearest its centre line, then nearest in height), with a bonus for the road it is already on.
  const SA_R = [], SA_Q = [], SA_I = [];
  city.surfaceAt = (x, z, yRef = 0, prefRoad = null, step = 3.0) => {
    let n = 0;
    nearSegs(x, z, 14, (r, i) => {
      const q = seg(r, i, x, z); if (q.d > r.width / 2 + 0.6) return;
      for (let k = 0; k < n; k++) if (SA_R[k] === r && Math.abs(SA_Q[k].y - q.y) < 2.5) { if (q.d < SA_Q[k].d) { SA_Q[k] = q; SA_I[k] = i; } return; }
      SA_R[n] = r; SA_Q[n] = q; SA_I[n] = i; n++;
    });
    let bi = -1, bs = 1e9;
    for (let k = 0; k < n; k++) {
      const r = SA_R[k], q = SA_Q[k]; if (q.y > yRef + step || yRef - q.y > 4.5) continue;
      const sc = Math.abs(q.y - yRef) + (q.d / (r.width / 2)) * 2.2 - (r.ramp ? 0.8 : 0) - (r === prefRoad ? 1.6 : 0);
      if (sc < bs) { bs = sc; bi = k; }
    }
    if (bi < 0) return null;
    const q = SA_Q[bi];
    return { road: SA_R[bi], i: SA_I[bi], t: q.t, y: q.y, d: q.d, off: q.d, w: q.w, px: q.px, pz: q.pz };
  };
  // true when another road runs through this spot at a lower level than `topY` (so a pillar / lamp / tree here would stand in the traffic)
  city.blockedByRoad = (x, z, topY, own, margin = 1.4, minY = -1e9, ownI = -1) => {
    let hit = false;
    nearSegs(x, z, 16, (r, i) => {
      if (hit) return; if (r === own && (ownI < 0 || Math.abs(i - ownI) < 16)) return; const a = r.pts[i]; if (a.tun) return;
      const q = seg(r, i, x, z); if (q.d > r.width / 2 + margin) return;
      if (q.y < topY - 1.0 && q.y > minY) hit = true;
    });
    return hit;
  };
  // true when another road passes OVER this spot within `hgt` metres above y0 (a lamp post here would stick through its deck)
  city.blockedAbove = (x, z, y0, hgt, own, margin = 1.0) => {
    let hit = false;
    nearSegs(x, z, 16, (r, i) => {
      if (hit || r === own) return; const a = r.pts[i]; if (a.tun) return;
      const q = seg(r, i, x, z); if (q.d > r.width / 2 + margin) return;
      if (q.y > y0 + 0.8 && q.y < y0 + hgt + 2.5) hit = true;
    });
    return hit;
  };
  city.nearestRoad = (x, z, rad = 200, filter = null, yRef = null) => {
    let best = null, bd = 1e9;
    nearSegs(x, z, rad, (r, i) => { if (filter && !filter(r)) return; const q = seg(r, i, x, z); const dd = q.d + (yRef == null ? 0 : Math.abs(q.y - yRef) * 3); if (dd < bd) { bd = dd; best = { road: r, i, t: q.t, x: q.px, z: q.pz, y: q.y, d: q.d, w: q.w }; } });
    return best;
  };

  // ---- 3b. on- and off-ramps so the elevated highways can be reached ---------------------------------------------------
  // Each ramp leaves the outer lane of the flyover, swings clear of it and comes down at a gentle, even grade (about 6% at most) to a street at ground level.
  // A candidate path is thrown away if it would touch any other road or the sea, so a ramp can never pile onto traffic below it.
  const MERGE_MAX = 4.0; // two ground roads that differ by more than this at a crossing are treated as a bridge, not squeezed into one junction
  const HEADROOM = 7.4; // top of the lower road to the top of the deck above it: 5.8 m clear under a 1.3 m slab
  const RAMP_CANDS = []; for (const ah of [190, 220, 255, 290, 330, 370, 420, 470, 530, 600, 680]) for (const lat of [28, 45, 65, 90, 120, 160, 210, 270]) RAMP_CANDS.push([ah, lat]); RAMP_CANDS.sort((a, b) => a[0] + a[1] * 0.6 - (b[0] + b[1] * 0.6));
  {
    const groundish = (rd, i) => rd.pts[i].w < 0.25 && rd.pts[i].y - rd.pts[i].g < 1.5;
    const highs = roads.filter((rd, ix) => ix < nAuth && rd.cls === "hwy" && !rd.tunnel);
    const Wr = WID.art, Rr = Wr / 2; let side = 1;
    for (const h of highs) {
      let lastI = -999; const Hh = h.width / 2;
      for (let i = 14; i < h.pts.length - 14; i++) {
        const p = h.pts[i]; if (p.y - p.g < 5 || i - lastI < 44) continue;
        const pa = h.pts[i - 5], pb = h.pts[i + 12]; if (pa.y - pa.g < 4 || pb.y - pb.g < 4) continue; // the deck must be raised along the stretch where the ramp peels off
        const q = h.pts[i + 1], t = Math.hypot(q.x - p.x, q.z - p.z) || 1; const tx = (q.x - p.x) / t, tz = (q.z - p.z) / t;
        let made = null;
        for (const sd of [side, -side]) {
          const nx = -tz * sd, nz = tx * sd;
          for (const [ah, lat] of RAMP_CANDS) {
            const X = p.x + tx * ah + nx * lat, Z = p.z + tz * ah + nz * lat;
            const nr = city.nearestRoad(X, Z, 40, (rd) => rd.cls !== "hwy" && !rd.ramp && !rd.tunnel, null);
            if (!nr || nr.d > 30) { continue; } const pt = nr.road.pts[nr.i]; if (!groundish(nr.road, nr.i) || p.y - pt.y < 4) { continue; }
            const F = { x: nr.x, z: nr.z, y: nr.y, road: nr.road };
            if ((F.x - p.x) * tx + (F.z - p.z) * tz < 150) { continue; } // the street must lie well ahead, or the ramp would have to double back
            if ((p.y - F.y) / (Math.hypot(F.x - p.x, F.z - p.z) * 1.12) > 0.07) { continue; } // cheap steepness test before drawing the path
            const o0 = Hh * 0.55, lat2 = Hh + Rr + 3;
            const P0 = [p.x + nx * o0, p.z + nz * o0], P1 = [p.x + tx * 45 + nx * (o0 + 4), p.z + tz * 45 + nz * (o0 + 4)], P2 = [p.x + tx * 115 + nx * lat2, p.z + tz * 115 + nz * lat2];
            const mid = [(P2[0] + F.x) / 2 + nx * 6, (P2[1] + F.z) / 2 + nz * 6];
            const poly = catmull([P0, P1, P2, mid, [F.x, F.z]], STEP);
            let L = 0; for (let k = 1; k < poly.length; k++) L += Math.hypot(poly[k][0] - poly[k - 1][0], poly[k][1] - poly[k - 1][1]);
            if ((p.y - F.y) / L > 0.07) { continue; } // too steep: try a longer one
            // the whole path must stay clear of the sea and of every other road: it may pass over one only with real headroom (and never within the last stretch,
            // where it has come down to street level), it may leave the flyover it starts on and may join the street it ends on
            let ok = true, acc = 0;
            for (let k = 0; k < poly.length && ok; k++) {
              if (k) acc += Math.hypot(poly[k][0] - poly[k - 1][0], poly[k][1] - poly[k - 1][1]);
              if ((k & 1) && k < poly.length - 1) continue; // every other sample (~20 m) is plenty
              const [x, z] = poly[k]; if (isWater(x, z) || shoreDist(x, z) < 12) { ok = false; break; }
              const toF = L - acc, u = acc / L, yR = p.y + (F.y - p.y) * (0.78 * u + 0.22 * sstep(0, 1, u));
              city.nearSegs(x, z, 30, (r2, j) => {
                if (!ok || r2.tunnel) return; const qq = city.seg(r2, j, x, z);
                if (r2 === h) { if (acc > 125 && qq.d < Hh + Rr + 0.8) ok = false; return; }
                if (r2 === F.road && toF < 70) return;
                if (qq.d < r2.width / 2 + Rr + 3 && yR - qq.y < HEADROOM + 0.8) ok = false;
              });
            }
            if (!ok) { continue; }
            made = { poly, F, sd }; break;
          }
          if (made) break;
        }
        if (!made) { i += 3; continue; } // nothing fits here: try again a few points further on
        const { poly, F } = made;
        const rr = addRoad({ id: `ramp_${h.id}_${i}`, name: "Ramp", cls: "art", raw: poly, ramp: true, ground: true });
        if (!rr) continue; rr.attach = h.idx; rr.deckRoad = h; rr.streetRoad = F.road;
        let s2 = 0; rr.pts.forEach((pt, k) => { if (k) s2 += Math.hypot(pt.x - rr.pts[k - 1].x, pt.z - rr.pts[k - 1].z); pt.s = s2; }); rr.len = s2;
        const nP = rr.pts.length;
        // an even grade: mostly straight-line, a little eased at the ends, so there is no steep middle and no jolt where it meets the flyover or the street
        rr.pts.forEach((pt) => { const u = pt.s / s2; const f = 0.78 * u + 0.22 * sstep(0, 1, u); pt.y = p.y + (F.y - p.y) * f; pt.g = baseH(pt.x, pt.z) + 0.12; });
        for (let pass = 0; pass < 3; pass++) {
          // never let the land beside the ramp rise above the road (hill tops swallowed the car): lift the road over it, fading out at both ends
          for (let k = 0; k < nP; k++) {
            const pt = rr.pts[k], a2 = rr.pts[Math.max(0, k - 1)], b2 = rr.pts[Math.min(nP - 1, k + 1)];
            const dx = b2.x - a2.x, dz = b2.z - a2.z, l = Math.hypot(dx, dz) || 1, hwr = rr.width / 2 + 1.5;
            let need = -1e9; for (const o of [-hwr, 0, hwr]) need = Math.max(need, city.groundH(pt.x - dz / l * o, pt.z + dx / l * o) + 0.35);
            const fade = Math.min(sstep(0, 35, pt.s), sstep(0, 35, s2 - pt.s));
            pt._lift = Math.max(0, need - pt.y) * fade;
          }
          for (let it = 0; it < 4; it++) { const l2 = rr.pts.map((q2) => q2._lift); for (let k = 1; k < nP - 1; k++) rr.pts[k]._lift = Math.max(l2[k], (l2[k - 1] + l2[k] + l2[k + 1]) / 3); }
          rr.pts.forEach((pt) => { pt.y += pt._lift; delete pt._lift; });
        }
        for (let it = 0; it < 3; it++) { const ys = rr.pts.map((q2) => q2.y); for (let k = 1; k < nP - 1; k++) rr.pts[k].y = Math.max(ys[k], (ys[k - 1] + ys[k] * 2 + ys[k + 1]) / 4); }
        // the last stretch is at street level: no deck and no piers there
        rr.pts.forEach((pt) => { pt.g = Math.max(pt.g, pt.y - 6 * sstep(0, 70, s2 - pt.s)); pt.w = clamp((pt.y - pt.g) / 8, 0, 1); });
        indexRoad(rr); lastI = i; side = -made.sd;
      }
    }
  }
  levelCrossings(8);

  // ---- 4. graph: nodes where roads meet at the same height --------------------------------------------------------
  const NG = 40; const nkey2 = (i, j) => i * 4096 + j;
  function buildGraph() {
  const nodes = []; const nodeGrid = new Map();
  const nkey = (i, j) => i * 4096 + j;
  function nodeNear(x, z, y, rad = 7) {
    const i0 = Math.floor((x - rad) / NG), i1 = Math.floor((x + rad) / NG), j0 = Math.floor((z - rad) / NG), j1 = Math.floor((z + rad) / NG);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const l = nodeGrid.get(nkey(i, j)); if (!l) continue; for (const id of l) { const n = nodes[id]; if (Math.hypot(n.x - x, n.z - z) < rad && Math.abs(n.y - y) < 3.5) return n; } }
    return null;
  }
  function addNode(x, z, y) {
    const ex = nodeNear(x, z, y); if (ex) return ex;
    const n = { id: nodes.length, x, z, y, edges: [] }; nodes.push(n);
    const k = nkey(Math.floor(x / NG), Math.floor(z / NG)); let l = nodeGrid.get(k); if (!l) nodeGrid.set(k, (l = [])); l.push(n.id); return n;
  }
  // endpoints (every road ends in a node) — then crossings
  for (const r of roads) { const a = r.pts[0], b = r.pts[r.pts.length - 1]; addNode(a.x, a.z, a.y); addNode(b.x, b.z, b.y); }
  const seen = []; let seenN = 0;
  for (const r of roads) {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1];
      seenN = 0;
      nearSegs((a.x + b.x) / 2, (a.z + b.z) / 2, 8, (r2, j) => {
        if (r2.idx <= r.idx) return; const kk = r2.idx * 65536 + j; for (let q = 0; q < seenN; q++) if (seen[q] === kk) return; seen[seenN++] = kk;
        const c = r2.pts[j], d = r2.pts[j + 1];
        const den = (b.x - a.x) * (d.z - c.z) - (b.z - a.z) * (d.x - c.x); if (Math.abs(den) < 1e-6) return;
        const t = ((c.x - a.x) * (d.z - c.z) - (c.z - a.z) * (d.x - c.x)) / den, u = ((c.x - a.x) * (b.z - a.z) - (c.z - a.z) * (b.x - a.x)) / den;
        if (t < 0 || t > 1 || u < 0 || u > 1) return;
        const y1 = a.y + (b.y - a.y) * t, y2 = c.y + (d.y - c.y) * u; if (Math.abs(y1 - y2) > 3.2) return; // a flyover, not a junction
        addNode(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, (y1 + y2) / 2);
      });
    }
  }
  // each road: which nodes lie on it?
  const edges = [];
  for (const r of roads) {
    const hits = new Map();
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1];
      const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      const i0 = Math.floor((mx - 20) / NG), i1 = Math.floor((mx + 20) / NG), j0 = Math.floor((mz - 20) / NG), j1 = Math.floor((mz + 20) / NG);
      for (let ci = i0; ci <= i1; ci++) for (let cj = j0; cj <= j1; cj++) { const l = nodeGrid.get(nkey(ci, cj)); if (!l) continue; for (const id of l) {
        const n = nodes[id]; const q = seg(r, i, n.x, n.z); if (q.d > 6.5 || Math.abs(q.y - n.y) > 3.5) continue;
        const s = a.s + (b.s - a.s) * q.t; const prev = hits.get(id); if (!prev || q.d < prev.d) hits.set(id, { id, s, d: q.d, i: q.t > 0.5 ? i + 1 : i });
      } }
    }
    const list = [...hits.values()].sort((p, q) => p.s - q.s);
    // drop duplicates closer than 12 m
    const keep = []; for (const h of list) { if (keep.length && h.s - keep[keep.length - 1].s < 12) continue; keep.push(h); }
    r.nodes = keep;
    for (let k = 0; k < keep.length - 1; k++) {
      const A = keep[k], B = keep[k + 1]; if (B.s - A.s < 8) continue;
      const e = { id: edges.length, a: A.id, b: B.id, r: r.idx, i0: A.i, i1: B.i, s0: A.s, s1: B.s, len: B.s - A.s, cls: r.cls };
      edges.push(e); nodes[A.id].edges.push(e.id); nodes[B.id].edges.push(e.id);
    }
  }
  city.nodes = nodes; city.edges = edges; city.nodeNear = nodeNear; city.nodeGrid = nodeGrid;
  // keep only the largest connected piece (so races never route into islands)
  {
    const comp = new Int32Array(nodes.length).fill(-1); let nc = 0; const sizes = [];
    for (const n of nodes) { if (comp[n.id] >= 0) continue; const st = [n.id]; comp[n.id] = nc; let c = 0; while (st.length) { const v = st.pop(); c++; for (const eid of nodes[v].edges) { const e = edges[eid]; const o = e.a === v ? e.b : e.a; if (comp[o] < 0) { comp[o] = nc; st.push(o); } } } sizes.push(c); nc++; }
    let big = 0; sizes.forEach((s, i) => { if (s > sizes[big]) big = i; });
    city.mainComp = big; city.comp = comp; city.compSizes = sizes;
  }
  }

  // ---- graph helpers --------------------------------------------------------------------------------------------
  city.nearestNode = (x, z, rad0 = 400, maxRad = 8000) => {
    // look close first; if the spot is out on a long bridge or up a ghat, keep widening the search
    for (let rad = rad0; ; rad = Math.min(rad * 2, Math.max(rad0, maxRad))) {
      let best = null, bd = rad;
      const i0 = Math.floor((x - rad) / NG), i1 = Math.floor((x + rad) / NG), j0 = Math.floor((z - rad) / NG), j1 = Math.floor((z + rad) / NG);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const l = city.nodeGrid.get(nkey2(i, j)); if (!l) continue; for (const id of l) { const n = city.nodes[id]; if (city.comp[id] !== city.mainComp) continue; const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; best = n; } } }
      if (best || rad >= Math.max(rad0, maxRad)) return best;
    }
  };
  city.route = (from, to) => { // A* over nodes (binary heap); returns list of {edge, dir}
    if (from === to) return [];
    const heap = []; // [f, id]
    const push = (f, id) => { let i = heap.length; heap.push([f, id]); while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let l = 2 * i + 1, rr = l + 1, m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (rr < heap.length && heap[rr][0] < heap[m][0]) m = rr; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const g = new Map([[from.id, 0]]), came = new Map(); const closed = new Set();
    push(Math.hypot(from.x - to.x, from.z - to.z), from.id);
    while (heap.length) {
      const cur = pop()[1]; if (cur === to.id) break; if (closed.has(cur)) continue; closed.add(cur);
      for (const eid of city.nodes[cur].edges) {
        const e = city.edges[eid]; const o = e.a === cur ? e.b : e.a; if (closed.has(o)) continue;
        const cost = e.len / CLS[e.cls].speed * (roads[e.r].id.startsWith("link_") ? 3.5 : 1); const ng = g.get(cur) + cost;
        if (ng < (g.get(o) ?? 1e18)) { g.set(o, ng); came.set(o, { from: cur, e: eid, dir: e.a === cur ? 1 : -1 }); push(ng + Math.hypot(city.nodes[o].x - to.x, city.nodes[o].z - to.z), o); }
      }
    }
    if (!came.has(to.id)) return null;
    const out = []; let c = to.id; while (c !== from.id) { const q = came.get(c); out.push({ edge: q.e, dir: q.dir }); c = q.from; } return out.reverse();
  };
  // sample points along a route (for the GPS line, race checkpoints and AI)
  city.routePoints = (path, step = 1) => {
    const pts = [];
    for (const { edge, dir } of path) {
      const e = city.edges[edge], r = roads[e.r];
      const seq = []; for (let i = e.i0; i <= e.i1; i++) seq.push(r.pts[i]); if (dir < 0) seq.reverse();
      for (let k = 0; k < seq.length; k += step) { const p = seq[k]; if (pts.length && Math.abs(pts[pts.length - 1].x - p.x) < 0.01 && Math.abs(pts[pts.length - 1].z - p.z) < 0.01) continue; pts.push({ x: p.x, z: p.z, y: p.y, w: p.w, cls: r.cls, road: r.idx }); }
    }
    let s = 0; for (let i = 0; i < pts.length; i++) { if (i) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); pts[i].s = s; }
    return pts;
  };
  buildGraph();
  // dead-end repair: every road end that stops in the middle of nowhere gets tied into the nearest road that is roughly in front of it
  {
    const rimOK = (n) => Math.min(n.x, n.z, W - n.x, W - n.z) < 450;
    for (let pass = 0; pass < 3; pass++) {
      const nodes = city.nodes, edges = city.edges; let added = 0; const fixed = new Set();
      const ends = nodes.filter((n) => n.edges.length === 1 && !rimOK(n));
      for (const n of ends) {
        if (fixed.has(n.id)) continue;
        const e0 = edges[n.edges[0]], nb = nodes[e0.a === n.id ? e0.b : e0.a];
        let dx = n.x - nb.x, dz = n.z - nb.z; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
        const RAD = pass === 2 ? 1600 : pass ? 900 : 520; const cands = [];
        const i0 = Math.floor((n.x - RAD) / NG), i1 = Math.floor((n.x + RAD) / NG), j0 = Math.floor((n.z - RAD) / NG), j1 = Math.floor((n.z + RAD) / NG);
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const l = city.nodeGrid.get(i * 4096 + j); if (!l) continue; for (const id of l) {
          if (id === n.id || id === nb.id) continue; const m = nodes[id]; const d = Math.hypot(m.x - n.x, m.z - n.z); if (d < 22 || d > RAD) continue;
          const dy = Math.abs(m.y - n.y); if (dy > 3 + d * 0.06) continue;
          const cosA = ((m.x - n.x) * dx + (m.z - n.z) * dz) / d; if (cosA < (pass === 2 ? -0.7 : pass ? -0.2 : 0.25)) continue;
          if (m.edges.length === 0) continue;
          cands.push([d * (1.6 - cosA * 0.6) + dy * 6 + (m.edges.length === 1 ? 60 : 0), m]);
        } }
        cands.sort((u, v) => u[0] - v[0]);
        // try the best few: a link must stay out of the water and must not run along (or under) another road or a ramp
        let rr = null, m = null;
        for (const [, mc] of cands.slice(0, 6)) {
          let bad = false; for (let k = 0; k <= 6; k++) { const f = k / 6; if (isWater(n.x + (mc.x - n.x) * f, n.z + (mc.z - n.z) * f)) { bad = true; break; } }
          if (bad) continue;
          const dd = Math.hypot(mc.x - n.x, mc.z - n.z);
          const mid = [n.x + dx * Math.min(dd * 0.35, 90) + (mc.x - n.x) * 0.3, n.z + dz * Math.min(dd * 0.35, 90) + (mc.z - n.z) * 0.3];
          const cand = addRoad({ id: `fix_${n.id}`, name: "Link Street", cls: dd > 260 ? "art" : "str", raw: catmull([[n.x, n.z], [mid[0] * 0.5 + (n.x + mc.x) * 0.25, mid[1] * 0.5 + (n.z + mc.z) * 0.25], [mc.x, mc.z]], STEP), ground: true });
          if (!cand) continue;
          // how long does the new road stay on top of the same other road? crossing one takes a few points, running along it takes many
          let tooLong = false; const PP = cand.pts; const run = new Map();
          for (let k = 4; k < PP.length - 4 && !tooLong; k++) {
            if (inAirport(PP[k].x, PP[k].z, 40)) { tooLong = true; break; }
            const here = new Set();
            nearSegs(PP[k].x, PP[k].z, cand.width / 2 + 30, (r2, i2) => { if (here.has(r2.idx)) return; const q = seg(r2, i2, PP[k].x, PP[k].z); if (q.d < cand.width / 2 + r2.width / 2 + (r2.ramp ? 14 : 2.5)) here.add(r2.idx); });
            for (const id of here) { const c0 = (run.get(id) || 0) + 1; run.set(id, c0); if (c0 > (roads[id].ramp ? 3 : 8)) tooLong = true; }
          }
          if (tooLong) { roads.pop(); continue; }
          rr = cand; m = mc; break;
        }
        if (!rr) continue;
        let s = 0; rr.pts.forEach((pt, k) => { if (k) s += Math.hypot(pt.x - rr.pts[k - 1].x, pt.z - rr.pts[k - 1].z); pt.s = s; }); rr.len = s;
        rr.pts.forEach((pt) => { const f0 = pt.s / s, f = f0 * f0 * (3 - 2 * f0); pt.y = n.y + (m.y - n.y) * f; pt.g = pt.y; pt.w = clamp((pt.y - baseH(pt.x, pt.z)) / 8, 0, 1); });
        indexRoad(rr); fixed.add(n.id); if (m.edges.length === 1) fixed.add(m.id); added++;
      }
      if (!added) break; buildGraph();
    }
  }
  // join stray pieces (an authored road that only touches the grid at a flyover, a block of port streets...) to the main network
  {
    let added = 0;
    const sizes = city.compSizes, mainC = city.mainComp;
    const compNodes = new Map(); city.nodes.forEach((n) => { const c = city.comp[n.id]; if (c === mainC) return; if (!compNodes.has(c)) compNodes.set(c, []); compNodes.get(c).push(n); });
    for (const [c, list] of compNodes) {
      if (sizes[c] < 2) continue;
      let best = null, bd = 520;
      for (const n of list) {
        const m = city.nearestNode(n.x, n.z, 520); if (!m) continue; const d = Math.hypot(m.x - n.x, m.z - n.z);
        if (d < bd && d > 12 && Math.abs(m.y - n.y) < 26) { bd = d; best = [n, m]; }
      }
      if (!best) continue;
      const [n, m] = best; const mid = [(n.x + m.x) / 2, (n.z + m.z) / 2];
      if (isWater(mid[0], mid[1]) || isWater(n.x, n.z)) continue;
      const rr = addRoad({ id: `link_${c}`, name: "Link Road", cls: "art", raw: catmull([[n.x, n.z], mid, [m.x, m.z]], STEP), ground: true });
      if (!rr) continue;
      let s = 0; rr.pts.forEach((pt, k) => { if (k) s += Math.hypot(pt.x - rr.pts[k - 1].x, pt.z - rr.pts[k - 1].z); pt.s = s; }); rr.len = s;
      rr.pts.forEach((pt) => { const f0 = pt.s / s, f = f0 * f0 * (3 - 2 * f0); pt.y = n.y + (m.y - n.y) * f; pt.g = pt.y; pt.w = clamp((pt.y - baseH(pt.x, pt.z)) / 8, 0, 1); });
      indexRoad(rr); added++;
    }
    if (added) buildGraph();
  }
  // iron out any kink in a road's height profile (junction links, ramp ends, bridge starts) so nothing feels like a bump; the junction pass that follows then pins every crossing exactly
  for (const rd of roads) {
    const P = rd.pts, n = P.length; if (n < 6) continue;
    for (let it = 0; it < 24; it++) { let any = false; for (let i = 1; i < n - 1; i++) { const d2 = P[i - 1].y - 2 * P[i].y + P[i + 1].y; if (Math.abs(d2) > 0.07) { P[i].y += (d2 / 2) * 0.5; any = true; } } if (!any) break; }
  }
  // the new roads (links, dead-end repairs) join the same level-or-flyover rules. A link that cannot be fitted without a steep wall
  // (two neighbours that disagree about the height there) is dropped, the heights are put back, and the rest are fitted again.
  {
    const snap = roads.map((r) => ({ y: Float32Array.from(r.pts, (p) => p.y), g: Float32Array.from(r.pts, (p) => p.g) }));
    levelCrossings(8, 240);
    const bad = new Set();
    for (const r of roads) { if (!(r.id.startsWith("fix_") || r.id.startsWith("link_"))) continue; const P = r.pts; for (let i = 1; i < P.length; i++) { const d = Math.hypot(P[i].x - P[i - 1].x, P[i].z - P[i - 1].z) || 1; if (Math.abs(P[i].y - P[i - 1].y) / d > 0.16) { bad.add(r); break; } } }
    if (bad.size) {
      roads.forEach((r, i) => r.pts.forEach((p, k) => { p.y = snap[i].y[k]; p.g = snap[i].g[k]; }));
      const keep = roads.filter((r) => !bad.has(r)); roads.length = 0; keep.forEach((r, i) => { r.idx = i; roads.push(r); });
      segGrid.clear(); for (const rd of roads) indexRoad(rd); buildGraph();
      levelCrossings(8, 240);
    }
    city.droppedLinks = bad.size;
  }
  // ---- Upgrade 26: fair every ramp's height profile --------------------------------------------------------------------------------------------------------
  // The level-crossing passes leave a ramp with flat patches and sudden steps, and its first and last stretch overlap the flyover and the street at a
  // different height, so a car was left on the wrong surface there. Now: while the ramp's width still lies on the flyover (or on the street) its surface
  // is exactly that road's surface; between the two it eases down in one smooth curve. Crossings with other roads keep their height (level junctions)
  // or their headroom (over / under another road), so nothing that was fitted correctly is disturbed. The flat stretches are shortened step by step
  // for a ramp that would otherwise come out steeper than a road should be.
  for (const rr of roads) {
    if (!rr.ramp || !rr.deckRoad || !rr.streetRoad) continue;
    const P = rr.pts, n = P.length; if (n < 8) continue;
    const dk = rr.deckRoad, st = rr.streetRoad, hwR = rr.width / 2;
    const near = (road, x, z, i0, span) => { let bd = 1e9, by = 0; for (let i = Math.max(0, i0 - span); i < Math.min(road.pts.length - 1, i0 + span); i++) { const q = seg(road, i, x, z); if (q.d < bd) { bd = q.d; by = q.y; } } return [bd, by]; };
    const idxNear = (road, x, z) => { let bi = 0, bd = 1e18; for (let i = 0; i < road.pts.length; i++) { const d = (road.pts[i].x - x) ** 2 + (road.pts[i].z - z) ** 2; if (d < bd) { bd = d; bi = i; } } return bi; };
    const iD = idxNear(dk, P[0].x, P[0].z), iS = idxNear(st, P[n - 1].x, P[n - 1].z);
    const S = [0]; for (let k = 1; k < n; k++) S.push(S[k - 1] + Math.hypot(P[k].x - P[k - 1].x, P[k].z - P[k - 1].z)); const L = S[n - 1]; if (L < 90) continue;
    const y0 = P.map((p) => p.y);
    const gmax = (ys) => { let m = 0; for (let k = 1; k < n; k++) { const g = Math.abs(ys[k] - ys[k - 1]) / ((S[k] - S[k - 1]) || 1); if (g > m) m = g; } return m; };
    const g0 = gmax(y0);
    const attempt = (topLen, botLen) => {
      const lo = new Float64Array(n).fill(-1e9), hi = new Float64Array(n).fill(1e9), tgt = new Float64Array(n);
      let kTop = 0, kBot = n - 1;
      for (let k = 0; k < n; k++) { const [d, y] = near(dk, P[k].x, P[k].z, iD, 14); if (S[k] > topLen || d > dk.width / 2 + hwR * 0.6 || Math.abs(y - y0[k]) > 2.5) break; tgt[k] = y; lo[k] = hi[k] = y; kTop = k; }
      for (let k = n - 1; k > kTop + 3; k--) { const [d, y] = near(st, P[k].x, P[k].z, iS, 14); if (L - S[k] > botLen || d > st.width / 2 + hwR + 1 || Math.abs(y - y0[k]) > 2.5) break; tgt[k] = y; lo[k] = hi[k] = y; kBot = k; }
      if (kTop === 0) { tgt[0] = y0[0]; lo[0] = hi[0] = y0[0]; } if (kBot === n - 1) { tgt[n - 1] = y0[n - 1]; lo[n - 1] = hi[n - 1] = y0[n - 1]; }
      const yT = tgt[kTop], yB = tgt[kBot], sT = S[kTop], sB = S[kBot]; if (sB - sT < 30) return null;
      for (let k = kTop + 1; k < kBot; k++) { const u = (S[k] - sT) / (sB - sT); tgt[k] = yT + (yB - yT) * (0.5 * u + 0.5 * u * u * (3 - 2 * u)); }
      // other roads crossing the free part: a level junction keeps its height, a ramp over a road keeps its headroom, a ramp under a road its clearance
      for (let k = kTop + 1; k < kBot; k++) {
        nearSegs(P[k].x, P[k].z, hwR + 22, (r2, i2) => {
          if (r2 === rr || r2 === dk || r2 === st || r2.tunnel) return; const q = seg(r2, i2, P[k].x, P[k].z); if (q.d > hwR + r2.width / 2 + 2.5) return;
          const dy = q.y - y0[k];
          if (Math.abs(dy) <= 3) { lo[k] = Math.max(lo[k], y0[k] - 0.05); hi[k] = Math.min(hi[k], y0[k] + 0.05); }
          else if (dy < 0) lo[k] = Math.max(lo[k], q.y + HEADROOM); else hi[k] = Math.min(hi[k], q.y - HEADROOM);
        });
      }
      const y = Float64Array.from(tgt); for (let k = kTop + 1; k < kBot; k++) y[k] = Math.max(lo[k], Math.min(hi[k], tgt[k]));
      for (let it = 0; it < 80; it++) for (let k = kTop + 1; k < kBot; k++) { const sm = 0.25 * y[k - 1] + 0.5 * y[k] + 0.25 * y[k + 1]; y[k] = Math.max(lo[k], Math.min(hi[k], sm * 0.9 + tgt[k] * 0.1)); }
      return y;
    };
    let best = null;
    for (const [tl, bl] of [[90, 50], [72, 42], [55, 35], [40, 28], [28, 20], [16, 14]]) { const y = attempt(Math.min(tl, L * 0.4), Math.min(bl, L * 0.22)); if (y && gmax(y) <= Math.max(0.095, g0)) { best = y; break; } }
    if (!best) continue;
    for (let k = 0; k < n; k++) { P[k].y = best[k]; P[k].w = clamp((P[k].y - P[k].g) / 8, 0, 1); }
    rr.faired = true;
  }
  // A ramp whose top end hangs well away from the flyover surface (the flyover was lifted over a crossing after the ramp was laid) leads nowhere: a car
  // driving up it ends under the deck. Such a ramp is taken out rather than left as a trap.
  {
    const nearY = (road, x, z) => { let bd = 1e9, by = 0, bi = 0, bdi = 1e18; for (let i = 0; i < road.pts.length; i++) { const d = (road.pts[i].x - x) ** 2 + (road.pts[i].z - z) ** 2; if (d < bdi) { bdi = d; bi = i; } } for (let i = Math.max(0, bi - 14); i < Math.min(road.pts.length - 1, bi + 14); i++) { const q = seg(road, i, x, z); if (q.d < bd) { bd = q.d; by = q.y; } } return by; };
    const bad = new Set();
    for (const rr of roads) { if (!rr.ramp || !rr.deckRoad || !rr.streetRoad) continue; const P = rr.pts; if (Math.abs(nearY(rr.deckRoad, P[0].x, P[0].z) - P[0].y) > 1.0 || Math.abs(nearY(rr.streetRoad, P[P.length - 1].x, P[P.length - 1].z) - P[P.length - 1].y) > 1.0) bad.add(rr); }
    city.droppedRamps = bad.size;
    if (bad.size) { const keep = roads.filter((r) => !bad.has(r)); roads.length = 0; keep.forEach((r, i) => { r.idx = i; roads.push(r); }); segGrid.clear(); for (const rd of roads) indexRoad(rd); buildGraph(); }
  }
  // roads that cross OVER a lower road (more than 3 m lower, footprints overlapping) are bridges there: the land is cut for the lower road, not the upper one
  for (const r of roads) { if (r.tunnel) continue; for (const p of r.pts) p.over = false; }
  for (const r of roads) {
    if (r.tunnel) continue; const P = r.pts; const flag = new Uint8Array(P.length);
    for (let i = 0; i < P.length; i++) {
      const p = P[i]; if (p.tun || p.w > 0.35 || p.y - p.g > 2.8) continue;
      let over = false;
      nearSegs(p.x, p.z, r.width / 2 + 12, (r2, i2) => {
        if (over || r2.tunnel) return; if (r2 === r && Math.abs(i2 - i) < 24) return; const a2 = r2.pts[i2]; if (a2.tun || a2.w > 0.35 || a2.y - a2.g > 2.8) return;
        const q = seg(r2, i2, p.x, p.z); if (q.d > r2.width / 2 + r.width / 2 + 5) return; if (q.y < p.y - 3) over = true;
      });
      if (over) flag[i] = 1;
    }
    for (let it = 0; it < 2; it++) { const f2 = Uint8Array.from(flag); for (let i = 1; i < P.length - 1; i++) if (flag[i - 1] || flag[i + 1]) f2[i] = 1; flag.set(f2); }
    for (let i = 0; i < P.length; i++) P[i].over = !!flag[i];
  }
  // ---- metro viaducts: built last, so they can pass over every road at its final height --------------------------------------
  city.metro = buildMetro(city, F); city.metroNear = () => false;
  {
    const mg = new Map(); const mk = (i, j) => i * 4096 + j;
    for (const L of city.metro) {
      for (const p of L.pts) { const k = mk(Math.floor(p.x / 40), Math.floor(p.z / 40)); let l = mg.get(k); if (!l) mg.set(k, (l = [])); l.push([p.x, p.z, L.halfW + 3]); }
      for (const st of L.stations) for (let o = -60; o <= 60; o += 30) { const x = st.x + (L.pts[st.k + 1].x - L.pts[st.k].x) * 0, z = st.z; void o; const k = mk(Math.floor(x / 40), Math.floor(z / 40)); let l = mg.get(k); if (!l) mg.set(k, (l = [])); l.push([x, z, 58]); }
    }
    city.metroNear = (x, z, rad) => { for (let i = Math.floor((x - rad - 60) / 40); i <= Math.floor((x + rad + 60) / 40); i++) for (let j = Math.floor((z - rad - 60) / 40); j <= Math.floor((z + rad + 60) / 40); j++) { const l = mg.get(mk(i, j)); if (l) for (const q of l) if (Math.hypot(q[0] - x, q[1] - z) < q[2] + rad) return true; } return false; };
  }
  // road ends that really do stop (map edge, hillside, water): each gets a striped "road closed" barricade, so it reads as a deliberate end
  city.deadEnds = [];
  for (const n of city.nodes) {
    if (n.edges.length !== 1) continue;
    const e = city.edges[n.edges[0]], r = roads[e.r], atStart = e.a === n.id; const i = atStart ? e.i0 : e.i1, j = atStart ? Math.min(r.pts.length - 1, i + 2) : Math.max(0, i - 2);
    const p = r.pts[i], q = r.pts[j]; if (p.tun) continue; const L = Math.hypot(p.x - q.x, p.z - q.z) || 1;
    city.deadEnds.push({ x: p.x, z: p.z, y: p.y, dx: (p.x - q.x) / L, dz: (p.z - q.z) / L, w: r.width, road: r.idx, elev: p.y - p.g > 1.8 });
  }
  return city;
}
