// Skyline Siege — everything that gets drawn: the hero, the Syndicate, bullets, pickups, props and the HUD pieces.
// All shapes are painted with the canvas in the kit's bold sticker style (dark outline, bright fill, glossy highlight).
import { TAU, clamp, lerp, shade, rgba } from "../../core/util";
import { circle, ellipse, fillRR, rr, poly, line, capsule, glow, text, star, heart, lin, rad, shadowBlob, OUT, FONT_DISPLAY, FONT_PIXEL, FONT_BODY } from "../../core/draw";
import { ENEMY } from "./defs";

const SK = "#ffcf9e", SK2 = "#e8a574";
export const PAL = {
  hero: { coat: "#ff8a1f", coat2: "#c25a00", stripe: "#7ff3ff", pants: "#2c3263", boots: "#191a3a", hair: "#4a2a1a", band: "#ff3e5e" },
  grunt: { armor: "#5a45b5", armor2: "#33297a", visor: "#3ee6e0", trim: "#ffb703", pants: "#2a2260" },
  brute: { armor: "#7a3fa0", armor2: "#4a2068", visor: "#ff3ea5", trim: "#ffb703", pants: "#321a55" },
  sniper: { armor: "#2f5f6b", armor2: "#1c3b45", visor: "#ff5a5a", trim: "#9fe7ff", pants: "#1d3340" },
  jet: { armor: "#c0407a", armor2: "#7d2150", visor: "#ffe27a", trim: "#3ee6e0", pants: "#4a1b3a" },
};

// ---- guns -------------------------------------------------------------------------------------------------------------------
// drawn pointing right, origin at the hand; length about 26-38 px
export function drawGun(g, id, flash = 0) {
  g.save(); g.lineJoin = "round"; g.lineWidth = 2.2; g.strokeStyle = OUT;
  const body = (x, y, w, h, c, r = 3) => { rr(g, x, y, w, h, r); g.fillStyle = c; g.fill(); g.stroke(); };
  switch (id) {
    case "pistol": body(-3, -5, 14, 8, "#9aa3c9"); body(9, -4, 14, 5, "#6c7497"); body(-2, 2, 7, 9, "#4a4f78"); break;
    case "smg": body(-4, -5, 26, 9, "#ffbd4a"); body(20, -3, 14, 4, "#6c7497"); body(2, 3, 7, 13, "#4a4f78"); body(10, 3, 5, 6, "#6c7497"); break;
    case "shotgun": body(-6, -5, 20, 9, "#a8683a"); body(12, -4, 28, 5, "#6c7497"); body(18, 1, 12, 5, "#7a4a28"); break;
    case "laser": body(-4, -6, 22, 11, "#3ee6e0"); body(18, -4, 18, 6, "#c9fffb"); g.fillStyle = "#fff"; g.fillRect(2, -3, 10, 2); body(-1, 4, 7, 9, "#4a4f78"); break;
    case "rocket": body(-12, -9, 40, 14, "#6f7a5a", 6); body(26, -11, 12, 18, "#ff7a45", 5); body(-2, 4, 7, 10, "#4a4f78"); g.fillStyle = "#ffe27a"; g.fillRect(2, -6, 12, 3); break;
    default: break;
  }
  g.restore();
}
export const GUN_LEN = { pistol: 24, smg: 36, shotgun: 40, laser: 38, rocket: 40 };

