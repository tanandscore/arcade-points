// Low-poly Greek models for Wrath of Olympus: citizens, soldiers, horses, catapults and every building.
// All shapes are simple boxes / cylinders / cones with shared materials, so hundreds fit on screen.
import * as THREE from "three";
import { PLAYER_COLORS } from "./defs";

const _mat = {};
export function mat(key, color, extra = {}) {
  return (_mat[key] ||= new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0.04, flatShading: true, ...extra }));
}
export const M = {
  skin: () => mat("skin", 0xe0a67c), hair: () => mat("hair", 0x4a3020), wood: () => mat("wood", 0x7a5530), darkWood: () => mat("dwood", 0x4d3520),
  stone: () => mat("stone", 0xd9cfba), stoneD: () => mat("stoneD", 0xb3a68c), marble: () => mat("marble", 0xf1ece0), roof: () => mat("roof", 0xb9553a), roofD: () => mat("roofD", 0x93402b),
  bronze: () => mat("bronze", 0xc58a3c, { metalness: 0.7, roughness: 0.4 }), iron: () => mat("iron", 0x8b9098, { metalness: 0.7, roughness: 0.45 }), gold: () => mat("gold", 0xf2c14e, { metalness: 0.8, roughness: 0.3, emissive: 0x553a00, emissiveIntensity: 0.3 }),
  leather: () => mat("leather", 0x7b4f2e), cloth: () => mat("cloth", 0xe8dcc0), straw: () => mat("straw", 0xd9bf6a), soil: () => mat("soil", 0x6b4a2c), crop: () => mat("crop", 0x7fae3c), crop2: () => mat("crop2", 0xc9b13b),
  horse: () => mat("horse", 0x7a4b2a), horse2: () => mat("horse2", 0xe7e1d6), hay: () => mat("hay", 0xcdb15a), fire: () => mat("fire", 0xff8a2a, { emissive: 0xff5a10, emissiveIntensity: 1.2 }),
  white: () => mat("white", 0xffffff),
};
const _team = {};
export function teamMat(owner) {
  return (_team[owner] ||= new THREE.MeshStandardMaterial({ color: PLAYER_COLORS[owner] ?? 0x888888, roughness: 0.7, flatShading: true }));
}
const _teamDark = {};
export function teamDark(owner) {
  return (_teamDark[owner] ||= new THREE.MeshStandardMaterial({ color: new THREE.Color(PLAYER_COLORS[owner] ?? 0x888888).multiplyScalar(0.55), roughness: 0.7, flatShading: true }));
}

