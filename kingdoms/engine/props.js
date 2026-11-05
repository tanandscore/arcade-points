// Ashtide — decorations (Upgrade 64): little hand-made models that sit on the rooftops or float in the harbour.
// Each is a small group of simple shapes in the town's soft colours; some move (windmill sails, lighthouse beam, bobbing balloon and
// boats, flickering lanterns). makeProp(type) returns a THREE.Group with userData.update(time, night) when it animates.
import * as THREE from "three";

const M = {};
const mat = (hex, o = {}) => { const k = hex + JSON.stringify(o); return M[k] || (M[k] = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.8, metalness: 0, flatShading: true, ...o })); };
const glow = (hex) => { const k = "g" + hex; return M[k] || (M[k] = new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.2, roughness: 0.4 })); };
const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y + h / 2, z); o.castShadow = true; return o; };
const cyl = (r0, r1, h, m, x = 0, y = 0, z = 0, seg = 10) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m); o.position.set(x, y + h / 2, z); o.castShadow = true; return o; };
const cone = (r, h, m, x = 0, y = 0, z = 0, seg = 8) => { const o = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m); o.position.set(x, y + h / 2, z); o.castShadow = true; return o; };
const ball = (r, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m); o.position.set(x, y, z); o.castShadow = true; return o; };

const WOOD = 0x7a5538, STONE = 0xd8d0c0, WHITE = 0xf7f2e8, RED = 0xd25a48, ROOF = 0xb5503f, LEAF = 0x6aa55f, LEAF2 = 0x86bd68, WATER = 0x7fd3e6, GOLD = 0xe8c15a, IRON = 0x4c5560;

