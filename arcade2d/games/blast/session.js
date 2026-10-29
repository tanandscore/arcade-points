// Blast Grid: one play-through of one level. The rules live in rules.js; this class turns every turn into a short film (steps, fuses, fire,
// crates flying apart), reads the keyboard / touch buttons / mouse, keeps the undo history and draws the board and the top bar.
// Like the other games it also runs "headless" (no drawing) so tests can play whole levels through the same code the player uses.
import { parseMap, cloneState, step, blastCells, botsAlive, doorOpen, stars as starsOf, scoreOf, FLOOR, CRATE, WALL } from "./rules";
import * as A from "./art";
import { WORLDS } from "./levels";
import { clamp, lerp, TAU, fmt, ease } from "../../core/util";
import { Particles, FX, Floaters } from "../../core/fx";
import { Backdrop } from "../../core/backdrop";
import { text, wrapText, fillRR, circle, star, glow, hudChip, makeCanvas, OUT, FONT_DISPLAY, FONT_PIXEL, FONT_BODY } from "../../core/draw";
import { sfx as realSfx } from "../../core/audio";

const NOOP = new Proxy({}, { get: () => () => {} });
export const NO_INPUT = { pointer: { x: -99, y: -99, down: false, pressed: false, released: false, inside: false, type: "mouse" }, pressed: () => false, held: () => false, released: () => false, keyPressed: () => false, axis: () => 0 };

const DUR = 0.15;                 // how long one turn takes to play out
const DIRK = { U: 0, R: 1, D: 2, L: 3 };
const KEYS = [["left", "L"], ["right", "R"], ["up", "U"], ["down", "D"]];
const BD = new Map();
const backdropFor = (theme, seed) => { let b = BD.get(theme); if (!b) { b = new Backdrop(theme, seed); BD.set(theme, b); } return b; };

export class BlastSession {
  constructor(lv, ctx = {}, opts = {}) {
    this.lv = lv; this.ctx = ctx; this.headless = !!opts.headless; this.quiet = this.headless || !!opts.quiet; this.bare = !!opts.bare; this.demo = !!opts.demo;
    this.sfx = this.quiet ? NOOP : realSfx;
    this.world = WORLDS[lv.wi]; this.look = A.LOOKS[lv.wi % 4]; this.accent = ctx.accent || "#ff5a5a";
    this.S = parseMap(lv); this.w = this.S.w; this.h = this.S.h;
    this.cs = opts.cs || Math.max(30, Math.min(Math.floor(436 / this.h), Math.floor(920 / this.w)));
    const cx = opts.cx ?? 480, cy = opts.cy ?? 288;
    this.bx = Math.round(cx - (this.w * this.cs) / 2); this.by = Math.round(cy - (this.h * this.cs) / 2);
    this.t = 0; this.time = 0; this.done = null; this.state = "play"; this.stateT = 0; this.anim = DUR; this.queue = null; this.auto = []; this.holdA = null; this.holdT = 0;
    this.hist = []; this.undos = 0; this.heroDir = 2; this.heroFrom = { x: this.S.player.x, y: this.S.player.y }; this.bPrev = this.S.bots.map((b) => ({ x: b.x, y: b.y }));
    this.flames = []; this.ghosts = []; this.rings = []; this.shk = { t: 0, mag: 0 }; this.bumpT = 0; this.bumpDir = null; this.openWas = false; this.deadAt = 0; this.winAt = 0; this.moved = false;
    const rec = ctx.save && ctx.save.levels ? ctx.save.levels[lv.id] : null; this.firstTime = !(rec && (rec.stars > 0 || rec.best > 0));
    this.goalText = this.makeGoalText(); this.hintLines = [];
    this.btn = { undo: { x: 706, y: 12, w: 86, h: 36 }, restart: { x: 800, y: 12, w: 92, h: 36 } };
    this.autoOK = true;
    if (this.headless) { this.fx = NOOP; this.fl = NOOP; return; }
    this.fx = new Particles(700); this.fl = new Floaters();
    this.bd = this.bare ? null : backdropFor(this.world.theme, (lv.wi + 1) * 7 + 3);
    if (lv.hint && this.firstTime) this.hintLines = wrapText(makeCanvas(4, 4).getContext("2d"), lv.hint, 780, 13, FONT_BODY, 500).slice(0, 2);
  }

