// Midnight Burn: real 3D car models.
//
// Every car in the game is now a hand-modelled GLB (see public/midnightburn/cars and the credits page). This file loads them and turns each one into a
// car the rest of the game already knows how to drive: the same object shape the old code-built cars had, so physics, camera, damage and the garage did not change.
//
// Model convention (every file was prepared the same way): +X is forward, +Y is up, +Z is the right-hand side, the origin sits on the ground in the middle of the car.
// Four wheels are nodes called steer_FL / steer_FR / steer_RL / steer_RR (they turn with the steering) and each holds a spin_XX node (turns as the car rolls).
// Every material is named  <role>__<n>__<original name>  where role is one of: paint, glass, tire, rim, brake, headlight, taillight, plate, chrome, other.
// That is how paint, finish, rims, lights and number plates can be customised on a real model.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { makeWheelModel } from "./carParts";

export const CAR_BASE_URL = "/midnightburn/cars/";

// id (the game's car slot) -> model file, real length in metres, number-plate code, and whether the paint can be changed
export const CAR_MODELS = {
  gecko: { file: "punto", L: 3.8, code: "GKO" },
  kestrel: { file: "m3", L: 4.35, code: "KST" },
  brute: { file: "cutlass", L: 5.5, code: "BRT" },
  seven: { file: "zis", L: 5.4, code: "SVN" },
  stinger: { file: "elise", L: 3.85, code: "STG" },
  rennsport: { file: "porsche930", L: 4.3, code: "RNS" },
  datsun: { file: "datsun", L: 4.14, code: "SNR" },
  c4s: { file: "c4s", L: 4.5, code: "A4S" },
  novagt: { file: "gsport", L: 4.3, code: "NVA" },
  vcoupe: { file: "gcoupe", L: 4.3, code: "VNG" },
  bentley: { file: "bentley", L: 4.9, code: "SVG", fixedPaint: true },
  ctsv: { file: "ctsv", L: 4.9, code: "WHK", fixedPaint: true },
  n74: { file: "n74", L: 4.8, code: "E74", fixedPaint: true },
  racer01: { file: "racer01", L: 4.7, code: "GGT" },
  m2drift: { file: "m2drift", L: 4.5, code: "KZR", fixedPaint: true },
  furai: { file: "furai", L: 4.7, code: "FRX" },
  gt3r: { file: "gt3r", L: 4.6, code: "GT3" },
  lotusf1: { file: "lotusf1", L: 5.5, code: "FL1", fixedPaint: true },
  f1_2026: { file: "f1_2026", L: 5.6, code: "F26", fixedPaint: true },
  frame: { file: "m130", L: 4.6, code: "FRM" },
  exp: { file: "phoenix", L: 5.05, code: "EXP" },
  praga: { file: "mercedes", L: 4.5, code: "PRH" },
  solo: { file: "copvic", L: 5.2, code: "SLO" },
  razor: { file: "m4", L: 4.67, code: "RZR" },
  meteor: { file: "gtr", L: 4.75, code: "MTR" },
  vesper: { file: "gt3rs", L: 4.57, code: "VSP" },
  phantom: { file: "cop71", L: 5.05, code: "PHT" },
  specter: { file: "cyber", L: 4.6, code: "SPC", fixedPaint: true },
  // not for sale: the police units and the rival-only extra
  cop_a: { file: "cop80", L: 5.2, code: "PD" },
  cop_b: { file: "cop71", L: 5.05, code: "PD" },
  cop_c: { file: "copvic", L: 5.2, code: "PD" },
};

const cache = new Map(); // file -> { tpl, promise }
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);

export function loadCarModel(file) {
  let e = cache.get(file);
  if (e) return e.promise;
  e = { tpl: null };
  e.promise = new Promise((resolve, reject) => {
    loader.load(CAR_BASE_URL + file + ".glb", (gltf) => { try { e.tpl = analyse(gltf.scene, file); resolve(e.tpl); } catch (err) { reject(err); } }, undefined, reject);
  });
  cache.set(file, e);
  return e.promise;
}
export function preloadCars(ids) { return Promise.all([...new Set(ids)].map((id) => { const m = CAR_MODELS[id]; return m ? loadCarModel(m.file).catch(() => null) : null; })); }
export const carModelReady = (id) => { const m = CAR_MODELS[id]; const e = m && cache.get(m.file); return !!(e && e.tpl); };

