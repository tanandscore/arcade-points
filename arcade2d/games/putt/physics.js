// Putt Planet: the ball physics. Pure code (no drawing), so the game, the automatic solver and the tests all use the very same rules.
// Everything is in pixels on a 960 x 540 stage. The ball moves in tiny fixed steps (1/240 s) so even a fast ball never skips through a wall.
//
// A course (see levels.js) has: a fairway outline `poly`, solid `blocks` (rectangles), round `bumpers`, `sand` and `ice` patches, `water` (or lava),
// `boost` pads, planets with gravity (`wells`), `portals` and spinning `blades`.

export const BALL_R = 9;
export const CUP_R = 13;
export const STEP = 1 / 240;
export const V_MAX = 820;
const REST_SPEED = 14;
const FRICTION = { grass: 0.9, sand: 5.2, ice: 0.26 };

const rectPoly = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
export const R = rectPoly;

// Turn a level description into things that are quick to test against.
export function makeCourse(lv) {
  const segs = [], circles = [];
  const addLoop = (pts, kind) => { for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; segs.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], rest: 0.82, kind }); } };
  addLoop(lv.poly, "wall");
  for (const hole of lv.holes || []) addLoop(hole, "block");
  for (const b of lv.blocks || []) addLoop(rectPoly(b[0], b[1], b[2], b[3]), "block");
  for (const b of lv.bumpers || []) circles.push({ x: b[0], y: b[1], r: b[2], rest: b[3] === "post" ? 0.85 : 1.28, kind: b[3] || "bumper", pop: 0 });
  const wells = (lv.wells || []).map((w) => ({ ...w })); for (const w of wells) circles.push({ x: w.x, y: w.y, r: w.r, rest: 0.6, kind: "planet", pop: 0 });
  const blades = (lv.blades || []).map((b) => ({ ...b, w: b.w || 12 }));
  return { lv, segs, circles, wells, blades, sand: lv.sand || [], ice: lv.ice || [], water: lv.water || [], boost: lv.boost || [], portals: lv.portals || [], cup: lv.cup, tee: lv.tee };
}

const inRect = (r, x, y) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];

export function bladeAngle(b, T) { return (b.phase || 0) + b.speed * T; }
export function bladeEnds(b, T) { const a = bladeAngle(b, T), c = Math.cos(a) * b.len / 2, s = Math.sin(a) * b.len / 2; return [b.x - c, b.y - s, b.x + c, b.y + s]; }

export function surfaceAt(C, x, y) {
  for (const r of C.ice) if (inRect(r, x, y)) return "ice";
  for (const r of C.sand) if (inRect(r, x, y)) return "sand";
  return "grass";
}

export function newBall(x, y) { return { x, y, vx: 0, vy: 0, rest: 0, state: "roll", cd: 0, hits: 0, last: null }; }

// bounce off a line segment (optionally one that is moving: `ox`,`oy` is its pace at the contact point)
function hitSeg(b, ax, ay, bx, by, rad, rest, vxs = 0, vys = 0) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  let t = ((b.x - ax) * dx + (b.y - ay) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * t, qy = ay + dy * t, ex = b.x - qx, ey = b.y - qy, d2 = ex * ex + ey * ey;
  if (d2 >= rad * rad) return false;
  const d = Math.sqrt(d2) || 0.0001, nx = d2 > 1e-8 ? ex / d : -dy / Math.sqrt(l2), ny = d2 > 1e-8 ? ey / d : dx / Math.sqrt(l2);
  b.x = qx + nx * rad; b.y = qy + ny * rad;
  const rvx = b.vx - vxs, rvy = b.vy - vys, vn = rvx * nx + rvy * ny;
  if (vn < 0) { const j = -(1 + rest) * vn; b.vx += j * nx; b.vy += j * ny; b.hits++; return Math.abs(vn); }
  return 0;
}

