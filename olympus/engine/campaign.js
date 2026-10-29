// Wrath of Olympus — campaign missions, optional "fates", daily trials and enemy personalities (Upgrade 69).
// Pure data: the game rules that read it are in fates.js.

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

// ---- what an objective is --------------------------------------------------------------------------------------------
// type -> text.  "end" types are judged when the war is over (win before a time, never lose the champion ...).
export const OBJ_TYPES = {
  conquer: { text: () => "Destroy every Spartan Town Center", end: false },
  survive: { text: (o) => `Hold out for ${mmss(o.n)}` },
  lairs: { text: (o) => `Clear ${o.n} monster den${o.n > 1 ? "s" : ""}` },
  relics: { text: (o) => `Bring ${o.n} sacred relic${o.n > 1 ? "s" : ""} to your Temple` },
  shrines: { text: (o) => `Visit ${o.n} Oracle shrine${o.n > 1 ? "s" : ""}` },
  kills: { text: (o) => `Defeat ${o.n} enemy soldiers` },
  razed: { text: (o) => `Destroy ${o.n} enemy buildings` },
  villagers: { text: (o) => `Have ${o.n} citizens` },
  army: { text: (o) => `Raise an army of ${o.n}` },
  towers: { text: (o) => `Build ${o.n} Guard Tower${o.n > 1 ? "s" : ""}` },
  temples: { text: (o) => `Build ${o.n === 1 ? "a Temple" : o.n + " Temples"}` },
  own: { text: (o) => `Build ${o.n} ${o.what === "house" ? "Houses" : o.what === "barracks" ? "Barracks" : o.what}` },
  age: { text: (o) => `Enter the ${o.n === 1 ? "Classical" : "Heroic"} Age` },
  heroLevel: { text: (o) => `Raise your champion to level ${o.n}` },
  slayHero: { text: (o) => `Defeat the enemy champion${o.n > 1 ? ` ${o.n} times` : ""}` },
  wonder: { text: () => "Complete a Wonder of Olympus" },
  winBy: { text: (o) => `Win within ${mmss(o.n)}`, end: true },
  noHeroLoss: { text: () => "Win without your champion falling", end: true },
  keepLosses: { text: (o) => `Win losing ${o.n} or fewer people`, end: true },
};
export function objText(o) { const base = OBJ_TYPES[o.type] ? OBJ_TYPES[o.type].text(o) : o.type; return o.by && !(OBJ_TYPES[o.type] || {}).end ? `${base} by ${mmss(o.by)}` : base; }
const O = (type, n, extra = {}) => ({ type, n, ...extra });

// ---- optional "fates": three of these are drawn for every ordinary war (and every daily trial) ---------------------------------
export const FATE_POOL = [
  O("age", 1, { by: 420, id: "swift-classical" }), O("age", 1, { by: 540, id: "classical-9" }), O("age", 2, { by: 840, id: "heroic-14" }),
  O("lairs", 2, { id: "den-raider" }), O("lairs", 3, { id: "den-master" }), O("relics", 1, { id: "pilgrim" }), O("shrines", 2, { id: "seer" }),
  O("villagers", 40, { id: "busy-city" }), O("army", 25, { id: "muster" }), O("kills", 40, { id: "warlord" }), O("towers", 3, { id: "watchtowers" }),
  O("heroLevel", 5, { id: "ascendant" }), O("temples", 1, { by: 480, id: "early-faith" }), O("razed", 6, { id: "breaker" }),
  O("noHeroLoss", 0, { id: "unbroken" }), O("winBy", 1260, { id: "swift-war" }), O("keepLosses", 25, { id: "careful" }),
];

// ---- enemy personalities (skirmish) ----------------------------------------------------------------------------------------
export const PERSONALITIES = {
  balanced: { name: "Balanced", icon: "⚖️", desc: "A well-rounded general. No surprises.", diff: {}, scoreMult: 1 },
  rusher: { name: "The Rusher", icon: "🔥", desc: "Strikes early with small, fast raids. Punishes a slow start.", diff: { firstAttackMul: 0.62, waveMul: 0.7, towers: false }, scoreMult: 1.15 },
  turtle: { name: "The Turtle", icon: "🏰", desc: "Walls up, builds towers, then crushes you with a huge late army.", diff: { firstAttackMul: 1.35, waveMul: 1.45, towers: true }, scoreMult: 1.1 },
  boomer: { name: "The Boomer", icon: "🌾", desc: "Grows a monster economy first. Hit him early or face a flood.", diff: { gatherMul: 1.2, firstAttackMul: 1.15, villagersAdd: 6 }, scoreMult: 1.2 },
};
export const PERSONALITY_ORDER = Object.keys(PERSONALITIES);
// turns a personality into overrides on the difficulty table (the AI and the sim both read S.diff)
export function diffFor(baseDiff, personality) {
  const p = PERSONALITIES[personality] || PERSONALITIES.balanced; const m = p.diff || {}; const d = { ...baseDiff };
  if (m.firstAttackMul) d.firstAttack = Math.round(d.firstAttack * m.firstAttackMul);
  if (m.waveMul) d.wave = Math.max(3, Math.round(d.wave * m.waveMul));
  if (m.gatherMul) d.gather = d.gather * m.gatherMul;
  if (m.villagersAdd) d.villagers = d.villagers + m.villagersAdd;
  if (m.towers != null) d.towers = m.towers;
  return d;
}

