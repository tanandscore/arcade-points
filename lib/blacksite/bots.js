// Computer-controlled soldiers. They follow routes to the bomb sites, hold angles, listen for footsteps and
// gunfire, share what they see, throw smoke and flashes, plant and defuse — and shoot using the same rules as you.
import { CELL, SITES } from "./map";
import { WEAPONS } from "./weapons";

const cp = (i, j) => ({ x: (i + 0.5) * CELL, z: (j + 0.5) * CELL });
const ROUTES = {
  A: { long: [cp(6, 37), cp(6, 21)], short: [cp(27, 31), cp(27, 22), cp(17, 19.5), cp(15, 14)], hall: [cp(27, 31), cp(27, 22), cp(14.5, 19.5)] },
  B: { tunnels: [cp(41.5, 36), cp(41.5, 22)], alley: [cp(49, 36), cp(49, 22)], short: [cp(27, 31), cp(27, 23), cp(36, 23.5), cp(41.5, 23.5)] },
};
const CT_HOLDS = {
  A: [{ ...cp(6.5, 10.5), look: cp(6.5, 25) }, { ...cp(14.5, 9.5), look: cp(15, 20) }, { ...cp(11, 4.5), look: cp(11, 12) }],
  B: [{ ...cp(44.5, 10.5), look: cp(41.5, 20) }, { ...cp(48.5, 9.5), look: cp(49, 24) }, { ...cp(44.5, 4.5), look: cp(44.5, 12) }],
  M: [{ ...cp(27.5, 11.5), look: cp(27.5, 27) }, { ...cp(22.5, 13.5), look: cp(27.5, 20) }, { ...cp(32.5, 13.5), look: cp(27.5, 20) }],
};
const ENTRANCES = { A: [cp(6.5, 13), cp(15, 12.5), cp(17.5, 5.5)], B: [cp(41.5, 13), cp(49, 13), cp(37.5, 5.5)] };
const rand = Math.random; const pick = (a) => a[Math.floor(rand() * a.length)];
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

