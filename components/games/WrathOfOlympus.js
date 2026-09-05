"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { speak } from "@/lib/voice";
import WrathScene3D from "./WrathScene3D";
import { haptics } from "@/lib/haptics";

// Expanded substantially for "a very large map" — from 900x600 to
// 1500x1000, roughly 2.8x the play area. The temple stays centered
// (computed from MAP_W/MAP_H, not a fixed coordinate), and enemies
// spawning from map edges now have real travel time before reaching
// it — intentional, not an oversight: it naturally extends how long
// each wave actually takes to unfold, part of stretching the whole
// match toward the requested 30-40 minutes rather than fighting the
// pacing separately from the map size.
const MAP_W = 1500;
const MAP_H = 1000;
// Two players at opposite corners, as asked — the player's temple in
// the SW corner, the enemy's altar in the NE, rather than a single
// centered temple with enemies converging from every edge. Enemies
// now spawn near the altar and march toward the temple, matching an
// actual opposing faction rather than an abstract "waves from
// nowhere" survival format.
const TEMPLE = { x: MAP_W * 0.16, y: MAP_H * 0.78, r: 55, maxHp: 1000 };
const ENEMY_ALTAR = { x: MAP_W * 0.84, y: MAP_H * 0.22, r: 50, maxHp: 1400 };

// Terrain — the temple and altar occupy the SW/NE corners, leaving
// the NW and SE corners and the wide middle genuinely empty on a map
// this size. Jungle clusters, a river, and stone formations fill it
// with real visual variety, and hidden shrines give an actual reason
// to explore rather than just camp the temple — casting any power
// near an undiscovered one for the first time grants a real bonus.
const JUNGLE_CLUSTERS = [
  { x: MAP_W * 0.08, y: MAP_H * 0.18, r: 110 },
  { x: MAP_W * 0.30, y: MAP_H * 0.55, r: 90 },
  { x: MAP_W * 0.62, y: MAP_H * 0.72, r: 100 },
  { x: MAP_W * 0.92, y: MAP_H * 0.85, r: 110 },
  { x: MAP_W * 0.45, y: MAP_H * 0.15, r: 80 },
];
const STONE_CLUSTERS = [
  { x: MAP_W * 0.20, y: MAP_H * 0.40, r: 55 },
  { x: MAP_W * 0.75, y: MAP_H * 0.55, r: 60 },
  { x: MAP_W * 0.55, y: MAP_H * 0.90, r: 50 },
];
const RIVER_PATH = [
  { x: MAP_W * 0.02, y: MAP_H * 0.55 },
  { x: MAP_W * 0.22, y: MAP_H * 0.48 },
  { x: MAP_W * 0.40, y: MAP_H * 0.62 },
  { x: MAP_W * 0.58, y: MAP_H * 0.50 },
  { x: MAP_W * 0.78, y: MAP_H * 0.65 },
  { x: MAP_W * 0.98, y: MAP_H * 0.58 },
];
const HIDDEN_SHRINES = [
  { id: 0, x: MAP_W * 0.10, y: MAP_H * 0.85 },
  { id: 1, x: MAP_W * 0.90, y: MAP_H * 0.12 },
];

// Real difficulty tiers, matching the pattern already established in
// Operation Blacksite and Kingdoms of Ash — previously this game had
// no actual difficulty scaling at all, just a hardcoded "veteran"
// string used only for score submission labeling.
const DIFFICULTIES = {
  recruit: { label: "RECRUIT", enemyHpMult: 0.75, enemyDamageMult: 0.8, altarHpMult: 0.75, guardianCount: 2, scoreMult: 1 },
  veteran: { label: "VETERAN", enemyHpMult: 1, enemyDamageMult: 1, altarHpMult: 1, guardianCount: 3, scoreMult: 1.4 },
  elite: { label: "ELITE", enemyHpMult: 1.35, enemyDamageMult: 1.25, altarHpMult: 1.3, guardianCount: 4, scoreMult: 1.9 },
};
// Extended from 10 — the much larger map and the SW/NE corner
// layout both already add real travel time per wave that the
// original pacing never had, but a genuine 30-40 minute session
// needs more actual content too, not just longer travel. This is a
// reasoned estimate, not a measured one — real playtesting is the
// only way to know if it actually lands in that range.
const TOTAL_WAVES = 14;
const TICK_MS = 50;
// Direct player control of champion id 0 — the single biggest change
// requested to make this game feel actively played rather than
// watched. 2.6 is meaningfully faster than the fastest enemy
// (Satyr at 2.0), so the player champion always feels mobile and
// responsive, never sluggish compared to what it's fighting.
const PLAYER_CHAMPION_SPEED = 2.6;
const PLAYER_CHAMPION_ATTACK_RANGE = 85; // matches the AI champions' own existing engage range, for parity rather than an arbitrary new number

// Placeable defenses — a real tower-defense-style positioning
// decision, not just more damage output. A Ward intercepts and
// fights enemies the same way a champion does (reusing the exact
// same "enemies within notice range redirect toward it" logic), so
// WHERE it's placed genuinely changes how a wave plays out, not just
// how much total damage the player has. Costs real Faith, creating a
// real opportunity cost against spending that same Faith on God
// Powers instead — and, since the champion-vulnerability fix above
// applies to wards too, a Ward isn't a free, permanent damage sink:
// it can be destroyed if left unsupported.
const WARD_FAITH_COST = 50;
const WARD_MAX_COUNT = 3;
const WARD_HP = 150;
const WARD_DAMAGE = 15;
const WARD_ATTACK_RANGE = 110; // longer than a champion's melee range — its reason to exist as a stationary structure rather than "a fourth champion"
const WARD_ATTACK_RATE_MS = 900; // slower than a champion's 700ms, balancing its passive, always-on nature and longer range

// Divine powers — a small, genuinely different set rather than a
// full pantheon system. Each has its own real effect, not a
// reskinned damage number: Zeus hits hard in a small radius,
// Poseidon knocks enemies back and slows them, Ares buffs the
// player's own champions instead of hitting enemies directly.
const POWERS = {
  zeus: {
    name: "Zeus's Bolt", icon: "⚡", cooldownMs: 6000, faithCost: 25,
    color: "#ffd23f", radius: 55, damage: 140, tier: "minor",
  },
  poseidon: {
    name: "Poseidon's Wave", icon: "🌊", cooldownMs: 9000, faithCost: 35,
    color: "#3ea8ff", radius: 90, damage: 45, knockback: 60, slowMs: 2500, tier: "minor",
  },
  ares: {
    name: "Ares's Fury", icon: "🔥", cooldownMs: 14000, faithCost: 45,
    color: "#ff5a3c", durationMs: 6000, damageMult: 1.8, speedMult: 1.3, instant: true, tier: "minor",
  },
  // Major gods — unlocked mid-match via a real choice (pick one of
  // two offered), reusing the exact milestone-choice pattern already
  // proven in Kingdoms of Ash. Both build on mechanics that actually
  // matter here: temple survival and the faith economy, not a fake
  // "heal champions" effect — champions have no damage state to heal
  // in this game, so that would have done nothing.
  athena: {
    name: "Athena's Shield", icon: "🛡️", cooldownMs: 22000, faithCost: 40,
    color: "#3ee6e0", durationMs: 8000, damageReduction: 0.5, instant: true, tier: "major",
  },
  hermes: {
    name: "Hermes' Windfall", icon: "🪽", cooldownMs: 26000, faithCost: 15,
    color: "#ffd23f", instant: true, faithBurst: 45, tier: "major",
  },
  hades: {
    name: "Hades' Wrath", icon: "💀", cooldownMs: 17000, faithCost: 50,
    color: "#8a1f2b", radius: 70, tickDamage: 16, durationMs: 5000, slowMs: 5000, tier: "major",
  },
  artemis: {
    name: "Artemis's Volley", icon: "🏹", cooldownMs: 11000, faithCost: 30,
    color: "#2ecc71", shots: 5, shotDamage: 32, findRadius: 240, tier: "major",
  },
  // The single Titan power — automatically granted, not chosen, once
  // the match reaches its final stretch. One real ultimate, not a
  // fake label on the same mechanics as everything else.
  cronus: {
    name: "Cronus's Ruin", icon: "🌀", cooldownMs: 55000, faithCost: 80,
    color: "#b45cff", radius: 150, damage: 240, tier: "titan",
  },
};

// Tier unlocks tied to wave progress — two real choices (pick one of
// two) for the Major tier, then one automatic Titan grant near the
// end of the match. This is the actual "as the game progresses,
// summon more powerful gods" system.
const GOD_TIERS = [
  { id: "major1", unlockWave: 5, label: "MAJOR GOD", choices: ["athena", "hermes"] },
  { id: "major2", unlockWave: 9, label: "MAJOR GOD", choices: ["hades", "artemis"] },
  { id: "titan", unlockWave: 12, label: "TITAN", auto: "cronus" },
];

// One short line per power for the tier-choice modal — kept separate
// from POWERS itself since these are UI copy, not gameplay data.
const POWER_DESCRIPTIONS = {
  zeus: "Heavy damage in a small radius.",
  poseidon: "Knocks back and slows a wide area.",
  ares: "Buffs your Champions' damage and speed.",
  athena: "Halves temple damage taken for 8 seconds.",
  hermes: "An instant burst of faith to spend.",
  hades: "A curse zone that burns and slows for 5 seconds.",
  artemis: "Precision shots at the 5 nearest enemies to your target.",
  cronus: "A devastating strike across a huge radius.",
};

// Real mid-run growth for the player-controlled champion — offered
// after every wave (not just the rare god-tier unlocks), so there's
// a genuine build to grow and a real decision to make on a regular
// cadence throughout a run, not just at wave 5 and 9. Stackable —
// picking the same upgrade again compounds it, so a heavily-upgraded
// wave-13 champion should feel dramatically stronger than a fresh
// wave-1 one, not just cosmetically different.
const UPGRADE_TYPES = {
  vitality: { name: "Vitality", icon: "❤️", description: "+25 max HP, fully healed" },
  might: { name: "Might", icon: "💪", description: "+5 damage per hit" },
  swiftness: { name: "Swiftness", icon: "🏃", description: "+0.35 move speed" },
  furyedge: { name: "Fury Edge", icon: "⚔️", description: "Attack 80ms faster" },
  reach: { name: "Reach", icon: "📏", description: "+15 attack range" },
};

// Three real enemy archetypes, not one reskinned mob at different
// HP values — each moves and threatens differently.
const ENEMY_TYPES = {
  harpy: { name: "Harpy", hp: 40, speed: 1.6, damage: 8, radius: 8, color: "#b45cff", faithReward: 8 },
  // Three new types genuinely expanding the roster from 3 to 6, each
  // filling a distinct role rather than being a repainted stat clone
  // — a faster/weaker early swarm unit, a fast-medium mid-game
  // threat, and a glass-cannon late-game unit (high damage, moderate
  // HP, meaningfully different from the Minotaur's tanky-bruiser
  // role rather than just a second heavy).
  satyr: { name: "Satyr", hp: 25, speed: 2.0, damage: 6, radius: 7, color: "#7cff5e", faithReward: 6 },
  cyclops: { name: "Cyclops", hp: 160, speed: 0.75, damage: 22, radius: 13, color: "#8a6a3c", faithReward: 20 },
  centaur: { name: "Centaur", hp: 90, speed: 1.3, damage: 16, radius: 11, color: "#d97a3c", faithReward: 14 },
  minotaur: { name: "Minotaur", hp: 320, speed: 1.0, damage: 35, radius: 15, color: "#8a1f2b", faithReward: 40 },
  gorgon: { name: "Gorgon", hp: 200, speed: 0.9, damage: 45, radius: 12, color: "#2f8a4a", faithReward: 30 },
  // The wave-14 boss. hp here is never actually read at spawn time —
  // spawnHydra() sets its real HP directly, deliberately bypassing
  // the generic per-wave scaling every other enemy type uses — but
  // this entry still has to exist with every field generic code
  // expects (ENEMY_TYPES[en.typeId].damage/.radius/.color/
  // .faithReward), or any of the many places that read enemy stats
  // generically would crash the instant a Hydra existed.
  hydra: { name: "Hydra", hp: 2200, speed: 0.55, damage: 40, radius: 26, color: "#1f6b3a", faithReward: 150 },
};

