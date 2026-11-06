// Drawing helpers for the 2D kit. Everything is drawn with canvas shapes (no image files), in a bold
// "sticker" style: dark purple outlines, bright fills, glossy highlights, soft shadows.
import { TAU, clamp, mix, shade, rgba } from "./util";

export const FONT_DISPLAY = "'Bricolage Grotesque', 'Space Grotesk', system-ui, sans-serif";
export const FONT_PIXEL = "'Press Start 2P', monospace";
export const FONT_BODY = "'Space Grotesk', system-ui, sans-serif";
export const OUT = "#150a33"; // the shared outline colour

export function makeCanvas(w, h) { const c = document.createElement("canvas"); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }

export function rr(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
export function fillRR(g, x, y, w, h, r, fill, stroke, lw = 2) {
  rr(g, x, y, w, h, r); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
}
export function circle(g, x, y, r, fill, stroke, lw = 2) {
  g.beginPath(); g.arc(x, y, Math.max(0, r), 0, TAU); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
}
export function ellipse(g, x, y, rx, ry, fill, stroke, lw = 2, rot = 0) {
  g.beginPath(); g.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, TAU); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.lineWidth = lw; g.strokeStyle = stroke; g.stroke(); }
}
export function poly(g, pts, fill, stroke, lw = 2, close = true) {
  g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); if (close) g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.lineWidth = lw; g.lineJoin = "round"; g.strokeStyle = stroke; g.stroke(); }
}
export function line(g, x0, y0, x1, y1, color, w = 2, cap = "round") { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineWidth = w; g.lineCap = cap; g.strokeStyle = color; g.stroke(); }
export function starPath(g, x, y, r, pts = 5, inner = 0.5, rot = -Math.PI / 2) {
  g.beginPath(); for (let i = 0; i < pts * 2; i++) { const a = rot + (i * Math.PI) / pts, rad = i % 2 ? r * inner : r; i ? g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad) : g.moveTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } g.closePath();
}
export function star(g, x, y, r, fill = "#ffc233", stroke = OUT, lw = 2, pts = 5, inner = 0.5) { starPath(g, x, y, r, pts, inner); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.lineWidth = lw; g.lineJoin = "round"; g.strokeStyle = stroke; g.stroke(); } }
export function heart(g, x, y, s, fill = "#ff3ea5", stroke = OUT, lw = 2) {
  g.beginPath(); g.moveTo(x, y + s * 0.9); g.bezierCurveTo(x - s * 1.3, y + s * 0.1, x - s * 0.8, y - s * 0.9, x, y - s * 0.3); g.bezierCurveTo(x + s * 0.8, y - s * 0.9, x + s * 1.3, y + s * 0.1, x, y + s * 0.9); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.lineWidth = lw; g.lineJoin = "round"; g.strokeStyle = stroke; g.stroke(); }
}
export function capsule(g, x0, y0, x1, y1, w, fill, stroke, lw = 2) { // a thick rounded line (used for limbs, bones, ropes)
  g.lineCap = "round"; g.lineJoin = "round";
  if (stroke) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineWidth = w + lw * 2; g.strokeStyle = stroke; g.stroke(); }
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineWidth = w; g.strokeStyle = fill; g.stroke();
}
export function lin(g, x0, y0, x1, y1, stops) { const gr = g.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
export function rad(g, x, y, r0, r1, stops) { const gr = g.createRadialGradient(x, y, r0, x, y, r1); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
export function vgrad(g, y0, y1, stops) { return lin(g, 0, y0, 0, y1, stops); }
export function glow(g, x, y, r, color, a = 0.5) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(color, a)); gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
}
export function shadowBlob(g, x, y, rx, ry, a = 0.28) { g.save(); g.globalAlpha = a; ellipse(g, x, y, rx, ry, "#000"); g.restore(); }
// glossy highlight used on balls, gems and buttons
export function gloss(g, x, y, r, a = 0.55) { ellipse(g, x - r * 0.3, y - r * 0.38, r * 0.45, r * 0.28, `rgba(255,255,255,${a})`, null, 0, -0.5); }

