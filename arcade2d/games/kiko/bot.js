// A small autopilot for Kiko Leap. It plays the demo behind the title screen and is how we test that every level can be finished.
// It does not cheat: it presses the same buttons a player would. Before a jump it "tries it out" in a private copy of the world
// (same physics as the real game) and only commits to a jump that lands somewhere safe.
import { moveBody, touchingHazard, heroControl } from "../../core/platformer";
import { P, SPRINT, GLIDE_MAX, glideVy } from "./session";

const DT = 1 / 60;
export class BotInput {
  constructor() { this.h = {}; this.p = {}; this.lastDevice = "keyboard"; }
  held(a) { return !!this.h[a]; } pressed(a) { return !!this.p[a]; } released() { return false; }
  axis(n, p) { return (this.held(p) ? 1 : 0) - (this.held(n) ? 1 : 0); }
  keyHeld() { return false; } keyPressed() { return false; }
  flush() { this.h = {}; this.p = {}; }
}

const STAND = { dir: 0, jumpP: false, jumpH: false, sprint: false };
const HOLDS = [0.14, 0.24, 0.34, 0.44, 0.52, 0.58];
const ENEMY_HOLDS = [0.36, 0.46, 0.54, 0.26, 0.58];

// ---- the private copy of the world --------------------------------------------------------------------------------------------
function stepPlatforms(list, tNow, dt, Hs, mapH) {
  for (const p of list) {
    const ox = p.x, oy = p.y;
    if (p.kind === "m") p.x = p.ox + Math.sin(tNow * p.sp + p.ph) * p.ax;
    else if (p.kind === "M") p.y = p.oy + Math.sin(tNow * p.sp + p.ph) * p.ay + p.ay;
    else if (p.kind === "d") {
      if (p.st === "idle" && Hs.platform === p) { p.st = "shake"; p.stT = 0; }
      if (p.st === "shake") { p.stT += dt; if (p.stT > 0.5) { p.st = "fall"; p.vy = 0; p.dead = true; } }
      else if (p.st === "fall") { p.vy += 1700 * dt; p.y += p.vy * dt; if (p.y > mapH + 120) { p.st = "gone"; p.stT = 0; } }
      else if (p.st === "gone") { p.stT += dt; if (p.stT > 2.6) { p.st = "idle"; p.x = p.ox; p.y = p.oy; p.dead = false; p.vy = 0; } }
    }
    p.dx = p.x - ox; p.dy = p.y - oy;
  }
  if (Hs.platform && !Hs.platform.dead && (Hs.platform.dx || Hs.platform.dy)) { Hs.x += Hs.platform.dx; Hs.y += Hs.platform.dy; }
}
function stepHero(map, Hs, solids, inp, dt) {
  const sprint = inp.sprint, ctrl = { speedMul: sprint ? SPRINT : 1, jumpMul: sprint && Math.abs(Hs.vx) > 280 ? 1.05 : 1 };
  if (!Hs.onGround && inp.jumpP && Hs.coyoteT <= 0 && Hs.vy > -160 && Hs.glideT < GLIDE_MAX && Hs.stun <= 0) Hs.gliding = true;
  const r = heroControl(Hs, { dir: inp.dir, jumpPressed: inp.jumpP, jumpHeld: inp.jumpH }, dt, P, ctrl);
  if (r.jumped) Hs.gliding = false;
  if (Hs.gliding) {
    if (inp.jumpH && !Hs.onGround && Hs.glideT < GLIDE_MAX) { Hs.glideT += dt; Hs.vy = glideVy(Hs.vy, dt); if (inp.dir) Hs.vx += inp.dir * 500 * dt; }
    else Hs.gliding = false;
  }
  moveBody(map, Hs, dt, { solids });
  if (Hs.onGround) { Hs.glideT = 0; Hs.gliding = false; }
}

export class Bot {
  constructor(o = {}) {
    this.input = new BotInput(); this.sprint = o.sprint ?? true; this.glide = o.glide ?? true;
    this.script = null; this.si = 0; this.pred = null; this.standT = 0; this.lastX = 0; this.stuck = 0; this.glideOn = false; this.hopT = 0;
    this.plans = 0; this.fails = 0; this.jumpHold = 0; this.spot = null;
  }

