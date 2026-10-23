// Midnight Burn — filling the city: buildings, street lamps, trees, landmarks, and everything a car can hit.
import { W, mx, mz, mulberry, baseH, shoreDist, isWater, districtAt, districtDens, DISTRICTS, sstep, AIRPORTS, inAirport } from "./geo";
import { buildCityGen, CLS } from "./roads";
import { planSites } from "./festival";
import { makePlanter } from "./plants";
import { IS_TOKYO } from "./mapId";
import { tokyoLandmarks, TOKYO_PLAZAS } from "./maps/tokyoLandmarks";
import { planWalkways, structLine, WK } from "./walkways";

export const CH = 256;                    // chunk size in metres
export const NCH = Math.ceil(W / CH);

// Japan: plaster, tile, concrete and pale steel instead of Mumbai's terracotta, teal and pink
const STYLE_COLORS_JP = {
  old: [0xb9b2a4, 0x9d9a92, 0xc8c0ae, 0x8d8f94], colonial: [0xc4b9a0, 0xa8a08e, 0xb5ad9c], dense: [0xcfd0d2, 0xb4b8bd, 0xd9d5c9, 0x9aa1aa, 0xc3beb2, 0xe2e0da, 0x8c929b],
  suburb: [0xe8e4da, 0xd4d6d6, 0xc9c3b4, 0xdad8d0, 0xbfc5c9], upscale: [0xe6e3dc, 0xc9ced3, 0xdcd8cc], tower: [0x9fa9b6, 0xc2c7cf, 0x8e99a8, 0xb4bbc6],
  glass: [0x7d93a6, 0x8fa3b4, 0x6c8498, 0x9db0bf], mixed: [0xd3d1c8, 0xb8bec4, 0xc6c2b6, 0xa9b0b6], planned: [0xdcdad2, 0xc4cbd2, 0xcfd3cf, 0xe0ddd2],
  industrial: [0x8c949c, 0x7a8590, 0xa4a39c, 0x68757f], port: [0x74828f, 0x8b8f93, 0x5d6e7a], forest: [0xcfc8b4, 0xb4b9aa], future: [0x9fb0c0, 0xb9c4cf, 0x8896a8, 0xc9ced6, 0x7e93a8, 0xaab6c2],
};
const STYLE_COLORS_MB = {
  old: [0xcfa77a, 0xb98a63, 0xd8b88d, 0x9bb0a0, 0xc79b8f],
  colonial: [0xc9a46b, 0xb8895a, 0xd4b27c],
  dense: [0xd69a7a, 0x8fb7a5, 0xe0c27a, 0x8aa6c9, 0xc98a9a, 0xb7a58a, 0xd8d0c0],
  suburb: [0xe3d3b4, 0xbfc9d6, 0xd8a27c, 0xc5d6bd, 0xd0c4e0],
  upscale: [0xe9e2d0, 0xcfd8e0, 0xdcd0b8],
  tower: [0xaab6c8, 0xc8ccd6, 0x9aa8bb, 0xd0d4dc],
  glass: [0x8fa9bf, 0x9db6c9, 0x7f98ad, 0xaec2d2], // Upgrade 23: real glass is grey-blue, not saturated cyan
  mixed: [0xd9c4a0, 0xb0c4d0, 0xd8a890, 0xc0c8a8],
  planned: [0xd8cdb8, 0xc0ccd8, 0xb8d0c4, 0xe0c8a8],
  industrial: [0x8a96a4, 0x7c8a80, 0xa09a8c, 0x6f7d96],
  port: [0x7d8ba0, 0x9a6a4a, 0x5f7a90],
  forest: [0xd0c0a0, 0xb0b8a0],
  future: [0x9db4c8, 0xb7c3cf, 0x8d9db0, 0xc6ccd4, 0xa9a8bc, 0xb4c0bd], // Upgrade 23: steel, silver, smoked glass and a hint of tint instead of neon cyan/violet/magenta towers
};
const STYLE_COLORS = IS_TOKYO ? STYLE_COLORS_JP : STYLE_COLORS_MB;

