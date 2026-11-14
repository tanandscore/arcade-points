// Putt Planet: one hole. Drag back from the ball and let go to putt (or use the arrow keys and Space). The rules are in physics.js; this class runs the ball,
// keeps score, draws the course and the aiming guide, and can also run "headless" so tests can play real shots through the same code.
import { makeCourse, newBall, stepBall, aimLine, V_MAX, BALL_R, STEP } from "./physics";
import { WORLDS } from "./levels";
import * as A from "./art";
import { clamp, TAU, lerp } from "../../core/util";
import { Particles, FX, Floaters } from "../../core/fx";
import { Backdrop } from "../../core/backdrop";
import { text, wrapText, fillRR, circle, makeCanvas, hudChip, OUT, FONT_DISPLAY, FONT_BODY } from "../../core/draw";
import { sfx as realSfx } from "../../core/audio";

const NOOP = new Proxy({}, { get: () => () => {} });
export const NO_INPUT = { pointer: { x: -99, y: -99, down: false, pressed: false, released: false, inside: false, type: "mouse" }, pressed: () => false, held: () => false, released: () => false, keyPressed: () => false, axis: () => 0 };
const BD = new Map();
const backdropFor = (theme, seed) => { let b = BD.get(theme); if (!b) { b = new Backdrop(theme, seed); BD.set(theme, b); } return b; };
const PULL = 150;   // how far you drag for a full-power putt

export class PuttSession {
  constructor(lv, ctx = {}, opts = {}) {
    this.lv = lv; this.ctx = ctx; this.headless = !!opts.headless; this.quiet = this.headless || !!opts.quiet; this.bare = !!opts.bare; this.demo = !!opts.demo;
    this.sfx = this.quiet ? NOOP : realSfx;
    this.world = WORLDS[lv.wi]; this.look = A.LOOKS[lv.look]; this.accent = ctx.accent || "#3ee6e0";
    this.C = makeCourse(lv); this.ball = newBall(lv.tee[0], lv.tee[1]); this.start = [lv.tee[0], lv.tee[1]];
    this.state = "aim"; this.stateT = 0; this.t = 0; this.ct = 0; this.time = 0; this.strokes = 0; this.splashes = 0; this.done = null; this.moved = false; this.trail = []; this.sink = 0; this.ff = false;
    this.aim = { ang: Math.atan2(lv.cup[1] - lv.tee[1], lv.cup[0] - lv.tee[0]), pow: 0.6, drag: false, kb: false, show: false }; this.holdT = 0; this.timers = []; this.shake = 0; this.wasWet = false;
    const rec = ctx.save && ctx.save.levels ? ctx.save.levels[lv.id] : null; this.firstTime = !(rec && (rec.stars > 0 || rec.best > 0));
    this.btn = { restart: { x: 800, y: 12, w: 92, h: 36 } }; this.hintLines = [];
    if (this.headless) { this.fx = NOOP; this.fl = NOOP; return; }
    this.fx = new Particles(500); this.fl = new Floaters();
    this.bd = this.bare ? null : backdropFor(this.world.theme, (lv.wi + 1) * 11 + 5);
    if (lv.hint && this.firstTime) this.hintLines = wrapText(makeCanvas(4, 4).getContext("2d"), lv.hint, 760, 13, FONT_BODY, 500).slice(0, 2);
  }

  // ------------------------------------------------------------------------------------------------ play
  setClock(t) { this.ct = t; }
  shoot(angle, power) {
    if (this.state !== "aim") return false;
    const b = this.ball, p = clamp(power, 0.05, 1);
    if (this.lockClock != null) this.ct = this.lockClock;   // tests only: start the shot at an exact clock time
    this.start = [b.x, b.y]; this.strokes++; this.moved = true;
    b.vx = Math.cos(angle) * p * V_MAX; b.vy = Math.sin(angle) * p * V_MAX; b.state = "roll"; b.rest = 0; b.cd = 0; this.state = "roll"; this.stateT = 0; this.trail.length = 0;
    this.sfx.swing && this.sfx.swing(); this.aim.show = false;
    FX.dust && this.fx.burst && this.fx.burst(b.x, b.y, 6, { speed: [30, 110], size: [2, 4], life: [0.2, 0.45], color: "rgba(255,255,255,.7)", g: 0, drag: 3 });
    return true;
  }
  shootDeg(deg, power) { return this.shoot((deg * Math.PI) / 180, power); }
  // advance the rolling ball one fixed step (also used by headless tests)
  rollStep() {
    const ev = stepBall(this.C, this.ball, this.ct); this.ct += STEP; return ev;
  }
  runUntilStop(max = 20) { let n = 0; while (this.state === "roll" && n < max / STEP) { this.rollStep(); this.afterStep(null); n++; } }

