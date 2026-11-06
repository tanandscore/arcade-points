// Gem Garden: every picture is drawn here with canvas shapes (no image files). Sprites are drawn once and stamped.
import { cached, rr, fillRR, circle, ellipse, poly, line, star, lin, rad, glow, gloss, text, OUT, FONT_DISPLAY, FONT_PIXEL } from "../../core/draw";
import { shade, rgba, TAU, clamp } from "../../core/util";

export const GEMS = [
  { name: "Ruby", c: "#ff4d6d" },
  { name: "Sapphire", c: "#3f9bff" },
  { name: "Emerald", c: "#34d17a" },
  { name: "Topaz", c: "#ffc42e" },
  { name: "Amethyst", c: "#b05cff" },
  { name: "Rose", c: "#ff8ad2" },
];

// each colour has its own shape as well, so they can be told apart without relying on colour
function shape(k, cx, cy, r) {
  const pts = [];
  if (k === 0) for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + (i * Math.PI) / 4; pts.push([cx + Math.cos(a) * r * 1.04, cy + Math.sin(a) * r * 1.04]); }
  else if (k === 1) for (let i = 0; i < 40; i++) { const a = (i * TAU) / 40; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
  else if (k === 2) for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 3; pts.push([cx + Math.cos(a) * r * 1.06, cy + Math.sin(a) * r * 1.06]); }
  else if (k === 3) for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + (i * TAU) / 3; pts.push([cx + Math.cos(a) * r * 1.2, cy + r * 0.16 + Math.sin(a) * r * 1.2]); }
  else if (k === 4) pts.push([cx, cy - r * 1.14], [cx + r * 0.88, cy], [cx, cy + r * 1.14], [cx - r * 0.88, cy]);
  else for (let i = 0; i < 72; i++) { const a = (i * TAU) / 72, d = r * (0.84 + 0.17 * Math.cos(6 * a)); pts.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d]); }
  return pts;
}

function gemBody(g, k, cx, cy, r) {
  const col = GEMS[k].c, pts = shape(k, cx, cy, r), inner = shape(k, cx, cy, r * 0.6);
  poly(g, pts, lin(g, cx - r, cy - r, cx + r, cy + r, [[0, shade(col, 0.5)], [0.5, col], [1, shade(col, -0.5)]]), OUT, 3.2);
  g.save(); g.lineJoin = "round"; g.strokeStyle = "rgba(255,255,255,.34)"; g.lineWidth = 1.4;
  if (k === 1 || k === 5) { const n = k === 1 ? 8 : 6; for (let i = 0; i < n; i++) { const a = (i * TAU) / n + (k === 1 ? TAU / 16 : 0); line(g, cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6, cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92, "rgba(255,255,255,.3)", 1.3); } }
  else for (let i = 0; i < pts.length; i++) line(g, pts[i][0] * 0.985 + cx * 0.015, pts[i][1] * 0.985 + cy * 0.015, inner[i][0], inner[i][1], "rgba(255,255,255,.32)", 1.3);
  poly(g, inner, lin(g, cx - r * 0.6, cy - r * 0.6, cx + r * 0.6, cy + r * 0.6, [[0, shade(col, 0.82)], [0.55, shade(col, 0.12)], [1, shade(col, -0.1)]]), "rgba(255,255,255,.5)", 1.4);
  g.restore();
  gloss(g, cx, cy - r * 0.02, r, 0.62);
  star(g, cx - r * 0.46, cy - r * 0.5, r * 0.2, "#ffffff", null, 0, 4, 0.32);
}

function lineBand(g, cx, cy, r, horizontal, col) {
  g.save(); g.translate(cx, cy); if (!horizontal) g.rotate(Math.PI / 2);
  fillRR(g, -r * 1.08, -r * 0.36, r * 2.16, r * 0.72, r * 0.34, "rgba(255,255,255,.9)", OUT, 2.6);
  poly(g, [[-r * 0.86, 0], [-r * 0.44, -r * 0.22], [-r * 0.44, r * 0.22]], shade(col, -0.5), null);
  poly(g, [[r * 0.86, 0], [r * 0.44, -r * 0.22], [r * 0.44, r * 0.22]], shade(col, -0.5), null);
  circle(g, 0, 0, r * 0.15, shade(col, -0.5));
  g.restore();
}

// type: g (plain) | lh | lv | bl
export function gemSprite(k, t = "g") {
  return cached(`gem${k}${t}`, 64, 64, (g) => {
    const cx = 32, cy = 33, r = 21.5, col = GEMS[k].c;
    if (t === "bl") { star(g, cx, cy, r * 1.4, "rgba(255,255,255,.96)", OUT, 2.6, 8, 0.6); star(g, cx, cy, r * 1.14, shade(col, 0.35), null, 0, 8, 0.66); }
    gemBody(g, k, cx, cy, t === "bl" ? r * 0.88 : r);
    if (t === "lh") lineBand(g, cx, cy, r, true, col);
    if (t === "lv") lineBand(g, cx, cy, r, false, col);
    if (t === "bl") { star(g, cx, cy, r * 0.55, "#ffffff", OUT, 2, 4, 0.34); circle(g, cx, cy, r * 0.13, shade(col, -0.2)); }
  }, 2);
}

