// Midnight Burn — the metro. Elevated lines with stations every few hundred metres, drawn by chunks3d (viaduct, platforms)
// and run by render.js (trains that stop at every station). Lines are listed in the old 'km' map coordinates.
import { W, mx, mz, shoreDist, isWater, baseH, districtAt, DISTRICTS, AIRPORTS } from "./geo";

// 'now': the lines Mumbai, Navi Mumbai and Pune are building / have opened. '2046' adds a lot more.
const L_NOW = [
  { id: "M1", name: "Line 1 · Blue (Versova – Ghatkopar)", color: 0x3ea8ff, pts: [[1.12, 1.9], [1.5, 2.2], [1.9, 2.45], [2.3, 2.7], [2.7, 2.85], [2.95, 2.95]] },
  { id: "M2", name: "Line 2 · Yellow (Dahisar East – D.N. Nagar – Mandale · 2A & 2B)", color: 0xffd23a, pts: [[1.5, 0.3], [1.52, 0.9], [1.5, 1.5], [1.45, 2.05], [1.7, 2.6], [2.2, 3.05], [2.65, 3.45], [3.0, 3.8]] },
  { id: "M3", name: "Line 3 · Aqua (Cuffe Parade – BKC – Aarey Colony)", color: 0x35e0d0, pts: [[1.8, 5.78], [1.9, 5.35], [2.0, 4.85], [2.05, 4.3], [2.2, 3.7], [2.2, 3.05], [2.2, 2.6], [2.3, 2.1], [2.3, 1.6]] },
  { id: "M4", name: "Line 4 · Green (Wadala – Kasarvadavali – Gaimukh · 4 & 4A)", color: 0x3cff9a, pts: [[2.45, 4.35], [2.6, 3.85], [2.75, 3.3], [2.9, 2.75], [2.98, 2.2], [3.05, 1.7], [3.05, 1.3], [3.15, 1.0]] },
  { id: "M7", name: "Line 7 & 9 · Red (Gundavali – Dahisar East – Mira Bhayandar)", color: 0xff4a4a, pts: [[1.95, 2.5], [2.05, 2.05], [1.95, 1.5], [1.82, 0.9], [1.72, 0.4], [1.6, 0.1], [1.42, -0.05]] },
  { id: "M5", name: "Line 5 · Orange (Thane – Bhiwandi – Kalyan)", color: 0xffa03a, pts: [[3.05, 1.4], [3.45, 0.7], [3.85, 0.0], [3.95, -0.35], [4.25, -0.1], [4.45, 0.4]] },
  { id: "NM1", name: "Navi Mumbai Line 1 (Belapur – Panvel)", color: 0x6aeaff, pts: [[4.45, 4.95], [4.8, 5.05], [5.1, 5.3], [5.3, 5.1], [5.45, 5.0]] },
  { id: "NM2", name: "Navi Mumbai Airport Line", color: 0xb06cff, pts: [[5.45, 5.0], [5.52, 5.3], [5.62, 5.55], [5.72, 5.7]], airport: "nmia" },
  { id: "NM3", name: "Navi Mumbai Line 3 (Vashi – Belapur)", color: 0xff7ad9, pts: [[3.98, 3.3], [4.02, 3.8], [4.12, 4.25], [4.3, 4.65], [4.45, 4.95]] },
  { id: "M6", name: "Line 6 · Pink (Swami Samarth Nagar – Vikhroli)", color: 0xff7ad9, pts: [[1.62, 2.4], [1.95, 2.3], [2.35, 2.3], [2.75, 2.4], [3.0, 2.5]] },
  { id: "M8", name: "Line 8 · Gold (Airport Link: CSMIA – Navi Mumbai)", color: 0xffd23a, pts: [[2.17, 2.95], [2.9, 3.25], [3.6, 3.55], [4.2, 4.4], [4.9, 5.05], [5.5, 5.5]] },
  { id: "M10", name: "Line 10 · Purple (Gaimukh – Shivaji Chowk, Mira Road)", color: 0xb06cff, pts: [[3.15, 1.0], [2.7, 0.8], [2.2, 0.55], [1.75, 0.4]] },
  { id: "M11", name: "Line 11 · Green Extension (Wadala – CSMT)", color: 0x3cff9a, pts: [[2.45, 4.35], [2.3, 4.7], [2.1, 5.0], [2.0, 5.25]] },
  { id: "M12", name: "Line 12 · Orange Extension (Kalyan – Dombivli – Taloja)", color: 0xffa03a, pts: [[4.45, 0.4], [4.6, 1.0], [4.55, 2.0], [4.3, 3.0], [4.45, 4.0], [4.55, 4.7]] },
  { id: "M13", name: "Line 13 · Purple Extension (Shivaji Chowk, Mira Road – Virar)", color: 0xb06cff, pts: [[1.75, 0.4], [1.55, 0.0], [1.4, -0.4], [1.3, -0.8], [1.2, -1.15]] },
  { id: "M14", name: "Line 14 · Magenta (Kanjurmarg – Airoli – Badlapur)", color: 0xff3aa8, pts: [[2.9, 2.6], [3.4, 2.1], [3.98, 1.45], [4.5, 0.95], [4.9, 0.55], [5.3, 0.25]] },
  { id: "TR", name: "Thane Ring Metro (internal circular network · 22 stations)", color: 0x6aeaff, loop: true, nSt: 22, pts: [[3.410, 1.380],[3.383, 1.495],[3.305, 1.592],[3.188, 1.657],[3.050, 1.680],[2.912, 1.657],[2.795, 1.592],[2.717, 1.495],[2.690, 1.380],[2.717, 1.265],[2.795, 1.168],[2.912, 1.103],[3.050, 1.080],[3.188, 1.103],[3.305, 1.168],[3.383, 1.265],[3.410, 1.380]] },
  { id: "NML", name: "Navi Mumbai Multi-Line Loop (CBD Belapur – Pendhar – Taloja – Khandeshwar)", color: 0xff9a3a, loop: true, nSt: 8, names: ["CBD Belapur", "Kharghar Sector 7", "Pendhar", "Taloja Junction", "Taloja MIDC", "Khandeshwar", "Panvel Road", "Belapur Fort"], pts: [[4.45, 4.95],[4.70, 5.15],[5.00, 5.10],[5.15, 4.75],[5.00, 4.40],[4.70, 4.35],[4.50, 4.60],[4.45, 4.95]] },
  { id: "BT", name: "Mumbai–Ahmedabad Bullet Train (BKC – Thane – Virar – Ahmedabad)", color: 0xf4f4ee, fast: true,
    pts: [[2.2, 3.05], [2.75, 2.55], [3.05, 1.6], [2.6, 0.9], [2.0, 0.35], [1.5, -0.1], [1.25, -0.75], [1.1, -1.3], [0.9, -1.33]],
    stops: [[null, "Mumbai BKC"], [[3.05, 1.45], "Thane"], [[1.2, -1.15], "Virar"], [null, "Ahmedabad (terminus)"]] },
  { id: "P1", name: "Pune Metro Purple (PCMC – Swargate)", color: 0xb06cff, pts: [[7.7, 6.0], [7.9, 5.82], [8.1, 5.55], [8.2, 6.0], [8.2, 6.4]] },
  { id: "P2", name: "Pune Metro Aqua (Hinjewadi – Shivajinagar)", color: 0x35e0d0, pts: [[7.8, 4.95], [7.95, 5.25], [8.1, 5.55], [8.35, 5.15]] },
];
const L_2046 = [
  { id: "C1", name: "Coastal Metro (Colaba – Juhu)", color: 0xff5ab4, pts: [[1.72, 5.75], [1.7, 5.2], [1.7, 4.7], [1.88, 4.15], [1.98, 3.65], [1.8, 3.25], [1.5, 2.95], [1.3, 2.6], [1.15, 2.3]] },
  { id: "V1", name: "Vasai–Virar Line", color: 0x7cff6a, pts: [[0.9, -0.7], [1.05, -0.35], [1.25, -0.05], [1.4, 0.0], [1.5, 0.3]] },
  { id: "K1", name: "Kalyan–Ambernath Line", color: 0xffa03a, pts: [[4.45, 0.4], [4.7, 0.8], [4.78, 1.2], [5.1, 0.6], [5.35, 0.2]] },
  { id: "U1", name: "Panvel–Uran Line", color: 0x6aeaff, pts: [[5.45, 5.0], [5.2, 5.5], [4.9, 5.85], [4.6, 6.2]] },
  { id: "H1", name: "Harbour Sea-Link Metro", color: 0x3ea8ff, pts: [[2.45, 4.45], [3.0, 4.9], [3.6, 5.2], [4.0, 5.5], [4.2, 5.8]] },
  { id: "B1", name: "Bhiwandi Freight Line", color: 0xff4a4a, pts: [[3.05, 1.25], [3.9, 1.15], [4.05, 0.6], [4.0, 0.0], [3.95, -0.5]] },
  { id: "E1", name: "Expressway Metro (Panvel – Lonavala)", color: 0xb06cff, pts: [[5.45, 5.0], [5.8, 4.9], [6.15, 4.6], [6.5, 4.2], [6.85, 4.0]] },
  { id: "P3", name: "Pune Metro Orange (Hadapsar – Kothrud)", color: 0xffa03a, pts: [[8.2, 6.5], [8.2, 6.0], [8.1, 5.55], [8.3, 5.2], [8.35, 5.0]] },
  { id: "P4", name: "Pune–Talegaon Line", color: 0xff7ad9, pts: [[7.45, 4.45], [7.6, 4.8], [7.75, 5.4], [7.7, 6.0]] },
];

