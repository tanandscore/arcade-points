// A human-proportioned soldier made of simple solid shapes, facing -Z (the same way a camera looks at yaw 0).
// Stands 1.8 m tall. Animation is driven from outside with pose().
import * as THREE from "three";
import { makeGlow } from "@/lib/cinematic/atmos";

const matCache = new Map();
const std = (key, color, r = 0.75, m = 0.05, extra) => {
  if (matCache.has(key)) return matCache.get(key);
  const mt = new THREE.MeshStandardMaterial({ color, roughness: r, metalness: m, ...(extra || {}) }); matCache.set(key, mt); return mt;
};

export const TEAM_LOOK = {
  terrorist: { vest: 0x5a1f22, fat: 0x2c2a2b, accent: 0xff5a3c, name: "NIGHTFALL" },
  police: { vest: 0x1d3556, fat: 0x2a3340, accent: 0x3ea8ff, name: "SENTINEL" },
};

export function buildSoldier(team) {
  const L = TEAM_LOOK[team]; const g = new THREE.Group(); const u = { root: g, team };
  const fat = std("fat" + team, L.fat, 0.92, 0), vest = std("vest" + team, L.vest, 0.7, 0.08), plate = std("plate", 0x17191c, 0.5, 0.4), skin = std("skin", 0xb88a6c, 0.7, 0), strap = std("strap", 0x25282b, 0.8, 0.1);
  const visor = std("visor" + team, 0x000000, 0.2, 0.2, { emissive: new THREE.Color(L.accent), emissiveIntensity: 2.6 });
  const add = (geo, mat, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = false; parent.add(m); return m; };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  // legs: hip pivot -> thigh, knee pivot -> shin
  const leg = (sx) => {
    const hip = new THREE.Group(); hip.position.set(sx * 0.12, 0.92, 0); g.add(hip);
    add(B(0.19, 0.46, 0.22), fat, 0, -0.22, 0, hip); add(B(0.2, 0.14, 0.23), plate, 0, -0.12, -0.02, hip);
    const knee = new THREE.Group(); knee.position.set(0, -0.45, 0); hip.add(knee);
    add(B(0.17, 0.4, 0.2), fat, 0, -0.2, 0, knee); add(B(0.2, 0.14, 0.12), plate, 0, -0.04, -0.1, knee);
    add(B(0.2, 0.11, 0.34), plate, 0, -0.43, -0.05, knee);
    return { hip, knee };
  };
  u.legL = leg(-1); u.legR = leg(1);
  // upper body (rotates to aim)
  const upper = new THREE.Group(); upper.position.set(0, 0.95, 0); g.add(upper); u.upper = upper;
  add(B(0.4, 0.55, 0.24), vest, 0, 0.3, 0, upper);
  add(B(0.34, 0.3, 0.06), plate, 0, 0.36, -0.14, upper);
  add(B(0.38, 0.07, 0.26), strap, 0, 0.05, 0, upper);
  for (const sx of [-1, 1]) add(B(0.1, 0.13, 0.07), plate, sx * 0.1, 0.09, -0.15, upper);
  add(B(0.3, 0.38, 0.12), strap, 0, 0.34, 0.17, upper); // pack
  for (const sx of [-1, 1]) add(new THREE.SphereGeometry(0.1, 8, 6), vest, sx * 0.25, 0.54, 0, upper);
  add(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8), skin, 0, 0.62, 0, upper);
  const head = new THREE.Group(); head.position.set(0, 0.74, 0); upper.add(head); u.head = head;
  add(new THREE.SphereGeometry(0.115, 12, 10), skin, 0, 0, 0, head);
  add(new THREE.SphereGeometry(0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), vest, 0, 0.02, 0, head);
  add(B(0.22, 0.05, 0.08), visor, 0, 0.01, -0.12, head);
  add(B(0.14, 0.05, 0.1), plate, 0, 0.1, -0.1, head);
  // arms + weapon held across the chest
  const gun = new THREE.Group(); gun.position.set(0.1, 0.36, -0.28); upper.add(gun); u.gun = gun;
  add(B(0.07, 0.11, 0.62), plate, 0, 0, -0.1, gun); add(B(0.045, 0.045, 0.36), plate, 0, 0.02, -0.52, gun);
  add(B(0.06, 0.2, 0.07), plate, 0, -0.14, 0.04, gun); add(B(0.05, 0.14, 0.12), strap, 0, -0.1, -0.3, gun); add(B(0.09, 0.1, 0.22), fat, 0, 0.0, 0.3, gun);
  const mflash = makeGlow(0xffd27a, 0.7, 0); mflash.position.set(0, 0.02, -0.74); gun.add(mflash); u.mflash = mflash;
  const arm = (sx, z, rotY) => { const a = add(B(0.09, 0.09, 0.34), vest, sx * 0.2, 0.34, z, upper); a.rotation.y = rotY; return a; };
  u.armR = arm(1, -0.2, 0.55); u.armL = arm(-1, -0.28, -0.35);
  add(B(0.08, 0.08, 0.1), std("glove", 0x0f1012, 0.7, 0.1), 0.11, 0.36, -0.42, upper);
  add(B(0.08, 0.08, 0.1), std("glove", 0x0f1012, 0.7, 0.1), 0.0, 0.34, -0.46, upper);
  // team colour band so the allegiance reads at a distance
  const band = add(B(0.42, 0.06, 0.26), std("band" + team, L.accent, 0.5, 0, { emissive: new THREE.Color(L.accent), emissiveIntensity: 1.2 }), 0, 0.56, 0, upper); u.band = band;
  // shadow-only blob so shadows read well on dark floors
  u.walkPhase = Math.random() * 6;
  return u;
}

// pose: { speed (0..1 of run), crouch (0..1), yawAim, pitch, dead (0..1 fall progress), fire (0..1), dt }
export function poseSoldier(u, p) {
  u.walkPhase += p.speed * p.dt * 9.5;
  const s = Math.sin(u.walkPhase) * p.speed, c = Math.cos(u.walkPhase) * p.speed;
  const cr = p.crouch || 0;
  u.legL.hip.rotation.x = s * 0.7 - cr * 0.9; u.legR.hip.rotation.x = -s * 0.7 - cr * 0.9;
  u.legL.knee.rotation.x = Math.max(0, -c) * 0.9 + cr * 1.5; u.legR.knee.rotation.x = Math.max(0, c) * 0.9 + cr * 1.5;
  u.upper.position.y = 0.95 - cr * 0.34 + Math.abs(s) * 0.025; u.upper.position.z = -cr * 0.04;
  u.upper.rotation.y = p.torsoYaw || 0; u.head.rotation.x = p.pitch * 0.5; u.gun.rotation.x = p.pitch * 0.7;
  u.mflash.material.opacity = p.fire > 0 ? Math.min(1, p.fire * 1.4) : 0;
  const d = p.dead || 0;
  u.root.rotation.x = -d * 1.45; u.root.position.y = (p.baseY || 0) - d * 0.0;
}
