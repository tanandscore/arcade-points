"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const MAP_W = 640;
const MAP_H = 420;
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

const WATER = { x: 480, y: 0, w: 160, h: MAP_H };
const RESOURCE_COLORS = { wood: "#c9a876", stone: "#9a9a9a", food: "#8bc34a", gold: "#ffe14d" };

// Calibrated against house capacity (3 per house, base 3) — a
// genuinely active hour of building houses can plausibly reach the
// high end of this range, not an unreachable number.
const KINGDOM_TIERS = [
  { minPop: 0, name: "Tiny Village" },
  { minPop: 6, name: "Growing Hamlet" },
  { minPop: 12, name: "Small Town" },
  { minPop: 20, name: "Large Town" },
  { minPop: 28, name: "Fortified City" },
  { minPop: 38, name: "Great Kingdom" },
];
function kingdomTier(population) {
  let idx = 0;
  for (let i = 0; i < KINGDOM_TIERS.length; i++) {
    if (population >= KINGDOM_TIERS[i].minPop) idx = i;
  }
  return { index: idx, name: KINGDOM_TIERS[idx].name };
}
const FORESTS = [
  { x: 60, y: 60, r: 60 },
  { x: 110, y: 320, r: 55 },
  { x: 360, y: 55, r: 45 },
];

