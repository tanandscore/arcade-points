// Garden Guards: one play-through of one level. The rules live in sim.js; this class reads taps and keys, turns the rules' events into sound and sparks,
// and draws the lawn. It also runs "headless" (no drawing) so the tests can play whole levels through the same code the player uses.
import { COLS, ROWS, PLANTS, createState, step, canPlace, place, shovel, collect, plantAt, stars as starsOf, scoreOf } from "./sim";
import { botAct, newBrain } from "./bot";
import * as A from "./art";
import { WORLDS } from "./levels";
import { clamp, lerp, TAU } from "../../core/util";
import { Particles, FX, Floaters } from "../../core/fx";
import { Backdrop } from "../../core/backdrop";
import { text, wrapText, fillRR, circle, glow, makeCanvas, FONT_DISPLAY, FONT_BODY } from "../../core/draw";
import { sfx as realSfx } from "../../core/audio";

const NOOP = new Proxy({}, { get: () => () => {} });
export const NO_INPUT = { pointer: { x: -99, y: -99, down: false, pressed: false, released: false, inside: false, type: "mouse" }, pressed: () => false, held: () => false, axis: () => 0, keyPressed: () => false };

export const X0 = 70, Y0 = 92, CW = 91, CH = 78;
const CARD = { x: 128, y: 8, w: 78, h: 68, gap: 5 };
const BD = new Map();
const backdropFor = (theme, seed) => { let b = BD.get(theme); if (!b) { b = new Backdrop(theme, seed); BD.set(theme, b); } return b; };
export const cellCenter = (col, row) => [X0 + col * CW + CW / 2, Y0 + row * CH + CH / 2];

export class GardenSession {
  constructor(lv, ctx = {}, opts = {}) {
    this.lv = lv; this.ctx = ctx; this.headless = !!opts.headless; this.quiet = this.headless || !!opts.quiet; this.bare = !!opts.bare; this.demo = !!opts.demo;
    this.sfx = this.quiet ? NOOP : realSfx;
    this.world = WORLDS[lv.wi]; this.look = A.LOOKS[lv.wi % 4]; this.accent = ctx.accent || "#8ae234";
    this.S = createState(lv); this.t = 0; this.done = null; this.state = "play"; this.stateT = 0;
    this.sel = -1; this.shov = false; this.drag = false; this.toggleOff = false; this.speed = 1; this.shake = 0; this.placed = 0; this.shootT = 0; this.hitT = 0; this.bannerT = 0; this.banner = "";
    this.brain = this.demo ? newBrain() : null; this.hover = null;
    const rec = ctx.save && ctx.save.levels ? ctx.save.levels[lv.id] : null; this.firstTime = !(rec && (rec.stars > 0 || rec.best > 0));
    this.btn = { shovel: { x: 636, y: 12, w: 78, h: 56 }, speed: { x: 722, y: 12, w: 66, h: 56 }, restart: { x: 800, y: 12, w: 92, h: 36 } };
    this.hintLines = []; this.flagShown = false; this.bossShown = false;
    if (this.headless) { this.fx = NOOP; this.fl = NOOP; return; }
    this.fx = new Particles(600); this.fl = new Floaters();
    this.bd = this.bare ? null : backdropFor(this.world.theme, (lv.wi + 1) * 9 + 1);
    if (lv.hint && this.firstTime) this.hintLines = wrapText(makeCanvas(4, 4).getContext("2d"), lv.hint, 780, 13, FONT_BODY, 500).slice(0, 2);
  }

