// Draws a fighter as a posable puppet: a few poses are blended and the arms and legs are bent with simple two-bone IK,
// so every fighter moves smoothly without any sprite sheets. Heights are measured up from the feet.
import { clamp, lerp, shade, TAU } from "../../core/util";
import { capsule, ellipse, circle, OUT } from "../../core/draw";
import { FLOOR } from "./roster";

const GUARD = { lean: 0.08, hip: 88, hF: [42, 128], hB: [26, 114], fF: [30, 0], fB: [-24, 0] };
const E = {
  jab: { lean: 0.12, hF: [112, 134], hB: [20, 118] },
  straight: { lean: 0.32, hip: 82, hF: [128, 128], hB: [-6, 112], fF: [56, 0], fB: [-40, 0] },
  kick: { lean: -0.22, hF: [30, 122], hB: [10, 108], fF: [100, 62], fB: [-20, 0] },
  hkick: { lean: -0.42, hF: [20, 118], hB: [-6, 104], fF: [122, 118], fB: [-30, 0] },
  cpunch: { lean: 0.3, hip: 56, hF: [100, 78], hB: [20, 74], fF: [38, 0], fB: [-32, 0] },
  low: { lean: 0.22, hip: 50, hF: [40, 70], hB: [10, 60], fF: [128, 8], fB: [-40, 0] },
  upper: { lean: -0.12, hip: 92, hF: [56, 214], hB: [-4, 110], fF: [30, 16], fB: [-24, 8] },
  jumpP: { lean: 0.1, hF: [96, 96], hB: [10, 100], fF: [30, 30], fB: [-6, 40], air: true },
  jumpK: { lean: -0.3, hF: [10, 120], hB: [0, 104], fF: [96, 40], fB: [-8, 52], air: true },
  grab: { lean: 0.28, hip: 80, hF: [96, 118], hB: [84, 108], fF: [48, 0], fB: [-34, 0] },
  shoot: { lean: 0.15, hip: 84, hF: [100, 120], hB: [88, 116], fF: [44, 0], fB: [-38, 0] },
  stomp: { lean: 0.2, hip: 70, hF: [30, 150], hB: [10, 150], fF: [40, 0], fB: [-40, 0] },
  spin: { lean: -0.2, hF: [50, 120], hB: [-40, 118], fF: [100, 80], fB: [-90, 70], air: true },
  multi: { lean: 0.25, hip: 84, hF: [112, 126], hB: [96, 100], fF: [50, 0], fB: [-40, 0] },
  vanish: { lean: 0.0, hF: [20, 110], hB: [10, 100], fF: [30, 0], fB: [-24, 0] },
};
const mixP = (a, b, k) => ({ lean: lerp(a.lean, b.lean ?? a.lean, k), hip: lerp(a.hip, b.hip ?? a.hip, k), hF: [lerp(a.hF[0], (b.hF || a.hF)[0], k), lerp(a.hF[1], (b.hF || a.hF)[1], k)], hB: [lerp(a.hB[0], (b.hB || a.hB)[0], k), lerp(a.hB[1], (b.hB || a.hB)[1], k)], fF: [lerp(a.fF[0], (b.fF || a.fF)[0], k), lerp(a.fF[1], (b.fF || a.fF)[1], k)], fB: [lerp(a.fB[0], (b.fB || a.fB)[0], k), lerp(a.fB[1], (b.fB || a.fB)[1], k)] });

function ik(rx, ry, tx, ty, l1, l2, bend) {
  let dx = tx - rx, dy = ty - ry, d = Math.hypot(dx, dy); const mx = l1 + l2 - 0.5; if (d > mx) { dx *= mx / d; dy *= mx / d; d = mx; tx = rx + dx; ty = ry + dy; } if (d < 8) d = 8;
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a)); const ux = dx / d, uy = dy / d;
  return { jx: rx + ux * a - uy * h * bend, jy: ry + uy * a + ux * h * bend, tx, ty };
}

