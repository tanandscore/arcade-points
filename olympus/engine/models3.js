// Wrath of Olympus — realistic-looking bodies, horses and gear (Upgrade 27).
// Rounded limbs (capsules), a tapered torso, a face with eyes and nose, leather-strip skirts, Corinthian helmets, cloaks and painted shields.
// Everything keeps the same "skeleton" (legL, legR, armL, armR, sh, hip, head, weapon, shield, horse, horseLegs, rider) as the older
// blocky models, so walking and fighting animations still work. This file imports nothing from models.js on purpose (no import loops).
import * as THREE from "three";
import { cloth, shieldFace, metalWear, planks } from "./textures";

const _m = {};
export function sm(key, color, extra = {}) { return (_m[key] ||= new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.02, ...extra })); }
export const S = {
  skin: (tone = 0) => sm("skin" + tone, [0xe2aa80, 0xc98e66, 0xeac09a, 0xb87a56][tone % 4], { roughness: 0.62 }),
  hair: (c = 0x3a2616) => sm("hair" + c, c, { roughness: 0.9 }),
  bronze: () => sm("bronzeR", 0xc9903f, { metalness: 0.92, roughness: 0.3, roughnessMap: metalWear() }),
  gold: () => sm("goldR", 0xf0c24c, { metalness: 0.95, roughness: 0.25, emissive: 0x3a2800, emissiveIntensity: 0.25 }),
  iron: () => sm("ironR", 0x9ba0a8, { metalness: 0.9, roughness: 0.38, roughnessMap: metalWear() }),
  steel: () => sm("steelR", 0xd8dde4, { metalness: 0.95, roughness: 0.2 }),
  leather: (c = 0x6e4526) => sm("leatherR" + c, c, { roughness: 0.85 }),
  wood: () => sm("woodR", 0x7a5530, { roughness: 0.85, map: planks(0x7a5530) }),
  linen: (c = 0xe8dcc0) => sm("linenR" + c, c, { roughness: 0.95, map: cloth(c), side: THREE.DoubleSide }),
  dye: (c) => sm("dyeR" + c, c, { roughness: 0.92, map: cloth(c), side: THREE.DoubleSide }),
  dark: () => sm("darkR", 0x1c1612, { roughness: 0.9 }),
  white: () => sm("whiteR", 0xf4f1ea, { roughness: 0.8 }),
  eye: () => sm("eyeR", 0x14100c, { roughness: 0.3 }),
};

const _g = {};
const G = (k, f) => (_g[k] ||= f());
export const capG = (r, l, cs = 4, rs = 8) => G(`cap${r},${l},${cs},${rs}`, () => new THREE.CapsuleGeometry(r, l, cs, rs));
export const cylG2 = (rt, rb, h, s = 10, open = false) => G(`cy${rt},${rb},${h},${s},${open}`, () => new THREE.CylinderGeometry(rt, rb, h, s, 1, open));
export const sphG2 = (r, ws = 12, hs = 9) => G(`sp${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
export const coneG2 = (r, h, s = 8) => G(`co${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s));
export const boxG2 = (w, h, d) => G(`bx${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
export const torusG = (R, r, rs = 6, ts = 16, arc = Math.PI * 2) => G(`to${R},${r},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(R, r, rs, ts, arc));
export function add(parent, geo, m, x = 0, y = 0, z = 0, o = {}) {
  const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z);
  if (o.rx) mesh.rotation.x = o.rx; if (o.ry) mesh.rotation.y = o.ry; if (o.rz) mesh.rotation.z = o.rz; if (o.s) mesh.scale.set(o.s[0], o.s[1], o.s[2]);
  mesh.castShadow = o.cast !== false; mesh.receiveShadow = true; parent.add(mesh); return mesh;
}
export function pv(parent, x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; }

// torso profile (radius by height), turned once and shared
const torsoGeo = (k) => G("torso" + k, () => {
  const pts = [[0.001, 0], [0.15, 0.01], [0.165 * k, 0.1], [0.185 * k, 0.2], [0.215 * k, 0.3], [0.215 * k, 0.38], [0.15, 0.44], [0.07, 0.47], [0.001, 0.48]].map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(pts, 14); g.scale(1, 1, 0.62); return g;
});

