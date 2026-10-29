// Snip & Drop: the pictures, all drawn with code. The berry, the critter ("Nibbly"), ropes, pins, stars, bubbles, spikes and ledges.
import { circle, ellipse, fillRR, rr, poly, line, star, glow, gloss, OUT } from "../../core/draw";
import { TAU, shade, rgba, clamp, lerp } from "../../core/util";
import { BERRY_R, MOUTH_R } from "./physics";

export const LOOKS = [
  { rope: "#e0a860", ropeDark: "#8a5a26", ledge: "#8b6b4a", ledgeTop: "#7ed56a", pin: "#cfd6ee" },
  { rope: "#d9b070", ropeDark: "#7d5a2c", ledge: "#6a5a40", ledgeTop: "#58c982", pin: "#d6ecd0" },
  { rope: "#c9a8e8", ropeDark: "#5d3d8a", ledge: "#4d4570", ledgeTop: "#9f8cf0", pin: "#d6d0f2" },
  { rope: "#e0a860", ropeDark: "#6a3d1c", ledge: "#555b78", ledgeTop: "#9aa3c8", pin: "#e9edfb" },
];

export function drawBerry(g, x, y, t, scale = 1, glowA = 0.5) {
  const r = BERRY_R * scale;
  g.save(); g.translate(x, y);
  glow(g, 0, 0, r * 2.4, "#9d7cff", glowA);
  ellipse(g, 2, r * 0.9, r * 0.8, r * 0.28, "rgba(0,0,0,.18)", null, 0);
  circle(g, 0, 0, r, "#7c5cff", OUT, 2.4);
  const gr = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r); gr.addColorStop(0, "#d6c8ff"); gr.addColorStop(0.5, "#8e72ff"); gr.addColorStop(1, "#5a3fd0");
  circle(g, 0, 0, r * 0.94, gr, null, 0);
  g.fillStyle = "rgba(255,255,255,.18)"; for (const [dx, dy] of [[-4, 3], [3, 4], [4, -3], [-2, -4]]) { g.beginPath(); g.arc(dx * scale, dy * scale, 1.6 * scale, 0, TAU); g.fill(); }
  gloss(g, 0, 0, r, 0.7);
  // little leaf on top
  g.save(); g.translate(0, -r * 0.92); g.rotate(-0.4); ellipse(g, 4, -2, 7 * scale, 3.4 * scale, "#59d97a", OUT, 1.6, -0.5); g.restore();
  g.restore();
}

export function drawStar(g, x, y, t, got, seed = 0) {
  if (got) return;
  const s = 15 + Math.sin(t * 4 + seed) * 1.4;
  g.save(); g.translate(x, y); g.rotate(Math.sin(t * 2 + seed) * 0.15);
  glow(g, 0, 0, 30, "#ffe27a", 0.45); star(g, 0, 0, s, "#ffc233", OUT, 2.4); star(g, 0, 0, s * 0.55, "#fff1a8", null, 0); g.restore();
}

export function drawPin(g, x, y, look) { circle(g, x, y, 9, look.pin, OUT, 2.4); circle(g, x, y, 3.6, "#6c6a8e", null, 0); circle(g, x - 2, y - 2.5, 2, "rgba(255,255,255,.8)", null, 0); }

export function drawRope(g, r, look, S, t) {
  const nodes = r.nodes;
  const path = (a, b, alpha = 1) => {
    g.save(); g.globalAlpha = alpha; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); for (let i = a; i <= b; i++) i === a ? g.moveTo(nodes[i].x, nodes[i].y) : g.lineTo(nodes[i].x, nodes[i].y);
    g.lineWidth = 8; g.strokeStyle = OUT; g.stroke(); g.lineWidth = 5; g.strokeStyle = look.rope; g.stroke();
    g.lineWidth = 5; g.strokeStyle = look.ropeDark; g.setLineDash([3, 8]); g.stroke(); g.setLineDash([]); g.restore();
  };
  if (r.cut < 0) path(0, r.n);
  else { path(0, r.cut); const age = S.t - r.cutT; if (age < 1.2) path(r.cut + 1, r.n, 1 - age / 1.2); }
}

export function drawBubble(g, b, t) {
  if (b.state === "popped") { if (b.pop > 0) { g.save(); g.globalAlpha = b.pop; g.strokeStyle = "#cdeaff"; g.lineWidth = 4; g.beginPath(); g.arc(b.x, b.y, b.r * (1.9 - b.pop * 0.9), 0, TAU); g.stroke(); g.restore(); } return; }
  const w = 1 + Math.sin(t * 5 + b.x) * 0.025;
  g.save(); g.translate(b.x, b.y); g.scale(w, 1 / w);
  circle(g, 0, 0, b.r, "rgba(170,225,255,.22)", "rgba(220,244,255,.9)", 3);
  g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = 4; g.lineCap = "round"; g.beginPath(); g.arc(0, 0, b.r - 8, Math.PI * 1.1, Math.PI * 1.45); g.stroke();
  g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, b.r - 8, Math.PI * 0.05, Math.PI * 0.18); g.stroke();
  g.restore();
}

