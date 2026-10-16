// Midnight Burn — the detailed surfaces: building faces with balconies, curtains and glass, Indian shopfronts with
// signboards, billboards, neon blade signs, highway gantry boards, paving, asphalt, ground and clouds.
// Everything is painted in code. Each facade comes as three maps: colour, "lights on" (emissive) and a roughness/metal
// map, so glass shines and plaster stays matt.
import * as THREE from "three";
import { mulberry, vnoise } from "./geo";

const cv = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
function T(c, srgb = true, rep = true, aniso = 8) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; }
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath(); }
function grain(g, w, h, amt, rnd, tint = [0, 0, 0]) { const im = g.getImageData(0, 0, w, h), d = im.data; for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * amt; d[i] = Math.max(0, Math.min(255, d[i] + n + tint[0])); d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n + tint[1])); d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n + tint[2])); } g.putImageData(im, 0, 0); }
const pick = (a, rnd) => a[Math.floor(rnd() * a.length)];
const WARM = ["#ffd9a0", "#ffc874", "#fff1d0", "#ffe3b0", "#ffb866", "#ffdcb0"], COOL = ["#a8d4ff", "#c6e4ff", "#8fc0f0"], TV = ["#7aa6ff", "#9cc0ff", "#b8a0ff"];

// roughness map channels: G = roughness, B = metalness (R unused). helpers write all three at once
const R = (g, rough, metal = 0) => { g.fillStyle = `rgb(0,${rough},${metal})`; };

