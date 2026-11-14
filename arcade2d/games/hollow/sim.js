// Hollow Deep: the rules of the dungeon. Pure code with no drawing, used by the game, the automatic hero (bot.js) and the tests.
// One floor is a single screen-sized room. Clear every wave of monsters, open the relic chest if you can, and take the stairs.
// Units are pixels on the 960x540 game screen; time is in seconds, stepped at 60 times a second.
import { rng } from "../../core/util";

export const DT = 1 / 60;
export const TS = 32, GW = 30, GH = 15, OY = 50;           // tile size, room size in tiles, room's top edge on screen
export const HERO_R = 10, MAX_HP = 5, MAX_EN = 3;
export const SWING_CD = 0.34, SWING_REACH = 56, DASH_CD = 0.9, DASH_T = 0.15, DASH_SPEED = 520, HERO_SPEED = 150, IFRAMES = 0.9;

export const ENEMY = {
  slime:  { hp: 2, r: 11, speed: 54, dmg: 1, gem: 1, name: "Slime" },
  bat:    { hp: 1, r: 9, speed: 105, dmg: 1, gem: 1, name: "Bat" },
  archer: { hp: 2, r: 11, speed: 62, dmg: 1, gem: 2, name: "Skeleton archer" },
  brute:  { hp: 6, r: 15, speed: 42, dmg: 2, gem: 3, name: "Brute" },
  wisp:   { hp: 3, r: 11, speed: 55, dmg: 1, gem: 2, name: "Wisp", flies: true },
  warden: { hp: 26, r: 24, speed: 46, dmg: 2, gem: 20, name: "Crypt Warden", boss: true },
  queen:  { hp: 28, r: 19, speed: 40, dmg: 1, gem: 20, name: "Frost Queen", boss: true },
  golem:  { hp: 26, r: 26, speed: 30, dmg: 2, gem: 20, name: "Magma Golem", boss: true },
  eye:    { hp: 30, r: 22, speed: 30, dmg: 1, gem: 30, name: "Void Eye", boss: true, flies: true },
};

const cx = (c) => c * TS + TS / 2, cy = (r) => OY + r * TS + TS / 2;
export const tileOf = (x, y) => [Math.floor(x / TS), Math.floor((y - OY) / TS)];
export const tilePos = (c, r) => [cx(c), cy(r)];

// ------------------------------------------------------------------------------------------------------------------ floor building
function fillRect(g, c0, r0, w, h, v = 1) { for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) if (r > 0 && r < GH - 1 && c > 0 && c < GW - 1) g[r * GW + c] = v; }

