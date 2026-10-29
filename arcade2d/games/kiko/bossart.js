// Kiko Leap — the four bosses. Each one is drawn from shapes; "pose" tells the picture what the boss is doing.
import { TAU, clamp, mix, shade } from "../../core/util";
import { OUT, circle, ellipse, rr, poly, lin, glow, star, starPath } from "../../core/draw";
import { rainbow } from "./art";

function dizzyStars(g, x, y, t, n = 3, r = 22) { for (let i = 0; i < n; i++) { const a = t * 4 + (i * TAU) / n; star(g, x + Math.cos(a) * r, y + Math.sin(a) * r * 0.35, 6, "#ffe27a", OUT, 1.8, 5, 0.5); } }
const flick = (g, b, t) => { if (b.flash > 0 && Math.floor(t * 22) % 2) g.globalAlpha *= 0.35; };

// ---------------------------------------------------------------- King Mudge, the mole (feet at x,y; 72 x 64) ----------------
export function drawMudge(g, b, t) {
  const face = b.face || 1, charge = b.pose === "charge", wind = b.pose === "windup", diz = b.pose === "dizzy", sh = wind ? Math.sin(t * 70) * 2 : 0;
  g.save(); g.translate(b.x + sh, b.y); g.scale(face, 1); flick(g, b, t);
  if (charge) g.rotate(0.12), g.translate(4, 0);
  if (diz) g.rotate(-0.14), g.translate(-4, 2);
  const run = charge ? Math.sin(t * 30) * 5 : b.walk ? Math.sin(t * 8) * 3 : 0;
  ellipse(g, -20 + run, -5, 13, 6.5, "#4a2a18", OUT, 3); ellipse(g, 20 - run, -5, 13, 6.5, "#4a2a18", OUT, 3);
  if (charge) for (let i = 0; i < 6; i++) { const a = -Math.PI * 0.5 - 0.4 - i * 0.22; g.save(); g.translate(-8, -30); g.rotate(a); poly(g, [[-6, -30], [0, -50 - (i % 2) * 6], [6, -30]], "#ff6a3a", OUT, 2.6); g.restore(); }
  ellipse(g, 0, -31, 37, 31, lin(g, 0, -62, 0, 0, [[0, "#a4693f"], [1, "#5a3520"]]), OUT, 3.6);
  ellipse(g, 8, -20, 23, 18, "#e2bd96"); ellipse(g, -14, -45, 12, 6, "rgba(255,255,255,.22)", null, 0, -0.5);
  // arms with claws
  const raise = wind ? -26 : charge ? 6 : diz ? 8 : 0, ax = 24, ay = -22 + raise;
  ellipse(g, ax, ay, 12, 9, "#7a4a2a", OUT, 3);
  for (let i = -1; i <= 1; i++) poly(g, [[ax + 9, ay + i * 6 - 3], [ax + 24, ay + i * 6.5 + (raise ? -2 : 1)], [ax + 9, ay + i * 6 + 3]], "#f2ecff", OUT, 2.3);
  // nose + goggles
  circle(g, 31, -36, 9.5, "#ff8fb8", OUT, 3); ellipse(g, 28, -39, 3.4, 2.2, "rgba(255,255,255,.7)", null, 0, -0.5);
  circle(g, 12, -46, 11, "#c79a2c", OUT, 3); circle(g, 12, -46, 8.2, diz ? "#fff3c4" : charge ? "#ffd2d2" : "#d8f6ff", OUT, 2);
  if (diz) { g.strokeStyle = OUT; g.lineWidth = 2.4; g.beginPath(); g.moveTo(8, -50); g.lineTo(16, -42); g.moveTo(16, -50); g.lineTo(8, -42); g.stroke(); }
  else { circle(g, 14, -45, 3.8, charge ? "#e0102a" : OUT); circle(g, 15.2, -46.4, 1.2, "#fff"); }
  g.strokeStyle = OUT; g.lineWidth = 3.4; g.lineCap = "round"; g.beginPath(); g.moveTo(1, -58); g.lineTo(21, -52); g.stroke();
  // crown
  g.save(); g.translate(-4, -62); g.rotate(diz ? -0.3 : 0);
  poly(g, [[-15, 0], [-17, -17], [-8, -8], [-1, -20], [7, -8], [16, -17], [14, 0]], lin(g, 0, -20, 0, 0, [[0, "#fff1a0"], [1, "#e0a30f"]]), OUT, 2.8);
  circle(g, -1, -7, 3, "#ff3ea5", OUT, 1.6); circle(g, -10, -5, 2.2, "#3ee6e0", OUT, 1.4); circle(g, 9, -5, 2.2, "#3ee6e0", OUT, 1.4); g.restore();
  if (diz) { g.beginPath(); g.moveTo(22, -26); g.quadraticCurveTo(30, -18, 26, -12); g.lineWidth = 6; g.strokeStyle = OUT; g.stroke(); g.lineWidth = 3; g.strokeStyle = "#ff6a9a"; g.stroke(); }
  g.restore();
  if (diz) dizzyStars(g, b.x, b.y - 84, t);
  if (charge || wind) for (let i = 0; i < 3; i++) { circle(g, b.x - b.face * (40 + i * 16), b.y - 8 - i * 3, 5 + i * 2, "rgba(235,225,255,.4)"); }
}

