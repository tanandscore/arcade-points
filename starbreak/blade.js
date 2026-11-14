"use client";
// Starbreak blade duels: third-person energy-blade fights. Swing, guard, deflect blaster bolts back at the shooters, dodge and push.
import { THREE, clearScene, mesh, glowMesh, sprite, rnd, clamp, lerp, angDiff, metalTexture, floorTexture } from "@/threeplay/core";
import { torch } from "../spellwright/scenery";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export const DUELS = [
  { name: "Trooper Squad", sub: "Learn to turn blaster fire back", foes: [["trooper", 4]], tip: "Hold right click to guard. Guard just as a bolt arrives to send it flying back much harder." },
  { name: "Hired Blade", sub: "A mercenary with a red blade", foes: [["duelist", 1, { hp: 70 }]], tip: "Left click swings your blade. Guard just before its strike lands to PARRY and stagger it, then hit back." },
  { name: "Crossfire", sub: "A blade and three shooters", foes: [["duelist", 1, { hp: 75 }], ["trooper", 3]], tip: "Space rolls out of the way. Press E to push everyone back." },
  { name: "Twin Blades", sub: "Two duelists at once", foes: [["duelist", 2, { hp: 80 }]], tip: "Press Tab to switch your target. Push (E) breaks an enemy's guard." },
  { name: "The Gatekeepers", sub: "Troopers and two blades", foes: [["trooper", 4], ["duelist", 2, { hp: 85 }]], tip: "Reflect the bolts at the shooters while keeping the blades at bay." },
  { name: "The Iron Knight", sub: "The Dominion's champion", foes: [["knight", 1]], tip: "He pushes, slams the ground and strikes in long combos. Parry the combos, dodge the slam." },
];

export function makeHumanoid(o = {}) {
  const armor = o.armor ?? 0xdde2ea, accent = o.accent ?? 0x2a5a8a, g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const torso = mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), armor, { rough: 0.45, metal: 0.3 }); torso.position.y = 1.2; body.add(torso);
  const chest = mesh(new THREE.BoxGeometry(0.5, 0.3, 0.1), accent, { rough: 0.5 }); chest.position.set(0, 1.3, 0.2); body.add(chest);
  const pelvis = mesh(new THREE.BoxGeometry(0.5, 0.25, 0.32), accent, { rough: 0.6 }); pelvis.position.y = 0.76; body.add(pelvis);
  const head = mesh(new THREE.SphereGeometry(0.2, 14, 10), o.helm ?? armor, { rough: 0.35, metal: 0.4 }); head.position.y = 1.78; body.add(head);
  const visor = glowMesh(new THREE.BoxGeometry(0.28, 0.07, 0.1), o.visor ?? 0x2a1010, o.visorGlow ?? 0.2); visor.position.set(0, 1.78, 0.17); body.add(visor);
  if (o.hood) { const h = mesh(new THREE.ConeGeometry(0.3, 0.5, 10), accent, { rough: 0.9 }); h.position.set(0, 1.9, -0.05); h.rotation.x = -0.3; body.add(h); const cape = mesh(new THREE.BoxGeometry(0.6, 1.3, 0.05), accent, { rough: 0.9 }); cape.geometry.translate(0, -0.6, 0); cape.position.set(0, 1.5, -0.22); body.add(cape); g.userData.cape = cape; }
  const legs = []; for (const s of [-1, 1]) { const l = new THREE.Group(); l.position.set(s * 0.16, 0.7, 0); const m = mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.7, 8), armor, { rough: 0.5 }); m.position.y = -0.35; l.add(m); const f = mesh(new THREE.BoxGeometry(0.16, 0.1, 0.28), accent, { rough: 0.6 }); f.position.set(0, -0.72, 0.05); l.add(f); g.add(l); legs.push(l); }
  const arm = new THREE.Group(); arm.position.set(0.4, 1.45, 0); body.add(arm); const am = mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.6, 8), armor, { rough: 0.5 }); am.position.set(0, -0.28, 0.12); am.rotation.x = -0.45; arm.add(am);
  const arm2 = new THREE.Group(); arm2.position.set(-0.4, 1.45, 0); body.add(arm2); const am2 = mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.6, 8), armor, { rough: 0.5 }); am2.position.set(0, -0.3, 0.05); arm2.add(am2);
  const hold = new THREE.Group(); hold.position.set(0, -0.58, 0.28); arm.add(hold);
  let tip = null, blade = null, glow = null;
  if (o.rifle) { const r = mesh(new THREE.BoxGeometry(0.1, 0.12, 0.9), 0x2a2d38, { metal: 0.7 }); r.position.set(0, 0, 0.3); hold.add(r); tip = new THREE.Object3D(); tip.position.set(0, 0, 0.8); hold.add(tip); glow = sprite(0xff3a2a, 0.5, 0.0); tip.add(glow); }
  else { const hilt = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), 0x2a2d38, { metal: 0.8 }); hilt.rotation.x = Math.PI / 2; hilt.position.set(0, 0, 0); hold.add(hilt); blade = glowMesh(new THREE.CylinderGeometry(0.035, 0.035, 1.25, 8), o.blade ?? 0x6fd0ff, 3.5); blade.rotation.x = Math.PI / 2; blade.position.set(0, 0, 0.78); hold.add(blade); glow = sprite(o.blade ?? 0x6fd0ff, 1.8, 0.7); glow.position.set(0, 0, 0.8); hold.add(glow); tip = new THREE.Object3D(); tip.position.set(0, 0, 1.4); hold.add(tip); }
  g.userData = { ...g.userData, body, arm, arm2, legs, hold, tip, blade, glow, head };
  return g;
}

