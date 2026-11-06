// Wrath of Olympus — models for the five champions, the myth creatures, the wild monsters and the secrets of the map (Upgrade 26).
// Same low-poly style as models.js. Every unit built here borrows the walk / attack animation of an older unit (P.kind is set to that
// "style"), so one animation routine looks after everybody.
import * as THREE from "three";
import { PLAYER_COLORS } from "./defs";
import { mat, M, teamMat, put, box, cyl, cone, sph, piv, prism } from "./models";
import { S as S3, sm as sm3, add as add3, mergeRig, pv, buildPerson, buildHorse, buildWolf, cuirass, pteruges, helmet, cape, roundShield, spear, sword, bow, quiver, capG, cylG2, sphG2, coneG2, boxG2, torusG } from "./models3";

export const KINDS2 = new Set(["achilles", "odysseus", "atalanta", "hippolyta", "perseus", "minotaur", "centaur", "talos", "wolf", "satyr", "cyclops"]);
const glow = (key, c, i = 1.4) => mat(key, c, { emissive: c, emissiveIntensity: i });
const fur = (key, c) => mat(key, c);

const tint = (owner, mix, k) => new THREE.Color(PLAYER_COLORS[owner]).lerp(new THREE.Color(mix), k);

export function makeUnit2(kind, owner) {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const P = { root, body, kind, owner }; const tcol = PLAYER_COLORS[owner] ?? 0x888888; const teamCloth = S3.dye(tcol);
  const dummy = () => pv(body, 0, 0, 0);
  const metal = (k, c, e = {}) => sm3(k, c, { metalness: 0.9, roughness: 0.32, ...e });

  if (kind === "achilles") {
    P.kind = "hoplite"; const sc = 1.38;
    buildPerson(P, body, { sc, build: 1.14, tone: 0, tunic: S3.linen(0xf2ead6), tunicLen: 0.22, greaves: true, hair: "short", hairCol: 0x9a6a2a });
    cuirass(P, S3.gold()); pteruges(P, S3.linen(0xf2ead6), S3.gold(), sc, 14);
    helmet(P, "corinthian", S3.gold(), S3.dye(0xc0302a));
    cape(P, S3.dye(0xb02a2a), 0.8, sc, 0.5);
    P.shield = roundShield(P.armL, sc, 0xd8a838, "star", 0.28);
    P.weapon = pv(P.armR, 0, -0.3 * sc, 0.05); spear(P.weapon, sc, 1.9, S3.steel());
  } else if (kind === "odysseus") {
    P.kind = "hoplite"; const sc = 1.24;
    buildPerson(P, body, { sc, build: 1.0, tone: 1, tunic: S3.dye(0x3f8f86), tunicLen: 0.24, sleeve: S3.dye(0x3f8f86), hair: "curly", hairCol: 0x2a1a10, beard: true });
    helmet(P, "pilos", S3.linen(0xe9dcc0));
    cape(P, S3.dye(0x24605a), 0.7, sc, 0.46);
    add3(P.hip, torusG(0.18 * sc, 0.012 * sc, 4, 14), S3.gold(), 0, 0.2 * sc, 0, { rx: Math.PI / 2, s: [1, 0.74, 1] });
    P.shield = roundShield(P.armL, sc, 0x6a4a2a, "ring", 0.2);
    P.weapon = pv(P.armR, 0, -0.3 * sc, 0.05); sword(P.weapon, sc, 0.66);
  } else if (kind === "atalanta") {
    P.kind = "archer"; const sc = 1.2;
    buildPerson(P, body, { sc, build: 0.88, tone: 2, tunic: S3.dye(0x4f9a52), tunicLen: 0.2, hair: "pony", hairCol: 0x7a4a22 });
    add3(P.head, torusG(0.128 * sc, 0.014 * sc, 4, 16), S3.gold(), 0, 0.07 * sc, 0, { rx: Math.PI / 2 });
    for (const a of [P.armL, P.armR]) add3(a, capG(0.046 * sc, 0.1 * sc, 3, 8), S3.leather(0x8a5a30), 0, -0.25 * sc, 0.01 * sc);
    cape(P, S3.dye(0x2f6a3a), 0.45, sc, 0.3);
    P.weapon = pv(P.armL, 0, -0.3 * sc, 0.06); bow(P.weapon, sc, 0xd0b46a, 0.46); quiver(P, sc);
  } else if (kind === "hippolyta") {
    P.kind = "horseman";
    const hb = buildHorse(P, body, { coat: sm3("hippoCoat", 0xf2eee4, { roughness: 0.65 }), mane: sm3("hippoMane", 0xcfc6b0), blanket: S3.dye(0xc23a62), armor: false });
    const rider = pv(hb, 0, 1.04, -0.02); P.rider = rider; rider.scale.setScalar(1.0);
    buildPerson(P, rider, { sc: 1.0, build: 0.95, tone: 3, tunic: S3.dye(0xd86a8a), tunicLen: 0.14, hair: "long", hairCol: 0x1a1210 });
    for (const [l, sd] of [[P.legL, -1], [P.legR, 1]]) { l.rotation.x = -0.7; l.rotation.z = sd * 0.35; }
    cuirass(P, S3.bronze()); helmet(P, "attic", S3.gold(), S3.white());
    P.weapon = pv(P.armR, 0, -0.3, 0.05); spear(P.weapon, 1.0, 1.9, S3.steel()); P.shield = roundShield(P.armL, 1.0, 0xe8dcc0, "ring", 0.2);
    root.scale.setScalar(1.1);
  } else if (kind === "perseus") {
    P.kind = "hoplite"; const sc = 1.3;
    buildPerson(P, body, { sc, build: 1.05, tone: 0, tunic: S3.dye(0x5a52c8), tunicLen: 0.2, hair: "curly", hairCol: 0x1c1410 });
    cuirass(P, S3.bronze()); helmet(P, "winged", S3.iron());
    cape(P, S3.dye(0x2a2480), 0.82, sc, 0.5);
    for (const l of [P.legL, P.legR]) for (const sd of [-1, 1]) add3(l, boxG2(0.012 * sc, 0.1 * sc, 0.06 * sc), S3.white(), sd * 0.06 * sc, -0.4 * sc, -0.03 * sc, { rz: -sd * 0.7 }); // winged sandals
    P.shield = roundShield(P.armL, sc, 0xdfe8f5, "ring", 0.26); P.shield.children[0].material[2] = sm3("mirrorR", 0xeef4ff, { metalness: 1, roughness: 0.08 });
    P.weapon = pv(P.armR, 0, -0.3 * sc, 0.05); sword(P.weapon, sc, 0.7); add3(P.weapon, boxG2(0.05 * sc, 0.18 * sc, 0.014 * sc), S3.steel(), 0, 0.1 * sc + 0.74 * sc * 0.5 + 0.34 * sc, 0.4 * sc, { rx: -0.4 });
  } else if (kind === "minotaur") {
    P.kind = "hoplite"; const sc = 1.7; const bull = sm3("bullR", 0x6a3a28, { roughness: 0.95 });
    buildPerson(P, body, { sc, build: 1.38, skin: bull, tunic: bull, tunicLen: 0, legMat: bull, sandals: false, head: false });
    add3(P.hip, cylG2(0.2 * sc, 0.26 * sc, 0.16 * sc, 12, true), S3.leather(0x3a2418), 0, -0.02 * sc, 0, { s: [1, 1, 0.8] }); add3(P.hip, torusG(0.2 * sc, 0.025 * sc, 5, 16), S3.gold(), 0, 0.06 * sc, 0, { rx: Math.PI / 2, s: [1, 0.8, 1] });
    const h = P.head; add3(h, sphG2(0.14 * sc, 12, 9), bull, 0, 0.02 * sc, 0.0, { s: [1, 1, 1.05] }); add3(h, capG(0.07 * sc, 0.12 * sc, 4, 8), sm3("snoutR", 0x8a6a58, { roughness: 0.8 }), 0, -0.04 * sc, 0.14 * sc, { rx: Math.PI / 2 });
    add3(h, torusG(0.03 * sc, 0.007 * sc, 4, 10), S3.gold(), 0, -0.08 * sc, 0.2 * sc);
    for (const sd of [-1, 1]) { add3(h, torusG(0.13 * sc, 0.024 * sc, 5, 10, Math.PI * 0.75), S3.white(), sd * 0.1 * sc, 0.1 * sc, 0.0, { rz: sd > 0 ? -0.2 : Math.PI + 0.2 }); add3(h, coneG2(0.04 * sc, 0.1 * sc, 5), bull, sd * 0.15 * sc, 0.03 * sc, -0.02 * sc, { rz: -sd * 1.3 }); add3(h, sphG2(0.017 * sc, 6, 5), sm3("rageEye", 0xff3a1a, { emissive: 0xff2200, emissiveIntensity: 2 }), sd * 0.06 * sc, 0.05 * sc, 0.12 * sc); }
    P.weapon = pv(P.armR, 0, -0.3 * sc, 0.05); const ax = pv(P.weapon, 0, 0.2 * sc, 0.2 * sc); ax.rotation.x = 1.2; add3(ax, cylG2(0.03 * sc, 0.035 * sc, 1.0 * sc, 7), S3.wood(), 0, 0, 0); for (const sd of [-1, 1]) add3(ax, new THREE.CylinderGeometry(0.22 * sc, 0.02 * sc, 0.04 * sc, 4, 1), S3.iron(), 0.12 * sc * sd, 0.4 * sc, 0, { rz: Math.PI / 2 * sd, s: [1, 1, 1.4] });
  } else if (kind === "centaur") {
    P.kind = "horseman"; const hb = buildHorse(P, body, { coat: sm3("centCoat", 0x8a5a34, { roughness: 0.75 }), mane: sm3("centMane", 0x1c120a), len: 1.1 });
    const rider = pv(hb, 0, 0.9, 0.42); P.rider = rider; buildPerson(P, rider, { sc: 1.0, build: 1.05, tone: 1, tunic: S3.skin(1), tunicLen: 0, legs: false, hair: "long", hairCol: 0x1c120a, beard: true });
    cuirass(P, S3.leather(0x6a4a2a)); add3(P.hip, torusG(0.2, 0.04, 6, 16), S3.leather(0x3a2616), 0, 0.02, 0, { rx: Math.PI / 2, s: [1, 0.8, 1] });
    P.weapon = pv(P.armL, 0, -0.3, 0.06); bow(P.weapon, 1.0, 0x6a4a2a, 0.44); quiver(P);
    root.scale.setScalar(1.05);
  } else if (kind === "talos") {
    P.kind = "hoplite"; const sc = 2.1; const br = metal("talosR", 0xb8793a, { roughness: 0.4 });
    buildPerson(P, body, { sc, build: 1.45, skin: br, tunic: br, tunicLen: 0.1, legMat: br, sandals: false, head: false });
    for (const y of [0.1, 0.2, 0.3]) add3(P.hip, torusG(0.19 * sc, 0.014 * sc, 4, 18), S3.gold(), 0, y * sc, 0, { rx: Math.PI / 2, s: [1, 0.62, 1] });
    add3(P.hip, new THREE.CircleGeometry(0.06 * sc, 12), sm3("furnaceR", 0xff7a1a, { emissive: 0xff5a10, emissiveIntensity: 2.2, side: THREE.DoubleSide }), 0, 0.3 * sc, 0.135 * sc);
    const h = P.head; add3(h, sphG2(0.13 * sc, 12, 9), br, 0, 0.02 * sc, 0, { s: [1, 1.1, 1] }); add3(h, boxG2(0.17 * sc, 0.025 * sc, 0.02 * sc), sm3("talosEye", 0xffa030, { emissive: 0xff8a10, emissiveIntensity: 2.4 }), 0, 0.04 * sc, 0.125 * sc); add3(h, boxG2(0.03 * sc, 0.2 * sc, 0.2 * sc), br, 0, 0.14 * sc, 0, {});
    P.weapon = pv(P.armR, 0, -0.3 * sc, 0.05); add3(P.weapon, sphG2(0.1 * sc, 8, 6), br, 0, 0.06 * sc, 0.1 * sc, { s: [1.3, 1.3, 1.3] });
  } else if (kind === "wolf") {
    P.kind = "horseman"; buildWolf(P, body, { h: 1 }); P.rider = dummy(); P.weapon = dummy();
  } else if (kind === "satyr") {
    P.kind = "archer"; const sc = 1.0; const goat = sm3("goatR", 0x4d3322, { roughness: 0.95 });
    buildPerson(P, body, { sc, build: 0.95, tone: 1, tunic: S3.leather(0x8b5a2b), tunicLen: 0.1, legMat: goat, sandals: false, hair: "curly", hairCol: 0x2a1a10, beard: true });
    for (const l of [P.legL, P.legR]) add3(l, coneG2(0.04 * sc, 0.08 * sc, 5), S3.dark(), 0, -0.44 * sc, 0.02 * sc, { rx: Math.PI });
    for (const sd of [-1, 1]) { add3(P.head, coneG2(0.03 * sc, 0.2 * sc, 6), sm3("satyrHorn", 0xe4d8bc), sd * 0.08 * sc, 0.16 * sc, 0, { rz: -sd * 0.5 }); add3(P.head, coneG2(0.03 * sc, 0.1 * sc, 4), S3.skin(1), sd * 0.13 * sc, 0.05 * sc, 0, { rz: -sd * 1.3 }); }
    P.weapon = pv(P.armL, 0, -0.3, 0.06); add3(P.weapon, cylG2(0.02 * sc, 0.02 * sc, 0.5 * sc, 6), S3.wood(), 0, 0, 0.2 * sc, { rx: Math.PI / 2 }); add3(P.weapon, sphG2(0.07 * sc, 8, 6), sm3("sling", 0x6b6258), 0, 0, 0.5 * sc);
  } else if (kind === "cyclops") {
    P.kind = "hoplite"; const sc = 2.4; const sk = sm3("cyclopsSkin", 0x8a9a74, { roughness: 0.85 });
    buildPerson(P, body, { sc, build: 1.4, skin: sk, tunic: S3.leather(0x6b4a2a), tunicLen: 0.2, legMat: sk, sandals: false, head: false });
    const h = P.head; add3(h, sphG2(0.14 * sc, 12, 9), sk, 0, 0.02 * sc, 0, { s: [1, 1.05, 1] }); add3(h, sphG2(0.075 * sc, 10, 8), sm3("eyeWhite", 0xf4efdc), 0, 0.04 * sc, 0.11 * sc, { s: [1, 0.9, 0.6] }); add3(h, sphG2(0.035 * sc, 8, 6), sm3("irisBlue", 0x3a90e0, { emissive: 0x104870, emissiveIntensity: 0.8 }), 0, 0.04 * sc, 0.145 * sc, { s: [1, 1, 0.5] });
    add3(h, boxG2(0.2 * sc, 0.04 * sc, 0.06 * sc), sk, 0, 0.11 * sc, 0.1 * sc, { rx: 0.2 }); for (const sd of [-1, 1]) add3(h, coneG2(0.02 * sc, 0.08 * sc, 5), S3.white(), sd * 0.05 * sc, -0.08 * sc, 0.12 * sc, { rx: Math.PI });
    P.weapon = pv(P.armR, 0, -0.3 * sc, 0.05); const cl = pv(P.weapon, 0, 0.2 * sc, 0.2 * sc); cl.rotation.x = 1.15; add3(cl, cylG2(0.04 * sc, 0.08 * sc, 1.4 * sc, 7), S3.wood(), 0, 0.1 * sc, 0); for (let i = 0; i < 6; i++) add3(cl, coneG2(0.02 * sc, 0.1 * sc, 4), S3.iron(), Math.cos(i * 1.05) * 0.08 * sc, (0.45 + (i % 3) * 0.1) * sc, Math.sin(i * 1.05) * 0.08 * sc, { rz: -Math.cos(i * 1.05) * 1.3 });
  }
  mergeRig(P);
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return P;
}