// ---------------------------------------------------------------- Weavett, the spider (centre of the body at x,y) ----------------
export function drawWeavett(g, b, t) {
  const gr = b.pose === "ground", cur = gr && b.curled, wob = Math.sin(t * 9) * 2.5;
  g.save(); g.translate(b.x, b.y); flick(g, b, t);
  if (b.pose === "warn") g.translate(Math.sin(t * 80) * 1.5, 0);
  const legs = [[-1, -0.65], [-1, -0.25], [-1, 0.2], [-1, 0.6], [1, -0.65], [1, -0.25], [1, 0.2], [1, 0.6]];
  g.lineCap = "round"; g.lineJoin = "round";
  legs.forEach(([s, k], i) => {
    const ph = Math.sin(t * 10 + i * 1.3) * (b.pose === "crawl" ? 6 : 2), curl = cur ? 0.55 : 1;
    const x0 = s * 18, y0 = k * 12, kx = s * (46 * curl), ky = y0 - 30 * curl - ph, fx = s * (66 * curl), fy = y0 + (cur ? 6 : 30) + (gr ? 18 : 0) - ph * 0.5;
    for (const [w, c] of [[11, OUT], [6.5, "#5b34b0"]]) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(kx, ky); g.lineTo(fx, fy); g.lineWidth = w; g.strokeStyle = c; g.stroke(); }
  });
  ellipse(g, 0, 10 + wob * 0.3, 32, 28, lin(g, 0, -18, 0, 38, [[0, "#9a6bff"], [1, "#4a2299"]]), OUT, 3.6);
  poly(g, [[-9, -4], [9, -4], [2, 12], [9, 28], [-9, 28], [-2, 12]], "#ff3ea5", OUT, 2); ellipse(g, -14, -2, 6, 3, "rgba(255,255,255,.3)", null, 0, -0.5);
  ellipse(g, 0, -20, 20, 17, lin(g, 0, -36, 0, -4, [[0, "#7c4fe0"], [1, "#3a1c7a"]]), OUT, 3.4);
  const eyeC = b.pose === "warn" ? "#ff5a5a" : cur ? "#fff" : "#d6ff5a";
  for (const [ex, ey, er] of [[-8, -26, 6], [8, -26, 6], [-15, -19, 3.6], [15, -19, 3.6]]) { circle(g, ex, ey, er, eyeC, OUT, 2); if (!cur) circle(g, ex + (b.look || 0) * 1.4, ey + 1, er * 0.45, OUT); }
  if (cur) { g.strokeStyle = OUT; g.lineWidth = 2.2; for (const ex of [-8, 8]) { g.beginPath(); g.moveTo(ex - 3, -29); g.lineTo(ex + 3, -23); g.moveTo(ex + 3, -29); g.lineTo(ex - 3, -23); g.stroke(); } }
  poly(g, [[-8, -10], [-5, 2], [-2, -9]], "#fff", OUT, 2); poly(g, [[8, -10], [5, 2], [2, -9]], "#fff", OUT, 2);
  g.restore();
  if (cur) dizzyStars(g, b.x, b.y - 52, t);
}