  makeGoalText() {
    const S = this.S, bits = [];
    if (S.botsTotal) bits.push(`Blast ${S.botsTotal === 1 ? "the bot" : `all ${S.botsTotal} bots`}`);
    if (S.gemsTotal) bits.push(`grab ${S.gemsTotal === 1 ? "the gem" : `all ${S.gemsTotal} gems`}`);
    const door = S.tile[S.exit] === CRATE ? "find the hidden door" : "reach the door";
    const t = bits.length ? `${bits.join(", ")}, then ${door}` : "Reach the door";
    return t[0].toUpperCase() + t.slice(1);
  }

  // ---------------------------------------------------------------------------------------------------------------- actions
  // one turn. Returns false when the move is not allowed (a wall, a bomb in the way, no bombs left...).
  apply(code) {
    if (this.state !== "play") return false;
    const before = cloneState(this.S), S = this.S, pos = S.bots.map((b) => ({ x: b.x, y: b.y }));
    const ok = step(S, code);
    if (!ok) { const e = S.ev; this.S = before; this.S.ev = null; if (e && e.bump) { this.bumpT = 0.18; this.bumpDir = code; this.sfx.bump(); } else if (code === "B") this.sfx.empty(); return false; }
    this.hist.push(before); if (this.hist.length > 400) this.hist.shift();
    this.moved = true; const ev = S.ev;
    this.heroFrom = ev.from; if (DIRK[code] != null) this.heroDir = DIRK[code];
    this.bPrev = pos; this.anim = 0;
    this.playEvents(ev, S);
    return true;
  }

  playEvents(ev, S) {
    const cs = this.cs, X = (x) => this.bx + x * cs + cs / 2, Y = (y) => this.by + y * cs + cs / 2, look = this.look;
    if (ev.act === "B") { this.sfx.place(); }
    else if (ev.act !== "W") this.sfx.step(); else this.sfx.tick();
    if (S.bombs.length && !ev.blasts.length) this.sfx.fuse();
    for (const [gx, gy] of ev.gems) { this.sfx.gem(); this.score(gx, gy, "+200", "#ffe27a"); for (let i = 0; i < 5; i++) FX.sparkle(this.fx, X(gx) + (Math.random() - 0.5) * 20, Y(gy) + (Math.random() - 0.5) * 20); }
    const delay = DUR * 0.75;
    if (ev.blasts.length) {
      // keep the bombs, and anything that dies, on screen until the fire arrives
      for (const b of ev.blasts) this.ghosts.push({ k: "bomb", x: b.x, y: b.y, until: delay });
      for (const b of ev.kills) this.ghosts.push({ k: "bot", t: b.t, d: b.d, x: b.x, y: b.y, until: delay, px: this.bPrev[S.bots.indexOf(b)] });
      const seen = new Set();
      for (const b of ev.blasts) for (const [cx, cy] of b.cells) { const id = cy * S.w + cx; if (seen.has(id)) continue; seen.add(id); this.flames.push({ x: cx, y: cy, t: -delay - Math.random() * 0.06 - (Math.abs(cx - b.x) + Math.abs(cy - b.y)) * 0.025, dur: 0.5, seed: Math.random() * 9 }); }
      this.later(delay, () => {
        this.sfx.explode(); this.shk = { t: 0.3, mag: 6 + ev.blasts.length * 1.5 };
        for (const b of ev.blasts) { FX.explosion(this.fx, X(b.x), Y(b.y), 0.7); this.rings.push({ x: X(b.x), y: Y(b.y), t: 0 }); }
        for (const [cx, cy, gem, ex] of ev.broken) { this.sfx.breakblock(); FX.debris(this.fx, X(cx), Y(cy), [look.crate, look.band, "#f6cf8a"], 10, 0.9); if (gem) this.fl.add(X(cx), Y(cy) - 8, "gem!", "#ffe27a", 14); if (ex) this.fl.add(X(cx), Y(cy) - 8, "door!", "#8dffc2", 15); }
        for (const b of ev.kills) { this.sfx.kill(); FX.pop(this.fx, X(b.x), Y(b.y), b.t === "p" ? "#ff5d5d" : b.t === "h" ? "#c06bff" : "#c9cde0", 14); this.score(b.x, b.y, "+150", "#ff9aa8"); }
      });
    }
    const open = doorOpen(S);
    if (open && !this.openWas && S.botsTotal > 0) { this.later(delay + 0.1, () => { this.sfx.door(); this.fl.add(X(S.exit % S.w), Y((S.exit / S.w) | 0) - 14, "Door open!", "#8dffc2", 18); FX.pop(this.fx, X(S.exit % S.w), Y((S.exit / S.w) | 0), "#8dffc2", 10); }); }
    this.openWas = open;
    if (ev.dead) { this.state = "dying"; this.stateT = 0; this.sfx.die && this.later(ev.blasts.length ? delay : 0.05, () => { this.sfx.die(); }); }
    if (!ev.dead && !ev.win && S.status === "play" && S.supply === 0 && !S.bombs.length && !doorOpen(S) && (botsAlive(S) > 0 || S.tile[S.exit] === CRATE)) { this.stuck = true; this.state = "dying"; this.stateT = 0.4; this.sfx.lose && this.later(0.3, () => this.sfx.lose()); } else this.stuck = false;
    if (ev.win) { this.state = "winning"; this.stateT = 0; this.later(DUR, () => { this.sfx.star(); FX.confetti(this.fx, X(S.player.x), Y(S.player.y), 50); }); }
  }

