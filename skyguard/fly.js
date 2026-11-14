"use client";
// Skyguard — Sky Patrol: free flight over the city. Heat vision, frost breath, sonic boost. Six rescue and defence missions.
import { THREE, clearScene, mesh, glowMesh, sprite, rnd, clamp, lerp, toScreen } from "@/threeplay/core";
import { buildCity, N, P, HALF } from "./city";
import { makeHero, makeDrone, makeCivilian, makeGetaway, makeAirship } from "./figures";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const sx = (i) => (i - (N - 1) / 2) * P + P / 2;

export const MISSIONS = [
  { name: "First Flight", sub: "Rings over the skyline, then catch the falling", mood: "dusk", par: 85, tip: "Move the mouse to steer and hold W to fly. Hold Shift for a sonic boost. Fly through the gold rings." },
  { name: "Fire Night", sub: "Five towers are burning", mood: "night", par: 70, tip: "Aim at a fire and hold the RIGHT mouse button to blow frost on it. Watch the fire percentages." },
  { name: "Drone Swarm", sub: "Raider drones over downtown", mood: "day", par: 95, tip: "Hold the LEFT mouse button to fire heat vision. Boosting into a drone smashes it." },
  { name: "Getaway", sub: "Three armoured cars are racing for the city limits", mood: "dawn", par: 90, tip: "Stop each red car before it leaves town. Heat vision wrecks it, a boost slam finishes it." },
  { name: "Missile Alley", sub: "Protect City Hall from a missile barrage", mood: "dusk", par: 120, tip: "Shoot or ram the missiles before they reach the tower. Watch City Hall's health at the top." },
  { name: "Overload", sub: "A warship hangs over the city", mood: "night", par: 120, tip: "Knock out the four deck turrets. Then the shield breaks: hit the glowing core with everything you have." },
];

export const MOODS = {
  dusk: { sky: { zenith: 0x1a2250, mid: 0x7a4a7a, horizon: 0xff9a5a, sunDir: [0.5, 0.12, -0.8], sunColor: 0xffb070, sunSize: 0.02, glow: 1.2, cloud: 0.5, cloudColor: 0xffc090, cloudShade: 0x5a3a6a, stars: 0.2 }, fog: 0xc07a68, fd: 0.0016, hemi: [0xffb090, 0x3a3050, 1.3], sun: [0xffc090, 2.3, [60, 50, -90]], night: true },
  night: { sky: { zenith: 0x02040e, mid: 0x0a1230, horizon: 0x1c2c58, sunDir: [-0.4, 0.5, -0.6], sunColor: 0xdfe8ff, sunSize: 0.012, glow: 0.6, cloud: 0.3, cloudColor: 0x4a5a80, cloudShade: 0x0a1020, stars: 1.4 }, fog: 0x0e1832, fd: 0.0018, hemi: [0x4a5a9a, 0x14182a, 1.1], sun: [0xaec4ff, 1.1, [-60, 90, -60]], night: true },
  day: { sky: { zenith: 0x2a62c0, mid: 0x6aa6e8, horizon: 0xdce8f0, sunDir: [0.4, 0.6, -0.5], sunColor: 0xfff0c0, sunSize: 0.016, glow: 0.8, cloud: 0.55, cloudColor: 0xffffff, cloudShade: 0x8a98b0, stars: 0 }, fog: 0xc0d4e6, fd: 0.0013, hemi: [0xbfd8ff, 0x606a70, 1.7], sun: [0xfff0d0, 3.0, [70, 120, -50]], night: false },
  dawn: { sky: { zenith: 0x23346a, mid: 0xe08a7a, horizon: 0xffd09a, sunDir: [-0.7, 0.1, -0.7], sunColor: 0xffd890, sunSize: 0.022, glow: 1.3, cloud: 0.5, cloudColor: 0xffd0b0, cloudShade: 0x6a4a6a, stars: 0.1 }, fog: 0xd8a890, fd: 0.0015, hemi: [0xffd0c0, 0x40405a, 1.4], sun: [0xffd0a0, 2.4, [-90, 40, -60]], night: false },
};