export function createBlade(rig, ctx) {
  clearScene(rig); const { scene, fx, sound } = rig, D = DUELS[ctx.duel], power = ctx.power || 1;
  rig.setSky({ zenith: 0x080208, mid: 0x28100c, horizon: 0xff5a1e, sunDir: [0.2, 0.1, -1], sunColor: 0xff7a3a, sunSize: 0.0, glow: 1.4, cloud: 0.7, cloudColor: 0xc05a30, cloudShade: 0x1a0808, stars: 0.4 });
  scene.fog = new THREE.FogExp2(0x2a0e0a, 0.012);
  scene.add(new THREE.HemisphereLight(0xffb090, 0x3a2030, 1.5));
  const key = new THREE.DirectionalLight(0xffd0b0, 1.8); key.position.set(-12, 24, 10); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); const sc = key.shadow.camera; sc.left = sc.bottom = -22; sc.right = sc.top = 22; sc.near = 4; sc.far = 80; key.shadow.bias = -0.0004; scene.add(key);
  const R = 15, tex = metalTexture("#6a707e", 6, 6);
  const deck = mesh(new THREE.CylinderGeometry(R, R + 0.6, 1.2, 48), 0x6a707e, { map: tex, rough: 0.5, metal: 0.5 }); deck.position.y = -0.6; scene.add(deck);
  const ringG = glowMesh(new THREE.TorusGeometry(R - 1.5, 0.08, 6, 64), 0x6fd0ff, 2.4); ringG.rotation.x = Math.PI / 2; ringG.position.y = 0.03; scene.add(ringG);
  const ringR = glowMesh(new THREE.TorusGeometry(5, 0.07, 6, 48), 0xff6a3a, 2.0); ringR.rotation.x = Math.PI / 2; ringR.position.y = 0.03; scene.add(ringR);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const p = mesh(new THREE.BoxGeometry(0.6, 6, 0.6), 0x4a4e5a, { map: tex, metal: 0.6, rough: 0.5 }); p.position.set(Math.cos(a) * (R + 0.4), 2.4, Math.sin(a) * (R + 0.4)); scene.add(p); const l = glowMesh(new THREE.BoxGeometry(0.15, 5, 0.15), i % 2 ? 0xff6a3a : 0x6fd0ff, 2.2); l.position.set(Math.cos(a) * (R - 0.0), 2.4, Math.sin(a) * (R - 0.0)); scene.add(l); }
  const rail = mesh(new THREE.TorusGeometry(R + 0.4, 0.15, 6, 64), 0x8a90a0, { metal: 0.7, rough: 0.4 }); rail.rotation.x = Math.PI / 2; rail.position.y = 1.0; scene.add(rail);
  const core = sprite(0xff5a1e, 120, 0.7); core.position.set(0, -40, 0); scene.add(core);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(R + 30, R + 30, 200, 32, 1, true), new THREE.MeshStandardMaterial({ map: tex, side: THREE.BackSide, color: 0x6a5048, roughness: 0.8, emissive: 0x401408, emissiveIntensity: 0.6 })); shaft.position.y = -90; scene.add(shaft);
  const torches = [];
  for (let i = 0; i < 6; i++) { const a = (i / 6) * 6.283 + 0.3; const t = torch(0xff7a3a, i % 2 === 0, 18, 26); t.position.set(Math.cos(a) * (R - 1.2), 0, Math.sin(a) * (R - 1.2)); scene.add(t); torches.push(t); }
  const arena = { collide(p, r) { const d = Math.hypot(p.x, p.z), lim = R - 0.8 - r; if (d > lim) { p.x *= lim / d; p.z *= lim / d; } } };

  const P = { pos: V(0, 0, 9), vel: V(), yaw: Math.PI, hp: 100 + (power - 1) * 14, force: 100, guard: false, guardAge: 9, roll: 0, rollCd: 0, rollDir: V(), swing: 0, swingMax: 0.4, combo: 0, comboT: 0, queued: false, hit: false, stagger: 0, invul: 0, alive: true, walk: 0, flash: 0, pushCd: 0, dmg: 1 + (power - 1) * 0.14, kills: 0, taken: 0, parries: 0, deflects: 0, dir: 1, ultime: 0, t: 0, pushT: 0 };
  P.maxHp = P.hp;
  const pm = makeHumanoid({ armor: 0xc8b890, accent: 0x2a4a6a, helm: 0xc8b890, hood: true, visor: 0x101828, blade: 0x6fd0ff });
  scene.add(pm);
  const foes = [], shots = [], tmp = V(), tmp2 = V(); let lock = null;
  const cam = { yaw: 0, pitch: 0.22, dist: 6.4, pos: V(9 * 0, 3, 16) };
  const st = { phase: "intro", t: 0, time: 0, msg: "", over: false, endT: 0, toast: "", toastT: 0 };
  const say = (t, d = 1.2) => { st.toast = t; st.toastT = d; };

  function addFoe(kind, def = {}, x, z) {
    const knight = kind === "knight", trooper = kind === "trooper";
    const m = makeHumanoid(trooper ? { armor: 0xe8ecf0, accent: 0x3a4050, helm: 0xf0f0f4, visor: 0x101010, visorGlow: 0.1, rifle: true } : { armor: knight ? 0x2a2630 : 0x4a3a3a, accent: knight ? 0x8a1a1a : 0x7a2a2a, helm: knight ? 0x1a1620 : 0x3a2a2a, visor: 0xff3a2a, visorGlow: 3, blade: 0xff3a3a, hood: !trooper && !knight });
    if (knight) m.scale.setScalar(1.28); scene.add(m);
    const hp = def.hp || (trooper ? 30 : knight ? 340 : 80);
    const wm = mesh(new THREE.SphereGeometry(1.2, 14, 10), 0xff6a3a, { opacity: 0, emissive: 0xff4a1a, ei: 1.5, cast: false, recv: false }); wm.material.depthWrite = false; wm.position.y = 1; m.add(wm);
    const e = { kind, name: knight ? "The Iron Knight" : trooper ? "Dominion Trooper" : "Blade Mercenary", m, wm, pos: V(x, 0, z), vel: V(), yaw: 0, hp: hp * (1 + (ctx.hpScale || 0)), max: hp * (1 + (ctx.hpScale || 0)), r: knight ? 0.8 : 0.5, state: "approach", st: rnd(0.4, 1.4), cd: rnd(0.5, 1.5), guard: 0, stagger: 0, combo: 0, comboMax: 2, swingT: 0, hitDone: false, strafe: Math.random() < 0.5 ? 1 : -1, strafeT: rnd(1, 3), speed: trooper ? 3.4 : knight ? 5.2 : 4.6, dead: false, deadT: 0, walk: rnd(0, 6), aim: 0, flash: 0 };
    foes.push(e); return e;
  }
  const n0 = D.foes.reduce((a, [, n]) => a + n, 0); let idx = 0;
  for (const [kind, n, def] of D.foes) for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (idx - (n0 - 1) / 2) * 0.7; addFoe(kind, def, Math.cos(a) * 9, Math.sin(a) * 9 - 1); idx++; }
  lock = foes.find((f) => f.kind !== "trooper") || foes[0];

  function bolt(from, dir, team, dmg, speed, color) { const m = glowMesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 5), color, 4); m.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize()); m.position.copy(from); const gl = sprite(color, 1.0, 0.8); m.add(gl); scene.add(m); shots.push({ node: m, pos: from.clone(), vel: dir.clone().normalize().multiplyScalar(speed), team, dmg, life: 3, color }); }
  const cy = (e) => (e.kind === "knight" ? 1.6 : 1.1);
  function hurtFoe(e, d, big) {
    if (e.dead) return; if (e.guard > 0 && e.stagger <= 0) { sound.play("clang"); fx.burst(V(e.pos.x, 1.2, e.pos.z), 0xffe0a0, 12, 5, 0.3, 0.5, 0); P.stagger = 0.25; P.vel.addScaledVector(tmp.copy(P.pos).sub(e.pos).setY(0).normalize(), 6); return false; }
    const mul = e.stagger > 0 ? 1.5 : 1; e.hp -= d * mul; e.flash = 0.15; sound.play("hit"); fx.burst(V(e.pos.x, 1.2, e.pos.z), e.kind === "trooper" ? 0xffffff : 0xff8a5a, 12, 5, 0.4, 0.5, 4);
    if (e.kind !== "knight" || big) e.vel.addScaledVector(tmp.copy(e.pos).sub(P.pos).setY(0).normalize(), big ? 7 : 2.5); if (e.kind === "trooper") { e.stagger = Math.max(e.stagger, 0.35); }
    P.force = Math.min(100, P.force + 4);
    if (e.hp <= 0) { e.dead = true; P.kills++; fx.burst(V(e.pos.x, 1.2, e.pos.z), 0xffb070, 30, 7, 0.8, 0.8, 3); sound.play("boom"); P.force = Math.min(100, P.force + 15); }
    return true;
  }
  function hurtPlayer(d, src, melee) {
    if (!P.alive || P.invul > 0) return "miss";
    if (P.guard) { const to = tmp.copy(src.pos || src).sub(P.pos).setY(0).normalize(), fwd = V(Math.sin(P.yaw), 0, Math.cos(P.yaw)); if (to.dot(fwd) > 0.2) {
      if (melee) { if (P.guardAge < 0.3) { P.parries++; P.force = Math.min(100, P.force + 18); src.stagger = 1.3; src.state = "recover"; src.st = 1; src.swingT = 0; src.aim = 0; sound.play("clang"); say("PARRY!", 0.7); fx.burst(V(P.pos.x + fwd.x, 1.3, P.pos.z + fwd.z), 0xffffff, 16, 6, 0.4, 0.6, 0); src.hp -= 10; return "parry"; } P.force -= 12; sound.play("clang"); fx.burst(V(P.pos.x + fwd.x, 1.3, P.pos.z + fwd.z), 0xffe0a0, 10, 4, 0.3, 0.5, 0); if (P.force <= 0) { P.force = 0; P.guard = false; P.stagger = 0.8; } P.vel.addScaledVector(to, -5); return "block"; }
    } }
    P.hp -= d; P.taken += d; P.flash = 0.35; P.stagger = Math.max(P.stagger, 0.2); P.invul = 0.4; rig.shake = 0.7; sound.play("hurt"); fx.burst(V(P.pos.x, 1.2, P.pos.z), 0xff4a3a, 10, 4, 0.4, 0.5, 4);
    if (P.hp <= 0) { P.hp = 0; P.alive = false; st.phase = "lost"; st.endT = 0; sound.play("lose"); }
    return "hit";
  }

  function targetDir(out) { if (lock && !lock.dead) return out.set(lock.pos.x - P.pos.x, 0, lock.pos.z - P.pos.z).normalize(); return out.set(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)); }
  function startSwing() { if (P.stagger > 0 || P.roll > 0) return; if (P.swing > 0) { if (P.swing < P.swingMax * 0.6 && P.combo < 3) P.queued = true; return; } P.combo = P.comboT > 0 ? (P.combo % 3) + 1 : 1; P.comboT = 0.9; P.swingMax = P.combo === 3 ? 0.58 : 0.38; P.swing = P.swingMax; P.hit = false; P.dir = P.combo === 2 ? -1 : 1; sound.play("whoosh"); const d = targetDir(tmp); P.yaw = Math.atan2(d.x, d.z); P.vel.addScaledVector(d, 4); }
  function force() { if (P.pushCd > 0 || P.force < 30 || P.stagger > 0) return; P.force -= 30; P.pushCd = 5; P.pushT = 0.4; sound.play("gale"); rig.shake = 0.6; const o = V(P.pos.x, 1, P.pos.z); fx.ring(o, 0x9fe8ff, 40, 12, 0.6, 0.9); const fwd = V(Math.sin(P.yaw), 0, Math.cos(P.yaw)); for (const e of foes) { if (e.dead) continue; const d = tmp.copy(e.pos).sub(P.pos).setY(0), L = d.length(); if (L < 11 && d.normalize().dot(fwd) > -0.2) { e.guard = 0; e.stagger = 1.1; e.state = "recover"; e.st = 1.1; e.swingT = 0; e.aim = 0; e.vel.addScaledVector(d, e.kind === "knight" ? 6 : 16); hurtFoe(e, 8 * P.dmg, false); } } for (let i = shots.length - 1; i >= 0; i--) if (shots[i].team === 1 && shots[i].pos.distanceTo(P.pos) < 11) killShot(i); }
  function killShot(i) { scene.remove(shots[i].node); shots.splice(i, 1); }

  function updateFoe(e, dt) {
    e.walk += dt; if (e.flash > 0) e.flash -= dt; if (e.guard > 0) e.guard -= dt;
    if (e.dead) { e.deadT += dt; e.m.rotation.x = Math.min(1.5, e.deadT * 4); e.m.position.y = -Math.min(0.6, e.deadT * 0.8); if (e.deadT > 0.9) { scene.remove(e.m); foes.splice(foes.indexOf(e), 1); if (lock === e) lock = foes.find((f) => !f.dead && f.kind !== "trooper") || foes.find((f) => !f.dead) || null; } return; }
    const toP = tmp.copy(P.pos).sub(e.pos).setY(0), dist = toP.length(); toP.normalize(); const face = Math.atan2(toP.x, toP.z); const mv = V();
    if (e.stagger > 0) { e.stagger -= dt; e.vel.multiplyScalar(0.92); }
    else if (P.alive) {
      e.cd -= dt;
      if (e.kind === "trooper") {
        e.strafeT -= dt; if (e.strafeT <= 0) { e.strafe = -e.strafe; e.strafeT = rnd(1, 2.6); }
        if (e.state !== "aim") { const side = V(-toP.z, 0, toP.x).multiplyScalar(e.strafe); mv.copy(toP).multiplyScalar(clamp((dist - 12) * 0.4, -1, 1)).addScaledVector(side, 0.7).normalize().multiplyScalar(e.speed); }
        if (e.state === "approach" && e.cd <= 0) { e.state = "aim"; e.st = 0.75; }
        else if (e.state === "aim") { e.st -= dt; e.aim = 1 - e.st / 0.75; if (e.st <= 0) { e.state = "approach"; e.aim = 0; e.cd = rnd(1.3, 2.4); const from = e.m.userData.tip.getWorldPosition(V()); const dir = V(P.pos.x - from.x, 1.2 - from.y, P.pos.z - from.z).add(P.vel.clone().multiplyScalar(0.35)); bolt(from, dir, 1, 8, 24, 0xff3a2a); sound.play("laser"); } }
      } else {
        // blade fighters
        if (e.state === "approach") { if (dist > 2.4) mv.copy(toP).multiplyScalar(e.speed); else { e.state = "wind"; e.st = e.kind === "knight" ? 0.5 : 0.55; e.combo = 0; e.comboMax = e.kind === "knight" ? 4 : 1 + ((Math.random() * 3) | 0); } if (e.kind === "knight" && e.cd <= 0 && dist > 6) { e.state = Math.random() < 0.5 ? "slam" : "shock"; e.st = e.state === "slam" ? 1.0 : 0.8; e.cd = rnd(4, 6.5); } }
        else if (e.state === "wind") { e.st -= dt; e.aim = 1 - e.st / 0.55; if (e.st <= 0) { e.state = "swing"; e.st = 0.22; e.hitDone = false; sound.play("whoosh"); } }
        else if (e.state === "swing") { e.st -= dt; e.swingT = e.st; mv.copy(toP).multiplyScalar(5); if (!e.hitDone && e.st < 0.12) { e.hitDone = true; if (dist < 3.2 && (toP.clone().dot(V(Math.sin(e.yaw), 0, Math.cos(e.yaw))) > 0.3)) hurtPlayer(e.kind === "knight" ? 16 : 12, e, true); } if (e.st <= 0) { e.combo++; if (e.combo < e.comboMax) { e.state = "wind"; e.st = 0.34; } else { e.state = "recover"; e.st = rnd(0.8, 1.4); e.aim = 0; } } }
        else if (e.state === "recover") { e.st -= dt; const side = V(-toP.z, 0, toP.x).multiplyScalar(e.strafe); mv.copy(toP).multiplyScalar(dist < 4 ? -0.8 : 0).addScaledVector(side, 1).normalize().multiplyScalar(e.speed * 0.6); if (e.st <= 0) { e.state = "approach"; e.strafe = -e.strafe; } }
        else if (e.state === "slam") { e.st -= dt; e.aim = 1 - e.st / 1.0; if (e.st <= 0) { const p = V(e.pos.x, 0.1, e.pos.z); fx.ring(p, 0xff8a3a, 40, 9, 0.6, 0.9); rig.shake = 1; sound.play("boom"); if (dist < 7 && P.roll <= 0) hurtPlayer(18, e, false); e.state = "recover"; e.st = 1.3; e.aim = 0; } }
        else if (e.state === "shock") { e.st -= dt; e.aim = 1 - e.st / 0.8; if (e.st <= 0) { for (let i = -2; i <= 2; i++) { const a = face + i * 0.28, from = V(e.pos.x, 1.0, e.pos.z); bolt(from, V(Math.sin(a), 0, Math.cos(a)), 1, 9, 17, 0xff5a3a); } sound.play("cast"); e.state = "recover"; e.st = 1.2; e.aim = 0; } }
        // guard when the player swings nearby
        if (e.state !== "wind" && e.state !== "swing" && e.guard <= 0 && P.swing > 0 && dist < 3.6 && Math.random() < dt * (e.kind === "knight" ? 1.6 : 1.1)) { e.guard = 0.9; sound.play("ward"); }
      }
    }
    e.vel.x = lerp(e.vel.x, mv.x, 1 - Math.exp(-dt * 6)); e.vel.z = lerp(e.vel.z, mv.z, 1 - Math.exp(-dt * 6));
    e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt; arena.collide(e.pos, e.r);
    for (const o of foes) { if (o === e || o.dead) continue; const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z, d = Math.hypot(dx, dz), m = e.r + o.r + 0.2; if (d < m && d > 0.001) { e.pos.x += (dx / d) * (m - d) * 0.5; e.pos.z += (dz / d) * (m - d) * 0.5; } }
    if (dist < e.r + 0.45) { P.pos.x -= toP.x * (e.r + 0.45 - dist) * 0.5; P.pos.z -= toP.z * (e.r + 0.45 - dist) * 0.5; }
    if (e.stagger <= 0) e.yaw += angDiff(e.yaw, face) * Math.min(1, dt * 9);
    const m = e.m, ud = m.userData, sp = Math.hypot(e.vel.x, e.vel.z); m.position.set(e.pos.x, m.position.y > -0.01 || !e.dead ? 0 : m.position.y, e.pos.z); m.rotation.y = e.yaw;
    ud.legs[0].rotation.x = Math.sin(e.walk * 8) * 0.6 * Math.min(1, sp / 3); ud.legs[1].rotation.x = -Math.sin(e.walk * 8) * 0.6 * Math.min(1, sp / 3);
    if (e.kind === "trooper") { ud.arm.rotation.x = -1.25; ud.arm2.rotation.x = -1.1; ud.glow.material.opacity = e.state === "aim" ? 0.4 + e.aim * 0.6 : 0; ud.glow.scale.setScalar(0.4 + e.aim * 1.6); }
    else { let ax = -1.0, bz = 0; if (e.state === "wind") { ax = -1.0 - e.aim * 1.4; bz = e.aim * 0.4; } else if (e.state === "swing") { ax = -2.4 + (0.22 - e.st) / 0.22 * 2.0; } else if (e.state === "slam") { ax = -1 - e.aim * 2.4; } else if (e.state === "shock") { ax = -0.6; ud.arm2.rotation.x = -1.2 - e.aim; } ud.arm.rotation.x = ax; ud.arm.rotation.z = bz; ud.body.rotation.y = e.state === "swing" ? (e.st / 0.22 - 0.5) * 1.4 : 0; ud.glow.scale.setScalar(1.6 + (e.state === "wind" ? e.aim * 1.6 : 0)); }
    e.wm.material.opacity = e.guard > 0 ? 0.28 : 0; const tint = e.flash > 0 ? 1 : 0; m.traverse((o) => { if (o.material && o.material.emissive && o !== e.wm && o.material.emissiveIntensity < 1.5 && o.material !== e.wm.material) { if (o.material.userData.e0 === undefined) o.material.userData.e0 = o.material.emissive.getHex(); o.material.emissive.setHex(tint ? 0xffffff : o.material.userData.e0); } });
    if (e.stagger > 0) { m.rotation.z = Math.sin(e.walk * 30) * 0.08; if (Math.random() < 0.3) fx.spark(V(e.pos.x, 2, e.pos.z), 0xffe070, 0.4, 0.4, 1); } else m.rotation.z = 0;
  }

  function updatePlayer(dt) {
    const k = rig.keys, pr = rig.pressed; P.t += dt; P.invul = Math.max(0, P.invul - dt); P.flash = Math.max(0, P.flash - dt); P.rollCd = Math.max(0, P.rollCd - dt); P.pushCd = Math.max(0, P.pushCd - dt); P.stagger = Math.max(0, P.stagger - dt); P.comboT = Math.max(0, P.comboT - dt); P.pushT = Math.max(0, P.pushT - dt);
    cam.yaw -= rig.mouse.dx * 0.0032; cam.pitch = clamp(cam.pitch + rig.mouse.dy * 0.0026, -0.1, 0.9); cam.yaw += ((k.has("ArrowLeft") ? 1 : 0) - (k.has("ArrowRight") ? 1 : 0) + (k.has("KeyQ") ? 1 : 0)) * dt * 2.2; cam.pitch = clamp(cam.pitch + ((k.has("ArrowDown") ? 1 : 0) - (k.has("ArrowUp") ? 1 : 0)) * dt * 1.4, -0.1, 0.9);
    if (pr.has("Tab") || pr.has("KeyT")) { const al = foes.filter((f) => !f.dead); if (al.length) lock = al[(al.indexOf(lock) + 1) % al.length]; say(lock ? lock.name : "", 0.8); }
    if (lock && lock.dead) lock = foes.find((f) => !f.dead) || null;
    if (lock) { const d = tmp.copy(lock.pos).sub(P.pos); cam.yaw += angDiff(cam.yaw, Math.atan2(-d.x, -d.z)) * Math.min(1, dt * 3); }
    if (P.alive) {
      const fwdC = V(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)), rt = V(-fwdC.z, 0, fwdC.x);
      const wish = V().addScaledVector(fwdC, (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0)).addScaledVector(rt, (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0)); if (wish.lengthSq() > 0) wish.normalize();
      const sp = (k.has("ShiftLeft") ? 7.2 : 5.2) * (P.guard ? 0.55 : 1) * (P.swing > 0 ? 0.4 : 1) * (P.stagger > 0 ? 0.2 : 1);
      if (P.roll > 0) { P.roll -= dt; P.vel.x = P.rollDir.x * 11; P.vel.z = P.rollDir.z * 11; }
      else { P.vel.x = lerp(P.vel.x, wish.x * sp, 1 - Math.exp(-dt * 12)); P.vel.z = lerp(P.vel.z, wish.z * sp, 1 - Math.exp(-dt * 12)); }
      if (pr.has("Space") && P.rollCd <= 0 && P.roll <= 0 && P.stagger <= 0) { P.rollDir = wish.lengthSq() > 0 ? wish.clone() : V(-Math.sin(P.yaw), 0, -Math.cos(P.yaw)); P.roll = 0.34; P.rollCd = 0.8; P.invul = 0.4; P.swing = 0; sound.play("whoosh"); }
      P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt; arena.collide(P.pos, 0.45); P.walk += Math.hypot(P.vel.x, P.vel.z) * dt;
      if (lock) { const d = targetDir(tmp); P.yaw += angDiff(P.yaw, Math.atan2(d.x, d.z)) * Math.min(1, dt * 12); } else if (wish.lengthSq() > 0 && P.swing <= 0 && !P.guard) P.yaw += angDiff(P.yaw, Math.atan2(wish.x, wish.z)) * Math.min(1, dt * 12);
      if (rig.mouse.clickL || pr.has("KeyJ")) startSwing();
      const wantG = (rig.mouse.right || k.has("KeyV")) && P.stagger <= 0 && P.roll <= 0 && P.force > 0 && P.swing <= 0; if (wantG && !P.guard) { P.guardAge = 0; sound.play("blade"); } P.guard = wantG; P.guardAge += dt; if (P.guard) P.force = Math.max(0, P.force - dt * 5);
      if (pr.has("KeyE") || pr.has("KeyF")) force();
      P.force = clamp(P.force + dt * (P.guard ? 0 : 5), 0, 100);
      if (P.swing > 0) { P.swing -= dt; const prog = 1 - P.swing / P.swingMax; if (!P.hit && prog > 0.4) { P.hit = true; const fwd = V(Math.sin(P.yaw), 0, Math.cos(P.yaw)); let any = false; for (const e of foes) { if (e.dead) continue; const d = tmp.copy(e.pos).sub(P.pos).setY(0), L = d.length(); if (L < 3.4 + e.r && d.normalize().dot(fwd) > 0.25) { any = true; hurtFoe(e, (P.combo === 3 ? 26 : 14) * P.dmg, P.combo === 3); } } if (any) rig.shake = Math.max(rig.shake, 0.25); fx.ring(V(P.pos.x + fwd.x * 1.4, 1.2, P.pos.z + fwd.z * 1.4), 0x9fe8ff, 12, 4, 0.25, 0.5); } if (P.swing <= 0) { P.swing = 0; if (P.queued) { P.queued = false; startSwing(); } } }
    }
    const m = pm, ud = m.userData, sp2 = Math.hypot(P.vel.x, P.vel.z); m.position.set(P.pos.x, 0, P.pos.z); m.rotation.y = P.yaw;
    ud.legs[0].rotation.x = Math.sin(P.walk * 2.2) * 0.7 * Math.min(1, sp2 / 4); ud.legs[1].rotation.x = -Math.sin(P.walk * 2.2) * 0.7 * Math.min(1, sp2 / 4);
    let ax = -1.0, bz = 0, by = 0; if (P.guard) { ax = -1.7; bz = -0.2; } if (P.swing > 0) { const pg = 1 - P.swing / P.swingMax; if (P.combo === 3) ax = -2.8 + pg * 2.6; else ax = -1.45; by = P.dir * (0.9 - pg * 1.8); } ud.arm.rotation.x = ax; ud.arm.rotation.z = bz; ud.body.rotation.y = by; ud.arm2.rotation.x = P.pushT > 0 ? -1.5 : -0.2; ud.body.rotation.x = P.roll > 0 ? 0.9 : 0;
    if (ud.cape) ud.cape.rotation.x = 0.1 + Math.min(0.7, sp2 * 0.08); ud.glow.scale.setScalar(1.8 + (P.guard ? 1 : 0) + Math.sin(P.t * 10) * 0.1);
    if (P.swing > 0 || P.guard) { const t = ud.tip.getWorldPosition(V()); fx.spark(t, 0x6fd0ff, 0.5, 0.25, 0.4); }
    // camera
    const target = V(P.pos.x, 1.7, P.pos.z), off = V(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)).multiplyScalar(cam.dist), side = V(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw));
    target.addScaledVector(side, 1.4); const want = target.clone().add(off); const d = Math.hypot(want.x, want.z); if (d > 22) { want.x *= 22 / d; want.z *= 22 / d; } want.y = Math.max(0.8, want.y);
    cam.pos.lerp(want, 1 - Math.exp(-dt * 14)); rig.camera.position.copy(cam.pos); const look = V(P.pos.x, 1.4, P.pos.z).addScaledVector(side, 0.4).add(V(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)).multiplyScalar(4)); look.y = 1.5 - Math.sin(cam.pitch) * 2; rig.camera.lookAt(look);
  }
  function updateShots(dt) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]; s.life -= dt; s.pos.addScaledVector(s.vel, dt); s.node.position.copy(s.pos); fx.spark(s.pos, s.color, 0.4, 0.2, 0.2); let dead = s.life <= 0 || Math.hypot(s.pos.x, s.pos.z) > R + 4;
      if (!dead && s.team === 1 && P.alive) { const cpos = V(P.pos.x, 1.2, P.pos.z); if (cpos.distanceTo(s.pos) < 1.0) { if (P.guard && P.stagger <= 0) { const fwd = V(Math.sin(P.yaw), 0, Math.cos(P.yaw)), to = V(s.pos.x - P.pos.x, 0, s.pos.z - P.pos.z).normalize(); if (to.dot(fwd) > 0.1) { const perfect = P.guardAge < 0.3; P.deflects++; P.force = Math.min(100, P.force + 6); const dir = lock && !lock.dead ? V(lock.pos.x - s.pos.x, 1.2 - s.pos.y, lock.pos.z - s.pos.z).normalize() : fwd.clone(); s.vel.copy(dir).multiplyScalar(s.vel.length() * 1.5); s.team = 0; s.dmg = (perfect ? 30 : 14) * P.dmg; s.color = 0x6fd0ff; s.node.material.color.setHex(0x6fd0ff); s.node.material.emissive.setHex(0x6fd0ff); s.life = 2; sound.play("clang"); fx.burst(s.pos, 0x9fe8ff, 12, 5, 0.3, 0.6, 0); if (perfect) say("DEFLECT!", 0.6); continue; } } hurtPlayer(s.dmg, { pos: s.pos }, false); dead = true; } }
      else if (!dead && s.team === 0) { for (const e of foes) { if (e.dead) continue; if (V(e.pos.x, cy(e), e.pos.z).distanceTo(s.pos) < e.r + 0.5) { hurtFoe(e, s.dmg, true); dead = true; break; } } }
      if (dead) killShot(i);
    }
  }
  const out = {
    state: st, duel: D,
    update(dt, time) {
      for (const t of torches) t.userData.tick(time, t.position.x);
      st.t += dt; if (st.toastT > 0) st.toastT -= dt;
      if (st.phase === "intro") { const c = 3 - st.t; st.msg = c > 0 ? String(Math.ceil(c)) : "FIGHT!"; P.invul = 1; for (const e of foes) e.cd = Math.max(e.cd, 1.4); if (st.t > 3.6) { st.phase = "fight"; st.msg = ""; } }
      else if (st.phase === "fight") { st.time += dt; if (!foes.some((e) => !e.dead)) { st.phase = "won"; st.endT = 0; P.invul = 99; sound.play("win"); say("VICTORY!", 3); } }
      else { st.msg = ""; st.endT += dt; if (st.endT > 2.4 && !st.over) { st.over = true; ctx.onEnd(st.phase === "won", { time: st.time, hp: P.hp, maxHp: P.maxHp, taken: P.taken, parries: P.parries, deflects: P.deflects }); } }
      updatePlayer(dt); for (const e of [...foes]) updateFoe(e, dt); updateShots(dt);
    },
    snapshot() { const t = lock && !lock.dead ? lock : null; return { kind: "blade", phase: st.phase, msg: st.msg, toast: st.toastT > 0 ? st.toast : "", title: D.name, sub: D.sub, time: st.time, hp: P.hp, maxHp: P.maxHp, force: P.force, pushCd: P.pushCd, hurt: P.flash, guard: P.guard, target: t ? { name: t.name, hp: t.hp, max: t.max, guard: t.guard > 0 } : null, tip: st.phase === "intro" ? D.tip : "", foes: foes.filter((e) => !e.dead).length }; },
    dispose() { for (const s of shots) scene.remove(s.node); },
  };
  const cm = V(0, 0, 0); cam.yaw = 0; cam.pos.set(0, 3, 16);
  return out;
}
