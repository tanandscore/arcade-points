// Kiko Leap — all the pictures. Everything is drawn with canvas shapes (no image files).
// Every function draws one thing with its FEET at (x, y), so characters sit exactly on the ground.
import { TAU, clamp, lerp, mix, shade, rgba, hexToRgb } from "../../core/util";
import { OUT, circle, ellipse, fillRR, rr, poly, line, capsule, lin, rad, glow, star, starPath, heart, gloss } from "../../core/draw";

const hsl = (h, s = 90, l = 62) => { // tiny hsl -> hex so we can use the helpers that expect hex colours
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100; const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return "#" + [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
};
export const rainbow = (t, o = 0) => hsl(t * 240 + o);

// ============================================================ KIKO (the hero) ============================================================
export function drawKiko(g, p) {
  // p: x, y(feet), face, t, run(phase), speed(0..1.3), air, vy, vx, glide, pound(0|1|2), blink, power, sx, sy, mood("happy"|"hurt"|"ouch"), alpha
  const { x, y, face = 1, t = 0 } = p, sp = clamp(p.speed || 0, 0, 1.4), air = !!p.air, run = p.run || 0;
  g.save(); g.translate(x, y); g.scale(face * (p.sx || 1), p.sy || 1); if (p.alpha != null) g.globalAlpha *= p.alpha;
  if (p.power) { const c = rainbow(t * 1.3); glow(g, 0, -22, 56 + Math.sin(t * 12) * 4, c, 0.55); }

  if (p.pound === 1) { // winding up: a spinning ball
    g.translate(0, -19); g.rotate(t * 26); body(g, 0, 0, 1, true); g.restore(); return;
  }
  const bob = air ? 0 : Math.abs(Math.sin(run)) * 2.4 * sp;
  // feet
  const FOOT = "#4a2aa0", pd = p.pound === 2;
  const fl = air ? [-7, pd ? -2 : -7 + Math.min(4, (p.vy || 0) * 0.004)] : [-7 + Math.sin(run) * 7 * sp, -3 - Math.max(0, Math.cos(run)) * 5 * sp];
  const fr = air ? [8, pd ? -2 : -5] : [8 - Math.sin(run) * 7 * sp, -3 - Math.max(0, -Math.cos(run)) * 5 * sp];
  ellipse(g, fl[0], fl[1], 7, 4.6, FOOT, OUT, 2.5); ellipse(g, fr[0], fr[1], 7, 4.6, FOOT, OUT, 2.5);
  g.translate(0, -bob);
  // scarf tail
  const L = 10 + sp * 13 + (air ? 4 : 0), w = Math.sin(t * 17) * 3 * (0.4 + sp * 0.8), vyE = clamp(-(p.vy || 0) * 0.012, -7, 7);
  g.beginPath(); g.moveTo(-13, -17); g.bezierCurveTo(-13 - L * 0.4, -18 + w, -13 - L * 0.7, -14 - w + vyE * 0.5, -13 - L, -13 + w * 0.6 + vyE);
  g.lineTo(-13 - L + 0.5, -6 + w * 0.6 + vyE); g.bezierCurveTo(-13 - L * 0.7, -8 - w + vyE * 0.5, -13 - L * 0.4, -9 + w, -13, -9); g.closePath();
  g.fillStyle = "#e0338f"; g.fill(); g.lineWidth = 2.6; g.lineJoin = "round"; g.strokeStyle = OUT; g.stroke();
  // arms (behind)
  const arm = air ? (p.glide ? -9 : -4) : Math.sin(run) * 5 * sp;
  ellipse(g, -15, -13 + arm * 0.6 - (p.glide ? 9 : 0), 4.4, 5.4, "#17a3a8", OUT, 2.2);
  body(g, 0, 0, 1, false, p);
  ellipse(g, 17, -13 - arm * 0.6 - (p.glide ? 9 : 0), 4.4, 5.4, "#1fbdbb", OUT, 2.2);
  g.restore();
}

function body(g, cx, cy, k, ball, p = {}) {
  const t = p.t || 0, mood = p.mood || "happy";
  if (ball) { // curled up ball (ground pound wind-up)
    circle(g, 0, 0, 17, lin(g, 0, -17, 0, 17, [[0, "#78fbec"], [1, "#16a9ae"]]), OUT, 3);
    ellipse(g, 6, -3, 4, 5, "#fff", OUT, 2); circle(g, 7.5, -3, 2.2, OUT); ellipse(g, -8, 2, 4, 5, "#e0338f", OUT, 2); return;
  }
  // tuft or propeller
  if (p.glide) {
    const a = Math.cos(t * 34); g.save(); g.translate(1, -44);
    g.globalAlpha *= 0.38; ellipse(g, 0, 0, 25, 4.5, "#c9ffd9"); g.globalAlpha /= 0.38;
    for (const [rx, c] of [[24 * a, "#7dff6a"], [-24 * a, "#2fd36a"]]) { g.beginPath(); g.ellipse(0, 0, Math.abs(rx), 3.2, 0, 0, TAU); g.fillStyle = c; g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke(); }
    circle(g, 0, 3, 3.2, "#2fd36a", OUT, 2); g.restore();
  } else {
    const lean = clamp((p.vx || 0) / 260, -1, 1) * -0.22 * (p.face || 1), air = p.air ? clamp((p.vy || 0) * 0.0003, -0.3, 0.3) : 0;
    for (let i = -1; i <= 1; i++) {
      g.save(); g.translate(2, -38); g.rotate(i * 0.5 + lean + air + Math.sin(t * 5 + i * 1.7) * 0.1);
      g.beginPath(); g.moveTo(-3.2, 0); g.quadraticCurveTo(-6, -10, 0, -16 - (i === 0 ? 3 : 0)); g.quadraticCurveTo(6, -10, 3.2, 0); g.closePath();
      g.fillStyle = i === 0 ? "#8dff72" : "#46dd7c"; g.fill(); g.lineWidth = 2.2; g.lineJoin = "round"; g.strokeStyle = OUT; g.stroke(); g.restore();
    }
  }
  // main body
  rr(g, -16, -40, 32, 38, 15.5); g.fillStyle = lin(g, 0, -40, 0, -2, [[0, "#78fbec"], [0.55, "#34d3cb"], [1, "#16a9ae"]]); g.fill(); g.lineWidth = 3; g.lineJoin = "round"; g.strokeStyle = OUT; g.stroke();
  ellipse(g, 3, -8.5, 10.5, 6.5, "rgba(210,255,248,.5)"); // belly
  ellipse(g, -8, -33, 5, 2.6, "rgba(255,255,255,.5)", null, 0, -0.5); // shine
  // scarf ring
  rr(g, -16.5, -17.5, 33, 7.5, 3.5); g.fillStyle = "#ff3ea5"; g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
  g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 1.6; g.beginPath(); for (let i = 0; i < 4; i++) { g.moveTo(-10 + i * 9, -16.5); g.lineTo(-7 + i * 9, -12); } g.stroke();
  // face
  const lx = clamp((p.vx || 0) / 260, -1, 1) * 1.1, ly = clamp((p.vy || 0) / 700, -1, 1) * 1.5;
  for (const ex of [3.2, 13.2]) {
    if (p.blink || mood === "hurt") { g.strokeStyle = OUT; g.lineWidth = 2.6; g.lineCap = "round"; g.beginPath(); if (mood === "hurt") { g.moveTo(ex - 3.4, -34); g.lineTo(ex + 3.4, -28); g.moveTo(ex + 3.4, -34); g.lineTo(ex - 3.4, -28); } else { g.moveTo(ex - 3.6, -30); g.quadraticCurveTo(ex, -27.5, ex + 3.6, -30); } g.stroke(); continue; }
    ellipse(g, ex, -30.5, 5, 6.4, "#fff", OUT, 2.3);
    circle(g, ex + 1.8 + lx, -30 + ly, 3.1, OUT); circle(g, ex + 2.9 + lx, -31.4 + ly, 1.15, "#fff");
  }
  if (p.power || mood === "ouch") { g.strokeStyle = OUT; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-1, -38.5); g.lineTo(7, -36); g.moveTo(17, -38.5); g.lineTo(10, -36); g.stroke(); }
  ellipse(g, 16, -21.5, 3.2, 2, "rgba(255,90,170,.6)");
  g.strokeStyle = OUT; g.lineWidth = 2.3; g.lineCap = "round";
  if (p.glide || mood === "ouch" || mood === "hurt") { ellipse(g, 9.2, -22.2, 2.5, 3.1, "#6a1245", OUT, 2); }
  else if (p.power) { g.beginPath(); g.arc(9.2, -24.2, 4.2, 0.1, Math.PI - 0.1); g.closePath(); g.fillStyle = "#6a1245"; g.fill(); g.stroke(); }
  else { g.beginPath(); g.arc(9.2, -24.6, 3.6, 0.2, Math.PI - 0.35); g.stroke(); }
}

