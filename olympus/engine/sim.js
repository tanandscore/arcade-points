// The rules of the game, with no graphics: economy, building, training, fighting, fog of war and
// god powers. The screen only looks at this and draws it, so it also runs on its own for testing.
import { N, UNITS, BUILDINGS, TECHS, POWERS, NODE, AGES, FARM_RATE, CARRY, START, START_VILLAGERS, START_GUARDS, POP_MAX, DIFFICULTY, canAfford, WILD, HEROES, HERO_ORDER, GODS, GOD_CHOICES, RELICS, XP_AT } from "./defs.js";
import { generateMap, mulberry } from "./mapgen.js";
import { createPather } from "./path.js";
import { installHeroes } from "./heroes.js";
import { installWorld } from "./neutrals.js";

const WONDER_TIME = 240; // seconds a finished Wonder must stand to win the war
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hyp = Math.hypot;

export function createSim({ seed = 1, difficulty = "veteran", playerAI = null, hero = "achilles", enemyHero = null } = {}) {
  const map = generateMap(seed);
  const diff = DIFFICULTY[difficulty] || DIFFICULTY.veteran;
  const rnd = mulberry(seed * 31 + 7);

  const occId = new Int32Array(N * N);          // id of building/node standing on the tile
  const pocc = new Uint8Array(N * N);           // 1 = cannot walk (for the pathfinder)
  for (let i = 0; i < N * N; i++) pocc[i] = map.blockedBase[i];
  const pather = createPather(N, pocc);

  const S = {
    map, seed, difficulty, diff, t: 0, nextId: 1, ents: new Map(), units: [], buildings: [], nodes: [], projectiles: [], events: [],
    players: [], occId, pocc, pather, over: null, ais: [], pathBudget: 0, vis: new Uint8Array(N * N), visT: 0, alertT: {}, cleanT: 0, rnd,
  };
  // players 0 (you) and 1 (the enemy), plus 2 = the wild creatures (they never win, lose, build or gather)
  for (let p = 0; p < 3; p++) {
    S.players.push({
      id: p, wild: p === 2, res: { ...START }, favor: 0, age: 0, techs: new Set(), pop: 0, popCap: 0, reserved: 0, gatherMult: p === 1 ? diff.gather : 1, ageBusy: false, powerCd: {},
      gods: [], relics: [], heroId: null, hero: null, wonder: null,
      stats: { kills: 0, lost: 0, gathered: 0, built: 0, trained: 0, razed: 0, monsters: 0, relics: 0, shrines: 0, lairs: 0 }, defeated: false,
    });
  }
  S.players[0].heroId = HERO_ORDER.includes(hero) ? hero : "achilles";
  { const others = HERO_ORDER.filter((h) => h !== S.players[0].heroId); S.players[1].heroId = enemyHero && HERO_ORDER.includes(enemyHero) ? enemyHero : others[Math.floor(rnd() * others.length)]; }
  for (const p of [0, 1]) { const b = HEROES[S.players[p].heroId].passive.startBonus; if (b) for (const k of Object.keys(b)) S.players[p].res[k] += b[k]; }
  S.players[1].res.food += diff.start; S.players[1].res.wood += diff.start;

  // ---- which parts of the map can reach each other (so nobody wastes time pathing into a pocket) ---
  const reg = new Int32Array(N * N); let regDirty = true, regT = -9;
  function relabel() {
    reg.fill(0); let L = 0; const st = [];
    for (let i = 0; i < N * N; i++) {
      if (pocc[i] || reg[i]) continue; L++; reg[i] = L; st.push(i);
      while (st.length) { const c = st.pop(), x = c % N, z = (c / N) | 0; if (x > 0 && !pocc[c - 1] && !reg[c - 1]) { reg[c - 1] = L; st.push(c - 1); } if (x < N - 1 && !pocc[c + 1] && !reg[c + 1]) { reg[c + 1] = L; st.push(c + 1); } if (z > 0 && !pocc[c - N] && !reg[c - N]) { reg[c - N] = L; st.push(c - N); } if (z < N - 1 && !pocc[c + N] && !reg[c + N]) { reg[c + N] = L; st.push(c + N); } }
    }
    regDirty = false;
  }
  function labelOf(x, z) { let ix = Math.floor(x), iz = Math.floor(z); if (ix < 0 || iz < 0 || ix >= N || iz >= N) return 0; if (pocc[iz * N + ix]) { const f = pather.nearestFree(ix, iz, 3); if (!f) return 0; ix = f[0]; iz = f[1]; } return reg[iz * N + ix]; }

  // ---- spatial hash for neighbour queries --------------------------------------------------
  const CW = 4, GW = Math.ceil(N / CW);
  const grid = Array.from({ length: GW * GW }, () => []);
  function rebuildGrid() {
    for (const c of grid) c.length = 0;
    for (const u of S.units) if (!u.dead) grid[clamp(Math.floor(u.z / CW), 0, GW - 1) * GW + clamp(Math.floor(u.x / CW), 0, GW - 1)].push(u);
  }
  function forNear(x, z, r, fn) {
    const x0 = clamp(Math.floor((x - r) / CW), 0, GW - 1), x1 = clamp(Math.floor((x + r) / CW), 0, GW - 1), z0 = clamp(Math.floor((z - r) / CW), 0, GW - 1), z1 = clamp(Math.floor((z + r) / CW), 0, GW - 1);
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) { const c = grid[cz * GW + cx]; for (let i = 0; i < c.length; i++) fn(c[i]); }
  }

  const ev = (e) => S.events.push(e);
  const get = (id) => S.ents.get(id);
  let HX = null, NW = null; // the champion rules (heroes.js) and the map secrets (neutrals.js), created at the end
  const PSRC = (o) => ({ owner: o, type: "power" }); // credit for kills made by god powers

  // ---- creating things ---------------------------------------------------------------------
  function setOcc(e, on) {
    regDirty = true;
    const w = e.w; for (let j = 0; j < w; j++) for (let i = 0; i < w; i++) { const k = (e.iz + j) * N + e.ix + i; if (on) { occId[k] = e.id; pocc[k] = 1; } else { if (occId[k] === e.id) occId[k] = 0; if (!map.blockedBase[k] && occId[k] === 0) pocc[k] = 0; } }
  }
  function addUnit(kind, owner, x, z) {
    const d = UNITS[kind];
    const u = { id: S.nextId++, type: "unit", kind, def: d, cls: d.cls, owner, x, z, radius: d.radius, hp: d.hp, maxHp: d.hp, dead: false, order: { type: "idle" }, path: null, pi: 0, goal: null, needPath: false,
      face: owner === 0 ? Math.PI * 0.75 : -Math.PI * 0.25, atkCd: rnd() * 0.5, carry: { res: null, amt: 0 }, anim: "idle", repathT: 0, stuckT: 0, lastX: x, lastZ: z, scanT: rnd() * 0.4, lastHit: -99, vx: 0, vz: 0, deathT: 0, buildQueue: [], moveFail: 0, bornT: S.t, speedMul: 1, st: null };
    if (HX && owner >= 0 && owner < 2) { const ps = HX.passiveOf(owner); if (ps && ps.cavHp && (kind === "horseman" || kind === "centaur")) { u.maxHp = Math.round(u.maxHp * (1 + ps.cavHp)); u.hp = u.maxHp; } }
    S.ents.set(u.id, u); S.units.push(u); return u;
  }
  function addBuilding(kind, owner, ix, iz, done = true) {
    const d = BUILDINGS[kind];
    const hm = owner >= 0 && owner < 2 && S.players[owner].gods.includes("hephaestus") ? 1.2 : 1;
    const b = { id: S.nextId++, type: "building", kind, def: d, cls: "building", owner, ix, iz, w: d.size, x: ix + d.size / 2, z: iz + d.size / 2, hp: done ? d.hp * hm : Math.max(1, d.hp * 0.05), maxHp: d.hp * hm, dead: false, done, progress: done ? 1 : 0, buildersNow: 0, queue: [], rally: null, fireCd: 0, deathT: 0, workerId: 0, lastHit: -99, bornT: S.t };
    S.ents.set(b.id, b); S.buildings.push(b); setOcc(b, true); return b;
  }
  function addNode(kind, ix, iz, amount) {
    const d = NODE[kind];
    const n = { id: S.nextId++, type: "node", kind, def: d, owner: -1, ix, iz, w: d.size, x: ix + d.size / 2, z: iz + d.size / 2, res: d.res, amount: amount ?? d.amount, max: amount ?? d.amount, dead: false, deathT: 0, hp: 1, maxHp: 1 };
    S.ents.set(n.id, n); S.nodes.push(n); setOcc(n, true); return n;
  }

  for (const n of map.nodes) addNode(n.kind, n.ix, n.iz, n.amount);
  map.starts.forEach((s, p) => {
    addBuilding("town_center", p, s.cx - 2, s.cz - 2, true);
    for (let i = 0; i < START_VILLAGERS; i++) { const a = (i / START_VILLAGERS) * Math.PI * 2; const f = pather.nearestFree(Math.floor(s.cx + Math.cos(a) * 3.6), Math.floor(s.cz + Math.sin(a) * 3.6), 5) || [s.cx + 4, s.cz]; addUnit("villager", p, f[0] + 0.5, f[1] + 0.5); }
    for (let i = 0; i < START_GUARDS; i++) { const a = 0.6 + (i / START_GUARDS) * 1.6 + (p ? Math.PI : 0); const f = pather.nearestFree(Math.floor(s.cx + Math.cos(a) * 6.2), Math.floor(s.cz + Math.sin(a) * 6.2), 5) || [s.cx + 6, s.cz]; addUnit("hoplite", p, f[0] + 0.5, f[1] + 0.5); }
  });

  // ---- helpers -------------------------------------------------------------------------------
  function edgeDist(u, e) {
    if (e.type === "unit") return hyp(u.x - e.x, u.z - e.z) - u.radius - e.radius;
    const cx = clamp(u.x, e.ix, e.ix + e.w), cz = clamp(u.z, e.iz, e.iz + e.w); return hyp(u.x - cx, u.z - cz) - u.radius;
  }
  const isEnemy = (a, b) => b.owner !== -1 && a.owner !== b.owner;
  function ringTiles(e) {
    const out = []; for (let i = e.ix - 1; i <= e.ix + e.w; i++) { out.push([i, e.iz - 1], [i, e.iz + e.w]); } for (let j = e.iz; j < e.iz + e.w; j++) out.push([e.ix - 1, j], [e.ix + e.w, j]); return out;
  }
  function adjGoal(u, e) {
    let best = null, bd = 1e9; const ul = labelOf(u.x, u.z);
    for (const [x, z] of ringTiles(e)) { if (!pather.free(x, z) || reg[z * N + x] !== ul) continue; const d = (x + 0.5 - u.x) ** 2 + (z + 0.5 - u.z) ** 2; if (d < bd) { bd = d; best = [x + 0.5, z + 0.5]; } }
    return best;
  }
  function popOf(p) { let n = 0; for (const u of S.units) if (!u.dead && u.owner === p && !u.summon) n += u.def.pop; return n; }
  function capOf(p) { let c = 0; for (const b of S.buildings) if (!b.dead && b.done && b.owner === p) c += b.def.popCap || 0; return Math.min(POP_MAX, c); }
  const plr = (o) => S.players[o];
  const alive = (e) => e && !e.dead;

  // ---- tech, god, champion and relic effects on fighting, speed and gathering ----------------------------------------
  const godHas = (o, g) => o >= 0 && o < 2 && S.players[o].gods.includes(g);
  const godFx = (o, key) => { let t = 0; if (o >= 0 && o < 2) for (const g of S.players[o].gods) { const v = GODS[g].fx[key]; if (typeof v === "number") t += v; } return t; };
  const relicFx = (o, key) => (o >= 0 && o < 2 ? S.players[o].relics.reduce((t, r) => t + (RELICS[r].fx[key] || 0), 0) : 0);
  const passive = (o) => (o >= 0 && o < 2 && HX ? HX.passiveOf(o) : null);
  const atkBonusOf = (u) => {
    const p = plr(u.owner); let a = 0; if (p.techs.has("melee") && (u.cls === "infantry" || u.cls === "cavalry" || u.cls === "hero")) a += 2; if (p.techs.has("arrows") && u.cls === "archer") a += 1;
    const ps = passive(u.owner); if (ps) { if (u.cls === "archer") a += ps.archerAtk || 0; if (ps.cavAtk && (u.kind === "horseman" || u.kind === "centaur")) a += ps.cavAtk; }
    if (u.cls === "archer") a += godFx(u.owner, "archAtk"); return a;
  };
  const rangeOf = (u) => u.def.range + (plr(u.owner).techs.has("arrows") && u.cls === "archer" ? 1 : 0) + (u.cls === "archer" && passive(u.owner) ? passive(u.owner).archerRange || 0 : 0);
  function armorOf(t, atkType) {
    if (t.type === "building") return atkType === "siege" ? 0 : (atkType === "pierce" ? t.def.pArm : t.def.mArm);
    const p = plr(t.owner); const sh = p.techs.has("armor") && (t.cls === "infantry" || t.cls === "hero"); const ath = godFx(t.owner, "infArm") && (t.cls === "infantry" || t.cls === "hero") ? godFx(t.owner, "infArm") : 0;
    if (atkType === "pierce") return t.def.pArm + (sh ? 2 : 0) + ath;
    if (atkType === "siege") return Math.floor((t.def.mArm + ath) / 2);
    return t.def.mArm + (sh ? 1 : 0) + ath;
  }
  // how hard a unit hits (multiplier): its own boosts, the champion's aura, relics, levels
  function dmgMul(a, t) {
    let m = HX.stOf(a, "dmg"); const o = a.owner;
    if (a.cls !== "villager" && a.cls !== "monster") m *= 1 + relicFx(o, "dmg");
    if (a.cls === "siege") m *= 1 + godFx(o, "siege");
    const hu = o >= 0 && o < 2 ? HX.heroUnit(o) : null;
    if (hu) { const ps = HEROES[hu.kind].passive; if (ps.aura && a !== hu && a.cls !== "villager" && hyp(a.x - hu.x, a.z - hu.z) <= ps.aura.r) m *= 1 + ps.aura.atk; if (a === hu && ps.vsMyth && (t.cls === "monster" || t.cls === "myth")) m *= 1 + ps.vsMyth; }
    if (a.isHero) m *= 1 + 0.08 * ((a.lvl || 1) - 1);
    return m;
  }
  // how much of a hit gets through (multiplier): rage, the Aegis relic, Perseus against monsters
  function takeMul(t, a) {
    let m = HX.stOf(t, "take"); const o = t.owner;
    if (t.cls !== "villager" && t.cls !== "monster") m *= 1 - relicFx(o, "take");
    if (t.isHero && (a.cls === "monster" || a.cls === "myth")) { const ps = HEROES[t.kind].passive; if (ps.takeMyth) m *= ps.takeMyth; }
    return m;
  }
  const speedMulOf = (u) => { let m = HX.stOf(u, "spd"); if (u.cls !== "villager" && u.cls !== "monster") m *= 1 + godFx(u.owner, "speed"); return m; };
  const gatherBonus = (o) => { const ps = passive(o); return (ps && ps.gather ? ps.gather : 0) + godFx(o, "gather") + relicFx(o, "gather"); };
  function costOf(owner, kind) {
    const d = UNITS[kind]; const ps = passive(owner); const k = ps && ps.cavCost && (kind === "horseman" || kind === "centaur") ? ps.cavCost : 1; const out = {}; for (const r of Object.keys(d.cost || {})) out[r] = Math.round(d.cost[r] * k); return out;
  }
  function damageOf(a, t) {
    const ad = a.def; let atk = ad.atk + (a.type === "unit" ? atkBonusOf(a) : 0);
    if (ad.bonus) { if (ad.bonus[t.cls]) atk += ad.bonus[t.cls]; }
    let dmg = Math.max(1, atk - armorOf(t, ad.atkType));
    if (a.type === "unit") dmg *= dmgMul(a, t); if (t.type === "unit") dmg *= takeMul(t, a);
    return Math.max(1, dmg);
  }

  // ---- damage and death --------------------------------------------------------------------------
  function alert(owner, kind, x, z, text) {
    if (owner !== 0) return; const k = kind; if (S.t - (S.alertT[k] || -99) < 7) return; S.alertT[k] = S.t; ev({ type: "alert", kind, x, z, text });
  }
  function hurt(t, dmg, src) {
    if (t.dead) return; t.hp -= dmg; t.lastHit = S.t;
    if (src && src.type === "unit" && t.type === "unit" && t.hp > 0) {
      // fight back if free
      const o = t.order.type;
      if (t.owner === 1 || t.cls !== "villager") { if ((o === "idle" || (o === "move" && t.order.attackMove)) && t.def.atk > 0 && t.cls !== "siege") { setOrder(t, { type: "attack", target: src.id, resume: t.order.attackMove ? t.order : null }); } }
    }
    if (t.owner === WILD && src && src.type === "unit" && t.hp > 0 && NW) NW.pull(t, src);
    if (t.owner === 0) { if (t.type === "building") alert(0, "base", t.x, t.z, t.kind === "town_center" ? "Your Town Center is under attack!" : "A building is under attack!"); else alert(0, t.cls === "villager" ? "vill" : "army", t.x, t.z, t.cls === "villager" ? "Your citizens are under attack!" : "Your army is under attack!"); }
    if (t.hp <= 0) kill(t, src);
  }
  function killRewards(src, t, isBuilding) {
    const o = src.owner; if (o < 0 || o > 1) return; const P = plr(o);
    const xp = isBuilding ? 10 * t.w : t.isHero ? 80 : t.def.xp != null ? t.def.xp : Math.max(7, (t.def.pop || 1) * 10);
    P.favor = Math.min(150, P.favor + (isBuilding ? 1 : t.owner === WILD ? 1.5 : Math.max(0.6, (t.def.pop || 1) * 0.9)));
    const hu = HX.heroUnit(o); if (hu && (src === hu || hyp(hu.x - t.x, hu.z - t.z) < 14)) HX.grantXp(o, src === hu ? xp : xp * 0.6);
  }
  function kill(t, src) {
    if (t.dead) return; t.dead = true; t.hp = 0; t.deathT = 0;
    const foe = src && src.owner >= 0 && src.owner !== t.owner;
    if (t.type === "unit") {
      t.path = null; ev({ type: "die", id: t.id, x: t.x, z: t.z, kind: t.kind, owner: t.owner });
      if (t.owner >= 0 && !t.summon) plr(t.owner).stats.lost++;
      if (foe) { if (t.owner === WILD) plr(src.owner).stats.monsters++; else plr(src.owner).stats.kills++; killRewards(src, t, false); }
      if (t.isHero) HX.onHeroDeath(t);
      if (t.lairId) NW.onKill(t, src);
    } else if (t.type === "building") {
      setOcc(t, false); ev({ type: "collapse", id: t.id, x: t.x, z: t.z, kind: t.kind, owner: t.owner, w: t.w });
      for (const q of t.queue) refund(t.owner, q);
      t.queue.length = 0; if (foe) { plr(src.owner).stats.razed++; killRewards(src, t, true); }
      if (t.owner === 0) alert(0, "lost", t.x, t.z, `Your ${t.def.name} was destroyed!`);
      if (t.def.wonder && plr(t.owner).wonder && plr(t.owner).wonder.bid === t.id) { plr(t.owner).wonder = null; ev({ type: "wonderLost", owner: t.owner, x: t.x, z: t.z }); }
    } else { setOcc(t, false); ev({ type: "depleted", id: t.id, x: t.x, z: t.z, kind: t.kind }); }
  }
  function refund(owner, q) {
    const p = plr(owner); const c = q.cost; if (c) for (const k of Object.keys(c)) p.res[k] += c[k]; if (q.type === "unit") p.reserved -= UNITS[q.kind].pop; if (q.type === "age") p.ageBusy = false; if (q.type === "revive") HX.cancelRevive(owner);
  }

  // ---- orders ----------------------------------------------------------------------------------------
  function setOrder(u, o) {
    if (u.order.type === "gather" && u.order.target) { const n = get(u.order.target); if (n && n.workerId === u.id) n.workerId = 0; }
    u.order = o; u.path = null; u.pi = 0; u.goal = null; u.needPath = false; u.stuckT = 0; u.moveFail = 0; u.repathT = 0; u.anim = "idle";
    if (o.type !== "build" && o.type !== "idle") { /* keep queue only while building */ }
  }
  function goPt(u, x, z) { u.goal = { pt: [x, z] }; u.needPath = true; u.path = null; u.pi = 0; u.moveFail = 0; }
  function goEnt(u, e) { u.goal = { ent: e.id }; u.needPath = true; u.path = null; u.pi = 0; u.moveFail = 0; }
  function computePath(u) {
    const g = u.goal; if (!g) { u.path = null; return; }
    let gx, gz, opts = { partial: true };
    if (regDirty && S.t - regT > 0.25) { relabel(); regT = S.t; }
    if (g.pt) { [gx, gz] = g.pt; opts.fx = gx; opts.fz = gz; const f = pather.nearestFree(Math.floor(gx), Math.floor(gz), 6); if (!f || reg[f[1] * N + f[0]] !== labelOf(u.x, u.z)) { u.path = null; return; } }
    else { const e = get(g.ent); if (!e || e.dead) { u.path = null; return; } if (e.type === "unit") { gx = e.x; gz = e.z; if (labelOf(gx, gz) !== labelOf(u.x, u.z)) { u.path = null; return; } } else { const a = adjGoal(u, e); if (!a) { u.path = null; return; } [gx, gz] = a; opts.partial = false; } }
    const before = pather.expanded; opts.budget = 3200; const p = pather.find(u.x, u.z, gx, gz, opts); S.pathBudget -= Math.max(40, pather.expanded - before);
    u.path = p; u.pi = 0;
  }
  // walk along the current path; returns "moving" | "arrived" | "blocked"
  function advance(u, dt) {
    if (u.needPath) { if (S.pathBudget <= 0) return "moving"; computePath(u); u.needPath = false; if (!u.path) return "blocked"; }
    if (!u.path) return "arrived";
    const sp = u.def.speed * u.speedMul * dt;
    let wp = u.path[u.pi]; let dx = wp[0] - u.x, dz = wp[1] - u.z, d = hyp(dx, dz);
    while (d < 0.1) { u.pi++; if (u.pi >= u.path.length) { u.path = null; u.anim = "idle"; return "arrived"; } wp = u.path[u.pi]; dx = wp[0] - u.x; dz = wp[1] - u.z; d = hyp(dx, dz); }
    const m = Math.min(sp, d); const nx = u.x + (dx / d) * m, nz = u.z + (dz / d) * m;
    moveTo(u, nx, nz); u.vx = (dx / d) * u.def.speed; u.vz = (dz / d) * u.def.speed; u.anim = "walk";
    const want = Math.atan2(dx, dz); let da = want - u.face; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; u.face += da * Math.min(1, dt * 12);
    // stuck detection
    u.stuckT += dt; if (u.stuckT > 0.6) { if (hyp(u.x - u.lastX, u.z - u.lastZ) < 0.18 * u.speedMul) { u.moveFail++; u.needPath = true; if (u.moveFail >= 5) { u.path = null; u.needPath = false; u.moveFail = 0; return "blocked"; } } else u.moveFail = 0; u.stuckT = 0; u.lastX = u.x; u.lastZ = u.z; }
    return "moving";
  }
  const freeAt = (x, z, r) => pather.free(Math.floor(x - r), Math.floor(z - r)) && pather.free(Math.floor(x + r), Math.floor(z - r)) && pather.free(Math.floor(x - r), Math.floor(z + r)) && pather.free(Math.floor(x + r), Math.floor(z + r));
  function moveTo(u, nx, nz) {
    const r = Math.min(0.22, u.radius * 0.7);
    if (freeAt(nx, nz, r)) { u.x = nx; u.z = nz; return true; }
    if (freeAt(nx, u.z, r)) { u.x = nx; return true; }
    if (freeAt(u.x, nz, r)) { u.z = nz; return true; }
    return false;
  }

  function nextTarget(u, o) {
    const t = acquire(u, Math.max(u.def.vision * 0.9, rangeOf(u) + 1.5), o.resume ? true : false, o);
    if (t) { o.target = t.id; u.path = null; u.goal = null; u.needPath = false; return; }
    if (o.resume) { const r = o.resume; setOrder(u, { type: "move", x: r.x, z: r.z, attackMove: true }); goPt(u, r.x, r.z); } else setOrder(u, { type: "idle" });
  }

  // find something to fight near a unit
  function acquire(u, range, includeBuildings) {
    let best = null, bs = 1e9;
    forNear(u.x, u.z, range, (e) => {
      if (e.dead || e.owner === u.owner) return; if (e.owner === WILD && u.owner !== WILD && e.order.type !== "attack") return; const d = hyp(e.x - u.x, e.z - u.z) - e.radius; if (d > range) return; if (u.skip && (u.skip.get(e.id) || 0) > S.t) return;
      if (u.cls === "siege") return; // catapults only hit buildings on their own
      let s = d * (e.cls === "villager" ? 1.25 : e.def.atk > 0 ? 0.8 : 1);
      if (u.cls === "archer" && e.cls === "infantry") s *= 1.1;
      if (s < bs) { bs = s; best = e; }
    });
    if (includeBuildings || u.cls === "siege") {
      for (const b of S.buildings) { if (b.dead || b.owner === u.owner) continue; const d = edgeDist(u, b); if (d > range + (u.cls === "siege" ? 4 : 0)) continue; if (u.skip && (u.skip.get(b.id) || 0) > S.t) continue; const s = d * (b.def.arrows ? 0.9 : 1.6) + 1; if (s < bs) { bs = s; best = b; } }
    }
    return best;
  }

  // ---- unit behaviours ----------------------------------------------------------------------------------
  function strike(u, t) {
    const ad = u.def; u.atkCd = ad.cd; u.anim = "attack"; u.animT = 0;
    const dx = t.x - u.x, dz = t.z - u.z; u.face = Math.atan2(dx, dz);
    if (ad.atkType === "melee") { hurt(t, damageOf(u, t), u); ev({ type: "hit", x: t.x, z: t.z, melee: true }); return; }
    // ranged / siege: launch a projectile
    const dist = hyp(dx, dz); const speed = ad.atkType === "siege" ? 9 : 20; const dur = Math.max(0.15, dist / speed);
    let tx = t.x, tz = t.z; if (t.type === "unit" && t.vx !== undefined && t.path) { tx += t.vx * dur * 0.9; tz += t.vz * dur * 0.9; }
    S.projectiles.push({ id: S.nextId++, owner: u.owner, kind: ad.atkType === "siege" ? "rock" : "arrow", sx: u.x, sz: u.z, tx, tz, t0: S.t, dur, target: t.id, dmg: damageOf(u, t), srcId: u.id, splash: ad.splash || 0, atkType: ad.atkType, src: u });
    ev({ type: "shot", kind: ad.atkType === "siege" ? "rock" : "arrow", sx: u.x, sz: u.z, tx, tz, dur, owner: u.owner });
  }

  function updateAttack(u, dt) {
    const o = u.order; const t = get(o.target);
    if (u.owner === WILD && NW.leashed(u)) { NW.goHome(u); return; }
    if (!t || t.dead || t.owner === u.owner) { nextTarget(u, o); return; }
    const rng = rangeOf(u), d = edgeDist(u, t);
    if (d <= rng) {
      u.path = null; u.needPath = false; const dx = t.x - u.x, dz = t.z - u.z; const want = Math.atan2(dx, dz); let da = want - u.face; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; u.face += da * Math.min(1, dt * 14);
      if (u.atkCd <= 0) strike(u, t); else if (u.anim !== "attack") u.anim = "idle"; return;
    }
    u.repathT -= dt;
    if (!u.goal || u.repathT <= 0 || (t.type === "unit" && hyp(t.x - (o.lx ?? 1e9), t.z - (o.lz ?? 1e9)) > 1.4)) { goEnt(u, t); o.lx = t.x; o.lz = t.z; u.repathT = 0.9 + rnd() * 0.3; }
    const r = advance(u, dt);
    if (r === "blocked") { u.goal = null; (u.skip || (u.skip = new Map())).set(t.id, S.t + 10); if (o.resume) nextTarget(u, o); else setOrder(u, { type: "idle" }); }
    else if (r === "arrived" && edgeDist(u, t) > rng + 0.6) { u.repathT = 0; }
  }

  function dropsiteFor(u, res) {
    let best = null, bd = 1e9;
    for (const b of S.buildings) { if (b.dead || !b.done || b.owner !== u.owner || !b.def.drop || !b.def.drop.includes(res)) continue; const d = edgeDist(u, b); if (d < bd) { bd = d; best = b; } }
    return best;
  }
  function nodeReachable(u, n) { const ul = labelOf(u.x, u.z); for (const [x, z] of ringTiles(n)) if (pather.free(x, z) && reg[z * N + x] === ul) return true; return false; }
  function nearestNode(x, z, res, maxD, u) {
    if (regDirty && S.t - regT > 0.25) { relabel(); regT = S.t; }
    const cands = []; const m2 = maxD * maxD;
    for (const n of S.nodes) { if (n.dead || n.res !== res) continue; const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < m2) cands.push([d, n]); }
    if (!cands.length) return null; cands.sort((a, b) => a[0] - b[0]);
    if (!u) return cands[0][1];
    for (let i = 0; i < cands.length && i < 14; i++) if (nodeReachable(u, cands[i][1])) return cands[i][1];
    return null;
  }
  function nearestFarm(u, maxD) {
    let best = null, bd = maxD * maxD;
    for (const b of S.buildings) { if (b.dead || !b.done || b.owner !== u.owner || !b.def.farm) continue; if (b.workerId && b.workerId !== u.id) { const w = get(b.workerId); if (w && !w.dead && w.order.type === "gather" && w.order.target === b.id) continue; } const d = (b.x - u.x) ** 2 + (b.z - u.z) ** 2; if (d < bd) { bd = d; best = b; } }
    return best;
  }
  function gatherRate(u, target) {
    const p = plr(u.owner); let r = target.type === "building" ? FARM_RATE : NODE[target.kind].rate; const res = target.type === "building" ? "food" : target.res;
    if (res === "wood" && p.techs.has("axes")) r *= 1.25; if ((res === "gold" || res === "stone") && p.techs.has("picks")) r *= 1.25; if (res === "food" && p.techs.has("plow")) r *= 1.3;
    return r * p.gatherMult * (1 + gatherBonus(u.owner));
  }
  function startGather(u, n) {
    const res = n.type === "building" ? "food" : n.res;
    if (n.type === "building") n.workerId = u.id;
    setOrder(u, { type: "gather", target: n.id, res, phase: "toRes" }); goEnt(u, n);
  }
  function updateGather(u, dt) {
    const o = u.order; let n = get(o.target);
    if (o.phase === "toDrop") {
      const ds = dropsiteFor(u, u.carry.res); if (!ds) { setOrder(u, { type: "idle" }); return; }
      if (edgeDist(u, ds) <= 0.85) {
        const p = plr(u.owner); p.res[u.carry.res] += u.carry.amt; p.stats.gathered += u.carry.amt; u.carry.amt = 0; u.carry.res = null; u.path = null; u.goal = null;
        if (n && !n.dead) { o.phase = "toRes"; goEnt(u, n); } else retargetGather(u, o); return;
      }
      if (!u.goal || u.goal.ent !== ds.id) goEnt(u, ds);
      const r = advance(u, dt); if (r === "blocked") { u.goal = null; u.needPath = true; } return;
    }
    if (!n || n.dead || (n.type === "node" && n.amount <= 0)) { retargetGather(u, o); return; }
    if (n.type === "building" && n.workerId !== u.id) { const w = get(n.workerId); if (w && !w.dead && w.order.type === "gather" && w.order.target === n.id) { retargetGather(u, o); return; } n.workerId = u.id; }
    if (o.phase === "toRes") {
      if (edgeDist(u, n) <= 0.8) { o.phase = "gathering"; u.path = null; u.goal = null; u.needPath = false; }
      else { if (!u.goal) goEnt(u, n); const r = advance(u, dt); if (r === "blocked") { u.goal = null; o.fails = (o.fails || 0) + 1; if (o.fails > 2) retargetGather(u, o, n.id); else u.needPath = true; } return; }
    }
    // gathering
    if (edgeDist(u, n) > 1.6) { o.phase = "toRes"; goEnt(u, n); return; }
    u.anim = "gather"; u.face = Math.atan2(n.x - u.x, n.z - u.z);
    const res = n.type === "building" ? "food" : n.res; if (u.carry.res && u.carry.res !== res) { u.carry.amt = 0; } u.carry.res = res;
    let take = gatherRate(u, n) * dt; if (n.type === "node") { take = Math.min(take, n.amount); n.amount -= take; if (n.amount <= 0.001) kill(n, null); }
    u.carry.amt += take;
    if (u.carry.amt >= CARRY) { o.phase = "toDrop"; u.goal = null; u.path = null; u.needPath = false; }
  }
  function retargetGather(u, o, skipId) {
    const res = o.res; let n = null;
    if (res === "food") { n = nearestNode(u.x, u.z, "food", 14, u); if (!n || n.id === skipId) n = nearestFarm(u, 16); }
    else { n = nearestNode(u.x, u.z, res, 16, u); if (n && n.id === skipId) { const alt = S.nodes.filter((q) => !q.dead && q.res === res && q.id !== skipId && Math.hypot(q.x - u.x, q.z - u.z) < 16 && nodeReachable(u, q)).sort((a, b) => Math.hypot(a.x - u.x, a.z - u.z) - Math.hypot(b.x - u.x, b.z - u.z))[0]; n = alt || null; } }
    if (n) { startGather(u, n); return; }
    if (u.carry.amt > 0 && dropsiteFor(u, u.carry.res)) { setOrder(u, { type: "gather", target: 0, res, phase: "toDrop" }); return; }
    setOrder(u, { type: "idle" });
  }

  function afterBuilt(u, b) {
    if (u.buildQueue.length) { const nid = u.buildQueue.shift(); const nb = get(nid); if (nb && !nb.dead && !nb.done) { setOrder(u, { type: "build", target: nid }); goEnt(u, nb); return; } }
    if (b.def.farm) { startGather(u, b); return; }
    if (b.def.drop) { // look for something to harvest nearby
      for (const res of ["wood", "gold", "stone", "food"]) { const n = nearestNode(b.x, b.z, res, 9); if (n) { startGather(u, n); return; } }
    }
    setOrder(u, { type: "idle" });
  }
  function updateBuild(u, dt) {
    const o = u.order; const b = get(o.target);
    if (!b || b.dead) { setOrder(u, { type: "idle" }); return; }
    const repair = o.type === "repair";
    if (!repair && b.done) { afterBuilt(u, b); return; }
    if (repair && b.hp >= b.maxHp) { setOrder(u, { type: "idle" }); return; }
    if (edgeDist(u, b) <= 0.85) {
      u.path = null; u.goal = null; u.needPath = false; u.anim = "build"; u.face = Math.atan2(b.x - u.x, b.z - u.z);
      if (repair) b.hp = Math.min(b.maxHp, b.hp + (b.maxHp / (b.def.time * 1.6)) * dt); else b.buildersNow++;
      return;
    }
    if (!u.goal) goEnt(u, b);
    const r = advance(u, dt); if (r === "blocked") { u.goal = null; o.fails = (o.fails || 0) + 1; if (o.fails > 3) setOrder(u, { type: "idle" }); else u.needPath = true; }
  }

  function updateMove(u, dt) {
    const o = u.order;
    if (o.attackMove || u.cls === "siege" && false) {
      u.scanT -= dt;
      if (u.scanT <= 0) { u.scanT = 0.35 + rnd() * 0.15; if (u.def.atk > 0 && u.cls !== "villager") { const t = acquire(u, Math.max(u.def.vision * 0.9, rangeOf(u) + 1.5), true); if (t) { setOrder(u, { type: "attack", target: t.id, resume: o }); return; } } }
    }
    if (!u.goal) goPt(u, o.x, o.z);
    const r = advance(u, dt);
    if (r === "arrived" || r === "blocked") { if (r === "blocked" && o.fails === undefined) { o.fails = 1; } setOrder(u, { type: "idle" }); }
  }

  function updateIdle(u, dt) {
    if (u.owner === WILD) { NW.wildIdle(u, dt); return; }
    u.anim = "idle"; u.vx = u.vz = 0;
    if (u.def.atk <= 0 || u.cls === "villager") return;
    u.scanT -= dt; if (u.scanT > 0) return; u.scanT = 0.4 + rnd() * 0.2;
    const t = acquire(u, Math.max(u.def.vision * 0.8, rangeOf(u) + 1), u.owner === 1 || u.cls === "siege");
    if (t) setOrder(u, { type: "attack", target: t.id, resume: null, from: { x: u.x, z: u.z } });
  }

  function updateUnit(u, dt) {
    if (u.dead) { u.deathT += dt; return; }
    u.atkCd -= dt; u.animT = (u.animT || 0) + dt;
    const def = u.def; const rg = (def.regen || 0) + (u.isHero ? relicFx(u.owner, "regen") : 0); if (rg && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + rg * dt);
    u.vx = 0; u.vz = 0; u.speedMul = speedMulOf(u);
    if (HX.isStunned(u)) { u.anim = "idle"; return; } // frozen: dazed, knocked down or turned to stone
    switch (u.order.type) {
      case "idle": updateIdle(u, dt); break;
      case "move": updateMove(u, dt); break;
      case "attack": updateAttack(u, dt); break;
      case "gather": updateGather(u, dt); break;
      case "build": case "repair": updateBuild(u, dt); break;
      default: u.order = { type: "idle" };
    }
  }

  // push overlapping units apart
  function separate() {
    for (const u of S.units) {
      if (u.dead) continue; const mu = u.order.type !== "idle" && (u.path || u.needPath) ? 1 : 2.4;
      forNear(u.x, u.z, 1.2, (v) => {
        if (v.id <= u.id || v.dead) return; const dx = v.x - u.x, dz = v.z - u.z; const min = (u.radius + v.radius) * 0.95; const d2 = dx * dx + dz * dz; if (d2 >= min * min) return;
        const d = Math.sqrt(d2) || 0.001; const push = (min - d) * 0.5; const mv = v.order.type !== "idle" && (v.path || v.needPath) ? 1 : 2.4; const wu = mv / (mu + mv), wv = mu / (mu + mv);
        const nx = dx / d || (rnd() - 0.5), nz = dz / d || (rnd() - 0.5);
        const ux = u.x - nx * push * 2 * wu, uz = u.z - nz * push * 2 * wu, vx = v.x + nx * push * 2 * wv, vz = v.z + nz * push * 2 * wv;
        if (freeAt(ux, uz, 0.2)) { u.x = ux; u.z = uz; } if (freeAt(vx, vz, 0.2)) { v.x = vx; v.z = vz; }
      });
    }
  }

  // ---- buildings --------------------------------------------------------------------------------------------
  function spawnPoint(b, toward) {
    let best = null, bd = 1e9; const tx = toward ? toward[0] : b.x, tz = toward ? toward[1] : b.z + 8;
    for (const [x, z] of ringTiles(b)) { if (!pather.free(x, z)) continue; const d = (x + 0.5 - tx) ** 2 + (z + 0.5 - tz) ** 2; if (d < bd) { bd = d; best = [x + 0.5, z + 0.5]; } }
    return best || [b.x, b.z + b.w / 2 + 1];
  }
  function finishItem(b, q) {
    const p = plr(b.owner);
    if (q.type === "unit") {
      p.reserved -= UNITS[q.kind].pop; const sp = spawnPoint(b, b.rally ? [b.rally.x, b.rally.z] : null);
      const u = addUnit(q.kind, b.owner, sp[0], sp[1]); p.stats.trained++; ev({ type: "trained", id: u.id, owner: b.owner, x: u.x, z: u.z, kind: q.kind });
      const r = b.rally;
      if (r) {
        const tgt = r.target ? get(r.target) : null;
        if (tgt && !tgt.dead && u.kind === "villager" && ((tgt.type === "node") || (tgt.type === "building" && tgt.def.farm && tgt.owner === b.owner))) startGather(u, tgt);
        else if (tgt && !tgt.dead && tgt.type === "building" && tgt.owner === b.owner && !tgt.done && u.kind === "villager") { setOrder(u, { type: "build", target: tgt.id }); goEnt(u, tgt); }
        else { setOrder(u, { type: "move", x: r.x, z: r.z, attackMove: false }); goPt(u, r.x, r.z); }
      }
    } else if (q.type === "tech") { p.techs.add(q.key); ev({ type: "tech", owner: b.owner, key: q.key }); }
    else if (q.type === "age") { p.age++; p.ageBusy = false; if (q.god) { p.gods.push(q.god); if (q.god === "hephaestus") for (const bb of S.buildings) if (!bb.dead && bb.owner === b.owner) { bb.maxHp *= 1.2; bb.hp *= 1.2; } } ev({ type: "age", owner: b.owner, age: p.age, god: q.god || null }); }
    else if (q.type === "revive") HX.finishRevive(b);
  }
  function updateBuilding(b, dt) {
    if (b.dead) { b.deathT += dt; return; }
    const p = plr(b.owner);
    if (!b.done) {
      if (b.buildersNow > 0) {
        const n = b.buildersNow; const inc = (dt * Math.pow(n, 0.7)) / b.def.time; const before = b.progress; b.progress = Math.min(1, b.progress + inc);
        b.hp = Math.min(b.maxHp, b.hp + (b.maxHp * 0.95) * (b.progress - before));
        if (b.progress >= 1) { b.done = true; b.hp = Math.max(b.hp, b.maxHp * 0.95); p.stats.built++; ev({ type: "built", id: b.id, owner: b.owner, x: b.x, z: b.z, kind: b.kind });
          if (b.def.wonder && !p.wonder) { p.wonder = { bid: b.id, until: S.t + WONDER_TIME, warnAt: S.t }; ev({ type: "wonderStart", owner: b.owner, x: b.x, z: b.z, time: WONDER_TIME }); } }
      }
      b.buildersNow = 0; return;
    }
    b.buildersNow = 0;
    if (b.def.favor) p.favor = Math.min(150, p.favor + b.def.favor * dt);
    if (b.kind === "temple" && p.gods.includes("apollo")) { b.healT = (b.healT || 0) - dt; if (b.healT <= 0) { b.healT = 1; S.forNear(b.x, b.z, 8, (e) => { if (!e.dead && e.owner === b.owner && e.hp < e.maxHp && hyp(e.x - b.x, e.z - b.z) < 7.5) e.hp = Math.min(e.maxHp, e.hp + 5); }); } }
    // production queue
    const q = b.queue[0];
    if (q) {
      if (q.type === "unit" && false) { /* pop was reserved when queued */ }
      q.t += dt; q.pct = clamp(q.t / q.total, 0, 1);
      if (q.t >= q.total) { b.queue.shift(); finishItem(b, q); }
    }
    // arrows
    if (b.def.arrows) {
      b.fireCd -= dt;
      if (b.fireCd <= 0) {
        let best = null, bd = 1e9; const R = b.def.arrows.range;
        forNear(b.x, b.z, R + 2, (e) => { if (e.dead || e.owner === b.owner) return; const d = hyp(e.x - b.x, e.z - b.z) - b.w / 2; if (d <= R && d < bd) { bd = d; best = e; } });
        if (best) {
          b.fireCd = b.def.arrows.cd; const dist = hyp(best.x - b.x, best.z - b.z); const dur = Math.max(0.2, dist / 20);
          let tx = best.x, tz = best.z; if (best.path) { tx += best.vx * dur * 0.9; tz += best.vz * dur * 0.9; }
          const ts = (b.def.arrows.atk + (b.kind === "town_center" ? plr(b.owner).age * 2 : 0)) * (1 + godFx(b.owner, "towerDmg"));
          S.projectiles.push({ id: S.nextId++, owner: b.owner, kind: "arrow", sx: b.x, sz: b.z, tx, tz, t0: S.t, dur, target: best.id, dmg: Math.max(1, ts - armorOf(best, "pierce")), srcId: b.id, splash: 0, atkType: "pierce", src: b, fromBuilding: true });
          ev({ type: "shot", kind: "arrow", sx: b.x, sz: b.z, tx, tz, dur, owner: b.owner, high: true });
        } else b.fireCd = 0.3;
      }
    }
  }

  function updateProjectiles() {
    for (let i = S.projectiles.length - 1; i >= 0; i--) {
      const pr = S.projectiles[i]; if (S.t - pr.t0 < pr.dur) continue; S.projectiles.splice(i, 1);
      const t = get(pr.target); const src = pr.src && !pr.src.dead ? pr.src : null;
      if (pr.kind === "rock") {
        ev({ type: "boom", x: pr.tx, z: pr.tz });
        if (t && !t.dead && t.type === "building") hurt(t, pr.dmg, src);
        const R = pr.splash || 1.5;
        forNear(pr.tx, pr.tz, R + 1, (e) => { if (e.dead || e.owner === pr.owner) return; if (t && e.id === t.id) return; const d = hyp(e.x - pr.tx, e.z - pr.tz); if (d <= R) hurt(e, Math.max(1, (pr.dmg * (1 - d / (R * 1.4))) - armorOf(e, "siege")), src); });
        if (t && !t.dead && t.type === "unit") { if (hyp(t.x - pr.tx, t.z - pr.tz) <= R) { /* already handled in splash */ } }
        for (const b of S.buildings) { if (b.dead || b.owner === pr.owner || (t && b.id === t.id)) continue; const cx = clamp(pr.tx, b.ix, b.ix + b.w), cz = clamp(pr.tz, b.iz, b.iz + b.w); if (hyp(pr.tx - cx, pr.tz - cz) < R * 0.6) hurt(b, pr.dmg * 0.5, src); }
        continue;
      }
      if (!t || t.dead) continue;
      const hit = t.type === "building" || hyp(t.x - pr.tx, t.z - pr.tz) <= 0.55 + t.radius;
      if (hit) { hurt(t, pr.dmg, src); ev({ type: "hit", x: t.x, z: t.z, melee: false }); } else ev({ type: "miss", x: pr.tx, z: pr.tz });
    }
  }

  // ---- fog of war (for the human player) -------------------------------------------------------------------------
  const discs = new Map();
  function disc(r) { r = Math.round(r); let d = discs.get(r); if (!d) { d = []; for (let z = -r; z <= r; z++) for (let x = -r; x <= r; x++) if (x * x + z * z <= r * r + r) d.push(x, z); discs.set(r, d); } return d; }
  function updateVision() {
    if (S.revealAll) { S.vis.fill(2); return; }
    const v = S.vis; for (let i = 0; i < v.length; i++) if (v[i] === 2) v[i] = 1;
    const reveal = (cx, cz, r) => { const d = disc(r), ix = Math.floor(cx), iz = Math.floor(cz); for (let k = 0; k < d.length; k += 2) { const x = ix + d[k], z = iz + d[k + 1]; if (x >= 0 && z >= 0 && x < N && z < N) v[z * N + x] = 2; } };
    const gv = godFx(0, "vision"); const ps0 = passive(0); const hv = ps0 && HX.heroUnit(0) ? 0 : 0;
    for (const u of S.units) if (!u.dead && u.owner === 0) reveal(u.x, u.z, u.def.vision + gv);
    for (const b of S.buildings) if (!b.dead && b.owner === 0) reveal(b.x, b.z, b.def.vision + gv + (b.done ? 0 : -3));
    // lit-up areas (Apollo's Farsight, Odysseus's Eyes of the Fox) last a while and then fade back to "seen before"
    for (let i = S.reveals.length - 1; i >= 0; i--) { const r = S.reveals[i]; if (r.until <= S.t) { S.reveals.splice(i, 1); continue; } if (r.owner === 0) reveal(r.x, r.z, r.r); }
  }
  // lights a patch of the map up for good (it stays "seen before" afterwards)
  function exploreDisc(cx, cz, r) { const v = S.vis, d = disc(r), ix = Math.floor(cx), iz = Math.floor(cz); for (let k = 0; k < d.length; k += 2) { const x = ix + d[k], z = iz + d[k + 1]; if (x >= 0 && z >= 0 && x < N && z < N && v[z * N + x] < 1) v[z * N + x] = 1; } }
  const visible = (x, z) => S.vis[clamp(Math.floor(z), 0, N - 1) * N + clamp(Math.floor(x), 0, N - 1)] === 2;
  const explored = (x, z) => S.vis[clamp(Math.floor(z), 0, N - 1) * N + clamp(Math.floor(x), 0, N - 1)] >= 1;

  // ---- commands (used by the player's mouse and by the AI) --------------------------------------------------
  const ok = (extra) => ({ ok: true, ...(extra || {}) });
  const no = (reason) => ({ ok: false, reason });
  const own = (ids, owner) => ids.map(get).filter((u) => u && !u.dead && u.type === "unit" && u.owner === owner);

  function spiral(n) { // offsets for a group standing together
    const out = [[0, 0]]; let r = 1; while (out.length < n) { const m = r * 8; for (let k = 0; k < m && out.length < n; k++) { const a = (k / m) * Math.PI * 2; out.push([Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95]); } r++; } return out;
  }
  function cmdMove(owner, ids, x, z, attackMove = false) {
    const us = own(ids, owner); if (!us.length) return no("No units");
    x = clamp(x, 1, N - 1); z = clamp(z, 1, N - 1);
    const offs = spiral(us.length); us.sort((a, b) => hyp(a.x - x, a.z - z) - hyp(b.x - x, b.z - z));
    us.forEach((u, i) => {
      let tx = x + offs[i][0], tz = z + offs[i][1]; const f = pather.nearestFree(Math.floor(tx), Math.floor(tz), 4); if (f) { if (!pather.free(Math.floor(tx), Math.floor(tz))) { tx = f[0] + 0.5; tz = f[1] + 0.5; } }
      u.buildQueue.length = 0; setOrder(u, { type: "move", x: tx, z: tz, attackMove }); goPt(u, tx, tz);
    });
    return ok();
  }
  function cmdAttack(owner, ids, targetId) {
    const t = get(targetId); if (!t || t.dead || t.owner === owner || t.owner === -1) return no("Bad target");
    const us = own(ids, owner).filter((u) => u.def.atk > 0 && u.cls !== "siege" || (u.cls === "siege" && t.type === "building") || (u.cls === "siege" && t.type === "unit"));
    if (!us.length) return no("No fighters");
    for (const u of us) { u.buildQueue.length = 0; setOrder(u, { type: "attack", target: t.id, resume: null }); goEnt(u, t); u.order.lx = t.x; u.order.lz = t.z; u.repathT = 1; }
    return ok();
  }
  function cmdGather(owner, ids, nodeId) {
    const n = get(nodeId); if (!n || n.dead || (n.type !== "node" && !(n.type === "building" && n.def.farm && n.owner === owner))) return no("Nothing to gather");
    const us = own(ids, owner).filter((u) => u.cls === "villager"); if (!us.length) return no("No citizens");
    for (const u of us) { u.buildQueue.length = 0; if (n.type === "building") { const w = get(n.workerId); if (w && !w.dead && w.id !== u.id && w.order.type === "gather" && w.order.target === n.id) { const alt = nearestFarm(u, 20); if (alt) startGather(u, alt); continue; } } startGather(u, n); }
    return ok();
  }
  function cmdBuild(owner, ids, bId, repair = false) {
    const b = get(bId); if (!b || b.dead || b.owner !== owner || b.type !== "building") return no("Bad building");
    const us = own(ids, owner).filter((u) => u.cls === "villager"); if (!us.length) return no("No citizens");
    if (repair && b.hp >= b.maxHp) return no("Already in good shape");
    for (const u of us) { u.buildQueue.length = 0; setOrder(u, { type: repair || b.done ? "repair" : "build", target: b.id }); goEnt(u, b); }
    return ok();
  }
  function cmdStop(owner, ids) { for (const u of own(ids, owner)) { u.buildQueue.length = 0; setOrder(u, { type: "idle" }); } return ok(); }

  function placementOk(kind, ix, iz) {
    const d = BUILDINGS[kind]; if (!d) return false;
    for (let j = 0; j < d.size; j++) for (let i = 0; i < d.size; i++) { const x = ix + i, z = iz + j; if (x < 1 || z < 1 || x >= N - 1 || z >= N - 1) return false; if (occId[z * N + x] || map.blockedBase[z * N + x]) return false; }
    return true;
  }
  function evict(b) {
    for (const u of S.units) { if (u.dead) continue; if (u.x > b.ix - 0.3 && u.x < b.ix + b.w + 0.3 && u.z > b.iz - 0.3 && u.z < b.iz + b.w + 0.3) { const sp = spawnPoint(b, [u.x, u.z]); u.x = sp[0] + (rnd() - 0.5) * 0.3; u.z = sp[1] + (rnd() - 0.5) * 0.3; if (u.path) u.needPath = true; } }
  }
  function cmdPlace(owner, kind, ix, iz, ids, queue = false) {
    const d = BUILDINGS[kind]; const p = plr(owner); if (!d) return no("Unknown building");
    if (p.age < d.age) return no(`Needs the ${AGES[d.age].short} Age`);
    if (!canAfford(p.res, d.cost)) return no("Not enough resources");
    if (d.wonder && S.buildings.some((bb) => !bb.dead && bb.owner === owner && bb.def.wonder)) return no("You can only raise one Wonder");
    if (!placementOk(kind, ix, iz)) return no("Can't build there");
    const us = own(ids, owner).filter((u) => u.cls === "villager"); if (!us.length) return no("Select a citizen first");
    for (const k of Object.keys(d.cost)) p.res[k] -= d.cost[k];
    const b = addBuilding(kind, owner, ix, iz, false); evict(b);
    for (const u of us) { if (queue && u.order.type === "build") u.buildQueue.push(b.id); else { u.buildQueue.length = 0; setOrder(u, { type: "build", target: b.id }); goEnt(u, b); } }
    ev({ type: "placed", id: b.id, owner, x: b.x, z: b.z, kind });
    return ok({ id: b.id });
  }
  function cmdTrain(owner, bId, kind) {
    const b = get(bId); const p = plr(owner); if (!b || b.dead || !b.done || b.owner !== owner) return no("Not available");
    const d = UNITS[kind]; if (!d || !b.def.trains || !b.def.trains.includes(kind)) return no("Can't train that here");
    if (p.age < d.age) return no(`Needs the ${AGES[d.age].short} Age`);
    if (d.god && !p.gods.includes(d.god)) return no(`Needs the god ${GODS[d.god].name}`);
    if (b.queue.length >= 6) return no("Queue is full");
    if (d.limit) { const have = S.units.filter((u) => !u.dead && u.owner === owner && u.kind === kind).length + S.buildings.reduce((n, bb) => n + bb.queue.filter((q) => q.kind === kind).length, 0); if (have >= d.limit) return no(`Only ${d.limit} ${d.name} at a time`); }
    const cost = costOf(owner, kind); if (!canAfford(p.res, cost)) return no("Not enough resources");
    if (popOf(owner) + p.reserved + d.pop > capOf(owner)) return no("Build more houses");
    for (const k of Object.keys(cost)) p.res[k] -= cost[k];
    p.reserved += d.pop; b.queue.push({ type: "unit", kind, t: 0, total: d.time, cost: { ...cost }, pct: 0 }); return ok();
  }
  function cmdResearch(owner, bId, key) {
    const b = get(bId); const p = plr(owner); const t = TECHS[key]; if (!b || b.dead || !b.done || b.owner !== owner || !t) return no("Not available");
    if (!b.def.techs || !b.def.techs.includes(key)) { if (!(key === "plow" && b.kind === "town_center")) return no("Not researched here"); }
    if (p.techs.has(key)) return no("Already researched");
    if (S.buildings.some((bb) => bb.owner === owner && bb.queue.some((q) => q.key === key))) return no("Already being researched");
    if (p.age < t.age) return no(`Needs the ${AGES[t.age].short} Age`);
    if (b.queue.length >= 6) return no("Queue is full"); if (!canAfford(p.res, t.cost)) return no("Not enough resources");
    for (const k of Object.keys(t.cost)) p.res[k] -= t.cost[k]; b.queue.push({ type: "tech", key, t: 0, total: t.time, cost: { ...t.cost }, pct: 0 }); return ok();
  }
  function cmdAge(owner, bId, god) {
    const b = get(bId); const p = plr(owner); if (!b || b.dead || !b.done || b.owner !== owner || b.kind !== "town_center") return no("Not available");
    const next = AGES[p.age + 1]; if (!next) return no("You've reached the last age"); if (p.ageBusy) return no("Already advancing");
    const choices = GOD_CHOICES[p.age + 1]; if (choices && !choices.includes(god)) return no("Choose which god to follow first");
    if (!canAfford(p.res, next.cost)) return no("Not enough resources");
    for (const k of Object.keys(next.cost)) p.res[k] -= next.cost[k]; p.ageBusy = true; b.queue.push({ type: "age", t: 0, total: next.time, cost: { ...next.cost }, pct: 0, god: choices ? god : null }); return ok();
  }
  function cmdCancel(owner, bId, index) {
    const b = get(bId); if (!b || b.owner !== owner) return no("No"); const q = b.queue[index]; if (!q) return no("No"); b.queue.splice(index, 1); refund(owner, q); return ok();
  }
  function cmdRally(owner, bId, x, z, targetId) { const b = get(bId); if (!b || b.owner !== owner || b.type !== "building") return no("No"); b.rally = { x, z, target: targetId || 0 }; return ok(); }
  function cmdDelete(owner, eid) { const e = get(eid); if (!e || e.owner !== owner || e.dead) return no("No"); if (e.type === "building") { if (e.kind === "town_center" && S.buildings.filter((b) => b.owner === owner && b.kind === "town_center" && !b.dead).length <= 1) return no("Can't delete your last Town Center"); kill(e, null); } else kill(e, null); return ok(); }
  function cmdPower(owner, key, x, z) {
    const p = plr(owner); const pw = POWERS[key]; if (!pw) return no("No such power");
    if (!p.heroId || !HEROES[p.heroId].powers.includes(key)) return no("Your champion's gods don't grant that power");
    if (!S.buildings.some((b) => !b.dead && b.done && b.owner === owner && b.kind === "temple")) return no("You need a Temple");
    if (p.favor < pw.favor) return no("Not enough favor"); if ((p.powerCd[key] || 0) > S.t) return no("Still recharging");
    if (pw.needsTarget && (x == null || z == null)) return no("Pick a spot");
    p.favor -= pw.favor; p.powerCd[key] = S.t + pw.cd; const src = PSRC(owner);
    if (key === "bolt") {
      ev({ type: "bolt", x, z, radius: pw.radius });
      forNear(x, z, pw.radius + 1, (e) => { if (e.dead || e.owner === owner) return; const d = hyp(e.x - x, e.z - z); if (d <= pw.radius) hurt(e, 170 * (1 - 0.4 * d / pw.radius), src); });
      for (const b of S.buildings) { if (b.dead || b.owner === owner) continue; const cx = clamp(x, b.ix, b.ix + b.w), cz = clamp(z, b.iz, b.iz + b.w); if (hyp(x - cx, z - cz) <= pw.radius) hurt(b, 120, src); }
    } else if (key === "heal") {
      ev({ type: "heal", x, z, radius: pw.radius });
      forNear(x, z, pw.radius + 1, (e) => { if (e.dead || e.owner !== owner) return; if (hyp(e.x - x, e.z - z) <= pw.radius) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.8); });
    } else if (key === "bounty") { p.res.food += 220; p.res.wood += 220; ev({ type: "bounty", owner }); }
    else if (key === "fury" || key === "swift") {
      const dur = key === "fury" ? 20 : 15; for (const u of S.units) if (!u.dead && u.owner === owner && (key === "swift" || u.cls !== "villager")) HX.addStatus(u, key, dur);
      ev({ type: "buff", key, owner });
    } else if (key === "quake") {
      ev({ type: "quake", x, z, radius: pw.radius });
      forNear(x, z, pw.radius + 1, (e) => { if (e.dead || e.owner === owner) return; if (hyp(e.x - x, e.z - z) <= pw.radius) HX.addStatus(e, "stun", 3); });
      for (const b of S.buildings) { if (b.dead || b.owner === owner) continue; const cx = clamp(x, b.ix, b.ix + b.w), cz = clamp(z, b.iz, b.iz + b.w); if (hyp(x - cx, z - cz) <= pw.radius) hurt(b, Math.max(140, b.maxHp * 0.12), src); }
    } else if (key === "farsight") {
      S.reveals.push({ owner, x, z, r: pw.radius, until: S.t + 30 }); ev({ type: "farsight", x, z, radius: pw.radius, owner });
    } else if (key === "storm") {
      ev({ type: "storm", x, z, radius: pw.radius });
      forNear(x, z, pw.radius + 1, (e) => { if (e.dead || e.owner === owner) return; if (hyp(e.x - x, e.z - z) <= pw.radius) hurt(e, Math.max(3, 95 - armorOf(e, "pierce")), src); });
    }
    return ok();
  }

  // ---- the main step ---------------------------------------------------------------------------------------------
  function tick(dt) {
    if (S.over) return;
    S.t += dt; S.pathBudget = 9000;
    rebuildGrid();
    S.visT -= dt; if (S.visT <= 0) { S.visT = 0.25; updateVision(); }
    for (const p of S.players) { p.pop = popOf(p.id); p.popCap = capOf(p.id); }
    for (const b of S.buildings) updateBuilding(b, dt);
    for (const u of S.units) updateUnit(u, dt);
    separate();
    updateProjectiles();
    for (const a of S.ais) a.update(dt);
    S.cleanT -= dt;
    if (S.cleanT <= 0) {
      S.cleanT = 1;
      S.units = S.units.filter((u) => { if (u.dead && u.deathT > 3) { S.ents.delete(u.id); return false; } return true; });
      S.buildings = S.buildings.filter((b) => { if (b.dead && b.deathT > 4) { S.ents.delete(b.id); return false; } return true; });
      S.nodes = S.nodes.filter((n) => { if (n.dead) { S.ents.delete(n.id); return false; } return true; });
    }
    HX.expireSummons(); NW.tick(dt);
    // each Temple that stands holds a relic's power; also a trickle of favor from the Temple itself
    for (const p of S.players) { if (p.wild) continue; if (p.relics.includes("nectar") || true) { const tp = S.buildings.some((b) => !b.dead && b.done && b.owner === p.id && b.kind === "temple"); if (tp && p.favor < 150) p.favor = Math.min(150, p.favor + dt * (0.35 + NW.relicBonus(p.id, "favorRate"))); } }
    // the Wonder: hold it standing until the clock runs out
    for (const p of S.players) {
      if (!p.wonder) continue; const wb = get(p.wonder.bid);
      if (!wb || wb.dead) { p.wonder = null; continue; }
      const left = p.wonder.until - S.t;
      if (S.t - p.wonder.warnAt >= 60 && left > 0) { p.wonder.warnAt = S.t; ev({ type: "wonderTick", owner: p.id, left: Math.ceil(left) }); }
      if (left <= 0 && !S.over) { S.over = { winner: p.id, t: S.t, wonder: true }; ev({ type: "over", winner: p.id, wonder: true }); }
    }
    // victory: lose every Town Center and you lose the war
    for (const p of S.players) { if (p.wild) continue; const tcs = S.buildings.filter((b) => !b.dead && b.done && b.owner === p.id && b.kind === "town_center").length; if (tcs === 0 && !p.defeated && S.t > 5 && !S.over) { p.defeated = true; S.over = { winner: 1 - p.id, t: S.t }; ev({ type: "over", winner: 1 - p.id }); } }
  }

  Object.assign(S, {
    nodeReachable, labelOf, relabel,
    tick, get, addUnit, addBuilding, addNode, placementOk, edgeDist, adjGoal, forNear, visible, explored, popOf, capOf, rangeOf, nearestNode, nearestFarm, dropsiteFor, startGather, cmdMove, cmdAttack, cmdGather, cmdBuild, cmdStop,
    cmdPlace, cmdTrain, cmdResearch, cmdAge, cmdCancel, cmdRally, cmdDelete, cmdPower, cmdAbility: (...a) => HX.cmdAbility(...a), cmdRevive: (...a) => HX.cmdRevive(...a), grantXp: (...a) => HX.grantXp(...a), dropRelic: (...a) => NW.dropRelic(...a), setOcc, freeAt, armorOf, explore: (x, z, r) => exploreDisc(x, z, r), costOf, setOrder, goPt, goEnt, spawnPoint, hurt, kill, ringTiles, isEnemy,
    drain() { const e = S.events; S.events = []; return e; },
  });

  // ---- champions and the secrets of the map -----------------------------------------------------------------
  HX = installHeroes(S); NW = installWorld(S); S.hero = HX;
  HX.setupHeroes();
  map.starts.forEach((st, p) => {
    const f = pather.nearestFree(Math.floor(st.cx + 4.5), Math.floor(st.cz + 0.5), 6) || [Math.floor(st.cx + 5), Math.floor(st.cz)];
    HX.spawnHero(p, f[0] + 0.5, f[1] + 0.5);
  });
  NW.create();
  { const st = map.starts[0]; exploreDisc(st.cx, st.cz, 26); }
  updateVision();
  return S;
}
