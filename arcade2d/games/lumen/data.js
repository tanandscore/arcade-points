// Lumen Trail — heroes, skills, enemies and the six chapters. Everything here is plain data.
export const ELEM = { sword: "#e8eef7", spear: "#ffd98a", bow: "#9be08a", dagger: "#c9a0ff", fire: "#ff7a3c", ice: "#7fd6ff", bolt: "#ffe94a", light: "#fff3b0", dark: "#a46bff" };
export const ELEM_NAME = { sword: "Sword", spear: "Spear", bow: "Bow", dagger: "Dagger", fire: "Fire", ice: "Ice", bolt: "Lightning", light: "Light", dark: "Shadow" };

// stats are for level 1; they grow with the chapter's level (see statsAt)
export const HEROES = {
  aldric: { id: "aldric", name: "Aldric", job: "Warrior", color: "#d84a4a", hair: "#5a3a22", skin: "#f0c7a0", hp: 120, sp: 50, atk: 16, mag: 6, def: 12, spd: 9, weapons: ["sword", "spear"], skills: ["powerstrike", "spearsweep", "rally", "bulwark"], bio: "A knight who lost his banner and kept the road." },
  selene: { id: "selene", name: "Selene", job: "Mage", color: "#6a5bd8", hair: "#e8e0ff", skin: "#f5d6c0", hp: 82, sp: 90, atk: 6, mag: 18, def: 7, spd: 10, weapons: ["staff"], skills: ["fire", "blizzard", "arc", "thunderfall", "focus", "meteor"], bio: "A scholar chasing a star that fell on the road north." },
  mirelle: { id: "mirelle", name: "Mirelle", job: "Cleric", color: "#f0e6c8", hair: "#e8a8c8", skin: "#f0c7a0", hp: 94, sp: 84, atk: 8, mag: 14, def: 9, spd: 8, weapons: ["staff"], skills: ["heal", "holy", "barrier", "massheal", "revive", "smite"], bio: "A lantern-bearer whose light has never gone out." },
  kestrel: { id: "kestrel", name: "Kestrel", job: "Thief", color: "#2f7a5a", hair: "#2a2a35", skin: "#d9a982", hp: 90, sp: 64, atk: 14, mag: 8, def: 8, spd: 14, weapons: ["dagger", "bow"], skills: ["doublecut", "pierce", "poison", "steal", "quickstep", "flurry"], bio: "Quick hands, quicker feet, and a map nobody else can read." },
};
// unlockCh = the chapter (1-6) in which the hero first has the skill
export const SKILLS = {
  powerstrike: { name: "Power Strike", sp: 12, type: "sword", pow: 2.2, t: "one", hits: 1, desc: "A heavy sword blow.", unlock: 1 },
  spearsweep: { name: "Spear Sweep", sp: 10, type: "spear", pow: 1.15, t: "all", hits: 1, desc: "Hits every foe with the spear.", unlock: 2 },
  rally: { name: "Rally", sp: 14, kind: "buff", t: "allies", stat: "atk", desc: "Raises everyone's attack for 3 turns.", unlock: 3 },
  bulwark: { name: "Bulwark", sp: 10, kind: "buff", t: "self", stat: "def", amt: 0.6, desc: "Greatly raises your defence for 3 turns.", unlock: 4 },
  fire: { name: "Fireball", sp: 8, type: "fire", pow: 1.7, t: "one", hits: 1, mag: true, desc: "A ball of fire.", unlock: 1 },
  blizzard: { name: "Blizzard", sp: 14, type: "ice", pow: 1.1, t: "all", hits: 1, mag: true, desc: "Ice on every foe.", unlock: 2 },
  arc: { name: "Lightning Arc", sp: 9, type: "bolt", pow: 1.85, t: "one", hits: 1, mag: true, desc: "A bolt of lightning.", unlock: 3 },
  thunderfall: { name: "Thunderfall", sp: 18, type: "bolt", pow: 0.9, t: "rand", hits: 4, mag: true, desc: "Four bolts at random foes.", unlock: 4 },
  focus: { name: "Focus", sp: 0, kind: "sp", t: "self", amt: 28, desc: "Recover SP.", unlock: 2 },
  meteor: { name: "Meteor", sp: 30, type: "fire", pow: 2.2, t: "all", hits: 1, mag: true, desc: "Rain fire on everything.", unlock: 5 },
  heal: { name: "Heal", sp: 8, kind: "heal", t: "ally", pow: 2.4, desc: "Restore one ally's health.", unlock: 2 },
  holy: { name: "Holy Light", sp: 9, type: "light", pow: 1.6, t: "one", hits: 1, mag: true, desc: "A beam of light.", unlock: 2 },
  barrier: { name: "Barrier", sp: 12, kind: "buff", t: "allies", stat: "def", desc: "Raises everyone's defence for 3 turns.", unlock: 3 },
  massheal: { name: "Mass Heal", sp: 18, kind: "heal", t: "allies", pow: 1.6, desc: "Heal the whole party.", unlock: 4 },
  revive: { name: "Revive", sp: 22, kind: "revive", t: "fallen", desc: "Bring a fallen ally back.", unlock: 4 },
  smite: { name: "Smite", sp: 22, type: "light", pow: 1.5, t: "all", hits: 1, mag: true, desc: "Holy light on all foes.", unlock: 5 },
  doublecut: { name: "Double Cut", sp: 10, type: "dagger", pow: 1.0, t: "one", hits: 2, desc: "Two quick dagger cuts.", unlock: 3 },
  pierce: { name: "Piercing Shot", sp: 9, type: "bow", pow: 1.7, t: "one", hits: 1, pierce: true, desc: "An arrow that ignores armour.", unlock: 3 },
  poison: { name: "Venom Dart", sp: 8, type: "dark", pow: 1.3, t: "one", hits: 1, poison: true, desc: "Shadow damage that poisons.", unlock: 4 },
  steal: { name: "Pilfer", sp: 4, kind: "steal", t: "one", desc: "Take an item from a foe.", unlock: 3 },
  quickstep: { name: "Quick Step", sp: 10, kind: "bp", t: "ally", desc: "Give an ally +1 boost point.", unlock: 4 },
  flurry: { name: "Shadow Flurry", sp: 24, type: "dagger", pow: 0.8, t: "rand", hits: 6, desc: "Six cuts at random foes.", unlock: 5 },
};
export const ITEMS = {
  potion: { name: "Potion", desc: "Heal 160 HP", kind: "heal", amt: 160, t: "ally" },
  ether: { name: "Ether", desc: "Restore 35 SP", kind: "sp", amt: 35, t: "ally" },
  feather: { name: "Phoenix Feather", desc: "Revive a fallen hero", kind: "revive", t: "fallen" },
  bomb: { name: "Spark Bomb", desc: "130 damage to all foes", kind: "bomb", amt: 130, t: "all" },
};

