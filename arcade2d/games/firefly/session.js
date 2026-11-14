// Firefly Jars: one play-through of one level. The rules live in rules.js; this class reads taps / keys, keeps the undo history,
// animates the fireflies and draws the shelf and the top bar. It also runs "headless" (no drawing) so tests can play whole levels.
import { parseMap, cloneState, tap, solved, countLit, countJars, affected, PATTERNS } from "./rules";
import { WORLDS, starsFor } from "./levels";
import { clamp, TAU } from "../../core/util";
import { Particles, FX, Floaters } from "../../core/fx";
import { Backdrop } from "../../core/backdrop";
import { text, wrapText, fillRR, hudChip, makeCanvas, FONT_DISPLAY, FONT_BODY } from "../../core/draw";
import { sfx as realSfx } from "../../core/audio";

const NOOP = new Proxy({}, { get: () => () => {} });
export const NO_INPUT = { pointer: { x: -99, y: -99, down: false, pressed: false, released: false, inside: false, type: "mouse" }, pressed: () => false, held: () => false, axis: () => 0, keyPressed: () => false };
const BD = new Map();
const backdropFor = (theme, seed) => { let b = BD.get(theme); if (!b) { b = new Backdrop(theme, seed); BD.set(theme, b); } return b; };

export class FireflySession {
  constructor(lv, ctx = {}, opts = {}) {
    this.lv = lv; this.ctx = ctx; this.headless = !!opts.headless; this.quiet = this.headless || !!opts.quiet; this.bare = !!opts.bare; this.demo = !!opts.demo;
    this.sfx = this.quiet ? NOOP : realSfx; this.pat = lv.pat; this.world = WORLDS[lv.wi]; this.accent = ctx.accent || "#ffd23f";
    this.S = parseMap(lv.map); this.w = this.S.w; this.h = this.S.h;
    this.cs = opts.cs || Math.max(46, Math.min(Math.floor(420 / this.h), Math.floor(860 / this.w), 96));
    const cx = opts.cx ?? 480, cy = opts.cy ?? 306;
    this.bx = Math.round(cx - (this.w * this.cs) / 2); this.by = Math.round(cy - (this.h * this.cs) / 2);
    this.t = 0; this.time = 0; this.done = null; this.state = "play"; this.stateT = 0; this.hist = []; this.undos = 0; this.moved = false;
    this.pulse = new Float32Array(this.w * this.h); this.cursor = -1; this.useKeys = false; this.timers = []; this.wrong = 0;
    const rec = ctx.save && ctx.save.levels ? ctx.save.levels[lv.id] : null; this.firstTime = !(rec && (rec.stars > 0 || rec.best > 0));
    this.btn = { undo: { x: 706, y: 12, w: 86, h: 36 }, restart: { x: 800, y: 12, w: 92, h: 36 } };
    this.hintLines = [];
    if (this.headless) { this.fx = NOOP; this.fl = NOOP; return; }
    this.fx = new Particles(500); this.fl = new Floaters();
    this.bd = this.bare ? null : backdropFor(this.world.theme, (lv.wi + 1) * 5 + 3);
    if (lv.hint && this.firstTime) this.hintLines = wrapText(makeCanvas(4, 4).getContext("2d"), lv.hint, 780, 13, FONT_BODY, 500).slice(0, 2);
  }

  X(i) { return this.bx + (i % this.w) * this.cs; }
  Y(i) { return this.by + ((i / this.w) | 0) * this.cs; }
  later(t, fn) { if (this.headless) return; this.timers.push([t, fn]); }

  // tap jar i. Returns true when something flipped.
  tapJar(i) {
    if (this.state !== "play") return false;
    const S = this.S, before = cloneState(S), list = tap(S, this.pat, i);
    if (!list) { if (i >= 0 && S.jar[i] && S.frozen[i]) { this.wrong = 0.3; this.sfx.thudIce(); } else this.sfx.empty(); return false; }
    this.hist.push(before); this.moved = true;
    list.forEach((j, k) => { this.pulse[j] = 0.4 + k * 0.03; });
    this.sfx.pop();
    if (!this.headless) list.forEach((j) => { const cx = this.X(j) + this.cs / 2, cy = this.Y(j) + this.cs / 2; if (S.lit[j]) FX.sparkle(this.fx, cx, cy); });
    if (solved(S)) { this.state = "winning"; this.stateT = 0; this.later(0.25, () => { this.sfx.star(); FX.confetti(this.fx, this.bx + this.w * this.cs / 2, this.by + this.h * this.cs / 2, 70); }); }
    return true;
  }
  undo() { if (!this.hist.length || this.state !== "play") { this.sfx.empty(); return false; } this.S = this.hist.pop(); this.undos++; this.sfx.back(); return true; }
  restart() { this.S = parseMap(this.lv.map); this.hist = []; this.state = "play"; this.moved = false; this.time = 0; this.sfx.click(); }

