// Rules data for Wrath of Olympus: what every unit, building, upgrade and god power is and costs.
// Distances are in tiles, times in seconds.

export const N = 112; // map is N x N tiles
export const POP_MAX = 200;

export const RES = ["food", "wood", "gold", "stone"];
export const RES_ICON = { food: "🍖", wood: "🪵", gold: "🪙", stone: "🪨", favor: "✨" };

export const PLAYER_COLORS = [0x2f6fe0, 0xd13b30, 0x8a7a55]; // blue (you), red (enemy), khaki (wild creatures)
export const PLAYER_NAMES = ["Athens", "Sparta"];
export const WILD = 2; // owner number of the monsters that guard the lairs

export const AGES = [
  { name: "Archaic Age", short: "Archaic" },
  { name: "Classical Age", short: "Classical", cost: { food: 400, gold: 150 }, time: 40 },
  { name: "Heroic Age", short: "Heroic", cost: { food: 700, gold: 450 }, time: 55 },
];

export const DIFFICULTY = {
  recruit: { name: "Recruit", gather: 0.8, start: 0, firstAttack: 840, wave: 6, villagers: 16, towers: false, techs: false, scoreMult: 1, desc: "A gentle rival. Slow to grow, slow to attack." },
  veteran: { name: "Veteran", gather: 1.0, start: 0, firstAttack: 720, wave: 9, villagers: 22, towers: true, techs: true, scoreMult: 1.6, desc: "A fair fight. Grows steadily and strikes in waves." },
  elite: { name: "Elite", gather: 1.25, start: 200, firstAttack: 540, wave: 14, villagers: 28, towers: true, techs: true, scoreMult: 2.4, desc: "Ruthless. Fast economy, big armies, early raids." },
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
  // ---- Upgrade 26: your champion (you choose one at the start), myth creatures and wild monsters ------------------------------------------
  // "hero: true" units are champions. Their special powers are in HEROES / ABILITIES below.
  achilles: {
    name: "Achilles", icon: "⚔️", cls: "hero", hero: true, hp: 560, atk: 26, atkType: "melee", range: 1.25, cd: 1.0, mArm: 4, pArm: 7, speed: 2.7, radius: 0.42, vision: 10, pop: 0, regen: 1.2,
    desc: "Champion of Athens. A wall of bronze that makes every soldier near him fight harder.",
  },
  odysseus: {
    name: "Odysseus", icon: "🦊", cls: "hero", hero: true, hp: 340, atk: 14, atkType: "melee", range: 1.1, cd: 1.0, mArm: 2, pArm: 4, speed: 3.0, radius: 0.36, vision: 15, pop: 0, regen: 0.9,
    desc: "The cunning king. A weak fighter, but his clever mind speeds up your economy and finds every secret.",
  },
  atalanta: {
    name: "Atalanta", icon: "🏹", cls: "hero", hero: true, hp: 310, atk: 16, atkType: "pierce", range: 8.5, cd: 0.9, mArm: 1, pArm: 2, speed: 3.3, radius: 0.34, vision: 12, pop: 0, regen: 0.9,
    desc: "The Arcadian huntress. Fast and deadly from a distance. Makes all your archers better.",
  },
  hippolyta: {
    name: "Hippolyta", icon: "🐎", cls: "hero", hero: true, hp: 450, atk: 20, atkType: "melee", range: 1.2, cd: 1.0, mArm: 3, pArm: 5, speed: 4.4, radius: 0.46, vision: 11, pop: 0, regen: 1.0,
    desc: "Queen of the Amazons, always on horseback. Leads cavalry raids and makes horsemen cheaper and stronger.",
  },
  perseus: {
    name: "Perseus", icon: "🛡️", cls: "hero", hero: true, hp: 410, atk: 19, atkType: "melee", range: 1.2, cd: 1.0, mArm: 3, pArm: 6, speed: 3.4, radius: 0.38, vision: 11, pop: 0, regen: 1.0,
    desc: "Slayer of Medusa. Turns enemies to stone and hunts monsters like no one else.",
  },
  minotaur: {
    name: "Minotaur", icon: "🐂", cls: "myth", hp: 340, atk: 30, atkType: "melee", range: 1.3, cd: 1.4, mArm: 3, pArm: 6, speed: 2.7, radius: 0.5, vision: 8, pop: 4, bonus: { building: 14, infantry: 8 },
    cost: { food: 170, gold: 110 }, time: 36, age: 1, from: "temple", god: "athena", desc: "A raging bull-man. Smashes infantry and walls. Needs Athena.",
  },
  centaur: {
    name: "Centaur", icon: "🏹", cls: "myth", hp: 130, atk: 10, atkType: "pierce", range: 8, cd: 1.2, mArm: 1, pArm: 3, speed: 4.6, radius: 0.46, vision: 11, pop: 3, bonus: { archer: 6, villager: 4 },
    cost: { wood: 90, gold: 90 }, time: 28, age: 1, from: "temple", god: "hermes", desc: "A fast horse-archer. Hunts archers and citizens. Needs Hermes.",
  },
  talos: {
    name: "Bronze Giant", icon: "🗿", cls: "myth", hp: 600, atk: 25, atkType: "melee", range: 1.4, cd: 1.7, mArm: 8, pArm: 14, speed: 1.8, radius: 0.62, vision: 8, pop: 5, regen: 0.6, bonus: { building: 10 },
    cost: { gold: 210, stone: 110 }, time: 46, age: 2, from: "temple", god: "hephaestus", desc: "Talos, the walking bronze statue. Slow, nearly unbreakable. Needs Hephaestus.",
  },
  // wild monsters (owner = WILD). They only fight when you come close.
  wolf: { name: "Wild Wolf", icon: "🐺", cls: "monster", hp: 60, atk: 8, atkType: "melee", range: 0.9, cd: 1.0, mArm: 0, pArm: 0, speed: 4.0, radius: 0.34, vision: 8, pop: 0, xp: 9, desc: "Fast and hungry." },
  satyr: { name: "Satyr Slinger", icon: "🐐", cls: "monster", hp: 80, atk: 10, atkType: "pierce", range: 6.5, cd: 1.5, mArm: 0, pArm: 1, speed: 3.0, radius: 0.32, vision: 9, pop: 0, xp: 20, desc: "Throws stones from a distance." },
  cyclops: { name: "Cyclops", icon: "👁️", cls: "monster", hp: 560, atk: 34, atkType: "melee", range: 1.6, cd: 1.9, mArm: 3, pArm: 9, speed: 2.2, radius: 0.64, vision: 9, pop: 0, xp: 130, desc: "A one-eyed giant. Hits like a boulder." },
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
  temple: { name: "Temple", icon: "⛩️", size: 3, hp: 1100, mArm: 3, pArm: 10, cost: { stone: 180, gold: 100 }, time: 50, age: 1, vision: 8, favor: 0.5, trains: ["minotaur", "centaur", "talos"], desc: "Gathers the gods' favor, calls down their powers and trains the myth creatures of the gods you chose." },
  tower: { name: "Guard Tower", icon: "🗼", size: 2, hp: 850, mArm: 4, pArm: 14, cost: { stone: 110, wood: 40 }, time: 40, age: 1, vision: 10, arrows: { atk: 10, range: 8.5, cd: 1.5 }, desc: "Shoots arrows at enemies that come close." },
  wonder: { name: "Wonder of Olympus", icon: "🏛️", size: 5, hp: 4600, mArm: 6, pArm: 16, cost: { wood: 500, stone: 500, gold: 500 }, time: 160, age: 2, vision: 12, wonder: true, desc: "A monument fit for the gods. Finish it and hold it for 4 minutes to win the war, even if enemy towns still stand." },
  siege_workshop: { name: "Siege Workshop", icon: "⚙️", size: 3, hp: 1100, mArm: 2, pArm: 8, cost: { wood: 200, gold: 100 }, time: 50, age: 2, vision: 6, trains: ["catapult"], desc: "Builds catapults." },
};
export const BUILD_ORDER = ["house", "farm", "storehouse", "barracks", "archery_range", "stable", "temple", "tower", "siege_workshop", "town_center", "wonder"];

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
// Which three powers you get depends on the champion you chose (see HEROES.powers). They need a Temple, and cost favor.
export const POWERS = {
  bolt: { name: "Zeus's Thunderbolt", icon: "⚡", favor: 45, cd: 40, radius: 3.2, needsTarget: true, desc: "Calls lightning on a spot, hurting everything in it." },
  heal: { name: "Athena's Blessing", icon: "🦉", favor: 55, cd: 50, radius: 8, needsTarget: true, desc: "Heals your people in a wide area." },
  bounty: { name: "Demeter's Bounty", icon: "🌾", favor: 70, cd: 90, needsTarget: false, desc: "Fills your stores with food and wood." },
  fury: { name: "Ares's Fury", icon: "🔥", favor: 50, cd: 60, needsTarget: false, desc: "All your soldiers hit 35% harder and move faster for 20 seconds." },
  quake: { name: "Poseidon's Earthquake", icon: "🌊", favor: 65, cd: 70, radius: 5, needsTarget: true, desc: "Shakes the ground: wrecks buildings in the area and knocks people down for 3 seconds." },
  swift: { name: "Hermes's Swiftness", icon: "💨", favor: 35, cd: 45, needsTarget: false, desc: "All your people run 50% faster for 15 seconds." },
  farsight: { name: "Apollo's Farsight", icon: "☀️", favor: 30, cd: 40, radius: 20, needsTarget: true, desc: "Lights up the map in a huge circle for 30 seconds. Perfect for spotting raids." },
  storm: { name: "Artemis's Arrow Storm", icon: "🌠", favor: 50, cd: 45, radius: 4.2, needsTarget: true, desc: "A hail of silver arrows hits every enemy in an area. Your own people are safe." },
};