  // Try a plan in the private world. Returns { ok, script, pred } -- the exact buttons to press and where we expect to be.
  simulate(S, plan, o = {}) {
    const H0 = S.hero, map = S.map, Hs = { ...H0 };
    const list = [], link = new Map();
    for (const p of S.platforms) { if (Math.abs(p.x + p.w / 2 - H0.x) > 900) continue; const c = { ...p }; list.push(c); link.set(p, c); }
    Hs.platform = H0.platform ? link.get(H0.platform) || null : null;
    const sprs = []; for (const q of S.springs) if (Math.abs(q.x - H0.x) < 900) sprs.push({ x: q.x, y: q.y, cd: q.cd });
    const minF = Math.round((o.minT ?? 0.5) / DT), maxF = Math.round((o.maxT ?? 2.8) / DT), tailF = Math.round((o.tailT ?? 0.3) / DT);
    const script = [], pred = [];
    let state = H0.onGround ? 0 : 1, landK = -1, glideStarted = !!Hs.gliding, blocked = 0;
    const goal = o.goal || null; // optional: a box we want to come down on (a dizzy boss)
    for (let k = 0; k < maxF; k++) {
      const t = k * DT; let inp;
      if (state === 2) inp = STAND;
      else {
        inp = { dir: plan.dir, jumpP: false, jumpH: false, sprint: plan.sprint };
        if (plan.hold > 0) { if (k === 0) inp.jumpP = true; if (t < plan.hold) inp.jumpH = true; }
        const wantGlide = plan.glideAt != null ? k >= plan.glideAt : plan.glide && k > 0 && Hs.vy > 70;
        if (!Hs.onGround && Hs.glideT < GLIDE_MAX && (wantGlide || (glideStarted && plan.glideAt == null && plan.glide))) {
          if (!Hs.gliding && !glideStarted && Hs.coyoteT <= 0 && Hs.vy > -160) { inp.jumpP = true; glideStarted = true; }
          if (Hs.gliding || glideStarted) inp.jumpH = true;
        }
        script.push(inp);
      }
      const prevY = Hs.y;
      stepPlatforms(list, S.t + (k + 1) * DT, DT, Hs, map.h);
      stepHero(map, Hs, list.filter((q) => !q.dead), inp, DT);
      for (const q of sprs) { q.cd = Math.max(0, q.cd - DT); if (q.cd <= 0 && Math.abs(Hs.x - q.x) < 26 && Hs.y > q.y - 34 && Hs.y < q.y + 8 && Hs.vy >= -60) { q.cd = 0.25; Hs.vy = -(inp.jumpH ? 1210 : 1060); Hs.onGround = false; Hs.coyoteT = 0; Hs.jumping = false; Hs.gliding = false; Hs.glideT = 0; } }
      if (state < 2) pred.push({ x: Hs.x, y: Hs.y });
      if (o.trace) o.trace.push({ k, x: Math.round(Hs.x), y: Math.round(Hs.y), vx: Math.round(Hs.vx), vy: Math.round(Hs.vy), gl: Hs.gliding ? 1 : 0, g: Hs.onGround ? 1 : 0 });
      if (goal && Math.abs(Hs.x - (goal.x + goal.w / 2)) < (Hs.w + goal.w) / 2 && Hs.y > goal.y && Hs.y - Hs.h < goal.y + goal.h) {
        if (Hs.vy > 40 && prevY <= goal.y + 30) return { ok: true, goal: true, script, pred, endX: Hs.x, k };
        return { ok: false, why: "bonk", k };
      }
      if (touchingHazard(map, Hs, 8)) return { ok: false, why: "hazard", k };
      if (Hs.fell || Hs.y > map.h + 140) return { ok: false, why: "fell", k };
      if (plan.hold === 0 && state === 0) { if ((plan.dir > 0 ? Hs.hitR : Hs.hitL) && Hs.onGround) blocked++; else blocked = 0; if (blocked >= 4 && plan.dir) return { ok: false, why: "blocked", k }; }
      if (!Hs.onGround) { if (state === 0) state = 1; }
      else if (state === 1) { state = 2; landK = k; if (goal) return { ok: false, why: "landed", k }; }
      if (state === 2) {
        if (!Hs.onGround) return { ok: false, why: "slid", k };
        if (Hs.platform && Hs.platform.kind === "d" && Hs.platform.st === "shake" && Hs.platform.stT > 0.3) return { ok: false, why: "crumble", k };
        if (k - landK >= tailF) { if (plan.hold > 0 && (Hs.x - H0.x) * (plan.dir || 1) < (o.minProgress ?? 36)) return { ok: false, why: "nowhere", k }; return { ok: true, script, pred, endX: Hs.x, k }; }
      } else if (state === 0 && k + 1 >= minF && !goal) {
        if (plan.hold > 0) return { ok: false, why: "nojump", k };
        return { ok: true, script: null, pred: null, endX: Hs.x, k };
      }
    }
    return { ok: false, why: "timeout" };
  }

