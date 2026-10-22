// Midnight Burn — car parts library: tyres, wheels, brakes, lamps, interiors, a night-city reflection world.
// Everything here is built from code (no model files): lathes, extrusions and canvas textures.
// All parts are merged into a few meshes each so a whole car costs only a few dozen draw calls.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

// ------------------------------------------------------------------ helpers
export function canvasTex(w, h, draw, srgb = true, aniso = 8) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t;
}
const std = (geo) => { // make every geometry carry exactly position / normal / uv, non-indexed, so they can be merged
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (!g.attributes.normal) g.computeVertexNormals();
  if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array((g.attributes.position.count) * 2), 2));
  for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
  return g;
};
export function merge(list) { const g = mergeGeometries(list.map(std), false); return g; }
const xf = (geo, fn) => { const m = new THREE.Matrix4(); fn(m); geo.applyMatrix4(m); return geo; };
const rotZ = (geo, a) => xf(geo, (m) => m.makeRotationZ(a));

// ------------------------------------------------------------------ materials (shared)
let _mats = null;
export function partMats() {
  if (_mats) return _mats;
  _mats = {
    rubber: new THREE.MeshStandardMaterial({ color: 0x121214, roughness: 0.88, metalness: 0 }),
    black: new THREE.MeshStandardMaterial({ color: 0x08080b, roughness: 0.55, metalness: 0.35 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 0x1b1c22, roughness: 0.42, metalness: 0.85 }),
    plastic: new THREE.MeshStandardMaterial({ color: 0x0d0e12, roughness: 0.7, metalness: 0.1 }),
    chromeLike: new THREE.MeshStandardMaterial({ color: 0xd9dbe6, roughness: 0.12, metalness: 1 }),
    disc: new THREE.MeshStandardMaterial({ color: 0x8b8e99, roughness: 0.38, metalness: 0.95 }),
    lampWarm: new THREE.MeshBasicMaterial({ color: 0xfff1c9 }),
    lampCool: new THREE.MeshBasicMaterial({ color: 0xcfeaff }),
    amber: new THREE.MeshBasicMaterial({ color: 0xff9a1a }),
    reverse: new THREE.MeshBasicMaterial({ color: 0xdfe4f0 }),
    gauge: null,
  };
  return _mats;
}

// ------------------------------------------------------------------ tyres
let _treadBump = null, _tyreMap = null;
function treadTextures() {
  if (_tyreMap) return { map: _tyreMap, bump: _treadBump };
  // u runs round the tyre, v runs across it (sidewall .. tread .. sidewall)
  _tyreMap = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = "#111113"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#17171a"; g.fillRect(0, h * 0.30, w, h * 0.40);
    g.fillStyle = "#4c4d55"; g.font = "bold 15px Arial, sans-serif"; g.textBaseline = "middle";
    const txt = "MIDNIGHT BURN  •  ULTRA HIGH PERFORMANCE  •  255/35 ZR19  •  TUBELESS  •  ";
    for (const v of [0.14, 0.86]) { g.save(); g.translate(0, h * v); g.fillText(txt + txt + txt, 6, 0); g.restore(); }
    g.fillStyle = "#34353b"; for (let i = 0; i < 34; i++) { g.fillRect(w * (i / 34), h * 0.07, 3, 14); g.fillRect(w * (i / 34), h * 0.91, 3, 14); }
  }, true, 8);
  _tyreMap.wrapS = THREE.RepeatWrapping;
  _treadBump = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = "#b0b0b0"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#404040"; for (const v of [0.34, 0.44, 0.56, 0.66]) g.fillRect(0, h * v - 3, w, 6);
    g.fillStyle = "#585858"; for (let i = 0; i < 64; i++) { const x = (i / 64) * w; g.beginPath(); g.moveTo(x, h * 0.31); g.lineTo(x + 18, h * 0.5); g.lineTo(x, h * 0.69); g.lineTo(x + 5, h * 0.69); g.lineTo(x + 23, h * 0.5); g.lineTo(x + 5, h * 0.31); g.fill(); }
    g.fillStyle = "#cfcfcf"; g.fillRect(0, h * 0.02, w, h * 0.04); g.fillRect(0, h * 0.94, w, h * 0.04);
  }, false, 8);
  _treadBump.wrapS = THREE.RepeatWrapping;
  return { map: _tyreMap, bump: _treadBump };
}
export function makeTyre(R, W, rimR) {
  const hw = W / 2, bead = rimR * 0.97, span = R - bead;
  const prof = [
    [bead, -hw * 0.82], [bead + span * 0.12, -hw * 0.95], [bead + span * 0.45, -hw * 1.0], [bead + span * 0.8, -hw * 0.96], [R * 0.985, -hw * 0.86], [R * 0.998, -hw * 0.66], [R, -hw * 0.4], [R, 0], [R, hw * 0.4], [R * 0.998, hw * 0.66], [R * 0.985, hw * 0.86],
    [bead + span * 0.8, hw * 0.96], [bead + span * 0.45, hw * 1.0], [bead + span * 0.12, hw * 0.95], [bead, hw * 0.82],
  ];
  const pts = new THREE.SplineCurve(prof.map(([r, z]) => new THREE.Vector2(r, z))).getPoints(48);
  const geo = new THREE.LatheGeometry(pts, 72); geo.rotateX(Math.PI / 2);
  const tt = treadTextures();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: tt.map, bumpMap: tt.bump, bumpScale: 1.6, roughness: 0.86, metalness: 0 });
  const m = new THREE.Mesh(geo, mat); m.userData.geo = geo; return m;
}

