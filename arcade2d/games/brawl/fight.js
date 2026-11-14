// Ironbloom Clash — the fighting engine: moves, hits, blocking, combos, specials, rounds and the computer opponent.
// It runs on a fixed 60-steps-a-second clock so timing (frames) always feels the same.
import { clamp, lerp, sign, rng, TAU } from "../../core/util";
import { Particles, FX, Floaters, Juice } from "../../core/fx";
import { Backdrop } from "../../core/backdrop";
import { text, fillRR, ellipse, circle, capsule, glow, shadowBlob, FONT_DISPLAY, FONT_BODY, OUT, bar } from "../../core/draw";
import { sfx as realSfx } from "../../core/audio";
import { shade } from "../../core/util";
import { FIGHTERS, LADDER, FLOOR } from "./roster";
import { drawFighter } from "./puppet";

const NOOP = new Proxy({}, { get: () => () => {} });
export const STAGE = { x0: 70, x1: 1130, w: 1200 }; // fighters move between x0 and x1; the camera follows them
const GRAV = 0.78, FPS = 1 / 60;

// ---- the move list (frames: startup, active, recovery) -----------------------------------------------------------------------------------
// box = [forward reach start, bottom height, width, height] measured from the fighter's centre / feet.
const M = (o) => ({ lvl: "m", hs: 14, bs: 9, kb: 5, launch: 0, meter: 30, chip: 0.1, cancel: true, ...o });
const NORMALS = {
  lp: M({ name: "Jab", sf: 4, af: 3, rf: 6, dmg: 28, hs: 12, bs: 7, kb: 3, box: [26, 105, 62, 28], pose: "jab" }),
  lk: M({ name: "Short kick", sf: 5, af: 3, rf: 8, dmg: 34, hs: 13, bs: 8, kb: 4, box: [26, 20, 74, 34], lvl: "m", pose: "kick" }),
  hp: M({ name: "Heavy punch", sf: 10, af: 4, rf: 17, dmg: 78, hs: 22, bs: 13, kb: 9, box: [28, 95, 92, 38], pose: "straight", step: 2.2, cancel: true }),
  hk: M({ name: "Heavy kick", sf: 12, af: 4, rf: 21, dmg: 88, hs: 24, bs: 14, kb: 10, launch: 7, box: [26, 60, 104, 56], pose: "hkick", step: 1.5 }),
  cp: M({ name: "Crouch jab", sf: 4, af: 3, rf: 7, dmg: 24, hs: 12, bs: 7, kb: 3, box: [26, 45, 64, 26], pose: "cpunch", crouch: true }),
  ck: M({ name: "Sweep", sf: 8, af: 4, rf: 18, dmg: 52, hs: 24, bs: 10, kb: 6, lvl: "l", launch: 4, knock: true, box: [26, 0, 112, 24], pose: "low", crouch: true }),
  ch: M({ name: "Uppercut", sf: 5, af: 6, rf: 22, dmg: 82, hs: 26, bs: 12, kb: 4, launch: 11, knock: true, box: [20, 60, 56, 120], pose: "upper", inv: 10, crouch: true }),
  jp: M({ name: "Air punch", sf: 5, af: 10, rf: 4, dmg: 40, hs: 16, bs: 11, kb: 4, box: [20, 20, 70, 70], pose: "jumpP", air: true, lvl: "h" }),
  jk: M({ name: "Air kick", sf: 6, af: 12, rf: 4, dmg: 54, hs: 18, bs: 12, kb: 5, box: [18, -10, 84, 60], pose: "jumpK", air: true, lvl: "h" }),
  throw: M({ name: "Throw", sf: 6, af: 2, rf: 22, dmg: 120, hs: 0, bs: 0, kb: 0, box: [10, 20, 70, 130], pose: "grab", grab: true, meter: 40, cancel: false }),
};
const SPECIALS = {
  proj: (F, btn) => M({ name: "Shot", sf: 13, af: 2, rf: 28, dmg: 0, pose: "shoot", proj: { speed: btn === "h" ? 9.5 : 6.5, dmg: btn === "h" ? 70 : 54, size: 1, hs: 20, bs: 12 }, meter: 20, cancel: false, special: true }),
  bigproj: () => M({ name: "Super", sf: 16, af: 4, rf: 34, dmg: 0, pose: "shoot", proj: { speed: 11, dmg: 260, size: 2.6, hs: 40, bs: 24, launch: 12, pierce: true }, special: true, sup: true, inv: 20, cancel: false }),
  quake: (F, btn) => M({ name: "Quake", sf: 18, af: 3, rf: 30, dmg: 0, pose: "stomp", proj: { speed: btn === "h" ? 6 : 4.5, dmg: 70, size: 1.1, hs: 22, bs: 12, low: true, ground: true, launch: 5 }, special: true, cancel: false }),
  rise: (F, btn) => M({ name: "Rising strike", sf: 4, af: 10, rf: 28, dmg: btn === "h" ? 110 : 80, hs: 26, bs: 16, kb: 4, launch: 13, knock: true, inv: 9, box: [12, 20, 62, 160], pose: "upper", rise: btn === "h" ? 17 : 14, vx: 1.5, special: true, cancel: false, armor: F.def.id === "bruno" || F.def.id === "tark" }),
  spin: (F, btn) => M({ name: "Spin kick", sf: 5, af: 14, rf: 24, dmg: 70, hs: 22, bs: 14, launch: 10, knock: true, inv: 6, box: [-20, 20, 140, 90], pose: "spin", rise: 12, vx: 3.4, special: true, cancel: false }),
  rush: (F, btn) => M({ name: "Rush", sf: 10, af: 9, rf: 24, dmg: btn === "h" ? 95 : 70, hs: 22, bs: 14, launch: 5, box: [26, 60, 80, 70], pose: "straight", vx: btn === "h" ? 8 : 6, special: true, cancel: false, armor: F.def.armor }),
  slide: (F, btn) => M({ name: "Slide", sf: 9, af: 10, rf: 22, dmg: 64, hs: 20, bs: 8, lvl: "l", launch: 4, knock: true, box: [20, 0, 110, 28], pose: "low", vx: 7.5, special: true, crouch: true, cancel: false }),
  grab: () => M({ name: "Clinch", sf: 7, af: 3, rf: 36, dmg: 190, hs: 0, bs: 0, box: [10, 20, 84, 130], pose: "grab", grab: true, special: true, cancel: false, vx: 1.5 }),
  biggrab: () => M({ name: "Super grab", sf: 12, af: 4, rf: 40, dmg: 420, hs: 0, bs: 0, box: [10, 20, 130, 140], pose: "grab", grab: true, special: true, sup: true, inv: 30, cancel: false, vx: 4 }),
  multi: () => M({ name: "Barrage", sf: 8, af: 20, rf: 24, dmg: 26, hs: 12, bs: 8, kb: 2, hits: 4, hitGap: 5, launchLast: 7, box: [24, 70, 90, 70], pose: "multi", vx: 3.2, special: true, cancel: false, sup: false }),
  teleport: () => M({ name: "Blink", sf: 14, af: 1, rf: 20, dmg: 0, pose: "vanish", teleport: true, special: true, cancel: false, inv: 14 }),
  beam: () => M({ name: "Super beam", sf: 18, af: 4, rf: 30, dmg: 0, pose: "shoot", proj: { speed: 14, dmg: 300, size: 3, hs: 40, bs: 26, launch: 12, pierce: true, beam: true }, special: true, sup: true, inv: 22, cancel: false }),
};
// the multi-hit super reuses 'multi' but stronger
SPECIALS.multiS = () => ({ ...SPECIALS.multi(), name: "Super barrage", dmg: 60, hits: 7, hitGap: 4, launchLast: 12, sup: true, inv: 25, af: 30 });

