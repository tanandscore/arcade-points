// Wrath of Olympus — missions, fates and omens (Upgrade 69).
// This plugs into the simulation the same way heroes.js and neutrals.js do. It:
//   * applies a campaign / daily / skirmish "scenario" (starting stores, blessings, handicaps),
//   * keeps score of the objectives (the main goal, bonus goals, optional "fates"),
//   * ends the war when a non-standard main goal is reached or a time limit runs out,
//   * and every few minutes offers the player an "omen": a short choice with a risk and a reward.
// No graphics in here, so it also runs on its own for testing.
import { mulberry } from "./mapgen.js";
import { FATE_POOL, OBJ_TYPES, objText } from "./campaign.js";

const hyp = Math.hypot;
const NAMES = { food: "food", wood: "wood", gold: "gold", stone: "stone" };

// ---- omens --------------------------------------------------------------------------------------------------------------
// Each option: label, desc, cost (paid first), fx (what happens).  The LAST option is what happens if you do not choose in time.
// fx keys: give/take (stores), favor, xp, buff {gather,dur}, reveal, heal, hoplites, chance {p, win, lose}
export const OMEN_TIME = 40; // seconds you have to decide
export const OMENS = [
  { id: "merchant", icon: "⛵", title: "A Phoenician Merchant", text: "A trader's ship has landed with a hold full of goods. He will deal, but only today.", options: [
    { label: "Buy gold", desc: "Pay 250 food and 150 wood. Get 400 gold.", cost: { food: 250, wood: 150 }, fx: { give: { gold: 400 } } },
    { label: "Buy stone", desc: "Pay 150 gold. Get 320 stone.", cost: { gold: 150 }, fx: { give: { stone: 320 } } },
    { label: "Send him away", desc: "Nothing happens.", fx: {} },
  ] },
  { id: "festival", icon: "🎉", title: "Harvest Festival", text: "The farmers want to celebrate. A feast would lift everyone's spirits.", options: [
    { label: "Throw a feast", desc: "Pay 200 food. Citizens gather 30% faster for two minutes.", cost: { food: 200 }, fx: { buff: { gather: 0.3, dur: 120 } } },
    { label: "Keep the grain", desc: "Store it: +80 food.", fx: { give: { food: 80 } } },
  ] },
  { id: "prophet", icon: "👁️", title: "The Blind Prophet", text: "An old man at the gate claims to see Sparta's halls through the dark. He wants a coin for his trouble.", options: [
    { label: "Listen", desc: "Pay 60 gold. Sparta's city is lit up for 35 seconds.", cost: { gold: 60 }, fx: { reveal: true } },
    { label: "Turn him away", desc: "Nothing happens.", fx: {} },
  ] },
  { id: "hoard", icon: "⚱️", title: "A Buried Hoard", text: "Workmen have struck the edge of an old treasure chamber. It might be full, or cursed.", options: [
    { label: "Dig deep", desc: "45% chance of +520 gold. Otherwise the tunnel collapses: lose 100 wood.", fx: { chance: { p: 0.45, win: { give: { gold: 520 } }, lose: { take: { wood: 100 } } } } },
    { label: "Dig a little", desc: "Safe: +110 gold.", fx: { give: { gold: 110 } } },
    { label: "Leave it", desc: "Nothing happens.", fx: {} },
  ] },
  { id: "spring", icon: "⛲", title: "A Sacred Spring", text: "A spring of clear water bursts from the hillside. The priests say it is holy.", options: [
    { label: "Drink and rest", desc: "All your people are fully healed and gain +30 favor.", fx: { heal: true, favor: 30 } },
    { label: "Fill amphorae", desc: "+140 food from the cool water and wild herbs.", fx: { give: { food: 140 } } },
    { label: "Walk on", desc: "Nothing happens.", fx: {} },
  ] },
  { id: "spearmen", icon: "🛡️", title: "Wandering Spearmen", text: "Three veteran hoplites from a defeated city ask for work.", options: [
    { label: "Hire them", desc: "Pay 130 gold. Three hoplites join you (needs 3 free homes).", cost: { gold: 130 }, needsPop: 3, fx: { hoplites: 3 } },
    { label: "Send them away", desc: "Nothing happens.", fx: {} },
  ] },
  { id: "storm", icon: "🌩️", title: "Poseidon Stirs", text: "A storm hit the coast overnight. Timber from wrecked ships lies all over the beach.", options: [
    { label: "Salvage in earnest", desc: "Pay 40 food for the workers. Get 300 wood.", cost: { food: 40 }, fx: { give: { wood: 300 } } },
    { label: "Pick up a little", desc: "+90 wood.", fx: { give: { wood: 90 } } },
  ] },
  { id: "spy", icon: "🕵️", title: "A Captured Spartan Spy", text: "Your guards caught a man counting your houses. What is to be done with him?", options: [
    { label: "Make him talk", desc: "Sparta's city is lit up for 35 seconds.", fx: { reveal: true } },
    { label: "Make an example", desc: "Your champion gains 55 experience.", fx: { xp: 55 } },
    { label: "Let him go", desc: "Nothing happens.", fx: {} },
  ] },
  { id: "games", icon: "🏅", title: "Funeral Games", text: "In honor of a fallen captain the soldiers want to hold games, as Achilles once did.", options: [
    { label: "Host the games", desc: "Pay 150 food. Your champion gains 90 experience.", cost: { food: 150 }, fx: { xp: 90 } },
    { label: "Decline", desc: "Nothing happens.", fx: {} },
  ] },
  { id: "plague", icon: "☠️", title: "Whispers of Plague", text: "A fever spreads in the lower town. Burn incense to the gods, or risk the stores.", options: [
    { label: "Burn incense", desc: "Pay 80 gold. The sickness passes.", cost: { gold: 80 }, fx: {} },
    { label: "Do nothing", desc: "Rats spoil 200 food.", fx: { take: { food: 200 } } },
  ] },
  { id: "rockfall", icon: "🪨", title: "Rockfall at the Quarry", text: "The cliff above the quarry is cracking. Shore it up now, or lose what is down there.", options: [
    { label: "Shore it up", desc: "Pay 70 wood. Nothing is lost.", cost: { wood: 70 }, fx: {} },
    { label: "Take the risk", desc: "50% chance of +200 stone. Otherwise lose 120 stone.", fx: { chance: { p: 0.5, win: { give: { stone: 200 } }, lose: { take: { stone: 120 } } } } },
  ] },
  { id: "owl", icon: "🦉", title: "The Owl of Athena", text: "A great owl circles above your Town Center and will not leave.", options: [
    { label: "Make an offering", desc: "Pay 100 gold. +60 favor and citizens gather 20% faster for 90 seconds.", cost: { gold: 100 }, fx: { favor: 60, buff: { gather: 0.2, dur: 90 } } },
    { label: "Watch it go", desc: "+25 favor.", fx: { favor: 25 } },
  ] },
];