  finishWin() {
    const S = this.S, lv = this.lv, st = starsFor(S.moves, lv.par), score = st * 1000 + Math.max(0, 500 - Math.max(0, S.moves - lv.par) * 15 - this.undos * 5);
    this.done = { won: true, score, stars: st, time: Math.round(this.time), title: st === 3 ? "ALL GLOWING!" : st === 2 ? "BRIGHT WORK!" : "LIGHTS ON!", sub: lv.name, delay: 1.0,
      lines: [["Taps", `${S.moves} (3 stars at ${lv.par + Math.ceil(lv.par * 0.25)} or fewer)`], ["Fewest possible", `${lv.par}`], ["Jars", `${countJars(S)}`]] };
  }

  jarAt(px, py) { const cx = Math.floor((px - this.bx) / this.cs), cy = Math.floor((py - this.by) / this.cs); return cx >= 0 && cy >= 0 && cx < this.w && cy < this.h ? cy * this.w + cx : -1; }

  update(dt, input, env) {
    for (let i = this.timers.length - 1; i >= 0; i--) { const tm = this.timers[i]; tm[0] -= dt; if (tm[0] <= 0) { this.timers.splice(i, 1); tm[1](); } }
    this.t += dt; if (this.state === "play" && this.moved) this.time += dt;
    this.fx.update && this.fx.update(dt); this.fl.update && this.fl.update(dt);
    for (let i = 0; i < this.pulse.length; i++) if (this.pulse[i] > 0) this.pulse[i] -= dt;
    if (this.wrong > 0) this.wrong -= dt;
    this.stateT += dt;
    if (this.state === "winning") { if (this.stateT > 1.1 && !this.done) this.finishWin(); return; }
    if (this.state !== "play" || this.demo) return;
    this.handleInput(input);
  }