// ================================================================================================================================
//  RESIDENTIAL — 8 x 8 cells of 3 m x 3.2 m  (tile = 24 m x 25.6 m)
// ================================================================================================================================
function drawResidential(S, rnd) {
  const col = cv(S, S), em = cv(S, S), rm = cv(S, S), a = col.getContext("2d"), b = em.getContext("2d"), r = rm.getContext("2d");
  const N = 8, C = S / N;
  a.fillStyle = "#d6d0c4"; a.fillRect(0, 0, S, S); b.fillStyle = "#000"; b.fillRect(0, 0, S, S); R(r, 235); r.fillRect(0, 0, S, S);
  // plaster mottling
  for (let i = 0; i < 1400; i++) { const v = 150 + rnd() * 90 | 0; a.fillStyle = `rgba(${v},${v - 5},${v - 14},0.22)`; a.fillRect(rnd() * S, rnd() * S, 4 + rnd() * 40, 3 + rnd() * 18); }
  // floor slabs (cornice lines)
  for (let y = 0; y < N; y++) { const yy = y * C + C - 8; a.fillStyle = "rgba(60,55,50,0.35)"; a.fillRect(0, yy + 6, S, 3); a.fillStyle = "rgba(255,255,255,0.28)"; a.fillRect(0, yy, S, 4); a.fillStyle = "rgba(0,0,0,0.12)"; a.fillRect(0, yy + 9, S, 5); }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const x0 = x * C, y0 = y * C, kind = rnd(); const lit = rnd() < 0.5;
    const litCol = rnd() < 0.82 ? pick(WARM, rnd) : rnd() < 0.5 ? pick(COOL, rnd) : pick(TV, rnd);
    if (kind < 0.5 || kind > 0.93) { // window (one or two panes)
      const dbl = kind > 0.93; const wx = x0 + (dbl ? 12 : 26), wy = y0 + 22, ww = dbl ? 104 : 76, wh = 74;
      a.fillStyle = "rgba(0,0,0,0.18)"; a.fillRect(wx - 5, wy - 5, ww + 10, wh + 12); // recess shadow
      a.fillStyle = "#3a3e45"; a.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
      const gg = a.createLinearGradient(wx, wy, wx + ww, wy + wh); gg.addColorStop(0, "#2d4258"); gg.addColorStop(0.5, "#1b2736"); gg.addColorStop(1, "#243448"); a.fillStyle = gg; a.fillRect(wx, wy, ww, wh);
      r.fillStyle = "rgb(0,38,60)"; r.fillRect(wx, wy, ww, wh); r.fillStyle = "rgb(0,150,90)"; r.fillRect(wx - 3, wy - 3, ww + 6, 3); r.fillRect(wx - 3, wy + wh, ww + 6, 3);
      if (lit) {
        const ig = b.createLinearGradient(0, wy, 0, wy + wh); ig.addColorStop(0, litCol); ig.addColorStop(1, "rgba(120,90,60,0.9)"); b.fillStyle = ig; b.fillRect(wx, wy, ww, wh);
        a.globalAlpha = 0.3; a.fillStyle = litCol; a.fillRect(wx, wy, ww, wh); a.globalAlpha = 1;
        const cr = rnd(); if (cr < 0.45) { const cw = ww * (0.25 + rnd() * 0.3); for (const sx of [wx, wx + ww - cw]) { b.fillStyle = "rgba(0,0,0,0.5)"; b.fillRect(sx, wy, cw, wh); a.fillStyle = "rgba(90,40,50,0.5)"; a.fillRect(sx, wy, cw, wh); } } // curtains
        else if (cr < 0.7) { b.fillStyle = "rgba(0,0,0,0.38)"; for (let k = 0; k < wh; k += 8) b.fillRect(wx, wy + k, ww, 3); } // blinds
        else if (cr < 0.85) { b.fillStyle = "rgba(0,0,0,0.75)"; b.fillRect(wx + ww * 0.15, wy + wh * 0.45, ww * 0.18, wh * 0.55); b.beginPath(); b.arc(wx + ww * 0.24, wy + wh * 0.4, wh * 0.1, 0, 7); b.fill(); } // someone at home
      } else { a.fillStyle = "rgba(160,190,230,0.14)"; a.beginPath(); a.moveTo(wx, wy + wh); a.lineTo(wx + ww * 0.45, wy); a.lineTo(wx + ww * 0.7, wy); a.lineTo(wx + ww * 0.25, wy + wh); a.fill(); }
      a.fillStyle = "#23262c"; a.fillRect(wx + ww / 2 - 1.5, wy, 3, wh); if (dbl) { a.fillRect(wx + ww / 3, wy, 3, wh); a.fillRect(wx + (ww * 2) / 3, wy, 3, wh); } // mullions
      a.fillStyle = "#c2baa9"; a.fillRect(wx - 8, wy + wh + 3, ww + 16, 6); a.fillStyle = "rgba(0,0,0,0.3)"; a.fillRect(wx - 8, wy + wh + 9, ww + 16, 4); // sill
      if (rnd() < 0.18) { a.fillStyle = "#cfd0cf"; a.fillRect(wx + ww - 30, wy + wh + 10, 34, 24); a.fillStyle = "#555"; a.fillRect(wx + ww - 26, wy + wh + 14, 26, 6); a.fillStyle = "rgba(40,40,40,0.25)"; a.fillRect(wx + ww - 18, wy + wh + 34, 6, 50); } // AC box with drip
    } else if (kind < 0.72) { // balcony with railing, sliding door, washing
      const dx = x0 + 18, dy = y0 + 10, dw = 92, dh = 70;
      a.fillStyle = "#30343b"; a.fillRect(dx - 3, dy - 3, dw + 6, dh + 3); const gg = a.createLinearGradient(dx, dy, dx, dy + dh); gg.addColorStop(0, "#26384c"); gg.addColorStop(1, "#18222e"); a.fillStyle = gg; a.fillRect(dx, dy, dw, dh);
      r.fillStyle = "rgb(0,38,60)"; r.fillRect(dx, dy, dw, dh);
      if (lit) { b.fillStyle = litCol; b.fillRect(dx + 3, dy + 3, dw - 6, dh - 6); b.fillStyle = "rgba(0,0,0,0.3)"; b.fillRect(dx + dw / 2 - 2, dy, 4, dh); a.globalAlpha = 0.25; a.fillStyle = litCol; a.fillRect(dx, dy, dw, dh); a.globalAlpha = 1; }
      a.fillStyle = "#a8a296"; a.fillRect(x0 + 4, y0 + 84, C - 8, 10); a.fillStyle = "rgba(255,255,255,0.4)"; a.fillRect(x0 + 4, y0 + 84, C - 8, 2); a.fillStyle = "rgba(0,0,0,0.38)"; a.fillRect(x0 + 6, y0 + 94, C - 12, 6); // slab and its shadow
      a.fillStyle = "#4a4d55"; for (let k = 0; k < 15; k++) a.fillRect(x0 + 8 + k * 7.6, y0 + 58, 2, 27); a.fillRect(x0 + 6, y0 + 56, C - 12, 3); R(r, 120, 90); for (let k = 0; k < 15; k++) r.fillRect(x0 + 8 + k * 7.6, y0 + 58, 2, 27); r.fillRect(x0 + 6, y0 + 56, C - 12, 3); R(r, 235);
      if (rnd() < 0.5) { for (let k = 0; k < 1 + (rnd() * 3 | 0); k++) { a.fillStyle = pick(["#d94a4a", "#e8c340", "#4a8fd9", "#e8e8e0", "#c05bd0", "#5bbf6a"], rnd); const lx = x0 + 12 + k * 28 + rnd() * 6; a.fillRect(lx, y0 + 34, 14 + rnd() * 10, 22 + rnd() * 10); } a.fillStyle = "#555"; a.fillRect(x0 + 10, y0 + 33, C - 20, 1.5); }
      if (rnd() < 0.4) { a.fillStyle = "#2f6b34"; for (let k = 0; k < 3; k++) { a.beginPath(); a.arc(x0 + 20 + k * 36 + rnd() * 10, y0 + 76, 8 + rnd() * 5, 0, 7); a.fill(); } }
    } else if (kind < 0.8) { // shuttered window
      const wx = x0 + 28, wy = y0 + 22, ww = 72, wh = 78; const sc = pick(["#41603f", "#6a4a32", "#3f5266"], rnd);
      a.fillStyle = "#2a2a2a"; a.fillRect(wx - 3, wy - 3, ww + 6, wh + 6); a.fillStyle = sc; a.fillRect(wx, wy, ww / 2 - 1, wh); a.fillRect(wx + ww / 2 + 1, wy, ww / 2 - 1, wh);
      a.fillStyle = "rgba(0,0,0,0.35)"; for (let k = 0; k < wh; k += 6) { a.fillRect(wx, wy + k, ww, 2); } a.fillStyle = "#b3ab9a"; a.fillRect(wx - 8, wy + wh + 3, ww + 16, 6); R(r, 170, 20); r.fillRect(wx, wy, ww, wh); R(r, 235);
    } else { // plain wall with pipe, vent or a painted advert
      if (rnd() < 0.5) { a.fillStyle = "#6b6d70"; a.fillRect(x0 + 100, y0, 7, C); a.fillStyle = "rgba(255,255,255,0.3)"; a.fillRect(x0 + 101, y0, 2, C); R(r, 110, 140); r.fillRect(x0 + 100, y0, 7, C); R(r, 235); }
      else { a.fillStyle = pick(["#c9533b", "#3b7bc9", "#d8b840", "#4d9a5b"], rnd); a.fillRect(x0 + 20, y0 + 30, 88, 54); a.fillStyle = "rgba(255,255,255,0.8)"; a.font = "bold 22px Arial"; a.fillText(pick(["PAINT", "CEMENT", "TILES", "FANS"], rnd), x0 + 30, y0 + 66); }
      if (lit && rnd() < 0.4) { b.fillStyle = "#ffe2a8"; b.beginPath(); b.arc(x0 + 64, y0 + 20, 5, 0, 7); b.fill(); }
    }
  }
  // rain streaks and soot under the slabs
  for (let i = 0; i < 90; i++) { const x = rnd() * S, y = rnd() * S, h = 30 + rnd() * 140; const g2 = a.createLinearGradient(0, y, 0, y + h); g2.addColorStop(0, "rgba(40,36,30,0.16)"); g2.addColorStop(1, "rgba(40,36,30,0)"); a.fillStyle = g2; a.fillRect(x, y, 2 + rnd() * 6, h); }
  grain(a, S, S, 16, rnd);
  return { col, em, rm, uvW: 24, uvH: 25.6 };
}