// ---------------------------------------------------------------------------------------------------------------------
// A person. o: sc, skin (material), tunic (material for the torso), tunicLen (0 = none), legMat, build (1 = normal, 1.15 = broad), tone,
// hair: "short" | "long" | "pony" | "bald" | "curly", hairCol, beard (bool), sandals (bool), greaves (bool)
export function buildPerson(P, body, o = {}) {
  const sc = o.sc ?? 1, k = o.build ?? 1; const skin = o.skin || S.skin(o.tone || 0);
  const hip = pv(body, 0, 0.42 * sc, 0); P.hip = hip;
  // legs: thigh, shin, foot (sandal straps)
  P.legL = pv(hip, -0.095 * sc * k, 0, 0); P.legR = pv(hip, 0.095 * sc * k, 0, 0);
  for (const l of o.legs === false ? [] : [P.legL, P.legR]) {
    const legM = o.legMat || skin;
    add(l, capG(0.066 * sc * k, 0.15 * sc), legM, 0, -0.13 * sc, 0); add(l, capG(0.05 * sc * k, 0.17 * sc), legM, 0, -0.31 * sc, 0.005 * sc);
    add(l, boxG2(0.085 * sc, 0.045 * sc, 0.17 * sc), o.sandals === false ? S.leather(0x3a2616) : S.leather(), 0, -0.415 * sc, 0.035 * sc);
    if (o.sandals !== false) for (const y of [-0.37, -0.34]) add(l, torusG(0.052 * sc, 0.007 * sc, 4, 10), S.leather(), 0, y * sc, 0.005 * sc, { rx: Math.PI / 2 });
    if (o.greaves) add(l, capG(0.056 * sc * k, 0.15 * sc), S.bronze(), 0, -0.3 * sc, 0.012 * sc);
  }
  // torso
  const tor = add(hip, torsoGeo(k), o.tunic || S.linen(), 0, 0.0, 0); tor.scale.setScalar(sc); P.torso = tor;
  // belt + tunic skirt
  if (o.tunicLen !== 0) {
    const L = (o.tunicLen ?? 0.2) * sc; const sk = add(hip, cylG2(0.185 * sc * k, 0.235 * sc * k, L, 14, true), o.tunic || S.linen(), 0, -L / 2 + 0.03 * sc, 0, { s: [1, 1, 0.74] });
    add(hip, torusG(0.172 * sc * k, 0.017 * sc, 5, 16), S.leather(0x4a2e18), 0, 0.05 * sc, 0, { rx: Math.PI / 2, s: [1, 0.74, 1] });
  }
  // shoulders / arms
  const sh = pv(hip, 0, 0.4 * sc, 0); P.sh = sh;
  P.armL = pv(sh, -0.235 * sc * k, 0, 0); P.armR = pv(sh, 0.235 * sc * k, 0, 0);
  for (const a of [P.armL, P.armR]) {
    add(a, sphG2(0.062 * sc * k, 10, 8), o.sleeve || skin, 0, 0, 0);
    add(a, capG(0.05 * sc * k, 0.13 * sc), o.sleeve || skin, 0, -0.11 * sc, 0); add(a, capG(0.042 * sc * k, 0.12 * sc), skin, 0, -0.26 * sc, 0.01 * sc);
    add(a, sphG2(0.044 * sc, 8, 6), skin, 0, -0.355 * sc, 0.015 * sc);
  }
  // neck + head with a face
  add(sh, cylG2(0.05 * sc, 0.06 * sc, 0.09 * sc, 8), skin, 0, 0.05 * sc, 0);
  const head = pv(sh, 0, 0.17 * sc, 0.005 * sc); P.head = head; if (o.head === false) { P.skinMat = skin; P.sc = sc; return { hip, sh, head }; }
  add(head, sphG2(0.125 * sc, 14, 11), skin, 0, 0.02 * sc, 0, { s: [0.9, 1.08, 1.0] });
  add(head, coneG2(0.022 * sc, 0.06 * sc, 6), skin, 0, 0.0, 0.125 * sc, { rx: Math.PI / 2 });                       // nose
  for (const sd of [-1, 1]) { add(head, sphG2(0.014 * sc, 6, 5), S.eye(), sd * 0.044 * sc, 0.035 * sc, 0.108 * sc); add(head, sphG2(0.026 * sc, 6, 5), skin, sd * 0.113 * sc, 0.0, -0.005 * sc, { s: [0.5, 1, 0.8] }); }
  add(head, boxG2(0.07 * sc, 0.008 * sc, 0.01 * sc), sm("lipR", 0x9a5a48), 0, -0.052 * sc, 0.108 * sc);
  const hc = S.hair(o.hairCol ?? 0x3a2616); const hs = o.hair || "short";
  if (hs !== "bald") { const cap = add(head, new THREE.SphereGeometry(0.133 * sc, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.52), hc, 0, 0.03 * sc, -0.005 * sc, { s: [0.92, 1.08, 1.04] }); if (hs === "curly") for (let i = 0; i < 9; i++) { const a = (i / 9) * 6.28; add(head, sphG2(0.04 * sc, 5, 4), hc, Math.cos(a) * 0.1 * sc, 0.07 * sc, Math.sin(a) * 0.1 * sc - 0.01 * sc); } }
  if (hs === "long" || hs === "pony") { add(head, capG(0.04 * sc, hs === "long" ? 0.2 * sc : 0.16 * sc), hc, 0, hs === "long" ? -0.08 * sc : -0.0, -0.13 * sc, { rx: hs === "pony" ? 0.9 : 0.08 }); }
  if (o.beard) add(head, coneG2(0.07 * sc, 0.16 * sc, 8), hc, 0, -0.1 * sc, 0.065 * sc, { rx: Math.PI * 0.92, s: [1, 1, 0.7] });
  P.skinMat = skin; P.sc = sc; return { hip, sh, head };
}
// ---- gear -----------------------------------------------------------------------------------------------------------------
export function cuirass(P, mat = S.bronze(), sc = P.sc) {
  const c = add(P.hip, torsoGeo(1.07), mat, 0, 0.0, 0, {}); c.scale.set(sc * 1.04, sc * 0.93, sc * 1.1);
  for (const sd of [-1, 1]) add(P.hip, sphG2(0.085 * sc, 10, 8), mat, sd * 0.09 * sc, 0.3 * sc, 0.115 * sc, { s: [1, 0.85, 0.6] }); // chest muscles
  add(P.hip, boxG2(0.012 * sc, 0.2 * sc, 0.01 * sc), S.dark(), 0, 0.3 * sc, 0.135 * sc);
  for (const sd of [-1, 1]) add(P.sh, sphG2(0.075 * sc, 9, 7), mat, sd * 0.2 * sc, 0.0, 0, { s: [1, 0.55, 1] }); // shoulder guards
  return c;
}
export function pteruges(P, mat = S.leather(0x7a4d2a), trim = null, sc = P.sc, n = 12) {
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const x = Math.sin(a) * 0.205 * sc, z = Math.cos(a) * 0.15 * sc; const s = add(P.hip, boxG2(0.058 * sc, 0.17 * sc, 0.012 * sc), mat, x, -0.07 * sc, z, { ry: a, rx: 0.1 * Math.cos(a) }); if (trim) add(P.hip, boxG2(0.058 * sc, 0.022 * sc, 0.014 * sc), trim, x * 1.01, -0.14 * sc, z * 1.01, { ry: a }); }
}
// helmets. type: corinthian | attic | pilos | phrygian | conical | horned | winged | plain.  crest: material or null
export function helmet(P, type, mat = S.bronze(), crest = null, sc = P.sc) {
  const h = P.head, r = 0.138 * sc;
  if (type === "corinthian") {
    add(h, new THREE.SphereGeometry(r, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), mat, 0, 0.03 * sc, 0, { s: [0.94, 1.1, 1.06] });
    add(h, boxG2(0.03 * sc, 0.1 * sc, 0.03 * sc), mat, 0, -0.01 * sc, 0.128 * sc);                                   // nose guard
    for (const sd of [-1, 1]) add(h, boxG2(0.03 * sc, 0.11 * sc, 0.09 * sc), mat, sd * 0.105 * sc, -0.04 * sc, 0.045 * sc);   // cheek guards
    if (crest) { add(h, boxG2(0.03 * sc, 0.025 * sc, 0.2 * sc), mat, 0, 0.165 * sc, -0.01 * sc); const cr = add(h, capG(0.03 * sc, 0.2 * sc, 3, 6), crest, 0, 0.2 * sc, -0.015 * sc, { rx: Math.PI / 2, s: [1.3, 1, 1.6] }); }
  } else if (type === "attic") {
    add(h, new THREE.SphereGeometry(r, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mat, 0, 0.03 * sc, 0, { s: [0.94, 1.08, 1.05] });
    for (const sd of [-1, 1]) add(h, boxG2(0.026 * sc, 0.08 * sc, 0.08 * sc), mat, sd * 0.108 * sc, -0.03 * sc, 0.03 * sc);
    if (crest) add(h, capG(0.026 * sc, 0.14 * sc, 3, 6), crest, 0, 0.165 * sc, -0.01 * sc, { rx: Math.PI / 2, s: [1.2, 1, 1.4] });
  } else if (type === "pilos") { add(h, coneG2(r * 0.95, 0.2 * sc, 12), mat, 0, 0.14 * sc, 0, { s: [1, 1, 1.05] }); add(h, torusG(r * 0.95, 0.012 * sc, 4, 14), mat, 0, 0.05 * sc, 0, { rx: Math.PI / 2 }); }
  else if (type === "phrygian") { add(h, coneG2(r, 0.22 * sc, 12), mat, 0, 0.13 * sc, 0.02 * sc, { rx: -0.3 }); }
  else if (type === "conical") { add(h, coneG2(r * 1.02, 0.17 * sc, 12), mat, 0, 0.12 * sc, 0); add(h, torusG(r, 0.014 * sc, 4, 14), mat, 0, 0.05 * sc, 0, { rx: Math.PI / 2 }); }
  else if (type === "horned") { add(h, new THREE.SphereGeometry(r, 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.5), mat, 0, 0.03 * sc, 0, { s: [0.94, 1.05, 1.05] }); for (const sd of [-1, 1]) add(h, coneG2(0.03 * sc, 0.18 * sc, 6), S.white(), sd * 0.12 * sc, 0.1 * sc, 0, { rz: -sd * 0.8 }); }
  else if (type === "winged") {
    add(h, new THREE.SphereGeometry(r, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), mat, 0, 0.03 * sc, 0, { s: [0.94, 1.08, 1.05] });
    for (const sd of [-1, 1]) for (let i = 0; i < 3; i++) add(h, boxG2(0.012 * sc, 0.1 * sc, 0.045 * sc), S.white(), sd * (0.14 + i * 0.012) * sc, (0.06 + i * 0.03) * sc, -0.01 * sc, { rz: -sd * (0.5 + i * 0.25) });
  }
}
export function cape(P, mat, len = 0.75, sc = P.sc, w = 0.42) {
  const c = add(P.sh, new THREE.PlaneGeometry(w * sc, len * sc, 4, 6), mat, 0, 0.0 - (len * sc) / 2 + 0.05 * sc, -0.16 * sc, { rx: 0.12 }); c.material = mat.side === THREE.DoubleSide ? mat : mat; 
  const pos = c.geometry.attributes.position; if (!c.geometry.userData.folded) { for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); pos.setZ(i, Math.sin(x * 14) * 0.02 * sc + (0.5 - y / (len * sc)) * 0.02); } c.geometry.computeVertexNormals(); c.geometry.userData.folded = true; }
  add(P.sh, boxG2(0.07 * sc, 0.025 * sc, 0.025 * sc), S.gold(), 0, 0.04 * sc, -0.12 * sc); return c;
}
export function roundShield(arm, sc, hex = 0xb03030, device = "ring", r = 0.25) {
  const g = pv(arm, -0.07 * sc, -0.2 * sc, 0.1 * sc); g.rotation.y = Math.PI / 2;
  const face = add(g, new THREE.CylinderGeometry(r * sc, r * sc, 0.035 * sc, 24), [S.bronze(), S.bronze(), new THREE.MeshStandardMaterial({ map: shieldFace(hex, device), roughness: 0.55, metalness: 0.3 })], 0, 0, 0, { rx: Math.PI / 2 });
  add(g, torusG(r * sc, 0.016 * sc, 5, 24), S.bronze(), 0, 0, 0.018 * sc); add(g, sphG2(0.05 * sc, 8, 6), S.bronze(), 0, 0, 0.03 * sc, { s: [1, 1, 0.55] }); return g;
}
export function spear(weapon, sc, len = 1.6, tip = S.iron()) {
  const g = pv(weapon, 0, 0.2 * sc, 0.1 * sc); g.rotation.x = 1.35;
  add(g, cylG2(0.017 * sc, 0.02 * sc, len * sc, 6), S.wood(), 0, 0, 0);
  add(g, coneG2(0.036 * sc, 0.22 * sc, 4), tip, 0, len * sc * 0.5 + 0.1 * sc, 0); add(g, cylG2(0.024 * sc, 0.024 * sc, 0.05 * sc, 6), S.bronze(), 0, len * sc * 0.5 - 0.01 * sc, 0);
  add(g, coneG2(0.02 * sc, 0.1 * sc, 5), S.bronze(), 0, -len * sc * 0.5 - 0.04 * sc, 0, { rx: Math.PI });
  return g;
}
export function sword(weapon, sc, len = 0.6, blade = S.steel(), hilt = S.gold()) {
  add(weapon, boxG2(0.045 * sc, len * sc, 0.012 * sc), blade, 0, 0.1 * sc + len * sc * 0.5, 0.12 * sc, { rx: -1.3 });
  add(weapon, boxG2(0.17 * sc, 0.03 * sc, 0.03 * sc), hilt, 0, 0.0, 0.12 * sc); add(weapon, cylG2(0.016 * sc, 0.016 * sc, 0.1 * sc, 6), S.leather(0x3a2616), 0, -0.05 * sc, 0.12 * sc);
}
export function bow(weapon, sc, col = 0x6a4a2a, r = 0.4) {
  const b = add(weapon, torusG(r * sc, 0.02 * sc, 5, 16, Math.PI), sm("bowR" + col, col, { roughness: 0.7 }), 0, 0, 0.18 * sc, { rz: Math.PI / 2, ry: Math.PI / 2 });
  add(weapon, cylG2(0.003 * sc, 0.003 * sc, r * 2 * sc, 3), sm("stringR", 0xe8e0c8), 0, 0, 0.18 * sc, { }); return b;
}
export function quiver(P, sc = P.sc) {
  add(P.hip, capG(0.05 * sc, 0.3 * sc, 3, 8), S.leather(0x5a3a20), 0.1 * sc, 0.38 * sc, -0.16 * sc, { rx: 0.3, rz: -0.2 });
  for (let i = 0; i < 4; i++) add(P.hip, cylG2(0.006 * sc, 0.006 * sc, 0.2 * sc, 4), S.wood(), (0.08 + i * 0.012) * sc, 0.58 * sc, -0.2 * sc, { rx: 0.3 });
}

