"use client";
// Lumen Trail — an HD-2D style turn-based role-playing game (Power Pass). Six chapters, four travellers, a break-and-boost battle system.
import { createKitGame } from "../shell/Kit";
import { Particles, Floaters, Juice } from "../core/fx";
import { makeCanvas, text, fillRR, circle, ellipse, bar, FONT_DISPLAY, FONT_BODY, OUT } from "../core/draw";
import { sfx as realSfx } from "../core/audio";
import { clamp, lerp, rng, TAU, shade, rgba, secondsLabel } from "../core/util";
import { HEROES, SKILLS, ITEMS, ENEMIES, CHAPTERS, ELEM, ELEM_NAME } from "./lumen/data";
import { Battle, makeHero } from "./lumen/battle";
import { LW, LH, drawScene, heroSprite, enemySprite, hd2d } from "./lumen/art";

const NOOP = new Proxy({}, { get: () => () => {} });
const GLYPH = { sword: "Sw", spear: "Sp", bow: "Bw", dagger: "Dg", fire: "Fi", ice: "Ic", bolt: "Bt", light: "Li", dark: "Dk" };
const FOE_SLOTS = [[150, 170], [92, 142], [206, 182], [46, 176]];
const heroSlot = (i) => [340 + i * 22, 118 + i * 17];

class LumenSession {
  constructor(lv, ctx = {}, opts = {}) {
    this.lv = lv; this.ctx = ctx; this.demo = !!opts.demo; this.sfx = opts.quiet ? NOOP : realSfx; this.ch = CHAPTERS[lv.index] || CHAPTERS[0];
    this.lo = makeCanvas(LW, LH); this.lg = this.lo.getContext("2d"); this.fx = new Particles(600); this.fl = new Floaters(); this.juice = new Juice();
    this.t = 0; this.scroll = 0; this.done = null; this.score = 0; this.turns = 0; this.kos = 0; this.breaks = 0; this.ni = -1; this.phase = "walk"; this.pt = 0; this.timers = []; this.flash = 0; this.msg = null; this.msgT = 0; this.shake = 0;
    const unlock = lv.index + 1;
    this.party = this.ch.party.map((id) => makeHero(id, this.ch.level, unlock));
    this.inv = { potion: 3, ether: 2, feather: 1, bomb: 0 };
    this.r = rng(lv.index * 91 + 7); this.battle = null; this.nextNode(); if (typeof window !== "undefined") window.__lumen = this;
  }
  nextNode() {
    this.ni++; const n = this.ch.nodes[this.ni];
    if (!n) { this.finish(true); return; }
    this.node = n; this.pt = 0;
    if (n.k === "story" || n.k === "rest") { this.phase = "walk"; this.walkFor = n.k === "story" ? 1.3 : 1.0; }
    else this.phase = "walk", this.walkFor = n.k === "chest" ? 1.2 : 2.0;
    if (this.demo) this.walkFor = 1;
  }
  sched(d, fn) { this.timers.push({ t: this.t + d, fn }); }
  say(s, d = 1.4) { this.msg = s; this.msgT = d; }

