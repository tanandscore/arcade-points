// Builds the Foundry Yard as a lit, textured night scene from the map data:
// concrete walls with trims, pipes, panels and lamps, tile/asphalt/grate floors, wet puddles,
// roofed tunnels, crates, containers, trucks and generators, a skyline beyond the walls, rain and a storm.
import * as THREE from "three";
import { makeReal, fbm2 } from "./surfaces";
import { makeSkyDome, skyEnvironment, disposeEnvironment, makeGlow, makeBeamMaterial, makeParticles } from "@/lib/cinematic/atmos";
import { addDetail } from "./detail";
import { addDayDress } from "./dayDress";
import { CELL, COLS, ROWS, WALL_H, SITES } from "./map";
import { cpuCanvas } from "./cpucanvas";

function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function canvasTex(w, h, draw, srgb = true) { const c = cpuCanvas(w, h); draw(c.getContext("2d"), w, h); const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function boxGeo(w, h, d, tile = 3, uOff = 0, vOff = 0) {
  const g = new THREE.BoxGeometry(w, h, d); const uv = g.attributes.uv; const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / tile + uOff, uv.getY(k) * dims[f][1] / tile + vOff); }
  return g;
}
const hazardTex = () => canvasTex(256, 64, (g, w, h) => { g.fillStyle = "#d9a21b"; g.fillRect(0, 0, w, h); g.fillStyle = "#15171a"; for (let x = -h; x < w + h; x += 44) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + 22, h); g.lineTo(x + 22 + h, 0); g.lineTo(x + h, 0); g.fill(); } g.fillStyle = "rgba(0,0,0,0.25)"; for (let i = 0; i < 400; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2); });
const streakTex = () => canvasTex(128, 256, (g, w, h) => { g.clearRect(0, 0, w, h); for (let i = 0; i < 26; i++) { const x = Math.random() * w, len = 60 + Math.random() * 190, wd = 2 + Math.random() * 10; const gr = g.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, "rgba(10,12,10," + (0.1 + Math.random() * 0.25) + ")"); gr.addColorStop(1, "rgba(10,12,10,0)"); g.fillStyle = gr; g.fillRect(x, 0, wd, len); } });
const signTex = (text, color, sub) => canvasTex(512, 160, (g, w, h) => {
  g.fillStyle = "#0b0d10"; g.fillRect(0, 0, w, h); g.strokeStyle = color; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20);
  g.fillStyle = color; g.font = "bold 84px ui-monospace, Menlo, monospace"; g.textAlign = "center"; g.textBaseline = "middle"; g.shadowColor = color; g.shadowBlur = 18; g.fillText(text, w / 2, h / 2 + (sub ? -12 : 4)); if (sub) { g.font = "bold 32px ui-monospace, monospace"; g.fillText(sub, w / 2, h - 36); }
});
const siteTex = (letter, color) => canvasTex(512, 512, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.strokeStyle = color; g.lineWidth = 14; g.beginPath(); g.arc(w / 2, h / 2, 230, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 6; g.setLineDash([26, 22]); g.beginPath(); g.arc(w / 2, h / 2, 196, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
  g.fillStyle = color; g.font = "bold 300px ui-monospace, Menlo, monospace"; g.textAlign = "center"; g.textBaseline = "middle"; g.globalAlpha = 0.9; g.fillText(letter, w / 2, h / 2 + 18);
});
const windowTex = () => canvasTex(256, 256, (g, w, h) => { g.fillStyle = "#06080b"; g.fillRect(0, 0, w, h); const r = rng(9); for (let y = 6; y < h; y += 14) for (let x = 6; x < w; x += 12) { if (r() > 0.78) { g.fillStyle = r() > 0.5 ? "#ffd89a" : "#9ad0ff"; g.fillRect(x, y, 6, 8); } } });

// Night look for Foundry Yard — lifted so soldiers read clearly: more sky and moon light, thinner fog, lighter surfaces.
export const THEME = {
  sky: { zenith: 0x0a1426, mid: 0x1a2c44, horizon: 0x3c5870, sunDir: [-0.5, 0.5, -0.55], sunColor: 0xaac4e8, sunSize: 0.007, glow: 0.7, cloud: 0.8, cloudColor: 0x4a5870, cloudShade: 0x0c1220, stars: 0.35, wind: 0.006 },
  fog: [0x1a2a38, 0.0042],
  hemi: [0x86a6d4, 0x38506a, 9.2], sun: { color: 0xa6c0ee, intensity: 13, off: [-34, 58, -26] }, env: 1.1,
};

export function buildWorld(scene, renderer, map, opts = {}) {
  const disposables = []; const track = (o) => { disposables.push(o); return o; };
  const R = rng(1337); const W = COLS * CELL, D = ROWS * CELL;
  const look = map.def.look || null; const day = !!(look && look.mode === "day"); const LK = day ? look : THEME;
  scene.fog = new THREE.FogExp2(LK.fog[0], LK.fog[1]);

  // ---- sky, moon, ambient -------------------------------------------------------------------------------
  const sky = makeSkyDome(day ? look.sky : THEME.sky); scene.add(sky);
  let envTex = null; try { envTex = skyEnvironment(renderer, sky); scene.environment = envTex; scene.environmentIntensity = LK.env ?? 0.9; } catch { envTex = null; }
  const HEMI0 = LK.hemi[2], SUN0 = LK.sun.intensity;
  const hemi = new THREE.HemisphereLight(LK.hemi[0], LK.hemi[1], HEMI0); scene.add(hemi);
  const moon = new THREE.DirectionalLight(LK.sun.color, SUN0); moon.castShadow = true; const SM = opts.shadowSize || 2048; moon.shadow.mapSize.set(SM, SM); moon.shadow.bias = day ? -0.0003 : -0.0004; moon.shadow.normalBias = day ? 0.05 : 0.04;
  const SH = day ? 46 : 34; Object.assign(moon.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 160 }); moon.shadow.camera.updateProjectionMatrix(); scene.add(moon, moon.target);
  const moonOff = new THREE.Vector3(...LK.sun.off);

  // ---- materials ----------------------------------------------------------------------------------------------
  // every surface below is drawn by ./surfaces (fine grit, dirt in the joints, stains, bump + patchy gloss) — no flat colours with a pattern on top
  const KIND = { stone: "pave", tiles: "pave", dirt: "ground", concrete: "concrete", metal: "steel", corrugated: "steel", wood: "wood" };
  const surf = (m, o = {}) => { const kind = KIND[m] || "concrete"; const q = { ...o, size: o.size || 512 }; if (m === "stone") { q.rows ??= 5; q.cols ??= 3; } if (m === "tiles") { q.rows ??= 6; q.cols ??= 5; q.glossy = 0.7; } if (m === "corrugated") q.ribs ??= 12; if (m === "dirt") { q.ripple = true; q.cracks ??= 0.45; } return makeReal(kind, q); };
  const sConcrete = day ? surf(look.wall.m, look.wall.o) : surf("concrete", { seed: 3, colors: ["#3a3e44", "#757b83"], aggregate: true });
  const sAsphalt = surf("concrete", { seed: 8, colors: ["#25282c", "#4c5157"], aggregate: true, cracks: 0.22, rough: 0.78 });
  const sTiles = surf("tiles", { seed: 4, colors: ["#343a3c", "#626c6c"], rows: 6, cols: 6, joint: "#14181a" });
  const sGrate = surf("metal", { seed: 6, colors: ["#2c3136", "#5e646c"], size: 256, rust: 0.4 });
  const sWood = surf("wood", { seed: 2, colors: day ? ["#9a7e58", "#d0b88c"] : ["#4a3822", "#7a5e3c"], size: 256, cols: 4 });
  const sMetal = surf("metal", { seed: 9, colors: ["#2c3036", "#6a707a"], size: 256, rust: 0.3 });
  const sCorr = surf("corrugated", { seed: 7, colors: ["#d4d4d4", "#8e9296"], size: 256, ribs: 5 });
  const NS = day ? 0.62 : 0.5;
  const mat = (s, o = {}) => track(new THREE.MeshStandardMaterial({ map: s.map, normalMap: s.normalMap, roughnessMap: s.roughnessMap, normalScale: new THREE.Vector2(NS, NS), ...o }));
  const wallMat = track(new THREE.MeshStandardMaterial({ map: sConcrete.map, normalMap: sConcrete.normalMap, roughnessMap: sConcrete.roughnessMap, normalScale: new THREE.Vector2(0.8, 0.8), color: day ? 0xffffff : 0xcdd2d8, roughness: 1 }));

  // ---- floors ------------------------------------------------------------------------------------------------------
  const floorMats = day ? {} : {
    concrete: mat(sConcrete, { color: 0xd6dae0, roughness: 0.78 }), asphalt: mat(sAsphalt, { color: 0xc8ccd2, roughness: 0.62, metalness: 0.05 }),
    tiles: mat(sTiles, { color: 0xdce0e0, roughness: 0.5, metalness: 0.1 }), grate: mat(sGrate, { color: 0xccd0d6, roughness: 0.45, metalness: 0.6 }),
  };
  if (day) for (const k of Object.keys(look.floors)) { const fl = look.floors[k]; floorMats[k] = mat(surf(fl.m, fl.o), { color: fl.c, roughness: fl.r }); }
  const macro = fbm2(COLS, ROWS, 77, 7, 6, 3); // slow patchiness across the whole map, so the repeating tile never reads as a pattern
  const floorCells = {}; const firstFloor = day ? Object.keys(look.floors)[0] : "concrete";
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) { if (map.solid[j * COLS + i]) continue; const z = map.ZONES[map.zoneIdx[j * COLS + i]]; let fk = z ? z.floor : "concrete"; if (!floorMats[fk]) fk = firstFloor; (floorCells[fk] ||= []).push([i, j]); }
  const dummy = new THREE.Object3D();
  const floorGeo = new THREE.PlaneGeometry(CELL, CELL); floorGeo.rotateX(-Math.PI / 2);
  for (const k of Object.keys(floorCells)) {
    const cells = floorCells[k]; if (!cells.length) continue; const im = new THREE.InstancedMesh(floorGeo, floorMats[k], cells.length); const col = new THREE.Color();
    cells.forEach(([i, j], n) => { dummy.position.set((i + 0.5) * CELL, 0, (j + 0.5) * CELL); dummy.rotation.set(0, day ? (R(), 0) : Math.floor(R() * 4) * Math.PI / 2, 0); dummy.updateMatrix(); im.setMatrixAt(n, dummy.matrix); const v = day ? 0.8 + macro[j * COLS + i] * 0.34 + (R() - 0.5) * 0.04 : 0.8 + R() * 0.3; col.setRGB(v, v, v * (day ? 0.99 + R() * 0.02 : 0.96 + R() * 0.08)); im.setColorAt(n, col); });
    im.receiveShadow = true; scene.add(im);
  }
  track(floorGeo);
  // ground under the walls too (so thin seams never show void)
  const under = new THREE.Mesh(new THREE.PlaneGeometry(W + 80, D + 80), new THREE.MeshStandardMaterial({ color: day ? look.under : 0x07090b, roughness: 1 })); under.rotation.x = -Math.PI / 2; under.position.set(W / 2, -0.05, D / 2); scene.add(under);

  // ---- walls ---------------------------------------------------------------------------------------------------------
  const wallCells = []; const faces = [];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    if (!map.solid[j * COLS + i]) continue; let near = false;
    for (let dj = -1; dj <= 1 && !near; dj++) for (let di = -1; di <= 1; di++) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < COLS && b < ROWS && !map.solid[b * COLS + a]) { near = true; break; } }
    if (near) wallCells.push([i, j]);
  }
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) {
    if (map.solid[j * COLS + i]) continue;
    for (const [dx, dz] of dirs) { const a = i + dx, b = j + dz; if (a < 0 || b < 0 || a >= COLS || b >= ROWS || map.solid[b * COLS + a]) faces.push({ x: (i + 0.5 + dx * 0.5) * CELL, z: (j + 0.5 + dz * 0.5) * CELL, nx: -dx, nz: -dz, zone: map.ZONES[map.zoneIdx[j * COLS + i]], ci: i, cj: j }); }
  }
  const variants = [0, 1, 2, 3].map((v) => boxGeo(CELL, WALL_H, CELL, 3.2, v * 0.25, v * 0.5));
  const vCells = [[], [], [], []]; wallCells.forEach((c) => vCells[Math.floor(R() * 4)].push(c));
  vCells.forEach((cells, v) => {
    if (!cells.length) return; const im = new THREE.InstancedMesh(variants[v], wallMat, cells.length); const col = new THREE.Color();
    cells.forEach(([i, j], n) => { dummy.position.set((i + 0.5) * CELL, WALL_H / 2, (j + 0.5) * CELL); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); im.setMatrixAt(n, dummy.matrix); const s = 0.78 + R() * 0.32; col.setRGB(s, s, s * 1.02); im.setColorAt(n, col); });
    im.castShadow = true; im.receiveShadow = true; scene.add(im);
  });
  // trims, lips, panels, pipes, grime, hazard stripes along every exposed face
  const faceMesh = (geo, material, list, place, shadow = false) => {
    if (!list.length) return null; const im = new THREE.InstancedMesh(geo, material, list.length); const col = new THREE.Color();
    list.forEach((f, n) => { const c = place(f, n); dummy.position.copy(c.pos); dummy.rotation.set(c.rx || 0, Math.atan2(f.nx, f.nz) + (c.ry || 0), c.rz || 0); dummy.scale.set(c.sx || 1, c.sy || 1, c.sz || 1); dummy.updateMatrix(); im.setMatrixAt(n, dummy.matrix); if (c.color !== undefined) { col.setHex(c.color); im.setColorAt(n, col); } });
    dummy.scale.set(1, 1, 1); im.castShadow = shadow; im.receiveShadow = true; scene.add(im); return im;
  };
  const P = (f, y, off) => new THREE.Vector3(f.x + f.nx * off, y, f.z + f.nz * off);
  const sTrim = surf("concrete", { seed: 61, size: 256, colors: day ? ["#" + new THREE.Color(look.trim).multiplyScalar(0.62).getHexString(), "#" + new THREE.Color(look.trim).multiplyScalar(0.95).getHexString()] : ["#4a4e52", "#8a8e92"], cracks: 0.5 }); // plain plastered plinth / cornice stone
  const trimMat = track(new THREE.MeshStandardMaterial({ map: sTrim.map, normalMap: sTrim.normalMap, roughnessMap: sTrim.roughnessMap, normalScale: new THREE.Vector2(0.6, 0.6), color: 0xffffff, roughness: 1 }));
  faceMesh(boxGeo(CELL, 0.55, 0.16, 2.5), trimMat, faces, (f) => ({ pos: P(f, 0.275, 0.08) }), true);
  faceMesh(boxGeo(CELL, 0.28, 0.24, 2.5), trimMat, faces, (f) => ({ pos: P(f, WALL_H - 0.16, 0.12) }), true);
  const pipeMat = track(new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.5, metalness: 0.7 })); const ventMat = track(new THREE.MeshStandardMaterial({ color: 0x15181b, roughness: 0.55, metalness: 0.6 }));
  if (!day) {
  const panelFaces = faces.filter(() => R() < 0.42);
  const panelMat = mat(sMetal, { color: 0xffffff, roughness: 0.6, metalness: 0.5 });
  faceMesh(new THREE.BoxGeometry(CELL * 0.92, 1, 0.1), panelMat, panelFaces, (f) => { const h = 1.6 + R() * 1.6; return { pos: P(f, 1.2 + h / 2 + R() * 1.4, 0.05), sy: h, color: [0x7a8088, 0x5d6a74, 0x6a5f55, 0x4f5f58][Math.floor(R() * 4)] }; }, true);
  const pipeFaces = faces.filter(() => R() < 0.3);
  const pipeGeo = new THREE.CylinderGeometry(0.1, 0.1, CELL, 8); pipeGeo.rotateZ(Math.PI / 2);
  faceMesh(pipeGeo, pipeMat, pipeFaces, (f, n) => ({ pos: P(f, 3.6 + (n % 3) * 0.32, 0.22), color: [0x4a5058, 0x6a4a3a, 0x3a5a6a][n % 3] }), true);
  faceMesh(pipeGeo, pipeMat, pipeFaces.filter((_, n) => n % 2 === 0), (f) => ({ pos: P(f, 0.9, 0.2), sx: 1 }), true);
  const hazMat = track(new THREE.MeshStandardMaterial({ map: hazardTex(), roughness: 0.7, metalness: 0.1 })); hazMat.map.wrapS = hazMat.map.wrapT = THREE.RepeatWrapping; hazMat.map.repeat.set(2, 1);
  faceMesh(new THREE.PlaneGeometry(CELL, 0.42), hazMat, faces.filter((f) => f.zone && (f.zone.id === "t" || f.zone.id === "ct" || f.zone.id === "a" || f.zone.id === "b") && R() < 0.5), (f) => ({ pos: P(f, 0.55, 0.19) }));
  const grimeMat = track(new THREE.MeshBasicMaterial({ map: streakTex(), transparent: true, depthWrite: false, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -2 }));
  faceMesh(new THREE.PlaneGeometry(CELL, WALL_H * 0.9), grimeMat, faces.filter(() => R() < 0.55), (f) => ({ pos: P(f, WALL_H * 0.5, 0.26) }));
  // vents
  faceMesh(new THREE.BoxGeometry(1.1, 0.8, 0.18), ventMat, faces.filter(() => R() < 0.09), (f) => ({ pos: P(f, 2.0 + R() * 2, 0.1) }), true);

  }

  // ---- lamps: glowing fixtures everywhere, a few real lights follow the player ----------------------------
  const lamps = []; const lampGeo = new THREE.BoxGeometry(0.7, 0.16, 0.3);
  const lampGlowTex = makeGlow(0xffffff, 1, 1).material.map;
  const lampFaces = faces.filter((f) => f.zone && (day ? (f.zone.roof && (f.ci + f.cj) % 2 === 0) : ((f.ci + f.cj) % 3 === 0 && R() < 0.5)));
  lampFaces.forEach((f) => {
    const z = f.zone; const col = day ? 0xfff0d0 : (z.lamp ?? 0xffc880); const y = z.roof ? WALL_H - 1.0 : 4.6;
    const body = new THREE.Mesh(lampGeo, track(new THREE.MeshBasicMaterial({ color: col, toneMapped: false }))); body.position.copy(P(f, y, 0.3)); body.rotation.y = Math.atan2(f.nx, f.nz); scene.add(body);
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.3), ventMat); bracket.position.copy(P(f, y + 0.12, 0.2)); bracket.rotation.y = body.rotation.y; scene.add(bracket);
    const glow = makeGlow(col, 2.4, 0.38); glow.position.copy(P(f, y, 0.55)); scene.add(glow);
    lamps.push({ x: f.x + f.nx * 1.9, y, z: f.z + f.nz * 1.9, color: col, phase: R() * 6, flicker: R() < 0.12, glow });
  });
  // hanging work lamps in the open yards
  (day ? [] : (map.def.hanging || [])).forEach(([ci, cj]) => {
    const x = (ci + 0.5) * CELL, z = (cj + 0.5) * CELL; if (map.isSolidCell(ci, cj)) return; const zn = map.ZONES[map.zoneIdx[cj * COLS + ci]]; const col = zn ? zn.lamp : 0xffd08a;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 4.8, 8), ventMat); pole.position.set(x, 2.4, z); pole.castShadow = true; scene.add(pole);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.14, 0.5), track(new THREE.MeshBasicMaterial({ color: col, toneMapped: false }))); head.position.set(x, 4.85, z); scene.add(head);
    const glow = makeGlow(col, 4.2, 0.6); glow.position.set(x, 4.7, z); scene.add(glow);
    lamps.push({ x, y: 4.6, z, color: col, phase: R() * 6, flicker: false, glow });
  });
  const POOL = day ? 4 : 6; const lampLights = []; for (let i = 0; i < POOL; i++) { const l = new THREE.PointLight(0xffc880, 0, 26, 2); scene.add(l); lampLights.push(l); }
  // site floodlights (real coloured spots, no shadows)
  const floods = [];
  if (!day) for (const k of ["A", "B"]) {
    const s = SITES[k]; const sp = new THREE.SpotLight(s.color, 1800, 70, 0.95, 0.7, 1.6); sp.position.set(s.cx, 9.5, s.cz + 6); sp.target.position.set(s.cx, 0, s.cz); scene.add(sp, sp.target); floods.push(sp);
  }

  // ---- roofs over tunnels and links -----------------------------------------------------------------------------
  const roofCells = []; for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) if (map.roof[j * COLS + i] && !map.solid[j * COLS + i]) roofCells.push([i, j]);
  if (roofCells.length) {
    const rm = new THREE.InstancedMesh(boxGeo(CELL, 0.5, CELL, 3.2), track(new THREE.MeshStandardMaterial({ map: sConcrete.map, normalMap: sConcrete.normalMap, color: day ? look.roof : 0xa4a8ae, roughness: 0.9 })), roofCells.length);
    roofCells.forEach(([i, j], n) => { dummy.position.set((i + 0.5) * CELL, WALL_H - 0.25, (j + 0.5) * CELL); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); rm.setMatrixAt(n, dummy.matrix); });
    rm.castShadow = true; rm.receiveShadow = true; scene.add(rm);
    const beams = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, 0.34, 0.3), pipeMat, roofCells.length * 2);
    roofCells.forEach(([i, j], n) => { for (let q = 0; q < 2; q++) { dummy.position.set((i + 0.5) * CELL, WALL_H - 0.66, (j + 0.25 + q * 0.5) * CELL); dummy.updateMatrix(); beams.setMatrixAt(n * 2 + q, dummy.matrix); } });
    scene.add(beams);
  }
  // roof mask for the rain shader
  const roofData = new Uint8Array(COLS * ROWS * 4); for (let k = 0; k < COLS * ROWS; k++) roofData[k * 4] = map.roof[k] ? 255 : 0;
  const roofTex = new THREE.DataTexture(roofData, COLS, ROWS, THREE.RGBAFormat); roofTex.needsUpdate = true; roofTex.magFilter = roofTex.minFilter = THREE.NearestFilter;

  // ---- props -----------------------------------------------------------------------------------------------------------
  const contCols = day ? look.contCols : [0xa04a36, 0x3a70a0, 0x4a8660, 0xd88a38, 0x909499, 0x9a3a40];
  const contMats = contCols.map((c) => mat(sCorr, { color: c, roughness: 0.6, metalness: 0.45 }));
  const crateMat = mat(sWood, { color: day ? look.crates : 0xc8a888, roughness: 0.85 }); const frameMat = track(new THREE.MeshStandardMaterial({ color: 0x23272b, roughness: 0.6, metalness: 0.5 }));
  const concreteProp = mat(sConcrete, { color: day ? 0xe8e0d0 : 0xc4c8ce, roughness: 0.85 }); const metalProp = mat(sMetal, { color: 0xb0b6be, roughness: 0.5, metalness: 0.6 });
  const barrelCols = [0x6a2222, 0x23406a, 0x6a5e22, 0x2a4a34];
  const stripeMat = track(new THREE.MeshStandardMaterial({ map: hazardTex(), roughness: 0.6 }));
  const woodBarrel = mat(sWood, { color: day ? 0xe8b878 : 0xc89a62, roughness: 0.8 }); const stuccoProp = mat(sConcrete, { color: day ? 0xf0e6d2 : 0xffffff, roughness: 0.9 });
  const clothMats = (day ? look.awning : [0xc8402a]).map((c) => track(new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, side: THREE.DoubleSide })));
  const soil = track(new THREE.MeshStandardMaterial({ color: 0x4a3420, roughness: 1 })); const leaf = [0x3f7a34, 0x4a8a3a, 0x2f6a30].map((c) => track(new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 })));
  const waterM = track(new THREE.MeshStandardMaterial({ color: 0x3a8ab0, roughness: 0.05, metalness: 0.6, envMapIntensity: 1.5 })); const sackM = track(new THREE.MeshStandardMaterial({ color: 0xc8a870, roughness: 1 }));
  const propGroup = new THREE.Group(); scene.add(propGroup);
  const addMesh = (parent, geo, m, x, y, z, shadow = true) => { const me = new THREE.Mesh(geo, m); me.position.set(x, y, z); me.castShadow = shadow; me.receiveShadow = true; parent.add(me); return me; };
  for (const b of map.boxes) {
    const w = b.x1 - b.x0, d = b.z1 - b.z0, h = b.y1 - b.y0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, cy = b.y0 + h / 2; const g = new THREE.Group(); g.position.set(cx, 0, cz); propGroup.add(g);
    const rr = rng(b.id * 77 + 5);
    if (b.kind === "container") {
      const m = contMats[b.color % contMats.length]; addMesh(g, boxGeo(w, h, d, 3.2, rr(), 0), m, 0, cy, 0);
      const along = w > d; for (const s of [-1, 1]) { addMesh(g, new THREE.BoxGeometry(along ? 0.1 : w + 0.04, h * 0.94, along ? d + 0.04 : 0.1), frameMat, along ? s * (w / 2 - 0.05) : 0, cy, along ? 0 : s * (d / 2 - 0.05)); }
      addMesh(g, new THREE.BoxGeometry(w + 0.06, 0.1, d + 0.06), frameMat, 0, b.y1 - 0.05, 0); addMesh(g, new THREE.BoxGeometry(w + 0.06, 0.1, d + 0.06), frameMat, 0, b.y0 + 0.05, 0);
    } else if (b.kind === "crate") {
      addMesh(g, boxGeo(w, h, d, 1.6, rr(), rr()), crateMat, 0, cy, 0);
      const e = 0.09; for (const sx of [-1, 1]) for (const sz of [-1, 1]) addMesh(g, new THREE.BoxGeometry(e, h + 0.02, e), frameMat, sx * (w / 2 - e / 2), cy, sz * (d / 2 - e / 2));
      const nlev = Math.max(1, Math.round(h / 1.3)); for (let k = 0; k <= nlev; k++) { const y = b.y0 + (k * h) / nlev; addMesh(g, new THREE.BoxGeometry(w + 0.02, 0.08, d + 0.02), frameMat, 0, Math.min(Math.max(y, b.y0 + 0.04), b.y1 - 0.04), 0); }
    } else if (b.kind === "barrel") {
      const r = Math.min(w, d) * 0.46; const col = barrelCols[b.id % 4]; const bm = day ? woodBarrel : track(new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.6 }));
      addMesh(g, new THREE.CylinderGeometry(r, r, h, 14), bm, 0, cy, 0); for (const yy of [0.2, 0.55, 0.9]) addMesh(g, new THREE.CylinderGeometry(r * 1.03, r * 1.03, 0.05, 14), frameMat, 0, yy, 0);
      if (b.id % 3 === 0) addMesh(g, new THREE.CylinderGeometry(r * 0.2, r * 0.2, 0.04, 10), track(new THREE.MeshBasicMaterial({ color: 0xffb040, toneMapped: false })), 0, h + 0.021, 0, false);
    } else if (b.kind === "barrier") {
      const along = w > d; const len = Math.max(w, d), wd = Math.min(w, d);
      const bg = new THREE.Group(); if (!along) bg.rotation.y = Math.PI / 2; g.add(bg);
      addMesh(bg, new THREE.BoxGeometry(len, h * 0.55, wd * 1.6), concreteProp, 0, h * 0.275, 0); addMesh(bg, new THREE.BoxGeometry(len, h * 0.5, wd * 0.9), concreteProp, 0, h * 0.8, 0);
      addMesh(bg, new THREE.BoxGeometry(len * 0.98, 0.16, wd * 1.7), stripeMat, 0, h * 0.62, 0, false);
    } else if (b.kind === "pillar") {
      addMesh(g, boxGeo(w, h, d, 2.5), concreteProp, 0, cy, 0); addMesh(g, new THREE.BoxGeometry(w + 0.1, 1.0, d + 0.1), stripeMat, 0, 0.5, 0, false); addMesh(g, new THREE.BoxGeometry(w + 0.25, 0.3, d + 0.25), concreteProp, 0, h - 0.15, 0);
    } else if (b.kind === "gen") {
      addMesh(g, new THREE.BoxGeometry(w, h, d), metalProp, 0, cy, 0); addMesh(g, new THREE.BoxGeometry(w * 0.9, 0.15, d * 0.9), frameMat, 0, h + 0.07, 0);
      for (let k = 0; k < 5; k++) addMesh(g, new THREE.BoxGeometry(w * 0.7, 0.06, 0.1), frameMat, 0, 0.5 + k * 0.28, d / 2 + 0.03, false);
      addMesh(g, new THREE.CylinderGeometry(0.16, 0.16, 1.2, 10), pipeMat, w * 0.3, h + 0.7, 0);
      const st = addMesh(g, new THREE.BoxGeometry(0.18, 0.18, 0.05), track(new THREE.MeshBasicMaterial({ color: 0x40ff80, toneMapped: false })), -w * 0.3, 1.4, d / 2 + 0.05, false); st.userData.blink = true;
    } else if (b.kind === "truck") {
      const along = w > d; const L = Math.max(w, d), Wd = Math.min(w, d); const tg = new THREE.Group(); if (!along) tg.rotation.y = Math.PI / 2; g.add(tg);
      addMesh(tg, boxGeo(L * 0.7, h * 0.78, Wd, 3), contMats[4], -L * 0.15, b.y0 + 0.6 + h * 0.39, 0); addMesh(tg, new THREE.BoxGeometry(L * 0.27, h * 0.55, Wd * 0.95), contMats[0], L * 0.36, b.y0 + 0.45 + h * 0.27, 0);
      addMesh(tg, new THREE.BoxGeometry(0.1, h * 0.28, Wd * 0.8), track(new THREE.MeshStandardMaterial({ color: 0x0a1018, roughness: 0.1, metalness: 0.8 })), L * 0.495, b.y0 + 0.95 + h * 0.3, 0, false);
      const wheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.36, 14); wheelGeo.rotateX(Math.PI / 2);
      for (const wx of [-L * 0.38, -L * 0.1, L * 0.34]) for (const sz of [-1, 1]) addMesh(tg, wheelGeo, track(new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.9 })), wx, 0.5, sz * (Wd / 2 - 0.1));
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.4), track(new THREE.MeshBasicMaterial({ color: 0xfff0c0, toneMapped: false }))); hl.position.set(L * 0.5, 0.9, Wd * 0.3); tg.add(hl); const hl2 = hl.clone(); hl2.position.z = -Wd * 0.3; tg.add(hl2);
    } else if (b.kind === "block") {
      addMesh(g, boxGeo(w, h, d, 2.8), concreteProp, 0, cy, 0); addMesh(g, new THREE.BoxGeometry(w + 0.12, 0.16, d + 0.12), frameMat, 0, h + 0.05, 0);
      if (day) { g.children.forEach((c) => { if (c.material === concreteProp) c.material = stuccoProp; }); addMesh(g, new THREE.BoxGeometry(w + 0.2, 0.3, d + 0.2), stuccoProp, 0, h - 0.15, 0); }
      else { const trim = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.1, d + 0.02), track(new THREE.MeshBasicMaterial({ color: 0x6fe0b4, toneMapped: false }))); trim.position.set(0, 0.9, 0); g.add(trim); }
    } else if (b.kind === "column") {
      const r = Math.min(w, d) * 0.4; addMesh(g, new THREE.CylinderGeometry(r, r * 1.08, h - 0.8, 14), stuccoProp, 0, 0.4 + (h - 0.8) / 2, 0); addMesh(g, new THREE.BoxGeometry(w * 1.1, 0.4, d * 1.1), stuccoProp, 0, 0.2, 0); addMesh(g, new THREE.BoxGeometry(w * 1.3, 0.5, d * 1.3), stuccoProp, 0, h - 0.25, 0); addMesh(g, new THREE.CylinderGeometry(r * 1.3, r, 0.35, 14), stuccoProp, 0, h - 0.7, 0);
    } else if (b.kind === "lowwall") {
      const along = w > d; addMesh(g, boxGeo(w, h, d, 2.2, rr(), 0), stuccoProp, 0, cy, 0); addMesh(g, new THREE.BoxGeometry(along ? w + 0.1 : w + 0.16, 0.1, along ? d + 0.16 : d + 0.1), concreteProp, 0, h + 0.05, 0);
    } else if (b.kind === "planter") {
      addMesh(g, boxGeo(w, h * 0.7, d, 1.4), stuccoProp, 0, h * 0.35, 0); addMesh(g, new THREE.BoxGeometry(w * 0.9, 0.06, d * 0.9), soil, 0, h * 0.7, 0, false);
      const nb = 5; for (let k = 0; k < nb; k++) addMesh(g, new THREE.IcosahedronGeometry(Math.min(w, d) * (0.28 + rr() * 0.12), 1), leaf[k % 3], (rr() - 0.5) * w * 0.6, h * 0.7 + 0.28 + rr() * 0.25, (rr() - 0.5) * d * 0.6);
      for (let k = 0; k < 4; k++) addMesh(g, new THREE.IcosahedronGeometry(0.07, 0), track(new THREE.MeshStandardMaterial({ color: [0xe0405a, 0xf0c840, 0xffffff, 0xd070d0][k], roughness: 0.8 })), (rr() - 0.5) * w * 0.7, h * 0.7 + 0.55 + rr() * 0.2, (rr() - 0.5) * d * 0.7, false);
    } else if (b.kind === "stall") {
      const along = w > d; const sg = new THREE.Group(); if (!along) sg.rotation.y = Math.PI / 2; g.add(sg); const L = Math.max(w, d), Wd = Math.min(w, d);
      addMesh(sg, new THREE.BoxGeometry(L, h * 0.78, Wd * 0.8), crateMat, 0, h * 0.39, 0); addMesh(sg, new THREE.BoxGeometry(L + 0.1, 0.06, Wd * 0.9), frameMat, 0, h * 0.78, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) addMesh(sg, new THREE.CylinderGeometry(0.04, 0.04, 2.7, 6), frameMat, sx * (L / 2 - 0.05), 1.35, sz * (Wd / 2 - 0.05));
      const cm = clothMats[b.color % clothMats.length]; const aw = new THREE.Mesh(new THREE.PlaneGeometry(L + 0.5, Wd + 0.9), cm); aw.rotation.x = -Math.PI / 2 + 0.22; aw.position.set(0, 2.62, 0); aw.castShadow = true; sg.add(aw);
      for (let k = 0; k < 5; k++) addMesh(sg, new THREE.IcosahedronGeometry(0.13 + rr() * 0.05, 1), track(new THREE.MeshStandardMaterial({ color: [0xe0402a, 0xe8a420, 0x6a9a2a, 0xc87a2a, 0x8a2a4a][k], roughness: 0.7 })), -L * 0.35 + k * L * 0.18, h * 0.78 + 0.13, 0, false);
    } else if (b.kind === "fountain") {
      const r = Math.min(w, d) * 0.5; addMesh(g, new THREE.CylinderGeometry(r, r * 1.04, h * 0.8, 20), stuccoProp, 0, h * 0.4, 0); addMesh(g, new THREE.CylinderGeometry(r * 1.08, r * 1.08, 0.12, 20), concreteProp, 0, h * 0.8, 0); addMesh(g, new THREE.CylinderGeometry(r * 0.88, r * 0.88, 0.04, 20), waterM, 0, h * 0.78, 0, false);
      addMesh(g, new THREE.CylinderGeometry(0.16, 0.22, h * 0.95, 10), stuccoProp, 0, h * 0.8 + h * 0.2, 0); addMesh(g, new THREE.CylinderGeometry(r * 0.38, r * 0.2, 0.18, 14), stuccoProp, 0, h * 1.12, 0); addMesh(g, new THREE.SphereGeometry(0.16, 10, 8), stuccoProp, 0, h * 1.35, 0);
    } else if (b.kind === "cart") {
      const along = w > d; const cg = new THREE.Group(); if (!along) cg.rotation.y = Math.PI / 2; g.add(cg); const L = Math.max(w, d), Wd = Math.min(w, d);
      addMesh(cg, new THREE.BoxGeometry(L * 0.8, 0.14, Wd * 0.8), crateMat, -L * 0.05, 0.62, 0); for (const s of [-1, 1]) addMesh(cg, new THREE.BoxGeometry(L * 0.8, 0.5, 0.05), crateMat, -L * 0.05, 0.9, s * Wd * 0.38);
      addMesh(cg, new THREE.BoxGeometry(0.05, 0.5, Wd * 0.76), crateMat, -L * 0.45, 0.9, 0); const wh = new THREE.CylinderGeometry(0.46, 0.46, 0.08, 14); wh.rotateX(Math.PI / 2); for (const s of [-1, 1]) addMesh(cg, wh, frameMat, -L * 0.05, 0.46, s * (Wd / 2 - 0.02));
      for (const s of [-1, 1]) addMesh(cg, new THREE.BoxGeometry(L * 0.5, 0.05, 0.05), crateMat, L * 0.55, 0.5, s * Wd * 0.25);
      for (let k = 0; k < 6; k++) addMesh(cg, new THREE.IcosahedronGeometry(0.15, 1), sackM, -L * 0.3 + (k % 3) * 0.3, 0.84 + Math.floor(k / 3) * 0.17, (k % 2 ? 1 : -1) * Wd * 0.18, false);
    } else if (b.kind === "sacks") {
      const nx = Math.max(2, Math.round(w / 0.55)), nz = Math.max(1, Math.round(d / 0.5));
      for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) for (let lv = 0; lv < (ix + iz) % 2 + 1; lv++) { const sk = addMesh(g, new THREE.SphereGeometry(0.26, 10, 8), sackM, -w / 2 + (ix + 0.5) * (w / nx) + (rr() - 0.5) * 0.06, 0.15 + lv * 0.26, -d / 2 + (iz + 0.5) * (d / nz) + (rr() - 0.5) * 0.06); sk.scale.set(1.0, 0.62, 0.78); sk.rotation.y = rr() * 3; }
    } else if (b.kind === "table") {
      addMesh(g, new THREE.CylinderGeometry(Math.min(w, d) * 0.48, Math.min(w, d) * 0.48, 0.05, 14), crateMat, 0, h, 0); addMesh(g, new THREE.CylinderGeometry(0.05, 0.07, h, 8), frameMat, 0, h / 2, 0);
      for (const a of [0, 2.1, 4.2]) addMesh(g, new THREE.CylinderGeometry(0.2, 0.2, 0.05, 10), crateMat, Math.cos(a) * w * 0.7, 0.47, Math.sin(a) * w * 0.7);
    } else if (b.kind === "tank") {
      const r = Math.min(w, d) * 0.5; addMesh(g, new THREE.CylinderGeometry(r, r, h, 20), metalProp, 0, h / 2, 0); addMesh(g, new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.12, 20), frameMat, 0, h * 0.35, 0); addMesh(g, new THREE.CylinderGeometry(r * 1.02, r * 1.02, 0.12, 20), frameMat, 0, h * 0.7, 0); addMesh(g, new THREE.SphereGeometry(r, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), metalProp, 0, h, 0);
    } else if (b.kind === "pallets") {
      for (let k = 0; k < 4; k++) { addMesh(g, new THREE.BoxGeometry(w, 0.12, d), crateMat, 0, 0.06 + k * 0.28, 0); } addMesh(g, new THREE.BoxGeometry(w * 0.92, h - 0.5, d * 0.92), sackM, 0, 0.5 + (h - 0.5) / 2, 0);
    } else if (b.kind === "bollard") {
      addMesh(g, new THREE.CylinderGeometry(Math.min(w, d) * 0.5, Math.min(w, d) * 0.58, h, 12), stripeMat, 0, h / 2, 0);
    }
  }

  // soft contact shadow under every prop on the ground, so nothing looks like it is floating on the floor
  {
    const aoT = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 5, w / 2, h / 2, w / 2); gr.addColorStop(0, "rgba(0,0,0,0.95)"); gr.addColorStop(0.5, "rgba(0,0,0,0.5)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, false);
    const list = map.boxes.filter((b) => b.y0 < 0.3 && b.kind !== "fountain");
    if (list.length) {
      const aoGeo = new THREE.PlaneGeometry(1, 1); aoGeo.rotateX(-Math.PI / 2);
      const aoM = track(new THREE.MeshBasicMaterial({ map: aoT, transparent: true, depthWrite: false, opacity: day ? 0.62 : 0.8, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, fog: false }));
      const aoI = new THREE.InstancedMesh(aoGeo, aoM, list.length);
      list.forEach((b, n) => { const w = b.x1 - b.x0, d = b.z1 - b.z0; dummy.position.set((b.x0 + b.x1) / 2, 0.014, (b.z0 + b.z1) / 2); dummy.rotation.set(0, 0, 0); dummy.scale.set(w * 1.55 + 0.7, 1, d * 1.55 + 0.7); dummy.updateMatrix(); aoI.setMatrixAt(n, dummy.matrix); });
      dummy.scale.set(1, 1, 1); aoI.renderOrder = 1; scene.add(aoI);
    }
  }

  // ---- floor markings, signs, puddles ------------------------------------------------------------------------
  for (const k of ["A", "B"]) {
    const s = SITES[k]; const hex = "#" + s.color.toString(16).padStart(6, "0");
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(s.r * 1.6, s.r * 1.6), track(new THREE.MeshBasicMaterial({ map: siteTex(k, hex), transparent: true, opacity: day ? 0.75 : 0.62, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3 })));
    pl.rotation.x = -Math.PI / 2; pl.position.set(s.cx, 0.02, s.cz); scene.add(pl);
  }
  const signs = day ? [] : (map.def.signs || []);
  signs.forEach(([text, color, x, z, nx, nz, sub]) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 1.38), track(new THREE.MeshBasicMaterial({ map: signTex(text, color, sub), toneMapped: false }))); s.position.set(x, 4.3, z); s.rotation.y = Math.atan2(nx, nz); scene.add(s);
    const gl = makeGlow(new THREE.Color(color), 6, 0.22); gl.position.set(x + nx * 0.6, 4.3, z + nz * 0.6); scene.add(gl);
  });
  const puddleMat = track(new THREE.MeshStandardMaterial({ color: 0x16202c, roughness: 0.03, metalness: 0.7, transparent: true, opacity: 0.5, envMapIntensity: 1.6, polygonOffset: true, polygonOffsetFactor: -2 }));
  const puddleGeo = new THREE.CircleGeometry(1, 24); puddleGeo.rotateX(-Math.PI / 2); let pn = 0; const puddles = [];
  for (let tries = 0; tries < 400 && pn < (day ? 0 : 46); tries++) {
    const i = Math.floor(R() * COLS), j = Math.floor(R() * ROWS); if (map.solid[j * COLS + i] || map.roof[j * COLS + i]) continue; const x = (i + R()) * CELL, z = (j + R()) * CELL; if (map.isBlocked(x, z)) continue; puddles.push([x, z, 0.5 + R() * 1.6, 0.6 + R() * 0.8, R() * 3]); pn++;
  }
  const pm = new THREE.InstancedMesh(puddleGeo, puddleMat, Math.max(1, puddles.length)); pm.count = puddles.length; puddles.forEach(([x, z, sx, sz, ry], n) => { dummy.position.set(x, 0.015, z); dummy.rotation.set(0, ry, 0); dummy.scale.set(sx, 1, sz); dummy.updateMatrix(); pm.setMatrixAt(n, dummy.matrix); }); dummy.scale.set(1, 1, 1); pm.receiveShadow = false; scene.add(pm);

  // ---- realism dressing: wall skins, doors, windows, machinery, skyline -------------------------------------------------
  const detail = day ? (addDayDress(scene, { faces, R, map, CELL, WALL_H, P, track, W, D, look, def: map.def }), { update: () => {} }) : addDetail(scene, { faces, R, map, CELL, WALL_H, P, track, W, D, lamps });
  const blinkers = [];

  // ---- weather ---------------------------------------------------------------------------------------------------------------
  const RN = 5200; const rg = new THREE.BufferGeometry(); const rp = new Float32Array(RN * 6), rs = new Float32Array(RN * 8);
  for (let i = 0; i < RN; i++) { const x = (R() - 0.5), y = R(), z = (R() - 0.5), sp = 0.7 + R() * 0.6; for (let v = 0; v < 2; v++) { rp[i * 6 + v * 3] = x; rp[i * 6 + v * 3 + 1] = y; rp[i * 6 + v * 3 + 2] = z; rs[i * 8 + v * 4] = v; rs[i * 8 + v * 4 + 1] = sp; rs[i * 8 + v * 4 + 2] = R(); rs[i * 8 + v * 4 + 3] = R(); } }
  rg.setAttribute("position", new THREE.BufferAttribute(rp, 3)); rg.setAttribute("aSeed", new THREE.BufferAttribute(rs, 4));
  const rainMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uRoof: { value: roofTex }, uMap: { value: new THREE.Vector2(W, D) }, uColor: { value: new THREE.Color(0x9cb4d0) }, uAmt: { value: 0.7 } },
    vertexShader: `attribute vec4 aSeed; uniform float uTime; uniform vec3 uCenter; uniform sampler2D uRoof; uniform vec2 uMap; uniform float uAmt; varying float vA;
      void main(){ vec3 box = vec3(46.0, 14.0, 46.0); float sp = 24.0 * aSeed.y;
        float y = mod(position.y * box.y - uTime * sp, box.y); vec3 base = vec3(position.x * box.x, 0.0, position.z * box.z);
        vec3 w = uCenter + vec3(mod(base.x + uTime * 2.2 * aSeed.y + box.x * 0.5, box.x) - box.x * 0.5, 0.0, mod(base.z + box.z * 0.5, box.z) - box.z * 0.5);
        w.y = y; w.x += aSeed.x * 0.0; vec3 dir = normalize(vec3(2.2, -sp, 0.0)); w += dir * (-aSeed.x) * 0.9 * -1.0;
        vec2 ruv = clamp(w.xz / uMap, 0.0, 1.0); float roof = texture2D(uRoof, ruv).r; vA = (1.0 - roof) * uAmt * (0.25 + 0.4 * aSeed.z) * (1.0 - smoothstep(18.0, 23.0, length(w.xz - uCenter.xz)));
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
    fragmentShader: `uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor * vA, vA); }`,
  });
  const rain = new THREE.LineSegments(rg, rainMat); rain.frustumCulled = false; if (day) { rain.visible = false; rainMat.uniforms.uAmt.value = 0; } scene.add(rain);
  const mist = makeParticles({ count: day ? 40 : 260, area: 60, height: 3.4, rise: 0.04, drift: 2.0, size: 120, color: day ? 0xe8dcc0 : 0x4a6078, color2: day ? 0xfff0d8 : 0x7890a8, flicker: 0, additive: false, opacity: day ? 0.05 : 0.1, baseY: 0.2, wind: [1.0, 0.3] }); scene.add(mist);
  const motes = makeParticles({ count: day ? 160 : 240, area: 30, height: 5, rise: 0.08, drift: 0.6, size: day ? 10 : 16, color: day ? (look.dust ?? 0xfff0c8) : 0xffd8a0, color2: 0xffffff, flicker: day ? 0.15 : 0.5, baseY: 0.2 }); scene.add(motes);

  let flashV = 0, nextStrike = 5 + R() * 6, thunderAt = -1, lastT = 0;
  const camV = new THREE.Vector3();
  function update(dt, t, camPos, onThunder) {
    sky.userData.update(t, camPos); rainMat.uniforms.uTime.value = t; rainMat.uniforms.uCenter.value.set(camPos.x, 0, camPos.z); mist.userData.update(t, camPos); motes.userData.update(t, camPos);
    moon.target.position.set(camPos.x, 0, camPos.z); moon.position.set(camPos.x + moonOff.x, moonOff.y, camPos.z + moonOff.z); moon.target.updateMatrixWorld();
    // storm
    if (!day) { nextStrike -= dt; if (nextStrike <= 0) { flashV = 1; nextStrike = 7 + R() * 14; thunderAt = t + 0.5 + R() * 2.2; } }
    flashV = Math.max(0, flashV - dt * (flashV > 0.55 ? 5 : 2.4)); const fl = flashV * (0.5 + 0.5 * Math.sin(t * 60));
    sky.userData.uniforms.uFlash.value = Math.max(0, fl) * 0.75; hemi.intensity = HEMI0 + Math.max(0, fl) * 8; moon.intensity = SUN0 + Math.max(0, fl) * 12;
    if (thunderAt > 0 && t > thunderAt) { thunderAt = -1; if (onThunder) onThunder(); }
    // nearest lamps drive the real lights
    const near = [];
    for (const l of lamps) { const d = (l.x - camPos.x) ** 2 + (l.z - camPos.z) ** 2; if (d < 1400) near.push([d, l]); }
    near.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < POOL; i++) {
      const L = lampLights[i], e = near[i];
      if (!e) { L.intensity = 0; continue; } const l = e[1]; L.position.set(l.x, l.y - 0.3, l.z); L.color.setHex(l.color);
      const f = l.flicker ? 0.55 + 0.45 * Math.abs(Math.sin(t * 13 + l.phase)) * Math.sin(t * 3.1 + l.phase) ** 2 + 0.2 : 1; L.intensity = (day ? 120 : 260) * f;
    }
    for (const l of lamps) if (l.flicker) l.glow.material.opacity = 0.3 + 0.3 * Math.abs(Math.sin(t * 13 + l.phase));
    detail.update(t);
    blinkers.forEach((b, i) => { b.material.opacity = (Math.floor(t * 0.9 + i) % 2) ? 1 : 0.15; });
    propGroup.children.forEach((g) => g.children.forEach((m) => { if (m.userData.blink) m.visible = Math.floor(t * 1.5) % 2 === 0; }));
  }
  function dispose() { try { disposeEnvironment(envTex); } catch {} disposables.forEach((d) => { try { d.dispose && d.dispose(); } catch {} }); }
  return { update, hemi, moon, sky, rainMat, lamps, lampLights, dispose, setRain(v) { rainMat.uniforms.uAmt.value = v; }, getFlash: () => flashV };
}
