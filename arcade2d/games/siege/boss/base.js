// Skyline Siege — what every boss shares: hit boxes, damage, phases, danger zones ("hazards") and a few drawing helpers.
// A boss is a small state machine: it waits, picks an attack, shows a warning, strikes, and then is open to damage for a moment.
import { clamp, TAU, rgba } from "../../../core/util";
import { FX } from "../../../core/fx";
import { ellipse, glow, OUT } from "../../../core/draw";
import { TS, FLOOR } from "../defs";
import { makeEnemy } from "../enemies";

export const FLOOR_Y = FLOOR * TS; // the street surface: 528
const hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export class Boss {
  constructor(S, spawn, o) {
    this.S = S; this.name = o.name; this.hp = this.max = o.hp; this.x = spawn.x; this.y = spawn.y; this.keepAway = o.keepAway ?? 380;
    this.hint = o.hint || "";
    this.x0 = S.arena.x0; this.x1 = S.arena.x1;                 // the arena: exactly one screen wide
    this.t = 0; this.flash = 0; this.phase = 1; this.phaseAt = o.phases || [];  // phaseAt: hp fractions where the next phase starts
    this.dead = false; this.deadT = 0; this.invuln = true;     // invulnerable during the intro
    this.st = "intro"; this.stT = 0; this.haz = []; this.numAcc = 0; this.numT = 0; this.minions = [];
  }

  go(st) { this.st = st; this.stT = 0; }

  // ---------------------------------------------------------------------------------------------------- the hit boxes
  boxes() { return []; }                                         // [{x,y,w,h,mul}] — first match wins, so list weak points first
  rects() { const b = this.boxes(); return b.length ? b : [{ x: this.x - 60, y: this.y - 120, w: 120, h: 120 }]; }
  aimPoint() { const b = this.boxes()[0]; return b ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : { x: this.x, y: this.y - 100 }; }
  hitTest(x, y, r) {
    if (this.dead || this.invuln) return null;
    for (const b of this.boxes()) if (x > b.x - r && x < b.x + b.w + r && y > b.y - r && y < b.y + b.h + r) return { mul: b.mul, box: b };
    return null;
  }
  damage(S, dmg, mul = 1, p = null, box = null) {
    if (this.dead || this.invuln) return;
    const v = dmg * mul;
    if (v <= 0.001) { S.sfx.impact(); this.deflect(S, p); return; }
    this.hp = Math.max(0, this.hp - v); this.hurtFx(S, v, mul);
    if (this.hp <= 0) this.die(S);
  }
  // the white flash and a tidy damage number (one every third of a second instead of one per bullet)
  hurtFx(S, v, mul) {
    this.flash = 0.07; this.onHit(S, v, mul); this.numAcc += v;
    if (this.t - this.numT > 0.33) { const pt = this.aimPoint(); S.fl.add(pt.x, pt.y - 40, Math.round(this.numAcc * 4), mul > 1.5 ? "#ffe27a" : "#ffffff", mul > 1.5 ? 20 : 15); this.numAcc = 0; this.numT = this.t; }
  }
  deflect(S, p) { if (p) FX.sparks(S.fx, p.x, p.y, 3, "#9ff6ff"); }
  onHit() {}
  // explosions: hurt the nearest part that is inside the blast
  splash(S, x, y, radius, dmg) {
    if (this.dead || this.invuln) return;
    let best = null, bd = 1e9;
    for (const b of this.boxes()) { const cx = clamp(x, b.x, b.x + b.w), cy = clamp(y, b.y, b.y + b.h), d = Math.hypot(x - cx, y - cy); if (d < radius && d < bd) { bd = d; best = b; } }
    if (best) this.damage(S, dmg * (1 - (bd / radius) * 0.4), Math.max(best.mul, best.mul > 0 ? 0.6 : 0), null, best);
  }
  die(S) {
    if (this.dead) return;
    this.dead = true; this.deadT = 0; this.hp = 0;
    this.haz = this.haz.filter((z) => z.keep);
    S.projs = S.projs.filter((p) => p.from === "hero");
    for (const e of S.enemies) if (e.minion && !e.dead) S.killEnemy(e, "self");
    this.onDeath(S);
    S.bossDefeated();
  }
  onDeath() {}
  // the fade-out the exit door needs: gone by the time the door opens
  fade() { return this.dead ? clamp(1 - (this.deadT - 0.9) / 1.3, 0, 1) : 1; }

  // ---------------------------------------------------------------------------------------------------- phases and helpers
  checkPhase(S) {
    while (this.phase <= this.phaseAt.length && this.hp <= this.max * this.phaseAt[this.phase - 1]) { this.phase++; this.enterPhase(S, this.phase); }
  }
  enterPhase(S) { S.cam.shake(9, 0.5); S.juice.doFlash(0.35, "#ffffff"); S.sfx.alarm(); }
  bonus(S, kind = "med") { S.items.push({ kind, x: this.x0 + 300 + Math.random() * 360, y: FLOOR_Y - 30, ph: Math.random() * 6 }); }
  dmgOf(S, n) { return n * S.info.dmgMul; }
  shoot(S, x, y, ang, speed, dmg, kind = "ebullet", color = "#ff5a7a", extra = {}) {
    S.eShot(x, y, ang, speed, dmg * S.info.dmgMul, kind, color, extra);
    const p = S.projs[S.projs.length - 1]; if (extra.life) { p.life = extra.life; p.max = extra.life; } if (extra.r) p.r = extra.r; return p;
  }
  spawnMinion(S, ch, x, y) {
    const e = makeEnemy(S, ch, x, y, Math.random() * 6); e.minion = true; e.awake = true; S.enemies.push(e); this.minions.push(e); FX.pop(S.fx, x, y, "#c9a8ff", 10); return e;
  }
  alive() { return this.minions.filter((e) => !e.dead && !e.gone).length; }

  // ---------------------------------------------------------------------------------------------------- hazards (danger zones)
  // kinds: "rect" {x,y,w,h}, "circle" {x,y,r}, "beam" {x,y,x2,y2,w}, "wave" (a rect that travels), "mark" (a warning only)
  addHaz(h) { const z = { kind: "rect", age: 0, delay: 0, life: 1, dmg: 14, hurt: "blast", ...h }; this.haz.push(z); return z; }
  updateHaz(S, dt) {
    const H = S.hero, hr = { x: H.x - H.w / 2 + 3, y: H.y - H.h + 5, w: H.w - 6, h: H.h - 8 };
    for (let i = this.haz.length - 1; i >= 0; i--) {
      const z = this.haz[i]; z.age += dt;
      if (z.age >= z.delay) { if (z.vx) z.x += z.vx * dt; if (z.vy) z.y += z.vy * dt; if (z.tick) z.tick(z, dt, this, S); }
      if (dt > 0) { z.estVx = z.lx == null ? 0 : (z.x - z.lx) / dt; z.lx = z.x; }
      const out = z.kind === "wave" && (z.x < this.x0 + 36 || z.x + z.w > this.x1 - 36);
      if (z.age > z.delay + z.life || out) { this.haz.splice(i, 1); if (z.end) z.end(z, this, S); continue; }
      if (this.dead || H.dead || z.age < z.delay || z.dmg <= 0) continue;
      if (this.touch(z, hr)) S.hurtHero(z.dmg * S.info.dmgMul, z.kind === "circle" || z.kind === "beam" ? z.x : z.x + (z.w || 0) / 2, z.hurt);
    }
  }
  touch(z, hr) {
    if (z.kind === "circle") { const cx = clamp(z.x, hr.x, hr.x + hr.w), cy = clamp(z.y, hr.y, hr.y + hr.h); return Math.hypot(z.x - cx, z.y - cy) < z.r; }
    if (z.kind === "beam") { // distance from the middle of the hero to the beam's line
      const px = hr.x + hr.w / 2, py = hr.y + hr.h / 2, dx = z.x2 - z.x, dy = z.y2 - z.y, l2 = dx * dx + dy * dy || 1, k = clamp(((px - z.x) * dx + (py - z.y) * dy) / l2, 0, 1);
      return Math.hypot(px - (z.x + dx * k), py - (z.y + dy * k)) < z.w / 2 + 14;
    }
    return hit(z, hr);
  }
  // things the boss throws that are not ordinary bullets (so the autopilot can see them too): [{x,y,vx,vy,g,r,dmg}]
  projectiles() { return []; }
  // for the autopilot (and for curious people): what is about to hurt, in simple terms
  threats() {
    const out = [];
    for (const z of this.haz) {
      if (z.kind === "mark") { if (z.warn && z.age < z.delay) out.push({ kind: "mark", x0: z.x - (z.r || 50), x1: z.x + (z.r || 50), vx: 0, left: z.delay - z.age, ground: true, tall: false, z }); continue; }
      if (z.dmg <= 0 && !z.always) continue;
      const left = Math.max(0, z.delay - z.age), x0 = z.kind === "circle" ? z.x - z.r : z.kind === "beam" ? Math.min(z.x, z.x2) : z.x, x1 = z.kind === "circle" ? z.x + z.r : z.kind === "beam" ? Math.max(z.x, z.x2) : z.x + (z.w || 0);
      out.push({ kind: z.kind, x0, x1, vx: z.vx || 0, left, ground: z.kind === "wave" || z.kind === "patch" || (z.kind === "circle" && z.y + z.r > FLOOR_Y - 90), tall: z.kind === "rect" && z.h > 200, z });
    }
    return out;
  }

  // ---------------------------------------------------------------------------------------------------- the per-frame update
  update(S, dt) {
    this.t += dt; this.stT += dt; this.flash = Math.max(0, this.flash - dt);
    if (this.dead) { this.deadT += dt; this.updateDead(S, dt); this.updateHaz(S, dt); return; }
    this.think(S, dt); this.updateHaz(S, dt); this.checkPhase(S);
  }
  think() {}
  updateDead() {}

  // ---------------------------------------------------------------------------------------------------- drawing
  draw(g, S, t) { this.drawBody(g, S, t); this.drawHaz(g, S, t); }
  drawBody() {}
  drawHaz(g, S, t) {
    for (const z of this.haz) {
      if (z.draw) { z.draw(g, z, t, this); continue; }
      const warn = z.age < z.delay;
      if (z.kind === "mark") { if (!warn) continue; groundMark(g, z.x, z.y ?? FLOOR_Y, z.r || 50, z.age / z.delay, t, z.color); }
      else if (z.kind === "wave") { if (!warn) drawWave(g, z, t); }
      else if (z.kind === "rect") { if (warn) { g.save(); g.globalAlpha = 0.18 + 0.12 * Math.sin(t * 30); g.fillStyle = "#ff3e5e"; g.fillRect(z.x, z.y, z.w, z.h); g.restore(); } else drawColumn(g, z, t); }
    }
  }
}