// ---- the hero -------------------------------------------------------------------------------------------------------------
export function drawHero(g, H, t, weapon) {
  const P = PAL.hero, face = H.face || 1, crouch = H.crouch, air = !H.onGround, run = H.run || 0, moving = Math.abs(H.vx) > 30;
  g.save(); g.translate(H.x, H.y); g.scale(face, 1);
  if (H.inv > 0 && !H.dead && Math.floor(t * 22) % 2 === 0) g.globalAlpha = 0.45;
  if (H.rage > 0) glow(g, 0, -30, 54, "#ff3e5e", 0.5 + 0.2 * Math.sin(t * 12));
  const hipY = crouch ? -17 : -26, torsoY = crouch ? -29 : -40, headY = crouch ? -45 : -59, bob = !air && moving ? Math.abs(Math.sin(run * 2)) * 2 : 0;
  // legs
  const leg = (ph, back) => {
    let fx, fy, kx;
    if (air) { fx = back ? -9 : 11; fy = back ? -6 : -12 + Math.min(10, Math.max(-10, H.vy * 0.012)) * 0; kx = back ? -4 : 8; }
    else if (crouch) { fx = back ? -9 : 9; fy = 0; kx = back ? -12 : 12; }
    else if (moving) { fx = Math.sin(ph) * 13; fy = -Math.max(0, Math.cos(ph)) * 8; kx = fx * 0.5 + 4; }
    else { fx = back ? -5 : 5; fy = 0; kx = fx; }
    const hy = hipY + bob, ky = (hy + (fy)) / 2 + (crouch ? 4 : 2);
    capsule(g, 1, hy, kx, ky, 9, P.pants, OUT, 2.2); capsule(g, kx, ky, fx, fy - 3, 8.5, P.pants, OUT, 2.2);
    fillRR(g, fx - 6 + 2, fy - 7, 15, 8, 4, P.boots, OUT, 2.2);
  };
  leg(run + Math.PI, true);
  // bandana tail
  g.save(); g.translate(-6, headY - 2); g.rotate(Math.sin(t * 9) * 0.25 - (moving ? 0.5 : 0.1)); poly(g, [[0, 0], [-16, -3], [-11, 3], [-17, 8], [0, 4]], P.band, OUT, 2); g.restore();
  // torso
  const tx = -11, ty = torsoY - 14 + bob;
  fillRR(g, tx, ty, 23, 28, 8, P.coat, OUT, 2.4);
  g.save(); rr(g, tx, ty, 23, 28, 8); g.clip();
  g.fillStyle = P.coat2; g.fillRect(tx, ty + 17, 23, 12); g.fillStyle = P.stripe; g.fillRect(tx, ty + 8, 23, 4); g.fillRect(tx, ty + 19, 23, 3);
  g.fillStyle = "rgba(255,255,255,.28)"; g.fillRect(tx + 2, ty + 2, 6, 24); g.restore();
  fillRR(g, tx + 1, ty + 25, 21, 5, 2, "#3a2a1a", OUT, 1.8);
  // head
  const hx = 2, hy2 = headY + bob;
  circle(g, hx, hy2, 11.5, SK, OUT, 2.4);
  g.fillStyle = P.hair; g.beginPath(); g.moveTo(hx - 11, hy2 - 3); g.lineTo(hx - 12, hy2 - 13); g.lineTo(hx - 5, hy2 - 8); g.lineTo(hx - 3, hy2 - 17); g.lineTo(hx + 3, hy2 - 9); g.lineTo(hx + 8, hy2 - 16); g.lineTo(hx + 11, hy2 - 4); g.closePath(); g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke();
  g.fillStyle = P.band; g.fillRect(hx - 11, hy2 - 6, 22, 5); g.strokeRect(hx - 11, hy2 - 6, 22, 5);
  circle(g, hx + 5, hy2 + 1.5, 3.2, "#fff", OUT, 1.5); circle(g, hx + 6.2, hy2 + 1.7, 1.5, "#1a1030");
  g.strokeStyle = OUT; g.lineWidth = 1.8; g.beginPath(); g.moveTo(hx + 1, hy2 + 7); g.quadraticCurveTo(hx + 6, hy2 + 10, hx + 10, hy2 + 6); g.stroke();
  leg(run, false);
  // arm + gun, rotated to the aim direction
  const ang = H.aimRel || 0, sx = 4, sy = torsoY - 7 + bob;
  g.save(); g.translate(sx, sy); g.rotate(ang);
  const recoil = (H.kick || 0) * -3;
  capsule(g, 0, 0, 14 + recoil, 0, 8, P.coat, OUT, 2.2);
  g.save(); g.translate(14 + recoil, 0); drawGun(g, weapon, H.flashT); circle(g, 0, 0, 5, SK, OUT, 2); g.restore();
  if (H.flashT > 0) { const L = (GUN_LEN[weapon] || 26) + 14 + recoil; g.save(); g.translate(L, 0); g.globalCompositeOperation = "lighter"; glow(g, 0, 0, 30, "#ffd27a", 0.9); poly(g, [[0, 0], [14, -5], [24, 0], [14, 5]], "#fff3c2", null); g.restore(); }
  g.restore();
  g.restore();
}