// ---- the gods you pick when you grow into a new age (like Age of Mythology) -----------------------
// fx: infArm = soldiers' armor, towerDmg = tower arrows, speed = walking speed, gather = gathering speed, archAtk, vision, siege, bHp = building health, templeHeal
export const GODS = {
  athena: { name: "Athena", icon: "🦉", age: 1, title: "Goddess of Wisdom", fx: { infArm: 2, towerDmg: 0.25 }, unlock: "minotaur", desc: "Your hoplites and champion take much less damage and your towers shoot harder. Unlocks the Minotaur at your Temple." },
  hermes: { name: "Hermes", icon: "👟", age: 1, title: "Messenger of the Gods", fx: { speed: 0.12, gather: 0.1 }, unlock: "centaur", desc: "Your soldiers walk 12% faster and your citizens gather 10% faster. Unlocks the Centaur at your Temple." },
  apollo: { name: "Apollo", icon: "☀️", age: 2, title: "God of Light", fx: { archAtk: 2, vision: 2, templeHeal: true }, desc: "Archers hit harder, everyone sees farther, and your Temple heals friends standing near it." },
  hephaestus: { name: "Hephaestus", icon: "🔥", age: 2, title: "Smith of the Gods", fx: { siege: 0.3, bHp: 0.2 }, unlock: "talos", desc: "Catapults hit 30% harder and your buildings are 20% tougher. Unlocks the Bronze Giant at your Temple." },
};
export const GOD_CHOICES = { 1: ["athena", "hermes"], 2: ["apollo", "hephaestus"] };

