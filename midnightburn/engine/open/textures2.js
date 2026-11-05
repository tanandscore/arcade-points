// Midnight Burn — the detailed surfaces: building faces with balconies, curtains and glass, Indian shopfronts with
// signboards, billboards, neon blade signs, highway gantry boards, paving, asphalt, ground and clouds.
// Everything is painted in code. Each facade comes as three maps: colour, "lights on" (emissive) and a roughness/metal
// map, so glass shines and plaster stays matt.
import * as THREE from "three";
import { mulberry, vnoise, DISTRICTS } from "./geo";
import { IS_TOKYO } from "./mapId";

const cv = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };
function T(c, srgb = true, rep = true, aniso = 16) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; }
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r); g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h); g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r); g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath(); }
function grain(g, w, h, amt, rnd, tint = [0, 0, 0]) { const t0 = tint[0], t1 = tint[1], t2 = tint[2]; const im = g.getImageData(0, 0, w, h), d = im.data; for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * amt; d[i] += n + t0; d[i + 1] += n + t1; d[i + 2] += n + t2; } g.putImageData(im, 0, 0); }
const pick = (a, rnd) => a[Math.floor(rnd() * a.length)];
// tileable value noise (lattice of P x P cells that wraps), for textures that repeat without a seam
const ihash = (a, b, s) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(s | 0, 1274126177)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
function pnoise(u, v, P, seed) {
  const fx = u * P, fy = v * P, ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const w = (n) => ((n % P) + P) % P, a = ihash(w(ix), w(iy), seed), b = ihash(w(ix + 1), w(iy), seed), c = ihash(w(ix), w(iy + 1), seed), d = ihash(w(ix + 1), w(iy + 1), seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
// grey height canvas -> tangent-space normal map canvas (wraps at the edges). k = how steep the relief is
export function normalFromHeight(hc, k = 2) {
  const w = hc.width, h = hc.height, src = hc.getContext("2d").getImageData(0, 0, w, h).data, H = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) H[i] = src[i * 4] / 255;
  const out = cv(w, h), og = out.getContext("2d"), im = og.createImageData(w, h), d = im.data;
  for (let y = 0; y < h; y++) { const yu = ((y - 1 + h) % h) * w, yd = ((y + 1) % h) * w, yc = y * w;
    for (let x = 0; x < w; x++) { const xl = (x - 1 + w) % w, xr = (x + 1) % w; const dx = (H[yc + xr] - H[yc + xl]) * k, dy = (H[yd + x] - H[yu + x]) * k; const l = Math.hypot(dx, dy, 1), o = (yc + x) * 4;
      d[o] = (-dx / l * 0.5 + 0.5) * 255; d[o + 1] = (dy / l * 0.5 + 0.5) * 255; d[o + 2] = (1 / l * 0.5 + 0.5) * 255; d[o + 3] = 255; } }
  og.putImageData(im, 0, 0); return out;
}
const WARM = ["#ffd9a0", "#ffc874", "#fff1d0", "#ffe3b0", "#ffb866", "#ffdcb0"], COOL = ["#a8d4ff", "#c6e4ff", "#8fc0f0"], TV = ["#7aa6ff", "#9cc0ff", "#b8a0ff"];

// roughness map channels: G = roughness, B = metalness (R unused). helpers write all three at once
const R = (g, rough, metal = 0) => { g.fillStyle = `rgb(0,${rough},${metal})`; };

// ================================================================================================================================
//  RESIDENTIAL — 8 x 8 cells of 3 m x 3.2 m  (tile = 24 m x 25.6 m)
// ================================================================================================================================
function drawResidential(S, rnd, vr = 0) {
  const col = cv(S, S), em = cv(S, S), rm = cv(S, S), hc = cv(S, S), a = col.getContext("2d"), b = em.getContext("2d"), r = rm.getContext("2d"), h = hc.getContext("2d");
  const N = 8, C = S / N; const HV = (v) => { h.fillStyle = `rgb(${v},${v},${v})`; };
  a.fillStyle = ["#d6d0c4", "#d8c9a6", "#c4c2bc"][vr % 3]; a.fillRect(0, 0, S, S); HV(128); h.fillRect(0, 0, S, S);
  for (let i = 0; i < 2600; i++) { const v = 100 + rnd() * 56 | 0; h.fillStyle = `rgba(${v},${v},${v},0.5)`; h.fillRect(rnd() * S, rnd() * S, 2 + rnd() * 16, 2 + rnd() * 10); } // plaster relief b.fillStyle = "#000"; b.fillRect(0, 0, S, S); R(r, 235); r.fillRect(0, 0, S, S);
  // plaster mottling
  for (let i = 0; i < 1400; i++) { const v = 150 + rnd() * 90 | 0; a.fillStyle = `rgba(${v},${v - 5},${v - 14},0.22)`; a.fillRect(rnd() * S, rnd() * S, 4 + rnd() * 40, 3 + rnd() * 18); }
  // floor slabs (cornice lines)
  for (let y = 0; y < N; y++) { const yy = y * C + C - 8; a.fillStyle = "rgba(60,55,50,0.35)"; a.fillRect(0, yy + 6, S, 3); a.fillStyle = "rgba(255,255,255,0.28)"; a.fillRect(0, yy, S, 4); a.fillStyle = "rgba(0,0,0,0.12)"; a.fillRect(0, yy + 9, S, 5); HV(205); h.fillRect(0, yy, S, 7); HV(150); h.fillRect(0, yy + 7, S, 5); }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const x0 = x * C, y0 = y * C, kind = rnd(); const lit = rnd() < 0.5;
    const litCol = rnd() < 0.82 ? pick(WARM, rnd) : rnd() < 0.5 ? pick(COOL, rnd) : pick(TV, rnd);
    if (kind < 0.5 || kind > 0.93) { // window (one or two panes)
      const dbl = kind > 0.93; const wx = x0 + (dbl ? 12 : 26), wy = y0 + 22, ww = dbl ? 104 : 76, wh = 74;
      a.fillStyle = "rgba(0,0,0,0.18)"; a.fillRect(wx - 5, wy - 5, ww + 10, wh + 12); // recess shadow
      HV(90); h.fillRect(wx - 3, wy - 3, ww + 6, wh + 6); HV(40); h.fillRect(wx, wy, ww, wh); HV(100); h.fillRect(wx + ww / 2 - 1.5, wy, 3, wh); HV(215); h.fillRect(wx - 8, wy + wh + 3, ww + 16, 7);
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
      if (rnd() < 0.18) { HV(235); h.fillRect(wx + ww - 30, wy + wh + 10, 34, 24); a.fillStyle = "#cfd0cf"; a.fillRect(wx + ww - 30, wy + wh + 10, 34, 24); a.fillStyle = "#555"; a.fillRect(wx + ww - 26, wy + wh + 14, 26, 6); a.fillStyle = "rgba(40,40,40,0.25)"; a.fillRect(wx + ww - 18, wy + wh + 34, 6, 50); } // AC box with drip
    } else if (kind < 0.72) { // balcony with railing, sliding door, washing
      const dx = x0 + 18, dy = y0 + 10, dw = 92, dh = 70;
      HV(60); h.fillRect(dx - 3, dy - 3, dw + 6, dh + 3); HV(225); h.fillRect(x0 + 4, y0 + 84, C - 8, 10); HV(190); for (let k = 0; k < 15; k++) h.fillRect(x0 + 8 + k * 7.6, y0 + 58, 2, 27); h.fillRect(x0 + 6, y0 + 56, C - 12, 3);
      a.fillStyle = "#30343b"; a.fillRect(dx - 3, dy - 3, dw + 6, dh + 3); const gg = a.createLinearGradient(dx, dy, dx, dy + dh); gg.addColorStop(0, "#26384c"); gg.addColorStop(1, "#18222e"); a.fillStyle = gg; a.fillRect(dx, dy, dw, dh);
      r.fillStyle = "rgb(0,38,60)"; r.fillRect(dx, dy, dw, dh);
      if (lit) { b.fillStyle = litCol; b.fillRect(dx + 3, dy + 3, dw - 6, dh - 6); b.fillStyle = "rgba(0,0,0,0.3)"; b.fillRect(dx + dw / 2 - 2, dy, 4, dh); a.globalAlpha = 0.25; a.fillStyle = litCol; a.fillRect(dx, dy, dw, dh); a.globalAlpha = 1; }
      a.fillStyle = "#a8a296"; a.fillRect(x0 + 4, y0 + 84, C - 8, 10); a.fillStyle = "rgba(255,255,255,0.4)"; a.fillRect(x0 + 4, y0 + 84, C - 8, 2); a.fillStyle = "rgba(0,0,0,0.38)"; a.fillRect(x0 + 6, y0 + 94, C - 12, 6); // slab and its shadow
      a.fillStyle = "#4a4d55"; for (let k = 0; k < 15; k++) a.fillRect(x0 + 8 + k * 7.6, y0 + 58, 2, 27); a.fillRect(x0 + 6, y0 + 56, C - 12, 3); R(r, 120, 90); for (let k = 0; k < 15; k++) r.fillRect(x0 + 8 + k * 7.6, y0 + 58, 2, 27); r.fillRect(x0 + 6, y0 + 56, C - 12, 3); R(r, 235);
      if (rnd() < 0.5) { for (let k = 0; k < 1 + (rnd() * 3 | 0); k++) { a.fillStyle = pick(["#d94a4a", "#e8c340", "#4a8fd9", "#e8e8e0", "#c05bd0", "#5bbf6a"], rnd); const lx = x0 + 12 + k * 28 + rnd() * 6; a.fillRect(lx, y0 + 34, 14 + rnd() * 10, 22 + rnd() * 10); } a.fillStyle = "#555"; a.fillRect(x0 + 10, y0 + 33, C - 20, 1.5); }
      if (rnd() < 0.4) { a.fillStyle = "#2f6b34"; for (let k = 0; k < 3; k++) { a.beginPath(); a.arc(x0 + 20 + k * 36 + rnd() * 10, y0 + 76, 8 + rnd() * 5, 0, 7); a.fill(); } }
    } else if (kind < 0.8) { // shuttered window
      const wx = x0 + 28, wy = y0 + 22, ww = 72, wh = 78; const sc = pick(["#41603f", "#6a4a32", "#3f5266"], rnd);
      HV(80); h.fillRect(wx - 3, wy - 3, ww + 6, wh + 6); HV(170); h.fillRect(wx, wy, ww / 2 - 1, wh); h.fillRect(wx + ww / 2 + 1, wy, ww / 2 - 1, wh); HV(120); for (let k = 0; k < wh; k += 6) h.fillRect(wx, wy + k, ww, 2); HV(215); h.fillRect(wx - 8, wy + wh + 3, ww + 16, 7);
      a.fillStyle = "#2a2a2a"; a.fillRect(wx - 3, wy - 3, ww + 6, wh + 6); a.fillStyle = sc; a.fillRect(wx, wy, ww / 2 - 1, wh); a.fillRect(wx + ww / 2 + 1, wy, ww / 2 - 1, wh);
      a.fillStyle = "rgba(0,0,0,0.35)"; for (let k = 0; k < wh; k += 6) { a.fillRect(wx, wy + k, ww, 2); } a.fillStyle = "#b3ab9a"; a.fillRect(wx - 8, wy + wh + 3, ww + 16, 6); R(r, 170, 20); r.fillRect(wx, wy, ww, wh); R(r, 235);
    } else { // plain wall with pipe, vent or a painted advert
      if (rnd() < 0.5) { HV(235); h.fillRect(x0 + 100, y0, 7, C); a.fillStyle = "#6b6d70"; a.fillRect(x0 + 100, y0, 7, C); a.fillStyle = "rgba(255,255,255,0.3)"; a.fillRect(x0 + 101, y0, 2, C); R(r, 110, 140); r.fillRect(x0 + 100, y0, 7, C); R(r, 235); }
      else { a.fillStyle = pick(["#c9533b", "#3b7bc9", "#d8b840", "#4d9a5b"], rnd); a.fillRect(x0 + 20, y0 + 30, 88, 54); a.fillStyle = "rgba(255,255,255,0.8)"; a.font = "bold 22px Arial"; a.fillText(pick(["PAINT", "CEMENT", "TILES", "FANS"], rnd), x0 + 30, y0 + 66); }
      if (lit && rnd() < 0.4) { b.fillStyle = "#ffe2a8"; b.beginPath(); b.arc(x0 + 64, y0 + 20, 5, 0, 7); b.fill(); }
    }
  }
  // rain streaks and soot under the slabs, damp creeping up from the bottom of each floor, monsoon mould, peeling paint, efflorescence
  for (let i = 0; i < 90; i++) { const x = rnd() * S, y = rnd() * S, hh = 30 + rnd() * 140; const g2 = a.createLinearGradient(0, y, 0, y + hh); g2.addColorStop(0, "rgba(40,36,30,0.16)"); g2.addColorStop(1, "rgba(40,36,30,0)"); a.fillStyle = g2; a.fillRect(x, y, 2 + rnd() * 6, hh); }
  for (let i = 0; i < 70; i++) { const x = rnd() * S, y = rnd() * S, hh = 70 + rnd() * 210, ww2 = 5 + rnd() * 20; const g2 = a.createLinearGradient(0, y, 0, y + hh); g2.addColorStop(0, "rgba(30,34,26,0)"); g2.addColorStop(0.25, `rgba(30,38,24,${0.1 + rnd() * 0.17})`); g2.addColorStop(1, "rgba(30,34,26,0)"); a.fillStyle = g2; a.fillRect(x, y, ww2, hh); } // long dark monsoon streaks
  for (let i = 0; i < 26; i++) { const x = rnd() * S, y = rnd() * S, rr = 10 + rnd() * 40; const g2 = a.createRadialGradient(x, y, 0, x, y, rr); g2.addColorStop(0, `rgba(${60 + rnd() * 30 | 0},${80 + rnd() * 40 | 0},50,${0.1 + rnd() * 0.18})`); g2.addColorStop(1, "rgba(60,80,50,0)"); a.fillStyle = g2; a.beginPath(); a.arc(x, y, rr, 0, 7); a.fill(); } // green mould blooms
  for (let i = 0; i < 20; i++) { const x = rnd() * S, y = rnd() * S, w2 = 14 + rnd() * 46, h2 = 10 + rnd() * 36; a.fillStyle = `rgba(${200 + rnd() * 40 | 0},${190 + rnd() * 40 | 0},${170 + rnd() * 30 | 0},0.45)`; a.beginPath(); a.moveTo(x, y); for (let k = 0; k < 7; k++) a.lineTo(x + (k / 6) * w2, y + (k % 2 ? 1 : 0.2) * h2 * rnd()); a.lineTo(x + w2, y + h2 * 0.2); a.closePath(); a.fill(); HV(95); h.beginPath(); h.rect(x, y, w2, h2 * 0.6); h.fill(); } // peeling plaster flakes
  for (let y = 0; y < N; y++) { const yy = y * C + C; const gd = a.createLinearGradient(0, yy - 22, 0, yy); gd.addColorStop(0, "rgba(50,44,34,0)"); gd.addColorStop(1, "rgba(50,44,34,0.14)"); a.fillStyle = gd; a.fillRect(0, yy - 22, S, 22); }
  grain(a, S, S, 16, rnd);
  return { col, em, rm, hc, uvW: 24, uvH: 25.6 };
}

