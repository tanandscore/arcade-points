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
  STEPS: [0, 30, 80, 150, 240, 350],      // points needed for level 0..5 (stars)
  DECAY: 2.2,          // points lost per second when no patrol car is chasing
  COPS: [0, 1, 2, 3, 3, 4],               // patrol cars per level
  SPAWN_MIN: 85, SPAWN_MAX: 140, DESPAWN: 420,
  ESCAPE_DIST: 210, ESCAPE_TIME: 10,       // far away and out of sight this long = escaped
  BUST_R: 9, BUST_SPEED: 14, BUST_TIME: 3, // a car this close while you are almost stopped fills the busted meter
  REPLAN: 1.6,
};
export const COP_LOOK = { color: "#eef1f4", finish: "gloss", livery: { type: "side", color: "#1b3fa8" }, rims: { style: "classic", color: "#c9ced4" }, kit: "stock" };
export const heatLevel = (pts) => { let l = 0; for (let i = 1; i < HEAT.STEPS.length; i++) if (pts >= HEAT.STEPS[i]) l = i; return l; };
export const bountyFor = (peak, playerLevel) => ({ cash: Math.round((120 + peak * 140) * (1 + playerLevel * 0.08)), xp: 30 + peak * 30 });
export const fineFor = (peak, earned, cash) => Math.min(cash, Math.round(100 + 0.01 * earned * (0.5 + peak * 0.5)));
