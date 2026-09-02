"use client";

import { useEffect, useRef, useState } from "react";
import { sfx, playMapIntro } from "@/lib/sound";
import { speak, speakRandom } from "@/lib/voice";
import { haptics } from "@/lib/haptics";

const MAP_W = 700;
const MAP_H = 480;
const TICK_MS = 33;
const TOTAL_ROUNDS = 10; // a fixed 10-round match, not "first to N" — sides swap automatically at round 6, see roundNumberRef/playerSideRef
const ROUND_SECONDS = 55;
const BOMB_TIMER_SECONDS = 20;
const PLANT_HOLD_MS = 2600;
const DEFUSE_HOLD_MS = 4200;
const PLAYER_SPEED = 2.4;
const BOT_SPEED = 1.7;
const BULLET_STEP = 5;
const BULLET_RANGE = 560;

const MAPS = [
  {
    // BLACKSITE ALPHA — abandoned jungle research facility. Balanced
    // playstyle: a mid jungle clearing (Satellite Crash Site) gives
    // long sightlines across the map's open center, while the routes
    // hugging each site (Research Core, Temple Excavation) tighten
    // into short-range corridors — the same round genuinely rewards
    // both a rifle holding mid and a close-range push through the
    // temple ruins. Landmarks: Satellite Crash Site (mid), Research
    // Core (site A), Temple Excavation (site B), River Crossing (the
    // corridor linking both flanks).
    id: "blacksite_alpha",
    name: "Blacksite Alpha",
    walls: [
      { x: 0, y: 0, w: MAP_W, h: 14 }, { x: 0, y: MAP_H - 14, w: MAP_W, h: 14 },
      { x: 0, y: 0, w: 14, h: MAP_H }, { x: MAP_W - 14, y: 0, w: 14, h: MAP_H },
      { x: 180, y: 60, w: 22, h: 140 },
      { x: 500, y: 280, w: 22, h: 140 },
      { x: 80, y: 260, w: 140, h: 22 },
      { x: 480, y: 120, w: 140, h: 22 },
      { x: 320, y: 200, w: 60, h: 60 },
      { x: 260, y: 360, w: 24, h: 80 },
      { x: 420, y: 40, w: 24, h: 80 },
    ],
    floorColor: "#1a2318", gridColor: "rgba(120,200,110,0.07)", weather: "rain",
    siteA: { x: 600, y: 90, r: 48 }, siteB: { x: 100, y: 410, r: 48 },
    playerSpawn: { x: 60, y: 60 },
    botSpawns: [{ x: 655, y: 165 }, { x: 250, y: 300 }, { x: 140, y: 370 }],
  },
  {
    // TEMPEST HARBOR — abandoned ocean megaport in a storm. Two
    // container-maze clusters (Container Maze) create tight,
    // close-quarters flanking routes around both sites (Main Dock,
    // Cargo Processing Facility), rewarding fast, aggressive
    // rotations over holding a single angle — nowhere on this map is
    // a long sightline the dominant strategy.
    id: "tempest_harbor",
    name: "Tempest Harbor",
    walls: [
      { x: 0, y: 0, w: MAP_W, h: 14 }, { x: 0, y: MAP_H - 14, w: MAP_W, h: 14 },
      { x: 0, y: 0, w: 14, h: MAP_H }, { x: MAP_W - 14, y: 0, w: 14, h: MAP_H },
      { x: 150, y: 100, w: 26, h: 26 }, { x: 220, y: 100, w: 26, h: 26 }, { x: 150, y: 170, w: 26, h: 26 }, { x: 220, y: 170, w: 26, h: 26 },
      { x: 450, y: 280, w: 26, h: 26 }, { x: 520, y: 280, w: 26, h: 26 }, { x: 450, y: 350, w: 26, h: 26 }, { x: 520, y: 350, w: 26, h: 26 },
      { x: 320, y: 40, w: 22, h: 110 },
      { x: 340, y: 330, w: 22, h: 110 },
      { x: 100, y: 300, w: 120, h: 22 },
      { x: 480, y: 130, w: 120, h: 22 },
    ],
    floorColor: "#131b26", gridColor: "rgba(120,180,220,0.07)", weather: "storm",
    siteA: { x: 610, y: 90, r: 46 }, siteB: { x: 90, y: 400, r: 46 },
    playerSpawn: { x: 50, y: 60 },
    botSpawns: [{ x: 640, y: 140 }, { x: 360, y: 240 }, { x: 130, y: 350 }],
  },
  {
    // ASHFALL RESEARCH — volcanic research complex. Two long,
    // reactor-adjacent corridors (Reactor Chamber, Command Center)
    // run nearly the full length of the map with minimal cover — the
    // highest-risk map of the three, where holding a long sightline
    // is genuinely dominant and a bad peek is punished hard. The
    // central Lava Bridge chokepoint is the one place both teams are
    // forced to contest at close range.
    id: "ashfall_research",
    name: "Ashfall Research",
    walls: [
      { x: 0, y: 0, w: MAP_W, h: 14 }, { x: 0, y: MAP_H - 14, w: MAP_W, h: 14 },
      { x: 0, y: 0, w: 14, h: MAP_H }, { x: MAP_W - 14, y: 0, w: 14, h: MAP_H },
      { x: 200, y: 0, w: 22, h: 200 },
      { x: 480, y: 280, w: 22, h: 200 },
      { x: 320, y: 220, w: 60, h: 22 },
      { x: 100, y: 340, w: 100, h: 22 },
      { x: 440, y: 100, w: 90, h: 22 },
    ],
    floorColor: "#22120f", gridColor: "rgba(255,120,60,0.08)", weather: "ash",
    siteA: { x: 630, y: 90, r: 48 }, siteB: { x: 90, y: 410, r: 48 },
    playerSpawn: { x: 60, y: 240 },
    botSpawns: [{ x: 650, y: 150 }, { x: 360, y: 90 }, { x: 150, y: 420 }],
  },
];

const WEAPONS = {
  // heatRate: how fast sustained fire builds spread/recoil — higher
  // means it gets harder to control faster. recoilDrift: a small,
  // CONSISTENT per-weapon directional pull that grows with heat —
  // unlike random spread, this is genuinely learnable: compensate by
  // aiming slightly the opposite way while spraying, the same
  // "control the pattern" skill real recoil systems reward.
  //
  // side: "both" | "terrorist" | "police" — real, mechanically
  // distinct loadouts per side (not a reskin): terrorists get the
  // cheaper, more aggressive SMG and the harder-recoiling rifle;
  // police get a steadier SMG and a more controlled rifle, mirroring
  // how real tactical shooters differentiate T/CT weapon picks
  // without inventing whole new weapon categories.
  pistol: { name: "Viper Pistol", damage: 24, fireRate: 340, spread: 0.05, mag: 12, reload: 1100, price: 0, tracer: "#ffe14d", heatRate: 0.1, recoilDrift: 0.015, side: "both" },
  smg: { name: "Reaper SMG", damage: 16, fireRate: 95, spread: 0.1, mag: 30, reload: 1500, price: 900, tracer: "#3ee6e0", heatRate: 0.22, recoilDrift: -0.045, side: "terrorist" },
  rifle: { name: "Phantom Rifle", damage: 32, fireRate: 150, spread: 0.055, mag: 25, reload: 1800, price: 2200, tracer: "#ff3ea5", heatRate: 0.16, recoilDrift: 0.035, side: "terrorist" },
  smgPolice: { name: "Sentinel SMG", damage: 15, fireRate: 100, spread: 0.085, mag: 30, reload: 1450, price: 950, tracer: "#3ea8ff", heatRate: 0.18, recoilDrift: 0.04, side: "police" },
  riflePolice: { name: "Warden Rifle", damage: 30, fireRate: 155, spread: 0.045, mag: 28, reload: 1750, price: 2300, tracer: "#3ea8ff", heatRate: 0.14, recoilDrift: -0.03, side: "police" },
};
// Real, distinct color identity per side — used for the player,
// teammates, and enemy bots alike, whichever side each currently is.
const SIDE_COLORS = {
  terrorist: { body: "#8a1f2b", accent: "#ff5a3c", label: "TERRORIST" },
  police: { body: "#1f4a8a", accent: "#3ea8ff", label: "POLICE" },
};
const ARMOR_PRICE = 650;
const ARMOR_REDUCTION = 0.4;

