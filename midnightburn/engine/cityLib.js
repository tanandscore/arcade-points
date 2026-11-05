// Midnight Burn: real 3D buildings.
//
// A library of hand-modelled buildings (cut out of the artists' city scenes, shrunk, and painted onto ONE shared picture) that the chunk builder drops into the streets
// in place of the plain code-built boxes. Credits: app/credits.
// Every building in the file stands on the ground with its middle at the origin, its long side along +X and its front facing +Z.
// The same game rules still apply: the lot (width, depth, height) and the collision box are unchanged, the model is stretched to fill the lot.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const BASE = "/midnightburn/city/";
export const CITY_LIB = { ready: false, failed: false, items: [], promise: null };
let mats = [];

// the picture the whole library shares, and a mask of which pixels are windows (they glow at night, a random few at a time)
export function libMaterial(envMap) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0.04, alphaTest: 0.5, envMap, envMapIntensity: 0.55, emissive: 0xffd49a, emissiveIntensity: 0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vLibWP;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvLibWP = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vLibWP;")
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n{ vec2 cell = vec2(floor((vLibWP.x + vLibWP.z) * 0.34), floor(vLibWP.y / 3.1)); float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453); float h2 = fract(sin(dot(cell + 7.1, vec2(39.346, 11.135))) * 24634.6345); totalEmissiveRadiance *= step(0.46, h) * (0.55 + 0.7 * h2); }");
  };
  mats.push(m);
  if (CITY_LIB.ready) attach(m);
  return m;
}
function attach(m) { if (!CITY_LIB.atlas) return; m.map = CITY_LIB.atlas; m.emissiveMap = CITY_LIB.win; m.needsUpdate = true; }

export function preloadCityLib() {
  if (CITY_LIB.promise) return CITY_LIB.promise;
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  const tl = new THREE.TextureLoader();
  const tex = (u, srgb) => new Promise((res) => { const t = tl.load(u, () => res(t), undefined, () => res(null)); t.flipY = false; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; });
  const geo = new Promise((res, rej) => loader.load(BASE + "city_lib.glb", (g) => res(g), undefined, rej));
  CITY_LIB.promise = Promise.all([geo, tex(BASE + "city_lib_atlas.webp", true), tex(BASE + "city_lib_win.webp", false)]).then(([g, atlas, win]) => {
    const v = new THREE.Vector3(); const items = [];
    g.scene.updateMatrixWorld(true);
    g.scene.traverse((o) => {
      if (!o.isMesh || !o.userData || !o.userData.w) return;
      const geom = o.geometry, pa = geom.attributes.position, na = geom.attributes.normal, ua = geom.attributes.uv, n = pa.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
      const M = o.matrixWorld; const nm = new THREE.Matrix3().getNormalMatrix(M);
      for (let k = 0; k < n; k++) { v.fromBufferAttribute(pa, k).applyMatrix4(M); pos[k * 3] = v.x; pos[k * 3 + 1] = v.y; pos[k * 3 + 2] = v.z; v.fromBufferAttribute(na, k).applyMatrix3(nm).normalize(); nor[k * 3] = v.x; nor[k * 3 + 1] = v.y; nor[k * 3 + 2] = v.z; uv[k * 2] = ua.getX(k); uv[k * 2 + 1] = ua.getY(k); }
      const ix = geom.index; const idx = ix ? Uint32Array.from(ix.array) : null;
      items.push({ name: o.name, cls: o.userData.cls, w: o.userData.w, d: o.userData.d, h: o.userData.h, pos, nor, uv, idx });
      geom.dispose();
    });
    CITY_LIB.items = items; CITY_LIB.atlas = atlas; CITY_LIB.win = win; CITY_LIB.ready = items.length > 0 && !!atlas;
    for (const m of mats) attach(m);
    return CITY_LIB;
  }).catch((e) => { console.warn("city library failed to load", e); CITY_LIB.failed = true; return CITY_LIB; });
  return CITY_LIB.promise;
}

// which model (if any) suits this lot? Cheapest stretch wins; a hash of the building number picks among the best few so streets do not repeat.
const lg = Math.log;
function fit(it, w, d, h) {
  const sx = w / it.w, sz = d / it.d, sy = h / it.h;
  if (sx < 0.38 || sx > 1.7 || sz < 0.38 || sz > 1.7 || sy < 0.55 || sy > 2.1) return 1e9;
  const asp = Math.abs(lg(sx / sy)); if (asp > 0.75) return 1e9; // windows must not look squashed
  return Math.abs(lg(sx)) * 0.7 + Math.abs(lg(sz)) * 0.5 + Math.abs(lg(sy)) * 1.0 + asp * 0.6;
}
export function pickPrefab(b, classes, hash) {
  if (!CITY_LIB.ready) return null;
  const best = [];
  for (const it of CITY_LIB.items) { if (classes.indexOf(it.cls) < 0) continue; const c = fit(it, b.w, b.d, b.h); if (c < 1e8) best.push([c, it]); }
  if (!best.length) return null;
  best.sort((a, z) => a[0] - z[0]);
  const top = best.slice(0, Math.min(3, best.length));
  return top[Math.floor(hash * top.length) % top.length][1];
}