// ------------------------------------------------------------------ rims
function shapeGeo(shape, depth, bevel = 0.004) { return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 10 }); }
function spokeShape(style, r0, r1) {
  const s = new THREE.Shape();
  if (style === "fivespoke") { // tapered Y-spoke with a lightening slot
    const a = r0 * 0.5, b = r1 * 0.115, c = r1 * 0.2;
    s.moveTo(r0, -a); s.bezierCurveTo(r0 + (r1 - r0) * 0.3, -b * 1.05, r0 + (r1 - r0) * 0.7, -b * 1.3, r1, -c);
    s.lineTo(r1 + 0.001, -c * 0.12); s.lineTo(r1 + 0.001, c * 0.12); s.lineTo(r1, c);
    s.bezierCurveTo(r0 + (r1 - r0) * 0.7, b * 1.3, r0 + (r1 - r0) * 0.3, b * 1.05, r0, a); s.closePath();
    const h = new THREE.Path(); h.moveTo(r0 + (r1 - r0) * 0.34, 0); h.quadraticCurveTo(r0 + (r1 - r0) * 0.5, b * 0.52, r0 + (r1 - r0) * 0.72, 0); h.quadraticCurveTo(r0 + (r1 - r0) * 0.5, -b * 0.52, r0 + (r1 - r0) * 0.34, 0); s.holes.push(h);
  } else if (style === "ten") { // slim twin-prong spokes
    const w0 = r1 * 0.05, w1 = r1 * 0.085;
    s.moveTo(r0, -w0); s.lineTo(r1, -w1); s.lineTo(r1, w1); s.lineTo(r0, w0); s.closePath();
  } else if (style === "turbine") { // curved blade
    const w = r1 * 0.065; s.moveTo(r0, -w * 0.6);
    s.bezierCurveTo(r0 + (r1 - r0) * 0.4, -w * 1.6 - r1 * 0.1, r0 + (r1 - r0) * 0.7, -r1 * 0.14, r1, r1 * 0.12 - w);
    s.lineTo(r1, r1 * 0.12 + w); s.bezierCurveTo(r0 + (r1 - r0) * 0.7, -r1 * 0.14 + w * 1.7, r0 + (r1 - r0) * 0.4, w * 1.6 - r1 * 0.1, r0, w * 0.6); s.closePath();
  } else if (style === "star") { // seven straight spokes that flare out towards the rim
    const w0 = r1 * 0.06, w1 = r1 * 0.15;
    s.moveTo(r0, -w0); s.lineTo(r1, -w1); s.lineTo(r1, w1); s.lineTo(r0, w0); s.closePath();
  } else if (style === "classic") { // six wide, flat, old-school spokes with a slot cut through each
    const w0 = r1 * 0.12, w1 = r1 * 0.17;
    s.moveTo(r0, -w0); s.lineTo(r1, -w1); s.lineTo(r1, w1); s.lineTo(r0, w0); s.closePath();
    const h = new THREE.Path(); const a = r0 + (r1 - r0) * 0.3, b = r0 + (r1 - r0) * 0.8, hh = r1 * 0.045; h.moveTo(a, -hh); h.lineTo(b, -hh * 1.3); h.lineTo(b, hh * 1.3); h.lineTo(a, hh); h.closePath(); s.holes.push(h);
  } else if (style === "multi") { // a crowd of thin straight spokes
    const w = r1 * 0.026; s.moveTo(r0, -w); s.lineTo(r1, -w * 1.3); s.lineTo(r1, w * 1.3); s.lineTo(r0, w); s.closePath();
  } else if (style === "split") { // each spoke forks in two near the rim
    const w0 = r1 * 0.05, w1 = r1 * 0.075, gap = r1 * 0.05;
    s.moveTo(r0, -w0); s.lineTo(r0 + (r1 - r0) * 0.5, -w0 * 1.1); s.lineTo(r1, -w1 - gap); s.lineTo(r1, -gap + 0.001); s.lineTo(r0 + (r1 - r0) * 0.62, 0); s.lineTo(r1, gap - 0.001); s.lineTo(r1, w1 + gap); s.lineTo(r0 + (r1 - r0) * 0.5, w0 * 1.1); s.lineTo(r0, w0); s.closePath();
  } else if (style === "blade") { // swept blade, the turbine's mirror image but flatter and broader
    const w = r1 * 0.085; s.moveTo(r0, w * 0.6);
    s.bezierCurveTo(r0 + (r1 - r0) * 0.4, w * 1.4 + r1 * 0.08, r0 + (r1 - r0) * 0.7, r1 * 0.2, r1, -r1 * 0.1 + w);
    s.lineTo(r1, -r1 * 0.1 - w); s.bezierCurveTo(r0 + (r1 - r0) * 0.7, r1 * 0.2 - w * 1.6, r0 + (r1 - r0) * 0.4, -w * 1.1 + r1 * 0.04, r0, -w * 0.6); s.closePath();
  } else { const w = r1 * 0.08; s.moveTo(r0, -w); s.lineTo(r1, -w); s.lineTo(r1, w); s.lineTo(r0, w); s.closePath(); }
  return s;
}
let _meshTex = null;
function meshTexture() {
  if (_meshTex) return _meshTex;
  _meshTex = canvasTex(512, 512, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = "#fff"; g.strokeStyle = "#fff";
    g.beginPath(); g.arc(w / 2, h / 2, w * 0.495, 0, 7); g.arc(w / 2, h / 2, w * 0.43, 0, 7, true); g.fill();
    g.beginPath(); g.arc(w / 2, h / 2, w * 0.17, 0, 7); g.fill();
    g.lineWidth = 7; g.save(); g.beginPath(); g.arc(w / 2, h / 2, w * 0.44, 0, 7); g.clip();
    for (let k = -16; k <= 16; k++) { g.beginPath(); g.moveTo(w / 2 + k * 30 - 400, h / 2 - 400); g.lineTo(w / 2 + k * 30 + 400, h / 2 + 400); g.stroke(); g.beginPath(); g.moveTo(w / 2 + k * 30 + 400, h / 2 - 400); g.lineTo(w / 2 + k * 30 - 400, h / 2 + 400); g.stroke(); }
    g.restore();
  }, false, 8);
  return _meshTex;
}
let _discTex = null;
function discTexture() {
  if (_discTex) return _discTex;
  _discTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = "#8d909b"; g.fillRect(0, 0, w, h); g.translate(w / 2, h / 2);
    g.fillStyle = "#2a2b31"; for (let i = 0; i < 36; i++) { g.save(); g.rotate((i / 36) * Math.PI * 2); g.fillRect(w * 0.22, -2.2, w * 0.2, 4.4); g.restore(); }
    g.fillStyle = "#5c5f69"; g.beginPath(); g.arc(0, 0, w * 0.2, 0, 7); g.fill();
  }, true, 8);
  return _discTex;
}

