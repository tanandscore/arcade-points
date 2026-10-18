// Combat effects: bullet tracers, sparks, dust, bullet holes, blood, brass, smoke clouds, grenade blasts and the bomb blast.
import * as THREE from "three";
import { makeGlow, glowTexture } from "@/lib/cinematic/atmos";

function softTex() {
  const c = document.createElement("canvas"); c.width = c.height = 128; const g = c.getContext("2d");
  const gr = g.createRadialGradient(64, 64, 2, 64, 64, 62); gr.addColorStop(0, "rgba(255,255,255,0.9)"); gr.addColorStop(0.5, "rgba(255,255,255,0.45)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  let s = 11; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 46; i++) { const x = 18 + r() * 92, y = 18 + r() * 92, rad = 8 + r() * 20; const gg = g.createRadialGradient(x, y, 0, x, y, rad); gg.addColorStop(0, "rgba(255,255,255,0.2)"); gg.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

class Particles {
  constructor(scene, max, additive, sizeScale = 1) {
    this.max = max; this.n = 0; this.items = new Array(max).fill(null).map(() => ({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, size: 0.1, r: 1, g: 1, b: 1, grav: 0, drag: 0, grow: 0 }));
    const g = new THREE.BufferGeometry(); this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 4); this.siz = new Float32Array(max);
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3)); g.setAttribute("aCol", new THREE.BufferAttribute(this.col, 4)); g.setAttribute("aSize", new THREE.BufferAttribute(this.siz, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false, uniforms: { uScale: { value: 700 * sizeScale }, uTex: { value: additive ? glowTexture() : softTex() } },
      vertexShader: "attribute vec4 aCol; attribute float aSize; varying vec4 vC; uniform float uScale; void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / max(0.3, -mv.z); gl_Position = projectionMatrix * mv; }",
      fragmentShader: "uniform sampler2D uTex; varying vec4 vC; void main(){ vec4 t = texture2D(uTex, gl_PointCoord); gl_FragColor = vec4(vC.rgb * t.a * " + (additive ? "1.8" : "1.0") + ", t.a * vC.a); }",
    });
    this.pts = new THREE.Points(g, this.mat); this.pts.frustumCulled = false; scene.add(this.pts); this.cursor = 0; this.geo = g;
  }
  emit(o) {
    for (let k = 0; k < this.max; k++) { const i = (this.cursor + k) % this.max; const p = this.items[i]; if (!p.alive) { this.cursor = (i + 1) % this.max; Object.assign(p, { alive: true, vx: 0, vy: 0, vz: 0, grav: 0, drag: 0, grow: 0, r: 1, g: 1, b: 1 }, o); p.life = 0; return p; } }
    const i = this.cursor; this.cursor = (i + 1) % this.max; const p = this.items[i]; Object.assign(p, { alive: true, vx: 0, vy: 0, vz: 0, grav: 0, drag: 0, grow: 0, r: 1, g: 1, b: 1 }, o); p.life = 0; return p;
  }
  update(dt) {
    let any = false;
    for (let i = 0; i < this.max; i++) {
      const p = this.items[i]; const o = i * 3;
      if (!p.alive) { this.col[i * 4 + 3] = 0; this.siz[i] = 0; continue; }
      p.life += dt; if (p.life >= p.max) { p.alive = false; this.col[i * 4 + 3] = 0; this.siz[i] = 0; continue; } any = true;
      p.vy -= p.grav * dt; const d = Math.max(0, 1 - p.drag * dt); p.vx *= d; p.vy *= d; p.vz *= d; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < 0.02 && p.grav > 0) { p.y = 0.02; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      const k = p.life / p.max; this.pos[o] = p.x; this.pos[o + 1] = p.y; this.pos[o + 2] = p.z; this.col[i * 4] = p.r; this.col[i * 4 + 1] = p.g; this.col[i * 4 + 2] = p.b; this.col[i * 4 + 3] = (1 - k) * (1 - k) * (p.a ?? 1); this.siz[i] = p.size * (1 + p.grow * k);
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.aCol.needsUpdate = true; this.geo.attributes.aSize.needsUpdate = true;
  }
}