// ================================================================================================================================
//  OFFICE — curtain wall 8 x 8 cells of 3 m x 4 m  (tile = 24 m x 32 m)
// ================================================================================================================================
function drawOffice(S, rnd) {
  const col = cv(S, S), em = cv(S, S), rm = cv(S, S), a = col.getContext("2d"), b = em.getContext("2d"), r = rm.getContext("2d");
  const N = 8, C = S / N; a.fillStyle = "#1c2735"; a.fillRect(0, 0, S, S); b.fillStyle = "#000"; b.fillRect(0, 0, S, S); R(r, 35, 40); r.fillRect(0, 0, S, S);
  const rowLit = Array.from({ length: N }, () => (rnd() < 0.45 ? 0.9 : rnd() < 0.5 ? 0.35 : 0.08));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const x0 = x * C, y0 = y * C, gx = x0 + 3, gy = y0 + 4, gw = C - 6, gh = C - 36;
    const g = a.createLinearGradient(gx, gy, gx + gw * 0.6, gy + gh); const sky = 0.55 + 0.45 * Math.sin((x + y * 1.7) * 0.9);
    g.addColorStop(0, `rgb(${54 + sky * 40 | 0},${90 + sky * 50 | 0},${130 + sky * 50 | 0})`); g.addColorStop(0.6, "#233a52"); g.addColorStop(1, "#142130"); a.fillStyle = g; a.fillRect(gx, gy, gw, gh);
    a.fillStyle = `rgba(190,220,255,${0.05 + rnd() * 0.14})`; a.beginPath(); a.moveTo(gx, gy + gh); a.lineTo(gx + gw * 0.4, gy); a.lineTo(gx + gw * 0.62, gy); a.lineTo(gx + gw * 0.22, gy + gh); a.fill();
    // spandrel (opaque band between floors)
    a.fillStyle = "#2c3a4a"; a.fillRect(x0, y0 + C - 32, C, 32); a.fillStyle = "rgba(180,200,225,0.35)"; a.fillRect(x0, y0 + C - 32, C, 2); a.fillStyle = "rgba(0,0,0,0.3)"; a.fillRect(x0, y0 + C - 4, C, 4); R(r, 110, 150); r.fillRect(x0, y0 + C - 32, C, 32); R(r, 35, 40);
    // mullions
    a.fillStyle = "#9aa6b4"; a.fillRect(x0, y0, 3, C - 32); a.fillRect(x0 + C - 3, y0, 3, C - 32); R(r, 85, 200); r.fillRect(x0, y0, 3, C - 32); r.fillRect(x0 + C - 3, y0, 3, C - 32); R(r, 35, 40);
    if (rnd() < rowLit[y]) { // a lit office: ceiling light strips, a desk, a screen glow
      const w = pick(WARM, rnd), c2 = rnd() < 0.55 ? pick(COOL, rnd) : w; const cl = b.createLinearGradient(0, gy, 0, gy + gh); cl.addColorStop(0, c2); cl.addColorStop(1, "rgba(80,100,130,0.9)"); b.fillStyle = cl; b.fillRect(gx, gy, gw, gh);
      b.fillStyle = "rgba(255,255,255,0.9)"; b.fillRect(gx + 6, gy + 5, gw - 12, 3); b.fillStyle = "rgba(0,0,0,0.55)"; b.fillRect(gx, gy + gh - 22, gw, 22); b.fillStyle = "#9cc8ff"; b.fillRect(gx + gw * 0.2, gy + gh - 30, 18, 10); b.fillRect(gx + gw * 0.6, gy + gh - 30, 16, 9);
      a.globalAlpha = 0.28; a.fillStyle = w; a.fillRect(gx, gy, gw, gh); a.globalAlpha = 1;
    }
  }
  grain(a, S, S, 10, rnd);
  return { col, em, rm, uvW: 24, uvH: 32 };
}

