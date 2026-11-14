// Operation Blacksite — real, hand-modelled soldiers (see /credits for the artists).
//
// The game's own soldier skeleton (./soldier) still decides how every soldier moves: walking, crouching, aiming, firing, dying. It is kept as an
// invisible "driver". These real models are skinned characters; each frame this file copies the driver's pose onto the model's own bones, so all the
// existing animation, aiming and hand placement keep working and nothing else in the game had to change.
//
//   loadRealSoldiers() -> Promise (loads once; the game falls back to the built soldiers if a file cannot be loaded)
//   makeRealBody(team, seed) -> { fit, apply(driverBones) } or null
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

const BASE = "/blacksite/soldiers/";
// which model each side wears. Nightfall alternates between two different men; Sentinel is the KSK-style operator.
const SETS = { terrorist: ["phoenix", "leet"], police: ["ksk"] };
const T = {}; // file -> { scene, key -> bone name regex matched }

// driver bone -> regex on the model's bone names (names lose ':' when loaded, so the patterns allow for that)
const SRC = (s) => ({ hips: /^pelvis/, spine: /^spine_1/, chest: /^spine_3/, neck: /^neck_0/, head: /^head_0/,
  uaL: /^arm_upper_L_\d+$/, faL: /^arm_lower_L_\d+$/, uaR: /^arm_upper_R_\d+$/, faR: /^arm_lower_R_\d+$/,
  thL: /^leg_upper_L_\d+$/, knL: /^leg_lower_L_\d+$/, ftL: /^ankle_L/, thR: /^leg_upper_R_\d+$/, knR: /^leg_lower_R_\d+$/, ftR: /^ankle_R/ });
const MIX = { hips: /^mixamorig:?Hips/, spine: /^mixamorig:?Spine1_/, chest: /^mixamorig:?Spine2_/, neck: /^mixamorig:?Neck_/, head: /^mixamorig:?Head_\d+$/,
  uaL: /^mixamorig:?LeftArm_/, faL: /^mixamorig:?LeftForeArm_/, uaR: /^mixamorig:?RightArm_/, faR: /^mixamorig:?RightForeArm_/,
  thL: /^mixamorig:?LeftUpLeg_/, knL: /^mixamorig:?LeftLeg_/, ftL: /^mixamorig:?LeftFoot_/, thR: /^mixamorig:?RightUpLeg_/, knR: /^mixamorig:?RightLeg_/, ftR: /^mixamorig:?RightFoot_/ };
const MAPS = { phoenix: SRC(), leet: SRC(), ksk: MIX };
// the driver's parent chain, and which child gives each limb its direction
const PARENT = { hips: null, spine: "hips", chest: "spine", neck: "chest", head: "neck", uaL: "chest", uaR: "chest", faL: "uaL", faR: "uaR", thL: "hips", thR: "hips", knL: "thL", knR: "thR", ftL: "knL", ftR: "knR" };
const LIMB_CHILD = { uaL: "faL", uaR: "faR", thL: "knL", thR: "knR", faL: "hand", faR: "hand", knL: "ftL", knR: "ftR" };
const ORDER = ["hips", "spine", "chest", "neck", "head", "uaL", "uaR", "faL", "faR", "thL", "thR", "knL", "knR", "ftL", "ftR"];

let loading = null;
export function loadRealSoldiers() {
  if (loading) return loading;
  const loader = new GLTFLoader();
  const files = [...new Set(Object.values(SETS).flat())];
  loading = Promise.all(files.map((f) => new Promise((res) => loader.load(BASE + f + ".glb", (g) => { T[f] = g.scene; res(true); }, undefined, () => res(false))))).then((r) => r.every(Boolean));
  return loading;
}
export const realReady = (team) => !!SETS[team] && SETS[team].every((f) => T[f]);

const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _DOWN = new THREE.Vector3(0, -1, 0);
// the transform of a node relative to the soldier's root, from its own chain of parents (so the root's own tilt, e.g. when falling, is left out)
function chain(node, top, outQ) { outQ.identity(); let s = 1; for (let n = node; n && n !== top.parent; n = n.parent) { outQ.premultiply(_q2.copy(n.quaternion)); s *= n.scale.x; } return s; }