export function poseFor(f, t, state) {
  let P = { ...GUARD, hF: [...GUARD.hF], hB: [...GUARD.hB], fF: [...GUARD.fF], fB: [...GUARD.fB] };
  const bob = Math.sin(t * 4.2 + f.side * 2) * 2;
  if (f.st === "walk") { const ph = f.walkT * 0.28; P.fF = [30 + Math.sin(ph) * 34, Math.max(0, Math.cos(ph)) * 16]; P.fB = [-24 - Math.sin(ph) * 34, Math.max(0, -Math.cos(ph)) * 16]; P.hip -= Math.abs(Math.sin(ph)) * 3; }
  else if (f.st === "idle" || f.st === "getup" && false) { P.hip += bob * 0.6; P.hF[1] += bob; P.hB[1] += bob * 0.6; }
  if (f.st === "crouch") { P.hip = 54; P.lean = 0.28; P.hF = [48, 92]; P.hB = [30, 84]; P.fF = [40, 0]; P.fB = [-30, 0]; }
  if (f.st === "jump") { P.hF = [50, 130]; P.hB = [20, 120]; P.fF = [34, Math.max(26, 44 - f.vh * 1)]; P.fB = [-14, 36]; P.hip = 96; }
  if (f.st === "block") { P.hF = [46, 140]; P.hB = [32, 124]; P.lean = -0.04; if (f.crouch) { P.hip = 56; P.lean = 0.2; P.hF = [48, 100]; P.hB = [34, 90]; P.fF = [40, 0]; P.fB = [-30, 0]; } }
  if (f.st === "hit") { const k = clamp(f.t / 8, 0, 1); P.lean = -0.38 * (1 - k * 0.5); P.hF = [10, 112]; P.hB = [-6, 100]; P.hip = f.crouch ? 60 : 84; P.headDx = -10; }
  if (f.st === "intro") { const k = Math.sin(t * 5) * 6; P.hF = [40, 150 + k]; P.hB = [-10, 156 - k]; P.lean = -0.05; }
  if (f.winPose && f.st !== "ko") { const k = Math.sin(t * 6) * 8; P.hF = [48, 190 + k]; P.hB = [-6, 176 - k]; P.lean = -0.12; }
  if (f.st === "atk" && f.mv) {
    const mv = f.mv, E1 = E[mv.pose] || E.jab, tot = mv.sf + mv.af + mv.rf, t0 = f.t;
    let k; if (t0 < mv.sf) k = (t0 / mv.sf) * 0.55; else if (t0 < mv.sf + mv.af) k = 1; else k = 1 - (t0 - mv.sf - mv.af) / Math.max(1, mv.rf);
    k = clamp(k, 0, 1); const base = f.crouch || mv.crouch ? { ...P, hip: 56 } : P;
    P = mixP(base, { ...base, ...E1 }, k * k * (3 - 2 * k) * 0 + Math.min(1, k * 1.15));
    if (mv.hits && t0 >= mv.sf) { const s = Math.sin((t0 - mv.sf) * 1.6); P.hF[0] += s * 14; P.hB[0] -= s * 14; P.hB[1] += s * 4; }
    if (mv.pose === "spin") P.rot = (t0 / (mv.sf + mv.af)) * TAU * 1.5;
  }
  P.hip = P.hip ?? 88; return P;
}

export function drawFighter(g, f, t, state, preview) {
  const D = f.def, L = D.look, s = D.scale;
  if (f.st === "atk" && f.mv && f.mv.teleport && f.t < f.mv.sf) { g.save(); g.globalAlpha = 0.25; }
  else g.save();
  const feetY = preview ? 0 : FLOOR - f.h;
  g.translate(preview ? 0 : f.x, feetY); g.scale(f.face >= 0 ? s : -s, s);
  if (f.flash > 0 && f.flash % 2 === 0) { try { g.filter = "brightness(2.2)"; } catch {} }
  if (f.st === "launched" || f.st === "ko" && f.h > 0) { const k = clamp(f.vh / 12, -1, 1); g.translate(0, -80); g.rotate(-1.15 - k * 0.5 * -1 * 0 + (f.t * 0.12)); g.translate(0, 80); }
  else if (f.st === "down" || f.st === "ko") { g.translate(-30, -16); g.rotate(-Math.PI / 2 + 0.12); g.translate(0, 0); }
  const p = (f.st === "down" || f.st === "ko") ? { lean: 0, hip: 88, hF: [30, 110], hB: [10, 100], fF: [24, 0], fB: [-20, 0] } : poseFor(f, t, state);
  if (p.rot) { g.translate(0, -p.hip); g.rotate(p.rot); g.translate(0, p.hip); }
  const hipX = f.st === "hit" ? -4 : 0, hipY = p.hip, T = 52, sh = [hipX + Math.sin(p.lean) * T, hipY + Math.cos(p.lean) * T];
  const J = (x, y) => [x, -y];
  const skin = L.skin, top = L.top, pants = L.pants, acc = L.accent, ol = OUT;
  const limb = (r, tgt, l1, l2, bend, col, w, endCol) => { const a = ik(r[0], r[1], tgt[0], tgt[1], l1, l2, bend); capsule(g, r[0], -r[1], a.jx, -a.jy, w, col, ol, 2.4); capsule(g, a.jx, -a.jy, a.tx, -a.ty, w * 0.9, col, ol, 2.4); if (endCol) circle(g, a.tx, -a.ty, w * 0.78, endCol, ol, 2.4); return a; };
  const shB = [sh[0] - 6, sh[1] - 2], shF = [sh[0] + 6, sh[1] - 2];
  // back arm and leg
  limb(shB, [p.hB[0], p.hB[1]], 28, 30, -1, skin, 12, acc);
  limb([hipX - 6, hipY], [p.fB[0], p.fB[1] + 6], 43, 44, 1, pants, 15, null); capsule(g, p.fB[0] - 4, -(p.fB[1] + 4), p.fB[0] + 14, -(p.fB[1] + 4), 12, acc, ol, 2.4);
  // torso
  capsule(g, hipX, -hipY, sh[0], -sh[1], 31, top, ol, 2.8); capsule(g, hipX, -hipY - 2, hipX, -hipY + 6, 33, pants, ol, 2.4);
  g.save(); g.globalAlpha = 0.25; capsule(g, hipX + 6, -hipY - 8, sh[0] + 6, -sh[1] + 8, 8, "#fff", null, 0); g.restore();
  // head
  const hx = sh[0] + 4 + (p.headDx || 0), hy = sh[1] + 20;
  circle(g, hx, -hy, 19, skin, ol, 2.8);
  hair(g, L.style, hx, -hy, L.hair, acc, ol, t);
  const hurt = f.st === "hit" || f.st === "launched" || f.st === "ko"; g.fillStyle = "#1a1018"; if (hurt) { g.fillRect(hx + 4, -hy - 4, 8, 2.5); g.fillRect(hx + 4, -hy + 1, 8, 2.5); } else { g.fillRect(hx + 5, -hy - 4, 4, 6); g.fillRect(hx + 12, -hy - 4, 3, 6); }
  g.strokeStyle = "#5a2a2a"; g.lineWidth = 2; g.beginPath(); if (hurt || (f.st === "atk")) g.ellipse(hx + 11, -hy + 9, 4, 3, 0, 0, TAU); else { g.moveTo(hx + 6, -hy + 9); g.lineTo(hx + 14, -hy + 9); } g.stroke();
  // front leg, front arm
  limb([hipX + 6, hipY], [p.fF[0], p.fF[1] + 6], 43, 44, 1, pants, 15, null); capsule(g, p.fF[0] - 4, -(p.fF[1] + 4), p.fF[0] + 16, -(p.fF[1] + 4), 12, acc, ol, 2.4);
  limb(shF, [p.hF[0], p.hF[1]], 28, 30, -1, skin, 13, acc);
  try { g.filter = "none"; } catch {}
  g.restore();
}

