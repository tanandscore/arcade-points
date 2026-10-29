// Hollow Deep: the pictures, all drawn with code. The room, the knight, every monster and boss, arrows, sparks, spikes, the chest and the stairs.
import { circle, ellipse, fillRR, rr, poly, line, star, heart, glow, gloss, makeCanvas, capsule, OUT } from "../../core/draw";
import { TAU, shade, rgba, clamp, lerp, hash2 } from "../../core/util";
import { TS, GW, GH, OY, tilePos, spikeOn, spikeWarn, ENEMY, SWING_REACH } from "./sim";

export const LOOKS = [
  { floorA: "#3b4a3c", floorB: "#34423a", wallTop: "#6b7d6a", wallFace: "#3c4a3e", deco: "#5c8a52", glowC: "#7dff9a", torch: "#ffb347" },
  { floorA: "#8db3d4", floorB: "#84a9cb", wallTop: "#e3f2ff", wallFace: "#4f7aa6", deco: "#ffffff", glowC: "#9fe7ff", torch: "#9fe7ff" },
  { floorA: "#3a2528", floorB: "#321f23", wallTop: "#8a4c42", wallFace: "#4a2420", deco: "#ff6a2d", glowC: "#ff8a3d", torch: "#ff6a2d" },
  { floorA: "#241a3f", floorB: "#1e1537", wallTop: "#4b3a86", wallFace: "#241a4a", deco: "#b49cff", glowC: "#c06bff", torch: "#c06bff" },
];
const LAYER = new Map();