const roleOf = (mat) => (mat && mat.name ? mat.name.split("__")[0] : "other");
const origName = (mat) => (mat && mat.name ? mat.name.split("__").slice(2).join("__") : "");
const HIDE_RE = /badge|logo|emblem/i; // real brand badges are removed: the game has its own name plates

// ---- one-time analysis of a loaded model: roles, wheel sizes, a height profile of the body, and which triangles are the roof, bonnet and mirrors ----
function analyse(scene, file) {
  scene.updateMatrixWorld(true);
  const tpl = { scene, file, wheels: {}, parts: [], plates: [], profile: null };
  const steerNodes = {};
  scene.traverse((o) => { const m = /^steer_(FL|FR|RL|RR)$/.exec(o.name); if (m) steerNodes[m[1]] = o; });
  const insideWheel = (o) => { for (let p = o; p; p = p.parent) if (/^steer_/.test(p.name)) return true; return false; };
  // wheels: radius and width from the tyre geometry
  for (const k of Object.keys(steerNodes)) {
    const sn = steerNodes[k]; const bb = new THREE.Box3();
    sn.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); bb.union(o.geometry.boundingBox); } });
    tpl.wheels[k] = { node: sn, r: Math.max(0.2, (bb.max.y - bb.min.y) / 2), w: Math.max(0.12, bb.max.z - bb.min.z), x: sn.position.x, z: sn.position.z };
  }
  // body statistics from paint + glass (not wheels)
  const verts = []; let xmin = 1e9, xmax = -1e9, ymax = 0, zmax = 0;
  scene.traverse((o) => {
    if (!o.isMesh) return; const role = roleOf(o.material);
    if (insideWheel(o)) return;
    if (role === "paint" || role === "glass" || role === "other" || role === "chrome") {
      const p = o.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); xmin = Math.min(xmin, x); xmax = Math.max(xmax, x); ymax = Math.max(ymax, y); zmax = Math.max(zmax, Math.abs(z)); if (role === "paint") verts.push(x, y, z); }
    }
  });
  const BIN = 0.12, nb = Math.max(2, Math.ceil((xmax - xmin) / BIN));
  const top = new Float32Array(nb).fill(-1), wid = new Float32Array(nb);
  for (let i = 0; i < verts.length; i += 3) { const b = Math.min(nb - 1, Math.floor((verts[i] - xmin) / BIN)); if (Math.abs(verts[i + 2]) < 0.4 * zmax && verts[i + 1] > top[b]) top[b] = verts[i + 1]; if (verts[i + 1] > 0.18 && Math.abs(verts[i + 2]) > wid[b]) wid[b] = Math.abs(verts[i + 2]); }
  for (let b = 0; b < nb; b++) if (top[b] < 0) { let d = 1; while (d < nb) { if (b - d >= 0 && top[b - d] >= 0) { top[b] = top[b - d]; break; } if (b + d < nb && top[b + d] >= 0) { top[b] = top[b + d]; break; } d++; } }
  const at = (arr, x) => arr[Math.max(0, Math.min(nb - 1, Math.floor((x - xmin) / BIN)))];
  // the windscreen and rear glass: tall glass only (the headlight lenses are glass too)
  let cabF = -1e9, cabR = 1e9;
  scene.traverse((o) => { if (!o.isMesh || insideWheel(o) || roleOf(o.material) !== "glass") return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i++) if (p.getY(i) > 0.58 * ymax) { cabF = Math.max(cabF, p.getX(i)); cabR = Math.min(cabR, p.getX(i)); } });
  if (cabF < cabR) { cabF = xmin + (xmax - xmin) * 0.62; cabR = xmin + (xmax - xmin) * 0.25; }
  tpl.profile = { xmin, xmax, ymax, halfW: zmax, deck: (x) => at(top, x), width: (x) => at(wid, x) || zmax * 0.9, cabF, cabR };
  // split the paint into body / roof / bonnet / mirrors so each can be changed on its own, and give it unwrapped coordinates for the livery
  const yc = ymax / 2, hh = ymax / 2, hw = zmax || 1, uL = Math.max(0.1, xmax - xmin);
  scene.traverse((o) => {
    if (!o.isMesh) return; const role = roleOf(o.material);
    const nm = origName(o.material);
    if (HIDE_RE.test(nm)) { o.userData.hidden = true; o.visible = false; return; }
    if (role === "plate" && !insideWheel(o)) { o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox; tpl.plates.push({ mesh: o, cx: (bb.min.x + bb.max.x) / 2, cy: (bb.min.y + bb.max.y) / 2, cz: (bb.min.z + bb.max.z) / 2, dz: bb.max.z - bb.min.z, dy: bb.max.y - bb.min.y, dx: bb.max.x - bb.min.x }); o.visible = false; return; }
    if (role !== "paint" || insideWheel(o)) return;
    const g = o.geometry.clone(); const p = g.attributes.position; const n = g.attributes.normal; const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) { const sn = (p.getY(i) - yc) / hh, cs = p.getZ(i) / hw; let th = Math.atan2(sn, cs); if (th < -Math.PI / 2) th += Math.PI * 2; uv[i * 2] = (p.getX(i) - xmin) / uL; uv[i * 2 + 1] = (th + Math.PI / 2) / (Math.PI * 2); }
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    const idx = g.index ? Array.from(g.index.array) : Array.from({ length: p.count }, (_, i) => i);
    const body = [], roof = [], hood = [], mirror = [];
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      const cx = (p.getX(a) + p.getX(b) + p.getX(c)) / 3, cy = (p.getY(a) + p.getY(b) + p.getY(c)) / 3, cz = (p.getZ(a) + p.getZ(b) + p.getZ(c)) / 3;
      const ny = n ? (n.getY(a) + n.getY(b) + n.getY(c)) / 3 : 0;
      const wAt = tpl.profile.width(cx);
      if (cy > 0.9 * ymax && ny > 0.45 && cx > cabR - 0.1 && cx < cabF + 0.1 && Math.abs(cz) < 0.8 * wAt) roof.push(a, b, c);
      else if (ny > 0.62 && cx > cabF + 0.12 && cx < xmax - 0.45 && Math.abs(cz) < 0.72 * wAt && cy > tpl.profile.deck(cx) - 0.14) hood.push(a, b, c);
      else if (cy > 0.52 * ymax && cy < 0.86 * ymax && cx > cabF - 0.75 && cx < cabF + 0.12 && Math.abs(cz) > wAt * 1.0 && Math.abs(cz) > 0.9 * zmax * 0.985) mirror.push(a, b, c);
      else body.push(a, b, c);
    }
    tpl.parts.push({ mesh: o, geo: g, body, roof, hood, mirror });
  });
  return tpl;
}

