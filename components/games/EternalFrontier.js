"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const VIEWPORT_W = 480;
const VIEWPORT_H = 320;
const TICK_MS = 33;
const GROUND_Y = 260;
const GRAVITY = 0.5;
const JUMP_VELOCITY = -10;
const MOVE_SPEED = 2.6;
const PLAYER_R = 10;
const MELEE_RANGE = 44;
const MELEE_ARC = Math.PI * 0.6;
const MELEE_COOLDOWN_MS = 300;
const DASH_TICKS = 6;
const DASH_COOLDOWN_MS = 900;
const DASH_SPEED = 8;

const REGIONS = [
  {
    id: "verdanthush",
    name: "The Verdant Hush",
    icon: "🌿",
    worldW: 900,
    skyTop: [30, 60, 45], skyBottom: [70, 110, 80], groundColor: [40, 60, 35],
    enemyCount: 3, enemyHp: 26, enemyColor: "#6bff6b",
    bossName: "The Rootwarden", bossColor: "#2e8b57", bossHp: 260,
  },
  {
    id: "shatteredspire",
    name: "The Shattered Spire",
    icon: "🔮",
    worldW: 1000,
    skyTop: [20, 20, 45], skyBottom: [55, 45, 90], groundColor: [70, 65, 90],
    enemyCount: 4, enemyHp: 22, enemyColor: "#b45cff",
    bossName: "The Architect", bossColor: "#9be8ff", bossHp: 300,
  },
  {
    id: "emberwastes",
    name: "The Ember Wastes",
    icon: "🔥",
    worldW: 1000,
    skyTop: [40, 15, 10], skyBottom: [90, 40, 20], groundColor: [60, 30, 20],
    enemyCount: 4, enemyHp: 30, enemyColor: "#ff5a3c",
    bossName: "The Cinder King", bossColor: "#ff8c3c", bossHp: 340,
  },
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

export default function EternalFrontier({ onFinish, accentColor }) {
  const canvasRef = useRef(null);
  const [deviceOk, setDeviceOk] = useState(null);
  const [phase, setPhase] = useState("menu");
  const [clearedRegions, setClearedRegions] = useState([]);
  const [activeRegionId, setActiveRegionId] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [hud, setHud] = useState({ hp: 100, maxHp: 100, dashReady: true, bossHp: 0, bossMaxHp: 1, bossName: "" });
  const [eventFlash, setEventFlash] = useState("");

  const clearedRef = useRef([]);
  const playerRef = useRef({ x: 60, y: GROUND_Y - PLAYER_R, vx: 0, vy: 0, facing: 1, onGround: true, hp: 100, maxHp: 100 });
  const moveInputRef = useRef(0);
  const jumpQueuedRef = useRef(false);
  const attackQueuedRef = useRef(false);
  const dashQueuedRef = useRef(false);
  const lastAttackAtRef = useRef(0);
  const attackActiveUntilRef = useRef(0);
  const dashRef = useRef({ ticksLeft: 0, cooldownUntil: 0 });
  const invulnRef = useRef(0);
  const cameraXRef = useRef(0);
  const activeRegionRef = useRef(null);
  const enemiesRef = useRef([]);
  const bossRef = useRef(null);
  const projectilesRef = useRef([]);
  const particlesRef = useRef([]);
  const floatTextRef = useRef([]);
  const telegraphRef = useRef([]);
  const shakeRef = useRef(0);
  const elapsedRef = useRef(0);
  const finishedRegionRef = useRef(false);
  const hubNpcsRef = useRef([]);
  const hubMotesRef = useRef([]);

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
      const speed = 0.5 + Math.random() * 1.4;
      particlesRef.current.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color });
    }
  }
  function spawnFloatText(x, y, text, color) {
    floatTextRef.current.push({ x, y, text, color, life: 1 });
  }

  function enterHub() {
    clearedRef.current = [];
    setClearedRegions([]);
    hubMotesRef.current = Array.from({ length: 25 }, () => ({ x: Math.random() * VIEWPORT_W, y: Math.random() * 200, phase: Math.random() * Math.PI * 2 }));
    hubNpcsRef.current = [];
    setPhase("hub");
  }

  function updateHubNpcs() {
    hubNpcsRef.current = clearedRef.current.map((_, i) => ({
      x: 100 + i * 90, y0: 250, phase: Math.random() * Math.PI * 2,
    }));
  }

  function beginRegion(region) {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    activeRegionRef.current = region;
    setActiveRegionId(region.id);
    playerRef.current = { x: 60, y: GROUND_Y - PLAYER_R, vx: 0, vy: 0, facing: 1, onGround: true, hp: 100, maxHp: 100 };
    moveInputRef.current = 0;
    dashRef.current = { ticksLeft: 0, cooldownUntil: 0 };
    invulnRef.current = 0;
    cameraXRef.current = 0;
    bossRef.current = null;
    enemiesRef.current = Array.from({ length: region.enemyCount }, (_, i) => ({
      id: i,
      x: 300 + i * ((region.worldW - 500) / Math.max(1, region.enemyCount - 1)),
      y: GROUND_Y - 10,
      hp: region.enemyHp,
      maxHp: region.enemyHp,
      alive: true,
      dir: Math.random() < 0.5 ? -1 : 1,
    }));
    projectilesRef.current = [];
    particlesRef.current = [];
    floatTextRef.current = [];
    telegraphRef.current = [];
    shakeRef.current = 0;
    elapsedRef.current = 0;
    finishedRegionRef.current = false;
    setEventFlash(region.name.toUpperCase());
    setTimeout(() => setEventFlash(""), 1800);
    setPhase("region");
    runRegionLoop();
  }

  function landHit(target, dmg) {
    target.hp -= dmg;
    spawnFloatText(target.x, target.y - 14, `-${dmg}`, "#ffe14d");
    spawnParticles(target.x, target.y, "#ffe14d", 6);
    shakeRef.current = Math.max(shakeRef.current, 0.25);
    haptics.tap();
  }

  function performAttack(now) {
    const p = playerRef.current;
    attackActiveUntilRef.current = now + 140;
    const aim = p.facing === 1 ? 0 : Math.PI;
    sfx.hit();
    const targets = [...enemiesRef.current.filter((e) => e.alive)];
    if (bossRef.current) targets.push(bossRef.current);
    for (const e of targets) {
      const d = dist(p.x, p.y, e.x, e.y);
      if (d > MELEE_RANGE) continue;
      const ang = Math.atan2(e.y - p.y, e.x - p.x);
      if (angleDiff(ang, aim) > MELEE_ARC / 2) continue;
      landHit(e, 15);
    }
  }

  function finishRegion(won) {
    if (finishedRegionRef.current) return;
    finishedRegionRef.current = true;
    clearInterval(simIntervalRef.current);
    if (won) {
      sfx.newBest();
      const region = activeRegionRef.current;
      clearedRef.current = [...clearedRef.current, region.id];
      setClearedRegions(clearedRef.current);
      updateHubNpcs();
      setEventFlash(`${region.bossName.toUpperCase()} HAS FALLEN`);
      setTimeout(() => setEventFlash(""), 2200);
      if (clearedRef.current.length >= REGIONS.length) {
        setTimeout(() => finishRun(true), 2000);
        return;
      }
      setTimeout(() => setPhase("hub"), 1600);
    } else {
      sfx.lose();
      setTimeout(() => setPhase("hub"), 1600);
    }
  }

  function finishRun(won) {
    setOutcome(won);
    setPhase("over");
    const score = clearedRef.current.length * 220 + (won ? 500 : 0);
    setTimeout(() => onFinish(Math.max(0, score)), 1800);
  }

  function runRegionLoop() {
    simIntervalRef.current = setInterval(() => {
      elapsedRef.current += TICK_MS / 1000;
      const p = playerRef.current;
      const region = activeRegionRef.current;
      const now = Date.now();

      const mv = moveInputRef.current;
      p.vx = mv * MOVE_SPEED;
      if (mv !== 0) p.facing = mv;

      const dash = dashRef.current;
      if (dashQueuedRef.current && now > dash.cooldownUntil) {
        dashQueuedRef.current = false;
        dash.ticksLeft = DASH_TICKS;
        dash.cooldownUntil = now + DASH_COOLDOWN_MS;
        invulnRef.current = DASH_TICKS + 2;
        spawnParticles(p.x, p.y, accentColor || "#ffb703", 8);
        sfx.boost();
      } else {
        dashQueuedRef.current = false;
      }

      if (dash.ticksLeft > 0) {
        p.x += p.facing * DASH_SPEED;
        dash.ticksLeft -= 1;
      } else {
        p.x += p.vx;
      }
      p.x = Math.max(PLAYER_R, Math.min(region.worldW - PLAYER_R, p.x));

      if (jumpQueuedRef.current) {
        jumpQueuedRef.current = false;
        if (p.onGround) { p.vy = JUMP_VELOCITY; p.onGround = false; sfx.tap(); }
      }
      p.vy += GRAVITY;
      p.y += p.vy;
      if (p.y + PLAYER_R >= GROUND_Y) { p.y = GROUND_Y - PLAYER_R; p.vy = 0; p.onGround = true; } else { p.onGround = false; }

      if (invulnRef.current > 0) invulnRef.current -= 1;

      if (attackQueuedRef.current && now - lastAttackAtRef.current > MELEE_COOLDOWN_MS) {
        attackQueuedRef.current = false;
        lastAttackAtRef.current = now;
        performAttack(now);
      } else {
        attackQueuedRef.current = false;
      }

      cameraXRef.current = Math.max(0, Math.min(region.worldW - VIEWPORT_W, p.x - VIEWPORT_W / 2));

      for (const e of enemiesRef.current) {
        if (!e.alive) continue;
        e.x += e.dir * 0.6;
        if (e.x < 40 || e.x > region.worldW - 40) e.dir *= -1;
        const d = dist(p.x, p.y, e.x, e.y);
        if (d < 18 && invulnRef.current === 0) {
          p.hp = Math.max(0, p.hp - 8);
          invulnRef.current = 18;
          shakeRef.current = 0.35;
          spawnParticles(p.x, p.y, "#ff3ea5", 5);
          haptics.tap();
          if (p.hp <= 0) { finishRegion(false); return; }
        }
        if (e.hp <= 0) {
          e.alive = false;
          spawnParticles(e.x, e.y, region.enemyColor, 14);
        }
      }

      const allEnemiesDead = enemiesRef.current.every((e) => !e.alive);
      if (allEnemiesDead && !bossRef.current && p.x > region.worldW - 160) {
        bossRef.current = {
          x: region.worldW - 90, y: GROUND_Y - 20, hp: region.bossHp, maxHp: region.bossHp,
          phase: 1, attackCooldown: 1400, burstCooldown: 2600,
        };
        setEventFlash(region.bossName.toUpperCase());
        setTimeout(() => setEventFlash(""), 2000);
        sfx.levelUp();
      }

      const boss = bossRef.current;
      if (boss) {
        if (boss.phase === 1 && boss.hp <= boss.maxHp * 0.55) {
          boss.phase = 2;
          boss.attackCooldown = 900;
          spawnFloatText(boss.x, boss.y - 50, `${activeRegionRef.current.bossName.toUpperCase()} UNLEASHED`, "#ffb703");
          sfx.boost();
        }
        boss.attackCooldown -= TICK_MS;
        if (boss.attackCooldown <= 0) {
          boss.attackCooldown = boss.phase === 2 ? 950 : 1450;
          const ang = Math.atan2(p.y - boss.y, p.x - boss.x);
          projectilesRef.current.push({ x: boss.x, y: boss.y, vx: Math.cos(ang) * 3.2, vy: Math.sin(ang) * 3.2, damage: 12, life: 130, color: activeRegionRef.current.bossColor });
        }
        boss.burstCooldown -= TICK_MS;
        if (boss.burstCooldown <= 0) {
          boss.burstCooldown = boss.phase === 2 ? 2200 : 3200;
          telegraphRef.current.push({ x: boss.x, y: boss.y, radius: 8, maxRadius: 120, life: 1 });
          setTimeout(() => {
            if (!bossRef.current) return;
            const d = dist(playerRef.current.x, playerRef.current.y, boss.x, boss.y);
            if (d < 120 && invulnRef.current === 0) {
              playerRef.current.hp = Math.max(0, playerRef.current.hp - 22);
              spawnFloatText(playerRef.current.x, playerRef.current.y - 14, "OVERWHELMED -22", "#ff3ea5");
              shakeRef.current = 0.7;
              haptics.celebrate();
              if (playerRef.current.hp <= 0) finishRegion(false);
            }
          }, 750);
        }
        if (boss.hp <= 0) {
          spawnParticles(boss.x, boss.y, activeRegionRef.current.bossColor, 44);
          bossRef.current = null;
          finishRegion(true);
          return;
        }
      }

      projectilesRef.current = projectilesRef.current.filter((proj) => {
        proj.x += proj.vx; proj.y += proj.vy; proj.life -= 1;
        if (proj.life <= 0) return false;
        const d = dist(proj.x, proj.y, p.x, p.y);
        if (d < 10 && invulnRef.current === 0) {
          p.hp = Math.max(0, p.hp - proj.damage);
          invulnRef.current = 16;
          spawnParticles(p.x, p.y, "#ff3ea5", 5);
          haptics.tap();
          if (p.hp <= 0) finishRegion(false);
          return false;
        }
        return true;
      });

      particlesRef.current = particlesRef.current.filter((pt) => { pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.02; pt.life -= 0.045; return pt.life > 0; });
      floatTextRef.current = floatTextRef.current.filter((ft) => { ft.y -= 0.4; ft.life -= 0.016; return ft.life > 0; });
      telegraphRef.current = telegraphRef.current.filter((tg) => { tg.radius = Math.min(tg.maxRadius, tg.radius + 5); tg.life -= 0.04; return tg.life > 0; });
      shakeRef.current = Math.max(0, shakeRef.current - 0.05);

      setHud({
        hp: Math.round(p.hp), maxHp: p.maxHp,
        dashReady: now > dash.cooldownUntil,
        bossHp: boss ? Math.round(boss.hp) : 0,
        bossMaxHp: boss ? boss.maxHp : 1,
        bossName: boss ? activeRegionRef.current.bossName : "",
      });
    }, TICK_MS);
  }

  useEffect(() => () => clearInterval(simIntervalRef.current), []);

  useEffect(() => {
    if (phase !== "region") return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");

    function render() {
      const region = activeRegionRef.current;
      if (!region) return;
      const camX = cameraXRef.current;
      const shakeX = (Math.random() - 0.5) * shakeRef.current * 7;
      const shakeY = (Math.random() - 0.5) * shakeRef.current * 5;
      ctx.save();
      ctx.translate(shakeX, shakeY);

      const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
      sky.addColorStop(0, `rgb(${region.skyTop.join(",")})`);
      sky.addColorStop(1, `rgb(${region.skyBottom.join(",")})`);
      ctx.fillStyle = sky;
      ctx.fillRect(-20, -20, VIEWPORT_W + 40, GROUND_Y + 20);

      ctx.fillStyle = "rgba(0,0,0,0.15)";
      for (let i = 0; i < 8; i++) {
        const wx = i * 200 - camX * 0.3;
        ctx.beginPath();
        ctx.ellipse(wx, 220, 90, 40, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = `rgb(${region.groundColor.join(",")})`;
      ctx.fillRect(-20, GROUND_Y, VIEWPORT_W + 40, VIEWPORT_H - GROUND_Y + 20);

      for (const tg of telegraphRef.current) {
        ctx.globalAlpha = Math.max(0, tg.life * 0.6);
        ctx.strokeStyle = "#ff3ea5";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(tg.x - camX, tg.y, tg.radius, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      for (const e of enemiesRef.current) {
        if (!e.alive) continue;
        const ex = e.x - camX;
        if (ex < -20 || ex > VIEWPORT_W + 20) continue;
        ctx.save();
        ctx.shadowColor = region.enemyColor;
        ctx.shadowBlur = 10;
        ctx.fillStyle = region.enemyColor;
        ctx.beginPath();
        ctx.arc(ex, e.y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        const barW = 20;
        ctx.fillStyle = "#000";
        ctx.fillRect(ex - barW / 2, e.y - 26, barW, 3);
        ctx.fillStyle = region.enemyColor;
        ctx.fillRect(ex - barW / 2, e.y - 26, barW * (e.hp / e.maxHp), 3);
      }

      const boss = bossRef.current;
      if (boss) {
        const bx = boss.x - camX;
        ctx.save();
        ctx.shadowColor = region.bossColor;
        ctx.shadowBlur = 28;
        ctx.fillStyle = region.bossColor;
        ctx.beginPath();
        ctx.arc(bx, boss.y, 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        const barW = 110;
        ctx.fillStyle = "#000";
        ctx.fillRect(bx - barW / 2, boss.y - 48, barW, 4);
        ctx.fillStyle = region.bossColor;
        ctx.fillRect(bx - barW / 2, boss.y - 48, barW * (boss.hp / boss.maxHp), 4);
      }

      for (const proj of projectilesRef.current) {
        const px = proj.x - camX;
        ctx.save();
        ctx.shadowColor = proj.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = proj.color;
        ctx.beginPath();
        ctx.arc(px, proj.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (const pt of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, pt.life);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - camX - 1.5, pt.y - 1.5, 3, 3);
        ctx.globalAlpha = 1;
      }

      const p = playerRef.current;
      const px = p.x - camX;
      const attacking = Date.now() < attackActiveUntilRef.current;
      const blinking = invulnRef.current > 0 && Math.floor(invulnRef.current / 3) % 2 === 0;
      if (attacking) {
        const aim = p.facing === 1 ? 0 : Math.PI;
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = accentColor || "#ffb703";
        ctx.beginPath();
        ctx.moveTo(px, p.y);
        ctx.arc(px, p.y, MELEE_RANGE, aim - MELEE_ARC / 2, aim + MELEE_ARC / 2);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      if (!blinking) {
        ctx.save();
        ctx.shadowColor = accentColor || "#ffb703";
        ctx.shadowBlur = 16;
        ctx.fillStyle = accentColor || "#ffb703";
        ctx.beginPath();
        ctx.arc(px, p.y, PLAYER_R, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (const ft of floatTextRef.current) {
        ctx.globalAlpha = Math.max(0, ft.life);
        ctx.fillStyle = ft.color;
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(ft.text, ft.x - camX, ft.y);
        ctx.globalAlpha = 1;
      }

      ctx.restore();
      frameRef.current = requestAnimationFrame(render);
    }
    render();
    return () => cancelAnimationFrame(frameRef.current);
  }, [phase, accentColor]);

  useEffect(() => {
    if (phase !== "hub") return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    let raf;
    function render() {
      const restoredFrac = clearedRef.current.length / REGIONS.length;
      const grayAmount = Math.round((1 - restoredFrac) * 70);
      ctx.filter = `grayscale(${grayAmount}%)`;

      const sky = ctx.createLinearGradient(0, 0, 0, 220);
      sky.addColorStop(0, "#2a1f40");
      sky.addColorStop(1, "#5a4a60");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, VIEWPORT_W, 220);
      ctx.fillStyle = "#241a30";
      ctx.fillRect(0, 220, VIEWPORT_W, VIEWPORT_H - 220);

      for (const m of hubMotesRef.current) {
        m.phase += 0.02;
        ctx.globalAlpha = 0.4 + Math.sin(m.phase) * 0.2;
        ctx.fillStyle = "#ffe9b8";
        ctx.beginPath();
        ctx.arc(m.x, m.y + Math.sin(m.phase) * 8, 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      REGIONS.forEach((region, i) => {
        const bx = 90 + i * 150;
        const cleared = clearedRef.current.includes(region.id);
        ctx.fillStyle = cleared ? "#e8d9c0" : "#3a3040";
        ctx.fillRect(bx - 24, 190, 48, 60);
        if (cleared) {
          ctx.save();
          ctx.shadowColor = "#ffb703";
          ctx.shadowBlur = 10;
          ctx.fillStyle = "#ffe14d";
          ctx.fillRect(bx - 4, 205, 6, 6);
          ctx.restore();
        }
        ctx.fillStyle = "#e8e2d6";
        ctx.font = "9px monospace";
        ctx.textAlign = "center";
        ctx.fillText(region.icon, bx, 180);
      });

      for (const n of hubNpcsRef.current) {
        n.phase += 0.02;
        const nx = n.x + Math.sin(n.phase) * 20;
        ctx.fillStyle = accentColor || "#3ee6e0";
        ctx.beginPath();
        ctx.arc(nx, n.y0, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.filter = "none";
      raf = requestAnimationFrame(render);
    }
    render();
    return () => cancelAnimationFrame(raf);
  }, [phase, accentColor]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "s", "a", "d", " "].includes(e.key)) e.preventDefault();
      if (e.key === "ArrowLeft" || e.key === "a") moveInputRef.current = -1;
      if (e.key === "ArrowRight" || e.key === "d") moveInputRef.current = 1;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === " ") jumpQueuedRef.current = true;
      if (e.key === "j" || e.key === "k") attackQueuedRef.current = true;
      if (e.key === "Shift") dashQueuedRef.current = true;
    }
    function handleKeyUp(e) {
      if ((e.key === "ArrowLeft" || e.key === "a") && moveInputRef.current === -1) moveInputRef.current = 0;
      if ((e.key === "ArrowRight" || e.key === "d") && moveInputRef.current === 1) moveInputRef.current = 0;
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  function setMove(v) { moveInputRef.current = v; }
  function pressJump() { jumpQueuedRef.current = true; }
  function pressAttack() { attackQueuedRef.current = true; }
  function pressDash() { dashQueuedRef.current = true; }

  if (deviceOk === null) return null;

  if (!deviceOk) {
    return (
      <div className="text-center py-10">
        <p className="text-3xl mb-4">💻</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">LAPTOP OR DESKTOP REQUIRED</p>
        <p className="text-textDim text-sm max-w-xs mx-auto">Eternal Frontier is built for laptop and desktop play. Please switch to a larger screen.</p>
      </div>
    );
  }

  if (phase === "menu") {
    return (
      <div className="text-center max-w-sm mx-auto">
        <p className="text-3xl mb-4">🏔️</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">ETERNAL FRONTIER</p>
        <p className="text-textDim text-sm mb-6">
          A ruined settlement, and three fading regions beyond it. A/D to move, W/Space to jump, J to swing, Shift to
          dash. Clear each region's guardian and watch the settlement come back to life.
        </p>
        <button onClick={enterHub} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          ENTER THE FRONTIER
        </button>
      </div>
    );
  }

  if (phase === "over") {
    return (
      <div className="text-center">
        <p className="text-3xl mb-3">{outcome ? "🌟" : "🕯️"}</p>
        <p className="font-pixel text-sm mb-2" style={{ color: "#ffb703" }}>
          {outcome ? "THE FRONTIER IS REBORN" : "THE JOURNEY ENDS HERE"}
        </p>
        <p className="font-mono text-xs text-textDim">{clearedRegions.length}/{REGIONS.length} regions restored</p>
      </div>
    );
  }

  if (phase === "hub") {
    return (
      <div className="text-center relative">
        {eventFlash && (
          <div className="absolute inset-x-0 -top-2 z-20 flex items-center justify-center pointer-events-none">
            <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/90 px-4 py-2 rounded-lg">{eventFlash}</p>
          </div>
        )}
        <p className="font-mono text-[11px] text-textDim mb-2">{clearedRegions.length}/{REGIONS.length} regions restored</p>
        <div className="relative mx-auto rounded-lg overflow-hidden border border-lineColor" style={{ width: VIEWPORT_W, maxWidth: "94vw" }}>
          <canvas ref={canvasRef} width={VIEWPORT_W} height={VIEWPORT_H} style={{ width: "100%", height: "auto", display: "block" }} />
        </div>
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {REGIONS.map((region) => {
            const cleared = clearedRegions.includes(region.id);
            return (
              <button
                key={region.id}
                onClick={() => !cleared && beginRegion(region)}
                disabled={cleared}
                className="px-3 py-2.5 rounded-md border font-mono text-[10px] disabled:opacity-40"
                style={{ borderColor: cleared ? "#6bff6b" : accentColor }}
              >
                {region.icon} {region.name} {cleared ? "✓" : ""}
              </button>
            );
          })}
        </div>
        <p className="font-mono text-[10px] text-textDim mt-3">Choose a region to set out into.</p>
      </div>
    );
  }

  return (
    <div className="text-center relative">
      {eventFlash && (
        <div className="absolute inset-x-0 -top-2 z-20 flex items-center justify-center pointer-events-none">
          <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/90 px-4 py-2 rounded-lg">{eventFlash}</p>
        </div>
      )}
      <div className="flex justify-between font-mono text-[11px] mb-2 text-textDim max-w-[480px] mx-auto">
        <span>{activeRegionRef.current?.name}</span>
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

      <div className="relative mx-auto rounded-lg overflow-hidden border border-lineColor" style={{ width: VIEWPORT_W, maxWidth: "94vw" }}>
        <canvas ref={canvasRef} width={VIEWPORT_W} height={VIEWPORT_H} style={{ width: "100%", height: "auto", display: "block" }} />
      </div>

      <div className="flex justify-center gap-2 mt-4">
        <button onMouseDown={() => setMove(-1)} onMouseUp={() => setMove(0)} onMouseLeave={() => setMove(0)} className="px-5 py-3 rounded-md border border-lineColor font-pixel text-xs select-none">◀</button>
        <button onMouseDown={() => setMove(1)} onMouseUp={() => setMove(0)} onMouseLeave={() => setMove(0)} className="px-5 py-3 rounded-md border border-lineColor font-pixel text-xs select-none">▶</button>
        <button onClick={pressJump} className="px-5 py-3 rounded-md border border-lineColor font-pixel text-[10px]">JUMP</button>
        <button onClick={pressAttack} className="px-5 py-3 rounded-md font-pixel text-[10px] text-bgDeep" style={{ background: accentColor }}>SWING</button>
        <button onClick={pressDash} className="px-5 py-3 rounded-md font-pixel text-[10px] text-bgDeep" style={{ background: "#ff3ea5" }}>DASH</button>
      </div>
      <p className="font-mono text-[10px] text-textDim mt-3">A/D move · W/Space jump · J swing · Shift dash</p>
    </div>
  );
}
