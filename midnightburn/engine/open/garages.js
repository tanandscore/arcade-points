// Midnight Burn — Upgrade 38: the hidden garages.
//
// Thirty back-street garages are tucked beside the roads of each city. None of them is on the map, the minimap or the GPS until the driver
// finds it by driving past. A found garage becomes a full workshop (performance, looks, cars) and a place to travel to, and finding them is how
// the career moves up: the driver level is held back until enough garages have been found (see GARAGE_NEED).
//
// Everything here is plain geometry and rules, so it also runs headless for the tests.
import { DISTRICTS, mulberry } from "./geo";

// Garages found that a driver needs before each level can be reached. Index = level. Level 1 is free.
// A few garages per level, about two thirds of the thirty for the very last one.
export const GARAGE_NEED = [0, 0, 2, 4, 6, 8, 10, 12, 14, 17, 20];
export const GARAGE_TARGET = 30;
export const GARAGE_FIND_RADIUS = 30;  // drive this close to find one
export const GARAGE_HINT_RADIUS = 130; // the "hidden garage nearby" signal starts at this distance

// how many garages level `lv` needs on a map that has `total` of them (scaled down when a map could only fit fewer than thirty)
export const garageNeed = (lv, total) => { const n = GARAGE_NEED[Math.max(0, Math.min(10, lv))] || 0; return total >= GARAGE_TARGET ? n : Math.ceil((n * Math.max(total, 1)) / GARAGE_TARGET); };
// the highest level a driver with `found` garages may reach
export function garageCap(found, total) { if (!total) return 10; let lv = 1; for (let L = 2; L <= 10; L++) if (found >= garageNeed(L, total)) lv = L; else break; return lv; }

const NAMES = [
  "Ghost Bay", "Rust Lane Garage", "Backalley Works", "Night Shift Bay", "The Underbelly", "Chop Shop 9", "Redline Alley", "Smoke & Mirrors Garage",
  "Burnout Yard", "Last Chance Garage", "Grease Monkey Row", "Kerosene Kings", "Switchblade Bay", "Black Cat Garage", "Midnight Mechanics", "Cold Start Garage",
  "Dead End Customs", "Nitro Alley", "Velvet Spanner", "Lowlight Garage", "Hush Bay", "Torque Cellar", "Neon Scrapyard", "Copper Pipe Works",
  "Quiet Piston", "Slipstream Shed", "Gutter Garage", "Hollow Wheel Works", "Overtime Bay", "Lantern Lane Garage", "Moth Light Garage", "Clutch & Candle",
  "Static Garage", "Ember Bay", "Offcut Customs", "Low Tide Garage",
];

const HX = 3.5, HZ = 4.5; // half depth (towards the road) and half width (along the road) of the building
export const GARAGE_SIZE = { hx: HX, hz: HZ, h: 3.6 };

// Is the rectangle (centre, heading yaw: +x of the box looks at the road) standing on free, flat land with no road, building, lamp or tree in it?
function footprint(world, city, cx, cz, yaw, margin) {
  const c = Math.cos(yaw), s = Math.sin(yaw); let gmin = 1e9, gmax = -1e9;
  const NX = 4, NZ = 5;
  for (let i = 0; i <= NX; i++) for (let j = 0; j <= NZ; j++) {
    const lx = (-1 + (2 * i) / NX) * (HX + margin), lz = (-1 + (2 * j) / NZ) * (HZ + margin);
    const x = cx + lx * c - lz * s, z = cz + lx * s + lz * c;
    const h = city.groundH(x, z); if (!(h > 0.6)) return null; if (h < gmin) gmin = h; if (h > gmax) gmax = h;
    let bad = false;
    city.nearSegs(x, z, 26, (r, k) => { if (bad) return; const q = city.segT(r, k, x, z); if (q.d < r.width / 2 + 2.2) bad = true; });
    if (bad) return null;
    world.queryColliders(x, z, (o) => {
      if (bad) return;
      if (o.t === 0) { const dx = x - o.x, dz = z - o.z; const lx2 = dx * o.c + dz * o.s, lz2 = -dx * o.s + dz * o.c; if (Math.abs(lx2) < o.hw + 1.4 && Math.abs(lz2) < o.hd + 1.4) bad = true; }
      else if (o.x1 !== undefined) { const sx = o.x2 - o.x1, sz = o.z2 - o.z1, L2 = sx * sx + sz * sz || 1; const t = Math.max(0, Math.min(1, ((x - o.x1) * sx + (z - o.z1) * sz) / L2)); if (Math.hypot(x - (o.x1 + sx * t), z - (o.z1 + sz * t)) < 2.4) bad = true; }
    });
    if (bad) return null;
  }
  return gmax - gmin < 1.2 ? { y: gmin } : null;
}

