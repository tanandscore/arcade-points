"use client";

import { useEffect, useRef, useState } from "react";
import { drawSprite } from "@/lib/pixelSprites";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const ARENA_W = 480;
const ARENA_H = 420;
const CELL = 5;
const TICK_MS = 33;
const SESSION_SECONDS = 240;
const MAX_ACTIVE_WEAPONS = 3;

const ENEMY_TYPES = {
  imp: { sprite: "imp", hp: 7, speed: 1.9, damage: 5, xp: 4, radius: 9, gold: 1 },
  ghoul: { sprite: "ghoul", hp: 20, speed: 0.9, damage: 9, xp: 7, radius: 12, gold: 2 },
  houndwraith: { sprite: "houndwraith", hp: 12, speed: 2.2, damage: 7, xp: 6, radius: 10, gold: 2 },
  guardian: { sprite: "guardian", hp: 280, speed: 0.6, damage: 20, xp: 100, radius: 22, gold: 40 },
};

const RARITY = {
  common: { label: "Common", color: "#a99fd6", weight: 0.5, mult: 1 },
  rare: { label: "Rare", color: "#3ee6e0", weight: 0.32, mult: 1.4 },
  epic: { label: "Epic", color: "#b45cff", weight: 0.14, mult: 1.9 },
  legendary: { label: "Legendary", color: "#ffb703", weight: 0.04, mult: 2.6 },
};

function pickRarity() {
  const r = Math.random();
  let c = 0;
  for (const [key, def] of Object.entries(RARITY)) {
    c += def.weight;
    if (r <= c) return key;
  }
  return "common";
}

const WEAPON_DEFS = {
  arcanebolt: {
    name: "Arcane Bolt",
    icon: "🔮",
    color: "#3ee6e0",
    maxLevel: 8,
    baseCooldown: 800,
    stats: (lvl) => ({
      damage: 10 + Math.floor(lvl * 3.5),
      projectiles: lvl >= 7 ? 3 : lvl >= 3 ? 2 : 1,
      pierce: lvl >= 8 ? 3 : lvl >= 5 ? 1 : 0,
    }),
  },
  firewand: {
    name: "Fire Wand",
    icon: "🔥",
    color: "#ff5a3c",
    maxLevel: 8,
    baseCooldown: 1400,
    stats: (lvl) => ({
      damage: 8 + Math.floor(lvl * 3),
      aoeRadius: 18 + lvl * 3,
      shots: lvl >= 6 ? 2 : 1,
    }),
  },
  icespear: {
    name: "Ice Spear",
    icon: "❄️",
    color: "#9be8ff",
    maxLevel: 8,
    baseCooldown: 1100,
    stats: (lvl) => ({
      damage: 6 + Math.floor(lvl * 2.5),
      pierce: 2 + Math.floor(lvl / 2),
    }),
  },
  arcanenova: {
    name: "Arcane Nova",
    icon: "✨",
    color: "#ffb703",
    maxLevel: 8,
    baseCooldown: 900,
    stats: (lvl) => ({ damage: 14 + Math.floor(lvl * 4), rays: 8, pierce: 1 }),
  },
};

const PASSIVE_DEFS = {
  ancienttome: { name: "Ancient Tome", icon: "📖", maxLevel: 5, desc: "Reduces all weapon cooldowns", per: 0.07 },
  swiftboots: { name: "Swift Boots", icon: "👢", maxLevel: 5, desc: "Increases move speed", per: 0.08 },
  crystalheart: { name: "Crystal Heart", icon: "❤️", maxLevel: 5, desc: "Increases max HP", per: 15 },
  hunterlens: { name: "Hunter Lens", icon: "🔍", maxLevel: 5, desc: "Increases crit chance", per: 0.06 },
};

function xpForLevel(level) {
  return 16 + level * 11;
}

function freshState() {
  return {
    hp: 55,
    maxHp: 55,
    moveSpeed: 2.3,
    gold: 0,
    critChance: 0.05,
    weapons: { arcanebolt: 1 },
    passives: {},
    evolved: false,
  };
}

