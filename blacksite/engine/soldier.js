// Operation Blacksite — a human soldier. Real proportions (1.8 m), a proper skeleton (pelvis, spine, chest, neck, head,
// two-bone arms and legs), a sculpted head with a painted face, uniform, plate carrier, helmet or balaclava, boots and gloves,
// and a detailed rifle that BOTH hands hold through live two-bone IK. Everyone is a little different: skin, face, hair, gear.
//
// Faces -Z (the way a camera looks at yaw 0). poseSoldier() drives all animation from outside.
//   buildSoldier(team, { seed, weapon })   poseSoldier(u, { speed, crouch, pitch, fire, dead, dt, baseY, aim, weapon })
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { makeGlow } from "@/lib/cinematic/atmos";
import { gunParts } from "./guns";
import { muzzleStarTex } from "./fx";
import { cpuCanvas } from "./cpucanvas";

export const TEAM_LOOK = {
  terrorist: { vest: 0x3a1a1c, fat: 0x2c2f2a, accent: 0xff5a3c, name: "NIGHTFALL" },
  police: { vest: 0x15263c, fat: 0x1c2636, accent: 0x3ea8ff, name: "SENTINEL" },
};

// ---------------------------------------------------------------------------------------------------------------------------------
const rngOf = (seed) => { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const cv = (w, h) => cpuCanvas(w, h);
const tex = (c, srgb = true, rep = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
const hex = (n) => "#" + n.toString(16).padStart(6, "0");

const SKIN = [[0xf0c8a4, 0xd9a47c], [0xe2b088, 0xc48a62], [0xc99068, 0xa8704c], [0xa4704c, 0x84553a], [0x7a5036, 0x5f3d29], [0x5a3a28, 0x45291b]]; // light ... dark
const HAIR = [0x16110d, 0x2a1d12, 0x4a3320, 0x6a4a2a, 0x8a6a3a, 0x9a9a98, 0x0c0c0c];

// ---- shared textures -----------------------------------------------------------------------------------------------------------
const shared = {};
function weave(kind) {
  if (shared["w" + kind]) return shared["w" + kind];
  const S = 128, c = cv(S, S), g = c.getContext("2d"), r = rngOf(kind.length * 17 + 3);
  if (kind === "camo") { // dark digital camouflage, in blocks big enough to read at a distance
    g.fillStyle = "#3d4434"; g.fillRect(0, 0, S, S); const cols = ["#2c3326", "#4c5442", "#1e241b", "#5a6249", "#6a6a50"];
    for (let i = 0; i < 150; i++) { g.fillStyle = cols[(r() * cols.length) | 0]; const w = 8 + ((r() * 3) | 0) * 8, h = 8 + ((r() * 3) | 0) * 8; g.fillRect(((r() * S) / 8 | 0) * 8, ((r() * S) / 8 | 0) * 8, w, h); }
  } else { g.fillStyle = "#cfcfcf"; g.fillRect(0, 0, S, S); }
  g.globalAlpha = kind === "camo" ? 0.05 : 0.12; for (let y = 0; y < S; y += 2) { g.fillStyle = y % 4 ? "#000" : "#fff"; g.fillRect(0, y, S, 1); } for (let x = 0; x < S; x += 2) { g.fillStyle = x % 4 ? "#000" : "#fff"; g.fillRect(x, 0, 1, S); } g.globalAlpha = 1;
  const im = g.getImageData(0, 0, S, S), d = im.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 22; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(im, 0, 0);
  return (shared["w" + kind] = tex(c));
}
function skinNoise(tone) {
  const k = "s" + tone; if (shared[k]) return shared[k]; const c = cv(64, 64), g = c.getContext("2d"), r = rngOf(tone + 40); g.fillStyle = "#ffffff"; g.fillRect(0, 0, 64, 64);
  const im = g.getImageData(0, 0, 64, 64), d = im.data; for (let i = 0; i < d.length; i += 4) { const n = 238 + r() * 17; d[i] = n; d[i + 1] = n - 6; d[i + 2] = n - 10; } g.putImageData(im, 0, 0); return (shared[k] = tex(c));
}

// The face is painted once per look and mapped flat onto the front of the head.
function faceTexture(look) {
  const key = "f" + look.key; if (shared[key]) return shared[key];
  const S = 256, c = cv(S, S), g = c.getContext("2d"), r = rngOf(look.seed * 7 + 11); const [lt, dk] = SKIN[look.skin];
  const gr = g.createRadialGradient(S / 2, S * 0.45, 20, S / 2, S * 0.5, S * 0.62); gr.addColorStop(0, hex(lt)); gr.addColorStop(1, hex(dk)); g.fillStyle = gr; g.fillRect(0, 0, S, S);
  if (look.mask) { // balaclava: knitted fabric with only the eyes showing
    g.fillStyle = hex(look.maskColor); g.fillRect(0, 0, S, S); g.globalAlpha = 0.4; for (let y = 0; y < S; y += 3) { g.fillStyle = y % 6 ? "#000" : "#444"; g.fillRect(0, y, S, 1.4); } g.globalAlpha = 1;
    g.fillStyle = hex(lt); g.beginPath(); g.moveTo(58, 104); g.quadraticCurveTo(128, 88, 198, 104); g.quadraticCurveTo(200, 128, 190, 134); g.quadraticCurveTo(128, 124, 66, 134); g.quadraticCurveTo(56, 128, 58, 104); g.fill();
  } else {
    // stubble / beard
    if (look.beard) { g.fillStyle = hex(look.hair); g.globalAlpha = look.beard === 2 ? 0.8 : 0.3; g.beginPath(); g.moveTo(40, 150); g.quadraticCurveTo(128, 300, 216, 150); g.lineTo(200, 128); g.quadraticCurveTo(128, 170, 56, 128); g.fill(); g.globalAlpha = 1; for (let i = 0; i < 700; i++) { g.fillStyle = hex(look.hair); g.globalAlpha = 0.2 + r() * 0.3; g.fillRect(50 + r() * 156, 140 + r() * 86, 1.2, 1.2); } g.globalAlpha = 1; }
    // lips and nose shading, mouth line
    g.strokeStyle = "rgba(60,20,16,0.85)"; g.lineWidth = 3.2; g.beginPath(); g.moveTo(104, 190); g.quadraticCurveTo(128, 196, 152, 190); g.stroke(); g.fillStyle = "rgba(150,70,64,0.5)"; g.beginPath(); g.ellipse(128, 186, 20, 4.5, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(128, 199, 17, 5, 0, 0, 7); g.fill();
    g.fillStyle = "rgba(60,30,20,0.35)"; g.beginPath(); g.ellipse(112, 168, 5, 3, 0, 0, 7); g.ellipse(144, 168, 5, 3, 0, 0, 7); g.fill();
    for (let i = 0; i < 120; i++) { g.fillStyle = `rgba(80,40,30,${0.03 + r() * 0.05})`; g.fillRect(r() * S, 60 + r() * 150, 1.5, 1.5); }
  }
  // eyes: socket shadow, sclera, iris, pupil, lid line, brows
  const eye = (cx) => {
    g.fillStyle = "rgba(40,20,20,0.28)"; g.beginPath(); g.ellipse(cx, 112, 26, 15, 0, 0, 7); g.fill();
    g.fillStyle = "#e8e6e0"; g.beginPath(); g.ellipse(cx, 113, 14, 7, 0, 0, 7); g.fill();
    g.fillStyle = hex(look.eye); g.beginPath(); g.arc(cx, 113, 6.6, 0, 7); g.fill(); g.fillStyle = "#050505"; g.beginPath(); g.arc(cx, 113, 3.1, 0, 7); g.fill(); g.fillStyle = "rgba(255,255,255,0.85)"; g.fillRect(cx - 3, 109.5, 2.4, 2.4);
    g.strokeStyle = "rgba(20,10,8,0.9)"; g.lineWidth = 2.4; g.beginPath(); g.moveTo(cx - 15, 114); g.quadraticCurveTo(cx, 101, cx + 15, 114); g.stroke();
  };
  eye(88); eye(168);
  if (!look.mask) { g.strokeStyle = hex(look.hair); g.lineWidth = 5.5; g.lineCap = "round"; for (const [x0, x1, y0, y1] of [[66, 108, 88, 84], [148, 190, 84, 88]]) { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo((x0 + x1) / 2, Math.min(y0, y1) - 7, x1, y1); g.stroke(); } }
  const t = tex(c, true, false); shared[key] = t; return t;
}

// ---- materials -----------------------------------------------------------------------------------------------------------------
const matCache = new Map();
function mat(key, make) { let m = matCache.get(key); if (!m) { m = make(); matCache.set(key, m); } return m; }
const MAT = {
  cloth: () => mat("cloth", () => new THREE.MeshStandardMaterial({ map: weave("cloth"), vertexColors: true, roughness: 0.95, metalness: 0 })),
  camo: () => mat("camo", () => new THREE.MeshStandardMaterial({ map: weave("camo"), vertexColors: true, roughness: 0.95, metalness: 0 })),
  gear: () => mat("gear", () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.15 })),
  rubber: () => mat("rubber", () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.02 })),
  metal: () => mat("metal", () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.52, metalness: 0.7 })),
  poly: () => mat("poly", () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0.08 })),
  wood: () => mat("wood", () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.68, metalness: 0.03 })),
  glow: () => mat("glow", () => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })),
  glass: () => mat("glass", () => new THREE.MeshStandardMaterial({ color: 0x0a1218, roughness: 0.08, metalness: 0.9, emissive: 0x1a3a4a, emissiveIntensity: 0.5 })),
  skin: (tone) => mat("skin" + tone, () => new THREE.MeshStandardMaterial({ map: skinNoise(tone), vertexColors: true, roughness: 0.62, metalness: 0 })),
};

