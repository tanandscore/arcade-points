// Kiko Leap — one play-through of one level: the hero, enemies, pickups, platforms, camera and score.
import { clamp, lerp, sign, damp, TAU, hash2, rng, secondsLabel } from "../../core/util";
import { moveBody, touchingHazard, bodiesOverlap, HERO_DEFAULT, heroControl } from "../../core/platformer";
import { Particles, FX, Floaters, Camera, Juice } from "../../core/fx";
import { Backdrop } from "../../core/backdrop";
import { drawTiles } from "../../core/tiles";
import { text, fillRR, rr, ellipse, hudChip, hudHearts, bar, star, FONT_DISPLAY, FONT_PIXEL, FONT_BODY, OUT } from "../../core/draw";
import { sfx as realSfx } from "../../core/audio";
import * as A from "./art";
import * as BA from "./bossart";
import { TS, WORLDS, buildLevel, mapFrom, HINTS } from "./level";
import { makeBoss } from "./bosses";

export const P = { ...HERO_DEFAULT, maxRun: 250, jumpV: 760 };
export const SPRINT = 1.38, GLIDE_FALL = 90, GLIDE_MAX = 1.5, HW = 28, HH = 40;
// while floating the fall speed is eased down to a gentle drift (shared with the autopilot so both agree)
export const glideVy = (vy, dt) => (vy > GLIDE_FALL ? Math.max(GLIDE_FALL, vy - 6000 * dt) : vy);
const ENEMY = {
  g: { w: 34, h: 28, speed: 56, stomp: true, walker: true, pts: 100 },
  s: { w: 36, h: 24, speed: 44, stomp: false, walker: true, pts: 200 },
  b: { w: 28, h: 26, stomp: true, flyer: true, pts: 150 },
  h: { w: 30, h: 30, stomp: true, hopper: true, pts: 150 },
  t: { w: 30, h: 50, stomp: true, spitter: true, pts: 200 },
  a: { w: 28, h: 22, stomp: true, bat: true, pts: 150 },
  f: { w: 24, h: 28, stomp: false, fire: true, pts: 0 },
  k: { w: 52, h: 54, stomp: false, crusher: true, pts: 0 },
  w: { w: 56, h: 28, stomp: false, cloud: true, pts: 0 },
  x: { w: 22, h: 18, speed: 70, stomp: true, walker: true, pts: 100 },
};
const NOOP = new Proxy({}, { get: () => () => {} });

export class KikoSession {
  constructor(lv, ctx = {}, opts = {}) {
    this.lv = lv; this.ctx = ctx; this.quiet = !!opts.quiet; this.bot = opts.bot || null; this.camShift = opts.camShift || 0;
    this.sfx = this.quiet ? NOOP : realSfx;
    const info = buildLevel(lv); this.info = info; this.map = mapFrom(info); this.map.bump = {};
    const map = this.map;
    this.world = WORLDS[lv.wi]; this.isBoss = !!info.boss;
    this.cam = new Camera(960, 540); this.cam.setBounds(0, 0, map.w, map.h);
    this.fx = new Particles(900); this.fl = new Floaters(); this.juice = new Juice();
    this.bd = opts.headless ? null : new Backdrop(info.theme, (lv.wi + 1) * 10 + lv.li);
    this.t = 0; this.time = 0; this.score = 0; this.coins = 0; this.coinsTotal = 0; this.seeds = 0; this.deaths = 0; this.stompCount = 0; this.flawless = true;
    this.combo = 0; this.done = null; this.state = "play"; this.winT = 0; this.introT = 0; this.after_ = []; this.hintI = 0; this.hint = null; this.hintT = 0; this.finished = false;
    this.marks = []; this.items = []; this.enemies = []; this.projs = []; this.springs = []; this.platforms = []; this.checkpoints = []; this.goal = null; this.boss = null; this.start = { x: 100, y: 400 }; this.lastLand = 0;
    this.hearts = 3;
    const R = rng(lv.wi * 100 + lv.li);
    for (const e of map.ents) {
      const ph = R() * 6.28;
      switch (e.ch) {
        case "P": this.start = { x: e.x, y: e.y }; break;
        case "F": this.goal = { x: e.x, y: e.y, open: true }; break;
        case "C": this.checkpoints.push({ x: e.x, y: e.y, on: false }); break;
        case "c": this.items.push({ kind: "coin", x: e.x, y: e.y - 24, ph }); this.coinsTotal++; break;
        case "$": this.items.push({ kind: "seed", x: e.x, y: e.y - 26, ph }); break;
        case "H": this.items.push({ kind: "heart", x: e.x, y: e.y - 24, ph }); break;
        case "*": this.items.push({ kind: "power", x: e.x, y: e.y - 26, ph }); break;
        case "S": this.springs.push({ x: e.x, y: e.y, comp: 0, cd: 0 }); break;
        case "m": this.platforms.push({ kind: "m", x: e.x - 48, y: e.y, w: 96, h: 16, ox: e.x - 48, oy: e.y, ax: 2.6 * TS, ay: 0, sp: 1.05, ph, oneway: true, dx: 0, dy: 0 }); break;
        case "M": this.platforms.push({ kind: "M", x: e.x - 48, y: e.y, w: 96, h: 16, ox: e.x - 48, oy: e.y - 2.2 * TS, ax: 0, ay: 2.2 * TS, sp: 0.9, ph, oneway: true, dx: 0, dy: 0 }); break;
        case "d": this.platforms.push({ kind: "d", x: e.x - 48, y: e.y, w: 96, h: 16, ox: e.x - 48, oy: e.y, oneway: true, st: "idle", stT: 0, vy: 0, dx: 0, dy: 0 }); break;
        case "Z": this.bossSpawn = { x: e.x, y: e.y }; break;
        default: if (ENEMY[e.ch]) this.enemies.push(this.makeEnemy(e.ch, e.x, e.y, ph));
      }
    }
    if (this.isBoss && this.bossSpawn) this.boss = makeBoss(info.boss, this.bossSpawn, this);
    // arena limits for boss fights
    this.ax0 = TS, this.ax1 = map.w - TS;
    // the hero
    const H = (this.hero = { x: this.start.x, y: this.start.y, w: HW, h: HH, vx: 0, vy: 0, face: 1, onGround: true, hp: 3, inv: 0, stun: 0, dead: false, deadT: 0, glideT: 0, gliding: false, pound: 0, poundT: 0, power: 0, run: 0, stepT: 0, sprintLatch: false, prevY: this.start.y, spawnT: 0, dropT: 0, blink: 0, lastSafe: { x: this.start.x, y: this.start.y }, safeT: 0, sx: 1, sy: 1, landSq: 0, platform: null, coyoteT: 0, bufferT: 0 });
    this.checkpoint = { x: this.start.x, y: this.start.y };
    this.hints = (HINTS[lv.id] || []).map(([c, s]) => ({ x: c * TS, text: s, shown: false }));
    this.camX = 0; this.lookX = 0;
    this.cam.snap(H.x + this.camShift, H.y - 90); this.vignette = null;
    this.fx.clear();
  }

