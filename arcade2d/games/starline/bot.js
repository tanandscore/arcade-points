// Starline Vanguard: the automatic pilot. Every frame it tries nine possible moves (stay, or a step in each of 8 directions), imagines the next third of a second
// for each, and picks the safest one, leaning toward lining up a shot or grabbing a power-up. It drops a Nova bomb when it is about to be boxed in.
// The tests let it fly every stage to prove each one can be cleared.
import { TOP, BOT, XMIN, XMAX, SHIP, ENEMIES } from "./sim";

const DIRS = [[0, 0], [0, -1], [0, 1], [1, 0], [-1, 0], [1, -1], [1, 1], [-1, -1], [-1, 1]];
const HORIZON = [0.06, 0.12, 0.18, 0.25, 0.32, 0.4];
export function newBrain() { return { tx: 150, react: 0, last: [0, 0] }; }

function danger(S, x, y, tt) {
  let d = 0;
  for (const b of S.eb) { const bx = b.x + b.vx * tt, by = b.y + b.vy * tt, dist = Math.hypot(bx - x, by - y), lim = b.r + SHIP.r + 9; if (dist < lim) d += (lim - dist) / lim * 3 + 2; else if (dist < lim + 14) d += 0.4; }
  for (const e of S.en) { const ex = e.x + (e.type === "rock" ? -95 : e.type === "drone" ? -175 : e.type === "swooper" ? -205 : 0) * tt, ey = e.y, dist = Math.hypot(ex - x, ey - y), lim = e.r + SHIP.r + 12; if (dist < lim) d += 6; else if (dist < lim + 20) d += 0.8; }
  return d;
}
export function botInput(S, brain) {
  const sh = S.ship; if (S.status !== "play") return { mx: 0, my: 0 };
  // human-like reaction time: it only re-decides about 6 times a second (a perfect every-frame dodger would make every stage look easy)
  if (brain.hold > 0) { brain.hold--; return { mx: brain.last[0], my: brain.last[1], nova: false }; }
  // goal: line up with the nearest threat ahead, or a power-up
  let gx = 170, gy = sh.y, best = 1e9;
  for (const e of S.en) { if (e.x > sh.x && e.x < 940) { const d = (e.x - sh.x) + Math.abs(e.y - sh.y) * 0.5 + (ENEMIES[e.type].boss ? -300 : 0); if (d < best) { best = d; gy = e.y; } } }
  for (const p of S.pk) { if (p.x > sh.x - 20) { gx = Math.min(XMAX - 20, Math.max(XMIN, p.x)); gy = p.y; break; } }
  // look further ahead: if bullets that will reach the ship's column soon cover this height, head for the nearest free height
  { const risk = (y) => { let r = 0; for (const b of S.eb) { if (b.vx >= -20) continue; const tt = (b.x - sh.x) / -b.vx; if (tt < 0 || tt > 2.0) continue; const by = b.y + b.vy * tt; if (Math.abs(by - y) < b.r + SHIP.r + 14) r++; } return r; };
    if (risk(sh.y) > 0) { let by2 = null, bd = 1e9; for (let y = TOP + 14; y <= BOT - 14; y += 10) if (risk(y) === 0 && Math.abs(y - sh.y) < bd) { bd = Math.abs(y - sh.y); by2 = y; } if (by2 != null) { gy = by2; } } }
  let bestScore = 1e9, bestDir = DIRS[0], dStay = 0;
  for (const dir of DIRS) {
    let cost = 0; const sp = SHIP.speed;
    for (const tt of HORIZON) { const x = Math.max(XMIN, Math.min(XMAX, sh.x + dir[0] * sp * tt * (dir[0] && dir[1] ? 0.707 : 1))), y = Math.max(TOP + 10, Math.min(BOT - 10, sh.y + dir[1] * sp * tt * (dir[0] && dir[1] ? 0.707 : 1))); cost += danger(S, x, y, tt) * (1.6 - tt); }
    if (dir === DIRS[0]) dStay = cost;
    const fx = Math.max(XMIN, Math.min(XMAX, sh.x + dir[0] * sp * 0.3)), fy = Math.max(TOP + 10, Math.min(BOT - 10, sh.y + dir[1] * sp * 0.3));
    cost += Math.abs(fy - gy) * 0.012 + Math.abs(fx - gx) * 0.006 + (dir === DIRS[0] ? 0 : 0.03);
    if (fy < TOP + 30 || fy > BOT - 30) cost += 0.25;
    if (cost < bestScore) { bestScore = cost; bestDir = dir; }
  }
  const nova = bestScore > 5.5 && sh.nova > 0 || (sh.hp <= 1 && bestScore > 2.5 && sh.nova > 0);
  brain.hold = 9; brain.last = [bestDir[0], bestDir[1]];
  return { mx: bestDir[0], my: bestDir[1], nova };
}