// ---------------------------------------------------------------- Queen Nimbra, the storm queen (centre at x,y) ----------------
export function drawNimbra(g, b, t) {
  const stun = b.pose === "stunned", zap = b.pose === "bolts" || b.pose === "rear", f = Math.sin(t * 3) * 3;
  g.save(); g.translate(b.x, b.y + (stun ? 0 : f)); flick(g, b, t);
  if (zap) g.translate(Math.sin(t * 70) * 1.8, 0);
  // rain cape
  for (let i = 0; i < 7; i++) { const x = -36 + i * 12, len = 26 + ((i * 37) % 17) + Math.sin(t * 8 + i) * 4; g.strokeStyle = "rgba(160,205,255,.7)"; g.lineWidth = 4; g.lineCap = "round"; g.beginPath(); g.moveTo(x, 22); g.lineTo(x - 3, 22 + len); g.stroke(); }
  const blobs = [[0, -2, 30], [-32, 6, 21], [32, 6, 21], [-18, -20, 20], [18, -20, 20], [-48, 14, 13], [48, 14, 13], [0, 14, 24]];
  const col = zap ? mix("#6a4fb0", "#ffe27a", 0.35 + 0.25 * Math.sin(t * 50)) : "#6a4fb0";
  g.fillStyle = OUT; for (const [bx, by, br] of blobs) { g.beginPath(); g.arc(bx, by, br + 3.4, 0, TAU); g.fill(); }
  g.fillStyle = lin(g, 0, -40, 0, 36, [[0, shade(col, 0.12)], [1, shade(col, -0.3)]]); for (const [bx, by, br] of blobs) { g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill(); }
  g.fillStyle = "rgba(255,255,255,.16)"; g.beginPath(); g.arc(-14, -26, 13, 0, TAU); g.fill();
  // crown of lightning
  g.save(); g.translate(0, -44);
  poly(g, [[-26, 6], [-24, -16], [-13, -2], [-6, -24], [2, -6], [11, -26], [18, -4], [27, -16], [26, 6]], lin(g, 0, -26, 0, 6, [[0, "#fff6a8"], [1, "#e6a80f"]]), OUT, 3); circle(g, 1, -2, 3.4, "#ff3ea5", OUT, 1.8); g.restore();
  for (const ex of [-13, 13]) {
    if (stun) { g.strokeStyle = OUT; g.lineWidth = 3; g.lineCap = "round"; g.beginPath(); g.moveTo(ex - 5, -8); g.lineTo(ex + 5, 2); g.moveTo(ex + 5, -8); g.lineTo(ex - 5, 2); g.stroke(); }
    else { ellipse(g, ex, -3, 7, 8.4, zap ? "#fff7b0" : "#ffe27a", OUT, 2.4); circle(g, ex + (b.look || 0) * 1.5, -2, 3.2, OUT); }
  }
  g.strokeStyle = OUT; g.lineWidth = 3.4; g.lineCap = "round"; g.beginPath(); g.moveTo(-23, -14); g.lineTo(-7, -9); g.moveTo(23, -14); g.lineTo(7, -9); g.stroke();
  ellipse(g, 0, 15, 8, stun ? 4 : 5.5, "#7a1a4a", OUT, 2.4); poly(g, [[-5, 11], [-2.5, 15], [0, 11]], "#fff", null); poly(g, [[0, 11], [2.5, 15], [5, 11]], "#fff", null);
  if (zap) glow(g, 0, 0, 90, "#ffe27a", 0.25);
  g.restore();
  if (stun) dizzyStars(g, b.x, b.y - 62, t);
}