// Derived directly from ENEMY_TYPES's own real colors above, not a
// separately hand-maintained list — converts each "#rrggbb" string
// into the 0xrrggbb number Three.js materials expect. Kept in this
// derived form specifically so it can never drift out of sync with
// the actual colors every enemy type already uses in the 2D game.
const ENEMY_COLORS_HEX = Object.fromEntries(
  Object.entries(ENEMY_TYPES).map(([id, def]) => [id, parseInt(def.color.slice(1), 16)])
);

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export default function WrathOfOlympus({ onFinish, accentColor }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [phase, setPhase] = useState("menu"); // menu | playing | over
  const [difficulty, setDifficulty] = useState("veteran");
  const difficultyRef = useRef("veteran");
  const [outcome, setOutcome] = useState(null); // "victory" | "defeat"
  const [hud, setHud] = useState({ templeHp: TEMPLE.maxHp, altarHp: ENEMY_ALTAR.maxHp, faith: 50, wave: 0, enemiesLeft: 0, guardiansLeft: 0, wardsCount: 0, hydra: null, powerCooldowns: {} });
  const [notice, setNotice] = useState("");
  const [storyFlash, setStoryFlash] = useState("");
  const [selectedPower, setSelectedPower] = useState(null);
  const [pendingGodChoice, setPendingGodChoice] = useState(null); // { tierId, label, choices } while awaiting the player's pick
  const [pendingUpgradeChoice, setPendingUpgradeChoice] = useState(null); // array of 3 upgrade ids offered after the current wave, or null
  const [unlockedPowers, setUnlockedPowers] = useState(["zeus", "poseidon", "ares"]);
  const unlockedPowersRef = useRef(["zeus", "poseidon", "ares"]);
  const godTierIndexRef = useRef(0); // how many GOD_TIERS entries have been resolved (chosen or auto-granted)
  const pendingGodChoiceShownRef = useRef(false); // guards against re-triggering the same tier's modal every tick while awaiting the player's pick
  const championUpgradesRef = useRef({ hp: 0, damage: 0, speed: 0, atkSpeedMs: 0, range: 0 }); // cumulative stat bonuses picked across the whole run, applied on top of the player champion's base stats
  const selectedPowerRef = useRef(null);

  const templeHpRef = useRef(TEMPLE.maxHp);
  const faithRef = useRef(50);
  const waveRef = useRef(0);
  const enemiesRef = useRef([]);
  const altarHpRef = useRef(ENEMY_ALTAR.maxHp);
  const guardiansRef = useRef([]);
  const championsRef = useRef([]);
  const wardsRef = useRef([]); // placed defenses — array of { id, x, y, hp, maxHp, lastAttackAt }
  const [placingWard, setPlacingWard] = useState(false); // true while the next map click should place a Ward instead of moving/attacking with the player champion
  const placingWardRef = useRef(false); // mirrors placingWard, same reasoning as selectedPowerRef below — handleCanvasClick reads this, not the state, to avoid a stale closure
  const projectilesRef = useRef([]);
  const particlesRef = useRef([]);
  const lightningBoltsRef = useRef([]);
  const floatTextRef = useRef([]);
  const powerCooldownsRef = useRef({ zeus: 0, poseidon: 0, ares: 0 });
  const furyUntilRef = useRef(0);
  const shieldUntilRef = useRef(0); // Athena's Shield — temple takes reduced damage while now < this
  const hadesCursesRef = useRef([]); // active Hades' Wrath zones: { x, y, radius, expiresAt, nextTickAt }
  const discoveredShrinesRef = useRef([]); // ids of HIDDEN_SHRINES already found and claimed
  const waveStateRef = useRef("idle"); // idle | spawning | active | cleared
  const nextSpawnAtRef = useRef(0);
  const spawnedThisWaveRef = useRef(0);
  const waveTargetCountRef = useRef(0);
  const finishedRef = useRef(false);
  const simIntervalRef = useRef(null);
  const frameRef = useRef(null);
  const scoreDataRef = useRef({ totalKills: 0, wavesCleared: 0 });

  function spawnChampions() {
    // id 0 is the player-controlled champion; ids 1 and 2 remain the
    // existing AI allies, completely unchanged. moveTarget/
    // attackTargetId are new — only ever read/written for champion 0.
    championsRef.current = [0, 1, 2].map((i) => ({
      id: i,
      x: TEMPLE.x + Math.cos((i / 3) * Math.PI * 2) * 75,
      y: TEMPLE.y + Math.sin((i / 3) * Math.PI * 2) * 75,
      hp: 120,
      maxHp: 120,
      target: null,
      lastAttackAt: 0,
      moveTarget: null,
      attackTargetId: null,
      respawnAt: null,
    }));
  }

  function resetGame() {
    templeHpRef.current = TEMPLE.maxHp;
    altarHpRef.current = Math.round(ENEMY_ALTAR.maxHp * DIFFICULTIES[difficultyRef.current].altarHpMult);
    faithRef.current = 50;
    waveRef.current = 0;
    enemiesRef.current = [];
    projectilesRef.current = [];
    particlesRef.current = [];
    lightningBoltsRef.current = [];
    floatTextRef.current = [];
    powerCooldownsRef.current = { zeus: 0, poseidon: 0, ares: 0 };
    furyUntilRef.current = 0;
    waveStateRef.current = "idle";
    nextSpawnAtRef.current = Date.now() + 3000;
    spawnedThisWaveRef.current = 0;
    waveTargetCountRef.current = 0;
    finishedRef.current = false;
    scoreDataRef.current = { totalKills: 0, wavesCleared: 0 };
    unlockedPowersRef.current = ["zeus", "poseidon", "ares"];
    setUnlockedPowers(["zeus", "poseidon", "ares"]);
    godTierIndexRef.current = 0;
    pendingGodChoiceShownRef.current = false;
    setPendingGodChoice(null); // a stray tier-choice modal from a previous playthrough must never carry into a fresh match
    championUpgradesRef.current = { hp: 0, damage: 0, speed: 0, atkSpeedMs: 0, range: 0 }; // upgrades are per-run — a fresh match must start from base stats, not carry a previous run's growth
    wardsRef.current = []; // wards are per-run too — a fresh match must start with none placed, not carry a previous run's defenses
    placingWardRef.current = false;
    setPlacingWard(false);
    setPendingUpgradeChoice(null); // same reasoning as the god-choice modal above
    shieldUntilRef.current = 0;
    hadesCursesRef.current = [];
    discoveredShrinesRef.current = [];
    spawnChampions();
    spawnGuardians();
  }

  function spawnGuardians() {
    // Stationed permanently near the altar (unlike wave enemies, they
    // never march toward the temple) — a real, difficulty-scaled
    // defense the player has to fight through with divine powers to
    // actually reach and destroy the altar, not just an undefended
    // HP bar sitting in the corner.
    const count = DIFFICULTIES[difficultyRef.current].guardianCount;
    guardiansRef.current = Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      return {
        id: i,
        homeX: ENEMY_ALTAR.x + Math.cos(angle) * 60,
        homeY: ENEMY_ALTAR.y + Math.sin(angle) * 60,
        x: ENEMY_ALTAR.x + Math.cos(angle) * 60,
        y: ENEMY_ALTAR.y + Math.sin(angle) * 60,
        hp: 220,
        maxHp: 220,
        wobble: Math.random() * Math.PI * 2,
      };
    });
  }

  function spawnParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.5;
      particlesRef.current.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color });
    }
  }
  function spawnFloatText(x, y, text, color) {
    floatTextRef.current.push({ x, y, text, color, life: 1 });
  }

  function startNextWave() {
    waveRef.current += 1;
    waveStateRef.current = "spawning";
    const w = waveRef.current;

    if (w === TOTAL_WAVES) {
      // The finale — a single real boss instead of another crowd
      // wave. waveTargetCountRef stays at 0 so the normal per-tick
      // enemy spawner (which only fires while
      // spawnedThisWaveRef < waveTargetCountRef) never adds any
      // regular enemies alongside it — this encounter is meant to
      // be about the Hydra alone, not a boss buried in a mob.
      waveTargetCountRef.current = 0;
      spawnedThisWaveRef.current = 0;
      spawnHydra();
      setNotice(`Wave ${w} — the Hydra rises`);
      setTimeout(() => setNotice(""), 2600);
      setStoryFlash("🐍 A Hydra emerges from the altar. It regenerates if left unpressured — don't let up.");
      setTimeout(() => setStoryFlash(""), 6000);
      speak("The Hydra rises. This is the final wave.", { priority: "high" });
      return;
    }

    // A real composition curve, not just "more enemies": early waves
    // are almost all Harpies (fast, weak, teach the player to react),
    // Cyclopes phase in from wave 3, Minotaurs — the real threat —
    // only start appearing from wave 6 onward.
    const count = 4 + Math.floor(w * 1.8);
    waveTargetCountRef.current = count;
    spawnedThisWaveRef.current = 0;
    nextSpawnAtRef.current = Date.now() + 400;
    setNotice(`Wave ${w} — ${count} beasts incoming`);
    setTimeout(() => setNotice(""), 2200);
    speak(`Wave ${w}`, { priority: "high" });
  }

  function pickEnemyTypeForWave(w) {
    // Extended for the 3 new enemy types — each new tier folds in
    // alongside what's already unlocked (a genuine mix, not the
    // newest type simply replacing the old ones) rather than a
    // narrow single-type gate.
    const roll = Math.random();
    if (w >= 9 && roll < 0.14) return "gorgon";
    if (w >= 6 && roll < 0.28) return "minotaur";
    if (w >= 5 && roll < 0.42) return "centaur";
    if (w >= 3 && roll < 0.62) return "cyclops";
    if (w >= 2 && roll < 0.8) return "satyr";
    return "harpy";
  }

  function spawnOneEnemy() {
    // Spawns near the enemy altar (NE corner) with some jitter so a
    // wave doesn't stack at one exact point, and marches toward the
    // temple — an actual opposing origin, not an abstract "from
    // nowhere" edge spawn.
    const spawn = {
      x: ENEMY_ALTAR.x + (Math.random() - 0.5) * 160,
      y: ENEMY_ALTAR.y + (Math.random() - 0.5) * 160,
    };
    const typeId = pickEnemyTypeForWave(waveRef.current);
    const def = ENEMY_TYPES[typeId];
    const hpMult = (1 + (waveRef.current - 1) * 0.12) * DIFFICULTIES[difficultyRef.current].enemyHpMult;
    enemiesRef.current.push({
      id: Math.random(), typeId, x: spawn.x, y: spawn.y,
      hp: Math.round(def.hp * hpMult), maxHp: Math.round(def.hp * hpMult),
      slowUntil: 0, alive: true, lastAttackAt: 0,
    });
  }

  // The wave-14 finale — a real boss, not a bigger version of an
  // existing enemy. Lives in enemiesRef.current like any other
  // enemy (so it correctly participates in the wave-clear check,
  // champion/ward interception, and contact damage with zero changes
  // to any of that existing code) but is special-cased in the tick
  // loop for two mechanics an ordinary enemy doesn't have: it
  // regenerates a real chunk of missing HP if left unpressured for a
  // few seconds (mythologically the Hydra growing new heads — and
  // mechanically the reason a slow chip-damage strategy shouldn't
  // work against it), and it periodically spits venom at range,
  // threatening anything positioned far away too, not just whatever
  // is in melee with it. Deliberately NOT scaled by the same
  // per-wave HP multiplier every other enemy uses (2200 base HP,
  // difficulty multiplier only) — it's a one-off encounter, not a
  // "regular enemy type" subject to the generic wave-scaling curve.
  function spawnHydra() {
    const spawn = {
      x: ENEMY_ALTAR.x + (Math.random() - 0.5) * 100,
      y: ENEMY_ALTAR.y + (Math.random() - 0.5) * 100,
    };
    const hp = Math.round(2200 * DIFFICULTIES[difficultyRef.current].enemyHpMult);
    enemiesRef.current.push({
      id: Math.random(), typeId: "hydra", x: spawn.x, y: spawn.y,
      hp, maxHp: hp, prevHp: hp,
      slowUntil: 0, alive: true, lastAttackAt: 0,
      lastDamagedAt: Date.now(), lastVenomAt: 0,
    });
  }

  function endGame(won) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(simIntervalRef.current);
    setOutcome(won ? "victory" : "defeat");
    setPhase("over");
    sfx.newBest();
    const { totalKills, wavesCleared } = scoreDataRef.current;
    const score = Math.round((totalKills * 15 + wavesCleared * 200 + Math.max(0, templeHpRef.current) * 2) * DIFFICULTIES[difficultyRef.current].scoreMult);
    fetch("/api/difficulty-scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game: "wrathofolympus", difficulty: difficultyRef.current, score }),
    }).catch(() => {});
    setTimeout(() => onFinish(Math.max(0, score)), 3500);
  }

  function startGame() {
    difficultyRef.current = difficulty;
    resetGame();
    setOutcome(null);
    setPhase("playing");
    // Matches the same fullscreen pattern the other two flagship
    // games use — started here specifically because startGame() only
    // ever runs inside a real click handler, which is the only
    // context browsers allow a fullscreen request from.
    const el = wrapRef.current?.ownerDocument?.documentElement;
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});

    simIntervalRef.current = setInterval(() => {
      const now = Date.now();

      // Wave spawning
      if (waveStateRef.current === "spawning") {
        if (spawnedThisWaveRef.current < waveTargetCountRef.current && now > nextSpawnAtRef.current) {
          spawnOneEnemy();
          spawnedThisWaveRef.current += 1;
          nextSpawnAtRef.current = now + 550;
        }
        if (spawnedThisWaveRef.current >= waveTargetCountRef.current) {
          waveStateRef.current = "active";
        }
      }

      const furyActive = now < furyUntilRef.current;

      // Enemy movement + temple damage
      enemiesRef.current = enemiesRef.current.filter((en) => {
        if (!en.alive) return false;
        const slowed = now < en.slowUntil;
        const def = ENEMY_TYPES[en.typeId];
        const speed = def.speed * (slowed ? 0.4 : 1);
        const d = dist(en.x, en.y, TEMPLE.x, TEMPLE.y);
        if (d < TEMPLE.r + 8) {
          const shieldMult = now < shieldUntilRef.current ? 1 - POWERS.athena.damageReduction : 1;
          if (en.typeId === "hydra") {
            // The boss doesn't die on temple contact like an ordinary
            // enemy — it keeps grinding the temple down on the same
            // attack-rate cooldown it'd use against a champion, which
            // means leaving it unengaged at the temple is genuinely
            // costly, not a one-time, survivable hit.
            if (now - en.lastAttackAt > 900) {
              en.lastAttackAt = now;
              templeHpRef.current = Math.max(0, templeHpRef.current - def.damage * DIFFICULTIES[difficultyRef.current].enemyDamageMult * shieldMult);
              spawnParticles(en.x, en.y, "#ff3ea5", 10);
              sfx.hit();
            }
            return true;
          }
          templeHpRef.current = Math.max(0, templeHpRef.current - def.damage * DIFFICULTIES[difficultyRef.current].enemyDamageMult * shieldMult);
          spawnParticles(en.x, en.y, "#ff3ea5", 10);
          sfx.hit();
          return false;
        }
        // Champions AND wards intercept before an enemy reaches the
        // temple — anything within its own notice range redirects the
        // enemy's movement toward it instead of straight at the
        // temple. Real, separate bug fixed here while building the
        // ward system below: champions have hp/maxHp fields and a
        // rendered HP bar, but nothing anywhere actually reduced a
        // champion's HP from enemy contact — they were functionally
        // invulnerable despite the UI implying otherwise. Wards would
        // have inherited that same missing-stakes pattern if built on
        // top of it unfixed, so this fixes both together: an enemy in
        // contact range of its target now deals real, periodic damage
        // (an attack-rate cooldown, not a one-time kamikaze hit like
        // the temple above — a melee combatant should keep fighting,
        // not suicide on its first hit).
        let target = { x: TEMPLE.x, y: TEMPLE.y, kind: "temple" };
        let nearestD = Infinity;
        for (const c of championsRef.current) {
          if (c.hp <= 0) continue;
          const cd = dist(en.x, en.y, c.x, c.y);
          if (cd < 70 && cd < nearestD) { nearestD = cd; target = { ...c, kind: "champion", ref: c }; }
        }
        for (const w of wardsRef.current) {
          if (w.hp <= 0) continue;
          const wd = dist(en.x, en.y, w.x, w.y);
          if (wd < 70 && wd < nearestD) { nearestD = wd; target = { ...w, kind: "ward", ref: w }; }
        }
        if (target.kind !== "temple" && nearestD < 20) {
          if (now - en.lastAttackAt > 900) {
            en.lastAttackAt = now;
            target.ref.hp = Math.max(0, target.ref.hp - def.damage * DIFFICULTIES[difficultyRef.current].enemyDamageMult);
            spawnParticles(target.ref.x, target.ref.y, "#ff3ea5", 6);
          }
        } else {
          const ang = Math.atan2(target.y - en.y, target.x - en.x);
          en.x += Math.cos(ang) * speed;
          en.y += Math.sin(ang) * speed;
        }
        return true;
      });

      // Hydra-only mechanics — regeneration and a ranged venom
      // attack. Placed after the movement/filter pass above so this
      // reads each Hydra's real, post-combat HP for this tick, not a
      // stale value from before champions/wards/powers hit it.
      // Damage detection is done by comparing HP tick-to-tick rather
      // than instrumenting every damage source (champion melee, ward
      // attacks, and eight different god powers) to explicitly stamp
      // a "last hit" timestamp — far less risk of missing one of
      // those call sites and silently breaking the regen condition.
      for (const en of enemiesRef.current) {
        if (en.typeId !== "hydra") continue;
        if (en.hp < en.prevHp) en.lastDamagedAt = now;
        en.prevHp = en.hp;
        if (now - en.lastDamagedAt > 4000) {
          en.hp = Math.min(en.maxHp, en.hp + en.maxHp * 0.0025);
        }
        if (now - en.lastVenomAt > 2500) {
          let nearest = null, bestD = 300;
          for (const c of championsRef.current) {
            if (c.hp <= 0) continue;
            const d = dist(en.x, en.y, c.x, c.y);
            if (d < bestD) { bestD = d; nearest = c; }
          }
          for (const w of wardsRef.current) {
            if (w.hp <= 0) continue;
            const d = dist(en.x, en.y, w.x, w.y);
            if (d < bestD) { bestD = d; nearest = w; }
          }
          if (nearest) {
            en.lastVenomAt = now;
            nearest.hp = Math.max(0, nearest.hp - 25);
            projectilesRef.current.push({ x: en.x, y: en.y, tx: nearest.x, ty: nearest.y, life: 1, color: "#7cff5e" });
            sfx.hit();
          }
        }
      }

      // Champion auto-combat — id 0 is now player-directed (the
      // single biggest requested change, making this an actively
      // played game instead of a watched one); ids 1 and 2 keep the
      // exact original AI logic below, completely unchanged.
      for (const c of championsRef.current) {
        if (c.hp <= 0) {
          // A real respawn instead of a permanent death — champions
          // can now actually take damage and die (the fix above), so
          // without this, a dead player champion would leave the
          // player with zero control for the rest of the run,
          // undermining the entire point of direct control existing
          // at all. 8 seconds is a real, felt cost — you lose tempo
          // and can't act — without being crippling for the whole
          // remaining match.
          if (!c.respawnAt) {
            c.respawnAt = now + 8000;
            if (c.id === 0) {
              setStoryFlash("Your Champion has fallen — respawning in 8s.");
              setTimeout(() => setStoryFlash(""), 2400);
            }
          } else if (now >= c.respawnAt) {
            c.hp = c.maxHp;
            c.x = TEMPLE.x + Math.cos((c.id / 3) * Math.PI * 2) * 75;
            c.y = TEMPLE.y + Math.sin((c.id / 3) * Math.PI * 2) * 75;
            c.respawnAt = null;
            c.moveTarget = null;
            c.attackTargetId = null;
            if (c.id === 0) {
              setStoryFlash("Your Champion returns to the fight.");
              setTimeout(() => setStoryFlash(""), 2200);
            }
          }
          continue;
        }

        if (c.id === 0) {
          // Effective stats computed once per tick from base values
          // plus whatever's been picked via the upgrade system —
          // attack rate has an explicit floor (200ms) since a full
          // run could stack Fury Edge enough times to otherwise push
          // the computed rate to zero or negative, which would break
          // the attack-cooldown check entirely rather than just cap out.
          const u = championUpgradesRef.current;
          const effDamage = 18 + u.damage;
          const effSpeed = PLAYER_CHAMPION_SPEED + u.speed;
          const effRange = PLAYER_CHAMPION_ATTACK_RANGE + u.range;
          const effAtkRate = Math.max(200, (furyActive ? 420 : 700) - u.atkSpeedMs);

          let target = null;
          if (c.attackTargetId != null) {
            target = enemiesRef.current.find((en) => en.id === c.attackTargetId && en.hp > 0);
            if (!target) c.attackTargetId = null; // the target died or despawned since the last click
          }
          if (target) {
            const d = dist(c.x, c.y, target.x, target.y);
            if (d > effRange) {
              const ang = Math.atan2(target.y - c.y, target.x - c.x);
              c.x += Math.cos(ang) * effSpeed;
              c.y += Math.sin(ang) * effSpeed;
            } else {
              if (now - c.lastAttackAt > effAtkRate) {
                c.lastAttackAt = now;
                const dmg = Math.round(effDamage * (furyActive ? 1.8 : 1));
                target.hp -= dmg;
                projectilesRef.current.push({ x: c.x, y: c.y, tx: target.x, ty: target.y, life: 1, color: furyActive ? "#ff5a3c" : "#ffe14d" });
                if (target.hp <= 0 && target.alive) {
                  target.alive = false;
                  const def = ENEMY_TYPES[target.typeId];
                  faithRef.current = Math.min(200, faithRef.current + def.faithReward);
                  scoreDataRef.current.totalKills += 1;
                  spawnParticles(target.x, target.y, def.color, 12);
                  spawnFloatText(target.x, target.y - 14, `+${def.faithReward} faith`, "#ffd23f");
                  c.attackTargetId = null;
                }
              }
            }
          } else if (c.moveTarget) {
            const d = dist(c.x, c.y, c.moveTarget.x, c.moveTarget.y);
            if (d < 6) {
              c.moveTarget = null;
            } else {
              const ang = Math.atan2(c.moveTarget.y - c.y, c.moveTarget.x - c.x);
              c.x += Math.cos(ang) * effSpeed;
              c.y += Math.sin(ang) * effSpeed;
            }
          } else {
            // A small, intentionally short-range safety net so an
            // idle, un-piloted player champion isn't completely
            // defenseless if an enemy walks right up to it — deliberately
            // tighter than the AI champions' own 85px engage range,
            // since the point of this feature is that actively
            // directing your champion should matter, not that it
            // fights just as well on autopilot as before.
            let nearby = null, bestD = 45;
            for (const en of enemiesRef.current) {
              const d = dist(c.x, c.y, en.x, en.y);
              if (d < bestD) { bestD = d; nearby = en; }
            }
            if (nearby) {
              if (now - c.lastAttackAt > effAtkRate) {
                c.lastAttackAt = now;
                const dmg = Math.round(effDamage * (furyActive ? 1.8 : 1));
                nearby.hp -= dmg;
                projectilesRef.current.push({ x: c.x, y: c.y, tx: nearby.x, ty: nearby.y, life: 1, color: furyActive ? "#ff5a3c" : "#ffe14d" });
                if (nearby.hp <= 0 && nearby.alive) {
                  nearby.alive = false;
                  const def = ENEMY_TYPES[nearby.typeId];
                  faithRef.current = Math.min(200, faithRef.current + def.faithReward);
                  scoreDataRef.current.totalKills += 1;
                  spawnParticles(nearby.x, nearby.y, def.color, 12);
                  spawnFloatText(nearby.x, nearby.y - 14, `+${def.faithReward} faith`, "#ffd23f");
                }
              }
            }
          }
          continue;
        }

        let target = null, bestD = 85;
        for (const en of enemiesRef.current) {
          const d = dist(c.x, c.y, en.x, en.y);
          if (d < bestD) { bestD = d; target = en; }
        }
        if (target) {
          const atkRate = furyActive ? 420 : 700;
          if (now - c.lastAttackAt > atkRate) {
            c.lastAttackAt = now;
            const dmg = Math.round(18 * (furyActive ? 1.8 : 1));
            target.hp -= dmg;
            projectilesRef.current.push({ x: c.x, y: c.y, tx: target.x, ty: target.y, life: 1, color: furyActive ? "#ff5a3c" : "#ffe14d" });
            if (target.hp <= 0 && target.alive) {
              target.alive = false;
              const def = ENEMY_TYPES[target.typeId];
              faithRef.current = Math.min(200, faithRef.current + def.faithReward);
              scoreDataRef.current.totalKills += 1;
              spawnParticles(target.x, target.y, def.color, 12);
              spawnFloatText(target.x, target.y - 14, `+${def.faithReward} faith`, "#ffd23f");
            }
          }
        } else {
          // drift back toward guard position near the temple when nothing's nearby
          const homeAng = Math.atan2(TEMPLE.y - c.y, TEMPLE.x - c.x);
          const homeD = dist(c.x, c.y, TEMPLE.x, TEMPLE.y);
          if (homeD > 80) { c.x += Math.cos(homeAng) * 0.6; c.y += Math.sin(homeAng) * 0.6; }
        }
      }

      // Ward combat — the same targeting/attack shape as the AI
      // champions above (nearest enemy within range, periodic hit),
      // since a Ward is meant to feel like a real stationary
      // combatant, not a different kind of thing entirely. Also
      // filters out any Ward an enemy has destroyed, the same way
      // the enemy filter below does for enemies.
      wardsRef.current = wardsRef.current.filter((w) => w.hp > 0);
      for (const w of wardsRef.current) {
        let target = null, bestD = WARD_ATTACK_RANGE;
        for (const en of enemiesRef.current) {
          const d = dist(w.x, w.y, en.x, en.y);
          if (d < bestD) { bestD = d; target = en; }
        }
        if (target && now - w.lastAttackAt > WARD_ATTACK_RATE_MS) {
          w.lastAttackAt = now;
          target.hp -= WARD_DAMAGE;
          projectilesRef.current.push({ x: w.x, y: w.y, tx: target.x, ty: target.y, life: 1, color: "#ffd23f" });
          if (target.hp <= 0 && target.alive) {
            target.alive = false;
            const def = ENEMY_TYPES[target.typeId];
            faithRef.current = Math.min(200, faithRef.current + def.faithReward);
            scoreDataRef.current.totalKills += 1;
            spawnParticles(target.x, target.y, def.color, 12);
            spawnFloatText(target.x, target.y - 14, `+${def.faithReward} faith`, "#ffd23f");
          }
        }
      }
      enemiesRef.current = enemiesRef.current.filter((en) => en.alive !== false || en.hp > 0);

      // Wave clear check
      if (waveStateRef.current === "active" && enemiesRef.current.length === 0) {
        waveStateRef.current = "cleared";
        scoreDataRef.current.wavesCleared = waveRef.current;
        faithRef.current = Math.min(200, faithRef.current + 20);
        if (waveRef.current >= TOTAL_WAVES) {
          setTimeout(() => endGame(true), 800);
        } else {
          setNotice(`Wave ${waveRef.current} cleared!`);
          setTimeout(() => setNotice(""), 1800);
          // The next wave now waits on the player's upgrade pick
          // instead of starting automatically after a fixed delay —
          // this is a real decision each time, not a countdown to sit
          // through. resolveUpgradeChoice (below) is what actually
          // calls startNextWave() once they've chosen.
          setTimeout(() => {
            const ids = Object.keys(UPGRADE_TYPES).sort(() => Math.random() - 0.5).slice(0, 3);
            setPendingUpgradeChoice(ids);
          }, 1800);
        }
      }

      // God tier unlocks — the real "as the game progresses, summon
      // more powerful gods" system. Checked independently of the
      // wave-clear block above since a tier's unlock wave can be
      // reached at any point during a wave, not just the instant it
      // finishes.
      if (godTierIndexRef.current < GOD_TIERS.length) {
        const tier = GOD_TIERS[godTierIndexRef.current];
        if (waveRef.current >= tier.unlockWave && !pendingGodChoiceShownRef.current) {
          pendingGodChoiceShownRef.current = true;
          if (tier.auto) {
            unlockedPowersRef.current = [...unlockedPowersRef.current, tier.auto];
            setUnlockedPowers(unlockedPowersRef.current);
            godTierIndexRef.current += 1;
            pendingGodChoiceShownRef.current = false;
            setStoryFlash(`🌀 The Titan Age has come — ${POWERS[tier.auto].name} is yours to command.`);
            setTimeout(() => setStoryFlash(""), 6000);
            spawnParticles(TEMPLE.x, TEMPLE.y, POWERS[tier.auto].color, 24);
            sfx.levelUp();
          } else {
            setPendingGodChoice({ tierId: tier.id, label: tier.label, choices: tier.choices });
          }
        }
      }

      // Fireflies — always spawning since this game is permanently
      // night, using the exact proven pattern from Kingdoms of Ash: a
      // damped random-walk drift (organic wandering, not a straight
      // line) and a slow life decay, so they genuinely drift in and
      // fade out over time rather than all appearing/vanishing at
      // once.
      if (Math.random() < 0.06) {
        particlesRef.current.push({
          x: Math.random() * MAP_W,
          y: Math.random() * MAP_H,
          vx: 0, vy: 0, life: 1,
          color: "#c6ff5e",
          kind: "firefly",
        });
      }

      // Effects decay
      particlesRef.current = particlesRef.current.filter((pt) => {
        if (pt.kind === "firefly") {
          pt.vx += (Math.random() - 0.5) * 0.06;
          pt.vy += (Math.random() - 0.5) * 0.06;
          pt.vx *= 0.92;
          pt.vy *= 0.92;
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.life -= 0.004;
        } else {
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.life -= 0.04;
        }
        return pt.life > 0;
      });
      // Guardians hold position near the altar with a gentle wobble —
      // present and alive-feeling without needing full patrol/engage
      // AI, since their role is purely to be a real obstacle between
      // the player's powers and the altar itself.
      for (const g of guardiansRef.current) {
        if (g.hp <= 0) continue;
        g.wobble += 0.02;
        g.x = g.homeX + Math.cos(g.wobble) * 12;
        g.y = g.homeY + Math.sin(g.wobble) * 12;
      }
      guardiansRef.current = guardiansRef.current.filter((g) => g.hp > 0);

      // Hades' Wrath — persistent curse zones tick damage and
      // refresh a slow on any enemy standing inside, roughly once a
      // second, rather than applying once like Zeus or Poseidon.
      // Expired zones are dropped here too.
      for (const curse of hadesCursesRef.current) {
        if (now >= curse.nextTickAt) {
          curse.nextTickAt = now + 1000;
          for (const en of enemiesRef.current) {
            if (dist(en.x, en.y, curse.x, curse.y) < curse.radius) {
              en.hp -= POWERS.hades.tickDamage;
              en.slowUntil = now + POWERS.hades.slowMs;
              if (en.hp <= 0 && en.alive) {
                en.alive = false;
                const def = ENEMY_TYPES[en.typeId];
                faithRef.current = Math.min(200, faithRef.current + def.faithReward);
                scoreDataRef.current.totalKills += 1;
              }
            }
          }
        }
      }
      hadesCursesRef.current = hadesCursesRef.current.filter((c) => now < c.expiresAt);

      lightningBoltsRef.current = lightningBoltsRef.current.filter((b) => { b.life -= 0.08; return b.life > 0; });
      projectilesRef.current = projectilesRef.current.filter((p) => { p.life -= 0.15; return p.life > 0; });
      floatTextRef.current = floatTextRef.current.filter((ft) => { ft.y -= 0.4; ft.life -= 0.02; return ft.life > 0; });

      if (templeHpRef.current <= 0) {
        endGame(false);
        return;
      }
      // Destroying the altar is a real, independent victory
      // condition — the aggressive route "achieve all game
      // objectives" implies, alongside surviving every wave.
      if (altarHpRef.current <= 0) {
        endGame(true);
        return;
      }

      const hydraEntity = enemiesRef.current.find((en) => en.typeId === "hydra");
      setHud({
        templeHp: Math.round(templeHpRef.current),
        altarHp: Math.round(altarHpRef.current),
        faith: Math.round(faithRef.current),
        wave: waveRef.current,
        enemiesLeft: enemiesRef.current.length,
        guardiansLeft: guardiansRef.current.length,
        wardsCount: wardsRef.current.length, // synced here the same way every other ref-backed HUD value is, so the Place Ward button's disabled state stays live rather than reading a ref directly during render
        hydra: hydraEntity ? { hp: Math.round(hydraEntity.hp), maxHp: hydraEntity.maxHp } : null,
        // Data-driven over every power, not just the original three —
        // hardcoding zeus/poseidon/ares here meant every power added
        // after this was first written would always read as "ready"
        // in the UI even while genuinely on cooldown, since a missing
        // key just falls back to 0 wherever this gets read.
        powerCooldowns: Object.fromEntries(
          Object.keys(POWERS).map((id) => [id, Math.max(0, (powerCooldownsRef.current[id] || 0) - now)])
        ),
      });
    }, TICK_MS);

    setTimeout(() => startNextWave(), 1500);
  }

  function resolveGodChoice(powerId) {
    if (!pendingGodChoice) return;
    unlockedPowersRef.current = [...unlockedPowersRef.current, powerId];
    setUnlockedPowers(unlockedPowersRef.current);
    godTierIndexRef.current += 1;
    pendingGodChoiceShownRef.current = false;
    setStoryFlash(`${POWERS[powerId].icon} ${POWERS[powerId].name} answers your call.`);
    setTimeout(() => setStoryFlash(""), 6000);
    spawnParticles(TEMPLE.x, TEMPLE.y, POWERS[powerId].color, 20);
    sfx.levelUp();
    setPendingGodChoice(null);
  }

  function resolveUpgradeChoice(upgradeId) {
    if (!pendingUpgradeChoice) return;
    const u = championUpgradesRef.current;
    const player = championsRef.current.find((c) => c.id === 0);
    if (upgradeId === "vitality") {
      u.hp += 25;
      // HP is live champion state, not something computed from
      // championUpgradesRef at combat time the way damage/speed/
      // range/attack-rate are — it has to be applied to the actual
      // champion object directly, and a full heal on pickup is part
      // of the upgrade's own value, not just a stat increase.
      if (player) {
        player.maxHp += 25;
        player.hp = player.maxHp;
      }
    } else if (upgradeId === "might") {
      u.damage += 5;
    } else if (upgradeId === "swiftness") {
      u.speed += 0.35;
    } else if (upgradeId === "furyedge") {
      u.atkSpeedMs += 80;
    } else if (upgradeId === "reach") {
      u.range += 15;
    }
    setStoryFlash(`${UPGRADE_TYPES[upgradeId].icon} ${UPGRADE_TYPES[upgradeId].name} — ${UPGRADE_TYPES[upgradeId].description}`);
    setTimeout(() => setStoryFlash(""), 3200);
    spawnParticles(player?.x ?? TEMPLE.x, player?.y ?? TEMPLE.y, "#ffd23f", 18);
    sfx.levelUp();
    setPendingUpgradeChoice(null);
    startNextWave();
  }

  function castPower(powerId, x, y) {
    const now = Date.now();
    const power = POWERS[powerId];
    if (powerCooldownsRef.current[powerId] > now) return;
    if (faithRef.current < power.faithCost) {
      setNotice("Not enough faith");
      setTimeout(() => setNotice(""), 1200);
      return;
    }
    faithRef.current -= power.faithCost;
    powerCooldownsRef.current[powerId] = now + power.cooldownMs;

    if (powerId === "zeus") {
      spawnParticles(x, y, power.color, 24);
      sfx.newBest();
      // A real jagged bolt path from the top of the map down to the
      // target, using simple randomized midpoint displacement — not
      // a physically simulated electrical discharge, but a genuine,
      // verifiable zigzag line rather than the plain particle burst
      // this previously had with no actual bolt visual at all.
      const segments = 5;
      const boltPoints = [{ x: x + (Math.random() - 0.5) * 40, y: -20 }];
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        boltPoints.push({ x: x + (Math.random() - 0.5) * 55 * (1 - t * 0.4), y: -20 + (y - -20) * t });
      }
      boltPoints.push({ x, y });
      lightningBoltsRef.current.push({ points: boltPoints, life: 1, color: power.color });
      for (const en of enemiesRef.current) {
        if (dist(en.x, en.y, x, y) < power.radius) {
          en.hp -= power.damage;
          if (en.hp <= 0 && en.alive) {
            en.alive = false;
            const def = ENEMY_TYPES[en.typeId];
            faithRef.current = Math.min(200, faithRef.current + def.faithReward);
            scoreDataRef.current.totalKills += 1;
          }
        }
      }
      for (const g of guardiansRef.current) {
        if (g.hp > 0 && dist(g.x, g.y, x, y) < power.radius) g.hp -= power.damage;
      }
      if (dist(ENEMY_ALTAR.x, ENEMY_ALTAR.y, x, y) < power.radius) {
        altarHpRef.current = Math.max(0, altarHpRef.current - power.damage);
        spawnFloatText(ENEMY_ALTAR.x, ENEMY_ALTAR.y - 30, `Altar -${power.damage}`, "#ff5a3c");
      }
      spawnFloatText(x, y - 20, "ZEUS'S BOLT", power.color);
    } else if (powerId === "poseidon") {
      spawnParticles(x, y, power.color, 20);
      sfx.correct();
      for (const en of enemiesRef.current) {
        const d = dist(en.x, en.y, x, y);
        if (d < power.radius) {
          en.hp -= power.damage;
          en.slowUntil = now + power.slowMs;
          const ang = Math.atan2(en.y - y, en.x - x);
          en.x += Math.cos(ang) * power.knockback;
          en.y += Math.sin(ang) * power.knockback;
          if (en.hp <= 0 && en.alive) {
            en.alive = false;
            const def = ENEMY_TYPES[en.typeId];
            faithRef.current = Math.min(200, faithRef.current + def.faithReward);
            scoreDataRef.current.totalKills += 1;
          }
        }
      }
      for (const g of guardiansRef.current) {
        if (g.hp > 0 && dist(g.x, g.y, x, y) < power.radius) g.hp -= power.damage;
      }
      if (dist(ENEMY_ALTAR.x, ENEMY_ALTAR.y, x, y) < power.radius) {
        altarHpRef.current = Math.max(0, altarHpRef.current - power.damage);
        spawnFloatText(ENEMY_ALTAR.x, ENEMY_ALTAR.y - 30, `Altar -${power.damage}`, "#ff5a3c");
      }
      spawnFloatText(x, y - 20, "POSEIDON'S WAVE", power.color);
    } else if (powerId === "ares") {
      furyUntilRef.current = now + power.durationMs;
      spawnParticles(TEMPLE.x, TEMPLE.y, power.color, 20);
      sfx.levelUp();
      speak("Ares grants his fury!", { priority: "high" });
      spawnFloatText(TEMPLE.x, TEMPLE.y - 70, "ARES'S FURY", power.color);
    } else if (powerId === "athena") {
      shieldUntilRef.current = now + power.durationMs;
      spawnParticles(TEMPLE.x, TEMPLE.y, power.color, 22);
      sfx.correct();
      speak("Athena shields the temple!", { priority: "high" });
      spawnFloatText(TEMPLE.x, TEMPLE.y - 70, "ATHENA'S SHIELD", power.color);
    } else if (powerId === "hermes") {
      faithRef.current = Math.min(200, faithRef.current + power.faithBurst);
      spawnParticles(TEMPLE.x, TEMPLE.y, power.color, 18);
      sfx.correct();
      spawnFloatText(TEMPLE.x, TEMPLE.y - 70, `+${power.faithBurst} FAITH`, power.color);
    } else if (powerId === "hades") {
      hadesCursesRef.current.push({ x, y, radius: power.radius, expiresAt: now + power.durationMs, nextTickAt: now });
      spawnParticles(x, y, power.color, 20);
      sfx.newBest();
      spawnFloatText(x, y - 20, "HADES' WRATH", power.color);
    } else if (powerId === "artemis") {
      // Finds the nearest enemies to the target point, up to
      // power.shots of them — a real precision-strike mechanic
      // distinct from Zeus's flat-radius burst, good against a
      // spread-out group rather than a tight cluster.
      const candidates = enemiesRef.current
        .map((en) => ({ en, d: dist(en.x, en.y, x, y) }))
        .filter((c) => c.d < power.findRadius)
        .sort((a, b) => a.d - b.d)
        .slice(0, power.shots);
      for (const { en } of candidates) {
        en.hp -= power.shotDamage;
        projectilesRef.current.push({ x, y, tx: en.x, ty: en.y, life: 1, color: power.color });
        if (en.hp <= 0 && en.alive) {
          en.alive = false;
          const def = ENEMY_TYPES[en.typeId];
          faithRef.current = Math.min(200, faithRef.current + def.faithReward);
          scoreDataRef.current.totalKills += 1;
        }
      }
      spawnParticles(x, y, power.color, 12);
      sfx.correct();
      spawnFloatText(x, y - 20, "ARTEMIS'S VOLLEY", power.color);
    } else if (powerId === "cronus") {
      spawnParticles(x, y, power.color, 30);
      sfx.newBest();
      haptics.celebrate();
      for (const en of enemiesRef.current) {
        if (dist(en.x, en.y, x, y) < power.radius) {
          en.hp -= power.damage;
          if (en.hp <= 0 && en.alive) {
            en.alive = false;
            const def = ENEMY_TYPES[en.typeId];
            faithRef.current = Math.min(200, faithRef.current + def.faithReward);
            scoreDataRef.current.totalKills += 1;
          }
        }
      }
      for (const g of guardiansRef.current) {
        if (g.hp > 0 && dist(g.x, g.y, x, y) < power.radius) g.hp -= power.damage;
      }
      if (dist(ENEMY_ALTAR.x, ENEMY_ALTAR.y, x, y) < power.radius) {
        altarHpRef.current = Math.max(0, altarHpRef.current - power.damage);
        spawnFloatText(ENEMY_ALTAR.x, ENEMY_ALTAR.y - 30, `Altar -${power.damage}`, "#ff5a3c");
      }
      spawnFloatText(x, y - 20, "CRONUS'S RUIN", power.color);
    }

    // Hidden shrine discovery — casting any power near an
    // undiscovered shrine claims its bonus. Only meaningfully
    // reachable by the targeted powers (Zeus/Poseidon/Hades/Artemis/
    // Cronus), since the instant powers always target the temple,
    // which is far from either shrine.
    for (const shrine of HIDDEN_SHRINES) {
      if (discoveredShrinesRef.current.includes(shrine.id)) continue;
      if (dist(shrine.x, shrine.y, x, y) < 60) {
        discoveredShrinesRef.current = [...discoveredShrinesRef.current, shrine.id];
        if (shrine.id === 0) {
          faithRef.current = Math.min(200, faithRef.current + 60);
          setStoryFlash("🏛️ A hidden shrine grants a burst of faith!");
        } else {
          for (const id of Object.keys(powerCooldownsRef.current)) {
            powerCooldownsRef.current[id] = Math.max(0, powerCooldownsRef.current[id] - 5000);
          }
          setStoryFlash("🏛️ A hidden shrine hastens your divine powers!");
        }
        setTimeout(() => setStoryFlash(""), 5000);
        spawnParticles(shrine.x, shrine.y, "#b45cff", 20);
        sfx.levelUp();
      }
    }
    haptics.select();
  }

  function handleCanvasClick(e) {
    if (phase !== "playing") return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = MAP_W / rect.width;
    const scaleY = MAP_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    handleWorldClick(x, y);
  }

  // Extracted from handleCanvasClick above so the exact same,
  // already-verified targeting logic can be triggered from a
  // genuinely different input source — the 3D preview's own click
  // handling (which arrives at these same real game coordinates via
  // 3D raycasting against the ground plane, then converts back to
  // this game's real MAP_W/MAP_H pixel space) — without duplicating
  // a single line of it. Both input paths now call this one
  // function; only how (x, y) gets computed differs between them.
  function handleWorldClick(x, y) {
    if (placingWardRef.current) {
      // Checked again here, not just when the button was pressed —
      // Faith could have been spent on a God Power in the meantime,
      // and the count could theoretically change; re-validating at
      // the actual moment of placement is the only way to guarantee
      // this is still legal.
      if (faithRef.current >= WARD_FAITH_COST && wardsRef.current.length < WARD_MAX_COUNT) {
        faithRef.current -= WARD_FAITH_COST;
        wardsRef.current.push({ id: Math.random(), x, y, hp: WARD_HP, maxHp: WARD_HP, lastAttackAt: 0 });
        spawnParticles(x, y, "#ffd23f", 16);
        sfx.levelUp();
      }
      placingWardRef.current = false;
      setPlacingWard(false);
      return;
    }
    if (selectedPowerRef.current) {
      castPower(selectedPowerRef.current, x, y);
      selectedPowerRef.current = null;
      setSelectedPower(null);
      return;
    }
    // No power selected — this click now directs the player
    // champion instead of doing nothing, which is what happened here
    // before direct control existed. Clicking an enemy sets it as an
    // attack target (the champion paths to it and fights); clicking
    // empty ground just moves there. Only ever reads/writes
    // championsRef.current[0] — champions 1 and 2 stay fully
    // AI-controlled, untouched by this.
    const player = championsRef.current.find((c) => c.id === 0);
    if (!player || player.hp <= 0) return;
    let clickedEnemy = null;
    for (const en of enemiesRef.current) {
      if (en.hp <= 0) continue;
      const def = ENEMY_TYPES[en.typeId];
      if (dist(x, y, en.x, en.y) <= def.radius + 6) {
        clickedEnemy = en;
        break;
      }
    }
    if (clickedEnemy) {
      player.attackTargetId = clickedEnemy.id;
      player.moveTarget = null;
    } else {
      player.attackTargetId = null;
      player.moveTarget = { x, y };
    }
  }

  function handlePowerButtonClick(powerId) {
    if (phase !== "playing") return;
    if (Date.now() < powerCooldownsRef.current[powerId]) return;
    // Selecting a power cancels an in-progress ward placement, and
    // vice versa (see the Place Ward button's own onClick) — the two
    // modes both consume the next map click, so only one can ever be
    // armed at a time.
    placingWardRef.current = false;
    setPlacingWard(false);
    // Instant powers (no location to target — a self-buff or an
    // economy effect) cast immediately. Data-driven via POWERS[id]
    // .instant rather than hardcoding each power's id, since more
    // instant powers were added after this check was first written.
    if (POWERS[powerId].instant) {
      castPower(powerId, TEMPLE.x, TEMPLE.y);
      return;
    }
    const next = selectedPowerRef.current === powerId ? null : powerId;
    selectedPowerRef.current = next;
    setSelectedPower(next);
  }

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function render() {
      // Warm, atmospheric radial background centered on the temple,
      // replacing the flat fill — a real Canvas 2D gradient, not a
      // literal volumetric-scattering computation, but genuinely
      // moves the mood toward the warm, moody reference.
      const bgGrad = ctx.createRadialGradient(TEMPLE.x, TEMPLE.y, 40, TEMPLE.x, TEMPLE.y, MAP_W * 0.75);
      bgGrad.addColorStop(0, "#1a1006");
      bgGrad.addColorStop(0.45, "#100a12");
      bgGrad.addColorStop(1, "#050208");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, MAP_W, MAP_H);
      ctx.strokeStyle = "rgba(212,175,55,0.05)";
      for (let gx = 0; gx < MAP_W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, MAP_H); ctx.stroke(); }
      for (let gy = 0; gy < MAP_H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(MAP_W, gy); ctx.stroke(); }

      // Golden bounce-light glow radiating from the temple — this is
      // what the reference image labels "SSGI," achieved honestly
      // here as a real, verifiable radial gradient rather than an
      // actual indirect-lighting computation.
      const bounceGlow = ctx.createRadialGradient(TEMPLE.x, TEMPLE.y, TEMPLE.r * 0.5, TEMPLE.x, TEMPLE.y, TEMPLE.r * 3.2);
      bounceGlow.addColorStop(0, "rgba(255,215,0,0.28)");
      bounceGlow.addColorStop(0.5, "rgba(255,136,0,0.12)");
      bounceGlow.addColorStop(1, "rgba(255,136,0,0)");
      ctx.fillStyle = bounceGlow;
      ctx.fillRect(TEMPLE.x - TEMPLE.r * 3.2, TEMPLE.y - TEMPLE.r * 3.2, TEMPLE.r * 6.4, TEMPLE.r * 6.4);

      // River — a winding ribbon across the map, drawn as a thick
      // stroked path through the waypoints with a lighter moonlit
      // highlight down the center.
      ctx.strokeStyle = "#0d2a3d";
      ctx.lineWidth = 46;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(RIVER_PATH[0].x, RIVER_PATH[0].y);
      for (let i = 1; i < RIVER_PATH.length; i++) ctx.lineTo(RIVER_PATH[i].x, RIVER_PATH[i].y);
      ctx.stroke();
      ctx.strokeStyle = "rgba(120,200,230,0.25)";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(RIVER_PATH[0].x, RIVER_PATH[0].y);
      for (let i = 1; i < RIVER_PATH.length; i++) ctx.lineTo(RIVER_PATH[i].x, RIVER_PATH[i].y);
      ctx.stroke();

      // Jungle clusters — the same clustered-circle silhouette
      // technique proven in Kingdoms of Ash's forests, adapted for a
      // deep, saturated night-jungle palette rather than a day/night
      // cycle (this game is permanently night).
      for (const j of JUNGLE_CLUSTERS) {
        for (let i = 0; i < 16; i++) {
          const ang = (i / 16) * Math.PI * 2;
          const r = (i % 3) * (j.r / 3.2) + 8;
          const tx = j.x + Math.cos(ang) * r;
          const ty = j.y + Math.sin(ang) * r * 0.6;
          // A real, confirmed production bug fixed here: this used a
          // bare `t` that was never declared anywhere in this
          // function's scope — copied over from Kingdoms of Ash's
          // tree-sway pattern (where `t = elapsedRef.current` is
          // declared at the top of its own render()) without also
          // copying that declaration. This threw "ReferenceError: t
          // is not defined" the moment this line executed, crashing
          // the whole game on load. Every other animated element in
          // this render function already calls Date.now() directly
          // instead of relying on a pre-declared variable — matched
          // that same, already-proven pattern here.
          const sway = Math.sin(Date.now() / 830 + i) * 2;
          ctx.fillStyle = i % 4 === 0 ? "#0f2e10" : "#163d1a";
          ctx.beginPath();
          ctx.arc(tx + sway, ty, 11, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Stone clusters — reusing the same technique proven for Kingdoms
      // of Ash's stone outcroppings.
      for (const st of STONE_CLUSTERS) {
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          const r = (i % 2) * (st.r / 2.2) + 8;
          const rx = st.x + Math.cos(ang) * r;
          const ry = st.y + Math.sin(ang) * r * 0.6;
          const shade = 55 + (i % 3) * 10;
          ctx.fillStyle = `rgb(${shade},${shade},${shade + 8})`;
          ctx.beginPath();
          ctx.moveTo(rx - 8, ry + 6);
          ctx.lineTo(rx - 3, ry - 7);
          ctx.lineTo(rx + 7, ry - 4);
          ctx.lineTo(rx + 5, ry + 7);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Hidden shrines — small ruined structures the player can
      // discover by casting near them, each granting a real one-time
      // bonus (see resolveHiddenShrine). Undiscovered ones glow
      // faintly to reward exploring the wider map; discovered ones
      // go dark, matching the fact they're spent.
      for (const shrine of HIDDEN_SHRINES) {
        const discovered = discoveredShrinesRef.current.includes(shrine.id);
        ctx.fillStyle = discovered ? "#2a2438" : "#3a2f52";
        ctx.beginPath();
        ctx.arc(shrine.x, shrine.y, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = discovered ? "rgba(180,92,255,0.15)" : "rgba(180,92,255,0.6)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(shrine.x, shrine.y, 18, 0, Math.PI * 2);
        ctx.stroke();
        if (!discovered) {
          const shrineFlicker = 0.5 + Math.sin(Date.now() / 200) * 0.3;
          ctx.fillStyle = `rgba(180,92,255,${shrineFlicker * 0.3})`;
          ctx.beginPath();
          ctx.arc(shrine.x, shrine.y, 32, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Real cast shadows beneath both structures — neither had one
      // before, despite the temple already having genuine gradient
      // shading on its columns. A soft radial gradient fading to
      // transparent is the same technique already proven to work
      // well for Kingdoms of Ash's buildings, giving both structures
      // real ground contact instead of floating flat on the terrain.
      const templeShadowGrad = ctx.createRadialGradient(TEMPLE.x, TEMPLE.y + TEMPLE.r * 0.7, 0, TEMPLE.x, TEMPLE.y + TEMPLE.r * 0.7, TEMPLE.r * 1.3);
      templeShadowGrad.addColorStop(0, "rgba(0,0,0,0.4)");
      templeShadowGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = templeShadowGrad;
      ctx.beginPath();
      ctx.ellipse(TEMPLE.x, TEMPLE.y + TEMPLE.r * 0.7, TEMPLE.r * 1.3, TEMPLE.r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();

      // Temple — a real columned structure (platform, fluted columns,
      // triangular pediment roof, torches) instead of a plain circle,
      // built the same way Kingdoms of Ash's structures are: simple,
      // verifiable geometric shapes, not a texture or model.
      const templePct = Math.max(0, templeHpRef.current / TEMPLE.maxHp);
      const tW = TEMPLE.r * 2.3;
      const tH = TEMPLE.r * 1.5;
      const platformTop = TEMPLE.y + tH * 0.28;
      const colTop = TEMPLE.y - tH * 0.5;
      const colBottom = platformTop;
      const colCount = 6;
      const colW = tW * 0.055;

      // Platform base (marble steps)
      ctx.fillStyle = "#8f8370";
      ctx.fillRect(TEMPLE.x - tW / 2 - 8, platformTop, tW + 16, tH * 0.22);
      ctx.fillStyle = "#bcae97";
      ctx.fillRect(TEMPLE.x - tW / 2, platformTop - tH * 0.06, tW, tH * 0.14);

      // Architrave (the beam the roof sits on, spanning the columns)
      ctx.fillStyle = "#bcae97";
      ctx.fillRect(TEMPLE.x - tW / 2, colTop - 8, tW, 10);

      // Fluted columns with subtle flute lines and a warm torch-lit
      // gradient (brighter near center, matching the golden bounce
      // glow already surrounding the temple)
      for (let i = 0; i < colCount; i++) {
        const cx = TEMPLE.x - tW / 2 + colW * 0.8 + ((tW - colW * 1.6) / (colCount - 1)) * i;
        const colGrad = ctx.createLinearGradient(cx - colW / 2, 0, cx + colW / 2, 0);
        colGrad.addColorStop(0, "#c9bfa8");
        colGrad.addColorStop(0.5, "#f7f2e6");
        colGrad.addColorStop(1, "#c9bfa8");
        ctx.fillStyle = colGrad;
        ctx.fillRect(cx - colW / 2, colTop, colW, colBottom - colTop);
        ctx.strokeStyle = "rgba(120,108,88,0.4)";
        ctx.lineWidth = 1;
        for (let f = 1; f < 3; f++) {
          const fx = cx - colW / 2 + (colW / 3) * f;
          ctx.beginPath();
          ctx.moveTo(fx, colTop);
          ctx.lineTo(fx, colBottom);
          ctx.stroke();
        }
      }

      // Triangular pediment roof, terracotta with a shaded underside
      ctx.fillStyle = "#b84a26";
      ctx.beginPath();
      ctx.moveTo(TEMPLE.x - tW / 2 - 10, colTop - 6);
      ctx.lineTo(TEMPLE.x, colTop - tH * 0.55);
      ctx.lineTo(TEMPLE.x + tW / 2 + 10, colTop - 6);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#8a3217";
      ctx.beginPath();
      ctx.moveTo(TEMPLE.x, colTop - tH * 0.55);
      ctx.lineTo(TEMPLE.x + tW / 2 + 10, colTop - 6);
      ctx.lineTo(TEMPLE.x + tW / 2 - 6, colTop - 6);
      ctx.closePath();
      ctx.fill();

      // Twin torches flanking the entrance, flickering
      const flicker = 0.75 + Math.sin(Date.now() / 90) * 0.25;
      for (const side of [-1, 1]) {
        const torchX = TEMPLE.x + side * (tW * 0.28);
        const torchY = colBottom - 6;
        ctx.fillStyle = "#4a3421";
        ctx.fillRect(torchX - 2, torchY - 16, 4, 16);
        ctx.fillStyle = `rgba(255,170,0,${flicker})`;
        ctx.beginPath();
        ctx.arc(torchX, torchY - 20, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,119,0,${flicker * 0.4})`;
        ctx.beginPath();
        ctx.arc(torchX, torchY - 20, 14, 0, Math.PI * 2);
        ctx.fill();
      }

      // HP ring around the whole structure
      ctx.strokeStyle = templePct > 0.5 ? "#ffd23f" : templePct > 0.25 ? "#ffb703" : "#ff3ea5";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(TEMPLE.x, TEMPLE.y, TEMPLE.r * 1.35, -Math.PI / 2, -Math.PI / 2 + templePct * Math.PI * 2);
      ctx.stroke();

      // Same real cast shadow treatment as the temple above — this
      // structure had none before either.
      const altarShadowGrad = ctx.createRadialGradient(ENEMY_ALTAR.x, ENEMY_ALTAR.y + ENEMY_ALTAR.r * 0.6, 0, ENEMY_ALTAR.x, ENEMY_ALTAR.y + ENEMY_ALTAR.r * 0.6, ENEMY_ALTAR.r * 1.1);
      altarShadowGrad.addColorStop(0, "rgba(0,0,0,0.45)");
      altarShadowGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = altarShadowGrad;
      ctx.beginPath();
      ctx.ellipse(ENEMY_ALTAR.x, ENEMY_ALTAR.y + ENEMY_ALTAR.r * 0.6, ENEMY_ALTAR.r * 1.1, ENEMY_ALTAR.r * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      // Enemy altar — the opposing corner's structure, deliberately
      // colder and more ominous than the player's warm marble temple
      // (dark stone, a cold cyan-white flame instead of warm torches)
      // so the two "sides" read as visually distinct at a glance.
      const altarPct = Math.max(0, altarHpRef.current / (ENEMY_ALTAR.maxHp * DIFFICULTIES[difficultyRef.current].altarHpMult));
      const aW = ENEMY_ALTAR.r * 2;
      const aH = ENEMY_ALTAR.r * 1.2;
      ctx.fillStyle = "#241a2e";
      ctx.fillRect(ENEMY_ALTAR.x - aW / 2, ENEMY_ALTAR.y - aH * 0.15, aW, aH * 0.3);
      // Real gradient shading on the pillars instead of one flat
      // fill — matching the same treatment the temple's fluted
      // columns already had, so the altar doesn't read as visually
      // less finished than the structure it's meant to mirror.
      for (let i = 0; i < 4; i++) {
        const cx = ENEMY_ALTAR.x - aW / 2 + (aW / 3) * i;
        const pillarGrad = ctx.createLinearGradient(cx - 5, 0, cx + 5, 0);
        pillarGrad.addColorStop(0, "#2a1e36");
        pillarGrad.addColorStop(0.5, "#4a3660");
        pillarGrad.addColorStop(1, "#2a1e36");
        ctx.fillStyle = pillarGrad;
        ctx.fillRect(cx - 5, ENEMY_ALTAR.y - aH * 0.9, 10, aH * 0.75);
      }
      const altarFlicker = 0.6 + Math.sin(Date.now() / 110) * 0.3;
      ctx.fillStyle = `rgba(120,220,255,${altarFlicker})`;
      ctx.beginPath();
      ctx.arc(ENEMY_ALTAR.x, ENEMY_ALTAR.y - aH * 1.0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(80,180,255,${altarFlicker * 0.35})`;
      ctx.beginPath();
      ctx.arc(ENEMY_ALTAR.x, ENEMY_ALTAR.y - aH * 1.0, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = altarPct > 0.5 ? "#b45cff" : altarPct > 0.25 ? "#ff5a3c" : "#ff3ea5";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(ENEMY_ALTAR.x, ENEMY_ALTAR.y, ENEMY_ALTAR.r * 1.35, -Math.PI / 2, -Math.PI / 2 + altarPct * Math.PI * 2);
      ctx.stroke();

      // Guardians — stationed defenders, rendered distinctly from
      // both Champions (cyan) and wave enemies (their own type
      // colors) so they read as "the altar's defense," not a fourth
      // enemy archetype. A real faceted gem/shield hexagon instead of
      // a plain filled circle — matching the same real-shape
      // standard the enemy types already have — plus a genuine cast
      // shadow, which no guardian had before.
      for (const g of guardiansRef.current) {
        if (g.hp <= 0) continue;
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath();
        ctx.ellipse(g.x, g.y + 8, 9, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        const gemGrad = ctx.createLinearGradient(g.x - 9, 0, g.x + 9, 0);
        gemGrad.addColorStop(0, "#7a2fb0");
        gemGrad.addColorStop(0.5, "#c084f5");
        gemGrad.addColorStop(1, "#7a2fb0");
        ctx.fillStyle = gemGrad;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const ang = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const px = g.x + Math.cos(ang) * 10;
          const py = g.y + Math.sin(ang) * 10;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(180,92,255,0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(g.x, g.y, 15, 0, Math.PI * 2);
        ctx.stroke();
        const barW = 22;
        ctx.fillStyle = "#000";
        ctx.fillRect(g.x - barW / 2, g.y - 22, barW, 3);
        ctx.fillStyle = "#b45cff";
        ctx.fillRect(g.x - barW / 2, g.y - 22, barW * Math.max(0, g.hp / g.maxHp), 3);
      }

      // Champions
      for (const c of championsRef.current) {
        if (c.hp <= 0) {
          // The flash message on death fades well before the full
          // 8-second respawn does — without this, the player
          // champion would just vanish with no ongoing feedback for
          // most of that window, which would read as broken rather
          // than "on a timer."
          if (c.id === 0 && c.respawnAt) {
            const secsLeft = Math.max(0, Math.ceil((c.respawnAt - Date.now()) / 1000));
            ctx.font = "13px monospace";
            ctx.textAlign = "center";
            ctx.fillStyle = "#ffd23f";
            ctx.fillText(`Respawning in ${secsLeft}s`, TEMPLE.x, TEMPLE.y - TEMPLE.r - 16);
          }
          continue;
        }
        if (c.id === 0) {
          // The player champion gets a real, distinct look — a
          // pulsing amber ring so it's always clear at a glance which
          // one you're actually controlling, plus its own HP bar and
          // a visual marker for wherever it's currently headed.
          const pulse = 2 + Math.sin(Date.now() / 220) * 1.5;
          ctx.strokeStyle = "#ffd23f";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(c.x, c.y, 13 + pulse, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = Date.now() < furyUntilRef.current ? "#ff5a3c" : "#ffd23f";
          ctx.beginPath();
          ctx.arc(c.x, c.y, 11, 0, Math.PI * 2);
          ctx.fill();

          const barW = 30;
          ctx.fillStyle = "#000";
          ctx.fillRect(c.x - barW / 2, c.y - 24, barW, 4);
          ctx.fillStyle = "#3ee6e0";
          ctx.fillRect(c.x - barW / 2, c.y - 24, barW * Math.max(0, c.hp / c.maxHp), 4);

          if (c.moveTarget) {
            ctx.strokeStyle = "rgba(255,210,63,0.5)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(c.moveTarget.x, c.moveTarget.y, 8, 0, Math.PI * 2);
            ctx.stroke();
          } else if (c.attackTargetId != null) {
            // Named targetEnemy rather than the shorter `t`,
            // deliberately — this exact file has a real production
            // crash history from a bare, undeclared `t` used for
            // something else entirely, and reusing that name here
            // (even though this one IS properly declared) isn't
            // worth the risk of confusion on a future edit.
            const targetEnemy = enemiesRef.current.find((en) => en.id === c.attackTargetId);
            if (targetEnemy) {
              ctx.strokeStyle = "rgba(255,58,60,0.5)";
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(c.x, c.y);
              ctx.lineTo(targetEnemy.x, targetEnemy.y);
              ctx.stroke();
            }
          }
          continue;
        }
        ctx.fillStyle = Date.now() < furyUntilRef.current ? "#ff5a3c" : "#3ee6e0";
        ctx.beginPath();
        ctx.arc(c.x, c.y, 9, 0, Math.PI * 2);
        ctx.fill();
        const barW = 24;
        ctx.fillStyle = "#000";
        ctx.fillRect(c.x - barW / 2, c.y - 20, barW, 3);
        ctx.fillStyle = "#3ee6e0";
        ctx.fillRect(c.x - barW / 2, c.y - 20, barW * Math.max(0, c.hp / c.maxHp), 3);
      }

      // Wards — a distinct diamond/rhombus silhouette (not another
      // circle) so a placed defense reads as clearly different from
      // a champion at a glance, plus a faint range ring so its
      // coverage is genuinely visible, not just implied.
      for (const w of wardsRef.current) {
        ctx.strokeStyle = "rgba(255,210,63,0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(w.x, w.y, WARD_ATTACK_RANGE, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = "#ffd23f";
        ctx.beginPath();
        ctx.moveTo(w.x, w.y - 11);
        ctx.lineTo(w.x + 9, w.y);
        ctx.lineTo(w.x, w.y + 11);
        ctx.lineTo(w.x - 9, w.y);
        ctx.closePath();
        ctx.fill();

        const barW = 26;
        ctx.fillStyle = "#000";
        ctx.fillRect(w.x - barW / 2, w.y - 20, barW, 3);
        ctx.fillStyle = "#ffd23f";
        ctx.fillRect(w.x - barW / 2, w.y - 20, barW * Math.max(0, w.hp / w.maxHp), 3);
      }

      // Enemies
      for (const en of enemiesRef.current) {
        const def = ENEMY_TYPES[en.typeId];
        const slowed = Date.now() < en.slowUntil;
        if (en.typeId === "hydra") {
          // A genuinely distinct silhouette for the boss — three
          // serpent necks rising from one body, not a scaled-up
          // version of any existing enemy shape. Each head sways on
          // its own offset so they read as separate, alive heads
          // rather than one rigid shape, and a large HP bar sits
          // above it in addition to the dedicated boss bar in the
          // HUD, so its health is visible right where the fight is
          // actually happening too.
          const r = def.radius;
          ctx.save();
          ctx.translate(en.x, en.y);
          ctx.fillStyle = slowed ? "#3ea8ff" : "#1f6b3a";
          ctx.beginPath();
          ctx.ellipse(0, r * 0.4, r * 0.95, r * 0.65, 0, 0, Math.PI * 2);
          ctx.fill();
          const headOffsets = [-0.55, 0, 0.55];
          headOffsets.forEach((off, i) => {
            const sway = Math.sin(Date.now() / 260 + i * 2) * 6;
            const hx = off * r * 1.3 + sway;
            const hy = -r * 0.9 - Math.abs(off) * r * 0.3;
            ctx.strokeStyle = "#1f6b3a";
            ctx.lineWidth = r * 0.32;
            ctx.beginPath();
            ctx.moveTo(off * r * 0.5, r * 0.1);
            ctx.quadraticCurveTo(off * r * 0.9, -r * 0.5, hx, hy);
            ctx.stroke();
            ctx.fillStyle = "#2f8a4a";
            ctx.beginPath();
            ctx.arc(hx, hy, r * 0.28, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "#ffe14d";
            ctx.beginPath();
            ctx.arc(hx - r * 0.1, hy - r * 0.05, 2.4, 0, Math.PI * 2);
            ctx.arc(hx + r * 0.1, hy - r * 0.05, 2.4, 0, Math.PI * 2);
            ctx.fill();
          });
          ctx.restore();
          const barW = r * 2.6;
          ctx.fillStyle = "#000";
          ctx.fillRect(en.x - barW / 2, en.y - r * 2.2, barW, 4);
          ctx.fillStyle = "#7cff5e";
          ctx.fillRect(en.x - barW / 2, en.y - r * 2.2, barW * Math.max(0, en.hp / en.maxHp), 4);
        } else if (en.typeId === "minotaur") {
          // Real unit art for the Minotaur specifically, as asked —
          // a muscular body silhouette with curved horns, not a
          // plain colored circle like the other two enemy types.
          const r = def.radius;
          ctx.save();
          ctx.translate(en.x, en.y);
          ctx.fillStyle = slowed ? "#3ea8ff" : "#3a1f10";
          ctx.beginPath();
          ctx.moveTo(-r * 0.85, r * 0.9);
          ctx.quadraticCurveTo(-r * 1.5, -r * 0.2, -r * 0.6, -r * 1.3);
          ctx.quadraticCurveTo(0, -r * 1.7, r * 0.6, -r * 1.3);
          ctx.quadraticCurveTo(r * 1.5, -r * 0.2, r * 0.85, r * 0.9);
          ctx.quadraticCurveTo(0, r * 1.2, -r * 0.85, r * 0.9);
          ctx.closePath();
          ctx.fill();
          // Ivory horns
          ctx.fillStyle = "#f5f0e1";
          ctx.strokeStyle = "#29170b";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(-r * 0.3, -r * 1.3);
          ctx.quadraticCurveTo(-r * 1.1, -r * 1.9, -r * 0.9, -r * 1.0);
          ctx.quadraticCurveTo(-r * 0.6, -r * 1.35, -r * 0.3, -r * 1.15);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(r * 0.3, -r * 1.3);
          ctx.quadraticCurveTo(r * 1.1, -r * 1.9, r * 0.9, -r * 1.0);
          ctx.quadraticCurveTo(r * 0.6, -r * 1.35, r * 0.3, -r * 1.15);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // Glowing red eyes
          ctx.fillStyle = "#ff3ea5";
          ctx.beginPath();
          ctx.arc(-r * 0.25, -r * 0.6, 2.2, 0, Math.PI * 2);
          ctx.arc(r * 0.25, -r * 0.6, 2.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (en.typeId === "satyr") {
          // A small, pointed silhouette — two short horns on a tight
          // body, matching its role as a fast, fragile swarm unit.
          const r = def.radius;
          ctx.save();
          ctx.translate(en.x, en.y);
          ctx.fillStyle = slowed ? "#3ea8ff" : def.color;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#e8d9a8";
          ctx.beginPath();
          ctx.moveTo(-r * 0.5, -r * 0.6);
          ctx.lineTo(-r * 0.9, -r * 1.5);
          ctx.lineTo(-r * 0.1, -r * 0.8);
          ctx.closePath();
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(r * 0.5, -r * 0.6);
          ctx.lineTo(r * 0.9, -r * 1.5);
          ctx.lineTo(r * 0.1, -r * 0.8);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else if (en.typeId === "centaur") {
          // A genuinely elongated horizontal silhouette — a long
          // horse-body base with a smaller torso bump, reading as
          // clearly different from every round enemy shape.
          const r = def.radius;
          ctx.save();
          ctx.translate(en.x, en.y);
          ctx.fillStyle = slowed ? "#3ea8ff" : def.color;
          ctx.beginPath();
          ctx.ellipse(0, r * 0.15, r * 1.5, r * 0.75, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.ellipse(-r * 0.6, -r * 0.55, r * 0.55, r * 0.65, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        } else if (en.typeId === "gorgon") {
          // A humanoid body with wavy snake-hair lines radiating from
          // the head — reads clearly as a distinct, dangerous unit,
          // not a fourth "colored circle" enemy.
          const r = def.radius;
          ctx.save();
          ctx.translate(en.x, en.y);
          ctx.fillStyle = slowed ? "#3ea8ff" : def.color;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = "#0f3a1f";
          ctx.lineWidth = 1.4;
          for (let i = 0; i < 6; i++) {
            const ang = -Math.PI / 2 + (i - 2.5) * 0.35;
            const wob = Math.sin(Date.now() / 200 + i) * 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(ang) * r * 0.7, Math.sin(ang) * r * 0.7);
            ctx.quadraticCurveTo(Math.cos(ang) * r * 1.3 + wob, Math.sin(ang) * r * 1.3, Math.cos(ang) * r * 1.6, Math.sin(ang) * r * 1.6 - r * 0.3);
            ctx.stroke();
          }
          ctx.restore();
        } else {
          ctx.fillStyle = slowed ? "#3ea8ff" : def.color;
          ctx.beginPath();
          ctx.arc(en.x, en.y, def.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        const barW = def.radius * 2.4;
        ctx.fillStyle = "#000";
        ctx.fillRect(en.x - barW / 2, en.y - def.radius - 8, barW, 3);
        ctx.fillStyle = "#ff3ea5";
        ctx.fillRect(en.x - barW / 2, en.y - def.radius - 8, barW * Math.max(0, en.hp / en.maxHp), 3);
      }

      // Lightning bolts (Zeus's power) — a real jagged path with a
      // genuine glow via shadowBlur, matching the reference's bloom
      // halo around the strike, achieved with a real, verifiable
      // Canvas 2D technique rather than an actual bloom post-process
      // pass.
      for (const bolt of lightningBoltsRef.current) {
        ctx.globalAlpha = Math.max(0, bolt.life);
        ctx.save();
        ctx.shadowColor = bolt.color;
        ctx.shadowBlur = 22;
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 10;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        ctx.moveTo(bolt.points[0].x, bolt.points[0].y);
        for (let i = 1; i < bolt.points.length; i++) ctx.lineTo(bolt.points[i].x, bolt.points[i].y);
        ctx.stroke();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // Projectiles
      for (const p of projectilesRef.current) {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.tx, p.ty);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Particles
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
        } else {
          ctx.fillStyle = pt.color;
          ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
        }
        ctx.globalAlpha = 1;
      }

      // Float text
      for (const ft of floatTextRef.current) {
        ctx.globalAlpha = Math.max(0, ft.life);
        ctx.fillStyle = ft.color;
        ctx.font = "11px monospace";
        ctx.textAlign = "center";
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 1;
      }

      // Vignette — darkens the edges, a real radial gradient drawn
      // last over everything, matching the reference's tilt-shift/
      // depth-of-field framing without an actual lens-blur pass.
      const vignette = ctx.createRadialGradient(MAP_W / 2, MAP_H / 2, MAP_H * 0.35, MAP_W / 2, MAP_H / 2, MAP_H * 0.75);
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, MAP_W, MAP_H);

      frameRef.current = requestAnimationFrame(render);
    }
    render();
    return () => cancelAnimationFrame(frameRef.current);
  }, [phase]);

  useEffect(() => {
    return () => {
      clearInterval(simIntervalRef.current);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  if (phase === "menu") {
    return (
      <div className="text-center max-w-md mx-auto">
        <p className="text-4xl mb-3">⚡</p>
        <p className="font-pixel text-sm mb-3" style={{ color: accentColor || "#ffd23f" }}>WRATH OF OLYMPUS</p>
        <p className="text-textDim text-sm mb-6">
          You directly control one Champion — click the ground to move, click an enemy to attack it. Your other
          two Champions still fight on their own. Your temple stands in one corner of the map, the enemy's altar
          in the other. Survive {TOTAL_WAVES} escalating waves, or fight through their guardians and bring the
          altar down yourself.
        </p>
        <div className="text-left text-textDim text-xs mb-4 space-y-1.5 font-mono">
          <p>🖱️ <span className="text-textLight">Click ground</span> — move your Champion (the one with the glowing ring)</p>
          <p>⚔️ <span className="text-textLight">Click an enemy</span> — send your Champion to attack it</p>
        </div>
        <div className="text-left text-textDim text-xs mb-6 space-y-1.5 font-mono">
          <p>⚡ <span className="text-textLight">Zeus's Bolt</span> — heavy damage in a small radius</p>
          <p>🌊 <span className="text-textLight">Poseidon's Wave</span> — knocks back and slows a wide area</p>
          <p>🔥 <span className="text-textLight">Ares's Fury</span> — buffs your Champions' damage and speed</p>
        </div>
        <div className="flex justify-center gap-2 mb-6">
          {Object.entries(DIFFICULTIES).map(([id, d]) => (
            <button
              key={id}
              onClick={() => setDifficulty(id)}
              className="font-mono text-[10px] px-3 py-2 rounded-md border"
              style={{
                borderColor: difficulty === id ? (accentColor || "#ffd23f") : "rgba(212,175,55,0.35)",
                color: difficulty === id ? (accentColor || "#ffd23f") : "#a89f91",
                background: difficulty === id ? "rgba(255,210,63,0.1)" : "transparent",
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
        <button
          onClick={startGame}
          className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep"
          style={{ background: accentColor || "#ffd23f" }}
        >
          BEGIN THE DEFENSE ▸
        </button>
      </div>
    );
  }

  if (phase === "over") {
    const altarDestroyed = outcome === "victory" && altarHpRef.current <= 0;
    return (
      <div className="text-center">
        <p className="text-4xl mb-3">{outcome === "victory" ? "🏆" : "💀"}</p>
        <p className="font-pixel text-sm mb-2" style={{ color: outcome === "victory" ? "#ffd23f" : "#ff3ea5" }}>
          {outcome === "victory" ? "OLYMPUS TRIUMPHANT" : "THE TEMPLE HAS FALLEN"}
        </p>
        {altarDestroyed && <p className="font-mono text-xs mb-1" style={{ color: "#b45cff" }}>The enemy altar lies in ruins.</p>}
        <p className="font-mono text-xs text-textDim">
          Wave {scoreDataRef.current.wavesCleared} of {TOTAL_WAVES} · {scoreDataRef.current.totalKills} beasts slain
        </p>
      </div>
    );
  }

  return (
    <div className="text-center relative" ref={wrapRef}>
      <div
        className="flex justify-between font-mono text-[11px] mb-2 max-w-[900px] mx-auto flex-wrap gap-2 px-4 py-2.5 rounded-md"
        style={{
          background: "linear-gradient(180deg, rgba(18,10,5,0.95), rgba(3,1,1,0.98))",
          border: "1.5px solid rgba(212,175,55,0.55)",
        }}
      >
        <span style={{ color: "#f0e6d2" }}>⛩️ Temple: <span style={{ color: templeHpRef.current < TEMPLE.maxHp * 0.3 ? "#ff5a3c" : "#f0e6d2" }}>{hud.templeHp}/{TEMPLE.maxHp}</span></span>
        <span style={{ color: "#3ee6e0" }}>✨ Faith: {hud.faith}</span>
        <span style={{ color: "#d4af37" }}>🌊 Wave {hud.wave}/{TOTAL_WAVES} <span style={{ color: "#f0e6d2" }}>· {hud.enemiesLeft} remaining</span></span>
        <span style={{ color: "#b45cff" }}>🏛️ Altar: {hud.altarHp} <span style={{ color: "#f0e6d2" }}>· {hud.guardiansLeft} guardians</span></span>
      </div>

      {hud.hydra && (
        // A real, prominent boss bar — the classic "this is the
        // fight that matters right now" UX signal, shown in addition
        // to the smaller bar rendered directly above the Hydra on
        // the battlefield, not instead of it.
        <div className="max-w-[500px] mx-auto mb-2 px-3 py-1.5 rounded-md" style={{ background: "rgba(31,107,58,0.25)", border: "1.5px solid #7cff5e" }}>
          <p className="font-pixel text-[10px] mb-1" style={{ color: "#7cff5e" }}>🐍 HYDRA</p>
          <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: "#000" }}>
            <div className="h-full" style={{ width: `${Math.max(0, (hud.hydra.hp / hud.hydra.maxHp) * 100)}%`, background: "#7cff5e" }} />
          </div>
        </div>
      )}

      <div
        className="relative mx-auto rounded-lg overflow-hidden border border-lineColor cursor-crosshair"
        style={{ width: MAP_W, maxWidth: "94vw", maxHeight: "65vh", aspectRatio: `${MAP_W} / ${MAP_H}` }}
      >
        <canvas
          ref={canvasRef}
          width={MAP_W}
          height={MAP_H}
          style={{ width: "100%", height: "100%", display: "block" }}
          onClick={handleCanvasClick}
        />
        {notice && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-bgDeep/90 px-3 py-1.5 rounded-md">
            <p className="font-mono text-[10px] text-accentAmber">{notice}</p>
          </div>
        )}
        {storyFlash && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-bgDeep/90 px-3 py-1.5 rounded-md max-w-[90%]">
            <p className="font-mono text-[10px] text-center" style={{ color: "#d4af37" }}>{storyFlash}</p>
          </div>
        )}
        {selectedPower && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-bgDeep/90 px-3 py-1.5 rounded-md">
            <p className="font-mono text-[10px] text-accentCyan">Click the battlefield to cast {POWERS[selectedPower].name}</p>
          </div>
        )}
        {pendingGodChoice && (
          <div className="absolute inset-0 bg-black/75 flex items-center justify-center z-10">
            <div
              className="rounded-xl p-6 text-center max-w-sm"
              style={{ background: "linear-gradient(180deg, rgba(18,10,5,0.98), rgba(3,1,1,0.99))", border: "1.5px solid rgba(212,175,55,0.6)" }}
            >
              <p className="font-pixel text-[11px] mb-2" style={{ color: "#d4af37" }}>{pendingGodChoice.label} UNLOCKED</p>
              <p className="font-mono text-[10px] mb-4" style={{ color: "#a89f91" }}>Choose which god answers your call for the rest of this battle.</p>
              <div className="flex flex-col gap-2">
                {pendingGodChoice.choices.map((id) => {
                  const power = POWERS[id];
                  return (
                    <button
                      key={id}
                      onClick={() => resolveGodChoice(id)}
                      className="font-mono text-[10px] px-4 py-3 rounded-md border text-left"
                      style={{ borderColor: "rgba(212,175,55,0.4)", color: power.color }}
                    >
                      <div>{power.icon} {power.name}</div>
                      <div className="text-[9px] mt-1" style={{ color: "#a89f91" }}>{POWER_DESCRIPTIONS[id]}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {pendingUpgradeChoice && (
          // Same modal shape as the god-choice one above, deliberately
          // — a consistent "the game pauses, you pick one of a few
          // cards" pattern, not a second, differently-styled UI the
          // player has to learn. Offered after every wave rather than
          // the rare god-tier unlocks, so this is the one the player
          // will actually see most often.
          <div className="absolute inset-0 bg-black/75 flex items-center justify-center z-10">
            <div
              className="rounded-xl p-6 text-center max-w-sm"
              style={{ background: "linear-gradient(180deg, rgba(18,10,5,0.98), rgba(3,1,1,0.99))", border: "1.5px solid rgba(255,210,63,0.6)" }}
            >
              <p className="font-pixel text-[11px] mb-2" style={{ color: "#ffd23f" }}>CHOOSE AN UPGRADE</p>
              <p className="font-mono text-[10px] mb-4" style={{ color: "#a89f91" }}>Grow your Champion before the next wave arrives.</p>
              <div className="flex flex-col gap-2">
                {pendingUpgradeChoice.map((id) => {
                  const up = UPGRADE_TYPES[id];
                  return (
                    <button
                      key={id}
                      onClick={() => resolveUpgradeChoice(id)}
                      className="font-mono text-[10px] px-4 py-3 rounded-md border text-left"
                      style={{ borderColor: "rgba(255,210,63,0.4)", color: "#ffd23f" }}
                    >
                      <div>{up.icon} {up.name}</div>
                      <div className="text-[9px] mt-1" style={{ color: "#a89f91" }}>{up.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Real 3D preview — additive only, verified separately before
          being wired here. This does not affect gameplay or input in
          any way; the canvas above still handles 100% of real
          interaction exactly as it always has. */}
      <div className="max-w-[900px] mx-auto mt-3 rounded-lg overflow-hidden border border-lineColor">
        <p className="font-mono text-[10px] px-3 py-1.5" style={{ background: "rgba(120,220,255,0.1)", color: "#78dcff" }}>
          🔺 3D PREVIEW (BETA) — mirrors the live battle above, doesn&apos;t affect it
        </p>
        <WrathScene3D
          mapW={MAP_W}
          mapH={MAP_H}
          temple={TEMPLE}
          altar={ENEMY_ALTAR}
          championsRef={championsRef}
          enemiesRef={enemiesRef}
          wardsRef={wardsRef}
          enemyColors={ENEMY_COLORS_HEX}
          onWorldClick={handleWorldClick}
        />
      </div>

      <div
        className="flex justify-center gap-2.5 mt-3 max-w-[900px] mx-auto p-3 rounded-md flex-wrap"
        style={{
          background: "linear-gradient(180deg, rgba(18,10,5,0.95), rgba(3,1,1,0.98))",
          border: "1.5px solid rgba(212,175,55,0.55)",
        }}
      >
        {unlockedPowers.map((id) => {
          const power = POWERS[id];
          const cooldown = hud.powerCooldowns[id] || 0;
          const onCooldown = cooldown > 0;
          const affordable = hud.faith >= power.faithCost;
          const disabled = onCooldown || !affordable;
          const active = selectedPower === id;
          return (
            <button
              key={id}
              onClick={() => handlePowerButtonClick(id)}
              disabled={disabled}
              className="font-mono text-[10px] px-4 py-2.5 rounded-md border disabled:opacity-40 flex flex-col items-center transition-all"
              style={{
                borderColor: active ? power.color : "rgba(212,175,55,0.35)",
                color: power.color,
                background: active ? `${power.color}22` : "rgba(255,255,255,0.02)",
                boxShadow: active ? `0 0 16px ${power.color}80` : "none",
              }}
            >
              <span>{power.icon} {power.name}</span>
              <span className="text-[9px] mt-0.5" style={{ color: "#a89f91" }}>
                {onCooldown ? `${Math.ceil(cooldown / 1000)}s` : `${power.faithCost} faith`}
              </span>
            </button>
          );
        })}
        {(() => {
          // Same button shape and interaction pattern as a God Power
          // above (click to arm, click the battlefield to commit) —
          // one consistent "select then target" interaction for the
          // whole game, not a second, different control scheme just
          // for placement.
          const wardDisabled = hud.faith < WARD_FAITH_COST || hud.wardsCount >= WARD_MAX_COUNT;
          return (
            <button
              onClick={() => {
                if (wardDisabled) return;
                const next = !placingWardRef.current;
                placingWardRef.current = next;
                setPlacingWard(next);
                selectedPowerRef.current = null;
                setSelectedPower(null);
              }}
              disabled={wardDisabled}
              className="font-mono text-[10px] px-4 py-2.5 rounded-md border disabled:opacity-40 flex flex-col items-center transition-all"
              style={{
                borderColor: placingWard ? "#ffd23f" : "rgba(212,175,55,0.35)",
                color: "#ffd23f",
                background: placingWard ? "#ffd23f22" : "rgba(255,255,255,0.02)",
                boxShadow: placingWard ? "0 0 16px #ffd23f80" : "none",
              }}
            >
              <span>◆ Place Ward</span>
              <span className="text-[9px] mt-0.5" style={{ color: "#a89f91" }}>
                {hud.wardsCount >= WARD_MAX_COUNT ? `${WARD_MAX_COUNT}/${WARD_MAX_COUNT} placed` : `${WARD_FAITH_COST} faith`}
              </span>
            </button>
          );
        })()}
      </div>
      <p className="font-mono text-[10px] mt-3" style={{ color: "#a89f91" }}>
        Click a power or Place Ward, then click the battlefield to target it — Ares casts instantly. Click an enemy
        directly to send your Champion to attack it.
      </p>
    </div>
  );
}
