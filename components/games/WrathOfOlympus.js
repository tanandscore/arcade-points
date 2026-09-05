"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { speak } from "@/lib/voice";
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
};

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
  const [hud, setHud] = useState({ templeHp: TEMPLE.maxHp, altarHp: ENEMY_ALTAR.maxHp, faith: 50, wave: 0, enemiesLeft: 0, guardiansLeft: 0, powerCooldowns: {} });
  const [notice, setNotice] = useState("");
  const [storyFlash, setStoryFlash] = useState("");
  const [selectedPower, setSelectedPower] = useState(null);
  const [pendingGodChoice, setPendingGodChoice] = useState(null); // { tierId, label, choices } while awaiting the player's pick
  const [unlockedPowers, setUnlockedPowers] = useState(["zeus", "poseidon", "ares"]);
  const unlockedPowersRef = useRef(["zeus", "poseidon", "ares"]);
  const godTierIndexRef = useRef(0); // how many GOD_TIERS entries have been resolved (chosen or auto-granted)
  const pendingGodChoiceShownRef = useRef(false); // guards against re-triggering the same tier's modal every tick while awaiting the player's pick
  const selectedPowerRef = useRef(null);

  const templeHpRef = useRef(TEMPLE.maxHp);
  const faithRef = useRef(50);
  const waveRef = useRef(0);
  const enemiesRef = useRef([]);
  const altarHpRef = useRef(ENEMY_ALTAR.maxHp);
  const guardiansRef = useRef([]);
  const championsRef = useRef([]);
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
    championsRef.current = [0, 1, 2].map((i) => ({
      id: i,
      x: TEMPLE.x + Math.cos((i / 3) * Math.PI * 2) * 75,
      y: TEMPLE.y + Math.sin((i / 3) * Math.PI * 2) * 75,
      hp: 120,
      maxHp: 120,
      target: null,
      lastAttackAt: 0,
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
    // A real composition curve, not just "more enemies": early waves
    // are almost all Harpies (fast, weak, teach the player to react),
    // Cyclopes phase in from wave 3, Minotaurs — the real threat —
    // only start appearing from wave 6 onward.
    const w = waveRef.current;
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
      slowUntil: 0, alive: true,
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
          templeHpRef.current = Math.max(0, templeHpRef.current - def.damage * DIFFICULTIES[difficultyRef.current].enemyDamageMult * shieldMult);
          spawnParticles(en.x, en.y, "#ff3ea5", 10);
          sfx.hit();
          return false;
        }
        // Champions intercept before reaching the temple — a Champion
        // within its own engage range redirects the enemy's movement
        // toward itself instead of straight at the temple.
        let target = { x: TEMPLE.x, y: TEMPLE.y };
        let nearestChamp = null, nearestChampD = Infinity;
        for (const c of championsRef.current) {
          if (c.hp <= 0) continue;
          const cd = dist(en.x, en.y, c.x, c.y);
          if (cd < 70 && cd < nearestChampD) { nearestChampD = cd; nearestChamp = c; }
        }
        if (nearestChamp) target = nearestChamp;
        const ang = Math.atan2(target.y - en.y, target.x - en.x);
        en.x += Math.cos(ang) * speed;
        en.y += Math.sin(ang) * speed;
        return true;
      });

      // Champion auto-combat
      for (const c of championsRef.current) {
        if (c.hp <= 0) continue;
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
          setTimeout(() => startNextWave(), 3500);
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

      setHud({
        templeHp: Math.round(templeHpRef.current),
        altarHp: Math.round(altarHpRef.current),
        faith: Math.round(faithRef.current),
        wave: waveRef.current,
        enemiesLeft: enemiesRef.current.length,
        guardiansLeft: guardiansRef.current.length,
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
    if (selectedPowerRef.current) {
      castPower(selectedPowerRef.current, x, y);
      selectedPowerRef.current = null;
      setSelectedPower(null);
    }
  }

  function handlePowerButtonClick(powerId) {
    if (phase !== "playing") return;
    if (Date.now() < powerCooldownsRef.current[powerId]) return;
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

      // Enemy altar — the opposing corner's structure, deliberately
      // colder and more ominous than the player's warm marble temple
      // (dark stone, a cold cyan-white flame instead of warm torches)
      // so the two "sides" read as visually distinct at a glance.
      const altarPct = Math.max(0, altarHpRef.current / (ENEMY_ALTAR.maxHp * DIFFICULTIES[difficultyRef.current].altarHpMult));
      const aW = ENEMY_ALTAR.r * 2;
      const aH = ENEMY_ALTAR.r * 1.2;
      ctx.fillStyle = "#241a2e";
      ctx.fillRect(ENEMY_ALTAR.x - aW / 2, ENEMY_ALTAR.y - aH * 0.15, aW, aH * 0.3);
      ctx.fillStyle = "#3a2a48";
      for (let i = 0; i < 4; i++) {
        const cx = ENEMY_ALTAR.x - aW / 2 + (aW / 3) * i;
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
      // enemy archetype.
      for (const g of guardiansRef.current) {
        if (g.hp <= 0) continue;
        ctx.fillStyle = "#b45cff";
        ctx.beginPath();
        ctx.arc(g.x, g.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(180,92,255,0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(g.x, g.y, 13, 0, Math.PI * 2);
        ctx.stroke();
        const barW = 22;
        ctx.fillStyle = "#000";
        ctx.fillRect(g.x - barW / 2, g.y - 20, barW, 3);
        ctx.fillStyle = "#b45cff";
        ctx.fillRect(g.x - barW / 2, g.y - 20, barW * Math.max(0, g.hp / g.maxHp), 3);
      }

      // Champions
      for (const c of championsRef.current) {
        if (c.hp <= 0) continue;
        ctx.fillStyle = Date.now() < furyUntilRef.current ? "#ff5a3c" : "#3ee6e0";
        ctx.beginPath();
        ctx.arc(c.x, c.y, 9, 0, Math.PI * 2);
        ctx.fill();
      }

      // Enemies
      for (const en of enemiesRef.current) {
        const def = ENEMY_TYPES[en.typeId];
        const slowed = Date.now() < en.slowUntil;
        if (en.typeId === "minotaur") {
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
          Your Champions fight on their own — your job is choosing where and when to strike with divine power.
          Your temple stands in one corner of the map, the enemy's altar in the other. Survive {TOTAL_WAVES} escalating
          waves, or fight through their guardians and bring the altar down yourself.
        </p>
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
      </div>
      <p className="font-mono text-[10px] mt-3" style={{ color: "#a89f91" }}>Click a power, then click the battlefield to target it — Ares casts instantly.</p>
    </div>
  );
}