function drawIndustrial(S, rnd) {
  const col = cv(S, S), em = cv(S, S), rm = cv(S, S), a = col.getContext("2d"), b = em.getContext("2d"), r = rm.getContext("2d");
  a.fillStyle = "#b2b6b8"; a.fillRect(0, 0, S, S); b.fillStyle = "#000"; b.fillRect(0, 0, S, S); R(r, 150, 150); r.fillRect(0, 0, S, S);
  for (let x = 0; x < S; x += 6) { a.fillStyle = "rgba(0,0,0,0.16)"; a.fillRect(x, 0, 2, S); a.fillStyle = "rgba(255,255,255,0.14)"; a.fillRect(x + 2, 0, 2, S); }
  for (let i = 0; i < 40; i++) { const x = rnd() * S, h = 40 + rnd() * 180, y = rnd() * S * 0.7; const g = a.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, "rgba(120,60,30,0.28)"); g.addColorStop(1, "rgba(120,60,30,0)"); a.fillStyle = g; a.fillRect(x, y, 3 + rnd() * 10, h); }
  // roller doors with stripes, strip windows lit from inside, number plates
  for (let i = 0; i < 2; i++) { const dx = 24 + i * 250, dy = S - 200, dw = 190, dh = 192; a.fillStyle = "#6c747a"; a.fillRect(dx, dy, dw, dh); a.fillStyle = "rgba(0,0,0,0.25)"; for (let k = 0; k < dh; k += 12) a.fillRect(dx, dy + k, dw, 3); a.fillStyle = "#e8c020"; for (let k = 0; k < dw; k += 28) { a.beginPath(); a.moveTo(dx + k, dy + dh); a.lineTo(dx + k + 14, dy + dh); a.lineTo(dx + k + 30, dy + dh - 14); a.lineTo(dx + k + 16, dy + dh - 14); a.fill(); } R(r, 110, 180); r.fillRect(dx, dy, dw, dh); b.fillStyle = "#ffcf7a"; b.fillRect(dx + dw / 2 - 12, dy - 16, 24, 8); }
  for (let i = 0; i < 6; i++) { const wx = 20 + i * 82, wy = 60; a.fillStyle = "#2a323a"; a.fillRect(wx, wy, 62, 26); R(r, 40, 60); r.fillRect(wx, wy, 62, 26); if (rnd() < 0.7) { b.fillStyle = rnd() < 0.7 ? "#fff0c8" : "#a8d4ff"; b.fillRect(wx + 2, wy + 2, 58, 22); } }
  grain(a, S, S, 14, rnd);
  return { col, em, rm, uvW: 24, uvH: 24 };
}

export function facadeSet(kind, seed = 5) {
  const rnd = mulberry(seed * 31 + kind.length * 7);
  const o = kind === "res" ? drawResidential(1024, rnd) : kind === "office" ? drawOffice(1024, rnd) : drawIndustrial(512, rnd);
  const rmT = T(o.rm, false); const colT = T(o.col), emT = T(o.em);
  return { map: colT, em: emT, rm: rmT, uvW: o.uvW, uvH: o.uvH };
}