// ---- Syndicate troops -------------------------------------------------------------------------------------------------------
function trooper(g, e, t, pal, o = {}) {
  const run = e.run || 0, moving = Math.abs(e.vx) > 8, scale = o.scale || 1, ang = e.aimRel || 0;
  g.save(); g.translate(e.x, e.y); g.scale(e.face * scale, scale);
  const hurt = e.flash > 0;
  const ci = (c) => (hurt ? "#ffffff" : c);
  if (o.jet) {
    g.save(); g.translate(-13, -38); fillRR(g, -7, -12, 14, 26, 5, "#6f7aa8", OUT, 2); g.restore();
    const fl = 14 + Math.random() * 10; g.save(); g.globalCompositeOperation = "lighter"; poly(g, [[-18, -22], [-12, -22], [-15, -22 + fl * 1.4]], "#ffb703", null); poly(g, [[-16.5, -22], [-13.5, -22], [-15, -22 + fl]], "#fff6c4", null); g.restore();
  }
  // legs
  for (let i = 0; i < 2; i++) {
    const ph = run + (i ? Math.PI : 0), fx = moving ? Math.sin(ph) * 11 : i ? 5 : -5, fy = moving ? -Math.max(0, Math.cos(ph)) * 6 : 0;
    capsule(g, 0, -24, fx * 0.6, -12, 9, ci(pal.pants), OUT, 2.2); capsule(g, fx * 0.6, -12, fx, fy - 3, 8.5, ci(pal.pants), OUT, 2.2); fillRR(g, fx - 5, fy - 6, 14, 7, 3.5, "#191a3a", OUT, 2);
  }
  // torso + armour
  fillRR(g, -12, -52, 24, 30, 8, ci(pal.armor), OUT, 2.4);
  g.save(); rr(g, -12, -52, 24, 30, 8); g.clip(); g.fillStyle = ci(pal.armor2); g.fillRect(-12, -33, 24, 12); g.fillStyle = ci(pal.trim); g.fillRect(-12, -42, 24, 3); g.fillStyle = "rgba(255,255,255,.25)"; g.fillRect(-10, -50, 5, 26); g.restore();
  // helmet + visor
  const hb = o.sniper ? 0 : 0;
  circle(g, 2, -62 + hb, 12.5, ci(pal.armor), OUT, 2.4);
  g.save(); g.beginPath(); g.arc(2, -62 + hb, 12.5, 0, TAU); g.clip(); g.fillStyle = ci(pal.armor2); g.fillRect(-12, -62 + hb, 30, 20); g.restore();
  fillRR(g, 3, -66 + hb, 13, 8, 4, hurt ? "#fff" : pal.visor, OUT, 2); g.save(); g.globalCompositeOperation = "lighter"; glow(g, 10, -62 + hb, 16, pal.visor, 0.35); g.restore();
  if (o.hood) { poly(g, [[-12, -62], [-4, -78], [10, -70], [14, -60]], ci(pal.armor2), OUT, 2); }
  // arm + weapon
  g.save(); g.translate(4, -44); g.rotate(ang);
  capsule(g, 0, 0, 12, 0, 8, ci(pal.armor), OUT, 2.2);
  g.save(); g.translate(12, 0);
  if (o.sniper) { drawGun(g, "shotgun"); g.fillStyle = "#222"; g.fillRect(18, -6, 12, 3); }
  else if (o.club) { capsule(g, 0, 0, 22, -8, 6, "#8f95b8", OUT, 2); }
  else drawGun(g, o.gun || "smg");
  g.restore();
  if (e.flashT > 0) { g.save(); g.translate(46, 0); g.globalCompositeOperation = "lighter"; glow(g, 0, 0, 22, "#ffb36b", 0.9); g.restore(); }
  g.restore();
  g.restore();
}

function shieldPanel(g, e, t) {
  g.save(); g.translate(e.x, e.y); g.scale(e.face, 1);
  const hit = e.shieldHit > 0;
  g.globalAlpha = 0.85; rr(g, 16, -86, 12, 70, 6); g.fillStyle = hit ? "#ffffff" : "#5fe8ff"; g.fill(); g.globalAlpha = 1; g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
  g.fillStyle = "rgba(255,255,255,.55)"; g.fillRect(19, -82, 3, 34);
  if (hit) { g.save(); g.globalCompositeOperation = "lighter"; glow(g, 22, -50, 40, "#9ff6ff", 0.8); g.restore(); }
  g.restore();
}