export function roomLayer(lv, F) {
  const key = lv.id + ":" + F.seed; let c = LAYER.get(key); if (c) return c;
  c = makeCanvas(960, 540); const g = c.getContext("2d"), L = LOOKS[lv.look];
  g.fillStyle = shade(L.wallFace, -0.4); g.fillRect(0, 0, 960, 540);
  const solid = (cc, rr_) => cc < 0 || rr_ < 0 || cc >= GW || rr_ >= GH || F.g[rr_ * GW + cc] === 1;
  for (let r = 0; r < GH; r++) for (let cc = 0; cc < GW; cc++) {
    const x = cc * TS, y = OY + r * TS;
    if (!solid(cc, r)) {
      const k = hash2(cc, r, F.seed), base = (cc + r) % 2 ? L.floorA : L.floorB;
      g.fillStyle = shade(base, (k - 0.5) * 0.08); g.fillRect(x, y, TS, TS);
      g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(x, y + TS - 1.5, TS, 1.5); g.fillRect(x + TS - 1.5, y, 1.5, TS);
      g.fillStyle = "rgba(255,255,255,.06)"; g.fillRect(x, y, TS, 1.5);
      if (solid(cc, r - 1)) { const gr = g.createLinearGradient(0, y, 0, y + 12); gr.addColorStop(0, "rgba(0,0,0,.4)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x, y, TS, 12); }
      if (lv.look === 0 && k > 0.8) { g.fillStyle = rgba(L.deco, 0.45); g.beginPath(); g.ellipse(x + 8 + k * 14, y + 10 + k * 8, 6, 3.5, k * 3, 0, TAU); g.fill(); }
      if (lv.look === 1 && k > 0.85) { g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + 6, y + 8); g.lineTo(x + 14, y + 20); g.lineTo(x + 22, y + 14); g.stroke(); }
      if (lv.look === 2 && k > 0.8) { g.strokeStyle = rgba(L.deco, 0.5); g.lineWidth = 1.8; g.beginPath(); g.moveTo(x + 4, y + 6); g.lineTo(x + 14, y + 14); g.lineTo(x + 12, y + 26); g.stroke(); g.strokeStyle = "rgba(255,200,120,.5)"; g.lineWidth = 0.8; g.stroke(); }
      if (lv.look === 3 && k > 0.78) { g.fillStyle = rgba(L.deco, 0.6); g.fillRect(x + 6 + k * 18, y + 6 + k * 14, 2, 2); }
    }
  }
  for (let r = 0; r < GH; r++) for (let cc = 0; cc < GW; cc++) {
    if (!solid(cc, r)) continue; const x = cc * TS, y = OY + r * TS; if (cc < 0 || r < 0) continue;
    const open = !solid(cc, r + 1), faceH = open ? 11 : 0;
    g.fillStyle = L.wallTop; g.fillRect(x, y - 0, TS, TS - faceH);
    g.fillStyle = "rgba(255,255,255,.14)"; g.fillRect(x, y, TS, 2);
    const k = hash2(cc, r, 9); g.fillStyle = `rgba(0,0,0,${0.06 + k * 0.08})`; g.fillRect(x + 4 + k * 8, y + 6, 12, 6);
    if (open) { g.fillStyle = L.wallFace; g.fillRect(x, y + TS - faceH, TS, faceH); g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(x, y + TS - 3, TS, 3); g.fillStyle = "rgba(255,255,255,.08)"; g.fillRect(x, y + TS - faceH, TS, 1.5); }
    g.fillStyle = "rgba(0,0,0,.2)"; g.fillRect(x + TS - 1.5, y, 1.5, TS - faceH);
  }
  // torches on the top wall
  for (const tx of [4, 10, 15, 20, 26]) { const x = tx * TS + 16, y = OY + 10; g.fillStyle = "#2a1a14"; g.fillRect(x - 2, y, 4, 10); g.fillStyle = L.torch; g.beginPath(); g.arc(x, y - 2, 5, 0, TAU); g.fill(); const gr = g.createRadialGradient(x, y + 20, 2, x, y + 20, 70); gr.addColorStop(0, rgba(L.torch, 0.22)); gr.addColorStop(1, rgba(L.torch, 0)); g.fillStyle = gr; g.fillRect(x - 70, y - 40, 140, 150); }
  LAYER.set(key, c); if (LAYER.size > 6) LAYER.delete(LAYER.keys().next().value); return c;
}

// ------------------------------------------------------------------------------------------------------------------ the knight
export function drawHero(g, S, t, state) {
  const h = S.hero, dead = state === "dead";
  if (h.iframes > 0 && Math.floor(t * 18) % 2 === 0 && !dead && h.dashT <= 0) g_alpha(g, 0.45);
  g.save(); g.translate(h.x, h.y);
  ellipse(g, 0, 11, 11, 5, "rgba(0,0,0,.35)", null, 0);
  const dash = h.dashT > 0; if (dash) { glow(g, 0, 0, 26, "#9fe7ff", 0.6); }
  const bob = Math.sin(t * 14) * (Math.hypot(h.vx, h.vy) > 5 ? 1 : 0.4);
  g.translate(0, bob);
  const ang = Math.atan2(h.fy, h.fx), flip = Math.cos(ang) < 0 ? -1 : 1;
  // cape
  g.save(); g.scale(flip, 1); poly(g, [[-3, -2], [-11, 6 + Math.sin(t * 8) * 1.5], [-6, 11], [2, 4]], "#c0392b", OUT, 2); g.restore();
  // body
  circle(g, 0, 1, 9.5, "#5a7be6", OUT, 2.4); ellipse(g, 0, 4, 6, 4.5, "#8fa8ff", null, 0);
  // helmet with a visor
  circle(g, 0, -5, 8.6, "#c9d3ee", OUT, 2.4); g.save(); g.scale(flip, 1); fillRR(g, -1, -8, 9, 4.5, 2, "#1b2140", null); g.fillStyle = "rgba(255,255,255,.7)"; g.fillRect(3, -7, 3, 1.4); g.restore(); poly(g, [[-2, -13], [0, -18 - Math.sin(t * 6) * 1], [2, -13]], "#ff5a6e", OUT, 1.6);
  // sword: a slash arc while swinging, otherwise held at the side
  g.restore();
  g.save(); g.translate(h.x, h.y + bob);
  if (h.swingT > 0) {
    const k = 1 - h.swingT / 0.2, a0 = h.swingA - 1.05, a1 = h.swingA + 1.05, cur = lerp(a0, a1, clamp(k * 1.4, 0, 1));
    g.save(); g.globalAlpha = clamp(1.2 - k, 0, 1) * 0.9; g.lineCap = "round";
    g.strokeStyle = "rgba(255,255,255,.95)"; g.lineWidth = 7; g.beginPath(); g.arc(0, 0, SWING_REACH - 8, a0, cur); g.stroke();
    g.strokeStyle = "rgba(159,231,255,.8)"; g.lineWidth = 3.5; g.beginPath(); g.arc(0, 0, SWING_REACH - 15, a0 + 0.05, cur); g.stroke(); g.restore();
    g.save(); g.rotate(cur); g.translate(8, 0); fillRR(g, 0, -2, SWING_REACH - 14, 4, 2, "#e6efff", OUT, 1.6); fillRR(g, -2, -4.5, 6, 9, 2, "#f1c04a", OUT, 1.6); g.restore();
  } else { g.save(); g.rotate(ang + 0.9 * flip); g.translate(10, 0); fillRR(g, 0, -1.8, 20, 3.6, 1.8, "#e6efff", OUT, 1.6); fillRR(g, -1, -4, 5, 8, 2, "#f1c04a", OUT, 1.6); g.restore(); }
  g.restore(); g_alpha(g, 1);
}
function g_alpha(g, a) { g.globalAlpha = a; }

// ------------------------------------------------------------------------------------------------------------------ monsters
function eyes(g, x, y, sp, r = 3, look = [0, 0]) { for (const s of [-1, 1]) { circle(g, x + s * sp, y, r, "#fff", OUT, 1.5); circle(g, x + s * sp + look[0] * r * 0.4, y + look[1] * r * 0.4, r * 0.5, "#150a33", null, 0); } }

export function drawEnemy(g, e, t, S) {
  const h = S.hero, d = ENEMY[e.type], look = (() => { const dx = h.x - e.x, dy = h.y - e.y, l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; })();
  if (e.spawn > 0) { const k = 1 - e.spawn / 0.8; g.save(); g.globalAlpha = clamp(k, 0, 1) * 0.8; glow(g, e.x, e.y, 24 + (1 - k) * 30, "#c06bff", 0.7); g.strokeStyle = "rgba(220,190,255,.9)"; g.lineWidth = 3; g.beginPath(); g.arc(e.x, e.y, 6 + (1 - k) * 26, 0, TAU); g.stroke(); g.restore(); return; }
  g.save(); g.translate(e.x, e.y);
  ellipse(g, 0, e.r * 0.85, e.r * 0.9, e.r * 0.35, "rgba(0,0,0,.35)", null, 0);
  const flash = e.flash > 0, hf = (c) => (flash ? "#ffffff" : c);
  switch (e.type) {
    case "slime": { const sq = 1 + Math.sin(t * 6 + e.ph) * 0.07; g.scale(1 / sq, sq); ellipse(g, 0, 0, 12, 10, hf("#59d96a"), OUT, 2.4); ellipse(g, -3, -4, 5, 3, "rgba(255,255,255,.5)", null, 0); eyes(g, 0, -1, 4, 2.8, look); break; }
    case "bat": { const f = Math.sin(t * 22 + e.ph); for (const s of [-1, 1]) { g.save(); g.scale(s, 1); poly(g, [[3, -1], [16, -8 - f * 5], [13, 0], [17, 5 + f * 3], [8, 3], [3, 5]], hf("#7c4dbb"), OUT, 2); g.restore(); } circle(g, 0, 0, 7, hf("#4a2a7a"), OUT, 2.2); eyes(g, 0, -1, 2.6, 1.8, look); poly(g, [[-4, -6], [-3, -11], [-1, -6]], "#4a2a7a", OUT, 1.5); poly(g, [[4, -6], [3, -11], [1, -6]], "#4a2a7a", OUT, 1.5); break; }
    case "archer": { const a = Math.atan2(look[1], look[0]); circle(g, 0, 2, 8.5, hf("#e8e2cf"), OUT, 2.2); circle(g, 0, -5, 8, hf("#f3eedd"), OUT, 2.2); for (const s of [-1, 1]) circle(g, s * 3, -5, 2.2, "#1b1330", null, 0); fillRR(g, -4, 0, 8, 2.4, 1, "#1b1330", null);
      g.save(); g.rotate(a); const draw = e.st === "aim" ? clamp(1 - e.stT / 0.5, 0, 1) : 0; g.strokeStyle = "#8a5a2a"; g.lineWidth = 3; g.beginPath(); g.arc(10, 0, 11, -1.15, 1.15); g.stroke(); g.strokeStyle = "rgba(255,255,255,.8)"; g.lineWidth = 1; g.beginPath(); g.moveTo(10 + Math.cos(-1.15) * 11, Math.sin(-1.15) * 11); g.lineTo(10 - 4 * draw * 2, 0); g.lineTo(10 + Math.cos(1.15) * 11, Math.sin(1.15) * 11); g.stroke(); if (e.st === "aim") line(g, 10 - 6 * draw, 0, 26, 0, "#ffd9a0", 2); g.restore(); if (e.st === "aim") { glow(g, 0, -4, 22, "#ff5a5a", 0.5 * (1 - e.stT * 2 > 0 ? 1 : 0)); } break; }
    case "brute": { const ch = e.st === "charge", tele = e.st === "tele", stun = e.st === "stun"; if (tele) { g.save(); g.rotate(Math.atan2(e.diry, e.dirx)); const k = 1 - e.stT / 0.8; g.fillStyle = `rgba(255,70,70,${0.12 + k * 0.25})`; g.fillRect(0, -16, 300, 32); g.restore(); glow(g, 0, 0, 36, "#ff3e3e", 0.5 * (0.5 + 0.5 * Math.sin(t * 30))); }
      if (stun) for (let i = 0; i < 3; i++) star(g, Math.cos(t * 5 + i * 2.1) * 14, -22 + Math.sin(t * 5 + i * 2.1) * 4, 4, "#ffd54a", OUT, 1);
      ellipse(g, 0, 2, 16, 15, hf(ch ? "#d6573f" : "#9b6a4a"), OUT, 2.8); ellipse(g, 0, 7, 10, 8, "rgba(255,220,180,.25)", null, 0); circle(g, 0, -9, 9.5, hf("#b07a58"), OUT, 2.6); for (const s of [-1, 1]) poly(g, [[s * 5, -15], [s * 11, -23], [s * 8, -13]], "#f1e6c8", OUT, 1.8); eyes(g, 0, -10, 4, 2.4, look); g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.moveTo(-4, -5); g.lineTo(4, -5); g.stroke();
      capsule(g, 14, -2, 22, 8, 7, "#6a4a30", OUT, 2); capsule(g, -14, -2, -22, 8, 7, "#6a4a30", OUT, 2); break; }
    case "wisp": { glow(g, 0, 0, 26, "#9d7cff", 0.55); const f = Math.sin(t * 7 + e.ph) * 2; poly(g, [[-9, 4], [-6, -8 + f], [0, -16 + f], [6, -8 + f], [9, 4], [4, 12], [-4, 12]], hf("#a98bff"), OUT, 2.2); circle(g, 0, -1, 7, hf("#e9deff"), null, 0); eyes(g, 0, -2, 3.2, 2, look); if (e.cd < 0.5) glow(g, 0, 0, 30, "#ffffff", 0.5); break; }
    case "warden": { const ch = e.st === "charge", tele = e.st === "tele", stun = e.st === "stun"; if (tele) { g.save(); g.rotate(Math.atan2(e.diry, e.dirx)); const k = 1 - e.stT / 0.85; g.fillStyle = `rgba(255,70,70,${0.12 + k * 0.28})`; g.fillRect(0, -24, 330, 48); g.restore(); glow(g, 0, 0, 56, "#ff3e3e", 0.55); }
      if (stun) for (let i = 0; i < 4; i++) star(g, Math.cos(t * 5 + i * 1.6) * 20, -36 + Math.sin(t * 5 + i * 1.6) * 5, 5, "#ffd54a", OUT, 1);
      ellipse(g, 0, 4, 24, 22, hf(ch ? "#d6573f" : "#7d8a9c"), OUT, 3.2); ellipse(g, 0, 10, 15, 11, "rgba(255,255,255,.12)", null, 0);
      for (const s of [-1, 1]) { ellipse(g, s * 22, -8, 11, 9, hf("#a9b5c8"), OUT, 2.6); poly(g, [[s * 17, -14], [s * 26, -26], [s * 22, -10]], "#d9dff0", OUT, 1.8); }
      circle(g, 0, -14, 14, hf("#e8e2cf"), OUT, 3); for (const s of [-1, 1]) { circle(g, s * 5.5, -15, 3.6, "#150a33", null, 0); circle(g, s * 5.5, -15, 1.9, tele || ch ? "#ff5a5a" : "#7dff9a", null, 0); } fillRR(g, -6, -8, 12, 4, 1.5, "#1b1330", null); poly(g, [[-12, -24], [-6, -34], [0, -26], [6, -34], [12, -24]], "#f1c04a", OUT, 2); break; }
    case "queen": { glow(g, 0, 0, 44, "#9fe7ff", 0.5); const cast = e.st === "cast" || e.st === "blink"; for (let i = 0; i < 5; i++) { const a = t * 1.6 + (i / 5) * TAU; poly(g, [[Math.cos(a) * 26, Math.sin(a) * 26 - 6], [Math.cos(a) * 26 + 3, Math.sin(a) * 26 + 4], [Math.cos(a) * 26 - 3, Math.sin(a) * 26 + 4]], "#d9f4ff", OUT, 1.6); }
      poly(g, [[-16, 16], [-12, -4], [0, -10], [12, -4], [16, 16], [8, 12], [0, 18], [-8, 12]], hf(cast ? "#ffffff" : "#8fd0f0"), OUT, 2.8); circle(g, 0, -10, 9.5, hf("#e6f6ff"), OUT, 2.6); for (const s of [-1, 1]) circle(g, s * 3.5, -10, 2, "#2a6fb0", null, 0);
      poly(g, [[-9, -17], [-6, -27], [-2, -19], [0, -30], [2, -19], [6, -27], [9, -17]], "#fff3a8", OUT, 2); break; }
    case "golem": { const st = e.st === "stomp"; if (st) { glow(g, 0, 0, 70, "#ff6a2d", 0.6 * (0.5 + 0.5 * Math.sin(t * 30))); g.strokeStyle = "rgba(255,120,40,.5)"; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, 40 + (1 - e.stT / 0.9) * 30, 0, TAU); g.stroke(); }
      ellipse(g, 0, 4, 27, 25, hf("#5a4a48"), OUT, 3.4); for (const [px, py, pr] of [[-10, 0, 6], [8, 6, 5], [-4, 12, 4], [12, -6, 4]]) circle(g, px, py, pr, hf("#ff7a2d"), null, 0); g.strokeStyle = "rgba(255,180,90,.8)"; g.lineWidth = 2; g.beginPath(); g.moveTo(-18, -2); g.lineTo(-6, 6); g.lineTo(2, 0); g.lineTo(14, 10); g.stroke();
      for (const s of [-1, 1]) { circle(g, s * 30, 8 + Math.sin(t * 3 + s) * 2, 11, hf("#6a5654"), OUT, 3); circle(g, s * 30, 8, 5, "#ff7a2d", null, 0); } circle(g, 0, -17, 13, hf("#6a5654"), OUT, 3); for (const s of [-1, 1]) { ellipse(g, s * 5, -19, 4, 2.6, st ? "#ffffff" : "#ffb347", null, 0); } break; }
    case "eye": { glow(g, 0, 0, 60, "#c06bff", 0.5); for (let i = 0; i < 6; i++) { const a = t * 0.9 + (i / 6) * TAU; g.strokeStyle = OUT; g.lineWidth = 7; g.beginPath(); g.moveTo(Math.cos(a) * 14, Math.sin(a) * 14 + 4); g.quadraticCurveTo(Math.cos(a + 0.5) * 30, Math.sin(a + 0.5) * 30, Math.cos(a + 0.2) * 38, Math.sin(a + 0.2) * 38); g.stroke(); g.strokeStyle = "#6a3fb0"; g.lineWidth = 3.5; g.stroke(); }
      circle(g, 0, 0, 23, hf("#f3eaff"), OUT, 3.2); const ix = look[0] * 8, iy = look[1] * 8, fast = e.hp < e.max * 0.5; circle(g, ix, iy, 12, hf(fast ? "#ff3e8a" : "#8a3fe0"), OUT, 2.4); circle(g, ix, iy, 6, "#150a33", null, 0); circle(g, ix - 3, iy - 3, 2.6, "#fff", null, 0); break; }
  }
  g.restore();
  if (!d.boss && e.hp < e.max) { fillRR(g, e.x - 12, e.y - e.r - 12, 24, 4, 2, "rgba(14,6,36,.8)", null); fillRR(g, e.x - 12, e.y - e.r - 12, 24 * (e.hp / e.max), 4, 2, "#ff5a6e"); }
}

