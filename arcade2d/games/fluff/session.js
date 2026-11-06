// Fluffapult — one play-through of one level: the world, the slingshot, the Fluffs, the Sprockets, damage, score and camera.
import { World } from "../../core/physics";
import { clamp, lerp, damp, TAU, rng, fmt } from "../../core/util";
import { Particles, FX, Floaters, Camera, Juice } from "../../core/fx";
import { Backdrop } from "../../core/backdrop";
import { text, fillRR, rr, ellipse, circle, star, bar, FONT_DISPLAY, FONT_PIXEL, FONT_BODY, OUT } from "../../core/draw";
import { sfx as realSfx } from "../../core/audio";
import { MATS, BIRDS, FOES, G, GROUND_Y, MAX_PULL, LAUNCH_K, HIT_MIN, BONUS_BIRD, hurt } from "./defs";
import { SLING_X, buildLevel, WORLDS } from "./levels";
import * as A from "./art";

const NOOP = new Proxy({}, { get: () => () => {} });
export const NO_INPUT = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false, inside: false }, pressed: () => false, held: () => false, released: () => false, axis: () => 0 };
const ANCHOR = { x: SLING_X + 8, y: GROUND_Y - 100 };
const GROUND_HIT = 0.7;   // falling onto the ground hurts a bit less than being smashed by something heavy
const SETTLE_SPEED = 26;

export class FluffSession {
  constructor(lv, ctx = {}, opts = {}) {
    this.lv = lv; this.ctx = ctx; this.quiet = !!opts.quiet || !!opts.headless; this.headless = !!opts.headless; this.sfx = this.quiet ? NOOP : realSfx;
    const info = buildLevel(lv.wi, lv.li); this.info = info; this.W = info.W; this.look = info.look;
    this.world = new World({ gravity: G }); this.world.onImpact = (a, b, imp, x, y, nx, ny, sp) => this.noteHit(a, b, imp, x, y, sp);
    this.hits = new Map(); this.seedN = 1;
    this.fx = this.headless ? NOOP : new Particles(500); this.fl = this.headless ? NOOP : new Floaters(); this.juice = new Juice(); this.cam = new Camera(960, 540);
    this.cam.setBounds(0, -480, this.W, 540);
    this.bd = this.headless ? null : new Backdrop(info.theme, (lv.wi + 1) * 10 + lv.li + 3);
    this.t = 0; this.time = 0; this.score = 0; this.blocksSmashed = 0; this.foesTotal = 0; this.foesLeft = 0; this.shots = 0;
    this.queue = info.birds.slice(); this.total = this.queue.length; this.cur = null; this.flying = []; this.eggs = []; this.hopper = null; this.snap = null;
    this.done = null; this.state = "intro"; this.stateT = 0; this.calmT = 0; this.sinceShot = 0; this.winT = 0; this.bonusI = 0; this.bonusT = 0; this.bonusScore = 0; this.userPan = false; this.pan = null;
    this.kb = { ang: 0.72, pow: 0.78, on: false }; this.pull = null; this.aimPt = { x: 700, y: 360 }; this.trailAcc = 0; this.hintT = 0; this.sfxCool = 0; this.lastShotScore = 0; this.shotLog = [];
    this.build(info);
    this.homeX = clamp(SLING_X - 150, 0, Math.max(0, this.W - 960));
    this.farX = Math.max(0, this.W - 960); this.cam.x = this.farX; this.cam.y = 0;
    // star targets: 3 stars = pop everything, smash most of the fort and still have some Fluffs left over
    const S = info.foes.reduce((s, f) => s + FOES[f.kind].pts, 0);
    let Bv = 0; for (const b of this.world.bodies) if (b.ud.t === "block") Bv += this.ptsFor(b.ud);
    this.maxFoeScore = S; this.maxBlockScore = Bv;
    const spare = this.total <= 3 ? 0.6 : this.total === 4 ? 1 : this.total <= 6 ? 2 : 3;
    const r100 = (n) => Math.round(n / 100) * 100;
    this.star3 = r100(S + Bv * 0.45 + spare * BONUS_BIRD); this.star2 = r100(S + Bv * 0.25 + Math.max(0, spare - 1) * BONUS_BIRD); this.par = this.star3;
    if (!opts.noIntro) { /* intro pan runs in update */ } else { this.state = "ready"; this.cam.x = this.homeX; this.loadBird(true); }
  }

