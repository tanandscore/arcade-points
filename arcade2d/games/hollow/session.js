// Hollow Deep: one floor of the dungeon. The rules live in sim.js and the pictures in art.js. This class reads the keyboard / touch buttons / mouse, turns what
// happens into sound, sparks and shaking, and draws the room and the top bar. It also runs headless (no drawing) for tests, and can be driven by the
// automatic hero (bot.js) behind the title screen.
import { makeState, step, starsOf, scoreOf, DT, MAX_HP, MAX_EN, ENEMY } from "./sim";
import { botInput, newBrain } from "./bot";
import { WORLDS } from "./levels";
import * as A from "./art";
import { clamp, TAU, lerp } from "../../core/util";
import { Particles, FX, Floaters } from "../../core/fx";
import { text, wrapText, fillRR, circle, makeCanvas, hudChip, star, heart, OUT, FONT_DISPLAY, FONT_BODY } from "../../core/draw";
import { sfx as realSfx } from "../../core/audio";

const NOOP = new Proxy({}, { get: () => () => {} });
export const NO_INPUT = { pointer: { x: -99, y: -99, down: false, pressed: false, released: false, inside: false, type: "mouse" }, pressed: () => false, held: () => false, released: () => false, keyPressed: () => false, axis: () => 0 };

export class HollowSession {
  constructor(lv, ctx = {}, opts = {}) {
    this.lv = lv; this.ctx = ctx; this.headless = !!opts.headless; this.quiet = this.headless || !!opts.quiet; this.bare = !!opts.bare; this.demo = !!opts.demo;
    this.sfx = this.quiet ? NOOP : realSfx; this.world = WORLDS[lv.wi]; this.look = A.LOOKS[lv.look]; this.accent = ctx.accent || "#8f7bff";
    this.t = 0; this.done = null; this.attempts = 1; this.timers = []; this.shake = 0; this.btn = { restart: { x: 800, y: 12, w: 92, h: 36 } }; this.hintLines = [];
    this.brain = this.demo ? newBrain() : null; this.botLag = opts.botLag || 0; this.botQ = []; this.manual = null;
    this.reset();
    const rec = ctx.save && ctx.save.levels ? ctx.save.levels[lv.id] : null; this.firstTime = !(rec && (rec.stars > 0 || rec.best > 0));
    if (this.headless) { this.fx = NOOP; this.fl = NOOP; return; }
    this.fx = new Particles(600); this.fl = new Floaters();
    if (lv.hint && this.firstTime) this.hintLines = wrapText(makeCanvas(4, 4).getContext("2d"), lv.hint, 780, 13, FONT_BODY, 500).slice(0, 2);
  }
  reset() { this.S = makeState(this.lv); this.state = "play"; this.stateT = 0; this.acc = 0; this.time = 0; this.timers = []; this.banner = null; this.winT = 0; this.botQ = []; if (this.brain) this.brain = newBrain(); }
  restart() { this.attempts++; this.reset(); this.sfx.click(); }
  later(t, fn) { if (!this.headless) this.timers.push([t, fn]); }

  // read the player's input
  readInput(input) {
    const p = input.pointer, over = p.y < 62 && p.x > 780;
    const o = { mx: input.axis("left", "right"), my: input.axis("up", "down"), swing: input.held("fire"), bolt: input.held("jump"), dash: input.pressed("alt") };
    if (p.type === "mouse" && p.down && !over && p.inside !== false && p.y > 60) { o.swing = true; o.aimX = p.x; o.aimY = p.y; }
    if (p.pressed && p.x >= this.btn.restart.x && p.x <= this.btn.restart.x + this.btn.restart.w && p.y >= this.btn.restart.y && p.y <= this.btn.restart.y + this.btn.restart.h) this.restart();
    return o;
  }

  update(dt, input, env) {
    for (let i = this.timers.length - 1; i >= 0; i--) { const tm = this.timers[i]; tm[0] -= dt; if (tm[0] <= 0) { this.timers.splice(i, 1); tm[1](); } }
    this.t += dt; this.stateT += dt; this.fx.update && this.fx.update(dt); this.fl.update && this.fl.update(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 18);
    if (this.state === "play") {
      let inp = this.demo ? botInput(this.S, this.brain) : this.readInput(input);
      if (this.manual) inp = this.manual;
      this.acc += dt;
      while (this.acc >= DT && this.state === "play") {
        let use = inp; if (this.botLag) { this.botQ.push(inp); use = this.botQ.length > this.botLag ? this.botQ.shift() : { mx: 0, my: 0 }; }
        step(this.S, use); this.afterEvents(); this.acc -= DT; inp = { ...inp, dash: false };
        if (this.S.state === "won") { this.state = "won"; this.stateT = 0; break; }
        if (this.S.state === "dead") { this.state = "dead"; this.stateT = 0; break; }
      }
      this.time = this.S.t;
    } else if (this.state === "won") { if (this.stateT > 1.1 && !this.done) this.finish(); }
    else if (this.state === "dead") {
      if (!this.demo && input.pressed("restart")) this.restart();
      else if (this.stateT > 1.6) this.restart();
    }
    if (this.state !== "won" && !this.demo && input.pressed("restart")) this.restart();
  }

