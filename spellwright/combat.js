"use client";
// Spellwright's spell-fighting engine: used by both the Duel Club and the Crypt. It owns the player wizard, enemy wizards and monsters,
// the spells flying between them, and the over-the-shoulder camera. Each mode just supplies an arena (walls) and tells it which foes to spawn.
import { THREE, clamp, lerp, rnd, angDiff, mesh, glowMesh, sprite } from "@/threeplay/core";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------- characters ----------
export function makeWizard(o = {}) {
  const robe = o.robe ?? 0x3b4cc0, trim = o.trim ?? 0xf2c230, hat = o.hat ?? robe, skin = o.skin ?? 0xe8b894, g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const R = mesh(new THREE.CylinderGeometry(0.26, 0.55, 1.15, 14), robe, { rough: 0.8 }); R.position.y = 0.6; body.add(R);
  const hem = mesh(new THREE.TorusGeometry(0.52, 0.04, 6, 20), trim, { rough: 0.5, metal: 0.4 }); hem.rotation.x = Math.PI / 2; hem.position.y = 0.05; body.add(hem);
  const sh = mesh(new THREE.SphereGeometry(0.34, 14, 10), robe, { rough: 0.8 }); sh.scale.set(1.05, 0.6, 0.8); sh.position.y = 1.2; body.add(sh);
  const belt = mesh(new THREE.CylinderGeometry(0.31, 0.33, 0.1, 12), trim, { rough: 0.4, metal: 0.5 }); belt.position.y = 0.85; body.add(belt);
  const head = mesh(new THREE.SphereGeometry(0.21, 16, 12), skin, { rough: 0.6 }); head.position.y = 1.52; body.add(head);
  for (const sx of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(0.03, 6, 6), 0x181820, { cast: false }); e.position.set(sx * 0.075, 1.54, 0.185); body.add(e); }
  const brim = mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.04, 20), hat, { rough: 0.8 }); brim.position.y = 1.66; body.add(brim);
  const cone = mesh(new THREE.ConeGeometry(0.25, 0.65, 16), hat, { rough: 0.8 }); cone.position.y = 2.0; cone.rotation.z = 0.12; cone.rotation.x = -0.1; body.add(cone);
  const band = mesh(new THREE.CylinderGeometry(0.25, 0.27, 0.07, 16), trim, { rough: 0.4, metal: 0.5 }); band.position.y = 1.7; body.add(band);
  const cape = mesh(new THREE.BoxGeometry(0.56, 1.0, 0.04), o.cape ?? trim, { rough: 0.85 }); cape.position.set(0, 0.95, -0.3); cape.geometry.translate(0, -0.45, 0); cape.position.y = 1.35; body.add(cape);
  const arm = new THREE.Group(); arm.position.set(0.32, 1.25, 0.05); body.add(arm);
  const armM = mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.55, 8), robe, { rough: 0.8 }); armM.position.set(0, -0.2, 0.2); armM.rotation.x = -1.1; arm.add(armM);
  const wand = mesh(new THREE.CylinderGeometry(0.014, 0.024, 0.62, 6), 0x2a1a10, { rough: 0.5 }); wand.position.set(0, -0.05, 0.62); wand.rotation.x = Math.PI / 2 - 0.3; arm.add(wand);
  const tip = new THREE.Object3D(); tip.position.set(0, 0.12, 0.92); arm.add(tip);
  const glow = sprite(o.magic ?? 0x8fd0ff, 0.6, 0.9); tip.add(glow);
  const arm2 = new THREE.Group(); arm2.position.set(-0.32, 1.25, 0.05); body.add(arm2);
  const a2 = mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.55, 8), robe, { rough: 0.8 }); a2.position.set(0, -0.25, 0.05); a2.rotation.x = -0.25; arm2.add(a2);
  g.userData = { body, arm, arm2, tip, glow, cape, wand };
  return g;
}

