// Midnight Burn — festival seasons. Ganesh Chaturthi (pandals with idols, crowds, lights), Navratri (garba grounds with a tent of lights)
// and Diwali (rangoli, lanterns, light curtains, fireworks). Which one is on depends on the real calendar date, or the player can force one.
// Sites are reserved when the city is built (so no building stands there) and the decorations are only created when the car is near.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// ---- calendar (festival windows are lunar, so dates after the table are estimates) --------------------------------------------------------------
// [month 1-12, day] start .. end, inclusive
const CAL = {
  ganapati: { 2026: [[9, 14], [9, 25]], 2027: [[9, 4], [9, 14]], 2028: [[8, 23], [9, 3]], 2029: [[9, 11], [9, 22]], 2030: [[9, 1], [9, 11]] },
  navratri: { 2026: [[10, 11], [10, 20]], 2027: [[9, 30], [10, 9]], 2028: [[9, 19], [9, 28]], 2029: [[10, 8], [10, 17]], 2030: [[9, 28], [10, 7]] },
  diwali: { 2026: [[11, 1], [11, 12]], 2027: [[10, 21], [11, 1]], 2028: [[10, 10], [10, 21]], 2029: [[10, 30], [11, 10]], 2030: [[10, 19], [10, 30]] },
};
const FALLBACK = { ganapati: [[9, 5], [9, 16]], navratri: [[10, 3], [10, 12]], diwali: [[10, 24], [11, 4]] };
export const FEST_NAMES = { ganapati: "Ganesh Chaturthi", navratri: "Navratri", diwali: "Diwali", off: "No festival" };
export function festivalOn(date = new Date()) {
  const y = date.getFullYear(), v = (date.getMonth() + 1) * 100 + date.getDate();
  for (const k of ["ganapati", "navratri", "diwali"]) {
    const w = (CAL[k] && CAL[k][y]) || FALLBACK[k]; if (v >= w[0][0] * 100 + w[0][1] && v <= w[1][0] * 100 + w[1][1]) return k;
  }
  return "off";
}
export function nextFestival(date = new Date()) {
  const y = date.getFullYear(), v = (date.getMonth() + 1) * 100 + date.getDate(); let best = null;
  for (const yy of [y, y + 1]) for (const k of ["ganapati", "navratri", "diwali"]) {
    const w = (CAL[k] && CAL[k][yy]) || FALLBACK[k]; const s = new Date(yy, w[0][0] - 1, w[0][1]); if (yy === y && w[0][0] * 100 + w[0][1] <= v) continue; if (!best || s < best.date) best = { k, date: s };
  }
  return best;
}

// ---- where the sites are -----------------------------------------------------------------------------------------------------------------
export function planSites(env) {
  const { city, districts, rnd, shoreDist, baseH, roadClear, inAirport, W, reserve } = env; const sites = [];
  const GOOD = (d) => d.style !== "forest" && d.dens >= 0.3;
  for (const d of districts) {
    if (!GOOD(d)) continue; const want = Math.max(1, Math.min(5, Math.round(d.r / 520 * d.dens * 1.6)));
    for (let k = 0, tries = 0; k < want && tries < 60; tries++) {
      const a = rnd() * 6.283, rr = Math.sqrt(rnd()) * d.r * 0.8, x = d.x + Math.cos(a) * rr, z = d.z + Math.sin(a) * rr;
      if (x < 80 || z < 80 || x > W - 80 || z > W - 80) continue;
      const nr = city.nearestRoad(x, z, 120, (r) => !r.ramp && r.cls !== "hwy" && r.width < 16 && !r.pts[0].tun, null); if (!nr) continue;
      const p = nr.road.pts[nr.i], q = nr.road.pts[nr.i + 1]; if (!q || p.w > 0.25 || p.y - p.g > 1.2) continue;
      const tl = Math.hypot(q.x - p.x, q.z - p.z) || 1, tx = (q.x - p.x) / tl, tz = (q.z - p.z) / tl;
      const side = rnd() < 0.5 ? 1 : -1, off = nr.road.width / 2 + 22; const nx = -tz * side * -1, nz = tx * side * -1; // normal points from the site back towards the road
      const sx = nr.x - nx * off, sz = nr.z - nz * off; // site sits "behind" the pavement
      if (shoreDist(sx, sz) < 40 || inAirport(sx, sz, 80)) continue; const hb = baseH(sx, sz); if (hb > 50) continue;
      if (Math.abs(baseH(sx + 14, sz) - hb) > 2.6 || Math.abs(baseH(sx, sz + 14) - hb) > 2.6) continue;
      let ok = true; for (const o of sites) if (Math.hypot(o.x - sx, o.z - sz) < 260) { ok = false; break; } if (!ok) continue;
      let clear = true; for (const [ox, oz] of [[0, 0], [13, 0], [-13, 0], [0, -9], [13, -9], [-13, -9], [0, 14], [10, 14], [-10, 14]]) { const px = sx + nz * ox + nx * oz, pz = sz - nx * ox + nz * oz; if (!roadClear(px, pz, 4) || shoreDist(px, pz) < 20) { clear = false; break; } } if (!clear) continue;
      const s = { id: sites.length, x: sx, z: sz, y: city.groundH ? city.groundH(sx, sz) : hb, nx, nz, tx: nz, tz: -nx, rot: Math.atan2(nx, nz), name: d.name.split(" & ")[0].split(" ")[0] === "Sanjay" ? d.name : d.name.split(" & ")[0], rx: nr.x, rz: nr.z, built: false };
      sites.push(s); reserve(s); k++;
    }
  }
  return sites;
}

