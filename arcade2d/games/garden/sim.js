// Garden Guards: the rules of the garden. Pure code (no drawing), used by the game, the automatic player and the tests.
// 5 lanes, 9 columns. Defenders sit in squares; the Gloom Gang walks in from the right. Dew pays for defenders.
export const COLS = 9, ROWS = 5;
export const PLANTS = {
  pip:   { name: "Pip Pod",     cost: 50,  hp: 60,  cd: 5,  fire: 1.4, shots: 1, dmg: 2, color: "#7bd35a", blurb: "Spits a seed down its lane." },
  dew:   { name: "Dewbloom",    cost: 40,  hp: 50,  cd: 5,  make: 9,    color: "#8fe3ff", blurb: "Makes 25 dew every few seconds." },
  bramble: { name: "Bramble Wall", cost: 60, hp: 420, cd: 14, color: "#9a6b3a", blurb: "A tough wall that keeps the Gang busy." },
  frost: { name: "Frost Fern",  cost: 80,  hp: 60,  cd: 6,  fire: 1.5, shots: 1, dmg: 1.5, slow: 3, color: "#8fd0ff", blurb: "Frosty seeds that slow the Gang." },
  twin:  { name: "Twin Pod",    cost: 120, hp: 60,  cd: 6,  fire: 1.4, shots: 2, dmg: 2, color: "#58c46b", blurb: "Spits two seeds at a time." },
  chili: { name: "Chili Bomb",  cost: 100, hp: 40,  cd: 24, fuse: 0.6, color: "#ff5a4a", blurb: "Explodes, wiping out everything around it." },
};
export const ENEMIES = {
  grub:   { name: "Grub",         hp: 6,   sp: 0.22, bite: 14 },
  capped: { name: "Capped Grub",  hp: 16,  sp: 0.22, bite: 14 },
  hopper: { name: "Hopper",       hp: 8,   sp: 0.36, bite: 14, leaps: true },
  brute:  { name: "Brute",        hp: 48,  sp: 0.15, bite: 34 },
  queen:  { name: "Gloom Queen",  hp: 300, sp: 0.085, bite: 80, boss: true },
};
const SHOT_SPEED = 5.2, START_X = 9.65, FRONT = 0.4, DEW_VALUE = 25;

export function createState(lv) {
  const S = {
    lv, t: 0, dew: lv.start, status: "play", ended: 0, ev: [],
    plants: [], enemies: [], shots: [], drops: [], carts: Array.from({ length: ROWS }, () => ({ used: false, x: -0.45, run: false })),
    cool: {}, nextSky: lv.sky ? 5 : 1e9, wi: 0, id: 1, cartsUsed: 0, plantsLost: 0, kills: 0, dewGot: 0, spent: 0,
    waves: lv.waves, total: lv.waves.length, bossSpawn: 0,
  };
  for (const c of lv.cards) S.cool[c] = 0;
  return S;
}
export const plantAt = (S, col, row) => S.plants.find((p) => p.col === col && p.row === row);
export const canPlace = (S, type, col, row) => S.status === "play" && S.lv.cards.includes(type) && col >= 0 && col < COLS && row >= 0 && row < ROWS && !plantAt(S, col, row) && S.dew >= PLANTS[type].cost && S.cool[type] <= 0;
export function place(S, type, col, row) {
  if (!canPlace(S, type, col, row)) return false;
  const d = PLANTS[type]; S.dew -= d.cost; S.spent += d.cost; S.cool[type] = d.cd;
  S.plants.push({ id: S.id++, type, col, row, hp: d.hp, hpMax: d.hp, t: 0, cd: type === "dew" ? 4.5 : type === "chili" ? d.fuse : 0.6, born: S.t, hit: 0, burst: 0 });
  S.ev.push({ k: "place", type, col, row }); return true;
}
export function shovel(S, col, row) {
  const p = plantAt(S, col, row); if (!p || S.status !== "play") return false;
  S.plants.splice(S.plants.indexOf(p), 1); S.dew += Math.floor(PLANTS[p.type].cost * 0.25); S.ev.push({ k: "dig", col, row }); return true;
}
export function collect(S, i) { const d = S.drops[i]; if (!d || d.fly) return false; d.fly = 0; return true; }
export function collectAll(S) { let n = 0; for (let i = 0; i < S.drops.length; i++) if (collect(S, i)) n++; return n; }