// Three AI tiers — bots get tankier, hit harder, react faster, and
// engage from further away as difficulty rises. Score multiplier
// rewards choosing the harder fight, matching the same pattern
// already proven in Titan Arena.
const DIFFICULTIES = {
  recruit: { label: "RECRUIT", hpMult: 0.75, damageMult: 0.8, fireRateMs: 550, engageRange: 210, scoreMult: 1 },
  veteran: { label: "VETERAN", hpMult: 1, damageMult: 1, fireRateMs: 420, engageRange: 260, scoreMult: 1.4 },
  elite: { label: "ELITE", hpMult: 1.35, damageMult: 1.25, fireRateMs: 320, engageRange: 320, scoreMult: 1.9 },
};

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

// Randomizes the round's actual starting position around each map's
// original fixed playerSpawn point, rather than using that exact
// same coordinate every single time — this is what makes "starting
// point should not be the same each time" genuinely true, not just
// cosmetic. Validated against the map's real wall layout (same 10px
// margin the game's own movement collision already uses) so a
// candidate point can never land inside geometry, and kept a minimum
// distance from every bot spawn so round start doesn't turn into an
// instant point-blank ambush.
function pointBlockedByWalls(x, y, walls, margin = 10) {
  return walls.some((w) => x > w.x - margin && x < w.x + w.w + margin && y > w.y - margin && y < w.y + w.h + margin);
}

function pickSafeSpawnPoint(base, walls, avoidPoints = [], jitterRadius = 70, minAvoidDist = 140) {
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * jitterRadius;
    const x = Math.min(MAP_W - 24, Math.max(24, base.x + Math.cos(angle) * r));
    const y = Math.min(MAP_H - 24, Math.max(24, base.y + Math.sin(angle) * r));
    if (pointBlockedByWalls(x, y, walls)) continue;
    if (avoidPoints.some((p) => dist(x, y, p.x, p.y) < minAvoidDist)) continue;
    return { x, y };
  }
  return base; // 20 failed attempts is a defensive fallback, not an expected path — the original point is always known-safe
}

function segmentHitsWall(x0, y0, angle, maxDist, walls) {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let d = 0; d <= maxDist; d += BULLET_STEP) {
    const px = x0 + dx * d;
    const py = y0 + dy * d;
    for (const w of walls) {
      if (px >= w.x && px <= w.x + w.w && py >= w.y && py <= w.y + w.h) {
        return { x: px, y: py, dist: d };
      }
    }
  }
  return null;
}