// The whole wheel: tyre + rim barrel + face + hub + lug nuts + slotted brake disc. Axis = z, outer face = +z.
export function makeWheelModel(style, rimColor, R, W, envMap, rimK = 0.7) {
  const spin = new THREE.Group();
  const rimR = R * rimK, M = partMats();
  const tyre = makeTyre(R, W, rimR); spin.add(tyre);
  const rm = new THREE.MeshStandardMaterial({ color: new THREE.Color(rimColor), roughness: 0.2, metalness: 0.96, envMap, envMapIntensity: 1.5 });
  const faceZ = W * 0.32;
  // barrel (inner well is dark, the lip is the rim colour)
  const bp = [[rimR * 1.0, -W * 0.46], [rimR * 0.985, -W * 0.4], [rimR * 0.87, -W * 0.3], [rimR * 0.85, 0.05 * W], [rimR * 0.9, W * 0.3], [rimR * 0.985, W * 0.42], [rimR * 1.015, W * 0.46], [rimR * 1.0, W * 0.48]];
  const barrelGeo = new THREE.LatheGeometry(bp.map(([r, z]) => new THREE.Vector2(r, z)), 56); barrelGeo.rotateX(Math.PI / 2);
  spin.add(new THREE.Mesh(barrelGeo, new THREE.MeshStandardMaterial({ color: 0x1a1b20, roughness: 0.45, metalness: 0.85, side: THREE.DoubleSide })));
  const lip = new THREE.Mesh(new THREE.TorusGeometry(rimR * 1.0, W * 0.035, 8, 56), rm); lip.position.z = W * 0.47; spin.add(lip);
  // dark dish behind the spokes so the gaps read as deep
  const dish = new THREE.Mesh(new THREE.CircleGeometry(rimR * 0.93, 40), new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: 0.6, metalness: 0.6 })); dish.position.z = W * 0.05; spin.add(dish);
  // brake disc + hat (slotted), just behind the face
  const discG = new THREE.CylinderGeometry(rimR * 0.88, rimR * 0.88, W * 0.07, 48); discG.rotateX(Math.PI / 2);
  const discM = new THREE.Mesh(discG, new THREE.MeshStandardMaterial({ color: 0xffffff, map: discTexture(), roughness: 0.4, metalness: 0.9 })); discM.position.z = W * 0.1; spin.add(discM);
  // face
  const r0 = R * 0.17, r1 = rimR * 0.97;
  if (style === "mesh") {
    const m = new THREE.Mesh(new THREE.CircleGeometry(rimR * 0.97, 48), new THREE.MeshStandardMaterial({ color: new THREE.Color(rimColor), roughness: 0.25, metalness: 0.95, envMap, envMapIntensity: 1.4, alphaMap: meshTexture(), alphaTest: 0.5, side: THREE.DoubleSide }));
    m.position.z = faceZ; spin.add(m);
    const m2 = m.clone(); m2.position.z = faceZ - W * 0.06; m2.scale.setScalar(0.96); spin.add(m2);
  } else if (style === "deep") {
    const dp = [[R * 0.13, faceZ - W * 0.16], [R * 0.2, faceZ - W * 0.14], [rimR * 0.4, faceZ - W * 0.2], [rimR * 0.78, faceZ - W * 0.12], [rimR * 0.97, faceZ + W * 0.05], [rimR * 1.0, W * 0.4]];
    const dg = new THREE.LatheGeometry(dp.map(([r, z]) => new THREE.Vector2(r, z)), 48); dg.rotateX(Math.PI / 2);
    spin.add(new THREE.Mesh(dg, new THREE.MeshStandardMaterial({ color: new THREE.Color(rimColor), roughness: 0.22, metalness: 0.96, envMap, envMapIntensity: 1.5, side: THREE.DoubleSide })));
  } else {
    const n = { fivespoke: 5, ten: 10, turbine: 12, star: 7, classic: 6, multi: 18, split: 5, blade: 9 }[style] ?? 5;
    const depth = W * (style === "ten" || style === "multi" ? 0.04 : 0.05);
    const parts = [];
    for (let k = 0; k < n; k++) { const g = shapeGeo(spokeShape(style, r0, r1), depth, 0.004); rotZ(g, (k / n) * Math.PI * 2); g.translate(0, 0, faceZ - depth / 2); parts.push(g); }
    if (style === "multi" || style === "classic") { const ring = new THREE.RingGeometry(rimR * (style === "multi" ? 0.6 : 0.8), rimR * (style === "multi" ? 0.66 : 0.88), 48); ring.translate(0, 0, faceZ + depth / 2 + 0.002); parts.push(ring); }
    if (style === "ten") { const ring = new THREE.RingGeometry(rimR * 0.62, rimR * 0.68, 48); ring.translate(0, 0, faceZ + depth / 2 + 0.002); parts.push(ring); }
    const sg = merge(parts); spin.add(new THREE.Mesh(sg, rm));
  }
  // hub, centre cap and lug nuts
  const hubG = new THREE.CylinderGeometry(R * 0.15, R * 0.17, W * 0.12, 24); hubG.rotateX(Math.PI / 2); hubG.translate(0, 0, faceZ);
  const capG = new THREE.CylinderGeometry(R * 0.08, R * 0.1, W * 0.05, 24); capG.rotateX(Math.PI / 2); capG.translate(0, 0, faceZ + W * 0.07);
  spin.add(new THREE.Mesh(merge([hubG, capG]), rm));
  const nuts = []; const nn = style === "deep" ? 6 : 5;
  for (let k = 0; k < nn; k++) { const a = (k / nn) * Math.PI * 2 + 0.3; const g = new THREE.CylinderGeometry(R * 0.022, R * 0.022, W * 0.07, 6); g.rotateX(Math.PI / 2); g.translate(Math.cos(a) * R * 0.115, Math.sin(a) * R * 0.115, faceZ + W * 0.05); nuts.push(g); }
  spin.add(new THREE.Mesh(merge(nuts), M.chromeLike));
  return spin;
}

