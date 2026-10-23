// Operation Blacksite — a human soldier. Real proportions (1.8 m) on a proper skeleton (pelvis, spine, chest, neck, head, two-bone arms and
// legs). The body is sculpted rather than boxed: turned (lathe) limbs with muscle and cloth folds, a shaped torso with chest and shoulders,
// a head with eye sockets, nose, lips, chin and ears, real glossy eyeballs, hands with jointed fingers wrapped round the grip, and boots built
// from a foot outline. Clothing and gear are dressed in materials from ./people (twill, ripstop, camo, denim, fleece, knit, Cordura, MOLLE
// webbing, leather, rubber, moulded polymer, skin with pores), each with its own bump map. Team identity is carried the way real units do it:
// Sentinel wear helmets, navy kit and SENTINEL patches; Nightfall wear mixed civilian-military clothes with brick-red armbands — no glowing strips.
// Everyone is a little different: skin, face, hair, beard, clothes, gear.
//
// Faces -Z (the way a camera looks at yaw 0). poseSoldier() drives all animation from outside.
//   buildSoldier(team, { seed, weapon, quality })   poseSoldier(u, { speed, crouch, pitch, fire, dead, dt, baseY, aim, weapon })
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { makeGlow } from "@/lib/cinematic/atmos";
import { gunParts } from "./guns";
import { muzzleStarTex } from "./fx";
import { bodyMaterial, patchMaterial, faceMaps, eyeMaterial, FACE } from "./people";

import { TEAM_LOOK } from "./teamLook";
export { TEAM_LOOK };

// ---------------------------------------------------------------------------------------------------------------------------------
const rngOf = (seed) => { let a = (seed * 2654435761) >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, t) => { t = clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// skin tones, light to dark: [face/limb colour, a deeper shade]
const SKIN = [[0xe9c4a6, 0xd2a07e], [0xdcae8a, 0xc08c66], [0xc8936c, 0xa8724e], [0xa87552, 0x8a5a3c], [0x7e553a, 0x63402b], [0x5c3c2a, 0x46291c]];
const HAIR = [0x16110d, 0x2a1d12, 0x3e2a1a, 0x5e4026, 0x7c5e38, 0x8e8c88, 0x0c0b0a];
const EYES = [0x3b2a1a, 0x4f3a22, 0x2f5a7a, 0x4a6a3e, 0x6b6a62, 0x5a4026];

// ---- materials for guns (the bodies use ./people) --------------------------------------------------------------------------------------
const matCache = new Map();
function mat(key, make) { let m = matCache.get(key); if (!m) { m = make(); matCache.set(key, m); } return m; }
const MAT = {
  gear: () => mat("gear", () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.15 })),
  rubber: () => mat("rubber", () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.02 })),
  metal: () => mat("metal", () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.52, metalness: 0.7 })),
  poly: () => mat("poly", () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0.08 })),
  wood: () => mat("wood", () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.68, metalness: 0.03 })),
  glow: () => mat("glow", () => new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })),
  glass: () => mat("glass", () => new THREE.MeshStandardMaterial({ color: 0x0a1218, roughness: 0.08, metalness: 0.9, emissive: 0x1a3a4a, emissiveIntensity: 0.5 })),
};

// ---- geometry helpers ----------------------------------------------------------------------------------------------------------------
const Q = new THREE.Quaternion(), E = new THREE.Euler(), M4 = new THREE.Matrix4(), V3 = new THREE.Vector3(), S3 = new THREE.Vector3(), COL = new THREE.Color();
// UVs in metres from a box projection: each triangle takes the two axes it faces most squarely. Seams are hidden by the fine, noisy textures.
function boxUV(g) {
  const p = g.attributes.position, n = p.count, uv = new Float32Array(n * 2); const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2); e1.subVectors(b, a); e2.subVectors(c, a); e1.cross(e2); const ax = Math.abs(e1.x), ay = Math.abs(e1.y), az = Math.abs(e1.z);
    for (let k = 0; k < 3; k++) { const v = k === 0 ? a : k === 1 ? b : c; let u0, v0; if (ay >= ax && ay >= az) { u0 = v.x; v0 = v.z; } else if (ax >= az) { u0 = v.z; v0 = v.y; } else { u0 = v.x; v0 = v.y; } uv[(i + k) * 2] = u0; uv[(i + k) * 2 + 1] = v0; }
  }
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
}
// copy a shared shape into bone space with a transform and a flat colour. o.uv: "box" (metres, default for cloth & gear) | "keep" | [mu, mv] (scale)
function place(geo, o = {}) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone(); for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  E.set(o.rx || 0, o.ry || 0, o.rz || 0, o.order || "XYZ"); Q.setFromEuler(E); M4.compose(V3.set(o.x || 0, o.y || 0, o.z || 0), Q, S3.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1)); g.applyMatrix4(M4);
  const n = g.attributes.position.count, c = new Float32Array(n * 3); COL.set(o.color ?? 0xffffff); for (let i = 0; i < n; i++) { c[i * 3] = COL.r; c[i * 3 + 1] = COL.g; c[i * 3 + 2] = COL.b; } g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  const mode = o.uv ?? "box";
  if (mode === "box") boxUV(g);
  else if (Array.isArray(mode) && g.attributes.uv) { const u = g.attributes.uv; for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * mode[0], u.getY(i) * mode[1]); }
  if (!g.attributes.uv) g.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}
const geoCache = {};
const memoG = (k, f) => geoCache[k] || (geoCache[k] = f());
const G = {
  box: (w, h, d, r = 0.012) => memoG(`b${w}_${h}_${d}_${r}`, () => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) / 2.2))),
  cap: (r, l, rs = 8) => memoG(`c${r}_${l}_${rs}`, () => new THREE.CapsuleGeometry(r, Math.max(0.0005, l), 3, rs)),
  cyl: (r1, r2, h, seg = 12, open = false) => memoG(`y${r1}_${r2}_${h}_${seg}_${open}`, () => new THREE.CylinderGeometry(r1, r2, h, seg, 1, open)),
  sph: (r, ws = 14, hs = 10) => memoG(`s${r}_${ws}_${hs}`, () => new THREE.SphereGeometry(r, ws, hs)),
};