export default function OperationBlacksite({ onFinish, accentColor }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [deviceOk, setDeviceOk] = useState(null);
  const [phase, setPhase] = useState("menu");
  const [difficulty, setDifficulty] = useState("veteran");
  const [difficultyBests, setDifficultyBests] = useState({});
  const [mapId, setMapId] = useState("blacksite_alpha");
  const [hud, setHud] = useState({ hp: 100, armor: 0, money: 800, ammo: 12, reserve: 36, roundsWon: 0, roundsLost: 0, roundTime: ROUND_SECONDS, bombTimer: null, teammatesAlive: 2 });
  const [buyState, setBuyState] = useState({ weapon: "pistol", armor: false, money: 800 });
  const [roundMsg, setRoundMsg] = useState("");
  const [sideSwapAnnounce, setSideSwapAnnounce] = useState(false);
  const [outcome, setOutcome] = useState(null);

  const playerRef = useRef({ x: 60, y: 60, aim: 0, hp: 100, armor: 0, weapon: "pistol", ammo: 12, reserve: 36, reloadingUntil: 0, lastShotAt: 0, heat: 0, alive: true, planting: false, plantStart: 0, defusing: false, defuseStart: 0 });
  const moveInputRef = useRef({ x: 0, y: 0 });
  const mouseRef = useRef({ x: 400, y: 240 });
  const firingRef = useRef(false);
  const adsRef = useRef(false);
  const walkingSilentRef = useRef(false);
  const plantKeyRef = useRef(false);

  const botsRef = useRef([]);
  const teammatesRef = useRef([]);
  const bulletTracersRef = useRef([]);
  const muzzleFlashesRef = useRef([]);
  const particlesRef = useRef([]);
  const ambientParticlesRef = useRef([]);
  const lightningRef = useRef(0);
  const floatTextRef = useRef([]);
  const bombRef = useRef({ planted: false, x: 0, y: 0, timer: 0 });
  const moneyRef = useRef(800);
  const roundsWonRef = useRef(0);
  const roundsLostRef = useRef(0);
  const roundNumberRef = useRef(1);
  // Rounds 1-5 the player's side is terrorist (plant, can't defuse);
  // rounds 6-10 it automatically swaps to police (defuse, can't
  // plant) — this is the single source of truth every plant/defuse
  // gate, weapon list, bot behavior, and render color reads from.
  const playerSideRef = useRef("terrorist");
  const plantingBotIdRef = useRef(null); // which bot is the designated planter this round, only set on police (defense) rounds
  const roundTimeRef = useRef(ROUND_SECONDS);
  const damageFlashRef = useRef(0);
  const shakeRef = useRef(0);

  const simIntervalRef = useRef(null);
  const frameRef = useRef(null);
  const finishedMatchRef = useRef(false);
  const difficultyRef = useRef("veteran");
  const mapRef = useRef(MAPS[0]);

  useEffect(() => {
    const isTouchPrimary = window.matchMedia("(pointer: coarse)").matches;
    const isSmall = window.innerWidth < 1024;
    setDeviceOk(!isTouchPrimary && !isSmall);
  }, []);

  useEffect(() => {
    fetch("/api/difficulty-scores?game=operationblacksite")
      .then((r) => r.json())
      .then((d) => setDifficultyBests(d.bests || {}))
      .catch(() => {});
  }, []);

  function spawnParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.7 + Math.random() * 1.6;
      particlesRef.current.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color });
    }
  }
  function spawnFloatText(x, y, text, color) {
    floatTextRef.current.push({ x, y, text, color, life: 1 });
  }

  function resetForRound() {
    const map = mapRef.current;
    const spawn = pickSafeSpawnPoint(map.playerSpawn, map.walls, map.botSpawns);
    playerRef.current = { x: spawn.x, y: spawn.y, aim: 0, hp: 100, armor: buyState.armor ? 1 : 0, weapon: buyState.weapon, ammo: WEAPONS[buyState.weapon].mag, reserve: WEAPONS[buyState.weapon].mag * 3, reloadingUntil: 0, lastShotAt: 0, heat: 0, alive: true, planting: false, plantStart: 0, defusing: false, defuseStart: 0 };
    botsRef.current = map.botSpawns.map((s, i) => ({ id: i, x: s.x, y: s.y, hp: Math.round(80 * DIFFICULTIES[difficultyRef.current].hpMult), state: "patrol", patrolTarget: { x: s.x + (Math.random() - 0.5) * 80, y: s.y + (Math.random() - 0.5) * 80 }, aim: 0, alertUntil: 0, lastShotAt: 0, alive: true }));
    // On a police round (bots are terrorists), one randomly-picked
    // bot is assigned to actually go plant — the others keep their
    // normal engage/patrol/search behavior, which naturally covers
    // the planter rather than needing full squad coordination logic.
    if (playerSideRef.current === "police") {
      const planterIdx = Math.floor(Math.random() * botsRef.current.length);
      plantingBotIdRef.current = botsRef.current[planterIdx].id;
      botsRef.current[planterIdx].plantTarget = Math.random() < 0.5 ? map.siteA : map.siteB;
    } else {
      plantingBotIdRef.current = null;
    }
    // 3v3 by default: you plus two AI teammates against three AI
    // defenders. Real networked human teammates would need dedicated
    // realtime infrastructure this site doesn't have yet — these two
    // slots are always AI-filled for now, which is the same "AI
    // fills empty seats" idea competitive shooters use when a queue
    // comes up short, just applied from the start rather than as a
    // fallback.
    teammatesRef.current = [0, 1].map((i) => ({
      id: `mate-${i}`,
      x: spawn.x + (i === 0 ? -26 : 26),
      y: spawn.y + 18,
      hp: 100,
      aim: 0,
      state: "advance",
      lastShotAt: 0,
      alive: true,
      calledStick: false,
    }));
    bombRef.current = { planted: false, x: 0, y: 0, timer: 0 };
    roundTimeRef.current = ROUND_SECONDS;
    bulletTracersRef.current = [];
    muzzleFlashesRef.current = [];
    ambientParticlesRef.current = [];
    lightningRef.current = 0;
    particlesRef.current = [];
    floatTextRef.current = [];
  }

  function playRoundIntro() {
    playMapIntro(mapRef.current.id);
    setTimeout(() => speakRandom(["Stick together, team.", "Moving up together.", "Eyes open, let's go."]), 900);
  }

  function startMatch() {
    const el = wrapRef.current?.ownerDocument?.documentElement;
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    difficultyRef.current = difficulty;
    mapRef.current = MAPS.find((m) => m.id === mapId) || MAPS[0];
    moneyRef.current = 800;
    roundsWonRef.current = 0;
    roundsLostRef.current = 0;
    roundNumberRef.current = 1;
    playerSideRef.current = "terrorist";
    finishedMatchRef.current = false;
    setBuyState({ weapon: "pistol", armor: false, money: 800 });
    openBuyPhase();
  }

  function openBuyPhase() {
    setPhase("buy");
    setBuyState((b) => {
      // If the side just swapped, whatever weapon was selected last
      // round might not be legal for the new side (a terrorist SMG
      // carried into a police round, say) — falls back to the
      // shared pistol rather than silently keeping an invalid pick
      // the buy menu no longer even shows as selectable.
      const stillValid = WEAPONS[b.weapon] && (WEAPONS[b.weapon].side === "both" || WEAPONS[b.weapon].side === playerSideRef.current);
      return { ...b, money: moneyRef.current, weapon: stillValid ? b.weapon : "pistol" };
    });
  }

  function confirmBuyAndStart() {
    let cost = 0;
    if (buyState.weapon !== "pistol") cost += WEAPONS[buyState.weapon].price;
    if (buyState.armor) cost += ARMOR_PRICE;
    moneyRef.current = Math.max(0, moneyRef.current - cost);
    resetForRound();
    setPhase("round");
    setRoundMsg("");
    playRoundIntro();
    runRoundLoop();
  }

  function endRound(playerWon, reason) {
    clearInterval(simIntervalRef.current);
    if (playerWon) {
      roundsWonRef.current += 1;
      moneyRef.current += 2400;
      setRoundMsg(`ROUND WON — ${reason}`);
      sfx.newBest();
    } else {
      roundsLostRef.current += 1;
      moneyRef.current += 1400;
      setRoundMsg(`ROUND LOST — ${reason}`);
      sfx.lose();
    }
    setPhase("roundend");
    setHud((h) => ({ ...h, roundsWon: roundsWonRef.current, roundsLost: roundsLostRef.current }));

    roundNumberRef.current += 1;
    const newSide = roundNumberRef.current <= 5 ? "terrorist" : "police";
    const sideJustSwapped = newSide !== playerSideRef.current;
    playerSideRef.current = newSide;

    setTimeout(() => {
      if (roundsWonRef.current + roundsLostRef.current >= TOTAL_ROUNDS) {
        finishMatch(roundsWonRef.current > roundsLostRef.current);
      } else {
        if (sideJustSwapped) {
          setSideSwapAnnounce(true);
          setTimeout(() => setSideSwapAnnounce(false), 2600);
        }
        openBuyPhase();
      }
    }, 2200);
  }

  function finishMatch(won) {
    if (finishedMatchRef.current) return;
    finishedMatchRef.current = true;
    setOutcome(won ? "victory" : "defeat");
    setPhase("over");
    const diff = DIFFICULTIES[difficultyRef.current];
    const score = Math.round((roundsWonRef.current * 150 + Math.round(moneyRef.current / 20)) * diff.scoreMult);
    fetch("/api/difficulty-scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game: "operationblacksite", difficulty: difficultyRef.current, score }),
    }).catch(() => {});
    setTimeout(() => onFinish(Math.max(0, score)), 1500);
  }

  function tryFire(now) {
    const p = playerRef.current;
    if (!p.alive || p.ammo <= 0 || now < p.reloadingUntil) return;
    const def = WEAPONS[p.weapon];
    if (now - p.lastShotAt < def.fireRate) return;
    p.lastShotAt = now;
    p.ammo -= 1;
    // A perfectly accurate first shot after a real pause — the "tap
    // firing" skill reward the spec asked for. Anything after that
    // builds heat as before, now at a per-weapon rate, plus a small
    // consistent directional drift (recoilDrift) that grows with
    // heat — a real, learnable pattern rather than pure randomness.
    const isFirstShot = p.heat < 0.05;
    p.heat = Math.min(1, p.heat + def.heatRate);
    const recoilOffset = def.recoilDrift * p.heat;
    const randomSpread = isFirstShot ? 0 : def.spread * (adsRef.current ? 0.4 : 1) + p.heat * 0.12;
    const angle = p.aim + recoilOffset + (Math.random() - 0.5) * randomSpread;
    muzzleFlashesRef.current.push({ x: p.x, y: p.y, angle, life: 1 });
    sfx.hit();
    haptics.tap();

    let closestHit = segmentHitsWall(p.x, p.y, angle, BULLET_RANGE, mapRef.current.walls);
    let closestDist = closestHit ? closestHit.dist : BULLET_RANGE;
    let hitBot = null;
    for (const b of botsRef.current) {
      if (!b.alive) continue;
      const dx = Math.cos(angle), dy = Math.sin(angle);
      for (let d = 0; d < closestDist; d += BULLET_STEP) {
        const px = p.x + dx * d, py = p.y + dy * d;
        if (dist(px, py, b.x, b.y) < 12) {
          closestDist = d;
          hitBot = b;
          break;
        }
      }
    }
    const endX = p.x + Math.cos(angle) * closestDist;
    const endY = p.y + Math.sin(angle) * closestDist;
    bulletTracersRef.current.push({ x0: p.x, y0: p.y, x1: endX, y1: endY, color: def.tracer, life: 1 });

    if (hitBot) {
      const headshot = Math.random() < 0.16;
      const dmg = Math.round(def.damage * (headshot ? 2.5 : 1));
      hitBot.hp -= dmg;
      hitBot.state = "engage";
      hitBot.alertUntil = now + 4000;
      spawnParticles(endX, endY, "#ff3ea5", headshot ? 14 : 8);
      spawnFloatText(endX, endY - 10, headshot ? `${dmg} HEADSHOT` : `-${dmg}`, headshot ? "#ffb703" : "#ffe14d");
      if (hitBot.hp <= 0) {
        hitBot.alive = false;
        spawnParticles(hitBot.x, hitBot.y, "#ff3ea5", 16);
        moneyRef.current += 300;
      }
    } else if (closestHit) {
      spawnParticles(closestHit.x, closestHit.y, "#e8e2d6", 5);
    }
  }

  function tryReload(now) {
    const p = playerRef.current;
    const def = WEAPONS[p.weapon];
    if (now < p.reloadingUntil || p.ammo >= def.mag || p.reserve <= 0) return;
    p.reloadingUntil = now + def.reload;
    sfx.select();
  }

  function nearestAliveAttacker(x, y) {
    const p = playerRef.current;
    const candidates = [];
    if (p.alive) candidates.push({ x: p.x, y: p.y, obj: p, kind: "player" });
    for (const t of teammatesRef.current) {
      if (t.alive) candidates.push({ x: t.x, y: t.y, obj: t, kind: "teammate" });
    }
    let best = null, bestD = Infinity;
    for (const c of candidates) {
      const d = dist(x, y, c.x, c.y);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best ? { ...best, dist: bestD } : null;
  }

  function botAI(b, now) {
    if (!b.alive) return;
    const diff = DIFFICULTIES[difficultyRef.current];
    const nearest = nearestAliveAttacker(b.x, b.y);
    const canSeeTarget = nearest && nearest.dist < diff.engageRange && !walkingSilentRef.current;

    // Real, once-per-drop decision (not re-rolled every frame, which
    // would look like flickering indecision) — a critically hurt bot
    // has a genuine chance to break off and create distance instead
    // of fighting to the death, but not a guarantee: "bots retreat
    // when injured" alongside "perfect AI feels fake" from the same
    // brief means some should still push through low health anyway.
    if (b.hp > 0 && b.hp < 25 && b.retreatDecided == null) {
      b.retreatDecided = Math.random() < 0.55;
    }
    if (b.hp >= 40) b.retreatDecided = null; // shouldn't happen without healing, but resets cleanly if it ever does

    if (b.state === "retreat" && now > (b.retreatUntil || 0)) {
      b.state = null; // falls through to normal re-evaluation below
    }

    if (canSeeTarget && b.retreatDecided && b.hp < 25 && b.state !== "retreat" && now > (b.retreatCooldownUntil || 0)) {
      b.state = "retreat";
      b.retreatUntil = now + 1800;
      b.retreatCooldownUntil = now + 6000; // won't re-trigger every single frame it's still hurt
    } else if (b.state === "retreat") {
      // keep retreating — handled below, don't let the normal
      // engage/patrol logic override it mid-retreat
    } else if (canSeeTarget) {
      b.state = "engage";
      b.alertUntil = now + 3000;
      b.engageTarget = nearest;
    } else if (playerSideRef.current === "police" && !bombRef.current.planted && b.id === plantingBotIdRef.current) {
      b.state = "plant";
    } else if (bombRef.current.planted) {
      // "rush to defuse" only makes sense when the bots are police
      // (defending the PLAYER's plant). On a police round the bots
      // ARE the terrorists — once one of them plants, the others
      // need to guard that plant, not run over and "defuse" their
      // own team's bomb, which was happening before this fix and
      // could incorrectly end the round as if the enemy had defused.
      b.state = playerSideRef.current === "terrorist" ? "rush" : "guard";
    } else if (now < b.alertUntil) {
      b.state = "search";
    } else if (b.state !== "engage") {
      b.state = "patrol";
    }

    if (b.state === "plant") {
      const site = b.plantTarget || mapRef.current.siteA;
      const d = dist(b.x, b.y, site.x, site.y);
      if (d > 8) {
        const ang = Math.atan2(site.y - b.y, site.x - b.x);
        b.x += Math.cos(ang) * BOT_SPEED;
        b.y += Math.sin(ang) * BOT_SPEED;
        b.aim = ang;
        b.plantHoldStart = null; // moved away or got interrupted — hold resets, matching the player's own plant logic
      } else {
        if (!b.plantHoldStart) {
          b.plantHoldStart = now;
          speak("Enemy planting the bomb!", { priority: "high" });
        }
        if (now - b.plantHoldStart > PLANT_HOLD_MS) {
          bombRef.current = { planted: true, x: site.x, y: site.y, timer: BOMB_TIMER_SECONDS };
          setRoundMsg("BOMB PLANTED");
          speakRandom(["Bomb has been planted.", "Fire in the hole!", "Bomb's set — fall back!"], { priority: "high" });
          sfx.levelUp();
        }
      }
      return;
    }

    if (b.state === "retreat") {
      const threat = b.engageTarget && b.engageTarget.obj.alive ? b.engageTarget : nearest;
      if (threat) {
        const away = Math.atan2(b.y - threat.y, b.x - threat.x);
        b.x += Math.cos(away) * BOT_SPEED * 1.15;
        b.y += Math.sin(away) * BOT_SPEED * 1.15;
        b.aim = away + Math.PI; // still faces the threat while backing away, not literally running blind
      }
      return;
    }

    if (b.state === "engage" && b.engageTarget && b.engageTarget.obj.alive) {
      const t = b.engageTarget;
      const td = dist(b.x, b.y, t.x, t.y);
      b.aim = Math.atan2(t.y - b.y, t.x - b.x);
      if (now - b.lastShotAt > diff.fireRateMs + Math.random() * 250) {
        b.lastShotAt = now;
        const spread = 0.09;
        const angle = b.aim + (Math.random() - 0.5) * spread;
        const hitObstruction = segmentHitsWall(b.x, b.y, angle, td + 4, mapRef.current.walls);
        if (!hitObstruction) {
          const armorMult = t.kind === "player" && t.obj.armor ? ARMOR_REDUCTION : 0;
          const dmg = Math.round(14 * diff.damageMult * (1 - armorMult));
          t.obj.hp = Math.max(0, t.obj.hp - dmg);
          spawnParticles(t.x, t.y, "#ff3ea5", 6);
          bulletTracersRef.current.push({ x0: b.x, y0: b.y, x1: t.x, y1: t.y, color: "#ff5a3c", life: 1 });
          if (t.kind === "player") {
            damageFlashRef.current = 1;
            shakeRef.current = 0.5;
            haptics.tap();
          } else if (t.obj.hp <= 0 && t.obj.alive) {
            t.obj.alive = false;
            spawnFloatText(t.x, t.y - 20, "TEAMMATE DOWN", "#ff3ea5");
            speakRandom(["Man down!", "I'm hit, going down!", "Teammate's down!"]);
          }
        }
      }
      if (td < 90) {
        b.x -= Math.cos(b.aim) * BOT_SPEED * 0.6;
        b.y -= Math.sin(b.aim) * BOT_SPEED * 0.6;
      }
    } else if (b.state === "rush") {
      const bomb = bombRef.current;
      const d = dist(b.x, b.y, bomb.x, bomb.y);
      if (d > 20) {
        const ang = Math.atan2(bomb.y - b.y, bomb.x - b.x);
        b.x += Math.cos(ang) * BOT_SPEED;
        b.y += Math.sin(ang) * BOT_SPEED;
        b.aim = ang;
      } else {
        if (!b.defusing) speak("Enemy defusing the bomb!");
        b.defusing = true;
      }
    } else if (b.state === "guard") {
      // Holds near its own team's plant rather than "defusing" it —
      // moves into a defensive ring around the bomb and stops, still
      // able to fight anyone who approaches via the normal engage
      // check above.
      const bomb = bombRef.current;
      const d = dist(b.x, b.y, bomb.x, bomb.y);
      if (d > 50) {
        const ang = Math.atan2(bomb.y - b.y, bomb.x - b.x);
        b.x += Math.cos(ang) * BOT_SPEED;
        b.y += Math.sin(ang) * BOT_SPEED;
        b.aim = ang;
      }
    } else if (b.state === "search") {
      const target = nearestAliveAttacker(b.x, b.y) || { x: playerRef.current.x, y: playerRef.current.y };
      const ang = Math.atan2(target.y - b.y, target.x - b.x);
      b.x += Math.cos(ang) * BOT_SPEED * 0.7;
      b.y += Math.sin(ang) * BOT_SPEED * 0.7;
      b.aim = ang;
    } else {
      const d = dist(b.x, b.y, b.patrolTarget.x, b.patrolTarget.y);
      if (d < 8) {
        b.patrolTarget = { x: b.x + (Math.random() - 0.5) * 120, y: b.y + (Math.random() - 0.5) * 120 };
      } else {
        const ang = Math.atan2(b.patrolTarget.y - b.y, b.patrolTarget.x - b.x);
        b.x += Math.cos(ang) * BOT_SPEED * 0.5;
        b.y += Math.sin(ang) * BOT_SPEED * 0.5;
        b.aim = ang;
      }
    }
    b.x = Math.max(20, Math.min(MAP_W - 20, b.x));
    b.y = Math.max(20, Math.min(MAP_H - 20, b.y));
  }

  // Teammates advance toward the objective, engage any enemy they
  // can see, and lean back toward the player if they've drifted far
  // — a simple version of "stick together" rather than a full squad
  // formation system.
  function teammateAI(now, p) {
    const map = mapRef.current;
    const nearestSite = (x, y) => {
      const dA = dist(x, y, map.siteA.x, map.siteA.y);
      const dB = dist(x, y, map.siteB.x, map.siteB.y);
      return dA < dB ? map.siteA : map.siteB;
    };
    for (const t of teammatesRef.current) {
      if (!t.alive) continue;
      const enemies = botsRef.current.filter((b) => b.alive);
      let nearestEnemy = null, bestD = Infinity;
      for (const e of enemies) {
        const d = dist(t.x, t.y, e.x, e.y);
        if (d < bestD) { bestD = d; nearestEnemy = e; }
      }
      const canEngage = nearestEnemy && bestD < 240;

      if (canEngage) {
        t.aim = Math.atan2(nearestEnemy.y - t.y, nearestEnemy.x - t.x);
        if (now - t.lastShotAt > 480 + Math.random() * 260) {
          t.lastShotAt = now;
          const angle = t.aim + (Math.random() - 0.5) * 0.09;
          const hitObstruction = segmentHitsWall(t.x, t.y, angle, bestD + 4, map.walls);
          if (!hitObstruction) {
            const dmg = Math.round(13 + Math.random() * 4);
            nearestEnemy.hp -= dmg;
            spawnParticles(nearestEnemy.x, nearestEnemy.y, "#ffe14d", 6);
            bulletTracersRef.current.push({ x0: t.x, y0: t.y, x1: nearestEnemy.x, y1: nearestEnemy.y, color: "#3ee6e0", life: 1 });
            if (nearestEnemy.hp <= 0 && nearestEnemy.alive) {
              nearestEnemy.alive = false;
              spawnParticles(nearestEnemy.x, nearestEnemy.y, "#ff3ea5", 12);
              moneyRef.current += 150;
            }
          }
        }
        if (bestD < 100) {
          t.x -= Math.cos(t.aim) * BOT_SPEED * 0.5;
          t.y -= Math.sin(t.aim) * BOT_SPEED * 0.5;
        } else {
          t.x += Math.cos(t.aim) * BOT_SPEED * 0.4;
          t.y += Math.sin(t.aim) * BOT_SPEED * 0.4;
        }
      } else {
        const dToPlayer = dist(t.x, t.y, p.x, p.y);
        let targetX, targetY;
        if (dToPlayer > 220) {
          // strayed too far — pull back toward the player first
          targetX = p.x;
          targetY = p.y;
        } else {
          const site = bombRef.current.planted
            ? { x: bombRef.current.x, y: bombRef.current.y }
            : nearestSite(t.x, t.y);
          targetX = site.x;
          targetY = site.y;
        }
        const d = dist(t.x, t.y, targetX, targetY);
        if (d > 12) {
          const ang = Math.atan2(targetY - t.y, targetX - t.x);
          t.x += Math.cos(ang) * BOT_SPEED * 0.75;
          t.y += Math.sin(ang) * BOT_SPEED * 0.75;
          t.aim = ang;
        }
      }
      t.x = Math.max(20, Math.min(MAP_W - 20, t.x));
      t.y = Math.max(20, Math.min(MAP_H - 20, t.y));
    }
  }

  function runRoundLoop() {
    simIntervalRef.current = setInterval(() => {
      const p = playerRef.current;
      const now = Date.now();
      roundTimeRef.current -= TICK_MS / 1000;

      if (p.alive) {
        const mv = moveInputRef.current;
        if (mv.x || mv.y) {
          const mag = Math.hypot(mv.x, mv.y) || 1;
          const speed = PLAYER_SPEED * (walkingSilentRef.current ? 0.55 : 1);
          const nx = p.x + (mv.x / mag) * speed;
          const ny = p.y + (mv.y / mag) * speed;
          const blockedX = mapRef.current.walls.some((w) => nx > w.x - 10 && nx < w.x + w.w + 10 && p.y > w.y - 10 && p.y < w.y + w.h + 10);
          const blockedY = mapRef.current.walls.some((w) => p.x > w.x - 10 && p.x < w.x + w.w + 10 && ny > w.y - 10 && ny < w.y + w.h + 10);
          if (!blockedX) p.x = Math.max(20, Math.min(MAP_W - 20, nx));
          if (!blockedY) p.y = Math.max(20, Math.min(MAP_H - 20, ny));
        }
        p.aim = Math.atan2(mouseRef.current.y - p.y, mouseRef.current.x - p.x);
        p.heat = Math.max(0, p.heat - 0.03);

        if (firingRef.current) tryFire(now);

        const nearA = dist(p.x, p.y, mapRef.current.siteA.x, mapRef.current.siteA.y) < mapRef.current.siteA.r;
        const nearB = dist(p.x, p.y, mapRef.current.siteB.x, mapRef.current.siteB.y) < mapRef.current.siteB.r;
        // Gated by side — terrorists can only plant, police can only
        // defuse. This is also the fix for a real bug that predates
        // the side system: the player's own defuse action set state
        // and showed a progress bar, but nothing ever checked for
        // completion, since only the player's team could plant
        // before now, making a player defuse unreachable. It's
        // reachable and necessary now, so it needed a real ending.
        if (playerSideRef.current === "terrorist" && plantKeyRef.current && !bombRef.current.planted && (nearA || nearB)) {
          if (!p.planting) { p.planting = true; p.plantStart = now; }
          if (now - p.plantStart > PLANT_HOLD_MS) {
            const site = nearA ? mapRef.current.siteA : mapRef.current.siteB;
            bombRef.current = { planted: true, x: site.x, y: site.y, timer: BOMB_TIMER_SECONDS };
            p.planting = false;
            sfx.levelUp();
            setRoundMsg("BOMB PLANTED");
            speakRandom(["Bomb has been planted.", "Fire in the hole!", "Bomb's set — fall back!"], { priority: "high" });
          }
        } else {
          p.planting = false;
        }
        if (playerSideRef.current === "police" && plantKeyRef.current && bombRef.current.planted) {
          const dBomb = dist(p.x, p.y, bombRef.current.x, bombRef.current.y);
          if (dBomb < 30) {
            if (!p.defusing) {
              p.defusing = true;
              p.defuseStart = now;
              speak("Defusing.", { priority: "high" });
            }
            if (now - p.defuseStart > DEFUSE_HOLD_MS) {
              p.defusing = false;
              speak("Bomb has been defused.", { priority: "high" });
              endRound(true, "BOMB DEFUSED");
              return;
            }
          } else {
            p.defusing = false;
          }
        } else {
          p.defusing = false;
        }
      }

      // Per-map atmospheric particles — genuinely different weather
      // per map, not the same effect recolored. Deliberately a
      // separate array/lifecycle from combat particles (spawnParticles
      // above), since ambient weather needs continuous, slow-drifting
      // motion rather than a one-shot decaying burst.
      const weather = mapRef.current.weather;
      if (weather === "rain" && Math.random() < 0.5) {
        ambientParticlesRef.current.push({ x: Math.random() * MAP_W, y: -10, vx: -0.6, vy: 7, life: 1, kind: "rain" });
      }
      if (weather === "rain" && Math.random() < 0.0025) {
        lightningRef.current = 1; // rare — this is meant to startle, not flicker constantly
        sfx.lose(); // the closest existing sound to a low rumble; genuine thunder synthesis is out of scope here
      }
      if (weather === "storm") {
        if (Math.random() < 0.7) {
          // Wind-blown, near-horizontal — visually distinct from the
          // jungle map's mostly-vertical rain, matching "storm wind"
          // specifically rather than reusing the same rain effect.
          ambientParticlesRef.current.push({ x: -10, y: Math.random() * MAP_H, vx: 9 + Math.random() * 3, vy: 1.5, life: 1, kind: "storm" });
        }
      }
      if (weather === "ash" && Math.random() < 0.15) {
        ambientParticlesRef.current.push({ x: Math.random() * MAP_W, y: -10, vx: (Math.random() - 0.5) * 0.5, vy: 0.6 + Math.random() * 0.4, life: 1, kind: "ash" });
      }

      for (const b of botsRef.current) botAI(b, now);
      teammateAI(now, p);

      if (bombRef.current.planted) {
        bombRef.current.timer -= TICK_MS / 1000;
        if (bombRef.current.timer <= 0) {
          endRound(true, "BOMB DETONATED");
          return;
        }
        for (const b of botsRef.current) {
          if (b.defusing) {
            b.defuseElapsed = (b.defuseElapsed || 0) + TICK_MS;
            if (b.defuseElapsed > DEFUSE_HOLD_MS) {
              speak("Bomb has been defused.", { priority: "high" });
              endRound(false, "BOMB DEFUSED");
              return;
            }
          }
        }
      }

      bulletTracersRef.current = bulletTracersRef.current.filter((t) => { t.life -= 0.15; return t.life > 0; });
      muzzleFlashesRef.current = muzzleFlashesRef.current.filter((m) => { m.life -= 0.25; return m.life > 0; });
      particlesRef.current = particlesRef.current.filter((pt) => { pt.x += pt.vx; pt.y += pt.vy; pt.life -= 0.05; return pt.life > 0; });
      ambientParticlesRef.current = ambientParticlesRef.current.filter((pt) => {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.life -= 0.012;
        return pt.life > 0 && pt.x > -20 && pt.x < MAP_W + 20 && pt.y < MAP_H + 20;
      });
      lightningRef.current = Math.max(0, lightningRef.current - 0.06);
      floatTextRef.current = floatTextRef.current.filter((ft) => { ft.y -= 0.4; ft.life -= 0.018; return ft.life > 0; });
      damageFlashRef.current = Math.max(0, damageFlashRef.current - 0.06);
      shakeRef.current = Math.max(0, shakeRef.current - 0.05);

      if (p.hp <= 0 && p.alive) {
        p.alive = false;
        endRound(false, "ELIMINATED");
        return;
      }
      const allBotsDead = botsRef.current.every((b) => !b.alive);
      if (allBotsDead) {
        endRound(true, playerSideRef.current === "police" ? "ALL ATTACKERS ELIMINATED" : "ALL DEFENDERS ELIMINATED");
        return;
      }
      if (roundTimeRef.current <= 0 && !bombRef.current.planted) {
        // Side-aware, and a real bug fix, not just wording: on a
        // terrorist round, running out the clock without planting is
        // a loss (the existing behavior). On a police round it's the
        // opposite — successfully running out the clock without
        // letting the enemy plant IS the win condition for defense.
        // Before this fix, defense could never win by holding time.
        endRound(playerSideRef.current === "police", "TIME EXPIRED");
        return;
      }

      setHud({
        hp: Math.round(p.hp),
        armor: p.armor,
        money: moneyRef.current,
        ammo: p.ammo,
        reserve: p.reserve,
        roundsWon: roundsWonRef.current,
        roundsLost: roundsLostRef.current,
        roundTime: Math.max(0, Math.ceil(roundTimeRef.current)),
        bombTimer: bombRef.current.planted ? Math.max(0, Math.ceil(bombRef.current.timer)) : null,
        teammatesAlive: teammatesRef.current.filter((t) => t.alive).length,
      });
    }, TICK_MS);
  }

  useEffect(() => () => clearInterval(simIntervalRef.current), []);

  useEffect(() => {
    if (phase !== "round") return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");

    function render() {
      const shakeX = (Math.random() - 0.5) * shakeRef.current * 8;
      const shakeY = (Math.random() - 0.5) * shakeRef.current * 8;
      ctx.save();
      ctx.translate(shakeX, shakeY);

      ctx.fillStyle = mapRef.current.floorColor || "#151022";
      ctx.fillRect(-10, -10, MAP_W + 20, MAP_H + 20);
      ctx.strokeStyle = mapRef.current.gridColor || "rgba(169,159,214,0.08)";
      for (let gx = 0; gx < MAP_W; gx += 36) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, MAP_H); ctx.stroke(); }
      for (let gy = 0; gy < MAP_H; gy += 36) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(MAP_W, gy); ctx.stroke(); }

      [mapRef.current.siteA, mapRef.current.siteB].forEach((site, i) => {
        ctx.strokeStyle = "rgba(255,183,3,0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(site.x, site.y, site.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "rgba(255,183,3,0.08)";
        ctx.fill();
        ctx.fillStyle = "#ffb703";
        ctx.font = "11px monospace";
        ctx.fillText(i === 0 ? "SITE A" : "SITE B", site.x - 18, site.y - site.r - 8);
      });

      for (const w of mapRef.current.walls) {
        ctx.fillStyle = "#2a2440";
        ctx.fillRect(w.x, w.y, w.w, w.h);
        ctx.fillStyle = "rgba(169,159,214,0.15)";
        ctx.fillRect(w.x, w.y, w.w, 2);
      }

      if (bombRef.current.planted) {
        ctx.save();
        ctx.shadowColor = "#ff3ea5";
        ctx.shadowBlur = 14;
        ctx.fillStyle = "#ff3ea5";
        ctx.beginPath();
        ctx.arc(bombRef.current.x, bombRef.current.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Bots are always the opposite side from the player this round
      // — the actual visual "both teams look different" signal.
      const enemySide = playerSideRef.current === "terrorist" ? "police" : "terrorist";
      for (const b of botsRef.current) {
        if (!b.alive) continue;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.aim);
        ctx.fillStyle = SIDE_COLORS[enemySide].body;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = SIDE_COLORS[enemySide].accent;
        ctx.fillRect(6, -2, 12, 4);
        ctx.restore();
        const barW = 22;
        ctx.fillStyle = "#000";
        ctx.fillRect(b.x - barW / 2, b.y - 22, barW, 3);
        ctx.fillStyle = "#ff3ea5";
        ctx.fillRect(b.x - barW / 2, b.y - 22, barW * (b.hp / 80), 3);
        if (b.defusing) {
          const pct = Math.min(1, (b.defuseElapsed || 0) / DEFUSE_HOLD_MS);
          ctx.strokeStyle = "#ff3ea5";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(b.x, b.y - 34, 9, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "#ff3ea5";
          ctx.font = "8px monospace";
          ctx.textAlign = "center";
          ctx.fillText("DEFUSING", b.x, b.y - 44);
        }
      }

      for (const t of teammatesRef.current) {
        if (!t.alive) continue;
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.rotate(t.aim);
        ctx.fillStyle = SIDE_COLORS[playerSideRef.current].body;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = SIDE_COLORS[playerSideRef.current].accent;
        ctx.fillRect(6, -2, 12, 4);
        ctx.restore();
        const barW = 22;
        ctx.fillStyle = "#000";
        ctx.fillRect(t.x - barW / 2, t.y - 22, barW, 3);
        ctx.fillStyle = SIDE_COLORS[playerSideRef.current].accent;
        ctx.fillRect(t.x - barW / 2, t.y - 22, barW * (t.hp / 100), 3);
      }

      for (const m of muzzleFlashesRef.current) {
        ctx.globalAlpha = m.life;
        ctx.fillStyle = "#ffe14d";
        ctx.beginPath();
        ctx.arc(m.x + Math.cos(m.angle) * 16, m.y + Math.sin(m.angle) * 16, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      for (const t of bulletTracersRef.current) {
        ctx.globalAlpha = t.life;
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(t.x0, t.y0);
        ctx.lineTo(t.x1, t.y1);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      for (const pt of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, pt.life);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - 1.5, pt.y - 1.5, 3, 3);
        ctx.globalAlpha = 1;
      }

      for (const pt of ambientParticlesRef.current) {
        ctx.globalAlpha = Math.max(0, pt.life) * 0.5;
        if (pt.kind === "rain") {
          ctx.strokeStyle = "#9fd0ff";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(pt.x + pt.vx * 1.5, pt.y + pt.vy * 1.5);
          ctx.stroke();
        } else if (pt.kind === "storm") {
          ctx.strokeStyle = "#c8e8ff";
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(pt.x - pt.vx * 1.2, pt.y - pt.vy * 1.2);
          ctx.stroke();
        } else if (pt.kind === "ash") {
          ctx.fillStyle = "#ffb37a";
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 1.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      if (lightningRef.current > 0) {
        ctx.fillStyle = `rgba(255,255,255,${lightningRef.current * 0.35})`;
        ctx.fillRect(0, 0, MAP_W, MAP_H);
      }

      if (mapRef.current.weather === "ash") {
        // Genuine heat-distortion refraction isn't achievable in 2D
        // Canvas without shader-level pixel work — this is an honest
        // approximation: a slow, pulsing warm overlay suggesting heat
        // rather than literally warping the scene.
        const shimmer = 0.05 + Math.sin(Date.now() / 500) * 0.025;
        ctx.fillStyle = `rgba(255,90,40,${shimmer})`;
        ctx.fillRect(0, 0, MAP_W, MAP_H);
      }

      const p = playerRef.current;
      if (p.alive) {
        const grad = ctx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 130);
        grad.addColorStop(0, "rgba(62,230,224,0.10)");
        grad.addColorStop(1, "rgba(62,230,224,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 130, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.aim);
        ctx.fillStyle = SIDE_COLORS[playerSideRef.current].body;
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#e8e2d6";
        ctx.fillRect(6, -2, 14, 4);
        ctx.restore();

        if (p.planting || p.defusing) {
          const elapsed = Date.now() - (p.planting ? p.plantStart : p.defuseStart);
          const need = p.planting ? PLANT_HOLD_MS : DEFUSE_HOLD_MS;
          const pct = Math.min(1, elapsed / need);
          ctx.strokeStyle = "#ffb703";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(p.x, p.y - 24, 10, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
          ctx.stroke();
        }
      }

      for (const ft of floatTextRef.current) {
        ctx.globalAlpha = Math.max(0, ft.life);
        ctx.fillStyle = ft.color;
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 1;
      }

      ctx.restore();

      if (damageFlashRef.current > 0) {
        ctx.fillStyle = `rgba(255,62,165,${damageFlashRef.current * 0.35})`;
        ctx.fillRect(0, 0, MAP_W, MAP_H);
      }
      if (playerRef.current.hp < 30 && playerRef.current.alive) {
        const vg = ctx.createRadialGradient(MAP_W / 2, MAP_H / 2, MAP_H * 0.25, MAP_W / 2, MAP_H / 2, MAP_H * 0.75);
        vg.addColorStop(0, "rgba(255,62,165,0)");
        vg.addColorStop(1, "rgba(255,62,165,0.25)");
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, MAP_W, MAP_H);
      }

      frameRef.current = requestAnimationFrame(render);
    }
    render();
    return () => cancelAnimationFrame(frameRef.current);
  }, [phase, accentColor]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "s", "a", "d", " "].includes(e.key)) e.preventDefault();
      if (e.key === "ArrowLeft" || e.key === "a") moveInputRef.current = { ...moveInputRef.current, x: -1 };
      if (e.key === "ArrowRight" || e.key === "d") moveInputRef.current = { ...moveInputRef.current, x: 1 };
      if (e.key === "ArrowUp" || e.key === "w") moveInputRef.current = { ...moveInputRef.current, y: -1 };
      if (e.key === "ArrowDown" || e.key === "s") moveInputRef.current = { ...moveInputRef.current, y: 1 };
      if (e.key === "Shift") walkingSilentRef.current = true;
      if (e.key === "r") tryReload(Date.now());
      if (e.key === "f") plantKeyRef.current = true;
    }
    function handleKeyUp(e) {
      if ((e.key === "ArrowLeft" || e.key === "a") && moveInputRef.current.x === -1) moveInputRef.current = { ...moveInputRef.current, x: 0 };
      if ((e.key === "ArrowRight" || e.key === "d") && moveInputRef.current.x === 1) moveInputRef.current = { ...moveInputRef.current, x: 0 };
      if ((e.key === "ArrowUp" || e.key === "w") && moveInputRef.current.y === -1) moveInputRef.current = { ...moveInputRef.current, y: 0 };
      if ((e.key === "ArrowDown" || e.key === "s") && moveInputRef.current.y === 1) moveInputRef.current = { ...moveInputRef.current, y: 0 };
      if (e.key === "Shift") walkingSilentRef.current = false;
      if (e.key === "f") plantKeyRef.current = false;
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  function handleCanvasMouseMove(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = MAP_W / rect.width;
    const scaleY = MAP_H / rect.height;
    mouseRef.current = { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  if (deviceOk === null) return null;

  if (!deviceOk) {
    return (
      <div className="text-center py-10">
        <p className="text-3xl mb-4">💻</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">LAPTOP OR DESKTOP REQUIRED</p>
        <p className="text-textDim text-sm max-w-xs mx-auto">
          Operation Blacksite needs a mouse for aiming — please switch to a laptop or desktop.
        </p>
      </div>
    );
  }

  if (phase === "menu") {
    return (
      <div className="text-center max-w-md mx-auto">
        <p className="text-3xl mb-4">🎯</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">OPERATION BLACKSITE</p>
        <p className="text-textDim text-sm mb-6">
          WASD to move, mouse to aim, click to fire, R to reload, Shift to move silently, F to plant or defuse. 3v3
          — you and two AI teammates against three AI defenders, best of 5 rounds. Plant the bomb and defend it, or
          eliminate every defender. Real human teammates aren't available yet; these two slots are always AI-filled.
        </p>
        <p className="font-mono text-[10px] text-textDim mb-2">CHOOSE MAP</p>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {MAPS.map((m) => (
            <button
              key={m.id}
              onClick={() => setMapId(m.id)}
              className="rounded-md border-2 p-3"
              style={{ borderColor: mapId === m.id ? accentColor : "rgba(169,159,214,0.3)" }}
            >
              <p className="font-mono text-[10px] text-textLight">{m.name}</p>
            </button>
          ))}
        </div>
        <p className="font-mono text-[10px] text-textDim mb-2">CHOOSE DEFENDER DIFFICULTY</p>
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
        <button onClick={startMatch} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          DEPLOY
        </button>
      </div>
    );
  }

  if (phase === "buy") {
    const side = playerSideRef.current;
    const sideColors = SIDE_COLORS[side];
    const availableWeapons = Object.entries(WEAPONS).filter(([, w]) => w.side === "both" || w.side === side);
    return (
      <div className="text-center max-w-sm mx-auto">
        {sideSwapAnnounce && (
          <div className="mb-4 rounded-md border-2 p-3" style={{ borderColor: sideColors.accent, background: `${sideColors.accent}15` }}>
            <p className="font-pixel text-[10px]" style={{ color: sideColors.accent }}>
              SIDES SWITCHED — YOU ARE NOW {sideColors.label}
            </p>
          </div>
        )}
        <p className="font-pixel text-xs mb-1" style={{ color: sideColors.accent }}>
          YOU ARE {sideColors.label}
        </p>
        <p className="font-pixel text-xs text-accentAmber mb-1">BUY PHASE</p>
        <p className="font-mono text-[11px] text-textDim mb-4">💰 {buyState.money}</p>
        <p className="font-mono text-[10px] text-textDim mb-2 text-left">WEAPON</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {availableWeapons.map(([id, w]) => {
            const affordable = w.price === 0 || buyState.money >= w.price;
            return (
              <button
                key={id}
                disabled={!affordable}
                onClick={() => setBuyState((b) => ({ ...b, weapon: id }))}
                className="rounded-md border p-2 disabled:opacity-40"
                style={{ borderColor: buyState.weapon === id ? accentColor : "rgba(169,159,214,0.3)" }}
              >
                <p className="font-mono text-[10px] text-textLight">{w.name}</p>
                <p className="font-mono text-[9px] text-textDim">{w.price === 0 ? "Free" : `💰${w.price}`}</p>
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setBuyState((b) => ({ ...b, armor: !b.armor }))}
          disabled={!buyState.armor && buyState.money < ARMOR_PRICE}
          className="w-full rounded-md border p-2 mb-5 disabled:opacity-40"
          style={{ borderColor: buyState.armor ? accentColor : "rgba(169,159,214,0.3)" }}
        >
          <p className="font-mono text-xs text-textLight">🛡️ Armor {buyState.armor ? "(equipped)" : `— 💰${ARMOR_PRICE}`}</p>
        </button>
        <button onClick={confirmBuyAndStart} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START ROUND ▸
        </button>
      </div>
    );
  }

  if (phase === "roundend") {
    return (
      <div className="text-center">
        <p className="font-pixel text-sm mb-2" style={{ color: accentColor }}>{roundMsg}</p>
        <p className="font-mono text-xs text-textDim">Rounds: {hud.roundsWon} — {hud.roundsLost}</p>
      </div>
    );
  }

  if (phase === "over") {
    return (
      <div className="text-center">
        <p className="text-3xl mb-3">{outcome === "victory" ? "🏆" : "💀"}</p>
        <p className="font-pixel text-sm mb-2" style={{ color: outcome === "victory" ? "#ffb703" : "#ff3ea5" }}>
          {outcome === "victory" ? "MATCH WON" : "MATCH LOST"}
        </p>
        <p className="font-mono text-xs text-textDim">Final: {hud.roundsWon} — {hud.roundsLost}</p>
      </div>
    );
  }

  return (
    <div className="text-center relative" ref={wrapRef}>
      <div className="flex justify-between font-mono text-[11px] mb-2 text-textDim max-w-[700px] mx-auto">
        <span>{mapRef.current.name} · Rounds {hud.roundsWon}-{hud.roundsLost} · Round {roundNumberRef.current}/{TOTAL_ROUNDS}</span>
        <span style={{ color: SIDE_COLORS[playerSideRef.current].accent }}>{SIDE_COLORS[playerSideRef.current].label}</span>
        <span>{hud.bombTimer !== null ? `💣 ${hud.bombTimer}s` : `⏱️ ${hud.roundTime}s`}</span>
        <span>💰 {hud.money}</span>
      </div>
      <div
        className="relative mx-auto rounded-lg overflow-hidden border border-lineColor cursor-crosshair"
        style={{ width: MAP_W, maxWidth: "94vw" }}
        onMouseMove={handleCanvasMouseMove}
        onMouseDown={(e) => {
          if (e.button === 0) firingRef.current = true;
          if (e.button === 2) adsRef.current = true;
        }}
        onMouseUp={(e) => {
          if (e.button === 0) firingRef.current = false;
          if (e.button === 2) adsRef.current = false;
        }}
        onMouseLeave={() => { firingRef.current = false; adsRef.current = false; }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} width={MAP_W} height={MAP_H} style={{ width: "100%", height: "auto", display: "block" }} />
      </div>
      <div className="flex justify-between font-mono text-[11px] mt-2 max-w-[700px] mx-auto text-textDim">
        <span>❤️ {hud.hp} {hud.armor ? "🛡️" : ""} · 👥 {hud.teammatesAlive}/2</span>
        <span>{hud.ammo}/{hud.reserve} — {WEAPONS[playerRef.current.weapon].name}</span>
      </div>
      <p className="font-mono text-[10px] text-textDim mt-2">WASD move · Mouse aim · Click fire · R reload · Shift silent · F plant/defuse</p>
    </div>
  );
}
