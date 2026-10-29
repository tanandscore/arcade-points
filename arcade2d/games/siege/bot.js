// Skyline Siege autopilot. It plays the demo behind the title screen and is how every mission gets tested ("can this be finished?").
// It presses the same buttons a player would. Before a jump it tries the jump out in a private copy of the world (same physics as
// the real game) and only commits to one that lands somewhere safe. It shoots whatever is in front of it and throws grenades at heavies.
import { moveBody, touchingHazard, heroControl } from "../../core/platformer";
import { PHYS, TS, WEAPONS } from "./defs";
const FLOOR_Y_ = 528;

const DT = 1 / 60;
export class BotInput {
  constructor() { this.h = {}; this.p = {}; this.lastDevice = "keyboard"; this.pointer = { x: 0, y: 0, down: false, pressed: false, released: false, inside: false }; }
  held(a) { return !!this.h[a]; } pressed(a) { return !!this.p[a]; } released() { return false; }
  axis(n, p) { return (this.held(p) ? 1 : 0) - (this.held(n) ? 1 : 0); }
  keyHeld() { return false; } keyPressed() { return false; } flush() { this.h = {}; this.p = {}; }
}

const HOLDS = [0.08, 0.14, 0.2, 0.26, 0.32, 0.38, 0.44, 0.5, 0.58, 0.68];

function cloneBody(H) { return { x: H.x, y: H.y, w: H.w, h: H.h, vx: H.vx, vy: H.vy, onGround: H.onGround, face: H.face, coyoteT: H.coyoteT || 0, bufferT: 0, jumping: !!H.jumping, fell: false }; }
function stepBody(map, B, dir, jp, jh) {
  heroControl(B, { dir, jumpPressed: jp, jumpHeld: jh, down: false }, DT, PHYS, {});
  moveBody(map, B, DT);
}

export class Bot {
  constructor(o = {}) {
    this.input = new BotInput(); this.o = o; this.script = null; this.si = 0; this.t = 0; this.lastX = 0; this.stuckT = 0; this.crateT = 0; this.grenT = 0; this.hopT = 0; this.turnT = 0; this.backT = 0; this.upT = 0; this.noUpT = 0;
    this.stats = { jumps: 0, unstick: 0, shots: 0, grenades: 0 };
  }

  // ---- the private copy of the world: walk on for up to `n` frames and report what happens (when, not just whether) -------------------
  probeWalk(S, n = 70, dir = 1) {
    const B = cloneBody(S.hero), y0 = S.hero.y; let hitAt = -1, hazAt = -1, airAt = -1, landed = false, hitX = 0, hazX = 0, airX = 0;
    for (let k = 0; k < n; k++) {
      stepBody(S.map, B, dir, false, false);
      if ((B.hitR || B.hitL) && hitAt < 0) { hitAt = k; hitX = B.x; }
      if (hazAt < 0 && touchingHazard(S.map, B, 6)) { hazAt = k; hazX = B.x; }
      if (!B.onGround && airAt < 0) { airAt = k; airX = B.x; }
      if (airAt >= 0 && B.onGround) { landed = true; break; }
      if (B.fell || B.y > S.map.h + 40) break;
      if (hitAt >= 0) break;
    }
    return { hitAt, hazAt, airAt, landed, drop: B.y - y0, x: B.x, y: B.y, hitX, hazX, airX };
  }

  // try a jump (press, hold for `hold` seconds, steer toward `dir`) and report where it lands
  probeJump(S, hold, dir = 1, maxFrames = 120) {
    const B = cloneBody(S.hero), H0 = S.hero; let airborne = false, haz = false, landed = false; const frames = [];
    for (let k = 0; k < maxFrames; k++) {
      const jp = k === 0, jh = k * DT < hold; stepBody(S.map, B, dir, jp, jh); frames.push({ dir, jh });
      if (!B.onGround) airborne = true;
      if (touchingHazard(S.map, B, 6)) haz = true;
      if (B.fell || B.y > S.map.h + 40) break;
      if (airborne && B.onGround && k > 3) { landed = true; break; }
    }
    // after landing, make sure walking on does not drop straight into a pit
    let ok = landed && !haz && B.x > H0.x + 6 && B.y < S.map.h;
    if (ok) { const o = { ...B }; for (let k = 0; k < 8; k++) { stepBody(S.map, o, dir, false, false); } if (!o.onGround && o.y > B.y + 40) ok = false; }
    return { ok, x: B.x, y: B.y, dy: B.y - H0.y, frames, hold };
  }

