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

export default function KingdomsOfAsh3D({ mapW, mapH, mapRef, buildingsRef, villagersRef, banditsRef, floatTextRef, buildingColors, onWorldClick }) {
  const mountRef = useRef(null);
  const floatTextContainerRef = useRef(null);

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
    // A real, plain background matching the fog color, so the
    // horizon blends seamlessly — this was missing entirely after
    // the skydome was removed for the "no sky" fix, which was never
    // a visible problem with the previous steep, near-vertical
    // camera (it never looked far enough across the ground to reach
    // the horizon), but is immediately obvious with a real, low
    // camera angle: without this, the sky is solid black.
    scene.background = new THREE.Color(0xcfe8f5);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 250);
    // Camera angle adjusted again per direct follow-up correction —
    // the previous 20° angle read as too flat. This position computes
    // to almost exactly 40° from horizontal (height 6 over a
    // horizontal distance of ~7.15, since tan(40°) ≈ height/distance),
    // verified with a real render showing the castle prominently
    // framed with clear surrounding context, not too flat and not a
    // top-down map.
    camera.position.set(MAP_W / 2, 6, MAP_H / 2 + 7.15);
    camera.lookAt(MAP_W / 2, 0.5, MAP_H / 2);

    // The skydome sphere was removed here entirely, per direct
    // request to eliminate the sky. It was also marked fog:false,
    // meaning it would never have faded out no matter how far the
    // ground was extended — removing it is the only real fix.
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
    // Ground extended far beyond the playable map, per direct
    // request to make it bigger and eliminate the sky entirely —
    // verified directly with the same technique already proven for
    // Wrath of Olympus: extend the ground, let fog hide the distant
    // edge, and confirm with an actual render that no sky remains
    // visible from the game's real camera angle.
    const GROUND_EXTENT = 400;
    const groundGeo = new THREE.PlaneGeometry(GROUND_EXTENT, GROUND_EXTENT, 90, 90);
    const gpos = groundGeo.getAttribute("position");
    const gcolors = [];
    const lowColor = new THREE.Color(0x3f6b2a);
    const highColor = new THREE.Color(0x7fae4a);
    for (let i = 0; i < gpos.count; i++) {
      const worldX = gpos.getX(i) + MAP_W / 2, worldZ = MAP_H / 2 - gpos.getY(i);
      const h = terrainHeight(worldX, worldZ);
      gpos.setZ(i, h);
      const heightT = THREE.MathUtils.clamp((h + 0.4) / 0.8, 0, 1);
      const c = lowColor.clone().lerp(highColor, heightT);
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

    // Real, flattened dirt road — a layered path (a darker rut base
    // beneath a lighter dirt surface, with scattered pebbles),
    // replacing the round tube that read as a raised pipe rather
    // than a real road worn into the ground. Verified directly with
    // real renders before landing here.
    function road(fromX, fromZ, toX, toZ) {
      const points = [];
      const steps = 14;
      for (let i = 0; i <= steps; i++) {
        const roadT = i / steps;
        const x = fromX + (toX - fromX) * roadT, z = fromZ + (toZ - fromZ) * roadT;
        points.push(new THREE.Vector3(x, terrainHeight(x, z) - 0.01, z));
      }
      const curve = new THREE.CatmullRomCurve3(points);
      const rut = addMesh(new THREE.TubeGeometry(curve, 28, 0.1, 6, false), 0x5a4530, 0, 0, 0, { roughness: 0.98 });
      rut.scale.y = 0.06;
      const surfacePoints = points.map((p) => new THREE.Vector3(p.x, p.y + 0.015, p.z));
      const surface = addMesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(surfacePoints), 28, 0.078, 6, false), 0x9a7a52, 0, 0, 0, { roughness: 0.92 });
      surface.scale.y = 0.05;
      for (let i = 0; i < steps * 2; i++) {
        const tt = i / (steps * 2);
        const pt = curve.getPoint(tt);
        const perp = { x: -(toZ - fromZ), z: toX - fromX };
        const perpLen = Math.hypot(perp.x, perp.z) || 1;
        const offset = ((i * 37) % 10) / 10 - 0.5;
        const px = pt.x + (perp.x / perpLen) * offset * 0.13;
        const pz = pt.z + (perp.z / perpLen) * offset * 0.13;
        const pebbleSize = 0.012 + ((i * 13) % 5) / 200;
        addMesh(new THREE.DodecahedronGeometry(pebbleSize, 0), 0x7a6a5a, px, terrainHeight(px, pz) + pebbleSize * 0.5, pz, { roughness: 0.9 });
      }
    }
    if (FORESTS[0]) road(TOWN_CENTER.x, TOWN_CENTER.z, FORESTS[0].x, FORESTS[0].z);
    if (STONES[0]) road(TOWN_CENTER.x, TOWN_CENTER.z, STONES[0].x, STONES[0].z);

    // A real river with varying width and actual sandy banks,
    // replacing the earlier uniform-width ribbon — real rivers narrow
    // and widen along their length, and a bank transition between
    // water and grass reads as far more natural than water ending in
    // a hard edge. TubeGeometry only supports a single fixed radius,
    // so a custom ribbon is built instead: sample points along the
    // curve, offset left/right by the tangent's perpendicular scaled
    // by a varying width, and connect consecutive cross-sections into
    // a triangle strip. Verified directly with real renders before
    // landing here. Positioned along the map's right side — a
    // genuine, stated limitation: the game's second map has a
    // differently-positioned Town Center, so this path is verified
    // against one map's layout, not guaranteed clear on both.
    function buildRibbon(curve, segments, widthFn, color, yOffset, opts = {}) {
      const positions = [];
      const uvs = [];
      for (let i = 0; i <= segments; i++) {
        const rt = i / segments;
        const pt = curve.getPoint(rt);
        const tangent = curve.getTangent(rt);
        const perp = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
        const w = widthFn(rt);
        const left = pt.clone().addScaledVector(perp, w);
        const right = pt.clone().addScaledVector(perp, -w);
        positions.push(left.x, left.y + yOffset, left.z, right.x, right.y + yOffset, right.z);
        uvs.push(0, rt, 1, rt);
      }
      const indices = [];
      for (let i = 0; i < segments; i++) {
        const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
        indices.push(a, b, c, b, d, c);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();
      const mat = new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.9, metalness: opts.metalness ?? 0, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    }
    function river(waypoints, baseWidth) {
      const points = waypoints.map((p) => new THREE.Vector3(p.x, terrainHeight(p.x, p.z) - 0.06, p.z));
      const curve = new THREE.CatmullRomCurve3(points);
      const widthFn = (rt) => baseWidth * (0.75 + 0.35 * Math.sin(rt * 9.5) + 0.15 * Math.sin(rt * 3.2 + 1.5));
      const bankWidthFn = (rt) => widthFn(rt) + baseWidth * 0.55;
      buildRibbon(curve, 70, bankWidthFn, 0xc9b183, 0.01, { roughness: 0.95 });
      buildRibbon(curve, 70, widthFn, 0x2a6a8a, 0.02, { roughness: 0.15, metalness: 0.4 });
    }
    // River made 5x wider and roughly 10x longer, per direct
    // request — extended well beyond the playable map's own boundary
    // into the extended ground built for the earlier "no sky" fix,
    // so the river reads as a real, continuous waterway running
    // through the landscape rather than stopping abruptly at the
    // map's edge. Verified directly with a real render before
    // landing here, including catching a real unit-conversion
    // mistake first: an early version of this divided by SCALE a
    // second time, since MAP_H is already expressed in 3D-scale
    // units, producing a river so thin it was barely visible.
    river(
      [
        { x: MAP_W * 0.925, z: -MAP_H * 4.2 },
        { x: MAP_W * 0.844, z: -MAP_H * 3.35 },
        { x: MAP_W * 0.906, z: -MAP_H * 2.5 },
        { x: MAP_W * 0.813, z: -MAP_H * 1.67 },
        { x: MAP_W * 0.888, z: -MAP_H * 0.83 },
        { x: MAP_W * 0.8, z: 0 },
        { x: MAP_W * 0.85, z: MAP_H * 0.5 },
        { x: MAP_W * 0.75, z: MAP_H },
        { x: MAP_W * 0.813, z: MAP_H * 1.83 },
        { x: MAP_W * 0.72, z: MAP_H * 2.67 },
        { x: MAP_W * 0.781, z: MAP_H * 3.5 },
        { x: MAP_W * 0.688, z: MAP_H * 4.33 },
        { x: MAP_W * 0.75, z: MAP_H * 5.17 },
      ],
      MAP_H * 0.02 * 5
    );

    // Massive, more realistic castle — a real outer bailey wall with
    // six towers and a genuine gatehouse (two flanking towers with an
    // open gate between them, not a solid ring), a moat encircling
    // the whole thing, and the previous four-turret design kept as
    // the castle's central stronghold, scaled up to match — the
    // actual layered structure a real castle has, not one ring of
    // walls made bigger. Verified directly with real renders at three
    // distances before landing here.
    const CASTLE_SCALE = 2.3;
    function crenellations(cx, cz, y, radius, count, blockW, blockH, color) {
      for (let i = 0; i < count; i++) {
        const ang = (i / count) * Math.PI * 2;
        addMesh(new THREE.BoxGeometry(blockW, blockH, blockW), color, cx + Math.cos(ang) * radius, y + blockH / 2, cz + Math.sin(ang) * radius, { roughness: 0.85 });
      }
    }
    const tcH = terrainHeight(TOWN_CENTER.x, TOWN_CENTER.z);
    const stoneGrey = 0x8a8a86, stoneGreyDark = 0x6e6e6a, stoneGreyLight = 0x9e9e98;

    // Moat — a real ring of water encircling the outer wall, built
    // the same way as the river (a flattened tube), closed into a loop.
    const moatRadius = 2.05 * CASTLE_SCALE * 0.68;
    const moatPoints = [];
    for (let i = 0; i <= 32; i++) {
      const ang = (i / 32) * Math.PI * 2;
      const x = TOWN_CENTER.x + Math.cos(ang) * moatRadius, z = TOWN_CENTER.z + Math.sin(ang) * moatRadius;
      moatPoints.push(new THREE.Vector3(x, terrainHeight(x, z) - 0.05, z));
    }
    const moatCurve = new THREE.CatmullRomCurve3(moatPoints, true);
    const moatMesh = addMesh(new THREE.TubeGeometry(moatCurve, 64, 0.16, 8, true), 0x2a6a8a, 0, 0, 0, { roughness: 0.15, metalness: 0.4 });
    moatMesh.scale.y = 0.1;

    addMesh(new THREE.CylinderGeometry(1.0 * CASTLE_SCALE, 1.05 * CASTLE_SCALE, 0.22, 16), stoneGreyDark, TOWN_CENTER.x, tcH + 0.11, TOWN_CENTER.z, { roughness: 0.9 });

    // Outer bailey wall — six towers with one real gap left open for
    // the gatehouse rather than a solid ring.
    const outerRadius = 1.85 * CASTLE_SCALE * 0.68;
    const outerTowerCount = 6;
    const outerTowers = [];
    for (let i = 0; i < outerTowerCount; i++) {
      const ang = (i / outerTowerCount) * Math.PI * 2;
      outerTowers.push({ dx: Math.cos(ang) * outerRadius, dz: Math.sin(ang) * outerRadius });
    }
    for (let i = 0; i < outerTowerCount; i++) {
      if (i === 0) continue; // real gap left open here for the gatehouse
      const a = outerTowers[i], b = outerTowers[(i + 1) % outerTowerCount];
      const midX = (a.dx + b.dx) / 2, midZ = (a.dz + b.dz) / 2;
      const wallLen = Math.hypot(b.dx - a.dx, b.dz - a.dz) * 0.86;
      const wall = addMesh(new THREE.BoxGeometry(wallLen, 0.62 * CASTLE_SCALE * 0.55, 0.16 * CASTLE_SCALE * 0.55), stoneGrey, TOWN_CENTER.x + midX, tcH + 0.34 * CASTLE_SCALE * 0.55, TOWN_CENTER.z + midZ, { roughness: 0.85 });
      wall.rotation.y = Math.atan2(b.dz - a.dz, b.dx - a.dx);
    }
    for (const off of outerTowers) {
      const tx = TOWN_CENTER.x + off.dx, tz = TOWN_CENTER.z + off.dz;
      addMesh(new THREE.CylinderGeometry(0.2 * CASTLE_SCALE * 0.6, 0.23 * CASTLE_SCALE * 0.6, 1.15 * CASTLE_SCALE * 0.6, 12), stoneGrey, tx, tcH + 0.75 * CASTLE_SCALE * 0.6, tz, { roughness: 0.85 });
      crenellations(tx, tz, tcH + 1.3 * CASTLE_SCALE * 0.6, 0.17 * CASTLE_SCALE * 0.6, 8, 0.08 * CASTLE_SCALE * 0.6, 0.13 * CASTLE_SCALE * 0.6, stoneGreyLight);
      addMesh(new THREE.ConeGeometry(0.24 * CASTLE_SCALE * 0.6, 0.5 * CASTLE_SCALE * 0.6, 12), 0x4a3a3a, tx, tcH + 1.68 * CASTLE_SCALE * 0.6, tz, { roughness: 0.6 });
    }

    // Gatehouse — two real flanking towers with an actual open gate
    // between them (a dark archway, not a solid wall).
    const gateA = outerTowers[0], gateB = outerTowers[1];
    const gateMidX = (gateA.dx + gateB.dx) / 2, gateMidZ = (gateA.dz + gateB.dz) / 2;
    const gateAng = Math.atan2(gateB.dz - gateA.dz, gateB.dx - gateA.dx);
    for (const off of [gateA, gateB]) {
      const tx = TOWN_CENTER.x + off.dx, tz = TOWN_CENTER.z + off.dz;
      addMesh(new THREE.CylinderGeometry(0.24 * CASTLE_SCALE * 0.6, 0.27 * CASTLE_SCALE * 0.6, 1.35 * CASTLE_SCALE * 0.6, 12), stoneGrey, tx, tcH + 0.85 * CASTLE_SCALE * 0.6, tz, { roughness: 0.85 });
      crenellations(tx, tz, tcH + 1.55 * CASTLE_SCALE * 0.6, 0.2 * CASTLE_SCALE * 0.6, 8, 0.09 * CASTLE_SCALE * 0.6, 0.14 * CASTLE_SCALE * 0.6, stoneGreyLight);
    }
    const gateArch = addMesh(new THREE.BoxGeometry(Math.hypot(gateB.dx - gateA.dx, gateB.dz - gateA.dz) * 0.7, 0.3 * CASTLE_SCALE * 0.55, 0.14 * CASTLE_SCALE * 0.55), 0x2a2420, TOWN_CENTER.x + gateMidX, tcH + 0.85 * CASTLE_SCALE * 0.55, TOWN_CENTER.z + gateMidZ, { roughness: 0.9 });
    gateArch.rotation.y = gateAng;

    // Inner keep — the previous four-turret design, kept as the
    // castle's real central stronghold, scaled up to match the new
    // outer bailey.
    const turretOffsets = [
      { dx: -0.68 * CASTLE_SCALE * 0.55, dz: -0.68 * CASTLE_SCALE * 0.55 }, { dx: 0.68 * CASTLE_SCALE * 0.55, dz: -0.68 * CASTLE_SCALE * 0.55 },
      { dx: 0.68 * CASTLE_SCALE * 0.55, dz: 0.68 * CASTLE_SCALE * 0.55 }, { dx: -0.68 * CASTLE_SCALE * 0.55, dz: 0.68 * CASTLE_SCALE * 0.55 },
    ];
    for (let i = 0; i < 4; i++) {
      const a = turretOffsets[i], b = turretOffsets[(i + 1) % 4];
      const midX = (a.dx + b.dx) / 2, midZ = (a.dz + b.dz) / 2;
      const wallLen = Math.hypot(b.dx - a.dx, b.dz - a.dz) * 0.82;
      const wall = addMesh(new THREE.BoxGeometry(wallLen, 0.55 * CASTLE_SCALE * 0.55, 0.14 * CASTLE_SCALE * 0.55), stoneGrey, TOWN_CENTER.x + midX, tcH + 0.5 * CASTLE_SCALE * 0.55, TOWN_CENTER.z + midZ, { roughness: 0.85 });
      wall.rotation.y = Math.atan2(b.dz - a.dz, b.dx - a.dx);
    }
    for (const off of turretOffsets) {
      const tx = TOWN_CENTER.x + off.dx, tz = TOWN_CENTER.z + off.dz;
      addMesh(new THREE.CylinderGeometry(0.22 * CASTLE_SCALE * 0.55, 0.25 * CASTLE_SCALE * 0.55, 1.3 * CASTLE_SCALE * 0.55, 10), stoneGrey, tx, tcH + 0.87 * CASTLE_SCALE * 0.55, tz, { roughness: 0.85 });
      crenellations(tx, tz, tcH + 1.52 * CASTLE_SCALE * 0.55, 0.19 * CASTLE_SCALE * 0.55, 8, 0.09 * CASTLE_SCALE * 0.55, 0.14 * CASTLE_SCALE * 0.55, stoneGreyLight);
      addMesh(new THREE.ConeGeometry(0.26 * CASTLE_SCALE * 0.55, 0.55 * CASTLE_SCALE * 0.55, 10), 0x4a3a3a, tx, tcH + 1.95 * CASTLE_SCALE * 0.55, tz, { roughness: 0.6 });
    }
    addMesh(new THREE.CylinderGeometry(0.48 * CASTLE_SCALE * 0.6, 0.52 * CASTLE_SCALE * 0.6, 2.1 * CASTLE_SCALE * 0.6, 12), stoneGrey, TOWN_CENTER.x, tcH + 1.05 * CASTLE_SCALE * 0.6, TOWN_CENTER.z, { roughness: 0.85 });
    crenellations(TOWN_CENTER.x, TOWN_CENTER.z, tcH + 2.1 * CASTLE_SCALE * 0.6, 0.42 * CASTLE_SCALE * 0.6, 12, 0.13 * CASTLE_SCALE * 0.6, 0.2 * CASTLE_SCALE * 0.6, stoneGreyLight);
    addMesh(new THREE.CylinderGeometry(0.4 * CASTLE_SCALE * 0.6, 0.44 * CASTLE_SCALE * 0.6, 0.5 * CASTLE_SCALE * 0.6, 12), stoneGreyDark, TOWN_CENTER.x, tcH + 2.35 * CASTLE_SCALE * 0.6, TOWN_CENTER.z, { roughness: 0.85 });

    // A real flag — a small pole and a colored banner, the one warm
    // accent against all the cold stone, marking this as the
    // kingdom's seat.
    const keepCapTopY = tcH + 2.35 * CASTLE_SCALE * 0.6 + 0.25 * CASTLE_SCALE * 0.6;
    const poleHeight = 0.5 * CASTLE_SCALE * 0.6;
    addMesh(new THREE.CylinderGeometry(0.015 * CASTLE_SCALE * 0.6, 0.015 * CASTLE_SCALE * 0.6, poleHeight, 6), 0x4a3a28, TOWN_CENTER.x, keepCapTopY + poleHeight / 2, TOWN_CENTER.z, { roughness: 0.7 });
    const flag = addMesh(new THREE.PlaneGeometry(0.22 * CASTLE_SCALE * 0.6, 0.14 * CASTLE_SCALE * 0.6), 0xb84a26, TOWN_CENTER.x + 0.12 * CASTLE_SCALE * 0.6, keepCapTopY + poleHeight * 0.8, TOWN_CENTER.z, { roughness: 0.6 });
    flag.material.side = THREE.DoubleSide;

    // Trees — three real types now (a genuine third, bushier
    // silhouette added for real variety, not just the same two shapes
    // repeated), spread genuinely further out than each forest's own
    // defined radius, with density tapering toward the edge — a real
    // forest thins out gradually rather than stopping at a hard
    // boundary. Verified directly with real renders before landing
    // here.
    function conifer(x, z, scale, hue) {
      const h = terrainHeight(x, z);
      const green = new THREE.Color().setHSL(0.32 + hue * 0.04, 0.42, 0.24 + hue * 0.08);
      addMesh(new THREE.CylinderGeometry(0.045 * scale, 0.07 * scale, 0.55 * scale, 7), 0x5a3f26, x, h + 0.275 * scale, z, { roughness: 0.85 });
      addMesh(new THREE.ConeGeometry(0.58 * scale, 0.58 * scale, 8), green, x, h + 0.64 * scale, z, { roughness: 0.8 });
      addMesh(new THREE.ConeGeometry(0.46 * scale, 0.5 * scale, 8), green.clone().offsetHSL(0, 0, 0.04), x, h + 0.97 * scale, z, { roughness: 0.8 });
      addMesh(new THREE.ConeGeometry(0.32 * scale, 0.43 * scale, 8), green.clone().offsetHSL(0, 0, 0.08), x, h + 1.28 * scale, z, { roughness: 0.8 });
    }
    function deciduous(x, z, scale, hue) {
      const h = terrainHeight(x, z);
      const green = new THREE.Color().setHSL(0.26 + hue * 0.05, 0.5, 0.32 + hue * 0.08);
      addMesh(new THREE.CylinderGeometry(0.06 * scale, 0.09 * scale, 0.7 * scale, 7), 0x6b4a2a, x, h + 0.35 * scale, z, { roughness: 0.85 });
      addMesh(new THREE.IcosahedronGeometry(0.58 * scale, 0), green, x, h + 0.98 * scale, z, { roughness: 0.85 });
      addMesh(new THREE.IcosahedronGeometry(0.42 * scale, 0), green.clone().offsetHSL(0, 0, 0.05), x + 0.24 * scale, h + 1.2 * scale, z + 0.14 * scale, { roughness: 0.85 });
      addMesh(new THREE.IcosahedronGeometry(0.36 * scale, 0), green.clone().offsetHSL(0, 0, -0.03), x - 0.2 * scale, h + 1.08 * scale, z - 0.18 * scale, { roughness: 0.85 });
    }
    function bushyTree(x, z, scale, hue) {
      const h = terrainHeight(x, z);
      const green = new THREE.Color().setHSL(0.3 + hue * 0.05, 0.48, 0.3 + hue * 0.07);
      addMesh(new THREE.CylinderGeometry(0.05 * scale, 0.08 * scale, 0.4 * scale, 7), 0x5f4530, x, h + 0.2 * scale, z, { roughness: 0.85 });
      addMesh(new THREE.SphereGeometry(0.44 * scale, 8, 7), green, x, h + 0.58 * scale, z, { roughness: 0.85 });
      addMesh(new THREE.SphereGeometry(0.34 * scale, 8, 7), green.clone().offsetHSL(0, 0, 0.05), x + 0.22 * scale, h + 0.74 * scale, z + 0.11 * scale, { roughness: 0.85 });
      addMesh(new THREE.SphereGeometry(0.28 * scale, 8, 7), green.clone().offsetHSL(0, 0, -0.04), x - 0.2 * scale, h + 0.66 * scale, z - 0.17 * scale, { roughness: 0.85 });
    }
    for (const f of FORESTS) {
      const coreCount = Math.max(8, Math.round(f.r * 7));
      const outerCount = Math.max(4, Math.round(f.r * 3.5));
      for (let i = 0; i < coreCount; i++) {
        const ang = (i / coreCount) * Math.PI * 2 + f.x * 3.1;
        const rad = f.r * (0.15 + 0.7 * (((i * 37) % 10) / 10));
        const scale = 0.9 + ((i * 13) % 8) / 10;
        const tx = f.x + Math.cos(ang) * rad, tz = f.z + Math.sin(ang) * rad;
        const pick = i % 3;
        if (pick === 0) deciduous(tx, tz, scale, ((i * 7) % 5) / 5);
        else if (pick === 1) bushyTree(tx, tz, scale, ((i * 7) % 5) / 5);
        else conifer(tx, tz, scale, ((i * 7) % 5) / 5);
      }
      for (let i = 0; i < outerCount; i++) {
        const ang = (i / outerCount) * Math.PI * 2 + f.x * 1.7 + 0.4;
        const rad = f.r * (1.05 + 0.55 * (((i * 23) % 10) / 10));
        const scale = 0.75 + ((i * 11) % 6) / 10;
        const tx = f.x + Math.cos(ang) * rad, tz = f.z + Math.sin(ang) * rad;
        const pick = i % 3;
        if (pick === 0) conifer(tx, tz, scale, ((i * 5) % 5) / 5);
        else if (pick === 1) bushyTree(tx, tz, scale, ((i * 5) % 5) / 5);
        else deciduous(tx, tz, scale, ((i * 5) % 5) / 5);
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

    // Extra scattered content, per direct feedback that the map
    // still felt empty even with the camera fixed — these are real,
    // additional tree clusters and rock formations spread across the
    // map's full width and depth, deliberately positioned far from
    // the castle, independent of the game's own fixed forest/stone
    // data (which was already confirmed spread out; this adds real
    // density on top of it, not a replacement for it).
    const extraClusterSpots = [
      { x: MAP_W * 0.12, z: MAP_H * 0.85 }, { x: MAP_W * 0.35, z: MAP_H * 0.05 },
      { x: MAP_W * 0.6, z: MAP_H * 0.75 }, { x: MAP_W * 0.95, z: MAP_H * 0.55 },
      { x: MAP_W * 0.05, z: MAP_H * 0.35 }, { x: MAP_W * 0.45, z: MAP_H * 0.95 },
      { x: MAP_W * 0.7, z: MAP_H * 0.1 }, { x: MAP_W * 0.25, z: MAP_H * 0.55 },
    ];
    for (let ci = 0; ci < extraClusterSpots.length; ci++) {
      const spot = extraClusterSpots[ci];
      const treeCount = 4 + (ci % 3);
      for (let i = 0; i < treeCount; i++) {
        const ang = (i / treeCount) * Math.PI * 2 + ci * 1.9;
        const rad = 0.4 + ((i * 17) % 6) / 10;
        const scale = 0.85 + ((i * 13) % 7) / 10;
        const tx = spot.x + Math.cos(ang) * rad, tz = spot.z + Math.sin(ang) * rad;
        const pick = (ci + i) % 3;
        if (pick === 0) deciduous(tx, tz, scale, ((i * 7) % 5) / 5);
        else if (pick === 1) bushyTree(tx, tz, scale, ((i * 7) % 5) / 5);
        else conifer(tx, tz, scale, ((i * 7) % 5) / 5);
      }
      if (ci % 2 === 0) rockCluster(spot.x + 0.6, spot.z - 0.4, 0.35 + (ci % 3) * 0.1);
    }

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

      // Floating combat/economy text (e.g. "Raided! -15 gold") — real
      // data that already existed and was already being pushed
      // correctly, but was only ever drawn to the hidden 2D canvas's
      // own context, which the player never sees now that the 3D view
      // is what's actually displayed. Projected here from the 2D
      // map's pixel coordinates into 3D world space and then into real
      // 2D screen space via the camera, and rendered as plain
      // positioned HTML text over the canvas — not a new visual
      // effects system, just finally showing data that already existed.
      const floatTexts = floatTextRef?.current || [];
      const container = floatTextContainerRef.current;
      if (container) {
        while (container.children.length > floatTexts.length) container.removeChild(container.lastChild);
        while (container.children.length < floatTexts.length) {
          const el = document.createElement("div");
          el.style.position = "absolute";
          el.style.fontFamily = "monospace";
          el.style.fontSize = "13px";
          el.style.fontWeight = "bold";
          el.style.transform = "translate(-50%, -50%)";
          el.style.whiteSpace = "nowrap";
          el.style.textShadow = "0 1px 2px rgba(0,0,0,0.8)";
          container.appendChild(el);
        }
        const rect = mountRef.current ? mountRef.current.getBoundingClientRect() : { width, height };
        const projectVec = new THREE.Vector3();
        for (let i = 0; i < floatTexts.length; i++) {
          const ft = floatTexts[i];
          const el = container.children[i];
          const wx = ft.x / SCALE, wz = ft.y / SCALE;
          projectVec.set(wx, terrainHeight(wx, wz) + 0.4, wz);
          projectVec.project(camera);
          const behindCamera = projectVec.z > 1;
          const sx = (projectVec.x * 0.5 + 0.5) * rect.width;
          const sy = (-projectVec.y * 0.5 + 0.5) * rect.height;
          el.textContent = ft.text;
          el.style.color = ft.color;
          el.style.left = `${sx}px`;
          el.style.top = `${sy}px`;
          el.style.opacity = behindCamera ? "0" : String(Math.max(0, ft.life));
        }
      }

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(renderLoop);
    }
    renderLoop();

    // Same real bug fixed here as in WrathScene3D.js, verified with
    // an actual test before trusting it: window.resize only fires for
    // the browser window itself changing size — it does not fire for
    // the container's own size changing due to CSS layout settling
    // after mount, or for fullscreen transitions. The camera/renderer
    // were being sized once at whatever moment happened to be
    // available, then never corrected — exactly what left a small
    // rendered scene inside a much larger, mostly empty visible box.
    // ResizeObserver watches the actual container element directly,
    // for any reason its size changes, not just window resizes.
    function handleResize() {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth, h = mountRef.current.clientHeight;
      if (w === 0 || h === 0) return; // container not laid out yet — nothing to size to
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mountRef.current);
    window.addEventListener("resize", handleResize);

    return () => {
      resizeObserver.disconnect();
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

  // Fills 100% of whatever its parent container actually is,
  // deliberately — no fixed height, matching the same fix already
  // applied to WrathScene3D.js. The parent now controls real sizing
  // (a small preview panel or the full fullscreen viewport), and this
  // component's own resize listener already adapts the camera/
  // renderer to match its container's real clientWidth/clientHeight.
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
      <div ref={floatTextContainerRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} />
    </div>
  );
}