// ---- the campaign: The Labours of Athens ------------------------------------------------------------------------------------
// diff = overrides on the difficulty table for this mission.  startMul = how much of the usual starting stores you get.
export const CAMPAIGN = [
  {
    id: "m1", num: 1, name: "The Plain of Marathon", icon: "🏛️", seed: 7, difficulty: "recruit", omen: 0,
    intro: "The Persian fleet is gone, but Sparta now eyes your fields. Raise a small city, train a few spears and teach them to leave Athens alone. Your champion stands beside your Town Center.",
    outro: "The Spartan banners fall. Athens learns to breathe again.",
    primary: O("conquer", 0), startMul: 1.2,
    guide: [O("villagers", 12, { id: "g1" }), O("own", 2, { what: "house", id: "g2" }), O("own", 1, { what: "barracks", id: "g3" }), O("army", 8, { id: "g4" })],
    bonus: [O("age", 1, { by: 600, id: "b1" }), O("noHeroLoss", 0, { id: "b2" })],
    tips: ["Select your Town Center and train Citizens.", "Right-click trees and berries to gather.", "Houses let you have more people."],
  },
  {
    id: "m2", num: 2, name: "The Nemean Caves", icon: "🦁", seed: 21, difficulty: "veteran", omen: 1, diff: { firstAttack: 960, wave: 6 },
    intro: "Shepherds whisper of dens in the hills where beasts guard old treasure. Send your champion through the mist, clear three lairs and take what the monsters hoard. Sparta will not wait forever.",
    outro: "Gold from the dens fills your coffers, and your champion's legend grows.",
    primary: O("lairs", 3), timeLimit: 1500,
    bonus: [O("shrines", 2, { id: "b1" }), O("heroLevel", 4, { id: "b2" })],
  },
  {
    id: "m3", num: 3, name: "Hold the Pass", icon: "⛰️", seed: 33, difficulty: "veteran", omen: 1, diff: { firstAttack: 270, wave: 7 }, startMul: 0.7,
    intro: "Spartan spears are marching on the pass. You cannot beat them yet; you only have to outlast them. Fortify, gather and survive eleven minutes until the Athenian relief column arrives.",
    outro: "The relief column arrives and Sparta withdraws. You held.",
    primary: O("survive", 660),
    bonus: [O("kills", 25, { id: "b1" }), O("towers", 2, { id: "b2" })],
  },
  {
    id: "m4", num: 4, name: "The Golden Fleece", icon: "🐑", seed: 44, difficulty: "veteran", omen: 1, diff: { firstAttack: 780 },
    intro: "The Argonauts' prize is said to sleep in a monster's den. Find the sacred relics, win them from their guardians and carry two of them home to your Temple.",
    outro: "Relics glow in your Temple. The gods smile on Athens.",
    primary: O("relics", 2), timeLimit: 1800,
    bonus: [O("temples", 1, { by: 540, id: "b1" }), O("age", 2, { by: 1080, id: "b2" })],
  },
  {
    id: "m5", num: 5, name: "Ares' Gambit", icon: "🔥", seed: 55, difficulty: "elite", omen: 1, diff: { firstAttack: 600 },
    intro: "Sparta's war-god favors them, and the Elite army marches early. Crush their cities before the horns sound for the third time.",
    outro: "Even the war-god bows to a well-led phalanx.",
    primary: O("conquer", 0), timeLimit: 2100,
    bonus: [O("noHeroLoss", 0, { id: "b1" }), O("winBy", 1500, { id: "b2" })],
  },
  {
    id: "m6", num: 6, name: "The Oracle's Doom", icon: "⏳", seed: 66, difficulty: "veteran", omen: 1, diff: { towers: true },
    intro: "The Oracle has spoken: if Sparta still stands at the eighteenth minute, Athens falls. Strike fast, strike hard, and do not stop to admire the view.",
    outro: "The prophecy is broken, and with it Sparta's pride.",
    primary: O("conquer", 0), timeLimit: 1080,
    bonus: [O("razed", 8, { id: "b1" }), O("army", 40, { id: "b2" })],
  },
  {
    id: "m7", num: 7, name: "The Long Night", icon: "🌙", seed: 77, difficulty: "elite", omen: 1, diff: { firstAttack: 210, wave: 11 }, startMul: 0.8,
    intro: "They come at dusk, wave after wave, bigger each time. Build walls of towers and spears, keep your champion alive, and see the sun rise fifteen minutes from now.",
    outro: "Dawn breaks over a field of broken shields. Athens still stands.",
    primary: O("survive", 900),
    bonus: [O("kills", 60, { id: "b1" }), O("heroLevel", 5, { id: "b2" })],
  },
  {
    id: "m8", num: 8, name: "The Wrath of Olympus", icon: "⚡", seed: 88, difficulty: "elite", omen: 1, diff: { gather: 1.4, start: 400, firstAttack: 540 },
    intro: "The gods themselves are watching. Sparta has grown fat on tribute and plunder, and her champion fights like a titan. End this war once and for all.",
    outro: "The thunder rolls across the hills. Olympus remembers Athens.",
    primary: O("conquer", 0), timeLimit: 2400,
    bonus: [O("wonder", 1, { id: "b1" }), O("winBy", 1800, { id: "b2" })],
  },
];
export const missionById = (id) => CAMPAIGN.find((m) => m.id === id) || null;
// a mission opens when the one before it has at least one star
export const missionOpen = (meta, i) => i === 0 || ((meta.campaign[CAMPAIGN[i - 1].id] || {}).stars || 0) > 0;

