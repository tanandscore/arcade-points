"use client";
// Starbreak flight missions: dogfights, convoy guard, asteroid field, cruiser hunt, trench run and the final dreadnought assault.
import { THREE, clearScene, mesh, glowMesh, sprite, rnd, clamp, lerp, metalTexture, noiseTexture, toScreen } from "@/threeplay/core";

export const MISSIONS = [
  { id: "patrol", name: "Patrol Break", sub: "Two waves of Dominion raiders", type: "dogfight", waves: [3, 4], tip: "Mouse or WASD to steer. Hold left click to fire lasers. Hold the crosshair on a raider for a missile lock, then right click." },
  { id: "convoy", name: "Convoy Guard", sub: "Keep the supply ships alive", type: "convoy", waves: [3, 3, 4], tip: "Protect the three green supply ships. Lose two and the mission fails." },
  { id: "rocks", name: "Rockfall", sub: "A dogfight inside an asteroid field", type: "rocks", waves: [4, 5], tip: "Use the rocks for cover, but they hurt if you hit them. Brake with Space, boost with Shift." },
  { id: "cruiser", name: "Cruiser Hunter", sub: "Knock out a warship's engines", type: "cruiser", waves: [3], engines: 3, tip: "Destroy the four glowing engine pods on the big warship. Its turrets will fire at you, so keep moving." },
  { id: "trench", name: "Trench Run", sub: "Fly the station's canyon and fire the torpedo", type: "trench", length: 4600, tip: "Steer through the gaps in the barriers. At the end, press right click to fire the torpedo at the glowing port." },
  { id: "dread", name: "Dreadnought", sub: "The final battle", type: "dread", waves: [4, 5, 5], engines: 5, tip: "Clear the fighters, then take out all six engine pods on the dreadnought." },
];

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const Z = V(0, 0, 1), UP = V(0, 1, 0);

export function makeShip(kind = "dart") {
  const g = new THREE.Group();
  if (kind === "dart") { // the Free Fleet fighter: swept wings, blue glow
    const body = mesh(new THREE.ConeGeometry(0.7, 6, 8), 0xd8dde8, { rough: 0.35, metal: 0.6 }); body.rotation.x = Math.PI / 2; g.add(body);
    const cab = mesh(new THREE.SphereGeometry(0.55, 10, 8), 0x2a5a8a, { rough: 0.1, metal: 0.8, emissive: 0x1a3a6a, ei: 0.6 }); cab.scale.set(1, 0.7, 1.8); cab.position.set(0, 0.45, -0.3); g.add(cab);
    for (const s of [-1, 1]) { const w = mesh(new THREE.BoxGeometry(3.2, 0.12, 2.2), 0xc0c8d8, { rough: 0.4, metal: 0.6 }); w.position.set(s * 1.8, 0, -1.2); w.rotation.y = s * 0.45; w.rotation.z = s * -0.12; g.add(w); const w2 = mesh(new THREE.BoxGeometry(0.12, 1.1, 1.6), 0xe84a3a, { rough: 0.5 }); w2.position.set(s * 3.2, 0.2, -1.8); g.add(w2); const gun = mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6), 0x444a58, { metal: 0.8 }); gun.rotation.x = Math.PI / 2; gun.position.set(s * 3.2, 0.2, -0.4); g.add(gun); const e = glowMesh(new THREE.CylinderGeometry(0.28, 0.4, 0.5, 8), 0x6fd0ff, 3); e.rotation.x = Math.PI / 2; e.position.set(s * 0.6, 0, -3); g.add(e); const gl = sprite(0x6fd0ff, 2.2, 0.9); gl.position.set(s * 0.6, 0, -3.3); g.add(gl); }
    g.userData.guns = [V(-3.2, 0.2, 0.8), V(3.2, 0.2, 0.8)];
  } else if (kind === "talon") { // Dominion raider: dark, angular, red
    const body = mesh(new THREE.OctahedronGeometry(1.1), 0x3a3e4a, { rough: 0.4, metal: 0.7, flat: true }); body.scale.set(1, 0.7, 2.2); g.add(body);
    for (const s of [-1, 1]) { const w = mesh(new THREE.BoxGeometry(0.15, 3.4, 1.8), 0x2a2d38, { rough: 0.5, metal: 0.6 }); w.position.set(s * 1.7, 0, -0.3); w.rotation.z = s * 0.15; g.add(w); const pod = mesh(new THREE.CylinderGeometry(0.4, 0.4, 2.4, 8), 0x4a4e5a, { metal: 0.7 }); pod.rotation.x = Math.PI / 2; pod.position.set(s * 1.7, 0, 0); g.add(pod); }
    const eye = glowMesh(new THREE.SphereGeometry(0.4, 8, 8), 0xff3a2a, 3); eye.position.set(0, 0, 1.4); g.add(eye); const en = sprite(0xff3a2a, 2.4, 0.8); en.position.set(0, 0, -2.4); g.add(en);
    g.userData.guns = [V(-1.7, 0, 1.4), V(1.7, 0, 1.4)];
  } else if (kind === "transport") {
    const b = mesh(new THREE.BoxGeometry(5, 4, 18), 0x6a8a74, { rough: 0.5, metal: 0.4 }); g.add(b);
    for (let i = 0; i < 4; i++) { const c = mesh(new THREE.BoxGeometry(5.6, 2.2, 3), 0x8aa890, { rough: 0.6 }); c.position.set(0, 2.6, -6 + i * 4); g.add(c); }
    const br = mesh(new THREE.BoxGeometry(3, 2.5, 3), 0x9ab8a0, { rough: 0.4 }); br.position.set(0, 3, 7); g.add(br);
    for (const s of [-1, 1]) { const e = glowMesh(new THREE.CylinderGeometry(0.9, 1.2, 1, 10), 0x6fffa0, 2.5); e.rotation.x = Math.PI / 2; e.position.set(s * 1.6, 0, -9.3); g.add(e); const gl = sprite(0x6fffa0, 5, 0.8); gl.position.set(s * 1.6, 0, -10.2); g.add(gl); }
    const bc = sprite(0x6fffa0, 9, 0.25); g.add(bc);
  }
  return g;
}

