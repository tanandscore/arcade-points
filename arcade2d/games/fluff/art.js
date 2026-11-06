// Fluffapult — all the pictures, drawn with canvas shapes: blocks of every material, Fluffs, Sprockets, the slingshot, the ground.
import { TAU, clamp, lerp, mix, shade, rgba, rng } from "../../core/util";
import { circle, ellipse, fillRR, rr, poly, line, capsule, lin, rad, glow, gloss, shadowBlob, text, cached, stamp, makeCanvas, OUT, FONT_DISPLAY, FONT_PIXEL } from "../../core/draw";
import { MATS, BIRDS, FOES } from "./defs";

// ---------------------------------------------------------------------------------------------------------------- blocks
function grain(g, w, h, M, r) {
  const horiz = w >= h; g.save(); g.lineCap = "round";
  const n = Math.max(2, Math.round((horiz ? h : w) / 8));
  for (let i = 0; i < n; i++) {
    g.strokeStyle = rgba(M.edge, 0.22); g.lineWidth = 1.2; g.beginPath();
    if (horiz) { const y = 4 + ((h - 8) * (i + 0.5)) / n; let x = 5; g.moveTo(x, y); while (x < w - 6) { x += 7 + r() * 9; g.lineTo(Math.min(w - 5, x), y + (r() - 0.5) * 1.6); } }
    else { const x = 4 + ((w - 8) * (i + 0.5)) / n; let y = 5; g.moveTo(x, y); while (y < h - 6) { y += 7 + r() * 9; g.lineTo(x + (r() - 0.5) * 1.6, Math.min(h - 5, y)); } }
    g.stroke();
  }
  g.restore();
}
function paintBlock(g, mat, w, h, look) {
  const M = MATS[mat], r = rng(w * 31 + h * 17 + mat.length), pad = 1.5, ww = w - pad * 2, hh = h - pad * 2, rad_ = Math.min(5, Math.min(w, h) / 4);
  const alpha = mat === "glass" ? 0.5 : mat === "ice" ? 0.9 : 1;
  g.save(); g.globalAlpha = alpha;
  const vert = lin(g, 0, 0, 0, h, [[0, M.top], [0.5, M.mid], [1, M.low]]);
  fillRR(g, pad, pad, ww, hh, rad_, vert, null);
  g.globalAlpha = 1;
  g.save(); rr(g, pad, pad, ww, hh, rad_); g.clip();
  if (mat === "wood") {
    grain(g, w, h, M, r);
    if (Math.min(w, h) >= 36) { ellipse(g, w * (0.3 + r() * 0.4), h * (0.35 + r() * 0.3), 4.5, 3, rgba(M.edge, 0.3)); ellipse(g, w * 0.5, h * 0.5, 2.2, 1.5, rgba(M.edge, 0.35)); }
    g.fillStyle = rgba(M.edge, 0.5); const long = w >= h;
    for (const s of [0.18, 0.82]) { if (long && w >= 56) { circle(g, w * s, h / 2, 1.8, rgba(M.edge, 0.55)); } else if (!long && h >= 56) { circle(g, w / 2, h * s, 1.8, rgba(M.edge, 0.55)); } }
    if (Math.min(w, h) >= 36) { for (const [x, y] of [[7, 7], [w - 7, 7], [7, h - 7], [w - 7, h - 7]]) circle(g, x, y, 1.8, rgba(M.edge, 0.55)); }
  } else if (mat === "stone") {
    g.strokeStyle = rgba(M.edge, 0.3); g.lineWidth = 1.4;
    if (w >= 36 && h >= 36) { g.beginPath(); g.moveTo(w * 0.1, h * 0.5); g.lineTo(w * 0.9, h * 0.5); g.moveTo(w * 0.5, h * 0.5); g.lineTo(w * 0.5, h * 0.92); g.moveTo(w * 0.28, h * 0.08); g.lineTo(w * 0.28, h * 0.5); g.stroke(); }
    else if (w >= h * 1.8) { g.beginPath(); for (let x = w / 3; x < w - 6; x += w / 3) { g.moveTo(x, 3); g.lineTo(x, h - 3); } g.stroke(); }
    for (let i = 0; i < Math.round(w * h / 160); i++) circle(g, 4 + r() * (w - 8), 4 + r() * (h - 8), 0.9 + r() * 0.8, rgba(i % 2 ? "#ffffff" : M.edge, 0.2));
  } else if (mat === "ice") {
    g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = 3; g.lineCap = "round";
    for (const k of [0.25, 0.55]) { const x = (w + h) * k; g.beginPath(); g.moveTo(x, 2); g.lineTo(x - h * 0.7, h - 2); g.stroke(); }
    g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 1.4; g.beginPath(); g.moveTo(w * 0.1, h * 0.8); g.lineTo(w * 0.3, h * 0.6); g.stroke();
    for (let i = 0; i < Math.round(w * h / 400); i++) circle(g, 5 + r() * (w - 10), 5 + r() * (h - 10), 1 + r(), "rgba(255,255,255,.55)");
  } else if (mat === "glass") {
    g.strokeStyle = "rgba(255,255,255,.95)"; g.lineWidth = 2.6; g.lineCap = "round";
    g.beginPath(); g.moveTo(w * 0.15, h * 0.28); g.lineTo(w * 0.15, h * 0.62); g.moveTo(w * 0.28, h * 0.14); g.lineTo(w * 0.62, h * 0.14); g.stroke();
    g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(w * 0.4, h * 0.9); g.lineTo(w * 0.7, h * 0.55); g.stroke();
  } else if (mat === "tnt") {
    g.fillStyle = rgba(M.edge, 0.55); g.fillRect(0, h * 0.22, w, h * 0.12); g.fillRect(0, h * 0.66, w, h * 0.12);
    g.fillStyle = "#fff5d0"; g.fillRect(w * 0.12, h * 0.34, w * 0.76, h * 0.32);
    text(g, "TNT", w / 2, h * 0.6, { size: Math.max(8, h * 0.28), color: "#c8261f", align: "center", weight: 900, font: FONT_DISPLAY });
  }
  // light from the top-left, shade at the bottom
  const sh = lin(g, 0, 0, 0, h, [[0, "rgba(255,255,255,.34)"], [0.18, "rgba(255,255,255,0)"], [0.75, "rgba(0,0,0,0)"], [1, "rgba(0,0,0,.22)"]]); g.fillStyle = sh; g.fillRect(0, 0, w, h);
  g.restore();
  rr(g, pad, pad, ww, hh, rad_); g.lineWidth = 2; g.lineJoin = "round"; g.strokeStyle = mat === "glass" ? rgba(M.edge, 0.8) : M.edge; g.stroke();
  g.restore();
  if (mat === "tnt") { /* fuse */ g.strokeStyle = "#2a1a10"; g.lineWidth = 2; g.beginPath(); g.moveTo(w * 0.62, 2); g.quadraticCurveTo(w * 0.7, -3, w * 0.78, -1); g.stroke(); }
}
export function blockSprite(mat, w, h, look) { return cached(`blk:${mat}:${w}x${h}`, w + 6, h + 8, (g) => { g.translate(3, 4); paintBlock(g, mat, w, h, look); }, 2); }

