// Skyline Siege — the 16 missions in 4 districts. Each mission is a list of street chunks (see chunks.js) plus a few hints.
import { assemble } from "./chunks";

export const DISTRICTS = [
  { name: "Harbor Front", short: "Harbor", theme: "harbor", look: "city", music: "city", boss: "crane", blurb: "Cranes, containers and the first wave of the Syndicate. Welcome to Port Meridian." },
  { name: "Neon Strip", short: "Neon", theme: "city_night", look: "city", music: "tense", boss: "widow", blurb: "Rain-slick rooftops, billboards and snipers behind every sign." },
  { name: "Foundry Row", short: "Foundry", theme: "factory", look: "volcano", music: "fire", boss: "titan", blurb: "Furnaces, spikes and heavy armour. It is hot in here." },
  { name: "Skyline Spire", short: "Spire", theme: "city_dusk", look: "city", music: "city", boss: "architect", blurb: "The Syndicate's tower. Fight your way to the top and end the siege." },
];

const L = (id, name, desc, theme, seq, extra = {}) => ({ id, name, desc, theme, seq, ...extra });

export const MISSIONS = [
  [
    L("1-1", "Dockside Arrival", "Learn the ropes on the harbor road.", "harbor",
      ["start", "walk_g", "crates_a", "step_up", "drone_intro", "citizen_roof", "checkpoint", "barrel_pair", ["weapon_nook", { 1: "1" }], "brick_secret", "ledge_citizen", "goal"],
      { par: 210, hints: [[0, "Run with ← → (or A D). Jump with Space."], [1, "Shoot with X. Hold it down to keep firing."], [2, "Crates break when you shoot them. Some hide goodies."], [3, "Hold ↑ to aim up. Hold ↑ and a direction to aim diagonally."], [4, "Drones fly. Aim up and shoot them down!"], [5, "Walk into citizens to rescue them. Three per mission!"], [7, "Red barrels explode when shot. Keep your distance."], [8, "New guns! Press Q to swap between the guns you carry."], [9, "Brick walls hide secrets. Throw a grenade with C to blow them open."]] }),
    L("1-2", "Container Yard", "Stacks of crates and a few new faces.", "harbor",
      ["start", "container_yard", "pit_pair", "two_level", "checkpoint", "citizen_roof", "crate_maze", "bomber_rush", "citizen_island", "brick_secret", "goal"],
      { par: 220, hints: [[2, "Falling into a pit costs you a life. Jump early!"], [3, "Snipers show a red laser. Move before it flashes!"], [7, "Bombers run at you and blow up. Shoot them first."]] }),
    L("1-3", "Warehouse Run", "Turrets, jets and a heavy surprise.", "harbor",
      ["start", "turret_hall", "bomber_rush", "ledge_citizen", "jet_pair", "checkpoint", ["weapon_nook", { 1: "2" }], "crate_maze", "citizen_island", "shield_wall", "brick_secret", "goal"],
      { par: 240, hints: [[1, "Turrets hang from the ceiling. Duck behind cover!"], [9, "Shield Brutes block bullets from the front. Jump over them, or use a grenade."]] }),
    L("1-4", "Crane Colossus", "Boss: the dockyard crane has other plans.", "harbor",
      ["start", "container_yard", "ledge_citizen", "bomber_rush", "checkpoint", "citizen_roof", "drone_swarm", "brick_secret", ["weapon_nook", { 1: "4" }], "bossgate", "arena_crane"],
      { par: 260, boss: "crane", hints: [[8, "The Skybreaker rocket launcher! Save it for the big machine ahead."]] }),
  ],
  [
    L("2-1", "Neon Alley", "Back streets glowing with trouble.", "city_night",
      ["start", "lamp_street", "shield_wall", "catwalk_gap", "citizen_island", "checkpoint", "jet_pair", "high_road", "turret_hall", "brick_secret", "goal"],
      { par: 230 }),
    L("2-2", "Rooftop Run", "Jump the gaps, dodge the snipers.", "city_night",
      ["start", "catwalk_gap", "gap_gunners", "ledge_citizen", "checkpoint", "sniper_gallery", "drone_swarm", "high_road", "crate_maze", "citizen_island", "goal"],
      { par: 250 }),
    L("2-3", "Billboard Heights", "A walker mech guards the main road.", "city_rain",
      ["start", "sniper_gallery", "mech_alley", "checkpoint", "citizen_roof", "spike_walk", "jet_pair", "brick_secret", "shield_wall", "high_road", "goal"],
      { par: 270 }),
    L("2-4", "Neon Widow", "Boss: the Widow spins her web over the strip.", "city_rain",
      ["start", "gap_gunners", "drone_swarm", "ledge_citizen", "checkpoint", "spike_walk", "citizen_island", "turret_gauntlet", "brick_secret", ["weapon_nook", { 1: "3" }], "bossgate", "arena_widow"],
      { par: 280, boss: "widow" }),
  ],
  [
    L("3-1", "Furnace Gate", "The heat is on. So are the spikes.", "factory",
      ["start", "spike_walk", "turret_hall", "shield_wall", "ledge_citizen", "checkpoint", "crate_maze", "barrel_run", "citizen_island", "brick_secret", "goal"],
      { par: 250 }),
    L("3-2", "Slag Works", "Brutes, drones and a mech on the main line.", "factory",
      ["start", "barrel_run", "catwalk_gap", "high_road", "checkpoint", "brute_pair", "sniper_drones", "citizen_roof", "brick_secret", "mech_alley", "goal"],
      { par: 280 }),
    L("3-3", "Assembly Line", "Everything is built to hurt you.", "factory",
      ["start", "turret_gauntlet", "jet_squad", "ledge_citizen", "checkpoint", "fortress_front", "citizen_island", "spike_walk", "shield_wall", "brick_secret", "goal"],
      { par: 290 }),
    L("3-4", "Forge Titan", "Boss: a furnace on legs.", "factory",
      ["start", "brute_pair", "drone_swarm", "ledge_citizen", "checkpoint", "sniper_drones", "citizen_island", "mech_alley", "brick_secret", ["weapon_nook", { 1: "4" }], "bossgate", "arena_titan"],
      { par: 300, boss: "titan" }),
  ],
  [
    L("4-1", "Lobby Assault", "Storm the Spire's front door.", "city_dusk",
      ["start", "shield_wall", "jet_squad", "catwalk_gap", "high_road", "checkpoint", "fortress_front", "citizen_island", "sniper_gallery", "brick_secret", "goal"],
      { par: 280 }),
    L("4-2", "Glass Elevators", "Up, up and away. With company.", "city_dusk",
      ["start", "gap_gunners", "sniper_drones", "ledge_citizen", "checkpoint", "brute_pair", "barrel_run", "citizen_island", "drone_swarm", "mech_alley", "brick_secret", "goal"],
      { par: 300 }),
    L("4-3", "Rooftop Helipad", "The last stretch before the top floor.", "city_dusk",
      ["start", "jet_squad", "turret_gauntlet", "high_road", "checkpoint", "fortress_front", "mech_alley", "citizen_roof", "brute_pair", "sniper_drones", "brick_secret", "goal"],
      { par: 320 }),
    L("4-4", "The Architect", "Final boss: the mind behind the siege.", "city_night",
      ["start", "jet_squad", "ledge_citizen", "fortress_front", "checkpoint", "citizen_island", "sniper_drones", "brute_pair", "brick_secret", ["weapon_nook", { 1: "3" }], "bossgate", "arena_architect"],
      { par: 330, boss: "architect" }),
  ],
];

export const FLAT = []; MISSIONS.forEach((list, wi) => list.forEach((l, li) => FLAT.push({ ...l, wi, li })));

export function buildLevel(wi, li) {
  const d = DISTRICTS[wi], m = MISSIONS[wi][li], a = assemble(m.seq);
  const hints = (m.hints || []).map(([i, text]) => ({ col: a.marks[i].col, text }));
  return {
    id: m.id, name: m.name, theme: m.theme, look: d.look, rows: a.rows, cols: a.cols, citizens: a.citizens, arenaCol: a.arenaCol, boss: m.boss || null,
    par: m.par || 240, hints, wi, li, hpMul: 1 + wi * 0.16, dmgMul: 1 + wi * 0.1, marks: a.marks,
  };
}
