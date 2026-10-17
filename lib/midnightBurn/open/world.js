// Midnight Burn — filling the city: buildings, street lamps, trees, landmarks, and everything a car can hit.
import { W, mx, mz, mulberry, baseH, shoreDist, isWater, districtAt, districtDens, DISTRICTS, sstep, AIRPORTS, inAirport } from "./geo";
import { buildCity, CLS } from "./roads";
import { planSites } from "./festival";

export const CH = 256;                    // chunk size in metres
export const NCH = Math.ceil(W / CH);

const STYLE_COLORS = {
  old: [0xcfa77a, 0xb98a63, 0xd8b88d, 0x9bb0a0, 0xc79b8f],
  colonial: [0xc9a46b, 0xb8895a, 0xd4b27c],
  dense: [0xd69a7a, 0x8fb7a5, 0xe0c27a, 0x8aa6c9, 0xc98a9a, 0xb7a58a, 0xd8d0c0],
  suburb: [0xe3d3b4, 0xbfc9d6, 0xd8a27c, 0xc5d6bd, 0xd0c4e0],
  upscale: [0xe9e2d0, 0xcfd8e0, 0xdcd0b8],
  tower: [0xaab6c8, 0xc8ccd6, 0x9aa8bb, 0xd0d4dc],
  glass: [0x6f9fc4, 0x84b4d8, 0x5f8db0, 0x9cc6e0],
  mixed: [0xd9c4a0, 0xb0c4d0, 0xd8a890, 0xc0c8a8],
  planned: [0xd8cdb8, 0xc0ccd8, 0xb8d0c4, 0xe0c8a8],
  industrial: [0x8a96a4, 0x7c8a80, 0xa09a8c, 0x6f7d96],
  port: [0x7d8ba0, 0x9a6a4a, 0x5f7a90],
  forest: [0xd0c0a0, 0xb0b8a0],
  future: [0x5fd0e8, 0x8a7cff, 0x4fe0b8, 0xb8c8ff, 0xe08aff],
};

