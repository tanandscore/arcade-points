// Gem Garden: one play-through of one level.
// It owns the board (the rules live in board.js), plays every move out as a short film (swap, pop, fall, refill) and draws the side panel
// with moves, goals and stars. The very same class also runs "headless" (no drawing at all) so a test can play whole levels through
// exactly the code the player uses.
import { Board, T } from "./board";
import { WORLDS, GEM_PLURAL, describeGoals } from "./levels";
import * as A from "./art";
import { clamp, lerp, TAU, fmt, ease, shade } from "../../core/util";
import { Particles, FX, Floaters } from "../../core/fx";
import { Backdrop } from "../../core/backdrop";
import { text, textWidth, wrapText, fillRR, circle, line, star, glow, bar, makeCanvas, OUT, FONT_DISPLAY, FONT_PIXEL, FONT_BODY } from "../../core/draw";
import { sfx as realSfx, tone } from "../../core/audio";

const NOOP = new Proxy({}, { get: () => () => {} });
export const NO_INPUT = { pointer: { x: -99, y: -99, down: false, pressed: false, released: false, inside: false, type: "mouse" }, pressed: () => false, held: () => false, released: () => false, keyPressed: () => false, axis: () => 0 };

const G = 52;                 // how fast things fall (cells per second, per second)
const SWAP_T = 0.17;          // how long a swap takes
const GEM_K = 1.2, CRATE_K = 1.12;
const CHAIN_COLORS = ["#fff2a8", "#ffd84a", "#ffb347", "#ff8ad2", "#7df9ff"];
const CHAIN_WORDS = ["", "Sweet!", "Lovely!", "Spectacular!", "Gem-tastic!"];
const SEMIS = [0, 2, 4, 7, 9, 12, 14, 16, 19];   // a happy little scale: every link of a chain sounds one note higher

const BD = new Map(), BACK = new Map();
const backdropFor = (theme, seed) => { let b = BD.get(theme); if (!b) { b = new Backdrop(theme, seed); BD.set(theme, b); } return b; };