export function createBotBrain(E) {
  const { map } = E;
  const cand = { A: [], B: [] };
  for (const k of ["A", "B"]) { const s = SITES[k]; for (let n = 0; n < 400 && cand[k].length < 46; n++) { const a = rand() * 6.28, r = Math.sqrt(rand()) * s.r * 1.05; const x = s.cx + Math.cos(a) * r, z = s.cz + Math.sin(a) * r; if (map.isBlocked(x, z)) continue; cand[k].push({ x, z }); } }

  const pathVia = (bot, via, goal) => { const pts = []; let cx = bot.x, cz = bot.z; for (const p of [...via, goal]) { const leg = map.findPath(cx, cz, p.x, p.z); if (leg) pts.push(...leg); cx = p.x; cz = p.z; } return pts; };
  const goTo = (bot, goal, via = []) => { const ai = bot.ai; ai.goal = goal; ai.path = pathVia(bot, via, goal); ai.pathIdx = 0; ai.stuckT = 0; ai.lastPos = { x: bot.x, z: bot.z }; ai.arrived = ai.path.length === 0; };

  // ---- team plans at the start of a round --------------------------------------------------------------------------------------
  function planRound() {
    const now = E.now(); const diff = E.diff;
    const T = E.ents.filter((e) => e.team === "terrorist" && !e.isPlayer || (e.isPlayer && E.autopilot && e.team === "terrorist"));
    const CT = E.ents.filter((e) => e.team === "police" && (!e.isPlayer || E.autopilot));
    for (const e of E.ents) { if (!e.ai) continue; Object.assign(e.ai, { goal: null, path: [], pathIdx: 0, arrived: false, mode: "idle", hold: null, targetId: null, lastSeen: null, reactUntil: 0, noise: null, alertUntil: 0, planted: false, plantT: 0, defuseT: 0, startAt: now + 0.3 + rand() * 1.6, site: null, role: "", utilDone: {}, search: null, wait: 0, waitStart: 0, waitT: 0, lookEnt: null, retakeStage: null, stageT: 0, rotated: false, postSpot: null, utilFight: false, stage: null, retakeSmoke: false, pickupFor: null, visible: false, strafeUntil: 0, burstN: 0, searchPathed: false }); }
    E.intel = { police: { site: null, t: -99 }, terrorist: { site: null, t: -99 } };
    // terrorists
    const plan = pick(["rushA", "rushB", "splitA", "splitB", "midA", "midB", "rushA", "rushB"]); E.round.plan = plan;
    const groupSites = []; T.forEach((b, i) => { let s; if (plan === "rushA" || plan === "midA") s = "A"; else if (plan === "rushB" || plan === "midB") s = "B"; else if (plan === "splitA") s = i < 3 ? "A" : "B"; else s = i < 3 ? "B" : "A"; groupSites.push(s); });
    const routeOf = {};
    T.forEach((b, i) => {
      const s = groupSites[i]; b.ai.site = s; b.ai.role = "attack";
      const rs = ROUTES[s]; const names = Object.keys(rs); let route;
      if (plan.startsWith("mid") && i < 2) route = "short"; else route = routeOf[s + (i % 2)] || (routeOf[s + (i % 2)] = pick(names));
      b.ai.route = route; b.ai.via = rs[route]; const spot = pick(cand[s].filter((c) => Math.hypot(c.x - SITES[s].cx, c.z - SITES[s].cz) < SITES[s].r * 0.8)); b.ai.clearSpot = spot;
      goTo(b, spot, rs[route]); b.ai.mode = "move"; b.ai.speedMode = rand() < 0.4 ? "walkEnd" : "run";
    });
    // police
    const slots = [["A", 0], ["B", 0], ["M", 0], ["A", 1], ["B", 1], ["M", 1]]; const order = [0, 3, 1, 2, 4, 5];
    CT.forEach((b, i) => {
      const slot = slots[order[i % order.length]]; const hold = CT_HOLDS[slot[0]][slot[1] % CT_HOLDS[slot[0]].length]; b.ai.role = "defend"; b.ai.holdSite = slot[0]; b.ai.hold = hold; b.ai.site = slot[0] === "M" ? null : slot[0];
      goTo(b, { x: hold.x, z: hold.z }); b.ai.mode = "move"; b.ai.speedMode = "run";
    });
  }

  // ---- movement helpers -----------------------------------------------------------------------------------------------------------------
  function steer(bot, dt, wx, wz, speed) {
    const len = Math.hypot(wx, wz); if (len > 1e-4) { wx /= len; wz /= len; } else { wx = 0; wz = 0; }
    const tx = wx * speed, tz = wz * speed; const a = Math.min(1, dt * (speed > 0 ? 9 : 14)); bot.vx += (tx - bot.vx) * a; bot.vz += (tz - bot.vz) * a;
    bot.x += bot.vx * dt; bot.z += bot.vz * dt; const p = { x: bot.x, z: bot.z }; map.collide(p, 0.36, bot.y, 1.7); bot.x = p.x; bot.z = p.z;
    // keep away from friends
    for (const o of E.ents) { if (o === bot || !o.alive || o.team !== bot.team) continue; const dx = bot.x - o.x, dz = bot.z - o.z, d = Math.hypot(dx, dz); if (d < 0.9 && d > 1e-3) { bot.x += (dx / d) * (0.9 - d) * 0.4; bot.z += (dz / d) * (0.9 - d) * 0.4; } }
  }
  function followPath(bot, dt, speed) {
    const ai = bot.ai; if (!ai.path || ai.pathIdx >= ai.path.length) { ai.arrived = true; steer(bot, dt, 0, 0, 0); return; }
    const wp = ai.path[ai.pathIdx]; const dx = wp.x - bot.x, dz = wp.z - bot.z, d = Math.hypot(dx, dz);
    if (d < (ai.pathIdx === ai.path.length - 1 ? 0.5 : 0.9)) { ai.pathIdx++; if (ai.pathIdx >= ai.path.length) ai.arrived = true; return; }
    steer(bot, dt, dx, dz, speed); ai.moveYaw = Math.atan2(-dx, -dz);
    ai.stuckT += dt; if (ai.stuckT > 1.2) { const moved = Math.hypot(bot.x - ai.lastPos.x, bot.z - ai.lastPos.z); ai.lastPos = { x: bot.x, z: bot.z }; ai.stuckT = 0; if (moved < 0.5 && ai.goal) { const k = Math.min(ai.path.length - 1, ai.pathIdx + 1); const tgt = ai.path[k]; const leg = map.findPath(bot.x + (rand() - 0.5) * 1.2, bot.z + (rand() - 0.5) * 1.2, tgt.x, tgt.z) || []; ai.path = [...leg, ...ai.path.slice(k + 1)]; ai.pathIdx = 0; } }
  }
  const turnTo = (bot, yaw, pitch, rate, dt) => { const dy = wrap(yaw - bot.yaw), s = Math.min(1, rate * dt); bot.yaw += dy * s; bot.pitch += (pitch - bot.pitch) * s; };
  const yawTo = (bot, x, z) => Math.atan2(-(x - bot.x), -(z - bot.z));
  const eyeOf = (e) => e.y + 1.62 - e.crouch * 0.42;

  // ---- perception ----------------------------------------------------------------------------------------------------------------------------
  function canSee(bot, e) {
    const dx = e.x - bot.x, dz = e.z - bot.z, d = Math.hypot(dx, dz); if (d > 58) return null;
    const fwd = -Math.sin(bot.yaw) * dx / (d || 1) + -Math.cos(bot.yaw) * dz / (d || 1); const recentShot = E.now() - (e.lastShotT || -9) < 1.0;
    if (fwd < 0.35 && !(recentShot && d < 28) && d > 3) return null;
    if (E.now() < bot.flashedUntil - 1.0) return null;
    const ex = bot.x, ey = eyeOf(bot), ez = bot.z;
    for (const ty of [1.25 - e.crouch * 0.3, 1.58 - e.crouch * 0.42]) {
      if (map.hasLineOfSight(ex, ey, ez, e.x, e.y + ty, e.z) && !E.fx.smokeBlocks(ex, ey, ez, e.x, e.y + ty, e.z)) return { head: ty > 1.4, d };
    }
    return null;
  }

  // ---- utility throws -----------------------------------------------------------------------------------------------------------------------------
  function throwAt(bot, type, tx, tz) {
    if (!(bot.nades[type] > 0)) return false; const dx = tx - bot.x, dz = tz - bot.z, d = Math.hypot(dx, dz); const g = 16, v = Math.min(19, Math.sqrt(d * g) * 1.15 + 3);
    const s = Math.min(1, (d * g) / (v * v)); const pitch = 0.5 * Math.asin(Math.max(0.05, Math.min(1, s))) + 0.1; bot.yaw = Math.atan2(-dx, -dz); bot.pitch = pitch;
    E.throwNade(bot, type, bot.yaw, pitch, v); return true;
  }

  // ---- the per-frame brain ------------------------------------------------------------------------------------------------------------------
  function update(bot, dt) {
    const ai = bot.ai, now = E.now(), diff = E.diff, def = WEAPONS[bot.cur] || WEAPONS.pistol;
    if (!bot.alive) return;
    if (E.round.phase === "freeze") { steer(bot, dt, 0, 0, 0); return; }
    if (now < ai.startAt) { steer(bot, dt, 0, 0, 0); return; }
    const enemies = E.ents.filter((e) => e.alive && e.team !== bot.team);
    // ----- think (perception) ~8 Hz
    ai.nextThink = ai.nextThink || 0;
    if (now >= ai.nextThink) {
      ai.nextThink = now + 0.1 + rand() * 0.05; let best = null, bestD = 1e9;
      for (const e of enemies) { const s = canSee(bot, e); if (s && s.d < bestD) { bestD = s.d; best = { e, s }; } }
      if (best) {
        if (ai.targetId !== best.e.id) { ai.targetId = best.e.id; ai.reactUntil = now + (diff.react * (0.7 + Math.min(1.2, best.s.d / 40)) + rand() * 120) / 1000; ai.aimHead = rand() < diff.headChance; ai.style = bot.team === "terrorist" && best.s.d > 26 ? "advance" : pick(["hold", "hold", "strafe", "strafe", best.s.d < 16 ? "advance" : "hold"]); ai.errT = 0; ai.fightStart = now; E.radio(bot, "spotted", best.e); }
        ai.lastSeen = { x: best.e.x, z: best.e.z, t: now, vx: best.e.vx, vz: best.e.vz }; ai.visible = true; ai.targetDist = best.s.d;
        E.intel[bot.team] = { site: nearestSite(best.e.x, best.e.z), t: now, x: best.e.x, z: best.e.z };
      } else { ai.visible = false; if (ai.targetId !== null && now - (ai.lastSeen ? ai.lastSeen.t : 0) > 0.4) { if (ai.lastSeen && ai.mode !== "plant") { ai.search = { x: ai.lastSeen.x + (ai.lastSeen.vx || 0) * 0.6, z: ai.lastSeen.z + (ai.lastSeen.vz || 0) * 0.6, until: now + 5 }; } ai.targetId = null; } }
      // hearing
      for (const n of E.noises) { if (n.team === bot.team || now - n.t > 0.25) continue; const d = Math.hypot(n.x - bot.x, n.z - bot.z); if (d < n.r * diff.hear && !ai.visible) { ai.noise = { x: n.x, z: n.z, t: now, kind: n.kind }; if (bot.team === "police" && n.kind === "shot" && d < 40) E.intel.police = { site: nearestSite(n.x, n.z), t: now, x: n.x, z: n.z, heard: true }; } }
    }
    const target = ai.targetId !== null ? E.ents.find((e) => e.id === ai.targetId && e.alive) : null;
    const bomb = E.bomb;

    // ----- fighting
    if (target && ai.visible) {
      const dx = target.x - bot.x, dz = target.z - bot.z, d = Math.hypot(dx, dz); ai.errT = (ai.errT || 0) + dt;
      const aimY = target.y + (ai.aimHead ? 1.56 - target.crouch * 0.42 : 1.2 - target.crouch * 0.3); const lead = 0.06;
      const tx = target.x + target.vx * lead, tz = target.z + target.vz * lead; const wantYaw = Math.atan2(-(tx - bot.x), -(tz - bot.z)); const horiz = Math.hypot(tx - bot.x, tz - bot.z); const wantPitch = Math.atan2(aimY - eyeOf(bot), horiz);
      const tspd = Math.hypot(target.vx, target.vz), myspd = Math.hypot(bot.vx, bot.vz);
      const err = (diff.aimErr * (1 + d / 28 + tspd / 6 + myspd / 6) * Math.max(0.35, 1 - ai.errT * 0.35)) * Math.PI / 180;
      if (!ai.errYaw || now > (ai.errNext || 0)) { ai.errYaw = (rand() - 0.5) * 2 * err; ai.errPitch = (rand() - 0.5) * 2 * err * 0.6; ai.errNext = now + 0.22; }
      turnTo(bot, wantYaw + ai.errYaw, wantPitch + ai.errPitch, diff.aimRate, dt);
      const aimOff = Math.abs(wrap(wantYaw - bot.yaw)) + Math.abs(wantPitch - bot.pitch);
      // movement while fighting
      let wx = 0, wz = 0, spd = 0; const perp = { x: -dz / (d || 1), z: dx / (d || 1) };
      if (bot.hp < 35 && d > 8 && ai.lastPos) { wx = -dx; wz = -dz; spd = 3.4; }
      else if (ai.style === "strafe" && now > ai.reactUntil) { if (now > (ai.strafeUntil || 0)) { ai.strafeDir = rand() < 0.5 ? -1 : 1; ai.strafeUntil = now + 0.35 + rand() * 0.7; } wx = perp.x * ai.strafeDir; wz = perp.z * ai.strafeDir; spd = def.kind === "sniper" ? 0 : 2.4; }
      else if (ai.style === "advance" && d > 7) { wx = dx; wz = dz; spd = 3.2; }
      const still = spd === 0; steer(bot, dt, wx, wz, spd);
      bot.crouch += ((still && d > 18 && ai.style === "hold" && rand() < 0.5 ? 1 : 0) - bot.crouch) * Math.min(1, dt * 8);
      // shooting
      if (now > ai.reactUntil && bot.cur !== "knife" && E.now() >= bot.flashedUntil) {
        if (bot.ammo[bot.cur] && bot.ammo[bot.cur].mag <= 0 && now > bot.reloadEnd) E.reload(bot);
        const maxOff = (0.035 + 1.2 / (d + 4) * 0.5);
        if (aimOff < maxOff && now >= bot.nextShot && now >= bot.reloadEnd) {
          const slowOk = def.kind === "sniper" ? myspd < 0.6 : def.kind === "rifle" ? myspd < 2.9 || d < 14 : true;
          const burst = def.kind === "rifle" && d > 22 ? 4 : def.kind === "sniper" ? 1 : def.kind === "pistol" ? 1 : 99;
          if (slowOk && ((ai.burstN || 0) < burst || now > (ai.burstPause || 0))) {
            if ((ai.burstN || 0) >= burst) { ai.burstN = 0; }
            E.shoot(bot, null); ai.burstN = (ai.burstN || 0) + 1; if (ai.burstN >= burst) ai.burstPause = now + 0.18 + rand() * 0.3 + (def.kind === "sniper" ? 0.2 : 0);
          }
        }
      }
      // flash / smoke / frag usage
      if (!ai.utilFight && d > 10 && bot.nades.he > 0 && rand() < 0.01) { ai.utilFight = true; throwAt(bot, "he", target.x, target.z); }
      return;
    } else { bot.crouch += (0 - bot.crouch) * Math.min(1, dt * 8); }

    // ----- plant / defuse in progress
    if (ai.mode === "plant") {
      steer(bot, dt, 0, 0, 0); if (ai.visible || E.round.phase !== "live" || !bot.hasBomb) { E.cancelUse(bot); ai.mode = "move"; return; }
      E.holdUse(bot, dt); if (bomb.state === "planted") { ai.mode = "post"; ai.planted = true; } return;
    }
    if (ai.mode === "defuse") {
      steer(bot, dt, 0, 0, 0); if (ai.visible || bomb.state !== "planted") { E.cancelUse(bot); ai.mode = "move"; return; } E.holdUse(bot, dt); return;
    }

    // ----- reload when safe
    const a = bot.ammo[bot.cur]; if (a && a.mag < Math.max(5, WEAPONS[bot.cur].mag * 0.4) && a.reserve > 0 && now > bot.reloadEnd && !ai.visible) E.reload(bot);

    // ----- searching / investigating (keeps the original route so the bot can go back to it)
    const endSearch = () => { if (ai.saved) { ai.path = ai.saved.path; ai.pathIdx = ai.saved.pathIdx; ai.arrived = ai.saved.arrived; ai.saved = null; } ai.search = null; ai.searchPathed = false; };
    if (ai.search && now < ai.search.until) {
      const dx = ai.search.x - bot.x, dz = ai.search.z - bot.z, d = Math.hypot(dx, dz);
      if (d > 2.2) {
        if (!ai.searchPathed || now > ai.searchRepath) { if (!ai.saved) ai.saved = { path: ai.path, pathIdx: ai.pathIdx, arrived: ai.arrived }; ai.path = map.findPath(bot.x, bot.z, ai.search.x, ai.search.z) || []; ai.pathIdx = 0; ai.arrived = false; ai.searchPathed = true; ai.searchRepath = now + 1.5; }
        followPath(bot, dt, 2.8); turnTo(bot, ai.moveYaw ?? bot.yaw, 0, 7, dt); return;
      }
      endSearch();
    } else if (ai.search || ai.saved) endSearch();

    // ----- role behaviour
    if (bot.team === "terrorist") tBehave(bot, dt, now, enemies, bomb); else ctBehave(bot, dt, now, enemies, bomb);
  }

  function nearestSite(x, z) { const a = Math.hypot(x - SITES.A.cx, z - SITES.A.cz), b = Math.hypot(x - SITES.B.cx, z - SITES.B.cz); return a < b ? "A" : "B"; }

  function walkTo(bot, dt, speed, lookYaw) {
    const ai = bot.ai; if (ai.arrived) { steer(bot, dt, 0, 0, 0); return true; }
    followPath(bot, dt, speed); if (lookYaw === undefined) turnTo(bot, ai.moveYaw ?? bot.yaw, 0, 6, dt); else turnTo(bot, lookYaw, 0, 6, dt); return false;
  }

  function tBehave(bot, dt, now, enemies, bomb) {
    const ai = bot.ai; const live = E.round.phase === "live";
    // pick up the dropped bomb
    if (bomb.state === "dropped" && !E.ents.some((e) => e.team === "terrorist" && e.alive && e.hasBomb)) {
      const mates = E.ents.filter((e) => e.team === "terrorist" && e.alive && e.ai && (!e.isPlayer || E.autopilot));
      const closest = mates.sort((a, b) => Math.hypot(a.x - bomb.x, a.z - bomb.z) - Math.hypot(b.x - bomb.x, b.z - bomb.z))[0];
      if (closest === bot && ai.pickupFor !== bomb.dropId) { ai.pickupFor = bomb.dropId; goTo(bot, { x: bomb.x, z: bomb.z }); ai.mode = "pickup"; }
    }
    if (ai.mode === "pickup") { if (bomb.state !== "dropped") { ai.mode = "move"; if (bot.hasBomb && ai.clearSpot) goTo(bot, ai.clearSpot, []); } else { walkTo(bot, dt, 5.0); return; } }
    if (bomb.state === "planted") {
      // post-plant: take a spot with a view of the bomb
      if (ai.mode !== "post") { ai.mode = "post"; ai.postSpot = null; }
      if (!ai.postSpot) {
        const s = bomb.site; const tried = []; let sp = null;
        for (let n = 0; n < 40 && !sp; n++) { const c = pick(cand[s]); const d = Math.hypot(c.x - bomb.x, c.z - bomb.z); if (d < 4.5 || d > 15) continue; if (!map.hasLineOfSight(c.x, 1.5, c.z, bomb.x, 0.3, bomb.z)) continue; if (E.ents.some((o) => o !== bot && o.ai && o.ai.postSpot && Math.hypot(o.ai.postSpot.x - c.x, o.ai.postSpot.z - c.z) < 3)) continue; sp = c; }
        ai.postSpot = sp || pick(cand[s]); ai.postLook = pick(ENTRANCES[s]); goTo(bot, ai.postSpot);
      }
      const done = walkTo(bot, dt, 4.2); if (done) { turnTo(bot, yawTo(bot, ai.postLook.x, ai.postLook.z) + Math.sin(now * 0.6 + bot.id) * 0.3, 0, 4, dt); bot.crouch += ((bot.id % 2 ? 1 : 0) - bot.crouch) * Math.min(1, dt * 6); }
      // bomb being defused? run toward it
      if (bomb.defuser && Math.hypot(bomb.x - bot.x, bomb.z - bot.z) < 28 && !ai.visible) { ai.search = { x: bomb.x, z: bomb.z, until: now + 4 }; }
      return;
    }
    // before plant
    if (!live) return;
    if (ai.mode === "move" || ai.mode === "idle") {
      const spd = ai.speedMode === "walkEnd" && ai.path && ai.pathIdx >= ai.path.length - 2 ? 2.7 : 5.0; const s = ai.site || "A";
      const done = walkTo(bot, dt, bot.ai.noise && now - bot.ai.noise.t < 1.2 ? 2.7 : spd);
      if (ai.path && ai.pathIdx >= ai.path.length - 3 && !ai.utilDone.flash && bot.nades.flash > 0 && rand() < 0.02) { ai.utilDone.flash = true; throwAt(bot, "flash", SITES[s].cx + (rand() - 0.5) * 6, SITES[s].cz + (rand() - 0.5) * 6); }
      if (ai.path && ai.pathIdx >= ai.path.length - 3 && !ai.utilDone.smoke && bot.nades.smoke > 0 && rand() < 0.02) { ai.utilDone.smoke = true; const e = pick(ENTRANCES[s]); throwAt(bot, "smoke", e.x, e.z); }
      if (done) { ai.mode = "clear"; ai.waitT = now + 1 + rand() * 3; ai.clearIdx = 0; }
      return;
    }
    if (ai.mode === "clear") {
      const s = ai.site; const site = SITES[s];
      if (bot.hasBomb) {
        // plant once the squad is in and nothing is visible, or after a while
        const mates = E.ents.filter((e) => e.alive && e.team === "terrorist" && e !== bot && Math.hypot(e.x - site.cx, e.z - site.cz) < site.r * 1.6).length; ai.waitStart = ai.waitStart || now;
        if ((mates >= 1 || now - ai.waitStart > 7) && now > ai.waitT && !ai.visible && E.inSite(bot, s)) {
          const spots = cand[s].filter((c) => Math.hypot(c.x - site.cx, c.z - site.cz) < 5).sort(() => rand() - 0.5); const sp = spots[0] || { x: site.cx, z: site.cz }; goTo(bot, sp); ai.mode = "toPlant"; return;
        }
        steer(bot, dt, 0, 0, 0); turnTo(bot, yawTo(bot, site.cx, site.cz) + Math.sin(now + bot.id) * 0.9, 0, 3, dt); return;
      }
      // cover the planter: wander between site spots, looking at entrances
      if (ai.arrived && now > ai.waitT) { const sp = pick(cand[s]); goTo(bot, sp); ai.waitT = now + 2.5 + rand() * 4; }
      if (!walkTo(bot, dt, 3.0)) return; const le = ai.lookEnt || (ai.lookEnt = pick(ENTRANCES[s])); turnTo(bot, yawTo(bot, le.x, le.z), 0, 2.5, dt); return;
    }
    if (ai.mode === "toPlant") {
      if (walkTo(bot, dt, 3.4)) { ai.mode = "plant"; E.startUse(bot); }
      return;
    }
    // fallback: idle
    steer(bot, dt, 0, 0, 0);
  }

  function ctBehave(bot, dt, now, enemies, bomb) {
    const ai = bot.ai; const live = E.round.phase === "live";
    if (bomb.state === "planted") {
      const site = SITES[bomb.site];
      if (ai.mode !== "retake" && ai.mode !== "defuse") { ai.mode = "retake"; ai.retakeStart = now + rand() * 1.5; ai.stage = null; ai.retakeSmoke = false; }
      const remaining = bomb.timer; const needed = bot.kit ? 5 : 10;
      const dist = Math.hypot(bomb.x - bot.x, bomb.z - bot.z);
      if (remaining < needed + dist / 5 + 0.5 && !E.ents.some((e) => e.alive && e.team === "police" && Math.hypot(e.x - bomb.x, e.z - bomb.z) < 4)) { steer(bot, dt, 0, 0, 0); return; } // no time: save
      if (now < ai.retakeStart) { steer(bot, dt, 0, 0, 0); return; }
      const mates = E.ents.filter((e) => e.alive && e.team === "police" && e !== bot);
      if (!ai.stage) { const ring = ENTRANCES[bomb.site]; const e = ring.slice().sort((a, b) => Math.hypot(a.x - bot.x, a.z - bot.z) - Math.hypot(b.x - bot.x, b.z - bot.z))[0]; ai.stage = { x: e.x, z: e.z }; goTo(bot, ai.stage); }
      const nearStage = Math.hypot(ai.stage.x - bot.x, ai.stage.z - bot.z) < 5;
      if (ai.retakeStage !== "push") {
        if (!ai.arrived) { walkTo(bot, dt, 5.0); return; }
        steer(bot, dt, 0, 0, 0); turnTo(bot, yawTo(bot, bomb.x, bomb.z), 0, 3, dt); ai.stageT = ai.stageT || now;
        if (bot.nades.smoke > 0 && !ai.retakeSmoke && Math.hypot(bomb.x - bot.x, bomb.z - bot.z) < 26) { ai.retakeSmoke = true; throwAt(bot, "smoke", bomb.x - 1, bomb.z + 1); }
        const there = E.ents.filter((e) => e.alive && e.team === "police" && Math.hypot(e.x - ai.stage.x, e.z - ai.stage.z) < 9).length;
        if (there >= Math.min(2, mates.length + 1) && now - ai.stageT > 2.5 || now - ai.stageT > 6.5 || remaining < 16) { ai.retakeStage = "push"; goTo(bot, { x: bomb.x + (rand() - 0.5) * 1.4, z: bomb.z + (rand() - 0.5) * 1.4 }); }
        return;
      }
      if (!ai.arrived) { walkTo(bot, dt, 5.0); return; }
      if (dist < 2.4 && !ai.visible) { ai.mode = "defuse"; E.startUse(bot); }
      return;
    }
    if (!live) return;
    // intel from teammates / noise: rotate
    const intel = E.intel.police; if (ai.role === "defend" && intel.site && now - intel.t < 6 && ai.holdSite !== intel.site && ai.holdSite !== undefined && !ai.rotated && now - intel.t > 0.8 + (bot.id % 3) * 0.7) {
      const near = ai.holdSite === "M" || (bot.id % 2 === 0); if (near) { ai.rotated = true; const h = CT_HOLDS[intel.site][bot.id % CT_HOLDS[intel.site].length]; ai.hold = h; ai.holdSite = intel.site; goTo(bot, { x: h.x, z: h.z }); ai.mode = "move"; ai.speedMode = "run"; E.radio(bot, "rotate", intel.site); }
    }
    if (ai.noise && now - ai.noise.t < 3 && ai.arrived && ai.hold) { turnTo(bot, yawTo(bot, ai.noise.x, ai.noise.z), 0, 5, dt); steer(bot, dt, 0, 0, 0); return; }
    if (ai.mode === "move" && ai.hold) { const done = walkTo(bot, dt, ai.speedMode === "run" ? 5.0 : 3.0); if (done) ai.mode = "hold"; return; }
    if (ai.hold) { steer(bot, dt, 0, 0, 0); const sweep = Math.sin(now * 0.5 + bot.id * 2) * 0.35; turnTo(bot, yawTo(bot, ai.hold.look.x, ai.hold.look.z) + sweep, 0, 3, dt); bot.crouch += ((bot.id % 3 === 0 ? 1 : 0) - bot.crouch) * Math.min(1, dt * 6); return; }
    steer(bot, dt, 0, 0, 0);
  }

  return { planRound, update, cand, ENTRANCES, goTo, throwAt };
}
