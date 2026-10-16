// Midnight Burn — every texture is drawn in code: windows, roads with lane paint, glows, labels.
import * as THREE from "three";
import { mulberry } from "./geo";

const cv = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true, repeat = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } t.anisotropy = 4; return t; };

export function glowTexture() {
  const c = cv(128, 128), g = c.getContext("2d"); const gr = g.createRadialGradient(64, 64, 1, 64, 64, 64);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,0.55)"); gr.addColorStop(0.6, "rgba(255,255,255,0.12)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return tex(c, true, false);
}
export function ringTexture() {
  const c = cv(256, 256), g = c.getContext("2d"); const gr = g.createRadialGradient(128, 128, 70, 128, 128, 126);
  gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.55, "rgba(255,255,255,0.25)"); gr.addColorStop(0.82, "rgba(255,255,255,0.95)"); gr.addColorStop(0.9, "rgba(255,255,255,0.3)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return tex(c, true, false);
}
export function beamTexture() { // vertical fade for light columns
  const c = cv(16, 128), g = c.getContext("2d"); const gr = g.createLinearGradient(0, 128, 0, 0);
  gr.addColorStop(0, "rgba(255,255,255,0.95)"); gr.addColorStop(0.5, "rgba(255,255,255,0.35)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 16, 128); return tex(c, true, false);
}

// ---- building facades: a colour map and a matching emissive "lights on" map ----------------------------------------------
// kind: res (rows of windows), office (glass bands), ind (corrugated with a few windows)
export function facadeTextures(kind, seed = 3) {
  const S = 256, rnd = mulberry(seed * 13 + kind.length), col = cv(S, S), em = cv(S, S), a = col.getContext("2d"), b = em.getContext("2d");
  a.fillStyle = "#d8d4cc"; a.fillRect(0, 0, S, S); b.fillStyle = "#000"; b.fillRect(0, 0, S, S);
  const warm = ["#ffd89a", "#ffc46b", "#fff0c8", "#ffe2a8", "#ffb35a"], cool = ["#8fc2ee", "#a8d4f4", "#7db8e8"];
  if (kind === "res") {
    const nx = 4, ny = 4, cw = S / nx, ch = S / ny;
    // weathered wall
    for (let i = 0; i < 700; i++) { const v = 188 + Math.floor(rnd() * 50); a.fillStyle = `rgba(${v},${v - 4},${v - 12},0.35)`; a.fillRect(rnd() * S, rnd() * S, 2 + rnd() * 14, 2 + rnd() * 7); }
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const wx = x * cw + cw * 0.22, wy = y * ch + ch * 0.2, ww = cw * 0.56, wh = ch * 0.6;
      a.fillStyle = "#4a5668"; a.fillRect(wx, wy, ww, wh); a.fillStyle = "rgba(255,255,255,0.15)"; a.fillRect(wx, wy, ww, 3);
      a.fillStyle = "#9a958a"; a.fillRect(wx - 3, wy + wh, ww + 6, 5); // sill
      if (rnd() < 0.42) { const c = rnd() < 0.85 ? warm[Math.floor(rnd() * warm.length)] : cool[Math.floor(rnd() * cool.length)]; b.fillStyle = c; b.fillRect(wx + 2, wy + 2, ww - 4, wh - 4); a.fillStyle = c; a.globalAlpha = 0.35; a.fillRect(wx, wy, ww, wh); a.globalAlpha = 1; }
      if (rnd() < 0.12) { a.fillStyle = "rgba(20,20,24,0.8)"; a.fillRect(wx + ww * 0.1, wy + wh * 0.5, ww * 0.8, wh * 0.5); } // grille / AC
    }
  } else if (kind === "office") {
    const nx = 8, ny = 8, cw = S / nx, ch = S / ny;
    a.fillStyle = "#22303f"; a.fillRect(0, 0, S, S);
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const gx = x * cw + 1, gy = y * ch + 3, gw = cw - 2, gh = ch - 6; const g = a.createLinearGradient(gx, gy, gx + gw, gy + gh);
      g.addColorStop(0, "#35516b"); g.addColorStop(1, "#1b2c3d"); a.fillStyle = g; a.fillRect(gx, gy, gw, gh);
      if (rnd() < 0.5) { const c = rnd() < 0.7 ? cool[Math.floor(rnd() * cool.length)] : warm[Math.floor(rnd() * warm.length)]; b.fillStyle = c; b.fillRect(gx, gy, gw, gh); a.fillStyle = c; a.globalAlpha = 0.28; a.fillRect(gx, gy, gw, gh); a.globalAlpha = 1; }
    }
    a.fillStyle = "rgba(140,170,200,0.5)"; for (let y = 0; y < ny; y++) a.fillRect(0, y * ch, S, 2);
  } else { // industrial
    a.fillStyle = "#b4b7b8"; a.fillRect(0, 0, S, S);
    for (let x = 0; x < S; x += 8) { a.fillStyle = "rgba(0,0,0,0.12)"; a.fillRect(x, 0, 3, S); a.fillStyle = "rgba(255,255,255,0.08)"; a.fillRect(x + 3, 0, 2, S); }
    for (let i = 0; i < 3; i++) { const wx = 20 + i * 80, wy = 36; a.fillStyle = "#2c3440"; a.fillRect(wx, wy, 56, 22); if (rnd() < 0.5) { b.fillStyle = "#ffe9b5"; b.fillRect(wx + 2, wy + 2, 52, 18); } }
    a.fillStyle = "#554"; a.fillRect(0, S - 6, S, 6);
  }
  return { map: tex(col), em: tex(em), uvW: kind === "office" ? 24 : kind === "res" ? 12 : 16, uvH: kind === "office" ? 32 : kind === "res" ? 12.8 : 12 };
}

