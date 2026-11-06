// Crate Courier: one play-through of one level. The rules live in rules.js; this class animates every move (walking, pushing, sliding on ice,
// dropping into holes), reads keyboard / touch buttons / taps, keeps the undo history and draws the warehouse and the top bar.
// It also runs "headless" (no drawing) so tests can play whole levels through the same code the player uses.
import { parseMap, cloneState, step, solved, FLOOR, WALL, GOAL, ICE, HOLE } from "./rules";
import * as A from "./art";
import { WORLDS, starsFor } from "./levels";
import { clamp, lerp, TAU, ease } from "../../core/util";
import { Particles, FX, Floaters } from "../../core/fx";
import { Backdrop } from "../../core/backdrop";
import { text, wrapText, fillRR, glow, hudChip, makeCanvas, FONT_DISPLAY, FONT_BODY } from "../../core/draw";
import { sfx as realSfx } from "../../core/audio";

const NOOP = new Proxy({}, { get: () => () => {} });
export const NO_INPUT = { pointer: { x: -99, y: -99, down: false, pressed: false, released: false, inside: false, type: "mouse" }, pressed: () => false, held: () => false, axis: () => 0, keyPressed: () => false };

const DUR = 0.13;                 // one step
const DIRK = { U: 0, R: 1, D: 2, L: 3 };
const KEYS = [["left", "L"], ["right", "R"], ["up", "U"], ["down", "D"]];
const BD = new Map();
const backdropFor = (theme, seed) => { let b = BD.get(theme); if (!b) { b = new Backdrop(theme, seed); BD.set(theme, b); } return b; };

export class CrateSession {
  constructor(lv, ctx = {}, opts = {}) {
    this.lv = lv; this.ctx = ctx; this.headless = !!opts.headless; this.quiet = this.headless || !!opts.quiet; this.bare = !!opts.bare; this.demo = !!opts.demo;
    this.sfx = this.quiet ? NOOP : realSfx;
    this.world = WORLDS[lv.wi]; this.look = A.LOOKS[lv.wi % 4]; this.accent = ctx.accent || "#ff9d2e";
    this.S = parseMap(lv.map); this.w = this.S.w; this.h = this.S.h;
    this.cs = opts.cs || Math.max(34, Math.min(Math.floor(430 / this.h), Math.floor(900 / this.w), 66));
    const cx = opts.cx ?? 480, cy = opts.cy ?? 304;
    this.bx = Math.round(cx - (this.w * this.cs) / 2); this.by = Math.round(cy - (this.h * this.cs) / 2);
    this.t = 0; this.time = 0; this.done = null; this.state = "play"; this.stateT = 0;
    this.anim = 9; this.animDur = DUR; this.mv = null; this.heroFrom = this.S.hero; this.heroDir = 2; this.bumpT = 0; this.bumpDir = null;
    this.queue = null; this.auto = []; this.holdA = null; this.holdT = 0; this.hist = []; this.undos = 0; this.moved = false;
    this.padsDone = this.countPads(); this.timers = []; this.shk = 0; this.holeGhost = null;
    const rec = ctx.save && ctx.save.levels ? ctx.save.levels[lv.id] : null; this.firstTime = !(rec && (rec.stars > 0 || rec.best > 0));
    this.btn = { undo: { x: 706, y: 12, w: 86, h: 36 }, restart: { x: 800, y: 12, w: 92, h: 36 } };
    this.hintLines = [];
    if (this.headless) { this.fx = NOOP; this.fl = NOOP; return; }
    this.fx = new Particles(500); this.fl = new Floaters();
    this.bd = this.bare ? null : backdropFor(this.world.theme, (lv.wi + 1) * 5 + 2);
    if (lv.hint && this.firstTime) this.hintLines = wrapText(makeCanvas(4, 4).getContext("2d"), lv.hint, 780, 13, FONT_BODY, 500).slice(0, 2);
  }

  countPads() { const S = this.S; return S.goals.filter((g) => S.crates.includes(g)).length; }
  X(i) { return this.bx + (i % this.w) * this.cs; }
  Y(i) { return this.by + ((i / this.w) | 0) * this.cs; }