// crack lines for damaged blocks (made once per block)
export function makeCracks(w, h, seed) {
  const r = rng(seed * 7919 + 13), out = [], n = 5;
  for (let i = 0; i < n; i++) {
    let x = (r() - 0.5) * w * 0.8, y = (r() - 0.5) * h * 0.8; const pts = [[x, y]], ang = r() * TAU, len = Math.max(w, h) * (0.25 + r() * 0.3), steps = 4;
    for (let s = 0; s < steps; s++) { const a = ang + (r() - 0.5) * 1.3; x += Math.cos(a) * len / steps; y += Math.sin(a) * len / steps; x = clamp(x, -w / 2 + 2, w / 2 - 2); y = clamp(y, -h / 2 + 2, h / 2 - 2); pts.push([x, y]); }
    out.push(pts);
  }
  return out;
}
export function drawBlock(g, b, u) {
  const sp = blockSprite(u.mat, u.w, u.h);
  g.save(); g.translate(b.x, b.y); g.rotate(b.rot); g.drawImage(sp, -u.w / 2 - 3, -u.h / 2 - 4, sp.width / sp._s, sp.height / sp._s);
  const f = u.hp / u.max;
  if (f < 0.72) {
    if (!u.cracks) u.cracks = makeCracks(u.w, u.h, u.seed || 1);
    const n = f < 0.36 ? 5 : f < 0.55 ? 3 : 2; g.lineCap = "round"; g.lineJoin = "round";
    for (let i = 0; i < n; i++) { const c = u.cracks[i]; g.beginPath(); c.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.strokeStyle = u.mat === "ice" || u.mat === "glass" ? "rgba(255,255,255,.9)" : "rgba(30,15,10,.6)"; g.lineWidth = 1.8; g.stroke(); if (u.mat === "ice" || u.mat === "glass") { g.strokeStyle = MATS[u.mat].edge; g.lineWidth = 0.7; g.stroke(); } }
  }
  if (u.flash > 0) { g.globalAlpha = Math.min(0.55, u.flash * 2.6); g.fillStyle = "#fff"; rr(g, -u.w / 2, -u.h / 2, u.w, u.h, 4); g.fill(); }
  g.restore();
}
export function drawRock(g, b, u) {
  const r = u.r;
  g.save(); g.translate(b.x, b.y); g.rotate(b.rot);
  circle(g, 0, 0, r, rad(g, -r * 0.3, -r * 0.4, 1, r * 1.1, [[0, "#d3d7ea"], [0.6, "#9aa1c2"], [1, "#6e7699"]]), "#2e2f55", 2.4);
  g.strokeStyle = "rgba(46,47,85,.38)"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-r * 0.5, -r * 0.1); g.lineTo(-r * 0.05, r * 0.15); g.lineTo(r * 0.3, -r * 0.3); g.moveTo(r * 0.05, r * 0.15); g.lineTo(0, r * 0.7); g.stroke();
  circle(g, r * 0.35, r * 0.32, r * 0.1, "rgba(46,47,85,.3)"); circle(g, -r * 0.4, r * 0.45, r * 0.07, "rgba(46,47,85,.3)");
  const f = u.hp / u.max; if (f < 0.6) { g.strokeStyle = "rgba(20,10,30,.6)"; g.lineWidth = 2; g.beginPath(); g.moveTo(-r * 0.7, -r * 0.4); g.lineTo(-r * 0.1, -r * 0.1); g.lineTo(r * 0.5, -r * 0.6); g.stroke(); }
  if (u.flash > 0) { g.globalAlpha = Math.min(0.55, u.flash * 2.6); circle(g, 0, 0, r, "#fff"); }
  g.restore();
}

