// Ember Deck: one battle. The rules live in rules.js; this class handles the card pick before the fight, clicking cards and enemies, the enemy turn
// (one enemy acts at a time), sound and sparks, and the drawing. It also runs "headless" (no drawing) so tests can play whole battles.
import { CARDS, ENEMIES, createState, playCard, canPlay, needsTarget, alive, endPlayerTurn, enemyAct, intentDamage, stars as starsOf, scoreOf, HERO } from "./rules";
import { WORLDS, draftOptions } from "./levels";
import { botTurn } from "./bot";
import * as A from "./art";
import { clamp, lerp } from "../../core/util";
import { Particles, FX, Floaters } from "../../core/fx";
import { Backdrop } from "../../core/backdrop";
import { text, wrapText, fillRR, circle, glow, makeCanvas, OUT, FONT_DISPLAY, FONT_BODY } from "../../core/draw";
import { sfx as realSfx } from "../../core/audio";

const NOOP = new Proxy({}, { get: () => () => {} });
export const NO_INPUT = { pointer: { x: -99, y: -99, down: false, pressed: false, released: false, inside: false, type: "mouse" }, pressed: () => false, held: () => false, axis: () => 0, keyPressed: () => false };
const BD = new Map();
const backdropFor = (theme, seed) => { let b = BD.get(theme); if (!b) { b = new Backdrop(theme, seed); BD.set(theme, b); } return b; };
const CW = 112, CH = 150, HAND_Y = 384, HERO_X = 150, HERO_Y = 262;
export const enemyX = (n, i) => (n === 1 ? 650 : n === 2 ? 560 + i * 200 : 470 + i * 170);

export class EmberSession {
  constructor(lv, ctx = {}, opts = {}) {
    this.lv = lv; this.ctx = ctx; this.headless = !!opts.headless; this.quiet = this.headless || !!opts.quiet; this.bare = !!opts.bare; this.demo = !!opts.demo;
    this.sfx = this.quiet ? NOOP : realSfx; this.world = WORLDS[lv.wi]; this.accent = ctx.accent || "#ff5d73";
    this.attempt = opts.attempt != null ? opts.attempt : ((ctx.save && ctx.save.stats && ctx.save.stats.plays) || 0); this.restarts = 0;
    this.t = 0; this.done = null; this.stateT = 0; this.sel = -1; this.hover = -1; this.pick = null; this.eTimer = 0; this.acting = null; this.actT = 0; this.shake = 0; this.heroHit = 0; this.heroLunge = 0;
    this.pos = []; this.endT = 0; this.shown = {}; this.bannerT = 0;
    this.btn = { restart: { x: 800, y: 12, w: 92, h: 36 }, end: { x: 790, y: 452, w: 140, h: 56 } };
    this.drafts = opts.draft === false || this.demo ? [] : draftOptions(lv, this.attempt);
    this.state = this.drafts.length ? "draft" : "play";
    if (!this.headless) { this.fx = new Particles(400); this.fl = new Floaters(); this.bd = this.bare ? null : backdropFor(this.world.theme, (lv.wi + 1) * 13 + 5); } else { this.fx = NOOP; this.fl = NOOP; }
    this.hintLines = []; const rec = ctx.save && ctx.save.levels ? ctx.save.levels[lv.id] : null; this.firstTime = !(rec && (rec.stars > 0 || rec.best > 0));
    if (!this.headless && lv.hint && this.firstTime) this.hintLines = wrapText(makeCanvas(4, 4).getContext("2d"), lv.hint, 800, 13, FONT_BODY, 500).slice(0, 2);
    this.extra = null; this.begin();
  }
  seed() { return this.lv.seedBase + this.attempt * 17 + this.restarts * 5; }
  begin() { this.S = createState(this.lv, this.lv.deck.concat(this.extra ? [this.extra] : []), this.seed()); this.pos = []; this.processEvents(); }
  chooseDraft(card) { this.extra = card; this.begin(); this.state = "play"; this.stateT = 0; this.sfx.card(); }
  restart() { this.restarts++; this.begin(); this.state = "play"; this.stateT = 0; this.sel = -1; this.acting = null; this.eTimer = 0; this.done = null; this.sfx.click(); }

