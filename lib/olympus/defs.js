// Rules data for Wrath of Olympus: what every unit, building, upgrade and god power is and costs.
// Distances are in tiles, times in seconds.

export const N = 112; // map is N x N tiles
export const POP_MAX = 200;

export const RES = ["food", "wood", "gold", "stone"];
export const RES_ICON = { food: "🍖", wood: "🪵", gold: "🪙", stone: "🪨", favor: "✨" };

export const PLAYER_COLORS = [0x2f6fe0, 0xd13b30]; // blue (you), red (enemy)
export const PLAYER_NAMES = ["Athens", "Sparta"];

export const AGES = [
  { name: "Archaic Age", short: "Archaic" },
  { name: "Classical Age", short: "Classical", cost: { food: 400, gold: 150 }, time: 40 },
  { name: "Heroic Age", short: "Heroic", cost: { food: 700, gold: 450 }, time: 55 },
];

export const DIFFICULTY = {
  recruit: { name: "Recruit", gather: 0.8, start: 0, firstAttack: 660, wave: 10, villagers: 16, towers: false, techs: false, scoreMult: 1, desc: "A gentle rival. Slow to grow, slow to attack." },
  veteran: { name: "Veteran", gather: 1.0, start: 0, firstAttack: 500, wave: 16, villagers: 22, towers: true, techs: true, scoreMult: 1.6, desc: "A fair fight. Grows steadily and strikes in waves." },
  elite: { name: "Elite", gather: 1.25, start: 200, firstAttack: 360, wave: 24, villagers: 28, towers: true, techs: true, scoreMult: 2.4, desc: "Ruthless. Fast economy, big armies, early raids." },
};

// ---- units --------------------------------------------------------------------------------
// atk type: "melee" | "pierce" | "siege". bonus: extra damage against a class.
export const UNITS = {
  villager: {
    name: "Citizen", icon: "🧑‍🌾", cls: "villager", hp: 40, atk: 3, atkType: "melee", range: 0.9, cd: 1.5, mArm: 0, pArm: 0, speed: 2.5, radius: 0.28, vision: 7, pop: 1,
    cost: { food: 50 }, time: 13, age: 0, from: "town_center", desc: "Gathers, builds and repairs. Weak in a fight.",
  },
  hoplite: {
    name: "Hoplite", icon: "🛡️", cls: "infantry", hp: 90, atk: 7, atkType: "melee", range: 0.95, cd: 1.2, mArm: 1, pArm: 3, speed: 2.3, radius: 0.32, vision: 8, pop: 1, bonus: { cavalry: 9 },
    cost: { food: 55, gold: 25 }, time: 16, age: 0, from: "barracks", desc: "Spear and shield. Tough, and strong against horsemen.",
  },
  archer: {
    name: "Archer", icon: "🏹", cls: "archer", hp: 45, atk: 6, atkType: "pierce", range: 7.5, cd: 1.4, mArm: 0, pArm: 0, speed: 2.4, radius: 0.28, vision: 10, pop: 1, bonus: { infantry: 2 },
    cost: { wood: 40, gold: 30 }, time: 15, age: 1, from: "archery_range", desc: "Shoots from afar. Fragile up close.",
  },
  horseman: {
    name: "Horseman", icon: "🐎", cls: "cavalry", hp: 105, atk: 9, atkType: "melee", range: 1.1, cd: 1.1, mArm: 1, pArm: 2, speed: 4.3, radius: 0.42, vision: 10, pop: 2, bonus: { archer: 6, villager: 3 },
    cost: { food: 75, gold: 40 }, time: 20, age: 1, from: "stable", desc: "Fast. Hunts archers and citizens, but fears spears.",
  },
  catapult: {
    name: "Catapult", icon: "☄️", cls: "siege", hp: 150, atk: 48, atkType: "siege", range: 11, cd: 4.2, mArm: 1, pArm: 8, speed: 1.5, radius: 0.55, vision: 8, pop: 3, splash: 1.8, bonus: { building: 30 },
    cost: { wood: 170, gold: 110 }, time: 32, age: 2, from: "siege_workshop", desc: "Hurls boulders. Smashes buildings, but cannot defend itself.",
  },
  hero: {
    name: "Achilles", icon: "⚔️", cls: "hero", hp: 480, atk: 24, atkType: "melee", range: 1.2, cd: 1.0, mArm: 4, pArm: 7, speed: 2.7, radius: 0.4, vision: 10, pop: 3, regen: 1.2, limit: 1,
    cost: { food: 300, gold: 220 }, time: 40, age: 2, from: "temple", desc: "A legendary champion. One per army.",
  },
};