export const moveFor = (F, key, btn) => {
  if (NORMALS[key]) { const m = { ...NORMALS[key] }; m.dmg *= F.def.dmg; m.box = [m.box[0] + (F.def.reach - 1) * 20, m.box[1], m.box[2] * F.def.reach, m.box[3]]; return m; }
  return null;
};

// ---- a fighter ----------------------------------------------------------------------------------------------------------------------------
class Fighter {
  constructor(def, x, face, side) {
    this.def = def; this.side = side; this.x = x; this.face = face; this.h = 0; this.vh = 0; this.vx = 0;
    this.hp = def.hp; this.meter = 0; this.st = "idle"; this.t = 0; this.mv = null; this.conn = false; this.stun = 0; this.inv = 0; this.crouch = false; this.blocking = false;
    this.buf = []; this.combo = 0; this.comboDmg = 0; this.maxCombo = 0; this.hitsDone = 0; this.lastHit = 0; this.air = false; this.seq = []; this.flash = 0; this.shake = 0; this.pressed = {}; this.armorHit = false; this.hurtT = 0; this.koT = 0; this.winPose = 0; this.walkT = 0;
    this.tele = 0;
  }
  get hurt() { // hurtbox in world space {x0,x1,y0,y1 (heights)}
    const w = 34 * this.def.scale; let top = 168 * this.def.scale, bot = 0;
    if (this.st === "down" || this.st === "ko") { top = 34; }
    else if (this.crouch || (this.mv && this.mv.crouch)) top = 108 * this.def.scale;
    if (this.h > 0) { bot = this.h; top = this.h + 150 * this.def.scale; }
    return { x0: this.x - w, x1: this.x + w, y0: bot, y1: top };
  }
}

export class FightSession {
  constructor(lv, ctx = {}, cfg = {}, opts = {}) {
    this.lv = lv; this.ctx = ctx; this.cfg = cfg; this.quiet = !!opts.quiet; this.demo = !!opts.demo; this.sfx = this.quiet ? NOOP : realSfx;
    this.rung = LADDER[lv.index ?? 0] || LADDER[0]; this.diff = opts.diff ?? this.rung.diff;
    this.fx = new Particles(500); this.fl = new Floaters(); this.juice = new Juice();
    this.bd = opts.headless ? null : new Backdrop(this.rung.stage, (lv.index ?? 0) * 5 + 2);
    this.t = 0; this.acc = 0; this.frame = 0; this.done = null; this.shakeT = 0; this.shakeM = 0; this.zoom = 1; this.camX = 0; this.projs = []; this.sparks = [];
    this.state = this.demo ? "intro" : "select"; this.sel = cfg.lastPick ?? 0; this.selT = 0;
    this.wins = [0, 0]; this.round = 1; this.timer = 60; this.stateT = 0; this.lostRound = false; this.perfects = 0; this.maxCombo = 0; this.supers = 0; this.hpLeftTotal = 0; this.msg = ""; this.msgT = 0; this.superFlash = 0; this.koSlow = 0;
    this.r = rng((lv.index ?? 0) * 77 + 5);
    if (this.demo) this.startMatch(Math.floor(Math.random() * FIGHTERS.length), true);
  }
  startMatch(pick, cpuVsCpu = false) {
    this.pick = pick; if (this.cfg.remember) this.cfg.lastPick = pick;
    const pd = FIGHTERS[pick]; let od = FIGHTERS.find((f) => f.id === this.rung.fid); if (od.id === pd.id) od = { ...od, look: { ...od.look, top: shade(od.look.top, -0.35), accent: "#ffffff", pants: shade(od.look.pants, 0.25) } };
    if (this.rung.tint) od = { ...od, look: { ...od.look, top: this.rung.tint, accent: "#ffffff" }, hp: od.hp + (this.rung.boss ? 250 : 120), dmg: od.dmg * (1 + this.diff * 0.03) };
    this.defs = [pd, od]; this.cpuBoth = cpuVsCpu; this.ai = [cpuVsCpu ? new Brain(this.diff + 1) : null, new Brain(this.diff)];
    this.newRound(); this.state = "intro"; this.stateT = 0;
  }
  newRound() {
    const [a, b] = this.defs; this.p = [new Fighter(a, 470, 1, 0), new Fighter(b, 730, -1, 1)];
    if (this.keepHp) { /* hp resets every round */ }
    this.projs.length = 0; this.timer = 60; this.msg = ""; this.fx.clear(); this.camX = 300; this.roundHpStart = [this.p[0].hp, this.p[1].hp]; this.iT = 0;
    // meter carries over
    if (this.prevMeter) { this.p[0].meter = this.prevMeter[0]; this.p[1].meter = this.prevMeter[1]; }
  }

  // ---------------------------------------------------------------------------------------------------------------------- update
  update(dt0, input, env) {
    this.t += dt0; const dt = Math.min(dt0, 1 / 20);
    if (this.state === "select") { this.updateSelect(input); return; }
    this.juice.update(dt); const sdt = this.juice.step(dt); this.fx.update(sdt); this.fl.update(sdt);
    this.acc += sdt * (this.koSlow > 0 ? 0.35 : 1); let n = 0;
    while (this.acc >= FPS && n < 4) { this.acc -= FPS; n++; this.step(input); }
    if (this.msgT > 0) this.msgT -= dt; if (this.superFlash > 0) this.superFlash -= dt; if (this.koSlow > 0) this.koSlow -= dt;
    // camera + zoom follow the fighters
    const [a, b] = this.p; const mid = (a.x + b.x) / 2, dist = Math.abs(a.x - b.x);
    const tz = clamp(1.28 - dist / 900, 1.0, 1.22); this.zoom += (tz - this.zoom) * Math.min(1, dt * 4);
    const viewW = 960 / this.zoom; const tx = clamp(mid - viewW / 2, 0, STAGE.w - viewW); this.camX += (tx - this.camX) * Math.min(1, dt * 6);
    if (this.shakeT > 0) this.shakeT -= dt;
  }
  updateSelect(input) {
    this.selT += 1 / 60;
    if (input.pressed("left")) { this.sel = (this.sel + FIGHTERS.length - 1) % FIGHTERS.length; this.sfx.tick(); }
    if (input.pressed("right")) { this.sel = (this.sel + 1) % FIGHTERS.length; this.sfx.tick(); }
    if (input.pressed("up")) { this.sel = (this.sel + FIGHTERS.length - 3) % FIGHTERS.length; this.sfx.tick(); }
    if (input.pressed("down")) { this.sel = (this.sel + 3) % FIGHTERS.length; this.sfx.tick(); }
    if (input.pressed("confirm") || input.pressed("fire") || input.pressed("jump")) { this.sfx.click(); this.cfg.remember = true; this.startMatch(this.sel); }
    // clicking / tapping a portrait
    const p = input.pointer; if (p && p.pressed) { for (let i = 0; i < FIGHTERS.length; i++) { const bx = 80 + (i % 3) * 150, by = 150 + Math.floor(i / 3) * 170; if (p.x > bx && p.x < bx + 135 && p.y > by && p.y < by + 155) { if (this.sel === i) { this.startMatch(i); } else this.sel = i; } } if (p.x > 610 && p.y > 440 && p.x < 920) this.startMatch(this.sel); }
  }