// ================================================================================================================================
//  GROUND-FLOOR BANDS — 16.8 m x 4.2 m tiles (1024 x 256)
// ================================================================================================================================
const SHOP_NAMES = ["CHAI", "VADA PAV", "STATIONERY", "TAILOR", "MOBILES", "SWEETS", "BIRYANI", "ELECTRONICS", "SALON", "FRESH JUICE", "PHARMACY", "BAKERY", "BOOKS", "CAFE", "HARDWARE", "FASHION", "DOSA", "GROCERY", "OPTICALS", "JEWELLERS", "PIZZA", "TEA STALL"];
const NEONS = ["#ff3d7f", "#35e0ff", "#ffd23a", "#7cff6b", "#ff8a2d", "#c46bff", "#ffffff"];
function fitText(g, text, maxW, px, bold = true) { let f = px; do { g.font = (bold ? "bold " : "") + f + "px Arial, sans-serif"; f -= 2; } while (g.measureText(text).width > maxW && f > 12); }
function drawShops(rnd) {
  const W = 1024, H = 256, col = cv(W, H), em = cv(W, H), rm = cv(W, H), a = col.getContext("2d"), b = em.getContext("2d"), r = rm.getContext("2d");
  a.fillStyle = "#cfc8bb"; a.fillRect(0, 0, W, H); b.fillStyle = "#000"; b.fillRect(0, 0, W, H); R(r, 220); r.fillRect(0, 0, W, H);
  for (let i = 0; i < 500; i++) { const v = 150 + rnd() * 80 | 0; a.fillStyle = `rgba(${v},${v - 5},${v - 12},0.2)`; a.fillRect(rnd() * W, rnd() * H, 4 + rnd() * 30, 3 + rnd() * 12); }
  const n = 4, SW = W / n;
  for (let i = 0; i < n; i++) {
    const x0 = i * SW, kind = rnd(); const neon = pick(NEONS, rnd), name = pick(SHOP_NAMES, rnd);
    // pillar
    a.fillStyle = "#a59e90"; a.fillRect(x0, 0, 12, H); a.fillRect(x0 + SW - 12, 0, 12, H);
    // signboard
    const sx = x0 + 18, sy = 8, sw = SW - 36, sh = 62; const boardCol = pick(["#14161c", "#1c1430", "#2a0f12", "#0f2420", "#f2f0e6", "#e8d44a"], rnd); const light = boardCol === "#f2f0e6" || boardCol === "#e8d44a";
    a.fillStyle = "#101114"; rrect(a, sx - 3, sy - 3, sw + 6, sh + 6, 5); a.fill(); a.fillStyle = boardCol; rrect(a, sx, sy, sw, sh, 4); a.fill();
    a.textAlign = "center"; a.textBaseline = "middle"; fitText(a, name, sw - 20, 40); a.fillStyle = light ? "#c8202c" : neon; a.fillText(name, sx + sw / 2, sy + sh / 2 + 2);
    b.fillStyle = light ? "rgba(255,245,220,0.85)" : "rgba(255,255,255,0.1)"; rrect(b, sx, sy, sw, sh, 4); b.fill(); b.textAlign = "center"; b.textBaseline = "middle"; fitText(b, name, sw - 20, 40); b.fillStyle = light ? "#ff3030" : neon; b.shadowColor = neon; b.shadowBlur = light ? 0 : 14; b.fillText(name, sx + sw / 2, sy + sh / 2 + 2); b.shadowBlur = 0;
    R(r, 90, 30); r.fillRect(sx, sy, sw, sh);
    if (kind < 0.55) { // open shop: lit interior, shelves, goods, awning
      const ix = x0 + 20, iy = 82, iw = SW - 40, ih = 164;
      a.fillStyle = "#1b1c20"; a.fillRect(ix, iy, iw, ih); const wl = pick(WARM, rnd); const ig = b.createLinearGradient(0, iy, 0, iy + ih); ig.addColorStop(0, wl); ig.addColorStop(1, "rgba(150,110,70,1)"); b.fillStyle = ig; b.fillRect(ix, iy, iw, ih);
      a.globalAlpha = 0.4; a.fillStyle = wl; a.fillRect(ix, iy, iw, ih); a.globalAlpha = 1; R(r, 50, 40); r.fillRect(ix, iy, iw, ih);
      for (let s2 = 0; s2 < 3; s2++) { const yy = iy + 22 + s2 * 44; a.fillStyle = "rgba(60,40,25,0.9)"; a.fillRect(ix + 6, yy + 24, iw - 12, 5); b.fillStyle = "rgba(60,40,25,0.9)"; b.fillRect(ix + 6, yy + 24, iw - 12, 5); for (let k = 0; k < 9; k++) { const gc = pick(["#d94a4a", "#e8c340", "#4a8fd9", "#f2f2ea", "#5bbf6a", "#e07b39"], rnd); const gw = 10 + rnd() * 12, gh = 10 + rnd() * 14; a.fillStyle = gc; a.fillRect(ix + 10 + k * ((iw - 20) / 9), yy + 24 - gh, gw, gh); b.fillStyle = gc; b.globalAlpha = 0.85; b.fillRect(ix + 10 + k * ((iw - 20) / 9), yy + 24 - gh, gw, gh); b.globalAlpha = 1; } }
      if (rnd() < 0.7) { const ax = x0 + 14, ay = 74, aw = SW - 28; for (let k = 0; k < aw; k += 18) { a.fillStyle = (k / 18) % 2 ? "#f2f2ee" : pick(["#c8202c", "#1f5fc8", "#d8a020"], () => 0.1); a.fillRect(ax + k, ay, 18, 26); } a.fillStyle = "rgba(0,0,0,0.3)"; a.fillRect(ax, ay + 26, aw, 6); }
      b.fillStyle = "#fff6d0"; for (let k = 0; k < 8; k++) { b.beginPath(); b.arc(x0 + 30 + k * ((SW - 60) / 7), 78, 3.4, 0, 7); b.fill(); } // string of bulbs
    } else if (kind < 0.88) { // rolling shutter, painted and postered
      const ix = x0 + 20, iy = 82, iw = SW - 40, ih = 168; a.fillStyle = pick(["#767b80", "#6a7a72", "#80766a"], rnd); a.fillRect(ix, iy, iw, ih); a.fillStyle = "rgba(0,0,0,0.22)"; for (let k = 0; k < ih; k += 9) a.fillRect(ix, iy + k, iw, 3); a.fillStyle = "rgba(255,255,255,0.1)"; for (let k = 3; k < ih; k += 9) a.fillRect(ix, iy + k, iw, 1.5);
      R(r, 140, 190); r.fillRect(ix, iy, iw, ih);
      for (let k = 0; k < 3; k++) { a.fillStyle = pick(["#d94a8a", "#4ad9c8", "#e8c340", "#ffffff"], rnd); a.globalAlpha = 0.8; a.fillRect(ix + 8 + rnd() * (iw - 60), iy + 20 + rnd() * 100, 28 + rnd() * 30, 22 + rnd() * 40); a.globalAlpha = 1; }
      b.fillStyle = "#ffcf7a"; b.fillRect(x0 + SW / 2 - 14, 74, 28, 5);
    } else { // dark glass doors of a bank or office
      const ix = x0 + 20, iy = 82, iw = SW - 40, ih = 166; a.fillStyle = "#17202a"; a.fillRect(ix, iy, iw, ih); b.fillStyle = "#a8d4ff"; b.globalAlpha = 0.55; b.fillRect(ix + 8, iy + 8, iw - 16, ih - 16); b.globalAlpha = 1; a.fillStyle = "#8c96a0"; a.fillRect(ix + iw / 2 - 2, iy, 4, ih); R(r, 30, 80); r.fillRect(ix, iy, iw, ih);
    }
    a.fillStyle = "rgba(0,0,0,0.3)"; a.fillRect(x0, H - 10, SW, 10); // threshold
  }
  grain(a, W, H, 12, rnd);
  return { col, em, rm };
}
function drawLobby(rnd) {
  const W = 1024, H = 256, col = cv(W, H), em = cv(W, H), rm = cv(W, H), a = col.getContext("2d"), b = em.getContext("2d"), r = rm.getContext("2d");
  a.fillStyle = "#26303c"; a.fillRect(0, 0, W, H); b.fillStyle = "#000"; b.fillRect(0, 0, W, H); R(r, 40, 120); r.fillRect(0, 0, W, H);
  for (let i = 0; i < 4; i++) { const x0 = i * 256; a.fillStyle = "#3a4552"; a.fillRect(x0, 0, 18, H); R(r, 90, 200); r.fillRect(x0, 0, 18, H); a.fillStyle = "#0e1620"; a.fillRect(x0 + 24, 36, 208, 212); const g = b.createLinearGradient(0, 36, 0, 248); const wl = pick(WARM, rnd); g.addColorStop(0, wl); g.addColorStop(1, "rgba(170,140,100,0.9)"); b.fillStyle = g; b.globalAlpha = 0.85; b.fillRect(x0 + 28, 40, 200, 204); b.globalAlpha = 1; b.fillStyle = "rgba(0,0,0,0.55)"; b.fillRect(x0 + 28, 190, 200, 54); b.fillStyle = "#fff"; b.fillRect(x0 + 40, 56, 176, 3); a.fillStyle = "#9aa4b0"; a.fillRect(x0 + 126, 36, 4, 212); R(r, 25, 60); r.fillRect(x0 + 24, 36, 208, 212); }
  b.fillStyle = "rgba(255,255,255,0.85)"; b.fillRect(0, 12, W, 6); a.fillStyle = "#cfd8e2"; a.fillRect(0, 12, W, 6);
  return { col, em, rm };
}
function drawDock(rnd) {
  const W = 1024, H = 256, col = cv(W, H), em = cv(W, H), rm = cv(W, H), a = col.getContext("2d"), b = em.getContext("2d"), r = rm.getContext("2d");
  a.fillStyle = "#8a8f92"; a.fillRect(0, 0, W, H); b.fillStyle = "#000"; b.fillRect(0, 0, W, H); R(r, 170, 140); r.fillRect(0, 0, W, H);
  for (let i = 0; i < 3; i++) { const x0 = 20 + i * 336, w = 296; a.fillStyle = "#59636b"; a.fillRect(x0, 40, w, 216); a.fillStyle = "rgba(0,0,0,0.25)"; for (let k = 0; k < 216; k += 12) a.fillRect(x0, 40 + k, w, 3); a.fillStyle = "#e8c020"; a.fillRect(x0, 30, w, 10); a.fillStyle = "#101010"; for (let k = 0; k < w; k += 36) { a.beginPath(); a.moveTo(x0 + k, 30); a.lineTo(x0 + k + 18, 30); a.lineTo(x0 + k + 28, 40); a.lineTo(x0 + k + 10, 40); a.fill(); } b.fillStyle = "#ffbe5a"; b.beginPath(); b.arc(x0 + w / 2, 18, 9, 0, 7); b.fill(); a.fillStyle = "#f2f2ee"; a.font = "bold 30px Arial"; a.textAlign = "center"; a.fillText("BAY " + (i + 1 + (rnd() * 6 | 0)), x0 + w / 2, 80); R(r, 120, 190); r.fillRect(x0, 40, w, 216); }
  grain(a, W, H, 12, rnd);
  return { col, em, rm };
}
export function bandSet(kind, seed = 9) {
  const rnd = mulberry(seed * 17 + kind.length);
  const o = kind === "shops" ? drawShops(rnd) : kind === "lobby" ? drawLobby(rnd) : drawDock(rnd);
  return { map: T(o.col), em: T(o.em), rm: T(o.rm, false), uvW: 16.8, uvH: 4.2 };
}