// ---- champions: the main character you play ------------------------------------------------------
// passive: what the champion does for the whole army just by being alive.  abilities: two special moves (the second unlocks at level 2).
export const HEROES = {
  achilles: {
    name: "Achilles", title: "Champion of Athens", role: "Front-line Bruiser", icon: "⚔️", color: "#e8b64a", patron: "Ares & Zeus", powers: ["fury", "bolt", "heal"], abilities: ["rage", "myrmidons"],
    blurb: "The greatest warrior alive. He charges into the enemy line and every soldier near him fights harder.",
    passive: { name: "Glory of Achilles", desc: "Your soldiers within 8 tiles of him hit 15% harder.", aura: { r: 8, atk: 0.15 } },
    rating: { fight: 5, speed: 2, range: 1, economy: 1, scouting: 2 },
  },
  odysseus: {
    name: "Odysseus", title: "The Cunning King", role: "Strategist & Scout", icon: "🦊", color: "#5fb0a0", patron: "Hermes & Apollo", powers: ["swift", "farsight", "bounty"], abilities: ["ruse", "foxeyes"],
    blurb: "A weak fighter with a brilliant mind. Your economy booms, you start richer, and no secret stays hidden for long.",
    passive: { name: "Master Planner", desc: "Citizens gather 10% faster. You start with extra food, wood and gold. Every shrine, relic and monster den on the map is marked for you from the start.", gather: 0.1, startBonus: { food: 150, wood: 150, gold: 60 }, poiSense: true },
    rating: { fight: 2, speed: 3, range: 1, economy: 5, scouting: 5 },
  },
  atalanta: {
    name: "Atalanta", title: "Huntress of Arcadia", role: "Ranged Skirmisher", icon: "🏹", color: "#7bc96f", patron: "Artemis & Athena", powers: ["storm", "heal", "swift"], abilities: ["volley", "swiftfoot"],
    blurb: "Fast and deadly from a distance. Keep her behind your line and she shreds anything that gets close.",
    passive: { name: "Huntress's Mastery", desc: "All your archers shoot +2 harder and +1 tile farther. She deals 50% extra damage to monsters and myth creatures.", archerAtk: 2, archerRange: 1, vsMyth: 0.5 },
    rating: { fight: 4, speed: 4, range: 5, economy: 1, scouting: 3 },
  },
  hippolyta: {
    name: "Hippolyta", title: "Queen of the Amazons", role: "Cavalry Commander", icon: "🐎", color: "#d86a8a", patron: "Poseidon & Ares", powers: ["quake", "fury", "bounty"], abilities: ["charge", "warcry"],
    blurb: "Always on horseback. Strikes fast, raids enemy citizens and leads a stronger cavalry than anyone else.",
    passive: { name: "Amazon Riders", desc: "Horsemen and Centaurs cost 20% less, have +20% health and hit +1 harder.", cavCost: 0.8, cavHp: 0.2, cavAtk: 1 },
    rating: { fight: 4, speed: 5, range: 1, economy: 2, scouting: 4 },
  },
  perseus: {
    name: "Perseus", title: "Slayer of Medusa", role: "Controller & Monster Hunter", icon: "🛡️", color: "#9a8cf0", patron: "Zeus & Apollo", powers: ["bolt", "farsight", "heal"], abilities: ["gaze", "sandals"],
    blurb: "Freezes whole armies with the Gorgon's gaze and hops across the battlefield on winged sandals. Monsters fear him.",
    passive: { name: "Bane of Monsters", desc: "Deals double damage to monsters and myth creatures and takes 40% less damage from them.", vsMyth: 1.0, takeMyth: 0.6 },
    rating: { fight: 3, speed: 4, range: 1, economy: 1, scouting: 3 },
  },
};
export const HERO_ORDER = ["achilles", "odysseus", "atalanta", "hippolyta", "perseus"];
export const XP_AT = [0, 80, 200, 380, 620]; // experience needed for level 1..5
export const MAX_LEVEL = XP_AT.length;
export const HERO_UNLOCK2 = 2; // level at which the second ability unlocks