// ---------------------------------------------------------------------------------------------------------------- Fluffs
const TUFTS = 16;
function furBody(g, r, color, dark, belly) {
  // outline pass (a little bigger), then fill, so the fuzzy edge has one clean dark outline
  for (const pass of [0, 1]) {
    const grow = pass === 0 ? 2.2 : 0, col = pass === 0 ? OUT : color;
    g.fillStyle = col; g.beginPath(); g.arc(0, 0, r * 0.9 + grow, 0, TAU); g.fill();
    for (let i = 0; i < TUFTS; i++) { const a = (i / TUFTS) * TAU + 0.1, k = i % 2 ? 0.98 : 1.06; g.beginPath(); g.arc(Math.cos(a) * r * 0.84 * k, Math.sin(a) * r * 0.84 * k, r * 0.27 + grow, 0, TAU); g.fill(); }
  }
  circle(g, 0, 0, r * 0.88, rad(g, -r * 0.3, -r * 0.4, 1, r * 1.1, [[0, shade(color, 0.28)], [0.55, color], [1, dark]]));
  // soft belly patch + glossy highlight
  ellipse(g, r * 0.05, r * 0.42, r * 0.52, r * 0.34, rgba(belly, 0.5));
  ellipse(g, -r * 0.35, -r * 0.5, r * 0.3, r * 0.17, "rgba(255,255,255,.55)", null, 0, -0.6);
}
function eyes(g, r, look = 0.25, blink = false, mood = 0) {
  const ex = r * 0.3, ey = -r * 0.1, er = r * 0.3;
  for (const s of [-1, 1]) {
    const x = ex * s + r * 0.1;
    if (blink) { g.strokeStyle = OUT; g.lineWidth = 2.2; g.lineCap = "round"; g.beginPath(); g.moveTo(x - er * 0.8, ey + 1); g.lineTo(x + er * 0.8, ey + 1); g.stroke(); continue; }
    ellipse(g, x, ey, er, er * 1.08, "#fff", OUT, 1.8);
    circle(g, x + er * look, ey + er * 0.1, er * 0.52, OUT); circle(g, x + er * look + er * 0.18, ey - er * 0.15, er * 0.17, "#fff");
    // brows: angry-cute (slope down toward the middle)
    g.strokeStyle = OUT; g.lineWidth = 2.6; g.lineCap = "round"; g.beginPath();
    g.moveTo(x + s * er * 1.05, ey - er * (1.55 + 0.25 * mood)); g.lineTo(x - s * er * 0.95, ey - er * (0.95 - 0.2 * mood)); g.stroke();
  }
}
function paintBird(g, type, blink, r0) {
  const B = BIRDS[type], r = r0 ?? B.r;
  furBody(g, r, B.color, B.dark, B.belly);
  if (type === "zip") { poly(g, [[-r * 0.1, -r * 0.8], [r * 0.18, -r * 0.5], [0, -r * 0.45], [r * 0.22, -r * 0.1], [-r * 0.2, -r * 0.42], [0, -r * 0.48]].map(([x, y]) => [x - r * 0.35, y + r * 0.05]), "#fff", OUT, 1.2); }
  if (type === "boomer") { capsule(g, 0, -r * 0.85, r * 0.12, -r * 1.3, 3, "#4a3220", OUT, 1.1); circle(g, r * 0.14, -r * 1.35, r * 0.18, "#fff2a0", "#ff7a2d", 1.5); }
  if (type === "trio") { for (const s of [-1, 0, 1]) { capsule(g, s * r * 0.3, -r * 0.8, s * r * 0.45, -r * 1.25, r * 0.28, B.color, OUT, 1.4); } }
  if (type === "dropper") { poly(g, [[r * 0.15, r * 0.02], [r * 0.7, r * 0.2], [r * 0.15, r * 0.4]], "#ff9a2d", OUT, 1.6); for (const s of [0, 1, 2]) { capsule(g, -r * 0.8, r * 0.05 + s * r * 0.2, -r * 1.3, r * (-0.1 + s * 0.3), r * 0.2, "#fff0b0", OUT, 1.2); } }
  if (type === "boulder") { for (const [x, y, s] of [[-0.45, -0.5, 0.2], [0.5, 0.35, 0.16], [-0.1, 0.62, 0.13]]) circle(g, x * r, y * r, s * r, "#4d8b52"); poly(g, [[-r * 0.2, -r * 0.88], [0, -r * 1.25], [r * 0.2, -r * 0.88]], "#c8c3a8", OUT, 1.6); }
  eyes(g, r, 0.28, blink, type === "boulder" ? 1 : 0);
  if (type !== "dropper") { g.strokeStyle = OUT; g.lineWidth = 2; g.lineCap = "round"; g.beginPath(); g.arc(r * 0.18, r * 0.3, r * 0.14, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }
  // little feet
  for (const s of [-1, 1]) ellipse(g, s * r * 0.35 + r * 0.05, r * 0.92, r * 0.2, r * 0.11, shade(B.color, -0.25), OUT, 1.4);
}
export function birdSprite(type, blink = false) { const r = BIRDS[type].r; return cached(`bird:${type}:${blink ? 1 : 0}`, r * 3.6, r * 3.6, (g, w, h) => { g.translate(w / 2, h / 2 + r * 0.1); paintBird(g, type, blink); }, 3); }
export function drawBird(g, type, x, y, rot = 0, o = {}) {
  const sp = birdSprite(type, !!o.blink), sc = o.scale || 1, w = sp.width / sp._s, h = sp.height / sp._s;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(sc * (o.sx || 1), sc * (o.sy || 1)); g.drawImage(sp, -w / 2, -h / 2 - BIRDS[type].r * 0.1, w, h); g.restore();
}
export function drawEgg(g, x, y, rot) {
  g.save(); g.translate(x, y); g.rotate(rot);
  ellipse(g, 0, 0, 8, 10.5, rad(g, -2, -4, 1, 12, [[0, "#ffffff"], [1, "#ffe9a8"]]), OUT, 2);
  circle(g, 0, -10.5, 2.6, "#ff5e5e", OUT, 1.2); g.restore();
}

// ---------------------------------------------------------------------------------------------------------------- Sprockets
function gearPath(g, r, teeth, depth) {
  g.beginPath();
  for (let i = 0; i < teeth * 2; i++) { const a = (i / (teeth * 2)) * TAU, rr_ = i % 2 ? r : r + depth, a2 = a + (TAU / (teeth * 2)) * 0.5; g.lineTo(Math.cos(a) * rr_, Math.sin(a) * rr_); g.lineTo(Math.cos(a2) * rr_, Math.sin(a2) * rr_); }
  g.closePath();
}
export function drawFoe(g, b, u, t, aim) {
  const D = FOES[u.kind], r = D.r, f = u.hp / u.max, wob = Math.sin(t * 3 + u.seed) * 0.04;
  g.save(); g.translate(b.x, b.y); g.rotate(b.rot + wob * (1 - u.hurtT));
  // wind-up key on the back
  g.save(); g.rotate(-0.9); g.translate(-r - 3, 0); g.rotate(t * (u.dead ? 0 : 1.8 + u.seed % 1)); capsule(g, 0, -7, 0, 7, 3, "#e6b24a", OUT, 1.3); circle(g, 0, -8, 3.4, "#e6b24a", OUT, 1.3); circle(g, 0, 8, 3.4, "#e6b24a", OUT, 1.3); g.restore();
  // body: a brass gear with a friendly face plate
  const teeth = u.kind === "king" ? 12 : 9, depth = r * 0.17;
  g.fillStyle = OUT; gearPath(g, r * 0.95 + 1.8, teeth, depth); g.fill();
  const bg = rad(g, -r * 0.3, -r * 0.4, 1, r * 1.3, [[0, "#ffe9a8"], [0.5, "#e6b24a"], [1, "#a8701f"]]);
  g.fillStyle = bg; gearPath(g, r * 0.95, teeth, depth); g.fill();
  circle(g, 0, 0, r * 0.78, rad(g, -r * 0.2, -r * 0.3, 1, r * 0.9, [[0, "#fff6d6"], [1, "#f0d08a"]]), "#a8701f", 1.8);
  // damage: dents
  if (f < 0.66) { g.strokeStyle = "rgba(60,30,10,.55)"; g.lineWidth = 1.8; g.lineCap = "round"; g.beginPath(); g.moveTo(r * 0.3, -r * 0.75); g.lineTo(r * 0.1, -r * 0.4); g.lineTo(r * 0.35, -r * 0.2); g.stroke(); }
  if (f < 0.33) { g.beginPath(); g.moveTo(-r * 0.7, r * 0.2); g.lineTo(-r * 0.4, r * 0.35); g.lineTo(-r * 0.55, r * 0.6); g.stroke(); }
  // eyes look toward the aim point; squint when hurt, swirl when nearly broken
  const lx = clamp((aim ? aim.x - b.x : 80) / 140, -1, 1) * 0.3, ly = clamp((aim ? aim.y - b.y : 0) / 140, -1, 1) * 0.25, er = r * 0.27, ey = -r * 0.1;
  for (const s of [-1, 1]) {
    const x = s * r * 0.33;
    if (f < 0.33) { ellipse(g, x, ey, er, er, "#fff", OUT, 1.6); g.strokeStyle = OUT; g.lineWidth = 1.6; g.beginPath(); for (let i = 0; i < 14; i++) { const a = i * 0.9 + t * 6 * s, rr_ = er * 0.12 + i * er * 0.05; g.lineTo(x + Math.cos(a) * rr_, ey + Math.sin(a) * rr_); } g.stroke(); }
    else {
      const squint = f < 0.66 ? 0.55 : 1, blink = (Math.sin(t * 1.3 + u.seed * 3) > 0.985) ? 0.12 : 1;
      g.save(); g.translate(x, ey); g.scale(1, squint * blink); circle(g, 0, 0, er, "#fff", OUT, 1.6); circle(g, lx * er, ly * er, er * 0.5, OUT); circle(g, lx * er + er * 0.18, ly * er - er * 0.2, er * 0.16, "#fff"); g.restore();
    }
  }
  // nose bolt + little smile (or an "o" when hurt)
  circle(g, 0, r * 0.12, r * 0.1, "#a8701f", OUT, 1.2);
  g.strokeStyle = OUT; g.lineWidth = 1.9; g.lineCap = "round"; g.beginPath();
  if (f < 0.66) g.ellipse(0, r * 0.46, r * 0.1, r * 0.12, 0, 0, TAU); else g.arc(0, r * 0.28, r * 0.24, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
  // hats
  if (D.hat === "hard") { g.beginPath(); g.arc(0, -r * 0.62, r * 0.62, Math.PI, 0); g.closePath(); g.fillStyle = "#ffcf3a"; g.fill(); g.lineWidth = 1.8; g.strokeStyle = OUT; g.stroke(); rr(g, -r * 0.78, -r * 0.66, r * 1.56, r * 0.14, 3); g.fillStyle = "#ffb703"; g.fill(); g.stroke(); circle(g, 0, -r * 0.95, r * 0.14, "#fff6c4", OUT, 1.2); }
  if (D.hat === "crown") { poly(g, [[-r * 0.6, -r * 0.64], [-r * 0.62, -r * 1.12], [-r * 0.3, -r * 0.88], [0, -r * 1.22], [r * 0.3, -r * 0.88], [r * 0.62, -r * 1.12], [r * 0.6, -r * 0.64]], "#ffd23a", OUT, 2); circle(g, 0, -r * 0.82, r * 0.1, "#ff3ea5", OUT, 1.2); circle(g, -r * 0.34, -r * 0.76, r * 0.07, "#3ee6e0", OUT, 1); circle(g, r * 0.34, -r * 0.76, r * 0.07, "#3ee6e0", OUT, 1); }
  if (u.hurtT > 0) { g.globalAlpha = Math.min(0.6, u.hurtT * 2); g.fillStyle = "#fff"; gearPath(g, r * 0.95, teeth, depth); g.fill(); }
  g.restore();
}

// ---------------------------------------------------------------------------------------------------------------- slingshot
export function drawSlingBack(g, sx, gy, ay, tipL, tipR, pouch, pull, t) { // the back prong and back rubber band
  g.save();
  capsule(g, sx + 14, gy - 4, sx + 12, ay + 24, 15, "#7a4a1e", OUT, 2.2); // base stem
  capsule(g, sx + 12, ay + 28, tipR.x + 2, tipR.y, 11, "#8a5526", OUT, 2);
  if (pouch) { g.strokeStyle = "#3b1d10"; g.lineWidth = 6; g.lineCap = "round"; g.beginPath(); g.moveTo(tipR.x + 1, tipR.y - 2); g.lineTo(pouch.x + 3, pouch.y + 2); g.stroke(); g.strokeStyle = "#7a2d1d"; g.lineWidth = 3; g.stroke(); }
  g.restore();
}
export function drawSlingFront(g, sx, gy, ay, tipL, tipR, pouch, pull, t) {
  g.save();
  capsule(g, sx + 12, ay + 28, tipL.x, tipL.y, 12, "#a8672e", OUT, 2.2);
  circle(g, tipL.x, tipL.y, 6.4, "#cf8d4c", OUT, 2); circle(g, tipR.x, tipR.y, 5.6, "#a8672e", OUT, 2);
  if (pouch) {
    g.strokeStyle = "#3b1d10"; g.lineWidth = 6.5; g.lineCap = "round"; g.beginPath(); g.moveTo(tipL.x, tipL.y - 1); g.lineTo(pouch.x - 3, pouch.y + 1); g.stroke(); g.strokeStyle = "#a63b24"; g.lineWidth = 3.2; g.stroke();
  }
  g.restore();
}
export function drawPouch(g, p, r, ang) {
  g.save(); g.translate(p.x, p.y); g.rotate(ang);
  g.beginPath(); g.ellipse(-r * 0.55, 0, r * 0.7, r * 1.25, 0, 0, TAU); g.fillStyle = "#6b2d1c"; g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke();
  g.restore();
}

// ---------------------------------------------------------------------------------------------------------------- ground
export const LOOKS = {
  meadow: { top: "#69dc62", top2: "#3fb55a", soil: "#9a6a43", soil2: "#6e4527", line: "#1f5a30", rockEdge: "#3f2a1a", stone: "#a9a3b8" },
  snow: { top: "#ffffff", top2: "#cfe6ff", soil: "#7b94bd", soil2: "#566e96", line: "#7aa6d8", rockEdge: "#2e3f66", stone: "#b6c4e0" },
  desert: { top: "#f6d28a", top2: "#e0a85a", soil: "#c7814a", soil2: "#8f5530", line: "#8a4f22", rockEdge: "#4f2a14", stone: "#c9a37a" },
  factory: { top: "#9aa6d6", top2: "#6c78a8", soil: "#3b4272", soil2: "#262a52", line: "#1a1c3e", rockEdge: "#12142f", stone: "#59628f" },
};
export function drawTerrainBox(g, t, look, vx0 = -1e9, vx1 = 1e9) { // a rectangle of land (cliff, ground segment or ramp) seen from the side
  const L = LOOKS[look] || LOOKS.meadow;
  g.save(); g.translate(t.x, t.y); g.rotate(t.rot || 0);
  const w = t.w, h = t.h, x0 = -w / 2, y0 = -h / 2;
  const body = lin(g, 0, y0, 0, y0 + Math.max(h, 40), [[0, L.soil], [1, L.soil2]]);
  g.fillStyle = body; g.fillRect(x0, y0 + 10, w, h - 10);
  // rocks and speckles in the soil (only the part of the land that is on screen)
  if (!t.rot) {
    g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
    const a = Math.max(x0, vx0 - t.x - 60), b = Math.min(x0 + w, vx1 - t.x + 60);
    for (let cx = Math.floor(a / 70) * 70; cx < b; cx += 70) {
      const r = rng(Math.round((cx + t.x) * 3.1) + 77);
      for (let i = 0; i < 2 + (r() < 0.5 ? 1 : 0); i++) { const x = cx + r() * 70, y = y0 + 26 + r() * Math.max(1, h - 26); ellipse(g, x, y, 4 + r() * 8, 3 + r() * 5, rgba(L.soil2, 0.65)); if (r() < 0.5) circle(g, x + 2, y - 1, 1.6, rgba("#ffffff", 0.14)); }
    }
    g.restore();
  }
  // grass / snow / sand cap
  g.beginPath(); g.moveTo(x0, y0 + 20); g.lineTo(x0, y0 + 6); g.quadraticCurveTo(x0, y0, x0 + 6, y0); g.lineTo(x0 + w - 6, y0); g.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + 6); g.lineTo(x0 + w, y0 + 20);
  const n = Math.max(2, Math.round(w / 22)); for (let i = n; i >= 0; i--) { const x = x0 + (w * i) / n; g.quadraticCurveTo(x + w / n / 2, y0 + 26 + (i % 2) * 5, x, y0 + 18 + (i % 3) * 2); }
  g.closePath(); g.fillStyle = lin(g, 0, y0, 0, y0 + 26, [[0, L.top], [1, L.top2]]); g.fill();
  g.lineWidth = 2.4; g.strokeStyle = OUT; g.lineJoin = "round"; g.stroke();
  g.beginPath(); g.moveTo(x0 + 5, y0 + 4); g.lineTo(x0 + w - 5, y0 + 4); g.strokeStyle = "rgba(255,255,255,.4)"; g.lineWidth = 2; g.stroke();
  // outline of the soil
  g.strokeStyle = OUT; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x0, y0 + 20); g.lineTo(x0, y0 + h); g.lineTo(x0 + w, y0 + h); g.lineTo(x0 + w, y0 + 20); g.stroke();
  g.restore();
}