  apply(inp) {
    const h = this.input.h, p = this.input.p;
    if (inp.dir > 0) h.right = true; else if (inp.dir < 0) h.left = true;
    if (inp.jumpH) h.jump = true; if (inp.jumpP) p.jump = true; if (inp.sprint) h.fire = true;
  }
  startScript(plan, r) { this.script = r.script; this.pred = r.pred; this.si = 0; this.plans++; this.standT = 0; this.glideOn = false; }
  runScript(S, H) {
    if (!this.script) return false;
    if (this.si > 0) { const q = this.pred[this.si - 1]; if (Math.abs(H.x - q.x) > 22 || Math.abs(H.y - q.y) > 26 || H.stun > 0) { this.script = null; return false; } }
    if (this.si >= this.script.length) { this.script = null; return false; }
    this.apply(this.script[this.si]); this.si++;
    if (this.si >= this.script.length) this.script = null;
    return true;
  }

  think(S) {
    const inp = this.input, H = S.hero; inp.h = {}; inp.p = {};
    const h = inp.h, p = inp.p;
    if (H.dead || S.state === "win" || S.done) { this.script = null; this.glideOn = false; return; }
    if (S.boss) return this.thinkBoss(S, H, S.boss, h, p);
    if (this.runScript(S, H)) return;

    const map = S.map, speed = Math.max(60, Math.abs(H.vx));
    if (!H.onGround) return this.airControl(S, H, 1);
    this.glideOn = false;
    // ---- enemies, shots and crushers (these are not in the private copy of the world) ----
    let wantJump = false, stop = false;
    for (const e of S.enemies) {
      if (e.dead || e.gone || e.d.fire || e.d.cloud) continue; const dx = e.x - H.x;
      if (e.d.crusher) { if (dx > 0 && dx < 120 && e.st !== "rest") stop = true; continue; }
      if (dx > 0 && dx < 100 + speed * 0.12 && Math.abs(e.y - H.y) < 70 && !e.d.spitter) wantJump = true;
      if (e.d.spitter && dx > 0 && dx < 140) wantJump = true;
    }
    for (const q of S.projs) { if (q.kind === "seed" || q.kind === "web") { const dx = q.x - H.x; if (dx > -10 && dx < 150 && Math.abs(q.y - (H.y - 20)) < 40) wantJump = true; } }
    if (stop) { this.standT = 0; return; }

    const run = { dir: 1, hold: 0, glide: false, sprint: this.sprint };
    const runOk = this.simulate(S, run, { minT: 0.5 });
    if (runOk.ok && !wantJump) { this.standT = 0; this.apply(run); this.trackStuck(H, true); return; }
    // ---- a jump is needed (or an enemy is near): try the options, take the first one that lands safely ----
    const order = runOk.ok ? ENEMY_HOLDS : HOLDS;
    const sprints = this.sprint ? [true, false] : [false], glides = this.glide ? [false, true] : [false];
    for (const hold of order) for (const glide of glides) for (const sprint of sprints) {
      const plan = { dir: 1, hold, glide, sprint }, r = this.simulate(S, plan);
      if (r.ok) { this.startScript(plan, r); this.runScript(S, H); this.trackStuck(H, true); return; }
    }
    if (runOk.ok) { this.apply(run); this.trackStuck(H, true); return; } // an enemy was near but there is no safe hop: just carry on
    // no jump works from here yet. If the trouble is still a few steps away, keep running (we may need the run-up speed)
    const imminent = runOk.k <= 5 || (runOk.why === "blocked" && runOk.k <= 8);
    if (!imminent) { this.standT = 0; this.apply(run); this.trackStuck(H, true); return; }
    // nothing lands safely right now: wait at the edge for a moving platform, then try again
    const st = this.simulate(S, { dir: 0, hold: 0, glide: false, sprint: false }, { minT: 0.4 });
    this.standT += DT;
    if (st.ok && this.standT < 2.4) { this.trackStuck(H, false); return; }
    // give up waiting: do the biggest jump we have and hope
    this.fails++; this.standT = 0; this.apply({ dir: 1, jumpP: true, jumpH: true, sprint: this.sprint }); this.script = null;
    this.hopT = 0.5;
  }

  // in the air without a plan (knocked about, bounced by a spring, walked off something): steer to a safe landing
  airControl(S, H, want) {
    const h = this.input.h, p = this.input.p, wd = want || 1;
    const base = { dir: wd, hold: 0, glide: false, glideAt: H.gliding ? 0 : null, sprint: this.sprint && wd > 0 };
    const r0 = this.simulate(S, base, { maxT: 3.4 });
    if (r0.ok) { if (r0.script && r0.script.length) this.apply(r0.script[0]); else this.apply({ dir: wd, jumpP: false, jumpH: H.gliding, sprint: base.sprint }); return; }
    const glides = H.gliding ? [0, null] : this.glide ? [0, 8, 18, 30, 46, 64, null] : [null];
    for (const glideAt of glides) for (const dir of [wd, 0, -wd]) {
      const plan = { dir, hold: 0, glide: false, glideAt, sprint: dir > 0 && this.sprint }, r = this.simulate(S, plan, { maxT: 3.4 });
      if (r.ok && r.script && r.script.length) { this.startScript(plan, r); this.runScript(S, H); return; }
    }
    // nothing lands safely: lean the wanted way and float if we are falling
    if (wd > 0) h.right = true; else h.left = true;
    if (this.glide && H.vy > 80 && H.glideT < GLIDE_MAX - 0.05) { if (!H.gliding && H.coyoteT <= 0) p.jump = true; h.jump = true; }
  }