export function drawEnemy(g, e, t, S) {
  const d = e.d;
  if (e.dead) { // falls over and fades
    const k = clamp(e.dead / 0.7, 0, 1); g.save(); g.globalAlpha = 1 - k; g.translate(e.x, e.y); g.rotate(e.face * k * 1.4); g.translate(-e.x, -e.y);
    if (e.ch === "d") drawDrone(g, e, t); else if (e.ch === "t") drawTurret(g, e, t); else if (e.ch === "b") drawBomber(g, e, t); else if (e.ch === "m") drawMech(g, e, t, S); else trooper(g, e, t, PAL.grunt);
    g.restore(); return;
  }
  switch (e.ch) {
    case "g": trooper(g, e, t, PAL.grunt, { gun: "smg" }); break;
    case "h": trooper(g, e, t, PAL.brute, { scale: 1.12, club: true }); shieldPanel(g, e, t); break;
    case "s": trooper(g, e, t, PAL.sniper, { sniper: true, hood: true }); break;
    case "j": trooper(g, e, t, PAL.jet, { jet: true, gun: "smg" }); break;
    case "d": drawDrone(g, e, t); break;
    case "t": drawTurret(g, e, t); break;
    case "b": drawBomber(g, e, t); break;
    case "m": drawMech(g, e, t, S); break;
    default: break;
  }
  if (e.hpShow > 0 && d.hp >= 10) { const w = 60, x = e.x - w / 2, y = e.y - e.h - 18; fillRR(g, x, y, w, 7, 3.5, "rgba(10,5,30,.8)", "rgba(255,255,255,.35)", 1); fillRR(g, x + 1, y + 1, (w - 2) * clamp(e.hp / e.max, 0, 1), 5, 2.5, "#ff5a7a"); }
}