  afterStep(ev) {
    const b = this.ball;
    if (ev === "bump") { this.sfx.impact(); if (!this.headless) { this.shake = Math.min(3, this.shake + 0.8); this.fx.burst(b.x, b.y, 3, { speed: [30, 90], size: [1.5, 3], life: [0.15, 0.3], color: "#fff", g: 100, shape: "spark", glow: true }); } }
    else if (ev === "portal") { this.sfx.whoosh(); if (b.portal && !this.headless) { FX.pop(this.fx, b.portal[0], b.portal[1], "#9ef3ff", 8); FX.pop(this.fx, b.portal[2], b.portal[3], "#ffb3ff", 8); } }
    if (b.state === "cup") { this.state = "sunk"; this.stateT = 0; this.sfx.coin(); if (!this.headless) { FX.confetti(this.fx, this.lv.cup[0], this.lv.cup[1] - 10, 36); FX.sparkle(this.fx, this.lv.cup[0], this.lv.cup[1]); } this.later(0.15, () => this.sfx.win && this.sfx.win()); }
    else if (b.state === "water") {
      this.state = "water"; this.stateT = 0; this.strokes++; this.splashes++; this.sfx.splash(); this.fl.add(b.x, b.y - 10, "+1 stroke", "#9ec7ff", 15);
      if (!this.headless) FX.pop(this.fx, b.x, b.y, this.look.hazard2, 12);
    } else if (b.state === "stopped" && this.state === "roll") { this.state = "aim"; this.stateT = 0; this.afterStop(); }
  }
  afterStop() { const b = this.ball; this.aim.ang = Math.atan2(this.lv.cup[1] - b.y, this.lv.cup[0] - b.x); }
  later(t, fn) { if (this.headless) return; this.timers.push([t, fn]); }

  restart() { const lv = this.lv; this.ball = newBall(lv.tee[0], lv.tee[1]); this.start = [lv.tee[0], lv.tee[1]]; this.state = "aim"; this.strokes = 0; this.splashes = 0; this.trail.length = 0; this.sink = 0; this.sfx.click(); this.afterStop(); for (const c of this.C.circles) c.pop = 0; }

  finishWin() {
    const lv = this.lv, par = lv.par, s = this.strokes, st = s <= par ? 3 : s <= par + 1 ? 2 : 1;
    const score = Math.max(200, 1000 + (par - s) * 300 + (s === 1 ? 1500 : 0));
    const names = { [-3]: "ALBATROSS!", [-2]: "EAGLE!", [-1]: "BIRDIE!", 0: "PAR!", 1: "BOGEY", 2: "DOUBLE BOGEY" };
    this.done = { won: true, score, stars: st, time: Math.round(this.time), title: s === 1 ? "HOLE IN ONE!" : names[s - par] || (s < par ? "UNDER PAR!" : "HOLE DONE"), sub: lv.name, delay: 1.2, lines: [["Strokes", `${s} (par ${par})`], ["Splashes", this.splashes], ["Time", `${Math.round(this.time)}s`]] };
  }

