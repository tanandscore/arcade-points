// Wrath of Olympus — the secrets of the map (Upgrade 26): Oracle shrines, monster dens that guard treasure, and the four relics.
// All of it starts hidden in the fog of war. Scouting is rewarded: shrines light up the land and give favor, dens give loot and
// experience when cleared, and relics carried home to your Temple give your whole army a permanent bonus.
import { WILD, UNITS, LAIRS, RELICS, SHRINE, N } from "./defs.js";

const hyp = Math.hypot;
const AGGRO = { wolf: 6.5, satyr: 7.5, cyclops: 7.5 };
const LEASH = 17;

export function installWorld(S) {
  const plr = (o) => S.players[o];
  S.pois = []; S.reveals = []; S.rumours = [];
  const jitter = (a, b) => (((a * 73856093) ^ (b * 19349663)) >>> 0) / 4294967296;

  // ---- building the secrets from the map ---------------------------------------------------------------
  function create() {
    for (const q of S.map.pois) {
      const w = q.w, p = { id: S.nextId++, type: "poi", poi: q.type, kind: q.kind, owner: -1, ix: q.ix, iz: q.iz, w, x: q.ix + w / 2, z: q.iz + w / 2, dead: false, found: [false, false], guards: [], cleared: false, relic: q.relic || null, hp: 1, maxHp: 1, def: { name: q.type === "shrine" ? "Oracle's Shrine" : LAIRS[q.kind].name, icon: q.type === "shrine" ? "🔮" : LAIRS[q.kind].icon, desc: "" }, visited: [false, false] };
      S.ents.set(p.id, p); S.pois.push(p); S.setOcc(p, true);
      if (q.type === "lair") {
        const L = LAIRS[q.kind]; let k = 0;
        for (const [kind, n] of L.guards) for (let i = 0; i < n; i++, k++) {
          const a = (k / 4) * Math.PI * 2 + 0.7, f = S.pather.nearestFree(Math.floor(p.x + Math.cos(a) * 3.1), Math.floor(p.z + Math.sin(a) * 3.1), 5); if (!f) continue;
          const u = S.addUnit(kind, WILD, f[0] + 0.5, f[1] + 0.5); u.home = { x: u.x, z: u.z }; u.lairId = p.id; u.face = a + Math.PI; p.guards.push(u.id);
        }
        if (q.relic) { p.relicEnt = { id: S.nextId++, type: "relic", relic: q.relic, owner: -1, x: p.x, z: p.z + w / 2 + 1.1, state: "guarded", carriedBy: 0, found: [false, false], def: { name: RELICS[q.relic].name, icon: RELICS[q.relic].icon, desc: RELICS[q.relic].desc }, dead: false, hp: 1, maxHp: 1 }; S.ents.set(p.relicEnt.id, p.relicEnt); S.relics.push(p.relicEnt); }
      }
      // a rough hint of where things are, so the fog has a purpose: "rumours" (a vague circle on the minimap until you find the real thing)
      const jx = (jitter(q.ix, q.iz) - 0.5) * 12, jz = (jitter(q.iz, q.ix + 5) - 0.5) * 12;
      S.rumours.push({ poiId: p.id, x: p.x + jx, z: p.z + jz, r: 9, kind: q.type === "shrine" ? "shrine" : q.relic ? "relic" : "lair" });
    }
  }
  S.relics = [];

  // ---- wild monsters: they wait at their den, charge whoever comes close, and walk home when you leave -------------------------
  function wildIdle(u, dt) {
    u.vx = u.vz = 0; u.anim = "idle"; u.scanT -= dt; if (u.scanT > 0) return; u.scanT = 0.45 + S.rnd() * 0.15;
    if (S.t - (u.lastHit || -99) > 6 && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.05); // calm monsters heal
    const R = AGGRO[u.kind] || 7; let best = null, bd = R;
    S.forNear(u.x, u.z, R + 1, (e) => { if (e.dead || e.owner === WILD || e.type !== "unit") return; if (e.st && e.st.stun > S.t && false) return; const d = hyp(e.x - u.x, e.z - u.z); if (d < bd) { bd = d; best = e; } });
    if (best) { pull(u, best); return; }
    if (u.home && hyp(u.x - u.home.x, u.z - u.home.z) > 1.6 && u.order.type === "idle") { S.setOrder(u, { type: "move", x: u.home.x, z: u.home.z, attackMove: false }); S.goPt(u, u.home.x, u.home.z); }
  }
  function pull(u, target) { // the whole den joins in
    const ids = u.lairId ? (S.ents.get(u.lairId) || { guards: [u.id] }).guards : [u.id];
    for (const id of ids) { const m = S.ents.get(id); if (!m || m.dead || (m.order.type === "attack" && m !== u)) continue; if (hyp(m.x - u.x, m.z - u.z) > 14) continue; S.setOrder(m, { type: "attack", target: target.id, resume: null }); S.goEnt(m, target); }
  }
  // true when a monster has wandered too far from home and should give up the chase
  function leashed(u) { return u.home && hyp(u.x - u.home.x, u.z - u.home.z) > LEASH; }
  function goHome(u) { S.setOrder(u, { type: "move", x: u.home.x, z: u.home.z, attackMove: false }); S.goPt(u, u.home.x, u.home.z); }

  // ---- relics ---------------------------------------------------------------------------------------------------
  function dropRelic(owner, x, z) {
    const H = plr(owner).hero; if (!H || !H.carry) return; const r = S.ents.get(H.carry); H.carry = null; if (!r) return;
    r.state = "ground"; r.carriedBy = 0; const f = S.pather.nearestFree(Math.floor(x), Math.floor(z), 3); r.x = f ? f[0] + 0.5 : x; r.z = f ? f[1] + 0.5 : z; S.events.push({ type: "relicDrop", x: r.x, z: r.z, relic: r.relic });
  }
  function relicBonus(owner, key) { let t = 0; for (const rk of plr(owner).relics) { const v = RELICS[rk].fx[key]; if (v) t += v; } return t; }

  // ---- per-tick: discoveries, shrines, cleared dens, relics ------------------------------------------------------
  let t0 = 0;
  function tick(dt) {
    t0 -= dt; if (t0 > 0) return; t0 = 0.4;
    const vis = S.vis;
    for (const p of S.pois) {
      // found for the first time by the human player (the fog lifts over it)?
      if (!p.found[0] && (vis[Math.floor(p.z) * N + Math.floor(p.x)] > 0 || S.revealAll)) { p.found[0] = true; S.events.push({ type: "discover", poi: p.poi, kind: p.kind, id: p.id, x: p.x, z: p.z, relic: p.relic || null, name: p.def.name }); }
      if (p.poi === "shrine") {
        for (const o of [0, 1]) { if (p.visited[o]) continue; let near = null; S.forNear(p.x, p.z, 5, (e) => { if (!near && !e.dead && e.owner === o && e.type === "unit" && hyp(e.x - p.x, e.z - p.z) < 3.2) near = e; }); if (!near) continue;
          p.visited[o] = true; const P = plr(o); P.favor = Math.min(150, P.favor + SHRINE.favor); P.stats.shrines = (P.stats.shrines || 0) + 1; S.grantXp(o, SHRINE.xp); S.explore(p.x, p.z, SHRINE.radius, o); S.events.push({ type: "shrine", owner: o, x: p.x, z: p.z, id: p.id }); }
      } else if (p.poi === "lair" && !p.cleared) {
        if (p.guards.every((id) => { const g = S.ents.get(id); return !g || g.dead; })) {
          p.cleared = true; const o = p.claim != null && p.claim >= 0 ? p.claim : -1; const L = LAIRS[p.kind];
          if (o >= 0) { const P = plr(o); for (const k of Object.keys(L.loot)) { if (k === "favor") P.favor = Math.min(150, P.favor + L.loot[k]); else P.res[k] += Math.round(L.loot[k] * (S.lootMul || 1)); } P.stats.lairs = (P.stats.lairs || 0) + 1; S.grantXp(o, L.xp); }
          if (p.relicEnt) p.relicEnt.state = "ground";
          S.events.push({ type: "lairCleared", owner: o, x: p.x, z: p.z, id: p.id, kind: p.kind, loot: L.loot, relic: p.relic });
        }
      }
    }
    // relics: the champion picks one up by walking over it, and delivers it by walking to a finished Temple
    for (const r of S.relics) {
      if (r.state === "ground") {
        if (!r.found[0] && vis[Math.floor(r.z) * N + Math.floor(r.x)] > 0) { r.found[0] = true; }
        for (const o of [0, 1]) { const H = plr(o).hero; if (!H || !H.unit || H.unit.dead || H.carry) continue; if (hyp(H.unit.x - r.x, H.unit.z - r.z) < 1.8) { H.carry = r.id; r.state = "carried"; r.carriedBy = H.unit.id; S.events.push({ type: "relicTake", owner: o, relic: r.relic, x: r.x, z: r.z }); break; } }
      } else if (r.state === "carried") {
        const hu = S.ents.get(r.carriedBy); if (!hu || hu.dead) { continue; }
        r.x = hu.x; r.z = hu.z; const o = hu.owner;
        const temple = S.buildings.find((b) => !b.dead && b.done && b.owner === o && b.kind === "temple" && S.edgeDist(hu, b) < 2.4);
        if (temple) { const H = plr(o).hero; H.carry = null; r.state = "delivered"; plr(o).relics.push(r.relic); plr(o).stats.relics = (plr(o).stats.relics || 0) + 1; S.grantXp(o, 60); r.x = temple.x; r.z = temple.z; S.events.push({ type: "relicDeliver", owner: o, relic: r.relic, x: temple.x, z: temple.z }); }
      }
    }
  }
  // who gets credit for clearing a den
  function onKill(t, src) {
    if (t.lairId && src && src.owner >= 0 && src.owner !== WILD) { const p = S.ents.get(t.lairId); if (p) p.claim = src.owner; }
  }

  return { create, tick, wildIdle, leashed, goHome, dropRelic, relicBonus, onKill, pull, AGGRO };
}
