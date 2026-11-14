// The shared "side-view adventure" engine used by the story-style platform games (puzzle escapes, jungle runs, stealth).
// A level is a list of text rows (see LEGEND). A game only supplies levels + a look (cfg); this file does movement, boxes and
// switches, patrolling hunters, crushers, chasers, lighting, checkpoints, scoring and drawing.
import { clamp, lerp, sign, damp, TAU, hash2, rng, secondsLabel } from "./util";
import { TileMap, moveBody, touchingHazard, bodiesOverlap, HERO_DEFAULT, heroControl } from "./platformer";
import { Particles, Floaters, Camera, Juice } from "./fx";
import { Backdrop } from "./backdrop";
import { drawTiles } from "./tiles";
import { text, ellipse, circle, capsule, fillRR, rr, glow, shadowBlob, star, hudChip, hudHearts, FONT_DISPLAY, FONT_BODY, OUT } from "./draw";
import { sfx as realSfx } from "./audio";
import { mix, shade, rgba } from "./util";

export const TS = 48;
// LEGEND (one character per tile)
//  # solid ground   X solid stone   = one-way plank   ^ spikes          S start       E exit        C checkpoint
//  c coin           $ relic         H heart           s spring          b box         k key         D locked door
//  1 2 3 pressure plates   7 8 9 gates (plate 1 opens 7, 2 opens 8, 3 opens 9)
//  m side-moving platform  M up/down platform         d crumbling platform
//  g walker   f flyer   t dart turret (shoots left)   T dart turret (shoots right)   V crusher   h hunter (guard)   z hiding spot
//  W water (slows, harmless)   r roll-smash block     n note (story text)   L lamp (light)
export const SOLID = "#X789Dr";
export const ENTS = "SECcH$sbkmMdgftThVzLn123";
const NOOP = new Proxy({}, { get: () => () => {} });

const P_PUZZLE = { ...HERO_DEFAULT, maxRun: 215, accel: 1800, decel: 2400, jumpV: 720, gravity: 2200, jumpCut: 0.5 };
const P_RUN = { ...HERO_DEFAULT, maxRun: 270, accel: 2100, decel: 2400, jumpV: 760, gravity: 2300, jumpCut: 0.46 };

