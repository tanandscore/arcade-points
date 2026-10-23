// Hand-built heroes and monsters for Wrath of Olympus. Everything is made from
// simple shapes, but with armour, crests, shields, wings and horns, shared
// materials, and a walk / attack animation driven from the game's own state.
import * as THREE from "three";

const _m = {};
const mat = (key, p) => (_m[key] ||= new THREE.MeshStandardMaterial({ envMapIntensity: 0.9, ...p }));
const _g = {};
const geo = (key, make) => (_g[key] ||= make());

const SKIN = () => mat("skin", { color: 0xd9a47a, roughness: 0.6 });
const BRONZE = () => mat("bronze", { color: 0xb87a3a, roughness: 0.32, metalness: 0.85 });
const GOLD = () => mat("gold", { color: 0xffc94a, roughness: 0.25, metalness: 0.95, emissive: 0x6a4200, emissiveIntensity: 0.25 });
const LEATHER = () => mat("leather", { color: 0x6a4428, roughness: 0.8 });
const IRON = () => mat("iron", { color: 0x7a7e86, roughness: 0.38, metalness: 0.9 });
const WOOD = () => mat("wood", { color: 0x6a4a2a, roughness: 0.8 });

function add(parent, g, m, x = 0, y = 0, z = 0, o = {}) {
  const mesh = new THREE.Mesh(g, m); mesh.position.set(x, y, z);
  mesh.castShadow = o.shadow !== false; mesh.receiveShadow = true;
  if (o.rx) mesh.rotation.x = o.rx; if (o.ry) mesh.rotation.y = o.ry; if (o.rz) mesh.rotation.z = o.rz;
  if (o.s) mesh.scale.set(...o.s);
  parent.add(mesh); return mesh;
}
function pivot(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

// ---- the heroes -----------------------------------------------------------------
export function buildHero(isPlayer) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const armour = isPlayer ? GOLD() : BRONZE();
  const plume = mat(isPlayer ? "plumeP" : "plumeA", { color: isPlayer ? 0xd8202a : 0x1fb8c4, roughness: 0.7, side: THREE.DoubleSide });
  const cloak = mat(isPlayer ? "cloakP" : "cloakA", { color: isPlayer ? 0x8c1018 : 0x14707a, roughness: 0.85, side: THREE.DoubleSide });
  const legs = [];
  for (const sd of [-1, 1]) {
    const hip = pivot(body, sd * 0.046, 0.3, 0);
    add(hip, geo("hLegU", () => new THREE.CylinderGeometry(0.03, 0.026, 0.15, 8)), SKIN(), 0, -0.075, 0);
    add(hip, geo("hGreave", () => new THREE.CylinderGeometry(0.03, 0.024, 0.13, 8)), armour, 0, -0.205, 0.004);
    add(hip, geo("hFoot", () => new THREE.BoxGeometry(0.05, 0.02, 0.09)), LEATHER(), 0, -0.275, 0.015);
    legs.push(hip);
  }
  add(body, geo("hTorso", () => new THREE.CylinderGeometry(0.078, 0.062, 0.21, 12)), armour, 0, 0.405, 0);
  add(body, geo("hBelt", () => new THREE.CylinderGeometry(0.066, 0.066, 0.025, 12)), LEATHER(), 0, 0.31, 0);
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; add(body, geo("hPter", () => new THREE.BoxGeometry(0.036, 0.1, 0.012)), LEATHER(), Math.sin(a) * 0.072, 0.27, Math.cos(a) * 0.072, { ry: a, shadow: false }); }
  const arms = [];
  for (const sd of [-1, 1]) {
    const sh = pivot(body, sd * 0.1, 0.49, 0);
    add(sh, geo("hPad", () => new THREE.SphereGeometry(0.036, 10, 8)), armour, 0, 0, 0);
    add(sh, geo("hArm", () => new THREE.CylinderGeometry(0.02, 0.017, 0.14, 8)), SKIN(), 0, -0.07, 0);
    add(sh, geo("hBracer", () => new THREE.CylinderGeometry(0.022, 0.02, 0.06, 8)), armour, 0, -0.12, 0);
    arms.push(sh);
  }
  // right hand: spear. left hand: round shield
  const weapon = new THREE.Group(); arms[1].add(weapon); weapon.position.set(0.01, -0.15, 0.02);
  add(weapon, geo("hSpear", () => new THREE.CylinderGeometry(0.008, 0.008, 0.62, 6)), WOOD(), 0, 0.12, 0);
  add(weapon, geo("hTip", () => new THREE.ConeGeometry(0.022, 0.09, 6)), IRON(), 0, 0.47, 0);
  const shield = new THREE.Group(); arms[0].add(shield); shield.position.set(-0.03, -0.11, 0.045);
  add(shield, geo("hShield", () => new THREE.CylinderGeometry(0.1, 0.1, 0.016, 20)), armour, 0, 0, 0, { rx: Math.PI / 2 });
  add(shield, geo("hRim", () => new THREE.TorusGeometry(0.1, 0.008, 6, 24)), GOLD(), 0, 0, 0.008);
  add(shield, geo("hBoss", () => new THREE.SphereGeometry(0.03, 10, 8)), GOLD(), 0, 0, 0.014);
  const head = pivot(body, 0, 0.575, 0);
  add(head, geo("hHead", () => new THREE.SphereGeometry(0.046, 12, 10)), SKIN(), 0, 0, 0);
  add(head, geo("hHelm", () => new THREE.SphereGeometry(0.052, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62)), armour, 0, 0.008, 0);
  add(head, geo("hCheek", () => new THREE.BoxGeometry(0.1, 0.05, 0.02)), armour, 0, -0.015, 0.04);
  const crest = add(head, geo("hCrest", () => new THREE.TorusGeometry(0.062, 0.016, 6, 14, Math.PI)), plume, 0, 0.03, 0, { ry: Math.PI / 2, shadow: false });
  const cape = add(body, geo("hCape", () => new THREE.PlaneGeometry(0.15, 0.3, 1, 4)), cloak, 0, 0.36, -0.07, { rx: 0.12 });
  if (isPlayer) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.235, 40), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.012; root.add(ring); root.userData.ring = ring;
  }
  root.userData = { ...root.userData, kind: "hero", legs, arms, body, cape, head, weapon, height: 0.7 };
  return root;
}

