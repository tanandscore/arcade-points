// Midnight Burn — where the plants go. Made on demand, one 256 m chunk at a time, from fixed random seeds, so every visit looks the same.
//  - forests (Sanjay Gandhi, Yeoor, the Sahyadri ghats): thick stands of pines and teak with bushes, ferns, grass and boulders under them
//  - every road: a verge of grass tufts and bushes, street trees in the leafy districts, flowering hedges, big trees well back from motorways
//  - the coast: coconut and royal palms, boulders along the shore
//  - open land and parks: groves, scattered trees, shrubs, long grass
// Nothing is ever put on a road, under a flyover, inside a building, by a lamp post or street furniture, or on a landmark plaza.
import { mulberry, baseH, shoreDist, isWater, districtAt, districtDens, sstep, fbm, inAirport } from "./geo";
import { K, TRUNK, isTree } from "./vegKinds";

const CH = 256;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const hash = (a, b, c = 0, d = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 1274126177) + Math.imul(d | 0, 982451653)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
const pickW = (list, u) => { let t = 0; for (const w of list) t += w[1]; u *= t; for (const w of list) { if ((u -= w[1]) < 0) return w[0]; } return list[0][0]; };

// street-tree mixes by district style
const STREET = {
  green: [[K.UMBRELLA, 0.24], [K.GULMOHAR, 0.2], [K.DOME, 0.24], [K.PEEPAL, 0.1], [K.COCONUT, 0.1], [K.ROYAL, 0.07], [K.BANYAN, 0.02], [K.CYPRESS, 0.03]],
  old: [[K.DOME, 0.28], [K.PEEPAL, 0.28], [K.UMBRELLA, 0.16], [K.GULMOHAR, 0.1], [K.BANYAN, 0.05], [K.COCONUT, 0.1], [K.ROYAL, 0.03]],
  hard: [[K.ROYAL, 0.34], [K.COCONUT, 0.2], [K.CYPRESS, 0.24], [K.DOME, 0.16], [K.GULMOHAR, 0.06]],
  coast: [[K.COCONUT, 0.56], [K.ROYAL, 0.14], [K.CYPRESS, 0.1], [K.DOME, 0.1], [K.PEEPAL, 0.06], [K.ARECA, 0.04]],
  forest: [[K.TEAK, 0.4], [K.DOME, 0.16], [K.PEEPAL, 0.1], [K.UMBRELLA, 0.06], [K.GULMOHAR, 0.04], [K.BANYAN, 0.03], [K.ARECA, 0.05], [K.COCONUT, 0.04]],
};
const STYLE_SET = { suburb: "green", upscale: "green", planned: "green", mixed: "green", old: "old", colonial: "old", dense: "old", tower: "hard", glass: "hard", future: "hard", industrial: "hard", port: "hard", forest: "forest" };
const SHRUBS = [[K.BUSH, 0.6], [K.BOUGAIN, 0.06], [K.ORANGE, 0.1], [K.WHITE, 0.08], [K.BANANA, 0.06], [K.FERN, 0.1]];

