// Starline Vanguard: the rules of the dogfight. Pure code (no drawing), used by the game, the automatic pilot and the tests.
// A side-scrolling shoot 'em up: your ship sits on the left, the enemy fleet flies in from the right. Weapons power up as you collect power-ups.
export const W = 960, H = 540, TOP = 64, BOT = 520, XMIN = 36, XMAX = 560;
export const SHIP = { r: 8, speed: 280, hpMax: 5 };
export const ENEMIES = {
  drone:   { hp: 2,  r: 14, score: 100 },
  swooper: { hp: 3,  r: 15, score: 150 },
  gunner:  { hp: 7,  r: 18, score: 250 },
  rock:    { hp: 11, r: 26, score: 120 },
  elite:   { hp: 46, r: 30, score: 1200 },
  boss1:   { hp: 190, r: 52, score: 6000, boss: true },
  boss2:   { hp: 240, r: 50, score: 7000, boss: true },
  boss3:   { hp: 300, r: 56, score: 8000, boss: true },
  boss4:   { hp: 380, r: 54, score: 10000, boss: true },
};
const WEAPON_MAX = 5;

function rnd(S) { S.seed = (S.seed * 1664525 + 1013904223) >>> 0; return S.seed / 4294967296; }

export function createState(lv) {
  const S = {
    lv, t: 0, seed: lv.seed * 7919 + 13, status: "play", ended: 0, ev: [], id: 1,
    ship: { x: 110, y: (TOP + BOT) / 2, hp: 3, inv: 0, wl: 1, nova: 2, fire: 0, mfire: 0, flash: 0 },
    bullets: [], eb: [], en: [], pk: [], si: 0, hits: 0, kills: 0, spawned: 0, score: 0, novaT: 0, bossDown: false, clearT: 0, combo: 0, comboT: 0, shots: 0,
  };
  return S;
}

const spawn = (S, type, x, y, o = {}) => {
  const d = ENEMIES[type], e = { id: S.id++, type, x, y, y0: y, hp: d.hp * (o.hpk || 1), hpMax: d.hp * (o.hpk || 1), r: d.r, age: 0, fireT: 0.8 + (o.delay || 0), vy: 0, st: 0, drop: o.drop || null, amp: o.amp || 60, ph: o.ph || 0, hit: 0, stT: 0, v: o.v || 1 };
  S.en.push(e); S.spawned++; return e;
};
const ebullet = (S, x, y, ang, sp0, r = 6) => { const sp = sp0 * (0.92 + S.lv.dif * 0.5); S.eb.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r }); };
const aim = (S, e) => Math.atan2(S.ship.y - e.y, S.ship.x - e.x);