  // ------------------------------------------------------------------------------------------------ update
  update(dt, input, env) {
    for (let i = this.timers.length - 1; i >= 0; i--) { const tm = this.timers[i]; tm[0] -= dt; if (tm[0] <= 0) { this.timers.splice(i, 1); tm[1](); } }
    this.t += dt; this.stateT += dt; if (this.moved && this.state !== "sunk") this.time += dt;
    this.fx.update && this.fx.update(dt); this.fl.update && this.fl.update(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 12);
    for (const c of this.C.circles) if (c.pop > 0) c.pop = Math.max(0, c.pop - dt * 5);
    if (this.state === "roll" || this.state === "aim" || this.state === "water") this.ct += this.state === "roll" ? 0 : dt;   // while the ball rolls, rollStep keeps the clock
    if (this.state === "roll") {
      const n = this.ff ? 12 : 4;
      for (let i = 0; i < n && this.state === "roll"; i++) {
        const before = this.ball.hits, ev = this.rollStep(); this.afterStep(ev);
        if (this.ball.hits > before) { for (const c of this.C.circles) { if (c.kind === "bumper" && Math.hypot(this.ball.x - c.x, this.ball.y - c.y) < c.r + BALL_R + 2) this.sfx.pop(); } }
        if (i % 2 === 0) { this.trail.push([this.ball.x, this.ball.y]); if (this.trail.length > 46) this.trail.shift(); }
      }
      if (input.pointer.pressed || input.pressed("jump")) this.ff = true;
      if (!input.pointer.down && !input.held("jump")) this.ff = false;
    } else this.ff = false;
    if (this.state === "water" && this.stateT > 0.8) { this.ball = newBall(this.start[0], this.start[1]); this.state = "aim"; this.afterStop(); this.stateT = 0; this.trail.length = 0; }
    if (this.state === "sunk") { this.sink = clamp(this.stateT / 0.3, 0, 1); if (this.stateT > 1.0 && !this.done) this.finishWin(); return; }
    if (this.state === "aim" && !this.demo) this.handleAim(dt, input);
    else if (this.state !== "aim") { this.aim.drag = false; }
    if (input.pressed("restart") && this.state !== "sunk" && !this.demo) this.restart();
  }

  handleAim(dt, input) {
    const p = input.pointer, b = this.ball, a = this.aim;
    // restart button
    const r = this.btn.restart; if (p.pressed && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) { this.restart(); return; }
    if (p.pressed && Math.hypot(p.x - b.x, p.y - b.y) < 54) { a.drag = true; a.kb = false; }
    if (a.drag) {
      const dx = b.x - p.x, dy = b.y - p.y, len = Math.hypot(dx, dy);
      if (len > 8) { a.ang = Math.atan2(dy, dx); a.pow = clamp((len - 8) / PULL, 0, 1); a.show = true; } else a.show = false;
      if (!p.down || p.released) { a.drag = false; if (len > 22 && a.show) { this.shoot(a.ang, a.pow); } a.show = false; }
      return;
    }
    // keyboard: left/right turn, up/down change the power, space (or X) hits
    const turn = input.axis("left", "right"), pw = input.axis("down", "up");
    if (turn || pw) { a.kb = true; a.show = true; a.ang += turn * 1.7 * dt * (input.held("alt") ? 0.3 : 1); a.pow = clamp(a.pow + pw * 0.8 * dt, 0.06, 1); this.holdT = 3; }
    if (this.holdT > 0) this.holdT -= dt; else if (!a.kb) a.show = false;
    if (input.pressed("jump") || input.pressed("fire") || input.pressed("confirm")) { a.show = true; if (a.kb || true) this.shoot(a.ang, a.pow); }
    if (input.pressed("alt")) { a.kb = true; a.show = true; this.holdT = 3; }
  }

  // ------------------------------------------------------------------------------------------------ draw
  draw(g, env) {
    const lv = this.lv, C = this.C, look = this.look, t = this.t;
    if (this.bd) this.bd.draw(g, 0, 0, t, 960, 540, {});
    if (!this.bare) { g.fillStyle = "rgba(10,5,32,.28)"; g.fillRect(0, 0, 960, 540); }
    g.save();
    if (this.shake > 0.05) g.translate((Math.random() - 0.5) * this.shake * 2, (Math.random() - 0.5) * this.shake * 2);
    g.drawImage(A.courseLayer(lv, look), 0, 0, 960, 540);
    A.drawWater(g, C.water, look, t);
    A.drawBoost(g, C.boost, t);
    for (const p of C.portals) { A.drawPortal(g, p[0], p[1], t, "#6ee7ff"); A.drawPortal(g, p[2], p[3], t, "#ff8ae6"); }
    for (const c of C.circles) if (c.kind !== "planet") A.drawBumper(g, c, t);
    for (const w of C.wells) A.drawPlanet(g, w, t, look);
    for (const bl of C.blades) A.drawBlade(g, bl, this.ct);
    // trail
    for (let i = 0; i < this.trail.length; i++) { const q = this.trail[i], k = i / this.trail.length; g.globalAlpha = k * 0.4; circle(g, q[0], q[1], BALL_R * 0.6 * k + 1, "#ffffff", null, 0); } g.globalAlpha = 1;
    // the ball and the flag (the flag stands behind the ball when the ball is lower on screen)
    const b = this.ball;
    if (b.y <= lv.cup[1]) { if (this.state !== "water") A.drawBall(g, b.x, b.y, t, this.sink); A.drawFlag(g, lv.cup[0], lv.cup[1], t); } else { A.drawFlag(g, lv.cup[0], lv.cup[1], t); if (this.state !== "water") A.drawBall(g, b.x, b.y, t, this.sink); }
    if (this.state === "aim" && this.aim.show && !this.demo) this.drawAim(g);
    if (this.state === "aim" && !this.moved && !this.demo && !this.aim.show) { const k = 0.5 + 0.5 * Math.sin(t * 4); g.save(); g.globalAlpha = 0.5 + k * 0.4; g.strokeStyle = "#fff"; g.lineWidth = 3; g.setLineDash([6, 7]); g.beginPath(); g.arc(b.x, b.y, 26 + k * 4, 0, TAU); g.stroke(); g.restore(); }
    this.fx.draw && this.fx.draw(g); this.fl.draw && this.fl.draw(g);
    g.restore();
    if (this.bare) return;
    this.drawHud(g);
  }