// soft blob under characters so landings are easy to judge
export function drawShadow(g, x, groundY, heightAbove, w = 30) {
  const k = clamp(1 - heightAbove / 340, 0, 1); if (k <= 0.02) return;
  g.save(); g.globalAlpha = 0.32 * k; ellipse(g, x, groundY - 1, w * (0.5 + 0.5 * k), 4.2 * (0.5 + 0.5 * k), "#0a0420"); g.restore();
}

// ============================================================ ENEMIES ============================================================
// e: x, y(feet), face, t(local clock), dead(0..1 squash), squash, state ...
function sqz(g, e, base = 1) { const d = e.dead || 0; return d ? [1 + d * 0.45, Math.max(0.12, 1 - d * 0.85)] : [1, 1]; }

export function drawGloop(g, e, t) {
  const [dx, dy] = sqz(g, e), w = 1 + Math.sin(t * 9 + (e.ph || 0)) * 0.07;
  g.save(); g.translate(e.x, e.y); g.scale(dx * (e.face || 1) * (1 / w), dy * w);
  const step = Math.sin(t * 12 + (e.ph || 0)) * 3;
  ellipse(g, -8 + step, -2.5, 6.5, 4.2, "#1f8f3d", OUT, 2.3); ellipse(g, 8 - step, -2.5, 6.5, 4.2, "#1f8f3d", OUT, 2.3);
  g.beginPath(); g.moveTo(-20, -3); g.bezierCurveTo(-23, -22, -12, -32, 0, -32); g.bezierCurveTo(12, -32, 23, -22, 20, -3); g.closePath();
  g.fillStyle = lin(g, 0, -32, 0, -3, [[0, "#a4ff7e"], [0.55, "#55d84c"], [1, "#2da74a"]]); g.fill(); g.lineWidth = 3; g.lineJoin = "round"; g.strokeStyle = OUT; g.stroke();
  ellipse(g, -8, -25, 6, 3, "rgba(255,255,255,.55)", null, 0, -0.5);
  for (const ex of [-4, 8]) { ellipse(g, ex, -17, 4.4, 5.6, "#fff", OUT, 2); circle(g, ex + 1.6, -16.4, 2.4, OUT); }
  g.strokeStyle = OUT; g.lineWidth = 2.6; g.lineCap = "round"; g.beginPath(); g.moveTo(-9, -24); g.lineTo(-1, -21); g.moveTo(14, -24); g.lineTo(6, -21); g.stroke();
  g.restore();
}