  // ---------------------------------------------------------------------------------------------------------------- actions
  cardRect(i) { return { x: CARD.x + i * (CARD.w + CARD.gap), y: CARD.y, w: CARD.w, h: CARD.h }; }
  select(i) {
    const S = this.S, type = S.lv.cards[i]; if (!type) return;
    this.shov = false;
    if (this.sel === i) { this.sel = -1; this.sfx.back(); return; }
    if (S.cool[type] > 0) { this.sfx.empty(); this.fl.add(this.cardRect(i).x + CARD.w / 2, 94, "Recharging…", "#c3bbea", 14); return; }
    if (S.dew < PLANTS[type].cost) { this.sfx.empty(); this.fl.add(this.cardRect(i).x + CARD.w / 2, 94, "Need more dew", "#9ef3ff", 14); this.sel = i; return; }
    this.sel = i; this.sfx.click();
  }
  tapCell(col, row) {
    const S = this.S;
    if (this.shov) { if (shovel(S, col, row)) { this.sfx.back(); const [x, y] = cellCenter(col, row); FX.dust(this.fx, x, y + 14, 6, "rgba(120,80,40,.8)"); } else this.sfx.empty(); return; }
    if (this.sel < 0) return;
    const type = S.lv.cards[this.sel];
    if (canPlace(S, type, col, row)) { place(S, type, col, row); this.placed++; this.sel = -1; }
    else { this.sfx.empty(); const [x, y] = cellCenter(col, row); if (S.dew < PLANTS[type].cost) this.fl.add(x, y - 20, "Need more dew", "#9ef3ff", 14); else if (plantAt(S, col, row)) this.fl.add(x, y - 20, "Taken", "#ffb8a8", 14); }
  }
  restart() { const keep = { speed: this.speed }; this.S = createState(this.lv); this.state = "play"; this.stateT = 0; this.sel = -1; this.shov = false; this.t = 0; this.placed = 0; this.flagShown = false; this.bossShown = false; if (this.fx.clear) this.fx.clear(); this.sfx.click(); this.speed = keep.speed; if (this.brain) this.brain = newBrain(); }

  finishWin() {
    const S = this.S, st = starsOf(S);
    this.done = {
      won: true, score: scoreOf(S), stars: st, time: Math.round(S.t), title: st === 3 ? "GARDEN SAVED!" : st === 2 ? "WELL DEFENDED!" : "GARDEN HELD!", sub: this.lv.name, delay: 1.0,
      lines: [["Garden carts used", `${S.cartsUsed} (3 stars needs 0)`], ["Defenders lost", `${S.plantsLost} (3 stars needs 3 or fewer)`], ["Gang beaten", `${S.kills}`], ["Dew collected", `${S.dewGot}`]],
    };
  }

  // ---------------------------------------------------------------------------------------------------------------- events
  handleEvents() {
    const S = this.S, evs = S.ev; if (!evs.length) return;
    for (const e of evs) {
      if (this.headless) continue;
      const cx = (c) => X0 + c * CW + CW / 2, cy = (r) => Y0 + r * CH + CH / 2;
      switch (e.k) {
        case "place": this.sfx.place(); FX.dust(this.fx, cx(e.col), cy(e.row) + 22, 6, "rgba(120,80,40,.75)"); break;
        case "shoot": if (this.shootT <= 0) { this.sfx.pop(); this.shootT = 0.09; } break;
        case "hit": if (this.hitT <= 0) { this.sfx.tick(); this.hitT = 0.07; } FX.sparks(this.fx, X0 + e.x * CW, cy(e.row), 3, e.frost ? "#bfeaff" : "#d8ff9a"); break;
        case "die": this.sfx.kill(); FX.pop(this.fx, X0 + e.x * CW, cy(e.row) + 4, "#a87ae8", 14); this.fl.add(X0 + e.x * CW, cy(e.row) - 24, e.type === "brute" ? "+50" : e.type === "queen" ? "+500" : "+10", "#ffe27a", 15); break;
        case "bite": this.sfx.punch(); break;
        case "plantdie": this.sfx.hurt(); FX.debris(this.fx, cx(e.col), cy(e.row), [PLANTS[e.type].color, "#3b9a3b"], 10, 0.9); break;
        case "boom": this.sfx.explode(); this.shake = 0.3; FX.explosion(this.fx, cx(e.col), cy(e.row), 1.1); break;
        case "dew": this.sfx.coin(); break;
        case "cart": this.sfx.alarm(); this.shake = 0.4; this.fl.add(80, cy(e.row) - 30, "Garden cart!", "#ff8a7a", 17); break;
        case "leap": this.sfx.whoosh(); break;
        case "spawn": if (e.boss) { this.sfx.alarm(); this.banner = "THE GLOOM QUEEN ARRIVES!"; this.bannerT = 3; } break;
        case "win": this.state = "winning"; this.stateT = 0; this.sfx.star(); FX.confetti(this.fx, 480, 260, 70); break;
        case "lose": this.state = "lost"; this.stateT = 0; this.sfx.lose(); break;
        default: break;
      }
    }
    if (this.headless) { for (const e of evs) { if (e.k === "win") { this.state = "winning"; this.stateT = 0; } if (e.k === "lose") { this.state = "lost"; this.stateT = 0; } } }
    evs.length = 0;
  }