export function drawPrism(g, cx, cy, r, t) {
  g.save(); g.translate(cx, cy);
  glow(g, 0, 0, r * 1.9, "#ffffff", 0.35);
  g.save(); g.rotate(t * 1.3);
  for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, r, (i * TAU) / 6, ((i + 1) * TAU) / 6); g.closePath(); g.fillStyle = GEMS[i].c; g.fill(); }
  g.restore();
  circle(g, 0, 0, r, null, OUT, 3.2);
  const gr = g.createRadialGradient(-r * 0.3, -r * 0.34, 1, 0, 0, r); gr.addColorStop(0, "rgba(255,255,255,.95)"); gr.addColorStop(0.45, "rgba(255,255,255,.3)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
  for (let i = 0; i < 3; i++) { const a = t * 2.2 + (i * TAU) / 3; star(g, Math.cos(a) * r * 0.82, Math.sin(a) * r * 0.82, r * 0.2, "#ffffff", null, 0, 4, 0.34); }
  g.restore();
}

// crates: the less health they have left, the more beaten up they look
export function crateSprite(hp, max) {
  return cached(`crate${hp}/${max}`, 64, 64, (g) => {
    const steel = hp >= 3, iron = hp === 2, wood = steel ? "#8393bd" : iron ? "#b97a3e" : "#d99a58", dark = steel ? "#3f4c78" : iron ? "#6e4217" : "#8a561f", x = 7, y = 8, w = 50, h = 50;
    ellipse(g, 32, 58, 24, 4.5, "rgba(0,0,0,.25)");
    fillRR(g, x, y, w, h, 8, lin(g, 0, y, 0, y + h, [[0, shade(wood, 0.22)], [1, shade(wood, -0.18)]]), OUT, 3.2);
    g.save(); rr(g, x, y, w, h, 8); g.clip();
    for (const py of [y + 17, y + 33]) { line(g, x, py, x + w, py, rgba(dark, 0.75), 2.4); line(g, x, py + 2, x + w, py + 2, "rgba(255,255,255,.14)", 1.2); }
    line(g, x + 8, y, x + 8, y + h, rgba(dark, 0.35), 1.4); line(g, x + w - 8, y, x + w - 8, y + h, rgba(dark, 0.35), 1.4);
    g.restore();
    if (steel || iron) {
      const m = steel ? "#c9d5f5" : "#aab4d4";
      for (const [px, py, rx, ry] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) { poly(g, [[px, py + ry * 17], [px, py], [px + rx * 17, py]], m, OUT, 2.2); circle(g, px + rx * 6, py + ry * 6, 2.1, shade(m, -0.4)); }
      if (steel) { line(g, x + 3, y + h / 2, x + w - 3, y + h / 2, rgba(m, 0.9), 3); circle(g, 32, 33, 4.5, m, OUT, 1.6); }
    } else { for (const [px, py] of [[x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6], [x + w - 6, y + h - 6]]) circle(g, px, py, 1.8, shade(dark, -0.2)); }
    if (hp < max) { g.save(); g.strokeStyle = OUT; g.lineWidth = 2.2; g.lineJoin = "round"; g.beginPath(); g.moveTo(30, y + 2); g.lineTo(26, 24); g.lineTo(34, 30); g.lineTo(27, 42); g.lineTo(31, y + h - 2); g.stroke(); g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 0.9; g.stroke(); g.restore(); }
  }, 2);
}

export function acornSprite() {
  return cached("acorn", 64, 64, (g) => {
    ellipse(g, 32, 56, 15, 3.6, "rgba(0,0,0,.25)");
    ellipse(g, 32, 37, 15.5, 17.5, lin(g, 18, 22, 46, 56, [[0, "#f0b25a"], [0.55, "#c47a2a"], [1, "#7c4113"]]), OUT, 3);
    ellipse(g, 26.5, 33, 4.2, 8, "rgba(255,255,255,.4)", null, 0, 0.35);
    // the cap
    g.save(); g.beginPath(); g.ellipse(32, 25, 19, 11.5, 0, Math.PI, TAU); g.closePath(); g.fillStyle = lin(g, 13, 14, 51, 26, [[0, "#9a6130"], [1, "#58310f"]]); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke(); g.clip();
    g.strokeStyle = "rgba(20,8,40,.35)"; g.lineWidth = 1.2; for (let i = -3; i <= 3; i++) { line(g, 32 + i * 6, 12, 32 + i * 6 - 6, 27, "rgba(20,8,40,.35)", 1.2); line(g, 32 + i * 6 - 6, 12, 32 + i * 6, 27, "rgba(20,8,40,.35)", 1.2); }
    g.restore();
    line(g, 32, 14, 33, 7, OUT, 6.5); line(g, 32, 14, 33, 7, "#7a4a1e", 3);
    star(g, 40, 33, 3.4, "#fff6c4", null, 0, 4, 0.34);
  }, 2);
}