  // ---------------------------------------------------------------------------------------------------------------------- update
  update(dt0, input) {
    const dt = Math.min(dt0, 1 / 20); this.t += dt; this.pt += dt; this.juice.update(dt); const sdt = this.juice.step(dt); this.fx.update(sdt); this.fl.update(sdt);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 2.4); if (this.msgT > 0) this.msgT -= dt; if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);
    for (let i = this.timers.length - 1; i >= 0; i--) { if (this.t >= this.timers[i].t) { const f = this.timers[i].fn; this.timers.splice(i, 1); f(); } }
    this.input = input; const ok = input && (input.pressed("confirm") || input.pressed("fire") || input.pressed("jump")), back = input && input.pressed("alt");
    const ptr = input && input.pointer && input.pointer.pressed ? input.pointer : null;
    this.click = ptr ? { x: ptr.x, y: ptr.y } : null;
    if (this.demo) { this.scroll += 40 * dt; return; }
    switch (this.phase) {
      case "walk": this.scroll += 70 * dt; if (this.pt >= this.walkFor) { this.enterNode(); } break;
      case "story": this.updateStory(dt, ok || !!this.click); break;
      case "chest": if (this.pt > 0.6 && (ok || this.click)) this.nextNode(); break;
      case "rest": this.updateStory(dt, ok || !!this.click); break;
      case "battle": this.updateBattle(dt, input, ok, back); break;
      default: break;
    }
  }
  enterNode() {
    const n = this.node;
    if (n.k === "story" || n.k === "rest") { this.lines = n.lines; this.li = 0; this.chars = 0; this.phase = n.k; if (n.k === "rest") { for (const h of this.party) { if (!h.ko || true) { h.ko = false; h.hp = h.maxhp; h.sp = Math.min(h.maxsp, h.sp + Math.round(h.maxsp * 0.6)); h.poison = 0; } } this.sfx.heal(); this.fl.add(480, 300, "Party rested", "#aaffcc", 20); } }
    else if (n.k === "chest") { this.inv[n.item] = (this.inv[n.item] || 0) + n.n; this.phase = "chest"; this.pt = 0; this.sfx.key(); this.say(`Found ${n.n} × ${ITEMS[n.item].name}`, 2.4); }
    else this.startBattle(n);
  }
  updateStory(dt, ok) {
    const L = this.lines[this.li], full = L.text.length; this.chars = Math.min(full, this.chars + dt * 55);
    if (ok) { if (this.chars < full) this.chars = full; else { this.li++; this.chars = 0; this.sfx.tick(); if (this.li >= this.lines.length) { if (this.node.after) { this.lines = this.node.after; this.li = 0; this.node = { ...this.node, after: null, k: "story" }; this.phase = "story"; } else this.nextNode(); } } }
  }

  // ---- battle -------------------------------------------------------------------------------------------------------------------------------------------------------
  startBattle(n) {
    this.phase = "battle"; this.node = n; this.b = new Battle(this.party, n.foes, this.inv, this.ni + 3); this.bs = "intro"; this.bt = 0; this.menu = null; this.flash = 1; this.sfx.alarm && this.sfx.alarm(); this.isBoss = n.k === "boss";
    for (const u of [...this.b.heroes, ...this.b.foes]) { u.lunge = 0; u.hit = 0; u.dx = 0; }
    this.say(this.isBoss ? this.b.foes[0].name : "Enemies appear!", 1.6); this.intro = 1.2;
  }
  pos(u) { if (u.kind === "hero") { const [x, y] = heroSlot(this.b.heroes.indexOf(u)); return [x, y]; } return FOE_SLOTS[u.def.big ? 0 : u.slot] || FOE_SLOTS[0]; }
  scr(u, up = 40) { const [x, y] = this.pos(u); return [x * 2 + (u.dx || 0) * 2, (y - up) * 2]; }
  updateBattle(dt, input, ok, back) {
    const b = this.b; for (const u of [...b.heroes, ...b.foes]) { if (u.lunge > 0) u.lunge = Math.max(0, u.lunge - dt); if (u.hit > 0) u.hit = Math.max(0, u.hit - dt); }
    if (this.timers.length) return;
    this.bt += dt;
    if (this.bs === "intro") { if (this.bt > 1.2) { this.bs = "next"; this.bt = 0; } return; }
    if (this.bs === "win") { if (ok || this.click) { this.score += this.reward; this.nextNode(); } return; }
    if (this.bs === "next") {
      if (!b.alive("foe").length) { this.winBattle(); return; } if (!b.alive("hero").length) { this.finish(false); return; }
      const u = b.nextActor(); this.actor = u;
      if (u.kind === "foe") { this.foeTurn(u); return; }
      this.turns++; this.menu = { st: "root", sel: 0, boost: 0, tsel: 0 }; this.bs = "menu"; return;
    }
    if (this.bs === "menu") this.updateMenu(input, ok, back);
  }
  winBattle() {
    const b = this.b; this.reward = b.foes.reduce((s, f) => s + f.def.pts, 0) + b.breaks * 25; this.breaks += b.breaks; this.bs = "win"; this.bt = 0; this.sfx.win && this.sfx.win(); this.say(this.isBoss ? "Victory!" : "Victory!", 3);
    for (const h of this.party) { h.buffs = {}; h.poison = 0; h.bp = 1; h.guard = false; }
    for (let i = 0; i < 30; i++) this.fx.emit({ x: 300 + Math.random() * 380, y: 160, vx: (Math.random() - 0.5) * 120, vy: -60 - Math.random() * 120, size: 4, life: 1.2, color: ["#ffe27a", "#fff", "#8be9ff"][i % 3], g: 160 });
  }
  endTurn(u) {
    const b = this.b; this.sched(0.15, () => {
      if (u.poison > 0 && !u.ko) { const d = Math.max(3, Math.round(u.maxhp * 0.07)); u.hp = Math.max(0, u.hp - d); u.hit = 0.15; this.fl.add(...this.scr(u), `${d}`, "#b46bff", 18); if (u.hp <= 0) { u.ko = true; if (u.kind === "hero") this.kos++; } u.poison--; }
      b.tickBuffs(u); this.bs = "next"; this.bt = 0;
    });
  }
  foeTurn(f) {
    const b = this.b;
    if (f.broken > 0) { f.broken--; this.say(`${f.name} is broken!`, 1.0); if (f.broken <= 0) { f.shield = f.maxShield; } this.sched(1.0, () => this.endTurn(f)); return; }
    if (f.def.phase2 && f.phase === 1 && f.hp < f.maxhp * f.def.phase2) { f.phase = 2; f.shield = f.maxShield; f.atk *= 1.2; f.mag *= 1.2; f.chargeLeft = Math.min(f.chargeLeft, 2); this.say(`${f.name} awakens!`, 1.6); this.flash = 0.7; this.shake = 8; this.sched(1.5, () => this.endTurn(f)); return; }
    const plan = b.foePlan(f); if (!plan) { this.endTurn(f); return; }
    this.say(plan.name, 1.2); if (plan.big) { this.sfx.boom && this.sfx.boom(); this.shake = 5; }
    f.lunge = 0.5; const targets = plan.targets;
    if (plan.buff) { f.buffs.atk = { amt: 0.4, t: 3 }; this.fl.add(...this.scr(f, 70), "ATK up", "#ffd23a", 16); this.sched(1.0, () => this.endTurn(f)); return; }
    this.sched(0.35, () => {
      for (const tg of targets) {
        if (tg.ko) continue; const r = b.hitHero(f, tg, plan.pow, plan.mag); tg.hit = 0.25; this.sfx.hurt(); this.shake = plan.big ? 9 : 4; this.juice.hitstop(0.05);
        const [sx, sy] = this.scr(tg); this.fl.add(sx, sy - 20, `${r.d}`, "#fff", plan.big ? 28 : 22); for (let i = 0; i < 10; i++) this.fx.burst(sx, sy, 1, { color: plan.elem ? ELEM[plan.elem] : "#ffb0a0", speed: [60, 220], size: [2, 5], life: [0.2, 0.5], g: 200 });
        if (plan.poison && !tg.ko) { tg.poison = 3; this.fl.add(sx, sy - 44, "Poisoned", "#b46bff", 14); }
        if (plan.drain) { f.hp = Math.min(f.maxhp, f.hp + Math.round(r.d * 0.5)); }
        if (r.ko) { this.kos++; this.fl.add(sx, sy - 50, "KO", "#ff6a6a", 20); this.sfx.die && this.sfx.die(); }
      }
      this.endTurn(f);
    });
    this.sched(0.35 + 0.01, () => {}); 
  }

  // ---- the player's menu --------------------------------------------------------------------------------------------------------------------------------------
  menuItems() {
    const m = this.menu, h = this.actor;
    if (m.st === "root") return [["Attack", "atk"], ["Skills", "skill"], ["Items", "item"], ["Defend", "def"]];
    if (m.st === "weapon") return HEROES[h.id].weapons.map((w) => [`${ELEM_NAME[w]}`, w]);
    if (m.st === "skill") return h.skills.map((s) => [SKILLS[s].name, s, SKILLS[s].sp, h.sp >= SKILLS[s].sp ? SKILLS[s].desc : "Not enough SP"]);
    if (m.st === "item") return Object.entries(this.inv).filter(([, n]) => n > 0).map(([k, n]) => [`${ITEMS[k].name} ×${n}`, k, 0, ITEMS[k].desc]);
    return [];
  }
  updateMenu(input, ok, back) {
    const m = this.menu, h = this.actor, b = this.b; const items = this.menuItems();
    if (input.pressed("swap")) { m.boost = (m.boost + 1) % (Math.min(3, h.bp) + 1); this.sfx.tick(); }
    if (m.st !== "target") {
      if (input.pressed("up")) { m.sel = (m.sel + items.length - 1) % items.length; this.sfx.tick(); } if (input.pressed("down")) { m.sel = (m.sel + 1) % items.length; this.sfx.tick(); }
      if (this.click) { const hit = (this.rects || []).find((r) => r.kind === "item" && this.click.x > r.x && this.click.x < r.x + r.w && this.click.y > r.y && this.click.y < r.y + r.h); if (hit) { m.sel = hit.i; this.pick(items[m.sel]); return; } const bb = this.boostRect; if (bb && this.click.x > bb.x && this.click.x < bb.x + bb.w && this.click.y > bb.y && this.click.y < bb.y + bb.h) { m.boost = (m.boost + 1) % (Math.min(3, h.bp) + 1); return; } if (this.backRect && this.click.x > this.backRect.x && this.click.y > this.backRect.y && this.click.x < this.backRect.x + 90 && this.click.y < this.backRect.y + 36) { this.back(); return; } }
      if (ok) this.pick(items[m.sel]); if (back) this.back();
    } else {
      const list = m.pool; if (input.pressed("left") || input.pressed("up")) { m.tsel = (m.tsel + list.length - 1) % list.length; this.sfx.tick(); } if (input.pressed("right") || input.pressed("down")) { m.tsel = (m.tsel + 1) % list.length; this.sfx.tick(); }
      if (this.click) { for (let i = 0; i < list.length; i++) { const [sx, sy] = this.scr(list[i], 30); if (Math.abs(this.click.x - sx) < 60 && Math.abs(this.click.y - sy) < 90) { if (m.tsel === i) { this.commit(); return; } m.tsel = i; } } }
      if (ok) this.commit(); if (back) this.back();
    }
  }
  back() { const m = this.menu; if (m.st === "target") m.st = m.prev; else if (m.st !== "root") { m.st = "root"; m.sel = 0; } else if (m.boost) m.boost = 0; this.sfx.back && this.sfx.back(); }
  pick(it) {
    const m = this.menu, h = this.actor; if (!it) return;
    if (m.st === "root") {
      if (it[1] === "atk") { if (HEROES[h.id].weapons.length > 1) { m.st = "weapon"; m.sel = 0; } else { m.act = { kind: "attack", type: HEROES[h.id].weapons[0] }; this.toTarget("foe"); } }
      else if (it[1] === "skill") { m.st = "skill"; m.sel = 0; } else if (it[1] === "item") { if (!Object.values(this.inv).some((n) => n > 0)) { this.say("No items", 0.8); return; } m.st = "item"; m.sel = 0; } else { this.exec({ kind: "defend" }); }
    } else if (m.st === "weapon") { m.act = { kind: "attack", type: it[1] }; this.toTarget("foe"); }
    else if (m.st === "skill") { const S = SKILLS[it[1]]; if (h.sp < S.sp) { this.sfx.empty && this.sfx.empty(); return; } m.act = { kind: "skill", skill: it[1] }; this.skillTarget(S.t); }
    else if (m.st === "item") { const I = ITEMS[it[1]]; m.act = { kind: "item", item: it[1] }; this.skillTarget(I.t); }
  }
  skillTarget(t) {
    const m = this.menu, b = this.b;
    if (t === "one") this.toTarget("foe"); else if (t === "ally") this.toTarget("ally"); else if (t === "fallen") { const f = b.heroes.filter((x) => x.ko); if (!f.length) { this.say("No one has fallen", 1); return; } m.pool = f; m.tsel = 0; m.prev = m.st; m.st = "target"; }
    else { m.act.tgt = t; this.exec(m.act); }
  }
  toTarget(side) { const m = this.menu, b = this.b; m.pool = side === "foe" ? b.alive("foe") : b.alive("hero"); m.tsel = Math.min(m.tsel, m.pool.length - 1); m.prev = m.st; m.st = "target"; }
  commit() { const m = this.menu; m.act.target = m.pool[m.tsel]; this.exec(m.act); }

  // ---- doing the action ---------------------------------------------------------------------------------------------------------------------------------------
  exec(a) {
    const b = this.b, h = this.actor, boost = this.menu.boost; this.menu = null; this.bs = "act"; h.bp -= boost; h.lunge = 0.5; a.boost = boost; let T = 0.35;
    const hitFoe = (foe, o, delay) => this.sched(delay, () => this.doHit(h, foe, o));
    if (a.kind === "defend") { h.guard = true; h.bp = Math.min(5, h.bp + 1); this.say(`${h.name} guards`, 1); this.fl.add(...this.scr(h, 70), "Guard +BP", "#8be9ff", 15); this.sched(0.9, () => this.endTurn(h)); return; }
    if (a.kind === "attack") { const hits = 1 + boost; this.say(`${h.name}: ${ELEM_NAME[a.type]} attack${boost ? ` (Boost ×${boost})` : ""}`, 1.3); for (let i = 0; i < hits; i++) hitFoe(a.target.ko ? b.alive("foe")[0] : a.target, { type: a.type, pow: 0.95, mag: false }, T + i * 0.22); this.sched(T + hits * 0.22 + 0.45, () => this.endTurn(h)); return; }
    if (a.kind === "item") {
      const I = ITEMS[a.item]; this.inv[a.item]--; this.say(`${h.name} uses ${I.name}`, 1.2);
      this.sched(0.4, () => { if (I.kind === "heal") { const tg = a.target; tg.hp = Math.min(tg.maxhp, tg.hp + I.amt); this.fl.add(...this.scr(tg, 50), `+${I.amt}`, "#7dff9a", 22); this.sfx.heal(); }
        else if (I.kind === "sp") { const tg = a.target; tg.sp = Math.min(tg.maxsp, tg.sp + I.amt); this.fl.add(...this.scr(tg, 50), `+${I.amt} SP`, "#8be9ff", 20); this.sfx.powerup(); }
        else if (I.kind === "revive") { const tg = a.target; tg.ko = false; tg.hp = Math.round(tg.maxhp * 0.4); tg.bp = 1; this.fl.add(...this.scr(tg, 50), "Revived!", "#fff3b0", 22); this.sfx.heal(); }
        else if (I.kind === "bomb") { for (const f of b.alive("foe")) { const d = I.amt; f.hp = Math.max(0, f.hp - d); f.hit = 0.25; if (f.hp <= 0) { f.ko = true; b.kills++; } this.fl.add(...this.scr(f, 50), `${d}`, "#ffb04a", 22); } this.sfx.explode && this.sfx.explode(); this.shake = 6; } });
      this.sched(1.2, () => this.endTurn(h)); return;
    }
    const S = SKILLS[a.skill]; h.sp -= S.sp; this.say(`${h.name}: ${S.name}${boost ? ` (Boost ×${boost})` : ""}`, 1.4);
    if (S.kind === "heal") { const targets = S.t === "allies" ? b.alive("hero") : [a.target]; this.sched(0.5, () => { for (const tg of targets) { const amt = Math.round(h.mag * S.pow * (1 + 0.35 * boost) * 1.6); tg.hp = Math.min(tg.maxhp, tg.hp + amt); this.fl.add(...this.scr(tg, 50), `+${amt}`, "#7dff9a", 22); this.fx.burst(...this.scr(tg, 40), 12, { color: "#9fffb0", speed: [20, 90], g: -60, life: [0.4, 0.9] }); } this.sfx.heal(); }); this.sched(1.3, () => this.endTurn(h)); return; }
    if (S.kind === "revive") { this.sched(0.5, () => { const tg = a.target; tg.ko = false; tg.hp = Math.round(tg.maxhp * (0.35 + 0.15 * boost)); tg.bp = 1; this.fl.add(...this.scr(tg, 50), "Revived!", "#fff3b0", 22); this.sfx.heal(); }); this.sched(1.3, () => this.endTurn(h)); return; }
    if (S.kind === "buff") { const ts = S.t === "self" ? [h] : b.alive("hero"); this.sched(0.5, () => { for (const tg of ts) { tg.buffs[S.stat] = { amt: (S.amt || 0.35) * (1 + 0.3 * boost), t: 3 + boost }; this.fl.add(...this.scr(tg, 60), `${S.stat.toUpperCase()} up`, "#ffd23a", 16); } this.sfx.powerup(); }); this.sched(1.2, () => this.endTurn(h)); return; }
    if (S.kind === "sp") { this.sched(0.5, () => { h.sp = Math.min(h.maxsp, h.sp + S.amt + 10 * boost); this.fl.add(...this.scr(h, 60), `+${S.amt + 10 * boost} SP`, "#8be9ff", 18); this.sfx.powerup(); }); this.sched(1.2, () => this.endTurn(h)); return; }
    if (S.kind === "bp") { this.sched(0.5, () => { const tg = a.target; tg.bp = Math.min(5, tg.bp + 1 + boost); this.fl.add(...this.scr(tg, 60), "+BP", "#ffd23a", 18); this.sfx.powerup(); }); this.sched(1.2, () => this.endTurn(h)); return; }
    if (S.kind === "steal") { this.sched(0.5, () => { const f = a.target; const it = ["potion", "ether", "potion", "bomb", "feather"][Math.floor(this.r() * 5)]; this.inv[it] = (this.inv[it] || 0) + 1; this.fl.add(...this.scr(f, 60), `Got ${ITEMS[it].name}`, "#ffe27a", 16); this.sfx.coin(); }); this.sched(1.2, () => this.endTurn(h)); return; }
    // damaging skills
    const hits = (S.hits || 1) + (S.hits > 1 ? boost : 0), pow = S.pow * (S.hits > 1 ? 1 : 1 + 0.45 * boost); let k = 0;
    for (let i = 0; i < hits; i++) {
      const delay = T + i * (hits > 3 ? 0.14 : 0.24);
      if (S.t === "all") { if (i === 0) this.sched(delay, () => { for (const f of this.b.alive("foe").slice()) this.doHit(h, f, { type: S.type, pow, mag: !!S.mag, pierce: S.pierce, poison: S.poison }); }); }
      else if (S.t === "rand") this.sched(delay, () => { const al = this.b.alive("foe"); if (al.length) this.doHit(h, al[Math.floor(this.r() * al.length)], { type: S.type, pow, mag: !!S.mag }); });
      else this.sched(delay, () => { const f = a.target.ko ? this.b.alive("foe")[0] : a.target; if (f) this.doHit(h, f, { type: S.type, pow, mag: !!S.mag, pierce: S.pierce, poison: S.poison }); });
    }
    this.sched(T + hits * 0.24 + 0.55, () => this.endTurn(h));
  }
  doHit(h, f, o) {
    if (f.ko) return; const r = this.b.hitFoe(h, f, o); f.hit = 0.22; const [sx, sy] = this.scr(f, 40); const col = ELEM[o.type] || "#fff";
    this.fl.add(sx + (Math.random() - 0.5) * 30, sy - 20, `${r.d}`, r.weak ? "#ffe27a" : "#ffffff", r.weak || r.crit ? 28 : 22); this.sfx.punch && this.sfx.punch();
    this.fx.burst(sx, sy, r.weak ? 16 : 9, { color: col, speed: [80, 300], size: [2, 5], life: [0.2, 0.5], g: 160 }); this.shake = r.weak ? 5 : 2.5; this.juice.hitstop(r.weak ? 0.06 : 0.03);
    if (r.weak) this.fl.add(sx, sy - 52, "WEAK!", col, 15);
    if (o.poison && !f.ko) f.poison = 3;
    if (r.broke) { this.fl.add(sx, sy - 76, "BREAK!", "#ff6a4a", 30); this.juice.doFlash(0.35, "#fff2c0"); this.shake = 9; this.sfx.boom && this.sfx.boom(); this.fx.burst(sx, sy, 30, { color: "#ffd8a0", speed: [100, 420], size: [3, 7], life: [0.3, 0.8], g: 300 }); }
    if (f.ko) { this.sfx.kill && this.sfx.kill(); this.fx.burst(sx, sy, 24, { color: "#fff", speed: [50, 240], g: -40, life: [0.4, 0.9] }); }
  }

  finish(won) {
    if (this.done) return; const kos = this.kos, par = this.ch.par * 3;
    const score = won ? Math.round(this.score + 500 + Math.max(0, par - this.turns) * 20 - kos * 100 + this.party.reduce((s, h) => s + (h.ko ? 0 : 60), 0)) : Math.round(this.score * 0.2);
    const stars = won ? 1 + (kos <= 1 ? 1 : 0) + (kos === 0 && this.turns <= par ? 1 : 0) : 0;
    this.done = { won, score: Math.max(0, score), stars, title: won ? (this.ch.nodes[this.ch.nodes.length - 1].last ? "THE END" : "CHAPTER CLEAR") : "THE PARTY FELL", sub: this.ch.name, delay: 0.3, lines: [["Heroes lost", `${kos}${kos <= 1 ? " ★" : ""}`], ["Hero turns", `${this.turns}  (par ${par}${this.turns <= par ? " ★" : ""})`], ["Shields broken", String(this.breaks)], ["Score from battles", String(Math.round(this.score))]] };
  }

  // ---------------------------------------------------------------------------------------------------------------------- drawing
  draw(g) {
    const lg = this.lg, t = this.t; lg.save(); lg.imageSmoothingEnabled = false;
    const sc = this.phase === "battle" ? t * 8 : this.scroll;
    drawScene(lg, this.ch.theme, this.phase === "battle" ? sc : this.scroll, t, { groundY: this.phase === "battle" ? 112 : 150 });
    if (this.phase === "battle" && this.b) this.drawBattleWorld(lg); else this.drawPartyWalk(lg);
    lg.restore();
    hd2d(g, this.lo, t, { bloom: 0.16, dof: 0.8, vig: 0.55 });
    g.save(); if (this.shake > 0) g.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    this.fx.draw(g); this.fl.draw(g); g.restore();
    if (this.phase === "battle" && this.b) this.drawBattleUI(g);
    if (this.phase === "story" || this.phase === "rest") this.drawStory(g);
    if (this.phase === "chest" && this.msgT > 0) { fillRR(g, 280, 220, 400, 70, 16, "rgba(10,6,24,.85)", "#ffd23a", 3); text(g, this.msg, 480, 264, { size: 22, color: "#ffe27a", align: "center", font: FONT_DISPLAY, weight: 800 }); if (this.pt > 0.6) text(g, "Press Enter", 480, 330, { size: 14, color: "#fff", align: "center", font: FONT_BODY }); }
    if (this.phase !== "battle" && !this.demo) { const k = this.ni / this.ch.nodes.length; fillRR(g, 30, 22, 220, 12, 6, "rgba(10,6,24,.7)", "rgba(255,255,255,.3)", 1.5); g.fillStyle = "#ffcf5a"; g.fillRect(32, 24, 216 * k, 8); text(g, this.ch.name, 30, 56, { size: 14, color: "#fff", font: FONT_DISPLAY, weight: 800, stroke: OUT, strokeW: 3 }); }
    this.juice.draw(g, 960, 540); if (this.flash > 0) { g.fillStyle = `rgba(255,255,255,${this.flash})`; g.fillRect(0, 0, 960, 540); }
  }
  drawPartyWalk(lg) {
    const n = this.party.length, t = this.t, step = Math.floor(t * 5) % 2;
    for (let i = n - 1; i >= 0; i--) { const h = this.party[i], x = 230 - i * 34, y = 168 + (i % 2) * 6, s = heroSprite(HEROES[h.id], this.phase === "walk" && !this.demo ? "walk" : "idle", this.phase === "walk" && !this.demo ? step : Math.floor(t * 2) % 2); lg.save(); lg.fillStyle = "rgba(0,0,0,.28)"; lg.beginPath(); lg.ellipse(x, y, 13, 4, 0, 0, TAU); lg.fill(); lg.restore(); lg.drawImage(s, Math.round(x - 20), Math.round(y - 46 + (this.phase === "walk" ? Math.abs(Math.sin(t * 10 + i)) * -1 : 0))); }
  }
  drawBattleWorld(lg) {
    const b = this.b, t = this.t;
    const units = [...b.foes, ...b.heroes].filter((u) => !u.ko || (u.kind === "hero")).sort((a, c) => this.pos(a)[1] - this.pos(c)[1]);
    for (const u of units) {
      const [x, y] = this.pos(u); const lun = u.lunge > 0 ? Math.sin((1 - u.lunge / 0.5) * Math.PI) * 26 * (u.kind === "hero" ? -1 : 1) : 0; u.dx = lun;
      lg.save(); lg.fillStyle = "rgba(0,0,0,.3)"; lg.beginPath(); lg.ellipse(x + lun, y, u.def.big ? 42 : 17, u.def.big ? 8 : 4, 0, 0, TAU); lg.fill(); lg.restore();
      let img, ox, oy;
      if (u.kind === "hero") { const pose = u.ko ? "ko" : u.lunge > 0 ? "atk" : "idle"; img = heroSprite(HEROES[u.id], pose, Math.floor(t * 2 + this.b.heroes.indexOf(u)) % 2); ox = x - 20 + lun; oy = y - 46; if (this.bs === "menu" && this.actor === u) oy -= 3 + Math.sin(t * 8) * 1.5; }
      else { img = enemySprite(u.id, u.def); ox = x - img.width / 2 + lun; oy = y - img.height + 2 + Math.sin(t * 2 + u.slot) * 1.5; if (u.broken > 0) oy += 6; }
      if (u.hit > 0 && Math.floor(u.hit * 40) % 2 === 0) { lg.globalAlpha = 0.45; }
      if (u.kind === "foe" && u.ko) { lg.globalAlpha = 0.2; }
      if (u.broken > 0 && u.kind === "foe") { lg.save(); lg.translate(Math.round(ox + img.width / 2), Math.round(oy + img.height)); lg.rotate(0.12); lg.drawImage(img, -img.width / 2, -img.height); lg.restore(); }
      else lg.drawImage(img, Math.round(ox), Math.round(oy));
      lg.globalAlpha = 1;
      if (this.bs === "menu" && this.actor === u) { lg.fillStyle = "#ffe27a"; const ay = oy - 8 + Math.sin(t * 6) * 2; lg.beginPath(); lg.moveTo(x + lun - 4, ay - 6); lg.lineTo(x + lun + 4, ay - 6); lg.lineTo(x + lun, ay); lg.fill(); }
    }
  }
  drawBattleUI(g) {
    const b = this.b, m = this.menu; this.rects = []; const t = this.t;
    // turn order
    const ord = b.order(9); fillRR(g, 20, 14, 36 + ord.length * 34, 40, 10, "rgba(10,6,24,.7)", "rgba(255,255,255,.2)", 1.5); text(g, "TURNS", 30, 30, { size: 9, color: "#c9b8ff", font: FONT_BODY, weight: 700 });
    ord.forEach((u, i) => { const x = 62 + i * 34; fillRR(g, x, 20, 30, 28, 6, u.kind === "hero" ? HEROES[u.id].color : "#7a3a4a", i === 0 ? "#fff" : "#000", i === 0 ? 3 : 1.5); text(g, u.kind === "hero" ? u.name[0] : u.name[0], x + 15, 40, { size: 15, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 800 }); });
    // foes: shield + weaknesses + hp
    for (const f of b.foes) { if (f.ko) continue; const [sx, sy] = this.scr(f, f.def.big ? 112 : 56); const w = f.def.big ? 150 : 90;
      text(g, f.name, sx, sy - 34, { size: 14, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 800, stroke: OUT, strokeW: 4 });
      const wk = f.def.weak; const n = wk.length; wk.forEach((w2, i) => { const x = sx - (n * 24) / 2 + i * 24 + 12; const known = f.known.has(w2); circle(g, x, sy - 12, 10, known ? ELEM[w2] : "#3a3350", OUT, 2); text(g, known ? GLYPH[w2] : "?", x, sy - 7, { size: 10, color: known ? "#1b1226" : "#c9b8ff", align: "center", font: FONT_DISPLAY, weight: 800 }); });
      if (f.broken > 0) text(g, "BREAK", sx, sy + 14, { size: 16, color: "#ff6a4a", align: "center", font: FONT_DISPLAY, weight: 800, stroke: OUT, strokeW: 4 }); else { for (let i = 0; i < f.maxShield; i++) { g.save(); g.translate(sx - (f.maxShield * 14) / 2 + i * 14 + 7, sy + 8); g.beginPath(); g.moveTo(0, -6); g.lineTo(6, -3); g.lineTo(5, 4); g.lineTo(0, 7); g.lineTo(-5, 4); g.lineTo(-6, -3); g.closePath(); g.fillStyle = i < f.shield ? "#8be9ff" : "rgba(255,255,255,.15)"; g.fill(); g.lineWidth = 1.5; g.strokeStyle = OUT; g.stroke(); g.restore(); } }
      bar(g, sx - w / 2, sy + 22, w, 7, f.hp / f.maxhp, "#ff5a5a"); if (f.def.charge) text(g, f.broken > 0 ? "" : `${f.def.charge.name} in ${f.chargeLeft + 1}`, sx, sy + 46, { size: 11, color: "#ffcf5a", align: "center", font: FONT_BODY, weight: 700, stroke: OUT, strokeW: 3 }); if (f.poison > 0) text(g, "☠", sx + w / 2 + 8, sy + 30, { size: 13, color: "#b46bff", align: "center" });
      if (m && m.st === "target" && m.pool[m.tsel] === f) { g.save(); g.fillStyle = "#ffe27a"; const ax = sx, ay = sy + 64 + Math.sin(t * 8) * 3; g.beginPath(); g.moveTo(ax, ay); g.lineTo(ax - 9, ay + 14); g.lineTo(ax + 9, ay + 14); g.fill(); g.restore(); } if (m && m.st === "target" && m.act && m.act.tgt === "all") { /* handled below */ } }
    // party panel
    const px = 560, py = 400; fillRR(g, px, py, 380, 128, 14, "rgba(10,6,24,.82)", "rgba(255,255,255,.22)", 2);
    b.heroes.forEach((h, i) => { const y = py + 12 + i * 29, cur = this.actor === h && this.bs === "menu"; if (cur) fillRR(g, px + 6, y - 3, 368, 27, 8, "rgba(255,226,122,.18)", "#ffe27a", 2);
      text(g, h.name, px + 16, y + 17, { size: 14, color: h.ko ? "#ff6a6a" : "#fff", font: FONT_DISPLAY, weight: 800 }); text(g, `${h.hp}`, px + 150, y + 17, { size: 14, color: h.hp < h.maxhp * 0.3 ? "#ff7a7a" : "#fff", align: "right", font: FONT_DISPLAY, weight: 700 });
      bar(g, px + 156, y + 4, 90, 7, h.hp / h.maxhp, "#6aff8a"); bar(g, px + 156, y + 14, 90, 5, h.sp / h.maxsp, "#5cd0ff"); text(g, `${h.sp}sp`, px + 296, y + 17, { size: 11, color: "#8be9ff", align: "right", font: FONT_BODY, weight: 700 });
      for (let k = 0; k < 5; k++) circle(g, px + 312 + k * 12, y + 11, 4.5, k < h.bp ? "#ffd23a" : "rgba(255,255,255,.15)", OUT, 1.5);
      if (h.poison) text(g, "☠", px + 366, y + 16, { size: 12, color: "#b46bff", align: "center" }); const bs = Object.keys(h.buffs); if (bs.length) text(g, "▲", px + 352, y + 16, { size: 12, color: "#ffd23a", align: "center" }); });
    // command menu
    if (m && this.bs === "menu") {
      const items = m.st === "target" ? [] : this.menuItems(), h = this.actor; const mx = 24, my = 380, mw = 330, rowH = 26, rows = Math.min(items.length, 5), mh = 44 + rows * rowH;
      if (m.st !== "target") { fillRR(g, mx, my - (rows > 4 ? 22 : 0), mw, mh + (rows > 4 ? 22 : 0), 14, "rgba(10,6,24,.88)", "rgba(255,255,255,.25)", 2); text(g, `${h.name} — ${m.st === "root" ? "Command" : m.st === "skill" ? "Skills" : m.st === "item" ? "Items" : "Weapon"}`, mx + 16, my + 22 - (rows > 4 ? 22 : 0), { size: 14, color: "#ffe27a", font: FONT_DISPLAY, weight: 800 });
        const top = Math.max(0, Math.min(m.sel - 2, items.length - 5)); items.slice(top, top + 5).forEach((it, k) => { const i = top + k, y = my + 34 + k * rowH - (rows > 4 ? 22 : 0), on = i === m.sel; if (on) fillRR(g, mx + 8, y - 2, mw - 16, rowH - 2, 7, "rgba(255,226,122,.25)", "#ffe27a", 1.5); const dis = it[2] !== undefined && m.st === "skill" && h.sp < it[2]; text(g, it[0], mx + 20, y + 16, { size: 15, color: dis ? "#7a7090" : "#fff", font: FONT_DISPLAY, weight: 700 }); if (it[2]) text(g, `${it[2]} SP`, mx + mw - 18, y + 16, { size: 12, color: dis ? "#7a7090" : "#8be9ff", align: "right", font: FONT_BODY, weight: 700 }); this.rects.push({ kind: "item", i, x: mx + 8, y: y - 2, w: mw - 16, h: rowH - 2 }); });
        const cur = items[m.sel]; if (cur && cur[3]) text(g, cur[3], 30, 520, { size: 12, color: "#d8d0ff", font: FONT_BODY, weight: 500, stroke: OUT, strokeW: 3 });
        this.backRect = m.st !== "root" ? { x: mx, y: my - 44 - (rows > 4 ? 22 : 0), w: 90, h: 36 } : null; if (this.backRect) { fillRR(g, this.backRect.x, this.backRect.y, 90, 34, 10, "rgba(10,6,24,.8)", "rgba(255,255,255,.3)", 1.5); text(g, "← Back", this.backRect.x + 45, this.backRect.y + 23, { size: 13, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 700 }); }
      } else this.backRect = { x: mx, y: my - 8, w: 90, h: 36 }; if (m.st === "target") { fillRR(g, mx, my + 20, 300, 44, 12, "rgba(10,6,24,.88)", "#ffe27a", 2); text(g, m.act && m.act.kind !== "attack" && m.pool[0] && m.pool[0].kind === "hero" ? "Choose an ally" : "Choose a target", mx + 150, my + 49, { size: 16, color: "#ffe27a", align: "center", font: FONT_DISPLAY, weight: 800 }); }
      // boost button
      const bx = 380, by = 440, canB = h.bp > 0; this.boostRect = { x: bx, y: by, w: 150, h: 70 }; fillRR(g, bx, by, 150, 70, 14, m.boost ? "rgba(255,210,58,.3)" : "rgba(10,6,24,.82)", m.boost ? "#ffd23a" : "rgba(255,255,255,.3)", m.boost ? 3 : 2);
      text(g, "BOOST", bx + 75, by + 24, { size: 14, color: "#ffd23a", align: "center", font: FONT_DISPLAY, weight: 800 }); for (let k = 0; k < 3; k++) circle(g, bx + 45 + k * 30, by + 44, 9, k < m.boost ? "#ffd23a" : k < h.bp ? "rgba(255,210,58,.3)" : "rgba(255,255,255,.1)", OUT, 2); text(g, "Q / E / Tab", bx + 75, by + 66, { size: 10, color: "#c9b8ff", align: "center", font: FONT_BODY, weight: 600 });
    }
    if (this.msgT > 0 && this.msg) { fillRR(g, 480 - Math.max(160, this.msg.length * 8), 70, Math.max(320, this.msg.length * 16), 36, 12, "rgba(10,6,24,.82)", "rgba(255,255,255,.25)", 1.5); text(g, this.msg, 480, 95, { size: 17, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 800 }); }
    if (this.bs === "win") { text(g, "VICTORY", 480, 230, { size: 76, color: "#ffe27a", align: "center", font: FONT_DISPLAY, weight: 800, stroke: OUT, strokeW: 10 }); text(g, `+${this.reward} points   —   press Enter`, 480, 276, { size: 20, color: "#fff", align: "center", font: FONT_BODY, weight: 700, stroke: OUT, strokeW: 4 }); }
    if (this.bs === "intro" && this.isBoss) text(g, "BOSS", 480, 200, { size: 60, color: "#ff5a4a", align: "center", font: FONT_DISPLAY, weight: 800, stroke: OUT, strokeW: 9, alpha: clamp(1.4 - this.bt, 0, 1) });
  }
  drawStory(g) {
    const L = this.lines[this.li]; if (!L) return; const hero = Object.values(HEROES).find((h) => h.name === L.who);
    fillRR(g, 40, 372, 880, 140, 18, "rgba(10,6,28,.9)", "rgba(255,255,255,.35)", 2.5);
    if (hero) { fillRR(g, 56, 300, 120, 140, 14, "rgba(10,6,28,.9)", hero.color, 3); g.save(); g.beginPath(); g.rect(60, 304, 112, 132); g.clip(); g.imageSmoothingEnabled = false; const s = heroSprite(hero, "idle", 0); g.drawImage(s, 56, 296, 120, 144); g.restore(); }
    const tx = hero ? 200 : 64; text(g, L.who, tx, 404, { size: 20, color: hero ? hero.color === "#f0e6c8" ? "#ffe9a0" : "#ffe27a" : "#c9b8ff", font: FONT_DISPLAY, weight: 800 });
    const str = L.text.slice(0, Math.floor(this.chars)); const words = str.split(" "); let line = "", y = 436, maxW = hero ? 690 : 820; for (const w of words) { const test = line ? line + " " + w : w; if (test.length * 10.6 > maxW) { text(g, line, tx, y, { size: 18, color: "#fff", font: FONT_BODY, weight: 500 }); line = w; y += 26; } else line = test; } text(g, line, tx, y, { size: 18, color: "#fff", font: FONT_BODY, weight: 500 });
    if (this.chars >= L.text.length) text(g, "▼", 892, 498, { size: 16, color: "#ffe27a", align: "center" });
  }
}