  makeEnemy(ch, x, y, ph) {
    const d = ENEMY[ch], e = { ch, x, y, w: d.w, h: d.h, vx: 0, vy: 0, face: ph > 3 ? 1 : -1, ph, t: 0, dead: 0, gone: false, onGround: false, st: "idle", cd: 1 + (ph % 2), hx: x, hy: y, base: y, d };
    if (d.bat) { // hang under the first solid tile above
      let r = this.map.row(y - 4); while (r > 0 && !this.map.isSolid(this.map.col(x), r)) r--; e.y = (r + 1) * TS + d.h + 2; e.hy = e.y; e.st = "sleep";
    }
    if (d.flyer) { e.y = y - 12; e.hy = e.y; }
    if (d.cloud) { e.y = y - 8; e.hy = e.y; }
    if (d.crusher) { e.rest = 58; e.y = e.rest; e.st = "rest"; e.cd = 0.5; }
    if (d.fire) { e.vis = false; e.cd = 0.4 + (ph % 2.2); }
    return e;
  }

  after(t, fn) { this.after_.push({ t, fn }); }
  mark(x, life = 0.8) { this.marks.push({ x, y: this.floorAt(x, 100) - 2, t: 0, life }); }
  spawnEnemy(ch, x, y) { const e = this.makeEnemy(ch, x, y, Math.random() * 6.28); e.face = x < this.hero.x ? 1 : -1; this.enemies.push(e); FX.pop(this.fx, x, y - 10, "#9a6bff", 8); return e; }
  floorAt(x, y0) { const c = this.map.col(x); for (let r = this.map.row(y0); r < this.map.rows; r++) { const ch = this.map.ch(c, r); if (this.map.solidSet.has(ch) || this.map.oneSet.has(ch)) return r * TS; } return this.map.h + 200; }
  addScore(n, x, y, color = "#ffe27a", size = 16) { this.score += n; if (x != null) this.fl.add(x, y, "+" + n, color, size); }

  // ============================================================ update ============================================================
  update(dt, input, env) {
    if (this.bot) { this.bot.think(this); input = this.bot.input; }
    this.input = input; this.t += dt;
    if (this.state !== "win") this.introT += dt;
    const sd = this.juice.step(dt); this.juice.update(dt);
    this.fx.update(dt); this.fl.update(dt); this.cam.update(dt);
    if (sd === 0) return;
    dt = sd;
    for (let i = this.after_.length - 1; i >= 0; i--) { const a = this.after_[i]; a.t -= dt; if (a.t <= 0) { this.after_.splice(i, 1); a.fn(); } }
    for (const k in this.map.bump) { this.map.bump[k] -= 90 * dt; if (this.map.bump[k] <= 0) delete this.map.bump[k]; }

    if (this.state === "win") { this.updateWin(dt); this.updateWorld(dt, true); this.updateCamera(dt); return; }
    this.time += dt;
    this.updateWorld(dt, false);
    this.updateHero(dt, input);
    this.updateHints(dt);
    this.updateCamera(dt);
  }

  // moving platforms, enemies, projectiles, pickups
  updateWorld(dt, winning) {
    const H = this.hero, map = this.map;
    for (const p of this.platforms) {
      const ox = p.x, oy = p.y;
      if (p.kind === "m") p.x = p.ox + Math.sin(this.t * p.sp + p.ph) * p.ax;
      else if (p.kind === "M") p.y = p.oy + Math.sin(this.t * p.sp + p.ph) * p.ay + p.ay;
      else if (p.kind === "d") {
        if (p.st === "idle" && H.platform === p) { p.st = "shake"; p.stT = 0; this.sfx.crackWood(); }
        if (p.st === "shake") { p.stT += dt; if (p.stT > 0.5) { p.st = "fall"; p.vy = 0; p.dead = true; this.sfx.crackStone(); FX.debris(this.fx, p.x + 48, p.y, ["#d8b48a", "#8f6a45"], 8, 0.6); } }
        else if (p.st === "fall") { p.vy += 1700 * dt; p.y += p.vy * dt; if (p.y > map.h + 120) { p.st = "gone"; p.stT = 0; } }
        else if (p.st === "gone") { p.stT += dt; if (p.stT > 2.6) { p.st = "idle"; p.x = p.ox; p.y = p.oy; p.dead = false; p.vy = 0; FX.sparkle(this.fx, p.x + 48, p.y); } }
      }
      p.dx = p.x - ox; p.dy = p.y - oy;
    }
    if (H.platform && !H.dead && (H.platform.dx || H.platform.dy) && !H.platform.dead) { H.x += H.platform.dx; H.y += H.platform.dy; }
    for (const s of this.springs) { s.comp = Math.max(0, s.comp - dt * 4); s.cd = Math.max(0, s.cd - dt); }
    const cx = this.cam.x + this.cam.w / 2;
    for (const e of this.enemies) { if (e.gone) continue; if (e.dead) { e.dead = Math.min(1, e.dead + dt * 6); e.deadT = (e.deadT || 0) + dt; if (e.deadT > 0.5) e.gone = true; continue; } if (Math.abs(e.x - cx) > 820 && !e.d.crusher) { continue; } this.updateEnemy(e, dt); }
    for (const m of this.marks) m.t += dt; this.marks = this.marks.filter((m) => m.t < m.life);
    for (const p of this.projs) this.updateProj(p, dt);
    this.projs = this.projs.filter((p) => !p.dead);
    if (this.boss) this.boss.update(dt, this);
    if (H.power > 0) { H.power -= dt; if (H.power <= 0) { H.power = 0; this.sfx.back(); } else if (Math.random() < 0.5) this.fx.emit({ x: H.x + (Math.random() - 0.5) * 24, y: H.y - Math.random() * 40, vx: (Math.random() - 0.5) * 30, vy: -30, size: 3, life: 0.5, color: A.rainbow(this.t * 2, Math.random() * 90), shape: "star", glow: true }); }
  }