// target: "self" acts at once; "ground" asks you to click a spot (range = how far from the champion)
export const ABILITIES = {
  rage: { name: "Rage of Achilles", icon: "😡", cd: 40, target: "self", dur: 10, desc: "For 10 seconds Achilles hits 60% harder, runs 30% faster and takes 25% less damage." },
  myrmidons: { name: "Call the Myrmidons", icon: "🛡️", cd: 75, target: "self", dur: 50, count: 4, desc: "Four loyal hoplites appear at his side and fight for 50 seconds." },
  ruse: { name: "Trojan Ruse", icon: "🐴", cd: 45, target: "ground", range: 11, radius: 4.6, dur: 5, desc: "Dazes every enemy in the chosen area. They cannot fight for 5 seconds." },
  foxeyes: { name: "Eyes of the Fox", icon: "🦊", cd: 40, target: "ground", range: 70, radius: 16, dur: 25, desc: "Send your cunning eyes anywhere: the chosen area is lit up for 25 seconds." },
  volley: { name: "Volley of Arrows", icon: "🎯", cd: 24, target: "ground", range: 11, radius: 3.4, dmg: 85, desc: "A burst of arrows rains on the chosen area and hurts every enemy in it." },
  swiftfoot: { name: "Swift Foot", icon: "💨", cd: 20, target: "self", dur: 6, desc: "Atalanta runs 60% faster for 6 seconds. Perfect for kiting." },
  charge: { name: "Amazon Charge", icon: "🐎", cd: 28, target: "ground", range: 11, dmg: 60, radius: 1.8, stun: 1.6, desc: "Gallops in a straight line, smashing and stunning every enemy on the way." },
  warcry: { name: "Amazon War Cry", icon: "📯", cd: 45, target: "self", radius: 10, dur: 12, desc: "Friends within 10 tiles hit 20% harder and run 25% faster for 12 seconds." },
  gaze: { name: "Gorgon's Gaze", icon: "🗿", cd: 45, target: "self", radius: 5.6, dur: 4, desc: "Every enemy close to Perseus turns to stone for 4 seconds." },
  sandals: { name: "Winged Sandals", icon: "🪽", cd: 16, target: "ground", range: 13, dur: 4, desc: "Leaps to the chosen spot and runs 40% faster for 4 seconds." },
};

