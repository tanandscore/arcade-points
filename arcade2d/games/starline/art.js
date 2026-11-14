// Starline Vanguard: all the pictures, drawn with code. Your ship, the enemy fleet, bosses, bullets, power-ups.
import { circle, ellipse, fillRR, poly, line, glow, gloss, text, OUT, FONT_DISPLAY } from "../../core/draw";
import { TAU, shade, rgba } from "../../core/util";

const flame = (g, x, y, len, t, c1 = "#7fe9ff", c2 = "#ffffff") => {
  const f = len * (0.8 + 0.25 * Math.sin(t * 40));
  poly(g, [[x, y - 6], [x - f, y], [x, y + 6]], c1, null, 0); poly(g, [[x, y - 3], [x - f * 0.6, y], [x, y + 3]], c2, null, 0);
  glow(g, x - 4, y, 16, c1, 0.4);
};

export function drawShip(g, x, y, t, st = {}) {
  const { inv = 0, wl = 1, tilt = 0 } = st;
  if (inv > 0 && Math.floor(t * 20) % 2 === 0) g.globalAlpha = 0.45;
  g.save(); g.translate(x, y); g.rotate(tilt * 0.25);
  flame(g, -16, 0, 22 + wl * 2, t);
  poly(g, [[-14, -4], [-24, -18], [-8, -10]], "#2f6fd6", OUT, 2); poly(g, [[-14, 4], [-24, 18], [-8, 10]], "#2f6fd6", OUT, 2);
  poly(g, [[-18, 0], [-6, -11], [14, -6], [26, 0], [14, 6], [-6, 11]], "#e8f2ff", OUT, 2.5);
  poly(g, [[-2, -11], [14, -6], [26, 0], [8, -1]], "#ffffff", null, 0);
  ellipse(g, 6, -1, 8, 4.5, "#38bdf8", OUT, 1.8); ellipse(g, 4, -3, 4, 1.8, "rgba(255,255,255,.8)", null, 0);
  poly(g, [[-6, -11], [-1, -17], [4, -10]], "#ff5a6e", OUT, 1.6); poly(g, [[-6, 11], [-1, 17], [4, 10]], "#ff5a6e", OUT, 1.6);
  if (wl >= 4) { circle(g, 10, -11, 3, "#ffd34a", OUT, 1.2); circle(g, 10, 11, 3, "#ffd34a", OUT, 1.2); }
  g.restore(); g.globalAlpha = 1;
}