function drawDrone(g, e, t) {
  const hurt = e.flash > 0, bob = Math.sin(t * 7 + e.ph) * 2; g.save(); g.translate(e.x, e.y - 14 + bob);
  g.rotate(clamp(e.vx * 0.0012, -0.3, 0.3));
  // rotors
  for (const sx of [-17, 17]) { g.fillStyle = "rgba(210,225,255,.6)"; const w = 20 * Math.abs(Math.cos(t * 40 + sx)) + 4; g.beginPath(); g.ellipse(sx, -13, w, 2.5, 0, 0, TAU); g.fill(); capsule(g, sx, -13, sx * 0.8, -4, 3, "#6c7497", OUT, 1.5); }
  ellipse(g, 0, 0, 20, 12, hurt ? "#fff" : "#7a6bd6", OUT, 2.5);
  g.save(); g.beginPath(); g.ellipse(0, 0, 20, 12, 0, 0, TAU); g.clip(); g.fillStyle = hurt ? "#fff" : "#4a3d9b"; g.fillRect(-22, 1, 44, 14); g.fillStyle = "rgba(255,255,255,.3)"; g.fillRect(-14, -9, 18, 4); g.restore();
  circle(g, 0, 0, 6.5, "#1a1030", OUT, 2); const pulse = 0.6 + 0.4 * Math.sin(t * 8 + e.ph); circle(g, 0, 0, 3.4, `rgba(255,70,90,${pulse})`); g.save(); g.globalCompositeOperation = "lighter"; glow(g, 0, 0, 20, "#ff3e5e", 0.5 * pulse); g.restore();
  fillRR(g, -6, 10, 12, 6, 3, "#6c7497", OUT, 2);
  g.restore();
}
function drawBomber(g, e, t) {
  const hurt = e.flash > 0, run = e.run || 0, arm = e.arm > 0; g.save(); g.translate(e.x, e.y); g.scale(e.face, 1);
  for (let i = 0; i < 2; i++) { const fx = Math.sin(run + i * Math.PI) * 9; capsule(g, i ? 4 : -4, -12, fx, -3, 5, "#6c7497", OUT, 2); }
  const bounce = Math.abs(Math.sin(run)) * 2; g.translate(0, -bounce);
  circle(g, 0, -22, 14, hurt ? "#fff" : arm ? "#ff6a6a" : "#ffb703", OUT, 2.6);
  g.fillStyle = "rgba(255,255,255,.35)"; g.beginPath(); g.ellipse(-4, -28, 6, 3.5, -0.5, 0, TAU); g.fill();
  fillRR(g, -5, -37, 10, 6, 2, "#6c7497", OUT, 2); const on = Math.floor(t * (arm ? 14 : 5)) % 2; circle(g, 0, -41, 3.2, on ? "#ff3e5e" : "#5a1020", OUT, 1.5);
  circle(g, 6, -23, 4.5, "#fff", OUT, 1.8); circle(g, 7, -23, 2, "#1a1030"); g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.moveTo(-2, -15); g.lineTo(9, -16); g.stroke();
  g.restore();
}
function drawTurret(g, e, t) {
  // a ceiling turret is drawn upside down from the top of its box; its aim angle is stored mirrored, so the same rotate() works for both
  const hurt = e.flash > 0; g.save(); g.translate(e.x, e.ceil ? e.y - e.h : e.y); if (e.ceil) g.scale(1, -1);
  fillRR(g, -17, -10, 34, 10, 4, "#4a4f78", OUT, 2.4);
  g.save(); g.translate(0, -12); g.rotate(e.aimRel);
  capsule(g, 0, 0, 30, 0, 9, hurt ? "#fff" : "#8e96c4", OUT, 2.4); fillRR(g, 24, -6, 12, 12, 3, "#4a4f78", OUT, 2); g.restore();
  g.beginPath(); g.arc(0, -12, 15, Math.PI, 0); g.closePath(); g.fillStyle = hurt ? "#fff" : "#7a6bd6"; g.fill(); g.lineWidth = 2.6; g.strokeStyle = OUT; g.stroke();
  circle(g, 0, -17, 4, "#ff3e5e", OUT, 1.5); g.save(); g.globalCompositeOperation = "lighter"; glow(g, 0, -17, 14, "#ff3e5e", 0.5); g.restore();
  g.restore();
}
function drawMech(g, e, t, S) {
  const hurt = e.flash > 0, step = e.run || 0; g.save(); g.translate(e.x, e.y); g.scale(e.face, 1);
  // legs
  for (let i = 0; i < 2; i++) { const ph = step + i * Math.PI, lx = (i ? 22 : -22) + Math.sin(ph) * 10, ly = -Math.max(0, Math.cos(ph)) * 10; capsule(g, i ? 20 : -20, -62, lx, -18 + ly, 16, hurt ? "#fff" : "#5a45b5", OUT, 3); fillRR(g, lx - 16, ly - 14, 40, 14, 5, "#2c2260", OUT, 3); }
  // body
  fillRR(g, -44, -108, 88, 54, 16, hurt ? "#fff" : "#6a52cc", OUT, 3.4);
  g.save(); rr(g, -44, -108, 88, 54, 16); g.clip(); g.fillStyle = "#3d2f94"; g.fillRect(-44, -76, 88, 24); g.fillStyle = "#ffb703"; g.fillRect(-44, -90, 88, 5); g.fillStyle = "rgba(255,255,255,.2)"; g.fillRect(-38, -104, 12, 48); g.restore();
  fillRR(g, 6, -100, 34, 18, 8, "#1a1030", OUT, 3); const pulse = 0.55 + 0.45 * Math.sin(t * 6); fillRR(g, 10, -96, 26, 10, 5, `rgba(255,80,110,${pulse})`);
  g.save(); g.globalCompositeOperation = "lighter"; glow(g, 22, -91, 42, "#ff3e5e", 0.4 * pulse); g.restore();
  // arms: gatling (front) and rocket pod (back)
  g.save(); g.translate(30, -66); g.rotate(e.aimRel || 0); fillRR(g, 0, -9, 52, 18, 6, "#8e96c4", OUT, 3); for (let k = 0; k < 3; k++) { g.fillStyle = "#2c2a55"; g.fillRect(40, -7 + k * 6, 16, 3); } if (e.flashT > 0) { g.save(); g.translate(60, 0); g.globalCompositeOperation = "lighter"; glow(g, 0, 0, 30, "#ffb36b", 0.9); g.restore(); } g.restore();
  fillRR(g, -52, -102, 22, 34, 6, "#3d2f94", OUT, 3); for (let k = 0; k < 3; k++) circle(g, -41, -96 + k * 10, 3.5, "#ff7a45", OUT, 1.5);
  g.restore();
}