function hair(g, style, x, y, col, acc, ol, t) {
  g.fillStyle = col; g.strokeStyle = ol; g.lineWidth = 2.4;
  const arc = () => { g.beginPath(); g.arc(x, y - 2, 19.5, Math.PI * 1.02, Math.PI * 2.0); g.closePath(); g.fill(); g.stroke(); };
  if (style === "spiky") { arc(); for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x - 16 + i * 9, y - 14); g.lineTo(x - 12 + i * 9, y - 36 - (i % 2) * 6); g.lineTo(x - 5 + i * 9, y - 14); g.fill(); g.stroke(); } }
  else if (style === "pony") { arc(); g.beginPath(); g.moveTo(x - 14, y - 10); g.quadraticCurveTo(x - 46, y - 8 + Math.sin(t * 5) * 6, x - 38, y + 30); g.quadraticCurveTo(x - 26, y + 6, x - 12, y - 4); g.fill(); g.stroke(); }
  else if (style === "bob") { arc(); g.beginPath(); g.moveTo(x - 19, y - 4); g.lineTo(x - 22, y + 20); g.lineTo(x - 6, y + 12); g.lineTo(x - 4, y - 6); g.fill(); g.stroke(); }
  else if (style === "band") { arc(); g.fillStyle = acc; g.fillRect(x - 20, y - 11, 40, 7); g.strokeRect(x - 20, y - 11, 40, 7); g.beginPath(); g.moveTo(x - 20, y - 8); g.lineTo(x - 36, y - 2 + Math.sin(t * 7) * 4); g.lineTo(x - 36, y + 8); g.lineTo(x - 20, y - 4); g.fill(); g.stroke(); }
  else if (style === "mohawk") { for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(x - 14 + i * 6, y - 17); g.lineTo(x - 11 + i * 6, y - 38 + Math.abs(i - 2) * 4); g.lineTo(x - 6 + i * 6, y - 17); g.fill(); g.stroke(); } }
  else if (style === "bald") { g.fillStyle = "rgba(255,255,255,.18)"; g.beginPath(); g.ellipse(x - 5, y - 11, 8, 4, -0.5, 0, TAU); g.fill(); g.fillStyle = col; g.beginPath(); g.moveTo(x - 6, y + 14); g.quadraticCurveTo(x + 8, y + 36, x + 20, y + 14); g.quadraticCurveTo(x + 8, y + 22, x - 6, y + 14); g.fill(); g.stroke(); }
}