// ---- geometry kit: everything merged per material ------------------------------------------------------------------------------------------
const G0 = { box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 10), frus: new THREE.CylinderGeometry(0.55, 1, 1, 10), cone: new THREE.ConeGeometry(1, 1, 10), sph: new THREE.IcosahedronGeometry(1, 2), oct: new THREE.OctahedronGeometry(1, 0), tor: new THREE.TorusGeometry(1, 0.14, 6, 18), bulb: new THREE.IcosahedronGeometry(1, 0), disc: new THREE.CircleGeometry(1, 28) };
for (const k in G0) { const g = G0[k].index ? G0[k].toNonIndexed() : G0[k]; g.deleteAttribute("uv"); G0[k] = g; }
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _c = new THREE.Color();
function kit() {
  const L = {};
  const put = (key, geo, col, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => {
    const g = G0[geo].clone(); g.applyMatrix4(_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz))); _c.set(col); const n = g.attributes.position.count, c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { c[i * 3] = _c.r; c[i * 3 + 1] = _c.g; c[i * 3 + 2] = _c.b; } g.setAttribute("color", new THREE.BufferAttribute(c, 3)); (L[key] || (L[key] = [])).push(g);
  };
  const quad = (key, a, b, c, d, col) => { const g = new THREE.BufferGeometry(); const v = [...a, ...b, ...c, ...a, ...c, ...d]; g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); _c.set(col); const cc = new Float32Array(18); for (let i = 0; i < 6; i++) { cc[i * 3] = _c.r; cc[i * 3 + 1] = _c.g; cc[i * 3 + 2] = _c.b; } g.setAttribute("color", new THREE.BufferAttribute(cc, 3)); (L[key] || (L[key] = [])).push(g); };
  const strand = (key, a, b, sag, n, cols, r = 0.09) => { for (let i = 0; i <= n; i++) { const t = i / n; put(key, "bulb", cols[i % cols.length], a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t, r, r, r); } };
  return { put, quad, strand, L };
}
const MULTI = [0xff3b30, 0xffcc00, 0x34c759, 0x32ade6, 0xff2d92, 0xff9500];
const WARM = [0xffd27a, 0xffb347, 0xffe2a8];

function signTexture(line1, line2, bg, fg) {
  const c = document.createElement("canvas"); c.width = 768; c.height = 160; const g = c.getContext("2d");
  g.fillStyle = bg; g.fillRect(0, 0, 768, 160); g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, 752, 144); g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 2; g.strokeRect(18, 18, 732, 124);
  g.fillStyle = fg; g.textAlign = "center"; g.font = "bold 46px Georgia, serif"; let s = 46; while (g.measureText(line1).width > 700 && s > 22) { s -= 2; g.font = `bold ${s}px Georgia, serif`; } g.fillText(line1, 384, 74);
  g.font = "italic 34px Georgia, serif"; g.fillStyle = "#fff"; g.fillText(line2, 384, 124); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function rangoliTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d"); g.translate(256, 256); g.fillStyle = "#1a0d08"; g.beginPath(); g.arc(0, 0, 256, 0, 6.283); g.fill();
  const cols = ["#ff3d00", "#ffb300", "#ffffff", "#e91e63", "#7b1fa2", "#00acc1", "#76ff03"];
  for (let ring = 0; ring < 7; ring++) { const R = 240 - ring * 32, n = 8 + ring * 2; g.fillStyle = cols[(ring * 3) % cols.length]; for (let i = 0; i < n; i++) { g.save(); g.rotate(i / n * 6.283 + ring * 0.2); g.beginPath(); g.moveTo(0, -R + 26); g.quadraticCurveTo(14 + ring, -R + 6, 0, -R - 12); g.quadraticCurveTo(-14 - ring, -R + 6, 0, -R + 26); g.fill(); g.restore(); } g.strokeStyle = cols[(ring * 2 + 1) % cols.length]; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, R - 30, 0, 6.283); g.stroke(); }
  g.fillStyle = "#ffd54f"; g.beginPath(); g.arc(0, 0, 22, 0, 6.283); g.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function glowTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,.45)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---- the three site designs ----------------------------------------------------------------------------------------------------------
