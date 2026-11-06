// Midnight Burn: Mumbai — Marine Drive and the Coastal Road in detail (Upgrade 51).
// Today: the Queen's Necklace promenade (stone walk, low sea wall, tetrapods in the surf, ornamental lamps that glow like a string of pearls, benches, palms),
// and a landscaped cycle-and-walk strip beside the Coastal Road. In 2046: solar canopies over the promenade, a sky-rail on slim pylons out over the water,
// glowing LED arches across the road, and five glass spire towers (with sky-gardens and sky-bridges) behind the sea front.
import { shoreDist, isWater, mulberry } from "./geo";

export function buildMumbaiMarine(H) {
  const { world, g, glow, C, ico, cyl, gh, get } = H; const city = world.city; const F = world.era === "2046";
  const road = (id) => city.roads.find((r) => r.id === id);
  // walk a road by arc length: cb(x, y, z, tx, tz, s, p) at every `step` metres, only where the road is on the ground (no tunnels, no flyovers)
  const along = (r, s0, s1, step, cb) => {
    let k = 0; for (let s = s0; s < s1; s += step) {
      while (k < r.pts.length - 2 && r.pts[k + 1].s < s) k++; const a = r.pts[k], b = r.pts[k + 1]; if (!b || a.tun || a.over || (a.y - a.g) > 1.2) continue;
      const t = (s - a.s) / ((b.s - a.s) || 1), dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1; cb(a.x + dx * t, a.y + (b.y - a.y) * t, a.z + dz * t, dx / L, dz / L, s, a);
    }
  };
  const seaSide = (x, z, tx, tz) => (shoreDist(x - tz * 30, z + tx * 30) < shoreDist(x + tz * 30, z - tx * 30) ? 1 : -1); // +1: the sea lies to the left of travel (normal = (-tz, tx))
  const waterAt = (x, z, nx, nz, from) => { for (let d = from; d < 140; d += 2) if (isWater(x + nx * d, z + nz * d)) return d; return 140; }; // how far out (metres from the road centre) the water begins
  const stone = C(0xcdbf9f), cream = C(0xe6dcc3), conc = C(0x9b9a94), concD = C(0x7d7c76), dark = C(0x26262c), brass = C(0x8a6d3b), green = C(0x3f8a45), trunk = C(0x6b5436), turf = C(0x5d7d3a);
  const tetra = (x, y, z, rot, sc) => { // a tetrapod: three crossing arms and a post, like the concrete jacks piled along the sea wall
    for (const da of [0, 1.0472, -1.0472]) g.box(x, y + 0.45 * sc, z, 3.3 * sc, 0.95 * sc, 0.95 * sc, rot + da, conc);
    g.box(x, y, z, 0.95 * sc, 2.4 * sc, 0.95 * sc, rot, concD);
  };
  const palm = (x, y, z, h) => { g.geo(cyl, x, y, z, 0.17, h, 0.17, 0, trunk); for (let q = 0; q < 5; q++) { const a = q * 1.2566; g.geo(ico, x + Math.cos(a) * 1.2, y + h + 0.1, z + Math.sin(a) * 1.2, 1.5, 0.28, 0.45, a, green); } g.geo(ico, x, y + h + 0.3, z, 0.7, 0.6, 0.7, 0, green); };
  // a realistic leafy tree: tapered trunk, a crown of overlapping leaf clumps (darker underneath, lighter on top), optional blossom clumps (gulmohar orange, pink, jacaranda lilac)
  const trng = mulberry(7717), LEAF = [0x2c5528, 0x35622d, 0x42702f, 0x4f7d35, 0x5f8a3c], BLOOM = [0xd8602c, 0xe39ab4, 0xa77fc0, 0xe8b84a];
  const tree = (x, y, z, s, bloom) => {
    const th = (2.6 + trng() * 1.2) * s, lean = (trng() - 0.5) * 0.5; g.geo(cyl, x, y, z, 0.3 * s, th * 0.55, 0.3 * s, 0, C(0x4a3a28)); g.geo(cyl, x + lean * 0.3, y + th * 0.5, z, 0.17 * s, th * 0.6, 0.17 * s, 0, C(0x56432e));
    const bc = bloom ? BLOOM[(trng() * BLOOM.length) | 0] : 0, n = 6 + ((trng() * 3) | 0);
    for (let k = 0; k < n; k++) { const a = trng() * 6.283, d = (0.5 + trng() * 1.5) * s, hy = th * 0.85 + (trng() * 2.3 + (k > n - 3 ? 1.2 : 0)) * s, sz = (1.3 + trng() * 1.1) * s;
      const top = hy > th + 1.6 * s, flo = bloom && trng() < (top ? 0.75 : 0.35), c = flo ? bc : LEAF[Math.min(4, Math.max(0, ((hy - th * 0.85) / (2.6 * s) * 4 + trng() * 1.4) | 0))];
      g.geo(ico, x + lean + Math.cos(a) * d, y + hy, z + Math.sin(a) * d, sz * 1.15, sz * 0.85, sz * 1.15, a, C(c)); }
    if (bloom) g.geo(ico, x + lean, y + th * 0.9, z, 1.6 * s, 1.1 * s, 1.6 * s, 0, C(LEAF[1]));
  };
  const shrub = (x, y, z, s, col) => { for (let k = 0; k < 3; k++) g.geo(ico, x + (trng() - 0.5) * 1.2 * s, y + 0.3 * s, z + (trng() - 0.5) * 1.2 * s, (0.7 + trng() * 0.4) * s, 0.55 * s, (0.7 + trng() * 0.4) * s, 0, C(col != null && trng() < 0.4 ? col : LEAF[(trng() * 3) | 0])); };

  // a promenade beside a road: walk, parapet, lamps, benches, palms (the sea side only)
  const promenade = (r, o) => {
    const hw = r.width / 2 + 0.35; const lampCol = o.lamp, step = 6; let n = 0;
    along(r, 12, r.len - 12, step, (x, y, z, tx, tz, s) => {
      const sd = seaSide(x, z, tx, tz), nx = -tz * sd, nz = tx * sd, rot = Math.atan2(tz, tx); const at = (off) => [x + nx * off, z + nz * off]; n++;
      const dW = waterAt(x, z, nx, nz, hw), pw = Math.max(3, Math.min(o.w, dW - hw - 1.5)); const w = at(hw + pw / 2 + 0.3); g.box(w[0], y - 1.2, w[1], step + 0.3, 1.3, pw, rot, o.ground);
      if (o.parapet) { const q = at(hw + 0.7); g.box(q[0], y + 0.1, q[1], step + 0.25, 0.95, 0.5, rot, cream); g.box(q[0], y + 1.05, q[1], step + 0.25, 0.12, 0.7, rot, stone); }
      if (o.cycle) { const q = at(hw + 1.9); g.box(q[0], y + 0.1, q[1], step + 0.3, 0.04, 2.3, rot, C(0xb4503c)); const q2 = at(hw + 3.4); g.box(q2[0], y + 0.1, q2[1], step + 0.3, 0.05, 0.9, rot, turf); }
      if (n % 2 === 0) { const q = at(hw + pw - 1.0); g.geo(cyl, q[0], y + 0.1, q[1], 0.09, 4.4, 0.09, 0, o.post); g.box(q[0], y + 4.4, q[1], 0.5, 0.18, 0.5, rot, o.post); g.geo(ico, q[0], y + 4.75, q[1], 0.3, 0.3, 0.3, 0, C(0xfff2c8)); glow.push(q[0], y + 4.75, q[1], lampCol[0], lampCol[1], lampCol[2], o.lampSize); }
      if (o.benches && n % 4 === 1) { const q = at(hw + 2.2); g.box(q[0], y + 0.1, q[1], 1.9, 0.12, 0.55, rot, C(0x74502e)); g.box(q[0] + nx * 0.28, y + 0.1, q[1] + nz * 0.28, 1.9, 0.6, 0.08, rot, C(0x74502e)); }
      if (o.trees && n % 2 === 0) { const q = at(hw + pw * (0.42 + 0.3 * ((n % 3) - 1) * 0.6)); tree(q[0], y + 0.1, q[1], 0.9 + (n % 4) * 0.12, n % 6 === 0); }
      if (o.trees && n % 3 === 1) { const q = at(hw + pw * 0.75); shrub(q[0], y + 0.1, q[1], 1.0, [0xd8602c, 0xe39ab4, 0xf2e6f0][n % 3]); }
      if (o.palms && n % 5 === 3) { const q = at(hw + 1.6); palm(q[0], y + 0.1, q[1], 5.2 + (n % 3) * 0.5); }
    });
  };

  // ---- Marine Drive, the Queen's Necklace ---------------------------------------------------------------------------------------------------------------------
  const md = road("marine");
  if (md) {
    const hw = md.width / 2 + 0.35;
    promenade(md, { w: 9, ground: stone, parapet: true, benches: true, palms: true, post: brass, lamp: F ? [0.55, 0.95, 1] : [1, 0.78, 0.42], lampSize: F ? 7 : 6 });
    // the tetrapods in the surf, two staggered rows beyond the promenade
    let t = 0; along(md, 14, md.len - 14, 5, (x, y, z, tx, tz, s) => {
      const sd = seaSide(x, z, tx, tz), nx = -tz * sd, nz = tx * sd, rot = Math.atan2(tz, tx) + (t % 5) * 0.4; t++;
      const dW = waterAt(x, z, nx, nz, hw); for (const [off, dv] of [[dW - 0.5, 0], [dW + 2.8, 2.5]]) { const px = x + nx * off + tx * dv, pz = z + nz * off + tz * dv; tetra(px, -0.5, pz, rot + dv, 0.9 + (t % 3) * 0.12); if (F && t % 6 === 0 && !dv) glow.push(px, 1.2, pz, 0.25, 0.9, 1, 7); }
    });
    if (F) {
      // solar canopies over the promenade, long panels with a lit edge, with gaps between so the sea shows through
      let c = 0; along(md, 20, md.len - 40, 32, (x, y, z, tx, tz) => {
        const sd = seaSide(x, z, tx, tz), nx = -tz * sd, nz = tx * sd, rot = Math.atan2(tz, tx); c++;
        const pw = Math.max(3, Math.min(9, waterAt(x, z, nx, nz, hw) - hw - 1.5)); for (const off of [hw + 1.3, hw + pw - 0.6]) g.geo(cyl, x + nx * off, y, z + nz * off, 0.16, 5.4, 0.16, 0, C(0xb9c4cf));
        const mo = hw + (pw + 1.3) / 2 + 0.2, m = [x + nx * mo, z + nz * mo]; g.box(m[0], y + 5.4, m[1], 22, 0.22, pw + 0.2, rot, C(0x16314a)); g.box(m[0], y + 5.62, m[1], 21, 0.06, Math.max(1, pw - 1), rot, C(0x2a6fa8));
        for (const dv of [-10, 0, 10]) glow.push(m[0] + tx * dv, y + 5.2, m[1] + tz * dv, 0.4, 0.9, 1, 9);
      });
      // the sky-rail: a slim elevated beam out over the water on pylons, with pods gliding by
      let q = 0; const podAt = new Set([8, 21, 33]);
      along(md, 10, md.len - 10, 6, (x, y, z, tx, tz) => {
        const sd = seaSide(x, z, tx, tz), nx = -tz * sd, nz = tx * sd, rot = Math.atan2(tz, tx), px = x + nx * (waterAt(x, z, nx, nz, hw) + 12), pz = z + nz * (waterAt(x, z, nx, nz, hw) + 12); q++;
        g.box(px, y + 9.0, pz, 6.6, 0.85, 2.6, rot, C(0xcfd6de)); g.box(px, y + 9.0, pz, 6.6, 0.12, 0.5, rot, C(0x2a6fa8)); glow.push(px, y + 8.8, pz, 0.35, 0.85, 1, 5);
        if (q % 6 === 0) g.geo(cyl, px, -1.5, pz, 0.75, y + 10.0, 0.75, 0, C(0xe4e8ec));
        if (podAt.has(q)) { g.geo(ico, px, y + 10.1, pz, 5.4, 0.95, 1.1, rot, C(0xf2f4f8)); g.box(px, y + 10.2, pz, 8.0, 0.22, 2.1, rot, C(0x24384e)); glow.push(px, y + 10.3, pz, 0.7, 1, 1, 13); }
      });
      // LED arches across the road
      for (const f of [0.18, 0.42, 0.66, 0.9]) {
        const s = md.len * f; let k = 0; while (k < md.pts.length - 2 && md.pts[k + 1].s < s) k++; const a = md.pts[k], b = md.pts[k + 1]; if (a.tun || a.over) continue; const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, tx = dx / L, tz = dz / L, nx = -tz, nz = tx, y = a.y, rot = Math.atan2(nz, nx);
        const span = hw + 1.2; for (const sd of [-1, 1]) { g.geo(cyl, a.x + nx * span * sd, y, a.z + nz * span * sd, 0.45, 17.5, 0.45, 0, C(0xdfe5ea)); g.box(a.x + nx * (span - 1.2) * sd * 0.9, y + 15.2, a.z + nz * (span - 1.2) * sd * 0.9, 0.5, 2.6, 0.5, rot, C(0xdfe5ea)); }
        g.box(a.x, y + 17.4, a.z, span * 2 + 1.6, 0.7, 1.3, rot, C(0xe9eef2));
        for (let u = -span; u <= span; u += 2.4) glow.push(a.x + nx * u, y + 16.9, a.z + nz * u, (u / 2.4 | 0) % 2 ? 0.2 : 1, (u / 2.4 | 0) % 2 ? 0.9 : 0.3, (u / 2.4 | 0) % 2 ? 1 : 0.8, 7);
      }
    }
  }

  // ---- the Coastal Road: a landscaped walk-and-cycle strip on the sea side ----------------------------------------------------------------------------------------
  for (const id of F ? ["coastalS", "coastal"] : ["coastalS"]) { const r = road(id); if (r) promenade(r, { w: id === "coastalS" ? 16 : 7, ground: id === "coastalS" ? C(0x66863f) : C(0xb9b19a), cycle: true, trees: id === "coastalS", post: C(0x3a3d44), lamp: F ? [0.55, 0.95, 1] : [1, 0.9, 0.7], lampSize: 6, palms: false }); }

  // ---- Haji Ali: the interchange park inside the loop ramp (Nexus Park / Sunset View Gallery), winding paths, lawns and flowering trees --------------------------------------------
  { const HL = get("hajiali"); const P = HL && HL.park; if (P) {
    const rnd = mulberry(1951), cx = P.x, cz = P.z, R = P.r; let y0 = -1e9; for (let k = 0; k < 16; k++) y0 = Math.max(y0, gh(cx + Math.cos(k * 0.3927) * R * 0.9, cz + Math.sin(k * 0.3927) * R * 0.9)); y0 = Math.max(y0, gh(cx, cz));
    g.geo(cyl, cx, y0 - 2.4, cz, R, 2.6, R, 0, C(0x5a7a38)); // the lawn (its top sits just above the highest ground under it)
    g.geo(cyl, cx, y0 - 0.1, cz, R * 0.97, 0.28, R * 0.97, 0, C(0x6b8c40));
    const yt = y0 + 0.2, pathC = C(0xe9dfc8);
    for (let t = 0; t < 1; t += 0.012) { const an = t * 9.4, rd = R * (0.18 + 0.62 * t), px = cx + Math.cos(an) * rd, pz = cz + Math.sin(an) * rd * 0.92, nx2 = cx + Math.cos(an + 0.113) * (R * (0.18 + 0.62 * (t + 0.012))), nz2 = cz + Math.sin(an + 0.113) * (R * (0.18 + 0.62 * (t + 0.012))) * 0.92; g.box(px, yt - 0.05, pz, Math.hypot(nx2 - px, nz2 - pz) + 0.6, 0.12, 2.4, Math.atan2(nz2 - pz, nx2 - px), pathC); if (F && ((t * 83) | 0) % 2 === 0) glow.push(px, yt + 0.3, pz, 0.3, 0.95, 1, 3); }
    for (let u = -R * 0.9; u < R * 0.9; u += 6) g.box(cx + u, yt - 0.05, cz, 6.4, 0.12, 2.0, 0, pathC); // a straight walk across
    const flower = [0xd8602c, 0xe39ab4, 0xa77fc0, 0xe8b84a, 0xc8483a];
    for (let q = 0; q < 54; q++) { const an = rnd() * 6.283, rd = Math.sqrt(rnd()) * R * 0.86; tree(cx + Math.cos(an) * rd, yt, cz + Math.sin(an) * rd, 0.85 + rnd() * 0.6, rnd() < 0.34); }
    for (let q = 0; q < 40; q++) { const an = q * 0.157 + rnd() * 0.1; shrub(cx + Math.cos(an) * R * 0.95, yt, cz + Math.sin(an) * R * 0.95, 1.3, null); } // clipped hedge round the edge
    for (let q = 0; q < 20; q++) { const an = rnd() * 6.283, rd = Math.sqrt(rnd()) * R * 0.9; g.geo(ico, cx + Math.cos(an) * rd, yt + 0.2, cz + Math.sin(an) * rd, 0.8 + rnd() * 0.5, 0.35, 0.7 + rnd() * 0.5, 0, C(flower[(rnd() * flower.length) | 0])); } // flower beds
    for (let q = 0; q < 10; q++) { const an = q * 0.628 + 0.2, px = cx + Math.cos(an) * R * 0.93, pz = cz + Math.sin(an) * R * 0.93; g.geo(cyl, px, yt, pz, 0.09, 4.2, 0.09, 0, C(0x3a3d44)); g.geo(ico, px, yt + 4.4, pz, 0.32, 0.32, 0.32, 0, C(0xfff2c8)); glow.push(px, yt + 4.4, pz, F ? 0.55 : 1, F ? 0.95 : 0.85, F ? 1 : 0.55, 6); } // lamps round the rim
    g.box(cx - R * 0.2, yt, cz + R * 0.35, 16, 0.4, 9, 0.3, C(0xf4f0e6)); g.box(cx - R * 0.2, yt + 3.6, cz + R * 0.35, 18, 0.35, 11, 0.3, C(0xf4f0e6)); for (const [ox, oz] of [[-7, -3.5], [7, -3.5], [-7, 3.5], [7, 3.5]]) g.geo(cyl, cx - R * 0.2 + ox, yt, cz + R * 0.35 + oz, 0.18, 3.6, 0.18, 0, C(0xdfe5ea)); glow.push(cx - R * 0.2, yt + 3.2, cz + R * 0.35, 1, 0.85, 0.55, 12); // the viewing gallery pavilion
  } }

  // ---- 2046: glass spire towers behind the sea front, with sky-gardens and sky-bridges -----------------------------------------------------------------------------
  const L0 = get("marinedrive"); const sites = (L0 && L0.sites) || [];
  if (F) {
    const glassA = [C(0x8fc2dc), C(0x9fd0d8), C(0xa6b8e0), C(0x86c8c0), C(0xb2c4dc)];
    sites.forEach((S, i) => {
      const y = Math.max(0.3, gh(S.x, S.z)), H0 = S.h, gc = glassA[i % 5], rot = S.rot, c = Math.cos(rot), sn = Math.sin(rot);
      const tiers = [[30, 0.46], [25, 0.3], [19, 0.17], [11, 0.07]]; let yy = y;
      for (const [w, f] of tiers) { g.box(S.x, yy, S.z, w, H0 * f, w, rot, gc); g.box(S.x, yy + H0 * f - 0.4, S.z, w + 1.2, 0.8, w + 1.2, rot, C(0xe8eef4)); // glass shaft and a white slab where it steps in
        for (const [ox, oz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const px = S.x + (ox * c - oz * sn) * w / 2, pz = S.z + (ox * sn + oz * c) * w / 2; for (let h = 6; h < H0 * f; h += 14) glow.push(px, yy + h, pz, (i + h) % 3 ? 0.3 : 1, (i + h) % 3 ? 0.9 : 0.35, 1, 11); }
        yy += H0 * f; }
      g.geo(cyl, S.x, yy, S.z, 0.55, H0 * 0.12, 0.55, 0, C(0xdfe5ea)); glow.push(S.x, yy + H0 * 0.12, S.z, 1, 0.2, 0.2, 14); // aviation light
      const gy = y + H0 * 0.33; g.geo(cyl, S.x, gy, S.z, 17, 1.2, 17, 0, C(0x4f9a52)); for (let a = 0; a < 6; a++) g.geo(ico, S.x + Math.cos(a) * 12, gy + 1.2, S.z + Math.sin(a) * 12, 2.4, 2.8, 2.4, 0, C(0x3f8a45)); glow.push(S.x, gy + 3, S.z, 0.6, 1, 0.7, 24); // a sky-garden ring
      const nx = sites[i + 1]; if (nx) { const d = Math.hypot(nx.x - S.x, nx.z - S.z); if (d < 300) { const my = y + H0 * 0.55; g.box((S.x + nx.x) / 2, my, (S.z + nx.z) / 2, d - 24, 5, 6, Math.atan2(nx.z - S.z, nx.x - S.x), C(0xb8d4e0)); for (let u = 0; u <= d - 30; u += 16) glow.push(S.x + (nx.x - S.x) * (0.1 + u / d), my + 2.5, S.z + (nx.z - S.z) * (0.1 + u / d), 0.5, 0.95, 1, 9); } }
    });
  }
}
