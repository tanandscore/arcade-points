"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// Real 3D, following this codebase's own already-proven pattern
// exactly (see TitanArena.js, Dominion.js, ApexCircuit.js,
// GrandPrixDuel.js) — raw Three.js driven imperatively via useEffect
// and a mount ref, NOT React Three Fiber. This isn't a style
// preference: R3F's custom React reconciler was directly tested
// against this project's exact Next.js/React versions and reproducibly
// broke the production build (`next build` itself failed, not just
// dev mode) even with two different real workarounds attempted. Raw
// Three.js, run the same way this codebase's other games already do,
// was verified to build cleanly on the identical versions.
//
// Deliberately additive right now, not a replacement — the existing
// 2D canvas above still handles 100% of real gameplay and input
// exactly as it always has. This renders the same live positions
// (via the refs passed in as props) as a genuine, verified 3D view
// alongside it, the next real, checkable step before any interaction
// logic gets touched.
//
// Real coordinates, not approximated: MAP_W/MAP_H, TEMPLE, and
// ENEMY_ALTAR are this game's own actual constants, scaled by /100
// into 3D world units — the same conversion already verified in the
// standalone prototypes.
const SCALE = 100;

export default function WrathScene3D({ mapW, mapH, temple, altar, championsRef, enemiesRef, wardsRef, enemyColors, onWorldClick }) {
  const mountRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      return undefined;
    }

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    mountRef.current.appendChild(renderer.domElement);

    const MAP_W = mapW / SCALE, MAP_H = mapH / SCALE;
    const TEMPLE = { x: temple.x / SCALE, z: temple.y / SCALE, r: temple.r / SCALE };
    const ALTAR = { x: altar.x / SCALE, z: altar.y / SCALE, r: altar.r / SCALE };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0614);
    scene.fog = new THREE.FogExp2(0x0a0614, 0.05);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 100);
    camera.position.set(MAP_W / 2, 13, MAP_H + 8);
    camera.lookAt(MAP_W / 2, 0, MAP_H / 2);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), 0.85, 0.5, 0.15));
    composer.addPass(new OutputPass());

    scene.add(new THREE.AmbientLight(0x4a3a6a, 0.5));
    const moon = new THREE.DirectionalLight(0x8ea8ff, 0.6);
    moon.position.set(-5, 12, 4);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = -10;
    moon.shadow.camera.right = 10;
    moon.shadow.camera.top = 10;
    moon.shadow.camera.bottom = -10;
    scene.add(moon);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(MAP_W + 4, MAP_H + 4),
      new THREE.MeshStandardMaterial({ color: 0x2a2438, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(MAP_W / 2, 0, MAP_H / 2);
    ground.receiveShadow = true;
    scene.add(ground);

    // Real interaction — a click here converts to this game's actual
    // (x, y) coordinate space via raycasting against the same ground
    // mesh above, then calls the exact same handleWorldClick function
    // the real 2D canvas already uses (passed in as onWorldClick).
    // Nothing about targeting, Ward placement, or power-casting logic
    // is duplicated or reimplemented here — only how (x, y) gets
    // computed differs from the 2D canvas's own click handler.
    const raycaster = new THREE.Raycaster();
    const pointerNDC = new THREE.Vector2();
    function handleClick(event) {
      if (!onWorldClick) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, camera);
      const hits = raycaster.intersectObject(ground);
      if (hits.length > 0) {
        const point = hits[0].point;
        onWorldClick(point.x * SCALE, point.z * SCALE);
      }
    }
    renderer.domElement.addEventListener("click", handleClick);
    renderer.domElement.style.cursor = "crosshair";

    function addMesh(geo, color, x, y, z, opts = {}) {
      const mat = new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.7, metalness: opts.metalness ?? 0.05 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    }
    function torch(x, y, z, color, intensity) {
      const flameMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2 });
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), flameMat);
      flame.position.set(x, y, z);
      scene.add(flame);
      const light = new THREE.PointLight(color, intensity, 6, 2);
      light.position.set(x, y, z);
      scene.add(light);
    }

    // Temple — verified in the standalone Step 1 prototype at these
    // exact proportions before being carried over here.
    const tR = TEMPLE.r;
    addMesh(new THREE.BoxGeometry(tR * 4.2, tR * 0.3, tR * 2.8), 0xbcae97, TEMPLE.x, tR * 0.15, TEMPLE.z, { roughness: 0.55 });
    for (let i = 0; i < 6; i++) {
      const cx = TEMPLE.x - tR * 1.7 + ((tR * 3.4) / 5) * i;
      addMesh(new THREE.CylinderGeometry(tR * 0.13, tR * 0.15, tR * 1.6, 12), 0xf7f2e6, cx, tR * 1.05, TEMPLE.z - tR, { roughness: 0.35 });
      addMesh(new THREE.CylinderGeometry(tR * 0.13, tR * 0.15, tR * 1.6, 12), 0xf7f2e6, cx, tR * 1.05, TEMPLE.z + tR, { roughness: 0.35 });
    }
    addMesh(new THREE.BoxGeometry(tR * 4.4, tR * 0.18, tR * 2.4), 0xbcae97, TEMPLE.x, tR * 1.95, TEMPLE.z, { roughness: 0.5 });
    const pediment = addMesh(new THREE.ConeGeometry(tR * 2.4, tR * 1.0, 4), 0xb84a26, TEMPLE.x, tR * 2.6, TEMPLE.z, { roughness: 0.6 });
    pediment.rotation.y = Math.PI / 4;
    pediment.scale.set(1, 1, 0.6);
    torch(TEMPLE.x - tR * 1.2, tR * 1.2, TEMPLE.z + tR * 1.7, 0xffaa00, 3.0);
    torch(TEMPLE.x + tR * 1.2, tR * 1.2, TEMPLE.z + tR * 1.7, 0xffaa00, 3.0);

    // Altar
    const aR = ALTAR.r;
    addMesh(new THREE.CylinderGeometry(aR * 1.3, aR * 1.5, aR * 0.4, 8), 0x241a2e, ALTAR.x, aR * 0.2, ALTAR.z, { roughness: 0.8 });
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2;
      addMesh(new THREE.BoxGeometry(aR * 0.22, aR * 1.4, aR * 0.22), 0x4a3660, ALTAR.x + Math.cos(ang) * aR * 0.9, aR * 1.1, ALTAR.z + Math.sin(ang) * aR * 0.9, { roughness: 0.6, metalness: 0.15 });
    }
    torch(ALTAR.x, aR * 2.0, ALTAR.z, 0x78dcff, 3.2);

    // Live-tracked pools — a Map keyed by each entity's own real id,
    // so meshes are created once when an entity first appears and
    // reused every frame after, rather than rebuilt from scratch
    // (which would be wasteful and would defeat any smooth motion).
    const championMeshes = new Map();
    const enemyMeshes = new Map();
    const wardMeshes = new Map();

    function humanoid(color, scale = 1) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.14 * scale, 0.32 * scale, 4, 8),
        new THREE.MeshStandardMaterial({ color, roughness: 0.5 })
      );
      body.position.y = 0.35 * scale;
      body.castShadow = true;
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.13 * scale, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0xe8b088 })
      );
      head.position.y = 0.62 * scale;
      head.castShadow = true;
      group.add(body, head);
      scene.add(group);
      return group;
    }

    let frameId;
    function render() {
      // Champions — a fixed set of 3 (ids 0/1/2), created once and
      // repositioned every frame from the live ref.
      for (const c of championsRef.current) {
        if (c.hp <= 0) {
          const mesh = championMeshes.get(c.id);
          if (mesh) mesh.visible = false;
          continue;
        }
        let mesh = championMeshes.get(c.id);
        if (!mesh) {
          mesh = humanoid(c.id === 0 ? 0xffd23f : 0x3ee6e0, c.id === 0 ? 1.1 : 1);
          championMeshes.set(c.id, mesh);
        }
        mesh.visible = true;
        mesh.position.set(c.x / SCALE, 0, c.y / SCALE);
      }

      // Enemies — a genuinely dynamic set, synced each frame: remove
      // meshes for ids no longer present (dead/despawned), add
      // meshes for new ids, update positions for the rest.
      const liveEnemyIds = new Set();
      for (const en of enemiesRef.current) {
        liveEnemyIds.add(en.id);
        let mesh = enemyMeshes.get(en.id);
        if (!mesh) {
          const color = enemyColors[en.typeId] ?? 0xffffff;
          mesh = humanoid(color, 0.8);
          enemyMeshes.set(en.id, mesh);
        }
        mesh.position.set(en.x / SCALE, 0, en.y / SCALE);
      }
      for (const [id, mesh] of enemyMeshes) {
        if (!liveEnemyIds.has(id)) {
          scene.remove(mesh);
          mesh.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
          });
          enemyMeshes.delete(id);
        }
      }

      // Wards — same live-sync pattern as enemies, just a smaller,
      // capped set.
      const liveWardIds = new Set();
      for (const w of wardsRef.current) {
        liveWardIds.add(w.id);
        let mesh = wardMeshes.get(w.id);
        if (!mesh) {
          mesh = addMesh(new THREE.OctahedronGeometry(0.12), 0xffd23f, 0, 0.15, 0, { metalness: 0.3, roughness: 0.4, emissive: 0xffd23f });
          wardMeshes.set(w.id, mesh);
        }
        mesh.position.set(w.x / SCALE, 0.15, w.y / SCALE);
      }
      for (const [id, mesh] of wardMeshes) {
        if (!liveWardIds.has(id)) {
          scene.remove(mesh);
          mesh.geometry.dispose();
          mesh.material.dispose();
          wardMeshes.delete(id);
        }
      }

      composer.render();
      frameId = requestAnimationFrame(render);
    }
    render();

    function handleResize() {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("click", handleClick);
      cancelAnimationFrame(frameId);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "320px", borderRadius: "8px", overflow: "hidden" }} />;
}