export function makePlanter(env) {
  const { city, getChunk, landmarks, plazaSites, festSites, addCollider, quality, blocked } = env; // blocked(x, z, pad): a skywalk or subway entrance is here
  const collided = new Set();
  const keepOut = []; for (const l of landmarks) if (l.kind && l.kind !== "none") keepOut.push([l.x, l.z, 46]); for (const q of plazaSites) keepOut.push([q.x, q.z, 46]); for (const q of festSites) keepOut.push([q.x, q.z, 46]);
  const zoneCache = new Map();
  // the character of the land at a spot: how forested, which street-tree set, how built-up, how close to the sea
  const zoneAt = (x, z) => {
    const key = Math.floor(x / 24) * 4096 + Math.floor(z / 24); let zz = zoneCache.get(key); if (zz) return zz;
    const cx = (Math.floor(x / 24) + 0.5) * 24, cz = (Math.floor(z / 24) + 0.5) * 24;
    const d = districtAt(cx, cz), dens = districtDens(cx, cz), sd = shoreDist(cx, cz), alt = baseH(cx, cz);
    const forest = d && d.style === "forest" ? 1 - sstep(0.5, 1.1, Math.hypot(cx - d.x, cz - d.z) / d.r) : 0;
    const style = d ? d.style : "mixed"; const set = sd < 90 && sd > 0 ? "coast" : forest > 0.3 ? "forest" : STYLE_SET[style] || "green";
    const open = dens < 0.4 ? 1 : 0; let green = forest > 0.2 ? 1 : style === "suburb" || style === "upscale" || style === "planned" ? 0.75 : style === "old" || style === "colonial" || style === "dense" ? 0.32 : style === "tower" || style === "glass" || style === "future" || style === "industrial" || style === "port" ? 0.3 : 0.5;
    if (open) green = Math.max(green, 0.8); if (sd < 90 && sd > 0) green = Math.max(green, 0.6);
    zz = { forest, dens, set, alt, green, coast: sd > 0 && sd < 90, sd }; zoneCache.set(key, zz); if (zoneCache.size > 4000) zoneCache.clear(); return zz;
  };
  const patch = (x, z) => 0.55 + 0.9 * fbm(x * 0.021, z * 0.021, 5); // grassy patches and bare patches

  return function plantsFor(ci, cj, hAt) {
    const x0 = ci * CH, z0 = cj * CH, x1 = x0 + CH, z1 = z0 + CH, Q = quality ? quality() : 1;
    const R = mulberry(((ci * 73856093) ^ (cj * 19349663)) >>> 0), out = [];
    const bl = [], lampsN = [], furn = [];
    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { const c = getChunk(ci + di, cj + dj); for (const b of c.buildings) bl.push(b); for (const l of c.lamps) lampsN.push(l); for (const f of c.furniture || []) furn.push(f); }
    const ko = keepOut.filter((q) => q[0] > x0 - 120 && q[0] < x1 + 120 && q[1] > z0 - 120 && q[1] < z1 + 120);
    const nearB = (x, z, pad) => { for (const b of bl) { const dx = x - b.x, dz = z - b.z; if (dx * dx + dz * dz > (b.r + pad + 2) * (b.r + pad + 2)) continue; const cs = Math.cos(b.rot), sn = Math.sin(b.rot); const lx = dx * cs + dz * sn, lz = -dx * sn + dz * cs; if (Math.abs(lx) < b.w / 2 + pad && Math.abs(lz) < b.d / 2 + pad) return true; } return false; };
    const nearL = (x, z, r) => { for (const l of lampsN) if ((l.x - x) * (l.x - x) + (l.z - z) * (l.z - z) < r * r) return true; for (const f of furn) if ((f.x - x) * (f.x - x) + (f.z - z) * (f.z - z) < (r + 1.4) * (r + 1.4)) return true; return false; };
    const inKeep = (x, z) => { for (const q of ko) if ((q[0] - x) * (q[0] - x) + (q[1] - z) * (q[1] - z) < q[2] * q[2]) return true; return false; };
    // distance from the nearest road edge (ground roads only), and whether a flyover deck or piers are overhead
    const edgeInfo = (x, z) => {
      let ed = 1e9, over = false;
      city.nearSegs(x, z, 17, (r, i) => {
        const a = r.pts[i]; if (a.tun) return; const qq = city.seg(r, i, x, z); const e = qq.d - r.width / 2; const ground = a.w <= 0.35 && a.y - a.g <= 2.8 && !a.over;
        if (ground) { if (e < ed) ed = e; } else if (e < 3) over = true;
      });
      return { ed, over };
    };
    const tcell = new Map(); const tk = (x, z) => Math.floor(x / 3.6) * 8192 + Math.floor(z / 3.6);
    const treeFree = (x, z) => { const ix = Math.floor(x / 3.6), iz = Math.floor(z / 3.6); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = tcell.get((ix + a) * 8192 + iz + b); if (l) for (const t of l) if ((t[0] - x) * (t[0] - x) + (t[1] - z) * (t[1] - z) < t[2]) return false; } return true; };
    const count = { tree: 0, shrub: 0, grass: 0, rock: 0 }; const LIM = { tree: 900 * Q, shrub: 1300 * Q, grass: 2600 * Q, rock: 140 };
    let idx = 0;
    const put = (k, x, z, s, kind, minEdge, ei) => {
      if (x < x0 || x >= x1 || z < z0 || z >= z1 || count[kind] >= LIM[kind]) return false;
      if (isWater(x, z)) return false; const sd0 = shoreDist(x, z); if (sd0 < (kind === "rock" ? 0.5 : 3)) return false;
      if (inAirport(x, z, 24)) return false;
      const e = ei || edgeInfo(x, z); if (e.over || e.ed < minEdge) return false;
      if (kind === "tree" && !treeFree(x, z)) return false;
      if (nearB(x, z, kind === "tree" ? 1.2 : 0.6) || nearL(x, z, kind === "tree" ? 1.4 : 0.8)) return false;
      if (inKeep(x, z) || city.metroNear(x, z, kind === "tree" ? 3 : 1)) return false;
      if (blocked && blocked(x, z, kind === "tree" ? 6.5 : kind === "rock" ? 3.5 : 2.4)) return false; // nothing grows through a walkway
      const y = hAt ? hAt(x, z) : city.meshH(x, z); if (y < 0.15) return false;
      if (kind === "tree") { const r = TRUNK[k] ? TRUNK[k][0] : 0.4; const rr = (r + 2.4) * (r + 2.4); const kk = tk(x, z); let l = tcell.get(kk); if (!l) tcell.set(kk, (l = [])); l.push([x, z, rr * (k === K.BANYAN || k === K.UMBRELLA ? 3 : 1)]); }
      out.push({ k, x, y, z, s, sd: (ci * 92821 + cj * 689287 + (idx++) * 7919) | 0 }); count[kind]++; return true;
    };
    const streetTree = (set, u) => pickW(STREET[set] || STREET.green, u);
    const shrubKind = (u) => pickW(SHRUBS, u);

    // ---- pass A: road verges --------------------------------------------------------------------------------------------------------------------------------
    const seen = new Set(); const step = 3.2;
    city.nearSegs((x0 + x1) / 2, (z0 + z1) / 2, CH / 2 + 30, (r, i) => {
      const key = r.idx * 65536 + i; if (seen.has(key)) return; seen.add(key);
      const p = r.pts[i], q = r.pts[i + 1]; if (p.tun || q.tun) return; if (p.w > 0.35 || p.y - p.g > 2.8 || p.over) return;
      if (Math.max(p.x, q.x) < x0 - 26 || Math.min(p.x, q.x) > x1 + 26 || Math.max(p.z, q.z) < z0 - 26 || Math.min(p.z, q.z) > z1 + 26) return;
      const sl = q.s - p.s; if (sl <= 0.01) return; const tl = Math.hypot(q.x - p.x, q.z - p.z) || 1, tx = (q.x - p.x) / tl, tz = (q.z - p.z) / tl; const hw = r.width / 2, hwy = r.cls === "hwy", str = r.cls === "str";
      for (let k = Math.ceil(p.s / step); k * step < q.s; k++) {
        const t = (k * step - p.s) / sl, cx = p.x + (q.x - p.x) * t, cz = p.z + (q.z - p.z) * t, zn = zoneAt(cx, cz); const green = zn.green * patch(cx, cz);
        for (const sd of [-1, 1]) {
          const h1 = hash(r.idx, k, sd, 1), h2 = hash(r.idx, k, sd, 2), h3 = hash(r.idx, k, sd, 3), h4 = hash(r.idx, k, sd, 4), h5 = hash(r.idx, k, sd, 5);
          const nx = -tz * sd, nz = tx * sd; const at = (o) => [cx + nx * o, cz + nz * o];
          // big trees: closely spaced in forests, spaced out and set well back on motorways
          const spacing = zn.forest > 0.3 ? 7 : hwy ? 26 : str ? 20 : 16, pTree = (step / spacing) * (zn.forest > 0.3 ? 1.3 : 0.5 + green) * Q;
          if (h1 < pTree) { const o = hw + (hwy ? 8 : zn.forest > 0.3 ? 3 + h2 * 11 : 4.3 + h2 * 1.8); const [x, z] = at(o); const kind = zn.forest > 0.3 ? forestTree(zn.alt, h3, h4) : streetTree(zn.set, h3); put(kind, x, z, treeScale(kind, h5), "tree", 1.8); }
          // hedge and shrubs hugging the pavement edge
          if (h2 < (zn.forest > 0.3 ? 0.55 : 0.18 + green * 0.38) * Q * (step / 3.2)) { const o = hw + (hwy ? 3 : 2.0) + h3 * (zn.forest > 0.3 ? 8 : 3.6); const [x, z] = at(o); put(shrubKind(h4), x, z, 0.8 + h5 * 0.8, "shrub", 1.0); }
          // grass tufts along the verge, longer grass further out
          for (let g = 0; g < 2; g++) { const hg = hash(r.idx, k, sd, 10 + g), hg2 = hash(r.idx, k, sd, 20 + g), hg3 = hash(r.idx, k, sd, 30 + g); if (hg < (0.18 + green * 0.62) * Q * (hwy ? 1 : 0.9)) { const o = hw + 0.7 + hg2 * (zn.forest > 0.3 ? 12 : 6); const [x, z] = at(o); put(hg3 < 0.22 + zn.forest * 0.1 ? K.TALL : K.GRASS, x, z, 0.8 + hg3 * 0.7, "grass", 0.5); } }
          // boulders on rough ground at the roadside
          if (zn.forest > 0.2 && hash(r.idx, k, sd, 40) < 0.012 * Q) { const [x, z] = at(hw + 3 + hash(r.idx, k, sd, 41) * 9); put(hash(r.idx, k, sd, 42) < 0.3 ? K.BOULDER : K.ROCK, x, z, 0.8 + hash(r.idx, k, sd, 43) * 0.9, "rock", 1.2); }
        }
      }
    });

    // ---- pass B: the land between the roads ------------------------------------------------------------------------------------------------------------------
    const cell = 6.5;
    for (let gx = x0 + 3; gx < x1; gx += cell) for (let gz = z0 + 3; gz < z1; gz += cell) {
      const x = gx + (R() - 0.5) * cell, z = gz + (R() - 0.5) * cell; const u1 = R(), u2 = R(), u3 = R(), u4 = R(), u5 = R(), u6 = R();
      const zn = zoneAt(x, z); const pa = patch(x, z), grove = fbm(x * 0.012, z * 0.012, 8) > 0.6 ? 1 : 0;
      const sd = zn.sd; if (sd <= 0) continue;
      // trees
      let pT = zn.forest * 0.52 + (zn.forest < 0.1 ? (zn.dens < 0.25 ? 0.06 : zn.dens < 0.5 ? 0.035 : 0.014) : 0) + grove * 0.16 * (zn.dens < 0.7 ? 1 : 0.3) + (zn.coast ? 0.05 : 0);
      pT = clamp(pT * Q, 0, 0.9);
      if (u1 < pT) { const kind = zn.forest > 0.3 ? forestTree(zn.alt, u2, u3) : streetTree(zn.set, u2); put(kind, x, z, treeScale(kind, u4), "tree", 2.4); }
      // shrubs and ferns
      const pS = clamp((zn.forest * 0.46 + (zn.dens < 0.5 ? 0.07 : 0.025) + grove * 0.2) * Q * pa, 0, 0.8);
      if (u5 < pS) put(zn.forest > 0.3 && u6 < 0.3 ? K.FERN : shrubKind(u6), x + (u2 - 0.5) * 3, z + (u3 - 0.5) * 3, 0.8 + u4 * 0.9, "shrub", 1.2);
      // grass: forest floor, parks, wild land
      const pG = clamp((zn.forest * 0.5 + (zn.dens < 0.5 ? 0.22 : 0.05) + grove * 0.2) * Q * pa, 0, 0.85);
      for (let g = 0; g < 2; g++) { const a = R(), b2 = R(), c2 = R(), d2 = R(); if (a < pG) put(c2 < 0.2 ? K.TALL : K.GRASS, x + (b2 - 0.5) * cell, z + (d2 - 0.5) * cell, 0.8 + c2 * 0.7, "grass", 0.8); }
      // boulders: steep ground, hill forests, the shoreline
      const slope = Math.hypot(baseH(x + 4, z) - baseH(x - 4, z), baseH(x, z + 4) - baseH(x, z - 4)) / 8; const shore = zn.sd < 14 ? 1 : 0;
      const pR = (0.006 + zn.forest * 0.014 + clamp((slope - 0.12) * 0.5, 0, 0.12) + shore * 0.08) * Q;
      if (R() < pR) put(R() < 0.25 + slope ? K.BOULDER : K.ROCK, x, z, 0.8 + R() * 0.9, "rock", 1.2);
    }
    // ---- trunks are solid: register this chunk's trees with the physics once ---------------------------------------------------------------------------------
    const ck = ci * 4096 + cj;
    if (!collided.has(ck)) { collided.add(ck); for (const p of out) if (isTree(p.k) && TRUNK[p.k]) { const r = TRUNK[p.k][0] * Math.min(1.4, p.s); addCollider({ t: 0, x: p.x, z: p.z, hw: r, hd: r, c: 1, s: 0, y: p.y, h: TRUNK[p.k][1] }, p.x - 1, p.z - 1, p.x + 1, p.z + 1); } }
    return out;
  };
}
function forestTree(alt, u, v) {
  const pf = clamp(0.12 + (alt - 10) / 90, 0.1, 0.72);
  if (u < pf) return v < 0.1 ? K.CYPRESS : K.PINE;
  return pickW(STREET.forest, v);
}
function treeScale(k, u) {
  switch (k) {
    case K.PINE: return 0.8 + u * 0.65; case K.TEAK: return 0.8 + u * 0.6; case K.BANYAN: return 0.85 + u * 0.4;
    case K.COCONUT: case K.ROYAL: case K.ARECA: return 0.85 + u * 0.4; default: return 0.8 + u * 0.55;
  }
}