export function step(S, dt, inp) {
  if (S.status !== "play") { S.ended += dt; if (S.status === "winning") { S.ended += 0; } return; }
  const sh = S.ship, lv = S.lv; S.t += dt;
  // ---- the ship
  const mx = Math.max(-1, Math.min(1, inp.mx || 0)), my = Math.max(-1, Math.min(1, inp.my || 0)), len = Math.hypot(mx, my) || 1, k = len > 1 ? 1 / len : 1;
  sh.x = Math.max(XMIN, Math.min(XMAX, sh.x + mx * k * SHIP.speed * dt)); sh.y = Math.max(TOP + 10, Math.min(BOT - 10, sh.y + my * k * SHIP.speed * dt));
  if (sh.inv > 0) sh.inv -= dt; if (sh.flash > 0) sh.flash -= dt; if (S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0) S.combo = 0; }
  sh.fire -= dt;
  if (sh.fire <= 0) {
    sh.fire = sh.wl >= 4 ? 0.13 : 0.15; const w = sh.wl, sp = 760, bx = sh.x + 18;
    const add = (dy, ang, dmg = 1) => S.bullets.push({ x: bx, y: sh.y + dy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, dmg, r: 4 });
    if (w === 1) add(0, 0); else if (w === 2) { add(-7, 0); add(7, 0); } else if (w === 3 || w === 4) { add(0, 0); add(-6, -0.13); add(6, 0.13); } else { add(0, 0); add(-5, -0.1); add(5, 0.1); add(-9, -0.24); add(9, 0.24); }
    S.shots++; S.ev.push({ k: "shot" });
  }
  sh.mfire -= dt;
  if (sh.wl >= 4 && sh.mfire <= 0) { sh.mfire = 0.7; for (const d of [-1, 1]) S.bullets.push({ x: sh.x + 4, y: sh.y + d * 10, vx: 380, vy: d * 140, dmg: 2, r: 5, missile: true }); }
  if (inp.nova && sh.nova > 0 && S.novaT <= 0 && S.status === "play") {
    sh.nova--; S.novaT = 0.6; S.eb.length = 0; sh.inv = Math.max(sh.inv, 1.0);
    for (const e of S.en) if (e.x < W + 20) { e.hp -= ENEMIES[e.type].boss ? 14 : 9; e.hit = 0.2; }
    S.ev.push({ k: "nova" });
  }
  if (S.novaT > 0) S.novaT -= dt;
  // ---- the script
  while (S.si < lv.script.length && lv.script[S.si][0] <= S.t) { const [, type, y, o] = lv.script[S.si++]; const e = spawn(S, type, W + 40 + (o && o.dx ? o.dx : 0), y, o || {}); if (ENEMIES[type].boss) S.ev.push({ k: "boss" }); }
  // ---- enemies
  for (const e of S.en) {
    e.age += dt; if (e.hit > 0) e.hit -= dt; const d = ENEMIES[e.type], dif = lv.dif;
    switch (e.type) {
      case "drone": e.x -= 175 * e.v * dt; e.y = e.y0 + Math.sin(e.age * 3.2 + e.ph) * e.amp; if (lv.dif > 0.5 && e.x < 800 && e.x > 160) { e.fireT -= dt * (0.85 + S.lv.dif * 0.55); if (e.fireT <= 0) { e.fireT = 2.6 - dif; ebullet(S, e.x, e.y, aim(S, e), 150 + dif * 60); } } break;
      case "swooper": { e.x -= 205 * dt; if (e.x < 780 && e.x > 200) { const dy = sh.y - e.y; e.vy += Math.sign(dy) * 520 * dt; e.vy = Math.max(-150, Math.min(150, e.vy)); } e.y += e.vy * dt; e.y = Math.max(TOP + 10, Math.min(BOT - 10, e.y)); break; }
      case "gunner": if (e.x > 730 && e.stT === 0) e.x -= 150 * dt; else { e.stT += dt; if (e.stT > 9) e.x -= 90 * dt; e.y += Math.sin(e.age * 1.5) * 30 * dt; e.fireT -= dt * (0.85 + S.lv.dif * 0.55); if (e.fireT <= 0) { e.fireT = 1.9 - dif * 0.6; const a = aim(S, e); ebullet(S, e.x - 10, e.y, a, 190 + dif * 70); if (dif > 0.6) { ebullet(S, e.x - 10, e.y, a + 0.2, 190 + dif * 70); ebullet(S, e.x - 10, e.y, a - 0.2, 190 + dif * 70); } } } if (e.stT === 0 && e.x <= 730) e.stT = 0.001; break;
      case "rock": e.x -= 95 * dt; break;
      case "elite": if (e.x > 740) e.x -= 120 * dt; else { e.y = e.y0 + Math.sin(e.age * 1.2) * 110; e.fireT -= dt * (0.85 + S.lv.dif * 0.55); if (e.fireT <= 0) { e.fireT = 1.5; const a = aim(S, e); for (let i = -2; i <= 2; i++) ebullet(S, e.x - 20, e.y, a + i * 0.16, 200 + dif * 60); } } break;
      default: bossAct(S, e, dt);
    }
    if (e.x < -60 && !d.boss) e.dead = "gone";
  }
  // ---- player bullets
  for (let i = S.bullets.length - 1; i >= 0; i--) {
    const b = S.bullets[i];
    if (b.missile) { let tgt = null, bd = 1e9; for (const e of S.en) if (e.x > b.x && e.x < W) { const dd = (e.x - b.x) + Math.abs(e.y - b.y) * 0.6; if (dd < bd) { bd = dd; tgt = e; } } if (tgt) { const ang = Math.atan2(tgt.y - b.y, tgt.x - b.x), cur = Math.atan2(b.vy, b.vx); let df = ang - cur; while (df > Math.PI) df -= 2 * Math.PI; while (df < -Math.PI) df += 2 * Math.PI; const na = cur + Math.max(-4 * dt, Math.min(4 * dt, df)); const sp = Math.hypot(b.vx, b.vy) + 500 * dt; b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp; } }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x > W + 30 || b.x < -30 || b.y < TOP - 20 || b.y > BOT + 20) { S.bullets.splice(i, 1); continue; }
    let hit = null; for (const e of S.en) if (!e.dead && e.x < W + 10 && Math.hypot(e.x - b.x, e.y - b.y) < e.r + b.r) { hit = e; break; }
    if (hit) { hit.hp -= b.dmg; hit.hit = 0.1; S.bullets.splice(i, 1); S.ev.push({ k: "hit", x: b.x, y: b.y }); }
  }
  // ---- enemy bullets
  for (let i = S.eb.length - 1; i >= 0; i--) {
    const b = S.eb[i]; b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < -30 || b.x > W + 30 || b.y < TOP - 30 || b.y > BOT + 30) { S.eb.splice(i, 1); continue; }
    if (sh.inv <= 0 && Math.hypot(b.x - sh.x, b.y - sh.y) < b.r + SHIP.r) { S.eb.splice(i, 1); hurt(S); break; }
  }
  for (const e of S.en) if (!e.dead && sh.inv <= 0 && e.x < W && Math.hypot(e.x - sh.x, e.y - sh.y) < e.r + SHIP.r - 2) { hurt(S); if (!ENEMIES[e.type].boss && e.type !== "elite") e.hp -= 4; }
  // ---- deaths
  for (const e of S.en) if (e.hp <= 0 && !e.dead) {
    e.dead = "killed"; S.kills++; S.combo++; S.comboT = 2.5; S.score += Math.round(ENEMIES[e.type].score * (1 + Math.min(S.combo, 10) * 0.1));
    S.ev.push({ k: "kill", x: e.x, y: e.y, type: e.type, big: ENEMIES[e.type].boss || e.type === "elite" || e.type === "rock" });
    if (e.drop) S.pk.push({ id: S.id++, x: e.x, y: e.y, kind: e.drop, t: 0 });
    if (ENEMIES[e.type].boss) { S.bossDown = true; S.eb.length = 0; }
  }
  S.en = S.en.filter((e) => !e.dead);
  // ---- pickups
  for (let i = S.pk.length - 1; i >= 0; i--) {
    const p = S.pk[i]; p.t += dt; p.x -= 60 * dt; p.y += Math.sin(p.t * 3) * 20 * dt;
    if (Math.hypot(p.x - sh.x, p.y - sh.y) < 24) { S.pk.splice(i, 1); if (p.kind === "P") sh.wl = Math.min(WEAPON_MAX, sh.wl + 1); else if (p.kind === "S") sh.hp = Math.min(SHIP.hpMax, sh.hp + 1); else if (p.kind === "N") sh.nova = Math.min(4, sh.nova + 1); S.score += 50; S.ev.push({ k: "pickup", kind: p.kind, x: p.x, y: p.y }); }
    else if (p.x < -30) S.pk.splice(i, 1);
  }
  // ---- finish
  if (sh.hp <= 0) { S.status = "lost"; S.ev.push({ k: "lose" }); return; }
  const done = S.si >= lv.script.length && !S.en.length;
  if (S.bossDown && !S.en.length) { S.clearT += dt; if (S.clearT > 1.2) { S.status = "won"; S.ev.push({ k: "win" }); } }
  else if (!lv.boss && done) { S.clearT += dt; if (S.clearT > 1.2) { S.status = "won"; S.ev.push({ k: "win" }); } }
}

