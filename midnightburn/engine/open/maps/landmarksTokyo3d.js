// Midnight Burn: Tokyo Drift — the landmark models: Tokyo Tower, Skytree, the Rainbow and Bay bridges, Shibuya Crossing, Sensō-ji, the Shinjuku towers,
// Tokyo Station, a Meiji Shrine torii, Daikoku Parking Area, the Odaiba Ferris wheel, Big Sight, Landmark Tower, Keihin refinery lights, Umihotaru and
// the Great Buddha. Everything is made from the same boxes / rods / glow points as the Mumbai landmarks (landmarks3d.js hands over its helpers).
import * as THREE from "three";
import { mulberry, isWater } from "../geo";
import { buildJapanSites } from "./landmarksJapan3d";

const pyr = new THREE.ConeGeometry(1, 1, 4); pyr.rotateY(Math.PI / 4); pyr.translate(0, 0.5, 0);      // a square-based pyramid, base on the ground, 1 wide, 1 tall
const ipyr = new THREE.ConeGeometry(1, 1, 4); ipyr.rotateY(Math.PI / 4); ipyr.rotateX(Math.PI); ipyr.translate(0, 0.5, 0); // upside down: point at the bottom
const dome = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);

export function buildTokyoLandmarks(H) {
  const { world, g, glow, lines, group, C, ico, cyl, rod, gh, spot, fit, roadHit, roadDir, get, cableBridge, mats } = H;
  const city = world.city;
  const red = C(0xd8381f), white = C(0xf2eee6), steel = C(0xb9c0cc), dark = C(0x2a2c34), wood = C(0x5a3a2a), gold = C(0xd8b04a);
  const sign = (text, w, h, x, y, z, rotY, bg = "#0a0614", fg = "#ffe9a8", font = "bold 84px 'Noto Sans JP', Arial Black, Impact, sans-serif") => {
    const cv = document.createElement("canvas"); cv.width = 1024; cv.height = Math.round(1024 * h / w); const c2 = cv.getContext("2d"); c2.fillStyle = bg; c2.fillRect(0, 0, cv.width, cv.height);
    c2.shadowColor = fg; c2.shadowBlur = 18; c2.fillStyle = fg; c2.font = font; c2.textAlign = "center"; c2.textBaseline = "middle"; c2.fillText(text, 512, cv.height / 2 + 4);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, toneMapped: false, side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = rotY; group.add(m); return m;
  };
  const at = (cx, cz, rot) => (lx, lz) => [cx + lx * Math.cos(rot) - lz * Math.sin(rot), cz + lx * Math.sin(rot) + lz * Math.cos(rot)];

  // ---- Tokyo Tower: a red-and-white lattice, two decks, an antenna -------------------------------------------------------------------------------
  { const l = get("tokyotower"); if (l) { const F = fit(l.x, l.z, 0, 66, 66, 240); if (F) {
    const [x, z, k] = F, y = gh(x, z), Hh = 290 * Math.max(0.8, k), B = 29 * k; // half-width of the legs at the base
    const level = (f) => { const w = B * Math.pow(1 - f, 1.35) + 1.6; return [w, y + Hh * f]; };
    const N = 14;
    for (let i = 0; i < N; i++) { const [w0, y0] = level(i / N * 0.62), [w1, y1] = level((i + 1) / N * 0.62), col = i % 2 ? white : red;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) rod(g, [x + sx * w0, y0, z + sz * w0], [x + sx * w1, y1, z + sz * w1], 1.5, col);
      for (const [a, b] of [[1, 0], [0, 1]]) for (const s2 of [-1, 1]) { rod(g, [x - w0 * (a ? 1 : s2), y0, z - w0 * (b ? 1 : s2)], [x + w1 * (a ? 1 : s2), y1, z + w1 * (b ? 1 : s2)], 0.7, col); rod(g, [x + w0 * (a ? 1 : s2), y0, z + w0 * (b ? 1 : s2)], [x - w1 * (a ? 1 : s2), y1, z - w1 * (b ? 1 : s2)], 0.7, col); }
      for (const [px, pz, ang] of [[0, -1, 0], [0, 1, 0], [-1, 0, Math.PI / 2], [1, 0, Math.PI / 2]]) g.box(x + px * w0, y0, z + pz * w0, ang ? 0.8 : w0 * 2, 0.9, ang ? w0 * 2 : 0.8, 0, col);
      if (i % 2 === 0) glow.push(x, y0 + 1, z, 1, 0.55, 0.15, 6);
    }
    const [wA, yA] = level(0.36); g.box(x, yA - 3, z, wA * 2 + 8, 6, wA * 2 + 8, 0, red); g.box(x, yA + 3, z, wA * 2 + 4, 3, wA * 2 + 4, 0, white); glow.push(x, yA + 3, z, 1, 0.5, 0.15, 30);
    const [wB, yB] = level(0.62); g.box(x, yB, z, wB * 2 + 3, 4, wB * 2 + 3, 0, red); g.box(x, yB + 4, z, wB * 2 + 1, 2, wB * 2 + 1, 0, white);
    for (let i = 0; i < 6; i++) rod(g, [x, yB + 6 + i * 11, z], [x, yB + 17 + i * 11, z], 1.4 - i * 0.12, i % 2 ? white : red);
    glow.push(x, yB + 74, z, 1, 0.1, 0.1, 22); glow.push(x, yB + 6, z, 1, 0.6, 0.2, 26); for (let i = 1; i < 8; i++) glow.push(x, y + Hh * (0.1 + i * 0.07), z, 1, 0.6, 0.2, 10);
  } } }

  // ---- Tokyo Skytree: a slim silver-white tripod becoming a round tower, two observation decks, a long mast, blue-white light -------------------------
  { const l = get("skytree"); if (l) { const F = fit(l.x, l.z, 0, 44, 44, 240); if (F) {
    const [x, z] = F, y = gh(x, z), Hh = 270, Bw = 17;
    const tw = C(0xdfe5ee), tb = C(0xb7c4d4);
    for (let i = 0; i < 3; i++) { const a = i * 2.094 + 0.5; rod(g, [x + Math.cos(a) * Bw, y, z + Math.sin(a) * Bw], [x + Math.cos(a) * 4, y + 55, z + Math.sin(a) * 4], 2.2, tb); }
    g.geo(cyl, x, y + 50, z, 5.5, 140, 5.5, 0, tw);
    g.geo(cyl, x, y + 150, z, 5, 70, 5, 0, tw);
    for (const [hy, rr, hh2] of [[Hh * 0.52, 15, 9], [Hh * 0.7, 10, 6]]) { g.geo(cyl, x, y + hy, z, rr, hh2, rr, 0, C(0xc8d0dc)); g.geo(cyl, x, y + hy + hh2, z, rr * 0.8, 2, rr * 0.8, 0, dark); glow.push(x, y + hy + hh2 * 0.5, z, 0.4, 0.8, 1, 30); }
    g.geo(cyl, x, y + Hh * 0.7 + 8, z, 3.4, Hh * 0.3, 3.4, 0, tw); rod(g, [x, y + Hh, z], [x, y + Hh + 95, z], 1.6, white);
    for (let i = 0; i < 16; i++) glow.push(x, y + 30 + i * 18, z, 0.35, 0.78 + (i % 2) * 0.2, 1, 9);
    glow.push(x, y + Hh + 100, z, 1, 0.12, 0.12, 22);
  } } }

  // ---- Rainbow Bridge and Yokohama Bay Bridge: lit suspension towers ---------------------------------------------------------------------------------
  for (const [rid, id, h, col, tw] of [["rainbow", "rainbow", 70, C(0xe9eef4), 20], ["baybridge", "baybridge", 62, C(0xd9e0ea), 22]]) {
    const l = get(id); const r = city.roads.find((q) => q.id === rid); if (!l || !r) continue;
    let bk = 0, bd = 1e9; r.pts.forEach((p, k) => { const d = Math.hypot(p.x - l.x, p.z - l.z); if (d < bd) { bd = d; bk = k; } });
    cableBridge(rid, [Math.max(6, bk - tw), Math.min(r.pts.length - 8, bk + tw)], h, col, 140);
    // the Rainbow Bridge is lit white; a ribbon of colour along the deck
    for (let n = -30; n <= 30; n += 3) { const d = r.pts[Math.max(0, Math.min(r.pts.length - 1, bk + n))]; const hue = [[1, 0.2, 0.3], [1, 0.7, 0.2], [0.3, 1, 0.5], [0.3, 0.7, 1], [0.7, 0.4, 1]][(n / 3 + 10) % 5 | 0]; glow.push(d.x, d.y + 1.4, d.z, hue[0], hue[1], hue[2], 6); }
  }

  // ---- Shibuya Crossing: white scramble stripes, four video walls, tall neon boards -------------------------------------------------------------------
  { const l = get("shibuyax"); if (l) {
    const x = l.rx ?? l.x, z = l.rz ?? l.z, y = l.ry ?? gh(x, z), rot = roadDir(x, z), c = Math.cos(rot), s = Math.sin(rot);
    const P = (a, b) => [x + a * c - b * s, z + a * s + b * c];
    for (const sd of [-1, 1]) for (let k = -5; k <= 5; k++) { const p = P(k * 1.7, sd * 22); g.box(p[0], y + 0.14, p[1], 1.0, 0.05, 9, rot, white); const q = P(sd * 22, k * 1.7); g.box(q[0], y + 0.14, q[1], 9, 0.05, 1.0, rot, white); }
    const boards = [["TOKYO", "#ff3b7a", 28, 20], ["SHIBUYA", "#3bd7ff", -28, 22], ["109", "#ffd23a", 30, -28], ["NEON", "#8cff5a", -30, -26]];
    boards.forEach(([t, col, a, b], i) => { const sp = spot(P(a, b)[0], P(a, b)[1], rot, 14, 4, 90); const gy = gh(sp[0], sp[1]); g.box(sp[0], gy, sp[1], 14, 28 + (i % 2) * 8, 4, rot, dark); const rr = rot + (i % 2 ? Math.PI / 2 : 0); sign(t, 13, 8, sp[0] + Math.cos(rr + 1.57) * 2.2, gy + 22, sp[1] + Math.sin(rr + 1.57) * 2.2, -rr, "#08060e", col); glow.push(sp[0], gy + 20, sp[1], ...(i % 2 ? [0.3, 0.8, 1] : [1, 0.3, 0.6]), 34); });
  } }

  // ---- Sensō-ji: the red Kaminarimon gate with its giant lantern, a five-storey pagoda, a hipped-roof hall ----------------------------------------------
  { const l = get("sensoji"); if (l) { const F = fit(l.x + 30, l.z - 20, roadDir(l.rx ?? l.x, l.rz ?? l.z) + Math.PI / 2, 60, 40, 220); if (F) {
    const [x, z, k] = F, y = gh(x, z), rot = roadDir(l.rx ?? l.x, l.rz ?? l.z) + Math.PI / 2, A = at(x, z, rot), roof = C(0x3c3a40), wall = C(0xc4331f);
    for (const sx of [-1, 1]) { const p = A(sx * 9 * k, 0); g.box(p[0], y, p[1], 3.6, 11, 3.6, rot, wall); }
    { const p = A(0, 0); g.box(p[0], y + 8, p[1], 24 * k, 4, 6, rot, wall); g.geo(pyr, p[0], y + 12, p[1], 30 * k, 7, 14, rot, roof); }
    { const p = A(0, 0); g.geo(cyl, p[0], y + 3.5, p[1], 1.9, 4.5, 1.9, 0, red); glow.push(p[0], y + 5.5, p[1], 1, 0.45, 0.25, 12); }
    { const p = A(26 * k, 8 * k); for (let i = 0; i < 5; i++) { g.box(p[0], y + i * 5.4, p[1], 11 - i * 1.5, 4.2, 11 - i * 1.5, rot, i % 2 ? wall : C(0xe8d9c0)); g.geo(pyr, p[0], y + i * 5.4 + 4.2, p[1], 15 - i * 1.7, 2.2, 15 - i * 1.7, rot, roof); } g.geo(cyl, p[0], y + 29, p[1], 0.3, 7, 0.3, 0, gold); glow.push(p[0], y + 27, p[1], 1, 0.7, 0.3, 20); }
    { const p = A(-26 * k, 10 * k); g.box(p[0], y, p[1], 24, 8, 16, rot, wall); g.geo(pyr, p[0], y + 8, p[1], 32, 9, 22, rot, roof); glow.push(p[0], y + 9, p[1], 1, 0.6, 0.25, 22); }
    for (let i = -3; i <= 3; i++) { const p = A(i * 6, -9); glow.push(p[0], y + 3, p[1], 1, 0.35, 0.2, 7); g.box(p[0], y, p[1], 0.5, 2.4, 0.5, 0, wood); }
  } } }

  // ---- Shinjuku: the twin-towered Metropolitan Government building and its neighbours --------------------------------------------------------------------
  { const l = get("tmg"); if (l) { const F = fit(l.x, l.z, 0, 70, 50, 260); if (F) {
    const [x, z] = F, y = gh(x, z), rot = roadDir(l.rx ?? l.x, l.rz ?? l.z), A = at(x, z, rot), body = C(0x8b8f99), win = C(0x2a3040);
    g.box(x, y, z, 62, 50, 36, rot, body, win);
    for (const sx of [-1, 1]) { const p = A(sx * 16, 0); g.box(p[0], y + 50, p[1], 20, 80, 22, rot, body, win); g.box(p[0], y + 130, p[1], 16, 40, 18, rot, body, win); g.box(p[0], y + 170, p[1], 12, 20, 14, rot, body, win); glow.push(p[0], y + 192, p[1], 1, 0.12, 0.1, 22); for (let f = 0; f < 8; f++) glow.push(p[0], y + 60 + f * 16, p[1], 1, 0.82, 0.55, 14); }
    glow.push(x, y + 28, z, 1, 0.8, 0.5, 36);
    // a few glass neighbours
    for (const [dx, dz, hh] of [[-70, 30, 110], [75, -25, 95], [10, 70, 130]]) { const p = A(dx, dz); const sp = spot(p[0], p[1], rot, 28, 28, 60); const gy = gh(sp[0], sp[1]); g.box(sp[0], gy, sp[1], 26, hh, 26, rot, C(0x7f98ad), C(0x39475a)); glow.push(sp[0], gy + hh + 2, sp[1], 1, 0.12, 0.1, 18); for (let f = 0; f < 6; f++) glow.push(sp[0], gy + 10 + f * hh / 6.5, sp[1], 0.9, 0.9, 1, 14); }
  } } }

  // ---- Tokyo Station: the long red-brick Marunouchi building with two domes ------------------------------------------------------------------------
  { const l = get("tokyostation"); if (l) { const rot = roadDir(l.rx ?? l.x, l.rz ?? l.z) + Math.PI / 2; const F = fit(l.x + 40, l.z - 30, rot, 140, 36, 300); if (F) {
    const [x, z, k] = F, y = gh(x, z), A = at(x, z, rot), brick = C(0xa1442f), roof = C(0x3c4048), stone = C(0xd9cdb4);
    g.box(x, y, z, 130 * k, 18, 30 * k, rot, brick, roof);
    for (const sx of [-1, 1]) { const p = A(sx * 58 * k, 0); g.box(p[0], y, p[1], 16 * k, 24, 30 * k, rot, brick, roof); g.geo(dome, p[0], y + 24, p[1], 9 * k, 9, 9 * k, 0, C(0x4e6a5c)); }
    { const p = A(0, 0); g.box(p[0], y + 18, p[1], 30 * k, 5, 30 * k, rot, stone); }
    for (let i = -6; i <= 6; i++) { const p = A(i * 9 * k, -15.4 * k); glow.push(p[0], y + 6, p[1], 1, 0.82, 0.5, 8); }
    glow.push(x, y + 34, z, 1, 0.7, 0.3, 30);
  } } }

  // ---- Meiji Shrine: a big wooden torii -------------------------------------------------------------------------------------------------------------------
  { const l = get("meijishrine"); if (l) { const rot = roadDir(l.rx ?? l.x, l.rz ?? l.z); const F = fit(l.x, l.z, rot, 24, 5, 200); if (F) {
    const [x, z] = F, y = gh(x, z), A = at(x, z, rot), lac = C(0x3d2a22);
    for (const sx of [-1, 1]) { const p = A(0, sx * 9); g.geo(cyl, p[0], y, p[1], 1.4, 17, 1.4, 0, lac); }
    { const p = A(0, 0); g.box(p[0], y + 12.5, p[1], 3, 1.8, 26, rot, dark); g.box(p[0], y + 15.4, p[1], 3.6, 1.2, 30, rot, dark); g.box(p[0], y + 10.4, p[1], 2.4, 1.0, 20, rot, lac); }
    glow.push(x, y + 14, z, 1, 0.65, 0.35, 16);
  } } }

  // ---- Daikoku Parking Area: a ring ramp and rows of tuned cars with underglow ------------------------------------------------------------------------------
  { const l = get("daikokupa"); if (l) {
    const rnd = mulberry(77); const cols = [0xff2d95, 0x2de2ff, 0xffd23a, 0x6bff6b, 0xb45cff, 0xff5a1f, 0xf2f2f2, 0x1d5ca8], neon = [[1, 0.2, 0.6], [0.2, 0.9, 1], [1, 0.85, 0.2], [0.4, 1, 0.4], [0.7, 0.4, 1], [1, 0.4, 0.15], [0.9, 0.9, 1], [0.3, 0.6, 1]];
    let placed = 0;
    for (let k = 0; k < 600 && placed < 46; k++) {
      const x = l.x + (rnd() - 0.5) * 360, z = l.z + (rnd() - 0.5) * 300; if (isWater(x, z)) continue; const rot = rnd() < 0.5 ? 0 : Math.PI / 2 + 0.2; if (roadHit(x, z, rot, 5.2, 2.6, gh(x, z), 3)) continue;
      const y0 = gh(x, z), ci = Math.floor(rnd() * cols.length), body = C(cols[ci], 0.85); g.box(x, y0 + 0.3, z, 4.6, 0.7, 1.9, rot, body); g.box(x - 0.2 * Math.cos(rot), y0 + 0.95, z - 0.2 * Math.sin(rot), 2.4, 0.6, 1.6, rot, C(0x14161c));
      glow.push(x, y0 + 0.25, z, ...neon[ci], 5); placed++;
    }
    const sp = spot(l.x - 60, l.z, 0, 60, 60, 160, false); const y0 = gh(sp[0], sp[1]);
    for (let f = 0; f < 3; f++) g.box(sp[0], y0 + f * 4.2, sp[1], 50 - f * 4, 3.4, 30 - f * 3, 0, C(0x8d949e), C(0x555b66));
    for (let i = -4; i <= 4; i++) glow.push(sp[0] + i * 5.4, y0 + 13, sp[1] - 15, 1, 0.6, 0.25, 10);
    sign("DAIKOKU PA", 22, 5, sp[0], y0 + 17, sp[1] - 16, 0, "#0a0614", "#ff6ad5");
  } }

  // ---- Odaiba: a Ferris wheel ringed with colour ----------------------------------------------------------------------------------------------------------------
  { const l = get("odaiba"); if (l) { const sp = spot(l.x, l.z, 0, 24, 24, 200, true); if (sp) {
    const [x, z] = sp, y = gh(x, z), R = 48, cy = y + R + 8, rot = roadDir(l.rx ?? l.x, l.rz ?? l.z);
    const A = at(x, z, rot); const N = 28; const pt = (i, rr = R) => { const a = (i / N) * 6.283; const q = A(Math.cos(a) * rr, 0); return [q[0], cy + Math.sin(a) * rr, q[1]]; };
    for (let i = 0; i < N; i++) { rod(g, pt(i), pt(i + 1), 0.9, steel); rod(g, pt(i, 2), pt(i, R), 0.35, C(0xdfe5ee)); const p = pt(i, R + 1.6); const hue = [[1, 0.2, 0.3], [1, 0.8, 0.2], [0.3, 1, 0.5], [0.3, 0.8, 1], [0.8, 0.4, 1]][i % 5]; glow.push(p[0], p[1], p[2], hue[0], hue[1], hue[2], 11); g.box(p[0], p[1] - 1.5, p[2], 2.6, 2.4, 2.6, 0, C(0xf0f0f8)); }
    for (const sx of [-1, 1]) { const b = A(0, sx * 12); rod(g, [b[0], y, b[1]], [x, cy, z], 1.6, steel); }
    glow.push(x, cy, z, 0.7, 0.9, 1, 30);
  } } }

  // ---- Tokyo Big Sight: four inverted pyramids ---------------------------------------------------------------------------------------------------------------
  { const l = get("bigsight"); if (l) { const sp = spot(l.x, l.z, 0, 110, 40, 220, true); if (sp) {
    const [x, z] = sp, y = gh(x, z), rot = roadDir(l.rx ?? l.x, l.rz ?? l.z), A = at(x, z, rot);
    g.box(x, y, z, 150, 8, 36, rot, C(0xc6ccd6));
    for (let i = 0; i < 4; i++) { const p = A(-54 + i * 36, 0); g.geo(ipyr, p[0], y + 8, p[1], 30, 0, 30, rot, C(0xaeb7c4)); g.geo(ipyr, p[0], y + 8, p[1], 30, 32, 30, rot, C(0xaeb7c4)); glow.push(p[0], y + 14, p[1], 0.7, 0.9, 1, 20); }
    sign("TOKYO BIG SIGHT", 30, 4.5, x, y + 12, z - 19, rot, "#0a1018", "#8fe8ff");
  } } }

  // ---- Yokohama Landmark Tower ---------------------------------------------------------------------------------------------------------------------------------
  { const l = get("landmarktower"); if (l) { const F = fit(l.x, l.z, 0, 40, 40, 220); if (F) {
    const [x, z] = F, y = gh(x, z), Hh = 230, body = C(0x9fb6c9);
    g.box(x, y, z, 38, Hh * 0.55, 38, 0, body, C(0x3a4658)); g.box(x, y + Hh * 0.55, z, 30, Hh * 0.25, 30, 0, body, C(0x3a4658)); g.box(x, y + Hh * 0.8, z, 22, Hh * 0.14, 22, 0, body, C(0x3a4658)); g.geo(pyr, x, y + Hh * 0.94, z, 18, 20, 18, 0, steel); rod(g, [x, y + Hh * 0.94 + 18, z], [x, y + Hh + 40, z], 1.0, white);
    for (let f = 0; f < 12; f++) glow.push(x, y + 12 + f * (Hh * 0.8 / 12), z, 1, 0.85, 0.6, 20); glow.push(x, y + Hh + 40, z, 1, 0.1, 0.1, 18);
  } } }

  // ---- Keihin industrial night lights: tanks, flare stacks with flames, a pipe rack ----------------------------------------------------------------------------
  { const l = get("keihin"); if (l) {
    const rnd = mulberry(131); let tanks = 0, stacks = 0;
    for (let k = 0; k < 500 && (tanks < 14 || stacks < 6); k++) {
      const x = l.x + (rnd() - 0.5) * 520, z = l.z + (rnd() - 0.5) * 460; if (isWater(x, z) || city.nearestRoad(x, z, 24)) continue; const y0 = gh(x, z);
      if (tanks < 14 && rnd() < 0.7) { const rr = 9 + rnd() * 7, hh = 9 + rnd() * 7; g.geo(cyl, x, y0, z, rr, hh, rr, 0, C(0xc3c8cf)); g.geo(cyl, x, y0 + hh, z, rr * 1.03, 0.9, rr * 1.03, 0, C(0x7a808a)); glow.push(x, y0 + hh + 1.5, z, 1, 0.8, 0.55, 8); tanks++; }
      else if (stacks < 6) { const hh = 60 + rnd() * 40; g.geo(cyl, x, y0, z, 1.4, hh, 1.4, 0, C(0x9a9ea6)); for (let n = 0; n < 4; n++) glow.push(x, y0 + hh * (0.25 + n * 0.22), z, 1, 0.15, 0.1, 7); glow.push(x, y0 + hh + 4, z, 1, 0.55, 0.12, 34); glow.push(x, y0 + hh + 6, z, 1, 0.8, 0.3, 18); stacks++; }
    }
  } }

  // ---- Umihotaru: the ship-shaped parking area in the middle of the bay -------------------------------------------------------------------------------------------
  { const l = get("umihotaru"); if (l) { const y = gh(l.x, l.z) + 0.2, rot = roadDir(l.rx ?? l.x, l.rz ?? l.z), A = at(l.x, l.z, rot);
    g.box(l.x, y, l.z, 120, 9, 26, rot, C(0xe9edf2), C(0x7d8896)); for (const [dx, hh, w] of [[-20, 16, 40], [18, 11, 30], [38, 7, 22]]) { const p = A(dx, 0); g.box(p[0], y + 9, p[1], w, hh, 20, rot, C(0xf4f6fa), C(0x58606c)); } { const p = A(-40, 0); g.geo(cyl, p[0], y + 14, p[1], 3.5, 22, 3.5, 0, red); }
    for (let i = -5; i <= 5; i++) { const p = A(i * 11, -13.5); glow.push(p[0], y + 5, p[1], 0.7, 0.9, 1, 8); } glow.push(l.x, y + 30, l.z, 0.6, 0.8, 1, 24);
  } }

  // ---- Kamakura Great Buddha ---------------------------------------------------------------------------------------------------------------------------------------------
  { const l = get("daibutsu"); if (l) { const sp = spot(l.x, l.z, 0, 16, 16, 140, true); if (sp) {
    const [x, z] = sp, y = gh(x, z), bronze = C(0x4f6a58);
    g.box(x, y, z, 14, 1.6, 14, 0, C(0x7a7468)); g.geo(ico, x, y + 6.2, z, 5.6, 4.6, 4.2, 0, bronze); g.geo(ico, x, y + 11.4, z, 2.4, 2.8, 2.4, 0, bronze); g.geo(ico, x, y + 3.2, z, 7.4, 2.2, 5.2, 0, bronze);
    glow.push(x, y + 8, z + 6, 1, 0.85, 0.55, 16);
  } } }
  buildJapanSites({ ...H, g: H.tiles }); // Upgrade 34: temples, the torii tunnel and the cherry-blossom parks
  void lines; void mats;
}
