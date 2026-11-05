// Midnight Burn — Upgrade 64: police pursuit ("Heat").
//
// Drive like a lunatic and the city notices. Speeding, smashing into traffic and running people over raises your HEAT. Patrol cars appear behind you
// and chase; more heat means more cars, faster cars and rougher driving. Two ways it ends: you shake them (get far away and stay hidden for a few
// seconds) and are paid a bounty that grows with the heat you survived, or they box you in and you are BUSTED: a fine and a fresh start.
// This file is plain data (no graphics) so the same numbers run in the tests. The chase itself lives in sim.js.
export const HEAT = {
  SPEEDING: 40,        // m/s (about 145 km/h): faster than this and the city is watching
  SPEED_PTS: 5,        // heat points per second of speeding
  HIT_PTS: 22, PED_PTS: 40, RAM_PTS: 8,
  STEPS: [0, 25, 70, 140, 240, 380, 600], // points needed for level 0..6 (Upgrade 73: six levels; level 6 "Blackout" also needs BLACKOUT_AFTER seconds at level 5)
  DECAY: 2.2,          // points lost per second when no patrol car is chasing
  COPS: [0, 2, 3, 5, 6, 8, 10],           // patrol cars in the chase per level (Upgrade 73; capped at 10 so the browser keeps its frame rate)
  SPAWN_EVERY: [0, 6, 5, 4, 3.5, 3, 2.5], // seconds between new patrol cars per level
  SPAWN_MIN: 85, SPAWN_MAX: 140, DESPAWN: 420,
  ESCAPE_DIST: 210, ESCAPE_TIME: 10,       // far away and out of sight this long = escaped (level 1; harder at higher levels, see escapeDist / escapeTime)
  BUST_R: 9, BUST_SPEED: 14, BUST_TIME: 3, // a car this close while you are almost stopped fills the busted meter
  REPLAN: 1.6,
};
// Upgrade 73: CHASE CASH. While the police are on you, cash builds up every second (x a multiplier that climbs the longer you stay in the fight).
// It is only yours if you ESCAPE (or reach a hideout). Get busted and it is gone. Wrecking patrol cars and near misses pay straight away and are kept.
// Upgrade 76: these numbers were checked against what events pay (about 300 to 1,400 each) and the shop prices (3,000 to 35,000). A heat-3 chase pays about 3x an event per minute, a heat-5 chase about 8x. The report's big numbers would only make sense if every price were multiplied too, which adds nothing but bigger digits.
export const CHASE = {
  PER_SEC: [0, 2, 3, 6, 10, 17, 30],     // cash per second at heat 0..6, before the multiplier
  WRECK:   [0, 35, 60, 110, 180, 270, 420], // paid at once for every patrol car you wreck
  NEAR:    [0, 4, 5, 6, 9, 12, 18],          // paid at once for a near miss during a chase
  MULT_STEP: 25, MULT_MAX: 5,              // the multiplier goes up by one after this many seconds in the chase, to x5
  LOSE_GAP: 4,                             // seconds with nobody chasing you before the multiplier drops back to x1
  BLACKOUT_AFTER: 90,                      // seconds at heat 5 before heat 6 can start
  COP_HP: 60, HIT_MIN: 3.5, HIT_DMG: 5,    // a patrol car wrecks after enough hard hits: each hit above HIT_MIN does impact x HIT_DMG damage
};
export const heatName = (l) => ["", "NOTICE", "PURSUIT", "MANHUNT", "CRACKDOWN", "WAR", "BLACKOUT"][Math.max(0, Math.min(6, l | 0))];
export const escapeDist = (l) => HEAT.ESCAPE_DIST + Math.max(0, l - 1) * 40;              // level 1: 210 m ... level 6: 410 m
export const escapeTime = (l) => HEAT.ESCAPE_TIME + Math.max(0, l - 1) * 1.6;              // level 1: 10 s ... level 6: 18 s
export const COP_LOOK = { color: "#eef1f4", finish: "gloss", livery: { type: "side", color: "#1b3fa8" }, rims: { style: "classic", color: "#c9ced4" }, kit: "stock" };
export const heatLevel = (pts) => { let l = 0; for (let i = 1; i < HEAT.STEPS.length; i++) if (pts >= HEAT.STEPS[i]) l = i; return l; };
// Upgrade 76: the escape bounty now climbs faster with the peak heat (a squared term), so a heat-5 or heat-6 escape is a real prize on top of the Chase Cash. Heat 1 to 3 pay about the same as before.
export const bountyFor = (peak, playerLevel) => ({ cash: Math.round((120 + peak * 140 + peak * peak * peak * 12) * (1 + playerLevel * 0.08)), xp: 30 + peak * 30 });
export const fineFor = (peak, earned, cash) => Math.min(cash, Math.round(100 + 0.01 * earned * (0.5 + peak * 0.5)));