export function createFly(rig, ctx) {
  clearScene(rig); const { scene, camera, fx, sound, mouse, keys } = rig, M = MISSIONS[ctx.mission], mood = MOODS[M.mood], power = ctx.power || 1;
  rig.setSky(mood.sky); scene.fog = new THREE.FogExp2(mood.fog, mood.fd);
  scene.add(new THREE.HemisphereLight(mood.hemi[0], mood.hemi[1], mood.hemi[2]));
  const sun = new THREE.DirectionalLight(mood.sun[0], mood.sun[1]); sun.position.set(...mood.sun[2]); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = sc.bottom = -110; sc.right = sc.top = 110; sc.near = 10; sc.far = 400; sun.shadow.bias = -0.0006; scene.add(sun); scene.add(sun.target);
  const city = buildCity(rig, { mood: M.mood === "dusk" || M.mood === "night" ? "night" : "day", seed: 11 + ctx.mission });
  rig.cine.bloom && (rig.cine.bloom.strength = mood.night ? 0.7 : 0.35);

  const hero = makeHero(); scene.add(hero);
  const P0 = { pos: V(sx(3), 60, HALF + 20), vel: V(), yaw: 0, pitch: -0.05, hull: 100 + (power - 1) * 12, heat: 0, over: false, boost: 100, since: 9, speed: 0, ramT: 0, dmg: 1 + (power - 1) * 0.12, kills: 0, hurt: 0, shots: 0, hits: 0, fired: false, lean: 0 };
  P0.maxHull = P0.hull; const Pl = P0;
  const st = { phase: "intro", t: 0, time: 0, msg: "", over: false, endT: 0, toast: "", toastT: 0, obj: "", lastAim: null, done: false };
  const say = (t, d = 1.6) => { st.toast = t; st.toastT = d; };
  const targets = [], shots = [], dir = V(), right = V(), up = V(0, 1, 0), tmp = V(), tmp2 = V(), camP = V(sx(3), 62, HALF + 40);
  const camDir = () => dir.set(-Math.sin(Pl.yaw) * Math.cos(Pl.pitch), Math.sin(Pl.pitch), -Math.cos(Pl.yaw) * Math.cos(Pl.pitch));

  // ---------- effects ----------
  const beam = glowMesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 6), 0xff3a2a, 5); beam.visible = false; scene.add(beam);
  const beamGl = sprite(0xff5a3a, 2.4, 0.9); beamGl.visible = false; scene.add(beamGl);
  const boom = (p, color = 0xff8a3a, big = 1) => { fx.burst(p, color, 28, 16 * big, 0.9, 1.8 * big, 2); fx.burst(p, 0xffe0a0, 12, 8 * big, 0.5, 1.2 * big, 0); fx.ring(p, color, 20, 9 * big, 0.5, 1.0, 0); sound.play("boom"); rig.shake = Math.max(rig.shake, 0.6 * big); };
  function enemyShot(from, to, dmg = 6, speed = 42, color = 0xff4a2a) {
    const d = to.clone().sub(from).normalize(), m = glowMesh(new THREE.SphereGeometry(0.4, 8, 6), color, 4); m.position.copy(from); m.add(sprite(color, 3, 0.8)); scene.add(m);
    shots.push({ node: m, pos: from.clone(), vel: d.multiplyScalar(speed), dmg, life: 6 });
  }
  function hurtHero(d) { if (st.phase !== "play") return; Pl.hull -= d; Pl.hurt = 0.4; Pl.since = 0; rig.shake = Math.max(rig.shake, 0.5); sound.play("hurt"); if (Pl.hull <= 0) { Pl.hull = 0; st.phase = "lost"; st.msg = "MISSION FAILED"; sound.play("lose"); boom(Pl.pos, 0xffaa55, 1); } }
  const wp = (o) => { const v = V(); o.getWorldPosition(v); return v; };

  // ---------- targets ----------
  function add(t) { t.alive = true; t.pos = t.pos || t.node.position; targets.push(t); if (t.node) scene.add(t.node); return t; }
  function kill(t, color) { if (!t.alive) return; t.alive = false; if (t.node) { boom(t.node.position, color || 0xff8a3a, t.big || 1); scene.remove(t.node); } if (t.kind === "car") { st.carN++; say("Car stopped!", 1.2); } if (t.kind === "drone" || t.kind === "missile" || t.kind === "car" || t.kind === "turret" || t.kind === "core") Pl.kills++; }
  const drone = (x, y, z) => { const n = makeDrone(); n.position.set(x, y, z); return add({ kind: "drone", node: n, hp: 22, r: 1.9, fireT: rnd(1.5, 3.5), tele: 0, ang: rnd(0, 6.28), orbit: rnd(45, 75), spd: 17 + rnd(0, 5), e: true }); };
  const missile = (x, y, z) => { const n = new THREE.Group(); const b = mesh(new THREE.CylinderGeometry(0.35, 0.35, 3.4, 8), 0xc8ccd6, { metal: 0.7 }); b.rotation.x = Math.PI / 2; n.add(b); const nose = mesh(new THREE.ConeGeometry(0.35, 1, 8), 0xff3a2a, { metal: 0.3 }); nose.rotation.x = Math.PI / 2; nose.position.z = 2.2; n.add(nose); const f = sprite(0xffa040, 6, 0.9); f.position.z = -2.2; n.add(f); n.position.set(x, y, z); return add({ kind: "missile", node: n, hp: 8, r: 2.0, e: true, vel: V(), wob: rnd(0, 6) }); };
  const target = (name) => ({ name });

  const setup = {
    0() { // rings then fallers
      const path = [[3, 6, 45], [3, 4, 60], [3, 2, 75], [4, 1, 85], [5, 1, 70], [5, 3, 55], [6, 4, 45], [6, 6, 60], [4, 6, 75], [2, 5, 90]];
      st.rings = path.map(([i, j, y], k) => { const n = new THREE.Mesh(new THREE.TorusGeometry(9, 0.55, 8, 32), new THREE.MeshStandardMaterial({ color: 0xffd24a, emissive: 0xffb020, emissiveIntensity: 2.2, roughness: 0.3 })); n.position.set(sx(i), y, sx(j)); scene.add(n); const gl = sprite(0xffd24a, 26, 0.35); n.add(gl); return { node: n, pos: n.position, got: false, i: k }; });
      st.rings.forEach((r, k) => { const nx = st.rings[Math.min(k + 1, st.rings.length - 1)]; r.node.lookAt(k + 1 < st.rings.length ? nx.pos : V(0, 50, -300)); });
      st.ringN = 0; st.fallers = 0; st.saved = 0; st.lost = 0; st.fallT = 0;
    },
    1() { // fires
      const cand = city.towers.filter((t) => t.h > 40 && Math.abs(t.x) < 280 && Math.abs(t.z) < 280).sort(() => Math.random() - 0.5), picked = [];
      for (const t of cand) { if (picked.every((q) => Math.hypot(q.x - t.x, q.z - t.z) > 110)) picked.push(t); if (picked.length === 5) break; }
      picked.forEach((t, k) => {
        const g = new THREE.Group(); for (let i = 0; i < 6; i++) { const s = sprite(i % 2 ? 0xff6a1a : 0xffb030, 12, 0.75); s.position.set(rnd(-2, 2), rnd(-2, 3), rnd(0, 1)); g.add(s); }
        g.position.set(t.x, t.h * rnd(0.5, 0.75), t.z + t.d / 2 + 0.8); add({ kind: "fire", node: g, burn: 22 + k * 3, r: 7, grow: 1.15 });
      }); st.fireN = picked.length;
    },
    2() { st.wave = 0; st.waves = [6, 8, 10]; st.waitT = 1.2; },
    3() { st.carsLeft = 3; st.carN = 0; st.waitT = 0.5; },
    4() { st.hallHp = 100; st.spawned = 0; st.total = 26; st.spawnT = 2; st.hallMarker = true; },
    5() {
      const n = makeAirship(); n.position.set(0, 175, -20); st.ship = add({ kind: "ship", node: n, hp: 1, r: 0, phase: 1, orbitA: 0, droneT: 6 }); st.turrets = [];
      n.userData.turrets.forEach((t) => st.turrets.push(add({ kind: "turret", node: null, pos: V(), hp: 70, r: 3.4, big: 1.2, e: true, src: t, fireT: rnd(1, 3), tele: 0 })));
      st.core = add({ kind: "core", node: null, pos: V(), hp: 260, r: 4.2, big: 3, e: true, active: false, fireT: 3, droneT: 8 }); st.core.shell = n.userData.shell;
    },
  };
  setup[ctx.mission]();
  const carPath = () => { const a = 1 + Math.floor(rnd(0, 6)), c = 2 + Math.floor(rnd(0, 3)), e = clamp(a + (Math.random() < 0.5 ? -3 : 3), 0, N - 2); return [V(sx(a), 0.7, HALF + 30), V(sx(a), 0.7, sx(c)), V(sx(e), 0.7, sx(c)), V(sx(e), 0.7, -HALF - 40)]; };

  // ---------- aiming ----------
  function pick(range, filter, extra = 1.0) {
    let best = null, bt = 1e9; const o = camera.position;
    for (const t of targets) { if (!t.alive || !filter(t) || !t.r) continue; tmp.copy(t.pos).sub(o); const d = tmp.dot(dir); if (d < 5 || d > range + 9) continue; const perp = tmp.addScaledVector(dir, -d).length(); if (perp < t.r + extra && d < bt) { bt = d; best = t; } }
    return best ? { t: best, d: bt } : null;
  }

  // ---------- per-frame ----------
  function updateTargets(dt) {
    const hp = Pl.pos, t0 = st.time;
    for (const t of targets) {
      if (!t.alive) continue;
      if (t.kind === "drone") {
        const n = t.node; tmp.copy(hp).sub(n.position); const d = tmp.length(); t.ang += dt * 0.5;
        if (d > t.orbit + 8) n.position.addScaledVector(tmp.normalize(), t.spd * dt); else if (d < t.orbit - 12) n.position.addScaledVector(tmp.normalize(), -t.spd * 0.5 * dt); n.position.x += Math.cos(t.ang) * 8 * dt; n.position.z += Math.sin(t.ang) * 8 * dt; n.position.y += Math.sin(t.ang * 1.7) * 3 * dt;
        city.collide(n.position, 2.4); n.lookAt(hp); n.userData.rings[0].rotation.y += dt * 4; n.userData.rings[1].rotation.x += dt * 5;
        t.fireT -= dt; if (t.fireT < 0.55 && t.fireT > 0) { t.tele = 1; n.userData.eye.material.emissiveIntensity = 3.5 + Math.sin(t.fireT * 40) * 3; } else t.tele = 0;
        if (t.fireT <= 0) { t.fireT = rnd(2.3, 3.6); if (d < 140) enemyShot(n.position, tmp2.copy(hp).addScaledVector(Pl.vel, d / 42 * 0.6), 6); }
      } else if (t.kind === "missile") {
        const n = t.node; tmp.copy(city.hallTop).sub(n.position); const d = tmp.length(); tmp.normalize(); t.wob += dt * 3; tmp.x += Math.sin(t.wob) * 0.12; tmp.y += Math.cos(t.wob * 1.3) * 0.08; t.vel.lerp(tmp.normalize().multiplyScalar(26), Math.min(1, dt * 2)); n.position.addScaledVector(t.vel, dt); n.lookAt(tmp2.copy(n.position).add(t.vel));
        if (Math.random() < 0.8) fx.spark(tmp2.copy(n.position).addScaledVector(t.vel.clone().normalize(), -2), 0xffb060, 1.4, 0.5, 0.5);
        if (d < 7) { st.hallHp -= 8; kill(t, 0xff6a2a); say("City Hall hit!", 1.2); sound.play("hurt"); }
        else if (n.position.distanceTo(hp) < 2.6) { kill(t); hurtHero(7); }
      } else if (t.kind === "fire") {
        t.burn += t.grow * dt; const k = 0.4 + t.burn / 100 * 1.1; t.node.scale.setScalar(k); if (Math.random() < 0.7) fx.emit(t.pos.x + rnd(-2, 2), t.pos.y + rnd(-1, 3), t.pos.z + rnd(0, 1.5), rnd(-1, 1), rnd(4, 9), rnd(0, 2), Math.random() < 0.5 ? 0xff7a2a : 0xffd060, 2.4 * k, 1.0, -2, 1);
        if (t.burn >= 100 && st.phase === "play") { st.phase = "lost"; st.msg = "THE TOWER FELL"; sound.play("lose"); } if (t.burn <= 0) { t.alive = false; scene.remove(t.node); sound.play("win"); say("Fire out!", 1.2); fx.burst(t.pos, 0x9fe0ff, 30, 10, 1, 2, -1); }
      } else if (t.kind === "car") {
        const path = t.path, a = path[t.seg], b = path[t.seg + 1]; tmp.copy(b).sub(a); const len = tmp.length(); t.s += t.spd * dt; if (t.s >= len) { t.seg++; t.s = 0; if (t.seg >= path.length - 1) { t.alive = false; scene.remove(t.node); if (st.phase === "play") { st.phase = "lost"; st.msg = "THEY GOT AWAY"; sound.play("lose"); } continue; } }
        const a2 = path[t.seg], b2 = path[t.seg + 1]; tmp.copy(b2).sub(a2).normalize(); t.node.position.copy(a2).addScaledVector(tmp, t.s); t.node.rotation.y = Math.atan2(tmp.x, tmp.z) + Math.PI; t.node.userData.beacon.material.emissiveIntensity = 2 + Math.sin(t0 * 14) * 2; if (Math.random() < 0.3) fx.spark(tmp2.copy(t.node.position).addScaledVector(tmp, -3), 0xff5a3a, 1.2, 0.4, 0.5);
        t.left = (len - t.s) + path.slice(t.seg + 1).reduce((acc, p, i, arr) => acc + (i + 1 < arr.length ? arr[i + 1].distanceTo(p) : 0), 0);
      } else if (t.kind === "turret") {
        t.pos.copy(wp(t.src.node)); t.fireT -= dt; const d = t.pos.distanceTo(hp); if (t.fireT < 0.6) t.src.light.material.emissiveIntensity = 3 + Math.sin(t.fireT * 50) * 3; if (t.fireT <= 0) { t.fireT = rnd(1.5, 2.6); if (d < 260) enemyShot(t.pos, tmp2.copy(hp).addScaledVector(Pl.vel, d / 55 * 0.7), 7, 55); }
      } else if (t.kind === "core") {
        t.pos.copy(wp(st.ship.node)).add(V(0, 7.2, 0)); if (t.active) { t.fireT -= dt; if (t.fireT <= 0) { t.fireT = 4; for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.28; enemyShot(t.pos, tmp2.copy(t.pos).add(V(Math.cos(a) * 30, rnd(-12, 12), Math.sin(a) * 30)).clone(), 5, 36); } enemyShot(t.pos, hp, 8, 50); } t.droneT -= dt; if (t.droneT <= 0 && targets.filter((q) => q.alive && q.kind === "drone").length < 3) { t.droneT = 9; const sp = t.pos.clone().add(V(rnd(-20, 20), -8, rnd(-20, 20))); drone(sp.x, sp.y, sp.z); } }
      } else if (t.kind === "person") {
        t.vy = Math.min(t.vy + 4 * dt, 11); t.node.position.y -= t.vy * dt; t.node.rotation.z += dt * 1.8; if (t.node.position.distanceTo(hp) < 6) { t.alive = false; scene.remove(t.node); st.saved++; sound.play("pick"); say("Caught!", 1); fx.burst(t.pos, 0xfff0a0, 24, 8, 0.8, 1.4, -1); }
        else if (t.node.position.y < 2) { t.alive = false; scene.remove(t.node); st.lost++; sound.play("lose"); say("Too late…", 1.4); }
      }
    }
  }
  function updateMission(dt) {
    const mi = ctx.mission, alive = (k) => targets.filter((t) => t.alive && t.kind === k), hp = Pl.pos;
    if (mi === 0) {
      st.rings.forEach((r) => { r.node.rotation.z += dt * 0.6; r.node.visible = !r.got; if (!r.got && r === st.rings[st.ringN]) { r.node.scale.setScalar(1 + Math.sin(st.time * 6) * 0.06); if (r.pos.distanceTo(hp) < 10) { r.got = true; st.ringN++; Pl.boost = Math.min(100, Pl.boost + 40); sound.play("ring"); fx.ring(r.pos, 0xffd24a, 30, 12, 0.6, 1.4, 0); say(`Ring ${st.ringN} / ${st.rings.length}`, 0.9); } } });
      if (st.ringN >= st.rings.length && st.fallers === 0) { st.fallers = -1; st.fallT = 0; say("Civilians falling! Catch them!", 2.4); st.msg = "CATCH THEM!"; setTimeout(() => (st.msg = ""), 1500); }
      if (st.fallers === -1) { st.fallT -= dt; if (st.fallT <= 0 && st.fallers !== 3 && (st.spawnedF || 0) < 3) { const tw = city.towers.filter((t) => t.h > 60).sort((a, b) => Math.hypot(a.x - Pl.pos.x, a.z - Pl.pos.z) - Math.hypot(b.x - Pl.pos.x, b.z - Pl.pos.z))[st.spawnedF || 0]; const n = makeCivilian([0xffd24a, 0x6ad0ff, 0xff8aa0][st.spawnedF || 0]); n.position.set(tw.x, tw.h * 0.8 + 4, tw.z + tw.d / 2 + 5); add({ kind: "person", node: n, vy: 0, r: 0 }); st.spawnedF = (st.spawnedF || 0) + 1; st.fallT = 3.8; } }
      if (st.spawnedF === 3 && alive("person").length === 0 && st.phase === "play") { if (st.saved >= 2) { st.phase = "won"; st.msg = "ALL SAFE!"; sound.play("win"); } else { st.phase = "lost"; st.msg = "TOO MANY FELL"; sound.play("lose"); } }
      st.obj = st.ringN < st.rings.length ? `Fly through the rings ${st.ringN}/${st.rings.length}` : `Catch the falling civilians · saved ${st.saved}`;
    } else if (mi === 1) {
      const f = alive("fire"); st.obj = `Fires left ${f.length}`; if (!f.length && st.phase === "play") { st.phase = "won"; st.msg = "ALL FIRES OUT!"; }
    } else if (mi === 2) {
      const d = alive("drone"); st.obj = `Wave ${Math.min(st.wave, 3)} / 3 · drones ${d.length}`;
      if (!d.length && st.phase === "play") { st.waitT -= dt; if (st.waitT <= 0) { if (st.wave >= 3) { st.phase = "won"; st.msg = "SKY CLEAR!"; sound.play("win"); } else { const n = st.waves[st.wave]; st.wave++; say(`Wave ${st.wave}`, 1.6); for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), r = rnd(90, 150); drone(clamp(hp.x + Math.cos(a) * r, -330, 330), rnd(35, 110), clamp(hp.z + Math.sin(a) * r, -330, 330)); } st.waitT = 1.5; } } }
    } else if (mi === 3) {
      const c = alive("car"); st.obj = `Cars stopped ${st.carN} / 3`;
      if (!c.length && st.phase === "play") { if (st.carN >= 3) { st.phase = "won"; st.msg = "ALL STOPPED!"; sound.play("win"); } else { st.waitT -= dt; if (st.waitT <= 0) { const path = carPath(), n = makeGetaway(); n.position.copy(path[0]); add({ kind: "car", node: n, hp: 70, r: 3.2, e: true, path, seg: 0, s: 0, spd: 23 + st.carN * 2, left: 900, big: 1.6 }); st.waitT = 2; say(`Car ${st.carN + 1} is running!`, 1.8); } } }
    } else if (mi === 4) {
      const ms = alive("missile"); st.obj = `City Hall ${Math.max(0, Math.round(st.hallHp))}% · missiles left ${st.total - st.spawned + ms.length}`;
      st.spawnT -= dt; if (st.spawned < st.total && st.spawnT <= 0) { const n = Math.min(st.total - st.spawned, 1 + Math.floor(rnd(0, 3))); for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), r = 300; missile(Math.cos(a) * r, rnd(30, 120), Math.sin(a) * r - 20); st.spawned++; } st.spawnT = rnd(3.2, 5); }
      if (st.hallHp <= 0 && st.phase === "play") { st.phase = "lost"; st.msg = "CITY HALL FELL"; sound.play("lose"); }
      if (st.spawned >= st.total && !ms.length && st.phase === "play") { st.phase = "won"; st.msg = "CITY HALL SAVED!"; sound.play("win"); }
    } else if (mi === 5) {
      const ship = st.ship.node; st.ship.orbitA += dt * 0.05; ship.position.set(Math.cos(st.ship.orbitA) * 70, 175 + Math.sin(st.ship.orbitA * 3) * 6, Math.sin(st.ship.orbitA) * 70 - 20); ship.rotation.y = -st.ship.orbitA + Math.PI;
      const tl = st.turrets.filter((t) => t.alive).length; st.obj = tl ? `Turrets left ${tl}` : st.core.alive ? `Hit the core · ${Math.max(0, Math.round(st.core.hp / 2.6))}%` : "";
      if (!tl && !st.core.active && st.core.alive) { st.core.active = true; st.core.shell.visible = false; say("Shield down! Hit the core!", 2.4); boom(st.core.pos, 0x9fd0ff, 2); }
      if (!st.core.alive && st.phase === "play") { st.phase = "won"; st.msg = "OVERLOAD DOWN!"; sound.play("win"); }
    }
  }
  function damage(t, d) {
    if (t.kind === "fire") { t.burn -= d; return; } if (t.kind === "core" && !t.active) return;
    t.hp -= d; if (t.hp <= 0) { if (t.kind === "turret") { t.alive = false; boom(t.pos, 0xffaa40, 1.6); t.src.node.visible = false; sound.play("boom"); Pl.kills++; } else if (t.kind === "core") { t.alive = false; st.ship.node.visible = false; for (let i = 0; i < 6; i++) setTimeout(() => boom(t.pos.clone().add(V(rnd(-14, 14), rnd(-4, 4), rnd(-10, 10))), 0xff8a3a, 2.2), i * 220); } else kill(t); }
    else if (t.node && t.node.userData.eye) t.node.userData.eye.material.emissiveIntensity = 5;
  }

  let heroT = 0;
  function updateHero(dt) {
    const play = st.phase === "play", m = mouse; Pl.yaw -= m.dx * 0.0022; Pl.pitch = clamp(Pl.pitch - m.dy * 0.0022, -1.35, 1.35);
    camDir(); right.set(Math.cos(Pl.yaw), 0, -Math.sin(Pl.yaw));
    const k = (c) => keys.has(c); let fw = 0, sd = 0, vt = 0;
    if (play) { fw = (k("KeyW") || k("ArrowUp") ? 1 : 0) - (k("KeyS") || k("ArrowDown") ? 0.5 : 0); sd = (k("KeyD") || k("ArrowRight") ? 1 : 0) - (k("KeyA") || k("ArrowLeft") ? 1 : 0); vt = (k("Space") ? 1 : 0) - (k("KeyC") || k("ControlLeft") ? 1 : 0); }
    const boosting = play && (k("ShiftLeft") || k("ShiftRight")) && Pl.boost > 0 && fw > 0; if (boosting) { Pl.boost = Math.max(0, Pl.boost - 28 * dt); if (!Pl.bs) { sound.play("boost"); } } else Pl.boost = Math.min(100, Pl.boost + (play ? 14 : 0) * dt); Pl.bs = boosting;
    const spd = boosting ? 92 : 36; tmp.set(0, 0, 0).addScaledVector(dir, fw * spd).addScaledVector(right, sd * 24).addScaledVector(up, vt * 20);
    Pl.vel.lerp(tmp, Math.min(1, dt * (boosting ? 1.4 : 2.6))); Pl.pos.addScaledVector(Pl.vel, dt); Pl.speed = Pl.vel.length();
    if (city.collide(Pl.pos, 1.3)) { Pl.vel.multiplyScalar(0.85); }
    const L = city.half + 60; Pl.pos.x = clamp(Pl.pos.x, -L, L); Pl.pos.z = clamp(Pl.pos.z, -L, L); Pl.pos.y = clamp(Pl.pos.y, 2, 340);
    Pl.since += dt; if (play && Pl.since > 5 && Pl.hull < Pl.maxHull) Pl.hull = Math.min(Pl.maxHull, Pl.hull + 2 * dt); Pl.hurt = Math.max(0, Pl.hurt - dt);
    // pose: upright when hovering, head-first when flying fast
    const f = clamp(Pl.speed / 40, 0, 1); Pl.lean = lerp(Pl.lean, f, Math.min(1, dt * 4)); const vd = Pl.speed > 4 ? tmp2.copy(Pl.vel).normalize() : dir;
    const qUp = new THREE.Quaternion().setFromAxisAngle(up, Pl.yaw + Math.PI), chest = up.clone().addScaledVector(vd, -up.dot(vd)).negate(); if (chest.lengthSq() < 0.01) chest.copy(dir).multiplyScalar(-1).setY(-0.2); chest.normalize();
    const xA = new THREE.Vector3().crossVectors(vd, chest).normalize(), qFly = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(xA, vd.clone(), chest)); hero.quaternion.copy(qUp).slerp(qFly, Pl.lean * 0.95); hero.position.copy(Pl.pos).addScaledVector(up, -1.0 * (1 - Pl.lean) - 0.1);
    heroT += dt; const u = hero.userData; u.cape.rotation.x = 0.25 + Pl.lean * 1.15 + Math.sin(heroT * 9) * 0.05 * (1 + Pl.lean * 2); u.arms[0].rotation.x = u.arms[1].rotation.x = lerp(0.1, Math.PI, Pl.lean * 0.9) * 0 + (Pl.lean > 0.3 ? Math.PI * 0.99 : 0.1); u.arms[0].rotation.z = 0.1; u.arms[1].rotation.z = -0.1; u.legs[0].rotation.x = u.legs[1].rotation.x = Math.sin(heroT * 3) * 0.05 * (1 - Pl.lean); u.aura.material.opacity = boosting ? 0.8 : 0; u.aura.scale.setScalar(boosting ? 6 : 3);
    if (boosting && Math.random() < 0.7) fx.spark(tmp.copy(Pl.pos).addScaledVector(dir, -3), 0x9fd8ff, 1.3, 0.4, 0.6);
    // weapons
    const hv = play && m.left && !Pl.over, fr = play && m.right; u.eyes.material.emissiveIntensity = hv ? 6 : 0.3; beam.visible = beamGl.visible = false; Pl.firing = false;
    const camPos = camera.position;
    if (hv) {
      Pl.heat += 0.4 * dt; if (Pl.heat >= 1) { Pl.over = true; sound.play("hurt"); } Pl.shots += dt; Pl.firing = true;
      const hit = pick(170, (t) => t.kind !== "fire" && t.kind !== "person", 1.2), end = hit ? camPos.clone().addScaledVector(dir, hit.d) : camPos.clone().addScaledVector(dir, 90), eye = tmp.copy(Pl.pos).addScaledVector(dir, 0.5).addScaledVector(up, 0.25);
      tmp2.copy(end).sub(eye); const len = tmp2.length(); beam.visible = beamGl.visible = true; beam.position.copy(eye).addScaledVector(tmp2, 0.5); beam.scale.set(1, len, 1); beam.quaternion.setFromUnitVectors(up, tmp2.normalize()); beamGl.position.copy(end);
      if (Math.random() < 0.35) sound.play("zap"); if (hit) { Pl.hits += dt; damage(hit.t, 45 * Pl.dmg * dt); fx.spark(end, 0xffd080, 1.4, 0.3, 3); } else fx.spark(end, 0xff8a5a, 0.8, 0.2, 1);
    } else Pl.heat = Math.max(0, Pl.heat - 0.35 * dt); if (Pl.over && Pl.heat < 0.3) Pl.over = false;
    if (fr) {
      const o = camPos, hit = pick(60, (t) => t.kind === "fire", 4); for (let i = 0; i < 6; i++) { const sp = 55; fx.emit(Pl.pos.x + dir.x * 1.2, Pl.pos.y + dir.y * 1.2, Pl.pos.z + dir.z * 1.2, dir.x * sp + rnd(-5, 5), dir.y * sp + rnd(-5, 5) + 2, dir.z * sp + rnd(-5, 5), Math.random() < 0.5 ? 0xbfefff : 0xffffff, 1.8, 0.7, 0, 1.2); }
      if (Math.random() < 0.15) sound.play("gale"); if (hit) { damage(hit.t, 40 * Pl.dmg * dt); fx.spark(hit.t.pos, 0xbfefff, 3, 0.4, 5); }
    }
    // sonic ram
    if (boosting && Pl.speed > 60) for (const t of targets) { if (!t.alive || !t.e || !(t.kind === "drone" || t.kind === "missile" || t.kind === "car")) continue; if (t.pos.distanceTo(Pl.pos) < t.r + 2.2) { damage(t, t.kind === "car" ? 70 : 60); fx.ring(Pl.pos, 0x9fd8ff, 24, 8, 0.4, 1.2, 0); rig.shake = 0.7; } }
  }
  function updateCamera(dt) {
    camDir(); const want = tmp.copy(Pl.pos).addScaledVector(dir, -8.5 - Pl.lean * 2).addScaledVector(up, 1.7).addScaledVector(right, 1.1); camP.lerp(want, Math.min(1, dt * 14)); if (camP.distanceTo(want) > 3) camP.copy(want);
    camera.position.copy(camP); camera.up.set(0, 1, 0); camera.lookAt(tmp2.copy(camP).addScaledVector(dir, 40)); camera.fov = lerp(camera.fov, 66 + (Pl.bs ? 14 : 0), Math.min(1, dt * 5)); camera.updateProjectionMatrix();
    sun.position.set(Pl.pos.x + mood.sun[2][0], Pl.pos.y + mood.sun[2][1] * 0.5 + 60, Pl.pos.z + mood.sun[2][2]); sun.target.position.copy(Pl.pos);
  }
  function updateShots(dt) {
    for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; s.pos.addScaledVector(s.vel, dt); s.node.position.copy(s.pos); s.life -= dt; let dead = s.life <= 0; if (!dead && s.pos.distanceTo(Pl.pos) < 1.9) { hurtHero(s.dmg); fx.burst(s.pos, 0xff6a3a, 10, 6, 0.4, 1, 0); dead = true; } if (!dead && s.pos.y < 0.5) dead = true; if (dead) { scene.remove(s.node); shots.splice(i, 1); } }
  }

  const api = {
    mission: M, st, debug: { P: Pl, targets, city, hero, say },
    update(dt, t) {
      camera.fov = camera.fov || 66; city.update(dt, t);
      if (st.phase === "intro") { st.t += dt; st.msg = st.t < 1.2 ? M.name.toUpperCase() : "GO!"; if (st.t > 2.1) { st.phase = "play"; st.msg = ""; } }
      else if (st.phase === "play") { st.time += dt; }
      st.toastT = Math.max(0, st.toastT - dt); if (st.phase === "play" || st.phase === "intro") updateMission(dt); updateHero(dt); updateTargets(dt); updateShots(dt); updateCamera(dt);
      if ((st.phase === "won" || st.phase === "lost") && !st.over) { st.endT += dt; if (st.endT > 3) { st.over = true; ctx.onEnd(st.phase === "won", { time: st.time, kills: Pl.kills, hull: Pl.hull / Pl.maxHull * 100, acc: Pl.shots > 0 ? clamp(Pl.hits / Pl.shots, 0, 1) : 0, saved: st.saved || 0 }); } }
    },
    snapshot() {
      const marks = [], sc = { x: 0, y: 0, on: false }, add = (p, tp, extra = {}) => { toScreen(rig, p, sc); marks.push({ x: sc.x, y: sc.y, on: sc.on, t: tp, d: Math.round(p.distanceTo(Pl.pos)), ...extra }); };
      if (ctx.mission === 0 && st.ringN < st.rings.length) add(st.rings[st.ringN].pos, "r");
      if (ctx.mission === 4) add(city.hallTop, "h");
      let n = 0; for (const t of targets) { if (!t.alive || n > 14) continue; if (t.kind === "fire") add(t.pos, "f", { pct: Math.round(t.burn) }); else if (t.kind === "person") add(t.pos, "p"); else if (t.e && t.pos) { add(t.pos, "e", { lock: t.tele || 0 }); n++; } }
      return { kind: "fly", phase: st.phase, hull: Pl.hull, maxHull: Pl.maxHull, heat: Pl.heat, over: Pl.over, boost: Pl.boost, speed: Pl.speed, time: st.time, title: M.name, obj: st.obj, marks, hurt: Pl.hurt, toast: st.toastT > 0 ? st.toast : "", msg: st.msg, tip: st.phase === "intro" || st.time < 9 ? M.tip : "", alt: Math.round(Pl.pos.y), firing: Pl.firing };
    },
    dispose() { for (const s of shots) scene.remove(s.node); camera.up.set(0, 1, 0); },
  };
  return api;
}