export function buildFloor(lv) {
  const R = rng(lv.seed || 7), g = new Uint8Array(GW * GH);
  for (let r = 0; r < GH; r++) for (let c = 0; c < GW; c++) if (r === 0 || c === 0 || r === GH - 1 || c === GW - 1) g[r * GW + c] = 1;
  const layout = lv.layout || "open";
  if (layout === "pillars") { const n = lv.pillars || 8; for (let i = 0; i < n; i++) { const c = R.int(6, GW - 7), r = R.int(2, GH - 4); fillRect(g, c, r, 2, 2); fillRect(g, GW - 1 - c - 1, GH - 1 - r - 1, 2, 2); } }
  else if (layout === "lanes") { fillRect(g, 7, 3, 2, 8); fillRect(g, 7, 3, 2, 1); fillRect(g, 13, 4, 2, 8); fillRect(g, 19, 2, 2, 8); fillRect(g, 24, 5, 1, 7); }
  else if (layout === "chambers") { fillRect(g, 9, 1, 2, 4); fillRect(g, 9, 9, 2, 5); fillRect(g, 15, 1, 2, 6); fillRect(g, 15, 10, 2, 4); fillRect(g, 21, 1, 2, 3); fillRect(g, 21, 8, 2, 6); }
  else if (layout === "cross") { fillRect(g, 13, 2, 4, 4); fillRect(g, 13, 9, 4, 4); fillRect(g, 5, 6, 3, 3); fillRect(g, 22, 6, 3, 3); fillRect(g, 10, 7, 2, 1); fillRect(g, 18, 7, 2, 1); }
  else if (layout === "ring") { for (let a = 0; a < 16; a++) { if (a % 4 === 0) continue; const ang = (a / 16) * Math.PI * 2, c = Math.round(14.5 + Math.cos(ang) * 6), r = Math.round(7 + Math.sin(ang) * 4); fillRect(g, c, r, 1, 1); fillRect(g, c + 1, r, 1, 1); } fillRect(g, 14, 7, 2, 1); }
  else if (layout === "boss") { fillRect(g, 7, 3, 2, 2); fillRect(g, 7, 10, 2, 2); fillRect(g, 21, 3, 2, 2); fillRect(g, 21, 10, 2, 2); fillRect(g, 14, 2, 2, 1); fillRect(g, 14, 12, 2, 1); }
  // the doorway areas stay clear
  fillRect(g, 1, 5, 4, 5, 0); fillRect(g, GW - 5, 5, 4, 5, 0);
  // a pocket for the relic chest, cut into the bottom or top wall (found by walking around the room)
  const start = [2, 7], stairs = [GW - 3, 7];
  // anything not reachable from the start becomes solid, so nothing can hide in a sealed corner
  const reach = bfs(g, start[0], start[1]);
  for (let i = 0; i < g.length; i++) if (!g[i] && reach[i] < 0) g[i] = 1;
  // spikes (timed traps), the chest
  const free = []; for (let r = 1; r < GH - 1; r++) for (let c = 1; c < GW - 1; c++) if (!g[r * GW + c]) free.push([c, r]);
  const far = free.filter(([c, r]) => reach[r * GW + c] >= 16 && !(Math.abs(c - stairs[0]) < 3 && Math.abs(r - stairs[1]) < 3)).map(([c, r]) => { let w = 0; for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g[(r + dr) * GW + c + dc]) w++; return { c, r, w, d: reach[r * GW + c] }; });
  far.sort((a, b) => b.w - a.w || b.d - a.d);
  const top = far.filter((f) => f.w === far[0].w), cp = top[Math.floor(R() * top.length)] || { c: GW - 4, r: 2 };
  const spikes = [], taken = new Set([cp.c + "," + cp.r]);
  for (let i = 0; i < (lv.spikes || 0) * 6 && spikes.length < (lv.spikes || 0); i++) {
    const c = R.int(5, GW - 6), r = R.int(2, GH - 3); if (g[r * GW + c] || taken.has(c + "," + r)) continue; if (Math.abs(c - start[0]) < 4 || Math.abs(c - stairs[0]) < 3) continue;
    taken.add(c + "," + r); spikes.push({ c, r, ph: R() * 3 });
  }
  const spawnOK = free.filter(([c, r]) => c >= 9 && c <= GW - 4 && !taken.has(c + "," + r));
  return { g, start, stairs, chest: [cp.c, cp.r], spikes, spawnOK, seed: lv.seed || 7 };
}

export function bfs(g, sc, sr, blocked) {
  const d = new Int16Array(GW * GH).fill(-1), q = [sr * GW + sc]; d[q[0]] = 0;
  for (let i = 0; i < q.length; i++) { const k = q[i], c = k % GW, r = (k / GW) | 0; for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = c + dc, nr = r + dr; if (nc < 0 || nr < 0 || nc >= GW || nr >= GH) continue; const nk = nr * GW + nc; if (g[nk] || d[nk] >= 0 || (blocked && blocked[nk])) continue; d[nk] = d[k] + 1; q.push(nk); } }
  return d;
}

// ------------------------------------------------------------------------------------------------------------------ the state
export function makeState(lv) {
  const F = buildFloor(lv), R = rng((lv.seed || 7) * 31 + 5);
  const [hx, hy] = tilePos(F.start[0], F.start[1]);
  const S = {
    lv, F, t: 0, R, hero: { x: hx, y: hy, vx: 0, vy: 0, fx: 1, fy: 0, hp: MAX_HP, iframes: 0, swingCd: 0, swingT: 0, swingA: 0, dashCd: 0, dashT: 0, dx: 0, dy: 0, en: MAX_EN, enT: 0, hurtT: 0, stepT: 0 },
    enemies: [], shots: [], bolts: [], rings: [], pickups: [], waveIdx: -1, waveWait: 0.8, pending: [], stairsOpen: false, chestOpen: false,
    kills: 0, gems: 0, hits: 0, state: "play", stateT: 0, events: [], won: false, nextId: 1, totalEnemies: 0,
  };
  S.totalEnemies = lv.waves.reduce((a, w) => a + w.reduce((b, [, n]) => b + n, 0), 0);
  return S;
}