  // ---------------------------------------------------------------------------------------------------------------- actions
  apply(code) {
    if (this.state !== "play") return false;
    const before = cloneState(this.S), S = this.S;
    if (!step(S, code)) {
      this.S = before; this.bumpT = 0.16; this.bumpDir = code; this.sfx.bump(); if (DIRK[code] != null) this.heroDir = DIRK[code]; return false;
    }
    this.hist.push(before); if (this.hist.length > 600) this.hist.shift();
    this.moved = true; const ev = S.ev;
    this.heroFrom = ev.from; this.heroDir = DIRK[code]; this.anim = 0; this.animDur = DUR;
    this.mv = null; this.holeGhost = null;
    if (ev.push) {
      const slide = ev.push.path.length - 1; this.animDur = DUR + Math.max(0, slide - 1) * 0.06;
      this.mv = { path: ev.push.path, falls: ev.push.falls, to: ev.push.to };
      if (ev.push.falls) this.holeGhost = ev.fell;
      this.sfx.place(); if (slide > 1) this.later(DUR, () => this.sfx.whoosh());
      const done = this.animDur;
      if (ev.push.falls) this.later(done, () => { this.sfx.splash(); const x = this.X(ev.fell) + this.cs / 2, y = this.Y(ev.fell) + this.cs / 2; FX.dust(this.fx, x, y, 8, "rgba(255,255,255,.8)"); this.fl.add(x, y - 10, "Filled!", "#9ef3ff", 15); this.holeGhost = null; });
      else if (S.goals.includes(ev.push.to)) this.later(done, () => { this.sfx.coin(); FX.sparkle(this.fx, this.X(ev.push.to) + this.cs / 2, this.Y(ev.push.to) + this.cs / 2); FX.sparkle(this.fx, this.X(ev.push.to) + this.cs / 2, this.Y(ev.push.to) + this.cs / 2); });
      else this.later(done, () => { FX.dust(this.fx, this.X(ev.push.to) + this.cs / 2, this.Y(ev.push.to) + this.cs * 0.8, 4); });
    } else this.sfx.step();
    this.padsDone = this.countPads();
    if (solved(S)) { this.state = "winning"; this.stateT = 0; this.later(this.animDur + 0.05, () => { this.sfx.star(); FX.confetti(this.fx, this.bx + this.w * this.cs / 2, this.by + this.h * this.cs / 2, 60); }); }
    return true;
  }

  later(t, fn) { if (this.headless) return; this.timers.push([t, fn]); }
  undo() {
    if (!this.hist.length || this.state !== "play") { this.sfx.empty(); return false; }
    this.S = this.hist.pop(); this.anim = 9; this.mv = null; this.holeGhost = null; this.queue = null; this.auto = []; this.undos++; this.heroFrom = this.S.hero; this.padsDone = this.countPads(); this.timers = []; this.sfx.back(); return true;
  }
  restart() {
    this.S = parseMap(this.lv.map); this.hist = []; this.state = "play"; this.anim = 9; this.mv = null; this.holeGhost = null; this.queue = null; this.auto = []; this.heroFrom = this.S.hero;
    this.padsDone = this.countPads(); this.timers = []; this.sfx.click(); this.moved = false; this.time = 0;
  }

  finishWin() {
    const S = this.S, lv = this.lv, st = starsFor(S.moves, lv.par), score = st * 1000 + Math.max(0, 500 - Math.max(0, S.moves - lv.par) * 10 - this.undos * 5);
    this.done = {
      won: true, score, stars: st, time: Math.round(this.time), title: st === 3 ? "PERFECT DELIVERY!" : st === 2 ? "GOOD DELIVERY!" : "DELIVERED!", sub: lv.name, delay: 1.0,
      lines: [["Moves", `${S.moves} (3 stars at ${lv.par + Math.ceil(lv.par * 0.25)} or fewer)`], ["Pushes", `${S.pushes}`], ["Fewest possible", `${lv.par}`]],
    };
  }