// enemies: shield = break points; weak = weaknesses (revealed when you hit them); acts = what they do
const E = (o) => ({ shield: 3, weak: [], acts: ["attack"], pts: 30, ...o });
export const ENEMIES = {
  slime: E({ name: "Dew Slime", hp: 70, atk: 11, def: 4, spd: 7, shield: 2, weak: ["fire", "dagger"], pts: 20 }),
  bat: E({ name: "Hollow Bat", hp: 56, atk: 12, def: 3, spd: 14, shield: 2, weak: ["bow", "bolt"], acts: ["attack", "attack", "drain"], pts: 24 }),
  wolf: E({ name: "Gray Wolf", hp: 110, atk: 16, def: 6, spd: 12, shield: 3, weak: ["sword", "fire", "bow"], acts: ["attack", "attack", "howl"], pts: 36 }),
  sprout: E({ name: "Thorn Sprout", hp: 90, atk: 14, def: 5, spd: 6, shield: 3, weak: ["fire", "sword", "ice"], acts: ["attack", "poisonspit"], pts: 30 }),
  skeleton: E({ name: "Bone Soldier", hp: 150, atk: 21, def: 10, spd: 8, shield: 4, weak: ["light", "spear", "fire"], pts: 44 }),
  goblin: E({ name: "Cave Goblin", hp: 120, atk: 18, def: 7, spd: 11, shield: 3, weak: ["dagger", "bolt", "bow"], acts: ["attack", "attack", "stealgold"], pts: 38 }),
  mushroom: E({ name: "Sporecap", hp: 130, atk: 15, def: 8, spd: 5, shield: 3, weak: ["fire", "dagger", "spear"], acts: ["attack", "poisonspit", "sleepy"], pts: 40 }),
  wisp: E({ name: "Cold Wisp", hp: 100, atk: 14, mag: 24, def: 5, spd: 13, shield: 3, weak: ["fire", "light", "sword"], acts: ["icebolt", "icebolt", "attack"], pts: 42 }),
  iceknight: E({ name: "Frost Guard", hp: 240, atk: 28, def: 16, spd: 9, shield: 4, weak: ["fire", "bolt", "spear", "dark"], pts: 66 }),
  crab: E({ name: "Reef Crab", hp: 200, atk: 25, def: 18, spd: 7, shield: 4, weak: ["bolt", "ice", "spear"], pts: 60 }),
  ghoul: E({ name: "Tide Ghoul", hp: 220, atk: 27, def: 12, spd: 9, shield: 4, weak: ["light", "fire", "sword"], acts: ["attack", "drain", "attack"], pts: 64 }),
  spider: E({ name: "Crown Spider", hp: 210, atk: 26, def: 11, spd: 13, shield: 4, weak: ["fire", "bow", "light"], acts: ["attack", "poisonspit", "attack"], pts: 66 }),
  imp: E({ name: "Ash Imp", hp: 180, atk: 24, mag: 34, def: 10, spd: 14, shield: 3, weak: ["ice", "bow", "dagger"], acts: ["firebolt", "attack", "firebolt"], pts: 62 }),
  golemlet: E({ name: "Slag Golem", hp: 360, atk: 38, def: 24, spd: 4, shield: 5, weak: ["ice", "spear", "bolt"], acts: ["attack", "slam"], pts: 90 }),
  blackknight: E({ name: "Hollow Knight", hp: 320, atk: 40, def: 20, spd: 10, shield: 5, weak: ["light", "bolt", "dagger", "fire"], acts: ["attack", "attack", "slam"], pts: 96 }),
  // ---- bosses ----
  mossmaw: E({ name: "Mossmaw", boss: true, big: true, hp: 760, atk: 20, def: 7, spd: 7, shield: 5, weak: ["fire", "sword", "ice"], acts: ["attack", "poisonspit", "attack"], charge: { name: "Root Crush", every: 4, dmg: 2.6, all: true }, pts: 400, spr: "mossmaw" }),
  warden: E({ name: "Warden Golem", boss: true, big: true, hp: 1250, atk: 30, def: 16, spd: 6, shield: 6, weak: ["ice", "spear", "bolt"], acts: ["attack", "slam", "attack"], charge: { name: "Seismic Fist", every: 4, dmg: 2.8, all: true }, pts: 700, spr: "warden" }),
  frostdrake: E({ name: "Frost Drake", boss: true, big: true, hp: 1900, atk: 34, mag: 44, def: 14, spd: 11, shield: 6, weak: ["fire", "bolt", "light", "bow"], acts: ["attack", "icebolt", "attack", "howl"], charge: { name: "Glacier Breath", every: 4, dmg: 2.5, all: true }, pts: 1000, spr: "drake" }),
  hydra: E({ name: "Tidecaller", boss: true, big: true, hp: 2600, atk: 42, mag: 46, def: 18, spd: 9, shield: 7, weak: ["bolt", "light", "dagger", "spear"], acts: ["attack", "drain", "icebolt", "attack"], charge: { name: "Maelstrom", every: 4, dmg: 2.6, all: true }, pts: 1400, spr: "hydra" }),
  ashen: E({ name: "Ashen Knight", boss: true, big: true, hp: 3400, atk: 54, mag: 52, def: 24, spd: 12, shield: 7, weak: ["ice", "light", "bow", "spear"], acts: ["attack", "firebolt", "slam", "attack"], charge: { name: "Cinder Verdict", every: 4, dmg: 2.7, all: true }, pts: 1900, spr: "ashen" }),
  hollowking: E({ name: "The Hollow King", boss: true, big: true, hp: 5200, atk: 62, mag: 60, def: 26, spd: 12, shield: 8, weak: ["light", "sword", "bolt", "dark", "fire"], acts: ["attack", "firebolt", "icebolt", "drain", "slam"], charge: { name: "Hollow Eclipse", every: 3, dmg: 2.7, all: true }, phase2: 0.5, pts: 3000, spr: "king" }),
};
export const ENEMY_ACTS = {
  attack: { name: "Strike" }, slam: { name: "Slam", pow: 1.6 }, drain: { name: "Drain", pow: 1.1, drain: true }, howl: { name: "Howl", buff: true }, poisonspit: { name: "Venom Spit", pow: 1.0, poison: true },
  icebolt: { name: "Ice Bolt", pow: 1.5, mag: true, elem: "ice" }, firebolt: { name: "Fire Bolt", pow: 1.5, mag: true, elem: "fire" }, sleepy: { name: "Spore Cloud", pow: 0.8, all: true }, stealgold: { name: "Grab", pow: 0.8 },
};

