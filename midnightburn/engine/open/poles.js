// Midnight Burn — roadside utility poles and sagging power lines, like the ones that follow every country road in a real photo:
// a tall pole with a cross-arm and glass insulators, a transformer can now and then, and three wires drooping between poles.
// Poles are put on a fixed spacing along roads outside the dense city (and along forest roads), on the side away from the lamps.
import * as THREE from "three";
import { districtAt, districtDens, isWater } from "./geo";

const CH = 256;
const hsh = (a, b = 0, c = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const cylG = new THREE.CylinderGeometry(1, 1, 1, 7, 1); cylG.translate(0, 0.5, 0);
const SPACING = 38;

// the point at arc length s along a road (binary search), with its direction
function atS(r, s) {
  let lo = 0, hi = r.pts.length - 2; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (r.pts[m].s <= s) lo = m; else hi = m - 1; }
  const p = r.pts[lo], q = r.pts[lo + 1]; const sl = q.s - p.s || 1, t = Math.max(0, Math.min(1, (s - p.s) / sl)); const dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz) || 1;
  return { x: p.x + dx * t, z: p.z + dz * t, y: p.y + (q.y - p.y) * t, tx: dx / l, tz: dz / l, p, i: lo };
}

// P: props geometry builder (poles, arms, insulators), Wr: wire builder. colours are plain {r,g,b}
export function buildPoles(world, ci, cj, P, Wr, C) {
  const city = world.city; const x0 = ci * CH, z0 = cj * CH, x1 = x0 + CH, z1 = z0 + CH; const seen = new Set();
  const bl = [], lampsN = []; for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const c = world.chunk(ci + di, cj + dj); for (const b of c.buildings) bl.push(b); for (const l of c.lamps) lampsN.push(l); }
  const nearB = (x, z, pad) => { for (const b of bl) { const dx = x - b.x, dz = z - b.z; if (dx * dx + dz * dz > (b.r + pad + 2) * (b.r + pad + 2)) continue; const cs = Math.cos(b.rot), sn = Math.sin(b.rot); const lx = dx * cs + dz * sn, lz = -dx * sn + dz * cs; if (Math.abs(lx) < b.w / 2 + pad && Math.abs(lz) < b.d / 2 + pad) return true; } return false; };
  const nearL = (x, z, r) => { for (const l of lampsN) if ((l.x - x) * (l.x - x) + (l.z - z) * (l.z - z) < r * r) return true; return false; };
  const poleSpot = (r, k) => { // where pole number k of road r stands, or null if that spot is unsuitable
    const s = k * SPACING + (r.idx % 7) * 3; if (s < 20 || s > r.len - 20) return null; const a = atS(r, s), p = a.p; if (p.tun || p.w > 0.25 || p.y - p.g > 1.2 || p.over) return null;
    const dens = districtDens(a.x, a.z), d = districtAt(a.x, a.z); const forest = d && d.style === "forest"; if (!forest && dens > 0.55) return null;
    const side = (r.idx + (k >> 4)) % 2 ? 1 : -1, off = r.width / 2 + 3.6; const x = a.x - a.tz * side * off, z = a.z + a.tx * side * off;
    if (isWater(x, z) || nearB(x, z, 1.6) || nearL(x, z, 1.8) || city.blockedByRoad(x, z, a.y + 4, r, 2.2, a.y - 4) || city.blockedAbove(x, z, a.y, 10, r, 1.0)) return null;
    return { x, z, y: Math.max(city.groundH(x, z), a.y - 0.4), tx: a.tx, tz: a.tz, forest, k, wood: forest || dens < 0.2 };
  };
  const arm = (pl, lat, h) => ({ x: pl.x - pl.tz * lat, z: pl.z + pl.tx * lat, y: pl.y + h });
  const wire = (a, b, sag) => {
    const N = 6; let prev = a;
    for (let i = 1; i <= N; i++) {
      const t = i / N, cur = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t) };
      const dx = cur.x - prev.x, dy = cur.y - prev.y, dz = cur.z - prev.z, hl = Math.hypot(dx, dz) || 1, nx = -dz / hl * 0.022, nz = dx / hl * 0.022;
      Wr.quadV([prev.x - nx, prev.y, prev.z - nz], [cur.x - nx, cur.y, cur.z - nz], [cur.x + nx, cur.y, cur.z + nz], [prev.x + nx, prev.y, prev.z + nz], C.wire);
      Wr.quadV([prev.x + nx, prev.y, prev.z + nz], [cur.x + nx, cur.y, cur.z + nz], [cur.x - nx, cur.y, cur.z - nz], [prev.x - nx, prev.y, prev.z - nz], C.wire);
      Wr.quadV([prev.x, prev.y - 0.022, prev.z], [cur.x, cur.y - 0.022, cur.z], [cur.x, cur.y + 0.022, cur.z], [prev.x, prev.y + 0.022, prev.z], C.wire);
      Wr.quadV([prev.x, prev.y + 0.022, prev.z], [cur.x, cur.y + 0.022, cur.z], [cur.x, cur.y - 0.022, cur.z], [prev.x, prev.y - 0.022, prev.z], C.wire);
      prev = cur;
    }
  };
  const placed = [];
  city.nearSegs((x0 + x1) / 2, (z0 + z1) / 2, CH / 2 + 30, (r, i) => {
    if (r.cls === "hwy" || r.ramp) return; const key = r.idx * 65536 + i; if (seen.has(key)) return; seen.add(key);
    const p = r.pts[i], q = r.pts[i + 1]; const sl = q.s - p.s; if (sl <= 0.01) return;
    const kA = Math.ceil((p.s - (r.idx % 7) * 3) / SPACING), kB = Math.ceil((q.s - (r.idx % 7) * 3) / SPACING) - 1;
    for (let k = kA; k <= kB; k++) {
      const pl = poleSpot(r, k); if (!pl || pl.x < x0 || pl.x >= x1 || pl.z < z0 || pl.z >= z1) continue;
      const H = 8.6 + hsh(r.idx, k) * 1.4, rot = Math.atan2(pl.tz, pl.tx), tone = pl.wood ? 0.95 + hsh(k, 3) * 0.2 : 1;
      const col = pl.wood ? { r: 0.2 * tone, g: 0.14 * tone, b: 0.09 * tone } : C.concrete;
      P.geo(cylG, pl.x, pl.y - 0.2, pl.z, 0.15, H + 0.2, 0.15, 0, col); P.geo(cylG, pl.x, pl.y - 0.2, pl.z, 0.2, 1.0, 0.2, 0, col);
      // cross-arm and insulators
      P.box(pl.x, pl.y + H - 0.55, pl.z, 0.12, 0.12, 2.3, rot, C.steel); P.box(pl.x, pl.y + H - 1.45, pl.z, 0.1, 0.1, 1.9, rot, C.steel);
      for (const lat of [-0.95, 0, 0.95]) { const a = arm(pl, lat, H - 0.5); P.box(a.x, a.y + 0.02, a.z, 0.1, 0.28, 0.1, 0, C.glass); }
      if (hsh(r.idx, k, 9) < 0.25) { P.geo(cylG, pl.x - pl.tz * 0.6, pl.y + H - 2.3, pl.z + pl.tx * 0.6, 0.3, 0.8, 0.3, 0, C.can); P.box(pl.x - pl.tz * 0.6, pl.y + H - 1.5, pl.z + pl.tx * 0.6, 0.12, 0.08, 0.12, 0, C.steel); }
      placed.push([pl.x, pl.z, 0.2]);
      // the span to the next pole
      const nx = poleSpot(r, k + 1); if (!nx) continue;
      const span = Math.hypot(nx.x - pl.x, nx.z - pl.z); if (span > SPACING * 1.8) continue; const sag = 0.0007 * span * span + 0.1;
      for (const lat of [-0.95, 0, 0.95]) { const a = arm(pl, lat, H - 0.5), b = arm(nx, lat, (8.6 + hsh(r.idx, k + 1) * 1.4) - 0.5); wire(a, b, sag); }
    }
  });
  return placed;
}
