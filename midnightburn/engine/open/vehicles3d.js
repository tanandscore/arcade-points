// Midnight Burn — cheap, believable traffic: cars, taxis, auto-rickshaws, buses and trucks. Each is two or three draw calls.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GB, C } from "./chunks3d";
import { loft, sampleSt } from "../cars";
import { IS_TOKYO } from "./mapId";

function extrude(pts, depth, bevel = 0.04) {
  const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 1 }); g.translate(0, 0, -depth / 2); return g;
}
const WHITE = C(0xffffff), GLASS = C(0x0b0f18), TRIM = C(0x08080b), TYRE = C(0x0c0c0e), STRIPE = C(0xf1f1ec);
const RED = C(0xff2a2a), HEAD = C(0xfff2c8), AMBER = C(0xffa21a);

const CYL = new THREE.CylinderGeometry(1, 1, 1, 10, 1); CYL.rotateX(Math.PI / 2); // axis along z, centred
function wheel(g, x, z, r = 0.34, w = 0.26) { g.geo(CYL, x, r, z, r, r, w, 0, TYRE, 0); }

function lights(gl, pts, col, w, h) { for (const [x, y, z] of pts) gl.box(x, y, z, w, h, 0.34, 0, col); }

export function buildVehicleGeo(kind, variant = 0) {
  const body = new GB(), head = new GB(), tail = new GB();
  if (kind === "car" || kind === "taxi") {
    return buildCar(variant, kind === "taxi");
  } else if (kind === "rick") { // auto-rickshaw: painted apron and rear body, open sides with a visible bench seat, black canvas roof on slim pillars, slanted windscreen, handlebars
    const UB = new THREE.BoxGeometry(1, 1, 1), SEAT = C(0x6a4a30), CANVAS = C(0x101114), PL = C(0xe9e6d8);
    const lower = extrude([[-1.25, 0.32], [-1.28, 0.7], [-1.12, 0.84], [-0.25, 0.82], [0.05, 0.6], [0.4, 0.6], [0.55, 0.95], [0.78, 1.08], [0.98, 0.86], [1.28, 0.6], [1.32, 0.34]], 1.2, 0.05);
    body.geo(lower, 0, 0, 0, 1, 1, 1, 0, WHITE);
    body.box(-0.1, 0.26, 0, 2.5, 0.08, 1.12, 0, TRIM); // floor and sills
    body.box(-0.75, 0.6, 0, 0.7, 0.14, 1.05, 0, SEAT); body.box(-1.17, 0.68, 0, 0.1, 0.5, 1.05, 0, SEAT); body.box(0.15, 0.58, 0, 0.36, 0.12, 0.5, 0, SEAT); // bench, backrest, driver's seat
    // canvas roof: a thin curved shell, crowned in the middle, overhanging the pillars
    const top = (x) => 1.9 + 0.07 * (1 - Math.pow((x + 0.3) / 1.2, 2)); const xs = [0.85, 0.5, 0.1, -0.3, -0.7, -1.1, -1.4];
    const roofPts = [...xs.map((x) => [x, top(x)]), ...xs.slice().reverse().map((x) => [x, top(x) - 0.07])];
    body.geo(extrude(roofPts, 1.46, 0.03), 0, 0, 0, 1, 1, 1, 0, CANVAS);
    for (const sz of [0.66, -0.66]) { body.geo(UB, -1.3, 1.37, sz, 0.05, 1.0, 0.05, 0, TRIM); body.geo(UB, 0.66, 1.4, sz, 0.05, 1.0, 0.05, 0, TRIM, 0.3); } // rear and front pillars
    body.geo(UB, 0.7, 1.41, 0, 0.03, 0.78, 1.22, 0, GLASS, 0.3); // slanted windscreen
    body.geo(UB, -1.33, 1.48, 0, 0.03, 0.34, 0.9, 0, GLASS); body.box(-1.34, 1.2, 0, 0.03, 0.3, 1.2, 0, CANVAS); // rear window and the canvas below it
    for (const sz of [0.7, -0.7]) body.box(-0.45, 1.5, sz, 1.6, 0.05, 0.03, 0, CANVAS); // rolled side curtains
    // handlebars with grips and a mirror, front mudguard, rear mudguards, plate
    body.box(0.62, 1.14, 0, 0.07, 0.05, 0.78, 0, TRIM); for (const sz of [0.4, -0.4]) { body.box(0.62, 1.12, sz, 0.07, 0.07, 0.1, 0, SEAT); body.box(0.6, 1.2, sz * 0.9, 0.03, 0.2, 0.03, 0, TRIM); }
    body.box(1.0, 0.62, 0, 0.64, 0.05, 0.3, 0, WHITE); body.box(1.28, 0.5, 0, 0.12, 0.2, 0.3, 0, WHITE);
    for (const sz of [0.62, -0.62]) body.box(-0.8, 0.62, sz, 0.74, 0.05, 0.26, 0, WHITE);
    body.box(-1.31, 0.42, 0, 0.02, 0.12, 0.34, 0, PL);
    wheel(body, 1.0, 0, 0.3, 0.16); wheel(body, -0.8, 0.62, 0.3, 0.2); wheel(body, -0.8, -0.62, 0.3, 0.2);
    lights(head, [[1.32, 0.84, 0]], HEAD, 0.1, 0.18); lights(tail, [[-1.3, 0.72, 0.42], [-1.3, 0.72, -0.42]], RED, 0.08, 0.12);
  } else if (kind === "bus" && IS_TOKYO) { // Japan: a one-floor city bus, flat front, long window band, folding doors, roof air-conditioner, lit destination display (no double-deckers in Japan)
    const DK = C(0x15151a), SIL = C(0x9a9ea8), WARM = C(0x8f6c3a), PALE = C(0xe9ecee);
    const prof = extrude([[-5.2, 0.42], [5.0, 0.42], [5.3, 0.78], [5.3, 2.75], [5.12, 3.02], [4.5, 3.1], [-4.7, 3.1], [-5.2, 2.9]], 2.46, 0.07);
    body.geo(prof, 0, 0, 0, 1, 1, 1, 0, WHITE);
    body.box(0, 0.5, 0, 10.66, 0.16, 2.7, 0, DK); body.box(0, 1.12, 0, 10.6, 0.22, 2.5, 0, PALE); body.box(0, 3.08, 0, 9.6, 0.08, 2.2, 0, PALE); // skirt, white livery band, roof
    for (let k = 0; k < 8; k++) { const x = -4.5 + k * 1.2; for (const sz of [1.25, -1.25]) body.box(x, 2.0, sz, 1.08, 0.95, 0.06, 0, GLASS); } // the long window band
    for (const sz of [1.255, -1.255]) { body.box(3.6, 1.55, sz, 1.1, 1.9, 0.07, 0, GLASS); body.box(3.6, 1.55, sz * 1.01, 0.05, 1.9, 0.05, 0, DK); body.box(-2.4, 1.55, sz, 1.0, 1.9, 0.07, 0, GLASS); body.box(-2.4, 1.55, sz * 1.01, 0.05, 1.9, 0.05, 0, DK); } // folding doors
    body.box(5.32, 1.9, 0, 0.06, 1.35, 2.3, 0, GLASS); body.box(5.34, 0.62, 0, 0.12, 0.3, 2.5, 0, SIL); body.box(-5.3, 0.62, 0, 0.12, 0.3, 2.5, 0, SIL); body.box(-5.28, 1.9, 0, 0.06, 0.7, 1.9, 0, GLASS);
    body.box(2.0, 3.28, 0, 2.6, 0.32, 1.7, 0, PALE); body.box(-2.2, 3.22, 0, 1.4, 0.2, 1.4, 0, DK); // roof air-conditioner and vent
    for (const sz of [1.32, -1.32]) { body.box(5.0, 2.2, sz, 0.05, 0.9, 0.05, 0, DK); body.box(5.0, 2.55, sz * 1.05, 0.1, 0.34, 0.2, 0, DK); } // wing mirrors on long arms
    for (const sx of [3.4, -3.3]) for (const sz of [1.08, -1.08]) { wheel(body, sx, sz, 0.55, 0.32); body.box(sx, 0.55, sz * 1.24, 1.3, 0.5, 0.06, 0, DK); }
    lights(head, [[5.33, 0.82, 0.95], [5.33, 0.82, -0.95]], HEAD, 0.1, 0.22); head.box(5.33, 2.88, 0, 0.06, 0.26, 1.8, 0, AMBER); head.box(-5.28, 2.7, 0, 0.06, 0.2, 1.0, 0, AMBER); head.box(1.0, 2.75, 1.26, 1.0, 0.18, 0.04, 0, AMBER);
    for (let k = 0; k < 8; k++) { const x = -4.5 + k * 1.2; for (const sz of [1.285, -1.285]) head.box(x, 2.0, sz, 1.0, 0.85, 0.02, 0, WARM); }
    lights(tail, [[-5.28, 0.9, 1.0], [-5.28, 0.9, -1.0], [-5.28, 1.3, 0.0]], RED, 0.1, 0.2);
  } else if (kind === "bus") { // double-decker (like Mumbai's open-top-less BEST Ashok Leyland): two window decks, cream band, lit destination blind
    const CREAM = C(0xf1ead0), DK = C(0x15151a), SIL = C(0x9a9ea8), WARM = C(0x8f6c3a);
    const prof = extrude([[-5.2, 0.5], [5.0, 0.5], [5.3, 0.95], [5.3, 3.9], [5.15, 4.3], [4.6, 4.42], [-4.7, 4.42], [-5.2, 4.2]], 2.46, 0.07);
    body.geo(prof, 0, 0, 0, 1, 1, 1, 0, WHITE);
    body.box(0, 2.18, 0, 10.66, 0.2, 2.72, 0, CREAM); body.box(0, 0.5, 0, 10.66, 0.14, 2.7, 0, DK); body.box(0, 4.4, 0, 9.9, 0.1, 2.2, 0, C(0xd8d8d8)); // deck band, skirt, white roof
    // side windows between pillars, both decks
    for (let k = 0; k < 8; k++) { const x = -4.4 + k * 1.2; for (const sz of [1.32, -1.32]) { body.box(x, 1.1, sz, 1.0, 0.82, 0.06, 0, GLASS); body.box(x, 2.6, sz, 1.0, 0.95, 0.06, 0, GLASS); } }
    for (const sz of [1.325, -1.325]) { body.box(4.55, 1.0, sz, 0.75, 1.0, 0.06, 0, DK); } // front door
    // windscreens, destination blind, grille, bumpers
    body.box(5.4, 0.95, 0, 0.06, 1.05, 2.15, 0, GLASS); body.box(5.4, 2.5, 0, 0.06, 1.1, 2.2, 0, GLASS); body.box(5.42, 0.52, 0, 0.12, 0.3, 2.5, 0, SIL); body.box(-5.34, 0.52, 0, 0.12, 0.3, 2.5, 0, SIL);
    body.box(5.4, 2.12, 0, 0.06, 0.08, 1.4, 0, DK); body.box(-5.3, 1.0, 0, 0.06, 1.0, 1.9, 0, GLASS); body.box(-5.3, 2.5, 0, 0.06, 1.0, 2.1, 0, GLASS);
    for (const sz of [1.42, -1.42]) { body.box(4.9, 1.85, sz, 0.18, 0.28, 0.1, 0, DK); body.box(4.9, 1.72, sz * 1.04, 0.04, 0.4, 0.05, 0, SIL); } // mirrors
    for (const sx of [3.5, -3.4]) for (const sz of [1.08, -1.08]) { wheel(body, sx, sz, 0.58, 0.32); body.box(sx, 0.55, sz * 1.24, 1.3, 0.5, 0.06, 0, DK); } // wheels under arches
    // emissive: headlights, amber destination blind, warm interior glow on both decks
    lights(head, [[5.41, 0.78, 0.95], [5.41, 0.78, -0.95]], HEAD, 0.1, 0.24); head.box(5.41, 3.55, 0, 0.06, 0.34, 1.5, 0, AMBER); head.box(-5.34, 3.55, 0, 0.06, 0.3, 0.9, 0, AMBER);
    for (let k = 0; k < 8; k++) { const x = -4.4 + k * 1.2; for (const sz of [1.355, -1.355]) { head.box(x, 1.1, sz, 0.9, 0.7, 0.02, 0, WARM); head.box(x, 2.6, sz, 0.9, 0.82, 0.02, 0, WARM); } }
    lights(tail, [[-5.36, 0.85, 1.0], [-5.36, 0.85, -1.0], [-5.36, 1.9, 0.0]], RED, 0.1, 0.22);
  } else { // truck: cab and cargo box
    body.box(3.0, 0.5, 0, 2.2, 2.0, 2.3, 0, WHITE); body.box(3.9, 1.5, 0, 0.5, 0.8, 2.25, 0, GLASS);
    body.box(-1.4, 0.6, 0, 6.0, 2.4, 2.45, 0, C(0xd8d8d8)); body.box(-1.4, 0.45, 0, 6.2, 0.2, 2.4, 0, TRIM);
    for (const sx of [3.0, -2.8, -4.0]) for (const sz of [1.0, -1.0]) wheel(body, sx, sz, 0.5, 0.3);
    lights(head, [[4.12, 0.9, 0.8], [4.12, 0.9, -0.8]], HEAD, 0.1, 0.2); lights(tail, [[-4.42, 0.8, 0.9], [-4.42, 0.8, -0.9]], RED, 0.1, 0.2);
  }
  return { body: body.build(), head: head.build(), tail: tail.build() };
}