// ---- roads: one atlas with four bands (highway, avenue, street, plain). u runs across the road, v along it (1 = 16 m) -----------
export const ROAD_BAND = { hwy: 0, art: 1, str: 2, plain: 3 };
export function roadTexture() {
  const BW = 128, H = 256, c = cv(BW * 4, H), g = c.getContext("2d"), rnd = mulberry(77);
  for (let b = 0; b < 4; b++) {
    const x0 = b * BW; g.fillStyle = "#2a2a31"; g.fillRect(x0, 0, BW, H);
    for (let i = 0; i < 2400; i++) { const v = 26 + Math.floor(rnd() * 34); g.fillStyle = `rgba(${v},${v},${v + 4},0.7)`; g.fillRect(x0 + rnd() * BW, rnd() * H, 1 + rnd() * 2, 1 + rnd() * 2); }
    for (let i = 0; i < 12; i++) { g.fillStyle = "rgba(0,0,0,0.12)"; g.fillRect(x0 + rnd() * BW, rnd() * H, 6 + rnd() * 30, 10 + rnd() * 60); }
    // worn tyre tracks
    g.fillStyle = "rgba(10,10,12,0.22)"; for (const f of b === 0 ? [0.18, 0.34, 0.66, 0.82] : b === 1 ? [0.28, 0.72] : [0.3, 0.7]) g.fillRect(x0 + BW * f - 5, 0, 10, H);
    const line = (f, w, col, dash) => { g.fillStyle = col; if (!dash) g.fillRect(x0 + BW * f - w / 2, 0, w, H); else for (let y = 0; y < H; y += dash * 2) g.fillRect(x0 + BW * f - w / 2, y, w, dash); };
    if (b === 0) { line(0.04, 3, "#e9e9e0"); line(0.96, 3, "#e9e9e0"); line(0.485, 2.5, "#f2c230"); line(0.515, 2.5, "#f2c230"); for (const f of [0.18, 0.34, 0.66, 0.82]) line(f + (f < 0.5 ? 0.08 : -0.08), 2, "#eeeeea", 32); }
    if (b === 1) { line(0.035, 2.5, "#e9e9e0"); line(0.965, 2.5, "#e9e9e0"); line(0.5, 3, "#f2c230", 40); line(0.25, 2, "#eee", 28); line(0.75, 2, "#eee", 28); }
    if (b === 2) { line(0.5, 2.5, "#e6dfc4", 36); line(0.04, 2, "rgba(230,230,224,0.5)"); line(0.96, 2, "rgba(230,230,224,0.5)"); }
  }
  const t = tex(c); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}

export function seaTexture() { // soft ripples used as a bump map
  const c = cv(256, 256), g = c.getContext("2d"), rnd = mulberry(5); g.fillStyle = "#808080"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { const x = rnd() * 256, y = rnd() * 256, w = 6 + rnd() * 26; const v = rnd() < 0.5 ? 150 : 108; g.strokeStyle = `rgba(${v},${v},${v},0.5)`; g.lineWidth = 1 + rnd() * 2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + w / 2, y + (rnd() - 0.5) * 6, x + w, y); g.stroke(); }
  const t = tex(c, false); t.repeat.set(120, 120); return t;
}

// a name tag that always faces the camera (sprites)
export function labelSprite(text, color = "#ffffff", sub = "", icon = "") {
  const c = cv(512, 160), g = c.getContext("2d");
  g.fillStyle = "rgba(6,8,18,0.78)"; const r = 22; g.beginPath(); g.moveTo(r, 4); g.lineTo(508 - r, 4); g.quadraticCurveTo(508, 4, 508, 4 + r); g.lineTo(508, 156 - r); g.quadraticCurveTo(508, 156, 508 - r, 156); g.lineTo(r, 156); g.quadraticCurveTo(4, 156, 4, 156 - r); g.lineTo(4, 4 + r); g.quadraticCurveTo(4, 4, r, 4); g.fill();
  g.strokeStyle = color; g.lineWidth = 5; g.stroke();
  g.fillStyle = color; g.textBaseline = "middle"; g.font = "bold 62px Arial, sans-serif"; g.textAlign = icon ? "left" : "center";
  const tx = icon ? 110 : 256; if (icon) { g.font = "64px Arial, sans-serif"; g.fillText(icon, 28, sub ? 62 : 82); g.font = "bold 58px Arial, sans-serif"; }
  const avail = 500 - (icon ? 110 : 12) - (icon ? 0 : 12); const fit = (str, px, bold) => { let f = px; do { g.font = (bold ? "bold " : "") + f + "px Arial, sans-serif"; f -= 2; } while (g.measureText(str).width > avail && f > 18); };
  fit(text, 58, true); g.fillText(text, tx, sub ? 62 : 82);
  if (sub) { g.fillStyle = "rgba(255,255,255,0.85)"; fit(sub, 34, false); g.fillText(sub, tx, 118); }
  const t = tex(c, true, false); const m = new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: true });
  const s = new THREE.Sprite(m); s.scale.set(26, 8.1, 1); return s;
}