export function drawSpikeback(g, e, t) {
  const [dx, dy] = sqz(g, e);
  g.save(); g.translate(e.x, e.y); g.scale(dx * (e.face || 1), dy);
  const step = Math.sin(t * 9 + (e.ph || 0)) * 3.5;
  ellipse(g, -10 + step, -2.5, 6, 4, "#3a1c7a", OUT, 2.2); ellipse(g, 9 - step, -2.5, 6, 4, "#3a1c7a", OUT, 2.2);
  for (let i = 0; i < 7; i++) { // spikes fanned over the back
    const a = Math.PI * 0.95 - i * 0.3 - 0.1, cx = -2 + Math.cos(a) * -17, cy = -13 + Math.sin(a) * -12;
    g.save(); g.translate(cx, cy); g.rotate(a + Math.PI / 2 * 0 - Math.PI / 2 + 0.0); poly(g, [[-5, 0], [0, -14], [5, 0]], "#f6f2ff", OUT, 2.4); g.restore();
  }
  ellipse(g, -2, -12, 20, 13, lin(g, 0, -25, 0, 1, [[0, "#b58bff"], [1, "#6a3bd6"]]), OUT, 3);
  ellipse(g, 16, -10, 8, 6.5, "#d9c4ff", OUT, 2.4); circle(g, 22, -11.5, 2.2, OUT);
  ellipse(g, 9, -17, 3.6, 4.4, "#fff", OUT, 1.8); circle(g, 10.2, -16.6, 1.9, OUT);
  g.strokeStyle = OUT; g.lineWidth = 2.2; g.lineCap = "round"; g.beginPath(); g.moveTo(4, -23); g.lineTo(12, -20); g.stroke();
  g.restore();
}

export function drawBuzz(g, e, t) {
  const [dx, dy] = sqz(g, e), f = Math.sin(t * 46 + (e.ph || 0));
  g.save(); g.translate(e.x, e.y); g.scale(dx * (e.face || 1), dy);
  for (const s of [-1, 1]) { g.save(); g.translate(-3 + s * 4, -27); g.rotate((-0.5 + f * 0.6) * s - 0.3 * s); ellipse(g, 0, -9, 6.5, 12, "rgba(235,248,255,.8)", "rgba(21,10,51,.7)", 1.8); g.restore(); }
  circle(g, 0, -14, 14.5, lin(g, 0, -29, 0, 1, [[0, "#fff08a"], [1, "#ffad1f"]]), OUT, 3);
  g.save(); g.beginPath(); g.arc(0, -14, 13, 0, TAU); g.clip(); g.fillStyle = "#3a1c7a"; g.fillRect(-18, -19, 36, 4.5); g.fillRect(-18, -9, 36, 4.5); g.restore();
  for (const ex of [4, 12]) { ellipse(g, ex, -17, 3.8, 4.8, "#fff", OUT, 1.8); circle(g, ex + 1, -16.6, 2, OUT); }
  g.strokeStyle = OUT; g.lineWidth = 2; g.lineCap = "round"; g.beginPath(); g.moveTo(8, -28); g.quadraticCurveTo(10, -34, 15, -34); g.stroke(); circle(g, 15, -34, 2, "#ffad1f", OUT, 1.6);
  poly(g, [[-13, -12], [-21, -8], [-13, -8]], "#3a1c7a", OUT, 2);
  g.restore();
}

