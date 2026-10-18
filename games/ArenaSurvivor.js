"use client";

import { useEffect, useRef, useState } from "react";
import { drawSprite } from "@/lib/pixelSprites";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const ARENA_W = 480;
const ARENA_H = 420;
const CELL = 5;
const TICK_MS = 33;
const TOTAL_WAVES = 8;
const MID_BOSS_WAVE = 4;
const FINAL_BOSS_WAVE = 8;
const MAX_WEAPON_SLOTS = 6;

const TIERS = ["common", "rare", "epic", "legendary"];
const TIER_COLOR = { common: "#a99fd6", rare: "#3ee6e0", epic: "#b45cff", legendary: "#ffb703" };
const TIER_MULT = { common: 1, rare: 1.7, epic: 2.6, legendary: 4 };

const ENEMY_TYPES = {
  charger: { sprite: "charger", hp: 6, speed: 2.6, damage: 6, radius: 9 },
  walker: { sprite: "ghoul", hp: 16, speed: 1.1, damage: 8, radius: 12 },
  tank: { sprite: "tank", hp: 40, speed: 0.6, damage: 10, radius: 16 },
  exploder: { sprite: "exploder", hp: 10, speed: 1.4, damage: 4, radius: 10, explodeDamage: 16, explodeRadius: 40 },
};

const WEAPON_DEFS = {
  pistol: { name: "Pistol", icon: "🔫", baseCooldown: 700, baseDamage: 15, kind: "bolt", pierce: 0 },
  smg: { name: "SMG", icon: "💨", baseCooldown: 300, baseDamage: 6, kind: "bolt", pierce: 0 },
  shotgun: { name: "Shotgun", icon: "💥", baseCooldown: 1100, baseDamage: 9, kind: "spread", pellets: 5 },
  spear: { name: "Spear", icon: "🔱", baseCooldown: 950, baseDamage: 14, kind: "bolt", pierce: 3 },
};

const STAT_ITEMS = [
  { id: "protein", name: "Protein Powder", icon: "💪", cost: 12, desc: "+3 damage", apply: (s) => ({ ...s, damageBonus: s.damageBonus + 3 }) },
  { id: "shoes", name: "Running Shoes", icon: "👟", cost: 10, desc: "+8% move speed", apply: (s) => ({ ...s, speedMult: s.speedMult + 0.08 }) },
  { id: "energy", name: "Energy Drink", icon: "⚡", cost: 14, desc: "-8% weapon cooldown", apply: (s) => ({ ...s, cooldownMult: Math.max(0.4, s.cooldownMult - 0.08) }) },
  { id: "shield", name: "Shield Core", icon: "🛡️", cost: 13, desc: "+8% damage reduction", apply: (s) => ({ ...s, armor: Math.min(0.7, s.armor + 0.08) }) },
  { id: "medkit", name: "Medical Kit", icon: "🩹", cost: 8, desc: "Heal 40% HP now", apply: (s) => ({ ...s, healNow: true }) },
];

function freshPlayerState() {
  return {
    hp: 60,
    maxHp: 60,
    baseSpeed: 2.3,
    speedMult: 1,
    damageBonus: 0,
    cooldownMult: 1,
    armor: 0,
    material: 0,
  };
}

function weaponUid() {
  return `${Date.now()}-${Math.random()}`;
}