const _g = {};
const G = (k, f) => (_g[k] ||= f());
const boxG = (w, h, d) => G(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cylG = (rt, rb, h, s = 8) => G(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const coneG = (r, h, s = 8) => G(`k${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
const sphG = (r, s = 8) => G(`s${r},${s}`, () => new THREE.SphereGeometry(r, s, Math.max(4, s - 2)));

function put(parent, geo, m, x = 0, y = 0, z = 0, o) {
  o = o || {};
  const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z);
  if (o.ry) mesh.rotation.y = o.ry; if (o.rx) mesh.rotation.x = o.rx; if (o.rz) mesh.rotation.z = o.rz;
  if (o.s) mesh.scale.set(o.s[0], o.s[1], o.s[2]);
  mesh.castShadow = o.cast !== false; mesh.receiveShadow = o.recv !== false;
  parent.add(mesh); return mesh;
}
const box = (p, w, h, d, m, x, y, z, o) => put(p, boxG(w, h, d), m, x, y, z, o);
const cyl = (p, rt, rb, h, m, x, y, z, o, s) => put(p, cylG(rt, rb, h, s), m, x, y, z, o);
const cone = (p, r, h, m, x, y, z, o, s) => put(p, coneG(r, h, s), m, x, y, z, o);
const sph = (p, r, m, x, y, z, o) => put(p, sphG(r), m, x, y, z, o);
function piv(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

// triangular roof prism (ridge along z)
const prismG = (w, h, d) => G(`p${w},${h},${d}`, () => {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return g;
});
const prism = (p, w, h, d, m, x, y, z, o) => put(p, prismG(w, h, d), m, x, y, z, o);

// ================================ units ==========================================================
export function makeUnit(kind, owner) {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const P = { root, body, kind, owner };
  const team = teamMat(owner);
  const humanoid = (o) => {
    const { tunic = team, scale = 1, legM = M.skin() } = o;
    const hip = piv(body, 0, 0.42 * scale, 0);
    P.legL = piv(hip, -0.1 * scale, 0, 0); P.legR = piv(hip, 0.1 * scale, 0, 0);
    for (const l of [P.legL, P.legR]) box(l, 0.12 * scale, 0.42 * scale, 0.13 * scale, legM, 0, -0.21 * scale, 0);
    box(hip, 0.38 * scale, 0.44 * scale, 0.22 * scale, tunic, 0, 0.24 * scale, 0);
    const sh = piv(hip, 0, 0.42 * scale, 0);
    P.armL = piv(sh, -0.24 * scale, 0, 0); P.armR = piv(sh, 0.24 * scale, 0, 0);
    for (const a of [P.armL, P.armR]) box(a, 0.1 * scale, 0.36 * scale, 0.1 * scale, M.skin(), 0, -0.16 * scale, 0);
    P.head = sph(sh, 0.15 * scale, M.skin(), 0, 0.17 * scale, 0.01);
    P.hip = hip; P.sh = sh; return { hip, sh };
  };
  if (kind === "villager") {
    const { sh } = humanoid({ tunic: mat("vtunic" + owner, new THREE.Color(PLAYER_COLORS[owner]).lerp(new THREE.Color(0xf0e6cf), 0.55).getHex()) });
    cyl(sh, 0.2, 0.2, 0.04, M.straw(), 0, 0.3, 0, null, 10); cone(sh, 0.12, 0.1, M.straw(), 0, 0.35, 0, null, 8);
    P.tool = box(P.armR, 0.04, 0.34, 0.04, M.wood(), 0, -0.34, 0.08, { rx: -0.3 });
    box(P.tool, 0.14, 0.07, 0.04, M.iron(), 0, -0.17, 0);
    P.sack = box(P.body, 0.22, 0.2, 0.14, M.cloth(), 0, 0.72, -0.18); P.sack.visible = false;
  } else if (kind === "hoplite" || kind === "hero") {
    const big = kind === "hero"; const sc = big ? 1.4 : 1;
    const { sh } = humanoid({ tunic: M.cloth(), scale: sc });
    box(sh, 0.42 * sc, 0.3 * sc, 0.26 * sc, M.bronze(), 0, -0.14 * sc, 0); // breastplate
    box(P.hip, 0.4 * sc, 0.16 * sc, 0.24 * sc, team, 0, 0.04 * sc, 0); // team skirt
    // helmet + crest
    cyl(sh, 0.17 * sc, 0.17 * sc, 0.16 * sc, big ? M.gold() : M.bronze(), 0, 0.22 * sc, 0, null, 10);
    box(sh, 0.05 * sc, big ? 0.28 : 0.14, 0.32 * sc, team, 0, (big ? 0.4 : 0.34) * sc, -0.02 * sc);
    // shield (left), spear (right)
    P.shield = cyl(P.armL, 0.24 * sc, 0.24 * sc, 0.04 * sc, big ? M.gold() : team, -0.1 * sc, -0.2 * sc, 0.1 * sc, { rz: Math.PI / 2 }, 12);
    cyl(P.shield, 0.08 * sc, 0.08 * sc, 0.06 * sc, M.bronze(), 0, 0.03, 0, null, 8);
    P.weapon = piv(P.armR, 0, -0.3 * sc, 0.05);
    if (big) { box(P.weapon, 0.07, 0.8, 0.03, M.iron(), 0, 0.18, 0.12, { rx: -1.3 }); box(P.weapon, 0.22, 0.05, 0.05, M.gold(), 0, -0.04, 0.12); box(sh, 0.5 * sc, 0.7 * sc, 0.04, team, 0, -0.45 * sc, -0.18 * sc); }
    else { cyl(P.weapon, 0.018, 0.018, 1.25, M.wood(), 0, 0.2, 0.1, { rx: -1.35 }); cone(P.weapon, 0.04, 0.16, M.iron(), 0, 0.2, 0.74, { rx: Math.PI / 2 - 1.35 + 0 }); }
  } else if (kind === "archer") {
    const { sh } = humanoid({ tunic: mat("atunic" + owner, new THREE.Color(PLAYER_COLORS[owner]).lerp(new THREE.Color(0x3b2a1a), 0.45).getHex()) });
    cone(sh, 0.18, 0.26, M.leather(), 0, 0.22, -0.02, null, 7);
    P.weapon = piv(P.armL, 0, -0.3, 0.06);
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.025, 4, 12, Math.PI), M.wood()); bow.rotation.z = Math.PI / 2; bow.rotation.y = Math.PI / 2; bow.position.set(0, 0.0, 0.18); bow.castShadow = true; P.weapon.add(bow);
    cyl(P.body, 0.06, 0.06, 0.34, M.leather(), 0.08, 0.86, -0.18, { rx: 0.25 }, 6);
  } else if (kind === "horseman") {
    const hb = piv(body, 0, 0, 0); P.horse = hb;
    const hm = owner === 0 ? M.horse() : M.horse2();
    box(hb, 0.42, 0.42, 0.95, hm, 0, 0.72, 0); // body
    box(hb, 0.34, 0.5, 0.2, hm, 0, 1.0, 0.5, { rx: -0.5 }); // neck
    box(hb, 0.2, 0.22, 0.38, hm, 0, 1.2, 0.72, { rx: 0.2 }); // head
    box(hb, 0.08, 0.28, 0.36, M.hair(), 0, 1.15, 0.38, { rx: -0.5 }); // mane
    box(hb, 0.06, 0.06, 0.34, M.hair(), 0, 0.82, -0.58, { rx: 0.6 }); // tail
    box(hb, 0.47, 0.06, 0.5, team, 0, 0.95, 0.04); // saddle blanket
    P.horseLegs = [];
    for (const [lx, lz] of [[-0.14, 0.36], [0.14, 0.36], [-0.14, -0.36], [0.14, -0.36]]) { const l = piv(hb, lx, 0.58, lz); box(l, 0.1, 0.58, 0.1, hm, 0, -0.29, 0); P.horseLegs.push(l); }
    const rider = piv(hb, 0, 1.0, -0.02); P.rider = rider;
    box(rider, 0.3, 0.42, 0.2, M.cloth(), 0, 0.22, 0); box(rider, 0.32, 0.18, 0.22, team, 0, 0.1, 0);
    sph(rider, 0.13, M.skin(), 0, 0.55, 0); cyl(rider, 0.15, 0.15, 0.13, M.bronze(), 0, 0.6, 0, null, 8); box(rider, 0.04, 0.14, 0.26, team, 0, 0.74, -0.02);
    P.weapon = piv(rider, 0.2, 0.3, 0.04); cyl(P.weapon, 0.018, 0.018, 1.2, M.wood(), 0, 0, 0.35, { rx: Math.PI / 2 }); cone(P.weapon, 0.04, 0.16, M.iron(), 0, 0, 0.98, { rx: Math.PI / 2 });
    P.shield = cyl(rider, 0.18, 0.18, 0.04, team, -0.22, 0.28, 0.06, { rz: Math.PI / 2 }, 10);
  } else if (kind === "catapult") {
    box(body, 0.9, 0.12, 1.5, M.wood(), 0, 0.42, 0);
    for (const [wx, wz] of [[-0.5, 0.5], [0.5, 0.5], [-0.5, -0.5], [0.5, -0.5]]) { P["w" + wx + wz] = cyl(body, 0.26, 0.26, 0.1, M.darkWood(), wx, 0.28, wz, { rz: Math.PI / 2 }, 10); }
    box(body, 0.1, 0.55, 0.1, M.darkWood(), -0.34, 0.75, 0); box(body, 0.1, 0.55, 0.1, M.darkWood(), 0.34, 0.75, 0); box(body, 0.78, 0.08, 0.1, M.darkWood(), 0, 1.0, 0);
    P.arm = piv(body, 0, 0.95, 0);
    box(P.arm, 0.1, 0.1, 1.5, M.wood(), 0, 0, -0.1); cyl(P.arm, 0.2, 0.14, 0.2, M.darkWood(), 0, 0.02, 0.62, null, 8); sph(P.arm, 0.14, M.stoneD(), 0, 0.14, 0.62);
    box(body, 0.9, 0.05, 0.12, team, 0, 0.5, 0.74);
    P.arm.rotation.x = -0.9;
  }
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return P;
}

const RES_CARRY = { food: 0xd7503a, wood: 0x6b4a2a, gold: 0xf2c14e, stone: 0xa7a39a };
const _carryMat = {};
export function animateUnit(P, u, time, speedNow) {
  const k = P.kind; const t = time + (u.id % 17);
  const moving = u.anim === "walk" && speedNow > 0.2;
  const sw = moving ? Math.sin(t * (k === "horseman" ? 11 : k === "catapult" ? 4 : 8.5)) : 0;
  const idle = Math.sin(t * 2 + u.id) * 0.02;
  if (k === "catapult") {
    P.body.position.y = moving ? Math.abs(sw) * 0.02 : 0;
    const at = u.anim === "attack" ? Math.min(1, (u.animT || 0) / 0.45) : 1;
    const target = u.anim === "attack" ? (at < 1 ? -0.9 + at * 2.4 : 1.5) : -0.9;
    P.arm.rotation.x += (target - P.arm.rotation.x) * 0.25; return;
  }
  if (k === "horseman") {
    P.horse.position.y = moving ? Math.abs(Math.sin(t * 11)) * 0.06 : idle;
    P.horseLegs.forEach((l, i) => { l.rotation.x = moving ? Math.sin(t * 11 + (i % 2 ? Math.PI : 0) + (i > 1 ? 1.2 : 0)) * 0.7 : 0; });
    const ap = u.anim === "attack" ? Math.sin(Math.min(1, (u.animT || 0) / 0.5) * Math.PI) : 0;
    P.weapon.rotation.x = -0.15 + ap * 0.9; P.rider.rotation.x = ap * 0.18; return;
  }
  P.body.position.y = moving ? Math.abs(Math.sin(t * 8.5)) * 0.05 : idle;
  P.legL.rotation.x = sw * 0.8; P.legR.rotation.x = -sw * 0.8;
  let aL = -sw * 0.6, aR = sw * 0.6, wx = 0;
  const a = u.anim;
  if (a === "attack") {
    const ap = Math.min(1, (u.animT || 0) / 0.5), s = Math.sin(ap * Math.PI);
    if (k === "archer") { aL = -1.5; aR = -1.1 + s * 0.5; } else { aR = -1.9 + s * 1.9 + 0.3; aL = -0.3; }
    P.sh.rotation.y = 0;
  } else if (a === "gather") {
    const c = Math.sin(t * 7); aR = -0.9 + c * 0.9; aL = -0.5 + c * 0.4; P.sh.rotation.x = 0.15;
  } else if (a === "build") {
    const c = Math.sin(t * 8); aR = -1.3 + c * 0.7; aL = -0.3; P.sh.rotation.x = 0.2;
  } else { P.sh.rotation.x = 0; if (k === "hoplite" || k === "hero") { aR = -0.1; aL = 0; } }
  P.armL.rotation.x = aL; P.armR.rotation.x = aR;
  if (P.sack) {
    const has = u.carry && u.carry.amt > 0; P.sack.visible = !!has;
    if (has) P.sack.material = (_carryMat[u.carry.res] ||= new THREE.MeshStandardMaterial({ color: RES_CARRY[u.carry.res] ?? 0xcccccc, roughness: 0.8, flatShading: true }));
  }
}

// ================================ resource nodes ==================================================
export function makeNode(kind, seed = 0) {
  const g = new THREE.Group();
  if (kind === "gold") {
    box(g, 2.0, 0.4, 2.0, M.stoneD(), 0, 0.2, 0, { s: [1, 1, 1] });
    for (let i = 0; i < 6; i++) { const a = i * 1.1 + seed, r = 0.45 + (i % 3) * 0.12; const rock = cone(g, 0.5 - i * 0.04, 0.9 + (i % 3) * 0.3, mat("goldrock", 0xe5b93f, { metalness: 0.6, roughness: 0.35, emissive: 0x4a3300, emissiveIntensity: 0.35 }), 1 + Math.cos(a) * r, 0.3, 1 + Math.sin(a) * r, { ry: a }, 5); rock.scale.set(1, 1, 1); }
    cone(g, 0.6, 1.4, M.stoneD(), 1.0, 0.5, 1.0, null, 6);
  } else if (kind === "stone") {
    for (let i = 0; i < 6; i++) { const a = i * 1.05 + seed, r = 0.4 + (i % 3) * 0.2; cone(g, 0.55 - i * 0.03, 0.8 + (i % 3) * 0.35, mat("quarry" + (i % 2), i % 2 ? 0xa8a49a : 0x8f8b82), 1 + Math.cos(a) * r, 0.2, 1 + Math.sin(a) * r, { ry: a }, 5); }
  } else if (kind === "berries") {
    cone(g, 0.42, 0.55, mat("bush", 0x3e8a3a), 0.5, 0.27, 0.5, null, 7);
    for (let i = 0; i < 6; i++) { const a = i * 1.1; sph(g, 0.06, mat("berry", 0xc4264a), 0.5 + Math.cos(a) * 0.3, 0.35 + (i % 2) * 0.12, 0.5 + Math.sin(a) * 0.3); }
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

// ================================ buildings =======================================================
function columns(p, n, span, z, h, m, x0 = 0) {
  for (let i = 0; i < n; i++) { const x = x0 + (n === 1 ? 0 : -span / 2 + (span * i) / (n - 1)); cyl(p, 0.1, 0.12, h, m, x, h / 2, z, null, 8); }
}
function banner(p, owner, x, y, z, h = 1.4) {
  cyl(p, 0.03, 0.03, h, M.darkWood(), x, y + h / 2, z, null, 5);
  box(p, 0.5, 0.34, 0.03, teamMat(owner), x + 0.26, y + h - 0.2, z);
}

export function makeBuilding(kind, owner) {
  const g = new THREE.Group(); const m = new THREE.Group(); g.add(m); // m scales while under construction
  const team = teamMat(owner);
  if (kind === "town_center") {
    box(m, 3.9, 0.22, 3.9, M.stoneD(), 0, 0.11, 0); box(m, 3.6, 0.2, 3.6, M.stone(), 0, 0.32, 0);
    box(m, 2.8, 1.5, 2.6, M.marble(), 0, 1.17, -0.2);
    prism(m, 3.3, 1.0, 3.1, M.roof(), 0, 1.92, -0.2); // main roof (ridge along z)
    prism(m, 3.0, 0.7, 0.2, M.marble(), 0, 1.92, 1.5, { }); // front pediment
    columns(m, 6, 2.8, 1.45, 1.4, M.marble()); box(m, 3.1, 0.14, 0.34, M.stone(), 0, 1.95, 1.45);
    box(m, 0.8, 1.0, 0.1, M.darkWood(), 0, 0.85, 1.12);
    // tower with dome at the back
    cyl(m, 0.62, 0.7, 2.6, M.marble(), 0, 1.6, -1.2, null, 10); sph(m, 0.72, M.roof(), 0, 3.0, -1.2); cyl(m, 0.64, 0.64, 0.15, team, 0, 2.7, -1.2, null, 10);
    banner(m, owner, -1.7, 0.4, 1.7, 2.6); banner(m, owner, 1.7, 0.4, 1.7, 2.6);
    box(m, 3.0, 0.1, 0.1, team, 0, 2.0, 1.62);
  } else if (kind === "house") {
    box(m, 1.6, 0.14, 1.6, M.stoneD(), 0, 0.07, 0); box(m, 1.35, 0.9, 1.35, M.marble(), 0, 0.59, 0);
    cone(m, 1.15, 0.8, M.roof(), 0, 1.45, 0, { ry: Math.PI / 4 }, 4);
    box(m, 0.32, 0.55, 0.05, M.darkWood(), 0, 0.42, 0.69); box(m, 0.22, 0.22, 0.05, M.darkWood(), -0.42, 0.7, 0.69); box(m, 0.22, 0.22, 0.05, M.darkWood(), 0.42, 0.7, 0.69);
    box(m, 1.4, 0.08, 1.4, team, 0, 1.05, 0, { s: [1, 1, 1] });
  } else if (kind === "farm") {
    box(m, 2.9, 0.1, 2.9, M.soil(), 0, 0.05, 0);
    P_farm(m);
    for (const s of [-1.5, 1.5]) { box(m, 3.0, 0.2, 0.06, M.wood(), 0, 0.12, s); box(m, 0.06, 0.2, 3.0, M.wood(), s, 0.12, 0); }
    box(m, 0.4, 0.5, 0.4, team, 1.2, 0.3, 1.2);
  } else if (kind === "storehouse") {
    box(m, 1.8, 0.12, 1.8, M.stoneD(), 0, 0.06, 0); box(m, 1.5, 0.8, 1.2, M.wood(), 0, 0.52, -0.2);
    prism(m, 1.9, 0.6, 1.7, M.roofD(), 0, 0.92, -0.05);
    for (const [cx, cz] of [[-0.55, 0.62], [0.1, 0.7]]) cyl(m, 0.17, 0.12, 0.42, M.roof(), cx, 0.33, cz, null, 8);
    box(m, 0.4, 0.3, 0.4, M.wood(), 0.55, 0.27, 0.62); box(m, 1.5, 0.1, 0.06, team, 0, 0.98, 0.7);
  } else if (kind === "barracks") {
    box(m, 3.0, 0.16, 3.0, M.stoneD(), 0, 0.08, 0); box(m, 2.6, 1.1, 2.0, M.stone(), 0, 0.71, -0.3);
    prism(m, 2.9, 0.8, 2.3, M.roof(), 0, 1.26, -0.3);
    columns(m, 5, 2.4, 1.0, 1.1, M.marble(), 0); box(m, 2.7, 0.12, 0.3, M.marble(), 0, 1.2, 1.0);
    for (const x of [-0.8, 0, 0.8]) { cyl(m, 0.22, 0.22, 0.04, team, x, 0.9, 0.68, { rx: Math.PI / 2 }, 10); }
    box(m, 0.5, 0.8, 0.06, M.darkWood(), 0, 0.5, 0.7); banner(m, owner, -1.35, 0.2, 1.3, 1.9);
    for (let i = 0; i < 4; i++) cyl(m, 0.015, 0.015, 0.9, M.wood(), 1.05 + i * 0.08, 0.5, 1.28, { rz: 0.1 }, 4);
  } else if (kind === "archery_range") {
    box(m, 3.0, 0.1, 3.0, M.stoneD(), 0, 0.05, 0); box(m, 3.0, 0.1, 3.0, mat("sand", 0xcdb88a), 0, 0.12, 0, { s: [0.98, 1, 0.98] });
    for (const [x, z] of [[-1.2, -1.1], [1.2, -1.1], [-1.2, 0.2], [1.2, 0.2]]) cyl(m, 0.07, 0.07, 1.2, M.wood(), x, 0.7, z, null, 6);
    box(m, 2.9, 0.1, 1.6, M.roof(), 0, 1.35, -0.45); box(m, 2.9, 0.08, 0.08, team, 0, 1.22, 0.36);
    for (const x of [-0.9, 0.9]) { cyl(m, 0.34, 0.34, 0.08, mat("tgt", 0xefe6cc), x, 0.55, 1.2, { rx: Math.PI / 2.4 }, 14); cyl(m, 0.17, 0.17, 0.09, team, x, 0.56, 1.22, { rx: Math.PI / 2.4 }, 12); cyl(m, 0.03, 0.03, 0.6, M.wood(), x, 0.25, 1.15, null, 5); }
  } else if (kind === "stable") {
    box(m, 3.0, 0.12, 3.0, M.stoneD(), 0, 0.06, 0); box(m, 2.7, 0.95, 1.8, M.wood(), 0, 0.6, -0.5);
    prism(m, 3.0, 0.8, 2.3, M.roofD(), 0, 1.07, -0.5);
    box(m, 2.6, 0.45, 0.06, M.darkWood(), 0, 0.35, 0.45); box(m, 0.9, 0.9, 0.7, M.hay(), 0.9, 0.5, 1.0); box(m, 0.9, 0.5, 0.7, M.hay(), -0.9, 0.3, 1.1);
    banner(m, owner, -1.35, 0.1, 1.3, 1.8);
  } else if (kind === "temple") {
    box(m, 3.0, 0.18, 3.0, M.stoneD(), 0, 0.09, 0); box(m, 2.8, 0.18, 2.8, M.stone(), 0, 0.27, 0); box(m, 2.6, 0.18, 2.6, M.marble(), 0, 0.45, 0);
    box(m, 1.5, 1.2, 1.7, M.marble(), 0, 1.14, 0);
    for (const z of [-1.1, 1.1]) columns(m, 6, 2.3, z, 1.3, M.marble());
    box(m, 2.7, 0.14, 2.6, M.stone(), 0, 1.84, 0);
    prism(m, 2.8, 0.75, 2.8, M.marble(), 0, 1.9, 0, {}); box(m, 2.9, 0.06, 2.9, team, 0, 1.88, 0, { s: [1, 1, 1] });
    sph(m, 0.2, M.gold(), 0, 1.0, 0.1); cyl(m, 0.14, 0.2, 0.5, M.gold(), 0, 0.7, 0.1, null, 8);
    banner(m, owner, 1.6, 0.4, 1.5, 2.2);
  } else if (kind === "tower") {
    box(m, 1.8, 0.14, 1.8, M.stoneD(), 0, 0.07, 0); cyl(m, 0.62, 0.72, 2.2, M.stone(), 0, 1.2, 0, null, 8);
    cyl(m, 0.8, 0.8, 0.3, M.stoneD(), 0, 2.4, 0, null, 8); for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; box(m, 0.22, 0.24, 0.22, M.stoneD(), Math.cos(a) * 0.72, 2.7, Math.sin(a) * 0.72, { ry: -a }); }
    cone(m, 0.55, 0.7, M.roof(), 0, 2.85, 0, null, 8); cyl(m, 0.64, 0.64, 0.1, team, 0, 2.0, 0, null, 8); box(m, 0.14, 0.3, 0.05, M.darkWood(), 0, 1.7, 0.66);
  } else if (kind === "siege_workshop") {
    box(m, 3.0, 0.12, 3.0, M.stoneD(), 0, 0.06, 0); box(m, 2.7, 1.2, 1.8, M.wood(), 0, 0.72, -0.5);
    prism(m, 3.0, 0.8, 2.3, M.roofD(), 0, 1.3, -0.5); box(m, 1.2, 0.9, 0.06, M.darkWood(), 0, 0.55, 0.42);
    // half-built catapult out front
    box(m, 0.8, 0.1, 1.1, M.wood(), 0.8, 0.3, 1.0); cyl(m, 0.22, 0.22, 0.08, M.darkWood(), 0.4, 0.22, 1.2, { rz: Math.PI / 2 }, 10); cyl(m, 0.22, 0.22, 0.08, M.darkWood(), 1.2, 0.22, 1.2, { rz: Math.PI / 2 }, 10);
    box(m, 0.08, 0.9, 0.08, M.darkWood(), 0.8, 0.8, 1.0, { rz: 0.3 }); cyl(m, 0.5, 0.5, 0.1, M.iron(), -0.9, 0.3, 1.2, { rx: Math.PI / 2 }, 10);
    banner(m, owner, -1.35, 0.1, 1.3, 1.9);
  }
  else if (kind === "wonder") {
    box(m, 5.0, 0.22, 5.0, M.stoneD(), 0, 0.11, 0); box(m, 4.6, 0.22, 4.6, M.stone(), 0, 0.33, 0); box(m, 4.2, 0.22, 4.2, M.marble(), 0, 0.55, 0);
    box(m, 2.4, 1.9, 2.4, M.marble(), 0, 1.6, 0);
    for (const z of [-1.85, 1.85]) columns(m, 7, 3.6, z, 2.1, M.marble());
    for (const x of [-1.85, 1.85]) for (let i = 1; i < 6; i++) cyl(m, 0.1, 0.12, 2.1, M.marble(), x, 1.2, -1.85 + (3.7 * i) / 6, null, 8);
    box(m, 4.1, 0.2, 4.1, M.stone(), 0, 2.75, 0); prism(m, 4.2, 1.1, 4.2, M.marble(), 0, 2.85, 0, {}); box(m, 4.3, 0.08, 4.3, team, 0, 2.8, 0);
    cyl(m, 0.9, 1.0, 0.5, M.gold(), 0, 3.0, 0, null, 12); sph(m, 0.85, M.gold(), 0, 3.55, 0);
    cone(m, 0.18, 1.2, mat("beam", 0xfff0a0, { emissive: 0xffd070, emissiveIntensity: 1.4, transparent: true, opacity: 0.6 }), 0, 4.7, 0, null, 6);
    for (const [bx, bz] of [[-2.3, 2.3], [2.3, 2.3], [-2.3, -2.3], [2.3, -2.3]]) banner(m, owner, bx, 0.4, bz, 2.8);
  }
  m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // scaffolding shown while building
  const sc = new THREE.Group(); sc.visible = false; g.add(sc);
  const half = { town_center: 2, house: 0.9, farm: 1.5, storehouse: 1, tower: 1, wonder: 2.6 }[kind] ?? 1.5;
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(sc, 0.04, 0.04, 2.4, M.darkWood(), x * half, 1.2, z * half, null, 4);
  for (const y of [0.8, 1.6]) { box(sc, half * 2, 0.04, 0.04, M.wood(), 0, y, half); box(sc, half * 2, 0.04, 0.04, M.wood(), 0, y, -half); box(sc, 0.04, 0.04, half * 2, M.wood(), half, y, 0); box(sc, 0.04, 0.04, half * 2, M.wood(), -half, y, 0); }
  g.userData = { m, scaffold: sc };
  return g;
}
function P_farm(m) {
  for (let i = -2; i <= 2; i++) { box(m, 2.6, 0.14, 0.2, i % 2 ? M.crop() : M.crop2(), 0, 0.16, i * 0.5); }
}

export { put, box, cyl, cone, sph, piv, prism, boxG, cylG, coneG, sphG };
