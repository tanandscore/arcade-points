"use client";
// Skyguard figures: the hero, street enemies, drones, civilians, the getaway car and the boss airship — all built from simple shapes.
import { THREE, mesh, glowMesh, sprite, rnd } from "@/threeplay/core";

const cyl = (r0, r1, h, s = 8) => new THREE.CylinderGeometry(r0, r1, h, s);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// The hero: Kestrel. Blue suit, gold emblem, long cape. Body axis is +Y (head up), chest faces +Z.
export function makeHero() {
  const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const suit = 0x1f4fb8, red = 0xc8281e, gold = 0xffc83a, skin = 0xe0b08c;
  const torso = mesh(box(0.7, 0.78, 0.38), suit, { rough: 0.45, metal: 0.1 }); torso.position.y = 1.25; body.add(torso);
  const sh = mesh(box(0.98, 0.2, 0.4), suit, { rough: 0.45 }); sh.position.y = 1.58; body.add(sh);
  const belt = mesh(box(0.72, 0.1, 0.4), gold, { rough: 0.35, metal: 0.5 }); belt.position.y = 0.9; body.add(belt);
  const emb = glowMesh(box(0.3, 0.3, 0.05), gold, 1.4); emb.position.set(0, 1.3, 0.2); emb.rotation.z = Math.PI / 4; body.add(emb);
  const head = mesh(new THREE.SphereGeometry(0.2, 14, 10), skin, { rough: 0.6 }); head.position.y = 1.86; body.add(head);
  const mask = mesh(box(0.4, 0.12, 0.2), red, { rough: 0.5 }); mask.position.set(0, 1.9, 0.07); body.add(mask);
  const hair = mesh(new THREE.SphereGeometry(0.21, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), 0x2a1a12, { rough: 0.9 }); hair.position.set(0, 1.9, -0.02); body.add(hair);
  const eyes = glowMesh(box(0.26, 0.05, 0.05), 0xff3a2a, 0.0); eyes.position.set(0, 1.88, 0.21); body.add(eyes);
  const cape = new THREE.Group(); cape.position.set(0, 1.58, -0.22); body.add(cape);
  const cm = mesh(box(0.88, 1.5, 0.05), red, { rough: 0.85, side: THREE.DoubleSide }); cm.geometry.translate(0, -0.75, 0); cape.add(cm);
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * 0.56, 1.5, 0); const am = mesh(cyl(0.1, 0.085, 0.66), suit, { rough: 0.5 }); am.position.y = -0.3; a.add(am); const fist = mesh(new THREE.SphereGeometry(0.11, 8, 6), red, { rough: 0.5 }); fist.position.y = -0.68; a.add(fist); body.add(a); arms.push(a);
    const l = new THREE.Group(); l.position.set(s * 0.19, 0.85, 0); const lm = mesh(cyl(0.12, 0.1, 0.78), suit, { rough: 0.5 }); lm.position.y = -0.38; l.add(lm); const boot = mesh(box(0.2, 0.28, 0.32), red, { rough: 0.5 }); boot.position.set(0, -0.78, 0.04); l.add(boot); g.add(l); legs.push(l);
  }
  const aura = sprite(0x7fc8ff, 3.2, 0.0); aura.position.y = 1.2; body.add(aura);
  g.userData = { body, cape, arms, legs, eyes, aura, head };
  return g;
}

