"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createCinematic } from "@/lib/cinematic/post";
import { makeSurface, cloneSurface } from "@/lib/cinematic/textures";
import { makeSkyDome, skyEnvironment, disposeEnvironment, makeParticles, makeGlow, makeBeamMaterial, glowTexture, makeWaterMaterial } from "@/lib/cinematic/atmos";

// Operation Blacksite — the battlefield, seen from above at an angle. Raw Three.js driven
// from the game's own live state (refs passed in as props); nothing here decides gameplay.
// The old flat 2D drawing is gone from the screen: this reads the same soldiers, bullets,
// smoke, bomb and fog-of-war and draws them as a night-time scene with real shadows,
// a flashlight beam, weather, textured walls and armed soldiers.
//
// World units: the game's map pixels multiplied by S. The camera is fixed (so the mouse
// still maps one-to-one onto the map the game logic uses).
const S = 0.1;
const WALL_H = 3.4;
const UNIT = 2.0;

const THEMES = {
  blacksite_alpha: {
    sky: { zenith: 0x050912, mid: 0x0d1b24, horizon: 0x1e3a36, sunDir: [-0.5, 0.45, -0.7], sunColor: 0x9ab8d8, sunSize: 0.02, glow: 0.7, cloud: 0.7, cloudColor: 0x39475a, cloudShade: 0x080c14, stars: 0.7, wind: 0.004 },
    fog: [0x0b1612, 0.0030], hemi: [0x5878a8, 0x142214, 5.8], moon: [0x86a4d8, 13.5, [-34, 52, -16]], exposure: 1.65, bloom: [0.5, 0.6, 0.85],
    grade: { vig: 0.5, grain: 0.02, sat: 0.95, contrast: 1.1, shadow: [0.86, 1.0, 1.0], high: [1.0, 1.03, 0.95], ca: 0.0014 },
    weather: "rain", lightning: 0.5,
  },
  tempest_harbor: {
    sky: { zenith: 0x05070e, mid: 0x172234, horizon: 0x2f4560, sunDir: [0.3, 0.3, -0.9], sunColor: 0x8aa0c8, sunSize: 0.0, glow: 0.4, cloud: 0.95, cloudColor: 0x3a4a62, cloudShade: 0x070a12, stars: 0, wind: 0.01 },
    fog: [0x0e1824, 0.0038], hemi: [0x5a7aa6, 0x141c24, 5.5], moon: [0x7c96c0, 10, [30, 50, -20]], exposure: 1.45, bloom: [0.55, 0.65, 0.8],
    grade: { vig: 0.52, grain: 0.022, sat: 0.9, contrast: 1.12, shadow: [0.82, 0.96, 1.12], high: [1.0, 1.0, 1.0], ca: 0.0016 },
    weather: "storm", lightning: 1.0,
  },
  ashfall_research: {
    sky: { zenith: 0x120706, mid: 0x3c140e, horizon: 0xff5a1e, sunDir: [0.0, 0.12, -1.0], sunColor: 0xff6a2a, sunSize: 0.03, glow: 1.4, cloud: 0.85, cloudColor: 0xff8a50, cloudShade: 0x2a0e0a, stars: 0, wind: 0.006 },
    fog: [0x2a100a, 0.0032], hemi: [0x7a6a68, 0x6a3a22, 6.2], moon: [0xff9a68, 6.5, [26, 36, -34]], exposure: 1.45, bloom: [0.7, 0.7, 0.75],
    grade: { vig: 0.5, grain: 0.02, sat: 0.78, contrast: 1.1, shadow: [1.0, 0.94, 0.94], high: [1.12, 1.0, 0.85], ca: 0.0014 },
    weather: "ash", lightning: 0,
  },
};

function cvTex(w, h, draw, srgb = true) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function labelTexture(text, color) {
  return cvTex(256, 96, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.font = "bold 54px ui-monospace, Menlo, monospace"; g.textAlign = "center"; g.textBaseline = "middle";
    g.shadowColor = color; g.shadowBlur = 14; g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 2); g.fillText(text, w / 2, h / 2 + 2);
  });
}
function smokeTexture() {
  return cvTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, "rgba(255,255,255,0.95)"); gr.addColorStop(0.5, "rgba(255,255,255,0.5)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    let s = 7; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 40; i++) { const x = 20 + r() * 88, y = 20 + r() * 88, rad = 8 + r() * 18; const gg = g.createRadialGradient(x, y, 0, x, y, rad); gg.addColorStop(0, "rgba(255,255,255,0.18)"); gg.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  });
}
// A box whose texture coordinates follow real size, so ribs and bricks never stretch.
function boxGeo(w, h, d, tile = 3) {
  const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / tile, uv.getY(k) * dims[f][1] / tile); }
  return g;
}