export function text(g, str, x, y, o = {}) {
  const { size = 16, color = "#fff", align = "left", base = "alphabetic", font = FONT_DISPLAY, weight = 700, stroke = null, strokeW = Math.max(2, size / 6), shadow = false, alpha = 1, spacing = 0 } = o;
  g.save(); g.globalAlpha *= alpha; g.font = `${weight} ${size}px ${font}`; g.textAlign = align; g.textBaseline = base; g.lineJoin = "round";
  if (spacing && "letterSpacing" in g) g.letterSpacing = spacing + "px";
  if (shadow) { g.fillStyle = "rgba(0,0,0,.45)"; g.fillText(str, x + size / 14, y + size / 11); }
  if (stroke) { g.lineWidth = strokeW; g.strokeStyle = stroke; g.strokeText(str, x, y); }
  g.fillStyle = color; g.fillText(str, x, y); g.restore();
}
export function textWidth(g, str, size = 16, font = FONT_DISPLAY, weight = 700) { g.save(); g.font = `${weight} ${size}px ${font}`; const w = g.measureText(str).width; g.restore(); return w; }
export function wrapText(g, str, maxW, size, font = FONT_BODY, weight = 500) {
  g.save(); g.font = `${weight} ${size}px ${font}`; const words = String(str).split(/\s+/), lines = []; let cur = "";
  for (const w of words) { const t = cur ? cur + " " + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); g.restore(); return lines;
}

// ---- cached sprites: draw once into a small canvas, stamp it many times ---------------------------------------------------
const SPR = new Map();
export function cached(key, w, h, drawFn, scale = 2) {
  let c = SPR.get(key); if (c) return c;
  c = makeCanvas(w * scale, h * scale); const g = c.getContext("2d"); g.scale(scale, scale); drawFn(g, w, h); c._s = scale; SPR.set(key, c); return c;
}
export function stamp(g, c, x, y, w, h, flip = false) {
  const dw = w ?? c.width / (c._s || 1), dh = h ?? c.height / (c._s || 1);
  if (flip) { g.save(); g.translate(x + dw, y); g.scale(-1, 1); g.drawImage(c, 0, 0, dw, dh); g.restore(); } else g.drawImage(c, x, y, dw, dh);
}
export function clearCache() { SPR.clear(); }

// ---- shared HUD parts so every game's top bar looks the same ------------------------------------------------------------------
export function hudChip(g, x, y, label, value, color = "#ffc233", w = 110) {
  g.save(); fillRR(g, x, y, w, 34, 12, "rgba(14,6,36,.62)", "rgba(190,180,255,.28)", 1.5);
  text(g, label, x + 10, y + 13, { size: 9, color: "#c3bbea", font: FONT_PIXEL, weight: 400 });
  text(g, String(value), x + w - 10, y + 27, { size: 17, color, align: "right", font: FONT_DISPLAY, weight: 800 });
  g.restore();
}
export function hudHearts(g, x, y, hp, max, size = 11) {
  for (let i = 0; i < max; i++) {
    const on = i < hp, hx = x + i * (size * 2.4);
    if (on) heart(g, hx, y, size, "#ff3ea5", OUT, 2); else heart(g, hx, y, size, "rgba(60,30,90,.8)", "rgba(190,180,255,.4)", 1.5);
  }
}
export function bar(g, x, y, w, h, t, fill = "#3ee6e0", back = "rgba(14,6,36,.7)") {
  fillRR(g, x, y, w, h, h / 2, back, "rgba(190,180,255,.3)", 1.5); t = clamp(t, 0, 1);
  if (t > 0.001) { g.save(); rr(g, x + 1.5, y + 1.5, w - 3, h - 3, (h - 3) / 2); g.clip(); fillRR(g, x + 1.5, y + 1.5, (w - 3) * t, h - 3, (h - 3) / 2, fill); g.fillStyle = "rgba(255,255,255,.28)"; g.fillRect(x + 1.5, y + 1.5, (w - 3) * t, (h - 3) * 0.4); g.restore(); }
}
export function starRow(g, cx, cy, got, size = 14, gap = 6) {
  for (let i = 0; i < 3; i++) { const x = cx + (i - 1) * (size * 2 + gap); star(g, x, cy, size, i < got ? "#ffc233" : "rgba(60,30,90,.8)", i < got ? OUT : "rgba(190,180,255,.4)", 2); }
}
export { mix, shade, rgba, clamp, TAU };
