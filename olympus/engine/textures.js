// Wrath of Olympus — painted-on-the-fly textures (Upgrade 27). No image files: every surface (roof tiles, plaster, planks, marble, cloth,
// grass, dirt) is drawn once on a small canvas with a bit of noise and then reused, which gives the 3D models the weathered look of old
// strategy-game art instead of flat colours.
import * as THREE from "three";

const cache = {};
const rng = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
function canvas(w, h = w) { const c = document.createElement("canvas"); c.width = w; c.height = h; return [c, c.getContext("2d")]; }
function finish(c, rx = 1, ry = 1, srgb = true) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }
function speckle(g, w, h, r, n, a0, a1, light = 255, dark = 0) { for (let i = 0; i < n; i++) { const v = r() < 0.5 ? dark : light; g.fillStyle = `rgba(${v},${v},${v},${a0 + r() * (a1 - a0)})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1 + r() * 2); } }
const T = (key, make) => (cache[key] ||= make());

// clay roof tiles: rows of overlapping half-round tiles with colour variation and moss streaks
export const roofTiles = () => T("roof", () => {
  const [c, g] = canvas(256), r = rng(11); const rows = 8, cols = 8, th = 256 / rows, tw = 256 / cols;
  g.fillStyle = "#6b3326"; g.fillRect(0, 0, 256, 256);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols + 1; i++) {
    const x = i * tw + (j % 2 ? tw / 2 : 0) - tw / 2, y = j * th; const hue = 8 + r() * 10, l = 36 + r() * 14;
    const gr = g.createLinearGradient(x, y, x, y + th); gr.addColorStop(0, `hsl(${hue},48%,${l + 8}%)`); gr.addColorStop(0.7, `hsl(${hue},50%,${l}%)`); gr.addColorStop(1, `hsl(${hue},45%,${l - 14}%)`);
    g.fillStyle = gr; g.beginPath(); g.moveTo(x, y); g.lineTo(x + tw, y); g.lineTo(x + tw, y + th * 0.7); g.quadraticCurveTo(x + tw / 2, y + th * 1.15, x, y + th * 0.7); g.closePath(); g.fill();
    g.strokeStyle = "rgba(30,10,5,.55)"; g.lineWidth = 1.2; g.stroke();
  }
  for (let i = 0; i < 14; i++) { const x = r() * 256; const gr = g.createLinearGradient(x, 0, x, 256); gr.addColorStop(0, "rgba(70,90,50,0)"); gr.addColorStop(0.5, "rgba(70,90,50,.18)"); gr.addColorStop(1, "rgba(70,90,50,0)"); g.fillStyle = gr; g.fillRect(x, 0, 6 + r() * 10, 256); }
  speckle(g, 256, 256, r, 900, 0.05, 0.2);
  return finish(c, 1, 1);
});
// weathered plaster with stains and a few cracks
export const plaster = (tone = "#e6dcc4") => T("plaster" + tone, () => {
  const [c, g] = canvas(256), r = rng(23); g.fillStyle = tone; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) { const x = r() * 256, y = r() * 256, rad = 20 + r() * 50; const gr = g.createRadialGradient(x, y, 0, x, y, rad); const d = r() < 0.5; gr.addColorStop(0, d ? "rgba(90,70,40,.12)" : "rgba(255,255,255,.1)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  const gr2 = g.createLinearGradient(0, 180, 0, 256); gr2.addColorStop(0, "rgba(70,55,35,0)"); gr2.addColorStop(1, "rgba(70,55,35,.35)"); g.fillStyle = gr2; g.fillRect(0, 180, 256, 76); // grime near the ground
  g.strokeStyle = "rgba(60,45,30,.35)"; g.lineWidth = 1; for (let i = 0; i < 6; i++) { let x = r() * 256, y = r() * 256; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 18; y += r() * 14; g.lineTo(x, y); } g.stroke(); }
  speckle(g, 256, 256, r, 1600, 0.04, 0.14);
  return finish(c, 1, 1);
});
// wooden planks / timber beams
export const planks = (base = 0x7a5530) => T("planks" + base, () => {
  const [c, g] = canvas(256), r = rng(37); const col = new THREE.Color(base);
  const n = 8, h = 256 / n; for (let j = 0; j < n; j++) { const l = 0.85 + r() * 0.3; g.fillStyle = `rgb(${Math.min(255, col.r * 255 * l) | 0},${Math.min(255, col.g * 255 * l) | 0},${Math.min(255, col.b * 255 * l) | 0})`; g.fillRect(0, j * h, 256, h);
    g.strokeStyle = "rgba(20,10,0,.55)"; g.lineWidth = 2; g.beginPath(); g.moveTo(0, j * h); g.lineTo(256, j * h); g.stroke();
    g.strokeStyle = "rgba(30,15,0,.22)"; g.lineWidth = 1; for (let k = 0; k < 9; k++) { const y = j * h + 2 + r() * (h - 4); g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + (r() - 0.5) * 4, 170, y + (r() - 0.5) * 4, 256, y); g.stroke(); } }
  speckle(g, 256, 256, r, 500, 0.05, 0.15);
  return finish(c, 1, 1);
});
// cut stone blocks (courses with offset joints)
export const stoneBlocks = (tone = "#cfc4aa") => T("blocks" + tone, () => {
  const [c, g] = canvas(256), r = rng(51); g.fillStyle = "#6a6154"; g.fillRect(0, 0, 256, 256);
  const rows = 6, rh = 256 / rows; const base = new THREE.Color(tone);
  for (let j = 0; j < rows; j++) { let x = -((j % 2) * 30); while (x < 256) { const w = 50 + r() * 40, l = 0.88 + r() * 0.22; g.fillStyle = `rgb(${Math.min(255, base.r * 255 * l) | 0},${Math.min(255, base.g * 255 * l) | 0},${Math.min(255, base.b * 255 * l) | 0})`; g.fillRect(x + 1.5, j * rh + 1.5, w - 3, rh - 3); x += w; } }
  speckle(g, 256, 256, r, 1500, 0.05, 0.16);
  return finish(c, 1, 1);
});
// veined marble
export const marbleTex = () => T("marble", () => {
  const [c, g] = canvas(256), r = rng(63); g.fillStyle = "#f0ebe0"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(120,115,110,${0.08 + r() * 0.16})`; g.lineWidth = 0.6 + r() * 1.4; let x = r() * 256, y = 0; g.beginPath(); g.moveTo(x, y); while (y < 256) { x += (r() - 0.5) * 22; y += 10 + r() * 16; g.lineTo(x, y); } g.stroke(); }
  speckle(g, 256, 256, r, 600, 0.03, 0.1);
  return finish(c, 1, 1);
});
// woven cloth in a given colour (small herringbone-like weave)
export const cloth = (hex) => T("cloth" + hex, () => {
  const [c, g] = canvas(64), r = rng(77); const col = new THREE.Color(hex); g.fillStyle = `#${col.getHexString()}`; g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 2) { g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`; g.fillRect(0, y, 64, 1); } for (let x = 0; x < 64; x += 2) { g.fillStyle = `rgba(255,255,255,${0.03 + r() * 0.05})`; g.fillRect(x, 0, 1, 64); }
  return finish(c, 2, 2);
});
// grass / dirt ground detail, tiled over the whole map (greyish so the vertex colours still tint it)
export const groundDetail = () => T("ground", () => {
  const [c, g] = canvas(256), r = rng(91); g.fillStyle = "#b8b8b8"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { const v = 150 + r() * 100 | 0; g.fillStyle = `rgba(${v},${v},${v},${0.1 + r() * 0.25})`; const x = r() * 256, y = r() * 256; g.beginPath(); g.ellipse(x, y, 1 + r() * 5, 0.6 + r() * 2, r() * 3, 0, 6.3); g.fill(); }
  g.strokeStyle = "rgba(70,70,70,.28)"; g.lineWidth = 1; for (let i = 0; i < 1800; i++) { const x = r() * 256, y = r() * 256, l = 2 + r() * 4, a = -1.5 + (r() - 0.5) * 0.9; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  g.strokeStyle = "rgba(255,255,255,.2)"; for (let i = 0; i < 900; i++) { const x = r() * 256, y = r() * 256, l = 2 + r() * 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 2, y - l); g.stroke(); }
  return finish(c, 1, 1);
});
// a soft round shield face with rim, boss and a painted device
export const shieldFace = (hex, device = "ring") => T("shield" + hex + device, () => {
  const [c, g] = canvas(128), col = new THREE.Color(hex), css = `#${col.getHexString()}`; g.fillStyle = "#4a3a22"; g.fillRect(0, 0, 128, 128);
  const gr = g.createRadialGradient(64, 56, 4, 64, 64, 62); gr.addColorStop(0, css); gr.addColorStop(1, `#${col.clone().multiplyScalar(0.55).getHexString()}`); g.fillStyle = gr; g.beginPath(); g.arc(64, 64, 62, 0, 6.3); g.fill();
  g.strokeStyle = "#e8c36a"; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 56, 0, 6.3); g.stroke(); g.lineWidth = 2; g.beginPath(); g.arc(64, 64, 44, 0, 6.3); g.stroke();
  g.fillStyle = "#f2d27a"; if (device === "star") { g.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.283 - 1.57, rr = i % 2 ? 12 : 30; g.lineTo(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr); } g.closePath(); g.fill(); }
  else if (device === "lambda") { g.lineWidth = 9; g.strokeStyle = "#f2d27a"; g.beginPath(); g.moveTo(40, 94); g.lineTo(64, 34); g.lineTo(88, 94); g.moveTo(52, 66); g.lineTo(76, 66); g.stroke(); }
  else { g.beginPath(); g.arc(64, 64, 14, 0, 6.3); g.fill(); }
  return finish(c, 1, 1);
});
// a fine fabric-like bump isn't needed; this returns small roughness variation for metal
export const metalWear = () => T("metal", () => {
  const [c, g] = canvas(128), r = rng(5); g.fillStyle = "#9a9a9a"; g.fillRect(0, 0, 128, 128); speckle(g, 128, 128, r, 800, 0.1, 0.4); for (let i = 0; i < 30; i++) { g.strokeStyle = `rgba(255,255,255,${0.05 + r() * 0.12})`; g.beginPath(); const x = r() * 128, y = r() * 128; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 6); g.stroke(); }
  return finish(c, 1, 1, false);
});
