// Operation Blacksite — realism dressing for the map: brick and plaster wall skins with mortar, stains and peeling paint, steel doors,
// barred windows, roller shutters, air-con units, electrical boxes with conduit, fire extinguisher stations, drain pipes, cable trays,
// wall cages lamps, stencilled numbers, and a proper skyline of towers with setbacks, water tanks and window grids.
import * as THREE from "three";
import { makeGlow } from "@/lib/cinematic/atmos";
import { cpuCanvas } from "./cpucanvas";

const cv = (w, h) => cpuCanvas(w, h);
const rnd = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const mkTex = (c, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };

// height -> normal map (cheap sobel)
function normalFrom(hc, strength = 2.5) {
  const w = hc.width, h = hc.height, src = hc.getContext("2d").getImageData(0, 0, w, h).data, out = cv(w, h), og = out.getContext("2d"), im = og.createImageData(w, h), d = im.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength; const l = Math.hypot(dx, dy, 1); const i = (y * w + x) * 4; d[i] = (-dx / l * 0.5 + 0.5) * 255; d[i + 1] = (dy / l * 0.5 + 0.5) * 255; d[i + 2] = (1 / l * 0.5 + 0.5) * 255; d[i + 3] = 255; }
  og.putImageData(im, 0, 0); return mkTex(out, false);
}

