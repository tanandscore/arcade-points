// Skyline Siege — one play-through of one mission: the hero, the guns, the Syndicate, explosions, pickups, camera and score.
import { clamp, lerp, sign, damp, TAU, rng, fmt, secondsLabel } from "../../core/util";
import { TileMap, moveBody, touchingHazard, heroControl } from "../../core/platformer";
import { Particles, FX, Floaters, Camera, Juice } from "../../core/fx";
import { Backdrop } from "../../core/backdrop";
import { drawTiles, TILE_PAINT } from "../../core/tiles";
import { text, fillRR, rr, circle, ellipse, poly, line, glow, star, cached, stamp, FONT_DISPLAY, FONT_PIXEL, FONT_BODY, OUT } from "../../core/draw";
import { sfx as realSfx, music } from "../../core/audio";
import { TS, ROWS, FLOOR, HERO, PHYS, WEAPONS, WEAPON_ORDER, PICKUP_WEAPON, GRENADE, ENEMY, COMBO_WINDOW, CASH, CITIZEN, TILE_CHARS, ENT_CHARS, QUIPS } from "./defs";
import { buildLevel, DISTRICTS } from "./levels";
import { makeEnemy, updateEnemy } from "./enemies";
import { makeBoss } from "./bosses";
import * as A from "./art";

const NOOP = new Proxy({}, { get: () => () => {} });
const DT = 1 / 60;
export const NO_INPUT = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false, inside: false }, pressed: () => false, held: () => false, released: () => false, axis: () => 0 };

export class SiegeSession {
  constructor(lv, ctx = {}, opts = {}) {
    this.lv = lv; this.ctx = ctx; this.demo = !!opts.demo; this.quiet = !!opts.quiet || !!opts.headless || !!opts.demo; this.headless = !!opts.headless; this.bot = opts.bot || null; this.camShift = opts.camShift || 0;
    this.sfx = this.quiet ? NOOP : realSfx;
    const info = buildLevel(lv.wi, lv.li); this.info = info; this.dist = DISTRICTS[lv.wi];
    this.map = new TileMap(info.rows, { ts: TS, solid: TILE_CHARS.solid, oneway: TILE_CHARS.oneway, hazard: TILE_CHARS.hazard, ents: ENT_CHARS });
    const map = this.map;
    this.cam = new Camera(960, 540); this.cam.setBounds(0, 0, map.w, map.h);
    this.fx = this.headless ? NOOP : new Particles(900); this.fl = this.headless ? NOOP : new Floaters(); this.juice = new Juice();
    this.bd = this.headless ? null : new Backdrop(info.theme, (lv.wi + 1) * 10 + lv.li + 5);
    this.R = rng(lv.wi * 131 + lv.li * 17 + 3);
    this.t = 0; this.time = 0; this.score = 0; this.combo = 0; this.comboT = 0; this.kills = 0; this.killsTotal = 0; this.deaths = 0; this.rescued = 0; this.citizensTotal = 0;
    this.done = null; this.state = "play"; this.winT = 0; this.finished = false; this.fireMul = 1 + lv.wi * 0.12;
    this.enemies = []; this.projs = []; this.items = []; this.barrels = []; this.citizens = []; this.checkpoints = []; this.goal = null; this.boss = null; this.bossSpawn = null; this.shells = []; this.fallers = [];
    this.after_ = []; this.speech = null; this.quipT = 3; this.tipT = 0; this.tip = null; this.hintI = 0; this.hints = info.hints.map((h) => ({ x: h.col * TS, text: h.text, shown: false })); this.lastQuip = null;
    this.start = { x: 100, y: FLOOR * TS };
    for (const e of map.ents) {
      const ph = this.R() * 6.28, x = e.x, y = e.y;
      switch (e.ch) {
        case "P": this.start = { x, y }; break;
        case "F": this.goal = { x, y, open: true }; break;
        case "K": this.checkpoints.push({ x, y, on: false }); break;
        case "y": this.citizens.push({ x, y, ph, saved: false, savedT: 0, dir: 1 }); this.citizensTotal++; break;
        case "$": this.items.push({ kind: "cash", x, y: y - 22, ph }); break;
        case "+": this.items.push({ kind: "med", x, y: y - 22, ph }); break;
        case "r": this.items.push({ kind: "armor", x, y: y - 24, ph }); break;
        case "o": this.items.push({ kind: "gren", x, y: y - 22, ph }); break;
        case "a": this.items.push({ kind: "ammo", x, y: y - 22, ph }); break;
        case "R": this.items.push({ kind: "rage", x, y: y - 26, ph }); break;
        case "1": case "2": case "3": case "4": { const w = PICKUP_WEAPON[e.ch]; this.items.push({ kind: "weapon", weapon: w, color: WEAPONS[w].color, x, y: y - 30, ph }); break; }
        case "e": this.barrels.push({ x, y, hp: 2, flash: 0, dead: false }); break;
        case "Z": this.bossSpawn = { x, y }; break;
        default: if (ENEMY[e.ch]) { const en = makeEnemy(this, e.ch, x, y, ph); this.enemies.push(en); this.killsTotal++; }
      }
    }
    // boss arena
    this.arena = null; this.fight = false; this.bossDown = false;
    if (info.boss && info.arenaCol >= 0) { const x0 = info.arenaCol * TS; this.arena = { x0, x1: x0 + 20 * TS, locked: false }; if (this.bossSpawn) this.boss = makeBoss(info.boss, this.bossSpawn, this); }
    // the hero
    this.hero = { x: this.start.x, y: this.start.y, w: HERO.w, h: HERO.h, vx: 0, vy: 0, face: 1, onGround: true, hp: HERO.hp, armor: 0, inv: 0, crouch: false, dropT: 0, dead: false, deadT: 0, aimX: 1, aimY: 0, aimRel: 0, fireCd: 0, throwCd: 0, kick: 0, flashT: 0, rage: 0, run: 0, stepT: 0, spawnT: 0, weapon: "pistol", ammo: { pistol: Infinity }, grenades: 2, owned: ["pistol"], landVy: 0 };
    this.snapshot = this.takeSnap(this.start.x, this.start.y);
    this.camLook = 0; this.input = NO_INPUT; this.snapCam();
    if (!this.headless) this.fx.clear();
    if (!this.demo) this.say(this.pick(QUIPS.start), 2.6);
  }