export function drawEnemy(g, type, x, y, r, t, st = {}) {
  const hit = st.hit > 0, id = st.id || 0, c = (col) => (hit ? shade(col, 0.55) : col);
  g.save(); g.translate(x, y);
  if (type === "drone") {
    g.rotate(Math.sin(t * 4 + id) * 0.15);
    ellipse(g, 0, 0, 16, 11, c("#e0475a"), OUT, 2.4); ellipse(g, -2, -4, 10, 4, "rgba(255,255,255,.3)", null, 0);
    circle(g, -3, 0, 5.5, c("#ffe27a"), OUT, 1.8); circle(g, -4, 0, 2.2, "#400", null, 0);
    poly(g, [[8, -8], [16, -14], [14, -6]], c("#8e2230"), OUT, 1.6); poly(g, [[8, 8], [16, 14], [14, 6]], c("#8e2230"), OUT, 1.6);
  } else if (type === "swooper") {
    const a = (st.vy || 0) / 260; g.rotate(a);
    poly(g, [[-20, 0], [10, -16], [22, 0], [10, 16]], c("#c34ad9"), OUT, 2.5); poly(g, [[-20, 0], [4, -6], [4, 6]], c("#7a2a8e"), OUT, 1.8);
    circle(g, -4, 0, 4.5, c("#ffe27a"), OUT, 1.6); circle(g, -5, 0, 1.8, "#400", null, 0);
    glow(g, 18, 0, 14, "#ff8af0", 0.4);
  } else if (type === "gunner") {
    ellipse(g, 0, 0, 22, 17, c("#5b8a5e"), OUT, 3); ellipse(g, -2, -5, 14, 5, "rgba(255,255,255,.22)", null, 0);
    fillRR(g, -34, -4.5, 22, 9, 4, c("#3b5c3e"), OUT, 2); circle(g, -34, 0, 4, "#111", OUT, 1.5);
    circle(g, 2, 0, 8, c("#ffd34a"), OUT, 2); circle(g, 0, 0, 3.5, "#400", null, 0);
    for (const dy of [-13, 13]) fillRR(g, 6, dy - 3, 14, 6, 3, c("#3b5c3e"), OUT, 1.6);
  } else if (type === "rock") {
    g.rotate(t * 0.8 + id); const k = r / 26;
    poly(g, [[-24 * k, -6 * k], [-12 * k, -22 * k], [8 * k, -24 * k], [24 * k, -8 * k], [22 * k, 12 * k], [6 * k, 24 * k], [-14 * k, 20 * k]], c("#8b7a6a"), OUT, 3);
    circle(g, -6 * k, -4 * k, 5 * k, "rgba(0,0,0,.25)", null, 0); circle(g, 8 * k, 8 * k, 4 * k, "rgba(0,0,0,.2)", null, 0); circle(g, 4 * k, -12 * k, 3 * k, "rgba(255,255,255,.2)", null, 0);
  } else if (type === "elite") {
    poly(g, [[-30, 0], [-6, -26], [24, -22], [34, 0], [24, 22], [-6, 26]], c("#4a5a88"), OUT, 3.5);
    poly(g, [[-30, 0], [-10, -10], [-10, 10]], c("#2d3a62"), OUT, 2);
    fillRR(g, -40, -5, 24, 10, 4, c("#2d3a62"), OUT, 2); circle(g, 4, 0, 11, c("#ff5a6e"), OUT, 2.5); circle(g, 2, 0, 5, "#ffe27a", null, 0);
    for (const dy of [-18, 18]) { fillRR(g, -14, dy - 4, 26, 8, 4, c("#6a7aa8"), OUT, 1.8); }
  } else if (type === "boss1") {
    poly(g, [[-54, 0], [-20, -44], [30, -50], [52, -20], [52, 20], [30, 50], [-20, 44]], c("#6a3a8a"), OUT, 4);
    poly(g, [[-54, 0], [-24, -14], [-24, 14]], c("#3d1f55"), OUT, 2.5);
    circle(g, 8, 0, 20, c("#ff5a6e"), OUT, 3); circle(g, 4, -2, 9, "#ffe27a", OUT, 2); circle(g, 3, -2, 4, "#400", null, 0);
    for (const dy of [-34, 34]) { fillRR(g, -46, dy - 6, 34, 12, 5, c("#4d2a6a"), OUT, 2); circle(g, -46, dy, 5, "#111", OUT, 1.6); }
    glow(g, 8, 0, 44, "#ff5a6e", 0.25);
  } else if (type === "boss2") {
    g.rotate(Math.sin(t) * 0.05);
    for (let i = 0; i < 6; i++) { g.save(); g.rotate(i * (TAU / 6) + t * 0.4); poly(g, [[14, -8], [50, 0], [14, 8]], c(["#ff6a9a", "#ffd34a", "#7dffb0", "#6ad0ff", "#a58aff", "#ff9a5a"][i]), OUT, 2.5); g.restore(); }
    circle(g, 0, 0, 24, c("#f3e9ff"), OUT, 3.5); circle(g, -2, -2, 12, c("#c8a6ff"), OUT, 2); circle(g, -3, -3, 5, "#fff", null, 0);
    glow(g, 0, 0, 50, "#c8a6ff", 0.3);
  } else if (type === "boss3") {
    fillRR(g, -50, -52, 100, 104, 14, c("#566682"), OUT, 4); fillRR(g, -44, -46, 88, 20, 8, "rgba(255,255,255,.12)", null);
    for (let i = 0; i < 4; i++) { fillRR(g, -60, -40 + i * 26, 28, 12, 5, c("#2f3b52"), OUT, 2); circle(g, -60, -34 + i * 26, 4, "#111", OUT, 1.4); }
    circle(g, 8, 0, 22, c("#2f3b52"), OUT, 3); circle(g, 8, 0, 14, c("#ff6a4a"), OUT, 2.5); circle(g, 6, -2, 6, "#ffe27a", null, 0);
    g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 2; g.strokeRect(-36, -36, 72, 72);
  } else if (type === "boss4") {
    g.rotate(Math.sin(t * 0.6) * 0.04);
    ellipse(g, 0, 0, 54, 46, c("#2a1f48"), OUT, 4); ellipse(g, 0, 0, 44, 36, c("#3b2a68"), null, 0);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + t * 0.5; circle(g, Math.cos(a) * 50, Math.sin(a) * 42, 6, c("#ff5a6e"), OUT, 2); }
    ellipse(g, -4, 0, 26, 22, "#f3f3ff", OUT, 3); circle(g, -8, 0, 13, c("#ff3a5a"), OUT, 2.5); ellipse(g, -8, 0, 4, 11, "#150a20", null, 0); circle(g, -12, -5, 3.5, "rgba(255,255,255,.8)", null, 0);
    glow(g, -4, 0, 64, "#ff3a5a", 0.25 + 0.1 * Math.sin(t * 5));
  }
  g.restore();
}