// ---- geometry helpers ----------------------------------------------------------------------------------------------------------------
const Q = new THREE.Quaternion(), E = new THREE.Euler(), M4 = new THREE.Matrix4(), V3 = new THREE.Vector3(), S3 = new THREE.Vector3(), COL = new THREE.Color();
function place(geo, o = {}) {
  let g = geo.index ? geo.toNonIndexed() : geo.clone(); for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k); E.set(o.rx || 0, o.ry || 0, o.rz || 0); Q.setFromEuler(E); M4.compose(V3.set(o.x || 0, o.y || 0, o.z || 0), Q, S3.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1)); g.applyMatrix4(M4);
  const n = g.attributes.position.count, c = new Float32Array(n * 3); COL.set(o.color ?? 0xffffff); for (let i = 0; i < n; i++) { c[i * 3] = COL.r; c[i * 3 + 1] = COL.g; c[i * 3 + 2] = COL.b; } g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}
const geoCache = {};
const G = {
  box: (w, h, d, r = 0.012) => { const k = `b${w}_${h}_${d}_${r}`; return (geoCache[k] ||= new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) / 2.2))); },
  cap: (r, l) => { const k = `c${r}_${l}`; return (geoCache[k] ||= new THREE.CapsuleGeometry(r, l, 4, 10)); },
  cyl: (r1, r2, h, seg = 10) => { const k = `y${r1}_${r2}_${h}_${seg}`; return (geoCache[k] ||= new THREE.CylinderGeometry(r1, r2, h, seg)); },
  sph: (r, ws = 12, hs = 9) => { const k = `s${r}_${ws}`; return (geoCache[k] ||= new THREE.SphereGeometry(r, ws, hs)); },
};
// a limb segment hanging down from its pivot (0 -> -len), slightly tapered by using a capsule
const limb = (r, len, o = {}) => ({ geo: G.cap(r, Math.max(0.001, len - 2 * r)), o: { y: -len / 2, ...o } });