// ---- the plug-in ---------------------------------------------------------------------------------------------------------
export function installFates(S, { scenario = null, blessings = null, HX = null } = {}) {
  const scn = scenario || { id: "none", mode: "free", primary: { type: "conquer", n: 0 } };
  const fx = blessings || { startFW: 0, xp: 0, gather: 0, bhp: 0, favor: 0, favorRate: 0, vision: 0, laurelMul: 1 };
  const P0 = S.players[0], P1 = S.players[1];
  const rnd = mulberry((S.seed || 1) * 977 + 13 + (scn.fateSeed || 0));
  const FT = { scn, fx, buffs: [], objectives: [], clockWarned: false, nextOmenAt: 0, omenLog: [], lastOmens: [] };
  S.omen = null; S.lootMul = scn.lootMul || 1;

  // ---- objectives ------------------------------------------------------------------------------------------------------
  const mk = (o, kind) => ({ id: o.id || o.type + "-" + o.n, type: o.type, n: o.n, by: o.by || 0, what: o.what || null, kind, label: objText(o), done: false, failed: false, cur: 0, at: 0 });
  FT.objectives.push(mk(scn.primary || { type: "conquer", n: 0 }, "primary"));
  for (const o of scn.guide || []) FT.objectives.push(mk(o, "guide"));
  for (const o of scn.bonus || []) FT.objectives.push(mk(o, "bonus"));
  if (scn.fates > 0) { // draw this war's fates: never two of the same type
    const pool = FATE_POOL.slice(); const r = mulberry(((S.seed || 1) * 4099 + (scn.fateSeed || 0)) >>> 0); const used = new Set();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    for (const o of pool) { if (used.has(o.type) || FT.objectives.filter((x) => x.kind === "fate").length >= scn.fates) continue; used.add(o.type); FT.objectives.push(mk(o, "fate")); }
  }
  const unitsOf = (fn) => { let n = 0; for (const u of S.units) if (!u.dead && u.owner === 0 && fn(u)) n++; return n; };
  const bldsOf = (fn) => { let n = 0; for (const b of S.buildings) if (!b.dead && b.done && b.owner === 0 && fn(b)) n++; return n; };
  function measure(o) {
    const st = P0.stats;
    switch (o.type) {
      case "survive": return S.t;
      case "lairs": return st.lairs || 0; case "relics": return st.relics || 0; case "shrines": return st.shrines || 0; case "kills": return st.kills || 0; case "razed": return st.razed || 0;
      case "villagers": return unitsOf((u) => u.cls === "villager");
      case "army": return unitsOf((u) => u.cls !== "villager" && !u.isHero && !u.summon);
      case "towers": return bldsOf((b) => b.kind === "tower"); case "temples": return bldsOf((b) => b.kind === "temple");
      case "own": return bldsOf((b) => b.kind === o.what);
      case "age": return P0.age; case "heroLevel": return P0.hero ? P0.hero.level : 0;
      case "slayHero": return (P1.hero && P1.hero.deaths) || 0;
      case "wonder": return P0.wonder || FT.wonderSeen ? 1 : 0;
      default: return 0;
    }
  }
  const isEnd = (o) => !!(OBJ_TYPES[o.type] && OBJ_TYPES[o.type].end);
  const say = (o, ok) => S.events.push({ type: "objective", id: o.id, label: o.label, kind: o.kind, ok });

  // ---- setting up the war ----------------------------------------------------------------------------------------------------
  function create() {
    const mul = scn.startMul == null ? 1 : scn.startMul;
    if (mul !== 1) for (const k of Object.keys(P0.res)) P0.res[k] = Math.round(P0.res[k] * mul);
    P0.res.food += fx.startFW; P0.res.wood += fx.startFW; P0.favor = Math.min(150, P0.favor + fx.favor);
    if (fx.xp > 0 && HX) HX.grantXp(0, fx.xp);
    if (fx.bhp > 0) for (const b of S.buildings) if (b.owner === 0) { const m = 1 + fx.bhp; b.maxHp = Math.round(b.maxHp * m); b.hp = Math.round(b.hp * m); }
    FT.nextOmenAt = scn.omenMul === 0 ? Infinity : (170 + rnd() * 60) * (scn.omenMul || 1);
    if (scn.mode === "campaign" && scn.intro) S.events.push({ type: "mission", name: scn.name });
  }
  FT.bhpMul = (owner) => (owner === 0 ? 1 + fx.bhp : 1);
  FT.gatherBonus = (owner) => (owner === 0 ? fx.gather + (scn.gatherBonus || 0) + FT.buffs.reduce((t, b) => (b.until > S.t ? t + b.gather : t), 0) : 0);
  FT.favorRate = (owner) => (owner === 0 ? fx.favorRate : 0);
  FT.vision = fx.vision;

  // ---- omens ---------------------------------------------------------------------------------------------------------------
  function popFree() { return S.capOf(0) - S.popOf(0) - P0.reserved; }
  function pickOmen() {
    const ok = OMENS.filter((o) => !FT.lastOmens.includes(o.id) && o.options.every((op) => !op.needsPop || popFree() >= op.needsPop || o.options.length > 1));
    const pool = ok.length ? ok : OMENS; return pool[Math.floor(rnd() * pool.length)];
  }
  function offerOmen() {
    const o = pickOmen(); FT.lastOmens.push(o.id); if (FT.lastOmens.length > 4) FT.lastOmens.shift();
    S.omen = { id: o.id, icon: o.icon, title: o.title, text: o.text, until: S.t + OMEN_TIME, options: o.options.map((op) => ({ label: op.label, desc: op.desc, cost: op.cost || null, needsPop: op.needsPop || 0 })) };
    S.events.push({ type: "omen", id: o.id, title: o.title });
  }
  function describe(f, got) {
    const bits = [];
    if (f.give) for (const k of Object.keys(f.give)) bits.push(`+${f.give[k]} ${NAMES[k]}`);
    if (f.take) for (const k of Object.keys(f.take)) bits.push(`-${got && got.took ? got.took[k] : f.take[k]} ${NAMES[k]}`);
    if (f.favor) bits.push(`+${f.favor} favor`); if (f.xp) bits.push(`+${f.xp} experience`); if (f.heal) bits.push("everyone healed");
    if (f.buff) bits.push(`gather +${Math.round(f.buff.gather * 100)}% for ${Math.round(f.buff.dur)}s`); if (f.reveal) bits.push("Sparta revealed"); if (f.hoplites) bits.push(`${got ? got.hoplites : f.hoplites} hoplites join`);
    return bits.join(", ");
  }
  function applyFx(f) {
    const got = { took: {}, hoplites: 0 };
    if (f.chance) { const win = rnd() < f.chance.p; const sub = win ? f.chance.win : f.chance.lose; const r = applyFx(sub); return { text: (win ? "Fortune smiles: " : "Bad luck: ") + r.text, good: win }; }
    if (f.give) for (const k of Object.keys(f.give)) P0.res[k] += f.give[k];
    if (f.take) for (const k of Object.keys(f.take)) { const t = Math.min(P0.res[k], f.take[k]); P0.res[k] -= t; got.took[k] = Math.round(t); }
    if (f.favor) P0.favor = Math.min(150, P0.favor + f.favor);
    if (f.xp && HX) HX.grantXp(0, f.xp);
    if (f.buff) FT.buffs.push({ owner: 0, gather: f.buff.gather, until: S.t + f.buff.dur });
    if (f.reveal) { const foe = S.map.starts[1]; S.reveals.push({ owner: 0, x: foe.cx, z: foe.cz, r: 20, until: S.t + 35 }); S.events.push({ type: "farsight", x: foe.cx, z: foe.cz, radius: 20, owner: 0 }); }
    if (f.heal) { for (const u of S.units) if (!u.dead && u.owner === 0) u.hp = u.maxHp; S.events.push({ type: "buff", key: "heal", owner: 0 }); }
    if (f.hoplites) {
      const tc = S.buildings.find((b) => !b.dead && b.done && b.owner === 0 && b.kind === "town_center");
      for (let i = 0; i < f.hoplites && tc; i++) { if (popFree() < 1) break; const sp = S.spawnPoint(tc, null); const u = S.addUnit("hoplite", 0, sp[0] + (i - 1) * 0.5, sp[1]); got.hoplites++; S.events.push({ type: "summon", x: u.x, z: u.z, owner: 0 }); }
    }
    return { text: describe(f, got) || "Nothing changes", good: !(f.take && !f.give) };
  }
  function cmdOmen(owner, idx) {
    if (owner !== 0 || !S.omen) return { ok: false, reason: "No omen to answer" };
    const def = OMENS.find((o) => o.id === S.omen.id); const op = def && def.options[idx]; if (!op) return { ok: false, reason: "No such choice" };
    for (const k of Object.keys(op.cost || {})) if (P0.res[k] < op.cost[k]) return { ok: false, reason: `Not enough ${NAMES[k]}` };
    if (op.needsPop && popFree() < op.needsPop) return { ok: false, reason: "Build more houses first" };
    for (const k of Object.keys(op.cost || {})) P0.res[k] -= op.cost[k];
    const r = applyFx(op.fx || {}); S.omen = null; FT.omenLog.push({ id: def.id, choice: idx, t: Math.round(S.t) });
    S.events.push({ type: "omenResult", title: def.title, choice: op.label, text: r.text, good: r.good });
    FT.nextOmenAt = S.t + (150 + rnd() * 80) * (scn.omenMul || 1);
    return { ok: true, text: r.text };
  }
  function omenTick() {
    if (S.omen) { if (S.t >= S.omen.until) { const def = OMENS.find((o) => o.id === S.omen.id); const last = def.options.length - 1; const op = def.options[last]; S.omen = null; const r = applyFx(op.fx || {}); FT.omenLog.push({ id: def.id, choice: -1, t: Math.round(S.t) }); S.events.push({ type: "omenResult", title: def.title, choice: "The moment passed", text: r.text, good: r.good, late: true }); FT.nextOmenAt = S.t + (150 + rnd() * 80) * (scn.omenMul || 1); } return; }
    if (S.t >= FT.nextOmenAt) offerOmen();
  }

  // ---- ticking: objectives, clocks, omens --------------------------------------------------------------------------------------
  let acc = 0;
  function tick(dt) {
    if (S.over) return; acc -= dt; if (acc > 0) return; acc = 0.5;
    const hd = (P0.hero && P0.hero.deaths) || 0;
    for (const o of FT.objectives) {
      if (o.done || o.failed) continue;
      if (o.type === "conquer") continue;
      if (isEnd(o)) { // only judged at the end, but they can fail early
        if (o.type === "noHeroLoss" && hd > 0) { o.failed = true; say(o, false); }
        else if (o.type === "keepLosses" && (P0.stats.lost || 0) > o.n) { o.failed = true; say(o, false); }
        else if (o.type === "winBy" && S.t > o.n) { o.failed = true; say(o, false); }
        continue;
      }
      o.cur = measure(o);
      if (o.type === "wonder" && P0.wonder) FT.wonderSeen = true;
      if (o.cur >= o.n) { if (o.by && S.t > o.by) { o.failed = true; say(o, false); } else { o.done = true; o.at = S.t; say(o, true); } }
      else if (o.by && S.t > o.by) { o.failed = true; say(o, false); }
    }
    // the main goal
    const prim = FT.objectives[0];
    if (prim.type !== "conquer" && prim.done && !S.over) { S.over = { winner: 0, t: S.t, reason: prim.type }; S.events.push({ type: "over", winner: 0, reason: prim.type }); return; }
    if (scn.timeLimit && !S.over) {
      const left = scn.timeLimit - S.t;
      if (left <= 60 && !FT.clockWarned) { FT.clockWarned = true; S.events.push({ type: "alert", kind: "clock", x: 0, z: 0, text: "One minute left! Time is running out." }); }
      if (left <= 0) { S.over = { winner: 1, t: S.t, reason: "time" }; S.events.push({ type: "over", winner: 1, reason: "time" }); return; }
    }
    omenTick();
  }

  // what the HUD shows as the countdown, if any
  function clock() {
    const prim = FT.objectives[0];
    if (prim.type === "survive") return { label: "Hold out", left: Math.max(0, Math.ceil(prim.n - S.t)), good: true };
    if (scn.timeLimit) return { label: "Time left", left: Math.max(0, Math.ceil(scn.timeLimit - S.t)), good: false };
    return null;
  }
  // called when the war is over: judge the "end" objectives and total the stars
  function finish(winner, t) {
    const won = winner === 0; const hd = (P0.hero && P0.hero.deaths) || 0;
    for (const o of FT.objectives) {
      if (o.kind === "primary") { o.done = won && !(S.over && S.over.reason === "time"); continue; }
      if (o.done || o.failed) continue;
      if (isEnd(o)) { const ok = o.type === "winBy" ? won && t <= o.n : o.type === "noHeroLoss" ? won && hd === 0 : o.type === "keepLosses" ? won && (P0.stats.lost || 0) <= o.n : false; o.done = ok; o.failed = !ok; if (ok) o.at = t; }
      else { o.cur = measure(o); if (o.cur >= o.n && (!o.by || t <= o.by)) { o.done = true; o.at = t; } }
    }
    const bonusDone = FT.objectives.filter((o) => o.kind === "bonus" && o.done).length;
    return { objectives: FT.objectives.map((o) => ({ id: o.id, label: o.label, kind: o.kind, done: o.done, failed: o.failed, cur: Math.min(o.cur, o.n), n: o.n })), stars: won ? 1 + bonusDone : 0, bonusDone, mission: scn.mission || null, mode: scn.mode || "free", scenario: scn.id, twist: scn.twist ? scn.twist.name : null };
  }
  // numbers for the screen
  function view() {
    const obj = FT.objectives.map((o) => ({ id: o.id, label: o.label, kind: o.kind, done: o.done, failed: o.failed, cur: Math.min(Math.floor(o.cur), o.n), n: o.n, show: !isEnd(o) && o.type !== "conquer" }));
    const omen = S.omen ? { ...S.omen, left: Math.max(0, Math.ceil(S.omen.until - S.t)), options: S.omen.options.map((op) => ({ ...op, enabled: Object.keys(op.cost || {}).every((k) => P0.res[k] >= op.cost[k]) && (!op.needsPop || popFree() >= op.needsPop), reason: Object.keys(op.cost || {}).find((k) => P0.res[k] < op.cost[k]) ? "Not enough " + Object.keys(op.cost).find((k) => P0.res[k] < op.cost[k]) : op.needsPop && popFree() < op.needsPop ? "Needs free homes" : null })) } : null;
    return { objectives: obj, omen, clock: clock(), name: scn.name || "", mode: scn.mode || "free", mission: scn.mission || null };
  }

  Object.assign(FT, { create, tick, cmdOmen, finish, view, clock, offerOmen });
  S.cmdOmen = cmdOmen; S.fates = FT;
  return FT;
}