export function soilTile(cs, bloomed, seedN = 0) {
  return cached(`soil${cs}${bloomed ? "b" : "s"}${seedN % 5}`, cs, cs, (g) => {
    const i = 2, r = cs * 0.17;
    fillRR(g, i, i, cs - i * 2, cs - i * 2, r, bloomed ? lin(g, 0, 0, 0, cs, [[0, "#47c46a"], [1, "#27884a"]]) : lin(g, 0, 0, 0, cs, [[0, "#6a4326"], [1, "#43260f"]]), bloomed ? "#145a2c" : "#2a1405", 2);
    g.save(); rr(g, i, i, cs - i * 2, cs - i * 2, r); g.clip();
    for (let n = 0; n < 16; n++) { const px = ((n * 37 + seedN * 11) % 97) / 97 * (cs - 8) + 4, py = ((n * 53 + seedN * 7) % 89) / 89 * (cs - 8) + 4; if (bloomed) { line(g, px, py, px + 1.5, py - 5, "rgba(160,255,180,.55)", 1.4); } else circle(g, px, py, 1 + (n % 3) * 0.6, n % 2 ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.28)"); }
    g.restore();
    if (bloomed) { const fc = ["#ff8ad2", "#ffc42e", "#ffffff", "#b05cff", "#ff6b6b"][seedN % 5], fx = cs * 0.5, fy = cs * 0.5, fr = cs * 0.1; for (let p = 0; p < 5; p++) { const a = (p * TAU) / 5; circle(g, fx + Math.cos(a) * fr * 1.5, fy + Math.sin(a) * fr * 1.5, fr * 1.05, fc, "rgba(20,8,50,.5)", 1); } circle(g, fx, fy, fr * 0.9, "#ffe27a", "rgba(20,8,50,.5)", 1); }
  }, 2);
}

// -------------------------------------------------------------------------------------------------------------- icons for the side panel
export function drawIcon(g, kind, x, y, s, extra) {
  g.save(); g.translate(x, y);
  if (kind === "gem") { const sp = gemSprite(extra, "g"); g.drawImage(sp, -s / 2, -s / 2, s, s); }
  else if (kind === "soil") { const sp = soilTile(40, false, 1); g.drawImage(sp, -s / 2, -s / 2, s, s); }
  else if (kind === "crate") { const sp = crateSprite(extra || 1, extra || 1); g.drawImage(sp, -s / 2, -s / 2, s, s); }
  else if (kind === "seed") { const sp = acornSprite(); g.drawImage(sp, -s / 2, -s / 2, s, s); }
  else if (kind === "score") star(g, 0, 0, s * 0.42, "#ffc233", OUT, 2.2);
  else if (kind === "hammer") {
    g.rotate(-0.6); fillRR(g, -s * 0.07, -s * 0.2, s * 0.14, s * 0.62, s * 0.05, "#c78a47", OUT, 2); fillRR(g, -s * 0.34, -s * 0.42, s * 0.68, s * 0.3, s * 0.08, lin(g, 0, -s * 0.42, 0, -s * 0.12, [[0, "#e8eefc"], [1, "#8d9ac4"]]), OUT, 2.2);
  }
  g.restore();
}

// -------------------------------------------------------------------------------------------------------------- the board's frame
export function makeBoardBack(makeCanvas, cols, rows, cs, vd, accent) {
  const pad = 14, W = cols * cs + pad * 2, H = rows * cs + pad * 2, c = makeCanvas(W * 2, H * 2), g = c.getContext("2d"); g.scale(2, 2);
  // soft glow, then the frame
  glow(g, W / 2, H / 2, Math.max(W, H) * 0.7, accent, 0.18);
  // only draw the frame around the cells that exist, so shaped boards look shaped
  g.save();
  const cellsPath = new Path2D();
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (!vd[y * cols + x]) cellsPath.rect(pad + x * cs - 4, pad + y * cs - 4, cs + 8, cs + 8);
  g.lineJoin = "round"; g.lineWidth = 18; g.strokeStyle = OUT; g.stroke(cellsPath); g.fillStyle = OUT; g.fill(cellsPath);
  g.lineWidth = 12; g.strokeStyle = rgba(accent, 0.85); g.stroke(cellsPath);
  g.lineWidth = 6; g.strokeStyle = shade(accent, 0.35); g.stroke(cellsPath);
  g.fillStyle = "#1a0d3d"; g.fill(cellsPath);
  g.restore();
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (vd[y * cols + x]) continue;
    fillRR(g, pad + x * cs + 2, pad + y * cs + 2, cs - 4, cs - 4, cs * 0.17, (x + y) % 2 ? "rgba(255,255,255,.055)" : "rgba(255,255,255,.1)", null);
  }
  return { canvas: c, pad, W, H };
}
