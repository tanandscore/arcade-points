// Midnight Burn — the metro. Elevated lines with stations every few hundred metres, drawn by chunks3d (viaduct, platforms)
// and run by render.js (trains that stop at every station). Lines are listed in the old 'km' map coordinates.
import { W, mx, mz, shoreDist, isWater, baseH, districtAt, DISTRICTS, AIRPORTS } from "./geo";

// 'now': the lines Mumbai, Navi Mumbai and Pune are building / have opened. '2046' adds a lot more.
const L_NOW = [
  { id: "M1", name: "Line 1 · Blue (Versova – Ghatkopar)", color: 0x3ea8ff, pts: [[1.12, 1.9], [1.5, 2.2], [1.9, 2.45], [2.3, 2.7], [2.7, 2.85], [2.95, 2.95]] },
  { id: "M2", name: "Line 2 · Yellow (Dahisar – Bandra)", color: 0xffd23a, pts: [[1.5, 0.3], [1.52, 0.9], [1.5, 1.5], [1.45, 2.05], [1.5, 2.55], [1.62, 2.95]] },
  { id: "M3", name: "Line 3 · Aqua (Colaba – Airport)", color: 0x35e0d0, pts: [[1.8, 5.78], [1.9, 5.35], [2.0, 4.85], [2.05, 4.3], [2.2, 3.7], [2.15, 3.2], [2.17, 2.9]], airport: "csmia" },
  { id: "M4", name: "Line 4 · Green (Wadala – Thane)", color: 0x3cff9a, pts: [[2.45, 4.35], [2.6, 3.85], [2.75, 3.3], [2.9, 2.75], [2.98, 2.2], [3.05, 1.7], [3.05, 1.2], [3.1, 0.85]] },
  { id: "M7", name: "Line 7 · Red (Dahisar – Andheri East)", color: 0xff4a4a, pts: [[1.72, 0.25], [1.82, 0.9], [1.95, 1.5], [2.05, 2.05], [1.95, 2.5]] },
  { id: "M9", name: "Line 9 · Orange (Thane – Kalyan)", color: 0xffa03a, pts: [[3.1, 1.25], [3.45, 1.2], [3.85, 1.05], [4.15, 0.7], [4.45, 0.4]] },
  { id: "NM1", name: "Navi Mumbai Line 1 (Belapur – Panvel)", color: 0x6aeaff, pts: [[4.45, 4.95], [4.8, 5.05], [5.1, 5.3], [5.3, 5.1], [5.45, 5.0]] },
  { id: "NM2", name: "Navi Mumbai Airport Line", color: 0xb06cff, pts: [[5.45, 5.0], [5.52, 5.3], [5.62, 5.55], [5.72, 5.7]], airport: "nmia" },
  { id: "NM3", name: "Navi Mumbai Line 3 (Vashi – Belapur)", color: 0xff7ad9, pts: [[3.98, 3.3], [4.02, 3.8], [4.12, 4.25], [4.3, 4.65], [4.45, 4.95]] },
  { id: "M6", name: "Line 6 · Pink (Lokhandwala – Vikhroli)", color: 0xff7ad9, pts: [[1.62, 2.4], [1.95, 2.3], [2.35, 2.3], [2.75, 2.4], [3.0, 2.5]] },
  { id: "M8", name: "Line 8 · Gold (Airport Link: CSMIA – Navi Mumbai)", color: 0xffd23a, pts: [[2.17, 2.95], [2.9, 3.25], [3.6, 3.55], [4.2, 4.4], [4.9, 5.05], [5.5, 5.5]] },
  { id: "M10", name: "Line 10 · Gaimukh – Mira Road", color: 0x7cff6a, pts: [[3.15, 1.0], [2.7, 0.8], [2.2, 0.55], [1.75, 0.4]] },
  { id: "M11", name: "Line 11 · Wadala – Gateway", color: 0x3ea8ff, pts: [[2.45, 4.35], [2.25, 4.8], [2.0, 5.3], [1.85, 5.7]] },
  { id: "M12", name: "Line 12 · Kalyan – Taloja", color: 0xff4a4a, pts: [[4.45, 0.4], [4.55, 1.3], [4.5, 2.3], [4.3, 3.2], [4.45, 4.0], [4.55, 4.7]] },
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
  { id: "T1", name: "Thane Ring Metro", color: 0x3cff9a, pts: [[3.05, 1.8], [3.6, 1.75], [3.95, 1.7], [4.25, 1.6]] },
  { id: "B1", name: "Bhiwandi Freight Line", color: 0xff4a4a, pts: [[3.05, 1.25], [3.9, 1.15], [4.05, 0.6], [4.0, 0.0], [3.95, -0.5]] },
  { id: "E1", name: "Expressway Metro (Panvel – Lonavala)", color: 0xb06cff, pts: [[5.45, 5.0], [5.8, 4.9], [6.15, 4.6], [6.5, 4.2], [6.85, 4.0]] },
  { id: "P3", name: "Pune Metro Orange (Hadapsar – Kothrud)", color: 0xffa03a, pts: [[8.2, 6.5], [8.2, 6.0], [8.1, 5.55], [8.3, 5.2], [8.35, 5.0]] },
  { id: "P4", name: "Pune–Talegaon Line", color: 0xff7ad9, pts: [[7.45, 4.45], [7.6, 4.8], [7.75, 5.4], [7.7, 6.0]] },
];

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
    // ground under the line (water counts as sea level) → a smooth deck 11.5 m above the highest nearby ground
    const gr = Float32Array.from(path.map((p) => Math.max(0, city.groundH(p[0], p[1]))));
    const mxG = new Float32Array(gr.length); for (let i = 0; i < gr.length; i++) { let m = -1e9; for (let k = Math.max(0, i - 6); k <= Math.min(gr.length - 1, i + 6); k++) m = Math.max(m, gr[k]); mxG[i] = m; }
    const ys = smooth(mxG, 10); const pts = []; let s = 0;
    path.forEach((p, i) => { if (i) s += Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1]); pts.push({ x: p[0], z: p[1], y: ys[i] + 11.5, g: gr[i], s }); });
    const stations = []; const GAP = 480;
    if (def.fast) { // bullet train: only a few stops, at the places named
      def.stops.forEach(([km, name], q) => {
        let ss = q === 0 ? 150 : q === def.stops.length - 1 ? s - 150 : 0;
        if (km) { const X = mx(km[0]), Z = mz(km[1]); let bd = 1e18; pts.forEach((p) => { const d = (p.x - X) ** 2 + (p.z - Z) ** 2; if (d < bd) { bd = d; ss = p.s; } }); }
        let k = 0; while (k < pts.length - 2 && pts[k + 1].s < ss) k++; const p = pts[k]; stations.push({ s: ss, x: p.x, z: p.z, y: p.y, k, name });
      });
      lines.push({ id: def.id, name: def.name, color: def.color, halfW: 11.2, pts, len: s, stations, fast: true }); continue;
    }
    const nSt = Math.max(2, Math.round((s - 300) / GAP) + 1);
    for (let q = 0; q < nSt; q++) {
      const ss = 150 + (s - 300) * (q / (nSt - 1)); let k = 0; while (k < pts.length - 2 && pts[k + 1].s < ss) k++; const p = pts[k]; if (q > 0 && q < nSt - 1 && isWater(p.x, p.z)) continue;
      let name = nameAt(p.x, p.z);
      if (airport && q === nSt - 1) name = airport.id === "csmia" ? "Mumbai Airport T2" : "Navi Mumbai Airport";
      stations.push({ s: ss, x: p.x, z: p.z, y: p.y, k, name });
    }
    lines.push({ id: def.id, name: def.name, color: def.color, halfW: 11.2, pts, len: s, stations });
  }
  return lines;
}
export { isWater, shoreDist, baseH };