const BUILDING_TYPES = {
  house: { name: "House", icon: "🏠", cost: { wood: 30 }, w: 26, h: 26, color: "#e8d9c0", capacity: 3 },
  farm: { name: "Farm", icon: "🌾", cost: { wood: 20 }, w: 36, h: 24, color: "#6bff6b", produces: "food", jobSlots: 2, rate: 0.4 },
  lumberCamp: { name: "Lumber Camp", icon: "🪓", cost: { wood: 15 }, w: 28, h: 28, color: "#8a6a3c", produces: "wood", jobSlots: 2, rate: 0.45, needsForest: true },
  quarry: { name: "Stone Quarry", icon: "⛏️", cost: { wood: 35 }, w: 30, h: 30, color: "#9aa0a6", produces: "stone", jobSlots: 2, rate: 0.3 },
  blacksmith: { name: "Blacksmith", icon: "🔨", cost: { wood: 30, stone: 20 }, w: 26, h: 26, color: "#ff5a3c", produces: "gold", jobSlots: 1, rate: 0.2 },
  watchTower: { name: "Watch Tower", icon: "🗼", cost: { wood: 40, stone: 25 }, w: 20, h: 40, color: "#3ee6e0", defense: true, range: 90, damage: 12 },
  market: { name: "Market", icon: "⛺", cost: { wood: 40, stone: 15 }, w: 32, h: 24, color: "#b45cff", produces: "gold", jobSlots: 1, rate: 0.25 },
};

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// A full day-night cycle every 9 minutes gives roughly 6-7 full
// cycles across a 60-minute session — enough to genuinely see
// several nights (villages at night are meant to feel magical, per
// the brief) without each phase rushing by too fast to notice.
const DAY_CYCLE_SECONDS = 540;
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
  const [hud, setHud] = useState({ wood: 60, stone: 20, food: 30, gold: 10, population: 3, timeLeft: SESSION_SECONDS });
  const [outcome, setOutcome] = useState(null);
  const [notice, setNotice] = useState("");
  const [hoveredVillager, setHoveredVillager] = useState(null);
  const [storyFlash, setStoryFlash] = useState("");
  const [savedGameInfo, setSavedGameInfo] = useState(null);

  const resourcesRef = useRef({ wood: 60, stone: 20, food: 30, gold: 10 });
  const buildingsRef = useRef([]);
  const villagersRef = useRef([]);
  const banditsRef = useRef([]);
  const projectilesRef = useRef([]);
  const particlesRef = useRef([]);
  const floatTextRef = useRef([]);
  const rainDropsRef = useRef([]);
  const rainingRef = useRef(false);
  const nextRainAtRef = useRef(0);
  const nextBanditAtRef = useRef(0);
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
        buildings: buildingsRef.current.map((b) => ({ id: b.id, type: b.type, x: b.x, y: b.y, w: b.w, h: b.h })),
        villagers: villagersRef.current.map((v) => ({ name: v.name, age: v.age, homeX: v.homeX, homeY: v.homeY })),
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
    buildingsRef.current = save.buildings.map((b) => ({ ...b, jobsFilled: 0, cooldown: 0 }));
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
    nextStoryAtRef.current = Date.now() + 60000 + Math.random() * 60000;
    nextLegendAtRef.current = Date.now() + 600000 + Math.random() * 900000;
    lastDayPhaseLabelRef.current = "";
    lastTierIndexRef.current = kingdomTier(save.villagers.length).index;
    elapsedRef.current = save.elapsed;
    finishedRef.current = false;
    setSelectedType(null);
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
    // Stories are frequent flavor beats (roughly every 3-5 minutes);
    // legends are the rare, memorable kind, deliberately much rarer
    // across a 60-minute session, not a per-tick coin flip that would
    // trivialize how special they're meant to feel.
    nextStoryAtRef.current = Date.now() + 60000 + Math.random() * 60000;
    nextLegendAtRef.current = Date.now() + 600000 + Math.random() * 900000;
    lastDayPhaseLabelRef.current = "";
    lastTierIndexRef.current = 0;
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

  function canPlace(type, x, y) {
    const def = BUILDING_TYPES[type];
    if (x - def.w / 2 < 10 || x + def.w / 2 > WATER.x - 10 || y - def.h / 2 < 10 || y + def.h / 2 > MAP_H - 10) return false;
    for (const b of buildingsRef.current) {
      const d = dist(x, y, b.x, b.y);
      if (d < (def.w + (BUILDING_TYPES[b.type]?.w || 42)) / 2 + 6) return false;
    }
    if (def.needsForest) {
      const f = nearestForest(x, y);
      if (!f || dist(x, y, f.x, f.y) > f.r + 50) return false;
    }
    return true;
  }

  function handleCanvasClick(e) {
    if (phase !== "playing") return;
    const type = selectedTypeRef.current;
    if (!type) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = MAP_W / rect.width;
    const scaleY = MAP_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const def = BUILDING_TYPES[type];
    const res = resourcesRef.current;
    const affordable = Object.entries(def.cost).every(([k, v]) => res[k] >= v);
    if (!affordable) {
      setNotice("Not enough resources");
      setTimeout(() => setNotice(""), 1200);
      return;
    }
    if (!canPlace(type, x, y)) {
      setNotice(def.needsForest ? "Lumber camps must be near a forest" : "Can't build there");
      setTimeout(() => setNotice(""), 1400);
      return;
    }
    for (const [k, v] of Object.entries(def.cost)) res[k] -= v;
    buildingsRef.current.push({ id: Math.random(), type, x, y, w: def.w, h: def.h, jobsFilled: 0, cooldown: 0 });
    spawnParticles(x, y, "#e8d9c0", 10);
    sfx.correct();
    haptics.tap();
    setSelectedType(null);
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
        const gathered = Math.round(def.rate * 20 * DIFFICULTIES[difficultyRef.current].gatherMult);
        resourcesRef.current[def.produces] = (resourcesRef.current[def.produces] || 0) + gathered;
        spawnFloatText(tc.x, tc.y - 20, `+${gathered} ${def.produces}`, "#ffe14d");
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
    clearSavedGame();
    setOutcome(true);
    setPhase("over");
    sfx.newBest();
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
    setTimeout(() => onFinish(Math.max(0, score)), 1500);
  }

  function begin(resumeSave) {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    difficultyRef.current = resumeSave ? resumeSave.difficulty : difficulty;
    if (resumeSave) resumeFromSave(resumeSave);
    else resetKingdom();
    setOutcome(null);
    setPhase("playing");

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

      if (Math.floor(elapsedRef.current) % 6 === 0) tryGrowPopulation();

      // Ambient particle life — deliberately low spawn rates tuned
      // to keep a handful of fireflies/leaves visible at once, not
      // flood the screen. Fireflies only appear once night has
      // genuinely fallen; leaves pick up as the season drifts toward
      // autumn, tying directly into the existing season progression.
      const nightForSpawning = dayNightAt((elapsedRef.current % DAY_CYCLE_SECONDS) / DAY_CYCLE_SECONDS).brightness < 0.55;
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
      const currentPhaseLabel = dayNightAt((elapsedRef.current % DAY_CYCLE_SECONDS) / DAY_CYCLE_SECONDS).label;
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
      }

      if (now > nextBanditAtRef.current && banditsRef.current.length === 0) {
        nextBanditAtRef.current = now + DIFFICULTIES[difficultyRef.current].banditIntervalMs;
        const edge = Math.floor(Math.random() * 3);
        const spawn = edge === 0 ? { x: -10, y: Math.random() * MAP_H } : edge === 1 ? { x: Math.random() * WATER.x, y: -10 } : { x: Math.random() * WATER.x, y: MAP_H + 10 };
        banditsRef.current.push({ id: Math.random(), x: spawn.x, y: spawn.y, hp: 30 });
        setNotice("Bandits approaching!");
        setTimeout(() => setNotice(""), 2000);
        sfx.lose();
      }

      const tc = townCenterRef.current;
      banditsRef.current = banditsRef.current.filter((bd) => {
        const d = dist(bd.x, bd.y, tc.x, tc.y);
        if (d < 18) {
          const res = resourcesRef.current;
          const loss = Math.min(res.gold, Math.round(15 * DIFFICULTIES[difficultyRef.current].banditDamageMult));
          res.gold -= loss;
          spawnFloatText(tc.x, tc.y - 20, `Raided! -${loss} gold`, "#ff3ea5");
          spawnParticles(bd.x, bd.y, "#ff3ea5", 10);
          return false;
        }
        bd.x += ((tc.x - bd.x) / d) * 0.55;
        bd.y += ((tc.y - bd.y) / d) * 0.55;
        return true;
      });

      for (const b of buildingsRef.current) {
        const def = BUILDING_TYPES[b.type];
        if (!def?.defense) continue;
        b.cooldown = (b.cooldown || 0) - TICK_MS;
        if (b.cooldown <= 0) {
          const target = banditsRef.current.find((bd) => dist(bd.x, bd.y, b.x, b.y) < def.range);
          if (target) {
            b.cooldown = 700;
            projectilesRef.current.push({ x: b.x, y: b.y, targetId: target.id, life: 1 });
            target.hp -= def.damage;
          }
        }
      }
      banditsRef.current = banditsRef.current.filter((bd) => {
        if (bd.hp <= 0) {
          spawnParticles(bd.x, bd.y, "#ffb703", 14);
          sfx.hit();
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
      });

      if (elapsedRef.current >= SESSION_SECONDS) endSession();
    }, TICK_MS);
  }

  useEffect(() => () => clearInterval(simIntervalRef.current), []);

  useEffect(() => {
    if (phase !== "playing") return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");

    function render() {
      const t = elapsedRef.current;
      const cyclePos = (t % DAY_CYCLE_SECONDS) / DAY_CYCLE_SECONDS;
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
      ctx.strokeStyle = `rgba(200,230,255,${0.15 + Math.sin(t * 2) * 0.05})`;
      for (let i = 0; i < 5; i++) {
        const wy = ((t * 20 + i * 90) % (MAP_H + 40)) - 20;
        ctx.beginPath();
        ctx.moveTo(WATER.x + 10, wy);
        ctx.lineTo(WATER.x + WATER.w - 10, wy);
        ctx.stroke();
      }

      for (const f of FORESTS) {
        for (let i = 0; i < 14; i++) {
          const ang = (i / 14) * Math.PI * 2;
          const r = (i % 3) * (f.r / 3.2) + 6;
          const tx = f.x + Math.cos(ang) * r;
          const ty = f.y + Math.sin(ang) * r * 0.6;
          const sway = Math.sin(t * 1.5 + i) * 1.5;
          ctx.fillStyle = `rgb(${28 * nightMul},${(70 - seasonT * 20) * nightMul},${34 * nightMul})`;
          ctx.beginPath();
          ctx.arc(tx + sway, ty, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const currentTierIndex = kingdomTier(villagersRef.current.length).index;
      for (const b of buildingsRef.current) {
        const def = BUILDING_TYPES[b.type] || { color: "#ffb703" };
        ctx.fillStyle = def.color;
        ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(b.x - b.w / 2, b.y + b.h / 2 - 4, b.w, 4);
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
        ctx.fillStyle = accentColor || "#3ee6e0";
        ctx.beginPath();
        ctx.arc(v.x, v.y + bobY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        if (v.carrying > 0 && v.state === "toDeposit") {
          const job = v.job ? buildingsRef.current.find((b) => b.id === v.job) : null;
          const produces = job ? BUILDING_TYPES[job.type]?.produces : null;
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
        ctx.fillStyle = "#8a1f2b";
        ctx.beginPath();
        ctx.arc(bd.x, bd.y, 5, 0, Math.PI * 2);
        ctx.fill();
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
        <p className="font-mono text-xs text-textDim">{hud.population} villagers · {buildingsRef.current.length} buildings</p>
      </div>
    );
  }

  return (
    <div className="text-center relative">
      <div className="flex justify-between font-mono text-[11px] mb-2 text-textDim max-w-[640px] mx-auto flex-wrap gap-1">
        <span>🪵 {hud.wood} · 🪨 {hud.stone} · 🌾 {hud.food} · 🪙 {hud.gold}</span>
        <span>🏰 {kingdomTier(hud.population).name}</span>
        <span>👥 {hud.population} · ⏱️ {Math.floor(hud.timeLeft / 60)}:{String(hud.timeLeft % 60).padStart(2, "0")}</span>
      </div>

      <div className="relative mx-auto rounded-lg overflow-hidden border border-lineColor" style={{ width: MAP_W, maxWidth: "94vw" }}>
        <canvas
          ref={canvasRef}
          width={MAP_W}
          height={MAP_H}
          style={{ width: "100%", height: "auto", display: "block", cursor: selectedType ? "copy" : "default" }}
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