// ================================================================================================================================
//  OFFICE — curtain wall 8 x 8 cells of 3 m x 4 m  (tile = 24 m x 32 m)
// ================================================================================================================================
function drawOffice(S, rnd, vr = 0) {
  const col = cv(S, S), em = cv(S, S), rm = cv(S, S), hc = cv(S, S), a = col.getContext("2d"), b = em.getContext("2d"), r = rm.getContext("2d"), h = hc.getContext("2d");
  const N = 8, C = S / N; const HV = (v) => { h.fillStyle = `rgb(${v},${v},${v})`; }; HV(150); h.fillRect(0, 0, S, S); const TINT = [[0, 0, 0], [22, 14, -6], [-6, 16, 10]][vr % 3]; a.fillStyle = "#1c2735"; a.fillRect(0, 0, S, S); b.fillStyle = "#000"; b.fillRect(0, 0, S, S); R(r, 35, 40); r.fillRect(0, 0, S, S);
  const rowLit = Array.from({ length: N }, () => (rnd() < 0.45 ? 0.9 : rnd() < 0.5 ? 0.35 : 0.08));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const x0 = x * C, y0 = y * C, gx = x0 + 3, gy = y0 + 4, gw = C - 6, gh = C - 36;
    HV(95); h.fillRect(gx, gy, gw, gh); HV(205); h.fillRect(x0, y0 + C - 32, C, 3); HV(160); h.fillRect(x0, y0 + C - 29, C, 29);
    const g = a.createLinearGradient(gx, gy, gx + gw * 0.6, gy + gh); const sky = 0.55 + 0.45 * Math.sin((x + y * 1.7) * 0.9) + (rnd() - 0.5) * 0.12;
    g.addColorStop(0, `rgb(${54 + sky * 40 + TINT[0] | 0},${90 + sky * 50 + TINT[1] | 0},${130 + sky * 50 + TINT[2] | 0})`); g.addColorStop(0.6, "#233a52"); g.addColorStop(1, "#142130"); a.fillStyle = g; a.fillRect(gx, gy, gw, gh);
    if (rnd() < 0.2) { a.fillStyle = `rgba(${200 + rnd() * 50 | 0},${190 + rnd() * 40 | 0},${150 + rnd() * 40 | 0},${0.22 + rnd() * 0.25})`; const bl = 4 + (rnd() * 4 | 0); for (let k = 0; k < bl; k++) a.fillRect(gx, gy + (gh / bl) * k, gw, gh / bl - 3); } // blinds drawn
    if (rnd() < 0.5) { const sx2 = gx + rnd() * gw; const gr2 = a.createLinearGradient(0, gy, 0, gy + gh); gr2.addColorStop(0, "rgba(10,10,12,0)"); gr2.addColorStop(1, "rgba(10,10,12,0.24)"); a.fillStyle = gr2; a.fillRect(gx, gy, gw, gh); } // dust on the glass, thicker at the bottom
    a.fillStyle = `rgba(190,220,255,${0.05 + rnd() * 0.14})`; a.beginPath(); a.moveTo(gx, gy + gh); a.lineTo(gx + gw * 0.4, gy); a.lineTo(gx + gw * 0.62, gy); a.lineTo(gx + gw * 0.22, gy + gh); a.fill();
    // spandrel (opaque band between floors)
    a.fillStyle = "#2c3a4a"; a.fillRect(x0, y0 + C - 32, C, 32); a.fillStyle = "rgba(180,200,225,0.35)"; a.fillRect(x0, y0 + C - 32, C, 2); a.fillStyle = "rgba(0,0,0,0.3)"; a.fillRect(x0, y0 + C - 4, C, 4); R(r, 110, 150); r.fillRect(x0, y0 + C - 32, C, 32); R(r, 35, 40);
    // mullions
    HV(215); h.fillRect(x0, y0, 3, C - 32); h.fillRect(x0 + C - 3, y0, 3, C - 32); a.fillStyle = "#9aa6b4"; a.fillRect(x0, y0, 3, C - 32); a.fillRect(x0 + C - 3, y0, 3, C - 32); R(r, 85, 200); r.fillRect(x0, y0, 3, C - 32); r.fillRect(x0 + C - 3, y0, 3, C - 32); R(r, 35, 40);
    if (rnd() < rowLit[y]) { // a lit office: ceiling light strips, a desk, a screen glow
      const w = pick(WARM, rnd), c2 = rnd() < 0.55 ? pick(COOL, rnd) : w; const cl = b.createLinearGradient(0, gy, 0, gy + gh); cl.addColorStop(0, c2); cl.addColorStop(1, "rgba(80,100,130,0.9)"); b.fillStyle = cl; b.fillRect(gx, gy, gw, gh);
      b.fillStyle = "rgba(255,255,255,0.9)"; b.fillRect(gx + 6, gy + 5, gw - 12, 3); b.fillStyle = "rgba(0,0,0,0.55)"; b.fillRect(gx, gy + gh - 22, gw, 22); b.fillStyle = "#9cc8ff"; b.fillRect(gx + gw * 0.2, gy + gh - 30, 18, 10); b.fillRect(gx + gw * 0.6, gy + gh - 30, 16, 9);
      a.globalAlpha = 0.28; a.fillStyle = w; a.fillRect(gx, gy, gw, gh); a.globalAlpha = 1;
    }
  }
  for (let i = 0; i < 60; i++) { const x = rnd() * S, y = rnd() * S, hh = 60 + rnd() * 220; const g2 = a.createLinearGradient(0, y, 0, y + hh); g2.addColorStop(0, "rgba(20,24,28,0)"); g2.addColorStop(0.2, `rgba(20,24,28,${(0.12 + rnd() * 0.16) * (CLEAN ? 0.4 : 1)})`); g2.addColorStop(1, "rgba(20,24,28,0)"); a.fillStyle = g2; a.fillRect(x, y, 3 + rnd() * 9, hh); } // grime running from the spandrels over the glass
  grain(a, S, S, 10, rnd);
  return { col, em, rm, hc, uvW: 24, uvH: 32 };
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


// ================================================================================================================================
//  RESIDENTIAL, JAPAN (Upgrade 34) — a clean "mansion" block: pale tiled walls, a full-width balcony on every floor with a white parapet panel, sliding glass doors,
//  rooftop-style air-conditioner units, no stains or laundry. 8 x 8 cells of 3 m x 3.2 m  (tile = 24 m x 25.6 m)
// ================================================================================================================================
function drawResidentialJP(S, rnd, vr = 0) {
  const col = cv(S, S), em = cv(S, S), rm = cv(S, S), hc = cv(S, S), a = col.getContext("2d"), b = em.getContext("2d"), r = rm.getContext("2d"), h = hc.getContext("2d");
  const N = 8, C = S / N; const HV = (v) => { h.fillStyle = `rgb(${v},${v},${v})`; };
  const WALL = [["#e6e4dc", "#d3d0c6"], ["#d9d2c2", "#c6bdaa"], ["#cfd3d6", "#b9bec3"], ["#e2d6cc", "#cdbfb2"]][vr % 4];
  a.fillStyle = WALL[0]; a.fillRect(0, 0, S, S); b.fillStyle = "#000"; b.fillRect(0, 0, S, S); R(r, 215); r.fillRect(0, 0, S, S); HV(140); h.fillRect(0, 0, S, S);
  // tile grid on the wall
  a.strokeStyle = "rgba(90,86,78,0.12)"; a.lineWidth = 1; for (let x = 0; x < S; x += 16) { a.beginPath(); a.moveTo(x, 0); a.lineTo(x, S); a.stroke(); } for (let y = 0; y < S; y += 8) { a.beginPath(); a.moveTo(0, y); a.lineTo(S, y); a.stroke(); }
  // a darker vertical accent band running the height of the block
  const ax = ((rnd() * 5) | 0) * C + C * 0.3; a.fillStyle = WALL[1]; a.fillRect(ax, 0, C * 0.9, S);
  for (let y = 0; y < N; y++) {
    const y0 = y * C; // balcony: slab, white parapet panel, rail
    HV(215); h.fillRect(0, y0 + 88, S, 12); a.fillStyle = "#bdbab0"; a.fillRect(0, y0 + 88, S, 12); a.fillStyle = "rgba(0,0,0,0.25)"; a.fillRect(0, y0 + 100, S, 7);
    a.fillStyle = "#f4f4f0"; a.fillRect(0, y0 + 60, S, 28); HV(190); h.fillRect(0, y0 + 60, S, 28); a.fillStyle = "rgba(0,0,0,0.12)"; a.fillRect(0, y0 + 60, S, 3); a.fillStyle = "#8d9096"; a.fillRect(0, y0 + 57, S, 3);
    for (let x = 0; x < N; x++) {
      const x0 = x * C, lit = rnd() < 0.5, k = rnd();
      // sliding glass door behind the balcony
      const dx = x0 + 12, dy = y0 + 8, dw = 104, dh = 52; HV(70); h.fillRect(dx - 2, dy - 2, dw + 4, dh + 2);
      const gg = a.createLinearGradient(dx, dy, dx + dw, dy + dh); gg.addColorStop(0, "#2f4660"); gg.addColorStop(1, "#1a2634"); a.fillStyle = "#3a3f46"; a.fillRect(dx - 2, dy - 2, dw + 4, dh + 2); a.fillStyle = gg; a.fillRect(dx, dy, dw, dh);
      R(r, 40, 70); r.fillRect(dx, dy, dw, dh); R(r, 215);
      a.fillStyle = "#2a2d33"; a.fillRect(dx + dw / 2 - 1.5, dy, 3, dh);
      if (lit) { const lc = rnd() < 0.7 ? "#f6f7ee" : rnd() < 0.5 ? "#ffe9b8" : "#dbeaff"; const ig = b.createLinearGradient(0, dy, 0, dy + dh); ig.addColorStop(0, lc); ig.addColorStop(1, "rgba(150,140,120,0.85)"); b.fillStyle = ig; b.fillRect(dx + 3, dy + 3, dw - 6, dh - 5);
        if (rnd() < 0.5) { b.fillStyle = "rgba(0,0,0,0.42)"; b.fillRect(dx + 3, dy + 3, (dw - 6) * (0.25 + rnd() * 0.3), dh - 5); } b.fillStyle = "rgba(0,0,0,0.5)"; b.fillRect(dx + dw / 2 - 1.5, dy, 3, dh); a.globalAlpha = 0.22; a.fillStyle = lc; a.fillRect(dx, dy, dw, dh); a.globalAlpha = 1; }
      else { a.fillStyle = "rgba(170,195,230,0.14)"; a.beginPath(); a.moveTo(dx, dy + dh); a.lineTo(dx + dw * 0.45, dy); a.lineTo(dx + dw * 0.7, dy); a.lineTo(dx + dw * 0.25, dy + dh); a.fill(); }
      // air-conditioner outdoor unit on some balconies
      if (k < 0.3) { const ux = x0 + 78 + rnd() * 20; a.fillStyle = "#e9ebe9"; a.fillRect(ux, y0 + 66, 30, 22); a.fillStyle = "#6f7378"; a.beginPath(); a.arc(ux + 15, y0 + 77, 8, 0, 7); a.fill(); a.fillStyle = "#c9cccb"; a.fillRect(ux, y0 + 66, 30, 3); HV(235); h.fillRect(ux, y0 + 66, 30, 22); }
      else if (k > 0.9) { a.fillStyle = "#d9d9d2"; a.fillRect(x0 + 22, y0 + 92, 44, 5); } // a futon airing... just the rail line
      // fine vertical joint between bays
      a.fillStyle = "rgba(70,66,60,0.18)"; a.fillRect(x0, y0, 2, C);
    }
  }
  grain(a, S, S, 9, rnd);
  return { col, em, rm, hc, uvW: 24, uvH: 25.6 };
}