const front = (e) => e.x - FRONT;
function spawn(S, w) {
  const d = ENEMIES[w[1]], row = w[2] < 0 ? ((S.id * 7 + S.wi * 3) % ROWS) : w[2];
  S.enemies.push({ id: S.id++, type: w[1], row, x: START_X + (w[3] || 0), hp: d.hp, hpMax: d.hp, slow: 0, leapT: 0, leapFrom: 0, leapTo: 0, leapped: false, bite: 0, hit: 0, spawnT: 0, born: S.t });
}

export function step(S, dt) {
  if (S.status !== "play") { S.ended += dt; return; }
  S.t += dt;
  for (const k in S.cool) if (S.cool[k] > 0) S.cool[k] = Math.max(0, S.cool[k] - dt);
  // waves
  while (S.wi < S.waves.length && S.waves[S.wi][0] <= S.t) { spawn(S, S.waves[S.wi]); S.ev.push({ k: "spawn", boss: !!ENEMIES[S.waves[S.wi][1]].boss }); S.wi++; }
  // sky dew
  if (S.t >= S.nextSky) { S.nextSky += 8.5; S.drops.push({ x: 1 + ((S.id * 37) % 70) / 10, y: -20, gy: 90 + ((S.id * 53) % 300), t: 0, fly: -1, sky: true }); S.id++; }
  // drops
  for (let i = S.drops.length - 1; i >= 0; i--) {
    const d = S.drops[i]; d.t += dt;
    if (d.fly >= 0) { d.fly += dt; if (d.fly > 0.35) { S.dew += DEW_VALUE; S.dewGot += DEW_VALUE; S.ev.push({ k: "dew" }); S.drops.splice(i, 1); } }
    else if (d.t > (d.sky ? 14 : 9)) d.fly = 0;
  }
  // plants
  for (let i = S.plants.length - 1; i >= 0; i--) {
    const p = S.plants[i], d = PLANTS[p.type]; p.t += dt; if (p.hit > 0) p.hit -= dt; if (p.burst > 0) p.burst -= dt;
    if (p.type === "dew") { p.cd -= dt; if (p.cd <= 0) { p.cd = d.make; S.drops.push({ x: p.col + 0.5, y: 0, gy: 0, t: 0, fly: -1, row: p.row, col: p.col, plant: true }); S.ev.push({ k: "bloom", col: p.col, row: p.row }); } }
    else if (p.type === "chili") {
      p.cd -= dt;
      if (p.cd <= 0) {
        S.plants.splice(i, 1);
        for (const e of S.enemies) if (Math.abs(e.row - p.row) <= 1 && Math.abs(e.x - 0.4 - (p.col + 0.5)) <= 1.6) { e.hp -= 90; e.hit = 0.2; }
        S.ev.push({ k: "boom", col: p.col, row: p.row });
      }
    } else if (d.fire) {
      p.cd -= dt;
      const ahead = S.enemies.some((e) => e.row === p.row && e.x > p.col + 0.4 && e.x < 9.7);
      if (p.cd <= 0 && ahead) {
        p.cd = d.fire; p.burst = 0.18;
        for (let k = 0; k < d.shots; k++) S.shots.push({ row: p.row, x: p.col + 0.8 - k * 0.45, dmg: d.dmg, frost: d.slow || 0 });
        S.ev.push({ k: "shoot", col: p.col, row: p.row, frost: !!d.slow });
      } else if (p.cd < 0) p.cd = 0;
    }
  }
  // shots
  for (let i = S.shots.length - 1; i >= 0; i--) {
    const s = S.shots[i]; s.x += SHOT_SPEED * dt;
    let tgt = null; for (const e of S.enemies) if (e.row === s.row && e.hp > 0 && s.x >= front(e) - 0.05 && s.x <= e.x + 0.3 && (!tgt || e.x < tgt.x)) tgt = e;
    if (tgt) { tgt.hp -= s.dmg; tgt.hit = 0.12; if (s.frost) tgt.slow = s.frost; S.shots.splice(i, 1); S.ev.push({ k: "hit", row: s.row, x: s.x, frost: !!s.frost }); }
    else if (s.x > 9.9) S.shots.splice(i, 1);
  }
  // enemies
  for (const e of S.enemies) {
    const d = ENEMIES[e.type]; if (e.hit > 0) e.hit -= dt; if (e.slow > 0) e.slow -= dt;
    const sp = d.sp * (e.slow > 0 ? 0.5 : 1);
    if (e.leapT > 0) { e.leapT -= dt; const u = 1 - Math.max(0, e.leapT) / 0.55; e.x = e.leapFrom + (e.leapTo - e.leapFrom) * u; continue; }
    const f = front(e), c = Math.floor(f), pl = c >= 0 && c < COLS ? plantAt(S, c, e.row) : null;
    if (pl && f <= c + 0.88) {
      if (d.leaps && !e.leapped) { e.leapped = true; e.leapT = 0.55; e.leapFrom = e.x; e.leapTo = (c - 0.05) + FRONT; S.ev.push({ k: "leap", row: e.row }); continue; }
      e.bite += dt; pl.hp -= d.bite * dt * (e.slow > 0 ? 0.6 : 1); pl.hit = 0.08; if (e.bite > 0.5) { e.bite = 0; S.ev.push({ k: "bite", row: e.row, col: c }); }
    } else e.x -= sp * dt;
    if (d.boss) { e.spawnT += dt; if (e.spawnT > 7 && e.x < 9.2) { e.spawnT = 0; spawn(S, [0, "grub", e.row, 0]); S.enemies[S.enemies.length - 1].x = e.x + 0.3; S.ev.push({ k: "spawn" }); } }
    // reaching the house
    const cart = S.carts[e.row];
    if (f < 0.1 && !cart.used) { cart.used = true; cart.run = true; S.cartsUsed++; S.ev.push({ k: "cart", row: e.row }); }
    else if (f < -0.35 && cart.used && !cart.run) { S.status = "lost"; S.ev.push({ k: "lose" }); }
  }
  for (let r = 0; r < ROWS; r++) { const c = S.carts[r]; if (c.run) { c.x += 7 * dt; for (const e of S.enemies) if (e.row === r && front(e) <= c.x + 0.6) { e.hp = -99; } if (c.x > 10.4) { c.run = false; } } }
  // deaths
  for (let i = S.enemies.length - 1; i >= 0; i--) { const e = S.enemies[i]; if (e.hp <= 0) { S.enemies.splice(i, 1); S.kills++; S.ev.push({ k: "die", row: e.row, x: e.x, type: e.type }); } }
  for (let i = S.plants.length - 1; i >= 0; i--) { const p = S.plants[i]; if (p.hp <= 0) { S.plants.splice(i, 1); S.plantsLost++; S.ev.push({ k: "plantdie", col: p.col, row: p.row, type: p.type }); } }
  if (S.status === "play" && S.wi >= S.waves.length && !S.enemies.length) { S.status = "won"; S.ev.push({ k: "win" }); }
}

export function stars(S) { return S.status !== "won" ? 0 : 1 + (S.cartsUsed === 0 ? 1 : 0) + (S.cartsUsed === 0 && S.plantsLost <= 3 ? 1 : 0); }
export const scoreOf = (S) => stars(S) * 1000 + S.kills * 15 + Math.max(0, 600 - Math.floor(S.t)) + S.dewGot;