// a 4 m x 4 m wall panel of brick with mortar; returns {map, normalMap, roughnessMap}
function brickSurface(seed, palette, bw = 32, bh = 10.67, mortar = "#7c7a74") {
  const S = 512, c = cv(S, S), g = c.getContext("2d"), r = rnd(seed), hc = cv(S, S), hg = hc.getContext("2d");
  g.fillStyle = mortar; g.fillRect(0, 0, S, S); hg.fillStyle = "#222"; hg.fillRect(0, 0, S, S);
  const rows = Math.round(S / bh), per = Math.round(S / bw); bh = S / rows; // real-size bricks: about 25 x 8 cm, so a 4 m panel holds 48 courses
  for (let j = 0; j < rows; j++) for (let i = -1; i <= per; i++) {
    const off = (j % 2) * bw * 0.5, x = i * bw + off + 0.9, y = j * bh + 0.9, w = bw - 1.8, h = bh - 1.8; const col = palette[(r() * palette.length) | 0]; const v = 0.82 + r() * 0.3;
    g.fillStyle = col; g.fillRect(x, y, w, h); g.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,240,220"},${r() * 0.2})`; g.fillRect(x, y, w, h);
    g.globalAlpha = 0.25 * v; for (let k = 0; k < 12; k++) { g.fillStyle = r() < 0.5 ? "#000" : "#fff"; g.fillRect(x + r() * w, y + r() * h, 1 + r() * 2, 1); } g.globalAlpha = 1;
    const hv = 150 + r() * 80 | 0; hg.fillStyle = `rgb(${hv},${hv},${hv})`; hg.fillRect(x, y, w, h);
  }
  // slow patches where whole stretches of wall are darker or paler (different batches, damp, repairs)
  for (let i = 0; i < 26; i++) { const x = r() * S, y = r() * S, rad = 30 + r() * 90; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, r() < 0.55 ? "rgba(18,14,12,0.2)" : "rgba(210,190,170,0.13)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  // weathering: soot streaks and efflorescence
  for (let i = 0; i < 40; i++) { const x = r() * S, w = 4 + r() * 18, len = 60 + r() * 320, grd = g.createLinearGradient(0, 0, 0, len); grd.addColorStop(0, "rgba(10,10,10,0.35)"); grd.addColorStop(1, "rgba(10,10,10,0)"); g.save(); g.translate(x, r() * S * 0.4); g.fillStyle = grd; g.fillRect(0, 0, w, len); g.restore(); }
  return { map: mkTex(c), normalMap: normalFrom(hc, 3.2), rough: null };
}
function plasterSurface(seed, base) {
  const S = 512, c = cv(S, S), g = c.getContext("2d"), r = rnd(seed), hc = cv(S, S), hg = hc.getContext("2d");
  g.fillStyle = base; g.fillRect(0, 0, S, S); hg.fillStyle = "#808080"; hg.fillRect(0, 0, S, S);
  const im = g.getImageData(0, 0, S, S), d = im.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 26; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(im, 0, 0);
  for (let i = 0; i < 120; i++) { const x = r() * S, y = r() * S, rad = 6 + r() * 38; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${r() < 0.5 ? "20,18,14" : "230,226,214"},${0.08 + r() * 0.14})`); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  // peeling patches reveal brick/concrete below
  for (let k = 0; k < 7; k++) { const x = r() * S, y = r() * S, w = 30 + r() * 90, h = 20 + r() * 80; g.fillStyle = r() < 0.5 ? "#6a5a4c" : "#555a5e"; g.beginPath(); g.moveTo(x, y); for (let q = 0; q < 8; q++) { const a = (q / 8) * 6.28; g.lineTo(x + Math.cos(a) * w * (0.5 + r() * 0.5), y + Math.sin(a) * h * (0.5 + r() * 0.5)); } g.fill(); hg.fillStyle = "#303030"; hg.beginPath(); hg.arc(x, y, Math.max(w, h) * 0.45, 0, 7); hg.fill(); }
  for (let i = 0; i < 30; i++) { const x = r() * S, w = 3 + r() * 10, len = 80 + r() * 300, gr = g.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, "rgba(20,20,16,0.3)"); gr.addColorStop(1, "rgba(20,20,16,0)"); g.save(); g.translate(x, r() * S * 0.3); g.fillStyle = gr; g.fillRect(0, 0, w, len); g.restore(); }
  // hairline cracks
  g.strokeStyle = "rgba(20,18,16,0.5)"; g.lineWidth = 1; for (let i = 0; i < 8; i++) { let x = r() * S, y = r() * S; g.beginPath(); g.moveTo(x, y); for (let q = 0; q < 14; q++) { x += (r() - 0.5) * 24; y += r() * 18; g.lineTo(x, y); } g.stroke(); }
  return { map: mkTex(c), normalMap: normalFrom(hc, 1.6) };
}

function doorTex(seed, tint) {
  const c = cv(256, 512), g = c.getContext("2d"), r = rnd(seed); g.fillStyle = tint; g.fillRect(0, 0, 256, 512);
  const im = g.getImageData(0, 0, 256, 512), d = im.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 20; d[i] += n; d[i + 1] += n; d[i + 2] += n; } g.putImageData(im, 0, 0);
  g.strokeStyle = "rgba(0,0,0,0.45)"; g.lineWidth = 6; g.strokeRect(22, 30, 212, 200); g.strokeRect(22, 270, 212, 212); g.strokeStyle = "rgba(255,255,255,0.1)"; g.lineWidth = 2; g.strokeRect(26, 34, 204, 192); g.strokeRect(26, 274, 204, 204);
  for (let i = 0; i < 18; i++) { const x = r() * 256, y = 300 + r() * 212, gr = g.createLinearGradient(0, y, 0, y + 100); gr.addColorStop(0, "rgba(90,40,10,0.5)"); gr.addColorStop(1, "rgba(90,40,10,0)"); g.fillStyle = gr; g.fillRect(x, y, 3 + r() * 5, 100); } // rust runs
  g.fillStyle = "rgba(255,255,255,0.6)"; g.font = "bold 26px monospace"; g.textAlign = "center"; g.fillText(["B-04", "C-12", "E-07", "D-21", "A-02"][seed % 5], 128, 64);
  return mkTex(c);
}
function winTex(seed) {
  const c = cv(256, 256), g = c.getContext("2d"), r = rnd(seed); const gr = g.createLinearGradient(0, 0, 256, 256); gr.addColorStop(0, "#0d1620"); gr.addColorStop(0.5, "#1c2c3a"); gr.addColorStop(1, "#0a1118"); g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.globalAlpha = 0.5; g.fillStyle = "#9ab8d0"; g.beginPath(); g.moveTo(0, 40); g.lineTo(90, 0); g.lineTo(130, 0); g.lineTo(0, 100); g.fill(); g.globalAlpha = 1;
  for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(200,220,240,${r() * 0.08})`; g.fillRect(r() * 256, r() * 256, r() * 40, 1); }
  if (seed % 3 === 0) { g.fillStyle = "rgba(255,190,100,0.22)"; g.fillRect(0, 0, 256, 256); } // someone left a light on
  return mkTex(c);
}
function shutterTex() {
  const c = cv(128, 256), g = c.getContext("2d"), r = rnd(5); for (let y = 0; y < 256; y += 8) { const gr = g.createLinearGradient(0, y, 0, y + 8); gr.addColorStop(0, "#8e9296"); gr.addColorStop(0.5, "#c0c4c8"); gr.addColorStop(1, "#5e6266"); g.fillStyle = gr; g.fillRect(0, y, 128, 8); }
  g.globalAlpha = 0.5; for (let i = 0; i < 16; i++) { const x = r() * 128, gr = g.createLinearGradient(0, 0, 0, 220); gr.addColorStop(0, "rgba(80,40,10,0.7)"); gr.addColorStop(1, "rgba(80,40,10,0)"); g.fillStyle = gr; g.fillRect(x, r() * 40, 2 + r() * 5, 120 + r() * 100); } g.globalAlpha = 1;
  g.fillStyle = "rgba(255,80,40,0.7)"; g.font = "bold 18px monospace"; g.textAlign = "center"; g.save(); g.translate(64, 150); g.rotate(-0.12); g.fillText("CLOSED", 0, 0); g.restore();
  return mkTex(c);
}
function stencilTex(txt, col) { const c = cv(256, 128), g = c.getContext("2d"); g.clearRect(0, 0, 256, 128); g.fillStyle = col; g.font = "bold 92px Impact, 'Arial Black', sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(txt, 128, 70); g.globalCompositeOperation = "destination-out"; const r = rnd(txt.length * 5 + 1); for (let i = 0; i < 700; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.9})`; g.fillRect(r() * 256, r() * 128, 1 + r() * 3, 1 + r() * 3); } const t = mkTex(c); return t; }

function towerWindows(seed, lit) {
  const c = cv(256, 512), g = c.getContext("2d"), r = rnd(seed); g.fillStyle = "#000"; g.fillRect(0, 0, 256, 512);
  const cw = 16, ch = 16; for (let y = 4; y < 512; y += ch) for (let x = 4; x < 256; x += cw) { if (r() < lit) { const warm = r() < 0.7; const v = 0.35 + r() * 0.65; g.fillStyle = warm ? `rgba(255,${190 + (r() * 40) | 0},${110 + (r() * 60) | 0},${v})` : `rgba(170,210,255,${v})`; g.fillRect(x, y, cw - 6, ch - 6); } }
  return mkTex(c);
}

export function addDetail(scene, ctx) {
  const { faces, R, map, CELL, WALL_H, P, track, W, D, lamps } = ctx; const out = { update: () => {} };
  const dummy = new THREE.Object3D(); const inst = (geo, material, list, fn, shadow = false) => {
    if (!list.length) return null; const im = new THREE.InstancedMesh(geo, material, list.length); const col = new THREE.Color();
    list.forEach((f, n) => { const c = fn(f, n); dummy.position.copy(c.pos); dummy.rotation.set(c.rx || 0, Math.atan2(f.nx, f.nz) + (c.ry || 0), c.rz || 0); dummy.scale.set(c.sx || 1, c.sy || 1, c.sz || 1); dummy.updateMatrix(); im.setMatrixAt(n, dummy.matrix); if (c.color !== undefined) { col.setHex(c.color); im.setColorAt(n, col); } });
    im.castShadow = shadow; im.receiveShadow = true; scene.add(im); return im;
  };
  const std = (o) => track(new THREE.MeshStandardMaterial(o));
  const zid = (f) => (f.zone ? f.zone.id : "");

  // ---- wall skins: brick, stucco, painted block; one full-height sheet per face -----------------------------------
  const skins = [
    { s: brickSurface(11, ["#643a2f", "#6c4234", "#58352c", "#744c3c", "#603c32"]), w: 0.4 }, { s: brickSurface(12, ["#4e4a46", "#5a5650", "#423e3a", "#605a54"], 32, 10.67, "#6a6862"), w: 0.12 },
    { s: plasterSurface(21, "#8a8a82"), w: 0.2 }, { s: plasterSurface(22, "#9a8e74"), w: 0.12 }, { s: plasterSurface(23, "#5e7a78"), w: 0.08 }, { s: plasterSurface(24, "#7a4a40"), w: 0.08 },
  ];
  const skinGeo = new THREE.PlaneGeometry(CELL, WALL_H - 0.9); const wallGroups = skins.map(() => []);
  for (const f of faces) { let x = R(), k = 0; for (; k < skins.length - 1; k++) { x -= skins[k].w; if (x < 0) break; } if (R() < 0.82) { f.skin = k; wallGroups[k].push(f); } }
  skins.forEach((sk, k) => {
    sk.s.map.repeat.set(CELL / 4, (WALL_H - 0.9) / 4); sk.s.normalMap.repeat.copy(sk.s.map.repeat);
    const m = std({ map: sk.s.map, normalMap: sk.s.normalMap, normalScale: new THREE.Vector2(0.9, 0.9), roughness: 0.92, metalness: 0.0, color: 0xc4c4c4, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    inst(skinGeo, m, wallGroups[k], (f) => ({ pos: P(f, 0.55 + (WALL_H - 0.9) / 2, 0.02), color: (() => { const v = 150 + ((R() * 90) | 0); return (v << 16) | (v << 8) | v; })() }));
  });

  // ---- steel doors with frames, exit signs; barred windows; roller shutters ----------------------------------------
  const doorF = faces.filter((f, n) => R() < 0.1 && f.skin !== undefined && f.zone); const doorTexes = [0, 1, 2, 3].map((i) => doorTex(i, ["#3a4a56", "#4a3a34", "#394a3e", "#5a5e62"][i]));
  const doorGeo = new THREE.BoxGeometry(1.5, 2.8, 0.1); const frameG = new THREE.BoxGeometry(1.76, 3.0, 0.18); const frameMat = std({ color: 0x1e2226, roughness: 0.55, metalness: 0.6 });
  inst(frameG, frameMat, doorF, (f) => ({ pos: P(f, 1.5, 0.25) }), true);
  doorTexes.forEach((t, i) => { const m = std({ map: t, roughness: 0.55, metalness: 0.55 }); inst(doorGeo, m, doorF.filter((_, n) => n % 4 === i), (f) => ({ pos: P(f, 1.5 - 0.04, 0.3) }), true); });
  const handleG = new THREE.BoxGeometry(0.16, 0.05, 0.08); const handleMat = std({ color: 0xb0b4b8, roughness: 0.3, metalness: 1 });
  inst(handleG, handleMat, doorF, (f) => { const o = new THREE.Vector3(Math.cos(Math.atan2(f.nx, f.nz)), 0, -Math.sin(Math.atan2(f.nx, f.nz))); return { pos: P(f, 1.45, 0.38).addScaledVector(o, 0.55) }; });
  const exitMat = new THREE.MeshBasicMaterial({ color: 0x3cff90, toneMapped: false }); track(exitMat);
  inst(new THREE.BoxGeometry(0.5, 0.17, 0.06), exitMat, doorF.filter((_, n) => n % 2 === 0), (f) => ({ pos: P(f, 3.25, 0.3) }));
  doorF.filter((_, n) => n % 2 === 0).forEach((f) => { const gl = makeGlow(0x3cff90, 1.6, 0.4); gl.position.copy(P(f, 3.25, 0.5)); scene.add(gl); });

  const winF = faces.filter((f) => R() < 0.15 && f.skin !== undefined && !doorF.includes(f));
  const winTexes = [0, 1, 2, 3, 4].map((i) => winTex(i)); const glassGeo = new THREE.PlaneGeometry(1.5, 1.3);
  winTexes.forEach((t, i) => { const m = std({ map: t, roughness: 0.08, metalness: 0.85, envMapIntensity: 1.8, emissive: i % 3 === 0 ? 0x5a3a18 : 0x000000, emissiveMap: i % 3 === 0 ? t : null, emissiveIntensity: 0.5 }); inst(glassGeo, m, winF.filter((_, n) => n % 5 === i), (f) => ({ pos: P(f, 2.5, 0.31) })); });
  const barMat = std({ color: 0x15181b, roughness: 0.6, metalness: 0.7 });
  inst(new THREE.BoxGeometry(1.7, 0.1, 0.1), barMat, winF, (f) => ({ pos: P(f, 1.83, 0.34) })); inst(new THREE.BoxGeometry(1.7, 0.1, 0.1), barMat, winF, (f) => ({ pos: P(f, 3.17, 0.34) }));
  inst(new THREE.BoxGeometry(0.1, 1.4, 0.1), barMat, winF, (f) => { const a = Math.atan2(f.nx, f.nz), o = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)); return { pos: P(f, 2.5, 0.34).addScaledVector(o, -0.8) }; });
  inst(new THREE.BoxGeometry(0.1, 1.4, 0.1), barMat, winF, (f) => { const a = Math.atan2(f.nx, f.nz), o = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)); return { pos: P(f, 2.5, 0.34).addScaledVector(o, 0.8) }; });
  inst(new THREE.BoxGeometry(0.06, 1.3, 0.06), barMat, winF, (f) => ({ pos: P(f, 2.5, 0.35) }));
  inst(new THREE.BoxGeometry(1.9, 0.12, 0.28), frameMat, winF, (f) => ({ pos: P(f, 1.76, 0.36) }), true); // sill

  const shF = faces.filter((f) => R() < 0.055 && f.skin !== undefined && !doorF.includes(f) && !winF.includes(f));
  const shT = shutterTex(); shT.repeat.set(1, 1); inst(new THREE.PlaneGeometry(3.4, 3.2), std({ map: shT, roughness: 0.5, metalness: 0.8 }), shF, (f) => ({ pos: P(f, 1.6, 0.31) }));
  inst(new THREE.BoxGeometry(3.7, 0.32, 0.34), frameMat, shF, (f) => ({ pos: P(f, 3.3, 0.36) }), true); inst(new THREE.BoxGeometry(0.14, 3.3, 0.2), frameMat, shF, (f) => { const a = Math.atan2(f.nx, f.nz), o = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)); return { pos: P(f, 1.65, 0.31).addScaledVector(o, 1.75) }; });

  // ---- machinery on the walls: AC units, electrical panels with conduit, extinguishers, drain pipes, cable trays ------
  const busy = new Set([...doorF, ...winF, ...shF]); const free = () => faces.filter((f) => !busy.has(f));
  const acF = free().filter(() => R() < 0.07); acF.forEach((f) => busy.add(f));
  const acBody = std({ color: 0xa8acaf, roughness: 0.7, metalness: 0.25 }); const grill = std({ color: 0x0f1113, roughness: 0.5, metalness: 0.6 });
  inst(new THREE.BoxGeometry(1.0, 0.7, 0.45), acBody, acF, (f) => ({ pos: P(f, 3.0, 0.4), color: [0xc0c4c6, 0x9a9ea0, 0xb0aca0][(R() * 3) | 0] }), true); inst(new THREE.CircleGeometry(0.27, 14), grill, acF, (f) => ({ pos: P(f, 3.0, 0.632) }));
  inst(new THREE.CylinderGeometry(0.018, 0.018, 1.4, 6), frameMat, acF, (f) => ({ pos: P(f, 2.4, 0.35) }));
  const elF = free().filter(() => R() < 0.1); elF.forEach((f) => busy.add(f));
  inst(new THREE.BoxGeometry(0.7, 0.9, 0.2), std({ color: 0x5c6a62, roughness: 0.45, metalness: 0.55 }), elF, (f) => ({ pos: P(f, 1.7, 0.27), color: [0x7a8a82, 0x8a9096, 0x6a7a72][(R() * 3) | 0] }), true);
  inst(new THREE.BoxGeometry(0.62, 0.8, 0.02), std({ color: 0x23282c, roughness: 0.6, metalness: 0.4 }), elF, (f) => ({ pos: P(f, 1.7, 0.375) }));
  inst(new THREE.BoxGeometry(0.06, 0.06, 0.02), new THREE.MeshBasicMaterial({ color: 0xff4a30, toneMapped: false }), elF, (f) => ({ pos: P(f, 1.95, 0.385) }));
  inst(new THREE.BoxGeometry(0.06, 0.06, 0.02), new THREE.MeshBasicMaterial({ color: 0x40ff80, toneMapped: false }), elF.filter((_, n) => n % 2), (f) => { const a = Math.atan2(f.nx, f.nz), o = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)); return { pos: P(f, 1.95, 0.385).addScaledVector(o, 0.12) }; });
  inst(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 8), std({ color: 0x5a5f66, roughness: 0.4, metalness: 0.8 }), elF, (f) => ({ pos: P(f, 3.7, 0.27) })); // conduit going up
  inst(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 8), std({ color: 0x5a5f66, roughness: 0.4, metalness: 0.8 }), elF, (f) => ({ pos: P(f, 0.6, 0.27) }));
  const feF = free().filter(() => R() < 0.09); feF.forEach((f) => busy.add(f)); const red = std({ color: 0xb01c14, roughness: 0.3, metalness: 0.45 });
  inst(new THREE.CylinderGeometry(0.075, 0.075, 0.5, 12), red, feF, (f) => ({ pos: P(f, 1.1, 0.26) }), true); inst(new THREE.SphereGeometry(0.075, 10, 6), red, feF, (f) => ({ pos: P(f, 1.37, 0.26) }));
  inst(new THREE.BoxGeometry(0.04, 0.12, 0.05), frameMat, feF, (f) => ({ pos: P(f, 1.42, 0.3) })); inst(new THREE.PlaneGeometry(0.4, 0.4), std({ color: 0xc02018, roughness: 0.6 }), feF, (f) => ({ pos: P(f, 1.65, 0.22) }));
  inst(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ map: (() => { const c = cv(64, 64), g = c.getContext("2d"); g.fillStyle = "#e2e2e2"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#c01810"; g.fillRect(4, 4, 56, 56); g.fillStyle = "#fff"; g.fillRect(28, 12, 8, 40); g.fillRect(14, 28, 36, 8); return mkTex(c); })(), toneMapped: false }), feF, (f) => ({ pos: P(f, 1.65, 0.226) }));
  const drF = free().filter(() => R() < 0.12); const drainMat = std({ color: 0x3a3f44, roughness: 0.55, metalness: 0.7 });
  inst(new THREE.CylinderGeometry(0.06, 0.06, WALL_H - 0.4, 10), drainMat, drF, (f) => { const a = Math.atan2(f.nx, f.nz), o = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)); return { pos: P(f, (WALL_H - 0.4) / 2 + 0.2, 0.3).addScaledVector(o, (R() - 0.5) * 3) }; }, true);
  inst(new THREE.TorusGeometry(0.1, 0.02, 6, 12), drainMat, drF, (f) => ({ pos: P(f, 1.5, 0.3), rx: Math.PI / 2 }));
  const trayF = faces.filter((f) => R() < 0.28 && (zid(f) === "tunnel" || zid(f) === "mid" || R() < 0.5)); const trayMat = std({ color: 0x3a4046, roughness: 0.5, metalness: 0.8 });
  inst(new THREE.BoxGeometry(CELL, 0.06, 0.34), trayMat, trayF, (f) => ({ pos: P(f, WALL_H - 1.2, 0.42) }));
  inst(new THREE.BoxGeometry(CELL, 0.18, 0.05), trayMat, trayF, (f) => ({ pos: P(f, WALL_H - 1.12, 0.57) })); inst(new THREE.CylinderGeometry(0.035, 0.035, CELL * 0.98, 6), std({ color: 0x111111, roughness: 0.7 }), trayF, (f) => { const a = Math.atan2(f.nx, f.nz); return { pos: P(f, WALL_H - 1.15, 0.42), ry: Math.PI / 2, rz: Math.PI / 2 }; });

  // ---- stencilled numbers & arrows on lower walls, wall-mounted cage lights ------------------------------------------
  const nums = ["07", "12", "A4", "B2", "C9", "03", "15", "21"]; const nF = free().filter(() => R() < 0.08);
  nums.forEach((t, i) => { const m = new THREE.MeshBasicMaterial({ map: stencilTex(t, ["#e8d060", "#e8e8e8", "#e86a30"][i % 3]), transparent: true, depthWrite: false, opacity: 0.8, polygonOffset: true, polygonOffsetFactor: -3 }); track(m); inst(new THREE.PlaneGeometry(1.4, 0.7), m, nF.filter((_, n) => n % nums.length === i), (f) => ({ pos: P(f, 1.4 + R() * 0.6, 0.175) })); });
  const cageF = faces.filter((f) => f.zone && R() < 0.1); const cageMat = new THREE.MeshBasicMaterial({ color: 0xffe2a8, toneMapped: false }); track(cageMat); const cageFrame = std({ color: 0x15181b, roughness: 0.5, metalness: 0.7 });
  inst(new THREE.SphereGeometry(0.1, 10, 8), cageMat, cageF, (f) => ({ pos: P(f, 3.2, 0.42) })); inst(new THREE.CylinderGeometry(0.15, 0.15, 0.32, 8, 1, true), cageFrame, cageF, (f) => ({ pos: P(f, 3.2, 0.42) }));
  inst(new THREE.BoxGeometry(0.1, 0.1, 0.25), cageFrame, cageF, (f) => ({ pos: P(f, 3.2, 0.3) }));
  cageF.forEach((f) => { const gl = makeGlow(0xffe2a8, 2.2, 0.35); gl.position.copy(P(f, 3.2, 0.6)); scene.add(gl); });

  // ---- skyline: towers with setbacks, window grids, water tanks, antennas ---------------------------------------------------
  const winSets = [0, 1, 2].map((i) => towerWindows(60 + i, 0.25 + i * 0.12)); const bodyMats = winSets.map((wt, i) => std({ color: [0x161a20, 0x1c2026, 0x111418][i], roughness: 0.55, metalness: 0.35, emissive: 0xffffff, emissiveMap: wt, emissiveIntensity: 0.9, envMapIntensity: 1.2 }));
  const roofM = std({ color: 0x0c0e11, roughness: 0.9 }); const tankM = std({ color: 0x2a2e34, roughness: 0.6, metalness: 0.5 }); const beacon = []; const rr = rnd(909);
  const cx = W / 2, cz = D / 2;
  for (let n = 0; n < 54; n++) {
    const ang = (n / 54) * Math.PI * 2 + rr() * 0.07, rad = 118 + rr() * 78; const px = cx + Math.cos(ang) * rad * 1.22, pz = cz + Math.sin(ang) * rad; let w = 14 + rr() * 22, d = 14 + rr() * 20; let h = 22 + rr() * 56, y = 0; const mi = (rr() * 3) | 0; const tiers = 1 + ((rr() * 3) | 0);
    for (let t = 0; t < tiers; t++) {
      const bh = t === 0 ? h * 0.62 : h * 0.22; const g = new THREE.BoxGeometry(w, bh, d); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 20), uv.getY(i) * (bh / 28));
      const me = new THREE.Mesh(g, bodyMats[mi]); me.position.set(px, y + bh / 2 - 2, pz); me.rotation.y = ang + Math.PI / 2; scene.add(me); track(g);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.8, d + 0.6), roofM); cap.position.set(px, y + bh - 1.6, pz); cap.rotation.y = me.rotation.y; scene.add(cap);
      y += bh; w *= 0.72; d *= 0.72;
    }
    if (rr() < 0.55) { const tk = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 3, 10), tankM); tk.position.set(px + 2, y - 0.5, pz); scene.add(tk); const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 6), tankM); lg.position.set(px + 2, y - 2.3, pz); scene.add(lg); }
    if (rr() < 0.6) { const an = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.35, 16, 6), tankM); an.position.set(px - 2, y + 7, pz); scene.add(an); const gl = makeGlow(0xff2a1a, 4, 1); gl.position.set(px - 2, y + 15.5, pz); scene.add(gl); beacon.push(gl); }
  }
  out.update = (t) => { beacon.forEach((b, i) => { b.material.opacity = 0.35 + 0.65 * Math.max(0, Math.sin(t * 1.8 + i * 1.7)); }); };
  return out;
}
