// What you see of your own gun and hands. Drawn in a separate pass on top of the world,
// so the weapon never sinks into a nearby wall.
import * as THREE from "three";
import { makeGlow } from "@/lib/cinematic/atmos";
import { weaponGeoSets, WEAPON_MATS, _merge } from "./soldier";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const M = {};
const mat = (k, c, r, m, extra) => (M[k] ||= new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...(extra || {}) }));
const metal = () => mat("metal", 0x5a6068, 0.38, 0.7); const poly = () => mat("poly", 0x2c2f35, 0.55, 0.15); const steel = () => mat("steel", 0x6a707a, 0.25, 1.0);
const wood = () => mat("wood", 0x3a2a1c, 0.7, 0.05); const glove = () => mat("glove", 0x4a4d54, 0.75, 0.1);
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const add = (g, geo, m, x, y, z, rx = 0, ry = 0, rz = 0) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.rotation.set(rx, ry, rz); g.add(me); return me; };
const cyl = (r, l) => { const c = new THREE.CylinderGeometry(r, r, l, 12); c.rotateX(Math.PI / 2); return c; };

const GUNS = new Set(["rifleT", "rifleCT", "smgT", "smgCT", "pistol", "sniper", "knife"]);
function buildDetailed(id, accent, team) {
  const g = new THREE.Group(); const parts = {}; const set = weaponGeoSets(id, team === "terrorist" ? "terrorist" : "police");
  const mk = (sets) => { const grp = new THREE.Group(); for (const k of Object.keys(sets)) { const me = new THREE.Mesh(_merge(sets[k], false), WEAPON_MATS[k]()); grp.add(me); } return grp; };
  g.add(mk(set.body)); if (Object.keys(set.mag).length) { parts.mag = mk(set.mag); g.add(parts.mag); }
  const acc = mat("acc" + accent, 0x000000, 0.4, 0.2, { emissive: new THREE.Color(accent), emissiveIntensity: 1.6 });
  if (id !== "knife" && id !== "pistol") add(g, B(0.05, 0.006, id === "sniper" ? 0.3 : 0.18), acc, 0, id === "sniper" ? 0.052 : 0.054, -0.2);
  const muzzle = new THREE.Object3D(), eject = new THREE.Object3D(); muzzle.position.set(...set.muzzle); eject.position.set(0.04, 0.03, -0.02); g.add(muzzle, eject);
  return { g, parts, muzzle, eject, grips: { r: set.gripR, l: set.gripL } };
}
function build(id, accent, team) {
  if (GUNS.has(id)) return buildDetailed(id, accent, team);
  const g = new THREE.Group(); const parts = {}; const acc = mat("acc" + accent, 0x000000, 0.4, 0.2, { emissive: new THREE.Color(accent), emissiveIntensity: 1.6 });
  const muzzle = new THREE.Object3D(); const eject = new THREE.Object3D(); g.add(muzzle, eject);
  const grips = { r: [0.0, -0.1, 0.08], l: [0, -0.06, -0.28] };
  if (id === "rifleT" || id === "rifleCT") {
    add(g, B(0.062, 0.095, 0.4), metal(), 0, 0, 0); add(g, B(0.066, 0.05, 0.3), poly(), 0, 0.01, -0.34); add(g, cyl(0.012, 0.36), steel(), 0, 0.012, -0.62);
    add(g, B(0.05, 0.1, 0.22), id === "rifleT" ? wood() : poly(), 0, -0.02, 0.28); add(g, B(0.04, 0.09, 0.05), poly(), 0, -0.095, 0.1, -0.35, 0, 0);
    parts.mag = add(g, B(0.042, 0.15, 0.075), id === "rifleT" ? steel() : poly(), 0, -0.115, -0.07, 0.18, 0, 0);
    add(g, B(0.01, 0.045, 0.01), metal(), 0, 0.075, -0.7); add(g, B(0.02, 0.03, 0.02), metal(), 0, 0.068, 0.12); add(g, B(0.05, 0.015, 0.2), acc, 0, 0.05, -0.1);
    muzzle.position.set(0, 0.012, -0.82); eject.position.set(0.04, 0.03, -0.02); grips.l = [0, -0.07, -0.34];
  } else if (id === "smgT" || id === "smgCT") {
    add(g, B(0.058, 0.09, 0.3), metal(), 0, 0, 0); add(g, B(0.062, 0.06, 0.2), poly(), 0, 0.005, -0.22); add(g, cyl(0.011, 0.18), steel(), 0, 0.01, -0.42);
    add(g, B(0.04, 0.08, 0.16), poly(), 0, -0.01, 0.2); parts.mag = add(g, B(0.036, 0.19, 0.05), steel(), 0, -0.14, -0.04); add(g, B(0.04, 0.09, 0.045), poly(), 0, -0.09, 0.07, -0.3, 0, 0); add(g, B(0.05, 0.014, 0.16), acc, 0, 0.048, -0.06);
    muzzle.position.set(0, 0.01, -0.53); eject.position.set(0.04, 0.03, -0.02); grips.l = [0, -0.06, -0.24];
  } else if (id === "pistol") {
    add(g, B(0.04, 0.05, 0.22), steel(), 0, 0.03, -0.04); add(g, B(0.036, 0.07, 0.17), poly(), 0, -0.02, 0.0); add(g, B(0.034, 0.12, 0.06), poly(), 0, -0.1, 0.06, -0.18, 0, 0); parts.mag = add(g, B(0.03, 0.06, 0.045), metal(), 0, -0.14, 0.07, -0.18, 0, 0);
    add(g, B(0.006, 0.014, 0.01), metal(), 0, 0.062, -0.14); add(g, B(0.018, 0.012, 0.01), acc, 0, 0.062, 0.05);
    muzzle.position.set(0, 0.032, -0.16); eject.position.set(0.03, 0.05, -0.02); grips.r = [0, -0.07, 0.07]; grips.l = [-0.02, -0.08, 0.06];
  } else if (id === "sniper") {
    add(g, B(0.06, 0.09, 0.46), metal(), 0, 0, 0); add(g, cyl(0.014, 0.62), steel(), 0, 0.012, -0.54); add(g, B(0.052, 0.11, 0.3), poly(), 0, -0.02, 0.36);
    add(g, cyl(0.03, 0.34), metal(), 0, 0.105, -0.06); add(g, cyl(0.04, 0.05), metal(), 0, 0.105, -0.25); add(g, cyl(0.038, 0.04), metal(), 0, 0.105, 0.11);
    add(g, B(0.014, 0.02, 0.07), steel(), 0.04, 0.03, 0.04); parts.mag = add(g, B(0.04, 0.09, 0.07), poly(), 0, -0.09, -0.04); add(g, B(0.05, 0.012, 0.3), acc, 0, 0.052, -0.1);
    muzzle.position.set(0, 0.012, -0.88); eject.position.set(0.04, 0.03, -0.02); grips.l = [0, -0.06, -0.34];
  } else if (id === "knife") {
    add(g, B(0.016, 0.065, 0.24), steel(), 0, 0.02, -0.14, 0, 0, 0); add(g, B(0.03, 0.04, 0.12), poly(), 0, 0, 0.04); add(g, B(0.05, 0.01, 0.02), metal(), 0, 0.0, -0.02); add(g, B(0.005, 0.02, 0.2), acc, 0.01, 0.03, -0.14);
    muzzle.position.set(0, 0, -0.3); grips.r = [0, 0, 0.04]; grips.l = [0, -0.2, 0.3];
  } else { // grenades: flash / smoke / he
    const col = id === "flash" ? 0x9a9a8a : id === "smoke" ? 0x4a6a58 : 0x4a5a30;
    if (id === "he") add(g, new THREE.SphereGeometry(0.045, 14, 12), mat("he", col, 0.5, 0.3), 0, 0, 0); else { const c = new THREE.CylinderGeometry(0.036, 0.036, 0.14, 14); add(g, c, mat(id, col, 0.4, 0.5), 0, 0, 0); add(g, new THREE.CylinderGeometry(0.037, 0.037, 0.02, 14), acc, 0, 0.02, 0); }
    add(g, B(0.014, 0.03, 0.014), steel(), 0, 0.075, 0); add(g, B(0.02, 0.005, 0.07), steel(), 0.0, 0.085, 0.02); muzzle.position.set(0, 0, -0.1); grips.r = [0, -0.04, 0.02]; grips.l = [0, -0.2, 0.3];
  }
  return { g, parts, muzzle, eject, grips };
}

