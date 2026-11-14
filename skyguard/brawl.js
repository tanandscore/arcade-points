"use client";
// Skyguard — Street Justice: third-person street fights. Punch combos, heat vision, dash, ground slam, throw cars. Six fights ending with Overload.
import { THREE, clearScene, glowMesh, sprite, mesh, rnd, clamp, lerp, angDiff, toScreen } from "@/threeplay/core";
import { buildPlaza } from "./city";
import { makeHero, makeFoe } from "./figures";
import { MOODS } from "./fly";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export const FIGHTS = [
  { name: "Alley Welcome", sub: "Four street thugs", mood: "dusk", par: 55, waves: [[["thug", 4]]], props: [["crate", -8, 6], ["crate", 9, -5]], tip: "Click the LEFT mouse button to punch. Click again to chain a three-hit combo." },
  { name: "Bank Job", sub: "Thugs and gunmen", mood: "night", par: 80, waves: [[["thug", 3]], [["thug", 2], ["shooter", 2]]], props: [["car", -10, 4, 1.2], ["crate", 8, 7]], tip: "Gunmen flash before they shoot. Dash with SPACE to dodge their bolts." },
  { name: "Rooftop Rumble", sub: "Gunmen everywhere", mood: "day", par: 90, waves: [[["shooter", 3], ["thug", 2]], [["shooter", 3], ["thug", 3]]], props: [["crate", -7, -8], ["crate", 10, 3], ["car", 5, 11, 0.4]], tip: "Hold the RIGHT mouse button for heat vision. It locks on to your target and burns it from range." },
  { name: "Steel Gang", sub: "Shield robots and heavy hitters", mood: "dawn", par: 110, waves: [[["shield", 2]], [["shield", 2], ["thug", 3]], [["brute", 1], ["shooter", 2]]], props: [["car", -11, -3, 0.2], ["car", 9, 8, 2.3]], tip: "Shields block punches from the front. Press Q for a ground slam, or hit them from behind." },
  { name: "Car Smash", sub: "Heavy hitters and a car park", mood: "dusk", par: 120, waves: [[["brute", 2]], [["brute", 1], ["shield", 2], ["thug", 3]]], props: [["car", -10, 5, 1], ["car", 10, 5, -1], ["car", 0, -11, 0.1], ["car", -4, 12, 2.2]], tip: "Stand next to a car and press E to hurl it at your target. A thrown car hits hard in a wide circle." },
  { name: "Overload", sub: "The Static Syndicate's giant", mood: "night", par: 150, waves: [[["boss", 1]]], props: [["car", -11, 4, 1], ["car", 11, -4, -1.2], ["crate", 0, 10], ["crate", 8, -9]], tip: "Dodge the stomp rings and the sweeping beam. Slams and thrown cars hurt him most." },
];

const FOE = {
  thug: { name: "Street Thug", hp: 34, speed: 4.6, r: 0.55, wind: 0.55, dmg: 9, rng: 2.3, cdr: [0.9, 1.6] },
  shooter: { name: "Gunman", hp: 26, speed: 3.8, r: 0.55, wind: 0.55, dmg: 7, rng: 15, cdr: [1.6, 2.6] },
  brute: { name: "Brute", hp: 130, speed: 3.2, r: 0.9, wind: 0.85, dmg: 22, rng: 3.0, cdr: [1.4, 2.2] },
  shield: { name: "Shield Robot", hp: 70, speed: 3.7, r: 0.8, wind: 0.7, dmg: 11, rng: 2.6, cdr: [1.2, 2.0] },
  boss: { name: "Overload", hp: 760, speed: 3.0, r: 1.7, wind: 1, dmg: 24, rng: 4.8, cdr: [1.6, 2.4] },
};

