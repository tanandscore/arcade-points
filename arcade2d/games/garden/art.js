// Garden Guards: all the pictures, drawn with code. Defenders, the Gloom Gang, dew drops, seeds and the little garden carts.
import { cached, circle, ellipse, fillRR, rr, poly, line, glow, gloss, OUT } from "../../core/draw";
import { TAU, shade, rgba, hash2 } from "../../core/util";

// one look per world for the lawn
export const LOOKS = [
  { name: "day", a: "#7fd45a", b: "#72c94f", edge: "#3f9a3a", line: "rgba(20,80,20,.16)" },
  { name: "night", a: "#3d6a52", b: "#386049", edge: "#244634", line: "rgba(0,20,10,.28)" },
  { name: "hills", a: "#8fbf9a", b: "#84b490", edge: "#5a8a68", line: "rgba(20,60,40,.2)" },
  { name: "keep", a: "#4a4560", b: "#443f59", edge: "#2d2940", line: "rgba(0,0,10,.3)" },
];
export function lawnTile(look, w, h, alt) {
  return cached(`gg-lawn-${look.name}-${w}-${h}-${alt}`, w, h, (g) => {
    g.fillStyle = alt ? look.b : look.a; g.fillRect(0, 0, w, h);
    g.fillStyle = look.line; g.fillRect(0, h - 1.5, w, 1.5); g.fillRect(w - 1.5, 0, 1.5, h);
    const r = (i) => hash2(i, w + (alt ? 5 : 0), 9);
    g.strokeStyle = rgba(look.edge, 0.55); g.lineWidth = 1.6; g.lineCap = "round";
    for (let i = 0; i < 4; i++) { const x = r(i) * w * 0.9 + w * 0.05, y = r(i + 7) * h * 0.6 + h * 0.3; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y - 6); g.moveTo(x, y); g.lineTo(x + 3, y - 5); g.stroke(); }
  });
}

const wob = (t, k = 1, a = 1) => Math.sin(t * 2.6 * k) * a;

