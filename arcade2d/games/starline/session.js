// Starline Vanguard: one play-through of one stage. The rules live in sim.js; this class reads the keyboard / finger, turns the rules' events into
// sound and sparks, and draws the battle. It also runs "headless" (no drawing) so tests can fly whole stages through the same code the player uses.
import { createState, step, stars as starsOf, scoreOf, W, H, TOP, BOT, ENEMIES, SHIP } from "./sim";
import { botInput, newBrain } from "./bot";
import * as A from "./art";
import { WORLDS } from "./levels";
import { clamp } from "../../core/util";
import { Particles, FX, Floaters } from "../../core/fx";
import { Backdrop } from "../../core/backdrop";
import { text, wrapText, fillRR, circle, heart, makeCanvas, hudChip, FONT_DISPLAY, FONT_BODY } from "../../core/draw";
import { sfx as realSfx } from "../../core/audio";

const NOOP = new Proxy({}, { get: () => () => {} });
export const NO_INPUT = { pointer: { x: -99, y: -99, down: false, pressed: false, released: false, inside: false, type: "mouse" }, pressed: () => false, held: () => false, axis: () => 0, keyPressed: () => false };
const BD = new Map();
// four sky looks for the four sectors, all built on the "space" backdrop
const SKIES = [
  null,
  { sky: [[0, "#1a0533"], [0.5, "#4a1260"], [1, "#8a2a78"]], layers: [{ kind: "crystals", px: 0.06, count: 5, amp: 120, colors: ["#ffb86a", "#ff6ad5"] }], ambient: { kind: "streaks", n: 40, color: "#ffd9f0" } },
  { sky: [[0, "#04121a"], [0.5, "#0b2a3a"], [1, "#164a55"]], layers: [{ kind: "crystals", px: 0.06, count: 4, amp: 110, colors: ["#3ee6e0", "#7cffb2"] }], ambient: { kind: "streaks", n: 40, color: "#c8fff4" } },
  { sky: [[0, "#000000"], [0.5, "#16001a"], [1, "#3a0a2c"]], layers: [{ kind: "crystals", px: 0.06, count: 4, amp: 140, colors: ["#ff3a5a", "#7c5cff"] }], ambient: { kind: "streaks", n: 55, color: "#ffc0cc" } },
];
const backdropFor = (wi, seed) => { let b = BD.get(wi); if (!b) { b = new Backdrop("space", seed, SKIES[wi]); BD.set(wi, b); } return b; };

export class StarSession {
  constructor(lv, ctx = {}, opts = {}) {
    this.lv = lv; this.ctx = ctx; this.headless = !!opts.headless; this.quiet = this.headless || !!opts.quiet; this.bare = !!opts.bare; this.demo = !!opts.demo;
    this.sfx = this.quiet ? NOOP : realSfx;
    this.world = WORLDS[lv.wi]; this.accent = ctx.accent || "#38bdf8";
    this.S = createState(lv); this.t = 0; this.done = null; this.state = "play"; this.stateT = 0; this.shake = 0; this.shotT = 0; this.novaFx = 0; this.novaAt = [0, 0]; this.bannerT = 0; this.banner = "";
    this.brain = this.demo ? newBrain() : null; this.tilt = 0; this.hintLines = [];
    this.btn = { restart: { x: 800, y: 12, w: 92, h: 36 } };
    const rec = ctx.save && ctx.save.levels ? ctx.save.levels[lv.id] : null; this.firstTime = !(rec && (rec.stars > 0 || rec.best > 0));
    if (this.headless) { this.fx = NOOP; this.fl = NOOP; return; }
    this.fx = new Particles(700); this.fl = new Floaters();
    this.bd = this.bare ? null : backdropFor(lv.wi, (lv.wi + 1) * 11 + 4);
    if (lv.hint && this.firstTime) this.hintLines = wrapText(makeCanvas(4, 4).getContext("2d"), lv.hint, 780, 13, FONT_BODY, 500).slice(0, 2);
  }

  restart() { this.S = createState(this.lv); this.state = "play"; this.stateT = 0; this.t = 0; this.shake = 0; if (this.brain) this.brain = newBrain(); this.sfx.click(); }
  finishWin() {
    const S = this.S, st = starsOf(S);
    this.done = {
      won: true, score: scoreOf(S), stars: st, time: Math.round(S.t), title: st === 3 ? "FLAWLESS!" : st === 2 ? "STAGE CLEAR!" : "SURVIVED!", sub: this.lv.name, delay: 1.0,
      lines: [["Hits taken", `${S.hits} (3 stars needs 0, 2 stars needs 2 or fewer)`], ["Ships destroyed", `${S.kills}`], ["Score", `${S.score}`]],
    };
  }