export function makeMonster(kind, o = {}) {
  const g = new THREE.Group(), c = o.color ?? 0x6a7a62;
  if (kind === "imp") {
    const b = mesh(new THREE.SphereGeometry(0.42, 12, 10), c, { rough: 0.6 }); b.scale.set(1, 1.1, 0.9); b.position.y = 0.7; g.add(b);
    const h = mesh(new THREE.SphereGeometry(0.28, 12, 10), c, { rough: 0.6 }); h.position.y = 1.25; g.add(h);
    for (const sx of [-1, 1]) { const horn = mesh(new THREE.ConeGeometry(0.07, 0.3, 6), 0xe8e0c8, { rough: 0.4 }); horn.position.set(sx * 0.16, 1.55, 0); horn.rotation.z = -sx * 0.4; g.add(horn); const eye = glowMesh(new THREE.SphereGeometry(0.05, 6, 6), o.eye ?? 0xff5a30, 3); eye.position.set(sx * 0.1, 1.28, 0.24); g.add(eye); const arm = mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.6, 6), c, { rough: 0.6 }); arm.position.set(sx * 0.45, 0.7, 0.1); arm.rotation.z = sx * 0.3; g.add(arm); const leg = mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.4, 6), c, { rough: 0.6 }); leg.position.set(sx * 0.18, 0.2, 0); g.add(leg); }
    g.userData = { body: b, head: h };
  } else if (kind === "brute") {
    const b = mesh(new THREE.SphereGeometry(0.9, 14, 12), c, { rough: 0.8 }); b.scale.set(1, 1.05, 0.95); b.position.y = 1.4; g.add(b);
    const h = mesh(new THREE.SphereGeometry(0.42, 12, 10), c, { rough: 0.8 }); h.position.y = 2.45; g.add(h);
    for (const sx of [-1, 1]) { const eye = glowMesh(new THREE.SphereGeometry(0.07, 6, 6), o.eye ?? 0xffb030, 3); eye.position.set(sx * 0.16, 2.5, 0.36); g.add(eye); const arm = mesh(new THREE.CylinderGeometry(0.2, 0.28, 1.3, 8), c, { rough: 0.8 }); arm.position.set(sx * 1.05, 1.4, 0.15); arm.rotation.z = sx * 0.15; g.add(arm); const fist = mesh(new THREE.SphereGeometry(0.35, 8, 8), shadeMat(c), { rough: 0.8 }); fist.position.set(sx * 1.15, 0.7, 0.2); g.add(fist); const leg = mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.8, 8), c, { rough: 0.8 }); leg.position.set(sx * 0.4, 0.4, 0); g.add(leg); }
    const crack = glowMesh(new THREE.BoxGeometry(0.1, 0.9, 0.05), o.eye ?? 0xffb030, 2); crack.position.set(0, 1.5, 0.88); g.add(crack);
    g.userData = { body: b, head: h };
  } else if (kind === "shade") {
    const b = mesh(new THREE.ConeGeometry(0.5, 1.9, 12, 1, true), 0x1c1030, { rough: 0.9, opacity: 0.9, side: THREE.DoubleSide, flat: true }); b.position.y = 1.0; g.add(b);
    const h = mesh(new THREE.SphereGeometry(0.26, 12, 10), 0x0a0618, { rough: 0.9 }); h.position.y = 2.0; g.add(h);
    for (const sx of [-1, 1]) { const eye = glowMesh(new THREE.SphereGeometry(0.05, 6, 6), o.eye ?? 0xc070ff, 4); eye.position.set(sx * 0.1, 2.03, 0.22); g.add(eye); }
    const orb = sprite(o.eye ?? 0xc070ff, 1.1, 0.8); orb.position.set(0.5, 1.3, 0.4); g.add(orb);
    g.userData = { body: b, head: h, tip: orb };
  } else { // warlock boss
    const w = makeWizard({ robe: 0x5a2a80, trim: 0xd070ff, hat: 0x3a1a58, skin: 0xb8c0b0, magic: 0xd070ff, cape: 0x6a2a94 }); w.scale.setScalar(1.5); const aura = sprite(0xb048ff, 6, 0.45); aura.position.y = 1.8; w.add(aura); return w;
  }
  return g;
}
function shadeMat(c) { const k = new THREE.Color(c); k.multiplyScalar(0.75); return k.getHex(); }

// ---------- spells ----------
export const SPELLS = {
  zing: { name: "Zing", color: 0x7fd4ff, speed: 36, dmg: 11, cd: 0.26, mana: 0 },
  gale: { name: "Gale", color: 0xcfe8ff, dmg: 8, cd: 4.5, mana: 18, range: 11 },
  frost: { name: "Frostbind", color: 0x9ef0ff, speed: 27, dmg: 9, cd: 2.6, mana: 14 },
  ward: { name: "Aegis", color: 0x6fa8ff },
  star: { name: "Starfall", color: 0xffd35a, dmg: 28 },
};