  afterEvents() {
    const S = this.S, fx = this.fx, fl = this.fl, hl = this.headless;
    for (const e of S.events) {
      switch (e.k) {
        case "swing": this.sfx.swing(); break;
        case "enemyHit": this.sfx.impact(); if (!hl) { FX.sparks(fx, e.x, e.y, 6, "#fff1a8"); } break;
        case "kill": this.sfx.kill(); if (!hl) { FX.pop(fx, e.x, e.y, e.boss ? "#ffd54a" : "#c9b6ff", e.boss ? 30 : 10); fl.add(e.x, e.y - 14, "+" + e.gems, "#7dffe0", 15); if (e.boss) { FX.confetti(fx, e.x, e.y, 40); this.shake = 8; } } break;
        case "hurt": this.sfx.hurt(); this.shake = 6; if (!hl) { FX.pop(fx, e.x, e.y, "#ff5a6e", 12); fl.add(e.x, e.y - 20, "-1", "#ff5a6e", 20); } break;
        case "die": this.sfx.die(); if (!hl) FX.explosion(fx, e.x, e.y, 0.7); break;
        case "dash": this.sfx.whoosh(); if (!hl) FX.dust(fx, e.x, e.y, 6, "rgba(190,230,255,.8)"); break;
        case "bolt": this.sfx.laser(); break;
        case "boltEnd": if (!hl) FX.sparks(fx, e.x, e.y, 4, "#7dffe0"); break;
        case "arrow": this.sfx.swing(); break;
        case "orbs": this.sfx.pop(); break;
        case "deflect": this.sfx.impact(); if (!hl) { FX.sparks(fx, e.x, e.y, 6, "#ffffff"); fl.add(e.x, e.y - 10, "BLOCK", "#bfe9ff", 12); } break;
        case "telegraph": this.sfx.alarm(); break;
        case "slam": this.sfx.boom(); this.shake = e.big ? 9 : 5; if (!hl) FX.dust(fx, e.x, e.y, 10); break;
        case "blink": if (!hl) FX.pop(fx, e.x, e.y, "#9fe7ff", 12); break;
        case "chest": this.sfx.powerup(); if (!hl) { FX.confetti(fx, e.x, e.y - 10, 28); fl.add(e.x, e.y - 24, "RELIC! +25", "#ffd54a", 18); } break;
        case "heal": this.sfx.heal(); if (!hl) { FX.sparkle(fx, e.x, e.y); fl.add(e.x, e.y - 16, "+1 heart", "#ff8ad2", 14); } break;
        case "stairs": this.sfx.door(); if (!hl) fl.add(480, 120, "Stairs open!", "#7dffb5", 24, { life: 1.4 }); break;
        case "wave": if (!hl && e.n > 1) { this.banner = { t: 0, str: "WAVE " + e.n }; this.sfx.alarm(); } break;
        case "spawn": if (!hl) FX.pop(fx, e.x, e.y, "#c06bff", 6); break;
        case "win": this.sfx.win(); if (!hl) FX.confetti(fx, e.x, e.y, 36); break;
        case "step": if (!this.quiet && Math.random() < 0.4) this.sfx.step(); break;
      }
    }
  }

  finish() {
    const S = this.S, st = starsOf(S), score = Math.max(300, scoreOf(S) - (this.attempts - 1) * 80);
    this.done = {
      won: true, score, stars: st, time: Math.round(S.t), title: st === 3 ? "FLAWLESS FLOOR!" : st === 2 ? "FLOOR CLEARED!" : "ESCAPED!", sub: this.lv.name, delay: 1.0,
      lines: [["Monsters slain", `${S.kills}`], ["Relic chest", S.chestOpen ? "Opened ✓" : "Not found"], ["Hearts left", `${S.hero.hp} / ${MAX_HP} (3 stars needs 3)`], ["Gems", S.gems], ...(this.attempts > 1 ? [["Tries", this.attempts]] : [])],
    };
  }