// ---- Tokyo signboard facade: the whole front of a block is hung with vertical sign stacks, billboards and LED screens, like Akihabara / Shinjuku / Shibuya at night ----
const JP_WORDS = ["ゲーム", "アニメ", "カラオケ", "居酒屋", "ラーメン", "焼肉", "メイド喫茶", "電気街", "中古", "買取", "ホテル", "マッサージ", "ドラッグ", "大特価", "セール", "営業中", "24時間", "日本一", "新装開店", "食べ放題", "飲み放題", "パチンコ", "スロット", "麻雀", "ビリヤード", "古本", "フィギュア", "カード", "ラウンジ", "クラブ", "寿司", "うどん", "回転寿司", "カフェ", "メガネ", "時計", "ブランド", "割引", "歯科", "整体"];
const SIGN_COLS = [["#e8203a", "#ffffff"], ["#ff7a1a", "#ffffff"], ["#ffd21f", "#2a1500"], ["#1fcf6a", "#031a0b"], ["#12b8d8", "#041e28"], ["#2d62ff", "#ffffff"], ["#9a2be0", "#ffffff"], ["#ff3da0", "#ffffff"], ["#f4f4ee", "#c8102e"], ["#101828", "#ffd21f"], ["#101828", "#35e0ff"]];
function drawSignFacade(S, rnd, vr = 0) {
  const col = cv(S, S), em = cv(S, S), rm = cv(S, S), hc = cv(S, S), a = col.getContext("2d"), b = em.getContext("2d"), r = rm.getContext("2d"), h = hc.getContext("2d");
  const pick = (arr) => arr[(rnd() * arr.length) | 0], HV = (v) => { h.fillStyle = `rgb(${v},${v},${v})`; };
  const WALLS = [["#4a4f58", "#3a3e46"], ["#585550", "#44413d"], ["#3c4654", "#2e3744"], ["#524a52", "#3f383f"]][vr % 4];
  a.fillStyle = WALLS[0]; a.fillRect(0, 0, S, S); b.fillStyle = "#000"; b.fillRect(0, 0, S, S); r.fillStyle = "rgb(190,190,190)"; r.fillRect(0, 0, S, S); HV(130); h.fillRect(0, 0, S, S);
  const N = 8, C = S / N;
  for (let y = 0; y < N; y++) { // plain office / apartment floors behind the signs: window ribbons, some lit
    const y0 = y * C; a.fillStyle = WALLS[1]; a.fillRect(0, y0 + 92, S, 36); HV(190); h.fillRect(0, y0 + 92, S, 6);
    for (let x = 0; x < 6; x++) { const x0 = x * 170 + 12, lit = rnd() < 0.6; a.fillStyle = "#1a2230"; a.fillRect(x0, y0 + 14, 144, 70); HV(60); h.fillRect(x0, y0 + 14, 144, 70);
      if (lit) { const lc = rnd() < 0.6 ? "#f4f6ee" : rnd() < 0.5 ? "#ffe3a8" : "#cfe6ff"; b.fillStyle = lc; b.fillRect(x0 + 4, y0 + 18, 136, 62); a.fillStyle = lc; a.globalAlpha = 0.5; a.fillRect(x0 + 4, y0 + 18, 136, 62); a.globalAlpha = 1; } }
  }
  const glow = (c, k) => { b.shadowColor = c; b.shadowBlur = k; };
  const txt = (g, str, cx, cy, maxW, px, fill, stroke) => { let f = px; do { g.font = `bold ${f}px "Noto Sans JP","Yu Gothic","Hiragino Sans",Arial,sans-serif`; f -= 3; } while (g.measureText(str).width > maxW && f > 14); g.textAlign = "center"; g.textBaseline = "middle"; if (stroke) { g.lineWidth = Math.max(3, f / 7); g.strokeStyle = stroke; g.strokeText(str, cx, cy); } g.fillStyle = fill; g.fillText(str, cx, cy); };
  const vtxt = (g, str, cx, y0, y1, fill, wmax) => { const n = str.length, step = (y1 - y0) / n, f = Math.min(wmax, step * 0.92); g.font = `bold ${f}px "Noto Sans JP","Yu Gothic",Arial,sans-serif`; g.textAlign = "center"; g.textBaseline = "middle"; g.fillStyle = fill; for (let k = 0; k < n; k++) g.fillText(str[k], cx, y0 + (k + 0.5) * step); };
  const rect = (g, x, y, w, hh, c) => { g.fillStyle = c; g.fillRect(x, y, w, hh); };
  const placed = [];
  const free = (x, y, w, hh, pad = 6) => { for (const q of placed) if (x < q[0] + q[2] + pad && x + w + pad > q[0] && y < q[1] + q[3] + pad && y + hh + pad > q[1]) return false; return true; };
  const place = (w, hh, tries = 40) => { for (let t = 0; t < tries; t++) { const x = 8 + rnd() * (S - 16 - w), y = 6 + rnd() * (S - 12 - hh); if (free(x, y, w, hh)) { placed.push([x, y, w, hh]); return [x, y]; } } return null; };
  // 1) big flat billboards, a cartoon-style face or a price burst on some
  for (let k = 0, n = 5 + ((rnd() * 3) | 0); k < n; k++) {
    const w = 230 + rnd() * 250, hh = 110 + rnd() * 120, pos = place(w, hh); if (!pos) continue; const [x, y] = pos; const [c1, c2] = pick(SIGN_COLS), [d1] = pick(SIGN_COLS);
    const gr = a.createLinearGradient(x, y, x + w, y + hh); gr.addColorStop(0, c1); gr.addColorStop(1, d1); a.fillStyle = gr; a.fillRect(x, y, w, hh); b.fillStyle = gr; glow(c1, 26); b.fillRect(x, y, w, hh); b.shadowBlur = 0;
    for (const g of [a, b]) {
      g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 4; g.strokeRect(x + 3, y + 3, w - 6, hh - 6);
      const style = rnd();
      if (style < 0.4) { const fx = x + w * 0.82, fy = y + hh * 0.5, fr = hh * 0.34; g.fillStyle = "#ffe0c8"; g.beginPath(); g.arc(fx, fy, fr, 0, 7); g.fill(); g.fillStyle = pick(["#2a1a3a", "#e83a8a", "#2a8ae8", "#ffd21f"]); g.beginPath(); g.arc(fx, fy - fr * 0.25, fr * 1.05, Math.PI, 0); g.fill(); g.fillRect(fx - fr * 1.05, fy - fr * 0.25, fr * 0.35, fr * 1.2); g.fillRect(fx + fr * 0.7, fy - fr * 0.25, fr * 0.35, fr * 1.2); g.fillStyle = "#222"; for (const ex of [-0.38, 0.38]) { g.beginPath(); g.arc(fx + fr * ex, fy + fr * 0.05, fr * 0.14, 0, 7); g.fill(); } txt(g, pick(JP_WORDS), x + w * 0.4, y + hh * 0.42, w * 0.62, hh * 0.5, "#ffffff", "#101018"); txt(g, pick(JP_WORDS), x + w * 0.4, y + hh * 0.8, w * 0.6, hh * 0.24, "#ffe94a", "#101018"); }
      else if (style < 0.7) { txt(g, pick(JP_WORDS), x + w / 2, y + hh * 0.4, w * 0.9, hh * 0.56, pick(["#ffffff", "#ffe94a"]), "#101018"); txt(g, pick(JP_WORDS) + " " + ((rnd() * 9 + 1) | 0) + "00円", x + w / 2, y + hh * 0.8, w * 0.9, hh * 0.26, "#ffffff", "#101018"); }
      else { g.fillStyle = "#ffe94a"; const bx = x + w * 0.25, by = y + hh * 0.5, br = hh * 0.42; g.beginPath(); for (let q = 0; q < 16; q++) { const an = q * Math.PI / 8, rr = q % 2 ? br * 0.72 : br; g.lineTo(bx + Math.cos(an) * rr, by + Math.sin(an) * rr); } g.closePath(); g.fill(); txt(g, "特価", bx, by, br * 1.2, br * 0.7, "#d8102e", null); txt(g, pick(JP_WORDS), x + w * 0.62, y + hh * 0.5, w * 0.5, hh * 0.52, "#ffffff", "#101018"); }
    }
    HV(235); h.fillRect(x, y, w, hh); r.fillStyle = "rgb(110,110,110)"; r.fillRect(x, y, w, hh);
  }
  // 2) tall vertical sign stacks hung out from the wall
  for (let k = 0, n = 9 + ((rnd() * 4) | 0); k < n; k++) {
    const w = 62 + rnd() * 44, hh = 200 + rnd() * 380, pos = place(w, hh); if (!pos) continue; const [x, y] = pos; const nb = Math.max(2, Math.round(hh / 130)), bh = hh / nb;
    rect(a, x - 3, y - 3, w + 6, hh + 6, "#0a0a10"); rect(b, x - 3, y - 3, w + 6, hh + 6, "#000");
    for (let q = 0; q < nb; q++) { const [c1, c2] = pick(SIGN_COLS), y0 = y + q * bh; glow(c1, 20); rect(a, x, y0 + 2, w, bh - 4, c1); rect(b, x, y0 + 2, w, bh - 4, c1); b.shadowBlur = 0; rect(b, x, y0 + 2, w, 6, "rgba(255,255,255,0.4)"); const word = pick(JP_WORDS).slice(0, 5); vtxt(a, word, x + w / 2, y0 + 8, y0 + bh - 6, c2, w * 0.74); vtxt(b, word, x + w / 2, y0 + 8, y0 + bh - 6, c2, w * 0.74); }
    HV(235); h.fillRect(x, y, w, hh); r.fillStyle = "rgb(110,110,110)"; r.fillRect(x, y, w, hh);
  }
  // 3) LED video screens and neon tube lines
  for (let k = 0; k < 2; k++) { const w = 180 + rnd() * 120, hh = 100 + rnd() * 60, pos = place(w, hh); if (!pos) continue; const [x, y] = pos; const gr = b.createLinearGradient(x, y, x + w, y + hh); const c1 = pick(["#35e0ff", "#ff3da0", "#ffd21f", "#7cff6b"]); gr.addColorStop(0, "#08101c"); gr.addColorStop(0.5, c1); gr.addColorStop(1, "#ffffff"); b.fillStyle = gr; b.fillRect(x, y, w, hh); a.fillStyle = gr; a.fillRect(x, y, w, hh); for (const g of [a, b]) { g.strokeStyle = "#0a0a10"; g.lineWidth = 6; g.strokeRect(x, y, w, hh); g.fillStyle = "rgba(255,255,255,0.8)"; for (let q = 0; q < 5; q++) g.fillRect(x + 14 + q * (w / 5.5), y + hh * (0.55 + 0.35 * rnd()), 12, hh * 0.3); } }
  for (let k = 0; k < 8; k++) { const y = 20 + rnd() * (S - 40), c1 = pick(["#35e0ff", "#ff3da0", "#ffd21f", "#ffffff"]); glow(c1, 14); b.fillStyle = c1; b.fillRect(0, y, S, 4); a.fillStyle = c1; a.globalAlpha = 0.5; a.fillRect(0, y, S, 4); a.globalAlpha = 1; } b.shadowBlur = 0;
  grain(a, S, S, 8, rnd);
  return { col, em, rm, hc, uvW: 24, uvH: 25.6 };
}