function hurt(S) {
  const sh = S.ship; sh.hp--; sh.inv = 1.6; sh.flash = 0.5; sh.wl = Math.max(1, sh.wl - 1); S.hits++; S.combo = 0; for (let j = S.eb.length - 1; j >= 0; j--) if (Math.hypot(S.eb[j].x - sh.x, S.eb[j].y - sh.y) <= 70) S.eb.splice(j, 1);
  S.ev.push({ k: "hurt" });
}

// ---- bosses
function bossAct(S, e, dt) {
  const dif = S.lv.dif, hpf = e.hp / e.hpMax, ph = hpf > 0.66 ? 0 : hpf > 0.33 ? 1 : 2;
  if (e.x > 760) { e.x -= 110 * dt; return; }
  e.fireT -= dt * (0.85 + S.lv.dif * 0.55); e.stT += dt;
  const sh = S.ship, a = aim(S, e);
  if (e.type === "boss1") {            // Warden: aimed bursts and a ring
    e.y = (TOP + BOT) / 2 + Math.sin(e.age * (0.7 + ph * 0.25)) * 150;
    if (e.fireT <= 0) { e.fireT = ph === 2 ? 0.8 : 1.15; for (let i = -1; i <= 1; i++) ebullet(S, e.x - 40, e.y, a + i * 0.17, 230 + dif * 40); }
    if (e.stT > (ph ? 2.4 : 3.4)) { e.stT = 0; for (let i = 0; i < 14; i++) ebullet(S, e.x, e.y, (i / 14) * 6.2832 + e.age, 150 + ph * 25); }
  } else if (e.type === "boss2") {     // Prism: sweeping fans with gaps
    e.y = (TOP + BOT) / 2 + Math.sin(e.age * 0.9) * 140;
    if (e.fireT <= 0) { e.fireT = 0.95 - ph * 0.12; const base = Math.PI + Math.sin(e.age * 1.4) * 0.5; for (let i = -4; i <= 4; i++) if (Math.abs(i) !== 1 + (Math.floor(e.age) % 3)) ebullet(S, e.x - 30, e.y, base + i * 0.19, 190 + ph * 20); }
    if (e.stT > 3.2) { e.stT = 0; if (ph >= 1) for (const yy of [-90, 90]) { const d = spawn(S, "drone", e.x - 20, e.y + yy, { amp: 30 }); d.x = e.x - 20; } }
  } else if (e.type === "boss3") {     // Bulwark: slow, spawns drones and walls of bullets with a moving gap
    e.y = (TOP + BOT) / 2 + Math.sin(e.age * 0.5) * 110;
    if (e.fireT <= 0) { e.fireT = 1.55 - ph * 0.25; const gap = TOP + 40 + ((Math.sin(e.age * 1.1) + 1) / 2) * (BOT - TOP - 80); for (let y = TOP + 8; y < BOT; y += 34) if (Math.abs(y - gap) > 56) ebullet(S, e.x - 50, y, Math.PI, 170 + ph * 15, 7); }
    if (e.stT > 4.5) { e.stT = 0; for (let i = 0; i < 3; i++) spawn(S, "swooper", e.x - 30, e.y - 80 + i * 80, { delay: 0 }); }
  } else {                              // Gate Eye: everything, in phases
    e.y = (TOP + BOT) / 2 + Math.sin(e.age * (0.8 + ph * 0.3)) * 150;
    if (e.fireT <= 0) { e.fireT = ph === 0 ? 1.0 : ph === 1 ? 0.8 : 0.62; if (ph === 0) for (let i = -2; i <= 2; i++) ebullet(S, e.x - 40, e.y, a + i * 0.15, 230);
      else if (ph === 1) { const base = Math.PI + Math.sin(e.age * 1.6) * 0.5; for (let i = -4; i <= 4; i++) if (Math.abs(i) !== 2) ebullet(S, e.x - 30, e.y, base + i * 0.2, 205); }
      else { for (let i = -1; i <= 1; i++) ebullet(S, e.x - 40, e.y, a + i * 0.2, 250); } }
    if (e.stT > (ph === 2 ? 2.2 : 3.4)) { e.stT = 0; const n = ph === 2 ? 18 : 12; for (let i = 0; i < n; i++) ebullet(S, e.x, e.y, (i / n) * 6.2832 + e.age * 0.7, 140 + ph * 25); if (ph >= 1) { spawn(S, "drone", e.x - 20, e.y - 70, { amp: 40 }); spawn(S, "drone", e.x - 20, e.y + 70, { amp: 40 }); } }
  }
}

export function stars(S) { return S.status !== "won" ? 0 : S.hits === 0 ? 3 : S.hits <= 2 ? 2 : 1; }
export const scoreOf = (S) => S.score + stars(S) * 2000 + Math.max(0, 1500 - S.hits * 300);