  // ---------------------------------------------------------------------------------------------------------------- building
  build(info) {
    const W = this.world, ground = (x0, x1) => W.addBox({ x: (x0 + x1) / 2, y: GROUND_Y + 60, hw: (x1 - x0) / 2, hh: 60, static: true, friction: 0.75, restitution: 0.02, ud: { t: "ground", x0, x1 } });
    this.groundSegs = []; let x = -600;
    for (const [a, b] of [...info.pits].sort((p, q) => p[0] - q[0])) { if (a > x) this.groundSegs.push(ground(x, a)); x = b; }
    this.groundSegs.push(ground(x, this.W + 700));
    this.terrain = [];
    for (const t of info.terrain) { const b = W.addBox({ x: t.x, y: t.y, hw: t.w / 2, hh: t.h / 2, rot: t.rot || 0, static: true, friction: 0.75, restitution: 0.02, ud: { t: "terrain" } }); this.terrain.push({ ...t, body: b }); }
    for (const it of info.items) {
      const M = MATS[it.mat], seed = this.seedN++;
      if (it.k === "circle") {
        const hp = Math.round(Math.PI * it.r * it.r * M.hp * 0.9);
        W.addCircle({ x: it.x, y: it.y, r: it.r, density: M.density * 1.15, friction: 0.5, restitution: 0.1, ud: { t: "rock", mat: it.mat, r: it.r, hp, max: hp, seed, flash: 0 } });
      } else {
        const hp = Math.round(it.w * it.h * M.hp);
        W.addBox({ x: it.x, y: it.y, hw: it.w / 2, hh: it.h / 2, density: M.density, friction: M.friction, restitution: M.rest, ud: { t: "block", mat: it.mat, w: it.w, h: it.h, hp, max: hp, seed, flash: 0, cracked: 0 } });
      }
    }
    for (const f of info.foes) {
      const D = FOES[f.kind], seed = this.seedN++;
      W.addCircle({ x: f.x, y: f.y, r: D.r, density: D.d, friction: 0.55, restitution: 0.12, angDamp: 0.5, ud: { t: "foe", kind: f.kind, hp: D.hp, max: D.hp, seed, hurtT: 0, dead: false } });
      this.foesTotal++;
    }
    this.foesLeft = this.foesTotal;
    // let the fort settle quietly, then freeze it so nothing happens until the player touches it
    W.quiet = true; for (let i = 0; i < 90; i++) W.step(1 / 60); W.quiet = false;
    for (const b of W.bodies) if (!b.static) { b.vx = b.vy = b.av = 0; }
  }
  ptsFor(u) { const M = MATS[u.mat]; return Math.round((M.pts * clamp((u.w * u.h) / 1600, 0.4, 2.2)) / 10) * 10; }

  // ---------------------------------------------------------------------------------------------------------------- damage
  noteHit(a, b, imp, x, y, speed) {
    const ta = a.ud.t, tb = b.ud.t; if (ta === "bird" && tb === "bird") return;
    const key = a.id < b.id ? a.id * 4194304 + b.id : b.id * 4194304 + a.id, cur = this.hits.get(key);
    if (!cur || imp > cur.imp) this.hits.set(key, { a, b, imp, x, y, speed });
    // eggs go off the moment they touch anything
    if ((ta === "egg" && tb !== "bird") || (tb === "egg" && ta !== "bird")) { const e = ta === "egg" ? a : b; if (!e.ud.boom) e.ud.boom = true; }
    if (ta === "bird" || tb === "bird") { const bd = ta === "bird" ? a : b; if (bd.ud.fuse === undefined && bd.ud.type === "boomer" && speed > 80) bd.ud.fuse = 1.1; bd.ud.hitT = 0; }
  }
  applyHits() {
    let big = 0;
    for (const h of this.hits.values()) {
      const { a, b, imp, x, y } = h, ua = a.ud, ub = b.ud;
      if (a.dead || b.dead) continue;
      const aStatic = ua.t === "ground" || ua.t === "terrain", bStatic = ub.t === "ground" || ub.t === "terrain";
      this.hitFx(ua, ub, imp, x, y);
      if (imp > big) big = imp;
      this.damage(a, ua, b, ub, imp * (bStatic ? GROUND_HIT : 1), x, y);
      this.damage(b, ub, a, ua, imp * (aStatic ? GROUND_HIT : 1), x, y);
    }
    if (big > 5200) this.cam.shake(Math.min(7, big / 1400), 0.22);
    this.hits.clear();
  }
  damage(body, u, other, uo, imp, x, y) {
    if (u.t !== "block" && u.t !== "foe" && u.t !== "rock") return;
    const d = hurt(imp, u.t === "foe" ? HIT_MIN : HIT_MIN * 1.4); if (d <= 0) return;
    this.hurtBody(body, u, d, x, y);
  }
  hurtBody(body, u, d, x, y) {
    if (body.dead || u.dead) return;
    u.hp -= d; if (u.t === "foe") u.hurtT = 0.5; else u.flash = 0.18;
    if (u.t === "block" && !u.cracked && u.hp < u.max * 0.55 && u.hp > 0) { u.cracked = 1; this.sfx["crack" + (u.mat === "stone" ? "Stone" : "Wood")] && this.sfx["crack" + (u.mat === "stone" ? "Stone" : "Wood")](); }
    if (u.hp <= 0) this.destroy(body, u, x, y);
  }
  hitFx(ua, ub, imp, x, y) {
    if (imp < 500) return;
    const m = ua.mat || ub.mat || "wood";
    if (this.sfxCool <= 0 && imp > 900) {
      this.sfxCool = 0.06; const k = m === "stone" ? "thudStone" : m === "glass" ? "thudGlass" : m === "ice" ? "thudIce" : "thudWood"; this.sfx[k]();
    }
    if (imp > 1200) { const M = MATS[m] || MATS.wood; FX.dust(this.fx, x, y, 3, "rgba(255,250,240,.7)"); if (imp > 2600) this.fx.burst(x, y, 4, { speed: [60, 180], size: [2, 4], life: [0.3, 0.6], colors: M.deb, g: 700, shape: "square", vr: 14 }); }
  }
  destroy(body, u, x, y) {
    if (u.dead) return; u.dead = true; u.hp = 0;
    const cx = body.x, cy = body.y;
    if (u.t === "foe") {
      const D = FOES[u.kind]; this.addScore(D.pts, cx, cy - 20, "#fff6c4", 22); this.foesLeft--;
      this.sfx.pop(); this.fx.burst(cx, cy, 14, { speed: [90, 330], size: [3, 6], life: [0.4, 0.9], colors: ["#e6b24a", "#ffe9a8", "#a8701f", "#fff"], g: 800, shape: "circle", drag: 0.4 });
      this.fx.burst(cx, cy, 7, { speed: [60, 240], size: [4, 8], life: [0.5, 1.0], color: "#cbbf9a", g: 900, shape: "square", vr: 14 });
      this.fx.emit({ x: cx, y: cy, size: 8, life: 0.35, color: "#fff", shape: "ring", grow: 34 }); FX.smoke(this.fx, cx, cy, 14);
      this.juice.hitstop(0.05); this.cam.shake(4, 0.2);
      if (this.foesLeft <= 0) this.juice.slowmo(0.7, 0.4);
    } else if (u.t === "rock") {
      this.addScore(400, cx, cy - 10, "#e6e1ff", 16); this.sfx.crackStone(); FX.debris(this.fx, cx, cy, ["#c3c8de", "#9aa1c2", "#767ea3"], 12, 1.2); FX.dust(this.fx, cx, cy, 6);
    } else {
      const M = MATS[u.mat], pts = this.ptsFor(u); this.blocksSmashed++;
      this.addScore(pts, cx, cy - 10, "#ffffff", 15);
      const k = u.mat === "glass" ? "shatter" : u.mat === "ice" ? "shatter" : u.mat === "stone" ? "crackStone" : "crackWood"; this.sfx[k]();
      FX.debris(this.fx, cx, cy, M.deb, Math.round(clamp(u.w * u.h / 90, 6, 22)), u.mat === "glass" || u.mat === "ice" ? 1.1 : 1);
      FX.dust(this.fx, cx, cy, 4, u.mat === "ice" || u.mat === "glass" ? "rgba(230,250,255,.85)" : "rgba(235,225,255,.7)");
      if (M.explosive) { this.world.remove(body); this.explosion(cx, cy, 120, 760, 5200, "tnt"); return; }
    }
    this.world.remove(body);
  }
  addScore(n, x, y, color, size) { this.score += n; this.fl.add(x, y, "+" + fmt(n), color, size); }
  explosion(x, y, radius, power, dmgMax, who) {
    this.sfx.explode(); this.cam.shake(who === "tnt" ? 9 : 6, 0.3); this.juice.hitstop(0.04);
    FX.explosion(this.fx, x, y, radius / 90);
    const list = [];
    this.world.explode(x, y, radius, power, (b, k) => list.push([b, k]));
    for (const [b, k] of list) { const u = b.ud; if (u.t === "block" || u.t === "foe" || u.t === "rock") this.hurtBody(b, u, dmgMax * Math.pow(k, 1.15), x, y); }
  }

