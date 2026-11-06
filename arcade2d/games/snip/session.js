// Snip & Drop: one level. Swipe across a rope to cut it, tap a bubble to pop it. Feed the berry to the critter and grab the stars on the way.
// The rope physics live in physics.js. Like the other games this runs headless too, so tests can play real cuts through the same code.
import { makeSim, step, cutRope, popBubble, segHitsRope, DT, BERRY_R, MOUTH_R } from "./physics";
import { WORLDS } from "./levels";
import * as A from "./art";
import { clamp, TAU, lerp } from "../../core/util";
import { Particles, FX, Floaters } from "../../core/fx";
import { Backdrop } from "../../core/backdrop";
import { text, wrapText, fillRR, circle, makeCanvas, hudChip, star, OUT, FONT_DISPLAY, FONT_BODY } from "../../core/draw";
import { sfx as realSfx } from "../../core/audio";

const NOOP = new Proxy({}, { get: () => () => {} });
export const NO_INPUT = { pointer: { x: -99, y: -99, down: false, pressed: false, released: false, inside: false, type: "mouse" }, pressed: () => false, held: () => false, released: () => false, keyPressed: () => false, axis: () => 0 };
const BD = new Map();
const backdropFor = (theme, seed) => { let b = BD.get(theme); if (!b) { b = new Backdrop(theme, seed); BD.set(theme, b); } return b; };

export class SnipSession {
  constructor(lv, ctx = {}, opts = {}) {
    this.lv = lv; this.ctx = ctx; this.headless = !!opts.headless; this.quiet = this.headless || !!opts.quiet; this.bare = !!opts.bare; this.demo = !!opts.demo;
    this.sfx = this.quiet ? NOOP : realSfx;
    this.world = WORLDS[lv.wi]; this.look = A.LOOKS[lv.look]; this.accent = ctx.accent || "#4fd1ff";
    this.t = 0; this.done = null; this.cuts = 0; this.attempts = 1; this.timers = []; this.swipe = []; this.last = null; this.stateT = 0; this.shake = 0; this.eat = 0; this.open = 0;
    this.reset();
    const rec = ctx.save && ctx.save.levels ? ctx.save.levels[lv.id] : null; this.firstTime = !(rec && (rec.stars > 0 || rec.best > 0)); this.hintLines = [];
    this.btn = { restart: { x: 800, y: 12, w: 92, h: 36 } };
    if (this.headless) { this.fx = NOOP; this.fl = NOOP; return; }
    this.fx = new Particles(500); this.fl = new Floaters();
    this.bd = this.bare ? null : backdropFor(this.world.theme, (lv.wi + 1) * 13 + 2);
    if (lv.hint && this.firstTime) this.hintLines = wrapText(makeCanvas(4, 4).getContext("2d"), lv.hint, 780, 13, FONT_BODY, 500).slice(0, 2);
  }

  reset() { this.S = makeSim(this.lv); this.state = "play"; this.stateT = 0; this.acc = 0; this.eat = 0; this.open = 0; this.timers = []; this.cuts = 0; this.swipe.length = 0; this.last = null; this.time = 0; }
  restart() { this.attempts++; this.reset(); this.sfx.click(); }

  // actions (also used by the tests and the idle demo)
  cut(id, x, y) {
    if (this.state !== "play") return false; const ok = cutRope(this.S, id, x, y); if (ok) { this.cuts++; this.afterEvents(); } return ok;
  }
  pop(i) { if (this.state !== "play") return false; const ok = popBubble(this.S, i); if (ok) this.afterEvents(); return ok; }
  tick() { step(this.S); this.afterEvents(); this.time = this.S.t; }
  afterEvents() {
    const S = this.S;
    for (const e of S.events) {
      if (e.k === "cut") { this.sfx.swing && this.sfx.swing(); this.sfx.tick(); if (!this.headless) FX.sparks(this.fx, e.x, e.y, 6, "#ffe9a8"); }
      else if (e.k === "pop") { this.sfx.bubble(); if (!this.headless) FX.pop(this.fx, e.x, e.y, "#cdeaff", 10); }
      else if (e.k === "bubble") { this.sfx.bubble(); }
      else if (e.k === "star") { this.sfx.star(); if (!this.headless) { FX.pop(this.fx, e.x, e.y, "#ffe27a", 12); this.fl.add(e.x, e.y - 18, "+500", "#ffe27a", 16); } }
      else if (e.k === "fed") { this.state = "fed"; this.stateT = 0; this.sfx.coin(); this.later(0.35, () => this.sfx.win()); if (!this.headless) { const c = this.lv.critter; FX.confetti(this.fx, c[0], c[1] - 20, 40); FX.pop(this.fx, c[0], c[1], "#ff8ad2", 16); } }
      else if (e.k === "spike" || e.k === "fall") { this.state = "lost"; this.stateT = 0; this.sfx.hurt(); if (!this.headless) { const b = this.S.berry; FX.pop(this.fx, clamp(b.x, 0, 960), clamp(b.y, 0, 540), "#c06bff", 14); } this.shake = 4; }
    }
    S.events.length = 0;
  }
  later(t, fn) { if (!this.headless) this.timers.push([t, fn]); }