function buildGanapati(k, site, rnd) {
  const { put, quad, strand } = k;
  put("std", "box", 0x7a1d1d, 0, 0.5, -0.5, 13, 1, 10); put("std", "box", 0xb3202a, 0, 1.02, 0.5, 11.6, 0.06, 8.2); // stage and red carpet
  put("std", "box", 0x6b4a2a, 0, 0.05, 11, 8, 0.1, 6); // ramp carpet at the front
  // pillars, roof frame
  for (const sx of [-6.2, 6.2]) for (const sz of [-4.2, 4.2]) { put("gold", "cyl", 0xd9a521, sx, 3.6, sz, 0.28, 3.1, 0.28); put("gold", "cyl", 0xffd36a, sx, 1.4, sz, 0.42, 0.3, 0.42); put("gold", "cyl", 0xffd36a, sx, 6.4, sz, 0.4, 0.28, 0.4); }
  const y0 = 6.6, y1 = 9.2, X = 7.2, Z = 5.4, rx = 3.6;
  const stripes = 12; for (let i = 0; i < stripes; i++) { const a = -X + (2 * X * i) / stripes, b = -X + (2 * X * (i + 1)) / stripes, ra = -rx + (2 * rx * i) / stripes, rb = -rx + (2 * rx * (i + 1)) / stripes; const col = i % 2 ? 0xe5322d : 0xffb81c; const ca = Math.max(-rx, Math.min(rx, a)), cb = Math.max(-rx, Math.min(rx, b));
    quad("cloth", [a, y0, Z], [b, y0, Z], [cb, y1, 0], [ca, y1, 0], col); quad("cloth", [b, y0, -Z], [a, y0, -Z], [ca, y1, 0], [cb, y1, 0], col); void ra; void rb; }
  for (const sg of [-1, 1]) { quad("cloth", [sg * X, y0, Z], [sg * X, y0, -Z], [sg * rx, y1, 0], [sg * rx, y1, 0], 0xc01d28); } // hip ends
  put("gold", "cone", 0xffd36a, 0, y1 + 0.9, 0, 0.35, 1.8, 0.35); put("gold", "sph", 0xffd36a, 0, y1 + 0.1, 0, 0.5, 0.5, 0.5); // kalash
  for (let i = 0; i < 36; i++) { const x = -X + (2 * X * i) / 35; for (const z of [Z, -Z]) { put("gold", "cone", 0xffc547, x, y0 - 0.25, z, 0.13, 0.5, 0.13, Math.PI, 0, 0); put("glow", "bulb", MULTI[i % 6], x, y0 - 0.6, z, 0.11, 0.11, 0.11); } }
  for (let i = 0; i < 9; i++) { const z = -Z + (2 * Z * i) / 8; for (const sg of [-1, 1]) { put("gold", "cone", 0xffc547, sg * X, y0 - 0.25, z, 0.13, 0.5, 0.13, Math.PI, 0, 0); put("glow", "bulb", MULTI[(i + 2) % 6], sg * X, y0 - 0.6, z, 0.11, 0.11, 0.11); } }
  // backdrop and curtains
  quad("cloth", [-7, 1, -4.9], [7, 1, -4.9], [7, 7, -4.9], [-7, 7, -4.9], 0x6e0f1d); for (let i = 0; i < 7; i++) put("gold", "box", 0xd9a521, -6 + i * 2, 4, -4.85, 0.08, 6, 0.04);
  for (const sg of [-1, 1]) for (let i = 0; i < 7; i++) quad("cloth", [sg * (6.6 - i * 0.18), 6.6, 3.8 - i * 1.2], [sg * (6.6 - i * 0.18), 6.6, 3.2 - i * 1.2], [sg * (6.6 - i * 0.18), 1.1, 3.2 - i * 1.2], [sg * (6.6 - i * 0.18), 1.1, 3.8 - i * 1.2], i % 2 ? 0xffa21c : 0xd6252b);
  // prabhaval: halo of bulbs and a golden disc behind the idol
  put("gold", "disc", 0xffc94a, 0, 5.4, -4.7, 3.7, 3.7, 1); for (let i = 0; i < 32; i++) { const a = i / 32 * 6.283; put("glow", "bulb", WARM[i % 3], Math.cos(a) * 3.9, 5.4 + Math.sin(a) * 3.9, -4.6, 0.12, 0.12, 0.12); }
  // the idol (about 4 m tall), seated on a lotus
  const ivory = rnd() < 0.3, body = ivory ? 0xf2e6cf : 0xee5a1f, dark = ivory ? 0xd9c9aa : 0xc9400f; const iy = 1.1, iz = -1.2, S = 1.0;
  put("std", "cyl", 0xf27aa5, 0, iy + 0.25, iz, 2.4, 0.5, 2.4); for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283; put("std", "cone", i % 2 ? 0xffb6cf : 0xf27aa5, Math.cos(a) * 2.25, iy + 0.45, iz + Math.sin(a) * 2.25, 0.4, 0.8, 0.4, Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); }
  const P = (x, y, z, r, sx = 1, sy = 1, sz = 1, col = body, key = "std") => put(key, "sph", col, x, iy + y * S, iz + z * S, r * sx, r * sy, r * sz);
  P(0, 1.55, 0, 1.2, 1, 1.2, 0.95); P(0, 1.5, 0.55, 0.95, 1.05, 0.95, 0.8, dark); P(0, 0.75, 0.55, 0.75, 2.2, 0.5, 1.2, body); // body, belly, crossed legs
  P(0, 3.45, 0.2, 0.82); P(-0.95, 3.45, 0.15, 0.12, 1, 2.8, 2.2, dark); P(0.95, 3.45, 0.15, 0.12, 1, 2.8, 2.2, dark); // head, ears
  [[0, 3.3, 0.95], [0, 2.95, 1.12], [-0.05, 2.6, 1.18], [-0.22, 2.35, 1.1], [-0.42, 2.28, 0.92]].forEach(([x, y, z], i) => P(x, y, z, 0.3 - i * 0.03)); // trunk
  put("std", "cone", 0xfff8e8, iy + 0.28 * 0 + 0.0 + 0.35, iy + 2.7, iz + 1.1, 0.07, 0.5, 0.07, 3.0, 0, 0.1); P(0.32, 3.2, 0.9, 0.05, 1, 3, 1, 0xfff8e8); P(0.18, 3.55, 0.95, 0.06, 1, 1, 1, 0x111111, "glow"); P(-0.18, 3.55, 0.95, 0.06, 1, 1, 1, 0x111111, "glow");
  put("gold", "frus", 0xffc94a, 0, iy + 4.5, iz + 0.15, 0.62, 0.9, 0.62); put("gold", "cone", 0xffd36a, 0, iy + 5.2, iz + 0.15, 0.3, 0.7, 0.3); for (let i = 0; i < 6; i++) put("glow", "bulb", MULTI[i], Math.cos(i) * 0.5, iy + 4.35, iz + 0.15 + Math.sin(i) * 0.5, 0.07, 0.07, 0.07);
  for (const sg of [-1, 1]) { P(sg * 1.35, 2.0, 0.4, 0.28, 1, 2.4, 1, body); P(sg * 1.7, 2.9, 0.6, 0.22, 1, 1, 1, dark); P(sg * 1.5, 1.2, 0.8, 0.3, 1, 1, 1, 0xff9800); } // arms, palms, modak
  put("gold", "tor", 0xffa000, 0, iy + 2.85, iz + 0.45, 1.05, 1.05, 1.05, Math.PI / 2, 0, 0); put("gold", "tor", 0xff9800, 0, iy + 2.7, iz + 0.5, 1.2, 1.2, 1.2, Math.PI / 2, 0, 0); // marigold garlands
  P(2.0, 0.4, 2.3, 0.32, 1, 0.8, 1.4, 0x6d5444); P(2.0, 0.55, 2.7, 0.14, 1, 1, 1, 0x6d5444); // the mouse
  // gate and approach
  const GZ = 13.5; for (const sg of [-1, 1]) { put("gold", "cyl", 0xd9a521, sg * 5.6, 3.5, GZ, 0.36, 3.5, 0.36); put("gold", "cyl", 0xffd36a, sg * 5.6, 0.35, GZ, 0.6, 0.35, 0.6); }
  put("cloth", "box", 0xb3202a, 0, 7.4, GZ, 12.4, 0.5, 0.5); for (let i = 0; i < 40; i++) { const a = i / 39 * Math.PI; put("glow", "bulb", MULTI[i % 6], Math.cos(a) * 5.6, 7.7 + Math.sin(a) * 2.6, GZ, 0.12, 0.12, 0.12); }
  for (let i = 0; i < 14; i++) put("gold", "cone", 0xffb81c, -5.2 + i * 0.8, 7.0, GZ + 0.2, 0.18, 0.6, 0.18, Math.PI, 0, 0);
  strand("glow", [-5.6, 7.2, GZ], [-X, y0, Z], 0.9, 12, MULTI); strand("glow", [5.6, 7.2, GZ], [X, y0, Z], 0.9, 12, MULTI);
  for (let i = 0; i < 9; i++) { const a = (i / 8 - 0.5) * 2.4; strand("glow", [0, y1 + 0.2, 0], [Math.sin(a) * 19, 3.2, 3 + Math.cos(a) * 17], 0.8, 14, i % 2 ? MULTI : WARM); }
  for (const sg of [-1, 1]) { for (let i = 0; i < 12; i++) { const z = 18 - i * 1.55; put("std", "cyl", 0x8a6a3a, sg * 5.4, 0.55, z, 0.06, 0.55, 0.06); } put("cloth", "box", 0xd6252b, sg * 5.4, 0.9, 10.8, 0.04, 0.16, 17); }
  // flower garlands between pillars
  for (const z of [-4.2, 4.2]) { strand("flower", [-6.2, 6.2, z], [6.2, 6.2, z], 0.9, 22, [0xff9a00, 0xffc300], 0.2); strand("flower", [-6.2, 3.5, z], [6.2, 3.5, z], 0.6, 20, [0xffffff, 0xff6f91], 0.14); }
  // side stalls (prasad, flowers, toys) with striped awnings
  for (const [sx, sz, rot] of [[-14, 2, 0.15], [14, 3, -0.15], [-15.5, 9, 0.2], [15.5, 10, -0.2], [-13, -4, 0], [13, -3, 0]]) {
    put("std", "box", 0x6b4f33, sx, 0.55, sz, 3.2, 1.1, 1.6, 0, rot, 0); for (const px of [-1.5, 1.5]) put("std", "cyl", 0x4a3622, sx + px * Math.cos(rot), 1.7, sz - px * Math.sin(rot), 0.06, 1.2, 0.06);
    for (let i = 0; i < 6; i++) put("cloth", "box", i % 2 ? 0xffffff : [0xe5322d, 0x1e88e5, 0xfb8c00][Math.floor(sz + i) % 3], sx + (i - 2.5) * 0.55 * Math.cos(rot), 2.85, sz - (i - 2.5) * 0.55 * Math.sin(rot), 0.55, 0.06, 2.2, -0.3, rot, 0);
    put("glow", "bulb", 0xffe9a8, sx, 2.65, sz + 0.5, 0.18, 0.18, 0.18); for (let i = 0; i < 5; i++) put("flower", "sph", [0xff9a00, 0xff3d7f, 0xffffff, 0xffc300, 0xe91e63][i], sx - 1.1 + i * 0.55, 1.28, sz + 0.2, 0.22, 0.2, 0.22);
  }
  return { lights: [[0, 6.2, -3.5, 13, 0xffd27a, 0.3], [0, 8.8, GZ, 16, 0xffe2a8, 0.25]], box: { x: 0, z: -0.2, hw: 7.3, hd: 5.6, h: 9.4 }, sign: [0, 8.9, GZ + 0.28, 11.2, 2.3] };
}

