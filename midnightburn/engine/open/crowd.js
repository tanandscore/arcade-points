// Midnight Burn — people. A pool of a few hundred pedestrians (bodies are built in people.js) that walk the pavements around the camera, and (during a
// festival) gather in crowds in front of pandals, dance in garba circles and cheer. Two instanced meshes (clothes, skin & hair)
// share one matrix per person; legs and arms swing in the vertex shader, so hundreds of walkers cost a handful of draw calls.
// Upgrade 23: walkers never cross a road at street level. Where a pavement meets a road (see walkways.js) they turn back, or - at the crossings
// that have one - climb the stairs of a skywalk and cross high above the road, or walk into a subway entrance and come out on the far side.
import * as THREE from "three";
import { IS_TOKYO } from "./mapId";
import { KINDS, buildKind, makePeopleMaterial, pickKind, KIND_SCALE } from "./people";

const FEST_CLOTH = {
  ganapati: [0xff9d1c, 0xffd24a, 0xf4f0e6, 0xe84b2a, 0xffb347, 0xffffff, 0xd9a441, 0x3c9d5c, 0xff6f91, 0x5b7fd6],
  navratri: [0xe63b7a, 0xffc300, 0x2fb5a6, 0x7a3fd1, 0xff7a1c, 0xd62828, 0x2f80ed, 0xfff1c9, 0x43a047, 0xff5fa2],
  diwali: [0xffb703, 0xe85d04, 0xfff3d6, 0xd62839, 0x7b2cbf, 0x2a9d8f, 0xffd166, 0xf72585, 0x3a86ff, 0xf1c0e8],
  off: IS_TOKYO ? [0x24304f, 0x1f2937, 0x2b3a67, 0xffffff, 0xff7aa8, 0x4cc3ff, 0xffd23f, 0x7bd88f, 0xff9a62, 0xf4efe6, 0xb28cff, 0x33415c, 0xff5c8a] : [0x35506b, 0x7a3b3b, 0xd9d3c4, 0x2e6b4f, 0xb5833a, 0x4a4a55, 0x8f5f9f, 0x2f6fa5, 0xc4602f, 0x6e7c52, 0xd9a0b0, 0x222831],
};
const SKIN = IS_TOKYO ? [0xf0c9a4, 0xe8bb94, 0xf6d6b6, 0xe0b088, 0xd9a577, 0xf3cfae, 0xe9c19b] : [0xc98f63, 0xb87a4d, 0xd9a577, 0xa8683f, 0x8d5a36, 0xe0b186, 0x774a2d];

const rnd = (() => { let a = 20260; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; })();