export function makeProp(type, seed = 0) {
  const g = new THREE.Group(); const lights = [];
  switch (type) {
    case "tree": {
      g.add(cyl(0.08, 0.11, 0.9, mat(WOOD)));
      g.add(ball(0.55, mat(seed % 2 ? LEAF : LEAF2), 0, 1.15, 0)); g.add(ball(0.42, mat(LEAF), 0.28, 1.35, 0.12)); g.add(ball(0.38, mat(LEAF2), -0.25, 1.3, -0.15));
      g.add(cyl(0.32, 0.38, 0.22, mat(0xc77d55)));
      break;
    }
    case "lantern": {
      g.add(cyl(0.035, 0.045, 1.5, mat(IRON))); g.add(box(0.36, 0.04, 0.04, mat(IRON), 0.12, 1.45, 0));
      const l = box(0.2, 0.28, 0.2, glow(0xffc26a), 0.27, 1.12, 0); g.add(l); lights.push(l);
      g.add(cone(0.16, 0.12, mat(IRON), 0.27, 1.4, 0, 4));
      break;
    }
    case "flag": {
      g.add(cyl(0.03, 0.04, 2.2, mat(WHITE)));
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55, 6, 1), mat([RED, 0x4f8fc0, 0xf2c14e, 0x6bbf8a][seed % 4], { side: THREE.DoubleSide })); cloth.position.set(0.47, 1.85, 0); g.add(cloth);
      g.userData.cloth = cloth;
      break;
    }
    case "boat": {
      const hull = box(0.9, 0.4, 2.4, mat([0xb5503f, 0x3f7f9a, 0x6a8f5a, 0xd9a441][seed % 4]), 0, -0.1, 0); g.add(hull);
      g.add(box(0.75, 0.06, 2.2, mat(WOOD), 0, 0.3, 0)); g.add(cyl(0.035, 0.04, 2.4, mat(WOOD), 0, 0.3, 0.2));
      const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.Float32BufferAttribute([0, 2.6, 0.2, 0, 0.6, 0.25, 0, 0.6, 1.4], 3)); sg.computeVertexNormals();
      g.add(new THREE.Mesh(sg, mat(WHITE, { side: THREE.DoubleSide })));
      g.userData.bob = true;
      break;
    }
    case "fountain": {
      g.add(cyl(0.7, 0.75, 0.3, mat(STONE), 0, 0, 0, 14)); g.add(cyl(0.6, 0.6, 0.05, mat(WATER, { roughness: 0.15 }), 0, 0.27, 0, 14));
      g.add(cyl(0.12, 0.16, 0.8, mat(STONE))); g.add(cyl(0.32, 0.12, 0.12, mat(STONE), 0, 0.8, 0, 12));
      const jet = cone(0.1, 0.5, mat(0xbfefff, { transparent: true, opacity: 0.7, roughness: 0.1 }), 0, 0.9, 0); g.add(jet); g.userData.jet = jet;
      break;
    }
    case "stall": {
      for (const x of [-0.5, 0.5]) for (const z of [-0.35, 0.35]) g.add(cyl(0.03, 0.03, 1.0, mat(WOOD), x, 0, z));
      g.add(box(1.15, 0.08, 0.8, mat(WOOD), 0, 0.5, 0));
      const awn = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.25, 8, 1, true, 0, Math.PI), mat([0xe76f51, 0x2a9d8f, 0xe9c46a][seed % 3], { side: THREE.DoubleSide })); awn.rotation.z = Math.PI / 2; awn.position.y = 1.0; awn.scale.set(1, 1, 0.9); g.add(awn);
      for (let n = 0; n < 6; n++) g.add(ball(0.08, mat([0xe63946, 0xf4a261, 0x8ac926, 0xffd166][n % 4]), -0.4 + n * 0.16, 0.66, (n % 2) * 0.15 - 0.07));
      break;
    }
    case "windmill": {
      g.add(cyl(0.45, 0.6, 1.8, mat(WHITE), 0, 0, 0, 10)); g.add(cone(0.6, 0.6, mat(ROOF), 0, 1.8, 0, 10));
      const hub = new THREE.Group(); hub.position.set(0, 1.75, 0.6);
      for (let n = 0; n < 4; n++) { const s = box(0.2, 1.4, 0.03, mat(0xf3e6c8), 0, 0, 0); s.position.set(0, 0.7, 0); const arm = new THREE.Group(); arm.add(s); arm.rotation.z = (n * Math.PI) / 2; hub.add(arm); }
      g.add(hub); g.userData.sails = hub;
      break;
    }
    case "lighthouse": {
      for (let n = 0; n < 4; n++) g.add(cyl(0.42 - n * 0.04, 0.46 - n * 0.04, 0.6, mat(n % 2 ? RED : WHITE), 0, n * 0.6, 0, 12));
      g.add(cyl(0.5, 0.5, 0.08, mat(IRON), 0, 2.4, 0, 12));
      const lamp = cyl(0.26, 0.26, 0.4, glow(0xfff2b0), 0, 2.48, 0, 12); g.add(lamp); lights.push(lamp);
      g.add(cone(0.36, 0.4, mat(RED), 0, 2.88, 0, 12));
      const beamG = new THREE.ConeGeometry(1.4, 9, 16, 1, true); beamG.rotateZ(Math.PI / 2); beamG.translate(4.5, 0, 0);
      const beam = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      const bg = new THREE.Group(); bg.position.y = 2.68; bg.add(beam); g.add(bg); g.userData.beam = bg; g.userData.beamMat = beam.material;
      break;
    }
    case "bell": {
      for (const x of [-0.35, 0.35]) for (const z of [-0.35, 0.35]) g.add(box(0.12, 1.3, 0.12, mat(STONE), x, 0, z));
      g.add(box(0.95, 0.15, 0.95, mat(STONE), 0, 1.3, 0)); { const rf = cone(0.7, 0.8, mat(ROOF), 0, 1.45, 0, 4); rf.rotation.y = Math.PI / 4; g.add(rf); }
      const bell = cone(0.22, 0.35, mat(GOLD, { metalness: 0.7, roughness: 0.3 }), 0, 0.85, 0, 12); g.add(bell); g.userData.bell = bell;
      break;
    }
    case "statue": {
      g.add(box(0.6, 0.4, 0.6, mat(STONE))); g.add(cyl(0.16, 0.2, 0.7, mat(0x9fb7b0), 0, 0.4, 0)); g.add(ball(0.17, mat(0x9fb7b0), 0, 1.25, 0));
      { const arm = box(0.5, 0.08, 0.08, mat(0x9fb7b0), 0.18, 0.95, 0); arm.rotation.z = 0.6; g.add(arm); }
      break;
    }
    case "balloon": {
      const up = new THREE.Group(); up.position.y = 2.2;
      up.add(ball(1.0, mat([0xe76f51, 0x2a9d8f, 0xe9c46a, 0x9b5de5][seed % 4]), 0, 1.0, 0));
      up.add(box(0.4, 0.3, 0.4, mat(WOOD), 0, -0.45, 0));
      for (const x of [-0.18, 0.18]) for (const z of [-0.18, 0.18]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.75, 3), mat(IRON)); r.position.set(x, -0.05, z); up.add(r); }
      g.add(up); g.userData.balloon = up;
      g.add(cyl(0.02, 0.02, 2.2, mat(IRON)));
      break;
    }
    default: g.add(box(0.4, 0.4, 0.4, mat(0xff00ff)));
  }
  g.userData.lights = lights; g.userData.seed = seed;
  g.userData.update = (t, night) => {
    const u = g.userData; const ph = seed * 1.7;
    for (const l of lights) l.material.emissiveIntensity = 0.15 + night * (1.6 + 0.25 * Math.sin(t * 9 + ph));
    if (u.sails) u.sails.rotation.z = t * 0.9;
    if (u.beam) { u.beam.rotation.y = t * 0.8; u.beamMat.opacity = night * 0.22; }
    if (u.cloth) u.cloth.rotation.y = Math.sin(t * 2.2 + ph) * 0.25;
    if (u.balloon) u.balloon.position.y = 2.2 + Math.sin(t * 0.8 + ph) * 0.35;
    if (u.bob) { g.position.y = (g.userData.baseY || 0) + Math.sin(t * 1.3 + ph) * 0.07; g.rotation.z = Math.sin(t * 1.1 + ph) * 0.04; }
    if (u.jet) u.jet.scale.y = 0.85 + 0.15 * Math.sin(t * 6);
    if (u.bell) u.bell.rotation.z = Math.sin(t * 1.5 + ph) * 0.08;
  };
  return g;
}