const touch = [
  { act: "up", label: "▲", x: 20, y: 350, d: 64 }, { act: "down", label: "▼", x: 20, y: 424, d: 64 }, { act: "left", label: "◀", x: 94, y: 424, d: 60 }, { act: "right", label: "▶", x: 160, y: 424, d: 60 },
  { act: "confirm", label: "OK", x: 838, y: 380, d: 90, fs: 20 }, { act: "alt", label: "BACK", x: 750, y: 404, d: 70, fs: 13 }, { act: "swap", label: "BOOST", x: 850, y: 290, d: 80, fs: 13 },
];
const def = {
  get unlockAll() { return typeof window !== "undefined" && !!window.__QA_UNLOCK; },
  id: "lumentrail", title: "Lumen Trail", titleSize: 92, genreLabel: "Role-playing · Power Pass", accent: "#ffcf5a", music: "calm", touch,
  tagline: "Four travellers, one fallen star. A turn-based adventure where you break shields and boost your way north.",
  goal: "Walk the road through six chapters. Win every battle by finding enemy weaknesses to break their shields, then hit hard while they are stunned. Keep your party alive for more stars.",
  controls: [["↑ ↓ or W S", "Move the menu cursor"], ["Enter, Space or X", "Confirm / continue the story"], ["C, L or Shift", "Back"], ["Q, E or Tab", "Boost: spend up to 3 boost points for a stronger action"], ["Mouse or touch", "You can tap menu entries and enemies directly"]],
  touchControls: [["▲ ▼", "Menu"], ["OK", "Confirm / story"], ["BACK", "Go back"], ["BOOST", "Spend boost points"]],
  tips: ["Every foe has hidden weaknesses. Hit one and it is revealed, and its shield cracks.", "Break a foe's shields to stun it for a turn and deal 50% more damage. It also cancels its big attack!", "You gain 1 boost point every turn. Boosting basic attacks adds extra hits; boosting skills makes them stronger.", "Bosses show a countdown to a huge attack. Break them before it reaches zero."],
  worlds: [
    { name: "The Road North", theme: "forest", music: "sunny", blurb: "Three chapters. Two strangers become four friends.", levels: CHAPTERS.slice(0, 3).map((c, i) => ({ id: c.id, label: `${i + 1}`, name: c.name, desc: c.desc, index: i, music: c.music })) },
    { name: "The Fallen Star", theme: "volcano", music: "boss", blurb: "Three chapters. The road ends where the star fell.", levels: CHAPTERS.slice(3).map((c, i) => ({ id: c.id, label: `${i + 4}`, name: c.name, desc: c.desc, index: i + 3, music: c.music })) },
  ],
  makeSession: (level, ctx) => new LumenSession({ ...level, index: level.index ?? 0 }, ctx),
  createIdle() { const S = new LumenSession({ index: 1 }, {}, { demo: true, quiet: true }); return { update(dt) { S.update(dt, null); }, draw(g) { S.draw(g); } }; },
};
export default createKitGame(def);
export { def as LUMEN_DEF };