  // a walk from the courier to a tapped square (through free floor only)
  pathTo(tx, ty) {
    const S = this.S, N = S.w * S.h, prev = new Int16Array(N).fill(-2), q = [S.hero]; prev[S.hero] = -1; const goal = ty * S.w + tx;
    for (let i = 0; i < q.length && prev[goal] === -2; i++) {
      const c = q[i], cx = c % S.w, cy = (c / S.w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= S.w || ny >= S.h) continue;
        const n = ny * S.w + nx; if (prev[n] !== -2 || S.tile[n] === WALL || S.tile[n] === HOLE || S.crates.includes(n)) continue;
        prev[n] = c; q.push(n);
      }
    }
    if (prev[goal] === -2) return [];
    const out = []; let c = goal;
    while (prev[c] >= 0) { const p = prev[c], dx = (c % S.w) - (p % S.w), dy = ((c / S.w) | 0) - ((p / S.w) | 0); out.push(dx === 1 ? "R" : dx === -1 ? "L" : dy === 1 ? "D" : "U"); c = p; }
    return out.reverse();
  }

  // ---------------------------------------------------------------------------------------------------------------- update
  update(dt, input, env) {
    if (this.timers.length) { for (let i = this.timers.length - 1; i >= 0; i--) { const tm = this.timers[i]; tm[0] -= dt; if (tm[0] <= 0) { this.timers.splice(i, 1); tm[1](); } } }
    this.t += dt; if (this.state === "play" && this.moved) this.time += dt;
    this.fx.update && this.fx.update(dt); this.fl.update && this.fl.update(dt);
    if (this.anim < this.animDur) this.anim += dt;
    if (this.bumpT > 0) this.bumpT -= dt;
    this.stateT += dt;
    if (this.state === "winning") { if (this.stateT > 1.0 && !this.done) this.finishWin(); return; }
    if (this.state !== "play" || this.demo) return;
    this.handleInput(input);
  }

  handleInput(input) {
    const p = input.pointer, hit = (r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    if (input.pressed("restart")) { this.restart(); return; }
    if (input.keyPressed("KeyU") || input.keyPressed("Backspace") || input.pressed("alt")) { this.undo(); return; }
    let any = false;
    for (const [a, code] of KEYS) if (input.pressed(a)) { this.queue = code; this.holdA = a; this.holdT = 0; any = true; }
    if (this.holdA) {
      if (input.held(this.holdA)) { this.holdT += 1 / 60; if (this.holdT > 0.22 && !this.queue) this.queue = KEYS.find((k) => k[0] === this.holdA)[1]; } else this.holdA = null;
    }
    if (p.pressed) {
      if (hit(this.btn.undo)) { this.undo(); return; }
      if (hit(this.btn.restart)) { this.restart(); return; }
      const cx = Math.floor((p.x - this.bx) / this.cs), cy = Math.floor((p.y - this.by) / this.cs);
      if (cx >= 0 && cy >= 0 && cx < this.w && cy < this.h) {
        const path = this.pathTo(cx, cy); if (path.length) { this.auto = path; this.queue = null; any = true; }
      }
    }
    if (any && this.queue) this.auto = [];
    if (this.anim >= this.animDur * 0.9) {
      let code = this.queue; this.queue = null;
      if (!code && this.auto.length) code = this.auto.shift();
      if (code && !this.apply(code)) this.auto = [];
    }
  }

  // ---------------------------------------------------------------------------------------------------------------- drawing
  draw(g, env) {
    const S = this.S, cs = this.cs, look = this.look, t = this.t, W = this.w, bw = W * cs, bh = this.h * cs;
    if (this.bd) this.bd.draw(g, 0, 0, t, 960, 540, {});
    if (!this.bare) { g.fillStyle = "rgba(10,5,32,.38)"; g.fillRect(0, 0, 960, 540); }
    g.save();
    fillRR(g, this.bx - 8, this.by - 6, bw + 16, bh + 18, 16, "rgba(10,5,32,.72)", "rgba(220,200,160,.38)", 2);
    g.save(); g.beginPath(); g.rect(this.bx, this.by, bw, bh); g.clip();
    for (let y = 0; y < this.h; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, tl = S.tile[i], px = this.bx + x * cs, py = this.by + y * cs;
      if (tl === WALL) { g.drawImage(A.floorTile(look, cs, (x + y) & 1), px, py, cs, cs); continue; }
      if (tl === ICE) g.drawImage(A.iceTile(look, cs, (x + y) & 1), px, py, cs, cs); else g.drawImage(A.floorTile(look, cs, (x + y) & 1), px, py, cs, cs);
      if (tl === HOLE || this.holeGhost === i) g.drawImage(A.holeTile(cs), px, py, cs, cs);
    }
    g.restore();
    // pads
    for (const gi of S.goals) A.drawPad(g, this.X(gi), this.Y(gi), cs, look, t, S.crates.includes(gi));
    // walls (row by row so the lip sits right)
    for (let y = 0; y < this.h; y++) for (let x = 0; x < W; x++) if (S.tile[y * W + x] === WALL) g.drawImage(A.wallTile(look, cs, (x * 7 + y * 3) | 0), this.bx + x * cs, this.by + y * cs, cs, cs);
    // crates (the pushed one glides along its path)
    const e = clamp(this.anim / this.animDur, 0, 1), mv = this.mv && this.anim < this.animDur ? this.mv : null;
    const skip = mv ? mv.to : -1;
    const cr = S.crates.map((c) => ({ c, x: this.X(c), y: this.Y(c) }));
    if (mv) {
      const pathLen = mv.path.length, f = ease.outCubic ? e : e, u = clamp(f, 0, 1) * (pathLen - 1), k = Math.min(pathLen - 2, Math.floor(u)), r = u - k;
      const a = mv.path[Math.max(0, k)], b = mv.path[Math.min(pathLen - 1, k + 1)];
      const mx = lerp(this.X(a), this.X(b), r), my = lerp(this.Y(a), this.Y(b), r);
      if (!mv.falls) { const idx = cr.findIndex((o) => o.c === skip); if (idx >= 0) { cr[idx].x = mx; cr[idx].y = my; } }
      else cr.push({ c: -1, x: mx, y: my, fall: e > 0.7 ? (e - 0.7) / 0.3 : 0 });
    }
    cr.sort((p, q) => p.y - q.y);
    for (const o of cr) {
      if (o.fall) { g.save(); g.globalAlpha = 1 - o.fall; g.translate(o.x + cs / 2, o.y + cs / 2); g.scale(1 - o.fall * 0.5, 1 - o.fall * 0.5); g.translate(-cs / 2 - o.x, -cs / 2 - o.y); A.drawCrate(g, o.x, o.y, cs, look, false, t); g.restore(); continue; }
      A.drawCrate(g, o.x, o.y, cs, look, S.goals.includes(o.c) && !(mv && o.c === skip && false), t);
    }
    // the courier
    const ep = ease.outCubic(e), fx = this.heroFrom % W, fy = (this.heroFrom / W) | 0, tx = S.hero % W, ty = (S.hero / W) | 0;
    const hx = this.bx + lerp(fx, tx, ep) * cs + cs / 2, hy = this.by + lerp(fy, ty, ep) * cs + cs / 2;
    let bx = 0, by = 0;
    if (this.bumpT > 0 && this.bumpDir) { const kk = Math.sin((this.bumpT / 0.16) * Math.PI) * cs * 0.1, d = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] }[this.bumpDir]; bx = d[0] * kk; by = d[1] * kk; }
    A.drawCourier(g, hx + bx, hy + by - cs * 0.05, cs, this.heroDir, t, this.anim < this.animDur ? e : 0, mv ? 1 : 0);
    this.fx.draw && this.fx.draw(g); this.fl.draw && this.fl.draw(g);
    g.restore();
    if (this.bare) return;
    this.drawHud(g);
  }

  drawHud(g) {
    const S = this.S, lv = this.lv;
    g.fillStyle = "rgba(10,5,32,.62)"; g.fillRect(0, 0, 960, 60); g.fillStyle = "rgba(220,200,160,.28)"; g.fillRect(0, 59, 960, 1.5);
    text(g, `${lv.id}  ${lv.name}`, 20, 28, { size: 20, color: "#fff", font: FONT_DISPLAY, weight: 800 });
    text(g, `Push every crate onto a pad`, 20, 47, { size: 11.5, color: "#d8c9a6", font: FONT_BODY, weight: 600 });
    hudChip(g, 300, 13, "PADS", `${this.padsDone}/${S.goals.length}`, this.padsDone >= S.goals.length ? "#7dffb0" : "#ffe27a", 100);
    hudChip(g, 408, 13, "MOVES", `${S.moves}`, "#bfe9ff", 100);
    hudChip(g, 516, 13, "PUSHES", `${S.pushes}`, "#ffc233", 100);
    hudChip(g, 624, 13, "PAR", `${lv.par}`, "#c3bbea", 74);
    this.button(g, this.btn.undo, "Undo", this.hist.length > 0);
    this.button(g, this.btn.restart, "Restart", true);
    if (this.hintLines.length && (!this.moved || this.t < 14)) this.hintLines.forEach((ln, i) => text(g, ln, 480, 526 - (this.hintLines.length - 1 - i) * 16, { size: 12.5, color: "#f1e7cf", align: "center", font: FONT_BODY, weight: 600, stroke: "#150a33", strokeW: 4 }));
    else if (this.moved && this.state === "play" && this.hist.length > 3) text(g, "Stuck? Undo (U) or restart (R) is always free.", 480, 526, { size: 12, color: "#d8c9a6", align: "center", font: FONT_BODY, weight: 600, stroke: "#150a33", strokeW: 4 });
  }

  button(g, r, label, on) {
    g.save(); g.globalAlpha = on ? 1 : 0.45; fillRR(g, r.x, r.y, r.w, r.h, 12, "rgba(14,6,36,.7)", "rgba(220,200,160,.45)", 1.5);
    text(g, label, r.x + r.w / 2, r.y + 24, { size: 14.5, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 700 }); g.restore();
  }
}