  finishWin() {
    const S = this.S, st = starsOf(S);
    this.done = {
      won: true, score: scoreOf(S), stars: st, time: Math.round(this.t), title: st === 3 ? "FLAWLESS VICTORY!" : st === 2 ? "VICTORY!" : "SURVIVED!", sub: this.lv.name, delay: 1.0,
      lines: [["Health left", `${S.hero.hp} / ${S.hero.max} (3 stars at ${Math.ceil(S.hero.max * 0.6)} or more)`], ["Turns", `${S.turn}`], ["Cards played", `${S.played}`]],
    };
  }

  // ---------------------------------------------------------------------------------------------------------------- events
  processEvents() {
    const S = this.S; if (!S) return;
    for (const e of S.ev) {
      if (this.headless) continue;
      const n = S.en.length, ex = (i) => enemyX(n, i), ey = 250;
      switch (e.k) {
        case "play": this.sfx.card(); break;
        case "edmg": if (e.amount > 0) { this.sfx.impact(); this.fl.add(ex(e.i), ey - 50, `-${e.amount}`, "#ffe27a", 22); FX.sparks(this.fx, ex(e.i), ey, 8, "#ffd9a0"); } else if (e.blocked > 0) { this.sfx.bump(); this.fl.add(ex(e.i), ey - 50, "Blocked", "#9fd0ff", 16); } this.shown["e" + e.i] = 0.15; break;
        case "edie": this.sfx.kill(); FX.pop(this.fx, ex(e.i), ey, "#ff8a3a", 18); this.shown["d" + e.i] = 0.0001; break;
        case "hdmg": if (e.amount > 0) { this.sfx.hurt(); this.fl.add(HERO_X, HERO_Y - 70, `-${e.amount}`, "#ff6a6a", 24); this.shake = 0.25; this.heroHit = 0.3; FX.sparks(this.fx, HERO_X, HERO_Y, 8, "#ff9a8a"); } else if (e.blocked > 0) { this.sfx.bump(); this.fl.add(HERO_X, HERO_Y - 70, "Blocked", "#9fd0ff", 16); } break;
        case "blk": this.sfx.place(); this.fl.add(HERO_X + 10, HERO_Y - 70, `+${e.amount} block`, "#9fd0ff", 16); break;
        case "heal": this.sfx.heal(); this.fl.add(HERO_X, HERO_Y - 70, `+${e.amount}`, "#7dffb0", 20); break;
        case "buff": this.sfx.powerup(); this.fl.add(HERO_X, HERO_Y - 70, "Stronger!", "#ffb04a", 16); break;
        case "win": this.sfx.star(); FX.confetti(this.fx, 480, 240, 60); break;
        case "lose": this.sfx.lose(); break;
        case "turn": if (S.turn > 1) this.sfx.tick(); break;
        default: break;
      }
    }
    S.ev.length = 0;
  }

  // ---------------------------------------------------------------------------------------------------------------- update
  handPos(i, n) { const gap = Math.min(CW + 8, 640 / Math.max(1, n)), x0 = 480 - (gap * (n - 1)) / 2 - CW / 2; return [x0 + i * gap, HAND_Y + (Math.abs(i - (n - 1) / 2)) * 3]; }
  update(dt, input, env) {
    this.t += dt; this.stateT += dt; this.fx.update && this.fx.update(dt); this.fl.update && this.fl.update(dt);
    if (this.shake > 0) this.shake -= dt; if (this.heroHit > 0) this.heroHit -= dt; if (this.heroLunge > 0) this.heroLunge -= dt * 3; if (this.bannerT > 0) this.bannerT -= dt;
    for (const k in this.shown) { this.shown[k] -= dt; if (k[0] === "d") { this.shown[k] += dt * 2.2; if (this.shown[k] > 1.2) delete this.shown[k]; } else if (this.shown[k] <= 0) delete this.shown[k]; }
    // hand cards glide to their places
    const S = this.S, n = S.hand.length;
    if (this.pos.length > n) this.pos.length = n;
    for (let i = 0; i < n; i++) { const [tx, ty] = this.handPos(i, n); if (!this.pos[i]) this.pos[i] = { x: 60, y: 520, lift: 0 }; const p = this.pos[i]; const k = Math.min(1, dt * 14); p.x += (tx - p.x) * k; p.y += (ty - p.y) * k; p.lift += ((i === this.hover && S.phase === "player" ? 22 : i === this.sel ? 30 : 0) - p.lift) * Math.min(1, dt * 16); }
    if (this.demo) { this.runDemo(dt); return; }
    if (this.state === "winning") { if (this.stateT > 1.3 && !this.done) this.finishWin(); return; }
    this.handleInput(input);
    if (this.state === "enemy") {
      this.eTimer -= dt; if (this.acting != null) { this.actT -= dt; if (this.actT <= 0) this.acting = null; }
      if (this.eTimer <= 0) { const e = enemyAct(S); this.processEvents(); if (e) { this.acting = e.i; this.actT = 0.4; this.eTimer = 0.75; if (e.intent && e.intent.atk) this.heroHit = 0.0; } else { this.eTimer = 0.15; } this.afterPhase(); }
    }
  }
  afterPhase() {
    const S = this.S;
    if (S.phase === "won" && this.state !== "winning") { this.state = "winning"; this.stateT = 0; }
    else if (S.phase === "lost" && this.state !== "lost") { this.state = "lost"; this.stateT = 0; }
    else if (S.phase === "player" && this.state === "enemy") { this.state = "play"; this.bannerT = 0.9; this.sel = -1; }
  }
  runDemo(dt) {
    // idle screen: a little battle plays itself
    const S = this.S; this.eTimer -= dt;
    if (this.eTimer > 0) return;
    if (this.state === "winning" || this.state === "lost") { if (this.stateT > 2.2) { this.restarts++; this.begin(); this.state = "play"; this.stateT = 0; this.acting = null; } return; }
    if (S.phase === "player") {
      const plays = botTurn(S, 1); this.processEvents();
      if (!plays.length) { endPlayerTurn(S); this.state = "enemy"; this.eTimer = 0.5; } else this.eTimer = 0.6;
    } else if (S.phase === "enemy") { const e = enemyAct(S); this.processEvents(); if (e) { this.acting = e.i; this.actT = 0.4; this.eTimer = 0.8; } else this.eTimer = 0.3; this.afterPhase(); if (S.phase === "player") this.state = "play"; }
    else this.afterPhase();
    this.afterPhase();
  }