// the head: an egg with a jaw, brow, cheekbones, nose and chin pushed out of a sphere
function headGeo() {
  if (geoCache.head) return geoCache.head;
  const g = new THREE.SphereGeometry(1, 40, 30); const p = g.attributes.position, uv = g.attributes.uv; const rx = 0.078, ry = 0.112, rz = 0.1;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i); // unit sphere; front is -z
    const low = Math.max(0, -y); x *= 1 - 0.3 * low * low - 0.06 * low; // jaw tapers
    const front = Math.max(0, -z);
    let X = x * rx, Y = y * ry, Z = z * rz;
    Z -= front * 0.012 * Math.max(0, -y) * 1.6; // chin forward
    const bump = (cx, cy, s, h) => { const d = ((X - cx) * (X - cx)) / (s * s) + ((Y - cy) * (Y - cy)) / (s * s * 1.5); return h * Math.exp(-d); };
    if (z < 0) { Z -= bump(0, -0.012, 0.016, 0.022) + bump(0, 0.045, 0.058, 0.007) * 1.2 + bump(-0.034, -0.028, 0.03, 0.006) + bump(0.034, -0.028, 0.03, 0.006) + bump(0, 0.062, 0.05, 0.007) + bump(0, -0.075, 0.02, 0.005); }
    p.setXYZ(i, X, Y, Z); uv.setXY(i, 0.5 + X / (2 * 0.082), 0.5 + (Y - 0.0) / (2 * 0.118) + 0.02);
  }
  g.computeVertexNormals(); return (geoCache.head = g);
}
const EAR = new THREE.SphereGeometry(1, 8, 6);

// ---- weapon world-models ---------------------------------------------------------------------------------------------------------
// every weapon is built in gun space: barrel along -Z, up is +Y, origin near the trigger. Returns the parts and the grip points.
const weaponParts = gunParts;
const MATKEY = { metal: MAT.metal, poly: MAT.poly, wood: MAT.wood, glow: MAT.glow, glass: MAT.glass, rubber: MAT.rubber, gear: MAT.gear };
function buildWeaponMesh(id, team) {
  const w = weaponParts(id, team); const by = {};
  for (const [m, geo, o] of w.P) (by[m] ||= []).push(place(geo, o));
  const g = new THREE.Group();
  for (const k of Object.keys(by)) { const merged = mergeGeometries(by[k], false); const me = new THREE.Mesh(merged, k === "glass" ? MAT.glass() : MATKEY[k]()); me.castShadow = true; me.receiveShadow = false; g.add(me); }
  return { group: g, muzzle: new THREE.Vector3(...w.muzzle), gripR: new THREE.Vector3(...w.r), gripL: new THREE.Vector3(...w.l), flashSize: w.flashSize };
}

// ---- the soldier ---------------------------------------------------------------------------------------------------------------------
const LOOK_CACHE = new Map();
function lookFor(team, seed) {
  const r = rngOf(seed * 131 + (team === "police" ? 7 : 3)); const T0 = team === "terrorist";
  const skin = Math.min(5, Math.floor(Math.pow(r(), 1.3) * 6)); const hair = Math.floor(r() * HAIR.length);
  return { team, seed, key: `${team}${seed}`, skin, hair: HAIR[hair], hairIdx: hair, beard: r() < (T0 ? 0.55 : 0.3) ? (r() < 0.4 ? 2 : 1) : 0, eye: [0x3a2a1a, 0x4a3a22, 0x2a4a6a, 0x3a5a3a, 0x6a6a6a][Math.floor(r() * 5)],
    mask: T0 && r() < 0.6, maskColor: [0x151515, 0x2a2e26, 0x3a1818][Math.floor(r() * 3)], cap: T0 ? (r() < 0.45 ? 1 : 0) : 0, helmet: !T0, scarf: T0 && r() < 0.5, scarfColor: [0x6a5a3a, 0x3a3a3c, 0x7a2a2a][Math.floor(r() * 3)],
    scale: 0.97 + r() * 0.07, wide: 0.94 + r() * 0.14, glasses: r() < 0.35, ear: r() < 0.7, vestTone: Math.floor(r() * 3), pants: Math.floor(r() * 3), gloves: r() < 0.8 };
}