// ---- drawing helpers shared by the bosses -----------------------------------------------------------------------------------------
// a flattened ring on the floor: the "something lands here" warning. k (0..1) is how far the warning has come.
export function groundMark(g, x, y, r, k, t, color = "#ff4a6a") {
  g.save(); g.translate(x, y - 2); g.scale(1, 0.26);
  g.globalAlpha = 0.55 + 0.35 * Math.sin(t * 22);
  g.beginPath(); g.arc(0, 0, r, 0, TAU); g.lineWidth = 6; g.strokeStyle = color; g.stroke();
  g.globalAlpha = 0.28; g.beginPath(); g.arc(0, 0, r * clamp(k, 0, 1), 0, TAU); g.fillStyle = color; g.fill();
  g.restore();
}
// a travelling shock ridge along the floor
export function drawWave(g, z, t) {
  const dir = Math.sign(z.vx) || 1, cx = z.x + z.w / 2, base = z.y + z.h;
  g.save(); g.globalCompositeOperation = "lighter"; glow(g, cx, base - z.h * 0.4, z.w * 1.1, "#ffb36b", 0.55); g.restore();
  g.beginPath(); g.moveTo(z.x, base); g.lineTo(cx - dir * z.w * 0.25, base - z.h * 0.55); g.lineTo(cx + dir * z.w * 0.35, base - z.h); g.lineTo(z.x + z.w, base); g.closePath();
  g.fillStyle = "#ffe3a0"; g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
  g.fillStyle = "#ff8a3d"; g.beginPath(); g.moveTo(z.x + z.w * 0.2, base); g.lineTo(cx + dir * z.w * 0.2, base - z.h * 0.5); g.lineTo(z.x + z.w * 0.8, base); g.closePath(); g.fill();
}
// a bright vertical column (lightning, laser from the sky)
export function drawColumn(g, z, t) {
  const cx = z.x + z.w / 2, flick = 0.8 + 0.2 * Math.sin(t * 60);
  g.save(); g.globalCompositeOperation = "lighter";
  g.fillStyle = rgba(z.color || "#8e6bff", 0.45 * flick); g.fillRect(z.x - 8, z.y, z.w + 16, z.h);
  g.fillStyle = rgba(z.color2 || "#e6dcff", 0.9 * flick); g.fillRect(z.x + z.w * 0.18, z.y, z.w * 0.64, z.h);
  g.fillStyle = "#fff"; g.fillRect(cx - 3, z.y, 6, z.h);
  glow(g, cx, z.y + z.h, z.w * 1.6, z.color || "#8e6bff", 0.8);
  g.restore();
}
// a glowing beam between two points
export function drawBeam(g, z, t, warn) {
  g.save(); g.globalCompositeOperation = "lighter"; g.lineCap = "round";
  if (warn) { g.globalAlpha = 0.45 + 0.35 * Math.sin(t * 26); g.strokeStyle = z.color || "#ff5a9a"; g.lineWidth = 3; g.setLineDash([14, 10]); g.beginPath(); g.moveTo(z.x, z.y); g.lineTo(z.x2, z.y2); g.stroke(); }
  else { const w = z.w * (0.85 + 0.15 * Math.sin(t * 50)); g.strokeStyle = rgba(z.color || "#ff5a9a", 0.5); g.lineWidth = w * 1.9; g.beginPath(); g.moveTo(z.x, z.y); g.lineTo(z.x2, z.y2); g.stroke(); g.strokeStyle = "#fff4ff"; g.lineWidth = w * 0.6; g.stroke(); }
  g.restore();
}
// flames on the ground (a fire pool)
export function drawFlames(g, z, t, life = 1) {
  const n = Math.max(3, Math.round(z.w / 18)), base = z.y + z.h;
  g.save(); g.globalCompositeOperation = "lighter"; glow(g, z.x + z.w / 2, base - 10, z.w * 0.8, "#ff7a2d", 0.5 * life);
  for (let i = 0; i < n; i++) {
    const fx = z.x + ((i + 0.5) / n) * z.w, hgt = (22 + 18 * Math.abs(Math.sin(t * 9 + i * 1.7))) * life, w = z.w / n * 0.55;
    g.fillStyle = "#ff7a2d"; g.beginPath(); g.moveTo(fx - w, base); g.quadraticCurveTo(fx - w * 0.6, base - hgt * 0.6, fx + Math.sin(t * 12 + i) * 4, base - hgt); g.quadraticCurveTo(fx + w * 0.6, base - hgt * 0.6, fx + w, base); g.fill();
    g.fillStyle = "#ffe27a"; g.beginPath(); g.moveTo(fx - w * 0.5, base); g.quadraticCurveTo(fx, base - hgt * 0.7, fx + w * 0.5, base); g.fill();
  }
  g.restore();
}
export function shadow(g, x, y, rx, a = 0.3) { g.save(); g.globalAlpha = a; ellipse(g, x, y, rx, rx * 0.16, "#000"); g.restore(); }