export function* createCityWorldGen(seed = 7, era = "now") {
  const F = era === "2046";
  const city = yield* buildCityGen(seed, era);
  const rnd = mulberry(seed * 31 + 5);
  const { roads } = city;

  yield; // keeps the page responsive while the city is built (Upgrade 49)
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
    city.nearSegs(x, z, margin + 14, (r, i) => { if (!ok) return; const q = city.segT(r, i, x, z); if (q.d < r.width / 2 + margin) ok = false; });
    return ok;
  };
  // distance from a segment to an axis-aligned rectangle centred on the origin (0 when they touch)
  const segRect = (ax, az, bx, bz, hx, hz) => {
    let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
    // slab test on x, then on z (no temporary arrays: this runs tens of millions of times while the city is built)
    if (Math.abs(dx) < 1e-9) { if (ax < -hx || ax > hx) t0 = 2; }
    else { let u0 = (-hx - ax) / dx, u1 = (hx - ax) / dx; if (u0 > u1) { const t = u0; u0 = u1; u1 = t; } t0 = Math.max(t0, u0); t1 = Math.min(t1, u1); }
    if (t0 <= t1) {
      if (Math.abs(dz) < 1e-9) { if (az < -hz || az > hz) t0 = 2; }
      else { let u0 = (-hz - az) / dz, u1 = (hz - az) / dz; if (u0 > u1) { const t = u0; u0 = u1; u1 = t; } t0 = Math.max(t0, u0); t1 = Math.min(t1, u1); }
    }
    if (t0 <= t1) return 0;
    let ex = Math.max(Math.abs(ax) - hx, 0), ez = Math.max(Math.abs(az) - hz, 0), m = Math.hypot(ex, ez);
    ex = Math.max(Math.abs(bx) - hx, 0); ez = Math.max(Math.abs(bz) - hz, 0); { const v = Math.hypot(ex, ez); if (v < m) m = v; }
    const L2 = dx * dx + dz * dz || 1;
    for (let k = 0; k < 4; k++) { const cx = k === 0 || k === 3 ? -hx : hx, cz = k < 2 ? -hz : hz; const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cz - az) * dz) / L2)); const v = Math.hypot(cx - (ax + dx * t), cz - (az + dz * t)); if (v < m) m = v; }
    return m;
  };
  const rectClear = (x, z, c, s, w, d, margin) => {
    let ok = true; const hx = w / 2, hz = d / 2;
    city.nearSegs(x, z, Math.hypot(w, d) / 2 + margin + 16, (r, i) => {
      if (!ok) return; const p = r.pts[i], q = r.pts[i + 1];
      const ax = (p.x - x) * c + (p.z - z) * s, az = -(p.x - x) * s + (p.z - z) * c, bx = (q.x - x) * c + (q.z - z) * s, bz = -(q.x - x) * s + (q.z - z) * c;
      const lim = r.width / 2 + margin; if ((ax < -hx - lim && bx < -hx - lim) || (ax > hx + lim && bx > hx + lim) || (az < -hz - lim && bz < -hz - lim) || (az > hz + lim && bz > hz + lim)) return; // wholly beyond the rectangle's reach on one side: cannot be closer than lim
      if (segRect(ax, az, bx, bz, hx, hz) < lim) ok = false;
    });
    return ok;
  };
  yield; // keeps the page responsive while the city is built (Upgrade 49)
  // ---- the Gateway of India (Upgrade 36) -----------------------------------------------------------------------------------------
  // A harbour-front monument: an arch on the water's edge looking out to sea, with open paving in front and the Taj hotel across the way. It used to be set
  // on the nearest road-free patch of ground to its map point, which put it ~150 m inland between tall buildings and turned at a made-up angle. Now the
  // waterfront spot nearest to the map point with room for the arch and its paving is chosen BEFORE any building goes up, the arch faces the sea, and
  // `lmZones` keeps buildings off it. (Nothing here uses rnd(), so the rest of the city is laid out exactly as before.)
  const lmZones = []; // [x, z, radius]: no building may be placed inside (tryPlace refuses)
  const gatewayPlan = IS_TOKYO ? null : (() => {
    const x0 = mx(1.93), z0 = mz(5.93);
    for (let rad = 0; rad <= 560; rad += 8) {
      let best = null; const n = rad ? Math.ceil((rad * 6.2832) / 10) : 1;
      for (let k = 0; k < n; k++) {
        const ang = (k / n) * 6.2832 + rad * 0.37, x = x0 + Math.cos(ang) * rad, z = z0 + Math.sin(ang) * rad;
        const sdv = shoreDist(x, z); if (sdv < 24 || sdv > 46) continue;
        const gx = shoreDist(x + 12, z) - shoreDist(x - 12, z), gz = shoreDist(x, z + 12) - shoreDist(x, z - 12), gl = Math.hypot(gx, gz); if (gl < 0.2) continue;
        const wx = -gx / gl, wz = -gz / gl; // the way to the sea: down the shore-distance slope
        if (!isWater(x + wx * 90, z + wz * 90) || !isWater(x + wx * 60 - wz * 40, z + wz * 60 + wx * 40) || !isWater(x + wx * 60 + wz * 40, z + wz * 60 - wx * 40)) continue; // open harbour ahead, not a creek mouth or a spit
        const rot = Math.atan2(-wx, wz), c = Math.cos(rot), sn = Math.sin(rot);
        if (!rectClear(x + wx * 8, z + wz * 8, c, sn, 54, 36, 4)) continue; // no road across the arch or its paving
        if (Math.abs(baseH(x, z) - baseH(x + wx * 22, z + wz * 22)) > 2.2 || Math.abs(baseH(x, z) - baseH(x - wx * 18, z - wz * 18)) > 3) continue; // level ground
        if (!city.nearestRoad(x, z, 130, (r) => r.cls !== "hwy" || r.ground, null)) continue; // a street within reach, so it can be visited
        const score = rad + Math.abs(sdv - 32) * 0.6;
        if (!best || score < best.score) best = { x, z, rot, wx, wz, c, sn, score };
      }
      if (best) {
        let taj = null; // the hotel: across the way, inland and to one side, the same heading, clear of roads
        for (const side of [1, -1]) { for (let back = 70; back <= 150 && !taj; back += 10) for (let off = 40; off <= 100 && !taj; off += 10) {
          const tx = best.x - best.wx * back + best.c * off * side, tz = best.z - best.wz * back + best.sn * off * side;
          if (shoreDist(tx, tz) > 45 && rectClear(tx, tz, best.c, best.sn, 44, 64, 4)) taj = { x: tx, z: tz, rot: best.rot };
        } if (taj) break; }
        let reach = 0; for (let d = 6; d <= 90; d += 2) { if (isWater(best.x + best.wx * d, best.z + best.wz * d)) break; reach = d; } // how far the land runs towards the sea in front of the arch
        lmZones.push([best.x + best.wx * 6, best.z + best.wz * 6, 46]); if (taj) lmZones.push([taj.x, taj.z, 46]);
        return { x: best.x, z: best.z, rot: best.rot, wx: best.wx, wz: best.wz, reach, taj };
      }
    }
    return null; // no suitable shore: the 3D builder falls back to the old placement
  })();
  // ---- 2046 Marine Drive (Upgrade 51): five glass spire towers behind the Queen's Necklace, their ground reserved before any building goes up (nothing here uses rnd()) ----
  const marinePlan = (IS_TOKYO || era !== "2046") ? null : (() => {
    const r = city.roads.find((q) => q.id === "marine"); if (!r) return null; const out = [];
    for (const f of [0.08, 0.28, 0.5, 0.72, 0.9]) {
      const sA = r.len * f; let k = 0; while (k < r.pts.length - 2 && r.pts[k + 1].s < sA) k++; const a = r.pts[k], b = r.pts[k + 1]; const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, tx = dx / L, tz = dz / L, nx = -tz, nz = tx;
      const sd = shoreDist(a.x + nx * 30, a.z + nz * 30) < shoreDist(a.x - nx * 30, a.z - nz * 30) ? 1 : -1; const rot = Math.atan2(tz, tx), c = Math.cos(rot), sn = Math.sin(rot);
      for (const back of [62, 86, 112, 140]) { const x = a.x - nx * sd * back, z = a.z - nz * sd * back; if (isWater(x, z) || shoreDist(x, z) < 30 || baseH(x, z) > 30) continue; if (!rectClear(x, z, c, sn, 30, 30, 4)) continue; out.push({ x, z, rot, h: 150 + Math.floor(f * 977 % 1 * 110), sd }); lmZones.push([x, z, 34]); break; }
    }
    return out;
  })();
  // Haji Ali interchange park (Upgrade 51): the lawn inside the loop ramp keeps its ground; the Haji Ali pin moves onto the Coastal Road beside it
  const hajiPark = IS_TOKYO ? null : (() => { const r = city.roads.find((q) => q.id === "hajiloop"); if (!r) return null; let sx = 0, sz = 0; for (const p of r.pts) { sx += p.x; sz += p.z; } const cx = sx / r.pts.length, cz = sz / r.pts.length; let m = 1e9; for (const p of r.pts) m = Math.min(m, Math.hypot(p.x - cx, p.z - cz)); const rad = Math.max(30, m - 8); lmZones.push([cx, cz, rad + 4]); return { x: cx, z: cz, r: rad }; })();
  const hajiPin = IS_TOKYO ? null : (() => { const r = city.roads.find((q) => q.id === "coastalS"); return r ? r.pts[Math.floor(r.pts.length * 0.8)] : null; })();
  const marinePin = IS_TOKYO ? null : (() => { const r = city.roads.find((q) => q.id === "marine"); return r ? r.pts[Math.floor(r.pts.length / 2)] : null; })(); // the Queen's Necklace pin sits on Marine Drive itself
  function tryPlace(x, z, rot, w, d, dens, strict) {
    if (x < 30 || z < 30 || x > W - 30 || z > W - 30) return false;
    if (shoreDist(x, z) < 30 || inAirport(x, z, 60)) return false;
    const hb = baseH(x, z); if (hb > 55) return false;
    const r = Math.hypot(w, d) / 2;
    for (const q of lmZones) if (Math.hypot(x - q[0], z - q[1]) < q[2] + r) return false; // the Gateway of India and the Taj hotel keep their ground
    if (Math.abs(baseH(x + 10, z) - hb) > 3.4 || Math.abs(baseH(x, z + 10) - hb) > 3.4) return false;
    const c = Math.cos(rot), s = Math.sin(rot);
    const pts = [[0, 0], [w / 2, d / 2], [-w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2]];
    for (const [a, b] of pts) { const px = x + c * a - s * b, pz = z + s * a + c * b; if (shoreDist(px, pz) < 14) return false; }
    if (!rectClear(x, z, c, s, w, d, strict ? 3.2 : 2.2)) return false; // the whole footprint, not just the corners: a road passing the middle of a long side must not be missed
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
  // a few of the reserved open plots become permanent landmarks instead of festival grounds: fountain plazas and neon casinos
  const plazaSites = [];
  for (const [nm, kind] of IS_TOKYO ? TOKYO_PLAZAS : [["Fort", "fountain"], ["Bandra", "fountain"], ["Vashi", "convention"], ["Nariman", "casino"], ["Worli", "casino"], ["Kharghar", "fountain"], ["CBD", "fountain"], ["Powai", "fountain"], ["Thane", "fountain"], ["Juhu", "casino"]]) {
    const i = festSites.findIndex((q) => q.name && q.name.startsWith(nm)); if (i >= 0) { plazaSites.push({ ...festSites[i], kind }); festSites.splice(i, 1); }
  }
  for (const r of roads) {
    yield;
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
  for (let gx = 40; gx < W - 40; gx += 24) { yield; for (let gz = 40; gz < W - 40; gz += 24) {
    const x = gx + rnd() * 22, z = gz + rnd() * 22; const dens = districtDens(x, z);
    if (dens < 0.3 || rnd() > Math.min(1, dens * 1.5)) continue;
    const nr = city.nearestRoad(x, z, 60); let rot = rnd() * 3.14;
    if (nr) { const p = nr.road.pts[nr.i], q = nr.road.pts[nr.i + 1]; rot = Math.atan2(q.z - p.z, q.x - p.x); }
    tryPlace(x, z, rot, 12 + rnd() * 14, 12 + rnd() * 14, dens, true);
  }
  }

  yield; // keeps the page responsive while the city is built (Upgrade 49)
  // ---- street lamps ---------------------------------------------------------------------------------------------
  const lamps = []; // {x,z,y,c(0 sodium,1 white,2 blue), h}
  for (const r of roads) {
    yield;
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
        if (city.blockedByRoad(lx, lz, p.y + 3, r, 1.2, p.y - 3.5) || city.blockedByRoad(lx, lz, p.y + 0.5, r, 0.6, p.y - 1.5) || city.blockedAbove(lx, lz, p.y, r.cls === "hwy" ? 10 : 8, r, 1.2)) continue; // never on another road, nor under a deck
        lamps.push({ x: lx, z: lz, y: p.y, c: col, h: r.cls === "hwy" ? 10 : 8, side: sd, tx, tz });
      }
    }
  }

  // no lamp post may stand on a road at its own height (ramps and flyovers share the ground in places)
  { let n = 0; for (let i = 0; i < lamps.length; i++) { const l = lamps[i]; if (city.blockedByRoad(l.x, l.z, l.y + 2.5, null, 0.2, l.y - 2.5)) continue; lamps[n++] = l; } lamps.length = n; }

  yield; // keeps the page responsive while the city is built (Upgrade 49)
  // ---- walkways (Upgrade 23): where pavements meet roads, people use a skywalk or a subway - or the pavement simply stops. Planned here so lamps and
  //      street furniture can be kept clear of the stairs and entrances; drawn in walkgeo.js; used by crowd.js ----
  const walkways = planWalkways({ city });
  for (const st of walkways.structs) st.line = structLine(st, 1.0);
  const SG = 128, sgrid = new Map(); // structures by 128 m cell, so the many "is anything standing here?" questions stay cheap
  for (const st of walkways.structs) { const k = Math.floor(st.mx / SG) * 4096 + Math.floor(st.mz / SG); let l = sgrid.get(k); if (!l) sgrid.set(k, (l = [])); l.push(st); }
  const nearStruct = (x, z, pad) => {
    const ci = Math.floor(x / SG), cj = Math.floor(z / SG);
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {
      const l = sgrid.get((ci + di) * 4096 + cj + dj); if (!l) continue;
      for (const st of l) {
        const ext = (st.b - st.a) / 2 + pad + 2; if (Math.abs(x - st.mx) > ext || Math.abs(z - st.mz) > ext) continue;
        for (const P of st.line) { const dx = x - P.x, dz = z - P.z; if (dx * dx + dz * dz < pad * pad) return true; }
      }
    }
    return false;
  };
  { let n = 0; for (let i = 0; i < lamps.length; i++) { const l = lamps[i]; if (nearStruct(l.x, l.z, WK.W / 2 + 0.8)) continue; lamps[n++] = l; } lamps.length = n; }

  yield; // keeps the page responsive while the city is built (Upgrade 49)
  // ---- trees, bushes, grass and rocks are made chunk by chunk when a chunk is drawn (plants.js); only this list is kept for old callers ----
  const trees = [];

  yield; // keeps the page responsive while the city is built (Upgrade 49)
  // ---- chunk buckets ---------------------------------------------------------------------------------------------
  const chunks = new Map(); const ck = (i, j) => i * 128 + j; // Upgrade 34: the map is 86 chunks across, so the key must leave room for more than 64 (it used to mix up the far-south chunks with the far-north ones)
  const bucket = (arr, name, f = (o) => o) => { for (const o of arr) { const i = Math.floor(o.x / CH), j = Math.floor(o.z / CH); if (i < 0 || j < 0 || i >= NCH || j >= NCH) continue; const k = ck(i, j); let c = chunks.get(k); if (!c) chunks.set(k, (c = { i, j, buildings: [], lamps: [], trees: [], furniture: [], extras: [] })); c[name].push(o); } };
  yield; // keeps the page responsive while the city is built (Upgrade 49)
  // ---- street furniture: benches, bins, hydrants, post boxes, phone booths, tea/newspaper kiosks, bollards, planters, signs, transformer boxes,
  //      road-works barriers, cameras and dumpsters, standing on the pavement beside the lamp posts ----
  bucket(buildings, "buildings");
  const furniture = [];
  {
    const hh = (n) => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
    const inBuilding = (x, z, pad) => { const ci = Math.floor(x / CH), cj = Math.floor(z / CH); for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const c = chunks.get(ck(ci + di, cj + dj)); if (!c) continue; for (const b of c.buildings) { const dx = x - b.x, dz = z - b.z; if (dx * dx + dz * dz > (b.r + 8) * (b.r + 8)) continue; const cs = Math.cos(b.rot), sn = Math.sin(b.rot); const lx = dx * cs + dz * sn, lz = -dx * sn + dz * cs; if (Math.abs(lx) < b.w / 2 + pad && Math.abs(lz) < b.d / 2 + pad) return true; } } return false; };
    // kind weights: 0 bench, 1 bins, 2 hydrant, 3 post box, 4 phone booth, 5 kiosk, 6 bollards, 7 planter, 8 sign pole, 9 transformer, 10 road works, 11 flower stand, 12 (spare), 13 camera pole, 14 dumpster
    // Upgrade 34: Japan has no tea kiosks, phone boxes or open hydrants: drink vending machines (15) and bicycle racks (16) take their place
    const W = IS_TOKYO ? [[0, 6], [1, 10], [3, 3], [6, 6], [7, 9], [8, 8], [9, 5], [10, 2], [11, 3], [13, 4], [15, 30], [16, 12]] : [[0, 14], [1, 14], [2, 6], [3, 4], [4, 4], [5, 8], [6, 8], [7, 14], [8, 10], [9, 4], [10, 2], [11, 6], [13, 3], [14, 5]]; const WT = W.reduce((a, q) => a + q[1], 0);
    const pick = (u) => { let t = u * WT; for (const q of W) { if ((t -= q[1]) < 0) return q[0]; } return 0; };
    let i = 0;
    for (const l of lamps) {
      yield;
      i++; if (l.c === 2 || l.h > 9) continue; if (Math.abs(l.y - city.groundH(l.x, l.z)) > 1.2) continue;
      for (let rep = 0; rep < 2; rep++) {
        if (rep === 1 && hh(i * 3.7) > 0.45) continue;
        const k = pick(hh(i * 1.37 + rep * 91.1)); const along = (rep ? -1 : 1) * (4 + hh(i * 5.1 + rep) * 9); const out = 1.5 + hh(i * 2.9 + rep) * 0.9;
        // outward = away from the road centre: the lamp sits at (-tz, tx) * side; so outward is that same direction
        const ox = -l.tz * l.side, oz = l.tx * l.side; const x = l.x + l.tx * along + ox * out, z = l.z + l.tz * along + oz * out;
        const rad = k === 5 || k === 14 || k === 16 ? 2.4 : 1.4;
        if (inBuilding(x, z, rad) || city.blockedByRoad(x, z, l.y + 3, null, rad * 0.6, l.y - 2.5) || isWater(x, z)) continue;
        if (Math.abs(city.groundH(x, z) - l.y) > 1.0) continue;
        furniture.push({ k, x, z, y: l.y, rot: Math.atan2(l.tz, l.tx), fx: -ox, fz: -oz, id: i * 2 + rep });
      }
    }
  }
  { let n = 0; for (let i = 0; i < furniture.length; i++) { const f = furniture[i]; if (nearStruct(f.x, f.z, WK.W / 2 + 1.5)) continue; furniture[n++] = f; } furniture.length = n; }
  bucket(lamps, "lamps"); bucket(trees, "trees"); bucket(furniture, "furniture");

  yield; // keeps the page responsive while the city is built (Upgrade 49)
  // ---- colliders -------------------------------------------------------------------------------------------------
  const CG = 32, cgrid = new Map(); const gk = (i, j) => i * 4096 + j;
  const add = (o, x0, z0, x1, z1) => { for (let i = Math.floor(x0 / CG); i <= Math.floor(x1 / CG); i++) for (let j = Math.floor(z0 / CG); j <= Math.floor(z1 / CG); j++) { const k = gk(i, j); let l = cgrid.get(k); if (!l) cgrid.set(k, (l = [])); l.push(o); } };
  for (const b of buildings) { const c = Math.cos(b.rot), s = Math.sin(b.rot); const o = { t: 0, x: b.x, z: b.z, hw: b.w / 2, hd: b.d / 2, c, s, y: b.y, h: b.h }; add(o, b.x - b.r, b.z - b.r, b.x + b.r, b.z + b.r); }
  // is the edge point (mx, mz) of road r, at height y, lying over another road's own surface that carries on level from here?
  const openAt = (r, mx, mz, y) => {
    let open = false;
    city.nearSegs(mx, mz, 30, (o, k) => { if (open || o === r) return; const w = city.segT(o, k, mx, mz);
      // Upgrade 37: beyond the end of a road its surface is not there. The distance to an end point used to count as that road for a whole half-width around it, which took the crash barrier
      // off the flyover's edge beside the top of a ramp, and a car on that edge could drive off the side.
      if (((k === 0 && w.t <= 0.001) || (k === o.pts.length - 2 && w.t >= 0.999)) && w.d > 0.6) return;
      if (w.d < o.width / 2 + 0.8 && Math.abs(w.y - y) < 1.6) open = true; }); // open only where another road's own surface really carries on level from here (Upgrade 26: was 4.5 m / 3 m, which left the outer edge of every ramp open beside the flyover)
    return open;
  };
  // 0: closed all along, 1: open all along, 2: partly open (checked at the start, middle and end of the segment)
  const wallState = (r, p, q, nx, nz, sd, hw) => {
    let n = 0;
    for (const f of [0, 0.5, 1]) { const mx = p.x + (q.x - p.x) * f + nx * sd * hw, mz = p.z + (q.z - p.z) * f + nz * sd * hw; if (openAt(r, mx, mz, p.y)) n++; }
    return n === 0 ? 0 : n === 3 ? 1 : 2;
  };
  const walls = []; let curRoad = null;
  // Upgrade 26: take a collider back out (a chunk's trees change when the quality dial moves, so the old trunk marks must go)
  const removeCollider = (o, x0, z0, x1, z1) => { for (let i = Math.floor(x0 / CG); i <= Math.floor(x1 / CG); i++) for (let j = Math.floor(z0 / CG); j <= Math.floor(z1 / CG); j++) { const l = cgrid.get(gk(i, j)); if (!l) continue; const n = l.indexOf(o); if (n >= 0) { l[n] = l[l.length - 1]; l.pop(); } } };
  const addWall = (x1, z1, x2, z2, y) => { const o = { t: 1, x1, z1, x2, z2, y, r: curRoad }; walls.push(o); add(o, Math.min(x1, x2) - 1, Math.min(z1, z2) - 1, Math.max(x1, x2) + 1, Math.max(z1, z2) + 1); return o; };
  for (const r of roads) {
    yield;
    curRoad = r; const hw = r.width / 2 + 0.35;
    for (let i = 0; i < r.pts.length - 1; i += 1) {
      const p = r.pts[i], q = r.pts[i + 1]; const elevated = (p.y - p.g > 1.8 || p.w > 0.35) && (q.y - q.g > 1.8 || q.w > 0.35);
      const t = Math.hypot(q.x - p.x, q.z - p.z) || 1; const nx = -(q.z - p.z) / t, nz = (q.x - p.x) / t;
      if (p.tun && q.tun) { for (const sd of [-1, 1]) addWall(p.x + nx * sd * (hw + 0.2), p.z + nz * sd * (hw + 0.2), q.x + nx * sd * (hw + 0.2), q.z + nz * sd * (hw + 0.2), (p.y + q.y) / 2); }
      else if (elevated) { for (const sd of [-1, 1]) {
        const st = wallState(r, p, q, nx, nz, sd, hw);
        if (st === 0) addWall(p.x + nx * sd * hw, p.z + nz * sd * hw, q.x + nx * sd * hw, q.z + nz * sd * hw, (p.y + q.y) / 2);
        else if (st === 2) {
          // Upgrade 37: a segment that is only partly beside another road (the top of a ramp meeting the flyover) used to lose its whole barrier, a 10 m gap that a car could drive through and fall.
          // Now the barrier stays over every stretch that is not really open (checked every metre).
          const pieces = Math.max(2, Math.ceil(t / 1.0)); let run = -1;
          for (let u = 0; u <= pieces; u++) {
            const f0 = u / pieces, f1 = (u + 1) / pieces, fm = (u + 0.5) / pieces; const closed = u < pieces && !openAt(r, p.x + (q.x - p.x) * fm + nx * sd * hw, p.z + (q.z - p.z) * fm + nz * sd * hw, p.y);
            if (closed && run < 0) run = f0;
            if ((!closed) && run >= 0) { const e = f0; addWall(p.x + (q.x - p.x) * run + nx * sd * hw, p.z + (q.z - p.z) * run + nz * sd * hw, p.x + (q.x - p.x) * e + nx * sd * hw, p.z + (q.z - p.z) * e + nz * sd * hw, (p.y + q.y) / 2); run = -1; }
            void f1;
          } } } }
      else if (r.scenic && r.id === "marine") { const sd = shoreDist(p.x + nx * 30, p.z + nz * 30) < shoreDist(p.x - nx * 30, p.z - nz * 30) ? 1 : -1; if (wallState(r, p, q, nx, nz, sd, hw) === 0) addWall(p.x + nx * sd * hw, p.z + nz * sd * hw, q.x + nx * sd * hw, q.z + nz * sd * hw, p.y); }
    }
  }
  // Upgrade 29: the top end of a ramp lies partly on the flyover and partly beside it; close the stretch of that end that is not over any other road, so a car on
  // the outer edge of the ramp cannot slip past the end of it and drop off the side
  for (const r of roads) {
    yield;
    if (!r.ramp || !r.deckRoad || r.pts.length < 3) continue; const P0 = r.pts[0], P1 = r.pts[1]; const L = Math.hypot(P1.x - P0.x, P1.z - P0.z) || 1, dx = (P0.x - P1.x) / L, dz = (P0.z - P1.z) / L, nx = -dz, nz = dx, hw = r.width / 2 + 0.35;
    const covered = (off) => { let c = false; const x = P0.x + nx * off - dx * 1.5, z = P0.z + nz * off - dz * 1.5; city.nearSegs(x, z, 30, (o, k) => { if (c || o === r) return; const q = city.segT(o, k, x, z);
      if (((k === 0 && q.t <= 0.001) || (k === o.pts.length - 2 && q.t >= 0.999)) && q.d > 0.6) return; // (Upgrade 37: the rounded end beyond another road's end is not its surface)
      if (q.d < o.width / 2 + 0.3 && Math.abs(q.y - P0.y) < 1.6) c = true; }); return c; };
    let run = null; curRoad = r;
    for (let off = -hw; off <= hw + 0.01; off += 0.75) { const unc = !covered(off); if (unc && run === null) run = off; if (!unc && run !== null) { addWall(P0.x + nx * run, P0.z + nz * run, P0.x + nx * (off - 0.75), P0.z + nz * (off - 0.75), P0.y); run = null; } }
    // Upgrade 37: a closed stretch that runs out to the far side of the ramp used to be forgotten (the loop stopped a few centimetres short of the edge, so the test for the end of the run never came true): the mouth of every ramp whose open part lay on that side had no closure
    if (run !== null) addWall(P0.x + nx * run, P0.z + nz * run, P0.x + nx * hw, P0.z + nz * hw, P0.y);
  }
  curRoad = null;
  // a road that stops gets a barricade right across it, a couple of metres short of the end (drawn in chunks3d, solid like any crash barrier)
  for (const d of city.deadEnds || []) {
    const hw = d.w / 2 + 0.4, px = d.x - d.dx * 2.2, pz = d.z - d.dz * 2.2, nx = -d.dz, nz = d.dx;
    const o = addWall(px + nx * hw, pz + nz * hw, px - nx * hw, pz - nz * hw, d.y); o.cl = true; o.fx = d.dx; o.fz = d.dz;
  }
  for (const L of city.metro) for (const pr of L.piers) { const c = Math.cos(pr.rot), sn = Math.sin(pr.rot); add({ t: 0, x: pr.x, z: pr.z, hw: 1.1, hd: 1.1, c, s: sn, y: pr.base, h: pr.h }, pr.x - 2, pr.z - 2, pr.x + 2, pr.z + 2); } // metro piers (one per ~36 m, clear of roads; the same list is drawn)
  // flyover and viaduct piers, lamp posts and tree trunks are solid too
  for (const r of roads) for (let i = 0; i < r.pts.length - 1; i += 3) {
    const p = r.pts[i], q = r.pts[i + 1]; if (p.tun || !(p.y - p.g > 2.8) || !(p.y - p.g > 1.4 || q.y - q.g > 1.4 || p.w > 0.35 || p.over || q.over)) continue;
    const bot = Math.max(p.g, -3), hgt = p.y - 1.3 - bot; if (hgt <= 1) continue;
    const t = Math.hypot(q.x - p.x, q.z - p.z) || 1; const rot = Math.atan2(q.z - p.z, q.x - p.x), c = Math.cos(rot), sn = Math.sin(rot), nx = -(q.z - p.z) / t, nz = (q.x - p.x) / t;
    const hwr = r.width / 2; const offs = r.width > 16 ? [-hwr * 0.5, hwr * 0.5] : [0];
    for (const oo of offs) { const px = p.x + nx * oo, pz = p.z + nz * oo; if (city.blockedByRoad(px, pz, p.y + 1.6, r, 2.4, p.g - 2, i)) continue; add({ t: 0, x: px, z: pz, hw: 1.15, hd: 1.15, c, s: sn, y: bot, h: hgt }, px - 2, pz - 2, px + 2, pz + 2); }
  }
  for (const q of plazaSites) { const hh = q.kind === "fountain" ? 5.2 : 13; const rot = q.rot || 0, cc = Math.cos(rot), ss = Math.sin(rot); add({ t: 0, x: q.x, z: q.z, hw: hh, hd: hh, c: 1, s: 0, y: q.y, h: q.kind === "casino" ? 30 : q.kind === "convention" ? 16 : 1.3 }, q.x - 20, q.z - 20, q.x + 20, q.z + 20); }
  for (const l of lamps) add({ t: 0, x: l.x, z: l.z, hw: 0.22, hd: 0.22, c: 1, s: 0, y: l.y, h: l.h }, l.x - 0.5, l.z - 0.5, l.x + 0.5, l.z + 0.5);
  // skywalk stairs and landings, and subway entrance buildings, are solid (the decks themselves are far above any car)
  for (const st of walkways.structs) {
    const ln = st.line;
    if (st.kind === "sky") {
      for (let k = 0; k + 2 < ln.length; k += 2) {
        const P = ln[k], Q = ln[k + 2], sm = (P.s + Q.s) / 2; if (sm >= st.s0 && sm <= st.s1) continue;
        const h = Math.max(walkways.heightAt(st, P.s), walkways.heightAt(st, Q.s)); if (h < 0.3) continue;
        const rot = Math.atan2(Q.z - P.z, Q.x - P.x), cx = (P.x + Q.x) / 2, cz = (P.z + Q.z) / 2, len = Math.hypot(Q.x - P.x, Q.z - P.z);
        add({ t: 0, x: cx, z: cz, hw: len / 2 + 0.05, hd: WK.W / 2, c: Math.cos(rot), s: Math.sin(rot), y: Math.min(P.y, Q.y) - 0.1, h: h + 0.1 }, cx - 3, cz - 3, cx + 3, cz + 3);
      }
      for (const sC of [st.s0 + 0.6, st.s1 - 0.6]) { let P = ln[0]; for (const q of ln) if (Math.abs(q.s - sC) < Math.abs(P.s - sC)) P = q; const rot = Math.atan2(P.tz, P.tx); add({ t: 0, x: P.x, z: P.z, hw: 0.9, hd: WK.W / 2, c: Math.cos(rot), s: Math.sin(rot), y: P.y - 0.1, h: st.H - 0.3 }, P.x - 3, P.z - 3, P.x + 3, P.z + 3); }
    } else {
      for (const sC of [st.a + WK.SUB_LEN / 2, st.b - WK.SUB_LEN / 2]) { let P = ln[0]; for (const q of ln) if (Math.abs(q.s - sC) < Math.abs(P.s - sC)) P = q; const rot = Math.atan2(P.tz, P.tx); add({ t: 0, x: P.x, z: P.z, hw: WK.SUB_LEN / 2, hd: WK.SUB_W / 2, c: Math.cos(rot), s: Math.sin(rot), y: P.y - 0.1, h: 3.1 }, P.x - 4, P.z - 4, P.x + 4, P.z + 4); }
    }
  }
  { const FS = { 0: [0.9, 0.3, 0.9], 1: [0.6, 0.3, 0.9], 2: [0.2, 0.2, 0.7], 3: [0.35, 0.35, 1.3], 4: [0.55, 0.55, 2.3], 5: [1.3, 0.85, 2.1], 6: [2.2, 0.15, 0.8], 7: [0.6, 0.6, 0.6], 9: [0.75, 0.45, 1.6], 10: [1.7, 0.35, 1.0], 11: [0.65, 0.35, 0.8], 13: [0.12, 0.12, 5], 14: [1.1, 0.55, 1.2], 15: [1.6, 0.45, 1.9], 16: [1.1, 0.4, 1.0] };
    for (const f of furniture) { const d = FS[f.k]; if (!d) continue; const c = Math.cos(f.rot), sn = Math.sin(f.rot); add({ t: 0, x: f.x, z: f.z, hw: d[0], hd: d[1], c, s: sn, y: f.y, h: d[2] }, f.x - 3, f.z - 3, f.x + 3, f.z + 3); } }
  for (const tr of trees) { const rr = 0.3 + tr.s * 0.15; add({ t: 0, x: tr.x, z: tr.z, hw: rr, hd: rr, c: 1, s: 0, y: tr.y, h: 7 }, tr.x - 1, tr.z - 1, tr.x + 1, tr.z + 1); }
  const queryColliders = (x, z, fn) => { const l = cgrid.get(gk(Math.floor(x / CG), Math.floor(z / CG))); if (l) for (const o of l) fn(o); };

  yield; // keeps the page responsive while the city is built (Upgrade 49)
  // ---- landmarks & points of interest --------------------------------------------------------------------------------
  const landmarks = IS_TOKYO ? tokyoLandmarks(AIRPORTS) : [
    { id: "gateway", name: "Gateway of India", x: gatewayPlan ? gatewayPlan.x : mx(1.93), z: gatewayPlan ? gatewayPlan.z : mz(5.93), kind: "gateway", site: gatewayPlan || undefined },
    { id: "cst", name: "Chhatrapati Shivaji Terminus", x: mx(1.98), z: mz(5.4), kind: "cst" },
    { id: "marinedrive", name: "Queen's Necklace, Marine Drive", x: marinePin ? marinePin.x : mx(1.76), z: marinePin ? marinePin.z : mz(4.85), kind: "marine", sites: marinePlan },
    { id: "hajiali", name: "Haji Ali Dargah & Worli Sea Face", x: hajiPin ? hajiPin.x : mx(1.72), z: hajiPin ? hajiPin.z : mz(4.2), kind: "none", park: hajiPark },
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
    { id: "rajabai", name: "Rajabai Clock Tower", x: mx(1.95), z: mz(5.62), kind: "icon" },
    { id: "wankhede", name: "Wankhede Stadium", x: mx(1.83), z: mz(5.0), kind: "icon" },
    { id: "colabacauseway", name: "Colaba Causeway Fairy-Light Bazaar", x: mx(1.80), z: mz(5.78), kind: "bazaar" },
    { id: "phoolgali", name: "Dadar Marigold Arches", x: mx(2.28), z: mz(3.45), kind: "arches" },
    { id: "aareybanyan", name: "Aarey Banyan Tunnel", x: mx(1.85), z: mz(1.15), kind: "banyan" },
  ];
  for (const l of landmarks) { // bridges: use the deepest-water point of their deck
    const rid = l.bridgeRoad || (l.id === "sealink" ? "weh" : l.id === "atal" ? "atal" : null); if (!rid) continue;
    const r = roads.find((q) => q.id === rid); if (!r) continue; let best = null, bd = 1e9; for (const p of r.pts) { const d = shoreDist(p.x, p.z); if (d < bd) { bd = d; best = p; } }
    l.x = best.x; l.z = best.z; l.rx = best.x; l.rz = best.z; l.ry = best.y; l.onBridge = true;
  }
  // put every landmark on a reachable bit of road
  for (const l of landmarks) { if (l.onBridge) continue; const nr = city.nearestRoad(l.x, l.z, 600, (r) => r.cls !== "hwy" || r.ground, null); if (nr) { l.rx = nr.x; l.rz = nr.z; l.ry = nr.y; } else { l.rx = l.x; l.rz = l.z; l.ry = 0; } }

  const world = { seed, era, festSites, plazaSites, city, buildings, lamps, trees, furniture, chunks, landmarks, queryColliders, walls, CH, NCH, walkways };
  const wallBuckets = new Map(); for (const o of walls) { const k = ck(Math.floor(((o.x1 + o.x2) / 2) / CH), Math.floor(((o.z1 + o.z2) / 2) / CH)); let l = wallBuckets.get(k); if (!l) wallBuckets.set(k, (l = [])); l.push(o); }
  world.wallsIn = (i, j) => wallBuckets.get(ck(i, j)) || [];
  world.chunk = (i, j) => chunks.get(ck(i, j)) || { i, j, buildings: [], lamps: [], trees: [], furniture: [], extras: [] };
  world.addCollider = add; world.removeCollider = removeCollider;
  world.vegQuality = 1; // 1 = full planting; the view lowers it on weak devices
  world.plantsFor = makePlanter({ city, getChunk: world.chunk, landmarks, plazaSites, festSites, addCollider: add, removeCollider, quality: () => world.vegQuality, blocked: nearStruct });
  world.plantsDrop = world.plantsFor.drop;
  world.plantsForSteps = world.plantsFor.steps; // the same, but as a generator (Upgrade 25: built a few milliseconds at a time while driving)
  return world;
}


// Same world as createCityWorldGen, built in one go (for callers that cannot wait).
export function createCityWorld(seed = 7, era = "now") {
  const g = createCityWorldGen(seed, era);
  let r;
  while (!(r = g.next()).done);
  return r.value;
}