  // ------------------------------------------------------------------------------------------------ draw
  draw(g, env) {
    const S = this.S, t = this.t, h = S.hero;
    g.save();
    if (this.shake > 0.1) g.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    g.drawImage(A.roomLayer(this.lv, S.F), 0, 0);
    for (const sp of S.F.spikes) A.drawSpike(g, S, sp, t);
    A.drawChest(g, S, t); A.drawStairs(g, S, t);
    for (const p of S.pickups) A.drawPickup(g, p, t);
    for (const r of S.rings) A.drawRing(g, r);
    const ents = [...S.enemies.map((e) => ({ y: e.y, e })), { y: h.y, hero: true }].sort((a, b) => a.y - b.y);
    for (const o of ents) { if (o.hero) { if (this.state !== "dead" || this.stateT < 0.5) { g.save(); g.translate(h.x, h.y); g.scale(1.25, 1.25); g.translate(-h.x, -h.y); A.drawHero(g, S, t, this.state); g.restore(); } } else { const e = o.e, k = ENEMY[e.type].boss ? 1.1 : 1.22; g.save(); g.translate(e.x, e.y); g.scale(k, k); g.translate(-e.x, -e.y); A.drawEnemy(g, e, t, S); g.restore(); } }
    for (const s of S.shots) A.drawShot(g, s, t); for (const b of S.bolts) A.drawBolt(g, b, t);
    this.fx.draw && this.fx.draw(g); this.fl.draw && this.fl.draw(g);
    // vignette
    const vg = g.createRadialGradient(480, 290, 260, 480, 290, 620); vg.addColorStop(0, "rgba(10,5,32,0)"); vg.addColorStop(1, "rgba(10,5,32,.45)"); g.fillStyle = vg; g.fillRect(0, 0, 960, 540);
    if (h.hurtT > 0) { g.fillStyle = `rgba(255,40,70,${h.hurtT * 0.45})`; g.fillRect(0, 0, 960, 540); }
    g.restore();
    if (this.bare) return;
    this.drawHud(g);
    for (const e of S.enemies) if (ENEMY[e.type].boss && e.spawn <= 0) A.drawBossBar(g, e);
    if (this.banner) { const b = this.banner; b.t += 1 / 60; if (b.t > 1.4) this.banner = null; else { g.save(); g.globalAlpha = clamp(Math.min(b.t * 5, (1.4 - b.t) * 3), 0, 1); text(g, b.str, 480, 150, { size: 46, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 900, stroke: "#150a33", strokeW: 8 }); g.restore(); } }
    if (this.state === "dead") { const k = clamp(this.stateT / 0.3, 0, 1); g.save(); g.globalAlpha = k; g.fillStyle = "rgba(10,5,32,.55)"; g.fillRect(0, 0, 960, 540); text(g, "You fell in the dark", 480, 270, { size: 42, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 900, stroke: "#150a33", strokeW: 8 }); text(g, "Back in a moment... (R to retry now)", 480, 304, { size: 15, color: "#d6ccff", align: "center", font: FONT_BODY, weight: 600 }); g.restore(); }
  }

  drawHud(g) {
    const lv = this.lv, S = this.S, h = S.hero;
    g.fillStyle = "rgba(10,5,32,.7)"; g.fillRect(0, 0, 960, 52); g.fillStyle = "rgba(190,180,255,.25)"; g.fillRect(0, 51, 960, 1.5);
    text(g, `${lv.id}  ${lv.name}`, 16, 23, { size: 18, color: "#fff", font: FONT_DISPLAY, weight: 800 });
    text(g, this.world.name, 16, 42, { size: 11, color: "#c3bbea", font: FONT_BODY, weight: 600 });
    // hearts and bolt charges
    for (let i = 0; i < MAX_HP; i++) { const on = i < h.hp; heart(g, 262 + i * 24, 22, 9.5, on ? "#ff3ea5" : "rgba(60,30,90,.8)", on ? OUT : "rgba(190,180,255,.4)", on ? 2 : 1.5); }
    for (let i = 0; i < MAX_EN; i++) { const on = i < h.en, x = 266 + i * 22, y = 41; g.save(); g.translate(x, y); g.rotate(Math.PI / 4); fillRR(g, -5, -5, 10, 10, 2, on ? "#7dffe0" : "rgba(60,30,90,.8)", on ? "#1d8f78" : "rgba(190,180,255,.4)", 1.6); g.restore(); }
    // the three goals as stars: clear the floor, open the relic chest, stay at 3+ hearts
    const goals = [S.stairsOpen || S.won, S.chestOpen, h.hp >= 3 && (S.stairsOpen || S.won)];
    for (let i = 0; i < 3; i++) star(g, 430 + i * 36, 27, 13, goals[i] ? "#ffc233" : "rgba(60,30,90,.8)", goals[i] ? OUT : "rgba(190,180,255,.4)", 2);
    const left = S.enemies.filter((e) => e.hp > 0).length;
    hudChip(g, 552, 9, "WAVE", `${Math.max(1, S.waveIdx + 1)}/${lv.waves.length}`, "#bfe9ff", 90); hudChip(g, 648, 9, "GEMS", S.gems, "#ffd54a", 94);
    const r = this.btn.restart; g.save(); fillRR(g, r.x, r.y, r.w, r.h, 12, "rgba(14,6,36,.7)", "rgba(190,180,255,.4)", 1.5); text(g, "Restart", r.x + r.w / 2, r.y + 24, { size: 14.5, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 700 }); g.restore();
    if (this.hintLines.length && this.t < 16) this.hintLines.forEach((ln, i) => text(g, ln, 480, 524 - (this.hintLines.length - 1 - i) * 16, { size: 13, color: "#f0eaff", align: "center", font: FONT_BODY, weight: 600, stroke: "#150a33", strokeW: 4 }));
    if (S.stairsOpen && !S.won && !S.chestOpen && this.t % 6 < 3 && left === 0) text(g, "A relic chest hides somewhere in the room (second star)", 480, 70, { size: 12, color: "#ffe9a8", align: "center", font: FONT_BODY, weight: 700, stroke: "#150a33", strokeW: 4 });
  }
}