export function facadeSet(kind, seed = 5, variant = 0, withNormal = false) {
  const rnd = mulberry(seed * 31 + kind.length * 7 + variant * 1009);
  const o = kind === "sign" ? drawSignFacade(1024, rnd, variant) : kind === "res" ? (IS_TOKYO ? drawResidentialJP : drawResidential)(1024, rnd, variant) : kind === "office" ? drawOffice(1024, rnd, variant) : drawIndustrial(512, rnd);
  const rmT = T(o.rm, false); const colT = T(o.col), emT = T(o.em);
  const nm = withNormal && o.hc ? T(normalFromHeight(o.hc, kind === "office" ? 2.6 : 3.4), false) : null; // the relief of window recesses, sills, balcony slabs, plaster and mullions
  return { map: colT, em: emT, rm: rmT, nm, uvW: o.uvW, uvH: o.uvH };
}

// ================================================================================================================================
//  GROUND-FLOOR BANDS — 16.8 m x 4.2 m tiles (1024 x 256)
// ================================================================================================================================
const NEONS = ["#ff3d7f", "#35e0ff", "#ffd23a", "#7cff6b", "#ff8a2d", "#c46bff", "#ffffff"];
function fitText(g, text, maxW, px, bold = true) { let f = px; do { g.font = (bold ? "bold " : "") + f + "px Arial, sans-serif"; f -= 2; } while (g.measureText(text).width > maxW && f > 12); }
// Every kind of Mumbai shop has its own signboard colours, tagline and goods, so a street of them reads as a real bazaar
const SHOPS_MUMBAI = [
  { n: "CHAI SUTTA BAR", t: "Kadak • Garam • Roz", bg: "#c8501c", fg: "#fff2c8", glow: "#ffb060", k: "chai" },
  { n: "SHREE SWEETS", t: "Pure Ghee Mithai Since 1962", bg: "#f2e8d0", fg: "#a8101c", glow: "#ffe0a0", k: "sweets", lt: 1 },
  { n: "NEW MOBILE ZONE", t: "Repair • Cover • Recharge", bg: "#10243f", fg: "#5ad8ff", glow: "#6cc8ff", k: "mobiles" },
  { n: "APOLLO CHEMIST", t: "Medicines 24x7", bg: "#f4f7f4", fg: "#0a8a4a", glow: "#d8ffe8", k: "pharmacy", lt: 1 },
  { n: "GOLDEN JEWELLERS", t: "Gold • Diamond • Silver", bg: "#3a0a14", fg: "#ffd66b", glow: "#ffd66b", k: "jewel" },
  { n: "STYLE ZONE SALON", t: "Unisex • Bridal • Spa", bg: "#2a0f3a", fg: "#ff7be0", glow: "#e070ff", k: "salon" },
  { n: "ROYAL ELECTRONICS", t: "TV • AC • Fridge • EMI", bg: "#0c1f46", fg: "#ffe03a", glow: "#7ab0ff", k: "tv" },
  { n: "FRESH FRUIT JUICE", t: "Sugarcane • Mosambi • Shakes", bg: "#1a5a2a", fg: "#fff25a", glow: "#a0ff80", k: "fruit" },
  { n: "MASTER TAILORS", t: "Suits • Blouse • Alteration", bg: "#2a1a10", fg: "#f0d8a8", glow: "#ffc880", k: "tailor" },
  { n: "CAKE WALA BAKERY", t: "Fresh Bakes Every Morning", bg: "#f8d8e4", fg: "#b0185a", glow: "#ffd0e0", k: "bakery", lt: 1 },
  { n: "BOOK PALACE", t: "Stationery • Novels • Exams", bg: "#1c3a6a", fg: "#fff0c0", glow: "#ffe8b0", k: "books" },
  { n: "HARDWARE & PAINTS", t: "Pipes • Tools • Colour Mixing", bg: "#e8c020", fg: "#10101a", glow: "#fff0a0", k: "hardware", lt: 1 },
  { n: "ZAIKA BIRYANI", t: "Dum Biryani • Kebabs", bg: "#5a0a0a", fg: "#ffd8a0", glow: "#ff9060", k: "biryani" },
  { n: "CAFE NOIR", t: "Coffee • Waffles • Wifi", bg: "#14161c", fg: "#ff9ad0", glow: "#ffb8a0", k: "cafe" },
  { n: "FASHION HUB", t: "Kurtis • Sarees • Lehenga", bg: "#2a0a3a", fg: "#ffe0f0", glow: "#ff80c0", k: "fashion" },
  { n: "PATEL GROCERY", t: "Atta • Dal • Rice • Oil", bg: "#e8e0c0", fg: "#1a5a20", glow: "#fff0c0", k: "grocery", lt: 1 },
  { n: "VISION OPTICALS", t: "Eye Test Free • Lenses", bg: "#0a2a30", fg: "#80f0ff", glow: "#c0f8ff", k: "optical" },
  { n: "DOSA CORNER", t: "South Indian Tiffin", bg: "#e8dca0", fg: "#a01818", glow: "#ffd890", k: "chai", lt: 1 },
  { n: "PIZZA STATION", t: "Hot • Cheesy • 30 min", bg: "#a01010", fg: "#fff8e0", glow: "#ff7050", k: "biryani" },
  { n: "CITY CO-OP BANK", t: "ATM • Locker • Loans", bg: "#0a3a6a", fg: "#ffffff", glow: "#a8d4ff", k: "bank" },
  { n: "DR. SHAH CLINIC", t: "Family Physician • Lab", bg: "#f4f8fa", fg: "#1a6ab0", glow: "#d0f0ff", k: "bank", lt: 1 },
  { n: "CYCLE & TYRE MART", t: "Puncture • Tubes • Spares", bg: "#243018", fg: "#ffd030", glow: "#ffe080", k: "hardware" },
];
const SHOPS_TOKYO = [
  { n: "ラーメン 一番", t: "Ramen Ichiban • Open late", bg: "#a01810", fg: "#fff2c8", glow: "#ff9060", k: "biryani" },
  { n: "コンビニ 24", t: "Konbini • Onigiri • Coffee", bg: "#f4f7f4", fg: "#0a8a4a", glow: "#d8ffe8", k: "pharmacy", lt: 1 },
  { n: "居酒屋 さくら", t: "Izakaya Sakura • Yakitori", bg: "#2a0a0a", fg: "#ffd8a0", glow: "#ff9060", k: "chai" },
  { n: "パチンコ ラッキー", t: "Pachinko • Slot • 24h", bg: "#14061f", fg: "#ff5ad8", glow: "#ff70e0", k: "mobiles" },
  { n: "カラオケ ビッグ", t: "Karaoke • Drinks • Rooms", bg: "#10243f", fg: "#5ad8ff", glow: "#6cc8ff", k: "tv" },
  { n: "ゲームセンター", t: "Game Centre • UFO Catcher", bg: "#0c1f46", fg: "#ffe03a", glow: "#7ab0ff", k: "tv" },
  { n: "寿司 銀座", t: "Sushi Ginza • Omakase", bg: "#f2e8d0", fg: "#a8101c", glow: "#ffe0a0", k: "sweets", lt: 1 },
  { n: "家電 ヤマト", t: "Electronics • Cameras • Tax Free", bg: "#e8c020", fg: "#10101a", glow: "#fff0a0", k: "hardware", lt: 1 },
  { n: "ドラッグ ひかり", t: "Drugstore • Cosmetics", bg: "#f4f8fa", fg: "#1a6ab0", glow: "#d0f0ff", k: "bank", lt: 1 },
  { n: "カフェ 月", t: "Cafe Tsuki • Coffee • Cake", bg: "#14161c", fg: "#ff9ad0", glow: "#ffb8a0", k: "cafe" },
  { n: "本屋 青空", t: "Books • Manga • Magazines", bg: "#1c3a6a", fg: "#fff0c0", glow: "#ffe8b0", k: "books" },
  { n: "美容室 リリー", t: "Hair Salon • Cut • Colour", bg: "#2a0f3a", fg: "#ff7be0", glow: "#e070ff", k: "salon" },
  { n: "うどん 山田", t: "Udon • Soba • Tempura", bg: "#e8dca0", fg: "#a01818", glow: "#ffd890", k: "chai", lt: 1 },
  { n: "焼肉 炎", t: "Yakiniku • Wagyu • Beer", bg: "#5a0a0a", fg: "#ffd8a0", glow: "#ff9060", k: "biryani" },
  { n: "ファッション 原宿", t: "Street • Vintage • Sneakers", bg: "#2a0a3a", fg: "#ffe0f0", glow: "#ff80c0", k: "fashion" },
  { n: "薬局 みどり", t: "Pharmacy • Health", bg: "#e8e0c0", fg: "#1a5a20", glow: "#fff0c0", k: "grocery", lt: 1 },
  { n: "眼鏡 ビジョン", t: "Eyewear • Contact Lenses", bg: "#0a2a30", fg: "#80f0ff", glow: "#c0f8ff", k: "optical" },
  { n: "ベーカリー 麦", t: "Bakery • Melon Pan", bg: "#f8d8e4", fg: "#b0185a", glow: "#ffd0e0", k: "bakery", lt: 1 },
  { n: "銀行 みらい", t: "Bank • ATM • 24h", bg: "#0a3a6a", fg: "#ffffff", glow: "#a8d4ff", k: "bank" },
  { n: "100円ショップ", t: "100 Yen Shop • Everything", bg: "#e8c020", fg: "#c8102e", glow: "#fff0a0", k: "hardware", lt: 1 },
  { n: "中古車 ドリフト", t: "Used Cars • Tuning • Parts", bg: "#243018", fg: "#ffd030", glow: "#ffe080", k: "hardware" },
  { n: "ジュース 果実", t: "Fresh Juice • Smoothies", bg: "#1a5a2a", fg: "#fff25a", glow: "#a0ff80", k: "fruit" },
];
const SHOPS = IS_TOKYO ? SHOPS_TOKYO : SHOPS_MUMBAI;
function drawShops(rnd) {
  const W = 1024, H = 256, col = cv(W, H), em = cv(W, H), rm = cv(W, H), a = col.getContext("2d"), b = em.getContext("2d"), r = rm.getContext("2d");
  a.fillStyle = pick(["#cfc8bb", "#d9c9a8", "#c8b8a0", "#bcc4c0", "#d8bfb0"], rnd); a.fillRect(0, 0, W, H); b.fillStyle = "#000"; b.fillRect(0, 0, W, H); R(r, 220); r.fillRect(0, 0, W, H);
  for (let i = 0; i < 500; i++) { const v = 150 + rnd() * 80 | 0; a.fillStyle = `rgba(${v},${v - 5},${v - 12},0.2)`; a.fillRect(rnd() * W, rnd() * H, 4 + rnd() * 30, 3 + rnd() * 12); }
  const n = 4, SW = W / n; const used = new Set();
  const box = (x, y, w, h, ca, ce) => { if (ca) { a.fillStyle = ca; a.fillRect(x, y, w, h); } if (ce) { b.fillStyle = ce; b.fillRect(x, y, w, h); } };
  const dot = (x, y, rad, ca, ce) => { if (ca) { a.fillStyle = ca; a.beginPath(); a.arc(x, y, rad, 0, 7); a.fill(); } if (ce) { b.fillStyle = ce; b.beginPath(); b.arc(x, y, rad, 0, 7); b.fill(); } };
  const man = (x, y, h, cl) => { dot(x, y - h * 0.5, h * 0.09, "#d8b8a0"); a.fillStyle = cl; a.beginPath(); a.moveTo(x - h * 0.1, y - h * 0.4); a.lineTo(x + h * 0.1, y - h * 0.4); a.lineTo(x + h * 0.2, y + h * 0.3); a.lineTo(x - h * 0.2, y + h * 0.3); a.fill(); b.fillStyle = cl; b.globalAlpha = 0.5; b.beginPath(); b.moveTo(x - h * 0.1, y - h * 0.4); b.lineTo(x + h * 0.1, y - h * 0.4); b.lineTo(x + h * 0.2, y + h * 0.3); b.lineTo(x - h * 0.2, y + h * 0.3); b.fill(); b.globalAlpha = 1; };
  for (let i = 0; i < n; i++) {
    const x0 = i * SW; let sh; do { sh = SHOPS[Math.floor(rnd() * SHOPS.length)]; } while (used.has(sh.n)); used.add(sh.n);
    const kind = sh.k === "bank" ? 0.95 : rnd() < 0.2 ? 0.7 : 0.1; // mostly open; a few have the shutter down
    // pillar
    a.fillStyle = "#a59e90"; a.fillRect(x0, 0, 12, H); a.fillRect(x0 + SW - 12, 0, 12, H); R(r, 200); 
    // overhead wires and an AC box now and then
    if (rnd() < 0.5) { a.strokeStyle = "rgba(20,20,24,0.8)"; a.lineWidth = 2; a.beginPath(); a.moveTo(x0, 2); a.quadraticCurveTo(x0 + SW / 2, 14, x0 + SW, 4); a.stroke(); }
    // signboard (with its tagline), lit tube-light frame
    const sx = x0 + 18, sy = 8, sw = SW - 36, sh2 = 66;
    a.fillStyle = "#101114"; rrect(a, sx - 3, sy - 3, sw + 6, sh2 + 6, 5); a.fill(); a.fillStyle = sh.bg; rrect(a, sx, sy, sw, sh2, 4); a.fill();
    a.textAlign = "center"; a.textBaseline = "middle"; fitText(a, sh.n, sw - 18, 36); a.fillStyle = sh.fg; a.fillText(sh.n, sx + sw / 2, sy + 26);
    fitText(a, sh.t, sw - 20, 14, false); a.fillStyle = sh.fg; a.globalAlpha = 0.8; a.fillText(sh.t, sx + sw / 2, sy + 53); a.globalAlpha = 1;
    b.fillStyle = sh.lt ? "rgba(255,245,220,0.8)" : "rgba(255,255,255,0.12)"; rrect(b, sx, sy, sw, sh2, 4); b.fill(); b.textAlign = "center"; b.textBaseline = "middle"; fitText(b, sh.n, sw - 18, 36); b.fillStyle = sh.fg; b.shadowColor = sh.glow; b.shadowBlur = sh.lt ? 0 : 14; b.fillText(sh.n, sx + sw / 2, sy + 26); b.shadowBlur = 0; fitText(b, sh.t, sw - 20, 14, false); b.globalAlpha = 0.8; b.fillText(sh.t, sx + sw / 2, sy + 53); b.globalAlpha = 1;
    b.fillStyle = "rgba(255,255,255,0.6)"; b.fillRect(sx + 4, sy + sh2 - 3, sw - 8, 2); R(r, 90, 30); r.fillRect(sx, sy, sw, sh2);
    const ix = x0 + 20, iy = 86, iw = SW - 40, ih = 160;
    if (kind < 0.6) { // open front
      const dark = sh.k === "jewel" ? "#2a0a12" : sh.k === "pharmacy" || sh.k === "optical" ? "#c8d2d4" : "#1b1c20";
      a.fillStyle = dark; a.fillRect(ix, iy, iw, ih); const wl = sh.k === "pharmacy" || sh.k === "optical" ? "#f0fcff" : pick(WARM, rnd); const ig = b.createLinearGradient(0, iy, 0, iy + ih); ig.addColorStop(0, wl); ig.addColorStop(1, "rgba(150,110,70,1)"); b.fillStyle = ig; b.fillRect(ix, iy, iw, ih);
      a.globalAlpha = 0.35; a.fillStyle = wl; a.fillRect(ix, iy, iw, ih); a.globalAlpha = 1; R(r, 50, 40); r.fillRect(ix, iy, iw, ih);
      const cx = ix + iw / 2, shelf = (rows, pal, gh0 = 10) => { for (let s2 = 0; s2 < rows; s2++) { const yy = iy + 18 + s2 * (ih - 60) / rows; box(ix + 6, yy + 26, iw - 12, 5, "rgba(60,40,25,0.9)", "rgba(60,40,25,0.9)"); for (let k = 0; k < 9; k++) { const gc = pick(pal, rnd); const gw = 9 + rnd() * 12, gh = gh0 + rnd() * 14; box(ix + 8 + k * ((iw - 20) / 9), yy + 26 - gh, gw, gh, gc, gc); } } };
      switch (sh.k) {
        case "chai": box(ix + 4, iy + 100, iw - 8, 60, "#5a3a22", "#2a1a10"); dot(ix + 38, iy + 88, 18, "#b8b8c0", "#ffd890"); box(ix + 22, iy + 70, 32, 8, "#999aa2", null); for (let k = 0; k < 8; k++) box(ix + 80 + k * 14, iy + 92, 8, 14, "rgba(240,240,240,0.7)", "#fff2c0"); dot(ix + iw - 36, iy + 120, 16, "#222", "#ff8a20"); man(cx + 20, iy + 70, 90, "#e8e0d0"); break;
        case "sweets": for (let rw = 0; rw < 3; rw++) for (let k = 0; k < 6; k++) { const c1 = pick(["#f0a020", "#f8e8c0", "#e86a3a", "#f0d040", "#d84a7a", "#8acf50"], rnd); box(ix + 10 + k * ((iw - 28) / 6), iy + 22 + rw * 36, (iw - 40) / 6, 22, c1, c1); } box(ix, iy + ih - 40, iw, 40, "#f4f0e0", "#fff6e0"); break;
        case "mobiles": for (let rw = 0; rw < 3; rw++) for (let k = 0; k < 7; k++) { const sx2 = ix + 10 + k * ((iw - 20) / 7); box(sx2, iy + 18 + rw * 34, 9, 22, "#0a0a10", pick(["#7ad0ff", "#ff9ad0", "#ffe070", "#a0ffa0"], rnd)); } box(ix, iy + ih - 50, iw, 50, "#1c2a3a", "#6cc8ff"); break;
        case "pharmacy": shelf(3, ["#ffffff", "#e8f4e8", "#2aa860", "#d8e8f0"]); box(cx - 10, iy + 4, 20, 8, null, null); a.fillStyle = "#0a8a4a"; a.fillRect(cx - 4, iy + 6, 8, 24); a.fillRect(cx - 12, iy + 14, 24, 8); b.fillStyle = "#40ff90"; b.fillRect(cx - 4, iy + 6, 8, 24); b.fillRect(cx - 12, iy + 14, 24, 8); break;
        case "jewel": for (let rw = 0; rw < 3; rw++) for (let k = 0; k < 10; k++) dot(ix + 16 + k * ((iw - 32) / 9), iy + 28 + rw * 34, 4 + rnd() * 3, "#ffd66b", "#fff0a0"); box(ix, iy + ih - 36, iw, 36, "#4a0a1c", "#ffb860"); break;
        case "salon": for (let k = 0; k < 2; k++) { box(ix + 14 + k * (iw / 2 - 6), iy + 12, iw / 2 - 34, 92, "#8ac0e0", "#b8e8ff"); box(ix + 14 + k * (iw / 2 - 6), iy + 12, iw / 2 - 34, 5, "#e0d0f0", "#e0d0f0"); dot(ix + 30 + k * (iw / 2 - 6) + (iw / 2 - 60) / 2, iy + 128, 14, "#c01040", "#ff4080"); } box(ix, iy, iw, 5, "#e070ff", "#e070ff"); break;
        case "tv": for (let rw = 0; rw < 2; rw++) for (let k = 0; k < 3; k++) { const sx2 = ix + 8 + k * ((iw - 16) / 3), tw = (iw - 28) / 3; box(sx2, iy + 12 + rw * 62, tw, 54, "#05060a", pick(["#4a8aff", "#ff6a4a", "#40e0a0", "#ffd060", "#b070ff"], rnd)); } box(ix, iy + ih - 26, iw, 26, "#40444c", null); break;
        case "fruit": for (let k = 0; k < 4; k++) { const x2 = ix + 14 + k * ((iw - 20) / 4); box(x2, iy + ih - 44, (iw - 40) / 4, 36, "#8a5a2a", null); const fc = pick(["#e03a2a", "#f0902a", "#80c040", "#f0d030", "#c02060"], rnd); for (let q = 0; q < 6; q++) dot(x2 + 8 + q * 10 % 40, iy + ih - 50 - ((q % 2) * 7), 7, fc, fc); } for (let k = 0; k < 4; k++) box(ix + 20 + k * 36, iy + 14, 8, 36, "#f0d030", "#f0d030"); box(ix + 6, iy + 8, iw - 12, 4, "#503010", null); break;
        case "tailor": for (let k = 0; k < 3; k++) man(ix + 40 + k * ((iw - 80) / 2), iy + 84, 110, pick(["#c02040", "#2060b0", "#e0b020", "#40a060", "#7040b0"], rnd)); for (let k = 0; k < 9; k++) box(ix + 6 + k * ((iw - 12) / 9), iy + ih - 36, (iw - 12) / 9 - 2, 30, pick(["#c02040", "#2060b0", "#e0b020", "#40a060", "#f0f0f0"], rnd), null); break;
        case "bakery": for (let rw = 0; rw < 3; rw++) for (let k = 0; k < 5; k++) { const x2 = ix + 18 + k * ((iw - 30) / 5), y2 = iy + 30 + rw * 42; box(x2 - 12, y2 + 10, 28, 7, "#d09040", "#d09040"); dot(x2 + 2, y2 + 4, 12, pick(["#f8c0d8", "#fff4e0", "#7a4a2a", "#f0d050"], rnd), null); } break;
        case "books": shelf(3, ["#c02a2a", "#2a5ac0", "#20a060", "#e0b020", "#f0f0f0", "#7a2ac0"], 18); break;
        case "hardware": for (let k = 0; k < 8; k++) box(ix + 12 + k * ((iw - 30) / 8), iy + 14, 5, 40 + rnd() * 24, "#9aa0a8", null); for (let k = 0; k < 4; k++) { const bx = ix + 14 + k * ((iw - 20) / 4); box(bx, iy + ih - 46, 30, 36, pick(["#d83a3a", "#e8c020", "#3a7ad8", "#40a060"], rnd), null); } break;
        case "biryani": for (let k = 0; k < 3; k++) { dot(ix + 36 + k * ((iw - 60) / 2), iy + 98, 22, "#26262a", "#ff9a40"); } for (let k = 0; k < 4; k++) dot(ix + 28 + k * ((iw - 56) / 3), iy + 22, 9, "#c8201c", "#ff4030"); a.fillStyle = "rgba(255,255,255,0.18)"; for (let k = 0; k < 3; k++) a.fillRect(ix + 30 + k * ((iw - 60) / 2), iy + 40, 12, 36); break;
        case "cafe": for (let k = 0; k < 3; k++) { const x2 = ix + 28 + k * ((iw - 56) / 2); dot(x2, iy + 14, 7, "#ffe0a0", "#fff0c0"); box(x2 - 1, iy + 2, 2, 8, "#222", null); dot(x2, iy + 110, 16, "#6a4a30", null); box(x2 - 2, iy + 112, 4, 40, "#222", null); } box(ix + iw - 54, iy + 24, 44, 52, "#1c2a24", "#406a50"); break;
        case "fashion": for (let k = 0; k < 3; k++) man(ix + 36 + k * ((iw - 72) / 2), iy + 84, 120, pick(["#f040a0", "#f0a020", "#40c0f0", "#a040e0", "#40d080"], rnd)); for (let k = 0; k < 6; k++) box(ix + 6 + k * ((iw - 12) / 6), iy + 6, 3, 28, pick(["#f040a0", "#f0a020", "#40c0f0"], rnd), null); break;
        case "grocery": shelf(2, ["#e8d8a0", "#d8a850", "#f0f0e0", "#c07030"]); for (let k = 0; k < 4; k++) { a.fillStyle = pick(["#d8c090", "#c8b080", "#e0d0a8"], rnd); a.beginPath(); a.moveTo(ix + 14 + k * 54, iy + ih - 6); a.lineTo(ix + 56 + k * 54, iy + ih - 6); a.lineTo(ix + 48 + k * 54, iy + ih - 48); a.lineTo(ix + 22 + k * 54, iy + ih - 48); a.fill(); } break;
        case "optical": for (let rw = 0; rw < 3; rw++) for (let k = 0; k < 5; k++) { const x2 = ix + 14 + k * ((iw - 28) / 5), y2 = iy + 22 + rw * 36; a.strokeStyle = pick(["#202028", "#a05020", "#2060a0"], rnd); a.lineWidth = 2; a.strokeRect(x2, y2, 12, 8); a.strokeRect(x2 + 15, y2, 12, 8); } break;
        default: shelf(3, ["#d94a4a", "#e8c340", "#4a8fd9", "#f2f2ea", "#5bbf6a", "#e07b39"]);
      }
      if (!sh.lt && rnd() < 0.7 || sh.k === "chai") { const aw = SW - 28; const c1 = pick(["#c8202c", "#1f5fc8", "#d8a020", "#20a060"], rnd); for (let k = 0; k < aw; k += 18) { a.fillStyle = (k / 18) % 2 ? "#f2f2ee" : c1; a.fillRect(x0 + 14 + k, 80, 18, 24); } a.fillStyle = "rgba(0,0,0,0.3)"; a.fillRect(x0 + 14, 104, aw, 6); }
      b.fillStyle = "#fff6d0"; for (let k = 0; k < 8; k++) { b.beginPath(); b.arc(x0 + 30 + k * ((SW - 60) / 7), 80, 3.4, 0, 7); b.fill(); }
    } else if (kind < 0.9) { // rolling shutter, painted and postered
      a.fillStyle = pick(["#767b80", "#6a7a72", "#80766a"], rnd); a.fillRect(ix, iy, iw, ih + 4); a.fillStyle = "rgba(0,0,0,0.22)"; for (let k = 0; k < ih; k += 9) a.fillRect(ix, iy + k, iw, 3); a.fillStyle = "rgba(255,255,255,0.1)"; for (let k = 3; k < ih; k += 9) a.fillRect(ix, iy + k, iw, 1.5);
      R(r, 140, 190); r.fillRect(ix, iy, iw, ih);
      a.fillStyle = sh.fg; a.globalAlpha = 0.7; fitText(a, sh.n, iw - 20, 22); a.fillText(sh.n, ix + iw / 2, iy + 70); a.globalAlpha = 1;
      for (let k = 0; k < 3; k++) { a.fillStyle = pick(["#d94a8a", "#4ad9c8", "#e8c340", "#ffffff"], rnd); a.globalAlpha = 0.8; a.fillRect(ix + 8 + rnd() * (iw - 60), iy + 14 + rnd() * 100, 28 + rnd() * 30, 22 + rnd() * 40); a.globalAlpha = 1; }
      b.fillStyle = "#ffcf7a"; b.fillRect(x0 + SW / 2 - 14, 78, 28, 5);
    } else { // glass doors of a bank or clinic, with a lit panel
      a.fillStyle = "#17202a"; a.fillRect(ix, iy, iw, ih); b.fillStyle = "#a8d4ff"; b.globalAlpha = 0.55; b.fillRect(ix + 8, iy + 8, iw - 16, ih - 16); b.globalAlpha = 1; a.fillStyle = "#8c96a0"; a.fillRect(ix + iw / 2 - 2, iy, 4, ih); R(r, 30, 80); r.fillRect(ix, iy, iw, ih);
      box(ix + iw - 36, iy + 30, 26, 40, "#0a1a30", "#40a0ff"); man(ix + 40, iy + 100, 90, "#405870");
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
const ADS_MUMBAI = [
  ["VELOCE", "ENERGY DRINK", "#ff2d6f", "#ff9a3d"], ["NOVA TELECOM", "5G EVERYWHERE", "#2d6bff", "#2de2ff"], ["ZENITH", "TIMELESS WATCHES", "#101828", "#c9a24a"], ["KAAVERI TEA", "CHAI, JUST RIGHT", "#1f7a3a", "#ffd23a"],
  ["TURBO COLA", "TASTE THE FIZZ", "#c8102e", "#ff6b4a"], ["SKYBIRD AIR", "FLY FROM BOMBAY", "#0b3d91", "#7cc4ff"], ["LUNA SWEETS", "MITHAI SINCE 1948", "#6a1b9a", "#ff8ad8"], ["FLUX PHONES", "MEET THE FUTURE", "#111", "#35e0ff"],
];
const ADS_TOKYO = [
  ["ネオン ENERGY", "VOLT DRINK", "#ff2d6f", "#ff9a3d"], ["NOVA モバイル", "5G EVERYWHERE", "#2d6bff", "#2de2ff"], ["時計 ZENITH", "TIMELESS WATCHES", "#101828", "#c9a24a"], ["緑茶 SENCHA", "TEA, JUST RIGHT", "#1f7a3a", "#ffd23a"],
  ["TURBO コーラ", "TASTE THE FIZZ", "#c8102e", "#ff6b4a"], ["空の旅 SKYBIRD", "FLY FROM HANEDA", "#0b3d91", "#7cc4ff"], ["お菓子 LUNA", "SWEETS SINCE 1948", "#6a1b9a", "#ff8ad8"], ["FLUX フォン", "MEET THE FUTURE", "#111", "#35e0ff"],
];
const ADS = IS_TOKYO ? ADS_TOKYO : ADS_MUMBAI;
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
const BLADES = IS_TOKYO ? ["バー", "ホテル", "カラオケ", "居酒屋", "ラーメン", "スナック", "クラブ", "パチンコ"] : ["HOTEL", "BAR", "CAFE", "CLUB", "PIZZA", "SPA", "ROOMS", "LOUNGE"];
export function bladeAtlas() {
  const W = 1024, H = 512, c = cv(W, H), g = c.getContext("2d");
  if (IS_TOKYO) { // Japan: stacked, lit vertical boxes in mixed colours, each with its own word, like the signboard canyons of Shinjuku and Akihabara
    const WORDS = [["ラーメン", "居酒屋", "カラオケ", "バー"], ["ホテル", "スナック", "クラブ", "麻雀"], ["焼肉", "寿司", "カフェ", "薬局"], ["ゲーム", "パチンコ", "本店", "歌広場"], ["酒場", "うどん", "ネット", "漫画"], ["夜景", "ダイニング", "ビル", "営業中"], ["居酒屋", "焼鳥", "ラウンジ", "割引"], ["電気", "ホビー", "メイド", "アニメ"]];
    const PAL = [["#e8203a", "#ffffff"], ["#12b8d8", "#06222c"], ["#ffd21f", "#2a1a00"], ["#9a2be0", "#ffffff"], ["#1fcf6a", "#04200f"], ["#ff7a1a", "#ffffff"], ["#ff3da0", "#ffffff"], ["#2d62ff", "#ffffff"]];
    for (let i = 0; i < 8; i++) {
      const x = i * 128, ws = WORDS[i], n = ws.length, bh = (H - 20) / n; g.fillStyle = "#07070d"; g.fillRect(x, 0, 128, H);
      for (let k = 0; k < n; k++) {
        const [bg, fg] = PAL[(i + k * 3) % PAL.length], y0 = 10 + k * bh; g.shadowColor = bg; g.shadowBlur = 22; g.fillStyle = bg; g.fillRect(x + 14, y0 + 4, 100, bh - 8); g.shadowBlur = 0;
        g.fillStyle = "rgba(255,255,255,0.22)"; g.fillRect(x + 14, y0 + 4, 100, 7); g.strokeStyle = "rgba(255,255,255,0.9)"; g.lineWidth = 3; g.strokeRect(x + 17, y0 + 7, 94, bh - 14);
        const word = ws[k], fs = Math.min(58, (bh - 24) / word.length); g.font = `bold ${fs}px "Noto Sans JP", "Yu Gothic", Arial, sans-serif`; g.fillStyle = fg; g.textAlign = "center"; g.textBaseline = "middle";
        for (let q = 0; q < word.length; q++) g.fillText(word[q], x + 64, y0 + 14 + (q + 0.5) * ((bh - 28) / word.length));
      }
    }
    return T(c, true, false, 4);
  }
  BLADES.forEach((word, i) => {
    const x = i * 128; g.fillStyle = "#0a0a12"; g.fillRect(x, 0, 128, H); const col = NEONS[i % NEONS.length === 6 ? 0 : i % 6];
    g.strokeStyle = col; g.lineWidth = 7; g.shadowColor = col; g.shadowBlur = 18; g.strokeRect(x + 10, 10, 108, H - 20); g.shadowBlur = 14; g.fillStyle = col; g.textAlign = "center"; g.textBaseline = "middle";
    const fs = Math.min(84, (H - 60) / word.length); g.font = `bold ${fs}px Arial, sans-serif`; for (let k = 0; k < word.length; k++) g.fillText(word[k], x + 64, 50 + (k + 0.5) * ((H - 80) / word.length)); g.shadowBlur = 0;
  });
  return T(c, true, false, 4);
}
// Gantry boards name the REAL place the road leads to: one cell for every inhabited district on the map.
export const BOARD_LIST = DISTRICTS.filter((d) => d.style !== "forest").map((d) => ({ id: d.id, x: d.x, z: d.z, r: d.r, label: IS_TOKYO ? (({ })[d.id] || d.name.split(/ & |–|-/)[0].toUpperCase()) : ({ bkc: "BKC", bhiwandi: "BHIWANDI", hinjewadi: "HINJEWADI", jnpt: "JNPT PORT", sewri: "SEWRI", turbhe: "TURBHE", belapur: "BELAPUR", mira: "MIRA ROAD" })[d.id] || d.name.split(/ & |–|-/)[0].toUpperCase() }));
export const BOARD_COUNT = BOARD_LIST.length;
export const BOARD_ROWS = Math.ceil(BOARD_COUNT / 2);
export function boardAtlas() {
  const W = 1024, H = BOARD_ROWS * 128, c = cv(W, H), g = c.getContext("2d");
  BOARD_LIST.forEach(({ label }, i) => {
    const x = (i % 2) * 512, y = Math.floor(i / 2) * 128; g.fillStyle = "#0b5d3b"; g.fillRect(x, y, 512, 128); g.strokeStyle = "#f4f4ee"; g.lineWidth = 5; g.strokeRect(x + 5, y + 5, 502, 118);
    // route shield (national highway number) on the left, place name, arrow on the right
    g.textBaseline = "middle"; const nh = IS_TOKYO ? ["C1", "R1", "B", "9", "KK", "S1", "11", "3"][i % 8] : [48, 66, 160, 348, 3, 4, 548, 17][i % 8]; const sx0 = x + 22, sy0 = y + 24;
    g.fillStyle = "#1f4fa8"; g.beginPath(); g.moveTo(sx0, sy0 + 10); g.quadraticCurveTo(sx0 + 40, sy0 - 12, sx0 + 80, sy0 + 10); g.lineTo(sx0 + 74, sy0 + 62); g.quadraticCurveTo(sx0 + 40, sy0 + 92, sx0 + 6, sy0 + 62); g.closePath(); g.fill();
    g.strokeStyle = "#f4f4ee"; g.lineWidth = 4; g.stroke(); g.fillStyle = "#d8262f"; g.fillRect(sx0 + 8, sy0 + 12, 64, 18); g.fillStyle = "#f4f4ee"; g.textAlign = "center"; g.font = "bold 15px Arial"; g.fillText(IS_TOKYO ? "首都" : "NH", sx0 + 40, sy0 + 22); g.font = "bold 34px Arial"; g.fillText(String(nh), sx0 + 40, sy0 + 56);
    g.textAlign = "left"; g.fillStyle = "#f4f4ee"; fitText(g, label, 250, 56); g.fillText(label, x + 118, y + 66);
    g.beginPath(); g.moveTo(x + 400, y + 64); g.lineTo(x + 462, y + 64); g.lineTo(x + 440, y + 40); g.moveTo(x + 462, y + 64); g.lineTo(x + 440, y + 88); g.lineWidth = 9; g.strokeStyle = "#f4f4ee"; g.stroke();
  });
  return T(c, true, false, 8);
}

// ================================================================================================================================
//  PAVING, GROUND, CLOUDS, ASPHALT
// ================================================================================================================================
// Pavement: stone slabs (Kota / granite / precast mix) with chamfered edges, dirty grout, cracks, chipped corners, gum, oil and dust drifting in
// along the kerb (u = 0 is always the road side). One tile is 2.2 m across x 2.4 m along: 6 x 6 slabs. Returns the colour map and a matching height map for bump.
// a cleaner city (2046): the same textures with far less grime, patching, cracks, gum and staining
let CLEAN = false; export const setTextureClean = (v) => { CLEAN = !!v; };
export function paveSet() {
  const S = 512, N = 6, cs = S / N, c = cv(S, S), g = c.getContext("2d"), hc = cv(S, S), hg = hc.getContext("2d"), rnd = mulberry(21);
  g.fillStyle = "#26252a"; g.fillRect(0, 0, S, S); hg.fillStyle = "rgb(30,30,30)"; hg.fillRect(0, 0, S, S);
  const tones = [[116, 114, 118], [128, 120, 108], [102, 106, 112], [138, 132, 124], [96, 98, 96], [120, 112, 104]];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const t = tones[Math.floor(rnd() * tones.length)], k = 0.86 + rnd() * 0.3, jx = (rnd() - 0.5) * 3, jy = (rnd() - 0.5) * 3, X = x * cs + 2.5, Y = y * cs + 2.5, w = cs - 5, hh = cs - 5;
    g.fillStyle = `rgb(${t[0] * k | 0},${t[1] * k | 0},${t[2] * k | 0})`; g.fillRect(X + jx, Y + jy, w, hh);
    const gr = g.createLinearGradient(X, Y, X + w, Y + hh); gr.addColorStop(0, `rgba(255,255,255,${0.05 + rnd() * 0.05})`); gr.addColorStop(1, `rgba(0,0,0,${0.06 + rnd() * 0.06})`); g.fillStyle = gr; g.fillRect(X + jx, Y + jy, w, hh); // each slab slightly tilted in tone
    for (let i = 0; i < 70; i++) { const v = (rnd() > 0.5 ? 200 : 40) | 0; g.fillStyle = `rgba(${v},${v},${v},${0.04 + rnd() * 0.06})`; g.fillRect(X + rnd() * w, Y + rnd() * hh, 1 + rnd() * 3, 1 + rnd() * 3); } // stone speckle
    g.fillStyle = "rgba(255,255,255,0.12)"; g.fillRect(X + jx, Y + jy, w, 1.4); g.fillRect(X + jx, Y + jy, 1.4, hh); g.fillStyle = "rgba(0,0,0,0.25)"; g.fillRect(X + jx, Y + jy + hh - 1.4, w, 1.4); g.fillRect(X + jx + w - 1.4, Y + jy, 1.4, hh); // chamfer
    const lv = 150 + rnd() * 70 | 0; hg.fillStyle = `rgb(${lv},${lv},${lv})`; hg.fillRect(X + jx, Y + jy, w, hh);
    const bev = hg.createLinearGradient(X + jx, 0, X + jx + 5, 0); bev.addColorStop(0, "rgba(0,0,0,0.5)"); bev.addColorStop(1, "rgba(0,0,0,0)"); hg.fillStyle = bev; hg.fillRect(X + jx, Y + jy, 5, hh);
    if (rnd() < (CLEAN ? 0.03 : 0.2)) { // crack through a slab
      let px = X + rnd() * w, py = Y + jy, ex = 0; g.strokeStyle = "rgba(14,14,16,0.85)"; g.lineWidth = 1 + rnd() * 0.8; g.beginPath(); g.moveTo(px, py); hg.strokeStyle = "rgba(0,0,0,0.8)"; hg.lineWidth = 2; hg.beginPath(); hg.moveTo(px, py);
      for (let k = 0; k < 7; k++) { px += (rnd() - 0.5) * 10; py += hh / 7; g.lineTo(px, py); hg.lineTo(px, py); ex = px; } g.stroke(); hg.stroke(); }
    if (rnd() < (CLEAN ? 0.015 : 0.12)) { const cx = rnd() < 0.5 ? X + jx : X + jx + w, cy = rnd() < 0.5 ? Y + jy : Y + jy + hh; g.fillStyle = "#2a2a2e"; g.beginPath(); g.arc(cx, cy, 4 + rnd() * 5, 0, 7); g.fill(); hg.fillStyle = "rgb(50,50,50)"; hg.beginPath(); hg.arc(cx, cy, 4 + rnd() * 5, 0, 7); hg.fill(); } // chipped corner
  }
  // grout lines: dirty, with moss creeping out of some of them
  for (let i = 0; i < (CLEAN ? 5 : 40); i++) { const gx = Math.floor(rnd() * N) * cs + rnd() * 6, gy = Math.floor(rnd() * N) * cs; g.fillStyle = `rgba(${50 + rnd() * 20 | 0},${78 + rnd() * 30 | 0},36,${0.35 + rnd() * 0.3})`; g.fillRect(gx - 1, gy, 2 + rnd() * 3, 6 + rnd() * 40); }
  // stains: oil, damp, chewing-gum dots, tyre scuff, cigarette marks (no red betel splashes)
  for (let i = 0; i < (CLEAN ? 3 : 16); i++) { const x = rnd() * S, y = rnd() * S, r = 10 + rnd() * 34; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(10,10,12,${0.2 + rnd() * 0.25})`); gr.addColorStop(1, "rgba(10,10,12,0)"); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  for (let i = 0; i < (CLEAN ? 0 : 38); i++) { const x = rnd() * S, y = rnd() * S; g.fillStyle = "rgba(30,28,26,0.75)"; g.beginPath(); g.arc(x, y, 1.6 + rnd() * 1.4, 0, 7); g.fill(); g.fillStyle = "rgba(255,255,255,0.12)"; g.beginPath(); g.arc(x - 0.5, y - 0.5, 0.7, 0, 7); g.fill(); }
  // dust and sand drifting along the road side, a dark rubbed band at the building side
  const dust = g.createLinearGradient(0, 0, S * 0.22, 0); dust.addColorStop(0, CLEAN ? "rgba(120,104,84,0.14)" : "rgba(120,100,76,0.5)"); dust.addColorStop(1, "rgba(120,100,76,0)"); g.fillStyle = dust; g.fillRect(0, 0, S * 0.22, S);
  const wall = g.createLinearGradient(S * 0.88, 0, S, 0); wall.addColorStop(0, "rgba(20,20,22,0)"); wall.addColorStop(1, "rgba(20,20,22,0.4)"); g.fillStyle = wall; g.fillRect(S * 0.88, 0, S * 0.12, S);
  for (let i = 0; i < (CLEAN ? 30 : 240); i++) { g.fillStyle = `rgba(140,118,90,${0.1 + rnd() * 0.2})`; g.fillRect(rnd() * S * 0.28, rnd() * S, 1 + rnd() * 2, 1 + rnd() * 2); }
  grain(g, S, S, 20, rnd);
  const map = T(c, true, true, 8), bump = T(hc, false, true, 8); return { map, bump };
}
export function paveTexture() { return paveSet().map; }
export function groundDetail() {
  // grey detail multiplied into the terrain's green / brown vertex colours: blotchy soil, short blade streaks, leaf litter and pebbles (tiles seamlessly)
  const S = 512, c = cv(S, S), g = c.getContext("2d"), rnd = mulberry(8); g.fillStyle = "#d8d8d8"; g.fillRect(0, 0, S, S);
  const wrapDraw = (x, y, r, fn) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { const X = x + ox, Y = y + oy; if (X < -r || X > S + r || Y < -r || Y > S + r) continue; fn(X, Y); } };
  for (let i = 0; i < 900; i++) { const v = 150 + rnd() * 105 | 0, r = 3 + rnd() * 26; wrapDraw(rnd() * S, rnd() * S, r, (X, Y) => { g.fillStyle = `rgba(${v},${v},${v},0.34)`; g.beginPath(); g.ellipse(X, Y, r, r * (0.5 + rnd() * 0.5), rnd() * 3, 0, 7); g.fill(); }); } // blotchy soil and moss
  for (let i = 0; i < 4200; i++) { const v = 90 + rnd() * 150 | 0, l = 3 + rnd() * 9; wrapDraw(rnd() * S, rnd() * S, l, (X, Y) => { g.strokeStyle = `rgba(${v},${v},${v},0.5)`; g.lineWidth = 0.8 + rnd() * 0.8; g.beginPath(); g.moveTo(X, Y); g.lineTo(X + (rnd() - 0.5) * 3, Y - l); g.stroke(); }); } // blades
  for (let i = 0; i < 420; i++) { const v = 70 + rnd() * 80 | 0, l = 2 + rnd() * 4; wrapDraw(rnd() * S, rnd() * S, l, (X, Y) => { g.fillStyle = `rgba(${v},${v - 6},${v - 12},0.55)`; g.beginPath(); g.ellipse(X, Y, l, l * 0.5, rnd() * 3, 0, 7); g.fill(); }); } // leaf litter
  for (let i = 0; i < 260; i++) { const v = 200 + rnd() * 55 | 0, r = 0.8 + rnd() * 1.8; wrapDraw(rnd() * S, rnd() * S, r, (X, Y) => { g.fillStyle = `rgba(${v},${v},${v},0.7)`; g.beginPath(); g.arc(X, Y, r, 0, 7); g.fill(); }); } // pebbles
  grain(g, S, S, 30, rnd); return T(c, true, true, 8);
}
// precast concrete panels: joint lines on the tile border, tie-bolt holes, rain streaks running down from the top, scuffs and grime near the bottom, speckle
export function concreteTexture() {
  const S = 256, c = cv(S, S), g = c.getContext("2d"), rnd = mulberry(55); g.fillStyle = "#b9b9bd"; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 380; i++) { const v = 150 + rnd() * 70 | 0; g.fillStyle = `rgba(${v},${v},${v + 3},0.3)`; g.beginPath(); g.ellipse(rnd() * S, rnd() * S, 4 + rnd() * 26, 3 + rnd() * 18, rnd() * 3, 0, 7); g.fill(); }
  for (let i = 0; i < 46; i++) { const x = rnd() * S, w = 2 + rnd() * 10, len = 50 + rnd() * 170, a = 0.05 + rnd() * 0.16; const gr = g.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, `rgba(40,36,32,${a})`); gr.addColorStop(1, "rgba(40,36,32,0)"); g.save(); g.translate(x, rnd() * S * 0.4); g.fillStyle = gr; g.fillRect(0, 0, w, len); g.restore(); } // rain streaks
  const gb = g.createLinearGradient(0, S * 0.72, 0, S); gb.addColorStop(0, "rgba(50,44,36,0)"); gb.addColorStop(1, "rgba(50,44,36,0.36)"); g.fillStyle = gb; g.fillRect(0, S * 0.72, S, S * 0.28); // road grime near the bottom
  for (let gx = 0; gx < 2; gx++) for (let gy = 0; gy < 2; gy++) { const x = 64 + gx * 128, y = 64 + gy * 128; g.fillStyle = "rgba(40,40,44,0.65)"; g.beginPath(); g.arc(x, y, 3.2, 0, 7); g.fill(); g.fillStyle = "rgba(255,255,255,0.18)"; g.beginPath(); g.arc(x - 0.8, y - 0.8, 2, 3.4, 5.4); g.fill(); } // tie holes
  g.fillStyle = "rgba(38,38,42,0.7)"; g.fillRect(0, 0, S, 2.4); g.fillRect(0, 0, 2.4, S); g.fillStyle = "rgba(255,255,255,0.16)"; g.fillRect(0, 2.4, S, 1.6); g.fillRect(2.4, 0, 1.6, S); // panel joints
  grain(g, S, S, 22, rnd); return T(c, true, true, 8);
}
// crushed stone and dust for road shoulders and forest tracks, with a few tufts of green creeping in
export function gravelTexture() {
  const S = 256, c = cv(S, S), g = c.getContext("2d"), rnd = mulberry(66); g.fillStyle = "#8a8070"; g.fillRect(0, 0, S, S);
  const wrapDraw = (x, y, r, fn) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { const X = x + ox, Y = y + oy; if (X < -r || X > S + r || Y < -r || Y > S + r) continue; fn(X, Y); } };
  for (let i = 0; i < 260; i++) { const v = 90 + rnd() * 80 | 0, r = 6 + rnd() * 24; wrapDraw(rnd() * S, rnd() * S, r, (X, Y) => { g.fillStyle = `rgba(${v + 10},${v},${v - 18},0.3)`; g.beginPath(); g.ellipse(X, Y, r, r * 0.6, rnd() * 3, 0, 7); g.fill(); }); }
  for (let i = 0; i < 2600; i++) { const v = 70 + rnd() * 140 | 0, r = 0.8 + rnd() * 2.4; wrapDraw(rnd() * S, rnd() * S, r, (X, Y) => { g.fillStyle = `rgba(${v},${v - 6},${v - 18},${0.6 + rnd() * 0.4})`; g.beginPath(); g.ellipse(X, Y, r, r * (0.6 + rnd() * 0.4), rnd() * 3, 0, 7); g.fill(); }); }
  for (let i = 0; i < 90; i++) { wrapDraw(rnd() * S, rnd() * S, 6, (X, Y) => { g.strokeStyle = `rgba(${50 + rnd() * 40 | 0},${90 + rnd() * 50 | 0},40,0.6)`; g.lineWidth = 1; g.beginPath(); g.moveTo(X, Y); g.lineTo(X + (rnd() - 0.5) * 5, Y - 3 - rnd() * 5); g.stroke(); }); }
  grain(g, S, S, 26, rnd); return T(c, true, true, 8);
}
export function cloudTexture() {
  const W = 512, H = 256, c = cv(W, H), g = c.getContext("2d"), im = g.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W * 14, v = y / H * 5; let n = vnoise(u, v, 3) * 0.55 + vnoise(u * 2.1, v * 2.1, 7) * 0.3 + vnoise(u * 4.4, v * 4.4, 11) * 0.15; n = Math.max(0, Math.min(1, (n - 0.5) * 3.4 + 0.4)); const edge = Math.min(1, y / (H * 0.35)) * Math.min(1, (H - y) / (H * 0.2));
    const i = (y * W + x) * 4; im.data[i] = 150; im.data[i + 1] = 165; im.data[i + 2] = 215; im.data[i + 3] = n * 210 * edge;
  }
  g.putImageData(im, 0, 0); const t = T(c, true, false, 2); t.wrapS = THREE.RepeatWrapping; return t;
}

// Asphalt micro-detail, sampled in WORLD space by the road shader (so it is sharp at any road width): R = grit height (stones, tar, pits),
// G = broad blotches (patched tarmac, oil, damp) that also steer where puddles form, B = bright chips of aggregate. Tiles every 1.8 m / 23 m (see render.js).
export function asphaltDetail() {
  const S = 512, c = cv(S, S), g = c.getContext("2d"), rnd = mulberry(404);
  g.fillStyle = "rgb(120,120,120)"; g.fillRect(0, 0, S, S);
  const wrapDraw = (x, y, r, fn) => { for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { const X = x + ox, Y = y + oy; if (X < -r || X > S + r || Y < -r || Y > S + r) continue; fn(X, Y); } };
  for (let i = 0; i < 4200; i++) { const v = 80 + rnd() * 150 | 0, r = 1.6 + rnd() * 3.4; wrapDraw(rnd() * S, rnd() * S, r, (X, Y) => { const gr = g.createRadialGradient(X - r * 0.25, Y - r * 0.25, 0, X, Y, r); gr.addColorStop(0, `rgba(${v},${v},${v},0.95)`); gr.addColorStop(1, `rgba(${v * 0.55 | 0},${v * 0.55 | 0},${v * 0.55 | 0},0.9)`); g.fillStyle = gr; g.beginPath(); g.ellipse(X, Y, r, r * (0.65 + rnd() * 0.35), rnd() * 3, 0, 7); g.fill(); }); }
  const im = g.getImageData(0, 0, S, S), d = im.data, hc = cv(S, S), hg = hc.getContext("2d"), him = hg.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const i = (y * S + x) * 4, u = x / S, v = y / S; const n = (rnd() - 0.5) * 14 + (pnoise(u, v, 64, 5) - 0.5) * 34; d[i] = Math.max(0, Math.min(255, d[i] + n)); him.data[i] = him.data[i + 1] = him.data[i + 2] = d[i]; him.data[i + 3] = 255;
    const macro = pnoise(u, v, 4, 1) * 0.5 + pnoise(u, v, 8, 2) * 0.3 + pnoise(u, v, 16, 3) * 0.2; d[i + 1] = macro * 255;
    d[i + 2] = rnd() > 0.996 ? 255 : rnd() > 0.985 ? 150 : 40; d[i + 3] = 255;
  }
  g.putImageData(im, 0, 0); hg.putImageData(him, 0, 0);
  const mk = (cc) => { const t = new THREE.CanvasTexture(cc); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
  return { map: mk(c), nrm: mk(normalFromHeight(hc, 3.2)) };
}

// Asphalt atlas: five bands side by side (motorway, avenue, street, plain, zebra crossing), 256 px wide each, 16 m tall.
export const BAND_W = 256, BAND_N = 5, ATLAS_W = BAND_W * BAND_N, BAND_H = 512;
export const ROAD_BAND = { hwy: 0, art: 1, str: 2, plain: 3, zebra: 4 };
export function roadSet() {
  // painted at double resolution (everything below is drawn in the old 256 x 512 units): lane lines and cracks stay sharp
  const W = ATLAS_W, H = BAND_H, c = cv(W * 2, H * 2), g = c.getContext("2d"), rm = cv(W * 2, H * 2), r = rm.getContext("2d"), rnd = mulberry(77);
  g.scale(2, 2); r.scale(2, 2);
  R(r, 190); r.fillRect(0, 0, W, H);
  for (let b = 0; b < BAND_N; b++) {
    const x0 = b * BAND_W; g.fillStyle = "#26262c"; g.fillRect(x0, 0, BAND_W, H);
    // aggregate and tar
    for (let i = 0; i < 5200; i++) { const v = 24 + (rnd() * 46 | 0); g.fillStyle = `rgba(${v},${v},${v + 4},0.75)`; g.fillRect(x0 + rnd() * BAND_W, rnd() * H, 1 + rnd() * 2.4, 1 + rnd() * 2.4); }
    for (let i = 0; i < (CLEAN ? 3 : 16); i++) { g.fillStyle = `rgba(0,0,0,${0.1 + rnd() * 0.1})`; g.fillRect(x0 + rnd() * BAND_W, rnd() * H, 12 + rnd() * 70, 18 + rnd() * 110); } // patched repairs
    for (let i = 0; i < (CLEAN ? 1 : 7); i++) { g.strokeStyle = "rgba(8,8,10,0.55)"; g.lineWidth = 1 + rnd(); g.beginPath(); let px = x0 + rnd() * BAND_W, py = rnd() * H; g.moveTo(px, py); for (let k = 0; k < 7; k++) { px += (rnd() - 0.5) * 22; py += 6 + rnd() * 18; g.lineTo(px, py); } g.stroke(); } // hairline cracks
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
  // wear and street life: polished wheel tracks, oil drips, a pothole, manhole covers, dusty edges, hairline cracks
  for (let b = 0; b < BAND_N; b++) {
    const x0 = b * BAND_W;
    const trk = b === 0 ? [0.18, 0.34, 0.66, 0.82] : [0.3, 0.7];
    for (const f of trk) for (const o of [-0.035, 0.035]) { const gx = x0 + BAND_W * (f + o); const gr = g.createLinearGradient(gx - 7, 0, gx + 7, 0); gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, "rgba(255,255,255,0.05)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(gx - 7, 0, 14, H); r.fillStyle = "rgb(0,120,0)"; r.globalAlpha = 0.35; r.fillRect(gx - 5, 0, 10, H); r.globalAlpha = 1; }
    for (let i = 0; i < (CLEAN ? 5 : 26); i++) { const f = trk[Math.floor(rnd() * trk.length)]; const cx = x0 + BAND_W * (f + (rnd() - 0.5) * 0.12), cy = rnd() * H; g.fillStyle = `rgba(0,0,0,${0.12 + rnd() * 0.16})`; g.beginPath(); g.ellipse(cx, cy, 2 + rnd() * 6, 3 + rnd() * 9, rnd() * 3, 0, 7); g.fill(); r.fillStyle = "rgb(0,95,0)"; r.beginPath(); r.ellipse(cx, cy, 2 + rnd() * 5, 3 + rnd() * 8, 0, 0, 7); r.fill(); }
    for (let i = 0; i < 2; i++) { const cx = x0 + BAND_W * (0.2 + rnd() * 0.6), cy = 30 + rnd() * (H - 60); g.fillStyle = "#2f2f35"; g.beginPath(); g.arc(cx, cy, 8, 0, 7); g.fill(); g.strokeStyle = "#17171b"; g.lineWidth = 1.6; g.beginPath(); g.arc(cx, cy, 8, 0, 7); g.moveTo(cx - 8, cy); g.lineTo(cx + 8, cy); g.moveTo(cx, cy - 8); g.lineTo(cx, cy + 8); g.stroke(); g.strokeStyle = "rgba(255,255,255,0.12)"; g.beginPath(); g.arc(cx, cy, 6.2, 0.3, 2.2); g.stroke(); r.fillStyle = "rgb(0,70,210)"; r.beginPath(); r.arc(cx, cy, 8, 0, 7); r.fill(); }
    if (!CLEAN) { const cx = x0 + BAND_W * (0.25 + rnd() * 0.5), cy = 40 + rnd() * (H - 80); g.fillStyle = "rgba(0,0,0,0.5)"; g.beginPath(); g.ellipse(cx, cy, 10, 6, 0.4, 0, 7); g.fill(); g.strokeStyle = "rgba(120,120,125,0.35)"; g.lineWidth = 1.2; g.beginPath(); g.ellipse(cx, cy, 11.5, 7.5, 0.4, 0, 7); g.stroke(); r.fillStyle = "rgb(0,230,0)"; r.beginPath(); r.ellipse(cx, cy, 10, 6, 0.4, 0, 7); r.fill(); }
    if (b !== 4) for (const sd of [0, 1]) { const ex = sd ? x0 + BAND_W - 16 : x0; const eg = g.createLinearGradient(sd ? ex + 16 : ex, 0, sd ? ex : ex + 16, 0); eg.addColorStop(0, CLEAN ? "rgba(96,84,66,0.1)" : "rgba(96,80,58,0.38)"); eg.addColorStop(1, "rgba(96,80,58,0)"); g.fillStyle = eg; g.fillRect(ex, 0, 16, H); }
    for (let i = 0; i < (CLEAN ? 3 : 14); i++) { g.strokeStyle = `rgba(6,6,8,${0.35 + rnd() * 0.3})`; g.lineWidth = 0.6; g.beginPath(); let px = x0 + rnd() * BAND_W, py = rnd() * H; g.moveTo(px, py); for (let k = 0; k < 9; k++) { px += (rnd() - 0.5) * 14; py += 3 + rnd() * 10; g.lineTo(px, py); } g.stroke(); }
    for (let i = 0; i < (CLEAN ? 1 : 6); i++) { const px = x0 + rnd() * (BAND_W - 60), py = rnd() * (H - 90), pw = 24 + rnd() * 50, ph = 30 + rnd() * 70, v = 14 + rnd() * 14 | 0; g.fillStyle = `rgba(${v},${v},${v + 3},0.55)`; g.fillRect(px, py, pw, ph); g.strokeStyle = "rgba(0,0,0,0.5)"; g.lineWidth = 0.7; g.strokeRect(px, py, pw, ph); }
    for (let i = 0; i < 9000; i++) { const v = 20 + (rnd() * 70 | 0); g.fillStyle = `rgba(${v},${v},${v + 3},0.55)`; g.fillRect(x0 + rnd() * BAND_W, rnd() * H, 0.5 + rnd() * 0.9, 0.5 + rnd() * 0.9); } // fine grit
    // (Upgrade 37: the dark "expansion joint" line that used to cross the motorway and avenue bands every 8 m is gone. On a ground-level road it read as a crack across the lane, and from a distance it shimmered like a seam.)
    for (let i = 0; i < (CLEAN ? 0 : 3); i++) { // tar snakes: cracks that were filled with glossy black sealant
      let px = x0 + 20 + rnd() * (BAND_W - 40), py = rnd() * H; g.strokeStyle = "rgba(3,3,5,0.88)"; g.lineWidth = 2 + rnd() * 1.4; g.lineJoin = "round"; g.beginPath(); g.moveTo(px, py); r.strokeStyle = "rgb(0,60,0)"; r.lineWidth = g.lineWidth; r.beginPath(); r.moveTo(px, py);
      for (let k = 0; k < 10; k++) { px += (rnd() - 0.5) * 24; py += 14 + rnd() * 20; g.lineTo(px, py); r.lineTo(px, py); } g.stroke(); r.stroke(); }
    if (b !== 4 && !CLEAN) for (let i = 0; i < 2; i++) { // trench repairs across the lane: a rougher, slightly darker strip with a seam round it
      const tw = BAND_W * (0.34 + rnd() * 0.3), tx = x0 + rnd() * (BAND_W - tw), ty = 30 + rnd() * (H - 70), th = 9 + rnd() * 12; g.fillStyle = "rgba(14,14,17,0.7)"; g.fillRect(tx, ty, tw, th); g.strokeStyle = "rgba(2,2,3,0.85)"; g.lineWidth = 1.5; g.strokeRect(tx, ty, tw, th); g.strokeStyle = "rgba(130,130,136,0.16)"; g.lineWidth = 0.8; g.strokeRect(tx - 1.6, ty - 1.6, tw + 3.2, th + 3.2); r.fillStyle = "rgb(0,225,0)"; r.fillRect(tx, ty, tw, th);
    }
  }
  grain(g, W * 2, H * 2, 12, rnd);
  const t = T(c); t.wrapS = THREE.ClampToEdgeWrapping; t.wrapT = THREE.RepeatWrapping; t.anisotropy = 16; const m = T(rm, false); m.wrapS = THREE.ClampToEdgeWrapping; m.wrapT = THREE.RepeatWrapping; m.anisotropy = 16;
  return { map: t, rm: m };
}

// ---- foliage cards: a puff of leaves and a palm frond, painted with transparent edges so trees have a real, sharp leafy outline ----------
export function leafTexture() {
  const S = 256, c = cv(S, S), g = c.getContext("2d"), rnd = mulberry(311);
  g.clearRect(0, 0, S, S);
  const cols = ["#ffffff", "#e2ecd6", "#c8dcb4", "#f2f6ea"];
  for (let i = 0; i < 260; i++) { // leaf shapes scattered inside a soft round cluster
    const a = rnd() * 6.283, d = Math.sqrt(rnd()) * 112, x = 128 + Math.cos(a) * d, y = 128 + Math.sin(a) * d * 0.92, ang = rnd() * 6.283, l = 14 + rnd() * 16, w = 5 + rnd() * 5;
    g.save(); g.translate(x, y); g.rotate(ang); g.fillStyle = pick(cols, rnd); g.globalAlpha = 0.72 + rnd() * 0.28; g.beginPath(); g.ellipse(0, 0, l, w, 0, 0, 6.283); g.fill();
    g.strokeStyle = "rgba(40,60,30,0.55)"; g.lineWidth = 1; g.beginPath(); g.moveTo(-l * 0.9, 0); g.lineTo(l * 0.9, 0); g.stroke(); g.restore();
  }
  g.globalAlpha = 1; return T(c, true, false, 16);
}
export function frondTexture() {
  const W = 256, H = 96, c = cv(W, H), g = c.getContext("2d");
  g.clearRect(0, 0, W, H); g.strokeStyle = "#e8f0d8"; g.fillStyle = "#e8f0d8"; g.lineWidth = 3; g.beginPath(); g.moveTo(0, H / 2); g.quadraticCurveTo(W * 0.5, H / 2 - 4, W - 4, H / 2 + 6); g.stroke();
  for (let i = 0; i < 46; i++) { const x = 6 + (i / 46) * (W - 24), len = (1 - (i / 46) * 0.8) * 40 + 6, y = H / 2 - 2 + (i / 46) * 5; for (const s of [-1, 1]) { g.lineWidth = 2.2; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 8, y + s * len * 0.6, x + 15, y + s * len); g.stroke(); } }
  return T(c, true, false, 16);
}