function mergeWeapons(weapons) {
  let changed = true;
  let list = [...weapons];
  while (changed) {
    changed = false;
    for (const type of Object.keys(WEAPON_DEFS)) {
      for (const tier of TIERS) {
        if (tier === "legendary") continue;
        const matches = list.filter((w) => w.type === type && w.tier === tier);
        if (matches.length >= 3) {
          const nextTier = TIERS[TIERS.indexOf(tier) + 1];
          const toRemove = new Set(matches.slice(0, 3).map((w) => w.uid));
          list = list.filter((w) => !toRemove.has(w.uid));
          list.push({ uid: weaponUid(), type, tier: nextTier });
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
  return list;
}

function rollShopOffers(weapons) {
  const offers = [];
  const canAddWeapon = weapons.length < MAX_WEAPON_SLOTS;
  const weaponTypes = Object.keys(WEAPON_DEFS);
  for (let i = 0; i < 4; i++) {
    if (canAddWeapon && Math.random() < 0.55) {
      const type = weaponTypes[Math.floor(Math.random() * weaponTypes.length)];
      offers.push({ kind: "weapon", type, cost: 16 + Math.floor(Math.random() * 8) });
    } else {
      const item = STAT_ITEMS[Math.floor(Math.random() * STAT_ITEMS.length)];
      offers.push({ kind: "item", ...item });
    }
  }
  return offers;
}

export default function ArenaSurvivor({ onFinish, accentColor }) {
  const canvasRef = useRef(null);
  const [deviceOk, setDeviceOk] = useState(null);
  const [phase, setPhase] = useState("menu");
  const [hud, setHud] = useState({ hp: 60, maxHp: 60, wave: 1, waveTimeLeft: 20, material: 0, kills: 0 });
  const [weaponBar, setWeaponBar] = useState([]);
  const [shopOffers, setShopOffers] = useState([]);
  const [outcome, setOutcome] = useState(null);

  const playerStatsRef = useRef(freshPlayerState());
  const weaponsRef = useRef([]);
  const playerPosRef = useRef({ x: ARENA_W / 2, y: ARENA_H / 2 });
  const moveInputRef = useRef({ x: 0, y: 0 });
  const invulnRef = useRef(0);
  const enemiesRef = useRef([]);
  const projectilesRef = useRef([]);
  const particlesRef = useRef([]);
  const floatTextRef = useRef([]);
  const telegraphRef = useRef([]);
  const weaponCooldownsRef = useRef({});
  const killsRef = useRef(0);
  const waveRef = useRef(1);
  const waveElapsedRef = useRef(0);
  const waveDurationRef = useRef(20);
  const spawnTimerRef = useRef(0);
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
    playerStatsRef.current = freshPlayerState();
    weaponsRef.current = [{ uid: weaponUid(), type: "pistol", tier: "common" }];
    playerPosRef.current = { x: ARENA_W / 2, y: ARENA_H / 2 };
    invulnRef.current = 0;
    enemiesRef.current = [];
    projectilesRef.current = [];
    particlesRef.current = [];
    floatTextRef.current = [];
    telegraphRef.current = [];
    weaponCooldownsRef.current = {};
    killsRef.current = 0;
    waveRef.current = 1;
    waveElapsedRef.current = 0;
    waveDurationRef.current = 18;
    spawnTimerRef.current = 0;
    pausedRef.current = false;
    finishedRef.current = false;
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

  function spawnEnemy(forcedType) {
    const wave = waveRef.current;
    const pool = wave < 3 ? ["charger", "walker"] : wave < 6 ? ["charger", "walker", "exploder"] : ["charger", "walker", "tank", "exploder"];
    const type = forcedType || pool[Math.floor(Math.random() * pool.length)];
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    if (edge === 0) { x = Math.random() * ARENA_W; y = -20; }
    else if (edge === 1) { x = ARENA_W + 20; y = Math.random() * ARENA_H; }
    else if (edge === 2) { x = Math.random() * ARENA_W; y = ARENA_H + 20; }
    else { x = -20; y = Math.random() * ARENA_H; }

    const def = ENEMY_TYPES[type];
    const scale = Math.pow(1.15, wave - 1);
    enemiesRef.current.push({
      id: Math.random(),
      type,
      x,
      y,
      hp: Math.round(def.hp * scale),
      maxHp: Math.round(def.hp * scale),
      speed: def.speed * (1 + (wave - 1) * 0.03),
      damage: Math.round(def.damage * Math.pow(1.08, wave - 1)),
      radius: def.radius,
      explodeDamage: def.explodeDamage,
      explodeRadius: def.explodeRadius,
    });
  }

  function spawnBoss(kind) {
    const isFinal = kind === "final";
    enemiesRef.current.push({
      id: Math.random(),
      type: isFinal ? "voidoverlord" : "arenaguardian",
      x: ARENA_W / 2,
      y: -30,
      hp: isFinal ? 420 : 220,
      maxHp: isFinal ? 420 : 220,
      speed: 0.7,
      damage: isFinal ? 18 : 14,
      radius: 24,
      isBoss: true,
      bossPhase: 1,
      chargeCooldown: 0,
    });
    spawnFloatText(ARENA_W / 2, 60, isFinal ? "THE VOID OVERLORD DESCENDS" : "THE ARENA GUARDIAN RISES", "#ff3ea5");
    sfx.levelUp();
  }

  function fireWeapon(w, p) {
    const def = WEAPON_DEFS[w.type];
    const mult = TIER_MULT[w.tier];
    const damage = Math.round((def.baseDamage + playerStatsRef.current.damageBonus) * mult);
    const enemies = enemiesRef.current;
    if (!enemies.length) return;
    let nearest = null, nearestDist = Infinity;
    for (const e of enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < nearestDist) { nearestDist = d; nearest = e; }
    }
    const baseAngle = Math.atan2(nearest.y - p.y, nearest.x - p.x);

    if (def.kind === "spread") {
      for (let i = 0; i < def.pellets; i++) {
        const angle = baseAngle + (i - (def.pellets - 1) / 2) * 0.16;
        projectilesRef.current.push({ x: p.x, y: p.y, vx: Math.cos(angle) * 5, vy: Math.sin(angle) * 5, damage: Math.round(damage * 0.6), pierceLeft: 0, hitIds: new Set(), life: 40, color: TIER_COLOR[w.tier] });
      }
    } else {
      projectilesRef.current.push({ x: p.x, y: p.y, vx: Math.cos(baseAngle) * 6, vy: Math.sin(baseAngle) * 6, damage, pierceLeft: def.pierce, hitIds: new Set(), life: 90, color: TIER_COLOR[w.tier] });
    }
  }

  function openShop() {
    pausedRef.current = true;
    setShopOffers(rollShopOffers(weaponsRef.current));
    setPhase("shop");
  }

  function buyOffer(offer) {
    const s = playerStatsRef.current;
    if (offer.kind === "weapon") {
      if (s.material < offer.cost || weaponsRef.current.length >= MAX_WEAPON_SLOTS) return;
      s.material -= offer.cost;
      weaponsRef.current = mergeWeapons([...weaponsRef.current, { uid: weaponUid(), type: offer.type, tier: "common" }]);
      setWeaponBar(weaponsRef.current.map((w) => `${w.type}-${w.tier}-${w.uid}`));
      sfx.correct();
    } else {
      if (s.material < offer.cost) return;
      s.material -= offer.cost;
      const applied = offer.apply(s);
      playerStatsRef.current = { ...s, ...applied };
      if (applied.healNow) {
        playerStatsRef.current.hp = Math.min(playerStatsRef.current.maxHp, playerStatsRef.current.hp + playerStatsRef.current.maxHp * 0.4);
      }
      sfx.correct();
    }
    setHud((h) => ({ ...h, material: playerStatsRef.current.material }));
  }

  function nextWave() {
    waveRef.current += 1;
    waveElapsedRef.current = 0;
    waveDurationRef.current = 18 + waveRef.current * 2;
    enemiesRef.current = [];
    projectilesRef.current = [];
    pausedRef.current = false;
    setPhase("wave");
  }

  function endRun(won) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(simIntervalRef.current);
    setOutcome(won ? "victory" : "defeat");
    setPhase("over");
    sfx[won ? "newBest" : "lose"]();
    const score = killsRef.current * 8 + waveRef.current * 60 + playerStatsRef.current.material;
    setTimeout(() => onFinish(Math.max(0, score)), 1400);
  }

  function begin() {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    resetRun();
    setOutcome(null);
    setWeaponBar(weaponsRef.current.map((w) => `${w.type}-${w.tier}-${w.uid}`));
    setPhase("wave");

    simIntervalRef.current = setInterval(() => {
      if (pausedRef.current) return;
      waveElapsedRef.current += TICK_MS / 1000;
      const s = playerStatsRef.current;
      const p = playerPosRef.current;
      const now = waveElapsedRef.current * 1000;

      const mv = moveInputRef.current;
      if (mv.x || mv.y) {
        const mag = Math.hypot(mv.x, mv.y) || 1;
        p.x = Math.max(12, Math.min(ARENA_W - 12, p.x + (mv.x / mag) * s.baseSpeed * s.speedMult));
        p.y = Math.max(12, Math.min(ARENA_H - 12, p.y + (mv.y / mag) * s.baseSpeed * s.speedMult));
      }

      for (const w of weaponsRef.current) {
        const def = WEAPON_DEFS[w.type];
        const cd = def.baseCooldown * s.cooldownMult;
        const last = weaponCooldownsRef.current[w.uid] || 0;
        if (now - last > cd) {
          weaponCooldownsRef.current[w.uid] = now;
          fireWeapon(w, p);
        }
      }

      const isBossWave = waveRef.current === MID_BOSS_WAVE || waveRef.current === FINAL_BOSS_WAVE;
      if (isBossWave) {
        if (enemiesRef.current.length === 0 && waveElapsedRef.current < 0.5) {
          spawnBoss(waveRef.current === FINAL_BOSS_WAVE ? "final" : "mid");
        }
      } else {
        spawnTimerRef.current += TICK_MS;
        const spawnEvery = Math.max(260, 950 - waveRef.current * 60);
        if (spawnTimerRef.current > spawnEvery) {
          spawnTimerRef.current = 0;
          spawnEnemy();
        }
      }

      if (invulnRef.current > 0) invulnRef.current -= 1;
      for (const e of enemiesRef.current) {
        if (e.isBoss && e.bossPhase === 1 && e.hp <= e.maxHp * 0.5) {
          e.bossPhase = 2;
          e.speed *= 1.3;
          telegraphRef.current.push({ x: e.x, y: e.y, radius: 6, maxRadius: 80, life: 1 });
          spawnFloatText(e.x, e.y - 26, "PHASE 2", "#ffb703");
          sfx.boost();
        }

        if (e.isBoss && e.bossPhase === 2) {
          e.chargeCooldown -= TICK_MS;
          if (e.chargeCooldown <= 0) {
            e.chargeCooldown = 2600;
            e.chargingToward = { x: p.x, y: p.y };
            spawnFloatText(e.x, e.y - 20, "CHARGING!", "#ff3ea5");
          }
        }

        if (e.chargingToward) {
          const cdx = e.chargingToward.x - e.x;
          const cdy = e.chargingToward.y - e.y;
          const cdist = Math.hypot(cdx, cdy) || 1;
          if (cdist > 6) {
            e.x += (cdx / cdist) * e.speed * 4;
            e.y += (cdy / cdist) * e.speed * 4;
          } else {
            e.chargingToward = null;
          }
        } else {
          const dx = p.x - e.x;
          const dy = p.y - e.y;
          const dist = Math.hypot(dx, dy) || 1;
          e.x += (dx / dist) * e.speed;
          e.y += (dy / dist) * e.speed;
        }

        const dist2 = Math.hypot(p.x - e.x, p.y - e.y);
        if (dist2 < e.radius + 10 && invulnRef.current === 0) {
          const reduced = Math.round(e.damage * (1 - s.armor));
          s.hp = Math.max(0, s.hp - reduced);
          invulnRef.current = 18;
          spawnParticles(p.x, p.y, "#ff3ea5", 6);
          haptics.tap();
          if (s.hp <= 0) { endRun(false); return; }
        }
      }

      projectilesRef.current = projectilesRef.current.filter((proj) => {
        proj.x += proj.vx;
        proj.y += proj.vy;
        proj.life -= 1;
        if (proj.life <= 0 || proj.x < -20 || proj.x > ARENA_W + 20 || proj.y < -20 || proj.y > ARENA_H + 20) return false;
        for (const e of enemiesRef.current) {
          if (proj.hitIds.has(e.id)) continue;
          const d = Math.hypot(proj.x - e.x, proj.y - e.y);
          if (d < e.radius) {
            proj.hitIds.add(e.id);
            e.hp -= proj.damage;
            spawnFloatText(e.x, e.y - 10, `-${proj.damage}`, "#ffe14d");
            spawnParticles(proj.x, proj.y, proj.color, 4);
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
          s.material += e.isBoss ? 40 : 2;
          spawnParticles(e.x, e.y, e.isBoss ? "#ffb703" : "#b45cff", e.isBoss ? 24 : 10);
          if (e.type === "exploder") {
            const dToPlayer = Math.hypot(p.x - e.x, p.y - e.y);
            if (dToPlayer < e.explodeRadius) {
              const reduced = Math.round(e.explodeDamage * (1 - s.armor));
              s.hp = Math.max(0, s.hp - reduced);
              spawnFloatText(p.x, p.y - 14, `BOOM -${reduced}`, "#ff5a3c");
              if (s.hp <= 0) { endRun(false); }
            }
            spawnParticles(e.x, e.y, "#ff5a3c", 18);
          }
          if (e.isBoss) spawnFloatText(e.x, e.y - 20, "BOSS DEFEATED!", "#ffb703");
        } else {
          survivors.push(e);
        }
      }
      enemiesRef.current = survivors;

      particlesRef.current = particlesRef.current.filter((pt) => {
        pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.03; pt.life -= 0.05;
        return pt.life > 0;
      });
      floatTextRef.current = floatTextRef.current.filter((ft) => {
        ft.y -= 0.5; ft.life -= 0.02;
        return ft.life > 0;
      });
      telegraphRef.current = telegraphRef.current.filter((tg) => {
        tg.radius = Math.min(tg.maxRadius, tg.radius + 6); tg.life -= 0.05;
        return tg.life > 0;
      });

      setHud({
        hp: Math.round(s.hp),
        maxHp: s.maxHp,
        wave: waveRef.current,
        waveTimeLeft: Math.max(0, Math.ceil(waveDurationRef.current - waveElapsedRef.current)),
        material: Math.round(s.material),
        kills: killsRef.current,
      });

      const waveCleared = isBossWave ? enemiesRef.current.length === 0 && waveElapsedRef.current > 1 : waveElapsedRef.current >= waveDurationRef.current;
      if (waveCleared) {
        if (waveRef.current >= TOTAL_WAVES) {
          endRun(true);
        } else {
          openShop();
        }
      }
    }, TICK_MS);
  }

  useEffect(() => () => clearInterval(simIntervalRef.current), []);

  useEffect(() => {
    if (phase !== "wave" && phase !== "shop") return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");

    function render() {
      ctx.fillStyle = "#0a0e1a";
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);
      ctx.strokeStyle = "rgba(62,230,224,0.08)";
      for (let gx = 0; gx < ARENA_W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, ARENA_H); ctx.stroke(); }
      for (let gy = 0; gy < ARENA_H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(ARENA_W, gy); ctx.stroke(); }

      for (const tg of telegraphRef.current) {
        ctx.globalAlpha = Math.max(0, tg.life * 0.6);
        ctx.strokeStyle = "#ff3ea5";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.radius, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      for (const e of enemiesRef.current) {
        drawSprite(ctx, e.type, e.x, e.y, e.isBoss ? CELL * 2 : CELL);
        const barW = e.isBoss ? 60 : 20;
        ctx.fillStyle = "#000";
        ctx.fillRect(e.x - barW / 2, e.y - (e.isBoss ? 38 : 16), barW, 3);
        ctx.fillStyle = e.isBoss ? "#ffb703" : "#ff3ea5";
        ctx.fillRect(e.x - barW / 2, e.y - (e.isBoss ? 38 : 16), barW * (e.hp / e.maxHp), 3);
      }

      for (const proj of projectilesRef.current) {
        ctx.fillStyle = proj.color;
        ctx.beginPath(); ctx.arc(proj.x, proj.y, 2.5, 0, Math.PI * 2); ctx.fill();
      }

      for (const pt of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, pt.life);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - 1.5, pt.y - 1.5, 3, 3);
        ctx.globalAlpha = 1;
      }

      const p = playerPosRef.current;
      const blinking = invulnRef.current > 0 && Math.floor(invulnRef.current / 3) % 2 === 0;
      if (!blinking) drawSprite(ctx, "trooper", p.x, p.y, CELL);

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
      // Without this, the browser also scrolls the page on every
      // arrow-key press — this is what was moving the screen along
      // with the character.
      e.preventDefault();
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
          Arena Survivor is built for laptop and desktop play. Please switch to a larger screen to enter the arena.
        </p>
      </div>
    );
  }

  if (phase === "menu") {
    return (
      <div className="text-center max-w-sm mx-auto">
        <p className="text-3xl mb-4">🎯</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">ARENA SURVIVOR</p>
        <p className="text-textDim text-sm mb-6">
          {TOTAL_WAVES} waves. Survive each one, then spend Material in the shop between waves — buy new weapons or
          stat upgrades. Collect 3 of the same weapon at the same tier and they fuse into a stronger one
          automatically. A mid-boss rises at wave {MID_BOSS_WAVE}, the Void Overlord at wave {FINAL_BOSS_WAVE}.
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
        <p className="text-3xl mb-3">{outcome === "victory" ? "🏆" : "💀"}</p>
        <p className="font-pixel text-sm mb-2" style={{ color: outcome === "victory" ? "#ffb703" : "#ff3ea5" }}>
          {outcome === "victory" ? "ARENA CLEARED" : "OVERRUN"}
        </p>
        <p className="font-mono text-xs text-textDim">Wave {hud.wave} · {hud.kills} kills · 🔧 {hud.material}</p>
      </div>
    );
  }

  if (phase === "shop") {
    return (
      <div className="text-center max-w-md mx-auto">
        <p className="font-pixel text-xs text-accentAmber mb-1">SHOP — WAVE {waveRef.current} CLEARED</p>
        <p className="font-mono text-[11px] text-textDim mb-4">🔧 {hud.material} Material</p>
        <div className="grid sm:grid-cols-2 gap-2 mb-5">
          {shopOffers.map((offer, i) => {
            const canAfford = hud.material >= offer.cost;
            return (
              <button
                key={i}
                onClick={() => buyOffer(offer)}
                disabled={!canAfford}
                className="text-left rounded-md border p-3 disabled:opacity-40 hover:bg-bgPanel3"
                style={{ borderColor: offer.kind === "weapon" ? TIER_COLOR.common : "rgba(169,159,214,0.3)" }}
              >
                <p className="font-mono text-xs text-textLight">
                  {offer.kind === "weapon" ? WEAPON_DEFS[offer.type].icon : offer.icon}{" "}
                  {offer.kind === "weapon" ? WEAPON_DEFS[offer.type].name : offer.name}
                </p>
                <p className="font-mono text-[10px] text-textDim mb-1">{offer.kind === "weapon" ? "New weapon (Common)" : offer.desc}</p>
                <p className="font-mono text-[10px] text-accentAmber">🔧 {offer.cost}</p>
              </button>
            );
          })}
        </div>
        <button onClick={nextWave} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START WAVE {waveRef.current + 1} ▸
        </button>
      </div>
    );
  }

  return (
    <div className="text-center relative">
      <div className="flex justify-between font-mono text-[11px] mb-2 text-textDim max-w-[480px] mx-auto">
        <span>Wave {hud.wave}/{TOTAL_WAVES} · {hud.kills} kills</span>
        <span>⏱️ {hud.waveTimeLeft}s · 🔧 {hud.material}</span>
      </div>
      <div className="max-w-[480px] mx-auto mb-2">
        <div className="h-2 rounded-full bg-bgDeep border border-lineColor overflow-hidden">
          <div className="h-full" style={{ width: `${(hud.hp / hud.maxHp) * 100}%`, background: hud.hp < hud.maxHp * 0.3 ? "#ff3ea5" : "#6bff6b" }} />
        </div>
      </div>
      <div className="flex justify-center gap-1.5 mb-2 flex-wrap">
        {weaponsRef.current.map((w) => (
          <span key={w.uid} className="text-base" style={{ filter: `drop-shadow(0 0 3px ${TIER_COLOR[w.tier]})` }} title={`${WEAPON_DEFS[w.type].name} (${w.tier})`}>
            {WEAPON_DEFS[w.type].icon}
          </span>
        ))}
      </div>

      <div className="relative mx-auto rounded-lg overflow-hidden border border-lineColor" style={{ width: ARENA_W, maxWidth: "94vw" }}>
        <canvas ref={canvasRef} width={ARENA_W} height={ARENA_H} style={{ width: "100%", height: "auto", display: "block" }} />
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