// put one model into a chunk's geometry builder
export function placePrefab(gb, it, b, yb, yt, face, mirror, tint) {
  const c = Math.cos(b.rot), s = Math.sin(b.rot), sx = b.w / it.w * face * (mirror ? -1 : 1), sz = b.d / it.d * face, sy = (yt - yb) / it.h;
  const base = gb.nv, n = it.pos.length / 3, P = it.pos, N = it.nor, U = it.uv;
  for (let k = 0; k < n; k++) {
    const lx = P[k * 3] * sx, lz = P[k * 3 + 2] * sz, ly = P[k * 3 + 1];
    let nx = N[k * 3] * face * (mirror ? -1 : 1), nz = N[k * 3 + 2] * face;
    const dk = 0.66 + 0.34 * Math.min(1, ly * sy / 7); // a little darker at street level (shade between the buildings)
    gb.v(b.x + lx * c - lz * s, yb + ly * sy, b.z + lx * s + lz * c, nx * c - nz * s, N[k * 3 + 1], nx * s + nz * c, tint * dk, tint * dk, tint * dk, U[k * 2], U[k * 2 + 1]);
  }
  const I = it.idx, m = I.length;
  if (gb.ni + m > gb.icap) gb.growI(gb.ni + m);
  const out = gb.i; let o = gb.ni;
  if (mirror) for (let k = 0; k < m; k += 3) { out[o++] = base + I[k]; out[o++] = base + I[k + 2]; out[o++] = base + I[k + 1]; }
  else for (let k = 0; k < m; k++) out[o++] = base + I[k];
  gb.ni = o;
}


// ---- Upgrade 85: real street props (lamps, bus stops, benches, hydrants, road signs) -----------------------------------------------------------------
// Every prop stands on the ground with its foot at the origin, upright (+Y), facing +Z (a lamp's arm and a bus stop's open side point to +Z).
export const PROPS = { ready: false, failed: false, byName: {}, lamps: [], signs: [], benches: [], busstops: [], hydrant: null, atlas: null, win: null, promise: null };
const pmats = [];
export function propsMaterial(envMap) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.15, alphaTest: 0.5, envMap, envMapIntensity: 0.7, emissive: 0xffe2b0, emissiveIntensity: 0 });
  pmats.push(m); if (PROPS.ready) { m.map = PROPS.atlas; m.emissiveMap = PROPS.win; m.needsUpdate = true; }
  return m;
}
export function preloadProps() {
  if (PROPS.promise) return PROPS.promise;
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder); const tl = new THREE.TextureLoader();
  const tex = (u, srgb) => new Promise((res) => { const t = tl.load(u, () => res(t), undefined, () => res(null)); t.flipY = false; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; });
  const geo = new Promise((res, rej) => loader.load(BASE + "props_lib.glb", (g) => res(g), undefined, rej));
  PROPS.promise = Promise.all([geo, tex(BASE + "props_lib_atlas.webp", true), tex(BASE + "props_lib_win.webp", false)]).then(([g, atlas, win]) => {
    const v = new THREE.Vector3(); g.scene.updateMatrixWorld(true);
    g.scene.traverse((o) => {
      if (!o.isMesh || !o.userData || !o.userData.w) return;
      const geom = o.geometry, pa = geom.attributes.position, na = geom.attributes.normal, ua = geom.attributes.uv, n = pa.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
      const M = o.matrixWorld; const nm = new THREE.Matrix3().getNormalMatrix(M);
      for (let k = 0; k < n; k++) { v.fromBufferAttribute(pa, k).applyMatrix4(M); pos[k * 3] = v.x; pos[k * 3 + 1] = v.y; pos[k * 3 + 2] = v.z; v.fromBufferAttribute(na, k).applyMatrix3(nm).normalize(); nor[k * 3] = v.x; nor[k * 3 + 1] = v.y; nor[k * 3 + 2] = v.z; uv[k * 2] = ua.getX(k); uv[k * 2 + 1] = ua.getY(k); }
      const idx = geom.index ? Uint32Array.from(geom.index.array) : null; if (!idx) return;
      const it = { name: o.name, cls: o.userData.cls, w: o.userData.w, d: o.userData.d, h: o.userData.h, pos, nor, uv, idx };
      PROPS.byName[o.name] = it; geom.dispose();
    });
    const B = PROPS.byName; const by = (re) => Object.keys(B).filter((k) => re.test(k)).sort().map((k) => B[k]);
    PROPS.lamps = by(/^lamp_/); PROPS.signs = by(/^sign_/); PROPS.benches = by(/^bench_/); PROPS.busstops = by(/^busstop_/); PROPS.hydrant = B.hydrant || null;
    PROPS.atlas = atlas; PROPS.win = win; PROPS.ready = !!atlas && PROPS.lamps.length > 0;
    for (const m of pmats) { m.map = atlas; m.emissiveMap = win; m.needsUpdate = true; }
    return PROPS;
  }).catch((e) => { console.warn("props library failed to load", e); PROPS.failed = true; return PROPS; });
  return PROPS.promise;
}
// stand one prop at (x,y,z); its +Z points along (dx,dz); k scales sideways, ky scales up
export function placeProp(gb, it, x, y, z, dx, dz, k, ky, tint) {
  const l = Math.hypot(dx, dz) || 1; const sn = dx / l, cs = dz / l; // rotation about Y taking +Z to (dx,dz)
  const base = gb.nv, n = it.pos.length / 3, P = it.pos, N = it.nor, U = it.uv;
  for (let q = 0; q < n; q++) {
    const lx = P[q * 3] * k, lz = P[q * 3 + 2] * k, nx = N[q * 3], nz = N[q * 3 + 2];
    gb.v(x + lx * cs + lz * sn, y + P[q * 3 + 1] * ky, z - lx * sn + lz * cs, nx * cs + nz * sn, N[q * 3 + 1], -nx * sn + nz * cs, tint, tint, tint, U[q * 2], U[q * 2 + 1]);
  }
  const I = it.idx, m = I.length; if (gb.ni + m > gb.icap) gb.growI(gb.ni + m);
  const out = gb.i; let o = gb.ni; for (let q = 0; q < m; q++) out[o++] = base + I[q]; gb.ni = o;
}


