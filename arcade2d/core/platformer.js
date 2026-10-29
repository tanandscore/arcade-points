// Tile maps and side-view physics. A level is a list of text rows; each character is a tile or a spawn marker.
// Bodies use CENTRE-X and FEET-Y (x = middle of the body, y = the bottom), which is how characters are easiest to place.
import { clamp, sign } from "./util";

export class TileMap {
  // legend: { solid: "#X", oneway: "=", hazard: "^", ents: "Pg..." }; anything else is treated as an empty tile
  constructor(rows, { ts = 48, solid = "#X", oneway = "=", hazard = "^", ents = "", fill = "." } = {}) {
    this.ts = ts; this.rows = rows.length; this.cols = Math.max(...rows.map((r) => r.length));
    this.solidSet = new Set(solid); this.oneSet = new Set(oneway); this.hazSet = new Set(hazard); this.entSet = new Set(ents);
    this.cells = rows.map((r) => r.padEnd(this.cols, fill).split(""));
    this.ents = [];
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const ch = this.cells[r][c];
      if (this.entSet.has(ch)) { this.ents.push({ ch, c, r, x: (c + 0.5) * ts, y: (r + 1) * ts }); this.cells[r][c] = "."; }
    }
    this.w = this.cols * ts; this.h = this.rows * ts;
    this.wallsAtSides = true; // outside the level on the left/right counts as solid, below the level is open (falling out = defeat)
  }
  ch(c, r) { if (r < 0) return "."; if (c < 0 || c >= this.cols) return this.wallsAtSides ? "#" : "."; if (r >= this.rows) return "."; return this.cells[r][c]; }
  set(c, r, ch) { if (c >= 0 && c < this.cols && r >= 0 && r < this.rows) this.cells[r][c] = ch; }
  isSolid(c, r) { return this.solidSet.has(this.ch(c, r)); }
  isOneWay(c, r) { return this.oneSet.has(this.ch(c, r)); }
  isHazard(c, r) { return this.hazSet.has(this.ch(c, r)); }
  col(x) { return Math.floor(x / this.ts); }
  row(y) { return Math.floor(y / this.ts); }
  solidAtPx(x, y) { return this.isSolid(this.col(x), this.row(y)); }
}

// A "body" is { x, y, w, h, vx, vy } plus flags this file sets: onGround, hitL, hitR, hitU, platform
export function moveBody(map, b, dt, o = {}) {
  const { solids = null, dropThrough = false, bounceX = 0, onTileBump = null } = o;
  const ts = map.ts, maxStep = ts * 0.4;
  b.hitL = b.hitR = b.hitU = false; const wasGround = b.onGround; b.onGround = false; b.platform = null;
  // ---- horizontal ----
  let dx = b.vx * dt; const nx = Math.max(1, Math.ceil(Math.abs(dx) / maxStep)); dx /= nx;
  for (let i = 0; i < nx; i++) {
    b.x += dx; const half = b.w / 2, top = b.y - b.h + 0.01, bot = b.y - 0.01;
    if (dx !== 0) {
      const edge = dx > 0 ? b.x + half : b.x - half, c = map.col(edge);
      for (let r = map.row(top); r <= map.row(bot); r++) {
        if (map.isSolid(c, r)) { b.x = dx > 0 ? c * ts - half - 0.001 : (c + 1) * ts + half + 0.001; if (dx > 0) b.hitR = true; else b.hitL = true; b.vx = bounceX ? -b.vx * bounceX : 0; dx = 0; break; }
      }
      if (dx !== 0 && solids) for (const s of solids) {
        if (s.dead || s.passable || s.oneway) continue;
        if (b.x + half > s.x && b.x - half < s.x + s.w && top < s.y + s.h && bot > s.y) { b.x = dx > 0 ? s.x - half - 0.001 : s.x + s.w + half + 0.001; if (dx > 0) b.hitR = true; else b.hitL = true; b.vx = bounceX ? -b.vx * bounceX : 0; dx = 0; break; }
      }
    }
  }
  // ---- vertical ----
  let dy = b.vy * dt; const ny = Math.max(1, Math.ceil(Math.abs(dy) / maxStep)); dy /= ny;
  for (let i = 0; i < ny; i++) {
    const prevBottom = b.y; b.y += dy; const half = b.w / 2 - 0.5, left = b.x - half, right = b.x + half;
    if (dy > 0) { // falling: land on solid or one-way tiles
      const r = map.row(b.y); let landed = false;
      for (let c = map.col(left); c <= map.col(right) && !landed; c++) {
        const here = map.ch(c, r);
        if (map.solidSet.has(here) || (!dropThrough && map.oneSet.has(here) && prevBottom <= r * ts + 0.5)) { b.y = r * ts; landed = true; }
      }
      if (!landed && solids) for (const s of solids) {
        if (s.dead || s.passable || (s.oneway && dropThrough)) continue;
        if (right > s.x && left < s.x + s.w && prevBottom <= s.y + 1.5 && b.y >= s.y) { b.y = s.y; landed = true; b.platform = s; break; }
      }
      if (landed) { b.vy = 0; b.onGround = true; dy = 0; }
    } else if (dy < 0) { // rising: bump head on solid tiles
      const topY = b.y - b.h, r = map.row(topY); let bumped = false;
      for (let c = map.col(left); c <= map.col(right); c++) {
        if (map.isSolid(c, r)) { b.y = (r + 1) * ts + b.h + 0.001; bumped = true; b.hitU = true; if (onTileBump) onTileBump(c, r); }
      }
      if (!bumped && solids) for (const s of solids) {
        if (s.dead || s.passable || s.oneway) continue;
        if (right > s.x && left < s.x + s.w && topY < s.y + s.h && prevBottom - b.h >= s.y + s.h - 1) { b.y = s.y + s.h + b.h + 0.001; bumped = true; b.hitU = true; break; }
      }
      if (bumped) { b.vy = 0; dy = 0; }
    }
  }
  // fell out of the world
  b.fell = b.y - b.h > map.h + 80;
  return b;
}