// ---------------------------------------------------------------- Ignar, the magma golem (feet at x,y; about 96 x 112) ----------------
export function drawIgnar(g, b, t) {
  const pose = b.pose || "idle", face = b.face || 1, wk = pose === "walk" ? Math.sin(t * 7) : 0, kneel = pose === "kneel", wind = pose === "windup", slam = pose === "slam";
  g.save(); g.translate(b.x, b.y); g.scale(face, 1); flick(g, b, t);
  if (wind) g.translate(Math.sin(t * 60) * 1.4, 0);
  const ROCK = lin(g, 0, -110, 0, 0, [[0, "#6a4a52"], [1, "#2e1a22"]]), LAVA = "#ff8a2a", dy = kneel ? 26 : 0;
  glow(g, 0, -55 + dy, 110, "#ff6a2a", 0.22 + 0.08 * Math.sin(t * 6));
  // legs
  for (const [lx, ph] of [[-20, wk], [20, -wk]]) { g.save(); g.translate(lx, -(Math.max(0, ph) * 6)); rr(g, -15, -42, 30, kneel ? 24 : 42, 8); g.fillStyle = ROCK; g.fill(); g.lineWidth = 3.6; g.lineJoin = "round"; g.strokeStyle = OUT; g.stroke(); g.strokeStyle = LAVA; g.lineWidth = 2.2; g.beginPath(); g.moveTo(-6, -36); g.lineTo(2, -24); g.lineTo(-4, -14); g.stroke(); g.restore(); }
  // torso
  g.save(); g.translate(0, dy);
  rr(g, -42, -98, 84, 68, 16); g.fillStyle = ROCK; g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
  g.strokeStyle = LAVA; g.lineWidth = 2.6; g.lineCap = "round"; g.beginPath(); g.moveTo(-30, -88); g.lineTo(-20, -70); g.lineTo(-30, -56); g.moveTo(30, -90); g.lineTo(22, -72); g.lineTo(32, -52); g.stroke();
  circle(g, 0, -62, 15, lin(g, 0, -77, 0, -47, [[0, "#fff1a0"], [1, "#ff6a1f"]]), OUT, 3); glow(g, 0, -62, 40, "#ffb02e", 0.55 + 0.25 * Math.sin(t * 8));
  for (const s of [-1, 1]) poly(g, [[s * 34, -98], [s * 44, -122], [s * 24, -98]], "#4a3038", OUT, 2.6);
  // head
  g.save(); g.translate(8 + (wind ? 4 : 0), -108 + (kneel ? 8 : 0));
  rr(g, -22, -24, 44, 38, 11); g.fillStyle = lin(g, 0, -24, 0, 14, [[0, "#7a5660"], [1, "#3a222a"]]); g.fill(); g.lineWidth = 3.6; g.strokeStyle = OUT; g.stroke();
  poly(g, [[-18, -22], [-28, -42], [-8, -24]], "#e8d9c4", OUT, 2.6); poly(g, [[18, -22], [28, -42], [8, -24]], "#e8d9c4", OUT, 2.6);
  const ec = pose === "kneel" ? "#ffe9b0" : "#ffb02e";
  for (const ex of [-9, 10]) { ellipse(g, ex, -8, 6, 5, ec, OUT, 2.2); circle(g, ex + 1, -8, 2.2, OUT); }
  g.strokeStyle = OUT; g.lineWidth = 3.4; g.beginPath(); g.moveTo(-17, -17); g.lineTo(-3, -12); g.moveTo(19, -17); g.lineTo(5, -12); g.stroke();
  g.lineWidth = 4; g.strokeStyle = LAVA; g.beginPath(); g.moveTo(-12, 5); g.lineTo(-4, 8); g.lineTo(4, 4); g.lineTo(12, 8); g.stroke();
  g.restore(); g.restore();
  // arms / fists
  const fistY = wind ? -130 : slam ? -6 : kneel ? -4 : -38 + wk * 6, fx = wind ? 40 : slam ? 44 : kneel ? 52 : 52;
  for (const s of [-1, 1]) {
    const x = s * fx * (kneel ? 1.05 : 1), y = fistY + (kneel ? 0 : 0);
    g.beginPath(); g.moveTo(s * 36, -88 + dy); g.lineTo(x, y - 20); g.lineWidth = 26; g.lineCap = "round"; g.strokeStyle = OUT; g.stroke(); g.lineWidth = 19; g.strokeStyle = "#5a3a44"; g.stroke();
    rr(g, x - 20, y - 22, 40, 36, 12); g.fillStyle = lin(g, 0, y - 22, 0, y + 14, [[0, "#7a5660"], [1, "#3a222a"]]); g.fill(); g.lineWidth = 3.6; g.strokeStyle = OUT; g.stroke();
    g.strokeStyle = LAVA; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x - 8, y - 14); g.lineTo(x, y - 2); g.lineTo(x - 5, y + 8); g.stroke();
    if (wind) glow(g, x, y, 34, "#ffb02e", 0.5);
  }
  g.restore();
  if (kneel) dizzyStars(g, b.x + b.face * 8, b.y - 82, t, 3, 30);
}