  finish() {
    const S = this.S, got = S.got, st = got >= 3 ? 3 : got >= 1 ? 2 : 1, tt = Math.round(this.time * 10) / 10;
    const score = 1000 + got * 500 + Math.max(0, Math.round((12 - tt) * 40)) - (this.attempts - 1) * 100;
    this.done = { won: true, score: Math.max(300, score), stars: st, time: Math.round(this.time), title: got >= 3 ? "YUMMY! 3 STARS" : got >= 1 ? "NOM NOM!" : "FED!", sub: this.lv.name, delay: 1.0, lines: [["Stars collected", `${got} / ${S.stars.length}`], ["Ropes cut", this.cuts], ["Tries", this.attempts]] };
  }

  // ------------------------------------------------------------------------------------------------ update
  update(dt, input, env) {
    for (let i = this.timers.length - 1; i >= 0; i--) { const tm = this.timers[i]; tm[0] -= dt; if (tm[0] <= 0) { this.timers.splice(i, 1); tm[1](); } }
    this.t += dt; this.stateT += dt; this.fx.update && this.fx.update(dt); this.fl.update && this.fl.update(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 14);
    const b = this.S.berry, c = this.lv.critter, near = Math.hypot(b.x - c[0], b.y - c[1]);
    this.open = lerp(this.open, this.state === "fed" ? 0 : clamp((230 - near) / 150, 0, 1), 0.2);
    if (this.state === "fed") { this.eat = Math.min(1, this.stateT / 0.5); if (this.stateT > 1.1 && !this.done) this.finish(); }
    if (this.state === "play") {
      this.acc += dt; while (this.acc >= DT && this.state === "play") { step(this.S); this.afterEvents(); this.acc -= DT; } this.time = this.S.t;
      if (!this.demo) this.handleInput(input);
    } else if (this.state === "lost") { if (this.stateT > 1.1) this.restart(); }
    if (this.state !== "fed" && input.pressed("restart") && !this.demo) this.restart();
  }

