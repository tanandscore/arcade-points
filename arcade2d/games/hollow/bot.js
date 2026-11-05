// Hollow Deep: the automatic hero. It reads the game state like a player would (monsters, arrows, shock rings, spikes) and presses the same
// buttons: move, swing, bolt, dash. It is used to prove that every floor can be cleared with all three stars, to play behind the title screen,
// and to drive the real keyboard in the browser test.
import { TS, GW, GH, OY, HERO_R, MAX_HP, ENEMY, bfs, tileOf, tilePos, spikeOn, spikeWarn, nearestEnemy, SWING_REACH } from "./sim";

const MELEE = new Set(["slime", "bat", "brute", "warden", "golem"]);
const RANGED = new Set(["archer", "wisp", "queen", "eye"]);

function blockedMap(S) {
  const b = new Uint8Array(GW * GH);
  for (const sp of S.F.spikes) if (spikeOn(S, sp) || spikeWarn(S, sp) || ((S.t + sp.ph + 0.6) % 3.2) > 1.9) b[sp.r * GW + sp.c] = 1;
  return b;
}
function los(S, x0, y0, x1, y1) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8);
  for (let i = 1; i < n; i++) { const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n; for (const [ox, oy] of [[-9, 0], [9, 0], [0, -9], [0, 9]]) { const [c, r] = tileOf(x + ox, y + oy); if (S.F.g[r * GW + c]) return false; } }
  return true;
}
// the direction of the next step on a walkable route to (x, y)
function routeDir(S, M, x, y, blocked) {
  const h = S.hero; if (los(S, h.x, h.y, x, y) && !crossesBlocked(S, h.x, h.y, x, y, blocked)) { const d = Math.hypot(x - h.x, y - h.y) || 1; return [(x - h.x) / d, (y - h.y) / d, d]; }
  const [tc, tr] = tileOf(x, y), key = tc + "," + tr + "," + (S.t * 4 | 0);
  if (M.dkey !== key) { M.dkey = key; M.dist = bfs(S.F.g, tc, tr, blocked); }
  const [hc, hr] = tileOf(h.x, h.y);
  if (M.dist[hr * GW + hc] < 0 && blocked) { const alt = bfs(S.F.g, tc, tr, null); M.dist = alt; }   // a trap sits in the only corridor: cross it anyway (a dash makes that safe)
  let best = null, bd = M.dist[hr * GW + hc] < 0 ? 1e9 : M.dist[hr * GW + hc];
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const nc = hc + dc, nr = hr + dr; if (nc < 0 || nr < 0 || nc >= GW || nr >= GH) continue; const d = M.dist[nr * GW + nc]; if (d < 0) continue;
    if (dc && dr && (S.F.g[hr * GW + nc] || S.F.g[nr * GW + hc])) continue;
    if (d + (dc && dr ? 0.4 : 0) < bd) { bd = d + (dc && dr ? 0.4 : 0); best = [nc, nr]; }
  }
  if (!best) { const d = Math.hypot(x - h.x, y - h.y) || 1; return [(x - h.x) / d, (y - h.y) / d, d]; }
  const [px, py] = tilePos(best[0], best[1]), d = Math.hypot(px - h.x, py - h.y) || 1; return [(px - h.x) / d, (py - h.y) / d, Math.hypot(x - h.x, y - h.y)];
}
function crossesBlocked(S, x0, y0, x1, y1, blocked) { if (!blocked) return false; const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 10); for (let i = 0; i <= n; i++) { const [c, r] = tileOf(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n); if (blocked[r * GW + c]) return true; } return false; }
const freeAt = (S, x, y) => { for (const [ox, oy] of [[-10, -10], [10, -10], [-10, 10], [10, 10]]) { const [c, r] = tileOf(x + ox, y + oy); if (S.F.g[r * GW + c]) return false; } return true; };

export function newBrain() { return { dkey: "", dist: null, side: 1, sideT: 0 }; }

