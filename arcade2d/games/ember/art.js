// Ember Deck: all the pictures, drawn with code. Cards, icons, the hero and every enemy.
import { circle, ellipse, fillRR, rr, poly, line, glow, gloss, text, wrapText, makeCanvas, OUT, FONT_DISPLAY, FONT_BODY } from "../../core/draw";
import { TAU, shade, rgba } from "../../core/util";
import { CARDS } from "./rules";

const TYPE = { a: { c: "#e0564a", d: "#7a1f1a", l: "ATTACK" }, s: { c: "#4a8fe0", d: "#1a3a7a", l: "SKILL" }, p: { c: "#e0a63a", d: "#7a5210", l: "POWER" } };

// ------------------------------------------------------------------------------------------------ icons
export function iconSword(g, x, y, s, c = "#e8eef8") { g.save(); g.translate(x, y); g.rotate(-0.78); fillRR(g, -s * 0.07, -s * 0.5, s * 0.14, s * 0.78, s * 0.04, c, OUT, 1.6); fillRR(g, -s * 0.22, s * 0.2, s * 0.44, s * 0.09, s * 0.03, "#caa24a", OUT, 1.4); fillRR(g, -s * 0.05, s * 0.28, s * 0.1, s * 0.2, s * 0.03, "#7a4a1a", OUT, 1.2); g.restore(); }
export function iconShield(g, x, y, s, c = "#6ab0ff") { poly(g, [[x - s * 0.34, y - s * 0.3], [x + s * 0.34, y - s * 0.3], [x + s * 0.3, y + s * 0.12], [x, y + s * 0.42], [x - s * 0.3, y + s * 0.12]], c, OUT, 1.8); poly(g, [[x - s * 0.2, y - s * 0.2], [x + s * 0.2, y - s * 0.2], [x + s * 0.17, y + s * 0.06], [x, y + s * 0.26], [x - s * 0.17, y + s * 0.06]], "rgba(255,255,255,.35)", null, 0); }
export function iconFlame(g, x, y, s, c = "#ff8a3a") { g.save(); g.translate(x, y); g.beginPath(); g.moveTo(0, -s * 0.45); g.bezierCurveTo(s * 0.4, -s * 0.1, s * 0.34, s * 0.34, 0, s * 0.4); g.bezierCurveTo(-s * 0.34, s * 0.34, -s * 0.4, -s * 0.05, -s * 0.08, -s * 0.2); g.bezierCurveTo(-s * 0.04, -s * 0.34, 0, -s * 0.4, 0, -s * 0.45); g.fillStyle = c; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.6; g.stroke(); circle(g, 0, s * 0.18, s * 0.14, "#ffe27a", null, 0); g.restore(); }
export function iconBolt(g, x, y, s, c = "#ffe04a") { poly(g, [[x + s * 0.1, y - s * 0.46], [x - s * 0.3, y + s * 0.06], [x - s * 0.02, y + s * 0.06], [x - s * 0.12, y + s * 0.46], [x + s * 0.32, y - s * 0.1], [x + s * 0.04, y - s * 0.1]], c, OUT, 1.6); }
export function iconHeart(g, x, y, s, c = "#ff6a7a") { g.save(); g.translate(x, y + s * 0.05); g.beginPath(); g.moveTo(0, s * 0.36); g.bezierCurveTo(-s * 0.6, -s * 0.05, -s * 0.3, -s * 0.5, 0, -s * 0.16); g.bezierCurveTo(s * 0.3, -s * 0.5, s * 0.6, -s * 0.05, 0, s * 0.36); g.fillStyle = c; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.6; g.stroke(); g.restore(); }
export function iconCards(g, x, y, s) { for (const [dx, a, c] of [[-s * 0.14, -0.2, "#b9c6e8"], [s * 0.14, 0.2, "#e8eefc"]]) { g.save(); g.translate(x + dx, y); g.rotate(a); fillRR(g, -s * 0.18, -s * 0.28, s * 0.36, s * 0.56, s * 0.05, c, OUT, 1.5); g.restore(); } }
export function iconUp(g, x, y, s, c = "#ffb04a") { poly(g, [[x, y - s * 0.4], [x + s * 0.34, y + s * 0.02], [x + s * 0.12, y + s * 0.02], [x + s * 0.12, y + s * 0.38], [x - s * 0.12, y + s * 0.38], [x - s * 0.12, y + s * 0.02], [x - s * 0.34, y + s * 0.02]], c, OUT, 1.6); }
export function iconDown(g, x, y, s, c = "#a58aff") { poly(g, [[x, y + s * 0.4], [x + s * 0.34, y - s * 0.02], [x + s * 0.12, y - s * 0.02], [x + s * 0.12, y - s * 0.38], [x - s * 0.12, y - s * 0.38], [x - s * 0.12, y - s * 0.02], [x - s * 0.34, y - s * 0.02]], c, OUT, 1.6); }
export function iconCrack(g, x, y, s) { iconShield(g, x, y, s, "#d98aff"); g.strokeStyle = "#2a0a30"; g.lineWidth = 2; g.beginPath(); g.moveTo(x - s * 0.05, y - s * 0.3); g.lineTo(x + s * 0.06, y); g.lineTo(x - s * 0.06, y + s * 0.12); g.lineTo(x + s * 0.02, y + s * 0.38); g.stroke(); }
function cardIcon(g, id, x, y, s) {
  const c = CARDS[id], f = c.fx;
  const has = (k) => f.some((o) => o[k] != null);
  if (id === "flurry") { for (let i = -1; i <= 1; i++) iconSword(g, x + i * s * 0.28, y, s * 0.7); return; }
  if (id === "cleave") { iconSword(g, x - s * 0.18, y, s * 0.8); iconSword(g, x + s * 0.18, y, s * 0.8); return; }
  if (id === "inferno" || id === "fireball") { iconFlame(g, x, y, s * 1.05); if (id === "inferno") { iconFlame(g, x - s * 0.34, y + s * 0.1, s * 0.6); iconFlame(g, x + s * 0.34, y + s * 0.1, s * 0.6); } return; }
  if (id === "riposte") { iconShield(g, x - s * 0.18, y + s * 0.06, s * 0.8); iconSword(g, x + s * 0.18, y - s * 0.04, s * 0.8); return; }
  if (id === "weaken") { iconDown(g, x - s * 0.2, y, s * 0.8); iconShield(g, x + s * 0.2, y, s * 0.8); return; }
  if (has("dmg")) { iconSword(g, x, y, s); if (id === "bash") iconCrack(g, x + s * 0.3, y + s * 0.26, s * 0.5); return; }
  if (has("blk")) { iconShield(g, x, y, s * 1.05); return; }
  if (has("draw")) { iconCards(g, x, y, s); return; }
  if (has("energy")) { iconBolt(g, x, y, s); return; }
  if (has("heal")) { iconHeart(g, x, y, s); return; }
  if (has("str")) { iconUp(g, x, y, s); return; }
}

