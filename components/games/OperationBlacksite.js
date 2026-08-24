"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const MAP_W = 700;
const MAP_H = 480;
const TICK_MS = 33;
const ROUNDS_TO_WIN = 3;
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
    id: "substation",
    name: "Substation",
    walls: [
      { x: 0, y: 0, w: MAP_W, h: 14 }, { x: 0, y: MAP_H - 14, w: MAP_W, h: 14 },
      { x: 0, y: 0, w: 14, h: MAP_H }, { x: MAP_W - 14, y: 0, w: 14, h: MAP_H },
      { x: 220, y: 60, w: 22, h: 150 }, { x: 460, y: 60, w: 22, h: 150 },
      { x: 90, y: 260, w: 160, h: 22 }, { x: 440, y: 300, w: 180, h: 22 },
      { x: 320, y: 180, w: 60, h: 22 },
    ],
    siteA: { x: 560, y: 90, r: 46 }, siteB: { x: 110, y: 400, r: 46 },
    playerSpawn: { x: 60, y: 60 },
    botSpawns: [{ x: 610, y: 130 }, { x: 150, y: 360 }, { x: 350, y: 400 }],
  },
  {
    // Long open corridor between the two sites, minimal cover in the
    // middle — rewards holding an angle down the length of the map,
    // with a walled flank route around the outside.
    id: "refinery",
    name: "Refinery",
    walls: [
      { x: 0, y: 0, w: MAP_W, h: 14 }, { x: 0, y: MAP_H - 14, w: MAP_W, h: 14 },
      { x: 0, y: 0, w: 14, h: MAP_H }, { x: MAP_W - 14, y: 0, w: 14, h: MAP_H },
      { x: 200, y: 120, w: 24, h: 240 }, { x: 480, y: 120, w: 24, h: 240 },
      { x: 320, y: 340, w: 120, h: 20 },
    ],
    siteA: { x: 620, y: 100, r: 46 }, siteB: { x: 80, y: 380, r: 46 },
    playerSpawn: { x: 50, y: 400 },
    botSpawns: [{ x: 630, y: 150 }, { x: 350, y: 60 }, { x: 130, y: 350 }],
  },
  {
    // Tight, twisty corridors — close-quarters, aggressive rushes
    // reward pushing fast rather than holding long angles.
    id: "undercroft",
    name: "Undercroft",
    walls: [
      { x: 0, y: 0, w: MAP_W, h: 14 }, { x: 0, y: MAP_H - 14, w: MAP_W, h: 14 },
      { x: 0, y: 0, w: 14, h: MAP_H }, { x: MAP_W - 14, y: 0, w: 14, h: MAP_H },
      { x: 120, y: 60, w: 20, h: 120 }, { x: 120, y: 260, w: 20, h: 160 },
      { x: 280, y: 14, w: 20, h: 180 }, { x: 280, y: 280, w: 20, h: 186 },
      { x: 420, y: 100, w: 20, h: 140 }, { x: 420, y: 320, w: 20, h: 146 },
      { x: 560, y: 60, w: 20, h: 200 },
    ],
    siteA: { x: 600, y: 380, r: 42 }, siteB: { x: 100, y: 120, r: 42 },
    playerSpawn: { x: 60, y: 400 },
    botSpawns: [{ x: 620, y: 320 }, { x: 350, y: 200 }, { x: 130, y: 180 }],
  },
  {
    // A central walkway connects the two sites directly; ground
    // routes loop around both sides — thematically the "elevated
    // bridge" map, giving three genuinely different paths across.
    id: "skybridge",
    name: "Skybridge",
    walls: [
      { x: 0, y: 0, w: MAP_W, h: 14 }, { x: 0, y: MAP_H - 14, w: MAP_W, h: 14 },
      { x: 0, y: 0, w: 14, h: MAP_H }, { x: MAP_W - 14, y: 0, w: 14, h: MAP_H },
      { x: 250, y: 180, w: 200, h: 20 }, { x: 250, y: 280, w: 200, h: 20 },
      { x: 100, y: 60, w: 20, h: 150 }, { x: 580, y: 60, w: 20, h: 150 },
      { x: 100, y: 270, w: 20, h: 150 }, { x: 580, y: 270, w: 20, h: 150 },
    ],
    siteA: { x: 630, y: 240, r: 44 }, siteB: { x: 70, y: 240, r: 44 },
    playerSpawn: { x: 350, y: 60 },
    botSpawns: [{ x: 600, y: 300 }, { x: 100, y: 180 }, { x: 350, y: 420 }],
  },
  {
    // Arctic, symmetric layout — mirrored routes to each site, good
    // for practicing rotations since either half plays like the other.
    id: "frostline",
    name: "Frostline",
    walls: [
      { x: 0, y: 0, w: MAP_W, h: 14 }, { x: 0, y: MAP_H - 14, w: MAP_W, h: 14 },
      { x: 0, y: 0, w: 14, h: MAP_H }, { x: MAP_W - 14, y: 0, w: 14, h: MAP_H },
      { x: 180, y: 14, w: 20, h: 130 }, { x: 180, y: 336, w: 20, h: 130 },
      { x: 500, y: 14, w: 20, h: 130 }, { x: 500, y: 336, w: 20, h: 130 },
      { x: 330, y: 150, w: 40, h: 180 },
    ],
    siteA: { x: 610, y: 80, r: 44 }, siteB: { x: 90, y: 400, r: 44 },
    playerSpawn: { x: 350, y: 240 },
    botSpawns: [{ x: 600, y: 140 }, { x: 100, y: 340 }, { x: 350, y: 400 }],
  },
  {
    // Open with scattered pillar cover — a mix of long peeks across
    // the open middle and short trades around the pillars, the most
    // "read the fight as it develops" of the six maps.
    id: "signalhill",
    name: "Signal Hill",
    walls: [
      { x: 0, y: 0, w: MAP_W, h: 14 }, { x: 0, y: MAP_H - 14, w: MAP_W, h: 14 },
      { x: 0, y: 0, w: 14, h: MAP_H }, { x: MAP_W - 14, y: 0, w: 14, h: MAP_H },
      { x: 150, y: 100, w: 60, h: 60 }, { x: 490, y: 100, w: 60, h: 60 },
      { x: 150, y: 320, w: 60, h: 60 }, { x: 490, y: 320, w: 60, h: 60 },
      { x: 320, y: 210, w: 60, h: 60 },
    ],
    siteA: { x: 600, y: 240, r: 46 }, siteB: { x: 100, y: 240, r: 46 },
    playerSpawn: { x: 350, y: 60 },
    botSpawns: [{ x: 570, y: 160 }, { x: 150, y: 340 }, { x: 350, y: 400 }],
  },
];