export function drawHopper(g, e, t) {
  const [dx, dy] = sqz(g, e), air = !e.onGround, k = air ? 1.12 : e.crouch ? 0.8 : 1;
  g.save(); g.translate(e.x, e.y); g.scale(dx * (e.face || 1) * (2 - k), dy * k);
  ellipse(g, -11, air ? -6 : -4, 9, air ? 4 : 5.5, "#e0701d", OUT, 2.4); ellipse(g, 11, air ? -6 : -4, 9, air ? 4 : 5.5, "#e0701d", OUT, 2.4);
  ellipse(g, 0, -16, 18, 14.5, lin(g, 0, -30, 0, -2, [[0, "#ffc16a"], [1, "#ee7d24"]]), OUT, 3);
  ellipse(g, 2, -10, 11, 8, "#ffe3b5");
  for (const ex of [-7, 8]) { circle(g, ex, -28, 6.2, "#fff", OUT, 2.2); circle(g, ex + 1.4, -27.5, 3, OUT); }
  g.strokeStyle = OUT; g.lineWidth = 2.4; g.lineCap = "round"; g.beginPath(); g.arc(4, -16, 6, 0.2, Math.PI - 0.2); g.stroke();
  g.restore();
}

export function drawSpitter(g, e, t) {
  const [dx, dy] = sqz(g, e), charge = clamp(e.charge || 0, 0, 1), face = e.face || 1;
  g.save(); g.translate(e.x, e.y); g.scale(dx, dy);
  poly(g, [[-13, 0], [-16, -16], [16, -16], [13, 0]], lin(g, 0, -16, 0, 0, [[0, "#d58b52"], [1, "#9a5a2b"]]), OUT, 3);
  rr(g, -17, -21, 34, 8, 4); g.fillStyle = "#e7a169"; g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
  const sway = Math.sin(t * 3 + (e.ph || 0)) * 3 + face * 4, hx = sway, hy = -45 - charge * 3 + Math.sin(t * 6) * 1.4;
  g.beginPath(); g.moveTo(0, -20); g.quadraticCurveTo(hx * 0.2, -32, hx, hy + 12); g.lineWidth = 8; g.lineCap = "round"; g.strokeStyle = OUT; g.stroke(); g.lineWidth = 4; g.strokeStyle = "#3ab35a"; g.stroke();
  ellipse(g, -9, -30, 8, 4, "#3ab35a", OUT, 2.2, -0.5); ellipse(g, 9, -26, 8, 4, "#3ab35a", OUT, 2.2, 0.5);
  const r = 15 + charge * 3; circle(g, hx, hy, r, lin(g, 0, hy - r, 0, hy + r, [[0, "#ff7ac0"], [1, "#c11f77"]]), OUT, 3);
  g.fillStyle = "rgba(255,255,255,.7)"; for (const [sx2, sy2, sr] of [[-7, -7, 2.6], [3, -10, 2], [-3, 5, 1.8]]) { g.beginPath(); g.arc(hx + sx2, hy + sy2, sr, 0, TAU); g.fill(); }
  // mouth facing the hero
  g.save(); g.translate(hx + face * (r - 6), hy + 3); g.scale(face, 1); const open = 4 + charge * 6;
  g.beginPath(); g.moveTo(-2, -open); g.quadraticCurveTo(10, 0, -2, open); g.closePath(); g.fillStyle = "#4b0f35"; g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke();
  poly(g, [[0, -open + 1], [3, -open + 6], [5, -open + 1]], "#fff", null); poly(g, [[0, open - 1], [3, open - 6], [5, open - 1]], "#fff", null);
  g.restore();
  for (const [ex, ey] of [[face * -2, -4], [face * 6, -5]]) { ellipse(g, hx + ex - face * 2, hy + ey - 3, 3.4, 4.4, "#fff", OUT, 1.8); circle(g, hx + ex - face * 2 + face * 1.2, hy + ey - 2.6, 1.8, OUT); }
  g.restore();
}