export function createFx(scene) {
  const sparks = new Particles(scene, 420, true, 0.8), puffs = new Particles(scene, 260, false, 1.0), blood = new Particles(scene, 200, false, 0.5);
  const tmpV = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), q = new THREE.Quaternion();
  // tracers
  const tracers = []; const tGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < 40; i++) { const m = new THREE.Mesh(tGeo, new THREE.MeshBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false })); m.visible = false; m.frustumCulled = false; scene.add(m); tracers.push({ m, life: 0, max: 0.1 }); }
  let tc = 0;
  function tracer(a, b, color, thick = 0.03) {
    const T = tracers[tc++ % tracers.length]; const len = a.distanceTo(b); if (len < 1.5) return; T.m.visible = true; T.life = 0; T.max = 0.09; T.m.material.color.setHex(color); T.m.material.opacity = 0.9;
    tmpV.copy(b).sub(a).normalize(); q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tmpV); T.m.quaternion.copy(q); const seg = Math.min(len, 14); T.m.scale.set(thick, thick, seg); T.m.position.copy(a).addScaledVector(tmpV, len - seg / 2); T.a = a.clone(); T.dir = tmpV.clone(); T.len = len; T.seg = seg;
  }
  // bullet holes and blood splats (ring buffers of flat discs)
  const holeGeo = new THREE.CircleGeometry(0.05, 10); const holeMat = new THREE.MeshBasicMaterial({ color: 0x050607, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const HN = 180; const holes = new THREE.InstancedMesh(holeGeo, holeMat, HN); holes.frustumCulled = false; holes.count = 0; scene.add(holes); let hc = 0;
  const splatGeo = new THREE.CircleGeometry(1, 14); const splatMat = new THREE.MeshBasicMaterial({ color: 0x4a0a10, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const SN = 80; const splats = new THREE.InstancedMesh(splatGeo, splatMat, SN); splats.frustumCulled = false; splats.count = 0; scene.add(splats); let sc = 0;
  const dummy = new THREE.Object3D();
  function hole(p, n) { dummy.position.set(p.x + n.x * 0.01, p.y + n.y * 0.01, p.z + n.z * 0.01); dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); dummy.scale.setScalar(0.8 + Math.random() * 0.6); dummy.updateMatrix(); holes.setMatrixAt(hc % HN, dummy.matrix); hc++; holes.count = Math.min(hc, HN); holes.instanceMatrix.needsUpdate = true; }
  function splat(x, z, size) { dummy.position.set(x, 0.012, z); dummy.rotation.set(-Math.PI / 2, 0, Math.random() * 6); dummy.scale.set(size, size * (0.6 + Math.random() * 0.6), 1); dummy.updateMatrix(); splats.setMatrixAt(sc % SN, dummy.matrix); sc++; splats.count = Math.min(sc, SN); splats.instanceMatrix.needsUpdate = true; }
  function clearDecals() { hc = 0; sc = 0; holes.count = 0; splats.count = 0; }

  function impact(p, n, kind) {
    const metal = kind === "prop"; const nn = new THREE.Vector3(n.x, n.y, n.z);
    for (let i = 0; i < (metal ? 9 : 5); i++) { const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).addScaledVector(nn, 1.2).multiplyScalar(2.2 + Math.random() * 3.5); sparks.emit({ x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, max: 0.25 + Math.random() * 0.3, size: 0.07, r: 1, g: 0.78, b: 0.36, grav: 9, drag: 1.2 }); }
    for (let i = 0; i < 3; i++) puffs.emit({ x: p.x, y: p.y, z: p.z, vx: nn.x * 0.8 + (Math.random() - 0.5) * 0.5, vy: 0.3 + Math.random() * 0.6, vz: nn.z * 0.8 + (Math.random() - 0.5) * 0.5, max: 0.8 + Math.random() * 0.5, size: 0.5 + Math.random() * 0.3, r: 0.5, g: 0.52, b: 0.55, a: 0.35, grow: 2.2, drag: 1.5 });
    if (kind !== "floor") hole(p, nn);
  }
  function bloodHit(p, dir, heavy) {
    for (let i = 0; i < (heavy ? 18 : 9); i++) { const v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2).addScaledVector(dir, 3).multiplyScalar(0.8 + Math.random()); blood.emit({ x: p.x, y: p.y, z: p.z, vx: v.x, vy: v.y, vz: v.z, max: 0.6 + Math.random() * 0.5, size: 0.14 + Math.random() * 0.1, r: 0.55, g: 0.04, b: 0.06, a: 0.95, grav: 9, drag: 0.6 }); }
    if (Math.random() < 0.5) splat(p.x + dir.x * 1.2, p.z + dir.z * 1.2, 0.25 + Math.random() * 0.35);
  }
  // muzzle flash light (pooled)
  const mLights = []; for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xffc880, 0, 22, 2); scene.add(l); mLights.push({ l, life: 0, max: 0.06, peak: 0 }); }
  let ml = 0; function muzzle(p, power = 1, color = 0xffc880) { const M = mLights[ml++ % mLights.length]; M.l.position.copy(p); M.l.color.setHex(color); M.peak = 340 * power; M.life = 0; M.max = 0.07; }
  // shells
  const shells = []; const shellMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6), new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.9, roughness: 0.3 }), 40); shellMesh.frustumCulled = false; shellMesh.count = 0; scene.add(shellMesh);
  function shell(p, vx, vy, vz) { shells.push({ x: p.x, y: p.y, z: p.z, vx, vy, vz, rx: Math.random() * 6, rz: Math.random() * 6, life: 0 }); if (shells.length > 40) shells.shift(); }
  // smoke clouds
  const sTex = softTex(); const clouds = [];
  function smoke(x, y, z, r, dur) {
    const g = new THREE.Group(); g.position.set(x, 0, z); const sp = [];
    for (let i = 0; i < 26; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sTex, color: 0x9aa2aa, transparent: true, depthWrite: false, opacity: 0, fog: true })); const a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * r * 0.7; s.userData = { x: Math.cos(a) * rr, z: Math.sin(a) * rr, y: 0.6 + Math.random() * (r * 0.9), size: r * (0.9 + Math.random() * 0.9), ph: Math.random() * 6, delay: Math.random() * 0.5 }; g.add(s); sp.push(s); }
    scene.add(g); const c = { x, y, z, r, born: 0, dur, g, sp, age: 0 }; clouds.push(c); return c;
  }
  // big blast (bomb or grenade)
  const blasts = [];
  function blast(x, y, z, size, color = 0xffa040) {
    const g = new THREE.Group(); g.position.set(x, y, z); const core = makeGlow(0xfff0c0, size * 1.2, 1); const halo = makeGlow(color, size * 3, 0.8); g.add(halo, core);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 40), new THREE.MeshBasicMaterial({ color: 0xffd8a0, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.2; g.add(ring);
    const light = new THREE.PointLight(color, 0, size * 8, 2); g.add(light); scene.add(g); blasts.push({ g, core, halo, ring, light, life: 0, max: 1.1 + size * 0.05, size });
    for (let i = 0; i < Math.min(80, 20 + size * 6); i++) { const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9, Math.random() - 0.5).normalize().multiplyScalar((6 + Math.random() * 14) * (size / 6 + 0.4)); sparks.emit({ x, y: y + 0.4, z, vx: v.x, vy: v.y + 3, vz: v.z, max: 0.7 + Math.random() * 0.9, size: 0.14, r: 1, g: 0.6 + Math.random() * 0.3, b: 0.2, grav: 11, drag: 0.8 }); }
    for (let i = 0; i < 26; i++) { const v = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() - 0.5).multiplyScalar(size * 0.9); puffs.emit({ x, y: y + 0.5, z, vx: v.x, vy: v.y + 1.5, vz: v.z, max: 1.6 + Math.random() * 1.2, size: size * (0.35 + Math.random() * 0.4), r: 0.22, g: 0.2, b: 0.2, a: 0.7, grow: 2.2, drag: 1.4 }); }
  }
  function update(dt, t) {
    sparks.update(dt); puffs.update(dt); blood.update(dt);
    for (const T of tracers) { if (!T.m.visible) continue; T.life += dt; const k = T.life / T.max; if (k >= 1) { T.m.visible = false; continue; } T.m.material.opacity = 0.9 * (1 - k); const adv = Math.min(T.len - T.seg / 2, T.len * k * 0.0); }
    for (const M of mLights) { M.life += dt; const k = M.life / M.max; M.l.intensity = k < 1 ? M.peak * (1 - k) : 0; }
    // brass
    for (let i = shells.length - 1; i >= 0; i--) { const s = shells[i]; s.life += dt; s.vy -= 12 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; if (s.y < 0.02) { s.y = 0.02; s.vy *= -0.35; s.vx *= 0.5; s.vz *= 0.5; } s.rx += dt * 12; if (s.life > 6) shells.splice(i, 1); }
    shellMesh.count = shells.length; shells.forEach((s, i) => { dummy.position.set(s.x, s.y, s.z); dummy.rotation.set(s.rx, 0, s.rz); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); shellMesh.setMatrixAt(i, dummy.matrix); }); shellMesh.instanceMatrix.needsUpdate = true;
    // smoke
    for (let i = clouds.length - 1; i >= 0; i--) {
      const c = clouds[i]; c.age += dt; const out = c.age > c.dur - 3.5 ? Math.max(0, (c.dur - c.age) / 3.5) : 1;
      for (const s of c.sp) { const u = s.userData; const grow = Math.min(1, Math.max(0, (c.age - u.delay) / 1.4)); s.position.set(u.x + Math.sin(t * 0.3 + u.ph) * 0.4, u.y + Math.sin(t * 0.2 + u.ph) * 0.2, u.z + Math.cos(t * 0.25 + u.ph) * 0.4); s.scale.setScalar(u.size * (0.4 + 0.6 * grow) * 1.5); s.material.opacity = 0.95 * grow * out; }
      c.cur = out; if (c.age > c.dur) { scene.remove(c.g); c.sp.forEach((s) => s.material.dispose()); clouds.splice(i, 1); }
    }
    for (let i = blasts.length - 1; i >= 0; i--) {
      const b = blasts[i]; b.life += dt; const k = b.life / b.max; if (k >= 1) { scene.remove(b.g); b.light.dispose && b.light.dispose(); blasts.splice(i, 1); continue; }
      b.core.material.opacity = Math.max(0, 1 - k * 2.2); b.halo.material.opacity = 0.8 * Math.max(0, 1 - k * 1.3); b.core.scale.setScalar(b.size * (1.2 + k * 3)); b.halo.scale.setScalar(b.size * (3 + k * 4)); b.ring.scale.setScalar(1 + k * b.size * 4.5); b.ring.material.opacity = 0.8 * (1 - k); b.light.intensity = Math.max(0, 1 - k * 1.6) * b.size * 900;
    }
  }
  function reset() { clearDecals(); shells.length = 0; for (const c of clouds) { scene.remove(c.g); c.sp.forEach((s) => s.material.dispose()); } clouds.length = 0; for (const b of blasts) scene.remove(b.g); blasts.length = 0; }
  // true if the straight line from a to b passes through a live smoke cloud
  function smokeBlocks(ax, ay, az, bx, by, bz) {
    for (const c of clouds) {
      if (c.age < 0.8 || (c.cur ?? 1) < 0.35) continue; const dx = bx - ax, dy = by - ay, dz = bz - az, L2 = dx * dx + dy * dy + dz * dz; if (L2 < 1e-6) continue;
      const cy = Math.min(2.2, c.r * 0.6); let t = ((c.x - ax) * dx + (cy - ay) * dy + (c.z - az) * dz) / L2; t = Math.max(0, Math.min(1, t)); const px = ax + dx * t - c.x, py = ay + dy * t - cy, pz = az + dz * t - c.z; if (px * px + py * py * 0.35 + pz * pz < c.r * c.r * 0.7) return true;
    }
    return false;
  }
  return { sparks, puffs, tracer, impact, bloodHit, muzzle, shell, smoke, blast, update, reset, smokeBlocks, clouds, splat, hole };
}
