// Midnight Burn: Mumbai Drift — city icons and "x-factor" places (Upgrade 34): Rajabai Clock Tower, Wankhede Stadium, the Haji Ali Dargah on its islet,
// the Colaba Causeway fairy-light bazaar, the Dadar marigold arches and the Aarey banyan tunnel (the last three stand over / beside the road so you drive through them).
import { isWater, mulberry } from "./geo";
import { walkRoad, post, twig, ball } from "./maps/landmarksJapan3d";
import { buildMumbaiMarine } from "./mumbaiMarine3d";

export function buildMumbaiIcons(H) {
  const { world, g, glow, C, ico, cyl, gh, spot, fit, get } = H; const city = world.city;
  const white = C(0xf2efe6), stone = C(0xb79d6e), stoneD = C(0x8c7352), dark = C(0x2a2622), steelc = C(0xb9c0cc);
  const lamp = (x, y, z, r, gg, b, sz) => glow.push(x, y, z, r, gg, b, sz);

  // ---- Rajabai Clock Tower: a tall Gothic tower, four clock faces, a spire --------------------------------------------------------------------------------
  { const l = get("rajabai"); if (l) { const F = fit(l.x, l.z, 0, 28, 28, 200); if (F) { const [x, z] = F, y = gh(x, z);
    g.box(x, y, z, 22, 6, 22, 0, stone); g.box(x, y + 6, z, 15, 44, 15, 0, stone2()); g.box(x, y + 50, z, 11, 14, 11, 0, stone); g.box(x, y + 64, z, 12.5, 2, 12.5, 0, stoneD);
    for (const [dx, dz] of [[0, 5.8], [0, -5.8], [5.8, 0], [-5.8, 0]]) { g.box(x + dx, y + 56, z + dz, dx ? 0.3 : 6, 6, dx ? 6 : 0.3, 0, white); lamp(x + dx * 1.2, y + 59, z + dz * 1.2, 1, 0.9, 0.6, 12); }
    for (let k = 0; k < 4; k++) { const a = k * 1.5708 + 0.785; g.geo(cyl, x + Math.cos(a) * 5, y + 64, z + Math.sin(a) * 5, 0.9, 7, 0.9, 0, stone); }
    g.geo(cyl, x, y + 66, z, 4.6, 16, 4.6, 0, C(0x4f6a70)); g.geo(cyl, x, y + 82, z, 0.35, 8, 0.35, 0, steelc);
    for (let f = 0; f < 6; f++) lamp(x, y + 10 + f * 8, z + 8, 1, 0.75, 0.4, 14); } } }
  function stone2() { return C(0xa38a63); }

  // ---- Wankhede Stadium: a floodlit oval bowl with four light masts -----------------------------------------------------------------------------------------
  { const l = get("wankhede"); if (l) { const F = fit(l.x, l.z, 0, 110, 90, 260); if (F) { const [x, z] = F, y = gh(x, z);
    for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.283; g.box(x + Math.cos(a) * 46, y, z + Math.sin(a) * 38, 12, 12 + (i % 2) * 2, 5, a + Math.PI / 2, C(0xd8d2c4), C(0x6a6358)); }
    g.geo(cyl, x, y - 0.1, z, 38, 0.6, 30, 0, C(0x3f8a45)); g.box(x, y + 0.5, z, 20, 0.2, 4, 0, C(0xd2b27a));
    for (const a of [0.8, 2.35, 3.93, 5.5]) { const px = x + Math.cos(a) * 54, pz = z + Math.sin(a) * 45; g.geo(cyl, px, y, pz, 0.7, 52, 0.7, 0, steelc); g.box(px, y + 50, pz, 9, 5, 3, a + Math.PI / 2, dark); for (let q = -2; q <= 2; q++) lamp(px + Math.cos(a + 1.57) * q * 1.6, y + 51, pz + Math.sin(a + 1.57) * q * 1.6, 1, 0.97, 0.85, 22); }
  } } }

  // ---- Haji Ali Dargah: a white mosque and tomb on its islet off Worli, minarets, a causeway of lights ------------------------------------------------------------
  // The map's pin sits a little inland, so find the nearest shore from it, then put the islet out in open water from there and run the causeway back to the shore.
  { const l = get("hajiali"); if (l) { let S = null, U = null, bestD = 1e9;
    for (let k = 0; k < 48; k++) { const a = (k / 48) * 6.283; for (let d = 0; d < Math.min(bestD, 1200); d += 15) { const px = l.x + Math.cos(a) * d, pz = l.z + Math.sin(a) * d; if (isWater(px, pz)) { if (d < bestD) { bestD = d; S = [px, pz]; U = [Math.cos(a), Math.sin(a)]; } break; } } }
    let hx = null, hz = null, dd = 0;
    if (S) for (dd = 150; dd <= 560 && hx == null; dd += 20) { const px = S[0] + U[0] * dd, pz = S[1] + U[1] * dd; let ok = true; for (const [ox, oz] of [[0, 0], [45, 0], [-45, 0], [0, 45], [0, -45], [32, 32], [-32, -32], [32, -32], [-32, 32]]) if (!isWater(px + ox, pz + oz)) { ok = false; break; } if (ok) { hx = px; hz = pz; } }
    if (hx != null) { const y = 0.5; l.isle = [hx, hz]; // (kept so a test camera can find the islet)
      g.geo(cyl, hx, y - 1.5, hz, 34, 2.2, 28, 0, C(0x9a9686)); g.box(hx, y, hz, 24, 7, 18, 0, white); g.geo(ico, hx, y + 7, hz, 6.5, 6.5, 6.5, 0, white);
      for (const [dx, dz] of [[-9, -7], [9, -7], [-9, 7], [9, 7]]) { g.geo(cyl, hx + dx, y, hz + dz, 1.1, 16, 1.1, 0, white); g.geo(ico, hx + dx, y + 16.5, hz + dz, 1.5, 1.8, 1.5, 0, white); lamp(hx + dx, y + 18, hz + dz, 1, 0.9, 0.6, 7); }
      lamp(hx, y + 12, hz, 0.7, 1, 0.8, 30);
      const rot = Math.atan2(U[1], U[0]); for (let q = 0; q < dd - 24; q += 10) { const px = S[0] + U[0] * (q + 4), pz = S[1] + U[1] * (q + 4); g.box(px, 0.7, pz, 10.4, 0.6, 3.6, rot, C(0x8a8678)); lamp(px, 2.2, pz, 1, 0.85, 0.5, 5); }
    } } }

  // ---- Colaba Causeway: strings of fairy lights and bunting across the lane, striped stall awnings along both sides --------------------------------------------------
  { const l = get("colabacauseway"); if (l) { const rnd = mulberry(12); const cols = [[1, 0.35, 0.5], [1, 0.8, 0.25], [0.4, 1, 0.6], [0.4, 0.8, 1], [1, 0.55, 0.2]];
    walkRoad(city, l, 340, 7, (x, y, z, nx, nz, tx, tz, r, s) => {
      const hw = r.width / 2 + 0.6; for (let q = -2; q <= 2; q++) { const p = q / 2; lamp(x + nx * hw * p, y + 6.2 - (1 - p * p) * 0.9, z + nz * hw * p, ...cols[((s / 7 | 0) + q + 6) % 5], 6); }
      if (((s / 7) | 0) % 2 === 0) for (const sd of [-1, 1]) { const px = x + nx * (hw + 1.2) * sd, pz = z + nz * (hw + 1.2) * sd; g.box(px, y, pz, 2.6, 2.1, 1.6, Math.atan2(tz, tx), [C(0xd8402a), C(0xf2c21c), C(0x2f8ac8), C(0xe8e0d0)][((s / 7 | 0) + (sd > 0 ? 1 : 0)) & 3]); g.box(px, y + 2.1, pz, 3.1, 0.15, 2.2, Math.atan2(tz, tx), C(0xf2eee6)); lamp(px, y + 1.6, pz, 1, 0.8, 0.45, 7); }
    }); } }

  // ---- Dadar marigold arches: a tunnel of orange-and-yellow flower arches over the lane ----------------------------------------------------------------------------
  { const l = get("phoolgali"); if (l) { const orange = C(0xf28a1a), yellow = C(0xf7c92a);
    walkRoad(city, l, 260, 13, (x, y, z, nx, nz, tx, tz, r, s) => {
      const hw = r.width / 2 + 1.0, rot = Math.atan2(tz, tx);
      for (const sd of [-1, 1]) { g.geo(post, x + nx * hw * sd, y, z + nz * hw * sd, 0.32, 5.4, 0.32, 0, orange); g.geo(ball, x + nx * hw * sd, y + 5.5, z + nz * hw * sd, 0.55, 0.55, 0.55, 0, yellow); }
      // a thin top rail, then the marigold garland drooping across it: small flower balls on a gentle sag, orange and yellow in turn, with a few long strands hanging down
      g.box(x, y + 5.45, z, 0.25, 0.25, hw * 2, rot, orange);
      for (let q = -6; q <= 6; q++) { const p = q / 6; g.geo(ball, x + nx * p * hw, y + 5.05 - (1 - p * p) * 0.55, z + nz * p * hw, 0.34, 0.4, 0.34, 0, q % 2 ? yellow : orange);
        if (q % 3 === 0) g.geo(twig, x + nx * p * hw, y + 3.6, z + nz * p * hw, 0.05, 1.5, 0.05, 0, q % 2 ? yellow : orange); }
      lamp(x, y + 5, z, 1, 0.7, 0.2, 8);
    }); } }

  // ---- Aarey banyan tunnel: giant banyans meeting over the road, hanging roots, fireflies ------------------------------------------------------------------------------------
  { const l = get("aareybanyan"); if (l) { const rnd = mulberry(99), leaf = [C(0x2f6a2a), C(0x3a7a30), C(0x28582a)], bark = C(0x4a3a2a);
    walkRoad(city, l, 380, 14, (x, y, z, nx, nz, tx, tz, r) => {
      const off = r.width / 2 + 3.2;
      for (const sd of [-1, 1]) { const px = x + nx * off * sd, pz = z + nz * off * sd; g.geo(post, px, Math.max(y - 0.2, gh(px, pz)), pz, 1.1, 9, 1.1, 0, bark);
        for (let q = 0; q < 3; q++) g.geo(ico, px - nx * sd * (1 + q * 2.4) + (rnd() - 0.5) * 3, y + 9 + q * 0.6, pz - nz * sd * (1 + q * 2.4) + (rnd() - 0.5) * 3, 5.2, 3.2, 5.2, 0, leaf[q]);
        for (let q = 0; q < 3; q++) g.geo(twig, px - nx * sd * (2 + q), y + 3, pz - nz * sd * (2 + q), 0.07, 6, 0.07, 0, bark); }
      g.geo(ico, x + (rnd() - 0.5) * 2, y + 11, z + (rnd() - 0.5) * 2, 6, 1.8, 6, 0, leaf[(rnd() * 3) | 0]);
      if (rnd() < 0.5) lamp(x + (rnd() - 0.5) * 8, y + 2 + rnd() * 3, z + (rnd() - 0.5) * 8, 0.7, 1, 0.4, 5);
    }); } }
  buildMumbaiMarine(H); // Marine Drive and the Coastal Road in detail (Upgrade 51)
}