  later(t, fn) { (this.timers ||= []).push([t, fn]); if (this.headless) this.timers.pop(); }
  score(gx, gy, str, color) { this.fl.add(this.bx + gx * this.cs + this.cs / 2, this.by + gy * this.cs + this.cs * 0.2, str, color, 16); }

  undo() {
    if (!this.hist.length || (this.state !== "play" && this.state !== "dead")) { this.sfx.empty(); return false; }
    this.S = this.hist.pop(); this.state = "play"; this.stuck = false; this.anim = DUR; this.heroFrom = { x: this.S.player.x, y: this.S.player.y }; this.bPrev = this.S.bots.map((b) => ({ x: b.x, y: b.y }));
    this.flames.length = 0; this.ghosts.length = 0; this.queue = null; this.auto = []; this.undos++; this.openWas = doorOpen(this.S); this.sfx.back(); return true;
  }
  restart() {
    this.S = parseMap(this.lv); this.hist = []; this.state = "play"; this.stuck = false; this.anim = DUR; this.heroFrom = { x: this.S.player.x, y: this.S.player.y }; this.bPrev = this.S.bots.map((b) => ({ x: b.x, y: b.y }));
    this.flames.length = 0; this.ghosts.length = 0; this.queue = null; this.auto = []; this.openWas = false; this.sfx.click(); this.timers = [];
  }

  finishWin() {
    const S = this.S, lv = this.lv, st = starsOf(S, lv), score = scoreOf(S, lv);
    this.done = {
      won: true, score, stars: st, time: Math.round(this.time), title: st === 3 ? "PERFECT BLAST!" : st === 2 ? "NICE BLASTING!" : "DOOR REACHED!", sub: lv.name, delay: 1.1,
      lines: [["Bombs used", `${S.bombsUsed} (3 stars at ${lv.par} or fewer)`], ["Gems", `${S.gemsGot} / ${S.gemsTotal}`], ["Bots blasted", `${S.killed} / ${S.botsTotal}`], ["Turns", S.turn], ...(this.undos ? [["Undos", this.undos]] : [])],
    };
  }