  readInput(input) {
    return { dx: input.axis("left", "right"), down: input.held("down"), up: input.held("up") || input.held("jump"), p: input.pressed("fire"), k: input.pressed("alt"), h: input.pressed("swap"), pH: input.held("fire"), kH: input.held("alt") };
  }

  step(input) {
    this.frame++; const [a, b] = this.p;
    if (this.state === "intro") { this.stateT++; if (this.stateT === 20) this.sfx.whoosh && this.sfx.whoosh(); if (this.stateT > 110) { this.state = "fight"; a.st = b.st = "idle"; this.stateT = 0; this.sfx.bell && this.sfx.bell(); } this.pose(a, "intro"); this.pose(b, "intro"); return; }
    if (this.state === "roundEnd") { this.stateT++; this.tickBody(a, null); this.tickBody(b, null); this.projs.length = 0; if (this.stateT > 170) this.afterRound(); return; }
    if (this.state !== "fight") return;
    // controls
    let ca = this.cpuBoth ? this.ai[0].think(a, b, this) : this.readInput(input), cb = this.ai[1].think(b, a, this);
    if (!this.cpuBoth && input.pressed("fire") && input.pressed("alt")) { ca.throw = true; }
    this.tickFighter(a, b, ca); this.tickFighter(b, a, cb);
    this.tickProjs(); this.separate(a, b);
    if (this.frame % 60 === 0 && this.timer > 0) { this.timer--; }
    if (this.timer <= 0 && this.state === "fight") { const wa = a.hp / a.def.hp, wb = b.hp / b.def.hp; this.endRound(wa >= wb ? 0 : 1, "TIME UP", a.hp === b.hp); }
    this.maxCombo = Math.max(this.maxCombo, a.maxCombo);
    for (const f of this.p) { f.maxCombo = Math.max(f.maxCombo, f.combo); if (f.flash > 0) f.flash--; }
    a.hp = Math.max(0, a.hp); b.hp = Math.max(0, b.hp);
    if (this.state === "fight") { if (a.hp <= 0 || b.hp <= 0) { const loser = a.hp <= 0 ? 0 : 1; this.endRound(1 - loser, "K.O.", false); } }
  }

  endRound(winner, msg, draw) {
    this.state = "roundEnd"; this.stateT = 0; this.msg = msg; this.msgT = 2; this.koSlow = msg === "K.O." ? 1.2 : 0;
    if (msg === "K.O.") { this.sfx.boom && this.sfx.boom(); this.juice.hitstop(0.18); this.juice.doFlash(0.5, "#fff"); }
    if (draw) { this.wins[0]++; this.wins[1]++; this.roundWinner = -1; } else { this.wins[winner]++; this.roundWinner = winner; }
    const w = this.p[winner]; if (!draw) { w.winPose = 1; if (winner === 0 && this.p[0].hp >= this.roundHpStart[0]) { this.perfects++; this.msg = msg === "K.O." ? "K.O.  PERFECT!" : msg; } }
    if (winner === 1) this.lostRound = true; this.hpLeftTotal += this.p[0].hp / this.p[0].def.hp; this.prevMeter = [this.p[0].meter, this.p[1].meter];
    this.fl.add(480, 180, "", "#fff", 10);
  }
  afterRound() {
    if (this.demo) { this.startMatch(Math.floor(Math.random() * FIGHTERS.length), true); this.wins = [0, 0]; return; }
    if (this.wins[0] >= 2 || this.wins[1] >= 2) { this.finish(this.wins[0] > this.wins[1]); return; }
    this.round++; this.newRound(); this.state = "intro"; this.stateT = 0;
  }
  finish(won) {
    if (this.done) return;
    const rounds = this.round, hpAvg = this.hpLeftTotal / Math.max(1, rounds), left = this.p[0].hp / this.p[0].def.hp;
    const base = Math.round(left * 1500 + this.wins[0] * 700 + this.maxCombo * 80 + this.supers * 150 + this.perfects * 800 + this.diff * 150);
    const score = won ? base + 500 : Math.round(base * 0.15);
    const stars = won ? 1 + (!this.lostRound ? 1 : 0) + (!this.lostRound && left >= 0.5 ? 1 : 0) : 0;
    const lines = [["Rounds", `${this.wins[0]} – ${this.wins[1]}`], ["Health left", `${Math.round(left * 100)}%`], ["Best combo", `${this.maxCombo} hits`], ["Supers", `${this.supers}`], ["Perfect rounds ★", `${this.perfects}`], ["Opponent", this.rung.name]];
    this.done = { won, score, stars, lines, title: won ? (this.rung.boss ? "CHAMPION!" : "YOU WIN!") : "DEFEATED", sub: `${this.pickName()} vs ${this.rung.name}`, delay: 0.6 };
  }
  pickName() { return FIGHTERS[this.pick].name; }

