// Midnight Burn - draws the skywalks and subway entrances planned in walkways.js into a chunk.
// B = { deck, neon, glow (array pushed x,y,z,r,g,b,size), C(hex) -> colour, HOT(r,g,b,k) -> glowing colour }, all supplied by chunks3d.js.
import { WK, structLine } from "./walkways";

const STAIR_RUN = 0.4; // metres of stair per step (10.5 m of stair rises 5.2 m: about 26 steps of 0.2 m)

export function buildWalkwayGeo(world, ci, cj, B) {
  const list = world.walkways ? world.walkways.inChunk(ci, cj) : [];
  for (const st of list) { if (st.kind === "sky") sky(world, st, B); else sub(world, st, B); }
}

const rotOf = (P) => Math.atan2(P.tz, P.tx);
// a box that also has an underside (boxes elsewhere have none, because nobody ever sees their undersides - but people drive under a skywalk)
function solid(g, cx, y0, cz, w, h, d, rot, col, topCol, uvm) {
  g.box(cx, y0, cz, w, h, d, rot, col, topCol, uvm);
  const c = Math.cos(rot), s = Math.sin(rot), hw = w / 2, hd = d / 2, P = (lx, lz) => [cx + lx * c - lz * s, cz + lx * s + lz * c];
  const A = P(-hw, -hd), B = P(hw, -hd), C = P(hw, hd), D = P(-hw, hd);
  g.quadV([A[0], y0, A[1]], [B[0], y0, B[1]], [C[0], y0, C[1]], [D[0], y0, D[1]], col);
}

function sky(world, st, B) {
  const { deck, neon, glow, C, HOT } = B; const W = WK.W, H = st.H, LS = st.LS;
  const conc = C(0xa6a6b0), conc2 = C(0x92929c), steel = C(0x373a44), roofC = C(0x474a56), led = HOT(0.75, 0.9, 1, 1.15), warm = HOT(1, 0.93, 0.78, 1.7);
  const line = structLine(st, STAIR_RUN);
  const hAt = (s) => world.walkways.heightAt(st, s);
  // ---- the two stairs: solid steps, a steel balustrade down each side ----
  for (let k = 0; k < line.length - 1; k++) {
    const P = line[k], Q = line[k + 1]; const sm = (P.s + Q.s) / 2; if (sm >= st.s0 && sm <= st.s1) continue;
    const h = hAt(sm); if (h < 0.02) continue;
    const rot = rotOf(P), cx = (P.x + Q.x) / 2, cz = (P.z + Q.z) / 2;
    const yg = Math.min(P.y, Q.y) - 0.1;
    deck.box(cx, yg, cz, STAIR_RUN + 0.03, h + 0.1, W, rot, k % 2 ? conc : conc2, k % 2 ? conc2 : conc, 2.5);
  }
  for (const sg of [-1, 1]) {
    for (let k = 0; k < line.length - 1; k++) {
      const P = line[k], Q = line[k + 1]; const sm = (P.s + Q.s) / 2; if (sm >= st.s0 && sm <= st.s1) continue;
      const hp = hAt(P.s), hq = hAt(Q.s); if (hp < 0.02 && hq < 0.02) continue;
      const o = (W / 2 - 0.05) * sg;
      const a = [P.x + P.nx * o, P.y + hp, P.z + P.nz * o], b = [Q.x + Q.nx * o, Q.y + hq, Q.z + Q.nz * o];
      const a2 = [a[0], a[1] + 1.0, a[2]], b2 = [b[0], b[1] + 1.0, b[2]];
      deck.quadV(a, b, b2, a2, steel); deck.quadV(a, a2, b2, b, steel); // both faces
      if (k % 5 === 0) deck.box(a[0], a[1], a[2], 0.1, 1.05, 0.1, rotOf(P), steel);
    }
  }
  // ---- the landings and the deck over the road ----
  const mid = (s) => { let best = line[0]; for (const L of line) if (Math.abs(L.s - s) < Math.abs(best.s - s)) best = L; return best; };
  for (const [sa, sb] of [[st.s0 - 0.2, st.s0 + 1.4], [st.s1 - 1.4, st.s1 + 0.2]]) { // solid landing blocks under each end of the deck
    const P = mid((sa + sb) / 2); deck.box(P.x, P.y - 0.1, P.z, sb - sa, H - 0.3, W, rotOf(P), conc, conc, 2.5);
  }
  const deepBeam = st.wb > 20 ? 0.95 : 0.55; let s = st.s0;
  while (s < st.s1 - 0.01) {
    const e = Math.min(st.s1, s + 6); const P = mid((s + e) / 2), len = e - s, yTop = P.y + H;
    solid(deck, P.x, yTop - deepBeam, P.z, len + 0.06, deepBeam, W, rotOf(P), conc, conc, 2.5);
    for (const sg of [-1, 1]) { const o = (W / 2 - 0.06) * sg; deck.box(P.x + P.nx * o, yTop, P.z + P.nz * o, len + 0.06, 1.05, 0.12, rotOf(P), steel); }
    // the roof: a thin slab on slim posts, with a warm light strip under it
    solid(deck, P.x, yTop + 2.75, P.z, len + 0.06, 0.14, W + 0.8, rotOf(P), roofC);
    for (const sg of [-1, 1]) { const o = (W / 2 + 0.05) * sg; deck.box(P.x + P.nx * o - P.tx * len / 2, yTop + 1.05, P.z + P.nz * o - P.tz * len / 2, 0.12, 1.75, 0.12, rotOf(P), steel); }
    neon.box(P.x, yTop + 2.66, P.z, len * 0.82, 0.05, 0.3, rotOf(P), warm);
    glow.push(P.x, yTop + 2.3, P.z, 1, 0.92, 0.75, 6.5);
    // LED fascia along the deck edges, like the flyovers
    for (const sg of [-1, 1]) neon.box(P.x + P.nx * (W / 2 + 0.02) * sg, yTop - deepBeam + 0.2, P.z + P.nz * (W / 2 + 0.02) * sg, len * 0.96, 0.08, 0.05, rotOf(P), led);
    s = e;
  }
  // roof end caps over the landings so the cover reaches the first steps
  for (const [sa, sb] of [[st.s0 - 3.2, st.s0], [st.s1, st.s1 + 3.2]]) {
    const P = mid((sa + sb) / 2); const y = P.y + hAtSafe(world, st, (sa + sb) / 2);
    solid(deck, P.x, y + 2.75, P.z, sb - sa, 0.14, W + 0.8, rotOf(P), roofC);
  }
  // sign: a lit blue board on the deck's side, facing along the road below
  const Pm = mid((st.s0 + st.s1) / 2); const yT = Pm.y + H;
  for (const sg of [-1, 1]) neon.box(Pm.x + Pm.nx * (W / 2 + 0.1) * sg, yT + 1.35, Pm.z + Pm.nz * (W / 2 + 0.1) * sg, 3.4, 0.55, 0.06, rotOf(Pm), HOT(0.25, 0.55, 1, 1.5));
}
const hAtSafe = (world, st, s) => { const h = world.walkways.heightAt(st, s); return h; };

