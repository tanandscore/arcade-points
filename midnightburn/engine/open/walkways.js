// Midnight Burn - walkways. People never walk across a road at street level any more.
// Wherever a pavement meets a road (a junction), the pavement is closed to walkers. At the busiest crossings the city builds a way over or under the road:
//   - a SKYWALK (a covered footbridge with a long stair up each side) over the wider roads, and
//   - a SUBWAY (a lit entrance building on each side; walkers go in and come out on the far side) under the narrower ones.
// Everywhere else the pavement simply ends at the junction and people turn back. This file only PLANS: where the crossings are, which ones get a structure,
// and the zones the crowd obeys. chunks3d.js draws the structures (walkgeo.js) and crowd.js makes people use them.
import { districtDens, isWater, shoreDist } from "./geo";

export const WK = { LS: 10.5, H: 5.2, W: 1.9, STEP: 2, SEP: 24, SUB_LEN: 3.4, SUB_W: 2.5 };
const STEP = WK.STEP;

const eligible = (r) => !r.ramp && r.cls !== "hwy" && r.ground !== false && !(r.pts[0] && r.pts[0].tun);

// the point at arc length s on a road, with its direction (binary search)
export function atS(r, s) {
  const pts = r.pts; let lo = 0, hi = pts.length - 2; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pts[m].s <= s) lo = m; else hi = m - 1; }
  const a = pts[lo], b = pts[lo + 1]; const sl = b.s - a.s || 1, t = Math.max(0, Math.min(1, (s - a.s) / sl)); const dx = b.x - a.x, dz = b.z - a.z, l = Math.hypot(dx, dz) || 1;
  return { x: a.x + dx * t, z: a.z + dz * t, y: a.y + (b.y - a.y) * t, tx: dx / l, tz: dz / l, p: a, i: lo };
}
// the walking line beside a road: side +1/-1, off metres from the road centre (the same convention the crowd has always used)
export function lineAt(r, s, side, off) {
  const a = atS(r, s); const nx = -a.tz * side, nz = a.tx * side;
  return { x: a.x + nx * off, z: a.z + nz * off, y: a.y + 0.16, tx: a.tx, tz: a.tz, nx, nz, p: a.p, i: a.i };
}