const ev = (S, e) => { if (S.events.length < 200) S.events.push(e); };
export function solidAt(S, x, y) { const c = Math.floor(x / TS), r = Math.floor((y - OY) / TS); if (c < 0 || r < 0 || c >= GW || r >= GH) return true; return S.F.g[r * GW + c] === 1; }
// move a circle with sliding collision against the walls
function moveCircle(S, o, dx, dy, rad, flies) {
  if (flies) { o.x = Math.max(TS + rad, Math.min(GW * TS - TS - rad, o.x + dx)); o.y = Math.max(OY + TS + rad, Math.min(OY + (GH - 1) * TS - rad, o.y + dy)); return false; }
  let hit = false;
  const test = (x, y) => solidAt(S, x - rad, y - rad) || solidAt(S, x + rad, y - rad) || solidAt(S, x - rad, y + rad) || solidAt(S, x + rad, y + rad);
  const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 6) || 1;
  for (let i = 0; i < steps; i++) {
    const sx = dx / steps, sy = dy / steps;
    if (!test(o.x + sx, o.y)) o.x += sx;
    else { hit = true; if (sx) for (let n = 2; n <= 22; n += 2) { let done = false; for (const sg of [1, -1]) if (!test(o.x + sx, o.y + sg * n) && !test(o.x, o.y + sg * 1.5)) { o.y += sg * Math.min(1.5, Math.abs(sx) * 0.9 + 0.4); done = true; break; } if (done) break; } }
    if (!test(o.x, o.y + sy)) o.y += sy;
    else { hit = true; if (sy) for (let n = 2; n <= 22; n += 2) { let done = false; for (const sg of [1, -1]) if (!test(o.x + sg * n, o.y + sy) && !test(o.x + sg * 1.5, o.y)) { o.x += sg * Math.min(1.5, Math.abs(sy) * 0.9 + 0.4); done = true; break; } if (done) break; } }
  }
  return hit;
}
export function spikeOn(S, sp) { const p = (S.t + sp.ph) % 3.2; return p > 1.9 ? (p < 3.2 ? 1 : 0) : 0; }   // on for 1.3s out of every 3.2s
export function spikeWarn(S, sp) { const p = (S.t + sp.ph) % 3.2; return p > 1.5 && p <= 1.9; }

// ------------------------------------------------------------------------------------------------------------------ spawning waves
function addEnemy(S, type, x, y, delay = 0.7) {
  const d = ENEMY[type], e = { id: S.nextId++, type, x, y, hp: d.hp, max: d.hp, r: d.r, vx: 0, vy: 0, kx: 0, ky: 0, t: 0, spawn: delay, cd: 1 + S.R() * 1.5, st: "move", stT: 0, dirx: 0, diry: 0, flash: 0, ph: S.R() * 6.28, phase: 0, n: 0 };
  if (type === "archer") e.cd = 1.2 + S.R() * 1.2;
  if (type === "brute") e.cd = 1.5 + S.R() * 1.5;
  if (d.boss) { e.cd = 2.2; e.n = 0; }
  S.enemies.push(e); return e;
}
function spawnWave(S) {
  S.waveIdx++; const w = S.lv.waves[S.waveIdx]; if (!w) return;
  const pts = S.F.spawnOK.slice(); const R = S.R; const chosen = [];
  for (const [type, n] of w) for (let i = 0; i < n; i++) {
    const boss = ENEMY[type].boss; let best = null;
    for (let k = 0; k < 14; k++) {
      const [c, r] = boss ? [21, 7] : pts[Math.floor(R() * pts.length)], [x, y] = tilePos(c, r);
      if (chosen.some((q) => Math.hypot(q[0] - x, q[1] - y) < 46)) continue;
      if (Math.hypot(x - S.hero.x, y - S.hero.y) < 190 && !boss) continue;
      best = [x, y]; break;
    }
    if (!best) { const [c, r] = pts[Math.floor(R() * pts.length)]; best = tilePos(c, r); }
    chosen.push(best); addEnemy(S, type, best[0], best[1], 0.6 + i * 0.08);
    ev(S, { k: "spawn", x: best[0], y: best[1] });
  }
  if (S.waveIdx > 0 || S.lv.waves.length === 1) { const [c, r] = pts[Math.floor(R() * pts.length)]; S.pickups.push({ type: "heart", x: tilePos(c, r)[0], y: tilePos(c, r)[1], t: 0 }); }
}

// a drop that landed inside a wall (a flying monster died over it) slides to the nearest open floor
function snapFree(S, x, y) { if (!solidAt(S, x, y)) return [x, y]; let best = [x, y], bd = 1e9; const [c0, r0] = tileOf(x, y); for (let r = 1; r < GH - 1; r++) for (let c = Math.max(1, c0 - 4); c < Math.min(GW - 1, c0 + 5); c++) if (!S.F.g[r * GW + c] && Math.abs(r - r0) < 5) { const [px, py] = tilePos(c, r), d = Math.hypot(px - x, py - y); if (d < bd) { bd = d; best = [px, py]; } } return best; }