// ---- monsters ---------------------------------------------------------------------
function humanoid(root, o) {
  const body = new THREE.Group(); root.add(body);
  const skin = mat("sk" + o.skin, { color: o.skin, roughness: 0.65 });
  const cloth = mat("cl" + o.cloth, { color: o.cloth, roughness: 0.85 });
  const legs = [], arms = [];
  for (const sd of [-1, 1]) {
    const hip = pivot(body, sd * 0.05, 0.3, 0);
    add(hip, geo("mLeg", () => new THREE.CylinderGeometry(0.036, 0.03, 0.28, 8)), o.goat ? mat("fur" + o.cloth, { color: o.cloth, roughness: 1 }) : skin, 0, -0.14, 0);
    if (o.goat) add(hip, geo("mHoof", () => new THREE.ConeGeometry(0.03, 0.06, 6)), mat("hoof", { color: 0x1a1410 }), 0, -0.29, 0.01, { rx: Math.PI });
    legs.push(hip);
  }
  add(body, geo("mTorso", () => new THREE.CylinderGeometry(0.085, 0.07, 0.25, 10)), o.skinTorso ? skin : cloth, 0, 0.42, 0);
  for (const sd of [-1, 1]) {
    const sh = pivot(body, sd * 0.11, 0.52, 0);
    add(sh, geo("mArm", () => new THREE.CylinderGeometry(0.026, 0.02, 0.2, 8)), skin, 0, -0.1, 0);
    arms.push(sh);
  }
  const head = pivot(body, 0, 0.62, 0);
  add(head, geo("mHead", () => new THREE.SphereGeometry(0.05, 12, 10)), skin, 0, 0, 0);
  return { body, legs, arms, head, skin, cloth };
}