  // ---- one fighter, one frame ----
  tickBody(f, c) { // used during the round-end pause: just physics
    f.t++; if (f.h > 0 || f.vh) { f.vh -= GRAV; f.h += f.vh; f.x += f.vx; if (f.h <= 0) { f.h = 0; f.vh = 0; f.vx = 0; if (f.st === "launched") { f.st = f.hp <= 0 ? "ko" : "down"; f.t = 0; } } }
    f.x = clamp(f.x, STAGE.x0, STAGE.x1);
  }
  pose(f, s) { f.st = s; f.t++; }
  tickFighter(f, o, c) {
    f.t++; f.pressed = c; f.hurtT = Math.max(0, f.hurtT - 1); if (f.inv > 0) f.inv--; f.lastHit++; f.air = f.h > 0;
    const dir = c.dx * f.face; // +1 = towards the opponent
    // input buffer (numpad notation, facing-relative): 1 2 3 / 4 5 6 / 7 8 9
    const num = (c.down ? (dir < 0 ? 1 : dir > 0 ? 3 : 2) : c.up ? (dir < 0 ? 7 : dir > 0 ? 9 : 8) : dir < 0 ? 4 : dir > 0 ? 6 : 5);
    f.buf.push(num); if (f.buf.length > 40) f.buf.shift();
    if (c.p || c.k || c.h || c.throw) f.pressedAt = f.t;
    const neutral = f.st === "idle" || f.st === "walk" || f.st === "crouch" || f.st === "jump";
    // facing
    if (neutral && f.h === 0 && f.st !== "atk") f.face = sign(o.x - f.x) || f.face;
    f.blocking = false;
    if (f.st === "atk") this.tickAttack(f, o, c);
    else if (f.st === "hit" || f.st === "block") { f.stun--; this.slide(f); if (f.stun <= 0) { f.st = f.crouch ? "crouch" : "idle"; f.combo = 0; if (f.h > 0) f.st = "jump"; } if (f.st === "block") f.blocking = true; }
    else if (f.st === "launched") { f.vh -= GRAV; f.h += f.vh; f.x += f.vx; f.x = clamp(f.x, STAGE.x0 - 20, STAGE.x1 + 20); if (f.h <= 0) { f.h = 0; f.vh = 0; f.vx = 0; this.sfx.thudStone && this.sfx.thudStone(); this.fx.burst(f.x, FLOOR - 4, 8, { color: "#d8cdb8", g: 60, speed: [30, 120], angle: [Math.PI, TAU], life: [0.2, 0.5] }); f.st = f.hp <= 0 ? "ko" : "down"; f.t = 0; f.combo = 0; this.shake(4, 0.2); } }
    else if (f.st === "down") { if (f.t > 38) { f.st = "getup"; f.t = 0; f.inv = 14; } }
    else if (f.st === "getup") { if (f.t > 14) { f.st = "idle"; } }
    else if (f.st === "ko") { /* stay down */ }
    else if (f.st === "throw") { f.t++; if (f.t > 28) f.st = "idle"; }
    else { this.tickNeutral(f, o, c, dir); }
    // gravity for jump
    if (f.st === "jump" || (f.st === "atk" && f.mv && f.mv.air)) {
      f.vh -= GRAV; f.h += f.vh; f.x += f.vx;
      if (f.h <= 0) { f.h = 0; f.vh = 0; f.vx = 0; if (f.st === "atk") { f.st = "idle"; f.mv = null; } else { f.st = "idle"; } f.t = 0; this.fx.burst(f.x, FLOOR - 3, 4, { color: "#d8cdb8", g: 40, speed: [20, 70], angle: [Math.PI, TAU], life: [0.15, 0.35] }); }
    }
    f.x = clamp(f.x, STAGE.x0, STAGE.x1);
    f.meter = clamp(f.meter, 0, 300);
  }
  slide(f) { f.x += f.vx; f.vx *= 0.86; f.x = clamp(f.x, STAGE.x0, STAGE.x1); }

  tickNeutral(f, o, c, dir) {
    const D = f.def, spd = D.walk;
    f.crouch = c.down && f.h === 0;
    if (f.st !== "jump") {
      if (f.crouch) { f.st = "crouch"; f.vx = 0; }
      else if (c.up && f.h === 0) { f.st = "jump"; f.t = 0; f.vh = D.jump; f.vx = c.dx * (c.dx * f.face > 0 ? spd : D.back) * 1.25; this.sfx.jump(); }
      else if (c.dx) { f.st = "walk"; f.x += c.dx * (dir > 0 ? spd : D.back); f.walkT += 1; f.face = sign(o.x - f.x) || f.face; }
      else { f.st = "idle"; }
    }
    f.blocking = dir < 0 && f.h === 0 && o.st !== "ko";
    // attacks
    const buttons = c.p ? "p" : c.k ? "k" : c.h ? "h" : null;
    if (buttons || c.throw) this.startMove(f, o, c, buttons);
  }
  startMove(f, o, c, btn, cancel = false) {
    const buf = f.buf.slice(-26), D = f.def;
    const has = (seq, win) => { const tail = f.buf.slice(-win); let i = 0; for (const n of tail) { if (n === seq[i]) i++; if (i === seq.length) return true; } return false; };
    // special motions (checked in the last ~22 frames; diagonals are optional for a forgiving feel)
    const qcf = has([2, 3, 6], 22) || has([2, 6], 12), qcb = has([2, 1, 4], 22) || has([2, 4], 12), dp = has([6, 2, 3], 22) || has([6, 3], 12) || has([6, 2, 6], 14);
    const dbl = has([2, 3, 6, 2, 3, 6], 44) || has([2, 6, 2, 6], 36);
    let mv = null; const air = f.h > 0;
    if (!air && btn) {
      if (dbl && f.meter >= 300) { mv = SPECIALS[D.sup === "multi" ? "multiS" : D.sup](f, btn); f.meter -= 300; this.supers += f === this.p[0] ? 1 : 0; this.superFlash = 0.7; this.sfx.powerup(); this.juice.doFlash(0.35, "#fff"); this.fl.add(f.x, FLOOR - 200, "SUPER!", "#ffe27a", 26); }
      else if (dp) mv = SPECIALS[D.spec.dp](f, btn); else if (qcf) mv = SPECIALS[D.spec.qcf](f, btn); else if (qcb) mv = SPECIALS[D.spec.qcb](f, btn);
      if (mv) { mv.dmg *= D.dmg; if (btn === "p" && !mv.sup) mv = { ...mv, sf: mv.sf + 1 }; }
    }
    if (!mv && c.throw && !air) mv = this.mkNormal(f, "throw");
    if (!mv && btn) {
      const crouch = c.down; let key;
      if (air) key = btn === "p" || btn === "h" ? "jp" : "jk";
      else if (crouch) key = btn === "p" ? "cp" : btn === "k" ? "ck" : "ch";
      else key = btn === "p" ? "lp" : btn === "k" ? "lk" : (c.dx * f.face >= 0 && f.t % 2 === 0 ? "hp" : "hk");
      if (btn === "h" && !crouch && !air) key = "hp"; if (btn === "k" && !crouch && !air && c.dx * f.face > 0) key = "hk";
      mv = this.mkNormal(f, key);
    }
    if (!mv) return false;
    f.mv = mv; f.st = "atk"; f.t = 0; f.conn = false; f.hitsDone = 0; f.crouch = !!mv.crouch; f.hitList = null; f.projDone = false; f.armorHit = false; f.sx = f.x;
    if (mv.inv) f.inv = Math.max(f.inv, mv.inv);
    if (mv.air) { /* keeps momentum */ } else { f.vx = 0; }
    this.sfx.swing && this.sfx.swing();
    return true;
  }
  mkNormal(f, key) { return moveFor(f, key); }

  tickAttack(f, o, c) {
    const mv = f.mv, t = f.t, end = mv.sf + mv.af + mv.rf;
    // movement during the move
    if (t > mv.sf - 1 && t <= mv.sf + mv.af) { if (mv.vx) f.x += mv.vx * f.face; if (mv.rise && t === mv.sf) { f.vh = mv.rise; f.h = 1; } if (mv.teleport && t === mv.sf) { f.x = clamp(o.x - o.face * 110 * -1, STAGE.x0, STAGE.x1); this.fx.burst(f.x, FLOOR - 80, 14, { color: f.def.proj, g: -20, speed: [30, 160] }); f.face = sign(o.x - f.x) || f.face; } }
    else if (mv.step && t < mv.sf) f.x += mv.step * 0.5 * f.face;
    if (mv.rise && f.h > 0) { f.vh -= GRAV; f.h += f.vh; if (f.h <= 0) { f.h = 0; f.vh = 0; } }
    // projectile moves
    if (mv.proj && t === mv.sf && !f.projDone) { f.projDone = true; this.spawnProj(f, mv); }
    // hits
    if (!mv.proj && !mv.teleport && t >= mv.sf && t < mv.sf + mv.af) {
      const gap = mv.hits ? mv.hitGap : 999; const hitNow = mv.hits ? ((t - mv.sf) % gap === 0 && f.hitsDone < mv.hits) : !f.conn;
      if (hitNow) { const r = this.hitbox(f, mv); if (this.overlap(r, o.hurt)) this.resolveHit(f, o, mv, f.hitsDone === (mv.hits || 1) - 1); }
    }
    // cancel into a special or another normal when it connected
    if (f.conn && mv.cancel && t >= mv.sf && t < mv.sf + mv.af + 4 && f.pressedAt === f.t && (c.p || c.k || c.h)) { const ok = (c.down || f.buf.slice(-24).some((n) => n === 2)) ? true : false; const btn = c.p ? "p" : c.k ? "k" : "h"; const prev = f.mv; this.startMove(f, o, c, btn, true); if (f.mv === prev) { /* no new move */ } }
    if (t >= end) { f.st = f.h > 0 ? "jump" : f.crouch && c.down ? "crouch" : "idle"; f.mv = null; f.t = 0; }
  }
  hitbox(f, mv) { const [bx, by, bw, bh] = mv.box, s = f.def.scale; const x0 = f.face > 0 ? f.x + bx * s : f.x - (bx + bw) * s; return { x0, x1: x0 + bw * s, y0: f.h + by * s, y1: f.h + (by + bh) * s }; }
  overlap(a, b) { return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0; }

