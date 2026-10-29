// Putt Planet: the pictures. The fairway, walls, sand and ice are drawn once per hole into a cached layer; water, planets, portals, blades, the ball and the flag move every frame.
import { makeCanvas, circle, ellipse, fillRR, rr, line, star, glow, gloss, OUT } from "../../core/draw";
import { TAU, shade, mix, rgba, rng } from "../../core/util";
import { bladeEnds, BALL_R, CUP_R } from "./physics";

export const LOOKS = [
  { name: "moon", a: "#79d68f", b: "#6dcc84", wall: "#efe7ff", wallDark: "#8f84c4", block: "#b9a8f0", blockTop: "#dccfff", hazard: "#3a8dff", hazard2: "#8fd0ff", dot: "rgba(255,255,255,.14)", sandA: "#f3d79a" },
  { name: "mars", a: "#e0875a", b: "#d67c50", wall: "#ffe3cf", wallDark: "#9c4a2c", block: "#a8553a", blockTop: "#d98466", hazard: "#ff5a1f", hazard2: "#ffd24a", dot: "rgba(90,30,10,.16)", sandA: "#f2c47a" },
  { name: "comet", a: "#a9e4f7", b: "#9bdcf2", wall: "#ffffff", wallDark: "#6aa3c8", block: "#7fb9dd", blockTop: "#d9f2ff", hazard: "#14478f", hazard2: "#5ab0ff", dot: "rgba(255,255,255,.28)", sandA: "#f3e1b0" },
  { name: "giant", a: "#8a68e6", b: "#7d5cdc", wall: "#e9dcff", wallDark: "#3d2a86", block: "#5a3fb0", blockTop: "#a68cf4", hazard: "#0b0420", hazard2: "#8a5cff", dot: "rgba(255,255,255,.14)", sandA: "#e8c27a" },
];

const polyPath = (g, pts) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); };
const rectPts = (r) => [[r[0], r[1]], [r[0] + r[2], r[1]], [r[0] + r[2], r[1] + r[3]], [r[0], r[1] + r[3]]];

const LAYERS = new Map();
// everything that never moves
export function courseLayer(lv, look) {
  let c = LAYERS.get(lv.id); if (c) return c;
  c = makeCanvas(960 * 1.5, 540 * 1.5); const g = c.getContext("2d"); g.scale(1.5, 1.5);
  const r = rng(lv.id.charCodeAt(0) * 31 + lv.id.charCodeAt(2));
  // soft shadow under the whole course
  g.save(); g.translate(0, 9); polyPath(g, lv.poly); g.fillStyle = "rgba(0,0,0,.35)"; g.fill(); g.restore();
  // grass with mowing stripes
  g.save(); polyPath(g, lv.poly); g.clip();
  g.fillStyle = look.a; g.fillRect(0, 0, 960, 540);
  g.fillStyle = look.b; for (let x = 0; x < 960; x += 80) g.fillRect(x, 0, 40, 540);
  g.fillStyle = look.dot; for (let i = 0; i < 90; i++) { const x = r() * 960, y = r() * 540, s = 2 + r() * 5; g.beginPath(); g.ellipse(x, y, s, s * 0.7, 0, 0, TAU); g.fill(); }
  // sand and ice patches
  for (const s of lv.sand || []) { fillRR(g, s[0], s[1], s[2], s[3], 14, look.sandA, rgba("#8a6a2a", 0.5), 2); g.save(); rr(g, s[0], s[1], s[2], s[3], 14); g.clip(); g.fillStyle = "rgba(120,80,20,.25)"; for (let i = 0; i < (s[2] * s[3]) / 90; i++) g.fillRect(s[0] + r() * s[2], s[1] + r() * s[3], 2, 2); g.restore(); }
  for (const s of lv.ice || []) { g.save(); rr(g, s[0], s[1], s[2], s[3], 6); g.clip(); g.fillStyle = "rgba(210,245,255,.55)"; g.fillRect(s[0], s[1], s[2], s[3]); g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 3; for (let i = 0; i < 9; i++) { const x = s[0] + r() * s[2], y = s[1] + r() * s[3]; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 40 + r() * 40, y - 30 - r() * 30); g.stroke(); } g.restore(); }
  g.restore();
  // fairway edge: a fat rounded wall with a dark underside
  const wall = (pts, thick) => {
    polyPath(g, pts); g.lineJoin = "round";
    g.save(); g.translate(0, 5); g.lineWidth = thick + 4; g.strokeStyle = look.wallDark; g.stroke(); g.restore();
    g.lineWidth = thick + 4; g.strokeStyle = OUT; g.stroke();
    g.lineWidth = thick; g.strokeStyle = look.wall; g.stroke();
  };
  for (const h of lv.holes || []) { polyPath(g, h); g.fillStyle = look.block; g.fill(); wall(h, 8); }
  for (const b of lv.blocks || []) {
    const p = rectPts(b); g.save(); g.translate(0, 6); polyPath(g, p); g.fillStyle = look.wallDark; g.fill(); g.restore();
    polyPath(g, p); g.fillStyle = look.block; g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.lineJoin = "round"; g.stroke();
    g.fillStyle = look.blockTop; g.globalAlpha = 0.55; g.fillRect(b[0] + 3, b[1] + 3, b[2] - 6, Math.min(8, b[3] - 6)); g.globalAlpha = 1;
  }
  wall(lv.poly, 10);
  // cup
  const [cx, cy] = lv.cup;
  ellipse(g, cx, cy + 2, CUP_R + 3, CUP_R * 0.82 + 3, "rgba(0,0,0,.25)", null, 0); ellipse(g, cx, cy, CUP_R, CUP_R * 0.82, "#120a2a", OUT, 2); ellipse(g, cx - 2, cy - 2, CUP_R * 0.6, CUP_R * 0.4, "rgba(255,255,255,.08)", null, 0);
  // tee mark
  const [tx, ty] = lv.tee; g.globalAlpha = 0.5; ellipse(g, tx, ty + 3, 13, 8, "rgba(255,255,255,.7)", null, 0); g.globalAlpha = 1;
  LAYERS.set(lv.id, c); return c;
}