const canvasTexture = (w, h, draw) => { const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
function plateTexture(txt) {
  return canvasTexture(256, 64, (x) => {
    x.fillStyle = "#f3f1e6"; x.fillRect(0, 0, 256, 64); x.strokeStyle = "#111"; x.lineWidth = 4; x.strokeRect(2, 2, 252, 60);
    x.fillStyle = "#0a3d91"; x.fillRect(6, 6, 22, 52); x.fillStyle = "#fff"; x.font = "bold 11px Arial"; x.textAlign = "center"; x.fillText("MB", 17, 36);
    x.fillStyle = "#111"; x.font = "bold 40px 'Arial Black', Impact, sans-serif"; x.textBaseline = "middle"; x.fillText(txt, 146, 34);
  });
}

// ---------------------------------------------------------------- build one car
// helpers come from cars.js (paint, finishes, glass, livery) so the garage options keep working exactly as before
export function createGlbCar(spec, opts, H) {
  const info = CAR_MODELS[spec.car] || CAR_MODELS.kestrel;
  const envMap = opts.envMap || null;
  const g = new THREE.Group(); g.rotation.order = "YXZ";
  const shell = new THREE.Group(); g.add(shell);
  const paint = info.fixedPaint ? null : H.paintMaterial(spec, envMap);
  const mats = []; // everything this car owns (disposed with it)
  const geoms = [];
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xb81616 });
  const L = info.L, halfW = 0.95;
  const stance = H.STANCES.find((s) => s.id === spec.stance) || H.STANCES[0];
  shell.position.y = stance.dy;
  const wheels = [];
  let glow = null, pool = null;
  const glowSpec = H.GLOWS.find((x) => x.id === spec.glow) || H.GLOWS[0];
  if (opts.glowTex && spec.glow !== "off") {
    const gc = glowSpec.color ?? new THREE.Color(spec.color).getHex();
    glow = new THREE.Mesh(new THREE.PlaneGeometry(L * 1.12, halfW * 2.7), new THREE.MeshBasicMaterial({ map: opts.glowTex, color: gc, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.06; g.add(glow);
  }
  if (opts.poolTex) {
    pool = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), new THREE.MeshBasicMaterial({ map: opts.poolTex, color: 0xffe9b8, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(L / 2 + 7.5, 0.05, 0); g.add(pool);
  }
  const arch = { L, halfW };
  g.userData = { stanceDy: stance.dy, wheels, glow, shell, tailMat, pool, paint, noseX: L / 2, tailX: -L / 2, spec, arch, ready: false,
    dispose() { geoms.forEach((x) => x.dispose()); mats.forEach((m) => { if (m.map && m.map.userData && m.map.userData.own) m.map.dispose(); m.dispose(); }); if (paint) paint.dispose(); tailMat.dispose(); if (glow) { glow.geometry.dispose(); glow.material.dispose(); } if (pool) { pool.geometry.dispose(); pool.material.dispose(); } } };

  const populate = (tpl) => {
    if (g.userData.disposed) return;
    const P = tpl.profile; const model = tpl.scene.clone(true);
    const lensSpec = H.LIGHTS.find((l) => l.id === spec.lights) || H.LIGHTS[0];
    const tint = H.TINTS.find((t) => t.id === spec.tint) || H.TINTS[0];
    const own = (m) => { mats.push(m); return m; };
    const glass = own(new THREE.MeshPhysicalMaterial({ color: tint.color, roughness: tint.mirror ? 0.02 : 0.05, metalness: tint.mirror ? 1 : 0.5, envMap, envMapIntensity: tint.mirror ? 2.6 : 1.6, clearcoat: 1, clearcoatRoughness: 0.02, transparent: !tint.mirror, opacity: tint.mirror ? 1 : 0.86, side: THREE.DoubleSide }));
    const rimCol = new THREE.Color(spec.rims.color);
    const rimMat = own(new THREE.MeshStandardMaterial({ color: rimCol, roughness: 0.22, metalness: 0.95, envMap, envMapIntensity: 1.4 }));
    const headMat = own(new THREE.MeshStandardMaterial({ color: lensSpec.lens, emissive: lensSpec.lens, emissiveIntensity: 0.7, roughness: 0.2, envMap, envMapIntensity: 1 }));
    const calMat = spec.caliper && spec.caliper !== "auto" ? own(new THREE.MeshStandardMaterial({ color: spec.caliper, roughness: 0.4, metalness: 0.5 })) : null;
    const style = spec.rims.style || "oem";
    const customWheels = style !== "oem";
    const tune = (o) => { // materials by role
      const role = roleOf(o.material);
      if (role === "glass") { const nm = origName(o.material); o.material = /head|light|lamp|turn|signal|blink|rev|brake|tail/i.test(nm) ? o.material : glass; o.renderOrder = 3; }
      else if (role === "rim") o.material = rimMat;
      else if (role === "headlight") o.material = headMat;
      else if (role === "taillight") o.material = tailMat;
      else if (role === "brake" && calMat) o.material = calMat;
      else if (role === "paint") o.visible = false; // replaced below by the split paint parts
      if (o.material && o.material.isMeshStandardMaterial && o.material.envMap !== envMap && role !== "paint") { o.material = o.material.clone(); o.material.envMap = envMap; o.material.envMapIntensity = Math.max(o.material.envMapIntensity || 1, 0.9); mats.push(o.material); }
    };
    model.traverse((o) => { if (o.isMesh) { if (o.userData.hidden) { o.visible = false; return; } tune(o);
      // stray glow left on non-lamp parts (interior, logos, lenses) would show up as bright white blobs
      if (!info.fixedPaint && o.material && o.material.emissive && o.material.emissive.getHex() !== 0 && o.material !== headMat && o.material !== tailMat) { if (o.material.userData && o.material.userData.glowFixed) return; o.material = o.material.clone(); o.material.emissive.setScalar(0); o.material.userData = { glowFixed: true }; mats.push(o.material); } } });
    // the body part of the model carries every non-wheel piece
    const bodyNode = model.getObjectByName("body") || model;
    // remove the original paint meshes (they are invisible clones); add our split paint parts
    const paintGroup = new THREE.Group(); bodyNode.add(paintGroup);
    const carbon = H.carbonMat(); mats.push(carbon);
    const black = own(new THREE.MeshPhysicalMaterial({ color: 0x0a0a0e, roughness: 0.28, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.03, envMap, envMapIntensity: 1.2 }));
    const white = own(new THREE.MeshPhysicalMaterial({ color: 0xf2f2f2, roughness: 0.28, metalness: 0.5, clearcoat: 1, clearcoatRoughness: 0.03, envMap, envMapIntensity: 1.2 }));
    const pick = (what, id) => (id === "black" ? black : id === "white" ? white : id === "carbon" ? carbon : paint);
    let liveryTex = null, liveryMat = null;
    if (!info.fixedPaint && spec.livery?.type && spec.livery.type !== "none") { liveryTex = H.liveryTexture(spec.livery, spec.number); liveryTex.userData.own = true; liveryMat = own(new THREE.MeshStandardMaterial({ map: liveryTex, transparent: true, roughness: 0.35, metalness: 0.3, envMap, envMapIntensity: 0.8, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, depthWrite: false })); }
    if (!info.fixedPaint) for (const part of tpl.parts) {
      const mk = (idxArr, mat) => { if (!idxArr.length) return null; const gg = new THREE.BufferGeometry(); for (const k of ["position", "normal", "uv"]) if (part.geo.attributes[k]) gg.setAttribute(k, part.geo.attributes[k]); gg.setIndex(idxArr); geoms.push(gg); const m = new THREE.Mesh(gg, mat); paintGroup.add(m); return m; };
      mk(part.body, paint);
      mk(part.roof, spec.roof === "body" ? paint : pick("roof", spec.roof));
      mk(part.hood, spec.hood === "carbon" ? carbon : paint);
      mk(part.mirror, spec.mirrors === "black" ? black : spec.mirrors === "carbon" ? carbon : paint);
      if (liveryMat) { const ov = mk(part.body.concat(part.roof, part.hood), liveryMat); if (ov) { ov.renderOrder = 2; ov.scale.set(1.0015, 1.003, 1.003); } }
    }
    // number plates: the game's own, in place of the model's
    const plateTxt = "MB " + String(spec.number ?? 7).padStart(2, "0") + " " + info.code;
    const plateTex = plateTexture(plateTxt); plateTex.userData.own = true;
    const plateMat = own(new THREE.MeshStandardMaterial({ map: plateTex, roughness: 0.5, metalness: 0.1 })); plateMat.map = plateTex;
    for (const pl of tpl.plates) {
      const front = pl.cx > 0; const w = Math.min(0.56, Math.max(0.36, Math.max(pl.dz, pl.dy) * 1.0)), h = w * 0.25;
      const geo = new THREE.PlaneGeometry(w, h); geoms.push(geo); const m = new THREE.Mesh(geo, plateMat);
      m.position.set(pl.cx + (front ? 0.006 : -0.006), pl.cy, pl.cz); m.rotation.y = front ? Math.PI / 2 : -Math.PI / 2; bodyNode.add(m);
    }
    // wheels: the steer_/spin_ nodes move out of the body so the body can sit lower or lean without dragging the tyres through the road
    const camberRad = (H.CAMBERS.find((c) => c.id === (spec.camber | 0)) || H.CAMBERS[0]).deg * Math.PI / 180;
    const rimK = (H.RIM_SIZES.find((z) => z.id === (spec.rims.size ?? 1)) || H.RIM_SIZES[1]).k;
    for (const key of ["FL", "FR", "RL", "RR"]) {
      const info2 = tpl.wheels[key]; if (!info2) continue;
      const sn = model.getObjectByName("steer_" + key); if (!sn) continue; const spin = sn.getObjectByName("spin_" + key) || sn;
      sn.parent && sn.parent.remove(sn); g.add(sn);
      const side = info2.z >= 0 ? 1 : -1;
      sn.rotation.x = -side * camberRad;
      let dir = 1;
      if (customWheels) {
        spin.traverse((o) => { if (o.isMesh) { const r = roleOf(o.material); if (r === "tire" || r === "rim" || r === "brake") o.visible = false; } });
        const wm = makeWheelModel(style, spec.rims.color, info2.r, info2.w, envMap, rimK);
        if (side < 0) wm.rotation.y = Math.PI;
        spin.add(wm); wm.traverse((o) => { if (o.geometry) geoms.push(o.geometry); });
        dir = side < 0 ? -1 : 1;
      }
      wheels.push({ pivot: sn, spin, front: key[0] === "F", r: info2.r, dir });
    }
    // a wing / kit / bonnet / exhaust built from the body's own measurements
    addons(shell, bodyNode, tpl, spec, H, paint, carbon, own, geoms, envMap);
    shell.add(bodyNode);
    g.userData.roofY = P.ymax; g.userData.ready = true;
    if (opts.onReady) opts.onReady(g);
  };

  const e = cache.get(info.file);
  if (e && e.tpl) populate(e.tpl); else loadCarModel(info.file).then(populate).catch((err) => { console.warn("car model failed", info.file, err); });
  return g;
}

// wing, body kit, bonnet vents/scoop and exhaust tips, all sized from the model (nose and tail position, deck height, width at each point)
function addons(shell, bodyNode, tpl, spec, H, paint, carbon, own, geoms, envMap) {
  const P = tpl.profile; const noseX = P.xmax, tailX = P.xmin; const halfW = P.halfW;
  const cm = carbon, black = own(new THREE.MeshStandardMaterial({ color: 0x07070a, roughness: 0.6, metalness: 0.3 }));
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => { geoms.push(geo); const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); shell.add(m); return m; };
  const deck = (x) => P.deck(x);
  const kit = spec.kit; const kitScale = { street: 1.15, race: 1.6, wide: 1.3, drift: 1.45, attack: 1.9 }[kit] || 1;
  const nw = P.width(noseX - 0.3);
  const wfx = Object.values(tpl.wheels).filter((w) => w.x > 0).map((w) => w.x)[0] ?? noseX - 1, wrx = Object.values(tpl.wheels).filter((w) => w.x < 0).map((w) => w.x)[0] ?? tailX + 1;
  if (kit !== "stock") {
    add(new THREE.BoxGeometry(0.26 * kitScale, 0.025, nw * 2 * 0.92), cm, noseX - 0.2 + 0.05 * (kitScale - 1), 0.11, 0);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.3, 0.02, 0.2), cm, noseX - 0.7, 0.3, s * nw * 0.98, 0, 0, 0.35 * s);
    const sk = (wfx - wrx) * 0.78, mx = (wfx + wrx) / 2, sw = P.width(mx);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(sk, 0.1, 0.07), cm, mx, 0.2, s * (sw - 0.005));
    add(new THREE.BoxGeometry(0.5 * kitScale, 0.05, halfW * 1.35), cm, tailX + 0.22, 0.28, 0, 0, 0, -0.28);
    for (let k = -2; k <= 2; k++) add(new THREE.BoxGeometry(0.4, 0.14, 0.02), cm, tailX + 0.2, 0.34, k * 0.2);
    if (kit === "drift") for (const s of [-1, 1]) add(new THREE.BoxGeometry(sk * 0.95, 0.035, 0.17), cm, mx, 0.14, s * (sw + 0.03));
    if (kit === "attack") {
      for (const s of [-1, 1]) for (const dz of [0, 0.14]) add(new THREE.BoxGeometry(0.28, 0.02, 0.17), cm, noseX - 0.62 + dz, 0.2 + dz * 0.6, s * (nw * 0.97 - dz * 0.6), 0, 0, 0.5 * s);
      add(new THREE.BoxGeometry(0.03, 0.12, nw * 1.7), cm, noseX - 0.14, 0.22, 0);
    }
    if (kit === "wide") for (const key of Object.keys(tpl.wheels)) { const w = tpl.wheels[key]; const s = w.z >= 0 ? 1 : -1; const tg = new THREE.TorusGeometry(w.r * 1.17 + 0.03, 0.045, 8, 30, Math.PI); geoms.push(tg); const fm = new THREE.Mesh(tg, paint); fm.position.set(w.x, w.r, s * (Math.abs(w.z) + w.w / 2 + 0.02)); shell.add(fm); }
  }
  // wing
  const wm = spec.wing; const wx = tailX + 0.42, dy = deck(wx);
  if (wm === "stock") add(new THREE.BoxGeometry(0.5, 0.035, halfW * 1.55), paint, tailX + 0.45, dy + 0.035, 0, 0, 0, 0.18);
  else if (wm === "gt" || wm === "tall") {
    const tall = wm === "tall"; const wy = dy + (tall ? 0.52 : 0.36); const span = halfW * (tall ? 1.85 : 1.7); const ch = tall ? 0.55 : 0.46;
    const prof = new THREE.Shape(); prof.moveTo(0, 0); prof.quadraticCurveTo(ch * 0.4, 0.07, ch, 0.012); prof.lineTo(ch, -0.012); prof.quadraticCurveTo(ch * 0.4, -0.015, 0, -0.012); prof.closePath();
    const wg = new THREE.ExtrudeGeometry(prof, { depth: span, bevelEnabled: false }); wg.translate(-ch / 2, 0, -span / 2);
    add(wg, cm, wx, wy, 0).rotation.z = 0.12;
    for (const s of [-1, 1]) { add(new THREE.BoxGeometry(ch * 1.05, 0.2, 0.025), paint, wx, wy + 0.05, s * span / 2, 0, 0, 0.12); add(new THREE.BoxGeometry(0.06, wy - dy + 0.05, 0.05), cm, wx + 0.02, (wy + dy) / 2, s * halfW * 0.38, 0, 0, -0.1); }
  } else if (wm === "lip") add(new THREE.BoxGeometry(0.2, 0.028, halfW * 1.5), paint, tailX + 0.34, deck(tailX + 0.34) + 0.018, 0, 0, 0, 0.28);
  else if (wm === "dual" || wm === "swan") {
    const wy = dy + (wm === "swan" ? 0.4 : 0.34); const span = halfW * 1.8;
    const plane = (ch, y, x, th = 1) => { const prof = new THREE.Shape(); prof.moveTo(0, 0); prof.quadraticCurveTo(ch * 0.4, 0.07 * th, ch, 0.012); prof.lineTo(ch, -0.012); prof.quadraticCurveTo(ch * 0.4, -0.015, 0, -0.012); prof.closePath(); const wg = new THREE.ExtrudeGeometry(prof, { depth: span, bevelEnabled: false }); wg.translate(-ch / 2, 0, -span / 2); add(wg, cm, x, y, 0).rotation.z = 0.12; };
    plane(wm === "swan" ? 0.5 : 0.46, wy, wx); if (wm === "dual") plane(0.34, wy + 0.17, wx - 0.04, 1.2);
    for (const s of [-1, 1]) { add(new THREE.BoxGeometry(0.5, wm === "dual" ? 0.34 : 0.2, 0.025), paint, wx, wy + (wm === "dual" ? 0.1 : 0.05), s * span / 2, 0, 0, 0.12); add(new THREE.BoxGeometry(0.06, wy - dy + 0.05, 0.05), cm, wx + 0.02, (wy + dy) / 2, s * halfW * 0.38, 0, 0, -0.1); }
  }
  // bonnet vents / scoop
  const hx0 = P.cabF + 0.14, hx1 = noseX - 0.5;
  if (spec.hood && spec.hood !== "stock" && hx1 - hx0 > 0.45) {
    const slopeAt = (x) => Math.atan2(deck(x + 0.15) - deck(x - 0.15), 0.3);
    if (spec.hood === "vent") for (const s of [-1, 1]) { const x = hx0 + (hx1 - hx0) * 0.62, z = s * P.width(x) * 0.3, y = deck(x) + 0.012; add(new THREE.BoxGeometry(0.36, 0.014, 0.17), black, x, y, z).rotation.z = slopeAt(x); for (let k = -2; k <= 2; k++) add(new THREE.BoxGeometry(0.02, 0.022, 0.15), cm, x + k * 0.07, y + 0.01, z).rotation.z = slopeAt(x) - 0.5; }
    if (spec.hood === "scoop") { const x = hx0 + (hx1 - hx0) * 0.5, y = deck(x) - 0.006; const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.5, 0); sh.lineTo(0.5, 0.1); sh.lineTo(0.12, 0.028); sh.lineTo(0, 0); sh.closePath(); const sg = new THREE.ExtrudeGeometry(sh, { depth: 0.34, bevelEnabled: false }); sg.translate(-0.25, 0, -0.17); add(sg, paint, x, y, 0).rotation.z = slopeAt(x); add(new THREE.BoxGeometry(0.014, 0.075, 0.27), black, x + 0.245, y + 0.05, 0).rotation.z = slopeAt(x); }
  }
  // exhaust tips (the stock set is the model's own)
  if (spec.exhaust && spec.exhaust !== "stock") {
    const exMat = own(spec.exhaust === "titan" ? new THREE.MeshStandardMaterial({ color: 0x5b4fa0, roughness: 0.3, metalness: 1, envMap, envMapIntensity: 1.5, emissive: 0x1a0a40, emissiveIntensity: 0.25 }) : new THREE.MeshStandardMaterial({ color: 0xb8bbc8, roughness: 0.18, metalness: 1, envMap, envMapIntensity: 1.4 }));
    const throat = own(new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.9 }));
    const w = 0.36; const ex = { big: { z: [-w, w], k: 1.45 }, quad: { z: [-w - 0.16, -w + 0.08, w - 0.08, w + 0.16], k: 0.88 }, centre: { z: [0], k: 1.7 }, titan: { z: [-w, w], k: 1.15 } }[spec.exhaust];
    if (ex) for (const tipZ of ex.z) {
      const tipX = tailX - 0.005, tipY = 0.3, k = ex.k;
      const tipG = new THREE.CylinderGeometry(0.062 * k, 0.072 * k, 0.22, 20, 1, true); tipG.rotateZ(Math.PI / 2); add(tipG, exMat, tipX + 0.03, tipY, tipZ);
      const thG = new THREE.CylinderGeometry(0.056 * k, 0.056 * k, 0.2, 16); thG.rotateZ(Math.PI / 2); add(thG, throat, tipX + 0.06, tipY, tipZ);
    }
  }
}