// brake caliper (a rounded block with slots) — rides on the steering pivot, does not spin
export function makeCaliper(R, W, color) {
  const sh = new THREE.Shape(); const w = R * 0.56, h = R * 0.4, r = h * 0.4;
  sh.moveTo(-w / 2 + r, -h / 2); sh.lineTo(w / 2 - r, -h / 2); sh.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); sh.lineTo(w / 2, h / 2 - r); sh.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2); sh.lineTo(-w / 2 + r, h / 2); sh.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r); sh.lineTo(-w / 2, -h / 2 + r); sh.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const g = new THREE.ExtrudeGeometry(sh, { depth: W * 0.2, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 8 });
  g.translate(0, 0, -W * 0.1);
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.32, metalness: 0.4 }));
  return m;
}

// ------------------------------------------------------------------ lamps
// Local frame for lamps: +y = out of the body surface, +x = along the surface (forward on a nose, up on a tail), +z = lateral (outward on the right side).
// The left side is a mirror (scale.z = -1). Lens discs face +y (cylinder default axis).
const disc = (r, h = 0.012, seg = 24) => new THREE.CylinderGeometry(r, r, h, seg);
const ringY = (r, t = 0.008, seg = 28) => { const g = new THREE.TorusGeometry(r, t, 6, seg); g.rotateX(Math.PI / 2); return g; };
export function makeHeadlamp(style, len, wid, glowCol = 0xcfeaff, envMap = null) {
  const g = new THREE.Group(); const M = partMats();
  const dark = new THREE.MeshStandardMaterial({ color: 0x07080d, roughness: 0.05, metalness: 1, envMap, envMapIntensity: 1.7 });
  const reflector = new THREE.MeshStandardMaterial({ color: 0x9aa0b4, roughness: 0.12, metalness: 1, envMap, envMapIntensity: 1.4 });
  const cover = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.12, envMap, envMapIntensity: 2.4, clearcoat: 1, depthWrite: false });
  const lens = M.lampWarm, drl = M.lampCool;
  const add = (geo, mat, x = 0, y = 0, z = 0, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; };
  const pod = (l, w, ry = 0, x = 0, z = 0) => { const e = new THREE.SphereGeometry(0.5, 28, 12); e.scale(l, 0.05, w); add(e, dark, x, 0.0, z, ry); const c = new THREE.SphereGeometry(0.5, 28, 12); c.scale(l * 1.02, 0.07, w * 1.02); add(c, cover, x, 0.004, z, ry); };
  if (style === "round") {
    for (const zz of [-wid * 0.24, wid * 0.24]) {
      const r = wid * 0.2; pod(r * 2.1, r * 2.1, 0, 0, zz);
      add(disc(r * 1.4, 0.008), reflector, 0, 0.022, zz).scale.set(1, 1, 1); add(disc(r * 0.7, 0.014), lens, 0, 0.03, zz);
      add(ringY(r * 1.0, 0.009), M.chromeLike, 0, 0.026, zz); add(ringY(r * 1.22, 0.006), drl, 0, 0.022, zz);
    }
  } else if (style === "quad") {
    pod(len, wid);
    for (let k = 0; k < 4; k++) { const zz = (k - 1.5) * wid * 0.2; const r = wid * 0.075; add(disc(r * 1.4, 0.008), reflector, 0, 0.022, zz); add(disc(r, 0.014), lens, 0, 0.03, zz); add(ringY(r * 1.2, 0.006), M.chromeLike, 0, 0.026, zz); }
    add(new THREE.BoxGeometry(len * 0.8, 0.006, wid * 0.03), drl, -len * 0.18, 0.026, 0);
  } else if (style === "wide") {
    pod(len, wid);
    const r = wid * 0.14; add(disc(r * 1.4, 0.008), reflector, len * 0.04, 0.022, -wid * 0.2); add(disc(r, 0.014), lens, len * 0.04, 0.03, -wid * 0.2); add(ringY(r * 1.2, 0.007), M.chromeLike, len * 0.04, 0.026, -wid * 0.2);
    const r2 = wid * 0.09; add(disc(r2 * 1.4, 0.008), reflector, len * 0.04, 0.022, wid * 0.14); add(disc(r2, 0.014), lens, len * 0.04, 0.03, wid * 0.14);
    add(new THREE.BoxGeometry(len * 0.86, 0.006, wid * 0.045), drl, -len * 0.3, 0.026, 0); add(new THREE.BoxGeometry(len * 0.04, 0.006, wid * 0.86), drl, len * 0.4, 0.026, 0);
  } else { // slit: a swept dagger with one big projector and a long daylight blade
    pod(len * 1.3, wid * 1.25, -0.28);
    const r = wid * 0.22; add(disc(r * 1.35, 0.008), reflector, len * 0.12, 0.022, wid * 0.16); add(disc(r, 0.014), lens, len * 0.12, 0.03, wid * 0.16); add(ringY(r * 1.15, 0.008), M.chromeLike, len * 0.12, 0.026, wid * 0.16);
    add(new THREE.BoxGeometry(len * 0.6, 0.006, wid * 0.06), drl, -len * 0.14, 0.026, -wid * 0.3, -0.28);
    add(new THREE.BoxGeometry(len * 0.36, 0.006, wid * 0.045), drl, -len * 0.18, 0.026, -wid * 0.14, -0.28);
  }
  return g;
}