  // ---------------------------------------------------------------------------------------------------------------- birds
  slingTips() { const a = ANCHOR; return { L: { x: a.x - 20, y: a.y - 10 }, R: { x: a.x + 18, y: a.y - 8 } }; }
  loadBird(instant) {
    const type = this.queue.shift(); if (!type) { this.cur = null; return false; }
    this.cur = { type, x: ANCHOR.x, y: ANCHOR.y, rest: true };
    if (!instant) this.hopper = { type, t: 0, from: { x: SLING_X - 56, y: GROUND_Y - BIRDS[type].r }, to: { x: ANCHOR.x, y: ANCHOR.y } };
    this.state = "ready"; this.stateT = 0; this.pull = null; this.sinceShot = 0;
    return true;
  }
  // the bird shot from the sling: angle is where it flies (radians, 0 = right, positive = up), power 0..1
  fire(angle, power) {
    if (!this.cur || (this.state !== "ready" && this.state !== "aim")) return false;
    const s = clamp(power, 0.12, 1) * MAX_PULL, px = ANCHOR.x - Math.cos(angle) * s, py = ANCHOR.y + Math.sin(angle) * s;
    this.launch(px, py); return true;
  }
  launch(px, py) {
    const c = this.cur, B = BIRDS[c.type], vx = (ANCHOR.x - px) * LAUNCH_K, vy = (ANCHOR.y - py) * LAUNCH_K;
    const body = this.world.addCircle({ x: px, y: py, vx, vy, r: B.r, density: B.d, friction: 0.55, restitution: 0.25, linDamp: 0, angDamp: 0.3, group: 900 + this.shots, ud: { t: "bird", type: c.type, hitT: 99 } });
    const bird = { type: c.type, body, t: 0, idleT: 0, used: false, scale: 1, dead: false, group: 900 + this.shots, trailX: px, air: true, gravT: 0, fade: 1, fading: false };
    this.flying.push(bird); this.cur = null; this.shots++; this.state = "fly"; this.stateT = 0; this.calmT = 0; this.userPan = false; this.pull = null; this.lastShotScore = this.score;
    this.snap = { x: px, y: py, vx: 0, vy: 0 }; this.sfx.launch();
    this.shotLog.push({ type: c.type, vx, vy });
    return bird;
  }
  tap() { // use the power of the Fluff that is in the air
    for (const b of this.flying) if (!b.used && !b.dead && b.t > 0.08 && !b.fading && !b.child) { this.useAbility(b); return true; }
    return false;
  }
  useAbility(bird) {
    bird.used = true; const b = bird.body, B = BIRDS[bird.type], world = this.world;
    switch (B.ability) {
      case "puff": {
        const r0 = b.r, r1 = r0 * 1.55; b.r = r1; b.m *= 3.4; b.invM = 1 / b.m; b.I = 0.5 * b.m * r1 * r1; b.invI = 1 / b.I; world.refresh(b); world.wake(b);
        bird.scale = 1.55; this.sfx.pop(); this.fx.emit({ x: b.x, y: b.y, size: r1, life: 0.3, color: "#ffffff", shape: "ring", grow: 26 }); this.fx.burst(b.x, b.y, 8, { speed: [60, 160], size: [2, 4], life: [0.3, 0.6], color: B.belly, g: 200 }); break;
      }
      case "dash": {
        const sp = Math.hypot(b.vx, b.vy) || 1, k = Math.max(1750, sp * 1.45) / sp; b.vx *= k; b.vy *= k; b.gravityScale = 0.12; bird.gravT = 0.5; this.sfx.whoosh();
        this.fx.burst(b.x, b.y, 10, { speed: [80, 260], angle: [Math.atan2(-b.vy, -b.vx) - 0.5, Math.atan2(-b.vy, -b.vx) + 0.5], size: [2, 4], life: [0.2, 0.45], color: "#c9fffb", g: 0, shape: "spark", glow: true }); break;
      }
      case "boom": this.boomBird(bird); break;
      case "split": {
        const sp = Math.hypot(b.vx, b.vy) || 1, base = Math.atan2(b.vy, b.vx); this.sfx.pop();
        for (const da of [-0.3, 0.3]) {
          const a = base + da, cb = world.addCircle({ x: b.x, y: b.y + da * 14, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: B.r * 0.78, density: B.d, friction: 0.55, restitution: 0.25, linDamp: 0, angDamp: 0.3, group: bird.group, ud: { t: "bird", type: "trio", hitT: 99, child: true } });
          this.flying.push({ type: "trio", body: cb, t: 0.2, idleT: 0, used: true, scale: 0.78, dead: false, group: bird.group, trailX: b.x, air: true, gravT: 0, fade: 1, fading: false, child: true });
        }
        // the main one tilts up a little so the three spread
        const a0 = base + 0.0; b.vx = Math.cos(a0) * sp; b.vy = Math.sin(a0) * sp; this.fx.emit({ x: b.x, y: b.y, size: 8, life: 0.25, color: "#ffffff", shape: "ring", grow: 22 }); break;
      }
      case "drop": {
        const egg = world.addCircle({ x: b.x, y: b.y + b.r + 4, vx: b.vx * 0.25, vy: 520, r: 9, density: 3.2, friction: 0.4, restitution: 0.05, linDamp: 0, group: bird.group, ud: { t: "egg", boom: false } });
        this.eggs.push({ body: egg, t: 0 }); b.vx = Math.max(b.vx * 1.25, 380); b.vy = -380; this.sfx.whoosh(); this.fx.burst(b.x, b.y, 6, { speed: [40, 120], size: [3, 5], life: [0.3, 0.6], color: "#ffffff", g: 100, shape: "smoke" }); break;
      }
      case "dive": {
        b.vx *= 0.12; b.vy = Math.max(b.vy, 0) + 1500; bird.diving = true; this.sfx.whoosh(); this.cam.shake(2, 0.15); break;
      }
      default: break;
    }
  }
  boomBird(bird) {
    if (bird.dead) return; const b = bird.body; bird.dead = true;
    this.explosion(b.x, b.y, 130, 760, 4600, "boomer"); this.world.remove(b);
  }