  handleInput(input) {
    const p = input.pointer, S = this.S;
    const r = this.btn.restart; if (p.pressed && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) { this.restart(); return; }
    // tap a bubble
    if (p.pressed) S.bubbles.forEach((b, i) => { if (b.state !== "popped" && Math.hypot(p.x - b.x, p.y - b.y) < b.r + 6) this.pop(i); });
    // swipe across a rope
    if (p.down) {
      if (this.last) for (let i = 0; i < S.ropes.length; i++) { const hit = segHitsRope(S, i, this.last[0], this.last[1], p.x, p.y); if (hit) this.cut(i, hit[0], hit[1]); }
      this.last = [p.x, p.y]; this.swipe.push([p.x, p.y, this.t]); if (this.swipe.length > 14) this.swipe.shift();
    } else { this.last = null; }
    while (this.swipe.length && this.t - this.swipe[0][2] > 0.18) this.swipe.shift();
    // keyboard: 1-5 cut the ropes from left to right, Space pops the bubble the berry rides
    const order = S.ropes.map((r, i) => [r.ax, i]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    order.forEach((id, k) => { if (input.keyPressed("Digit" + (k + 1)) || input.keyPressed("Numpad" + (k + 1))) this.cut(id); });
    if (input.pressed("jump") || input.pressed("fire")) { const held = S.berry.bubble; if (held >= 0) this.pop(held); else { const i = S.bubbles.findIndex((b) => b.state !== "popped"); if (i >= 0) this.pop(i); } }
  }

  // ------------------------------------------------------------------------------------------------ draw
  draw(g, env) {
    const lv = this.lv, S = this.S, look = this.look, t = this.t;
    if (this.bd) this.bd.draw(g, 0, 0, t, 960, 540, {});
    if (!this.bare) { g.fillStyle = "rgba(10,5,32,.18)"; g.fillRect(0, 0, 960, 540); }
    g.save();
    if (this.shake > 0.1) g.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    for (const b of lv.blocks || []) A.drawLedge(g, b, look);
    for (const s of lv.spikes || []) A.drawSpikes(g, s, t);
    const c = lv.critter, be = S.berry;
    A.drawCritter(g, c[0], c[1] - 14, t, this.state === "fed" ? 0.1 : this.open, this.eat, be.x, be.y, this.state === "fed" ? 1 : 0);
    for (const r of S.ropes) A.drawRope(g, r, look, S, t);
    for (const r of S.ropes) A.drawPin(g, r.ax, r.ay, look);
    S.stars.forEach((s, i) => A.drawStar(g, s.x, s.y, t, s.got, i));
    for (const b of S.bubbles) A.drawBubble(g, b, t);
    if (this.state !== "fed" && !(this.state === "lost" && this.stateT > 0.1)) A.drawBerry(g, be.x, be.y, t, 1, 0.5);
    else if (this.state === "fed") { const k = clamp(this.stateT / 0.25, 0, 1); if (k < 1) A.drawBerry(g, lerp(be.x, c[0], k), lerp(be.y, c[1] - 6, k), t, 1 - k * 0.8, 0.4); }
    // the swipe trail
    if (this.swipe.length > 1) { g.save(); g.lineCap = "round"; g.lineJoin = "round"; g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 4; g.beginPath(); this.swipe.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.stroke(); g.restore(); }
    this.fx.draw && this.fx.draw(g); this.fl.draw && this.fl.draw(g);
    g.restore();
    if (this.bare) return;
    this.drawHud(g);
    if (this.state === "lost") { const k = clamp(this.stateT / 0.2, 0, 1); g.save(); g.globalAlpha = k; text(g, "Oh no! Try again", 480, 300, { size: 44, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 900, stroke: "#150a33", strokeW: 8 }); g.restore(); }
  }

  drawHud(g) {
    const lv = this.lv, S = this.S;
    g.fillStyle = "rgba(10,5,32,.62)"; g.fillRect(0, 0, 960, 60); g.fillStyle = "rgba(190,180,255,.25)"; g.fillRect(0, 59, 960, 1.5);
    text(g, `${lv.id}  ${lv.name}`, 20, 28, { size: 20, color: "#fff", font: FONT_DISPLAY, weight: 800 });
    text(g, this.world.name, 20, 47, { size: 11.5, color: "#c3bbea", font: FONT_BODY, weight: 600 });
    // the three star slots
    for (let i = 0; i < 3; i++) star(g, 400 + i * 40, 31, 15, i < S.got ? "#ffc233" : "rgba(60,30,90,.8)", i < S.got ? OUT : "rgba(190,180,255,.4)", 2);
    hudChip(g, 540, 13, "CUTS", this.cuts, "#bfe9ff", 96); hudChip(g, 644, 13, "TRIES", this.attempts, "#c3bbea", 104);
    const r = this.btn.restart; g.save(); fillRR(g, r.x, r.y, r.w, r.h, 12, "rgba(14,6,36,.7)", "rgba(190,180,255,.4)", 1.5); text(g, "Restart", r.x + r.w / 2, r.y + 24, { size: 14.5, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 700 }); g.restore();
    if (this.hintLines.length && (this.cuts === 0 || this.t < 14)) this.hintLines.forEach((ln, i) => text(g, ln, 480, 524 - (this.hintLines.length - 1 - i) * 16, { size: 13, color: "#f0eaff", align: "center", font: FONT_BODY, weight: 600, stroke: "#150a33", strokeW: 4 }));
  }
}
