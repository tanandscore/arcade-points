// Skyline Siege — how the Syndicate behaves. One small "brain" per kind of foe.
// Each brain is handed the session (S) and the foe (e); it moves the foe and decides when to shoot.
import { moveBody } from "../../core/platformer";
import { clamp, sign, TAU, lerp } from "../../core/util";
import { FX } from "../../core/fx";
import { TS, ENEMY } from "./defs";

const GRAV = 2100;

export function makeEnemy(S, ch, x, y, ph) {
  const d = ENEMY[ch], e = {
    ch, d, x, y, w: d.w, h: d.h, vx: 0, vy: 0, face: ph > 3 ? 1 : -1, hp: d.hp * S.info.hpMul, max: d.hp * S.info.hpMul, onGround: false, t: 0, ph, st: "idle", cd: 0.6 + (ph % 1.4),
    flash: 0, flashT: 0, run: 0, dead: 0, gone: false, awake: false, hx: x, hy: y, aimRel: 0, burst: 0, burstT: 0, shieldHit: 0, hpShow: 0, stun: 0, arm: 0, home: x,
  };
  if (d.flyer) { e.y = y - (ch === "j" ? 0 : 20); e.hy = e.y; }
  if (ch === "t") { // a turret hangs from the ceiling if there is a ceiling right above it, otherwise it stands on the floor
    const c = S.map.col(x), r = S.map.row(y - 8);
    if (S.map.isSolid(c, r - 1) && !S.map.isSolid(c, r + 1)) { e.ceil = true; e.y = r * TS + e.h; } else e.y = (r + 1) * TS;
    e.hy = e.y;
  }
  if (ch === "m") e.hp = e.max = d.hp * S.info.hpMul * 1.0;
  return e;
}

const aimAt = (e, tx, ty, ox, oy) => Math.atan2(ty - (e.y + oy), tx - (e.x + ox));