function buildNavratri(k, site, rnd) {
  const { put, quad, strand } = k; const R = 13;
  put("std", "cyl", 0x3a1020, 0, 0.06, 4, R, 0.12, R); put("std", "cyl", 0x8c1d2f, 0, 0.14, 4, R - 0.8, 0.04, R - 0.8); for (let i = 0; i < 6; i++) put("std", "cyl", i % 2 ? 0xffc300 : 0xe91e63, 0, 0.18 + i * 0.002, 4, R - 1.6 - i * 1.9, 0.02, R - 1.6 - i * 1.9);
  for (let i = 0; i < 64; i++) { const a = i / 64 * 6.283; put("glow", "bulb", MULTI[i % 6], Math.cos(a) * (R - 0.2), 0.3, 4 + Math.sin(a) * (R - 0.2), 0.12, 0.12, 0.12); }
  // central mast and tent of light strings
  put("gold", "cyl", 0xd9a521, 0, 7, 4, 0.25, 7, 0.25); put("gold", "sph", 0xffd36a, 0, 14.4, 4, 0.55, 0.55, 0.55); put("glow", "bulb", 0xffd27a, 0, 14.4, 4, 0.8, 0.8, 0.8);
  for (let i = 0; i < 28; i++) { const a = i / 28 * 6.283; strand("glow", [0, 14.2, 4], [Math.cos(a) * (R + 1), 3.6, 4 + Math.sin(a) * (R + 1)], 0.9, 18, i % 2 ? MULTI : WARM, 0.1); put("std", "cyl", 0x8a6a3a, Math.cos(a) * (R + 1), 1.8, 4 + Math.sin(a) * (R + 1), 0.06, 1.8, 0.06); }
  for (let i = 0; i < 28; i++) { const a = i / 28 * 6.283, b = (i + 1) / 28 * 6.283; strand("glow", [Math.cos(a) * (R + 1), 3.6, 4 + Math.sin(a) * (R + 1)], [Math.cos(b) * (R + 1), 3.6, 4 + Math.sin(b) * (R + 1)], 0.35, 5, [MULTI[i % 6], MULTI[(i + 3) % 6]], 0.1); }
  // the goddess shrine at the back
  put("std", "box", 0x7a1d1d, 0, 0.7, -12, 7, 1.4, 5); for (const sx of [-3.2, 3.2]) put("gold", "cyl", 0xd9a521, sx, 3.3, -13.8, 0.25, 2.6, 0.25); quad("cloth", [-3.8, 5.6, -10], [3.8, 5.6, -10], [0, 7.6, -12.3], [0, 7.6, -12.3], 0xe5322d); quad("cloth", [-3.8, 5.6, -14.4], [3.8, 5.6, -14.4], [0, 7.6, -12.3], [0, 7.6, -12.3], 0xffb81c);
  put("gold", "disc", 0xffc94a, 0, 4, -13.7, 2.6, 2.6, 1); for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283; put("glow", "bulb", WARM[i % 3], Math.cos(a) * 2.8, 4 + Math.sin(a) * 2.8, -13.6, 0.1, 0.1, 0.1); }
  put("std", "cone", 0xc8102e, 0, 2.2, -12.9, 0.9, 2.2, 0.9); put("std", "sph", 0xd9a577, 0, 3.55, -12.9, 0.34, 0.4, 0.34); put("gold", "frus", 0xffc94a, 0, 4.05, -12.9, 0.4, 0.5, 0.4);
  for (let i = 0; i < 8; i++) { const a = (i / 7 - 0.5) * 2.4; put("std", "cyl", 0xd9a577, Math.sin(a) * 0.9, 2.9 + Math.cos(a) * 0.5, -12.7, 0.06, 0.9, 0.06, 0, 0, a); put("gold", "sph", 0xffd36a, Math.sin(a) * 1.55, 3.0 + Math.cos(a) * 0.95, -12.7, 0.1, 0.1, 0.1); }
  strand("flower", [-3.2, 5.4, -13.8], [3.2, 5.4, -13.8], 0.5, 16, [0xff9a00, 0xffc300], 0.18);
  // entrance gate with a big arch
  const GZ = 19; for (const sg of [-1, 1]) { put("gold", "cyl", 0xd9a521, sg * 5, 3.2, GZ, 0.34, 3.2, 0.34); } put("cloth", "box", 0xc8102e, 0, 6.8, GZ, 11, 0.5, 0.5); for (let i = 0; i < 36; i++) { const a = i / 35 * Math.PI; put("glow", "bulb", MULTI[i % 6], Math.cos(a) * 5, 7.1 + Math.sin(a) * 2.4, GZ, 0.12, 0.12, 0.12); }
  // dandiya poles with flags around the rim
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283 + 0.26; put("std", "cyl", 0x8a6a3a, Math.cos(a) * (R + 2.5), 2.5, 4 + Math.sin(a) * (R + 2.5), 0.07, 2.5, 0.07); put("cloth", "box", MULTI[i % 6], Math.cos(a) * (R + 2.5) + 0.35, 4.6, 4 + Math.sin(a) * (R + 2.5), 0.7, 0.45, 0.03); }
  return { lights: [[0, 12, 4, 16, 0xffcf8a, 0.35], [0, 6, -13, 12, 0xffd27a, 0.3]], box: { x: 0, z: -12, hw: 4, hd: 3, h: 7 }, sign: [0, 8.8, GZ + 0.28, 10, 2.0], ground: true };
}

