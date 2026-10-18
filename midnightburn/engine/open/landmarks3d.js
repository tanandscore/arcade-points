// Midnight Burn — the famous places: Gateway of India, CST, the Sea Link, Atal Setu, the Vashi arch and the JNPT port.
import * as THREE from "three";
import { GB, C } from "./chunks3d";
import { mulberry, isWater, AIRPORTS, HILLS } from "./geo";

const ico = new THREE.IcosahedronGeometry(1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 12, 1); cyl.translate(0, 0.5, 0);
const rod = (g, a, b, w, col) => { // a thin beam between two points
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l = Math.hypot(dx, dy, dz); const rot = Math.atan2(dz, dx); const tilt = Math.atan2(dy, Math.hypot(dx, dz));
  const U = rodGeo; g.geo(U, a[0], a[1], a[2], l, w, w, -rot, col, tilt);
};
const rodGeo = new THREE.BoxGeometry(1, 1, 1); rodGeo.translate(0.5, 0, 0);

export function buildLandmarks(world, mats) {
  const group = new THREE.Group(); const city = world.city; const g = new GB(); const glow = []; const lines = [];
  const get = (id) => world.landmarks.find((l) => l.id === id);
  const gh = (x, z) => city.groundH(x, z);
  const roadDir = (x, z) => { const n = city.nearestRoad(x, z, 80); if (!n) return 0; const a = n.road.pts[n.i], b = n.road.pts[n.i + 1]; return Math.atan2(b.z - a.z, b.x - a.x); };
  const stone = C(0x8c7352), stone2 = C(0xa38a63), dark = C(0x3a3430);
  // does a rectangle (centre, turn, size) touch a road at about its own height? (tunnels and roads far below are ignored)
  const roadHit = (x, z, rot, bw, bd, y0, margin = 1.2) => {
    const c = Math.cos(rot), s = Math.sin(rot); let hit = false; const nu = Math.max(2, Math.ceil(bw / 6)), nv = Math.max(2, Math.ceil(bd / 6));
    for (let iu = 0; iu <= nu && !hit; iu++) for (let iv = 0; iv <= nv && !hit; iv++) {
      const u = (iu / nu - 0.5) * bw, v = (iv / nv - 0.5) * bd, px = x + c * u - s * v, pz = z + s * u + c * v;
      city.nearSegs(px, pz, 14 + margin, (r, i) => { if (hit) return; const a = r.pts[i]; if (a.tun) return; const q = city.seg(r, i, px, pz); if (q.d < r.width / 2 + margin && q.y > y0 - 3) hit = true; });
    }
    return hit;
  };
  // the nearest spot to (x,z) where a building of this size stands clear of every road and out of the water
  const spot = (x, z, rot, bw, bd, maxR = 160, strict = false) => {
    const c = Math.cos(rot), s = Math.sin(rot); const wet = (px, pz) => [[0, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]].some(([a, b]) => isWater(px + c * a * bw / 2 - s * b * bd / 2, pz + s * a * bw / 2 + c * b * bd / 2));
    for (let rad = 0; rad <= maxR; rad += 8) { const n = rad ? Math.ceil((rad * 6.283) / 14) : 1; for (let k = 0; k < n; k++) { const a = (k / n) * 6.283 + rad * 0.37, px = x + Math.cos(a) * rad, pz = z + Math.sin(a) * rad; if (wet(px, pz)) continue; if (!roadHit(px, pz, rot, bw, bd, gh(px, pz), 2.5)) return [px, pz]; } }
    return strict ? null : [x, z];
  };
  // the biggest scale (1, .8, .62) at which a building fits clear of the roads near here; null if even the smallest does not
  const fit = (x, z, rot, bw, bd, maxR) => { for (const sc of [1, 0.8, 0.62]) { const q = spot(x, z, rot, bw * sc, bd * sc, maxR, true); if (q) return [q[0], q[1], sc]; } return null; };

  // Gateway of India
  { const l = get("gateway"); if (l) {
    const [x, z] = spot(l.x + 40, l.z - 30, -0.5, 44, 14), y = gh(x, z), rot = -0.5; const c = Math.cos(rot), s = Math.sin(rot);
    const at = (lx, lz) => [x + lx * c - lz * s, z + lx * s + lz * c];
    for (const sx of [-1, 1]) { const p = at(sx * 9.5, 0); g.box(p[0], y, p[1], 7, 22, 9, rot, stone); }
    const m = at(0, 0); g.box(m[0], y + 15, m[1], 26, 7, 9, rot, stone2); g.box(m[0], y + 22, m[1], 12, 4, 7, rot, stone);
    g.geo(ico, m[0], y + 27, m[1], 5, 4.4, 5, 0, stone2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = at(sx * 12.4, sz * 3.6); g.box(p[0], y + 22, p[1], 2.4, 7, 2.4, rot, stone2); g.geo(ico, p[0], y + 31, p[1], 1.5, 1.8, 1.5, 0, stone2); }
    for (let k = 0; k < 6; k++) { const p = at(-14 + k * 5.6, 8); glow.push(p[0], y + 0.6, p[1], 1, 0.82, 0.5, 14); }
    // the Taj opposite, lit up
    { const [tx, tz] = spot(l.x - 60, l.z - 40, 0.3, 44, 64, 200); g.box(tx, gh(tx, tz), tz, 40, 70, 60, 0.3, C(0x8c6a52), C(0x4a3a30)); glow.push(tx, gh(tx, tz) + 36, tz + 20, 1, 0.8, 0.45, 60); }
  } }
  // CST
  { const l = get("cst"); if (l) {
    const rot = roadDir(l.rx ?? l.x, l.rz ?? l.z) + Math.PI / 2; const F = fit(l.x + 52, l.z - 20, rot, 100, 40, 380);
    if (F) {
      const [x, z, k] = F, y = gh(x, z); const c = Math.cos(rot), s = Math.sin(rot); const at = (lx, lz) => [x + lx * c - lz * s, z + lx * s + lz * c];
      const body = C(0xb08a5e), roof = C(0x6a4a3a);
      g.box(x, y, z, 96 * k, 22, 34 * k, rot, body, roof);
      for (const sx of [-1, 1]) { const p = at(sx * 42 * k, 0); g.box(p[0], y, p[1], 14 * k, 30, 30 * k, rot, body, roof); g.geo(ico, p[0], y + 33, p[1], 6, 6, 6, 0, roof); }
      g.box(x, y + 22, z, 22 * k, 14, 22 * k, rot, body, roof); g.geo(ico, x, y + 44, z, 11, 13, 11, 0, C(0xc7a67a)); g.geo(cyl, x, y + 52, z, 0.5, 10, 0.5, 0, C(0x555));
      for (let n = -4; n <= 4; n++) { const p = at(n * 9 * k, -17.6 * k); glow.push(p[0], y + 7, p[1], 1, 0.78, 0.4, 8); glow.push(p[0], y + 15, p[1], 1, 0.82, 0.5, 6); }
      glow.push(x, y + 62, z, 1, 0.7, 0.3, 24);
    }
  } }
  // cable-stayed bridges
  const cableBridge = (rid, towers, h, col, spread) => {
    const r = city.roads.find((q) => q.id === rid); if (!r) return;
    for (const k of towers) {
      const p = r.pts[k], q = r.pts[Math.min(r.pts.length - 1, k + 1)]; const rot = Math.atan2(q.z - p.z, q.x - p.x), nx = -Math.sin(rot), nz = Math.cos(rot);
      const W = r.width / 2 + 2.6; const base = p.y - 1; for (const sd of [-1, 1]) { g.box(p.x + nx * sd * W, base, p.z + nz * sd * W, 3.2, 30, 3.2, rot, col); rod(g, [p.x + nx * sd * W, base + 28, p.z + nz * sd * W], [p.x, base + h, p.z], 2.2, col); }
      g.box(p.x, base + h - 2, p.z, 3.6, 22, 3.6, rot, col); g.box(p.x, base + 34, p.z, 3, 3, W * 2 + 3.2, rot, col);
      glow.push(p.x, base + h + 22, p.z, 1, 0.12, 0.1, 22);
      for (const dir of [-1, 1]) for (let n = 1; n <= 12; n++) {
        const j = Math.max(0, Math.min(r.pts.length - 1, k + dir * n * 2)); const d = r.pts[j]; const top = base + h - 6 - (12 - n) * 1.5 * (h / 110);
        for (const sd of [-1, 1]) lines.push(p.x + nx * sd * (n < 4 ? 1.5 : 0.5), top, p.z + nz * sd * (n < 4 ? 1.5 : 0.5), d.x + nx * sd * (r.width / 2 - 1.2), d.y + 0.6, d.z + nz * sd * (r.width / 2 - 1.2));
      }
      for (let n = -16; n <= 16; n += 2) { const d = r.pts[Math.max(0, Math.min(r.pts.length - 1, k + n))]; glow.push(d.x, d.y + 6, d.z, 0.6, 0.8, 1, 5); }
    }
  };
  { const sl = get("sealink"); const r = city.roads.find((q) => q.id === "weh"); if (sl && r) { let bk = 0, bd = 1e9; r.pts.forEach((p, k) => { const d = Math.hypot(p.x - sl.x, p.z - sl.z); if (d < bd) { bd = d; bk = k; } }); cableBridge("weh", [bk - 16, bk + 16], 118, C(0xcfd2d8), 150); } }
  { const at = get("atal"); const r = city.roads.find((q) => q.id === "atal"); if (at && r) { let bk = 0, bd = 1e9; r.pts.forEach((p, k) => { const d = Math.hypot(p.x - at.x, p.z - at.z); if (d < bd) { bd = d; bk = k; } }); cableBridge("atal", [bk - 12, bk + 12], 80, C(0xe6e0cc), 120); } }
  // Vashi gateway arch
  { const l = get("vashiarch"); if (l) {
    const x = l.rx ?? l.x, z = l.rz ?? l.z, y = l.ry ?? gh(x, z), rot = roadDir(x, z), nx = -Math.sin(rot), nz = Math.cos(rot); const col = C(0xc9ced6);
    let hw = 8, ay = y; city.nearSegs(x, z, 40, (r, i) => { if (r.pts[i].tun) return; const q = city.seg(r, i, x, z); if (q.d < r.width / 2 + 8) { hw = Math.max(hw, r.width / 2); if (q.y > ay && q.y - y < 18) ay = q.y; } });
    let R = Math.max(16, hw + 3.5); const N = 14; let prev = null;
    for (let it = 0; it < 8 && [-1, 1].some((sd) => roadHit(x + nx * sd * R, z + nz * sd * R, rot, 3, 3, ay, 1.2)); it++) R += 2.5;
    for (let k = 0; k <= N; k++) { const a = Math.PI * (k / N); const o = Math.cos(a) * R, hgt = Math.sin(a) * 30 + 6; const pt = [x + nx * o, ay + hgt, z + nz * o]; if (prev) rod(g, prev, pt, 1.2, col); prev = pt; glow.push(pt[0], pt[1], pt[2], 0.3, 0.85, 1, 5); }
    for (const sd of [-1, 1]) g.box(x + nx * sd * R, ay - 0.2, z + nz * sd * R, 3, 8, 3, rot, col);
  } }
  // JNPT port: gantry cranes and container stacks
  { const l = get("jnpt"); if (l) {
    const rnd = mulberry(91), red = C(0xd8421f), grey = C(0x9a9ea6); const cc = [0xc43b2a, 0x2b63c4, 0x2f9e5a, 0xd88a1f, 0x8a8f99, 0x8a4a2a, 0xc4c4c4];
    let placed = 0;
    for (let k = 0; k < 900 && placed < 260; k++) {
      const x = l.x + (rnd() - 0.5) * 760, z = l.z + (rnd() - 0.5) * 640; if (isWater(x, z)) continue; const nr = city.nearestRoad(x, z, 26); if (nr) continue;
      const rot = rnd() < 0.5 ? 0 : Math.PI / 2; const y0 = gh(x, z); const n = 1 + Math.floor(rnd() * 4); const col = C(cc[Math.floor(rnd() * cc.length)], 0.7);
      for (let h = 0; h < n; h++) g.box(x, y0 + h * 2.7, z, 12.2, 2.6, 2.45, rot, col);
      placed++;
    }
    for (let k = 0; k < 6; k++) { const x = l.x - 300 + k * 90, z = l.z + 280; if (isWater(x, z) && isWater(x, z - 20)) continue; const y0 = gh(x, z); if (roadHit(x, z, 0, 28, 20, y0, 3)) continue;
      for (const sx of [-10, 10]) for (const sz of [-6, 6]) g.box(x + sx, y0, z + sz, 1.4, 38, 1.4, 0, red);
      g.box(x, y0 + 38, z + 24, 24, 3, 70, 0, red); g.box(x, y0 + 38, z, 24, 3, 14, 0, grey); glow.push(x, y0 + 42, z + 60, 1, 0.1, 0.1, 10); glow.push(x, y0 + 41, z - 4, 1, 0.9, 0.7, 8); }
  } }
  // airports: runways with centre lines and edge lights, taxiways, a long glass terminal with jet bridges, parked planes, hangars and a control tower
  const plane = (x, y, z, rot, col, sc = 1) => {
    const c = Math.cos(rot), s2 = Math.sin(rot), at = (lx, lz) => [x + lx * c - lz * s2, z + lx * s2 + lz * c];
    g.box(x, y + 1.2 * sc, z, 38 * sc, 4.2 * sc, 4.2 * sc, rot, col, C(0xe8ecf2)); // fuselage
    const w = at(2 * sc, 0); g.box(w[0], y + 1.8 * sc, w[1], 7 * sc, 0.7 * sc, 38 * sc, rot, C(0xcfd5de)); // wings
    const t = at(-17 * sc, 0); g.box(t[0], y + 4 * sc, t[1], 5 * sc, 0.5 * sc, 13 * sc, rot, C(0xcfd5de)); g.box(t[0], y + 4 * sc, t[1], 5 * sc, 8 * sc, 0.6 * sc, rot, col); // tail
    for (const sd of [-1, 1]) { const e = at(3 * sc, sd * 9 * sc); g.box(e[0], y + 0.4 * sc, e[1], 5 * sc, 2.2 * sc, 2.2 * sc, rot, C(0x8d949e)); }
    glow.push(w[0], y + 2.2 * sc, w[1] + 18 * sc, 1, 0.1, 0.1, 6); glow.push(w[0], y + 2.2 * sc, w[1] - 18 * sc, 0.1, 1, 0.2, 6);
  };
  const asphalt = C(0x24262c), apron = C(0x3a3d45), white = C(0xeceff4), yellow = C(0xe8c23a);
  for (const a of AIRPORTS) {
    const ar = Math.cos(a.rot), as = Math.sin(a.rot), A = (lx, lz) => [a.x + lx * ar - lz * as, a.z + lx * as + lz * ar];
    const y0 = gh(a.x, a.z) + 0.12;
    for (const r of a.runways) {
      const p = A(r.x, r.z), rot = a.rot + r.ang; const c = Math.cos(rot), s2 = Math.sin(rot);
      g.box(p[0], y0, p[1], r.len, 0.3, r.w, rot, asphalt);
      for (let d = -r.len / 2 + 80; d < r.len / 2 - 80; d += 55) g.box(p[0] + c * d, y0 + 0.3, p[1] + s2 * d, 28, 0.05, 1.1, rot, white);
      for (const end of [-1, 1]) { for (let k = 0; k < 8; k++) { const q = [p[0] + c * (end * (r.len / 2 - 14)) - s2 * (k - 3.5) * 5, p[1] + s2 * (end * (r.len / 2 - 14)) + c * (k - 3.5) * 5]; g.box(q[0], y0 + 0.3, q[1], 22, 0.05, 1.8, rot, white); } }
      for (let d = -r.len / 2; d <= r.len / 2; d += 60) for (const sd of [-1, 1]) glow.push(p[0] + c * d - s2 * sd * (r.w / 2 + 1.2), y0 + 0.7, p[1] + s2 * d + c * sd * (r.w / 2 + 1.2), 1, 0.95, 0.8, 5);
      for (const end of [-1, 1]) for (let k = -4; k <= 4; k++) glow.push(p[0] + c * end * (r.len / 2 + 3) - s2 * k * 4.5, y0 + 0.7, p[1] + s2 * end * (r.len / 2 + 3) + c * k * 4.5, end > 0 ? 1 : 0.1, end > 0 ? 0.1 : 1, 0.1, 7);
    }
    // apron in front of the terminal and a taxiway out to every runway
    const T = a.terminal, tp = A(T.x, T.z), trot = a.rot + T.ang;
    const apronW = a.id === "nmia" ? 150 : 230; const ap = A(T.x, T.z + (T.z >= 0 ? -apronW / 2 : apronW / 2) * 0); g.box(ap[0], y0 - 0.02, ap[1], T.len + 120, 0.25, apronW * 2, trot, apron);
    for (const r of a.runways) { const rp = A(r.x, r.z); const dx = rp[0] - tp[0], dz = rp[1] - tp[1], L = Math.hypot(dx, dz); if (L < 20) continue; const m = [(rp[0] + tp[0]) / 2, (rp[1] + tp[1]) / 2]; g.box(m[0], y0 - 0.01, m[1], L, 0.28, 24, Math.atan2(dz, dx), apron); g.box(m[0], y0 + 0.28, m[1], L, 0.05, 0.6, Math.atan2(dz, dx), yellow); }
    // terminal
    const tc = Math.cos(trot), ts = Math.sin(trot);
    g.box(tp[0], y0, tp[1], T.len, 26, 64, trot, C(0x9fc4de), C(0x54606e));
    g.box(tp[0], y0 + 26, tp[1], T.len + 24, 3, 74, trot, C(0x2d3440));
    for (let k = -4; k <= 4; k++) { const q = [tp[0] + tc * k * (T.len / 9), tp[1] + ts * k * (T.len / 9)]; glow.push(q[0], y0 + 15, q[1], 0.8, 0.95, 1, 22); }
    for (let k = -3; k <= 3; k++) { const q = [tp[0] + tc * k * (T.len / 8) - ts * 52, tp[1] + ts * k * (T.len / 8) + tc * 52]; if (!roadHit(q[0], q[1], trot + Math.PI / 2, 7, 56, y0, 0.6)) g.box(q[0], y0, q[1], 7, 6, 56, trot + Math.PI / 2, C(0xb8c0cc)); // jet bridge pier
      if (k % 2 === 0) { const pq = [q[0] - ts * 52, q[1] + tc * 52]; plane(pq[0], y0 + 0.3, pq[1], trot + Math.PI / 2, [C(0xd8421f), C(0x1d5ca8), C(0xf0f0f0), C(0x2f9e5a)][(k + 3) % 4], 1.05); } }
    glow.push(tp[0], y0 + 32, tp[1], 1, 0.75, 0.3, 40);
    // control tower
    const tw = A(a.tower.x, a.tower.z); g.geo(cyl, tw[0], y0, tw[1], 5.2, 74, 5.2, 0, C(0xb9bec8)); g.box(tw[0], y0 + 74, tw[1], 15, 8, 15, 0, C(0x6fa6c8), C(0x3a424e)); g.box(tw[0], y0 + 82, tw[1], 17, 1.4, 17, 0, C(0x2d3440)); glow.push(tw[0], y0 + 90, tw[1], 1, 0.15, 0.1, 22); glow.push(tw[0], y0 + 78, tw[1], 0.7, 0.95, 1, 18);
    // hangars and cargo sheds behind the terminal
    for (let k = 0; k < 5; k++) { const q = a.id === "nmia" ? A(T.x - 470 - k * 140, 0) : A(T.x - T.len / 2 + k * 190, T.z + 200); if (!roadHit(q[0], q[1], trot, 120, 70, y0, 2)) g.box(q[0], y0, q[1], 120, 24, 70, trot, C(0x8b95a3), C(0x4f5866)); }
  }
  // ---- fountain plazas and neon casinos on the reserved open plots (2046 map) ----
  {
    const nxg = new GB(); const signTex = (text, c1, c2) => { const cv = document.createElement("canvas"); cv.width = 512; cv.height = 160; const x = cv.getContext("2d"); x.fillStyle = "#0a0614"; x.fillRect(0, 0, 512, 160); x.strokeStyle = c2; x.lineWidth = 8; x.strokeRect(8, 8, 496, 144); x.shadowColor = c1; x.shadowBlur = 24; x.fillStyle = c1; x.font = "bold 92px Arial Black, Impact, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(text, 256, 86); x.fillText(text, 256, 86); const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t; };
    const beams = []; const WATER = { r: 0.25, g: 0.8, b: 1.4 }, GOLD = { r: 1.4, g: 1.0, b: 0.35 }, PINK = { r: 1.5, g: 0.2, b: 0.7 };
    for (const q of world.plazaSites || []) {
      const x = q.x, z = q.z, y = q.y;
      if (q.kind === "fountain") {
        g.box(x, y, z, 11, 0.8, 11, 0, stone2); g.box(x, y + 0.8, z, 9.6, 0.34, 9.6, 0, stone); // plinth and basin rim
        for (const sd of [-1, 1]) { g.box(x + sd * 4.9, y + 0.8, z, 0.4, 0.9, 9.8, 0, stone2); g.box(x, y + 0.8, z + sd * 4.9, 9.8, 0.9, 0.4, 0, stone2); }
        nxg.box(x, y + 1.12, z, 9, 0.08, 9, 0, WATER); // lit water
        g.geo(cyl, x, y + 1.0, z, 1.6, 1.8, 1.6, 0, stone2); g.geo(cyl, x, y + 2.8, z, 2.6, 0.35, 2.6, 0, stone); g.geo(cyl, x, y + 3.1, z, 0.7, 1.7, 0.7, 0, stone2); g.geo(cyl, x, y + 4.8, z, 1.7, 0.28, 1.7, 0, stone);
        for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.283; nxg.box(x + Math.cos(a) * 2.2, y + 3.1, z + Math.sin(a) * 2.2, 0.16, 1.1, 0.16, a, WATER); nxg.box(x + Math.cos(a) * 3.6, y + 1.2, z + Math.sin(a) * 3.6, 0.14, 1.5, 0.14, a, WATER); }
        nxg.box(x, y + 5.1, z, 0.22, 2.6, 0.22, 0, WATER);
        for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.283 + 0.39; glow.push(x + Math.cos(a) * 4.6, y + 1.5, z + Math.sin(a) * 4.6, 0.3, 0.8, 1, 7); }
        glow.push(x, y + 6, z, 0.5, 0.9, 1, 16);
        for (const [ox, oz] of [[-7.5, -7.5], [7.5, -7.5], [-7.5, 7.5], [7.5, 7.5]]) { g.geo(cyl, x + ox, y, z + oz, 0.14, 5, 0.14, 0, dark); nxg.box(x + ox, y + 5, z + oz, 0.6, 0.18, 0.6, 0, GOLD); glow.push(x + ox, y + 4.9, z + oz, 1, 0.8, 0.45, 6); g.geo(ico, x + ox * 0.9, y + 0.5, z + oz * 0.9 + 1.2, 1.1, 0.8, 1.1, 0, C(0x2f7a38)); }
      } else if (q.kind === "convention") { // Trade & convention centre: low glass drum, swept stepped roof, lit glass front, stairs and palms
        const fx = Math.abs(q.nx) > Math.abs(q.nz) ? [Math.sign(q.nx) || 1, 0] : [0, Math.sign(q.nz) || 1]; const rot = Math.atan2(fx[1], fx[0]), c = Math.cos(rot), s = Math.sin(rot);
        const P = (a, b) => [x + a * c - b * s, z + a * s + b * c]; const WARM = { r: 0.8, g: 0.52, b: 0.26 }, CY = { r: 0.5, g: 0.95, b: 1.5 }; const metal = C(0xb9c4d0, 0.9);
        let p = P(0, 0); g.box(p[0], y, p[1], 26, 8, 32, rot, C(0x1c2630), C(0x2a3440));
        for (let k = -6; k <= 6; k++) { p = P(13.1, k * 2.3); nxg.box(p[0], y + 0.9, p[1], 0.2, 9.5, 1.7, rot, WARM); }
        p = P(0, 0); g.box(p[0], y + 8, p[1], 28, 1.4, 34, rot, metal); p = P(-1, 0); g.box(p[0], y + 9.4, p[1], 22, 1.4, 28, rot, metal); p = P(-3, 0); g.box(p[0], y + 10.8, p[1], 15, 1.4, 21, rot, metal);
        p = P(15, 0); g.box(p[0], y + 7.4, p[1], 7, 0.9, 34, rot, metal); p = P(18.4, 0); nxg.box(p[0], y + 7.3, p[1], 0.3, 0.3, 34, rot, CY);
        for (let k = 0; k < 3; k++) { p = P(14.2 + k * 1.6, 0); g.box(p[0], y, p[1], 1.6, 0.35 + (2 - k) * 0.3, 20, rot, stone); }
        for (const sd of [-1, 1]) { p = P(18, sd * 16.5); g.box(p[0], y, p[1], 0.8, 7.4, 0.8, rot, C(0x3a4452)); }
        for (const [a, b] of [[-14, -17], [-14, 17], [10, -20], [10, 20], [20, -12], [20, 12]]) { p = P(a, b); const ty = gh(p[0], p[1]); g.geo(cyl, p[0], ty, p[1], 0.22, 7.5, 0.22, 0, C(0x6b5436)); for (let k = 0; k < 6; k++) { const a2 = k * 1.047; g.geo(ico, p[0] + Math.cos(a2) * 1.5, ty + 7.6, p[1] + Math.sin(a2) * 1.5, 1.7, 0.28, 0.5, -a2, C(0x2f7a38)); } }
        glow.push(x, y + 12, z, 0.4, 0.7, 0.8, 22);
        const bt = (() => { const cv2 = document.createElement("canvas"); cv2.width = 1024; cv2.height = 128; const x2 = cv2.getContext("2d"); x2.fillStyle = "#0a1018"; x2.fillRect(0, 0, 1024, 128); x2.shadowColor = "#8fe8ff"; x2.shadowBlur = 14; x2.fillStyle = "#e8fbff"; x2.font = "bold 70px Arial, sans-serif"; x2.textAlign = "center"; x2.textBaseline = "middle"; x2.fillText("MUMBAI CONVENTION CENTRE", 512, 68); const t = new THREE.CanvasTexture(cv2); t.colorSpace = THREE.SRGBColorSpace; return t; })();
        const bs = new THREE.Mesh(new THREE.PlaneGeometry(26, 3.25), new THREE.MeshBasicMaterial({ map: bt, toneMapped: false, side: THREE.DoubleSide })); p = P(13.5, 0); bs.position.set(p[0], y + 10.2, p[1]); bs.rotation.y = -rot + Math.PI / 2; group.add(bs);
        beams.push([x, y + 11, z, 0.35], [x, y + 11, z, -0.35]);
      } else { // casino: a dark tower with gold ribs, a pink neon crown, an entrance canopy and a big lit sign facing the road
        const H = 30, hw = 12; const face = Math.abs(q.nx) > Math.abs(q.nz) ? [Math.sign(q.nx) || 1, 0] : [0, Math.sign(q.nz) || 1];
        g.box(x, y, z, hw * 2, H, hw * 2, 0, C(0x1a1424), C(0x2a2038));
        for (let k = -4; k <= 4; k++) { nxg.box(x + (face[0] ? face[0] * (hw + 0.1) : k * 2.6), y + 1, z + (face[1] ? face[1] * (hw + 0.1) : k * 2.6), face[0] ? 0.2 : 0.4, H - 2, face[1] ? 0.2 : 0.4, 0, GOLD); }
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (dx === face[0] && dz === face[1]) continue; for (let k = -4; k <= 4; k++) { nxg.box(x + (dx ? dx * (hw + 0.1) : k * 2.6), y + 1, z + (dz ? dz * (hw + 0.1) : k * 2.6), dx ? 0.2 : 0.4, H - 2, dz ? 0.2 : 0.4, 0, k % 2 ? PINK : GOLD); } }
        nxg.box(x, y + H, z, hw * 2 + 0.6, 0.7, hw * 2 + 0.6, 0, PINK); nxg.box(x, y + H + 0.9, z, hw * 2 - 3, 0.5, hw * 2 - 3, 0, GOLD);
        const cx = x + face[0] * (hw + 3.2), cz = z + face[1] * (hw + 3.2); g.box(cx, y + 4.2, cz, face[0] ? 7 : 16, 0.5, face[1] ? 7 : 16, 0, C(0x2a2030)); nxg.box(cx, y + 3.9, cz, face[0] ? 6.6 : 15.6, 0.16, face[1] ? 6.6 : 15.6, 0, GOLD);
        for (const sd of [-1, 1]) g.box(cx + (face[1] ? sd * 7 : 0), y, cz + (face[0] ? sd * 7 : 0), 0.8, 4.2, 0.8, 0, C(0x403448));
        for (let k = -3; k <= 3; k++) glow.push(cx + (face[1] ? k * 2.2 : 0), y + 3.6, cz + (face[0] ? k * 2.2 : 0), 1, 0.85, 0.4, 6);
        glow.push(x, y + H + 2, z, 1, 0.3, 0.7, 40); beams.push([x, y + H + 1, z, 0.28], [x, y + H + 1, z, -0.28]);
        const sg = new THREE.Mesh(new THREE.PlaneGeometry(15, 4.7), new THREE.MeshBasicMaterial({ map: signTex("CASINO", "#ffd23a", "#ff2d95"), toneMapped: false, side: THREE.DoubleSide }));
        sg.position.set(x + face[0] * (hw + 0.5), y + 19, z + face[1] * (hw + 0.5)); sg.rotation.y = face[0] ? Math.PI / 2 : 0; if (face[0] < 0 || face[1] < 0) sg.rotation.y += Math.PI; group.add(sg);
        const sg2 = sg.clone(); sg2.scale.set(0.6, 0.6, 1); sg2.position.set(cx, y + 6.2, cz); group.add(sg2);
      }
    }
    if (!nxg.empty) group.add(new THREE.Mesh(nxg.build(), mats.neon));
    // searchlight beams: tall faint additive cones, two crossed over each casino and the convention centre
    if (beams.length) {
      const bg = new THREE.CylinderGeometry(15, 1.6, 620, 14, 1, true); bg.translate(0, 310, 0);
      const bm = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false });
      beams.forEach(([bx, by, bz, tl], k) => { const m = new THREE.Mesh(bg, bm); m.position.set(bx, by, bz); m.rotation.z = tl; m.rotation.x = k % 2 ? 0.12 : -0.12; m.frustumCulled = false; group.add(m); });
    }
    // a "MUMBAI" sign on Malabar Hill, lit, readable from both sides
    { const hl = HILLS.find((h) => h.n === "Malabar Hill"); if (hl) {
      const cv3 = document.createElement("canvas"); cv3.width = 1024; cv3.height = 200; const x3 = cv3.getContext("2d"); x3.clearRect(0, 0, 1024, 200); x3.shadowColor = "#ffffff"; x3.shadowBlur = 22; x3.fillStyle = "#f6f6ff"; x3.font = "bold 190px Arial Black, Impact, sans-serif"; x3.textAlign = "center"; x3.textBaseline = "middle"; x3.fillText("MUMBAI", 512, 108);
      const t3 = new THREE.CanvasTexture(cv3); t3.colorSpace = THREE.SRGBColorSpace; const hy = gh(hl.x, hl.z);
      for (const sd of [0, 1]) { const sp = new THREE.Mesh(new THREE.PlaneGeometry(70, 13.7), new THREE.MeshBasicMaterial({ map: t3, transparent: true, toneMapped: false, side: THREE.FrontSide })); sp.position.set(hl.x, hy + 9, hl.z + (sd ? 0.3 : -0.3)); sp.rotation.y = sd ? Math.PI : 0; group.add(sp); }
      for (const sx of [-26, 0, 26]) g.box(hl.x + sx, hy - 1, hl.z, 1.2, 9, 0.8, 0, dark); glow.push(hl.x, hy + 9, hl.z, 1, 1, 1, 50);
    } }
  }
  group.add(new THREE.Mesh(g.build(), mats.props));
  if (lines.length) { const lg = new THREE.BufferGeometry(); lg.setAttribute("position", new THREE.Float32BufferAttribute(lines, 3)); group.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xdfe6f0, transparent: true, opacity: 0.8 }))); }
  if (glow.length) {
    const n = glow.length / 7, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
    for (let k = 0; k < n; k++) { pos.set([glow[k * 7], glow[k * 7 + 1], glow[k * 7 + 2]], k * 3); col.set([glow[k * 7 + 3], glow[k * 7 + 4], glow[k * 7 + 5]], k * 3); size[k] = glow[k * 7 + 6]; }
    const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); pg.setAttribute("color", new THREE.BufferAttribute(col, 3)); pg.setAttribute("size", new THREE.BufferAttribute(size, 1));
    group.add(new THREE.Points(pg, mats.glowPts));
  }
  return group;
}