  drawAim(g) {
    const a = this.aim, b = this.ball, pts = aimLine(this.C, b.x, b.y, a.ang, 150 + a.pow * 260, 2);
    g.save(); g.lineCap = "round";
    g.setLineDash([2, 11]); g.lineWidth = 5; g.strokeStyle = "rgba(255,255,255,.9)"; g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.stroke(); g.setLineDash([]);
    const e = pts[pts.length - 1]; circle(g, e[0], e[1], 4, "#fff", OUT, 1.5);
    // power: a bar that grows out behind the ball, from green to red
    const bx = b.x - Math.cos(a.ang) * 24, by = b.y - Math.sin(a.ang) * 24, L = 14 + a.pow * 74, ex = b.x - Math.cos(a.ang) * (24 + L), ey = b.y - Math.sin(a.ang) * (24 + L);
    g.strokeStyle = OUT; g.lineWidth = 11; g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.stroke();
    g.strokeStyle = `hsl(${Math.round(130 - a.pow * 125)},90%,58%)`; g.lineWidth = 7; g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.stroke();
    g.restore();
    text(g, `${Math.round(a.pow * 100)}%`, ex - Math.cos(a.ang) * 22, ey - Math.sin(a.ang) * 22 + 5, { size: 14, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 800, stroke: OUT, strokeW: 4 });
  }

  drawHud(g) {
    const lv = this.lv;
    g.fillStyle = "rgba(10,5,32,.62)"; g.fillRect(0, 0, 960, 60); g.fillStyle = "rgba(190,180,255,.25)"; g.fillRect(0, 59, 960, 1.5);
    text(g, `${lv.id}  ${lv.name}`, 20, 28, { size: 20, color: "#fff", font: FONT_DISPLAY, weight: 800 });
    text(g, `${this.world.name}`, 20, 47, { size: 11.5, color: "#c3bbea", font: FONT_BODY, weight: 600 });
    hudChip(g, 330, 13, "STROKES", this.strokes, this.strokes > lv.par ? "#ff9a8a" : "#7dffb0", 130);
    hudChip(g, 470, 13, "PAR", lv.par, "#ffc233", 90);
    hudChip(g, 570, 13, "SPLASHES", this.splashes, this.splashes ? "#9ec7ff" : "#c3bbea", 120);
    const r = this.btn.restart; g.save(); fillRR(g, r.x, r.y, r.w, r.h, 12, "rgba(14,6,36,.7)", "rgba(190,180,255,.4)", 1.5); text(g, "Restart", r.x + r.w / 2, r.y + 24, { size: 14.5, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 700 }); g.restore();
    if (this.hintLines.length && (!this.moved || this.t < 16)) this.hintLines.forEach((ln, i) => text(g, ln, 480, 524 - (this.hintLines.length - 1 - i) * 16, { size: 13, color: "#f0eaff", align: "center", font: FONT_BODY, weight: 600, stroke: "#150a33", strokeW: 4 }));
    else if (this.state === "aim" && !this.moved) text(g, "Drag back from the ball and let go  ·  or use arrow keys + Space", 480, 526, { size: 13, color: "#f0eaff", align: "center", font: FONT_BODY, weight: 600, stroke: "#150a33", strokeW: 4 });
    if (this.state === "roll" && this.t > 0) text(g, "Tap to speed up", 480, 526, { size: 12, color: "rgba(240,234,255,.55)", align: "center", font: FONT_BODY, weight: 600 });
  }
}