export function buildSoldier(team, opts = {}) {
  const L = TEAM_LOOK[team]; const T0 = team === "terrorist"; const seed = opts.seed ?? Math.floor(Math.random() * 9999); const look = lookFor(team, seed);
  const root = new THREE.Group(); const u = { root, team, look, walkPhase: Math.random() * 6, aimK: 0, weaponId: null, breath: Math.random() * 6, dyingYaw: (Math.random() - 0.5) * 0.7 };
  const parts = {}; // bone -> material -> geometries
  const part = (bone, matKey, geo, o) => { ((parts[bone] ||= {})[matKey] ||= []).push(place(geo, o)); };
  const bones = {}; const mk = (name, parent, x = 0, y = 0, z = 0) => { const gr = new THREE.Group(); gr.position.set(x, y, z); parent.add(gr); bones[name] = gr; return gr; };
  const sc = look.scale; root.scale.set(look.wide * sc, sc, look.wide * sc);

  // colours
  // Believable field uniforms: Nightfall in dusty olive-khaki and camo with a dark brown vest, Sentinel in dark navy with a black plate carrier.
  // The team markings are cloth-coloured tape (readable at distance, never neon).
  const cloth = T0 ? 0x66634a : 0x1f2b40; const clothDk = T0 ? 0x403e2e : 0x141c2c; const vestC = (T0 ? [[0x3e342a, 0x42392a, 0x3c2e26], [0x34302a, 0x3a3628, 0x40322c], [0x453c2e, 0x3a3326, 0x45342a]] : [[0x1c2638, 0x1a2336, 0x202b3e], [0x182234, 0x1f2a3c, 0x1b2535], [0x222e44, 0x1c2840, 0x18223a]])[look.vestTone % 3][look.vestTone % 3];
  const accDim = new THREE.Color(L.accent).multiplyScalar(0.3).getHex();
  const gearC = 0x1b1c1f; const bootC = T0 ? 0x2a2018 : 0x141416; const skinTone = SKIN[look.skin][0];
  const pantsMat = T0 ? "camo" : "cloth", pantsC = T0 ? [0xe8e6d6, 0xd4d0bc, 0xc4c0aa][look.pants] : 0x1c283c;

  // skeleton
  const hips = mk("hips", root, 0, 0.93, 0); const spine = mk("spine", hips, 0, 0.06, 0); const chest = mk("chest", spine, 0, 0.19, 0); const neck = mk("neck", chest, 0, 0.27, 0); const head = mk("head", neck, 0, 0.07, 0);
  const sh = (sx) => mk(sx < 0 ? "uaL" : "uaR", chest, sx * 0.185, 0.2, 0.0); const uaL = sh(-1), uaR = sh(1);
  const faL = mk("faL", uaL, 0, -0.29, 0), faR = mk("faR", uaR, 0, -0.29, 0); const handL = mk("handL", faL, 0, -0.27, 0), handR = mk("handR", faR, 0, -0.27, 0);
  const thL = mk("thL", hips, -0.095, -0.02, 0), thR = mk("thR", hips, 0.095, -0.02, 0); const knL = mk("knL", thL, 0, -0.44, 0), knR = mk("knR", thR, 0, -0.44, 0); const ftL = mk("ftL", knL, 0, -0.43, 0), ftR = mk("ftR", knR, 0, -0.43, 0);
  u.bones = bones; head.scale.setScalar(1.14);

  // pelvis, belt, holster
  part("hips", pantsMat, G.box(0.33, 0.2, 0.2, 0.05), { y: -0.01, color: pantsC }); part("hips", "gear", G.box(0.35, 0.05, 0.22, 0.012), { y: 0.075, color: 0x23252a });
  part("hips", "metal", G.box(0.05, 0.035, 0.012, 0.004), { y: 0.075, z: -0.116, color: 0x8a8d92 });
  part("hips", "gear", G.box(0.06, 0.15, 0.1, 0.02), { x: 0.2, y: -0.06, z: -0.02, color: 0x16171a }); part("hips", "gear", G.box(0.07, 0.07, 0.05, 0.012), { x: -0.17, y: 0.0, z: -0.09, color: 0x1a1b1e });
  // lower torso (abdomen) and chest as lathe-like ellipsoids
  part("spine", "cloth", G.cyl(0.155, 0.17, 0.2, 14), { y: 0.1, sx: 1.0, sz: 0.7, color: cloth }); part("spine", "gear", G.box(0.34, 0.06, 0.2, 0.02), { y: 0.05, color: 0x1e2024 });
  part("chest", "cloth", G.cyl(0.165, 0.145, 0.34, 16), { y: 0.1, sx: 1.05, sz: 0.7, color: cloth });
  part("chest", "cloth", G.sph(0.085, 12, 8), { x: -0.165, y: 0.22, sx: 1.0, sy: 0.9, sz: 0.9, color: cloth }); part("chest", "cloth", G.sph(0.085, 12, 8), { x: 0.165, y: 0.22, sx: 1.0, sy: 0.9, sz: 0.9, color: cloth });
  // plate carrier: front and back plates, shoulder straps, cummerbund, pouches, radio
  part("chest", "gear", G.box(0.27, 0.34, 0.06, 0.03), { y: 0.1, z: -0.1, color: vestC }); part("chest", "gear", G.box(0.27, 0.34, 0.06, 0.03), { y: 0.1, z: 0.1, color: vestC });
  part("chest", "gear", G.box(0.31, 0.12, 0.22, 0.03), { y: -0.04, color: vestC });
  for (const s of [-1, 1]) { part("chest", "gear", G.box(0.06, 0.16, 0.04, 0.015), { x: s * 0.09, y: 0.25, z: -0.07, rx: 0.1, color: vestC }); part("chest", "gear", G.box(0.06, 0.16, 0.04, 0.015), { x: s * 0.09, y: 0.25, z: 0.07, rx: -0.1, color: vestC }); part("chest", "gear", G.box(0.07, 0.025, 0.16, 0.012), { x: s * 0.11, y: 0.31, z: 0.0, color: vestC }); }
  for (let i = -1; i <= 1; i++) part("chest", "gear", G.box(0.075, 0.12, 0.05, 0.012), { x: i * 0.088, y: 0.0, z: -0.16, color: 0x24262a });
  part("chest", "gear", G.box(0.09, 0.13, 0.06, 0.012), { x: -0.2, y: -0.01, z: -0.04, color: 0x24262a }); part("chest", "metal", G.box(0.032, 0.17, 0.02, 0.004), { x: 0.17, y: 0.17, z: -0.145, color: 0x15161a });
  part("chest", "glow", G.box(0.17, 0.03, 0.01, 0.003), { x: 0.0, y: 0.2, z: -0.14, color: accDim }); part("chest", "glow", G.box(0.17, 0.03, 0.01, 0.003), { x: 0.0, y: 0.2, z: 0.2, color: accDim }); // team chest + back strips
  part("chest", "gear", G.box(0.12, 0.2, 0.08, 0.02), { y: 0.1, z: 0.17, color: 0x23262a }); // back pouch
  // neck, collar, scarf
  part("neck", "skin" + look.skin, G.cyl(0.05, 0.058, 0.13, 10), { y: 0.0, color: skinTone }); part("neck", "cloth", G.cyl(0.075, 0.09, 0.05, 12), { y: -0.04, sx: 1, sz: 0.9, color: cloth });
  if (look.scarf) part("neck", "cloth", G.cyl(0.085, 0.1, 0.1, 12), { y: 0.0, sx: 1.05, sz: 0.95, color: look.scarfColor });
  // head
  const hg = headGeo(); const faceMat = new THREE.MeshStandardMaterial({ map: faceTexture(look), roughness: 0.58, metalness: 0 }); u._faceMat = faceMat; const headMesh = new THREE.Mesh(hg, faceMat); headMesh.position.y = 0.03; headMesh.castShadow = true; head.add(headMesh);
  if (look.ear) for (const s of [-1, 1]) part("head", "skin" + look.skin, EAR, { x: s * 0.077, y: 0.025, z: 0.0, sx: 0.012, sy: 0.03, sz: 0.022, color: skinTone });
  if (!look.mask) { // hair: short crop on a cap of the head
    if (look.hairIdx !== 5 || true) part("head", "cloth", G.sph(0.105, 16, 10), { y: 0.075, z: 0.012, sx: 0.8, sy: 0.62, sz: 0.97, color: look.hair });
  }
  if (T0) { // beanie or cap, shemagh edges
    if (look.cap) { part("head", "cloth", G.sph(0.112, 16, 10), { y: 0.085, z: 0.0, sx: 0.8, sy: 0.7, sz: 0.97, color: 0x1a1c18 }); part("head", "cloth", G.box(0.15, 0.012, 0.09, 0.005), { y: 0.065, z: -0.12, rx: 0.1, color: 0x1a1c18 }); }
    else part("head", "cloth", G.sph(0.114, 16, 10), { y: 0.082, z: 0.0, sx: 0.8, sy: 0.74, sz: 0.98, color: [0x4a4030, 0x5a4a38, 0x6a5a40][look.skin % 3] });
    part("head", "glow", G.box(0.215, 0.026, 0.215, 0.01), { y: 0.06, z: 0.0, color: accDim }); // orange head-wrap
  } else { // police helmet: shell, brim, rail with NVG mount, chin strap, headset
    part("head", "gear", G.sph(0.125, 20, 12), { y: 0.075, z: 0.005, sx: 0.88, sy: 0.82, sz: 1.04, color: 0x1f2b44 }); part("head", "glow", G.box(0.2, 0.022, 0.2, 0.01), { y: 0.1, z: 0.0, color: accDim });
    part("head", "gear", G.box(0.19, 0.016, 0.12, 0.008), { y: 0.09, z: -0.1, rx: 0.12, color: 0x1a1d24 }); part("head", "gear", G.box(0.17, 0.03, 0.05, 0.008), { y: 0.0, z: 0.14, color: 0x14161b });
    part("head", "gear", G.box(0.07, 0.06, 0.04, 0.008), { y: 0.12, z: -0.095, color: 0x23262c }); part("head", "metal", G.box(0.03, 0.03, 0.03, 0.004), { y: 0.125, z: -0.12, color: 0x2a2c30 });
    for (const s of [-1, 1]) { part("head", "gear", G.cyl(0.04, 0.04, 0.03, 12), { x: s * 0.095, y: 0.02, z: 0.02, rz: Math.PI / 2, color: 0x16181c }); part("head", "gear", G.box(0.012, 0.15, 0.012, 0.004), { x: s * 0.07, y: -0.05, z: -0.02, color: 0x15161a }); }
    part("head", "gear", G.box(0.008, 0.07, 0.008, 0.002), { x: 0.092, y: -0.05, z: 0.04, rx: 0.5, color: 0x0e0f11 });
  }
  if (look.glasses || !T0) { part("head", "glass", G.box(0.15, 0.036, 0.03, 0.01), { y: 0.036, z: -0.098, color: 0xffffff }); part("head", "gear", G.box(0.16, 0.012, 0.03, 0.004), { y: 0.058, z: -0.098, color: 0x15161a }); }
  // legs, knee pads, cargo pockets, boots
  for (const s of [-1, 1]) {
    const th = s < 0 ? "thL" : "thR", kn = s < 0 ? "knL" : "knR", ft = s < 0 ? "ftL" : "ftR";
    const a = limb(0.083, 0.46); part(th, pantsMat, a.geo, { ...a.o, sx: 1.0, sz: 1.05, color: pantsC }); part(th, "cloth", G.box(0.07, 0.15, 0.1, 0.02), { x: s * 0.075, y: -0.2, z: -0.01, color: T0 ? 0x3a3f30 : 0x182a42 });
    const b = limb(0.066, 0.45); part(kn, pantsMat, b.geo, { ...b.o, color: pantsC }); part(kn, "gear", G.box(0.11, 0.13, 0.08, 0.03), { y: -0.02, z: -0.06, color: gearC }); part(kn, "gear", G.cyl(0.07, 0.062, 0.05, 10), { y: -0.39, color: 0x1c1d20 });
    part(ft, "rubber", G.box(0.105, 0.1, 0.27, 0.03), { y: -0.05, z: -0.04, color: bootC }); part(ft, "rubber", G.box(0.11, 0.035, 0.29, 0.015), { y: -0.095, z: -0.045, color: 0x0c0c0d }); part(ft, "rubber", G.box(0.09, 0.14, 0.09, 0.03), { y: 0.03, z: 0.04, color: bootC });
    part(ft, "gear", G.box(0.06, 0.012, 0.03, 0.004), { y: 0.01, z: -0.04, color: 0x2a2c30 });
  }
  // arms (sleeves, forearms, gloves)
  for (const s of [-1, 1]) {
    const ua = s < 0 ? "uaL" : "uaR", fa = s < 0 ? "faL" : "faR", ha = s < 0 ? "handL" : "handR";
    const a = limb(0.043, 0.32); part(ua, "cloth", a.geo, { ...a.o, color: cloth }); part(ua, "glow", G.cyl(0.056, 0.056, 0.085, 12), { y: -0.1, color: accDim }); part(ua, "gear", G.sph(0.052, 10, 8), { y: 0.0, sx: 1.1, sy: 0.9, color: vestC });
    const b = limb(0.035, 0.3); part(fa, "cloth", b.geo, { ...b.o, color: cloth }); part(fa, "gear", G.box(0.09, 0.07, 0.09, 0.02), { y: -0.04, color: gearC });
    const gc = look.gloves ? 0x1a1b1d : skinTone; const gm = look.gloves ? "gear" : "skin" + look.skin;
    part(ha, gm, G.box(0.075, 0.1, 0.045, 0.014), { y: -0.04, color: gc }); part(ha, gm, G.box(0.07, 0.065, 0.03, 0.012), { y: -0.1, z: -0.012, rx: -0.5, color: gc }); part(ha, gm, G.box(0.03, 0.065, 0.025, 0.01), { x: s * -0.045, y: -0.05, z: -0.02, rz: s * 0.4, color: gc });
  }
  // build merged meshes, one per bone per material
  const meshes = [];
  for (const bone of Object.keys(parts)) for (const mk2 of Object.keys(parts[bone])) {
    const list = parts[bone][mk2]; const geo = mergeGeometries(list, false); const m = mk2.startsWith("skin") ? MAT.skin(+mk2.slice(4)) : MAT[mk2](); const me = new THREE.Mesh(geo, m); me.castShadow = true; me.receiveShadow = false; bones[bone].add(me); meshes.push(me);
  }
  // held weapon
  const gun = new THREE.Group(); chest.add(gun); u.gun = gun; u.gunHolder = null;
  const mflash = makeGlow(0xffd27a, 0.7, 0); mflash.material.map = muzzleStarTex(); mflash.material.color.setHex(0xffffff); mflash.material.needsUpdate = true; mflash.material.rotation = Math.random() * 6.28; gun.add(mflash); u.mflash = mflash; u.flashLight = null;
  u.setWeapon = (id) => {
    if (u.weaponId === id) return; u.weaponId = id; if (u.gunMesh) { gun.remove(u.gunMesh); } const w = buildWeaponMesh(id, team); u.gunMesh = w.group; gun.add(w.group); u.grips = w; mflash.position.copy(w.muzzle); mflash.scale.setScalar(Math.max(0.01, w.flashSize) * 0.7); u.flashSize = w.flashSize;
  };
  u.setWeapon(opts.weapon || "pistol");
  u.chest = chest; u.spine = spine; u.hips = hips; u.head = head; u.neck = neck; u.upper = spine;
  u._tmp = { sh: new THREE.Vector3(), t: new THREE.Vector3(), elbow: new THREE.Vector3(), dir: new THREE.Vector3(), pole: new THREE.Vector3(), q: new THREE.Quaternion(), down: new THREE.Vector3(0, -1, 0), v: new THREE.Vector3() };
  return u;
}

