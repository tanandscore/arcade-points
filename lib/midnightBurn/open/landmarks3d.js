// Midnight Burn — the famous places: Gateway of India, CST, the Sea Link, Atal Setu, the Vashi arch and the JNPT port.
import * as THREE from "three";
import { GB, C } from "./chunks3d";
import { mulberry, isWater } from "./geo";

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

  // Gateway of India
  { const l = get("gateway"); if (l) {
    const x = l.x + 40, z = l.z - 30, y = gh(x, z), rot = -0.5; const c = Math.cos(rot), s = Math.sin(rot);
    const at = (lx, lz) => [x + lx * c - lz * s, z + lx * s + lz * c];
    for (const sx of [-1, 1]) { const p = at(sx * 9.5, 0); g.box(p[0], y, p[1], 7, 22, 9, rot, stone); }
    const m = at(0, 0); g.box(m[0], y + 15, m[1], 26, 7, 9, rot, stone2); g.box(m[0], y + 22, m[1], 12, 4, 7, rot, stone);
    g.geo(ico, m[0], y + 27, m[1], 5, 4.4, 5, 0, stone2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const p = at(sx * 12.4, sz * 3.6); g.box(p[0], y + 22, p[1], 2.4, 7, 2.4, rot, stone2); g.geo(ico, p[0], y + 31, p[1], 1.5, 1.8, 1.5, 0, stone2); }
    for (let k = 0; k < 6; k++) { const p = at(-14 + k * 5.6, 8); glow.push(p[0], y + 0.6, p[1], 1, 0.82, 0.5, 14); }
    // the Taj opposite, lit up
    g.box(l.x - 60, gh(l.x - 60, l.z - 40), l.z - 40, 40, 70, 60, 0.3, C(0x8c6a52), C(0x4a3a30)); glow.push(l.x - 60, gh(l.x - 60, l.z - 40) + 36, l.z - 20, 1, 0.8, 0.45, 60);
  } }
  // CST
  { const l = get("cst"); if (l) {
    const x = l.x + 52, z = l.z - 20, y = gh(x, z), rot = roadDir(l.rx ?? l.x, l.rz ?? l.z) + Math.PI / 2; const c = Math.cos(rot), s = Math.sin(rot); const at = (lx, lz) => [x + lx * c - lz * s, z + lx * s + lz * c];
    const body = C(0xb08a5e), roof = C(0x6a4a3a);
    g.box(x, y, z, 96, 22, 34, rot, body, roof);
    for (const sx of [-1, 1]) { const p = at(sx * 42, 0); g.box(p[0], y, p[1], 14, 30, 30, rot, body, roof); g.geo(ico, p[0], y + 33, p[1], 6, 6, 6, 0, roof); }
    g.box(x, y + 22, z, 22, 14, 22, rot, body, roof); g.geo(ico, x, y + 44, z, 11, 13, 11, 0, C(0xc7a67a)); g.geo(cyl, x, y + 52, z, 0.5, 10, 0.5, 0, C(0x555));
    for (let k = -4; k <= 4; k++) { const p = at(k * 9, -17.6); glow.push(p[0], y + 7, p[1], 1, 0.78, 0.4, 8); glow.push(p[0], y + 15, p[1], 1, 0.82, 0.5, 6); }
    glow.push(x, y + 62, z, 1, 0.7, 0.3, 24);
  } }
  // cable-stayed bridges
  const cableBridge = (rid, towers, h, col, spread) => {
    const r = city.roads.find((q) => q.id === rid); if (!r) return;
    for (const k of towers) {
      const p = r.pts[k], q = r.pts[Math.min(r.pts.length - 1, k + 1)]; const rot = Math.atan2(q.z - p.z, q.x - p.x), nx = -Math.sin(rot), nz = Math.cos(rot);
      const base = p.y - 1; for (const sd of [-1, 1]) { g.box(p.x + nx * sd * 8, base, p.z + nz * sd * 8, 3.2, 30, 3.2, rot, col); rod(g, [p.x + nx * sd * 8, base + 28, p.z + nz * sd * 8], [p.x, base + h, p.z], 2.2, col); }
      g.box(p.x, base + h - 2, p.z, 3.6, 22, 3.6, rot, col); g.box(p.x, base + 34, p.z, 3, 3, 20, rot, col);
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
    const R = 16, N = 14; let prev = null;
    for (let k = 0; k <= N; k++) { const a = Math.PI * (k / N); const o = Math.cos(a) * R, hgt = Math.sin(a) * 30 + 6; const pt = [x + nx * o, y + hgt, z + nz * o]; if (prev) rod(g, prev, pt, 1.2, col); prev = pt; glow.push(pt[0], pt[1], pt[2], 0.3, 0.85, 1, 5); }
    for (const sd of [-1, 1]) g.box(x + nx * sd * R, y - 0.2, z + nz * sd * R, 3, 8, 3, rot, col);
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
    for (let k = 0; k < 6; k++) { const x = l.x - 300 + k * 90, z = l.z + 280; if (isWater(x, z) && isWater(x, z - 20)) continue; const y0 = gh(x, z);
      for (const sx of [-10, 10]) for (const sz of [-6, 6]) g.box(x + sx, y0, z + sz, 1.4, 38, 1.4, 0, red);
      g.box(x, y0 + 38, z + 24, 24, 3, 70, 0, red); g.box(x, y0 + 38, z, 24, 3, 14, 0, grey); glow.push(x, y0 + 42, z + 60, 1, 0.1, 0.1, 10); glow.push(x, y0 + 41, z - 4, 1, 0.9, 0.7, 8); }
  } }
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
