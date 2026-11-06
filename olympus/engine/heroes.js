// Wrath of Olympus — the champion rules (Upgrade 26).
// Each side has one champion (the "main character"): it starts on the map, earns experience from fights and discoveries, grows to level 5,
// has two special abilities (the second unlocks at level 2), shapes the whole army with a passive, and comes back from the Temple if it falls.
// No graphics in here: it works through the simulation object `S` so it also runs on its own for testing.
import { UNITS, HEROES, ABILITIES, STATUS, XP_AT, MAX_LEVEL, HERO_UNLOCK2 } from "./defs.js";

const hyp = Math.hypot;
const ok = (extra) => ({ ok: true, ...(extra || {}) });
const no = (reason) => ({ ok: false, reason });

export const REVIVE_COST = (level) => ({ gold: 120 + 40 * level });

export function installHeroes(S) {
  const plr = (o) => S.players[o];

  // ---- timed effects (rage, stun, speed...) -----------------------------------------------------------
  function addStatus(u, key, dur) { const st = (u.st ||= {}); st[key] = Math.max(st[key] || 0, S.t + dur); }
  function stOf(u, key) { let m = 1; const st = u.st; if (st) for (const k in st) if (st[k] > S.t) { const v = STATUS[k] && STATUS[k][key]; if (v) m *= v; } return m; }
  const isStunned = (u) => !!(u.st && u.st.stun > S.t);
  const heroUnit = (owner) => { const H = plr(owner) && plr(owner).hero; return H && H.unit && !H.unit.dead ? H.unit : null; };
  const passiveOf = (owner) => { const P = plr(owner); return P && P.heroId ? HEROES[P.heroId].passive : null; };

  // ---- creating and levelling the champion ---------------------------------------------------------------
  const maxHpFor = (kind, level, owner) => { const base = UNITS[kind].hp; return Math.round(base * (1 + 0.12 * (level - 1))); };
  function spawnHero(owner, x, z) {
    const P = plr(owner), H = P.hero; const u = S.addUnit(H.id, owner, x, z);
    u.isHero = true; u.heroId = H.id; u.lvl = H.level; u.maxHp = maxHpFor(H.id, H.level, owner); u.hp = u.maxHp;
    H.unit = u; H.state = "alive"; return u;
  }
  function setupHeroes() {
    for (const P of S.players) {
      if (P.wild || !P.heroId) continue;
      P.hero = { id: P.heroId, unit: null, level: 1, xp: 0, state: "alive", readyAt: [0, 0], carry: null, kills: 0 };
    }
  }
  function grantXp(owner, amount) {
    const P = plr(owner); const H = P && P.hero; if (!H || amount <= 0) return;
    H.xp += amount;
    while (H.level < MAX_LEVEL && H.xp >= XP_AT[H.level]) {
      H.level++;
      const u = H.unit; if (u && !u.dead) { const mx = maxHpFor(H.id, H.level, owner), d = mx - u.maxHp; u.maxHp = mx; u.hp = Math.min(mx, u.hp + d + mx * 0.25); u.lvl = H.level; }
      S.events.push({ type: "levelup", owner, level: H.level, x: u ? u.x : 0, z: u ? u.z : 0, id: u ? u.id : 0 });
    }
  }
  function onHeroDeath(u) {
    const H = plr(u.owner).hero; if (!H) return; H.unit = null; H.state = "dead"; H.diedAt = S.t; H.deaths = (H.deaths || 0) + 1;
    if (H.carry) S.dropRelic(u.owner, u.x, u.z);
    S.events.push({ type: "heroDown", owner: u.owner, x: u.x, z: u.z, id: u.id });
  }

  // ---- reviving ---------------------------------------------------------------------------------------------
  function cmdRevive(owner) {
    const P = plr(owner), H = P.hero; if (!H) return no("No champion");
    if (H.state === "alive") return no("Your champion is alive");
    if (H.state === "reviving") return no("Already returning");
    const temple = S.buildings.find((b) => !b.dead && b.done && b.owner === owner && b.kind === "temple" && b.queue.length < 6);
    const b = temple || S.buildings.find((bb) => !bb.dead && bb.done && bb.owner === owner && bb.kind === "town_center" && bb.queue.length < 6);
    if (!b) return no("You need a Town Center or Temple");
    const cost = REVIVE_COST(H.level); for (const k of Object.keys(cost)) if ((P.res[k] || 0) < cost[k]) return no("Not enough gold");
    for (const k of Object.keys(cost)) P.res[k] -= cost[k];
    H.state = "reviving"; b.queue.push({ type: "revive", t: 0, total: temple ? 35 : 60, cost: { ...cost }, pct: 0 });
    return ok();
  }
  function finishRevive(b) {
    const H = plr(b.owner).hero; if (!H) return; const sp = S.spawnPoint(b, null);
    const u = spawnHero(b.owner, sp[0], sp[1]); S.events.push({ type: "heroBack", owner: b.owner, x: u.x, z: u.z, id: u.id });
  }
  function cancelRevive(owner) { const H = plr(owner).hero; if (H && H.state === "reviving") H.state = "dead"; }

  // ---- abilities --------------------------------------------------------------------------------------------
  const abilityKeys = (owner) => { const P = plr(owner); return P.heroId ? HEROES[P.heroId].abilities : []; };
  function abilityReady(owner, slot) {
    const P = plr(owner), H = P.hero; if (!H || !H.unit || H.unit.dead) return false; if (slot === 1 && H.level < HERO_UNLOCK2) return false; return H.readyAt[slot] <= S.t && !isStunned(H.unit);
  }
  function freeSpotNear(x, z, r = 4) { const f = S.pather.nearestFree(Math.floor(x), Math.floor(z), r); return f ? [f[0] + 0.5, f[1] + 0.5] : null; }
  function enemiesIn(owner, x, z, r, fn) { S.forNear(x, z, r + 1, (e) => { if (e.dead || e.owner === owner) return; if (hyp(e.x - x, e.z - z) <= r + e.radius * 0.5) fn(e); }); }

  function cmdAbility(owner, slot, x, z) {
    const P = plr(owner), H = P.hero; const u = H && H.unit; if (!u || u.dead) return no("Your champion has fallen");
    const key = abilityKeys(owner)[slot]; const A = ABILITIES[key]; if (!A) return no("No such ability");
    if (slot === 1 && H.level < HERO_UNLOCK2) return no(`Unlocks at level ${HERO_UNLOCK2}`);
    if (H.readyAt[slot] > S.t) return no("Still recharging");
    if (isStunned(u)) return no("Your champion is stunned");
    const pot = 1 + 0.1 * (H.level - 1);
    let tx = u.x, tz = u.z;
    if (A.target === "ground") {
      if (x == null || z == null) return no("Pick a spot");
      const d = hyp(x - u.x, z - u.z); if (d > A.range + 0.5) return no("Too far away");
      tx = x; tz = z;
    }
    const ev = (extra) => S.events.push({ type: "ability", key, owner, id: u.id, x: tx, z: tz, fx: u.x, fz: u.z, radius: A.radius || 0, ...extra });
    switch (key) {
      case "rage": case "swiftfoot": addStatus(u, key, A.dur * pot); ev(); break;
      case "myrmidons": {
        const n = A.count + (H.level >= 4 ? 2 : 0);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2, p = freeSpotNear(u.x + Math.cos(a) * 1.8, u.z + Math.sin(a) * 1.8, 4) || [u.x, u.z];
          const m = S.addUnit("hoplite", owner, p[0], p[1]); m.summon = true; m.expire = S.t + A.dur * pot; m.face = u.face; S.events.push({ type: "summon", x: m.x, z: m.z, owner });
        }
        ev(); break;
      }
      case "ruse": enemiesIn(owner, tx, tz, A.radius, (e) => { if (e.type === "unit") addStatus(e, "stun", A.dur * pot); }); ev(); break;
      case "gaze": enemiesIn(owner, u.x, u.z, A.radius, (e) => { if (e.type === "unit") addStatus(e, "stun", A.dur * pot); }); ev(); break;
      case "foxeyes": S.reveals.push({ owner, x: tx, z: tz, r: A.radius, until: S.t + A.dur * pot }); ev(); break;
      case "volley": {
        const dm = A.dmg * pot; enemiesIn(owner, tx, tz, A.radius, (e) => { if (e.type === "unit") S.hurt(e, Math.max(2, dm - S.armorOf(e, "pierce")), u); else if (e.type === "building") S.hurt(e, dm * 0.3, u); }); ev(); break;
      }
      case "warcry": {
        S.forNear(u.x, u.z, A.radius + 1, (e) => { if (e.dead || e.owner !== owner || e.type !== "unit") return; if (hyp(e.x - u.x, e.z - u.z) <= A.radius) addStatus(e, "warcry", A.dur * pot); });
        addStatus(u, "warcry", A.dur * pot); ev(); break;
      }
      case "charge": {
        // gallop in a straight line as far as the ground allows, hurting and stunning everyone on the way
        const dx = tx - u.x, dz = tz - u.z, len = hyp(dx, dz) || 1, ux = dx / len, uz = dz / len; let px = u.x, pz = u.z; const hit = new Set();
        for (let s = 0.5; s <= Math.min(len, A.range); s += 0.5) {
          const nx = u.x + ux * s, nz = u.z + uz * s; if (!S.freeAt(nx, nz, 0.3)) break; px = nx; pz = nz;
          enemiesIn(owner, px, pz, A.radius, (e) => { if (e.type !== "unit" || hit.has(e.id)) return; hit.add(e.id); S.hurt(e, Math.max(3, A.dmg * pot - S.armorOf(e, "melee")), u); addStatus(e, "stun", A.stun); });
        }
        const sx = u.x, sz = u.z; u.x = px; u.z = pz; u.path = null; u.goal = null; u.needPath = false; if (u.order.type === "move") S.setOrder(u, { type: "idle" });
        S.events.push({ type: "dash", id: u.id, owner, sx, sz, x: px, z: pz }); ev({ x: px, z: pz, hits: hit.size }); break;
      }
      case "sandals": {
        const d = hyp(tx - u.x, tz - u.z) || 1; const spot = freeSpotNear(tx, tz, 3); if (!spot) return no("Can't land there");
        const sx = u.x, sz = u.z; u.x = spot[0]; u.z = spot[1]; u.path = null; u.goal = null; u.needPath = false; if (u.order.type === "move") S.setOrder(u, { type: "idle" });
        addStatus(u, "sandals", A.dur * pot); S.events.push({ type: "dash", id: u.id, owner, sx, sz, x: u.x, z: u.z, blink: true }); ev({ x: u.x, z: u.z }); break;
      }
      default: return no("Unknown ability");
    }
    H.readyAt[slot] = S.t + A.cd * (1 - 0.04 * (H.level - 1));
    return ok();
  }

  // ---- per-tick upkeep: summons fade, level-ups from unspent bonuses ----------------------------------------------
  function expireSummons() {
    for (const u of S.units) if (u.summon && !u.dead && S.t >= u.expire) { u.dead = true; u.hp = 0; u.deathT = 0; u.path = null; S.events.push({ type: "fade", x: u.x, z: u.z, id: u.id }); }
  }

  return { setupHeroes, spawnHero, grantXp, onHeroDeath, cmdRevive, finishRevive, cancelRevive, cmdAbility, abilityReady, addStatus, stOf, isStunned, heroUnit, passiveOf, expireSummons };
}
