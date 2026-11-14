"use client";
import { THREE, clearScene, mesh, glowMesh, sprite, rnd, clamp, lerp, angDiff } from "@/threeplay/core";
import { makeParticles } from "@/lib/cinematic/atmos";
import { makeWizard } from "./combat";
import { makeCastle, makeTerrain, makeTrees, stoneTexture } from "./scenery";

const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function heightAt(x, z) {
  let h = 22 * Math.sin(x * 0.006 + 1) * Math.cos(z * 0.007) + 14 * Math.sin(x * 0.015) * Math.sin(z * 0.013 + 2) + 6 * Math.sin(x * 0.04 + z * 0.03) + 4 * Math.sin(z * 0.05);
  const d = Math.hypot(x, z); h += 90 * sm(620, 1000, d); h = lerp(h, 38, 1 - sm(60, 200, d));
  h -= 34 * Math.exp(-(((x - 380) ** 2 + (z + 120) ** 2) / 170 ** 2)); h -= 30 * Math.exp(-(((x + 330) ** 2 + (z - 260) ** 2) / 150 ** 2));
  return h;
}

export const COURSES = [
  { id: "lantern", name: "Lantern Valley", sub: "Sunny training circuit", rings: 26, len: 3.0, alt: 32, wob: 0.6, towers: 0, ai: 0.86, time: "day", par: 78 },
  { id: "spire", name: "Spire Run", sub: "Weave between the old towers", rings: 32, len: 3.3, alt: 40, wob: 1.0, towers: 26, ai: 0.93, time: "dusk", par: 84 },
  { id: "storm", name: "Stormcrest", sub: "Night race through a thunderstorm", rings: 38, len: 3.6, alt: 46, wob: 1.4, towers: 34, ai: 1.0, time: "storm", par: 92 },
];

function pathFor(c) {
  const pts = [], n = 14;
  for (let i = 0; i <= n; i++) {
    const a = -1.2 + (i / n) * (Math.PI * 2 * 0.92), r = 330 + 90 * Math.sin(a * 2.6 * c.wob + 1) + 40 * Math.sin(a * 5 * c.wob), x = Math.cos(a) * r, z = Math.sin(a) * r;
    const y = Math.max(heightAt(x, z) + 26, c.alt + 18 * Math.sin(a * 3 * c.wob) + (c.wob > 0.9 ? 12 * Math.sin(a * 7) : 0));
    pts.push(new THREE.Vector3(x, y, z));
  }
  return new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
}