function buildDiwali(k, site, rnd, rangoli) {
  const { put, quad, strand } = k;
  for (let i = 0; i < 90; i++) { const a = i / 90 * 6.283, r = 7.2 + (i % 3) * 0.35; put("glow", "bulb", 0xffa31a, Math.cos(a) * r, 0.1, 4 + Math.sin(a) * r, 0.17, 0.1, 0.17); put("glow", "bulb", 0xffe29a, Math.cos(a) * r, 0.22, 4 + Math.sin(a) * r, 0.07, 0.09, 0.07); }
  // lantern tower: three tiers of akash kandils
  put("gold", "cyl", 0xd9a521, 0, 6.5, 4, 0.2, 6.5, 0.2);
  for (let tier = 0; tier < 3; tier++) for (let i = 0; i < 6 - tier; i++) { const a = i / (6 - tier) * 6.283 + tier, r = 2.4 - tier * 0.6; put("glow", "oct", [0xff8c1a, 0xffd23f, 0xff4d6d][(i + tier) % 3], Math.cos(a) * r, 11.5 - tier * 2.8, 4 + Math.sin(a) * r, 0.7, 1.0, 0.7); strand("glow", [0, 12.8 - tier * 0.4, 4], [Math.cos(a) * r, 12.5 - tier * 2.8, 4 + Math.sin(a) * r], 0.1, 4, WARM, 0.05); }
  put("glow", "oct", 0xffe08a, 0, 13.6, 4, 1.1, 1.6, 1.1);
  // light curtains (strands hanging from a ring)
  for (let i = 0; i < 20; i++) { const a = i / 20 * 6.283, x = Math.cos(a) * 11, z = 4 + Math.sin(a) * 11; for (let j = 0; j < 13; j++) put("glow", "bulb", j % 3 ? 0xffd27a : 0xff9a3a, x, 10 - j * 0.7, z, 0.09, 0.09, 0.09); put("std", "cyl", 0x4a3622, x, 5, z, 0.05, 5, 0.05); }
  for (let i = 0; i < 20; i++) { const a = i / 20 * 6.283, b = (i + 1) / 20 * 6.283; strand("glow", [Math.cos(a) * 11, 10, 4 + Math.sin(a) * 11], [Math.cos(b) * 11, 10, 4 + Math.sin(b) * 11], 0.4, 5, WARM, 0.1); }
  // marigold toran gate
  const GZ = 17; for (const sg of [-1, 1]) put("gold", "cyl", 0xd9a521, sg * 4.6, 3, GZ, 0.3, 3, 0.3); for (let i = 0; i < 30; i++) { const a = i / 29 * Math.PI; put("glow", "bulb", WARM[i % 3], Math.cos(a) * 4.6, 6.2 + Math.sin(a) * 2.2, GZ, 0.13, 0.13, 0.13); }
  strand("flower", [-4.6, 6, GZ], [4.6, 6, GZ], 0.4, 20, [0xff9a00, 0xffc300], 0.2); for (let i = 0; i < 10; i++) { strand("flower", [-4.6 + i * 0.97, 6, GZ], [-4.6 + i * 0.97, 4.2 - (i % 2), GZ], 0, 5, [0xff9a00, 0xffc300], 0.14); }
  return { lights: [[0, 12, 4, 14, 0xffb347, 0.4]], box: { x: 0, z: 4, hw: 0.7, hd: 0.7, h: 14 }, sign: [0, 8.6, GZ + 0.28, 9.4, 1.9], rangoli: [0, 0.07, 4, 6.6] };
}