  spawnProj(f, mv) {
    const P = mv.proj; this.projs.push({ owner: f, x: f.x + f.face * 60, h: P.ground ? 30 : P.beam ? 90 : 95, vx: P.speed * f.face, dmg: P.dmg * f.def.dmg, size: P.size, hs: P.hs, bs: P.bs, low: !!P.low, launch: P.launch || 0, pierce: !!P.pierce, beam: !!P.beam, color: f.def.proj, life: 150, hit: false, ph: Math.random() * 6 });
    this.sfx.pistol && this.sfx.pistol(); this.fx.burst(f.x + f.face * 60, FLOOR - 95, 6, { color: f.def.proj, g: 0, speed: [30, 120] });
  }
  tickProjs() {
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i]; p.x += p.vx; p.life--; const o = this.p[1 - this.p.indexOf(p.owner)];
      if (this.frame % 3 === 0) this.fx.emit({ x: p.x, y: FLOOR - p.h + (Math.random() - 0.5) * 20 * p.size, vx: -p.vx * 4 + (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 30, size: 3 * p.size, life: 0.3, color: p.color, g: 0, drag: 2 });
      const r = { x0: p.x - 22 * p.size, x1: p.x + 22 * p.size, y0: p.h - 18 * p.size, y1: p.h + 18 * p.size };
      let dead = p.life <= 0 || p.x < -80 || p.x > STAGE.w + 80;
      // projectiles cancel each other
      for (let j = 0; j < i && !dead; j++) { const q = this.projs[j]; if (q.owner !== p.owner && Math.abs(q.x - p.x) < 36 * (p.size + q.size) / 2 && Math.abs(q.h - p.h) < 50) { if (p.size > q.size + 0.3 && !q.beam) { this.projs.splice(j, 1); i--; } else if (q.size > p.size + 0.3) dead = true; else { dead = true; this.projs.splice(j, 1); i--; } this.fx.burst(p.x, FLOOR - p.h, 12, { color: "#fff", speed: [60, 200], g: 0 }); this.sfx.impact && this.sfx.impact(); } }
      if (!dead && !p.hit && this.overlap(r, o.hurt)) { this.resolveHit(p.owner, o, { dmg: p.dmg, hs: p.hs, bs: p.bs, kb: 7, launch: p.launch, lvl: p.low ? "l" : "m", meter: 25, chip: 0.12, proj: true }, true); p.hit = true; if (!p.pierce) dead = true; else p.hit = false, p.hitCd = 10; }
      if (dead) this.projs.splice(i, 1);
    }
  }
  separate(a, b) {
    if (a.h > 6 || b.h > 6 || a.st === "launched" || b.st === "launched") { const d = Math.abs(a.x - b.x); if (d < 30 && a.h === 0 === (b.h === 0) && false) { } return; }
    const minD = 62 * (a.def.scale + b.def.scale) / 2, d = b.x - a.x, ad = Math.abs(d);
    if (ad < minD) { const push = (minD - ad) / 2, s = d >= 0 ? 1 : -1; let ax = a.x - s * push, bx = b.x + s * push; // corners
      if (ax < STAGE.x0) { bx += STAGE.x0 - ax; ax = STAGE.x0; } if (bx > STAGE.x1) { ax -= bx - STAGE.x1; bx = STAGE.x1; } if (bx < STAGE.x0) { ax += STAGE.x0 - bx; bx = STAGE.x0; } if (ax > STAGE.x1) { bx -= ax - STAGE.x1; ax = STAGE.x1; }
      a.x = ax; b.x = bx; }
  }

  // ---- what happens when an attack lands ----
  resolveHit(f, o, mv, last) {
    if (o.inv > 0 && !mv.proj) return; if (o.inv > 0 && mv.proj) return;
    if (mv.grab && o.h > 0) return; const grab = mv.grab; f.hitsDone++;
    const dirT = (o.pressed && o.pressed.dx !== undefined) ? o.pressed.dx * o.face : 0;
    const canBlock = !grab && o.h === 0 && (o.st === "idle" || o.st === "walk" || o.st === "crouch" || o.st === "block") && dirT < 0;
    const lowBlocked = canBlock && (mv.lvl === "l" ? o.crouch : true) && (mv.lvl === "h" ? true : true);
    let blocked = canBlock && (mv.lvl === "l" ? o.pressed.down : mv.lvl === "h" ? !o.pressed.down || true : true);
    if (canBlock && mv.lvl === "l" && !o.pressed.down) blocked = false; // low attacks need a crouching guard
    if (canBlock && mv.lvl === "h" && o.pressed.down === false) blocked = true;
    if (mv.lvl === "m" && canBlock) blocked = true;
    const o2 = o; let dmg = mv.dmg * (grab ? 1 : Math.max(0.3, 1 - 0.1 * Math.max(0, f.combo))) ;
    if (grab && (o.st === "atk" && o.mv && o.mv.grab)) { return; }
    if (blocked) {
      o.st = "block"; o.t = 0; o.stun = mv.bs + 2; o.vx = -o.face * (mv.kb + 2) * 0.9; o.crouch = !!o.pressed.down; f.conn = true; o.meter += 8; f.meter += 10;
      const chip = Math.round(dmg * (mv.chip || 0.1)); if (o.hp > chip) o.hp -= chip; o.flash = 4; f.vx = f.h === 0 ? -f.face * 2.2 : f.vx;
      this.sfx.thudWood && this.sfx.thudWood(); this.spark(o, f, "block", mv); this.juice.hitstop(0.03); return;
    }
    if (o.mv && o.mv.armor && o.st === "atk" && !mv.launch && !grab && !mv.sup) { o.armorHit = true; o.hp -= Math.round(dmg * 0.4); o.flash = 6; this.spark(o, f, "armor", mv); this.juice.hitstop(0.04); f.conn = true; f.meter += 10; return; }
    f.conn = true; f.combo++; f.lastHit = 0; f.meter += mv.meter || 20; o.meter += 14; o.combo = 0; f.comboDmg = (f.lastCombo === f.combo - 1 ? f.comboDmg : 0) + dmg;
    if (grab) { o.hp -= Math.round(dmg); o.st = "launched"; o.t = 0; o.vh = 9; o.h = 1; o.vx = -o.face * 3.2; f.st = "atk"; this.sfx.punch && this.sfx.punch(); this.shake(7, 0.3); this.juice.hitstop(0.11); this.spark(o, f, "big", mv); this.fl.add(o.x, FLOOR - 200, `-${Math.round(dmg)}`, "#fff", 22); o.flash = 8; this.popCombo(f); return; }
    o.hp = Math.max(0, o.hp - Math.round(dmg)); o.flash = 6; o.hurtT = 12;
    const air = o.h > 0, launch = mv.launch || (air ? 6 : 0) || (o.hp <= 0 ? 8 : 0) || (f.combo >= 9 ? 6 : 0), strong = mv.dmg >= 70 || launch;
    if (launch || o.hp <= 0) { o.st = "launched"; o.t = 0; o.vh = launch || 8; o.h = Math.max(o.h, 1); o.vx = -o.face * (mv.kb + (launch ? 2.5 : 3)); o.mv = null; }
    else { o.st = "hit"; o.t = 0; o.stun = mv.hs + 2; o.vx = -o.face * (mv.kb + 1.5); o.mv = null; o.crouch = o.crouch && !air; }
    if (f.h === 0) f.vx = f.st === "atk" ? -f.face * (mv.kb * 0.25) : 0; // attacker is pushed back a little at the corner
    if (o.x <= STAGE.x0 + 2 || o.x >= STAGE.x1 - 2) { f.x -= f.face * mv.kb * 0.7; }
    this.spark(o, f, strong ? "big" : "hit", mv); (strong ? this.sfx.punch : this.sfx.kill) && (strong ? this.sfx.punch() : this.sfx.stomp());
    this.juice.hitstop(strong ? 0.09 : 0.05); if (strong) this.shake(5, 0.2);
    if (f.combo >= 2) this.popCombo(f);
    f.lastCombo = f.combo;
  }
  popCombo(f) { if (f === this.p[0] || this.cpuBoth) f.comboPop = 1; }
  spark(o, f, kind, mv) {
    const y = FLOOR - Math.min(150, o.h + 100), x = o.x - o.face * 20;
    const col = kind === "block" ? "#8be9ff" : kind === "armor" ? "#ffd23a" : kind === "big" ? "#fff2a0" : "#ffe27a";
    this.fx.burst(x, y, kind === "big" ? 22 : 12, { color: col, speed: [80, kind === "big" ? 360 : 240], size: [2, 5], life: [0.15, 0.4], g: 100, drag: 3 });
    this.sparks.push({ x, y, t: 0, kind, big: kind === "big", face: -o.face });
    if (kind !== "block") this.fl.add(o.x, FLOOR - 190, `${Math.round(mv.dmg || 0)}`, "#fff", 15);
  }
  shake(m, d) { this.shakeM = Math.max(this.shakeM, m); this.shakeT = Math.max(this.shakeT, d); }

  // ---------------------------------------------------------------------------------------------------------------------- drawing
  draw(g, env) {
    if (this.state === "select") { this.drawSelect(g); return; }
    const [a, b] = this.p, z = this.zoom, cam = this.camX;
    if (this.bd) this.bd.draw(g, cam * 0.9, 0, this.t, 960, 540, { camYFactor: 0.1 }); else { g.fillStyle = "#222"; g.fillRect(0, 0, 960, 540); }
    if (this.rung.tint) { g.fillStyle = this.rung.tint + "22"; g.fillRect(0, 0, 960, 540); }
    // crowd silhouettes
    this.drawCrowd(g, cam);
    g.save();
    const sx = this.shakeT > 0 ? (Math.random() - 0.5) * this.shakeM * Math.min(1, this.shakeT * 6) : 0, sy = this.shakeT > 0 ? (Math.random() - 0.5) * this.shakeM * Math.min(1, this.shakeT * 6) : 0;
    g.translate(sx, sy); g.translate(480, FLOOR); g.scale(z, z); g.translate(-480, -FLOOR); g.translate(-cam, 0);
    this.drawFloor(g, cam);
    for (const f of this.p) { shadowBlob(g, f.x, FLOOR + 6, 44 * f.def.scale * (1 - Math.min(0.5, f.h / 400)), 9, 0.35); }
    const order = a.h > 0 || a.st === "atk" ? [b, a] : [a, b]; for (const f of order) drawFighter(g, f, this.t, this.state);
    for (const p of this.projs) this.drawProj(g, p);
    this.fx.draw(g);
    for (let i = this.sparks.length - 1; i >= 0; i--) { const s = this.sparks[i]; s.t += 1; const k = s.t / 10; if (k > 1) { this.sparks.splice(i, 1); continue; } this.drawSpark(g, s, k); }
    this.fl.draw(g);
    g.restore();
    if (this.superFlash > 0) { g.fillStyle = `rgba(10,5,30,${Math.min(0.55, this.superFlash)})`; g.fillRect(0, 0, 960, 540); }
    this.juice.draw(g, 960, 540);
    this.drawHud(g);
    if (this.demo) { g.fillStyle = "rgba(0,0,0,.25)"; g.fillRect(0, 0, 960, 540); }
  }
  drawCrowd(g, cam) { g.save(); g.fillStyle = "rgba(10,6,24,.55)"; for (let i = 0; i < 26; i++) { const x = ((i * 83 - cam * 0.55) % 1100 + 1100) % 1100 - 60, bob = Math.sin(this.t * 3 + i) * 3 * (this.state === "fight" ? 1 : 0.4); g.beginPath(); g.ellipse(x, FLOOR - 68 - bob - (i % 3) * 8, 17, 21, 0, 0, TAU); g.fill(); g.fillRect(x - 15, FLOOR - 50 - bob - (i % 3) * 8, 30, 50); } g.restore(); }
  drawFloor(g, cam) {
    const y0 = FLOOR + 2; g.fillStyle = this.floorColor(); g.fillRect(cam - 100, y0, 1400 / this.zoom + 400, 400);
    g.fillStyle = "rgba(255,255,255,.07)"; g.fillRect(cam - 100, y0, 1400 / this.zoom + 400, 5);
    g.strokeStyle = "rgba(255,255,255,.07)"; g.lineWidth = 2; for (let i = -12; i < 40; i++) { const x = i * 80; g.beginPath(); g.moveTo(x, y0 + 4); g.lineTo(480 + (x - 480) * 2.6, y0 + 160); g.stroke(); }
    for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(cam - 100, y0 + k * k * 6); g.lineTo(cam + 1400, y0 + k * k * 6); g.stroke(); }
  }
  floorColor() { return { harbor: "#3d4a63", factory: "#4b4540", ruins: "#8a7455", desert: "#b58f5c", sewer: "#2d4a42", snow: "#9fb4c8", volcano: "#3a1f1c", dungeon: "#2b2342" }[this.rung.stage] || "#444"; }
  drawProj(g, p) {
    const x = p.x, y = FLOOR - p.h, s = p.size; g.save(); g.translate(x, y); glow(g, 0, 0, 52 * s, p.color, 0.55);
    if (p.beam) { g.fillStyle = p.color; g.globalAlpha = 0.85; g.fillRect(-120 * Math.sign(p.vx), -22, 120, 44); g.globalAlpha = 1; }
    g.rotate(p.ph + this.t * 8); ellipse(g, 0, 0, 22 * s, 16 * s, p.color, "#fff", 2.5); ellipse(g, 0, 0, 11 * s, 8 * s, "#fff", null); g.restore();
  }
  drawSpark(g, s, k) { g.save(); g.translate(s.x, s.y); g.globalAlpha = 1 - k; const r = (s.big ? 54 : 34) * (0.4 + k); g.strokeStyle = s.kind === "block" ? "#8be9ff" : "#fff6c0"; g.lineWidth = 5 * (1 - k) + 1; for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + 0.2; g.beginPath(); g.moveTo(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); g.stroke(); } g.restore(); }

  drawHud(g) {
    const [a, b] = this.p;
    const bw = 380, y = 22;
    const hpBar = (f, x, flip) => {
      const t = f.hp / f.def.hp; g.save(); if (flip) { g.translate(960, 0); g.scale(-1, 1); }
      fillRR(g, x - 3, y - 3, bw + 6, 30, 8, "rgba(10,6,24,.82)", "rgba(255,255,255,.25)", 2);
      const sh = (f.shown ?? t); f.shown = sh + (t - sh) * 0.06; g.fillStyle = "#ffcf5a"; g.fillRect(x, y, bw * clamp(f.shown, 0, 1), 24);
      const gr = g.createLinearGradient(0, y, 0, y + 24); gr.addColorStop(0, "#9cff7a"); gr.addColorStop(1, t < 0.3 ? "#ff3a3a" : "#2fbf3a"); g.fillStyle = t < 0.3 ? "#ff4a4a" : gr; g.fillRect(x, y, bw * clamp(t, 0, 1), 24);
      g.restore();
      text(g, f.def.name.toUpperCase(), flip ? 960 - x - 0 : x, y + 52, { size: 16, color: "#fff", align: flip ? "right" : "left", font: FONT_DISPLAY, weight: 800, stroke: OUT, strokeW: 4 });
      // super meter
      const mx = flip ? 960 - x - 220 : x; fillRR(g, mx, 506, 220, 14, 6, "rgba(10,6,24,.8)", "rgba(255,255,255,.2)", 1.5); const full = f.meter >= 300; g.fillStyle = full ? (Math.floor(this.t * 6) % 2 ? "#ffe27a" : "#ff9a3c") : "#5cd0ff"; g.fillRect(mx + 2, 508, 216 * f.meter / 300, 10);
      if (full) text(g, "SUPER READY", mx + 110, 497, { size: 12, color: "#ffe27a", align: "center", font: FONT_DISPLAY, weight: 800, stroke: OUT, strokeW: 3 });
    };
    hpBar(a, 40, false); hpBar(b, 40, true);
    fillRR(g, 440, 14, 80, 44, 10, "rgba(10,6,24,.85)", "rgba(255,255,255,.3)", 2); text(g, String(Math.max(0, this.timer)), 480, 49, { size: 30, color: this.timer <= 10 ? "#ff6a6a" : "#fff", align: "center", font: FONT_DISPLAY, weight: 800 });
    for (let i = 0; i < 2; i++) { for (let k = 0; k < 2; k++) { const x = i === 0 ? 424 - k * 20 : 536 + k * 20; circle(g, x, 70, 7, k < this.wins[i] ? "#ffcf3a" : "rgba(255,255,255,.18)", OUT, 2); } }
    for (const f of this.p) if (f.combo >= 2 && f.lastHit < 60) { const x = f === a ? 120 : 840; text(g, `${f.combo} HITS`, x, 150, { size: 30 + Math.min(14, f.combo * 2), color: "#ffe27a", align: "center", font: FONT_DISPLAY, weight: 800, stroke: OUT, strokeW: 5 }); text(g, `${Math.round(f.comboDmg)} damage`, x, 176, { size: 14, color: "#fff", align: "center", font: FONT_BODY, weight: 600, stroke: OUT, strokeW: 3 }); }
    if (this.state === "intro") { const t = this.stateT; if (t < 60) text(g, `ROUND ${this.round}`, 480, 240, { size: 64, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 800, stroke: OUT, strokeW: 8, alpha: clamp(t / 10, 0, 1) }); else if (t < 105) { text(g, "FIGHT!", 480, 250, { size: 92 + (t - 60) * 0.6, color: "#ffcf3a", align: "center", font: FONT_DISPLAY, weight: 800, stroke: OUT, strokeW: 10 }); } if (t < 30) text(g, this.rung.tag, 480, 290, { size: 18, color: "#d8d0ff", align: "center", font: FONT_BODY, weight: 600, stroke: OUT, strokeW: 4 }); }
    if (this.state === "roundEnd" && this.msg) text(g, this.msg, 480, 240, { size: 84, color: "#ff5a4a", align: "center", font: FONT_DISPLAY, weight: 800, stroke: OUT, strokeW: 10, alpha: clamp(this.stateT / 10, 0, 1) });
  }
  drawSelect(g) {
    g.fillStyle = "#0f0a24"; g.fillRect(0, 0, 960, 540); const gr = g.createRadialGradient(480, 200, 40, 480, 270, 620); gr.addColorStop(0, "#3a1d6e"); gr.addColorStop(1, "#0b0720"); g.fillStyle = gr; g.fillRect(0, 0, 960, 540);
    text(g, "CHOOSE YOUR FIGHTER", 80, 90, { size: 40, color: "#fff", font: FONT_DISPLAY, weight: 800 });
    text(g, `Match ${this.lv.index + 1} of ${LADDER.length}: ${this.rung.name}`, 80, 122, { size: 16, color: "#c9b8ff", font: FONT_BODY, weight: 600 });
    FIGHTERS.forEach((F, i) => { const bx = 80 + (i % 3) * 150, by = 150 + Math.floor(i / 3) * 170, on = i === this.sel; fillRR(g, bx, by, 135, 155, 14, on ? "rgba(255,200,90,.22)" : "rgba(255,255,255,.07)", on ? "#ffcf5a" : "rgba(255,255,255,.2)", on ? 3 : 1.5);
      g.save(); g.beginPath(); g.rect(bx + 2, by + 2, 131, 120); g.clip(); g.translate(bx + 67, by + 112); g.scale(0.5, 0.5); const ft = new Fighter(F, 0, 1, 0); ft.st = "idle"; drawFighter(g, ft, this.t + i, "select", true); g.restore();
      text(g, F.name, bx + 67, by + 145, { size: 15, color: on ? "#ffe27a" : "#fff", align: "center", font: FONT_DISPLAY, weight: 800 }); });
    const F = FIGHTERS[this.sel]; fillRR(g, 560, 120, 340, 300, 16, "rgba(255,255,255,.07)", "rgba(255,255,255,.2)", 2);
    text(g, F.name, 580, 166, { size: 34, color: "#fff", font: FONT_DISPLAY, weight: 800 }); text(g, F.title, 580, 192, { size: 16, color: "#ffcf5a", font: FONT_BODY, weight: 700 });
    const st = [["Power", F.power], ["Speed", F.speed], ["Reach", F.range], ["Technique", F.skill]];
    st.forEach(([n, v], i) => { text(g, n, 580, 232 + i * 26, { size: 14, color: "#c9b8ff", font: FONT_BODY, weight: 600 }); for (let k = 0; k < 5; k++) { fillRR(g, 670 + k * 34, 220 + i * 26, 28, 12, 4, k < v ? "#ffcf5a" : "rgba(255,255,255,.14)", null, 0); } });
    text(g, F.blurb, 580, 350, { size: 14, color: "#fff", font: FONT_BODY, weight: 500, maxW: 300 });
    text(g, "Special moves: ↓ ↘ → + punch, → ↓ ↘ + punch, ↓ ↙ ← + kick", 580, 386, { size: 11, color: "#a99bd6", font: FONT_BODY, weight: 500 });
    fillRR(g, 610, 448, 290, 56, 14, "#ff9a3c", OUT, 3); text(g, "FIGHT!  (Enter)", 755, 485, { size: 26, color: "#1a0c05", align: "center", font: FONT_DISPLAY, weight: 800 });
  }
}