export function drawBat(g, e, t) {
  const [dx, dy] = sqz(g, e), sleep = e.state === "sleep", f = sleep ? 0 : Math.sin(t * 22 + (e.ph || 0));
  g.save(); g.translate(e.x, e.y); g.scale(dx * (e.face || 1), dy);
  if (sleep) g.scale(1, -1), g.translate(0, 26); // hanging upside down
  const wy = sleep ? 0.2 : f;
  for (const s of [-1, 1]) {
    g.save(); g.scale(s, 1); g.translate(5, -17); g.rotate(sleep ? 0.9 : -0.35 + wy * 0.7);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(14, -16, 30, -8); g.quadraticCurveTo(26, -3, 24, 2); g.quadraticCurveTo(20, -2, 16, 5); g.quadraticCurveTo(10, 1, 4, 10); g.closePath();
    g.fillStyle = lin(g, 0, -16, 0, 10, [[0, "#7c4fe0"], [1, "#43228f"]]); g.fill(); g.lineWidth = 2.6; g.lineJoin = "round"; g.strokeStyle = OUT; g.stroke(); g.restore();
  }
  ellipse(g, 0, -13, 10.5, 12, lin(g, 0, -25, 0, -1, [[0, "#6a3fd0"], [1, "#3a1c7a"]]), OUT, 3);
  poly(g, [[-8, -22], [-6, -31], [-2, -23]], "#6a3fd0", OUT, 2.4); poly(g, [[8, -22], [6, -31], [2, -23]], "#6a3fd0", OUT, 2.4);
  if (sleep) { g.strokeStyle = "#ff8fd0"; g.lineWidth = 2; g.beginPath(); g.moveTo(-6, -14); g.lineTo(-2, -13); g.moveTo(2, -13); g.lineTo(6, -14); g.stroke(); }
  else { for (const ex of [-4, 4]) { circle(g, ex, -15, 3.2, "#fff", OUT, 1.8); circle(g, ex + 0.6, -14.6, 1.6, "#d4143c"); } poly(g, [[-3, -8], [-1.5, -5], [0, -8]], "#fff", null); poly(g, [[0, -8], [1.5, -5], [3, -8]], "#fff", null); }
  g.restore();
}

export function drawFireling(g, e, t) {
  const fl = Math.sin(t * 26 + (e.ph || 0)), up = clamp(-(e.vy || 0) / 600, -0.5, 1);
  g.save(); g.translate(e.x, e.y);
  glow(g, 0, -16, 46, "#ff8a2a", 0.55);
  g.save(); g.scale(1 + fl * 0.06, 1 + up * 0.18);
  g.beginPath(); g.moveTo(0, -42 - fl * 3); g.bezierCurveTo(12, -28, 21, -18, 16, -6); g.bezierCurveTo(12, 3, -12, 3, -16, -6); g.bezierCurveTo(-21, -18, -10, -28, 0, -42 - fl * 3); g.closePath();
  g.fillStyle = lin(g, 0, -42, 0, 3, [[0, "#ffe27a"], [0.5, "#ff9a2a"], [1, "#e0301c"]]); g.fill(); g.lineWidth = 3; g.lineJoin = "round"; g.strokeStyle = OUT; g.stroke();
  g.beginPath(); g.moveTo(0, -28); g.bezierCurveTo(7, -20, 10, -13, 6, -6); g.bezierCurveTo(2, -2, -6, -2, -8, -8); g.bezierCurveTo(-10, -14, -4, -21, 0, -28); g.fillStyle = "rgba(255,243,170,.75)"; g.fill();
  for (const ex of [-5, 5]) { ellipse(g, ex, -14, 3.6, 4.6, "#fff", OUT, 1.8); circle(g, ex + 0.6, -13.4, 1.9, OUT); }
  g.strokeStyle = OUT; g.lineWidth = 2.2; g.lineCap = "round"; g.beginPath(); g.moveTo(-9, -21); g.lineTo(-2, -18); g.moveTo(9, -21); g.lineTo(2, -18); g.stroke();
  g.restore(); g.restore();
}

export function drawCrusher(g, e, t) { // e.x centre, e.y = BOTTOM of the block, size 56
  const s = 56, hot = e.warn > 0;
  g.save(); g.translate(e.x + (hot ? Math.sin(t * 90) * 1.6 : 0), e.y);
  rr(g, -s / 2, -s, s, s - 6, 8); g.fillStyle = lin(g, 0, -s, 0, 0, [[0, "#8d97b8"], [1, "#4a5379"]]); g.fill(); g.lineWidth = 3; g.lineJoin = "round"; g.strokeStyle = OUT; g.stroke();
  g.fillStyle = "rgba(255,255,255,.2)"; g.fillRect(-s / 2 + 4, -s + 4, s - 8, 4);
  for (let i = 0; i < 4; i++) poly(g, [[-s / 2 + 3 + i * 13.5, -6], [-s / 2 + 10 + i * 13.5, 0], [-s / 2 + 17 + i * 13.5, -6]], "#f2efff", OUT, 2.2);
  g.fillStyle = "#2d3350"; for (const [rx, ry] of [[-22, -48], [22, -48]]) { g.beginPath(); g.arc(rx, ry, 2.4, 0, TAU); g.fill(); }
  for (const ex of [-11, 11]) { ellipse(g, ex, -30, 6.5, 7.5, hot ? "#ffd2d2" : "#fff", OUT, 2.2); circle(g, ex, -29, 3.2, hot ? "#e0102a" : OUT); }
  g.strokeStyle = OUT; g.lineWidth = 3.2; g.lineCap = "round"; g.beginPath(); g.moveTo(-19, -42); g.lineTo(-4, -37); g.moveTo(19, -42); g.lineTo(4, -37); g.stroke();
  g.restore();
}