  // walk toward an x position without falling in a hole; hop or float over holes when needed
  moveTo(S, H, tx, tol = 14) {
    const dx = tx - H.x; if (Math.abs(dx) < tol) return false;
    const dir = dx > 0 ? 1 : -1, walk = { dir, hold: 0, glide: false, sprint: false };
    if (this.simulate(S, walk, { minT: 0.3 }).ok) { this.apply(walk); return true; }
    for (const hold of [0.3, 0.44, 0.58]) for (const glide of [false, true]) {
      const plan = { dir, hold, glide, sprint: false }, r = this.simulate(S, plan, { minProgress: 20 });
      if (r.ok) { this.startScript(plan, r); this.runScript(S, H); return true; }
    }
    return false;
  }

  trackStuck(H, moving) {
    if (moving && Math.abs(H.x - this.lastX) < 1.5 && H.onGround) this.stuck += DT; else this.stuck = 0;
    this.lastX = H.x;
    if (this.stuck > 0.6) { this.stuck = 0; this.fails++; this.input.p.jump = true; this.input.h.jump = true; this.input.h.right = true; }
  }

  thinkBoss(S, H, b, h, p) {
    // keep away from the boss, hop over its attacks, stomp it when it is dizzy
    if (this.runScript(S, H)) return;
    const dx = b.x - H.x, ready = b.vulnerable && !(b.invT > 0);
    const warn = (x) => S.marks.some((m) => Math.abs(m.x - x) < 70);
    const proj = S.projs.find((q) => !q.dead && ((q.kind !== "bolt" && Math.abs(q.x - H.x) < 90 && q.y > 300) || (q.kind === "wave" && Math.abs(q.x - H.x) < 120)));
    if (!H.onGround) {
      if (ready) { const hb = b.hitboxes()[0], sd = dx >= 0 ? 1 : -1; for (const dir of [sd, 0, -sd]) for (const glideAt of [null, 0, 12, 30]) { const plan = { dir, hold: 0, glide: false, glideAt, sprint: false }, r = this.simulate(S, plan, { goal: hb, maxT: 1.9 }); if (r.ok) { this.startScript(plan, r); this.runScript(S, H); return; } } }
      return this.airControl(S, H, ready ? (dx >= 0 ? 1 : -1) : (warn(H.x) ? (H.x < S.map.w / 2 ? -1 : 1) : (dx >= 0 ? -1 : 1)));
    }
    if (ready) { // go and stomp: look for a jump (or a walk off a ledge) that comes down on its head
      const hb = b.hitboxes()[0], sd = dx >= 0 ? 1 : -1;
      for (const hold of [0.3, 0.46, 0.58, 0.2, 0]) for (const sprint of [false, true]) for (const dir of [sd, 0]) {
        const plan = { dir, hold, glide: false, sprint: sprint && dir !== 0 }, r = this.simulate(S, plan, { goal: hb, maxT: 1.9 });
        if (r.ok) { this.startScript(plan, r); this.runScript(S, H); return; }
      }
      this.moveTo(S, H, b.x - sd * 80, 10);
    } else {
      // stand somewhere calm: far from the boss, out of lightning warnings, on solid ground (keep the choice for a while so we do not dither)
      const okSpot = (x) => !warn(x) && Math.abs(x - b.x) > 230;
      if (this.spot == null || !okSpot(this.spot)) {
        const spots = [S.ax0 + 120, S.ax1 - 120, S.map.w / 2 - 220, S.map.w / 2 + 220].filter(okSpot);
        spots.sort((a, c) => Math.abs(a - H.x) - Math.abs(c - H.x));
        this.spot = spots.length ? spots[0] : (b.x < S.map.w / 2 ? S.ax1 - 120 : S.ax0 + 120);
      }
      if (!this.moveTo(S, H, this.spot, 30) && warn(H.x)) { h.right = H.x < S.map.w / 2; h.left = !h.right; }
      if (H.onGround && proj) { p.jump = true; this.jumpHold = 0.6; }
      if (b.state === "charge" && Math.abs(dx) < 220 && H.onGround) { p.jump = true; this.jumpHold = 0.6; }
    }
    if (this.jumpHold > 0) { this.jumpHold -= 1 / 60; h.jump = true; }
  }
}