export function drawBullet(g, b, t) {
  if (b.r >= 6) { glow(g, b.x, b.y, b.r * 2.6, "#ff9a4a", 0.5); circle(g, b.x, b.y, b.r, "#ff6a3a", OUT, 1.6); circle(g, b.x, b.y, b.r * 0.5, "#fff2c0", null, 0); }
  else { glow(g, b.x, b.y, 11, "#ff9a4a", 0.45); circle(g, b.x, b.y, b.r + 1, "#ff6a3a", OUT, 1.4); circle(g, b.x, b.y, 2, "#fff2c0", null, 0); }
}
export function drawShot(g, b) {
  if (b.missile) { g.save(); g.translate(b.x, b.y); g.rotate(Math.atan2(b.vy, b.vx)); poly(g, [[-8, -3], [6, -3], [11, 0], [6, 3], [-8, 3]], "#ffd34a", OUT, 1.6); poly(g, [[-8, 0], [-16, -4], [-16, 4]], "#ff8a3a", null, 0); g.restore(); }
  else { glow(g, b.x, b.y, 12, "#7fe9ff", 0.5); fillRR(g, b.x - 9, b.y - 2.2, 18, 4.4, 2.2, "#bff7ff", "#38bdf8", 1.4); }
}
export function drawPickup(g, p, t) {
  const c = { P: "#ffa63a", S: "#5aff9a", N: "#c27bff" }[p.kind], y = p.y + Math.sin(t * 5 + p.id) * 3;
  glow(g, p.x, y, 26, c, 0.5 + 0.2 * Math.sin(t * 6)); circle(g, p.x, y, 13, c, OUT, 2.5); circle(g, p.x - 3, y - 4, 4, "rgba(255,255,255,.55)", null, 0);
  text(g, p.kind, p.x, y + 6, { size: 17, color: "#1a0a30", align: "center", font: FONT_DISPLAY, weight: 900 });
}
export function drawNova(g, x, y, k) {
  g.save(); g.globalAlpha = 1 - k; g.strokeStyle = "#e0b0ff"; g.lineWidth = 10 * (1 - k) + 2; g.beginPath(); g.arc(x, y, 30 + k * 760, 0, TAU); g.stroke();
  g.fillStyle = `rgba(210,170,255,${0.25 * (1 - k)})`; g.fillRect(0, 0, 960, 540); g.restore();
}