const WEAPONS = {
  pistol: { name: "Viper Pistol", damage: 24, fireRate: 340, spread: 0.05, mag: 12, reload: 1100, price: 0, tracer: "#ffe14d" },
  smg: { name: "Ranger SMG", damage: 16, fireRate: 95, spread: 0.1, mag: 30, reload: 1500, price: 900, tracer: "#3ee6e0" },
  rifle: { name: "Phantom Rifle", damage: 32, fireRate: 150, spread: 0.055, mag: 25, reload: 1800, price: 2200, tracer: "#ff3ea5" },
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
  const [mapId, setMapId] = useState("substation");
  const [hud, setHud] = useState({ hp: 100, armor: 0, money: 800, ammo: 12, reserve: 36, roundsWon: 0, roundsLost: 0, roundTime: ROUND_SECONDS, bombTimer: null });
  const [buyState, setBuyState] = useState({ weapon: "pistol", armor: false, money: 800 });
  const [roundMsg, setRoundMsg] = useState("");
  const [outcome, setOutcome] = useState(null);

  const playerRef = useRef({ x: 60, y: 60, aim: 0, hp: 100, armor: 0, weapon: "pistol", ammo: 12, reserve: 36, reloadingUntil: 0, lastShotAt: 0, heat: 0, alive: true, planting: false, plantStart: 0, defusing: false, defuseStart: 0 });
  const moveInputRef = useRef({ x: 0, y: 0 });
  const mouseRef = useRef({ x: 400, y: 240 });
  const firingRef = useRef(false);
  const adsRef = useRef(false);
  const walkingSilentRef = useRef(false);
  const plantKeyRef = useRef(false);

  const botsRef = useRef([]);
  const bulletTracersRef = useRef([]);
  const muzzleFlashesRef = useRef([]);
  const particlesRef = useRef([]);
  const floatTextRef = useRef([]);
  const bombRef = useRef({ planted: false, x: 0, y: 0, timer: 0 });
  const moneyRef = useRef(800);
  const roundsWonRef = useRef(0);
  const roundsLostRef = useRef(0);
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
    playerRef.current = { x: map.playerSpawn.x, y: map.playerSpawn.y, aim: 0, hp: 100, armor: buyState.armor ? 1 : 0, weapon: buyState.weapon, ammo: WEAPONS[buyState.weapon].mag, reserve: WEAPONS[buyState.weapon].mag * 3, reloadingUntil: 0, lastShotAt: 0, heat: 0, alive: true, planting: false, plantStart: 0, defusing: false, defuseStart: 0 };
    botsRef.current = map.botSpawns.map((s, i) => ({ id: i, x: s.x, y: s.y, hp: Math.round(80 * DIFFICULTIES[difficultyRef.current].hpMult), state: "patrol", patrolTarget: { x: s.x + (Math.random() - 0.5) * 80, y: s.y + (Math.random() - 0.5) * 80 }, aim: 0, alertUntil: 0, lastShotAt: 0, alive: true }));
    bombRef.current = { planted: false, x: 0, y: 0, timer: 0 };
    roundTimeRef.current = ROUND_SECONDS;
    bulletTracersRef.current = [];
    muzzleFlashesRef.current = [];
    particlesRef.current = [];
    floatTextRef.current = [];
  }

  function startMatch() {
    const el = wrapRef.current?.ownerDocument?.documentElement;
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    difficultyRef.current = difficulty;
    mapRef.current = MAPS.find((m) => m.id === mapId) || MAPS[0];
    moneyRef.current = 800;
    roundsWonRef.current = 0;
    roundsLostRef.current = 0;
    finishedMatchRef.current = false;
    setBuyState({ weapon: "pistol", armor: false, money: 800 });
    openBuyPhase();
  }

  function openBuyPhase() {
    setPhase("buy");
    setBuyState((b) => ({ ...b, money: moneyRef.current }));
  }

  function confirmBuyAndStart() {
    let cost = 0;
    if (buyState.weapon !== "pistol") cost += WEAPONS[buyState.weapon].price;
    if (buyState.armor) cost += ARMOR_PRICE;
    moneyRef.current = Math.max(0, moneyRef.current - cost);
    resetForRound();
    setPhase("round");
    setRoundMsg("");
    sfx.select();
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

    setTimeout(() => {
      if (roundsWonRef.current >= ROUNDS_TO_WIN || roundsLostRef.current >= ROUNDS_TO_WIN) {
        finishMatch(roundsWonRef.current >= ROUNDS_TO_WIN);
      } else {
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
    p.heat = Math.min(1, p.heat + 0.18);
    const spread = def.spread * (adsRef.current ? 0.4 : 1) + p.heat * 0.12;
    const angle = p.aim + (Math.random() - 0.5) * spread;
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

  function botAI(b, now, p) {
    if (!b.alive) return;
    const diff = DIFFICULTIES[difficultyRef.current];
    const dToPlayer = p.alive ? dist(b.x, b.y, p.x, p.y) : Infinity;
    const canSeePlayer = p.alive && dToPlayer < diff.engageRange && !walkingSilentRef.current;

    if (canSeePlayer) {
      b.state = "engage";
      b.alertUntil = now + 3000;
    } else if (bombRef.current.planted) {
      b.state = "rush";
    } else if (now < b.alertUntil) {
      b.state = "search";
    } else if (b.state !== "engage") {
      b.state = "patrol";
    }

    if (b.state === "engage" && p.alive) {
      b.aim = Math.atan2(p.y - b.y, p.x - b.x);
      if (now - b.lastShotAt > diff.fireRateMs + Math.random() * 250) {
        b.lastShotAt = now;
        const spread = 0.09;
        const angle = b.aim + (Math.random() - 0.5) * spread;
        const hitPlayer = segmentHitsWall(b.x, b.y, angle, dToPlayer + 4, mapRef.current.walls);
        if (!hitPlayer) {
          const dmg = Math.round(14 * diff.damageMult * (1 - (p.armor ? ARMOR_REDUCTION : 0)));
          p.hp = Math.max(0, p.hp - dmg);
          damageFlashRef.current = 1;
          shakeRef.current = 0.5;
          spawnParticles(p.x, p.y, "#ff3ea5", 6);
          haptics.tap();
          bulletTracersRef.current.push({ x0: b.x, y0: b.y, x1: p.x, y1: p.y, color: "#ff5a3c", life: 1 });
        }
      }
      if (dToPlayer < 90) {
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
        b.defusing = true;
      }
    } else if (b.state === "search") {
      const ang = Math.atan2(p.y - b.y, p.x - b.x);
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
        if (plantKeyRef.current && !bombRef.current.planted && (nearA || nearB)) {
          if (!p.planting) { p.planting = true; p.plantStart = now; }
          if (now - p.plantStart > PLANT_HOLD_MS) {
            const site = nearA ? mapRef.current.siteA : mapRef.current.siteB;
            bombRef.current = { planted: true, x: site.x, y: site.y, timer: BOMB_TIMER_SECONDS };
            p.planting = false;
            sfx.levelUp();
            setRoundMsg("BOMB PLANTED");
          }
        } else {
          p.planting = false;
        }
        if (plantKeyRef.current && bombRef.current.planted) {
          const dBomb = dist(p.x, p.y, bombRef.current.x, bombRef.current.y);
          if (dBomb < 30) {
            if (!p.defusing) { p.defusing = true; p.defuseStart = now; }
          }
        } else {
          p.defusing = false;
        }
      }

      for (const b of botsRef.current) botAI(b, now, p);

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
              endRound(false, "BOMB DEFUSED");
              return;
            }
          }
        }
      }

      bulletTracersRef.current = bulletTracersRef.current.filter((t) => { t.life -= 0.15; return t.life > 0; });
      muzzleFlashesRef.current = muzzleFlashesRef.current.filter((m) => { m.life -= 0.25; return m.life > 0; });
      particlesRef.current = particlesRef.current.filter((pt) => { pt.x += pt.vx; pt.y += pt.vy; pt.life -= 0.05; return pt.life > 0; });
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
        endRound(true, "ALL DEFENDERS ELIMINATED");
        return;
      }
      if (roundTimeRef.current <= 0 && !bombRef.current.planted) {
        endRound(false, "TIME EXPIRED");
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

      ctx.fillStyle = "#151022";
      ctx.fillRect(-10, -10, MAP_W + 20, MAP_H + 20);
      ctx.strokeStyle = "rgba(169,159,214,0.08)";
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

      for (const b of botsRef.current) {
        if (!b.alive) continue;
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.aim);
        ctx.fillStyle = "#8a1f2b";
        ctx.beginPath();
        ctx.arc(0, 0, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ff5a3c";
        ctx.fillRect(6, -2, 12, 4);
        ctx.restore();
        const barW = 22;
        ctx.fillStyle = "#000";
        ctx.fillRect(b.x - barW / 2, b.y - 22, barW, 3);
        ctx.fillStyle = "#ff3ea5";
        ctx.fillRect(b.x - barW / 2, b.y - 22, barW * (b.hp / 80), 3);
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
        ctx.fillStyle = accentColor || "#3ee6e0";
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
          WASD to move, mouse to aim, click to fire, R to reload, Shift to move silently, F to plant or defuse. Best
          of 5 rounds — plant the bomb at Site A or B and defend it, or eliminate every defender.
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
    return (
      <div className="text-center max-w-sm mx-auto">
        <p className="font-pixel text-xs text-accentAmber mb-1">BUY PHASE</p>
        <p className="font-mono text-[11px] text-textDim mb-4">💰 {buyState.money}</p>
        <p className="font-mono text-[10px] text-textDim mb-2 text-left">WEAPON</p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {Object.entries(WEAPONS).map(([id, w]) => {
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
        <span>{mapRef.current.name} · Rounds {hud.roundsWon}-{hud.roundsLost}</span>
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
        <span>❤️ {hud.hp} {hud.armor ? "🛡️" : ""}</span>
        <span>{hud.ammo}/{hud.reserve} — {WEAPONS[playerRef.current.weapon].name}</span>
      </div>
      <p className="font-mono text-[10px] text-textDim mt-2">WASD move · Mouse aim · Click fire · R reload · Shift silent · F plant/defuse</p>
    </div>
  );
}