// advance the ball by one fixed step. T is the clock of the whole course (it makes the blades spin). Returns what happened: null, "bump", "cup", "water"
export function stepBall(C, b, T) {
  if (b.state !== "roll") return null;
  const dt = STEP; let event = null;
  // gravity of the planets
  for (const w of C.wells) {
    const dx = w.x - b.x, dy = w.y - b.y, d2 = dx * dx + dy * dy, d = Math.sqrt(d2) || 1, a = w.gm / Math.max(d2, w.r * w.r * 1.4);
    b.vx += (dx / d) * a * dt; b.vy += (dy / d) * a * dt;
  }
  // speed boost pads
  for (const p of C.boost) if (inRect(p.r, b.x, b.y)) { b.vx += p.dx * 900 * dt; b.vy += p.dy * 900 * dt; const s = Math.hypot(b.vx, b.vy); if (s > 1000) { b.vx *= 1000 / s; b.vy *= 1000 / s; } }
  // friction depends on what the ball rolls over
  const k = FRICTION[surfaceAt(C, b.x, b.y)], f = Math.exp(-k * dt); b.vx *= f; b.vy *= f;
  b.x += b.vx * dt; b.y += b.vy * dt;
  // solid things
  for (let pass = 0; pass < 2; pass++) {
    for (const s of C.segs) { const v = hitSeg(b, s.ax, s.ay, s.bx, s.by, BALL_R, s.rest); if (v > 60) event = "bump"; }
    for (const c of C.circles) {
      const dx = b.x - c.x, dy = b.y - c.y, rr = c.r + BALL_R, d2 = dx * dx + dy * dy;
      if (d2 < rr * rr) {
        const d = Math.sqrt(d2) || 0.001, nx = dx / d, ny = dy / d; b.x = c.x + nx * rr; b.y = c.y + ny * rr;
        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) { b.vx -= (1 + c.rest) * vn * nx; b.vy -= (1 + c.rest) * vn * ny; if (c.kind === "bumper") { const sp = Math.hypot(b.vx, b.vy); if (sp < 300) { b.vx *= 300 / sp; b.vy *= 300 / sp; } } c.pop = 1; b.hits++; if (-vn > 60) event = "bump"; }
      }
    }
    for (const bl of C.blades) {
      const [ax, ay, bx, by] = bladeEnds(bl, T), w = bladeAngle(bl, T);
      // point on the blade nearest the ball, to get how fast that spot moves
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1; let t = ((b.x - ax) * dx + (b.y - ay) * dy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = ax + dx * t, qy = ay + dy * t, rx = qx - bl.x, ry = qy - bl.y, om = bl.speed;
      const v = hitSeg(b, ax, ay, bx, by, BALL_R + bl.w / 2, 0.9, -om * ry, om * rx); void w;
      if (v > 60) event = "bump";
    }
  }
  // portals: step in and come out of the twin
  if (b.cd > 0) b.cd -= dt;
  else for (const p of C.portals) {
    for (let s = 0; s < 2; s++) {
      const px = p[s * 2], py = p[s * 2 + 1], ox = p[(1 - s) * 2], oy = p[(1 - s) * 2 + 1];
      if (Math.hypot(b.x - px, b.y - py) < 15) { b.x = ox; b.y = oy; b.cd = 0.5; event = "portal"; b.portal = [px, py, ox, oy]; break; }
    }
    if (event === "portal") break;
  }
  // water (or lava)
  for (const r of C.water) if (inRect(r, b.x, b.y)) { b.state = "water"; return "water"; }
  // out of the fairway (should not happen) counts as water
  if (b.x < -40 || b.x > 1000 || b.y < -40 || b.y > 580) { b.state = "water"; return "water"; }
  // the cup
  const cdx = C.cup[0] - b.x, cdy = C.cup[1] - b.y, cd = Math.hypot(cdx, cdy), sp = Math.hypot(b.vx, b.vy);
  if (cd < CUP_R - 1 && sp < 430) { b.state = "cup"; b.x = C.cup[0]; b.y = C.cup[1]; b.vx = b.vy = 0; return "cup"; }
  if (cd < CUP_R + 9 && sp < 190) { const pull = 520 * dt; b.vx += (cdx / (cd || 1)) * pull; b.vy += (cdy / (cd || 1)) * pull; }
  // coming to a stop
  if (sp < REST_SPEED && C.wells.length === 0) { b.rest += dt; if (b.rest > 0.12) { b.vx = b.vy = 0; b.state = "stopped"; } } else if (sp < REST_SPEED * 0.6) { b.rest += dt; if (b.rest > 0.5) { b.vx = b.vy = 0; b.state = "stopped"; } } else b.rest = 0;
  return event;
}