function buildSoldier(vestHex, accentHex) {
  const g = new THREE.Group(); const u = { g };
  const std = (c, r = 0.75, m = 0.05, e) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...(e || {}) });
  const fat = std(0x4a5444, 0.92, 0), vest = std(vestHex, 0.7, 0.08), plate = std(0x1b1d20, 0.45, 0.45), skin = std(0xc39776, 0.7, 0);
  const visor = std(0x000000, 0.2, 0.2, { emissive: new THREE.Color(accentHex), emissiveIntensity: 2.4 });
  u.vest = vest; u.visor = visor;
  const add = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const legGeo = new THREE.BoxGeometry(0.3, 0.82, 0.3);
  u.legL = new THREE.Group(); u.legL.position.set(0, 0.84, -0.2); add(legGeo, fat, 0, -0.41, 0, u.legL); add(new THREE.BoxGeometry(0.42, 0.14, 0.34), plate, 0.06, -0.8, 0, u.legL); g.add(u.legL);
  u.legR = new THREE.Group(); u.legR.position.set(0, 0.84, 0.2); add(legGeo, fat, 0, -0.41, 0, u.legR); add(new THREE.BoxGeometry(0.42, 0.14, 0.34), plate, 0.06, -0.8, 0, u.legR); g.add(u.legR);
  u.upper = new THREE.Group(); u.upper.position.set(0, 0.84, 0); g.add(u.upper);
  add(new THREE.BoxGeometry(0.46, 0.8, 0.72), vest, 0, 0.42, 0, u.upper);
  add(new THREE.BoxGeometry(0.1, 0.46, 0.52), plate, 0.26, 0.48, 0, u.upper);
  add(new THREE.BoxGeometry(0.16, 0.5, 0.5), plate, -0.3, 0.46, 0, u.upper);
  add(new THREE.BoxGeometry(0.5, 0.1, 0.74), plate, 0, 0.0, 0, u.upper);
  add(new THREE.BoxGeometry(0.32, 0.2, 0.18), plate, 0.0, 0.06, 0.3, u.upper);
  add(new THREE.SphereGeometry(0.18, 10, 8), vest, 0, 0.82, 0.46, u.upper); add(new THREE.SphereGeometry(0.18, 10, 8), vest, 0, 0.82, -0.46, u.upper);
  add(new THREE.CylinderGeometry(0.09, 0.11, 0.14, 8), skin, 0, 0.88, 0, u.upper);
  const head = new THREE.Group(); head.position.set(0, 1.12, 0); u.upper.add(head); u.head = head;
  add(new THREE.SphereGeometry(0.23, 14, 10), skin, 0, 0, 0, head);
  add(new THREE.SphereGeometry(0.275, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), vest, 0, 0.03, 0, head);
  add(new THREE.BoxGeometry(0.1, 0.1, 0.36), visor, 0.2, 0.0, 0, head);
  add(new THREE.BoxGeometry(0.2, 0.05, 0.4), plate, 0.14, 0.1, 0, head);
  // arms and rifle
  const gun = new THREE.Group(); gun.position.set(0.5, 0.48, 0.1); u.upper.add(gun); u.gun = gun;
  add(new THREE.BoxGeometry(1.0, 0.15, 0.13), plate, 0, 0, 0, gun); add(new THREE.CylinderGeometry(0.035, 0.035, 0.55, 8), plate, 0.75, 0.02, 0, gun).rotation.z = Math.PI / 2;
  add(new THREE.BoxGeometry(0.14, 0.3, 0.1), plate, 0.08, -0.2, 0, gun); add(new THREE.BoxGeometry(0.42, 0.14, 0.12), fat, -0.6, -0.03, 0, gun);
  add(new THREE.BoxGeometry(0.22, 0.09, 0.08), std(0x000000, 0.3, 0.2, { emissive: new THREE.Color(accentHex), emissiveIntensity: 1.2 }), 0.15, 0.13, 0, gun);
  const armA = add(new THREE.BoxGeometry(0.62, 0.17, 0.17), vest, 0.28, 0.5, 0.36, u.upper); armA.rotation.z = -0.5; armA.rotation.y = -0.45;
  const armB = add(new THREE.BoxGeometry(0.85, 0.17, 0.17), vest, 0.42, 0.5, -0.1, u.upper); armB.rotation.y = 0.5; armB.rotation.z = -0.3;
  g.scale.setScalar(UNIT);
  // ground ring for readability from above
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.18, 40), new THREE.MeshBasicMaterial({ color: accentHex, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; ring.scale.setScalar(1 / UNIT); g.add(ring); u.ring = ring;
  return u;
}

export default function OperationBlacksite3D({
  mapRef, mapW, mapH, playerRef, botsRef, teammatesRef, tracersRef, flashesRef, shellsRef, bloodRef, smokesRef, particlesRef, bombRef,
  lightningRef, damageFlashRef, shakeRef, sideRef, mouseRef, sideColors, computeFov, rayWall, fovMax, plantMs, defuseMs, bombSeconds, floatTextRef,
}) {
  const mountRef = useRef(null);
  const floatTextContainerRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) return undefined;
    const mount = mountRef.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" }); } catch { return undefined; }
    let width = mount.clientWidth || 1000, height = mount.clientHeight || 680;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const map = mapRef.current; const TH = THEMES[map.id] || THEMES.blacksite_alpha;
    const W = mapW * S, D = mapH * S; const CX = W / 2, CZ = D / 2;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(TH.fog[0], TH.fog[1]);
    const disposables = [];
    const track = (o) => { disposables.push(o); return o; };

    // ---- sky and light ----------------------------------------------------------------
    const sky = makeSkyDome(TH.sky); scene.add(sky);
    let envTex = null; try { envTex = skyEnvironment(renderer, sky); scene.environment = envTex; scene.environmentIntensity = 0.55; } catch { envTex = null; }
    const hemi = new THREE.HemisphereLight(TH.hemi[0], TH.hemi[1], TH.hemi[2]); scene.add(hemi);
    const moon = new THREE.DirectionalLight(TH.moon[0], TH.moon[1]);
    moon.position.set(CX + TH.moon[2][0], TH.moon[2][1], CZ + TH.moon[2][2]); moon.target.position.set(CX, 0, CZ); scene.add(moon, moon.target);
    moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.05;
    Object.assign(moon.shadow.camera, { left: -62, right: 62, top: 48, bottom: -48, near: 5, far: 160 }); moon.shadow.camera.updateProjectionMatrix();

    // flashlight and a little personal light
    const flash = new THREE.SpotLight(0xfff0d2, 4800, 90, 0.64, 0.55, 2);
    flash.castShadow = true; flash.shadow.mapSize.set(1024, 1024); flash.shadow.bias = -0.0006; flash.shadow.camera.near = 2; flash.shadow.camera.far = 80;
    scene.add(flash, flash.target);
    const personal = new THREE.PointLight(0x3ee6e0, 70, 14, 2); scene.add(personal);

    // ---- floor and the world around the map ---------------------------------------------
    const isHarbor = map.id === "tempest_harbor", isAsh = map.id === "ashfall_research";
    let floorSurf, floorRep, wallMatBase, outerColor;
    if (isHarbor) { floorSurf = makeSurface("concrete", { seed: 12, colors: ["#2c3640", "#5a6a78"], size: 256 }); floorRep = [16, 11]; }
    else if (isAsh) { floorSurf = makeSurface("lava", { seed: 31, colors: ["#54463e", "#87766a"], size: 256, cells: 5 }); floorRep = [3.5, 2.6]; }
    else { floorSurf = makeSurface("grass", { seed: 5, colors: ["#33502a", "#4d6e3a", "#688a4a"], size: 256 }); floorRep = [14, 10]; }
    const floorT = cloneSurface(floorSurf, floorRep[0], floorRep[1]);
    const floorMat = new THREE.MeshStandardMaterial({ map: floorT.map, normalMap: floorT.normalMap, roughnessMap: floorT.roughnessMap, roughness: isHarbor ? 0.55 : 1.0, metalness: isHarbor ? 0.15 : 0, normalScale: isHarbor ? new THREE.Vector2(0.4, 0.4) : new THREE.Vector2(1.1, 1.1) });
    if (isAsh) { floorMat.emissive = new THREE.Color(0xff6a20); floorMat.emissiveMap = floorT.map; floorMat.emissiveIntensity = 0.2; }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat); floor.rotation.x = -Math.PI / 2; floor.position.set(CX, 0, CZ); floor.receiveShadow = true; scene.add(floor);
    const outerT = cloneSurface(floorSurf, 60, 60);
    const outerMat = new THREE.MeshStandardMaterial({ map: outerT.map, normalMap: outerT.normalMap, roughness: 1, color: isHarbor ? 0x2a3038 : 0x9a9a9a });
    if (isAsh) { outerMat.emissive = new THREE.Color(0xff5a18); outerMat.emissiveMap = outerT.map; outerMat.emissiveIntensity = 0.6; }
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), outerMat); outer.rotation.x = -Math.PI / 2; outer.position.set(CX, -0.04, CZ); outer.receiveShadow = true;
    let waterMat = null;
    if (isHarbor) {
      // beyond the quay: black harbour water that catches the lightning
      const wn = makeSurface("waternormal", { seed: 4, colors: ["#0c2a3c", "#1c4a60"], size: 256 });
      waterMat = makeWaterMaterial(wn.normalMap, { color: 0x081c2a, repeat: 60, bump: 0.5, env: 0.5, roughness: 0.45, opacity: 1 });
      const water = new THREE.Mesh(new THREE.PlaneGeometry(520, 520), waterMat); water.rotation.x = -Math.PI / 2; water.position.set(CX, -0.9, CZ); scene.add(water);
      const quay = new THREE.Mesh(new THREE.BoxGeometry(W + 10, 1, D + 10), new THREE.MeshStandardMaterial({ color: 0x1c242c, roughness: 0.95, metalness: 0 })); quay.position.set(CX, -0.55, CZ); quay.receiveShadow = true; scene.add(quay);
    } else scene.add(outer);

    // ---- walls ------------------------------------------------------------------------------
    const wallGroup = new THREE.Group(); scene.add(wallGroup);
    let stoneS, metalS, contS;
    if (isHarbor) contS = makeSurface("corrugated", { seed: 7, colors: ["#d8d8d8", "#8a8e92"], size: 256, ribs: 4 });
    else if (isAsh) metalS = makeSurface("metal", { seed: 22, colors: ["#4a4c58", "#7c7e8a"], size: 256, cols: 4 });
    else stoneS = makeSurface("stone", { seed: 14, colors: ["#383c34", "#6c6e60"], size: 256 });
    const wallMats = {};
    const matFor = (key, surf, color, rough, metal, emissive) => {
      const k = key + color; if (wallMats[k]) return wallMats[k];
      const m = new THREE.MeshStandardMaterial({ map: surf.map, normalMap: surf.normalMap, roughnessMap: surf.roughnessMap, normalScale: new THREE.Vector2(0.7, 0.7), color, roughness: rough, metalness: metal, ...(emissive || {}) });
      wallMats[k] = m; return m;
    };
    const containerColors = [0x9a3b2a, 0x2c5a7c, 0x3c6e4c, 0xc2762a, 0x7a7e84, 0x7c2e32, 0x2a4a66];
    const lampPositions = [];
    let ci = 0; const rngc = () => containerColors[(ci++ * 5 + 3) % containerColors.length];
    const dishTargets = [];
    map.walls.forEach((w, wi) => {
      const border = (w.w >= mapW - 1 || w.h >= mapH - 1);
      const wx = (w.x + w.w / 2) * S, wz = (w.y + w.h / 2) * S, ww = w.w * S, wd = w.h * S;
      const hgt = border ? WALL_H * 1.35 : WALL_H;
      if (isHarbor && !border) {
        // rows of shipping containers, each its own colour, some stacked
        const along = ww > wd; const len = along ? ww : wd; const n = Math.max(1, Math.round(len / 6.2)); const seg = len / n;
        for (let i = 0; i < n; i++) {
          const cw = along ? seg - 0.12 : ww, cd = along ? wd : seg - 0.12; const cx = along ? wx - len / 2 + seg * (i + 0.5) : wx, cz = along ? wz : wz - len / 2 + seg * (i + 0.5);
          const col = rngc(); const mat = matFor("cont", contS, col, 0.75, 0.4);
          const m = new THREE.Mesh(boxGeo(cw, hgt, cd, 4), mat); m.position.set(cx, hgt / 2, cz); m.castShadow = true; m.receiveShadow = true; wallGroup.add(m);
          // door frame lines + roof ridge
          const door = new THREE.Mesh(new THREE.BoxGeometry(along ? 0.08 : cw + 0.06, hgt * 0.92, along ? cd + 0.06 : 0.08), new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.8 }));
          door.position.set(cx + (along ? cw / 2 : 0), hgt / 2, cz + (along ? 0 : cd / 2)); wallGroup.add(door);
          if ((i + wi) % 3 === 1 && Math.min(cw, cd) > 2) { const top = new THREE.Mesh(boxGeo(cw * 0.98, 2.2, cd * 0.98, 4), matFor("cont", contS, rngc(), 0.75, 0.4)); top.position.set(cx, hgt + 1.1, cz); top.rotation.y = (i % 2 ? 0.03 : -0.02); top.castShadow = true; wallGroup.add(top); }
        }
        return;
      }
      const mat = isAsh ? matFor("metal", metalS, border ? 0x9a9aa6 : 0xe0e0ea, 0.65, 0.05) : isHarbor ? (wallMats.quay || (wallMats.quay = new THREE.MeshStandardMaterial({ color: 0x3a424c, roughness: 0.95, metalness: 0 }))) : matFor("stone", stoneS, border ? 0xb0baa8 : 0xffffff, 0.95, 0);
      const m = new THREE.Mesh(boxGeo(ww, hgt, wd, 4), mat); m.position.set(wx, hgt / 2, wz); m.castShadow = true; m.receiveShadow = true; wallGroup.add(m);
      if (isAsh && !border) { // glowing hazard strip along the top of the reactor plating
        const strip = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.06, 0.14, wd + 0.06), new THREE.MeshStandardMaterial({ color: 0x220a02, emissive: 0xff5a14, emissiveIntensity: 2.2 }));
        strip.position.set(wx, hgt - 0.5, wz); wallGroup.add(strip);
        const cap = new THREE.Mesh(new THREE.BoxGeometry(ww + 0.3, 0.3, wd + 0.3), matFor("metal", metalS, 0xa0a0ae, 0.5, 0.1)); cap.position.set(wx, hgt + 0.15, wz); cap.castShadow = true; wallGroup.add(cap);
      }
      if (!isAsh && !isHarbor && !border) { // overgrown ruins: broken tops, hanging vines
        for (let k = 0; k < 3; k++) { const bw = Math.min(ww, 1.8 + k), bd = Math.min(wd, 1.6 + k * 0.4); const bx = wx + (Math.random() - 0.5) * Math.max(0, ww - bw), bz = wz + (Math.random() - 0.5) * Math.max(0, wd - bd); const hh = 0.5 + Math.random() * 1.1; const b = new THREE.Mesh(boxGeo(bw, hh, bd, 4), mat); b.position.set(bx, hgt + hh / 2 - 0.05, bz); b.rotation.y = (Math.random() - 0.5) * 0.4; b.castShadow = true; wallGroup.add(b); }
        const vineMat = new THREE.MeshStandardMaterial({ color: 0x1f3a1a, roughness: 1 });
        const nV = Math.floor((ww + wd) / 3); for (let k = 0; k < nV; k++) { const onX = Math.random() < ww / (ww + wd); const vh = 1 + Math.random() * 2.4; const v = new THREE.Mesh(new THREE.BoxGeometry(0.14, vh, 0.14), vineMat); v.position.set(onX ? wx + (Math.random() - 0.5) * ww : wx + (Math.random() < 0.5 ? -1 : 1) * (ww / 2 + 0.06), hgt - vh / 2, onX ? wz + (Math.random() < 0.5 ? -1 : 1) * (wd / 2 + 0.06) : wz + (Math.random() - 0.5) * wd); wallGroup.add(v); }
      }
      if (!border && Math.abs(w.w - 86) < 1 && Math.abs(w.h - 86) < 1) dishTargets.push({ x: wx, z: wz, top: hgt });
    });

    // satellite dish crashed on the centre block (Blacksite Alpha)
    const dishLight = [];
    for (const d of dishTargets) if (!isHarbor && !isAsh) {
      const g = new THREE.Group(); g.position.set(d.x, d.top, d.z); g.rotation.z = 0.35; g.rotation.y = 0.7;
      const dish = new THREE.Mesh(new THREE.SphereGeometry(3.6, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.34), new THREE.MeshStandardMaterial({ color: 0xaab0b0, metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide }));
      dish.rotation.x = -0.9; dish.position.y = 2.6; dish.castShadow = true; g.add(dish);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0x444a4a, metalness: 0.6, roughness: 0.5 })); mast.position.y = 1.6; g.add(mast);
      const led = makeGlow(0xff3030, 1.2, 1); led.position.set(0, 4.3, 0); g.add(led); dishLight.push(led);
      scene.add(g);
    }

    // ---- scenery outside the arena -------------------------------------------------------------
    if (!isHarbor && !isAsh) {
      const N = 190; const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.35, 0.6, 7, 6), new THREE.MeshStandardMaterial({ color: 0x2a1f14, roughness: 1 }), N);
      const leaf = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), N * 3);
      const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), col = new THREE.Color();
      let li = 0;
      for (let i = 0; i < N; i++) {
        let x, z; let tries = 0;
        do { x = CX + (Math.random() - 0.5) * 230; z = CZ + (Math.random() - 0.5) * 170; tries++; } while (x > -4 && x < W + 4 && z > -4 && z < D + 4 && tries < 20);
        if (x > -4 && x < W + 4 && z > -4 && z < D + 4) { x = x < CX ? -6 - Math.random() * 20 : W + 6 + Math.random() * 20; }
        const s = 0.8 + Math.random() * 1.1; pos.set(x, 3.5 * s, z); sc.set(s, s, s); q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6); mtx.compose(pos, q, sc); trunk.setMatrixAt(i, mtx);
        for (let k = 0; k < 3; k++) { const r = (2.8 - k * 0.55) * s * (0.8 + Math.random() * 0.4); pos.set(x + (Math.random() - 0.5) * 1.2, (6.2 + k * 1.6) * s, z + (Math.random() - 0.5) * 1.2); sc.set(r, r * 0.8, r); mtx.compose(pos, q, sc); leaf.setMatrixAt(li, mtx); col.setHSL(0.27 + Math.random() * 0.06, 0.4, 0.045 + Math.random() * 0.04); leaf.setColorAt(li, col); li++; }
      }
      trunk.castShadow = true; leaf.castShadow = true; scene.add(trunk, leaf); disposables.push(trunk.geometry, leaf.geometry);
      // ferns and rocks hugging the border inside the arena
      const rockGeo = new THREE.DodecahedronGeometry(1, 0), rockMat = new THREE.MeshStandardMaterial({ color: 0x4a4c44, roughness: 0.95, flatShading: true }); const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 40);
      for (let i = 0; i < 40; i++) { const edge = Math.random() < 0.5; const x = edge ? 2 + Math.random() * (W - 4) : (Math.random() < 0.5 ? 2.4 : W - 2.4); const z = edge ? (Math.random() < 0.5 ? 2.4 : D - 2.4) : 2 + Math.random() * (D - 4); const s = 0.3 + Math.random() * 0.7; pos.set(x, s * 0.4, z); sc.set(s * 1.3, s * 0.8, s); q.setFromEuler(new THREE.Euler(0, Math.random() * 6, 0)); mtx.compose(pos, q, sc); rocks.setMatrixAt(i, mtx); }
      rocks.castShadow = true; rocks.receiveShadow = true; scene.add(rocks);
    }
    if (isHarbor) {
      // cranes in the storm, light poles, bollards
      const craneMat = new THREE.MeshStandardMaterial({ color: 0x2a3036, metalness: 0.6, roughness: 0.55 });
      [[-18, -16], [W + 18, D + 16], [W * 0.7, -22]].forEach(([x, z], i) => {
        const gr = new THREE.Group(); gr.position.set(x, 0, z);
        for (const dx of [-3, 3]) for (const dz of [-2, 2]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 20, 0.5), craneMat); leg.position.set(dx, 10, dz); gr.add(leg); }
        const beam = new THREE.Mesh(new THREE.BoxGeometry(9, 1.4, 5), craneMat); beam.position.set(0, 20, 0); gr.add(beam);
        const boom = new THREE.Mesh(new THREE.BoxGeometry(30, 0.9, 1.4), craneMat); boom.position.set(i % 2 ? -13 : 13, 21.2, 0); gr.add(boom);
        if (x < W) { const lamp = makeGlow(0xff3a2a, 2.2, 1); lamp.position.set(i % 2 ? -27 : 27, 21.6, 0); gr.add(lamp); }
        scene.add(gr);
      });
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x20262c, metalness: 0.5, roughness: 0.6 });
      [[-9, 10], [-9, 58], [W + 9, 14], [W + 9, 56], [CX, -9], [CX - 8, D + 9]].forEach(([x, z]) => {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 11, 6), poleMat); p.position.set(x, 5.5, z); p.castShadow = true; scene.add(p);
        const head = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 0.8), poleMat); head.position.set(x, 11.2, z); scene.add(head);
        if (x < W) { const gl = makeGlow(0xcfe6ff, 1.6, 0.45); gl.position.set(x, 11, z); scene.add(gl); }
        
      });
    }
    if (isAsh) {
      // lava glow pools beyond the walls and a few jagged basalt columns
      const lavaT = cloneSurface(makeSurface("lava", { seed: 44, colors: ["#2a0e08", "#802010"], size: 256 }), 14, 14);
      for (const side of [-1, 1]) {
        const lv = new THREE.Mesh(new THREE.PlaneGeometry(W + 80, 18), new THREE.MeshStandardMaterial({ map: lavaT.map, emissive: 0xff5a18, emissiveMap: lavaT.map, emissiveIntensity: 1.4, roughness: 0.6, color: 0xffffff }));
        lv.rotation.x = -Math.PI / 2; lv.position.set(CX, -0.2, side < 0 ? -10 : D + 10); scene.add(lv);
        const ll = new THREE.PointLight(0xff5a20, 700, 70, 2); ll.position.set(CX, 3, side < 0 ? -6 : D + 6); scene.add(ll); lampPositions.push({ light: ll, base: 700, ph: side });
      }
      const colMat = new THREE.MeshStandardMaterial({ color: 0x1e1412, roughness: 0.9, flatShading: true });
      for (let i = 0; i < 26; i++) { const h = 6 + Math.random() * 14; const c = new THREE.Mesh(new THREE.CylinderGeometry(0.5 + Math.random() * 0.8, 1.6 + Math.random(), h, 6), colMat); const x = CX + (Math.random() - 0.5) * 190, z = CZ + (Math.random() - 0.5) * 140; if (x > -8 && x < W + 8 && z > -8 && z < D + 8) continue; c.position.set(x, h / 2 - 0.5, z); c.castShadow = true; scene.add(c); }
    }

    // ---- bomb sites and lamps ---------------------------------------------------------------
    const sites = [map.siteA, map.siteB].map((site, i) => {
      const r = site.r * S; const label = i === 0 ? "A" : "B";
      const tex = cvTex(512, 512, (g, w, h) => {
        g.translate(w / 2, h / 2); g.strokeStyle = "rgba(255,183,3,0.95)"; g.lineWidth = 10; g.beginPath(); g.arc(0, 0, 236, 0, Math.PI * 2); g.stroke();
        g.lineWidth = 5; g.setLineDash([26, 18]); g.beginPath(); g.arc(0, 0, 206, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
        g.fillStyle = "rgba(255,183,3,0.10)"; g.beginPath(); g.arc(0, 0, 232, 0, Math.PI * 2); g.fill();
        g.font = "bold 240px ui-monospace, Menlo, monospace"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "rgba(255,183,3,0.28)"; g.fillText(label, 0, 12);
      });
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(r * 2.1, r * 2.1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      pad.rotation.x = -Math.PI / 2; pad.position.set(site.x * S, 0.045, site.y * S); scene.add(pad);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.12, r * 0.14, 14, 16, 1, true), makeBeamMaterial(0xffb703, 0.75)); beam.position.set(site.x * S, 7, site.y * S); scene.add(beam);
      const lbl = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture("SITE " + label, "#ffb703"), transparent: true, depthWrite: false, fog: false, toneMapped: false })); lbl.scale.set(6.6, 2.5, 1); lbl.position.set(site.x * S, 5.6, site.y * S - r * 0.35); scene.add(lbl);
      const pl = new THREE.PointLight(0xffb040, 90, 22, 2); pl.position.set(site.x * S, 4, site.y * S); scene.add(pl); lampPositions.push({ light: pl, base: 90, ph: i * 2 });
      return { pad, beam, lbl };
    });
    if (!isHarbor && !isAsh) { // jungle lamps along the research core
      [[CX, 3.5, 3.4], [CX - 22, 3, D - 3.4], [CX + 26, 3, D - 3.4]].forEach(([x, y, z], i) => { const g = makeGlow(0xd8f0a0, 2.4, 0.9); g.position.set(x, y + 0.6, z); scene.add(g); const pl = new THREE.PointLight(0xc8f090, 70, 22, 2); pl.position.set(x, y, z); scene.add(pl); lampPositions.push({ light: pl, base: 70, ph: i }); });
    }

    // ---- fog of war: the darkness the game's own sight-line polygon cuts open ------------------
    const MW = 400, MH = Math.round(400 * mapH / mapW);
    const maskCanvas = document.createElement("canvas"); maskCanvas.width = MW; maskCanvas.height = MH; const mg = maskCanvas.getContext("2d");
    const maskTex = new THREE.CanvasTexture(maskCanvas); maskTex.colorSpace = THREE.SRGBColorSpace;
    const maskMesh = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshBasicMaterial({ map: maskTex, transparent: true, depthWrite: false, fog: false, toneMapped: false }));
    maskMesh.rotation.x = -Math.PI / 2; maskMesh.position.set(CX, 0.07, CZ); maskMesh.renderOrder = 5; scene.add(maskMesh);
    const mk = MW / mapW;
    function drawMask(p) {
      mg.globalCompositeOperation = "source-over"; mg.clearRect(0, 0, MW, MH); mg.fillStyle = "rgba(3,5,10,0.6)"; mg.fillRect(0, 0, MW, MH);
      if (!p.alive) return;
      mg.globalCompositeOperation = "destination-out";
      const pts = computeFov(p.x, p.y, p.aim, map.walls);
      mg.save(); mg.beginPath(); mg.moveTo(p.x * mk, p.y * mk); for (const q of pts) mg.lineTo(q.x * mk, q.y * mk); mg.closePath(); mg.clip();
      const gr = mg.createRadialGradient(p.x * mk, p.y * mk, 0, p.x * mk, p.y * mk, fovMax * mk); gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.7, "rgba(0,0,0,0.95)"); gr.addColorStop(1, "rgba(0,0,0,0.8)");
      mg.fillStyle = gr; mg.fillRect(0, 0, MW, MH); mg.restore();
      const g2 = mg.createRadialGradient(p.x * mk, p.y * mk, 0, p.x * mk, p.y * mk, 90 * mk); g2.addColorStop(0, "rgba(0,0,0,0.9)"); g2.addColorStop(1, "rgba(0,0,0,0)"); mg.fillStyle = g2; mg.fillRect(0, 0, MW, MH);
    }

    // ---- weather --------------------------------------------------------------------------------
    function makeRain(count, slant, speed, len, color, alpha) {
      const g = new THREE.BufferGeometry(); const pos = new Float32Array(count * 6), seed = new Float32Array(count * 6), end = new Float32Array(count * 2);
      for (let i = 0; i < count; i++) { const a = Math.random(), b = Math.random(), c = Math.random(); for (let k = 0; k < 2; k++) { seed.set([a, b, c], (i * 2 + k) * 3); end[i * 2 + k] = k; } }
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setAttribute("aSeed", new THREE.BufferAttribute(seed.subarray(0, count * 6), 3)); g.setAttribute("aEnd", new THREE.BufferAttribute(end, 1));
      const m = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
        uniforms: { uTime: { value: 0 }, uBox: { value: new THREE.Vector4(-30, -25, W + 60, D + 50) }, uH: { value: 34 }, uSpeed: { value: speed }, uSlant: { value: new THREE.Vector2(...slant) }, uLen: { value: len }, uColor: { value: new THREE.Color(color) }, uAlpha: { value: alpha } },
        vertexShader: `attribute vec3 aSeed; attribute float aEnd; uniform float uTime, uH, uSpeed, uLen; uniform vec4 uBox; uniform vec2 uSlant; varying float vA;
          void main(){ float y = mod(aSeed.y * uH - uTime * uSpeed * (0.85 + aSeed.z * 0.3), uH); vec3 p = vec3(uBox.x + aSeed.x * uBox.z, y, uBox.y + fract(aSeed.z * 7.13 + aSeed.x * 3.7) * uBox.w);
            p += vec3(uSlant.x, 0.0, uSlant.y) * y * 0.12; p += aEnd * vec3(uSlant.x, -1.0 * -1.0, uSlant.y) * uLen * vec3(0.12, 1.0, 0.12);
            vA = (1.0 - aEnd * 0.8) * smoothstep(0.0, 2.0, y); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
        fragmentShader: "uniform vec3 uColor; uniform float uAlpha; varying float vA; void main(){ gl_FragColor = vec4(uColor * vA * uAlpha, vA * uAlpha); }",
      });
      const l = new THREE.LineSegments(g, m); l.frustumCulled = false; return l;
    }
    let rain = null, ash = null, embers = null, mist = null;
    if (TH.weather === "rain") rain = makeRain(3200, [-0.6, 0.2], 26, 1.5, 0x9fc0e0, 0.4);
    if (TH.weather === "storm") rain = makeRain(6500, [-1.6, 0.4], 34, 2.0, 0xbcd8f0, 0.45);
    if (rain) scene.add(rain);
    if (TH.weather === "ash") {
      ash = makeParticles({ count: 1100, area: 120, height: 22, rise: -0.28, drift: 1.4, size: 22, color: 0xff9a60, color2: 0xffd8a0, flicker: 1, baseY: 0, wind: [0.9, 0.3] });
      embers = makeParticles({ count: 500, area: 110, height: 14, rise: 0.9, drift: 1.0, size: 26, color: 0xff5a14, color2: 0xffc060, flicker: 1, baseY: 0 });
      scene.add(ash, embers);
    } else {
      mist = makeParticles({ count: 220, area: 120, height: 3.6, rise: 0.04, drift: 2.0, size: 120, color: isHarbor ? 0x5a7088 : 0x587060, color2: isHarbor ? 0x7a90a8 : 0x748a78, flicker: 0, additive: false, opacity: 0.1, baseY: 0.2, wind: [1.2, 0.2] });
      scene.add(mist);
    }

    // ---- units, effects ---------------------------------------------------------------------------
    const mkSide = (s) => ({ body: new THREE.Color(sideColors[s].body), accent: new THREE.Color(sideColors[s].accent) });
    const unitPool = { bots: [], mates: [], player: null };
    const barBg = new THREE.SpriteMaterial({ color: 0x000000, transparent: true, depthTest: false, opacity: 0.8 });
    function makeBar(color) {
      const bg = new THREE.Sprite(barBg); bg.scale.set(2.5, 0.28, 1); bg.center.set(0.5, 0.5); bg.renderOrder = 20;
      const fg = new THREE.Sprite(new THREE.SpriteMaterial({ color, transparent: true, depthTest: false, toneMapped: false })); fg.center.set(0, 0.5); fg.scale.set(2.4, 0.2, 1); fg.position.x = -1.2; fg.renderOrder = 21;
      const grp = new THREE.Group(); grp.add(bg, fg); grp.userData.fg = fg; return grp;
    }
    const labelCache = new Map();
    function nameSprite(name) {
      if (labelCache.has(name)) return labelCache.get(name).clone();
      const tex = cvTex(256, 64, (g, w, h) => { g.font = "bold 34px ui-monospace, Menlo, monospace"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = "rgba(255,255,255,0.88)"; g.shadowColor = "#000"; g.shadowBlur = 6; g.fillText(name, w / 2, h / 2); });
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false })); sp.scale.set(3.4, 0.85, 1); sp.renderOrder = 22; labelCache.set(name, sp); return sp.clone();
    }
    function makeUnit(kind, idx) {
      const side = kind === "bots" ? (sideRef.current === "terrorist" ? "police" : "terrorist") : sideRef.current; const c = mkSide(side);
      const u = buildSoldier(c.body.getHex(), c.accent.getHex()); u.side = side; u.kind = kind; u.idx = idx; u.lx = 0; u.lz = 0; u.speed = 0; u.fall = 0; u.phase = Math.random() * 6; u.ready = false;
      u.bar = makeBar(kind === "bots" ? 0xff3ea5 : c.accent.getHex()); u.bar.visible = kind !== "player"; scene.add(u.g); scene.add(u.bar);
      u.prog = null; u.progKey = ""; u.name = ""; u.label = null;
      if (kind === "player") { u.ring.material.color.set(0x3ee6e0); u.ring.material.opacity = 0.85; u.ring.scale.setScalar(1.25 / UNIT); }
      return u;
    }
    function recolor(u, side) {
      const c = mkSide(side); u.side = side; u.vest.color.copy(c.body); u.visor.emissive.copy(c.accent);
      if (u.kind !== "player") u.ring.material.color.copy(c.accent);
      u.bar.userData.fg.material.color.set(u.kind === "bots" ? 0xff3ea5 : c.accent.getHex());
    }
    const tmpV = new THREE.Vector3();
    function updateUnit(u, st, dt, t, maxHp, isMate) {
      if (!st) { u.g.visible = false; u.bar.visible = false; if (u.prog) u.prog.visible = false; return; }
      u.g.visible = true;
      const want = u.kind === "bots" ? (sideRef.current === "terrorist" ? "police" : "terrorist") : sideRef.current; if (want !== u.side) recolor(u, want);
      const x = st.x * S, z = st.y * S;
      if (!u.ready) { u.lx = x; u.lz = z; u.ready = true; }
      const sp = Math.hypot(x - u.lx, z - u.lz) / Math.max(dt, 0.001); u.speed += (Math.min(sp, 14) - u.speed) * Math.min(1, dt * 10); u.lx = x; u.lz = z;
      const alive = st.alive !== false && (st.hp === undefined || st.hp > 0);
      u.fall += ((alive ? 0 : 1) - u.fall) * Math.min(1, dt * 7);
      u.g.position.set(x, 0.0 + u.fall * 0.34, z);
      u.g.rotation.y = -(st.aim || 0); u.g.rotation.z = u.fall * Math.PI / 2 * 0.96; u.g.rotation.x = 0;
      const sw = Math.sin(t * 11 + u.phase) * 0.8 * Math.min(1, u.speed / 6) * (1 - u.fall);
      u.legL.rotation.z = sw; u.legR.rotation.z = -sw; u.upper.position.y = 0.84 + Math.abs(Math.sin(t * 11 + u.phase)) * 0.05 * Math.min(1, u.speed / 6); u.upper.rotation.x = 0;
      u.ring.visible = alive; u.ring.material.opacity = (u.kind === "player" ? 0.55 + 0.25 * Math.sin(t * 4) : 0.4);
      u.visor.emissiveIntensity = alive ? 2.4 : 0.0;
      if (u.kind !== "player") {
        u.bar.visible = alive; u.bar.position.set(x, 4.5, z); u.bar.quaternion.copy(camera.quaternion);
        const f = Math.max(0, Math.min(1, st.hp / maxHp)); u.bar.userData.fg.scale.x = 2.4 * f;
        if (isMate && st.name) { if (u.name !== st.name) { if (u.label) { u.bar.remove(u.label); } u.label = nameSprite(st.name); u.label.position.set(0, 0.7, 0); u.bar.add(u.label); u.name = st.name; } }
      }
      // plant / defuse progress ring on the ground
      let pct = -1, col = 0xffb703;
      if (u.kind === "player") { if (st.planting) pct = Math.min(1, (Date.now() - st.plantStart) / plantMs); else if (st.defusing) pct = Math.min(1, (Date.now() - st.defuseStart) / defuseMs); }
      else if (st.defusing) { pct = Math.min(1, (st.defuseElapsed || 0) / defuseMs); col = 0xff3ea5; }
      if (pct >= 0 && alive) {
        const key = Math.round(pct * 60) + ":" + col;
        if (key !== u.progKey) {
          if (u.prog) { u.prog.geometry.dispose(); u.prog.material.color.set(col); } else { u.prog = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.95, depthTest: false, toneMapped: false, side: THREE.DoubleSide })); u.prog.rotation.x = -Math.PI / 2; u.prog.renderOrder = 18; scene.add(u.prog); }
          u.prog.geometry = new THREE.RingGeometry(1.7, 2.15, 48, 1, Math.PI / 2, -Math.PI * 2 * Math.max(0.001, pct)); u.progKey = key;
        }
        u.prog.visible = true; u.prog.position.set(x, 0.12, z);
      } else if (u.prog) { u.prog.visible = false; u.progKey = ""; }
    }

    // pools: tracers, flashes, particles, shells, blood, smoke
    const tracerMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const tracerPool = []; const tracerGeo = new THREE.BoxGeometry(1, 0.1, 0.1);
    for (let i = 0; i < 28; i++) { const m = new THREE.Mesh(tracerGeo, tracerMat(0xffe0a0)); m.visible = false; scene.add(m); tracerPool.push(m); }
    const flashPool = []; for (let i = 0; i < 10; i++) { const s = makeGlow(0xffd070, 3, 1); s.visible = false; scene.add(s); flashPool.push(s); }
    const flashLights = []; for (let i = 0; i < 2; i++) { const l = new THREE.PointLight(0xffc060, 0, 16, 2); scene.add(l); flashLights.push(l); }
    const PN = 360; const pGeo = new THREE.BufferGeometry(); const pPos = new Float32Array(PN * 3), pCol = new Float32Array(PN * 3), pSize = new Float32Array(PN);
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3)); pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3)); pGeo.setAttribute("aSize", new THREE.BufferAttribute(pSize, 1));
    const pMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, fog: false, uniforms: { uScale: { value: 600 } },
      vertexShader: "attribute float aSize; varying vec3 vC; uniform float uScale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = aSize * uScale / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }",
      fragmentShader: "varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC * a * 1.6, a); }",
    });
    const pts = new THREE.Points(pGeo, pMat); pts.frustumCulled = false; scene.add(pts);
    const colCache = new Map(); const tmpC = new THREE.Color();
    const getCol = (s) => { let c = colCache.get(s); if (!c) { try { tmpC.set(s); c = [tmpC.r, tmpC.g, tmpC.b]; } catch { c = [1, 1, 1]; } colCache.set(s, c); } return c; };
    const shellMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.07, 0.26, 6), new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.9, roughness: 0.3 }), 90); shellMesh.count = 0; scene.add(shellMesh);
    const bloodMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 20), new THREE.MeshStandardMaterial({ color: 0x5a0a12, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), 80); bloodMesh.count = 0; scene.add(bloodMesh);
    const dummy = new THREE.Object3D();
    const smokeTex = smokeTexture(); const smokeClouds = [];
    function makeSmoke() {
      const g = new THREE.Group(); const sprites = [];
      for (let i = 0; i < 12; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: 0x9aa2aa, transparent: true, depthWrite: false, opacity: 0.0, fog: true })); sp.userData = { a: Math.random() * 6.28, r: Math.random(), h: Math.random(), s: 0.8 + Math.random() * 0.7, sp: 0.2 + Math.random() * 0.4 }; g.add(sp); sprites.push(sp); }
      scene.add(g); return { g, sprites };
    }
    // aiming reticle and laser sight
    const reticle = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 28), new THREE.MeshBasicMaterial({ color: 0x3ee6e0, transparent: true, opacity: 0.8, depthTest: false, toneMapped: false, side: THREE.DoubleSide })); reticle.rotation.x = -Math.PI / 2; reticle.renderOrder = 19; scene.add(reticle);
    const laserMat = new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const laser = new THREE.Mesh(new THREE.BoxGeometry(1, 0.05, 0.05), laserMat); scene.add(laser);
    const laserDot = makeGlow(0xff5050, 1.1, 1); scene.add(laserDot);
    // bomb
    const bomb = new THREE.Group(); bomb.visible = false; scene.add(bomb);
    const bodyM = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.6, 1.0), new THREE.MeshStandardMaterial({ color: 0x3a4030, roughness: 0.7, metalness: 0.3 })); bodyM.position.y = 0.3; bodyM.castShadow = true; bomb.add(bodyM);
    for (let i = 0; i < 3; i++) { const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.7, 10), new THREE.MeshStandardMaterial({ color: [0xb02a1a, 0xc9a227, 0x2a4a9a][i], roughness: 0.5 })); cyl.rotation.z = Math.PI / 2; cyl.position.set(0, 0.72, -0.28 + i * 0.28); bomb.add(cyl); }
    const dispCanvas = document.createElement("canvas"); dispCanvas.width = 128; dispCanvas.height = 48; const dctx = dispCanvas.getContext("2d"); const dispTex = new THREE.CanvasTexture(dispCanvas); dispTex.colorSpace = THREE.SRGBColorSpace;
    const disp = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.34), new THREE.MeshBasicMaterial({ map: dispTex, toneMapped: false })); disp.rotation.x = -Math.PI / 2; disp.position.set(0, 0.62, 0.25); bomb.add(disp);
    const bombGlow = makeGlow(0xff2a2a, 3.2, 1); bombGlow.position.y = 1.0; bomb.add(bombGlow);
    const bombLight = new THREE.PointLight(0xff2a20, 0, 14, 2); bombLight.position.y = 1.2; bomb.add(bombLight);
    const pulse = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 48), new THREE.MeshBasicMaterial({ color: 0xff3ea5, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); pulse.rotation.x = -Math.PI / 2; pulse.position.y = 0.08; bomb.add(pulse);
    let lastBombSec = -1, lastBeat = 0;
    if (typeof window !== "undefined" && window.__BS_EXPOSE) window.__bsSmoke = smokeClouds;
    // lightning
    const bolts = []; const boltMat = new THREE.MeshBasicMaterial({ color: 0xdcecff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false });
    function spawnBolt() {
      const g = new THREE.Group(); let x = CX + (Math.random() - 0.5) * 180, z = -40 - Math.random() * 40, y = 70; const ex = x + (Math.random() - 0.5) * 20; const n = 14; let px = x, py = y, pz = z;
      for (let i = 1; i <= n; i++) { const k = i / n; const nx = x + (ex - x) * k + (Math.random() - 0.5) * 7, ny = y * (1 - k), nz = z + (Math.random() - 0.5) * 4; const len = Math.hypot(nx - px, ny - py, nz - pz); const seg = new THREE.Mesh(new THREE.BoxGeometry(0.35, len, 0.35), boltMat.clone()); seg.position.set((px + nx) / 2, (py + ny) / 2, (pz + nz) / 2); seg.lookAt(nx, ny, nz); seg.rotateX(Math.PI / 2); g.add(seg); px = nx; py = ny; pz = nz; }
      scene.add(g); bolts.push({ g, born: tAcc });
    }

    // ---- camera ---------------------------------------------------------------------------------------
    const camera = new THREE.PerspectiveCamera(34, width / height, 1, 900);
    const PITCH = (67 * Math.PI) / 180, DIST = 112;
    const camBase = new THREE.Vector3(CX, DIST * Math.sin(PITCH), CZ + 4 + DIST * Math.cos(PITCH));
    camera.position.copy(camBase); camera.lookAt(CX, 0, CZ + 4);
    camera.updateMatrixWorld();

    const cine = createCinematic(renderer, scene, camera, { exposure: TH.exposure, bloom: TH.bloom, grade: TH.grade });
    const clock = new THREE.Clock(); let tAcc = 0, slowFrames = 0, quality = 2, lastEnv = 0, nextStrike = 4, boltFlash = 0;

    // ---- mouse -> map coordinates -----------------------------------------------------------------------
    const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2(); const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); const hit = new THREE.Vector3();
    function onMove(e) {
      const r = renderer.domElement.getBoundingClientRect(); if (!r.width) return;
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
      ray.setFromCamera(ndc, camera);
      if (ray.ray.intersectPlane(plane, hit)) mouseRef.current = { x: Math.max(0, Math.min(mapW, hit.x / S)), y: Math.max(0, Math.min(mapH, hit.z / S)) };
    }
    renderer.domElement.addEventListener("mousemove", onMove);

    if (typeof window !== "undefined" && window.__BS_EXPOSE) window.__bs = { scene, renderer, maskMesh, moon, hemi, flash, personal, camera, cine, floorMat, playerRef, botsRef, teammatesRef, bombRef, smokesRef, map, tracersRef, flashesRef, shellsRef, bloodRef, particlesRef, lightningRef };
    const flashColorV = new THREE.Vector3();
    let frameId; let prevLight = 0;
    function renderLoop() {
      const dt = Math.min(0.1, clock.getDelta()); tAcc += dt; const now = Date.now(); const t = tAcc;
      sky.userData.update(t, camera.position);
      if (waterMat) waterMat.userData.update(t);
      if (rain) rain.material.uniforms.uTime.value = t;
      if (ash) { ash.userData.update(t, { x: CX, z: CZ }); embers.userData.update(t, { x: CX, z: CZ }); }
      if (mist) mist.userData.update(t, { x: CX, z: CZ });
      for (const l of lampPositions) l.light.intensity = l.base * (0.9 + 0.1 * Math.sin(t * 9 + l.ph) * Math.sin(t * 3.1 + l.ph * 2));
      for (const s of sites) { s.pad.material.opacity = 1; s.beam.material.uniforms.uOpacity.value = 0.55 + 0.2 * Math.sin(t * 2.2); }
      for (const d of dishLight) d.material.opacity = 0.4 + 0.6 * (Math.sin(t * 3) > 0 ? 1 : 0.2);

      // lightning: the game decides when (lightningRef); we turn it into light, sky and a bolt
      const L = lightningRef ? lightningRef.current : 0;
      if (L > prevLight + 0.2 && TH.lightning > 0) spawnBolt();
      prevLight = L;
      const tune = (typeof window !== "undefined" && window.__BS_TUNE) || {};
      moon.intensity = TH.moon[1] * (tune.moon ?? 1) * (1 + L * 3.2); hemi.intensity = TH.hemi[2] * (tune.hemi ?? 1) * (1 + L * 2.4); sky.userData.uniforms.uFlash.value = L * 0.65;
      if (cine.grade) { cine.grade.uFlash.value = L * 0.05; }
      for (let i = bolts.length - 1; i >= 0; i--) { const b = bolts[i]; const a = 1 - (t - b.born) / 0.35; if (a <= 0) { scene.remove(b.g); b.g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); bolts.splice(i, 1); } else b.g.children.forEach((c) => { c.material.opacity = a * (0.6 + 0.4 * Math.random()); }); }

      const p = playerRef.current;
      // units
      const bots = botsRef.current, mates = teammatesRef.current;
      while (unitPool.bots.length < bots.length) unitPool.bots.push(makeUnit("bots", unitPool.bots.length));
      while (unitPool.mates.length < mates.length) unitPool.mates.push(makeUnit("mates", unitPool.mates.length));
      if (!unitPool.player) unitPool.player = makeUnit("player", 0);
      unitPool.bots.forEach((u, i) => updateUnit(u, bots[i], dt, t, 80, false));
      unitPool.mates.forEach((u, i) => updateUnit(u, mates[i], dt, t, 100, true));
      updateUnit(unitPool.player, p, dt, t, 100, false);
      if (unitPool.player.g.visible) unitPool.player.g.position.y = p.alive ? 0 : 0.34;

      // flashlight, reticle, laser, fog of war
      const px = p.x * S, pz = p.y * S; const ca = Math.cos(p.aim), sa = Math.sin(p.aim);
      flash.visible = p.alive; personal.visible = p.alive;
      flash.position.set(px + ca * 1.2, 3.3, pz + sa * 1.2); flash.target.position.set(px + ca * 22, 0, pz + sa * 22);
      personal.position.set(px, 2.4, pz);
      const m = mouseRef.current; reticle.position.set(m.x * S, 0.1, m.y * S); reticle.scale.setScalar(1 + 0.08 * Math.sin(t * 6)); reticle.visible = p.alive;
      if (p.alive) {
        const lh = rayWall(p.x, p.y, p.aim, 800, map.walls); const ex = lh ? lh.x : p.x + ca * 800, ey = lh ? lh.y : p.y + sa * 800;
        const bx = (p.x + ca * 20) * S, bz = (p.y + sa * 20) * S, exw = ex * S, ezw = ey * S; const len = Math.hypot(exw - bx, ezw - bz);
        laser.visible = true; laser.position.set((bx + exw) / 2, 2.2, (bz + ezw) / 2); laser.scale.set(len, 1, 1); laser.rotation.y = -p.aim;
        laserDot.visible = true; laserDot.position.set(exw, 2.2, ezw);
      } else { laser.visible = false; laserDot.visible = false; }
      drawMask(p); maskTex.needsUpdate = true;

      // muzzle flashes and tracers
      const fl = flashesRef.current; let li = 0;
      for (let i = 0; i < flashPool.length; i++) {
        const s = flashPool[i]; let f = fl[i];
        if (f) { f = { x: f.x, y: f.y, angle: f.angle, life: Math.max(0, Math.min(1, f.life)) }; s.visible = true; s.position.set((f.x + Math.cos(f.angle) * 20) * S, 2.2, (f.y + Math.sin(f.angle) * 20) * S); const k = 2.6 + f.life * 2.4; s.scale.set(k, k, 1); s.material.opacity = Math.min(1, f.life * 1.6); if (li < flashLights.length) { const lt = flashLights[li++]; lt.position.copy(s.position); lt.position.y = 2.6; lt.intensity = 140 * f.life; } } else s.visible = false;
      }
      for (let i = li; i < flashLights.length; i++) flashLights[i].intensity = 0;
      const tr = tracersRef.current;
      for (let i = 0; i < tracerPool.length; i++) {
        const m2 = tracerPool[i], tc = tr[i];
        if (!tc) { m2.visible = false; continue; }
        const x0 = tc.x0 * S, z0 = tc.y0 * S, x1 = tc.x1 * S, z1 = tc.y1 * S; const len = Math.hypot(x1 - x0, z1 - z0);
        m2.visible = len > 0.1; m2.position.set((x0 + x1) / 2, 2.2, (z0 + z1) / 2); m2.scale.set(len, 1, 1); m2.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
        m2.material.opacity = Math.max(0, Math.min(1, tc.life)); const cc = getCol(tc.color || "#ffe0a0"); m2.material.color.setRGB(Math.min(1, cc[0] + 0.5), Math.min(1, cc[1] + 0.4), Math.min(1, cc[2] + 0.3));
      }
      // sparks and blood spray
      const pa = particlesRef.current; const n = Math.min(PN, pa.length);
      for (let i = 0; i < n; i++) { const q = pa[i]; pPos[i * 3] = q.x * S; pPos[i * 3 + 1] = 1.0 + (1 - Math.max(0, Math.min(1, q.life))) * 0.8; pPos[i * 3 + 2] = q.y * S; const c = getCol(q.color); pCol[i * 3] = c[0]; pCol[i * 3 + 1] = c[1]; pCol[i * 3 + 2] = c[2]; pSize[i] = 0.5 * Math.max(0.2, Math.min(1, q.life)); }
      for (let i = n; i < PN; i++) { pSize[i] = 0; pPos[i * 3 + 1] = -50; }
      pGeo.attributes.position.needsUpdate = true; pGeo.attributes.color.needsUpdate = true; pGeo.attributes.aSize.needsUpdate = true; pMat.uniforms.uScale.value = renderer.domElement.height * 0.55;
      // shells and blood
      const sh = shellsRef.current; shellMesh.count = Math.min(90, sh.length);
      for (let i = 0; i < shellMesh.count; i++) { const s = sh[i]; dummy.position.set(s.x * S, 0.1, s.y * S); dummy.rotation.set(0, -s.rot, Math.PI / 2); dummy.scale.setScalar(1); dummy.updateMatrix(); shellMesh.setMatrixAt(i, dummy.matrix); }
      shellMesh.instanceMatrix.needsUpdate = true;
      const bd = bloodRef.current; bloodMesh.count = Math.min(80, bd.length);
      for (let i = 0; i < bloodMesh.count; i++) { const b = bd[i]; dummy.position.set(b.x * S, 0.035, b.y * S); dummy.rotation.set(-Math.PI / 2, 0, b.rot); dummy.scale.set(b.r * S * 1.4, b.r * S * 0.9, 1); dummy.updateMatrix(); bloodMesh.setMatrixAt(i, dummy.matrix); }
      bloodMesh.instanceMatrix.needsUpdate = true;
      // smoke
      const sm = smokesRef.current;
      while (smokeClouds.length < sm.length) smokeClouds.push(makeSmoke());
      smokeClouds.forEach((c, i) => {
        const s = sm[i]; c.g.visible = !!s; if (!s) return;
        const remaining = s.expiresAt - now, age = 1 - Math.max(0, Math.min(1, remaining / 9000)); const fade = remaining < 1200 ? Math.max(0, remaining / 1200) : 1; const grow = Math.min(1, 0.25 + age * 6);
        c.g.position.set(s.x * S, 0, s.y * S);
        c.sprites.forEach((sp, k) => { const d = sp.userData; const ang = d.a + t * d.sp * 0.4; const rr = s.r * S * (0.2 + d.r * 0.7) * grow; sp.position.set(Math.cos(ang) * rr, 0.9 + d.h * 3.6 * grow + Math.sin(t * 0.8 + k) * 0.15, Math.sin(ang) * rr); const sz = s.r * S * 1.15 * d.s * grow; sp.scale.set(sz, sz, 1); sp.material.opacity = 0.62 * fade; sp.material.rotation = ang * 0.5; });
      });
      // bomb
      const b = bombRef.current;
      if (b.planted) {
        bomb.visible = true; bomb.position.set(b.x * S, 0, b.y * S);
        const sec = Math.max(0, Math.ceil(b.timer)); const period = b.timer < 5 ? 0.25 : b.timer < 10 ? 0.5 : 1.0; const ph = (t % period) / period; const on = ph < 0.25;
        bombGlow.material.opacity = on ? 1 : 0.15; bombGlow.scale.setScalar(on ? 3.4 : 1.6); bombLight.intensity = on ? 130 : 8;
        if (on && now - lastBeat > period * 700) { lastBeat = now; pulse.userData.t0 = t; }
        const pk = (t - (pulse.userData.t0 ?? -9)) / 0.9; pulse.material.opacity = pk >= 0 && pk < 1 ? (1 - pk) * 0.9 : 0; pulse.scale.setScalar(1 + (pk > 0 ? pk : 0) * 7);
        if (sec !== lastBombSec) { lastBombSec = sec; dctx.fillStyle = "#050000"; dctx.fillRect(0, 0, 128, 48); dctx.fillStyle = "#ff2a2a"; dctx.font = "bold 40px ui-monospace, monospace"; dctx.textAlign = "center"; dctx.textBaseline = "middle"; dctx.fillText("0:" + String(sec).padStart(2, "0"), 64, 26); dispTex.needsUpdate = true; }
      } else { bomb.visible = false; lastBombSec = -1; }

      // floating damage numbers
      const floatTexts = floatTextRef ? floatTextRef.current : []; const container = floatTextContainerRef.current;
      if (container) {
        while (container.children.length > floatTexts.length) container.removeChild(container.lastChild);
        while (container.children.length < floatTexts.length) { const el = document.createElement("div"); Object.assign(el.style, { position: "absolute", fontFamily: "ui-monospace, monospace", fontSize: "13px", fontWeight: "bold", transform: "translate(-50%, -50%)", textShadow: "0 0 4px #000, 0 0 8px #000", whiteSpace: "nowrap" }); container.appendChild(el); }
        const rect = mount.getBoundingClientRect();
        for (let i = 0; i < floatTexts.length; i++) { const ft = floatTexts[i], el = container.children[i]; tmpV.set(ft.x * S, 3.4, ft.y * S).project(camera); el.textContent = ft.text; el.style.color = ft.color; el.style.left = `${(tmpV.x * 0.5 + 0.5) * rect.width}px`; el.style.top = `${(-tmpV.y * 0.5 + 0.5) * rect.height}px`; el.style.opacity = String(Math.max(0, ft.life)); }
      }

      // damage flash, shake, low-health look
      const df = damageFlashRef ? damageFlashRef.current : 0; const low = p.alive && p.hp < 30 ? (30 - p.hp) / 30 : 0;
      if (cine.grade) { cine.grade.uFlashColor.value.set(1, 0.14, 0.45); cine.grade.uFlash.value += df * 0.2; cine.grade.uVig.value = TH.grade.vig + low * 0.35; cine.grade.uSat.value = (TH.grade.sat || 1) * (1 - low * 0.4); }
      const camOv = typeof window !== "undefined" ? window.__BS_CAM : null; const shake = shakeRef ? shakeRef.current : 0;
      if (camOv) { camera.position.set(...camOv.pos); camera.lookAt(...camOv.look); }
      else { camera.position.set(camBase.x + (Math.random() - 0.5) * shake * 0.9, camBase.y + (Math.random() - 0.5) * shake * 0.6, camBase.z); camera.lookAt(CX, 0, CZ + 4); }

      if (t - lastEnv > 10) { lastEnv = t; const old = scene.environment; try { scene.environment = skyEnvironment(renderer, sky); } catch {} disposeEnvironment(old); }
      if (!(typeof window !== "undefined" && window.__CINE_PAUSE)) cine.render(dt);
      if (dt > 0.05) slowFrames++; else slowFrames = Math.max(0, slowFrames - 1);
      if (slowFrames > 90 && quality > 0) {
        quality--; slowFrames = 0;
        if (quality === 1) { renderer.setPixelRatio(1); const w2 = mount.clientWidth, h2 = mount.clientHeight; renderer.setSize(w2, h2); cine.setSize(w2, h2); }
        else { if (cine.bloom) cine.bloom.enabled = false; moon.shadow.mapSize.set(1024, 1024); if (moon.shadow.map) { moon.shadow.map.dispose(); moon.shadow.map = null; } flash.castShadow = false; }
      }
      frameId = requestAnimationFrame(renderLoop);
    }
    renderLoop();

    function handleResize() {
      const w = mount.clientWidth, h = mount.clientHeight; if (!w || !h) return;
      width = w; height = h; camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h); cine.setSize(w, h);
    }
    const ro = new ResizeObserver(handleResize); ro.observe(mount); window.addEventListener("resize", handleResize);

    return () => {
      ro.disconnect(); window.removeEventListener("resize", handleResize); renderer.domElement.removeEventListener("mousemove", onMove); cancelAnimationFrame(frameId);
      cine.dispose(); disposeEnvironment(scene.environment);
      scene.traverse((obj) => { if (obj.geometry) obj.geometry.dispose(); if (obj.material) { if (Array.isArray(obj.material)) obj.material.forEach((mm) => mm.dispose()); else obj.material.dispose(); } });
      maskTex.dispose(); smokeTex.dispose(); dispTex.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div ref={mountRef} style={{ width: "100%", height: "100%" }} />
      <div ref={floatTextContainerRef} style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }} />
    </div>
  );
}