// ================================================================================================================================
//  BILLBOARDS (8 landscape adverts), BLADE SIGNS (8 vertical neon signs), HIGHWAY BOARDS (16 green boards)
// ================================================================================================================================
const ADS = [
  ["VELOCE", "ENERGY DRINK", "#ff2d6f", "#ff9a3d"], ["NOVA TELECOM", "5G EVERYWHERE", "#2d6bff", "#2de2ff"], ["ZENITH", "TIMELESS WATCHES", "#101828", "#c9a24a"], ["KAAVERI TEA", "CHAI, JUST RIGHT", "#1f7a3a", "#ffd23a"],
  ["TURBO COLA", "TASTE THE FIZZ", "#c8102e", "#ff6b4a"], ["SKYBIRD AIR", "FLY FROM BOMBAY", "#0b3d91", "#7cc4ff"], ["LUNA SWEETS", "MITHAI SINCE 1948", "#6a1b9a", "#ff8ad8"], ["FLUX PHONES", "MEET THE FUTURE", "#111", "#35e0ff"],
];
export function adAtlas() {
  const W = 1024, H = 1024, c = cv(W, H), g = c.getContext("2d"), rnd = mulberry(404);
  ADS.forEach(([name, tag, c1, c2], i) => {
    const x = (i % 2) * 512, y = Math.floor(i / 2) * 256; const gr = g.createLinearGradient(x, y, x + 512, y + 256); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(x, y, 512, 256);
    g.globalAlpha = 0.16; g.fillStyle = "#fff"; for (let k = 0; k < 7; k++) { g.beginPath(); g.arc(x + rnd() * 512, y + rnd() * 256, 20 + rnd() * 70, 0, 7); g.fill(); } g.globalAlpha = 1;
    g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(x, y + 190, 512, 66);
    g.textAlign = "left"; g.textBaseline = "middle"; g.fillStyle = "#fff"; fitText(g, name, 440, 78); g.shadowColor = "rgba(0,0,0,0.6)"; g.shadowBlur = 8; g.fillText(name, x + 36, y + 96); g.shadowBlur = 0; fitText(g, tag, 440, 34, false); g.fillStyle = "rgba(255,255,255,0.95)"; g.fillText(tag, x + 38, y + 222);
    g.strokeStyle = "rgba(255,255,255,0.8)"; g.lineWidth = 6; g.strokeRect(x + 4, y + 4, 504, 248);
  });
  return T(c, true, false, 8);
}
const BLADES = ["HOTEL", "BAR", "CAFE", "CLUB", "PIZZA", "SPA", "ROOMS", "LOUNGE"];
export function bladeAtlas() {
  const W = 1024, H = 512, c = cv(W, H), g = c.getContext("2d");
  BLADES.forEach((word, i) => {
    const x = i * 128; g.fillStyle = "#0a0a12"; g.fillRect(x, 0, 128, H); const col = NEONS[i % NEONS.length === 6 ? 0 : i % 6];
    g.strokeStyle = col; g.lineWidth = 7; g.shadowColor = col; g.shadowBlur = 18; g.strokeRect(x + 10, 10, 108, H - 20); g.shadowBlur = 14; g.fillStyle = col; g.textAlign = "center"; g.textBaseline = "middle";
    const fs = Math.min(84, (H - 60) / word.length); g.font = `bold ${fs}px Arial, sans-serif`; for (let k = 0; k < word.length; k++) g.fillText(word[k], x + 64, 50 + (k + 0.5) * ((H - 80) / word.length)); g.shadowBlur = 0;
  });
  return T(c, true, false, 4);
}
const BOARDS = [["THANE", "24 km"], ["NAVI MUMBAI", "18 km"], ["SEA LINK", "6 km"], ["AIROLI", "11 km"], ["BKC", "3 km"], ["VASHI", "14 km"], ["JNPT", "32 km"], ["COLABA", "9 km"], ["POWAI", "7 km"], ["DHARAVI", "2 km"], ["ATAL SETU", "21 km"], ["MARINE DRIVE", "4 km"], ["NERUL", "16 km"], ["GHATKOPAR", "8 km"], ["PANVEL", "38 km"], ["WORLI", "5 km"]];
export const BOARD_COUNT = BOARDS.length;
export function boardAtlas() {
  const W = 1024, H = 1024, c = cv(W, H), g = c.getContext("2d");
  BOARDS.forEach(([name, dist], i) => {
    const x = (i % 2) * 512, y = Math.floor(i / 2) * 128; g.fillStyle = "#0b5d3b"; g.fillRect(x, y, 512, 128); g.strokeStyle = "#f4f4ee"; g.lineWidth = 5; g.strokeRect(x + 5, y + 5, 502, 118);
    g.fillStyle = "#f4f4ee"; g.textBaseline = "middle"; g.textAlign = "left"; fitText(g, name, 340, 54); g.fillText(name, x + 24, y + 48); g.font = "bold 38px Arial"; g.fillText(dist, x + 26, y + 98);
    g.beginPath(); g.moveTo(x + 400, y + 64); g.lineTo(x + 462, y + 64); g.lineTo(x + 440, y + 40); g.moveTo(x + 462, y + 64); g.lineTo(x + 440, y + 88); g.lineWidth = 9; g.strokeStyle = "#f4f4ee"; g.stroke();
  });
  return T(c, true, false, 8);
}