// ---------------------------------------------------------------------------------------------------------------------
// A horse. o: coat (material), mane (material), len (body length), h (height scale), blanket (material | null), armor (bool)
export function buildHorse(P, body, o = {}) {
  const coat = o.coat || sm("coatR", 0x7a4b2a, { roughness: 0.7 }), mane = o.mane || sm("maneR", 0x1d140d, { roughness: 0.9 }); const L = o.len ?? 1, H = o.h ?? 1;
  const hb = pv(body, 0, 0, 0); P.horse = hb;
  add(hb, capG(0.215 * H, 0.45 * L, 5, 10), coat, 0, 0.8 * H, 0, { rx: Math.PI / 2 });                      // barrel
  add(hb, sphG2(0.24 * H, 10, 8), coat, 0, 0.83 * H, 0.36 * L, { s: [1, 1.05, 1] }); add(hb, sphG2(0.235 * H, 10, 8), coat, 0, 0.82 * H, -0.34 * L, { s: [1, 1, 1.05] }); // chest, rump
  const neck = pv(hb, 0, 0.98 * H, 0.46 * L); neck.rotation.x = -0.75; add(neck, capG(0.105 * H, 0.34 * H, 4, 8), coat, 0, 0.2 * H, 0);
  const head = pv(neck, 0, 0.43 * H, 0.02); head.rotation.x = 1.15; add(head, capG(0.075 * H, 0.2 * H, 4, 8), coat, 0, 0.1 * H, 0.0); add(head, capG(0.05 * H, 0.1 * H, 3, 8), sm("muzzleR", 0x3a2a20, { roughness: 0.8 }), 0, 0.24 * H, 0);
  for (const sd of [-1, 1]) { add(head, coneG2(0.025 * H, 0.08 * H, 5), coat, sd * 0.045 * H, -0.04 * H, -0.04 * H, { rx: -0.2 }); add(head, sphG2(0.014 * H, 6, 5), S.eye(), sd * 0.07 * H, 0.08 * H, 0.03 * H); }
  for (let i = 0; i < 7; i++) add(neck, boxG2(0.03 * H, 0.1 * H, 0.05 * H), mane, 0, (0.06 + i * 0.065) * H, -0.1 * H, { rx: 0.4 + i * 0.05 });
  add(hb, capG(0.04 * H, 0.32 * H, 3, 6), mane, 0, 0.78 * H, -0.62 * L, { rx: -0.35 });                       // tail
  P.horseLegs = [];
  for (const [lx, lz, f] of [[-0.12, 0.34, 1], [0.12, 0.34, 1], [-0.12, -0.34, 0], [0.12, -0.34, 0]]) {
    const l = pv(hb, lx * H, 0.62 * H, lz * L); add(l, capG(0.072 * H, 0.2 * H, 4, 7), coat, 0, -0.14 * H, f ? 0.0 : -0.02 * H); add(l, capG(0.042 * H, 0.2 * H, 3, 7), coat, 0, -0.38 * H, 0); add(l, cylG2(0.05 * H, 0.056 * H, 0.06 * H, 7), S.dark(), 0, -0.56 * H, 0.0); P.horseLegs.push(l);
  }
  if (o.blanket) { add(hb, boxG2(0.5 * H, 0.04 * H, 0.52 * L), o.blanket, 0, 1.0 * H, 0.0); add(hb, boxG2(0.52 * H, 0.2 * H, 0.04), o.blanket, 0, 0.9 * H, 0.26 * L, {}); add(hb, boxG2(0.52 * H, 0.2 * H, 0.04), o.blanket, 0, 0.9 * H, -0.26 * L, {}); }
  add(hb, boxG2(0.3 * H, 0.05 * H, 0.3 * L), S.leather(0x4a2e18), 0, 1.04 * H, 0.0); // saddle
  add(neck, torusG(0.1 * H, 0.008 * H, 4, 10), S.leather(0x2a1a10), 0, 0.5 * H, 0.03 * H, { rx: Math.PI / 2 }); // bridle ring
  if (o.armor) { add(hb, capG(0.22 * H, 0.3 * L, 3, 8), S.bronze(), 0, 0.86 * H, 0.1, { rx: Math.PI / 2, s: [1.05, 1.0, 1.0] }); }
  return hb;
}