export function drawSpikes(g, sp, t) {
  const [x, y, w, h] = sp; g.save(); rr(g, x, y, w, h, 6); g.clip(); g.fillStyle = "#3a3358"; g.fillRect(x, y, w, h);
  const vertical = h > w * 1.4, n = Math.max(2, Math.round((vertical ? h : w) / 26));
  if (!vertical) { for (let i = 0; i < n; i++) { const x0 = x + (i * w) / n, x1 = x + ((i + 1) * w) / n; poly(g, [[x0, y + h], [(x0 + x1) / 2, y], [x1, y + h]], "#d7dcf5", OUT, 2); poly(g, [[x0 + 2, y + h], [(x0 + x1) / 2, y + 4], [(x0 + x1) / 2, y + h]], "#aab2d8", null); } }
  else { for (let i = 0; i < n; i++) { const y0 = y + (i * h) / n, y1 = y + ((i + 1) * h) / n; poly(g, [[x + w, y0], [x, (y0 + y1) / 2], [x + w, y1]], "#d7dcf5", OUT, 2); } }
  g.restore(); rr(g, x, y, w, h, 6); g.lineWidth = 2.5; g.strokeStyle = OUT; g.stroke();
  g.fillStyle = "rgba(255,70,70,.12)"; g.fillRect(x, y, w, h);
}

export function drawLedge(g, b, look) {
  const [x, y, w, h] = b;
  g.save(); g.translate(0, 5); fillRR(g, x, y, w, h, 7, "rgba(0,0,0,.28)", null); g.restore();
  fillRR(g, x, y, w, h, 7, look.ledge, OUT, 2.4);
  g.save(); rr(g, x, y, w, h, 7); g.clip(); g.fillStyle = look.ledgeTop; g.fillRect(x, y, w, Math.min(10, h)); g.fillStyle = "rgba(255,255,255,.2)"; g.fillRect(x, y, w, 3);
  g.fillStyle = "rgba(0,0,0,.14)"; for (let i = 0; i < w / 30; i++) g.fillRect(x + 8 + i * 30, y + 16, 12, 4); g.restore();
}

// Nibbly the critter. `open` 0..1 how wide the mouth is, `eat` 0..1 chewing, `look` where the eyes point.
export function drawCritter(g, cx, cy, t, open, eat, tx, ty, happy) {
  g.save(); g.translate(cx, cy);
  const bob = Math.sin(t * 3) * 2 - happy * Math.abs(Math.sin(t * 9)) * 8, sq = 1 + eat * Math.sin(eat * 40) * 0.05;
  ellipse(g, 0, 56, 52, 12, "rgba(0,0,0,.25)", null, 0);
  g.translate(0, bob); g.scale(sq, 1 / sq);
  // body
  const gr = g.createRadialGradient(-16, -22, 8, 0, 4, 62); gr.addColorStop(0, "#9bf7a3"); gr.addColorStop(1, "#3fc27a");
  ellipse(g, 0, 12, 52, 50, gr, OUT, 3);
  // ears and feet
  for (const s of [-1, 1]) { ellipse(g, s * 34, -34, 14, 20, "#4fd88a", OUT, 3, s * 0.35); ellipse(g, s * 34, -34, 7, 12, "#ffb3d6", null, 0, s * 0.35); ellipse(g, s * 26, 58, 17, 8, "#2fa866", OUT, 2.5); }
  // belly
  ellipse(g, 0, 28, 30, 26, "rgba(255,255,255,.18)", null, 0);
  // mouth
  const mo = 6 + open * 24;
  ellipse(g, 0, 14, 28, mo, "#3b0f2a", OUT, 3); if (open > 0.2) { ellipse(g, 0, 14 + mo * 0.45, 17, mo * 0.42, "#ff6b8a", null, 0); }
  // teeth
  g.fillStyle = "#fff"; g.beginPath(); g.moveTo(-14, 14 - mo * 0.7); g.lineTo(-9, 14 - mo * 0.3); g.lineTo(-4, 14 - mo * 0.7); g.fill(); g.beginPath(); g.moveTo(14, 14 - mo * 0.7); g.lineTo(9, 14 - mo * 0.3); g.lineTo(4, 14 - mo * 0.7); g.fill();
  // eyes that follow the berry
  const ang = Math.atan2(ty - cy, tx - cx), ex = Math.cos(ang) * 4.5, ey = Math.sin(ang) * 4;
  for (const s of [-1, 1]) { circle(g, s * 19, -10, 14, "#fff", OUT, 2.6); circle(g, s * 19 + ex, -10 + ey, 7.5, happy ? "#2b1a5a" : "#150a33", null, 0); circle(g, s * 19 + ex - 2, -10 + ey - 3, 2.6, "#fff", null, 0); }
  if (happy) { g.strokeStyle = OUT; g.lineWidth = 3; g.beginPath(); g.arc(0, 4, 12, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
  g.restore();
}
