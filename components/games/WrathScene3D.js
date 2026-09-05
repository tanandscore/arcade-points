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
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), 0.35, 0.5, 0.5));
    composer.addPass(new OutputPass());

    scene.add(new THREE.AmbientLight(0x4a3a6a, 0.7));
    const moon = new THREE.DirectionalLight(0x8ea8ff, 0.7);
    moon.position.set(-5, 12, 4);
    moon.castShadow = true;
    moon.shadow.mapSize.set(1024, 1024);
    moon.shadow.camera.left = -10;
    moon.shadow.camera.right = 10;
    moon.shadow.camera.top = 10;
    moon.shadow.camera.bottom = -10;
    scene.add(moon);

    // Real elevation for a war-torn battlefield feel, verified in the
    // standalone prototype before being ported here — rockier, sharper
    // variation than Kingdoms of Ash's gentle rolling hills, plus a
    // subtle central dip where the two sides' forces actually clash.
    // The height-sampling sign flip (worldZ = MAP_H/2 - localY, not +)
    // was confirmed correct there by matrix computation before this
    // integration, not re-derived from scratch here.
    function terrainHeight(x, z) {
      const midX = MAP_W / 2, midZ = MAP_H / 2;
      const distFromCenter = Math.hypot(x - midX, z - midZ) / Math.max(MAP_W, MAP_H);
      const dip = -0.12 * Math.max(0, 1 - distFromCenter * 2.2);
      return Math.sin(x * 0.55) * 0.16 + Math.cos(z * 0.48) * 0.16 + Math.sin((x + z) * 0.32) * 0.12 + dip;
    }
    const segs = 44;
    const groundGeo = new THREE.PlaneGeometry(MAP_W + 4, MAP_H + 4, segs, Math.round(segs * (MAP_H / MAP_W)));
    const gpos = groundGeo.getAttribute("position");
    const gcolors = [];
    const lowColor = new THREE.Color(0x1e1830);
    const highColor = new THREE.Color(0x342a48);
    for (let i = 0; i < gpos.count; i++) {
      const worldX = gpos.getX(i) + MAP_W / 2, worldZ = MAP_H / 2 - gpos.getY(i);
      const h = terrainHeight(worldX, worldZ);
      gpos.setZ(i, h);
      const t = THREE.MathUtils.clamp((h + 0.3) / 0.6, 0, 1);
      const c = lowColor.clone().lerp(highColor, t);
      gcolors.push(c.r, c.g, c.b);
    }
    groundGeo.setAttribute("color", new THREE.Float32BufferAttribute(gcolors, 3));
    groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
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

    // Temple — genuinely rebuilt for the 10x pass, not just enlarged:
    // a real two-tier stepped stylobate, a full peristyle of columns
    // on all four sides (not just front/back pairs), a proper
    // pediment with a raised central emblem, an eternal flame altar
    // at the top of the steps, and four corner torches plus the
    // center one. Verified in the standalone prototype, including a
    // real over-exposure bug found there: the extra torches blew out
    // the columns to near-white at close range until bloom strength/
    // threshold and light intensities were retuned and re-verified —
    // those exact corrected values are used here, not the originals.
    const tcH = terrainHeight(TEMPLE.x, TEMPLE.z);
    const tR = TEMPLE.r;
    addMesh(new THREE.BoxGeometry(tR * 5.2, tR * 0.22, tR * 3.6), 0x8a7a62, TEMPLE.x, tcH + tR * 0.11, TEMPLE.z, { roughness: 0.85 });
    addMesh(new THREE.BoxGeometry(tR * 4.6, tR * 0.22, tR * 3.0), 0xa89a80, TEMPLE.x, tcH + tR * 0.33, TEMPLE.z, { roughness: 0.75 });
    addMesh(new THREE.BoxGeometry(tR * 4.2, tR * 0.2, tR * 2.8), 0xbcae97, TEMPLE.x, tcH + tR * 0.54, TEMPLE.z, { roughness: 0.55 });
    const colXs = [-1.7, -1.02, -0.34, 0.34, 1.02, 1.7];
    for (const cx of colXs) {
      addMesh(new THREE.CylinderGeometry(tR * 0.13, tR * 0.15, tR * 1.6, 12), 0xf7f2e6, TEMPLE.x + cx * tR, tcH + tR * 1.44, TEMPLE.z - tR * 1.3, { roughness: 0.35 });
      addMesh(new THREE.CylinderGeometry(tR * 0.13, tR * 0.15, tR * 1.6, 12), 0xf7f2e6, TEMPLE.x + cx * tR, tcH + tR * 1.44, TEMPLE.z + tR * 1.3, { roughness: 0.35 });
    }
    const colZs = [-0.85, 0, 0.85];
    for (const cz of colZs) {
      addMesh(new THREE.CylinderGeometry(tR * 0.13, tR * 0.15, tR * 1.6, 12), 0xf7f2e6, TEMPLE.x - tR * 1.9, tcH + tR * 1.44, TEMPLE.z + cz * tR, { roughness: 0.35 });
      addMesh(new THREE.CylinderGeometry(tR * 0.13, tR * 0.15, tR * 1.6, 12), 0xf7f2e6, TEMPLE.x + tR * 1.9, tcH + tR * 1.44, TEMPLE.z + cz * tR, { roughness: 0.35 });
    }
    addMesh(new THREE.BoxGeometry(tR * 4.6, tR * 0.18, tR * 2.9), 0xbcae97, TEMPLE.x, tcH + tR * 2.34, TEMPLE.z, { roughness: 0.5 });
    const pediment = addMesh(new THREE.ConeGeometry(tR * 2.6, tR * 1.05, 4), 0xb84a26, TEMPLE.x, tcH + tR * 3.0, TEMPLE.z, { roughness: 0.6 });
    pediment.rotation.y = Math.PI / 4;
    pediment.scale.set(1, 1, 0.62);
    addMesh(new THREE.OctahedronGeometry(tR * 0.22), 0xffd23f, TEMPLE.x, tcH + tR * 2.95, TEMPLE.z, { roughness: 0.3, metalness: 0.4 });
    addMesh(new THREE.CylinderGeometry(tR * 0.28, tR * 0.32, tR * 0.5, 10), 0x9a8c72, TEMPLE.x, tcH + tR * 0.79, TEMPLE.z, { roughness: 0.6 });
    torch(TEMPLE.x, tcH + tR * 1.15, TEMPLE.z, 0xffaa00, 2.6 * 0.4);
    torch(TEMPLE.x - tR * 1.9, tcH + tR * 1.2, TEMPLE.z + tR * 1.9, 0xffaa00, 3.0 * 0.4);
    torch(TEMPLE.x + tR * 1.9, tcH + tR * 1.2, TEMPLE.z + tR * 1.9, 0xffaa00, 3.0 * 0.4);
    torch(TEMPLE.x - tR * 1.9, tcH + tR * 1.2, TEMPLE.z - tR * 1.9, 0xffaa00, 2.4 * 0.4);
    torch(TEMPLE.x + tR * 1.9, tcH + tR * 1.2, TEMPLE.z - tR * 1.9, 0xffaa00, 2.4 * 0.4);

    // Enemy Altar — six jagged dark spires instead of four plain
    // pillars, a raised cracked platform, and a toppled broken column
    // implying desecrated ground.
    const aH = terrainHeight(ALTAR.x, ALTAR.z);
    const aR = ALTAR.r;
    addMesh(new THREE.CylinderGeometry(aR * 1.5, aR * 1.7, aR * 0.3, 10), 0x1a1220, ALTAR.x, aH + aR * 0.15, ALTAR.z, { roughness: 0.9 });
    addMesh(new THREE.CylinderGeometry(aR * 1.2, aR * 1.4, aR * 0.35, 10), 0x241a2e, ALTAR.x, aH + aR * 0.475, ALTAR.z, { roughness: 0.8 });
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      const spireH = aR * (1.3 + ((i * 17) % 5) / 10);
      const spire = addMesh(new THREE.ConeGeometry(aR * 0.16, spireH, 7), 0x4a3660, ALTAR.x + Math.cos(ang) * aR * 0.95, aH + spireH * 0.5 + aR * 0.6, ALTAR.z + Math.sin(ang) * aR * 0.95, { roughness: 0.6, metalness: 0.1 });
      spire.rotation.z = (((i * 23) % 10) / 10 - 0.5) * 0.2;
    }
    const brokenCol = addMesh(new THREE.CylinderGeometry(aR * 0.13, aR * 0.15, aR * 1.1, 10), 0x6a5a52, ALTAR.x + aR * 1.6, aH + aR * 0.15, ALTAR.z - aR * 0.6, { roughness: 0.7 });
    brokenCol.rotation.z = Math.PI / 2.3;
    torch(ALTAR.x, aH + aR * 1.6, ALTAR.z, 0x78dcff, 3.4 * 0.4);

    // Scattered ancient ruins across the battlefield — broken columns
    // and rubble, filling in the previously empty middle ground
    // between the two structures with real environmental storytelling.
    function ruinColumn(x, z, colHeight, fallen) {
      const h = terrainHeight(x, z);
      const col = addMesh(new THREE.CylinderGeometry(0.06, 0.07, colHeight, 8), 0x5a5048, x, h + (fallen ? 0.06 : colHeight / 2), z, { roughness: 0.8 });
      if (fallen) col.rotation.z = Math.PI / 2;
    }
    function rubble(x, z, count) {
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2;
        const rx = x + Math.cos(ang) * 0.25, rz = z + Math.sin(ang) * 0.25;
        const h = terrainHeight(rx, rz);
        addMesh(new THREE.DodecahedronGeometry(0.08 + (i % 3) * 0.03, 0), 0x4a423a, rx, h + 0.08, rz, { roughness: 0.9 });
      }
    }
    const ruinSpots = [
      { x: TEMPLE.x + 2.2, z: TEMPLE.z - 1.0, fallen: false },
      { x: TEMPLE.x + 3.4, z: TEMPLE.z - 2.1, fallen: true },
      { x: MAP_W / 2, z: MAP_H / 2 + 0.6, fallen: true },
      { x: MAP_W / 2 - 1.2, z: MAP_H / 2 - 0.4, fallen: false },
      { x: ALTAR.x - 2.6, z: ALTAR.z + 1.4, fallen: true },
    ];
    for (const spot of ruinSpots) {
      ruinColumn(spot.x, spot.z, 0.9, spot.fallen);
      rubble(spot.x + 0.15, spot.z + 0.1, 3);
    }

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
        // Samples the same terrainHeight() function the ground mesh
        // itself was built from, every frame — champions move
        // constantly, so their base height has to track wherever
        // they currently are, not a value computed once at spawn.
        const cx3 = c.x / SCALE, cz3 = c.y / SCALE;
        mesh.position.set(cx3, terrainHeight(cx3, cz3), cz3);
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
        const ex3 = en.x / SCALE, ez3 = en.y / SCALE;
        mesh.position.set(ex3, terrainHeight(ex3, ez3), ez3);
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
      // capped set. Wards are stationary once placed, but still
      // sampled the same way for consistency and because their
      // spawn position needs the correct terrain height regardless.
      const liveWardIds = new Set();
      for (const w of wardsRef.current) {
        liveWardIds.add(w.id);
        let mesh = wardMeshes.get(w.id);
        if (!mesh) {
          mesh = addMesh(new THREE.OctahedronGeometry(0.12), 0xffd23f, 0, 0.15, 0, { metalness: 0.3, roughness: 0.4, emissive: 0xffd23f });
          wardMeshes.set(w.id, mesh);
        }
        const wx3 = w.x / SCALE, wz3 = w.y / SCALE;
        mesh.position.set(wx3, terrainHeight(wx3, wz3) + 0.15, wz3);
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

  // Fills 100% of whatever its parent container actually is,
  // deliberately — no fixed height. The parent now controls real
  // sizing (a small preview panel or the full fullscreen viewport),
  // and this component's own resize listener already adapts the
  // camera/renderer to match its container's real clientWidth/
  // clientHeight, exactly like TitanArena.js's own proven pattern.
  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