  // choose the gentlest jump that gets past the thing in the way (a wall, a pit, spikes) and lands somewhere safe
  planJump(S, blockX) {
    const H0 = S.hero; let best = null, fallback = null;
    for (const hold of HOLDS) {
      const r = this.probeJump(S, hold, 1);
      if (!r.ok) continue;
      if (!(r.x > blockX + 24 || r.y < H0.y - 30)) continue; // must make real progress: beyond the obstacle, or up onto higher ground
      if (r.dy <= 24) { best = r; break; }               // lands level or higher: take the gentlest jump that does it
      if (!fallback || r.dy < fallback.dy) fallback = r;  // lands lower: only if nothing better exists
    }
    return best || (fallback && fallback.dy < 150 ? fallback : null);
  }

  // ---- what to shoot ---------------------------------------------------------------------------------------------------------
  pickTarget(S) {
    const H = S.hero, mx = H.x + 4 * H.face, my = H.y - 47; let best = null, bd = 1e9;
    const consider = (cx, cy, e, wide = false) => {
      const dx = cx - mx, dy = cy - my; if (dx < -30) return; if (Math.abs(dx) > 680 || Math.abs(dy) > 440) return;
      const ang = Math.atan2(dy, Math.max(1, dx)); if (ang > 0.34) return;
      if (!wide && !S.los(mx, my, cx, cy)) return;
      const d = Math.hypot(dx, dy); if (d < bd) { bd = d; best = { e, cx, cy, dx, dy, ang, d }; }
    };
    for (const e of S.enemies) { if (e.dead || e.gone) continue; if (e.ch === "s" && Math.abs(e.x - H.x) > 600) continue; consider(e.x, e.y - e.h * 0.55, e); }
    return best;
  }

  startScript(j, h, p) {
    this.script = j.frames; this.si = 1; const f = this.script[0]; h.right = f.dir > 0; h.left = f.dir < 0; if (f.jh) h.jump = true; p.jump = true; this.stats.jumps++;
  }