export function makeRealBody(team, seed) {
  if (!realReady(team)) return null;
  const set = SETS[team]; const file = set[Math.abs(seed) % set.length]; const tpl = T[file];
  const model = cloneSkinned(tpl); const fit = new THREE.Group(); fit.add(model); const map = MAPS[file];
  const root = new THREE.Group(); root.add(fit); root.updateMatrixWorld(true); // temporary parent so world == root space
  // find the bones
  const bones = {}; model.traverse((n) => { if (!n.isBone) return; for (const k of ORDER) if (!bones[k] && map[k].test(n.name)) bones[k] = n; });
  const missing = ORDER.filter((k) => !bones[k]); if (missing.length) { console.warn("real soldier: bones missing", file, missing); return null; }
  // size: 1.8 m tall, feet on the ground, facing -Z (the way the game's soldiers face)
  const feet = [bones.ftL, bones.ftR]; const fl = feet[0].children.find((c) => c.isBone) || feet[0];
  fl.getWorldPosition(_v); feet[0].getWorldPosition(_v2); const fwd = _v.clone().sub(_v2); fwd.y = 0; // ankle -> ball of the foot
  fit.rotation.y = Math.PI - Math.atan2(fwd.x, fwd.z); fit.updateMatrixWorld(true); // turn so that 'forward' becomes -Z
  const bb = new THREE.Box3().setFromObject(model, true); const h = bb.max.y - bb.min.y || 1; const k = 1.8 / h; fit.scale.setScalar(k); fit.updateMatrixWorld(true);
  const bb2 = new THREE.Box3().setFromObject(model, true); fit.position.y -= bb2.min.y; fit.position.x -= (bb2.min.x + bb2.max.x) / 2; fit.position.z -= (bb2.min.z + bb2.max.z) / 2; fit.updateMatrixWorld(true);
  // the model's right-hand bone must end up on +X; if not (mirrored), flip the turn by 180 degrees
  bones.uaR.getWorldPosition(_v); bones.uaL.getWorldPosition(_v2); if (_v.x < _v2.x) { fit.rotation.y += Math.PI; fit.updateMatrixWorld(true); }
  model.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; const m = o.material; if (m) { m.side = THREE.FrontSide; if (m.map) m.map.anisotropy = 4; m.envMapIntensity = 0.7; } } });
  // rest data in root space
  const rest = {}, qc = {};
  const wq = (b) => { const q = new THREE.Quaternion(); b.getWorldQuaternion(q); return q; };
  for (const key of ORDER) rest[key] = { q: wq(bones[key]) };
  const wp = (b) => b.getWorldPosition(new THREE.Vector3());
  for (const key of Object.keys(LIMB_CHILD)) {
    const ck = LIMB_CHILD[key]; const child = ck === "hand" ? bones[key].children.find((c) => c.isBone && /hand|wrist/i.test(c.name)) || bones[key].children.find((c) => c.isBone) : bones[ck];
    const dir = child ? wp(child).sub(wp(bones[key])).normalize() : _DOWN.clone(); qc[key] = new THREE.Quaternion().setFromUnitVectors(dir, _DOWN);
  }
  const hipRest = wp(bones.hips); const hipDriverY = 0.93;
  const order = ORDER.slice().sort((a, b) => depth(bones[a]) - depth(bones[b]));
  function depth(n) { let d = 0; while (n.parent) { d++; n = n.parent; } return d; }
  // detach from the temporary parent: the caller adds `fit` to the soldier's root
  root.remove(fit);
  const dq = {}; const tq = new THREE.Quaternion(), pq = new THREE.Quaternion();
  function apply(D) { // D: the driver's bones (hips, spine, ...)
    // driver world rotations relative to the root
    for (const key of ORDER) { const pk = PARENT[key]; if (pk) dq[key] = (dq[key] || (dq[key] = new THREE.Quaternion())).copy(dq[pk]).multiply(D[key].quaternion); else (dq[key] || (dq[key] = new THREE.Quaternion())).copy(D[key].quaternion); }
    for (const key of order) {
      const b = bones[key]; tq.copy(dq[key]); if (qc[key]) tq.multiply(qc[key]); tq.multiply(rest[key].q);
      const s = chain(b.parent, fit, pq); // parent's rotation relative to the root (fit included)
      b.quaternion.copy(pq).invert().multiply(tq);
      if (key === "hips") { // follow the driver's pelvis up/down and sideways (crouch, bob, falling)
        _v.set(D.hips.position.x, D.hips.position.y - hipDriverY, D.hips.position.z).applyQuaternion(pq.invert()).divideScalar(s || 1);
        b.position.copy(b.userData.restPos || (b.userData.restPos = b.position.clone())).add(_v);
      }
    }
  }
  return { fit, apply, file };
}