// ---- projectiles ----------------------------------------------------------------------------------------------------------
export function drawProj(g, p, t) {
  g.save();
  switch (p.kind) {
    case "bullet": { const sp = Math.hypot(p.vx, p.vy) || 1, L = p.len || 16; g.globalCompositeOperation = "lighter"; line(g, p.x, p.y, p.x - (p.vx / sp) * L, p.y - (p.vy / sp) * L, rgba(p.color, 0.45), 6); line(g, p.x, p.y, p.x - (p.vx / sp) * L, p.y - (p.vy / sp) * L, p.color, 3); circle(g, p.x, p.y, 2.6, "#fff"); break; }
    case "laser": { const sp = Math.hypot(p.vx, p.vy) || 1, L = 34; g.globalCompositeOperation = "lighter"; line(g, p.x, p.y, p.x - (p.vx / sp) * L, p.y - (p.vy / sp) * L, "rgba(63,230,224,.4)", 10); line(g, p.x, p.y, p.x - (p.vx / sp) * L, p.y - (p.vy / sp) * L, "#c9fffb", 4); break; }
    case "pellet": { circle(g, p.x, p.y, 2.4, "#ffe9a8"); break; }
    case "rocket": { g.translate(p.x, p.y); g.rotate(Math.atan2(p.vy, p.vx)); g.globalCompositeOperation = "lighter"; poly(g, [[-8, -3], [-30 - Math.random() * 12, 0], [-8, 3]], "#ffb703", null); g.globalCompositeOperation = "source-over"; fillRR(g, -9, -4.5, 20, 9, 4, "#e8ecff", OUT, 2); poly(g, [[11, -4.5], [18, 0], [11, 4.5]], "#ff5a5a", OUT, 2); poly(g, [[-9, -4.5], [-14, -9], [-5, -4.5]], "#ff5a5a", OUT, 1.5); poly(g, [[-9, 4.5], [-14, 9], [-5, 4.5]], "#ff5a5a", OUT, 1.5); break; }
    case "grenade": { g.translate(p.x, p.y); g.rotate(p.rot || 0); circle(g, 0, 0, 7.5, "#6b7a4a", OUT, 2.4); fillRR(g, -3, -11, 6, 5, 2, "#c9cfe8", OUT, 1.8); const blink = Math.floor(t * 10) % 2; circle(g, 0, 0, 2.2, blink ? "#ff3e5e" : "#6a1a2a"); break; }
    case "ebullet": { g.globalCompositeOperation = "lighter"; glow(g, p.x, p.y, 14, p.color, 0.7); circle(g, p.x, p.y, 4.5, p.color); circle(g, p.x, p.y, 2.2, "#fff"); break; }
    case "snipe": { const sp = Math.hypot(p.vx, p.vy) || 1; g.globalCompositeOperation = "lighter"; line(g, p.x, p.y, p.x - (p.vx / sp) * 60, p.y - (p.vy / sp) * 60, "rgba(255,90,90,.5)", 7); line(g, p.x, p.y, p.x - (p.vx / sp) * 60, p.y - (p.vy / sp) * 60, "#fff", 3); break; }
    case "bomb": { g.translate(p.x, p.y); circle(g, 0, 0, 8, "#2c2a55", OUT, 2.4); circle(g, 0, -1, 2.6, Math.floor(t * 12) % 2 ? "#ff3e5e" : "#7a2030"); break; }
    case "fire": { const k = clamp(1 - p.life / p.max, 0, 1); g.globalCompositeOperation = "lighter"; glow(g, p.x, p.y, 26 + k * 16, "#ff7a2d", 0.8); circle(g, p.x, p.y, 8 + k * 8, "#ffb703"); circle(g, p.x, p.y, 4 + k * 3, "#fff3b8"); break; }
    case "bolt": { g.globalCompositeOperation = "lighter"; g.strokeStyle = "#e6e0ff"; g.lineWidth = 3; g.shadowColor = "#7c5cff"; g.shadowBlur = 12; g.beginPath(); g.moveTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04); for (let i = 1; i <= 4; i++) g.lineTo(p.x - p.vx * 0.04 * (1 - i / 4) + (Math.random() - 0.5) * 8, p.y - p.vy * 0.04 * (1 - i / 4) + (Math.random() - 0.5) * 8); g.stroke(); circle(g, p.x, p.y, 4, "#fff"); break; }
    default: circle(g, p.x, p.y, 3, "#fff");
  }
  g.restore();
}