// ================================ secrets of the map ================================================================
const stoneM = () => M.stone(), darkM = () => mat("lairdark", 0x2a2420);
export function makePoi(poi, kind) {
  const g = new THREE.Group(); g.userData.spin = [];
  if (poi === "shrine") {
    cyl(g, 1.9, 2.0, 0.18, M.stoneD(), 0, 0.09, 0, null, 14); cyl(g, 1.5, 1.6, 0.14, M.stone(), 0, 0.25, 0, null, 14);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; cyl(g, 0.12, 0.14, 1.5, M.marble(), Math.cos(a) * 1.2, 1.0, Math.sin(a) * 1.2, null, 8); }
    cyl(g, 1.45, 1.45, 0.12, M.stone(), 0, 1.82, 0, null, 14);
    const orb = sph(g, 0.34, glow("shrineorb", 0xb48aff, 1.8), 0, 1.1, 0); g.userData.float = orb; g.userData.floatY = 1.1;
    cyl(g, 0.04, 0.2, 2.6, mat("shrinebeam", 0xc8aaff, { emissive: 0xb48aff, emissiveIntensity: 1.5, transparent: true, opacity: 0.28, depthWrite: false }), 0, 2.4, 0, null, 8);
  } else if (kind === "wolves") {
    for (let i = 0; i < 6; i++) { const a = i * 1.05; cone(g, 0.8 - i * 0.05, 1.0 + (i % 3) * 0.4, mat("wolfrock" + (i % 2), i % 2 ? 0x6b665e : 0x55514a), Math.cos(a) * 1.1, 0.4, Math.sin(a) * 1.1, { ry: a }, 5); }
    box(g, 0.9, 0.9, 0.12, darkM(), 0, 0.5, 0.95); for (let i = 0; i < 5; i++) box(g, 0.3, 0.05, 0.06, mat("bone", 0xe8e0cc), -0.9 + i * 0.5, 0.05, 1.5 + (i % 2) * 0.3, { ry: i });
  } else if (kind === "satyrs") {
    for (const [x, z, c] of [[-1.0, -0.6, 0x9a5a3a], [0.9, -0.4, 0x7a4a6a], [0.1, 0.8, 0x8a7a3a]]) cone(g, 0.8, 1.3, mat("tent" + c, c), x, 0.65, z, null, 6);
    cyl(g, 0.3, 0.34, 0.14, M.stoneD(), 0, 0.07, 1.6, null, 8); cone(g, 0.2, 0.45, glow("campfire", 0xff8a2a, 1.6), 0, 0.35, 1.6, null, 6);
    for (let i = 0; i < 3; i++) cyl(g, 0.03, 0.03, 1.4, M.darkWood(), -1.8 + i * 0.1, 0.7, 0.9 + i * 0.3, null, 4);
  } else if (kind === "cyclops") {
    for (let i = 0; i < 7; i++) { const a = i * 0.9; cone(g, 1.3 - i * 0.08, 2.0 + (i % 3) * 0.7, mat("cycrock" + (i % 2), i % 2 ? 0x8a867c : 0x6f6b62), Math.cos(a) * 1.5, 0.9, Math.sin(a) * 1.5, { ry: a }, 5); }
    box(g, 1.3, 1.4, 0.2, darkM(), 0, 0.8, 1.55); for (let i = 0; i < 4; i++) sph(g, 0.13, mat("skull", 0xe8e0cc), -1.0 + i * 0.5, 0.14, 2.0 + (i % 2) * 0.3);
    sph(g, 0.1, glow("cyceye", 0x30a0ff, 2), -0.2, 1.1, 1.66); sph(g, 0.1, glow("cyceye", 0x30a0ff, 2), 0.2, 1.1, 1.66);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
export function makeRelic(relic) {
  const g = new THREE.Group(); cyl(g, 0.4, 0.5, 0.3, M.stone(), 0, 0.15, 0, null, 8);
  const hold = piv(g, 0, 0.9, 0); g.userData.spin = hold;
  const gold = glow("relicgold", 0xffd45a, 1.2);
  if (relic === "spear") { cyl(hold, 0.03, 0.03, 1.0, gold, 0, 0, 0, null, 5); cone(hold, 0.07, 0.25, gold, 0, 0.62, 0, null, 5); }
  else if (relic === "aegis") { cyl(hold, 0.36, 0.36, 0.06, gold, 0, 0, 0, { rx: Math.PI / 2 }, 14); sph(hold, 0.1, glow("gorgon", 0xa0e0ff, 1.5), 0, 0, 0.05); }
  else if (relic === "fleece") { sph(hold, 0.28, glow("fleece", 0xffe9a0, 1.0), 0, 0, 0, { s: [1.4, 0.8, 1] }); }
  else { cyl(hold, 0.18, 0.1, 0.3, gold, 0, 0, 0, null, 10); cyl(hold, 0.2, 0.2, 0.05, glow("nectar", 0xff9ad0, 1.3), 0, 0.16, 0, null, 10); }
  cyl(g, 0.05, 0.3, 3.2, mat("relicbeam", 0xfff0a0, { emissive: 0xffd45a, emissiveIntensity: 1.2, transparent: true, opacity: 0.22, depthWrite: false }), 0, 2.4, 0, null, 8);
  g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  return g;
}
export function animatePoi(g, time) {
  if (g.userData.float) g.userData.float.position.y = g.userData.floatY + Math.sin(time * 2) * 0.12;
  if (g.userData.spin && g.userData.spin.isObject3D) { g.userData.spin.rotation.y = time * 1.4; g.userData.spin.position.y = 0.9 + Math.sin(time * 2.2) * 0.1; }
}
