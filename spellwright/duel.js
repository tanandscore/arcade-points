"use client";
import { THREE, clearScene, mesh, glowMesh, rnd } from "@/threeplay/core";
import { createCombat } from "./combat";
import { torch, pillar, makeCastle, runeFloor, stoneTexture } from "./scenery";

export const RANKS = [
  { name: "Pip Larkin", title: "First-year apprentice", robe: 0x3a9a5a, trim: 0xd8f0a0, hp: 45, speed: 3.0, telegraph: 1.0, boltCd: 2.6, aimErr: 0.24, wardChance: 0, tip: "Hold the left mouse button to fire Zing. Keep moving and sidestep the glowing orb." },
  { name: "Nessa Quill", title: "Library prefect", robe: 0x8a4ab8, trim: 0xf0d0ff, hp: 60, speed: 3.6, telegraph: 0.85, boltCd: 2.1, aimErr: 0.18, wardChance: 0.05, tip: "Press 3 to freeze her with Frostbind, then hit her while she is slow." },
  { name: "Dorian Flint", title: "Sparring champion", robe: 0xc86a2a, trim: 0xffe0a0, hp: 80, speed: 4.2, telegraph: 0.75, boltCd: 1.8, aimErr: 0.15, wardChance: 0.15, tip: "Hold the right mouse button as a bolt lands to PARRY it back at double power." },
  { name: "The Bellwether Twins", title: "Two against one", robe: 0x2a8aa8, trim: 0xc0f0ff, hp: 52, speed: 4.0, telegraph: 0.8, boltCd: 2.0, aimErr: 0.17, wardChance: 0.1, count: 2, tip: "Two of them! Press Tab to switch targets, and use Gale (2) to blast both away." },
  { name: "Sister Ashgrove", title: "Warden of the west tower", robe: 0x5a5a6a, trim: 0xff8a60, hp: 105, speed: 4.4, telegraph: 0.65, boltCd: 1.5, aimErr: 0.12, wardChance: 0.35, tip: "She guards a lot. Bait the ward out, then freeze her and hit hard." },
  { name: "Captain Redmantle", title: "Duel Club captain", robe: 0xb02a3a, trim: 0xffd35a, hp: 135, speed: 5.0, telegraph: 0.55, boltCd: 1.25, aimErr: 0.09, wardChance: 0.3, tip: "Fast and sharp. Dodge-roll with Space the moment you see her wand glow." },
  { name: "Archwizard Morvane", title: "Headmaster's rival", robe: 0x2a1a44, trim: 0xb048ff, hp: 250, speed: 4.6, telegraph: 0.5, boltCd: 1.4, aimErr: 0.07, wardChance: 0, boss: true, tip: "He fires volleys, rings of sparks and calls shades. Charge Starfall by landing hits, then press R." },
];