  updateEnemy(e, dt) {
    const H = this.hero, map = this.map, d = e.d; e.t += dt;
    const dx = H.x - e.x;
    if (d.walker) {
      e.vx = e.face * d.speed; e.vy = Math.min(900, e.vy + 2300 * dt);
      moveBody(map, e, dt);
      const ahead = e.x + e.face * (e.w / 2 + 3), fr = map.row(e.y + 3), ch = map.ch(map.col(ahead), fr);
      const hasFloor = map.solidSet.has(ch) || map.oneSet.has(ch);
      if (e.hitL || e.hitR || (e.onGround && !hasFloor)) e.face = -e.face;
      if (e.fell) e.gone = true;
    } else if (d.flyer) {
      const k = this.t * 1.1 + e.ph; e.x = e.hx + Math.sin(k) * 2.6 * TS; e.y = e.hy + Math.sin(k * 2.1) * 10; e.face = Math.cos(k) >= 0 ? 1 : -1;
    } else if (d.hopper) {
      e.vy = Math.min(900, e.vy + 2300 * dt); e.vx *= e.onGround ? 0.8 : 1;
      moveBody(map, e, dt); e.cd -= dt; e.crouch = e.onGround && e.cd < 0.28;
      if (e.onGround && e.cd <= 0) { e.face = dx >= 0 ? 1 : -1; e.vy = -700; e.vx = e.face * 130; e.cd = 1.5 + (e.ph % 1); }
      if (e.fell) e.gone = true;
    } else if (d.spitter) {
      e.face = dx >= 0 ? 1 : -1; const near = Math.abs(dx) < 540 && Math.abs(H.y - e.y) < 200;
      if (near) { e.cd -= dt; e.charge = clamp(1 - e.cd / 0.55, 0, 1); if (e.cd <= 0) { e.cd = 2.1; e.charge = 0; this.fire(e.x + e.face * 14, e.y - 40, H.x, H.y - 22, 250, "seed"); this.sfx.pop(); } } else { e.cd = Math.max(e.cd, 0.6); e.charge = 0; }
    } else if (d.bat) {
      if (e.st === "sleep") { if (Math.abs(dx) < 240 && H.y > e.y - 40 && H.y < e.y + 360) { e.st = "dive"; e.stT = 0; e.face = dx >= 0 ? 1 : -1; e.ty = H.y - 18; this.sfx.whoosh(); } }
      else if (e.st === "dive") { e.stT += dt; e.x += e.face * 175 * dt; e.y = damp(e.y, e.ty, 3.2, dt); if (e.stT > 1.0) { e.st = "cruise"; e.stT = 0; } }
      else { e.stT += dt; e.x += e.face * 175 * dt; e.y -= 30 * dt; if (Math.abs(e.x - H.x) > 760 || e.stT > 6) e.gone = true; }
    } else if (d.fire) {
      e.cd -= dt;
      if (e.st === "idle" && e.cd <= 0) { e.st = "up"; e.vy = -780; e.vis = true; e.y = e.base - 2; this.fx.burst(e.x, e.base, 8, { speed: [60, 200], angle: [-Math.PI, 0], color: "#ffb02e", g: 700, size: [2, 4], glow: true }); this.sfx.whoosh(); }
      if (e.st === "up") { e.vy += 2300 * dt; e.y += e.vy * dt; if (e.y >= e.base && e.vy > 0) { e.y = e.base; e.st = "idle"; e.vis = false; e.cd = 1.8 + (e.ph % 1); this.fx.burst(e.x, e.base, 6, { speed: [40, 150], angle: [-Math.PI, 0], color: "#ff7a2a", g: 600, size: [2, 4], glow: true }); } }
    } else if (d.crusher) {
      const floor = this.floorAt(e.x, e.y + 8);
      if (e.st === "rest") { e.cd -= dt; if (e.cd <= 0 && Math.abs(H.x - e.x) < 70 && H.y > e.y + 30 && !H.dead) { e.st = "warn"; e.stT = 0; this.sfx.alarm(); } }
      else if (e.st === "warn") { e.stT += dt; e.warn = 1; if (e.stT > 0.5) { e.st = "slam"; e.vy = 0; e.warn = 0; } }
      else if (e.st === "slam") { e.vy = Math.min(1500, e.vy + 7000 * dt); e.y += e.vy * dt; if (e.y >= floor) { e.y = floor; e.st = "hold"; e.stT = 0; this.cam.shake(7, 0.25); this.sfx.crackStone(); FX.dust(this.fx, e.x - 20, e.y, 5); FX.dust(this.fx, e.x + 20, e.y, 5); FX.debris(this.fx, e.x, e.y, ["#9aa5c6", "#5d6788"], 6, 0.7); } }
      else if (e.st === "hold") { e.stT += dt; if (e.stT > 0.7) e.st = "rise"; }
      else if (e.st === "rise") { e.y -= 230 * dt; if (e.y <= e.rest) { e.y = e.rest; e.st = "rest"; e.cd = 0.8; } }
    } else if (d.cloud) {
      e.x = e.hx + Math.sin(this.t * 0.8 + e.ph) * 2.2 * TS; e.cd -= dt;
      if (e.st === "idle") { if (e.cd <= 0 && Math.abs(H.x - e.x) < 440 && !H.dead) { e.st = "warn"; e.stT = 0; e.sx = H.x; this.sfx.alarm(); } e.charge = 0; }
      else if (e.st === "warn") { e.stT += dt; e.charge = clamp(e.stT / 0.85, 0, 1); if (e.stT >= 0.85) { e.st = "strike"; e.stT = 0; e.charge = 1; this.sfx.explode(); this.cam.shake(4, 0.2); } }
      else if (e.st === "strike") { e.stT += dt; if (e.stT > 0.28) { e.st = "idle"; e.cd = 2.2; e.charge = 0; } }
    }
  }

  fire(x, y, tx, ty, speed, kind = "seed", r = 8) {
    const a = Math.atan2(ty - y, tx - x); this.projs.push({ kind, x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r, life: 4, g: 0, rot: 0 });
  }
  updateProj(p, dt) {
    p.life -= dt; if (p.life <= 0) { p.dead = true; return; }
    if (p.kind === "bolt") return; // lightning columns just wait for their timer
    p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 8;
    if (p.kind === "wave") { if (p.x < this.ax0 - 10 || p.x > this.ax1 + 10) p.dead = true; return; }
    if (p.kind === "web" && p.roll) { const f = this.floorAt(p.x, p.y - 20); p.y = f - p.r; if (p.x < this.ax0 + 6 || p.x > this.ax1 - 6) p.dead = true; return; }
    if (this.map.solidAtPx(p.x, p.y)) { p.dead = true; if (p.kind === "lava") this.lavaBurst(p); else if (p.kind === "rock") this.rockBreak(p); else FX.pop(this.fx, p.x, p.y, p.kind === "seed" ? "#ff7ac0" : "#fff", 6); }
    else if (p.kind === "rock" && p.y > this.floorAt(p.x, 0) - 4 && p.y > 0) { p.dead = true; this.rockBreak(p); }
    if (p.y > this.map.h + 100) p.dead = true;
  }
  lavaBurst(p) { FX.explosion(this.fx, p.x, p.y, 0.55); this.cam.shake(4, 0.2); this.sfx.explode(); const H = this.hero; if (!H.dead && Math.hypot(H.x - p.x, H.y - 20 - p.y) < 52) this.hurt(p.x); }
  rockBreak(p) { FX.debris(this.fx, p.x, p.y, ["#b79a78", "#6a5240", "#d8c4a6"], 10, 1); FX.dust(this.fx, p.x, p.y, 5); this.sfx.thudStone(); this.cam.shake(3, 0.15); }