  handleInput(input) {
    const p = input.pointer, hit = (r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    if (input.pressed("restart") || input.keyPressed("KeyR")) { this.restart(); return; }
    if (input.keyPressed("KeyU") || input.keyPressed("Backspace") || input.pressed("alt")) { this.undo(); return; }
    const mv = [["left", -1, 0], ["right", 1, 0], ["up", 0, -1], ["down", 0, 1]];
    for (const [a, dx, dy] of mv) if (input.pressed(a)) {
      this.useKeys = true; if (this.cursor < 0) this.cursor = 0;
      else { const x = clamp((this.cursor % this.w) + dx, 0, this.w - 1), y = clamp(((this.cursor / this.w) | 0) + dy, 0, this.h - 1); this.cursor = y * this.w + x; }
    }
    if (this.useKeys && this.cursor >= 0 && (input.keyPressed("Space") || input.keyPressed("Enter"))) { this.tapJar(this.cursor); return; }
    if (p.inside && (Math.abs(p.x - (this.lastPX ?? -99)) > 2 || Math.abs(p.y - (this.lastPY ?? -99)) > 2)) { this.useKeys = false; }
    this.lastPX = p.x; this.lastPY = p.y;
    if (p.pressed) {
      if (hit(this.btn.undo)) { this.undo(); return; }
      if (hit(this.btn.restart)) { this.restart(); return; }
      const i = this.jarAt(p.x, p.y); if (i >= 0) { this.useKeys = false; this.cursor = i; this.tapJar(i); }
    }
  }

  // ---------------------------------------------------------------------------------------------------------------- drawing
  focusIndex() { const p = this.ctx.env && this.ctx.env.input && this.ctx.env.input.pointer; if (this.useKeys) return this.cursor; return this.hoverI ?? -1; }

  draw(g, env) {
    const S = this.S, cs = this.cs, t = this.t, W = this.w, bw = W * cs, bh = this.h * cs;
    const ptr = env && env.input && env.input.pointer; this.hoverI = ptr && ptr.inside ? this.jarAt(ptr.x, ptr.y) : -1;
    if (this.bd) this.bd.draw(g, 0, 0, t, 960, 540, {});
    if (!this.bare) { g.fillStyle = "rgba(8,4,30,.46)"; g.fillRect(0, 0, 960, 540); }
    fillRR(g, this.bx - 12, this.by - 10, bw + 24, bh + 24, 18, "rgba(10,5,32,.74)", "rgba(255,226,140,.35)", 2);
    // which jars would flip if the player tapped the focused jar
    const fi = this.state === "play" && !this.demo ? (this.useKeys ? this.cursor : this.hoverI) : -1, ghost = new Set();
    if (fi >= 0 && S.jar[fi] && !S.frozen[fi]) affected(this.pat, W, this.h, S.jar, fi).forEach((j) => ghost.add(j));
    // shelf boards
    for (let y = 0; y < this.h; y++) { g.fillStyle = "rgba(120,80,50,.55)"; g.fillRect(this.bx - 4, this.by + (y + 1) * cs - 5, bw + 8, 7); g.fillStyle = "rgba(255,210,150,.18)"; g.fillRect(this.bx - 4, this.by + (y + 1) * cs - 5, bw + 8, 2); }
    for (let i = 0; i < S.jar.length; i++) {
      if (!S.jar[i]) continue;
      this.drawJar(g, this.X(i), this.Y(i), cs, S.lit[i], S.frozen[i], this.pulse[i], t, i, ghost.has(i), i === fi);
    }
    this.fx.draw && this.fx.draw(g); this.fl.draw && this.fl.draw(g);
    if (this.bare) return;
    this.drawHud(g);
  }

  drawJar(g, x, y, cs, lit, frozen, pulse, t, i, ghost, focus) {
    const cx = x + cs / 2, jw = cs * 0.74, jh = cs * 0.84, jx = cx - jw / 2, jy = y + cs * 0.08, pu = pulse > 0 ? Math.sin((pulse / 0.4) * Math.PI) : 0;
    g.save(); g.translate(cx, y + cs * 0.5); g.scale(1 + pu * 0.14, 1 + pu * 0.14); g.translate(-cx, -(y + cs * 0.5));
    if (this.wrong > 0 && frozen) g.translate(Math.sin(t * 60) * 3, 0);
    if (lit) { // warm glow behind the glass
      g.save(); g.globalCompositeOperation = "lighter"; const r = cs * (0.62 + 0.05 * Math.sin(t * 3 + i)), gr = g.createRadialGradient(cx, y + cs * 0.52, 2, cx, y + cs * 0.52, r);
      gr.addColorStop(0, "rgba(255,236,120,.75)"); gr.addColorStop(1, "rgba(255,200,40,0)"); g.fillStyle = gr; g.fillRect(cx - r, y + cs * 0.52 - r, r * 2, r * 2); g.restore();
    }
    // glass
    fillRR(g, jx, jy + jh * 0.12, jw, jh * 0.88, jw * 0.22, lit ? "rgba(255,244,190,.34)" : "rgba(170,190,255,.16)", lit ? "rgba(255,232,140,.9)" : "rgba(190,205,255,.55)", 2.2);
    fillRR(g, jx + jw * 0.14, jy, jw * 0.72, jh * 0.18, 4, lit ? "#c9923a" : "#5a4a7a", "#150a33", 2);
    g.fillStyle = "rgba(255,255,255,.28)"; g.fillRect(jx + jw * 0.14, jy + jh * 0.28, jw * 0.07, jh * 0.46);
    // the firefly
    const bob = Math.sin(t * (lit ? 4 : 1.2) + i * 1.7) * (lit ? cs * 0.04 : cs * 0.012), fx = cx, fy = y + cs * 0.56 + bob;
    if (lit) {
      const flap = Math.sin(t * 30 + i) * 0.5 + 0.5;
      g.fillStyle = "rgba(255,255,255,.75)"; g.beginPath(); g.ellipse(fx - cs * 0.1, fy - cs * 0.1, cs * 0.1, cs * (0.05 + flap * 0.05), -0.6, 0, TAU); g.fill(); g.beginPath(); g.ellipse(fx + cs * 0.1, fy - cs * 0.1, cs * 0.1, cs * (0.05 + flap * 0.05), 0.6, 0, TAU); g.fill();
      g.fillStyle = "#3b2a18"; g.beginPath(); g.ellipse(fx, fy - cs * 0.04, cs * 0.075, cs * 0.1, 0, 0, TAU); g.fill();
      g.fillStyle = "#ffe85a"; g.beginPath(); g.ellipse(fx, fy + cs * 0.1, cs * 0.095, cs * 0.105, 0, 0, TAU); g.fill();
      g.fillStyle = "#fff"; g.beginPath(); g.arc(fx - cs * 0.03, fy + cs * 0.07, cs * 0.03, 0, TAU); g.fill();
    } else {
      g.fillStyle = "#3a3358"; g.beginPath(); g.ellipse(fx, fy - cs * 0.02, cs * 0.075, cs * 0.1, 0, 0, TAU); g.fill();
      g.fillStyle = "#554c7c"; g.beginPath(); g.ellipse(fx, fy + cs * 0.1, cs * 0.09, cs * 0.1, 0, 0, TAU); g.fill();
      g.strokeStyle = "rgba(230,230,255,.7)"; g.lineWidth = 1.6; g.beginPath(); g.moveTo(fx - cs * 0.045, fy - cs * 0.02); g.lineTo(fx - cs * 0.01, fy - cs * 0.02); g.moveTo(fx + cs * 0.01, fy - cs * 0.02); g.lineTo(fx + cs * 0.045, fy - cs * 0.02); g.stroke();
    }
    if (frozen) { // ice crust
      fillRR(g, jx - 2, jy + jh * 0.1, jw + 4, jh * 0.92, jw * 0.22, "rgba(150,220,255,.38)", "rgba(220,245,255,.95)", 2.5);
      g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 1.5; g.beginPath(); g.moveTo(jx + jw * 0.2, jy + jh * 0.35); g.lineTo(jx + jw * 0.45, jy + jh * 0.55); g.lineTo(jx + jw * 0.35, jy + jh * 0.8); g.moveTo(jx + jw * 0.8, jy + jh * 0.3); g.lineTo(jx + jw * 0.62, jy + jh * 0.5); g.stroke();
    }
    g.restore();
    if (ghost) { g.save(); g.strokeStyle = this.accent; g.globalAlpha = 0.55 + 0.25 * Math.sin(t * 8); g.lineWidth = 3; g.setLineDash([6, 5]); fillRR(g, x + 3, y + 2, cs - 6, cs - 4, 12, null, this.accent, 3); g.restore(); }
    if (focus) { g.save(); g.lineWidth = 3.5; fillRR(g, x + 1, y, cs - 2, cs - 1, 14, "rgba(255,255,255,.06)", "#ffffff", 3.5); g.restore(); }
  }

  drawHud(g) {
    const S = this.S, lv = this.lv, lit = countLit(S), n = countJars(S);
    g.fillStyle = "rgba(10,5,32,.62)"; g.fillRect(0, 0, 960, 60); g.fillStyle = "rgba(255,226,140,.28)"; g.fillRect(0, 59, 960, 1.5);
    text(g, `${lv.id}  ${lv.name}`, 20, 28, { size: 20, color: "#fff", font: FONT_DISPLAY, weight: 800 });
    text(g, `Tap flips: ${PATTERNS[this.pat].short}`, 20, 47, { size: 11.5, color: "#e8d9a6", font: FONT_BODY, weight: 600 });
    hudChip(g, 300, 13, "AWAKE", `${lit}/${n}`, lit >= n ? "#7dffb0" : "#ffe27a", 112);
    hudChip(g, 420, 13, "TAPS", `${S.moves}`, "#bfe9ff", 100);
    hudChip(g, 528, 13, "PAR", `${lv.par}`, "#c3bbea", 80);
    this.button(g, this.btn.undo, "Undo", this.hist.length > 0); this.button(g, this.btn.restart, "Restart", true);
    if (this.hintLines.length && (!this.moved || this.t < 14)) this.hintLines.forEach((ln, i) => text(g, ln, 480, 526 - (this.hintLines.length - 1 - i) * 16, { size: 12.5, color: "#f1e7cf", align: "center", font: FONT_BODY, weight: 600, stroke: "#150a33", strokeW: 4 }));
    else if (this.moved && this.state === "play" && this.hist.length > 4) text(g, "Stuck? Undo (U) or restart (R) is always free.", 480, 526, { size: 12, color: "#e8d9a6", align: "center", font: FONT_BODY, weight: 600, stroke: "#150a33", strokeW: 4 });
  }
  button(g, r, label, on) { g.save(); g.globalAlpha = on ? 1 : 0.45; fillRR(g, r.x, r.y, r.w, r.h, 12, "rgba(14,6,36,.7)", "rgba(255,226,140,.45)", 1.5); text(g, label, r.x + r.w / 2, r.y + 24, { size: 14.5, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 700 }); g.restore(); }
}