// ------------------------------------------------------------------------------------------------------------------ damage
export function hurtHero(S, n, fromX, fromY) {
  const h = S.hero; if (S.state !== "play" || h.iframes > 0 || h.dashT > 0) return false;
  h.hp -= n; h.iframes = IFRAMES; h.hurtT = 0.3; S.hits++;
  const a = Math.atan2(h.y - fromY, h.x - fromX); h.vx = Math.cos(a) * 240; h.vy = Math.sin(a) * 240;
  ev(S, { k: "hurt", x: h.x, y: h.y, hp: h.hp });
  if (h.hp <= 0) { h.hp = 0; S.state = "dead"; S.stateT = 0; ev(S, { k: "die", x: h.x, y: h.y }); }
  return true;
}
function hurtEnemy(S, e, n, ang, force = 160) {
  if (e.spawn > 0 || e.hp <= 0) return;
  e.hp -= n; e.flash = 0.14; const kb = ENEMY[e.type].boss ? 0.12 : 1; e.kx += Math.cos(ang) * force * kb; e.ky += Math.sin(ang) * force * kb;
  ev(S, { k: "enemyHit", x: e.x, y: e.y, type: e.type, ang });
  if (e.hp <= 0) {
    S.kills++; const gems = ENEMY[e.type].gem; S.gems += gems; ev(S, { k: "kill", x: e.x, y: e.y, type: e.type, gems, boss: !!ENEMY[e.type].boss });
    if (S.R() < 0.1 && !ENEMY[e.type].boss) { const [px, py] = snapFree(S, e.x, e.y); S.pickups.push({ type: "heart", x: px, y: py, t: 0 }); }
    if (ENEMY[e.type].boss) { S.shots.length = 0; S.rings.length = 0; for (let i = 0; i < 2; i++) { const [px, py] = snapFree(S, e.x + (i ? 30 : -30), e.y); S.pickups.push({ type: "heart", x: px, y: py, t: 0 }); } }
  }
}

// ------------------------------------------------------------------------------------------------------------------ the hero's actions
export function nearestEnemy(S, x, y, maxD = 1e9) { let b = null, bd = maxD; for (const e of S.enemies) { if (e.spawn > 0 || e.hp <= 0) continue; const d = Math.hypot(e.x - x, e.y - y) - e.r; if (d < bd) { bd = d; b = e; } } return b; }

function doSwing(S, aimX, aimY) {
  const h = S.hero; h.swingCd = SWING_CD; h.swingT = 0.2;
  let a;
  if (aimX != null) a = Math.atan2(aimY - h.y, aimX - h.x);
  else { const e = nearestEnemy(S, h.x, h.y, 78); a = e ? Math.atan2(e.y - h.y, e.x - h.x) : Math.atan2(h.fy, h.fx); }
  h.swingA = a; h.fx = Math.cos(a); h.fy = Math.sin(a);
  ev(S, { k: "swing", x: h.x, y: h.y, a });
  const half = 1.05;
  for (const e of S.enemies) {
    if (e.spawn > 0 || e.hp <= 0) continue; const d = Math.hypot(e.x - h.x, e.y - h.y); if (d > SWING_REACH + e.r) continue;
    let da = Math.atan2(e.y - h.y, e.x - h.x) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) > half && d > e.r + 14) continue;
    hurtEnemy(S, e, 1, Math.atan2(e.y - h.y, e.x - h.x), 190);
  }
  for (const s of S.shots) { const d = Math.hypot(s.x - h.x, s.y - h.y); if (d > SWING_REACH + 8) continue; let da = Math.atan2(s.y - h.y, s.x - h.x) - a; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) > half + 0.2) continue; s.dead = true; ev(S, { k: "deflect", x: s.x, y: s.y }); }
}
function doBolt(S, aimX, aimY) {
  const h = S.hero; if (h.en < 1) return false; h.en -= 1; h.enT = 0;
  let a; if (aimX != null) a = Math.atan2(aimY - h.y, aimX - h.x); else { const e = nearestEnemy(S, h.x, h.y); a = e ? Math.atan2(e.y - h.y, e.x - h.x) : Math.atan2(h.fy, h.fx); }
  S.bolts.push({ x: h.x + Math.cos(a) * 14, y: h.y + Math.sin(a) * 14, vx: Math.cos(a) * 400, vy: Math.sin(a) * 400, life: 1.3 }); h.fx = Math.cos(a); h.fy = Math.sin(a);
  ev(S, { k: "bolt", x: h.x, y: h.y, a }); return true;
}

// ------------------------------------------------------------------------------------------------------------------ monsters
function shootAt(S, e, ang, speed, kind = "arrow") { S.shots.push({ x: e.x + Math.cos(ang) * (e.r + 4), y: e.y + Math.sin(ang) * (e.r + 4), vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, kind, life: 4, dmg: 1 }); }
function toward(e, tx, ty, sp) { const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1; return [(dx / d) * sp, (dy / d) * sp, d]; }