function buildChoicePool(state) {
  const pool = [];
  const weaponCount = Object.keys(state.weapons).length;
  for (const [id, level] of Object.entries(state.weapons)) {
    if (id === "arcanenova") continue;
    if (level < WEAPON_DEFS[id].maxLevel) pool.push({ kind: "weapon-upgrade", id });
  }
  if (weaponCount < MAX_ACTIVE_WEAPONS) {
    for (const id of Object.keys(WEAPON_DEFS)) {
      if (id === "arcanenova") continue;
      if (!state.weapons[id]) pool.push({ kind: "weapon-new", id });
    }
  }
  for (const [id, level] of Object.entries(state.passives)) {
    if (level < PASSIVE_DEFS[id].maxLevel) pool.push({ kind: "passive-upgrade", id });
  }
  for (const id of Object.keys(PASSIVE_DEFS)) {
    if (!state.passives[id]) pool.push({ kind: "passive-new", id });
  }
  pool.push({ kind: "heal" });
  pool.push({ kind: "gold" });
  return pool;
}

function describeChoice(choice, state) {
  const rarity = choice.kind === "heal" || choice.kind === "gold" ? "common" : pickRarity();
  const mult = RARITY[rarity].mult;
  if (choice.kind === "weapon-new") {
    const def = WEAPON_DEFS[choice.id];
    return { ...choice, rarity, name: def.name, icon: def.icon, desc: "New weapon", color: def.color };
  }
  if (choice.kind === "weapon-upgrade") {
    const def = WEAPON_DEFS[choice.id];
    const nextLevel = state.weapons[choice.id] + 1;
    return { ...choice, rarity, name: `${def.name} +1`, icon: def.icon, desc: `Level ${nextLevel}`, color: def.color };
  }
  if (choice.kind === "passive-new") {
    const def = PASSIVE_DEFS[choice.id];
    return { ...choice, rarity, name: def.name, icon: def.icon, desc: def.desc, color: "#a99fd6" };
  }
  if (choice.kind === "passive-upgrade") {
    const def = PASSIVE_DEFS[choice.id];
    return { ...choice, rarity, name: `${def.name} +1`, icon: def.icon, desc: def.desc, color: "#a99fd6" };
  }
  if (choice.kind === "heal") {
    return { ...choice, rarity, name: "Restore Health", icon: "💚", desc: "Heal 35% of max HP", color: "#6bff6b" };
  }
  return { ...choice, rarity, name: "Gold Cache", icon: "🪙", desc: `+${Math.round(30 * mult)} gold`, color: "#ffb703" };
}

function pickUpgrades(state) {
  const pool = buildChoicePool(state);
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
  return shuffled.map((c) => describeChoice(c, state));
}