const DECK_HALF = 4.9, CLEAR = 8.2; // half the viaduct deck, and the lift over any road beneath it
const SUF = ["Central", "Road", "Nagar", "East", "West", "Naka", "Junction", "Gate", "Park", "Market", "Bridge", "Circle", "Chowk", "Crossing", "Heights", "Plaza"];

function catmullPts(pts, step) {
  const out = []; const n = pts.length; const get = (i) => pts[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2); const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]); const m = Math.max(1, Math.ceil(L / step));
    for (let k = 0; k < m; k++) { const t = k / m, t2 = t * t, t3 = t2 * t; out.push([0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3), 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]); }
  }
  out.push(pts[n - 1]); return out;
}
function smooth(arr, half) { const n = arr.length, out = new Float32Array(n), pre = new Float64Array(n + 1); for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + arr[i]; for (let i = 0; i < n; i++) { const a = Math.max(0, i - half), b = Math.min(n - 1, i + half); out[i] = (pre[b + 1] - pre[a]) / (b - a + 1); } return out; }

export function metroDefs(F) { return F ? [...L_NOW, ...L_2046] : L_NOW; }

// build every line: a smooth path at deck height, with stations
export function buildMetro(city, F) {
  const lines = []; const used = new Map(); // district id -> how many stations already named after it
  const nameAt = (x, z) => {
    let d = districtAt(x, z); if (!d || d.style === "forest") { let bd = 1e9; for (const q of DISTRICTS) { if (q.style === "forest") continue; const dd = Math.hypot(q.x - x, q.z - z); if (dd < bd) { bd = dd; d = q; } } }
    const n = used.get(d.id) || 0; used.set(d.id, n + 1); const base = d.name.split(" & ")[0].split("–")[0].trim();
    return n === 0 ? base : base + " " + SUF[(n - 1) % SUF.length] + (n > SUF.length ? " " + Math.ceil(n / SUF.length) : "");
  };
  for (const def of metroDefs(F)) {
    const raw = def.pts.map(([a, b]) => [mx(a), mz(b)]);
    let airport = null; if (def.airport) { airport = AIRPORTS.find((q) => q.id === def.airport); const tx = airport.x + airport.terminal.x, tz = airport.z + airport.terminal.z + (airport.id === "nmia" ? 90 : 0); raw[raw.length - 1] = [tx, tz]; }
    const path = catmullPts(raw, 12).filter((p) => p[0] > 100 && p[1] > 100 && p[0] < W - 100 && p[1] < W - 100);
    if (path.length < 40) continue;
    // ground under the line (water counts as sea level) → a smooth deck 11.5 m above the highest nearby ground, and always well above every road it crosses:
    // the deck is lifted so that 8.2 m separates it from the surface of any road beneath it (roads under a station canopy count over a wider strip), then the
    // profile is held to a 3.5% climb / descent so trains and the viaduct rise and fall smoothly instead of stepping.
    const gr = Float32Array.from(path.map((p) => Math.max(0, city.groundH(p[0], p[1]))));
    const mxG = new Float32Array(gr.length); for (let i = 0; i < gr.length; i++) { let m = -1e9; for (let k = Math.max(0, i - 6); k <= Math.min(gr.length - 1, i + 6); k++) m = Math.max(m, gr[k]); mxG[i] = m; }
    const base = smooth(mxG, 10); const n0 = path.length; const dist = new Float32Array(n0); for (let i = 1; i < n0; i++) dist[i] = dist[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    const req = new Float32Array(n0);
    for (let i = 0; i < n0; i++) {
      let need = base[i] + 11.5; const px = path[i][0], pz = path[i][1];
      city.nearSegs(px, pz, 30, (r, j) => { if (r.tunnel) return; const q = city.seg(r, j, px, pz); if (q.d > r.width / 2 + DECK_HALF + 1.0) return; need = Math.max(need, q.y + CLEAR); });
      req[i] = need;
    }
    // where the stations are (along the line), before the profile is settled: every platform stands on a level stretch of viaduct
    const total = dist[n0 - 1]; const idxAt = (ss) => { let k = 0; while (k < n0 - 2 && dist[k + 1] < ss) k++; return k; };
    const sts = []; const GAP = 480;
    if (def.fast) { // bullet train: only a few stops, at the places named
      def.stops.forEach(([km, name], q) => {
        let ss = q === 0 ? 150 : q === def.stops.length - 1 ? total - 150 : 0;
        if (km) { const X = mx(km[0]), Z = mz(km[1]); let bd = 1e18; path.forEach((pp, i) => { const d = (pp[0] - X) ** 2 + (pp[1] - Z) ** 2; if (d < bd) { bd = d; ss = dist[i]; } }); }
        sts.push({ ss, name, k: idxAt(ss) });
      });
    } else {
      const nSt = def.nSt || Math.max(2, Math.round((total - 300) / GAP) + 1);
      for (let q = 0; q < nSt; q++) {
        const ss = def.loop ? total * (q / nSt) : 150 + (total - 300) * (q / (nSt - 1)); const k = idxAt(ss); const pp = path[k]; if (!def.nSt && q > 0 && q < nSt - 1 && isWater(pp[0], pp[1])) continue;
        let name = def.names && def.names[q] ? def.names[q] : nameAt(pp[0], pp[1]);
        if (airport && q === nSt - 1) name = airport.id === "csmia" ? "Mumbai Airport T2" : "Navi Mumbai Airport";
        sts.push({ ss, name, k });
      }
    }
    const plateaus = sts.map((st) => { let k0 = st.k, k1 = st.k; while (k0 > 0 && st.ss - dist[k0 - 1] <= 58) k0--; while (k1 < n0 - 1 && dist[k1 + 1] - st.ss <= 58) k1++; return { k0, k1 }; });
    // station platforms and canopies are wider than the deck: any road under one lifts the platform too
    for (const pl of plateaus) for (let i = pl.k0; i <= pl.k1; i++) { const px = path[i][0], pz = path[i][1]; city.nearSegs(px, pz, 30, (r, j) => { if (r.tunnel) return; const q = city.seg(r, j, px, pz); if (q.d > r.width / 2 + 10.5) return; req[i] = Math.max(req[i], q.y + CLEAR); }); }
    const GRAD = 0.035; const ys = Float32Array.from(req);
    const limit = () => { for (let i = 1; i < n0; i++) ys[i] = Math.max(ys[i], ys[i - 1] - GRAD * (dist[i] - dist[i - 1])); for (let i = n0 - 2; i >= 0; i--) ys[i] = Math.max(ys[i], ys[i + 1] - GRAD * (dist[i + 1] - dist[i])); };
    const flat = () => { for (const pl of plateaus) { let m = -1e9; for (let i = pl.k0; i <= pl.k1; i++) m = Math.max(m, ys[i]); for (let i = pl.k0; i <= pl.k1; i++) ys[i] = m; } };
    flat(); limit();
    for (let rep = 0; rep < 4; rep++) { const sm = smooth(ys, 4); for (let i = 0; i < n0; i++) ys[i] = Math.max(req[i], sm[i]); flat(); limit(); }
    const pts = []; let s = 0;
    path.forEach((p, i) => { if (i) s += Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1]); pts.push({ x: p[0], z: p[1], y: ys[i], g: gr[i], s }); });
    const stations = sts.map((st) => { const p = pts[st.k]; return { s: st.ss, x: p.x, z: p.z, y: p.y, k: st.k, name: st.name }; });
    lines.push({ id: def.id, name: def.name, color: def.color, halfW: 6.0, pts, len: s, stations, fast: !!def.fast, loop: !!def.loop, piers: [] });
  }
  // one pier every ~36 m on the centre line, under the deck, standing clear of every road. A pier that would land on a road slides along the line a little,
  // and is left out if there is no free spot (the girder simply spans the road). Rendering and collisions both read this list.
  for (const L of lines) {
    for (let i = 3; i < L.pts.length - 4; i += 3) {
      let best = null;
      for (const dk of [0, 1, -1, 2, -2]) {
        const k = i + dk; if (k < 1 || k >= L.pts.length - 2) continue; const p = L.pts[k], q = L.pts[k + 1];
        if (city.blockedByRoad(p.x, p.z, p.y, null, 2.8)) continue;
        const gy = Math.max(-3, city.groundH(p.x, p.z)); const hgt = p.y - 1.7 - gy; if (hgt < 1.5) continue;
        best = { k, x: p.x, z: p.z, rot: Math.atan2(q.z - p.z, q.x - p.x), y: p.y, base: gy, h: hgt }; break;
      }
      if (best) L.piers.push(best);
    }
  }
  return lines;
}
export { isWater, shoreDist, baseH };
