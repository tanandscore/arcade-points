"use client";
// Gloamreach — a dark, glowing metroidvania (Power Pass). One connected map, four abilities, four bosses.
import { createKitGame } from "../shell/Kit";
import { TileMap, moveBody, heroControl, HERO_DEFAULT, bodiesOverlap } from "../core/platformer";
import { Particles, Floaters, Juice, Camera, FX } from "../core/fx";
import { makeCanvas, text, fillRR, circle, ellipse, poly, capsule, glow, FONT_DISPLAY, FONT_BODY, OUT } from "../core/draw";
import { sfx as realSfx } from "../core/audio";
import { clamp, lerp, damp, rng, TAU, shade, rgba, hash2, secondsLabel, sign } from "../core/util";
import { heroPhysics, newHero, P } from "./gloam/physics";
import { buildWorld, THEMES, BOSSES, ABILITIES, BOSS_NEEDED, RW, RH, TS, COLS, ROWS } from "./gloam/world";

const NOOP = new Proxy({}, { get: () => () => {} });
const SAVE_KEY = "ts-gloam-v1";
const ROCK = new Set(["#", "b", "d", "G", "K"]);
const loadSave = () => { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || "null"); return s && s.v === 1 ? s : null; } catch { return null; } };
const writeSave = (s) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch {} };

class GloamSession {
  constructor(lv, ctx = {}, opts = {}) {
    this.demo = !!opts.demo; this.sfx = opts.quiet ? NOOP : realSfx; this.ctx = ctx;
    const W = (this.W = buildWorld()); this.map = new TileMap(W.rows, { ts: TS, solid: "#bdGK", oneway: "=", hazard: "^", ents: "" });
    this.cam = new Camera(960, 540); this.fx = new Particles(900); this.fl = new Floaters(); this.juice = new Juice(); this.dark = null;
    const sv = this.demo ? null : loadSave();
    this.S = sv || { v: 1, abil: {}, hpMax: 100, got: [], broken: [], bosses: [], save: "m1", explored: ["0,2"], deaths: 0, time: 0, kills: 0 };
    this.abil = this.S.abil; this.got = new Set(this.S.got); this.bosses = new Set(this.S.bosses); this.explored = new Set(this.S.explored);
    for (const k of this.S.broken) { const [c, r] = k.split(",").map(Number); this.map.set(c, r, "."); } this.broken = new Set(this.S.broken);
    this.orig = null; this.t = 0; this.done = null; this.shots = []; this.eb = []; this.haz = []; this.orbs = []; this.banner = null; this.msg = null; this.msgT = 0; this.showMap = false; this.fireCd = 0;
    this.hero = { ...newHero(0, 0), hp: this.S.hpMax, anim: 0, safe: { x: 0, y: 0 }, safeT: 0, dead: false, deadT: 0 };
    this.spawn(this.S.save); this.cam.snap(this.hero.x, this.hero.y); this.camSnap();
    if (typeof window !== "undefined") window.__gloam = this;
  }
  // ---------------------------------------------------------------------------------------------------------------- setup
  spawn(id) {
    const st = this.W.ents.find((e) => e.t === "save" && e.id === id) || this.W.ents.find((e) => e.t === "save"); const H = this.hero;
    H.x = st.x; H.y = st.y; H.vx = H.vy = 0; H.hp = this.S.hpMax; H.dead = false; H.inv = 1; H.dash = 0; H.safe = { x: H.x, y: H.y };
    this.unlockArena(); this.shots.length = 0; this.eb.length = 0; this.haz.length = 0; this.boss = null; this.makeEnemies();
  }
  makeEnemies() {
    this.en = []; this.items = [];
    for (const e of this.W.ents) {
      if (e.t === "walker") this.en.push({ k: "walker", x: e.x, y: e.y, w: 30, h: 30, hp: 3, vx: 0, dir: Math.random() < 0.5 ? -1 : 1, vy: 0, hx: e.x, hit: 0, room: e.room });
      else if (e.t === "flyer") this.en.push({ k: "flyer", x: e.x, y: e.y, w: 28, h: 26, hp: 2, hx: e.x, hy: e.y, ph: Math.random() * 6, hit: 0, room: e.room, vx: 0, vy: 0, aggro: 0 });
      else if (e.t === "turret") this.en.push({ k: "turret", x: e.x, y: e.y, w: 34, h: 30, hp: 5, cd: 1 + Math.random(), hit: 0, room: e.room });
      else if (e.t === "spark" || e.t === "life") { if (!this.got.has(e.id)) this.items.push({ ...e, bob: Math.random() * 6 }); }
      else if (e.t === "save" || e.t === "sign" || e.t === "pedestal") { if (e.t === "pedestal" && this.abil[e.id]) continue; this.items.push({ ...e }); }
      else if (e.t === "boss" && !this.bosses.has(e.id)) this.items.push({ ...e, pend: true });
    }
  }
  roomOf(x, y) { return [clamp(Math.floor(x / (RW * TS)), 0, COLS - 1), clamp(Math.floor((y - 24) / (RH * TS)), 0, ROWS - 1)]; }
  camSnap() { const H = this.hero, [c, r] = this.roomOf(H.x, H.y); this.cam.x = c * RW * TS; this.cam.y = clamp(H.y - 300, r * RH * TS, r * RH * TS + RH * TS - 540); }
  say(s, d = 2.2) { this.msg = s; this.msgT = d; }
  burst(x, y, n, color, o = {}) { this.fx.burst(x, y, n, { color, speed: [40, 200], size: [2, 5], life: [0.25, 0.7], g: 300, ...o }); }
  persist() { const S = this.S; S.got = [...this.got]; S.bosses = [...this.bosses]; S.broken = [...this.broken]; S.explored = [...this.explored]; if (!this.demo) writeSave(S); }

  // ---------------------------------------------------------------------------------------------------------------- arenas
  arenaDoors(room) { const A = this.W.rooms[room], out = []; const { ox, oy } = A; if (A.doors.includes("L")) for (let y = 8; y <= 10; y++) out.push([ox, oy + y]); if (A.doors.includes("R")) for (let y = 8; y <= 10; y++) out.push([ox + 19, oy + y]); if (A.doors.includes("B")) for (let x = 8; x <= 11; x++) out.push([ox + x, oy + 11]); if (A.doors.includes("T")) for (let x = 8; x <= 11; x++) out.push([ox + x, oy]); return out; }
  lockArena(room) { this.locked = room; this.orig = this.arenaDoors(room).map(([c, r]) => [c, r, this.map.cells[r][c]]); for (const [c, r] of this.orig) this.map.set(c, r, "K"); this.sfx.door(); this.cam.shake(5, 0.4); }
  unlockArena() { if (this.orig) for (const [c, r, ch] of this.orig) this.map.set(c, r, ch); this.orig = null; this.locked = null; }
  startBoss(it) {
    const D = BOSSES[it.id], A = this.W.rooms[it.room]; it.pend = false;
    this.boss = { id: it.id, name: D.name, hp: D.hp, max: D.hp, x: it.x, y: it.y, vx: 0, vy: 0, t: 0, st: "intro", st_t: 1.4, hit: 0, ph: 1, dir: -1, room: it.room, ox: A.ox * TS, oy: A.oy * TS, w: 90, h: 70, cd: 2, cd2: 5, face: -1, wave: 0 };
    const b = this.boss; if (b.id === "lanternjaw") { b.w = 96; b.h = 70; b.y = b.oy + 4.2 * TS; b.x = b.ox + 10 * TS; } if (b.id === "mossback") { b.w = 120; b.h = 84; } if (b.id === "cinderwyrm") { b.w = 130; b.h = 54; b.y = b.oy + 3.6 * TS; b.x = b.ox + 14 * TS; } if (b.id === "gloamheart") { b.w = 120; b.h = 120; b.x = b.ox + 10 * TS; b.y = b.oy + 5 * TS; b.cd = 3; b.rot = 0; }
    this.say(D.name, 2.2); this.sfx.boom && this.sfx.boom(); this.juice.doFlash(0.5, "#fff");
  }
  bossDie() {
    const b = this.boss, D = BOSSES[b.id]; this.bosses.add(b.id); this.boss = null; this.eb.length = 0; this.haz.length = 0; this.unlockArena();
    FX.explosion(this.fx, b.x, b.y - b.h / 2, 2.4); for (let i = 0; i < 4; i++) setTimeout && 0; this.cam.shake(12, 0.8); this.juice.slowmo(1.2, 0.3); this.juice.doFlash(0.8, "#fff"); this.sfx.boom && this.sfx.boom(); this.score = (this.score || 0) + 1000;
    if (D.reward) { this.abil[D.reward] = true; const [n, d] = ABILITIES[D.reward]; this.banner = { title: n, text: d, t: 0 }; this.sfx.powerup(); }
    this.S.abil = this.abil; this.persist();
    if (b.id === "gloamheart") this.finishT = 2.2;
  }