// does this body overlap any hazard tile? (spikes) -- uses a slightly shrunk box so grazing a corner is forgiven
export function touchingHazard(map, b, shrink = 6) {
  const l = b.x - b.w / 2 + shrink, r = b.x + b.w / 2 - shrink, t = b.y - b.h + shrink, bt = b.y - 2;
  for (let rr = map.row(t); rr <= map.row(bt); rr++) for (let cc = map.col(l); cc <= map.col(r); cc++) if (map.isHazard(cc, rr)) {
    // spikes only fill the lower part of their tile
    const tileTop = rr * map.ts + map.ts * 0.45; if (bt > tileTop) return { c: cc, r: rr };
  }
  return null;
}

export const bodyRect = (b) => ({ x: b.x - b.w / 2, y: b.y - b.h, w: b.w, h: b.h });
export const bodiesOverlap = (a, b, pad = 0) => Math.abs(a.x - b.x) < (a.w + b.w) / 2 - pad && a.y > b.y - b.h + pad && a.y - a.h < b.y - pad;

// ---- the hero controller: acceleration, variable jump, coyote time, jump buffer (the "feel") --------------------------------------
export const HERO_DEFAULT = { maxRun: 262, accel: 1900, decel: 2200, airAccel: 1400, airDecel: 700, gravity: 2300, fallGravityMul: 1.25, jumpV: 700, jumpCut: 0.46, maxFall: 860, coyote: 0.1, buffer: 0.12, runBoost: 1.0 };
export function heroControl(b, inp, dt, P = HERO_DEFAULT, ctrl = {}) {
  // inp: { dir (-1..1), jumpPressed, jumpHeld, down }
  const dir = inp.dir || 0, ground = b.onGround;
  b.coyoteT = ground ? P.coyote : Math.max(0, (b.coyoteT || 0) - dt);
  b.bufferT = inp.jumpPressed ? P.buffer : Math.max(0, (b.bufferT || 0) - dt);
  const maxRun = P.maxRun * (ctrl.speedMul || 1), slip = ctrl.slippery ? 0.18 : 1;
  const acc = (ground ? (dir ? P.accel : P.decel) : dir ? P.airAccel : P.airDecel) * slip;
  if (dir) {
    const turning = sign(b.vx) === -dir && Math.abs(b.vx) > 40;
    b.vx += dir * acc * (turning ? 1.6 : 1) * dt; if (Math.abs(b.vx) > maxRun) b.vx = sign(b.vx) * Math.max(maxRun, Math.abs(b.vx) - P.decel * dt);
    b.face = dir;
  } else { const d = acc * dt; b.vx = Math.abs(b.vx) <= d ? 0 : b.vx - sign(b.vx) * d; }
  let jumped = false;
  if (b.bufferT > 0 && b.coyoteT > 0) { b.vy = -P.jumpV * (ctrl.jumpMul || 1); b.bufferT = 0; b.coyoteT = 0; b.onGround = false; b.jumping = true; jumped = true; }
  if (!inp.jumpHeld && b.jumping && b.vy < 0) { b.vy *= P.jumpCut; b.jumping = false; }
  if (b.vy >= 0) b.jumping = false;
  const g = P.gravity * (b.vy > 0 ? P.fallGravityMul : 1); b.vy = Math.min(P.maxFall, b.vy + g * dt);
  return { jumped };
}