  think(S) {
    const H = S.hero, inp = this.input, map = S.map; inp.p = {}; inp.h = {}; this.t += DT;
    if (H.dead || S.state === "win") { this.script = null; return; }
    const h = inp.h, p = inp.p;
    if (S.boss && S.fight) { this.thinkBoss(S); return; }
    if (S.bossDown && S.goal && S.goal.open) { this.thinkExit(S); return; }
    // ---- shooting ----
    const tg = this.pickTarget(S); let aimUp = false, hold = 0;
    if (tg) {
      const W = WEAPONS[H.weapon], range = H.weapon === "shotgun" ? 300 : H.weapon === "rocket" ? 560 : 640;
      if (tg.d < range) {
        h.fire = true; this.stats.shots++;
        if (Math.abs(tg.dx) < 14 && tg.ang < -0.8 && this.noUpT <= 0) { aimUp = true; this.upT += DT; if (this.upT > 0.9) { this.noUpT = 2; this.upT = 0; } } else if (tg.ang < -0.4) { h.up = true; }
      }
      // heavies: a grenade over the shield
      if ((tg.e.ch === "h" || tg.e.ch === "m") && tg.d > 130 && tg.d < 360 && H.grenades > 0 && this.grenT <= 0) { p.alt = true; this.grenT = 0.9; this.stats.grenades++; }
    }
    this.grenT -= DT; this.noUpT -= DT; if (!aimUp) this.upT = Math.max(0, this.upT - DT * 2);
    if (aimUp) { h.up = true; }
    // ---- stuck detection ----
    if (Math.abs(H.x - this.lastX) < 3 && !aimUp) this.stuckT += DT; else { this.stuckT = 0; this.lastX = H.x; }
    // ---- moving ----
    let dir = aimUp ? 0 : 1;
    if (this.script) {
      const f = this.script[this.si++]; if (!f) { this.script = null; } else { h.right = f.dir > 0; h.left = f.dir < 0; if (f.jh) h.jump = true; return; }
    }
    if (this.backT > 0) { this.backT -= DT; h.left = true; return; }
    if (this.crateT > 0) { this.crateT -= DT; h.fire = true; return; }
    if ((H.onGround || H.coyoteT > 0) && dir) {
      const w = this.probeWalk(S, 70);
      const wall = w.hitAt >= 0 && w.hitAt <= 5, edge = w.airAt >= 0 && w.airAt <= 4 && (!w.landed || w.drop > 130), spike = w.hazAt >= 0 && w.hazAt <= 9;
      if (wall || edge || spike) {
        // a crate in the way? shoot it open
        const cx = map.col((wall ? w.hitX : H.x) + H.w / 2 + 4), cr = map.row(H.y - 20);
        if (wall && !edge && map.ch(cx, cr) === "C") { this.crateT = 0.35; h.fire = true; return; }
        const bx = Math.min(wall ? w.hitX : 1e9, edge ? w.airX : 1e9, spike ? w.hazX : 1e9);
        const j = this.planJump(S, bx);
        if (j) { this.startScript(j, h, p); return; }
        // no way over: a brick gate can be blown open with a grenade
        if (wall && !edge && map.ch(cx, cr) === "B" && H.grenades > 0) { if (this.grenT <= 0) { p.alt = true; this.grenT = 0.9; this.stats.grenades++; } return; }
        // nothing safe yet: keep walking while there is still ground (a better take-off may be a step ahead), else back up for a run-up
        if (wall && this.stuckT > 1.2) { this.stats.unstick++; this.backT = 0.35; this.stuckT = 0; return; }
        if (edge && w.airAt <= 1) { this.stats.unstick++; this.backT = 0.3; return; }
        if (wall) { h.fire = true; return; }
      }
      h.right = true;
    } else if (!H.onGround) { if (dir) h.right = true; if (H.vy < 0 && H.jumping) h.jump = true; }
    else if (dir) h.right = true;
    // unstick when pinned
    if (this.stuckT > 2.5) { this.stats.unstick++; this.stuckT = 0; const j = this.planJump(S, H.x); if (j) this.startScript(j, h, p); else this.backT = 0.4; }
  }

  // the boss is down and the exit is open: walk to it (dropping through a catwalk if the door is below us)
  thinkExit(S) {
    const H = S.hero, h = this.input.h, p = this.input.p, g = S.goal, dx = g.x - H.x, dy = g.y - H.y;
    if (Math.abs(dx) > 22) { if (dx > 0) h.right = true; else h.left = true; }
    else if (dy > 60 && H.onGround) { h.down = true; p.jump = true; }
    if (!H.onGround && H.vy < 0) h.jump = true;
    if (Math.abs(dx) > 22 && H.onGround && this.stuckExit > 0.5) { p.jump = true; h.jump = true; this.stuckExit = 0; }
    if (Math.abs(H.x - this.lastX) < 1.5 && Math.abs(dx) > 22) this.stuckExit = (this.stuckExit || 0) + DT; else { this.stuckExit = 0; this.lastX = H.x; }
  }

