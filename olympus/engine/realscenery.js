// Real trees for Wrath of Olympus (Upgrade 119). Loads a light copy of the artist tree library (public/olympus/trees_lite.glb)
// and shares the tree atlas already shipped with Midnight Burn. If anything fails the game falls back to the old simple trees.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

export const REAL = { ready: false, failed: false, items: [], atlas: null, promise: null };
// target height (in tiles) for each library tree; the game map is 1 tile = 1 unit and a villager is about 0.8 tall
const GREEK = { tree_realistic: 2.7, tree_gn: 2.5, tree_mango: 2.2, tree_tree2: 2.5, tree_seta_T1: 2.7, tree_seta_T2: 2.7, tree_seta_T10: 3.1, tree_seta_T14: 3.1 };

export function preloadRealScenery() {
  if (REAL.promise) return REAL.promise;
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder); const tl = new THREE.TextureLoader();
  const atlas = new Promise((res) => { const t = tl.load("/midnightburn/city/trees_lib_atlas.webp", () => res(t), undefined, () => res(null)); t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; });
  const geo = new Promise((res, rej) => loader.load("/olympus/trees_lite.glb", res, undefined, rej));
  REAL.promise = Promise.all([geo, atlas]).then(([g, tex]) => {
    g.scene.updateMatrixWorld(true); const items = [];
    g.scene.traverse((o) => {
      if (!o.isMesh) return; const target = GREEK[o.name] || (o.parent && GREEK[o.parent.name]); if (!target) return;
      const geom = o.geometry.clone(); geom.applyMatrix4(o.matrixWorld); geom.computeBoundingBox(); const bb = geom.boundingBox;
      geom.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2); // stand on the ground, centred
      const h = Math.max(0.1, bb.max.y - bb.min.y); geom.deleteAttribute("color");
      items.push({ name: o.name, geom, k: target / h, wide: (bb.max.x - bb.min.x) / h });
    });
    REAL.items = items; REAL.atlas = tex; REAL.ready = items.length > 0 && !!tex; return REAL;
  }).catch((e) => { console.warn("olympus trees failed to load", e); REAL.failed = true; return REAL; });
  return REAL.promise;
}

export function realTreeMaterial() {
  // the atlas is dark and flat under the game light, so lift it with a gentle glow of its own colours and a warmer tint
  const m = new THREE.MeshStandardMaterial({ map: REAL.atlas, color: 0xfff3dc, roughness: 0.9, metalness: 0, side: THREE.DoubleSide, alphaTest: 0.5, emissive: 0xffffff, emissiveMap: REAL.atlas, emissiveIntensity: 0.22 });
  return m;
}