  // ---------------------------------------------------------------------------------------------------------------- update
  update(dt, input = NO_INPUT, env = {}) {
    const dts = this.juice.step(dt); this.t += dt; this.stateT += dt; this.sfxCool -= dt;
    if (!this.done) this.time += dt;
    this.handleInput(dt, input);
    if (dts > 0 && this.state !== "intro") { this.world.step(Math.min(dts, 1 / 30)); this.applyHits(); this.afterPhysics(dts); }
    this.fx.update(dts); this.fl.update(dts); this.juice.update(dt); this.cam.update(dt);
    this.updateCamera(dt, input);
    this.updateFlow(dt);
  }

  handleInput(dt, input) {
    const P = input.pointer, cam = this.cam;
    const tapped = P.pressed || input.pressed("jump") || input.pressed("fire") || input.pressed("confirm");
    if (this.state === "intro") { if (tapped || this.stateT > 2.4) { this.state = "ready"; this.stateT = 0; this.loadBird(true); } return; }
    if (this.state === "fly" || this.state === "settle") { if (tapped && this.state === "fly") this.tap(); }
    if (this.state === "ready" || this.state === "aim") {
      const wp = cam.toWorld(P.x, P.y);
      if (this.state === "ready" && this.cur && !this.hopper) {
        if (P.pressed && Math.hypot(wp.x - ANCHOR.x, wp.y - ANCHOR.y) < 96) { this.state = "aim"; this.kb.on = false; this.sfx.stretch(); }
        else if (P.pressed) { this.pan = { px: P.x, cx: cam.x }; }
        else if (input.held("left") || input.held("right") || input.held("up") || input.held("down")) { this.state = "aim"; this.kb.on = true; }
      }
      if (this.pan) { if (P.down) { cam.x = clamp(this.pan.cx - (P.x - this.pan.px), 0, Math.max(0, this.W - 960)); this.userPan = true; } else this.pan = null; }
      if (this.state === "aim" && this.cur) {
        if (this.kb.on) {
          this.kb.ang = clamp(this.kb.ang + input.axis("down", "up") * 0.85 * dt, 0.05, 1.5); this.kb.pow = clamp(this.kb.pow + input.axis("left", "right") * 0.55 * dt, 0.12, 1);
          const s = this.kb.pow * MAX_PULL; this.pull = { x: ANCHOR.x - Math.cos(this.kb.ang) * s, y: ANCHOR.y + Math.sin(this.kb.ang) * s };
          if (input.pressed("jump") || input.pressed("fire") || input.pressed("confirm")) { this.launch(this.pull.x, this.pull.y); }
          else if (P.pressed) { this.kb.on = false; }
        } else {
          const dx = wp.x - ANCHOR.x, dy = wp.y - ANCHOR.y, d = Math.hypot(dx, dy), k = d > MAX_PULL ? MAX_PULL / d : 1;
          let px = ANCHOR.x + dx * k, py = ANCHOR.y + dy * k; const B = BIRDS[this.cur.type]; py = Math.min(py, GROUND_Y - B.r - 2);
          this.pull = { x: px, y: py };
          if (!P.down) {
            const s = Math.hypot(px - ANCHOR.x, py - ANCHOR.y);
            if (s < 14) { this.state = "ready"; this.pull = null; } else this.launch(px, py);
          }
        }
        if (this.state === "aim" && this.pull && !this.kb.on) { const s = Math.hypot(this.pull.x - this.cur.x, this.pull.y - this.cur.y); if (s > 3) { this.stretchSnd = (this.stretchSnd || 0) + dt; if (this.stretchSnd > 0.16) { this.stretchSnd = 0; this.sfx.stretch(); } } }
      }
    }
  }