// A turned shape from a profile [[radius, y], ...] listed bottom to top. sx / sz make it oval; folds adds cloth wrinkles (a fraction of the radius);
// sculpt(x, y, z, angle) can push vertices about afterwards. Shared by every soldier (the key names the shape).
function lathe(key, prof, seg = 20, o = {}) {
  return memoG("L" + key, () => {
    const g0 = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(0.0004, r), y)), seg); g0.deleteAttribute("uv"); g0.deleteAttribute("normal");
    const g = mergeVertices(g0, 1e-6); const p = g.attributes.position; const sx = o.sx ?? 1, sz = o.sz ?? 1, f = o.folds || 0, sd = o.seed || 1;
    const y0 = prof[0][1], y1 = prof[prof.length - 1][1], span = Math.max(1e-6, y1 - y0); const win = (y) => { const t = (y - y0) / span; return sm(0.0, 0.16, t) * (1 - sm(0.84, 1.0, t)); };
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i); const a = Math.atan2(z, x);
      let k = 1; if (f) k += f * win(y) * (Math.sin(a * 3 + y * 47 + sd) * 0.5 + Math.sin(a * 5 - y * 29 + sd * 2.3) * 0.3 + Math.sin(y * 83 + a * 2 + sd * 0.7) * 0.25);
      x *= k * sx; z *= k * sz; if (o.sculpt) { const r = o.sculpt(x, y, z, a); x = r[0]; y = r[1]; z = r[2]; }
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals(); return g;
  });
}
// profile for a limb hanging from its joint (y = 0) down to -len, with rounded ends and a muscle bulge at fraction `at` from the bottom
function limbProf(len, r0, r1, bulge = 0, at = 0.5, n = 12) {
  const P = [[0.0004, -len - r1 * 0.8], [r1 * 0.55, -len - r1 * 0.6], [r1 * 0.88, -len - r1 * 0.28]];
  for (let i = 0; i <= n; i++) { const t = i / n, y = -len + t * len; P.push([r1 + (r0 - r1) * t + bulge * Math.exp(-(((t - at) / 0.24) ** 2)), y]); }
  P.push([r0 * 0.88, r0 * 0.28], [r0 * 0.55, r0 * 0.6], [0.0004, r0 * 0.8]);
  return P;
}
// a band round a limb or the waist (belt, armband, knee strap, boot collar)
const ring = (key, r, h, seg = 18, o = {}) => lathe("ring" + key, [[r * 0.97, -h / 2], [r, -h * 0.3], [r, h * 0.3], [r * 0.97, h / 2]], seg, o);

