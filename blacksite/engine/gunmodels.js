// Operation Blacksite — the real gun models (see /credits for the artists). Every weapon except the knife is a glTF model in /blacksite/guns/<id>.glb,
// prepared so that the barrel points down -Z, up is +Y and the origin sits at the trigger, in metres.
//   loadGuns() -> Promise (loads every gun once; guns that fail to load are drawn as a plain block so the game still plays)
//   gunClone(id) -> { group, muzzle:[x,y,z], r:[x,y,z], l:[x,y,z], flashSize }   (r / l = where the right / left hand grips)
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { MODEL_IDS } from "./weapons";

const BASE = "/blacksite/guns/";
// [y, z] of the muzzle, the trigger hand and the front hand in gun space (measured when the models were prepared)
const CFG = {
  pistol: { mz: [0.02, -0.144], r: [-0.04, 0.045], l: [-0.07, 0.02], fl: 0.45 },
  deagle: { mz: [0.015, -0.162], r: [-0.045, 0.045], l: [-0.075, 0.02], fl: 0.55 },
  scorp: { mz: [0.02, -0.286], r: [-0.075, 0.05], l: [-0.04, -0.14], fl: 0.8 },
  reaper: { mz: [0.02, -0.275], r: [-0.08, 0.05], l: [-0.05, -0.13], fl: 0.8 },
  hawk: { mz: [0.02, -0.286], r: [-0.075, 0.05], l: [-0.04, -0.14], fl: 0.8 },
  ironwood: { mz: [0.03, -0.51], r: [-0.09, 0.05], l: [-0.03, -0.22], fl: 1.0 },
  nomad: { mz: [0.03, -0.384], r: [-0.09, 0.05], l: [-0.04, -0.16], fl: 1.0 },
  sunda: { mz: [0.03, -0.346], r: [-0.09, 0.05], l: [-0.04, -0.16], fl: 1.0 },
  warden: { mz: [0.03, -0.504], r: [-0.09, 0.05], l: [-0.04, -0.25], fl: 1.0 },
  guardian: { mz: [0.03, -0.6], r: [-0.09, 0.05], l: [-0.04, -0.28], fl: 1.0 },
  lionheart: { mz: [0.03, -0.36], r: [-0.09, 0.05], l: [-0.04, -0.16], fl: 1.0 },
  alpine: { mz: [0.03, -0.379], r: [-0.09, 0.05], l: [-0.04, -0.16], fl: 1.0 },
  ranger: { mz: [0.03, -0.522], r: [-0.09, 0.05], l: [-0.04, -0.24], fl: 1.0 },
  longshot: { mz: [0.03, -0.638], r: [-0.09, 0.05], l: [-0.04, -0.28], fl: 1.2 },
  ghost: { mz: [0.03, -0.632], r: [-0.09, 0.05], l: [-0.04, -0.3], fl: 1.2 },
  marshal: { mz: [0.03, -0.58], r: [-0.09, 0.05], l: [-0.04, -0.28], fl: 1.1 },
};
const store = {}; let loading = null;
export const gunsReady = () => MODEL_IDS.filter((k) => k !== "knife").every((id) => store[id]);
export function loadGuns() {
  if (loading) return loading;
  const ld = new GLTFLoader(); ld.setMeshoptDecoder(MeshoptDecoder);
  loading = Promise.all(MODEL_IDS.filter((k) => k !== "knife").map((id) => new Promise((res) => {
    ld.load(BASE + id + ".glb", (g) => {
      g.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; if (o.material) { o.material.side = THREE.FrontSide; o.material.envMapIntensity = 0.8; } } });
      store[id] = g.scene; res();
    }, undefined, () => res());
  })));
  return loading;
}
const fallback = (id) => { const g = new THREE.Group(); const w = id === "pistol" || id === "deagle" ? 0.2 : 0.8; const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, w), new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.6, metalness: 0.4 })); m.position.set(0, 0, -w / 2 + 0.08); g.add(m); return g; };
export function gunClone(id) {
  const c = CFG[id] || CFG.warden; const src = store[id]; const group = src ? src.clone(true) : fallback(id);
  return { group, muzzle: [0, c.mz[0], c.mz[1]], r: [0, c.r[0], c.r[1]], l: [0, c.l[0], c.l[1]], flashSize: c.fl };
}