export function buildMonster(typeId) {
  const root = new THREE.Group();
  let rig = null, height = 0.7, S = 1;
  const eyeGlow = (color) => mat("eye" + color, { color, emissive: color, emissiveIntensity: 3 });
  if (typeId === "harpy") {
    const body = new THREE.Group(); root.add(body); S = 0.85;
    const m = mat("harpyB", { color: 0x7d3fb0, roughness: 0.6 }), f = mat("harpyF", { color: 0xb45cff, roughness: 0.7, side: THREE.DoubleSide });
    add(body, geo("hpBody", () => new THREE.CapsuleGeometry(0.07, 0.18, 4, 8)), m, 0, 0.55, 0, { rx: 0.5 });
    add(body, geo("hpHead", () => new THREE.SphereGeometry(0.052, 10, 8)), mat("hpSkin", { color: 0xd9b0a0 }), 0, 0.68, 0.1);
    add(body, geo("hpBeak", () => new THREE.ConeGeometry(0.014, 0.05, 6)), mat("beak", { color: 0xe8c040 }), 0, 0.67, 0.16, { rx: Math.PI / 2 });
    const wings = [];
    for (const sd of [-1, 1]) {
      const w = pivot(body, sd * 0.06, 0.6, -0.02);
      add(w, geo("hpWing", () => new THREE.PlaneGeometry(0.4, 0.2, 4, 1)), f, sd * 0.2, 0, 0, { rx: -Math.PI / 2, shadow: false });
      add(w, geo("hpWingB", () => new THREE.BoxGeometry(0.38, 0.012, 0.02)), m, sd * 0.19, 0, 0.09);
      wings.push(w);
    }
    for (const sd of [-1, 1]) add(body, geo("hpTalon", () => new THREE.ConeGeometry(0.014, 0.1, 5)), mat("talon", { color: 0x2a2020 }), sd * 0.035, 0.4, 0.05, { rx: Math.PI });
    rig = { kind: "flyer", wings, body }; height = 0.8;
  } else if (typeId === "satyr") {
    S = 0.8; const h = humanoid(root, { skin: 0xc98a5c, cloth: 0x6a8a40, goat: true });
    for (const sd of [-1, 1]) add(h.head, geo("horn", () => new THREE.ConeGeometry(0.014, 0.1, 6)), mat("horn", { color: 0xe8e0c8 }), sd * 0.03, 0.06, 0, { rz: -sd * 0.5 });
    const pipe = add(h.arms[1], geo("pipe", () => new THREE.CylinderGeometry(0.01, 0.01, 0.2, 6)), WOOD(), 0, -0.2, 0.04, { rx: Math.PI / 2.4 });
    rig = { kind: "walker", ...h };
  } else if (typeId === "cyclops") {
    S = 1.35; const h = humanoid(root, { skin: 0x9a7a52, cloth: 0x5a3a24, skinTorso: true });
    add(h.head, geo("eye", () => new THREE.SphereGeometry(0.022, 8, 8)), eyeGlow(0xfff0b0), 0, 0.005, 0.045);
    add(h.head, geo("brow", () => new THREE.BoxGeometry(0.08, 0.014, 0.02)), mat("brow", { color: 0x3a2a1a }), 0, 0.03, 0.045);
    const club = add(h.arms[1], geo("club", () => new THREE.CylinderGeometry(0.04, 0.02, 0.4, 8)), WOOD(), 0, -0.22, 0.05, { rx: Math.PI / 3 });
    rig = { kind: "walker", ...h, weapon: club };
  } else if (typeId === "centaur") {
    S = 1.05; const root2 = new THREE.Group(); root.add(root2);
    const coat = mat("horse", { color: 0xb8672a, roughness: 0.7 });
    add(root2, geo("cBody", () => new THREE.CapsuleGeometry(0.1, 0.3, 4, 10)), coat, 0, 0.36, 0, { rz: Math.PI / 2 });
    const legs = [];
    for (const [x, z] of [[-0.06, 0.15], [0.06, 0.15], [-0.06, -0.15], [0.06, -0.15]]) { const hip = pivot(root2, x, 0.34, z); add(hip, geo("cLeg", () => new THREE.CylinderGeometry(0.026, 0.02, 0.34, 6)), coat, 0, -0.17, 0); legs.push(hip); }
    const tail = add(root2, geo("cTail", () => new THREE.ConeGeometry(0.03, 0.22, 6)), mat("mane", { color: 0x2a1a10 }), 0, 0.36, -0.28, { rx: -2.2 });
    const t = humanoid(root2, { skin: 0xd9a47a, cloth: 0x7a4a24, skinTorso: true });
    t.body.position.set(0, 0.2, 0.2); t.body.scale.setScalar(0.8); for (const l of t.legs) l.visible = false;
    const bow = add(t.arms[0], geo("bow", () => new THREE.TorusGeometry(0.12, 0.007, 6, 14, Math.PI)), WOOD(), -0.02, -0.15, 0.06, { rz: Math.PI / 2 });
    rig = { kind: "quad", legs, arms: t.arms, head: t.head, body: root2 };
  } else if (typeId === "minotaur") {
    S = 1.55; const h = humanoid(root, { skin: 0x7a3a2a, cloth: 0x2a1a14, skinTorso: true });
    const bull = mat("bull", { color: 0x5a2a1e, roughness: 0.8 });
    add(h.head, geo("snout", () => new THREE.BoxGeometry(0.05, 0.045, 0.06)), bull, 0, -0.012, 0.05);
    for (const sd of [-1, 1]) { add(h.head, geo("bhorn", () => new THREE.ConeGeometry(0.016, 0.14, 6)), mat("bhornm", { color: 0xe8dcc0 }), sd * 0.07, 0.04, 0, { rz: -sd * 1.0 }); add(h.head, geo("beye", () => new THREE.SphereGeometry(0.008, 6, 6)), eyeGlow(0xff3a1a), sd * 0.022, 0.01, 0.046); }
    const axe = new THREE.Group(); h.arms[1].add(axe); axe.position.set(0, -0.2, 0.05); axe.rotation.x = 1.0;
    add(axe, geo("axeS", () => new THREE.CylinderGeometry(0.012, 0.012, 0.45, 6)), WOOD(), 0, 0.1, 0);
    add(axe, geo("axeH", () => new THREE.BoxGeometry(0.2, 0.12, 0.014)), IRON(), 0.09, 0.3, 0);
    rig = { kind: "walker", ...h, weapon: axe };
  } else if (typeId === "gorgon") {
    S = 1.15; const h = humanoid(root, { skin: 0x3a9a5a, cloth: 0x1f4a34, skinTorso: true });
    add(h.body, geo("gRobe", () => new THREE.ConeGeometry(0.14, 0.34, 10, 1, true)), mat("robe", { color: 0x1f4a34, roughness: 0.85, side: THREE.DoubleSide }), 0, 0.17, 0);
    for (const l of h.legs) l.visible = false;
    const snakes = [];
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; const sn = pivot(h.head, Math.cos(a) * 0.035, 0.03, Math.sin(a) * 0.035); add(sn, geo("snake", () => new THREE.CylinderGeometry(0.006, 0.01, 0.12, 5)), mat("snakeM", { color: 0x2f8a3a }), 0, 0.06, 0); sn.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8); snakes.push(sn); }
    for (const sd of [-1, 1]) add(h.head, geo("geye", () => new THREE.SphereGeometry(0.011, 6, 6)), eyeGlow(0xd0ff40), sd * 0.02, 0.008, 0.046);
    rig = { kind: "walker", ...h, snakes };
  } else if (typeId === "hydra") {
    S = 2.2; const body = new THREE.Group(); root.add(body);
    const hide = mat("hydra", { color: 0x2a7a46, roughness: 0.55, metalness: 0.1 }), belly = mat("hydraB", { color: 0xa8c888, roughness: 0.7 });
    add(body, geo("hyBody", () => new THREE.SphereGeometry(0.28, 14, 12)), hide, 0, 0.3, 0, { s: [1.3, 0.8, 1.6] });
    for (const [x, z] of [[-0.2, 0.2], [0.2, 0.2], [-0.2, -0.2], [0.2, -0.2]]) { const hip = pivot(body, x, 0.2, z); add(hip, geo("hyLeg", () => new THREE.CylinderGeometry(0.07, 0.05, 0.22, 8)), hide, 0, -0.08, 0); }
    const necks = [];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI - Math.PI / 2; const base = pivot(body, Math.sin(a) * 0.2, 0.42, 0.28);
      const segs = []; let parent = base;
      for (let k = 0; k < 4; k++) { const seg = pivot(parent, 0, k === 0 ? 0 : 0.14, 0); add(seg, geo("hyNeck", () => new THREE.CylinderGeometry(0.035, 0.045, 0.16, 8)), hide, 0, 0.08, 0); segs.push(seg); parent = seg; }
      const hd = pivot(parent, 0, 0.17, 0.02);
      add(hd, geo("hyHead", () => new THREE.SphereGeometry(0.06, 10, 8)), hide, 0, 0, 0.02, { s: [1, 0.8, 1.4] });
      for (const sd of [-1, 1]) add(hd, geo("hyEye", () => new THREE.SphereGeometry(0.012, 6, 6)), eyeGlow(0xff4020), sd * 0.03, 0.025, 0.07);
      add(hd, geo("hyFang", () => new THREE.ConeGeometry(0.008, 0.04, 5)), mat("fang", { color: 0xf0ecd8 }), 0.02, -0.035, 0.1, { rx: Math.PI });
      necks.push({ base, segs, phase: i * 1.3, a });
    }
    rig = { kind: "hydra", necks, body }; height = 1.4;
  } else { const h = humanoid(root, { skin: 0xaaaaaa, cloth: 0x555555 }); rig = { kind: "walker", ...h }; }
  root.scale.setScalar(S);
  root.userData = { kind: "monster", typeId, rig, height: height * S };
  return root;
}