  // ---- boss fights ------------------------------------------------------------------------------------------------------------
  // Stand at a good distance, dodge what the boss tells us is coming (waves and balls: jump; columns, bombs, puddles: walk out of them),
  // and shoot the weak spot. To aim diagonally without walking, it only taps "up + direction" on the exact frames a shot leaves the gun.
  thinkBoss(S) {
    const H = S.hero, B = S.boss, h = this.input.h, p = this.input.p, a = S.arena;
    const ap = B.aimPoint ? B.aimPoint(S) : { x: B.x, y: B.y - 100 };
    this.grenT -= DT; this.hopT -= DT;
    const gy = H.y - 47;
    // what to shoot: a pest close by (drone, jet trooper), otherwise the boss
    let pest = null, pd = 300;
    for (const e of S.enemies) { if (e.dead || e.gone || !e.awake) continue; const d = Math.hypot(e.x - H.x, e.y - e.h / 2 - H.y); if (d < pd) { pd = d; pest = e; } }
    let want, line = null, fire = true;
    if (pest) {
      const dx = pest.x - H.x, dy = pest.y - pest.h * 0.55 - gy, ang = Math.atan2(dy, Math.max(1, Math.abs(dx))), side = dx < 0 ? -1 : 1;
      line = Math.abs(dx) < 40 && dy < -60 ? [0, -1] : ang < -0.45 ? [side * 0.7071, -0.7071] : [side, 0];
      want = this.firingSpot(S, B, ap).dflt;
    } else {
      const fs = this.firingSpot(S, B, ap); want = fs.x;
      const cur = this.bestLine(S, B, H.x, gy, ap.x); line = cur.line; fire = H.weapon === "pistol" ? cur.sc > 0.05 : cur.sc >= 1.2 || (cur.sc >= 0.5 && H.ammo[H.weapon] > 40);
    }
    const dg = this.dodge(S, B, want), stand = dg.x != null ? dg.x : want;
    this.dbg = { line, fire, pest: !!pest, dodgeX: dg.x, want };
    const err = stand - H.x, tol = dg.x != null ? 12 : 24;
    let dir = Math.abs(err) > tol ? Math.sign(err) : 0;
    // shooting. Aiming is 8-way, so on the frame a shot leaves the gun, tap the keys that point it along the chosen line
    if (fire) { h.fire = true; this.stats.shots++; }
    if (fire && line && H.fireCd - DT <= 0.0005 && !dg.jump && H.onGround) {
      if (line[0] === 0) { h.up = true; dir = 0; } else if (line[1] < 0) { h.up = true; dir = Math.sign(line[0]); } else dir = Math.sign(line[0]);
    }
    if (dir > 0) h.right = true; else if (dir < 0) h.left = true;
    if (dg.jump && (H.onGround || H.coyoteT > 0)) { p.jump = true; h.jump = true; this.holdJump = 0.34; this.stats.jumps++; }
    else if (!H.onGround && H.vy < 0 && this.holdJump > 0) { h.jump = true; this.holdJump -= DT; }
    // the best gun for the job, and grenades when something big is near
    if (H.weapon !== "rocket" && H.owned.includes("rocket") && H.ammo.rocket > 0) { if (!this.swapT || this.t > this.swapT) { p.swap = true; this.swapT = this.t + 0.3; } }
    else if (H.ammo[H.weapon] <= 0 || H.weapon === "pistol" && H.owned.some((id) => id !== "pistol" && H.ammo[id] > 0)) { if (!this.swapT || this.t > this.swapT) { p.swap = true; this.swapT = this.t + 0.3; } }
    const gdx = ap.x - H.x, gdy = ap.y - gy;
    if (this.grenT <= 0 && H.grenades > 0 && Math.abs(gdx) < 420 && Math.abs(gdy) < 260) { p.alt = true; this.grenT = 1.3; this.stats.grenades++; }
  }