// ---- the daily trial: same war for everybody on the same day ---------------------------------------------------------------------
export const DAILY_TWISTS = [
  { id: "lean", name: "Lean Times", icon: "🥖", desc: "Half the starting stores, but omens come twice as often.", startMul: 0.5, omenMul: 0.5 },
  { id: "iron", name: "Iron Will", icon: "🗡️", desc: "Sparta strikes much earlier.", diff: { firstAttackMul: 0.7 } },
  { id: "golden", name: "Golden Age", icon: "🏺", desc: "You start rich, so does Sparta.", startMul: 1.6, diff: { start: 300 } },
  { id: "titan", name: "Titan's Wrath", icon: "🌋", desc: "Spartan waves are half again as large.", diff: { waveMul: 1.5 } },
  { id: "omens", name: "Storm of Omens", icon: "🌩️", desc: "Omens come constantly. Choose wisely.", omenMul: 0.4 },
  { id: "fogged", name: "Veil of Mist", icon: "🌫️", desc: "You see less at the start, but dens give double loot.", visionMul: 0.5, lootMul: 2 },
  { id: "quick", name: "Quick Harvest", icon: "🚜", desc: "Everyone gathers 30% faster. Both sides.", diff: { gatherMul: 1.3 }, gatherBonus: 0.3 },
];
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export function dailyScenario(key, DIFFICULTY, HERO_ORDER) {
  const h = hashStr(key); const twist = DAILY_TWISTS[h % DAILY_TWISTS.length]; const hero = HERO_ORDER[(h >>> 3) % HERO_ORDER.length];
  const difficulty = ["veteran", "veteran", "elite"][(h >>> 6) % 3]; const seed = 1 + (h % 99990);
  const base = DIFFICULTY[difficulty]; const dm = twist.diff || {}; const f = { ...base };
  if (dm.start) f.start += dm.start; if (dm.firstAttackMul) f.firstAttack = Math.round(f.firstAttack * dm.firstAttackMul); if (dm.waveMul) f.wave = Math.round(f.wave * dm.waveMul); if (dm.gatherMul) f.gather *= dm.gatherMul;
  return {
    id: "daily-" + key, mode: "daily", name: `Daily Trial · ${twist.name}`, key, seed, difficulty, hero, twist, diff: f, startMul: twist.startMul || 1, omenMul: twist.omenMul || 1, visionMul: twist.visionMul || 1, lootMul: twist.lootMul || 1, gatherBonus: twist.gatherBonus || 0,
    primary: O("conquer", 0), fates: 3, fateSeed: h,
  };
}
export function skirmishScenario({ difficulty, personality = "balanced", DIFFICULTY }) {
  const p = PERSONALITIES[personality] || PERSONALITIES.balanced; const diff = diffFor(DIFFICULTY[difficulty], personality);
  return { id: "skirmish", mode: "skirmish", name: "Skirmish", difficulty, personality, diff, primary: O("conquer", 0), fates: 3, scoreMult: p.scoreMult, omenMul: 1 };
}
export function campaignScenario(m, hero) { return { ...m, mode: "campaign", mission: m.id, hero, omenMul: m.omen === 0 ? 0 : 1 }; }
