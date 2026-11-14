"use client";
import { THREE, clearScene, mesh, glowMesh, sprite, rnd, clamp, floorTexture, stoneTexture } from "@/threeplay/core";
import { createCombat } from "./combat";
import { torch, pillar } from "./scenery";

export const FLOORS = [
  { name: "The Undercroft", sub: "Cold stone and restless bones", wall: "#6e7a9a", floor: ["#52586a", "#434858"], fog: 0x0a1020, torch: 0xffa040, glow: 0x6fa8ff, hemi: 0x6070a0 },
  { name: "Mossy Catacombs", sub: "Green damp and hungry things", wall: "#5a7a62", floor: ["#46584a", "#37483c"], fog: 0x08140c, torch: 0xa0ff80, glow: 0x80ff9a, hemi: 0x507a58 },
  { name: "Ember Vaults", sub: "Heat, ash and slow giants", wall: "#8a5a4a", floor: ["#5a4040", "#4a3232"], fog: 0x1c0806, torch: 0xff7030, glow: 0xff9050, hemi: 0x8a5040 },
  { name: "The Void Sanctum", sub: "The warlock waits below", wall: "#6a5a8a", floor: ["#3e3454", "#30284a"], fog: 0x0c0818, torch: 0xc070ff, glow: 0xd070ff, hemi: 0x6a50a0 },
];
const RW = 26, RD = 22, CW = 5, CL = 9;

