"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const ARENA_W = 480;
const ARENA_H = 380;
const GROUND_Y = ARENA_H * 0.62;
const TICK_MS = 33;
const PLAYER_R = 11;
const MELEE_RANGE = 46;
const MELEE_ARC = Math.PI * 0.65;
const MELEE_COOLDOWN_MS = 240;
const PULSE_COOLDOWN_MS = 260;
const HEAT_PER_MELEE = 9;
const HEAT_PER_PULSE = 16;
const HEAT_MAX = 100;
const HEAT_COOLDOWN_LOCK_MS = 1200;
const HEAT_DECAY_PER_TICK = 0.6;
const DASH_TICKS = 6;
const DASH_COOLDOWN_MS = 750;
const DASH_SPEED = 8;

const ENEMY_TYPES = {
  drone: { name: "Sentry Drone", color: "#3ee6e0", hp: 18, speed: 1.0, radius: 9, ranged: true, damage: 8, flying: true },
  enforcer: { name: "Enforcer Unit", color: "#ff5a3c", hp: 42, speed: 1.4, radius: 14, damage: 14 },
  wraith: { name: "Glitch Wraith", color: "#b45cff", hp: 15, speed: 2.2, radius: 9, damage: 9, erratic: true },
};

const WAVES = [
  [{ type: "drone", n: 2 }],
  [{ type: "enforcer", n: 2 }, { type: "wraith", n: 1 }],
  [{ type: "drone", n: 2 }, { type: "enforcer", n: 1 }, { type: "wraith", n: 2 }],
];

const DIFFICULTIES = {
  street: { label: "STREET", hpMult: 0.8, damageMult: 0.8, scoreMult: 1 },
  district: { label: "DISTRICT", hpMult: 1, damageMult: 1, scoreMult: 1.4 },
  eclipse: { label: "ECLIPSE", hpMult: 1.3, damageMult: 1.3, scoreMult: 1.9 },
};

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