  // ---------------------------------------------------------------------------------------------------------------- update
  update(dt, input, env) {
    this.t += dt; this.stateT += dt;
    this.fx.update && this.fx.update(dt); this.fl.update && this.fl.update(dt);
    if (this.shootT > 0) this.shootT -= dt; if (this.hitT > 0) this.hitT -= dt; if (this.shake > 0) this.shake -= dt; if (this.bannerT > 0) this.bannerT -= dt;
    if (this.state === "winning") { this.runSim(dt, 1); if (this.stateT > 1.3 && !this.done) this.finishWin(); return; }
    if (this.state === "lost") { this.handleButtons(input); return; }
    if (this.demo) { botAct(this.S, this.brain); this.runSim(dt, 2); if (this.state !== "play") { if (this.stateT > 2.2) this.restart(); } return; }
    this.handleInput(input);
    this.runSim(dt, this.speed);
    const S = this.S, lv = this.lv;
    if (lv.flagAt && !this.flagShown && S.t > lv.flagAt - 5) { this.flagShown = true; this.banner = "A HUGE WAVE IS COMING!"; this.bannerT = 3; this.sfx.alarm(); }
  }
  runSim(dt, n) { for (let i = 0; i < n; i++) { step(this.S, dt); this.handleEvents(); if (this.state !== "play" && !this.demo) break; } }