// ---- the six chapters. nodes: story / battle / chest / rest / boss -----------------------------------------------------------------------
const S = (who, text) => ({ who, text });
export const CHAPTERS = [
  { id: "c1", name: "The Lantern Road", theme: "forest", level: 6, party: ["aldric", "selene"], par: 14, desc: "Two travellers meet on a dark road.", music: "sunny",
    nodes: [
      { k: "story", lines: [S("Narrator", "Three nights ago a star fell on the northern road. The lanterns along it have been going out one by one."), S("Aldric", "You are a long way from the university, scholar."), S("Selene", "And you are a long way from any banner, knight. We are walking the same way. Shall we walk it together?"), S("Aldric", "...Stay behind me. Something is moving in the trees.")] },
      { k: "battle", foes: ["slime", "slime"] }, { k: "chest", item: "potion", n: 2 },
      { k: "battle", foes: ["bat", "bat", "slime"] }, { k: "rest", lines: [S("Selene", "The slimes were weak to fire. Hit a foe's weakness enough times and its shield breaks. Then it loses a turn and takes far more damage."), S("Aldric", "And boosting? Each turn you earn a boost point. Spend up to three to hit harder, or hit more times.")] },
      { k: "battle", foes: ["wolf", "sprout"] },
      { k: "story", lines: [S("Selene", "The road bends into the old orchard. Something huge is asleep in the roots."), S("Aldric", "Not for long.")] },
      { k: "boss", foes: ["mossmaw"], after: [S("Selene", "The lantern at the gate is still dark."), S("Aldric", "Then we keep walking.")] },
    ] },
  { id: "c2", name: "Cinder Hollow", theme: "cave", level: 11, party: ["aldric", "selene", "mirelle"], par: 16, desc: "A lantern-bearer waits in the dark.", music: "cave",
    nodes: [
      { k: "story", lines: [S("Narrator", "Beyond the orchard the road drops into a cave of old coal fires."), S("Mirelle", "Please don't be afraid. I follow the road's last light. It stopped at the bottom of this hollow."), S("Aldric", "Then we go down together."), S("Mirelle", "Keep your weapons low. The bones here walk.")] },
      { k: "battle", foes: ["skeleton", "bat", "bat"] }, { k: "chest", item: "ether", n: 2 },
      { k: "battle", foes: ["goblin", "goblin", "mushroom"] }, { k: "rest", lines: [S("Mirelle", "I can heal and shield, but my light also burns the undead. Look for the light weakness."), S("Selene", "And when you cannot find a weakness, boost and brute-force it.")] },
      { k: "battle", foes: ["skeleton", "skeleton", "goblin"] },
      { k: "story", lines: [S("Narrator", "The floor of the hollow is a single huge stone face. It opens its eyes.")] },
      { k: "boss", foes: ["warden", "bat", "bat"], after: [S("Mirelle", "The warden guarded the lantern, not the star."), S("Selene", "Then the star is further north.")] },
    ] },
  { id: "c3", name: "Frostwatch Pass", theme: "snow", level: 16, party: ["aldric", "selene", "mirelle", "kestrel"], par: 18, desc: "A thief on the snowy mountain road.", music: "snow",
    nodes: [
      { k: "story", lines: [S("Narrator", "Snow. The pass is lit only by the blue wisps that follow travellers."), S("Kestrel", "Don't turn around. I have been following you for two days. You walk like people who are heading to the same hole in the sky as me."), S("Aldric", "A thief."), S("Kestrel", "A thief with a map. Take me with you and I will show you the shortcut.")] },
      { k: "battle", foes: ["wolf", "wolf", "wisp"] }, { k: "chest", item: "bomb", n: 2 },
      { k: "battle", foes: ["wisp", "iceknight"] }, { k: "rest", lines: [S("Kestrel", "I can pilfer an item from a foe. And Quick Step gives a friend another boost point."), S("Mirelle", "Four of us now. The road feels shorter.")] },
      { k: "battle", foes: ["iceknight", "wisp", "wolf"] },
      { k: "story", lines: [S("Narrator", "At the top of the pass the wind stops. Something with wings of ice lifts off the glacier.")] },
      { k: "boss", foes: ["frostdrake"], after: [S("Kestrel", "I have stolen from a lot of dragons. Never one that stayed down this nicely."), S("Aldric", "To the sunken city.")] },
    ] },
  { id: "c4", name: "The Sunken Crown", theme: "ruins", level: 22, party: ["aldric", "selene", "mirelle", "kestrel"], par: 20, desc: "A drowned city under the northern light.", music: "calm",
    nodes: [
      { k: "story", lines: [S("Narrator", "The star's light shines out of a flooded city. Its crown, a ring of towers, is half under the sea."), S("Selene", "Every old map shows a kingdom here. Every old book says it never existed."), S("Mirelle", "Then who lit all these lanterns?")] },
      { k: "battle", foes: ["crab", "crab", "spider"] }, { k: "chest", item: "feather", n: 1 },
      { k: "battle", foes: ["ghoul", "ghoul", "spider"] }, { k: "rest", lines: [S("Aldric", "Poison is slow but it adds up. Keep Mirelle healing, and break the big ones first."), S("Kestrel", "Thunder cracks crabs. Light cracks ghouls. Fire cracks spiders. You're welcome.")] },
      { k: "battle", foes: ["crab", "ghoul", "spider", "spider"] },
      { k: "story", lines: [S("Narrator", "The water rises. Something with seven necks has been waiting for the tide.")] },
      { k: "boss", foes: ["hydra"], after: [S("Selene", "The star isn't here. Only its light."), S("Mirelle", "Then it is in the mountain to the east.")] },
    ] },
  { id: "c5", name: "Ashen Citadel", theme: "volcano", level: 28, party: ["aldric", "selene", "mirelle", "kestrel"], par: 22, desc: "A fortress on a mountain that is still burning.", music: "fire",
    nodes: [
      { k: "story", lines: [S("Narrator", "The Citadel stands inside the crater. Its gates are open. Its soldiers are not alive."), S("Aldric", "I know this place. This was my banner's last stand."), S("Kestrel", "You never said that."), S("Aldric", "I never said anything about it. Until now.")] },
      { k: "battle", foes: ["imp", "imp", "golemlet"] }, { k: "chest", item: "potion", n: 3 },
      { k: "battle", foes: ["blackknight", "imp", "imp"] }, { k: "rest", lines: [S("Mirelle", "Ice cools the golems. Spears and arrows find the knights' gaps."), S("Selene", "And Meteor now. Use it when everything has its shield down.")] },
      { k: "battle", foes: ["golemlet", "blackknight", "imp"] },
      { k: "story", lines: [S("Narrator", "In the throne hall a figure in ashen armour kneels in front of an empty chair."), S("Aldric", "Commander...")] },
      { k: "boss", foes: ["ashen"], after: [S("Aldric", "He kept the gate for a king who never came back."), S("Mirelle", "Then let's go and find the king.")] },
    ] },
  { id: "c6", name: "The Hollow Throne", theme: "dungeon", level: 34, party: ["aldric", "selene", "mirelle", "kestrel"], par: 26, desc: "The star, the king, and the end of the road.", music: "boss",
    nodes: [
      { k: "story", lines: [S("Narrator", "Under the Citadel the road ends in a hall of black iron flowers, all blooming at once."), S("Selene", "The star fell here. It made the flowers, and the flowers made a king."), S("Kestrel", "Can we just steal the star and go home?"), S("Mirelle", "No. We carry the light back, or nothing does.")] },
      { k: "battle", foes: ["blackknight", "blackknight", "wisp"] }, { k: "chest", item: "ether", n: 3 },
      { k: "battle", foes: ["golemlet", "ghoul", "imp", "imp"] }, { k: "rest", lines: [S("Aldric", "Whatever happens, we move together. Like the road."), S("Kestrel", "I'll take the front. I'm the fastest.")] },
      { k: "battle", foes: ["blackknight", "iceknight", "golemlet", "ghoul"] },
      { k: "story", lines: [S("Narrator", "The iron flowers close. A king stands up from a throne made of a fallen star."), S("The Hollow King", "You carried the light all this way, only to put it out.")] },
      { k: "boss", foes: ["hollowking"], last: true, after: [S("Narrator", "The Hollow King falls. The star lifts out of the throne, small and warm."), S("Mirelle", "All the lanterns on the road are lit again."), S("Aldric", "Then it's time to go home."), S("Selene", "Which road?"), S("Kestrel", "Any road. We'll walk it together.")] },
    ] },
];
export const statsAt = (h, lvl) => { const g = 1 + (lvl - 1) * 0.16; return { hp: Math.round(h.hp * g * 1.6), sp: Math.round(h.sp * (1 + (lvl - 1) * 0.05)), atk: Math.round(h.atk * g), mag: Math.round(h.mag * g), def: Math.round(h.def * g * 0.95), spd: h.spd + Math.floor(lvl / 8) }; };