export function updateEnemy(S, e, dt) {
  const H = S.hero, map = S.map;
  e.t += dt; e.flash = Math.max(0, e.flash - dt); e.flashT = Math.max(0, e.flashT - dt); e.shieldHit = Math.max(0, e.shieldHit - dt); e.hpShow = Math.max(0, e.hpShow - dt); e.stun = Math.max(0, e.stun - dt);
  if (e.dead) { e.dead += dt; if (e.d.flyer) { e.vy += GRAV * dt; e.y += e.vy * dt; e.x += e.vx * dt * 0.5; } if (e.dead > 0.7) e.gone = true; return; }
  const dx = H.x - e.x, ady = Math.abs((H.y - 28) - (e.y - e.h / 2)), adx = Math.abs(dx), dir = sign(dx) || e.face;
  // wake up when the hero gets close; the sleepers do nothing (this also keeps the game fast)
  if (!e.awake) { const R = e.ch === "s" ? 780 : e.ch === "t" ? 680 : 640; if (adx < R && ady < 520 && !H.dead) e.awake = true; else { if (!e.d.flyer && e.ch !== "t") { e.vy += GRAV * dt; moveBody(map, e, dt); } return; } }
  else if (adx > 1500) { e.awake = false; return; }
  if (H.dead) { e.vx *= 0.9; if (!e.d.flyer && e.ch !== "t") { e.vy += GRAV * dt; moveBody(map, e, dt); } return; }
  const fm = S.fireMul;
  const shoot = (ox, oy, ang, speed, dmg, kind = "ebullet", color = "#ff5a7a", extra = {}) => S.eShot(e.x + e.face * ox, e.y - oy, ang, speed, dmg * S.info.dmgMul, kind, color, extra);
  switch (e.ch) {
    case "g": {
      const sees = adx < 520 && ady < 170 && S.los(e.x, e.y - 40, H.x, H.y - 30);
      if (e.stun > 0) { e.vx *= 0.88; } else if (sees) {
        e.face = dir; e.aimRel = clamp(aimAt(e, H.x, H.y - 30, 0, -44), -1.2, 1.2) * 1;
        const want = adx > 260 ? dir * e.d.speed * 1.1 : adx < 150 ? -dir * e.d.speed * 0.8 : 0;
        e.vx += (want - e.vx) * Math.min(1, 8 * dt);
        if (e.burst > 0) { e.burstT -= dt; if (e.burstT <= 0) { e.burst--; e.burstT = 0.13; const a = Math.atan2(H.y - 32 - (e.y - 44), H.x - e.x) + (Math.random() - 0.5) * 0.12; shoot(18, 44, a, 380, 8); e.flashT = 0.06; S.sfx.smg(); } }
        else { e.cd -= dt; if (e.cd <= 0) { e.burst = 3; e.burstT = 0.05; e.cd = (1.7 + Math.random() * 0.9) / fm; } }
      } else { // patrol
        e.aimRel = 0; if (e.t % 3.4 < 0.02) e.face = -e.face;
        const sp = e.d.speed * 0.55; e.vx += (e.face * sp - e.vx) * Math.min(1, 6 * dt);
        if (e.hitL || e.hitR || !S.groundAhead(e) || Math.abs(e.x - e.home) > 170) { e.face = e.x > e.home ? -1 : 1; if (e.hitL) e.face = 1; if (e.hitR) e.face = -1; e.vx = e.face * sp * 0.4; }
      }
      e.run += Math.abs(e.vx) * dt * 0.09; e.vy += GRAV * dt; moveBody(map, e, dt);
      if (e.onGround === false && e.vy > 900) e.vy = 900;
      break;
    }
    case "h": {
      e.face = dir; const near = adx < 62 && ady < 70;
      if (e.st === "bash") { e.vx *= 0.8; if (e.t > e.bashT + 0.3 && !e.bashed) { e.bashed = true; if (adx < 80 && ady < 80) { S.hurtHero(18 * S.info.dmgMul, e.x, "melee"); H.vx = dir * 340; H.vy = -260; S.sfx.punch(); FX.sparks(S.fx, e.x + dir * 36, e.y - 40, 8); } } if (e.t > e.bashT + 0.55) e.st = "idle"; }
      else if (e.st === "charge") { e.vx = dir * 150; if (e.t > e.chargeT + 0.7) { e.st = "idle"; e.cd = 2.2; } if (near) { e.st = "bash"; e.bashT = e.t; e.bashed = false; } }
      else {
        const sp = adx < 640 ? e.d.speed : 0; e.vx += (dir * sp - e.vx) * Math.min(1, 6 * dt);
        e.cd -= dt; if (near && e.t > (e.lastBash || 0) + 1.1) { e.st = "bash"; e.bashT = e.t; e.bashed = false; e.lastBash = e.t; } else if (e.cd <= 0 && adx > 200 && adx < 520) { e.st = "charge"; e.chargeT = e.t; e.cd = 3 + Math.random() * 2; S.sfx.alarm && S.sfx.alarm(); }
      }
      if (e.hitL || e.hitR) e.vx = 0;
      e.run += Math.abs(e.vx) * dt * 0.08; e.vy += GRAV * dt; moveBody(map, e, dt);
      break;
    }
    case "s": {
      e.face = dir; const sees = adx < 760 && ady < 420 && S.los(e.x, e.y - 44, H.x, H.y - 30);
      e.aimRel = clamp(aimAt(e, H.x, H.y - 30, 0, -44) * 1, -1.3, 1.3); if (e.face < 0) e.aimRel = clamp(Math.atan2(H.y - 30 - (e.y - 44), -(H.x - e.x)), -1.3, 1.3);
      if (e.face > 0) e.aimRel = clamp(Math.atan2(H.y - 30 - (e.y - 44), H.x - e.x), -1.3, 1.3);
      if (e.st === "idle") { e.cd -= dt; if (sees && e.cd <= 0) { e.st = "aim"; e.aimT = 0; e.lockX = H.x; e.lockY = H.y; S.sfx.alarm && S.sfx.alarm(); } }
      else if (e.st === "aim") {
        e.aimT += dt; if (e.aimT < 1.0 / Math.max(1, fm * 0.9)) { e.lockX = H.x; e.lockY = H.y - 30; } // the laser follows you, then locks
        if (!sees && e.aimT < 0.9) { e.st = "idle"; e.cd = 0.8; }
        if (e.aimT >= 1.35 / Math.max(1, fm * 0.9)) { const a = Math.atan2(e.lockY - (e.y - 46), e.lockX - e.x); S.eShot(e.x + Math.cos(a) * 30, e.y - 46 + Math.sin(a) * 30, a, 1150, 22 * S.info.dmgMul, "snipe", "#ff5a5a"); e.flashT = 0.08; S.sfx.shotgun(); e.st = "idle"; e.cd = 2.1 / fm; }
      }
      break;
    }
    case "d": {
      const tx = H.x + Math.sin(e.t * 0.7 + e.ph) * 230, ty = Math.min(e.hy, H.y - 170) + Math.sin(e.t * 1.8 + e.ph) * 26;
      e.vx += clamp(tx - e.x, -1, 1) * Math.min(Math.abs(tx - e.x) * 2.2, e.d.speed) * 6 * dt; e.vx *= 1 - 1.5 * dt; e.vy += clamp(ty - e.y, -1, 1) * Math.min(Math.abs(ty - e.y) * 3, 110) * 6 * dt; e.vy *= 1 - 2 * dt;
      e.x += e.vx * dt; e.y += e.vy * dt; e.face = dir; if (S.map.solidAtPx(e.x, e.y - 14)) { e.y -= 60 * dt; e.vx *= -0.5; }
      e.cd -= dt; e.aimRel = 0;
      if (e.cd <= 0 && adx < 560 && S.los(e.x, e.y, H.x, H.y - 30)) {
        if (adx < 70 && H.y > e.y + 40) { S.eShot(e.x, e.y, Math.PI / 2, 80, 16 * S.info.dmgMul, "bomb", "#2c2a55", { g: 700, boom: 70 }); e.cd = 2.8 / fm; }
        else { const a = Math.atan2(H.y - 30 - e.y, H.x - e.x); for (const da of [-0.07, 0.07]) S.eShot(e.x, e.y + 4, a + da, 340, 8 * S.info.dmgMul, "ebullet", "#ff5a7a"); S.sfx.laser(); e.cd = (2.1 + Math.random() * 0.6) / fm; }
      }
      if (adx < 30 && ady < 30) S.hurtHero(10 * S.info.dmgMul, e.x, "touch");
      break;
    }
    case "t": {
      e.face = dir; const sees = adx < 700 && S.los(e.x, e.y - e.h / 2, H.x, H.y - 30);
      const ox = 0, oy = e.ceil ? -(e.h - 12) : 12;
      let want = Math.atan2(H.y - 30 - (e.y - oy), H.x - e.x);
      if (e.ceil) want = Math.atan2(-(H.y - 30 - (e.y - e.h + 12)), H.x - e.x); // mirrored
      let cur = e.aimRel; let diff = want - cur; while (diff > Math.PI) diff -= TAU; while (diff < -Math.PI) diff += TAU;
      if (sees) { cur += clamp(diff, -2.4 * dt, 2.4 * dt); e.aimRel = cur; e.cd -= dt; }
      if (sees && e.cd <= 0 && Math.abs(diff) < 0.2) {
        const a = e.ceil ? -cur : cur, mx = e.x + Math.cos(a) * 34, my = (e.ceil ? e.y - e.h + 12 : e.y - 12) + Math.sin(a) * 34;
        S.eShot(mx, my, a, 380, 9 * S.info.dmgMul, "ebullet", "#ff7a2d"); e.flashT = 0.06; S.sfx.pistol(); e.cd = 1.25 / fm;
      }
      break;
    }
    case "b": {
      const sees = adx < 560 && ady < 200;
      if (e.stun <= 0 && sees) { e.face = dir; e.vx += (dir * e.d.speed - e.vx) * Math.min(1, 7 * dt); if (adx < 170) { if (!e.arm) S.sfx.alarm && S.sfx.alarm(); e.arm = 1; } }
      else e.vx *= 0.9;
      if ((e.hitL || e.hitR) && e.onGround) e.vy = -560;
      e.run += Math.abs(e.vx) * dt * 0.1; e.vy += GRAV * dt; moveBody(map, e, dt);
      if (adx < 44 && ady < 56) { S.killEnemy(e, "self"); }
      break;
    }
    case "j": {
      const tx = H.x - dir * 300 + Math.sin(e.t * 0.9 + e.ph) * 90, ty = H.y - 150 + Math.sin(e.t * 1.6 + e.ph) * 36;
      e.vx += clamp(tx - e.x, -1, 1) * Math.min(Math.abs(tx - e.x) * 2, e.d.speed * 1.4) * 6 * dt; e.vx *= 1 - 1.4 * dt; e.vy += clamp(ty - e.y, -1, 1) * Math.min(Math.abs(ty - e.y) * 2.5, 120) * 6 * dt; e.vy *= 1 - 2.2 * dt;
      const nx = e.x + e.vx * dt, ny = e.y + e.vy * dt; if (!S.map.solidAtPx(nx, ny - 30)) { e.x = nx; e.y = ny; } else { e.vx *= -0.5; e.vy *= -0.5; }
      e.face = dir; e.aimRel = clamp(Math.atan2(H.y - 30 - (e.y - 44), Math.abs(H.x - e.x)), -1.2, 1.2);
      if (e.burst > 0) { e.burstT -= dt; if (e.burstT <= 0) { e.burst--; e.burstT = 0.12; const a = Math.atan2(H.y - 32 - (e.y - 44), H.x - e.x) + (Math.random() - 0.5) * 0.1; shoot(18, 44, a, 390, 9); e.flashT = 0.06; S.sfx.smg(); } }
      else { e.cd -= dt; if (e.cd <= 0 && adx < 620 && S.los(e.x, e.y - 40, H.x, H.y - 30)) { e.burst = 3; e.burstT = 0.04; e.cd = (1.9 + Math.random()) / fm; } }
      if (Math.random() < 0.5) S.fx.emit({ x: e.x - e.face * 14, y: e.y - 20, vx: -e.face * 20, vy: 90, size: 3, life: 0.3, color: "#ffb703", g: 0, glow: true });
      break;
    }
    case "m": {
      e.face = dir; const sp = adx > 280 ? e.d.speed : adx < 180 ? -e.d.speed * 0.6 : 0; e.vx += (sp * dir - e.vx) * Math.min(1, 4 * dt);
      e.aimRel = clamp(Math.atan2(H.y - 30 - (e.y - 66), Math.abs(H.x - e.x)), -0.5, 0.9);
      if (e.hitL || e.hitR) e.vx = 0;
      e.cd -= dt;
      if (e.burst > 0) { e.burstT -= dt; if (e.burstT <= 0) { e.burst--; e.burstT = 0.075; const a = Math.atan2(H.y - 30 - (e.y - 66), H.x - e.x) + (Math.random() - 0.5) * 0.2; shoot(66, 66, a, 440, 7, "ebullet", "#ffb36b"); e.flashT = 0.05; S.sfx.smg(); } }
      else if (e.cd <= 0 && adx < 700) {
        e.mode = ((e.mode || 0) + 1) % 3;
        if (e.mode === 2) { // rocket lob
          const a = -Math.PI / 2 - 0.2 * e.face * 0 ; const spd = clamp(adx * 1.1 + 160, 300, 760), ang = Math.atan2(-0.9, dir * 0.5);
          S.eShot(e.x - dir * 30, e.y - 100, Math.atan2(-420 - adx * 0.35, dir * clamp(adx * 0.9, 200, 640)), Math.hypot(clamp(adx * 0.9, 200, 640), 420 + adx * 0.35), 25 * S.info.dmgMul, "bomb", "#2c2a55", { g: 900, boom: 80 }); S.sfx.rocket(); e.cd = 2.2 / fm;
        } else { e.burst = 12; e.burstT = 0.2; e.cd = 2.4 / fm; }
      }
      e.run += Math.abs(e.vx) * dt * 0.08; e.vy += GRAV * dt; moveBody(map, e, dt);
      break;
    }
    default: break;
  }
  // very simple contact damage so standing inside a foe hurts
  if (e.ch !== "d" && e.ch !== "t" && e.ch !== "s" && adx < (e.w + H.w) / 2 - 6 && H.y > e.y - e.h + 8 && H.y - H.h < e.y - 8) S.hurtHero(e.ch === "m" ? 20 : 10, e.x, "touch");
}
