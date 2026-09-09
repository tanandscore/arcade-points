"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const ARENA_W = 480;
const ARENA_H = 380;
const TICK_MS = 33;
const PLAYER_R = 12;
const ATTACK_RANGE = 54;
const ATTACK_ARC = Math.PI * 0.7;
const COMBO_WINDOW_MS = 650;
const DASH_DURATION_TICKS = 6;
const DASH_COOLDOWN_MS = 800;
const DASH_SPEED = 8;
const SPECIAL_COOLDOWN_MS = 3200;

const ENEMY_TYPES = {
  wisp: { name: "Wisp Sentinel", color: "#9be8ff", hp: 22, speed: 0.9, radius: 10, ranged: true, damage: 9 },
  warden: { name: "Ash Warden", color: "#ff5a3c", hp: 40, speed: 1.3, radius: 14, damage: 13 },
  stalker: { name: "Bloom Stalker", color: "#b45cff", hp: 16, speed: 2.1, radius: 9, damage: 8, erratic: true },
};

const ROOM_WAVES = [
  [{ type: "wisp", n: 1 }, { type: "stalker", n: 2 }],
  [{ type: "warden", n: 2 }, { type: "wisp", n: 1 }],
  [{ type: "warden", n: 1 }, { type: "stalker", n: 2 }, { type: "wisp", n: 1 }],
];

const BLESSING_POOL = [
  { id: "power", name: "Aurora's Might", desc: "+20% attack damage", apply: (s) => ({ ...s, damageMult: s.damageMult * 1.2 }) },
  { id: "vitality", name: "Ember Heart", desc: "+25 max HP, full heal", apply: (s) => ({ ...s, maxHp: s.maxHp + 25, hp: s.maxHp + 25 }) },
  { id: "swift", name: "Windward Step", desc: "-25% dash cooldown", apply: (s) => ({ ...s, dashCooldownMult: s.dashCooldownMult * 0.75 }) },
  { id: "lifesteal", name: "Bloomtouch", desc: "Heal a little on every hit landed", apply: (s) => ({ ...s, lifesteal: s.lifesteal + 1.5 }) },
  { id: "reach", name: "Wide Arc", desc: "+18% attack range", apply: (s) => ({ ...s, rangeMult: s.rangeMult * 1.18 }) },
];

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}
function freshStats() {
  return { hp: 80, maxHp: 80, damageMult: 1, dashCooldownMult: 1, lifesteal: 0, rangeMult: 1 };
}