export function createCombat(rig, arena, opts = {}) {
  const { scene, fx, sound } = rig;
  const power = opts.power || 1;
  const P = { pos: V(arena.start ? arena.start[0] : 0, 0, arena.start ? arena.start[1] : 0), vel: V(), yaw: 0, hp: 100 + (power - 1) * 12, maxHp: 100 + (power - 1) * 12, mana: 100, ult: 0, ward: 0, wardAge: 9, roll: 0, rollCd: 0, castT: 0, cd: { zing: 0, gale: 0, frost: 0 }, frozen: 0, stun: 0, invul: 0, alive: true, r: 0.45, grounded: true, walk: 0, hurtFlash: 0, dmgMul: 1 + (power - 1) * 0.14, kills: 0, damageTaken: 0, shotsFired: 0, shotsHit: 0, parries: 0 };
  const player = makeWizard({ robe: 0x2f46c8, trim: 0xf2c230, hat: 0x232e8a, cape: 0xc03a3a, magic: 0x8fd0ff }); scene.add(player);
  const wardMesh = mesh(new THREE.SphereGeometry(1.15, 20, 14), 0x6fa8ff, { opacity: 0.0, emissive: 0x2a60c0, ei: 1.2, cast: false, recv: false }); wardMesh.material.depthWrite = false; wardMesh.position.y = 1; scene.add(wardMesh);
  const foes = [], shots = [], meteors = [], rings = [], temp = V(), temp2 = V();
  let cam = { yaw: Math.PI, pitch: 0.2, dist: opts.camDist || 7.2, pos: V(), look: V() }, lock = null, aimPoint = V(), toast = "", toastT = 0, combo = 0;
  const api = { player: P, foes, shots, arena, cam, onFoeDead: null, onPlayerDead: null, lockTarget: () => lock, paused: false };

  function say(t, d = 1.6) { toast = t; toastT = d; }
  function center(e, out = temp) { return out.set(e.pos.x, e.pos.y + (e.cy ?? 1.05), e.pos.z); }

  // --- foes ---
  const FOES = {
    duelist: (d) => ({ r: 0.5, cy: 1.05, speed: d.speed ?? 4.2, telegraph: d.telegraph ?? 0.6, boltCd: d.boltCd ?? 1.6, aimErr: d.aimErr ?? 0.1, wardChance: d.wardChance ?? 0.2, bolt: d.bolt ?? 9, spells: d.spells || ["bolt"] }),
    imp: (d) => ({ r: 0.45, cy: 0.8, speed: d.speed ?? 5.2, melee: 6, reach: 1.5, windup: 0.45 }),
    brute: (d) => ({ r: 1.0, cy: 1.5, speed: d.speed ?? 2.6, melee: 20, reach: 2.6, windup: 0.9, slam: true }),
    shade: (d) => ({ r: 0.5, cy: 1.2, speed: d.speed ?? 3.2, telegraph: 0.75, boltCd: 2.3, aimErr: 0.16, bolt: 8, hover: true, keep: 11 }),
    warlock: (d) => ({ r: 0.9, cy: 1.5, speed: 3.6, telegraph: 0.7, boltCd: 1.4, aimErr: 0.06, bolt: 10, boss: true, wardChance: 0, keep: 12 }),
  };
  function addFoe(def) {
    const kind = def.kind || "duelist", base = FOES[kind](def);
    const model = kind === "duelist" ? makeWizard({ robe: def.robe, trim: def.trim, hat: def.hat ?? def.robe, skin: def.skin, magic: def.magic ?? 0xff8a5a, cape: def.cape }) : makeMonster(kind === "warlock" ? "warlock" : kind, { color: def.color, eye: def.eye });
    if (def.scale) model.scale.setScalar(def.scale);
    scene.add(model);
    const hpScale = 1 + (opts.hpScale || 0);
    const e = { id: Math.random(), kind, name: def.name || kind, model, pos: V(def.x || 0, 0, def.z || 0), vel: V(), yaw: 0, hp: (def.hp || 60) * hpScale, maxHp: (def.hp || 60) * hpScale, team: 1, ...base, color: def.magic ?? def.eye ?? 0xff8a5a, t: rnd(0, 2), cd: rnd(0.6, 1.4), state: "move", st: 0, aiming: 0, frozen: 0, stun: 0, ward: 0, wardAge: 9, strafe: Math.random() < 0.5 ? 1 : -1, strafeT: rnd(1, 3), dead: false, flash: 0, dmgMul: def.dmgMul || 1, wave: def.wave };
    if (def.scale) { e.r *= def.scale; e.cy *= def.scale; }
    const wm = mesh(new THREE.SphereGeometry(1.1 * (def.scale || 1) * (e.boss ? 1.3 : 1), 18, 12), 0xffa060, { opacity: 0, emissive: 0xff6020, ei: 1.2, cast: false, recv: false }); wm.material.depthWrite = false; wm.position.y = e.cy; model.add(wm); e.wardMesh = wm;
    foes.push(e); return e;
  }

  // --- projectiles ---
  function fire(from, dir, team, kind, dmg, speed, color, extra = {}) {
    const s = { pos: from.clone(), vel: dir.clone().normalize().multiplyScalar(speed), team, kind, dmg, color, life: extra.life ?? 2.2, r: extra.r ?? 0.35, node: null, owner: extra.owner || null, bounced: false, size: extra.size ?? 0.9 };
    const grp = new THREE.Group(); grp.add(sprite(color, s.size * 1.8, 0.9)); grp.add(sprite(0xffffff, s.size * 0.7, 1)); grp.position.copy(from); scene.add(grp); s.node = grp; shots.push(s); return s;
  }
  function killShot(i) { const s = shots[i]; scene.remove(s.node); s.node.traverse((o) => { if (o.material) o.material.dispose(); }); shots.splice(i, 1); }
  function wandTip(model, out) { model.userData.tip.getWorldPosition(out); return out; }

  // --- damage ---
  function hurtFoe(e, dmg, kind, dir) {
    if (e.dead) return;
    if (e.ward > 0) { sound.play("clang"); fx.burst(center(e, temp2), 0xff9a50, 8, 4, 0.4, 0.4, 0); return; }
    e.hp -= dmg; e.flash = 0.18; combo++; P.shotsHit++; P.ult = clamp(P.ult + dmg * 0.55, 0, 100);
    fx.burst(center(e, temp2), SPELLS[kind] ? SPELLS[kind].color : 0xffffff, 10, 5, 0.5, 0.5, 4); sound.play("hit");
    if (dir && !e.boss) e.vel.addScaledVector(dir, kind === "gale" ? 14 : 2.2);
    if (kind === "frost") e.frozen = 2.4;
    if (kind === "gale") e.stun = 0.9;
    if (e.hp <= 0) { e.dead = true; e.deadT = 0; P.kills++; combo = 0; fx.burst(center(e, temp2), e.color, 36, 7, 1.0, 0.8, 3); sound.play("boom"); P.ult = clamp(P.ult + 8, 0, 100); if (api.onFoeDead) api.onFoeDead(e); }
  }
  function hurtPlayer(dmg, from) {
    if (!P.alive || P.invul > 0) return false;
    if (P.ward > 0) { if (P.wardAge < 0.28) { P.parries++; P.mana = Math.min(100, P.mana + 12); P.ult = clamp(P.ult + 10, 0, 100); say("PARRY!", 0.8); return "parry"; } P.mana = Math.max(0, P.mana - dmg * 0.9); if (P.mana <= 0) { P.ward = 0; } sound.play("clang"); fx.burst(V(P.pos.x, P.pos.y + 1, P.pos.z), 0x80b0ff, 10, 4, 0.4, 0.4, 0); return "blocked"; }
    P.hp -= dmg; P.damageTaken += dmg; P.hurtFlash = 0.4; P.invul = 0.25; rig.shake = 0.7; sound.play("hurt"); fx.burst(V(P.pos.x, P.pos.y + 1, P.pos.z), 0xff4a4a, 12, 4, 0.5, 0.4, 4);
    if (from) { temp.copy(P.pos).sub(from.pos || from).setY(0).normalize(); P.vel.addScaledVector(temp, 4); }
    if (P.hp <= 0) { P.hp = 0; P.alive = false; sound.play("lose"); if (api.onPlayerDead) api.onPlayerDead(); }
    return true;
  }
  function explode(pos, radius, dmg, team, kind = "star") {
    fx.burst(pos, SPELLS[kind]?.color || 0xffb050, 40, 9, 0.9, 0.9, 2); fx.ring(pos, 0xffe090, 28, radius * 2.2, 0.5, 0.7); sound.play("boom"); rig.shake = Math.max(rig.shake, 0.9);
    if (team === 0) for (const e of foes) { if (e.dead) continue; if (center(e, temp2).distanceTo(pos) < radius + e.r) hurtFoe(e, dmg * P.dmgMul, kind, temp.copy(e.pos).sub(pos).setY(0).normalize()); }
    else if (P.alive && P.pos.distanceTo(pos) < radius + 0.4) hurtPlayer(dmg, { pos });
  }

  // --- aiming ---
  function pickLock() {
    let best = null, bd = 1e9; const fwd = temp.set(0, 0, -1).applyQuaternion(rig.camera.quaternion);
    for (const e of foes) { if (e.dead) continue; const d = center(e, temp2).sub(rig.camera.position); const dist = d.length(); if (dist > 60) continue; const ang = d.normalize().angleTo(fwd); const score = ang * 20 + dist * 0.2; if (ang < 0.9 && score < bd) { bd = score; best = e; } }
    return best;
  }
  function cycleLock() { const alive = foes.filter((e) => !e.dead); if (!alive.length) { lock = null; return; } const i = alive.indexOf(lock); lock = alive[(i + 1) % alive.length]; say("Target: " + lock.name, 0.9); }
  function aimDir(from, out) {
    const t = lock && !lock.dead ? lock : null;
    if (t) { center(t, out).sub(from); const lead = out.length() / 30; out.addScaledVector(t.vel, lead * 0.5); return out.normalize(); }
    // soft aim-assist: nearest foe within a narrow cone of the crosshair
    const fwd = temp.set(0, 0, -1).applyQuaternion(rig.camera.quaternion).clone();
    let best = null, ba = 0.28;
    for (const e of foes) { if (e.dead) continue; const d = center(e, temp2).sub(rig.camera.position).normalize(); const a = d.angleTo(fwd); if (a < ba) { ba = a; best = e; } }
    if (best) { center(best, out).sub(from); return out.normalize(); }
    aimPoint.copy(rig.camera.position).addScaledVector(fwd, 40); return out.copy(aimPoint).sub(from).normalize();
  }

  function castZing() {
    if (P.cd.zing > 0 || P.frozen > 0.5 && false) return; P.cd.zing = SPELLS.zing.cd / (P.frozen > 0 ? 0.6 : 1); P.castT = 0.25;
    const from = wandTip(player, V()), d = aimDir(from, V()); fire(from, d, 0, "zing", SPELLS.zing.dmg * P.dmgMul, SPELLS.zing.speed, SPELLS.zing.color); P.shotsFired++; sound.play("zap");
    P.yaw = Math.atan2(d.x, d.z);
  }
  function castFrost() { if (P.cd.frost > 0 || P.mana < SPELLS.frost.mana) return; P.cd.frost = SPELLS.frost.cd; P.mana -= SPELLS.frost.mana; P.castT = 0.3; const from = wandTip(player, V()), d = aimDir(from, V()); fire(from, d, 0, "frost", SPELLS.frost.dmg * P.dmgMul, SPELLS.frost.speed, SPELLS.frost.color, { size: 1.3 }); sound.play("ice"); P.yaw = Math.atan2(d.x, d.z); }
  function castGale() {
    if (P.cd.gale > 0 || P.mana < SPELLS.gale.mana) return; P.cd.gale = SPELLS.gale.cd; P.mana -= SPELLS.gale.mana; P.castT = 0.4; sound.play("gale"); rig.shake = 0.5;
    const fwd = V(Math.sin(P.yaw), 0, Math.cos(P.yaw)); const o = V(P.pos.x, 1, P.pos.z);
    fx.ring(o, 0xdff0ff, 36, 11, 0.55, 0.9); for (let i = 0; i < 24; i++) fx.emit(o.x, o.y, o.z, fwd.x * 14 + rnd(-4, 4), rnd(-1, 2), fwd.z * 14 + rnd(-4, 4), 0xcfe8ff, 0.8, 0.5, 0, 2);
    for (const e of foes) { if (e.dead) continue; temp.copy(e.pos).sub(P.pos).setY(0); const dist = temp.length(); if (dist < SPELLS.gale.range && temp.normalize().dot(fwd) > 0.2) hurtFoe(e, SPELLS.gale.dmg * P.dmgMul, "gale", temp.clone()); }
    for (let i = shots.length - 1; i >= 0; i--) { const s = shots[i]; if (s.team === 1 && s.pos.distanceTo(o) < SPELLS.gale.range) killShot(i); }
  }
  function castStar() {
    if (P.ult < 100) return; P.ult = 0; sound.play("whoosh"); say("STARFALL!", 1.1);
    const t = lock && !lock.dead ? lock.pos : (foes.find((e) => !e.dead) || { pos: P.pos }).pos;
    for (let i = 0; i < 7; i++) { const a = rnd(0, 6.28), r = i === 0 ? 0 : rnd(1.2, 4.5); meteors.push({ t: -i * 0.28, x: t.x + Math.cos(a) * r, z: t.z + Math.sin(a) * r, y: 28, state: 0 }); }
  }

  // --- foe AI ---
  function foeFire(e, spread) {
    const from = e.model.userData.tip ? wandTip(e.model, V()) : center(e, V()); const to = center({ pos: P.pos, cy: 1.05 }, V()); const d = to.sub(from);
    d.add(V(rnd(-1, 1), rnd(-0.6, 0.6), rnd(-1, 1)).multiplyScalar(d.length() * spread)); d.add(P.vel.clone().multiplyScalar(d.length() / 32 * 0.7));
    fire(from, d, 1, "bolt", e.bolt * e.dmgMul, 22 + (e.boss ? 4 : 0), e.color, { size: 1.0 }); sound.play("zap");
  }
  function updateFoe(e, dt) {
    e.t += dt; if (e.flash > 0) e.flash -= dt; if (e.ward > 0) { e.ward -= dt; e.wardAge += dt; }
    if (e.dead) { e.deadT += dt; e.model.scale.multiplyScalar(1 - dt * 1.6); e.model.position.y -= dt * 0.4; if (e.deadT > 0.55) { scene.remove(e.model); e.model.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); foes.splice(foes.indexOf(e), 1); if (lock === e) lock = null; } return; }
    const slow = e.frozen > 0 ? 0.35 : 1; if (e.frozen > 0) e.frozen -= dt; if (e.stun > 0) { e.stun -= dt; e.vel.multiplyScalar(0.9); }
    const toP = temp.copy(P.pos).sub(e.pos).setY(0), dist = toP.length(), face = Math.atan2(toP.x, toP.z); toP.normalize();
    const moving = V();
    if (e.stun <= 0 && P.alive) {
      if (e.melee) { // imps & brutes: chase, wind up, strike
        if (e.state === "move") { if (dist > e.reach * 0.85) moving.copy(toP).multiplyScalar(e.speed * slow); else { e.state = "wind"; e.st = e.windup / (slow > 0.9 ? 1 : 0.6); } }
        else if (e.state === "wind") { e.st -= dt; e.aiming = 1 - e.st / e.windup; if (e.st <= 0) { if (dist < e.reach + 0.6 || e.slam && dist < e.reach + 2) { if (e.slam) { const p = V(e.pos.x + toP.x * 1.5, 0.1, e.pos.z + toP.z * 1.5); fx.ring(p, 0xffb060, 30, 6, 0.5, 0.8); fx.burst(p, 0xffa040, 18, 5, 0.6, 0.7, 6); rig.shake = 0.8; sound.play("boom"); if (P.pos.distanceTo(e.pos) < e.reach + 2.4) hurtPlayer(e.melee * e.dmgMul, e); } else { sound.play("punch"); hurtPlayer(e.melee * e.dmgMul, e); } } e.state = "move"; e.aiming = 0; e.cdMelee = 0.6; } }
      } else { // ranged wizards, shades, warlock
        e.strafeT -= dt; if (e.strafeT <= 0) { e.strafe = -e.strafe; e.strafeT = rnd(1.2, 3.2); }
        const want = e.keep || (e.kind === "duelist" ? 8.5 : 9); let fwdMove = (dist - want) * 0.5; fwdMove = clamp(fwdMove, -1, 1);
        const side = V(-toP.z, 0, toP.x).multiplyScalar(e.strafe);
        if (e.state !== "aim") moving.copy(toP).multiplyScalar(fwdMove).addScaledVector(side, 0.8).normalize().multiplyScalar(e.speed * slow);
        e.cd -= dt * slow;
        if (e.state === "move" && e.cd <= 0) {
          if (e.boss) { const r = Math.random(); e.state = "aim"; e.st = e.telegraph; e.pattern = r < 0.35 ? "ring" : r < 0.6 ? "summon" : "bolt"; if (e.pattern === "summon" && foes.filter((f) => !f.dead && f.kind === "imp").length > 5) e.pattern = "bolt"; }
          else { e.state = "aim"; e.st = e.telegraph * (e.frozen > 0 ? 1.6 : 1); e.pattern = "bolt"; }
        } else if (e.state === "aim") {
          e.st -= dt * slow; e.aiming = 1 - Math.max(0, e.st) / e.telegraph; moving.multiplyScalar(0);
          if (e.st <= 0) { e.state = "move"; e.aiming = 0; e.cd = e.boltCd * rnd(0.8, 1.3);
            if (e.pattern === "ring") { const n = 14, o = center(e, V()); for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + e.t; fire(o, V(Math.cos(a), 0, Math.sin(a)), 1, "bolt", 7 * e.dmgMul, 11, e.color, { size: 0.9 }); } sound.play("cast"); }
            else if (e.pattern === "summon") { for (let i = 0; i < 2; i++) { const a = rnd(0, 6.28); const imp = addFoe({ kind: "imp", name: "Cinder Imp", x: e.pos.x + Math.cos(a) * 3, z: e.pos.z + Math.sin(a) * 3, hp: 24, color: 0x6a3a5a, eye: 0xd070ff }); fx.burst(V(imp.pos.x, 1, imp.pos.z), 0xd070ff, 20, 5, 0.6, 0.6, 0); } sound.play("cast"); }
            else { const n = e.boss ? 3 : 1; for (let i = 0; i < n; i++) setTimeout(() => { if (!e.dead && P.alive && !api.paused) foeFire(e, e.aimErr + i * 0.02); }, i * 140); }
          }
        }
        // sometimes raise a ward when a bolt is about to hit (duelists only)
        if (e.wardChance && e.ward <= 0 && Math.random() < dt * e.wardChance * 2) { for (const s of shots) { if (s.team === 0 && s.pos.distanceTo(e.pos) < 7) { e.ward = 0.9; e.wardAge = 0; sound.play("ward"); break; } } }
      }
    }
    e.vel.x = lerp(e.vel.x, moving.x, 1 - Math.exp(-dt * 6)); e.vel.z = lerp(e.vel.z, moving.z, 1 - Math.exp(-dt * 6));
    e.pos.x += e.vel.x * dt; e.pos.z += e.vel.z * dt; arena.collide(e.pos, e.r);
    for (const o of foes) { if (o === e || o.dead) continue; const dx = e.pos.x - o.pos.x, dz = e.pos.z - o.pos.z, d = Math.hypot(dx, dz), m = e.r + o.r; if (d < m && d > 0.001) { e.pos.x += (dx / d) * (m - d) * 0.5; e.pos.z += (dz / d) * (m - d) * 0.5; } }
    if (dist < e.r + P.r) { const k = (e.r + P.r - dist); P.pos.x -= toP.x * k * 0.5; P.pos.z -= toP.z * k * 0.5; }
    e.yaw += angDiff(e.yaw, face) * Math.min(1, dt * 8);
    // look
    const m = e.model; m.position.set(e.pos.x, e.dead ? m.position.y : (e.hover ? 0.35 + Math.sin(e.t * 2) * 0.2 : 0), e.pos.z); m.rotation.y = e.yaw;
    const sp = Math.hypot(e.vel.x, e.vel.z), ud = m.userData;
    if (ud.body && ud.arm) { ud.body.position.y = Math.abs(Math.sin(e.t * 9)) * 0.06 * Math.min(1, sp / 3); ud.body.rotation.z = Math.sin(e.t * 6) * 0.03 * Math.min(1, sp / 3); ud.arm.rotation.x = e.state === "aim" ? -1.2 - e.aiming * 0.3 : -0.2 + Math.sin(e.t * 3) * 0.05; if (ud.glow) { ud.glow.scale.setScalar(0.5 + (e.state === "aim" ? e.aiming * 2.2 : 0)); } if (ud.cape) ud.cape.rotation.x = 0.2 + Math.min(0.8, sp * 0.1); }
    else if (ud.body) { ud.body.rotation.z = Math.sin(e.t * 8) * 0.05 * Math.min(1, sp / 2) + (e.state === "wind" ? 0 : 0); m.scale.y = 1 + (e.state === "wind" ? -0.18 * e.aiming : 0) + Math.sin(e.t * 10) * 0.02 * Math.min(1, sp / 3); if (ud.tip) { ud.tip.scale.setScalar(1.1 + (e.state === "aim" ? e.aiming * 2 : 0)); } }
    const tint = e.flash > 0 ? 1.0 : 0; m.traverse((o) => { if (o.material && o.material.emissive && o.material !== e.wardMesh.material && !o.material.userData.glow) { if (o.material.userData.e0 === undefined) o.material.userData.e0 = o.material.emissive.getHex(); o.material.emissive.setHex(tint ? 0xffffff : o.material.userData.e0); o.material.emissiveIntensity = tint ? 0.6 : o.material.emissiveIntensity; } });
    e.wardMesh.material.opacity = e.ward > 0 ? 0.28 + Math.sin(e.t * 20) * 0.05 : 0; if (e.frozen > 0) { if (Math.random() < 0.3) fx.spark(center(e, temp2), 0x9ef0ff, 0.4, 0.5, 1.2); }
  }

  // --- player ---
  function updatePlayer(dt) {
    const k = rig.keys, pr = rig.pressed;
    P.t = (P.t || 0) + dt;
    for (const c of Object.keys(P.cd)) P.cd[c] = Math.max(0, P.cd[c] - dt);
    P.invul = Math.max(0, P.invul - dt); P.hurtFlash = Math.max(0, P.hurtFlash - dt); P.castT = Math.max(0, P.castT - dt); P.rollCd = Math.max(0, P.rollCd - dt);
    if (P.frozen > 0) P.frozen -= dt; if (P.stun > 0) P.stun -= dt;
    // camera
    cam.yaw -= rig.mouse.dx * 0.0032; cam.pitch = clamp(cam.pitch + rig.mouse.dy * 0.0026, -0.15, 0.95);
    const kx = (k.has("ArrowLeft") ? 1 : 0) - (k.has("ArrowRight") ? 1 : 0); cam.yaw += kx * dt * 2.2 + ((k.has("KeyQ") ? 1 : 0) - (k.has("KeyE") ? 1 : 0)) * dt * 2.2;
    cam.pitch = clamp(cam.pitch + ((k.has("ArrowDown") ? 1 : 0) - (k.has("ArrowUp") ? 1 : 0)) * dt * 1.4, -0.15, 0.95);
    if (pr.has("Tab") || pr.has("KeyT")) { if (lock) cycleLock(); else { lock = pickLock(); if (lock) say("Target: " + lock.name, 0.9); } }
    if (lock && lock.dead) lock = null;
    if (lock) { const d = center(lock, temp).sub(P.pos); const want = Math.atan2(-d.x, -d.z); cam.yaw += angDiff(cam.yaw, want) * Math.min(1, dt * 3.5); }
    if (pr.has("KeyF") && lock === null) lock = pickLock();
    // movement
    if (P.alive && P.stun <= 0) {
      let fx_ = (k.has("KeyW") ? 1 : 0) - (k.has("KeyS") ? 1 : 0), sx = (k.has("KeyD") ? 1 : 0) - (k.has("KeyA") ? 1 : 0);
      const fwd = V(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)), rt = V(-fwd.z, 0, fwd.x);
      const wish = V().addScaledVector(fwd, fx_).addScaledVector(rt, sx);
      const sprint = k.has("ShiftLeft") || k.has("ShiftRight");
      const sp = (sprint ? 7.8 : 5.6) * (P.frozen > 0 ? 0.45 : 1) * (P.ward > 0 ? 0.6 : 1);
      if (wish.lengthSq() > 0) wish.normalize();
      if (P.roll > 0) { P.roll -= dt; P.vel.x = P.rollDir.x * 12; P.vel.z = P.rollDir.z * 12; P.invul = Math.max(P.invul, 0.1); }
      else { P.vel.x = lerp(P.vel.x, wish.x * sp, 1 - Math.exp(-dt * 12)); P.vel.z = lerp(P.vel.z, wish.z * sp, 1 - Math.exp(-dt * 12)); }
      if (pr.has("Space") && P.rollCd <= 0 && P.roll <= 0) { P.rollDir = wish.lengthSq() > 0 ? wish.clone() : V(Math.sin(P.yaw), 0, Math.cos(P.yaw)); P.roll = 0.32; P.rollCd = 0.9; P.invul = 0.38; sound.play("whoosh"); fx.burst(V(P.pos.x, 0.3, P.pos.z), 0xb0c0d0, 8, 3, 0.4, 0.5, 0); }
      if (!lock && wish.lengthSq() > 0 && P.castT <= 0 && P.roll <= 0) P.yaw += angDiff(P.yaw, Math.atan2(wish.x, wish.z)) * Math.min(1, dt * 12);
      if (lock) { const d = center(lock, temp).sub(P.pos); P.yaw += angDiff(P.yaw, Math.atan2(d.x, d.z)) * Math.min(1, dt * 14); }
      else if (rig.mouse.left || P.castT > 0) { const cf = V(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)); P.yaw += angDiff(P.yaw, Math.atan2(cf.x, cf.z)) * Math.min(1, dt * 16); }
      P.pos.x += P.vel.x * dt; P.pos.z += P.vel.z * dt; arena.collide(P.pos, P.r);
      P.walk += Math.hypot(P.vel.x, P.vel.z) * dt;
      // spells
      if ((rig.mouse.left || k.has("KeyJ")) && P.roll <= 0) castZing();
      if (pr.has("Digit1")) castZing(); if (pr.has("Digit2") || pr.has("KeyC")) castGale(); if (pr.has("Digit3") || rig.mouse.clickR && false || pr.has("KeyX")) castFrost(); if (pr.has("KeyR") || pr.has("Digit4") && false) castStar();
      const wantWard = rig.mouse.right || k.has("KeyV") || k.has("KeyG");
      if (wantWard && P.mana > 4) { if (P.ward <= 0) { P.wardAge = 0; sound.play("ward"); } P.ward = 0.12; P.mana -= dt * 14; } else P.ward = Math.max(0, P.ward - dt);
      P.wardAge += dt; P.mana = clamp(P.mana + dt * (P.ward > 0 ? 0 : 7), 0, 100);
    }
    P.vel.multiplyScalar(0.999);
    const sp = Math.hypot(P.vel.x, P.vel.z), ud = player.userData;
    player.position.set(P.pos.x, 0, P.pos.z); player.rotation.y = P.yaw;
    ud.body.position.y = Math.abs(Math.sin(P.walk * 1.7)) * 0.07 * Math.min(1, sp / 4); ud.body.rotation.z = Math.sin(P.walk * 1.7) * 0.04 * Math.min(1, sp / 4);
    ud.body.rotation.x = P.roll > 0 ? 0.9 : Math.min(0.25, sp * 0.03); ud.arm.rotation.x = P.castT > 0 ? -1.15 - P.castT * 1.2 : -0.35 + Math.sin(P.walk * 1.7) * 0.1; ud.cape.rotation.x = 0.15 + Math.min(0.9, sp * 0.1);
    ud.glow.scale.setScalar(0.45 + (P.castT > 0 ? 1.2 : 0) + Math.sin(P.t * 8) * 0.04);
    player.visible = P.alive; wardMesh.position.set(P.pos.x, 1, P.pos.z); wardMesh.material.opacity = P.ward > 0 ? 0.24 + Math.sin(P.t * 22) * 0.05 + (P.wardAge < 0.28 ? 0.2 : 0) : 0;
    // camera follow
    const target = V(P.pos.x, 1.7, P.pos.z), off = V(Math.sin(cam.yaw) * Math.cos(cam.pitch), Math.sin(cam.pitch), Math.cos(cam.yaw) * Math.cos(cam.pitch)).multiplyScalar(cam.dist);
    const side = V(Math.cos(cam.yaw), 0, -Math.sin(cam.yaw)).multiplyScalar(1.0); target.addScaledVector(side, 1.6);
    const desired = target.clone().add(off); if (arena.camClamp) arena.camClamp(desired); desired.y = Math.max(0.6, desired.y);
    cam.pos.lerp(desired, 1 - Math.exp(-dt * 14)); rig.camera.position.copy(cam.pos);
    const lookAt = V(P.pos.x, 1.5, P.pos.z).addScaledVector(side, 0.5).add(V(-Math.sin(cam.yaw), 0, -Math.cos(cam.yaw)).multiplyScalar(4)); lookAt.y = 1.6 - Math.sin(cam.pitch) * 2.2; rig.camera.lookAt(lookAt);
  }

  function updateShots(dt) {
    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i]; s.life -= dt; s.pos.addScaledVector(s.vel, dt); s.node.position.copy(s.pos);
      fx.spark(s.pos, s.color, 0.5, 0.3, 0.4);
      let dead = s.life <= 0 || !arena.inside(s.pos);
      if (arena.blocks && arena.blocks(s.pos)) { dead = true; fx.burst(s.pos, s.color, 6, 3, 0.3, 0.4, 2); }
      if (!dead && s.team === 0) { for (const e of foes) { if (e.dead) continue; if (center(e, temp).distanceTo(s.pos) < e.r + s.r + 0.2) { if (e.ward > 0 && e.wardAge < 0.3 && e.kind === "duelist" && !s.bounced) { s.vel.negate(); s.team = 1; s.bounced = true; s.color = e.color; sound.play("clang"); continue; } hurtFoe(e, s.dmg, s.kind, s.vel.clone().normalize()); dead = true; break; } } }
      else if (!dead && P.alive) { temp.set(P.pos.x, P.pos.y + 1, P.pos.z); if (temp.distanceTo(s.pos) < P.r + s.r + 0.35) { const r = hurtPlayer(s.dmg, { pos: s.pos }); if (r === "parry") { s.vel.negate().multiplyScalar(1.5); s.team = 0; s.dmg *= 2.2; s.kind = "zing"; s.bounced = true; sound.play("clang"); fx.ring(s.pos, 0xffe080, 18, 4, 0.4, 0.6); } else dead = true; } }
      if (dead) { if (s.life > 0) fx.burst(s.pos, s.color, 6, 3, 0.3, 0.4, 0); killShot(i); }
    }
  }
  function updateMeteors(dt) {
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i]; m.t += dt; if (m.t < 0) continue;
      if (m.state === 0) { m.state = 1; const g = new THREE.Group(); g.add(sprite(0xffd35a, 3.4, 1)); g.add(sprite(0xffffff, 1.4, 1)); g.position.set(m.x, m.y, m.z); scene.add(g); m.node = g; const ring = mesh(new THREE.RingGeometry(2.6, 3.4, 32), 0xffd35a, { emissive: 0xffa020, ei: 1.6, opacity: 0.55, cast: false, recv: false, side: THREE.DoubleSide }); ring.rotation.x = -Math.PI / 2; ring.position.set(m.x, 0.06, m.z); scene.add(ring); m.ring = ring; rings.push(ring); }
      m.y -= (m.t < 0.45 ? 0 : 60) * dt; if (m.node) { m.node.position.y = Math.max(m.y, 0.5); fx.spark(m.node.position, 0xffb050, 1.1, 0.5, 0.8); }
      if (m.y <= 0.7) { explode(V(m.x, 0.6, m.z), 3.4, SPELLS.star.dmg, 0, "star"); scene.remove(m.node); scene.remove(m.ring); meteors.splice(i, 1); }
    }
  }

  api.addFoe = addFoe; api.say = say; api.hurtPlayer = hurtPlayer; api.explode = explode; api.center = center; api.fire = fire;
  api.fx = fx; api.cycleLock = cycleLock;
  api.update = function (dt) {
    if (api.paused) return;
    if (toastT > 0) toastT -= dt;
    updatePlayer(dt); for (const e of [...foes]) updateFoe(e, dt); updateShots(dt); updateMeteors(dt);
  };
  api.snapshot = function () {
    const t = lock && !lock.dead ? lock : null;
    return { hp: P.hp, maxHp: P.maxHp, mana: P.mana, ult: P.ult, cd: { ...P.cd }, ward: P.ward > 0, roll: P.rollCd, hurt: P.hurtFlash, toast: toastT > 0 ? toast : "", alive: P.alive, foes: foes.filter((e) => !e.dead).length,
      target: t ? { name: t.name, hp: t.hp, max: t.maxHp, frozen: t.frozen > 0 } : null, kills: P.kills, combo, ready: { gale: P.cd.gale <= 0 && P.mana >= SPELLS.gale.mana, frost: P.cd.frost <= 0 && P.mana >= SPELLS.frost.mana, star: P.ult >= 100 } };
  };
  api.reset = function () { P.hp = P.maxHp; P.mana = 100; P.alive = true; P.ult = 0; P.pos.set(arena.start ? arena.start[0] : 0, 0, arena.start ? arena.start[1] : 0); P.vel.set(0, 0, 0); P.ward = 0; P.invul = 1; for (const c of Object.keys(P.cd)) P.cd[c] = 0; };
  api.setLock = (e) => { lock = e; };
  api.dispose = function () { while (shots.length) killShot(shots.length - 1); for (const e of foes) { scene.remove(e.model); } foes.length = 0; scene.remove(player); scene.remove(wardMesh); for (const r of rings) scene.remove(r); };
  cam.yaw = arena.camYaw ?? Math.PI; return api;
}