export function createBroomRace(rig, ctx) {
  clearScene(rig); if (rig.cine.bloom) rig.cine.bloom.strength = 0.28; const { scene } = rig, c = COURSES[ctx.course], storm = c.time === "storm", dusk = c.time === "dusk";
  rig.setSky(storm ? { zenith: 0x04060c, mid: 0x101828, horizon: 0x2a3a50, sunDir: [0, 0.2, -1], sunSize: 0, glow: 0.1, cloud: 1.0, cloudColor: 0x3a4a62, cloudShade: 0x05070c, stars: 0, wind: 0.01 } : dusk ? { zenith: 0x1a2250, mid: 0x7a4a7a, horizon: 0xffa060, sunDir: [0.6, 0.12, -0.7], sunColor: 0xffc080, sunSize: 0.03, glow: 1.2, cloud: 0.6, cloudColor: 0xffb090, cloudShade: 0x40305a } : { zenith: 0x2a68c8, mid: 0x6aa6e8, horizon: 0xe8f0f8, sunDir: [0.5, 0.55, -0.6], sunColor: 0xfff0d0, sunSize: 0.012, glow: 0.6, cloud: 0.55, cloudColor: 0xffffff, cloudShade: 0x8aa0c8 });
  scene.fog = new THREE.Fog(storm ? 0x141c2a : dusk ? 0xb07a8a : 0xb8d0ea, 80, storm ? 700 : 1100);
  const hemi = new THREE.HemisphereLight(storm ? 0x7a8ec0 : dusk ? 0xffa888 : 0xcfe4ff, storm ? 0x2a3444 : 0x4a5a3a, storm ? 2.3 : 1.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight(storm ? 0x9ab0e0 : dusk ? 0xffb070 : 0xfff0d8, storm ? 1.8 : 3.0); sun.position.set(storm ? -200 : 300, 260, -250); sun.castShadow = false; scene.add(sun);
  const colorFn = (y, x, z, col) => { if (y < 0.5) col.setHex(0x6a7a6a); else if (y < 55) col.setHex(storm ? 0x2c5a3e : dusk ? 0x4a6a34 : 0x4f9a4a).offsetHSL(0, 0, Math.sin(x * 0.03) * Math.sin(z * 0.03) * 0.04); else if (y < 100) col.setHex(storm ? 0x4a5058 : 0x7a7a70); else col.setHex(storm ? 0x8a929c : 0xf0f4f8); };
  const terrain = makeTerrain(heightAt, 2400, 200, colorFn); scene.add(terrain);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), new THREE.MeshStandardMaterial({ color: storm ? 0x1a4a6c : 0x2a78b8, emissive: storm ? 0x0a2840 : 0x000000, roughness: 0.2, metalness: 0.25, transparent: true, opacity: 0.88 })); water.rotation.x = -Math.PI / 2; water.position.y = -0.4; scene.add(water);
  const castle = makeCastle(5); castle.position.set(0, 36, 0); castle.scale.setScalar(1.35); scene.add(castle);
  scene.add(makeTrees(heightAt, 1500, 900, (x, y, z) => Math.hypot(x, z) < 150));

  const curve = pathFor(c), length = curve.getLength(), N = c.rings, rings = [], towers = [];
  const ringMat = (col) => new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.9, roughness: 0.4 });
  for (let i = 0; i < N; i++) {
    const u = (i + 1) / (N + 0.2), p = curve.getPointAt(u), tan = curve.getTangentAt(u), R = storm ? 8.5 : dusk ? 10 : 12;
    const g = new THREE.Group(); const torus = new THREE.Mesh(new THREE.TorusGeometry(R, 0.55, 8, 40), ringMat(0x2a98e8)); g.add(torus);
    const halo = sprite(0x6fd0ff, R * 2.6, 0.2); g.add(halo); g.position.copy(p); g.lookAt(p.clone().add(tan)); scene.add(g);
    rings.push({ g, torus, halo, pos: p.clone(), tan: tan.clone(), R, u, state: 0 });
  }
  // finish arch
  const fin = curve.getPointAt(0.999); const fl = new THREE.Group(); const arch = mesh(new THREE.TorusGeometry(16, 1.0, 8, 40), 0xffd35a, { emissive: 0xffa020, ei: 2.5 }); fl.add(arch); fl.position.copy(fin); fl.lookAt(fin.clone().add(curve.getTangentAt(0.999))); scene.add(fl);
  if (c.towers) for (let i = 0; i < c.towers; i++) { const u = rnd(0.07, 0.96), p = curve.getPointAt(u), tan = curve.getTangentAt(u), side = new THREE.Vector3(-tan.z, 0, tan.x).normalize().multiplyScalar((Math.random() < 0.5 ? -1 : 1) * rnd(15, 26)); const x = p.x + side.x, z = p.z + side.z, h0 = heightAt(x, z), h = Math.max(p.y - h0 + rnd(6, 24), 20), r = rnd(2.5, 4.5); const t = mesh(new THREE.CylinderGeometry(r * 0.85, r, h, 10), 0x8a8898, { map: stoneTexture("#8a8898", "#4a4858", 1, Math.ceil(h / 6)), rough: 0.9 }); t.position.set(x, h0 + h / 2, z); scene.add(t); const cap = mesh(new THREE.ConeGeometry(r * 1.3, r * 2.4, 10), storm ? 0x4a2a5a : 0x7a2a5a, { rough: 0.8 }); cap.position.set(x, h0 + h + r * 1.2, z); scene.add(cap); const lamp = sprite(0xffd488, 4, 0.9); lamp.position.set(x, h0 + h - 1, z); scene.add(lamp); towers.push({ x, z, r: r + 1.2, top: h0 + h + r * 2.4 }); }
  const rain = storm ? makeParticles({ count: 2200, area: 90, height: 60, rise: -26, color: 0xaac0e0, color2: 0xe0eaff, size: 22, flicker: 0, streak: 1, drift: 0.2, additive: true, wind: [8, 2] }) : makeParticles({ count: 500, area: 160, height: 80, rise: 0.4, color: 0xfff0a0, color2: 0xffd070, size: 70, drift: 4, flicker: 1 });
  if (!storm) rain.material.uniforms.uOpacity.value = 0.6; scene.add(rain);

  // racers
  const names = ["Ivy Thornwick", "Bram Okafor", "Sol Reyes"], cols = [[0x2aa86a, 0xd8f0a0], [0xc0402a, 0xffd0a0], [0x8a4ab8, 0xf0d0ff]];
  function makeRider(rob, trim, isPlayer) { const g = new THREE.Group(); const w = makeWizard({ robe: rob, trim, cape: trim, magic: 0xffe08a }); w.scale.setScalar(0.85); w.position.set(0, 0.35, 0.1); w.userData.body.rotation.x = 0.55; w.userData.arm.rotation.x = -1.4; w.userData.arm2.rotation.x = -1.3; g.add(w); const bro = mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), 0x6a4a2a, { rough: 0.7 }); bro.rotation.x = Math.PI / 2; bro.position.set(0, 0.35, 0.2); g.add(bro); const br = mesh(new THREE.ConeGeometry(0.28, 0.8, 8), 0xc8a050, { rough: 0.9 }); br.rotation.x = -Math.PI / 2; br.position.set(0, 0.35, -1.6); g.add(br); const gl = sprite(isPlayer ? 0x6fd0ff : trim, 1.4, 0.8); gl.position.set(0, 0.35, -2.1); g.add(gl); g.userData.glow = gl; return g; }
  const sp0 = curve.getPointAt(0.0), tan0 = curve.getTangentAt(0.0), side0 = new THREE.Vector3(-tan0.z, 0, tan0.x).normalize();
  const racers = names.map((n, i) => { const m = makeRider(cols[i][0], cols[i][1], false); scene.add(m); return { name: n, m, u: 0.0, off: (i - 1) * 7, offT: 0, sp: 0, base: 0.95 + i * 0.03 + rnd(-0.03, 0.03), phase: rnd(0, 6), prog: 0, fin: false, finT: 0 }; });
  const meM = makeRider(0x2f46c8, 0xf2c230, true); scene.add(meM);
  const me = { pos: sp0.clone().addScaledVector(side0, 0).add(new THREE.Vector3(0, 0, 0)), yaw: Math.atan2(tan0.x, tan0.z), pitch: 0, roll: 0, speed: 0, boost: 60, idx: 0, hits: 0, misses: 0, score: 0, scrape: 0, fin: false, place: 0, finT: 0, prev: sp0.clone(), vyaw: 0, vpit: 0 };
  me.pos.addScaledVector(side0, 0); racers.forEach((r, i) => { r.m.position.copy(sp0).addScaledVector(side0, r.off).add(new THREE.Vector3(0, 0, 0)); r.u = 0; });
  const fwd = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  const st = { phase: "intro", t: 0, time: 0, msg: "", flash: 0, nextFlash: rnd(2, 5), over: false, endT: 0 };
  const finished = [];
  me.pos.copy(sp0).add(new THREE.Vector3(0, 0, 0));
  function playerProg() { const a = me.idx > 0 ? rings[me.idx - 1].pos : sp0, b = me.idx < N ? rings[me.idx].pos : fin; tmp.copy(b).sub(a); const L = tmp.lengthSq() || 1; return me.idx + clamp(tmp2.copy(me.pos).sub(a).dot(tmp) / L, 0, 0.999); }
  function ranking() { const list = [{ me: true, p: me.fin ? 99 + (200 - me.finT) * 0.01 : playerProg() }, ...racers.map((r) => ({ me: false, p: r.fin ? 99 + (200 - r.finT) * 0.01 : r.u * (N + 0.2) }))]; list.sort((x, y) => y.p - x.p); return list.findIndex((x) => x.me) + 1; }

  const out = {
    state: st, course: c, N, dbg: { me, curve, racers, rings, fwd },
    update(dt, time) {
      st.t += dt;
      const k = rig.keys;
      if (st.phase === "intro") { const cdn = 3.2 - st.t; st.msg = cdn > 0 ? String(Math.ceil(cdn)) : "GO!"; if (st.t > 3.2) { st.phase = "race"; rig.sound.play("boost"); } }
      if (st.phase === "race" && st.t > 4.2) st.msg = "";
      const racing = st.phase === "race" || st.phase === "done";
      if (st.phase === "race") st.time += dt;
      // ---- player flight ----
      const ctrl = st.phase === "race" && !me.fin;
      const yawIn = ctrl ? clamp((k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0) - (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - rig.mouse.dx * 0.07, -1.4, 1.4) : 0;
      const pitIn = ctrl ? clamp((k.has("KeyW") || k.has("ArrowUp") ? -1 : 0) + (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) + rig.mouse.dy * 0.05, -1.4, 1.4) : 0;
      me.vyaw = lerp(me.vyaw, yawIn, 1 - Math.exp(-dt * 7)); me.vpit = lerp(me.vpit, pitIn, 1 - Math.exp(-dt * 7));
      me.yaw += me.vyaw * dt * 1.25; me.pitch = clamp(me.pitch - me.vpit * dt * 1.0, -0.95, 0.95);
      if (!(k.has("KeyW") || k.has("KeyS") || k.has("ArrowUp") || k.has("ArrowDown") || Math.abs(rig.mouse.dy) > 0)) me.pitch *= Math.exp(-dt * 0.5);
      me.roll = lerp(me.roll, -me.vyaw * 0.65, 1 - Math.exp(-dt * 6));
      const boosting = ctrl && (k.has("ShiftLeft") || k.has("ShiftRight")) && me.boost > 0, braking = ctrl && k.has("Space");
      let target = racing ? 40 : 0; target += -me.pitch * 18; if (boosting) { target += 26; me.boost = Math.max(0, me.boost - dt * 28); } if (braking) target = 20; if (me.fin) target = 24;
      me.speed = lerp(me.speed, target, 1 - Math.exp(-dt * (boosting ? 2.4 : 1.2)));
      fwd.set(Math.sin(me.yaw) * Math.cos(me.pitch), Math.sin(me.pitch), Math.cos(me.yaw) * Math.cos(me.pitch));
      me.prev.copy(me.pos); me.pos.addScaledVector(fwd, me.speed * dt);
      const gh = heightAt(me.pos.x, me.pos.z) + 2.4;
      if (me.pos.y < gh) { me.pos.y = gh; if (me.speed > 22) { me.speed *= 0.93; me.scrape = 0.4; rig.shake = Math.max(rig.shake, 0.45); rig.sound.play("hit"); fx_burst(me.pos, 0x9a8a6a); } me.pitch = Math.max(me.pitch, 0.05); }
      if (me.pos.y < 0.5) me.pos.y = 0.5; if (me.pos.y > 260) { me.pos.y = 260; }
      for (const t of towers) { const dx = me.pos.x - t.x, dz = me.pos.z - t.z, d = Math.hypot(dx, dz); if (d < t.r && me.pos.y < t.top) { me.pos.x = t.x + (dx / (d || 1)) * t.r; me.pos.z = t.z + (dz / (d || 1)) * t.r; me.speed *= 0.55; rig.shake = 0.9; rig.sound.play("boom"); fx_burst(me.pos, 0xffb070); me.scrape = 0.5; } }
      const dcen = Math.hypot(me.pos.x, me.pos.z); if (dcen > 900) { me.yaw += angDiff(me.yaw, Math.atan2(-me.pos.x, -me.pos.z)) * dt * 2; }
      me.scrape = Math.max(0, me.scrape - dt);
      // rings
      if (st.phase === "race" && !me.fin) for (let j = me.idx; j < Math.min(N, me.idx + 3); j++) {
        const r = rings[j], a = tmp.copy(me.prev).sub(r.pos).dot(r.tan), b = tmp2.copy(me.pos).sub(r.pos).dot(r.tan);
        if (a < 0 && b >= 0) {
          const f = a / (a - b), cx = me.prev.x + (me.pos.x - me.prev.x) * f - r.pos.x, cy = me.prev.y + (me.pos.y - me.prev.y) * f - r.pos.y, cz = me.prev.z + (me.pos.z - me.prev.z) * f - r.pos.z, along = cx * r.tan.x + cy * r.tan.y + cz * r.tan.z, d = Math.sqrt(Math.max(0, cx * cx + cy * cy + cz * cz - along * along));
          for (let q = me.idx; q <= j; q++) { rings[q].state = q === j && d < r.R ? 2 : 1; }
          if (d < r.R) { me.hits++; me.score += 50; me.boost = Math.min(100, me.boost + 14); rig.sound.play("ring"); rig.fx.ring(r.pos, 0x9fe8ff, 24, 6, 0.5, 0.9); r.torus.material.color.setHex(0xffe080); r.torus.material.emissive.setHex(0xffc040); } else { me.misses++; r.torus.material.color.setHex(0x703030); r.torus.material.emissive.setHex(0x602020); r.halo.material.opacity = 0.05; }
          me.idx = j + 1;
        }
      }
      if (st.phase === "race" && !me.fin && me.idx >= N) { const a = tmp.copy(me.prev).sub(fin).dot(curve.getTangentAt(0.999)), b = tmp2.copy(me.pos).sub(fin).dot(curve.getTangentAt(0.999)); if (b >= 0 || me.pos.distanceTo(fin) < 30) { me.fin = true; me.finT = st.time; me.place = ranking(); st.phase = "done"; st.endT = 0; rig.sound.play(me.place <= 2 ? "win" : "lose"); st.msg = ["", "1ST PLACE!", "2ND PLACE", "3RD PLACE", "4TH PLACE"][me.place]; } }
      // next ring highlight
      for (let j = 0; j < N; j++) { const r = rings[j]; const isNext = j === me.idx; const s = isNext ? 1 + Math.sin(time * 6) * 0.05 : 1; r.g.scale.setScalar(s); if (r.state === 0) { r.halo.material.opacity = isNext ? 0.4 : 0.15; r.torus.material.emissiveIntensity = isNext ? 1.5 : 0.8; } }
      // ---- AI ----
      const playerP = playerProg();
      racers.forEach((r, i) => {
        if (st.phase === "race" && !r.fin) {
          const pp = r.u * (N + 0.2); let k2 = r.base * c.ai; const diff = pp - playerP; if (!me.fin) k2 *= clamp(1 - diff * 0.018, 0.78, 1.14); r.sp = lerp(r.sp, 38 * k2 + Math.sin(time * 0.7 + r.phase) * 2.5, 1 - Math.exp(-dt * 2));
          r.u += (r.sp * dt) / length; if (r.u >= 0.999) { r.fin = true; r.finT = st.time; r.u = 0.999; }
        } else if (r.fin) { r.u = Math.min(1.02, r.u + 0.00005); }
        const u = Math.min(r.u, 0.999), p = curve.getPointAt(u), tn = curve.getTangentAt(u); tmp.set(-tn.z, 0, tn.x).normalize(); r.offT = Math.sin(time * 0.6 + r.phase) * 6 + r.off * 0.4;
        const target = tmp2.copy(p).addScaledVector(tmp, r.offT); target.y += Math.sin(time * 0.9 + r.phase * 2) * 2.5; if (st.phase === "intro") { target.copy(sp0).addScaledVector(side0, r.off); }
        r.m.position.lerp(target, 1 - Math.exp(-dt * 8)); tmp.copy(r.m.position).add(tn); r.m.lookAt(tmp); r.m.rotation.z = Math.sin(time * 1.3 + r.phase) * 0.35; if (Math.random() < 0.7) rig.fx.spark(tmp2.copy(r.m.position).addScaledVector(tn, -2.2), 0xffd070, 0.6, 0.4, 0.3);
      });
      // ---- visuals ----
      meM.position.copy(me.pos); meM.rotation.order = "YXZ"; meM.rotation.y = me.yaw; meM.rotation.x = -me.pitch; meM.rotation.z = me.roll;
      if (Math.random() < 0.9) rig.fx.spark(tmp.copy(me.pos).addScaledVector(fwd, -2.3), boosting ? 0x8fe8ff : 0xffd070, boosting ? 1.2 : 0.7, 0.45, 0.4);
      const camT = tmp.copy(me.pos).addScaledVector(fwd, -9.5 - me.speed * 0.04).addScaledVector(up, 3.2 + me.pitch * -2); camPos.lerp(camT, 1 - Math.exp(-dt * (st.t < 0.1 ? 100 : 6.5))); rig.camera.position.copy(camPos);
      const gh2 = heightAt(camPos.x, camPos.z) + 1.5; if (rig.camera.position.y < gh2) rig.camera.position.y = gh2;
      camLook.copy(me.pos).addScaledVector(fwd, 14); rig.camera.up.set(Math.sin(me.roll * 0.5), Math.cos(me.roll * 0.5), 0); rig.camera.lookAt(camLook);
      const fov = 62 + (me.speed - 36) * 0.5 + (boosting ? 8 : 0); rig.camera.fov = lerp(rig.camera.fov, clamp(fov, 56, 84), 1 - Math.exp(-dt * 5)); rig.camera.updateProjectionMatrix();
      rain.userData.update(time, rig.camera.position);
      if (storm) { st.nextFlash -= dt; if (st.nextFlash <= 0) { st.flash = 1; st.nextFlash = rnd(2.5, 7); rig.sound.play("boom"); } st.flash = Math.max(0, st.flash - dt * 3.2); hemi.intensity = 2.3 + st.flash * 5; if (rig.sky) rig.sky.userData.uniforms.uFlash.value = st.flash * 0.5; }
      if (st.phase === "done") { st.endT += dt; if (st.endT > 4.2 && !st.over) { st.over = true; const place = me.place; ctx.onEnd(place, { time: st.time, hits: me.hits, rings: N, place, score: me.score }); } }
      if (st.phase === "race" && st.time > c.par * 2.2 && !me.fin) { me.fin = true; me.finT = st.time; me.place = 4; st.phase = "done"; st.endT = 0; st.msg = "TIME UP"; }
    },
    snapshot() { return { kind: "broom", phase: st.phase, msg: st.msg, time: st.time, speed: me.speed, boost: me.boost, ring: Math.min(me.idx, N), rings: N, place: st.phase === "done" ? me.place : ranking(), hits: me.hits, scrape: me.scrape > 0, name: c.name, sub: c.sub, tip: st.phase === "intro" ? "Mouse or WASD to steer. Fly through the glowing rings for boost. Hold Shift to boost, Space to brake." : "" }; },
    dispose() {},
  };
  function fx_burst(p, color) { rig.fx.burst(p, color, 14, 6, 0.6, 0.7, 4); }
  camPos.copy(me.pos).addScaledVector(fwd.set(Math.sin(me.yaw), 0, Math.cos(me.yaw)), -9).add(new THREE.Vector3(0, 3.5, 0));
  return out;
}