// ---- animation ---------------------------------------------------------------------------------------------------------------------------
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, t) => { t = clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// two-bone IK for one arm. Everything is in chest space.
function ik(u, ua, fa, shoulder, target, l1, l2, poleX, poleY, poleZ) {
  const T = u._tmp; T.t.copy(target).sub(shoulder); let dist = T.t.length(); const maxD = l1 + l2 - 0.002, minD = Math.abs(l1 - l2) + 0.02; dist = clamp(dist, minD, maxD); T.dir.copy(T.t).normalize();
  const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  T.pole.set(poleX, poleY, poleZ); T.pole.addScaledVector(T.dir, -T.pole.dot(T.dir)).normalize();
  T.elbow.copy(shoulder).addScaledVector(T.dir, a).addScaledVector(T.pole, h);
  T.v.copy(T.elbow).sub(shoulder).normalize(); ua.quaternion.setFromUnitVectors(T.down, T.v);
  T.q.copy(ua.quaternion).invert(); T.v.copy(shoulder).addScaledVector(T.dir, dist).sub(T.elbow).normalize().applyQuaternion(T.q); fa.quaternion.setFromUnitVectors(T.down, T.v);
}

// p: { speed 0..1.1, crouch 0..1, pitch, fire 0|1, dead 0..1, dt, baseY, aim 0|1, weapon, torsoYaw }
export function poseSoldier(u, p) {
  const B = u.bones; const dt = p.dt || 0.016; if (p.weapon) u.setWeapon(p.weapon);
  const dead = p.dead || 0; const sp = clamp(p.speed, 0, 1.1); const cr = clamp(p.crouch || 0, 0, 1);
  u.walkPhase += sp * dt * (cr > 0.5 ? 6 : 9.2); u.breath += dt * 1.6;
  const ph = u.walkPhase, s = Math.sin(ph), c = Math.cos(ph), br = Math.sin(u.breath) * 0.006;
  const aimTarget = (p.aim || p.fire > 0) ? 1 : 0; u.aimK += (aimTarget - u.aimK) * Math.min(1, dt * (aimTarget ? 9 : 3)); const aim = u.aimK;
  const pitch = p.pitch || 0;

  if (dead > 0) { // crumple, then topple backwards with limp arms
    const d1 = sm(0, 0.4, dead), d2 = sm(0.3, 1, dead);
    B.hips.position.y = 0.93 - d1 * 0.42; B.hips.rotation.set(d1 * 0.5, 0, 0);
    B.thL.rotation.set(d1 * 1.15 + d2 * 0.1, 0, -d2 * 0.18); B.thR.rotation.set(d1 * 0.85, 0, d2 * 0.22); B.knL.rotation.set(-d1 * 1.5, 0, 0); B.knR.rotation.set(-d1 * 1.8, 0, 0); B.ftL.rotation.set(0.3, 0, 0); B.ftR.rotation.set(0.1, 0, 0);
    B.spine.rotation.set(-d1 * 0.4 + d2 * 0.25, d2 * 0.25, 0); B.chest.rotation.set(0, 0, 0); B.neck.rotation.set(d2 * 0.5, 0, 0); B.head.rotation.set(d2 * 0.4, d2 * 0.25, 0);
    B.uaL.rotation.set(0.2 - d2 * 0.4, 0, -d1 * 0.35 - d2 * 0.1); B.uaR.rotation.set(-0.3 + d2 * 0.8, 0, d1 * 0.4 + d2 * 0.1); B.uaL.quaternion.setFromEuler(B.uaL.rotation); B.uaR.quaternion.setFromEuler(B.uaR.rotation);
    B.faL.rotation.set(-0.5 - d2 * 0.5, 0, 0); B.faR.rotation.set(-0.3 - d2 * 0.4, 0, 0); u.gun.visible = d2 < 0.6; u.mflash.material.opacity = 0;
    u.root.rotation.x = -d2 * 1.5; u.root.rotation.z = d2 * u.dyingYaw * 0.4; u.root.position.y = (p.baseY || 0) + 0.2 * d2; return;
  }
  u.gun.visible = true; u.root.rotation.z = 0;
  const run = sp, swing = 0.6 * run * (cr > 0.5 ? 0.5 : 1);
  // pelvis: bob, counter-rotation, crouch drop
  B.hips.position.y = 0.93 - cr * 0.42 + Math.abs(s) * 0.028 * run - 0.006 * (1 - run) + br; B.hips.position.x = Math.sin(ph) * 0.012 * run; B.hips.rotation.set(cr * 0.35, -s * 0.09 * run, 0);
  // legs
  B.thL.rotation.set(s * swing + cr * 1.05, 0, 0.02 * (1 - cr)); B.thR.rotation.set(-s * swing + cr * 1.05, 0, -0.02 * (1 - cr));
  B.knL.rotation.set(-(Math.max(0, -c) * 1.0 * run + cr * 1.75 + 0.05), 0, 0); B.knR.rotation.set(-(Math.max(0, c) * 1.0 * run + cr * 1.75 + 0.05), 0, 0);
  B.ftL.rotation.set(-(B.thL.rotation.x + B.knL.rotation.x) * 0.9 + 0.1 * run, 0, 0); B.ftR.rotation.set(-(B.thR.rotation.x + B.knR.rotation.x) * 0.9 + 0.1 * run, 0, 0);
  // torso: forward lean in a run, twist with the stride, aim up and down
  const lean = -0.1 * run - cr * 0.12 - 0.04 * (1 - aim);
  B.spine.rotation.set(lean + pitch * 0.2 * aim + br * 2, (p.torsoYaw || 0) + s * 0.05 * run, 0); B.chest.rotation.set(pitch * 0.25 + br * 2, s * 0.06 * run * (1 - aim * 0.7), 0);
  B.neck.rotation.set(-lean * 0.5 + pitch * 0.25, 0, 0); B.head.rotation.set(pitch * 0.35, -s * 0.03 * run, 0);
  // the rifle: shouldered when aiming, low-ready when running or relaxed
  const G0 = u.gun; const hold = lerp(0, 1, aim);
  const pr = u.weaponId === "pistol" || u.weaponId === "knife"; const px = pr ? 0.02 : 0.09, py = lerp(pr ? 0.02 : -0.04, pr ? 0.2 : 0.17, hold), pz = lerp(pr ? -0.3 : -0.2, pr ? -0.4 : -0.34, hold);
  G0.position.set(px, py + br * 2 - run * Math.abs(c) * 0.012, pz + (p.fire > 0 ? 0.035 : 0)); G0.rotation.set(lerp(-0.42, 0, hold) * (pr ? 0.5 : 1) + pitch * 0.9 * hold + (p.fire > 0 ? 0.05 : 0), lerp(0.18, 0.02, hold), lerp(-0.12, 0, hold)); G0.updateMatrix();
  const g = u.grips; const T = u._tmp; const shR = T.sh.set(0.185, 0.2, 0.0);
  // hands follow the grips
  T.v.copy(g.gripR).applyMatrix4(G0.matrix); const rt = T.v.clone(); T.v.copy(g.gripL).applyMatrix4(G0.matrix); const lt = T.v.clone();
  ik(u, B.uaR, B.faR, shR, rt, 0.31, 0.29, 0.5, -1, 0.2); shR.set(-0.185, 0.2, 0.0);
  if (u.weaponId === "knife") { B.uaL.rotation.set(-0.15 - run * c * 0.6, 0, -0.1); B.uaL.quaternion.setFromEuler(B.uaL.rotation); B.faL.rotation.set(-0.5, 0, 0); B.faL.quaternion.setFromEuler(B.faL.rotation); B.uaR.rotation.set(0, 0, 0); }
  else ik(u, B.uaL, B.faL, shR, lt, 0.31, 0.29, -0.6, -1, 0.1);
  if (u.weaponId === "knife") { ik(u, B.uaR, B.faR, T.sh.set(0.185, 0.2, 0), rt, 0.31, 0.29, 0.5, -1, 0.2); }
  u.mflash.material.opacity = p.fire > 0 ? 0.9 : 0; u.mflash.visible = p.fire > 0;
  u.root.rotation.x = 0; u.root.position.y = p.baseY || 0;
}

// For the first-person view: the same detailed guns, split into body and magazine so the magazine can be pulled in a reload.
export function weaponGeoSets(id, team) {
  const w = weaponParts(id, team); const body = {}, mag = {};
  for (const [m, geo, o] of w.P) ((o && o.mag ? mag : body)[m] ||= []).push(place(geo, o));
  return { body, mag, muzzle: w.muzzle, gripR: w.r, gripL: w.l, flashSize: w.flashSize };
}
export const WEAPON_MATS = MAT;
export { mergeGeometries as _merge };