  // ---------------------------------------------------------- the hero ----------------------------------------------------------
  updateHero(dt, input) {
    const H = this.hero, map = this.map;
    if (H.dead) { H.deadT += dt; if (H.deadT > 1.05) this.respawn(); return; }
    H.spawnT += dt; H.prevY = H.y;
    let dir = input.axis("left", "right");
    const jumpP = input.pressed("jump"), jumpH = input.held("jump"), downP = input.pressed("down"), downH = input.held("down");
    const touch = input.lastDevice === "touch";
    let sprint;
    if (touch) { if (input.pressed("fire")) H.sprintLatch = !H.sprintLatch; sprint = H.sprintLatch && dir !== 0; } else { sprint = input.held("fire"); H.sprintLatch = false; }
    if (H.stun > 0) { H.stun -= dt; dir = 0; }
    H.inv = Math.max(0, H.inv - dt);

    // ---- ground pound ----
    if (H.pound === 0 && !H.onGround && downP && H.stun <= 0) { H.pound = 1; H.poundT = 0; H.vx = 0; H.vy = 0; H.gliding = false; this.sfx.whoosh(); }
    if (H.pound === 1) { H.poundT += dt; H.vx = 0; H.vy = 0; if (H.poundT > 0.13) { H.pound = 2; H.vy = 1150; this.sfx.swing(); } }
    else if (H.pound === 2) { H.vy = 1150; H.vx = 0; }

    // ---- drop through planks ----
    let dropThrough = H.dropT > 0; H.dropT = Math.max(0, H.dropT - dt);
    if (H.onGround && downH && jumpP && H.pound === 0) { const c0 = map.col(H.x - 8), c1 = map.col(H.x + 8), r = map.row(H.y + 2); if (map.isOneWay(c0, r) || map.isOneWay(c1, r)) { H.dropT = 0.22; dropThrough = true; H.y += 3; } }
    const doJump = jumpP && !(H.onGround && downH);

    // ---- control + glide ----
    const ctrl = { speedMul: (sprint ? SPRINT : 1) * (H.power > 0 ? 1.1 : 1), jumpMul: sprint && Math.abs(H.vx) > 280 ? 1.05 : 1 };
    if (H.pound === 0) {
      const wasGround = H.onGround;
      if (!H.onGround && doJump && H.coyoteT <= 0 && H.vy > -160 && H.glideT < GLIDE_MAX && H.stun <= 0) { H.gliding = true; this.sfx.jump2(); FX.dust(this.fx, H.x, H.y - 30, 4, "rgba(200,255,220,.8)"); }
      const r = heroControl(H, { dir, jumpPressed: doJump, jumpHeld: jumpH }, dt, P, ctrl);
      if (r.jumped) { this.sfx.jump(); FX.dust(this.fx, H.x, H.y, 5); H.sy = 1.22; H.sx = 0.82; H.gliding = false; }
      if (H.gliding) {
        if (jumpH && !H.onGround && H.glideT < GLIDE_MAX) { H.glideT += dt; H.vy = glideVy(H.vy, dt); if (dir) H.vx += dir * 500 * dt; if (Math.random() < 0.3) this.fx.emit({ x: H.x - H.face * 8, y: H.y - 44, vx: -H.face * 20, vy: 20, size: 2.4, life: 0.35, color: "#c9ffd9", shape: "circle" }); }
        else H.gliding = false;
      }
    } else { H.coyoteT = 0; }

    const preVy = H.vy;
    moveBody(map, H, dt, { solids: this.activeSolids(), dropThrough, onTileBump: (c, r) => this.bumpTile(c, r) });
    // landing
    if (H.onGround) {
      if (!this.wasGround) { // just landed
        const fall = preVy;
        if (H.pound === 2) this.poundImpact();
        else if (fall > 380) { this.sfx.land(); FX.dust(this.fx, H.x - 8, H.y, 3); FX.dust(this.fx, H.x + 8, H.y, 3); H.sy = 0.78; H.sx = 1.2; }
        H.pound = 0; H.gliding = false; H.glideT = 0; this.combo = 0;
      }
      H.glideT = 0; H.gliding = false;
      H.stepT -= dt * Math.abs(H.vx) / 150; if (Math.abs(H.vx) > 60 && H.stepT <= 0) { H.stepT = 1; this.sfx.step(); if (Math.abs(H.vx) > 230) FX.dust(this.fx, H.x - H.face * 8, H.y, 1); }
      // remember safe ground (not on a crumbling platform, solid ground on both sides)
      H.safeT -= dt; if (H.safeT <= 0 && !(H.platform && H.platform.kind === "d")) { const r = map.row(H.y + 2), a = map.solidAtPx(H.x - 20, H.y + 3), b = map.solidAtPx(H.x + 20, H.y + 3); if ((a && b) || H.platform) { H.lastSafe = { x: H.x, y: H.y }; H.safeT = 0.3; } }
    }
    this.wasGround = H.onGround;
    if (H.vx > 8) H.face = 1; else if (H.vx < -8) H.face = -1;
    H.run += Math.abs(H.vx) * dt * 0.052; H.sx = damp(H.sx, 1, 14, dt); H.sy = damp(H.sy, 1, 14, dt);
    H.blink = (this.t % 3.4) < 0.12;

    // ---- things the hero touches ----
    this.touchSprings(dt, jumpH);
    this.touchItems();
    this.touchEnemies(jumpH);
    this.touchBoss(jumpH);
    this.touchProjectiles();
    this.touchCheckpoints();
    if (!H.dead && state_ok(this)) {
      const hz = touchingHazard(map, H, 8);
      if (hz) { const ch = map.ch(hz.c, hz.r); if (H.inv <= 0 && H.power <= 0) { this.hurt(H.x, ch === "L" ? "lava" : "spikes"); } else if (ch === "L" && H.power > 0) { /* star power walks on lava */ } }
      if (this.goal && Math.abs(H.x - this.goal.x) < 34 && H.y > this.goal.y - 200 && H.y < this.goal.y + 30 && this.goal.open) this.beginWin();
      if (H.fell || H.y > map.h + 140) this.fellOut();
    }
    // keep hero inside the level
    H.x = clamp(H.x, 20, map.w - 20);
  }
  activeSolids() { return this.platforms.filter((p) => !p.dead); }

  bumpTile(c, r) {
    const map = this.map, ch = map.ch(c, r), H = this.hero;
    if (ch === "B") { map.set(c, r, "."); FX.debris(this.fx, (c + 0.5) * TS, (r + 0.5) * TS, ["#e0845a", "#cf6c40", "#fff0d0"], 10, 1); this.sfx.breakblock(); this.addScore(20, (c + 0.5) * TS, r * TS, "#ffd9b0", 13); this.cam.shake(3, 0.12); this.killOnTop(c, r); }
    else if (ch === "?") { this.openBlock(c, r); }
    else if (ch === "X" || ch === "#") { this.sfx.bump(); }
  }
  openBlock(c, r) {
    const map = this.map; map.set(c, r, "u"); map.bump[c + "," + r] = 14; this.sfx.bump(); const x = (c + 0.5) * TS, y = r * TS, h = hash2(c, r, 3), H = this.hero;
    if (h < 0.18 && H.hp < 3) { this.items.push({ kind: "heart", x, y: y - 26, ph: 0, vy: -240, pop: true }); this.sfx.pickup(); }
    else if (h > 0.92) { this.items.push({ kind: "power", x, y: y - 26, ph: 0, vy: -260, pop: true }); this.sfx.pickup(); }
    else { for (let i = 0; i < 4; i++) this.after(i * 0.09, () => { this.coins++; this.addScore(10, x, y - 20 - i * 6, "#ffe27a", 14); this.sfx.coin(); FX.pop(this.fx, x, y - 24, "#ffd23a", 5); }); }
    this.killOnTop(c, r);
  }
  killOnTop(c, r) { for (const e of this.enemies) if (!e.dead && !e.gone && e.d.stomp && Math.abs(e.x - (c + 0.5) * TS) < 34 && Math.abs(e.y - r * TS) < 10) this.killEnemy(e, 0, false); }