export function drawWater(g, rects, look, t) {
  for (const w of rects) {
    g.save(); rr(g, w[0], w[1], w[2], w[3], 10); g.clip();
    const gr = g.createLinearGradient(0, w[1], 0, w[1] + w[3]); gr.addColorStop(0, look.hazard); gr.addColorStop(1, shade(look.hazard, -0.35)); g.fillStyle = gr; g.fillRect(w[0], w[1], w[2], w[3]);
    g.strokeStyle = rgba(look.hazard2, 0.55); g.lineWidth = 2;
    for (let y = w[1] + 10; y < w[1] + w[3]; y += 18) { g.beginPath(); for (let x = w[0]; x <= w[0] + w[2]; x += 8) { const yy = y + Math.sin(x * 0.07 + t * 2.2 + y * 0.1) * 3; x === w[0] ? g.moveTo(x, yy) : g.lineTo(x, yy); } g.stroke(); }
    if (look.name === "mars") { g.fillStyle = "rgba(255,230,120,.5)"; for (let i = 0; i < 6; i++) { const x = w[0] + ((i * 71 + t * 14) % w[2]), y = w[1] + ((i * 43) % w[3]); circle(g, x, y, 2 + (i % 3), "rgba(255,230,120,.55)", null, 0); } }
    g.restore(); rr(g, w[0], w[1], w[2], w[3], 10); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
  }
}

export function drawBoost(g, pads, t) {
  for (const p of pads) {
    const [x, y, w, h] = p.r; g.save(); rr(g, x, y, w, h, 8); g.clip(); g.fillStyle = "rgba(255,230,90,.28)"; g.fillRect(x, y, w, h);
    g.translate(x + w / 2, y + h / 2); g.rotate(Math.atan2(p.dy, p.dx)); const L = Math.hypot(w, h) * 0.55;
    for (let k = -3; k <= 3; k++) { const off = ((k * 34 + t * 90) % 238) - 119; g.globalAlpha = 0.9 - Math.abs(off) / 160; g.strokeStyle = "#ffd84a"; g.lineWidth = 6; g.lineCap = "round"; g.beginPath(); g.moveTo(off - 8, -22); g.lineTo(off + 8, 0); g.lineTo(off - 8, 22); g.stroke(); }
    g.restore(); rr(g, x, y, w, h, 8); g.lineWidth = 2; g.strokeStyle = "rgba(255,216,74,.8)"; g.stroke();
  }
}

export function drawBumper(g, b, t) {
  const pop = b.pop || 0, s = 1 + pop * 0.2;
  g.save(); g.translate(b.x, b.y); g.scale(s, s);
  ellipse(g, 2, 6, b.r, b.r * 0.9, "rgba(0,0,0,.3)", null, 0);
  if (b.kind === "post") { circle(g, 0, 0, b.r, "#6c6a8e", OUT, 3); circle(g, 0, -2, b.r * 0.75, "#a09ec6", null, 0); gloss(g, 0, -1, b.r, 0.45); }
  else { glow(g, 0, 0, b.r * 1.9, "#ff5ad0", 0.25 + pop * 0.5); circle(g, 0, 0, b.r, "#ff3ea5", OUT, 3); circle(g, 0, 0, b.r * 0.66, "#ffd1ec", OUT, 2); circle(g, 0, 0, b.r * 0.3, "#ff3ea5", null, 0); gloss(g, 0, -1, b.r, 0.5); }
  g.restore();
}