export function createBrawl(rig, ctx) {
  clearScene(rig); const { scene, camera, fx, sound, mouse, keys, pressed } = rig, L = FIGHTS[ctx.duel], power = ctx.power || 1, mood = MOODS[L.mood];
  rig.setSky(mood.sky); scene.fog = new THREE.FogExp2(mood.fog, mood.fd * 2.2); scene.add(new THREE.HemisphereLight(mood.hemi[0], mood.hemi[1], mood.hemi[2] * 0.9));
  const sun = new THREE.DirectionalLight(mood.sun[0], mood.sun[1] * 0.9); sun.position.set(...mood.sun[2]); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); const sc = sun.shadow.camera; sc.left = sc.bottom = -24; sc.right = sc.top = 24; sc.near = 10; sc.far = 320; sun.shadow.bias = -0.0005; scene.add(sun); scene.add(sun.target);
  rig.cine.bloom && (rig.cine.bloom.strength = mood.night ? 0.6 : 0.3);
  const arena = buildPlaza(rig, { R: 17, props: L.props, night: mood.night, ring: L.name === "Overload" ? 0xff4a3a : 0xffd24a });
  const hero = makeHero(); scene.add(hero);
  const Pl = { pos: V(0, 0, 8), vel: V(), face: Math.PI, hp: 100 + (power - 1) * 16, energy: 100, swing: 0, swingMax: 0.34, combo: 0, comboT: 0, queued: false, hitDone: false, dash: 0, dashCd: 0, dashDir: V(), invul: 0, slam: 0, slamCd: 0, stun: 0, hurt: 0, walk: 0, dmg: 1 + (power - 1) * 0.14, kills: 0, taken: 0, throws: 0, heat: false, t: 0 };
  Pl.maxHp = Pl.hp;
  const cam = { yaw: 0, pitch: 0.34, dist: 7.4 }, foes = [], shots = [], fxs = [], tmp = V(), tmp2 = V(), up = V(0, 1, 0);
  const st = { phase: "intro", t: 0, time: 0, msg: "", over: false, endT: 0, toast: "", toastT: 0, wave: 0, waitT: 0, nearProp: null };
  let lock = null; const say = (t, d = 1.4) => { st.toast = t; st.toastT = d; };
  const beam = glowMesh(new THREE.CylinderGeometry(0.07, 0.07, 1, 6), 0xff3a2a, 5); beam.visible = false; scene.add(beam); const beamGl = sprite(0xff5a3a, 1.8, 0.9); beamGl.visible = false; scene.add(beamGl);
  const ringM = new THREE.MeshBasicMaterial({ color: 0xff5a3a, transparent: true, opacity: 0.0, depthWrite: false, side: THREE.DoubleSide }); const stompDisc = new THREE.Mesh(new THREE.CircleGeometry(1, 40), ringM); stompDisc.rotation.x = -Math.PI / 2; stompDisc.position.y = 0.06; stompDisc.visible = false; scene.add(stompDisc);
  const sweep = glowMesh(new THREE.BoxGeometry(1.4, 0.5, 20), 0xff3a2a, 3); sweep.visible = false; scene.add(sweep);
  const shock = (p, color = 0xffd24a, r = 7) => { fx.ring(V(p.x, 0.3, p.z), color, 36, r, 0.5, 1.2, 0); fx.burst(V(p.x, 0.5, p.z), color, 16, 6, 0.5, 1, 2); };

  function spawnWave() {
    const w = L.waves[st.wave]; st.wave++; let idx = 0; const total = w.reduce((a, [, n]) => a + n, 0);
    for (const [kind, n] of w) for (let i = 0; i < n; i++) { const a = (idx / total) * Math.PI * 2 + rnd(-0.2, 0.2) + st.wave, d = kind === "boss" ? 9 : 12 + rnd(0, 2); addFoe(kind, Math.cos(a) * d, Math.sin(a) * d - 2); idx++; }
    if (L.waves.length > 1) say(`Wave ${st.wave} / ${L.waves.length}`, 1.6);
  }
  function addFoe(kind, x, z) {
    const D = FOE[kind], m = makeFoe(kind); scene.add(m);
    const e = { kind, ...D, m, pos: V(x, 0, z), vel: V(), face: 0, max: D.hp * (1 + (ctx.hpScale || 0)), hp: D.hp * (1 + (ctx.hpScale || 0)), state: "approach", st: rnd(0.4, 1.2), cd: rnd(0.6, 1.8), stun: 0, dead: false, deadT: 0, walk: rnd(0, 6), flash: 0, strafe: Math.random() < 0.5 ? 1 : -1, strafeT: rnd(1, 3), ph: 66, atk: null, tele: 0, hitDone: false, sweepA: 0 };
    foes.push(e); if (!lock) lock = e; return e;
  }
  spawnWave();

  function bolt(from, dir, dmg, speed = 26, color = 0xff5a2a) { const m = glowMesh(new THREE.SphereGeometry(0.22, 8, 6), color, 4); m.add(sprite(color, 1.6, 0.8)); m.position.copy(from); scene.add(m); shots.push({ node: m, pos: from.clone(), vel: dir.clone().normalize().multiplyScalar(speed), dmg, life: 3 }); }
  function hurtPlayer(d, from, push = 5) {
    if (Pl.invul > 0 || st.phase !== "play") return false; Pl.hp -= d; Pl.taken += d; Pl.hurt = 0.4; Pl.invul = 0.45; Pl.stun = Math.max(Pl.stun, 0.18); if (from) Pl.vel.addScaledVector(tmp.copy(Pl.pos).sub(from).setY(0).normalize(), push); rig.shake = Math.max(rig.shake, 0.5); sound.play("hurt");
    if (Pl.hp <= 0) { Pl.hp = 0; st.phase = "lost"; st.msg = "DEFEATED"; sound.play("lose"); } return true;
  }
  function hurtFoe(e, d, o = {}) {
    if (e.dead) return false; const fwd = tmp.set(Math.sin(e.face), 0, Math.cos(e.face)), toP = tmp2.copy(Pl.pos).sub(e.pos).setY(0).normalize();
    if (e.kind === "shield" && !o.pierce && fwd.dot(toP) > 0.35) { sound.play("clang"); fx.burst(V(e.pos.x, 1.3, e.pos.z).addScaledVector(toP, 0.8), 0xaaf0ff, 10, 5, 0.3, 0.7, 0); Pl.stun = 0.22; Pl.vel.addScaledVector(toP, 5); e.flash = 0.1; return false; }
    if (e.kind === "boss" && !o.big) d *= 0.6; if (e.kind === "shield" && o.pierce === "half") d *= 0.5;
    e.hp -= d; e.flash = 0.14; sound.play(o.heat ? "zap" : "punch"); fx.burst(V(e.pos.x, 1.3, e.pos.z), 0xffd8a0, 10, 5, 0.35, 0.6, 3);
    const heavy = e.kind === "brute" || e.kind === "boss" || (e.kind === "shield"); if (o.stun) e.stun = Math.max(e.stun, o.stun); else if (!o.heat && !heavy) { e.stun = 0.3; if (e.state === "wind") { e.state = "recover"; e.st = 0.6; e.tele = 0; } }
    if (o.push) e.vel.addScaledVector(tmp.copy(e.pos).sub(Pl.pos).setY(0).normalize(), o.push * (heavy ? 0.4 : 1));
    if (e.hp <= 0) { e.dead = true; e.deadT = 0; Pl.kills++; Pl.energy = Math.min(100, Pl.energy + 8); sound.play("boom"); fx.burst(V(e.pos.x, 1, e.pos.z), 0xffb060, 22, 8, 0.7, 1.2, 4); rig.shake = Math.max(rig.shake, e.kind === "boss" ? 1.4 : 0.3); if (e === lock) lock = null; if (e.kind === "boss") { for (let i = 0; i < 5; i++) setTimeout(() => fx.burst(V(e.pos.x + rnd(-2, 2), rnd(0.5, 4), e.pos.z + rnd(-2, 2)), 0xff8a3a, 30, 12, 0.9, 2, 2), i * 180); } }
    return true;
  }
  function nearestFoe(maxD = 40, cone = null) {
    let best = null, bd = 1e9; for (const e of foes) { if (e.dead) continue; const d = e.pos.distanceTo(Pl.pos); if (d > maxD) continue; let sc = d; if (cone) { tmp.set(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)); tmp2.copy(e.pos).sub(Pl.pos).setY(0).normalize(); if (tmp.dot(tmp2) < cone) continue; sc = d - tmp.dot(tmp2) * 6; } if (sc < bd) { bd = sc; best = e; } } return best;
  }

  function updatePlayer(dt) {
    const play = st.phase === "play", k = (c) => keys.has(c), m = mouse;
    cam.yaw -= m.dx * 0.0024; cam.pitch = clamp(cam.pitch + m.dy * 0.0021, 0.04, 0.95);
    Pl.t += dt; Pl.invul = Math.max(0, Pl.invul - dt); Pl.hurt = Math.max(0, Pl.hurt - dt); Pl.stun = Math.max(0, Pl.stun - dt); Pl.dashCd = Math.max(0, Pl.dashCd - dt); Pl.slamCd = Math.max(0, Pl.slamCd - dt); Pl.comboT = Math.max(0, Pl.comboT - dt); if (Pl.comboT <= 0 && Pl.swing <= 0) Pl.combo = 0;
    const f = V(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)), r = V(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)); let ix = 0, iz = 0;
    if (play && Pl.stun <= 0 && Pl.slam <= 0) { iz = (k("KeyW") || k("ArrowUp") ? 1 : 0) - (k("KeyS") || k("ArrowDown") ? 1 : 0); ix = (k("KeyD") || k("ArrowRight") ? 1 : 0) - (k("KeyA") || k("ArrowLeft") ? 1 : 0); }
    const mv = tmp2.set(0, 0, 0).addScaledVector(f, iz).addScaledVector(r, ix); const moving = mv.lengthSq() > 0.01; if (moving) mv.normalize();
    Pl.energy = Math.min(100, Pl.energy + 8 * dt);
    if (!lock || lock.dead) lock = nearestFoe(60, 0.2) || nearestFoe(60); if (pressed.has("Tab") && play) { const alive = foes.filter((e) => !e.dead); if (alive.length) lock = alive[(alive.indexOf(lock) + 1) % alive.length]; }
    // dash
    if (play && pressed.has("Space") && Pl.dashCd <= 0 && Pl.dash <= 0 && Pl.slam <= 0) { Pl.dash = 0.22; Pl.dashCd = 0.55; Pl.invul = Math.max(Pl.invul, 0.26); Pl.dashDir.copy(moving ? mv : tmp.set(Math.sin(Pl.face), 0, Math.cos(Pl.face)).negate()); sound.play("whoosh"); fx.ring(V(Pl.pos.x, 0.5, Pl.pos.z), 0x9fd8ff, 14, 3, 0.3, 0.8, 0); }
    // slam
    if (play && pressed.has("KeyQ") && Pl.slamCd <= 0 && Pl.energy >= 35 && Pl.slam <= 0) { Pl.energy -= 35; Pl.slam = 0.55; Pl.slamCd = 3; Pl.vel.set(0, 0, 0); sound.play("whoosh"); }
    // throw
    st.nearProp = null; let bp = null, bd = 6.5; for (const p of arena.props) { if (p.dead || p.flying) continue; const d = p.pos.distanceTo(Pl.pos); if (d < bd) { bd = d; bp = p; } } st.nearProp = bp;
    if (play && pressed.has("KeyE") && bp && lock) { const tgt = lock.pos; tmp.copy(tgt).sub(bp.pos).setY(0); const d = Math.max(4, tmp.length()); tmp.normalize(); bp.flying = true; bp.vel.set(tmp.x * 26, 8, tmp.z * 26); bp.pos.y = 1.4; Pl.throws++; Pl.swing = 0.3; Pl.swingMax = 0.3; Pl.hitDone = true; Pl.punchKind = "throw"; sound.play("whoosh"); say("Heave!", 0.8); Pl.face = Math.atan2(tmp.x, tmp.z); }
    // punch
    if (play && m.clickL && Pl.stun <= 0 && Pl.slam <= 0 && Pl.dash <= 0) { if (Pl.swing <= 0) startPunch(); else Pl.queued = true; }
    if (Pl.swing > 0) { Pl.swing -= dt; const prog = 1 - Pl.swing / Pl.swingMax; if (!Pl.hitDone && prog > 0.4 && Pl.punchKind !== "throw") { Pl.hitDone = true; doPunch(); } if (Pl.swing <= 0 && Pl.queued) { Pl.queued = false; startPunch(); } }
    // heat vision
    Pl.heat = false; beam.visible = beamGl.visible = false;
    if (play && m.right && Pl.energy > 0.5 && Pl.swing <= 0 && Pl.slam <= 0 && Pl.stun <= 0) {
      Pl.heat = true; Pl.energy = Math.max(0, Pl.energy - 26 * dt); const tg = lock && !lock.dead ? lock : null, eye = V(Pl.pos.x, 1.75, Pl.pos.z).addScaledVector(tmp.set(Math.sin(Pl.face), 0, Math.cos(Pl.face)), 0.3);
      const end = tg ? V(tg.pos.x, 1.3 * (tg.kind === "boss" ? 2 : 1), tg.pos.z) : eye.clone().addScaledVector(f, 24); if (tg) Pl.face = Math.atan2(tg.pos.x - Pl.pos.x, tg.pos.z - Pl.pos.z); else Pl.face = Math.atan2(f.x, f.z);
      tmp2.copy(end).sub(eye); const len = tmp2.length(); beam.visible = beamGl.visible = true; beam.position.copy(eye).addScaledVector(tmp2, 0.5); beam.scale.set(1, len, 1); beam.quaternion.setFromUnitVectors(up, tmp2.normalize()); beamGl.position.copy(end);
      if (tg) { if (Math.random() < 0.08) sound.play("zap"); const d = 52 * Pl.dmg * dt; tg.hp -= 0; if (tg.kind === "shield") hurtFoeSilent(tg, d * 0.5); else hurtFoeSilent(tg, d); fx.spark(end, 0xffd080, 1.2, 0.25, 2); }
    }
    // movement
    if (Pl.dash > 0) { Pl.dash -= dt; Pl.vel.copy(Pl.dashDir).multiplyScalar(22); }
    else if (Pl.slam > 0) { Pl.slam -= dt; if (Pl.slam > 0.25) hero.position.y = Math.sin((1 - (Pl.slam - 0.25) / 0.3) * Math.PI) * 2.2; else hero.position.y = 0; if (Pl.slam <= 0) doSlam(); }
    else { const sp = Pl.swing > 0 ? 2.2 : Pl.heat ? 3.6 : 7.6; Pl.vel.x = lerp(Pl.vel.x, mv.x * sp, Math.min(1, dt * 10)); Pl.vel.z = lerp(Pl.vel.z, mv.z * sp, Math.min(1, dt * 10)); }
    Pl.vel.multiplyScalar(Math.max(0, 1 - dt * (Pl.dash > 0 ? 0 : 1.5)));
    Pl.pos.x += Pl.vel.x * dt; Pl.pos.z += Pl.vel.z * dt; arena.collide(Pl.pos, 0.5);
    for (const e of foes) { if (e.dead) continue; tmp.copy(Pl.pos).sub(e.pos).setY(0); const d = tmp.length(), min = e.r + 0.5; if (d < min && d > 0.001) { tmp.multiplyScalar((min - d) / d); Pl.pos.add(tmp.multiplyScalar(0.6)); } }
    if (moving && Pl.swing <= 0 && !Pl.heat) Pl.face = lerpAng(Pl.face, Math.atan2(mv.x, mv.z), Math.min(1, dt * 14)); else if (Pl.swing > 0 && lock && !lock.dead) Pl.face = lerpAng(Pl.face, Math.atan2(lock.pos.x - Pl.pos.x, lock.pos.z - Pl.pos.z), Math.min(1, dt * 18));
    // pose
    hero.position.x = Pl.pos.x; hero.position.z = Pl.pos.z; if (Pl.slam <= 0) hero.position.y = 0; hero.rotation.set(0, Pl.face, 0); const u = hero.userData, sp = Math.hypot(Pl.vel.x, Pl.vel.z); Pl.walk += sp * dt * 1.4; const sw = Math.sin(Pl.walk * 2) * clamp(sp / 7, 0, 1);
    u.legs[0].rotation.x = sw * 0.8; u.legs[1].rotation.x = -sw * 0.8; u.arms[0].rotation.x = -sw * 0.7 * (Pl.swing > 0 ? 0 : 1); u.arms[1].rotation.x = sw * 0.7 * (Pl.swing > 0 ? 0 : 1); u.arms[0].rotation.z = 0.12; u.arms[1].rotation.z = -0.12;
    if (Pl.swing > 0 && Pl.punchKind !== "throw") { const pr = 1 - Pl.swing / Pl.swingMax, a = Math.sin(clamp(pr * 1.4, 0, 1) * Math.PI) * -1.7, ar = Pl.punchKind === "R" ? 0 : 1; u.arms[ar].rotation.x = a; u.body.rotation.y = (Pl.punchKind === "R" ? 0.4 : -0.4) * Math.sin(pr * Math.PI); } else u.body.rotation.y = lerp(u.body.rotation.y, 0, 0.3);
    if (Pl.slam > 0) { u.arms[0].rotation.x = u.arms[1].rotation.x = Pl.slam > 0.25 ? -3.0 : -0.4; u.body.rotation.x = Pl.slam > 0.25 ? -0.2 : 0.5; } else u.body.rotation.x = lerp(u.body.rotation.x, 0, 0.3);
    if (Pl.punchKind === "throw" && Pl.swing > 0) { u.arms[0].rotation.x = u.arms[1].rotation.x = -2.6; }
    u.cape.rotation.x = 0.2 + clamp(sp / 8, 0, 1) * 0.5 + Math.sin(Pl.t * 6) * 0.04; u.eyes.material.emissiveIntensity = Pl.heat ? 6 : 0.2; u.aura.material.opacity = Pl.slam > 0 ? 0.7 : 0; u.aura.scale.setScalar(Pl.slam > 0 ? 6 : 3);
    hero.visible = !(Pl.invul > 0 && Pl.hurt > 0.2 && Math.floor(Pl.t * 30) % 2 === 0);
  }
  const lerpAng = (a, b, t) => a + angDiff(a, b) * t;
  function hurtFoeSilent(e, d) { if (e.dead) return; e.hp -= d; e.flash = 0.08; if (e.hp <= 0) { e.hp = 1; hurtFoe(e, 10, { heat: true, pierce: true }); } }
  function startPunch() {
    Pl.combo = Pl.comboT > 0 ? (Pl.combo % 3) + 1 : 1; Pl.comboT = 0.75; Pl.swingMax = Pl.combo === 3 ? 0.46 : 0.32; Pl.swing = Pl.swingMax; Pl.hitDone = false; Pl.queued = false; Pl.punchKind = Pl.combo % 2 ? "R" : "L";
    const tg = lock && !lock.dead && lock.pos.distanceTo(Pl.pos) < 6 ? lock : nearestFoe(5); if (tg) { tmp.copy(tg.pos).sub(Pl.pos).setY(0); const d = tmp.length(); if (d > 1.8) Pl.vel.addScaledVector(tmp.normalize(), 11); Pl.face = Math.atan2(tg.pos.x - Pl.pos.x, tg.pos.z - Pl.pos.z); lock = tg; } sound.play("whoosh");
  }
  function doPunch() {
    const fx0 = V(Math.sin(Pl.face), 0, Math.cos(Pl.face)); let hit = false;
    for (const e of foes) { if (e.dead) continue; tmp.copy(e.pos).sub(Pl.pos).setY(0); const d = tmp.length(); if (d > 2.7 + e.r || (d > 0.7 && tmp.normalize().dot(fx0) < 0.35)) continue; const fin = Pl.combo === 3; if (hurtFoe(e, (fin ? 26 : 14) * Pl.dmg, { push: fin ? 14 : 4, stun: fin ? 0.9 : 0 })) hit = true; }
    if (hit) { rig.shake = Math.max(rig.shake, Pl.combo === 3 ? 0.5 : 0.2); fx.burst(V(Pl.pos.x + fx0.x * 1.7, 1.4, Pl.pos.z + fx0.z * 1.7), 0xfff0c0, 8, 4, 0.3, 0.8, 0); }
  }
  function doSlam() {
    shock(Pl.pos, 0xffd24a, 11); sound.play("boom"); rig.shake = 1.0; for (const p of arena.props) { if (!p.flying && !p.dead && p.pos.distanceTo(Pl.pos) < 4) p.pos.y = 0; }
    for (const e of foes) { if (e.dead) continue; const d = e.pos.distanceTo(Pl.pos); if (d < 6.5 + e.r) hurtFoe(e, 36 * Pl.dmg, { stun: e.kind === "boss" ? 1.1 : 1.8, push: 10, big: true, pierce: true }); }
  }

  function updateFoes(dt) {
    const attackers = foes.filter((e) => !e.dead && (e.state === "wind" || e.state === "aim")).length;
    for (const e of foes) {
      const m = e.m, u = m.userData;
      if (e.dead) { e.deadT += dt; m.rotation.x = lerp(m.rotation.x, -Math.PI / 2, Math.min(1, dt * 7)); m.position.y = lerp(m.position.y, 0.2, Math.min(1, dt * 7)); if (e.deadT > 1.2) m.scale.setScalar(Math.max(0.001, 1 - (e.deadT - 1.2) * 2)); if (e.deadT > 1.7) { scene.remove(m); e.gone = true; } continue; }
      e.flash = Math.max(0, e.flash - dt); u.flash.material.opacity = e.tele ? (e.kind === "boss" ? 0.07 : 0.25) + Math.sin(st.time * 40) * (e.kind === "boss" ? 0.03 : 0.2) : e.flash > 0 ? (e.kind === "boss" ? 0.12 : 0.4) : 0;
      tmp.copy(Pl.pos).sub(e.pos).setY(0); const d = tmp.length(), toP = tmp.clone().normalize(), wantFace = Math.atan2(toP.x, toP.z);
      e.vel.multiplyScalar(Math.max(0, 1 - dt * 6)); e.stun = Math.max(0, e.stun - dt);
      if (e.stun > 0) { e.state = "stun"; u.body.rotation.z = Math.sin(st.time * 30) * 0.15; } else { u.body.rotation.z = 0; if (e.state === "stun") { e.state = "approach"; e.cd = 0.5; } }
      if (e.state !== "wind" && e.state !== "aim" && e.state !== "stun" && e.state !== "boss") e.face = lerpAng(e.face, wantFace, Math.min(1, dt * 7));
      e.cd -= dt; let mv = 0, sd = 0;
      if (st.phase !== "play") { e.vel.multiplyScalar(0.9); }
      else if (e.state === "approach") {
        const hold = e.kind === "shooter" ? 10.5 : e.rng * 0.8, token = attackers < (e.kind === "boss" ? 3 : 2);
        if (e.kind === "shooter") { if (d > hold + 3) mv = 1; else if (d < hold - 3) mv = -0.9; else sd = e.strafe * 0.7; } else { if (d > hold + (token ? 0 : 3.5)) mv = 1; else if (!token) sd = e.strafe * 0.8; }
        e.strafeT -= dt; if (e.strafeT <= 0) { e.strafe *= -1; e.strafeT = rnd(1.2, 3); }
        if (e.cd <= 0 && token && (e.kind === "shooter" ? d < 17 : e.kind === "boss" ? d < 12 : d < e.rng + 0.9)) { if (e.kind === "boss") startBossAttack(e, d); else { e.state = e.kind === "shooter" ? "aim" : "wind"; e.st = e.wind; e.tele = 1; e.hitDone = false; if (e.kind !== "shooter") sound.play("alarm"); } }
      } else if (e.state === "wind" || e.state === "aim") {
        e.st -= dt; e.face = lerpAng(e.face, wantFace, Math.min(1, dt * (e.kind === "shooter" ? 9 : 3)));
        if (e.st <= 0) {
          if (e.kind === "shooter") { const tip = V(e.pos.x, 1.3, e.pos.z).addScaledVector(tmp2.set(Math.sin(e.face), 0, Math.cos(e.face)), 0.9); bolt(tip, V(Pl.pos.x, 1.2, Pl.pos.z).sub(tip), e.dmg, 25); sound.play("laser"); e.tele = 0; e.state = "recover"; e.st = 0.5; e.cd = rnd(...e.cdr); }
          else { e.state = "strike"; e.st = 0.18; e.tele = 0; e.hitDone = false; }
        }
      } else if (e.state === "strike") {
        e.st -= dt; if (!e.hitDone && e.st < 0.1) { e.hitDone = true; const fw = V(Math.sin(e.face), 0, Math.cos(e.face)); if (e.pos.distanceTo(Pl.pos) < e.rng + 0.5 && (e.kind === "brute" ? true : tmp.copy(Pl.pos).sub(e.pos).setY(0).normalize().dot(fw) > 0.2)) { if (hurtPlayer(e.dmg, e.pos, e.kind === "brute" ? 9 : 5)) { fx.burst(V(Pl.pos.x, 1.3, Pl.pos.z), 0xff6a3a, 10, 5, 0.3, 0.8, 0); } } if (e.kind === "brute") { shock(e.pos.clone().addScaledVector(fw, 1.4), 0xff9a3a, 4); } }
        if (e.st <= 0) { e.state = "recover"; e.st = rnd(0.5, 0.9); e.cd = rnd(...e.cdr); }
      } else if (e.state === "recover") { e.st -= dt; if (e.st <= 0) e.state = "approach"; }
      else if (e.state === "boss") bossAct(e, dt, d, toP, wantFace);
      // move
      if (e.state === "approach") { tmp.set(Math.sin(e.face), 0, Math.cos(e.face)); const rr = V(tmp.z, 0, -tmp.x); e.pos.addScaledVector(tmp, mv * e.speed * dt).addScaledVector(rr, sd * e.speed * dt); }
      e.pos.addScaledVector(e.vel, dt); arena.collide(e.pos, e.r);
      for (const o of foes) { if (o === e || o.dead) continue; tmp.copy(e.pos).sub(o.pos).setY(0); const dd = tmp.length(), mn = e.r + o.r; if (dd < mn && dd > 0.001) e.pos.addScaledVector(tmp.multiplyScalar(((mn - dd) / dd) * 0.5), 1); }
      // pose
      m.position.set(e.pos.x, 0, e.pos.z); m.rotation.y = e.face; e.walk += (mv || sd ? e.speed : 0) * dt * 1.5; const w = Math.sin(e.walk * 2) * (mv || sd ? 0.7 : 0);
      u.legs[0].rotation.x = w; u.legs[1].rotation.x = -w; const raised = e.state === "wind" ? -(-2.9) : 0;
      if (e.kind === "shooter") { u.arms[0].rotation.x = -1.4; u.arms[1].rotation.x = e.state === "aim" ? -1.2 : 0.2; } else if (e.state === "wind") { u.arms[0].rotation.x = u.arms[1].rotation.x = -3.0 * (1 - e.st / e.wind) ; if (e.kind === "shield") u.arms[0].rotation.x = u.arms[1].rotation.x = -1.2; } else if (e.state === "strike") { u.arms[0].rotation.x = u.arms[1].rotation.x = -1.5; } else { u.arms[0].rotation.x = w; u.arms[1].rotation.x = -w; }
      if (u.shield) { u.shield.rotation.y = 0; u.shield.position.z = 0.62 + (e.state === "strike" ? 0.35 : 0); }
    }
    for (let i = foes.length - 1; i >= 0; i--) if (foes[i].gone) foes.splice(i, 1);
  }
  // ----- boss -----
  function startBossAttack(e, d) {
    const r = Math.random(); e.atk = d < 6 && r < 0.55 ? "stomp" : r < 0.8 ? "sweep" : "slam"; if (e.atk === "slam" && d > 6.5) e.atk = "stomp";
    e.state = "boss"; e.st = e.atk === "sweep" ? 1.0 : e.atk === "stomp" ? 1.0 : 0.8; e.phase2 = 0; e.tele = 1; e.hitDone = false; sound.play("alarm"); e.sweepA = 0;
    if (e.atk === "stomp") { stompDisc.visible = true; stompDisc.position.x = e.pos.x; stompDisc.position.z = e.pos.z; }
  }
  function bossAct(e, dt, d, toP, wantFace) {
    e.st -= dt; const u = e.m.userData;
    if (e.atk === "stomp") { e.face = lerpAng(e.face, wantFace, dt * 2); stompDisc.scale.setScalar(6.4); ringM.opacity = 0.2 + (1 - e.st) * 0.25; u.arms[0].rotation.x = u.arms[1].rotation.x = -3.0 * clamp(1 - e.st, 0, 1);
      if (e.st <= 0 && !e.hitDone) { e.hitDone = true; e.tele = 0; stompDisc.visible = false; shock(e.pos, 0xff5a3a, 14); rig.shake = 1; sound.play("boom"); if (e.pos.distanceTo(Pl.pos) < 6.4) hurtPlayer(e.dmg, e.pos, 11); e.st = 0.7; e.atk = "rest"; } }
    else if (e.atk === "sweep") { if (e.st > 0) { e.face = lerpAng(e.face, wantFace, dt * 2.5); e.sweepA = 0; sweep.visible = true; sweep.material.opacity = 0.3; sweep.material.emissiveIntensity = 1 + Math.sin(st.time * 30); sweep.position.set(e.pos.x, 2.5, e.pos.z).addScaledVector(tmp.set(Math.sin(e.face), 0, Math.cos(e.face)), 10); sweep.rotation.y = e.face; sweep.scale.set(0.15, 0.3, 1); }
      else { e.tele = 0; e.sweepA += dt; sweep.scale.set(1, 1, 1); const a = e.face + (e.sweepA / 2.0 - 0.5) * 2.0 * e.strafe; sweep.rotation.y = a; tmp.set(Math.sin(a), 0, Math.cos(a)); sweep.position.set(e.pos.x, 1.0, e.pos.z).addScaledVector(tmp, 10); sweep.material.emissiveIntensity = 3; if (Math.random() < 0.5) fx.spark(V(e.pos.x, 1, e.pos.z).addScaledVector(tmp, rnd(2, 18)), 0xff5a3a, 1, 0.3, 1);
        tmp2.copy(Pl.pos).sub(e.pos).setY(0); const along = tmp2.dot(tmp), side = Math.abs(tmp2.x * tmp.z - tmp2.z * tmp.x); if (along > 0 && along < 20 && side < 1.3 && (e.sweepA * 4) % 1 < dt * 4 + 0.001) hurtPlayer(13, e.pos, 6); if (e.sweepA > 2.0) { sweep.visible = false; e.state = "recover"; e.st = 0.9; e.cd = rnd(...e.cdr); e.atk = null; } } }
    else if (e.atk === "slam") { e.face = lerpAng(e.face, wantFace, dt * 4); u.arms[0].rotation.x = u.arms[1].rotation.x = -3.0 * clamp(1 - e.st / 0.8, 0, 1); if (e.st <= 0 && !e.hitDone) { e.hitDone = true; e.tele = 0; const fw = V(Math.sin(e.face), 0, Math.cos(e.face)); shock(e.pos.clone().addScaledVector(fw, 2.5), 0xff9a3a, 7); sound.play("boom"); rig.shake = 0.8; if (e.pos.distanceTo(Pl.pos) < e.rng + 1 && tmp.copy(Pl.pos).sub(e.pos).setY(0).normalize().dot(fw) > 0.1) hurtPlayer(e.dmg - 2, e.pos, 12); e.st = 0.6; e.atk = "rest"; } }
    else if (e.atk === "rest") { if (e.st <= 0) { e.state = "recover"; e.st = rnd(0.6, 1); e.cd = rnd(...e.cdr); e.atk = null; } }
    if (e.state === "boss" && e.atk !== "sweep" && e.atk !== "rest" && e.st <= 0 && e.hitDone) { e.state = "recover"; e.st = 0.6; }
    // summons
    const pct = e.hp / e.max * 100; if (pct < e.ph && e.ph > 0) { e.ph -= 34; if (e.hp > 0) { say("Overload calls his gang!", 2); for (let i = 0; i < 3; i++) { const a = rnd(0, 6.28); addFoe(i === 2 ? "shooter" : "thug", Math.cos(a) * 13, Math.sin(a) * 13); } } }
  }
  function updateShots(dt) {
    for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; s.pos.addScaledVector(s.vel, dt); s.node.position.copy(s.pos); s.life -= dt; let dead = s.life <= 0; if (!dead && Math.hypot(s.pos.x - Pl.pos.x, s.pos.z - Pl.pos.z) < 0.9 && s.pos.y < 2.2 && s.pos.y > 0) { if (hurtPlayer(s.dmg, s.pos, 3)) { fx.burst(s.pos, 0xff6a3a, 8, 5, 0.3, 0.8, 0); dead = true; } } if (dead) { scene.remove(s.node); shots.splice(i, 1); } }
  }
  function updateProps(dt) {
    for (const p of arena.props) {
      if (p.dead) continue; p.node.rotation.y += 0; if (!p.flying) continue; p.pos.addScaledVector(p.vel, dt); p.vel.y -= 18 * dt; p.node.rotation.x += dt * 5; p.node.rotation.z += dt * 3;
      let hit = false; for (const e of foes) { if (e.dead) continue; if (Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z) < p.r + e.r && p.pos.y < 3.5) { hit = true; break; } } if (p.pos.y <= 0.4) hit = true;
      if (hit) { p.dead = true; p.flying = false; scene.remove(p.node); shock(p.pos, 0xffb040, 9); sound.play("boom"); rig.shake = 1; fx.burst(V(p.pos.x, 1, p.pos.z), 0xff9a3a, 30, 10, 0.8, 1.6, 4); for (const e of foes) { if (e.dead) continue; if (Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z) < 4.2 + e.r) hurtFoe(e, (p.kind === "car" ? 78 : 40) * Pl.dmg, { stun: 1.4, push: 9, big: true, pierce: true }); } }
    }
  }
  function updateCamera(dt) {
    const cp = cam.pitch, tgt = V(Pl.pos.x, 1.9, Pl.pos.z); const want = V(Math.sin(cam.yaw) * Math.cos(cp), Math.sin(cp), Math.cos(cam.yaw) * Math.cos(cp)).multiplyScalar(cam.dist).add(tgt).addScaledVector(V(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)), 1.0); want.y = Math.max(0.6, want.y);
    camera.position.lerp(want, Math.min(1, dt * 12)); camera.up.set(0, 1, 0); camera.lookAt(tgt.x - Math.cos(cam.yaw) * 0.6 - Math.sin(cam.yaw) * 1.5, 1.7, tgt.z + Math.sin(cam.yaw) * 0.6 - Math.cos(cam.yaw) * 1.5); camera.fov = 62; camera.updateProjectionMatrix();
    sun.position.set(Pl.pos.x + mood.sun[2][0] * 0.5, mood.sun[2][1] * 0.5 + 60, Pl.pos.z + mood.sun[2][2] * 0.5); sun.target.position.set(Pl.pos.x, 0, Pl.pos.z);
  }
  const api = {
    duel: L, fight: L, st, debug: { P: Pl, foes, arena, hero, cam, get lock() { return lock; }, hurtFoe },
    update(dt, t) {
      if (st.phase === "intro") { st.t += dt; st.msg = st.t < 1.3 ? L.name.toUpperCase() : "FIGHT!"; if (st.t > 2.1) { st.phase = "play"; st.msg = ""; } } else if (st.phase === "play") st.time += dt;
      st.toastT = Math.max(0, st.toastT - dt); updatePlayer(dt); updateFoes(dt); updateShots(dt); updateProps(dt); updateCamera(dt);
      if (st.phase === "play" && !foes.some((e) => !e.dead)) { if (st.wave < L.waves.length) { st.waitT += dt; if (st.waitT > 1.2) { st.waitT = 0; spawnWave(); } } else { st.phase = "won"; st.msg = "VICTORY!"; sound.play("win"); } }
      if ((st.phase === "won" || st.phase === "lost") && !st.over) { st.endT += dt; if (st.endT > 2.8) { st.over = true; ctx.onEnd(st.phase === "won", { time: st.time, kills: Pl.kills, hp: Pl.hp, taken: Pl.taken, maxHp: Pl.maxHp, throws: Pl.throws }); } }
    },
    snapshot() {
      const marks = [], sc = { x: 0, y: 0, on: false }; for (const e of foes) { if (e.dead) continue; toScreen(rig, V(e.pos.x, e.kind === "boss" ? 5.2 : e.kind === "brute" ? 2.9 : 2.3, e.pos.z), sc); marks.push({ x: sc.x, y: sc.y, on: sc.on, hp: e.hp / e.max, lock: e === lock, tele: e.tele, kind: e.kind }); }
      const alive = foes.filter((e) => !e.dead).length;
      return { kind: "brawl", phase: st.phase, hp: Pl.hp, maxHp: Pl.maxHp, energy: Pl.energy, slamCd: Pl.slamCd, hurt: Pl.hurt, time: st.time, title: L.name, wave: `Wave ${Math.min(st.wave, L.waves.length)} / ${L.waves.length}`, left: alive, marks, combo: Pl.combo, toast: st.toastT > 0 ? st.toast : "", msg: st.msg, tip: st.phase === "intro" || st.time < 8 ? L.tip : "", prop: !!st.nearProp, target: lock && !lock.dead ? { name: lock.name, hp: lock.hp, max: lock.max } : null };
    },
    dispose() { for (const s of shots) scene.remove(s.node); camera.up.set(0, 1, 0); },
  };
  return api;
}