// ---- buildings ----------------------------------------------------------------------------
export const BUILDINGS = {
  town_center: {
    name: "Town Center", icon: "🏛️", size: 4, hp: 2400, mArm: 4, pArm: 12, cost: { wood: 300, stone: 200 }, time: 90, age: 1, popCap: 15, drop: ["food", "wood", "gold", "stone"], vision: 12,
    trains: ["villager"], arrows: { atk: 7, range: 8, cd: 2.0 }, desc: "The heart of your city. Trains citizens and leads you through the ages.",
  },
  house: { name: "House", icon: "🏠", size: 2, hp: 360, mArm: 2, pArm: 8, cost: { wood: 30 }, time: 20, age: 0, popCap: 5, vision: 4, desc: "Houses 5 more people." },
  farm: { name: "Farm", icon: "🌾", size: 3, hp: 220, mArm: 0, pArm: 4, cost: { wood: 60 }, time: 18, age: 0, vision: 3, farm: true, desc: "A field that never runs dry. One citizen works it." },
  storehouse: { name: "Storehouse", icon: "📦", size: 2, hp: 520, mArm: 2, pArm: 8, cost: { wood: 80 }, time: 25, age: 0, drop: ["food", "wood", "gold", "stone"], vision: 5, techs: ["axes", "picks"], desc: "Drop-off point near forests and mines. Researches gathering upgrades." },
  barracks: { name: "Barracks", icon: "🛡️", size: 3, hp: 1300, mArm: 3, pArm: 10, cost: { wood: 140, stone: 20 }, time: 40, age: 0, vision: 6, trains: ["hoplite"], techs: ["melee", "armor"], desc: "Trains hoplites and researches weapons and shields." },
  archery_range: { name: "Archery Range", icon: "🎯", size: 3, hp: 1000, mArm: 2, pArm: 8, cost: { wood: 150 }, time: 40, age: 1, vision: 6, trains: ["archer"], techs: ["arrows"], desc: "Trains archers." },
  stable: { name: "Stable", icon: "🐴", size: 3, hp: 1000, mArm: 2, pArm: 8, cost: { wood: 150 }, time: 40, age: 1, vision: 6, trains: ["horseman"], desc: "Trains horsemen." },
  temple: { name: "Temple", icon: "⛩️", size: 3, hp: 1100, mArm: 3, pArm: 10, cost: { stone: 180, gold: 100 }, time: 50, age: 1, vision: 8, favor: 0.5, trains: ["hero"], desc: "Gathers the gods' favor and lets you call down their powers." },
  tower: { name: "Guard Tower", icon: "🗼", size: 2, hp: 850, mArm: 4, pArm: 14, cost: { stone: 110, wood: 40 }, time: 40, age: 1, vision: 10, arrows: { atk: 10, range: 8.5, cd: 1.5 }, desc: "Shoots arrows at enemies that come close." },
  siege_workshop: { name: "Siege Workshop", icon: "⚙️", size: 3, hp: 1100, mArm: 2, pArm: 8, cost: { wood: 200, gold: 100 }, time: 50, age: 2, vision: 6, trains: ["catapult"], desc: "Builds catapults." },
};
export const BUILD_ORDER = ["house", "farm", "storehouse", "barracks", "archery_range", "stable", "temple", "tower", "siege_workshop", "town_center"];

// ---- upgrades -----------------------------------------------------------------------------
export const TECHS = {
  axes: { name: "Bronze Axes", icon: "🪓", cost: { wood: 120, gold: 40 }, time: 28, age: 0, from: "storehouse", desc: "Citizens chop wood 25% faster." },
  picks: { name: "Iron Picks", icon: "⛏️", cost: { food: 100, gold: 50 }, time: 30, age: 0, from: "storehouse", desc: "Citizens mine gold and stone 25% faster." },
  plow: { name: "Iron Plow", icon: "🌱", cost: { wood: 100, food: 80 }, time: 30, age: 0, from: "town_center", desc: "Farms and berries 30% faster." },
  melee: { name: "Bronze Weapons", icon: "⚔️", cost: { food: 150, gold: 100 }, time: 35, age: 1, from: "barracks", desc: "Hoplites, horsemen and heroes hit +2 harder." },
  armor: { name: "Bronze Shields", icon: "🛡️", cost: { food: 150, gold: 80 }, time: 35, age: 1, from: "barracks", desc: "Hoplites and heroes take less damage from blades and arrows." },
  arrows: { name: "Fletching", icon: "🏹", cost: { wood: 150, gold: 80 }, time: 35, age: 1, from: "archery_range", desc: "Archers shoot +1 harder and +1 tile farther." },
};
export const TECH_ORDER = Object.keys(TECHS);

// ---- god powers ---------------------------------------------------------------------------
export const POWERS = {
  bolt: { name: "Zeus's Thunderbolt", icon: "⚡", favor: 45, cd: 40, radius: 3.2, needsTarget: true, desc: "Calls lightning on a spot, hurting everything in it." },
  heal: { name: "Athena's Blessing", icon: "🦉", favor: 55, cd: 50, radius: 8, needsTarget: true, desc: "Heals your people in a wide area." },
  bounty: { name: "Demeter's Bounty", icon: "🌾", favor: 70, cd: 90, needsTarget: false, desc: "Fills your stores with food and wood." },
};

// ---- resources on the map -----------------------------------------------------------------
export const NODE = {
  tree: { name: "Olive Tree", amount: 90, res: "wood", rate: 0.95, size: 1, icon: "🌳" },
  berries: { name: "Berry Bush", amount: 160, res: "food", rate: 1.15, size: 1, icon: "🫐" },
  gold: { name: "Gold Mine", amount: 1100, res: "gold", rate: 0.8, size: 2, icon: "🪙" },
  stone: { name: "Stone Quarry", amount: 900, res: "stone", rate: 0.8, size: 2, icon: "🪨" },
};
export const FARM_RATE = 0.68;
export const CARRY = 10;

export const START = { food: 250, wood: 250, gold: 100, stone: 100 };
export const START_VILLAGERS = 6;

export const canAfford = (res, cost) => Object.keys(cost || {}).every((k) => (res[k] || 0) >= cost[k]);
export const costText = (cost) => Object.entries(cost || {}).map(([k, v]) => `${RES_ICON[k]}${v}`).join(" ");