  handleInput(input) {
    const p = input.pointer, S = this.S, hit = (r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    if (this.state === "draft") {
      this.hover = -1; const n = this.drafts.length, w = 150, h = 200, x0 = 480 - (n * w + (n - 1) * 24) / 2;
      this.draftHover = -1; this.drafts.forEach((id, i) => { const x = x0 + i * (w + 24); if (p.x >= x && p.x <= x + w && p.y >= 170 && p.y <= 170 + h) this.draftHover = i; });
      if (p.pressed) { if (this.draftHover >= 0) this.chooseDraft(this.drafts[this.draftHover]); else if (p.x >= 400 && p.x <= 560 && p.y >= 400 && p.y <= 448) this.chooseDraft(null); }
      if (input.keyPressed("Digit1") && this.drafts[0]) this.chooseDraft(this.drafts[0]); if (input.keyPressed("Digit2") && this.drafts[1]) this.chooseDraft(this.drafts[1]); if (input.keyPressed("Digit3") && this.drafts[2]) this.chooseDraft(this.drafts[2]);
      if (input.keyPressed("Escape") || input.keyPressed("KeyS")) this.chooseDraft(null);
      return;
    }
    if (input.pressed("restart")) { this.restart(); return; }
    if (this.state === "lost") { if (p.pressed && ((p.x >= 380 && p.x <= 580 && p.y >= 300 && p.y <= 356) || hit(this.btn.restart))) this.restart(); return; }
    if (p.pressed && hit(this.btn.restart)) { this.restart(); return; }
    if (this.state !== "play") return;
    // which card is under the pointer
    this.hover = -1; const n = S.hand.length;
    for (let i = n - 1; i >= 0; i--) { const q = this.pos[i]; if (q && p.x >= q.x && p.x <= q.x + CW && p.y >= q.y - q.lift && p.y <= q.y - q.lift + CH) { this.hover = i; break; } }
    const enemyAt = () => { const live = S.en; for (let i = 0; i < live.length; i++) { if (live[i].dead) continue; const x = enemyX(live.length, i); if (Math.abs(p.x - x) < 70 && p.y > 150 && p.y < 340) return i; } return -1; };
    for (let i = 0; i < Math.min(9, n); i++) if (input.keyPressed("Digit" + (i + 1))) this.clickCard(i);
    if (input.keyPressed("Enter") || input.keyPressed("KeyE")) { this.endTurn(); return; }
    if (input.keyPressed("Escape") && this.sel >= 0) { this.sel = -1; }
    if (p.pressed) {
      if (hit(this.btn.end)) { this.endTurn(); return; }
      if (this.hover >= 0) { this.clickCard(this.hover); return; }
      if (this.sel >= 0) { const ei = enemyAt(); if (ei >= 0) { this.playSel(ei); return; } this.sel = -1; this.sfx.back(); return; }
    }
  }
  clickCard(i) {
    const S = this.S; if (this.state !== "play" || i >= S.hand.length) return;
    if (this.sel === i) { this.sel = -1; this.sfx.back(); return; }
    if (!canPlay(S, i)) { this.sfx.empty(); this.fl.add(HERO_X, HERO_Y - 70, "Not enough energy", "#c3bbea", 14); return; }
    if (needsTarget(S, i)) { this.sel = i; this.sfx.click(); return; }
    this.sel = i; this.playSel(0);
  }
  playSel(target) {
    const S = this.S; const i = this.sel; this.sel = -1; if (i < 0) return;
    const live = alive(S); let ti = target; if (!S.en[ti] || S.en[ti].dead) ti = live[0].i;
    this.heroLunge = CARDS[S.hand[i]].t === "a" ? 1 : 0;
    playCard(S, i, ti); this.processEvents(); this.afterPhase();
  }
  endTurn() { const S = this.S; if (this.state !== "play" || S.phase !== "player") return; endPlayerTurn(S); this.processEvents(); this.state = "enemy"; this.eTimer = 0.45; this.sel = -1; this.sfx.click(); }

  // ---------------------------------------------------------------------------------------------------------------- drawing
  draw(g, env) {
    const S = this.S, t = this.t;
    if (this.bd) this.bd.draw(g, 0, 0, t, 960, 540, {});
    if (!this.bare) { g.fillStyle = "rgba(10,5,20,.50)"; g.fillRect(0, 0, 960, 540); }
    g.save();
    if (this.shake > 0) g.translate((Math.random() - 0.5) * 8 * (this.shake / 0.25), (Math.random() - 0.5) * 8 * (this.shake / 0.25));
    const n = S.en.length;
    // hero
    A.drawHero(g, HERO_X, HERO_Y, 110, t, { hit: this.heroHit > 0, lunge: Math.sin(clamp(this.heroLunge, 0, 1) * Math.PI) });
    this.drawBars(g, HERO_X, 346, S.hero, true);
    // enemies
    S.en.forEach((e, i) => {
      const x = enemyX(n, i), big = ENEMIES[e.type].boss ? 1.35 : ENEMIES[e.type].elite ? 1.15 : 1;
      const dd = this.shown["d" + i]; if (e.dead && dd == null) return;
      A.drawEnemy(g, e.type, x, 262, 100, t, { i, hit: this.shown["e" + i] > 0, dead: e.dead ? Math.min(1, dd) : 0, lunge: this.acting === i ? Math.sin(clamp(this.actT / 0.4, 0, 1) * Math.PI) : 0, big });
      if (!e.dead) { this.drawBars(g, x, 346, e, false); this.drawIntent(g, e, x, 150 - (big - 1) * 40); if (this.sel >= 0 && this.state === "play") { g.strokeStyle = "rgba(255,226,122," + (0.5 + 0.4 * Math.sin(t * 8)) + ")"; g.lineWidth = 3; g.beginPath(); g.ellipse(x, 300, 66 * big, 20, 0, 0, Math.PI * 2); g.stroke(); } }
    });
    this.fx.draw && this.fx.draw(g); this.fl.draw && this.fl.draw(g);
    g.restore();
    if (this.bare) return;
    this.drawHud(g);
    if (this.state === "draft") this.drawDraft(g);
    if (this.state === "lost") this.drawLost(g);
  }

  drawBars(g, x, y, o, hero) {
    const w = hero ? 150 : 120, h = 14;
    fillRR(g, x - w / 2, y, w, h, 7, "rgba(0,0,0,.6)", "rgba(255,255,255,.35)", 1.2);
    const f = clamp(o.hp / o.max, 0, 1); if (f > 0) fillRR(g, x - w / 2 + 1.5, y + 1.5, Math.max(6, (w - 3) * f), h - 3, 5, hero ? "#ff6a6a" : "#e0564a", null);
    text(g, `${Math.max(0, Math.ceil(o.hp))} / ${o.max}`, x, y + 11.5, { size: 11, color: "#fff", align: "center", font: FONT_BODY, weight: 800, stroke: "#200", strokeW: 3 });
    if (o.blk > 0) { A.iconShield(g, x - w / 2 - 12, y + 7, 28); text(g, `${o.blk}`, x - w / 2 - 12, y + 12, { size: 12, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 900, stroke: "#103", strokeW: 3 }); }
    // status chips
    const chips = []; if (o.str) chips.push([A.iconUp, `${o.str}`, "#ffb04a"]); if (o.vuln > 0) chips.push([A.iconCrack, `${o.vuln}`, "#d98aff"]); if (o.weak > 0) chips.push([A.iconDown, `${o.weak}`, "#a58aff"]); if (o.burn > 0) chips.push([A.iconFlame, `${o.burn}`, "#ff8a3a"]);
    chips.forEach(([ic, v, c], i) => { const cx = x - w / 2 + 14 + i * 38, cy = y + 30; ic(g, cx, cy, 22); text(g, v, cx + 14, cy + 8, { size: 12, color: c, align: "center", font: FONT_DISPLAY, weight: 900, stroke: "#100", strokeW: 3 }); });
  }

  drawIntent(g, e, x, y) {
    const m = e.intent; if (!m) return;
    const parts = [];
    if (m.atk) { const d = intentDamage(this.S, e); parts.push([A.iconSword, m.hits > 1 ? `${d / m.hits}x${m.hits}` : `${d}`, "#ff9a8a"]); }
    if (m.blk) parts.push([A.iconShield, `${m.blk}`, "#9fd0ff"]); if (m.str) parts.push([A.iconUp, `+${m.str}`, "#ffb04a"]); if (m.weak) parts.push([A.iconDown, `${m.weak}`, "#a58aff"]); if (m.vuln) parts.push([A.iconCrack, `${m.vuln}`, "#d98aff"]);
    const w = 14 + parts.length * 56, bob = Math.sin(this.t * 4) * 2;
    fillRR(g, x - w / 2, y + bob - 20, w, 38, 14, "rgba(20,10,30,.82)", "rgba(255,255,255,.4)", 1.6);
    parts.forEach(([ic, v, c], i) => { const cx = x - w / 2 + 28 + i * 56; ic(g, cx, y + bob - 1, 26); text(g, v, cx + 16, y + bob + 6, { size: 16, color: c, font: FONT_DISPLAY, weight: 900, stroke: "#100", strokeW: 3 }); });
  }

  drawHud(g) {
    const S = this.S, lv = this.lv;
    g.fillStyle = "rgba(10,5,20,.7)"; g.fillRect(0, 0, 960, 56); g.fillStyle = "rgba(255,160,140,.25)"; g.fillRect(0, 55, 960, 1.5);
    text(g, `${lv.id}  ${lv.name}`, 18, 25, { size: 19, color: "#fff", font: FONT_DISPLAY, weight: 800 });
    text(g, `Turn ${S.turn}  ·  ${this.world.name}`, 18, 44, { size: 12, color: "#d6b8c8", font: FONT_BODY, weight: 600 });
    this.chip(g, 320, 12, "DRAW", `${S.draw.length}`, "#9fd0ff"); this.chip(g, 420, 12, "DISCARD", `${S.disc.length}`, "#ffb0a0"); this.chip(g, 520, 12, "EXHAUSTED", `${S.exh.length}`, "#c8a8ff", 110);
    this.button(g, this.btn.restart, "Restart", true, 36);
    // energy orbs
    const en = S.hero.energy, mx = Math.max(HERO.energy, en);
    for (let i = 0; i < mx; i++) { const x = 56 + i * 40, on = i < en; circle(g, x, 440, 17, on ? "#ffb02e" : "rgba(255,255,255,.12)", OUT, 2.4); if (on) { circle(g, x - 4, 435, 6, "rgba(255,255,255,.45)", null, 0); glow(g, x, 440, 28, "#ffb02e", 0.3); } }
    text(g, "ENERGY", 56, 472, { size: 11, color: "#ffd9a0", font: FONT_BODY, weight: 800 });
    // hand
    S.hand.forEach((id, i) => { const q = this.pos[i]; if (!q) return; drawCardAt(g, id, q, i, this); });
    // end turn
    const can = this.state === "play" && S.phase === "player", glowEnd = can && !S.hand.some((_, i) => canPlay(S, i));
    g.save(); g.globalAlpha = can ? 1 : 0.5; fillRR(g, this.btn.end.x, this.btn.end.y, this.btn.end.w, this.btn.end.h, 16, glowEnd ? "#d9482e" : "rgba(40,20,40,.9)", glowEnd ? "#ffd9a0" : "rgba(255,200,180,.5)", glowEnd ? 3 : 2);
    text(g, "End turn", this.btn.end.x + this.btn.end.w / 2, this.btn.end.y + 35, { size: 20, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 800 }); g.restore();
    if (this.state === "enemy") text(g, "Enemy turn…", 480, 100, { size: 20, color: "#ffb0a0", align: "center", font: FONT_DISPLAY, weight: 800, stroke: "#200", strokeW: 5 });
    else if (this.bannerT > 0) text(g, "Your turn", 480, 100, { size: 24, color: "#ffe27a", align: "center", font: FONT_DISPLAY, weight: 900, stroke: "#200", strokeW: 6, alpha: clamp(this.bannerT / 0.4, 0, 1) });
    if (this.hintLines.length && this.t < 16) this.hintLines.forEach((ln, i) => text(g, ln, 480, 86 + i * 15, { size: 12.5, color: "#f1e2d0", align: "center", font: FONT_BODY, weight: 600, stroke: "#100", strokeW: 4 }));
    else if (this.sel >= 0) text(g, "Click the enemy you want to target (or the card again to cancel).", 480, 100, { size: 13, color: "#ffe27a", align: "center", font: FONT_BODY, weight: 700, stroke: "#100", strokeW: 4 });
  }
  chip(g, x, y, label, val, c, w = 90) { fillRR(g, x, y, w, 36, 10, "rgba(20,10,30,.7)", "rgba(255,255,255,.25)", 1.4); text(g, label, x + 10, y + 14, { size: 9.5, color: "#bba", font: FONT_BODY, weight: 700 }); text(g, val, x + w - 10, y + 29, { size: 18, color: c, align: "right", font: FONT_DISPLAY, weight: 900 }); }
  button(g, r, label, on, ty) { g.save(); g.globalAlpha = on ? 1 : 0.45; fillRR(g, r.x, r.y, r.w, r.h, 12, "rgba(30,12,30,.75)", "rgba(255,200,180,.45)", 1.5); text(g, label, r.x + r.w / 2, r.y + (ty || r.h) / 2 + 6, { size: 14.5, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 700 }); g.restore(); }

  drawDraft(g) {
    g.fillStyle = "rgba(8,4,18,.82)"; g.fillRect(0, 56, 960, 484);
    text(g, "Add a card to your deck", 480, 120, { size: 34, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 900, stroke: "#200", strokeW: 7 });
    text(g, `Your deck has ${this.lv.deck.length} cards. Pick one more for this battle, or skip.`, 480, 148, { size: 14, color: "#d6b8c8", align: "center", font: FONT_BODY, weight: 600 });
    const n = this.drafts.length, w = 150, h = 200, x0 = 480 - (n * w + (n - 1) * 24) / 2;
    this.drafts.forEach((id, i) => drawCardRaw(g, id, x0 + i * (w + 24), 170, w, h, { hover: this.draftHover === i }));
    const hov = this.draftHover != null && this.draftHover >= 0;
    this.button(g, { x: 400, y: 400, w: 160, h: 48 }, "Skip", true);
    text(g, "Click a card, or press 1 2 3. S skips.", 480, 480, { size: 12.5, color: "#c9a9b9", align: "center", font: FONT_BODY, weight: 600 });
  }
  drawLost(g) {
    const k = clamp(this.stateT / 0.5, 0, 1); g.save(); g.globalAlpha = k; g.fillStyle = "rgba(10,5,20,.6)"; g.fillRect(0, 56, 960, 484);
    text(g, "DEFEATED", 480, 270, { size: 58, color: "#ff8a7a", align: "center", font: FONT_DISPLAY, weight: 900, stroke: "#2a0a08", strokeW: 9 });
    this.button(g, { x: 380, y: 300, w: 200, h: 56 }, "Try again", true);
    text(g, "Press R to try again. Block when an enemy shows a big attack!", 480, 384, { size: 13, color: "#e8d0d8", align: "center", font: FONT_BODY, weight: 600 }); g.restore();
  }
}

function drawCardAt(g, id, q, i, ses) {
  const S = ses.S, can = canPlay(S, i) && ses.state === "play";
  A.drawCard(g, id, q.x, q.y, CW, CH, { lift: q.lift, dim: !can, sel: ses.sel === i, glowing: can && ses.hover === i, tilt: (i - (S.hand.length - 1) / 2) * 0.025 });
}
function drawCardRaw(g, id, x, y, w, h, o) { A.drawCard(g, id, x, y, w, h, { lift: o.hover ? 10 : 0, glowing: o.hover }); }
