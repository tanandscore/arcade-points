// Midnight Burn — the game itself, with no graphics: the player, the traffic, the rival racers, every event type, rewards
// and saving. The renderer and the menus only read from it. Headless-testable.
import { newVehicle, stepVehicle, collideVehicles, newDriver, driveInput, DT, wrapPi } from "./drive";
import { buildRoute, MEDAL_PTS } from "./content";
import { makeStats, cityStats, cityUpgradeCost, CITY_UPGRADES, ZERO_TUNE, CARS, UPGRADES, heroUnlocked, upgradeLock, carRating } from "../physics";
import { LEVEL_XP, levelOf } from "../drivers";
import { milestoneState } from "./blacklist";
import { CLS } from "./roads";
import { mulberry, W } from "./geo";
import { IS_TOKYO } from "./mapId";
import { garageCap, garageNeed, GARAGE_NEED, GARAGE_FIND_RADIUS, GARAGE_HINT_RADIUS, GARAGE_SIZE } from "./garages";
import { dayKey, dayNum, pickDaily, pickBounties, streakBonus, BOUNTY, COMBO, comboMult } from "./challenges";
import { HEAT, COP_LOOK, heatLevel, bountyFor, fineFor } from "./pursuit";
import { OUT, ROSTER, maxTier, difficulty, rewardFor, projectOnRoute, farRoute, tailRoute, chatLine } from "./outrun";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const MEDALS = ["none", "bronze", "silver", "gold"];
const medalRank = (m) => MEDALS.indexOf(m || "none");
const KMH = 3.6;

export const EMPTY_CAREER = () => ({
  v: 2, cash: 1500, xp: 0, levels: { engine: 0, tires: 0, nitro: 0 }, tune: {}, owned: [], carsOwned: ["kestrel", "brute", "gecko"], car: "kestrel", spec: null,
  done: {}, stash: [], sights: [], seen: [], pos: null, odo: 0, playT: 0, nearMiss: 0, bestDrift: 0, topSpeed: 0, jumps: 0,
  msDone: [], earned: 0, pedFines: 0, garages: [], // hidden garages found (Upgrade 38)
  daily: null, combos: { best: 0, paid: 0 },
  outruns: { w: 0, l: 0, streak: 0, best: 0, beaten: {} }, // outrun races against the street racers (Upgrade 38)
   // lifetime cash earned, and the little that has been paid in pedestrian fines (never more than 1.5% of it)
});

// ---- traffic kinds ----------------------------------------------------------------------------------------------------------
const KINDS = {
  car: { len: 4.2, w: 1.8, cc: [[1.2, 0.95], [-1.2, 0.95]], mass: 1.0 },
  taxi: { len: 4.2, w: 1.8, cc: [[1.2, 0.95], [-1.2, 0.95]], mass: 1.0 },
  rick: { len: 2.6, w: 1.4, cc: [[0.5, 0.75], [-0.5, 0.75]], mass: 0.5 },
  bus: { len: 10.5, w: 2.5, cc: [[3.6, 1.3], [0, 1.3], [-3.6, 1.3]], mass: 3.5 },
  truck: { len: 8, w: 2.4, cc: [[2.6, 1.25], [-0.2, 1.25], [-2.8, 1.25]], mass: 3.0 },
};
const CAR_COLORS = ["#d9dde6", "#14151b", "#7a1f24", "#2b4b8c", "#8e9199", "#e6e0d0", "#1d5a3c", "#c27a1e"];