// Plan the garages for a city. `avoid` is a list of {x,z} that garages should keep clear of (shops, event starts).
export function planGarages(world, avoid = []) {
  const city = world.city; const rnd = mulberry(3838);
  const roads = city.roads.filter((r) => r.pts.length > 12 && r.cls !== "hwy" && !r.tunnel && !r.ramp);
  const keep = [...avoid];
  for (const l of world.landmarks || []) keep.push({ x: l.rx ?? l.x, z: l.rz ?? l.z, r: 70 });
  for (const f of [...(world.festSites || []), ...(world.plazaSites || [])]) keep.push({ x: f.x, z: f.z, r: (f.r || 30) + 25 });
  // gather candidates: a point beside a street, with the door facing the street
  const cands = [];
  for (const r of roads) {
    for (let k = 6; k < r.pts.length - 6; k += 9) {
      const p = r.pts[k], q = r.pts[k + 1]; if (p.w > 0.35 || p.y - p.g > 1.5) continue;
      const tl = Math.hypot(q.x - p.x, q.z - p.z) || 1, tx = (q.x - p.x) / tl, tz = (q.z - p.z) / tl, nx = -tz, nz = tx;
      for (const side of [-1, 1]) for (const extra of [1.5, 4, 8]) {
        const dd = r.width / 2 + 3.2 + HX + extra;
        const cx = p.x + nx * side * dd, cz = p.z + nz * side * dd, yaw = Math.atan2(-nz * side, -nx * side);
        cands.push({ r, k, p, cx, cz, yaw, extra, dd, rank: rnd() });
      }
    }
  }
  cands.sort((a, b) => a.rank - b.rank);
  const out = []; const MAXTRY = 9000; let tried = 0;
  const far = (x, z, sep) => { for (const o of out) if (Math.hypot(o.bx - x, o.bz - z) < sep) return false; return true; };
  const clear = (x, z) => { for (const a of keep) if (Math.hypot(a.x - x, a.z - z) < (a.r || 40)) return false; return true; };
  // pass over the candidate list with a wide spacing first, then a tighter one if the map is short of room
  for (const sep of [520, 380, 280, 200, 140]) {
    for (const cd of cands) {
      if (out.length >= GARAGE_TARGET) break; if (tried++ > MAXTRY * 5) break;
      if (cd.used) continue; if (!far(cd.cx, cd.cz, sep) || !clear(cd.cx, cd.cz)) continue;
      const fp = footprint(world, city, cd.cx, cd.cz, cd.yaw, 1.0); if (!fp) continue;
      cd.used = true;
      // the on-road point the driver reaches: straight in front of the door
      const c = Math.cos(cd.yaw), s = Math.sin(cd.yaw);
      const doorX = cd.cx + c * HX, doorZ = cd.cz + s * HX;
      out.push({ bx: cd.cx, bz: cd.cz, by: fp.y, yaw: cd.yaw, doorX, doorZ, x: cd.p.x, z: cd.p.z, y: cd.p.y, width: cd.r.width, gap: cd.dd - HX - cd.r.width / 2, road: cd.r.id || null });
    }
    if (out.length >= GARAGE_TARGET) break;
  }
  // names, clues
  const names = NAMES.slice(); for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
  const lms = (world.landmarks || []).map((l) => ({ x: l.rx ?? l.x, z: l.rz ?? l.z, name: l.name }));
  out.sort((a, b) => a.bx - b.bx || a.bz - b.bz);
  return out.map((g, i) => {
    let lm = null, ld = 1e9; for (const l of lms) { const d = Math.hypot(l.x - g.bx, l.z - g.bz); if (d < ld) { ld = d; lm = l; } }
    let dm = null, dd2 = 1e9; for (const d of DISTRICTS) { const e = Math.hypot(d.x - g.bx, d.z - g.bz) - (d.r || 0) * 0.4; if (e < dd2) { dd2 = e; dm = d; } }
    const area = dm ? dm.name : "the city";
    const clue = lm && ld < 700 ? `Near ${lm.name}` : `Somewhere in ${area}`;
    return { ...g, id: "gar" + i, name: names[i % names.length], kind: "garage", icon: "🔧", area, clue, blurb: "A hidden back-street workshop: performance, looks and cars, all under one roof." };
  });
}