// ---- pickups and props ------------------------------------------------------------------------------------------------------
export function drawItem(g, it, t) {
  const bob = Math.sin(t * 3 + it.ph) * 3, x = it.x, y = it.y + bob;
  g.save();
  const base = (c) => { g.save(); g.globalCompositeOperation = "lighter"; glow(g, x, y, 28, c, 0.4 + 0.15 * Math.sin(t * 4 + it.ph)); g.restore(); };
  switch (it.kind) {
    case "cash": { base("#ffd24a"); g.save(); g.translate(x, y); g.scale(Math.abs(Math.cos(t * 3 + it.ph)) * 0.7 + 0.3, 1); circle(g, 0, 0, 10, "#ffc233", OUT, 2.2); text(g, "$", 0, 5, { size: 14, color: "#8a5a00", align: "center", weight: 900 }); g.restore(); break; }
    case "med": { base("#ff6a8a"); fillRR(g, x - 13, y - 11, 26, 22, 6, "#fff", OUT, 2.4); g.fillStyle = "#ff3e5e"; g.fillRect(x - 3.5, y - 8, 7, 16); g.fillRect(x - 8, y - 3.5, 16, 7); break; }
    case "armor": { base("#6fb8ff"); g.translate(x, y); g.beginPath(); g.moveTo(-12, -11); g.lineTo(12, -11); g.lineTo(11, 3); g.quadraticCurveTo(0, 15, 0, 15); g.quadraticCurveTo(0, 15, -11, 3); g.closePath(); g.fillStyle = "#5aa9ff"; g.fill(); g.lineWidth = 2.4; g.strokeStyle = OUT; g.stroke(); g.fillStyle = "rgba(255,255,255,.55)"; g.fillRect(-8, -8, 5, 12); break; }
    case "ammo": { base("#ffd166"); fillRR(g, x - 14, y - 9, 28, 18, 4, "#6f7a5a", OUT, 2.4); g.fillStyle = "#ffd166"; for (let i = 0; i < 4; i++) g.fillRect(x - 10 + i * 6, y - 5, 3.5, 10); break; }
    case "gren": { base("#a8d86a"); for (let i = -1; i <= 1; i += 2) { circle(g, x + i * 7, y + 2, 7.5, "#6b7a4a", OUT, 2.2); fillRR(g, x + i * 7 - 2.5, y - 8, 5, 5, 2, "#c9cfe8", OUT, 1.5); } break; }
    case "rage": { base("#ff3e5e"); g.translate(x, y); g.rotate(t * 2); star(g, 0, 0, 13, "#ff5a7a", OUT, 2.4, 6, 0.55); circle(g, 0, 0, 4, "#fff"); break; }
    case "weapon": { base(it.color); fillRR(g, x - 20, y - 15, 40, 30, 7, "#262a52", it.color, 2.6); g.save(); g.translate(x - 9, y); g.scale(0.6, 0.6); drawGun(g, it.weapon); g.restore(); text(g, "NEW", x, y - 20, { size: 9, color: it.color, align: "center", font: FONT_PIXEL, weight: 400 }); break; }
    default: break;
  }
  g.restore();
}

export function drawBarrel(g, b, t) {
  g.save(); g.translate(b.x, b.y); const hurt = b.flash > 0;
  fillRR(g, -15, -42, 30, 42, 7, hurt ? "#fff" : "#e0463d", OUT, 2.6);
  g.save(); rr(g, -15, -42, 30, 42, 7); g.clip(); g.fillStyle = "#a82a2a"; g.fillRect(-15, -30, 30, 5); g.fillRect(-15, -12, 30, 5); g.fillStyle = "rgba(255,255,255,.3)"; g.fillRect(-12, -40, 5, 38); g.restore();
  poly(g, [[0, -29], [8, -14], [-8, -14]], "#ffd24a", OUT, 1.8); g.fillStyle = OUT; g.fillRect(-1, -24, 2, 6); g.fillRect(-1, -17, 2, 2);
  g.restore();
}

export function drawCitizen(g, c, t) {
  g.save(); g.translate(c.x, c.y); const wave = Math.sin(t * 8 + c.ph);
  if (c.saved) { g.globalAlpha = clamp(1 - c.savedT / 1.2, 0, 1); g.translate(c.savedT * 50 * c.dir, 0); }
  const run = c.saved ? t * 16 : 0;
  for (let i = 0; i < 2; i++) { const fx = c.saved ? Math.sin(run + i * Math.PI) * 8 : i ? 4 : -4; capsule(g, i ? 3 : -3, -20, fx, 0, 7, "#3a4a8a", OUT, 2); }
  fillRR(g, -12, -46, 24, 28, 9, "#54d08c", OUT, 2.4); g.fillStyle = "rgba(255,255,255,.3)"; g.fillRect(-9, -44, 5, 22);
  circle(g, 0, -58, 11, SK, OUT, 2.4); g.fillStyle = "#6a3a1a"; g.beginPath(); g.arc(0, -61, 11.5, Math.PI, 0); g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke();
  circle(g, -4, -57, 2.6, "#fff", OUT, 1.4); circle(g, 4, -57, 2.6, "#fff", OUT, 1.4); circle(g, -3.6, -56.6, 1.2, "#1a1030"); circle(g, 4.4, -56.6, 1.2, "#1a1030");
  g.strokeStyle = OUT; g.lineWidth = 1.8; g.beginPath(); g.arc(0, -52, 4, 0.2, Math.PI - 0.2); g.stroke();
  capsule(g, 9, -42, 19, -62 - wave * 6, 6, "#54d08c", OUT, 2); circle(g, 19, -64 - wave * 6, 4, SK, OUT, 1.6);
  capsule(g, -9, -42, -19, -56 + wave * 4, 6, "#54d08c", OUT, 2);
  if (!c.saved) { g.save(); g.translate(0, -88 + Math.sin(t * 4 + c.ph) * 3); poly(g, [[0, 0], [-7, -10], [7, -10]], "#ffe27a", OUT, 2); g.restore(); text(g, "HELP!", 0, -96 + Math.sin(t * 4 + c.ph) * 3 - 10, { size: 11, color: "#fff", align: "center", stroke: OUT, strokeW: 3, weight: 800 }); }
  g.restore();
}

