// Wrath of Olympus — models for the five champions, the myth creatures, the wild monsters and the secrets of the map (Upgrade 26).
// Same low-poly style as models.js. Every unit built here borrows the walk / attack animation of an older unit (P.kind is set to that
// "style"), so one animation routine looks after everybody.
import * as THREE from "three";
import { PLAYER_COLORS } from "./defs";
import { mat, M, teamMat, put, box, cyl, cone, sph, piv, prism, cylG } from "./models";

export const KINDS2 = new Set(["achilles", "odysseus", "atalanta", "hippolyta", "perseus", "minotaur", "centaur", "talos", "wolf", "satyr", "cyclops"]);
const glow = (key, c, i = 1.4) => mat(key, c, { emissive: c, emissiveIntensity: i });
const fur = (key, c) => mat(key, c);

// a person: legs, body, two arms, head — the same skeleton the older soldiers use
function person(P, body, o) {
  const { tunic, scale: sc = 1, legM = M.skin(), skin = M.skin() } = o;
  const hip = piv(body, 0, 0.42 * sc, 0);
  P.legL = piv(hip, -0.1 * sc, 0, 0); P.legR = piv(hip, 0.1 * sc, 0, 0);
  for (const l of [P.legL, P.legR]) box(l, 0.12 * sc, 0.42 * sc, 0.13 * sc, legM, 0, -0.21 * sc, 0);
  box(hip, 0.38 * sc, 0.44 * sc, 0.22 * sc, tunic, 0, 0.24 * sc, 0);
  const sh = piv(hip, 0, 0.42 * sc, 0);
  P.armL = piv(sh, -0.24 * sc, 0, 0); P.armR = piv(sh, 0.24 * sc, 0, 0);
  for (const a of [P.armL, P.armR]) box(a, 0.1 * sc, 0.36 * sc, 0.1 * sc, skin, 0, -0.16 * sc, 0);
  P.head = sph(sh, 0.15 * sc, skin, 0, 0.17 * sc, 0.01);
  P.hip = hip; P.sh = sh; return { hip, sh };
}
const tint = (owner, mix, k) => new THREE.Color(PLAYER_COLORS[owner]).lerp(new THREE.Color(mix), k);

// a four-legged body (horse or wolf) — fills P.horse / P.horseLegs the way the horseman does
function fourLegs(P, body, o) {
  const { hm, len = 0.95, w = 0.42, h = 0.42, legH = 0.58, y = 0.72, legW = 0.1 } = o;
  const hb = piv(body, 0, 0, 0); P.horse = hb; box(hb, w, h, len, hm, 0, y, 0);
  P.horseLegs = [];
  for (const [lx, lz] of [[-w / 3, len * 0.38], [w / 3, len * 0.38], [-w / 3, -len * 0.38], [w / 3, -len * 0.38]]) { const l = piv(hb, lx, legH, lz); box(l, legW, legH, legW, hm, 0, -legH / 2, 0); P.horseLegs.push(l); }
  return hb;
}
function horseFront(hb, hm, mane) {
  box(hb, 0.34, 0.5, 0.2, hm, 0, 1.0, 0.5, { rx: -0.5 }); box(hb, 0.2, 0.22, 0.38, hm, 0, 1.2, 0.72, { rx: 0.2 });
  box(hb, 0.08, 0.28, 0.36, mane, 0, 1.15, 0.38, { rx: -0.5 }); box(hb, 0.06, 0.06, 0.34, mane, 0, 0.82, -0.58, { rx: 0.6 });
}