  // ---------------------------------------------------------------------------------------------------------------- update
  update(dt0, input) {
    const dt = Math.min(dt0, 1 / 20); this.t += dt; this.juice.update(dt); const sdt = this.juice.step(dt); this.fx.update(sdt); this.fl.update(sdt); this.cam.update(dt);
    if (this.msgT > 0) this.msgT -= dt;
    if (this.finishT !== undefined) { this.finishT -= dt; this.updateWorldOnly(sdt); if (this.finishT <= 0 && !this.done) this.finish(); return; }
    if (this.banner) { this.banner.t += dt; if (this.banner.t > 0.8 && input && (input.pressed("confirm") || input.pressed("jump") || input.pressed("fire"))) this.banner = null; if (this.banner) return; }
    if (input && input.pressed("swap")) this.showMap = !this.showMap; if (this.showMap) { if (input && (input.pressed("alt") || input.pressed("pause"))) this.showMap = false; return; }
    if (sdt === 0) return;
    const H = this.hero; if (!this.demo) this.S.time += sdt;
    const inp = this.demo ? this.demoInput() : { dir: input.axis("left", "right"), jp: input.pressed("jump"), jh: input.held("jump"), up: input.held("up"), upp: input.pressed("up"), down: input.held("down"), fire: input.held("fire"), dashp: input.pressed("alt") };
    if (H.dead) { H.deadT += sdt; if (H.deadT > 1.3) { this.S.deaths++; this.persist(); this.spawn(this.S.save); this.camSnap(); } this.updateWorldOnly(sdt); return; }
    this.updateHero(sdt, inp); this.updateWorldOnly(sdt); this.updateCombat(sdt); this.updateItems(sdt, inp); this.updateCamera(dt);
  }
  demoInput() { const t = this.t; const dir = Math.sin(t * 0.5) > 0 ? 1 : -1; return { dir: Math.abs(Math.sin(t * 0.5)) < 0.12 ? 0 : dir, jp: Math.sin(t * 1.9) > 0.995, jh: false, up: false, upp: false, down: false, fire: Math.sin(t * 3) > 0.6, dashp: false }; }
  updateWorldOnly(dt) { /* ambient motes */ if (Math.random() < dt * 8) { const c = this.cam; this.fx.emit({ x: c.x + Math.random() * 960, y: c.y + Math.random() * 540, vx: (Math.random() - 0.5) * 10, vy: -4 - Math.random() * 10, size: 1.8, life: 3, color: rgba("#fff", 0.6), g: 0, glow: true }); } }
  updateHero(dt, inp) {
    const H = this.hero, map = this.map; H.anim += dt; H.inv = Math.max(0, H.inv - dt); this.fireCd = Math.max(0, this.fireCd - dt);
    const dir = H.lock > 0 ? 0 : inp.dir; const wasG = H.onGround;
    const ev = heroPhysics(H, { dir: inp.dir, jp: inp.jp, jh: inp.jh, dashp: inp.dashp, down: inp.down }, dt, map, this.abil);
    if (ev.dash) { H.inv = Math.max(H.inv, 0.28); this.sfx.swing && this.sfx.swing(); }
    if (ev.dashing) { this.fx.emit({ x: H.x - H.face * 10, y: H.y - 22, size: 9, size2: 1, life: 0.3, color: "#9fe8ff", glow: true }); this.dashBreak(); }
    if (ev.jump) this.sfx.jump(); if (ev.dj) { this.sfx.jump(); this.burst(H.x, H.y, 8, "#bfefff", { g: 0, speed: [30, 120], angle: [0.3, Math.PI - 0.3] }); }
    if (ev.wj) { this.sfx.jump(); this.burst(H.x + ev.wj * 12, H.y - 20, 6, "#ddd", { g: 100 }); }
    if (ev.landed !== undefined) { if (ev.landed > 420) { this.sfx.land(); FX.dust(this.fx, H.x, H.y, 5); } H.safeT += dt; if (H.safeT > 0.25 && !this.nearHazard(H)) { H.safe = { x: H.x, y: H.y }; H.safeT = 0; } } else H.safeT = 0;
    if (ev.cling && Math.random() < dt * 14) FX.dust(this.fx, H.x + H.wall * 12, H.y - 20, 1);
    // shooting
    if (inp.fire && this.fireCd <= 0 && H.dash <= 0) {
      this.fireCd = 0.2; const up = inp.up, pw = this.abil.power ? 2 : 1;
      this.shots.push({ x: H.x + (up ? 0 : H.face * 18), y: H.y - (up ? 50 : 26), vx: up ? 0 : H.face * 700, vy: up ? -700 : 0, life: 0.7, dmg: pw, pierce: !!this.abil.power, hits: new Set() }); this.sfx.pistol(); H.recoil = 0.1;
      this.fx.emit({ x: H.x + (up ? 0 : H.face * 22), y: H.y - (up ? 54 : 26), size: 9, size2: 1, life: 0.12, color: "#fff2b0", glow: true });
    }
    H.recoil = Math.max(0, (H.recoil || 0) - dt);
    // room tracking
    const [c, r] = this.roomOf(H.x, H.y - 20); this.explored.add(`${c},${r}`); H.room = `${c},${r}`;
    // arena trigger
    if (!this.locked && H.onGround) for (const it of this.items) if (it.t === "boss" && it.pend && it.room === H.room) { this.lockArena(it.room); this.startBoss(it); }
    // fall out of the world / spikes
    if (this.touchHazard(H)) this.hurtHero(15, true);
    if (H.y > this.W.H * TS + 200) this.hurtHero(15, true);
  }
  touchHazard(b) { const m = this.map; for (let c = m.col(b.x - b.w / 2 + 4); c <= m.col(b.x + b.w / 2 - 4); c++) for (let r = m.row(b.y - b.h + 6); r <= m.row(b.y - 3); r++) if (m.isHazard(c, r)) return true; return false; }
  nearHazard(b) { const m = this.map; for (let c = m.col(b.x) - 1; c <= m.col(b.x) + 1; c++) for (let r = m.row(b.y) - 2; r <= m.row(b.y); r++) if (m.isHazard(c, r)) return true; return false; }
  dashBreak() { const H = this.hero, m = this.map; const c = m.col(H.x + H.face * (H.w / 2 + 6)); for (let r = m.row(H.y - H.h + 4); r <= m.row(H.y - 4); r++) if (m.ch(c, r) === "d") this.breakTile(c, r); }
  breakTile(c, r) { const key = `${c},${r}`; const ch = this.map.cells[r][c]; this.map.set(c, r, "."); this.broken.add(key); this.sfx.breakblock(); FX.debris(this.fx, (c + 0.5) * TS, (r + 0.5) * TS, ch === "d" ? ["#ffb44a", "#ffd88a", "#7a4a1a"] : ["#8a8aa0", "#5a5a70", "#c0c0d0"], 10, 1); this.cam.shake(3, 0.12); this.persist(); }
  hurtHero(d, spike = false) {
    const H = this.hero; if (H.inv > 0 || H.dead) return; H.hp -= d; H.inv = 1.1; this.sfx.hurt(); this.cam.shake(6, 0.25); this.juice.hitstop(0.06); this.burst(H.x, H.y - 22, 14, "#ff6a7a"); this.juice.doFlash(0.25, "#ff0030");
    if (H.hp <= 0) { H.dead = true; H.deadT = 0; this.sfx.die && this.sfx.die(); FX.explosion(this.fx, H.x, H.y - 22, 0.8); return; }
    if (spike) { H.x = H.safe.x; H.y = H.safe.y; H.vx = H.vy = 0; } else { H.vy = -360; H.vx = -(H.face || 1) * 260; H.lock = 0.15; }
  }
  // ---------------------------------------------------------------------------------------------------------------- combat
  updateCombat(dt) {
    const H = this.hero, m = this.map, B = this.boss;
    // hero shots
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i]; s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; let kill = s.life <= 0;
      const c = m.col(s.x), r = m.row(s.y), ch = m.ch(c, r);
      if (ch === "b" || (ch === "G" && false)) { this.breakTile(c, r); kill = true; } else if (ROCK.has(ch)) kill = true;
      if (!kill) for (const e of this.en) { if (e.hp <= 0 || e.room !== H.room && Math.hypot(e.x - H.x, e.y - H.y) > 700) continue; if (Math.abs(s.x - e.x) < e.w / 2 + 6 && s.y > e.y - e.h - 6 && s.y < e.y + 6 && !s.hits.has(e)) { this.hitEnemy(e, s.dmg); s.hits.add(e); if (!s.pierce) { kill = true; break; } } }
      if (!kill && B && B.st !== "intro" && !B.dead && Math.abs(s.x - B.x) < B.w / 2 + 6 && s.y > B.y - B.h - 6 && s.y < B.y + 6) { if (!s.hits.has(B)) { s.hits.add(B); this.hitBoss(s.dmg, s.x, s.y); } if (!s.pierce) kill = true; }
      if (kill) { this.fx.burst(s.x, s.y, 4, { color: "#ffe9a8", speed: [30, 120], size: [1.5, 3], life: [0.12, 0.3], g: 0, glow: true }); this.shots.splice(i, 1); }
    }
    // enemies
    for (const e of this.en) {
      if (e.hp <= 0) continue; e.hit = Math.max(0, e.hit - dt); const near = Math.abs(e.x - H.x) < 900 && Math.abs(e.y - H.y) < 600; if (!near) continue;
      if (e.k === "walker") { e.vy += 2300 * dt; e.vx = e.dir * 62; moveBody(m, e, dt, {}); if (e.hitL) e.dir = 1; else if (e.hitR) e.dir = -1; else if (e.onGround && !m.isSolid(m.col(e.x + e.dir * (e.w / 2 + 6)), m.row(e.y + 4)) && !m.isOneWay(m.col(e.x + e.dir * (e.w / 2 + 6)), m.row(e.y + 4))) e.dir *= -1; if (Math.abs(e.x - e.hx) > 340) e.dir = sign(e.hx - e.x); }
      else if (e.k === "flyer") { e.ph += dt; const d = Math.hypot(H.x - e.x, H.y - 20 - (e.y - 13)); if (d < 330 && H.room === e.room) e.aggro = 2; else e.aggro = Math.max(0, e.aggro - dt); let tx = e.hx + Math.sin(e.ph * 0.8) * 60, ty = e.hy + Math.sin(e.ph * 1.7) * 18; if (e.aggro > 0) { tx = H.x + Math.sin(e.ph * 3) * 40; ty = H.y - 60 + Math.sin(e.ph * 2) * 30; } const dx = tx - e.x, dy = ty - (e.y - 13), L = Math.hypot(dx, dy) || 1, sp = e.aggro > 0 ? 130 : 50; const nx = e.x + (dx / L) * sp * dt, ny = e.y + (dy / L) * sp * dt; if (!m.isSolid(m.col(nx), m.row(e.y - 13))) e.x = nx; if (!m.isSolid(m.col(e.x), m.row(ny - 13))) e.y = ny; }
      else if (e.k === "turret") { e.cd -= dt; if (e.cd <= 0 && Math.hypot(H.x - e.x, H.y - e.y) < 560 && H.room === e.room) { e.cd = 2.1; const a = Math.atan2(H.y - 22 - (e.y - 18), H.x - e.x); this.eb.push({ x: e.x, y: e.y - 18, vx: Math.cos(a) * 270, vy: Math.sin(a) * 270, r: 7, life: 4, dmg: 10, c: "#ff7a5a" }); this.sfx.pistol(); } }
      if (e.hp > 0 && bodiesOverlap(H, e, 6) && H.inv <= 0) this.hurtHero(e.k === "turret" ? 8 : 12);
    }
    // boss
    if (B) this.updateBoss(dt, B);
    // enemy bullets & hazards
    for (let i = this.eb.length - 1; i >= 0; i--) { const b = this.eb[i]; b.life -= dt; if (b.g) b.vy += b.g * dt; b.x += b.vx * dt; b.y += b.vy * dt; let k = b.life <= 0 || ROCK.has(m.ch(m.col(b.x), m.row(b.y))); if (!k && H.inv <= 0 && Math.abs(b.x - H.x) < H.w / 2 + b.r && b.y > H.y - H.h - b.r && b.y < H.y + b.r) { this.hurtHero(b.dmg); k = true; } if (k) { this.burst(b.x, b.y, 4, b.c, { g: 100, life: [0.15, 0.35] }); this.eb.splice(i, 1); } }
    for (let i = this.haz.length - 1; i >= 0; i--) { const z = this.haz[i]; z.t = (z.t || 0) + dt; if (z.vx) z.x += z.vx * dt; if (z.t > z.life || (z.vx && ROCK.has(m.ch(m.col(z.x + Math.sign(z.vx) * z.w / 2), m.row(z.y - 8))))) { this.haz.splice(i, 1); continue; } const on = z.warn === undefined || z.t > z.warn; if (on && H.inv <= 0 && Math.abs(H.x - z.x) < (H.w + z.w) / 2 - 2 && H.y > z.y - z.h && H.y - H.h < z.y) this.hurtHero(z.dmg); if (z.fire && Math.random() < dt * 20) this.fx.emit({ x: z.x + (Math.random() - 0.5) * z.w, y: z.y - 4, vy: -50 - Math.random() * 60, size: 6, size2: 1, life: 0.5, color: "#ffb44a", glow: true }); }
    // orbs
    for (let i = this.orbs.length - 1; i >= 0; i--) { const o = this.orbs[i]; o.vy += 600 * dt; o.y += o.vy * dt; o.x += o.vx * dt; if (ROCK.has(m.ch(m.col(o.x), m.row(o.y + 6)))) { o.y = Math.floor((o.y + 6) / TS) * TS - 6; o.vy = 0; o.vx = 0; } o.life -= dt; if (Math.hypot(o.x - H.x, o.y - (H.y - 20)) < 30) { H.hp = Math.min(this.S.hpMax, H.hp + 8); this.fl.add(H.x, H.y - 60, "+8", "#7dff9a", 16); this.sfx.heal(); this.orbs.splice(i, 1); } else if (o.life <= 0) this.orbs.splice(i, 1); }
  }
  hitEnemy(e, d) { e.hp -= d; e.hit = 0.12; this.juice.hitstop(0.025); this.burst(e.x, e.y - e.h / 2, 5, "#ffe9a8", { g: 100 }); this.sfx.impact && this.sfx.impact(); if (e.hp <= 0) { this.S.kills++; this.sfx.kill && this.sfx.kill(); FX.pop(this.fx, e.x, e.y - e.h / 2, "#ffb0a0", 12); if (Math.random() < 0.4) this.orbs.push({ x: e.x, y: e.y - 20, vx: (Math.random() - 0.5) * 80, vy: -240, life: 12 }); } else e.vx = 0; }
  hitBoss(d, x, y) { const B = this.boss; B.hp -= d; B.hit = 0.1; this.juice.hitstop(0.02); this.sfx.impact && this.sfx.impact(); this.fx.burst(x, y, 5, { color: "#ffe9a8", speed: [50, 180], g: 200, life: [0.2, 0.4] }); if (B.hp <= B.max * 0.5 && B.ph === 1) { B.ph = 2; this.say(`${B.name} is enraged!`, 1.6); this.cam.shake(8, 0.5); this.juice.doFlash(0.4, "#ffddaa"); } if (B.id === "gloamheart" && B.hp <= B.max * 0.25 && B.ph === 2) { B.ph = 3; this.cam.shake(10, 0.6); } if (B.hp <= 0) { B.dead = true; this.bossDie(); } }
  fire(B, ang, sp, o = {}) { this.eb.push({ x: B.x, y: B.y - B.h / 2, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r: 9, life: 5, dmg: 12, c: o.c || "#ff5a8a", g: o.g || 0 }); }
  updateBoss(dt, B) {
    const H = this.hero, m = this.map; B.t += dt; B.hit = Math.max(0, B.hit - dt); B.st_t -= dt; const p2 = B.ph >= 2, fl = this.hero.x < B.x ? -1 : 1, floor = B.oy + 11 * TS, ceil = B.oy + TS, L = B.ox + 1.6 * TS, R = B.ox + 18.4 * TS;
    if (B.st === "intro") { if (B.st_t <= 0) { B.st = "idle"; B.st_t = 1; } return; }
    const touch = () => { if (H.inv <= 0 && bodiesOverlap(H, B, 14)) this.hurtHero(B.id === "gloamheart" ? 18 : 16); };
    const aim = () => Math.atan2(H.y - 24 - (B.y - B.h / 2), H.x - B.x);
    if (B.id === "lanternjaw") {
      B.face = fl;
      if (B.st === "idle") { const tx = B.ox + 10 * TS + Math.sin(B.t * 0.9) * 340, ty = B.oy + 5 * TS + Math.sin(B.t * 1.7) * 30; B.x += (tx - B.x) * Math.min(1, dt * 2.2); B.y += (ty - B.y) * Math.min(1, dt * 2.2); B.cd -= dt; B.cd2 -= dt;
        if (B.cd <= 0) { const n = p2 ? 5 : 3, a = aim(); for (let i = 0; i < n; i++) this.fire(B, a + (i - (n - 1) / 2) * 0.28, 260); B.cd = p2 ? 1.5 : 2.2; this.sfx.pistol(); }
        if (B.cd2 <= 0) { B.st = "tele"; B.st_t = 0.7; } }
      else if (B.st === "tele") { B.x += Math.sin(B.t * 60) * 1.2; if (B.st_t <= 0) { B.st = "dive"; B.st_t = 1.0; B.tx = H.x; B.ty = Math.min(H.y - 10, floor - 10); this.sfx.boom && this.sfx.boom(); } }
      else if (B.st === "dive") { const dx = B.tx - B.x, dy = B.ty - B.y, d = Math.hypot(dx, dy) || 1; B.x += (dx / d) * 560 * dt; B.y += (dy / d) * 560 * dt; if (B.st_t <= 0 || d < 20) { B.st = "idle"; B.cd2 = p2 ? 4 : 6; } }
      B.x = clamp(B.x, L, R); B.y = clamp(B.y, ceil + B.h + 6, floor - 8); touch();
    }
    else if (B.id === "mossback") {
      const sp = p2 ? 1.3 : 1; B.vy = (B.vy || 0) + 2300 * dt;
      if (B.st === "idle") { B.face = fl; B.vx = fl * 90 * sp; if (B.st_t <= 0) { B.st = Math.random() < 0.5 ? "chargeT" : "slamT"; B.st_t = 0.7 / sp; B.vx = 0; this.sfx.boom && this.sfx.boom(); } }
      else if (B.st === "chargeT") { B.vx = 0; B.x += Math.sin(B.t * 70) * 1.3; if (B.st_t <= 0) { B.st = "charge"; B.st_t = 1.8; B.face = fl; } }
      else if (B.st === "charge") { B.vx = B.face * 470 * sp; if (B.hitL || B.hitR || B.st_t <= 0) { B.st = "stun"; B.st_t = 1.0; B.vx = 0; this.cam.shake(9, 0.4); this.sfx.boom && this.sfx.boom(); FX.debris(this.fx, B.x + B.face * 60, B.y - 50, ["#6a4a2a", "#8a6a3a", "#4a7a3a"], 12, 1.3); } }
      else if (B.st === "stun") { B.vx = 0; if (B.st_t <= 0) { B.st = "idle"; B.st_t = 1.6 / sp; } }
      else if (B.st === "slamT") { B.vx = 0; if (B.st_t <= 0) { B.st = "slam"; B.vy = -980; B.vx = clamp((H.x - B.x) / 0.95, -380, 380); B.air = true; } }
      else if (B.st === "slam") { if (B.onGround && B.vy >= 0 && B.t > 0.1) { B.st = "idle"; B.st_t = 1.5 / sp; this.cam.shake(11, 0.5); this.sfx.boom && this.sfx.boom(); const n = p2 ? 2 : 1; for (let k = 0; k < n; k++) for (const d of [-1, 1]) this.haz.push({ x: B.x + d * (70 + k * 120), y: B.y, w: 36, h: 34, vx: d * 330, life: 3, dmg: 14, wave: true, fire: false }); B.vx = 0; } }
      moveBody(m, B, dt, {}); B.y = Math.min(B.y, floor); B.x = clamp(B.x, L + 40, R - 40); touch();
    }
    else if (B.id === "cinderwyrm") {
      const sp = p2 ? 1.35 : 1;
      if (B.st === "idle") { B.x += B.dir * 210 * sp * dt; if (B.x > R - 40) B.dir = -1; if (B.x < L + 40) B.dir = 1; B.face = B.dir; B.y += (B.oy + (3.4 + Math.sin(B.t * 2) * 0.35) * TS - B.y) * Math.min(1, dt * 3); B.cd -= dt; B.cd2 -= dt;
        if (B.cd <= 0) { B.cd = p2 ? 1.1 : 1.6; const n = p2 ? 3 : 1; for (let i = 0; i < n; i++) this.eb.push({ x: B.x + (i - (n - 1) / 2) * 50, y: B.y, vx: (i - (n - 1) / 2) * 60, vy: 80, r: 11, life: 4, dmg: 13, c: "#ff8a3a", g: 520 }); this.sfx.pistol(); }
        if (B.cd2 <= 0) { B.st = "tele"; B.st_t = 0.85; B.tx = H.x; } }
      else if (B.st === "tele") { B.x += (B.tx - B.x) * Math.min(1, dt * 5); if (B.st_t <= 0) { B.st = "dive"; } }
      else if (B.st === "dive") { B.y += 780 * dt; if (B.y >= floor - 24) { B.y = floor - 24; B.st = "rise"; B.st_t = 0.6; this.cam.shake(10, 0.4); this.sfx.boom && this.sfx.boom(); for (const d of [-1, 1]) this.haz.push({ x: B.x + d * 80, y: floor, w: 70, h: 36, life: 3.2, dmg: 12, fire: true }); } }
      else if (B.st === "rise") { if (B.st_t <= 0) { B.y -= 300 * dt; if (B.y <= B.oy + 3.6 * TS) { B.st = "idle"; B.cd2 = p2 ? 4 : 5.5; } } }
      B.x = clamp(B.x, L, R); touch();
    }
    else if (B.id === "gloamheart") {
      B.y = B.oy + 5 * TS + Math.sin(B.t * 1.4) * 14; B.rot += dt * (p2 ? 1.6 : 1); B.cd -= dt; B.cd2 -= dt; const sp = B.ph === 3 ? 0.65 : 1;
      if (B.cd <= 0) { B.cd = 2.6 * sp; const n = 12 + (B.ph - 1) * 2, off = Math.random() * TAU; for (let i = 0; i < n; i++) this.fire(B, off + (i / n) * TAU, 150 + B.ph * 20); this.sfx.pistol(); if (B.ph >= 2) for (let i = -1; i <= 1; i++) this.fire(B, aim() + i * 0.22, 280); }
      if (B.ph >= 2 && B.cd2 <= 0) { B.cd2 = 1.6 * sp; const x = clamp(H.x, L, R); this.haz.push({ x, y: floor, w: 54, h: floor - ceil, warn: 0.7, life: 1.1, dmg: 18, rock: true }); }
      if (B.ph >= 1 && B.t - (B.spawnT || 0) > 9 && this.en.filter((e) => e.hp > 0 && e.room === B.room).length < 2) { B.spawnT = B.t; this.en.push({ k: "flyer", x: B.x + (Math.random() < 0.5 ? -200 : 200), y: B.y + 40, w: 28, h: 26, hp: 2, hx: B.x, hy: B.y + 60, ph: 0, hit: 0, room: B.room, vx: 0, vy: 0, aggro: 3 }); }
      touch();
    }
  }
  // ---------------------------------------------------------------------------------------------------------------- items
  updateItems(dt, inp) {
    const H = this.hero; this.prompt = null;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i]; if (it.t === "boss") continue; const near = Math.abs(it.x - H.x) < 34 && H.y > it.y - 70 && H.y - H.h < it.y + 10;
      if (it.t === "spark" && near) { this.got.add(it.id); this.items.splice(i, 1); this.sfx.gem(); FX.pop(this.fx, it.x, it.y - 20, "#8be9ff", 14); this.fl.add(it.x, it.y - 50, `Spark ${[...this.got].filter((g) => g.startsWith("sp_")).length}/12`, "#8be9ff", 18); this.persist(); }
      else if (it.t === "life" && near) { this.got.add(it.id); this.items.splice(i, 1); this.S.hpMax += 25; H.hp = this.S.hpMax; this.sfx.powerup(); FX.pop(this.fx, it.x, it.y - 20, "#ff7a9a", 18); this.say("Max health up!", 2.2); this.persist(); }
      else if (it.t === "pedestal" && near) { this.abil[it.id] = true; this.S.abil = this.abil; this.items.splice(i, 1); const [n, d] = ABILITIES[it.id]; this.banner = { title: n, text: d, t: 0 }; this.sfx.powerup(); this.juice.doFlash(0.6, "#bff"); this.persist(); }
      else if (it.t === "save" && near) { this.prompt = "Up: rest"; if (inp.upp || (inp.up && !it.rest)) { if (inp.upp) { H.hp = this.S.hpMax; this.S.save = it.id; this.S.abil = this.abil; this.sfx.checkpoint(); FX.pop(this.fx, it.x, it.y - 40, "#9bffb0", 16); this.say("Rested. Progress saved.", 1.6); this.persist(); this.makeEnemies(); this.eb.length = 0; } } }
      else if (it.t === "sign" && near) { this.msg = it.text; this.msgT = 0.2; }
    }
    if (this.msgT > 0 && this.msgT < 0.2 && this.msg) { /* keep */ }
  }
  updateCamera(dt) { const H = this.hero, [c, r] = this.roomOf(H.x, H.y - 20), cam = this.cam; const rx = c * RW * TS, ry = r * RH * TS; const ty = clamp(H.y - 300, ry, ry + RH * TS - 540); cam.x = damp(cam.x, rx, 9, dt); cam.y = damp(cam.y, ty, 9, dt); }
  finish() {
    if (this.done) return; const sp = [...this.got].filter((g) => g.startsWith("sp_")).length, lf = [...this.got].filter((g) => g.startsWith("lf_")).length, items = sp + lf, t = this.S.time;
    const score = Math.round(sp * 400 + lf * 600 + this.S.kills * 20 + Math.max(0, 3600 - t) * 2 + 3000 - this.S.deaths * 100);
    const stars = 1 + (items >= 12 ? 1 : 0) + (items >= 17 ? 1 : 0);
    this.done = { won: true, score: Math.max(0, score), stars, title: "THE HEART IS STILL", sub: "The Gloamreach is quiet.", delay: 0.4, lines: [["Sparks", `${sp} / 12`], ["Life crystals", `${lf} / 5`], ["Time", secondsLabel(t)], ["Falls", String(this.S.deaths)]] };
    try { localStorage.removeItem(SAVE_KEY); } catch {}
  }

  // ---------------------------------------------------------------------------------------------------------------- drawing
  draw(g) {
    const cam = this.cam, m = this.map, t = this.t, c0 = Math.max(0, Math.floor(cam.x / (RW * TS))), c1 = Math.min(COLS - 1, Math.floor((cam.x + 959) / (RW * TS))), r0 = Math.max(0, Math.floor(cam.y / (RH * TS))), r1 = Math.min(ROWS - 1, Math.floor((cam.y + 539) / (RH * TS)));
    g.fillStyle = "#06020c"; g.fillRect(0, 0, 960, 540);
    cam.begin(g);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const A = this.W.rooms[`${c},${r}`]; if (A) this.drawBack(g, A, cam); }
    this.drawTiles(g, c0, c1, r0, r1);
    for (const h of this.haz) this.drawHaz(g, h);
    for (const it of this.items) this.drawItem(g, it, t);
    for (const e of this.en) if (e.hp > 0 && cam.visible(e.x - 40, e.y - 80, 80, 90)) this.drawEnemy(g, e, t);
    if (this.boss) this.drawBoss(g, this.boss, t);
    for (const o of this.orbs) { glow(g, o.x, o.y, 22, "#7dff9a", 0.5); circle(g, o.x, o.y, 5, "#b6ffc8", OUT, 1.5); }
    this.drawHero(g, t);
    for (const s of this.shots) { glow(g, s.x, s.y, 20, "#ffe9a8", 0.6); ellipse(g, s.x, s.y, s.vy ? 4 : 11, s.vy ? 11 : 4, "#fff6c8", null); }
    for (const b of this.eb) { glow(g, b.x, b.y, 24, b.c, 0.55); circle(g, b.x, b.y, b.r, b.c, "#fff", 1.5); }
    this.fx.draw(g); this.fl.draw(g);
    cam.end(g);
    this.drawDark(g, cam);
    this.drawHUD(g);
    if (this.showMap) this.drawMap(g);
    if (this.banner) this.drawBanner(g);
    this.juice.draw(g, 960, 540);
  }
  drawBack(g, A, cam) {
    const T = THEMES[A.theme], x0 = A.ox * TS, y0 = A.oy * TS, w = RW * TS, h = RH * TS, par = (k) => (cam.x - x0) * k; g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
    const gr = g.createLinearGradient(0, y0, 0, y0 + h); gr.addColorStop(0, T.sky[0]); gr.addColorStop(1, T.sky[1]); g.fillStyle = gr; g.fillRect(x0, y0, w, h);
    for (let L = 0; L < 2; L++) { g.fillStyle = L ? T.mid : T.far; for (let i = -1; i < 12; i++) { const k = hash2(A.c * 7 + i, A.r * 3 + L, 5), bx = x0 + i * 100 + k * 40 + par(L ? 0.25 : 0.12), bh = (L ? 150 : 220) * (0.5 + k); g.beginPath(); if (A.theme === "moss") { g.moveTo(bx - 30, y0 + h - 70); g.lineTo(bx, y0 + h - 70 - bh); g.lineTo(bx + 30, y0 + h - 70); } else if (A.theme === "crystal") { g.moveTo(bx - 20, y0 + h - 60); g.lineTo(bx - 4, y0 + h - 60 - bh); g.lineTo(bx + 14, y0 + h - 60 - bh * 0.7); g.lineTo(bx + 24, y0 + h - 60); } else if (A.theme === "ember") { g.rect(bx - 24, y0 + h - 70 - bh * 0.7, 48, bh * 0.7); } else { g.moveTo(bx - 26, y0); g.lineTo(bx, y0 + bh * 0.8); g.lineTo(bx + 26, y0); g.moveTo(bx - 26, y0 + h - 60); g.lineTo(bx, y0 + h - 60 - bh * 0.5); g.lineTo(bx + 26, y0 + h - 60); } g.fill(); } }
    g.restore();
  }
  drawTiles(g, c0, c1, r0, r1) {
    const cam = this.cam, m = this.map, cs = Math.max(0, Math.floor(cam.x / TS)), ce = Math.min(m.cols - 1, Math.floor((cam.x + 960) / TS)), rs = Math.max(0, Math.floor(cam.y / TS)), re = Math.min(m.rows - 1, Math.floor((cam.y + 540) / TS)), t = this.t;
    for (let r = rs; r <= re; r++) for (let c = cs; c <= ce; c++) {
      const ch = m.cells[r][c]; if (ch === ".") continue; const x = c * TS, y = r * TS, A = this.W.rooms[`${Math.floor(c / RW)},${Math.floor(r / RH)}`], T = THEMES[A ? A.theme : "gloam"];
      if (ch === "#" || ch === "b" || ch === "d" || ch === "G" || ch === "K") {
        const k = hash2(c, r, 3); g.fillStyle = shade(T.rock, (k - 0.5) * 0.07); g.fillRect(x, y, TS, TS);
        const up = ROCK.has(m.ch(c, r - 1)), dn = ROCK.has(m.ch(c, r + 1)), lf = ROCK.has(m.ch(c - 1, r)), rt = ROCK.has(m.ch(c + 1, r));
        if (!up) { g.fillStyle = T.top; g.fillRect(x, y, TS, 5); g.fillStyle = shade(T.top, 0.3); g.fillRect(x, y, TS, 2); }
        g.fillStyle = "rgba(0,0,0,.28)"; if (!dn) g.fillRect(x, y + TS - 5, TS, 5); if (!lf) g.fillRect(x, y, 4, TS); if (!rt) g.fillRect(x + TS - 4, y, 4, TS);
        if (k > 0.78) { g.fillStyle = "rgba(255,255,255,.06)"; g.fillRect(x + k * 20, y + 14, 12, 3); }
        if (ch === "b") { g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(x + 4, y + 4, TS - 8, TS - 8); g.strokeStyle = "#c8c8e0"; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 10, y + 8); g.lineTo(x + 24, y + 22); g.lineTo(x + 18, y + 30); g.lineTo(x + 36, y + 42); g.moveTo(x + 24, y + 22); g.lineTo(x + 38, y + 14); g.stroke(); }
        else if (ch === "d") { g.fillStyle = "#c27a2a"; g.fillRect(x + 2, y + 2, TS - 4, TS - 4); g.fillStyle = "#ffcf7a"; g.fillRect(x + 6, y + 6, TS - 12, 6); g.strokeStyle = "#5a2e0a"; g.lineWidth = 2; g.strokeRect(x + 2, y + 2, TS - 4, TS - 4); g.beginPath(); g.moveTo(x + 8, y + 40); g.lineTo(x + 22, y + 24); g.lineTo(x + 40, y + 36); g.stroke(); }
        else if (ch === "G") { g.fillStyle = `rgba(200,80,255,${0.55 + Math.sin(t * 4 + r) * 0.2})`; g.fillRect(x + 4, y, TS - 8, TS); g.fillStyle = "rgba(255,255,255,.7)"; g.fillRect(x + TS / 2 - 2, y, 4, TS); }
        else if (ch === "K") { g.fillStyle = `rgba(255,70,90,${0.5 + Math.sin(t * 8) * 0.2})`; g.fillRect(x + 6, y, TS - 12, TS); g.fillStyle = "rgba(255,230,230,.8)"; g.fillRect(x + TS / 2 - 2, y, 4, TS); }
      } else if (ch === "=") { g.fillStyle = shade(T.top, -0.2); g.fillRect(x, y, TS, 10); g.fillStyle = T.top; g.fillRect(x, y, TS, 4); g.fillStyle = "rgba(255,255,255,.35)"; g.fillRect(x, y, TS, 1.5); g.fillStyle = "rgba(0,0,0,.35)"; g.fillRect(x + 6, y + 10, 4, 8); g.fillRect(x + TS - 10, y + 10, 4, 8); }
      else if (ch === "^") { g.fillStyle = "#c9c9e4"; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x + i * 16, y + TS); g.lineTo(x + i * 16 + 8, y + 14); g.lineTo(x + i * 16 + 16, y + TS); g.fill(); } g.fillStyle = "rgba(255,80,110,.5)"; g.fillRect(x, y + TS - 4, TS, 4); }
    }
  }
  drawHaz(g, h) {
    if (h.wave) { glow(g, h.x, h.y - 16, 46, "#ff9a4a", 0.5); poly(g, [[h.x - 18, h.y], [h.x, h.y - h.h], [h.x + 18, h.y]], "#ffb44a", OUT, 2); return; }
    if (h.fire) { glow(g, h.x, h.y - 14, 60, "#ff8a3a", 0.6); for (let i = 0; i < 4; i++) { const fx = h.x - h.w / 2 + (i + 0.5) * (h.w / 4), fh = 18 + Math.sin(this.t * 14 + i * 2) * 8 + 10; poly(g, [[fx - 9, h.y], [fx, h.y - fh], [fx + 9, h.y]], i % 2 ? "#ffd05a" : "#ff7a2a", null); } return; }
    if (h.rock) { const on = h.t > h.warn; if (!on) { g.fillStyle = `rgba(255,60,90,${0.15 + Math.sin(this.t * 24) * 0.1})`; g.fillRect(h.x - h.w / 2, h.y - h.h, h.w, h.h); } else { g.fillStyle = "#e8b8ff"; g.fillRect(h.x - h.w / 2, h.y - h.h, h.w, h.h); glow(g, h.x, h.y - h.h / 2, 120, "#d070ff", 0.5); } }
  }
  drawItem(g, it, t) {
    if (!this.cam.visible(it.x - 60, it.y - 120, 120, 140)) return;
    if (it.t === "spark") { const y = it.y - 22 + Math.sin(t * 2 + it.bob) * 4; glow(g, it.x, y, 40, "#8be9ff", 0.6); poly(g, [[it.x, y - 12], [it.x + 8, y], [it.x, y + 12], [it.x - 8, y]], "#c8f6ff", OUT, 2); }
    else if (it.t === "life") { const y = it.y - 22 + Math.sin(t * 2 + it.bob) * 4; glow(g, it.x, y, 44, "#ff7a9a", 0.6); circle(g, it.x - 6, y - 3, 8, "#ff5a8a", OUT, 2); circle(g, it.x + 6, y - 3, 8, "#ff5a8a", OUT, 2); poly(g, [[it.x - 14, y], [it.x + 14, y], [it.x, y + 16]], "#ff5a8a", OUT, 2); }
    else if (it.t === "save") { glow(g, it.x, it.y - 30, 70, "#9bffb0", 0.35 + Math.sin(t * 2) * 0.1); g.fillStyle = "#3a5a4a"; g.fillRect(it.x - 14, it.y - 40, 28, 40); g.fillStyle = "#58806a"; g.fillRect(it.x - 18, it.y - 6, 36, 6); circle(g, it.x, it.y - 50 + Math.sin(t * 3) * 2, 8, "#d8ffe0", OUT, 2); }
    else if (it.t === "pedestal") { glow(g, it.x, it.y - 46, 110, "#bfefff", 0.5); g.fillStyle = "#5a5a78"; g.fillRect(it.x - 22, it.y - 28, 44, 28); g.fillStyle = "#8a8aa8"; g.fillRect(it.x - 26, it.y - 32, 52, 6); poly(g, [[it.x, it.y - 74 + Math.sin(t * 2) * 4], [it.x + 12, it.y - 56], [it.x, it.y - 40], [it.x - 12, it.y - 56]], "#e8fbff", OUT, 2); }
    else if (it.t === "sign") { g.fillStyle = "#6a4a2a"; g.fillRect(it.x - 3, it.y - 30, 6, 30); fillRR(g, it.x - 16, it.y - 46, 32, 20, 4, "#8a6a3a", OUT, 2); }
  }
  drawEnemy(g, e, t) {
    const flash = e.hit > 0;
    if (e.k === "walker") { g.save(); g.translate(e.x, e.y); g.scale(e.dir, 1); ellipse(g, 0, -14, 17, 14, flash ? "#fff" : "#6a8a3a", OUT, 2); for (let i = -1; i <= 1; i++) poly(g, [[i * 9 - 5, -24], [i * 9, -34], [i * 9 + 5, -24]], flash ? "#fff" : "#a4c84a", OUT, 1.5); circle(g, 8, -16, 4, "#fff", OUT, 1.5); circle(g, 9, -16, 1.8, "#111"); const s = Math.sin(t * 10 + e.x) * 3; capsule(g, -6, -3, -6 + s, 2, 5, "#4a6a2a", OUT, 1.5); capsule(g, 6, -3, 6 - s, 2, 5, "#4a6a2a", OUT, 1.5); g.restore(); }
    else if (e.k === "flyer") { const y = e.y - 13; glow(g, e.x, y, 34, "#c06aff", 0.4); const f = Math.sin(t * 22 + e.x) * 8; poly(g, [[e.x, y], [e.x - 22, y - 10 - f], [e.x - 10, y + 6]], flash ? "#fff" : "#5a2a8a", OUT, 1.5); poly(g, [[e.x, y], [e.x + 22, y - 10 - f], [e.x + 10, y + 6]], flash ? "#fff" : "#5a2a8a", OUT, 1.5); ellipse(g, e.x, y, 10, 11, flash ? "#fff" : "#7a3ab0", OUT, 2); circle(g, e.x - 3, y - 2, 2.5, "#ffef6a"); circle(g, e.x + 3, y - 2, 2.5, "#ffef6a"); }
    else if (e.k === "turret") { g.fillStyle = flash ? "#fff" : "#7a4a3a"; fillRR(g, e.x - 17, e.y - 24, 34, 24, 6, flash ? "#fff" : "#7a4a3a", OUT, 2); const a = Math.atan2(this.hero.y - 22 - (e.y - 18), this.hero.x - e.x); capsule(g, e.x, e.y - 18, e.x + Math.cos(a) * 22, e.y - 18 + Math.sin(a) * 22, 8, "#3a2a2a", OUT, 2); circle(g, e.x, e.y - 18, 7, e.cd < 0.4 ? "#ff6a4a" : "#caa", OUT, 1.5); }
  }
  drawBoss(g, B, t) {
    const f = B.hit > 0, x = B.x, y = B.y, c = (k, k2) => (f ? "#fff" : k), tint = B.st === "tele" || B.st === "chargeT" || B.st === "slamT";
    g.save();
    if (B.id === "lanternjaw") { g.translate(x, y - B.h / 2); g.scale(B.face >= 0 ? 1 : -1, 1); if (tint) g.translate(Math.sin(t * 80) * 2, 0); glow(g, 70, 18, 120, "#9fffe0", 0.5); ellipse(g, 0, 0, 52, 36, c("#2a5a8a"), OUT, 3); poly(g, [[-52, 0], [-90, -20], [-84, 22]], c("#2a5a8a"), OUT, 3); poly(g, [[-10, -34], [8, -62], [24, -30]], c("#3a7aaa"), OUT, 3); circle(g, 28, -8, 11, "#fff", OUT, 2); circle(g, 31, -8, 5, "#111"); g.beginPath(); g.moveTo(10, 10); for (let i = 0; i < 6; i++) g.lineTo(14 + i * 8, i % 2 ? 12 : 26); g.lineTo(52, 10); g.closePath(); g.fillStyle = "#fff"; g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke(); g.strokeStyle = "#1a2a4a"; g.lineWidth = 3; g.beginPath(); g.moveTo(24, -30); g.quadraticCurveTo(70, -70, 78, -34); g.stroke(); circle(g, 78, -34, 11, "#e0fff0", OUT, 2); }
    else if (B.id === "mossback") { g.translate(x, y); g.scale(B.face >= 0 ? 1 : -1, 1); if (tint) g.translate(Math.sin(t * 80) * 2, 0); const sq = B.st === "slamT" ? 0.85 : 1; g.scale(1, sq); ellipse(g, 0, -42, 60, 42, c("#5a4030"), OUT, 3); for (let i = -2; i <= 2; i++) poly(g, [[i * 22 - 12, -74], [i * 22, -96 + Math.abs(i) * 6], [i * 22 + 12, -74]], c("#4a8a3a"), OUT, 2.5); ellipse(g, 44, -38, 28, 24, c("#6a5040"), OUT, 3); poly(g, [[56, -26], [76, -36], [62, -14]], "#f4ecd0", OUT, 2); circle(g, 50, -48, 6, "#ffd23a", OUT, 1.5); circle(g, 51, -48, 2.5, "#111"); const s = Math.sin(t * 8) * (B.st === "charge" ? 10 : 4); capsule(g, -28, -8, -28 + s, 0, 14, "#4a3424", OUT, 2); capsule(g, 24, -8, 24 - s, 0, 14, "#4a3424", OUT, 2); }
    else if (B.id === "cinderwyrm") { g.translate(0, 0); for (let i = 7; i >= 0; i--) { const sx = x - B.dir * i * 28, sy = y - 26 + Math.sin(t * 6 - i * 0.7) * 10; const r = 22 - i * 1.5; glow(g, sx, sy, r * 3, "#ff7a2a", 0.25); circle(g, sx, sy, r, c(i % 2 ? "#a83a1a" : "#c84a22"), OUT, 3); } g.translate(x, y - 26); g.scale(B.dir >= 0 ? 1 : -1, 1); ellipse(g, 6, 0, 30, 22, c("#d85a2a"), OUT, 3); poly(g, [[-6, -18], [4, -44], [14, -18]], "#ffb44a", OUT, 2); poly(g, [[16, -16], [34, -38], [30, -12]], "#ffb44a", OUT, 2); circle(g, 20, -4, 6, "#ffef6a", OUT, 1.5); circle(g, 22, -4, 2.5, "#111"); }
    else if (B.id === "gloamheart") { g.translate(x, y - B.h / 2); glow(g, 0, 0, 220, "#d070ff", 0.45 + Math.sin(t * 3) * 0.1); for (let i = 0; i < 6; i++) { const a = B.rot + (i / 6) * TAU; circle(g, Math.cos(a) * 92, Math.sin(a) * 92, 11, "#e8b0ff", OUT, 2); } g.beginPath(); g.moveTo(0, 54); g.bezierCurveTo(-86, 0, -52, -66, 0, -26); g.bezierCurveTo(52, -66, 86, 0, 0, 54); g.fillStyle = c("#7a1a9a"); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke(); const pulse = 1 + Math.sin(t * 5) * 0.06; ellipse(g, 0, 4, 22 * pulse, 28 * pulse, "#fff0ff", OUT, 3); ellipse(g, 0, 6, 8, 18, "#2a0a3a", null); }
    g.restore();
  }
  drawHero(g, t) {
    const H = this.hero; if (H.dead) { if (Math.floor(H.deadT * 14) % 2 === 0) return; }
    if (H.inv > 0 && !H.dead && Math.floor(H.inv * 16) % 2 === 0) g.globalAlpha = 0.45;
    const moving = H.onGround && Math.abs(H.vx) > 30, sw = moving ? Math.sin(H.anim * 16) : 0, air = !H.onGround, f = H.face >= 0 ? 1 : -1;
    g.save(); g.translate(H.x, H.y); g.scale(f, 1); if (H.dash > 0) g.scale(1.25, 0.85);
    const bob = moving ? Math.abs(sw) * 2 : Math.sin(H.anim * 3) * 1;
    capsule(g, -5, -14, -5 + (air ? 3 : sw * 7), -2, 7, "#2a3a5a", OUT, 2); capsule(g, 5, -14, 5 + (air ? -3 : -sw * 7), -2, 7, "#2a3a5a", OUT, 2);
    g.translate(0, -bob); const sl = H.wall ? 0 : (air ? (H.vy < 0 ? -6 : 6) : 0);
    poly(g, [[-12, -42], [12, -42], [16 + sl, -10], [-16 - sl, -10]], "#2a8a8a", OUT, 2.5); poly(g, [[-12, -42], [-20 - Math.abs(H.vx) * 0.03, -14], [-14, -12]], "#1d6a6a", OUT, 2);
    ellipse(g, 2, -46, 12, 12, "#2a8a8a", OUT, 2.5); ellipse(g, 6, -45, 7, 7, "#0a1a2a", null); circle(g, 8, -46, 2.4, "#9ffcff"); circle(g, 4, -46, 2.4, "#9ffcff");
    glow(g, 8, -45, 22, "#9ffcff", 0.35);
    const rc = H.recoil > 0 ? -3 : 0, up = false; capsule(g, 4, -32, 20 + rc, -28, 7, "#2a8a8a", OUT, 2); fillRR(g, 16 + rc, -34, 16, 10, 3, "#7a7a98", OUT, 2); circle(g, 32 + rc, -29, 5, "#ffe9a8", OUT, 1.5); glow(g, 32 + rc, -29, 24, "#ffe9a8", 0.5);
    g.restore(); g.globalAlpha = 1;
  }
  drawDark(g, cam) {
    if (!this.dark) { this.dark = makeCanvas(960, 540); } const d = this.dark.getContext("2d"), H = this.hero;
    d.globalCompositeOperation = "source-over"; d.clearRect(0, 0, 960, 540); const A = this.W.rooms[H.room || "0,2"], base = A && (A.theme === "cave" ? 0.74 : A.theme === "gloam" ? 0.7 : 0.6);
    d.fillStyle = `rgba(3,1,10,${base || 0.62})`; d.fillRect(0, 0, 960, 540); d.globalCompositeOperation = "destination-out";
    const hole = (wx, wy, r, a = 1) => { const x = wx - cam.x, y = wy - cam.y; if (x < -r || x > 960 + r || y < -r || y > 540 + r) return; const gr = d.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, "rgba(0,0,0,0)"); d.fillStyle = gr; d.fillRect(x - r, y - r, r * 2, r * 2); };
    hole(H.x, H.y - 26, 300, 1); for (const it of this.items) if (it.t === "save") hole(it.x, it.y - 30, 200, 0.9); else if (it.t === "spark" || it.t === "life") hole(it.x, it.y - 20, 110, 0.8); else if (it.t === "pedestal") hole(it.x, it.y - 50, 200, 1);
    for (const s of this.shots) hole(s.x, s.y, 80, 0.7); for (const b of this.eb) hole(b.x, b.y, 80, 0.6); for (const h of this.haz) if (h.fire || h.wave) hole(h.x, h.y - 14, 140, 0.8); if (this.boss) hole(this.boss.x, this.boss.y - this.boss.h / 2, 260, 0.85);
    d.globalCompositeOperation = "source-over"; g.drawImage(this.dark, 0, 0);
  }
  drawHUD(g) {
    const H = this.hero, max = this.S.hpMax, w = 40 + (max - 100) * 0.9;
    fillRR(g, 22, 20, w + 12, 24, 12, "rgba(8,4,20,.75)", "rgba(255,255,255,.3)", 2); fillRR(g, 28, 26, Math.max(0, (w * H.hp) / max), 12, 6, H.hp < max * 0.3 ? "#ff5a6a" : "#6aff9a", null);
    const sp = [...this.got].filter((x) => x.startsWith("sp_")).length; poly(g, [[36, 62], [42, 70], [36, 78], [30, 70]], "#c8f6ff", OUT, 1.5); text(g, `${sp}/12`, 50, 76, { size: 14, color: "#c8f6ff", font: FONT_DISPLAY, weight: 800, stroke: OUT, strokeW: 3 });
    let ax = 22; for (const k of ["dj", "dash", "wall", "power"]) { const on = this.abil[k]; fillRR(g, ax, 88, 26, 26, 7, on ? "rgba(255,226,122,.3)" : "rgba(8,4,20,.6)", on ? "#ffe27a" : "rgba(255,255,255,.2)", 1.5); text(g, { dj: "2J", dash: "»", wall: "W", power: "★" }[k], ax + 13, 107, { size: 13, color: on ? "#fff" : "#4a4468", align: "center", font: FONT_DISPLAY, weight: 800 }); ax += 30; }
    // minimap
    const mx = 770, my = 18, cw = 20, ch = 14; fillRR(g, mx - 6, my - 6, COLS * cw + 12, ROWS * ch + 12, 8, "rgba(8,4,20,.7)", "rgba(255,255,255,.25)", 1.5);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const k = `${c},${r}`, A = this.W.rooms[k]; if (!A || !this.explored.has(k)) continue; g.fillStyle = THEMES[A.theme].top; g.globalAlpha = k === this.hero.room ? 1 : 0.55; g.fillRect(mx + c * cw + 1, my + r * ch + 1, cw - 2, ch - 2); g.globalAlpha = 1; }
    if (this.hero.room) { const [c, r] = this.hero.room.split(",").map(Number); g.strokeStyle = "#fff"; g.lineWidth = 2; g.strokeRect(mx + c * cw, my + r * ch, cw, ch); }
    if (this.boss && this.boss.st !== "intro") { const B = this.boss, bw = 460; fillRR(g, 250, 488, bw, 18, 9, "rgba(8,4,20,.8)", "rgba(255,255,255,.4)", 2); fillRR(g, 254, 492, Math.max(0, ((bw - 8) * B.hp) / B.max), 10, 5, "#ff5a8a", null); text(g, B.name, 480, 482, { size: 15, color: "#fff", align: "center", font: FONT_DISPLAY, weight: 800, stroke: OUT, strokeW: 4 }); }
    if (this.prompt) text(g, this.prompt, 480, 430, { size: 16, color: "#fff", align: "center", font: FONT_BODY, weight: 700, stroke: OUT, strokeW: 4 });
    if (this.msgT > 0 && this.msg) { const w2 = Math.max(260, this.msg.length * 9 + 40); fillRR(g, 480 - w2 / 2, 440, w2, 40, 12, "rgba(8,4,20,.82)", "rgba(255,255,255,.3)", 2); text(g, this.msg, 480, 466, { size: 16, color: "#fff", align: "center", font: FONT_BODY, weight: 700 }); }
  }
  drawMap(g) {
    g.fillStyle = "rgba(4,2,12,.92)"; g.fillRect(0, 0, 960, 540); text(g, "MAP", 480, 70, { size: 34, color: "#ffe27a", align: "center", font: FONT_DISPLAY, weight: 800 });
    const cw = 130, ch = 78, ox = 480 - (COLS * cw) / 2, oy = 100;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const k = `${c},${r}`, A = this.W.rooms[k]; if (!A) continue; const seen = this.explored.has(k); g.fillStyle = seen ? rgba(THEMES[A.theme].top, 0.7) : "rgba(255,255,255,.06)"; g.fillRect(ox + c * cw + 3, oy + r * ch + 3, cw - 6, ch - 6); if (seen) { g.strokeStyle = "#fff"; g.lineWidth = 1.5; g.strokeRect(ox + c * cw + 3, oy + r * ch + 3, cw - 6, ch - 6); text(g, A.name, ox + c * cw + cw / 2, oy + r * ch + ch / 2 + 4, { size: 11, color: "#fff", align: "center", font: FONT_BODY, weight: 700, stroke: OUT, strokeW: 3 }); for (const e of this.W.ents) if (e.room === k && e.t === "save") circle(g, ox + c * cw + 14, oy + r * ch + 14, 5, "#9bffb0", OUT, 1.5); if (A.doors.includes("R")) g.fillRect(ox + (c + 1) * cw - 4, oy + r * ch + ch / 2 - 6, 8, 12); if (A.doors.includes("B")) g.fillRect(ox + c * cw + cw / 2 - 6, oy + (r + 1) * ch - 4, 12, 8); } }
    if (this.hero.room) { const [c, r] = this.hero.room.split(",").map(Number); circle(g, ox + c * cw + cw / 2, oy + r * ch + 16, 7 + Math.sin(this.t * 6) * 1.5, "#ffe27a", OUT, 2); }
    text(g, "Press Tab, Q or E to close", 480, 500, { size: 14, color: "#c9b8ff", align: "center", font: FONT_BODY, weight: 600 });
  }
  drawBanner(g) {
    const B = this.banner; g.fillStyle = "rgba(4,2,12,.8)"; g.fillRect(0, 0, 960, 540); glow(g, 480, 250, 300, "#ffe27a", 0.35);
    text(g, "NEW ABILITY", 480, 190, { size: 18, color: "#c9b8ff", align: "center", font: FONT_BODY, weight: 700 }); text(g, B.title, 480, 260, { size: 64, color: "#ffe27a", align: "center", font: FONT_DISPLAY, weight: 800, stroke: OUT, strokeW: 8 }); text(g, B.text, 480, 312, { size: 20, color: "#fff", align: "center", font: FONT_BODY, weight: 600 });
    if (B.t > 0.8) text(g, "Press Enter to continue", 480, 380, { size: 16, color: "#c9b8ff", align: "center", font: FONT_BODY, weight: 600 });
  }
}