// ------------------------------------------------------------------------------------------------ defenders
// (cx, cy) is the middle of the square, s the size of the picture. st = { hit, burst, t0, fuse (0..1) }
export function drawPlant(g, type, cx, cy, s, t, st = {}) {
  const k = s / 78, bob = wob(t + (st.t0 || 0), 1, 1.4 * k), hit = st.hit > 0;
  g.save(); g.translate(cx, cy + 6 * k);
  g.scale(k, k);
  ellipse(g, 0, 26, 24, 7, "rgba(0,0,0,.25)", null, 0);
  if (hit) g.globalAlpha = 0.85;
  if (type === "pip" || type === "twin") {
    const recoil = st.burst > 0 ? -5 * (st.burst / 0.18) : 0;
    // stem + leaves
    poly(g, [[0, 28], [-5, 10], [5, 10]], "#3b9a3b", OUT, 2);
    ellipse(g, -16, 20, 12, 5, "#46b34a", OUT, 2, -0.5); ellipse(g, 16, 20, 12, 5, "#46b34a", OUT, 2, 0.5);
    g.translate(0, bob * 0.6);
    const heads = type === "twin" ? [[-8, -4], [8, -16]] : [[0, -8]];
    for (const [hx, hy] of type === "twin" ? [[-6, -2], [6, -17]] : [[0, -8]]) {
      g.save(); g.translate(hx, hy);
      fillRR(g, 14 + recoil, -4, 20, 10, 5, "#58c46b", OUT, 2); ellipse(g, 34 + recoil, 1, 3, 4.5, "#1d5a28", OUT, 1.5);
      circle(g, 0, 0, 20, type === "twin" ? "#5ed16e" : "#7bd35a", OUT, 2.5); gloss(g, 0, 0, 20);
      circle(g, -4, -3, 5.2, "#fff", OUT, 1.5); circle(g, 8, -3, 5.2, "#fff", OUT, 1.5); circle(g, -2.5 + (st.burst > 0 ? 2 : 0), -3, 2.4, "#1a1a2a", null, 0); circle(g, 9.5 + (st.burst > 0 ? 2 : 0), -3, 2.4, "#1a1a2a", null, 0);
      g.strokeStyle = "#1d5a28"; g.lineWidth = 2; g.beginPath(); g.arc(3, 6, 4.5, 0.2, Math.PI - 0.2); g.stroke();
      g.restore();
    }
  } else if (type === "dew") {
    poly(g, [[0, 28], [-4, 6], [4, 6]], "#3b9a3b", OUT, 2); ellipse(g, -14, 20, 11, 4.5, "#46b34a", OUT, 2, -0.5); ellipse(g, 14, 20, 11, 4.5, "#46b34a", OUT, 2, 0.5);
    g.translate(0, bob * 0.8 - 6);
    const ready = st.fuse != null ? st.fuse : 0;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + t * 0.4; g.save(); g.translate(Math.cos(a) * 17, Math.sin(a) * 17); g.rotate(a); ellipse(g, 0, 0, 11, 7, i % 2 ? "#dff6ff" : "#bdeaff", OUT, 2); g.restore(); }
    circle(g, 0, 0, 14, "#7fd6ff", OUT, 2.5); gloss(g, 0, 0, 14);
    circle(g, -4.5, -2, 2.4, "#14304a", null, 0); circle(g, 4.5, -2, 2.4, "#14304a", null, 0); g.strokeStyle = "#14304a"; g.lineWidth = 1.8; g.beginPath(); g.arc(0, 2, 4, 0.2, Math.PI - 0.2); g.stroke();
    if (ready > 0.6) { glow(g, 0, -4, 28, "#9ef3ff", (ready - 0.6) * 0.9); }
  } else if (type === "bramble") {
    const f = st.hp != null ? st.hp : 1;
    g.translate(0, bob * 0.15);
    fillRR(g, -23, -26, 46, 54, 14, "#7a5230", OUT, 2.5); fillRR(g, -20, -26, 40, 48, 12, "#9a6b3a", null);
    g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(-17, -23, 34, 6);
    for (const [x, y, a] of [[-23, -14, Math.PI], [-23, 6, Math.PI], [23, -14, 0], [23, 6, 0], [-10, -26, -Math.PI / 2], [10, -26, -Math.PI / 2]]) { g.save(); g.translate(x, y); g.rotate(a); poly(g, [[0, -5], [11, 0], [0, 5]], "#cdb68a", OUT, 1.8); g.restore(); }
    circle(g, -8, -6, 4.2, "#fff", OUT, 1.5); circle(g, 8, -6, 4.2, "#fff", OUT, 1.5); circle(g, -7, -5, 2, "#222", null, 0); circle(g, 9, -5, 2, "#222", null, 0);
    g.strokeStyle = "#4a2d12"; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-8, 8); g.lineTo(8, 8); g.stroke();
    g.strokeStyle = "rgba(40,20,5,.75)"; g.lineWidth = 2;
    if (f < 0.66) { g.beginPath(); g.moveTo(-14, -20); g.lineTo(-6, -8); g.lineTo(-12, 2); g.stroke(); }
    if (f < 0.33) { g.beginPath(); g.moveTo(14, -18); g.lineTo(6, -4); g.lineTo(13, 14); g.moveTo(-4, 14); g.lineTo(2, 24); g.stroke(); }
  } else if (type === "frost") {
    poly(g, [[0, 28], [-4, 6], [4, 6]], "#4a8fbf", OUT, 2);
    g.translate(0, bob * 0.7 - 4);
    for (const a of [-1.2, -0.6, 0, 0.6, 1.2]) { g.save(); g.rotate(a); ellipse(g, 0, -20, 7, 17, a === 0 ? "#cfeeff" : "#9fd6ff", OUT, 2); g.restore(); }
    circle(g, 0, 2, 15, "#e6f7ff", OUT, 2.5); gloss(g, 0, 2, 15);
    circle(g, -5, 0, 2.6, "#123", null, 0); circle(g, 5, 0, 2.6, "#123", null, 0); g.strokeStyle = "#123"; g.lineWidth = 1.8; g.beginPath(); g.arc(0, 5, 3.5, 0.2, Math.PI - 0.2); g.stroke();
    fillRR(g, 12 + (st.burst > 0 ? -3 : 0), -1, 12, 7, 3.5, "#9fd6ff", OUT, 1.8);
    g.fillStyle = "#fff"; for (let i = 0; i < 3; i++) { const a = t * 1.2 + i * 2.1; g.globalAlpha = 0.8; g.fillRect(-18 + Math.cos(a) * 20, -16 + Math.sin(a) * 8, 2.5, 2.5); } g.globalAlpha = 1;
  } else if (type === "chili") {
    const f = st.fuse != null ? st.fuse : 0, shake = f > 0 ? Math.sin(t * 60) * (1 + f * 3) : 0;
    g.translate(shake, bob * 0.4);
    g.save(); g.rotate(-0.25);
    ellipse(g, 0, 4, 15, 26, "#ff4d3d", OUT, 2.5); ellipse(g, -5, -6, 5, 12, "rgba(255,255,255,.35)", null, 0, 0.2);
    ellipse(g, 0, -22, 10, 5, "#3fa045", OUT, 2); g.restore();
    circle(g, -5, 2, 4, "#fff", OUT, 1.5); circle(g, 5, 2, 4, "#fff", OUT, 1.5); circle(g, -4, 3, 2, "#222", null, 0); circle(g, 6, 3, 2, "#222", null, 0);
    g.strokeStyle = "#7a0f0f"; g.lineWidth = 2; g.beginPath(); g.moveTo(-6, -3); g.lineTo(-1, -1); g.moveTo(7, -3); g.lineTo(2, -1); g.stroke();
    g.strokeStyle = "#5a3a1c"; g.lineWidth = 2.5; g.beginPath(); g.moveTo(3, -26); g.quadraticCurveTo(10, -34, 14, -30); g.stroke();
    glow(g, 14, -30, 8 + (Math.sin(t * 30) + 1) * 3, "#ffd34a", 0.9); circle(g, 14, -30, 2.6, "#fff6c0", null, 0);
  }
  g.restore();
}