export function createViewModel(env) {
  const scene = new THREE.Scene(); if (env) scene.environment = env; scene.environmentIntensity = 0.9;
  const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.02, 10);
  scene.add(camera);
  const hemi = new THREE.HemisphereLight(0xb4c8e8, 0x4a4e58, 4.2); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xdce6ff, 3.6); key.position.set(0.6, 1, 0.8); scene.add(key);
  const lamp = new THREE.PointLight(0xffc880, 0, 6, 2); lamp.position.set(0.3, 0.2, -0.3); camera.add(lamp);
  const root = new THREE.Group(); camera.add(root);
  const models = {}; let cur = null, curId = null, team = "police", accent = 0x3ea8ff;
  const flash = makeGlow(0xffd27a, 0.5, 0); flash.visible = true; flash.material.depthTest = false;
  const sleeveCol = () => (team === "terrorist" ? 0x77704a : 0x2c4d86);
  // arms are rebuilt per model (cheap) so the hands sit on that weapon's grips
  function armsFor(m) {
    const a = new THREE.Group(); const sl = new THREE.MeshStandardMaterial({ color: sleeveCol(), roughness: 0.9 }); const gl = new THREE.MeshStandardMaterial({ color: 0x383b42, roughness: 0.7, metalness: 0.05 }); const gl2 = new THREE.MeshStandardMaterial({ color: 0x50545c, roughness: 0.6, metalness: 0.2 });
    const fore = (x, y, z, rx, rz) => { const cg = new THREE.CapsuleGeometry(0.036, 0.42, 4, 12); cg.rotateX(Math.PI / 2); const f = add(a, cg, sl, x, y, z, rx, 0, rz); const cuff = add(a, new THREE.CylinderGeometry(0.04, 0.04, 0.05, 12), gl, 0, 0, -0.24); cuff.geometry.rotateX(Math.PI / 2); f.add(cuff); return f; };
    fore(m.grips.r[0] + 0.05, m.grips.r[1] - 0.1, m.grips.r[2] + 0.28, 0.35, -0.25); fore(m.grips.l[0] - 0.06, m.grips.l[1] - 0.12, m.grips.l[2] + 0.28, 0.35, 0.5);
    const hand = (p, side, wrap) => { // back of hand, four knuckled fingers, a thumb and a wrist strap
      const h = new THREE.Group(); h.position.set(p[0], p[1], p[2]); h.scale.setScalar(1.35); a.add(h);
      add(h, new RoundedBoxGeometry(0.07, 0.04, 0.09, 2, 0.012), gl, 0, 0.01, 0.01); add(h, new RoundedBoxGeometry(0.06, 0.012, 0.06, 2, 0.004), gl2, 0, 0.032, 0.015);
      for (let i = 0; i < 4; i++) { const fx = -0.026 + i * 0.0175; add(h, new RoundedBoxGeometry(0.016, 0.022, 0.07, 2, 0.007), gl, fx, -0.018, -0.02 + (wrap ? 0.0 : -0.01), wrap ? 0.0 : 0.15); add(h, new RoundedBoxGeometry(0.014, 0.05, 0.016, 2, 0.006), gl, fx, -0.04, -0.045, 0, 0, 0); }
      add(h, new RoundedBoxGeometry(0.022, 0.022, 0.07, 2, 0.008), gl, side * -0.045, 0.0, -0.025, 0.2, side * 0.5, 0); add(h, new RoundedBoxGeometry(0.075, 0.03, 0.03, 2, 0.01), gl2, 0, 0.0, 0.065);
      return h;
    };
    hand(m.grips.r, 1, true); hand(m.grips.l, -1, false);
    m.g.add(a); m.g.scale.setScalar(0.95); m.arms = a; m.sleeve = sl; return a;
  }
  function setTeam(t, accentHex) { team = t; accent = accentHex; for (const k of Object.keys(models)) { root.remove(models[k].g); delete models[k]; } cur = null; curId = null; }
  const BASE = { rifleT: [0.12, -0.13, -0.44], rifleCT: [0.12, -0.13, -0.44], smgT: [0.13, -0.14, -0.42], smgCT: [0.13, -0.14, -0.42], pistol: [0.1, -0.1, -0.38], sniper: [0.13, -0.15, -0.48], knife: [0.15, -0.16, -0.38], flash: [0.17, -0.15, -0.4], smoke: [0.17, -0.15, -0.4], he: [0.17, -0.15, -0.4] };
  const st = { draw: 1, kick: 0, reload: -1, reloadDur: 1, slash: -1, stab: false, throwT: -1, bob: 0, swayX: 0, swayY: 0, scoped: false, pos: new THREE.Vector3(), rot: new THREE.Euler() };
  function setWeapon(id) {
    if (curId === id) return; if (cur) cur.g.visible = false;
    if (!models[id]) { const m = build(id, accent, team); armsFor(m); m.g.add(flash); root.add(m.g); models[id] = m; }
    cur = models[id]; curId = id; cur.g.visible = true; cur.g.add(flash); flash.position.copy(cur.muzzle.position); st.draw = 0; st.reload = -1; st.slash = -1; st.throwT = -1;
  }
  function update(dt, s) {
    if (!cur) return; const b = BASE[curId] || BASE.rifleT;
    st.draw = Math.min(1, st.draw + dt / 0.38); st.kick = Math.max(0, st.kick - dt * (curId === "sniper" ? 2.5 : 9)); st.bob += dt * (6 + s.speed01 * 5) * (s.onGround ? 1 : 0.2);
    const bobAmt = s.speed01 * (s.crouch ? 0.5 : 1) * (s.onGround ? 1 : 0.15);
    let x = b[0] + Math.sin(st.bob) * 0.012 * bobAmt, y = b[1] + Math.abs(Math.cos(st.bob)) * 0.014 * bobAmt - (1 - st.draw) * (1 - st.draw) * 0.34, z = b[2];
    let rx = (1 - st.draw) * -0.9, ry = 0, rz = 0;
    // breathing and look inertia
    const tt = performance.now() * 0.001; y += Math.sin(tt * 1.6) * 0.0025; x += Math.cos(tt * 1.1) * 0.0018;
    st.swayX += (-s.lookDX * 0.0006 - st.swayX) * Math.min(1, dt * 9); st.swayY += (s.lookDY * 0.0006 - st.swayY) * Math.min(1, dt * 9);
    x += st.swayX; y += st.swayY; ry += st.swayX * 3; rx += st.swayY * 3;
    // landing / jumping
    if (!s.onGround) { y += 0.02; rx += 0.05; }
    // recoil
    z += st.kick * 0.07; rx += st.kick * (curId === "sniper" ? 0.22 : 0.1); y += st.kick * 0.012; ry += Math.sin(st.bob * 7) * st.kick * 0.01;
    // reload dip
    if (st.reload >= 0) {
      st.reload += dt / st.reloadDur; const k = st.reload; const dip = Math.sin(Math.min(1, k) * Math.PI);
      if (curId === "knife" || curId === "flash" || curId === "smoke" || curId === "he") { st.reload = -1; } else { y -= dip * 0.12; rx -= dip * 0.5; rz += dip * 0.42; x -= dip * 0.03; if (cur.parts.mag) { const mk = k > 0.25 && k < 0.6 ? (k - 0.25) / 0.35 : k >= 0.6 ? 1 - Math.min(1, (k - 0.6) / 0.2) : 0; cur.parts.mag.position.y = -mk * 0.18; cur.parts.mag.visible = !(k > 0.3 && k < 0.5); } if (k >= 1) { st.reload = -1; if (cur.parts.mag) { cur.parts.mag.visible = true; cur.parts.mag.position.y = 0; } } }
    }
    // knife swing
    if (st.slash >= 0) { st.slash += dt / (st.stab ? 0.4 : 0.34); const k = st.slash; if (k >= 1) st.slash = -1; else if (st.stab) { const e = Math.sin(k * Math.PI); z -= e * 0.28; y += e * 0.02; rx += e * 0.1; } else { const e = Math.sin(k * Math.PI); rz += (k < 0.5 ? -1 : 1) * e * 0.9; x -= e * 0.16; ry += e * 0.6; rx -= e * 0.25; } }
    // grenade throw
    if (st.throwT >= 0) { st.throwT += dt / 0.45; const k = st.throwT; if (k >= 1) st.throwT = -1; else { const e = k < 0.4 ? -k / 0.4 : (k - 0.4) / 0.6; rx += k < 0.4 ? 0.5 * (k / 0.4) : 0.5 - 1.5 * e; z += k < 0.4 ? 0.06 * (k / 0.4) : -0.18 * Math.sin(e * Math.PI * 0.8); y += k < 0.4 ? -0.04 : 0.06 * e; } }
    root.position.set(x, y, z); root.rotation.set(rx, ry, rz);
    flash.material.opacity = Math.max(0, st.kick * 1.8 - 0.3) * (curId === "knife" ? 0 : 1); flash.scale.setScalar(0.3 + st.kick * 0.6);
    root.visible = !s.scoped && !s.hidden;
  }
  return {
    scene, camera, setWeapon, setTeam, update, flashObj: flash,
    kick(a = 1) { st.kick = Math.min(1.2, st.kick + a); }, reload(dur) { st.reload = 0; st.reloadDur = dur; }, cancelReload() { st.reload = -1; if (cur && cur.parts.mag) cur.parts.mag.visible = true; },
    slash(stab) { st.slash = 0; st.stab = !!stab; }, throwNade() { st.throwT = 0; }, drawNow() { st.draw = 0; },
    setLamp(color, intensity) { lamp.color.setHex(color); lamp.intensity = intensity; },
    muzzleWorld(out) { if (!cur) return out; cur.muzzle.getWorldPosition(out); return out; },
    ejectWorld(out) { if (!cur) return out; cur.eject.getWorldPosition(out); return out; },
    resize(aspect) { camera.aspect = aspect; camera.updateProjectionMatrix(); },
  };
}