export function drawCloudling(g, e, t) {
  const charge = clamp(e.charge || 0, 0, 1), bob = Math.sin(t * 2.4 + (e.ph || 0)) * 3;
  g.save(); g.translate(e.x, e.y + bob);
  const blobs = [[0, -22, 20], [-24, -14, 15], [24, -14, 15], [-12, -30, 13], [12, -31, 13], [-34, -8, 10], [34, -8, 10]];
  const col = charge > 0 ? mix("#5a4a8a", "#ffe27a", charge * 0.35 * (0.6 + 0.4 * Math.sin(t * 40))) : "#5a4a8a";
  g.fillStyle = OUT; for (const [bx, by, br] of blobs) { g.beginPath(); g.arc(bx, by, br + 3, 0, TAU); g.fill(); }
  g.fillStyle = col; for (const [bx, by, br] of blobs) { g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill(); }
  g.fillStyle = "rgba(255,255,255,.12)"; g.beginPath(); g.arc(-8, -32, 11, 0, TAU); g.fill();
  for (const ex of [-8, 9]) { ellipse(g, ex, -22, 4.6, 5.8, charge > 0 ? "#fff6a8" : "#fff", OUT, 2); circle(g, ex + 0.8, -21.4, 2.3, OUT); }
  g.strokeStyle = OUT; g.lineWidth = 2.8; g.lineCap = "round"; g.beginPath(); g.moveTo(-15, -30); g.lineTo(-4, -26); g.moveTo(16, -30); g.lineTo(5, -26); g.stroke();
  g.beginPath(); g.arc(0, -12, 5, Math.PI + 0.3, TAU - 0.3); g.stroke();
  if (charge > 0) { glow(g, 0, 0, 40, "#ffe27a", 0.3 * charge); }
  g.restore();
}

// lightning column from y0 down to y1 at x
export function drawBolt(g, x, y0, y1, t, a = 1, wd = 18) {
  g.save(); g.globalAlpha *= a; g.globalCompositeOperation = "lighter";
  g.fillStyle = "rgba(255,230,120,.28)"; g.fillRect(x - wd * 0.9, y0, wd * 1.8, y1 - y0);
  g.globalCompositeOperation = "source-over";
  const pts = []; const n = Math.max(3, Math.round((y1 - y0) / 34)); for (let i = 0; i <= n; i++) pts.push([x + (i === 0 || i === n ? 0 : Math.sin(i * 7.3 + Math.floor(t * 30)) * wd * 0.5), y0 + ((y1 - y0) * i) / n]);
  g.lineJoin = "round"; g.lineCap = "round"; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.lineWidth = wd * 0.7; g.strokeStyle = OUT; g.stroke();
  g.lineWidth = wd * 0.4; g.strokeStyle = "#fff3a0"; g.stroke(); g.lineWidth = wd * 0.14; g.strokeStyle = "#fff"; g.stroke(); g.restore();
}

// ============================================================ ITEMS & WORLD OBJECTS ============================================================
export function drawCoin(g, x, y, t, ph = 0) { // y = centre
  const w = Math.abs(Math.cos(t * 5 + ph)) * 8.5 + 2.2, bob = Math.sin(t * 3 + ph) * 2;
  g.save(); g.translate(x, y + bob); glow(g, 0, 0, 20, "#ffd23a", 0.28);
  ellipse(g, 0, 0, w, 11, lin(g, -w, -11, w, 11, [[0, "#fff1a0"], [0.5, "#ffc61a"], [1, "#e0900a"]]), OUT, 2.4);
  if (w > 6) { ellipse(g, 0, 0, w * 0.55, 6.5, null, "rgba(160,92,0,.55)", 1.8); }
  g.restore();
}
export function drawSeed(g, x, y, t, ph = 0) { // the three big star seeds
  const bob = Math.sin(t * 2.4 + ph) * 4, r = 17 + Math.sin(t * 6 + ph) * 1.2;
  g.save(); g.translate(x, y + bob); glow(g, 0, 0, 56, "#9a7bff", 0.5); glow(g, 0, 0, 30, "#ffffff", 0.35);
  g.rotate(Math.sin(t * 1.8 + ph) * 0.22); starPath(g, 0, 0, r, 5, 0.5); g.fillStyle = lin(g, 0, -r, 0, r, [[0, "#bff9ff"], [0.5, "#7c5cff"], [1, "#ff3ea5"]]); g.fill(); g.lineWidth = 3; g.lineJoin = "round"; g.strokeStyle = OUT; g.stroke();
  starPath(g, 0, 0, r * 0.45, 5, 0.5); g.fillStyle = "rgba(255,255,255,.75)"; g.fill();
  for (let i = 0; i < 3; i++) { const a = t * 2 + i * 2.1 + ph; star(g, Math.cos(a) * 27, Math.sin(a) * 22, 3 + Math.sin(t * 8 + i) * 1, "#fff6c4", null, 0, 4, 0.4); }
  g.restore();
}
export function drawHeartItem(g, x, y, t, ph = 0) { const s = 1 + Math.sin(t * 7 + ph) * 0.08; g.save(); g.translate(x, y + Math.sin(t * 3 + ph) * 3); g.scale(s, s); glow(g, 0, 0, 34, "#ff3ea5", 0.45); heart(g, 0, 0, 13, "#ff4fa8", OUT, 2.8); ellipse(g, -5, -6, 3.4, 2.2, "rgba(255,255,255,.7)", null, 0, -0.6); g.restore(); }
export function drawPowerStar(g, x, y, t, ph = 0) { const c = rainbow(t, ph * 40); g.save(); g.translate(x, y + Math.sin(t * 3) * 4); g.rotate(t * 2.2); glow(g, 0, 0, 52, c, 0.55); starPath(g, 0, 0, 20, 5, 0.5); g.fillStyle = c; g.fill(); g.lineWidth = 3.4; g.lineJoin = "round"; g.strokeStyle = OUT; g.stroke(); starPath(g, 0, 0, 9, 5, 0.5); g.fillStyle = "rgba(255,255,255,.7)"; g.fill(); g.restore(); }