export function createCrowd(scene, world, opts = {}) {
  const city = world.city; const wk = world.walkways || null; const N = opts.max || 760; const SITE_POOL = Math.floor(N * 0.55); // the last part of the pool is reserved for crowds at festival sites
  const mat = makePeopleMaterial();
  const ARCH = []; // one instanced mesh per kind of person (people.js); every person in it shares the walking shader
  for (let k = 0; k < KINDS; k++) {
    const geo = buildKind(k);
    const m = new THREE.InstancedMesh(geo, mat, N); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; m.count = 0; m.castShadow = true;
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); // the tint of this person's clothes
    const a = { geo, m, aPA: new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3), aSkin: new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3), n: 0 };
    a.aPA.setUsage(THREE.DynamicDrawUsage); a.aSkin.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aPA", a.aPA); geo.setAttribute("aSkinC", a.aSkin); scene.add(m); ARCH.push(a);
  }
  // a soft dark patch under every person so they sit on the ground instead of floating
  const spotTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31); gr.addColorStop(0, "rgba(0,0,0,0.62)"); gr.addColorStop(0.55, "rgba(0,0,0,0.3)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
  const spotGeo = new THREE.PlaneGeometry(1, 1); spotGeo.rotateX(-Math.PI / 2);
  const spotMat = new THREE.MeshBasicMaterial({ map: spotTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const spots = new THREE.InstancedMesh(spotGeo, spotMat, N); spots.instanceMatrix.setUsage(THREE.DynamicDrawUsage); spots.frustumCulled = false; spots.count = 0; spots.renderOrder = 2; scene.add(spots);
  // person state: mode 0 walker on a pavement, 1 stands & bobs, 2 dances, 3 circles (garba), 4 idle
  const P = []; for (let i = 0; i < N; i++) P.push({ arch: 0, mode: 0, x: 0, y: 0, z: 0, yaw: 0, sc: 1, r: null, s: 0, dir: 1, side: 1, sp: 1.2, off: 0, seed: rnd() * 100, active: false, hid: false, site: -1, cx: 0, cz: 0, rad: 0, ang: 0, w: 0 });
  const dum = new THREE.Object3D(); const col = new THREE.Color();
  let car = null; const hitLog = { n: 0, fast: 0, kills: 0 }; // pedestrians the player's car has hit since the last takeHits()
  let lastAssignT = -9, mode = "off", t = 0, camX = 0, camZ = 0, active = 0, sites = [];

  const eligible = (r) => !r.ramp && r.cls !== "hwy" && r.ground !== false && !(r.pts[0].tun);
  function placeOnRoad(p, x, z) {
    const nr = city.nearestRoad(x, z, 70, (r) => eligible(r), null); if (!nr) return false;
    const r = nr.road, a = r.pts[nr.i]; if (a.w > 0.25 || a.tun || a.y - a.g > 1.2) return false;
    p.r = r; p.s = a.s + (r.pts[nr.i + 1].s - a.s) * nr.t; p.dir = rnd() < 0.5 ? 1 : -1; p.side = rnd() < 0.5 ? 1 : -1; p.off = r.width / 2 + 0.9 + rnd() * 1.1; p.sp = 0.8 + rnd() * 0.9; p.mode = 0;
    if (wk) for (const z of wk.zonesOf(r, p.side)) if (z.kind === "bar" && p.s > z.a && p.s < z.b) return false; // never start out standing on a road crossing
    return true;
  }
  function styleOf(p, big) {
    const pal = FEST_CLOTH[mode] || FEST_CLOTH.off; const ks = KIND_SCALE[p.arch]; p.sc = ks[0] + rnd() * (ks[1] - ks[0]); // children (kind 7) are small, the rest vary a little
    const c = pal[Math.floor(rnd() * pal.length)]; col.set(c).multiplyScalar(0.75 + rnd() * 0.4); return [col.r, col.g, col.b];
  }
  const skinCols = SKIN.map((h) => new THREE.Color(h));
  function setLook(i, p, big) {
    p.cc = styleOf(p, big); const s = skinCols[Math.floor(rnd() * skinCols.length)]; p.sk = [s.r * 1.15, s.g * 1.15, s.b * 1.15];
  }
  function seed(i, big) { const p = P[i]; p.seed = rnd() * 100; p.arch = pickKind(rnd()); setLook(i, p, big); }
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
        p.y = s.y; p.arch = pickKind(rnd()); setLook(idx, p, true);
      }
    }
  }
  const roadPos = (p) => { // pavement position at arc length s
    const r = p.r, pts = r.pts; let lo = 0, hi = pts.length - 2; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pts[m].s <= p.s) lo = m; else hi = m - 1; }
    const a = pts[lo], b = pts[lo + 1]; const L = b.s - a.s || 1, f = Math.min(1, Math.max(0, (p.s - a.s) / L)); const tx = (b.x - a.x) / (Math.hypot(b.x - a.x, b.z - a.z) || 1), tz = (b.z - a.z) / (Math.hypot(b.x - a.x, b.z - a.z) || 1);
    // on a skywalk the walker keeps to the stair line and is lifted by the stair/deck height; in a subway entrance he is out of sight
    let off = p.off, lift = 0; p.hid = false;
    if (wk) for (const z of wk.zonesOf(r, p.side)) {
      if (z.a > p.s) break; if (p.s >= z.b || !z.st) continue;
      if (z.kind === "sky") { const st = z.st, e = Math.min(1, Math.min(p.s - st.a, st.b - p.s) / 1.5); off = p.off + (st.off - p.off) * e; lift = wk.heightAt(st, p.s); }
      else if (z.kind === "sub") p.hid = true;
    }
    p.x = a.x + (b.x - a.x) * f - tz * p.side * off; p.z = a.z + (b.z - a.z) * f + tx * p.side * off; p.y = a.y + (b.y - a.y) * f + 0.18 + lift; p.yaw = Math.atan2(tz * p.dir, tx * p.dir) * 1; // heading along the road
  };
  // one step of walking along the pavement: a closed zone (a street-level road crossing) turns the walker round
  function walk(p, dt) {
    const s0 = p.s; let s1 = s0 + p.dir * p.sp * dt;
    if (wk) for (const z of wk.zonesOf(p.r, p.side)) {
      if (z.kind !== "bar") continue;
      if (s1 > z.a && s1 < z.b) { if (s0 > z.a && s0 < z.b) { const toA = s0 - z.a < z.b - s0; s1 = toA ? z.a : z.b; p.dir = toA ? -1 : 1; } else { s1 = s0; p.dir = -p.dir; } break; }
    }
    p.s = s1; if (p.s < 0 || p.s > p.r.len) { p.dir = -p.dir; p.s = Math.max(0, Math.min(p.r.len, p.s)); }
  }

  let densK = 1; // the picture-quality step thins the crowd on lighter steps
  return {
    setDensity(k, shadows) { densK = k; for (const A of ARCH) A.m.castShadow = !!shadows; },
    setMode(m, siteList) { mode = m; sites = siteList || []; for (const p of P) { p.active = false; p.site = -1; } active = 0; lastKey = ''; for (let i = 0; i < N; i++) { seed(i, false); setLook(i, P[i], false); } },
    // dens: how busy the streets are here (0..1); near: the player's position
    update(dt, cam, dens, night = true) {
      t += dt; camX = cam.x; camZ = cam.z;
      const target = Math.floor((N - SITE_POOL) * Math.min(1, 0.12 + dens * 0.95) * (mode === "off" ? 0.8 : 1.15) * densK);
      let spawned = 0;
      for (let i = 0; i < N - SITE_POOL; i++) {
        const p = P[i];
        if (i >= target) { p.active = false; continue; }
        if (!p.active || Math.hypot(p.x - camX, p.z - camZ) > 185) { if (spawned < 5 && respawn(i)) { spawned++; roadPos(p); } else if (!p.active) continue; }
        if (p.down) continue;
        walk(p, dt);
        roadPos(p);
      }
      if (mode !== "off" && sites.length && t - lastAssignT > 1.2) { lastAssignT = t; assignSites(); }
      // draw
      let total = 0, spotN = 0; const T = t; for (const a of ARCH) a.n = 0;
      for (let i = 0; i < N; i++) {
        const p = P[i]; if (!p.active || p.hid) continue; const A = ARCH[p.arch], n = A.n; let amp = 1, up = 0;
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
          A.aPA.setXYZ(n, p.seed, 0, 0);
          dum.rotation.order = "YXZ"; dum.rotation.set(-d.tilt * d.side, -p.yaw + Math.PI / 2, 0); dum.position.set(p.x, p.y, p.z); dum.scale.setScalar(p.sc); dum.updateMatrix(); dum.rotation.order = "XYZ";
          A.m.setMatrixAt(n, dum.matrix); A.m.instanceColor.setXYZ(n, p.cc[0] * 0.8, p.cc[1] * 0.7, p.cc[2] * 0.7); A.aSkin.setXYZ(n, p.sk[0] * 0.85, p.sk[1] * 0.75, p.sk[2] * 0.75); A.n++; total++; continue;
        }
        if (i >= N - SITE_POOL) {
          if (p.mode === 3) { p.ang += p.w * dt; p.x = p.cx + Math.cos(p.ang) * p.rad; p.z = p.cz + Math.sin(p.ang) * p.rad; p.yaw = Math.atan2(Math.cos(p.ang) * Math.sign(p.w), -Math.sin(p.ang) * Math.sign(p.w)); amp = 0.9; up = Math.sin(T * 1.6 + p.seed) > 0.2 ? 0.7 : 0; }
          else { p.x = p.cx + Math.sin(T * 1.7 + p.seed) * 0.07; p.z = p.cz; amp = p.mode === 2 ? 0.55 : 0.12; up = p.mode === 2 ? (Math.sin(T * 2.2 + p.seed) > 0.1 ? 1 : 0) : 0; }
        }
        if (p.pose) { amp = p.pose.amp; up = p.pose.up; } // (tests pose people by hand)
        A.aPA.setXYZ(n, p.seed, amp, up);
        const bob = p.mode === 2 ? Math.abs(Math.sin(T * 5 + p.seed)) * 0.12 : p.mode === 3 ? Math.abs(Math.sin(T * 4 + p.seed)) * 0.07 : p.mode === 1 ? Math.abs(Math.sin(T * 2 + p.seed)) * 0.03 : 0;
        dum.position.set(p.x, p.y + bob, p.z); dum.rotation.set(0, -p.yaw + Math.PI / 2, 0); dum.scale.setScalar(p.sc); dum.updateMatrix();
        A.m.setMatrixAt(n, dum.matrix); A.m.instanceColor.setXYZ(n, p.cc[0], p.cc[1], p.cc[2]); A.aSkin.setXYZ(n, p.sk[0], p.sk[1], p.sk[2]);
        dum.position.set(p.x, p.y - 0.012, p.z); dum.rotation.set(0, 0, 0); dum.scale.setScalar(0.95 * p.sc); dum.updateMatrix(); spots.setMatrixAt(spotN++, dum.matrix);
        A.n++; total++;
      }
      for (const A of ARCH) { A.m.count = A.n; A.m.instanceMatrix.needsUpdate = A.aPA.needsUpdate = A.aSkin.needsUpdate = A.m.instanceColor.needsUpdate = true; }
      spots.count = spotN; spots.instanceMatrix.needsUpdate = true;
      if (mat.userData.sh) mat.userData.sh.uniforms.uTime.value = T;
      return total;
    },
    setCar(c) { car = c; },
    people() { return P; }, // for tests: the pool of people
    takeHits() { if (!hitLog.n) return null; const r = { n: hitLog.n, fast: hitLog.fast, kills: hitLog.kills }; hitLog.n = hitLog.fast = hitLog.kills = 0; return r; },
    count() { return ARCH.reduce((q, a) => q + a.n, 0); },
    dispose() { for (const a of ARCH) { scene.remove(a.m); a.geo.dispose(); } scene.remove(spots); spotGeo.dispose(); spotMat.dispose(); spotTex.dispose(); mat.dispose(); },
  };
}