// ---- Upgrade 87: real trees (sakura, maples, oaks, fantasy and blossom trees ...) --------------------------------------------------------------------
export const TREES = { ready: false, failed: false, items: [], cum: [], atlas: null, promise: null };
const tmats = [];
export function treesMaterial(envMap) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.5, envMap, envMapIntensity: 0.4 });
  tmats.push(m); if (TREES.ready) { m.map = TREES.atlas; m.needsUpdate = true; }
  return m;
}
export function preloadTrees() {
  if (TREES.promise) return TREES.promise;
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder); const tl = new THREE.TextureLoader();
  const tex = (u) => new Promise((res) => { const t = tl.load(u, () => res(t), undefined, () => res(null)); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; });
  const geo = new Promise((res, rej) => loader.load(BASE + "trees_lib.glb", (g) => res(g), undefined, rej));
  TREES.promise = Promise.all([geo, tex(BASE + "trees_lib_atlas.webp")]).then(([g, atlas]) => {
    const v = new THREE.Vector3(); g.scene.updateMatrixWorld(true); const items = [];
    g.scene.traverse((o) => {
      if (!o.isMesh || !o.userData || !o.userData.w) return;
      const geom = o.geometry, pa = geom.attributes.position, na = geom.attributes.normal, ua = geom.attributes.uv, n = pa.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); const M = o.matrixWorld; const nm = new THREE.Matrix3().getNormalMatrix(M);
      for (let k = 0; k < n; k++) { v.fromBufferAttribute(pa, k).applyMatrix4(M); pos[k * 3] = v.x; pos[k * 3 + 1] = v.y; pos[k * 3 + 2] = v.z; v.fromBufferAttribute(na, k).applyMatrix3(nm).normalize(); nor[k * 3] = v.x; nor[k * 3 + 1] = v.y; nor[k * 3 + 2] = v.z; uv[k * 2] = ua.getX(k); uv[k * 2 + 1] = ua.getY(k); }
      const idx = geom.index ? Uint32Array.from(geom.index.array) : null; if (!idx) return;
      items.push({ name: o.name, w: o.userData.w, d: o.userData.d, h: o.userData.h, tris: idx.length / 3, pos, nor, uv, idx }); geom.dispose();
    });
    // light trees are picked more often than heavy ones
    let acc = 0; const cum = items.map((it) => (acc += 1 / Math.max(1500, it.tris))); const tot = acc; TREES.items = items; TREES.cum = cum.map((c) => c / tot);
    TREES.atlas = atlas; TREES.ready = items.length > 0 && !!atlas; for (const m of tmats) { m.map = atlas; m.needsUpdate = true; }
    return TREES;
  }).catch((e) => { console.warn("trees failed to load", e); TREES.failed = true; return TREES; });
  return TREES.promise;
}
export function pickTree(h01) { const c = TREES.cum; for (let i = 0; i < c.length; i++) if (h01 <= c[i]) return TREES.items[i]; return TREES.items[TREES.items.length - 1]; }