  poundImpact() {
    const H = this.hero, map = this.map; this.cam.shake(9, 0.3); this.juice.hitstop(0.05); this.sfx.crackStone();
    FX.dust(this.fx, H.x - 14, H.y, 4); FX.dust(this.fx, H.x + 14, H.y, 4); this.fx.emit({ x: H.x, y: H.y, size: 10, life: 0.35, color: "#fff", shape: "ring", grow: 70 });
    H.sy = 0.7; H.sx = 1.3;
    const r = map.row(H.y + 2); for (let c = map.col(H.x - 16); c <= map.col(H.x + 16); c++) { const ch = map.ch(c, r); if (ch === "B") { map.set(c, r, "."); FX.debris(this.fx, (c + 0.5) * TS, (r + 0.5) * TS, ["#e0845a", "#cf6c40", "#fff0d0"], 10, 1); this.sfx.breakblock(); this.addScore(20, (c + 0.5) * TS, r * TS, "#ffd9b0", 13); } else if (ch === "?") this.openBlock(c, r); }
    for (const e of this.enemies) if (!e.dead && !e.gone && e.d.stomp !== undefined && !e.d.fire && !e.d.crusher && !e.d.cloud && Math.abs(e.x - H.x) < 96 && Math.abs(e.y - H.y) < 70) this.killEnemy(e, 0, true);
  }

  touchSprings(dt, jumpH) {
    const H = this.hero;
    for (const s of this.springs) {
      if (s.cd > 0) continue;
      if (Math.abs(H.x - s.x) < 26 && H.y > s.y - 34 && H.y < s.y + 8 && H.vy >= -60 && !H.dead) {
        s.comp = 1; s.cd = 0.25; H.vy = -(jumpH ? 1210 : 1060); H.onGround = false; H.coyoteT = 0; H.jumping = false; H.gliding = false; H.glideT = 0; H.pound = 0; H.sy = 1.3; H.sx = 0.8; this.sfx.spring(); FX.dust(this.fx, s.x, s.y, 6); this.fx.emit({ x: s.x, y: s.y - 20, size: 8, life: 0.3, color: "#ff7ac0", shape: "ring", grow: 40 });
      }
    }
  }
  touchItems() {
    const H = this.hero, cx = H.x, cy = H.y - 20;
    for (const it of this.items) {
      if (it.got) continue;
      if (it.vy != null) { it.vy += 900 * 0.016; it.y += it.vy * 0.016; if (it.vy > 0 && this.map.solidAtPx(it.x, it.y + 14)) { it.vy = null; it.y = Math.floor((it.y + 14) / TS) * TS - 14; } }
      const r = it.kind === "seed" || it.kind === "power" ? 30 : 24;
      if (Math.abs(it.x - cx) < r && Math.abs(it.y - cy) < r + 6) {
        it.got = true;
        if (it.kind === "coin") { this.coins++; this.addScore(10, it.x, it.y - 14, "#ffe27a", 14); this.sfx.coin(); FX.pop(this.fx, it.x, it.y, "#ffd23a", 6); }
        else if (it.kind === "seed") { this.seeds++; this.addScore(500, it.x, it.y - 20, "#c9b6ff", 22); this.sfx.gem(); this.sfx.star(); FX.pop(this.fx, it.x, it.y, "#b79bff", 16); this.fx.burst(it.x, it.y, 10, { shape: "star", color: "#fff6c4", speed: [60, 220], size: [3, 6], g: 200, glow: true }); this.juice.doFlash(0.18, "#c9b6ff"); this.fl.add(it.x, it.y - 46, `Star Seed ${this.seeds}/3`, "#fff", 15); }
        else if (it.kind === "heart") { if (H.hp < 3) { H.hp++; this.sfx.heal(); this.fl.add(it.x, it.y - 20, "+1 ♥", "#ff8fd0", 20); } else this.addScore(200, it.x, it.y - 14, "#ff8fd0"); FX.pop(this.fx, it.x, it.y, "#ff3ea5", 10); this.hearts = H.hp; }
        else if (it.kind === "power") { H.power = 8; this.sfx.powerup(); this.fl.add(it.x, it.y - 30, "STAR POWER!", "#fff", 20); FX.pop(this.fx, it.x, it.y, "#fff6c4", 18); this.juice.doFlash(0.25, "#fff6c4"); }
      }
    }
    this.items = this.items.filter((i) => !i.got);
  }

  killEnemy(e, combo = 1, pound = false) {
    if (e.dead) return; e.dead = 0.01; e.deadT = 0; this.stompCount++;
    const base = e.d.pts || 100; this.combo = combo ? this.combo + 1 : this.combo; const mult = Math.min(16, 1 << Math.max(0, this.combo - 1));
    this.addScore(base * (combo ? mult : 1), e.x, e.y - e.h - 8, mult > 1 ? "#ff9ad0" : "#ffe27a", 15 + Math.min(8, mult));
    if (combo && this.combo > 1) this.fl.add(e.x, e.y - e.h - 30, `COMBO x${this.combo}`, "#fff", 13);
    this.sfx.stomp(); FX.pop(this.fx, e.x, e.y - e.h / 2, e.ch === "g" ? "#7dff6a" : "#fff6c4", 8); this.juice.hitstop(0.035);
    if (e.ch === "x") this.fx.burst(e.x, e.y - 8, 6, { color: "#9a6bff", speed: [60, 200], g: 500, size: [2, 4] });
  }
  touchEnemies(jumpH) {
    const H = this.hero;
    for (const e of this.enemies) {
      if (e.dead || e.gone) continue;
      const d = e.d;
      if (d.fire) { if (e.vis && bodiesOverlap(H, { x: e.x, y: e.y, w: 20, h: 24 }, 4)) this.touchHarm(e); continue; }
      if (d.crusher) { const b = { x: e.x, y: e.y, w: 50, h: 52 }; if (bodiesOverlap(H, b, 5) && (e.st === "slam" || e.st === "hold" || e.st === "warn" || e.y > e.rest + 4)) this.touchHarm(e); continue; }
      if (d.cloud) { if (e.st === "strike") { const bx = e.sx; if (Math.abs(H.x - bx) < 20 + H.w / 2 && H.y > e.y - 10) this.touchHarm(e); } continue; }
      if (Math.abs(e.x - this.cam.x - this.cam.w / 2) > 700) continue;
      const bx = { x: e.x, y: e.y, w: e.w, h: e.h };
      if (!bodiesOverlap(H, bx, 3)) continue;
      const stomping = H.vy > 60 && H.prevY <= e.y - e.h + 16;
      if (H.power > 0) { this.killEnemy(e, 1, false); continue; }
      if (H.pound === 2 && stomping) { this.killEnemy(e, 1, true); H.vy = -520; H.pound = 0; continue; }
      if (stomping && d.stomp) { this.killEnemy(e, 1, false); H.vy = -(jumpH ? 740 : 480); H.jumping = jumpH; H.gliding = false; H.glideT = 0; H.onGround = false; H.sy = 1.2; H.sx = 0.85; continue; }
      this.touchHarm(e);
    }
  }
  touchHarm(e) { const H = this.hero; if (H.inv > 0 || H.power > 0 || H.dead) return; this.hurt(e.x); }