// ---- the head: an egg with jaw, brow, cheekbones, eye sockets, nose, lips and chin pushed out of a sphere ---------------------------------------
const HR = { x: 0.074, y: 0.112, z: 0.1 };
function headGeo() {
  return memoG("head", () => {
    const g = new THREE.SphereGeometry(1, 64, 48); const p = g.attributes.position, uv = g.attributes.uv;
    const bump = (X, Y, cx, cy, sx, sy) => Math.exp(-(((X - cx) / sx) ** 2) - (((Y - cy) / sy) ** 2));
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i); // unit sphere; front is -z
      const low = Math.max(0, -y); x *= 1 - 0.28 * low * low - 0.05 * low; // jaw tapers
      let X = x * HR.x, Y = y * HR.y, Z = z * HR.z;
      if (z < 0) {
        const fr = Math.min(1, -z * 1.6); // features fade out round the sides
        Z -= fr * 0.012 * Math.max(0, -y) * 1.5; // chin forward
        let d = 0;
        d += 0.006 * bump(X, Y, 0, 0.027, 0.045, 0.009); // brow ridge
        d += 0.022 * bump(X, Y, 0, -0.012, 0.0082, 0.018) * clamp((0.016 - Y) / 0.03, 0.3, 1); // nose bridge, growing to the tip
        d += 0.006 * bump(X, Y, 0, FACE.noseY, 0.009, 0.006); // nose tip
        d += 0.004 * (bump(X, Y, -0.0095, FACE.noseY - 0.002, 0.006, 0.005) + bump(X, Y, 0.0095, FACE.noseY - 0.002, 0.006, 0.005)); // nostril wings
        d += 0.005 * (bump(X, Y, -0.038, -0.012, 0.018, 0.014) + bump(X, Y, 0.038, -0.012, 0.018, 0.014)); // cheekbones
        d += 0.0042 * bump(X, Y, 0, FACE.mouthY + 0.0045, 0.02, 0.0045) + 0.0048 * bump(X, Y, 0, FACE.mouthY - 0.0055, 0.018, 0.005) - 0.0016 * bump(X, Y, 0, FACE.mouthY, 0.02, 0.0016); // lips
        d += 0.006 * bump(X, Y, 0, FACE.chinY + 0.004, 0.016, 0.01); // chin
        d -= 0.0078 * (bump(X, Y, -FACE.eyeX, FACE.eyeY - 0.0012, 0.0142, 0.0068) + bump(X, Y, FACE.eyeX, FACE.eyeY - 0.0012, 0.0142, 0.0068)); // eye sockets (the slit the eye shows through)
        d += 0.0034 * (bump(X, Y, -FACE.eyeX, FACE.eyeY + 0.0068, 0.0135, 0.0036) + bump(X, Y, FACE.eyeX, FACE.eyeY + 0.0068, 0.0135, 0.0036)); // upper lids, which cover the top of the iris
        Z -= d * fr;
      }
      p.setXYZ(i, X, Y, Z);
      // the face texture is mapped flat from the front; behind the ears everything takes plain skin from above the brow
      if (z > 0.35) uv.setXY(i, 0.5, 0.95); else uv.setXY(i, 0.5 + X / 0.164, 0.52 + Y / 0.236);
    }
    g.computeVertexNormals(); return g;
  });
}
// where the eyeballs sit (head space, before the head mesh's lift)
const EYE_Z = -0.0786;
const earGeo = () => memoG("ear", () => {
  const lobe = new THREE.SphereGeometry(1, 12, 10); lobe.scale(0.0095, 0.028, 0.019);
  const rim = new THREE.TorusGeometry(0.0175, 0.0042, 6, 16, Math.PI * 1.55); rim.rotateZ(-Math.PI * 0.55); rim.scale(1, 1.35, 1); rim.rotateY(Math.PI / 2); rim.translate(0.0035, 0.002, 0.001);
  const parts = [lobe, rim].map((q) => { const n = q.toNonIndexed(); n.deleteAttribute("uv"); return n; }); const m = mergeGeometries(parts, false); m.computeVertexNormals(); return m;
});
// a skull cap (hair, beanie, helmet) — part of a sphere, cut at a rim whose height changes round the head (low at the back, higher over the ears)
function capGeo(key, r, front, side, back, ws = 36) {
  return memoG("cap" + key, () => {
    const g = new THREE.SphereGeometry(1, ws, 18, 0, Math.PI * 2, 0, Math.max(front, side, back) + 0.01); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const th = Math.acos(clamp(y, -1, 1)), st = Math.sin(th) || 1e-6; const cphi = -x / st, sphi = z / st;
      const az = Math.atan2(x, -z); const s2 = Math.sin(az) ** 2, cb = Math.cos(az); const lim = cb >= 0 ? lerp(front, side, s2) : lerp(back, side, s2);
      const t2 = Math.min(th, lim), st2 = Math.sin(t2); p.setXYZ(i, -cphi * st2 * r[0], Math.cos(t2) * r[1], sphi * st2 * r[2]);
    }
    g.computeVertexNormals(); return g;
  });
}
// a flat outline pushed out to a thickness with soft edges (plates, pouches' backing, cap peaks)
function slab(key, pts, depth, bevel) {
  return memoG("slab" + key, () => {
    const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, depth - bevel * 2), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.85, bevelSegments: 3, curveSegments: 6 });
    g.translate(0, 0, -(depth - bevel * 2) / 2); g.deleteAttribute("uv"); return g;
  });
}
// a body-armour plate: shooter's cut (top corners chamfered for the arms), slightly curved to the chest
const plateGeo = (w, h, t) => memoG(`plate${w}_${h}_${t}`, () => {
  const c = 0.055, pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2 - c * 1.2], [w / 2 - c, h / 2], [-w / 2 + c, h / 2], [-w / 2, h / 2 - c * 1.2]];
  const g = slab(`pl${w}${h}${t}`, pts, t, 0.009).clone(); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i); p.setZ(i, p.getZ(i) + (x * x) * 0.9); } g.computeVertexNormals(); return g;
});
// the cummerbund: a thick band round one side of the body, from the front plate's edge to the back plate's edge
const cummerGeo = (s) => memoG("cum" + s, () => {
  const ax = 0.178, az = 0.122, bx = 0.161, bz = 0.105, f0 = 0.74, f1 = Math.PI - 0.74, n = 14; const out = [], inn = [];
  for (let i = 0; i <= n; i++) { const f = f0 + (f1 - f0) * (i / n); out.push([s * ax * Math.sin(f), az * Math.cos(f)]); inn.push([s * bx * Math.sin(f), bz * Math.cos(f)]); }
  const sh = new THREE.Shape(); out.forEach(([x, y], i) => (i ? sh.lineTo(x, y) : sh.moveTo(x, y))); inn.reverse().forEach(([x, y]) => sh.lineTo(x, y)); sh.closePath();
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.13, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 2, curveSegments: 4 }); g.rotateX(-Math.PI / 2); g.translate(0, -0.065, 0); g.deleteAttribute("uv"); return g;
});
// boots: a foot outline (toe forward, -Z) turned into a sole and an upper whose toe slopes down
function footPts(inset = 0) {
  const pts = []; const L = 0.205, Hh = 0.075; const n = 40;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const front = Math.sin(a) < 0; const len = front ? L : Hh; const wid = (front ? 0.05 : 0.041) * (1 - 0.18 * Math.max(0, -Math.sin(a)) ** 6); pts.push([(Math.cos(a) * wid - (front ? 0.004 : 0)) * (1 - inset * 6), Math.sin(a) * len * (1 - inset * 2)]); }
  return pts;
}
function footSlab(key, inset, depth, bevel, toeDrop) {
  return memoG("foot" + key, () => {
    const g = slab("f" + key, footPts(inset), depth, bevel).clone(); g.rotateX(Math.PI / 2); // outline's y becomes z (toe at -z), thickness runs down
    g.translate(0, depth / 2, 0); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const z = p.getZ(i), y = p.getY(i); const k = 1 - toeDrop * sm(-0.03, -0.17, z); p.setY(i, y * k); }
    g.computeVertexNormals(); return g;
  });
}

// ---- weapon world-models ---------------------------------------------------------------------------------------------------------
const MATKEY = { metal: MAT.metal, poly: MAT.poly, wood: MAT.wood, glow: MAT.glow, glass: MAT.glass, rubber: MAT.rubber, gear: MAT.gear };
function buildWeaponMesh(id, team) {
  const w = gunParts(id, team); const by = {};
  for (const [m, geo, o] of w.P) (by[m] ||= []).push(place(geo, { ...o, uv: "keep" }));
  const g = new THREE.Group();
  for (const k of Object.keys(by)) { const merged = mergeGeometries(by[k], false); const me = new THREE.Mesh(merged, k === "glass" ? MAT.glass() : MATKEY[k]()); me.castShadow = true; me.receiveShadow = false; g.add(me); }
  return { group: g, muzzle: new THREE.Vector3(...w.muzzle), gripR: new THREE.Vector3(...w.r), gripL: new THREE.Vector3(...w.l), flashSize: w.flashSize };
}