export default function ArcaneSurvivor({ onFinish, accentColor }) {
  const canvasRef = useRef(null);
  const [deviceOk, setDeviceOk] = useState(null);
  const [phase, setPhase] = useState("menu");
  const [hud, setHud] = useState({ hp: 55, maxHp: 55, level: 1, xp: 0, xpNeeded: xpForLevel(1), timeLeft: SESSION_SECONDS, kills: 0, gold: 0 });
  const [upgradeChoices, setUpgradeChoices] = useState([]);
  const [outcome, setOutcome] = useState(null);
  const [weaponBar, setWeaponBar] = useState([]);
  const [evolveFlash, setEvolveFlash] = useState(false);

  const stateRef = useRef(freshState());
  const playerPosRef = useRef({ x: ARENA_W / 2, y: ARENA_H / 2 });
  const moveInputRef = useRef({ x: 0, y: 0 });
  const invulnRef = useRef(0);
  const enemiesRef = useRef([]);
  const projectilesRef = useRef([]);
  const gemsRef = useRef([]);
  const particlesRef = useRef([]);
  const floatTextRef = useRef([]);
  const telegraphRef = useRef([]);
  const weaponCooldownsRef = useRef({});
  const killsRef = useRef(0);
  const xpRef = useRef(0);
  const levelRef = useRef(1);
  const elapsedRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const eliteMarksRef = useRef({});
  const bossMarksRef = useRef({});
  const pausedRef = useRef(false);
  const finishedRef = useRef(false);

  const simIntervalRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    const isTouchPrimary = window.matchMedia("(pointer: coarse)").matches;
    const isSmall = window.innerWidth < 1024;
    setDeviceOk(!isTouchPrimary && !isSmall);
  }, []);

  function resetRun() {
    stateRef.current = freshState();
    playerPosRef.current = { x: ARENA_W / 2, y: ARENA_H / 2 };
    invulnRef.current = 0;
    enemiesRef.current = [];
    projectilesRef.current = [];
    gemsRef.current = [];
    particlesRef.current = [];
    floatTextRef.current = [];
    telegraphRef.current = [];
    weaponCooldownsRef.current = {};
    killsRef.current = 0;
    xpRef.current = 0;
    levelRef.current = 1;
    elapsedRef.current = 0;
    spawnTimerRef.current = 0;
    eliteMarksRef.current = {};
    bossMarksRef.current = {};
    pausedRef.current = false;
    finishedRef.current = false;
  }

  function effectiveStats() {
    const s = stateRef.current;
    let cooldownMult = 1;
    let speedMult = 1;
    let maxHpBonus = 0;
    let critBonus = 0;
    for (const [id, lvl] of Object.entries(s.passives)) {
      const def = PASSIVE_DEFS[id];
      if (id === "ancienttome") cooldownMult -= def.per * lvl;
      if (id === "swiftboots") speedMult += def.per * lvl;
      if (id === "crystalheart") maxHpBonus += def.per * lvl;
      if (id === "hunterlens") critBonus += def.per * lvl;
    }
    return {
      cooldownMult: Math.max(0.35, cooldownMult),
      speedMult,
      maxHp: s.maxHp + maxHpBonus,
      critChance: Math.min(0.75, s.critChance + critBonus),
    };
  }

  function spawnParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.6 + Math.random() * 1.4;
      particlesRef.current.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color });
    }
  }

  function spawnFloatText(x, y, text, color) {
    floatTextRef.current.push({ x, y, text, color, life: 1 });
  }

  function spawnEnemy(forcedType, isElite) {
    const t = elapsedRef.current;
    const pool = t < 30 ? ["imp"] : t < 70 ? ["imp", "houndwraith"] : ["imp", "houndwraith", "ghoul"];
    const type = forcedType || pool[Math.floor(Math.random() * pool.length)];
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    if (edge === 0) { x = Math.random() * ARENA_W; y = -20; }
    else if (edge === 1) { x = ARENA_W + 20; y = Math.random() * ARENA_H; }
    else if (edge === 2) { x = Math.random() * ARENA_W; y = ARENA_H + 20; }
    else { x = -20; y = Math.random() * ARENA_H; }

    const def = ENEMY_TYPES[type];
    const scale = 1 + Math.min(1.2, t / 150);
    const eliteMult = isElite ? 2.5 : 1;
    enemiesRef.current.push({
      id: Math.random(),
      type,
      x,
      y,
      hp: Math.round(def.hp * scale * eliteMult),
      maxHp: Math.round(def.hp * scale * eliteMult),
      speed: def.speed * (isElite ? 1.15 : 1),
      damage: Math.round(def.damage * (isElite ? 1.6 : 1)),
      xp: Math.round(def.xp * (isElite ? 3 : 1)),
      gold: def.gold * (isElite ? 4 : 1),
      radius: def.radius * (isElite ? 1.3 : 1),
      isElite,
      slowUntil: 0,
    });
    if (isElite) spawnFloatText(x, y - 16, "ELITE!", "#ffb703");
  }

  function spawnBoss() {
    const def = ENEMY_TYPES.guardian;
    enemiesRef.current.push({
      id: Math.random(),
      type: "guardian",
      x: ARENA_W / 2,
      y: -30,
      hp: def.hp,
      maxHp: def.hp,
      speed: def.speed,
      damage: def.damage,
      xp: def.xp,
      gold: def.gold,
      radius: def.radius,
      isBoss: true,
      bossPhase: 1,
      slowUntil: 0,
    });
    spawnFloatText(ARENA_W / 2, 60, "THE ANCIENT GUARDIAN AWAKENS", "#ff3ea5");
    sfx.levelUp();
  }

  function fireWeapon(id, level, p) {
    const def = WEAPON_DEFS[id];
    const stats = def.stats(level);
    const enemies = enemiesRef.current;

    if (id === "arcanebolt") {
      if (!enemies.length) return;
      let nearest = null, nearestDist = Infinity;
      for (const e of enemies) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < nearestDist) { nearestDist = d; nearest = e; }
      }
      const baseAngle = Math.atan2(nearest.y - p.y, nearest.x - p.x);
      const spread = 0.22;
      for (let i = 0; i < stats.projectiles; i++) {
        const angle = baseAngle + (i - (stats.projectiles - 1) / 2) * spread;
        projectilesRef.current.push({ x: p.x, y: p.y, vx: Math.cos(angle) * 5.5, vy: Math.sin(angle) * 5.5, damage: stats.damage, pierceLeft: stats.pierce, hitIds: new Set(), life: 90, color: def.color, kind: "bolt" });
      }
    } else if (id === "arcanenova") {
      for (let i = 0; i < stats.rays; i++) {
        const angle = (i / stats.rays) * Math.PI * 2;
        projectilesRef.current.push({ x: p.x, y: p.y, vx: Math.cos(angle) * 5, vy: Math.sin(angle) * 5, damage: stats.damage, pierceLeft: stats.pierce, hitIds: new Set(), life: 70, color: def.color, kind: "bolt" });
      }
    } else if (id === "firewand") {
      if (!enemies.length) return;
      for (let i = 0; i < stats.shots; i++) {
        const target = enemies[Math.floor(Math.random() * enemies.length)];
        const angle = Math.atan2(target.y - p.y, target.x - p.x);
        projectilesRef.current.push({ x: p.x, y: p.y, vx: Math.cos(angle) * 3.6, vy: Math.sin(angle) * 3.6, damage: stats.damage, aoeRadius: stats.aoeRadius, life: 60, color: def.color, kind: "fire" });
      }
    } else if (id === "icespear") {
      if (!enemies.length) return;
      let nearest = null, nearestDist = Infinity;
      for (const e of enemies) {
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < nearestDist) { nearestDist = d; nearest = e; }
      }
      const angle = Math.atan2(nearest.y - p.y, nearest.x - p.x);
      projectilesRef.current.push({ x: p.x, y: p.y, vx: Math.cos(angle) * 4.8, vy: Math.sin(angle) * 4.8, damage: stats.damage, pierceLeft: stats.pierce, hitIds: new Set(), life: 90, color: def.color, kind: "ice" });
    }
  }

  function grantXp(amount) {
    xpRef.current += amount;
    const needed = xpForLevel(levelRef.current);
    if (xpRef.current >= needed) {
      xpRef.current -= needed;
      levelRef.current += 1;
      sfx.levelUp();
      haptics.success();
      pausedRef.current = true;
      setUpgradeChoices(pickUpgrades(stateRef.current));
      setPhase("levelup");
    }
  }

  function chooseUpgrade(choice) {
    const s = stateRef.current;
    if (choice.kind === "weapon-new") s.weapons[choice.id] = 1;
    else if (choice.kind === "weapon-upgrade") s.weapons[choice.id] += 1;
    else if (choice.kind === "passive-new") s.passives[choice.id] = 1;
    else if (choice.kind === "passive-upgrade") s.passives[choice.id] += 1;
    else if (choice.kind === "heal") s.hp = Math.min(effectiveStats().maxHp, s.hp + effectiveStats().maxHp * 0.35);
    else if (choice.kind === "gold") s.gold += Math.round(30 * RARITY[choice.rarity].mult);

    if (!s.evolved && s.weapons.arcanebolt >= WEAPON_DEFS.arcanebolt.maxLevel && s.passives.ancienttome) {
      delete s.weapons.arcanebolt;
      s.weapons.arcanenova = 1;
      s.evolved = true;
      setEvolveFlash(true);
      setTimeout(() => setEvolveFlash(false), 1600);
      sfx.newBest();
    }

    setWeaponBar(Object.keys(s.weapons));
    pausedRef.current = false;
    setPhase("playing");
    sfx.correct();
  }

  function endRun(won) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(simIntervalRef.current);
    setOutcome(won ? "victory" : "defeat");
    setPhase("over");
    sfx[won ? "newBest" : "lose"]();
    const score = killsRef.current * 10 + Math.round(elapsedRef.current) * 2 + levelRef.current * 35 + stateRef.current.gold;
    setTimeout(() => onFinish(Math.max(0, score)), 1400);
  }

  function begin() {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    resetRun();
    setOutcome(null);
    setWeaponBar(["arcanebolt"]);
    setPhase("playing");

    simIntervalRef.current = setInterval(() => {
      if (pausedRef.current) return;
      elapsedRef.current += TICK_MS / 1000;
      const s = stateRef.current;
      const eff = effectiveStats();
      const p = playerPosRef.current;

      const mv = moveInputRef.current;
      if (mv.x || mv.y) {
        const mag = Math.hypot(mv.x, mv.y) || 1;
        p.x = Math.max(12, Math.min(ARENA_W - 12, p.x + (mv.x / mag) * s.moveSpeed * eff.speedMult));
        p.y = Math.max(12, Math.min(ARENA_H - 12, p.y + (mv.y / mag) * s.moveSpeed * eff.speedMult));
      }

      const now = elapsedRef.current * 1000;
      for (const [id, level] of Object.entries(s.weapons)) {
        const def = WEAPON_DEFS[id];
        const cd = def.baseCooldown * eff.cooldownMult;
        const last = weaponCooldownsRef.current[id] || 0;
        if (now - last > cd) {
          weaponCooldownsRef.current[id] = now;
          fireWeapon(id, level, p);
        }
      }

      spawnTimerRef.current += TICK_MS;
      const spawnEvery = Math.max(280, 1100 - elapsedRef.current * 6);
      if (spawnTimerRef.current > spawnEvery) {
        spawnTimerRef.current = 0;
        spawnEnemy();
      }

      [60, 120, 180].forEach((mark) => {
        if (elapsedRef.current >= mark && !eliteMarksRef.current[mark]) {
          eliteMarksRef.current[mark] = true;
          spawnEnemy(null, true);
        }
      });
      if (elapsedRef.current >= 150 && !bossMarksRef.current[150]) {
        bossMarksRef.current[150] = true;
        spawnBoss();
      }

      if (invulnRef.current > 0) invulnRef.current -= 1;
      for (const e of enemiesRef.current) {
        if (e.isBoss && e.bossPhase === 1 && e.hp <= e.maxHp * 0.5) {
          e.bossPhase = 2;
          e.speed *= 1.4;
          telegraphRef.current.push({ x: e.x, y: e.y, radius: 6, maxRadius: 90, life: 1 });
          const dToPlayer = Math.hypot(p.x - e.x, p.y - e.y);
          if (dToPlayer < 90) {
            s.hp = Math.max(0, s.hp - 24);
            spawnFloatText(p.x, p.y - 14, "SLAMMED! -24", "#ff3ea5");
            haptics.celebrate();
          }
          spawnFloatText(e.x, e.y - 26, "PHASE 2", "#ffb703");
          sfx.boost();
        }

        const slowed = e.slowUntil > now;
        const speedNow = slowed ? e.speed * 0.5 : e.speed;
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const dist = Math.hypot(dx, dy) || 1;
        e.x += (dx / dist) * speedNow;
        e.y += (dy / dist) * speedNow;

        if (dist < e.radius + 10 && invulnRef.current === 0) {
          s.hp = Math.max(0, s.hp - e.damage);
          invulnRef.current = 18;
          spawnParticles(p.x, p.y, "#ff3ea5", 6);
          haptics.tap();
          if (s.hp <= 0) {
            endRun(false);
            return;
          }
        }
      }

      projectilesRef.current = projectilesRef.current.filter((proj) => {
        proj.x += proj.vx;
        proj.y += proj.vy;
        proj.life -= 1;
        if (proj.life <= 0 || proj.x < -20 || proj.x > ARENA_W + 20 || proj.y < -20 || proj.y > ARENA_H + 20) return false;

        if (proj.kind === "fire") {
          for (const e of enemiesRef.current) {
            const d = Math.hypot(proj.x - e.x, proj.y - e.y);
            if (d < e.radius) {
              for (const target of enemiesRef.current) {
                const dd = Math.hypot(target.x - proj.x, target.y - proj.y);
                if (dd < proj.aoeRadius) {
                  target.hp -= proj.damage;
                  spawnFloatText(target.x, target.y - 10, `-${proj.damage}`, "#ff5a3c");
                }
              }
              spawnParticles(proj.x, proj.y, "#ff5a3c", 12);
              sfx.hit();
              return false;
            }
          }
          return true;
        }

        for (const e of enemiesRef.current) {
          if (proj.hitIds.has(e.id)) continue;
          const d = Math.hypot(proj.x - e.x, proj.y - e.y);
          if (d < e.radius) {
            proj.hitIds.add(e.id);
            const crit = Math.random() < eff.critChance;
            const dmg = crit ? Math.round(proj.damage * 1.8) : proj.damage;
            e.hp -= dmg;
            if (proj.kind === "ice") e.slowUntil = now + 1800;
            spawnFloatText(e.x, e.y - 10, crit ? `${dmg}!` : `-${dmg}`, crit ? "#ffb703" : "#ffe14d");
            spawnParticles(proj.x, proj.y, proj.color, crit ? 7 : 4);
            if (proj.pierceLeft > 0) proj.pierceLeft -= 1;
            else return false;
          }
        }
        return true;
      });

      const survivors = [];
      for (const e of enemiesRef.current) {
        if (e.hp <= 0) {
          killsRef.current += 1;
          s.gold += e.gold;
          spawnParticles(e.x, e.y, e.isBoss ? "#ffb703" : e.isElite ? "#ff3ea5" : "#b45cff", e.isBoss ? 24 : e.isElite ? 16 : 10);
          gemsRef.current.push({ id: Math.random(), x: e.x, y: e.y, value: e.xp });
          if (e.isBoss) spawnFloatText(e.x, e.y - 20, "GUARDIAN DEFEATED!", "#ffb703");
        } else {
          survivors.push(e);
        }
      }
      enemiesRef.current = survivors;

      gemsRef.current = gemsRef.current.filter((g) => {
        const d = Math.hypot(p.x - g.x, p.y - g.y);
        if (d < 34) {
          const speed = 3;
          g.x += ((p.x - g.x) / d) * speed;
          g.y += ((p.y - g.y) / d) * speed;
        }
        if (d < 10) {
          grantXp(g.value);
          return false;
        }
        return true;
      });

      particlesRef.current = particlesRef.current.filter((pt) => {
        pt.x += pt.vx;
        pt.y += pt.vy;
        pt.vy += 0.03;
        pt.life -= 0.05;
        return pt.life > 0;
      });
      floatTextRef.current = floatTextRef.current.filter((ft) => {
        ft.y -= 0.5;
        ft.life -= 0.02;
        return ft.life > 0;
      });
      telegraphRef.current = telegraphRef.current.filter((tg) => {
        tg.radius = Math.min(tg.maxRadius, tg.radius + 6);
        tg.life -= 0.05;
        return tg.life > 0;
      });

      setHud({
        hp: Math.round(s.hp),
        maxHp: Math.round(eff.maxHp),
        level: levelRef.current,
        xp: xpRef.current,
        xpNeeded: xpForLevel(levelRef.current),
        timeLeft: Math.max(0, Math.ceil(SESSION_SECONDS - elapsedRef.current)),
        kills: killsRef.current,
        gold: s.gold,
      });

      if (elapsedRef.current >= SESSION_SECONDS) endRun(true);
    }, TICK_MS);
  }

  useEffect(() => () => clearInterval(simIntervalRef.current), []);

  useEffect(() => {
    if (phase !== "playing" && phase !== "levelup") return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");

    function render() {
      ctx.fillStyle = "#0d0720";
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);
      ctx.strokeStyle = "rgba(169,159,214,0.12)";
      for (let gx = 0; gx < ARENA_W; gx += 40) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, ARENA_H); ctx.stroke();
      }
      for (let gy = 0; gy < ARENA_H; gy += 40) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(ARENA_W, gy); ctx.stroke();
      }

      for (const tg of telegraphRef.current) {
        ctx.globalAlpha = Math.max(0, tg.life * 0.6);
        ctx.strokeStyle = "#ff3ea5";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(tg.x, tg.y, tg.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      for (const g of gemsRef.current) {
        ctx.fillStyle = "#b45cff";
        ctx.beginPath();
        ctx.arc(g.x, g.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const e of enemiesRef.current) {
        drawSprite(ctx, e.type, e.x, e.y, e.isBoss ? CELL * 1.9 : e.isElite ? CELL * 1.3 : CELL);
        const barW = e.isBoss ? 60 : e.isElite ? 26 : 20;
        ctx.fillStyle = "#000";
        ctx.fillRect(e.x - barW / 2, e.y - (e.isBoss ? 36 : e.isElite ? 20 : 16), barW, 3);
        ctx.fillStyle = e.isBoss ? "#ffb703" : e.isElite ? "#ff3ea5" : "#b45cff";
        ctx.fillRect(e.x - barW / 2, e.y - (e.isBoss ? 36 : e.isElite ? 20 : 16), barW * (e.hp / e.maxHp), 3);
      }

      for (const proj of projectilesRef.current) {
        ctx.fillStyle = proj.color;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.kind === "fire" ? 4 : 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const pt of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, pt.life);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - 1.5, pt.y - 1.5, 3, 3);
        ctx.globalAlpha = 1;
      }

      const p = playerPosRef.current;
      const blinking = invulnRef.current > 0 && Math.floor(invulnRef.current / 3) % 2 === 0;
      if (!blinking) drawSprite(ctx, "arcanist", p.x, p.y, CELL);

      for (const ft of floatTextRef.current) {
        ctx.globalAlpha = Math.max(0, ft.life);
        ctx.fillStyle = ft.color;
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 1;
      }

      frameRef.current = requestAnimationFrame(render);
    }
    render();
    return () => cancelAnimationFrame(frameRef.current);
  }, [phase]);

  useEffect(() => {
    function handleKey(e, down) {
      const map = { ArrowUp: "y-1", ArrowDown: "y1", ArrowLeft: "x-1", ArrowRight: "x1", w: "y-1", s: "y1", a: "x-1", d: "x1" };
      const code = map[e.key];
      if (!code) return;
      const axis = code[0];
      const val = down ? parseInt(code.slice(1), 10) : 0;
      moveInputRef.current = { ...moveInputRef.current, [axis]: val };
    }
    const kd = (e) => handleKey(e, true);
    const ku = (e) => handleKey(e, false);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => {
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
    };
  }, []);

  function setMove(x, y) {
    moveInputRef.current = { x, y };
  }

  if (deviceOk === null) return null;

  if (!deviceOk) {
    return (
      <div className="text-center py-10">
        <p className="text-3xl mb-4">💻</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">LAPTOP OR DESKTOP REQUIRED</p>
        <p className="text-textDim text-sm max-w-xs mx-auto">
          Arcane Survivor is built for laptop and desktop play. Please switch to a larger screen to enter the arena.
        </p>
      </div>
    );
  }

  if (phase === "menu") {
    return (
      <div className="text-center max-w-sm mx-auto">
        <p className="text-3xl mb-4">🔮</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">ARCANE SURVIVOR</p>
        <p className="text-textDim text-sm mb-6">
          Survive {Math.round(SESSION_SECONDS / 60)} minutes. Up to 3 weapons fire automatically at once — pick new
          ones and level them up every time you level up. Max out Arcane Bolt while carrying the Ancient Tome to
          evolve it. Elite enemies rise every minute; the Ancient Guardian awakens partway through, with a real
          phase change at half health.
        </p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          ENTER THE ARENA
        </button>
      </div>
    );
  }

  if (phase === "over") {
    return (
      <div className="text-center">
        <p className="text-3xl mb-3">{outcome === "victory" ? "🌟" : "💀"}</p>
        <p className="font-pixel text-sm mb-2" style={{ color: outcome === "victory" ? "#ffb703" : "#ff3ea5" }}>
          {outcome === "victory" ? "THE ARCANE HOLDS" : "OVERRUN"}
        </p>
        <p className="font-mono text-xs text-textDim">Level {hud.level} · {hud.kills} kills · 🪙 {hud.gold}</p>
      </div>
    );
  }

  return (
    <div className="text-center relative">
      {evolveFlash && (
        <div className="absolute inset-x-0 -top-2 z-20 flex items-center justify-center pointer-events-none">
          <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/90 px-4 py-2 rounded-lg">ARCANE BOLT EVOLVED → ARCANE NOVA!</p>
        </div>
      )}
      <div className="flex justify-between font-mono text-[11px] mb-2 text-textDim max-w-[480px] mx-auto">
        <span>Lv.{hud.level} · {hud.kills} kills · 🪙 {hud.gold}</span>
        <span>⏱️ {Math.floor(hud.timeLeft / 60)}:{String(hud.timeLeft % 60).padStart(2, "0")}</span>
      </div>
      <div className="max-w-[480px] mx-auto mb-1">
        <div className="h-2 rounded-full bg-bgDeep border border-lineColor overflow-hidden">
          <div className="h-full" style={{ width: `${(hud.hp / hud.maxHp) * 100}%`, background: hud.hp < hud.maxHp * 0.3 ? "#ff3ea5" : "#6bff6b" }} />
        </div>
        <div className="h-1 rounded-full bg-bgDeep overflow-hidden mt-1">
          <div className="h-full bg-accentCyan" style={{ width: `${(hud.xp / hud.xpNeeded) * 100}%` }} />
        </div>
      </div>
      <div className="flex justify-center gap-2 mb-2">
        {weaponBar.map((id) => (
          <span key={id} className="text-lg" title={WEAPON_DEFS[id].name}>{WEAPON_DEFS[id].icon}</span>
        ))}
      </div>

      <div className="relative mx-auto rounded-lg overflow-hidden border border-lineColor" style={{ width: ARENA_W, maxWidth: "94vw" }}>
        <canvas ref={canvasRef} width={ARENA_W} height={ARENA_H} style={{ width: "100%", height: "auto", display: "block" }} />

        {phase === "levelup" && (
          <div className="absolute inset-0 bg-bgDeep/90 flex flex-col items-center justify-center p-4">
            <p className="font-pixel text-xs text-accentAmber mb-4 ap-blink">LEVEL UP — CHOOSE ONE</p>
            <div className="space-y-2 w-full max-w-xs">
              {upgradeChoices.map((u, i) => (
                <button
                  key={i}
                  onClick={() => chooseUpgrade(u)}
                  className="w-full text-left rounded-md border-2 p-3 hover:bg-bgPanel3"
                  style={{ borderColor: RARITY[u.rarity].color }}
                >
                  <p className="font-mono text-[9px] mb-0.5" style={{ color: RARITY[u.rarity].color }}>
                    {RARITY[u.rarity].label.toUpperCase()}
                  </p>
                  <p className="font-mono text-xs text-textLight">{u.icon} {u.name}</p>
                  <p className="font-mono text-[10px] text-textDim">{u.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 max-w-[180px] mx-auto mt-4 sm:hidden">
        <div />
        <button onMouseDown={() => setMove(0, -1)} onMouseUp={() => setMove(0, 0)} onTouchStart={() => setMove(0, -1)} onTouchEnd={() => setMove(0, 0)} className="py-2.5 rounded-md border border-lineColor">▲</button>
        <div />
        <button onMouseDown={() => setMove(-1, 0)} onMouseUp={() => setMove(0, 0)} onTouchStart={() => setMove(-1, 0)} onTouchEnd={() => setMove(0, 0)} className="py-2.5 rounded-md border border-lineColor">◀</button>
        <button onMouseDown={() => setMove(0, 1)} onMouseUp={() => setMove(0, 0)} onTouchStart={() => setMove(0, 1)} onTouchEnd={() => setMove(0, 0)} className="py-2.5 rounded-md border border-lineColor">▼</button>
        <button onMouseDown={() => setMove(1, 0)} onMouseUp={() => setMove(0, 0)} onTouchStart={() => setMove(1, 0)} onTouchEnd={() => setMove(0, 0)} className="py-2.5 rounded-md border border-lineColor">▶</button>
      </div>
      <p className="font-mono text-[10px] text-textDim mt-3 hidden sm:block">Move with WASD or the arrow keys — all owned weapons fire automatically.</p>
    </div>
  );
}