export function createCityWorld(seed = 7, era = "now") {
  const F = era === "2046";
  const city = buildCity(seed, era);
  const rnd = mulberry(seed * 31 + 5);
  const { roads } = city;

  // ---- buildings ------------------------------------------------------------------------------------------------
  const buildings = [];
  const BG = 40, bgrid = new Map(); const bk = (i, j) => i * 2048 + j;
  const tooClose = (x, z, rad) => {
    const i0 = Math.floor((x - rad - 30) / BG), i1 = Math.floor((x + rad + 30) / BG), j0 = Math.floor((z - rad - 30) / BG), j1 = Math.floor((z + rad + 30) / BG);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const l = bgrid.get(bk(i, j)); if (!l) continue; for (const b of l) if (Math.hypot(b.x - x, b.z - z) < (b.r + rad) * 0.8) return true; }
    return false;
  };
  const roadClear = (x, z, margin) => {
    let ok = true;
    city.nearSegs(x, z, margin + 14, (r, i) => { if (!ok) return; const q = city.seg(r, i, x, z); if (q.d < r.width / 2 + margin) ok = false; });
    return ok;
  };
  function tryPlace(x, z, rot, w, d, dens, strict) {
    if (x < 30 || z < 30 || x > W - 30 || z > W - 30) return false;
    if (shoreDist(x, z) < 30 || inAirport(x, z, 60)) return false;
    const hb = baseH(x, z); if (hb > 55) return false;
    const r = Math.hypot(w, d) / 2;
    if (Math.abs(baseH(x + 10, z) - hb) > 3.4 || Math.abs(baseH(x, z + 10) - hb) > 3.4) return false;
    const c = Math.cos(rot), s = Math.sin(rot);
    const pts = [[0, 0], [w / 2, d / 2], [-w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2]];
    for (const [a, b] of pts) { const px = x + c * a - s * b, pz = z + s * a + c * b; if (shoreDist(px, pz) < 14 || !roadClear(px, pz, strict ? 3.2 : 2.2)) return false; }
    if (tooClose(x, z, r)) return false;
    if (city.metroNear(x, z, r + 2)) return false;
    const dist = districtAt(x, z); let style = dist ? dist.style : "mixed";
    if (F && (style === "tower" || style === "glass" || (style === "planned" && rnd() < 0.5) || (style === "mixed" && rnd() < 0.4))) style = "future";
    let range = dist ? dist.h : [10, 26]; if (F) { const m = style === "future" ? 1.55 : 1.18; range = [range[0] * m, range[1] * m]; }
    const t = Math.pow(rnd(), style === "tower" || style === "glass" || style === "future" ? 1.1 : 1.9);
    let h = range[0] + (range[1] - range[0]) * t;
    if (style === "glass" || style === "tower" || style === "future") { if (rnd() < (F ? 0.14 : 0.08)) h *= 1.4; }
    if (style === "forest") { if (rnd() > 0.2) return false; }
    const pal = STYLE_COLORS[style] || STYLE_COLORS.mixed;
    const b = { x, z, w, d, h, rot, r, style, color: pal[Math.floor(rnd() * pal.length)], y: hb, lit: rnd(), roof: rnd() < 0.5 ? 0 : 1, id: buildings.length };
    buildings.push(b);
    const k = bk(Math.floor(x / BG), Math.floor(z / BG)); let l = bgrid.get(k); if (!l) bgrid.set(k, (l = [])); l.push(b);
    return true;
  }
  // festival sites: reserved before any building goes up, so there is an open plot in front of each future pandal
  const festSites = era === "now" ? [] : planSites({ city, districts: DISTRICTS, rnd, shoreDist, baseH, roadClear, inAirport, W, reserve: (s) => { const b = { x: s.x, z: s.z, r: 38 }; const k = bk(Math.floor(s.x / BG), Math.floor(s.z / BG)); let l = bgrid.get(k); if (!l) bgrid.set(k, (l = [])); l.push(b); } });
  for (const r of roads) {
    if (r.ramp || (r.cls === "hwy" && r.ground === false && false)) continue;
    const inset = r.width / 2 + 4;
    for (const side of [-1, 1]) {
      let s = 6;
      while (s < r.len - 8) {
        // find the point on the road at arc length s
        let i = 0; while (i < r.pts.length - 2 && r.pts[i + 1].s < s) i++;
        const p = r.pts[i], q = r.pts[i + 1]; const t = Math.hypot(q.x - p.x, q.z - p.z) || 1;
        const tx = (q.x - p.x) / t, tz = (q.z - p.z) / t; const rot = Math.atan2(tz, tx);
        const w = 11 + rnd() * 15, d = 11 + rnd() * 14;
        const step = w + 2 + rnd() * 3;
        const mx = p.x, mz = p.z;
        if (p.w > 0.25) { s += 20; continue; }
        const dens = districtDens(mx, mz);
        const setback = r.cls === "hwy" ? 12 + rnd() * 12 : 1.5 + rnd() * 4;
        if (rnd() < Math.min(1, dens * 1.9)) {
          const off = inset + setback + d / 2;
          const cx = mx + -tz * side * off, cz = mz + tx * side * off;
          tryPlace(cx, cz, rot, w, d, dens, false);
        }
        s += step;
      }
    }
  }
  // second rows and open plots in the built-up areas
  for (let gx = 40; gx < W - 40; gx += 24) for (let gz = 40; gz < W - 40; gz += 24) {
    const x = gx + rnd() * 22, z = gz + rnd() * 22; const dens = districtDens(x, z);
    if (dens < 0.3 || rnd() > Math.min(1, dens * 1.5)) continue;
    const nr = city.nearestRoad(x, z, 60); let rot = rnd() * 3.14;
    if (nr) { const p = nr.road.pts[nr.i], q = nr.road.pts[nr.i + 1]; rot = Math.atan2(q.z - p.z, q.x - p.x); }
    tryPlace(x, z, rot, 12 + rnd() * 14, 12 + rnd() * 14, dens, true);
  }

  // ---- street lamps ---------------------------------------------------------------------------------------------
  const lamps = []; // {x,z,y,c(0 sodium,1 white,2 blue), h}
  for (const r of roads) {
    const gap = r.cls === "hwy" ? 42 : r.cls === "art" ? 38 : 52;
    for (let s = gap * 0.5; s < r.len; s += gap) {
      let i = 0; while (i < r.pts.length - 2 && r.pts[i + 1].s < s) i++;
      const p = r.pts[i], q = r.pts[i + 1]; const t = Math.hypot(q.x - p.x, q.z - p.z) || 1; const tx = (q.x - p.x) / t, tz = (q.z - p.z) / t;
      const side = (Math.floor(s / gap) % 2) ? 1 : -1; const off = r.width / 2 + 0.7; const both = r.cls === "hwy";
      const col = r.scenic ? 1 : r.cls === "hwy" ? 2 : 0;
      if (p.tun) continue;
      for (const sd of both ? [-1, 1] : [side]) {
        const lx = p.x + -tz * sd * off, lz = p.z + tx * sd * off;
        if (isWater(lx, lz) && p.w < 0.3) continue;
        lamps.push({ x: lx, z: lz, y: p.y, c: col, h: r.cls === "hwy" ? 10 : 8, side: sd, tx, tz });
      }
    }
  }

  // ---- trees (palms along the shore roads, banyans in the green belts) ----------------------------------------------
  const trees = []; // {x,z,y,k(0 palm,1 round,2 tall), s}
  for (const r of roads) {
    if (!r.scenic) continue;
    for (let s = 10; s < r.len; s += 22) {
      let i = 0; while (i < r.pts.length - 2 && r.pts[i + 1].s < s) i++;
      const p = r.pts[i], q = r.pts[i + 1]; const t = Math.hypot(q.x - p.x, q.z - p.z) || 1; const tx = (q.x - p.x) / t, tz = (q.z - p.z) / t;
      for (const sd of [-1, 1]) { const o = r.width / 2 + 4.2; const x = p.x + -tz * sd * o, z = p.z + tx * sd * o; if (!isWater(x, z) && p.w < 0.2) trees.push({ x, z, y: p.y, k: 0, s: 0.9 + rnd() * 0.5 }); }
    }
  }
  for (let gx = 20; gx < W - 20; gx += 16) for (let gz = 20; gz < W - 20; gz += 16) {
    const x = gx + rnd() * 16, z = gz + rnd() * 16; const d = districtAt(x, z); const dens = districtDens(x, z);
    const forest = d && d.style === "forest" ? 1 - sstep(0.5, 1.1, Math.hypot(x - d.x, z - d.z) / d.r) : 0;
    const p = Math.max(forest * 0.55, dens < 0.5 ? 0.025 : 0.012);
    if (rnd() > p || shoreDist(x, z) < 12 || inAirport(x, z, 20) || !roadClear(x, z, 5)) continue;
    if (tooClose(x, z, 4)) continue;
    trees.push({ x, z, y: baseH(x, z), k: forest > 0.3 ? (rnd() < 0.4 ? 2 : 1) : 1, s: 0.8 + rnd() * 0.9 });
  }

  // ---- chunk buckets ---------------------------------------------------------------------------------------------
  const chunks = new Map(); const ck = (i, j) => i * 64 + j;
  const bucket = (arr, name, f = (o) => o) => { for (const o of arr) { const i = Math.floor(o.x / CH), j = Math.floor(o.z / CH); if (i < 0 || j < 0 || i >= NCH || j >= NCH) continue; const k = ck(i, j); let c = chunks.get(k); if (!c) chunks.set(k, (c = { i, j, buildings: [], lamps: [], trees: [], extras: [] })); c[name].push(o); } };
  bucket(buildings, "buildings"); bucket(lamps, "lamps"); bucket(trees, "trees");

  // ---- colliders -------------------------------------------------------------------------------------------------
  const CG = 32, cgrid = new Map(); const gk = (i, j) => i * 4096 + j;
  const add = (o, x0, z0, x1, z1) => { for (let i = Math.floor(x0 / CG); i <= Math.floor(x1 / CG); i++) for (let j = Math.floor(z0 / CG); j <= Math.floor(z1 / CG); j++) { const k = gk(i, j); let l = cgrid.get(k); if (!l) cgrid.set(k, (l = [])); l.push(o); } };
  for (const b of buildings) { const c = Math.cos(b.rot), s = Math.sin(b.rot); const o = { t: 0, x: b.x, z: b.z, hw: b.w / 2, hd: b.d / 2, c, s, y: b.y, h: b.h }; add(o, b.x - b.r, b.z - b.r, b.x + b.r, b.z + b.r); }
  const wallOpen = (r, p, q, nx, nz, sd, hw) => {
    let open = false;
    for (const f of [0, 0.5, 1]) {
      const mx = p.x + (q.x - p.x) * f + nx * sd * hw, mz = p.z + (q.z - p.z) * f + nz * sd * hw;
      city.nearSegs(mx, mz, 30, (o, k) => { if (open || o === r) return; const w = city.seg(o, k, mx, mz); if (w.d < o.width / 2 + 4.5 && Math.abs(w.y - p.y) < 3) open = true; });
      if (open) break;
    }
    return open;
  };
  const walls = [];
  const addWall = (x1, z1, x2, z2, y) => { const o = { t: 1, x1, z1, x2, z2, y }; walls.push(o); add(o, Math.min(x1, x2) - 1, Math.min(z1, z2) - 1, Math.max(x1, x2) + 1, Math.max(z1, z2) + 1); };
  for (const r of roads) {
    const hw = r.width / 2 + 0.35;
    for (let i = 0; i < r.pts.length - 1; i += 1) {
      const p = r.pts[i], q = r.pts[i + 1]; const elevated = (p.y - p.g > 1.8 || p.w > 0.35) && (q.y - q.g > 1.8 || q.w > 0.35);
      const t = Math.hypot(q.x - p.x, q.z - p.z) || 1; const nx = -(q.z - p.z) / t, nz = (q.x - p.x) / t;
      if (p.tun && q.tun) { for (const sd of [-1, 1]) addWall(p.x + nx * sd * (hw + 0.2), p.z + nz * sd * (hw + 0.2), q.x + nx * sd * (hw + 0.2), q.z + nz * sd * (hw + 0.2), (p.y + q.y) / 2); }
      else if (elevated) { for (const sd of [-1, 1]) {
        if (!wallOpen(r, p, q, nx, nz, sd, hw)) addWall(p.x + nx * sd * hw, p.z + nz * sd * hw, q.x + nx * sd * hw, q.z + nz * sd * hw, (p.y + q.y) / 2); } }
      else if (r.scenic && r.id === "marine") { const sd = shoreDist(p.x + nx * 30, p.z + nz * 30) < shoreDist(p.x - nx * 30, p.z - nz * 30) ? 1 : -1; if (!wallOpen(r, p, q, nx, nz, sd, hw)) addWall(p.x + nx * sd * hw, p.z + nz * sd * hw, q.x + nx * sd * hw, q.z + nz * sd * hw, p.y); }
    }
  }
  for (const L of city.metro) for (let i = 0; i < L.pts.length - 1; i += 3) { const p = L.pts[i], q = L.pts[i + 1]; const t = Math.hypot(q.x - p.x, q.z - p.z) || 1; const nx = -(q.z - p.z) / t, nz = (q.x - p.x) / t; for (const sd of [-1, 1]) { const px = p.x + nx * sd * L.halfW, pz = p.z + nz * sd * L.halfW; const gy = city.groundH(px, pz); add({ t: 0, x: px, z: pz, hw: 1.0, hd: 1.0, c: 1, s: 0, y: gy, h: p.y - gy }, px - 1.5, pz - 1.5, px + 1.5, pz + 1.5); } }
  // flyover and viaduct piers, lamp posts and tree trunks are solid too
  for (const r of roads) for (let i = 0; i < r.pts.length - 1; i += 3) {
    const p = r.pts[i], q = r.pts[i + 1]; if (p.tun || !(p.y - p.g > 2.8) || !(p.y - p.g > 1.4 || q.y - q.g > 1.4 || p.w > 0.35)) continue;
    const bot = Math.max(p.g, -3), hgt = p.y - 1.3 - bot; if (hgt <= 1) continue;
    const t = Math.hypot(q.x - p.x, q.z - p.z) || 1; const rot = Math.atan2(q.z - p.z, q.x - p.x), c = Math.cos(rot), sn = Math.sin(rot), nx = -(q.z - p.z) / t, nz = (q.x - p.x) / t;
    const hwr = r.width / 2; const offs = r.width > 16 ? [-hwr * 0.5, hwr * 0.5] : [0];
    for (const oo of offs) { const px = p.x + nx * oo, pz = p.z + nz * oo; add({ t: 0, x: px, z: pz, hw: 1.15, hd: 1.15, c, s: sn, y: bot, h: hgt }, px - 2, pz - 2, px + 2, pz + 2); }
  }
  for (const l of lamps) add({ t: 0, x: l.x, z: l.z, hw: 0.22, hd: 0.22, c: 1, s: 0, y: l.y, h: l.h }, l.x - 0.5, l.z - 0.5, l.x + 0.5, l.z + 0.5);
  for (const tr of trees) { const rr = 0.3 + tr.s * 0.15; add({ t: 0, x: tr.x, z: tr.z, hw: rr, hd: rr, c: 1, s: 0, y: tr.y, h: 7 }, tr.x - 1, tr.z - 1, tr.x + 1, tr.z + 1); }
  const queryColliders = (x, z, fn) => { const l = cgrid.get(gk(Math.floor(x / CG), Math.floor(z / CG))); if (l) for (const o of l) fn(o); };

  // ---- landmarks & points of interest --------------------------------------------------------------------------------
  const landmarks = [
    { id: "gateway", name: "Gateway of India", x: mx(1.93), z: mz(5.93), kind: "gateway" },
    { id: "cst", name: "Chhatrapati Shivaji Terminus", x: mx(1.98), z: mz(5.4), kind: "cst" },
    { id: "marinedrive", name: "Queen's Necklace, Marine Drive", x: mx(1.76), z: mz(4.85), kind: "marine" },
    { id: "hajiali", name: "Worli Sea Face", x: mx(1.72), z: mz(4.2), kind: "none" },
    { id: "bkc", name: "BKC Towers", x: mx(2.2), z: mz(3.05), kind: "none" },
    { id: "dharavi", name: "Dharavi Rooftops", x: mx(2.3), z: mz(3.55), kind: "none" },
    { id: "powai", name: "Powai Lake", x: mx(2.55), z: mz(2.3), kind: "none" },
    { id: "upvan", name: "Upvan Lake, Thane", x: mx(3.0), z: mz(0.8), kind: "none" },
    { id: "yeoor", name: "Yeoor Hills Viewpoint", x: mx(2.5), z: mz(0.5), kind: "none" },
    { id: "vashiarch", name: "Vashi Gateway Arch", x: mx(3.95), z: mz(3.3), kind: "arch" },
    { id: "palmbeach", name: "Palm Beach Promenade", x: mx(3.8), z: mz(3.4), kind: "none" },
    { id: "belapur", name: "Belapur Fort Hill", x: mx(4.3), z: mz(4.75), kind: "none" },
    { id: "jnpt", name: "JNPT Container Port", x: mx(4.2), z: mz(6.05), kind: "cranes" },
    { id: "sealink", name: "Bandra–Worli Sea Link", x: mx(1.1), z: mz(3.35), kind: "sealink" },
    { id: "atal", name: "Atal Setu", x: mx(3.15), z: mz(5.35), kind: "none" },
    { id: "ghat", name: "Khopoli Ghat Summit", x: mx(6.05), z: mz(2.7), kind: "none" },
    { id: "juhu", name: "Juhu Beach", x: mx(1.1), z: mz(2.3), kind: "none" },
    { id: "kharghar", name: "Kharghar Central Park", x: mx(5.1), z: mz(5.35), kind: "none" },
    { id: "csmia", name: "Mumbai Airport (CSMIA)", x: AIRPORTS[0].x + AIRPORTS[0].terminal.x, z: AIRPORTS[0].z + AIRPORTS[0].terminal.z, kind: "airport" },
    { id: "nmia", name: "Navi Mumbai Airport (NMIA)", x: AIRPORTS[1].x + AIRPORTS[1].terminal.x, z: AIRPORTS[1].z + AIRPORTS[1].terminal.z + 60, kind: "airport" },
    { id: "bandrafort", name: "Bandra Fort & Land's End", x: mx(1.35), z: mz(3.0), kind: "none" },
    { id: "elephanta", name: "Uran Viewpoint", x: mx(4.55), z: mz(6.3), kind: "none" },
    { id: "karnala", name: "Karnala Ridge", x: mx(5.7), z: mz(4.3), kind: "none" },
    { id: "mbpexit", name: "Expressway Toll Plaza, Khalapur", x: mx(6.5), z: mz(3.6), kind: "none" },
    { id: "lonavala", name: "Lonavala Tiger Point", x: mx(7.0), z: mz(3.95), kind: "none" },
    { id: "hinjewadi", name: "Hinjewadi IT Park", x: mx(7.8), z: mz(4.95), kind: "none" },
    { id: "shaniwar", name: "Shaniwar Wada, Pune", x: mx(8.1), z: mz(5.55), kind: "none" },
    { id: "hadapsar", name: "Hadapsar Junction", x: mx(8.2), z: mz(6.5), kind: "none" },
    { id: "vasaifort", name: "Vasai Fort", x: mx(0.95), z: mz(-0.55), kind: "none" },
    { id: "kalyanfort", name: "Durgadi Fort, Kalyan", x: mx(4.45), z: mz(0.4), kind: "none" },
    { id: "mulund", name: "Mulund Toll Naka", x: mx(2.95), z: mz(2.4), kind: "none" },
    { id: "thanecoastal", name: "Thane Coastal Road", x: mx(3.2), z: mz(1.6), kind: "none" },
    { id: "palmbeach2", name: "Palm Beach Road, Nerul", x: mx(4.1), z: mz(4.0), kind: "none" },
  ];
  for (const l of landmarks) { // bridges: use the deepest-water point of their deck
    const rid = l.id === "sealink" ? "weh" : l.id === "atal" ? "atal" : null; if (!rid) continue;
    const r = roads.find((q) => q.id === rid); let best = null, bd = 1e9; for (const p of r.pts) { const d = shoreDist(p.x, p.z); if (d < bd) { bd = d; best = p; } }
    l.x = best.x; l.z = best.z; l.rx = best.x; l.rz = best.z; l.ry = best.y; l.onBridge = true;
  }
  // put every landmark on a reachable bit of road
  for (const l of landmarks) { if (l.onBridge) continue; const nr = city.nearestRoad(l.x, l.z, 600, (r) => r.cls !== "hwy" || r.ground, null); if (nr) { l.rx = nr.x; l.rz = nr.z; l.ry = nr.y; } else { l.rx = l.x; l.rz = l.z; l.ry = 0; } }

  const world = { seed, era, festSites, city, buildings, lamps, trees, chunks, landmarks, queryColliders, walls, CH, NCH };
  const wallBuckets = new Map(); for (const o of walls) { const k = ck(Math.floor(((o.x1 + o.x2) / 2) / CH), Math.floor(((o.z1 + o.z2) / 2) / CH)); let l = wallBuckets.get(k); if (!l) wallBuckets.set(k, (l = [])); l.push(o); }
  world.wallsIn = (i, j) => wallBuckets.get(ck(i, j)) || [];
  world.chunk = (i, j) => chunks.get(ck(i, j)) || { i, j, buildings: [], lamps: [], trees: [], extras: [] };
  return world;
}