// ground monsters walk straight at the hero when they can see them, and follow the shortest walkable route when a wall is in the way
function seesHero(S, e) { const h = S.hero, n = Math.ceil(Math.hypot(h.x - e.x, h.y - e.y) / 10); for (let i = 1; i < n; i++) { const x = e.x + ((h.x - e.x) * i) / n, y = e.y + ((h.y - e.y) * i) / n; for (const [ox, oy] of [[-8, 0], [8, 0], [0, -8], [0, 8]]) if (solidAt(S, x + ox, y + oy)) return false; } return true; }
function flowField(S) { const [hc, hr] = tileOf(S.hero.x, S.hero.y), key = hc + "," + hr; if (S.flowKey !== key) { S.flowKey = key; S.flow = bfs(S.F.g, hc, hr); } return S.flow; }
function chaseVec(S, e) {
  const h = S.hero; if (ENEMY[e.type].flies || seesHero(S, e)) { const d = Math.hypot(h.x - e.x, h.y - e.y) || 1; return [(h.x - e.x) / d, (h.y - e.y) / d]; }
  const f = flowField(S), [ec, er] = tileOf(e.x, e.y); let best = null, bd = f[er * GW + ec] < 0 ? 1e9 : f[er * GW + ec];
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = ec + dc, nr = er + dr; if (nc < 0 || nr < 0 || nc >= GW || nr >= GH) continue; const d = f[nr * GW + nc]; if (d >= 0 && d < bd) { bd = d; best = [nc, nr]; } }
  if (!best) { const d = Math.hypot(h.x - e.x, h.y - e.y) || 1; return [(h.x - e.x) / d, (h.y - e.y) / d]; }
  const [px, py] = tilePos(best[0], best[1]), dx = px - e.x, dy = py - e.y, d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d];
}
function aiEnemy(S, e, dt) {
  const h = S.hero, def = ENEMY[e.type], T = S.t; e.t += dt; if (e.flash > 0) e.flash -= dt;
  let mvx = 0, mvy = 0; const [, , dh] = toward(e, h.x, h.y, 1); const [dxh, dyh] = chaseVec(S, e);
  const speed = def.speed * (e.type === "eye" && e.hp < e.max * 0.5 ? 1.5 : 1);
  switch (e.type) {
    case "slime": { const w = Math.sin(e.t * 2 + e.ph) * 0.5; mvx = (dxh - dyh * w) * speed; mvy = (dyh + dxh * w) * speed; break; }
    case "bat": { const w = Math.sin(e.t * 4 + e.ph) * 1.1; mvx = (dxh - dyh * w) * speed; mvy = (dyh + dxh * w) * speed; break; }
    case "archer": {
      if (e.st === "aim") { e.stT -= dt; if (e.stT <= 0) { shootAt(S, e, Math.atan2(h.y - e.y, h.x - e.x), 215); ev(S, { k: "arrow", x: e.x, y: e.y }); e.st = "move"; e.cd = 2.1 + S.R() * 0.6; } break; }
      const want = 190; if (dh < want - 30) { mvx = -dxh * speed; mvy = -dyh * speed; } else if (dh > want + 50) { mvx = dxh * speed; mvy = dyh * speed; } else { mvx = -dyh * speed * 0.7; mvy = dxh * speed * 0.7; }
      e.cd -= dt; if (e.cd <= 0 && dh < 340) { e.st = "aim"; e.stT = 0.5; ev(S, { k: "telegraph", x: e.x, y: e.y }); } break;
    }
    case "brute": {
      if (e.st === "tele") { e.stT -= dt; if (e.stT <= 0) { e.st = "charge"; e.stT = 0.55; } break; }
      if (e.st === "charge") { e.stT -= dt; mvx = e.dirx * 330; mvy = e.diry * 330; if (e.hitWall || e.stT <= 0) { e.st = "stun"; e.stT = e.hitWall ? 1.0 : 0.6; if (e.hitWall) ev(S, { k: "slam", x: e.x, y: e.y }); } break; }
      if (e.st === "stun") { e.stT -= dt; if (e.stT <= 0) { e.st = "move"; e.cd = 2.2 + S.R(); } break; }
      mvx = dxh * speed; mvy = dyh * speed; e.cd -= dt; if (e.cd <= 0 && dh < 300 && dh > 90) { e.st = "tele"; e.stT = 0.8; e.dirx = dxh; e.diry = dyh; ev(S, { k: "telegraph", x: e.x, y: e.y }); } break;
    }
    case "wisp": {
      const want = 200, ang = e.t * 0.8 + e.ph; if (dh < want - 25) { mvx = -dxh * speed; mvy = -dyh * speed; } else if (dh > want + 35) { mvx = dxh * speed; mvy = dyh * speed; } else { mvx = -dyh * speed * Math.sign(Math.sin(ang) || 1); mvy = dxh * speed * Math.sign(Math.sin(ang) || 1); }
      e.cd -= dt; if (e.cd <= 0) { e.cd = 2.6; const a = Math.atan2(h.y - e.y, h.x - e.x); for (const o of [-0.34, 0, 0.34]) shootAt(S, e, a + o, 150, "orb"); ev(S, { k: "orbs", x: e.x, y: e.y }); } break;
    }
    case "warden": {
      if (e.st === "tele") { e.stT -= dt; if (e.stT <= 0) { e.st = "charge"; e.stT = 0.6; } break; }
      if (e.st === "charge") { e.stT -= dt; mvx = e.dirx * 300; mvy = e.diry * 300; if (e.hitWall || e.stT <= 0) { e.st = "stun"; e.stT = e.hitWall ? 1.3 : 0.7; if (e.hitWall) ev(S, { k: "slam", x: e.x, y: e.y, big: 1 }); } break; }
      if (e.st === "stun") { e.stT -= dt; if (e.stT <= 0) { e.st = "move"; e.cd = 2.6; } break; }
      mvx = dxh * speed; mvy = dyh * speed; e.cd -= dt;
      if (e.cd <= 0 && dh > 80) { e.st = "tele"; e.stT = 0.85; e.dirx = dxh; e.diry = dyh; ev(S, { k: "telegraph", x: e.x, y: e.y }); }
      e.n += dt; if (e.n > 8) { e.n = 0; const k = S.enemies.filter((q) => q.type === "slime" && q.hp > 0).length; if (k < 3) for (const o of [-1, 1]) addEnemy(S, "slime", e.x + o * 40, e.y + 20, 0.5); }
      break;
    }
    case "queen": {
      if (e.st === "blink") { e.stT -= dt; if (e.stT <= 0) { const spots = S.F.spawnOK.filter(([c, r]) => { const [x, y] = tilePos(c, r); return Math.hypot(x - h.x, y - h.y) > 170 && Math.hypot(x - h.x, y - h.y) < 330; }); const p = spots.length ? spots[Math.floor(S.R() * spots.length)] : [20, 7]; const [x, y] = tilePos(p[0], p[1]); ev(S, { k: "blink", x: e.x, y: e.y }); e.x = x; e.y = y; ev(S, { k: "blink", x, y }); e.st = "cast"; e.stT = 0.5; ev(S, { k: "telegraph", x: e.x, y: e.y }); } break; }
      if (e.st === "cast") { e.stT -= dt; if (e.stT <= 0) { e.n++; const base = e.t; if (e.n % 2) for (let i = 0; i < 10; i++) shootAt(S, e, base + (i / 10) * 6.283, 125, "shard"); else { const a = Math.atan2(h.y - e.y, h.x - e.x); for (const o of [-0.25, 0, 0.25]) shootAt(S, e, a + o, 190, "shard"); } ev(S, { k: "orbs", x: e.x, y: e.y }); e.st = "move"; e.cd = 3.1; } break; }
      if (dh < 150) { mvx = -dxh * speed; mvy = -dyh * speed; } else { mvx = -dyh * speed * 0.8; mvy = dxh * speed * 0.8; }
      e.cd -= dt; if (e.cd <= 0) { e.st = "blink"; e.stT = 0.45; ev(S, { k: "telegraph", x: e.x, y: e.y }); }
      e.n2 = (e.n2 || 0) + dt; if (e.n2 > 9) { e.n2 = 0; const k = S.enemies.filter((q) => q.type === "bat" && q.hp > 0).length; if (k < 2) for (const o of [-1, 1]) addEnemy(S, "bat", e.x + o * 36, e.y, 0.5); }
      break;
    }
    case "golem": {
      if (e.st === "stomp") { e.stT -= dt; if (e.stT <= 0) { S.rings.push({ x: e.x, y: e.y, r: e.r, speed: 175, max: 330, th: 9 }); ev(S, { k: "slam", x: e.x, y: e.y, big: 1 }); e.st = "move"; e.cd = 4.0; } break; }
      mvx = dxh * speed; mvy = dyh * speed; e.cd -= dt; if (e.cd <= 0) { e.st = "stomp"; e.stT = 0.9; ev(S, { k: "telegraph", x: e.x, y: e.y }); }
      e.n += dt; if (e.n > 6.5) { e.n = 0; const a = Math.atan2(h.y - e.y, h.x - e.x); for (const o of [-0.3, 0, 0.3]) shootAt(S, e, a + o, 170, "ember"); ev(S, { k: "orbs", x: e.x, y: e.y }); }
      break;
    }
    case "eye": {
      const want = 150, ang = e.t * 0.5; mvx = (cxTarget(S, 18 * TS + Math.cos(ang) * 120, e, "x")) * speed * 0.01; mvy = (cxTarget(S, 7 * TS + OY + 16 + Math.sin(ang * 1.3) * 90, e, "y")) * speed * 0.01;
      e.cd -= dt; const fast = e.hp < e.max * 0.5; if (e.cd <= 0) { e.cd = fast ? 0.2 : 0.3; e.spin = (e.spin || 0) + (fast ? 0.42 : 0.33); shootAt(S, e, e.spin, fast ? 130 : 115, "void"); if (fast) shootAt(S, e, e.spin + 3.14159, 130, "void"); }
      e.n += dt; if (e.n > 11) { e.n = 0; const k = S.enemies.filter((q) => q.type === "wisp" && q.hp > 0).length; if (k < 2) for (const o of [-1, 1]) addEnemy(S, "wisp", e.x + o * 50, e.y + 30, 0.5); }
      if (e.t > 0 && e.st !== "pause" && Math.floor(e.t / 6) !== Math.floor((e.t - dt) / 6)) { e.st = "pause"; e.stT = 1.1; } if (e.st === "pause") { e.stT -= dt; e.cd = Math.max(e.cd, 0.3); if (e.stT <= 0) e.st = "move"; }
      break;
    }
  }
  e.hitWall = false;
  // knock-back eases out, the monster moves, and contact hurts
  e.kx *= 1 - Math.min(1, 9 * dt); e.ky *= 1 - Math.min(1, 9 * dt);
  const hit = moveCircle(S, e, (mvx + e.kx) * dt, (mvy + e.ky) * dt, def.r * 0.8, def.flies); if (hit && e.st === "charge") e.hitWall = true;
  // monsters do not stack on each other
  for (const o of S.enemies) { if (o === e || o.spawn > 0 || o.hp <= 0) continue; const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy) || 0.01, mn = (e.r + o.r) * 0.8; if (d < mn) { const push = (mn - d) * 0.25; moveCircle(S, e, (dx / d) * push, (dy / d) * push, def.r * 0.8, def.flies); } }
  const dd = Math.hypot(h.x - e.x, h.y - e.y);
  if (dd < e.r + HERO_R - 2) { const dmg = e.st === "charge" ? def.dmg : e.type === "brute" || e.type === "warden" || e.type === "golem" ? 1 : def.dmg; hurtHero(S, dmg, e.x, e.y); }
}
function cxTarget(S, tx, e, ax) { return (tx - e[ax]) ; }