export function drawCheckpoint(g, c, t) {
  g.save(); g.translate(c.x, c.y);
  fillRR(g, -9, -18, 18, 18, 4, "#4a4f78", OUT, 2.4); capsule(g, 0, -18, 0, -96, 6, "#8e96c4", OUT, 2.4); capsule(g, -14, -60, 14, -60, 4, "#8e96c4", OUT, 2); capsule(g, -10, -78, 10, -78, 4, "#8e96c4", OUT, 2);
  const on = c.on, col = on ? "#7dff6a" : "#ff5a5a"; circle(g, 0, -102, 7, col, OUT, 2); g.save(); g.globalCompositeOperation = "lighter"; glow(g, 0, -102, on ? 34 : 22, col, 0.5 + (on ? 0.2 * Math.sin(t * 6) : 0)); g.restore();
  if (on) { g.strokeStyle = "rgba(125,255,106,.5)"; g.lineWidth = 2; for (let i = 0; i < 3; i++) { const r = ((t * 30 + i * 14) % 42) + 6; g.globalAlpha = 1 - r / 48; g.beginPath(); g.arc(0, -102, r, -2.6, -0.5); g.stroke(); } }
  g.restore();
}

export function drawExit(g, x, y, t, open) {
  g.save(); g.translate(x, y);
  fillRR(g, -34, -104, 68, 104, 8, "#2c3263", OUT, 3); fillRR(g, -26, -96, 52, 96, 5, open ? "#1f9d6b" : "#6a2a3a", OUT, 2.4);
  g.save(); rr(g, -26, -96, 52, 96, 5); g.clip(); g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(-22, -92, 10, 90); g.restore();
  if (open) { g.save(); g.globalCompositeOperation = "lighter"; glow(g, 0, -50, 80, "#7dff6a", 0.35 + 0.1 * Math.sin(t * 4)); g.restore(); }
  fillRR(g, -30, -128, 60, 22, 6, "#0f0a2a", open ? "#7dff6a" : "#ff5a5a", 2.4); text(g, open ? "EXIT" : "LOCKED", 0, -112, { size: 13, color: open ? "#7dff6a" : "#ff8a8a", align: "center", font: FONT_PIXEL, weight: 400 });
  if (open) { const b = Math.sin(t * 5) * 4; poly(g, [[-12, -148 + b], [12, -148 + b], [0, -136 + b]], "#7dff6a", OUT, 2); }
  g.restore();
}

export function drawSpikes(g, map, cam, t) { /* spikes come from the tile painter */ }

// ---- HUD pieces -------------------------------------------------------------------------------------------------------------------
export function hudBar(g, x, y, w, h, t, fill, back = "rgba(14,6,36,.72)") {
  fillRR(g, x, y, w, h, h / 2, back, "rgba(190,180,255,.32)", 1.5); t = clamp(t, 0, 1);
  if (t > 0.002) { g.save(); rr(g, x + 1.5, y + 1.5, w - 3, h - 3, (h - 3) / 2); g.clip(); fillRR(g, x + 1.5, y + 1.5, (w - 3) * t, h - 3, (h - 3) / 2, fill); g.fillStyle = "rgba(255,255,255,.3)"; g.fillRect(x + 1.5, y + 1.5, (w - 3) * t, (h - 3) * 0.4); g.restore(); }
}
export function drawGunIcon(g, id, x, y, s = 1) { g.save(); g.translate(x, y); g.scale(s, s); drawGun(g, id); g.restore(); }