// Street enemies. kind: thug | shooter | brute | shield | boss
export function makeFoe(kind) {
  const sets = {
    thug: { c: 0x5a4a44, a: 0x9a3a2a, s: 1 }, shooter: { c: 0x3a4a5a, a: 0x2a8ac8, s: 1 }, brute: { c: 0x4a4a52, a: 0xc87a1a, s: 1.38 },
    shield: { c: 0x3a3e4a, a: 0x3ac8a0, s: 1.1 }, boss: { c: 0x2a2630, a: 0xff3a2a, s: 2.2 },
  }, o = sets[kind], g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const robot = kind === "shield" || kind === "boss";
  const torso = mesh(box(0.66, 0.78, 0.4), o.c, { rough: 0.55, metal: robot ? 0.6 : 0.1 }); torso.position.y = 1.2; body.add(torso);
  const vest = mesh(box(0.68, 0.38, 0.44), o.a, { rough: 0.6, metal: robot ? 0.4 : 0 }); vest.position.y = 1.32; body.add(vest);
  const head = mesh(robot ? box(0.34, 0.3, 0.32) : new THREE.SphereGeometry(0.2, 12, 8), robot ? 0x20242e : 0xc89a78, { rough: 0.6, metal: robot ? 0.6 : 0 }); head.position.y = 1.78; body.add(head);
  const eye = glowMesh(box(0.28, 0.06, 0.06), robot ? o.a : 0x201818, robot ? 3 : 0); eye.position.set(0, 1.8, 0.17); body.add(eye);
  if (kind === "thug") { const cap = mesh(box(0.42, 0.1, 0.42), 0x222222, { rough: 0.9 }); cap.position.y = 1.96; body.add(cap); }
  if (kind === "shooter") { const mk = mesh(box(0.4, 0.14, 0.3), 0x111418, { rough: 0.9 }); mk.position.set(0, 1.76, 0.04); body.add(mk); }
  const arms = [], legs = [];
  for (const s of [-1, 1]) {
    const a = new THREE.Group(); a.position.set(s * (0.44 + (kind === "brute" ? 0.1 : 0)), 1.5, 0); const am = mesh(cyl(kind === "brute" ? 0.16 : 0.09, 0.08, 0.64), o.c, { rough: 0.6, metal: robot ? 0.5 : 0 }); am.position.y = -0.3; a.add(am);
    const fist = mesh(new THREE.SphereGeometry(kind === "brute" ? 0.2 : 0.11, 8, 6), o.a, { rough: 0.6 }); fist.position.y = -0.66; a.add(fist); body.add(a); arms.push(a);
    const l = new THREE.Group(); l.position.set(s * 0.17, 0.82, 0); const lm = mesh(cyl(0.12, 0.1, 0.76), robot ? 0x2a2e38 : 0x2a2f3a, { rough: 0.6, metal: robot ? 0.5 : 0 }); lm.position.y = -0.37; l.add(lm); g.add(l); legs.push(l);
  }
  let gun = null, shield = null;
  if (kind === "shooter") { gun = new THREE.Group(); gun.position.set(0, -0.62, 0.22); const r = mesh(box(0.1, 0.13, 0.78), 0x1c1e24, { metal: 0.7 }); r.position.z = 0.28; gun.add(r); const tip = new THREE.Object3D(); tip.position.z = 0.7; gun.add(tip); gun.userData.tip = tip; arms[0].add(gun); }
  if (kind === "shield") { shield = new THREE.Group(); const pl = mesh(box(1.5, 1.7, 0.14), 0x4a5a6e, { metal: 0.7, rough: 0.35 }); shield.add(pl); const gl = glowMesh(box(1.2, 1.4, 0.04), o.a, 0.9); gl.position.z = 0.09; shield.add(gl); shield.position.set(0, 1.1, 0.62); body.add(shield); }
  if (kind === "boss") {
    const p1 = mesh(box(1.5, 0.5, 0.6), o.c, { metal: 0.7, rough: 0.4 }); p1.position.y = 1.7; body.add(p1);
    for (const s of [-1, 1]) { const cn = glowMesh(cyl(0.18, 0.22, 0.5, 8), o.a, 2.4); cn.rotation.x = Math.PI / 2; cn.position.set(s * 0.46, 1.5, 0.3); body.add(cn); }
    const core = glowMesh(new THREE.SphereGeometry(0.26, 12, 8), o.a, 4); core.position.set(0, 1.28, 0.28); body.add(core); g.userData.core = core;
  }
  const flash = mesh(new THREE.SphereGeometry(1.1 * o.s, 12, 9), 0xff6a3a, { opacity: 0, emissive: 0xff4a1a, ei: 1.6, cast: false, recv: false }); flash.material.depthWrite = false; flash.position.y = 1.1 * o.s; g.add(flash);
  body.scale.setScalar(o.s); legs.forEach((l) => { l.scale.setScalar(o.s); l.position.multiplyScalar(o.s); });
  g.userData = { ...g.userData, body, arms, legs, gun, shield, flash, o, head };
  return g;
}

export function makeDrone(boss) {
  const g = new THREE.Group(), s = boss ? 1.6 : 1;
  const hull = mesh(new THREE.SphereGeometry(1.0 * s, 14, 10), 0x2a2e38, { metal: 0.7, rough: 0.35 }); hull.scale.set(1, 0.6, 1); g.add(hull);
  const eye = glowMesh(new THREE.SphereGeometry(0.34 * s, 10, 8), 0xff3a2a, 3.5); eye.position.set(0, 0, 0.78 * s); g.add(eye);
  const rings = []; for (const a of [0, Math.PI / 2]) { const r = mesh(new THREE.TorusGeometry(1.35 * s, 0.07, 6, 24), 0x7a8294, { metal: 0.8, rough: 0.3 }); r.rotation.x = Math.PI / 2; r.rotation.z = a; g.add(r); rings.push(r); }
  const lamp = sprite(0xff3a2a, 2.6 * s, 0.5); lamp.position.z = 0.8 * s; g.add(lamp);
  g.userData = { eye, rings, lamp }; return g;
}