  touchBoss(jumpH) {
    const H = this.hero, b = this.boss; if (!b || b.dead || b.dying > 0 || H.dead) return;
    const hr = { x: H.x - H.w / 2, y: H.y - H.h, w: H.w, h: H.h };
    for (const hb of b.hitboxes()) {
      if (hr.x < hb.x + hb.w && hr.x + hr.w > hb.x && hr.y < hb.y + hb.h && hr.y + hr.h > hb.y) {
        const stomping = (H.vy > 40 || H.pound === 2) && H.prevY <= hb.y + 30;
        if (b.vulnerable && stomping && !(b.invT > 0)) { b.hit(this); H.vy = -(jumpH ? 800 : 620); H.pound = 0; H.jumping = jumpH; H.onGround = false; H.gliding = false; H.glideT = 0; H.sy = 1.2; H.sx = 0.85; return; }
        if (hb.harm && !b.vulnerable && H.inv <= 0) { if (H.power > 0) { if (!(b.invT > 0)) b.hit(this); } else this.hurt(hb.x + hb.w / 2); }
        else if (b.vulnerable && !stomping) { H.vx += sign(H.x - (hb.x + hb.w / 2)) * 40; }
      }
    }
  }
  touchProjectiles() {
    const H = this.hero; if (H.dead) return;
    for (const p of this.projs) {
      if (p.dead) continue;
      if (p.kind === "bolt") { if (p.armed && Math.abs(H.x - p.x) < 20 + H.w / 2) { if (H.inv <= 0 && H.power <= 0) this.hurt(p.x); } continue; }
      if (p.kind === "wave") { if (Math.abs(H.x - p.x) < 24 + H.w / 2 && H.y > p.y - 32 && H.y - H.h < p.y) { if (H.inv <= 0 && H.power <= 0) this.hurt(p.x); } continue; }
      if (Math.hypot(H.x - p.x, H.y - 20 - p.y) < p.r + 13) {
        if (p.kind === "lava") { p.dead = true; this.lavaBurst(p); continue; }
        if (H.pound === 2) continue;
        if (H.inv <= 0 && H.power <= 0) { this.hurt(p.x); } if (p.kind !== "web" || !p.roll) p.dead = true; FX.pop(this.fx, p.x, p.y, "#fff", 6);
      }
    }
  }
  touchCheckpoints() {
    const H = this.hero;
    for (const c of this.checkpoints) if (!c.on && Math.abs(H.x - c.x) < 40 && Math.abs(H.y - c.y) < 90) {
      c.on = true; this.checkpoint = { x: c.x, y: c.y }; this.sfx.checkpoint(); FX.pop(this.fx, c.x + 18, c.y - 60, "#ff3ea5", 14); FX.confetti(this.fx, c.x, c.y - 70, 14);
      if (H.hp < 3) { H.hp = 3; this.fl.add(c.x, c.y - 100, "Hearts refilled!", "#ff8fd0", 16); } else this.fl.add(c.x, c.y - 100, "Checkpoint!", "#fff", 16);
    }
  }