export class SideSession {
  constructor(lv, ctx = {}, cfg = {}, opts = {}) {
    this.lv = lv; this.ctx = ctx; this.cfg = cfg; this.quiet = !!opts.quiet; this.bot = opts.bot || null;
    this.sfx = this.quiet ? NOOP : realSfx;
    this.run = cfg.mode === "run"; this.dark = !!lv.dark; this.P = this.run ? P_RUN : P_PUZZLE;
    const rows = lv.rows.slice(); const map = (this.map = new TileMap(rows, { ts: TS, solid: SOLID, oneway: "=", hazard: "^", ents: ENTS }));
    this.cam = new Camera(960, 540); this.cam.setBounds(0, 0, map.w, map.h);
    this.fx = new Particles(700); this.fl = new Floaters(); this.juice = new Juice();
    this.bd = opts.headless ? null : new Backdrop(lv.theme || cfg.theme || "cave", (lv.seed || 1) * 7 + 3);
    this.flawless = true; this.t = 0; this.time = 0; this.score = 0; this.coins = 0; this.coinsTotal = 0; this.relics = 0; this.deaths = 0; this.done = null; this.state = "play"; this.fade = 1; this.winT = 0; this.finished = false;
    this.items = []; this.springs = []; this.boxes = []; this.plates = []; this.gates = []; this.platforms = []; this.enemies = []; this.hunters = []; this.crushers = []; this.turrets = []; this.darts = [];
    this.lamps = []; this.notes = []; this.keys = []; this.hides = []; this.checkpoints = []; this.start = { x: 100, y: 400 }; this.exit = null; this.hasKey = false; this.alert = 0; this.msg = null; this.msgT = 0;
    const R = rng((lv.seed || 1) * 31 + 5);
    for (const e of map.ents) {
      const ph = R() * 6.28;
      switch (e.ch) {
        case "S": this.start = { x: e.x, y: e.y }; break;
        case "E": this.exit = { x: e.x, y: e.y, open: true }; break;
        case "C": this.checkpoints.push({ x: e.x, y: e.y, on: false }); break;
        case "c": this.items.push({ kind: "coin", x: e.x, y: e.y - 24, ph }); this.coinsTotal++; break;
        case "$": this.items.push({ kind: "relic", x: e.x, y: e.y - 26, ph }); break;
        case "H": this.items.push({ kind: "heart", x: e.x, y: e.y - 24, ph }); break;
        case "k": this.items.push({ kind: "key", x: e.x, y: e.y - 26, ph }); break;
        case "s": this.springs.push({ x: e.x, y: e.y, comp: 0, cd: 0 }); break;
        case "b": this.boxes.push({ x: e.x, y: e.y, w: 42, h: 42, vx: 0, vy: 0, onGround: false, home: { x: e.x, y: e.y } }); break;
        case "1": case "2": case "3": this.plates.push({ x: e.x, y: e.y, id: +e.ch, on: false, c: e.c, r: e.r }); break;
        case "m": this.platforms.push({ kind: "m", x: e.x - 48, y: e.y - 8, w: 96, h: 16, ox: e.x - 48, oy: e.y - 8, ax: 2.4 * TS, ay: 0, sp: 1.0, ph, oneway: true, dx: 0, dy: 0 }); break;
        case "M": this.platforms.push({ kind: "M", x: e.x - 48, y: e.y - 8, w: 96, h: 16, ox: e.x - 48, oy: e.y - 2.4 * TS, ax: 0, ay: 2.4 * TS, sp: 0.8, ph, oneway: true, dx: 0, dy: 0 }); break;
        case "d": this.platforms.push({ kind: "d", x: e.x - 48, y: e.y - 8, w: 96, h: 16, ox: e.x - 48, oy: e.y - 8, oneway: true, st: "idle", stT: 0, vy: 0, dx: 0, dy: 0 }); break;
        case "g": this.enemies.push({ ch: "g", x: e.x, y: e.y, w: 34, h: 28, vx: -50, vy: 0, dir: -1, onGround: false, hp: 1, ph }); break;
        case "f": this.enemies.push({ ch: "f", x: e.x, y: e.y - 96, w: 28, h: 26, vx: 0, vy: 0, bx: e.x, by: e.y - 96, ph, hp: 1 }); break;
        case "t": case "T": this.turrets.push({ x: e.x, y: e.y, dir: e.ch === "t" ? -1 : 1, cd: 1 + R() * 1.5, ph }); break;
        case "V": this.crushers.push({ x: e.x, y0: e.y - TS, y: e.y - TS, st: "wait", t: 0, c: e.c, r: e.r }); break;
        case "h": this.hunters.push({ x: e.x, y: e.y, w: 40, h: 76, dir: -1, vx: 0, vy: 0, st: "patrol", t: 0, home: e.x, range: 3.2 * TS, onGround: false, ph, lose: 0 }); break;
        case "z": this.hides.push({ x: e.x, y: e.y, w: TS, h: TS }); break;
        case "L": this.lamps.push({ x: e.x, y: e.y - 30, ph }); break;
        case "n": this.notes.push({ x: e.x, y: e.y, text: (lv.notes && lv.notes[this.notes.length]) || "", shown: false }); break;
        default: break;
      }
    }
    // gates: remember which tiles are gates so they can open and close
    for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) { const ch = map.cells[r][c]; if (ch === "7" || ch === "8" || ch === "9") this.gates.push({ c, r, ch, id: +ch - 6, open: 0 }); }
    this.doors = []; for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) if (map.cells[r][c] === "D") this.doors.push({ c, r });
    this.breaks = []; for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) if (map.cells[r][c] === "r") this.breaks.push({ c, r });
    this.hearts = this.run ? 3 : 1;
    const H = (this.hero = { x: this.start.x, y: this.start.y, w: this.run ? 28 : 24, h: this.run ? 38 : 40, vx: 0, vy: 0, face: 1, onGround: true, hp: this.hearts, inv: 0, dead: false, deadT: 0, roll: 0, rollCd: 0, step: 0, hidden: false, push: 0, crouch: false, water: false, runT: 0 });
    this.spawn = { x: this.start.x, y: this.start.y };
    this.chase = lv.chase ? { x: lv.chase.x0 ?? -200, speed: lv.chase.speed, on: false, trigger: (lv.chase.trigger ?? 4) * TS } : null;
    this.shownHints = new Set(); this.hintList = lv.hints || [];
    this.cam.snap(H.x, H.y - 60); this.camLook = 0;
    this.fx.clear();
    if (typeof window !== "undefined" && window.__QA_UNLOCK) window.__side = this;
  }

  // ---------------------------------------------------------------------------------------------------------------------- helpers
  solidRects() {
    const out = [];
    for (const b of this.boxes) out.push(b._r || (b._r = { x: 0, y: 0, w: 0, h: 0, box: b }));
    for (const b of this.boxes) { b._r.x = b.x - b.w / 2; b._r.y = b.y - b.h; b._r.w = b.w; b._r.h = b.h; }
    return out.concat(this.platforms.filter((p) => !p.dead));
  }
  floorAt(x, y) { const m = this.map; for (let r = m.row(y); r < m.rows; r++) if (m.isSolid(m.col(x), r) || m.isOneWay(m.col(x), r)) return r * TS; return m.h + 100; }
  say(str, ms = 3.6) { this.msg = str; this.msgT = ms; }
  burst(x, y, n, color, o = {}) { this.fx.burst(x, y, n, { color, speed: [40, 170], size: [2, 4.5], life: [0.3, 0.7], g: 500, ...o }); }

  // ---------------------------------------------------------------------------------------------------------------------- update
  update(dt0, input, env) {
    const dt = Math.min(dt0, 1 / 30); this.t += dt; this.juice.update(dt);
    const sdt = this.juice.step(dt); const H = this.hero;
    this.fx.update(sdt); this.fl.update(sdt);
    if (this.fade > 0) this.fade = Math.max(0, this.fade - dt * 1.8);
    if (this.msgT > 0) this.msgT -= dt;
    if (this.state === "win") { this.winT += dt; this.cam.update(dt); if (this.winT > 0.8 && !this.done) this.finish(); return; }
    if (sdt === 0) return;
    this.time += sdt;
    const inp = this.bot ? this.bot.think(this, dt) : this.readInput(input);
    if (H.dead) { H.deadT += sdt; this.cam.update(dt); if (H.deadT > 0.95) this.respawn(); this.updateWorld(sdt); return; }
    this.updateHero(sdt, inp);
    this.updateWorld(sdt);
    this.checkHazards(sdt);
    this.updateCamera(dt);
  }
  readInput(input) {
    const dir = input.axis("left", "right");
    return { dir, jumpPressed: input.pressed("jump") || input.pressed("up"), jumpHeld: input.held("jump") || input.held("up"), down: input.held("down"), act: input.pressed("fire") || input.pressed("alt"), actHeld: input.held("fire") || input.held("alt") };
  }

  updateHero(dt, inp) {
    const H = this.hero, map = this.map, P = this.P;
    const solids = this.solidRects();
    H.crouch = !this.run && inp.down && H.onGround;
    // the hunter sees you less when you crouch; hide spots hide you completely
    H.hidden = false; if (!this.run) for (const z of this.hides) if (Math.abs(H.x - (z.x)) < TS * 0.55 && Math.abs((H.y - 6) - z.y) < TS * 0.6 && inp.down) H.hidden = true;
    if (this.run) {
      H.rollCd = Math.max(0, H.rollCd - dt);
      if (inp.act && H.roll <= 0 && H.rollCd <= 0 && H.onGround) { H.roll = 0.5; H.rollCd = 0.55; H.vx = H.face * 430; this.sfx.swing(); this.burst(H.x, H.y - 4, 6, "#e8d7a8", { speed: [20, 80], g: -50 }); }
    }
    if (H.roll > 0) { H.roll -= dt; if (H.hitL || H.hitR) H.roll = 0; }
    const water = this.inWater(H); H.water = water;
    // box pushing: walking into a box moves it, slowly
    H.push = 0;
    const ctl = { speedMul: (H.crouch ? 0.45 : 1) * (water ? 0.6 : 1) * (H.hidden ? 0.01 : 1), jumpMul: water ? 0.85 : 1 };
    if (!this.run) for (const b of this.boxes) {
      if (Math.abs(inp.dir) > 0 && H.y > b.y - b.h + 6 && H.y - H.h < b.y - 4) {
        const gap = (H.x - b.x) * inp.dir; // negative: the box is in front
        if (gap < 0 && Math.abs(H.x - b.x) < (H.w + b.w) / 2 + 3) { b.vx = inp.dir * 96; H.push = inp.dir; ctl.speedMul *= 0.5; }
      }
    }
    if (H.roll > 0) { const hv = H.vx; heroControl(H, { dir: 0, jumpPressed: inp.jumpPressed, jumpHeld: inp.jumpHeld }, dt, P, ctl); H.vx = hv; } else heroControl(H, inp, dt, P, ctl);
    const was = H.onGround, vy0 = H.vy;
    moveBody(map, H, dt, { solids, dropThrough: inp.down && this.run });
    if (H.platform && H.platform.dx !== undefined) { H.x += H.platform.dx; H.y += H.platform.dy; }
    if (H.onGround && !was && vy0 > 300) { this.sfx.land(); this.burst(H.x, H.y, 5, "#cbbd9a", { speed: [20, 70], g: 80, angle: [Math.PI, TAU], life: [0.2, 0.4] }); }
    if (inp.jumpPressed && was && !H.onGround) this.sfx.jump();
    if (H.onGround && Math.abs(H.vx) > 60) { H.step += dt * Math.abs(H.vx) / 40; if (Math.floor(H.step) % 2 === 0 && Math.random() < dt * 5) this.sfx.step && this.sfx.step(); }
    H.runT += dt * (H.onGround ? Math.abs(H.vx) / 70 : 2);
    if (H.inv > 0) H.inv -= dt;
    if (H.fell) this.kill("fall");
  }

  inWater(H) { const c = this.map.col(H.x), r = this.map.row(H.y - 10); return this.map.cells[r] && this.map.cells[r][c] === "W"; }

  updateWorld(dt) {
    const H = this.hero, map = this.map, t = this.t;
    // platforms
    for (const p of this.platforms) {
      if (p.kind === "m" || p.kind === "M") { const px = p.x, py = p.y; const k = Math.sin(t * p.sp + p.ph) * 0.5 + 0.5; p.x = lerp(p.ox - (p.kind === "m" ? p.ax / 2 : 0), p.ox + (p.kind === "m" ? p.ax / 2 : 0), k); p.y = p.kind === "M" ? lerp(p.oy, p.oy + p.ay, k) : p.y; p.dx = p.x - px; p.dy = p.y - py; }
      else if (p.kind === "d") {
        p.dx = 0; p.dy = 0;
        if (p.st === "idle" && !H.dead && H.onGround && H.platform === p) { p.st = "shake"; p.stT = 0.55; }
        if (p.st === "shake") { p.stT -= dt; if (p.stT <= 0) { p.st = "fall"; p.vy = 0; p.oneway = true; } }
        if (p.st === "fall") { p.vy += 1400 * dt; p.y += p.vy * dt; p.dy = p.vy * dt; if (p.y > map.h + 100) { p.dead = true; p.stT = 3; } }
        if (p.dead) { p.stT -= dt; if (p.stT <= 0) { p.dead = false; p.st = "idle"; p.x = p.ox; p.y = p.oy; p.vy = 0; } }
      }
    }
    // boxes
    const solids = this.solidRects();
    for (const b of this.boxes) {
      if (!b.vx && b.onGround && !b.held) { /* resting */ }
      const others = solids.filter((s) => s.box !== b);
      b.vy = Math.min(900, b.vy + 2200 * dt); const vx0 = b.vx;
      if (b.onGround) b.vx *= Math.max(0, 1 - 14 * dt); // friction
      if (Math.abs(b.vx) < 4) b.vx = 0;
      moveBody(map, b, dt, { solids: others });
      if (b.platform && b.platform.dx !== undefined) { b.x += b.platform.dx; b.y += b.platform.dy; }
      if (b.fell) { b.x = b.home.x; b.y = b.home.y; b.vx = b.vy = 0; }
      // box crushed against hero from above is harmless; a falling box does not hurt in these games
    }
    // plates
    for (const pl of this.plates) {
      let on = false; const px = pl.x, py = pl.y;
      if (!H.dead && Math.abs(H.x - px) < TS * 0.45 && Math.abs(H.y - py) < 6) on = true;
      for (const b of this.boxes) if (Math.abs(b.x - px) < TS * 0.55 && Math.abs(b.y - py) < 8) on = true;
      for (const e of this.enemies) if (!e.gone && e.ch === "g" && Math.abs(e.x - px) < TS * 0.5 && Math.abs(e.y - py) < 8) on = true;
      if (on !== pl.on) { pl.on = on; this.sfx.click && this.sfx.click(); if (on) this.burst(px, py - 4, 8, "#7fe8ff", { g: -80 }); }
    }
    for (const g of this.gates) {
      const open = this.plates.some((p) => p.id === g.id && p.on) || (this.lv.gateFlip && false);
      const want = open ? 1 : 0;
      if (want && map.cells[g.r][g.c] !== ".") { map.cells[g.r][g.c] = "."; this.sfx.door && this.sfx.door(); }
      if (!want && map.cells[g.r][g.c] === ".") { // close only if nothing stands in the doorway
        const gx = g.c * TS, gy = g.r * TS; const blocked = (Math.abs(H.x - (gx + TS / 2)) < H.w / 2 + TS / 2 - 1 && H.y > gy && H.y - H.h < gy + TS) || this.boxes.some((b) => Math.abs(b.x - (gx + TS / 2)) < b.w / 2 + TS / 2 - 1 && b.y > gy && b.y - b.h < gy + TS);
        if (!blocked) { map.cells[g.r][g.c] = g.ch; }
      }
      g.open = damp(g.open, map.cells[g.r][g.c] === "." ? 1 : 0, 10, dt);
    }
    // springs
    for (const s of this.springs) {
      s.comp = Math.max(0, s.comp - dt * 5); s.cd = Math.max(0, s.cd - dt);
      if (!H.dead && s.cd <= 0 && H.vy >= 0 && Math.abs(H.x - s.x) < 26 && H.y > s.y - 18 && H.y < s.y + 10) { H.vy = -1120; H.onGround = false; H.jumping = false; s.comp = 1; s.cd = 0.25; this.sfx.spring(); this.burst(s.x, s.y - 6, 7, "#fff"); }
    }
    // items
    for (const it of this.items) {
      if (it.got || H.dead) continue;
      if (Math.abs(H.x - it.x) < 26 && Math.abs((H.y - H.h / 2) - it.y) < 34) {
        it.got = true;
        if (it.kind === "coin") { this.coins++; this.score += 10; this.sfx.coin(); this.burst(it.x, it.y, 5, "#ffd23a", { g: 0 }); }
        else if (it.kind === "relic") { this.relics++; this.score += 500; this.sfx.gem(); this.sfx.star && this.sfx.star(); this.burst(it.x, it.y, 18, "#7fe8ff", { speed: [60, 220] }); this.fl.add(it.x, it.y - 20, `${this.cfg.relicName || "Relic"} ${this.relics}/3`, "#bff4ff", 17); this.juice.doFlash(0.18, "#bff4ff"); }
        else if (it.kind === "heart") { if (H.hp < 3) { H.hp++; this.sfx.heal(); this.fl.add(it.x, it.y, "+♥", "#ff6aa8", 20); } else { this.score += 50; this.sfx.coin(); } }
        else if (it.kind === "key") { this.hasKey = true; this.sfx.key(); this.fl.add(it.x, it.y - 10, "Key!", "#ffe27a", 18); this.burst(it.x, it.y, 12, "#ffe27a"); }
      }
    }
    // locked doors
    if (this.hasKey) for (const d of this.doors) { if (map.cells[d.r][d.c] === "D" && Math.abs(H.x - (d.c + 0.5) * TS) < TS * 0.9 && H.y > d.r * TS && H.y - H.h < (d.r + 1) * TS + 6) { for (const dd of this.doors) { map.cells[dd.r][dd.c] = "."; this.burst((dd.c + 0.5) * TS, (dd.r + 0.5) * TS, 10, "#c9a56a"); } this.hasKey = false; this.sfx.door(); this.say("Unlocked!", 1.4); } }
    // roll-smash blocks
    if (H.roll > 0) for (const b of this.breaks) { if (map.cells[b.r][b.c] === "r" && Math.abs(H.x + H.face * 22 - (b.c + 0.5) * TS) < 30 && H.y > b.r * TS && H.y - H.h < (b.r + 1) * TS) { map.cells[b.r][b.c] = "."; this.sfx.breakblock(); this.burst((b.c + 0.5) * TS, (b.r + 0.5) * TS, 14, "#b98a52", { speed: [60, 240] }); this.cam.shake(4, 0.2); this.score += 25; } }
    // checkpoints
    for (const c of this.checkpoints) if (!c.on && !H.dead && Math.abs(H.x - c.x) < 40 && Math.abs(H.y - c.y) < 70) { c.on = true; this.spawn = { x: c.x, y: c.y }; this.sfx.checkpoint(); this.say("Checkpoint", 1.3); this.burst(c.x, c.y - 40, 14, "#9fffd0", { g: -60 }); for (const o of this.checkpoints) if (o !== c) o.on = o.on && false; c.on = true; }
    // story notes + hints
    for (const n of this.notes) if (!n.shown && n.text && Math.abs(H.x - n.x) < 70) { n.shown = true; this.say(n.text, 5.5); }
    for (const [col, s] of this.hintList) if (!this.shownHints.has(col) && H.x > col * TS) { this.shownHints.add(col); this.say(s, 5); }
    // enemies
    for (const e of this.enemies) this.updateEnemy(e, dt);
    // turrets + darts
    for (const tu of this.turrets) {
      tu.cd -= dt; const near = Math.abs(H.x - tu.x) < 15 * TS && Math.abs(H.y - tu.y) < 8 * TS;
      if (tu.cd <= 0 && near) { tu.cd = 2.1; this.darts.push({ x: tu.x + tu.dir * 20, y: tu.y - 22, vx: tu.dir * 330, life: 4 }); this.sfx.swing && this.sfx.swing(); }
    }
    for (let i = this.darts.length - 1; i >= 0; i--) {
      const d = this.darts[i]; d.x += d.vx * dt; d.life -= dt;
      if (map.solidAtPx(d.x, d.y) || d.life <= 0) { this.burst(d.x, d.y, 4, "#ddd", { g: 100 }); this.darts.splice(i, 1); continue; }
      if (!H.dead && Math.abs(d.x - H.x) < H.w / 2 + 6 && d.y > H.y - H.h - 4 && d.y < H.y + 2) { this.darts.splice(i, 1); this.hurt("dart"); }
    }
    // crushers
    for (const c of this.crushers) {
      if (c.st === "wait") { if (!H.dead && Math.abs(H.x - c.x) < 80 && H.y > c.y0 && H.y < c.y0 + 8 * TS) { c.st = "warn"; c.t = 0.5; } }
      else if (c.st === "warn") { c.t -= dt; if (c.t <= 0) { c.st = "fall"; c.vy = 0; } }
      else if (c.st === "fall") { c.vy = Math.min(1100, (c.vy || 0) + 3200 * dt); c.y = (c.y ?? c.y0) + c.vy * dt; const fl = this.floorAt(c.x, c.y + 34); if (c.y + 38 >= fl) { c.y = fl - 38; c.st = "rest"; c.t = 1.1; this.cam.shake(6, 0.25); this.sfx.thudStone && this.sfx.thudStone(); this.burst(c.x, fl - 4, 12, "#9a8f7c", { g: 200, speed: [30, 120] }); } }
      else if (c.st === "rest") { c.t -= dt; if (c.t <= 0) c.st = "rise"; }
      else if (c.st === "rise") { c.y -= 170 * dt; if (c.y <= c.y0) { c.y = c.y0; c.st = "wait"; } }
      if ((c.st === "fall" || c.st === "rest") && !H.dead && Math.abs(H.x - c.x) < 34 + H.w / 2 - 6 && H.y > c.y - 4 && H.y - H.h < c.y + 40) { this.kill("crush"); }
    }
    // hunters (the guards)
    for (const h of this.hunters) this.updateHunter(h, dt);
    // chase wall
    if (this.chase) {
      const C = this.chase; if (!C.on && H.x > C.trigger) { C.on = true; this.say("It's coming. Run!", 2.2); this.cam.shake(5, 0.6); }
      if (C.on) { C.x += C.speed * dt * (1 + Math.max(0, (H.x - C.x - 900)) / 1600); this.alert = clamp((600 - (H.x - C.x)) / 600, 0, 1); if (!H.dead && H.x - H.w / 2 < C.x) this.kill("chase"); }
      this.sfxT = (this.sfxT || 0) - dt;
    }
    // exit
    if (this.exit && this.state === "play" && !H.dead && Math.abs(H.x - this.exit.x) < 40 && Math.abs(H.y - this.exit.y) < 70) { this.state = "win"; this.winT = 0; this.sfx.win && this.sfx.win(); this.burst(this.exit.x, this.exit.y - 40, 26, "#ffe27a", { speed: [80, 300] }); this.juice.doFlash(0.25, "#fff2c0"); H.vx = 0; }
  }

  updateEnemy(e, dt) {
    if (e.gone) return; const H = this.hero, map = this.map;
    if (e.ch === "g") {
      e.vy = Math.min(900, e.vy + 2200 * dt); moveBody(map, e, dt, { solids: this.boxes.map((b) => b._r).filter(Boolean) });
      const ahead = map.col(e.x + e.dir * (e.w / 2 + 6)), below = map.row(e.y + 6);
      if (e.hitL || e.hitR || (e.onGround && !map.isSolid(ahead, below) && !map.isOneWay(ahead, below))) { e.dir *= -1; }
      e.vx = e.dir * 56; e.face = e.dir;
    } else if (e.ch === "f") {
      e.x = e.bx + Math.sin(this.t * 1.2 + e.ph) * 90; e.y = e.by + Math.sin(this.t * 2.4 + e.ph) * 26; e.face = Math.cos(this.t * 1.2 + e.ph) > 0 ? 1 : -1;
    }
    if (H.dead) return;
    if (Math.abs(H.x - e.x) < (H.w + e.w) / 2 - 3 && H.y > e.y - e.h && H.y - H.h < e.y) {
      const stomping = H.vy > 120 && H.y - 8 < e.y - e.h * 0.55;
      if (H.roll > 0 && e.ch === "g") { this.defeat(e, "roll"); }
      else if (stomping) { this.defeat(e, "stomp"); H.vy = -520; H.jumping = false; if (this.bot === null) { /* bounce held by jump */ } }
      else if (H.inv <= 0) { this.hurt(e.ch === "g" ? "walker" : "flyer"); }
    }
  }
  defeat(e, how) {
    e.gone = true; this.stompCount = (this.stompCount || 0) + 1; this.score += 100; this.sfx.stomp(); this.juice.hitstop(0.05); this.cam.shake(3, 0.12);
    this.burst(e.x, e.y - 12, 12, how === "roll" ? "#ffc27a" : "#ff8fb0", { speed: [60, 240] }); this.fl.add(e.x, e.y - 30, "+100", "#fff", 16);
  }

  updateHunter(h, dt) {
    const H = this.hero, map = this.map; h.t += dt; h.vy = Math.min(900, h.vy + 2200 * dt);
    const seeing = () => {
      if (H.dead || H.hidden) return false; const dx = H.x - h.x, dy = (H.y - H.h / 2) - (h.y - h.h * 0.8);
      const range = (H.crouch ? 4.2 : 7) * TS; if (Math.abs(dx) > range || Math.abs(dy) > 2.2 * TS) return false; if (sign(dx) !== h.dir && Math.abs(dx) > 50) return false;
      // line of sight is blocked by walls
      const n = 12; for (let i = 1; i < n; i++) { if (map.solidAtPx(lerp(h.x, H.x, i / n), lerp(h.y - h.h * 0.8, H.y - H.h / 2, i / n))) return false; } return true;
    };
    const saw = seeing();
    if (h.st === "patrol") {
      h.vx = h.dir * 52; if (h.x > h.home + h.range) h.dir = -1; if (h.x < h.home - h.range) h.dir = 1;
      if (saw) { h.st = "notice"; h.t = 0; this.sfx.alarm && this.sfx.alarm(); this.fl.add(h.x, h.y - h.h - 10, "!", "#ff5a5a", 26); }
    } else if (h.st === "notice") { h.vx = 0; h.dir = sign(H.x - h.x) || h.dir; if (h.t > 0.45) { h.st = "chase"; h.lose = 0; } }
    else if (h.st === "chase") {
      h.dir = sign(H.x - h.x) || h.dir; h.vx = h.dir * 168; if (saw) h.lose = 0; else h.lose += dt; if (h.lose > 3 || H.hidden) { h.st = "search"; h.t = 0; }
    } else if (h.st === "search") { h.vx = 0; if (h.t > 1.2) { h.st = "patrol"; h.home = h.x; } if (saw) { h.st = "notice"; h.t = 0; } }
    moveBody(map, h, dt);
    if (h.hitL || h.hitR) { h.dir *= -1; if (h.st === "chase") { h.vx = 0; } }
    if (!h.dead && !H.dead && !H.hidden && h.st === "chase" && Math.abs(H.x - h.x) < (H.w + h.w) / 2 && H.y > h.y - h.h && H.y - H.h < h.y) this.kill("caught");
    this.alert = Math.max(this.alert, h.st === "chase" ? 1 : h.st === "notice" ? 0.7 : 0);
  }

  checkHazards(dt) {
    const H = this.hero; if (H.dead) return;
    if (touchingHazard(this.map, H, 7)) { if (this.run) this.hurt("spikes"); else this.kill("spikes"); }
  }
  hurt(why) {
    const H = this.hero; if (H.dead || H.inv > 0) return;
    if (!this.run) { this.kill(why); return; }
    H.hp--; this.flawless = false; this.sfx.hurt(); this.cam.shake(6, 0.25); this.juice.hitstop(0.07); this.burst(H.x, H.y - 18, 14, "#ff7a8a");
    if (H.hp <= 0) { this.kill(why); return; }
    H.inv = 1.3; H.vy = -420; H.vx = -H.face * 220;
  }
  kill(why) {
    const H = this.hero; if (H.dead) return; H.dead = true; H.deadT = 0; this.deaths++; this.flawless = false; this.sfx.die && this.sfx.die(); this.cam.shake(7, 0.35); this.juice.hitstop(0.08);
    this.burst(H.x, H.y - 18, why === "crush" ? 22 : 16, why === "caught" || why === "chase" ? "#220a0a" : "#c33a46", { speed: [60, 280] }); this.deathWhy = why;
  }
  respawn() {
    const H = this.hero; H.dead = false; H.deadT = 0; H.x = this.spawn.x; H.y = this.spawn.y; H.vx = H.vy = 0; H.hp = this.hearts; H.inv = 1.0; H.roll = 0; this.fade = 1;
    for (const h of this.hunters) { h.st = "patrol"; h.x = h.home; h.vx = 0; h.lose = 0; }
    this.darts.length = 0; if (this.chase) { const behind = Math.max(this.chase.x0 ?? -200, H.x - 900); this.chase.x = Math.min(this.chase.x, behind); if (H.x < this.chase.trigger) { this.chase.on = false; this.chase.x = this.lv.chase.x0 ?? -200; } }
    for (const c of this.crushers) { c.st = "wait"; c.y = c.y0; }
    this.alert = 0; this.cam.snap(H.x, H.y - 60);
    for (const e of this.enemies) if (e.ch === "g" && !e.gone) { /* keep */ }
  }

  updateCamera(dt) {
    const H = this.hero, cam = this.cam;
    this.camLook = damp(this.camLook, H.face * (this.run ? 120 : 60) + (Math.abs(H.vx) > 100 ? sign(H.vx) * 30 : 0), 3, dt);
    cam.follow(H.x + this.camLook, H.y - 70, dt, this.run ? 6 : 5); cam.update(dt);
  }

  // ---------------------------------------------------------------------------------------------------------------------- finishing
  finish() {
    const par = this.lv.parTime || 90, time = Math.round(this.time * 10) / 10, parDeaths = this.lv.parDeaths ?? (this.run ? 0 : 3);
    const timeBonus = Math.max(0, Math.round((par - time) * 8)), coinB = this.coinsTotal > 0 && this.coins >= this.coinsTotal ? 400 : 0, deathPen = this.deaths * 60;
    const total = Math.max(0, Math.round(this.score + timeBonus + coinB + (this.run && this.flawless ? 300 : 0) - deathPen) + 200);
    const second = this.relics >= 3, third = this.run ? time <= par : this.deaths <= parDeaths;
    const stars = 1 + (second ? 1 : 0) + (third ? 1 : 0);
    const lines = [];
    lines.push([this.cfg.relicName ? `${this.cfg.relicName}s ★` : "Relics ★", `${this.relics} / 3`]);
    if (this.coinsTotal) lines.push([this.cfg.coinName || "Coins", `${this.coins} / ${this.coinsTotal}${coinB ? "  +400" : ""}`]);
    lines.push(["Time", `${secondsLabel(time)}  (par ${secondsLabel(par)})`], ["Time bonus", `+${timeBonus}`]);
    lines.push([this.run ? "Clean run (no damage)" : "Tries", this.run ? (this.flawless ? "+300" : "—") : `${this.deaths + 1} ${this.deaths <= parDeaths ? "★" : ""}`]);
    if (this.deaths) lines.push([this.run ? "Defeats" : "Falls & catches", `-${deathPen}`]);
    this.finished = true;
    this.done = { won: true, score: total, stars, lines, title: this.lv.last ? "THE END" : "LEVEL CLEAR!", sub: `${stars === 3 ? "Perfect! " : ""}${this.lv.name}`, time, delay: 0.2 };
  }

  // ---------------------------------------------------------------------------------------------------------------------- drawing
  draw(g, env) {
    const cam = this.cam, t = this.t, map = this.map, H = this.hero, cfg = this.cfg, art = cfg.art || {};
    if (this.bd) this.bd.draw(g, cam.x, cam.y, t, 960, 540); else { g.fillStyle = "#111"; g.fillRect(0, 0, 960, 540); }
    if (this.lv.tint) { g.fillStyle = this.lv.tint; g.fillRect(0, 0, 960, 540); }
    cam.begin(g);
    drawTiles(g, map, cam, this.lv.look || cfg.look || "cave", t);
    this.drawGates(g, t);
    for (const p of this.plates) this.drawPlate(g, p);
    for (const c of this.checkpoints) if (cam.visible(c.x - 40, c.y - 100, 100, 110)) this.drawCheckpoint(g, c, t);
    if (this.exit) this.drawExit(g, t);
    for (const s of this.springs) this.drawSpring(g, s, t);
    for (const p of this.platforms) if (!p.dead && cam.visible(p.x, p.y - 20, p.w, 60)) this.drawPlatform(g, p, t);
    for (const z of this.hides) this.drawHide(g, z, t, false);
    for (const tu of this.turrets) this.drawTurret(g, tu, t);
    for (const c of this.crushers) this.drawCrusher(g, c, t);
    for (const n of this.notes) this.drawNote(g, n, t);
    for (const it of this.items) if (!it.got && cam.visible(it.x - 40, it.y - 40, 80, 80)) this.drawItem(g, it, t);
    for (const b of this.boxes) this.drawBox(g, b, t);
    for (const e of this.enemies) if (!e.gone && cam.visible(e.x - 60, e.y - 80, 120, 140)) this.drawEnemy(g, e, t);
    for (const h of this.hunters) this.drawHunter(g, h, t);
    for (const d of this.darts) { g.fillStyle = "#e9e2cf"; g.fillRect(d.x - 10, d.y - 1.5, 20, 3); g.fillStyle = "#ff5a5a"; g.fillRect(d.x + (d.vx > 0 ? 6 : -10), d.y - 2, 4, 4); }
    if (!H.dead) { if (!this.run) { const fl = this.floorAt(H.x, H.y - 3); shadowBlob(g, H.x, fl, 16, 4, 0.25 * clamp(1 - (fl - H.y) / 200, 0, 1)); } this.drawHero(g, t); }
    for (const z of this.hides) this.drawHide(g, z, t, true);
    this.fx.draw(g); this.fl.draw(g);
    if (this.chase && this.chase.on) this.drawChase(g, t);
    cam.end(g);
    this.drawLighting(g, t);
    this.drawOverlay(g, t);
  }

  // ---- sprites -------------------------------------------------------------------------------------------------------------------
  drawHero(g, t) {
    const H = this.hero, art = this.cfg.art || {}; if (H.inv > 0 && Math.floor(t * 18) % 2 && this.run) return;
    const hidden = H.hidden; g.save(); if (hidden) g.globalAlpha = 0.35;
    (art.hero || drawKid)(g, H, t, this.cfg);
    g.restore();
  }
  drawItem(g, it, t) {
    const bob = Math.sin(t * 3 + it.ph) * 3;
    if (it.kind === "coin") { const w = Math.abs(Math.cos(t * 5 + it.ph)) * 8 + 2.5; g.save(); g.translate(it.x, it.y + bob); glow(g, 0, 0, 18, this.cfg.coinColor || "#ffd23a", 0.25); ellipse(g, 0, 0, w, 10, this.cfg.coinColor || "#ffc61a", OUT, 2); g.restore(); }
    else if (it.kind === "relic") { g.save(); g.translate(it.x, it.y + bob); glow(g, 0, 0, 34, this.cfg.relicColor || "#7fe8ff", 0.5 + 0.2 * Math.sin(t * 4)); g.rotate(Math.sin(t * 1.6 + it.ph) * 0.2); g.beginPath(); g.moveTo(0, -17); g.lineTo(12, 0); g.lineTo(0, 17); g.lineTo(-12, 0); g.closePath(); g.fillStyle = this.cfg.relicColor || "#7fe8ff"; g.fill(); g.lineWidth = 2.5; g.strokeStyle = OUT; g.stroke(); g.fillStyle = "rgba(255,255,255,.7)"; g.fillRect(-2, -10, 4, 10); g.restore(); }
    else if (it.kind === "heart") { g.save(); g.translate(it.x, it.y + bob); glow(g, 0, 0, 22, "#ff5aa0", 0.3); g.fillStyle = "#ff4d8d"; g.strokeStyle = OUT; g.lineWidth = 2.4; g.beginPath(); g.moveTo(0, 9); g.bezierCurveTo(-18, -4, -9, -16, 0, -6); g.bezierCurveTo(9, -16, 18, -4, 0, 9); g.fill(); g.stroke(); g.restore(); }
    else if (it.kind === "key") { g.save(); g.translate(it.x, it.y + bob); glow(g, 0, 0, 26, "#ffe27a", 0.45); g.strokeStyle = "#ffd75e"; g.lineWidth = 4; g.beginPath(); g.arc(-6, 0, 7, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(1, 0); g.lineTo(16, 0); g.moveTo(11, 0); g.lineTo(11, 7); g.moveTo(16, 0); g.lineTo(16, 6); g.stroke(); g.restore(); }
  }
  drawBox(g, b, t) {
    const x = b.x - b.w / 2, y = b.y - b.h; fillRR(g, x, y, b.w, b.h, 4, this.cfg.boxColor || "#8a6a45", OUT, 2.5);
    g.strokeStyle = "rgba(0,0,0,.35)"; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 4, y + 4); g.lineTo(x + b.w - 4, y + b.h - 4); g.moveTo(x + b.w - 4, y + 4); g.lineTo(x + 4, y + b.h - 4); g.stroke();
    g.fillStyle = "rgba(255,255,255,.14)"; g.fillRect(x + 3, y + 3, b.w - 6, 5);
  }
  drawPlate(g, p) { const d = p.on ? 3 : 7; const col = ["", "#7fe8ff", "#ffb35c", "#c58cff"][p.id]; g.fillStyle = "#2a2433"; g.fillRect(p.x - 22, p.y - 3, 44, 5); fillRR(g, p.x - 18, p.y - d, 36, d, 3, col, OUT, 2); if (p.on) glow(g, p.x, p.y - 6, 40, col, 0.4); }
  drawGates(g, t) {
    for (const gt of this.gates) {
      const col = ["", "#7fe8ff", "#ffb35c", "#c58cff"][gt.id], x = gt.c * TS, y = gt.r * TS, o = gt.open;
      if (o > 0.98) { g.globalAlpha = 0.25; g.fillStyle = col; g.fillRect(x + TS / 2 - 1, y, 2, TS); g.globalAlpha = 1; continue; }
      g.save(); g.globalAlpha = 1 - o * 0.9; fillRR(g, x + 6, y, TS - 12, TS, 3, "#2f2a3a", OUT, 2.5); g.fillStyle = col; g.fillRect(x + TS / 2 - 3, y + 6, 6, TS - 12); glow(g, x + TS / 2, y + TS / 2, 28, col, 0.25 * (1 - o)); g.restore();
    }
    const map = this.map; for (const d of this.doors) if (map.cells[d.r][d.c] === "D") { const x = d.c * TS, y = d.r * TS; fillRR(g, x + 2, y, TS - 4, TS, 4, "#6b4a2b", OUT, 2.5); g.fillStyle = "#ffd75e"; g.fillRect(x + TS / 2 - 3, y + TS / 2 - 3, 6, 8); }
    for (const b of this.breaks) if (map.cells[b.r][b.c] === "r") { const x = b.c * TS, y = b.r * TS; fillRR(g, x + 1, y + 1, TS - 2, TS - 2, 5, "#a9794a", OUT, 2.5); g.strokeStyle = "rgba(0,0,0,.4)"; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 8, y + 12); g.lineTo(x + 22, y + 24); g.lineTo(x + 14, y + 40); g.moveTo(x + 22, y + 24); g.lineTo(x + 38, y + 18); g.stroke(); }
    // water
    for (let r = Math.floor(this.cam.y / TS); r <= Math.ceil((this.cam.y + 540) / TS); r++) for (let c = Math.floor(this.cam.x / TS); c <= Math.ceil((this.cam.x + 960) / TS); c++) if (map.cells[r] && map.cells[r][c] === "W") { g.fillStyle = "rgba(60,150,200,.35)"; g.fillRect(c * TS, r * TS, TS, TS); if (!map.cells[r - 1] || map.cells[r - 1][c] !== "W") { g.fillStyle = "rgba(190,240,255,.55)"; g.fillRect(c * TS, r * TS + Math.sin(t * 3 + c) * 2, TS, 3); } }
  }
  drawSpring(g, s, t) { const k = s.comp; g.save(); g.translate(s.x, s.y); fillRR(g, -20, -5, 40, 5, 2, "#555", OUT, 2); g.strokeStyle = "#e8e0c0"; g.lineWidth = 4; g.beginPath(); const h = 22 - k * 10; for (let i = 0; i <= 4; i++) { const yy = -5 - (h * i) / 4; g.lineTo(i % 2 ? 12 : -12, yy); } g.stroke(); fillRR(g, -22, -5 - h - 5, 44, 7, 3, "#ff6b6b", OUT, 2); g.restore(); }
  drawPlatform(g, p, t) { const shake = p.st === "shake" ? Math.sin(t * 60) * 1.5 : 0; const col = p.kind === "d" ? "#9a7b55" : "#6e7d8a"; fillRR(g, p.x + shake, p.y, p.w, p.h, 5, col, OUT, 2.5); g.fillStyle = "rgba(255,255,255,.2)"; g.fillRect(p.x + 6 + shake, p.y + 3, p.w - 12, 3); if (p.kind !== "d") { g.fillStyle = "#222"; g.fillRect(p.x + 8, p.y + p.h - 4, 8, 4); g.fillRect(p.x + p.w - 16, p.y + p.h - 4, 8, 4); } }
  drawCheckpoint(g, c, t) { g.save(); g.translate(c.x, c.y); g.fillStyle = "#3a3340"; g.fillRect(-3, -70, 6, 70); const w = Math.sin(t * 3) * 3; g.fillStyle = c.on ? "#8affc2" : "#777"; g.beginPath(); g.moveTo(3, -70); g.lineTo(34 + w, -62); g.lineTo(3, -50); g.fill(); if (c.on) glow(g, 18, -60, 34, "#8affc2", 0.3); g.restore(); }
  drawExit(g, t) { const e = this.exit, a = this.cfg.exitColor || "#ffe27a"; g.save(); g.translate(e.x, e.y); glow(g, 0, -50, 90, a, 0.4 + 0.1 * Math.sin(t * 3)); fillRR(g, -28, -100, 56, 100, 26, "rgba(20,10,40,.8)", a, 3); g.fillStyle = rgba(a, 0.35 + 0.15 * Math.sin(t * 4)); fillRR(g, -20, -92, 40, 92, 20, rgba(a, 0.3), null, 0); g.restore(); }
  drawTurret(g, tu, t) { g.save(); g.translate(tu.x, tu.y); fillRR(g, -14, -34, 28, 34, 5, "#4a4452", OUT, 2.5); g.fillStyle = "#222"; g.fillRect(tu.dir < 0 ? -22 : 6, -26, 16, 8); g.fillStyle = tu.cd < 0.4 ? "#ff6a4a" : "#5a5a66"; circle(g, 0, -17, 4, g.fillStyle); g.restore(); }
  drawCrusher(g, c, t) {
    const y = c.y; g.save(); g.strokeStyle = "#2a2a30"; g.lineWidth = 3; g.beginPath(); g.moveTo(c.x, c.y0 - 500); g.lineTo(c.x, y); g.stroke();
    const sh = c.st === "warn" ? Math.sin(t * 70) * 2 : 0; fillRR(g, c.x - 34 + sh, y, 68, 40, 6, "#58505e", OUT, 3); g.fillStyle = "#b3a9b8"; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(c.x - 30 + i * 15 + sh, y + 40); g.lineTo(c.x - 22 + i * 15 + sh, y + 40); g.lineTo(c.x - 26 + i * 15 + sh, y + 52); g.fill(); }
    if (c.st === "warn") { g.fillStyle = "#ff5a5a"; circle(g, c.x + sh, y + 14, 4, "#ff5a5a"); }
    g.restore();
  }
  drawNote(g, n, t) { g.save(); g.translate(n.x, n.y); g.rotate(-0.08); g.fillStyle = "#e8dfc2"; g.fillRect(-9, -26, 18, 22); g.strokeStyle = OUT; g.lineWidth = 2; g.strokeRect(-9, -26, 18, 22); g.fillStyle = "#6b5b45"; for (let i = 0; i < 3; i++) g.fillRect(-6, -22 + i * 6, 12, 2); if (!n.shown) glow(g, 0, -15, 26, "#ffe9a6", 0.3 + 0.15 * Math.sin(t * 3)); g.restore(); }
  drawHide(g, z, t, front) {
    if (!front) return; const near = this.hero.hidden; g.save(); g.globalAlpha = near ? 0.9 : 0.85; const x = z.x, y = z.y;
    for (let i = 0; i < 9; i++) { const k = hash2(i, Math.round(x / 7), 3); const bx = x - 22 + i * 5.6 + Math.sin(t * 1.5 + i) * 1.4, h = 38 + k * 26; g.fillStyle = shade(this.cfg.hideColor || "#2c4a33", -0.1 + k * 0.2); g.beginPath(); g.moveTo(bx - 5, y); g.quadraticCurveTo(bx + Math.sin(t * 1.4 + i) * 3, y - h * 0.6, bx + 1, y - h); g.quadraticCurveTo(bx + 5, y - h * 0.5, bx + 6, y); g.fill(); }
    g.restore();
  }
  drawEnemy(g, e, t) {
    const art = this.cfg.art || {}; if (art.enemy) { art.enemy(g, e, t); return; }
    g.save(); g.translate(e.x, e.y); const fl = e.face || 1;
    if (e.ch === "g") { const sq = 1 + Math.sin(t * 8 + e.ph) * 0.06; g.scale(fl, sq); ellipse(g, 0, -13, 18, 14, "#7a4a8a", OUT, 2.5); ellipse(g, 6, -17, 5, 6, "#fff", null); circle(g, 7, -16, 2.4, "#111"); ellipse(g, -8, -17, 5, 6, "#fff", null); circle(g, -7, -16, 2.4, "#111"); g.fillStyle = OUT; g.fillRect(-9, -4, 5, 4); g.fillRect(4, -4, 5, 4); }
    else { g.translate(0, -13); ellipse(g, 0, 0, 14, 11, "#d84a6a", OUT, 2.5); const w = Math.sin(t * 22) * 8; g.fillStyle = "rgba(255,255,255,.7)"; ellipse(g, -13, -8, 12, 5 + w * 0.2, "rgba(255,255,255,.7)", OUT, 1.5, -0.5 + w * 0.02); ellipse(g, 13, -8, 12, 5 + w * 0.2, "rgba(255,255,255,.7)", OUT, 1.5, 0.5); circle(g, 5 * fl, -2, 3, "#fff"); circle(g, 6 * fl, -2, 1.5, "#111"); }
    g.restore();
  }
  drawHunter(g, h, t) {
    const art = this.cfg.art || {}; if (art.hunter) { art.hunter(g, h, t); return; }
    g.save(); g.translate(h.x, h.y); g.scale(h.dir, 1); const w = Math.sin(t * (h.st === "chase" ? 14 : 6)) * (h.vx ? 1 : 0);
    // vision cone
    if (h.st !== "search") { const R = (h.st === "chase" ? 7 : 7) * TS; g.save(); g.globalAlpha = h.st === "patrol" ? 0.1 : 0.2; const gr = g.createLinearGradient(0, 0, R, 0); gr.addColorStop(0, h.st === "patrol" ? "#ffe8a0" : "#ff6060"); gr.addColorStop(1, "rgba(255,200,100,0)"); g.fillStyle = gr; g.beginPath(); g.moveTo(10, -h.h * 0.8); g.lineTo(R, -h.h * 0.8 - 80); g.lineTo(R, -h.h * 0.8 + 90); g.closePath(); g.fill(); g.restore(); }
    capsule(g, -7, -28, -7 + w * 5, -2, 9, "#1a1520", OUT, 2); capsule(g, 7, -28, 7 - w * 5, -2, 9, "#1a1520", OUT, 2);
    ellipse(g, 0, -48, 17, 26, "#27202c", OUT, 3); capsule(g, 8, -56, 26 + w * 3, -34, 8, "#27202c", OUT, 2.5);
    ellipse(g, 6, -74, 12, 12, "#d9cdb4", OUT, 2.5); g.fillStyle = h.st === "chase" ? "#ff4040" : "#222"; g.fillRect(8, -77, 5, 4);
    g.restore();
  }
  drawChase(g, t) {
    const C = this.chase, cam = this.cam, x = C.x; g.save();
    const gr = g.createLinearGradient(x - 240, 0, x + 40, 0); gr.addColorStop(0, "rgba(0,0,0,1)"); gr.addColorStop(0.7, "rgba(6,2,10,.95)"); gr.addColorStop(1, "rgba(10,4,16,0)");
    g.fillStyle = gr; g.fillRect(x - 800, cam.y - 20, 1040 + 40, 600);
    g.fillStyle = "#050208"; for (let i = 0; i < 14; i++) { const yy = cam.y + i * 44 + Math.sin(t * 2 + i) * 10, ln = 50 + 40 * Math.abs(Math.sin(t * 3 + i * 1.3)); g.beginPath(); g.ellipse(x + 12 + ln * 0.2, yy, ln, 22, 0, 0, TAU); g.fill(); }
    g.restore();
  }

  // ---- lighting + HUD -----------------------------------------------------------------------------------------------------------
  drawLighting(g, t) {
    if (!this.dark) return; const cam = this.cam, H = this.hero; const k = this.lv.darkness ?? 0.82;
    const lights = [{ x: H.x, y: H.y - 28, r: this.lv.lantern ?? 210 }]; for (const l of this.lamps) lights.push({ x: l.x, y: l.y, r: 170 + Math.sin(t * 3 + l.ph) * 8 }); for (const c of this.checkpoints) if (c.on) lights.push({ x: c.x + 14, y: c.y - 56, r: 130 });
    if (this.exit) lights.push({ x: this.exit.x, y: this.exit.y - 50, r: 150 });
    for (const p of this.plates) if (p.on) lights.push({ x: p.x, y: p.y - 6, r: 110 });
    const c = this.lightCanvas || (this.lightCanvas = (typeof document !== "undefined" ? document.createElement("canvas") : null)); if (!c) return; c.width = 480; c.height = 270; const lg = c.getContext("2d");
    lg.globalCompositeOperation = "source-over"; lg.fillStyle = `rgba(4,3,10,${k})`; lg.fillRect(0, 0, 480, 270); lg.globalCompositeOperation = "destination-out";
    for (const l of lights) { const sx = (l.x - cam.x) * cam.zoom / 2, sy = (l.y - cam.y) * cam.zoom / 2, r = l.r / 2; if (sx < -r || sx > 480 + r || sy < -r || sy > 270 + r) continue; const rg = lg.createRadialGradient(sx, sy, r * 0.1, sx, sy, r); rg.addColorStop(0, "rgba(0,0,0,1)"); rg.addColorStop(0.55, "rgba(0,0,0,.65)"); rg.addColorStop(1, "rgba(0,0,0,0)"); lg.fillStyle = rg; lg.fillRect(sx - r, sy - r, r * 2, r * 2); }
    g.save(); g.imageSmoothingEnabled = true; g.drawImage(c, 0, 0, 960, 540); g.restore();
    // warm glow on the lamps
    g.save(); g.globalCompositeOperation = "lighter"; for (const l of this.lamps) { const s = cam.toScreen(l.x, l.y); glow(g, s.x, s.y, 70, "#ffb347", 0.22); } g.restore();
  }
  drawOverlay(g, t) {
    const H = this.hero, cfg = this.cfg;
    if (this.alert > 0.05) { g.save(); const a = this.alert * (0.25 + 0.1 * Math.sin(t * 12)); const gr = g.createRadialGradient(480, 270, 200, 480, 270, 620); gr.addColorStop(0, "rgba(120,0,0,0)"); gr.addColorStop(1, `rgba(140,0,10,${a})`); g.fillStyle = gr; g.fillRect(0, 0, 960, 540); g.restore(); }
    this.alert = Math.max(0, this.alert - 0.03);
    this.juice.draw(g, 960, 540);
    if (this.run) { hudHearts(g, 20, 24, H.hp, 3, 12); hudChip(g, 20, 48, cfg.coinName || "Coins", this.coins, "#ffc233", 112); } else if (this.coinsTotal) hudChip(g, 20, 20, cfg.coinName || "Coins", this.coins, "#ffc233", 112);
    // relic pips
    for (let i = 0; i < 3; i++) { g.save(); g.translate(842 - i * 28, 26); g.beginPath(); g.moveTo(0, -10); g.lineTo(8, 0); g.lineTo(0, 10); g.lineTo(-8, 0); g.closePath(); g.fillStyle = i < this.relics ? (cfg.relicColor || "#7fe8ff") : "rgba(255,255,255,.14)"; g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke(); g.restore(); }
    if (this.hasKey) text(g, "🔑", 900, 64, { size: 20, align: "center" });
    if (this.msgT > 0 && this.msg) { const a = clamp(this.msgT * 2, 0, 1); g.save(); g.globalAlpha = a; const lines = this.msg.split("\n"); const w = Math.max(...lines.map((l) => l.length)) * 9 + 36; fillRR(g, 480 - w / 2, 96, w, 22 + lines.length * 22, 12, "rgba(10,6,24,.78)", "rgba(255,255,255,.2)", 1.5); lines.forEach((l, i) => text(g, l, 480, 126 + i * 22, { size: 16, color: "#fff", align: "center", font: FONT_BODY, weight: 600 })); g.restore(); }
    if (this.fade > 0) { g.fillStyle = `rgba(0,0,0,${this.fade})`; g.fillRect(0, 0, 960, 540); }
    if (this.hero.dead) { const k = clamp(this.hero.deadT / 0.9, 0, 1); g.fillStyle = `rgba(0,0,0,${k * k})`; g.fillRect(0, 0, 960, 540); }
    if (this.state === "win") { g.fillStyle = `rgba(255,244,210,${clamp(this.winT / 0.8, 0, 1) * 0.8})`; g.fillRect(0, 0, 960, 540); }
  }
}