// Drive limbs. t = seconds, move = 0..1 how fast it is moving, atk = 0..1 attack swing
export function animateFigure(root, t, move, atk, phase = 0) {
  const u = root.userData; const w = t * (6 + move * 4) + phase;
  const sw = Math.sin(w) * 0.7 * move;
  if (u.kind === "hero") {
    u.legs[0].rotation.x = sw; u.legs[1].rotation.x = -sw;
    u.arms[0].rotation.x = -sw * 0.6; u.arms[1].rotation.x = sw * 0.5 - atk * 1.9;
    u.body.position.y = Math.abs(Math.sin(w)) * 0.012 * move;
    u.cape.rotation.x = 0.12 + move * 0.3 + Math.sin(t * 5 + phase) * 0.04;
    if (u.ring) { u.ring.rotation.z = t * 0.8; u.ring.material.opacity = 0.65 + 0.2 * Math.sin(t * 4); }
    return;
  }
  const r = u.rig; if (!r) return;
  if (r.kind === "walker") {
    r.legs[0].rotation.x = sw; r.legs[1].rotation.x = -sw; r.arms[0].rotation.x = -sw * 0.7; r.arms[1].rotation.x = sw * 0.6 - atk * 1.8;
    r.body.position.y = Math.abs(Math.sin(w)) * 0.014 * move; r.head.rotation.y = Math.sin(t * 0.9 + phase) * 0.2;
    if (r.snakes) r.snakes.forEach((s, i) => { s.rotation.z += Math.sin(t * 6 + i) * 0.01; s.rotation.x += Math.cos(t * 5 + i * 1.3) * 0.01; });
  } else if (r.kind === "quad") {
    const g = [sw, -sw, -sw, sw]; r.legs.forEach((l, i) => { l.rotation.x = g[i] * 1.1; }); r.arms[1].rotation.x = -atk * 1.4; r.body.position.y = Math.abs(Math.sin(w * 2)) * 0.012 * move;
  } else if (r.kind === "flyer") {
    r.wings.forEach((wg, i) => { wg.rotation.z = Math.sin(t * 14 + phase) * 0.6 * (i ? -1 : 1); });
    r.body.position.y = Math.sin(t * 3 + phase) * 0.05 - atk * 0.08; r.body.rotation.x = 0.2 + move * 0.2;
  } else if (r.kind === "hydra") {
    r.necks.forEach((n) => { n.segs.forEach((s, k) => { s.rotation.z = Math.sin(t * 1.4 + n.phase + k * 0.5) * 0.28; s.rotation.x = Math.cos(t * 1.1 + n.phase + k * 0.4) * 0.22 + (k === 0 ? 0.45 + atk * 0.5 : 0.1); }); });
    r.body.position.y = Math.abs(Math.sin(w * 0.6)) * 0.02 * move;
  }
}