export class GemSession {
  constructor(lv, ctx = {}, opts = {}) {
    this.lv = lv; this.ctx = ctx; this.headless = !!opts.headless; this.quiet = this.headless || !!opts.quiet; this.bare = !!opts.bare; this.demo = !!opts.demo;
    this.sfx = this.quiet ? NOOP : realSfx;
    this.board = new Board(lv, opts.seed ?? ((Math.random() * 1e9) | 0));
    const b = this.board, cols = b.cols, rows = b.rows, N = cols * rows;
    this.cols = cols; this.rows = rows; this.cs = Math.min(60, Math.floor(448 / Math.max(cols, rows)));
    const cx = opts.cx ?? (this.bare ? 700 : 612), cy = opts.cy ?? (this.bare ? 282 : 278);
    this.bx = Math.round(cx - (cols * this.cs) / 2); this.by = Math.round(cy - (rows * this.cs) / 2);
    this.world = WORLDS[lv.wi]; this.accent = ctx.accent || "#c06bff";
    this.t = 0; this.time = 0; this.stateT = 0; this.endT = 0; this.done = null; this.state = "idle"; this.introDur = 0;
    this.vis = new Map(); this.queue = []; this.cur = null; this.phaseT = 0; this.phaseDur = 0; this.finaleOn = false; this.timers = [];
    this.hud = b.snap(); this.shownScore = 0; this.movesPop = 0; this.goalDone = []; this.goalPop = [];
    this.sel = null; this.cursor = { x: (cols / 2) | 0, y: (rows / 2) | 0, on: false }; this.drag = null; this.hammerMode = false;
    this.hintMove = null; this.hintT = 0; this.idleT = 0; this.rejectT = 0; this.hammerBtn = { x: 30, y: 450, w: 228, h: 54 }; this.hintLines = [];
    this.ts = 1; this.efx = []; this.bn = null; this.shk = { t: 0, dur: 0.1, mag: 0 }; this.lastCascade = 0; this.spd = 1; this.stats = { bonus: 0, moves: 0, goalsAt: -1 }; this.landed = false;
    const rec = ctx.save && ctx.save.levels ? ctx.save.levels[lv.id] : null;
    this.firstTime = !(rec && (rec.stars > 0 || rec.best > 0));
    this.soilS = new Uint8Array(N); this.soilT = new Float32Array(N);
    for (let i = 0; i < N; i++) if (b.soil[i]) this.soilS[i] = 1;
    this.goalRows().forEach((r, i) => { this.goalDone[i] = false; this.goalPop[i] = 0; });
    if (this.headless) { this.fx = NOOP; this.fl = NOOP; return; }
    this.fx = new Particles(900); this.fl = new Floaters();
    this.hintLines = lv.hint && this.firstTime ? wrapText(makeCanvas(4, 4).getContext("2d"), lv.hint, 218, 12.5, FONT_BODY, 500).slice(0, 3) : [];
    this.layoutPanel();
    this.bd = backdropFor(this.world.theme, (lv.wi + 1) * 10 + 3);
    const key = `${cols}x${rows}x${this.cs}x${Array.from(b.vd).join("")}x${this.accent}`;
    let back = BACK.get(key); if (!back) { back = A.makeBoardBack(makeCanvas, cols, rows, this.cs, b.vd, this.accent); BACK.set(key, back); } this.back = back;
    this.clip = new Path2D();
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) if (!b.vd[y * cols + x]) this.clip.rect(this.bx + x * this.cs, this.by + y * this.cs, this.cs, this.cs);
    this.warm();
    for (let i = 0; i < N; i++) { const q = b.p[i]; if (q) this.addVis(q, i % cols, (i / cols) | 0); }
    this.shownScore = 0;
    if (opts.noIntro) this.state = "idle"; else this.startIntro();
  }

  // draw every picture once up front so the first move does not stutter
  warm() {
    const nc = this.board.lv.colors;
    for (let k = 0; k < nc; k++) for (const t of ["g", "lh", "lv", "bl"]) A.gemSprite(k, t);
    A.acornSprite(); for (const [h, m] of [[1, 1], [1, 2], [2, 2], [1, 3], [2, 3], [3, 3]]) A.crateSprite(h, m);
    for (let n = 0; n < 5; n++) { A.soilTile(this.cs, false, n); A.soilTile(this.cs, true, n); }
  }

  addVis(q, x, y) {
    const v = { id: q.id, t: q.t, k: q.k, hp: q.hp, max: q.max ?? q.hp, x, y, ty: y, vy: 0, fall: false, tw: null, dying: null, born: null, sq: 0, shake: 0, flash: 0, z: 0, ph: (q.id * 0.7) % TAU, spark: 0 };
    this.vis.set(q.id, v); return v;
  }
  startIntro() {
    this.state = "intro"; this.stateT = 0; let tmax = 0;
    for (const v of this.vis.values()) { const off = this.rows + 1 + (this.rows - 1 - v.y) * 0.9 + v.x * 0.15; v.ty = v.y; v.y = v.ty - off; v.vy = 0; v.fall = true; tmax = Math.max(tmax, Math.sqrt((2 * off) / G)); }
    this.introDur = Math.max(1.5, tmax + 0.3);
  }

  // ---------------------------------------------------------------------------------------------------------------- goals and the numbers on the panel
  goalRows() {
    const s = this.hud, b = this.board;
    return this.lv.goals.map((g) => {
      if (g.t === "score") return { icon: "score", label: "Score", have: Math.min(s.score, g.n), need: g.n };
      if (g.t === "gem") return { icon: "gem", c: g.c, label: GEM_PLURAL[g.c], have: Math.min(s.gem[g.c], g.n), need: g.n };
      if (g.t === "soil") return { icon: "soil", label: "Soil in bloom", have: b.soilTotal - s.soil, need: b.soilTotal };
      if (g.t === "crate") return { icon: "crate", label: "Crates broken", have: b.crateTotal - s.crate, need: b.crateTotal };
      return { icon: "seed", label: "Acorns home", have: Math.min(s.seed, g.n), need: g.n };
    });
  }
  applySnap(s) {
    if (!s) return;
    if (s.moves !== this.hud.moves) this.movesPop = 1;
    this.hud = { ...s, gem: s.gem.slice() };
    this.goalRows().forEach((r, i) => {
      if (r.have >= r.need && !this.goalDone[i]) {
        this.goalDone[i] = true; this.goalPop[i] = 1;
        if (!this.headless) {
          this.sfx.star && this.sfx.star();
          if (this.board.scoreOnly && this.lv.goals[i].t === "score" && this.board.moves > 0) this.banner("Goal reached!", "#7dff9a", 44, 1.4, "Keep going for more stars");
        }
      }
    });
  }

  // ---------------------------------------------------------------------------------------------------------------- making a move
  get busy() { return this.state !== "idle"; }

  requestSwap(ax, ay, bx, by) {
    if (this.state !== "idle" || this.done) return false;
    const b = this.board;
    if (!b.canSwap(ax, ay, bx, by)) { this.reject(ax, ay, bx, by); return false; }
    const phases = b.trySwap(ax, ay, bx, by); if (!phases) return false;
    this.sel = null; this.hintMove = null; this.idleT = 0; this.stats.moves++; this.spd = 1; this.ts = 1; this.lastCascade = 0;
    this.begin(phases); return true;
  }
  requestHammer(x, y) {
    if (this.state !== "idle" || this.done) return false;
    const out = this.board.hammer(x, y);
    this.hammerMode = false;
    if (!out) { this.sfx.bump(); return false; }
    this.sel = null; this.hintMove = null; this.idleT = 0; this.spd = 1; this.ts = 1; this.lastCascade = 0;
    this.begin([{ kind: "hammer", x, y }, ...out]); return true;
  }
  begin(phases) {
    this.state = this.finaleOn ? "finale" : "busy"; this.stateT = 0;
    if (this.headless) { for (const ph of phases) this.applyInstant(ph); this.afterQueue(); return; }
    for (const ph of phases) this.queue.push(ph);
  }
  applyInstant(ph) {
    if (ph.kind === "swap") this.hud = { ...this.hud, moves: this.hud.moves - 1 };
    if (ph.snap) this.applySnap(ph.snap); if (ph.kind === "bonusScore") this.stats.bonus += ph.pts;
  }

  // a swap that does nothing: the gems nudge towards each other and hop back
  reject(ax, ay, bx, by) {
    this.sfx.bump && this.sfx.bump(); if (this.headless) return;
    const b = this.board, wob = (q, x0, y0, x1, y1) => {
      const v = q && this.vis.get(q.id); if (!v) return;
      if (q.t === T.CRATE) v.shake = 0.3; else v.tw = { x0, y0, x1: x0 + (x1 - x0) * 0.38, y1: y0 + (y1 - y0) * 0.38, t: 0, dur: 0.22, yoyo: true };
    };
    wob(b.at(ax, ay), ax, ay, bx, by); wob(b.at(bx, by), bx, by, ax, ay); this.rejectT = 0.24; this.sel = null;
  }

  afterQueue() {
    const b = this.board;
    if (this.done) return;
    if (this.finaleOn) { this.finishWin(); return; }
    const st = b.status();
    if (st === "win") { if (!b.scoreOnly && b.moves > 0) { this.startFinale(); return; } this.finishWin(); return; }
    if (st === "lose") { this.finishLose(); return; }
    this.state = "idle"; this.stateT = 0; this.idleT = 0; this.hintMove = null;
  }
  startFinale() {
    const b = this.board, left = b.moves; this.finaleOn = true;
    if (!this.headless) this.banner("Spare moves!", "#ffd84a", 46, 1.5, `${left} left over: fireworks!`);
    this.begin(b.finale());
  }
  finishWin() {
    if (this.done) return;
    const b = this.board, lv = this.lv, score = b.score, [s2, s3] = lv.stars, stars = score >= s3 ? 3 : score >= s2 ? 2 : 1;
    this.state = "won"; this.endT = 0;
    if (!this.headless && !this.demo) { this.banner(stars === 3 ? "Sparkling!" : "Level clear!", "#ffd84a", 58, 1.6); FX.confetti(this.fx, this.bx + (this.cols * this.cs) / 2, this.by + 30, 60); this.shake(5, 0.3); }
    const lines = [["Moves used", `${b.movesUsed} / ${lv.moves}`]];
    if (this.stats.bonus > 0) lines.push(["Spare-move bonus", `+${fmt(this.stats.bonus)}`]);
    lines.push(["Biggest chain", `x${b.cascadeMax + 1}`], ["2 stars at", fmt(s2)], ["3 stars at", fmt(s3)]);
    this.done = { won: true, score, stars, time: Math.round(this.time), title: stars === 3 ? "SPARKLING!" : stars === 2 ? "LOVELY!" : "LEVEL CLEAR!", sub: lv.name, delay: 1.5, lines };
  }
  finishLose() {
    if (this.done) return;
    const b = this.board, lv = this.lv, rows = this.goalRows(), left = rows.filter((r) => r.have < r.need);
    this.state = "lost"; this.endT = 0;
    if (!this.headless && !this.demo) this.banner("Out of moves", "#ff8ab0", 50, 1.4);
    const sub = left.length ? "Still to go: " + left.slice(0, 2).map((r) => (r.icon === "score" ? `${fmt(r.need - r.have)} points` : r.icon === "soil" || r.icon === "crate" ? `${r.need - r.have} ${r.icon === "soil" ? "soil" : "crate"}${r.need - r.have === 1 ? "" : "s"}` : `${r.need - r.have} ${r.label.toLowerCase()}`)).join(" and ") : lv.name;
    this.done = { won: false, score: b.score, stars: 0, time: Math.round(this.time), title: "OUT OF MOVES", sub, delay: 1.3, lines: [["Goals done", `${rows.length - left.length} / ${rows.length}`], ["Score so far", fmt(b.score)], ["Biggest chain", `x${b.cascadeMax + 1}`]] };
  }

  // ---------------------------------------------------------------------------------------------------------------- playing a move out on the screen
  stepPhases(dt) {
    if (this.state !== "busy" && this.state !== "finale") return;
    for (let guard = 0; guard < 8; guard++) {
      if (!this.cur) {
        if (!this.queue.length) { this.afterQueue(); return; }
        this.cur = this.queue.shift(); this.phaseT = 0; this.phaseDur = 0; this.beginPhase(this.cur);
      }
      this.phaseT += dt; dt = 0;
      if (this.phaseT >= this.phaseDur) { this.endPhase(this.cur); this.cur = null; } else return;
    }
  }
  cellPx(x, y) { return { x: this.bx + (x + 0.5) * this.cs, y: this.by + (y + 0.5) * this.cs }; }
  after(delay, fn) { if (!this.headless) this.timers.push({ at: this.t + delay, fn }); }
  chime(n) {
    if (this.quiet) return; const f = 523.25 * Math.pow(2, SEMIS[Math.min(n, SEMIS.length - 1)] / 12);
    tone({ type: "triangle", f0: f, dur: 0.22, vol: 0.12 }); tone({ type: "sine", f0: f * 2, dur: 0.16, vol: 0.05, delay: 0.04 });
  }
  shake(mag, dur = 0.25) { if (mag >= this.shk.mag * (this.shk.t / this.shk.dur || 0)) this.shk = { t: dur, dur, mag }; }
  banner(textStr, color = "#ffd84a", size = 54, dur = 1.1, sub = null) { this.bn = { text: textStr, color, size, t: 0, dur, sub }; }

  beginPhase(ph) {
    const b = this.board, cs = this.cs, cols = this.cols;
    switch (ph.kind) {
      case "hammer": {
        this.efx.push({ k: "hammer", x: ph.x, y: ph.y, t: 0, delay: 0, dur: 0.34 }); this.phaseDur = 0.3; this.sfx.whoosh();
        this.after(0.2, () => { this.sfx.impact(); this.shake(4, 0.18); const c = this.cellPx(ph.x, ph.y); FX.sparks(this.fx, c.x, c.y, 10, "#fff6c4"); });
        break;
      }
      case "swap": {
        const va = this.vis.get(ph.ida), vb = this.vis.get(ph.idb);
        if (va) { va.tw = { x0: ph.ax, y0: ph.ay, x1: ph.bx, y1: ph.by, t: 0, dur: SWAP_T }; va.z = 2; }
        if (vb) { vb.tw = { x0: ph.bx, y0: ph.by, x1: ph.ax, y1: ph.ay, t: 0, dur: SWAP_T }; vb.z = 1; }
        this.hud = { ...this.hud, moves: this.hud.moves - 1 }; this.movesPop = 1;
        this.phaseDur = SWAP_T + 0.02; this.sfx.swap(); this.sel = null; break;
      }
      case "clear": {
        const cells = ph.cells, eff = ph.effects, delays = [];
        let maxDelay = 0;
        for (const c of cells) {
          let d = Infinity;
          for (const e of eff) {
            if (e.t === "row" && c.y === e.y) d = Math.min(d, 0.05 + Math.abs(c.x - e.x) * 0.032);
            else if (e.t === "col" && c.x === e.x) d = Math.min(d, 0.05 + Math.abs(c.y - e.y) * 0.032);
            else if (e.t === "cross") { const w = e.w || 1; if (Math.abs(c.y - e.y) < w) d = Math.min(d, 0.05 + Math.abs(c.x - e.x) * 0.032); if (Math.abs(c.x - e.x) < w) d = Math.min(d, 0.05 + Math.abs(c.y - e.y) * 0.032); }
            else if (e.t === "blast") { const r = Math.max(Math.abs(c.x - e.x), Math.abs(c.y - e.y)); if (r <= e.r) d = Math.min(d, 0.05 + r * 0.05); }
            else if (e.t === "prism") { if (e.targets.includes(c.y * cols + c.x)) d = Math.min(d, 0.24); }
            else if (e.t === "storm") d = Math.min(d, 0.1 + Math.hypot(c.x - e.x, c.y - e.y) * 0.035);
          }
          const dl = d === Infinity ? 0 : d; delays.push(dl); if (dl > maxDelay) maxDelay = dl;
        }
        // gems that make a special gem slide into the spot where it appears
        const merge = new Map(), at = new Map(cells.map((c) => [c.y * cols + c.x, c]));
        for (const sp of ph.spawns) {
          const seen = new Set([sp.y * cols + sp.x]), qd = [[sp.x, sp.y, 0]];
          while (qd.length) {
            const [x, y, dd] = qd.shift(); if (dd >= 4) continue;
            for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const nx = x + dx, ny = y + dy, i = ny * cols + nx; if (nx < 0 || ny < 0 || nx >= cols || ny >= this.rows || seen.has(i)) continue;
              const c = at.get(i); if (c && c.k === sp.k) { seen.add(i); merge.set(c.id, { x: sp.x, y: sp.y }); qd.push([nx, ny, dd + 1]); }
            }
          }
        }
        const dur = (Math.max(0.28, maxDelay + 0.26)) / this.spd; this.phaseDur = dur;
        cells.forEach((c, n) => {
          const v = this.vis.get(c.id); if (!v) return;
          v.dying = { t: 0, delay: delays[n], merge: merge.get(c.id) || null, kind: "pop", fx: false, rate: this.spd }; v.z = 0;
          if (v.t === "lh" || v.t === "lv" || v.t === "bl" || v.t === "pr") v.flash = 1;
        });
        for (const sp of ph.spawns) {
          const v = this.addVis({ id: sp.id, t: sp.t, k: sp.k, hp: 0, max: 0 }, sp.x, sp.y); v.born = { t: 0, delay: 0.17 / this.spd }; v.z = 3;
          this.after(0.17 / this.spd, () => { const c = this.cellPx(sp.x, sp.y); this.fx.emit({ x: c.x, y: c.y, size: cs * 0.2, life: 0.35, color: "#ffffff", shape: "ring", grow: cs * 0.9 }); FX.sparkle(this.fx, c.x, c.y); FX.sparkle(this.fx, c.x + 8, c.y - 8); this.sfx.powerup && this.sfx.powerup(); });
        }
        for (const c of ph.conv || []) { const v = this.vis.get(c.id); if (v) { v.t = c.t; v.flash = 1; v.born = { t: 0, delay: 0 }; } }
        for (const cr of ph.crates) {
          const v = this.vis.get(cr.id); if (!v) continue; v.hp = cr.hp; v.max = cr.max; v.shake = 0.35; v.flash = 0.8;
          const c = this.cellPx(cr.x, cr.y);
          if (cr.broke) { v.dying = { t: 0, delay: 0.12, kind: "crate", merge: null, fx: false, rate: 1 }; this.after(0.12, () => { FX.debris(this.fx, c.x, c.y, ["#d99a58", "#8a561f", "#e8b678"], 14, 1.1); this.sfx.breakblock(); }); }
          else { FX.debris(this.fx, c.x, c.y, ["#d99a58", "#8a561f"], 6, 0.7); this.sfx.thudWood(); }
        }
        for (const bl of ph.blooms) {
          const i = bl.y * cols + bl.x; this.soilS[i] = 2; this.soilT[i] = this.t + 0.1; const c = this.cellPx(bl.x, bl.y);
          this.after(0.1, () => { this.fx.burst(c.x, c.y, 9, { speed: [40, 150], size: [2.5, 5], life: [0.5, 0.9], colors: ["#ff8ad2", "#ffffff", "#ffe27a", "#b05cff"], g: 160, shape: "star", drag: 1.2, vr: 8 }); this.sfx.heal && this.sfx.heal(); });
        }
        // the special gems' own effects (beams, blasts, lightning, storm)
        for (const e of eff) {
          const base = { t: 0, delay: 0.02 / this.spd };
          if (e.t === "row" || e.t === "col") { this.efx.push({ ...base, k: e.t, x: e.x, y: e.y, dur: 0.46 }); this.after(0.03, () => { this.sfx.whoosh(); this.sfx.laser && this.sfx.laser(); }); this.shake(3, 0.2); }
          else if (e.t === "cross") { this.efx.push({ ...base, k: "cross", x: e.x, y: e.y, w: e.w, dur: 0.5 }); this.after(0.03, () => this.sfx.whoosh()); this.shake(5, 0.28); }
          else if (e.t === "blast") { this.efx.push({ ...base, k: "blast", x: e.x, y: e.y, r: e.r, dur: 0.46 }); this.after(0.04, () => { this.sfx.pop(); this.sfx.impact(); }); this.shake(4 + e.r, 0.25); }
          else if (e.t === "prism") { this.efx.push({ ...base, k: "prism", x: e.x, y: e.y, kk: e.k, targets: e.targets, dur: 0.52 }); this.after(0.03, () => this.sfx.upgrade()); }
          else if (e.t === "storm") { this.efx.push({ ...base, k: "storm", x: e.x, y: e.y, dur: 0.8 }); this.after(0.03, () => this.sfx.boom && this.sfx.boom()); this.shake(9, 0.5); }
        }
        // score and words
        let sx = 0, sy = 0; for (const c of cells) { const p = this.cellPx(c.x, c.y); sx += p.x; sy += p.y; }
        if (cells.length && ph.pts > 0) this.fl.add(sx / cells.length, sy / cells.length - 10, "+" + fmt(ph.pts), CHAIN_COLORS[Math.min(ph.cascade, 4)], clamp(17 + Math.sqrt(ph.pts) * 0.55, 18, 40));
        if (ph.cascade >= 1 && ph.cause !== "finale") this.banner(CHAIN_WORDS[Math.min(ph.cascade, 4)], CHAIN_COLORS[Math.min(ph.cascade, 4)], 40 + Math.min(ph.cascade, 4) * 5, 0.9);
        if (ph.cause === "combo") this.banner("Super combo!", "#7df9ff", 50, 1.1);
        this.chime(ph.cascade); this.lastCascade = ph.cascade; this.spd = 1 + 0.1 * Math.min(ph.cascade, 5);
        this.applySnap(ph.snap); break;
      }
      case "fall": {
        let tmax = 0.1;
        for (const m of ph.moves) { const v = this.vis.get(m.id); if (!v) continue; v.x = m.x; v.y = m.y0; v.ty = m.y1; v.vy = 0; v.fall = true; v.tw = null; v.z = 0; tmax = Math.max(tmax, Math.sqrt((2 * (m.y1 - m.y0)) / (G * this.spd * this.spd))); }
        for (const n of ph.news) { const v = this.addVis({ id: n.id, t: n.t, k: n.k, hp: n.hp, max: n.hp }, n.x, n.y0); v.ty = n.y1; v.vy = 0; v.fall = true; tmax = Math.max(tmax, Math.sqrt((2 * (n.y1 - n.y0)) / (G * this.spd * this.spd))); }
        this.phaseDur = tmax + 0.07; this.landed = false; break;
      }
      case "collect": {
        for (const s of ph.seeds) {
          const v = this.vis.get(s.id); if (v) { v.dying = { t: 0, delay: 0, kind: "collect", merge: null, fx: false, rate: 1 }; }
          const c = this.cellPx(s.x, s.y); this.fl.add(c.x, c.y - 24, "+200", "#ffd84a", 26); FX.pop(this.fx, c.x, c.y, "#ffd84a", 12); FX.confetti(this.fx, c.x, c.y, 10);
        }
        this.banner(ph.seeds.length > 1 ? "Acorns home!" : "Acorn home!", "#ffd84a", 40, 1.0); this.sfx.coin(); this.after(0.1, () => this.sfx.gem && this.sfx.gem());
        this.phaseDur = 0.5; this.applySnap(ph.snap); break;
      }
      case "shuffle": {
        for (const m of ph.moves) { const v = this.vis.get(m.id); if (!v) continue; v.k = m.k; v.tw = { x0: m.x0, y0: m.y0, x1: m.x1, y1: m.y1, t: 0, dur: 0.6, arc: 0.5 }; v.z = 1; }
        this.banner("No moves left. Shuffling!", "#c9b8ff", 36, 1.2); this.sfx.whoosh(); this.phaseDur = 0.72; this.applySnap(ph.snap); break;
      }
      case "bonus": {
        ph.conv.forEach((c, i) => { const v = this.vis.get(c.id); if (v) v.conv = { delay: i * 0.09, t: c.t }; });
        this.phaseDur = ph.conv.length * 0.09 + 0.45; this.sfx.powerup(); this.applySnap(ph.snap); break;
      }
      case "bonusScore": {
        this.stats.bonus += ph.pts; const x = this.bx + (cols * cs) / 2, y = this.by + (this.rows * cs) / 2;
        this.fl.add(x, y, `+${fmt(ph.pts)}`, "#ffd84a", 46, { life: 1.3 }); FX.confetti(this.fx, x, y + 40, 40); this.sfx.coin(); this.phaseDur = 0.9; this.applySnap(ph.snap); break;
      }
      default: this.phaseDur = 0;
    }
  }
  endPhase(ph) {
    if (ph.kind === "clear") {
      for (const [id, v] of this.vis) if (v.dying && v.dying.kind !== "keep") this.vis.delete(id);
    } else if (ph.kind === "swap") {
      for (const v of this.vis.values()) if (v.tw && !v.tw.yoyo) { v.x = v.tw.x1; v.y = v.tw.y1; v.tw = null; }
    } else if (ph.kind === "collect") {
      for (const [id, v] of this.vis) if (v.dying) this.vis.delete(id);
    } else if (ph.kind === "shuffle") {
      for (const v of this.vis.values()) if (v.tw) { v.x = v.tw.x1; v.y = v.tw.y1; v.tw = null; }
    } else if (ph.kind === "fall") {
      for (const v of this.vis.values()) if (v.fall) { v.fall = false; v.y = v.ty; v.vy = 0; }
      if (this.landed) { tone({ type: "sine", f0: 190, f1: 95, dur: 0.07, vol: 0.07 }); this.landed = false; }
    } else if (ph.kind === "bonus") {
      for (const v of this.vis.values()) if (v.conv) { v.t = v.conv.t; v.conv = null; }
    }
  }

  // ---------------------------------------------------------------------------------------------------------------- every frame
  update(dt, input = NO_INPUT) {
    if (this.headless) return;
    // a tap while things are moving (or the fireworks at the end) speeds the film up
    if (this.state === "busy" || this.state === "finale") {
      const p = input.pointer; if ((p && p.pressed) || input.pressed("jump") || input.pressed("confirm")) this.ts = Math.max(this.ts, 2.6); else this.ts = Math.max(this.ts, this.state === "finale" ? 1.7 : 1);
    } else if (this.state === "idle" || this.state === "intro") this.ts = 1;
    if (!this.done && this.state !== "intro") this.time += dt;
    dt *= this.ts;
    this.t += dt; this.stateT += dt;
    this.stepVisuals(dt);
    if (this.state === "intro" && this.stateT >= this.introDur) { this.state = "idle"; this.stateT = 0; this.idleT = 0; }
    this.stepPhases(dt);
    if (this.done) { this.endT += dt; return; }
    if (this.state === "idle") this.handleInput(input, dt);
  }

  stepVisuals(dt) {
    for (let i = this.timers.length - 1; i >= 0; i--) if (this.timers[i].at <= this.t) { const f = this.timers[i].fn; this.timers.splice(i, 1); f(); }
    const cs = this.cs;
    for (const v of this.vis.values()) {
      if (v.tw) { v.tw.t += dt; if (v.tw.t >= v.tw.dur) { if (v.tw.yoyo) { v.x = v.tw.x0; v.y = v.tw.y0; } else { v.x = v.tw.x1; v.y = v.tw.y1; } v.tw = null; } }
      if (v.fall) {
        const g = G * this.spd * this.spd; v.vy += g * dt; v.y += v.vy * dt;
        if (v.y >= v.ty) { if (v.vy > 4) { v.sq = clamp(v.vy / 20, 0.35, 1); this.landed = true; } v.y = v.ty; v.vy = 0; v.fall = false; }
      }
      if (v.sq > 0) v.sq = Math.max(0, v.sq - dt * 5.5);
      if (v.shake > 0) v.shake = Math.max(0, v.shake - dt);
      if (v.flash > 0 && !(v.dying)) v.flash = Math.max(0, v.flash - dt * 3.5);
      if (v.born) { v.born.t += dt; if (v.born.t > v.born.delay + 0.45) v.born = null; }
      if (v.conv && this.phaseT >= v.conv.delay) { v.t = v.conv.t; v.conv = null; v.flash = 1; v.born = { t: 0, delay: 0 }; const c = this.cellPx(v.x, v.y); FX.sparks(this.fx, c.x, c.y, 8, "#fff6c4"); this.sfx.gem && this.sfx.gem(); }
      const d = v.dying;
      if (d) {
        d.t += dt * (d.rate || 1);
        if (!d.fx && d.t >= d.delay) {
          d.fx = true; const c = this.cellPx(v.x, v.y);
          if (d.kind === "pop") {
            const col = v.k >= 0 ? A.GEMS[v.k].c : "#fff6c4", big = v.t !== "g";
            this.fx.burst(c.x, c.y, big ? 11 : 6, { speed: [70, 240], size: [2, 4.6], life: [0.3, 0.66], colors: [col, shade(col, 0.45), "#ffffff"], g: 650, shape: "square", vr: 16, drag: 0.4 });
            this.fx.emit({ x: c.x, y: c.y, size: cs * 0.2, life: 0.26, color: "#ffffff", shape: "ring", grow: cs * 0.5 });
            if (big) FX.sparkle(this.fx, c.x, c.y, "#ffffff");
          }
        }
      }
      if (!d && !v.fall && !v.tw && (v.t === "lh" || v.t === "lv" || v.t === "bl" || v.t === "pr")) { v.spark -= dt; if (v.spark <= 0) { v.spark = 0.22 + Math.random() * 0.25; const c = this.cellPx(v.x, v.y); FX.sparkle(this.fx, c.x + (Math.random() - 0.5) * cs * 0.7, c.y + (Math.random() - 0.5) * cs * 0.7); } }
    }
    for (let i = this.efx.length - 1; i >= 0; i--) { const e = this.efx[i]; e.t += dt; if (e.t > e.delay + e.dur) this.efx.splice(i, 1); }
    if (this.bn) { this.bn.t += dt; if (this.bn.t > this.bn.dur) this.bn = null; }
    if (this.shk.t > 0) this.shk.t -= dt;
    if (this.rejectT > 0) this.rejectT -= dt;
    if (this.movesPop > 0) this.movesPop = Math.max(0, this.movesPop - dt * 4);
    for (let i = 0; i < this.goalPop.length; i++) if (this.goalPop[i] > 0) this.goalPop[i] = Math.max(0, this.goalPop[i] - dt * 2.4);
    const dsc = this.hud.score - this.shownScore; if (dsc > 0) this.shownScore = Math.min(this.hud.score, this.shownScore + Math.max(1, dsc * Math.min(1, dt * 7)));
    this.fx.update(dt); this.fl.update(dt);
  }

  // ---------------------------------------------------------------------------------------------------------------- the player's hands
  cellAt(px, py) {
    const x = Math.floor((px - this.bx) / this.cs), y = Math.floor((py - this.by) / this.cs);
    if (x < 0 || y < 0 || x >= this.cols || y >= this.rows || this.board.vd[y * this.cols + x]) return null;
    return { x, y };
  }
  toggleHammer() {
    if (this.hud.hammers <= 0) { this.sfx.bump(); return; }
    this.hammerMode = !this.hammerMode; this.sel = null; this.sfx.click();
  }
  showHint() { const m = this.board.bestHint(); if (m) { this.hintMove = m; this.hintT = 0; } }
  pickCell(c) {
    if (this.hammerMode) { this.requestHammer(c.x, c.y); this.drag = null; return; }
    const s = this.sel;
    if (s && s.x === c.x && s.y === c.y) { this.sel = null; this.drag = null; this.sfx.tick(); return; }
    if (s && Math.abs(s.x - c.x) + Math.abs(s.y - c.y) === 1) { this.sel = null; this.drag = null; this.requestSwap(s.x, s.y, c.x, c.y); return; }
    const q = this.board.at(c.x, c.y);
    if (!q || q.t === T.CRATE) { this.sel = null; this.drag = null; if (q) { const v = this.vis.get(q.id); if (v) v.shake = 0.3; this.sfx.bump(); } return; }
    this.sel = { x: c.x, y: c.y }; this.sfx.tick();
  }
  handleInput(input, dt) {
    this.idleT += dt; if (this.hintMove) this.hintT += dt;
    if (this.rejectT > 0) return;
    const p = input.pointer;
    this.hover = p.type === "mouse" && p.inside !== false ? this.cellAt(p.x, p.y) : null;
    let used = false;
    if (p.pressed) {
      used = true;
      const hb = this.hammerBtn;
      if (!this.bare && p.x >= hb.x && p.x <= hb.x + hb.w && p.y >= hb.y && p.y <= hb.y + hb.h) { this.toggleHammer(); this.drag = null; }
      else {
        const c = this.cellAt(p.x, p.y);
        if (c) { this.cursor.on = false; this.pickCell(c); if (this.sel && this.sel.x === c.x && this.sel.y === c.y) this.drag = { x: c.x, y: c.y, px: p.x, py: p.y }; }
        else { this.sel = null; this.drag = null; if (this.hammerMode && !this.bare) this.hammerMode = false; }
      }
    }
    if (this.drag && p.down) {
      const dx = p.x - this.drag.px, dy = p.y - this.drag.py;
      if (Math.hypot(dx, dy) > this.cs * 0.4) {
        const horiz = Math.abs(dx) > Math.abs(dy), tx = this.drag.x + (horiz ? Math.sign(dx) : 0), ty = this.drag.y + (horiz ? 0 : Math.sign(dy)), fx = this.drag.x, fy = this.drag.y;
        this.drag = null; this.sel = null; this.requestSwap(fx, fy, tx, ty); used = true;
      }
    }
    if (p.released) this.drag = null;
    // keyboard
    const kx = (input.pressed("right") ? 1 : 0) - (input.pressed("left") ? 1 : 0), ky = (input.pressed("down") ? 1 : 0) - (input.pressed("up") ? 1 : 0);
    if (kx || ky) {
      used = true; const c = this.cursor;
      if (this.sel && !this.hammerMode) { const s = this.sel; this.sel = null; this.requestSwap(s.x, s.y, s.x + (kx && !ky ? kx : 0), s.y + (ky && !kx ? ky : 0)); }
      else {
        if (!c.on) c.on = true;
        else { for (let n = 0; n < 4; n++) { const nx = clamp(c.x + kx, 0, this.cols - 1), ny = clamp(c.y + ky, 0, this.rows - 1); if (!this.board.vd[ny * this.cols + nx]) { c.x = nx; c.y = ny; break; } c.x = nx; c.y = ny; if (nx === 0 || ny === 0 || nx === this.cols - 1 || ny === this.rows - 1) break; } }
        if (this.board.vd[c.y * this.cols + c.x]) { c.x = (this.cols / 2) | 0; c.y = (this.rows / 2) | 0; for (let y = 0; y < this.rows; y++) if (!this.board.vd[y * this.cols + c.x]) { c.y = y; break; } }
        this.sfx.tick();
      }
    }
    if (input.pressed("jump") || input.pressed("confirm")) { used = true; this.cursor.on = true; this.pickCell({ x: this.cursor.x, y: this.cursor.y }); }
    if (input.pressed("alt") && !this.bare) { used = true; this.toggleHammer(); }
    if (input.keyPressed && input.keyPressed("KeyH")) { used = true; this.showHint(); }
    if (used && !(input.keyPressed && input.keyPressed("KeyH"))) { this.idleT = 0; this.hintMove = null; }
    if (!this.bare && !this.hintMove && this.idleT > (this.firstTime && this.stats.moves === 0 ? 5 : 8) && !this.hammerMode) this.showHint();
  }

  // for the tests: after the board was changed by hand, make the pictures match it again
  rebuildVis() {
    const b = this.board; this.vis.clear(); this.queue.length = 0; this.cur = null; this.efx.length = 0; this.timers.length = 0; this.state = "idle"; this.done = null; this.finaleOn = false;
    for (let i = 0; i < b.p.length; i++) { const q = b.p[i]; if (q) this.addVis(q, i % this.cols, (i / this.cols) | 0); this.soilS[i] = b.soil[i] ? 1 : 0; }
    this.hud = b.snap(); this.shownScore = b.score;
  }

  // ---------------------------------------------------------------------------------------------------------------- checks for the tests
  checkSync() {
    const b = this.board, bad = [], seen = new Set();
    for (let i = 0; i < b.p.length; i++) {
      const q = b.p[i]; if (!q) continue; seen.add(q.id); const v = this.vis.get(q.id), x = i % b.cols, y = (i / b.cols) | 0;
      if (!v) { bad.push(`no picture for ${q.t}${q.k} at ${x},${y}`); continue; }
      if (v.dying) bad.push(`${q.t} at ${x},${y} is still dying`);
      if (Math.abs(v.x - x) > 0.01 || Math.abs(v.y - y) > 0.01) bad.push(`${q.t}${q.k} drawn at ${v.x.toFixed(2)},${v.y.toFixed(2)} but is at ${x},${y}`);
      if (v.t !== q.t) bad.push(`type ${v.t} vs ${q.t} at ${x},${y}`);
      if (q.t === T.GEM && v.k !== q.k) bad.push(`colour ${v.k} vs ${q.k} at ${x},${y}`);
      if (q.t === T.CRATE && v.hp !== q.hp) bad.push(`crate hp ${v.hp} vs ${q.hp}`);
    }
    for (const id of this.vis.keys()) if (!seen.has(id)) bad.push(`extra picture ${id}`);
    return bad.length ? bad.slice(0, 6).join("; ") : null;
  }

  // ================================================================================================================ drawing
  draw(g) {
    const t = this.t;
    this.bd.draw(g, t * 9, 0, t, 960, 540, { camYFactor: 0.2 });
    g.fillStyle = this.bare ? "rgba(10,4,30,.18)" : "rgba(10,4,30,.34)"; g.fillRect(0, 0, 960, 540);
    g.save();
    if (this.shk.t > 0) { const k = this.shk.t / this.shk.dur; g.translate((Math.random() * 2 - 1) * this.shk.mag * k, (Math.random() * 2 - 1) * this.shk.mag * k); }
    if (!this.bare) this.drawPanel(g, t);
    this.drawBoard(g, t);
    g.restore();
    this.fl.draw(g);
    if (!this.demo) { this.drawBanner(g); this.drawIntro(g); }
    if (this.state === "finale" && this.ts < 2) text(g, "Tap to speed up", this.bx + (this.cols * this.cs) / 2, this.by + this.rows * this.cs + 30, { size: 13, color: "#e6e0ff", align: "center", font: FONT_BODY, weight: 700, alpha: 0.55 + 0.35 * Math.sin(this.t * 5), stroke: OUT, strokeW: 4 });
    if (this.done && this.state === "lost") { g.fillStyle = `rgba(10,4,30,${clamp(this.endT * 0.5, 0, 0.35)})`; g.fillRect(0, 0, 960, 540); }
  }

  drawBoard(g, t) {
    const { bx, by, cs, cols, rows } = this, back = this.back;
    g.drawImage(back.canvas, bx - back.pad, by - back.pad, back.W, back.H);
    // soil patches (brown until a gem on them is cleared, then they bloom)
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x, s = this.soilS[i]; if (!s) continue;
      let k = 1; if (s === 2) { const u = clamp((t - this.soilT[i]) / 0.45, 0, 1); k = 1 + 0.22 * Math.sin(u * Math.PI); }
      const spr = A.soilTile(cs, s === 2, (x * 7 + y * 3) % 5), sz = cs * k; g.drawImage(spr, bx + x * cs + (cs - sz) / 2, by + y * cs + (cs - sz) / 2, sz, sz);
    }
    // keyboard cursor, hovered cell, selection (under the pieces)
    if (this.state === "idle" && !this.done) this.drawCellMarks(g, t);
    g.save(); g.clip(this.clip);
    const list = this._list || (this._list = []); list.length = 0; for (const v of this.vis.values()) list.push(v);
    list.sort((a, b2) => a.z - b2.z);
    for (const v of list) this.drawPiece(g, v, t);
    g.restore();
    for (const e of this.efx) this.drawEffect(g, e, t);
    this.fx.draw(g);
  }

  drawCellMarks(g, t) {
    const { bx, by, cs } = this, put = (x, y, col, w, a = 1, r = 0.2) => { g.save(); g.globalAlpha = a; fillRR(g, bx + x * cs + 2, by + y * cs + 2, cs - 4, cs - 4, cs * r, null, col, w); g.restore(); };
    if (this.hintMove && this.hintT > 0) {
      const m = this.hintMove, a = 0.45 + 0.4 * Math.abs(Math.sin(t * 5));
      for (const [x, y] of [[m[0], m[1]], [m[2], m[3]]]) { g.save(); g.globalAlpha = a; fillRR(g, bx + x * cs + 3, by + y * cs + 3, cs - 6, cs - 6, cs * 0.2, "rgba(255,255,255,.16)", "#ffffff", 3); g.restore(); }
    }
    if (this.sel) { const a = 0.7 + 0.3 * Math.sin(t * 9); fillRR(g, bx + this.sel.x * cs + 2, by + this.sel.y * cs + 2, cs - 4, cs - 4, cs * 0.2, "rgba(255,255,255,.22)", `rgba(255,255,255,${a})`, 3.5); }
    if (this.cursor.on && !this.sel) put(this.cursor.x, this.cursor.y, "#ffffff", 3, 0.6 + 0.4 * Math.sin(t * 8));
    if (this.hammerMode) { const c = this.hover || (this.cursor.on ? this.cursor : null); if (c) { put(c.x, c.y, "#ff7a7a", 3.5, 1); g.save(); g.translate(bx + (c.x + 0.8) * cs, by + (c.y + 0.1) * cs); g.rotate(0.3 + 0.2 * Math.sin(t * 9)); A.drawIcon(g, "hammer", 0, 0, cs * 0.9); g.restore(); } }
  }

  drawPiece(g, v, t) {
    const { cs, bx, by } = this;
    let x = v.x, y = v.y, sx = 1, sy = 1, al = 1, rot = 0, glowA = 0;
    const tw = v.tw;
    if (tw) { const u = clamp(tw.t / tw.dur, 0, 1), k = tw.yoyo ? Math.sin(u * Math.PI) : ease.inOutQuad(u); x = lerp(tw.x0, tw.x1, k); y = lerp(tw.y0, tw.y1, k); if (tw.arc) y -= Math.sin(u * Math.PI) * tw.arc; }
    if (v.shake > 0) x += Math.sin(v.shake * 60) * 0.05 * Math.min(1, v.shake * 4);
    if (v.sq > 0) { sx = 1 + 0.16 * v.sq; sy = 1 - 0.2 * v.sq; }
    const d = v.dying;
    if (d) {
      const u = d.t - d.delay;
      if (u > 0) {
        if (d.kind === "collect") { const k = clamp(u / 0.5, 0, 1); y -= k * 0.7; const s = 1 + 0.35 * Math.sin(k * Math.PI); sx *= s; sy *= s; al = 1 - Math.max(0, (k - 0.55) / 0.45); glowA = 0.6 * (1 - k); }
        else if (d.kind === "crate") { const k = clamp(u / 0.3, 0, 1); rot = k * 0.7; const s = 1 + 0.15 * Math.sin(k * Math.PI) - k * 0.6; sx *= s; sy *= s; al = 1 - Math.max(0, (k - 0.4) / 0.6); y -= Math.sin(k * Math.PI) * 0.25; x += k * 0.1; }
        else { const k = clamp(u / 0.24, 0, 1), s = k < 0.3 ? 1 + 0.28 * (k / 0.3) : 1.28 * (1 - (k - 0.3) / 0.7); sx *= s; sy *= s; al = 1 - Math.max(0, (k - 0.55) / 0.45); glowA = 0.5 * (1 - k); if (d.merge) { const m = ease.inQuad(k); x = lerp(x, d.merge.x, m); y = lerp(y, d.merge.y, m); } }
      } else if (v.t !== "g" && v.t !== "cr" && v.t !== "sd") glowA = 0.4;
    }
    if (v.born) { if (v.born.t < v.born.delay) return; const u = clamp((v.born.t - v.born.delay) / 0.34, 0, 1), s = ease.outBack(u); sx *= s; sy *= s; }
    const hot = this.hintMove && this.hintT > 0 && ((Math.abs(v.x - this.hintMove[0]) < 0.01 && Math.abs(v.y - this.hintMove[1]) < 0.01) || (Math.abs(v.x - this.hintMove[2]) < 0.01 && Math.abs(v.y - this.hintMove[3]) < 0.01));
    if (hot) { const s = 1 + 0.07 * Math.sin(t * 9); sx *= s; sy *= s; }
    if (this.sel && Math.abs(v.x - this.sel.x) < 0.01 && Math.abs(v.y - this.sel.y) < 0.01 && !tw) { const s = 1.1 + 0.03 * Math.sin(t * 9); sx *= s; sy *= s; }
    if (v.t === "lh" || v.t === "lv" || v.t === "bl") { const s = 1 + 0.035 * Math.sin(t * 5 + v.ph); sx *= s; sy *= s; }
    const px = bx + (x + 0.5) * cs, py = by + (y + 1) * cs, midY = -cs / 2;
    g.save(); g.globalAlpha *= al; g.translate(px, py); g.scale(sx, sy);
    if (rot) { g.translate(0, midY); g.rotate(rot); g.translate(0, -midY); }
    if (v.t === "lh" || v.t === "lv" || v.t === "bl") glow(g, 0, midY, cs * 0.66, "#ffffff", 0.14 + 0.1 * Math.sin(t * 5 + v.ph));
    if (glowA > 0) glow(g, 0, midY, cs * 0.8, v.k >= 0 ? A.GEMS[v.k].c : "#ffe27a", glowA);
    let spr = null, sz = cs * GEM_K;
    if (v.t === "pr") A.drawPrism(g, 0, midY, cs * 0.4, t + v.ph);
    else if (v.t === "cr") { spr = A.crateSprite(v.hp, v.max); sz = cs * CRATE_K; }
    else if (v.t === "sd") spr = A.acornSprite();
    else spr = A.gemSprite(v.k, v.t);
    if (spr) {
      g.drawImage(spr, -sz / 2, midY - sz / 2 + (v.t === "cr" ? -cs * 0.02 : 0), sz, sz);
      if (v.flash > 0.02) { g.globalCompositeOperation = "lighter"; g.globalAlpha *= clamp(v.flash, 0, 1) * 0.7; g.drawImage(spr, -sz / 2, midY - sz / 2, sz, sz); g.globalCompositeOperation = "source-over"; }
    }
    g.restore();
  }

  drawEffect(g, e, t) {
    if (e.t < e.delay) return;
    const { bx, by, cs, cols, rows } = this, u = clamp((e.t - e.delay) / e.dur, 0, 1), cx = bx + (e.x + 0.5) * cs, cy = by + (e.y + 0.5) * cs, W = cols * cs, H = rows * cs;
    g.save();
    if (e.k === "row" || e.k === "col" || e.k === "cross") {
      const th = e.k === "cross" ? cs * (0.5 + 0.55 * (e.w || 1)) : cs * 0.8, a = u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85, run = clamp(u / 0.5, 0, 1), er = ease.outCubic(run);
      const beam = (horizontal) => {
        const c0 = horizontal ? cx : cy, lo = horizontal ? bx : by, hi = horizontal ? bx + W : by + H, a0 = c0 - (c0 - lo) * er - 4, a1 = c0 + (hi - c0) * er + 4, mid = horizontal ? cy : cx;
        const gr = horizontal ? g.createLinearGradient(0, mid - th / 2, 0, mid + th / 2) : g.createLinearGradient(mid - th / 2, 0, mid + th / 2, 0);
        gr.addColorStop(0, "rgba(255,255,255,0)"); gr.addColorStop(0.5, `rgba(255,255,255,${0.95 * a})`); gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr; if (horizontal) g.fillRect(a0, mid - th / 2, a1 - a0, th); else g.fillRect(mid - th / 2, a0, th, a1 - a0);
        g.globalCompositeOperation = "lighter";
        for (const hx of [a0, a1]) { const px = horizontal ? hx : mid, py = horizontal ? mid : hx; glow(g, px, py, cs * 0.9, this.accent, 0.7 * a); glow(g, px, py, cs * 0.5, "#ffffff", 0.8 * a); }
        g.globalCompositeOperation = "source-over";
      };
      if (e.k === "row" || e.k === "cross") beam(true);
      if (e.k === "col" || e.k === "cross") beam(false);
    } else if (e.k === "blast") {
      const R = (e.r + 0.65) * cs, k = ease.outCubic(u), a = 1 - u;
      g.globalCompositeOperation = "lighter"; glow(g, cx, cy, R * (0.6 + k * 0.9), "#ffffff", 0.75 * a); glow(g, cx, cy, R * 1.5, this.accent, 0.5 * a); g.globalCompositeOperation = "source-over";
      g.lineWidth = 9 * a + 1; g.strokeStyle = `rgba(255,255,255,${a})`; g.beginPath(); g.arc(cx, cy, R * k, 0, TAU); g.stroke();
      g.lineWidth = 4 * a + 1; g.strokeStyle = `rgba(255,214,120,${a})`; g.beginPath(); g.arc(cx, cy, R * k * 0.78, 0, TAU); g.stroke();
    } else if (e.k === "prism") {
      const a = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3, grow = clamp(u / 0.35, 0, 1), col = e.kk >= 0 ? A.GEMS[e.kk].c : "#ffffff", frame = Math.floor(t * 24);
      glow(g, cx, cy, cs * 1.4 * (1 - u * 0.4), "#ffffff", 0.7 * a);
      for (const ti of e.targets) {
        const tx = bx + ((ti % cols) + 0.5) * cs, ty = by + (((ti / cols) | 0) + 0.5) * cs, dx = tx - cx, dy = ty - cy, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len, segs = 5;
        const pts = []; for (let s = 0; s <= segs; s++) { const f = (s / segs) * grow, j = s === 0 || s === segs ? 0 : (((ti * 31 + s * 17 + frame * 13) % 100) / 100 - 0.5) * cs * 0.7; pts.push([cx + dx * f + nx * j, cy + dy * f + ny * j]); }
        for (const [w, c] of [[7 * a, col], [3.5 * a, "#ffffff"]]) { g.lineWidth = Math.max(0.5, w); g.strokeStyle = c; g.globalAlpha = a; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke(); }
        g.globalAlpha = 1; if (grow >= 1) glow(g, tx, ty, cs * 0.6, col, 0.7 * a);
      }
    } else if (e.k === "storm") {
      const a = 1 - u, k = ease.outCubic(u);
      g.fillStyle = `rgba(255,255,255,${0.5 * Math.sin(Math.min(1, u * 1.6) * Math.PI) * a + 0.1 * a})`; g.fillRect(bx - 10, by - 10, W + 20, H + 20);
      for (let i = 0; i < 3; i++) { const kk = clamp(k - i * 0.12, 0, 1); g.lineWidth = 8 * a * (1 - i * 0.25) + 1; g.strokeStyle = `rgba(${i === 1 ? "255,138,210" : i === 2 ? "125,249,255" : "255,255,255"},${a})`; g.beginPath(); g.arc(cx, cy, Math.max(1, kk * Math.max(W, H) * 0.95), 0, TAU); g.stroke(); }
    } else if (e.k === "hammer") {
      const k = clamp(u / 0.6, 0, 1), ang = lerp(-1.25, 0.35, ease.inQuad(k)), s = cs * 1.9, hy = cy - cs * 0.55 - (1 - ease.inQuad(k)) * cs * 0.9;
      g.translate(cx + cs * 0.35, hy); g.rotate(ang + 0.6); A.drawIcon(g, "hammer", 0, 0, s);
    }
    g.restore();
  }

  drawBanner(g) {
    const bn = this.bn; if (!bn) return;
    const u = bn.t / bn.dur, s = u < 0.16 ? 0.5 + 0.7 * ease.outBack(u / 0.16) * 0.714 : 1, a = u > 0.72 ? 1 - (u - 0.72) / 0.28 : 1;
    const cx = this.bx + (this.cols * this.cs) / 2, cy = this.by + (this.rows * this.cs) * 0.34;
    g.save(); g.translate(cx, cy); g.scale(s, s); g.globalAlpha = a;
    const w = textWidth(g, bn.text, bn.size, FONT_DISPLAY, 800);
    if (bn.sub) { fillRR(g, -Math.max(w, 280) / 2 - 24, -bn.size * 0.95, Math.max(w, 280) + 48, bn.size * 1.35 + 40, 20, "rgba(14,6,36,.78)", "rgba(190,180,255,.35)", 1.5); }
    text(g, bn.text, 0, 0, { size: bn.size, color: bn.color, align: "center", stroke: OUT, strokeW: Math.max(5, bn.size / 5), weight: 800 });
    if (bn.sub) text(g, bn.sub, 0, bn.size * 0.62, { size: 16, color: "#e6e0ff", align: "center", font: FONT_BODY, weight: 600 });
    g.restore();
  }
  drawIntro(g) {
    if (this.state !== "intro") return;
    const lv = this.lv, T0 = this.stateT, a = clamp(T0 / 0.22, 0, 1) * (1 - clamp((T0 - 0.95) / 0.4, 0, 1));
    if (a <= 0.01) return;
    const cx = this.bx + (this.cols * this.cs) / 2, cy = this.by + (this.rows * this.cs) / 2, W = 360, H = 150;
    g.save(); g.globalAlpha = a; g.translate(cx, cy + (1 - a) * 14);
    fillRR(g, -W / 2, -H / 2, W, H, 24, "rgba(14,6,36,.88)", this.accent, 2.5);
    text(g, `${this.world.name.toUpperCase()} · LEVEL ${lv.id}`, 0, -H / 2 + 34, { size: 9, color: this.accent, align: "center", font: FONT_PIXEL, weight: 400 });
    let size = 34; while (textWidth(g, lv.name, size, FONT_DISPLAY, 800) > W - 40 && size > 18) size--;
    text(g, lv.name, 0, -H / 2 + 76, { size, color: "#ffffff", align: "center", weight: 800 });
    const lines = wrapText(g, describeGoals(lv), W - 50, 14, FONT_BODY, 600);
    lines.slice(0, 2).forEach((ln, i) => text(g, ln, 0, -H / 2 + 108 + i * 19, { size: 14, color: "#d9d2ff", align: "center", font: FONT_BODY, weight: 600 }));
    g.restore();
  }

  // ---------------------------------------------------------------------------------------------------------------- the side panel
  // The blocks (title, moves, goals, score, hammer) share the panel's height: the hammer sits at the bottom and the gaps stretch.
  layoutPanel() {
    const n = this.lv.goals.length, hintH = this.hintLines.length ? this.hintLines.length * 16 + 8 : 0;
    const heights = [60 + hintH, 66, 20 + n * 46, 84, 54], top = 34, bottom = 504;
    const gap = clamp((bottom - top - heights.reduce((a, b) => a + b, 0)) / 4, 6, 44), ys = []; let y = top;
    for (const h of heights) { ys.push(y); y += h + gap; }
    ys[4] = bottom - 54; this.PL = { ys };
    this.hammerBtn = { x: 30, y: ys[4], w: 228, h: 54 };
  }
  drawPanel(g, t) {
    const lv = this.lv, hud = this.hud, X = 30, W = 228, ys = this.PL.ys;
    fillRR(g, 18, 18, 252, 504, 24, "rgba(14,6,36,.74)", "rgba(190,180,255,.28)", 1.5);
    // title (and, the first time you play a level, its tip)
    text(g, `${this.world.short.toUpperCase()} · LEVEL ${lv.id}`, X + 4, ys[0] + 10, { size: 9, color: "#c3bbea", font: FONT_PIXEL, weight: 400 });
    let size = 25; while (textWidth(g, lv.name, size, FONT_DISPLAY, 800) > W - 6 && size > 15) size--;
    text(g, lv.name, X + 4, ys[0] + 18 + size, { size, color: "#ffffff", weight: 800 });
    this.hintLines.forEach((ln, i) => text(g, ln, X + 4, ys[0] + 62 + i * 16, { size: 12.5, color: "#d9d2ff", font: FONT_BODY, weight: 500 }));
    // moves
    let y = ys[1];
    const low = hud.moves <= 5, mcol = hud.moves <= 3 ? "#ff7a8a" : hud.moves <= 5 ? "#ffc233" : "#ffffff";
    fillRR(g, X, y, W, 66, 18, "rgba(255,255,255,.07)", low ? mcol : "rgba(190,180,255,.25)", low ? 2 : 1.5);
    text(g, "MOVES", X + 16, y + 26, { size: 9, color: "#c3bbea", font: FONT_PIXEL, weight: 400 });
    g.save(); g.translate(X + W - 18, y + 52); const mp = 1 + 0.28 * Math.sin(this.movesPop * Math.PI) + (hud.moves <= 3 && this.state === "idle" ? 0.05 * Math.sin(t * 8) : 0); g.scale(mp, mp);
    text(g, String(Math.max(0, hud.moves)), 0, 0, { size: 50, color: mcol, align: "right", weight: 800, stroke: "rgba(14,6,36,.5)", strokeW: 4 }); g.restore();
    // goals
    y = ys[2];
    text(g, "GOALS", X + 4, y + 10, { size: 9, color: "#c3bbea", font: FONT_PIXEL, weight: 400 });
    const rows = this.goalRows();
    rows.forEach((r, i) => {
      const done = r.have >= r.need, ry = y + 20 + i * 46, pop = this.goalPop[i] || 0;
      fillRR(g, X, ry, W, 42, 14, done ? "rgba(80,230,140,.14)" : "rgba(255,255,255,.05)", done ? "rgba(110,255,170,.55)" : "rgba(190,180,255,.18)", 1.3);
      g.save(); g.translate(X + 24, ry + 21); const ps = 1 + 0.4 * Math.sin(pop * Math.PI); g.scale(ps, ps); A.drawIcon(g, r.icon, 0, 0, 30, r.c); g.restore();
      text(g, r.label, X + 48, ry + 17, { size: 13, color: done ? "#c9ffdc" : "#ffffff", font: FONT_BODY, weight: 700 });
      if (done) { circle(g, X + W - 20, ry + 14, 9, "#3ee08a", OUT, 1.8); g.save(); g.strokeStyle = "#0a2a1a"; g.lineWidth = 2.6; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath(); g.moveTo(X + W - 24.5, ry + 14); g.lineTo(X + W - 21, ry + 17.5); g.lineTo(X + W - 15.5, ry + 10.5); g.stroke(); g.restore(); }
      else text(g, `${fmt(r.have)} / ${fmt(r.need)}`, X + W - 12, ry + 17, { size: 12.5, color: "#e6e0ff", align: "right", font: FONT_BODY, weight: 700 });
      bar(g, X + 48, ry + 26, W - 48 - 12, 9, r.have / r.need, done ? "#3ee08a" : r.icon === "gem" ? A.GEMS[r.c].c : "#ffc233");
    });
    // score and stars
    y = ys[3];
    const [s2, s3] = lv.stars, max = s3 * 1.12;
    fillRR(g, X, y, W, 84, 18, "rgba(255,255,255,.05)", "rgba(190,180,255,.2)", 1.3);
    text(g, "SCORE", X + 16, y + 24, { size: 9, color: "#c3bbea", font: FONT_PIXEL, weight: 400 });
    text(g, fmt(this.shownScore), X + W - 16, y + 30, { size: 28, color: "#ffd84a", align: "right", weight: 800, stroke: "rgba(14,6,36,.5)", strokeW: 4 });
    const bx0 = X + 20, bw = W - 40, by0 = y + 62;
    bar(g, bx0, by0, bw, 10, this.shownScore / max, "#ffc233");
    [s2, s3].forEach((th) => { const sx = bx0 + bw * (th / max), got = this.shownScore >= th; star(g, sx, y + 50, 8.5, got ? "#ffc233" : "rgba(60,30,90,.9)", got ? OUT : "rgba(190,180,255,.45)", 1.8); });
    // hammer
    const hb = this.hammerBtn, has = hud.hammers > 0, on = this.hammerMode;
    fillRR(g, hb.x, hb.y, hb.w, hb.h, 18, on ? "rgba(255,110,110,.28)" : "rgba(255,255,255,.07)", on ? "#ff8a8a" : has ? "rgba(190,180,255,.4)" : "rgba(190,180,255,.15)", on ? 2.5 : 1.5);
    g.save(); g.globalAlpha = has ? 1 : 0.35; g.translate(hb.x + 32, hb.y + hb.h / 2 + 2); if (on) g.rotate(Math.sin(t * 10) * 0.18); A.drawIcon(g, "hammer", 0, 0, 40); g.restore();
    text(g, on ? "Tap a gem to smash it" : "Hammer", hb.x + 62, hb.y + (on ? 31 : 25), { size: on ? 13 : 16, color: has ? "#ffffff" : "#8f87b8", font: FONT_DISPLAY, weight: 800 });
    if (!on) text(g, has ? "Smash any one gem or crate" : "All used up", hb.x + 62, hb.y + 42, { size: 11, color: "#c3bbea", font: FONT_BODY, weight: 500 });
    text(g, `×${hud.hammers}`, hb.x + hb.w - 16, hb.y + 35, { size: 20, color: has ? "#ffd84a" : "#8f87b8", align: "right", weight: 800 });
  }
}