export function createCrypt(rig, ctx) {
  clearScene(rig); const { scene } = rig, th = FLOORS[ctx.floor], f = ctx.floor;
  rig.setSky({ zenith: 0x000000, mid: 0x000000, horizon: 0x000000, sunSize: 0, glow: 0, cloud: 0 });
  scene.background = new THREE.Color(th.fog); scene.fog = new THREE.FogExp2(th.fog, 0.022);
  scene.add(new THREE.HemisphereLight(th.hemi, 0x302830, 2.4));
  const wallTex = stoneTexture(th.wall, "#2a2a34", 5, 2), floorTex = floorTexture(th.floor[0], th.floor[1], RW / 4, RD / 4);
  const rooms = [], blockers = [], torches = [], gates = [], pickups = [];
  const rects = []; // walkable
  const roomCount = 3;
  for (let i = 0; i < roomCount; i++) {
    const z0 = i * (RD + CL), r = { i, x0: -RW / 2, x1: RW / 2, z0, z1: z0 + RD, cz: z0 + RD / 2, state: "idle", spawned: false };
    rooms.push(r); rects.push({ x0: r.x0, x1: r.x1, z0: r.z0, z1: r.z1, open: true });
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), new THREE.MeshStandardMaterial({ map: floorTex.clone(), roughness: 0.85 })); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0, r.cz); fl.receiveShadow = false; scene.add(fl);
    const ce = new THREE.Mesh(new THREE.PlaneGeometry(RW, RD), new THREE.MeshStandardMaterial({ color: 0x15151c, roughness: 1 })); ce.rotation.x = Math.PI / 2; ce.position.set(0, 11, r.cz); scene.add(ce);
    const wallM = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9, color: 0xcfcfd8 });
    const wall = (w, d, x, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 11, d), wallM); m.position.set(x, 5.5, z); scene.add(m); };
    wall(1, RD, -RW / 2 - 0.5, r.cz); wall(1, RD, RW / 2 + 0.5, r.cz);
    const gapW = CW + 1, sideW = (RW - gapW) / 2;
    for (const zz of [r.z0 - 0.5, r.z1 + 0.5]) { const first = zz < 0 || (zz === r.z0 - 0.5 && i === 0), last = zz === r.z1 + 0.5 && i === roomCount - 1; if (zz === r.z0 - 0.5 && i === 0 || zz === r.z1 + 0.5 && i === roomCount - 1) { wall(RW + 2, 1, 0, zz); } else { wall(sideW, 1, -RW / 2 + sideW / 2, zz); wall(sideW, 1, RW / 2 - sideW / 2, zz); const lintel = new THREE.Mesh(new THREE.BoxGeometry(gapW, 5, 1), wallM); lintel.position.set(0, 8.5, zz); scene.add(lintel); } }
    // pillars
    const spots = [[-8, 5], [8, 5], [-8, -5], [8, -5]]; spots.forEach(([x, z], k) => { if ((i + k) % 2 === 0 || i === 1) { const p = pillar(10.5, 0.8); p.position.set(x, 0, r.cz + z); scene.add(p); blockers.push({ x, z: r.cz + z, r: 1.2 }); } });
    // torches
    for (const [x, z] of [[-RW / 2 + 1.2, -6], [RW / 2 - 1.2, -6], [-RW / 2 + 1.2, 6], [RW / 2 - 1.2, 6]]) { const lit = Math.abs(z) === 6 && (x < 0 === z < 0); const t = torch(th.torch, lit, 18, 24); t.position.set(x, 0, r.cz + z); scene.add(t); torches.push(t); }
    // dressing: sarcophagi, bones
    for (let k = 0; k < 4; k++) { const sx = (k % 2 ? 1 : -1) * (RW / 2 - 2.2), sz = r.cz + (k < 2 ? -1 : 1) * rnd(0, 3) + (k < 2 ? 0 : 0); if (k === 1 || k === 2) continue; const sc = mesh(new THREE.BoxGeometry(2.2, 1.1, 4.4), 0x7a7a86, { map: wallTex, rough: 0.9 }); sc.position.set(sx, 0.55, r.cz + rnd(-8, 8)); sc.rotation.y = rnd(-0.15, 0.15); scene.add(sc); blockers.push({ x: sc.position.x, z: sc.position.z, r: 1.7 }); }
    for (let k = 0; k < 9; k++) { const b = mesh(new THREE.CapsuleGeometry(0.06, 0.5, 3, 5), 0xd8d0b8, { rough: 0.9 }); b.position.set(rnd(-RW / 2 + 2, RW / 2 - 2), 0.08, r.cz + rnd(-RD / 2 + 2, RD / 2 - 2)); b.rotation.set(Math.PI / 2, 0, rnd(0, 6)); scene.add(b); }
    // crystals
    for (let k = 0; k < 2; k++) { const cx = (k ? 1 : -1) * rnd(8, 11), cz = r.cz + rnd(-8, 8); const cr = glowMesh(new THREE.OctahedronGeometry(0.4), th.glow, 2.4); cr.position.set(cx, 1.1, cz); scene.add(cr); const gl = sprite(th.glow, 2.2, 0.7); gl.position.copy(cr.position); scene.add(gl); pickups.push({ kind: "crystal", node: cr, glow: gl, x: cx, z: cz, got: false }); }
  }
  for (let i = 0; i < roomCount - 1; i++) {
    const z0 = rooms[i].z1, z1 = rooms[i + 1].z0, cz = (z0 + z1) / 2, rect = { x0: -CW / 2, x1: CW / 2, z0, z1, open: false }; rects.push(rect);
    const wallM = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9, color: 0xcfcfd8 });
    for (const sx of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(1, 11, CL), wallM); m.position.set(sx * (CW / 2 + 0.5), 5.5, cz); scene.add(m); }
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(CW, CL), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 })); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0, cz); scene.add(fl);
    const ce = new THREE.Mesh(new THREE.PlaneGeometry(CW, CL), new THREE.MeshStandardMaterial({ color: 0x15151c })); ce.rotation.x = Math.PI / 2; ce.position.set(0, 7, cz); scene.add(ce);
    const gate = new THREE.Group(); const bars = glowMesh(new THREE.BoxGeometry(CW, 8, 0.3), th.glow, 1.2); bars.material.transparent = true; bars.material.opacity = 0.35; gate.add(bars); for (let k = -2; k <= 2; k++) { const b = glowMesh(new THREE.BoxGeometry(0.12, 8, 0.12), th.glow, 3); b.position.x = k; gate.add(b); } gate.position.set(0, 4, z0 + 0.4); scene.add(gate); gates.push({ g: gate, rect, closed: true, z: z0 + 0.4 });
    const gate2 = gate.clone(); gate2.position.z = z1 - 0.4; scene.add(gate2); gates[gates.length - 1].g2 = gate2;
  }
  // exit portal at the end of the last room
  const last = rooms[roomCount - 1]; const portal = new THREE.Group(); const pr = mesh(new THREE.TorusGeometry(2.4, 0.3, 10, 40), 0xffd35a, { emissive: 0xffa020, ei: 2.5 }); pr.position.y = 2.6; portal.add(pr); const pd = new THREE.Mesh(new THREE.CircleGeometry(2.1, 32), new THREE.MeshBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.45, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); pd.position.y = 2.6; portal.add(pd); portal.position.set(0, 0, last.z1 - 2.5); portal.visible = false; scene.add(portal);
  const portalL = new THREE.PointLight(0xffd35a, 0, 16, 1.5); portalL.position.set(0, 2.6, last.z1 - 3.5); scene.add(portalL);

  function nearest(p, r) { // snap p into the walkable union
    let bx = p.x, bz = p.z, best = 1e9;
    for (const q of rects) { if (!q.open) continue; const x = clamp(p.x, q.x0 + r, q.x1 - r), z = clamp(p.z, q.z0 + r, q.z1 - r), d = (x - p.x) ** 2 + (z - p.z) ** 2; if (d < best) { best = d; bx = x; bz = z; } if (d === 0) break; }
    p.x = bx; p.z = bz;
  }
  const arena = {
    start: [0, rooms[0].z0 + 4], camYaw: Math.PI,
    collide(p, r) { nearest(p, r); for (const b of blockers) { const dx = p.x - b.x, dz = p.z - b.z, dd = Math.hypot(dx, dz), m = b.r + r; if (dd < m && dd > 0.001) { p.x = b.x + (dx / dd) * m; p.z = b.z + (dz / dd) * m; } } },
    inside(p) { if (p.y < -0.5 || p.y > 10.5) return false; for (const q of rects) if (p.x > q.x0 && p.x < q.x1 && p.z > q.z0 && p.z < q.z1 && (q.open || true)) return q.open || !gates.some((g) => g.rect === q); return false; },
    blocks(p) { if (p.y > 11) return false; for (const b of blockers) if (Math.hypot(p.x - b.x, p.z - b.z) < b.r) return true; return false; },
    camClamp(c) { let bx = c.x, bz = c.z, best = 1e9; for (const q of rects) { if (!q.open) continue; const x = clamp(c.x, q.x0 + 0.8, q.x1 - 0.8), z = clamp(c.z, q.z0 + 0.8, q.z1 - 0.8), d = (x - c.x) ** 2 + (z - c.z) ** 2; if (d < best) { best = d; bx = x; bz = z; } } c.x = bx; c.z = bz; c.y = Math.min(c.y, 9); },
  };
  const combat = createCombat(rig, arena, { power: ctx.power, camDist: 8.2, hpScale: f * 0.12 });
  combat.cam.pitch = 0.5; const wandLight = new THREE.PointLight(0xaad0ff, 40, 22, 1.4); scene.add(wandLight);
  const st = { phase: "intro", t: 0, over: false, room: -1, msg: "", obj: "", crystals: 0, time: 0, endT: 0, kills: 0 };
  const spec = (r) => {
    const d = f * 3 + r, list = [];
    if (f === 3 && r === 2) { list.push({ kind: "warlock", name: "Vaelrix the Warlock", hp: 420, x: 0, z: 0 }); for (let i = 0; i < 2; i++) list.push({ kind: "imp", hp: 24, color: 0x6a3a5a, eye: 0xd070ff }); return list; }
    const imps = 2 + Math.floor(d * 0.55), shades = d >= 2 ? 1 + Math.floor((d - 2) / 3) : 0, brutes = d >= 4 ? 1 + Math.floor((d - 4) / 4) : 0;
    for (let i = 0; i < imps; i++) list.push({ kind: "imp", name: "Crypt Imp", hp: 26 + f * 6, color: [0x6a7a62, 0x5a7a5a, 0x8a5a3a, 0x6a3a5a][f], eye: [0xff5a30, 0xa0ff50, 0xffb030, 0xd070ff][f] });
    for (let i = 0; i < shades; i++) list.push({ kind: "shade", name: "Gloom Shade", hp: 38 + f * 8, eye: [0xc070ff, 0x80ff9a, 0xff6a30, 0xff70d0][f] });
    for (let i = 0; i < brutes; i++) list.push({ kind: "brute", name: "Stone Brute", hp: 120 + f * 22, color: [0x6a6e7a, 0x5a6e52, 0x7a4a3a, 0x4a3a6a][f], eye: [0xffb030, 0xe0ff60, 0xff9a30, 0xd070ff][f], speed: 2.7 });
    return list;
  };
  function spawnRoom(r) {
    const room = rooms[r]; room.spawned = true; room.state = "fight"; st.room = r;
    const list = spec(r); list.forEach((d, i) => { const a = (i / list.length) * Math.PI * 2 + rnd(0, 1), rad = r === 0 && i < 2 ? 7 : rnd(6, 10); const x = clamp(Math.cos(a) * rad, -RW / 2 + 3, RW / 2 - 3), z = clamp(room.cz + Math.sin(a) * rad * 0.8, room.z0 + 3, room.z1 - 3); const e = combat.addFoe({ ...d, x: d.x ?? x, z: d.z !== undefined ? room.cz + d.z : z }); rig.fx.burst(new THREE.Vector3(e.pos.x, 1, e.pos.z), e.color, 24, 6, 0.8, 0.8, 0); if (d.kind === "warlock") { e.boss = true; e.keep = 10; combat.setLock(e); } });
    rig.sound.play("alarm"); st.obj = f === 3 && r === 2 ? "Defeat the Warlock!" : "Defeat every monster in the room";
    if (gates[r - 1]) { gates[r - 1].rect.open = true; gates[r - 1].closed = true; }
    if (gates[r]) { gates[r].closed = true; gates[r].rect.open = false; }
    // seal the corridor behind us
    if (gates[r - 1]) { gates[r - 1].rect.open = false; }
  }
  function openDoor(r) { if (!gates[r]) return; gates[r].rect.open = true; gates[r].closed = false; }
  combat.onFoeDead = (e) => { st.kills++; };
  combat.onPlayerDead = () => { st.phase = "lost"; st.endT = 0; };

  const out = {
    combat, state: st, floor: th,
    update(dt, time) {
      for (const t of torches) t.userData.tick(time, t.position.x * 3 + t.position.z);
      st.t += dt; const P = combat.player;
      if (st.phase === "intro") { st.msg = st.t < 2.6 ? th.name : ""; P.invul = 1; if (st.t > 1.2 && st.room < 0) spawnRoom(0); if (st.t > 2.6) st.phase = "play"; }
      else if (st.phase === "play") {
        st.time += dt;
        const room = rooms[Math.max(0, st.room)];
        // entering the next room starts its fight
        const next = rooms[st.room + 1];
        if (st.room >= 0 && next && !next.spawned && P.pos.z > next.z0 + 2.5 && rooms[st.room].state === "clear") spawnRoom(st.room + 1);
        // clear check
        if (room.state === "fight" && combat.foes.filter((e) => !e.dead).length === 0) {
          room.state = "clear"; rig.sound.play("win"); combat.say(st.room === rooms.length - 1 ? "FLOOR CLEARED!" : "ROOM CLEARED!", 2.2); P.hp = Math.min(P.maxHp, P.hp + 20); P.mana = 100; rig.fx.ring(new THREE.Vector3(P.pos.x, 0.3, P.pos.z), 0x80ff9a, 30, 6, 0.8, 0.8);
          if (st.room < rooms.length - 1) { openDoor(st.room); st.obj = "The door is open. Move on!"; } else { portal.visible = true; portalL.intensity = 30; st.obj = "Step into the golden portal"; }
        }
        for (const g of gates) { const op = !g.closed; g.g.visible = !op; if (g.g2) g.g2.visible = !g.rect.open; if (g.g.visible) g.g.children[0].material.opacity = 0.25 + Math.sin(time * 5) * 0.08; }
        for (const pk of pickups) { if (pk.got) continue; pk.node.rotation.y += dt * 2; pk.node.position.y = 1.1 + Math.sin(time * 2 + pk.x) * 0.15; pk.glow.position.y = pk.node.position.y; if (Math.hypot(P.pos.x - pk.x, P.pos.z - pk.z) < 1.3) { pk.got = true; pk.node.visible = false; pk.glow.visible = false; st.crystals++; P.mana = 100; P.hp = Math.min(P.maxHp, P.hp + 8); P.ult = Math.min(100, P.ult + 25); rig.sound.play("pick"); rig.fx.burst(new THREE.Vector3(pk.x, 1.2, pk.z), th.glow, 16, 4, 0.6, 0.6, 0); } }
        if (portal.visible) { portal.rotation.y += dt; pd_anim(time); if (Math.hypot(P.pos.x - portal.position.x, P.pos.z - portal.position.z) < 2.2) { st.phase = "won"; st.endT = 0; rig.sound.play("win"); combat.say("DESCENDING...", 2); P.invul = 99; } }
      } else { st.endT += dt; if (st.endT > 2.2 && !st.over) { st.over = true; ctx.onEnd(st.phase === "won", { time: st.time, kills: st.kills, crystals: st.crystals, hp: P.hp, maxHp: P.maxHp }); } }
      combat.update(dt); wandLight.position.set(combat.player.pos.x, 4.2, combat.player.pos.z);
    },
    snapshot() { return { ...combat.snapshot(), kind: "crypt", phase: st.phase, msg: st.msg, obj: st.obj, room: Math.max(0, st.room) + 1, rooms: rooms.length, crystals: st.crystals, title: th.name, sub: th.sub, time: st.time, tip: st.phase === "intro" ? "Clear each room to open the next door. Collect glowing crystals for health and mana." : "" }; },
    dispose() { combat.dispose(); },
  };
  function pd_anim(t) { portalL.intensity = 26 + Math.sin(t * 4) * 6; }
  return out;
}