// ---- the render-side manager -----------------------------------------------------------------------------------------------------------------
export function createFestival(scene, world, crowd, opts = {}) {
  const sites = world.festSites || []; const rnd = (() => { let a = 77; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();
  const matStd = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.02 }), matGold = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.35, emissive: 0x6a4410 });
  const matCloth = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide, emissive: 0x2d0c04 }), matFlower = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, emissive: 0x4a2200 });
  const matGlow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); matGlow.color.setScalar(1.6);
  const MAT = { std: matStd, gold: matGold, cloth: matCloth, flower: matFlower, glow: matGlow };
  const glowTex = glowTexture(); const spriteMat = (c, o) => new THREE.SpriteMaterial({ map: glowTex, color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  let mode = "off", rangoliTex = null, t = 0, banner = null; const live = new Map(); // site id -> group
  const colliders = []; // dynamic colliders for the pandals that currently exist
  const baseQuery = world.queryColliders;
  world.queryColliders = (x, z, fn) => { baseQuery(x, z, fn); for (const o of colliders) if (Math.abs(o.x - x) < 24 && Math.abs(o.z - z) < 24) fn(o); };

  function build(site) {
    const k = kit(); const res = (mode === "ganapati" ? buildGanapati : mode === "navratri" ? buildNavratri : buildDiwali)(k, site, rnd, rangoliTex); const g = new THREE.Group(); g.position.set(site.x, site.y, site.z); g.rotation.y = site.rot;
    for (const key in k.L) { const geo = mergeGeometries(k.L[key]); const m = new THREE.Mesh(geo, MAT[key]); m.frustumCulled = true; m.castShadow = key === "std" || key === "gold"; m.receiveShadow = key !== "glow"; g.add(m); k.L[key].forEach((q) => q.dispose()); }
    if (res.rangoli) { if (!rangoliTex) rangoliTex = rangoliTexture(); const [x, y, z, r] = res.rangoli; const m = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshBasicMaterial({ map: rangoliTex, toneMapped: false, color: 0xdddddd })); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); g.add(m); }
    const line1 = mode === "ganapati" ? `${site.name} Sarvajanik Ganeshotsav Mandal` : mode === "navratri" ? `${site.name} Garba Mahotsav` : `${site.name} Diwali Mela`; const line2 = mode === "ganapati" ? "|| Ganpati Bappa Morya ||" : mode === "navratri" ? "Jai Mata Di" : "Shubh Deepavali";
    const tex = signTexture(line1, line2, mode === "ganapati" ? "#8b0f1c" : mode === "navratri" ? "#6a1b9a" : "#7a2e00", mode === "diwali" ? "#ffd54a" : "#ffe08a"); const [sx, sy, sz, sw, sh] = res.sign;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: 0xe8e8e8 })); sign.position.set(sx, sy, sz); g.add(sign); const back = sign.clone(); back.rotation.y = Math.PI; back.position.z -= 0.56; g.add(back);
    // soft glows that bloom into halos at night
    for (const [lx, ly, lz, size, col, op] of res.lights) { const s = new THREE.Sprite(spriteMat(col, op)); s.position.set(lx, ly, lz); s.scale.set(size, size * 0.8, 1); s.userData.base = op; g.add(s); }
    if (mode === "diwali") { for (let i = 0; i < 4; i++) { const s = new THREE.Sprite(spriteMat(0xffa040, 0.5)); s.position.set(Math.cos(i * 1.57) * 7, 1.2, 4 + Math.sin(i * 1.57) * 7); s.scale.set(5, 3, 1); s.userData.base = 0.3; g.add(s); } }
    g.userData.glows = g.children.filter((c) => c.isSprite); scene.add(g); live.set(site.id, g);
    // collider for the structure
    const b = res.box, c = Math.cos(site.rot), sn = Math.sin(site.rot); // local (x,z) -> world: x along tangent (tx,tz), z along normal (nx,nz)
    const wx = site.x + site.tx * b.x + site.nx * b.z, wz = site.z + site.tz * b.x + site.nz * b.z; const o = { t: 0, x: wx, z: wz, hw: b.hw, hd: b.hd, c: Math.cos(-site.rot), s: Math.sin(-site.rot), y: site.y, h: b.h, fest: site.id }; void c; void sn; colliders.push(o);
  }
  function drop(id) { const g = live.get(id); if (!g) return; scene.remove(g); g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.isMesh && o.material && !Object.values(MAT).includes(o.material)) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } if (o.isSprite) o.material.dispose(); }); live.delete(id); for (let i = colliders.length - 1; i >= 0; i--) if (colliders[i].fest === id) colliders.splice(i, 1); }

  // ---- fireworks (Diwali, and the finale of Navratri) ----
  const FW = 6, FP = 110; const fwGeo = new THREE.BufferGeometry(); const fwPos = new Float32Array(FW * FP * 3), fwCol = new Float32Array(FW * FP * 3); fwGeo.setAttribute("position", new THREE.BufferAttribute(fwPos, 3)); fwGeo.setAttribute("color", new THREE.BufferAttribute(fwCol, 3));
  const fwMat = new THREE.PointsMaterial({ size: 3.2, vertexColors: true, transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, toneMapped: false, map: glowTex }); const fwPts = new THREE.Points(fwGeo, fwMat); fwPts.frustumCulled = false; fwPts.visible = false; scene.add(fwPts);
  const bursts = []; for (let i = 0; i < FW; i++) bursts.push({ t: -1, x: 0, y: 0, z: 0, vel: new Float32Array(FP * 3), col: new THREE.Color(), next: i * 0.9 });
  const fwFlash = new THREE.Sprite(spriteMat(0xffffff, 0)); fwFlash.scale.set(260, 200, 1); scene.add(fwFlash); fwFlash.visible = false;
  let flashV = 0;
  function fireworks(dt, cam) {
    const on = mode === "diwali" || (mode === "navratri" && false); fwPts.visible = on; if (!on) { fwFlash.visible = false; return; }
    let any = false;
    bursts.forEach((b, bi) => {
      if (b.t < 0) { b.next -= dt; if (b.next <= 0) { const a = rnd() * 6.283, d = 120 + rnd() * 380; b.x = cam.x + Math.cos(a) * d; b.z = cam.z + Math.sin(a) * d; b.y = 110 + rnd() * 120; b.t = 0; b.col.setHSL(rnd(), 1, 0.6); for (let i = 0; i < FP; i++) { const u = rnd() * 2 - 1, th = rnd() * 6.283, s = Math.sqrt(1 - u * u), sp = 22 + rnd() * 14; b.vel[i * 3] = s * Math.cos(th) * sp; b.vel[i * 3 + 1] = u * sp; b.vel[i * 3 + 2] = s * Math.sin(th) * sp; } if (Math.hypot(b.x - cam.x, b.z - cam.z) < 260) flashV = 0.35; opts.onBang && opts.onBang(b.x, b.z, Math.hypot(b.x - cam.x, b.z - cam.z)); } }
      else { b.t += dt; const life = 2.8; if (b.t > life) { b.t = -1; b.next = 1 + rnd() * 3.5; } }
      for (let i = 0; i < FP; i++) { const o = (bi * FP + i) * 3; if (b.t < 0) { fwPos[o + 1] = -9999; continue; } any = true; const tt = b.t, drag = Math.exp(-tt * 1.4); const fade = Math.max(0, 1 - tt / 2.8); fwPos[o] = b.x + b.vel[i * 3] * (1 - drag) / 1.4; fwPos[o + 1] = b.y + b.vel[i * 3 + 1] * (1 - drag) / 1.4 - 9.8 * tt * tt * 0.22; fwPos[o + 2] = b.z + b.vel[i * 3 + 2] * (1 - drag) / 1.4; const f = fade * (0.7 + 0.3 * Math.sin(tt * 30 + i)); fwCol[o] = b.col.r * f * 2; fwCol[o + 1] = b.col.g * f * 2; fwCol[o + 2] = b.col.b * f * 2; }
    });
    fwGeo.attributes.position.needsUpdate = true; fwGeo.attributes.color.needsUpdate = true; void any;
    flashV = Math.max(0, flashV - dt * 1.6); fwFlash.visible = flashV > 0.01; fwFlash.material.opacity = flashV * 0.45; fwFlash.position.set(cam.x, cam.y + 60, cam.z);
  }

  return {
    sites, get mode() { return mode; },
    setMode(m) { if (m === mode) return; for (const id of [...live.keys()]) drop(id); mode = m; crowd && crowd.setMode(m, m === "off" ? [] : sites); },
    nearest(x, z) { let b = null, bd = 1e9; for (const s of sites) { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; b = s; } } return b ? { site: b, d: bd } : null; },
    update(dt, cam, night = 1) {
      t += dt;
      if (mode !== "off") {
        for (const s of sites) { const d = Math.hypot(s.x - cam.x, s.z - cam.z); const g = live.get(s.id); if (d < 420 && !g) { if (t > 0.01) build(s); } else if (d > 520 && g) drop(s.id); }
        const fl = 0.85 + 0.15 * Math.sin(t * 7); for (const g of live.values()) for (const sp of g.userData.glows) sp.material.opacity = sp.userData.base * (0.35 + 0.65 * night) * fl;
        matGlow.color.setScalar(1.15 + 0.5 * night);
      }
      fireworks(dt, cam);
      return crowd ? crowd.update(dt, cam, opts.dens ? opts.dens(cam.x, cam.z) : 0.6, night > 0.3) : 0;
    },
    dispose() { for (const id of [...live.keys()]) drop(id); scene.remove(fwPts, fwFlash); },
  };
}