export default function EclipseProtocol({ onFinish, accentColor }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [deviceOk, setDeviceOk] = useState(null);
  const [phase, setPhase] = useState("menu");
  const [difficulty, setDifficulty] = useState("district");
  const [difficultyBests, setDifficultyBests] = useState({});
  const [hud, setHud] = useState({ hp: 90, maxHp: 90, heat: 0, wave: 1, totalWaves: 4, dashReady: true, bossHp: 0, bossMaxHp: 1 });
  const [outcome, setOutcome] = useState(null);
  const [waveFlash, setWaveFlash] = useState("");

  const playerRef = useRef({ x: 70, y: GROUND_Y, hp: 90, maxHp: 90, aim: 0, facing: 0, heat: 0, overheated: false, overheatUntil: 0 });
  const moveInputRef = useRef({ x: 0, y: 0 });
  const mouseRef = useRef({ x: ARENA_W / 2, y: GROUND_Y });
  const meleeQueuedRef = useRef(false);
  const pulseQueuedRef = useRef(false);
  const dashQueuedRef = useRef(false);
  const lastMeleeAtRef = useRef(0);
  const lastPulseAtRef = useRef(0);
  const meleeActiveUntilRef = useRef(0);
  const dashRef = useRef({ ticksLeft: 0, dx: 0, dy: 0, cooldownUntil: 0 });
  const invulnRef = useRef(0);
  const enemiesRef = useRef([]);
  const bossRef = useRef(null);
  const waveIndexRef = useRef(0);
  const projectilesRef = useRef([]);
  const particlesRef = useRef([]);
  const floatTextRef = useRef([]);
  const telegraphRef = useRef([]);
  const rainRef = useRef([]);
  const vehiclesRef = useRef([]);
  const hologramsRef = useRef([]);
  const shakeRef = useRef(0);
  const elapsedRef = useRef(0);
  const difficultyRef = useRef("district");
  const finishedRef = useRef(false);

  const simIntervalRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    const isTouchPrimary = window.matchMedia("(pointer: coarse)").matches;
    const isSmall = window.innerWidth < 1024;
    setDeviceOk(!isTouchPrimary && !isSmall);
  }, []);

  useEffect(() => {
    fetch("/api/difficulty-scores?game=eclipseprotocol")
      .then((r) => r.json())
      .then((d) => setDifficultyBests(d.bests || {}))
      .catch(() => {});
  }, []);

  function spawnParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.6 + Math.random() * 1.6;
      particlesRef.current.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color });
    }
  }
  function spawnFloatText(x, y, text, color) {
    floatTextRef.current.push({ x, y, text, color, life: 1 });
  }

  function spawnWaveEnemies(idx) {
    const wave = WAVES[idx];
    const diff = DIFFICULTIES[difficultyRef.current];
    const enemies = [];
    let placed = 0;
    for (const group of wave) {
      const def = ENEMY_TYPES[group.type];
      for (let i = 0; i < group.n; i++) {
        enemies.push({
          id: Math.random(),
          type: group.type,
          x: ARENA_W - 40 - placed * 30,
          y: def.flying ? GROUND_Y - 60 - Math.random() * 40 : GROUND_Y,
          hp: Math.round(def.hp * diff.hpMult),
          maxHp: Math.round(def.hp * diff.hpMult),
          erraticPhase: Math.random() * Math.PI * 2,
          lastShotAt: 0,
        });
        placed += 1;
      }
    }
    return enemies;
  }

  function resetRun() {
    playerRef.current = { x: 70, y: GROUND_Y, hp: 90, maxHp: 90, aim: 0, facing: 0, heat: 0, overheated: false, overheatUntil: 0 };
    moveInputRef.current = { x: 0, y: 0 };
    dashRef.current = { ticksLeft: 0, dx: 0, dy: 0, cooldownUntil: 0 };
    invulnRef.current = 0;
    waveIndexRef.current = 0;
    bossRef.current = null;
    enemiesRef.current = spawnWaveEnemies(0);
    projectilesRef.current = [];
    particlesRef.current = [];
    floatTextRef.current = [];
    telegraphRef.current = [];
    rainRef.current = Array.from({ length: 80 }, () => ({ x: Math.random() * ARENA_W, y: Math.random() * ARENA_H, speed: 7 + Math.random() * 6 }));
    vehiclesRef.current = [
      { x: -40, y: 40, speed: 0.7, len: 34 },
      { x: ARENA_W + 60, y: 80, speed: -0.5, len: 26 },
      { x: -100, y: 20, speed: 0.4, len: 40 },
    ];
    hologramsRef.current = [
      { x: 60, y: 90, w: 30, h: 60, color: "#ff3ea5", phase: 0 },
      { x: 380, y: 70, w: 26, h: 70, color: "#3ee6e0", phase: 2 },
      { x: 220, y: 100, w: 24, h: 50, color: "#b45cff", phase: 4 },
    ];
    shakeRef.current = 0;
    elapsedRef.current = 0;
    finishedRef.current = false;
  }

  function endRun(won) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(simIntervalRef.current);
    setOutcome(won);
    setPhase("over");
    sfx[won ? "newBest" : "lose"]();
    const diff = DIFFICULTIES[difficultyRef.current];
    const score = Math.round((waveIndexRef.current * 130 + (won ? 400 : 0)) * diff.scoreMult);
    fetch("/api/difficulty-scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game: "eclipseprotocol", difficulty: difficultyRef.current, score }),
    }).catch(() => {});
    setTimeout(() => onFinish(Math.max(0, score)), 1500);
  }

  function landHit(target, dmg) {
    target.hp -= dmg;
    spawnFloatText(target.x, target.y - 14, `-${dmg}`, "#ffe14d");
    spawnParticles(target.x, target.y, "#ffe14d", 6);
    shakeRef.current = Math.max(shakeRef.current, 0.25);
    haptics.tap();
  }

  function performMelee(now) {
    const p = playerRef.current;
    meleeActiveUntilRef.current = now + 130;
    p.aim = p.facing;
    const dmg = 13 * DIFFICULTIES[difficultyRef.current].damageMult;
    sfx.hit();
    const targets = [...enemiesRef.current];
    if (bossRef.current) targets.push(bossRef.current);
    for (const e of targets) {
      const d = dist(p.x, p.y, e.x, e.y);
      if (d > MELEE_RANGE) continue;
      const ang = Math.atan2(e.y - p.y, e.x - p.x);
      if (angleDiff(ang, p.aim) > MELEE_ARC / 2) continue;
      landHit(e, Math.round(dmg));
    }
  }

  function performPulse(now) {
    const p = playerRef.current;
    p.aim = Math.atan2(mouseRef.current.y - p.y, mouseRef.current.x - p.x);
    projectilesRef.current.push({
      x: p.x, y: p.y,
      vx: Math.cos(p.aim) * 6.5, vy: Math.sin(p.aim) * 6.5,
      damage: Math.round(11 * DIFFICULTIES[difficultyRef.current].damageMult),
      life: 90, friendly: true,
    });
    spawnParticles(p.x, p.y, accentColor || "#3ee6e0", 4);
    sfx.tap();
  }

  function begin() {
    const el = wrapRef.current?.ownerDocument?.documentElement;
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    difficultyRef.current = difficulty;
    resetRun();
    setOutcome(null);
    setPhase("fighting");
    setWaveFlash("SECTOR 1");
    setTimeout(() => setWaveFlash(""), 1300);

    simIntervalRef.current = setInterval(() => {
      elapsedRef.current += TICK_MS / 1000;
      const p = playerRef.current;
      const now = Date.now();

      p.aim = Math.atan2(mouseRef.current.y - p.y, mouseRef.current.x - p.x);

      p.heat = Math.max(0, p.heat - HEAT_DECAY_PER_TICK);
      if (p.overheated && now > p.overheatUntil) p.overheated = false;

      const dash = dashRef.current;
      if (dashQueuedRef.current && now > dash.cooldownUntil) {
        dashQueuedRef.current = false;
        const mv = moveInputRef.current;
        const mag = Math.hypot(mv.x, mv.y);
        const dirAng = mag > 0.1 ? Math.atan2(mv.y, mv.x) : p.aim;
        dash.dx = Math.cos(dirAng);
        dash.dy = Math.sin(dirAng);
        dash.ticksLeft = DASH_TICKS;
        dash.cooldownUntil = now + DASH_COOLDOWN_MS;
        invulnRef.current = DASH_TICKS + 2;
        spawnParticles(p.x, p.y, accentColor || "#3ee6e0", 8);
        sfx.boost();
      } else {
        dashQueuedRef.current = false;
      }

      if (dash.ticksLeft > 0) {
        p.x += dash.dx * DASH_SPEED;
        p.y += dash.dy * DASH_SPEED * 0.4;
        dash.ticksLeft -= 1;
      } else {
        const mv = moveInputRef.current;
        if (mv.x || mv.y) {
          const mag = Math.hypot(mv.x, mv.y) || 1;
          p.x += (mv.x / mag) * 2.5;
          p.y += (mv.y / mag) * 1.2;
          p.facing = Math.atan2(mv.y, mv.x);
        }
      }
      p.x = Math.max(PLAYER_R, Math.min(ARENA_W - PLAYER_R, p.x));
      p.y = Math.max(GROUND_Y - 60, Math.min(ARENA_H - 20, p.y));
      if (invulnRef.current > 0) invulnRef.current -= 1;

      if (!p.overheated && meleeQueuedRef.current && now - lastMeleeAtRef.current > MELEE_COOLDOWN_MS) {
        meleeQueuedRef.current = false;
        lastMeleeAtRef.current = now;
        performMelee(now);
        p.heat = Math.min(HEAT_MAX, p.heat + HEAT_PER_MELEE);
        if (p.heat >= HEAT_MAX) { p.overheated = true; p.overheatUntil = now + HEAT_COOLDOWN_LOCK_MS; sfx.lose(); }
      } else {
        meleeQueuedRef.current = false;
      }
      if (!p.overheated && pulseQueuedRef.current && now - lastPulseAtRef.current > PULSE_COOLDOWN_MS) {
        pulseQueuedRef.current = false;
        lastPulseAtRef.current = now;
        performPulse(now);
        p.heat = Math.min(HEAT_MAX, p.heat + HEAT_PER_PULSE);
        if (p.heat >= HEAT_MAX) { p.overheated = true; p.overheatUntil = now + HEAT_COOLDOWN_LOCK_MS; sfx.lose(); }
      } else {
        pulseQueuedRef.current = false;
      }

      const survivors = [];
      for (const e of enemiesRef.current) {
        const def = ENEMY_TYPES[e.type];
        if (e.hp <= 0) { spawnParticles(e.x, e.y, def.color, 12); continue; }
        const d = dist(p.x, p.y, e.x, e.y);
        if (def.ranged) {
          if (d > 150) {
            const ang = Math.atan2(p.y - e.y, p.x - e.x);
            e.x += Math.cos(ang) * def.speed;
          }
          if (now - e.lastShotAt > 1700) {
            e.lastShotAt = now;
            const ang = Math.atan2(p.y - e.y, p.x - e.x);
            projectilesRef.current.push({ x: e.x, y: e.y, vx: Math.cos(ang) * 3, vy: Math.sin(ang) * 3, damage: def.damage, life: 120, color: def.color });
          }
        } else if (def.erratic) {
          e.erraticPhase += 0.08;
          const ang = Math.atan2(p.y - e.y, p.x - e.x) + Math.sin(e.erraticPhase) * 0.8;
          e.x += Math.cos(ang) * def.speed;
          e.y += Math.sin(ang) * def.speed * 0.3;
        } else {
          const ang = Math.atan2(p.y - e.y, p.x - e.x);
          e.x += Math.cos(ang) * def.speed;
        }
        e.y = Math.max(GROUND_Y - 70, Math.min(ARENA_H - 20, e.y));
        if (d < def.radius + PLAYER_R && invulnRef.current === 0) {
          p.hp = Math.max(0, p.hp - def.damage);
          invulnRef.current = 18;
          shakeRef.current = 0.4;
          spawnParticles(p.x, p.y, "#ff3ea5", 6);
          haptics.tap();
          if (p.hp <= 0) { endRun(false); return; }
        }
        survivors.push(e);
      }
      enemiesRef.current = survivors;

      const boss = bossRef.current;
      if (boss) {
        if (boss.phase === 1 && boss.hp <= boss.maxHp * 0.5) {
          boss.phase = 2;
          boss.attackCooldown = 850;
          spawnFloatText(boss.x, boss.y - 50, "OVERSEER CORE EXPOSED", "#ffb703");
          sfx.boost();
        }
        boss.attackCooldown -= TICK_MS;
        if (boss.attackCooldown <= 0) {
          boss.attackCooldown = boss.phase === 2 ? 950 : 1450;
          const ang = Math.atan2(p.y - boss.y, p.x - boss.x);
          projectilesRef.current.push({ x: boss.x, y: boss.y, vx: Math.cos(ang) * 3.2, vy: Math.sin(ang) * 3.2, damage: 13, life: 130, color: "#ff3ea5" });
        }
        boss.burstCooldown -= TICK_MS;
        if (boss.burstCooldown <= 0) {
          boss.burstCooldown = boss.phase === 2 ? 2400 : 3400;
          telegraphRef.current.push({ x: boss.x, y: boss.y, radius: 8, maxRadius: 110, life: 1 });
          setTimeout(() => {
            if (!bossRef.current) return;
            const d = dist(p.x, p.y, boss.x, boss.y);
            if (d < 110 && invulnRef.current === 0) {
              playerRef.current.hp = Math.max(0, playerRef.current.hp - 22);
              spawnFloatText(p.x, p.y - 14, "OVERLOAD -22", "#ff3ea5");
              shakeRef.current = 0.7;
              haptics.celebrate();
              if (playerRef.current.hp <= 0) endRun(false);
            }
          }, 750);
        }
        if (boss.hp <= 0) {
          spawnParticles(boss.x, boss.y, "#ffb703", 40);
          bossRef.current = null;
          endRun(true);
          return;
        }
      }

      projectilesRef.current = projectilesRef.current.filter((proj) => {
        proj.x += proj.vx; proj.y += proj.vy; proj.life -= 1;
        if (proj.life <= 0 || proj.x < -20 || proj.x > ARENA_W + 20) return false;
        if (proj.friendly) {
          const targets = [...enemiesRef.current];
          if (bossRef.current) targets.push(bossRef.current);
          for (const e of targets) {
            if (dist(proj.x, proj.y, e.x, e.y) < 12) {
              landHit(e, proj.damage);
              return false;
            }
          }
          return true;
        }
        const d = dist(proj.x, proj.y, p.x, p.y);
        if (d < 10 && invulnRef.current === 0) {
          p.hp = Math.max(0, p.hp - proj.damage);
          invulnRef.current = 16;
          spawnParticles(p.x, p.y, "#ff3ea5", 5);
          haptics.tap();
          if (p.hp <= 0) endRun(false);
          return false;
        }
        return true;
      });

      if (!bossRef.current && enemiesRef.current.length === 0) {
        waveIndexRef.current += 1;
        if (waveIndexRef.current >= WAVES.length) {
          bossRef.current = { x: ARENA_W - 80, y: GROUND_Y - 20, hp: 260, maxHp: 260, phase: 1, attackCooldown: 1400, burstCooldown: 2600 };
          setWaveFlash("THE OVERSEER");
          setTimeout(() => setWaveFlash(""), 2000);
          sfx.levelUp();
        } else {
          enemiesRef.current = spawnWaveEnemies(waveIndexRef.current);
          setWaveFlash(`SECTOR ${waveIndexRef.current + 1}`);
          setTimeout(() => setWaveFlash(""), 1200);
        }
      }

      for (const drop of rainRef.current) {
        drop.y += drop.speed; drop.x -= 1;
        if (drop.y > ARENA_H) { drop.y = -10; drop.x = Math.random() * ARENA_W; }
      }
      for (const v of vehiclesRef.current) {
        v.x += v.speed;
        if (v.speed > 0 && v.x > ARENA_W + 60) v.x = -60;
        if (v.speed < 0 && v.x < -60) v.x = ARENA_W + 60;
      }
      for (const h of hologramsRef.current) h.phase += 0.04;

      particlesRef.current = particlesRef.current.filter((pt) => { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.02; pt.life -= 0.045; return pt.life > 0; });
      floatTextRef.current = floatTextRef.current.filter((ft) => { ft.y -= 0.4; ft.life -= 0.016; return ft.life > 0; });
      telegraphRef.current = telegraphRef.current.filter((tg) => { tg.radius = Math.min(tg.maxRadius, tg.radius + 5); tg.life -= 0.04; return tg.life > 0; });
      shakeRef.current = Math.max(0, shakeRef.current - 0.05);

      setHud({
        hp: Math.round(p.hp),
        maxHp: p.maxHp,
        heat: Math.round(p.heat),
        wave: Math.min(waveIndexRef.current + 1, WAVES.length + 1),
        totalWaves: WAVES.length + 1,
        dashReady: now > dash.cooldownUntil,
        bossHp: boss ? Math.round(boss.hp) : 0,
        bossMaxHp: boss ? boss.maxHp : 1,
      });
    }, TICK_MS);
  }

  useEffect(() => () => clearInterval(simIntervalRef.current), []);

  useEffect(() => {
    if (phase !== "fighting") return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");

    function render() {
      const shakeX = (Math.random() - 0.5) * shakeRef.current * 7;
      const shakeY = (Math.random() - 0.5) * shakeRef.current * 5;
      ctx.save();
      ctx.translate(shakeX, shakeY);

      const skyGrad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      skyGrad.addColorStop(0, "#050310");
      skyGrad.addColorStop(1, "#1a0f2e");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(-20, -20, ARENA_W + 40, GROUND_Y + 20);

      for (const h of hologramsRef.current) {
        const glitch = Math.sin(h.phase * 3) > 0.92;
        ctx.save();
        ctx.globalAlpha = 0.5 + Math.sin(h.phase) * 0.2;
        ctx.shadowColor = h.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = h.color;
        ctx.fillRect(h.x + (glitch ? 3 : 0), h.y, h.w, h.h);
        ctx.restore();
      }

      for (const v of vehiclesRef.current) {
        ctx.strokeStyle = "rgba(255,183,3,0.5)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(v.x, v.y);
        ctx.lineTo(v.x - v.len * Math.sign(v.speed || 1), v.y);
        ctx.stroke();
        ctx.fillStyle = "#ffe14d";
        ctx.beginPath();
        ctx.arc(v.x, v.y, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#0a0616";
      for (let i = 0; i < 9; i++) {
        const bx = i * 60 - 10;
        const bh = 40 + (i % 5) * 22;
        ctx.fillRect(bx, GROUND_Y - bh, 46, bh);
        ctx.fillStyle = i % 3 === 0 ? "#ff3ea5" : i % 3 === 1 ? "#3ee6e0" : "#b45cff";
        ctx.globalAlpha = 0.4 + Math.sin(elapsedRef.current * 2 + i) * 0.25;
        for (let w = 0; w < 3; w++) ctx.fillRect(bx + 6 + w * 12, GROUND_Y - bh + 8 + (w % 2) * 14, 5, 5);
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#0a0616";
      }

      ctx.fillStyle = "#0d0a18";
      ctx.fillRect(-20, GROUND_Y, ARENA_W + 40, ARENA_H - GROUND_Y + 20);
      ctx.save();
      ctx.globalAlpha = 0.18;
      ctx.translate(0, GROUND_Y * 2);
      ctx.scale(1, -1);
      for (const h of hologramsRef.current) {
        ctx.fillStyle = h.color;
        ctx.fillRect(h.x, h.y, h.w, Math.min(h.h, 30));
      }
      ctx.restore();

      for (const tg of telegraphRef.current) {
        ctx.globalAlpha = Math.max(0, tg.life * 0.6);
        ctx.strokeStyle = "#ff3ea5";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.radius, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      for (const e of enemiesRef.current) {
        const def = ENEMY_TYPES[e.type];
        ctx.save();
        ctx.shadowColor = def.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = def.color;
        ctx.beginPath();
        ctx.arc(e.x, e.y, def.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        const barW = 20;
        ctx.fillStyle = "#000";
        ctx.fillRect(e.x - barW / 2, e.y - def.radius - 8, barW, 3);
        ctx.fillStyle = def.color;
        ctx.fillRect(e.x - barW / 2, e.y - def.radius - 8, barW * (e.hp / e.maxHp), 3);
      }

      const boss = bossRef.current;
      if (boss) {
        ctx.save();
        ctx.shadowColor = "#ff3ea5";
        ctx.shadowBlur = 26;
        ctx.fillStyle = "#ff3ea5";
        ctx.beginPath();
        ctx.arc(boss.x, boss.y, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        const barW = 100;
        ctx.fillStyle = "#000";
        ctx.fillRect(boss.x - barW / 2, boss.y - 46, barW, 4);
        ctx.fillStyle = "#ff3ea5";
        ctx.fillRect(boss.x - barW / 2, boss.y - 46, barW * (boss.hp / boss.maxHp), 4);
      }

      for (const proj of projectilesRef.current) {
        ctx.save();
        ctx.shadowColor = proj.friendly ? (accentColor || "#3ee6e0") : proj.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = proj.friendly ? (accentColor || "#3ee6e0") : proj.color;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (const pt of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, pt.life);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - 1.5, pt.y - 1.5, 3, 3);
        ctx.globalAlpha = 1;
      }

      const p = playerRef.current;
      const meleeActive = Date.now() < meleeActiveUntilRef.current;
      const blinking = invulnRef.current > 0 && Math.floor(invulnRef.current / 3) % 2 === 0;
      if (meleeActive) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = accentColor || "#3ee6e0";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.arc(p.x, p.y, MELEE_RANGE, p.aim - MELEE_ARC / 2, p.aim + MELEE_ARC / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      if (!blinking) {
        ctx.save();
        ctx.shadowColor = p.overheated ? "#ff3ea5" : accentColor || "#3ee6e0";
        ctx.shadowBlur = 18;
        ctx.fillStyle = p.overheated ? "#ff3ea5" : accentColor || "#3ee6e0";
        ctx.beginPath();
        ctx.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.strokeStyle = "rgba(155,232,255,0.3)";
      for (const drop of rainRef.current) {
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - 2, drop.y - 9);
        ctx.stroke();
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
      if (e.key === " ") dashQueuedRef.current = true;
    }
    function handleKeyUp(e) {
      if ((e.key === "ArrowLeft" || e.key === "a") && moveInputRef.current.x === -1) moveInputRef.current = { ...moveInputRef.current, x: 0 };
      if ((e.key === "ArrowRight" || e.key === "d") && moveInputRef.current.x === 1) moveInputRef.current = { ...moveInputRef.current, x: 0 };
      if ((e.key === "ArrowUp" || e.key === "w") && moveInputRef.current.y === -1) moveInputRef.current = { ...moveInputRef.current, y: 0 };
      if ((e.key === "ArrowDown" || e.key === "s") && moveInputRef.current.y === 1) moveInputRef.current = { ...moveInputRef.current, y: 0 };
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  function handleMouseMove(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    mouseRef.current = { x: (e.clientX - rect.left) * (ARENA_W / rect.width), y: (e.clientY - rect.top) * (ARENA_H / rect.height) };
  }

  if (deviceOk === null) return null;

  if (!deviceOk) {
    return (
      <div className="text-center py-10">
        <p className="text-3xl mb-4">💻</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">LAPTOP OR DESKTOP REQUIRED</p>
        <p className="text-textDim text-sm max-w-xs mx-auto">Eclipse Protocol needs a mouse for aiming — please switch to a laptop or desktop.</p>
      </div>
    );
  }

  if (phase === "menu") {
    return (
      <div className="text-center max-w-md mx-auto">
        <p className="text-3xl mb-4">🌃</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">ECLIPSE PROTOCOL</p>
        <p className="text-textDim text-sm mb-6">
          WASD to move, mouse to aim, click for a blade slash, right-click for a pulse shot, Space to dash. Both
          weapons share one heat gauge — overheat and you're locked out for a beat, so pace your attacks. Clear 3
          sectors, then face the Overseer.
        </p>
        <p className="font-mono text-[10px] text-textDim mb-2">CHOOSE THREAT LEVEL</p>
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
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          JACK IN
        </button>
      </div>
    );
  }

  if (phase === "over") {
    return (
      <div className="text-center">
        <p className="text-3xl mb-3">{outcome ? "🌟" : "💀"}</p>
        <p className="font-pixel text-sm mb-2" style={{ color: outcome ? "#ffb703" : "#ff3ea5" }}>
          {outcome ? "THE OVERSEER FALLS" : "SIGNAL LOST"}
        </p>
      </div>
    );
  }

  return (
    <div className="text-center relative" ref={wrapRef}>
      {waveFlash && (
        <div className="absolute inset-x-0 -top-2 z-20 flex items-center justify-center pointer-events-none">
          <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/90 px-4 py-2 rounded-lg">{waveFlash}</p>
        </div>
      )}
      <div className="flex justify-between font-mono text-[11px] mb-2 text-textDim max-w-[480px] mx-auto">
        <span>Sector {hud.wave}/{hud.totalWaves}</span>
        <span>{hud.dashReady ? "Dash ready" : "Dash recharging..."}</span>
      </div>
      <div className="max-w-[480px] mx-auto mb-1">
        <div className="h-2 rounded-full bg-bgDeep border border-lineColor overflow-hidden">
          <div className="h-full" style={{ width: `${(hud.hp / hud.maxHp) * 100}%`, background: hud.hp < hud.maxHp * 0.3 ? "#ff3ea5" : "#6bff6b" }} />
        </div>
        <div className="h-1.5 rounded-full bg-bgDeep border border-lineColor overflow-hidden mt-1">
          <div className="h-full" style={{ width: `${hud.heat}%`, background: hud.heat > 85 ? "#ff3ea5" : "#3ee6e0" }} />
        </div>
        {hud.bossHp > 0 && (
          <div className="h-1.5 rounded-full bg-bgDeep border border-lineColor overflow-hidden mt-1">
            <div className="h-full bg-accentMagenta" style={{ width: `${(hud.bossHp / hud.bossMaxHp) * 100}%` }} />
          </div>
        )}
      </div>

      <div
        className="relative mx-auto rounded-lg overflow-hidden border border-lineColor cursor-crosshair"
        style={{ width: ARENA_W, maxWidth: "94vw" }}
        onMouseMove={handleMouseMove}
        onMouseDown={(e) => {
          if (e.button === 0) meleeQueuedRef.current = true;
          if (e.button === 2) pulseQueuedRef.current = true;
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} width={ARENA_W} height={ARENA_H} style={{ width: "100%", height: "auto", display: "block" }} />
      </div>
      <p className="font-mono text-[10px] text-textDim mt-3">WASD move · Mouse aim · Click blade · Right-click pulse · Space dash</p>
    </div>
  );
}
