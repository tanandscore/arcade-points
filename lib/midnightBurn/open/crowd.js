// Midnight Burn — people. A pool of a few hundred low-poly pedestrians that walk the pavements around the camera, and (during a
// festival) gather in crowds in front of pandals, dance in garba circles and cheer. Two instanced meshes (clothes, skin & hair)
// share one matrix per person; legs and arms swing in the vertex shader, so hundreds of walkers cost a handful of draw calls.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const FEST_CLOTH = {
  ganapati: [0xff9d1c, 0xffd24a, 0xf4f0e6, 0xe84b2a, 0xffb347, 0xffffff, 0xd9a441, 0x3c9d5c, 0xff6f91, 0x5b7fd6],
  navratri: [0xe63b7a, 0xffc300, 0x2fb5a6, 0x7a3fd1, 0xff7a1c, 0xd62828, 0x2f80ed, 0xfff1c9, 0x43a047, 0xff5fa2],
  diwali: [0xffb703, 0xe85d04, 0xfff3d6, 0xd62839, 0x7b2cbf, 0x2a9d8f, 0xffd166, 0xf72585, 0x3a86ff, 0xf1c0e8],
  off: [0x35506b, 0x7a3b3b, 0xd9d3c4, 0x2e6b4f, 0xb5833a, 0x4a4a55, 0x8f5f9f, 0x2f6fa5, 0xc4602f, 0x6e7c52, 0xd9a0b0, 0x222831],
};
const SKIN = [0xc98f63, 0xb87a4d, 0xd9a577, 0xa8683f, 0x8d5a36, 0xe0b186, 0x774a2d];

const rnd = (() => { let a = 20260; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();

// ---- people: three body types built from smooth tapered parts (man in shirt and trousers, woman in kurta/saree with a long plait, older man in a long kurta).
// Extra vertex attributes say which vertices are legs (aLeg) and arms (aArm) so the shader can swing them.
function personGeos(kind) {
  const cl = [], sk = [];
  const part = (list, geo, x, y, z, col, leg = 0, arm = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.scale(sx, sy, sz); if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz); g.translate(x, y, z);
    const n = g.attributes.position.count; const c = new Float32Array(n * 3); for (let i = 0; i < n; i++) { c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2]; }
    g.setAttribute("color", new THREE.BufferAttribute(c, 3)); g.setAttribute("aLeg", new THREE.BufferAttribute(new Float32Array(n).fill(leg), 1)); g.setAttribute("aArm", new THREE.BufferAttribute(new Float32Array(n).fill(arm), 1));
    g.deleteAttribute("uv"); list.push(g);
  };
  const cyl = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg), box = (w, h, d) => new THREE.BoxGeometry(w, h, d), ball = (r) => new THREE.IcosahedronGeometry(r, 1);
  const HAIR = kind === 2 ? [0.5, 0.5, 0.5] : [0.06, 0.045, 0.035], DARK = [0.09, 0.09, 0.1];
  // head and neck are common
  const head = (y, hairBack) => {
    part(sk, cyl(0.045, 0.05, 0.1), 0, y - 0.12, 0, [1, 1, 1]); part(sk, ball(0.112), 0, y, 0, [1, 1, 1], 0, 0, 0.88, 1.1, 1); part(sk, box(0.028, 0.04, 0.04), 0, y - 0.01, 0.112, [0.92, 0.92, 0.92]);
    part(sk, ball(0.118), 0, y + 0.045, -0.012, HAIR, 0, 0, 0.95, 0.62, 1.04); part(sk, box(0.02, 0.02, 0.012), 0.04, y + 0.015, 0.1, [0.05, 0.04, 0.04]); part(sk, box(0.02, 0.02, 0.012), -0.04, y + 0.015, 0.1, [0.05, 0.04, 0.04]);
    if (hairBack) { part(sk, box(0.17, 0.34, 0.08), 0, y - 0.16, -0.085, HAIR); part(sk, cyl(0.03, 0.02, 0.4, 5), 0, y - 0.38, -0.12, HAIR); } // long hair and a plait
  };
  const arms = (y, w, sleeve, col) => { for (const sg of [-1, 1]) { part(cl, cyl(w, w * 0.85, sleeve), sg * 0.26, y - sleeve / 2 + 0.05, 0, col, 0, sg); part(sk, cyl(w * 0.8, w * 0.7, 0.55 - sleeve), sg * 0.26, y - sleeve - (0.55 - sleeve) / 2 + 0.05, 0, [1, 1, 1], 0, sg); part(sk, ball(0.048), sg * 0.26, y - 0.52, 0, [1, 1, 1], 0, sg); part(cl, ball(w * 1.22), sg * 0.245, y + 0.04, 0, col, 0, sg); } };
  if (kind === 0) { // man: shirt and trousers
    for (const sg of [-1, 1]) { part(cl, cyl(0.082, 0.062, 0.8), sg * 0.095, 0.44, 0, [0.3, 0.3, 0.33], sg); part(cl, box(0.12, 0.07, 0.27), sg * 0.095, 0.035, 0.05, DARK, sg); }
    part(cl, box(0.34, 0.2, 0.2), 0, 0.88, 0, [0.3, 0.3, 0.33]); part(cl, cyl(0.2, 0.165, 0.58), 0, 1.15, 0, [1, 1, 1], 0, 0, 1, 1, 0.62); arms(1.38, 0.052, 0.28, [0.95, 0.95, 0.95]); head(1.62, false);
  } else if (kind === 1) { // woman: kurta/saree, dupatta and long hair
    part(cl, cyl(0.17, 0.28, 0.85, 10), 0, 0.63, 0, [1, 1, 1], 0, 0, 1, 1, 0.8); for (const sg of [-1, 1]) part(cl, box(0.1, 0.06, 0.24), sg * 0.08, 0.03, 0.06, DARK, sg);
    part(cl, cyl(0.17, 0.15, 0.5), 0, 1.17, 0, [1, 1, 1], 0, 0, 1, 1, 0.62); part(cl, box(0.1, 0.78, 0.03), 0.06, 1.12, 0.125, [0.8, 0.8, 0.8], 0, 0, 1, 1, 1, 0, 0.55); part(cl, box(0.34, 0.06, 0.14), 0, 1.4, -0.06, [0.8, 0.8, 0.8]); arms(1.36, 0.042, 0.22, [0.95, 0.95, 0.95]); head(1.58, true);
  } else { // older man: long kurta over loose pyjama
    for (const sg of [-1, 1]) { part(cl, cyl(0.09, 0.075, 0.8), sg * 0.095, 0.44, 0, [0.62, 0.6, 0.58], sg); part(cl, box(0.11, 0.06, 0.25), sg * 0.095, 0.03, 0.05, [0.12, 0.09, 0.07], sg); }
    part(cl, cyl(0.19, 0.25, 0.72, 10), 0, 1.0, 0, [1, 1, 1], 0, 0, 1, 1, 0.66); part(cl, cyl(0.2, 0.19, 0.3), 0, 1.35, 0, [1, 1, 1], 0, 0, 1, 1, 0.62); arms(1.38, 0.054, 0.4, [0.95, 0.95, 0.95]); head(1.6, false);
  }
  return { cloth: mergeGeometries(cl), skin: mergeGeometries(sk) };
}

