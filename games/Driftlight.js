"use client";

import { useEffect, useRef, useState } from "react";
import { drawSprite } from "@/lib/pixelSprites";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const VIEWPORT_W = 480;
const VIEWPORT_H = 320;
const WORLD_W = 2400;
const TICK_MS = 33;
const GROUND_Y = 300;
const GRAVITY = 0.5;
const GLIDE_GRAVITY = 0.12;
const JUMP_VELOCITY = -10;
const ACCEL = 0.35;
const DECEL = 0.4;
const MAX_SPEED = 3;
const PLAYER_R = 10;
const COYOTE_TICKS = 5;
const JUMP_BUFFER_TICKS = 5;
const DASH_SPEED = 9;
const DASH_TICKS = 8;
const DASH_COOLDOWN_MS = 1400;

const PLATFORMS = [
  { x: 0, y: GROUND_Y, w: 500, h: 60 },
  { x: 560, y: 250, w: 70, h: 14 },
  { x: 680, y: 200, w: 70, h: 14 },
  { x: 800, y: GROUND_Y, w: 500, h: 60 },
  { x: 1380, y: 240, w: 90, h: 14 },
  { x: 1550, y: GROUND_Y, w: 850, h: 60 },
];

function zoneColors(worldX) {
  const zones = [
    { x: 0, sky: [10, 20, 24], glow: "#3ee6e0" },
    { x: 900, sky: [18, 10, 30], glow: "#b45cff" },
    { x: 1700, sky: [6, 8, 26], glow: "#9be8ff" },
  ];
  let a = zones[0], b = zones[1];
  for (let i = 0; i < zones.length - 1; i++) {
    if (worldX >= zones[i].x && worldX <= zones[i + 1].x) {
      a = zones[i]; b = zones[i + 1];
      break;
    }
  }
  if (worldX > zones[zones.length - 1].x) { a = zones[zones.length - 1]; b = a; }
  const t = b === a ? 0 : Math.max(0, Math.min(1, (worldX - a.x) / (b.x - a.x)));
  const sky = a.sky.map((v, i) => Math.round(v + (b.sky[i] - v) * t));
  return { sky, glow: t < 0.5 ? a.glow : b.glow };
}

function fragmentPositions() {
  const pts = [];
  const xs = [140, 320, 590, 710, 900, 1120, 1300, 1410, 1650, 1850, 2050, 2250];
  xs.forEach((x, i) => pts.push({ id: i, x, y: 260 - (i % 3) * 35, collected: false }));
  return pts;
}

