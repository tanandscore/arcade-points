// Midnight Burn: Tokyo Drift — Japanese temples and shrines, a vermilion torii tunnel, and cherry-blossom parks you drive through (Upgrade 34).
// Same helpers as the other landmark models (landmarks3d.js hands them over). Temples stand clear of the roads; the torii tunnel and the blossom avenues stand beside / over the road itself.
import * as THREE from "three";
import { isWater, mulberry } from "../geo";
import { sakuraAvenues } from "./sakuraAvenue";

const pyr = new THREE.ConeGeometry(1, 1, 4); pyr.rotateY(Math.PI / 4); pyr.translate(0, 0.5, 0);
// cheap shapes for the things there are hundreds of: an open-ended 8-sided post (pillars, trunks), a 5-sided twig, and a plain 20-faced ball
export const post = new THREE.CylinderGeometry(1, 1, 1, 8, 1, true); post.translate(0, 0.5, 0);
export const twig = new THREE.CylinderGeometry(1, 1, 1, 5, 1, true); twig.translate(0, 0.5, 0);
export const ball = new THREE.IcosahedronGeometry(1, 0);

export function buildJapanSites(H) {
  const { world, g, glow, C, ico, cyl, gh, spot, get } = H;
  const city = world.city;
  const vermilion = C(0xd2341c), wood = C(0x6a3f2a), stone = C(0xa9a69d), roofG = C(0x3a3e47), plaster = C(0xeee8da), gold = C(0xd8b04a), black = C(0x1d1d22);
  const at = (cx, cz, rot) => (lx, lz) => [cx + lx * Math.cos(rot) - lz * Math.sin(rot), cz + lx * Math.sin(rot) + lz * Math.cos(rot)];

  // a tiered hip roof: a wide low pyramid with a ridge cap
  const roof = (x, y, z, w, d, h, rot) => { g.geo(pyr, x, y, z, w, h, d, rot, roofG); g.box(x, y + h * 0.92, z, w * 0.3, h * 0.12, d * 0.12, rot, black); };
  const lantern = (x, y, z) => { g.box(x, y, z, 0.7, 0.5, 0.7, 0, stone); g.box(x, y + 0.5, z, 0.9, 1.1, 0.9, 0, stone); g.box(x, y + 1.6, z, 1.5, 0.35, 1.5, 0, stone); glow.push(x, y + 1.0, z, 1, 0.7, 0.3, 5); };
  const torii = (x, y, z, rot, span, hgt, col = vermilion) => {
    const A = at(x, z, rot);
    for (const s of [-1, 1]) { const p = A(0, s * span / 2); g.geo(post, p[0], y, p[1], 0.55, hgt, 0.55, 0, col); g.box(p[0], y, p[1], 1.5, 0.5, 1.5, 0, black); }
    g.box(x, y + hgt * 0.78, z, 0.5, 0.45, span + 1.0, rot, col); g.box(x, y + hgt, z, 1.1, 0.6, span + 3.4, rot, black); g.box(x, y + hgt + 0.6, z, 0.8, 0.3, span + 3.9, rot, col);
  };
  const hall = (x, y, z, rot, w, d, floors, wallCol) => {
    g.box(x, y, z, w + 5, 1.1, d + 5, rot, stone); let yy = y + 1.1;
    for (let f = 0; f < floors; f++) { const k = 1 - f * 0.18; g.box(x, yy, z, (w - 2) * k, 4.2, (d - 2) * k, rot, wallCol); const A = at(x, z, rot);
      for (let i = -2; i <= 2; i++) { const p = A(i * w * k * 0.22, -(d * k * 0.5 - 1.4)); g.box(p[0], yy, p[1], 0.5, 4.2, 0.5, rot, vermilion); }
      roof(x, yy + 4.2, z, (w + 7) * k, (d + 7) * k, 3.4, rot); yy += 4.2 + 2.4; }
    return yy;
  };
  const pagoda = (x, y, z, rot, base) => {
    g.box(x, y, z, base + 3, 1.0, base + 3, rot, stone); let yy = y + 1.0;
    for (let f = 0; f < 5; f++) { const k = 1 - f * 0.13; g.box(x, yy, z, base * k, 3.6, base * k, rot, f % 2 ? plaster : vermilion); roof(x, yy + 3.6, z, (base + 5) * k, (base + 5) * k, 2.6, rot); yy += 3.6 + 1.8; }
    g.geo(cyl, x, yy, z, 0.28, 8, 0.28, 0, gold); for (let i = 0; i < 4; i++) g.geo(cyl, x, yy + 2 + i * 1.5, z, 1.0 - i * 0.18, 0.2, 1.0 - i * 0.18, 0, gold);
    glow.push(x, y + 4, z, 1, 0.7, 0.3, 14); glow.push(x, yy + 3, z, 1, 0.85, 0.45, 10);
  };

  // ---- temples and shrines ---------------------------------------------------------------------------------------------------------------------------
  const SITES = { zojoji: { gate: true, pagoda: false }, tsurugaoka: { gate: true, steps: true }, kawasakidaishi: { pagoda: true, gate: true }, yakuoin: { gate: true, steps: true }, hasedera: { steps: true, pagoda: false } };
  for (const id of Object.keys(SITES)) {
    const l = get(id); if (!l) continue; const o = SITES[id];
    // the approach (the -z side) faces the nearest road, so the gate is what you see from the street
    const nr0 = city.nearestRoad(l.rx ?? l.x, l.rz ?? l.z, 260, (r) => !r.ramp && r.cls !== "hwy", null); let rot = 0; if (nr0) rot = Math.atan2(nr0.x - (l.rx ?? l.x), -(nr0.z - (l.rz ?? l.z)));
    const sp = spot(l.x, l.z, rot, 64, 70, 260, true); if (!sp) continue;
    const [x, z] = sp, y = gh(x, z), A = at(x, z, rot);
    // courtyard, main hall, side hall, lanterns
    g.box(x, y, z, 62, 0.5, 62, rot, C(0xb9b5aa));
    const m = A(0, 8); hall(m[0], y + 0.5, m[1], rot, 24, 17, 2, plaster);
    const s2 = A(-24, 12); hall(s2[0], y + 0.5, s2[1], rot, 12, 10, 1, wood);
    if (o.pagoda) { const p = A(22, 14); pagoda(p[0], y + 0.5, p[1], rot, 9); }
    for (let i = -3; i <= 3; i++) for (const sd of [-1, 1]) { const p = A(sd * 8, -6 - i * 4.4 - 10); lantern(p[0], y + 0.5, p[1]); }
    if (o.gate) { const gp = A(0, -29); torii(gp[0], y + 0.5, gp[1], rot + Math.PI / 2, 12, 8.5); const gp2 = A(0, -35); torii(gp2[0], y, gp2[1], rot + Math.PI / 2, 10, 7.2); }
    if (o.steps) for (let k = 0; k < 14; k++) { const p = A(0, -32 + k * 1.6); g.box(p[0], y + 0.3 + k * 0.1, p[1], 9, 0.4, 1.6, rot, stone); }
    glow.push(x, y + 14, z, 1, 0.8, 0.5, 26);
  }

  // ---- the torii tunnel: a long line of vermilion gates over the road, so you drive through them (Nezu / Fushimi style) ----------------------------------------------------
  for (const id of ["nezu", "hikawa"]) {
    const l = get(id); if (!l) continue; const n = city.nearestRoad(l.rx ?? l.x, l.rz ?? l.z, 300, (r) => !r.ramp && r.cls !== "hwy", null); if (!n) continue;
    const r = n.road, gap = id === "nezu" ? 6.5 : 14, count = id === "nezu" ? 46 : 30; let s0 = r.pts[n.i].s - (count * gap) / 2; s0 = Math.max(10, Math.min(s0, r.len - count * gap - 10));
    let k = n.i; for (let q = 0; q < count; q++) {
      const s = s0 + q * gap; while (k < r.pts.length - 2 && r.pts[k + 1].s < s) k++; while (k > 0 && r.pts[k].s > s) k--;
      const a = r.pts[k], b = r.pts[k + 1]; if (a.tun || a.over || (a.y - a.g) > 1.2) continue; const t = (s - a.s) / ((b.s - a.s) || 1), x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, yy = a.y + (b.y - a.y) * t, rot = Math.atan2(b.z - a.z, b.x - a.x);
      torii(x, yy, z, rot, r.width + 2.6, 6.2); if (q % 3 === 0) glow.push(x, yy + 5.2, z, 1, 0.5, 0.2, 7);
    }
  }

  // ---- cherry-blossom avenues: the trees are real plants now (plants.js plants them along the same stretches, see sakuraAvenue.js); here are the paper lanterns of the evening "light-up" ----------
  for (const av of sakuraAvenues(city, world.landmarks)) {
    const r = av.r; let k = 0, n = 0;
    for (let s = av.s0; s < av.s1; s += 15, n++) {
      while (k < r.pts.length - 2 && r.pts[k + 1].s < s) k++;
      const a = r.pts[k], b = r.pts[k + 1]; if (a.tun || a.over || a.w > 0.35 || (a.y - a.g) > 1.2) continue;
      const t = (s - a.s) / ((b.s - a.s) || 1), x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, yy = a.y + (b.y - a.y) * t, L = Math.hypot(b.x - a.x, b.z - a.z) || 1, nx = -(b.z - a.z) / L, nz = (b.x - a.x) / L, sd = n % 2 ? 1 : -1, off = r.width / 2 + 1.9;
      const px = x + nx * off * sd, pz = z + nz * off * sd; if (isWater(px, pz)) continue;
      g.box(px, yy + 3.9, pz, 0.5, 0.72, 0.5, 0, C(0xfff0d8, 1.6)); g.box(px, yy + 4.62, pz, 0.34, 0.08, 0.34, 0, black); glow.push(px, yy + 4.25, pz, 1, 0.74, 0.46, 4.5);
    }
  }
}

// shared by the drive-through avenues (Japan and Mumbai): walk along the road nearest to a place, calling cb(x, y, z, nx, nz, tx, tz, road, s) every `step` metres
export function walkRoad(city, l, len, step, cb) {
  const n = city.nearestRoad(l.rx ?? l.x, l.rz ?? l.z, 320, (r) => !r.ramp && r.cls !== "hwy", null); if (!n) return false;
  const r = n.road; let s0 = r.pts[n.i].s - len / 2; s0 = Math.max(10, Math.min(s0, r.len - len - 10)); let k = n.i;
  for (let s = s0; s < s0 + len; s += step) {
    while (k < r.pts.length - 2 && r.pts[k + 1].s < s) k++; while (k > 0 && r.pts[k].s > s) k--;
    const a = r.pts[k], b = r.pts[k + 1]; if (a.tun || a.over || (a.y - a.g) > 1.2) continue;
    const t = (s - a.s) / ((b.s - a.s) || 1), dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
    cb(a.x + dx * t, a.y + (b.y - a.y) * t, a.z + dz * t, -dz / L, dx / L, dx / L, dz / L, r, s);
  }
  return true;
}