// Rear lamp cluster. `tailMat` is the car's shared brake-light material (it brightens when braking).
export function makeTaillamp(style, len, wid, tailMat) {
  const g = new THREE.Group(); const M = partMats();
  const hous = new THREE.MeshStandardMaterial({ color: 0x1a0508, roughness: 0.25, metalness: 0.7 });
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  const gl = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, transparent: true, opacity: 0.14, clearcoat: 1, depthWrite: false });
  const body = (l, w) => { const e = new THREE.SphereGeometry(0.5, 24, 10); e.scale(l, 0.04, w); add(e, hous, 0, 0, 0); const c = new THREE.SphereGeometry(0.5, 24, 10); c.scale(l * 1.02, 0.06, w * 1.02); add(c, gl, 0, 0.004, 0); };
  if (style === "round") {
    body(len * 1.3, wid);
    const r = Math.min(wid * 0.42, len * 0.62); add(disc(r * 1.15, 0.008), hous, 0, 0.016, 0); add(disc(r, 0.01), tailMat, 0, 0.02, 0); add(ringY(r * 1.05, 0.007), M.chromeLike, 0, 0.022, 0);
    add(disc(r * 0.45, 0.012), M.black, 0, 0.026, 0); add(disc(r * 0.2, 0.012), M.amber, len * 0.0, 0.03, 0);
    add(new THREE.BoxGeometry(len * 0.22, 0.008, wid * 0.22), M.amber, -len * 0.5, 0.02, wid * 0.32);
  } else if (style === "split") {
    body(len * 1.2, wid);
    for (let k = 0; k < 5; k++) add(new THREE.BoxGeometry(len * 0.9, 0.01, wid * 0.12), tailMat, 0, 0.02, (k - 2) * wid * 0.19);
    add(new THREE.BoxGeometry(len * 0.25, 0.01, wid * 0.1), M.amber, len * 0.4, 0.02, wid * 0.4);
  } else { // bar
    body(len * 1.2, wid);
    add(new THREE.BoxGeometry(len * 0.5, 0.01, wid * 0.94), tailMat, -len * 0.16, 0.02, 0);
    for (let k = 0; k < 6; k++) add(new THREE.BoxGeometry(len * 0.16, 0.012, wid * 0.1), tailMat, len * 0.22, 0.022, (k - 2.5) * wid * 0.16);
    add(new THREE.BoxGeometry(len * 0.12, 0.01, wid * 0.14), M.reverse, len * 0.42, 0.022, -wid * 0.42);
  }
  return g;
}