// ---- who this soldier is ---------------------------------------------------------------------------------------------------------------
function lookFor(team, seed) {
  const r = rngOf(seed * 131 + (team === "police" ? 7 : 3)); const T0 = team === "terrorist"; const pk = (a) => a[Math.floor(r() * a.length)];
  const skin = Math.min(5, Math.floor(Math.pow(r(), 1.25) * 6)); const hairIdx = Math.floor(r() * HAIR.length);
  const L = { team, seed, key: `${team}${seed}`, skin, skinPair: SKIN[skin], hair: HAIR[hairIdx], hairIdx, eye: pk(EYES), scale: 0.97 + r() * 0.06, wide: 0.95 + r() * 0.1 };
  L.beard = r() < (T0 ? 0.6 : 0.35) ? (r() < 0.4 ? 2 : 1) : 0;
  L.hairStyle = pk(["buzz", "short", "short", "crop", "bald"]);
  if (T0) {
    L.head = pk(["beanie", "cap", "shemagh", "bare", "beanie", "shemagh"]); L.mask = L.head !== "cap" && r() < 0.5; L.maskColor = pk([0x151515, 0x2a2e26, 0x3a2a20]);
    L.faceWrap = L.head === "shemagh" && !L.mask && r() < 0.6; L.shem = Math.floor(r() * 3);
    L.top = pk(["jacket", "hoodie", "camo", "jacket", "hoodie"]); L.topColor = pk([0x4d4a35, 0x6e624a, 0x2a2a2a, 0x4a3a2c, 0x56584a]); L.hoodColor = pk([0x55565a, 0x3b4135, 0x8a7b5e, 0x2e2e30]);
    L.pants = pk(["camo0", "camo1", "denim", "cargo", "camo0"]); L.pantsColor = pk([0x7d6f52, 0x3c3c36, 0x5a5440]);
    L.rig = r() < 0.55 ? "rig" : "carrier"; L.rigColor = pk([0x7a6448, 0x24241f, 0x4a4a36, 0x5e4e3a]);
    L.gloves = r() < 0.5 ? pk([0x1e1d1b, 0x3e3a2c, 0x6a5a40]) : 0; L.rolled = L.top === "jacket" && r() < 0.35; L.boots = pk([0x4a3626, 0x6a5238, 0x1e1c1a, 0x7a6448]); L.glasses = r() < 0.25;
  } else {
    L.head = "helmet"; L.mask = r() < 0.15; L.maskColor = 0x16171a; L.helmColor = pk([0x1b1c1e, 0x1b1c1e, 0x3a3f33, 0x2a3140]);
    L.top = "combat"; L.topColor = pk([0x232c3a, 0x1e2026, 0x262e3c]); L.torsoColor = pk([0x4c535c, 0x3e4450, 0x5a5e62]);
    L.pants = "ripstop"; L.pantsColor = pk([0x252e3c, 0x23252a, 0x2a3240]);
    L.rig = "carrier"; L.rigColor = pk([0x1a1b1d, 0x1d2533, 0x3a3f33]);
    L.gloves = pk([0x151515, 0x1d1e20, 0x2c2a26]); L.rolled = false; L.boots = pk([0x141414, 0x1e1c1a, 0x2a2622]); L.glasses = true; L.goggles = r() < 0.35;
  }
  return L;
}