  // ------------------------------------------------------------------------------------------------------------------ helpers
  pick(arr) { let s; for (let i = 0; i < 4; i++) { s = arr[Math.floor(Math.random() * arr.length)]; if (s !== this.lastQuip) break; } this.lastQuip = s; return s; }
  say(str, dur = 2.2, force = false) { if (!force && this.quipT > 0) return; this.speech = { text: str, t: 0, dur }; this.quipT = 6.5; }
  showTip(str, dur = 4) { this.tip = { text: str, t: 0, dur }; }
  after(t, fn) { this.after_.push({ t, fn }); }
  takeSnap(x, y) { const H = this.hero; return { x, y, hp: H ? Math.max(H.hp, 60) : HERO.hp, armor: H ? H.armor : 0, weapon: H ? H.weapon : "pistol", ammo: H ? { ...H.ammo } : { pistol: Infinity }, owned: H ? H.owned.slice() : ["pistol"], grenades: H ? H.grenades : 2 }; }
  los(x0, y0, x1, y1) { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 20); for (let i = 1; i < n; i++) { const t = i / n; if (this.map.solidAtPx(lerp(x0, x1, t), lerp(y0, y1, t))) return false; } return true; }
  groundAhead(e) { const x = e.x + e.face * (e.w / 2 + 10), y = e.y + 8; return this.map.solidAtPx(x, y) || this.map.isOneWay(this.map.col(x), this.map.row(y)); }
  floorY(x, y0) { const c = this.map.col(x); for (let r = this.map.row(y0); r < this.map.rows; r++) { const ch = this.map.ch(c, r); if (this.map.solidSet.has(ch) || this.map.oneSet.has(ch)) return r * TS; } return this.map.h + 200; }
  addScore(n, x, y, color = "#ffe27a", size = 16, mult = false) { const v = Math.round(n * (mult ? this.mult() : 1)); this.score += v; if (x != null) this.fl.add(x, y, "+" + fmt(v), color, size); }
  mult() { return this.comboT > 0 ? Math.min(5, 1 + Math.floor(this.combo / 3)) : 1; }
  rect(e) { return { x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h }; }
  hitRect(px, py, r, rc) { return px > rc.x - r && px < rc.x + rc.w + r && py > rc.y - r && py < rc.y + rc.h + r; }

  // ------------------------------------------------------------------------------------------------------------------ update
  update(dt, input, env) {
    this.t += dt;
    const sd = this.juice.step(dt); this.juice.update(dt);
    this.fx.update(dt); this.fl.update(dt); this.cam.update(dt);
    if (sd === 0) return; // a hit-stop freeze: nothing moves, and the autopilot must not "press buttons" during it either
    dt = sd;
    if (this.bot) { this.bot.think(this); input = this.bot.input; } else if (!input) input = NO_INPUT;
    this.input = input;
    for (let i = this.after_.length - 1; i >= 0; i--) { const a = this.after_[i]; a.t -= dt; if (a.t <= 0) { this.after_.splice(i, 1); a.fn(); } }
    this.quipT -= dt; if (this.speech) { this.speech.t += dt; if (this.speech.t > this.speech.dur) this.speech = null; } if (this.tip) { this.tip.t += dt; if (this.tip.t > this.tip.dur) this.tip = null; }
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    if (this.state === "win") { this.winT += dt; this.updateWorld(dt); this.updateCamera(dt); if (this.winT > 1.3 && !this.done) this.finishWin(); return; }
    this.time += dt;
    this.updateHero(dt, input);
    this.updateWorld(dt);
    this.updateHints();
    this.updateArena(dt);
    this.updateCamera(dt);
  }

  updateWorld(dt) {
    for (const b of this.barrels) b.flash = Math.max(0, b.flash - dt);
    this.updateFallers(dt);
    this.updateProjs(dt);
    for (const e of this.enemies) if (!e.gone) { updateEnemy(this, e, dt); if (e.fell || e.y > this.map.h + 400) e.gone = true; }
    if (this.enemies.length > 80) this.enemies = this.enemies.filter((e) => !e.gone);
    if (this.boss && (this.fight || this.bossDown)) this.boss.update(this, dt);
    for (const c of this.citizens) if (c.saved) c.savedT += dt;
    for (const s of this.shells) { s.vy += 1100 * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt; if (s.y > s.floor) { s.y = s.floor; s.vy *= -0.35; s.vx *= 0.6; } }
    this.shells = this.shells.filter((s) => s.life > 0);
  }

  // ------------------------------------------------------------------------------------------------------------------ the hero
  updateHero(dt, input) {
    const H = this.hero, map = this.map;
    H.inv = Math.max(0, H.inv - dt); H.flashT = Math.max(0, H.flashT - dt); H.kick = Math.max(0, H.kick - dt * 8); H.fireCd -= dt; H.throwCd -= dt; H.rage = Math.max(0, H.rage - dt); H.spawnT += dt; H.dropT = Math.max(0, H.dropT - dt);
    if (H.dead) { H.deadT += dt; H.vy += PHYS.gravity * dt; H.vx *= 1 - 4 * dt; moveBody(map, H, dt); if (H.deadT > 1.6) this.respawn(); return; }
    const dir = input.axis("left", "right"), up = input.held("up"), down = input.held("down");
    // crouch on the ground; stand up only if there is room
    const wantCrouch = H.onGround && down && !up;
    if (wantCrouch && !H.crouch) { H.crouch = true; H.h = HERO.hCrouch; }
    else if (!wantCrouch && H.crouch) { const head = map.solidAtPx(H.x, H.y - HERO.h - 2) || map.solidAtPx(H.x - 8, H.y - HERO.h - 2) || map.solidAtPx(H.x + 8, H.y - HERO.h - 2); if (!head) { H.crouch = false; H.h = HERO.h; } }
    // jump (down + jump drops through a catwalk)
    const jp = input.pressed("jump"), jh = input.held("jump");
    if (H.crouch && jp) { const below = map.isOneWay(map.col(H.x), map.row(H.y + 2)); if (below) { H.dropT = 0.25; H.onGround = false; H.vy = 120; H.crouch = false; H.h = HERO.h; } }
    const wasGround = H.onGround;
    const r = heroControl(H, { dir: H.crouch ? 0 : dir, jumpPressed: jp && !H.crouch, jumpHeld: jh, down }, dt, PHYS, {});
    if (r.jumped) { this.sfx.jump(); FX.dust(this.fx, H.x, H.y, 4); }
    H.landVy = Math.max(H.landVy, H.vy);
    moveBody(map, H, dt, { dropThrough: H.dropT > 0 });
    if (H.onGround && !wasGround) { if (H.landVy > 420) { this.sfx.land(); FX.dust(this.fx, H.x, H.y, 5); } H.landVy = 0; } if (!H.onGround) H.landVy = Math.max(0, H.landVy);
    if (H.onGround) H.landVy = 0;
    if (H.fell) { this.killHero("fall"); return; }
    if (touchingHazard(map, H, 6)) { this.hurtHero(20, H.x, "spike"); H.vy = -520; }
    // running animation + footsteps
    if (H.onGround && Math.abs(H.vx) > 30) { H.run += Math.abs(H.vx) * dt * 0.052; H.stepT -= dt; if (H.stepT <= 0) { H.stepT = 0.27; this.sfx.step(); } } else if (H.onGround) H.run = 0;
    // aim: 8 directions
    let ax = H.face, ay = 0;
    if (up) { ay = -1; ax = dir !== 0 ? dir : 0; } else if (down && !H.onGround) { ay = 1; ax = dir !== 0 ? dir : 0; }
    if (ax === 0 && ay === 0) ax = H.face;
    const n = Math.hypot(ax, ay) || 1; H.aimX = ax / n; H.aimY = ay / n; H.aimRel = Math.atan2(H.aimY, H.aimX * H.face);
    // weapons
    if (input.pressed("swap")) this.swapWeapon();
    if (input.held("fire") && H.fireCd <= 0 && this.state === "play") this.fireWeapon();
    if (input.pressed("alt") && H.throwCd <= 0 && this.state === "play") this.throwGrenade();
    // pickups, citizens, checkpoints, exit
    this.updateCollect(dt);
  }

  muzzle() {
    const H = this.hero, sx = H.x + 4 * H.face, sy = H.y - (H.crouch ? 29 : 47), len = (A.GUN_LEN[H.weapon] || 26) + 16;
    return { x: sx + H.aimX * len, y: sy + H.aimY * len, sx, sy };
  }

  fireWeapon() {
    const H = this.hero, W = WEAPONS[H.weapon];
    if (H.ammo[H.weapon] <= 0) { this.sfx.empty(); this.autoSwitch(); H.fireCd = 0.2; return; }
    const m = this.muzzle(), base = Math.atan2(H.aimY, H.aimX), rageMul = H.rage > 0 ? 2 : 1;
    H.fireCd = W.rate / (H.rage > 0 ? 1.4 : 1); H.flashT = 0.06; H.kick = 1;
    if (H.ammo[H.weapon] !== Infinity) H.ammo[H.weapon]--;
    this.sfx[W.sfx]();
    const push = (ang, kind, extra = {}) => this.projs.push({ x: m.x, y: m.y, vx: Math.cos(ang) * W.speed, vy: Math.sin(ang) * W.speed, kind, dmg: W.dmg * rageMul, from: "hero", life: W.life, max: W.life, r: 4, color: W.color, pierce: W.pierce || 0, hit: null, knock: W.knock || 0, ...extra });
    switch (H.weapon) {
      case "shotgun": for (let i = 0; i < W.pellets; i++) push(base + (i / (W.pellets - 1) - 0.5) * W.spread + (Math.random() - 0.5) * 0.06, "pellet", { r: 5, life: W.life * (0.8 + Math.random() * 0.4) }); this.cam.shake(3, 0.12); break;
      case "rocket": push(base, "rocket", { r: 7, splash: W.splash, splashDmg: W.splashDmg * rageMul }); this.cam.shake(2.5, 0.12); break;
      case "laser": push(base, "laser", { r: 6 }); break;
      case "smg": push(base + (Math.random() - 0.5) * W.spread, "bullet"); break;
      default: push(base + (W.spread ? (Math.random() - 0.5) * W.spread : 0), "bullet");
    }
    if (H.weapon === "pistol" || H.weapon === "smg") this.shells.push({ x: m.sx, y: m.sy, vx: -H.face * (40 + Math.random() * 50), vy: -180 - Math.random() * 80, life: 0.9, floor: this.floorY(H.x, H.y - 4) - 2 });
    // shotgun and rocket shove you back a little when you are in the air
    if (!H.onGround && W.kick > 100) H.vx -= H.aimX * W.kick * 0.5;
    FX.sparks(this.fx, m.x, m.y, 2, W.color);
  }
  autoSwitch() { const H = this.hero; for (const id of [...WEAPON_ORDER].reverse()) if (H.owned.includes(id) && (H.ammo[id] > 0)) { H.weapon = id; return; } H.weapon = "pistol"; }
  swapWeapon() {
    const H = this.hero, list = WEAPON_ORDER.filter((id) => H.owned.includes(id) && H.ammo[id] > 0); if (list.length < 2) return;
    const i = list.indexOf(H.weapon); H.weapon = list[(i + 1) % list.length]; this.sfx.click && this.sfx.click(); H.fireCd = 0.12;
  }
  throwGrenade() {
    const H = this.hero; if (H.grenades <= 0) { this.sfx.empty(); H.throwCd = 0.3; return; }
    H.grenades--; H.throwCd = 0.55; const m = this.muzzle(), a = Math.atan2(H.aimY, H.aimX);
    this.projs.push({ x: m.sx + H.aimX * 14, y: m.sy + H.aimY * 14, vx: Math.cos(a) * GRENADE.speed + H.vx * 0.4, vy: Math.sin(a) * GRENADE.speed - 170, kind: "grenade", dmg: GRENADE.dmg, from: "hero", life: GRENADE.fuse, max: GRENADE.fuse, r: 7, g: 1400, rot: 0, splash: GRENADE.splash, splashDmg: GRENADE.dmg });
    this.sfx.whoosh();
  }

  hurtHero(dmg, srcX, kind = "shot") {
    const H = this.hero; if (H.dead || H.inv > 0 || this.state === "win") return;
    dmg = Math.round(dmg);
    if (H.armor > 0) { const take = Math.min(H.armor, Math.round(dmg * 0.6)); H.armor -= take; dmg -= take; }
    H.hp -= dmg; H.inv = HERO.inv; this.sfx.hurt(); this.cam.shake(5, 0.2); this.juice.hitstop(0.04); this.juice.doFlash(0.18, "#ff3e5e");
    if (kind === "blast") { H.vx = (H.x < srcX ? -1 : 1) * 170; if (H.onGround) H.vy = -220; } // only explosions shove you; bullets never knock you off a jump
    FX.sparks(this.fx, H.x, H.y - 30, 6, "#ff9ab0"); this.fl.add(H.x, H.y - 70, "-" + dmg, "#ff6a8a", 17);
    this.combo = 0; this.comboT = 0;
    if (H.hp <= 0) { this.killHero(kind); return; }
    if (H.hp < 30) this.say(this.pick(QUIPS.low), 2); else if (Math.random() < 0.3) this.say(this.pick(QUIPS.hurt), 1.8);
  }
  killHero(kind) {
    const H = this.hero; if (H.dead) return; H.dead = true; H.deadT = 0; H.hp = 0; H.vy = -520; H.vx = 0; this.deaths++; this.sfx.die(); this.cam.shake(8, 0.35); this.combo = 0; this.comboT = 0;
    FX.explosion(this.fx, H.x, H.y - 30, 0.8); H.crouch = false; H.h = HERO.h;
    if (kind === "fall") { H.vy = 0; }
  }
  respawn() {
    const H = this.hero, s = this.snapshot, map = this.map;
    H.dead = false; H.deadT = 0; H.x = s.x; H.y = s.y; H.vx = H.vy = 0; H.hp = Math.max(60, s.hp); H.armor = s.armor; H.weapon = s.weapon; H.ammo = { ...s.ammo }; H.owned = s.owned.slice(); H.grenades = Math.max(2, s.grenades);
    H.inv = 2; H.onGround = false; H.rage = 0; H.spawnT = 0; H.h = HERO.h; H.crouch = false; H.fell = false;
    // an enemy bullet that was in the air should not kill you the moment you wake up
    this.projs = this.projs.filter((p) => p.from === "hero");
    this.snapCam();
    FX.pop(this.fx, H.x, H.y - 30, "#7ff3ff", 12);
  }

  updateCollect(dt) {
    const H = this.hero;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; if (Math.abs(it.x - H.x) > 34 || Math.abs((it.y) - (H.y - 30)) > 50) continue;
      if (it.kind === "med" && H.hp >= HERO.hp) continue; // keep it for later
      this.collect(it); this.items.splice(i, 1);
    }
    for (const c of this.citizens) if (!c.saved && Math.abs(c.x - H.x) < 30 && Math.abs(c.y - H.y) < 56) {
      c.saved = true; c.dir = c.x < H.x ? -1 : 1; this.rescued++; this.addScore(CITIZEN, c.x, c.y - 100, "#7dff6a", 20); this.sfx.heal(); FX.pop(this.fx, c.x, c.y - 50, "#7dff6a", 14); FX.confetti(this.fx, c.x, c.y - 60, 14);
      this.say(this.pick(QUIPS.rescue), 2, true); this.showTip(`Citizen rescued! ${this.rescued} / ${this.citizensTotal}`, 2.2);
    }
    for (const k of this.checkpoints) if (!k.on && Math.abs(k.x - H.x) < 34 && Math.abs(k.y - H.y) < 70) {
      k.on = true; this.snapshot = this.takeSnap(k.x, k.y); H.hp = Math.min(HERO.hp, H.hp + 30); this.sfx.checkpoint(); this.fl.add(k.x, k.y - 130, "CHECKPOINT", "#7dff6a", 18); FX.pop(this.fx, k.x, k.y - 100, "#7dff6a", 14); this.say(this.pick(QUIPS.checkpoint), 2);
    }
    if (this.goal && this.goal.open && this.state === "play" && Math.abs(this.goal.x - H.x) < 40 && Math.abs(this.goal.y - H.y) < 60) {
      this.state = "win"; this.winT = 0; H.vx = 0; this.sfx.win(); FX.confetti(this.fx, H.x, H.y - 80, 50); this.say(this.pick(QUIPS.win), 2, true); this.juice.slowmo(0.5, 0.4);
    }
  }
  collect(it) {
    const H = this.hero;
    switch (it.kind) {
      case "cash": this.addScore(CASH, it.x, it.y - 16, "#ffd24a", 15); this.sfx.coin(); break;
      case "med": H.hp = Math.min(HERO.hp, H.hp + 40); this.sfx.heal(); this.fl.add(it.x, it.y - 20, "+40 HP", "#7dff9a", 16); FX.pop(this.fx, it.x, it.y, "#ff6a8a", 8); break;
      case "armor": H.armor = Math.min(HERO.maxArmor, H.armor + 50); this.sfx.powerup(); this.fl.add(it.x, it.y - 20, "ARMOR", "#8fc8ff", 16); FX.pop(this.fx, it.x, it.y, "#6fb8ff", 8); break;
      case "gren": H.grenades = Math.min(GRENADE.max, H.grenades + 3); this.sfx.pickup(); this.fl.add(it.x, it.y - 20, "+3 GRENADES", "#c9e88a", 14); break;
      case "ammo": for (const id of H.owned) if (id !== "pistol") H.ammo[id] = Math.min(WEAPONS[id].max, (H.ammo[id] || 0) + Math.ceil(WEAPONS[id].max * 0.4)); this.sfx.pickup(); this.fl.add(it.x, it.y - 20, "AMMO", "#ffd166", 15); break;
      case "rage": H.rage = 12; this.sfx.powerup(); this.fl.add(it.x, it.y - 20, "RAGE! DOUBLE DAMAGE", "#ff5a7a", 17); this.cam.shake(3, 0.2); break;
      case "weapon": {
        const id = it.weapon, W = WEAPONS[id], had = H.owned.includes(id); if (!had) H.owned.push(id);
        H.ammo[id] = Math.min(W.max, (H.ammo[id] || 0) + W.ammo); H.weapon = id; this.sfx.powerup(); this.fl.add(it.x, it.y - 24, W.name.toUpperCase(), W.color, 17);
        FX.pop(this.fx, it.x, it.y, W.color, 10); this.say(QUIPS.weapon[id], 2.2, true); break;
      }
      default: break;
    }
  }

  // ------------------------------------------------------------------------------------------------------------------ projectiles
  eShot(x, y, ang, speed, dmg, kind = "ebullet", color = "#ff5a7a", extra = {}) {
    this.projs.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, kind, dmg, from: "enemy", life: kind === "bomb" ? 4 : 3, max: 3, r: kind === "snipe" ? 4 : kind === "bomb" ? 9 : 5, color, g: extra.g || 0, boom: extra.boom || 0 });
  }

  updateProjs(dt) {
    const H = this.hero, map = this.map, list = this.projs;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i]; p.life -= dt; let dead = false;
      if (p.kind === "grenade") { dead = this.updateGrenade(p, dt); if (dead) list.splice(i, 1); continue; }
      if (p.g) p.vy += p.g * dt;
      const sp = Math.hypot(p.vx, p.vy), n = Math.max(1, Math.ceil((sp * dt) / 9)), sx = (p.vx * dt) / n, sy = (p.vy * dt) / n;
      for (let k = 0; k < n && !dead; k++) {
        p.x += sx; p.y += sy;
        const ch = map.ch(map.col(p.x), map.row(p.y));
        if (map.solidSet.has(ch)) { dead = this.projHitTile(p, ch); if (dead) break; }
        if (p.from === "hero") dead = this.projHitFoes(p); else dead = this.projHitHero(p);
        if (p.x < -50 || p.x > map.w + 50 || p.y > map.h + 100 || p.y < -300) dead = true;
      }
      if (!dead && p.life <= 0) { if (p.kind === "rocket" || p.boom) { this.explode(p.x, p.y, p.splash || p.boom, { enemyDmg: p.splashDmg || 0, heroDmg: p.from === "enemy" ? p.dmg : 0, owner: p.from }); } dead = true; }
      if (dead) list.splice(i, 1);
    }
  }
  projHitTile(p, ch) {
    const map = this.map, c = map.col(p.x), r = map.row(p.y);
    if (p.kind === "rocket" || p.boom) { this.explode(p.x, p.y, p.splash || p.boom, { enemyDmg: p.splashDmg || 0, heroDmg: p.from === "enemy" ? p.dmg : 0, owner: p.from }); return true; }
    if (ch === "C") { this.breakTile(c, r, false); if (p.kind === "laser") return false; }
    FX.sparks(this.fx, p.x, p.y, 3, p.color || "#ffe9a8"); if (p.kind !== "laser") this.sfx.impact();
    return true;
  }
  projHitFoes(p) {
    // enemies
    for (const e of this.enemies) {
      if (e.dead || e.gone || !e.awake && Math.abs(e.x - this.hero.x) > 700) continue;
      if (p.hit && p.hit.has(e)) continue;
      if (!this.hitRect(p.x, p.y, p.r * 0.5, this.rect(e))) continue;
      if (p.kind === "rocket") { this.explode(p.x, p.y, p.splash, { enemyDmg: p.splashDmg, heroDmg: 0, owner: "hero", direct: e, directDmg: p.dmg }); return true; }
      const hitOk = this.damageEnemy(e, p.dmg, p);
      if (p.pierce > 0 && hitOk) { (p.hit ||= new Set()).add(e); p.pierce--; continue; }
      FX.sparks(this.fx, p.x, p.y, 3, hitOk ? "#ffe9a8" : "#9ff6ff"); return true;
    }
    // barrels
    for (const b of this.barrels) { if (b.dead) continue; if (this.hitRect(p.x, p.y, p.r * 0.5, { x: b.x - 15, y: b.y - 42, w: 30, h: 42 })) { if (p.kind === "rocket") { this.explode(p.x, p.y, p.splash, { enemyDmg: p.splashDmg, heroDmg: 0, owner: "hero" }); return true; } this.hitBarrel(b, p.dmg); FX.sparks(this.fx, p.x, p.y, 3); return true; } }
    // boss
    if (this.boss && (this.fight)) { const hr = this.boss.hitTest && this.boss.hitTest(p.x, p.y, p.r * 0.5); if (hr) { if (p.kind === "rocket") { this.explode(p.x, p.y, p.splash, { enemyDmg: p.splashDmg, heroDmg: 0, owner: "hero" }); return true; } this.boss.damage(this, p.dmg, hr.mul || 1, p); FX.sparks(this.fx, p.x, p.y, 4, "#ffe9a8"); if (p.pierce > 0) { p.pierce--; return false; } return true; } }
    return false;
  }
  projHitHero(p) {
    const H = this.hero; if (H.dead) return false;
    if (Math.abs(p.x - H.x) < H.w / 2 + p.r && p.y > H.y - H.h - p.r && p.y < H.y + p.r) {
      if (p.kind === "bomb" || p.kind === "rocket") { this.explode(p.x, p.y, p.boom || 70, { heroDmg: p.dmg, enemyDmg: 0, owner: "enemy" }); return true; }
      if (H.inv > 0) return false;
      this.hurtHero(p.dmg, p.x - p.vx * 0.1, p.kind); return true;
    }
    return false;
  }
  updateGrenade(p, dt) {
    const map = this.map;
    if (!p.stuck) {
      p.vy += p.g * dt; p.rot += p.vx * 0.02 * dt;
      let nx = p.x + p.vx * dt;
      if (map.solidAtPx(nx, p.y)) {
        // a grenade that hits a brick wall sticks to it and goes off a moment later (so "throw it at the wall" always works)
        if (map.ch(map.col(nx), map.row(p.y)) === "B") { p.stuck = true; p.vx = 0; p.vy = 0; p.life = Math.min(p.life, 0.3); this.sfx.click && this.sfx.click(); }
        else p.vx *= -0.5;
        nx = p.x;
      }
      p.x = nx;
      let ny = p.y + p.vy * dt;
      if (!p.stuck && (map.solidAtPx(p.x, ny + (p.vy > 0 ? 6 : -6)) || (p.vy > 0 && map.isOneWay(map.col(p.x), map.row(ny + 6)) && map.row(ny + 6) !== map.row(p.y + 6)))) { if (Math.abs(p.vy) > 160) { p.vy *= -0.42; p.vx *= 0.75; this.sfx.impact(); } else { p.vy = 0; p.vx *= 0.9; } ny = p.y; }
      p.y = p.stuck ? p.y : ny;
    }
    // a grenade that touches a foe goes off right away
    for (const e of this.enemies) if (!e.dead && !e.gone && this.hitRect(p.x, p.y, 4, this.rect(e))) { p.life = 0; break; }
    if (p.life <= 0) { this.explode(p.x, p.y, p.splash, { enemyDmg: p.splashDmg, heroDmg: 0, owner: "hero", tiles: true }); return true; }
    return false;
  }

  // ------------------------------------------------------------------------------------------------------------------ damage, explosions, destruction
  damageEnemy(e, dmg, p) {
    if (e.dead) return false;
    if (e.ch === "h" && p && p.from === "hero" && p.kind !== "rocket") { // the riot shield stops flat shots that come from the front
      const front = e.face, goingTo = sign(p.vx), steep = Math.abs(p.vy) > Math.abs(p.vx) * 0.85;
      if (goingTo === -front && !steep) { e.shieldHit = 0.14; this.sfx.impact(); FX.sparks(this.fx, p.x, p.y, 4, "#9ff6ff"); return false; }
    }
    e.hp -= dmg; e.flash = 0.09; e.hpShow = 2.2; if (p && p.knock) e.vx += sign(p.vx) * p.knock; else if (p && e.d.speed && e.ch !== "m") e.vx += sign(p.vx) * 30;
    if (e.ch === "g" || e.ch === "b") e.stun = 0.08;
    if (e.hp <= 0) this.killEnemy(e, "shot");
    return true;
  }
  killEnemy(e, cause) {
    if (e.dead) return; e.dead = 0.001; if (!e.minion) this.kills++; this.combo++; this.comboT = COMBO_WINDOW; const x = e.x, y = e.y - e.h / 2;
    this.addScore(e.d.pts, x, y - 24, "#fff6c4", e.ch === "m" ? 24 : 17, true);
    this.sfx.kill(); this.juice.hitstop(e.ch === "m" ? 0.12 : 0.03);
    if (e.ch === "d" || e.ch === "t" || e.ch === "j" || e.ch === "m") { FX.explosion(this.fx, x, y, e.ch === "m" ? 1.6 : 0.6); this.sfx.explode(); this.cam.shake(e.ch === "m" ? 9 : 3, 0.25); }
    else { FX.pop(this.fx, x, y, "#ffb703", 8); FX.smoke(this.fx, x, y, 9); }
    if (e.ch === "b") { // a bomber goes off whether you shot it or it reached you
      this.explode(e.x, e.y - 16, 84, { heroDmg: 30, enemyDmg: 6, owner: "enemy" });
    }
    if (cause === "self") { e.gone = true; }
    if (this.combo >= 5 && this.combo % 5 === 0) this.say(this.pick(QUIPS.streak), 1.8);
    // drops
    const H = this.hero, r = Math.random(), big = e.ch === "h" || e.ch === "m" || e.ch === "j";
    if (H.hp < 60 && r < (big ? 0.7 : 0.2)) this.items.push({ kind: "med", x, y: y - 6, ph: r * 6 });
    else if (r < (big ? 0.55 : 0.12)) this.items.push({ kind: "ammo", x, y: y - 6, ph: r * 6 });
    else if (r < (big ? 0.8 : 0.24)) this.items.push({ kind: "cash", x, y: y - 6, ph: r * 6 });
    else if (big && r < 0.9) this.items.push({ kind: "gren", x, y: y - 6, ph: r * 6 });
  }
  hitBarrel(b, dmg) { if (b.dead) return; b.hp -= dmg; b.flash = 0.1; if (b.hp <= 0) this.after(0.05, () => this.blowBarrel(b)); }
  blowBarrel(b) { if (b.dead) return; b.dead = true; this.explode(b.x, b.y - 20, 118, { heroDmg: 38, enemyDmg: 9, owner: "barrel", tiles: true }); }
  explode(x, y, radius, o = {}) {
    const { heroDmg = 0, enemyDmg = 0, owner = "enemy", tiles = true, direct = null, directDmg = 0 } = o;
    FX.explosion(this.fx, x, y, radius / 85); this.sfx.explode(); this.cam.shake(clamp(radius / 14, 3, 11), 0.28); this.juice.doFlash(0.1, "#ffe9a8");
    const H = this.hero;
    // foes
    for (const e of this.enemies) {
      if (e.dead || e.gone) continue; const cx = e.x, cy = e.y - e.h / 2, d = Math.hypot(cx - x, cy - y) - Math.max(e.w, e.h) * 0.3;
      if (e === direct) { this.damageEnemy(e, directDmg + enemyDmg * 0.5, null); continue; }
      if (d < radius) this.damageEnemy(e, enemyDmg * (1 - Math.max(0, d) / radius * 0.55), null);
    }
    // barrels chain
    for (const b of this.barrels) { if (b.dead) continue; if (Math.hypot(b.x - x, b.y - 20 - y) < radius) this.hitBarrel(b, 3); }
    // the boss
    if (this.boss && this.fight && enemyDmg > 0 && owner !== "enemy" && this.boss.splash) this.boss.splash(this, x, y, radius, enemyDmg * 0.8);
    // the hero
    if (heroDmg > 0 && !H.dead) { const d = Math.hypot(H.x - x, H.y - 28 - y); if (d < radius) this.hurtHero(heroDmg * (1 - d / radius * 0.5), x, "blast"); }
    // walls and crates
    if (tiles) {
      const c0 = this.map.col(x - radius), c1 = this.map.col(x + radius), r0 = this.map.row(y - radius), r1 = this.map.row(y + radius);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const ch = this.map.ch(c, r); if (ch !== "B" && ch !== "C") continue;
        if (Math.hypot((c + 0.5) * TS - x, (r + 0.5) * TS - y) < radius + 14) this.breakTile(c, r, true);
      }
    }
  }
  // crates are heavy: smash the one underneath and the ones stacked on top drop down (so a broken stack never hangs in mid-air)
  dropCratesAbove(c, r) {
    for (let rr = r - 1; rr >= 0 && this.map.ch(c, rr) === "C"; rr--) { this.map.set(c, rr, "."); this.fallers.push({ c, y: rr * TS, vy: 0, w: 0 }); }
  }
  updateFallers(dt) {
    if (!this.fallers.length) return;
    const map = this.map, H = this.hero, hit = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    for (let i = this.fallers.length - 1; i >= 0; i--) {
      const f = this.fallers[i]; f.w += dt; if (f.w < 0.07) continue; // a tiny beat of hang-time before they drop
      f.vy = Math.min(f.vy + 2400 * dt, 900); f.y += f.vy * dt;
      if (f.y > map.h + 100) { this.fallers.splice(i, 1); continue; }
      const rowB = map.row(f.y + TS);
      if (!(map.isSolid(f.c, rowB) || map.isOneWay(f.c, rowB))) continue;
      this.fallers.splice(i, 1);
      const lr = rowB - 1, cell = { x: f.c * TS, y: lr * TS, w: TS, h: TS }, x = (f.c + 0.5) * TS, y = (lr + 0.5) * TS;
      const crushed = (!H.dead && hit(cell, { x: H.x - H.w / 2, y: H.y - H.h, w: H.w, h: H.h })) || this.enemies.some((e) => !e.dead && !e.gone && hit(cell, this.rect(e)));
      if (crushed || map.ch(f.c, lr) !== ".") { FX.debris(this.fx, x, y, ["#d9a066", "#a8703a", "#7a4c22"], 8, 1); this.sfx.breakblock(); continue; } // landed on somebody: it just splinters
      map.set(f.c, lr, "C"); FX.dust(this.fx, x, (lr + 1) * TS - 4, 4); this.sfx.impact();
    }
  }
  breakTile(c, r, strong) {
    const ch = this.map.ch(c, r); if (ch !== "C" && ch !== "B") return;
    this.map.set(c, r, "."); const x = (c + 0.5) * TS, y = (r + 0.5) * TS;
    if (ch === "C") this.dropCratesAbove(c, r);
    FX.debris(this.fx, x, y, ch === "C" ? ["#d9a066", "#a8703a", "#7a4c22"] : ["#b4533e", "#8a3a2c", "#d9a08a"], 10, 1.1); FX.dust(this.fx, x, y, 5);
    this.sfx.breakblock(); this.addScore(ch === "C" ? 25 : 50, x, y - 20, "#fff", 13);
    if (ch === "C" && Math.random() < 0.3) { const k = this.hero.hp < 70 ? "med" : ["cash", "ammo", "cash", "gren"][Math.floor(Math.random() * 4)]; this.items.push({ kind: k, x, y: y + 8, ph: Math.random() * 6 }); }
    if (ch === "B") { for (let k = 0; k < 3; k++) this.after(0.05 * k, () => {}); this.say(this.pick(QUIPS.secret), 2); }
  }

  // ------------------------------------------------------------------------------------------------------------------ hints, arena, camera
  updateHints() {
    const H = this.hero; for (const h of this.hints) if (!h.shown && H.x >= h.x + 40) { h.shown = true; this.showTip(h.text, 5); }
  }
  updateArena(dt) {
    const a = this.arena; if (!a) return; const H = this.hero;
    if (!a.locked && H.x > a.x0 + 150 && !H.dead) {
      a.locked = true; this.fight = true;
      for (let r = 0; r <= FLOOR - 1; r++) this.map.set(this.map.col(a.x0), r, "X"); // the door slams shut behind you
      this.sfx.door(); this.cam.shake(6, 0.4); FX.dust(this.fx, a.x0 + 24, FLOOR * TS - 10, 12); this.showTip(this.boss ? `BOSS: ${this.boss.name}` : "Hold your ground!", 3); this.say(this.pick(QUIPS.boss), 2.4, true);
      this.snapshot = this.takeSnap(a.x0 + 100, FLOOR * TS);
      if (!this.quiet) music.play("boss");
    }
  }
  bossDefeated() {
    if (this.bossDown) return; this.bossDown = true; this.fight = false; this.projs = this.projs.filter((p) => p.from === "hero"); this.kills++; this.addScore(5000, this.boss.x, this.boss.y - 160, "#ffe27a", 30);
    this.juice.slowmo(0.9, 0.35); this.juice.doFlash(0.6, "#ffffff"); this.sfx.boom(); this.cam.shake(12, 0.8);
    for (let i = 0; i < 9; i++) this.after(0.2 + i * 0.22, () => { const b = this.boss, rc = b.rects ? b.rects()[0] : { x: b.x - 60, y: b.y - 120, w: 120, h: 120 }; FX.explosion(this.fx, rc.x + Math.random() * rc.w, rc.y + Math.random() * rc.h, 0.9); this.sfx.explode(); this.cam.shake(6, 0.2); });
    this.after(2.4, () => { const a = this.arena; this.goal = { x: a.x1 - 3.2 * TS, y: FLOOR * TS, open: true }; this.sfx.door(); this.showTip("Exit unlocked! Head for the door.", 4); FX.dust(this.fx, this.goal.x, this.goal.y - 20, 14); });
  }
  updateCamera(dt) {
    const H = this.hero, cam = this.cam, input = this.input;
    if (this.arena && this.arena.locked) { cam.x = damp(cam.x, this.arena.x0, 8, dt); cam.y = damp(cam.y, clamp(H.y - 380, 0, this.map.h - 540), 5, dt); cam.clamp(); return; }
    this.camLook = damp(this.camLook, (H.face || 1) * 120, 2.6, dt);
    const up = input && input.held("up") && !H.dead ? -50 : 0;
    cam.x = damp(cam.x, H.x + this.camLook + this.camShift - cam.w / 2, 7, dt);
    cam.y = damp(cam.y, clamp(H.y - 380 + up, 0, this.map.h - 540), 5, dt);
    cam.clamp();
  }
  snapCam() {
    const H = this.hero, cam = this.cam;
    if (this.arena && this.arena.locked) { cam.x = this.arena.x0; cam.y = clamp(H.y - 380, 0, this.map.h - 540); cam.clamp(); } else { cam.snap(H.x + 160 + this.camShift, H.y - 110); cam.y = clamp(H.y - 380, 0, this.map.h - 540); cam.clamp(); }
  }

  finishWin() {
    if (this.done) return; const H = this.hero, par = this.info.par;
    const timeBonus = Math.max(0, Math.round(par - this.time)) * 20, hpBonus = Math.round(H.hp) * 5;
    this.score += timeBonus + hpBonus;
    const allC = this.rescued >= this.citizensTotal, killPct = this.killsTotal ? this.kills / this.killsTotal : 1, flawless = this.deaths === 0 && killPct >= 0.75;
    const stars = 1 + (allC ? 1 : 0) + (flawless ? 1 : 0);
    this.done = {
      won: true, score: Math.round(this.score), stars, time: Math.round(this.time), title: stars === 3 ? "MISSION PERFECT!" : "MISSION COMPLETE", sub: this.lv.name, delay: 0.4,
      lines: [["Foes defeated", `${this.kills} / ${this.killsTotal}`], ["Citizens rescued", `${this.rescued} / ${this.citizensTotal}`], ["Deaths", String(this.deaths)], ["Time", `${secondsLabel(this.time)}  (par ${secondsLabel(par)})`], ["Time + health bonus", fmt(timeBonus + hpBonus)], ["2nd star", allC ? "Done: all citizens" : "Rescue all citizens"], ["3rd star", flawless ? "Done: no deaths, 75% foes" : "No deaths + 75% of foes"]],
    };
    this.finished = true;
  }

  // ------------------------------------------------------------------------------------------------------------------ drawing
  draw(g, env) {
    const cam = this.cam, t = this.t, map = this.map, H = this.hero;
    this.bd.draw(g, cam.x, cam.y, t, 960, 540, { camYFactor: 0.25 });
    cam.begin(g);
    drawTiles(g, map, cam, this.info.look, t);
    if (this.fallers.length) { const spr = cached("siege|crate", TS, TS, (gg, w) => TILE_PAINT.crate(gg, w), 2); for (const f of this.fallers) stamp(g, spr, f.c * TS, f.y, TS, TS); }
    for (const k of this.checkpoints) if (cam.visible(k.x - 40, k.y - 130, 90, 140)) A.drawCheckpoint(g, k, t);
    if (this.goal && cam.visible(this.goal.x - 50, this.goal.y - 160, 110, 170)) A.drawExit(g, this.goal.x, this.goal.y, t, this.goal.open);
    for (const c of this.citizens) if (cam.visible(c.x - 40, c.y - 120, 90, 130)) A.drawCitizen(g, c, t);
    for (const it of this.items) if (cam.visible(it.x - 40, it.y - 40, 80, 80)) A.drawItem(g, it, t);
    for (const b of this.barrels) if (!b.dead && cam.visible(b.x - 30, b.y - 60, 60, 70)) A.drawBarrel(g, b, t);
    for (const e of this.enemies) { if (e.gone || !cam.visible(e.x - 90, e.y - 160, 180, 200)) continue; A.drawEnemy(g, e, t, this); this.drawEnemyExtras(g, e, t); }
    if (this.boss && (this.fight || this.bossDown || (this.arena && cam.visible(this.arena.x0, 0, 960, 600)))) this.boss.draw(g, this, t);
    for (const s of this.shells) { g.fillStyle = "#ffd166"; g.fillRect(s.x - 1.5, s.y - 1, 3, 2); }
    this.drawHeroBody(g, t);
    for (const p of this.projs) if (cam.visible(p.x - 50, p.y - 50, 100, 100)) A.drawProj(g, p, t);
    this.fx.draw(g); this.fl.draw(g);
    if (!this.demo) this.drawSpeech(g);
    cam.end(g);
    if (!this.demo) this.drawHud(g);
    this.juice.draw(g, 960, 540);
    if (H.dead && H.deadT > 0.5) {
      g.save(); g.globalAlpha = clamp((H.deadT - 0.5) / 0.6, 0, 0.55); g.fillStyle = "#1a0510"; g.fillRect(0, 0, 960, 540); g.restore();
      text(g, "DOWN!", 480, 250, { size: 44, color: "#ff6a8a", align: "center", stroke: OUT, strokeW: 8, weight: 900, alpha: clamp((H.deadT - 0.5) * 3, 0, 1) });
    }
  }

  drawHeroBody(g, t) {
    const H = this.hero;
    if (!H.dead) {
      const fy = this.floorY(H.x, H.y - 4);
      if (fy - H.y < 220) { g.save(); g.globalAlpha = clamp(0.32 - (fy - H.y) / 700, 0.06, 0.32); ellipse(g, H.x, fy - 1, 18, 4, "#000"); g.restore(); }
      A.drawHero(g, H, t, H.weapon); return;
    }
    if (H.deadT > 1.15) return;
    g.save(); g.translate(H.x, H.y - 28); g.rotate(-H.face * clamp(H.deadT * 5, 0, 1.6)); g.globalAlpha = clamp(1.3 - H.deadT, 0, 1); g.translate(-H.x, -(H.y - 28));
    A.drawHero(g, { ...H, inv: 0, flashT: 0, crouch: false }, t, H.weapon); g.restore();
  }

  drawEnemyExtras(g, e, t) {
    if (e.ch === "s" && e.st === "aim" && !e.dead) {
      const x0 = e.x + e.face * 22, y0 = e.y - 46, a = Math.atan2((e.aimT < 1.0 ? this.hero.y - 30 : e.lockY) - y0, (e.aimT < 1.0 ? this.hero.x : e.lockX) - x0), len = 760;
      let L = len; for (let d = 30; d < len; d += 12) if (this.map.solidAtPx(x0 + Math.cos(a) * d, y0 + Math.sin(a) * d)) { L = d; break; }
      const locked = e.aimT > 1.0, flash = locked && Math.floor(t * 30) % 2;
      g.save(); g.globalCompositeOperation = "lighter"; g.strokeStyle = flash ? "#ffffff" : locked ? "rgba(255,90,90,.95)" : "rgba(255,90,90,.55)"; g.lineWidth = locked ? 3 : 1.6; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + Math.cos(a) * L, y0 + Math.sin(a) * L); g.stroke(); g.restore();
    }
    if (e.ch === "b" && e.arm && !e.dead) { g.save(); g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 22); text(g, "!", e.x, e.y - 60, { size: 24, color: "#ff5a5a", align: "center", stroke: OUT, strokeW: 4, weight: 900 }); g.restore(); }
  }

  drawSpeech(g) {
    const s = this.speech, H = this.hero; if (!s || H.dead) return;
    const k = clamp(s.t / 0.15, 0, 1) * clamp((s.dur - s.t) / 0.25, 0, 1); g.save(); g.globalAlpha = k;
    g.font = `700 14px ${FONT_DISPLAY}`; const w = g.measureText(s.text).width + 24, x = H.x - w / 2 + 20, y = H.y - 118 - (1 - k) * 8;
    fillRR(g, x, y, w, 30, 12, "#fff", OUT, 2.4); poly(g, [[H.x - 4, y + 29], [H.x + 8, y + 29], [H.x + 2, y + 40]], "#fff", OUT, 2.4); g.fillStyle = "#fff"; g.fillRect(H.x - 3, y + 27, 10, 4);
    text(g, s.text, x + w / 2, y + 20, { size: 14, color: "#24104a", align: "center", weight: 800 }); g.restore();
  }

  drawHud(g) {
    const H = this.hero, W = WEAPONS[H.weapon];
    // health, armour, weapon (top left)
    fillRR(g, 14, 12, 262, 68, 16, "rgba(14,6,36,.66)", "rgba(190,180,255,.28)", 1.5);
    text(g, "HP", 26, 33, { size: 9, color: "#c3bbea", font: FONT_PIXEL, weight: 400 });
    const hpT = H.hp / HERO.hp; A.hudBar(g, 52, 21, 150, 15, hpT, hpT > 0.5 ? "#3ee6e0" : hpT > 0.25 ? "#ffb703" : "#ff4a6a");
    text(g, String(Math.max(0, Math.ceil(H.hp))), 262, 35, { size: 16, color: "#fff", align: "right", weight: 800 });
    if (H.armor > 0) A.hudBar(g, 52, 40, 150, 8, H.armor / HERO.maxArmor, "#6fb8ff");
    g.save(); g.translate(30, 66); g.scale(0.62, 0.62); A.drawGun(g, H.weapon); g.restore();
    text(g, W.short, 56, 70, { size: 9, color: W.color, font: FONT_PIXEL, weight: 400 });
    text(g, H.ammo[H.weapon] === Infinity ? "∞" : String(H.ammo[H.weapon]), 150, 71, { size: 16, color: "#fff", align: "left", weight: 800 });
    for (let i = 0; i < Math.min(6, H.grenades); i++) circle(g, 196 + i * 12, 66, 4.6, "#8fae5a", OUT, 1.6);
    if (H.rage > 0) { fillRR(g, 14, 88, 130, 22, 11, "rgba(255,62,94,.78)", OUT, 2); text(g, `RAGE ${Math.ceil(H.rage)}s`, 79, 104, { size: 12, color: "#fff", align: "center", weight: 800 }); }
    // score and combo (top right, kept clear of the pause button)
    text(g, "SCORE", 884, 26, { size: 9, color: "#c3bbea", align: "right", font: FONT_PIXEL, weight: 400 });
    text(g, fmt(this.score), 884, 56, { size: 28, color: "#ffe27a", align: "right", stroke: OUT, strokeW: 5, weight: 900 });
    const m = this.mult();
    if (m > 1) { const k = clamp(this.comboT / COMBO_WINDOW, 0, 1); fillRR(g, 780, 66, 104, 24, 12, "rgba(255,62,165,.88)", OUT, 2); text(g, `COMBO x${m}`, 832, 83, { size: 12, color: "#fff", align: "center", weight: 800 }); fillRR(g, 786, 92, 92 * k, 3, 1.5, "#ffe27a"); }
    // mission progress + citizens (top centre)
    const pw = 330, px = 480 - pw / 2 + 4, py = 20; fillRR(g, px, py, pw, 8, 4, "rgba(14,6,36,.6)", "rgba(190,180,255,.3)", 1);
    const prog = clamp(H.x / this.map.w, 0, 1); fillRR(g, px + 1, py + 1, Math.max(6, (pw - 2) * prog), 6, 3, "#ff8a1f");
    for (const k of this.checkpoints) circle(g, px + (k.x / this.map.w) * pw, py + 4, 2.6, k.on ? "#7dff6a" : "#9a90c8");
    text(g, `${this.lv.label || this.lv.id}  ${this.lv.name}`, px + pw / 2, py + 26, { size: 12, color: "#e6e0ff", align: "center", weight: 700, stroke: OUT, strokeW: 4 });
    for (let i = 0; i < this.citizensTotal; i++) this.drawCitizenIcon(g, px + pw / 2 + (i - (this.citizensTotal - 1) / 2) * 24, 66, i < this.rescued);
    // boss bar
    if (this.boss && this.fight && !this.bossDown) {
      const bw = 460, bx = 250, by = 502; fillRR(g, bx - 6, by - 22, bw + 12, 38, 12, "rgba(14,6,36,.72)", "rgba(190,180,255,.3)", 1.5);
      text(g, this.boss.name.toUpperCase(), bx + bw / 2, by - 8, { size: 9, color: "#ffb7d2", align: "center", font: FONT_PIXEL, weight: 400 }); A.hudBar(g, bx, by, bw, 12, this.boss.hp / this.boss.max, "#ff4a6a");
    }
    // tips slide in under the mission name
    if (this.tip) {
      const k = clamp(this.tip.t / 0.2, 0, 1) * clamp((this.tip.dur - this.tip.t) / 0.4, 0, 1); g.save(); g.globalAlpha = k; g.font = `700 15px ${FONT_BODY}`;
      const w = Math.min(760, g.measureText(this.tip.text).width + 44), y = 92 + (1 - k) * -8;
      fillRR(g, 480 - w / 2, y, w, 36, 14, "rgba(14,6,36,.84)", "rgba(255,226,122,.7)", 2); text(g, this.tip.text, 480, y + 24, { size: 15, color: "#fff4cf", align: "center", weight: 700, font: FONT_BODY }); g.restore();
    }
  }
  drawCitizenIcon(g, x, y, on) {
    const o = on ? OUT : "rgba(190,180,255,.45)";
    circle(g, x, y - 6, 4.8, on ? "#ffcf9e" : "rgba(120,110,170,.35)", o, 1.6);
    fillRR(g, x - 6.5, y - 1, 13, 11, 4, on ? "#54d08c" : "rgba(120,110,170,.35)", o, 1.6);
  }
}