// timed effects on a unit: dmg = damage dealt, take = damage taken (lower is tougher), spd = speed
export const STATUS = {
  rage: { dmg: 1.6, spd: 1.3, take: 0.75 }, fury: { dmg: 1.35, spd: 1.15 }, swift: { spd: 1.5 }, warcry: { dmg: 1.2, spd: 1.25 }, swiftfoot: { spd: 1.6 }, sandals: { spd: 1.4 }, stun: { stun: true },
};

// ---- relics and monster dens scattered over the map (kept in the fog until you scout them) -----------
export const RELICS = {
  spear: { name: "Spear of Destiny", icon: "🔱", desc: "All your soldiers hit 10% harder.", fx: { dmg: 0.1 } },
  aegis: { name: "Fragment of the Aegis", icon: "🛡️", desc: "All your soldiers take 10% less damage.", fx: { take: 0.1 } },
  fleece: { name: "Golden Fleece", icon: "🐑", desc: "Your citizens gather 12% faster.", fx: { gather: 0.12 } },
  nectar: { name: "Cup of Nectar", icon: "🏺", desc: "Your Temples make +1 favor each second and your champion heals faster.", fx: { favor: 1.0, regen: 2 } },
};
export const RELIC_ORDER = ["spear", "aegis", "fleece", "nectar"];
export const LAIRS = {
  wolves: { name: "Wolf Den", icon: "🐺", guards: [["wolf", 4]], loot: { gold: 130, food: 60 }, xp: 40 },
  satyrs: { name: "Satyr Camp", icon: "🐐", guards: [["satyr", 3], ["wolf", 1]], loot: { gold: 220, food: 100 }, xp: 70 },
  cyclops: { name: "Cyclops Cave", icon: "👁️", guards: [["cyclops", 1], ["satyr", 2]], loot: { gold: 360, stone: 150, favor: 40 }, xp: 140 },
};
export const SHRINE = { favor: 50, xp: 40, radius: 24 }; // an Oracle's shrine lights up the land around it for ever

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
export const START_GUARDS = 3; // Upgrade 44: both sides begin with a few hoplites so the first minutes are not defenceless

export const canAfford = (res, cost) => Object.keys(cost || {}).every((k) => (res[k] || 0) >= cost[k]);
export const costText = (cost) => Object.entries(cost || {}).map(([k, v]) => `${RES_ICON[k]}${v}`).join(" ");