  // a path of single steps from the hero to a tapped square (walks through empty floor only)
  pathTo(tx, ty) {
    const S = this.S, N = S.w * S.h, prev = new Int16Array(N).fill(-2), q = [S.player.y * S.w + S.player.x]; prev[q[0]] = -1;
    const goal = ty * S.w + tx;
    for (let i = 0; i < q.length && prev[goal] === -2; i++) {
      const c = q[i], cx = c % S.w, cy = (c / S.w) | 0;
      for (const [dx, dy, a] of [[1, 0, "R"], [-1, 0, "L"], [0, 1, "D"], [0, -1, "U"]]) {
        const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= S.w || ny >= S.h) continue;
        const n = ny * S.w + nx; if (prev[n] !== -2 || S.tile[n] !== FLOOR || S.bombs.some((b) => b.x === nx && b.y === ny)) continue;
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
    if (this.timers && this.timers.length) { for (let i = this.timers.length - 1; i >= 0; i--) { const tm = this.timers[i]; tm[0] -= dt; if (tm[0] <= 0) { this.timers.splice(i, 1); tm[1](); } } }
    this.t += dt; if (this.state === "play" && this.moved) this.time += dt;
    this.fx.update && this.fx.update(dt); this.fl.update && this.fl.update(dt);
    if (this.anim < DUR) this.anim += dt;
    if (this.bumpT > 0) this.bumpT -= dt;
    if (this.shk.t > 0) this.shk.t -= dt;
    for (let i = this.flames.length - 1; i >= 0; i--) { const f = this.flames[i]; f.t += dt; if (f.t > f.dur) this.flames.splice(i, 1); }
    for (let i = this.ghosts.length - 1; i >= 0; i--) { const g = this.ghosts[i]; g.until -= dt; if (g.until <= 0) this.ghosts.splice(i, 1); }
    for (let i = this.rings.length - 1; i >= 0; i--) { this.rings[i].t += dt; if (this.rings[i].t > 0.5) this.rings.splice(i, 1); }
    this.stateT += dt;
    if (this.state === "winning") { if (this.stateT > 0.95 && !this.done) this.finishWin(); return; }
    if (this.state === "dying") { if (this.stateT > 0.7) { this.state = "dead"; this.stateT = 0; } }
    if (this.state === "dead") { this.handleButtons(input); return; }
    if (this.state !== "play") return;
    if (this.demo) return;
    this.handleInput(input);
  }

  handleButtons(input) {
    const p = input.pointer;
    if (p.pressed) {
      const hit = (r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
      if (hit(this.btn.undo)) this.undo(); else if (hit(this.btn.restart)) this.restart();
      else if (this.state === "dead" && p.x > 330 && p.x < 480 && p.y > 300 && p.y < 360) this.undo();
      else if (this.state === "dead" && p.x >= 490 && p.x < 650 && p.y > 300 && p.y < 360) this.restart();
    }
    if (input.pressed("restart")) this.restart();
    if (input.keyPressed("KeyU") || input.keyPressed("Backspace") || input.pressed("alt")) this.undo();
  }

  handleInput(input) {
    const p = input.pointer, hit = (r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    if (input.pressed("restart")) { this.restart(); return; }
    if (input.keyPressed("KeyU") || input.keyPressed("Backspace") || input.pressed("alt")) { this.undo(); return; }
    let pressedAny = false;
    for (const [a, code] of KEYS) if (input.pressed(a)) { this.queue = code; this.holdA = a; this.holdT = 0; pressedAny = true; }
    if (input.pressed("jump")) { this.queue = "B"; pressedAny = true; }
    if (input.pressed("fire")) { this.queue = "W"; pressedAny = true; }
    if (this.holdA) {
      if (input.held(this.holdA)) { this.holdT += 1 / 60; if (this.holdT > 0.2 && !this.queue) this.queue = KEYS.find((k) => k[0] === this.holdA)[1]; } else this.holdA = null;
    }
    if (p.pressed) {
      if (hit(this.btn.undo)) { this.undo(); return; }
      if (hit(this.btn.restart)) { this.restart(); return; }
      const cx = Math.floor((p.x - this.bx) / this.cs), cy = Math.floor((p.y - this.by) / this.cs);
      if (cx >= 0 && cy >= 0 && cx < this.w && cy < this.h) {
        const S = this.S;
        if (cx === S.player.x && cy === S.player.y) { this.queue = "B"; this.auto = []; }
        else { const path = this.pathTo(cx, cy); if (path.length) { this.auto = path; this.queue = null; } }
        pressedAny = true;
      }
    }
    if (pressedAny && this.queue) this.auto = [];
    if (this.anim >= DUR * 0.88) {
      let code = this.queue; this.queue = null;
      if (!code && this.auto.length) {
        // stop the automatic walk when a bot gets close
        const S = this.S, near = S.bots.some((b) => b.alive && Math.abs(b.x - S.player.x) + Math.abs(b.y - S.player.y) <= 3);
        if (near) this.auto = []; else code = this.auto.shift();
      }
      if (code && !this.apply(code)) this.auto = [];
    }
  }

  // ---------------------------------------------------------------------------------------------------------------- drawing
  cellX(x) { return this.bx + x * this.cs; }
  cellY(y) { return this.by + y * this.cs; }

  draw(g, env) {
    const S = this.S, cs = this.cs, look = this.look, t = this.t;
    if (this.bd) this.bd.draw(g, 0, 0, t, 960, 540, {}); else { g.fillStyle = "rgba(0,0,0,0)"; }
    if (!this.bare) { g.fillStyle = "rgba(10,5,32,.40)"; g.fillRect(0, 0, 960, 540); }
    g.save();
    if (this.shk.t > 0) g.translate((Math.random() - 0.5) * this.shk.mag * (this.shk.t / 0.3), (Math.random() - 0.5) * this.shk.mag * (this.shk.t / 0.3));
    // board backing
    const bw = this.w * cs, bh = this.h * cs;
    fillRR(g, this.bx - 8, this.by - 6, bw + 16, bh + 18, 16, "rgba(10,5,32,.7)", "rgba(190,180,255,.35)", 2);
    g.save(); g.beginPath(); g.rect(this.bx, this.by, bw, bh); g.clip();
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) g.drawImage(A.floorTile(look, cs, (x + y) & 1), this.cellX(x), this.cellY(y), cs, cs);
    g.restore();
    // danger squares: where bombs are about to burn
    const danger = new Map();
    for (const b of S.bombs) for (const [cx, cy] of blastCells(S, b.x, b.y).cells) { const id = cy * S.w + cx, v = danger.get(id) || 9; danger.set(id, Math.min(v, b.f)); }
    for (const [id, f] of danger) {
      const x = id % S.w, y = (id / S.w) | 0, a = (f <= 1 ? 0.5 : f === 2 ? 0.36 : 0.26) * (0.75 + 0.25 * Math.sin(t * (f <= 1 ? 16 : 8)));
      g.fillStyle = `rgba(255,70,60,${a})`; g.fillRect(this.cellX(x) + 2, this.cellY(y) + 2, cs - 4, cs - 4);
      g.strokeStyle = `rgba(255,150,120,${a + 0.15})`; g.lineWidth = 1.5; g.strokeRect(this.cellX(x) + 3, this.cellY(y) + 3, cs - 6, cs - 6);
    }
    // gems and the door lie on the floor
    const ex = S.exit >= 0 ? S.exit % S.w : -1, ey = S.exit >= 0 ? (S.exit / S.w) | 0 : -1;
    if (S.exit >= 0 && S.tile[S.exit] !== CRATE) A.drawDoor(g, this.cellX(ex), this.cellY(ey), cs, doorOpen(S), t);
    for (let i = 0; i < S.gem.length; i++) if (S.gem[i] && S.tile[i] !== CRATE) A.drawGem(g, this.cellX(i % S.w) + cs / 2, this.cellY((i / S.w) | 0) + cs / 2, cs, t, i);
    // walls and crates, row by row so the lip of one wall can sit under the next row
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const i = y * S.w + x, tl = S.tile[i];
      if (tl === WALL) g.drawImage(A.wallTile(look, cs, (x * 7 + y * 3) | 0), this.cellX(x), this.cellY(y), cs, cs);
      else if (tl === CRATE) { const gemIn = S.gem[i] === 1; g.drawImage(A.crateTile(look, cs, gemIn), this.cellX(x), this.cellY(y), cs, cs); }
    }
    // bombs
    for (const b of S.bombs) { const cx = this.cellX(b.x) + cs / 2, cy = this.cellY(b.y) + cs / 2; A.drawBomb(g, cx, cy, cs, b.f, t); A.fuseNumber(g, cx, cy, cs, b.f); }
    for (const gh of this.ghosts) if (gh.k === "bomb" && !S.bombs.some((b) => b.x === gh.x && b.y === gh.y)) { const cx = this.cellX(gh.x) + cs / 2, cy = this.cellY(gh.y) + cs / 2; A.drawBomb(g, cx, cy, cs, 1, t); A.fuseNumber(g, cx, cy, cs, 0); }
    // bots (the ones that are about to die stay until the fire arrives)
    const e = ease.outCubic(clamp(this.anim / DUR, 0, 1));
    const ordered = [];
    S.bots.forEach((b, i) => { if (b.alive) ordered.push({ t: b.t, d: b.d, x: lerp(this.bPrev[i] ? this.bPrev[i].x : b.x, b.x, e), y: lerp(this.bPrev[i] ? this.bPrev[i].y : b.y, b.y, e), i }); });
    for (const gh of this.ghosts) if (gh.k === "bot") { const pp = gh.px || gh; ordered.push({ t: gh.t, d: gh.d, x: lerp(pp.x, gh.x, e), y: lerp(pp.y, gh.y, e), i: 99, ghost: true }); }
    ordered.sort((a, b) => a.y - b.y);
    for (const b of ordered) A.drawBot(g, this.cellX(b.x) + cs / 2, this.cellY(b.y) + cs / 2 - cs * 0.02, cs, b.t, b.d, t, b.i * 1.7);
    // the hero
    const px = lerp(this.heroFrom.x, S.player.x, e), py = lerp(this.heroFrom.y, S.player.y, e);
    let hx = this.cellX(px) + cs / 2, hy = this.cellY(py) + cs / 2 - cs * 0.02;
    if (this.bumpT > 0 && this.bumpDir) { const k = Math.sin((this.bumpT / 0.18) * Math.PI) * cs * 0.12, d = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] }[this.bumpDir]; if (d) { hx += d[0] * k; hy += d[1] * k; } }
    if (this.state === "dying" || this.state === "dead") { if (this.stuck) A.drawHero(g, hx, hy, cs, this.heroDir, t, { dead: this.state === "dead" ? 0.8 : 0 }); else if (this.stateT > (this.S.ev && this.S.ev.blasts.length ? 0.15 : 0) || this.state === "dead") A.drawHero(g, hx, hy, cs, this.heroDir, t, { dead: this.state === "dead" ? 1.6 : clamp(this.stateT / 0.5, 0, 1.6) }); else A.drawHero(g, hx, hy, cs, this.heroDir, t); }
    else A.drawHero(g, hx, hy, cs, this.heroDir, t, { walk: this.anim < DUR ? this.anim / DUR : 0 });
    // fire
    for (const f of this.flames) if (f.t >= 0) A.drawFlame(g, this.cellX(f.x), this.cellY(f.y), cs, 1 - f.t / f.dur, t, f.seed);
    for (const r of this.rings) { g.globalAlpha = 1 - r.t * 2; g.strokeStyle = "#fff3b0"; g.lineWidth = 4; g.beginPath(); g.arc(r.x, r.y, cs * (0.3 + r.t * 2.2), 0, TAU); g.stroke(); g.globalAlpha = 1; }
    this.fx.draw && this.fx.draw(g); this.fl.draw && this.fl.draw(g);
    g.restore();
    if (this.bare) return;
    this.drawHud(g);
    if (this.state === "dead" || (this.state === "dying" && this.stateT > 0.35)) this.drawDead(g);
  }

  drawHud(g) {
    const S = this.S, lv = this.lv;
    g.fillStyle = "rgba(10,5,32,.62)"; g.fillRect(0, 0, 960, 60); g.fillStyle = "rgba(190,180,255,.25)"; g.fillRect(0, 59, 960, 1.5);
    text(g, `${lv.id}  ${lv.name}`, 20, 28, { size: 20, color: "#fff", font: FONT_DISPLAY, weight: 800 });
    text(g, `Blast reach ${S.range}  ·  ${S.maxBombs} bomb${S.maxBombs > 1 ? "s" : ""} at a time`, 20, 47, { size: 11.5, color: "#c3bbea", font: FONT_BODY, weight: 600 });
    hudChip(g, 292, 13, "BOMBS", S.supply, S.supply <= 1 ? "#ff8a7a" : "#ffc233", 112);
    hudChip(g, 412, 13, "GEMS", `${S.gemsGot}/${S.gemsTotal}`, S.gemsGot >= S.gemsTotal ? "#7dffb0" : "#ffe27a", 108);
    hudChip(g, 528, 13, "BOTS", `${botsAlive(S)}`, botsAlive(S) ? "#ff9aa8" : "#7dffb0", 92);
    hudChip(g, 628, 13, "TURNS", `${S.turn}`, "#bfe9ff", 66);
    this.button(g, this.btn.undo, "Undo", this.hist.length > 0);
    this.button(g, this.btn.restart, "Restart", true);
    if (this.hintLines.length && !this.moved || (this.hintLines.length && this.t < 14)) {
      this.hintLines.forEach((ln, i) => text(g, ln, 480, 528 - (this.hintLines.length - 1 - i) * 15 + (this.hintLines.length === 1 ? 0 : 0), { size: 12.5, color: "#e6defc", align: "center", font: FONT_BODY, weight: 600, stroke: "#150a33", strokeW: 3.5 }));
    }
    if (!this.moved && this.state === "play" && !this.demo) {
      const k = Math.min(1, this.t / 0.5), wob = Math.sin(this.t * 3) * 1.5;
      g.save(); g.globalAlpha = k; fillRR(g, 480 - 270, 66 + wob, 540, 30, 15, "rgba(10,5,32,.82)", this.accent, 1.5);
      text(g, this.goalText, 480, 86 + wob, { size: 15, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 700 }); g.restore();
    }
  }

  button(g, r, label, on) {
    g.save(); g.globalAlpha = on ? 1 : 0.45; fillRR(g, r.x, r.y, r.w, r.h, 12, "rgba(14,6,36,.7)", "rgba(190,180,255,.4)", 1.5);
    text(g, label, r.x + r.w / 2, r.y + 24, { size: 14.5, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 700 }); g.restore();
  }

  drawDead(g) {
    const k = this.state === "dead" ? 1 : clamp((this.stateT - 0.35) / 0.3, 0, 1);
    if (this.stuck) { this.stuckDraw = true; }
    g.save(); g.globalAlpha = k;
    g.fillStyle = "rgba(10,5,32,.55)"; g.fillRect(0, 60, 960, 480);
    text(g, this.stuck ? "OUT OF BOMBS" : "BOOM!", 480, 270, { size: 58, color: "#ffc233", align: "center", font: FONT_DISPLAY, weight: 900, stroke: "#150a33", strokeW: 9 });
    this.button(g, { x: 330, y: 300, w: 150, h: 56 }, "Undo move", this.hist.length > 0);
    this.button(g, { x: 490, y: 300, w: 160, h: 56 }, "Restart", true);
    text(g, "Press U to undo or R to restart", 480, 384, { size: 13, color: "#c3bbea", align: "center", font: FONT_BODY, weight: 600 });
    g.restore();
  }
}