export function createDuel(rig, ctx) {
  clearScene(rig);
  const { scene } = rig; rig.setSky({ zenith: 0x080b22, mid: 0x1c2a58, horizon: 0x8a5a7a, sunDir: [-0.5, 0.12, -0.8], sunColor: 0xffc890, sunSize: 0.0, glow: 0.7, cloud: 0.55, cloudColor: 0x6a6a9a, cloudShade: 0x14183a, stars: 1.3 });
  scene.fog = new THREE.FogExp2(0x2a2a50, 0.0085);
  scene.add(new THREE.HemisphereLight(0x9ab0f0, 0x4a3a50, 1.7));
  const moon = new THREE.DirectionalLight(0xb8c8ff, 2.2); moon.position.set(-25, 40, -20); moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); const sc = moon.shadow.camera; sc.left = sc.bottom = -30; sc.right = sc.top = 30; sc.near = 5; sc.far = 120; moon.shadow.bias = -0.0004; scene.add(moon);
  const R = 21, rank = RANKS[ctx.rank];
  const floor = runeFloor(R + 4, 0x6fa8ff); scene.add(floor);
  const ring = mesh(new THREE.TorusGeometry(R + 3.8, 0.5, 8, 64), 0x6a6a78, { map: stoneTexture("#8a8a96", "#4a4a56", 12, 1), rough: 0.9 }); ring.rotation.x = Math.PI / 2; ring.position.y = 0.2; scene.add(ring);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 32), new THREE.MeshStandardMaterial({ color: 0x1a2430, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.15; ground.receiveShadow = true; scene.add(ground);
  const castle = makeCastle(3); castle.position.set(-170, -0.1, -260); castle.scale.setScalar(2.2); castle.rotation.y = 0.5; scene.add(castle);
  const castle2 = makeCastle(7); castle2.position.set(190, -0.1, -60); castle2.scale.setScalar(1.1); castle2.rotation.y = -1.2; scene.add(castle2);
  const blockers = [], torches = [];
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2, x = Math.cos(a) * 24.5, z = Math.sin(a) * 24.5; const p = pillar(8 + (i % 3), 0.8); p.position.set(x, 0, z); scene.add(p); blockers.push({ x, z, r: 1.15 }); if (i % 3 === 0) { const t = torch(0xffa040, true, 16, 22); t.position.set(Math.cos(a + 0.1) * 23.2, 0, Math.sin(a + 0.1) * 23.2); scene.add(t); torches.push(t); } else { const t = torch(0x80b0ff, false); t.position.set(Math.cos(a + 0.1) * 23.2, 0, Math.sin(a + 0.1) * 23.2); scene.add(t); torches.push(t); } }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.26; const arch = mesh(new THREE.TorusGeometry(2.2, 0.28, 6, 14, Math.PI), 0x8a8a96, { rough: 0.9 }); arch.position.set(Math.cos(a) * 26.5, 5, Math.sin(a) * 26.5); arch.rotation.y = -a + Math.PI / 2; scene.add(arch); }
  const mist = new THREE.Mesh(new THREE.CircleGeometry(60, 24), new THREE.MeshBasicMaterial({ color: 0x4a5a9a, transparent: true, opacity: 0.08, depthWrite: false })); mist.rotation.x = -Math.PI / 2; mist.position.y = 0.4; scene.add(mist);

  const arena = {
    start: [0, 9], camYaw: 0,
    collide(p, r) {
      const d = Math.hypot(p.x, p.z), lim = R - 0.6 - r; if (d > lim) { p.x *= lim / d; p.z *= lim / d; }
      for (const b of blockers) { const dx = p.x - b.x, dz = p.z - b.z, dd = Math.hypot(dx, dz), m = b.r + r; if (dd < m && dd > 0.001) { p.x = b.x + (dx / dd) * m; p.z = b.z + (dz / dd) * m; } }
    },
    inside: (p) => Math.hypot(p.x, p.z) < 40 && p.y > -1 && p.y < 30,
    blocks(p) { if (p.y > 9 || p.y < 0) return false; for (const b of blockers) if (Math.hypot(p.x - b.x, p.z - b.z) < b.r) return true; return false; },
    camClamp(c) { const d = Math.hypot(c.x, c.z); if (d > 22.6) { c.x *= 22.6 / d; c.z *= 22.6 / d; } c.y = Math.min(c.y, 12); },
  };
  const combat = createCombat(rig, arena, { power: ctx.power, camDist: 6.6 });
  const n = rank.count || 1; const foesAt = [];
  for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.8; foesAt.push(combat.addFoe({ kind: "duelist", name: n > 1 ? (i ? "Wren Bellwether" : "Ash Bellwether") : rank.name, x: Math.cos(a) * 12, z: Math.sin(a) * 12 - 0, hp: rank.hp, speed: rank.speed, telegraph: rank.telegraph, boltCd: rank.boltCd, aimErr: rank.aimErr, wardChance: rank.wardChance, robe: rank.robe + i * 0x101010, trim: rank.trim, magic: 0xff8a5a, scale: rank.boss ? 1.25 : 1, bolt: 9 + ctx.rank * 1.2, dmgMul: 1 })); }
  if (rank.boss) { const m = foesAt[0]; m.boss = true; m.keep = 12; m.cd = 2; }
  combat.setLock(foesAt[0]);

  const st = { phase: "intro", t: 0, time: 0, over: false, endT: 0, msg: "" };
  const out = {
    combat, state: st, rank,
    update(dt, time) {
      for (const t of torches) t.userData.tick(time, t.position.x);
      st.t += dt;
      if (st.phase === "intro") { combat.paused = false; const c = 3 - st.t; st.msg = c > 0 ? String(Math.ceil(c)) : "DUEL!"; combat.player.invul = 1; for (const e of combat.foes) e.cd = Math.max(e.cd, 1.2); if (st.t > 3) { st.msg = "DUEL!"; } if (st.t > 3.7) { st.phase = "fight"; st.msg = ""; } }
      else if (st.phase === "fight") { st.time += dt; if (!combat.foes.some((e) => !e.dead)) { st.phase = "won"; st.endT = 0; combat.player.invul = 99; combat.say("VICTORY!", 3); rig.sound.play("win"); } else if (!combat.player.alive) { st.phase = "lost"; st.endT = 0; } }
      else { st.msg = ""; st.endT += dt; if (st.endT > 2.4 && !st.over) { st.over = true; const p = combat.player; ctx.onEnd(st.phase === "won", { time: st.time, hp: p.hp, maxHp: p.maxHp, taken: p.damageTaken, parries: p.parries, kills: p.kills }); } }
      combat.update(dt);
    },
    snapshot() { return { ...combat.snapshot(), kind: "duel", phase: st.phase, msg: st.msg, time: st.time, tip: st.phase === "intro" ? rank.tip : "", title: rank.name, sub: rank.title }; },
    dispose() { combat.dispose(); },
  };
  return out;
}