  handleEvents() {
    const S = this.S, evs = S.ev; if (!evs.length) return;
    for (const e of evs) {
      if (e.k === "win") { this.state = "winning"; this.stateT = 0; if (!this.headless) { this.sfx.star(); FX.confetti(this.fx, 480, 270, 60); } }
      else if (e.k === "lose") { this.state = "lost"; this.stateT = 0; if (!this.headless) { this.sfx.lose(); FX.explosion(this.fx, S.ship.x, S.ship.y, 1.2); } }
      if (this.headless) continue;
      switch (e.k) {
        case "shot": if (this.shotT <= 0) { this.sfx.laser(); this.shotT = 0.28; } break;
        case "hit": FX.sparks(this.fx, e.x, e.y, 3, "#bff7ff"); break;
        case "kill": if (e.big) { this.sfx.boom(); this.shake = Math.max(this.shake, e.type.startsWith("boss") ? 0.7 : 0.25); FX.explosion(this.fx, e.x, e.y, e.type.startsWith("boss") ? 2 : 1); } else { this.sfx.kill(); FX.pop(this.fx, e.x, e.y, "#ffb04a", 10); } break;
        case "hurt": this.sfx.hurt(); this.shake = 0.4; FX.sparks(this.fx, S.ship.x, S.ship.y, 12, "#ff9a7a"); break;
        case "pickup": this.sfx.powerup(); this.fl.add(e.x, e.y - 18, e.kind === "P" ? "Power up!" : e.kind === "S" ? "Shield +1" : "Nova +1", "#fff2a0", 15); break;
        case "nova": this.sfx.explode(); this.novaFx = 0.6; this.novaAt = [S.ship.x, S.ship.y]; this.shake = 0.35; break;
        case "boss": this.sfx.alarm(); this.banner = "WARNING: BOSS INCOMING"; this.bannerT = 2.6; break;
        default: break;
      }
    }
    evs.length = 0;
  }

  update(dt, input, env) {
    this.t += dt; this.stateT += dt; if (this.shotT > 0) this.shotT -= dt; if (this.shake > 0) this.shake -= dt; if (this.novaFx > 0) this.novaFx -= dt; if (this.bannerT > 0) this.bannerT -= dt;
    this.fx.update && this.fx.update(dt); this.fl.update && this.fl.update(dt);
    if (this.state === "winning") { step(this.S, dt, { mx: 0, my: 0 }); this.handleEvents(); if (this.stateT > 1.4 && !this.done) this.finishWin(); return; }
    if (this.state === "lost") {
      const p = input.pointer; if (input.pressed("restart") || (p.pressed && ((p.x >= 380 && p.x <= 580 && p.y >= 300 && p.y <= 356) || (p.x >= this.btn.restart.x && p.x <= this.btn.restart.x + 92 && p.y >= 12 && p.y <= 48)))) this.restart();
      return;
    }
    let inp;
    if (this.demo) { inp = botInput(this.S, this.brain); inp.nova = inp.nova && false; step(this.S, dt, inp); this.handleEvents(); if (this.state !== "play" && this.stateT > 2) this.restart(); return; }
    const p = input.pointer, sh = this.S.ship;
    let mx = input.axis("left", "right"), my = input.axis("up", "down");
    if (p.down && p.y > 60 && !(p.x >= 800 && p.y < 50)) { const dx = p.x - 60 - sh.x, dy = p.y - sh.y; if (Math.hypot(dx, dy) > 6) { mx = clamp(dx / 22, -1, 1); my = clamp(dy / 22, -1, 1); } }
    if (p.pressed && p.x >= 800 && p.x <= 892 && p.y >= 12 && p.y <= 48) { this.restart(); return; }
    if (input.pressed("restart")) { this.restart(); return; }
    const nova = input.pressed("jump") || input.pressed("alt") || input.pressed("fire");
    this.tilt += (my - this.tilt) * Math.min(1, dt * 10);
    step(this.S, dt, { mx, my, nova }); this.handleEvents();
  }