export function drawSpring(g, x, y, compress = 0, t = 0) { // y = ground
  const h = 26 - compress * 12, w = 40;
  g.save(); g.translate(x, y);
  rr(g, -w / 2, -6, w, 6, 3); g.fillStyle = "#6a5b8f"; g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
  g.strokeStyle = OUT; g.lineWidth = 8; g.lineCap = "round"; g.beginPath(); for (let i = 0; i <= 5; i++) { const yy = -6 - (h - 10) * (i / 5), xx = (i % 2 ? 1 : -1) * 12; i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.stroke();
  g.strokeStyle = "#c6c0e6"; g.lineWidth = 4; g.beginPath(); for (let i = 0; i <= 5; i++) { const yy = -6 - (h - 10) * (i / 5), xx = (i % 2 ? 1 : -1) * 12; i ? g.lineTo(xx, yy) : g.moveTo(xx, yy); } g.stroke();
  rr(g, -w / 2 - 3, -h - 8, w + 6, 10, 5); g.fillStyle = lin(g, 0, -h - 8, 0, -h + 2, [[0, "#ff7ac0"], [1, "#e0338f"]]); g.fill(); g.lineWidth = 2.8; g.strokeStyle = OUT; g.stroke();
  g.fillStyle = "rgba(255,255,255,.45)"; g.fillRect(-w / 2 + 3, -h - 6, w - 6, 2.5);
  g.restore();
}

export function drawPlatform(g, p, t, look = "meadow") { // p: x,y (top-left), w, kind
  const { x, y, w } = p, h = 16, hover = p.kind === "m" || p.kind === "M", crack = p.kind === "d";
  g.save(); g.translate(x, y + (p.shake ? Math.sin(t * 80) * 1.6 : 0));
  if (hover) { glow(g, w / 2, h + 8, w * 0.55, "#3ee6e0", 0.28); }
  const top = hover ? "#8ff3ff" : crack ? "#d8b48a" : "#e0aa6c", bot = hover ? "#2f8fc4" : crack ? "#8f6a45" : "#a8703a";
  rr(g, 0, 0, w, h, 6); g.fillStyle = lin(g, 0, 0, 0, h, [[0, top], [1, bot]]); g.fill(); g.lineWidth = 2.8; g.lineJoin = "round"; g.strokeStyle = OUT; g.stroke();
  g.fillStyle = "rgba(255,255,255,.4)"; g.fillRect(5, 3, w - 10, 2.4);
  g.fillStyle = hover ? "#124a6a" : "#5a381a"; for (let i = 0; i < Math.floor(w / 24); i++) { g.beginPath(); g.arc(12 + i * 24, 9, 1.8, 0, TAU); g.fill(); }
  if (crack) { g.strokeStyle = "rgba(60,30,10,.7)"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(w * 0.3, 1); g.lineTo(w * 0.36, 8); g.lineTo(w * 0.31, 15); g.moveTo(w * 0.7, 1); g.lineTo(w * 0.64, 7); g.stroke(); }
  if (hover) { poly(g, [[w / 2 - 14, h], [w / 2 + 14, h], [w / 2 + 8, h + 7 + Math.sin(t * 30) * 2], [w / 2 - 8, h + 7 + Math.sin(t * 30 + 1) * 2]], "rgba(120,240,255,.7)", null); }
  g.restore();
}

export function drawCheckpoint(g, x, y, on, t) { // y = ground
  g.save(); g.translate(x, y);
  rr(g, -3, -78, 6, 78, 3); g.fillStyle = "#cfc6f5"; g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
  circle(g, 0, -80, 6, on ? "#ffc233" : "#8b83b8", OUT, 2.4);
  const wv = on ? Math.sin(t * 6) * 3 : 0, up = on ? 0 : 34;
  g.beginPath(); g.moveTo(3, -70 + up); g.quadraticCurveTo(20, -76 + up + wv, 36, -68 + up); g.quadraticCurveTo(24, -60 + up - wv, 36, -50 + up); g.quadraticCurveTo(20, -54 + up + wv, 3, -48 + up); g.closePath();
  g.fillStyle = on ? "#ff3ea5" : "#6f68a0"; g.fill(); g.lineWidth = 2.6; g.lineJoin = "round"; g.strokeStyle = OUT; g.stroke();
  if (on) { glow(g, 18, -60, 44, "#ff3ea5", 0.4); star(g, 16, -59, 6, "#fff6c4", OUT, 1.6); }
  ellipse(g, 0, -2, 12, 4.5, "#6a5b8f", OUT, 2.4);
  g.restore();
}

export function drawGoal(g, x, y, t, open = true) { // a tall flag pole with a big star flag; y = ground
  g.save(); g.translate(x, y);
  const hgt = 190;
  glow(g, 0, -hgt / 2, 120, "#ffc233", open ? 0.22 : 0.06);
  ellipse(g, 0, -3, 22, 7, "#6a5b8f", OUT, 2.6);
  rr(g, -4, -hgt, 8, hgt, 4); g.fillStyle = lin(g, -4, 0, 4, 0, [[0, "#fff6c4"], [1, "#e6b53a"]]); g.fill(); g.lineWidth = 2.8; g.strokeStyle = OUT; g.stroke();
  circle(g, 0, -hgt - 4, 9, "#ffc233", OUT, 2.8);
  const wv = Math.sin(t * 5) * 4;
  g.beginPath(); g.moveTo(4, -hgt + 6); g.quadraticCurveTo(40, -hgt + 2 + wv, 78, -hgt + 12); g.quadraticCurveTo(62, -hgt + 36 - wv, 78, -hgt + 62); g.quadraticCurveTo(40, -hgt + 56 + wv, 4, -hgt + 66); g.closePath();
  g.fillStyle = lin(g, 0, -hgt, 80, -hgt + 60, [[0, "#ff5fb0"], [1, "#7c5cff"]]); g.fill(); g.lineWidth = 3; g.lineJoin = "round"; g.strokeStyle = OUT; g.stroke();
  star(g, 36, -hgt + 36 + wv * 0.3, 15, "#ffe27a", OUT, 2.4);
  if (open) for (let i = 0; i < 4; i++) { const a = t * 1.6 + i * 1.57; star(g, Math.cos(a) * 30, -hgt * 0.5 + Math.sin(a * 1.3) * 60, 3, "#fff6c4", null, 0, 4, 0.4); }
  g.restore();
}

// ============================================================ LAVA ============================================================
export function drawLava(g, map, cam, t) {
  const ts = map.ts, c0 = Math.max(0, Math.floor(cam.x / ts)), c1 = Math.min(map.cols - 1, Math.floor((cam.x + cam.w) / ts)), r0 = Math.max(0, Math.floor(cam.y / ts)), r1 = Math.min(map.rows - 1, Math.floor((cam.y + cam.h) / ts));
  for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) {
    if (map.cells[r][c] !== "L") continue; const top = map.cells[r - 1] && map.cells[r - 1][c] === "L" ? false : true, x = c * ts, y = r * ts;
    g.fillStyle = lin(g, 0, y, 0, y + ts, [[0, "#ffb02e"], [0.45, "#ff5a1f"], [1, "#b81d12"]]); g.fillRect(x, y, ts + 0.5, ts + 0.5);
    if (top) {
      g.fillStyle = "#ffe27a"; g.beginPath(); g.moveTo(x, y + 8); for (let i = 0; i <= 6; i++) g.lineTo(x + (i * ts) / 6, y + 4 + Math.sin(t * 3 + (x + i * 8) * 0.07) * 3 + (i % 2 ? 2 : 0)); g.lineTo(x + ts, y + 14); g.lineTo(x, y + 14); g.closePath(); g.fill();
      g.fillStyle = "rgba(255,255,255,.5)"; g.fillRect(x, y + 2 + Math.sin(t * 3 + x * 0.07) * 2, ts, 2);
    }
    g.fillStyle = "rgba(255,230,140,.35)"; const bx = x + ((c * 53 + Math.floor(t * 8 + r * 5)) % ts); g.beginPath(); g.arc(bx % ts + x - (x % 1), y + ts * 0.55 + Math.sin(t * 2 + c) * 6, 3, 0, TAU); g.fill();
  }
}
