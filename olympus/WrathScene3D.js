"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createCinematic } from "@/lib/cinematic/post";
import { makeSurface, cloneSurface } from "@/lib/cinematic/textures";
import { makeSkyDome, skyEnvironment, disposeEnvironment, makeParticles, makeGlow, makeFlame } from "@/lib/cinematic/atmos";
import { buildHero, buildMonster, animateFigure } from "@/olympus/engine/figures";

// Wrath of Olympus — the battlefield. Raw Three.js driven from the game's own
// live state (refs passed in as props); nothing here decides gameplay.
//
// Look: a stormy golden hour over a Greek hillside. Warm sun low on the
// temple's side, a bruised violet storm over the enemy altar, marble that
// catches the light, lightning that actually lights the field, and heroes and
// monsters with armour, wings, horns and walking animation.
//
// World units: the game's own map pixels divided by SCALE.
const SCALE = 100;

export default function WrathScene3D({
  mapW, mapH, temple, altar, championsRef, enemiesRef, wardsRef, enemyColors, onWorldClick,
  projectilesRef, particlesRef, lightningBoltsRef, floatTextRef, hadesCursesRef, guardiansRef,
  templeHpRef, altarHpRef, furyUntilRef, shieldUntilRef, templeMax = 1000, altarMax = 1400,
}) {
  const mountRef = useRef(null);
  const floatTextContainerRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) return undefined;

    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" }); } catch { return undefined; }

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);

    const MAP_W = mapW / SCALE, MAP_H = mapH / SCALE;
    const TEMPLE = { x: temple.x / SCALE, z: temple.y / SCALE, r: temple.r / SCALE };
    const ALTAR = { x: altar.x / SCALE, z: altar.y / SCALE, r: altar.r / SCALE };

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x9a7c8c, 0.016);

    // ---- sky and light -------------------------------------------------------------
    const sky = makeSkyDome({ zenith: 0x0d1030, mid: 0x5a3c6e, horizon: 0xffa04e, sunDir: [-0.75, 0.2, -0.45], sunColor: 0xffa84a, sunSize: 0.011, glow: 1.1, cloud: 0.8, cloudColor: 0xffc690, cloudShade: 0x2a2038, wind: 0.006 });
    scene.add(sky);
    let envTex = null; let lastEnv = -99;
    try { envTex = skyEnvironment(renderer, sky); scene.environment = envTex; } catch { envTex = null; }

    const camera = new THREE.PerspectiveCamera(68, width / height, 0.1, 400);
    // Wide field of view and a close camera so both structures are large and in frame at once.
    const CAM_BASE = new THREE.Vector3(MAP_W / 2, MAP_H * 0.75, MAP_H + 2);
    camera.position.copy(CAM_BASE);
    camera.lookAt(MAP_W / 2, 0.3, MAP_H * 0.52);

    const hemi = new THREE.HemisphereLight(0xc4a8dc, 0x5a4034, 1.5);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffb878, 3.6);
    sun.position.set(-7, 6.5, MAP_H * 0.6 + 3);
    sun.target.position.set(MAP_W * 0.45, 0, MAP_H * 0.5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -11; sun.shadow.camera.right = 11; sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9;
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 40;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
    scene.add(sun); scene.add(sun.target);
    const flashLight = new THREE.DirectionalLight(0xbcd0ff, 0);
    flashLight.position.set(MAP_W * 0.6, 12, MAP_H * 0.2);
    scene.add(flashLight);
    const stormLight = new THREE.PointLight(0x9a5cff, 7, 8, 1.6);
    stormLight.position.set(altar.x / SCALE, 1.6, altar.y / SCALE);
    scene.add(stormLight);

    // ---- textures (drawn in code) -----------------------------------------------
    const T = {
      earth: makeSurface("grass", { seed: 41, colors: ["#82a656", "#a2c066", "#bcc684"], size: 256 }),
      marble: makeSurface("marble", { seed: 43, colors: ["#fbf6ec", "#d9d2c4", "#8a8fa0"], size: 256, cols: 2 }),
      slab: makeSurface("marble", { seed: 47, colors: ["#efe8da", "#c9c0b0", "#808698"], size: 256, cols: 4 }),
      rock: makeSurface("ash", { seed: 53, colors: ["#6e665e", "#b3a998"], size: 256 }),
      obsidian: makeSurface("stone", { seed: 59, colors: ["#241c32", "#4b3d63"], size: 256, rows: 5, cols: 3 }),
      roof: makeSurface("tiles", { seed: 61, colors: ["#b8532e", "#e08a50"], size: 256, rows: 10, cols: 5 }),
      leaf: makeSurface("grass", { seed: 67, colors: ["#2e4a2a", "#5c7a3a", "#78823c"], size: 128 }),
      bark: makeSurface("wood", { seed: 71, colors: ["#3a2a1c", "#6b4c30"], size: 128, cols: 2 }),
    };
    const tex = (key, rx, ry) => cloneSurface(T[key], rx, ry ?? rx);
    function sMat(key, rx, ry, p = {}) {
      const t = tex(key, rx, ry);
      return new THREE.MeshStandardMaterial({ map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap, normalScale: new THREE.Vector2(p.ns ?? 0.8, p.ns ?? 0.8), roughness: p.roughness ?? 1, metalness: p.metalness ?? 0, color: p.color ?? 0xffffff, envMapIntensity: p.env ?? 0.8, flatShading: !!p.flat, emissive: p.emissive ?? 0x000000, emissiveIntensity: p.emissiveIntensity ?? 1 });
    }
    function addMesh(geo, m, x, y, z, o = {}) {
      const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, y, z);
      mesh.castShadow = o.noShadow ? false : true; mesh.receiveShadow = true;
      if (o.rx) mesh.rotation.x = o.rx; if (o.ry) mesh.rotation.y = o.ry; if (o.rz) mesh.rotation.z = o.rz;
      scene.add(mesh); return mesh;
    }
    const plain = (color, p = {}) => new THREE.MeshStandardMaterial({ color, roughness: p.roughness ?? 0.7, metalness: p.metalness ?? 0, emissive: p.emissive ?? 0x000000, emissiveIntensity: p.emissiveIntensity ?? 1, envMapIntensity: p.env ?? 0.8, side: p.side ?? THREE.FrontSide, flatShading: !!p.flat, transparent: !!p.transparent, opacity: p.opacity ?? 1 });

    // ---- ground ------------------------------------------------------------------
    function terrainHeight(x, z) {
      const midX = MAP_W / 2, midZ = MAP_H / 2;
      const distFromCenter = Math.hypot(x - midX, z - midZ) / Math.max(MAP_W, MAP_H);
      const dip = -0.12 * Math.max(0, 1 - distFromCenter * 2.2);
      return Math.sin(x * 0.55) * 0.16 + Math.cos(z * 0.48) * 0.16 + Math.sin((x + z) * 0.32) * 0.12 + dip;
    }
    const axis = new THREE.Vector2(ALTAR.x - TEMPLE.x, ALTAR.z - TEMPLE.z); const axisLen2 = axis.lengthSq();
    const GW = MAP_W + 6, GH = MAP_H + 6;
    const groundGeo = new THREE.PlaneGeometry(GW, GH, 170, Math.round(170 * (GH / GW)));
    const gpos = groundGeo.getAttribute("position"); const gcolors = [];
    const warm = new THREE.Color(0xffffff), ash = new THREE.Color(0xa898b4), tmp = new THREE.Color();
    for (let i = 0; i < gpos.count; i++) {
      const wx = gpos.getX(i) + MAP_W / 2, wz = MAP_H / 2 - gpos.getY(i);
      const h = terrainHeight(wx, wz); gpos.setZ(i, h);
      const k = THREE.MathUtils.clamp(((wx - TEMPLE.x) * axis.x + (wz - TEMPLE.z) * axis.y) / axisLen2, 0, 1);
      tmp.copy(warm).lerp(ash, Math.pow(k, 1.6) * 0.85);
      gcolors.push(tmp.r, tmp.g, tmp.b);
    }
    groundGeo.setAttribute("color", new THREE.Float32BufferAttribute(gcolors, 3));
    groundGeo.computeVertexNormals();
    const gt = tex("earth", 34, 24);
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, map: gt.map, normalMap: gt.normalMap, normalScale: new THREE.Vector2(0.45, 0.45), roughness: 1, envMapIntensity: 0.5 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(MAP_W / 2, 0, MAP_H / 2); ground.receiveShadow = true;
    scene.add(ground);
    {
      const ot = tex("earth", 90, 90);
      const outer = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ map: ot.map, normalMap: ot.normalMap, color: 0x9a8a78, roughness: 1, envMapIntensity: 0.3 }));
      outer.rotation.x = -Math.PI / 2; outer.position.set(MAP_W / 2, -0.04, MAP_H / 2); outer.receiveShadow = true; scene.add(outer);
    }

    // Real interaction: a click raycasts onto the ground and is converted into the game's own coordinates.
    const raycaster = new THREE.Raycaster(); const pointerNDC = new THREE.Vector2();
    function handleClick(event) {
      if (!onWorldClick) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNDC.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNDC.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNDC, camera);
      const hits = raycaster.intersectObject(ground);
      if (hits.length > 0) { const p = hits[0].point; onWorldClick(p.x * SCALE, p.z * SCALE); }
    }
    renderer.domElement.addEventListener("click", handleClick);
    renderer.domElement.style.cursor = "crosshair";

    // The Sacred Way: a marble road that runs from the temple to the altar.
    {
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24; const x = THREE.MathUtils.lerp(TEMPLE.x + 0.7, ALTAR.x - 0.7, t) + Math.sin(t * Math.PI * 2.2) * 0.35 * Math.sin(t * Math.PI);
        const z = THREE.MathUtils.lerp(TEMPLE.z - 0.2, ALTAR.z + 0.4, t) + Math.cos(t * Math.PI * 1.7) * 0.28 * Math.sin(t * Math.PI);
        pts.push(new THREE.Vector3(x, terrainHeight(x, z) + 0.014, z));
      }
      const curve = new THREE.CatmullRomCurve3(pts); const N = 120; const pos = [], uv = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N; const p = curve.getPoint(t), tg = curve.getTangent(t); const nx = -tg.z, nz = tg.x; const L = Math.hypot(nx, nz) || 1;
        const w = 0.34 * (1 - 0.35 * t);
        pos.push(p.x + (nx / L) * w, p.y, p.z + (nz / L) * w, p.x - (nx / L) * w, p.y, p.z - (nz / L) * w);
        uv.push(0, t * 14, 1, t * 14);
      }
      for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      const tt = tex("slab", 1, 1);
      const road = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tt.map, normalMap: tt.normalMap, roughnessMap: tt.roughnessMap, roughness: 1, color: 0xe6dccb, envMapIntensity: 0.7, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      road.receiveShadow = true; scene.add(road);
    }

    // ---- fire --------------------------------------------------------------------
    const flames = []; const fireLights = [];
    function brazier(x, y, z, color = 0xff8a2a, size = 0.5, withLight = false, lightI = 3) {
      addMesh(new THREE.CylinderGeometry(0.1, 0.05, 0.08, 10), plain(0x6a4a2a, { metalness: 0.8, roughness: 0.4 }), x, y - 0.02, z);
      addMesh(new THREE.CylinderGeometry(0.035, 0.03, 0.2, 8), plain(0x6a4a2a, { metalness: 0.8, roughness: 0.4 }), x, y - 0.12, z);
      const f = makeFlame(color, size); f.position.set(x, y + 0.14, z); scene.add(f); flames.push(f);
      if (withLight) { const l = new THREE.PointLight(color, lightI, 4.5, 2); l.position.set(x, y + 0.3, z); scene.add(l); fireLights.push({ l, base: lightI, ph: x * 3 + z }); f.userData.light = l; }
      return f;
    }

    // ---- the Temple of Olympus -------------------------------------------------
    const tcH = terrainHeight(TEMPLE.x, TEMPLE.z); const tR = TEMPLE.r;
    const marble = (rx, ry, p) => sMat("marble", rx, ry, { roughness: 0.9, color: 0xe6dccb, env: 0.8, ns: 0.4, ...p });
    const slabM = (rx, ry) => sMat("slab", rx, ry, { roughness: 0.9, color: 0xd8cdb8, env: 0.8, ns: 0.5 });
    addMesh(new THREE.BoxGeometry(tR * 5.6, tR * 0.2, tR * 4.0), slabM(4, 3), TEMPLE.x, tcH + tR * 0.1, TEMPLE.z);
    addMesh(new THREE.BoxGeometry(tR * 5.1, tR * 0.2, tR * 3.5), slabM(4, 3), TEMPLE.x, tcH + tR * 0.3, TEMPLE.z);
    addMesh(new THREE.BoxGeometry(tR * 4.6, tR * 0.2, tR * 3.0), slabM(3, 2), TEMPLE.x, tcH + tR * 0.5, TEMPLE.z);
    const floorY = tcH + tR * 0.6;
    // inner chamber (cella)
    addMesh(new THREE.BoxGeometry(tR * 3.0, tR * 1.8, tR * 1.5), marble(3, 2), TEMPLE.x, floorY + tR * 0.9, TEMPLE.z - tR * 0.15);
    addMesh(new THREE.BoxGeometry(tR * 2.6, tR * 1.5, tR * 0.1), plain(0xffb55a, { emissive: 0xff9a3a, emissiveIntensity: 0.5, roughness: 0.8 }), TEMPLE.x, floorY + tR * 0.8, TEMPLE.z + tR * 0.64, { noShadow: true });
    // fluted columns
    const colH = tR * 1.7; const colMat = marble(6, 1, { color: 0xede4d2 });
    const colAt = (x, z) => {
      addMesh(new THREE.CylinderGeometry(tR * 0.12, tR * 0.14, colH, 24), colMat, x, floorY + colH / 2, z);
      addMesh(new THREE.BoxGeometry(tR * 0.34, tR * 0.06, tR * 0.34), marble(1, 1), x, floorY + 0.03 * tR, z);
      addMesh(new THREE.CylinderGeometry(tR * 0.19, tR * 0.13, tR * 0.1, 16), marble(2, 1), x, floorY + colH + tR * 0.05, z);
      addMesh(new THREE.BoxGeometry(tR * 0.4, tR * 0.07, tR * 0.4), marble(1, 1), x, floorY + colH + tR * 0.13, z);
    };
    for (const cx of [-1.9, -1.14, -0.38, 0.38, 1.14, 1.9]) { colAt(TEMPLE.x + cx * tR, TEMPLE.z - tR * 1.3); colAt(TEMPLE.x + cx * tR, TEMPLE.z + tR * 1.3); }
    for (const cz of [-0.65, 0, 0.65]) { colAt(TEMPLE.x - tR * 2.05, TEMPLE.z + cz * tR); colAt(TEMPLE.x + tR * 2.05, TEMPLE.z + cz * tR); }
    const topY = floorY + colH + tR * 0.17;
    addMesh(new THREE.BoxGeometry(tR * 4.7, tR * 0.22, tR * 3.0), marble(4, 1), TEMPLE.x, topY + tR * 0.11, TEMPLE.z);
    const frieze = addMesh(new THREE.BoxGeometry(tR * 4.74, tR * 0.2, tR * 3.04), plain(0xe9d8b8, { roughness: 0.8 }), TEMPLE.x, topY + tR * 0.33, TEMPLE.z);
    for (let i = 0; i < 24; i++) { const x = TEMPLE.x - tR * 2.2 + (i / 23) * tR * 4.4; for (const sd of [-1, 1]) addMesh(new THREE.BoxGeometry(tR * 0.07, tR * 0.16, tR * 0.04), plain(0x7a5a3a, { roughness: 0.8 }), x, topY + tR * 0.33, TEMPLE.z + sd * tR * 1.53, { noShadow: true }); }
    addMesh(new THREE.BoxGeometry(tR * 4.9, tR * 0.08, tR * 3.2), marble(4, 1), TEMPLE.x, topY + tR * 0.48, TEMPLE.z);
    // roof with terracotta tiles, pediments at both ends
    const roofRise = tR * 0.95; const roofW = tR * 3.25;
    for (const sd of [-1, 1]) {
      const slope = new THREE.Mesh(new THREE.BoxGeometry(tR * 5.0, tR * 0.07, Math.hypot(roofW / 2, roofRise) + 0.05), sMat("roof", 6, 2, { roughness: 0.85, color: 0xffffff, ns: 1.0 }));
      slope.position.set(TEMPLE.x, topY + tR * 0.52 + roofRise / 2, TEMPLE.z + sd * roofW / 4);
      slope.rotation.x = -sd * Math.atan2(roofRise, roofW / 2); slope.castShadow = true; slope.receiveShadow = true; scene.add(slope);
    }
    addMesh(new THREE.CylinderGeometry(tR * 0.05, tR * 0.05, tR * 5.0, 8), plain(0xc86a3a, { roughness: 0.7 }), TEMPLE.x, topY + tR * 0.52 + roofRise + tR * 0.02, TEMPLE.z, { rz: Math.PI / 2 });
    const pedShape = new THREE.Shape(); pedShape.moveTo(-roofW / 2, 0); pedShape.lineTo(roofW / 2, 0); pedShape.lineTo(0, roofRise); pedShape.closePath();
    for (const sd of [-1, 1]) {
      const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(pedShape, { depth: tR * 0.1, bevelEnabled: false }), marble(2, 1));
      ped.rotation.y = Math.PI / 2; ped.position.set(TEMPLE.x + sd * tR * 2.46 - (sd > 0 ? tR * 0.1 : 0), topY + tR * 0.55, TEMPLE.z); ped.castShadow = true; ped.receiveShadow = true; scene.add(ped);
      const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(tR * 0.3, 20), plain(0xffd23f, { emissive: 0xffa010, emissiveIntensity: 1.4, metalness: 0.8, roughness: 0.3 }));
      sunDisc.rotation.y = sd * Math.PI / 2; sunDisc.position.set(TEMPLE.x + sd * tR * 2.58, topY + tR * 0.75, TEMPLE.z); scene.add(sunDisc);
    }
    for (const [x, z] of [[-2.45, 0], [2.45, 0]]) addMesh(new THREE.ConeGeometry(tR * 0.14, tR * 0.32, 4), plain(0xffd23f, { metalness: 0.9, roughness: 0.3, emissive: 0x6a4200, emissiveIntensity: 0.4 }), TEMPLE.x + x * tR, topY + tR * 0.55 + roofRise + tR * 0.15, TEMPLE.z + z);
    // golden statue of Zeus inside the chamber's open front
    {
      const gold = plain(0xffc94a, { metalness: 0.95, roughness: 0.28, emissive: 0x7a4a00, emissiveIntensity: 0.5 });
      const sx = TEMPLE.x, sz = TEMPLE.z + tR * 0.38, sy = floorY;
      addMesh(new THREE.BoxGeometry(tR * 0.5, tR * 0.2, tR * 0.5), marble(1, 1), sx, sy + tR * 0.1, sz);
      addMesh(new THREE.ConeGeometry(tR * 0.24, tR * 0.9, 12), gold, sx, sy + tR * 0.65, sz);
      addMesh(new THREE.CylinderGeometry(tR * 0.14, tR * 0.19, tR * 0.45, 12), gold, sx, sy + tR * 1.2, sz);
      addMesh(new THREE.SphereGeometry(tR * 0.13, 14, 10), gold, sx, sy + tR * 1.58, sz);
      addMesh(new THREE.CylinderGeometry(tR * 0.045, tR * 0.04, tR * 0.5, 8), gold, sx + tR * 0.22, sy + tR * 1.42, sz, { rz: -0.9 });
      addMesh(new THREE.CylinderGeometry(tR * 0.045, tR * 0.04, tR * 0.5, 8), gold, sx - tR * 0.22, sy + tR * 1.22, sz, { rz: 0.5 });
      const bolt = addMesh(new THREE.OctahedronGeometry(tR * 0.1), plain(0xfff3a0, { emissive: 0xffe060, emissiveIntensity: 3 }), sx + tR * 0.42, sy + tR * 1.68, sz, { noShadow: true });
      bolt.scale.set(0.6, 2.2, 0.6); bolt.userData.spin = true; flames.push({ userData: { update: (t) => { bolt.rotation.y = t * 1.6; } }, position: new THREE.Vector3() });
      const g = makeGlow(0xffe08a, tR * 1.4, 0.6); g.position.set(sx + tR * 0.42, sy + tR * 1.68, sz); scene.add(g);
    }
    // braziers and banners
    brazier(TEMPLE.x - tR * 2.55, floorY - 0.02, TEMPLE.z + tR * 1.9, 0xff8a2a, 0.45, true, 3.2);
    brazier(TEMPLE.x + tR * 2.55, floorY - 0.02, TEMPLE.z + tR * 1.9, 0xff8a2a, 0.45, true, 3.2);
    brazier(TEMPLE.x - tR * 2.55, floorY - 0.02, TEMPLE.z - tR * 1.9, 0xff8a2a, 0.4);
    brazier(TEMPLE.x + tR * 2.55, floorY - 0.02, TEMPLE.z - tR * 1.9, 0xff8a2a, 0.4);
    brazier(TEMPLE.x, floorY + tR * 0.05, TEMPLE.z + tR * 1.0, 0xffa22a, 0.4, true, 2.2);
    const banners = [];
    for (const cx of [-1.14, 1.14]) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(tR * 0.4, tR * 1.0, 1, 6), plain(0xa8141c, { roughness: 0.85, side: THREE.DoubleSide }));
      b.position.set(TEMPLE.x + cx * tR, topY - tR * 0.55, TEMPLE.z + tR * 1.42); b.castShadow = true; scene.add(b); banners.push(b);
      addMesh(new THREE.CircleGeometry(tR * 0.11, 14), plain(0xffd23f, { emissive: 0x6a4200, emissiveIntensity: 0.6, metalness: 0.9 }), b.position.x, b.position.y + tR * 0.12, b.position.z + 0.012, { noShadow: true });
    }
    for (const sd of [-1, 1]) { // approach stairs
      for (let i = 0; i < 4; i++) addMesh(new THREE.BoxGeometry(tR * 1.4, tR * 0.07, tR * 0.3), slabM(2, 1), TEMPLE.x + sd * tR * 0.0 + (sd - 1) * 0, tcH + tR * 0.5 - i * tR * 0.1, TEMPLE.z + tR * 1.65 + i * tR * 0.28);
      break;
    }

    // ---- the enemy Altar ---------------------------------------------------------
    const aH = terrainHeight(ALTAR.x, ALTAR.z); const aR = ALTAR.r;
    const obs = (rx, ry, p) => sMat("obsidian", rx, ry, { roughness: 0.6, color: 0xb8a8d8, env: 0.9, ns: 1, metalness: 0.15, ...p });
    addMesh(new THREE.CylinderGeometry(aR * 1.9, aR * 2.1, aR * 0.3, 14), obs(5, 1), ALTAR.x, aH + aR * 0.15, ALTAR.z);
    addMesh(new THREE.CylinderGeometry(aR * 1.5, aR * 1.7, aR * 0.32, 12), obs(4, 1), ALTAR.x, aH + aR * 0.46, ALTAR.z);
    addMesh(new THREE.CylinderGeometry(aR * 1.1, aR * 1.25, aR * 0.3, 10), obs(3, 1), ALTAR.x, aH + aR * 0.76, ALTAR.z);
    const veinM = plain(0x9a50ff, { emissive: 0x8a3cff, emissiveIntensity: 2.4, roughness: 0.4 });
    const spires = [];
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * Math.PI * 2 + 0.3; const spH = aR * (1.7 + ((i * 17) % 5) / 6); const px = ALTAR.x + Math.cos(ang) * aR * 1.35, pz = ALTAR.z + Math.sin(ang) * aR * 1.35;
      const sp = addMesh(new THREE.ConeGeometry(aR * 0.2, spH, 7), obs(1, 2, { flat: true }), px, aH + spH * 0.5 + aR * 0.3, pz); sp.rotation.set((Math.random() - 0.5) * 0.18, 0, (((i * 23) % 10) / 10 - 0.5) * 0.24);
      const vn = addMesh(new THREE.ConeGeometry(aR * 0.04, spH * 0.92, 5), veinM, px, aH + spH * 0.47 + aR * 0.3, pz, { noShadow: true }); vn.rotation.copy(sp.rotation); vn.position.x += Math.sign(Math.cos(ang)) * aR * 0.12 * 0; spires.push(vn);
    }
    // monolith + floating crystal
    addMesh(new THREE.BoxGeometry(aR * 0.7, aR * 1.3, aR * 0.7), obs(1, 2, { flat: true }), ALTAR.x, aH + aR * 1.4, ALTAR.z).rotation.y = 0.4;
    const crystal = addMesh(new THREE.OctahedronGeometry(aR * 0.38), plain(0xc890ff, { emissive: 0xa050ff, emissiveIntensity: 2.2, roughness: 0.2, transparent: true, opacity: 0.92 }), ALTAR.x, aH + aR * 2.5, ALTAR.z, { noShadow: true });
    crystal.scale.set(0.8, 1.5, 0.8);
    const crystalGlow = makeGlow(0xa86cff, aR * 2.6, 0.6); crystalGlow.position.set(ALTAR.x, aH + aR * 2.5, ALTAR.z); scene.add(crystalGlow);
    // glowing rune circle
    const runeTex = (() => { const c = document.createElement("canvas"); c.width = c.height = 256; const g = c.getContext("2d"); g.translate(128, 128); g.strokeStyle = "#caa0ff"; g.lineWidth = 3; g.shadowColor = "#a050ff"; g.shadowBlur = 10; for (const r of [120, 100, 64]) { g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); } for (let i = 0; i < 24; i++) { g.save(); g.rotate((i / 24) * Math.PI * 2); g.beginPath(); g.moveTo(0, -100); g.lineTo(6, -110); g.lineTo(-6, -110); g.lineTo(0, -120); g.moveTo(0, -64); g.lineTo(0, -100); g.stroke(); g.restore(); } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
    const runes = new THREE.Mesh(new THREE.PlaneGeometry(aR * 6.2, aR * 6.2), new THREE.MeshBasicMaterial({ map: runeTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7, fog: false }));
    runes.rotation.x = -Math.PI / 2; runes.position.set(ALTAR.x, aH + 0.02, ALTAR.z); scene.add(runes);
    for (const ang of [0.5, 2.6, 4.7]) brazier(ALTAR.x + Math.cos(ang) * aR * 2.2, aH + 0.18, ALTAR.z + Math.sin(ang) * aR * 2.2, 0x9a50ff, 0.45);

    // ---- landscape: ruins, trees, rocks, mountains ----------------------------------------
    const rockM = (c = 0xd8d0c0) => sMat("rock", 1.5, 1.5, { color: c, roughness: 1, flat: true, ns: 1.2, env: 0.5 });
    function ruinColumn(x, z, colHeight, fallen) {
      const h = terrainHeight(x, z);
      const col = addMesh(new THREE.CylinderGeometry(0.075, 0.085, colHeight, 14), marble(3, 1, { color: 0xd8d0c0 }), x, h + (fallen ? 0.08 : colHeight / 2), z);
      if (fallen) { col.rotation.z = Math.PI / 2; col.rotation.y = x * 3; } else addMesh(new THREE.BoxGeometry(0.2, 0.05, 0.2), marble(1, 1, { color: 0xd8d0c0 }), x, h + colHeight + 0.02, z);
    }
    function rubble(x, z, count) {
      for (let i = 0; i < count; i++) { const ang = (i / count) * Math.PI * 2; const rx = x + Math.cos(ang) * 0.25, rz = z + Math.sin(ang) * 0.25; const h = terrainHeight(rx, rz); const r = addMesh(new THREE.DodecahedronGeometry(0.07 + (i % 3) * 0.035, 0), rockM(), rx, h + 0.06, rz); r.rotation.set(i, i * 2, 0); }
    }
    for (const spot of [
      { x: TEMPLE.x + 2.2, z: TEMPLE.z - 1.0, fallen: false }, { x: TEMPLE.x + 3.4, z: TEMPLE.z - 2.1, fallen: true },
      { x: MAP_W / 2, z: MAP_H / 2 + 0.6, fallen: true }, { x: MAP_W / 2 - 1.2, z: MAP_H / 2 - 0.4, fallen: false },
      { x: ALTAR.x - 2.6, z: ALTAR.z + 1.4, fallen: true }, { x: MAP_W * 0.62, z: MAP_H * 0.72, fallen: false },
    ]) { ruinColumn(spot.x, spot.z, 0.7 + ((spot.x * 7) % 3) * 0.25, spot.fallen); rubble(spot.x + 0.15, spot.z + 0.1, 4); }
    // broken arch
    { const ax = MAP_W * 0.48, az = MAP_H * 0.3; for (const sd of [-1, 1]) addMesh(new THREE.BoxGeometry(0.14, 1.1, 0.14), marble(1, 3, { color: 0xd8d0c0 }), ax + sd * 0.5, terrainHeight(ax, az) + 0.55, az); addMesh(new THREE.BoxGeometry(0.62, 0.12, 0.16), marble(2, 1, { color: 0xd8d0c0 }), ax - 0.28, terrainHeight(ax, az) + 1.1, az).rotation.z = 0.12; }
    // trees (cypress and olive)
    let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const leafMat = () => sMat("leaf", 2, 2, { roughness: 1, flat: true, ns: 0.4, env: 0.5, color: 0xd8e8c0 });
    const barkMat = sMat("bark", 1, 2, { roughness: 1, env: 0.4 });
    const nearStruct = (x, z) => Math.hypot(x - TEMPLE.x, z - TEMPLE.z) < 2.4 || Math.hypot(x - ALTAR.x, z - ALTAR.z) < 2.0;
    const trees = [];
    for (let i = 0; i < 90; i++) {
      const x = -2.2 + rnd() * (MAP_W + 4.4), z = -3.2 + rnd() * (MAP_H + 5.5); const edge = x < 0.6 || x > MAP_W - 0.6 || z < 0.5 || z > MAP_H - 0.4;
      if (nearStruct(x, z) || (!edge && rnd() > 0.12)) continue;
      const h = terrainHeight(x, z); const sc = 0.8 + rnd() * 0.8;
      if (rnd() < 0.55) {
        const c = addMesh(new THREE.CylinderGeometry(0.01, 0.17 * sc, 1.5 * sc, 7, 3), leafMat(), x, h + 0.75 * sc, z); c.scale.set(1, 1, 1); trees.push(c);
      } else {
        addMesh(new THREE.CylinderGeometry(0.04 * sc, 0.07 * sc, 0.5 * sc, 6), barkMat, x, h + 0.25 * sc, z);
        for (let k = 0; k < 3; k++) addMesh(new THREE.IcosahedronGeometry(0.3 * sc, 0), sMat("leaf", 2, 2, { flat: true, ns: 0.3, color: 0xb8c8a8, env: 0.5 }), x + (rnd() - 0.5) * 0.25 * sc, h + (0.58 + k * 0.08) * sc, z + (rnd() - 0.5) * 0.25 * sc).scale.set(1.2, 0.7, 1.2);
      }
    }
    for (let i = 0; i < 26; i++) { const x = -2 + rnd() * (MAP_W + 4), z = -3 + rnd() * (MAP_H + 5); if (nearStruct(x, z)) continue; const s = 0.1 + rnd() * 0.3; addMesh(new THREE.DodecahedronGeometry(s, 0), rockM(), x, terrainHeight(x, z) + s * 0.4, z).rotation.set(rnd() * 3, rnd() * 3, 0); }
    // distant mountains and a ruined acropolis
    for (let i = 0; i < 14; i++) {
      const x = -20 + i * 4.8 + rnd() * 2, z = -13 - rnd() * 16; const s = 3 + rnd() * 5;
      const geo = new THREE.IcosahedronGeometry(s, 2); const p = geo.getAttribute("position");
      for (let k = 0; k < p.count; k++) { const nx = p.getX(k), ny = p.getY(k), nz = p.getZ(k); const n = Math.sin(nx * 1.7 + i) * Math.cos(nz * 1.3 + i * 2) * 0.35 + Math.sin(ny * 2.1) * 0.2; p.setXYZ(k, nx * (1 + n * 0.4), ny * (ny > 0 ? 1.5 : 0.4) * (1 + n * 0.5), nz * (1 + n * 0.4)); }
      geo.computeVertexNormals();
      addMesh(geo, sMat("rock", 3, 3, { color: 0x9a8aa0, flat: true, roughness: 1, env: 0.4 }), x, s * 0.1 - 0.4, z, { noShadow: true });
    }
    for (let i = 0; i < 7; i++) addMesh(new THREE.CylinderGeometry(0.16, 0.18, 1.7, 12), marble(3, 1, { color: 0xe0d4c0 }), -8.5 + i * 0.7, 3.6, -15.5, { noShadow: true });
    addMesh(new THREE.BoxGeometry(5.4, 0.25, 1.3), marble(4, 1, { color: 0xe0d4c0 }), -6.3, 4.6, -15.5, { noShadow: true });

    // ---- air: dust motes, violet embers, rain of ash near the altar --------------------
    const centre = new THREE.Vector3(MAP_W / 2, 0, MAP_H / 2);
    const motes = makeParticles({ count: 380, area: 22, height: 5, rise: 0.06, drift: 0.7, size: 22, color: 0xffd890, color2: 0xfff2d0, flicker: 0, opacity: 0.5, baseY: 0.1, wind: [1, 0.3] });
    const altarEmbers = makeParticles({ count: 220, area: 9, height: 6, rise: 0.9, drift: 0.5, size: 40, color: 0x8a40ff, color2: 0xd8a8ff, flicker: 1, baseY: 0.2 });
    const templeEmbers = makeParticles({ count: 120, area: 6, height: 4, rise: 0.7, drift: 0.4, size: 34, color: 0xff7a1a, color2: 0xffd070, flicker: 1, baseY: 0.5 });
    const smokeT = makeParticles({ count: 90, area: 4, height: 4.5, rise: 0.55, drift: 0.3, size: 90, color: 0x2a2428, color2: 0x4a4048, flicker: 0, additive: false, opacity: 0, baseY: 0.6 });
    const smokeA = makeParticles({ count: 90, area: 4, height: 4.5, rise: 0.55, drift: 0.3, size: 90, color: 0x1a1220, color2: 0x3a2c4a, flicker: 0, additive: false, opacity: 0, baseY: 0.6 });
    for (const p of [motes, altarEmbers, templeEmbers, smokeT, smokeA]) scene.add(p);
    // fire that grows as a structure takes damage
    const dmgFlames = { temple: [], altar: [] };
    for (const [key, base, col] of [["temple", TEMPLE, 0xff6a1a], ["altar", ALTAR, 0xb060ff]]) {
      const R = base.r; const offs = [[0.9, 0.2], [-1.0, -0.3], [0.2, 0.9]];
      offs.forEach(([ox, oz], i) => { const f = makeFlame(col, R * 1.7); const x = base.x + ox * R * 1.4, z = base.z + oz * R * 1.2; f.position.set(x, terrainHeight(x, z) + R * (key === "temple" ? 2.6 : 1.3), z); f.visible = false; scene.add(f); dmgFlames[key].push(f); });
    }

    // ---- units ---------------------------------------------------------------------------
    const championUnits = new Map(), enemyUnits = new Map(), wardUnits = new Map(), guardianUnits = new Map();
    const barBgMat = new THREE.SpriteMaterial({ color: 0x120a0a, transparent: true, opacity: 0.75, depthTest: false, depthWrite: false });
    function makeBar(color) {
      const bg = new THREE.Sprite(barBgMat); bg.scale.set(0.3, 0.035, 1); bg.renderOrder = 20;
      const fg = new THREE.Sprite(new THREE.SpriteMaterial({ color, depthTest: false, depthWrite: false })); fg.scale.set(0.3, 0.025, 1); fg.renderOrder = 21;
      return { bg, fg };
    }
    function setBar(bar, ratio, w = 0.3) { const r = Math.max(0.001, Math.min(1, ratio)); bar.bg.scale.x = w; bar.fg.scale.x = w * r; bar.fg.center.set(0.5 / r, 0.5); bar.fg.material.color.setHSL(0.33 * r, 0.8, 0.5); }
    function addUnit(map, id, obj, hpColor, withBar = true) {
      scene.add(obj); const unit = { obj, lx: null, lz: null, face: 0, phase: Math.random() * 6, speed: 0 };
      if (withBar) { unit.bar = makeBar(hpColor); unit.bar.bg.position.y = obj.userData.height + 0.14; unit.bar.fg.position.y = obj.userData.height + 0.14; obj.add(unit.bar.bg); obj.add(unit.bar.fg); }
      map.set(id, unit); return unit;
    }
    function dropUnit(map, id) { const u = map.get(id); if (!u) return; scene.remove(u.obj); u.obj.traverse((o) => { if (o.isSprite && o.material !== barBgMat && o.material.dispose) o.material.dispose(); }); map.delete(id); }
    function steer(unit, x, z, dt, defaultFace) {
      if (unit.lx !== null) { const dx = x - unit.lx, dz = z - unit.lz; const d = Math.hypot(dx, dz); unit.speed += ((Math.min(1, d / Math.max(dt, 0.001) / 1.2)) - unit.speed) * Math.min(1, dt * 8); if (d > 0.0006) unit.face = Math.atan2(dx, dz); else if (defaultFace !== undefined && unit.speed < 0.05) unit.face = defaultFace; }
      unit.lx = x; unit.lz = z;
      let df = unit.face - unit.obj.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); unit.obj.rotation.y += df * Math.min(1, dt * 10);
    }
    function buildGuardian() {
      const root = new THREE.Group(); const stone = sMat("obsidian", 1, 1, { color: 0xb0a0c8, flat: true, roughness: 0.8, ns: 1 }); const eye = plain(0xb870ff, { emissive: 0xb060ff, emissiveIntensity: 4 });
      const mk = (g, m, x, y, z) => { const me = new THREE.Mesh(g, m); me.position.set(x, y, z); me.castShadow = true; me.receiveShadow = true; root.add(me); return me; };
      for (const sd of [-1, 1]) { mk(new THREE.BoxGeometry(0.17, 0.4, 0.17), stone, sd * 0.12, 0.2, 0); mk(new THREE.BoxGeometry(0.15, 0.5, 0.15), stone, sd * 0.3, 0.62, 0).rotation.z = sd * 0.15; mk(new THREE.DodecahedronGeometry(0.1, 0), stone, sd * 0.33, 0.34, 0.02); }
      mk(new THREE.BoxGeometry(0.52, 0.55, 0.3), stone, 0, 0.66, 0); mk(new THREE.DodecahedronGeometry(0.17, 0), stone, 0, 1.08, 0);
      for (const sd of [-1, 1]) mk(new THREE.SphereGeometry(0.03, 6, 6), eye, sd * 0.06, 1.1, 0.14);
      mk(new THREE.OctahedronGeometry(0.07), plain(0xb870ff, { emissive: 0xa050ff, emissiveIntensity: 3 }), 0, 0.7, 0.17);
      root.userData = { height: 1.3 }; root.scale.setScalar(1.2); return root;
    }
    function buildWard() {
      const root = new THREE.Group(); const gold = plain(0xffd23f, { metalness: 0.9, roughness: 0.3, emissive: 0x7a4a00, emissiveIntensity: 0.6 });
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.08, 8), slabM(1, 1)); base.position.y = 0.04; base.castShadow = true; root.add(base);
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.44, 4), gold); pil.position.y = 0.3; pil.rotation.y = Math.PI / 4; pil.castShadow = true; root.add(pil);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), plain(0xffe680, { emissive: 0xffc030, emissiveIntensity: 3 })); gem.position.y = 0.66; root.add(gem);
      const glow = makeGlow(0xffd23f, 0.7, 0.8); glow.position.y = 0.66; root.add(glow);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.32, 36), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; root.add(ring);
      root.userData = { height: 0.9, gem, ring }; return root;
    }

    // ---- effects ------------------------------------------------------------------------
    const colorCache = new Map(); const parseColor = (c) => { let v = colorCache.get(c); if (!v) { v = new THREE.Color(c); colorCache.set(c, v); } return v; };
    // spell beams
    const beamPool = []; const beamGeo = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true); beamGeo.translate(0, 0.5, 0);
    const yAxis = new THREE.Vector3(0, 1, 0); const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
    function getBeam(i) { if (!beamPool[i]) { const core = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); const head = makeGlow(0xffffff, 0.3, 1); scene.add(core); scene.add(head); beamPool[i] = { core, head }; } return beamPool[i]; }
    // particles from the game
    const MAXP = 800; const pGeo = new THREE.BufferGeometry(); const pPos = new Float32Array(MAXP * 3), pCol = new Float32Array(MAXP * 4);
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute("aCol", new THREE.BufferAttribute(pCol, 4));
    const pMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: "attribute vec4 aCol; varying vec4 vC; void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aCol.a * 120.0 / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }",
      fragmentShader: "varying vec4 vC; void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(c)); a *= a; gl_FragColor = vec4(vC.rgb * a * 1.6, a); }",
    });
    const pPoints = new THREE.Points(pGeo, pMat); pPoints.frustumCulled = false; scene.add(pPoints);
    // lightning
    const boltMeshes = new Map(); const ambientBolts = [];
    function buildBoltGeometry(startX, startZ, endX, endZ, topY, endY, width, forks) {
      const path = [new THREE.Vector3(startX, topY, startZ)]; const n = 14;
      for (let i = 1; i < n; i++) { const t = i / n; const j = (1 - t * 0.5) * 0.5; path.push(new THREE.Vector3(THREE.MathUtils.lerp(startX, endX, t) + (Math.random() - 0.5) * j, THREE.MathUtils.lerp(topY, endY, t), THREE.MathUtils.lerp(startZ, endZ, t) + (Math.random() - 0.5) * j * 0.6)); }
      path.push(new THREE.Vector3(endX, endY, endZ));
      const pos = [], idx = []; let base = 0;
      const strip = (pts, w) => { for (let i = 0; i < pts.length; i++) { const k = 1 - (i / (pts.length - 1)) * 0.5; pos.push(pts[i].x - w * k, pts[i].y, pts[i].z, pts[i].x + w * k, pts[i].y, pts[i].z); } for (let i = 0; i < pts.length - 1; i++) { const a = base + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } base += pts.length * 2; };
      strip(path, width);
      for (let f = 0; f < forks; f++) { const s = 3 + Math.floor(Math.random() * 6); const sub = [path[s].clone()]; const dir = Math.random() < 0.5 ? -1 : 1; for (let i = 1; i < 5; i++) sub.push(new THREE.Vector3(sub[i - 1].x + dir * (0.12 + Math.random() * 0.2), sub[i - 1].y - (0.5 + Math.random() * 0.6), sub[i - 1].z + (Math.random() - 0.5) * 0.2)); strip(sub, width * 0.5); }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
    }
    function spawnBoltMesh(startX, startZ, endX, endZ, endY, color, big) {
      const glowM = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      const coreM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
      const gGeo = buildBoltGeometry(startX, startZ, endX, endZ, big ? 9 : 14, endY, big ? 0.16 : 0.1, 3);
      const cGeo = buildBoltGeometry(startX, startZ, endX, endZ, big ? 9 : 14, endY, big ? 0.045 : 0.03, 0); // the core follows a slightly different path; fine, it reads as a hot centre
      const grp = new THREE.Group(); grp.add(new THREE.Mesh(gGeo, glowM)); grp.add(new THREE.Mesh(cGeo, coreM)); scene.add(grp);
      return { grp, glowM, coreM, geos: [gGeo, cGeo] };
    }
    function disposeBolt(b) { scene.remove(b.grp); b.geos.forEach((g) => g.dispose()); b.glowM.dispose(); b.coreM.dispose(); }
    const impactLight = new THREE.PointLight(0xcfe0ff, 0, 9, 1.5); scene.add(impactLight);
    let flash = 0, shake = 0, nextStrike = 4;
    // Hades zones and Athena's shield
    const zoneMat = (color) => new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { uT: { value: 0 }, uC: { value: new THREE.Color(color) } },
      vertexShader: "varying vec2 vU; void main(){ vU = uv - 0.5; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform float uT; uniform vec3 uC; varying vec2 vU; void main(){ float r = length(vU) * 2.0; if (r > 1.0) discard; float a = atan(vU.y, vU.x); float sw = 0.5 + 0.5 * sin(a * 6.0 + uT * 2.0 - r * 9.0); float rim = smoothstep(0.82, 0.96, r) * (1.0 - smoothstep(0.96, 1.0, r)); float body = (1.0 - r) * 0.55 * (0.4 + 0.6 * sw); gl_FragColor = vec4(uC * (rim * 2.2 + body), (rim + body) * 0.9); }" });
    const zones = new Map();
    const shieldMat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false, uniforms: { uT: { value: 0 }, uA: { value: 0 } },
      vertexShader: "varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; vP = position; gl_Position = projectionMatrix * mv; }",
      fragmentShader: "uniform float uT; uniform float uA; varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ float f = 1.0 - abs(dot(normalize(vN), normalize(vV))); float hex = 0.5 + 0.5 * sin(vP.x * 14.0 + uT) * sin(vP.y * 14.0 - uT * 0.7) * sin(vP.z * 14.0); float a = (pow(f, 2.0) * 1.2 + hex * 0.12) * uA; gl_FragColor = vec4(vec3(0.3, 0.95, 0.95) * a, a); }" });
    const shield = new THREE.Mesh(new THREE.SphereGeometry(tR * 3.3, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), shieldMat); shield.position.set(TEMPLE.x, tcH, TEMPLE.z); shield.visible = false; scene.add(shield);
    const furyGlows = new Map();

    // ---- cinematic camera ------------------------------------------------------------------
    const cine = createCinematic(renderer, scene, camera, { exposure: 1.1, bloom: [0.5, 0.6, 0.9], grade: { vig: 0.55, grain: 0.018, sat: 1.1, contrast: 1.1, shadow: [0.88, 0.95, 1.16], high: [1.14, 1.0, 0.82], ca: 0.0013 } });
    const clock = new THREE.Clock(); let tAcc = 0, slowFrames = 0, quality = 2;
    const _tmp = new THREE.Vector3();
    const nearestEnemy = (x, z, maxD) => { let best = null, bd = maxD; for (const en of enemiesRef.current) { const d = Math.hypot(en.x / SCALE - x, en.y / SCALE - z); if (d < bd) { bd = d; best = en; } } return best; };

    if (typeof window !== "undefined" && window.__WR_EXPOSE) window.__wr = { championsRef, enemiesRef, projectilesRef };
    let frameId;
    function renderLoop() {
      const dt = Math.min(0.1, clock.getDelta()); tAcc += dt; const now = Date.now();
      sky.userData.update(tAcc, camera.position);
      motes.userData.update(tAcc, centre);
      altarEmbers.userData.update(tAcc, { x: ALTAR.x, z: ALTAR.z });
      templeEmbers.userData.update(tAcc, { x: TEMPLE.x, z: TEMPLE.z });
      smokeT.userData.update(tAcc, { x: TEMPLE.x, z: TEMPLE.z }); smokeA.userData.update(tAcc, { x: ALTAR.x, z: ALTAR.z });
      for (const f of flames) f.userData.update && f.userData.update(tAcc, f.position.x * 3);
      for (const fl of fireLights) fl.l.intensity = fl.base * (0.8 + 0.2 * Math.sin(tAcc * 15 + fl.ph) * Math.sin(tAcc * 6.3 + fl.ph));
      for (const f of dmgFlames.temple.concat(dmgFlames.altar)) if (f.visible) f.userData.update(tAcc, f.position.x * 5);
      runes.rotation.z = tAcc * 0.12; crystal.rotation.y = tAcc * 0.7; crystal.position.y = aH + aR * 2.5 + Math.sin(tAcc * 1.3) * 0.06;
      crystalGlow.position.y = crystal.position.y; crystalGlow.material.opacity = 0.65 + 0.2 * Math.sin(tAcc * 2.1);
      stormLight.intensity = 6 + Math.sin(tAcc * 1.7) * 1.2 + Math.sin(tAcc * 5.3) * 0.6;
      banners.forEach((b, bi) => { const p = b.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, Math.sin(tAcc * 2 + y * 5 + bi) * 0.02 * (0.5 - y / (tR * 1.0))); } p.needsUpdate = true; });

      // structure damage: fires and smoke grow as hit points fall
      const tHp = Math.max(0, Math.min(1, templeHpRef ? templeHpRef.current / templeMax : 1)), aHp = Math.max(0, Math.min(1, altarHpRef ? altarHpRef.current / altarMax : 1));
      [[dmgFlames.temple, tHp, smokeT], [dmgFlames.altar, aHp, smokeA]].forEach(([arr, hp, smoke]) => { arr.forEach((f, i) => { f.visible = hp < [0.72, 0.5, 0.28][i]; }); smoke.material.uniforms.uOpacity.value = Math.max(0, (0.8 - hp) * 0.9); });
      templeEmbers.material.uniforms.uOpacity.value = 0.5 + (1 - tHp) * 1.2; altarEmbers.material.uniforms.uOpacity.value = 0.6 + (1 - aHp) * 0.6;

      // ambient lightning in the storm over the altar
      if (tAcc > nextStrike) {
        nextStrike = tAcc + 6 + Math.random() * 10;
        const ex = ALTAR.x + (Math.random() - 0.5) * 6, ez = ALTAR.z + (Math.random() - 0.5) * 5 - 1; const bm = spawnBoltMesh(ex, ez, ex + (Math.random() - 0.5), ez, terrainHeight(ex, ez), 0xb8a0ff, true);
        ambientBolts.push({ ...bm, born: tAcc }); flash = Math.max(flash, 0.5); impactLight.position.set(ex, 1.2, ez); impactLight.intensity = 14; impactLight.color.set(0xbca0ff);
      }
      for (let i = ambientBolts.length - 1; i >= 0; i--) { const b = ambientBolts[i]; const a = 1 - (tAcc - b.born) / 0.45; if (a <= 0) { disposeBolt(b); ambientBolts.splice(i, 1); } else { b.glowM.opacity = 0.55 * a; b.coreM.opacity = a; } }

      // lightning bolts cast by the player (Zeus)
      const liveBolts = new Set(lightningBoltsRef ? lightningBoltsRef.current : []);
      for (const b of liveBolts) {
        let m = boltMeshes.get(b);
        if (!m) {
          const end = b.points[b.points.length - 1]; const ex = end.x / SCALE, ez = end.y / SCALE;
          m = spawnBoltMesh(ex + (b.points[0].x - end.x) / SCALE * 0.4, ez - 0.2, ex, ez, terrainHeight(ex, ez) + 0.02, 0xffe27a, true); m.ex = ex; m.ez = ez; boltMeshes.set(b, m);
          flash = 1; shake = 1; impactLight.position.set(ex, 1.0, ez); impactLight.intensity = 30; impactLight.color.set(0xfff0b0);
        }
        const a = Math.max(0, Math.min(1, b.life)); m.glowM.opacity = 0.6 * a; m.coreM.opacity = a;
      }
      for (const [b, m] of boltMeshes) if (!liveBolts.has(b)) { disposeBolt(m); boltMeshes.delete(b); }
      flash *= Math.pow(0.02, dt); shake *= Math.pow(0.02, dt); impactLight.intensity *= Math.pow(0.004, dt);
      flashLight.intensity = flash * 5; hemi.intensity = 1.5 + flash * 1.6; sky.userData.uniforms.uFlash.value = flash * 0.7;
      if (cine.grade) cine.grade.uFlash.value = flash * 0.12;
      const camOv = typeof window !== "undefined" ? window.__CINE_CAM : null;
      if (camOv) { camera.position.set(...camOv.pos); camera.lookAt(...camOv.look); }
      else {
        camera.position.set(CAM_BASE.x + (Math.random() - 0.5) * shake * 0.08, CAM_BASE.y + (Math.random() - 0.5) * shake * 0.06, CAM_BASE.z);
        camera.lookAt(MAP_W / 2, 0.3, MAP_H * 0.52);
      }

      // champions
      const furyOn = furyUntilRef && now < furyUntilRef.current;
      for (const c of championsRef.current) {
        let u = championUnits.get(c.id);
        if (c.hp <= 0) { if (u) u.obj.visible = false; continue; }
        if (!u) { const hero = buildHero(c.id === 0); if (c.id === 0) hero.scale.setScalar(1.15); u = addUnit(championUnits, c.id, hero, 0x3ee66a); u.obj.userData.height = 0.8; }
        u.obj.visible = true;
        const cx = c.x / SCALE, cz = c.y / SCALE; const attacking = now - c.lastAttackAt < 320;
        const tgt = attacking ? nearestEnemy(cx, cz, 1.4) : null; if (tgt) u.face = Math.atan2(tgt.x / SCALE - cx, tgt.y / SCALE - cz);
        u.obj.position.set(cx, terrainHeight(cx, cz), cz); steer(u, cx, cz, dt, 0);
        if (tgt) { let df = u.face - u.obj.rotation.y; df = Math.atan2(Math.sin(df), Math.cos(df)); u.obj.rotation.y += df * 0.5; }
        animateFigure(u.obj, tAcc, u.speed, attacking ? 0.5 + 0.5 * Math.sin((now - c.lastAttackAt) / 320 * Math.PI) : 0, u.phase);
        setBar(u.bar, c.hp / c.maxHp);
        let fg = furyGlows.get(c.id); if (!fg) { fg = makeGlow(0xff5a2a, 1.1, 0.8); fg.position.y = 0.4; u.obj.add(fg); furyGlows.set(c.id, fg); } fg.visible = furyOn; if (furyOn) fg.material.opacity = 0.6 + 0.25 * Math.sin(tAcc * 9);
      }

      // enemies
      const liveE = new Set(); const many = enemiesRef.current.length > 28;
      for (const en of enemiesRef.current) {
        liveE.add(en.id); let u = enemyUnits.get(en.id);
        if (!u) { const m = buildMonster(en.typeId); u = addUnit(enemyUnits, en.id, m, 0xff4a3a); if (many) m.traverse((o) => { o.castShadow = false; }); }
        const ex = en.x / SCALE, ez = en.y / SCALE; const flyer = en.typeId === "harpy";
        u.obj.position.set(ex, terrainHeight(ex, ez) + (flyer ? 0.0 : 0), ez); steer(u, ex, ez, dt, Math.atan2(TEMPLE.x - ex, TEMPLE.z - ez));
        const atk = now - (en.lastAttackAt || 0) < 350 ? 0.5 + 0.5 * Math.sin((now - en.lastAttackAt) / 350 * Math.PI) : 0;
        animateFigure(u.obj, tAcc, u.speed, atk, u.phase);
        const hurt = en.hp < en.maxHp; u.bar.bg.visible = u.bar.fg.visible = hurt || en.typeId === "hydra"; if (hurt) setBar(u.bar, en.hp / en.maxHp, en.typeId === "hydra" ? 0.9 : 0.3);
        u.obj.traverse((o) => { if (o.isMesh && o.material && o.material.emissive !== undefined && o.userData.slowTint === undefined) { } });
      }
      for (const id of enemyUnits.keys()) if (!liveE.has(id)) dropUnit(enemyUnits, id);

      // guardians of the altar
      const liveG = new Set();
      for (const g of guardiansRef ? guardiansRef.current : []) {
        liveG.add(g.id); let u = guardianUnits.get(g.id);
        if (!u) { u = addUnit(guardianUnits, g.id, buildGuardian(), 0xb060ff); u.obj.userData.height = 1.5; }
        const gx = g.x / SCALE, gz = g.y / SCALE; u.obj.position.set(gx, terrainHeight(gx, gz) + 0.04 + Math.sin(tAcc * 1.2 + (g.wobble || 0)) * 0.02, gz);
        u.obj.rotation.y = Math.atan2(TEMPLE.x - gx, TEMPLE.z - gz); setBar(u.bar, g.hp / g.maxHp, 0.5);
      }
      for (const id of guardianUnits.keys()) if (!liveG.has(id)) dropUnit(guardianUnits, id);

      // wards
      const liveW = new Set();
      for (const w of wardsRef.current) {
        liveW.add(w.id); let u = wardUnits.get(w.id); if (!u) u = addUnit(wardUnits, w.id, buildWard(), 0xffd23f);
        const wx = w.x / SCALE, wz = w.y / SCALE; u.obj.position.set(wx, terrainHeight(wx, wz), wz);
        u.obj.userData.gem.rotation.y = tAcc * 2; u.obj.userData.gem.position.y = 0.66 + Math.sin(tAcc * 2.2 + wx) * 0.03; u.obj.userData.ring.rotation.z = tAcc; setBar(u.bar, w.hp / w.maxHp, 0.26);
      }
      for (const id of wardUnits.keys()) if (!liveW.has(id)) dropUnit(wardUnits, id);

      // spell beams and arrows
      let bi = 0;
      for (const p of projectilesRef ? projectilesRef.current : []) {
        const bm = getBeam(bi++); const life = Math.max(0, Math.min(1, p.life));
        _a.set(p.x / SCALE, terrainHeight(p.x / SCALE, p.y / SCALE) + 0.42, p.y / SCALE); _b.set(p.tx / SCALE, terrainHeight(p.tx / SCALE, p.ty / SCALE) + 0.38, p.ty / SCALE);
        const head = _tmp.copy(_a).lerp(_b, 1 - life * 0.8); const tail = _d.copy(_a).lerp(_b, Math.max(0, 1 - life * 0.8 - 0.35));
        const dir = _b.clone().sub(_a); const len = Math.max(0.001, head.distanceTo(tail));
        bm.core.position.copy(tail); bm.core.quaternion.setFromUnitVectors(yAxis, dir.normalize()); bm.core.scale.set(0.014, len, 0.014);
        bm.core.material.color.copy(parseColor(p.color)); bm.core.material.opacity = life; bm.core.visible = true;
        bm.head.position.copy(head); bm.head.material.color.copy(parseColor(p.color)); bm.head.material.opacity = life; bm.head.scale.set(0.28, 0.28, 1); bm.head.visible = true;
      }
      for (let i = bi; i < beamPool.length; i++) { beamPool[i].core.visible = false; beamPool[i].head.visible = false; }

      // game particles (hit sparks, spell bursts, fireflies)
      let pn = 0; const parts = particlesRef ? particlesRef.current : [];
      for (let i = 0; i < parts.length && pn < MAXP; i++) {
        const pt = parts[i]; const col = parseColor(pt.color || "#ffffff"); const life = Math.max(0, pt.life);
        const px = pt.x / SCALE, pz = pt.y / SCALE; pPos[pn * 3] = px; pPos[pn * 3 + 1] = terrainHeight(px, pz) + 0.25 + (1 - life) * 0.4; pPos[pn * 3 + 2] = pz;
        pCol[pn * 4] = col.r; pCol[pn * 4 + 1] = col.g; pCol[pn * 4 + 2] = col.b; pCol[pn * 4 + 3] = (pt.kind === "firefly" ? 0.4 : 0.9) * Math.min(1, life * 1.5); pn++;
      }
      pGeo.setDrawRange(0, pn); pGeo.attributes.position.needsUpdate = true; pGeo.attributes.aCol.needsUpdate = true;

      // Hades' curse zones
      const liveZ = new Set();
      for (const z of hadesCursesRef ? hadesCursesRef.current : []) {
        liveZ.add(z); let m = zones.get(z);
        if (!m) { const mat = zoneMat(0x9a2cff); m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.rotation.x = -Math.PI / 2; scene.add(m); zones.set(z, m); }
        const zx = z.x / SCALE, zz = z.y / SCALE; m.position.set(zx, terrainHeight(zx, zz) + 0.04, zz); const rr = z.radius / SCALE * 2; m.scale.set(rr, rr, 1); m.material.uniforms.uT.value = tAcc;
      }
      for (const [z, m] of zones) if (!liveZ.has(z)) { scene.remove(m); m.geometry.dispose(); m.material.dispose(); zones.delete(z); }

      // Athena's shield
      const shieldOn = shieldUntilRef && now < shieldUntilRef.current; shield.visible = shieldOn; if (shieldOn) { shieldMat.uniforms.uT.value = tAcc * 2; shieldMat.uniforms.uA.value = 0.55 + 0.2 * Math.sin(tAcc * 5); }

      // floating text
      const floatTexts = floatTextRef ? floatTextRef.current : []; const container = floatTextContainerRef.current;
      if (container) {
        while (container.children.length > floatTexts.length) container.removeChild(container.lastChild);
        while (container.children.length < floatTexts.length) { const el = document.createElement("div"); Object.assign(el.style, { position: "absolute", fontFamily: "ui-monospace, monospace", fontSize: "14px", fontWeight: "bold", transform: "translate(-50%, -50%)", whiteSpace: "nowrap", textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.6)" }); container.appendChild(el); }
        const rect = mountRef.current ? mountRef.current.getBoundingClientRect() : { width, height };
        for (let i = 0; i < floatTexts.length; i++) {
          const ft = floatTexts[i], el = container.children[i]; const wx = ft.x / SCALE, wz = ft.y / SCALE;
          _tmp.set(wx, terrainHeight(wx, wz) + 0.7, wz).project(camera); const behind = _tmp.z > 1;
          el.textContent = ft.text; el.style.color = ft.color; el.style.left = `${(_tmp.x * 0.5 + 0.5) * rect.width}px`; el.style.top = `${(-_tmp.y * 0.5 + 0.5) * rect.height}px`; el.style.opacity = behind ? "0" : String(Math.max(0, ft.life));
        }
      }

      if (tAcc - lastEnv > 9) { lastEnv = tAcc; const old = scene.environment; try { scene.environment = skyEnvironment(renderer, sky); } catch {} disposeEnvironment(old); }
      if (!(typeof window !== "undefined" && window.__CINE_PAUSE)) cine.render(dt);
      if (dt > 0.05) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
      if (slowFrames > 90 && quality > 0) {
        quality--; slowFrames = 0;
        if (quality === 1) { renderer.setPixelRatio(1); const w2 = mountRef.current.clientWidth, h2 = mountRef.current.clientHeight; renderer.setSize(w2, h2); cine.setSize(w2, h2); }
        else if (cine.bloom) { cine.bloom.enabled = false; sun.shadow.mapSize.set(1024, 1024); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
      }
      frameId = requestAnimationFrame(renderLoop);
    }
    renderLoop();

    // ResizeObserver, not window.resize: fullscreen and CSS layout can change the box without the window changing.
    function handleResize() {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth, h = mountRef.current.clientHeight;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); cine.setSize(w, h);
    }
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(mountRef.current);
    window.addEventListener("resize", handleResize);

    return () => {
      resizeObserver.disconnect(); window.removeEventListener("resize", handleResize);
      renderer.domElement.removeEventListener("click", handleClick); cancelAnimationFrame(frameId);
      cine.dispose(); disposeEnvironment(scene.environment);
      scene.traverse((obj) => { if (obj.geometry) obj.geometry.dispose(); if (obj.material) { if (Array.isArray(obj.material)) obj.material.forEach((mm) => mm.dispose()); else obj.material.dispose(); } });
      renderer.dispose();
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) mountRef.current.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
      <div ref={floatTextContainerRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} />
    </div>
  );
}