  afterPhysics(dt) {
    const W = this.world, bodies = W.bodies;
    // birds
    let anyBirdMoving = false;
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const bd = this.flying[i], b = bd.body; if (bd.dead || b.dead) { this.flying.splice(i, 1); continue; }
      bd.t += dt; b.ud.hitT += dt;
      if (bd.gravT > 0) { bd.gravT -= dt; if (bd.gravT <= 0) b.gravityScale = 1; }
      const touching = W.touching(b) > 0; bd.air = !touching; b.linDamp = touching ? 1.9 : 0; b.angDamp = touching ? 2.2 : 0.3;
      const sp = Math.hypot(b.vx, b.vy);
      if (bd.type === "boomer" && b.ud.fuse !== undefined) { b.ud.fuse -= dt; if (b.ud.fuse <= 0) { this.boomBird(bd); continue; } }
      if (bd.diving && touching && b.ud.hitT < 0.1 && sp < 800) bd.diving = false;
      // trail puffs
      if (bd.air && bd.t < 3) { const dx = b.x - bd.trailX; if (Math.abs(dx) > 26) { bd.trailX = b.x; this.fx.emit({ x: b.x, y: b.y, size: 3.4, life: 0.55, color: "rgba(255,255,255,.75)", shape: "circle", size2: 0.5 }); } }
      if (sp < SETTLE_SPEED && bd.t > 0.6 && touching) bd.idleT += dt; else bd.idleT = 0;
      if ((bd.idleT > 1.1 || bd.t > 13 || b.x > this.W + 600 || b.x < -400 || b.y > GROUND_Y + 420) && !bd.fading) { bd.fading = true; }
      if (bd.fading) { bd.fade -= dt * 2.4; if (bd.fade <= 0) { this.fx.burst(b.x, b.y, 6, { speed: [30, 110], size: [2, 4], life: [0.3, 0.6], color: "#ffffff", g: -40, shape: "smoke" }); W.remove(b); bd.dead = true; this.flying.splice(i, 1); continue; } }
      if (!bd.fading) anyBirdMoving = true;
    }
    // eggs
    for (let i = this.eggs.length - 1; i >= 0; i--) {
      const e = this.eggs[i]; e.t += dt; const b = e.body;
      if (b.dead) { this.eggs.splice(i, 1); continue; }
      if (b.ud.boom || e.t > 4 || b.y > GROUND_Y + 200) { this.explosion(b.x, b.y, 92, 560, 3400, "egg"); W.remove(b); this.eggs.splice(i, 1); }
    }
    // things that fell off the world, decay timers, and "is everything calm?"
    let moving = 0;
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i]; if (b.static || b.dead) continue; const u = b.ud;
      if (u.flash > 0) u.flash -= dt; if (u.hurtT > 0) u.hurtT -= dt;
      if (b.y > GROUND_Y + 150 && (u.t === "foe" || u.t === "block" || u.t === "rock")) {
        if (u.t === "foe" && !u.dead) { u.dead = true; this.foesLeft--; this.addScore(FOES[u.kind].pts, b.x, GROUND_Y + 60, "#fff6c4", 20); this.sfx.pop(); }
        if (b.y > GROUND_Y + 420 || u.t !== "foe") { W.remove(b); continue; }
      }
      if (b.x < -500 || b.x > this.W + 800) { if (u.t === "foe" && !u.dead) { u.dead = true; this.foesLeft--; this.addScore(FOES[u.kind].pts, Math.max(40, Math.min(this.W, b.x)), 200, "#fff6c4", 20); } W.remove(b); continue; }
      if (u.t !== "bird" && b.awake && (Math.abs(b.vx) + Math.abs(b.vy) > SETTLE_SPEED || Math.abs(b.av) > 1.2)) moving++;
    }
    this.moving = moving;
    this.calmT = moving === 0 && !anyBirdMoving && this.eggs.length === 0 ? this.calmT + dt : 0;
    this.anyBirdMoving = anyBirdMoving;
    if (this.hopper) { const h = this.hopper; h.t += dt / 0.5; if (h.t >= 1) this.hopper = null; }
    if (this.snap) { const s = this.snap, ax = ANCHOR.x, ay = ANCHOR.y; s.vx += (ax - s.x) * 900 * dt; s.vy += (ay - s.y) * 900 * dt; s.vx *= 1 - 7 * dt; s.vy *= 1 - 7 * dt; s.x += s.vx * dt; s.y += s.vy * dt; if (Math.hypot(s.x - ax, s.y - ay) < 0.8 && Math.hypot(s.vx, s.vy) < 12) this.snap = null; }
  }

  updateFlow(dt) {
    if (this.done) return;
    if (this.state === "fly") {
      this.sinceShot += dt;
      if ((!this.anyBirdMoving && this.flying.length === 0) || this.sinceShot > 16) { this.state = "settle"; this.stateT = 0; }
    }
    if (this.state === "settle") {
      this.sinceShot += dt;
      if (this.foesLeft <= 0) { this.startWin(); return; }
      if ((this.calmT > 0.7 && this.stateT > 0.4) || this.sinceShot > 22 || this.stateT > 8) {
        if (this.foesLeft <= 0) this.startWin();
        else if (this.queue.length > 0) { this.loadBird(false); }
        else this.startLose();
      }
    }
    if ((this.state === "fly") && this.foesLeft <= 0) this.startWin();
    if (this.state === "win") this.updateWin(dt);
    if (this.state === "lose") { this.winT += dt; if (this.winT > 0.9 && !this.done) this.finishLose(); }
  }
  startWin() { if (this.state === "win") return; this.state = "win"; this.stateT = 0; this.winT = 0; this.bonusI = 0; this.bonusT = 0; this.birdsLeft = this.queue.length + (this.cur ? 1 : 0); this.cheered = false; for (const b of this.flying) b.fading = true; }
  updateWin(dt) {
    this.winT += dt;
    if (!this.cheered && this.winT > 0.5) { this.cheered = true; FX.confetti(this.fx, this.cam.x + 480, this.cam.y + 120, 50); this.sfx.star && this.sfx.star(); }
    // wait for the pieces to stop falling, then count the leftover Fluffs
    if (this.winT < 1.6 || (this.calmT < 0.5 && this.winT < 5)) return;
    if (this.bonusI < this.birdsLeft) {
      this.bonusT -= dt;
      if (this.bonusT <= 0) {
        this.bonusT = 0.42; this.bonusI++; this.bonusScore += BONUS_BIRD; this.score += BONUS_BIRD;
        const x = this.cam.x + 200 + this.bonusI * 70, y = this.cam.y + 240; this.fl.add(x, y, "+" + fmt(BONUS_BIRD), "#ffd84a", 24); FX.pop(this.fx, x, y + 20, "#ffd84a", 12); this.sfx.coin && this.sfx.coin();
      }
      return;
    }
    this.bonusT -= dt; if (this.bonusT <= -0.5) this.finishWin();
  }
  startLose() { if (this.state === "lose") return; this.state = "lose"; this.stateT = 0; this.winT = 0; }
  finishWin() {
    if (this.done) return;
    const stars = this.score >= this.star3 ? 3 : this.score >= this.star2 ? 2 : 1, left = this.birdsLeft;
    this.done = {
      won: true, score: Math.round(this.score), stars, time: Math.round(this.time), title: stars === 3 ? "PERFECT FORT-BREAKING!" : "LEVEL CLEAR!", sub: this.lv.name, delay: 0.25,
      lines: [["Sprockets popped", `${this.foesTotal} / ${this.foesTotal}`], ["Blocks smashed", String(this.blocksSmashed)], ["Fluffs left over", `${left}  (+${fmt(left * BONUS_BIRD)})`], ["2 stars at", fmt(this.star2)], ["3 stars at", fmt(this.star3)]],
    };
  }
  finishLose() {
    if (this.done) return;
    this.done = { won: false, score: Math.round(this.score), stars: 0, time: Math.round(this.time), title: "OUT OF FLUFFS", sub: `${this.foesLeft} Sprocket${this.foesLeft === 1 ? "" : "s"} still laughing at you`, delay: 0.1, lines: [["Sprockets popped", `${this.foesTotal - this.foesLeft} / ${this.foesTotal}`], ["Blocks smashed", String(this.blocksSmashed)], ["Score so far", fmt(this.score)]] };
  }

  updateCamera(dt, input) {
    const cam = this.cam, maxX = Math.max(0, this.W - 960);
    let tx = cam.x, ty = 0, rate = 4;
    switch (this.state) {
      case "intro": { const k = clamp(this.stateT / 2.2, 0, 1), e = k < 0.25 ? 0 : (k - 0.25) / 0.75, s = e * e * (3 - 2 * e); cam.x = lerp(this.farX, this.homeX, s); cam.y = 0; return; }
      case "ready": case "aim": tx = this.userPan ? cam.x : this.homeX; rate = 5; break;
      case "fly": {
        let lead = null; for (const b of this.flying) if (!b.dead && !b.fading) { if (!lead || b.body.x > lead.body.x) lead = b; }
        if (lead) { tx = clamp(lead.body.x - 330, this.homeX, maxX); ty = Math.min(0, lead.body.y - 200); } else tx = cam.x;
        rate = 6; break;
      }
      case "settle": case "win": case "lose": { tx = cam.x; rate = 2; if (this.state === "settle" && this.stateT > 1.4 && this.queue.length > 0 && this.calmT > 0.3) tx = this.homeX; break; }
      default: break;
    }
    cam.x = damp(cam.x, clamp(tx, 0, maxX), rate, dt); cam.y = damp(cam.y, ty, 4, dt);
  }

  // ---------------------------------------------------------------------------------------------------------------- drawing
  draw(g, env) {
    const cam = this.cam, t = this.t;
    this.bd.draw(g, cam.x, cam.y, t, 960, 540, { camYFactor: 0.5 });
    cam.begin(g);
    const vx0 = cam.x, vx1 = cam.x + 960;
    // land
    for (const s of this.groundSegs) { const u = s.ud, x0 = Math.max(u.x0, vx0 - 100), x1 = Math.min(u.x1, vx1 + 100); if (x1 > x0) A.drawTerrainBox(g, { x: (x0 + x1) / 2, y: GROUND_Y + 60, w: x1 - x0, h: 120 }, this.look, vx0, vx1); }
    for (const tr of this.terrain) A.drawTerrainBox(g, tr, this.look, vx0, vx1);
    // pits get a glow so they read as holes
    for (const [a, b] of this.info.pits) { if (b < vx0 - 50 || a > vx1 + 50) continue; g.fillStyle = "#07031a"; g.fillRect(a, GROUND_Y - 2, b - a, 700); const gr = g.createLinearGradient(0, GROUND_Y, 0, GROUND_Y + 120); gr.addColorStop(0, "rgba(255,62,165,.35)"); gr.addColorStop(1, "rgba(255,62,165,0)"); g.fillStyle = gr; g.fillRect(a, GROUND_Y, b - a, 120); }
    this.drawSign(g);
    // sling (back half)
    const tips = this.slingTips(), pouchPos = this.pull || (this.snap ? { x: this.snap.x, y: this.snap.y } : null);
    A.drawSlingBack(g, SLING_X, GROUND_Y, ANCHOR.y, tips.L, tips.R, pouchPos || null, 0, t);
    // waiting Fluffs sit on the ground
    this.drawWaiting(g, t);
    // everything that is made of blocks
    for (const b of this.world.bodies) {
      const u = b.ud; if (b.static || b.dead) continue;
      if (b.x + 80 < vx0 || b.x - 80 > vx1) continue;
      if (u.t === "block") A.drawBlock(g, b, u);
      else if (u.t === "rock") A.drawRock(g, b, u);
    }
    const aim = this.flying.length ? this.flying[0].body : null;
    for (const b of this.world.bodies) { const u = b.ud; if (u.t === "foe" && !b.dead && b.x + 60 > vx0 && b.x - 60 < vx1) A.drawFoe(g, b, u, t, aim || this.cur || this.aimPt); }
    for (const b of this.world.bodies) { if (b.ud.t === "egg") A.drawEgg(g, b.x, b.y, b.rot); }
    // trajectory preview
    if (this.state === "aim" && this.pull && this.cur) this.drawPreview(g);
    // the Fluff in the sling, then the flying ones
    if (this.cur && !this.hopper) {
      const P = this.pull || { x: this.cur.x, y: this.cur.y + Math.sin(t * 3) * 1.6 }, B = BIRDS[this.cur.type];
      const ang = this.pull ? Math.atan2(ANCHOR.y - P.y, ANCHOR.x - P.x) : 0;
      A.drawPouch(g, P, B.r, ang + Math.PI);
      A.drawBird(g, this.cur.type, P.x, P.y, this.pull ? -ang * 0.15 : Math.sin(t * 2) * 0.05, { blink: Math.sin(t * 1.7) > 0.97, scale: this.pull ? 1.02 : 1 });
    }
    if (this.hopper) { const h = this.hopper, k = clamp(h.t, 0, 1), x = lerp(h.from.x, h.to.x, k), y = lerp(h.from.y, h.to.y, k) - Math.sin(k * Math.PI) * 70; A.drawBird(g, h.type, x, y, k * TAU * 0.5); }
    for (const bd of this.flying) {
      const b = bd.body; if (bd.dead) continue;
      g.save(); g.globalAlpha = clamp(bd.fade, 0, 1);
      const vr = bd.air ? clamp(b.vy / 1600, -0.5, 0.5) : b.rot;
      A.drawBird(g, bd.type, b.x, b.y, vr, { scale: bd.scale * (b.r / (BIRDS[bd.type].r * bd.scale)), blink: false }); g.restore();
    }
    A.drawSlingFront(g, SLING_X, GROUND_Y, ANCHOR.y, tips.L, tips.R, pouchPos || null, 0, t);
    this.fx.draw(g); this.fl.draw(g);
    cam.end(g);
    if (!this.bare) this.drawHud(g);
    this.juice.draw(g, 960, 540);
  }
  drawSign(g) { // a little arrow sign near the sling in the first level
    if (this.lv.id !== "1-1" || this.shots > 0) return;
    const x = SLING_X + 150, y = GROUND_Y; g.save(); g.fillStyle = "#8a5526"; g.fillRect(x - 3, y - 40, 6, 40); fillRR(g, x - 38, y - 76, 76, 38, 6, "#e9b274", OUT, 2.2); text(g, "PULL →", x, y - 51, { size: 13, color: "#5b3314", align: "center", weight: 900 }); g.restore();
  }
  drawWaiting(g, t) {
    const list = this.queue;
    for (let i = 0; i < list.length && i < 5; i++) {
      const type = list[i], B = BIRDS[type], x = SLING_X - 56 - i * 34, bob = Math.max(0, Math.sin(t * 3 + i * 1.7)) * 4;
      if (i === 0 && this.hopper) continue;
      A.drawBird(g, type, x, GROUND_Y - B.r - bob + 1, 0, { blink: Math.sin(t * 1.5 + i * 2.3) > 0.97 });
    }
  }
  drawPreview(g) {
    const P = this.pull, B = BIRDS[this.cur.type], vx = (ANCHOR.x - P.x) * LAUNCH_K, vy = (ANCHOR.y - P.y) * LAUNCH_K;
    for (let i = 1; i <= 15; i++) {
      const tt = i * 0.058, x = P.x + vx * tt, y = P.y + vy * tt + 0.5 * G * tt * tt; if (y > GROUND_Y - 4) break;
      const a = 1 - i / 17; g.globalAlpha = a; circle(g, x, y, 4.2 - i * 0.14, "#ffffff", OUT, 1.4); g.globalAlpha = 1;
    }
  }
  drawHud(g) {
    // score panel
    const x = 14, y = 12; fillRR(g, x, y, 236, 56, 14, "rgba(14,6,36,.66)", "rgba(190,180,255,.3)", 1.5);
    text(g, "SCORE", x + 14, y + 19, { size: 9, color: "#c3bbea", font: FONT_PIXEL, weight: 400 }); text(g, fmt(this.score), x + 222, y + 38, { size: 26, color: "#ffd84a", align: "right", weight: 800 });
    const bx = x + 12, bw = 212, by = y + 44, top = this.star3 * 1.12; bar(g, bx, by, bw, 7, this.score / top, "#ffc233");
    for (const [v, i] of [[this.star2, 2], [this.star3, 3]]) { const sx = bx + bw * (v / top); star(g, sx, by + 3.5, 7, this.score >= v ? "#ffc233" : "rgba(60,30,90,.9)", this.score >= v ? OUT : "rgba(190,180,255,.5)", 1.4); }
    // level name + Sprockets left
    text(g, `${this.lv.label || this.lv.id}  ${this.lv.name}`, 480, 30, { size: 15, color: "rgba(255,255,255,.88)", align: "center", weight: 700, stroke: "rgba(20,10,50,.7)", strokeW: 4 });
    for (let i = 0; i < this.foesTotal; i++) { const alive = i < this.foesLeft; circle(g, 480 + (i - (this.foesTotal - 1) / 2) * 20, 50, 6.5, alive ? "#e6b24a" : "rgba(60,30,90,.8)", alive ? OUT : "rgba(190,180,255,.4)", 1.6); }
    // Fluffs left (top right, left of the pause button)
    const n = this.queue.length + (this.cur ? 1 : 0) + this.flying.filter((b) => !b.child && !b.dead).length;
    for (let i = 0; i < this.total; i++) { const alive = i >= this.total - n; const cx = 872 - i * 30; const type = this.info.birds[this.total - 1 - i]; g.save(); g.globalAlpha = alive ? 1 : 0.25; const sp = A.birdSprite(type); g.drawImage(sp, cx - 18, 14, 36, 36); g.restore(); }
    // hints
    this.drawHint(g);
    if (this.state === "intro") { const k = clamp(this.stateT / 0.5, 0, 1) * clamp((2.4 - this.stateT) / 0.4, 0, 1); g.save(); g.globalAlpha = k; text(g, `LEVEL ${this.lv.label || this.lv.id}`, 480, 236, { size: 13, color: "#ff3ea5", align: "center", font: FONT_PIXEL, weight: 400, shadow: true }); text(g, this.lv.name, 480, 282, { size: 46, color: "#fff", align: "center", weight: 800, stroke: "#150a33", strokeW: 8 }); text(g, `Pop all ${this.foesTotal} Sprocket${this.foesTotal === 1 ? "" : "s"}!`, 480, 316, { size: 19, color: "#ffe9a8", align: "center", weight: 700, stroke: "#150a33", strokeW: 5 }); g.restore(); }
    if (this.state === "win" && this.winT > 0.2) { const k = clamp((this.winT - 0.2) / 0.4, 0, 1); g.save(); g.globalAlpha = k; text(g, "ALL SPROCKETS POPPED!", 480, 150 - (1 - k) * 18, { size: 34, color: "#ffd84a", align: "center", weight: 800, stroke: "#150a33", strokeW: 7 }); g.restore(); }
    if (this.state === "lose") { const k = clamp(this.winT / 0.4, 0, 1); g.save(); g.globalAlpha = k; text(g, "OUT OF FLUFFS!", 480, 150, { size: 34, color: "#ff8fc0", align: "center", weight: 800, stroke: "#150a33", strokeW: 7 }); g.restore(); }
  }
  drawHint(g) {
    const h = this.info.hint; if (!h) return; let s = null;
    if (this.shots === 0 && (this.state === "ready" || this.state === "aim")) s = h[0];
    else if (this.shots === 1 && this.state === "fly" && h[1] && this.flying[0] && !this.flying[0].used) s = h[1];
    else if (this.shots === 0 && this.state === "intro") s = null;
    if (!s) return; const k = 0.82 + Math.sin(this.t * 3) * 0.05;
    g.save(); const w = 640; fillRR(g, 480 - w / 2, 478, w, 40, 14, "rgba(14,6,36,.78)", "rgba(255,216,74,.7)", 1.8); text(g, s, 480, 504, { size: 16, color: "#fff6c4", align: "center", weight: 700 }); g.restore();
  }
}