// ------------------------------------------------------------------------------------------------ the Gloom Gang
// e = { hit, slow, eating, leap (0..1 while jumping), hpf }
export function drawEnemy(g, type, cx, cy, s, t, e = {}) {
  const k = s / 78, ph = (e.id || 0) * 1.7, step = Math.sin(t * (e.eating ? 9 : 5) + ph);
  g.save(); g.translate(cx, cy + 14 * k); g.scale(k, k);
  const lift = e.leap != null && e.leap > 0 ? Math.sin(e.leap * Math.PI) * 34 : 0;
  ellipse(g, 0, 22, 22 - lift * 0.2, 6, "rgba(0,0,0,.28)", null, 0);
  g.translate(0, -lift);
  const flash = e.hit > 0;
  const body = (c) => (flash ? "#ffffff" : e.slow > 0 ? shade(c, 0.35) : c);
  if (type === "grub" || type === "capped") {
    for (let i = 3; i >= 0; i--) { const x = 14 - i * 11, y = 10 - Math.abs(Math.sin(t * 5 + ph + i * 0.9)) * 5 * (e.eating ? 0.4 : 1); circle(g, x, y, 12 - i * 1.2, body(i % 2 ? "#8a5fd0" : "#9b6fe0"), OUT, 2.2); }
    circle(g, -16, 2 + step * 1.5, 14, body("#a87ae8"), OUT, 2.5); gloss(g, -16, 2, 14);
    circle(g, -20, -1 + step, 4.6, "#fff", OUT, 1.5); circle(g, -9, -1 + step, 4.6, "#fff", OUT, 1.5); circle(g, -21, -1 + step, 2.2, "#201030", null, 0); circle(g, -10, -1 + step, 2.2, "#201030", null, 0);
    g.strokeStyle = "#201030"; g.lineWidth = 2; g.beginPath(); g.moveTo(-24, -7 + step); g.lineTo(-17, -4 + step); g.moveTo(-6, -7 + step); g.lineTo(-12, -4 + step); g.stroke();
    if (e.eating) { g.fillStyle = "#fff"; g.fillRect(-23, 8 + step, 3, 4); g.fillRect(-18, 8 + step, 3, 4); }
    if (type === "capped") { g.save(); g.translate(-16, -15 + step); fillRR(g, -13, -9, 26, 15, 5, body("#b8bfd0"), OUT, 2.2); fillRR(g, -15, 3, 30, 5, 2.5, body("#8e96ac"), OUT, 1.8); g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(-9, -6, 5, 8); g.restore(); }
  } else if (type === "hopper") {
    const squat = e.leap ? 0 : Math.abs(step) * 3;
    ellipse(g, 0, 8 + squat * 0.3, 24, 15 - squat * 0.2, body("#6fae5a"), OUT, 2.5); ellipse(g, -2, 2, 15, 7, "rgba(255,255,255,.25)", null, 0);
    ellipse(g, 14, 14, 8, 11, body("#5b9a49"), OUT, 2.2); ellipse(g, -2, 20, 11, 5, body("#5b9a49"), OUT, 2);
    circle(g, -17, -3, 9, body("#6fae5a"), OUT, 2); circle(g, -5, -6, 9, body("#6fae5a"), OUT, 2);
    circle(g, -17, -4, 5.2, "#fff", OUT, 1.5); circle(g, -5, -7, 5.2, "#fff", OUT, 1.5); circle(g, -18, -4, 2.4, "#111", null, 0); circle(g, -6, -7, 2.4, "#111", null, 0);
    g.strokeStyle = "#1a3a12"; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-26, 8); g.quadraticCurveTo(-14, 14, -6, 7); g.stroke();
  } else if (type === "brute") {
    const sq = Math.abs(step) * 2;
    ellipse(g, 0, 6, 32, 24 - sq * 0.3, body("#4a3a5c"), OUT, 3); ellipse(g, 0, -4, 24, 12, "rgba(255,255,255,.14)", null, 0);
    for (const [x, y] of [[-14, 24], [4, 26], [18, 22]]) ellipse(g, x, y, 6, 5, body("#352a45"), OUT, 2);
    ellipse(g, -26, 0, 15, 14, body("#5a476e"), OUT, 2.8);
    poly(g, [[-30, -12], [-36, -28], [-24, -14]], body("#d9d3c2"), OUT, 2); poly(g, [[-20, -13], [-18, -29], [-12, -12]], body("#d9d3c2"), OUT, 2);
    circle(g, -32, -2, 5, "#ffeb7a", OUT, 1.8); circle(g, -21, -2, 5, "#ffeb7a", OUT, 1.8); circle(g, -33, -1, 2.4, "#400", null, 0); circle(g, -22, -1, 2.4, "#400", null, 0);
    g.strokeStyle = "#200"; g.lineWidth = 2.8; g.beginPath(); g.moveTo(-37, -8); g.lineTo(-29, -5); g.moveTo(-17, -8); g.lineTo(-25, -5); g.stroke();
    g.fillStyle = "#fff"; if (e.eating) for (let i = 0; i < 4; i++) g.fillRect(-36 + i * 4, 7, 2.6, 5);
    g.strokeStyle = "rgba(0,0,0,.28)"; g.lineWidth = 2; g.beginPath(); g.arc(4, 6, 24, 3.6, 5.5); g.stroke();
  } else if (type === "queen") {
    g.scale(1.45, 1.45); g.translate(8, -6);
    ellipse(g, 0, 8, 30, 26, body("#7a3fc2"), OUT, 3); ellipse(g, 2, -2, 22, 12, "rgba(255,255,255,.16)", null, 0);
    ellipse(g, -22, 0, 16, 15, body("#9051d9"), OUT, 3); gloss(g, -22, 0, 16);
    circle(g, -28, -2, 5.5, "#fff", OUT, 1.6); circle(g, -16, -2, 5.5, "#fff", OUT, 1.6); circle(g, -29, -1, 2.6, "#400", null, 0); circle(g, -17, -1, 2.6, "#400", null, 0);
    g.strokeStyle = "#200"; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-34, -9); g.lineTo(-25, -5); g.moveTo(-10, -9); g.lineTo(-19, -5); g.stroke();
    poly(g, [[-34, -14], [-31, -28], [-26, -18], [-22, -31], [-18, -18], [-13, -28], [-10, -14]], "#ffd34a", OUT, 2.4);
    circle(g, -22, -21, 2.6, "#ff4d6d", OUT, 1.2);
    if (e.eating) { g.fillStyle = "#fff"; for (let i = 0; i < 4; i++) g.fillRect(-32 + i * 4, 8, 2.8, 5); }
  }
  g.restore();
  if (e.hpf != null && e.hpf < 0.999 && (type === "brute" || type === "capped" || type === "queen")) {
    const w = type === "queen" ? 80 : 40; fillRR(g, cx - w / 2, cy - 36 * k - (type === "queen" ? 30 : 0), w, 5.5, 2.7, "rgba(0,0,0,.6)", null);
    fillRR(g, cx - w / 2 + 1, cy - 36 * k + 1 - (type === "queen" ? 30 : 0), Math.max(0, (w - 2) * e.hpf), 3.5, 1.7, e.hpf > 0.5 ? "#7dffb0" : e.hpf > 0.25 ? "#ffd34a" : "#ff6a5a", null);
  }
}