export default function Emberlight({ onFinish, accentColor }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [deviceOk, setDeviceOk] = useState(null);
  const [phase, setPhase] = useState("menu");
  const [hud, setHud] = useState({ hp: 80, maxHp: 80, room: 1, totalRooms: 4, combo: 0, dashReady: true, bossHp: 0, bossMaxHp: 1 });
  const [blessingChoices, setBlessingChoices] = useState([]);
  const [outcome, setOutcome] = useState(null);
  const [roomFlash, setRoomFlash] = useState("");

  const statsRef = useRef(freshStats());
  const playerRef = useRef({ x: ARENA_W / 2, y: ARENA_H / 2, aim: 0, facing: 0 });
  const moveInputRef = useRef({ x: 0, y: 0 });
  const mouseRef = useRef({ x: ARENA_W / 2, y: ARENA_H / 2 - 40 });
  const attackQueuedRef = useRef(false);
  const specialQueuedRef = useRef(false);
  const dashQueuedRef = useRef(false);
  const comboRef = useRef({ count: 0, lastHitAt: 0 });
  const lastAttackAtRef = useRef(0);
  const attackActiveUntilRef = useRef(0);
  const attackHitIdsRef = useRef(new Set());
  const lastSpecialAtRef = useRef(0);
  const dashRef = useRef({ ticksLeft: 0, until: 0, cooldownUntil: 0, dx: 0, dy: 0 });
  const invulnRef = useRef(0);
  const enemiesRef = useRef([]);
  const projectilesRef = useRef([]);
  const bossRef = useRef(null);
  const roomIndexRef = useRef(0);
  const particlesRef = useRef([]);
  const floatTextRef = useRef([]);
  const telegraphRef = useRef([]);
  const motesRef = useRef([]);
  const shakeRef = useRef(0);
  const elapsedRef = useRef(0);
  const pausedRef = useRef(false);
  const finishedRef = useRef(false);

  const simIntervalRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    const isTouchPrimary = window.matchMedia("(pointer: coarse)").matches;
    const isSmall = window.innerWidth < 1024;
    setDeviceOk(!isTouchPrimary && !isSmall);
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

  function spawnRoomEnemies(roomIdx) {
    const wave = ROOM_WAVES[roomIdx];
    const enemies = [];
    let placed = 0;
    for (const group of wave) {
      const def = ENEMY_TYPES[group.type];
      for (let i = 0; i < group.n; i++) {
        const ang = (placed / 6) * Math.PI * 2;
        enemies.push({
          id: Math.random(),
          type: group.type,
          x: ARENA_W / 2 + Math.cos(ang) * 150,
          y: ARENA_H / 2 + Math.sin(ang) * 120,
          hp: def.hp,
          maxHp: def.hp,
          erraticPhase: Math.random() * Math.PI * 2,
          lastShotAt: 0,
        });
        placed += 1;
      }
    }
    return enemies;
  }

  function resetRun() {
    statsRef.current = freshStats();
    playerRef.current = { x: ARENA_W / 2, y: ARENA_H / 2, aim: 0, facing: 0 };
    moveInputRef.current = { x: 0, y: 0 };
    comboRef.current = { count: 0, lastHitAt: 0 };
    dashRef.current = { ticksLeft: 0, until: 0, cooldownUntil: 0, dx: 0, dy: 0 };
    invulnRef.current = 0;
    lastSpecialAtRef.current = 0;
    roomIndexRef.current = 0;
    bossRef.current = null;
    enemiesRef.current = spawnRoomEnemies(0);
    projectilesRef.current = [];
    particlesRef.current = [];
    floatTextRef.current = [];
    telegraphRef.current = [];
    motesRef.current = Array.from({ length: 30 }, () => ({ x: Math.random() * ARENA_W, y: Math.random() * ARENA_H, phase: Math.random() * Math.PI * 2, speed: 0.2 + Math.random() * 0.3 }));
    shakeRef.current = 0;
    elapsedRef.current = 0;
    pausedRef.current = false;
    finishedRef.current = false;
  }

  function endRun(won) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(simIntervalRef.current);
    setOutcome(won);
    setPhase("over");
    sfx[won ? "newBest" : "lose"]();
    const score = roomIndexRef.current * 120 + comboRef.current.count * 5 + (won ? 400 : 0);
    setTimeout(() => onFinish(Math.max(0, score)), 1500);
  }

  function openBlessing() {
    pausedRef.current = true;
    const pool = [...BLESSING_POOL].sort(() => Math.random() - 0.5).slice(0, 2);
    setBlessingChoices(pool);
    setPhase("blessing");
  }

  function chooseBlessing(b) {
    statsRef.current = b.apply(statsRef.current);
    roomIndexRef.current += 1;
    pausedRef.current = false;
    sfx.correct();

    if (roomIndexRef.current >= ROOM_WAVES.length) {
      bossRef.current = { x: ARENA_W / 2, y: ARENA_H / 2 - 30, hp: 220, maxHp: 220, phase: 1, attackCooldown: 1400, burstCooldown: 2600 };
      setRoomFlash("UMBRA, THE FADING STAR");
      setTimeout(() => setRoomFlash(""), 2000);
    } else {
      enemiesRef.current = spawnRoomEnemies(roomIndexRef.current);
      setRoomFlash(`ROOM ${roomIndexRef.current + 1}`);
      setTimeout(() => setRoomFlash(""), 1300);
    }
    setPhase("fighting");
  }

  function landHit(target, dmg, isSpecial) {
    target.hp -= dmg;
    spawnFloatText(target.x, target.y - 14, isSpecial ? `${dmg}!` : `-${dmg}`, isSpecial ? "#ffb703" : "#ffe14d");
    spawnParticles(target.x, target.y, "#ffe14d", isSpecial ? 12 : 6);
    shakeRef.current = Math.max(shakeRef.current, isSpecial ? 0.5 : 0.2);
    const s = statsRef.current;
    if (s.lifesteal > 0) s.hp = Math.min(s.maxHp, s.hp + s.lifesteal);
    haptics.tap();
  }

  function performAttack(now, isSpecial) {
    const p = playerRef.current;
    const s = statsRef.current;
    attackActiveUntilRef.current = now + 160;
    attackHitIdsRef.current = new Set();
    p.aim = p.facing;

    if (now - comboRef.current.lastHitAt > COMBO_WINDOW_MS) comboRef.current.count = 0;
    comboRef.current.count = isSpecial ? comboRef.current.count : (comboRef.current.count % 3) + 1;
    comboRef.current.lastHitAt = now;

    const comboMult = isSpecial ? 1.9 : 1 + (comboRef.current.count - 1) * 0.12;
    const baseDamage = 14 * s.damageMult * comboMult;
    const range = ATTACK_RANGE * s.rangeMult * (isSpecial ? 1.2 : 1);
    sfx.hit();

    const targets = [...enemiesRef.current];
    if (bossRef.current) targets.push(bossRef.current);
    for (const e of targets) {
      const d = dist(p.x, p.y, e.x, e.y);
      if (d > range) continue;
      const ang = Math.atan2(e.y - p.y, e.x - p.x);
      if (angleDiff(ang, p.aim) > ATTACK_ARC / 2) continue;
      landHit(e, Math.round(baseDamage), isSpecial);
    }
  }

  function begin() {
    const el = wrapRef.current?.ownerDocument?.documentElement;
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});
    resetRun();
    setOutcome(null);
    setPhase("fighting");
    setRoomFlash("ROOM 1");
    setTimeout(() => setRoomFlash(""), 1300);

    simIntervalRef.current = setInterval(() => {
      if (pausedRef.current) return;
      elapsedRef.current += TICK_MS / 1000;
      const p = playerRef.current;
      const s = statsRef.current;
      const now = Date.now();

      p.aim = Math.atan2(mouseRef.current.y - p.y, mouseRef.current.x - p.x);

      const dash = dashRef.current;
      if (dashQueuedRef.current && now > dash.cooldownUntil) {
        dashQueuedRef.current = false;
        const mv = moveInputRef.current;
        const mag = Math.hypot(mv.x, mv.y);
        const dirAng = mag > 0.1 ? Math.atan2(mv.y, mv.x) : p.aim;
        dash.dx = Math.cos(dirAng);
        dash.dy = Math.sin(dirAng);
        dash.ticksLeft = DASH_DURATION_TICKS;
        dash.cooldownUntil = now + DASH_COOLDOWN_MS * s.dashCooldownMult;
        invulnRef.current = DASH_DURATION_TICKS + 2;
        spawnParticles(p.x, p.y, accentColor || "#ffb703", 8);
        sfx.boost();
      } else {
        dashQueuedRef.current = false;
      }

      if (dash.ticksLeft > 0) {
        p.x += dash.dx * DASH_SPEED;
        p.y += dash.dy * DASH_SPEED;
        dash.ticksLeft -= 1;
      } else {
        const mv = moveInputRef.current;
        if (mv.x || mv.y) {
          const mag = Math.hypot(mv.x, mv.y) || 1;
          p.x += (mv.x / mag) * 2.6;
          p.y += (mv.y / mag) * 2.6;
          p.facing = Math.atan2(mv.y, mv.x);
        }
      }
      p.x = Math.max(PLAYER_R, Math.min(ARENA_W - PLAYER_R, p.x));
      p.y = Math.max(PLAYER_R, Math.min(ARENA_H - PLAYER_R, p.y));
      if (invulnRef.current > 0) invulnRef.current -= 1;

      if (attackQueuedRef.current && now - lastAttackAtRef.current > 260) {
        attackQueuedRef.current = false;
        lastAttackAtRef.current = now;
        performAttack(now, false);
      } else {
        attackQueuedRef.current = false;
      }
      if (specialQueuedRef.current && now - lastSpecialAtRef.current > SPECIAL_COOLDOWN_MS) {
        specialQueuedRef.current = false;
        lastSpecialAtRef.current = now;
        performAttack(now, true);
      } else {
        specialQueuedRef.current = false;
      }

      const survivors = [];
      for (const e of enemiesRef.current) {
        const def = ENEMY_TYPES[e.type];
        if (e.hp <= 0) {
          spawnParticles(e.x, e.y, def.color, 12);
          continue;
        }
        const d = dist(p.x, p.y, e.x, e.y);
        if (def.ranged) {
          if (d > 130) {
            const ang = Math.atan2(p.y - e.y, p.x - e.x);
            e.x += Math.cos(ang) * def.speed;
            e.y += Math.sin(ang) * def.speed;
          }
          if (now - e.lastShotAt > 1900) {
            e.lastShotAt = now;
            const ang = Math.atan2(p.y - e.y, p.x - e.x);
            projectilesRef.current.push({ x: e.x, y: e.y, vx: Math.cos(ang) * 2.6, vy: Math.sin(ang) * 2.6, damage: def.damage, life: 120, color: def.color });
          }
        } else if (def.erratic) {
          e.erraticPhase += 0.08;
          const ang = Math.atan2(p.y - e.y, p.x - e.x) + Math.sin(e.erraticPhase) * 0.8;
          e.x += Math.cos(ang) * def.speed;
          e.y += Math.sin(ang) * def.speed;
        } else {
          const ang = Math.atan2(p.y - e.y, p.x - e.x);
          e.x += Math.cos(ang) * def.speed;
          e.y += Math.sin(ang) * def.speed;
        }
        if (d < def.radius + PLAYER_R && invulnRef.current === 0) {
          s.hp = Math.max(0, s.hp - def.damage);
          invulnRef.current = 18;
          shakeRef.current = 0.4;
          spawnParticles(p.x, p.y, "#ff3ea5", 6);
          haptics.tap();
          if (s.hp <= 0) { endRun(false); return; }
        }
        survivors.push(e);
      }
      enemiesRef.current = survivors;

      const boss = bossRef.current;
      if (boss) {
        if (boss.phase === 1 && boss.hp <= boss.maxHp * 0.5) {
          boss.phase = 2;
          boss.attackCooldown = 900;
          spawnFloatText(boss.x, boss.y - 40, "UMBRA UNRAVELS", "#ffb703");
          sfx.boost();
        }
        boss.attackCooldown -= TICK_MS;
        if (boss.attackCooldown <= 0) {
          boss.attackCooldown = boss.phase === 2 ? 1000 : 1500;
          const ang = Math.atan2(p.y - boss.y, p.x - boss.x);
          projectilesRef.current.push({ x: boss.x, y: boss.y, vx: Math.cos(ang) * 3, vy: Math.sin(ang) * 3, damage: 12, life: 130, color: "#b45cff" });
        }
        boss.burstCooldown -= TICK_MS;
        if (boss.burstCooldown <= 0) {
          boss.burstCooldown = boss.phase === 2 ? 2200 : 3200;
          telegraphRef.current.push({ x: boss.x, y: boss.y, radius: 8, maxRadius: 100, life: 1 });
          setTimeout(() => {
            if (!bossRef.current) return;
            const d = dist(p.x, p.y, boss.x, boss.y);
            if (d < 100 && invulnRef.current === 0) {
              statsRef.current.hp = Math.max(0, statsRef.current.hp - 20);
              spawnFloatText(p.x, p.y - 14, "BURST -20", "#ff3ea5");
              shakeRef.current = 0.7;
              haptics.celebrate();
              if (statsRef.current.hp <= 0) endRun(false);
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
        if (proj.life <= 0) return false;
        const d = dist(proj.x, proj.y, p.x, p.y);
        if (d < 10 && invulnRef.current === 0) {
          s.hp = Math.max(0, s.hp - proj.damage);
          invulnRef.current = 16;
          spawnParticles(p.x, p.y, "#ff3ea5", 5);
          haptics.tap();
          if (s.hp <= 0) endRun(false);
          return false;
        }
        return true;
      });

      for (const m of motesRef.current) {
        m.phase += m.speed * 0.02;
        m.y -= 0.15;
        if (m.y < -10) m.y = ARENA_H + 10;
      }

      particlesRef.current = particlesRef.current.filter((pt) => { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.02; pt.life -= 0.045; return pt.life > 0; });
      floatTextRef.current = floatTextRef.current.filter((ft) => { ft.y -= 0.4; ft.life -= 0.016; return ft.life > 0; });
      telegraphRef.current = telegraphRef.current.filter((tg) => { tg.radius = Math.min(tg.maxRadius, tg.radius + 5); tg.life -= 0.04; return tg.life > 0; });
      shakeRef.current = Math.max(0, shakeRef.current - 0.05);

      if (!boss && enemiesRef.current.length === 0) {
        openBlessing();
      }

      setHud({
        hp: Math.round(s.hp),
        maxHp: s.maxHp,
        room: Math.min(roomIndexRef.current + 1, ROOM_WAVES.length + 1),
        totalRooms: ROOM_WAVES.length + 1,
        combo: comboRef.current.count,
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
      const shakeX = (Math.random() - 0.5) * shakeRef.current * 8;
      const shakeY = (Math.random() - 0.5) * shakeRef.current * 6;
      ctx.save();
      ctx.translate(shakeX, shakeY);

      const skyGrad = ctx.createLinearGradient(0, 0, 0, ARENA_H);
      skyGrad.addColorStop(0, "#3a2440");
      skyGrad.addColorStop(0.5, "#5a3a4a");
      skyGrad.addColorStop(1, "#2a1a30");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(-20, -20, ARENA_W + 40, ARENA_H + 40);

      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.fillStyle = "#ffe9b8";
      for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(120 + i * 130, -40);
        ctx.rotate(0.3);
        ctx.fillRect(-30, 0, 60, ARENA_H + 100);
        ctx.restore();
      }
      ctx.restore();

      ctx.fillStyle = "#241a2e";
      ctx.beginPath();
      ctx.ellipse(ARENA_W / 2, ARENA_H / 2, ARENA_W / 2 - 20, ARENA_H / 2 - 20, 0, 0, Math.PI * 2);
      ctx.fill();

      for (const m of motesRef.current) {
        ctx.globalAlpha = 0.3 + Math.sin(m.phase) * 0.2;
        ctx.fillStyle = "#ffe9b8";
        ctx.beginPath();
        ctx.arc(m.x, m.y, 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

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
        ctx.shadowColor = "#b45cff";
        ctx.shadowBlur = 24;
        ctx.fillStyle = "#b45cff";
        ctx.beginPath();
        ctx.arc(boss.x, boss.y, 26, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        const barW = 100;
        ctx.fillStyle = "#000";
        ctx.fillRect(boss.x - barW / 2, boss.y - 44, barW, 4);
        ctx.fillStyle = "#b45cff";
        ctx.fillRect(boss.x - barW / 2, boss.y - 44, barW * (boss.hp / boss.maxHp), 4);
      }

      for (const proj of projectilesRef.current) {
        ctx.save();
        ctx.shadowColor = proj.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = proj.color;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 3.5, 0, Math.PI * 2);
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
      const attacking = Date.now() < attackActiveUntilRef.current;
      const blinking = invulnRef.current > 0 && Math.floor(invulnRef.current / 3) % 2 === 0;
      if (attacking) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = accentColor || "#ffb703";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.arc(p.x, p.y, ATTACK_RANGE * statsRef.current.rangeMult, p.aim - ATTACK_ARC / 2, p.aim + ATTACK_ARC / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      if (!blinking) {
        ctx.save();
        ctx.shadowColor = accentColor || "#ffb703";
        ctx.shadowBlur = 18;
        ctx.fillStyle = accentColor || "#ffb703";
        ctx.beginPath();
        ctx.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (const ft of floatTextRef.current) {
        ctx.globalAlpha = Math.max(0, ft.life);
        ctx.fillStyle = ft.color;
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 1;
      }

      ctx.globalAlpha = 0.12;
      ctx.fillStyle = "#e8d9c0";
      for (let i = 0; i < 4; i++) {
        const fx = ((elapsedRef.current * 8 + i * 160) % (ARENA_W + 200)) - 100;
        ctx.beginPath();
        ctx.ellipse(fx, ARENA_H - 30, 110, 24, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

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
        <p className="text-textDim text-sm max-w-xs mx-auto">Emberlight needs a mouse for aiming — please switch to a laptop or desktop.</p>
      </div>
    );
  }

  if (phase === "menu") {
    return (
      <div className="text-center max-w-sm mx-auto">
        <p className="text-3xl mb-4">🔥</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">EMBERLIGHT</p>
        <p className="text-textDim text-sm mb-6">
          WASD to move, mouse to aim, click to swing (chain up to 3 hits), right-click for a heavier special, Space
          to dash through danger. Clear 3 rooms, choose a blessing after each, then face Umbra, the Fading Star.
        </p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          STEP INTO THE LIGHT
        </button>
      </div>
    );
  }

  if (phase === "over") {
    return (
      <div className="text-center">
        <p className="text-3xl mb-3">{outcome ? "🌟" : "🕯️"}</p>
        <p className="font-pixel text-sm mb-2" style={{ color: outcome ? "#ffb703" : "#ff3ea5" }}>
          {outcome ? "UMBRA FADES INTO LIGHT" : "THE FLAME GOES OUT"}
        </p>
      </div>
    );
  }

  if (phase === "blessing") {
    return (
      <div className="text-center max-w-sm mx-auto">
        <p className="font-pixel text-xs text-accentAmber mb-4 ap-blink">CHOOSE A BLESSING</p>
        <div className="space-y-2">
          {blessingChoices.map((b) => (
            <button key={b.id} onClick={() => chooseBlessing(b)} className="w-full text-left rounded-md border-2 p-3 hover:bg-bgPanel3" style={{ borderColor: accentColor }}>
              <p className="font-mono text-xs text-textLight">{b.name}</p>
              <p className="font-mono text-[10px] text-textDim">{b.desc}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center relative" ref={wrapRef}>
      {roomFlash && (
        <div className="absolute inset-x-0 -top-2 z-20 flex items-center justify-center pointer-events-none">
          <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/90 px-4 py-2 rounded-lg">{roomFlash}</p>
        </div>
      )}
      <div className="flex justify-between font-mono text-[11px] mb-2 text-textDim max-w-[480px] mx-auto">
        <span>Room {hud.room}/{hud.totalRooms}</span>
        <span>{hud.combo > 0 ? `${hud.combo}x combo` : ""}</span>
        <span>{hud.dashReady ? "Dash ready" : "Dash recharging..."}</span>
      </div>
      <div className="max-w-[480px] mx-auto mb-1">
        <div className="h-2 rounded-full bg-bgDeep border border-lineColor overflow-hidden">
          <div className="h-full" style={{ width: `${(hud.hp / hud.maxHp) * 100}%`, background: hud.hp < hud.maxHp * 0.3 ? "#ff3ea5" : "#6bff6b" }} />
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
          if (e.button === 0) attackQueuedRef.current = true;
          if (e.button === 2) specialQueuedRef.current = true;
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} width={ARENA_W} height={ARENA_H} style={{ width: "100%", height: "auto", display: "block" }} />
      </div>
      <p className="font-mono text-[10px] text-textDim mt-3">WASD move · Mouse aim · Click swing · Right-click special · Space dash</p>
    </div>
  );
}