// ---- the computer opponent -----------------------------------------------------------------------------------------------------------------
class Brain {
  constructor(diff) { this.d = clamp(diff, 0, 8); this.plan = "idle"; this.planT = 0; this.seq = []; this.think0 = 0; this.cd = 0; this.rt = 0; }
  think(f, o, S) {
    const d = this.d, c = { dx: 0, down: false, up: false, p: false, k: false, h: false, throw: false }; const away = (f.x < o.x ? -1 : 1);
    if (S.state !== "fight") return c;
    const fwd = o.x > f.x ? 1 : -1, dist = Math.abs(o.x - f.x), r = Math.random.bind(Math);
    // scripted special inputs
    if (this.seq.length) { const s = this.seq.shift(); const out = { ...c, ...s }; if (out.fwd) { out.dx = fwd * out.fwd; } return out; }
    this.planT--; this.cd--;
    const canAct = f.st === "idle" || f.st === "walk" || f.st === "crouch" || (f.st === "jump" && false);
    // react to danger
    const react = Math.max(4, 22 - d * 2.4); this.rt--;
    if (this.rt <= 0 && (canAct || f.st === "block")) {
      this.rt = react;
      const threat = o.st === "atk" && o.mv && o.t < o.mv.sf + o.mv.af && dist < 200 + (o.mv.box ? o.mv.box[0] + o.mv.box[2] : 0);
      const projThreat = S.projs.some((p) => p.owner === o && Math.abs(p.x - f.x) < 240);
      if ((threat || projThreat) && r() < 0.18 + d * 0.1) { this.plan = "block"; this.planT = 16 + (r() * 10 | 0); this.crouchBlock = o.mv && o.mv.lvl === "l" || (o.mv && o.mv.crouch && r() < 0.5); }
      else if (o.h > 20 && o.st !== "launched" && dist < 190 && r() < 0.15 + d * 0.09 && f.h === 0) { // anti-air
        if (r() < 0.5) { this.seq = this.motion(f, "dp", "p"); } else { this.seq = [{ down: true, h: true }]; }
      }
    }
    if (this.plan === "block" && this.planT > 0) { c.dx = -fwd; c.down = !!this.crouchBlock; return c; }
    if (!canAct) { this.plan = "idle"; return c; }
    // choose a plan
    if (this.planT <= 0) {
      const mine = f.def; this.planT = 8 + (r() * (30 - d * 2.5) | 0);
      const aggr = 0.45 + d * 0.065;
      if (dist < 130 * mine.reach) this.plan = r() < aggr + 0.15 ? "poke" : r() < 0.5 ? "retreat" : "block";
      else if (dist < 300) this.plan = r() < aggr ? (r() < 0.4 ? "rush" : "approach") : r() < 0.4 ? "zone" : "idle";
      else this.plan = r() < 0.55 ? "approach" : r() < 0.25 + d * 0.05 ? "zone" : "idle";
      if (f.meter >= 300 && r() < 0.35 + d * 0.05 && dist < 420) this.plan = "super";
      if (o.st === "down" || o.st === "getup") this.plan = dist < 150 ? "poke" : "approach";
      if (o.st === "hit" && o.stun > 8 && dist < 160) this.plan = "combo";
    }
    const mine = f.def;
    switch (this.plan) {
      case "approach": c.dx = fwd; if (dist < 260 && r() < 0.03 + d * 0.004) c.up = true; break;
      case "retreat": c.dx = -fwd; break;
      case "block": c.dx = -fwd; c.down = r() < 0.5; break;
      case "idle": if (r() < 0.02) c.dx = fwd; break;
      case "poke": if (this.cd <= 0) { this.cd = Math.max(8, 26 - d * 2); const q = r(); const thr = o.blocking || o.st === "block"; if (thr && r() < 0.45 + d * 0.04 && dist < 100) { c.throw = true; } else if (q < 0.34) c.p = true; else if (q < 0.55) c.k = true; else if (q < 0.7) { c.down = true; c.k = true; } else if (q < 0.82 && d > 1) c.h = true, c.dx = fwd; else if (q < 0.9 && d > 2) { this.seq = this.motion(f, "qcb", "k"); } else { c.down = true; c.p = true; } } else c.dx = dist > 90 ? fwd : 0; break;
      case "combo": if (this.cd <= 0) { this.cd = 6; c.p = true; if (d > 2 && f.conn && r() < 0.6) { this.seq = this.motion(f, r() < 0.5 ? "qcf" : "dp", "h"); } } break;
      case "rush": if (this.cd <= 0 && dist < 270) { this.cd = 40; this.seq = this.motion(f, mine.spec.qcf === "rush" ? "qcf" : "qcb", "h"); } else c.dx = fwd; break;
      case "zone": if (this.cd <= 0 && (mine.spec.qcf === "proj" || mine.spec.qcf === "quake")) { this.cd = Math.max(26, 70 - d * 5); this.seq = this.motion(f, "qcf", r() < 0.4 ? "h" : "p"); } else c.dx = dist < 360 ? 0 : fwd; break;
      case "super": if (f.meter >= 300) this.seq = this.motion(f, "double", "p"); this.planT = 0; break;
      default: break;
    }
    return c;
  }
  // build a list of per-frame inputs that make the engine see a special-move motion
  motion(f, kind, btn) {
    const B = btn === "p" ? { p: true } : btn === "k" ? { k: true } : { h: true };
    const F = (x) => ({ fwd: x }), seq = [];
    const dn = (fw) => ({ down: true, fwd: fw });
    if (kind === "qcf") return [dn(0), dn(0), dn(1), dn(1), { fwd: 1 }, { fwd: 1, ...B }];
    if (kind === "qcb") return [dn(0), dn(0), dn(-1), dn(-1), { fwd: -1 }, { fwd: -1, ...B }];
    if (kind === "dp") return [{ fwd: 1 }, { fwd: 1 }, dn(0), dn(0), dn(1), { down: true, fwd: 1, ...B }];
    if (kind === "double") return [dn(0), dn(1), { fwd: 1 }, dn(0), dn(1), { fwd: 1 }, { fwd: 1, ...B }];
    return [B];
  }
}
export { Fighter };
