"use client";

import { useEffect, useRef, useState } from "react";
import { sfx, createKingdomMusic } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

// Widened from 640 — desktop-only Legend Pass games (this one
// included) have real unused screen room on any real desktop
// viewport, and a 60-minute session genuinely needs more buildable
// area than a 5-minute one ever did. WATER moves to the new right
// edge below; every other position (forests, town center) sits well
// under x=360, so this expansion is purely additive space, nothing
// existing needed to move.
// Widened again — desktop-only Legend Pass game, and "more map to
// work with" was the explicit ask. 820x420 -> 1100x560 is a genuine
// ~34% increase in playable area, not a cosmetic bump.
const MAP_W = 1100;
const MAP_H = 560;
const TICK_MS = 60;
const SESSION_SECONDS = 3600; // a real 60-minute experience, deliberately — see the honesty note given at the start of this build
const SAVE_KEY = "kingdomsofash_save_v1";
const AUTOSAVE_INTERVAL_MS = 15000;

const VILLAGER_FIRST_NAMES = ["Edda", "Bram", "Ronan", "Sigrid", "Halric", "Ysolde", "Corwin", "Maren", "Osric", "Liora", "Tamsin", "Godwin", "Elowen", "Bastian", "Rhona"];
const VILLAGER_SURNAMES = ["Ashford", "Millbrook", "Hollowell", "Rivenshaw", "Thatcher", "Greymoor", "Wickstead", "Fenwright"];
function randomVillagerName() {
  return `${VILLAGER_FIRST_NAMES[Math.floor(Math.random() * VILLAGER_FIRST_NAMES.length)]} ${VILLAGER_SURNAMES[Math.floor(Math.random() * VILLAGER_SURNAMES.length)]}`;
}

// Flavor-only environmental storytelling — not a simulated event
// system with consequences, just short narrative beats that make the
// kingdom feel like it has a life beyond the player's own actions.
const KINGDOM_STORIES = [
  "A traveling merchant passed through and shared news from distant lands.",
  "Children found strange old stones near the treeline.",
  "A wandering bard sang songs by the town center tonight.",
  "Someone swears they saw a golden deer at the forest's edge.",
  "The bakers say this season's grain smells sweeter than usual.",
  "An old villager recalled a kingdom that once stood here, long ago.",
  "A stray dog has taken to following the woodcutters.",
  "Frost patterns on the windows formed the shape of a crown this morning.",
];

// Deliberately rare (see nextLegendAtRef) and deliberately more
// visually distinct than an ordinary story — these are meant to be
// the moments a player actually remembers from a session, not
// another line of ambient flavor text.
const LEGENDARY_EVENTS = [
  "🦌 A golden deer was seen at the forest's edge — the elders call it a blessing.",
  "☄️ A meteor streaked across the sky and the whole kingdom stopped to watch.",
  "🌘 An eclipse darkened the sky at midday, and for a moment, all was still.",
  "👣 Villagers speak of a wandering giant glimpsed beyond the hills.",
  "🐉 Something vast and winged crossed the moon last night. No one can explain it.",
];

// Shrunk from a 160px-wide (25% of the ORIGINAL 640px map) purely
// decorative strip to 90px, and moved to the new right edge of the
// widened map above — between the width increase and this shrink,
// buildable width goes from 460px to roughly 720px. Now genuinely
// functional via the Fishing Dock building below, not just visual.
const WATER = { x: 1010, y: 0, w: 90, h: MAP_H };
const RESOURCE_COLORS = { wood: "#c9a876", stone: "#9a9a9a", food: "#8bc34a", gold: "#ffe14d" };

// Calibrated against house capacity (3 per house, base 3) — a
// genuinely active hour of building houses can plausibly reach the
// high end of this range, not an unreachable number.
// Extended well past the old top tier (which capped at population 38
// — meaning kingdom growth, the game's core progression arc, fully
// stopped around the 15-20 minute mark regardless of how long the
// session ran). These higher tiers need genuinely large populations,
// giving the growth curve real reach across a full 60-minute session
// instead of plateauing a quarter of the way through it.
const KINGDOM_TIERS = [
  { minPop: 0, name: "Tiny Village" },
  { minPop: 6, name: "Growing Hamlet" },
  { minPop: 12, name: "Small Town" },
  { minPop: 20, name: "Large Town" },
  { minPop: 28, name: "Fortified City" },
  { minPop: 38, name: "Great Kingdom" },
  { minPop: 50, name: "Sovereign Realm" },
  { minPop: 64, name: "Grand Empire" },
  { minPop: 80, name: "Legendary Empire" },
];
function kingdomTier(population) {
  let idx = 0;
  for (let i = 0; i < KINGDOM_TIERS.length; i++) {
    if (population >= KINGDOM_TIERS[i].minPop) idx = i;
  }
  return { index: idx, name: KINGDOM_TIERS[idx].name };
}
// More clusters spread across the widened map — the earlier three
// were all bunched in the original map's left/top portion, leaving
// the newly available space empty. Stone outcroppings are a genuine
// new feature, not decoration: quarries now need to be near one, the
// same way lumber camps already need a forest — a real placement
// decision the new space enables, not just visual filler.
const FORESTS = [
  { x: 60, y: 60, r: 60 },
  { x: 110, y: 320, r: 55 },
  { x: 360, y: 55, r: 45 },
  { x: 620, y: 420, r: 55 },
  { x: 780, y: 90, r: 50 },
  { x: 470, y: 460, r: 45 },
];
const STONE_OUTCROPPINGS = [
  { x: 900, y: 250, r: 45 },
  { x: 250, y: 480, r: 40 },
  { x: 550, y: 130, r: 40 },
];
// A new terrain feature and a genuinely new task, not more of the
// same gather/build loop — a fixed, undevelopable landmark villagers
// can excavate for a real risk/reward decision. Positioned in open
// ground clear of every existing forest, outcropping, and the water
// strip (nearest existing feature is ~180-200px away, well outside
// this ruin's own 55px radius).
const RUINS = { x: 700, y: 250, r: 55 };
const RUINS_MAX_CHARGES = 3; // the site is exhausted after this many successful digs — a limited, not infinite, bonus source
const RUINS_DIG_COST = { gold: 20 };
const RUINS_COOLDOWN_MS = 75000;
// A second new terrain feature — purely a no-build hazard zone (no
// mechanic like Ruins' excavation), forcing real map-layout decisions
// around it rather than being purely decorative. Both positions
// checked programmatically clear of every existing forest,
// outcropping, and Ruins itself before being placed.
const EMBER_VENTS = [
  { x: 150, y: 180, r: 28 },
  { x: 870, y: 450, r: 28 },
];

// Real answer to "nothing to do once the map is full" — once every
// buildable spot is taken, resource buildings can still be upgraded
// (click an existing one instead of placing a new one) for
// meaningfully higher output, capped at level 3. A genuine, ongoing
// resource sink and decision that doesn't need any more physical
// space, which is exactly what runs out first.
// Kingdom Level — the honest equivalent of "hero progression" for a
// game with no individual hero unit: the kingdom itself gains XP
// from real actions throughout the whole 60 minutes (gathering,
// building, tier-ups, repelling raids) and levels up to 50, with a
// genuine automatic bonus every 5 levels and a real binary choice —
// not a full talent tree, but an actual decision — at levels 10/20/
// 30/40/50. This is a deliberately scoped-down analog, not a
// pretend 50-level RPG system with equipment and skill trees.
const MAX_KINGDOM_LEVEL = 50;
const KINGDOM_XP_PER_LEVEL = 55; // level N needs N * this much cumulative XP
const KINGDOM_LEVEL_GATHER_BONUS = 0.03; // +3% per 5 levels, applied in the gather formula below
const KINGDOM_MILESTONE_LEVELS = [10, 20, 30, 40, 50];
const KINGDOM_MILESTONE_CHOICES = {
  10: [
    { id: "gather", label: "+8% all gathering", icon: "🌾" },
    { id: "defense", label: "+15% tower damage", icon: "🏹" },
  ],
  20: [
    { id: "gather", label: "+8% all gathering", icon: "🌾" },
    { id: "defense", label: "+15% tower damage", icon: "🏹" },
  ],
  30: [
    { id: "gather", label: "+10% all gathering", icon: "🌾" },
    { id: "defense", label: "+20% tower damage", icon: "🏹" },
  ],
  40: [
    { id: "gather", label: "+10% all gathering", icon: "🌾" },
    { id: "defense", label: "+20% tower damage", icon: "🏹" },
  ],
  50: [
    { id: "gather", label: "+15% all gathering", icon: "🌾" },
    { id: "defense", label: "+25% tower damage", icon: "🏹" },
  ],
};

function kingdomLevelFromXp(xp) {
  let level = 1;
  let needed = KINGDOM_XP_PER_LEVEL;
  let remaining = xp;
  while (remaining >= needed && level < MAX_KINGDOM_LEVEL) {
    remaining -= needed;
    level += 1;
    needed = level * KINGDOM_XP_PER_LEVEL;
  }
  return { level, xpIntoLevel: remaining, xpForNext: needed };
}

const MAX_BUILDING_LEVEL = 3;
const UPGRADE_OUTPUT_MULT = [1, 1.8, 3.2]; // index = level-1
const UPGRADE_COST_MULT = [null, 2.2, 4.5]; // cost to REACH that level, index = level-1

const BUILDING_TYPES = {
  house: { name: "House", icon: "🏠", cost: { wood: 30 }, w: 26, h: 26, color: "#e8d9c0", capacity: 3 },
  farm: { name: "Farm", icon: "🌾", cost: { wood: 20 }, w: 36, h: 24, color: "#6bff6b", produces: "food", jobSlots: 2, rate: 0.4 },
  lumberCamp: { name: "Lumber Camp", icon: "🪓", cost: { wood: 15 }, w: 28, h: 28, color: "#8a6a3c", produces: "wood", jobSlots: 2, rate: 0.45, needsForest: true },
  quarry: { name: "Stone Quarry", icon: "⛏️", cost: { wood: 35 }, w: 30, h: 30, color: "#9aa0a6", produces: "stone", jobSlots: 2, rate: 0.3, needsStone: true },
  blacksmith: { name: "Blacksmith", icon: "🔨", cost: { wood: 30, stone: 20 }, w: 26, h: 26, color: "#ff5a3c", produces: "gold", jobSlots: 1, rate: 0.2 },
  watchTower: { name: "Watch Tower", icon: "🗼", cost: { wood: 40, stone: 25 }, w: 20, h: 40, color: "#3ee6e0", defense: true, range: 90, damage: 12 },
  market: { name: "Market", icon: "⛺", cost: { wood: 40, stone: 15 }, w: 32, h: 24, color: "#b45cff", produces: "gold", jobSlots: 1, rate: 0.25 },
  // The genuinely functional use of the water feature — must be
  // placed right at the shoreline (see needsWater in canPlace) and
  // out-produces a Farm as the reward for actually using that space,
  // rather than the water being purely decorative.
  fishingDock: { name: "Fishing Dock", icon: "🎣", cost: { wood: 25 }, w: 30, h: 22, color: "#3ea8e0", produces: "food", jobSlots: 2, rate: 0.55, needsWater: true },
};

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// A full day-night cycle every 9 minutes gives roughly 6-7 full
// cycles across a 60-minute session — enough to genuinely see
// several nights (villages at night are meant to feel magical, per
// the brief) without each phase rushing by too fast to notice.
const DAY_CYCLE_SECONDS = 540;
// A fresh kingdom starts partway into the cycle (full daylight)
// rather than at elapsed=0, which mapped to the darkest point of
// night — used consistently everywhere the cycle position is
// computed, not just in rendering, so night-dependent logic (firefly
// spawning, phase announcements) agrees with what's on screen.
const DAY_CYCLE_START_OFFSET = DAY_CYCLE_SECONDS * 0.4;
function getCyclePos(elapsed) {
  return ((elapsed + DAY_CYCLE_START_OFFSET) % DAY_CYCLE_SECONDS) / DAY_CYCLE_SECONDS;
}
const DAY_KEYFRAMES = [
  { t: 0.0, sky: [8, 8, 26], brightness: 0.25, label: "" },
  { t: 0.14, sky: [10, 10, 30], brightness: 0.25, label: "" },
  { t: 0.2, sky: [95, 60, 70], brightness: 0.45, label: "Sunrise" },
  { t: 0.28, sky: [255, 175, 110], brightness: 0.78, label: "Golden Hour" },
  { t: 0.4, sky: [140, 185, 225], brightness: 1.0, label: "" },
  { t: 0.6, sky: [140, 185, 225], brightness: 1.0, label: "Noon" },
  { t: 0.72, sky: [255, 165, 100], brightness: 0.78, label: "Golden Hour" },
  { t: 0.8, sky: [190, 85, 85], brightness: 0.5, label: "Sunset" },
  { t: 0.87, sky: [55, 40, 90], brightness: 0.35, label: "Blue Hour" },
  { t: 1.0, sky: [8, 8, 26], brightness: 0.25, label: "" },
];