  // follow a line of fire from the gun at (x, y): what does the first thing it meets multiply our damage by? (0 = armour or a wall)
  rayMul(S, B, x, y, dx, dy, potential = false) {
    const map = S.map, a = S.arena;
    for (let d = 18; d <= 800; d += 14) {
      const px = x + dx * d, py = y + dy * d;
      if (px < a.x0 || px > a.x1 || py < -60 || map.solidAtPx(px, py)) return 0;
      const r = B.hitTest(px, py, 5); if (r) return potential && r.box && r.box.weak ? r.box.weak : r.mul;
    }
    return 0;
  }
  // from standing at x, which of the three firing lines (flat, diagonal, straight up) does the most damage to the boss?
  bestLine(S, B, x, gy, tx, potential = false) {
    const side = tx < x ? -1 : 1; let best = { sc: 0, line: [side, 0] };
    for (const ln of [[side, 0], [side * 0.7071, -0.7071], [0, -1]]) { const sc = this.rayMul(S, B, x, gy, ln[0], ln[1], potential); if (sc > best.sc) best = { sc, line: ln }; }
    return best;
  }
  // where to stand: a place from which one of the lines of fire hits something that matters, not too close to the boss.
  // We look along the level we are standing on, and (from a catwalk) at the street below as well.
  firingSpot(S, B, ap) {
    const H = S.hero, a = S.arena, map = S.map, near = B.keepAway === 0 ? 0 : B.keepAway * 0.5, lo = a.x0 + 80, hi = a.x1 - 110, FY = 528;
    let dflt = B.keepAway === 0 ? ap.x : ap.x - B.keepAway < a.x0 + 120 ? ap.x + B.keepAway : ap.x - B.keepAway;
    dflt = Math.max(lo, Math.min(hi, dflt));
    if (this.fsAt != null && this.t - this.fsAt < 0.15 && Math.abs(this.fsY - H.y) < 2) return { x: this.fsX, dflt };
    const levels = [];
    const feet = H.y + 4, row = map.row(feet), ok = (x) => map.isSolid(map.col(x), row) || map.isOneWay(map.col(x), row);
    let xl = H.x, xr = H.x;
    if (H.onGround) { while (xl - 24 >= lo && ok(xl - 24)) xl -= 24; while (xr + 24 <= hi && ok(xr + 24)) xr += 24; levels.push({ y: H.y, xl, xr, pen: 0 }); if (H.y < FY - 20) levels.push({ y: FY, xl: lo, xr: hi, pen: 1.2 }); }
    else levels.push({ y: H.y, xl: lo, xr: hi, pen: 0 });
    let best = null;
    for (const L of levels) for (let x = Math.ceil(L.xl / 24) * 24; x <= L.xr; x += 24) {
      if (near && Math.abs(x - B.x) < near) continue;
      const r = this.bestLine(S, B, x, L.y - 47, ap.x, true), sc = Math.min(r.sc, 3.2);
      const v = (sc >= 0.5 ? 10 + sc * 4 : sc * 4) - L.pen - Math.abs(x - dflt) * 0.012 - Math.abs(x - H.x) * 0.004;
      if (!best || v > best.v) best = { v, x };
    }
    this.fsAt = this.t; this.fsY = H.y; this.fsX = best ? best.x : dflt;
    return { x: this.fsX, dflt };
  }