export function makeUnit2(kind, owner) {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const P = { root, body, kind, owner }; const team = teamMat(owner);
  const dummy = () => piv(body, 0, 0, 0);

  if (kind === "achilles") {
    P.kind = "hoplite"; const sc = 1.4; const { sh } = person(P, body, { tunic: M.cloth(), scale: sc });
    box(sh, 0.42 * sc, 0.3 * sc, 0.26 * sc, M.gold(), 0, -0.14 * sc, 0); box(P.hip, 0.4 * sc, 0.16 * sc, 0.24 * sc, team, 0, 0.04 * sc, 0);
    cyl(sh, 0.17 * sc, 0.17 * sc, 0.17 * sc, M.gold(), 0, 0.22 * sc, 0, null, 10); box(sh, 0.06 * sc, 0.3 * sc, 0.4 * sc, mat("crestred", 0xc0302a), 0, 0.42 * sc, -0.02 * sc);
    box(sh, 0.5 * sc, 0.75 * sc, 0.04, mat("capered", 0xb02a2a), 0, -0.45 * sc, -0.18 * sc); // red cape
    P.shield = cyl(P.armL, 0.26 * sc, 0.26 * sc, 0.04 * sc, M.gold(), -0.1 * sc, -0.2 * sc, 0.1 * sc, { rz: Math.PI / 2 }, 12); cyl(P.shield, 0.09 * sc, 0.09 * sc, 0.06 * sc, M.bronze(), 0, 0.03, 0, null, 8);
    P.weapon = piv(P.armR, 0, -0.3 * sc, 0.05); cyl(P.weapon, 0.02, 0.02, 1.6, M.wood(), 0, 0.2, 0.1, { rx: -1.35 }); cone(P.weapon, 0.05, 0.2, M.iron(), 0, 0.2, 0.9, { rx: Math.PI / 2 - 1.35 });
  } else if (kind === "odysseus") {
    P.kind = "hoplite"; const sc = 1.25; const { sh } = person(P, body, { tunic: mat("odytun", 0x3f8f86), scale: sc });
    box(P.hip, 0.4 * sc, 0.12 * sc, 0.24 * sc, team, 0, 0.04 * sc, 0);
    cone(sh, 0.16 * sc, 0.26 * sc, mat("pilos", 0xe9dcc0), 0, 0.36 * sc, 0, null, 8); // pilos cap
    box(sh, 0.2 * sc, 0.12 * sc, 0.1 * sc, mat("beardm", 0x5a3b22), 0, 0.08 * sc, 0.12 * sc); // beard
    box(sh, 0.52 * sc, 0.8 * sc, 0.04, mat("odycloak", 0x2c6e68), 0, -0.45 * sc, -0.18 * sc);
    P.shield = cyl(P.armL, 0.18 * sc, 0.18 * sc, 0.04 * sc, mat("odysh", 0x4d3a28), -0.1 * sc, -0.2 * sc, 0.1 * sc, { rz: Math.PI / 2 }, 12);
    P.weapon = piv(P.armR, 0, -0.3 * sc, 0.05); box(P.weapon, 0.06, 0.62, 0.03, M.iron(), 0, 0.18, 0.12, { rx: -1.3 }); box(P.weapon, 0.18, 0.05, 0.05, M.bronze(), 0, -0.04, 0.12);
  } else if (kind === "atalanta") {
    P.kind = "archer"; const sc = 1.2; const { sh } = person(P, body, { tunic: mat("atatun", 0x4f9a52), scale: sc });
    box(P.hip, 0.4 * sc, 0.1 * sc, 0.24 * sc, team, 0, 0.04 * sc, 0);
    box(sh, 0.36 * sc, 0.06 * sc, 0.34 * sc, mat("headband", 0xd9b04a), 0, 0.2 * sc, 0); box(sh, 0.09 * sc, 0.44 * sc, 0.1 * sc, mat("atahair", 0x7a4a22), 0, 0.06 * sc, -0.18 * sc, { rx: 0.25 }); // ponytail
    P.weapon = piv(P.armL, 0, -0.3, 0.06);
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.028, 4, 12, Math.PI), mat("atabow", 0xd0b46a)); bow.rotation.z = Math.PI / 2; bow.rotation.y = Math.PI / 2; bow.position.set(0, 0, 0.2); bow.castShadow = true; P.weapon.add(bow);
    cyl(P.body, 0.07, 0.07, 0.42, M.leather(), 0.08, 0.98, -0.2, { rx: 0.25 }, 6); for (let i = 0; i < 3; i++) cyl(P.body, 0.012, 0.012, 0.2, M.wood(), 0.06 + i * 0.03, 1.22, -0.24, { rx: 0.25 }, 4);
  } else if (kind === "hippolyta") {
    P.kind = "horseman"; const hm = mat("hippohorse", 0xf0ebe0); const hb = fourLegs(P, body, { hm }); horseFront(hb, hm, mat("hippomane", 0xb8a888));
    box(hb, 0.47, 0.06, 0.5, mat("hippoblanket", 0xc23a62), 0, 0.95, 0.04);
    const rider = piv(hb, 0, 1.0, -0.02); P.rider = rider;
    box(rider, 0.3, 0.44, 0.2, mat("hippotun", 0xd86a8a), 0, 0.22, 0); box(rider, 0.32, 0.16, 0.22, M.bronze(), 0, 0.28, 0);
    sph(rider, 0.13, M.skin(), 0, 0.57, 0); cyl(rider, 0.15, 0.15, 0.14, M.gold(), 0, 0.64, 0, null, 8); box(rider, 0.05, 0.22, 0.3, mat("hippoplume", 0xd8d8f0), 0, 0.82, -0.04);
    P.weapon = piv(rider, 0.2, 0.3, 0.04); cyl(P.weapon, 0.018, 0.018, 1.3, M.wood(), 0, 0, 0.38, { rx: Math.PI / 2 }); cone(P.weapon, 0.045, 0.18, M.iron(), 0, 0, 1.05, { rx: Math.PI / 2 });
    P.shield = cyl(rider, 0.2, 0.2, 0.04, mat("pelta", 0xe8dcc0), -0.22, 0.28, 0.06, { rz: Math.PI / 2 }, 10);
    root.scale.setScalar(1.12);
  } else if (kind === "perseus") {
    P.kind = "hoplite"; const sc = 1.3; const { sh } = person(P, body, { tunic: mat("perstun", 0x5a52c8), scale: sc });
    box(sh, 0.42 * sc, 0.28 * sc, 0.26 * sc, M.bronze(), 0, -0.14 * sc, 0); box(P.hip, 0.4 * sc, 0.14 * sc, 0.24 * sc, team, 0, 0.04 * sc, 0);
    cyl(sh, 0.17 * sc, 0.17 * sc, 0.14 * sc, M.iron(), 0, 0.22 * sc, 0, null, 10);
    for (const sd of [-1, 1]) { box(sh, 0.04, 0.2 * sc, 0.16 * sc, M.white(), sd * 0.19 * sc, 0.34 * sc, -0.02, { rz: -sd * 0.7 }); box(P.hip, 0.03, 0.16 * sc, 0.14 * sc, M.white(), sd * 0.2 * sc, -0.4 * sc, -0.02, { rz: -sd * 0.6 }); } // wings
    box(sh, 0.5 * sc, 0.8 * sc, 0.04, mat("perscape", 0x2a2480), 0, -0.45 * sc, -0.18 * sc);
    P.shield = cyl(P.armL, 0.24 * sc, 0.24 * sc, 0.04 * sc, mat("mirror", 0xe6f0ff, { metalness: 0.95, roughness: 0.12, emissive: 0x6688cc, emissiveIntensity: 0.25 }), -0.1 * sc, -0.2 * sc, 0.1 * sc, { rz: Math.PI / 2 }, 14);
    P.weapon = piv(P.armR, 0, -0.3 * sc, 0.05); box(P.weapon, 0.07, 0.7, 0.03, M.iron(), 0, 0.18, 0.12, { rx: -1.3 }); box(P.weapon, 0.2, 0.05, 0.05, M.gold(), 0, -0.04, 0.12); box(P.weapon, 0.05, 0.16, 0.03, M.iron(), 0, 0.5, 0.52, { rx: -0.6 });
  } else if (kind === "minotaur") {
    P.kind = "hoplite"; const sc = 1.7; const bull = fur("bull", 0x5a2a1e); const { sh } = person(P, body, { tunic: bull, scale: sc, legM: bull, skin: bull });
    box(P.hip, 0.42 * sc, 0.14 * sc, 0.26 * sc, mat("minoloin", 0x3a2418), 0, 0.04 * sc, 0);
    box(sh, 0.22 * sc, 0.2 * sc, 0.26 * sc, bull, 0, 0.2 * sc, 0.08 * sc); box(sh, 0.12 * sc, 0.1 * sc, 0.1 * sc, mat("snout", 0xb08a70), 0, 0.17 * sc, 0.22 * sc);
    for (const sd of [-1, 1]) { cone(sh, 0.035 * sc, 0.28 * sc, mat("horn", 0xefe6d0), sd * 0.14 * sc, 0.3 * sc, 0.06 * sc, { rz: -sd * 0.9 }, 6); box(sh, 0.025, 0.025, 0.02, glow("eyered", 0xff3a1a, 2), sd * 0.06 * sc, 0.24 * sc, 0.2 * sc); }
    P.weapon = piv(P.armR, 0, -0.3 * sc, 0.05); cyl(P.weapon, 0.04, 0.04, 0.9, M.darkWood(), 0, 0.2, 0.1, { rx: -1.35 }, 6); box(P.weapon, 0.5, 0.3, 0.06, M.iron(), 0, 0.2, 0.7, { rx: -1.35 });
  } else if (kind === "centaur") {
    P.kind = "horseman"; const hm = mat("centhorse", 0x8a5a34); const hb = fourLegs(P, body, { hm, len: 1.1 }); box(hb, 0.3, 0.1, 0.1, hm, 0, 0.95, 0.5); box(hb, 0.08, 0.28, 0.36, M.hair(), 0, 1.1, 0.46, { rx: -0.3 }); box(hb, 0.06, 0.06, 0.4, M.hair(), 0, 0.82, -0.62, { rx: 0.6 });
    const rider = piv(hb, 0, 0.9, 0.38); P.rider = rider; box(rider, 0.3, 0.46, 0.2, M.skin(), 0, 0.25, 0); sph(rider, 0.13, M.skin(), 0, 0.58, 0); box(rider, 0.3, 0.1, 0.22, team, 0, 0.1, 0); box(rider, 0.16, 0.08, 0.06, M.hair(), 0, 0.68, 0.04);
    P.weapon = piv(rider, 0.2, 0.3, 0.04); const bow = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.025, 4, 12, Math.PI), M.wood()); bow.rotation.z = Math.PI / 2; bow.rotation.y = Math.PI / 2; bow.position.set(0, 0, 0.18); P.weapon.add(bow);
    root.scale.setScalar(1.05);
  } else if (kind === "talos") {
    P.kind = "hoplite"; const sc = 2.1; const br = mat("talosbronze", 0xb8793a, { metalness: 0.85, roughness: 0.35 }); const { sh } = person(P, body, { tunic: br, scale: sc, legM: br, skin: br });
    box(P.hip, 0.46 * sc, 0.12 * sc, 0.28 * sc, mat("taloscloth", 0x6b4a2a), 0, 0.04 * sc, 0);
    box(sh, 0.22 * sc, 0.16 * sc, 0.2 * sc, br, 0, 0.22 * sc, 0.0); for (const sd of [-1, 1]) box(sh, 0.05 * sc, 0.02 * sc, 0.02, glow("taloseye", 0xffa030, 2.2), sd * 0.05 * sc, 0.24 * sc, 0.1 * sc);
    box(sh, 0.12 * sc, 0.14 * sc, 0.02, glow("taloschest", 0xff7a1a, 1.8), 0, -0.1 * sc, 0.14 * sc); // furnace heart
    P.weapon = piv(P.armR, 0, -0.3 * sc, 0.05); box(P.weapon, 0.18, 0.5, 0.18, mat("talosfist", 0x8f5a28, { metalness: 0.8 }), 0, 0.05, 0.12);
  } else if (kind === "wolf") {
    P.kind = "horseman"; const wm = fur("wolf", 0x77726a); const hb = fourLegs(P, body, { hm: wm, len: 0.8, w: 0.3, h: 0.3, legH: 0.38, y: 0.5, legW: 0.07 });
    box(hb, 0.2, 0.2, 0.3, wm, 0, 0.65, 0.5); box(hb, 0.12, 0.1, 0.18, mat("wolfsnout", 0x5a554e), 0, 0.62, 0.72); for (const sd of [-1, 1]) { cone(hb, 0.04, 0.1, wm, sd * 0.07, 0.8, 0.46, null, 4); box(hb, 0.02, 0.02, 0.02, glow("wolfeye", 0xffcc33, 2), sd * 0.05, 0.69, 0.64); }
    box(hb, 0.07, 0.07, 0.5, wm, 0, 0.58, -0.6, { rx: 0.5 }); P.rider = dummy(); P.weapon = dummy();
  } else if (kind === "satyr") {
    P.kind = "archer"; const sc = 1.0; const goat = fur("goat", 0x7a5a3a); const { sh } = person(P, body, { tunic: mat("satyrtun", 0x8b5a2b), scale: sc, legM: fur("goatleg", 0x4d3322) });
    for (const sd of [-1, 1]) cone(sh, 0.03, 0.18, mat("horn", 0xefe6d0), sd * 0.08, 0.3, 0, { rz: -sd * 0.5 }, 5);
    box(sh, 0.16, 0.1, 0.1, goat, 0, 0.1, 0.1);
    P.weapon = piv(P.armL, 0, -0.3, 0.06); cyl(P.weapon, 0.025, 0.025, 0.5, M.darkWood(), 0, 0, 0.2, { rx: Math.PI / 2 }, 5); sph(P.weapon, 0.07, mat("sling", 0x6b6258), 0, 0, 0.45);
  } else if (kind === "cyclops") {
    P.kind = "hoplite"; const sc = 2.4; const sk = mat("cyclopsskin", 0x8fa070); const { sh } = person(P, body, { tunic: mat("cyclopstun", 0x6b4a2a), scale: sc, legM: sk, skin: sk });
    box(sh, 0.12 * sc, 0.12 * sc, 0.04, mat("eyew", 0xfff8e0), 0, 0.2 * sc, 0.15 * sc); box(sh, 0.05 * sc, 0.06 * sc, 0.03, glow("cyc", 0x30a0ff, 1.4), 0, 0.2 * sc, 0.18 * sc); // one eye
    P.weapon = piv(P.armR, 0, -0.3 * sc, 0.05); cyl(P.weapon, 0.06, 0.1, 1.5, M.darkWood(), 0, 0.2, 0.3, { rx: -1.25 }, 6);
  }
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