// ---- Upgrade 77: police unit types. Each has one rule a player can learn and one counter. -----------------------------------------------------------------
const LOOK = (color, livery, rim = "#c9ced4") => ({ color, finish: "gloss", livery, rims: { style: "classic", color: rim }, kit: "stock" });
export const UNITS = {
  patrol:      { id: "patrol", name: "PATROL", car: "cop_a", look: COP_LOOK, hp: 60, spd: 0, pay: 1, siren: true, tip: "" },
  interceptor: { id: "interceptor", name: "INTERCEPTOR", car: "cop_b", look: LOOK("#141821", { type: "side", color: "#e8edf2" }), hp: 55, spd: 0.07, pay: 1.5, siren: true, lead: true, nos: true, tip: "FAST. TRIES TO CUT IN FRONT OF YOU. BRAKE LATE OR TURN HARD" },
  suv:         { id: "suv", name: "SUV", car: "cop_c", look: LOOK("#1b2230", { type: "side", color: "#1b3fa8" }, "#7a828c"), hp: 130, spd: -0.04, pay: 1.8, siren: true, ram: 34, tip: "HEAVY. RAMS FROM THE SIDE. LET IT PASS, THEN SLIP BEHIND" },
  undercover:  { id: "undercover", name: "UNDERCOVER", car: "kestrel", look: LOOK("#4a4f57", null, "#8a9099"), hp: 50, spd: 0.02, pay: 1.6, siren: false, reveal: 55, tip: "AN UNMARKED CAR WAS FOLLOWING YOU. ITS LIGHTS JUST CAME ON" },
  heavy:       { id: "heavy", name: "HEAVY", car: "cop_c", look: LOOK("#2b2f2a", { type: "side", color: "#c9a227" }, "#4a4f57"), hp: 220, spd: -0.1, pay: 2.6, siren: true, ram: 40, tip: "ARMOURED. SLOW BUT HARD TO WRECK. OUT-DRIVE IT OR USE A JUMP" },
  tactical:    { id: "tactical", name: "TACTICAL", car: "cop_b", look: LOOK("#0e1013", { type: "side", color: "#8d99a6" }, "#3a3f46"), hp: 70, spd: 0.09, pay: 2.2, siren: true, lead: true, nos: true, tip: "ARRIVES IN PAIRS AND CUTS YOU OFF. KEEP MOVING" },
};
// what mix of units each heat level sends [patrol, interceptor, suv, undercover, heavy, tactical]
const MIX = [null, [1, 0, 0, 0, 0, 0], [.8, .2, 0, 0, 0, 0], [.4, .25, .2, .15, 0, 0], [.28, .22, .18, .17, .15, 0], [.18, .17, .17, .1, .18, .2], [.1, .15, .15, .1, .22, .28]];
const ORDER = ["patrol", "interceptor", "suv", "undercover", "heavy", "tactical"];
const CAP = { heavy: 2, tactical: 3, undercover: 2 };
export const pickUnit = (lvl, r, counts = {}) => {
  const m = MIX[Math.max(1, Math.min(6, lvl | 0))]; let tot = 0; const w = m.map((x, i) => { const id = ORDER[i]; const ok = !CAP[id] || (counts[id] || 0) < CAP[id]; const v = ok ? x : 0; tot += v; return v; });
  let t = r * tot; for (let i = 0; i < w.length; i++) { t -= w[i]; if (t <= 0 && w[i] > 0) return UNITS[ORDER[i]]; } return UNITS.patrol;
};
