// Midnight Burn — the game itself, with no graphics: the player, the traffic, the rival racers, every event type, rewards
// and saving. The renderer and the menus only read from it. Headless-testable.
import { newVehicle, stepVehicle, collideVehicles, newDriver, driveInput, DT, wrapPi } from "./drive";
import { buildRoute, MEDAL_PTS } from "./content";
import { makeStats, CARS, UPGRADES, heroUnlocked } from "../physics";
import { LEVEL_XP, levelOf, DRIVERS } from "../drivers";
import { CLS } from "./roads";
import { mulberry, W } from "./geo";

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const MEDALS = ["none", "bronze", "silver", "gold"];
const medalRank = (m) => MEDALS.indexOf(m || "none");
const KMH = 3.6;

export const EMPTY_CAREER = () => ({
  v: 2, cash: 1500, xp: 0, levels: { engine: 0, tires: 0, nitro: 0 }, owned: [], carsOwned: ["kestrel", "brute", "gecko"], car: "kestrel", spec: null,
  done: {}, stash: [], sights: [], seen: [], pos: null, odo: 0, playT: 0, nearMiss: 0, bestDrift: 0, topSpeed: 0, jumps: 0,
  earned: 0, pedFines: 0, // lifetime cash earned, and the little that has been paid in pedestrian fines (never more than 1.5% of it)
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
  // Hero cars (Upgrade 23): two are yours from the first minute of any career, new or old. The other eight are handed over one by one as the career levels
  // up (see CARS in physics.js) - and an older career gets every one its level has already earned the moment it loads. This only ever ADDS cars.
  if (!opts.free) { const have = new Set(career.carsOwned || []); const lv = levelOf(career.xp || 0); for (const c of CARS) if (c.hero && heroUnlocked(c, lv)) have.add(c.id); career.carsOwned = [...have]; }
  const G = { world, content, city, career, t: 0, toasts: [], state: "roam", run: null, result: null, traffic: [], nav: null, wet: false, weather: { rain: 0, target: 0, next: 120 }, near: null, shopNear: null, events: content.events, hooks: opts.hooks || {}, tid: 1, cam: { hit: 0 } };

  // ---- player ------------------------------------------------------------------------------------------------------------------
  const carDef = () => CARS.find((c) => c.id === career.car) || CARS[0];
  const stats = () => makeStats(carDef(), career.levels, career.spec ? career.spec.kit : "stock");
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
    else if (ev.type === "drift") { ev.sx = ev.x; ev.sz = ev.z; }
    else if (ev.type === "trap") { ev.sx = ev.x; ev.sz = ev.z; }
  }
  G.events = content.events.filter((e) => e.sx != null);
  G.eventById = Object.fromEntries(G.events.map((e) => [e.id, e]));

  G.level = () => levelOf(career.xp);
  G.isUnlocked = (ev) => G.level() >= ev.level && (!ev.requires || !!career.done[ev.requires]);
  G.lockReason = (ev) => (G.level() < ev.level ? `Reach level ${ev.level}` : ev.requires && !career.done[ev.requires] ? "Beat the previous driver first" : "");
  G.score = () => {
    let s = 0; for (const [id, d] of Object.entries(career.done)) s += d.pts || 0;
    return Math.round(s + career.stash.length * 30 + career.sights.length * 120 + Math.floor(career.odo / 1000) * 5 + Math.floor(career.nearMiss) * 4);
  };
  const toast = (text, kind = "info", ttl = 3.2) => { G.toasts.push({ text, kind, ttl, id: G.tid++ }); if (G.toasts.length > 5) G.toasts.shift(); if (G.hooks.onToast) G.hooks.onToast(text, kind); };
  G.toast = toast;

  function giveXp(n) {
    const before = G.level(); career.xp += Math.round(n); const after = G.level();
    if (after > before) {
      toast(`LEVEL ${after}`, "level", 4.5); if (G.hooks.onLevel) G.hooks.onLevel(after);
      if (!opts.free) for (const c of CARS) if (c.hero && c.level > before && c.level <= after && !career.carsOwned.includes(c.id)) { career.carsOwned.push(c.id); toast(`HERO CAR UNLOCKED: ${c.name.toUpperCase()} - it is in your garage`, "good", 6); }
    }
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
    if (road.cls === "art") return r < 0.12 ? "bus" : r < 0.2 ? "truck" : r < 0.38 ? "taxi" : r < 0.5 ? "rick" : "car";
    return r < 0.28 ? "rick" : r < 0.4 ? "taxi" : r < 0.45 ? "bus" : "car";
  }
  function spawnTraffic(px, pz, minD, maxD) {
    const a = rnd() * Math.PI * 2, d = minD + rnd() * (maxD - minD); const x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d;
    const n = city.nearestNode(x, z, 120, 120); if (!n || !n.edges.length) return null;
    const e = city.edges[n.edges[Math.floor(rnd() * n.edges.length)]]; const c = edgePts(e);
    if (c.len < 20) return null;
    const dir = e.a === n.id ? 1 : -1; const s = dir > 0 ? 6 : c.len - 6;
    const kind = pickKind(c.road); const K = KINDS[kind];
    const spd = CLS[c.road.cls].speed * (kind === "bus" || kind === "truck" ? 15 : kind === "rick" ? 11 : 17) * (0.85 + rnd() * 0.3);
    const t = { id: G.tid++, kind, color: kind === "taxi" ? "#f2b705" : kind === "rick" ? "#e8c600" : kind === "bus" ? "#c4262c" : kind === "truck" ? (rnd() < 0.5 ? "#3a5f8a" : "#d57a1f") : CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)], e, dir, s, spd, v: spd * 0.8, lane: c.road.cls === "hwy" ? 5.6 : c.road.cls === "art" ? 3.4 : 2.4, x: 0, z: 0, y: 0, yaw: 0, vx: 0, vz: 0, fwd: 0, speed: 0, cc: K.cc, mass: K.mass, len: K.len, braking: false, nm: false, wreck: 0, age: 0, c, hardW: c.road.width };
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
      for (const o of G.traffic) if (o !== t) scan(o); scan(P); if (G.run && G.run.racers) for (const r of G.run.racers) scan(r.v);
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
    if (!G.isUnlocked(ev)) { toast(G.lockReason(ev), "warn"); return false; }
    if (G.run) return false;
    if (ev.type === "trap") { toast("Drive through the camera as fast as you can", "info"); return false; }
    const P = G.player;
    G.traffic.length = 0;
    if (ev.type === "drift") {
      G.run = { ev, kind: "drift", state: "countdown", cd: 3, t: 0, score: 0, bank: 0, chain: 0, lastHit: 0, best: 0, timeLeft: ev.time };
      spawnAt(ev.x, ev.z, roadYaw(ev.x, ev.z), 40); G.state = "event"; return true;
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
        if (ev.type === "duel") { const d = DRIVERS.find((x) => x.id === ev.driver); cdef = CARS.find((c) => c.id === d.car.car); color = d.accent; name = d.name; spec = d.car; ai = { ...ai, ...d.ai, nos: d.ai.useNos }; lv = d.carLevel; }
        else { const pool = CARS.filter((c) => !c.locked); cdef = pool[(i + ev.level) % pool.length]; color = RACER_COLORS[(i + ev.level) % RACER_COLORS.length]; name = RACER_NAMES[(i * 3 + ev.level) % RACER_NAMES.length]; }
        const v = newVehicle(0, 0, yaw, makeStats(cdef, { engine: lv, tires: lv, nitro: lv }, spec ? spec.kit : "stock"), 0); v.nitro = 60;
        placeOnGrid(ev.type === "drag" ? 1 : i + 1, v);
        run.racers.push({ v, drv: newDriver(route.pts, ai), name, color, car: cdef.id, spec, gate: 0, finished: false, finT: 0, out: false, prog: 0, mulb: 1, stuckT: 0, id: "r" + i });
      }
    }
    if (ev.type === "delivery") { run.limit = (base.len / 31) * ev.timeMul + 18; run.timeLeft = run.limit; }
    G.run = run; G.state = "event"; G.result = null;
    G.nav = { target: { x: route.pts[route.pts.length - 1].x, z: route.pts[route.pts.length - 1].z }, line: route.pts, event: true };
    return true;
  };
  G.abortEvent = (quiet) => {
    const r = G.run; if (!r) return; G.run = null; G.state = "roam"; G.nav = null;
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
      if (res.medal !== "none") {
        res.reward = award(ev, res.medal, { best: run.t, lowerBetter: true });
        if (ev.type === "duel" && res.medal === "gold") {
          const d = DRIVERS.find((x) => x.id === ev.driver);
          if (d.unlockCar && !career.carsOwned.includes(d.unlockCar)) { career.carsOwned.push(d.unlockCar); res.unlocked = d.unlockCar; }
        }
      } else { giveCash(ev.reward.cash * 0.05); res.reward = { cash: Math.round(ev.reward.cash * 0.05), xp: 0 }; }
      res.rows = [{ name: "You", t: run.pFinT, me: true }, ...run.racers.map((r) => ({ name: r.name, t: r.finished ? r.finT : null, color: r.color }))].sort((a, b) => (a.t == null) - (b.t == null) || a.t - b.t);
    }
    res.win = res.medal !== "none";
    G.result = res; G.run.state = "done"; G.state = "result"; if (G.hooks.onSave) G.hooks.onSave(career);
  }
  G.closeResult = () => {
    const run = G.run; G.run = null; G.result = null; G.state = "roam"; G.nav = null;
    // put the player back on the road at the finish with a clean car
    if (run && run.route) { const e = run.route.pts[run.route.pts.length - 1]; const q = run.route.pts[run.route.pts.length - 4] || e; const v = spawnAt(e.x, e.z, Math.atan2(e.z - q.z, e.x - q.x), G.player.nitro); }
    else if (run && run.ev) { const v = spawnAt(run.ev.x, run.ev.z, roadYaw(run.ev.x, run.ev.z), G.player.nitro); }
  };

  const OTHERS = [];
  function stepRun(run, dt, input) {
    const P = G.player;
    if (run.state === "countdown") {
      run.cd -= dt; for (const r of run.racers) { r.v.vx = r.v.vz = 0; r.v.speed = 0; }
      P.vx = P.vz = 0; P.speed = 0; if (run.cd <= 0) { run.state = "go"; run.t = 0; toast("GO!", "go", 1.2); } return true;
    }
    if (run.state !== "go") return false;
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
    // ---- races: gates for the player
    const gates = run.route.gates; const L = run.route.pts;
    if (run.gate < gates.length && !run.pFinished) {
      let hitG = -1; for (let k = run.gate; k < Math.min(gates.length, run.gate + 3); k++) { const gp = L[gates[k]]; if (Math.hypot(gp.x - P.x, gp.z - P.z) < 36 && Math.abs(gp.y - P.y) < 7) hitG = k; }
      if (hitG >= 0) { run.gate = hitG + 1; if (run.gate < gates.length) toast("CHECKPOINT", "cp", 0.8); if (run.gate >= gates.length) { run.pFinished = true; run.pFinT = run.t; run.finishOrder.push("p"); toast(run.finishOrder.length === 1 ? "FINISH — 1ST" : "FINISH", "go", 2); } }
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

  // ---- roam: triggers, pickups, traps ----------------------------------------------------------------------------------------------------------
  const stashLeft = () => content.stashes.filter((s) => !career.stash.includes(s.id));
  G.stashLeft = stashLeft;
  function roamTriggers(dt) {
    const P = G.player;
    // cash stashes
    for (const s of content.stashes) {
      if (career.stash.includes(s.id)) continue; if (Math.abs(s.x - P.x) > 14 || Math.abs(s.z - P.z) > 14) continue;
      if (Math.hypot(s.x - P.x, s.z - P.z) < 11 && Math.abs(s.y - P.y) < 6) { career.stash.push(s.id); const c = s.big ? 400 : 150; giveCash(c); giveXp(s.big ? 60 : 20); toast(`CASH STASH  +₹${c}`, "good", 2.2); if (G.hooks.onPickup) G.hooks.onPickup(); }
    }
    // sights
    for (const s of content.sights) {
      if (career.sights.includes(s.id)) continue; if (Math.abs(s.x - P.x) > 50 || Math.abs(s.z - P.z) > 50) continue;
      if (Math.hypot(s.x - P.x, s.z - P.z) < 42) { career.sights.push(s.id); giveCash(300); giveXp(110); toast(`DISCOVERED  ${s.name}`, "level", 4); if (G.hooks.onSave) G.hooks.onSave(career); }
    }
    // nearest event start / shop
    G.near = null; G.shopNear = null; let bd = 1e9;
    for (const ev of G.events) {
      if (ev.type === "trap") continue; const d = Math.hypot(ev.sx - P.x, ev.sz - P.z);
      if (d < 700 && !career.seen.includes(ev.id) && d < 160) career.seen.push(ev.id);
      if (d < 30 && Math.abs((ev.sy ?? 0) - P.y) < 8 && d < bd) { bd = d; G.near = ev; }
    }
    for (const sh of content.shops) { const d = Math.hypot(sh.x - P.x, sh.z - P.z); if (d < 800 && !career.seen.includes(sh.id) && d < 200) career.seen.push(sh.id); if (d < 30 && P.speed < 14) G.shopNear = sh; }
    // speed traps
    for (const ev of G.events) {
      if (ev.type !== "trap") continue; if (Math.abs(ev.x - P.x) > 30 || Math.abs(ev.z - P.z) > 30) continue;
      const d = Math.hypot(ev.x - P.x, ev.z - P.z); const key = "trap:" + ev.id; if (d < 22 && Math.abs((ev.y ?? 0) - P.y) < 6) { if (!G[key]) { G[key] = true; const kmh = Math.round(P.speed * KMH); const goals = ev.goals; const m = kmh >= goals[2] ? "gold" : kmh >= goals[1] ? "silver" : kmh >= goals[0] ? "bronze" : "none"; career.topSpeed = Math.max(career.topSpeed, kmh); G.flash = { text: `${kmh} km/h`, t: 2 }; if (m !== "none") { const old = career.done[ev.id]; if (!old || medalRank(m) > medalRank(old.medal) || kmh > (old.best || 0)) { const r = award(ev, m, { best: kmh }); toast(`SPEED CAMERA  ${kmh} km/h  ${m.toUpperCase()}${r.cash ? "  +₹" + r.cash : ""}`, "good", 3); } else toast(`SPEED CAMERA  ${kmh} km/h`, "info", 2); } else toast(`SPEED CAMERA  ${kmh} km/h — need ${goals[0]}`, "info", 2.4); } } else if (G[key] && d > 60) G[key] = false;
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
    G.t += dt; career.playT += dt;
    // weather drifts between dry and wet every few minutes
    const wx = G.weather; wx.next -= dt; if (wx.next <= 0) { wx.target = wx.target > 0.5 ? 0 : (rnd() < 0.6 ? 1 : 0); wx.next = 150 + rnd() * 240; if (wx.target > 0.5) toast("Rain rolling in over the city", "info", 3); }
    wx.rain += clamp(wx.target - wx.rain, -dt / 25, dt / 25); G.wet = wx.rain > 0.3;
    for (let i = G.toasts.length - 1; i >= 0; i--) if ((G.toasts[i].ttl -= dt) <= 0) G.toasts.splice(i, 1);
    if (G.flash && (G.flash.t -= dt) <= 0) G.flash = null;
    const P = G.player; const run = G.run;
    let inp = input;
    const frozen = run && (run.state === "countdown" || run.state === "done");
    if (G.state === "shop" || G.state === "result") inp = { throttle: 0, brake: 1, steer: 0, hand: true, nos: false };
    else if (frozen) inp = { throttle: 0, brake: 0, steer: 0, hand: false, nos: false };
    if (G.state !== "shop") {
      const before = { x: P.x, z: P.z };
      stepVehicle(world, P, inp, dt, { wet: G.wet }); career.odo += Math.hypot(P.x - before.x, P.z - before.z);
      career.topSpeed = Math.max(career.topSpeed, Math.round(P.speed * KMH));
      stepTraffic(dt);
      const h = trafficHits(P, true); if (h > P.hit) P.hit = h;
      if (run && run.racers) for (const r of run.racers) { if (r.out) continue; const hh = collideVehicles(P, r.v); if (hh > 1) { P.hit = Math.max(P.hit, hh); } trafficHits(r.v, false); }
      if (run && run.racers) for (let i = 0; i < run.racers.length; i++) for (let j = i + 1; j < run.racers.length; j++) if (!run.racers[i].out && !run.racers[j].out) collideVehicles(run.racers[i].v, run.racers[j].v);
      if (P.hit > 3) G.cam.hit = Math.max(G.cam.hit, P.hit);
      G.cam.hit = Math.max(0, G.cam.hit - dt * 14);
      // near misses charge the nitrous
      if (P.speed > 22) for (const t of G.traffic) { if (t.nm || t.wreck > 0) continue; const dx = t.x - P.x, dz = t.z - P.z; if (dx * dx + dz * dz < 20 && Math.abs(t.y - P.y) < 3) { t.nm = true; const rel = Math.hypot(P.vx - t.vx, P.vz - t.vz); if (rel > 14) { career.nearMiss++; P.nitro = Math.min(100, P.nitro + 6); G.nmFlash = { t: 1.2 }; } } }
      if (G.nmFlash && (G.nmFlash.t -= dt) <= 0) G.nmFlash = null;
      // free-roam bank for drifting
      if (!run) { if (P.drifting) G.roamDrift = (G.roamDrift || 0) + dt * P.speed * 2.2; else if (G.roamDrift > 0) { G.roamDrift -= dt * 40; if (G.roamDrift < 0) G.roamDrift = 0; } }
      if (P.drowned) { respawn(true); }
    }
    if (run) stepRun(run, dt, input); else if (G.state === "roam") roamTriggers(dt);
    // keep the GPS line current
    if (G.nav && !G.nav.event) { G.navT = (G.navT || 0) - dt; if (G.navT <= 0) { G.navT = 1.5; refreshNav(); } if (G.nav && G.nav.target && Math.hypot(G.nav.target.x - P.x, G.nav.target.z - P.z) < 30) { G.nav = null; toast("You have arrived", "good"); } }
    if (G.t - (G.lastSave || 0) > 25) { G.lastSave = G.t; career.pos = { x: P.x, z: P.z, yaw: P.yaw }; if (G.hooks.onSave) G.hooks.onSave(career); }
  };

  function respawn(drown = false) {
    const P = G.player; const lp = P.lastRoadPose;
    let x = lp.x, z = lp.z, yaw = lp.yaw, lastY = lp.y;
    if (G.run && G.run.route && G.run.state === "go") { const L = G.run.route.pts; const g = Math.max(0, G.run.gate - 1); const p = L[G.run.route.gates[g] || 0], q = L[Math.min(L.length - 1, (G.run.route.gates[g] || 0) + 4)]; x = p.x; z = p.z; lastY = p.y; yaw = Math.atan2(q.z - p.z, q.x - p.x); }
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
  G.buyUpgrade = (id) => { const u = UPGRADES.find((x) => x.id === id); const lv = career.levels[id]; if (lv >= u.max) return false; const c = u.cost[lv]; if (career.cash < c) return false; career.cash -= c; career.levels[id] = lv + 1; G.restat(); if (G.hooks.onSave) G.hooks.onSave(career); return true; };
  // running over people: a small fine and a trimmed drift bonus. Fines are tiny next to what a driver earns:
  // a hit costs 0.1% of lifetime earnings, a fast hit 0.25%, a death 0.4%, and all fines together never pass 1.5% of earnings.
  G.pedHit = ({ n, fast, kills }) => {
    const earned = Math.max(career.earned || 0, career.cash);
    const slow = Math.max(n - fast, 0), quick = Math.max(fast - kills, 0); // n counts everyone hit; fast and kills are subsets of it
    const want = slow * (0.001 * earned) + quick * (0.0025 * earned) + kills * (0.004 * earned);
    const room = Math.max(0, 0.015 * earned - (career.pedFines || 0));
    const fine = Math.min(Math.round(want), Math.floor(room), career.cash);
    career.cash -= fine; career.pedFines = (career.pedFines || 0) + fine;
    career.pedHits = (career.pedHits || 0) + n; career.pedKills = (career.pedKills || 0) + kills;
    if (G.run && G.run.bank > 0) G.run.bank = Math.round(G.run.bank * (kills ? 0.7 : 0.9));
    const amt = fine > 0 ? `  −₹${fine.toLocaleString("en-IN")}` : "";
    toast(kills ? `PEDESTRIAN KILLED${amt}  · SMALL BONUS CUT` : `HIT A PEDESTRIAN${amt}`, "warn", 3);
  };
  G.spend = (n) => { if (career.cash < n) return false; career.cash -= n; return true; };
  G.pause = false;
  return G;
}