function patch(mat, tintMul) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = { value: 0 }; mat.userData.sh = sh;
    sh.vertexShader = "attribute float aLeg; attribute float aArm; attribute float aPh; attribute float aAmp; attribute float aUp; uniform float uTime;\n" + sh.vertexShader.replace("#include <begin_vertex>", `
      vec3 transformed = vec3(position);
      float ph = uTime * 7.0 * (0.6 + aAmp * 0.4) + aPh;
      float sw = sin(ph) * aAmp;
      if (aLeg != 0.0) { float a = aLeg * sw * 0.75; float c = cos(a), s = sin(a); vec3 p = transformed; p.y -= 0.82; transformed = vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c); transformed.y += 0.82; }
      if (aArm != 0.0) { float a = aArm * (sw * 0.65 * (1.0 - aUp) - aUp * (2.55 + sin(uTime * 6.0 + aPh) * 0.35)); float c = cos(a), s = sin(a); vec3 p = transformed; p.y -= 1.38; transformed = vec3(p.x, p.y * c - p.z * s, p.y * s + p.z * c); transformed.y += 1.38; }
    `);
  };
}

export function createCrowd(scene, world, opts = {}) {
  const city = world.city; const N = opts.max || 760; const SITE_POOL = Math.floor(N * 0.55); // the last part of the pool is reserved for crowds at festival sites
  const clothMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 }), skinMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0, emissive: 0x2a1a10 });
  patch(clothMat); patch(skinMat);
  const NA = 3, ARCH = []; // one pair of instanced meshes per body type
  for (let k = 0; k < NA; k++) {
    const { cloth, skin } = personGeos(k);
    const mk = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, N); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; m.castShadow = true; m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); scene.add(m); return m; };
    const a = { cloth, skin, mc: mk(cloth, clothMat), ms: mk(skin, skinMat), aPh: new THREE.InstancedBufferAttribute(new Float32Array(N), 1), aAmp: new THREE.InstancedBufferAttribute(new Float32Array(N), 1), aUp: new THREE.InstancedBufferAttribute(new Float32Array(N), 1), n: 0 };
    for (const g of [cloth, skin]) { g.setAttribute("aPh", a.aPh); g.setAttribute("aAmp", a.aAmp); g.setAttribute("aUp", a.aUp); }
    ARCH.push(a);
  }
  // person state: mode 0 walker on a pavement, 1 stands & bobs, 2 dances, 3 circles (garba), 4 idle
  const P = []; for (let i = 0; i < N; i++) P.push({ arch: 0, mode: 0, x: 0, y: 0, z: 0, yaw: 0, sc: 1, r: null, s: 0, dir: 1, side: 1, sp: 1.2, off: 0, seed: rnd() * 100, active: false, site: -1, cx: 0, cz: 0, rad: 0, ang: 0, w: 0 });
  const dum = new THREE.Object3D(); const col = new THREE.Color();
  let car = null; const hitLog = { n: 0, fast: 0, kills: 0 }; // pedestrians the player's car has hit since the last takeHits()
  let lastAssignT = -9, mode = "off", t = 0, camX = 0, camZ = 0, active = 0, sites = [];

  const eligible = (r) => !r.ramp && r.cls !== "hwy" && r.ground !== false && !(r.pts[0].tun);
  function placeOnRoad(p, x, z) {
    const nr = city.nearestRoad(x, z, 70, (r) => eligible(r), null); if (!nr) return false;
    const r = nr.road, a = r.pts[nr.i]; if (a.w > 0.25 || a.tun || a.y - a.g > 1.2) return false;
    p.r = r; p.s = a.s + (r.pts[nr.i + 1].s - a.s) * nr.t; p.dir = rnd() < 0.5 ? 1 : -1; p.side = rnd() < 0.5 ? 1 : -1; p.off = r.width / 2 + 0.9 + rnd() * 1.1; p.sp = 0.8 + rnd() * 0.9; p.mode = 0; return true;
  }
  function styleOf(p, big) {
    const pal = FEST_CLOTH[mode] || FEST_CLOTH.off; p.sc = big ? 1 + (rnd() - 0.5) * 0.12 : 1 + (rnd() - 0.5) * 0.14; if (rnd() < 0.14) p.sc = 0.62 + rnd() * 0.12; // some children
    const c = pal[Math.floor(rnd() * pal.length)]; col.set(c).multiplyScalar(0.75 + rnd() * 0.4); return [col.r, col.g, col.b];
  }
  const skinCols = SKIN.map((h) => new THREE.Color(h));
  function setLook(i, p, big) {
    p.cc = styleOf(p, big); const s = skinCols[Math.floor(rnd() * skinCols.length)]; p.sk = [s.r * 1.15, s.g * 1.15, s.b * 1.15];
  }
  function seed(i, big) { const p = P[i]; p.seed = rnd() * 100; const u = rnd(); p.arch = u < 0.46 ? 0 : u < 0.84 ? 1 : 2; setLook(i, p, big); }
  for (let i = 0; i < N; i++) seed(i, false);

  function respawn(i) { // somewhere on a pavement near the camera, out of sight if possible
    for (let k = 0; k < 4; k++) { const a = rnd() * 6.283, d = 30 + rnd() * 140; if (placeOnRoad(P[i], camX + Math.cos(a) * d, camZ + Math.sin(a) * d)) { seed(i, false); P[i].active = true; return true; } }
    P[i].active = false; return false;
  }

  // festival crowds: each site that is near gets a crescent of people facing the idol / a garba ring
  let lastKey = "";
  function assignSites() {
    const near = sites.filter((s) => Math.hypot(s.x - camX, s.z - camZ) < 260).sort((a, b) => Math.hypot(a.x - camX, a.z - camZ) - Math.hypot(b.x - camX, b.z - camZ));
    const want = mode === "off" ? 0 : mode === "navratri" ? 46 : mode === "diwali" ? 30 : 54;
    const chosen = near.slice(0, Math.floor(SITE_POOL / Math.max(1, want))); const key = mode + ":" + chosen.map((s) => s.id).join(",");
    if (key === lastKey) return; lastKey = key;
    for (let i = N - SITE_POOL; i < N; i++) P[i].active = false;
    let idx = N - SITE_POOL;
    for (const s of chosen) {
      for (let k = 0; k < want; k++, idx++) {
        const p = P[idx]; const j = k / want; p.active = true; p.seed = rnd() * 100; p.site = s.id;
        if (mode === "navratri") { p.mode = 3; const ring = k < want * 0.55 ? 0 : 1; p.rad = 4.2 + ring * 2.7 + (rnd() - 0.5) * 0.5; p.ang = (k / (want * (ring ? 0.45 : 0.55))) * 6.283; p.w = (ring ? -1 : 1) * (0.32 + rnd() * 0.08); p.cx = s.x + s.nx * 4; p.cz = s.z + s.nz * 4; }
        else { p.mode = rnd() < 0.55 ? 2 : 1; const a = (j - 0.5) * 2.5, rr = 4.5 + rnd() * 8.5 + (j > 0.8 ? 3 : 0); const lx = Math.sin(a) * rr * 1.1, lz = 3 + Math.cos(a) * rr * 0.9; p.cx = s.x + s.tx * lx + s.nx * lz; p.cz = s.z + s.tz * lx + s.nz * lz; p.yaw = Math.PI / 2 - Math.atan2(s.x - p.cx, s.z - p.cz); p.rad = 0; }
        p.y = s.y; { const u = rnd(); p.arch = u < 0.44 ? 0 : u < 0.86 ? 1 : 2; } setLook(idx, p, true);
      }
    }
  }
  const roadPos = (p) => { // pavement position at arc length s
    const r = p.r, pts = r.pts; let lo = 0, hi = pts.length - 2; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pts[m].s <= p.s) lo = m; else hi = m - 1; }
    const a = pts[lo], b = pts[lo + 1]; const L = b.s - a.s || 1, f = Math.min(1, Math.max(0, (p.s - a.s) / L)); const tx = (b.x - a.x) / (Math.hypot(b.x - a.x, b.z - a.z) || 1), tz = (b.z - a.z) / (Math.hypot(b.x - a.x, b.z - a.z) || 1);
    p.x = a.x + (b.x - a.x) * f - tz * p.side * p.off; p.z = a.z + (b.z - a.z) * f + tx * p.side * p.off; p.y = a.y + (b.y - a.y) * f + 0.18; p.yaw = Math.atan2(tz * p.dir, tx * p.dir) * 1; // heading along the road
  };

  return {
    setMode(m, siteList) { mode = m; sites = siteList || []; for (const p of P) { p.active = false; p.site = -1; } active = 0; lastKey = ''; for (let i = 0; i < N; i++) { seed(i, false); setLook(i, P[i], false); } },
    // dens: how busy the streets are here (0..1); near: the player's position
    update(dt, cam, dens, night = true) {
      t += dt; camX = cam.x; camZ = cam.z;
      const target = Math.floor((N - SITE_POOL) * Math.min(1, 0.12 + dens * 0.95) * (mode === "off" ? 0.8 : 1.15));
      let spawned = 0;
      for (let i = 0; i < N - SITE_POOL; i++) {
        const p = P[i];
        if (i >= target) { p.active = false; continue; }
        if (!p.active || Math.hypot(p.x - camX, p.z - camZ) > 185) { if (spawned < 5 && respawn(i)) { spawned++; roadPos(p); } else if (!p.active) continue; }
        if (p.down) continue;
        p.s += p.dir * p.sp * dt; if (p.s < 0 || p.s > p.r.len) { p.dir = -p.dir; p.s = Math.max(0, Math.min(p.r.len, p.s)); }
        roadPos(p);
      }
      if (mode !== "off" && sites.length && t - lastAssignT > 1.2) { lastAssignT = t; assignSites(); }
      // draw
      let total = 0; const T = t; for (const a of ARCH) a.n = 0;
      for (let i = 0; i < N; i++) {
        const p = P[i]; if (!p.active) continue; const A = ARCH[p.arch], n = A.n; let amp = 1, up = 0;
        // run-over test: three points along the car body; a person within about a metre of the car is knocked down
        if (!p.down && car && car.speed > 1.5 && Math.abs(p.y - (car.y || 0)) < 2.2) {
          const cyw = car.yaw, cc = Math.cos(cyw), sn = Math.sin(cyw);
          for (const k of [-1.7, 0, 1.7]) { const dx = p.x - (car.x + cc * k), dz = p.z - (car.z + sn * k); if (dx * dx + dz * dz < 1.15 * 1.15) {
            const sp = car.speed; p.down = { t: 0, vx: (car.vx || cc * sp) * 0.85 + (Math.random() - 0.5) * 2, vz: (car.vz || sn * sp) * 0.85 + (Math.random() - 0.5) * 2, vy: 2.5 + Math.min(6, sp * 0.18), tilt: 0, side: Math.random() < 0.5 ? 1 : -1 };
            hitLog.n++; if (sp > 12) hitLog.fast++; if (sp > 18) hitLog.kills++; break; } }
        }
        if (p.down) {
          const d = p.down; d.t += dt; const g = p.y0 === undefined ? (p.y0 = p.y) : p.y0;
          d.vy -= 18 * dt; p.x += d.vx * dt; p.z += d.vz * dt; p.y += d.vy * dt; if (p.y < g + 0.12) { p.y = g + 0.12; d.vy = 0; d.vx *= Math.exp(-4 * dt); d.vz *= Math.exp(-4 * dt); } d.tilt = Math.min(Math.PI / 2, d.tilt + dt * 6);
          if (d.t > 5) { p.down = null; p.y0 = undefined; p.active = false; continue; }
          A.aAmp.setX(n, 0); A.aUp.setX(n, 0); A.aPh.setX(n, p.seed);
          dum.rotation.order = "YXZ"; dum.rotation.set(-d.tilt * d.side, -p.yaw + Math.PI / 2, 0); dum.position.set(p.x, p.y, p.z); dum.scale.setScalar(p.sc); dum.updateMatrix(); dum.rotation.order = "XYZ";
          A.mc.setMatrixAt(n, dum.matrix); A.ms.setMatrixAt(n, dum.matrix); A.mc.instanceColor.setXYZ(n, p.cc[0] * 0.8, p.cc[1] * 0.7, p.cc[2] * 0.7); A.ms.instanceColor.setXYZ(n, p.sk[0], p.sk[1], p.sk[2]); A.n++; total++; continue;
        }
        if (i >= N - SITE_POOL) {
          if (p.mode === 3) { p.ang += p.w * dt; p.x = p.cx + Math.cos(p.ang) * p.rad; p.z = p.cz + Math.sin(p.ang) * p.rad; p.yaw = Math.atan2(Math.cos(p.ang) * Math.sign(p.w), -Math.sin(p.ang) * Math.sign(p.w)); amp = 0.9; up = Math.sin(T * 1.6 + p.seed) > 0.2 ? 0.7 : 0; }
          else { p.x = p.cx + Math.sin(T * 1.7 + p.seed) * 0.07; p.z = p.cz; amp = p.mode === 2 ? 0.55 : 0.12; up = p.mode === 2 ? (Math.sin(T * 2.2 + p.seed) > 0.1 ? 1 : 0) : 0; }
        }
        A.aAmp.setX(n, amp); A.aUp.setX(n, up); A.aPh.setX(n, p.seed);
        const bob = p.mode === 2 ? Math.abs(Math.sin(T * 5 + p.seed)) * 0.12 : p.mode === 3 ? Math.abs(Math.sin(T * 4 + p.seed)) * 0.07 : p.mode === 1 ? Math.abs(Math.sin(T * 2 + p.seed)) * 0.03 : 0;
        dum.position.set(p.x, p.y + bob, p.z); dum.rotation.set(0, -p.yaw + Math.PI / 2, 0); dum.scale.setScalar(p.sc); dum.updateMatrix();
        A.mc.setMatrixAt(n, dum.matrix); A.ms.setMatrixAt(n, dum.matrix); A.mc.instanceColor.setXYZ(n, p.cc[0], p.cc[1], p.cc[2]); A.ms.instanceColor.setXYZ(n, p.sk[0], p.sk[1], p.sk[2]);
        A.n++; total++;
      }
      for (const A of ARCH) { A.mc.count = A.ms.count = A.n; A.mc.instanceMatrix.needsUpdate = A.ms.instanceMatrix.needsUpdate = A.aPh.needsUpdate = A.aAmp.needsUpdate = A.aUp.needsUpdate = A.mc.instanceColor.needsUpdate = A.ms.instanceColor.needsUpdate = true; }
      for (const m of [clothMat, skinMat]) if (m.userData.sh) m.userData.sh.uniforms.uTime.value = T;
      return total;
    },
    setCar(c) { car = c; },
    takeHits() { if (!hitLog.n) return null; const r = { n: hitLog.n, fast: hitLog.fast, kills: hitLog.kills }; hitLog.n = hitLog.fast = hitLog.kills = 0; return r; },
    count() { return ARCH.reduce((q, a) => q + a.n, 0); },
    dispose() { for (const a of ARCH) { scene.remove(a.mc, a.ms); a.cloth.dispose(); a.skin.dispose(); } clothMat.dispose(); skinMat.dispose(); },
  };
}
