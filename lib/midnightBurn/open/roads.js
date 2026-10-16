// Midnight Burn — the road network: authored highways and bridges, generated street grids,
// elevation (bridges, flyovers, ghat climbs), and the graph that traffic and racers drive on.
import { W, mulberry, fbm, vnoise, baseH, shoreDist, isWater, districtDens, districtAt, pip, WEST_LAND, EAST_LAND, PORT_LAND, sstep, LAKES } from "./geo";

const K = 1000;
export const CLS = {
  hwy: { w: 22, lane: 3.7, speed: 1.0, rank: 3, deck: 14 },
  art: { w: 14, lane: 3.4, speed: 0.8, rank: 2, deck: 8 },
  str: { w: 9, lane: 2.7, speed: 0.6, rank: 1, deck: 6 },
};
const C = (a, b) => [a * K, b * K];

// ---- authored roads (km) -------------------------------------------------------------------------------------
// ground: true keeps a highway at ground level. twisty roads are drawn with extra points.
const AUTHORED = [
  { id: "weh", name: "Western Express Highway & Sea Link", cls: "hwy", pts: [[1.5, 0.15], [1.45, 0.8], [1.45, 1.45], [1.52, 2.05], [1.6, 2.45], [1.55, 2.68], [1.32, 2.78], [1.12, 3.0], [1.1, 3.35], [1.25, 3.7], [1.55, 3.95], [1.85, 4.05], [1.9, 4.25]], deck: 22 },
  { id: "pedder", name: "Pedder Road", cls: "art", pts: [[1.9, 4.25], [1.82, 4.45], [1.8, 4.7]] },
  { id: "marine", name: "Marine Drive", cls: "art", ground: true, pts: [[1.6, 5.28], [1.74, 5.0], [1.78, 4.82], [1.7, 4.62], [1.58, 4.46], [1.62, 4.32]], scenic: true },
  { id: "eeh", name: "Eastern Express Highway", cls: "hwy", pts: [[2.05, 5.3], [2.2, 4.9], [2.3, 4.5], [2.45, 4.0], [2.55, 3.5], [2.68, 3.0], [2.85, 2.5], [2.95, 2.0], [3.02, 1.55], [3.02, 1.1]] },
  { id: "vashi", name: "Vashi Bridge", cls: "hwy", pts: [[2.3, 3.45], [2.78, 3.3], [3.2, 3.28], [3.6, 3.3], [3.95, 3.3], [4.2, 3.3]], deck: 12 },
  { id: "thanebel", name: "Thane–Belapur Road", cls: "hwy", ground: true, pts: [[3.08, 1.18], [3.45, 1.32], [3.8, 1.45], [4.05, 1.65], [4.25, 2.3], [4.3, 3.0], [4.35, 3.7], [4.5, 4.4], [4.65, 5.0], [4.9, 5.35], [5.2, 5.45]], deck: 11 },
  { id: "palm", name: "Palm Beach Road", cls: "hwy", ground: true, scenic: true, pts: [[3.8, 2.2], [3.76, 3.0], [3.8, 3.6], [3.92, 4.15], [4.02, 4.5]] },
  { id: "atal", name: "Atal Setu Trans-Harbour Link", cls: "hwy", pts: [[2.28, 4.7], [2.75, 5.0], [3.15, 5.35], [3.5, 5.7], [3.78, 5.98], [4.1, 6.05], [4.5, 6.15], [4.8, 6.22]], deck: 26 },
  { id: "pune", name: "Mumbai–Pune Expressway", cls: "hwy", ground: true, hill: true, pts: [[5.2, 5.45], [5.55, 5.35], [5.9, 5.1], [6.15, 4.7], [6.3, 4.2]] },
  { id: "ghat", name: "Khopoli Ghat Road", cls: "art", ground: true, hill: true, pts: [[5.2, 4.25], [5.5, 4.1], [5.36, 3.82], [5.66, 3.66], [5.5, 3.38], [5.86, 3.2], [5.7, 2.9], [6.04, 2.7], [5.9, 2.4], [6.2, 2.2]] },
  { id: "yeoor", name: "Yeoor Hills Road", cls: "art", ground: true, hill: true, pts: [[2.9, 1.15], [2.76, 0.96], [2.84, 0.78], [2.62, 0.7], [2.7, 0.52], [2.46, 0.45], [2.52, 0.3], [2.28, 0.34], [2.2, 0.55], [1.98, 0.62], [2.02, 0.85], [1.8, 0.9], [1.7, 1.1]] },
  { id: "aarey", name: "Aarey–Powai Link Road", cls: "art", ground: true, pts: [[1.5, 1.3], [1.78, 1.6], [2.05, 1.72], [2.3, 1.82], [2.5, 1.95], [2.78, 2.05], [2.96, 2.1]] },
  { id: "juhu", name: "Juhu Tara Road", cls: "art", ground: true, scenic: true, pts: [[0.9, 1.5], [0.98, 1.9], [1.08, 2.3], [1.18, 2.58], [1.32, 2.72]] },
  { id: "colaba", name: "Colaba Causeway", cls: "art", ground: true, pts: [[1.98, 5.3], [1.9, 5.6], [1.84, 5.9], [1.8, 6.05]] },
  { id: "kalyan", name: "Kalyan–Shil Road", cls: "hwy", ground: true, hill: true, pts: [[3.12, 1.05], [3.4, 0.82], [3.9, 0.68], [4.4, 0.82], [4.9, 1.2], [5.4, 1.5], [5.9, 1.9]], deck: 10 },
  { id: "hbr", name: "Harbour Road", cls: "art", ground: true, pts: [[2.45, 4.75], [2.2, 5.0], [2.05, 5.3], [1.98, 5.5]] },
];

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

