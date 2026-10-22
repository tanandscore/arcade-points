// The computer opponent. It grows an economy, builds a base, trains an army, climbs the ages
// and sends attack waves — using exactly the same commands the player uses.
import { N, UNITS, BUILDINGS, TECHS, DIFFICULTY, AGES, GODS, GOD_CHOICES, HEROES, ABILITIES, canAfford } from "./defs.js";

const hyp = Math.hypot;

export function createAI(S, pid, diffKey) {
  const diff = DIFFICULTY[diffKey] || DIFFICULTY.veteran; const me = S.players[pid]; const enemyId = 1 - pid;
  const start = S.map.starts[pid], foe = S.map.starts[enemyId];
  const home = { x: start.cx, z: start.cz };
  const rally = (() => { const dx = foe.cx - start.cx, dz = foe.cz - start.cz, d = hyp(dx, dz); return { x: start.cx + (dx / d) * 15, z: start.cz + (dz / d) * 15 }; })();
  let think = 0.5 + pid * 0.2, wave = 0, mode = "build", launchSize = 0, launchT = 0, stageT = 0, lastBalance = 0, warned = false;
  const A = { mode: () => mode, wave: () => wave };

  const mine = (fn) => S.units.filter((u) => !u.dead && u.owner === pid && fn(u));
  const myB = (kind, doneOnly = true) => S.buildings.filter((b) => !b.dead && b.owner === pid && (!kind || b.kind === kind) && (!doneOnly || b.done));
  const sites = () => S.buildings.filter((b) => !b.dead && b.owner === pid && !b.done);
  const army = () => mine((u) => u.cls !== "villager");
  const free = (x, z) => x >= 1 && z >= 1 && x < N - 1 && z < N - 1 && S.occId[z * N + x] === 0 && !S.map.blockedBase[z * N + x];

  function spotFree(w, ix, iz, gap) {
    for (let j = iz - gap; j < iz + w + gap; j++) for (let i = ix - gap; i < ix + w + gap; i++) if (!free(i, j)) return false;
    return true;
  }
  function findSpot(kind, cx, cz, rmin, rmax, gap = 1, toward = null) {
    const w = BUILDINGS[kind].size; let best = null, bs = 1e9;
    for (let r = rmin; r <= rmax; r++) {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; const ix = Math.round(cx + dx - w / 2), iz = Math.round(cz + dz - w / 2);
        if (!spotFree(w, ix, iz, gap) || !S.placementOk(kind, ix, iz)) continue;
        const sc = toward ? hyp(ix + w / 2 - toward.x, iz + w / 2 - toward.z) : r + S.rnd() * 1.5;
        if (sc < bs) { bs = sc; best = [ix, iz]; }
      }
      if (best && !toward) return best;
    }
    return best;
  }

  function pickBuilders(x, z, n = 1) {
    const vs = mine((u) => u.cls === "villager" && u.order.type !== "build" && u.order.type !== "repair");
    vs.sort((a, b) => { const ia = a.order.type === "idle" ? -100 : 0, ib = b.order.type === "idle" ? -100 : 0; return hyp(a.x - x, a.z - z) + ia - (hyp(b.x - x, b.z - z) + ib); });
    return vs.slice(0, n).map((u) => u.id);
  }
  function build(kind, spot, n = 1) {
    if (!spot) return false; const d = BUILDINGS[kind]; if (me.age < d.age || !canAfford(me.res, d.cost)) return false;
    const ids = pickBuilders(spot[0], spot[1], n); if (!ids.length) return false;
    const r = S.cmdPlace(pid, kind, spot[0], spot[1], ids); if (!r.ok) return false;
    // never wall ourselves in: if this new building seals the town off from the rest of the map, take it back
    const nb = S.buildings.reduce((m, b) => (b.owner === pid && !b.dead && (!m || b.id > m.id) ? b : m), null);
    S.relabel(); if (nb && S.labelOf(home.x, home.z) !== S.labelOf(rally.x, rally.z)) { S.cmdDelete(pid, nb.id); S.relabel(); return false; }
    return true;
  }

  const tcs = () => myB("town_center");
  const mainTC = () => tcs()[0];
  const vills = () => mine((u) => u.cls === "villager");
  const gatheringCount = (res) => mine((u) => u.cls === "villager" && u.order.type === "gather" && u.order.res === res).length;

  function villagerTarget() { return diff.villagers + me.age * 5; }

  function economy() {
    const tc = mainTC(); if (!tc) return;
    const vs = vills(); const queuedV = S.buildings.reduce((n, b) => n + (b.owner === pid ? b.queue.filter((q) => q.kind === "villager").length : 0), 0);
    // train citizens
    if (vs.length + queuedV < villagerTarget()) for (const t of tcs()) { if (t.queue.length < 2 && S.cmdTrain(pid, t.id, "villager").ok) { /* ok */ } }
    // houses
    const popRoom = me.popCap - (me.pop + me.reserved);
    const housesBuilding = sites().filter((b) => b.kind === "house").length;
    if (popRoom <= (me.age >= 1 ? 8 : 4) && housesBuilding < (me.age >= 1 ? 2 : 1) && me.popCap < 200) {
      const spot = findSpot("house", tc.x, tc.z, 5, 16, 1, null); build("house", spot, 1);
    }
    // storehouses beside far-away resources
    if (vs.length >= 9) {
      const dropAt = (x, z, r) => S.buildings.some((b) => !b.dead && b.owner === pid && b.def.drop && hyp(b.x - x, b.z - z) < r + b.w / 2);
      for (const res of ["wood", "gold", "stone"]) {
        if (sites().some((b) => b.kind === "storehouse")) break;
        const workers = mine((u) => u.cls === "villager" && u.order.type === "gather" && u.order.res === res);
        if (!workers.length) continue;
        const nodes = S.nodes.filter((n) => !n.dead && n.res === res && workers.some((w) => w.order.target === n.id));
        let far = nodes.find((n) => !dropAt(n.x, n.z, 6.5)); if (!far) continue;
        const spot = findSpot("storehouse", far.x, far.z, 2, 6, 0, { x: far.x, z: far.z }); if (spot && build("storehouse", spot, 1)) break;
      }
    }
    // farms when berries are gone
    const berriesLeft = S.nodes.some((n) => !n.dead && n.res === "food" && hyp(n.x - tc.x, n.z - tc.z) < 16);
    const farms = S.buildings.filter((b) => !b.dead && b.owner === pid && b.def.farm);
    const foodWorkers = gatheringCount("food");
    const berryCap = Math.min(5, S.nodes.filter((n) => !n.dead && n.res === "food" && hyp(n.x - tc.x, n.z - tc.z) < 16).length);
    const foodTarget = Math.ceil(vs.length * (me.age === 0 ? 0.42 : me.age === 1 ? 0.36 : 0.32));
    const unmannedFarms = farms.filter((b) => !b.done || !(b.workerId && S.get(b.workerId) && !S.get(b.workerId).dead)).length;
    const wantFarms = Math.max(0, foodTarget - berryCap) + 1;
    if (farms.length < wantFarms && unmannedFarms < 2 && sites().filter((b) => b.def.farm).length < 2 && me.res.wood >= 60) { const spot = findSpot("farm", tc.x, tc.z, 3, 10, 0, null); build("farm", spot, 1); }
    assignVillagers(tc, vs, berriesLeft, farms);
  }

  function assignVillagers(tc, vs, berriesLeft, farms) {
    const total = vs.length; if (!total) return;
    const early = me.age === 0;
    const frac = early ? { food: 0.4, wood: 0.38, gold: 0.18, stone: 0.04 } : me.age === 1 ? { food: 0.34, wood: 0.34, gold: 0.24, stone: 0.08 } : { food: 0.3, wood: 0.3, gold: 0.28, stone: 0.12 };
    const cnt = { food: gatheringCount("food"), wood: gatheringCount("wood"), gold: gatheringCount("gold"), stone: gatheringCount("stone") };
    // a want for stone only if useful
    if (me.res.stone > 500) frac.stone = 0; if (me.res.gold > 700) frac.gold *= 0.4; if (me.res.food > 900) frac.food *= 0.6; if (me.res.wood > 450) frac.wood *= 0.45; if (me.res.food < 120) frac.food *= 1.35; if (me.res.gold < 80 && me.age >= 1) frac.gold *= 1.4;
    const idle = vs.filter((u) => u.order.type === "idle" && u.carry.amt === 0 || (u.order.type === "idle"));
    for (const u of idle) {
      let bestR = "wood", bd = -1e9; for (const r of Object.keys(frac)) { const def = frac[r] * total - cnt[r]; if (def > bd) { bd = def; bestR = r; } }
      if (bestR === "food") {
        const bush = S.nearestNode(tc.x, tc.z, "food", 16, u); const farm = S.nearestFarm(u, 30);
        if (bush) { S.startGather(u, bush); cnt.food++; continue; } if (farm) { S.startGather(u, farm); cnt.food++; continue; }
        bestR = "wood";
      }
      let n = null;
      // nearest node of that resource to the closest drop-off
      let bs = 1e9; for (const nd of S.nodes) { if (nd.dead || nd.res !== bestR || hyp(nd.x - u.x, nd.z - u.z) > 60 || !S.nodeReachable(u, nd)) continue; const ds = Math.min(...S.buildings.filter((b) => !b.dead && b.owner === pid && b.done && b.def.drop).map((b) => hyp(b.x - nd.x, b.z - nd.z))); const s = ds + hyp(nd.x - u.x, nd.z - u.z) * 0.15; if (s < bs) { bs = s; n = nd; } }
      if (!n && bestR !== "wood") { n = S.nearestNode(tc.x, tc.z, "wood", 40, u); bestR = "wood"; }
      if (n) { S.startGather(u, n); cnt[bestR]++; }
    }
    // keep the mix roughly right by moving one worker at a time from the most crowded job to the emptiest
    if (S.t - lastBalance > 1.8 && total >= 8) {
      lastBalance = S.t;
      let need = null, nd = 0.9, over = null, od = 0.9;
      for (const r of Object.keys(frac)) { const d = frac[r] * total - cnt[r]; if (d > nd) { nd = d; need = r; } if (-d > od) { od = -d; over = r; } }
      if (need && over) {
        const donor = vs.find((u) => u.order.type === "gather" && u.order.res === over && u.carry.amt < 4);
        if (donor) {
          let n = null;
          if (need === "food") n = S.nearestNode(tc.x, tc.z, "food", 16) || S.nearestFarm(donor, 30); else n = S.nearestNode(tc.x, tc.z, need, 40);
          if (n) S.startGather(donor, n);
        }
      }
    }
  }

  function wantCounts() {
    const t = S.t, d = diffKey;
    const barr = d === "recruit" ? (t > 420 ? 2 : 1) : d === "veteran" ? (t > 300 ? 2 : 1) + (t > 700 ? 1 : 0) : (t > 200 ? 2 : 1) + (t > 500 ? 1 : 0);
    return { barracks: barr, archery: me.age >= 1 ? (d === "recruit" ? 1 : d === "veteran" ? 1 : 2) : 0, stable: me.age >= 1 ? (d === "elite" ? 2 : 1) : 0, siege: me.age >= 2 ? (d === "recruit" ? 0 : d === "veteran" ? 1 : 2) : 0, towers: diff.towers && me.age >= 1 ? (d === "elite" ? 4 : 2) : 0 };
  }
  function military() {
    const tc = mainTC(); if (!tc) return;
    const vs = vills();
    // age up
    const nextAge = AGES[me.age + 1];
    if (nextAge && !me.ageBusy && vs.length >= (me.age === 0 ? diff.villagers - 4 : diff.villagers + 2) && army().length >= (me.age === 0 ? 3 : 8) && canAfford(me.res, nextAge.cost)) { { const ch = GOD_CHOICES[me.age + 1]; S.cmdAge(pid, tc.id, ch ? ch[Math.floor(S.rnd() * ch.length)] : null); } }
    // buildings
    const want = wantCounts(); const pending = sites();
    if (vs.length >= 10 && pending.length < 2) {
      const spots = { barracks: [home.x, home.z, 6, 20], archery_range: [home.x, home.z, 6, 20], stable: [home.x, home.z, 6, 20], siege_workshop: [home.x, home.z, 7, 22] };
      const need = [["barracks", "barracks", want.barracks], ["archery_range", "archery", want.archery], ["stable", "stable", want.stable], ["siege_workshop", "siege", want.siege]];
      for (const [kind, , n] of need) { if (myB(kind, false).length < n && me.res.wood >= BUILDINGS[kind].cost.wood && canAfford(me.res, BUILDINGS[kind].cost)) { const sp = spots[kind]; const spot = findSpot(kind, sp[0], sp[1], sp[2], sp[3], 1, rally); if (build(kind, spot, 2)) break; } }
      // towers
      if (myB("tower", false).length < want.towers && pending.length < 2 && canAfford(me.res, BUILDINGS.tower.cost)) {
        const a = Math.atan2(foe.cz - start.cz, foe.cx - start.cx) + (S.rnd() - 0.5) * 1.6; const spot = findSpot("tower", home.x + Math.cos(a) * 9, home.z + Math.sin(a) * 9, 0, 3, 1, null); build("tower", spot, 1);
      }
    }
    // research
    if (diff.techs && vs.length >= 12) {
      const tryTech = (key) => { const t = TECHS[key]; if (me.techs.has(key) || me.age < t.age) return false; const bs = myB(t.from).filter((b) => b.queue.length < 1); if (!bs.length) return false; return S.cmdResearch(pid, bs[0].id, key).ok; };
      for (const k of ["plow", "axes", "picks", "melee", "armor", "arrows"]) { if (me.res.gold < 140 && (TECHS[k].cost.gold || 0) > 0) continue; if (tryTech(k)) break; }
    }
    // a Temple (for revives, myth beasts and powers), then the Wonder when rich
    if (me.age >= 1 && vs.length >= 12 && pending.length < 2 && myB("temple", false).length < 1 && canAfford(me.res, BUILDINGS.temple.cost)) { const spot = findSpot("temple", home.x, home.z, 6, 20, 1, null); build("temple", spot, 2); }
    if (me.age >= 2 && diffKey !== "recruit" && !myB("wonder", false).length && S.t > (diffKey === "elite" ? 700 : 1000) && myB("temple").length && canAfford(me.res, BUILDINGS.wonder.cost) && army().length >= 12) { const spot = findSpot("wonder", home.x, home.z, 8, 24, 1, null); build("wonder", spot, 3); }
    // train soldiers
    { const cap = Math.round(diff.wave * (1 + wave * 0.35) * 1.3) + 2; if (army().length >= cap) return; } // do not stockpile a huge first army
    const economyFirst = vs.length < Math.min(10, villagerTarget()) ? 0 : 1; if (!economyFirst) return;
    const keepFood = vs.length < villagerTarget() ? 60 : 0;
    const train = (bKind, kind) => { for (const b of myB(bKind)) { if (b.queue.length >= 2) continue; const c = UNITS[kind].cost; if ((me.res.food - (c.food || 0)) < keepFood) continue; if (S.cmdTrain(pid, b.id, kind).ok) { return true; } } return false; };
    const comp = army(); const count = (k) => comp.filter((u) => u.kind === k).length;
    const nH = count("hoplite"), nA = count("archer"), nC = count("horseman"), nS = count("catapult");
    if (me.age >= 2 && nS < Math.max(1, Math.floor(comp.length / 6)) && diffKey !== "recruit") train("siege_workshop", "catapult");
    if (me.age >= 1) {
      if (nC < comp.length * 0.22) train("stable", "horseman");
      if (nA < comp.length * 0.35 + 2) train("archery_range", "archer");
    }
    if (me.age >= 2 && myB("temple").length && comp.length >= 8) { for (const k of ["minotaur", "centaur", "talos"]) if (UNITS[k].god && me.gods.includes(UNITS[k].god) && count(k) < 3) { if (train("temple", k)) break; } }
    train("barracks", "hoplite");
    // always keep something coming
    if (me.age >= 1) { train("archery_range", "archer"); train("stable", "horseman"); }
  }

  function enemyNear(x, z, r) {
    let best = null, bd = r;
    S.forNear(x, z, r, (e) => { if (e.dead || e.owner !== enemyId) return; const d = hyp(e.x - x, e.z - z); if (d < bd) { bd = d; best = e; } });
    return best;
  }
  function nearestEnemyBuilding(x, z) {
    let best = null, bd = 1e9; for (const b of S.buildings) { if (b.dead || b.owner !== enemyId) continue; const d = hyp(b.x - x, b.z - z) - (b.kind === "town_center" ? 6 : 0) - (b.def.arrows ? -3 : 0); if (d < bd) { bd = d; best = b; } } return best;
  }
  function control() {
    const a = army(); if (!a.length) { if (mode === "attack") { mode = "build"; wave++; } return; }
    // defend the home base
    let intruder = null; for (const b of myB(null, false)) { const e = enemyNear(b.x, b.z, 13); if (e) { intruder = e; break; } }
    if (!intruder) for (const u of vills()) { const e = enemyNear(u.x, u.z, 9); if (e && e.cls !== "villager") { intruder = e; break; } }
    if (intruder && mode !== "attack") {
      for (const u of a) if (u.order.type === "idle" || (u.order.type === "move" && !u.order.attackMove)) S.cmdMove(pid, [u.id], intruder.x, intruder.z, true);
    } else if (intruder && mode === "attack" && a.filter((u) => hyp(u.x - home.x, u.z - home.z) < 18).length) {
      const near = a.filter((u) => hyp(u.x - home.x, u.z - home.z) < 22 && (u.order.type === "idle")); if (near.length) S.cmdMove(pid, near.map((u) => u.id), intruder.x, intruder.z, true);
    }
    if (mode === "build") {
      const idle = a.filter((u) => u.order.type === "idle" && hyp(u.x - rally.x, u.z - rally.z) > 6);
      if (idle.length) S.cmdMove(pid, idle.map((u) => u.id), rally.x, rally.z, true);
      const sizeNeeded = Math.round(diff.wave * (1 + wave * 0.35)); const timeOk = S.t >= diff.firstAttack * (wave === 0 ? 1 : 0.3) + (wave > 0 ? launchT : 0);
      if (wave === 0 && !warned && S.t > diff.firstAttack - 75) { warned = true; S.events.push({ type: "alert", kind: "army", x: rally.x, z: rally.z, text: "Scouts report Sparta is massing an army! Train hoplites and build a tower." }); }
      const gathered = a.filter((u) => hyp(u.x - rally.x, u.z - rally.z) < 12).length;
      if (a.length >= sizeNeeded * 0.8 && timeOk && gathered >= a.length * 0.65) {
        mode = "attack"; launchSize = a.length; launchT = S.t; const t = nearestEnemyBuilding(foe.cx, foe.cz); S.events.push({ type: "warhorn", x: home.x, z: home.z });
        for (const u of a) S.cmdMove(pid, [u.id], t ? t.x : foe.cx, t ? t.z : foe.cz, true);
      }
    } else {
      // keep the army pushing at targets
      const idle = a.filter((u) => u.order.type === "idle" || (u.order.type === "move" && hyp(u.order.x - u.x, u.order.z - u.z) < 3));
      if (idle.length) {
        const g = idle[0]; const t = nearestEnemyBuilding(g.x, g.z); const e = enemyNear(g.x, g.z, 14);
        const target = e && hyp(e.x - g.x, e.z - g.z) < 10 ? e : t; if (target) S.cmdMove(pid, idle.map((u) => u.id), target.x, target.z, true);
      }
      if (a.length < launchSize * 0.3 || S.t - launchT > 360) { mode = "build"; wave++; S.cmdMove(pid, a.map((u) => u.id), rally.x, rally.z, false); }
    }
  }

  // the champion: brings itself back, and uses its abilities when a fight is on
  function champion() {
    const H = me.hero; if (!H) return;
    if (H.state === "dead") { S.cmdRevive(pid); return; }
    const u = H.unit; if (!u || u.dead) return;
    const foes = []; S.forNear(u.x, u.z, 9, (e) => { if (!e.dead && e.owner === enemyId && e.type === "unit") foes.push(e); });
    const keys = HEROES[me.heroId].abilities;
    // stay with the home guard while building; fight with the army otherwise
    if (foes.length >= 2 || (foes.length && u.hp < u.maxHp * 0.6)) {
      for (let sl = 0; sl < 2; sl++) { if (!S.hero.abilityReady(pid, sl)) continue; const A = ABILITIES[keys[sl]]; let cx = 0, cz = 0; for (const f of foes) { cx += f.x; cz += f.z; } cx /= foes.length; cz /= foes.length;
        const d = hyp(cx - u.x, cz - u.z); if (A.target === "ground" && d > A.range) continue; if (A.target === "self" && d > 6) continue; if (S.cmdAbility(pid, sl, cx, cz).ok) break; }
    }
    if (u.hp < u.maxHp * 0.3 && foes.length > 2 && u.order.type !== "move") S.cmdMove(pid, [u.id], home.x, home.z, false);
    // react to a Wonder going up
    const ow = S.players[enemyId].wonder; if (ow && mode === "build" && army().length >= 6) { const wb = S.get(ow.bid); if (wb && !wb.dead) { mode = "attack"; launchSize = army().length; launchT = S.t; for (const a of army()) S.cmdMove(pid, [a.id], wb.x, wb.z, true); } }
  }

  A.update = (dt) => {
    think -= dt; if (think > 0) return; think = 0.6;
    if (me.defeated) return;
    economy(); military(); control(); champion();
  };
  return A;
}