// ================================================================================================================================
//  PAVING, GROUND, CLOUDS, ASPHALT
// ================================================================================================================================
export function paveTexture() {
  const S = 256, c = cv(S, S), g = c.getContext("2d"), rnd = mulberry(21); g.fillStyle = "#3c3b42"; g.fillRect(0, 0, S, S);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const v = 78 + rnd() * 40 | 0; g.fillStyle = `rgb(${v},${v - 2},${v + 4})`; g.fillRect(x * 32 + 1.5, y * 32 + 1.5, 29, 29); g.fillStyle = "rgba(255,255,255,0.06)"; g.fillRect(x * 32 + 1.5, y * 32 + 1.5, 29, 2); }
  grain(g, S, S, 22, rnd); return T(c, true, true, 8);
}
export function groundDetail() {
  const S = 256, c = cv(S, S), g = c.getContext("2d"), rnd = mulberry(8); g.fillStyle = "#e6e6e6"; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 500; i++) { const v = 190 + rnd() * 65 | 0; g.fillStyle = `rgba(${v},${v},${v},0.5)`; g.beginPath(); g.arc(rnd() * S, rnd() * S, 2 + rnd() * 12, 0, 7); g.fill(); }
  grain(g, S, S, 40, rnd); return T(c, true, true, 8);
}
export function cloudTexture() {
  const W = 512, H = 256, c = cv(W, H), g = c.getContext("2d"), im = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W * 14, v = y / H * 5; let n = vnoise(u, v, 3) * 0.55 + vnoise(u * 2.1, v * 2.1, 7) * 0.3 + vnoise(u * 4.4, v * 4.4, 11) * 0.15; n = Math.max(0, Math.min(1, (n - 0.5) * 3.4 + 0.4)); const edge = Math.min(1, y / (H * 0.35)) * Math.min(1, (H - y) / (H * 0.2));
    const i = (y * W + x) * 4; im.data[i] = 150; im.data[i + 1] = 165; im.data[i + 2] = 215; im.data[i + 3] = n * 210 * edge;
  }
  g.putImageData(im, 0, 0); const t = T(c, true, false, 2); t.wrapS = THREE.RepeatWrapping; return t;
}