export function botInput(S, M) {
  const h = S.hero, out = { mx: 0, my: 0, swing: false, bolt: false, dash: false };
  const blocked = blockedMap(S);
  let steer = [0, 0], danger = false;
  const add = (v, w) => { steer[0] += v[0] * w; steer[1] += v[1] * w; };
  const foes = S.enemies.filter((e) => e.hp > 0 && e.spawn <= 0);
  // ---- shock rings
  for (const rg of S.rings) { const d = Math.hypot(h.x - rg.x, h.y - rg.y), out_ = d - rg.r; if (out_ > -4 && out_ < 120) { danger = true; if (out_ < 34 && h.dashCd <= 0) out.dash = true; add([(h.x - rg.x) / (d || 1), (h.y - rg.y) / (d || 1)], 2.2); } }
  // ---- arrows and sparks
  for (const s of S.shots) {
    const rx = s.x - h.x, ry = s.y - h.y, v2 = s.vx * s.vx + s.vy * s.vy, tt = -(rx * s.vx + ry * s.vy) / v2;
    if (tt < 0 || tt > 0.65) continue;
    const mx_ = rx + s.vx * tt, my_ = ry + s.vy * tt, miss = Math.hypot(mx_, my_); if (miss > 24) continue;
    if (!los(S, s.x, s.y, s.x + s.vx * tt, s.y + s.vy * tt)) continue;   // it will hit a wall first
    const dist = Math.hypot(rx, ry);
    if (dist < 52 && h.swingCd <= 0) { out.swing = true; M.faceShot = [s.x, s.y]; danger = true; continue; }
    danger = true;
    // sidestep: perpendicular to the shot, away from where it will pass
    const sl = Math.sqrt(v2), px = -s.vy / sl, py = s.vx / sl, side = mx_ * px + my_ * py > 0 ? -1 : 1;
    let vx = px * side, vy = py * side; if (!freeAt(S, h.x + vx * 22, h.y + vy * 22)) { vx = -vx; vy = -vy; }
    add([vx, vy], 1.6);
    if (tt < 0.16 && miss < 17 && h.dashCd <= 0) out.dash = true;
  }
  // ---- charging brutes and wardens
  for (const e of foes) {
    if ((e.type === "brute" || e.type === "warden") && (e.st === "tele" || e.st === "charge")) {
      const dx = h.x - e.x, dy = h.y - e.y, along = dx * e.dirx + dy * e.diry, across = -dx * e.diry + dy * e.dirx;
      if (along > -20 && along < 330 && Math.abs(across) < e.r + 34) {
        danger = true; const sd = across >= 0 ? 1 : -1; let vx = -e.diry * sd, vy = e.dirx * sd; if (!freeAt(S, h.x + vx * 24, h.y + vy * 24)) { vx = -vx; vy = -vy; }
        add([vx, vy], 2.0); if (e.st === "charge" && along < 140 && h.dashCd <= 0) { out.dash = true; steer = [vx, vy]; }
      }
    }
  }
  // ---- spikes under or next to the hero
  { const [hc, hr] = tileOf(h.x, h.y); for (const sp of S.F.spikes) if (Math.abs(sp.c - hc) <= 1 && Math.abs(sp.r - hr) <= 1 && blocked[sp.r * GW + sp.c]) { const [sx, sy] = tilePos(sp.c, sp.r), d = Math.hypot(h.x - sx, h.y - sy) || 1; add([(h.x - sx) / d, (h.y - sy) / d], 1.4); danger = true; } }
  // ---- what to do about the monsters
  let target = null;
  if (foes.length) {
    let best = 1e9; for (const e of foes) { const d = Math.hypot(e.x - h.x, e.y - h.y) - e.r; const pri = RANGED.has(e.type) && !ENEMY[e.type].boss ? 90 : 0; const sc = d - pri; if (sc < best) { best = sc; target = e; } }
    // keep clear of anything that can bite
    for (const e of foes) { const d = Math.hypot(e.x - h.x, e.y - h.y) - e.r; const keep = e.type === "brute" || e.type === "warden" || e.type === "golem" ? 62 : MELEE.has(e.type) ? 38 : 0; if (keep && d < keep) { const m = Math.hypot(h.x - e.x, h.y - e.y) || 1; add([(h.x - e.x) / m, (h.y - e.y) / m], 1.5 * (1 - d / keep) + 0.4); } }
    const t = target, d = Math.hypot(t.x - h.x, t.y - h.y), gap = d - t.r;
    const range = SWING_REACH - 6;
    const boss = ENEMY[t.type].boss;
    if (gap < range && (!MELEE.has(t.type) || t.st !== "tele" || gap < 30)) {
      // in reach: swing. Heavy hitters get a little room.
      if (h.swingCd <= 0 && !(t.type === "brute" && t.st === "charge")) out.swing = true;
      const keepD = t.type === "brute" || t.type === "warden" || t.type === "golem" ? 50 : 36;
      if (gap < keepD) { const m = d || 1; add([(h.x - t.x) / m, (h.y - t.y) / m], 0.9); }
      else { const m = d || 1; add([(t.x - h.x) / m, (t.y - h.y) / m], 0.25); }
      M.faceT = t;
    } else {
      // ranged monsters: spend bolts from a distance
      if (RANGED.has(t.type) && gap > 110 && h.en >= (boss ? 1 : 2) && los(S, h.x, h.y, t.x, t.y)) out.bolt = true;
      if (boss && gap > 90 && h.en >= 1 && los(S, h.x, h.y, t.x, t.y) && h.swingCd > 0.1) out.bolt = true;
      const r = routeDir(S, M, t.x, t.y, blocked); const w = danger ? 0.8 : 1.3; add([r[0], r[1]], w);
    }
    // hearts, when hurt and the coast is clear
  } else if (S.pickups.length && h.hp < MAX_HP) {
    const p = S.pickups[0], r = routeDir(S, M, p.x, p.y, blocked); add([r[0], r[1]], 1.2);
  } else if (S.stairsOpen) {
    const [cx_, cy_] = tilePos(S.F.chest[0], S.F.chest[1]), [sx, sy] = tilePos(S.F.stairs[0], S.F.stairs[1]);
    const tx = S.chestOpen ? sx : cx_, ty = S.chestOpen ? sy : cy_, r = routeDir(S, M, tx, ty, blocked); add([r[0], r[1]], 1.3);
  } else if (S.pickups.length) { const p = S.pickups[0], r = routeDir(S, M, p.x, p.y, blocked); add([r[0], r[1]], 1);
  } else {
    // waiting for the next wave: stand in the middle of the room
    const r = routeDir(S, M, 15 * TS, OY + 7 * TS + 16, blocked); if (r[2] > 40) add([r[0], r[1]], 0.8);
  }
  // pick up hearts on the way if they are close and nothing is chasing
  if (foes.length && h.hp < MAX_HP) for (const p of S.pickups) { const d = Math.hypot(p.x - h.x, p.y - h.y); if (d < 120) { const m = d || 1; add([(p.x - h.x) / m, (p.y - h.y) / m], 0.9); break; } }
  // do not get pinned against a wall while kiting
  if (foes.some((e) => Math.hypot(e.x - h.x, e.y - h.y) < 120)) for (let a = 0; a < 8; a++) { const ang = (a / 8) * Math.PI * 2, ux = Math.cos(ang), uy = Math.sin(ang); if (!freeAt(S, h.x + ux * 34, h.y + uy * 34)) add([-ux, -uy], 0.45); }
  // stall check: if we have hardly moved for a while and nothing is hurting us, take the plain route to the goal for a moment
  M.hist = M.hist || []; M.hist.push([S.t, h.x, h.y]); while (M.hist.length && S.t - M.hist[0][0] > 1.6) M.hist.shift();
  const first = M.hist[0], still = first && S.t - first[0] > 1.5 && Math.hypot(h.x - first[1], h.y - first[2]) < 14 && !out.swing && !danger && !foes.some((e) => Math.hypot(e.x - h.x, e.y - h.y) < 110);
  if (still && !M.unstick) M.unstick = S.t + 0.9;
  if (M.unstick && S.t < M.unstick) {
    const goal = target || (S.pickups[0] && h.hp < MAX_HP ? S.pickups[0] : null) || { x: 15 * TS, y: OY + 7 * TS + 16 };
    const gx = goal.x, gy = goal.y, r = routeDir(S, M, gx, gy, null); steer = [r[0], r[1]];
  } else if (M.unstick) { M.unstick = 0; M.hist.length = 0; }
  const l = Math.hypot(steer[0], steer[1]);
  if (l > 0.05) { const k = l < 0.6 && !danger && !foes.some((e) => Math.hypot(e.x - h.x, e.y - h.y) < 110) ? 0.6 / l : 1 / Math.max(1, l); out.mx = steer[0] * k; out.my = steer[1] * k; }
  // aim: the swing/bolt auto-aims at the nearest monster; if we deflect an arrow, aim at it
  if (out.swing && M.faceShot && S.shots.length && !foes.some((e) => Math.hypot(e.x - h.x, e.y - h.y) - e.r < SWING_REACH - 6)) { out.aimX = M.faceShot[0]; out.aimY = M.faceShot[1]; }
  M.faceShot = null;
  return out;
}
