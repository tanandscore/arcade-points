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

export default function KingdomsOfAsh3D({ mapW, mapH, mapRef, buildingsRef, villagersRef, banditsRef, floatTextRef, buildingColors, onWorldClick, onHoverMove, previewBuildingRef }) {
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
    scene.fog = new THREE.FogExp2(0xe8dcc0, 0.0035);
    // A real, plain background matching the fog color, so the
    // horizon blends seamlessly — this was missing entirely after
    // the skydome was removed for the "no sky" fix, which was never
    // a visible problem with the previous steep, near-vertical
    // camera (it never looked far enough across the ground to reach
    // the horizon), but is immediately obvious with a real, low
    // camera angle: without this, the sky is solid black.
    scene.background = new THREE.Color(0xe8dcc0);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 250);
    // Camera set to a 40° angle from horizontal (verified: the castle
    // is prominently framed with clear surrounding context, not too
    // flat and not a top-down map), then pulled back further per
    // direct feedback that features were too close together to see
    // the whole map — height and distance both scaled by the same
    // 1.7x factor, so the 40° angle is preserved from further away.
    camera.position.set(MAP_W / 2, 10.2, MAP_H / 2 + 12.16);
    camera.lookAt(MAP_W / 2, 0.5, MAP_H / 2);

    // The skydome sphere was removed here entirely, per direct
    // request to eliminate the sky. It was also marked fog:false,
    // meaning it would never have faded out no matter how far the
    // ground was extended — removing it is the only real fix.
    scene.add(new THREE.AmbientLight(0xfff2dc, 0.75));
    const sun = new THREE.DirectionalLight(0xfff0d5, 0.85);
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
    const lowColor = new THREE.Color(0x5a7a48);
    const highColor = new THREE.Color(0x9ab576);
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

    // Ghost placement preview — same raycasting pattern as the click
    // handler just above, but firing on every pointer move instead of
    // only on click, reporting the hovered world position up via a
    // new onHoverMove callback rather than duplicating any placement
    // logic here. The actual ghost mesh is built and updated further
    // below, driven by the previewBuildingRef prop this component
    // receives back, not by anything decided in this handler.
    function handlePointerMove(event) {
      if (!onHoverMove) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, camera);
      const hits = raycaster.intersectObject(ground);
      if (hits.length > 0) {
        const point = hits[0].point;
        onHoverMove(point.x * SCALE, point.z * SCALE);
      }
    }
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    function handlePointerLeave() {
      if (onHoverMove) onHoverMove(null, null);
    }
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);

    // Ghost placement preview mesh — a single, real, semi-transparent
    // box built once here and only ever repositioned/recolored inside
    // the render loop below, matching this file's own established
    // pattern for anything that changes every frame (villagers,
    // bandits): build the geometry once, mutate it after. Starts
    // invisible; the render loop turns it on only when previewBuildingRef
    // actually has something to show.
    const previewGeo = new THREE.BoxGeometry(1, 1, 1);
    const previewMat = new THREE.MeshStandardMaterial({ color: 0x3ee680, transparent: true, opacity: 0.45, depthWrite: false, emissive: 0x000000, emissiveIntensity: 1 });
    const previewMesh = new THREE.Mesh(previewGeo, previewMat);
    previewMesh.visible = false;
    scene.add(previewMesh);

    function addMesh(geo, color, x, y, z, opts = {}) {
      const mat = new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.7, metalness: opts.metalness ?? 0.05, emissive: opts.emissive, emissiveIntensity: opts.emissiveIntensity, map: opts.map });
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
    // Lakes instead of a flowing river, per direct request to match
    // the reference map's style. Built as a flat, irregular polygon
    // (not a tube along a curve) — an irregular blob shape reads as a
    // real lake far better than a perfect circle would, and
    // deliberately does NOT touch terrainHeight or any elevation
    // logic at all, learning directly from the earlier hill attempt:
    // modifying the shared height function broke the moat and river
    // through a mesh-resolution mismatch, so this stays a flat,
    // independent shape sitting on the existing terrain instead.
    function lake(cx, cz, radius, irregularity, points, color) {
      const shapePoints = [];
      for (let i = 0; i < points; i++) {
        const ang = (i / points) * Math.PI * 2;
        const r = radius * (1 + irregularity * (Math.sin(ang * 3 + cx) * 0.5 + Math.sin(ang * 5 + cz * 1.3) * 0.3));
        shapePoints.push(new THREE.Vector2(Math.cos(ang) * r, Math.sin(ang) * r));
      }
      const shape = new THREE.Shape(shapePoints);
      const geo = new THREE.ShapeGeometry(shape, 32);
      geo.rotateX(-Math.PI / 2);
      const h = terrainHeight(cx, cz);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0.4, side: THREE.DoubleSide }));
      mesh.position.set(cx, h + 0.02, cz);
      scene.add(mesh);
      const bankGeo = new THREE.ShapeGeometry(shape, 32);
      bankGeo.rotateX(-Math.PI / 2);
      bankGeo.scale(1.18, 1, 1.18);
      const bankMesh = new THREE.Mesh(bankGeo, new THREE.MeshStandardMaterial({ color: 0xc9b183, roughness: 0.95, side: THREE.DoubleSide }));
      bankMesh.position.set(cx, h + 0.01, cz);
      scene.add(bankMesh);
    }
    lake(MAP_W * 0.78, MAP_H * 0.55, MAP_H * 0.42, 0.28, 14, 0x2a6a8a);
    lake(MAP_W * 0.3, -MAP_H * 0.9, MAP_H * 0.16, 0.3, 12, 0x2a6a8a);
    // Three more lakes, per direct request, positioned well outside
    // the existing map area and far from the castle — into the
    // extended ground built for the earlier "no sky" fix, matching
    // where the river/lakes already reached before.
    lake(MAP_W * 1.25, MAP_H * 1.15, MAP_H * 0.3, 0.32, 13, 0x2a6a8a);
    lake(-MAP_W * 0.35, MAP_H * 0.65, MAP_H * 0.22, 0.3, 12, 0x2a6a8a);
    lake(MAP_W * 0.95, -MAP_H * 0.55, MAP_H * 0.19, 0.28, 11, 0x2a6a8a);
    // Three more, per direct request for even more lakes far from
    // the castle — again checked against every other lake and tree
    // cluster's own position/radius before landing here.
    lake(-MAP_W * 0.7, -MAP_H * 0.3, MAP_H * 0.24, 0.3, 12, 0x2a6a8a);
    lake(MAP_W * 1.6, MAP_H * 0.4, MAP_H * 0.2, 0.28, 11, 0x2a6a8a);
    lake(MAP_W * 0.4, MAP_H * 1.7, MAP_H * 0.26, 0.3, 13, 0x2a6a8a);

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
      // More clusters, per direct request, positioned well outside
      // the original map area and far from the castle — checked
      // against the new lakes' own positions/radii so trees don't
      // end up planted inside water.
      { x: MAP_W * 1.15, z: MAP_H * 0.25 }, { x: MAP_W * -0.25, z: MAP_H * 0.15 },
      { x: MAP_W * 0.55, z: -MAP_H * 0.5 }, { x: MAP_W * 0.15, z: MAP_H * 1.4 },
      { x: MAP_W * 1.3, z: -MAP_H * 0.2 },
      // Even more, per direct request — checked against all eight
      // lakes' positions/radii above so no cluster lands in water.
      { x: MAP_W * -0.55, z: -MAP_H * 0.85 }, { x: MAP_W * 1.7, z: MAP_H * 0.85 },
      { x: MAP_W * 0.15, z: -MAP_H * 0.15 }, { x: MAP_W * 1.0, z: MAP_H * 1.75 },
      { x: MAP_W * -0.5, z: MAP_H * 0.35 },
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

    // More standalone rock formations far from the castle, per
    // direct request for more "stone quarries" — reusing the same
    // verified rockCluster function already proven for the map's
    // existing stone outcroppings, just called at new, far positions
    // rather than building a new, untested formation type.
    rockCluster(MAP_W * 1.5, MAP_H * 1.5, 0.95);
    rockCluster(-MAP_W * 0.6, MAP_H * 1.2, 0.85);
    rockCluster(MAP_W * 1.4, -MAP_H * 0.6, 0.8);
    rockCluster(-MAP_W * 0.15, -MAP_H * 0.65, 0.82);

    // Smaller castles far from the main one — a real, separate,
    // simpler structure (one keep, four corner towers, a single
    // crenellation ring), not a scaled copy of the massive main
    // castle above, which is hardcoded throughout to build relative
    // to TOWN_CENTER specifically and isn't safely reusable at an
    // arbitrary position without a real risk of breaking it.
    function smallCastle(cx, cz, scale) {
      const h = terrainHeight(cx, cz);
      addMesh(new THREE.CylinderGeometry(0.16 * scale, 0.19 * scale, 0.5 * scale, 10), stoneGrey, cx, h + 0.25 * scale, cz, { roughness: 0.85 });
      const roof = addMesh(new THREE.ConeGeometry(0.22 * scale, 0.28 * scale, 10), 0x5a1f18, cx, h + 0.64 * scale, cz, { roughness: 0.8 });
      addMesh(new THREE.CylinderGeometry(0.01 * scale, 0.01 * scale, 0.16 * scale, 4), 0x4a3a2a, cx, h + 0.86 * scale, cz);
      const flag = addMesh(new THREE.PlaneGeometry(0.06 * scale, 0.04 * scale), 0x8a1f2b, cx + 0.03 * scale, h + 0.9 * scale, cz, { roughness: 0.8 });
      flag.material.side = THREE.DoubleSide;
      crenellations(cx, cz, h + 0.51 * scale, 0.19 * scale, 8, 0.045 * scale, 0.06 * scale, stoneGreyLight);
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + Math.PI / 4;
        const tx = cx + Math.cos(ang) * 0.34 * scale, tz = cz + Math.sin(ang) * 0.34 * scale;
        addMesh(new THREE.CylinderGeometry(0.07 * scale, 0.085 * scale, 0.38 * scale, 8), stoneGreyDark, tx, h + 0.19 * scale, tz, { roughness: 0.85 });
        const towerRoof = addMesh(new THREE.ConeGeometry(0.1 * scale, 0.14 * scale, 8), 0x5a1f18, tx, h + 0.45 * scale, tz, { roughness: 0.8 });
        crenellations(tx, tz, h + 0.39 * scale, 0.085 * scale, 6, 0.03 * scale, 0.04 * scale, stoneGreyLight);
      }
    }
    smallCastle(MAP_W * 1.35, MAP_H * 0.55, 2.4);
    smallCastle(-MAP_W * 0.4, -MAP_H * 0.15, 2.1);
    smallCastle(MAP_W * 0.65, MAP_H * 1.55, 2.25);

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
    // Tower so it reads distinctly from a house or farm shed. Roof
    // color now varies per building (a small palette of warm
    // terracotta/orange tones, with an occasional blue/teal roof),
    // picked deterministically from each building's own position so
    // it's stable across re-renders rather than random — echoing the
    // reference map's colorful, varied rooftops instead of every
    // building sharing one flat dark brown.
    // A real gabled roof (a ridge with two sloping sides) instead of
    // the previous pyramid-like cone — a 3-sided cylinder with equal
    // top/bottom radius forms a triangular prism, and rotating it 90°
    // around Z lays that prism on its side with the ridge running
    // along X. Verified with a real render before using it here,
    // including testing three different rotation guesses side by
    // side since the correct one wasn't obvious without seeing it.
    function gabledRoof(x, y, z, ridgeLength, slopeRadius, color, map) {
      const roof = addMesh(new THREE.CylinderGeometry(slopeRadius, slopeRadius, ridgeLength, 3), color, x, y, z, { roughness: 0.7, map });
      roof.rotation.z = Math.PI / 2;
      return roof;
    }
    // Procedural textures — no image-generation tool is available, so
    // these are drawn directly onto an HTML canvas with code (rows of
    // rectangles for planks, offset rounded rectangles for shingles),
    // then used as real Three.js textures. Built neutral (white base)
    // and reused across every building via each material's own real
    // color property, which multiplies with the texture's pixel
    // values — one shared texture per pattern, tinted per building
    // type, rather than a new canvas generated per building instance,
    // which would be wasteful (potentially dozens of buildings in a
    // real game) and was verified as the correct approach with a
    // real render testing three different tint colors on the same
    // shared texture before writing this into the real file.
    function makeCanvasTexture(size, drawFn) {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      drawFn(ctx, size);
      const texture = new THREE.CanvasTexture(canvas);
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      return texture;
    }
    function shadeColor(hex, amt) {
      const num = parseInt(hex.slice(1), 16);
      let r = (num >> 16) + amt, g = ((num >> 8) & 0xff) + amt, b = (num & 0xff) + amt;
      r = Math.max(0, Math.min(255, r));
      g = Math.max(0, Math.min(255, g));
      b = Math.max(0, Math.min(255, b));
      return `rgb(${r},${g},${b})`;
    }
    const woodPlankTex = makeCanvasTexture(128, (ctx, size) => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, size, size);
      const plankCount = 6, plankH = size / plankCount;
      for (let i = 0; i < plankCount; i++) {
        ctx.fillStyle = shadeColor("#ffffff", i % 2 === 0 ? -10 : 8);
        ctx.fillRect(0, i * plankH, size, plankH - 2);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.fillRect(0, (i + 1) * plankH - 2, size, 2);
      }
    });
    woodPlankTex.repeat.set(2, 2);
    const shingleTex = makeCanvasTexture(128, (ctx, size) => {
      ctx.fillStyle = shadeColor("#ffffff", -15);
      ctx.fillRect(0, 0, size, size);
      const rows = 8, rowH = size / rows;
      for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * 12;
        for (let c = -1; c < 6; c++) {
          ctx.fillStyle = shadeColor("#ffffff", ((r + c) % 3) * 6 - 6);
          ctx.beginPath();
          ctx.roundRect(c * 24 + offset, r * rowH, 22, rowH - 2, 3);
          ctx.fill();
        }
      }
    });
    shingleTex.repeat.set(2, 1);
    const ROOF_PALETTE = [0xb5502e, 0xc85a3a, 0xd4703f, 0xa8452a, 0x4a7a8a, 0x3f6b7a];
    function genericBuilding(x, z, type, color) {
      const h = terrainHeight(x, z);
      if (type === "watchTower") {
        // Rebuilt to be genuinely tall, imposing, and dangerous —
        // the previous version was a short cylinder with a small
        // cone roof, nowhere near threatening. Now four tapered
        // segments stacking up to real height, a crenellated parapet
        // near the top, a ring of outward-jutting iron spikes for a
        // hostile silhouette, and a glowing warning beacon at the
        // very peak — reinforcing both "watch" (visibility) and
        // "dangerous" (the glow reads as a threat beacon, not a
        // welcoming light) in one element. Scaled up a modest 1.25×
        // here rather than the 1.6× used for other buildings — this
        // one was already tall and imposing before this round, so a
        // smaller bump keeps it proportionate rather than making it
        // disproportionately huge next to everything else.
        const TS = 1.25;
        const dark = 0x3a3630, darker = 0x26221e;
        addMesh(new THREE.CylinderGeometry(0.15 * TS, 0.2 * TS, 0.6 * TS, 10), dark, x, h + 0.3 * TS, z, { roughness: 0.8 });
        addMesh(new THREE.CylinderGeometry(0.1 * TS, 0.16 * TS, 0.55 * TS, 10), darker, x, h + 0.87 * TS, z, { roughness: 0.8 });
        addMesh(new THREE.CylinderGeometry(0.075 * TS, 0.11 * TS, 0.5 * TS, 10), dark, x, h + 1.39 * TS, z, { roughness: 0.8 });
        addMesh(new THREE.CylinderGeometry(0.06 * TS, 0.085 * TS, 0.4 * TS, 10), darker, x, h + 1.84 * TS, z, { roughness: 0.8 });
        crenellations(x, z, h + 2.04 * TS, 0.075 * TS, 8, 0.028 * TS, 0.05 * TS, 0x1a1714);
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2;
          const spike = addMesh(new THREE.ConeGeometry(0.018 * TS, 0.16 * TS, 5), 0x15130f, x + Math.cos(ang) * 0.09 * TS, h + 1.95 * TS, z + Math.sin(ang) * 0.09 * TS, { roughness: 0.5, metalness: 0.5 });
          spike.rotation.set(Math.cos(ang) * 0.9, 0, -Math.sin(ang) * 0.9);
        }
        addMesh(new THREE.SphereGeometry(0.05 * TS, 8, 6), 0xff4a1f, x, h + 2.16 * TS, z, { emissive: 0xff3300, emissiveIntensity: 2.5, roughness: 0.5 });
        const beaconLight = new THREE.PointLight(0xff3a1a, 1.6, 1.8 * TS, 2);
        beaconLight.position.set(x, h + 2.16 * TS, z);
        scene.add(beaconLight);
        return;
      }
      if (type === "farm") {
        // A real, distinct farm look — flat furrowed-soil strips
        // around a small shed, rather than reusing the same
        // box-and-roof shape every other building uses. Flat
        // geometry laid directly on top of the existing ground at
        // this building's own position — deliberately NOT touching
        // terrainHeight itself, learning from the earlier hill
        // mistake that modifying the shared height function broke
        // other terrain-following systems. The furrowed rows
        // themselves are left at field scale (they represent
        // cultivated ground, not a building), but the shed gets the
        // same size-up and gabled roof as every other building here.
        const S = 1.6;
        const rowColors = [0x8a6a42, 0x9a7a4e];
        for (let i = 0; i < 4; i++) {
          const rowZ = z - 0.18 + i * 0.12;
          addMesh(new THREE.BoxGeometry(0.34, 0.012, 0.1), rowColors[i % 2], x, h + 0.006, rowZ, { roughness: 0.95 });
        }
        addMesh(new THREE.BoxGeometry(0.16 * S, 0.13 * S, 0.14 * S), color, x + 0.14, h + 0.07 * S, z + 0.2, { roughness: 0.7, map: woodPlankTex });
        gabledRoof(x + 0.14, h + 0.13 * S + 0.05 * S, z + 0.2, 0.2 * S, 0.09 * S, 0x6e4530, shingleTex);
        return;
      }
      if (type === "house") {
        // Scaled up (S=1.6×) with a real gabled roof, plus real
        // procedural textures on both wall and roof — wood-plank
        // pattern tinted by this building's own color, shingle
        // pattern tinted by the roof's own palette color. This is
        // the genuinely new technique from this round: adding real
        // surface detail via texture mapping on the existing shapes,
        // rather than more geometry — verified to actually render
        // correctly (and to actually tint per-color as intended)
        // with real renders before writing this into the real file.
        const S = 1.6;
        addMesh(new THREE.BoxGeometry(0.32 * S, 0.2 * S, 0.24 * S), color, x, h + 0.1 * S, z, { roughness: 0.65, map: woodPlankTex });
        const roofIdx = Math.abs(Math.floor(x * 137 + z * 251)) % ROOF_PALETTE.length;
        gabledRoof(x, h + 0.2 * S + 0.1 * S, z, 0.42 * S, 0.19 * S, ROOF_PALETTE[roofIdx], shingleTex);
        addMesh(new THREE.BoxGeometry(0.035 * S, 0.14 * S, 0.035 * S), 0x8a7a68, x + 0.09 * S, h + 0.32 * S, z - 0.06 * S, { roughness: 0.85 });
        addMesh(new THREE.BoxGeometry(0.07 * S, 0.11 * S, 0.02 * S), 0x3a2f22, x, h + 0.055 * S, z + 0.121 * S, { roughness: 0.8 });
        addMesh(new THREE.BoxGeometry(0.045 * S, 0.045 * S, 0.015 * S), 0xaee0f0, x - 0.09 * S, h + 0.12 * S, z + 0.121 * S, { roughness: 0.4, metalness: 0.3 });
        return;
      }
      if (type === "blacksmith") {
        // Scaled up, real gabled roof, and now textured walls/roof
        // same as house — wood-plank walls (many blacksmith
        // buildings are timber-framed even with a stone forge
        // inside), dark shingle roof, plus the existing glowing
        // forge window and chimney ember.
        const S = 1.6;
        addMesh(new THREE.BoxGeometry(0.3 * S, 0.2 * S, 0.24 * S), color, x, h + 0.1 * S, z, { roughness: 0.6, metalness: 0.15, map: woodPlankTex });
        gabledRoof(x, h + 0.2 * S + 0.075 * S, z, 0.4 * S, 0.16 * S, 0x3a352c, shingleTex);
        addMesh(new THREE.CylinderGeometry(0.03 * S, 0.035 * S, 0.22 * S, 8), 0x4a4038, x - 0.1 * S, h + 0.31 * S, z - 0.05 * S, { roughness: 0.85 });
        addMesh(new THREE.SphereGeometry(0.022 * S, 8, 6), 0xff5a1f, x - 0.1 * S, h + 0.43 * S, z - 0.05 * S, { emissive: 0xff3300, emissiveIntensity: 2, roughness: 0.5 });
        addMesh(new THREE.BoxGeometry(0.09 * S, 0.05 * S, 0.05 * S), 0x2a2622, x + 0.1 * S, h + 0.045 * S, z + 0.13 * S, { roughness: 0.4, metalness: 0.6 });
        addMesh(new THREE.BoxGeometry(0.05 * S, 0.045 * S, 0.015 * S), 0xff9a5a, x + 0.09 * S, h + 0.13 * S, z + 0.121 * S, { emissive: 0xaa4400, emissiveIntensity: 0.4, roughness: 0.5 });
        return;
      }
      if (type === "lumberCamp") {
        // Scaled up, real gabled roof, and textured shed walls/roof
        // — the log pile itself is left untextured (individual round
        // logs, not a flat wall/roof surface the plank pattern was
        // designed for), but scales proportionally with everything
        // else so it doesn't look small next to the bigger shed.
        const S = 1.6;
        addMesh(new THREE.BoxGeometry(0.28 * S, 0.16 * S, 0.2 * S), color, x, h + 0.08 * S, z, { roughness: 0.75, map: woodPlankTex });
        gabledRoof(x, h + 0.16 * S + 0.06 * S, z, 0.38 * S, 0.13 * S, 0x5a4530, shingleTex);
        for (let row = 0; row < 3; row++) {
          for (let i = 0; i < 3 - row; i++) {
            const log = addMesh(new THREE.CylinderGeometry(0.028 * S, 0.028 * S, 0.16 * S, 8), 0x8a6a42, x + (0.15 + i * 0.06 - row * 0.03) * S, h + (0.028 + row * 0.05) * S, z + 0.14 * S, { roughness: 0.85 });
            log.rotation.z = Math.PI / 2;
          }
        }
        return;
      }
      // Fallback for remaining types (quarry, market, fishingDock)
      // that don't yet have their own distinct shape — scaled up and
      // given a real gabled roof and a window too, same treatment as
      // the other building types above, so these three don't look
      // stuck at the old smaller scale next to everything else.
      const S = 1.6;
      addMesh(new THREE.BoxGeometry(0.32 * S, 0.2 * S, 0.24 * S), color, x, h + 0.1 * S, z, { roughness: 0.65, map: woodPlankTex });
      const roofIdx = Math.abs(Math.floor(x * 137 + z * 251)) % ROOF_PALETTE.length;
      gabledRoof(x, h + 0.2 * S + 0.1 * S, z, 0.42 * S, 0.19 * S, ROOF_PALETTE[roofIdx], shingleTex);
      addMesh(new THREE.BoxGeometry(0.045 * S, 0.045 * S, 0.015 * S), 0xaee0f0, x + 0.09 * S, h + 0.12 * S, z + 0.121 * S, { roughness: 0.4, metalness: 0.3 });
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
      // Ghost placement preview — read fresh every frame from the ref
      // (never the stale prop closure), since this needs to react
      // instantly to mouse movement and building selection. Green,
      // semi-transparent when the hovered spot is valid to build on;
      // red when it isn't — using the exact real width/height each
      // building type actually has, not a fixed placeholder size, so
      // the preview honestly represents the footprint that will
      // actually be placed.
      const preview = previewBuildingRef.current;
      if (preview && preview.x !== null && preview.y !== null) {
        const px = preview.x / SCALE, pz = preview.y / SCALE;
        const pw = (preview.w || 30) / SCALE, ph = (preview.h || 30) / SCALE;
        previewMesh.scale.set(pw, 0.3, ph);
        previewMesh.position.set(px, terrainHeight(px, pz) + 0.15, pz);
        // Green (valid) and red (invalid) need different opacity/glow
        // to both read clearly — tested with real renders, not
        // assumed: a single shared opacity looked fine for green but
        // made red blend into the ground into a muddy brown,
        // defeating the point of a clear warning color. Red gets
        // higher opacity and a real emissive glow; green stays subtle
        // since "yes, you can build here" doesn't need to shout.
        if (preview.valid) {
          previewMat.color.set(0x3ee680);
          previewMat.opacity = 0.45;
          previewMat.emissive.set(0x000000);
        } else {
          previewMat.color.set(0xff2222);
          previewMat.opacity = 0.9;
          previewMat.emissive.set(0x660000);
        }
        previewMesh.visible = true;
      } else {
        previewMesh.visible = false;
      }

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
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
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