  draw(g, env) {
    const S = this.S, t = this.t;
    if (this.bd) this.bd.draw(g, 0, 0, t, 960, 540, { camX: t * 140 });
    if (!this.bare) { g.fillStyle = "rgba(4,6,20,.22)"; g.fillRect(0, 0, 960, 540); }
    g.save();
    if (this.shake > 0) g.translate((Math.random() - 0.5) * 9 * Math.min(1, this.shake / 0.3), (Math.random() - 0.5) * 9 * Math.min(1, this.shake / 0.3));
    for (const p of S.pk) A.drawPickup(g, p, t);
    for (const e of S.en) A.drawEnemy(g, e.type, e.x, e.y, e.r, t + e.id, { hit: e.hit, id: e.id, vy: e.vy });
    for (const b of S.bullets) A.drawShot(g, b);
    if (S.status !== "lost") A.drawShip(g, S.ship.x, S.ship.y, t, { inv: S.ship.inv, wl: S.ship.wl, tilt: this.tilt });
    for (const b of S.eb) A.drawBullet(g, b, t);
    if (this.novaFx > 0) A.drawNova(g, this.novaAt[0], this.novaAt[1], 1 - this.novaFx / 0.6);
    this.fx.draw && this.fx.draw(g); this.fl.draw && this.fl.draw(g);
    g.restore();
    if (this.bare) return;
    this.drawHud(g);
    if (this.state === "lost") this.drawLost(g);
  }

  drawHud(g) {
    const S = this.S, sh = S.ship, lv = this.lv;
    g.fillStyle = "rgba(4,8,26,.66)"; g.fillRect(0, 0, 960, 56); g.fillStyle = "rgba(150,200,255,.25)"; g.fillRect(0, 55, 960, 1.5);
    text(g, `${lv.id}  ${lv.name}`, 18, 24, { size: 18, color: "#fff", font: FONT_DISPLAY, weight: 800 });
    for (let i = 0; i < SHIP.hpMax; i++) heart(g, 24 + i * 24, 42, 9, i < sh.hp ? "#ff5a6e" : "rgba(255,255,255,.14)", i < sh.hp ? "#2a0a14" : null, 1.5);
    hudChip(g, 258, 10, "NOVA", `${sh.nova}`, "#d9a8ff", 84);
    // weapon level bars
    text(g, "WEAPON", 360, 20, { size: 10.5, color: "#9fd0ff", font: FONT_BODY, weight: 700 });
    for (let i = 0; i < 5; i++) fillRR(g, 360 + i * 18, 28, 15, 12, 3, i < sh.wl ? "#ffa63a" : "rgba(255,255,255,.14)", "rgba(0,0,0,.4)", 1);
    hudChip(g, 470, 10, "SCORE", `${S.score}`, "#ffe27a", 150);
    if (S.combo >= 3) text(g, `x${(1 + Math.min(S.combo, 10) * 0.1).toFixed(1)} combo`, 545, 50, { size: 12, color: "#ffd34a", align: "center", font: FONT_BODY, weight: 700 });
    this.button(g, this.btn.restart, "Restart");
    // boss bar
    const boss = S.en.find((e) => ENEMIES[e.type].boss);
    if (boss) { fillRR(g, 280, 506, 400, 12, 6, "rgba(0,0,0,.6)", "rgba(255,255,255,.3)", 1.2); fillRR(g, 282, 508, Math.max(6, 396 * boss.hp / boss.hpMax), 8, 4, "#ff5a6e", null); text(g, "BOSS", 270, 516, { size: 11, color: "#ffb0b8", align: "right", font: FONT_BODY, weight: 800 }); }
    if (this.hintLines.length && this.t < 12) this.hintLines.forEach((ln, i) => text(g, ln, 480, 505 + i * 15, { size: 12.5, color: "#e6f2ff", align: "center", font: FONT_BODY, weight: 600, stroke: "#050a20", strokeW: 4 }));
    if (this.bannerT > 0) { g.save(); g.globalAlpha = clamp(Math.min(this.bannerT / 0.4, 1), 0, 1) * (0.7 + 0.3 * Math.sin(this.t * 14)); text(g, this.banner, 480, 260, { size: 36, color: "#ff6a5a", align: "center", font: FONT_DISPLAY, weight: 900, stroke: "#2a0a08", strokeW: 7 }); g.restore(); }
  }
  button(g, r, label) { g.save(); fillRR(g, r.x, r.y, r.w, r.h, 12, "rgba(8,16,40,.72)", "rgba(150,200,255,.45)", 1.5); text(g, label, r.x + r.w / 2, r.y + 24, { size: 14.5, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 700 }); g.restore(); }
  drawLost(g) {
    const k = clamp(this.stateT / 0.5, 0, 1); g.save(); g.globalAlpha = k; g.fillStyle = "rgba(6,6,20,.6)"; g.fillRect(0, 56, 960, 484);
    text(g, "SHIP DOWN", 480, 270, { size: 58, color: "#ff8a7a", align: "center", font: FONT_DISPLAY, weight: 900, stroke: "#2a0a08", strokeW: 9 });
    this.button(g, { x: 380, y: 300, w: 200, h: 56 }, "Try again");
    text(g, "Press R to try again. Grab S pickups for shields and use Nova when boxed in.", 480, 384, { size: 13, color: "#c8dcff", align: "center", font: FONT_BODY, weight: 600 });
    g.restore();
  }
}