// ------------------------------------------------------------------------------------------------------------------------------------
// The little hero. style comes from cfg.kid: { body, accent, hair, eye }
export function drawKid(g, H, t, cfg) {
  const K = cfg.kid || {}, body = K.body || "#d94a4a", accent = K.accent || "#f2d6b8", hair = K.hair || "#3a2a22";
  const moving = H.onGround && Math.abs(H.vx) > 30, sw = moving ? Math.sin(H.runT * 3) : 0, air = !H.onGround;
  const squash = H.crouch ? 0.72 : 1;
  g.save(); g.translate(H.x, H.y); g.scale(H.face >= 0 ? 1 : -1, 1);
  if (H.roll > 0) { g.translate(0, -14); g.rotate(H.runT * 5); ellipse(g, 0, 0, 15, 15, body, OUT, 2.5); ellipse(g, 6, -3, 6, 6, accent, OUT, 2); g.restore(); return; }
  if (H.push) g.rotate(0.06);
  const legA = air ? 0.7 : sw * 0.9, legB = air ? -0.5 : -sw * 0.9;
  capsule(g, -4, -16 * squash, -4 + Math.sin(legA) * 9, -1, 7, "#2a2530", OUT, 2); capsule(g, 4, -16 * squash, 4 + Math.sin(legB) * 9, -1, 7, "#2a2530", OUT, 2);
  const bob = moving ? Math.abs(Math.sin(H.runT * 3)) * 2 : Math.sin(t * 2) * 0.6;
  g.translate(0, -bob);
  capsule(g, 0, -17 * squash, 0, -(H.h - 17) * squash + 4, 20, body, OUT, 2.5);
  capsule(g, -7, -(H.h - 20) * squash, -10 - sw * 5, -(H.h - 36) * squash + (air ? -8 : 6), 6, body, OUT, 2); capsule(g, 7, -(H.h - 20) * squash, 10 + sw * 5 + (H.push ? 6 : 0), -(H.h - 36) * squash + (air ? -8 : 6), 6, body, OUT, 2);
  ellipse(g, 1, -(H.h - 8) * squash, 12, 12 * (H.crouch ? 0.9 : 1), accent, OUT, 2.5);
  g.fillStyle = hair; g.beginPath(); g.arc(0, -(H.h - 10) * squash, 12.5, Math.PI * 1.05, Math.PI * 1.95); g.fill(); g.lineWidth = 2; g.strokeStyle = OUT; g.stroke();
  const blink = Math.floor(t * 0.8) % 5 === 0 && (t * 0.8) % 1 < 0.08; g.fillStyle = "#111"; if (!blink) { g.fillRect(4, -(H.h - 9) * squash, 3, 5); g.fillRect(-1, -(H.h - 9) * squash, 3, 5); }
  g.restore();
}

// A very small autopilot for the title-screen demo: runs right, jumps walls and gaps.
export class SideBot {
  constructor() { this.t = 0; }
  think(S, dt) {
    const H = S.hero, m = S.map; this.t += dt; const dir = 1, ahead = m.col(H.x + 30), row = m.row(H.y - 8);
    const wall = m.isSolid(ahead, row) || m.isSolid(ahead, row - 1) || S.boxes.some((b) => Math.abs(b.x - H.x) < 40 && b.y > H.y - 30);
    const floorAhead = m.isSolid(m.col(H.x + 60), m.row(H.y + 6)) || m.isOneWay(m.col(H.x + 60), m.row(H.y + 6));
    const jump = H.onGround && (wall || !floorAhead);
    return { dir, jumpPressed: jump, jumpHeld: !H.onGround || jump, down: false, act: H.onGround && Math.random() < dt * 0.4, actHeld: false };
  }
}