// ------------------------------------------------------------------ interior
let _gaugeTex = null;
function gaugeTexture() {
  if (_gaugeTex) return _gaugeTex;
  _gaugeTex = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = "#04070a"; g.fillRect(0, 0, w, h);
    for (const [cx, col] of [[64, "#2de2ff"], [192, "#ff7a2a"]]) {
      g.strokeStyle = col; g.lineWidth = 5; g.beginPath(); g.arc(cx, 66, 46, Math.PI * 0.8, Math.PI * 2.2); g.stroke();
      g.lineWidth = 2; for (let i = 0; i <= 10; i++) { const a = Math.PI * 0.8 + (i / 10) * Math.PI * 1.4; g.beginPath(); g.moveTo(cx + Math.cos(a) * 38, 66 + Math.sin(a) * 38); g.lineTo(cx + Math.cos(a) * 46, 66 + Math.sin(a) * 46); g.stroke(); }
      g.strokeStyle = "#ff2a2a"; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, 66); g.lineTo(cx + Math.cos(Math.PI * 1.55) * 40, 66 + Math.sin(Math.PI * 1.55) * 40); g.stroke();
    }
    g.fillStyle = "#8affc0"; g.font = "bold 14px monospace"; g.textAlign = "center"; g.fillText("N", 128, 76);
  }, true, 4);
  return _gaugeTex;
}
// A driver's cockpit: dash with lit gauges, wheel, two bucket seats, optional rear bench / roll cage. x from the cabin's rear to front.
export function makeInterior(cabX0, cabX1, belt, roof, halfW, opts = {}) {
  const g = new THREE.Group(); const M = partMats();
  const dark = new THREE.MeshStandardMaterial({ color: 0x0e0f13, roughness: 0.75, metalness: 0.1 });
  const seatM = new THREE.MeshStandardMaterial({ color: opts.seat || 0x16181f, roughness: 0.6, metalness: 0.1 });
  const trim = new THREE.MeshStandardMaterial({ color: opts.trim || 0xc23a2a, roughness: 0.55, metalness: 0.1 });
  const span = cabX1 - cabX0, floor = belt - 0.36;
  const xs = (f) => cabX0 + span * f;
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m; };
  const rbox = (l, h, w, r = 0.03) => { const s = new THREE.Shape(); const hw2 = w / 2; s.moveTo(-hw2 + r, -h / 2); s.lineTo(hw2 - r, -h / 2); s.quadraticCurveTo(hw2, -h / 2, hw2, -h / 2 + r); s.lineTo(hw2, h / 2 - r); s.quadraticCurveTo(hw2, h / 2, hw2 - r, h / 2); s.lineTo(-hw2 + r, h / 2); s.quadraticCurveTo(-hw2, h / 2, -hw2, h / 2 - r); s.lineTo(-hw2, -h / 2 + r); s.quadraticCurveTo(-hw2, -h / 2, -hw2 + r, -h / 2); const eg = new THREE.ExtrudeGeometry(s, { depth: l, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 5 }); eg.translate(0, 0, -l / 2); eg.rotateY(Math.PI / 2); return eg; };
  // floor and tub
  add(new THREE.BoxGeometry(span * 0.96, 0.03, halfW * 1.7), dark, xs(0.5), floor, 0);
  // dashboard + cluster
  const dx = xs(0.88);
  add(rbox(0.34, 0.2, halfW * 1.7, 0.06), dark, dx, belt - 0.12, 0, 0, 0, -0.12);
  const gm = new THREE.MeshBasicMaterial({ map: gaugeTexture() });
  add(new THREE.PlaneGeometry(0.34, 0.17), gm, dx - 0.2, belt - 0.02, halfW * 0.42, 0, -Math.PI / 2, -0.35);
  add(rbox(0.1, 0.08, halfW * 0.5, 0.03), dark, dx - 0.1, belt - 0.03, -halfW * 0.1);
  // steering wheel on a column
  const sz = halfW * 0.42;
  { const w = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.017, 10, 28), M.black); w.position.set(dx - 0.25, belt - 0.02, sz); w.rotation.set(0, Math.PI / 2, 0); w.rotateX(-0.5); g.add(w); }
  add(new THREE.CylinderGeometry(0.026, 0.03, 0.12, 10).rotateZ(Math.PI / 2), M.black, dx - 0.16, belt - 0.08, sz, 0, 0, -0.5);
  // seats (sized to the low cabin: the head rests just clear of the roof)
  const seatX = xs(0.5); const H = Math.max(0.1, roof - belt);
  for (const sd of [-1, 1]) {
    add(rbox(0.44, 0.1, 0.4, 0.04), seatM, seatX, belt - 0.2, sd * halfW * 0.42);
    add(rbox(0.1, 0.3 + H * 0.4, 0.4, 0.04), seatM, seatX - 0.22, belt - 0.08 + H * 0.2, sd * halfW * 0.42, 0, 0, -0.2);
    add(rbox(0.09, 0.14, 0.26, 0.04), seatM, seatX - 0.27, belt + H * 0.6, sd * halfW * 0.42, 0, 0, -0.16);
    add(new THREE.BoxGeometry(0.02, 0.3, 0.05), trim, seatX - 0.285, belt + H * 0.05, sd * halfW * 0.42 + 0.15, 0, 0, -0.2);
  }
  if (!opts.noRear) add(rbox(0.3, 0.3, halfW * 1.3, 0.05), seatM, xs(0.12), belt - 0.1, 0, 0, 0, -0.12);
  // centre tunnel with shifter
  add(rbox(span * 0.45, 0.1, 0.18, 0.04), dark, xs(0.62), floor + 0.1, 0);
  add(new THREE.CylinderGeometry(0.014, 0.014, 0.17, 8), M.chromeLike, xs(0.6), floor + 0.23, 0);
  if (opts.cage) { // roll cage tubes
    const tube = (a, b, r = 0.016) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b); const dir = B.clone().sub(A); const len = dir.length(); const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), M.darkMetal); m.position.copy(A.clone().add(B).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()); g.add(m); };
    for (const sd of [-1, 1]) { tube([xs(0.35), floor, sd * halfW * 0.85], [xs(0.38), roof - 0.05, sd * halfW * 0.8]); tube([xs(0.38), roof - 0.05, sd * halfW * 0.8], [xs(0.85), belt + 0.05, sd * halfW * 0.85]); }
    tube([xs(0.38), roof - 0.05, -halfW * 0.8], [xs(0.38), roof - 0.05, halfW * 0.8]);
  }
  return g;
}