const touch = [
  { act: "up", label: "▲", x: 70, y: 340, d: 60 }, { act: "left", label: "◀", x: 14, y: 410, d: 80 }, { act: "right", label: "▶", x: 112, y: 410, d: 80 },
  { act: "jump", label: "JUMP", x: 838, y: 398, d: 100, fs: 17 }, { act: "fire", label: "FIRE", x: 736, y: 430, d: 80, fs: 15 }, { act: "alt", label: "DASH", x: 760, y: 336, d: 70, fs: 13 }, { act: "swap", label: "MAP", x: 860, y: 296, d: 64, fs: 12 },
];
const def = {
  get unlockAll() { return typeof window !== "undefined" && !!window.__QA_UNLOCK; },
  id: "gloamreach", title: "Gloamreach", titleSize: 92, genreLabel: "Metroidvania · Power Pass", accent: "#9bffb0", music: "puzzle", touch,
  tagline: "One dark, glowing map. Four lost abilities. A heart that will not stop beating.",
  goal: "Explore the connected map. Beat the three guardians (Lanternjaw, Mossback and Cinderwyrm) to open the way to the Gloam Heart. New abilities open old doors, so remember where you could not go.",
  controls: [["← → or A D", "Move"], ["Space, Z or K", "Jump (again in the air with Double Jump)"], ["X, J or F", "Fire (hold ↑ to shoot upward)"], ["C, L or Shift", "Dash (once learned)"], ["↑ at a statue", "Rest and save"], ["Tab, Q or E", "Open the map"], ["↓ + Jump", "Drop through planks"]],
  touchControls: [["◀  ▶", "Move"], ["JUMP", "Jump / double jump / wall jump"], ["FIRE", "Shoot"], ["▲", "Aim up / rest at statues"], ["DASH", "Dash"], ["MAP", "Open the map"]],
  tips: ["Shoot cracked grey blocks. Amber blocks need a dash.", "Rest at statues to save and heal. Enemies come back when you rest.", "When you cannot reach somewhere, note it. You will have the ability later.", "Bosses lock the doors. Learn their pattern, then punish the pause."],
  worlds: [{ name: "Gloamreach", theme: "volcano", music: "puzzle", blurb: "One big map. Your progress is saved when you rest.", levels: [{ id: "1", label: "1", name: "The Gloamreach", desc: "A connected world of 16 rooms, four abilities and four bosses." }] }],
  makeSession: (level, ctx) => new GloamSession(level, ctx),
  createIdle() { const S = new GloamSession({}, {}, { demo: true, quiet: true }); return { update(dt) { S.update(dt, null); }, draw(g) { S.draw(g); } }; },
};
export default createKitGame(def);
export { def as GLOAM_DEF };
