"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// Real 3D for Kingdoms of Ash, following the exact same proven,
// build-safe pattern already used for Wrath of Olympus and this
// codebase's other games (TitanArena.js, Dominion.js, ApexCircuit.js,
// GrandPrixDuel.js) — raw Three.js via useEffect and a mount ref, not
// React Three Fiber, which was directly confirmed to break this
// project's production build. No bloom here, deliberately — verified
// directly during prototyping that bloom was the actual cause of a
// washed-out look on this bright daytime map, not fog or lighting;
// Wrath of Olympus's night scene earns bloom for its real light
// sources, this scene has none that need it.
const SCALE = 50;

// The exact deterministic height function verified during
// prototyping — a real, measured bug was caught and fixed here: the
// ground mesh's actual displaced height didn't match what this
// function predicted at the same world position, traced to a sign
// flip from the -90deg X rotation converting local Y to world Z.
// Every object below samples this same function so nothing floats or
// sinks relative to the terrain it's standing on.
function terrainHeight(x, z) {
  return Math.sin(x * 0.5) * 0.15 + Math.cos(z * 0.42) * 0.15 + Math.sin((x + z) * 0.28) * 0.1;
}

export default function KingdomsOfAsh3D({ mapW, mapH, mapRef, buildingsRef, villagersRef, banditsRef, buildingColors, onWorldClick }) {
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
    const m = mapRef.current;
    const TOWN_CENTER = { x: m.townCenter.x / SCALE, z: m.townCenter.y / SCALE };
    const WATER = { x: m.water.x / SCALE, w: m.water.w / SCALE };
    const FORESTS = m.forests.map((f) => ({ x: f.x / SCALE, z: f.y / SCALE, r: f.r / SCALE }));
    const STONES = m.stoneOutcroppings.map((s) => ({ x: s.x / SCALE, z: s.y / SCALE, r: s.r / SCALE }));
    const CLIFF = { x: m.cliff.x / SCALE, z: m.cliff.y / SCALE, r: m.cliff.r / SCALE };

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xcfe8f5, 0.0035);

    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
    camera.position.set(MAP_W / 2, 14, MAP_H + 10);
    camera.lookAt(MAP_W / 2, 0, MAP_H / 2);

    // Real gradient sky — a skydome sphere with vertex colors, the
    // same technique verified during prototyping, replacing a flat
    // single-color background.
    const skyGeo = new THREE.SphereGeometry(60, 32, 16);
    const skyColors = [];
    const skyPos = skyGeo.getAttribute("position");
    const topColor = new THREE.Color(0x5a9cd4);
    const bottomColor = new THREE.Color(0xe8f4fa);
    for (let i = 0; i < skyPos.count; i++) {
      const t = THREE.MathUtils.clamp((skyPos.getY(i) / 60 + 0.15) / 0.5, 0, 1);
      const c = bottomColor.clone().lerp(topColor, t);
      skyColors.push(c.r, c.g, c.b);
    }
    skyGeo.setAttribute("color", new THREE.Float32BufferAttribute(skyColors, 3));
    const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
    sky.position.set(MAP_W / 2, 0, MAP_H / 2);
    scene.add(sky);

    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xfff4d9, 1.3);
    sun.position.set(6, 12, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -10; sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10; sun.shadow.camera.bottom = -10;
    scene.add(sun);

    // Real elevation terrain — the verified height-sampling fix
    // applied directly: worldZ = MAP_H/2 - localY (not + localY),
    // confirmed by matrix computation during prototyping.
    const segs = 48;
    const groundGeo = new THREE.PlaneGeometry(MAP_W + 4, MAP_H + 4, segs, Math.round(segs * (MAP_H / MAP_W)));
    const gpos = groundGeo.getAttribute("position");
    const gcolors = [];
    const lowColor = new THREE.Color(0x3f6b2a);
    const highColor = new THREE.Color(0x7fae4a);
    for (let i = 0; i < gpos.count; i++) {
      const worldX = gpos.getX(i) + MAP_W / 2, worldZ = MAP_H / 2 - gpos.getY(i);
      const h = terrainHeight(worldX, worldZ);
      gpos.setZ(i, h);
      const t = THREE.MathUtils.clamp((h + 0.4) / 0.8, 0, 1);
      const c = lowColor.clone().lerp(highColor, t);
      gcolors.push(c.r, c.g, c.b);
    }
    groundGeo.setAttribute("color", new THREE.Float32BufferAttribute(gcolors, 3));
    groundGeo.computeVertexNormals();
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(MAP_W / 2, 0, MAP_H / 2);
    ground.receiveShadow = true;
    scene.add(ground);

    // Real interaction — the same proven pattern as Wrath of
    // Olympus's 3D preview: a click here raycasts against this
    // exact ground mesh and converts the hit point to this game's
    // real (x, y) coordinate space, then calls the exact same
    // handleWorldClick function the real 2D canvas already uses
    // (passed in as onWorldClick). Building placement, upgrades, and
    // ruins excavation all run through that one real, already-
    // verified code path regardless of which view was clicked.
    // Raycasting against the actual heightmap-displaced mesh (not an
    // idealized flat plane) means the hit point already accounts for
    // this map's real terrain elevation at the click location.
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
      const mat = new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.7, metalness: opts.metalness ?? 0.05, emissive: opts.emissive, emissiveIntensity: opts.emissiveIntensity });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    }

    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(WATER.w, MAP_H + 2),
      new THREE.MeshStandardMaterial({ color: 0x2a6a8a, roughness: 0.15, metalness: 0.4 })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(WATER.x + WATER.w / 2, -0.12, MAP_H / 2);
    scene.add(water);

    function road(fromX, fromZ, toX, toZ) {
      const points = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const x = fromX + (toX - fromX) * t, z = fromZ + (toZ - fromZ) * t;
        points.push(new THREE.Vector3(x, terrainHeight(x, z) + 0.02, z));
      }
      const tubeGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, 0.045, 6, false);
      addMesh(tubeGeo, 0x8a6a45, 0, 0, 0, { roughness: 0.95 });
    }
    if (FORESTS[0]) road(TOWN_CENTER.x, TOWN_CENTER.z, FORESTS[0].x, FORESTS[0].z);
    if (STONES[0]) road(TOWN_CENTER.x, TOWN_CENTER.z, STONES[0].x, STONES[0].z);

    // Castle — the real British-castle redesign: four turrets with
    // crenellations, curtain walls, a taller central keep with its
    // own parapet, and a flag.
    function crenellations(cx, cz, y, radius, count, blockW, blockH, color) {
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2;
        addMesh(new THREE.BoxGeometry(blockW, blockH, blockW), color, cx + Math.cos(ang) * radius, y + blockH / 2, cz + Math.sin(ang) * radius, { roughness: 0.85 });
      }
    }
    const tcH = terrainHeight(TOWN_CENTER.x, TOWN_CENTER.z);
    const stoneGrey = 0x8a8a86, stoneGreyDark = 0x6e6e6a, stoneGreyLight = 0x9e9e98;
    addMesh(new THREE.CylinderGeometry(1.0, 1.05, 0.22, 8), stoneGreyDark, TOWN_CENTER.x, tcH + 0.11, TOWN_CENTER.z, { roughness: 0.9 });
    const turretOffsets = [{ dx: -0.68, dz: -0.68 }, { dx: 0.68, dz: -0.68 }, { dx: 0.68, dz: 0.68 }, { dx: -0.68, dz: 0.68 }];
    for (let i = 0; i < 4; i++) {
      const a = turretOffsets[i], b = turretOffsets[(i + 1) % 4];
      const midX = (a.dx + b.dx) / 2, midZ = (a.dz + b.dz) / 2;
      const wallLen = Math.hypot(b.dx - a.dx, b.dz - a.dz) * 0.82;
      const wall = addMesh(new THREE.BoxGeometry(wallLen, 0.55, 0.14), stoneGrey, TOWN_CENTER.x + midX, tcH + 0.5, TOWN_CENTER.z + midZ, { roughness: 0.85 });
      wall.rotation.y = Math.atan2(b.dz - a.dz, b.dx - a.dx);
    }
    for (const off of turretOffsets) {
      const tx = TOWN_CENTER.x + off.dx, tz = TOWN_CENTER.z + off.dz;
      addMesh(new THREE.CylinderGeometry(0.22, 0.25, 1.3, 10), stoneGrey, tx, tcH + 0.87, tz, { roughness: 0.85 });
      crenellations(tx, tz, tcH + 1.52, 0.19, 8, 0.09, 0.14, stoneGreyLight);
      addMesh(new THREE.ConeGeometry(0.26, 0.55, 10), 0x4a3a3a, tx, tcH + 1.95, tz, { roughness: 0.6 });
    }
    addMesh(new THREE.CylinderGeometry(0.48, 0.52, 2.1, 12), stoneGrey, TOWN_CENTER.x, tcH + 1.05, TOWN_CENTER.z, { roughness: 0.85 });
    crenellations(TOWN_CENTER.x, TOWN_CENTER.z, tcH + 2.1, 0.42, 12, 0.13, 0.2, stoneGreyLight);
    addMesh(new THREE.CylinderGeometry(0.4, 0.44, 0.5, 12), stoneGreyDark, TOWN_CENTER.x, tcH + 2.35, TOWN_CENTER.z, { roughness: 0.85 });
    addMesh(new THREE.CylinderGeometry(0.015, 0.015, 0.5, 6), 0x4a3a28, TOWN_CENTER.x, tcH + 2.85, TOWN_CENTER.z, { roughness: 0.7 });
    const flag = addMesh(new THREE.PlaneGeometry(0.22, 0.14), 0xb84a26, TOWN_CENTER.x + 0.12, tcH + 3.02, TOWN_CENTER.z, { roughness: 0.6 });
    flag.material.side = THREE.DoubleSide;

    // Trees — two real types, denser and much taller than the first
    // attempt, verified against the castle's real height so neither
    // looks like a shrub next to the other.
    function conifer(x, z, scale, hue) {
      const h = terrainHeight(x, z);
      const green = new THREE.Color().setHSL(0.32 + hue * 0.04, 0.42, 0.24 + hue * 0.08);
      addMesh(new THREE.CylinderGeometry(0.045 * scale, 0.07 * scale, 0.55 * scale, 7), 0x5a3f26, x, h + 0.275 * scale, z, { roughness: 0.85 });
      addMesh(new THREE.ConeGeometry(0.42 * scale, 0.6 * scale, 8), green, x, h + 0.65 * scale, z, { roughness: 0.8 });
      addMesh(new THREE.ConeGeometry(0.33 * scale, 0.52 * scale, 8), green.clone().offsetHSL(0, 0, 0.04), x, h + 1.0 * scale, z, { roughness: 0.8 });
      addMesh(new THREE.ConeGeometry(0.23 * scale, 0.45 * scale, 8), green.clone().offsetHSL(0, 0, 0.08), x, h + 1.32 * scale, z, { roughness: 0.8 });
    }
    function deciduous(x, z, scale, hue) {
      const h = terrainHeight(x, z);
      const green = new THREE.Color().setHSL(0.26 + hue * 0.05, 0.5, 0.32 + hue * 0.08);
      addMesh(new THREE.CylinderGeometry(0.06 * scale, 0.09 * scale, 0.7 * scale, 7), 0x6b4a2a, x, h + 0.35 * scale, z, { roughness: 0.85 });
      addMesh(new THREE.IcosahedronGeometry(0.42 * scale, 0), green, x, h + 0.95 * scale, z, { roughness: 0.85 });
      addMesh(new THREE.IcosahedronGeometry(0.3 * scale, 0), green.clone().offsetHSL(0, 0, 0.05), x + 0.18 * scale, h + 1.15 * scale, z + 0.1 * scale, { roughness: 0.85 });
      addMesh(new THREE.IcosahedronGeometry(0.26 * scale, 0), green.clone().offsetHSL(0, 0, -0.03), x - 0.15 * scale, h + 1.05 * scale, z - 0.14 * scale, { roughness: 0.85 });
    }
    for (const f of FORESTS) {
      const count = Math.max(8, Math.round(f.r * 7));
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2 + f.x * 3.1;
        const rad = f.r * (0.2 + 0.75 * (((i * 37) % 10) / 10));
        const scale = 0.9 + ((i * 13) % 8) / 10;
        const tx = f.x + Math.cos(ang) * rad, tz = f.z + Math.sin(ang) * rad;
        if (i % 3 === 0) deciduous(tx, tz, scale, ((i * 7) % 5) / 5);
        else conifer(tx, tz, scale, ((i * 7) % 5) / 5);
      }
    }

    // Rock formations — mixed geometry and tones, real spires mixed
    // with piles, verified as a much more dramatic upgrade over
    // uniform small dodecahedrons.
    const rockTones = [0x8a8a86, 0x76766e, 0x9a9690, 0x686258];
    function rockCluster(cx, cz, r) {
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + cx;
        const rad = r * (0.35 + ((i * 17) % 7) / 14);
        const rx = cx + Math.cos(ang) * rad, rz = cz + Math.sin(ang) * rad;
        const rh = terrainHeight(rx, rz);
        const tone = rockTones[i % rockTones.length];
        if (i % 3 === 0) {
          const spireH = r * (1.1 + ((i * 19) % 5) / 10);
          const spire = addMesh(new THREE.ConeGeometry(r * 0.22, spireH, 6), tone, rx, rh + spireH * 0.5, rz, { roughness: 0.95 });
          spire.rotation.set(0, i * 0.9, (((i * 23) % 10) / 10 - 0.5) * 0.15);
        } else {
          const size = r * (0.32 + ((i * 11) % 5) / 16);
          const geo = i % 2 === 0 ? new THREE.DodecahedronGeometry(size, 0) : new THREE.IcosahedronGeometry(size, 0);
          const rock = addMesh(geo, tone, rx, rh + size * 0.45, rz, { roughness: 0.92 });
          rock.rotation.set(i * 0.7, i * 1.3, i * 0.4);
        }
      }
    }
    for (const s of STONES) rockCluster(s.x, s.z, s.r * 1.4);
    const cliffH = terrainHeight(CLIFF.x, CLIFF.z);
    addMesh(new THREE.DodecahedronGeometry(CLIFF.r * 0.55, 0), 0x6a6258, CLIFF.x, cliffH + CLIFF.r * 0.3, CLIFF.z, { roughness: 0.95 });
    addMesh(new THREE.DodecahedronGeometry(CLIFF.r * 0.35, 0), 0x7a7268, CLIFF.x + CLIFF.r * 0.2, cliffH + CLIFF.r * 0.55, CLIFF.z - CLIFF.r * 0.15, { roughness: 0.95 });
    addMesh(new THREE.DodecahedronGeometry(CLIFF.r * 0.28, 0), 0x5a5248, CLIFF.x - CLIFF.r * 0.25, cliffH + CLIFF.r * 0.45, CLIFF.z + CLIFF.r * 0.1, { roughness: 0.95 });

    // Real anatomical humanoid figure — legs, torso, arms, and a
    // correctly-proportioned head, replacing the single-capsule
    // design confirmed to read as a toy. Optional hat (villagers) and
    // weapon (bandits). Built entirely in LOCAL coordinates (around
    // 0,0,0) into a caller-supplied group, deliberately — a real bug
    // was caught and avoided here: villagers and bandits move every
    // frame, and an earlier draft of this rebuilt the entire figure
    // from scratch each frame to reposition it. Group.clear() removes
    // children but never disposes their geometry or materials, so
    // that approach would have silently leaked new geometry every
    // single frame for every unit, forever. Building the figure once
    // and moving the whole group afterward avoids that entirely.
    function buildHumanoid(group, bodyColor, scale = 1, opts = {}) {
      const skinTone = 0xd9a878, bootColor = 0x3a2a20;
      function part(geo, color, x, y, z, o = {}) {
        const mat = new THREE.MeshStandardMaterial({ color, roughness: o.roughness ?? 0.7, metalness: o.metalness ?? 0.05 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
        return mesh;
      }
      const legR = 0.028 * scale, legH = 0.19 * scale, hipGap = 0.045 * scale;
      for (const side of [-1, 1]) {
        part(new THREE.CylinderGeometry(legR, legR * 0.85, legH, 6), bodyColor, side * hipGap, legH / 2 + 0.03 * scale, 0, { roughness: 0.65 });
        part(new THREE.CylinderGeometry(legR * 0.95, legR * 0.85, 0.06 * scale, 6), bootColor, side * hipGap, 0.03 * scale, 0, { roughness: 0.7 });
      }
      const torsoBase = legH + 0.03 * scale;
      part(new THREE.CylinderGeometry(0.075 * scale, 0.06 * scale, 0.17 * scale, 8), bodyColor, 0, torsoBase + 0.085 * scale, 0, { roughness: 0.6 });
      part(new THREE.CylinderGeometry(0.062 * scale, 0.064 * scale, 0.02 * scale, 8), 0x4a3020, 0, torsoBase + 0.005 * scale, 0, { roughness: 0.7 });
      const armR = 0.02 * scale, armH = 0.15 * scale;
      let weaponHandX = null, weaponHandY = null, weaponHandZ = null;
      for (const side of [-1, 1]) {
        const arm = part(new THREE.CylinderGeometry(armR, armR * 0.8, armH, 6), bodyColor, side * 0.095 * scale, torsoBase + 0.09 * scale, 0, { roughness: 0.65 });
        if (opts.weapon && side === 1) {
          arm.rotation.set(0.5, 0, side * 0.05);
          weaponHandX = side * 0.11 * scale; weaponHandY = torsoBase + 0.02 * scale; weaponHandZ = -0.06 * scale;
        } else {
          arm.rotation.z = side * 0.12;
        }
      }
      const neckY = torsoBase + 0.17 * scale;
      part(new THREE.CylinderGeometry(0.022 * scale, 0.022 * scale, 0.02 * scale, 6), skinTone, 0, neckY, 0, { roughness: 0.6 });
      const headY = neckY + 0.045 * scale;
      part(new THREE.SphereGeometry(0.045 * scale, 10, 10), skinTone, 0, headY, 0, { roughness: 0.55 });
      if (!opts.hat) {
        part(new THREE.SphereGeometry(0.047 * scale, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), 0x4a3020, 0, headY + 0.008 * scale, 0, { roughness: 0.75 });
      }
      if (opts.hat) {
        part(new THREE.CylinderGeometry(0.058 * scale, 0.058 * scale, 0.008 * scale, 12), 0xd4b56a, 0, headY + 0.032 * scale, 0, { roughness: 0.8 });
        part(new THREE.ConeGeometry(0.032 * scale, 0.045 * scale, 10), 0xc4a35a, 0, headY + 0.058 * scale, 0, { roughness: 0.8 });
      }
      if (opts.weapon === "spear" && weaponHandX !== null) {
        const shaftLen = 0.42 * scale;
        const shaft = part(new THREE.CylinderGeometry(0.008 * scale, 0.008 * scale, shaftLen, 6), 0x5a3f26, weaponHandX, weaponHandY + shaftLen * 0.3, weaponHandZ, { roughness: 0.7 });
        shaft.rotation.set(0.9, 0, 0.1);
        const tip = part(new THREE.ConeGeometry(0.018 * scale, 0.07 * scale, 6), 0xb8bcc0, weaponHandX, weaponHandY + shaftLen * 0.62, weaponHandZ - shaftLen * 0.42, { roughness: 0.35, metalness: 0.7 });
        tip.rotation.set(0.9, 0, 0.1);
      }
    }

    // A generic building shape for the non-Town-Center building
    // types — a real box-and-roof silhouette colored by each type's
    // own real BUILDING_TYPES color (passed in as buildingColors),
    // with a taller, thinner treatment specifically for the Watch
    // Tower so it reads distinctly from a house or farm shed.
    function genericBuilding(x, z, type, color) {
      const h = terrainHeight(x, z);
      if (type === "watchTower") {
        addMesh(new THREE.CylinderGeometry(0.09, 0.11, 0.6, 8), color, x, h + 0.3, z, { roughness: 0.7 });
        addMesh(new THREE.ConeGeometry(0.13, 0.18, 8), 0x5a3a28, x, h + 0.68, z, { roughness: 0.6 });
        return;
      }
      addMesh(new THREE.BoxGeometry(0.32, 0.2, 0.24), color, x, h + 0.1, z, { roughness: 0.65 });
      const roof = addMesh(new THREE.ConeGeometry(0.24, 0.16, 4), 0x6e4530, x, h + 0.28, z, { roughness: 0.7 });
      roof.rotation.y = Math.PI / 4;
    }

    // Live-tracked pools, the same Map-per-real-id pattern already
    // proven for Wrath of Olympus's enemies and wards — created once
    // per entity, disposed the moment that entity is gone, synced
    // every frame from the real refs, not a fixed demo set.
    const villagerMeshes = new Map();
    const banditMeshes = new Map();
    const buildingMeshes = new Map();

    let frameId;
    function renderLoop() {
      // Villagers and bandits move every frame — the figure itself is
      // built exactly once per real id (buildHumanoid, above), and
      // every subsequent frame only updates the group's own position,
      // which is real Three.js best practice and avoids the
      // geometry-leak bug described above entirely.
      const liveVillagerIds = new Set();
      for (const v of villagersRef.current) {
        liveVillagerIds.add(v.id);
        let group = villagerMeshes.get(v.id);
        if (!group) {
          group = new THREE.Group();
          buildHumanoid(group, 0xe8d9c0, 1, { hat: true });
          scene.add(group);
          villagerMeshes.set(v.id, group);
        }
        const vx = v.x / SCALE, vz = v.y / SCALE;
        group.position.set(vx, terrainHeight(vx, vz), vz);
      }
      for (const [id, group] of villagerMeshes) {
        if (!liveVillagerIds.has(id)) {
          scene.remove(group);
          group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
          villagerMeshes.delete(id);
        }
      }

      const liveBanditIds = new Set();
      for (const bd of banditsRef.current) {
        liveBanditIds.add(bd.id);
        let group = banditMeshes.get(bd.id);
        if (!group) {
          group = new THREE.Group();
          const raidColor = bd.raidType === "pillager" ? 0xffb703 : bd.raidType === "saboteur" ? 0xb45cff : 0xe2492f;
          buildHumanoid(group, bd.isWarlord ? 0x4a0f18 : raidColor, bd.isWarlord ? 1.35 : 1, { weapon: "spear" });
          scene.add(group);
          banditMeshes.set(bd.id, group);
        }
        const bx = bd.x / SCALE, bz = bd.y / SCALE;
        group.position.set(bx, terrainHeight(bx, bz), bz);
      }
      for (const [id, group] of banditMeshes) {
        if (!liveBanditIds.has(id)) {
          scene.remove(group);
          group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
          banditMeshes.delete(id);
        }
      }

      const liveBuildingIds = new Set();
      for (const b of buildingsRef.current) {
        if (b.type === "townCenter") continue; // static castle already built once above
        liveBuildingIds.add(b.id);
        let group = buildingMeshes.get(b.id);
        if (!group) {
          group = new THREE.Group();
          scene.add(group);
          buildingMeshes.set(b.id, group);
          const prevChildCount = scene.children.length;
          genericBuilding(b.x / SCALE, b.y / SCALE, b.type, buildingColors[b.type] ?? 0xe8d9c0);
          const added = scene.children.slice(prevChildCount);
          for (const child of added) group.add(child);
        }
      }
      for (const [id, group] of buildingMeshes) {
        if (!liveBuildingIds.has(id)) {
          scene.remove(group);
          group.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
          buildingMeshes.delete(id);
        }
      }

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(renderLoop);
    }
    renderLoop();

    function handleResize() {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth, h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("click", handleClick);
      cancelAnimationFrame(frameId);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach((mm) => mm.dispose());
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
