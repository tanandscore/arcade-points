// Midnight Burn — cheap, believable traffic: cars, taxis, auto-rickshaws, buses and trucks. Each is two or three draw calls.
import * as THREE from "three";
import { GB, C } from "./chunks3d";

function extrude(pts, depth, bevel = 0.04) {
  const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) sh.lineTo(pts[i][0], pts[i][1]); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 1 }); g.translate(0, 0, -depth / 2); return g;
}
const WHITE = C(0xffffff), GLASS = C(0x0b0f18), TRIM = C(0x08080b), TYRE = C(0x0c0c0e), STRIPE = C(0xf1f1ec);
const RED = C(0xff2a2a), HEAD = C(0xfff2c8), AMBER = C(0xffa21a);

const CYL = new THREE.CylinderGeometry(1, 1, 1, 10, 1); CYL.rotateX(Math.PI / 2); // axis along z, centred
function wheel(g, x, z, r = 0.34, w = 0.26) { g.geo(CYL, x, r, z, r, r, w, 0, TYRE, 0); }

function lights(gl, pts, col, w, h) { for (const [x, y, z] of pts) gl.box(x, y, z, w, h, 0.34, 0, col); }

export function buildVehicleGeo(kind) {
  const body = new GB(), head = new GB(), tail = new GB();
  if (kind === "car" || kind === "taxi") {
    const lower = extrude([[-2.1, 0.32], [-2.15, 0.7], [-1.9, 0.95], [1.0, 0.98], [1.8, 0.85], [2.15, 0.65], [2.15, 0.32]], 1.7, 0.05);
    const cabin = extrude([[-1.4, 0.95], [-0.95, 1.42], [0.45, 1.44], [1.0, 0.95]], 1.55, 0.03);
    body.geo(lower, 0, 0, 0, 1, 1, 1, 0, WHITE); body.geo(cabin, 0, 0, 0, 1, 1, 1, 0, GLASS);
    body.box(-0.2, 1.43, 0, 1.4, 0.05, 1.5, 0, WHITE);
    for (const sx of [1.25, -1.25]) for (const sz of [0.88, -0.88]) wheel(body, sx, sz);
    if (kind === "taxi") { body.box(-0.2, 1.46, 0, 0.5, 0.16, 0.3, 0, STRIPE); }
    lights(head, [[2.17, 0.62, 0.6], [2.17, 0.62, -0.6]], HEAD, 0.1, 0.14); lights(tail, [[-2.17, 0.74, 0.6], [-2.17, 0.74, -0.6]], RED, 0.1, 0.14);
  } else if (kind === "rick") { // auto-rickshaw: canopy, front fork wheel, two rear wheels
    const lower = extrude([[-1.2, 0.3], [-1.25, 0.75], [-0.9, 1.0], [0.4, 1.0], [0.9, 0.85], [1.3, 0.5], [1.3, 0.3]], 1.3, 0.04);
    body.geo(lower, 0, 0, 0, 1, 1, 1, 0, WHITE);
    body.box(-0.3, 1.0, 0, 1.9, 0.9, 1.35, 0, TRIM); body.box(-0.3, 1.88, 0, 2.0, 0.1, 1.45, 0, TRIM);
    body.box(0.7, 1.0, 0, 0.1, 0.8, 1.2, 0, GLASS);
    wheel(body, 1.0, 0, 0.3, 0.16); wheel(body, -0.8, 0.62, 0.3, 0.2); wheel(body, -0.8, -0.62, 0.3, 0.2);
    lights(head, [[1.31, 0.62, 0]], HEAD, 0.1, 0.16); lights(tail, [[-1.27, 0.7, 0.4], [-1.27, 0.7, -0.4]], RED, 0.08, 0.12);
  } else if (kind === "bus") {
    body.box(0, 0.45, 0, 10.4, 2.6, 2.5, 0, WHITE);
    body.box(0, 1.5, 0, 10.45, 0.9, 2.55, 0, GLASS); body.box(0, 0.6, 0, 10.45, 0.12, 2.55, 0, STRIPE);
    body.box(5.15, 0.8, 0, 0.1, 1.9, 2.3, 0, GLASS);
    for (const sx of [3.3, -3.3]) for (const sz of [1.1, -1.1]) wheel(body, sx, sz, 0.55, 0.3);
    lights(head, [[5.26, 0.9, 0.9], [5.26, 0.9, -0.9]], HEAD, 0.1, 0.22); lights(tail, [[-5.26, 0.9, 0.9], [-5.26, 0.9, -0.9]], RED, 0.1, 0.22);
  } else { // truck: cab and cargo box
    body.box(3.0, 0.5, 0, 2.2, 2.0, 2.3, 0, WHITE); body.box(3.9, 1.5, 0, 0.5, 0.8, 2.25, 0, GLASS);
    body.box(-1.4, 0.6, 0, 6.0, 2.4, 2.45, 0, C(0xd8d8d8)); body.box(-1.4, 0.45, 0, 6.2, 0.2, 2.4, 0, TRIM);
    for (const sx of [3.0, -2.8, -4.0]) for (const sz of [1.0, -1.0]) wheel(body, sx, sz, 0.5, 0.3);
    lights(head, [[4.12, 0.9, 0.8], [4.12, 0.9, -0.8]], HEAD, 0.1, 0.2); lights(tail, [[-4.42, 0.8, 0.9], [-4.42, 0.8, -0.9]], RED, 0.1, 0.2);
  }
  return { body: body.build(), head: head.build(), tail: tail.build() };
}