// a wolf (or any lean four-legged animal): o: coat, h (size)
export function buildWolf(P, body, o = {}) {
  const coat = o.coat || sm("wolfR", 0x7b766d, { roughness: 0.95 }), H = o.h ?? 1; const hb = pv(body, 0, 0, 0); P.horse = hb;
  add(hb, capG(0.13 * H, 0.42 * H, 4, 8), coat, 0, 0.5 * H, 0, { rx: Math.PI / 2 }); add(hb, sphG2(0.15 * H, 8, 7), coat, 0, 0.53 * H, 0.26 * H, { s: [1, 1.05, 1] });
  add(hb, capG(0.085 * H, 0.14 * H, 3, 7), coat, 0, 0.62 * H, 0.42 * H, { rx: 0.9 });
  const head = pv(hb, 0, 0.7 * H, 0.52 * H); add(head, sphG2(0.095 * H, 9, 7), coat, 0, 0, 0, { s: [0.95, 0.9, 1.05] }); add(head, capG(0.045 * H, 0.1 * H, 3, 7), sm("wolfsnoutR", 0x5e5850), 0, -0.025 * H, 0.1 * H, { rx: Math.PI / 2 }); add(head, sphG2(0.016 * H, 6, 5), S.eye(), 0, -0.02 * H, 0.17 * H);
  for (const sd of [-1, 1]) { add(head, coneG2(0.035 * H, 0.09 * H, 4), coat, sd * 0.055 * H, 0.1 * H, -0.02 * H); add(head, sphG2(0.013 * H, 6, 5), sm("wolfEyeR", 0xffcc33, { emissive: 0xffaa00, emissiveIntensity: 1.6 }), sd * 0.05 * H, 0.025 * H, 0.08 * H); }
  add(hb, capG(0.045 * H, 0.3 * H, 3, 6), coat, 0, 0.48 * H, -0.42 * H, { rx: -0.9 });
  P.horseLegs = []; for (const [lx, lz] of [[-0.085, 0.24], [0.085, 0.24], [-0.085, -0.26], [0.085, -0.26]]) { const l = pv(hb, lx * H, 0.38 * H, lz * H); add(l, capG(0.05 * H, 0.14 * H, 3, 6), coat, 0, -0.1 * H, 0); add(l, capG(0.032 * H, 0.14 * H, 3, 6), coat, 0, -0.26 * H, 0.01 * H); P.horseLegs.push(l); }
  return hb;
}