function dayNightAt(cyclePos) {
  for (let i = 0; i < DAY_KEYFRAMES.length - 1; i++) {
    const a = DAY_KEYFRAMES[i];
    const b = DAY_KEYFRAMES[i + 1];
    if (cyclePos >= a.t && cyclePos <= b.t) {
      const localT = (cyclePos - a.t) / (b.t - a.t || 1);
      const sky = a.sky.map((v, idx) => Math.round(v + (b.sky[idx] - v) * localT));
      const brightness = a.brightness + (b.brightness - a.brightness) * localT;
      return { sky, brightness, label: localT < 0.5 ? a.label : b.label };
    }
  }
  return { sky: DAY_KEYFRAMES[0].sky, brightness: DAY_KEYFRAMES[0].brightness, label: "" };
}

// Three kingdom-threat tiers — bandits raid more often, do more
// damage, and steal more gold as difficulty rises, and villager
// resource-gathering is a little slower on the harder tiers so
// stockpiling for defenses is a real tradeoff. Score multiplier
// rewards playing the harder game, same pattern as every other
// difficulty tier on the site.
const DIFFICULTIES = {
  peaceful: { label: "PEACEFUL", banditIntervalMs: 70000, banditDamageMult: 0.6, gatherMult: 1.1, scoreMult: 1 },
  contested: { label: "CONTESTED", banditIntervalMs: 48000, banditDamageMult: 1, gatherMult: 1, scoreMult: 1.4 },
  besieged: { label: "BESIEGED", banditIntervalMs: 30000, banditDamageMult: 1.6, gatherMult: 0.88, scoreMult: 1.9 },
};