// ------------------------------------------------------------------------------------------------ cards
export function drawCard(g, id, x, y, w, h, o = {}) {
  const c = CARDS[id], ty = TYPE[c.t], { hover = false, dim = false, sel = false, glowing = false, lift = 0, tilt = 0, scale = 1 } = o;
  g.save(); g.translate(x + w / 2, y + h / 2 - lift); g.rotate(tilt); g.scale(scale, scale); g.translate(-w / 2, -h / 2);
  if (sel || glowing) glow(g, w / 2, h / 2, w * 0.9, sel ? "#ffe27a" : "#9ef3ff", 0.5);
  fillRR(g, 3, 5, w, h, 12, "rgba(0,0,0,.35)", null);
  fillRR(g, 0, 0, w, h, 12, "#f6efe0", sel ? "#ffe27a" : OUT, sel ? 4 : 2.5);
  fillRR(g, 5, 5, w - 10, h * 0.5, 8, ty.c, OUT, 1.6);
  g.save(); rr(g, 5, 5, w - 10, h * 0.5, 8); g.clip(); g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(5, 5, w - 10, h * 0.16); const gr = g.createRadialGradient(w / 2, h * 0.26, 4, w / 2, h * 0.26, w * 0.6); gr.addColorStop(0, "rgba(255,255,255,.35)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(5, 5, w - 10, h * 0.5); g.restore();
  cardIcon(g, id, w / 2, h * 0.27, Math.min(w * 0.5, h * 0.3));
  // cost orb
  circle(g, 17, 17, 14, dim ? "#7a7a8a" : "#2a2a6a", OUT, 2.2); circle(g, 17, 17, 11, dim ? "#9a9aaa" : "#5a5ae0", null, 0);
  text(g, `${c.c}`, 17, 23, { size: 17, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 900 });
  text(g, c.n, w / 2, h * 0.6, { size: Math.max(11, w * 0.115), color: "#2a1a10", align: "center", font: FONT_DISPLAY, weight: 800 });
  text(g, ty.l, w / 2, h * 0.67, { size: Math.max(8, w * 0.07), color: ty.d, align: "center", font: FONT_BODY, weight: 700 });
  const lines = wrapText(makeCanvas(4, 4).getContext("2d"), c.txt, w - 18, Math.max(10, w * 0.095), FONT_BODY, 600);
  lines.slice(0, 4).forEach((ln, i) => text(g, ln, w / 2, h * 0.76 + i * Math.max(11, w * 0.1), { size: Math.max(10, w * 0.095), color: "#3a2a20", align: "center", font: FONT_BODY, weight: 600 }));
  if (dim) { fillRR(g, 0, 0, w, h, 12, "rgba(20,20,40,.42)", null); }
  g.restore();
}

// ------------------------------------------------------------------------------------------------ the hero
export function drawHero(g, x, y, s, t, st = {}) {
  const k = s / 100, bob = Math.sin(t * 2.4) * 2 * k, lunge = (st.lunge || 0) * 40 * k;
  g.save(); g.translate(x + lunge, y + bob); g.scale(k, k);
  ellipse(g, 0, 56, 40, 9, "rgba(0,0,0,.3)", null, 0);
  if (st.hit) g.globalAlpha = 0.7;
  fillRR(g, -22, 24, 18, 30, 6, "#3a3f66", OUT, 2.5); fillRR(g, 4, 24, 18, 30, 6, "#3a3f66", OUT, 2.5);
  fillRR(g, -32, -20, 64, 52, 16, "#8fa0d6", OUT, 3); fillRR(g, -26, -16, 52, 14, 8, "rgba(255,255,255,.3)", null);
  poly(g, [[0, -16], [14, 2], [0, 22], [-14, 2]], "#ff8a3a", OUT, 2); iconFlame(g, 0, 4, 24);
  fillRR(g, 22, -6, 34, 10, 5, "#d8e0f0", OUT, 2.2); fillRR(g, 50, -10, 7, 18, 3, "#caa24a", OUT, 2);        // sword arm
  circle(g, 0, -40, 22, "#8fa0d6", OUT, 3); fillRR(g, -16, -46, 32, 10, 5, "#1a1a30", OUT, 1.8); circle(g, -6, -41, 2.6, "#7fe9ff", null, 0); circle(g, 6, -41, 2.6, "#7fe9ff", null, 0);
  for (let i = 0; i < 3; i++) { g.save(); g.translate(0, -60); g.rotate(-0.5 + i * 0.5 + Math.sin(t * 5 + i) * 0.1); iconFlame(g, 0, -10, 24 - i * 3, i === 1 ? "#ffd34a" : "#ff6a3a"); g.restore(); }
  g.restore(); g.globalAlpha = 1;
}

// ------------------------------------------------------------------------------------------------ enemies
export function drawEnemy(g, type, x, y, s, t, st = {}) {
  const k = s / 100, bob = Math.sin(t * 2 + (st.i || 0)) * 3 * k, lunge = (st.lunge || 0) * -50 * k, hit = st.hit > 0, dead = st.dead;
  const C = (c) => (hit ? "#ffffff" : c);
  g.save(); g.translate(x + lunge, y + bob); g.scale(k * (st.big || 1), k * (st.big || 1));
  if (dead) g.globalAlpha = Math.max(0, 1 - dead);
  ellipse(g, 0, 52, 38, 9, "rgba(0,0,0,.3)", null, 0);
  const eyes = (dx, dy, c = "#ffe27a", r = 5) => { circle(g, -dx, dy, r, "#fff", OUT, 1.6); circle(g, dx, dy, r, "#fff", OUT, 1.6); circle(g, -dx - 1, dy, r * 0.5, "#300", null, 0); circle(g, dx - 1, dy, r * 0.5, "#300", null, 0); };
  switch (type) {
    case "rat": ellipse(g, 0, 30, 34, 24, C("#8a6a58"), OUT, 3); circle(g, -26, 24, 15, C("#9a7a68"), OUT, 3); circle(g, -34, 12, 7, C("#c58a8a"), OUT, 2); circle(g, -20, 10, 7, C("#c58a8a"), OUT, 2); eyes(0, 0); circle(g, -26, 20, 3, "#ffe27a", null, 0); g.strokeStyle = "#c58a8a"; g.lineWidth = 4; g.beginPath(); g.moveTo(32, 36); g.quadraticCurveTo(54, 40, 52, 20); g.stroke(); glow(g, 0, 34, 40, "#ff8a3a", 0.18); break;
    case "wisp": { const f = Math.sin(t * 6); glow(g, 0, 10, 54, "#7fe9ff", 0.4); poly(g, [[0, -34], [24, 10], [14, 40], [-14, 40], [-24, 10]], C("#5ad0ff"), OUT, 3); poly(g, [[0, -10], [12, 12], [0, 34], [-12, 12]], C("#c8f4ff"), null, 0); circle(g, -8, 8 + f, 3.4, "#123", null, 0); circle(g, 8, 8 + f, 3.4, "#123", null, 0); break; }
    case "brute": fillRR(g, -38, -4, 76, 56, 16, C("#6a5a5a"), OUT, 3.5); circle(g, 0, -20, 28, C("#7a6a6a"), OUT, 3.5); fillRR(g, -52, 0, 22, 40, 8, C("#6a5a5a"), OUT, 3); fillRR(g, 30, 0, 22, 40, 8, C("#6a5a5a"), OUT, 3); eyes(10, -22, "#ff6a3a", 6); g.strokeStyle = "#ff6a3a"; g.lineWidth = 3; g.beginPath(); g.moveTo(-14, 14); g.lineTo(-4, 26); g.lineTo(-18, 38); g.moveTo(16, 8); g.lineTo(8, 24); g.stroke(); fillRR(g, -14, -6, 28, 8, 3, "#2a1010", OUT, 1.5); break;
    case "scorpion": for (const dx of [-18, -6, 6, 18]) { line(g, dx, 40, dx + (dx < 0 ? -10 : 10), 54, "#6ad0d8", 4); } ellipse(g, 0, 32, 34, 20, C("#7fe0e8"), OUT, 3); ellipse(g, -6, 26, 18, 6, "rgba(255,255,255,.4)", null, 0); circle(g, -30, 30, 12, C("#9af0f4"), OUT, 3); eyes(0, 0); g.strokeStyle = "#5ac0c8"; g.lineWidth = 8; g.lineCap = "round"; g.beginPath(); g.moveTo(26, 28); g.quadraticCurveTo(52, 20, 40, -12); g.stroke(); poly(g, [[36, -10], [46, -26], [50, -6]], C("#ffe27a"), OUT, 2); for (const sgn of [-1, 1]) { circle(g, -42, 28 + sgn * 12, 8, C("#7fe0e8"), OUT, 2.2); } break;
    case "wolf": ellipse(g, 6, 28, 38, 24, C("#cfe0f0"), OUT, 3); circle(g, -30, 14, 19, C("#dbe9f8"), OUT, 3); poly(g, [[-40, -4], [-34, -22], [-26, -4]], C("#cfe0f0"), OUT, 2.2); poly(g, [[-26, -4], [-18, -20], [-14, -2]], C("#cfe0f0"), OUT, 2.2); ellipse(g, -46, 20, 9, 6, C("#b8cce0"), OUT, 2.2); eyes(0, 0); circle(g, -34, 12, 3, "#7fe9ff", null, 0); circle(g, -24, 12, 3, "#7fe9ff", null, 0); fillRR(g, 28, 36, 10, 18, 4, "#b8cce0", OUT, 2); fillRR(g, -18, 40, 10, 14, 4, "#b8cce0", OUT, 2); poly(g, [[40, 20], [58, 8], [52, 34]], C("#cfe0f0"), OUT, 2.2); break;
    case "golem": fillRR(g, -34, -20, 68, 72, 14, C("#9fd0f0"), OUT, 3.5); fillRR(g, -26, -34, 52, 30, 12, C("#bfe4ff"), OUT, 3.5); fillRR(g, -52, -6, 20, 46, 8, C("#9fd0f0"), OUT, 3); fillRR(g, 32, -6, 20, 46, 8, C("#9fd0f0"), OUT, 3); eyes(8, -20, "#7fe9ff", 5); for (let i = 0; i < 3; i++) poly(g, [[-24 + i * 24, -34], [-18 + i * 24, -50], [-12 + i * 24, -34]], C("#e8f6ff"), OUT, 2); g.strokeStyle = "rgba(255,255,255,.7)"; g.lineWidth = 2; g.beginPath(); g.moveTo(-20, 0); g.lineTo(-6, 18); g.lineTo(-18, 34); g.stroke(); break;
    case "imp": ellipse(g, 0, 26, 24, 26, C("#d9462e"), OUT, 3); circle(g, 0, -4, 22, C("#e8563a"), OUT, 3); poly(g, [[-18, -16], [-26, -40], [-8, -22]], C("#7a1a10"), OUT, 2.2); poly(g, [[18, -16], [26, -40], [8, -22]], C("#7a1a10"), OUT, 2.2); eyes(8, -6, "#ffe27a", 5); g.strokeStyle = "#400"; g.lineWidth = 2.4; g.beginPath(); g.arc(0, 6, 8, 0.2, Math.PI - 0.2); g.stroke(); poly(g, [[-22, 20], [-44, 6], [-30, 30]], C("#9a2a1a"), OUT, 2); poly(g, [[22, 20], [44, 6], [30, 30]], C("#9a2a1a"), OUT, 2); glow(g, 0, 30, 36, "#ff6a3a", 0.25); break;
    case "shade": ellipse(g, 0, 20, 34, 44, C("#3a2a5a"), OUT, 3); circle(g, 0, -14, 26, C("#4a3a6a"), OUT, 3); eyes(9, -16, "#ff5a8a", 6); g.fillStyle = "#1a0a2a"; g.beginPath(); g.ellipse(0, -2, 10, 6, 0, 0, TAU); g.fill(); for (let i = 0; i < 4; i++) { const x0 = -28 + i * 18; poly(g, [[x0, 52], [x0 + 9, 36 + Math.sin(t * 4 + i) * 4], [x0 + 18, 52]], C("#3a2a5a"), OUT, 2); } glow(g, 0, 10, 56, "#a58aff", 0.22); break;
    case "knight": fillRR(g, -34, -18, 68, 70, 14, C("#a84a2a"), OUT, 3.5); circle(g, 0, -34, 24, C("#b85a3a"), OUT, 3.5); fillRR(g, -18, -42, 36, 10, 5, "#1a0a08", OUT, 2); circle(g, -6, -37, 2.8, "#ffd34a", null, 0); circle(g, 6, -37, 2.8, "#ffd34a", null, 0); poly(g, [[-10, -56], [0, -78], [10, -56]], C("#ff6a3a"), OUT, 2.4); fillRR(g, 34, -30, 12, 80, 4, C("#e0e0e8"), OUT, 2.5); fillRR(g, 26, 14, 28, 8, 3, "#caa24a", OUT, 2); fillRR(g, -52, -6, 22, 44, 8, C("#a84a2a"), OUT, 3); for (let i = 0; i < 3; i++) { g.strokeStyle = "#ffb04a"; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-28 + i * 22, 6); g.lineTo(-22 + i * 22, 30); g.stroke(); } glow(g, 0, 10, 70, "#ff6a3a", 0.18); break;
    case "serpent": g.lineCap = "round"; g.strokeStyle = OUT; g.lineWidth = 30; g.beginPath(); for (let i = 0; i <= 20; i++) { const u = i / 20, px = 40 - u * 96, py = 38 - Math.sin(u * 6.2 + t) * 10 - u * 18; if (i === 0) g.moveTo(px, py); else g.lineTo(px, py); } g.stroke(); g.strokeStyle = C("#c68aff"); g.lineWidth = 24; g.stroke(); circle(g, -52, 8, 20, C("#d8a8ff"), OUT, 3.5); eyes(-52 + 16, 6, "#7fe9ff", 5); for (let i = 0; i < 4; i++) poly(g, [[-30 + i * 16, 24 - i * 3], [-24 + i * 16, 4 - i * 3], [-18 + i * 16, 24 - i * 3]], C("#f0dcff"), OUT, 2); g.strokeStyle = "#ff4a6a"; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-72, 14); g.lineTo(-84, 14); g.lineTo(-90, 8); g.moveTo(-84, 14); g.lineTo(-90, 20); g.stroke(); break;
    case "titan": fillRR(g, -46, -14, 92, 66, 20, C("#4a4a54"), OUT, 4); circle(g, 0, -34, 32, C("#5a5a64"), OUT, 4); eyes(12, -36, "#ff6a3a", 7); fillRR(g, -20, -22, 40, 10, 4, "#1a1a20", OUT, 2); for (const sx of [-1, 1]) { fillRR(g, sx * 60 - 14, -2, 28, 54, 10, C("#4a4a54"), OUT, 3.5); circle(g, sx * 60, 54, 14, C("#3a3a44"), OUT, 3); } g.strokeStyle = "#ff6a3a"; g.lineWidth = 3.4; g.beginPath(); g.moveTo(-26, 10); g.lineTo(-10, 28); g.lineTo(-22, 44); g.moveTo(20, 4); g.lineTo(8, 22); g.lineTo(24, 40); g.stroke(); glow(g, 0, 20, 90, "#ff6a3a", 0.22); for (let i = 0; i < 5; i++) poly(g, [[-26 + i * 13, -58], [-20 + i * 13, -76 + (i % 2) * 8], [-14 + i * 13, -58]], C("#3a3a44"), OUT, 2); break;
    case "queen": poly(g, [[-40, 56], [-28, -10], [28, -10], [40, 56]], C("#e8c8ff"), OUT, 4); poly(g, [[-26, 56], [-16, 4], [16, 4], [26, 56]], "rgba(255,255,255,.4)", null, 0); circle(g, 0, -30, 26, C("#f6e8ff"), OUT, 3.5); eyes(9, -32, "#c04aff", 6); poly(g, [[-26, -50], [-22, -76], [-12, -58], [0, -84], [12, -58], [22, -76], [26, -50]], "#ffd34a", OUT, 3); circle(g, 0, -62, 4, "#ff4a6a", OUT, 1.6); for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) poly(g, [[sx * 38, 10 + i * 14], [sx * (62 + i * 6), 0 + i * 20], [sx * 36, 22 + i * 14]], C("#d8b8ff"), OUT, 2.2); glow(g, 0, 10, 80, "#c04aff", 0.2); break;
    case "king": fillRR(g, -42, -10, 84, 64, 18, C("#8fc8f0"), OUT, 4); circle(g, 0, -30, 28, C("#bfe4ff"), OUT, 4); eyes(10, -32, "#7fe9ff", 6); poly(g, [[-28, -50], [-22, -80], [-10, -60], [0, -90], [10, -60], [22, -80], [28, -50]], "#e8f6ff", OUT, 3); fillRR(g, -16, -18, 32, 8, 3, "#3a6a9a", OUT, 1.8); poly(g, [[-54, 56], [-42, -8], [-42, 56]], "#6aa8d8", OUT, 3); poly(g, [[54, 56], [42, -8], [42, 56]], "#6aa8d8", OUT, 3); fillRR(g, 48, -20, 8, 76, 3, C("#e8f6ff"), OUT, 2.5); poly(g, [[44, -20], [52, -40], [60, -20]], C("#e8f6ff"), OUT, 2.2); glow(g, 0, 10, 90, "#7fe9ff", 0.22); break;
    case "lord": fillRR(g, -46, -14, 92, 68, 20, C("#7a1f1a"), OUT, 4); circle(g, 0, -34, 32, C("#9a2a22"), OUT, 4); eyes(12, -36, "#ffe27a", 7); g.fillStyle = "#1a0a08"; g.beginPath(); g.ellipse(0, -18, 14, 7, 0, 0, TAU); g.fill(); for (let i = 0; i < 7; i++) { const a = -2.7 + i * 0.38; g.save(); g.translate(Math.cos(a) * 34, -34 + Math.sin(a) * 34); g.rotate(a + Math.PI / 2); iconFlame(g, 0, -6, 30, i % 2 ? "#ffd34a" : "#ff6a3a"); g.restore(); } iconFlame(g, 0, 18, 44); for (const sx of [-1, 1]) { fillRR(g, sx * 62 - 14, -4, 28, 56, 10, C("#7a1f1a"), OUT, 3.5); for (let i = 0; i < 3; i++) iconFlame(g, sx * 62, -8 - i * 6, 14); } glow(g, 0, 10, 110, "#ff6a3a", 0.3 + 0.1 * Math.sin(t * 4)); break;
    default: circle(g, 0, 20, 30, C("#888"), OUT, 3);
  }
  g.restore(); g.globalAlpha = 1;
}
