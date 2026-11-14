// Real 3D models for Wrath of Olympus (Upgrade 124): knights, champion, Zeus, monsters, relics and building props.
// Loads light copies of the artist models from /olympus/models/*.glb. Each one is turned to face +Z, stood on the ground and
// scaled to a target height. If a file fails to load the game quietly keeps the old procedural look for that thing.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { PLAYER_COLORS } from "./defs";

export const RM = { ready: false, promise: null, lib: {}, failed: [] };
// h = height in tiles (before the game's own 1.25 unit scale); yaw turns the raw model so its front faces +Z
const SPEC = {
  knight: { h: 1.12, yaw: 0 }, king: { h: 1.75, yaw: Math.PI, anim: true }, zeus_statue: { h: 3.4, yaw: 0 }, zeus_god: { h: 4.2, yaw: -Math.PI / 2 },
  dragon: { h: 2.3, yaw: -Math.PI / 2 }, deathknight: { h: 1.75, yaw: 0 }, assassin: { h: 1.2, yaw: 0 }, warlord: { h: 1.9, yaw: -Math.PI / 2 },
  armor: { h: 1.1, yaw: 0 }, wallshield: { h: 1.0, yaw: 0 }, hammer: { h: 1.0, yaw: 0 }, skelset: { h: 0.9, yaw: 0 },
  kratos: { h: 1.7, yaw: Math.PI, dir: "models2" }, amarok: { h: 2.0, yaw: 0, dir: "models2" }, samurai: { h: 1.55, yaw: Math.PI / 2, dir: "models2" },
  perun: { h: 4.2, yaw: 0, dir: "models2" }, ares: { h: 3.4, yaw: 0, dir: "models2" }, swordstaff: { h: 1.5, rx: Math.PI / 2, fit: 1, dir: "models2" },
  blade: { h: 1.6, rz: Math.PI / 2, fit: 1 }, aegis: { h: 1.0, fit: 1 }, greatsword: { h: 1.0, rx: Math.PI / 2, fit: 1 },
};

export function preloadRealModels() {
  if (RM.promise) return RM.promise;
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  RM.promise = Promise.all(Object.keys(SPEC).map((k) => new Promise((res) => {
    loader.load(`/olympus/${SPEC[k].dir || "models"}/${k}.glb`, (g) => {
      try {
        const spec = SPEC[k]; const inner = g.scene; const wrap = new THREE.Group(); wrap.add(inner); inner.rotation.set(spec.rx || 0, spec.yaw || 0, spec.rz || 0, "YXZ"); wrap.updateMatrixWorld(true);
        const bb = new THREE.Box3().setFromObject(inner); const size = bb.getSize(new THREE.Vector3()); const sc = spec.h / Math.max(0.0001, spec.fit ? Math.max(size.x, size.y, size.z) : size.y);
        inner.scale.multiplyScalar(sc); wrap.updateMatrixWorld(true); const b2 = new THREE.Box3().setFromObject(inner);
        inner.position.set(-(b2.min.x + b2.max.x) / 2, -b2.min.y, -(b2.min.z + b2.max.z) / 2);
        inner.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; for (const m of [].concat(o.material)) { if (m && m.map) m.map.anisotropy = 4; if (m && m.metalness > 0.6) m.metalness = 0.6; } } });
        RM.lib[k] = { wrap, anims: g.animations || [], spec };
      } catch (e) { console.warn("model prep failed", k, e); RM.failed.push(k); }
      res();
    }, undefined, (e) => { console.warn("model failed", k, e); RM.failed.push(k); res(); });
  }))).then(() => { RM.ready = Object.keys(RM.lib).length > 0; return RM; });
  return RM.promise;
}

export const has = (k) => !!RM.lib[k];
// one copy of a model (skeleton-safe); scale is a multiplier on the library height
export function instance(k, scale = 1) {
  const t = RM.lib[k]; if (!t) return null;
  const c = SkeletonUtils.clone(t.wrap); c.scale.setScalar(scale); c.userData.anims = t.anims; return c;
}