// ---- smooth-bodied family cars (3 shapes) -------------------------------------------------------------------------------------------------------------------------
// A lofted body (same maths as the hero cars, much cheaper), a glass canopy, painted roof and pillars, dented wheel arches with a baked dark tone,
// real tyres with rims, bumpers, grille, door lines, plates and lamps. Paint is the only part tinted by the car's colour; glass and trim have their own materials.
const CAR_SHAPES = [
  { name: "sedan", L: 4.5, nB: 3.4, wx: [1.4, -1.34], r: 0.34, w: 0.22,
    body: [[-2.25, 0.55, 0.45, 0.8], [-2.15, 0.8, 0.36, 0.95], [-1.6, 0.87, 0.3, 1.0], [-0.5, 0.9, 0.28, 0.98], [0.7, 0.89, 0.28, 0.95], [1.6, 0.86, 0.28, 0.86], [2.1, 0.78, 0.3, 0.72], [2.25, 0.6, 0.34, 0.6]],
    cab: [[-1.45, 0.7, 0.98, 1.02], [-1.0, 0.78, 0.96, 1.4], [-0.2, 0.78, 0.94, 1.46], [0.5, 0.74, 0.93, 1.38], [0.95, 0.66, 0.92, 1.05]] },
  { name: "hatch", L: 3.95, nB: 3.4, wx: [1.22, -1.14], r: 0.32, w: 0.2,
    body: [[-1.98, 0.6, 0.45, 0.9], [-1.9, 0.78, 0.36, 1.02], [-1.4, 0.84, 0.3, 1.02], [-0.3, 0.86, 0.28, 0.98], [0.7, 0.85, 0.28, 0.92], [1.5, 0.82, 0.28, 0.84], [1.88, 0.74, 0.3, 0.7], [1.98, 0.58, 0.34, 0.58]],
    cab: [[-1.8, 0.7, 0.98, 1.04], [-1.6, 0.76, 0.96, 1.38], [-0.6, 0.78, 0.94, 1.5], [0.3, 0.74, 0.93, 1.4], [0.85, 0.66, 0.92, 1.05]] },
  { name: "suv", L: 4.6, nB: 3.0, wx: [1.45, -1.38], r: 0.4, w: 0.26,
    body: [[-2.3, 0.7, 0.5, 1.02], [-2.2, 0.88, 0.42, 1.15], [-1.6, 0.93, 0.38, 1.2], [-0.4, 0.94, 0.36, 1.16], [0.8, 0.93, 0.36, 1.1], [1.7, 0.9, 0.36, 1.0], [2.15, 0.82, 0.38, 0.88], [2.3, 0.66, 0.42, 0.74]],
    cab: [[-1.95, 0.8, 1.14, 1.2], [-1.7, 0.86, 1.12, 1.68], [-0.5, 0.88, 1.1, 1.8], [0.45, 0.84, 1.08, 1.7], [1.05, 0.72, 1.06, 1.22]] },
];
const BODY_BLACK = C(0x07070a), SILVER = C(0x767a86), DKGREY = C(0x1a1b20), PLATE = C(0xe9e6d8), CHROME = C(0x8d909c);
const clampf = (a, b, x) => Math.min(b, Math.max(a, x));
function prep(g, col) { // same four attributes on every part so they merge
  if (!g.attributes.normal) g.computeVertexNormals(); if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  if (col) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; } g.setAttribute("color", new THREE.BufferAttribute(a, 3)); }
  return g;
}
const tr = (g, x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, "XYZ")), new THREE.Vector3(sx, sy, sz)); g.applyMatrix4(m); return g; };
function strut(a, b, th, col) { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length(); const g = new THREE.BoxGeometry(len, th, th); g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), d.normalize())); g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2); return prep(g, col); }
function buildCar(variant, taxi) {
  const S = CAR_SHAPES[((variant % 3) + 3) % 3];
  const paint = [], glass = [], trim = [], head = [], tail = [];
  const wheelsAt = S.wx.map((x) => ({ x, r: S.r }));
  const bodyG = loft(S.body, S.nB, 44, 22, 5, wheelsAt.map((w) => ({ x: w.x, y: w.r, r: w.r * 1.26, depth: 0.2 })), true);
  if (taxi) { const P = bodyG.attributes.position, N = bodyG.attributes.normal, Cc = bodyG.attributes.color; const bl = S.name === "suv" ? 0.96 : 0.86; for (let i = 0; i < P.count; i++) { const flank = 1 - clampf(0, 1, (N.getY(i) - 0.3) / 0.3); const blk = flank * (1 - clampf(0, 1, (P.getY(i) - bl) / 0.06)); const k = 1 - 0.93 * blk; Cc.setXYZ(i, Cc.getX(i) * k, Cc.getY(i) * k, Cc.getZ(i) * k); } }
  paint.push(prep(bodyG));
  glass.push(prep(loft(S.cab, 2.4, 30, 16), C(0x0a0e16)));
  // painted roof panel and the pillars
  const rs = S.cab.slice(1, -1).map(([x, w, yb, yt]) => [x, w * 0.9, yt - 0.03, yt + 0.03]);
  paint.push(prep(loft([[rs[0][0] - 0.05, rs[0][1] * 0.7, rs[0][2], rs[0][3]], ...rs, [rs[rs.length - 1][0] + 0.04, rs[rs.length - 1][1] * 0.7, rs[rs.length - 1][2], rs[rs.length - 1][3]]], 2.4, 24, 14), C(0xffffff)));
  const cf = S.cab[S.cab.length - 1], cr = S.cab[0];
  const pCab = 2 / 2.4; const sg = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);
  const cabPt = (x, th, sd) => { const [w, yb, yt] = sampleSt(S.cab, x); const yc = (yb + yt) / 2, hh = (yt - yb) / 2; return [x, yc + hh * sg(Math.sin(th), pCab), sd * w * sg(Math.cos(th), pCab)]; };
  const arc = (x0, x1, t0, t1, th, sd, steps = 4) => { // a pillar following the canopy surface from (x0,t0) to (x1,t1)
    for (let k = 0; k < steps; k++) { const a = k / steps, b = (k + 1) / steps; paint.push(strut(cabPt(x0 + (x1 - x0) * a, t0 + (t1 - t0) * a, sd), cabPt(x0 + (x1 - x0) * b, t0 + (t1 - t0) * b, sd), th, C(0xffffff))); }
  };
  const mid = S.cab[2];
  for (const sd of [-1, 1]) {
    arc(cf[0], S.cab[S.cab.length - 2][0], 0.5, 0.78, 0.06, sd, 3); // A-pillar: windscreen base to roof edge
    arc(cr[0] + 0.02, S.cab[1][0], 0.45, 0.8, 0.11, sd, 3);       // C-pillar
    arc(mid[0] - 0.1, mid[0] - 0.1, 0.12, 1.2, 0.04, sd, 5);      // B-pillar over the shoulder
  }
  const nose = S.L / 2, tailX = -S.L / 2;
  const at = (x) => sampleSt(S.body, x);
  // wheels: tyre, rim, dark centre cap and brake disc behind
  for (const w of wheelsAt) {
    const bw = at(w.x)[0], z0 = bw - S.w / 2 - 0.035;
    for (const sd of [-1, 1]) {
      const zc = sd * z0;
      trim.push(prep(tr(new THREE.CylinderGeometry(w.r, w.r, S.w, 16, 1).rotateX(Math.PI / 2), w.x, w.r, zc), C(0x0c0c0e)));
      trim.push(prep(tr(new THREE.CylinderGeometry(w.r * 0.6, w.r * 0.6, S.w + 0.012, 14, 1).rotateX(Math.PI / 2), w.x, w.r, zc), SILVER));
      trim.push(prep(tr(new THREE.CylinderGeometry(w.r * 0.5, w.r * 0.5, S.w + 0.018, 14, 1).rotateX(Math.PI / 2), w.x, w.r, zc), C(0x0e0f12))); // dark well between the spokes
      for (let k = 0; k < 5; k++) { const an = (k / 5) * Math.PI * 2 + 0.3, ln = w.r * 0.42; const sg2 = new THREE.BoxGeometry(ln, w.r * 0.11, S.w + 0.026); sg2.rotateZ(an); sg2.translate(w.x + Math.cos(an) * (w.r * 0.13 + ln / 2), w.r + Math.sin(an) * (w.r * 0.13 + ln / 2), zc); trim.push(prep(sg2, SILVER)); } // five alloy spokes
      trim.push(prep(tr(new THREE.CylinderGeometry(w.r * 0.14, w.r * 0.14, S.w + 0.03, 8, 1).rotateX(Math.PI / 2), w.x, w.r, zc), CHROME));
      trim.push(prep(tr(new THREE.CylinderGeometry(w.r * 0.8, w.r * 0.8, 0.03, 16, 1).rotateX(Math.PI / 2), w.x, w.r, sd * (z0 - S.w / 2 + 0.0)), C(0x2a2b31))); // brake disc / arch liner
    }
  }
  // bumpers, valance, grille, plates, door lines, mirrors, handles
  const nw = at(nose - 0.12)[0], tw = at(tailX + 0.12)[0];
  trim.push(prep(tr(new THREE.BoxGeometry(0.16, 0.13, nw * 2 * 0.98), nose - 0.1, 0.34, 0), BODY_BLACK)); // front lower bumper
  trim.push(prep(tr(new THREE.BoxGeometry(0.16, 0.12, tw * 2 * 0.98), tailX + 0.1, 0.36, 0), BODY_BLACK));
  trim.push(prep(tr(new THREE.BoxGeometry(0.04, 0.1, nw * 1.0), nose - 0.03, 0.54, 0), DKGREY)); // grille
  for (let k = -3; k <= 3; k++) trim.push(prep(tr(new THREE.BoxGeometry(0.045, 0.012, nw * 1.0), nose - 0.028, 0.5 + (k + 3) * 0.015, 0), CHROME));
  trim.push(prep(tr(new THREE.BoxGeometry(0.02, 0.11, 0.42), nose - 0.0, 0.34, 0), PLATE)); trim.push(prep(tr(new THREE.BoxGeometry(0.02, 0.11, 0.42), tailX + 0.0, 0.5, 0), PLATE));
  const wallZ = (x) => at(x)[0];
  for (const sd of [-1, 1]) {
    for (const lx of [S.cab[1][0] + 0.05, mid[0] - 0.1, mid[0] + 0.55]) trim.push(prep(tr(new THREE.BoxGeometry(0.012, 0.5, 0.012), lx, 0.66, sd * (wallZ(lx) + 0.0)), C(0x0c0c10))); // shut lines
    for (const hx of [mid[0] - 0.35, mid[0] + 0.3]) trim.push(prep(tr(new THREE.BoxGeometry(0.12, 0.02, 0.025), hx, mid[2] - 0.12, sd * (wallZ(hx) + 0.008)), CHROME)); // door handles
    trim.push(prep(tr(new THREE.BoxGeometry(0.1, 0.075, 0.14), cf[0] - 0.25, cf[2] + 0.02, sd * (cf[1] + 0.1)), BODY_BLACK)); // mirror
    trim.push(prep(tr(new THREE.BoxGeometry(S.L * 0.5, 0.045, 0.045), (S.wx[0] + S.wx[1]) / 2, 0.3, sd * (at((S.wx[0] + S.wx[1]) / 2)[0] - 0.02)), BODY_BLACK)); // sill
  }
  if (S.name === "suv") for (const sd of [-1, 1]) trim.push(strut([mid[0] - 0.9, mid[3] + 0.04, sd * mid[1] * 0.7], [mid[0] + 0.6, mid[3] + 0.04, sd * mid[1] * 0.7], 0.035, BODY_BLACK)); // roof rails
  if (S.name === "hatch") trim.push(prep(tr(new THREE.BoxGeometry(0.18, 0.02, 1.1), S.cab[0][0] - 0.02, S.cab[1][3] + 0.0, 0), BODY_BLACK)); // roof spoiler lip
  // lamps (emissive): sit on the corners of the body, following its width at that height
  const ext = (x, y) => { const [w, yb, yt] = at(x); const yc = (yb + yt) / 2, hh = (yt - yb) / 2; const k = Math.min(1, Math.abs(y - yc) / hh); return w * Math.pow(Math.max(0.02, 1 - Math.pow(k, S.nB)), 1 / S.nB); };
  const hy = S.name === "suv" ? 0.78 : 0.62, ty = S.name === "suv" ? 0.9 : 0.78;
  for (const sd of [-1, 1]) {
    const hx = nose - 0.2, hz = ext(hx, hy) - 0.17; head.push(prep(tr(new THREE.BoxGeometry(0.1, 0.1, 0.3), hx, hy, sd * hz, 0, sd * 0.5, 0), C(0xfff2c8)));
    const fx = nose - 0.17; head.push(prep(tr(new THREE.BoxGeometry(0.06, 0.03, 0.22), fx, hy - 0.11, sd * (ext(fx, hy - 0.11) - 0.2), 0, sd * 0.4, 0), C(0xfff2c8)));
    const rx = tailX + 0.2, rz = ext(rx, ty) - 0.19; tail.push(prep(tr(new THREE.BoxGeometry(0.1, 0.11, 0.34), rx, ty, sd * rz, 0, -sd * 0.4, 0), C(0xff2a2a)));
  }
  tail.push(prep(tr(new THREE.BoxGeometry(0.05, 0.025, tw * 0.9), tailX + 0.06, ty + 0.0, 0), C(0xff2a2a)));
  if (taxi) head.push(prep(tr(new THREE.BoxGeometry(0.34, 0.14, 0.5), -0.1, S.cab[2][3] + 0.03, 0), C(0xfff2c8))); // roof sign
  return { body: mergeGeometries(paint, false), glass: mergeGeometries(glass, false), trim: mergeGeometries(trim, false), head: mergeGeometries(head, false), tail: mergeGeometries(tail, false) };
}