  // ---------------------------------------------------------- hurt, die, respawn, win ----------------------------------------------------------
  hurt(srcX, kind = "hit") {
    const H = this.hero; if (H.dead || H.inv > 0 || this.state === "win") return;
    H.hp -= 1; H.inv = 1.7; H.stun = 0.28; this.flawless = false; H.pound = 0; H.gliding = false; this.hearts = H.hp;
    const d = H.x >= srcX ? 1 : -1; H.vx = d * 230; H.vy = -430; H.onGround = false; H.jumping = false;
    this.sfx.hurt(); this.cam.shake(7, 0.25); this.juice.hitstop(0.07); this.juice.doFlash(0.25, "#ff3e5a");
    this.fx.burst(H.x, H.y - 20, 10, { color: "#7ff3ea", speed: [80, 260], g: 600, size: [2, 5] });
    if (H.hp <= 0) { this.die(); return; }
    if (kind === "lava") { H.x = H.lastSafe.x; H.y = H.lastSafe.y; H.vx = 0; H.vy = 0; this.cam.snap(H.x + this.camShift, H.y - 90); }
  }
  fellOut() {
    const H = this.hero; if (H.dead || this.state === "win") return;
    H.hp -= 1; this.flawless = false; this.hearts = H.hp; this.sfx.hurt(); this.cam.shake(6, 0.2);
    if (H.hp <= 0) { this.die(); return; }
    H.x = H.lastSafe.x; H.y = H.lastSafe.y; H.vx = 0; H.vy = 0; H.inv = 1.8; H.onGround = true; H.pound = 0; H.gliding = false; H.platform = null;
    this.cam.snap(H.x + this.camShift, H.y - 90); this.fl.add(H.x, H.y - 60, "-1 ♥", "#ff8fd0", 18); FX.sparkle(this.fx, H.x, H.y - 20);
  }
  die() {
    const H = this.hero; H.dead = true; H.deadT = 0; this.deaths++; this.score = Math.max(0, this.score - 150); this.combo = 0;
    this.sfx.die(); FX.explosion(this.fx, H.x, H.y - 20, 0.6); this.fx.burst(H.x, H.y - 20, 18, { color: "#7ff3ea", speed: [100, 340], g: 500, size: [3, 6], shape: "circle" });
    this.fl.add(H.x, H.y - 60, "-150", "#ff8fd0", 18); this.cam.shake(10, 0.35);
  }
  respawn() {
    const H = this.hero, cp = this.boss ? this.start : this.checkpoint;
    H.dead = false; H.hp = 3; this.hearts = 3; H.x = cp.x; H.y = cp.y; H.vx = 0; H.vy = 0; H.inv = 2.2; H.stun = 0; H.onGround = false; H.pound = 0; H.gliding = false; H.spawnT = 0; H.power = 0; H.platform = null; H.lastSafe = { x: cp.x, y: cp.y };
    this.cam.snap(H.x + this.camShift, H.y - 90); this.lookX = 0; FX.pop(this.fx, H.x, H.y - 20, "#7ff3ea", 12); this.sfx.checkpoint();
    for (const e of this.enemies) { if (e.gone || e.dead) continue; if (!this.boss && Math.abs(e.x - H.x) < 260) { /* nothing */ } }
    this.projs = this.projs.filter((p) => p.kind !== "bolt" && p.kind !== "wave");
  }
  beginWin() {
    if (this.state === "win") return; this.state = "win"; this.winT = 0; const H = this.hero; H.vx = 0; H.pound = 0; H.gliding = false; H.stun = 0; this.sfx.win();
    FX.confetti(this.fx, H.x, H.y - 60, 60); this.juice.doFlash(0.25, "#fff6c4"); if (this.goal) this.goal.open = false;
    if (this.bot) this.finished = true;
  }
  updateWin(dt) {
    const H = this.hero, map = this.map; this.winT += dt;
    H.vx = damp(H.vx, 0, 8, dt); H.vy = Math.min(900, H.vy + 2300 * dt);
    moveBody(map, H, dt, { solids: this.activeSolids() }); H.sx = damp(H.sx, 1, 14, dt); H.sy = damp(H.sy, 1, 14, dt); H.run += Math.abs(H.vx) * dt * 0.05; H.blink = false;
    if (H.onGround && this.winT > 0.35 && !H.cheer) { H.cheer = true; H.vy = -520; this.sfx.jump(); FX.confetti(this.fx, H.x, H.y - 40, 20); }
    if (H.onGround && H.cheer && this.winT > 1.1 && !H.cheer2) { H.cheer2 = true; H.vy = -420; this.sfx.jump(); }
    if (this.winT > 1.9 && !this.done) this.finish();
  }
  finish() {
    const H = this.hero, par = this.info.parTime || 75, time = Math.round(this.time * 10) / 10;
    const timeBonus = Math.max(0, Math.round((par - time) * 10)), heartsBonus = H.hp * 100, noHit = this.flawless ? 300 : 0, coinB = this.coinsTotal > 0 && this.coins >= this.coinsTotal ? 500 : 0, bossB = this.isBoss ? 2000 : 0;
    const total = Math.max(0, Math.round(this.score + timeBonus + heartsBonus + noHit + coinB + bossB));
    const second = this.isBoss ? this.flawless : this.seeds >= 3, third = time <= par;
    const stars = 1 + (second ? 1 : 0) + (third ? 1 : 0);
    const lines = [];
    if (!this.isBoss) { lines.push(["Coins", `${this.coins} / ${this.coinsTotal}${coinB ? "  +500" : ""}`]); lines.push(["Star Seeds ★", `${this.seeds} / 3`]); } else lines.push(["Boss defeated", "+2000"]);
    lines.push(["Time", `${secondsLabel(time)}  (par ${secondsLabel(par)})`]); lines.push(["Time bonus", `+${timeBonus}`]); lines.push(["Hearts left", `+${heartsBonus}`]);
    lines.push([this.isBoss ? "No-hit fight ★" : "No hits taken", noHit ? "+300" : "—"]);
    if (this.deaths) lines.push(["Falls & defeats", `-${this.deaths * 150}`]);
    this.done = { won: true, score: total, stars, lines, title: this.isBoss ? "BOSS DEFEATED!" : "LEVEL CLEAR!", sub: `${stars === 3 ? "Perfect run! " : ""}${this.lv.name}`, time, delay: 0.2, extra: { totalCoins: (this.ctx.save && this.ctx.save.extra && this.ctx.save.extra.totalCoins || 0) + this.coins } };
    this.finished = true;
  }

  updateHints(dt) {
    const H = this.hero; if (this.hint) { this.hintT -= dt; if (this.hintT <= 0) this.hint = null; }
    for (const h of this.hints) if (!h.shown && H.x > h.x) { h.shown = true; this.hint = h.text; this.hintT = 5.5; }
  }
  updateCamera(dt) {
    const H = this.hero, cam = this.cam;
    const look = clamp(H.vx / 260, -1, 1) * 90 + (this.camShift || 0); this.lookX = damp(this.lookX, look, 3, dt);
    if (this.boss) { cam.snap(this.map.w / 2, this.map.h / 2); return; }
    cam.follow(H.x + this.lookX, H.y - 95, dt, 6.5);
  }

  // ============================================================ drawing ============================================================
  draw(g, env) {
    const cam = this.cam, t = this.t, map = this.map, H = this.hero;
    this.bd.draw(g, cam.x, cam.y, t, 960, 540);
    cam.begin(g);
    drawTiles(g, map, cam, this.info.look, t);
    if (this.info.theme === "volcano") A.drawLava(g, map, cam, t);
    for (const c of this.checkpoints) if (cam.visible(c.x - 40, c.y - 100, 100, 110)) A.drawCheckpoint(g, c.x, c.y, c.on, t);
    if (this.goal && cam.visible(this.goal.x - 40, this.goal.y - 210, 160, 220)) A.drawGoal(g, this.goal.x, this.goal.y, t, this.goal.open);
    for (const s of this.springs) if (cam.visible(s.x - 30, s.y - 40, 60, 50)) A.drawSpring(g, s.x, s.y, s.comp, t);
    for (const p of this.platforms) if (!p.dead || p.st === "fall") { if (cam.visible(p.x, p.y - 20, p.w, 60)) A.drawPlatform(g, { ...p, shake: p.st === "shake" }, t); }
    for (const it of this.items) if (cam.visible(it.x - 40, it.y - 40, 80, 80)) {
      if (it.kind === "coin") A.drawCoin(g, it.x, it.y, t, it.ph); else if (it.kind === "seed") A.drawSeed(g, it.x, it.y, t, it.ph); else if (it.kind === "heart") A.drawHeartItem(g, it.x, it.y, t, it.ph); else A.drawPowerStar(g, it.x, it.y, t, it.ph);
    }
    // ground shadow for the hero
    if (!H.dead && H.spawnT > 0.1) { const fl = this.floorAt(H.x, H.y - 4); A.drawShadow(g, H.x, fl, fl - H.y); }
    for (const e of this.enemies) { if (e.gone) continue; if (!cam.visible(e.x - 70, e.y - 90, 140, 180)) continue; this.drawEnemy(g, e, t); }
    if (this.boss) this.drawBossAll(g, t);
    for (const m of this.marks) { const k = m.t / m.life; g.save(); g.globalAlpha = 0.35 + 0.4 * Math.abs(Math.sin(t * 18)); ellipse(g, m.x, m.y, 22 + 8 * (1 - k), 5, "#ffe27a"); g.globalAlpha = 0.9; text(g, "!", m.x, m.y - 10 - 8 * k, { size: 20, color: "#fff", align: "center", stroke: OUT, strokeW: 5, font: FONT_DISPLAY, weight: 800 }); g.restore(); }
    for (const p of this.projs) this.drawProj(g, p, t);
    if (!H.dead) this.drawHero(g, t);
    this.fx.draw(g); this.fl.draw(g);
    cam.end(g);
    this.drawOverlay(g);
  }
  drawHero(g, t) {
    const H = this.hero; let alpha = 1;
    if (H.inv > 0 && H.power <= 0 && H.spawnT > 0.05) alpha = Math.floor(t * 18) % 2 ? 0.35 : 1;
    const pop = clamp(H.spawnT / 0.35, 0, 1), s = H.spawnT < 0.35 ? 0.4 + 0.6 * (1 - Math.pow(1 - pop, 3)) : 1;
    A.drawKiko(g, { x: H.x, y: H.y, face: H.face, t, run: H.run, speed: H.onGround ? Math.abs(H.vx) / 250 : 0.2, air: !H.onGround, vy: H.vy, vx: H.vx, glide: H.gliding, pound: H.pound, blink: H.blink, power: H.power > 0, sx: H.sx * s, sy: H.sy * s, mood: H.stun > 0.05 ? "hurt" : H.pound === 2 ? "ouch" : "happy", alpha });
  }
  drawEnemy(g, e, t) {
    switch (e.ch) {
      case "g": A.drawGloop(g, e, t); break; case "s": A.drawSpikeback(g, e, t); break; case "b": A.drawBuzz(g, e, t); break; case "h": A.drawHopper(g, e, t); break; case "t": A.drawSpitter(g, e, t); break;
      case "a": A.drawBat(g, e, t); break; case "f": if (e.vis) A.drawFireling(g, e, t); break; case "k": A.drawCrusher(g, { ...e, y: e.y }, t); break; case "x": BA.drawSpiderling(g, e, t); break;
      case "w": A.drawCloudling(g, e, t);
        if (e.st === "warn" || e.st === "strike") { const f = this.floorAt(e.sx, e.y); if (e.st === "warn") { g.save(); g.globalAlpha = 0.35 + 0.35 * Math.sin(t * 30); ellipse(g, e.sx, f - 2, 24, 5, "#ffe27a"); g.restore(); } else A.drawBolt(g, e.sx, e.y, f, t, 1, 22); }
        break;
    }
  }
  drawBossAll(g, t) {
    const b = this.boss; b.draw(g, this, t);
  }
  drawProj(g, p, t) {
    switch (p.kind) {
      case "seed": BA.drawSeedShot(g, p.x, p.y, p.r, t); break; case "web": BA.drawWebBall(g, p.x, p.y, p.r, t); break; case "rock": BA.drawRock(g, p.x, p.y, p.r, p.rot); break;
      case "lava": BA.drawLavaBall(g, p.x, p.y, p.r, t); break; case "wave": BA.drawShockwave(g, p.x, p.y, Math.sign(p.vx) || 1, t); break;
      case "bolt": if (p.armed) A.drawBolt(g, p.x, 0, p.floor, t, clamp(p.life / 0.2, 0, 1), 26); else { g.save(); g.globalAlpha = 0.3 + 0.35 * Math.sin(t * 30); ellipse(g, p.x, p.floor - 2, 26, 6, "#ffe27a"); g.restore(); } break;
    }
  }