export default function Driftlight({ onFinish, accentColor }) {
  const canvasRef = useRef(null);
  const [deviceOk, setDeviceOk] = useState(null);
  const [phase, setPhase] = useState("menu");
  const [hud, setHud] = useState({ fragments: 0, total: 12, dashReady: true });
  const [outcome, setOutcome] = useState(null);
  const [bossFlash, setBossFlash] = useState(false);

  const playerRef = useRef({ x: 50, y: GROUND_Y - PLAYER_R, vx: 0, vy: 0, facing: 1, onGround: false, jumpsUsed: 0, coyote: 0, jumpBuffer: 0, dashing: 0, dashCooldownUntil: 0 });
  const moveInputRef = useRef(0);
  const jumpHeldRef = useRef(false);
  const jumpQueuedRef = useRef(false);
  const dashQueuedRef = useRef(false);
  const cameraXRef = useRef(0);
  const fragmentsRef = useRef(fragmentPositions());
  const trailRef = useRef([]);
  const ambientRef = useRef([]);
  const critterRef = useRef([]);
  const bossRef = useRef(null);
  const bossTriggeredRef = useRef(false);
  const telegraphRef = useRef([]);
  const particlesRef = useRef([]);
  const floatTextRef = useRef([]);
  const elapsedRef = useRef(0);
  const collectedCountRef = useRef(0);
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
    playerRef.current = { x: 50, y: GROUND_Y - PLAYER_R, vx: 0, vy: 0, facing: 1, onGround: false, jumpsUsed: 0, coyote: 0, jumpBuffer: 0, dashing: 0, dashCooldownUntil: 0 };
    moveInputRef.current = 0;
    jumpHeldRef.current = false;
    jumpQueuedRef.current = false;
    dashQueuedRef.current = false;
    cameraXRef.current = 0;
    fragmentsRef.current = fragmentPositions();
    trailRef.current = [];
    ambientRef.current = Array.from({ length: 45 }, () => ({
      x: Math.random() * WORLD_W,
      y: 40 + Math.random() * 260,
      phase: Math.random() * Math.PI * 2,
      speed: 0.3 + Math.random() * 0.5,
    }));
    critterRef.current = [
      { x: 400, baseY: 180, y0: 180, phase: 0 },
      { x: 1000, baseY: 150, y0: 150, phase: 1.5 },
      { x: 1900, baseY: 200, y0: 200, phase: 3 },
    ];
    bossRef.current = null;
    bossTriggeredRef.current = false;
    telegraphRef.current = [];
    particlesRef.current = [];
    floatTextRef.current = [];
    elapsedRef.current = 0;
    collectedCountRef.current = 0;
    pausedRef.current = false;
    finishedRef.current = false;
  }

  function spawnParticles(x, y, color, count = 6) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.4 + Math.random() * 1;
      particlesRef.current.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color });
    }
  }
  function spawnFloatText(x, y, text, color) {
    floatTextRef.current.push({ x, y, text, color, life: 1 });
  }

  function endRun(won) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(simIntervalRef.current);
    setOutcome(won ? "victory" : "defeat");
    setPhase("over");
    sfx[won ? "newBest" : "lose"]();
    const score = collectedCountRef.current * 25 + Math.round(elapsedRef.current) + (won ? 300 : 0);
    setTimeout(() => onFinish(Math.max(0, score)), 1600);
  }

  function begin() {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    resetRun();
    setOutcome(null);
    setPhase("playing");

    simIntervalRef.current = setInterval(() => {
      if (pausedRef.current) return;
      elapsedRef.current += TICK_MS / 1000;
      const p = playerRef.current;
      const now = elapsedRef.current * 1000;

      const target = moveInputRef.current * MAX_SPEED;
      if (p.vx < target) p.vx = Math.min(target, p.vx + ACCEL);
      else if (p.vx > target) p.vx = Math.max(target, p.vx - DECEL);
      if (moveInputRef.current !== 0) p.facing = moveInputRef.current;

      if (dashQueuedRef.current && now > p.dashCooldownUntil) {
        dashQueuedRef.current = false;
        p.dashing = DASH_TICKS;
        p.dashCooldownUntil = now + DASH_COOLDOWN_MS;
        sfx.boost();
        spawnParticles(p.x, p.y, "#3ee6e0", 10);
      } else {
        dashQueuedRef.current = false;
      }
      if (p.dashing > 0) {
        p.x += p.facing * DASH_SPEED;
        p.dashing -= 1;
        trailRef.current.push({ x: p.x, y: p.y, life: 1 });
      } else {
        p.x += p.vx;
      }
      p.x = Math.max(PLAYER_R, Math.min(WORLD_W - PLAYER_R, p.x));

      if (p.onGround) p.coyote = COYOTE_TICKS;
      else if (p.coyote > 0) p.coyote -= 1;

      if (jumpQueuedRef.current) {
        jumpQueuedRef.current = false;
        p.jumpBuffer = JUMP_BUFFER_TICKS;
      } else if (p.jumpBuffer > 0) {
        p.jumpBuffer -= 1;
      }

      if (p.jumpBuffer > 0 && (p.onGround || p.coyote > 0)) {
        p.vy = JUMP_VELOCITY;
        p.jumpsUsed = 1;
        p.jumpBuffer = 0;
        p.coyote = 0;
        p.onGround = false;
        sfx.tap();
      } else if (p.jumpBuffer > 0 && p.jumpsUsed < 2) {
        p.vy = JUMP_VELOCITY * 0.9;
        p.jumpsUsed = 2;
        p.jumpBuffer = 0;
        spawnParticles(p.x, p.y, accentColor || "#3ee6e0", 8);
        sfx.boost();
      }

      const gliding = jumpHeldRef.current && p.vy > 0 && !p.onGround;
      p.vy += gliding ? GLIDE_GRAVITY : GRAVITY;
      if (p.dashing === 0) p.y += p.vy;

      p.onGround = false;
      for (const plat of PLATFORMS) {
        const feetY = p.y + PLAYER_R;
        const prevFeetY = feetY - p.vy;
        if (p.vy >= 0 && p.x + PLAYER_R > plat.x && p.x - PLAYER_R < plat.x + plat.w) {
          if (prevFeetY <= plat.y && feetY >= plat.y) {
            p.y = plat.y - PLAYER_R;
            p.vy = 0;
            p.onGround = true;
            p.jumpsUsed = 0;
          }
        }
      }
      if (p.y > 450) {
        p.x = 50; p.y = GROUND_Y - PLAYER_R; p.vx = 0; p.vy = 0;
        spawnFloatText(VIEWPORT_W / 2 + cameraXRef.current, 100, "Drifting back to the light...", "#9be8ff");
      }

      cameraXRef.current = Math.max(0, Math.min(WORLD_W - VIEWPORT_W, p.x - VIEWPORT_W / 2));

      for (const f of fragmentsRef.current) {
        if (f.collected) continue;
        const d = Math.hypot(p.x - f.x, p.y - f.y);
        if (d < 18) {
          f.collected = true;
          collectedCountRef.current += 1;
          sfx.correct();
          haptics.tap();
          spawnParticles(f.x, f.y, "#ffe14d", 12);
        }
      }

      if (!bossTriggeredRef.current && p.x > 2050) {
        bossTriggeredRef.current = true;
        bossRef.current = { x: 2280, y: GROUND_Y - 60, hp: 100, maxHp: 100, phase: 1, pulseCooldown: 1600 };
        setBossFlash(true);
        setTimeout(() => setBossFlash(false), 2000);
        sfx.levelUp();
      }

      const boss = bossRef.current;
      if (boss) {
        boss.pulseCooldown -= TICK_MS;
        if (boss.pulseCooldown <= 0) {
          boss.pulseCooldown = 2600;
          telegraphRef.current.push({ x: boss.x, y: boss.y, radius: 8, maxRadius: 100, life: 1 });
        }
        const dBoss = Math.hypot(p.x - boss.x, p.y - boss.y);
        if (dBoss < 60 && boss.hp > 0) {
          boss.hp -= 0.6;
          spawnParticles(p.x, p.y, "#ffe14d", 2);
          if (boss.hp <= 0) {
            spawnParticles(boss.x, boss.y, "#ffb703", 40);
            spawnFloatText(boss.x, boss.y - 60, "THE COLOSSUS AWAKENS TO LIGHT", "#ffb703");
            bossRef.current = null;
            endRun(true);
            return;
          }
        }
      }

      particlesRef.current = particlesRef.current.filter((pt) => {
        pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.02; pt.life -= 0.04;
        return pt.life > 0;
      });
      floatTextRef.current = floatTextRef.current.filter((ft) => {
        ft.y -= 0.4; ft.life -= 0.015;
        return ft.life > 0;
      });
      telegraphRef.current = telegraphRef.current.filter((tg) => {
        tg.radius = Math.min(tg.maxRadius, tg.radius + 4); tg.life -= 0.03;
        return tg.life > 0;
      });
      trailRef.current = trailRef.current.filter((t) => {
        t.life -= 0.08;
        return t.life > 0;
      });

      setHud({
        fragments: collectedCountRef.current,
        total: fragmentsRef.current.length,
        dashReady: now > p.dashCooldownUntil,
      });

      if (collectedCountRef.current >= fragmentsRef.current.length && !bossTriggeredRef.current && p.x > WORLD_W - 100) {
        endRun(true);
      }
    }, TICK_MS);
  }

  useEffect(() => () => clearInterval(simIntervalRef.current), []);

  useEffect(() => {
    if (phase !== "playing") return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");

    function render() {
      const camX = cameraXRef.current;
      const worldXCenter = camX + VIEWPORT_W / 2;
      const { sky, glow } = zoneColors(worldXCenter);

      const cycle = (Math.sin(elapsedRef.current * 0.05) + 1) / 2;
      const b = 1 + cycle * 0.6;
      ctx.fillStyle = `rgb(${Math.min(255, sky[0] * b)}, ${Math.min(255, sky[1] * b)}, ${Math.min(255, sky[2] * b)})`;
      ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);

      ctx.globalAlpha = Math.max(0, 1 - cycle) * 0.8;
      ctx.fillStyle = "#e8e2d6";
      for (let i = 0; i < 40; i++) {
        const sx = (i * 97 - camX * 0.15) % VIEWPORT_W;
        const sy = (i * 53) % 140;
        ctx.fillRect(sx < 0 ? sx + VIEWPORT_W : sx, sy, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = "rgba(255,255,255,0.04)";
      for (let i = 0; i < 8; i++) {
        const wx = i * 260 - camX * 0.2;
        ctx.beginPath();
        ctx.ellipse(wx, 260, 90, 40, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(255,255,255,0.07)";
      for (let i = 0; i < 10; i++) {
        const wx = i * 200 - camX * 0.5;
        ctx.beginPath();
        ctx.ellipse(wx, 280, 60, 26, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const plat of PLATFORMS) {
        ctx.fillStyle = "rgba(20,14,34,0.9)";
        ctx.fillRect(plat.x - camX, plat.y, plat.w, plat.h);
        ctx.fillStyle = glow;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(plat.x - camX, plat.y, plat.w, 2);
        ctx.globalAlpha = 1;
      }

      for (const a of ambientRef.current) {
        a.phase += a.speed * 0.02;
        const ax = a.x - camX;
        if (ax < -20 || ax > VIEWPORT_W + 20) continue;
        const ay = a.y + Math.sin(a.phase) * 12;
        ctx.globalAlpha = 0.4 + Math.sin(a.phase * 2) * 0.3;
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(ax, ay, 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      for (const c of critterRef.current) {
        c.phase += 0.02;
        const cx = c.x - camX;
        if (cx < -30 || cx > VIEWPORT_W + 30) continue;
        const cy = c.y0 + Math.sin(c.phase) * 18;
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = "#9be8ff";
        ctx.beginPath();
        ctx.ellipse(cx, cy, 8, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      for (const f of fragmentsRef.current) {
        if (f.collected) continue;
        const fx = f.x - camX;
        const bob = Math.sin(elapsedRef.current * 3 + f.id) * 4;
        ctx.save();
        ctx.shadowColor = "#ffe14d";
        ctx.shadowBlur = 16;
        ctx.fillStyle = "#ffe14d";
        ctx.beginPath();
        ctx.arc(fx, f.y + bob, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      for (const tg of telegraphRef.current) {
        ctx.globalAlpha = Math.max(0, tg.life * 0.5);
        ctx.strokeStyle = "#ffb703";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(tg.x - camX, tg.y, tg.radius, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      const boss = bossRef.current;
      if (boss) {
        ctx.save();
        ctx.shadowColor = "#ffb703";
        ctx.shadowBlur = 26;
        drawSprite(ctx, "colossus", boss.x - camX, boss.y, 7);
        ctx.restore();
        const barW = 100;
        ctx.fillStyle = "#000";
        ctx.fillRect(boss.x - camX - barW / 2, boss.y - 70, barW, 4);
        ctx.fillStyle = "#ffb703";
        ctx.fillRect(boss.x - camX - barW / 2, boss.y - 70, barW * (boss.hp / boss.maxHp), 4);
      }

      for (const t of trailRef.current) {
        ctx.globalAlpha = Math.max(0, t.life * 0.4);
        ctx.fillStyle = accentColor || "#3ee6e0";
        ctx.beginPath();
        ctx.arc(t.x - camX, t.y, PLAYER_R * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      for (const pt of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, pt.life);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - camX - 1.5, pt.y - 1.5, 3, 3);
        ctx.globalAlpha = 1;
      }

      const p = playerRef.current;
      const px = p.x - camX;
      ctx.save();
      ctx.shadowColor = accentColor || "#3ee6e0";
      ctx.shadowBlur = 20;
      ctx.fillStyle = accentColor || "#3ee6e0";
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(px, p.y, PLAYER_R * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#f5f2ea";
      ctx.beginPath();
      ctx.arc(px, p.y, PLAYER_R * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      for (const ft of floatTextRef.current) {
        ctx.globalAlpha = Math.max(0, ft.life);
        ctx.fillStyle = ft.color;
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(ft.text, ft.x - camX, ft.y);
        ctx.globalAlpha = 1;
      }

      frameRef.current = requestAnimationFrame(render);
    }
    render();
    return () => cancelAnimationFrame(frameRef.current);
  }, [phase, accentColor]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "s", "a", "d", " ", "j", "k"].includes(e.key)) {
        e.preventDefault();
      }
      if (e.key === "ArrowLeft" || e.key === "a") moveInputRef.current = -1;
      if (e.key === "ArrowRight" || e.key === "d") moveInputRef.current = 1;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === " ") {
        jumpQueuedRef.current = true;
        jumpHeldRef.current = true;
      }
      if (e.key === "j" || e.key === "k") dashQueuedRef.current = true;
    }
    function handleKeyUp(e) {
      if ((e.key === "ArrowLeft" || e.key === "a") && moveInputRef.current === -1) moveInputRef.current = 0;
      if ((e.key === "ArrowRight" || e.key === "d") && moveInputRef.current === 1) moveInputRef.current = 0;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === " ") jumpHeldRef.current = false;
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  function setMove(v) {
    moveInputRef.current = v;
  }
  function pressJump(down) {
    if (down) jumpQueuedRef.current = true;
    jumpHeldRef.current = down;
  }
  function queueDash() {
    dashQueuedRef.current = true;
  }

  if (deviceOk === null) return null;

  if (!deviceOk) {
    return (
      <div className="text-center py-10">
        <p className="text-3xl mb-4">💻</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">LAPTOP OR DESKTOP REQUIRED</p>
        <p className="text-textDim text-sm max-w-xs mx-auto">
          Driftlight is built for laptop and desktop play. Please switch to a larger screen to begin drifting.
        </p>
      </div>
    );
  }

  if (phase === "menu") {
    return (
      <div className="text-center max-w-sm mx-auto">
        <p className="text-3xl mb-4">✨</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">DRIFTLIGHT</p>
        <p className="text-textDim text-sm mb-6">
          A/D or ← → to move, W/Up/Space to jump (hold to glide while falling), J to dash. There's barely any combat
          here — just movement, light, and 12 fragments scattered through a drifting world. Reach the far end to
          meet what's waiting there.
        </p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          BEGIN THE DRIFT
        </button>
      </div>
    );
  }

  if (phase === "over") {
    return (
      <div className="text-center">
        <p className="text-3xl mb-3">{outcome === "victory" ? "🌟" : "🌫️"}</p>
        <p className="font-pixel text-sm mb-2" style={{ color: "#ffb703" }}>
          {outcome === "victory" ? "THE LIGHT RETURNS" : "THE DRIFT ENDS"}
        </p>
        <p className="font-mono text-xs text-textDim">{hud.fragments}/{hud.total} fragments found</p>
      </div>
    );
  }

  return (
    <div className="text-center relative">
      {bossFlash && (
        <div className="absolute inset-x-0 -top-2 z-20 flex items-center justify-center pointer-events-none">
          <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/90 px-4 py-2 rounded-lg">THE COLOSSUS STIRS</p>
        </div>
      )}
      <div className="flex justify-between font-mono text-[11px] mb-2 text-textDim max-w-[480px] mx-auto">
        <span>✨ {hud.fragments}/{hud.total} fragments</span>
        <span>{hud.dashReady ? "Dash ready" : "Dash recharging..."}</span>
      </div>

      <div className="relative mx-auto rounded-lg overflow-hidden border border-lineColor" style={{ width: VIEWPORT_W, maxWidth: "94vw" }}>
        <canvas ref={canvasRef} width={VIEWPORT_W} height={VIEWPORT_H} style={{ width: "100%", height: "auto", display: "block" }} />
      </div>

      <div className="flex justify-center gap-2 mt-4">
        <button onMouseDown={() => setMove(-1)} onMouseUp={() => setMove(0)} onMouseLeave={() => setMove(0)} className="px-5 py-3 rounded-md border border-lineColor font-pixel text-xs select-none">◀</button>
        <button onMouseDown={() => setMove(1)} onMouseUp={() => setMove(0)} onMouseLeave={() => setMove(0)} className="px-5 py-3 rounded-md border border-lineColor font-pixel text-xs select-none">▶</button>
        <button onMouseDown={() => pressJump(true)} onMouseUp={() => pressJump(false)} onMouseLeave={() => pressJump(false)} className="px-5 py-3 rounded-md font-pixel text-[10px] text-bgDeep" style={{ background: accentColor }}>JUMP/GLIDE</button>
        <button onClick={queueDash} className="px-5 py-3 rounded-md font-pixel text-[10px] text-bgDeep" style={{ background: "#3ee6e0" }}>DASH</button>
      </div>
      <p className="font-mono text-[10px] text-textDim mt-3">A/D or ← → to move, hold Jump while falling to glide, J to dash.</p>
    </div>
  );
}