export function planWalkways(world) {
  const city = world.city, roads = city.roads;
  const zones = new Map(); // road.idx * 2 + (side > 0 ? 1 : 0)  ->  [{ a, b, kind: "bar" | "sky" | "sub", st }] sorted by a
  const cands = [];
  for (const r of roads) {
    if (!eligible(r) || r.len < 24) continue;
    const hw = r.width / 2, off = hw + 1.2, n = Math.floor(r.len / STEP);
    for (const side of [-1, 1]) {
      const code = new Uint8Array(n + 1); // 0 free, 1 a road crosses here at street level, 2 not a pavement (tunnel, bridge, flyover, water)
      const hitR = new Array(n + 1).fill(null), hitI = new Int32Array(n + 1), info = {}; // which road blocks the sample (Upgrade 34: so a footbridge is only ever built ACROSS a road)
      for (let i = 0; i <= n; i++) {
        const L = lineAt(r, i * STEP, side, off), p = L.p;
        if (p.tun || p.w > 0.25 || p.y - p.g > 1.2 || p.over) { code[i] = 2; continue; }
        if (isWater(L.x, L.z) && p.w < 0.3) { code[i] = 2; continue; }
        if (city.blockedByRoad(L.x, L.z, L.y + 3.5, r, 0.4, L.y - 3.0, -1, info)) { code[i] = 1; hitR[i] = info.r; hitI[i] = info.i; }
      }
      // runs of blocked samples (gaps of one sample are bridged)
      const list = []; let i = 0;
      while (i <= n) {
        if (!code[i]) { i++; continue; }
        let j = i, hasTwo = code[i] === 2; while (j + 2 <= n && (code[j + 1] || code[j + 2])) { j++; if (code[j] === 2) hasTwo = true; }
        while (j < n && code[j + 1]) { j++; if (code[j] === 2) hasTwo = true; }
        const sa = Math.max(0, (i - 0.5) * STEP), sb = Math.min(r.len, (j + 0.5) * STEP);
        list.push({ a: sa, b: sb, two: hasTwo, i0: i, i1: j });
        i = j + 1;
      }
      const zs = []; zones.set(r.idx * 2 + (side > 0 ? 1 : 0), zs);
      for (const run of list) {
        const z = { a: run.a - 0.9, b: run.b + 0.9, kind: "bar", st: null, sa: run.a, sb: run.b };
        zs.push(z);
        const wb = run.b - run.a;
        if (run.two || wb > 50 || wb < 3) continue;
        // Upgrade 34: a footbridge or subway goes ACROSS a road. Where the other road only grazes the pavement at a shallow angle (a side road merging in, a fork, a
        // roundabout's edge) the blocked stretch runs ALONG the road, and a bridge there would lie in the middle of the traffic. Such runs just stay closed.
        { let dmax = 0, wmax = 0;
          for (let k = run.i0; k <= run.i1; k++) { const R = hitR[k]; if (!R) continue; const q = R.pts[hitI[k]], q2 = R.pts[hitI[k] + 1] || q, ql = Math.hypot(q2.x - q.x, q2.z - q.z) || 1;
            const A = atS(r, Math.min(r.len, k * STEP)); const dd = Math.abs((q2.x - q.x) / ql * A.tx + (q2.z - q.z) / ql * A.tz); if (dd > dmax) dmax = dd; if (R.width > wmax) wmax = R.width; }
          if (dmax > 0.82 || wb > wmax / Math.max(0.5, Math.sqrt(1 - dmax * dmax)) * 1.5 + 6) continue; }
        if (run.a < WK.LS + 5 || run.b > r.len - WK.LS - 5) continue;
        // both approaches must be clean pavement
        let clean = true; for (let k = Math.max(0, Math.floor((run.a - WK.LS - 3) / STEP)); k < run.i0 && clean; k++) if (code[k]) clean = false;
        for (let k = run.i1 + 1; k <= Math.min(n, Math.ceil((run.b + WK.LS + 3) / STEP)) && clean; k++) if (code[k]) clean = false;
        if (!clean) continue;
        const M = lineAt(r, (run.a + run.b) / 2, side, off);
        if (districtDens(M.x, M.z) < 0.22 || isWater(M.x, M.z) || shoreDist(M.x, M.z) < 25) continue;
        if (city.metroNear && city.metroNear(M.x, M.z, wb / 2 + WK.LS + 6)) continue;
        cands.push({ r, side, off, sa: run.a, sb: run.b, wb, mx: M.x, mz: M.z, z });
      }
    }
  }
  // the widest crossings first; no two structures closer than SEP metres
  cands.sort((p, q) => q.wb - p.wb || p.r.idx - q.r.idx);
  const grid = new Map(), gk = (i, j) => i * 4096 + j, G = WK.SEP;
  const structs = [];
  for (const c of cands) {
    const gi = Math.floor(c.mx / G), gj = Math.floor(c.mz / G); let near = false;
    for (let di = -1; di <= 1 && !near; di++) for (let dj = -1; dj <= 1 && !near; dj++) { const l = grid.get(gk(gi + di, gj + dj)); if (l) for (const o of l) if (Math.hypot(o.mx - c.mx, o.mz - c.mz) < G) { near = true; break; } }
    if (near) continue;
    // the wider crossings get a skywalk; the narrower ones a subway; in between, about two in five are subways (a fixed pick, so the city is the same every time)
    const pick = Math.abs(Math.sin(c.mx * 12.9898 + c.mz * 78.233) * 43758.5453) % 1;
    const sky = c.wb >= 34 || (c.wb >= 11 && pick > 0.4);
    const st = { id: structs.length, kind: sky ? "sky" : "sub", r: c.r, side: c.side, off: c.off, sa: c.sa, sb: c.sb, wb: c.wb, mx: c.mx, mz: c.mz, LS: WK.LS, H: WK.H };
    if (sky) { st.s0 = c.sa - 1.4; st.s1 = c.sb + 1.4; st.a = st.s0 - st.LS; st.b = st.s1 + st.LS; } // deck from s0 to s1, a stair of LS metres each side
    else { st.a = c.sa - 1.3 - WK.SUB_LEN; st.b = c.sb + 1.3 + WK.SUB_LEN; st.in0 = st.a + 0.5; st.in1 = st.b - 0.5; } // two entrance buildings; walkers are underground between in0 and in1
    c.z.kind = st.kind; c.z.st = st; c.z.a = sky ? st.a : st.in0; c.z.b = sky ? st.b : st.in1;
    structs.push(st);
    let l = grid.get(gk(gi, gj)); if (!l) grid.set(gk(gi, gj), (l = [])); l.push(c);
  }
  for (const zs of zones.values()) zs.sort((p, q) => p.a - q.a);
  // chunk lookup (a structure is drawn by the chunk its middle is in)
  const CHK = 256, byChunk = new Map();
  for (const st of structs) { const k = Math.floor(st.mx / CHK) * 128 + Math.floor(st.mz / CHK); let l = byChunk.get(k); if (!l) byChunk.set(k, (l = [])); l.push(st); }
  const out = {
    structs, zones,
    zonesOf: (r, side) => zones.get(r.idx * 2 + (side > 0 ? 1 : 0)) || [],
    inChunk: (ci, cj) => byChunk.get(ci * 128 + cj) || [],
    // height of the walking surface above the pavement at arc length s (skywalks only)
    heightAt(st, s) { if (st.kind !== "sky") return 0; if (s <= st.a || s >= st.b) return 0; if (s < st.s0) return st.H * (s - st.a) / st.LS; if (s <= st.s1) return st.H; return st.H * (1 - (s - st.s1) / st.LS); },
    // is the walking line at s inside a closed zone (a road crossing without a way over)?
    closedAt(r, side, s) { for (const z of out.zonesOf(r, side)) { if (z.a > s) break; if (z.kind !== "sky" && s > z.a && s < z.b) return true; } return false; },
  };
  return out;
}

// every point of a structure's walking line, for clearing lamps/furniture and for drawing: [{x,z,y,tx,tz,nx,nz,h}]
export function structLine(st, step = 1.0) {
  const r = st.r, pts = [];
  for (let s = st.a; s <= st.b + 1e-6; s += step) { const L = lineAt(r, Math.min(r.len, Math.max(0, s)), st.side, st.off); pts.push({ s, x: L.x, z: L.z, y: L.y, tx: L.tx, tz: L.tz, nx: L.nx, nz: L.nz }); }
  return pts;
}