  drawOverlay(g) {
    const t = this.t, H = this.hero, cam = this.cam;
    // soft edge darkening
    if (!this.vignette) { const c = document.createElement("canvas"); c.width = 480; c.height = 270; const k = c.getContext("2d"); const gr = k.createRadialGradient(240, 135, 80, 240, 135, 300); gr.addColorStop(0, "rgba(10,4,30,0)"); gr.addColorStop(1, this.info.theme === "cave" ? "rgba(6,2,24,.62)" : "rgba(10,4,30,.34)"); k.fillStyle = gr; k.fillRect(0, 0, 480, 270); this.vignette = c; }
    g.drawImage(this.vignette, 0, 0, 960, 540);
    if (this.quiet) return;
    // HUD
    hudHearts(g, 30, 30, H.hp, 3, 11);
    const sy = 52; for (let i = 0; i < 3; i++) star(g, 24 + i * 24, sy + 8, 9, i < this.seeds ? "#b79bff" : "rgba(60,30,90,.8)", i < this.seeds ? OUT : "rgba(190,180,255,.4)", 2);
    hudChip(g, 140, 12, "COINS", this.coins, "#ffe27a", 104);
    hudChip(g, 668, 12, "SCORE", Math.round(this.score).toLocaleString(), "#fff", 118);
    hudChip(g, 792, 12, "TIME", secondsLabel(this.time), this.time > (this.info.parTime || 999) ? "#ff9ad0" : "#7ff3ea", 100);
    if (H.power > 0) { bar(g, 380, 22, 200, 10, H.power / 8, "#ffe27a"); text(g, "STAR POWER", 480, 48, { size: 10, color: "#fff6c4", align: "center", font: FONT_PIXEL, weight: 400 }); }
    if (this.combo > 1 && !H.onGround) text(g, `COMBO x${this.combo}`, 480, 86, { size: 20, color: "#ff9ad0", align: "center", stroke: OUT, font: FONT_DISPLAY, weight: 800 });
    if (this.boss && !this.boss.dead) { const b = this.boss; text(g, b.name.toUpperCase(), 480, 76, { size: 11, color: "#fff", align: "center", font: FONT_PIXEL, weight: 400, stroke: OUT, strokeW: 4 }); for (let i = 0; i < b.maxHp; i++) { fillRR(g, 480 - 78 + i * 54, 86, 48, 12, 6, i < b.hp ? "#ff3ea5" : "rgba(60,30,90,.8)", OUT, 2.5); } }
    // level banner
    if (this.introT < 2.8 && this.state === "play") {
      const k = this.introT, a = k < 0.4 ? k / 0.4 : k > 2.2 ? 1 - (k - 2.2) / 0.6 : 1, y = 150 - (1 - Math.min(1, k / 0.4)) * 30;
      g.save(); g.globalAlpha = clamp(a, 0, 1);
      text(g, `${this.world.name.toUpperCase()}  ·  ${this.lv.label}`, 480, y - 34, { size: 11, color: "#fff6c4", align: "center", font: FONT_PIXEL, weight: 400, stroke: OUT, strokeW: 4 });
      text(g, this.lv.name, 480, y + 10, { size: 46, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 800, stroke: OUT, strokeW: 8 });
      g.restore();
    }
    if (this.hint) { const a = clamp(Math.min(this.hintT, 0.4) / 0.4, 0, 1); g.save(); g.globalAlpha = a; const w = Math.min(760, 40 + this.hint.length * 9.2); fillRR(g, 480 - w / 2, 118, w, 44, 14, "rgba(14,6,36,.82)", "rgba(255,226,122,.7)", 2); text(g, this.hint, 480, 146, { size: 17, color: "#fff", align: "center", font: FONT_BODY, weight: 600 }); g.restore(); }
    if (this.state === "win") { const k = clamp(this.winT / 0.5, 0, 1); text(g, this.isBoss ? "BOSS DEFEATED!" : "LEVEL CLEAR!", 480, 200, { size: 58 * (0.7 + 0.3 * k), color: "#ffe27a", align: "center", stroke: OUT, strokeW: 9, font: FONT_DISPLAY, weight: 800, alpha: k }); }
    this.juice.draw(g, 960, 540);
  }
}
const state_ok = (S) => S.state === "play";
