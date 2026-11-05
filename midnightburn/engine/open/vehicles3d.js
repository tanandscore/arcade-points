// Midnight Burn — cheap, believable traffic: cars, taxis, auto-rickshaws, buses and trucks. Each is two or three draw calls.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { GB, C } from "./chunks3d";
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
  if (kind === "rick") { // auto-rickshaw: the one vehicle still built in code (every car, taxi, bus and truck is a real model now)
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
  }
  return { body: body.build(), head: head.build(), tail: tail.build() };
}