export function buildCity(seed = 7) {
  const rnd = mulberry(seed * 7919 + 13);
  const roads = [];
  const STEP = 10;

  function addRoad(def) {
    const base = def.raw ? def.raw : def.pts.map(([x, z]) => [x * K, z * K]);
    const pts = def.raw ? base : catmull(base, STEP);
    // resample to an even spacing
    const ev = [pts[0]]; let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      let [px, pz] = ev[ev.length - 1]; let [qx, qz] = pts[i];
      let d = Math.hypot(qx - px, qz - pz);
      while (d >= STEP - acc) { const t = (STEP - acc) / d; px += (qx - px) * t; pz += (qz - pz) * t; ev.push([px, pz]); d = Math.hypot(qx - px, qz - pz); acc = 0; }
      acc += d;
    }
    const last = pts[pts.length - 1]; if (Math.hypot(last[0] - ev[ev.length - 1][0], last[1] - ev[ev.length - 1][1]) > 3) ev.push(last);
    if (ev.length < 3) return null;
    const r = { id: def.id || `r${roads.length}`, idx: roads.length, name: def.name || "Street", cls: def.cls, width: CLS[def.cls].w, ground: !!def.ground, scenic: !!def.scenic, hill: !!def.hill, deck: def.deck, ramp: def.ramp || null, pts: ev.map(([x, z]) => ({ x, z, y: 0, s: 0, w: 0 })), len: 0 };
    roads.push(r); return r;
  }

  // ---- 1. authored + generated roads -------------------------------------------------------------------------
  for (const a of AUTHORED) addRoad(a);
  const nAuth = roads.length; 

  // lattice: arterials every 440 m, streets every 150 m, in three zones with their own grid direction
  const ZONES = [
    { poly: WEST_LAND, ang: 0.2, art: 460, str: 154, wob: 16, name: "Mumbai" },
    { poly: EAST_LAND, ang: 0.42, art: 480, str: 160, wob: 0, name: "Navi Mumbai" },
    { poly: PORT_LAND, ang: 0.0, art: 520, str: 200, wob: 0, name: "Port" },
  ];
  function latticeAllowed(x, z, cls, zone) {
    if (x < 90 || z < 90 || x > W - 90 || z > W - 90) return false;
    if (!pip(zone.poly, x, z)) return false;
    if (shoreDist(x, z) < 45) return false;
    const d = districtDens(x, z);
    if (d < (cls === "art" ? 0.22 : 0.3)) return false;
    if (baseH(x, z) > 48) return false;
    return true;
  }
  for (const zone of ZONES) {
    const c = Math.cos(zone.ang), s = Math.sin(zone.ang);
    for (const cls of ["art", "str"]) {
      const sp = cls === "art" ? zone.art : zone.str;
      for (const dir of [0, 1]) {
        const dx = dir ? -s : c, dz = dir ? c : s; // along-line direction
        const nx = dir ? c : -s, nz = dir ? s : c;   // spacing direction
        const lim = W * 1.5;
        const jitterSeed = dir * 31 + (cls === "art" ? 5 : 9);
        for (let u = -lim; u <= lim; u += sp) {
          if (cls === "str" && Math.abs(((u % zone.art) + zone.art) % zone.art) < 6) continue; // sit on top of arterial
          let run = null; const flush = () => { if (run && run.length >= 8) addRoad({ raw: run.slice(), cls, name: cls === "art" ? "Avenue" : "Lane" }); run = null; };
          for (let t = -lim; t <= lim; t += 18) {
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
    let gs = smooth(smooth(g, r.hill ? 8 : 6), 4);
    if (true) { // authored roads: no wall-steep climbs
      const maxG = (r.hill ? 0.07 : r.cls === "str" ? 0.05 : 0.07) * STEP; const ys = Array.from(gs);
      for (let it = 0; it < 3; it++) { for (let i = 1; i < n; i++) ys[i] = clamp(ys[i], ys[i - 1] - maxG, ys[i - 1] + maxG); for (let i = n - 2; i >= 0; i--) ys[i] = clamp(ys[i], ys[i + 1] - maxG, ys[i + 1] + maxG); }
      gs = Float32Array.from(ys);
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

  // ground height, with the land carved flat around ground-level roads
  city.groundH = (x, z) => {
    const b = baseH(x, z);
    if (b < -0.5) return b;
    let best = null, bd = 1e9;
    nearSegs(x, z, 30, (r, i) => { const a = r.pts[i]; if (a.w > 0.35) return; const q = seg(r, i, x, z); const edge = q.d - r.width / 2; if (edge < bd && edge < 30) { bd = edge; best = q; } });
    if (!best) return b;
    const k = sstep(2, 30, bd); return best.y - 0.12 + (b - (best.y - 0.12)) * k;
  };
  // the surface a car at (x,z,yRef) is on
  city.surfaceAt = (x, z, yRef = 0) => {
    let best = null, bestDy = 1e9, bestSc = 1e9;
    nearSegs(x, z, 14, (r, i) => {
      const q = seg(r, i, x, z); const hw = r.width / 2; if (q.d > hw + 0.6) return;
      const dy = Math.abs(q.y - yRef); const sc = dy + (q.d / hw) * 2.2 - (r.ramp ? 0.8 : 0); if (sc < bestSc) { bestSc = sc; bestDy = dy; best = { road: r, i, t: q.t, y: q.y, d: q.d, off: q.d, w: q.w, px: q.px, pz: q.pz }; }
    });
    if (best && bestDy < 4.5) return best;
    return null;
  };
  city.nearestRoad = (x, z, rad = 200, filter = null, yRef = null) => {
    let best = null, bd = 1e9;
    nearSegs(x, z, rad, (r, i) => { if (filter && !filter(r)) return; const q = seg(r, i, x, z); const dd = q.d + (yRef == null ? 0 : Math.abs(q.y - yRef) * 3); if (dd < bd) { bd = dd; best = { road: r, i, t: q.t, x: q.px, z: q.pz, y: q.y, d: q.d, w: q.w }; } });
    return best;
  };

  // ---- 3b. on- and off-ramps so the elevated highways can be reached ---------------------------------------------------
  {
    const groundish = (rd, i) => rd.pts[i].w < 0.25 && rd.pts[i].y - rd.pts[i].g < 1.5;
    const highs = roads.filter((rd, ix) => ix < nAuth && rd.cls === "hwy");
    let side = 1;
    for (const h of highs) {
      let lastI = -999;
      for (let i = 12; i < h.pts.length - 12; i += 1) {
        const p = h.pts[i]; if (p.y - p.g < 5 || i - lastI < 70) continue;
        const q = h.pts[i + 1], t = Math.hypot(q.x - p.x, q.z - p.z) || 1; const tx = (q.x - p.x) / t, tz = (q.z - p.z) / t; const nx = -tz * side, nz = tx * side;
        let found = null;
        for (const [ah, lat] of [[170, 60], [210, 90], [140, 40], [250, 120], [190, 30]]) {
          const X = p.x + tx * ah + nx * lat, Z = p.z + tz * ah + nz * lat;
          const nr = city.nearestRoad(X, Z, 40, (rd) => rd.cls !== "hwy", null);
          if (nr && nr.d < 30) { const pt = nr.road.pts[nr.i]; if (groundish(nr.road, nr.i) && p.y - pt.y > 4) { found = { x: nr.x, z: nr.z, y: nr.y }; break; } }
        }
        if (!found) continue;
        const m1 = [p.x + tx * 70 + nx * 12, p.z + tz * 70 + nz * 12], m2 = [(p.x + found.x) / 2 + nx * 18, (p.z + found.z) / 2 + nz * 18];
        const rr = addRoad({ id: `ramp_${h.id}_${i}`, name: "Ramp", cls: "art", raw: catmull([[p.x, p.z], m1, m2, [found.x, found.z]], STEP), ramp: true, ground: true });
        if (!rr) continue;
        let s = 0; rr.pts.forEach((pt, k) => { if (k) s += Math.hypot(pt.x - rr.pts[k - 1].x, pt.z - rr.pts[k - 1].z); pt.s = s; }); rr.len = s;
        rr.pts.forEach((pt) => { const f = sstep(0, 1, pt.s / s); pt.y = p.y + (found.y - p.y) * f; pt.g = baseH(pt.x, pt.z) + 0.12; pt.w = clamp((pt.y - pt.g) / 8, 0, 1); });
        indexRoad(rr); lastI = i; side = -side;
      }
    }
  }

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
  const checked = new Set();
  for (const r of roads) {
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1];
      nearSegs((a.x + b.x) / 2, (a.z + b.z) / 2, 8, (r2, j) => {
        if (r2.idx <= r.idx) return; const kk = r.idx * 1e9 + r2.idx * 65536 + j + i * 1e5; if (checked.has(kk)) return; checked.add(kk);
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
  city.nearestNode = (x, z, rad = 400) => {
    let best = null, bd = rad;
    const i0 = Math.floor((x - rad) / NG), i1 = Math.floor((x + rad) / NG), j0 = Math.floor((z - rad) / NG), j1 = Math.floor((z + rad) / NG);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const l = city.nodeGrid.get(nkey2(i, j)); if (!l) continue; for (const id of l) { const n = city.nodes[id]; if (city.comp[id] !== city.mainComp) continue; const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; best = n; } } }
    return best;
  };
  city.route = (from, to) => { // A* over nodes; returns list of {edge, dir}
    if (from === to) return [];
    const open = [from.id]; const g = new Map([[from.id, 0]]), f = new Map([[from.id, Math.hypot(from.x - to.x, from.z - to.z)]]), came = new Map(); const closed = new Set();
    while (open.length) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (f.get(open[i]) < f.get(open[bi])) bi = i;
      const cur = open.splice(bi, 1)[0]; if (cur === to.id) break; if (closed.has(cur)) continue; closed.add(cur);
      for (const eid of city.nodes[cur].edges) {
        const e = city.edges[eid]; const o = e.a === cur ? e.b : e.a; if (closed.has(o)) continue;
        const cost = e.len / CLS[e.cls].speed * (roads[e.r].id.startsWith("link_") ? 3.5 : 1); const ng = g.get(cur) + cost;
        if (ng < (g.get(o) ?? 1e18)) { g.set(o, ng); came.set(o, { from: cur, e: eid, dir: e.a === cur ? 1 : -1 }); f.set(o, ng + Math.hypot(city.nodes[o].x - to.x, city.nodes[o].z - to.z) / 1.0); if (!open.includes(o)) open.push(o); }
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
      rr.pts.forEach((pt) => { const f = pt.s / s; pt.y = n.y + (m.y - n.y) * f; pt.g = pt.y; pt.w = clamp((pt.y - baseH(pt.x, pt.z)) / 8, 0, 1); });
      indexRoad(rr); added++;
    }
    if (added) buildGraph();
  }
  return city;
}