// Asphalt atlas: five bands side by side (motorway, avenue, street, plain, zebra crossing), 256 px wide each, 16 m tall.
export const BAND_W = 256, BAND_N = 5, ATLAS_W = BAND_W * BAND_N, BAND_H = 512;
export const ROAD_BAND = { hwy: 0, art: 1, str: 2, plain: 3, zebra: 4 };
export function roadSet() {
  const W = ATLAS_W, H = BAND_H, c = cv(W, H), g = c.getContext("2d"), rm = cv(W, H), r = rm.getContext("2d"), rnd = mulberry(77);
  R(r, 190); r.fillRect(0, 0, W, H);
  for (let b = 0; b < BAND_N; b++) {
    const x0 = b * BAND_W; g.fillStyle = "#26262c"; g.fillRect(x0, 0, BAND_W, H);
    // aggregate and tar
    for (let i = 0; i < 5200; i++) { const v = 24 + (rnd() * 46 | 0); g.fillStyle = `rgba(${v},${v},${v + 4},0.75)`; g.fillRect(x0 + rnd() * BAND_W, rnd() * H, 1 + rnd() * 2.4, 1 + rnd() * 2.4); }
    for (let i = 0; i < 16; i++) { g.fillStyle = `rgba(0,0,0,${0.1 + rnd() * 0.1})`; g.fillRect(x0 + rnd() * BAND_W, rnd() * H, 12 + rnd() * 70, 18 + rnd() * 110); } // patched repairs
    for (let i = 0; i < 7; i++) { g.strokeStyle = "rgba(8,8,10,0.55)"; g.lineWidth = 1 + rnd(); g.beginPath(); let px = x0 + rnd() * BAND_W, py = rnd() * H; g.moveTo(px, py); for (let k = 0; k < 7; k++) { px += (rnd() - 0.5) * 22; py += 6 + rnd() * 18; g.lineTo(px, py); } g.stroke(); } // hairline cracks
    const lanes = b === 0 ? [0.18, 0.34, 0.66, 0.82] : b === 1 ? [0.28, 0.72] : [0.3, 0.7];
    for (const f of lanes) { g.fillStyle = "rgba(8,8,10,0.2)"; g.fillRect(x0 + BAND_W * f - 12, 0, 24, H); r.fillStyle = "rgb(0,135,0)"; r.fillRect(x0 + BAND_W * f - 12, 0, 24, H); for (let k = 0; k < 4; k++) { g.fillStyle = "rgba(10,10,10,0.35)"; g.beginPath(); g.ellipse(x0 + BAND_W * f + (rnd() - 0.5) * 8, rnd() * H, 4, 10 + rnd() * 12, 0, 0, 7); g.fill(); } } // polished wheel tracks, oil drips
    const line = (f, w, colr, dash, wear = 0.2) => { for (let y = 0; y < H; y += dash ? dash * 2 : H) { const len = dash || H; g.fillStyle = colr; g.fillRect(x0 + BAND_W * f - w / 2, y, w, len); r.fillStyle = "rgb(0,205,0)"; r.fillRect(x0 + BAND_W * f - w / 2, y, w, len); } for (let i = 0; i < 60; i++) { g.fillStyle = `rgba(30,30,34,${0.25 + rnd() * 0.4})`; g.fillRect(x0 + BAND_W * f - w / 2 + rnd() * w, rnd() * H, 1 + rnd() * 3, 2 + rnd() * 7); } };
    if (b === 0) { line(0.04, 6, "#e9e9e0"); line(0.96, 6, "#e9e9e0"); line(0.484, 5, "#f2c230"); line(0.516, 5, "#f2c230"); for (const f of [0.18, 0.34, 0.66, 0.82]) line(f + (f < 0.5 ? 0.08 : -0.08), 4, "#eeeeea", 64); }
    if (b === 1) { line(0.035, 5, "#e9e9e0"); line(0.965, 5, "#e9e9e0"); line(0.5, 6, "#f2c230", 80); line(0.25, 4, "#eee", 56); line(0.75, 4, "#eee", 56); }
    if (b === 2) { line(0.5, 5, "#e6dfc4", 72); line(0.04, 4, "rgba(230,230,224,0.55)"); line(0.96, 4, "rgba(230,230,224,0.55)"); }
    if (b === 4) { // zebra: bars run along the traffic direction, repeated across the road
      const bars = 14; for (let k = 0; k < bars; k++) { if (k % 2) continue; g.fillStyle = "#e8e8e2"; g.fillRect(x0 + (k * BAND_W) / bars + 1, 0, BAND_W / bars - 2, H); r.fillStyle = "rgb(0,205,0)"; r.fillRect(x0 + (k * BAND_W) / bars + 1, 0, BAND_W / bars - 2, H); for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(30,30,34,${0.3 + rnd() * 0.4})`; g.fillRect(x0 + (k * BAND_W) / bars + rnd() * (BAND_W / bars), rnd() * H, 2, 2 + rnd() * 6); } }
    }
  }
  grain(g, W, H, 10, rnd);
  const t = T(c); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; const m = T(rm, false); m.wrapS = THREE.ClampToEdgeWrapping; m.wrapT = THREE.RepeatWrapping; m.anisotropy = 16;
  return { map: t, rm: m };
}