// ---------------------------------------------------------------- shared projectiles ----------------
export function drawRock(g, x, y, r, rot) { g.save(); g.translate(x, y); g.rotate(rot); poly(g, [[-r, -r * 0.3], [-r * 0.4, -r], [r * 0.7, -r * 0.8], [r, r * 0.2], [r * 0.3, r], [-r * 0.8, r * 0.8]], lin(g, 0, -r, 0, r, [[0, "#b79a78"], [1, "#6a5240"]]), OUT, 3); g.fillStyle = "rgba(255,255,255,.22)"; g.fillRect(-r * 0.4, -r * 0.7, r * 0.5, 3); g.restore(); }
export function drawLavaBall(g, x, y, r, t) { glow(g, x, y, r * 3, "#ff7a2a", 0.5); circle(g, x, y, r, lin(g, 0, y - r, 0, y + r, [[0, "#fff1a0"], [0.5, "#ff9a2a"], [1, "#e0301c"]]), OUT, 3); circle(g, x - r * 0.3, y - r * 0.3, r * 0.3, "rgba(255,255,255,.7)"); }
export function drawWebBall(g, x, y, r, t) { g.save(); g.translate(x, y); g.rotate(t * 6); circle(g, 0, 0, r, "#f3eeff", OUT, 2.8); g.strokeStyle = "rgba(120,100,180,.8)"; g.lineWidth = 1.6; g.beginPath(); for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2 + Math.PI / 4; g.moveTo(0, 0); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.stroke(); circle(g, 0, 0, r * 0.5, null, "rgba(120,100,180,.8)", 1.6); g.restore(); }
export function drawSeedShot(g, x, y, r, t) { g.save(); g.translate(x, y); g.rotate(t * 10); circle(g, 0, 0, r, lin(g, 0, -r, 0, r, [[0, "#ff9ad0"], [1, "#c11f77"]]), OUT, 2.8); circle(g, -r * 0.3, -r * 0.3, r * 0.28, "rgba(255,255,255,.7)"); g.restore(); }
export function drawShockwave(g, x, y, dir, t) { g.save(); g.translate(x, y); g.scale(dir, 1); poly(g, [[-20, 0], [-6, -26], [10, -34], [24, -10], [26, 0]], lin(g, 0, -34, 0, 0, [[0, "#ffe27a"], [1, "#ff6a1f"]]), OUT, 3); glow(g, 0, -14, 38, "#ff8a2a", 0.4); g.restore(); }

export function drawSpiderling(g, e, t) {
  const d = e.dead || 0, sy = d ? Math.max(0.15, 1 - d * 0.85) : 1, w = Math.sin(t * 20 + (e.ph || 0));
  g.save(); g.translate(e.x, e.y); g.scale((e.face || 1) * (1 + d * 0.4), sy); g.lineCap = "round";
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { const k = i - 1, sw = w * (i % 2 ? 1 : -1) * 2; for (const [lw, c] of [[5.5, OUT], [3, "#5b34b0"]]) { g.beginPath(); g.moveTo(s * 4, -9 + k * 2); g.lineTo(s * 12, -15 + k * 3 + sw); g.lineTo(s * 17, -1 + sw * 0.5); g.lineWidth = lw; g.strokeStyle = c; g.stroke(); } }
  ellipse(g, -3, -10, 11, 8.5, lin(g, 0, -18, 0, -2, [[0, "#9a6bff"], [1, "#4a2299"]]), OUT, 2.4);
  ellipse(g, 8, -10, 7, 6, "#7c4fe0", OUT, 2.4);
  for (const ey of [-12.5, -9]) { circle(g, 10.5, ey, 2.3, "#d6ff5a", OUT, 1.4); }
  g.restore();
}