export function createGame(world, content, careerIn, opts = {}) {
  const city = world.city;
  const rnd = mulberry((opts.seed || 1) * 977 + 13);
  const career = { ...EMPTY_CAREER(), ...careerIn, levels: { ...EMPTY_CAREER().levels, ...(careerIn && careerIn.levels) } };
  // Upgrade 25: every car keeps its OWN tuning. A career saved before this (one shared set of upgrades) keeps what it paid for: the shared upgrades are copied onto every car it already owns, once.
  if (careerIn && careerIn.tune === undefined) { career.tune = {}; const lv = { ...career.levels }; if (lv.engine || lv.tires || lv.nitro) for (const id of career.carsOwned || []) career.tune[id] = { ...lv }; } else if (!career.tune || typeof career.tune !== "object") career.tune = {};
  { const o = career.outruns && typeof career.outruns === "object" ? career.outruns : {}; career.outruns = { w: o.w | 0, l: o.l | 0, streak: o.streak | 0, best: o.best | 0, beaten: { ...(o.beaten || {}) } }; } // an older save has none
  const tuneOf = (id) => (career.tune[id] || (career.tune[id] = { ...ZERO_TUNE }));
  // ---- hidden garages (Upgrade 38) ------------------------------------------------------------------------------------------------------------------
  // A driver's level is held back until enough hidden garages have been found. A career saved before this keeps the level it had already earned (lvFloor),
  // and only the levels above that wait for garages.
  const GARS = (content.garages || []); const garaged = !opts.free && GARS.length > 0;
  if (!Array.isArray(career.garages)) career.garages = [];
  if (garaged) career.garages = career.garages.filter((id) => GARS.some((g) => g.id === id));
  if (garaged && !world.__garageCol) { // the garage buildings are solid, for the player and the traffic alike (added once per city)
    world.__garageCol = true;
    for (const g of GARS) { const c = Math.cos(g.yaw), sn = Math.sin(g.yaw); world.addCollider({ t: 0, x: g.bx, z: g.bz, hw: GARAGE_SIZE.hx, hd: GARAGE_SIZE.hz, c, s: sn, y: g.by, h: GARAGE_SIZE.h }, g.bx - 7, g.bz - 7, g.bx + 7, g.bz + 7); }
  }
  if (career.lvFloor == null || !(careerIn && careerIn.lvFloor != null)) career.lvFloor = careerIn ? levelOf(careerIn.xp || 0) : 1;
  // Hero cars (Upgrade 23): two are yours from the first minute of any career, new or old. The other eight are handed over one by one as the career levels
  // up (see CARS in physics.js) - and an older career gets every one its level has already earned the moment it loads. This only ever ADDS cars.
  if (!opts.free) { const have = new Set(career.carsOwned || []); const lv = levelOf(career.xp || 0); for (const c of CARS) if (c.hero && c.start) have.add(c.id); career.carsOwned = [...have]; }
  const G = { world, content, city, career, t: 0, toasts: [], state: "roam", run: null, result: null, traffic: [], nav: null, wet: false, weather: { rain: 0, target: 0, next: 120 }, near: null, shopNear: null, events: content.events, hooks: opts.hooks || {}, tid: 1, cam: { hit: 0 }, racers: [], cops: [], heat: { pts: 0, lvl: 0, peak: 0, hidden: 0, bust: 0, replan: 0, msg: null }, racerNear: null, racerT: 16, chat: null, cid: 1, cueLog: [] };

  // ---- player ------------------------------------------------------------------------------------------------------------------
  const carDef = () => CARS.find((c) => c.id === career.car) || CARS[0];
  const stats = () => cityStats(carDef(), tuneOf(career.car), career.spec ? career.spec.kit : "stock");
  G.restat = () => { if (G.player) G.player.stats = stats(); };
  function spawnAt(x, z, yaw, nitro = 30, yRef = 0) {
    // yRef = the height we expect to be at, so a respawn on a bridge deck finds the DECK, not the sea floor beneath it
    const sf = city.surfaceAt(x, z, yRef) || city.surfaceAt(x, z, 0); const y = sf ? sf.y : city.groundH(x, z);
    const v = newVehicle(x, z, yaw, stats(), y); v.nitro = nitro; G.player = v; return v;
  }
  const hqShop = content.shops.find((s) => s.id === "home");
  function roadYaw(x, z) { const n = city.nearestRoad(x, z, 80, null, null); if (!n) return 0; const r = n.road; const a = r.pts[n.i], b = r.pts[n.i + 1]; return Math.atan2(b.z - a.z, b.x - a.x); }
  if (career.pos) spawnAt(career.pos.x, career.pos.z, career.pos.yaw); else { const yw = roadYaw(hqShop.x, hqShop.z); spawnAt(hqShop.x + Math.cos(yw) * 16, hqShop.z + Math.sin(yw) * 16, yw); }
  const hqPlace = () => { const r = city.nearestRoad(hqShop.x, hqShop.z, 120); const p = r ? { x: r.px ?? hqShop.x, z: r.pz ?? hqShop.z } : hqShop; return p; };

  // ---- event preparation -----------------------------------------------------------------------------------------------------
  for (const ev of content.events) {
    if (ev.wp) { const r = buildRoute(world, ev); ev.base = r; if (r) { ev.sx = r.pts[0].x; ev.sz = r.pts[0].z; ev.sy = r.pts[0].y; const q = r.pts[Math.min(5, r.pts.length - 1)]; ev.syaw = Math.atan2(q.z - r.pts[0].z, q.x - r.pts[0].x); ev.routeLen = r.len; } }
    else if (ev.type === "drift") { ev.sx = ev.x; ev.sz = ev.z; if (ev.y != null) ev.sy = ev.y; }
    else if (ev.type === "trap") { ev.sx = ev.x; ev.sz = ev.z; }
  }
  G.events = content.events.filter((e) => e.sx != null);
  G.eventById = Object.fromEntries(G.events.map((e) => [e.id, e]));
  // Upgrade 61: story mode builds its own races. They go in the lookup table (so startEvent can run them) but not in G.events, so they never show on the map or event list.
  G.addStoryEvent = (ev) => {
    const r = ev.wp || ev.fixedRoute ? buildRoute(world, ev) : null; if (!r) return null;
    ev.base = r; ev.sx = r.pts[0].x; ev.sz = r.pts[0].z; ev.sy = r.pts[0].y; const q = r.pts[Math.min(5, r.pts.length - 1)]; ev.syaw = Math.atan2(q.z - r.pts[0].z, q.x - r.pts[0].x); ev.routeLen = r.len;
    G.eventById[ev.id] = ev; return ev;
  };

  const rawLevel = () => levelOf(career.xp);
  const capLevel = () => (garaged ? garageCap(career.garages.length, GARS.length) : 10);
  G.level = () => (garaged ? Math.max(career.lvFloor || 1, Math.min(rawLevel(), capLevel())) : rawLevel());
  G.rawLevel = rawLevel; G.levelCap = capLevel;
  // where the driver stands on the garage hunt: how many found, which level is held back, and how many more are needed to reach it
  G.garageProgress = () => {
    const found = career.garages.length, total = GARS.length, lv = G.level(); const nextLv = lv < 10 ? lv + 1 : null;
    const need = nextLv && garaged ? garageNeed(nextLv, total) : 0;
    return { found, total, level: lv, nextLevel: nextLv, need, more: Math.max(0, need - found), held: garaged && rawLevel() > lv, raw: rawLevel(), active: garaged };
  };
  G.garages = GARS; G.garageFound = (id) => career.garages.includes(id);
  // every place that works as a workshop: the shops, and each hidden garage once it has been found
  G.shopList = () => [...content.shops, ...GARS.filter((g) => career.garages.includes(g.id))];
  // ---- the Blacklist (Upgrade 33) --------------------------------------------------------------------------------------------
  const BL = content.blacklist || [];
  G.blacklist = BL; G.rival = (id) => BL.find((x) => x.id === id);
  G.msState = (m) => milestoneState(m, career, medalRank);
  G.rivalState = (r) => {
    const k = BL.indexOf(r), prevBeaten = k === 0 || !!career.done["duel-" + BL[k - 1].id];
    const ms = r.ms.map((m) => ({ ...m, ...G.msState(m) })); const msDone = ms.every((m) => m.done);
    return { beaten: !!career.done["duel-" + r.id], ready: prevBeaten && msDone, prevBeaten, ms, msCount: ms.filter((m) => m.done).length };
  };
  G.blacklistRank = () => { let rk = BL.length + 1; for (const r of BL) if (career.done["duel-" + r.id]) rk = r.rank; return rk; }; // 16 = not on the list yet; 1 = at the top
  G.isUnlocked = (ev) => { if (ev.type === "duel") { const r = G.rival(ev.driver); return !!r && G.rivalState(r).ready; } return G.level() >= ev.level && (!ev.requires || !!career.done[ev.requires]); };
  G.lockReason = (ev) => { if (ev.type === "duel") { const r = G.rival(ev.driver); const st = r && G.rivalState(r); if (!st) return ""; return !st.prevBeaten ? "Beat the rival below you first" : !st.ms.every((m) => m.done) ? `Milestones ${st.msCount}/${st.ms.length} — see the Career tab` : ""; } return G.level() < ev.level ? `Reach level ${ev.level}` : ev.requires && !career.done[ev.requires] ? "Beat the previous driver first" : ""; };
  // announce each milestone as it is reached, and the moment a rival's challenge opens
  let msTimer = 0;
  function checkMilestones(silent) {
    for (const r of BL) {
      const st = G.rivalState(r); if (st.beaten) continue;
      for (const m of st.ms) { const key = r.id + ":" + m.label; if (m.done && !career.msDone.includes(key)) { career.msDone.push(key); if (!silent) toast(`MILESTONE  ${m.label}  (${st.msCount}/${st.ms.length}) — ${r.name} #${r.rank}`, "level", 4); } }
      const rk = "ready:" + r.id; if (st.ready && !career.msDone.includes(rk)) { career.msDone.push(rk); if (!silent) toast(`CHALLENGE OPEN  ${r.name.toUpperCase()} #${r.rank} is waiting — ${r.from}`, "level", 5.5); if (!silent && G.hooks.onSave) G.hooks.onSave(career); }
    }
  }
  if (!career.msInit) { career.msInit = true; checkMilestones(true); } // a career saved before the Blacklist: mark what it has already earned without announcing it
  G.score = () => {
    let s = 0; for (const [id, d] of Object.entries(career.done)) s += d.pts || 0;
    const oc = career.outruns; // Upgrade 38: every hidden garage found is worth 100, every outrun won 120 (the first 100 only) and every street racer beaten at least once 250
    return Math.round(s + career.stash.length * 30 + career.sights.length * 120 + Math.floor(career.odo / 1000) * 5 + Math.floor(career.nearMiss) * 4 + career.garages.length * 100 + Math.min(100, oc.w) * 120 + Object.values(oc.beaten).filter((n) => n > 0).length * 250);
  };
  const toast = (text, kind = "info", ttl = 3.2) => { G.toasts.push({ text, kind, ttl, id: G.tid++ }); if (G.toasts.length > 5) G.toasts.shift(); if (G.hooks.onToast) G.hooks.onToast(text, kind); };
  G.toast = toast;
  // ---- Upgrade 39: sound cues and the racers' radio chatter. A cue is a name ("tick", "go", "lead", "lost", "win", "lose", "challenge", "rev", "radio") the screen layer plays as a sound; a chat line is what a racer says over the radio.
  const chatRnd = mulberry((opts.seed || 1) * 313 + 5);   // the racers' chatter has its own dice, so talking never changes how the world or the race plays out
  const cue = (name) => { G.cueLog.push(name); if (G.cueLog.length > 60) G.cueLog.shift(); if (G.hooks.onCue) G.hooks.onCue(name); };
  G.cue = cue;
  const say = (r, kind, o = {}) => { const text = o.text || chatLine(r.def, kind, chatRnd, r.lastSaid); r.lastSaid = text; G.chat = { id: G.cid++, name: r.name, tag: r.def.tag, tier: r.tier, color: r.color, kind: o.kind || kind, text, ttl: o.ttl || 4.4, ttl0: o.ttl || 4.4 }; cue("radio"); return G.chat; };
  G.say = say;

  function levelCheck(before) {
    const after = G.level();
    if (after > before) {
      toast(`LEVEL ${after}`, "level", 4.5); if (G.hooks.onLevel) G.hooks.onLevel(after);
      if (!opts.free) for (const c of CARS) if (c.hero && c.level > before && c.level <= after && !career.carsOwned.includes(c.id)) toast(`NEW IN THE CAR LOT: ${c.name.toUpperCase()} - ${IS_TOKYO ? "¥" : "₹"}${c.price.toLocaleString()}`, "good", 6);
    }
    // the XP is there but the level is waiting for garages: say so once for each level that is held
    const gp = G.garageProgress();
    if (gp.held && G.heldLevel !== gp.raw) { G.heldLevel = gp.raw; toast(`LEVEL ${gp.nextLevel} IS READY: FIND ${gp.more} MORE HIDDEN GARAGE${gp.more === 1 ? "" : "S"}`, "warn", 6); }
    return after;
  }
  function giveXp(n) { const before = G.level(); career.xp += Math.round(n); levelCheck(before); }
  function foundGarage(g) {
    const before = G.level(); career.garages.push(g.id); if (!career.seen.includes(g.id)) career.seen.push(g.id);
    giveCash(250); career.xp += 80;
    toast(`HIDDEN GARAGE FOUND  ${career.garages.length}/${GARS.length}  ·  ${g.name.toUpperCase()}`, "level", 5.5);
    if (G.hooks.onFind) G.hooks.onFind(g);
    const after = levelCheck(before);
    if (after === before) { const gp = G.garageProgress(); if (gp.nextLevel && gp.more > 0 && !gp.held) toast(`${gp.more} MORE GARAGE${gp.more === 1 ? "" : "S"} FOR LEVEL ${gp.nextLevel}`, "good", 4); }
    if (G.hooks.onSave) G.hooks.onSave(career);
  }
  G.carUnlocked = (c) => !!opts.free ? !c.hero : heroUnlocked(c, G.level());
  function giveCash(n) { n = Math.round(n); career.cash += n; if (n > 0) career.earned = (career.earned || 0) + n; }
  // pay a medal. Only the improvement over the previous best is paid.
  function award(ev, medal, extra = {}) {
    const old = career.done[ev.id]; const rk = medalRank(medal); const orank = old ? medalRank(old.medal) : 0;
    const full = ev.reward; const frac = MEDAL_PTS[medal] || 0.25; const oldFrac = old ? MEDAL_PTS[old.medal] || 0.25 : 0;
    const first = !old; const f = Math.max(0, (rk > orank || first ? frac : 0) - (first ? 0 : oldFrac));
    const cash = Math.round(full.cash * f + (rk <= orank && !first ? full.cash * 0.08 : 0)), xp = Math.round(full.xp * f + (rk <= orank && !first ? full.xp * 0.06 : 0));
    giveCash(cash); giveXp(xp);
    const nd = { medal: rk > orank || first ? medal : old.medal, pts: Math.max(old ? old.pts : 0, Math.round(full.pts * frac)), best: extra.best != null ? (old && old.best != null ? (extra.lowerBetter ? Math.min(old.best, extra.best) : Math.max(old.best, extra.best)) : extra.best) : old && old.best, wins: (old ? old.wins || 0 : 0) + 1 };
    career.done[ev.id] = nd;
    if (G.hooks.onSave) G.hooks.onSave(career);
    return { cash, xp, improved: first || rk > orank, medal: nd.medal };
  }

  // ---- traffic ---------------------------------------------------------------------------------------------------------------------
  const edgeCache = new Map();
  function edgePts(e) {
    let c = edgeCache.get(e.id); if (c) return c;
    const r = city.roads[e.r]; const pts = []; for (let i = e.i0; i <= e.i1; i++) pts.push(r.pts[i]);
    const s = [0]; for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    c = { pts, s, len: s[s.length - 1], road: r }; edgeCache.set(e.id, c); return c;
  }
  function onEdge(c, s) { // position and heading at distance s along an edge's polyline
    const { pts, s: S } = c; let lo = 0, hi = S.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (S[m] <= s) lo = m; else hi = m; }
    const a = pts[lo], b = pts[Math.min(pts.length - 1, lo + 1)]; const t = S[lo + 1] > S[lo] ? clamp((s - S[lo]) / (S[lo + 1] - S[lo]), 0, 1) : 0;
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, y: a.y + (b.y - a.y) * t, dx: b.x - a.x, dz: b.z - a.z };
  }
  function pickKind(road, x, z) {
    const r = rnd();
    if (road.cls === "hwy") return r < 0.22 ? "truck" : r < 0.3 ? "bus" : r < 0.42 ? "taxi" : "car";
    if (road.cls === "art") return r < 0.12 ? "bus" : r < 0.2 ? "truck" : r < 0.38 ? "taxi" : r < 0.5 && !IS_TOKYO ? "rick" : "car";
    return r < 0.28 ? (IS_TOKYO ? "car" : "rick") : r < 0.4 ? "taxi" : r < 0.45 ? "bus" : "car";
  }
  function spawnTraffic(px, pz, minD, maxD) {
    const a = rnd() * Math.PI * 2, d = minD + rnd() * (maxD - minD); const x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d;
    const n = city.nearestNode(x, z, 120, 120); if (!n || !n.edges.length) return null;
    const e = city.edges[n.edges[Math.floor(rnd() * n.edges.length)]]; const c = edgePts(e);
    if (c.len < 20) return null;
    const dir = e.a === n.id ? 1 : -1; const s = dir > 0 ? 6 : c.len - 6;
    const kind = pickKind(c.road); const K = KINDS[kind];
    const spd = CLS[c.road.cls].speed * (kind === "bus" || kind === "truck" ? 15 : kind === "rick" ? 11 : 17) * (0.85 + rnd() * 0.3);
    const t = { id: G.tid++, kind, color: kind === "taxi" ? "#f2b705" : kind === "rick" ? "#e8c600" : kind === "bus" ? (IS_TOKYO ? ["#2f8f5b", "#e9ecee", "#2d6fb5", "#d8d8d8"][G.tid % 4] : "#c4262c") : kind === "truck" ? (rnd() < 0.5 ? "#3a5f8a" : "#d57a1f") : CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)], e, dir, s, spd, v: spd * 0.8, lane: c.road.cls === "hwy" ? 5.6 : c.road.cls === "art" ? 3.4 : 2.4, x: 0, z: 0, y: 0, yaw: 0, vx: 0, vz: 0, fwd: 0, speed: 0, cc: K.cc, mass: K.mass, len: K.len, braking: false, nm: false, wreck: 0, age: 0, c, hardW: c.road.width };
    placeTraffic(t); if (Math.hypot(t.x - px, t.z - pz) < minD * 0.8) return null;
    // not on top of another car
    for (const o of G.traffic) if (Math.abs(o.x - t.x) < 8 && Math.abs(o.z - t.z) < 8) return null;
    return t;
  }
  function placeTraffic(t) {
    const p = onEdge(t.c, t.s); const L = Math.hypot(p.dx, p.dz) || 1; let fx = p.dx / L, fz = p.dz / L; if (t.dir < 0) { fx = -fx; fz = -fz; }
    const lx = fz, lz = -fx; // left of travel (cars keep left)
    t.x = p.x + lx * t.lane * 0.5 * (t.c.road.width > 12 ? 1 : 0.6); t.z = p.z + lz * t.lane * 0.5 * (t.c.road.width > 12 ? 1 : 0.6); t.y = p.y;
    const ny = Math.atan2(fz, fx); if (t.yaw === 0 || t.wreck > 0) t.yaw = ny; else t.yaw += wrapPi(ny - t.yaw) * 0.25; t.vx = fx * t.v; t.vz = fz * t.v; t.fwd = t.v; t.speed = t.v;
  }
  function nextEdge(t) {
    const node = city.nodes[t.dir > 0 ? t.e.b : t.e.a]; const cur = t.e;
    // heading at the end of this edge
    const cp = t.c.pts; const a = cp[t.dir > 0 ? cp.length - 2 : 1], b = cp[t.dir > 0 ? cp.length - 1 : 0]; const hx = b.x - a.x, hz = b.z - a.z; const hl = Math.hypot(hx, hz) || 1;
    let best = null, bs = -1e9;
    for (const eid of node.edges) {
      if (eid === cur.id) continue; const e = city.edges[eid]; const c = edgePts(e); const dir = e.a === node.id ? 1 : -1;
      const q = dir > 0 ? c.pts[Math.min(c.pts.length - 1, 1)] : c.pts[Math.max(0, c.pts.length - 2)]; const st = dir > 0 ? c.pts[0] : c.pts[c.pts.length - 1];
      const dx = q.x - st.x, dz = q.z - st.z, dl = Math.hypot(dx, dz) || 1; const cosA = (dx * hx + dz * hz) / (dl * hl);
      const sc = cosA + rnd() * 0.6 + (c.road.cls === t.c.road.cls ? 0.25 : 0); if (cosA < -0.5) continue; if (sc > bs) { bs = sc; best = { e, dir, c }; }
    }
    if (!best) return false;
    t.e = best.e; t.dir = best.dir; t.c = best.c; t.s = best.dir > 0 ? 0 : best.c.len; t.lane = best.c.road.cls === "hwy" ? 5.6 : best.c.road.cls === "art" ? 3.4 : 2.4; return true;
  }
  function stepTraffic(dt) {
    const P = G.player; const target = Math.round(clamp(46 + 10 * (1 - G.weather.rain), 30, 60));
    // spawn / remove
    G.spawnT = (G.spawnT || 0) - dt;
    if (G.traffic.length < target && G.spawnT <= 0) { const t = spawnTraffic(P.x, P.z, 120, 340); if (t) G.traffic.push(t); G.spawnT = 0.05; }
    for (let i = G.traffic.length - 1; i >= 0; i--) {
      const t = G.traffic[i]; const dd = Math.hypot(t.x - P.x, t.z - P.z);
      if (dd > 430 || (t.wreck > 0 && (t.wreck -= dt) <= 0)) { G.traffic.splice(i, 1); continue; }
      t.age += dt;
      if (t.wreck > 0) { t.vx *= Math.exp(-1.4 * dt); t.vz *= Math.exp(-1.4 * dt); t.x += t.vx * dt; t.z += t.vz * dt; t.speed = Math.hypot(t.vx, t.vz); t.braking = true; continue; }
      // look for a car ahead (traffic, player or racers)
      const fx = Math.cos(t.yaw), fz = Math.sin(t.yaw); let gap = 60, ahead = 1e9;
      const scan = (o) => { const dx = o.x - t.x, dz = o.z - t.z; const f = dx * fx + dz * fz; if (f < 0.5 || f > 36) return; const side = Math.abs(-dx * fz + dz * fx); if (side > 2.8 + (o.kind === "bus" ? 0.6 : 0)) return; if (Math.abs(o.y - t.y) > 3) return; if (f < gap) { gap = f; ahead = o.fwd ?? o.speed ?? 0; } };
      for (const o of G.traffic) if (o !== t) scan(o); scan(P); if (G.run && G.run.racers) for (const r of G.run.racers) scan(r.v); for (const r of G.racers) scan(r.v);
      let want = t.spd; const need = 6 + t.v * 0.9 + t.len * 0.5;
      if (gap < need) want = Math.max(0, Math.min(want, ahead * (gap / need) - (gap < need * 0.5 ? 4 : 0)));
      // slow for sharp bends ahead
      const dv = want - t.v; t.v += clamp(dv, -22 * dt, 4.5 * dt); t.v = Math.max(0, t.v); t.braking = dv < -1.5;
      t.s += t.v * dt * t.dir; t.nm = t.nm && Math.hypot(t.x - P.x, t.z - P.z) < 9;
      if (t.s > t.c.len || t.s < 0) { if (!nextEdge(t)) { t.dir = -t.dir; t.s = clamp(t.s, 0.01, t.c.len - 0.01); } }
      placeTraffic(t);
    }
  }

  // ---- racers & events ----------------------------------------------------------------------------------------------------------------
  const RACER_COLORS = ["#ff2d95", "#6bff6b", "#ffb703", "#b45cff", "#ff5a1f", "#2de2ff", "#f2f2f2"];
  const RACER_NAMES = ["Arjun", "Zoya", "Kabir", "Meera", "Rehan", "Tara", "Dev", "Isha"];
  function repeatRoute(base, laps, loop) {
    if (laps <= 1) return { pts: base.pts.map((p) => ({ ...p })), gates: [...base.gates], len: base.len, cuts: base.cuts };
    const pts = []; let off = 0; const gates = [];
    for (let l = 0; l < laps; l++) { const n0 = pts.length; for (let i = l === 0 ? 0 : 1; i < base.pts.length; i++) pts.push({ x: base.pts[i].x, z: base.pts[i].z, y: base.pts[i].y, s: base.pts[i].s + off }); for (const g of base.gates) gates.push(l === 0 ? g : n0 + g - 1); off += base.len; }
    return { pts, gates, len: pts[pts.length - 1].s };
  }
  G.startEvent = (id, opt = {}) => {
    const ev = G.eventById[id]; if (!ev) return false;
    if (!opt.force && !G.isUnlocked(ev)) { toast(G.lockReason(ev), "warn"); return false; }
    if (G.run) return false;
    if (ev.type === "duel") { const r = G.rival(ev.driver); if (r) toast(`${r.name.toUpperCase()}: "${r.taunt}"`, "info", 5); }
    if (ev.type === "trap") { toast("Drive through the camera as fast as you can", "info"); return false; }
    const P = G.player;
    G.traffic.length = 0; G.racers.length = 0; G.racerNear = null;
    if (ev.type === "drift") {
      G.run = { ev, kind: "drift", state: "countdown", cd: 3, t: 0, score: 0, bank: 0, chain: 0, lastHit: 0, best: 0, timeLeft: ev.time };
      spawnAt(ev.x, ev.z, ev.syaw != null ? ev.syaw : roadYaw(ev.x, ev.z), 40, ev.sy ?? 0); G.state = "event"; return true;
    }
    const base = ev.base; if (!base) return false;
    const laps = ev.laps || 1; const route = repeatRoute(base, laps, ev.loop);
    const run = { ev, kind: ev.type, state: "countdown", cd: 3.5, t: 0, route, racers: [], gate: 0, finished: false, place: 0, finishOrder: [], pgate: 0, lap: 1, laps, raceLen: route.len, cutIdx: 0, elimT: 0, elimCount: 0, hits: 0, cargo: 100 };
    const startPts = route.pts; const yaw = ev.syaw;
    const placeOnGrid = (slot, v) => {
      // two columns, staggered back along the route
      const row = Math.floor(slot / 2), col = slot % 2; let back = 6 + row * 8; let i = 0; while (i < startPts.length - 1 && startPts[0].s - 0 < 1e9 && back > 0 && i < 0) i++;
      const fx = Math.cos(yaw), fz = Math.sin(yaw); const lx = fz, lz = -fx;
      const lat = (col === 0 ? 1 : -1) * 2.0; // left lane first (traffic keeps left)
      v.x = startPts[0].x - fx * back + lx * lat; v.z = startPts[0].z - fz * back + lz * lat; v.yaw = yaw; const sf = city.surfaceAt(v.x, v.z, startPts[0].y); v.y = sf ? sf.y : startPts[0].y; v.vx = v.vz = 0; v.speed = 0; v.fwd = 0;
    };
    const pv = spawnAt(startPts[0].x, startPts[0].z, yaw, 40); placeOnGrid(ev.racers >= 1 ? 0 : 0, pv);
    run.player = pv;
    if (ev.type !== "delivery") {
      const rl = clamp(Math.floor((ev.level - 1) * 0.6), 0, 5);
      for (let i = 0; i < ev.racers; i++) {
        let cdef, color, name, spec = null, ai = { base: ev.ai.base + i * 0.006, latG: ev.ai.latG, nos: ev.level > 1, block: 0 }, lv = rl;
        if (ev.type === "duel") { const d = G.rival(ev.driver); cdef = CARS.find((c) => c.id === d.car.car); color = d.accent; name = d.name; spec = d.car; ai = { ...ai, ...d.ai, nos: d.ai.useNos }; lv = d.carLevel; }
        else { const pool = CARS.filter((c) => !c.locked); cdef = pool[(i + ev.level) % pool.length]; color = RACER_COLORS[(i + ev.level) % RACER_COLORS.length]; name = RACER_NAMES[(i * 3 + ev.level) % RACER_NAMES.length]; }
        const cast = ev.cast && ev.cast[i]; // story races name their own drivers and cars (Upgrade 61)
        if (cast) { cdef = CARS.find((c) => c.id === cast.car) || cdef; color = cast.color || color; name = cast.name || name; spec = { car: cdef.id, color, livery: cast.livery || "none" }; ai = { ...ai, ...(cast.ai || {}) }; }
        const v = newVehicle(0, 0, yaw, makeStats(cdef, { engine: lv, tires: lv, nitro: lv }, spec ? spec.kit : "stock"), 0); v.nitro = 60;
        placeOnGrid(ev.type === "drag" ? 1 : i + 1, v);
        run.racers.push({ v, drv: newDriver(route.pts, ai), name, color, car: cdef.id, spec, gate: 0, finished: false, finT: 0, out: false, prog: 0, mulb: 1, stuckT: 0, id: (cast && cast.id) || "r" + i });
      }
    }
    if (ev.type === "toll") { const gc = Math.max(1, route.gates.length), tot = base.len / 34; run.totalT = tot + 10; run.timeLeft = run.limit = 0.35 * tot + 10; run.tollBonus = Math.max(3, Math.round((0.65 * tot) / gc)); }
    if (ev.type === "delivery") { run.limit = (base.len / 31) * ev.timeMul + 18; run.timeLeft = run.limit; }
    G.run = run; G.state = "event"; G.result = null;
    G.nav = { target: { x: route.pts[route.pts.length - 1].x, z: route.pts[route.pts.length - 1].z }, line: route.pts, event: true };
    return true;
  };
  G.abortEvent = (quiet) => {
    const r = G.run; if (!r) return; G.run = null; G.state = "roam"; G.nav = null;
    if (r.kind === "outrun") { career.outruns.l++; career.outruns.streak = 0; racerCool[r.rival.def.id] = G.t + OUT.COOL; if (!quiet) { toast(`OUTRUN FORFEITED  ·  ${r.rival.name.toUpperCase()} WINS`, "warn"); cue("lose"); } if (G.hooks.onSave) G.hooks.onSave(career); return; }
    if (!quiet) toast("Event abandoned", "warn");
  };

  function routeProgress(run, pos) { // distance along the route
    return pos;
  }
  function playerS(run) { const P = run.player; const g = run.gate; if (g >= run.route.gates.length) return run.raceLen; const gp = run.route.pts[run.route.gates[g]]; return Math.max(0, gp.s - Math.hypot(gp.x - P.x, gp.z - P.z)); }

  function finishRun(run, outcome) {
    const ev = run.ev; const res = { ev, outcome, rows: [], time: run.t, medal: "none", reward: null, pos: 0 };
    if (run.kind === "drift") {
      const goals = ev.goals; const sc = Math.round(run.score); let m = sc >= goals[2] ? "gold" : sc >= goals[1] ? "silver" : sc >= goals[0] ? "bronze" : "none";
      res.medal = m; res.score = sc; res.goals = goals; if (m !== "none") res.reward = award(ev, m, { best: sc }); else { giveCash(ev.reward.cash * 0.05); res.reward = { cash: Math.round(ev.reward.cash * 0.05), xp: 0 }; }
      career.bestDrift = Math.max(career.bestDrift, sc);
    } else if (run.kind === "delivery") {
      if (outcome === "win") { const frac = run.timeLeft / run.limit; const m = frac > 0.3 && run.cargo > 70 ? "gold" : frac > 0.12 && run.cargo > 40 ? "silver" : "bronze"; res.medal = m; res.cargo = Math.round(run.cargo); res.timeLeft = run.timeLeft; res.reward = award(ev, m, { best: run.t, lowerBetter: true }); }
      else res.reward = { cash: 0, xp: 0 };
    } else {
      const order = [...run.finishOrder]; // list of 'p' or racer ids in finishing order
      let pos = order.indexOf("p") + 1; if (!pos || outcome === "out") pos = 0;
      // racers still running are placed behind by progress
      res.pos = pos; res.total = run.racers.length + 1;
      const m = pos === 1 ? "gold" : pos === 2 ? "silver" : pos === 3 ? "bronze" : "none";
      res.medal = outcome === "out" || outcome === "dnf" ? "none" : m;
      if (ev.type === "toll") { const f = (run.timeLeft || 0) / Math.max(1, run.totalT || 1); res.medal = outcome === "dnf" || !run.pFinished ? "none" : f > 0.14 ? "gold" : f > 0.06 ? "silver" : "bronze"; res.timeLeft = Math.max(0, run.timeLeft || 0); }
      if (res.medal !== "none") {
        res.reward = award(ev, res.medal, { best: run.t, lowerBetter: true });
        if (ev.type === "duel") {
          const d = G.rival(ev.driver); 
          if (d.unlockCar && !career.carsOwned.includes(d.unlockCar)) { career.carsOwned.push(d.unlockCar); res.unlocked = d.unlockCar; }
        }
      } else { giveCash(ev.reward.cash * 0.05); res.reward = { cash: Math.round(ev.reward.cash * 0.05), xp: 0 }; }
      res.rows = [{ name: "You", t: run.pFinT, me: true }, ...run.racers.map((r) => ({ name: r.name, t: r.finished ? r.finT : null, color: r.color }))].sort((a, b) => (a.t == null) - (b.t == null) || a.t - b.t);
    }
    res.win = res.medal !== "none";
    if (res.win) { G.dailyAdd("racewin", 1); claimBounty(ev, res); }
    if (run.ev.type === "duel") { const r = G.rival(run.ev.driver); res.rival = { name: r.name, title: r.title, rank: r.rank, line: res.win ? r.loss : r.win, rankUp: res.win }; if (res.win) toast(r.rank === 1 ? "YOU ARE #1 ON THE BLACKLIST" : `BLACKLIST #${r.rank}  ${r.name} beaten`, "level", 5); }
    G.result = res; G.run.state = "done"; G.state = "result"; if (G.hooks.onSave) G.hooks.onSave(career);
  }
  G.closeResult = () => {
    const run = G.run; G.run = null; G.result = null; G.state = "roam"; G.nav = null;
    if (run && run.kind === "outrun") return; // an outrun ends right where it ends: the car stays where it is
    // put the player back on the road at the finish with a clean car
    if (run && run.route) { const e = run.route.pts[run.route.pts.length - 1]; const q = run.route.pts[run.route.pts.length - 4] || e; const v = spawnAt(e.x, e.z, Math.atan2(e.z - q.z, e.x - q.x), G.player.nitro); }
    else if (run && run.ev) { const v = spawnAt(run.ev.x, run.ev.z, roadYaw(run.ev.x, run.ev.z), G.player.nitro); }
  };

  const OTHERS = [];
  function stepRun(run, dt, input) {
    const P = G.player;
    if (run.state === "countdown") {
      run.cd -= dt; for (const r of run.racers || []) { r.v.vx = r.v.vz = 0; r.v.speed = 0; } // (drift runs have no rival cars: this line used to throw and freeze every drift event at the countdown)
      P.vx = P.vz = 0; P.speed = 0; if (run.cd <= 0) { run.state = "go"; run.t = 0; toast("GO!", "go", 1.2); } return true;
    }
    if (run.state !== "go") return false;
    if (run.kind === "outrun") return stepOutrun(run, dt);
    run.t += dt;
    if (run.kind === "drift") {
      run.timeLeft -= dt;
      const inside = Math.hypot(P.x - run.ev.x, P.z - run.ev.z) < run.ev.radius;
      run.inside = inside;
      if (inside && P.drifting) { run.chain += dt; run.bank += dt * P.speed * 3.2 * (1 + Math.min(4, run.chain * 0.45)); run.lastHit = 0; }
      else { run.lastHit += dt; if (run.lastHit > 0.9 && run.bank > 0) { run.score += run.bank; run.best = Math.max(run.best, run.bank); toast(`+${Math.round(run.bank)} DRIFT`, "good", 1.6); run.bank = 0; run.chain = 0; } }
      if (P.hit > 5 && run.bank > 0) { run.bank = 0; run.chain = 0; toast("CRASHED — DRIFT LOST", "warn", 1.8); }
      if (run.timeLeft <= 0) { run.score += run.bank; run.bank = 0; finishRun(run, "time"); }
      return true;
    }
    if (run.kind === "delivery") {
      run.timeLeft -= dt; run.hitCd = (run.hitCd || 0) - dt; if (P.hit > 6 && run.hitCd <= 0) { run.cargo = Math.max(0, run.cargo - P.hit * 1.4); run.hitCd = 0.6; }
      const end = run.route.pts[run.route.pts.length - 1];
      if (Math.hypot(P.x - end.x, P.z - end.z) < 22 && Math.abs(P.y - end.y) < 6) finishRun(run, "win");
      else if (run.timeLeft <= 0) { toast("Out of time", "warn"); finishRun(run, "dnf"); }
      else if (run.cargo <= 0) { toast("Cargo destroyed", "warn"); finishRun(run, "dnf"); }
      return true;
    }
    if (run.kind === "toll" && !run.pFinished) { run.timeLeft -= dt; if (run.timeLeft <= 0) { toast("OUT OF TIME", "warn", 2); finishRun(run, "dnf"); return true; } }
    // ---- races: gates for the player
    const gates = run.route.gates; const L = run.route.pts;
    if (run.gate < gates.length && !run.pFinished) {
      let hitG = -1; for (let k = run.gate; k < Math.min(gates.length, run.gate + 3); k++) { const gp = L[gates[k]]; if (Math.hypot(gp.x - P.x, gp.z - P.z) < 36 && Math.abs(gp.y - P.y) < 7) hitG = k; }
      if (hitG >= 0) { run.gate = hitG + 1; if (run.kind === "toll") { run.timeLeft += run.tollBonus; toast(`TOLL PAID  +${run.tollBonus}s`, "cp", 1.2); cue("lead"); } else if (run.gate < gates.length) toast("CHECKPOINT", "cp", 0.8); if (run.gate >= gates.length) { run.pFinished = true; run.pFinT = run.t; run.finishOrder.push("p"); toast(run.finishOrder.length === 1 ? "FINISH — 1ST" : "FINISH", "go", 2); } }
      run.lap = Math.min(run.laps, 1 + Math.floor((L[Math.min(L.length - 1, gates[Math.max(0, run.gate - 1)])].s) / (run.raceLen / run.laps) + 0.001));
    }
    // ---- racers
    OTHERS.length = 0; OTHERS.push(P); for (const r of run.racers) OTHERS.push(r.v);
    const ps = playerS(run);
    for (const r of run.racers) {
      if (r.out) continue; const v = r.v;
      if (!r.finished) {
        const rs = L[Math.min(r.drv.pi, L.length - 1)].s; const gap = rs - ps; // + means the rival is ahead
        const mulRB = run.ev.type === "duel" ? clamp(1 - gap / 1600, 0.93, 1.05) : clamp(1 - gap / 700, 0.9, 1.1);
        const inp = driveInput(world, v, r.drv, OTHERS, mulRB);
        for (const t of G.traffic) { const dx = t.x - v.x, dz = t.z - v.z; if (Math.abs(dx) > 30 || Math.abs(dz) > 30) continue; const f = dx * Math.cos(v.yaw) + dz * Math.sin(v.yaw); const side = Math.abs(-dx * Math.sin(v.yaw) + dz * Math.cos(v.yaw)); if (f > 1 && f < 16 + v.speed * 0.25 && side < 2.6) { inp.brake = Math.max(inp.brake, f < 8 ? 1 : 0.4); inp.throttle *= 0.3; r.drv.off += (side < 0.5 ? 0.15 : (-dz * Math.cos(v.yaw) + dx * Math.sin(v.yaw)) > 0 ? -0.2 : 0.2); } }
        stepVehicle(world, v, inp, dt, { wet: G.wet });
        if (v.speed < 3 && run.t > 6) { r.stuckT += dt; if (r.stuckT > 5) { const p = L[Math.min(L.length - 1, r.drv.pi + 4)], q = L[Math.min(L.length - 1, r.drv.pi + 8)]; v.x = p.x; v.z = p.z; v.y = p.y; v.yaw = Math.atan2(q.z - p.z, q.x - p.x); v.vx = v.vz = 0; r.stuckT = 0; } } else r.stuckT = 0;
        if (v.drowned) { const p = L[Math.min(L.length - 1, r.drv.pi)]; v.x = p.x; v.z = p.z; v.y = p.y; v.drowned = false; v.vx = v.vz = 0; }
        if (r.drv.pi >= L.length - 4) { r.finished = true; r.finT = run.t; run.finishOrder.push(r.id); }
        r.prog = rs;
      } else { stepVehicle(world, v, { throttle: 0, brake: 0.6, steer: 0, hand: false, nos: false }, dt, { wet: G.wet }); }
    }
    // knockouts
    if (run.kind === "knockout" && run.route.cuts) {
      const cuts = run.route.cuts; const k = run.cutIdx; if (k < cuts.length) {
        const lead = Math.max(run.gate, ...run.racers.filter((r) => !r.out).map((r) => gateOf(run, r)));
        if (run.elimT <= 0 && lead >= cuts[k]) { run.elimT = 5; toast("ELIMINATION — don't be last", "warn", 3); }
        if (run.elimT > 0) { run.elimT -= dt; if (run.elimT <= 0) { run.cutIdx++; const alive = [{ p: true, prog: ps }, ...run.racers.filter((r) => !r.out && !r.finished).map((r) => ({ r, prog: r.prog }))]; alive.sort((a, b) => a.prog - b.prog); const last = alive[0]; if (last.p) { toast("YOU ARE OUT", "warn", 3); run.pFinished = true; finishRun(run, "out"); return true; } else { last.r.out = true; last.r.v.x = -999; toast(`${last.r.name} IS OUT`, "good", 2.4); } } }
      }
    }
    // end of race: everyone in, or the player done and the rest are well behind / 20 s
    if (run.pFinished) { run.after = (run.after || 0) + dt; const open = run.racers.filter((r) => !r.finished && !r.out); if (!open.length || run.after > (run.ev.type === "drag" ? 4 : 12)) { run.finishOrder = run.finishOrder; finishRun(run, "done"); } }
    return true;
  }
  function gateOf(run, r) { const gts = run.route.gates; let g = 0; while (g < gts.length && gts[g] <= r.drv.pi) g++; return g; }


  // ---- street racers and the outrun (Upgrade 38) ---------------------------------------------------------------------------------------------------
  // Named racers cruise the roads. Pull up beside one and challenge it (ENTER / L) and it is an OUTRUN: both cars race down the street, and whoever
  // opens up a big enough lead on the other (OUT.WIN_GAP metres, held for a couple of seconds) wins. The lead is measured along the racer's route.
  const racerCool = {};
  const rivalTune = (tl) => ({ ...ZERO_TUNE, engine: tl, tires: tl, nitro: tl, turbo: Math.max(0, tl - 1), gears: Math.max(0, tl - 1), brakes: Math.min(4, tl), weight: Math.max(0, tl - 2), aero: Math.max(0, tl - 3), diff: Math.max(0, tl - 3) });
  // the computer drivers see the traffic as well as the other racers, so they pull out and overtake a slow car instead of queueing behind it
  function fillOthers(self) { OTHERS.length = 0; OTHERS.push(G.player); for (const r of G.racers) if (r.v !== self) OTHERS.push(r.v); if (G.run && G.run.racers) for (const r of G.run.racers) if (r.v !== self) OTHERS.push(r.v); for (const t of G.traffic) if (Math.abs(t.x - self.x) < 45 && Math.abs(t.z - self.z) < 45) OTHERS.push(t); }
  function avoidTraffic(v, drv, inp) { // last resort: brake for a car that is right in front
    for (const t of G.traffic) { const dx = t.x - v.x, dz = t.z - v.z; if (Math.abs(dx) > 24 || Math.abs(dz) > 24) continue; const f = dx * Math.cos(v.yaw) + dz * Math.sin(v.yaw); const side = Math.abs(-dx * Math.sin(v.yaw) + dz * Math.cos(v.yaw)); if (f > 1 && f < 5 + v.speed * 0.2 && side < 1.7) { inp.brake = Math.max(inp.brake, f < 5 ? 1 : 0.5); inp.throttle *= 0.2; } }
  }
  function spawnRacer(forceDef) {
    const P = G.player; const lv = G.level(), mt = maxTier(lv);
    const live = new Set(G.racers.map((r) => r.def.id));
    const pool = forceDef ? [forceDef] : ROSTER.filter((d) => d.tier <= mt && !live.has(d.id) && (racerCool[d.id] || 0) <= G.t);
    if (!pool.length) return null;
    const wts = pool.map((d) => 1 + (d.tier === mt ? 1.2 : 0)); let pick = rnd() * wts.reduce((a, b) => a + b, 0), def = pool[0]; for (let i = 0; i < pool.length; i++) { pick -= wts[i]; if (pick <= 0) { def = pool[i]; break; } }
    const dist = OUT.SPAWN_MIN + rnd() * (OUT.SPAWN_MAX - OUT.SPAWN_MIN), a = P.yaw + (rnd() - 0.5) * 1.3; // somewhere ahead of the driver, cruising away
    const route = farRoute(city, rnd, P.x + Math.cos(a) * dist, P.z + Math.sin(a) * dist, a, 2200, 6500, 4); if (!route) return null;
    const p0 = route.pts[0]; if (Math.hypot(p0.x - P.x, p0.z - P.z) < OUT.SPAWN_MIN * 0.7) return null;
    for (const t of G.traffic) if (Math.abs(t.x - p0.x) < 45 && Math.abs(t.z - p0.z) < 45) return null; // not into a knot of traffic
    const D = difficulty(lv, def.tier), cdef = CARS.find((c) => c.id === def.car) || CARS[0];
    const q = route.pts[Math.min(4, route.pts.length - 1)], yaw = Math.atan2(q.z - p0.z, q.x - p0.x), sf = city.surfaceAt(p0.x, p0.z, p0.y);
    const v = newVehicle(p0.x, p0.z, yaw, cityStats(cdef, rivalTune(D.tl), def.look.kit || "stock"), sf ? sf.y : p0.y); v.nitro = 60; v.vx = Math.cos(yaw) * 16; v.vz = Math.sin(yaw) * 16; v.speed = v.fwd = 16;
    return { id: "rr_" + def.id, def, name: def.name, color: def.look.color, car: def.car, spec: { car: def.car, ...def.look }, tier: def.tier, v, drv: newDriver(route.pts, { base: D.base, latG: D.latG, nos: false, block: 0 }), route, stuckT: 0, age: 0, out: false, finished: false };
  }
  G.spawnRacer = (id) => { // (used by the tests) put a particular racer on the road ahead
    const def = ROSTER.find((d) => d.id === id); if (!def || G.run) return null;
    for (let k = 0; k < 8; k++) { const r = spawnRacer(def); if (r) { G.racers.push(r); return r; } } return null;
  };
  function stepRacers(dt) {
    const P = G.player; G.racerNear = null; let nd = OUT.CHALLENGE_R;
    G.racerT -= dt;
    if (G.racerT <= 0) { G.racerT = 5; if (G.racers.length < (G.level() >= 4 ? 2 : 1)) { const r = spawnRacer(); if (r) { G.racers.push(r); G.racerT = 16 + rnd() * 22; } } }
    for (let i = G.racers.length - 1; i >= 0; i--) {
      const r = G.racers[i], v = r.v; r.age += dt;
      const d = Math.hypot(v.x - P.x, v.z - P.z);
      if (d > OUT.DESPAWN || r.age > 600 || r.drv.pi >= r.route.pts.length - 8 || v.drowned) { G.racers.splice(i, 1); continue; }
      fillOthers(v); const inp = driveInput(world, v, r.drv, OTHERS, OUT.CRUISE); avoidTraffic(v, r.drv, inp);
      stepVehicle(world, v, inp, dt, { wet: G.wet });
      const hh = collideVehicles(P, v); if (hh > 1) P.hit = Math.max(P.hit, hh); trafficHits(v, false);
      if (v.speed < 2.5) { r.stuckT += dt; if (r.stuckT > 8) { G.racers.splice(i, 1); continue; } } else r.stuckT = 0;
      if (d < nd && Math.abs(v.y - P.y) < 6) { nd = d; G.racerNear = r; }
    }
    const rn = G.racerNear; if (rn && !rn.greeted) { rn.greeted = true; say(rn, "spot"); cue("rev"); }   // pulling alongside: the racer revs and says something
  }

  // ---- daily challenges, race-day bounties and the style combo (Upgrade 65) ---------------------------------------------------------------------------
  const today = () => opts.day || dayKey();
  function dailyRoll() { // start a new day's board if the date changed (and keep or break the streak)
    const key = today(), d = career.daily;
    if (d && d.day === key) { if (!d.list) d.list = pickDaily(key, G.level()); return d; }
    let streak = d ? d.streak || 0 : 0; if (d && !(d.allDone && dayNum(key) - dayNum(d.day) === 1)) streak = d && d.allDone && dayNum(key) - dayNum(d.day) === 1 ? streak : 0;
    career.daily = { day: key, list: pickDaily(key, G.level()), p: {}, done: [], allDone: false, streak, bounties: pickBounties(key, G.events), claimed: [] };
    return career.daily;
  }
  G.daily = () => dailyRoll();
  G.dailyAdd = (kind, n = 1) => {
    const d = dailyRoll(); let any = false;
    for (const c of d.list) {
      if (c.kind !== kind || d.done.includes(c.id)) continue;
      const before = d.p[c.id] || 0; const now = c.max ? Math.max(before, n) : before + n; d.p[c.id] = now; any = true;
      if (now >= c.goal) {
        d.done.push(c.id); const k = streakBonus(d.streak); const cash = Math.round(c.cash * k), xp = Math.round(c.xp * k); giveCash(cash); giveXp(xp);
        toast(`DAILY DONE ${c.icon}  ${c.text}  +${IS_TOKYO ? "¥" : "₹"}${cash.toLocaleString(IS_TOKYO ? "ja-JP" : "en-IN")} · +${xp} XP`, "good", 4.5); cue("win");
        if (d.done.length === d.list.length) { d.allDone = true; d.streak = (d.streak || 0) + 1; const b = Math.round(600 * streakBonus(d.streak - 1) * (1 + G.level() * 0.05)); giveCash(b); giveXp(120); toast(`ALL DAILIES DONE  +${IS_TOKYO ? "¥" : "₹"}${b.toLocaleString(IS_TOKYO ? "ja-JP" : "en-IN")} · STREAK ${d.streak} DAY${d.streak === 1 ? "" : "S"}`, "level", 5.5); if (G.hooks.onSave) G.hooks.onSave(career); }
      }
    }
    return any;
  };
  G.bounties = () => { const d = dailyRoll(); return d.bounties.map((id) => { const e = G.eventById[id]; return e ? { id, name: e.name, area: e.area, type: e.type, cash: Math.round(e.reward.cash * BOUNTY.CASH), claimed: d.claimed.includes(id) } : null; }).filter(Boolean); };
  function claimBounty(ev, res) {
    const d = dailyRoll(); if (!d.bounties.includes(ev.id) || d.claimed.includes(ev.id)) return;
    d.claimed.push(ev.id); const cash = Math.round(ev.reward.cash * BOUNTY.CASH), xp = Math.round(ev.reward.xp * BOUNTY.XP); giveCash(cash); giveXp(xp); res.bounty = { cash, xp };
    toast(`RACE-DAY BOUNTY  +${IS_TOKYO ? "¥" : "₹"}${cash.toLocaleString(IS_TOKYO ? "ja-JP" : "en-IN")} · +${xp} XP`, "good", 4.5); cue("win");
  }
  // the style combo: moves feed the bank; the multiplier grows with the length of the chain
  const Cb = G.combo = { pts: 0, moves: 0, idle: 0, mult: 1, last: null, flash: 0 };
  G._claimBounty = claimBounty;
  function comboMove(pts, label) { Cb.pts += pts; Cb.moves++; Cb.idle = 0; Cb.mult = comboMult(Cb.moves); Cb.last = label; Cb.flash = 1.2; }
  function comboBank() {
    const total = Math.round(Cb.pts * Cb.mult);
    if (total >= 150) {
      const cash = Math.round(total * COMBO.PAY_CASH), xp = Math.round(total * COMBO.PAY_XP); giveCash(cash); giveXp(xp); career.combos.best = Math.max(career.combos.best || 0, total); career.combos.paid = (career.combos.paid || 0) + cash;
      toast(`STYLE BANKED  ${total.toLocaleString("en-US")} pts · ×${Cb.mult}  +${IS_TOKYO ? "¥" : "₹"}${cash.toLocaleString(IS_TOKYO ? "ja-JP" : "en-IN")}`, "good", 3.5); cue("lead"); G.dailyAdd("combo", total);
    }
    Cb.pts = 0; Cb.moves = 0; Cb.mult = 1; Cb.idle = 0; Cb.last = null;
  }
  G.comboLose = () => { if (Cb.pts > 0) { toast("COMBO LOST", "warn", 1.8); } Cb.pts = 0; Cb.moves = 0; Cb.mult = 1; Cb.idle = 0; Cb.last = null; };
  function stepStyle(dt) {
    const P = G.player; if (G.run || G.state !== "roam" || G.copsOff) { if (Cb.pts) G.comboLose(); return; }
    Cb.flash = Math.max(0, Cb.flash - dt);
    if (P.hit > 6) { G.comboLose(); return; }
    let fed = false;
    if (P.drifting && P.speed > 12) { Cb.pts += dt * P.speed * COMBO.DRIFT_RATE; Cb.idle = 0; fed = true; Hd.m = (Hd.m || 0) + dt * P.speed; if (Hd.m >= 40) { comboMove(0, "DRIFT"); Hd.m -= 40; } G.dailyAdd("drift", dt * P.speed); sbAdd(dt * 0.035); }
    else if (P.speed > COMBO.FAST_SPEED) { Cb.pts += dt * COMBO.FAST_RATE; Cb.idle = Math.min(Cb.idle, COMBO.IDLE - 1.2); fed = true; }
    if (!fed && Cb.pts > 0) { Cb.idle += dt; if (Cb.idle >= COMBO.IDLE) comboBank(); }
  }
  const Hd = {};

  // ---- police pursuit (Upgrade 64) ---------------------------------------------------------------------------------------------------------------------
  const Hh = G.heat;
  const copTune = (l) => rivalTune(Math.min(5, l + 2));
  G.heatReset = () => { Hh.hide = 0; Hh.hideIn = false; G.cops.length = 0; G.spikes.length = 0; if (G.heli) G.heli.on = false; if (G.player && G.player.spiked) { G.player.spiked = 0; G.restat(); } Hh.pts = 0; Hh.lvl = 0; Hh.peak = 0; Hh.hidden = 0; Hh.bust = 0; };
  function copPlan(c) { // a fresh road route from the patrol car to wherever the driver is now
    const P = G.player; const a = city.nearestNode(c.v.x, c.v.z, 90, 90), b = city.nearestNode(P.x, P.z, 160, 160); if (!a || !b) return false;
    const path = a === b ? null : city.route(a, b); if (!path || !path.length) return false;
    const pts = city.routePoints(path).map((p) => ({ x: p.x, z: p.z, y: p.y, s: 0 })); let s = 0; for (let i = 1; i < pts.length; i++) { s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z); pts[i].s = s; }
    if (pts.length < 3) return false; c.drv = newDriver(pts, { base: Math.min(1.02, 0.84 + 0.04 * Hh.lvl), latG: 1.0 + 0.05 * Hh.lvl, nos: Hh.lvl >= 3, block: 0 }); return true;
  }
  function spawnCop() {
    const P = G.player; const behind = P.yaw + Math.PI + (rnd() - 0.5) * 1.6, dist = HEAT.SPAWN_MIN + rnd() * (HEAT.SPAWN_MAX - HEAT.SPAWN_MIN);
    const n = city.nearestNode(P.x + Math.cos(behind) * dist, P.z + Math.sin(behind) * dist, 160, 160); if (!n) return null;
    if (Math.hypot(n.x - P.x, n.z - P.z) < HEAT.SPAWN_MIN * 0.8) return null;
    const cdef = CARS.find((c) => c.id === "stinger") || CARS[0]; const sf = city.surfaceAt(n.x, n.z, n.y);
    const yaw = Math.atan2(P.z - n.z, P.x - n.x);
    const v = newVehicle(n.x, n.z, yaw, cityStats(cdef, copTune(Hh.lvl), "stock"), sf ? sf.y : (n.y || 0)); v.nitro = 80; v.vx = Math.cos(yaw) * 18; v.vz = Math.sin(yaw) * 18; v.speed = v.fwd = 18;
    const c = { id: "cop_" + G.tid++, cop: true, name: "Patrol", car: cdef.id, color: COP_LOOK.color, spec: { car: cdef.id, ...COP_LOOK }, v, drv: null, age: 0, stuckT: 0, ramT: 0, out: false };
    if (!copPlan(c)) return null; return c;
  }
  function addHeat(p) { if (G.copsOff || G.run) return; Hh.pts += p; }
  G.addHeat = addHeat;

  // ---- pursuit tools: roadblocks, spike strips, the helicopter, and Speedbreaker (Upgrade 67) ----------------------------------------------------------------
  G.spikes = []; G.heli = { on: false, x: 0, z: 0, y: 60, d: 999, rot: 0 };
  const SB = G.sb = { meter: 0, active: false, left: 0, scale: 1 };
  function sbAdd(n) { if (!SB.active) SB.meter = Math.min(1, SB.meter + n); }
  G.speedbreaker = () => { if (SB.active || SB.meter < 0.5 || G.state !== "roam" || G.pause) return false; SB.active = true; SB.left = 2 + SB.meter * 6; SB.meter = 0; cue("tick"); toast("SPEEDBREAKER", "go", 1.2); return true; };
  function roadAhead(dist, jitter = 40) {
    const P = G.player; const sp = Math.hypot(P.vx, P.vz); const dx = sp > 4 ? P.vx / sp : Math.cos(P.yaw), dz = sp > 4 ? P.vz / sp : Math.sin(P.yaw);
    const T = { x: P.x + dx * dist + (rnd() - 0.5) * jitter, z: P.z + dz * dist + (rnd() - 0.5) * jitter };
    const n = city.nearestRoad(T.x, T.z, 150, null, P.y); if (!n) return null;
    { const fx = n.x - P.x, fz = n.z - P.z, fl = Math.hypot(fx, fz) || 1; if ((fx * dx + fz * dz) / fl < 0.55) return null; } // it has to be in front of the car
    const r = n.road, a = r.pts[n.i], b = r.pts[Math.min(n.i + 1, r.pts.length - 1)]; const yaw = Math.atan2(b.z - a.z, b.x - a.x); const px = n.x, pz = n.z;
    if (Math.hypot(px - P.x, pz - P.z) < dist * 0.6 || Math.abs((n.y || 0) - P.y) > 4) return null; return { px, pz, yaw, y: n.y || 0, w: n.w || 8 };
  }
  G._roadAhead = roadAhead; G._spawnRb = () => spawnRoadblock(); G._spawnSp = () => spawnSpikes();
  function spawnRoadblock() {
    const w = roadAhead(240 + rnd() * 60); if (!w) return false; const cdef = CARS.find((c) => c.id === "stinger") || CARS[0];
    const sx = -Math.sin(w.yaw), sz = Math.cos(w.yaw);
    const half = Math.max(2.4, w.w * 0.3); for (const off of [-half, half]) { const x = w.px + sx * off, z = w.pz + sz * off; const sf = city.surfaceAt(x, z, w.y);
      const v = newVehicle(x, z, w.yaw + Math.PI / 2 + (off > 0 ? 0.12 : -0.12), cityStats(cdef, ZERO_TUNE, "stock"), sf ? sf.y : w.y); v.vx = v.vz = 0; v.speed = v.fwd = 0;
      G.cops.push({ id: "blk_" + G.tid++, cop: true, block: true, name: "Roadblock", car: cdef.id, color: COP_LOOK.color, spec: { car: cdef.id, ...COP_LOOK }, v, px: x, pz: z, age: 0, out: false }); }
    toast("ROADBLOCK AHEAD", "warn", 2.2); cue("siren"); return true;
  }
  function spawnSpikes() { const w = roadAhead(200 + rnd() * 60); if (!w) return false; G.spikes.push({ id: "sp_" + G.tid++, x: w.px, z: w.pz, y: w.y, yaw: w.yaw, hit: false, age: 0 }); toast("SPIKE STRIP AHEAD", "warn", 2); return true; }

  // ---- pursuit breakers (Upgrade 68): objects beside the road that you can bring down on the police ---------------------------------------------------------
  G.breakers = [];
  { const br = mulberry((opts.seed || 1) * 131 + 7); const roads = city.roads.filter((r) => r.cls !== "hwy" && r.ground !== false && r.pts.length > 14); const kinds = ["containers", "tower", "sign"]; let tries = 0;
    while (G.breakers.length < 26 && roads.length && tries++ < 500) {
      const r = roads[Math.floor(br() * roads.length)]; const i = 3 + Math.floor(br() * (r.pts.length - 7)); const a = r.pts[i], b = r.pts[i + 1]; if (!a || !b) continue;
      if (Math.hypot(b.x - a.x, b.z - a.z) < 0.5) continue; const yaw = Math.atan2(b.z - a.z, b.x - a.x), side = br() < 0.5 ? -1 : 1; const nx = -Math.sin(yaw) * side, nz = Math.cos(yaw) * side; const off = (a.w || 8) / 2 + 4.2;
      const x = a.x + nx * off, z = a.z + nz * off; if (G.breakers.some((q) => Math.hypot(q.x - x, q.z - z) < 180)) continue;
      G.breakers.push({ id: "pb" + G.breakers.length, x, z, y: a.y || 0, rx: a.x, rz: a.z, ry: Math.atan2(-nx, -nz), kind: kinds[G.breakers.length % 3], state: "ready", t: 0, kills: 0 });
    } }
  function stepBreakers(dt, P) {
    let near = null, nd = 1e9;
    for (const b of G.breakers) {
      if (b.state === "down") { b.t += dt; if (b.t > 110) { b.state = "ready"; b.t = 0; b.kills = 0; } else if (b.t < 7) { // the wreck on the road stops any patrol car that reaches it
          for (const c of G.cops) { if (c.block || c.disabled) continue; if (Math.hypot(c.v.x - b.rx, c.v.z - b.rz) < 20 && Math.abs(c.v.y - b.y) < 6) { c.disabled = 7; c.v.vx *= 0.15; c.v.vz *= 0.15; b.kills++; giveXp(40); Hh.pts = Math.max(0, Hh.pts - 35); G.cam.hit = Math.max(G.cam.hit, 0); comboMove(150, "BREAKER"); sbAdd(0.2); toast(`PURSUIT BREAKER  ·  ${b.kills} PATROL CAR${b.kills === 1 ? "" : "S"} DOWN`, "good", 2.5); cue("crash"); } } }
        continue; }
      const d = Math.hypot(P.x - b.x, P.z - b.z); const ahead = (b.x - P.x) * Math.cos(P.yaw) + (b.z - P.z) * Math.sin(P.yaw);
      if (Hh.lvl > 0 && d < 240 && ahead > 0 && d < nd) { nd = d; near = b; }
      const chasers = G.cops.some((c) => !c.block && !c.disabled && Math.hypot(c.v.x - P.x, c.v.z - P.z) < 90);
      if (Hh.lvl > 0 && chasers && d < 20 && P.speed > 20 && Math.abs(P.y - b.y) < 5) { b.state = "down"; b.t = 0; b.kills = 0; cue("crash"); toast("BREAKER DOWN", "go", 1.2); }
    }
    Hh.brk = near ? Math.round(nd) : null;
  }
  function stepTools(dt, P) {
    stepBreakers(dt, P);
    // speedbreaker slows the world and sharpens the steering for a few seconds
    if (SB.active) { SB.left -= dt; SB.scale = 0.42; if (SB.left <= 0) { SB.active = false; SB.scale = 1; G.restat(); } } else SB.scale = 1;
    if (Hh.lvl >= 3 && P.speed > 30) SB.meter = Math.min(1, SB.meter + dt * 0.012); // a hot pursuit slowly charges it
    const lv = Hh.lvl;
    if (lv >= 3 && Hh.hidden < 1) { Hh.blockT = (Hh.blockT == null ? 12 : Hh.blockT) - dt; if (Hh.blockT <= 0) { Hh.blockT = 26 - lv * 2; if (G.cops.filter((c) => c.block).length < 2) spawnRoadblock(); } } else Hh.blockT = null;
    if (lv >= 2 && Hh.hidden < 1) { Hh.spikeT = (Hh.spikeT == null ? 18 : Hh.spikeT) - dt; if (Hh.spikeT <= 0) { Hh.spikeT = 30 - lv * 3; if (G.spikes.length < 2) spawnSpikes(); } } else Hh.spikeT = null;
    if (P.spiked > 0) { P.spiked -= dt; if (P.spiked <= 0) { P.spiked = 0; G.restat(); toast("TYRES RECOVERED", "info", 1.5); } }
    for (let i = G.spikes.length - 1; i >= 0; i--) {
      const k = G.spikes[i]; k.age += dt; const d = Math.hypot(P.x - k.x, P.z - k.z);
      if (!k.hit && d < 4.6 && Math.abs(P.y - k.y) < 3) { k.hit = true; if (!P.spiked) { P.spiked = 7; const b = stats(); P.stats = { ...b, grip: b.grip * 0.55, vmax: b.vmax * 0.72, yaw: b.yaw * 0.85 }; P.vx *= 0.8; P.vz *= 0.8; G.cam.hit = Math.max(G.cam.hit, 6); toast("TYRES SHREDDED", "warn", 2.5); cue("lose"); addHeat(10); } }
      if (k.age > 60 || d > 380 || Hh.lvl === 0) G.spikes.splice(i, 1);
    }
    // helicopter: joins at 4 stars, keeps a spotlight on you, and cannot be shaken until you hide under cover (a tunnel) or it loses you
    const H = G.heli; const want = lv >= 4;
    if (want && !H.on) { H.on = true; const a = P.yaw + Math.PI + (rnd() - 0.5); H.x = P.x + Math.cos(a) * 180; H.z = P.z + Math.sin(a) * 180; toast("HELICOPTER ON YOUR TAIL", "warn", 2.5); cue("siren"); }
    if (!want && H.on && (lv === 0 || Hh.hidden > 2)) H.on = false;
    if (H.on) {
      const tun = !!(P.surfRoad && P.surfRoad.tunnel); const tx = tun ? H.x : P.x + P.vx * 0.6, tz = tun ? H.z : P.z + P.vz * 0.6; const dx = tx - H.x, dz = tz - H.z, dd = Math.hypot(dx, dz) || 1; const sp = Math.min(dd * 1.1, tun ? 6 : 62);
      H.x += (dx / dd) * sp * dt; H.z += (dz / dd) * sp * dt; H.d = Math.hypot(P.x - H.x, P.z - H.z); H.y = 55; H.rot = (H.rot + dt * 26) % (Math.PI * 2);
    } else H.d = 999;
  }
  function stepPursuit(dt) {
    const P = G.player; const roam = G.state === "roam" && !G.run && !G.copsOff;
    if (!roam) { if (G.cops.length || Hh.pts) G.heatReset(); return; }
    // what raises the heat
    if (P.speed > HEAT.SPEEDING) addHeat(dt * HEAT.SPEED_PTS * (1 + (P.speed - HEAT.SPEEDING) / 30));
    if (P.hit > 6 && !Hh.hitCool) { addHeat(HEAT.HIT_PTS); Hh.hitCool = 1.2; }
    if (Hh.hitCool) { Hh.hitCool -= dt; if (Hh.hitCool <= 0) Hh.hitCool = 0; }
    const was = Hh.lvl; Hh.lvl = heatLevel(Hh.pts); Hh.peak = Math.max(Hh.peak, Hh.lvl);
    if (Hh.lvl > was && Hh.lvl >= 1) { toast(`HEAT ${"★".repeat(Hh.lvl)} · ${Hh.lvl === 1 ? "POLICE HAVE SPOTTED YOU" : "MORE PATROL CARS ARE COMING"}`, "warn", 3); cue("siren"); }
    stepTools(dt, P);
    const alive = G.cops.filter((c) => !c.block && !c.disabled).length;
    // patrol cars join the chase
    Hh.spawnT = (Hh.spawnT || 0) - dt;
    if (Hh.lvl > 0 && Hh.hidden < 1 && alive < HEAT.COPS[Hh.lvl] && Hh.spawnT <= 0) { Hh.spawnT = 3.5; const c = spawnCop(); if (c) G.cops.push(c); }
    // drive them
    let nearest = 1e9; Hh.near = null;
    for (let i = G.cops.length - 1; i >= 0; i--) {
      const c = G.cops[i], v = c.v; c.age += dt;
      const d = Math.hypot(v.x - P.x, v.z - P.z);
      if (c.disabled > 0) { // wrecked by a pursuit breaker: stuck for a few seconds, then gone
        c.disabled -= dt; stepVehicle(world, v, { throttle: 0, brake: 1, steer: 0, hand: true, nos: false }, dt, { wet: G.wet }); const hw = collideVehicles(P, v); if (hw > 1) P.hit = Math.max(P.hit, hw);
        if (c.disabled <= 0) G.cops.splice(i, 1); continue;
      }
      if (c.block) { // a roadblock car: parked across the road, it never moves
        v.vx = v.vz = 0; v.speed = v.fwd = 0; v.x = c.px; v.z = c.pz; const hb = collideVehicles(P, v); v.vx = v.vz = 0; v.x = c.px; v.z = c.pz;
        if (hb > 1) { P.hit = Math.max(P.hit, hb); if (!c.hitT) { c.hitT = 1; G.cam.hit = Math.max(G.cam.hit, hb); addHeat(HEAT.HIT_PTS * 0.5); } }
        if (c.hitT) c.hitT = Math.max(0, c.hitT - dt);
        const ahead = (c.px - P.x) * Math.cos(P.yaw) + (c.pz - P.z) * Math.sin(P.yaw);
        if (!c.passed && ahead < -6 && d < 30) { c.passed = true; if (!c.hit1 && hb <= 1) { giveXp(15); toast("ROADBLOCK CLEARED", "good", 1.8); comboMove(100, "ROADBLOCK"); sbAdd(0.2); } }
        c.age += dt; if (c.age > 50 || (ahead < -70) || Hh.lvl === 0) G.cops.splice(i, 1);
        continue;
      }
      if (d < nearest) { nearest = d; Hh.near = c; }
      if ((Hh.lvl === 0 && (d > 110 || c.age > 40)) || d > HEAT.DESPAWN * 1.6 || v.drowned) { G.cops.splice(i, 1); continue; }
      
      c.rp = (c.rp || 0) - dt; if (!c.drv || c.rp <= 0 || c.drv.pi >= c.drv.route.length - 6) { c.rp = d < 70 ? 0.9 : HEAT.REPLAN; if (!copPlan(c) && !c.drv) { G.cops.splice(i, 1); continue; } }
      fillOthers(v); const inp = driveInput(world, v, c.drv, OTHERS, Hh.lvl > 0 ? 1.0 + 0.03 * Hh.lvl + clamp((d - 60) / 300, 0, 0.22) : 0.55); avoidTraffic(v, c.drv, inp);
      if (d < 22 && Hh.lvl >= 2) { // close in and push: steer straight at the car for a ram
        const ang = Math.atan2(P.z - v.z, P.x - v.x), diff = wrapPi(ang - v.yaw); inp.steer = clamp(diff * 1.6, -1, 1); inp.throttle = 1; inp.brake = 0;
      }
      stepVehicle(world, v, inp, dt, { wet: G.wet });
      const hh = collideVehicles(P, v); if (hh > 1) { P.hit = Math.max(P.hit, hh); if (hh > 2.5 && !c.ramT) { c.ramT = 1.5; addHeat(HEAT.RAM_PTS); G.cam.hit = Math.max(G.cam.hit, hh); } }
      if (c.ramT) { c.ramT -= dt; if (c.ramT < 0) c.ramT = 0; }
      trafficHits(v, false);
      if (v.speed < 2.5) { c.stuckT += dt; if (c.stuckT > 6) { c.drv = null; c.stuckT = 0; if (c.age > 12 && d > 60) { G.cops.splice(i, 1); continue; } } } else c.stuckT = 0;
    }
    Hh.dist = nearest < 1e8 ? Math.round(nearest) : null;
    // busted: boxed in, almost stopped
    const close = !Hh.hideIn && G.cops.some((c) => !c.block && !c.disabled && Math.hypot(c.v.x - P.x, c.v.z - P.z) < HEAT.BUST_R);
    if (Hh.lvl > 0 && close && P.speed < HEAT.BUST_SPEED) Hh.bust = Math.min(1, Hh.bust + dt / HEAT.BUST_TIME); else Hh.bust = Math.max(0, Hh.bust - dt * 0.5);
    if (Hh.bust >= 1) {
      const peak = Math.max(1, Hh.peak), fine = fineFor(peak, Math.max(career.earned || 0, career.cash), career.cash); career.cash -= fine; career.busted = (career.busted || 0) + 1;
      toast(`BUSTED!  −${IS_TOKYO ? "¥" : "₹"}${fine.toLocaleString(IS_TOKYO ? "ja-JP" : "en-IN")}`, "warn", 4); cue("lose"); G.heatReset(); respawn(false); G.traffic.length = 0; return;
    }
    // hideout (Upgrade 68): any garage you have found is a safe place. Pull in beside it and hold still and the police lose you.
    { const found = GARS.filter((g) => career.garages.includes(g.id)); let bg = null, bd = 1e9; for (const g of found) { const dd = Math.hypot(g.x - P.x, g.z - P.z); if (dd < bd) { bd = dd; bg = g; } }
      Hh.hideNear = bg && Hh.lvl > 0 && bd < 450 ? { name: bg.name, d: Math.round(bd) } : null;
      Hh.hideIn = !!(bg && Hh.lvl > 0 && bd < 26 && P.speed < 18 && Math.abs((bg.y ?? 0) - P.y) < 9);
      if (Hh.hideIn) { Hh.hide = (Hh.hide || 0) + dt; Hh.bust = Math.max(0, Hh.bust - dt); if (Hh.hide >= 2.5) { const b = bountyFor(Math.max(1, Hh.peak), G.level()); const cash = Math.round(b.cash * 0.6), xp = Math.round(b.xp * 0.6); giveCash(cash); giveXp(xp); career.hideouts = (career.hideouts || 0) + 1; G.dailyAdd("escape", 1);
          toast(`HIDEOUT  ·  YOU LOST THEM  +${IS_TOKYO ? "¥" : "₹"}${cash.toLocaleString(IS_TOKYO ? "ja-JP" : "en-IN")} · +${xp} XP`, "good", 4.5); cue("win"); G.cops.length = 0; G.spikes.length = 0; if (G.heli) G.heli.on = false; Hh.pts = 0; Hh.lvl = 0; Hh.peak = 0; Hh.hidden = 0; Hh.hide = 0; Hh.bust = 0; return; } }
      else Hh.hide = 0; }
    // escaped: far away, and the heat has drained
    if (Hh.lvl > 0) {
      const chasing = G.cops.some((c) => !c.block && !c.disabled); const heliOn = G.heli && G.heli.on && G.heli.d < 170 && !(P.surfRoad && P.surfRoad.tunnel); const gone = (!chasing || nearest > HEAT.ESCAPE_DIST) && !heliOn;
      if (gone) { Hh.hidden += dt; Hh.pts = Math.max(0, Hh.pts - dt * HEAT.DECAY * 2); } else { Hh.hidden = 0; }
      if (Hh.hidden >= HEAT.ESCAPE_TIME) {
        const b = bountyFor(Math.max(1, Hh.peak), G.level()); giveCash(b.cash); giveXp(b.xp); career.escapes = (career.escapes || 0) + 1; G.dailyAdd("escape", 1); comboMove(COMBO.ESCAPE, "ESCAPED"); P.nitro = Math.min(100, P.nitro + 40);
        toast(`ESCAPED!  +${IS_TOKYO ? "¥" : "₹"}${b.cash.toLocaleString(IS_TOKYO ? "ja-JP" : "en-IN")} BOUNTY · +${b.xp} XP`, "good", 4.5); cue("win"); G.cops.length = 0; Hh.pts = 0; Hh.lvl = 0; Hh.peak = 0; Hh.hidden = 0;
      }
    } else if (Hh.pts > 0) Hh.pts = Math.max(0, Hh.pts - dt * HEAT.DECAY);
  }
  G.stepPursuit = stepPursuit;
  G.racerTo = (r) => { const P = G.player, dx = r.v.x - P.x, dz = r.v.z - P.z; return { d: Math.hypot(dx, dz), ahead: dx * Math.cos(P.yaw) + dz * Math.sin(P.yaw), right: -dx * Math.sin(P.yaw) + dz * Math.cos(P.yaw) }; };
  G.startOutrun = () => {
    const r = G.racerNear; if (!r || G.run || G.state !== "roam") return false;
    const P = G.player, lv = G.level(), D = difficulty(lv, r.tier);
    let route = tailRoute(r.route, Math.max(0, r.drv.pi - 2));
    if (route.len < 1800) { const nr = farRoute(city, rnd, r.v.x, r.v.z, r.v.yaw, 2000, 6500, 6); if (nr) route = nr; }
    if (route.len < 900) { toast("Not enough road ahead for an outrun. Try again further on", "warn", 2.5); return false; }
    // a racer whose car is better than yours drives a little more gently (and a worse one a little harder), so the tier sets the difficulty and not the car it happens to own
    const adj = clamp(carRating(P.stats) / Math.max(60, carRating(r.v.stats)), 0.88, 1.12);
    r.route = route; r.drv = newDriver(route.pts, { base: clamp(D.base * adj, 0.7, 1.04), latG: D.latG, nos: true, block: 0 }); r.stuckT = 0;
    const ev = { id: "outrun:" + r.def.id, type: "outrun", name: `OUTRUN · ${r.name}`, level: lv, reward: { cash: 0, xp: 0, pts: 0 } };
    G.racers.length = 0; G.traffic = G.traffic.filter((t) => Math.hypot(t.x - r.v.x, t.z - r.v.z) > 24 && Math.hypot(t.x - P.x, t.z - P.z) > 24); // a clear road at the start
    const run = { ev, kind: "outrun", state: "go", cd: 0, t: 0, lights: OUT.LIGHTS, live: false, route, racers: [r], rival: r, player: P, lead: 0, hold: 0, holdSide: 0, pIdx: 0, rIdx: 0, timeLeft: OUT.TIME, gate: 0, laps: 1, finishOrder: [], raceLen: route.len, front: 0, lc: 99, saidT: 2, said: {}, closeT: 0, rnos: false };
    const end = route.pts[route.pts.length - 1];
    G.run = run; G.state = "event"; G.result = null; G.nav = { target: { x: end.x, z: end.z }, line: route.pts, event: true };
    say(r, "taunt", { text: r.def.taunt, ttl: 5.2, kind: "taunt" }); cue("challenge");
    return true;
  };
  function stepOutrun(run, dt) {
    const P = G.player, r = run.rival, v = r.v, L = run.route.pts;
    run.t += dt;
    if (!run.live) { run.lights -= dt; const lc = Math.ceil(run.lights); if (lc !== run.lc && lc > 0) { run.lc = lc; cue("tick"); } if (run.lights <= 0) { run.live = true; run.t = 0; toast("GO!", "go", 1.2); cue("go"); say(r, "go"); run.saidT = 5; } }
    // where each of us is along the road, and so who is in front
    const pp = projectOnRoute(L, run.pIdx, P.x, P.z); run.pIdx = pp.i; run.pOff = pp.d;
    const rp = projectOnRoute(L, run.rIdx, v.x, v.z); run.rIdx = rp.i; r.drv.pi = Math.max(r.drv.pi, 0);
    run.lead = pp.s - rp.s;
    // the racer drives: cruising until the lights go out, then flat out, easing off when it is ahead and pushing when it is behind
    const mul = !run.live ? OUT.CRUISE : clamp(1 + run.lead / 900, 0.88, 1.08);
    fillOthers(v);
    const inp = driveInput(world, v, r.drv, OTHERS, mul); avoidTraffic(v, r.drv, inp);
    stepVehicle(world, v, inp, dt, { wet: G.wet });
    if (v.speed < 3 && run.t > 4) { r.stuckT += dt; if (r.stuckT > 4) { const a = L[Math.min(L.length - 1, r.drv.pi + 4)], b = L[Math.min(L.length - 1, r.drv.pi + 8)]; v.x = a.x; v.z = a.z; v.y = a.y; v.yaw = Math.atan2(b.z - a.z, b.x - a.x); v.vx = v.vz = 0; r.stuckT = 0; } } else r.stuckT = 0;
    if (v.drowned) { const a = L[Math.min(L.length - 1, r.drv.pi)]; v.x = a.x; v.z = a.z; v.y = a.y; v.drowned = false; v.vx = v.vz = 0; }
    if (garaged) garageScan(); // a garage can still be found while racing past it
    if (!run.live) return true;
    run.timeLeft -= dt;
    { // the radio: who is in front changes, it gets close, you crash, the racer lights the nitrous (never more than a line every few seconds)
      run.saidT = Math.max(0, run.saidT - dt);
      const front = run.lead > 30 ? 1 : run.lead < -30 ? -1 : 0;
      if (front && front !== run.front) { const swap = run.front !== 0; run.front = front; if (swap) cue(front > 0 ? "lead" : "lost"); if (run.saidT <= 0 || swap) { say(r, front > 0 ? "behind" : "ahead"); run.saidT = 7; } }
      if (run.t > 12 && Math.abs(run.lead) < 18) { run.closeT += dt; if (run.closeT > 5 && run.saidT <= 0 && G.t - (run.said.close || -99) > 25) { say(r, "close"); run.said.close = G.t; run.saidT = 8; run.closeT = 0; } } else run.closeT = 0;
      if (P.hit > 6 && run.saidT <= 3 && G.t - (run.said.crash || -99) > 14) { say(r, "crash"); run.said.crash = G.t; run.saidT = 6; }
      if (v.nos && !run.rnos) { run.rnos = true; if (run.saidT <= 2 && G.t - (run.said.nos || -99) > 30) { say(r, "nos"); run.said.nos = G.t; run.saidT = 6; } } else if (!v.nos) run.rnos = false;
    }
    const side = run.lead >= OUT.WIN_GAP ? 1 : run.lead <= -OUT.WIN_GAP ? -1 : 0;
    if (side && side === run.holdSide) run.hold += dt; else { run.hold = 0; run.holdSide = side; }
    if (side && run.hold >= OUT.HOLD) finishOutrun(run, side > 0 ? "win" : "lose");
    else if (rp.i >= L.length - 4 || pp.i >= L.length - 4) finishOutrun(run, run.lead >= 0 ? "win" : "lose");
    else if (run.timeLeft <= 0) { toast("Time is up: whoever is in front wins", "warn", 2.5); finishOutrun(run, run.lead > 0 ? "win" : "lose"); }
    return true;
  }
  function finishOutrun(run, outcome) {
    const r = run.rival, lv = G.level(), oc = career.outruns, won = outcome === "win";
    const res = { ev: run.ev, outcome, rows: [], time: run.t, medal: won ? "gold" : "none", reward: { cash: 0, xp: 0 }, pos: won ? 1 : 2, total: 2, win: won };
    res.outrun = { won, name: r.name, tag: r.def.tag, tier: r.tier, car: r.car, lead: Math.round(run.lead), time: run.t, line: won ? r.def.win : r.def.lose };
    if (won) {
      const first = !(oc.beaten[r.def.id] > 0), rw = rewardFor(lv, r.tier, oc.streak, first);
      res.reward = rw; res.outrun.first = first; res.outrun.streak = oc.streak + 1; giveCash(rw.cash); oc.w++; G.dailyAdd("outrun", 1); oc.streak++; oc.best = Math.max(oc.best, oc.streak); oc.beaten[r.def.id] = (oc.beaten[r.def.id] || 0) + 1; giveXp(rw.xp);
      toast(`OUTRUN WON  ·  ${r.name.toUpperCase()} BEATEN`, "level", 4); cue("win");
    } else {
      const xp = Math.round(10 + 3 * lv); res.reward = { cash: 0, xp }; oc.l++; oc.streak = 0; giveXp(xp);
      toast(`OUTRUN LOST  ·  ${r.name.toUpperCase()} GOT AWAY`, "warn", 4); cue("lose");
    }
    racerCool[r.def.id] = G.t + OUT.COOL;
    G.result = res; run.state = "done"; G.state = "result"; if (G.hooks.onSave) G.hooks.onSave(career);
  }

  // ---- roam: triggers, pickups, traps ----------------------------------------------------------------------------------------------------------
  const stashLeft = () => content.stashes.filter((s) => !career.stash.includes(s.id));
  G.stashLeft = stashLeft;
  // hidden garages: drive close to one to find it; until then it is on no map and no GPS, and only a faint signal says one is near
  function garageScan() {
    const P = G.player; G.garageHint = null;
    if (!garaged) return;
    for (const g of GARS) {
      if (career.garages.includes(g.id)) continue;
      const dx = g.x - P.x, dz = g.z - P.z; if (Math.abs(dx) > GARAGE_HINT_RADIUS || Math.abs(dz) > GARAGE_HINT_RADIUS) continue;
      if (Math.abs((g.y ?? 0) - P.y) > 9) continue; // on a flyover above it
      const d = Math.hypot(dx, dz);
      if (d < GARAGE_FIND_RADIUS) { foundGarage(g); continue; }
      if (!G.garageHint || d < G.garageHint.d) G.garageHint = { id: g.id, d };
    }
  }
  function roamTriggers(dt) {
    const P = G.player;
    // cash stashes
    for (const s of content.stashes) {
      if (career.stash.includes(s.id)) continue; if (Math.abs(s.x - P.x) > 14 || Math.abs(s.z - P.z) > 14) continue;
      if (Math.hypot(s.x - P.x, s.z - P.z) < 11 && Math.abs(s.y - P.y) < 6) { career.stash.push(s.id); const c = s.big ? 400 : 150; giveCash(c); giveXp(s.big ? 60 : 20); toast(`CASH STASH  +${IS_TOKYO ? "¥" : "₹"}${c}`, "good", 2.2); if (G.hooks.onPickup) G.hooks.onPickup(); }
    }
    // sights
    for (const s of content.sights) {
      if (career.sights.includes(s.id)) continue; if (Math.abs(s.x - P.x) > 50 || Math.abs(s.z - P.z) > 50) continue;
      if (Math.hypot(s.x - P.x, s.z - P.z) < 42) { career.sights.push(s.id); giveCash(300); giveXp(110); toast(`DISCOVERED  ${s.name}`, "level", 4); if (G.hooks.onSave) G.hooks.onSave(career); }
    }
    garageScan();
    // nearest event start / shop
    G.near = null; G.shopNear = null; let bd = 1e9;
    for (const ev of G.events) {
      if (ev.type === "trap") continue; const d = Math.hypot(ev.sx - P.x, ev.sz - P.z);
      if (d < 700 && !career.seen.includes(ev.id) && d < 160) career.seen.push(ev.id);
      if (d < 30 && Math.abs((ev.sy ?? 0) - P.y) < 8 && d < bd) { bd = d; G.near = ev; }
    }
    for (const sh of content.shops) { const d = Math.hypot(sh.x - P.x, sh.z - P.z); if (d < 800 && !career.seen.includes(sh.id) && d < 200) career.seen.push(sh.id); if (d < 30 && P.speed < 14) G.shopNear = sh; }
    if (garaged) for (const g of GARS) { if (!career.garages.includes(g.id)) continue; const d = Math.hypot(g.x - P.x, g.z - P.z); if (d < 30 && P.speed < 14 && Math.abs((g.y ?? 0) - P.y) < 9) G.shopNear = g; }
    // speed traps
    for (const ev of G.events) {
      if (ev.type !== "trap") continue; if (Math.abs(ev.x - P.x) > 30 || Math.abs(ev.z - P.z) > 30) continue;
      const d = Math.hypot(ev.x - P.x, ev.z - P.z); const key = "trap:" + ev.id; if (d < 22 && Math.abs((ev.y ?? 0) - P.y) < 6) { if (!G[key]) { G[key] = true; const kmh = Math.round(P.speed * KMH); const goals = ev.goals; const m = kmh >= goals[2] ? "gold" : kmh >= goals[1] ? "silver" : kmh >= goals[0] ? "bronze" : "none"; career.topSpeed = Math.max(career.topSpeed, kmh); G.flash = { text: `${kmh} km/h`, t: 2 }; if (m !== "none") { const old = career.done[ev.id]; if (!old || medalRank(m) > medalRank(old.medal) || kmh > (old.best || 0)) { const r = award(ev, m, { best: kmh }); toast(`SPEED CAMERA  ${kmh} km/h  ${m.toUpperCase()}${r.cash ? "  +" + (IS_TOKYO ? "¥" : "₹") + r.cash : ""}`, "good", 3); } else toast(`SPEED CAMERA  ${kmh} km/h`, "info", 2); } else toast(`SPEED CAMERA  ${kmh} km/h — need ${goals[0]}`, "info", 2.4); } } else if (G[key] && d > 60) G[key] = false;
    }
  }
  G.startNear = () => { if (G.near && G.state === "roam") return G.startEvent(G.near.id); return false; };

  // ---- collisions with the traffic -------------------------------------------------------------------------------------------------------------
  function trafficHits(v, isPlayer) {
    let worst = 0;
    for (const t of G.traffic) {
      const dx = t.x - v.x, dz = t.z - v.z; if (dx > 14 || dx < -14 || dz > 14 || dz < -14) continue;
      if (t.wreck > 0) { const h = collideVehicles(v, t, 1, t.mass * 1.4); if (h > 0) { t.vx += v.vx * 0.2; t.vz += v.vz * 0.2; worst = Math.max(worst, h); } continue; }
      const h = collideVehicles(v, t, 1, t.mass);
      if (h > 0) { worst = Math.max(worst, h); if (h > 2.5) { t.wreck = 7; if (isPlayer) { G.cam.hit = Math.max(G.cam.hit, h); } } else t.v = Math.min(t.v, t.spd * 0.5); }
    }
    return worst;
  }

  // ---- the main step ---------------------------------------------------------------------------------------------------------------------------------
  G.step = (input, dt = DT) => {
    if (G.sb && G.sb.active) { dt *= G.sb.scale; if (G.player && G.player.stats && !G.player.spiked) { const b = stats(); G.player.stats = { ...b, yaw: b.yaw * 1.5, grip: b.grip * 1.25 }; } }
    G.t += dt; career.playT += dt; msTimer -= dt; if (msTimer <= 0) { msTimer = 1.5; checkMilestones(); }
    // weather drifts between dry and wet every few minutes
    const wx = G.weather; wx.next -= dt; if (wx.next <= 0) { wx.target = wx.target > 0.5 ? 0 : (rnd() < 0.6 ? 1 : 0); wx.next = 150 + rnd() * 240; if (wx.target > 0.5) toast("Rain rolling in over the city", "info", 3); }
    wx.rain += clamp(wx.target - wx.rain, -dt / 25, dt / 25); G.wet = wx.rain > 0.3;
    for (let i = G.toasts.length - 1; i >= 0; i--) if ((G.toasts[i].ttl -= dt) <= 0) G.toasts.splice(i, 1);
    if (G.chat && (G.chat.ttl -= dt) <= 0) G.chat = null;
    if (G.flash && (G.flash.t -= dt) <= 0) G.flash = null;
    const P = G.player; const run = G.run;
    let inp = input;
    const frozen = run && (run.state === "countdown" || run.state === "done");
    if (G.state === "shop" || G.state === "result") inp = { throttle: 0, brake: 1, steer: 0, hand: true, nos: false };
    else if (frozen) inp = { throttle: 0, brake: 0, steer: 0, hand: false, nos: false };
    if (G.state !== "shop") {
      const before = { x: P.x, z: P.z };
      stepVehicle(world, P, inp, dt, { wet: G.wet, feel: true }); career.odo += Math.hypot(P.x - before.x, P.z - before.z);
      career.topSpeed = Math.max(career.topSpeed, Math.round(P.speed * KMH)); if (!G.run) { G.dailyAdd("dist", Math.hypot(P.x - before.x, P.z - before.z) / 1000); G.dailyAdd("topspeed", Math.round(P.speed * KMH)); }
      stepTraffic(dt);
      const h = trafficHits(P, true); if (h > P.hit) P.hit = h;
      if (run && run.racers) for (const r of run.racers) { if (r.out) continue; const hh = collideVehicles(P, r.v); if (hh > 1) { P.hit = Math.max(P.hit, hh); } trafficHits(r.v, false); }
      if (run && run.racers) for (let i = 0; i < run.racers.length; i++) for (let j = i + 1; j < run.racers.length; j++) if (!run.racers[i].out && !run.racers[j].out) collideVehicles(run.racers[i].v, run.racers[j].v);
      if (P.hit > 3) G.cam.hit = Math.max(G.cam.hit, P.hit);
      G.cam.hit = Math.max(0, G.cam.hit - dt * 14);
      // near misses charge the nitrous
      if (P.speed > 22) for (const t of G.traffic) { if (t.nm || t.wreck > 0) continue; const dx = t.x - P.x, dz = t.z - P.z; if (dx * dx + dz * dz < 20 && Math.abs(t.y - P.y) < 3) { t.nm = true; const rel = Math.hypot(P.vx - t.vx, P.vz - t.vz); if (rel > 14) { career.nearMiss++; P.nitro = Math.min(100, P.nitro + 6); G.nmFlash = { t: 1.2 }; comboMove(COMBO.NEAR, "NEAR MISS"); sbAdd(0.14); G.dailyAdd("nearmiss", 1); } } }
      if (G.nmFlash && (G.nmFlash.t -= dt) <= 0) G.nmFlash = null;
      // free-roam bank for drifting
      if (!run) { if (P.drifting) G.roamDrift = (G.roamDrift || 0) + dt * P.speed * 2.2; else if (G.roamDrift > 0) { G.roamDrift -= dt * 40; if (G.roamDrift < 0) G.roamDrift = 0; } }
      if (P.drowned) { respawn(true); }
    }
    if (run) stepRun(run, dt, input); else if (G.state === "roam") { roamTriggers(dt); stepRacers(dt); stepPursuit(dt); stepStyle(dt); } else { G.racerNear = null; if (G.cops.length) G.heatReset(); }
    // keep the GPS line current
    if (G.nav && !G.nav.event) { G.navT = (G.navT || 0) - dt; if (G.navT <= 0) { G.navT = 1.5; refreshNav(); } if (G.nav && G.nav.target && Math.hypot(G.nav.target.x - P.x, G.nav.target.z - P.z) < 30) { G.nav = null; toast("You have arrived", "good"); } }
    if (G.t - (G.lastSave || 0) > 25) { G.lastSave = G.t; career.pos = { x: P.x, z: P.z, yaw: P.yaw }; if (G.hooks.onSave) G.hooks.onSave(career); }
  };

  function respawn(drown = false) {
    const P = G.player; const lp = P.lastRoadPose;
    let x = lp.x, z = lp.z, yaw = lp.yaw, lastY = lp.y;
    if (G.run && G.run.route && G.run.state === "go" && G.run.kind !== "outrun") { const L = G.run.route.pts; const g = Math.max(0, G.run.gate - 1); const p = L[G.run.route.gates[g] || 0], q = L[Math.min(L.length - 1, (G.run.route.gates[g] || 0) + 4)]; x = p.x; z = p.z; lastY = p.y; yaw = Math.atan2(q.z - p.z, q.x - p.x); }
    // repeated drowning (spawn spot itself is bad) -> fall back to the nearest proper road on the ground
    if (G.t - (G.lastDrownT || -99) < 4) { const n = city.nearestRoad(P.x, P.z, 600, (r) => r.cls !== "hwy" || r.ground, null); if (n) { const r = n.road, a = r.pts[n.i], b = r.pts[Math.min(n.i + 1, r.pts.length - 1)]; x = n.px ?? a.x; z = n.pz ?? a.z; yaw = Math.atan2(b.z - a.z, b.x - a.x); } }
    if (drown) G.lastDrownT = G.t;
    const v = spawnAt(x, z, yaw, P.nitro, lastY ?? 0); v.vx = v.vz = 0; v.lastRoadPose = { x: v.x, z: v.z, yaw, y: v.y }; if (drown) { toast("Back on the road", "warn", 2); }
    if (G.run) G.run.player = v;
  }
  G.respawn = () => { respawn(false); };
  G.reset = () => { // 'R' — put the car upright on the nearest road, facing along it
    const P = G.player; const n = city.nearestRoad(P.x, P.z, 160, (r) => true, P.y); if (!n) return respawn(false);
    const r = n.road; const a = r.pts[n.i], b = r.pts[n.i + 1]; let yaw = Math.atan2(b.z - a.z, b.x - a.x); if (Math.cos(yaw - P.yaw) < 0) yaw += Math.PI;
    const nv = spawnAt(n.px ?? n.x ?? P.x, n.pz ?? n.z ?? P.z, yaw, P.nitro, a.y); nv.vx = nv.vz = 0; if (G.run) G.run.player = nv;
  };
  G.teleport = (x, z) => {
    if (G.run) return false; const n = city.nearestRoad(x, z, 300, (r) => r.cls !== "hwy" || r.ground, null); if (!n) return false;
    const r = n.road; const a = r.pts[n.i], b = r.pts[n.i + 1]; const v = spawnAt(n.px ?? x, n.pz ?? z, Math.atan2(b.z - a.z, b.x - a.x), G.player.nitro, a.y); G.traffic.length = 0; return true;
  };
  // put the car on a named road at a point index, facing along it, already rolling at `speed` m/s (used by the intro film)
  // put the car just behind an event's start line, pointing down it, with the GPS arrow set (used by "begin your career on Palm Beach Road")
  G.goToEvent = (id) => {
    const ev = G.eventById[id]; if (!ev || G.run) return false; const yaw = ev.syaw || 0, back = 12;
    spawnAt(ev.sx - Math.cos(yaw) * back, ev.sz - Math.sin(yaw) * back, yaw, G.player.nitro, ev.sy); G.traffic.length = 0; G.setWaypoint(ev.sx, ev.sz, ev.name); return true;
  };
  G.placeOnRoad = (rid, idx, speed = 0) => {
    const r = city.roads.find((q) => q.id === rid); if (!r) return false; const i = Math.max(0, Math.min(r.pts.length - 2, Math.round(idx))); const a = r.pts[i], b = r.pts[i + 1];
    const yaw = Math.atan2(b.z - a.z, b.x - a.x); const v = spawnAt(a.x, a.z, yaw, G.player.nitro, a.y); v.vx = Math.cos(yaw) * speed; v.vz = Math.sin(yaw) * speed; G.traffic.length = 0; return true;
  };
  G.setWaypoint = (x, z, label) => { G.nav = { target: { x, z, label }, line: [], event: false }; G.navT = 0; refreshNav(); };
  G.clearWaypoint = () => { if (G.nav && !G.nav.event) G.nav = null; };
  function refreshNav() {
    const N = G.nav; if (!N || !N.target) return; const P = G.player;
    const a = city.nearestNode(P.x, P.z, 400, 400), b = city.nearestNode(N.target.x, N.target.z, 600); if (!a || !b) { N.line = []; return; }
    const path = a === b ? [] : city.route(a, b); N.line = path ? [{ x: P.x, z: P.z }, ...city.routePoints(path, 2)] : [];
  }
  G.shopOpen = () => { if (G.shopNear && G.state === "roam") { G.state = "shop"; return G.shopNear; } return null; };
  G.shopClose = () => { if (G.state === "shop") { G.state = "roam"; career.pos = { x: G.player.x, z: G.player.z, yaw: G.player.yaw }; if (G.hooks.onSave) G.hooks.onSave(career); G.restat(); } };
  G.tuneOf = tuneOf; G.upgradeLock = (id, carId) => { const t = tuneOf(carId || career.car); return upgradeLock(id, t[id] || 0); }; G.upgradeCost = (id, carId) => { const car = CARS.find((x) => x.id === (carId || career.car)) || CARS[0]; return cityUpgradeCost(car, id, tuneOf(car.id)[id] || 0); };
  G.setSetup = (id, v) => { if (!["sFinal", "sHeight", "sBias", "sWing", "sCamber"].includes(id)) return false; const tn = tuneOf(career.car); tn[id] = Math.max(-3, Math.min(3, Math.round(v))); career.levels = { ...tn }; G.restat(); if (G.hooks.onSave) G.hooks.onSave(career); return true; };
  G.buyUpgrade = (id) => { const u = CITY_UPGRADES.find((x) => x.id === id); if (!u) return false; const tn = tuneOf(career.car), lv = tn[id] || 0; if (lv >= u.max) return false; if (G.level() < upgradeLock(id, lv)) { toast(`${u.name.toUpperCase()} TIER ${lv + 1} NEEDS DRIVER LEVEL ${upgradeLock(id, lv)}`, "warn"); return false; } const c = G.upgradeCost(id); if (career.cash < c) return false; career.cash -= c; tn[id] = lv + 1; career.levels = { ...tn }; G.restat(); if (G.hooks.onSave) G.hooks.onSave(career); return true; };
  // running over people: a small fine and a trimmed drift bonus. Fines are tiny next to what a driver earns:
  // a hit costs 0.1% of lifetime earnings, a fast hit 0.25%, a death 0.4%, and all fines together never pass 1.5% of earnings.
  G.pedHit = ({ n, fast, kills }) => {
    const earned = Math.max(career.earned || 0, career.cash);
    const slow = Math.max(n - fast, 0), quick = Math.max(fast - kills, 0); // n counts everyone hit; fast and kills are subsets of it
    const want = slow * (0.001 * earned) + quick * (0.0025 * earned) + kills * (0.004 * earned);
    const room = Math.max(0, 0.015 * earned - (career.pedFines || 0));
    const fine = Math.min(Math.round(want), Math.floor(room), career.cash);
    career.cash -= fine; career.pedFines = (career.pedFines || 0) + fine;
    addHeat(HEAT.PED_PTS * Math.min(3, n)); career.pedHits = (career.pedHits || 0) + n; career.pedKills = (career.pedKills || 0) + kills;
    if (G.run && G.run.bank > 0) G.run.bank = Math.round(G.run.bank * (kills ? 0.7 : 0.9));
    const amt = fine > 0 ? `  −${IS_TOKYO ? "¥" : "₹"}${fine.toLocaleString(IS_TOKYO ? "ja-JP" : "en-IN")}` : "";
    toast(kills ? `PEDESTRIAN KILLED${amt}  · SMALL BONUS CUT` : `HIT A PEDESTRIAN${amt}`, "warn", 3);
  };
  G.spend = (n) => { if (career.cash < n) return false; career.cash -= n; return true; };
  G.pause = false;
  return G;
}