export function drawShot(g, s, t) {
  g.save(); g.translate(s.x, s.y); const a = Math.atan2(s.vy, s.vx);
  if (s.kind === "arrow") { g.rotate(a); line(g, -10, 0, 8, 0, OUT, 4.5); line(g, -10, 0, 8, 0, "#e8d8b0", 2.4); poly(g, [[8, -4], [14, 0], [8, 4]], "#d7dcf5", OUT, 1.6); poly(g, [[-10, 0], [-14, -3], [-8, 0], [-14, 3]], "#ff5a6e", OUT, 1.2); }
  else if (s.kind === "shard") { g.rotate(a); glow(g, 0, 0, 14, "#9fe7ff", 0.5); poly(g, [[-8, 0], [0, -4], [11, 0], [0, 4]], "#e2f7ff", OUT, 1.8); }
  else if (s.kind === "ember") { glow(g, 0, 0, 20, "#ff8a3d", 0.8); circle(g, 0, 0, 7, "#ffb347", OUT, 2); circle(g, 0, 0, 3, "#fff1a8", null, 0); }
  else if (s.kind === "void") { glow(g, 0, 0, 16, "#c06bff", 0.7); circle(g, 0, 0, 5.5, "#b24bff", OUT, 1.8); circle(g, -1, -1, 2, "#f2d6ff", null, 0); }
  else { glow(g, 0, 0, 18, "#9d7cff", 0.8); circle(g, 0, 0, 6, "#c9b6ff", OUT, 1.8); circle(g, 0, 0, 3, "#fff", null, 0); }
  g.restore();
}
export function drawBolt(g, b, t) { g.save(); g.translate(b.x, b.y); glow(g, 0, 0, 22, "#7dffe0", 0.8); circle(g, 0, 0, 5, "#d9fff4", "#2cc9a8", 2); g.restore(); }
export function drawRing(g, rg) { const k = clamp(1 - rg.r / rg.max, 0, 1); g.save(); g.globalAlpha = 0.3 + k * 0.6; g.strokeStyle = "#ff8a3d"; g.lineWidth = rg.th * 2 + 4; g.beginPath(); g.arc(rg.x, rg.y, rg.r, 0, TAU); g.stroke(); g.strokeStyle = "#fff1a8"; g.lineWidth = 4; g.stroke(); g.restore(); }