function makeCruiser(big, engines) {
  const g = new THREE.Group(), tex = metalTexture("#5a606e", 4, 6), S = big ? 1.5 : 1;
  const hull = mesh(new THREE.BoxGeometry(60 * S, 22 * S, 240 * S), 0x6a707e, { map: tex, rough: 0.5, metal: 0.6 }); g.add(hull);
  const deck = mesh(new THREE.BoxGeometry(44 * S, 8 * S, 150 * S), 0x5a606e, { map: tex, rough: 0.5, metal: 0.6 }); deck.position.set(0, 14 * S, -20 * S); g.add(deck);
  const tower = mesh(new THREE.BoxGeometry(20 * S, 26 * S, 30 * S), 0x7a808e, { map: tex, rough: 0.5, metal: 0.6 }); tower.position.set(0, 30 * S, -60 * S); g.add(tower);
  const bridge = glowMesh(new THREE.BoxGeometry(16 * S, 3 * S, 2), 0xffa050, 1.5); bridge.position.set(0, 40 * S, -44 * S); g.add(bridge);
  const nose = mesh(new THREE.ConeGeometry(30 * S, 70 * S, 4), 0x5a606e, { map: tex, rough: 0.5, metal: 0.6 }); nose.rotation.x = Math.PI / 2; nose.rotation.y = Math.PI / 4; nose.scale.set(1, 1, 0.5); nose.position.set(0, 0, 150 * S); g.add(nose);
  for (let i = 0; i < 40; i++) { const w = glowMesh(new THREE.BoxGeometry(1.4, 1.4, 0.4), 0xffd488, 1.6); w.position.set(rnd(-26, 26) * S, rnd(-4, 12) * S, rnd(-110, 90) * S); if (Math.random() < 0.5) { w.position.x = (Math.random() < 0.5 ? -1 : 1) * 30.2 * S; w.rotation.y = Math.PI / 2; w.position.y = rnd(-8, 8) * S; } else w.position.y = 18.2 * S + rnd(0, 0.1); g.add(w); }
  const eng = [], turrets = [];
  for (let i = 0; i < engines; i++) { const a = i / (engines - 1 || 1), x = (a - 0.5) * 48 * S, y = (i % 2 ? 4 : -2) * S; const e = new THREE.Group(); const pod = mesh(new THREE.CylinderGeometry(6 * S, 7 * S, 12, 12), 0x3a3e4a, { metal: 0.7 }); pod.rotation.x = Math.PI / 2; e.add(pod); const core = glowMesh(new THREE.SphereGeometry(4.2 * S, 12, 10), 0xff6a2a, 3); core.position.z = -7; e.add(core); const gl = sprite(0xff7a3a, 22 * S, 0.8); gl.position.z = -9; e.add(gl); e.position.set(x, y, -125 * S); g.add(e); eng.push({ node: e, core, glow: gl, hp: big ? 150 : 100, max: big ? 150 : 100, dead: false, local: e.position.clone() }); }
  const nt = big ? 10 : 6; for (let i = 0; i < nt; i++) { const t = new THREE.Group(); const base = mesh(new THREE.CylinderGeometry(2.4, 3, 1.6, 8), 0x4a4e5a, { metal: 0.7 }); t.add(base); const gun = mesh(new THREE.CylinderGeometry(0.35, 0.35, 5, 6), 0x2a2d38, { metal: 0.8 }); gun.rotation.x = Math.PI / 2; gun.position.set(0, 1, 2.4); t.add(gun); const gl = sprite(0xff3a2a, 3, 0.6); gl.position.y = 1; t.add(gl); const local = V(((i % 2) - 0.5) * 30 * S, (18 + 6) * S + 0.9, (-70 + (i >> 1) * (big ? 30 : 38)) * S); t.position.copy(local); g.add(t); turrets.push({ node: t, hp: 30, dead: false, cd: rnd(1, 3), local, gun }); }
  g.userData = { eng, turrets, S };
  return g;
}