export function drawPlanet(g, w, t, look) {
  g.save(); g.translate(w.x, w.y);
  // pull rings
  for (let i = 0; i < 3; i++) { const k = ((t * 0.5 + i / 3) % 1); g.globalAlpha = (1 - k) * 0.35; g.strokeStyle = "#cdb8ff"; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, w.r * (1.4 + k * 2.8), 0, TAU); g.stroke(); }
  g.globalAlpha = 1; glow(g, 0, 0, w.r * 2.4, "#ffb86b", 0.35);
  // back of the ring, planet, front of the ring
  g.save(); g.rotate(-0.35); g.strokeStyle = "rgba(255,226,170,.9)"; g.lineWidth = 5; g.beginPath(); g.ellipse(0, 0, w.r * 1.7, w.r * 0.5, 0, Math.PI, TAU); g.stroke(); g.restore();
  const gr = g.createRadialGradient(-w.r * 0.35, -w.r * 0.4, w.r * 0.1, 0, 0, w.r); gr.addColorStop(0, "#ffe0a1"); gr.addColorStop(0.55, "#ff9f55"); gr.addColorStop(1, "#b04a2a");
  circle(g, 0, 0, w.r, gr, OUT, 3);
  g.save(); g.beginPath(); g.arc(0, 0, w.r - 1, 0, TAU); g.clip(); g.strokeStyle = "rgba(255,255,255,.2)"; g.lineWidth = 5; for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(0, k * w.r * 0.35, w.r * 1.2, w.r * 0.12, 0, 0, TAU); g.stroke(); } g.restore();
  g.save(); g.rotate(-0.35); g.strokeStyle = "rgba(255,226,170,.95)"; g.lineWidth = 5; g.beginPath(); g.ellipse(0, 0, w.r * 1.7, w.r * 0.5, 0, 0, Math.PI); g.stroke(); g.restore();
  g.restore();
}

export function drawPortal(g, x, y, t, hue) {
  g.save(); g.translate(x, y); glow(g, 0, 0, 38, hue, 0.5);
  for (let i = 0; i < 4; i++) { g.save(); g.rotate(t * (i % 2 ? -1.8 : 2.2) + i); g.strokeStyle = i % 2 ? "#ffffff" : hue; g.lineWidth = 3.5 - i * 0.5; g.globalAlpha = 0.9 - i * 0.12; g.beginPath(); g.ellipse(0, 0, 21 - i * 3.5, 14 - i * 2.5, 0, 0, Math.PI * 1.55); g.stroke(); g.restore(); }
  circle(g, 0, 0, 5, "#120a2a", null, 0); g.restore();
}

export function drawBlade(g, b, T) {
  const [ax, ay, bx, by] = bladeEnds(b, T);
  g.save(); g.lineCap = "round"; g.strokeStyle = "rgba(0,0,0,.28)"; g.lineWidth = b.w + 4; g.beginPath(); g.moveTo(ax + 2, ay + 7); g.lineTo(bx + 2, by + 7); g.stroke();
  g.strokeStyle = OUT; g.lineWidth = b.w + 6; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
  g.strokeStyle = "#ffcf4a"; g.lineWidth = b.w; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
  g.strokeStyle = "#ff5a5a"; g.lineWidth = b.w * 0.45; g.setLineDash([12, 12]); g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke(); g.setLineDash([]);
  circle(g, b.x, b.y, 11, "#b9a8f0", OUT, 3); circle(g, b.x, b.y, 4, "#ffffff", null, 0); g.restore();
}

export function drawFlag(g, cx, cy, t) {
  g.save(); g.translate(cx, cy);
  line(g, 0, 0, 0, -62, OUT, 6); line(g, 0, 0, 0, -62, "#ffffff", 3);
  const w = Math.sin(t * 4) * 3;
  g.beginPath(); g.moveTo(1, -62); g.quadraticCurveTo(14, -66 + w, 30, -56 + w * 0.5); g.quadraticCurveTo(14, -50 - w, 1, -44); g.closePath(); g.fillStyle = "#ff3e5e"; g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.lineJoin = "round"; g.stroke();
  circle(g, 0, -63, 3.5, "#ffc233", OUT, 1.5);
  g.restore();
}

export function drawBall(g, x, y, t, sink = 0) {
  const r = BALL_R * (1 - sink * 0.6);
  ellipse(g, x + 2, y + r * 0.9 + 1, r * 0.95, r * 0.45, "rgba(0,0,0,.32)", null, 0);
  g.save(); g.globalAlpha = 1 - sink * 0.5; circle(g, x, y, r, "#ffffff", OUT, 2.2); g.fillStyle = "rgba(120,110,170,.18)"; for (const [dx, dy] of [[-3, 2], [2, 3], [3, -2], [-1, -3]]) { g.beginPath(); g.arc(x + dx, y + dy, 1.1, 0, TAU); g.fill(); } gloss(g, x, y, r, 0.7); g.restore();
}