const _ring = {};
const ringGeo = new THREE.TorusGeometry(1, 0.07, 6, 28);
export function teamRing(owner, radius) {
  const m = (_ring[owner] ||= new THREE.MeshBasicMaterial({ color: PLAYER_COLORS[owner] ?? 0x888888, transparent: true, opacity: 0.9, depthWrite: false }));
  const r = new THREE.Mesh(ringGeo, m); r.rotation.x = -Math.PI / 2; r.position.y = 0.045; r.scale.setScalar(radius); r.renderOrder = 5; return r;
}

// a fighting unit made of one model. P has the same shape animateUnit expects, plus P.real so the real animator is used.
export function makeRealUnit(key, owner, o = {}) {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const P = { root, body, kind: "real", real: true, owner, key, t0: Math.random() * 6 };
  const m = instance(key, o.scale || 1); if (!m) return null; body.add(m); P.model = m;
  root.add(teamRing(owner, o.ring || 0.42));
  if (SPEC[key].anim && m.userData.anims.length) {
    const mixer = new THREE.AnimationMixer(m); const by = (re) => m.userData.anims.find((a) => re.test(a.name));
    const idle = by(/FIGHTIDLE/i), walk = by(/WALK/i), run = by(/run/i);
    P.mixer = mixer; P.acts = {}; for (const [n, c] of [["idle", idle], ["walk", walk || run]]) if (c) { const a = mixer.clipAction(c); a.play(); a.enabled = true; a.setEffectiveWeight(n === "idle" ? 1 : 0); P.acts[n] = a; }
    P.cur = "idle"; mixer.update(Math.random() * 2);
  }
  if (o.hand) attachHand(P, o.hand);
  return P;
}
function attachHand(P, prop) {
  let hand = null; P.model.traverse((b) => { if (!hand && b.isBone && /R.?Hand/i.test(b.name) && !/Finger/i.test(b.name)) hand = b; });
  if (!hand) return;
  const s = instance(prop.key, 1); if (!s) return; P.root.updateMatrixWorld(true); const ws = new THREE.Vector3(); hand.getWorldScale(ws);
  s.scale.setScalar((prop.scale || 1) / Math.max(1e-6, ws.x)); s.position.set(...(prop.pos || [0, 0, 0])); s.rotation.set(...(prop.rot || [0, 0, 0])); hand.add(s); P.prop = s;
}

export function animateReal(P, u, time, spd, dt = 0.016) {
  const moving = u.anim === "walk" && spd > 0.2; const t = time + P.t0; const att = u.anim === "attack";
  if (P.mixer) {
    const want = moving ? "walk" : "idle";
    for (const n of Object.keys(P.acts)) { const a = P.acts[n]; const goal = n === want ? 1 : 0; a.setEffectiveWeight(a.getEffectiveWeight() + (goal - a.getEffectiveWeight()) * Math.min(1, dt * 9)); }
    if (P.acts.idle) P.acts.idle.timeScale = att ? 2.4 : 1; if (P.acts.walk) P.acts.walk.timeScale = 1.15;
    P.mixer.update(dt);
    if (att) { const ap = Math.min(1, (u.animT || 0) / 0.5); P.body.position.z = Math.sin(ap * Math.PI) * 0.18; P.body.rotation.x = Math.sin(ap * Math.PI) * 0.16; } else { P.body.position.z = 0; P.body.rotation.x = 0; }
    return;
  }
  // models with no skeleton: bob while walking, sway when idle, lunge when attacking
  const sw = moving ? Math.sin(t * 8.5) : 0;
  P.body.position.y = moving ? Math.abs(sw) * 0.07 : Math.sin(t * 2 + u.id) * 0.012;
  P.body.rotation.z = moving ? sw * 0.06 : 0;
  if (att) { const ap = Math.min(1, (u.animT || 0) / 0.5), s = Math.sin(ap * Math.PI); P.body.rotation.x = s * 0.4 - 0.05; P.body.position.z = s * 0.3; }
  else { P.body.rotation.x = moving ? 0.07 : 0; P.body.position.z = 0; }
}