// ---------------------------------------------------------------------------------------------------------------------
// Speed: a detailed figure is ~60 little meshes, which would be slow with a big army. Every animated part (each leg, each arm, the head,
// the torso...) is welded into one mesh per material, so the figure costs about 20 draws instead of 60 and still walks and fights.
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
export function mergeRig(P, extraPivots = []) {
  const pivots = new Set([P.body, P.hip, P.sh, P.head, P.legL, P.legR, P.armL, P.armR, P.horse, P.rider, P.weapon, P.tool, P.arm, P.shield, ...(P.horseLegs || []), ...extraPivots].filter(Boolean));
  // the neck pivots above `body` also include every group the animation touches; find nested pivots by identity
  const tmp = new THREE.Matrix4();
  const process = (pivot) => {
    const bucket = new Map(); const keep = [];
    const walk = (node, acc) => {
      for (const ch of [...node.children]) {
        ch.updateMatrix(); const m = acc.clone().multiply(ch.matrix);
        if (pivots.has(ch)) continue;                       // another animated part: handled by its own pass
        if (ch.isMesh && !Array.isArray(ch.material) && ch.visible && !ch.userData.noMerge) {
          const g = ch.geometry.clone(); g.applyMatrix4(m); if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
          if (g.index) { const ng = g.toNonIndexed(); g.dispose(); bucket.get(ch.material) ? bucket.get(ch.material).push(ng) : bucket.set(ch.material, [ng]); } else { bucket.get(ch.material) ? bucket.get(ch.material).push(g) : bucket.set(ch.material, [g]); }
          node.remove(ch);
        } else if (ch.isGroup || ch.isObject3D) walk(ch, m);
      }
    };
    walk(pivot, new THREE.Matrix4());
    for (const [material, list] of bucket) {
      for (const g of list) { for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k); }
      const merged = mergeGeometries(list, false); if (!merged) continue; const mesh = new THREE.Mesh(merged, material); mesh.castShadow = true; mesh.receiveShadow = true; pivot.add(mesh);
      for (const g of list) g.dispose();
    }
  };
  for (const pv of pivots) process(pv);
  return P;
}