function sub(world, st, B) {
  const { deck, neon, glow, C, HOT } = B; const L = WK.SUB_LEN, Wd = WK.SUB_W, Hh = 3.1;
  const wall = C(0xc2b9a8), trim = C(0x6a6e7c), dark = C(0x040408), blue = HOT(0.2, 0.55, 1, 1.7), white = HOT(1, 1, 1, 1.9);
  const line = structLine(st, 1.0); const at = (s) => { let best = line[0]; for (const P of line) if (Math.abs(P.s - s) < Math.abs(best.s - s)) best = P; return best; };
  for (const end of [0, 1]) {
    const sC = end === 0 ? st.a + L / 2 : st.b - L / 2, P = at(sC), rot = rotOf(P), out = end === 0 ? -1 : 1; // out = away from the road crossing
    deck.box(P.x, P.y - 0.05, P.z, L, Hh, Wd, rot, wall, trim, 3);
    deck.box(P.x, P.y + Hh, P.z, L + 0.7, 0.2, Wd + 0.7, rot, trim);
    // the doorway (on the end that faces the pavement walkers come along) and the lit sign over it
    const dx = P.tx * out, dz = P.tz * out, fx = P.x + dx * (L / 2 + 0.03), fz = P.z + dz * (L / 2 + 0.03);
    deck.panel(fx, P.y + 1.15, fz, dx, dz, 1.35, 2.2, dark);
    neon.panel(fx + dx * 0.01, P.y + 2.65, fz + dz * 0.01, dx, dz, 1.9, 0.42, blue);
    // a white down-arrow on the sign
    const ax = fx + dx * 0.04, az = fz + dz * 0.04, nx = P.nx, nz = P.nz;
    neon.quadV([ax - nx * 0.04, P.y + 2.55, az - nz * 0.04], [ax + nx * 0.04, P.y + 2.55, az + nz * 0.04], [ax + nx * 0.04, P.y + 2.72, az + nz * 0.04], [ax - nx * 0.04, P.y + 2.72, az - nz * 0.04], white);
    neon.quadV([ax - nx * 0.11, P.y + 2.55, az - nz * 0.11], [ax + nx * 0.11, P.y + 2.55, az + nz * 0.11], [ax, P.y + 2.46, az], [ax, P.y + 2.46, az], white);
    // side windows that glow, so the entrance can be seen from the road
    for (const sg of [-1, 1]) neon.panel(P.x + P.nx * (Wd / 2 + 0.03) * sg, P.y + 1.7, P.z + P.nz * (Wd / 2 + 0.03) * sg, P.nx * sg, P.nz * sg, 1.8, 0.7, HOT(0.5, 0.75, 1, 1.0));
    glow.push(fx + dx * 0.5, P.y + 2.0, fz + dz * 0.5, 0.5, 0.75, 1, 7);
  }
}