export function makeCivilian(c = 0xffd24a) {
  const g = new THREE.Group(); const b = mesh(cyl(0.2, 0.17, 0.7), c, { rough: 0.8 }); b.position.y = 0.2; g.add(b);
  const h = mesh(new THREE.SphereGeometry(0.17, 10, 8), 0xd8a888, { rough: 0.7 }); h.position.y = 0.72; g.add(h);
  for (const s of [-1, 1]) { const a = mesh(cyl(0.05, 0.05, 0.55), c, { rough: 0.8 }); a.position.set(s * 0.3, 0.5, 0); a.rotation.z = s * 0.9; g.add(a); const l = mesh(cyl(0.07, 0.06, 0.6), 0x2a3040, { rough: 0.8 }); l.position.set(s * 0.1, -0.35, 0); g.add(l); }
  const halo = sprite(0xfff0a0, 2.8, 0.6); halo.position.y = 0.3; g.add(halo); return g;
}

export function makeGetaway() {
  const g = new THREE.Group(); const c = 0xd8282e;
  const b = mesh(box(2.3, 0.9, 5), c, { metal: 0.5, rough: 0.3 }); b.position.y = 0.8; g.add(b);
  const t = mesh(box(1.9, 0.75, 2.4), 0x8a1a1e, { metal: 0.5, rough: 0.3 }); t.position.set(0, 1.5, -0.2); g.add(t);
  const w = mesh(box(1.95, 0.5, 2.1), 0x182430, { metal: 0.8, rough: 0.1 }); w.position.set(0, 1.55, -0.2); g.add(w);
  const sp = mesh(box(2.2, 0.1, 0.5), 0x111111); sp.position.set(0, 1.4, -2.3); g.add(sp);
  for (const [sx, sz] of [[-1, -1.5], [1, -1.5], [-1, 1.5], [1, 1.5]]) { const wh = mesh(cyl(0.45, 0.45, 0.34, 12), 0x111317); wh.rotation.z = Math.PI / 2; wh.position.set(sx * 1.15, 0.45, sz); g.add(wh); }
  const tl = glowMesh(box(1.9, 0.14, 0.1), 0xff2a2a, 3); tl.position.set(0, 1.0, -2.52); g.add(tl); const tg = sprite(0xff3a2a, 5, 0.5); tg.position.set(0, 1.0, -2.8); g.add(tg);
  const beacon = glowMesh(new THREE.SphereGeometry(0.3, 8, 6), 0xff3a2a, 3); beacon.position.set(0, 2.1, 0); g.add(beacon); g.userData = { beacon };
  return g;
}

export function makeAirship() {
  const g = new THREE.Group();
  const hull = mesh(new THREE.SphereGeometry(1, 20, 12), 0x2a2e3a, { metal: 0.65, rough: 0.4 }); hull.scale.set(26, 6.5, 11); g.add(hull);
  const deck = mesh(box(40, 1.4, 14), 0x3a3f4e, { metal: 0.6, rough: 0.4 }); deck.position.y = 5; g.add(deck);
  const bridge = mesh(box(8, 4, 6), 0x2a2e3a, { metal: 0.6 }); bridge.position.set(-6, 8, 0); g.add(bridge);
  const win = glowMesh(box(7.4, 1, 0.3), 0xff6a3a, 1.4); win.position.set(-6, 8.4, 3.1); g.add(win);
  for (const s of [-1, 1]) for (const x of [-14, 0, 14]) { const e = glowMesh(cyl(1.6, 2.2, 3, 12), 0xff5a2a, 2.4); e.position.set(x, -3, s * 11); g.add(e); const f = sprite(0xff6a2a, 9, 0.5); f.position.set(x, -4, s * 11); g.add(f); }
  const core = glowMesh(new THREE.SphereGeometry(2.6, 16, 12), 0xff3a2a, 3.2); core.position.set(0, 7.2, 0); g.add(core);
  const shell = mesh(new THREE.SphereGeometry(3.6, 16, 12), 0x6a7a96, { metal: 0.8, rough: 0.2, opacity: 0.55 }); shell.material.depthWrite = false; shell.position.copy(core.position); g.add(shell);
  const turrets = []; [[-12, 5.9, 4], [-12, 5.9, -4], [12, 5.9, 4], [12, 5.9, -4]].forEach(([x, y, z], i) => { const t = new THREE.Group(); t.position.set(x, y, z); const b = mesh(cyl(1.5, 1.8, 1.4, 10), 0x4a4f60, { metal: 0.7 }); t.add(b); const gu = mesh(box(0.5, 0.5, 3), 0x2a2e3a, { metal: 0.7 }); gu.position.set(0, 1, 1.4); t.add(gu); const l = glowMesh(new THREE.SphereGeometry(0.55, 8, 6), 0xff3a2a, 3); l.position.y = 1.4; t.add(l); g.add(t); turrets.push({ node: t, light: l, i }); });
  g.userData = { core, shell, turrets }; return g;
}