export function drawSpike(g, S, sp, t) {
  const [x, y] = tilePos(sp.c, sp.r), on = spikeOn(S, sp), warn = spikeWarn(S, sp);
  g.save(); g.translate(x, y); fillRR(g, -13, -13, 26, 26, 4, "#1a1228", "#4a3a68", 1.5);
  if (warn) { g.fillStyle = `rgba(255,70,70,${0.25 + 0.25 * Math.sin(t * 40)})`; g.fillRect(-13, -13, 26, 26); }
  for (const [px, py] of [[-6, -6], [6, -6], [-6, 6], [6, 6], [0, 0]]) { if (on) poly(g, [[px - 4, py + 4], [px, py - 9], [px + 4, py + 4]], "#e3e8ff", OUT, 1.6); else circle(g, px, py, 1.6, "#6a5a8a", null, 0); }
  g.restore();
}
export function drawChest(g, S, t) {
  const [x, y] = tilePos(S.F.chest[0], S.F.chest[1]); g.save(); g.translate(x, y); ellipse(g, 0, 11, 13, 5, "rgba(0,0,0,.35)", null, 0);
  if (!S.chestOpen) { glow(g, 0, 0, 30, "#ffd54a", 0.35 + 0.15 * Math.sin(t * 4)); fillRR(g, -12, -4, 24, 15, 3, "#a2682c", OUT, 2.2); fillRR(g, -12, -10, 24, 9, 4, "#c4863c", OUT, 2.2); fillRR(g, -2, -4, 4, 6, 1, "#ffd54a", OUT, 1.4); }
  else { fillRR(g, -12, -2, 24, 13, 3, "#a2682c", OUT, 2.2); fillRR(g, -12, -16, 24, 7, 3, "#c4863c", OUT, 2.2); ellipse(g, 0, -2, 9, 3, "#ffd54a", null, 0); }
  g.restore();
}
export function drawStairs(g, S, t) {
  const [x, y] = tilePos(S.F.stairs[0], S.F.stairs[1]); g.save(); g.translate(x, y);
  if (S.stairsOpen) { glow(g, 0, 0, 44, "#7dffb5", 0.5 + 0.2 * Math.sin(t * 5)); for (let i = 0; i < 4; i++) fillRR(g, -13 + i * 1.6, -13 + i * 6.5, 26 - i * 3.2, 6, 2, shade("#8fa0c8", -i * 0.12), OUT, 1.6); }
  else { fillRR(g, -13, -13, 26, 26, 4, "#2a2038", OUT, 2.2); for (let i = -1; i <= 1; i++) line(g, i * 7, -12, i * 7, 12, "#8a7aa8", 3); line(g, -12, 0, 12, 0, "#8a7aa8", 3); }
  g.restore();
}
export function drawPickup(g, p, t) { const by = Math.sin(t * 4 + p.x) * 2.5; g.save(); g.translate(p.x, p.y - 4 + by); ellipse(g, 0, 12 - by, 8, 3, "rgba(0,0,0,.3)", null, 0); glow(g, 0, 0, 22, "#ff3ea5", 0.55); heart(g, 0, 0, 9, "#ff3ea5", OUT, 2); g.restore(); }

export function drawBossBar(g, e) { const w = 360, x = 300, y = 504; fillRR(g, x, y, w, 12, 6, "rgba(14,6,36,.75)", "rgba(190,180,255,.4)", 1.5); fillRR(g, x + 2, y + 2, Math.max(0, (w - 4) * (e.hp / e.max)), 8, 4, e.hp < e.max * 0.5 ? "#ff5a6e" : "#ffb347"); }