export function createFlight(rig, ctx) {
  clearScene(rig); const { scene, fx, sound } = rig, M = MISSIONS[ctx.mission], trench = M.type === "trench", power = ctx.power || 1;
  if (rig.cine.bloom) rig.cine.bloom.strength = 0.55;
  const camera = rig.camera;
  scene.fog = null; scene.background = new THREE.Color(0x000000);
  rig.setSky({ zenith: 0x010208, mid: 0x04061a, horizon: 0x0a0f2a, sunDir: [0.7, 0.3, 0.6], sunColor: 0xffe0b0, sunSize: trench ? 0 : 0.01, glow: 0.4, cloud: 0, stars: 1.8 });
  scene.add(new THREE.HemisphereLight(trench ? 0x6a7aa0 : 0x3a4a8a, 0x1a1a2a, trench ? 1.4 : 0.9));
  const sun = new THREE.DirectionalLight(0xffe4c0, 2.8); sun.position.set(300, 150, 250); scene.add(sun);
  if (!trench) {
    const planet = new THREE.Mesh(new THREE.SphereGeometry(520, 48, 32), new THREE.MeshStandardMaterial({ map: noiseTexture(M.id === "rocks" ? "#7a5a48" : "#3a6a9a", 40, 4, 2), roughness: 1, emissive: 0x0a1020, emissiveIntensity: 0.4 })); planet.position.set(-1500, -500, 1800); scene.add(planet); const atm = sprite(0x6aa0ff, 1500, 0.35); atm.position.copy(planet.position); scene.add(atm);
    const neb = [[0xff4a8a, 1400, [900, 300, 1500]], [0x4a6aff, 1800, [-800, 500, -1600]], [0x8a4aff, 1200, [200, -700, 1700]]]; for (const [c, s, p] of neb) { const n = sprite(c, s, 0.22); n.position.set(...p); scene.add(n); }
  }

  // ----- player -----
  const P = { pos: V(0, 0, 0), q: new THREE.Quaternion(), speed: 70, yawV: 0, pitV: 0, shield: 100 + (power - 1) * 18, hull: 100, heat: 0, over: false, missiles: 6 + Math.floor(power / 2), lock: null, lockT: 0, fireCd: 0, lastHit: 99, alive: true, kills: 0, shots: 0, hits: 0, boost: 100, flash: 0, side: 1, bank: 0, x: 0, y: 6 };
  P.maxShield = P.shield; P.dmg = 1 + (power - 1) * 0.12;
  const ship = makeShip("dart"), shipRoot = new THREE.Group(); shipRoot.add(ship); scene.add(shipRoot);
  const enemies = [], shots = [], missiles = [], rocks = [], friends = [], flashes = [], obstacles = [], turretsW = [];
  const st = { phase: "intro", t: 0, time: 0, msg: "", over: false, endT: 0, wave: -1, waveT: 2, toast: "", toastT: 0, cruiser: null, objective: "", port: null, portDone: false, won: false, enginesLeft: 0, lostFriends: 0 };
  const say = (t, d = 2) => { st.toast = t; st.toastT = d; };

  function boom(p, size = 1) { fx.burst(p, 0xffa040, Math.round(26 * size), 14 * size, 0.9, 1.2 * size, 0); fx.burst(p, 0xffffff, Math.round(10 * size), 8 * size, 0.5, 1.0 * size, 0); const s = sprite(0xffc070, 8 * size, 1); s.position.copy(p); scene.add(s); flashes.push({ s, t: 0, size }); sound.play("boom"); const d = p.distanceTo(P.pos); if (d < 120) rig.shake = Math.max(rig.shake, 0.8 * size * (1 - d / 120)); }
  function bolt(from, dir, team, dmg, speed, color, life = 2.2, len = 3.2) {
    const m = glowMesh(new THREE.CylinderGeometry(0.12, 0.12, len, 5), color, 4); m.quaternion.setFromUnitVectors(UP, dir.clone().normalize()); m.position.copy(from);
    const gl = sprite(color, 1.6, 0.8); m.add(gl); scene.add(m);
    shots.push({ node: m, pos: from.clone(), vel: dir.clone().normalize().multiplyScalar(speed), team, dmg, life, r: 1.2 });
  }
  function damagePlayer(d) { if (!P.alive || st.phase !== "play") return; P.lastHit = 0; P.flash = 0.35; rig.shake = Math.max(rig.shake, 0.5); sound.play("hurt"); if (P.shield > 0) { const a = Math.min(P.shield, d); P.shield -= a; d -= a; } if (d > 0) P.hull -= d; if (P.hull <= 0) { P.hull = 0; P.alive = false; boom(P.pos, 1.6); shipRoot.visible = false; sound.play("lose"); st.phase = "lost"; st.endT = 0; } }

  // ----- enemies -----
  function spawnEnemy(kind = "talon", at) {
    const n = makeShip("talon"); if (kind === "ace") { n.scale.setScalar(1.25); n.traverse((o) => { if (o.material && o.material.color && o.material.emissive && o.material.emissive.getHex() === 0) o.material.color.offsetHSL(0, 0, -0.05); }); }
    const d = at || V(rnd(-1, 1), rnd(-0.4, 0.4), rnd(-1, 1)).normalize().multiplyScalar(rnd(280, 420)).add(P.pos);
    n.position.copy(d); scene.add(n);
    const e = { node: n, pos: d.clone(), q: new THREE.Quaternion(), speed: 70, hp: kind === "ace" ? 55 : 30, max: kind === "ace" ? 55 : 30, kind, state: "attack", st: rnd(3, 6), cd: rnd(1, 2), skill: M.id === "patrol" ? 0.8 : M.id === "dread" ? 1.15 : 1, dead: false, target: null, wob: rnd(0, 6), r: 3.2 };
    n.lookAt(P.pos); e.q.copy(n.quaternion); enemies.push(e); return e;
  }
  function killEnemy(e, byP = true) { if (e.dead) return; e.dead = true; boom(e.pos, 1); scene.remove(e.node); if (byP) { P.kills++; } }
  function updateEnemy(e, dt) {
    const tgt = e.target && !e.target.dead && friends.includes(e.target) ? e.target : null; const tp = tgt ? tgt.pos : P.pos, tv = tgt ? V(0, 0, 18) : P.fwd.clone().multiplyScalar(P.speed);
    const to = tp.clone().sub(e.pos), dist = to.length(); e.st -= dt; e.cd -= dt;
    let aim = to.clone();
    if (e.state === "attack") { const lead = dist / 190; aim.add(tv.clone().multiplyScalar(lead * 0.6)); if (e.st <= 0 || dist < 45) { e.state = "break"; e.st = rnd(1.6, 3); e.dir = V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).normalize(); } }
    else { aim = e.dir.clone().add(e.pos.clone().sub(tp).normalize().multiplyScalar(0.6)); if (e.st <= 0 && dist > 90) { e.state = "attack"; e.st = rnd(4, 7); } }
    aim.normalize(); const fwd = Z.clone().applyQuaternion(e.q), ang = fwd.angleTo(aim);
    const turn = Math.min(ang, 1.5 * e.skill * dt); if (ang > 0.0001) { const axis = fwd.clone().cross(aim).normalize(); if (axis.lengthSq() > 0) e.q.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, turn)); }
    e.speed = lerp(e.speed, e.state === "break" ? 95 : 75 * (0.85 + 0.15 * e.skill), dt * 1.5);
    const f2 = Z.clone().applyQuaternion(e.q); e.pos.addScaledVector(f2, e.speed * dt); e.wob += dt;
    for (const o of enemies) { if (o === e || o.dead) continue; const d = e.pos.distanceTo(o.pos); if (d < 9 && d > 0.01) e.pos.addScaledVector(e.pos.clone().sub(o.pos).normalize(), (9 - d) * 0.3); }
    for (const r of rocks) { const d = e.pos.distanceTo(r.pos); if (d < r.r + 4) { e.pos.addScaledVector(e.pos.clone().sub(r.pos).normalize(), (r.r + 4 - d) * 0.5); } }
    e.node.position.copy(e.pos); e.node.quaternion.copy(e.q); e.node.rotateZ(Math.sin(e.wob * 2) * 0.4);
    if (e.state === "attack" && ang < 0.1 && dist < 300 && e.cd <= 0 && st.phase === "play") { e.cd = (0.55 / e.skill) * rnd(0.8, 1.4); for (const g of e.node.userData.guns) { const wp = g.clone().applyQuaternion(e.q).add(e.pos); const dir = f2.clone().add(V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(0.03 / e.skill)); bolt(wp, dir, 1, 6 * (e.kind === "ace" ? 1.3 : 1), 210, 0xff3a2a, 2); } if (dist < 260) sound.play("laser"); }
    if (Math.random() < 0.4) fx.spark(e.pos.clone().addScaledVector(f2, -3), 0xff5030, 0.8, 0.35, 0.3);
  }

  // ----- world setup -----
  const dust = (() => { const N = 500, g = new THREE.BufferGeometry(), pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pos[i * 3] = rnd(-120, 120); pos[i * 3 + 1] = rnd(-120, 120); pos[i * 3 + 2] = rnd(-120, 120); } g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); const p = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xaab8e0, size: 0.35, transparent: true, opacity: 0.7, depthWrite: false })); p.frustumCulled = false; scene.add(p); return { p, pos, N }; })();
  if (M.type === "rocks") { const geo = new THREE.IcosahedronGeometry(1, 1); for (let i = 0; i < 160; i++) { const r = rnd(5, 36), a = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.07, 0.2, rnd(0.2, 0.4)), roughness: 1, flatShading: true, map: noiseTexture("#8a7a6a", 30, 1, 1) })); const p = V(rnd(-1, 1), rnd(-0.5, 0.5), rnd(-1, 1)).multiplyScalar(rnd(60, 700)); a.position.copy(p); a.scale.set(r * rnd(0.8, 1.2), r * rnd(0.7, 1.1), r * rnd(0.8, 1.2)); a.rotation.set(rnd(0, 6), rnd(0, 6), rnd(0, 6)); scene.add(a); rocks.push({ node: a, pos: p, r: r * 0.95, spin: V(rnd(-0.1, 0.1), rnd(-0.1, 0.1), 0) }); } P.pos.set(0, 0, -50); }
  if (M.type === "convoy") { for (let i = 0; i < 3; i++) { const t = makeShip("transport"); t.position.set((i - 1) * 55, (i % 2) * 15, 220 + i * 30); scene.add(t); friends.push({ node: t, pos: t.position.clone(), hp: 180, max: 180, dead: false, r: 11, bar: null }); } }
  if (M.type === "cruiser" || M.type === "dread") {
    const big = M.type === "dread", c = makeCruiser(big, M.engines); c.position.set(0, 40, big ? 700 : 520); c.rotation.y = Math.PI + 0.3; scene.add(c); st.cruiser = { g: c, ...c.userData, pos: c.position.clone(), alive: true, hp: 0 }; st.enginesLeft = M.engines; c.updateMatrixWorld(true);
  }
  if (trench) {
    const L = M.length, tex = metalTexture("#6a7080", 6, L / 18), W = 15;
    for (const s of [-1, 1]) { const w = mesh(new THREE.BoxGeometry(2, 40, L + 400), 0x6a7080, { map: tex, rough: 0.5, metal: 0.5 }); w.position.set(s * (W + 1), 18, L / 2); scene.add(w); for (let k = 0; k < 4; k++) { const strip = glowMesh(new THREE.BoxGeometry(0.2, 0.35, L + 300), k % 2 ? 0x6fd0ff : 0xff6a3a, 1.6); strip.position.set(s * (W - 0.1), 3 + k * 4.5, L / 2); scene.add(strip); } }
    const fl = mesh(new THREE.BoxGeometry(W * 2 + 4, 1, L + 400), 0x4a4e5a, { map: tex.clone(), rough: 0.6, metal: 0.4 }); fl.position.set(0, -0.5, L / 2); scene.add(fl);
    for (let z = 20; z < L; z += 36) { const p = glowMesh(new THREE.BoxGeometry(1.2, 0.1, 6), z % 72 ? 0x6fd0ff : 0xffd35a, 1.8); p.position.set(0, 0.06, z); scene.add(p); }
    for (let z = 140, i = 0; z < L - 260; z += 100 + rnd(0, 40), i++) { const gx = rnd(-6, 6), gy = rnd(5, 12), gw = 10, gh = 7, g = new THREE.Group(), bm = { map: tex, rough: 0.5, metal: 0.5 };
      const parts = [[W * 2 + 2, gy - gh / 2, 0, (gy - gh / 2) / 2], [W * 2 + 2, 24 - (gy + gh / 2), 0, (gy + gh / 2 + 24) / 2], [gx - gw / 2 + W, gh + 0.1, (-W + gx - gw / 2) / 2, gy], [W - (gx + gw / 2), gh + 0.1, (gx + gw / 2 + W) / 2, gy]];
      for (const [w, h, x, y] of parts) { if (h < 0.2 || w < 0.2) continue; const b = mesh(new THREE.BoxGeometry(w, h, 2.5), 0x7a8090, bm); b.position.set(x, y, 0); g.add(b); }
      const ring = glowMesh(new THREE.BoxGeometry(gw + 0.4, 0.3, 2.7), 0xff4a2a, 2.2); ring.position.set(gx, gy + gh / 2, 0); g.add(ring); const ring2 = ring.clone(); ring2.position.y = gy - gh / 2; g.add(ring2); g.position.z = z; scene.add(g); obstacles.push({ z, gx, gy, gw, gh, W });
      if (i % 2 === 0) for (const s of [-1, 1]) { if (Math.random() < 0.6) { const t = new THREE.Group(); const b = mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), 0x3a3e4a, { metal: 0.7 }); t.add(b); const gun = mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.2, 6), 0x1a1d28, { metal: 0.8 }); gun.rotation.x = Math.PI / 2; gun.position.z = 1.2; t.add(gun); const gl = sprite(0xff3a2a, 2.2, 0.8); t.add(gl); t.position.set(s * (W - 1), rnd(3, 11), z + rnd(30, 70)); scene.add(t); turretsW.push({ node: t, pos: t.position.clone(), hp: 20, dead: false, cd: rnd(0.5, 2), r: 1.4 }); } } }
    const port = new THREE.Group(); const pr = glowMesh(new THREE.TorusGeometry(1.4, 0.25, 8, 24), 0xffd35a, 3); pr.rotation.x = Math.PI / 2; port.add(pr); const pc = glowMesh(new THREE.CircleGeometry(1.2, 20), 0xff3a2a, 3); pc.rotation.x = -Math.PI / 2; pc.position.y = 0.05; port.add(pc); const pg = sprite(0xff7a3a, 12, 0.7); pg.position.y = 1; port.add(pg); port.position.set(0, 0.6, L); scene.add(port); st.port = { node: port, pos: port.position.clone() };
    const endwall = mesh(new THREE.BoxGeometry(W * 2 + 4, 40, 2), 0x4a4e5a, { map: tex, rough: 0.5, metal: 0.5 }); endwall.position.set(0, 18, L + 40); scene.add(endwall);
    P.pos.set(0, 7, 0); P.x = 0; P.y = 7; P.q.identity(); P.speed = 100;
  }
  function spawnWave() {
    st.wave++; const n = M.waves ? M.waves[st.wave] : 0; if (!n) return;
    for (let i = 0; i < n; i++) spawnEnemy(M.id === "dread" && i === 0 && st.wave > 0 ? "ace" : "talon");
    if (M.type === "convoy") for (const e of enemies) if (!e.dead && Math.random() < 0.65 && !e.target) e.target = friends[(Math.random() * friends.length) | 0];
    say(`Wave ${st.wave + 1}: ${n} raiders!`, 2.2); sound.play("alarm");
  }
  P.fwd = V(0, 0, 1);
  const camPos = V(), camQ = new THREE.Quaternion(), tmp = V(), tmp2 = V(), tq = new THREE.Quaternion(), eul = new THREE.Euler(0, 0, 0, "YXZ");
  camPos.set(0, 4, -16).add(P.pos);

  // ----- weapons -----
  function aimDir(out) { out.copy(Z).applyQuaternion(P.q); let best = null, ba = 0.045; for (const e of enemies) { if (e.dead) continue; const d = tmp2.copy(e.pos).sub(P.pos), a = d.angleTo(out); if (a < ba && d.length() < 600) { ba = a; best = e; } } if (best) { const d = tmp2.copy(best.pos).sub(P.pos); const lead = d.length() / 300; d.addScaledVector(Z.clone().applyQuaternion(best.q), best.speed * lead); out.lerp(d.normalize(), 0.7).normalize(); } return out; }
  function fireLaser() {
    if (P.fireCd > 0 || P.over) return; P.fireCd = 0.11; P.heat += 0.055; if (P.heat >= 1) { P.over = true; say("OVERHEAT", 1); }
    const dir = aimDir(V()), g = ship.userData.guns[(P.side = -P.side) > 0 ? 1 : 0]; const wp = g.clone().applyQuaternion(P.q).add(P.pos);
    bolt(wp, dir, 0, 9 * P.dmg, 340, 0x6fd0ff, 1.6, 4.5); P.shots++; sound.play("laser");
  }
  function fireMissile() {
    if (P.missiles <= 0) { say("No missiles left", 1); return; }
    if (trench) { if (!st.port || st.portDone || st.port.pos.z - P.pos.z > 700) { say("Port out of range", 1); return; } P.missiles--; const m = glowMesh(new THREE.ConeGeometry(0.4, 2, 6), 0xffd35a, 3); m.rotation.x = Math.PI / 2; m.position.copy(P.pos); scene.add(m); missiles.push({ node: m, pos: P.pos.clone(), vel: V(0, 0, 1).multiplyScalar(260), target: { pos: st.port.pos, isPort: true }, life: 4, turn: 3 }); sound.play("boom"); return; }
    if (!P.lock || P.lock.dead || P.lockT < 1) { say("Need a lock: hold the crosshair on a raider", 1.2); return; }
    P.missiles--; const m = mesh(new THREE.ConeGeometry(0.35, 2.4, 6), 0xe8e8f0, { metal: 0.6 }); m.rotation.x = Math.PI / 2; const fl = sprite(0xffa040, 2.4, 0.9); fl.position.y = -1.4; m.add(fl); const g = new THREE.Group(); g.add(m); g.position.copy(P.pos); g.quaternion.copy(P.q); scene.add(g);
    missiles.push({ node: g, pos: P.pos.clone(), vel: Z.clone().applyQuaternion(P.q).multiplyScalar(P.speed + 80), target: P.lock, life: 5, turn: 2.6 }); sound.play("whoosh"); P.lockT = 0;
  }

  // ----- update -----
  function update(dt, time) {
    const k = rig.keys, pr = rig.pressed; st.t += dt;
    if (st.toastT > 0) st.toastT -= dt;
    if (st.phase === "intro") { const c = 2.6 - st.t; st.msg = c > 0 ? M.name : "GO!"; if (st.t > 2.6) { st.phase = "play"; st.msg = "GO!"; if (M.waves) st.waveT = 0.5; st.objective = M.type === "trench" ? "Fly the trench, then torpedo the port" : M.engines ? "Destroy the engine pods" : "Destroy all raiders"; } }
    if (st.phase === "play" && st.msg === "GO!" && st.t > 3.8) st.msg = "";
    const playing = st.phase === "play" && P.alive;
    if (playing) st.time += dt;
    // ---- steering ----
    const mdx = rig.mouse.dx, mdy = rig.mouse.dy;
    if (trench) {
      const ix = ((k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0)) + mdx * 0.06, iy = ((k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0)) - mdy * 0.06;
      if (playing) { P.vx = lerp(P.vx || 0, clamp(ix, -1.5, 1.5) * 14, 1 - Math.exp(-dt * 6)); P.vy = lerp(P.vy || 0, clamp(iy, -1.5, 1.5) * 10, 1 - Math.exp(-dt * 6)); P.x = clamp(P.x + P.vx * dt, -12, 12); P.y = clamp(P.y + P.vy * dt, 2, 15); }
      const boosting = playing && (k.has("ShiftLeft") || k.has("ShiftRight")) && P.boost > 0, braking = playing && k.has("Space");
      const target = st.phase === "play" ? (boosting ? 150 : braking ? 70 : 105) : st.phase === "won" ? 100 : 0; if (boosting) P.boost = Math.max(0, P.boost - dt * 30); else P.boost = Math.min(100, P.boost + dt * 8); P.speed = lerp(P.speed, target, 1 - Math.exp(-dt * 2));
      P.pos.set(P.x, P.y, P.pos.z + P.speed * dt); P.q.setFromEuler(eul.set(-(P.vy || 0) * 0.015, -(P.vx || 0) * 0.012, 0)); P.bank = lerp(P.bank, -(P.vx || 0) * 0.04, 1 - Math.exp(-dt * 6));
      P.fwd.set(0, 0, 1);
    } else {
      const yaw = ((k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0) - (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0)) * 1.1 - mdx * 0.06, pit = ((k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0)) * 0.9 + mdy * 0.045;
      const rollIn = (k.has("KeyQ") ? 1 : 0) - (k.has("KeyE") ? 1 : 0);
      P.yawV = lerp(P.yawV, playing ? clamp(yaw, -1.6, 1.6) : 0, 1 - Math.exp(-dt * 7)); P.pitV = lerp(P.pitV, playing ? clamp(pit, -1.4, 1.4) : 0, 1 - Math.exp(-dt * 7));
      tq.setFromEuler(eul.set(P.pitV * dt * 1.3, P.yawV * dt * 1.3, rollIn * dt * 2.2)); P.q.multiply(tq).normalize();
      const boosting = playing && (k.has("ShiftLeft") || k.has("ShiftRight")) && P.boost > 0, braking = playing && (k.has("Space") || k.has("ControlLeft"));
      if (boosting) P.boost = Math.max(0, P.boost - dt * 28); else P.boost = Math.min(100, P.boost + dt * 9);
      P.speed = lerp(P.speed, st.phase === "intro" ? 40 : boosting ? 135 : braking ? 28 : 75, 1 - Math.exp(-dt * 2));
      P.fwd.copy(Z).applyQuaternion(P.q); P.pos.addScaledVector(P.fwd, P.speed * dt); P.bank = lerp(P.bank, -P.yawV * 0.5, 1 - Math.exp(-dt * 5));
    }
    P.fwd.copy(Z).applyQuaternion(P.q);
    // ---- weapons ----
    P.fireCd -= dt; P.heat = Math.max(0, P.heat - dt * (P.over ? 0.28 : 0.4)); if (P.over && P.heat < 0.35) P.over = false; P.lastHit += dt; if (P.lastHit > 3 && P.alive) P.shield = Math.min(P.maxShield, P.shield + dt * 14); P.flash = Math.max(0, P.flash - dt);
    if (playing && (rig.mouse.left || k.has("KeyJ"))) fireLaser();
    if (playing && (pr.has("KeyF") || rig.mouse.clickR || pr.has("KeyM"))) fireMissile();
    // lock-on
    if (!trench) { let best = null, ba = 0.1; for (const e of enemies) { if (e.dead) continue; const d = tmp2.copy(e.pos).sub(P.pos), a = d.angleTo(P.fwd); if (a < ba && d.length() < 700) { ba = a; best = e; } } if (best && best === P.lock) P.lockT = Math.min(1, P.lockT + dt * 1.3); else { P.lock = best; P.lockT = best ? Math.max(0, P.lockT - dt * 2) : 0; } }
    // ---- waves / enemies ----
    if (playing && M.waves) { const alive = enemies.filter((e) => !e.dead).length; if (st.wave < M.waves.length - 1 && alive <= 1) { st.waveT -= dt; if (st.waveT <= 0) { spawnWave(); st.waveT = 3; } } else if (st.wave < 0) { st.waveT -= dt; if (st.waveT <= 0) { spawnWave(); st.waveT = 3; } } }
    if (playing) for (let i = enemies.length - 1; i >= 0; i--) { const e = enemies[i]; if (e.dead) { enemies.splice(i, 1); continue; } updateEnemy(e, dt); }
    for (const f of friends) { if (f.dead) continue; f.pos.z += 18 * dt; f.node.position.copy(f.pos); }
    // cruiser
    if (st.cruiser) { const C = st.cruiser, g = C.g; g.rotation.y += dt * 0.004; g.updateMatrixWorld(true);
      for (const t of C.turrets) { if (t.dead) continue; t.wp = t.wp || V(); g.localToWorld(t.wp.copy(t.local)); t.cd -= dt; const d = t.wp.distanceTo(P.pos); if (playing && d < 520 && t.cd <= 0) { t.cd = rnd(1.4, 2.6); const dir = P.pos.clone().sub(t.wp).addScaledVector(P.fwd, P.speed * d / 150).normalize().add(V(rnd(-1, 1), rnd(-1, 1), rnd(-1, 1)).multiplyScalar(0.05)); bolt(t.wp, dir, 1, 9, 150, 0xff8a2a, 4, 5); } }
      for (const e of C.eng) { if (e.dead) continue; e.wp = e.wp || V(); g.localToWorld(e.wp.copy(e.local)); e.glow.material.opacity = 0.6 + Math.sin(time * 6 + e.local.x) * 0.2; }
    }
    // trench threats
    if (trench && playing) {
      for (const t of turretsW) { if (t.dead) continue; t.cd -= dt; const dz = t.pos.z - P.pos.z; if (dz > 20 && dz < 420 && t.cd <= 0) { t.cd = rnd(1.2, 2.2); const dir = P.pos.clone().add(V(0, 0, 100 * dz / 190)).sub(t.pos).normalize(); bolt(t.pos, dir, 1, 8, 190, 0xff3a2a, 3); t.node.lookAt(P.pos); } }
      if (P.pos.z > 700 && st.wave < 2 && Math.random() < dt * 0.25 && enemies.filter((e) => !e.dead).length < 3) { const e = spawnEnemy("talon", V(rnd(-8, 8), rnd(4, 12), P.pos.z + 500)); e.trench = true; e.hp = 18; e.max = 18; }
      for (const o of obstacles) { if (!o.hit && Math.abs(P.pos.z - o.z) < 2.2) { o.hit = true; const inGap = Math.abs(P.pos.x - o.gx) < o.gw / 2 - 0.8 && Math.abs(P.pos.y - o.gy) < o.gh / 2 - 0.8; if (!inGap) { damagePlayer(30); boom(P.pos.clone(), 0.8); P.speed *= 0.55; } else { fx.burst(P.pos, 0xffd35a, 6, 3, 0.3, 0.4, 0); } } }
      if (P.pos.z > M.length + 30 && !st.portDone) { st.phase = "lost"; st.endT = 0; st.msg = "MISSED THE PORT"; }
    }
    // trench enemies: fly head-on
    if (trench) for (const e of enemies) { if (e.dead || !e.trench) continue; e.pos.z -= 50 * dt; e.pos.x = lerp(e.pos.x, P.pos.x + Math.sin(time + e.wob) * 6, dt); e.pos.y = clamp(lerp(e.pos.y, P.pos.y, dt * 0.5), 3, 14); e.node.position.copy(e.pos); }
    // ---- shots ----
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]; s.life -= dt; s.pos.addScaledVector(s.vel, dt); s.node.position.copy(s.pos); let dead = s.life <= 0;
      if (!dead && s.team === 0) {
        for (const e of enemies) { if (e.dead) continue; if (e.pos.distanceTo(s.pos) < e.r + 1) { e.hp -= s.dmg; P.hits++; fx.burst(s.pos, 0x9fe8ff, 6, 6, 0.3, 0.5, 0); sound.play("hit"); if (e.hp <= 0) killEnemy(e); dead = true; break; } }
        if (!dead && st.cruiser) { const C = st.cruiser; for (const t of C.turrets) { if (t.dead || !t.wp) continue; if (t.wp.distanceTo(s.pos) < 4) { t.hp -= s.dmg; fx.burst(s.pos, 0xffd070, 5, 5, 0.3, 0.5, 0); if (t.hp <= 0) { t.dead = true; t.node.visible = false; boom(t.wp, 0.8); } dead = true; break; } } if (!dead) for (const e of C.eng) { if (e.dead || !e.wp) continue; if (e.wp.distanceTo(s.pos) < 8 * C.S) { e.hp -= s.dmg; P.hits++; fx.burst(s.pos, 0xff9040, 6, 6, 0.3, 0.6, 0); if (e.hp <= 0) { e.dead = true; e.node.visible = false; boom(e.wp, 2.4); st.enginesLeft--; say(st.enginesLeft ? `Engine down! ${st.enginesLeft} left` : "All engines down!", 2); } dead = true; break; } } if (!dead) { for (const hp of hullSpheres(C)) if (hp.distanceTo(s.pos) < hp.r) { dead = true; fx.burst(s.pos, 0xaab0c0, 3, 4, 0.2, 0.4, 0); break; } } }
        if (!dead && trench) for (const t of turretsW) { if (t.dead) continue; if (t.pos.distanceTo(s.pos) < 2.4) { t.hp -= s.dmg; if (t.hp <= 0) { t.dead = true; t.node.visible = false; boom(t.pos, 0.6); } dead = true; break; } }
        if (!dead) for (const r of rocks) if (r.pos.distanceTo(s.pos) < r.r) { dead = true; fx.burst(s.pos, 0xb09a80, 4, 4, 0.3, 0.5, 0); break; }
      } else if (!dead) {
        if (s.pos.distanceTo(P.pos) < 3.2 && P.alive) { damagePlayer(s.dmg); dead = true; }
        else for (const f of friends) { if (!f.dead && f.pos.distanceTo(s.pos) < f.r) { f.hp -= s.dmg; fx.burst(s.pos, 0xff7a3a, 4, 4, 0.3, 0.5, 0); if (f.hp <= 0) { f.dead = true; scene.remove(f.node); boom(f.pos, 2); st.lostFriends++; say("A supply ship was destroyed!", 2); } dead = true; break; } }
      }
      if (dead) { scene.remove(s.node); s.node.traverse((o) => { if (o.material) o.material.dispose(); if (o.geometry) o.geometry.dispose(); }); shots.splice(i, 1); }
    }
    for (let i = missiles.length - 1; i >= 0; i--) {
      const m = missiles[i]; m.life -= dt; const tg = m.target; let dead = m.life <= 0;
      if (tg && !tg.dead) { const want = tmp.copy(tg.pos).sub(m.pos).normalize(), cur = m.vel.clone().normalize(), ang = cur.angleTo(want); if (ang > 0.0001) { const axis = cur.clone().cross(want).normalize(); if (axis.lengthSq() > 0) cur.applyAxisAngle(axis, Math.min(ang, m.turn * dt)); } m.vel.copy(cur.multiplyScalar(m.vel.length() + 40 * dt)); }
      m.pos.addScaledVector(m.vel, dt); m.node.position.copy(m.pos); if (m.vel.lengthSq() > 0) { m.node.quaternion.setFromUnitVectors(Z, m.vel.clone().normalize()); }
      fx.spark(m.pos, 0xffa040, 1.0, 0.5, 0.4); fx.spark(m.pos, 0xffffff, 0.6, 0.3, 0.2);
      if (tg && tg.isPort && m.pos.distanceTo(tg.pos) < 5) { st.portDone = true; dead = true; boom(tg.pos, 3); for (let q = 0; q < 6; q++) setTimeout(() => boom(tg.pos.clone().add(V(rnd(-30, 30), rnd(0, 40), rnd(-40, 40))), 2.6), q * 260); st.phase = "won"; st.endT = 0; st.msg = "DIRECT HIT!"; sound.play("win"); }
      else if (tg && !tg.dead && !tg.isPort && m.pos.distanceTo(tg.pos) < 6) { tg.hp -= 70 * P.dmg; boom(m.pos, 0.9); dead = true; if (tg.hp <= 0) killEnemy(tg); }
      if (!dead && st.cruiser) { for (const e of st.cruiser.eng) { if (!e.dead && e.wp && e.wp.distanceTo(m.pos) < 12) { e.hp -= 70 * P.dmg; boom(m.pos, 1); dead = true; if (e.hp <= 0) { e.dead = true; e.node.visible = false; boom(e.wp, 2.4); st.enginesLeft--; say(st.enginesLeft ? `Engine down! ${st.enginesLeft} left` : "All engines down!", 2); } break; } } }
      if (dead) { scene.remove(m.node); missiles.splice(i, 1); }
    }
    // ---- collisions with world ----
    if (playing) {
      for (const r of rocks) { r.node.rotation.x += r.spin.x * dt; r.node.rotation.y += r.spin.y * dt; const d = P.pos.distanceTo(r.pos); if (d < r.r + 3) { const n = P.pos.clone().sub(r.pos).normalize(); P.pos.copy(r.pos).addScaledVector(n, r.r + 3); P.speed *= 0.5; damagePlayer(14); fx.burst(P.pos, 0xb09a80, 14, 8, 0.6, 0.8, 0); } }
      if (st.cruiser) for (const h of hullSpheres(st.cruiser)) { const d = P.pos.distanceTo(h); if (d < h.r + 3) { const n = P.pos.clone().sub(h).normalize(); P.pos.copy(h).addScaledVector(n, h.r + 3); P.speed *= 0.6; damagePlayer(20); } }
      for (const e of enemies) if (!e.dead && !e.trench && e.pos.distanceTo(P.pos) < 6) { killEnemy(e, true); damagePlayer(25); }
      if (!trench && !M.waves && false) {}
    }
    // ---- win / lose checks ----
    if (st.phase === "play") {
      const alive = enemies.filter((e) => !e.dead).length, wavesDone = !M.waves || (st.wave >= M.waves.length - 1 && alive === 0);
      if (M.type === "convoy") { if (friends.filter((f) => !f.dead).length < 2) { st.phase = "lost"; st.endT = 0; st.msg = "CONVOY LOST"; } else if (wavesDone) { st.phase = "won"; st.endT = 0; st.msg = "CONVOY SAFE!"; sound.play("win"); } }
      else if (M.type === "cruiser") { if (st.enginesLeft <= 0) { st.phase = "won"; st.endT = 0; st.msg = "WARSHIP DOWN!"; sound.play("win"); boom(st.cruiser.pos, 5); } }
      else if (M.type === "dread") { if (wavesDone && st.enginesLeft <= 0) { st.phase = "won"; st.endT = 0; st.msg = "DREADNOUGHT DESTROYED!"; sound.play("win"); for (let q = 0; q < 8; q++) setTimeout(() => boom(st.cruiser.pos.clone().add(V(rnd(-80, 80), rnd(-30, 30), rnd(-150, 150))), 4), q * 300); } else if (wavesDone && !st.said) { st.said = true; say("Fighters clear. Hit the engines!", 2.5); } }
      else if (M.waves && !trench && wavesDone) { st.phase = "won"; st.endT = 0; st.msg = "SECTOR CLEAR!"; sound.play("win"); }
      st.objective = trench ? (st.port.pos.z - P.pos.z < 700 ? "Fire the torpedo at the port! (right click)" : `Port in ${Math.max(0, Math.round(st.port.pos.z - P.pos.z))} m`) : M.engines ? `Engines left: ${st.enginesLeft}${M.waves ? ` · Raiders: ${alive}` : ""}` : `Raiders left: ${alive + (M.waves ? Math.max(0, M.waves.slice(st.wave + 1).reduce((a, b) => a + b, 0)) : 0)}`;
    } else if (st.phase === "won" || st.phase === "lost") { st.endT += dt; if (st.endT > 3.4 && !st.over) { st.over = true; ctx.onEnd(st.phase === "won", { time: st.time, kills: P.kills, hull: P.hull, shield: P.shield, maxShield: P.maxShield, acc: P.shots ? P.hits / P.shots : 0, lost: st.lostFriends }); } }
    // ---- visuals ----
    for (let i = flashes.length - 1; i >= 0; i--) { const f = flashes[i]; f.t += dt; f.s.scale.setScalar(f.size * (8 + f.t * 40)); f.s.material.opacity = Math.max(0, 1 - f.t * 2.4); if (f.t > 0.45) { scene.remove(f.s); flashes.splice(i, 1); } }
    shipRoot.position.copy(P.pos); shipRoot.quaternion.copy(P.q); ship.rotation.z = P.bank;
    if (P.alive && Math.random() < 0.9) { const wake = tmp.copy(P.fwd).multiplyScalar(-3.3).add(P.pos); fx.spark(wake, 0x6fd0ff, 0.9, 0.35, 0.2); }
    // dust (wraps around the player so speed is visible)
    const dp = dust.pos; for (let i = 0; i < dust.N; i++) { for (let a = 0; a < 3; a++) { const c = a === 0 ? P.pos.x : a === 1 ? P.pos.y : P.pos.z, idx = i * 3 + a; let d = dp[idx] - c; if (d > 120) dp[idx] -= 240; else if (d < -120) dp[idx] += 240; } } dust.p.geometry.attributes.position.needsUpdate = true;
    // camera
    const back = trench ? V(0, 0, 1).multiplyScalar(-15) : P.fwd.clone().multiplyScalar(-14 - P.speed * 0.02), upv = trench ? UP : UP.clone().applyQuaternion(P.q);
    const want = tmp.copy(P.pos).add(back).addScaledVector(upv, trench ? 3.2 : 4.2); if (trench) { want.x = P.pos.x * 0.55; want.y = Math.max(P.pos.y + 3, 6); }
    camPos.lerp(want, 1 - Math.exp(-dt * (st.t < 0.1 ? 60 : trench ? 9 : 7))); camera.position.copy(camPos);
    camera.up.copy(trench ? UP : upv); camera.lookAt(tmp2.copy(P.pos).addScaledVector(trench ? V(0, 0, 1) : P.fwd, 40));
    const fov = 66 + (P.speed - 75) * 0.2; camera.fov = lerp(camera.fov, clamp(fov, 58, 90), 1 - Math.exp(-dt * 4)); camera.updateProjectionMatrix();
    if (P.flash > 0) rig.cine.grade && rig.cine.grade.uVig && (rig.cine.grade.uVig.value = 0.4 + P.flash * 1.2); else if (rig.cine.grade && rig.cine.grade.uVig) rig.cine.grade.uVig.value = 0.4;
  }
  const hs = []; function hullSpheres(C) { hs.length = 0; const S = C.S, g = C.g; for (let i = -4; i <= 4; i++) { const p = V(0, 0, i * 26 * S); g.localToWorld(p); p.r = 26 * S; hs.push(p); } for (let i = -2; i <= 2; i++) { const p = V(0, 14 * S, -20 * S + i * 30 * S); g.localToWorld(p); p.r = 22 * S; hs.push(p); } return hs; }

  const out = {
    state: st, mission: M, update,
    snapshot() {
      const marks = []; const sp = { x: 0, y: 0, on: false };
      for (const e of enemies) { if (e.dead) continue; const s = toScreen(rig, e.pos, sp); const d = e.pos.distanceTo(P.pos); marks.push({ x: s.x, y: s.y, on: s.on, d: Math.round(d), lock: e === P.lock, t: "e" }); }
      for (const f of friends) { if (f.dead) continue; const s = toScreen(rig, f.pos, sp); marks.push({ x: s.x, y: s.y, on: s.on, d: Math.round(f.pos.distanceTo(P.pos)), t: "f", hp: f.hp / f.max }); }
      if (st.cruiser) for (const e of st.cruiser.eng) { if (e.dead || !e.wp) continue; const s = toScreen(rig, e.wp, sp); marks.push({ x: s.x, y: s.y, on: s.on, d: Math.round(e.wp.distanceTo(P.pos)), t: "g", hp: e.hp / e.max }); }
      if (st.port && !st.portDone) { const s = toScreen(rig, st.port.pos, sp); marks.push({ x: s.x, y: s.y, on: s.on, d: Math.round(st.port.pos.z - P.pos.z), t: "p" }); }
      marks.sort((a, b) => a.d - b.d);
      const inv = P.q.clone().invert(), radar = []; for (const e of enemies) { if (e.dead) continue; const r = e.pos.clone().sub(P.pos).applyQuaternion(inv); radar.push({ x: clamp(-r.x / 6, -50, 50), y: clamp(-r.z / 6, -50, 50), up: r.y > 0 }); }
      return { kind: "flight", phase: st.phase, msg: st.msg, toast: st.toastT > 0 ? st.toast : "", title: M.name, sub: M.sub, time: st.time, obj: st.objective, shield: P.shield, maxShield: P.maxShield, hull: P.hull, heat: P.heat, over: P.over, missiles: P.missiles, lockT: P.lock ? P.lockT : 0, boost: P.boost, speed: P.speed, marks: marks.slice(0, 10), radar: trench ? [] : radar.slice(0, 20), hurt: P.flash, tip: st.phase === "intro" ? M.tip : "", trench, kills: P.kills };
    },
    dbg: { P, enemies, friends, spawnEnemy, Z: () => Z.clone().applyQuaternion(P.q) },
    dispose() { for (const s of shots) scene.remove(s.node); if (rig.cine.grade && rig.cine.grade.uVig) rig.cine.grade.uVig.value = 0.4; camera.up.set(0, 1, 0); },
  };
  return out;
}