export default function KingdomsOfAsh({ onFinish, accentColor }) {
  const canvasRef = useRef(null);
  const [deviceOk, setDeviceOk] = useState(null);
  const [phase, setPhase] = useState("menu");
  const [difficulty, setDifficulty] = useState("contested");
  const [difficultyBests, setDifficultyBests] = useState({});
  const [selectedType, setSelectedType] = useState(null);
  const [hud, setHud] = useState({ wood: 60, stone: 20, food: 30, gold: 10, population: 3, timeLeft: SESSION_SECONDS, kingdomLevel: 1 });
  const [outcome, setOutcome] = useState(null);
  const [notice, setNotice] = useState("");
  const [hoveredVillager, setHoveredVillager] = useState(null);
  const [storyFlash, setStoryFlash] = useState("");
  const [savedGameInfo, setSavedGameInfo] = useState(null);
  const [pendingMilestone, setPendingMilestone] = useState(null); // { level, choices } while awaiting the player's pick
  const [caravanOffer, setCaravanOffer] = useState(null); // { give: {resource, amount}, get: {resource, amount}, expiresAt } while a trade caravan is present
  const [sessionTitle, setSessionTitle] = useState(null); // computed once at endSession — the honest equivalent of "multiple victory conditions"

  const resourcesRef = useRef({ wood: 60, stone: 20, food: 30, gold: 10 });
  const buildingsRef = useRef([]);
  const villagersRef = useRef([]);
  const banditsRef = useRef([]);
  const projectilesRef = useRef([]);
  const particlesRef = useRef([]);
  const floatTextRef = useRef([]);
  const rainDropsRef = useRef([]);
  const rainingRef = useRef(false);
  const kingdomXpRef = useRef(0);
  const kingdomLevelRef = useRef(1);
  const kingdomMilestoneChoicesRef = useRef({}); // { [level]: choiceId }
  const lastMilestoneShownRef = useRef(0);
  const nextCaravanAtRef = useRef(0);
  const nextPopGrowthAtRef = useRef(0);
  const nextWoodTrickleAtRef = useRef(0);
  const caravanActiveRef = useRef(false); // the real gating flag read inside the tick loop — caravanOffer (React state) is write-only from there, same pattern this file already uses for notice/storyFlash, since a setInterval closure doesn't see fresh state
  const caravanExpiresAtRef = useRef(0);
  const tradesMadeRef = useRef(0);
  const banditsRepelledRef = useRef(0);
  const totalGatheredRef = useRef(0);
  const warlordSpawnedRef = useRef(false); // one-time flag — the Bandit Warlord, folding "world bosses" and "titans" into one real, honest late-game encounter rather than two separate fantasy creature systems
  const nextRainAtRef = useRef(0);
  const nextBanditAtRef = useRef(0);
  const nextDisasterAtRef = useRef(0); // storm/flood/lightning — see triggerDisaster()
  const ruinsChargesRef = useRef(RUINS_MAX_CHARGES);
  const nextExcavationAtRef = useRef(0);
  const nextStoryAtRef = useRef(0);
  const nextLegendAtRef = useRef(0);
  const lastDayPhaseLabelRef = useRef("");
  const lastTierIndexRef = useRef(0);
  const elapsedRef = useRef(0);
  const townCenterRef = useRef({ x: 260, y: 200 });
  const selectedTypeRef = useRef(null);
  const finishedRef = useRef(false);
  const difficultyRef = useRef("contested");

  const simIntervalRef = useRef(null);
  const musicRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    const isTouchPrimary = window.matchMedia("(pointer: coarse)").matches;
    const isSmall = window.innerWidth < 1024;
    setDeviceOk(!isTouchPrimary && !isSmall);
  }, []);

  useEffect(() => {
    fetch("/api/difficulty-scores?game=kingdomsofash")
      .then((r) => r.json())
      .then((d) => setDifficultyBests(d.bests || {}))
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.version === 1) setSavedGameInfo(parsed);
      }
    } catch {
      // a corrupt or unreadable save just means no resume option — never break the menu over it
    }
  }, []);

  useEffect(() => {
    selectedTypeRef.current = selectedType;
  }, [selectedType]);

  function spawnParticles(x, y, color, count = 6) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.3 + Math.random() * 0.8;
      particlesRef.current.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 0.3, life: 1, color });
    }
  }
  function spawnFloatText(x, y, text, color) {
    floatTextRef.current.push({ x, y, text, color, life: 1 });
  }

  // The shared "this structure just took real damage" path — used by
  // Saboteurs, storms, floods, and lightning alike, so structural
  // loss behaves identically no matter what caused it. Buildings
  // above level 1 lose a level first (the same buffer an upgrade
  // investment already bought against a Saboteur); a building already
  // at level 1 is destroyed outright and removed from the kingdom —
  // this is the actual mechanic that makes "you can lose a structure"
  // real rather than a building only ever being able to degrade down
  // to an un-loseable floor.
  function strikeBuilding(building, customMessage) {
    const def = BUILDING_TYPES[building.type];
    if ((building.level || 1) > 1) {
      building.level -= 1;
      spawnFloatText(building.x, building.y - 20, customMessage || `${def.name} damaged! -1 level`, "#ff3ea5");
    } else {
      buildingsRef.current = buildingsRef.current.filter((b) => b !== building);
      spawnFloatText(building.x, building.y - 20, customMessage || `${def.name} destroyed!`, "#ff3ea5");
    }
    spawnParticles(building.x, building.y, "#ff3ea5", 14);
  }

  // Storm/flood/lightning — real structural threats independent of
  // bandits, escalating the same way raids do as the session
  // progresses. The town center is never a target; the whole point
  // is putting what the player has actually built at risk, not
  // threatening the always-safe core objective.
  function triggerDisaster(sessionProgress) {
    const targets = buildingsRef.current.filter((b) => b.type !== "townCenter");
    if (targets.length === 0) return; // nothing built yet to damage — skip silently, the timer already re-armed itself
    const kinds = ["storm", "flood", "lightning"];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];

    if (kind === "lightning") {
      // A single, high-impact targeted strike — deliberately picks
      // the most-upgraded structure on the map, so the building the
      // player invested most in is the one genuinely at risk, not a
      // random pick that might land on something trivial.
      const target = targets.reduce((best, b) => ((b.level || 1) > (best.level || 1) ? b : best), targets[0]);
      setNotice(`⚡ Lightning strikes your ${BUILDING_TYPES[target.type].name}!`);
      strikeBuilding(target, null);
    } else if (kind === "flood") {
      // Only buildings genuinely near the water's edge are at risk —
      // a real strategic consequence for building close to the
      // shore, not a flat map-wide hazard like storm below.
      const nearWater = targets.filter((b) => b.x > WATER.x - 220);
      const pool = nearWater.length > 0 ? nearWater : targets;
      const hitCount = Math.min(pool.length, 2 + Math.floor(sessionProgress * 3));
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      setNotice("🌊 A flood surges in from the water!");
      for (let i = 0; i < hitCount; i++) strikeBuilding(shuffled[i], null);
    } else {
      // Storm — map-wide, hits several buildings regardless of
      // position, the broadest of the three disaster types.
      const hitCount = Math.min(targets.length, 2 + Math.floor(sessionProgress * 4));
      const shuffled = [...targets].sort(() => Math.random() - 0.5);
      setNotice("⛈️ A storm tears through the kingdom!");
      for (let i = 0; i < hitCount; i++) strikeBuilding(shuffled[i], null);
    }
    setTimeout(() => setNotice(""), 2600);
    sfx.lose();
  }

  // The kingdom's XP gain — from real actions across the whole
  // session (gathering, building, tier-ups, repelling raids), not a
  // flat timer. Detects both an ordinary level-up (a small fanfare)
  // and reaching one of the five milestone levels, which pauses for
  // a real choice rather than an automatic bonus.
  function addKingdomXp(amount) {
    kingdomXpRef.current += amount;
    const { level } = kingdomLevelFromXp(kingdomXpRef.current);
    if (level > kingdomLevelRef.current) {
      kingdomLevelRef.current = level;
      spawnParticles(townCenterRef.current.x, townCenterRef.current.y, "#3ee6e0", 10);
      if (KINGDOM_MILESTONE_LEVELS.includes(level) && level > lastMilestoneShownRef.current) {
        lastMilestoneShownRef.current = level;
        setPendingMilestone({ level, choices: KINGDOM_MILESTONE_CHOICES[level] });
      } else {
        sfx.levelUp();
      }
    }
  }

  function kingdomGatherMult() {
    // +3-5% per 5 levels reached, plus the milestone "gather" choice
    // bonuses actually picked (not just offered) — two independent,
    // stacking sources, both real.
    const autoBonus = Math.floor(kingdomLevelRef.current / 5) * KINGDOM_LEVEL_GATHER_BONUS;
    let choiceBonus = 0;
    for (const [lvl, choiceId] of Object.entries(kingdomMilestoneChoicesRef.current)) {
      if (choiceId !== "gather") continue;
      const pct = Number(lvl) >= 30 ? (Number(lvl) >= 50 ? 0.15 : 0.1) : 0.08;
      choiceBonus += pct;
    }
    return 1 + autoBonus + choiceBonus;
  }

  function kingdomDefenseMult() {
    let choiceBonus = 0;
    for (const [lvl, choiceId] of Object.entries(kingdomMilestoneChoicesRef.current)) {
      if (choiceId !== "defense") continue;
      const pct = Number(lvl) >= 30 ? (Number(lvl) >= 50 ? 0.25 : 0.2) : 0.15;
      choiceBonus += pct;
    }
    return 1 + choiceBonus;
  }

  function resolveMilestone(choiceId) {
    if (!pendingMilestone) return;
    kingdomMilestoneChoicesRef.current = { ...kingdomMilestoneChoicesRef.current, [pendingMilestone.level]: choiceId };
    setStoryFlash(`⚔️ Kingdom Level ${pendingMilestone.level} — chose ${choiceId === "gather" ? "greater harvests" : "hardened defenses"}.`);
    setTimeout(() => setStoryFlash(""), 6000);
    spawnParticles(townCenterRef.current.x, townCenterRef.current.y, "#3ee6e0", 18);
    sfx.levelUp();
    setPendingMilestone(null);
  }

  function acceptCaravanTrade() {
    if (!caravanOffer) return;
    const res = resourcesRef.current;
    if ((res[caravanOffer.give.resource] || 0) < caravanOffer.give.amount) {
      setNotice("Not enough resources for this trade");
      setTimeout(() => setNotice(""), 1500);
      return;
    }
    res[caravanOffer.give.resource] -= caravanOffer.give.amount;
    res[caravanOffer.get.resource] = (res[caravanOffer.get.resource] || 0) + caravanOffer.get.amount;
    spawnFloatText(townCenterRef.current.x, townCenterRef.current.y - 20, `+${caravanOffer.get.amount} gold traded!`, "#ffe14d");
    spawnParticles(townCenterRef.current.x, townCenterRef.current.y, "#b45cff", 14);
    sfx.correct();
    tradesMadeRef.current += 1;
    addKingdomXp(15);
    caravanActiveRef.current = false;
    setCaravanOffer(null);
  }

  function spawnVillager(homeX, homeY) {
    villagersRef.current.push({
      id: Math.random(),
      name: randomVillagerName(),
      age: 16 + Math.floor(Math.random() * 50),
      x: homeX + (Math.random() - 0.5) * 10,
      y: homeY + (Math.random() - 0.5) * 10,
      homeX, homeY,
      state: "idle",
      job: null,
      carrying: 0,
      workTimer: 0,
      bob: Math.random() * Math.PI * 2,
    });
  }

  function saveGame() {
    try {
      const payload = {
        version: 1,
        difficulty: difficultyRef.current,
        elapsed: elapsedRef.current,
        resources: resourcesRef.current,
        // b.level was missing here before — building upgrades (a
        // whole separate system) were being silently discarded on
        // every resume, reset back to level 1 with no indication
        // anything had gone wrong. Found while wiring in kingdom XP
        // persistence and fixed at the same time.
        buildings: buildingsRef.current.map((b) => ({ id: b.id, type: b.type, x: b.x, y: b.y, w: b.w, h: b.h, level: b.level || 1 })),
        villagers: villagersRef.current.map((v) => ({ name: v.name, age: v.age, homeX: v.homeX, homeY: v.homeY })),
        kingdomXp: kingdomXpRef.current,
        kingdomMilestoneChoices: kingdomMilestoneChoicesRef.current,
        tradesMade: tradesMadeRef.current,
        banditsRepelled: banditsRepelledRef.current,
        totalGathered: totalGatheredRef.current,
        warlordSpawned: warlordSpawnedRef.current,
        ruinsCharges: ruinsChargesRef.current,
        savedAt: Date.now(),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
    } catch {
      // localStorage can fail (private browsing, storage full, etc.)
      // — losing autosave shouldn't interrupt an otherwise-fine session
    }
  }

  function loadSavedGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed?.version !== 1) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function clearSavedGame() {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      // fine to ignore — worst case a stale save lingers and gets
      // overwritten by the next autosave anyway
    }
  }

  // Restores buildings and villagers from a save, then rebuilds the
  // town center and job-slot bookkeeping the same way resetKingdom
  // does for a fresh start. Bandits, particles, and rain are
  // deliberately NOT restored — they're transient moment-to-moment
  // state, and resuming into a brief calm beat is the right call,
  // not jarring.
  function resumeFromSave(save) {
    resourcesRef.current = { ...save.resources };
    buildingsRef.current = save.buildings.map((b) => ({ ...b, jobsFilled: 0, cooldown: 0, level: b.level || 1 }));
    kingdomXpRef.current = save.kingdomXp || 0;
    kingdomLevelRef.current = kingdomLevelFromXp(kingdomXpRef.current).level;
    kingdomMilestoneChoicesRef.current = save.kingdomMilestoneChoices || {};
    lastMilestoneShownRef.current = Math.max(0, ...Object.keys(kingdomMilestoneChoicesRef.current).map(Number), 0);
    if (!buildingsRef.current.some((b) => b.id === "tc")) {
      buildingsRef.current.unshift({ id: "tc", type: "townCenter", x: townCenterRef.current.x, y: townCenterRef.current.y, w: 42, h: 42 });
    }
    villagersRef.current = save.villagers.map((v) => ({
      id: Math.random(),
      name: v.name,
      age: v.age,
      x: v.homeX,
      y: v.homeY,
      homeX: v.homeX,
      homeY: v.homeY,
      state: "idle",
      job: null,
      carrying: 0,
      workTimer: 0,
      bob: Math.random() * Math.PI * 2,
    }));
    banditsRef.current = [];
    projectilesRef.current = [];
    particlesRef.current = [];
    floatTextRef.current = [];
    rainDropsRef.current = Array.from({ length: 70 }, () => ({ x: Math.random() * MAP_W, y: Math.random() * MAP_H }));
    rainingRef.current = false;
    nextRainAtRef.current = Date.now() + 20000 + Math.random() * 20000;
    nextBanditAtRef.current = Date.now() + DIFFICULTIES[difficultyRef.current].banditIntervalMs;
    // First disaster is deliberately far out (8-12 minutes) — this is
    // an escalating late-game threat to established kingdoms, not
    // something that should punish a settlement still building its
    // first few structures.
    nextDisasterAtRef.current = Date.now() + 480000 + Math.random() * 240000;
    nextStoryAtRef.current = Date.now() + 60000 + Math.random() * 60000;
    nextLegendAtRef.current = Date.now() + 600000 + Math.random() * 900000;
    lastDayPhaseLabelRef.current = "";
    lastTierIndexRef.current = kingdomTier(save.villagers.length).index;
    elapsedRef.current = save.elapsed;
    finishedRef.current = false;
    setSelectedType(null);
    setPendingMilestone(null); // same defensive reset as resetKingdom — a leftover modal from a prior mount must never survive into a resumed session
    tradesMadeRef.current = save.tradesMade || 0;
    banditsRepelledRef.current = save.banditsRepelled || 0;
    totalGatheredRef.current = save.totalGathered || 0;
    warlordSpawnedRef.current = save.warlordSpawned || false;
    // Falls back to full charges for saves made before this feature
    // existed, rather than leaving it undefined.
    ruinsChargesRef.current = save.ruinsCharges != null ? save.ruinsCharges : RUINS_MAX_CHARGES;
    nextExcavationAtRef.current = 0;
    nextCaravanAtRef.current = Date.now() + 90000 + Math.random() * 60000;
    caravanActiveRef.current = false;
    caravanExpiresAtRef.current = 0;
    setCaravanOffer(null);
  }

  function resetKingdom() {
    resourcesRef.current = { wood: 60, stone: 20, food: 30, gold: 10 };
    buildingsRef.current = [{ id: "tc", type: "townCenter", x: townCenterRef.current.x, y: townCenterRef.current.y, w: 42, h: 42 }];
    villagersRef.current = [];
    for (let i = 0; i < 3; i++) spawnVillager(townCenterRef.current.x, townCenterRef.current.y);
    banditsRef.current = [];
    projectilesRef.current = [];
    particlesRef.current = [];
    floatTextRef.current = [];
    rainDropsRef.current = Array.from({ length: 70 }, () => ({ x: Math.random() * MAP_W, y: Math.random() * MAP_H }));
    rainingRef.current = false;
    nextRainAtRef.current = Date.now() + 20000 + Math.random() * 20000;
    nextBanditAtRef.current = Date.now() + DIFFICULTIES[difficultyRef.current].banditIntervalMs;
    nextDisasterAtRef.current = Date.now() + 480000 + Math.random() * 240000;
    // Stories are frequent flavor beats (roughly every 3-5 minutes);
    // legends are the rare, memorable kind, deliberately much rarer
    // across a 60-minute session, not a per-tick coin flip that would
    // trivialize how special they're meant to feel.
    nextStoryAtRef.current = Date.now() + 60000 + Math.random() * 60000;
    nextLegendAtRef.current = Date.now() + 600000 + Math.random() * 900000;
    lastDayPhaseLabelRef.current = "";
    lastTierIndexRef.current = 0;
    kingdomXpRef.current = 0;
    kingdomLevelRef.current = 1;
    kingdomMilestoneChoicesRef.current = {};
    lastMilestoneShownRef.current = 0;
    setPendingMilestone(null); // a stray milestone modal from a previous session must never carry into a fresh kingdom
    nextCaravanAtRef.current = Date.now() + 90000 + Math.random() * 60000;
    caravanActiveRef.current = false;
    caravanExpiresAtRef.current = 0;
    tradesMadeRef.current = 0;
    banditsRepelledRef.current = 0;
    totalGatheredRef.current = 0;
    warlordSpawnedRef.current = false;
    ruinsChargesRef.current = RUINS_MAX_CHARGES;
    nextExcavationAtRef.current = 0;
    setCaravanOffer(null);
    // Session elapsed time still starts at 0 (it drives the 60-minute
    // timer and end-of-session check) — the day-night cycle's visual
    // starting point is offset separately below, in render(), so a
    // fresh kingdom opens in daylight without silently shortening the
    // session.
    elapsedRef.current = 0;
    finishedRef.current = false;
    setSelectedType(null);
  }

  function nearestForest(x, y) {
    let best = null, bestD = Infinity;
    for (const f of FORESTS) {
      const d = dist(x, y, f.x, f.y);
      if (d < bestD) { bestD = d; best = f; }
    }
    return best;
  }

  function nearestOutcropping(x, y) {
    let best = null, bestD = Infinity;
    for (const o of STONE_OUTCROPPINGS) {
      const d = dist(x, y, o.x, o.y);
      if (d < bestD) { bestD = d; best = o; }
    }
    return best;
  }

  // Used by raid targeting — pillagers hunt the nearest resource
  // producer, saboteurs hunt the nearest watch tower.
  function nearestBuildingWhere(x, y, predicate) {
    let best = null, bestD = Infinity;
    for (const b of buildingsRef.current) {
      const def = BUILDING_TYPES[b.type];
      if (!def || !predicate(def)) continue;
      const d = dist(x, y, b.x, b.y);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  function canPlace(type, x, y) {
    const def = BUILDING_TYPES[type];
    if (x - def.w / 2 < 10 || x + def.w / 2 > WATER.x - 10 || y - def.h / 2 < 10 || y + def.h / 2 > MAP_H - 10) return false;
    if (dist(x, y, RUINS.x, RUINS.y) < RUINS.r + Math.max(def.w, def.h) / 2) return false;
    for (const ev of EMBER_VENTS) {
      if (dist(x, y, ev.x, ev.y) < ev.r + Math.max(def.w, def.h) / 2) return false;
    }
    for (const b of buildingsRef.current) {
      const d = dist(x, y, b.x, b.y);
      if (d < (def.w + (BUILDING_TYPES[b.type]?.w || 42)) / 2 + 6) return false;
    }
    if (def.needsForest) {
      const f = nearestForest(x, y);
      if (!f || dist(x, y, f.x, f.y) > f.r + 50) return false;
    }
    if (def.needsStone) {
      const o = nearestOutcropping(x, y);
      if (!o || dist(x, y, o.x, o.y) > o.r + 50) return false;
    }
    if (def.needsWater && x + def.w / 2 < WATER.x - 60) return false;
    return true;
  }

  function handleCanvasClick(e) {
    if (phase !== "playing") return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = MAP_W / rect.width;
    const scaleY = MAP_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const type = selectedTypeRef.current;
    if (!type) {
      // Ruins take priority over building-upgrade — clicking inside
      // the ruins radius always excavates, never tries to upgrade a
      // building that (per canPlace) can never actually be there.
      if (tryExcavateRuins(x, y)) return;
      // Nothing selected to place — clicking an existing building
      // attempts to upgrade it instead. The actual answer to "the
      // map is full, nothing left to do": once space runs out,
      // upgrading what's already built is a real, ongoing decision
      // that needs no more room.
      tryUpgradeBuildingAt(x, y);
      return;
    }
    const def = BUILDING_TYPES[type];
    const res = resourcesRef.current;
    const affordable = Object.entries(def.cost).every(([k, v]) => res[k] >= v);
    if (!affordable) {
      setNotice("Not enough resources");
      setTimeout(() => setNotice(""), 1200);
      return;
    }
    if (!canPlace(type, x, y)) {
      setNotice(def.needsForest ? "Lumber camps must be near a forest" : def.needsStone ? "Quarries must be near a stone outcropping" : def.needsWater ? "Fishing docks must be near the water" : "Can't build there");
      setTimeout(() => setNotice(""), 1400);
      return;
    }
    for (const [k, v] of Object.entries(def.cost)) res[k] -= v;
    buildingsRef.current.push({ id: Math.random(), type, x, y, w: def.w, h: def.h, jobsFilled: 0, cooldown: 0, level: 1 });
    addKingdomXp(6);
    spawnParticles(x, y, "#e8d9c0", 10);
    sfx.correct();
    haptics.tap();
    setSelectedType(null);
  }

  function tryUpgradeBuildingAt(x, y) {
    const building = buildingsRef.current.find((b) => x > b.x - b.w / 2 && x < b.x + b.w / 2 && y > b.y - b.h / 2 && y < b.y + b.h / 2);
    if (!building) return;
    const def = BUILDING_TYPES[building.type];
    if (!def.produces && !def.defense) {
      setNotice(`${def.name} can't be upgraded`);
      setTimeout(() => setNotice(""), 1200);
      return;
    }
    const level = building.level || 1;
    if (level >= MAX_BUILDING_LEVEL) {
      setNotice(`${def.name} is already at max level`);
      setTimeout(() => setNotice(""), 1200);
      return;
    }
    const nextLevel = level + 1;
    const costMult = UPGRADE_COST_MULT[nextLevel - 1];
    const upgradeCost = {};
    for (const [k, v] of Object.entries(def.cost)) upgradeCost[k] = Math.ceil(v * costMult);
    const res = resourcesRef.current;
    const affordable = Object.entries(upgradeCost).every(([k, v]) => (res[k] || 0) >= v);
    if (!affordable) {
      setNotice(`Need ${Object.entries(upgradeCost).map(([k, v]) => `${v} ${k}`).join(", ")} to upgrade`);
      setTimeout(() => setNotice(""), 1800);
      return;
    }
    for (const [k, v] of Object.entries(upgradeCost)) res[k] -= v;
    building.level = nextLevel;
    spawnParticles(building.x, building.y, "#ffe14d", 16);
    sfx.levelUp();
    haptics.tap();
    setNotice(`${def.name} upgraded to level ${nextLevel}!`);
    setTimeout(() => setNotice(""), 1600);
  }

  // The new task: a genuine risk/reward decision distinct from the
  // gather/build/defend loop everything else in the game is. Costs
  // real gold to attempt, has a real chance of finding nothing at
  // all, and the site itself is a limited, exhaustible resource (3
  // charges) rather than an infinite gold-click exploit — a cooldown
  // between attempts on top of that stops even a successful dig from
  // being spammed.
  function tryExcavateRuins(x, y) {
    if (dist(x, y, RUINS.x, RUINS.y) > RUINS.r) return false;
    const now = Date.now();
    if (ruinsChargesRef.current <= 0) {
      setNotice("The ruins have been fully excavated");
      setTimeout(() => setNotice(""), 1400);
      return true;
    }
    if (now < nextExcavationAtRef.current) {
      const secsLeft = Math.ceil((nextExcavationAtRef.current - now) / 1000);
      setNotice(`Workers still recovering — ${secsLeft}s`);
      setTimeout(() => setNotice(""), 1200);
      return true;
    }
    const res = resourcesRef.current;
    const affordable = Object.entries(RUINS_DIG_COST).every(([k, v]) => (res[k] || 0) >= v);
    if (!affordable) {
      setNotice(`Need ${Object.entries(RUINS_DIG_COST).map(([k, v]) => `${v} ${k}`).join(", ")} to excavate`);
      setTimeout(() => setNotice(""), 1600);
      return true;
    }
    for (const [k, v] of Object.entries(RUINS_DIG_COST)) res[k] -= v;
    ruinsChargesRef.current -= 1;
    nextExcavationAtRef.current = now + RUINS_COOLDOWN_MS;

    const roll = Math.random();
    if (roll < 0.15) {
      setNotice("The dig turned up nothing but rubble");
      spawnFloatText(RUINS.x, RUINS.y - 20, "Nothing found...", "#9a9a9a");
    } else if (roll < 0.65) {
      const pick = ["wood", "stone", "food", "gold"][Math.floor(Math.random() * 4)];
      const amount = 20 + Math.floor(Math.random() * 21);
      res[pick] = (res[pick] || 0) + amount;
      setNotice(`Excavation uncovered ${amount} ${pick}!`);
      spawnFloatText(RUINS.x, RUINS.y - 20, `+${amount} ${pick}`, RESOURCE_COLORS[pick]);
    } else if (roll < 0.9) {
      const pick = ["wood", "stone", "food"][Math.floor(Math.random() * 3)];
      const amount = 40 + Math.floor(Math.random() * 31);
      const goldAmount = 15 + Math.floor(Math.random() * 16);
      res[pick] = (res[pick] || 0) + amount;
      res.gold = (res.gold || 0) + goldAmount;
      setNotice(`A rich cache! +${amount} ${pick}, +${goldAmount} gold`);
      spawnFloatText(RUINS.x, RUINS.y - 20, `+${amount} ${pick}, +${goldAmount} gold`, "#ffe14d");
    } else {
      const goldAmount = 60 + Math.floor(Math.random() * 41);
      res.gold = (res.gold || 0) + goldAmount;
      addKingdomXp(15);
      setNotice(`Buried treasure! +${goldAmount} gold`);
      spawnFloatText(RUINS.x, RUINS.y - 20, `+${goldAmount} gold!`, "#ffe14d");
    }
    spawnParticles(RUINS.x, RUINS.y, "#b45cff", 14);
    sfx.correct();
    haptics.tap();
    setTimeout(() => setNotice(""), 2000);
    return true;
  }

  function handleCanvasMouseMove(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = MAP_W / rect.width;
    const scaleY = MAP_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const near = villagersRef.current.find((v) => dist(x, y, v.x, v.y) < 10);
    if (!near) {
      setHoveredVillager(null);
      return;
    }
    const job = near.job ? buildingsRef.current.find((b) => b.id === near.job) : null;
    const roleLabel = job ? BUILDING_TYPES[job.type]?.name || "Worker" : "Unemployed";
    setHoveredVillager({ name: near.name, age: near.age, role: roleLabel, x: near.x, y: near.y });
  }

  function assignJobs() {
    for (const b of buildingsRef.current) {
      const def = BUILDING_TYPES[b.type];
      if (!def?.jobSlots) continue;
      if ((b.jobsFilled || 0) >= def.jobSlots) continue;
      const free = villagersRef.current.find((v) => v.state === "idle" && !v.job);
      if (free) {
        free.job = b.id;
        b.jobsFilled = (b.jobsFilled || 0) + 1;
      }
    }
  }

  function villagerTick(v) {
    v.bob += 0.15;
    const job = v.job ? buildingsRef.current.find((b) => b.id === v.job) : null;
    const def = job ? BUILDING_TYPES[job.type] : null;

    if (!job) {
      if (v.state !== "idle") v.state = "idle";
      const tc = townCenterRef.current;
      const d = dist(v.x, v.y, tc.x, tc.y);
      if (d > 40) {
        v.x += ((tc.x - v.x) / d) * 0.5;
        v.y += ((tc.y - v.y) / d) * 0.5;
      }
      return;
    }

    if (v.state === "idle") v.state = "toWork";

    if (v.state === "toWork") {
      let targetX = job.x, targetY = job.y;
      if (def.needsForest) {
        const f = nearestForest(job.x, job.y);
        targetX = f.x + (Math.random() - 0.5) * f.r * 0.6;
        targetY = f.y + (Math.random() - 0.5) * f.r * 0.6;
        v.forestSpot = { x: targetX, y: targetY };
      }
      const d = dist(v.x, v.y, targetX, targetY);
      if (d < 4) {
        v.state = "working";
        v.workTimer = 0;
      } else {
        v.x += ((targetX - v.x) / d) * 0.9;
        v.y += ((targetY - v.y) / d) * 0.9;
      }
    } else if (v.state === "working") {
      v.workTimer += TICK_MS;
      if (v.workTimer > 1600) {
        v.carrying = 1;
        v.state = "toDeposit";
      }
    } else if (v.state === "toDeposit") {
      const tc = townCenterRef.current;
      const d = dist(v.x, v.y, tc.x, tc.y);
      if (d < 14) {
        const levelMult = UPGRADE_OUTPUT_MULT[(job.level || 1) - 1];
        const gathered = Math.round(def.rate * 20 * DIFFICULTIES[difficultyRef.current].gatherMult * levelMult * kingdomGatherMult());
        resourcesRef.current[def.produces] = (resourcesRef.current[def.produces] || 0) + gathered;
        spawnFloatText(tc.x, tc.y - 20, `+${gathered} ${def.produces}`, "#ffe14d");
        addKingdomXp(2);
        totalGatheredRef.current += gathered;
        v.carrying = 0;
        v.state = "toWork";
      } else {
        v.x += ((tc.x - v.x) / d) * 0.9;
        v.y += ((tc.y - v.y) / d) * 0.9;
      }
    }
  }

  function tryGrowPopulation() {
    const res = resourcesRef.current;
    const houses = buildingsRef.current.filter((b) => b.type === "house");
    const capacity = 3 + houses.reduce((s) => s + BUILDING_TYPES.house.capacity, 0);
    if (villagersRef.current.length < capacity && res.food > villagersRef.current.length * 4) {
      res.food -= 8;
      const tc = townCenterRef.current;
      spawnVillager(tc.x, tc.y);
      spawnFloatText(tc.x, tc.y - 30, "New villager!", "#3ee6e0");
      sfx.levelUp();
    }
  }

  function endSession() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(simIntervalRef.current);
    if (musicRef.current) musicRef.current.stop();
    clearSavedGame();
    setOutcome(true);
    setPhase("over");
    sfx.newBest();

    // End-of-session title — the honest, scoped equivalent of
    // "multiple victory conditions": there's no competing AI kingdom
    // to be declared victorious over, so instead of faking a win
    // state, this is a real reflection of how THIS kingdom actually
    // played, computed from genuine session stats, not a random or
    // decorative label. Each candidate is normalized against a
    // reasonable threshold for "genuinely focused on this" so wildly
    // different scales (a handful of trades vs. thousands of
    // resources) compare fairly; whichever the player leaned into
    // hardest wins the title.
    const titleCandidates = [
      { id: "builder", name: "Master Builder", icon: "🏗️", score: buildingsRef.current.length / 15, detail: `${buildingsRef.current.length} buildings raised` },
      { id: "defender", name: "Kingdom Defender", icon: "🛡️", score: banditsRepelledRef.current / 15, detail: `${banditsRepelledRef.current} raiders repelled` },
      { id: "trader", name: "Trade Baron", icon: "🐫", score: tradesMadeRef.current / 5, detail: `${tradesMadeRef.current} caravan trades struck` },
      { id: "gatherer", name: "Master Gatherer", icon: "🌾", score: totalGatheredRef.current / 3000, detail: `${Math.round(totalGatheredRef.current).toLocaleString()} resources harvested` },
    ];
    const topTitle = titleCandidates.reduce((best, t) => (t.score > best.score ? t : best), titleCandidates[0]);
    setSessionTitle(topTitle.score >= 0.5 ? topTitle : { id: "ruler", name: "Rising Ruler", icon: "👑", score: 0, detail: "A kingdom still finding its path" });

    const res = resourcesRef.current;
    const score = Math.round(
      (villagersRef.current.length * 30 + buildingsRef.current.length * 25 + Math.round(res.wood + res.stone + res.food + res.gold * 2)) *
        DIFFICULTIES[difficultyRef.current].scoreMult
    );
    fetch("/api/difficulty-scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game: "kingdomsofash", difficulty: difficultyRef.current, score }),
    }).catch(() => {});
    // Extended from 1.5s — a real title reveal needs long enough to
    // actually be read, not just flash past on the way back out.
    setTimeout(() => onFinish(Math.max(0, score)), 4500);
  }

  function begin(resumeSave) {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    difficultyRef.current = resumeSave ? resumeSave.difficulty : difficulty;
    if (resumeSave) resumeFromSave(resumeSave);
    else resetKingdom();
    setOutcome(null);
    setPhase("playing");
    setSessionTitle(null); // a stale title from a previous playthrough must never show before this session's own endSession() runs

    // Started here specifically because begin() only ever runs
    // inside a real click handler — browsers only allow resuming a
    // suspended AudioContext synchronously within a genuine user
    // gesture, not from a timer callback deeper in the tick loop.
    if (musicRef.current) musicRef.current.stop();
    musicRef.current = createKingdomMusic();
    musicRef.current.resumeIfNeeded();

    let lastAutosaveAt = Date.now();

    simIntervalRef.current = setInterval(() => {
      elapsedRef.current += TICK_MS / 1000;
      const now = Date.now();

      if (now - lastAutosaveAt > AUTOSAVE_INTERVAL_MS) {
        lastAutosaveAt = now;
        saveGame();
      }

      assignJobs();
      for (const v of villagersRef.current) villagerTick(v);

      // A real safety net, not a cosmetic tweak: EVERY building in
      // this game costs wood, including the lumber camp that's the
      // only other source of it — so a player who spends all their
      // starting wood on buildings that don't produce anything (two
      // houses costs exactly the full starting 60 wood) hits a
      // genuine, permanent dead end with no way to ever build
      // anything again, since they can't even afford the one
      // building that would let them recover. This passive trickle
      // (villagers scavenging a little wood by hand, no dedicated
      // camp needed) is deliberately much slower than a real lumber
      // camp — it won't meaningfully speed up a normal economy, but
      // it guarantees recovery is always possible from any mistake.
      //
      // Both this and the population-growth check below use a real
      // "next trigger time" ref rather than elapsed-time modulo — the
      // modulo version (elapsedRef.current % N === 0) was a genuine,
      // separate bug: at a 60ms tick rate, elapsedRef.current sits
      // inside the SAME matching integer second for roughly 16
      // consecutive ticks, so that check fired ~16 times in a burst
      // every interval instead of once, which is likely why
      // population growth (and now this trickle, had it used the
      // same pattern) could look erratic rather than gradual.
      if (elapsedRef.current >= nextWoodTrickleAtRef.current) {
        nextWoodTrickleAtRef.current = elapsedRef.current + 10;
        resourcesRef.current.wood = (resourcesRef.current.wood || 0) + 2;
      }

      if (elapsedRef.current >= nextPopGrowthAtRef.current) {
        nextPopGrowthAtRef.current = elapsedRef.current + 6;
        tryGrowPopulation();
      }

      // Ambient particle life — deliberately low spawn rates tuned
      // to keep a handful of fireflies/leaves visible at once, not
      // flood the screen. Fireflies only appear once night has
      // genuinely fallen; leaves pick up as the season drifts toward
      // autumn, tying directly into the existing season progression.
      const nightForSpawning = dayNightAt(getCyclePos(elapsedRef.current)).brightness < 0.55;
      // Combat mood takes priority over day/night whenever bandits
      // are actually on the field — the whole point of the more
      // dramatic combat track is that it responds to real danger,
      // not just time of day.
      if (musicRef.current) musicRef.current.setMood(banditsRef.current.length > 0 ? "combat" : nightForSpawning ? "night" : "day");
      if (nightForSpawning && Math.random() < 0.02) {
        particlesRef.current.push({
          x: Math.random() * WATER.x,
          y: Math.random() * MAP_H,
          vx: 0, vy: 0, life: 1,
          color: "#c6ff5e",
          kind: "firefly",
        });
      }
      const seasonNow = Math.min(1, elapsedRef.current / SESSION_SECONDS);
      if (seasonNow > 0.4 && Math.random() < 0.012 * seasonNow) {
        const f = FORESTS[Math.floor(Math.random() * FORESTS.length)];
        particlesRef.current.push({
          x: f.x + (Math.random() - 0.5) * f.r * 1.5,
          y: f.y - f.r,
          vx: (Math.random() - 0.5) * 0.3,
          vy: 0.05,
          life: 1,
          color: Math.random() < 0.5 ? "#d98c2e" : "#b5471f",
          kind: "leaf",
        });
      }

      if (!rainingRef.current && now > nextRainAtRef.current) {
        rainingRef.current = true;
        setTimeout(() => { rainingRef.current = false; nextRainAtRef.current = Date.now() + 25000 + Math.random() * 25000; }, 9000);
      }

      if (now > nextStoryAtRef.current) {
        nextStoryAtRef.current = now + 180000 + Math.random() * 120000;
        const story = KINGDOM_STORIES[Math.floor(Math.random() * KINGDOM_STORIES.length)];
        setStoryFlash(story);
        setTimeout(() => setStoryFlash(""), 7000);
      }

      if (now > nextLegendAtRef.current) {
        nextLegendAtRef.current = now + 600000 + Math.random() * 900000;
        const legend = LEGENDARY_EVENTS[Math.floor(Math.random() * LEGENDARY_EVENTS.length)];
        setStoryFlash(legend);
        setTimeout(() => setStoryFlash(""), 9000);
        spawnParticles(MAP_W / 2, MAP_H / 3, "#ffe14d", 30);
        sfx.newBest();
      }

      // Announces the day-night phase the moment it changes to a
      // named one (sunrise, golden hour, noon, sunset, blue hour) —
      // the actual "breathtaking transitions" the brief asked for,
      // not just a silent color shift no one notices.
      const currentPhaseLabel = dayNightAt(getCyclePos(elapsedRef.current)).label;
      if (currentPhaseLabel && currentPhaseLabel !== lastDayPhaseLabelRef.current) {
        lastDayPhaseLabelRef.current = currentPhaseLabel;
        setNotice(currentPhaseLabel);
        setTimeout(() => setNotice(""), 3500);
      } else if (!currentPhaseLabel) {
        lastDayPhaseLabelRef.current = "";
      }

      const currentTier = kingdomTier(villagersRef.current.length);
      if (currentTier.index > lastTierIndexRef.current) {
        lastTierIndexRef.current = currentTier.index;
        setStoryFlash(`🏰 Your kingdom has grown into a ${currentTier.name}.`);
        setTimeout(() => setStoryFlash(""), 6000);
        spawnParticles(townCenterRef.current.x, townCenterRef.current.y, "#ffe14d", 16);
        sfx.levelUp();
        if (musicRef.current) musicRef.current.levelUpFanfare();
        addKingdomXp(40);
      }

      // Trade caravan — the honest, scoped equivalent of "trade
      // economics": there's no rival kingdom to trade WITH here, so
      // instead of pretending at inter-empire commerce, this is a
      // real periodic event offering a genuinely favorable exchange
      // rate for whatever the player has surplus of, at the Market
      // they built. caravanActiveRef (not the caravanOffer state) is
      // what this closure actually reads — see the ref's declaration
      // for why.
      if (!caravanActiveRef.current && now > nextCaravanAtRef.current && buildingsRef.current.some((b) => b.type === "market")) {
        const res = resourcesRef.current;
        const candidates = ["wood", "stone", "food"].filter((r) => (res[r] || 0) >= 40);
        const giveResource = candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : "wood";
        const giveAmount = Math.min(res[giveResource] || 0, 40 + Math.floor(Math.random() * 30));
        const getAmount = Math.round(giveAmount * 0.55);
        const expiresAt = now + 30000;
        caravanActiveRef.current = true;
        caravanExpiresAtRef.current = expiresAt;
        nextCaravanAtRef.current = now + 90000 + Math.random() * 60000;
        setCaravanOffer({ give: { resource: giveResource, amount: giveAmount }, get: { resource: "gold", amount: getAmount }, expiresAt });
        setNotice("A trade caravan has arrived at your market!");
        setTimeout(() => setNotice(""), 2200);
      }
      if (caravanActiveRef.current && now > caravanExpiresAtRef.current) {
        caravanActiveRef.current = false;
        setCaravanOffer(null);
      }

      // The Bandit Warlord — folding "world bosses" and "titans" into
      // one real, honest late-game encounter rather than two separate
      // fantasy creature systems this game has no room to build well.
      // One-time per kingdom (persisted through save/resume, not just
      // this session), triggers once the session is genuinely in its
      // final third, and only between ordinary raids so it doesn't
      // pile onto an existing fight. Far tougher than any regular
      // bandit — a real, telegraphed set-piece, not a reskinned mob.
      const warlordTriggerProgress = Math.min(1, elapsedRef.current / SESSION_SECONDS);
      if (!warlordSpawnedRef.current && warlordTriggerProgress >= 0.65 && banditsRef.current.length === 0) {
        warlordSpawnedRef.current = true;
        const edge = Math.floor(Math.random() * 3);
        const spawn = edge === 0 ? { x: -10, y: Math.random() * MAP_H } : edge === 1 ? { x: Math.random() * WATER.x, y: -10 } : { x: Math.random() * WATER.x, y: MAP_H + 10 };
        banditsRef.current.push({ id: Math.random(), x: spawn.x, y: spawn.y, hp: 420, maxHp: 420, raidType: "rusher", isWarlord: true });
        setStoryFlash("⚔️ THE BANDIT WARLORD MARCHES ON YOUR KINGDOM ⚔️");
        setTimeout(() => setStoryFlash(""), 6000);
        sfx.lose();
      } else if (now > nextBanditAtRef.current && banditsRef.current.length === 0) {
        // Real escalation, not the same single 30hp bandit for the
        // whole hour: wave size and toughness both grow with elapsed
        // session time, so late-game raids are a genuinely different,
        // harder fight than the first one — exactly the kind of
        // "new risk" a 60-minute session needs to keep asking more of
        // the player, and the direct reason tower upgrades exist.
        //
        // Raid variety — the honest, scoped equivalent of "AI
        // personalities": there's no rival AI kingdom here to give a
        // personality to, but each raid wave DOES pick one real
        // tactical identity for the whole wave, unlocking as the
        // session progresses so the kind of threat genuinely changes
        // over the hour, not just its size. Rushers beeline the town
        // center (the original, only behavior); Pillagers target the
        // nearest resource building and steal from what it produces;
        // Saboteurs specifically hunt watch towers and knock a level
        // off one if they reach it — real stakes tied directly to the
        // upgrade investment from last round, not a cosmetic label.
        const sessionProgress = Math.min(1, elapsedRef.current / SESSION_SECONDS);
        const waveSize = 1 + Math.floor(sessionProgress * 4);
        const banditHp = Math.round(30 * (1 + sessionProgress * 1.3));
        const availableRaidTypes = sessionProgress < 0.25 ? ["rusher"] : sessionProgress < 0.55 ? ["rusher", "pillager"] : ["rusher", "pillager", "saboteur"];
        const raidType = availableRaidTypes[Math.floor(Math.random() * availableRaidTypes.length)];
        nextBanditAtRef.current = now + DIFFICULTIES[difficultyRef.current].banditIntervalMs;
        for (let i = 0; i < waveSize; i++) {
          const edge = Math.floor(Math.random() * 3);
          const spawn = edge === 0 ? { x: -10, y: Math.random() * MAP_H } : edge === 1 ? { x: Math.random() * WATER.x, y: -10 } : { x: Math.random() * WATER.x, y: MAP_H + 10 };
          banditsRef.current.push({ id: Math.random(), x: spawn.x, y: spawn.y, hp: banditHp, raidType });
        }
        const raidLabel = raidType === "pillager" ? "Pillagers are targeting your storehouses!" : raidType === "saboteur" ? "Saboteurs are hunting your towers!" : waveSize > 1 ? `A band of ${waveSize} raiders is approaching!` : "Bandits approaching!";
        setNotice(raidLabel);
        setTimeout(() => setNotice(""), 2200);
        sfx.lose();
      } else if (now > nextDisasterAtRef.current) {
        // Disasters scale in frequency the same way bandit raids do —
        // more often as the session goes on, so an established
        // kingdom faces genuinely more structural risk than a young
        // one, not a flat, unchanging hazard rate.
        const disasterSessionProgress = Math.min(1, elapsedRef.current / SESSION_SECONDS);
        nextDisasterAtRef.current = now + Math.max(150000, 420000 - disasterSessionProgress * 240000) + Math.random() * 120000;
        triggerDisaster(disasterSessionProgress);
      }

      const tc = townCenterRef.current;
      banditsRef.current = banditsRef.current.filter((bd) => {
        // Each raid type genuinely aims somewhere different — computed
        // per-bandit each tick rather than once at spawn, so a target
        // building that gets destroyed or a closer one that gets built
        // mid-raid is picked up naturally.
        let targetBuilding = null;
        if (bd.raidType === "pillager") targetBuilding = nearestBuildingWhere(bd.x, bd.y, (def) => !!def.produces);
        else if (bd.raidType === "saboteur") targetBuilding = nearestBuildingWhere(bd.x, bd.y, (def) => !!def.defense);
        const targetX = targetBuilding ? targetBuilding.x : tc.x;
        const targetY = targetBuilding ? targetBuilding.y : tc.y;

        const d = dist(bd.x, bd.y, targetX, targetY);
        if (d < 18) {
          const res = resourcesRef.current;
          if (targetBuilding && bd.raidType === "pillager") {
            const def = BUILDING_TYPES[targetBuilding.type];
            const loss = Math.min(res[def.produces] || 0, Math.round(20 * DIFFICULTIES[difficultyRef.current].banditDamageMult));
            res[def.produces] = (res[def.produces] || 0) - loss;
            spawnFloatText(targetX, targetY - 20, `Pillaged! -${loss} ${def.produces}`, "#ff3ea5");
          } else if (targetBuilding && bd.raidType === "saboteur") {
            // Previously a real gap: a tower already at level 1 took
            // no further damage at all from a Saboteur — "under
            // attack" with zero actual effect, meaning a tower could
            // never truly be lost, only de-leveled down to an
            // un-loseable floor. Now uses the same shared
            // strikeBuilding path storms/floods/lightning use, so a
            // level-1 tower a Saboteur reaches is genuinely destroyed.
            strikeBuilding(targetBuilding, null);
          } else {
            const loss = Math.min(res.gold, Math.round(15 * DIFFICULTIES[difficultyRef.current].banditDamageMult));
            res.gold -= loss;
            spawnFloatText(tc.x, tc.y - 20, `Raided! -${loss} gold`, "#ff3ea5");
          }
          spawnParticles(bd.x, bd.y, "#ff3ea5", 10);
          return false;
        }
        bd.x += ((targetX - bd.x) / d) * 0.55;
        bd.y += ((targetY - bd.y) / d) * 0.55;
        return true;
      });

      for (const b of buildingsRef.current) {
        const def = BUILDING_TYPES[b.type];
        if (!def?.defense) continue;
        const towerMult = UPGRADE_OUTPUT_MULT[(b.level || 1) - 1];
        b.cooldown = (b.cooldown || 0) - TICK_MS;
        if (b.cooldown <= 0) {
          const target = banditsRef.current.find((bd) => dist(bd.x, bd.y, b.x, b.y) < def.range * (1 + (towerMult - 1) * 0.3));
          if (target) {
            b.cooldown = 700;
            projectilesRef.current.push({ x: b.x, y: b.y, targetId: target.id, life: 1 });
            target.hp -= def.damage * towerMult * kingdomDefenseMult();
          }
        }
      }
      banditsRef.current = banditsRef.current.filter((bd) => {
        if (bd.hp <= 0) {
          spawnParticles(bd.x, bd.y, bd.isWarlord ? "#3ee6e0" : "#ffb703", bd.isWarlord ? 30 : 14);
          sfx.hit();
          if (bd.isWarlord) {
            // A real, substantial payoff for what was genuinely the
            // hardest fight of the session — not just a bigger number
            // tacked onto the usual bandit-kill reward.
            const res = resourcesRef.current;
            res.gold = (res.gold || 0) + 150;
            res.wood = (res.wood || 0) + 80;
            res.stone = (res.stone || 0) + 80;
            addKingdomXp(300);
            setStoryFlash("👑 The Bandit Warlord has fallen! Your kingdom claims its hoard.");
            setTimeout(() => setStoryFlash(""), 6000);
            sfx.newBest();
            if (musicRef.current) musicRef.current.levelUpFanfare();
          } else {
            addKingdomXp(10);
          }
          banditsRepelledRef.current += 1;
          return false;
        }
        return true;
      });

      for (const drop of rainDropsRef.current) {
        drop.y += 6;
        drop.x -= 1;
        if (drop.y > MAP_H) { drop.y = -10; drop.x = Math.random() * MAP_W; }
      }

      particlesRef.current = particlesRef.current.filter((pt) => {
        if (pt.kind === "firefly") {
          pt.vx += (Math.random() - 0.5) * 0.06;
          pt.vy += (Math.random() - 0.5) * 0.06;
          pt.vx *= 0.92;
          pt.vy *= 0.92;
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.life -= 0.004;
        } else if (pt.kind === "leaf") {
          pt.vy = Math.min(pt.vy + 0.002, 0.35);
          pt.x += pt.vx + Math.sin(pt.y * 0.06) * 0.3;
          pt.y += pt.vy;
          pt.life -= 0.006;
        } else {
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.life -= 0.03;
        }
        return pt.life > 0 && pt.x > -20 && pt.x < MAP_W + 20 && pt.y < MAP_H + 20;
      });
      floatTextRef.current = floatTextRef.current.filter((ft) => { ft.y -= 0.3; ft.life -= 0.012; return ft.life > 0; });
      projectilesRef.current = projectilesRef.current.filter((p) => { p.life -= 0.3; return p.life > 0; });

      const res = resourcesRef.current;
      setHud({
        wood: Math.floor(res.wood),
        stone: Math.floor(res.stone),
        food: Math.floor(res.food),
        gold: Math.floor(res.gold),
        population: villagersRef.current.length,
        timeLeft: Math.max(0, Math.ceil(SESSION_SECONDS - elapsedRef.current)),
        kingdomLevel: kingdomLevelRef.current,
      });

      if (elapsedRef.current >= SESSION_SECONDS) endSession();
    }, TICK_MS);
  }

  // Handles leaving mid-session via GameRunner's shared back button,
  // which unmounts this component directly — endSession() (used for
  // a natural session end) never runs in that case, so without this
  // the AudioContext from createKingdomMusic would keep running
  // silently in the background, a real audio/resource leak.
  useEffect(() => () => {
    clearInterval(simIntervalRef.current);
    if (musicRef.current) musicRef.current.stop();
  }, []);

  useEffect(() => {
    if (phase !== "playing") return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");

    function render() {
      const t = elapsedRef.current;
      const cyclePos = getCyclePos(t);
      const dayNight = dayNightAt(cyclePos);
      const nightMul = dayNight.brightness;
      const isNightNow = dayNight.brightness < 0.55;
      const seasonT = Math.min(1, t / SESSION_SECONDS);

      const grassSpring = [46, 92, 58];
      const grassAutumn = [126, 92, 40];
      const gr = grassSpring.map((v, i) => Math.round(v + (grassAutumn[i] - v) * seasonT));

      ctx.fillStyle = `rgb(${gr[0] * nightMul}, ${gr[1] * nightMul}, ${gr[2] * nightMul})`;
      ctx.fillRect(0, 0, MAP_W, MAP_H);

      // The real keyframed sky color washes over the whole scene as
      // a soft tint — this is what actually carries sunrise/sunset's
      // warm colors and blue hour's purple, not just a day/night
      // blend between two fixed tones.
      ctx.fillStyle = `rgba(${dayNight.sky[0]}, ${dayNight.sky[1]}, ${dayNight.sky[2]}, 0.16)`;
      ctx.fillRect(0, 0, MAP_W, MAP_H);

      const waterGrad = ctx.createLinearGradient(WATER.x, 0, WATER.x + WATER.w, 0);
      waterGrad.addColorStop(0, `rgba(${30 * nightMul},${70 * nightMul},${110 * nightMul},1)`);
      waterGrad.addColorStop(1, `rgba(${20 * nightMul},${50 * nightMul},${90 * nightMul},1)`);
      ctx.fillStyle = waterGrad;
      ctx.fillRect(WATER.x, WATER.y, WATER.w, WATER.h);
      // Layered wave bands — genuinely curved paths (not straight
      // shimmer lines), each offset in phase and drifting downward at
      // a different speed, giving a real sense of rolling water. This
      // is the standard lightweight technique 2D games actually use
      // for convincing water — a real fluid-dynamics solver would be
      // far too costly to run every frame alongside everything else
      // this simulation already does each tick, so this fakes the
      // *look* of fluid motion rather than simulating it.
      const waveWavelength = 24;
      for (let band = 0; band < 6; band++) {
        const bandY = ((t * (16 + band * 3) + band * 70) % (MAP_H + 60)) - 30;
        const amplitude = 3.5 + (band % 3);
        ctx.beginPath();
        for (let px = WATER.x + 6; px <= WATER.x + WATER.w - 6; px += 4) {
          const py = bandY + Math.sin(px / waveWavelength + t * 1.8 + band) * amplitude;
          if (px === WATER.x + 6) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = `rgba(200,230,255,${(0.1 + (band % 2) * 0.06) * nightMul})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      // Sparse foam highlights riding the same wave field, adding
      // texture without adding real per-particle physics.
      for (let i = 0; i < 8; i++) {
        const fx = WATER.x + 10 + ((i * 37 + t * 12) % (WATER.w - 20));
        const fy = ((i * 91 + t * 22) % (MAP_H + 40)) - 20;
        const foamY = fy + Math.sin(fx / waveWavelength + t * 1.8) * 3;
        ctx.fillStyle = `rgba(220,240,255,${0.25 * nightMul})`;
        ctx.beginPath();
        ctx.arc(fx, foamY, 1.1, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const f of FORESTS) {
        for (let i = 0; i < 14; i++) {
          const ang = (i / 14) * Math.PI * 2;
          const r = (i % 3) * (f.r / 3.2) + 6;
          const tx = f.x + Math.cos(ang) * r;
          const ty = f.y + Math.sin(ang) * r * 0.6;
          const sway = Math.sin(t * 1.5 + i) * 1.5;
          // Trees keep a brightness floor well above the ground's —
          // at deep night, grass and trees were multiplying by the
          // same near-black nightMul from nearly identical base
          // greens, making trees functionally invisible against the
          // ground. This keeps them a readable, silhouette-like dark
          // green even at the darkest point of night, while the
          // ground still darkens normally around them.
          const treeMul = Math.max(nightMul, 0.55);
          ctx.fillStyle = `rgb(${28 * treeMul},${(70 - seasonT * 20) * treeMul},${34 * treeMul})`;
          ctx.beginPath();
          ctx.arc(tx + sway, ty, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (const o of STONE_OUTCROPPINGS) {
        const rockMul = Math.max(nightMul, 0.55); // same night-visibility floor as trees, same reasoning
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          const r = (i % 2) * (o.r / 2.2) + 8;
          const rx = o.x + Math.cos(ang) * r;
          const ry = o.y + Math.sin(ang) * r * 0.6;
          const shade = 90 + (i % 3) * 12;
          ctx.fillStyle = `rgb(${shade * rockMul},${shade * rockMul},${(shade + 6) * rockMul})`;
          ctx.beginPath();
          ctx.moveTo(rx - 7, ry + 5);
          ctx.lineTo(rx - 3, ry - 6);
          ctx.lineTo(rx + 6, ry - 3);
          ctx.lineTo(rx + 4, ry + 6);
          ctx.closePath();
          ctx.fill();
        }
      }

      const currentTierIndex = kingdomTier(villagersRef.current.length).index;
      // Ancient Ruins — a genuinely new terrain feature, rendered
      // distinctly from ordinary stone (broken pillars, not rock
      // clusters) with a purple glow while it still has excavation
      // charges left, dimming to plain grey once exhausted so the
      // canvas itself communicates whether it's still worth a visit.
      {
        const glowMul = ruinsChargesRef.current > 0 ? 1 : 0.4;
        const pillarHeights = [34, 22, 40, 18, 28];
        for (let i = 0; i < 5; i++) {
          const ang = (i / 5) * Math.PI * 2;
          const px = RUINS.x + Math.cos(ang) * RUINS.r * 0.55;
          const py = RUINS.y + Math.sin(ang) * RUINS.r * 0.4;
          const h = pillarHeights[i];
          ctx.fillStyle = `rgba(${Math.round(150 * glowMul)},${Math.round(140 * glowMul)},${Math.round(160 * glowMul)},0.9)`;
          ctx.fillRect(px - 4, py - h, 8, h);
        }
        if (ruinsChargesRef.current > 0) {
          ctx.fillStyle = `rgba(180,92,255,${0.12 + 0.05 * Math.sin(Date.now() / 600)})`;
          ctx.beginPath();
          ctx.arc(RUINS.x, RUINS.y, RUINS.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = ruinsChargesRef.current > 0 ? "#d9a8ff" : "#6b6b6b";
        ctx.font = "9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(ruinsChargesRef.current > 0 ? `Ruins (${ruinsChargesRef.current} left)` : "Ruins (exhausted)", RUINS.x, RUINS.y + RUINS.r + 12);
      }

      // Ember Vents — a second, simpler new terrain feature: a pure
      // no-build hazard zone with no mechanic of its own, but a real
      // map-layout constraint (canPlace already blocks building
      // within its radius) rather than being purely decorative.
      for (const ev of EMBER_VENTS) {
        ctx.fillStyle = "#2a1810";
        ctx.beginPath();
        ctx.ellipse(ev.x, ev.y, ev.r, ev.r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        const pulse = 0.5 + Math.sin(t * 2.4) * 0.25;
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * Math.PI * 2 + t * 0.4;
          const cx = ev.x + Math.cos(ang) * ev.r * 0.4;
          const cy = ev.y + Math.sin(ang) * ev.r * 0.28;
          ctx.fillStyle = `rgba(255,${Math.round(90 + 40 * pulse)},40,${0.6 + 0.3 * pulse})`;
          ctx.beginPath();
          ctx.arc(cx, cy, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Real, distinct silhouettes per building type instead of every
      // building being the same flat colored rectangle — each shape
      // is built from simple canvas primitives readable at this small
      // a size (buildings are only 20-42px), not detailed sprites,
      // but genuinely different from every other type rather than a
      // shared box with a different fill color.
      function drawBuilding(b, def) {
        const x = b.x, y = b.y, w = b.w, h = b.h;
        const left = x - w / 2, top = y - h / 2;
        if (b.type === "house") {
          ctx.fillStyle = "#e8d9c0";
          ctx.fillRect(left, top + h * 0.4, w, h * 0.6);
          ctx.fillStyle = "#8a4a2f";
          ctx.beginPath();
          ctx.moveTo(left - 2, top + h * 0.42);
          ctx.lineTo(x, top - 2);
          ctx.lineTo(left + w + 2, top + h * 0.42);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#5a3a28";
          ctx.fillRect(x - 3, top + h * 0.65, 6, h * 0.35);
        } else if (b.type === "farm") {
          ctx.fillStyle = "#5a7a3a";
          ctx.fillRect(left, top, w, h);
          ctx.strokeStyle = "#3f5a28";
          ctx.lineWidth = 1;
          for (let i = 1; i < 5; i++) {
            const rowY = top + (h * i) / 5;
            ctx.beginPath();
            ctx.moveTo(left + 2, rowY);
            ctx.lineTo(left + w - 2, rowY);
            ctx.stroke();
          }
          ctx.fillStyle = "#8bc34a";
          for (let i = 0; i < 6; i++) {
            const dx = left + 4 + (i % 3) * (w / 3);
            const dy = top + 4 + Math.floor(i / 3) * (h / 2);
            ctx.beginPath();
            ctx.arc(dx, dy, 2, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (b.type === "lumberCamp") {
          ctx.fillStyle = "#6b4a28";
          ctx.fillRect(left, top, w, h);
          for (let i = 0; i < 3; i++) {
            const logY = top + 4 + i * 7;
            ctx.fillStyle = "#a87c4a";
            ctx.beginPath();
            ctx.ellipse(x, logY, w / 2 - 3, 3, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = i % 2 === 0 ? "#c9a876" : "#8a6a3c";
            ctx.beginPath();
            ctx.arc(x - (w / 2 - 6), logY, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        } else if (b.type === "quarry") {
          ctx.fillStyle = "#5a5a5a";
          ctx.fillRect(left, top, w, h);
          const rockShades = ["#9a9a9a", "#b0b0b0", "#828282"];
          for (let i = 0; i < 4; i++) {
            const rx = left + 4 + (i % 2) * (w - 10);
            const ry = top + 4 + Math.floor(i / 2) * (h - 10);
            ctx.fillStyle = rockShades[i % rockShades.length];
            ctx.beginPath();
            ctx.moveTo(rx, ry + 6);
            ctx.lineTo(rx + 3, ry);
            ctx.lineTo(rx + 7, ry + 2);
            ctx.lineTo(rx + 6, ry + 7);
            ctx.closePath();
            ctx.fill();
          }
        } else if (b.type === "blacksmith") {
          ctx.fillStyle = "#4a2f28";
          ctx.fillRect(left, top + h * 0.3, w, h * 0.7);
          ctx.fillStyle = "#2f1f1a";
          ctx.fillRect(left + w * 0.65, top - h * 0.15, w * 0.18, h * 0.5);
          const smokeBob = Math.sin(t * 1.2) * 2;
          ctx.fillStyle = "rgba(150,150,150,0.5)";
          ctx.beginPath();
          ctx.arc(left + w * 0.74, top - h * 0.25 - smokeBob, 3, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#1a1a1a";
          ctx.fillRect(left + w * 0.2, top + h * 0.75, w * 0.35, h * 0.2);
          const forgeGlow = 0.4 + Math.sin(t * 3) * 0.15;
          ctx.fillStyle = `rgba(255,90,60,${forgeGlow})`;
          ctx.beginPath();
          ctx.arc(left + w * 0.35, top + h * 0.82, 3, 0, Math.PI * 2);
          ctx.fill();
        } else if (b.type === "watchTower") {
          ctx.fillStyle = "#2a4a4a";
          ctx.fillRect(left, top, w, h);
          ctx.fillStyle = "#3ee6e0";
          for (let i = 0; i < 3; i++) {
            ctx.fillRect(left + (i * w) / 3, top - 3, w / 3 - 1, 4);
          }
        } else if (b.type === "market") {
          ctx.fillStyle = "#6b3a8a";
          ctx.beginPath();
          ctx.moveTo(left - 2, top + h * 0.5);
          ctx.lineTo(x, top - 4);
          ctx.lineTo(left + w + 2, top + h * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#b45cff";
          ctx.beginPath();
          ctx.moveTo(x - w * 0.15, top + h * 0.1);
          ctx.lineTo(x, top - 4);
          ctx.lineTo(x + w * 0.15, top + h * 0.1);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#4a2a5a";
          ctx.fillRect(left, top + h * 0.5, w, h * 0.5);
        } else if (b.type === "fishingDock") {
          ctx.fillStyle = "#6b4a28";
          for (let i = 0; i < 4; i++) {
            ctx.fillRect(left, top + (i * h) / 4, w, h / 4 - 1.5);
          }
          ctx.fillStyle = "#3ea8e0";
          ctx.beginPath();
          ctx.ellipse(left + w * 0.8, y, 4, 2.2, 0.3, 0, Math.PI * 2);
          ctx.fill();
        } else if (b.type === "townCenter") {
          ctx.fillStyle = "#ffb703";
          ctx.fillRect(left, top + h * 0.25, w, h * 0.75);
          ctx.fillStyle = "#8a4a2f";
          ctx.beginPath();
          ctx.moveTo(left - 4, top + h * 0.28);
          ctx.lineTo(x, top - 10);
          ctx.lineTo(left + w + 4, top + h * 0.28);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = "#ffe14d";
          ctx.beginPath();
          ctx.arc(x, top - 10, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = def.color;
          ctx.fillRect(left, top, w, h);
        }
      }

      for (const b of buildingsRef.current) {
        const def = BUILDING_TYPES[b.type] || { color: "#ffb703" };
        drawBuilding(b, def);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(b.x - b.w / 2, b.y + b.h / 2 - 4, b.w, 4);
        if (b.level > 1) {
          ctx.fillStyle = "#ffe14d";
          ctx.font = "8px monospace";
          ctx.textAlign = "center";
          ctx.fillText("★".repeat(b.level - 1), b.x, b.y - b.h / 2 - 4);
        }
        if (isNightNow) {
          ctx.save();
          ctx.shadowColor = "#ffb703";
          ctx.shadowBlur = 10;
          ctx.fillStyle = "#ffe14d";
          ctx.fillRect(b.x - 3, b.y - 3, 4, 4);
          ctx.restore();
        }
        // Real, visible growth reward: the town center sprouts one
        // more banner per kingdom tier reached, up to the top tier —
        // a small but genuine payoff for the population milestones
        // that took real time and resources to reach.
        if (b.type === "townCenter" && currentTierIndex > 0) {
          const bannerCount = Math.min(currentTierIndex, 5);
          for (let i = 0; i < bannerCount; i++) {
            const bx = b.x - b.w / 2 - 4 + (i * (b.w + 8)) / Math.max(1, bannerCount - 1 || 1);
            const flutter = Math.sin(t * 2 + i) * 2;
            ctx.fillStyle = "#ff3ea5";
            ctx.fillRect(bx, b.y - b.h / 2 - 14, 2, 14);
            ctx.beginPath();
            ctx.moveTo(bx + 2, b.y - b.h / 2 - 14);
            ctx.lineTo(bx + 8 + flutter, b.y - b.h / 2 - 10);
            ctx.lineTo(bx + 2, b.y - b.h / 2 - 6);
            ctx.closePath();
            ctx.fill();
          }
        }
      }

      for (const v of villagersRef.current) {
        const bobY = Math.sin(v.bob) * 1.5;
        const vy = v.y + bobY;
        // A real humanoid silhouette — head, body, simple shading —
        // instead of a single flat-colored dot, with clothing colored
        // by the villager's actual job (a farmer reads greenish, a
        // miner grey, matching their building's own color) rather
        // than one flat accent color for the whole population, giving
        // a crowd genuine visual variety the way an actual settlement
        // would have. This is still Canvas 2D shape drawing, not a
        // photorealistic render — that's simply not something this
        // rendering technology, or these units' on-screen size, can
        // produce; this is the honest ceiling of what's achievable.
        const job = v.job ? buildingsRef.current.find((b) => b.id === v.job) : null;
        const jobDef = job ? BUILDING_TYPES[job.type] : null;
        const clothColor = jobDef ? jobDef.color : accentColor || "#3ee6e0";
        ctx.fillStyle = clothColor;
        ctx.beginPath();
        ctx.ellipse(v.x, vy + 1.4, 2.3, 2.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.beginPath();
        ctx.ellipse(v.x + 0.7, vy + 1.8, 1.5, 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e0b088";
        ctx.beginPath();
        ctx.arc(v.x, vy - 2.2, 1.7, 0, Math.PI * 2);
        ctx.fill();
        if (v.carrying > 0 && v.state === "toDeposit") {
          const produces = jobDef ? jobDef.produces : null;
          const carryColor = RESOURCE_COLORS[produces] || "#e8d9c0";
          ctx.fillStyle = carryColor;
          ctx.beginPath();
          ctx.arc(v.x, v.y - 6 + bobY, 1.8, 0, Math.PI * 2);
          ctx.fill();
        }
        if (isNightNow) {
          ctx.save();
          ctx.shadowColor = "#ffb703";
          ctx.shadowBlur = 6;
          ctx.fillStyle = "#ffb703";
          ctx.beginPath();
          ctx.arc(v.x + 2, v.y - 2 + bobY, 1, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      for (const bd of banditsRef.current) {
        if (bd.isWarlord) {
          // A real boss silhouette, not a bigger dot: a dark red core
          // with a pulsing cyan outline (readable against every map's
          // floor color) plus a visible health bar, since a 420hp
          // fight genuinely needs progress feedback a single-hit
          // regular bandit never did.
          const pulse = 1 + Math.sin(t * 4) * 0.15;
          ctx.strokeStyle = "#3ee6e0";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(bd.x, bd.y, 11 * pulse, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "#4a0f18";
          ctx.beginPath();
          ctx.arc(bd.x, bd.y, 9, 0, Math.PI * 2);
          ctx.fill();
          const barW = 40;
          ctx.fillStyle = "#000";
          ctx.fillRect(bd.x - barW / 2, bd.y - 22, barW, 4);
          ctx.fillStyle = "#3ee6e0";
          ctx.fillRect(bd.x - barW / 2, bd.y - 22, barW * Math.max(0, bd.hp / bd.maxHp), 4);
          continue;
        }
        // A real humanoid raider silhouette instead of a dot — darker,
        // more ragged proportions than a villager, with a simple
        // weapon line, and the same real color-coding per raid type
        // as before (a pillager and a saboteur still read as visibly
        // different threats), just applied to a shape with an actual
        // head and body rather than one flat circle.
        const raidColor = bd.raidType === "pillager" ? "#ffb703" : bd.raidType === "saboteur" ? "#b45cff" : "#8a1f2b";
        ctx.fillStyle = raidColor;
        ctx.beginPath();
        ctx.ellipse(bd.x, bd.y + 2, 3, 3.6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.ellipse(bd.x + 1, bd.y + 2.5, 2, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#3a2a28";
        ctx.beginPath();
        ctx.arc(bd.x, bd.y - 3, 2.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#c0c0c0";
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(bd.x + 2.5, bd.y - 0.5);
        ctx.lineTo(bd.x + 5.5, bd.y - 4.5);
        ctx.stroke();
      }
      for (const pr of projectilesRef.current) {
        const target = banditsRef.current.find((bd) => bd.id === pr.targetId);
        if (target) {
          ctx.strokeStyle = "#ffe14d";
          ctx.beginPath();
          ctx.moveTo(pr.x, pr.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
        }
      }

      if (rainingRef.current) {
        ctx.strokeStyle = "rgba(155,232,255,0.35)";
        for (const drop of rainDropsRef.current) {
          ctx.beginPath();
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x - 2, drop.y - 8);
          ctx.stroke();
        }
      }

      for (const pt of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, pt.life);
        if (pt.kind === "firefly") {
          ctx.save();
          ctx.shadowColor = pt.color;
          ctx.shadowBlur = 8;
          ctx.fillStyle = pt.color;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 1.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (pt.kind === "leaf") {
          ctx.save();
          ctx.translate(pt.x, pt.y);
          ctx.rotate(pt.y * 0.05);
          ctx.fillStyle = pt.color;
          ctx.fillRect(-2, -1.2, 4, 2.4);
          ctx.restore();
        } else {
          ctx.fillStyle = pt.color;
          ctx.fillRect(pt.x - 1.5, pt.y - 1.5, 3, 3);
        }
        ctx.globalAlpha = 1;
      }
      for (const ft of floatTextRef.current) {
        ctx.globalAlpha = Math.max(0, ft.life);
        ctx.fillStyle = ft.color;
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 1;
      }

      if (isNightNow) {
        ctx.fillStyle = `rgba(5,5,20,${(0.55 - nightMul) * 0.9})`;
        ctx.fillRect(0, 0, MAP_W, MAP_H);
      }

      frameRef.current = requestAnimationFrame(render);
    }
    render();
    return () => cancelAnimationFrame(frameRef.current);
  }, [phase, accentColor]);

  if (deviceOk === null) return null;

  if (!deviceOk) {
    return (
      <div className="text-center py-10">
        <p className="text-3xl mb-4">💻</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">LAPTOP OR DESKTOP REQUIRED</p>
        <p className="text-textDim text-sm max-w-xs mx-auto">Kingdoms of Ash is built for laptop and desktop play. Please switch to a larger screen.</p>
      </div>
    );
  }

  if (phase === "menu") {
    return (
      <div className="text-center max-w-md mx-auto">
        <p className="text-3xl mb-4">🏰</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">KINGDOMS OF ASH</p>
        <p className="text-textDim text-sm mb-6">
          A calm one, for once — no reflexes needed. Place buildings, and villagers walk to work on their own,
          gathering wood, stone, food, and gold. Watch your kingdom grow over a full 60 minutes, through several
          complete day-night cycles, while bandits occasionally test your Watch Towers. Your kingdom autosaves as
          you play, so you can close the tab and pick up where you left off.
        </p>
        {savedGameInfo && (
          <div className="mb-5 rounded-md border border-accentCyan/50 bg-accentCyan/10 p-3">
            <p className="font-mono text-[10px] text-accentCyan mb-2">
              A kingdom is waiting — {Math.floor(savedGameInfo.elapsed / 60)}m in, {savedGameInfo.villagers.length} villagers.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => begin(savedGameInfo)}
                className="font-pixel text-[9px] px-4 py-2 rounded-md text-bgDeep"
                style={{ background: accentColor }}
              >
                RESUME KINGDOM
              </button>
              <button
                onClick={() => { clearSavedGame(); setSavedGameInfo(null); }}
                className="font-mono text-[9px] px-3 py-2 rounded-md border border-lineColor text-textDim"
              >
                Discard
              </button>
            </div>
          </div>
        )}
        <p className="font-mono text-[10px] text-textDim mb-2">CHOOSE THE KINGDOM'S THREAT LEVEL</p>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {Object.entries(DIFFICULTIES).map(([id, d]) => (
            <button
              key={id}
              onClick={() => setDifficulty(id)}
              className="rounded-md border-2 p-3"
              style={{ borderColor: difficulty === id ? accentColor : "rgba(169,159,214,0.3)" }}
            >
              <p className="font-mono text-[10px] text-textLight mb-1">{d.label}</p>
              <p className="font-mono text-[9px] text-accentAmber">×{d.scoreMult} score</p>
              <p className="font-mono text-[9px] text-textDim mt-1">
                {difficultyBests[id] != null ? `Best: ${difficultyBests[id]}` : "No runs yet"}
              </p>
            </button>
          ))}
        </div>
        <button onClick={() => begin(null)} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          FOUND YOUR KINGDOM
        </button>
      </div>
    );
  }

  if (phase === "over") {
    return (
      <div className="text-center">
        <p className="text-3xl mb-3">🏰</p>
        <p className="font-pixel text-sm mb-2" style={{ color: "#ffb703" }}>YOUR KINGDOM AT DUSK</p>
        {sessionTitle && (
          <div className="mb-3">
            <p className="font-pixel text-xs text-accentCyan mb-1">
              {sessionTitle.icon} {sessionTitle.name}
            </p>
            <p className="font-mono text-[10px] text-textDim">{sessionTitle.detail}</p>
          </div>
        )}
        <p className="font-mono text-xs text-textDim">{hud.population} villagers · {buildingsRef.current.length} buildings · Level {hud.kingdomLevel}</p>
      </div>
    );
  }

  return (
    <div className="text-center relative">
      <div className="flex justify-between font-mono text-[11px] mb-2 text-textDim max-w-[640px] mx-auto flex-wrap gap-1">
        <span>🪵 {hud.wood} · 🪨 {hud.stone} · 🌾 {hud.food} · 🪙 {hud.gold}</span>
        <span>🏰 {kingdomTier(hud.population).name} · ⚔️ Lv.{hud.kingdomLevel}</span>
        <span>👥 {hud.population} · ⏱️ {Math.floor(hud.timeLeft / 60)}:{String(hud.timeLeft % 60).padStart(2, "0")}</span>
      </div>

      <div
        className="relative mx-auto rounded-lg overflow-hidden border border-lineColor"
        style={{ width: MAP_W, maxWidth: "92vw", maxHeight: "50vh", aspectRatio: `${MAP_W} / ${MAP_H}` }}
      >
        <canvas
          ref={canvasRef}
          width={MAP_W}
          height={MAP_H}
          style={{ width: "100%", height: "100%", display: "block", cursor: selectedType ? "copy" : "default" }}
          onClick={handleCanvasClick}
          onMouseMove={handleCanvasMouseMove}
          onMouseLeave={() => setHoveredVillager(null)}
        />
        {hoveredVillager && (
          <div
            className="absolute bg-bgDeep/95 border border-lineColor rounded-md px-2 py-1 pointer-events-none"
            style={{
              left: `${(hoveredVillager.x / MAP_W) * 100}%`,
              top: `${(hoveredVillager.y / MAP_H) * 100}%`,
              transform: "translate(-50%, -140%)",
            }}
          >
            <p className="font-mono text-[10px] text-textLight whitespace-nowrap">
              {hoveredVillager.name}, {hoveredVillager.age}
            </p>
            <p className="font-mono text-[9px] text-textDim whitespace-nowrap">{hoveredVillager.role}</p>
          </div>
        )}
        {storyFlash && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-bgDeep/90 px-3 py-1.5 rounded-md max-w-[90%]">
            <p className="font-mono text-[10px] text-accentCyan text-center">{storyFlash}</p>
          </div>
        )}
        {notice && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-bgDeep/90 px-3 py-1.5 rounded-md">
            <p className="font-mono text-[10px] text-accentAmber">{notice}</p>
          </div>
        )}
        {pendingMilestone && (
          <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-10">
            <div className="bg-bgPanel border border-accentCyan rounded-xl p-6 text-center max-w-xs">
              <p className="font-pixel text-[11px] text-accentCyan mb-2">KINGDOM LEVEL {pendingMilestone.level}</p>
              <p className="font-mono text-[10px] text-textDim mb-4">Choose a permanent bonus for the rest of this kingdom&apos;s reign.</p>
              <div className="flex flex-col gap-2">
                {pendingMilestone.choices.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => resolveMilestone(c.id)}
                    className="font-mono text-[10px] px-4 py-3 rounded-md border border-lineColor text-textLight hover:border-accentCyan"
                  >
                    {c.icon} {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {caravanOffer && (
          // Deliberately not a blocking modal, unlike the milestone
          // choice — a caravan is a real-time opportunity you can
          // take or leave while still playing, not a decision the
          // game should pause for.
          <div className="absolute bottom-2 right-2 bg-bgPanel border border-accentMagenta rounded-lg p-3 max-w-[200px] z-10">
            <p className="font-pixel text-[9px] text-accentMagenta mb-1.5">🐫 TRADE CARAVAN</p>
            <p className="font-mono text-[10px] text-textLight mb-2">
              {caravanOffer.give.amount} {caravanOffer.give.resource} → {caravanOffer.get.amount} gold
            </p>
            <button
              onClick={acceptCaravanTrade}
              className="font-mono text-[10px] px-3 py-1.5 rounded-md w-full text-bgDeep"
              style={{ background: "#ff3ea5" }}
            >
              Trade
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-1.5 mt-3 max-w-[640px] mx-auto">
        {Object.entries(BUILDING_TYPES).map(([id, def]) => {
          const affordable = Object.entries(def.cost).every(([k, v]) => hud[k] >= v);
          const costStr = Object.entries(def.cost).map(([k, v]) => `${v}${k[0]}`).join(" ");
          return (
            <button
              key={id}
              onClick={() => setSelectedType(selectedType === id ? null : id)}
              disabled={!affordable}
              className="px-2.5 py-2 rounded-md border font-mono text-[9px] disabled:opacity-35"
              style={{ borderColor: selectedType === id ? accentColor : "rgba(169,159,214,0.3)" }}
              title={def.name}
            >
              <div>{def.icon} {def.name}</div>
              <div className="text-textDim">{costStr || "free"}</div>
            </button>
          );
        })}
      </div>
      <p className="font-mono text-[10px] text-textDim mt-3">Pick a building, then click the grass to place it.</p>
    </div>
  );
}