// ------------------------------------------------------------------ the world seen in the paint
// A dark night-city dome: a horizon glow, a skyline with lit windows, rows of sodium street lamps, neon signs, a moon and a soft overhead panel.
export function makeCityEnv(renderer, pal = {}) {
  const pm = new THREE.PMREMGenerator(renderer);
  const es = new THREE.Scene(); const E = pal.tod || { top: 0x0b1230, mid: 0x4b1e55, hor: 0xff7a4a, low: 0x07080f, bandK: 1.5, skyK: 0.9, bld: 1, win: 1, lamp: 1, neon: 1, sun: null, box: [0xdde6ff, 2.4], strip: 1, floor: 0x07080d, moon: true };
  // sky dome with a vertical gradient (zenith indigo -> horizon magenta/orange -> dark ground)
  const sky = new THREE.SphereGeometry(300, 32, 20); const cols = []; const p = sky.attributes.position; const top = new THREE.Color(E.top), mid = new THREE.Color(E.mid), hor = new THREE.Color(E.hor), low = new THREE.Color(E.low);
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) / 300; const c = new THREE.Color();
    if (y > 0.25) c.copy(mid).lerp(top, Math.min(1, (y - 0.25) / 0.6)); else if (y > 0.02) c.copy(hor).lerp(mid, (y - 0.02) / 0.23); else if (y > -0.05) c.copy(low).lerp(hor, (y + 0.05) / 0.07 * 0.85); else c.copy(low);
    c.multiplyScalar(y > -0.05 && y < 0.25 ? E.bandK : E.skyK); cols.push(c.r, c.g, c.b);
  }
  sky.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  es.add(new THREE.Mesh(sky, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  let seed = 90210; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  // skyline
  const nB = 130; const bgeo = new THREE.BoxGeometry(1, 1, 1);
  const bm = new THREE.InstancedMesh(bgeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), nB); const wins = [];
  const mt = new THREE.Matrix4(), cc = new THREE.Color();
  for (let i = 0; i < nB; i++) {
    const a = rnd() * Math.PI * 2, d = 90 + rnd() * 70, h = 20 + Math.pow(rnd(), 1.6) * 120, w = 10 + rnd() * 22;
    mt.makeScale(w, h, w * (0.7 + rnd() * 0.6)); mt.setPosition(Math.cos(a) * d, h / 2 - 2, Math.sin(a) * d); bm.setMatrixAt(i, mt); bm.setColorAt(i, cc.setRGB((0.012 + rnd() * 0.02) * E.bld, (0.014 + rnd() * 0.02) * E.bld, (0.03 + rnd() * 0.03) * E.bld));
    const nw = Math.floor(h * w / 70);
    for (let k = 0; k < nw; k++) wins.push([Math.cos(a) * (d - w * 0.5 - 0.3) + (rnd() - 0.5) * w * 0.7, 2 + rnd() * (h - 4), Math.sin(a) * (d - w * 0.5 - 0.3) + (rnd() - 0.5) * w * 0.7, a, rnd()]);
  }
  es.add(bm);
  const wgeo = new THREE.PlaneGeometry(2.2, 1.4); const wm = new THREE.InstancedMesh(wgeo, new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }), wins.length);
  wins.forEach((w, i) => { mt.makeRotationY(-w[3] + Math.PI / 2); mt.setPosition(w[0], w[1], w[2]); wm.setMatrixAt(i, mt); const warm = w[4] < 0.62; wm.setColorAt(i, (warm ? cc.setRGB(5.2, 3.6, 1.7) : w[4] < 0.85 ? cc.setRGB(2.4, 3.8, 5.6) : cc.setRGB(5.2, 1.4, 3.4)).multiplyScalar(E.win)); });
  es.add(wm);
  // sodium street-lamp rows (bright warm dots in two lines) + white LED lamps
  const lg = new THREE.SphereGeometry(0.9, 8, 6);
  for (let row = 0; row < 3; row++) for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2 + row * 0.13; const d = 28 + row * 14; const m = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ color: new THREE.Color(row === 2 ? 0xcfe6ff : 0xffa640).multiplyScalar(14 * E.lamp) })); m.position.set(Math.cos(a) * d, 8 + row * 1.5, Math.sin(a) * d); es.add(m); }
  // neon signs
  const neon = [pal.neonA ?? 0xff2d95, pal.neonB ?? 0x2de2ff, 0xb45cff, 0x6bff6b, 0xffb703];
  for (let i = 0; i < 16; i++) { const a = rnd() * Math.PI * 2, d = 55 + rnd() * 40; const h = 4 + rnd() * 18; const m = new THREE.Mesh(new THREE.BoxGeometry(0.8 + rnd() * 2, h, 0.8), new THREE.MeshBasicMaterial({ color: new THREE.Color(neon[i % neon.length]).multiplyScalar(7 * E.neon) })); m.position.set(Math.cos(a) * d, 10 + rnd() * 14, Math.sin(a) * d); es.add(m); }
  // moon and an overhead softbox so the roof and bonnet get a long clean highlight
  if (E.moon) { const moon = new THREE.Mesh(new THREE.CircleGeometry(9, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xeaf0ff).multiplyScalar(9), side: THREE.DoubleSide })); moon.position.set(-130, 120, 90); moon.lookAt(0, 0, 0); es.add(moon); }
  if (E.sun) { const sn = new THREE.Mesh(new THREE.CircleGeometry(E.sun.r, 28), new THREE.MeshBasicMaterial({ color: new THREE.Color(E.sun.color).multiplyScalar(E.sun.I), side: THREE.DoubleSide })); sn.position.set(E.sun.dir[0] * E.sun.d, E.sun.dir[1] * E.sun.d, E.sun.dir[2] * E.sun.d); sn.lookAt(0, 0, 0); es.add(sn); } // the low sun, so paint and glass pick up its warm glint
  const sb = new THREE.Mesh(new THREE.PlaneGeometry(70, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(E.box[0]).multiplyScalar(E.box[1]), side: THREE.DoubleSide })); sb.position.set(0, 60, 0); sb.rotation.x = Math.PI / 2; es.add(sb);
  // photographer's softboxes: long strips either side and above, plus tall ones fore and aft - they draw the long clean highlights that run down a glossy body
  if (pal.strips !== false) {
    const sk = pal.stripK ?? (typeof globalThis !== "undefined" && globalThis.__MB_STRIPK != null ? globalThis.__MB_STRIPK : 1);
    const strip = (w, h, x, y, z, I) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xeaf0ff).multiplyScalar(I * sk * E.strip), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); es.add(m); };
    strip(170, 3.2, 0, 70, 24, 4.2); strip(170, 3.2, 0, 70, -24, 4.2);   // roof / bonnet: two long highlights running front to back
    strip(170, 3, 0, 38, 40, 3.0); strip(170, 3, 0, 38, -40, 3.0);       // shoulders
    strip(170, 3.5, 0, -6, 46, 3.2); strip(170, 3.5, 0, -6, -46, 3.2);   // low, just under the horizon: what a flank sees when you look down at the car
    strip(170, 3, 0, -13, 40, 2.4); strip(170, 3, 0, -13, -40, 2.4);
    strip(4, 40, 58, 6, 0, 2.4); strip(4, 40, -58, 6, 0, 2.4);           // nose / tail
  }
  // wet street: dark floor with a couple of reflected light streaks
  const fl = new THREE.Mesh(new THREE.CircleGeometry(300, 24), new THREE.MeshBasicMaterial({ color: E.floor })); fl.rotation.x = -Math.PI / 2; fl.position.y = -2; es.add(fl);
  const rt = pm.fromScene(es, 0.02); pm.dispose();
  [sky, bgeo, wgeo, lg].forEach((x) => x.dispose()); bm.dispose(); wm.dispose();
  return rt.texture;
}