  // What is about to hurt, and what to do about it: { jump: true } and/or { x: a safer place to walk to }.
  // The boss tells us its danger zones (waves, beams, columns of light, marks on the floor) and when they go off; bullets in flight
  // are simulated forward too. We try a handful of places to stand and moments to jump, and take the one that costs least.
  dodge(S, B, wantX) {
    const H = S.hero, a = S.arena, map = S.map, res = { jump: false, x: null }, zones = [], shots = [];
    for (const t of (B.threats ? B.threats() : [])) {
      const z = t.z, mv = t.vx || z.estVx || 0;
      if (z.kind === "mark") { zones.push({ x0: t.x0 - 2, x1: t.x1 + 2, vx: 0, on: Math.max(0, t.left - 0.1), off: t.left + 0.3, low: false }); continue; }
      const low = z.kind === "wave" || (z.kind === "rect" && z.h <= 60 && z.y + z.h >= 515) || (z.kind === "circle" && z.y + z.r > 430);
      const live = z.life - Math.max(0, z.age - z.delay);
      zones.push({ x0: t.x0 - 4, x1: t.x1 + 4, vx: Math.abs(mv) > 60 ? mv : 0, on: Math.max(0, t.left - 0.04), off: t.left + (z.kind === "wave" ? 3 : Math.max(0.1, live)), low });
    }
    for (const q of S.projs) {
      if (q.from !== "enemy") continue;
      if (q.kind === "bomb") {                                  // a falling bomb: it goes off where it lands
        const dy = FLOOR_Y_ - 10 - q.y; if (dy < 0) continue;
        const ti = q.g ? (-q.vy + Math.sqrt(q.vy * q.vy + 2 * q.g * dy)) / q.g : dy / Math.max(40, q.vy), bx = q.x + q.vx * ti, r = (q.boom || 70) + 6;
        zones.push({ x0: bx - r, x1: bx + r, vx: 0, on: Math.max(0, ti - 0.1), off: ti + 0.25, low: false }); continue;
      }
      if (Math.abs(q.x - H.x) < 640 && Math.abs(q.y - H.y) < 640) shots.push(q);
    }
    if (B.projectiles) for (const q of B.projectiles()) shots.push(q);
    if (!zones.length && !shots.length) return res;
    const arc = (u) => (u < 0 ? 0 : u < 0.33 ? PHYS.jumpV * u - 0.5 * PHYS.gravity * u * u : Math.max(0, 129 - 0.5 * PHYS.gravity * 1.25 * (u - 0.33) * (u - 0.33)));
    const gF = PHYS.gravity * PHYS.fallGravityMul, run = PHYS.maxRun, TSZ = map.ts;
    const below = (x, fromRow) => { for (let r = fromRow; r < 14; r++) if (map.isSolid(map.col(x), r) || map.isOneWay(map.col(x), r)) return r * TSZ; return null; };
    const air0 = H.onGround ? null : below(H.x, map.row(H.y + 2) + 1);
    // c = { cx, edge?, ly? }: walk to cx (stepping off the platform at "edge" and landing at height "ly"), optionally jumping at time jt
    const cost = (c, jt) => {
      let sum = 0; const hitZ = new Set(), hitS = new Set(), te = c.edge != null ? Math.abs(c.edge - H.x) / run : 0;
      for (let t = 0.05; t <= 1.3; t += 0.065) {
        const hx = H.x + Math.max(-run * t, Math.min(run * t, c.cx - H.x));
        let dy = 0;
        if (!H.onGround) dy = Math.min(air0 == null ? 600 : air0 - H.y, H.vy * t + 0.5 * PHYS.gravity * 1.1 * t * t);
        else if (c.edge != null && t > te) dy = Math.min(c.ly - H.y, 0.5 * gF * (t - te) * (t - te));
        const fy = jt == null ? 0 : arc(t - jt), top = H.y + dy - fy - 56, bot = H.y + dy - fy;
        for (let i = 0; i < zones.length; i++) {
          const z = zones[i]; if (hitZ.has(i) || t < z.on || t > z.off) continue;
          if (z.low && (fy > 40 || dy < -40)) continue;
          const zx0 = z.x0 + z.vx * t, zx1 = z.x1 + z.vx * t;
          if (hx + 13 > zx0 && hx - 13 < zx1) { hitZ.add(i); sum += 300; }
        }
        if (t <= 0.7) for (const q of shots) {
          if (hitS.has(q)) continue;
          const bx = q.x + q.vx * t, by = q.y + q.vy * t + (q.g ? 0.5 * q.g * t * t : 0);
          if (Math.abs(bx - hx) < 13 + q.r + 3 && by > top - q.r - 3 && by < bot + q.r + 3) { hitS.add(q); sum += 4 * (q.dmg || 8); }
        }
      }
      return sum;
    };
    const stay = cost({ cx: H.x }, null);
    if (stay <= 0) return res;
    const lo = a.x0 + 70, hi = a.x1 - 70, cands = [{ cx: H.x }], feet = H.y + 4, feetRow = map.row(feet);
    for (const dir of [-1, 1]) {
      let edge = null, ly = null;
      for (let d = 36; d <= 432; d += 36) {
        const cx = H.x + dir * d; if (cx < lo || cx > hi) break;
        if (H.onGround && edge == null && !(map.isSolid(map.col(cx), feetRow) || map.isOneWay(map.col(cx), feetRow))) {
          const land = below(cx, feetRow + 1); if (land == null) break;
          edge = cx - dir * 22; ly = land;                 // we walk off the platform here and drop to "ly"
        }
        cands.push({ cx, edge, ly });
      }
    }
    let best = { c: stay + 1, cx: H.x, jt: null };
    for (const c of cands) for (const jt of H.onGround && c.edge == null ? [null, 0, 0.18, 0.36] : [null]) {
      const k = cost(c, jt) + (jt === 0 ? 10 : jt != null ? 5 : 0) + (c.edge != null ? 6 : 0) + Math.abs(c.cx - H.x) * 0.02 + (wantX == null ? 0 : Math.abs(c.cx - wantX) * 0.01);
      if (k < best.c) best = { c: k, cx: c.cx, jt };
    }
    if (Math.abs(best.cx - H.x) > 8) res.x = best.cx;
    if (best.jt === 0) res.jump = true;
    return res;
  }
}