// ---- the soldier -----------------------------------------------------------------------------------------------------------------------
export function buildSoldier(team, opts = {}) {
  const T0 = team === "terrorist"; const seed = opts.seed ?? Math.floor(Math.random() * 9999); const look = lookFor(team, seed); const q = opts.quality === "low" ? "low" : "high";
  const root = new THREE.Group(); const u = { root, team, look, walkPhase: Math.random() * 6, aimK: 0, weaponId: null, breath: Math.random() * 6, dyingYaw: (Math.random() - 0.5) * 0.7 };
  const parts = {}; // bone -> material key -> geometries
  const part = (bone, mk, geo, o = {}) => { const keep = mk === "face" || mk.startsWith("eye:") || mk.startsWith("patch:"); ((parts[bone] ||= {})[mk] ||= []).push(place(geo, keep && o.uv === undefined ? { ...o, uv: "keep" } : o)); };
  const bones = {}; const mk = (name, parent, x = 0, y = 0, z = 0) => { const gr = new THREE.Group(); gr.position.set(x, y, z); parent.add(gr); bones[name] = gr; return gr; };
  const sc = look.scale; root.scale.set(look.wide * sc, sc, look.wide * sc);
  const skinC = look.skinPair[0];

  // skeleton (unchanged proportions: hips 0.93 m, shoulders 1.38 m)
  const hips = mk("hips", root, 0, 0.93, 0); const spine = mk("spine", hips, 0, 0.06, 0); const chest = mk("chest", spine, 0, 0.19, 0); const neck = mk("neck", chest, 0, 0.27, 0); const head = mk("head", neck, 0, 0.07, 0);
  const uaL = mk("uaL", chest, -0.185, 0.2, 0), uaR = mk("uaR", chest, 0.185, 0.2, 0);
  const faL = mk("faL", uaL, 0, -0.29, 0), faR = mk("faR", uaR, 0, -0.29, 0); mk("handL", faL, 0, -0.27, 0); mk("handR", faR, 0, -0.27, 0);
  const thL = mk("thL", hips, -0.095, -0.02, 0), thR = mk("thR", hips, 0.095, -0.02, 0); const knL = mk("knL", thL, 0, -0.44, 0), knR = mk("knR", thR, 0, -0.44, 0); mk("ftL", knL, 0, -0.43, 0); mk("ftR", knR, 0, -0.43, 0);
  u.bones = bones; head.scale.setScalar(1.08);

  // what each part is made of
  const shirtM = T0 ? (look.top === "hoodie" ? "fleece" : look.top === "camo" ? "camo0" : "twill") : "ripstop";
  const shirtC = T0 ? (look.top === "hoodie" ? look.hoodColor : look.top === "camo" ? 0xffffff : look.topColor) : look.topColor;
  const torsoM = T0 ? shirtM : "fleece", torsoC = T0 ? shirtC : look.torsoColor;
  const pantsM = look.pants === "camo0" || look.pants === "camo1" ? look.pants : look.pants === "denim" ? "denim" : look.pants === "ripstop" ? "ripstop" : "twill";
  const pantsC = pantsM.startsWith("camo") || pantsM === "denim" ? 0xffffff : look.pantsColor;
  const rigC = look.rigColor, strapC = new THREE.Color(rigC).multiplyScalar(0.85).getHex(), pouchC = rigC;

  // ---- pelvis, belt, holster -------------------------------------------------------------------------------------------------------------
  part("hips", pantsM, lathe("pelvis", [[0.0004, -0.15], [0.085, -0.145], [0.13, -0.11], [0.155, -0.06], [0.164, 0.0], [0.16, 0.06], [0.152, 0.11]], 22, { sz: 0.72, folds: 0.012, seed: 3 }), { color: pantsC });
  part("hips", "molle", ring("belt", 0.17, 0.048, 24, { sz: 0.73 }), { y: 0.078, color: T0 ? 0x2a2620 : 0x1b1c1f });
  part("hips", "buckle", G.box(0.058, 0.042, 0.014, 0.004), { y: 0.078, z: -0.128, color: 0x2a2b2e });
  part("hips", "polymer", G.box(0.045, 0.15, 0.085, 0.012), { x: 0.19, y: -0.06, z: 0.005, rz: -0.05, color: 0x161719 }); part("hips", "polymer", G.box(0.03, 0.06, 0.035, 0.008), { x: 0.19, y: 0.035, z: 0.03, color: 0x1a1b1d }); // holster + pistol grip
  part("hips", "cordura", G.box(0.08, 0.1, 0.055, 0.016), { x: -0.13, y: -0.02, z: 0.11, ry: 0.5, color: pouchC });
  // ---- abdomen and chest (shirt) ------------------------------------------------------------------------------------------------------------
  part("spine", torsoM, lathe("abdomen", [[0.15, -0.03], [0.148, 0.04], [0.15, 0.12], [0.156, 0.2], [0.16, 0.25]], 22, { sz: 0.66, folds: 0.012, seed: 5 }), { color: torsoC });
  const chestSculpt = (x, y, z) => {
    const ax = Math.abs(x); let X = x, Z = z;
    if (z < 0) Z -= 0.011 * Math.exp(-(((y - 0.13) / 0.05) ** 2)) * sm(0.01, 0.06, ax) * (1 - sm(0.11, 0.16, ax)); // chest
    else Z += 0.006 * Math.exp(-(((y - 0.15) / 0.06) ** 2)) * sm(0.03, 0.09, ax); // shoulder blades
    X *= 1 + 0.1 * Math.exp(-(((y - 0.215) / 0.035) ** 2)); // shoulder line
    return [X, y, Z];
  };
  part("chest", torsoM, lathe("chest", [[0.152, -0.06], [0.16, 0.0], [0.168, 0.06], [0.173, 0.12], [0.172, 0.17], [0.162, 0.212], [0.138, 0.243], [0.104, 0.268], [0.076, 0.288], [0.064, 0.305]], 26, { sz: 0.63, folds: 0.01, seed: 7, sculpt: chestSculpt }), { color: torsoC });
  // ---- body armour or chest rig --------------------------------------------------------------------------------------------------------------
  if (look.rig === "carrier") {
    part("chest", "molle", plateGeo(0.255, 0.33, 0.048), { y: 0.09, z: -0.136, color: rigC }); part("chest", "molle", plateGeo(0.265, 0.35, 0.044), { y: 0.1, z: 0.132, ry: Math.PI, color: rigC });
    part("chest", "molle", cummerGeo(-1), { y: 0.0, color: rigC }); part("chest", "molle", cummerGeo(1), { y: 0.0, color: rigC });
    for (const s of [-1, 1]) { // padded shoulder straps over the trapezius
      part("chest", "cordura", G.box(0.058, 0.11, 0.022, 0.009), { x: s * 0.088, y: 0.246, z: -0.088, rx: -0.55, color: strapC });
      part("chest", "cordura", G.box(0.06, 0.024, 0.11, 0.009), { x: s * 0.094, y: 0.284, z: 0.0, color: strapC });
      part("chest", "cordura", G.box(0.058, 0.11, 0.022, 0.009), { x: s * 0.088, y: 0.246, z: 0.088, rx: 0.55, color: strapC });
    }
    // front: three rifle magazines in open-top pouches, shock-cord over each
    for (let i = -1; i <= 1; i++) {
      part("chest", "cordura", G.box(0.07, 0.1, 0.036, 0.008), { x: i * 0.077, y: -0.01, z: -0.178, color: pouchC });
      part("chest", "polymer", G.box(0.058, 0.05, 0.021, 0.004), { x: i * 0.077, y: 0.05, z: -0.178, rx: 0.06, color: 0x1a1b1d });
      part("chest", "cordura", G.box(0.066, 0.008, 0.04, 0.003), { x: i * 0.077, y: 0.062, z: -0.178, color: 0x111213 });
    }
    if (!T0) { part("chest", "patch:SENTINEL", G.box(0.17, 0.052, 0.008, 0.003), { y: 0.16, z: -0.163, color: 0xffffff }); part("chest", "patch:SENTINEL", G.box(0.21, 0.065, 0.008, 0.003), { y: 0.17, z: 0.158, color: 0xffffff }); }
    // radio on the left side with its antenna, a tourniquet on the right strap, a drag handle on the back
    part("chest", "cordura", G.box(0.04, 0.11, 0.06, 0.01), { x: -0.18, y: 0.0, z: 0.02, color: pouchC }); part("chest", "polymer", G.box(0.034, 0.05, 0.05, 0.006), { x: -0.18, y: 0.07, z: 0.02, color: 0x18191b });
    part("chest", "polymer", G.cyl(0.004, 0.003, 0.17, 6), { x: -0.18, y: 0.18, z: 0.035, rz: 0.12, color: 0x101112 });
    part("chest", "polymer", G.cyl(0.017, 0.017, 0.085, 10), { x: 0.088, y: 0.21, z: -0.108, rz: Math.PI / 2, color: T0 ? 0x24231f : 0x1a1a1a });
    part("chest", "cordura", G.box(0.08, 0.022, 0.026, 0.008), { y: 0.285, z: 0.15, color: strapC });
  } else {
    // a chest rig: a row of four magazine pouches on a band, straps over the shoulders crossing on the back
    part("chest", "cordura", G.box(0.31, 0.12, 0.022, 0.009), { y: 0.02, z: -0.122, color: rigC });
    for (let i = 0; i < 4; i++) { const x = -0.105 + i * 0.07; part("chest", "cordura", G.box(0.062, 0.115, 0.038, 0.008), { x, y: 0.025, z: -0.148, color: pouchC }); part("chest", "polymer", G.box(0.05, 0.04, 0.021, 0.004), { x, y: 0.088, z: -0.148, rx: 0.08, color: 0x1c1b19 }); part("chest", "cordura", G.box(0.066, 0.045, 0.042, 0.006), { x, y: 0.072, z: -0.149, rx: -0.15, color: pouchC }); }
    for (const s of [-1, 1]) { part("chest", "cordura", G.box(0.038, 0.17, 0.012, 0.005), { x: s * 0.085, y: 0.19, z: -0.098, rx: -0.42, color: strapC }); part("chest", "cordura", G.box(0.04, 0.012, 0.11, 0.005), { x: s * 0.093, y: 0.281, z: 0.0, color: strapC }); part("chest", "cordura", G.box(0.036, 0.26, 0.012, 0.005), { x: s * 0.03, y: 0.14, z: 0.112, rz: s * 0.55, color: strapC }); }
    part("chest", "cordura", G.box(0.07, 0.14, 0.04, 0.01), { x: 0.0, y: 0.0, z: 0.11, color: pouchC }); // hydration / back pouch
  }
  // ---- neck, collar, scarf -------------------------------------------------------------------------------------------------------------------
  part("neck", "skin", lathe("neck", [[0.058, -0.06], [0.054, -0.01], [0.051, 0.04], [0.053, 0.1]], 16, { sz: 1.05 }), { color: skinC });
  if (look.top === "hoodie") { part("neck", "fleece", G.sph(1, 16, 10), { y: -0.02, z: 0.07, sx: 0.1, sy: 0.055, sz: 0.06, color: shirtC }); part("neck", "fleece", ring("hoodn", 0.07, 0.05, 18, { sz: 1.05 }), { y: -0.035, color: shirtC }); for (const s of [-1, 1]) part("neck", "twill", G.cyl(0.003, 0.003, 0.12, 5), { x: s * 0.02, y: -0.1, z: -0.07, color: 0xdedad0 }); }
  else part("neck", torsoM === "fleece" ? "ripstop" : shirtM, ring("collar", 0.068, 0.05, 18, { sz: 1.05, folds: 0.03 }), { y: -0.03, color: shirtC });
  if (look.head === "shemagh") part("neck", "shem" + look.shem, lathe("shemN", [[0.066, -0.07], [0.09, -0.04], [0.094, 0.0], [0.084, 0.04], [0.066, 0.065]], 20, { sz: 1.06, folds: 0.09, seed: 11 }), { color: 0xffffff });
  // ---- head: face, eyes, ears, hair, headgear --------------------------------------------------------------------------------------------------
  const fm = faceMaps(look); const faceMat = q === "low" ? new THREE.MeshStandardMaterial({ map: fm.map, roughness: 0.6 }) : new THREE.MeshPhysicalMaterial({ map: fm.map, normalMap: fm.normalMap, normalScale: new THREE.Vector2(0.35, 0.35), roughness: 0.58, sheen: 0.15, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xffc0a8) });
  u._faceMat = faceMat; const H0 = 0.03; // the head mesh sits 3 cm up the head bone
  part("head", "face", headGeo(), { y: H0 });
  for (const s of [-1, 1]) part("head", "eye:" + look.eye, G.sph(FACE.eyeR, 20, 14), { x: s * FACE.eyeX, y: H0 + FACE.eyeY, z: EYE_Z });
  for (const s of [-1, 1]) part("head", "skin", earGeo(), { x: s * 0.074, y: H0 + 0.004, z: 0.008, ry: s * 0.25, rz: s * -0.1, color: skinC });
  const hairOn = look.head !== "helmet" || look.hairStyle !== "bald";
  if (look.hairStyle !== "bald" && (look.head === "bare" || look.head === "shemagh" || look.head === "cap")) {
    const off = look.hairStyle === "buzz" ? 0.003 : look.hairStyle === "crop" ? 0.009 : 0.006;
    part("head", "hair", capGeo("hair" + look.hairStyle, [HR.x + off, HR.y + off * 0.8, HR.z + off], 1.12, 1.3, 1.95), { y: H0, rx: 0.12, color: look.hair, uv: [0.55, 0.35] });
  }
  if (look.head === "helmet") {
    const hc = look.helmColor;
    part("head", "polymerDS", capGeo("helm", [0.096, 0.117, 0.114], 1.28, 1.22, 1.9), { y: H0 + 0.012, color: hc });
    for (const s of [-1, 1]) { part("head", "polymer", G.box(0.008, 0.024, 0.11, 0.003), { x: s * 0.093, y: H0 + 0.03, z: 0.006, ry: 0, rz: s * 0.25, color: 0x121314 }); part("head", "polymer", lathe("cup", [[0.0004, -0.015], [0.03, -0.015], [0.039, -0.009], [0.041, 0.0], [0.039, 0.009], [0.03, 0.015], [0.0004, 0.015]], 18), { x: s * 0.088, y: H0 + 0.0, z: 0.005, rz: Math.PI / 2, color: 0x17181a }); }
    part("head", "polymer", G.box(0.05, 0.034, 0.026, 0.006), { y: H0 + 0.098, z: -0.104, rx: -0.5, color: 0x141516 }); // NVG shroud
    part("head", "cordura", G.box(0.07, 0.008, 0.06, 0.003), { y: H0 + 0.113, z: 0.015, rx: 0.15, color: new THREE.Color(hc).multiplyScalar(0.8).getHex() }); // loop panel
    for (const s of [-1, 1]) part("head", "cordura", G.box(0.01, 0.1, 0.008, 0.003), { x: s * 0.062, y: H0 - 0.05, z: -0.035, rz: s * -0.25, rx: 0.3, color: 0x141414 }); // chin strap
    part("head", "polymer", G.cyl(0.004, 0.004, 0.06, 6), { x: 0.07, y: H0 - 0.035, z: -0.05, rx: 1.2, ry: -0.5, color: 0x101010 }); // boom mic
  } else if (look.head === "beanie") {
    part("head", "knit", capGeo("beanie", [0.088, 0.124, 0.109], 1.42, 1.52, 1.82), { y: H0 + 0.006, rx: 0.08, color: look.maskColor === 0x151515 ? 0x1c1c1c : 0x2e3229 });
    part("head", "knit", ring("beanieB", 0.089, 0.03, 26, { sz: 1.2, folds: 0.01 }), { y: H0 + 0.036, rx: 0.12, color: 0x2a2a2a });
  } else if (look.head === "cap") {
    part("head", "twill", capGeo("capC", [0.087, 0.104, 0.108], 1.32, 1.42, 1.62), { y: H0 + 0.008, rx: 0.1, color: look.topColor });
    const peak = []; for (let i = 0; i <= 16; i++) { const a = Math.PI + (i / 16) * Math.PI; peak.push([Math.cos(a) * 0.085, Math.sin(a) * 0.075]); }
    part("head", "twill", slab("peak", peak, 0.006, 0.002), { y: H0 + 0.046, z: -0.092, rx: Math.PI / 2 - 0.2, color: look.topColor });
  } else if (look.head === "shemagh") {
    part("head", "shem" + look.shem, ring("shemH", 0.09, 0.05, 26, { sz: 1.18, folds: 0.05, seed: 13 }), { y: H0 + 0.055, rx: 0.15, color: 0xffffff });
    part("head", "shem" + look.shem, capGeo("shemT", [0.09, 0.122, 0.11], 1.3, 1.45, 1.9), { y: H0 + 0.004, rx: 0.1, color: 0xffffff });
    if (look.faceWrap) part("head", "shem" + look.shem, new THREE.SphereGeometry(1, 24, 10, Math.PI * 1.5 - 1.5, 3.0, 1.72, 0.85), { y: H0 - 0.004, sx: 0.088, sy: 0.118, sz: 0.112, color: 0xffffff });
  }
  if (look.glasses && !look.goggles) {
    part("head", "lens", new THREE.CylinderGeometry(0.1, 0.1, 0.032, 22, 1, true, Math.PI - 0.9, 1.8), { y: H0 + FACE.eyeY + 0.003, sx: 0.9, z: -0.012, uv: "keep", color: 0xffffff });
    part("head", "polymer", G.box(0.15, 0.006, 0.01, 0.003), { y: H0 + FACE.eyeY + 0.019, z: -0.106, color: 0x111111 });
    for (const s of [-1, 1]) part("head", "polymer", G.box(0.004, 0.006, 0.09, 0.002), { x: s * 0.086, y: H0 + FACE.eyeY + 0.014, z: -0.05, color: 0x111111 });
  }
  if (look.goggles) {
    part("head", "goggle", new THREE.CylinderGeometry(0.105, 0.105, 0.045, 22, 1, true, Math.PI - 0.95, 1.9), { y: H0 + FACE.eyeY + 0.006, sx: 0.94, z: -0.012, uv: "keep", color: 0xffffff });
    part("head", "polymer", new THREE.CylinderGeometry(0.108, 0.108, 0.052, 22, 1, true, Math.PI - 1.0, 2.0), { y: H0 + FACE.eyeY + 0.006, sx: 0.94, z: -0.01, color: 0x161616 });
  }
  // ---- arms: sleeves, armbands / patches, pads, hands --------------------------------------------------------------------------------------------
  for (const s of [-1, 1]) {
    const ua = s < 0 ? "uaL" : "uaR", fa = s < 0 ? "faL" : "faR", ha = s < 0 ? "handL" : "handR";
    part(ua, shirtM, G.sph(1, 16, 12), { y: -0.035, sx: 0.056, sy: 0.072, sz: 0.054, color: shirtC }); // deltoid
    part(ua, shirtM, lathe("upperArm" + shirtM, limbProf(0.29, 0.05, 0.041, 0.007, 0.6, 18), 20, { folds: 0.06, seed: 17 }), { color: shirtC });
    if (T0) part(ua, "armband", ring("arm", 0.054, 0.05, 16, { folds: 0.02 }), { y: -0.11, color: 0x8a2a1c });
    else part(ua, "patch:FLAG", G.box(0.006, 0.05, 0.07, 0.002), { x: s * 0.052, y: -0.075, color: 0xffffff });
    if (look.rolled) {
      part(fa, "skin", lathe("forearmSkin", limbProf(0.27, 0.039, 0.028, 0.006, 0.75), 14), { color: skinC });
      part(fa, shirtM, ring("roll", 0.048, 0.05, 14, { folds: 0.06 }), { y: -0.02, color: shirtC });
    } else {
      part(fa, shirtM, lathe("forearm" + shirtM, limbProf(0.27, 0.043, 0.033, 0.006, 0.75, 18), 20, { folds: 0.065, seed: 19 }), { color: shirtC });
      part(fa, shirtM, ring("cuff", 0.036, 0.03, 14, { folds: 0.05 }), { y: -0.255, color: shirtC });
    }
    if (!T0) part(fa, "polymer", new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, 1.3), { y: 0.0, z: 0.032, rx: Math.PI / 2, sx: 0.045, sy: 0.03, sz: 0.05, color: 0x161718 }); // elbow pad
    // the hand: palm, four fingers in three joints each curled round the grip, and a thumb
    const gl = look.gloves; const hm = gl ? "leather" : "skin", hc = gl || skinC; const fr = gl ? 0.0082 : 0.0074;
    part(ha, hm, G.box(0.078, 0.086, 0.03, 0.012), { y: -0.047, color: hc });
    const lens = [[0.95, 0.046, 0.03, 0.024], [1.0, 0.05, 0.032, 0.025], [0.96, 0.047, 0.03, 0.024], [0.8, 0.04, 0.026, 0.021]];
    for (let f = 0; f < 4; f++) {
      const x = s * (-0.027 + f * 0.018); let px = x, py = -0.086, pz = -0.004, th = 0; const ang = [0.25, 0.95, 1.6]; const rr = fr * (f === 3 ? 0.88 : 1);
      for (let j = 0; j < 3; j++) { const L = lens[f][j + 1] * lens[f][0]; th = ang[j]; const dy = -Math.cos(th), dz = -Math.sin(th); part(ha, hm, G.cap(rr * (1 - j * 0.07), L - rr * 1.6, 7), { x: px, y: py + dy * L / 2, z: pz + dz * L / 2, rx: th, color: hc }); px = x; py += dy * L; pz += dz * L; }
    }
    part(ha, hm, G.cap(fr * 1.1, 0.026, 7), { x: s * -0.04, y: -0.04, z: -0.016, rx: 0.75, rz: s * 0.5, color: hc }); part(ha, hm, G.cap(fr, 0.02, 7), { x: s * -0.036, y: -0.07, z: -0.04, rx: 1.4, rz: s * 0.4, color: hc });
    if (gl && !T0) part(ha, "polymer", G.box(0.07, 0.016, 0.01, 0.004), { y: -0.082, z: 0.018, color: 0x0f0f10 }); // knuckle armour
    if (gl) part(ha, hm, ring("glovecuff", 0.036, 0.03, 12), { y: 0.005, color: hc });
  }
  // ---- legs: trousers, pockets, knee pads, boots -------------------------------------------------------------------------------------------------
  for (const s of [-1, 1]) {
    const th = s < 0 ? "thL" : "thR", kn = s < 0 ? "knL" : "knR", ft = s < 0 ? "ftL" : "ftR";
    part(th, pantsM, lathe("thigh" + pantsM, limbProf(0.46, 0.088, 0.062, 0.008, 0.62, 20), 22, { folds: 0.05, seed: 23 }), { color: pantsC });
    if (look.pants !== "denim") { part(th, pantsM, G.box(0.032, 0.15, 0.115, 0.014), { x: s * 0.068, y: -0.22, z: 0.0, color: pantsC }); part(th, pantsM, G.box(0.036, 0.035, 0.12, 0.008), { x: s * 0.07, y: -0.15, z: 0.0, color: pantsC }); }
    part(kn, pantsM, lathe("shin" + pantsM, limbProf(0.43, 0.064, 0.052, 0.007, 0.75, 20), 22, { folds: 0.065, seed: 29 }), { color: pantsC });
    if (!T0 || look.pants === "cargo") { // knee pads
      part(kn, "polymer", new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, 1.25), { y: -0.025, z: -0.058, rx: -Math.PI / 2, sx: 0.06, sy: 0.035, sz: 0.07, color: T0 ? 0x2a2824 : 0x141516 });
      part(kn, "cordura", ring("kstrap", 0.068, 0.018, 16), { y: 0.03, color: 0x131313 }); part(kn, "cordura", ring("kstrap2", 0.064, 0.018, 16), { y: -0.085, color: 0x131313 });
    }
    // boots: sole, upper with a sloping toe box, shaft, padded collar, laces
    const bc = look.boots;
    part(ft, "rubber", footSlab("sole", 0, 0.026, 0.005, 0), { y: -0.068, color: 0x141414 });
    part(ft, "leather", footSlab("upper", 0.004, 0.1, 0.014, 0.5), { y: -0.046, color: bc });
    part(ft, "leather", lathe("shaft", [[0.052, -0.02], [0.054, 0.06], [0.057, 0.15], [0.058, 0.165]], 18, { sz: 1.12 }), { z: 0.018, color: bc });
    part(ft, "leather", ring("collarB", 0.06, 0.024, 18, { sz: 1.12 }), { y: 0.162, z: 0.018, color: new THREE.Color(bc).multiplyScalar(0.8).getHex() });
    for (let i = 0; i < 5; i++) part(ft, "cordura", G.box(0.05, 0.005, 0.006, 0.002), { y: 0.035 + i * 0.025, z: -0.092 + i * 0.0105, rx: -0.35, color: 0x161412 });
  }

  // ---- build merged meshes, one per bone per material -----------------------------------------------------------------------------------------------
  const resolve = (k) => {
    if (k === "face") return faceMat;
    if (k.startsWith("eye:")) return eyeMaterial(+k.slice(4), q);
    if (k === "patch:SENTINEL") return patchMaterial("SENTINEL", "#16181b", "#c2c8cf", 0.12);
    if (k === "patch:FLAG") return patchMaterial("SENTINEL", "#1b2a40", "#9fc2ef", 0.1);
    return bodyMaterial(k, q) || MAT[k]?.() || MAT.gear();
  };
  for (const bone of Object.keys(parts)) for (const k of Object.keys(parts[bone])) {
    const geo = mergeGeometries(parts[bone][k], false); const me = new THREE.Mesh(geo, resolve(k)); me.castShadow = true; me.receiveShadow = q !== "low"; bones[bone].add(me);
  }
  // ---- the held weapon -----------------------------------------------------------------------------------------------------------------------------------
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
  const w = gunParts(id, team); const body = {}, mag = {};
  for (const [m, geo, o] of w.P) ((o && o.mag ? mag : body)[m] ||= []).push(place(geo, { ...o, uv: "keep" }));
  return { body, mag, muzzle: w.muzzle, gripR: w.r, gripL: w.l, flashSize: w.flashSize };
}
export const WEAPON_MATS = MAT;
export { mergeGeometries as _merge };