  handleButtons(input) {
    const p = input.pointer, hit = (r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    if (input.pressed("restart")) { this.restart(); return; }
    if (p.pressed && (hit(this.btn.restart) || (p.x >= 380 && p.x <= 580 && p.y >= 300 && p.y <= 356))) this.restart();
  }

  handleInput(input) {
    const p = input.pointer, S = this.S, hit = (r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    const cellOf = () => { const c = Math.floor((p.x - X0) / CW), r = Math.floor((p.y - Y0) / CH); return c >= 0 && c < COLS && r >= 0 && r < ROWS ? [c, r] : null; };
    this.hover = p.inside ? cellOf() : null;
    if (input.pressed("restart")) { this.restart(); return; }
    for (let i = 0; i < S.lv.cards.length; i++) if (input.keyPressed("Digit" + (i + 1))) this.select(i);
    if (input.keyPressed("KeyX")) { this.shov = !this.shov; this.sel = -1; this.sfx.click(); }
    if (input.keyPressed("KeyF")) { this.speed = this.speed === 1 ? 2 : 1; this.sfx.click(); }
    // dew drops: touch or sweep over them to collect
    if (p.down || p.pressed) for (let i = 0; i < S.drops.length; i++) { const d = S.drops[i]; if (d.fly >= 0) continue; const [dx, dy] = this.dropPos(d); if (Math.hypot(p.x - dx, p.y - dy) < 30) { collect(S, i); } }
    if (p.pressed) {
      if (hit(this.btn.restart)) { this.restart(); return; }
      if (hit(this.btn.shovel)) { this.shov = !this.shov; this.sel = -1; this.sfx.click(); return; }
      if (hit(this.btn.speed)) { this.speed = this.speed === 1 ? 2 : 1; this.sfx.click(); return; }
      for (let i = 0; i < S.lv.cards.length; i++) if (hit(this.cardRect(i))) { const was = this.sel === i; this.select(i); this.drag = this.sel === i; this.toggleOff = was; this.dragFrom = i; return; }
      const c = cellOf(); if (c && !S.drops.some((d, i) => d.fly < 0 && Math.hypot(p.x - this.dropPos(d)[0], p.y - this.dropPos(d)[1]) < 30)) this.tapCell(c[0], c[1]);
    }
    if (p.released && this.drag) {
      this.drag = false; const c = cellOf();
      if (c && this.sel >= 0) this.tapCell(c[0], c[1]);
      else if (this.toggleOff && hit(this.cardRect(this.dragFrom))) { this.sel = -1; this.sfx.back(); }
    }
  }

  dropPos(d) {
    const [bx, by] = d.plant ? cellCenter(d.col, d.row) : [X0 + d.x * CW, lerp(-20, d.gy, clamp(d.t / 5, 0, 1))];
    let x = bx, y = by;
    if (d.plant) { const u = clamp(d.t / 0.5, 0, 1); y = by - 12 - Math.sin(u * Math.PI) * 16 + u * 22; x = bx + 14 * u; }
    if (d.fly >= 0) { const u = clamp(d.fly / 0.35, 0, 1); x = lerp(x, 68, u); y = lerp(y, 40, u); }
    return [x, y];
  }

  // ---------------------------------------------------------------------------------------------------------------- drawing
  draw(g, env) {
    const S = this.S, t = this.t, look = this.look;
    if (this.bd) this.bd.draw(g, 0, 0, t, 960, 540, {});
    if (!this.bare) { g.fillStyle = "rgba(10,20,10,.30)"; g.fillRect(0, 0, 960, 540); }
    g.save();
    if (this.shake > 0) g.translate((Math.random() - 0.5) * 8 * (this.shake / 0.3), (Math.random() - 0.5) * 8 * (this.shake / 0.3));
    fillRR(g, X0 - 6, Y0 - 6, COLS * CW + 12, ROWS * CH + 12, 14, "rgba(10,25,12,.65)", "rgba(190,240,170,.35)", 2);
    g.save(); g.beginPath(); g.rect(X0, Y0, COLS * CW, ROWS * CH); g.clip();
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) g.drawImage(A.lawnTile(look, CW, CH, (r + c) & 1), X0 + c * CW, Y0 + r * CH, CW, CH);
    g.restore();
    // hover preview
    if (this.hover && (this.sel >= 0 || this.shov) && !this.bare) {
      const [c, r] = this.hover, ok = this.shov ? !!plantAt(S, c, r) : canPlace(S, S.lv.cards[this.sel], c, r);
      g.fillStyle = ok ? "rgba(255,255,255,.22)" : "rgba(255,80,80,.22)"; g.fillRect(X0 + c * CW + 2, Y0 + r * CH + 2, CW - 4, CH - 4);
      if (this.sel >= 0 && ok) { g.globalAlpha = 0.5; const [x, y] = cellCenter(c, r); A.drawPlant(g, S.lv.cards[this.sel], x, y, CH, t, {}); g.globalAlpha = 1; }
    }
    // row by row: carts, defenders, the Gang
    for (let r = 0; r < ROWS; r++) {
      const cart = S.carts[r]; if (!cart.used || cart.run) { const [, y] = cellCenter(0, r); A.drawCart(g, X0 + cart.x * CW, y + 4, CH * 0.9, cart.run, t); }
      for (const p of S.plants) if (p.row === r) {
        const [x, y] = cellCenter(p.col, r), d = PLANTS[p.type];
        const st = { hit: p.hit, burst: p.burst, t0: p.id * 0.7, hp: p.hp / p.hpMax };
        if (p.type === "chili") st.fuse = 1 - Math.max(0, p.cd) / d.fuse; if (p.type === "dew") st.fuse = 1 - Math.max(0, p.cd) / d.make;
        A.drawPlant(g, p.type, x, y, CH, t, st);
      }
      const row = S.enemies.filter((e) => e.row === r).sort((a, b) => b.x - a.x);
      for (const e of row) {
        const [, y] = cellCenter(0, r), c = Math.floor(e.x - 0.4), eating = c >= 0 && c < COLS && plantAt(S, c, r) && e.x - 0.4 <= c + 0.88 && e.leapT <= 0;
        A.drawEnemy(g, e.type, X0 + e.x * CW, y, CH, t, { id: e.id, hit: e.hit, slow: e.slow, eating, leap: e.leapT > 0 ? 1 - e.leapT / 0.55 : null, hpf: e.hp / e.hpMax });
      }
      for (const s of S.shots) if (s.row === r) { const [, y] = cellCenter(0, r); A.drawSeed(g, X0 + s.x * CW, y - 6, s.frost); }
    }
    for (const d of S.drops) { const [x, y] = this.dropPos(d); A.drawDrop(g, x, y, t, d.fly, d.fly >= 0 ? 1 - clamp(d.fly / 0.35, 0, 1) * 0.4 : 1); }
    this.fx.draw && this.fx.draw(g); this.fl.draw && this.fl.draw(g);
    g.restore();
    if (this.bare) return;
    this.drawHud(g);
    if (this.state === "lost") this.drawLost(g);
  }

  drawHud(g) {
    const S = this.S, lv = this.lv, t = this.t;
    g.fillStyle = "rgba(10,25,12,.7)"; g.fillRect(0, 0, 960, 84); g.fillStyle = "rgba(190,240,170,.28)"; g.fillRect(0, 83, 960, 1.5);
    // dew counter
    fillRR(g, 12, 10, 108, 64, 14, "rgba(10,30,45,.8)", "rgba(143,227,255,.6)", 2); A.drawDrop(g, 36, 34, t, -1, 0.9);
    text(g, `${Math.floor(S.dew)}`, 82, 46, { size: 26, color: "#e8fbff", align: "center", font: FONT_DISPLAY, weight: 900 });
    text(g, `${lv.id}  ${lv.name}`, 66, 66, { size: 10.5, color: "#9ef3ff", align: "center", font: FONT_BODY, weight: 700 });
    // seed cards
    S.lv.cards.forEach((type, i) => {
      const r = this.cardRect(i), d = PLANTS[type], afford = S.dew >= d.cost, cool = S.cool[type] / d.cd, sel = this.sel === i;
      fillRR(g, r.x, r.y + (sel ? -2 : 0), r.w, r.h, 12, sel ? "rgba(60,90,40,.95)" : "rgba(20,40,24,.9)", sel ? this.accent : "rgba(190,240,170,.35)", sel ? 3 : 1.5);
      g.save(); g.beginPath(); g.rect(r.x + 3, r.y + 3 + (sel ? -2 : 0), r.w - 6, r.h - 24); g.clip(); g.globalAlpha = afford && cool <= 0 ? 1 : 0.7; A.drawPlant(g, type, r.x + r.w / 2, r.y + 30 + (sel ? -2 : 0), 54, 0, {}); g.restore();
      if (cool > 0) { g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(r.x + 3, r.y + 3, r.w - 6, (r.h - 6) * cool); }
      text(g, `${d.cost}`, r.x + r.w / 2 + 6, r.y + r.h - 6, { size: 14, color: afford ? "#bff1ff" : "#ff9a8a", align: "center", font: FONT_DISPLAY, weight: 800 });
      A.drawDrop(g, r.x + r.w / 2 - 12, r.y + r.h - 11, 0, -1, 0.34);
      text(g, `${i + 1}`, r.x + 9, r.y + 14, { size: 11, color: "rgba(255,255,255,.65)", font: FONT_BODY, weight: 700 });
    });
    this.hudButton(g, this.btn.shovel, this.shov ? "Digging…" : "Shovel", this.shov); this.hudButton(g, this.btn.speed, this.speed === 2 ? "x2 fast" : "x1", this.speed === 2);
    this.hudButton(g, this.btn.restart, "Restart", false, 36);
    // wave bar
    const last = S.waves.length ? S.waves[S.waves.length - 1][0] : 1, prog = clamp(S.t / last, 0, 1), bx = X0, bw = COLS * CW, by = 488;
    fillRR(g, bx, by, bw, 14, 7, "rgba(0,0,0,.5)", "rgba(190,240,170,.3)", 1.2); fillRR(g, bx + 1, by + 1, Math.max(8, (bw - 2) * prog), 12, 6, this.accent, null);
    for (const m of lv.marks) { const x = bx + bw * clamp(m / last, 0, 1); g.fillStyle = "#ff6a5a"; g.fillRect(x - 1.5, by - 3, 3, 20); }
    if (lv.bossAt) { const x = bx + bw * clamp(lv.bossAt / last, 0, 1); g.fillStyle = "#ffd34a"; g.fillRect(x - 1.5, by - 4, 3, 20); }
    text(g, `Gang left: ${S.waves.length - S.wi + S.enemies.length}`, bx + bw / 2, by + 11, { size: 10.5, color: "#fff", align: "center", font: FONT_BODY, weight: 700, stroke: "#0a1a0c", strokeW: 3 });
    // hints and banners
    if (this.hintLines.length && (this.placed < 3 || this.t < 14)) this.hintLines.forEach((ln, i) => text(g, ln, 480, 519 + i * 14, { size: 12.5, color: "#eaf7d8", align: "center", font: FONT_BODY, weight: 600, stroke: "#0a1a0c", strokeW: 4 }));
    else text(g, this.shov ? "Tap a defender to dig it up (you get a quarter of the dew back)." : this.sel >= 0 ? "Tap a square to plant it." : "Tap a seed card, then a square. Tap falling dew to collect it.", 480, 519, { size: 12, align: "center", color: "#d6ecc8", font: FONT_BODY, weight: 600, stroke: "#0a1a0c", strokeW: 3 });
    if (this.bannerT > 0) { const k = Math.min(1, this.bannerT / 0.4, (3 - this.bannerT) / 0.3 + 0.2); g.save(); g.globalAlpha = clamp(k, 0, 1); text(g, this.banner, 480, 300, { size: 44, color: "#ff6a5a", align: "center", font: FONT_DISPLAY, weight: 900, stroke: "#2a0a08", strokeW: 8 }); g.restore(); }
  }

  hudButton(g, r, label, on, ty) {
    g.save(); fillRR(g, r.x, r.y, r.w, r.h, 12, on ? "rgba(60,90,40,.95)" : "rgba(14,30,18,.75)", on ? this.accent : "rgba(190,240,170,.4)", 1.5);
    text(g, label, r.x + r.w / 2, r.y + (ty || r.h) / 2 + 6, { size: 13.5, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 700 }); g.restore();
  }

  drawLost(g) {
    const k = clamp(this.stateT / 0.5, 0, 1); g.save(); g.globalAlpha = k;
    g.fillStyle = "rgba(10,10,20,.6)"; g.fillRect(0, 84, 960, 456);
    text(g, "THE GANG GOT IN", 480, 270, { size: 54, color: "#ff8a7a", align: "center", font: FONT_DISPLAY, weight: 900, stroke: "#2a0a08", strokeW: 9 });
    this.hudButton(g, { x: 380, y: 300, w: 200, h: 56 }, "Try again", true);
    text(g, "Press R to try again. More defenders in the lanes they use!", 480, 384, { size: 13, color: "#d6ecc8", align: "center", font: FONT_BODY, weight: 600 });
    g.restore();
  }
}