// hit the ball: angle in radians (0 = right), power 0..1. Runs until it stops, drops in or falls in the water.
export function simulate(C, x, y, angle, power, T0 = 0, maxT = 14, onStep = null) {
  const b = newBall(x, y), sp = Math.max(0.05, Math.min(1, power)) * V_MAX; b.vx = Math.cos(angle) * sp; b.vy = Math.sin(angle) * sp;
  let T = T0, steps = 0; const lim = Math.round(maxT / STEP);
  while (b.state === "roll" && steps < lim) { const ev = stepBall(C, b, T); T += STEP; steps++; if (onStep) onStep(b, ev, T); }
  if (b.state === "roll") b.state = "stopped";
  return { x: b.x, y: b.y, state: b.state, time: T - T0, hits: b.hits };
}

// a dotted guess of where a shot goes first (straight line, a couple of bounces, no friction): only used to draw the aiming guide
export function aimLine(C, x, y, angle, length = 260, bounces = 2) {
  const pts = [[x, y]]; let px = x, py = y, dx = Math.cos(angle), dy = Math.sin(angle), left = length;
  for (let n = 0; n <= bounces && left > 0; n++) {
    let best = left, nx = 0, ny = 0, hit = false;
    for (const s of C.segs) {
      // ray against the segment pushed out by the ball radius (a capsule); good enough to test the two flat sides and the end caps
      const ex = s.bx - s.ax, ey = s.by - s.ay, el = Math.hypot(ex, ey) || 1, ux = ex / el, uy = ey / el, vx = -uy, vy = ux;
      for (const side of [1, -1]) {
        const ox = s.ax + vx * BALL_R * side, oy = s.ay + vy * BALL_R * side;
        const dd = dx * vx + dy * vy; if (Math.abs(dd) < 1e-6) continue;
        const t = ((ox - px) * vx + (oy - py) * vy) / dd; if (t <= 0.5 || t >= best) continue;
        const along = ((px + dx * t - s.ax) * ux + (py + dy * t - s.ay) * uy); if (along < 0 || along > el) continue;
        if ((dx * vx + dy * vy) * side >= 0) continue; best = t; nx = vx * side; ny = vy * side; hit = true;
      }
    }
    for (const c of C.circles) {
      const fx = px - c.x, fy = py - c.y, rr = c.r + BALL_R, bq = fx * dx + fy * dy, cq = fx * fx + fy * fy - rr * rr, disc = bq * bq - cq;
      if (disc < 0) continue; const t = -bq - Math.sqrt(disc); if (t <= 0.5 || t >= best) continue;
      best = t; const hx = px + dx * t - c.x, hy = py + dy * t - c.y, hl = Math.hypot(hx, hy) || 1; nx = hx / hl; ny = hy / hl; hit = true;
    }
    px += dx * best; py += dy * best; pts.push([px, py]); left -= best;
    if (!hit) break;
    const dot = dx * nx + dy * ny; dx -= 2 * dot * nx; dy -= 2 * dot * ny; px += dx * 0.6; py += dy * 0.6;
  }
  return pts;
}