// ---------------------------------------------------------------- traffic (cheap: no customising, one shared material per paint colour)
export const TRAFFIC_CARS = ["ghatch", "gsedan", "gcompact", "gsuv", "gwagon", "gcoupe", "gsport", "gpickup", "goffroad", "gvan"];
export const TRAFFIC_FILES = { car: TRAFFIC_CARS, taxi: ["taxi"], bus: ["citybus"], truck: ["roadtruck", "garbage"], van: ["ambulance"], police: ["policesedan"], school: ["schoolbus"], fire: ["firetruck"] };
export const preloadTraffic = () => Promise.all(Object.values(TRAFFIC_FILES).flat().map((f) => loadCarModel(f).catch(() => null)));
const trafficPaint = new Map();
// ctx: { envMap, glass (material), head (material), tailOff (material) }
export function createTrafficGlb(file, color, ctx) {
  const g = new THREE.Group(); g.rotation.order = "YXZ";
  const taillamps = []; let tailMat = ctx.tailOff;
  // a stand-in for the old single "tail" mesh: assigning .material swaps every tail lamp (brake lights)
  const tail = { set material(m) { tailMat = m; for (const o of taillamps) o.material = m; }, get material() { return tailMat; } };
  const build = (tpl) => {
    const model = tpl.scene.clone(true);
    const key = (color || "#888") + "|" + (ctx.envMap ? ctx.envMap.uuid : "");
    let pm = trafficPaint.get(key); if (!pm) { pm = new THREE.MeshPhysicalMaterial({ color: color || "#888888", roughness: 0.3, metalness: 0.62, clearcoat: 1, clearcoatRoughness: 0.07, envMap: ctx.envMap, envMapIntensity: 1.15 }); trafficPaint.set(key, pm); }
    model.traverse((o) => {
      if (!o.isMesh) return; if (o.userData.hidden) { o.visible = false; return; }
      const role = roleOf(o.material);
      if (role === "paint") o.material = pm;
      else if (role === "glass") { const nm = origName(o.material); if (!/head|light|lamp|turn|signal|blink|rev|brake|tail|optic/i.test(nm)) o.material = ctx.glass; o.renderOrder = 3; }
      else if (role === "headlight") o.material = ctx.head;
      else if (role === "taillight") { o.material = tailMat; taillamps.push(o); }
      else if (role === "plate") o.visible = false;
      else if (o.material && o.material.isMeshStandardMaterial && !o.material.userData.envSet) { o.material.envMap = ctx.envMap; o.material.envMapIntensity = Math.max(o.material.envMapIntensity || 1, 0.8); o.material.userData.envSet = true; o.material.needsUpdate = true; }
    });
    g.add(model); g.userData.ready = true;
  };
  const e = cache.get(file);
  if (e && e.tpl) build(e.tpl); else loadCarModel(file).then(build).catch((err) => console.warn("traffic model failed", file, err));
  g.userData.tail = tail;
  return g;
}