// ------------------------------------------------------------------------------------------------------------------ one tick
// input: { mx, my (-1..1), swing (held), bolt (held), dash (pressed), aimX, aimY (optional, from the mouse) }
export function step(S, inp, dt = DT) {
  S.events.length = 0;
  if (S.state === "dead" || S.state === "won") { S.stateT += dt; return; }
  S.t += dt; const h = S.hero;
  // ---- hero
  h.iframes = Math.max(0, h.iframes - dt); h.swingCd = Math.max(0, h.swingCd - dt); h.swingT = Math.max(0, h.swingT - dt); h.dashCd = Math.max(0, h.dashCd - dt); h.hurtT = Math.max(0, h.hurtT - dt);
  if (h.en < MAX_EN) { h.enT += dt; if (h.enT >= 2.0) { h.enT = 0; h.en++; } }
  let mx = inp.mx || 0, my = inp.my || 0; const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; }
  if (h.dashT > 0) { h.dashT -= dt; moveCircle(S, h, h.dx * DASH_SPEED * dt, h.dy * DASH_SPEED * dt, HERO_R - 1); }
  else {
    if (inp.dash && h.dashCd <= 0) { const dl = Math.hypot(mx, my); let dx = mx, dy = my; if (dl < 0.1) { dx = h.fx; dy = h.fy; } else { dx /= dl; dy /= dl; } h.dx = dx; h.dy = dy; h.dashT = DASH_T; h.dashCd = DASH_CD; h.iframes = Math.max(h.iframes, DASH_T + 0.22); ev(S, { k: "dash", x: h.x, y: h.y, dx, dy }); }
    else {
      if (ml > 0.05) { h.fx = mx / (ml || 1); h.fy = my / (ml || 1); }
      h.vx *= 1 - Math.min(1, 10 * dt); h.vy *= 1 - Math.min(1, 10 * dt);
      moveCircle(S, h, (mx * HERO_SPEED + h.vx) * dt, (my * HERO_SPEED + h.vy) * dt, HERO_R - 1);
      if (ml > 0.1) { h.stepT -= dt; if (h.stepT <= 0) { h.stepT = 0.26; ev(S, { k: "step", x: h.x, y: h.y }); } }
    }
    if (inp.swing && h.swingCd <= 0) doSwing(S, inp.aimX, inp.aimY);
    else if (inp.bolt && h.dashT <= 0) { if (h.swingT < 0.12) doBolt(S, inp.aimX, inp.aimY); }
  }
  // ---- waves
  if (S.waveIdx < S.lv.waves.length && S.pending.length === 0) {
    const alive = S.enemies.some((e) => e.hp > 0);
    if (!alive) { if (S.waveIdx < S.lv.waves.length - 1 || S.waveIdx < 0) { S.waveWait -= dt; if (S.waveWait <= 0) { spawnWave(S); S.waveWait = 1.0; ev(S, { k: "wave", n: S.waveIdx + 1 }); } } else if (!S.stairsOpen && S.waveIdx === S.lv.waves.length - 1) { S.stairsOpen = true; ev(S, { k: "stairs" }); } }
  }
  // ---- monsters
  for (const e of S.enemies) { if (e.hp <= 0) continue; if (e.spawn > 0) { e.spawn -= dt; continue; } aiEnemy(S, e, dt); }
  S.enemies = S.enemies.filter((e) => e.hp > 0);
  // ---- hero's bolts
  for (const b of S.bolts) {
    b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt; if (b.life <= 0 || solidAt(S, b.x, b.y)) { b.dead = true; ev(S, { k: "boltEnd", x: b.x, y: b.y }); continue; }
    for (const e of S.enemies) { if (e.spawn > 0 || e.hp <= 0) continue; if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 5) { hurtEnemy(S, e, 1, Math.atan2(b.vy, b.vx), 120); b.dead = true; break; } }
  }
  S.bolts = S.bolts.filter((b) => !b.dead);
  // ---- monster shots and shock rings
  for (const s of S.shots) {
    s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; if (s.life <= 0 || solidAt(S, s.x, s.y)) { s.dead = true; continue; }
    if (Math.hypot(s.x - h.x, s.y - h.y) < HERO_R + 4) { if (hurtHero(S, s.dmg, s.x - s.vx, s.y - s.vy)) s.dead = true; }
  }
  S.shots = S.shots.filter((s) => !s.dead);
  for (const rg of S.rings) { rg.r += rg.speed * dt; const d = Math.hypot(h.x - rg.x, h.y - rg.y); if (Math.abs(d - rg.r) < rg.th + HERO_R * 0.6) hurtHero(S, 1, rg.x, rg.y); if (rg.r > rg.max) rg.dead = true; }
  S.rings = S.rings.filter((r) => !r.dead);
  // ---- spikes
  for (const sp of S.F.spikes) if (spikeOn(S, sp)) { const [x, y] = tilePos(sp.c, sp.r); if (Math.abs(h.x - x) < 15 && Math.abs(h.y - y) < 15) hurtHero(S, 1, x, y + 8); }
  // ---- pickups, chest, stairs
  for (const p of S.pickups) { p.t += dt; if (p.dead) continue; if (Math.hypot(p.x - h.x, p.y - h.y) < 18 && p.t > 0.3) { if (p.type === "heart" && h.hp < MAX_HP) { h.hp++; p.dead = true; ev(S, { k: "heal", x: p.x, y: p.y }); } } }
  S.pickups = S.pickups.filter((p) => !p.dead);
  const [chx, chy] = tilePos(S.F.chest[0], S.F.chest[1]);
  if (!S.chestOpen && Math.hypot(h.x - chx, h.y - chy) < 22) { S.chestOpen = true; S.gems += 25; ev(S, { k: "chest", x: chx, y: chy }); }
  if (S.stairsOpen) { const [sx, sy] = tilePos(S.F.stairs[0], S.F.stairs[1]); if (Math.hypot(h.x - sx, h.y - sy) < 20) { S.state = "won"; S.won = true; S.stateT = 0; ev(S, { k: "win", x: sx, y: sy }); } }
}

export function starsOf(S) { return S.won ? 1 + (S.chestOpen ? 1 : 0) + (S.hero.hp >= 3 ? 1 : 0) : 0; }
export function scoreOf(S) { return Math.round(1000 + S.kills * 40 + S.gems * 12 + S.hero.hp * 150 + (S.chestOpen ? 400 : 0) + Math.max(0, 90 - S.t) * 6); }