// ------------------------------------------------------------------------------------------------ small things
export function drawDrop(g, x, y, t, fly = 0, size = 1) {
  g.save(); g.translate(x, y + Math.sin(t * 4 + x) * 2); g.scale(size, size);
  glow(g, 0, 0, 26, "#8fe3ff", 0.55 + 0.2 * Math.sin(t * 6));
  g.beginPath(); g.moveTo(0, -16); g.bezierCurveTo(14, 2, 12, 15, 0, 15); g.bezierCurveTo(-12, 15, -14, 2, 0, -16); g.closePath();
  const gr = g.createLinearGradient(0, -16, 0, 15); gr.addColorStop(0, "#d9f6ff"); gr.addColorStop(1, "#38b6f0"); g.fillStyle = gr; g.fill(); g.strokeStyle = OUT; g.lineWidth = 2.2; g.stroke();
  ellipse(g, -4, 2, 3, 6, "rgba(255,255,255,.8)", null, 0, 0.3);
  g.restore();
}
export function drawSeed(g, x, y, frost) {
  glow(g, x, y, 14, frost ? "#9fe6ff" : "#c8ff7a", 0.45);
  circle(g, x, y, 6.5, frost ? "#bfeaff" : "#9be25a", OUT, 2); circle(g, x - 2, y - 2, 2, "rgba(255,255,255,.8)", null, 0);
}
export function drawCart(g, x, y, s, run, t) {
  const k = s / 78; g.save(); g.translate(x, y + 12 * k); g.scale(k, k);
  if (run) g.translate(0, Math.sin(t * 40) * 1.2);
  ellipse(g, 0, 22, 26, 6, "rgba(0,0,0,.3)", null, 0);
  fillRR(g, -24, -12, 48, 28, 7, "#e0463a", OUT, 2.5); fillRR(g, -21, -10, 42, 7, 4, "#ff8a7a", null);
  fillRR(g, -28, -18, 56, 8, 4, "#a8281f", OUT, 2.2);
  circle(g, -14, 20, 8, "#2a2a38", OUT, 2); circle(g, 14, 20, 8, "#2a2a38", OUT, 2); circle(g, -14, 20, 3, "#aab", null, 0); circle(g, 14, 20, 3, "#aab", null, 0);
  g.restore();
}
