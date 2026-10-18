"use client";

import { useEffect, useRef, useState } from "react";
import { drawSprite } from "@/lib/pixelSprites";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const VIEWPORT_W = 480;
const VIEWPORT_H = 320;
const WORLD_W = 1600;
const TICK_MS = 33;
const GROUND_Y = 300;
const GRAVITY = 0.55;
const JUMP_VELOCITY = -10.5;
const MOVE_SPEED = 2.8;
const PLAYER_W = 18;
const PLAYER_H = 26;
const ATTACK_RANGE = 30;
const ATTACK_DURATION_MS = 160;
const ATTACK_COOLDOWN_MS = 380;
const HIT_IFRAMES_TICKS = 24;

const PLATFORMS = [
  { x: 0, y: GROUND_Y, w: 480, h: 60 },
  { x: 200, y: 210, w: 80, h: 16 },
  { x: 740, y: GROUND_Y, w: 260, h: 60 },
  { x: 1000, y: GROUND_Y, w: 600, h: 60 },
];

const ABILITY_ORB = { x: 240, y: 185, collected: false };
const BOSS_TRIGGER_X = 1040;

export default function Shadowfall({ onFinish, accentColor }) {
  const canvasRef = useRef(null);
  const [deviceOk, setDeviceOk] = useState(null);
  const [phase, setPhase] = useState("menu");
  const [hud, setHud] = useState({ hp: 100, maxHp: 100, bossHp: 0, bossMaxHp: 1, hasDoubleJump: false });
  const [abilityFlash, setAbilityFlash] = useState(false);
  const [bossFlash, setBossFlash] = useState(false);
  const [outcome, setOutcome] = useState(null);

  const playerRef = useRef({ x: 50, y: GROUND_Y - PLAYER_H / 2, vx: 0, vy: 0, hp: 100, maxHp: 100, facing: 1, onGround: false, jumpsUsed: 0, hasDoubleJump: false });
  const moveInputRef = useRef(0);
  const jumpQueuedRef = useRef(false);
  const attackQueuedRef = useRef(false);
  const lastAttackRef = useRef(0);
  const attackActiveUntilRef = useRef(0);
  const attackHitIdsRef = useRef(new Set());
  const invulnRef = useRef(0);
  const cameraXRef = useRef(0);
  const enemiesRef = useRef([]);
  const bossRef = useRef(null);
  const projectilesRef = useRef([]);
  const particlesRef = useRef([]);
  const floatTextRef = useRef([]);
  const telegraphRef = useRef([]);
  const abilityOrbRef = useRef({ ...ABILITY_ORB });
  const bossTriggeredRef = useRef(false);
  const elapsedRef = useRef(0);
  const killsRef = useRef(0);
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
    playerRef.current = { x: 50, y: GROUND_Y - PLAYER_H / 2, vx: 0, vy: 0, hp: 100, maxHp: 100, facing: 1, onGround: false, jumpsUsed: 0, hasDoubleJump: false };
    moveInputRef.current = 0;
    jumpQueuedRef.current = false;
    attackQueuedRef.current = false;
    invulnRef.current = 0;
    cameraXRef.current = 0;
    enemiesRef.current = [
      { id: 1, type: "huskcrawler", x: 150, y: GROUND_Y - 14, minX: 90, maxX: 420, dir: 1, speed: 1, hp: 20, maxHp: 20, radius: 12, damage: 8 },
      { id: 2, type: "wispdrifter", x: 850, y: 260, baseY: 260, x0: 850, phase: 0, hp: 12, maxHp: 12, radius: 10, damage: 6 },
      { id: 3, type: "huskcrawler", x: 800, y: GROUND_Y - 14, minX: 760, maxX: 960, dir: -1, speed: 1.1, hp: 20, maxHp: 20, radius: 12, damage: 8 },
    ];
    bossRef.current = null;
    projectilesRef.current = [];
    particlesRef.current = [];
    floatTextRef.current = [];
    telegraphRef.current = [];
    abilityOrbRef.current = { ...ABILITY_ORB };
    bossTriggeredRef.current = false;
    elapsedRef.current = 0;
    killsRef.current = 0;
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

  function endRun(won) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(simIntervalRef.current);
    setOutcome(won ? "victory" : "defeat");
    setPhase("over");
    sfx[won ? "newBest" : "lose"]();
    const score = killsRef.current * 15 + Math.round(elapsedRef.current) + (won ? 400 : 0) + (playerRef.current.hasDoubleJump ? 50 : 0);
    setTimeout(() => onFinish(Math.max(0, score)), 1400);
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

      p.vx = moveInputRef.current * MOVE_SPEED;
      if (moveInputRef.current !== 0) p.facing = moveInputRef.current;
      p.x = Math.max(PLAYER_W / 2, Math.min(WORLD_W - PLAYER_W / 2, p.x + p.vx));

      if (jumpQueuedRef.current) {
        jumpQueuedRef.current = false;
        if (p.onGround) {
          p.vy = JUMP_VELOCITY;
          p.jumpsUsed = 1;
          p.onGround = false;
          sfx.tap();
        } else if (p.hasDoubleJump && p.jumpsUsed < 2) {
          p.vy = JUMP_VELOCITY;
          p.jumpsUsed = 2;
          spawnParticles(p.x, p.y, "#3ee6e0", 6);
          sfx.boost();
        }
      }

      p.vy += GRAVITY;
      p.y += p.vy;

      p.onGround = false;
      for (const plat of PLATFORMS) {
        const feetY = p.y + PLAYER_H / 2;
        const prevFeetY = feetY - p.vy;
        if (p.vy >= 0 && p.x + PLAYER_W / 2 > plat.x && p.x - PLAYER_W / 2 < plat.x + plat.w) {
          if (prevFeetY <= plat.y && feetY >= plat.y) {
            p.y = plat.y - PLAYER_H / 2;
            p.vy = 0;
            p.onGround = true;
            p.jumpsUsed = 0;
          }
        }
      }
      if (p.y > 420) {
        p.hp = Math.max(1, p.hp - 15);
        p.x = 50;
        p.y = GROUND_Y - PLAYER_H / 2;
        p.vx = 0; p.vy = 0;
        spawnFloatText(VIEWPORT_W / 2 + cameraXRef.current, 100, "You fall into the dark... -15", "#ff3ea5");
        if (p.hp <= 0) { endRun(false); return; }
      }

      if (attackQueuedRef.current && now - lastAttackRef.current > ATTACK_COOLDOWN_MS) {
        attackQueuedRef.current = false;
        lastAttackRef.current = now;
        attackActiveUntilRef.current = now + ATTACK_DURATION_MS;
        attackHitIdsRef.current = new Set();
        sfx.hit();
      } else {
        attackQueuedRef.current = false;
      }
      const attacking = now < attackActiveUntilRef.current;

      cameraXRef.current = Math.max(0, Math.min(WORLD_W - VIEWPORT_W, p.x - VIEWPORT_W / 2));

      if (!abilityOrbRef.current.collected) {
        const d = Math.hypot(p.x - abilityOrbRef.current.x, p.y - abilityOrbRef.current.y);
        if (d < 22) {
          abilityOrbRef.current.collected = true;
          p.hasDoubleJump = true;
          sfx.levelUp();
          haptics.success();
          setAbilityFlash(true);
          setTimeout(() => setAbilityFlash(false), 2000);
          spawnParticles(abilityOrbRef.current.x, abilityOrbRef.current.y, "#3ee6e0", 20);
        }
      }

      if (!bossTriggeredRef.current && p.x > BOSS_TRIGGER_X) {
        bossTriggeredRef.current = true;
        bossRef.current = { x: 1350, y: GROUND_Y - 20, hp: 160, maxHp: 160, phase: 1, attackCooldown: 1200, slamCooldown: 3000 };
        setBossFlash(true);
        setTimeout(() => setBossFlash(false), 1800);
        sfx.levelUp();
      }

      if (invulnRef.current > 0) invulnRef.current -= 1;

      const survivors = [];
      for (const e of enemiesRef.current) {
        if (e.type === "huskcrawler") {
          e.x += e.dir * e.speed;
          if (e.x < e.minX || e.x > e.maxX) e.dir *= -1;
        } else if (e.type === "wispdrifter") {
          e.phase += 0.05;
          e.x = e.x0 + Math.sin(e.phase) * 60;
          e.y = e.baseY + Math.cos(e.phase * 1.3) * 20;
        }

        if (e.hp <= 0) {
          killsRef.current += 1;
          spawnParticles(e.x, e.y, "#b45cff", 10);
          continue;
        }

        if (attacking && !attackHitIdsRef.current.has(e.id)) {
          const inFront = p.facing > 0 ? e.x > p.x : e.x < p.x;
          const dist = Math.hypot(e.x - p.x, e.y - p.y);
          if (inFront && dist < ATTACK_RANGE) {
            attackHitIdsRef.current.add(e.id);
            e.hp -= 12;
            spawnFloatText(e.x, e.y - 14, "-12", "#ffe14d");
            spawnParticles(e.x, e.y, "#ffe14d", 5);
          }
        }

        const dist2 = Math.hypot(p.x - e.x, p.y - e.y);
        if (dist2 < e.radius + PLAYER_W / 2 && invulnRef.current === 0) {
          p.hp = Math.max(0, p.hp - e.damage);
          invulnRef.current = HIT_IFRAMES_TICKS;
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
          boss.attackCooldown = 800;
          spawnFloatText(boss.x, boss.y - 40, "THE WARDEN AWAKENS FULLY", "#ffb703");
          sfx.boost();
        }

        boss.attackCooldown -= TICK_MS;
        if (boss.attackCooldown <= 0) {
          boss.attackCooldown = boss.phase === 2 ? 900 : 1300;
          const angle = Math.atan2(p.y - boss.y, p.x - boss.x);
          projectilesRef.current.push({ x: boss.x, y: boss.y, vx: Math.cos(angle) * 3.2, vy: Math.sin(angle) * 3.2, damage: 10, life: 120 });
        }

        if (boss.phase === 2) {
          boss.slamCooldown -= TICK_MS;
          if (boss.slamCooldown <= 0) {
            boss.slamCooldown = 3200;
            telegraphRef.current.push({ x: boss.x, y: boss.y, radius: 6, maxRadius: 90, life: 1 });
            setTimeout(() => {
              const d = Math.hypot(p.x - boss.x, p.y - boss.y);
              if (d < 90 && bossRef.current) {
                p.hp = Math.max(0, p.hp - 18);
                spawnFloatText(p.x, p.y - 14, "SLAM! -18", "#ff3ea5");
                haptics.celebrate();
                if (p.hp <= 0) endRun(false);
              }
            }, 700);
          }
        }

        if (attacking && !attackHitIdsRef.current.has("boss")) {
          const inFront = p.facing > 0 ? boss.x > p.x : boss.x < p.x;
          const dist = Math.hypot(boss.x - p.x, boss.y - p.y);
          if (inFront && dist < ATTACK_RANGE + 14) {
            attackHitIdsRef.current.add("boss");
            boss.hp -= 10;
            spawnFloatText(boss.x, boss.y - 30, "-10", "#ffe14d");
            spawnParticles(boss.x, boss.y, "#ffe14d", 6);
            if (boss.hp <= 0) {
              spawnParticles(boss.x, boss.y, "#ffb703", 30);
              bossRef.current = null;
              endRun(true);
              return;
            }
          }
        }
      }

      projectilesRef.current = projectilesRef.current.filter((proj) => {
        proj.x += proj.vx; proj.y += proj.vy; proj.life -= 1;
        if (proj.life <= 0) return false;
        const d = Math.hypot(proj.x - p.x, proj.y - p.y);
        if (d < 12 && invulnRef.current === 0) {
          p.hp = Math.max(0, p.hp - proj.damage);
          invulnRef.current = HIT_IFRAMES_TICKS;
          spawnParticles(p.x, p.y, "#ff3ea5", 5);
          haptics.tap();
          if (p.hp <= 0) endRun(false);
          return false;
        }
        return true;
      });

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
        hp: Math.round(p.hp),
        maxHp: p.maxHp,
        bossHp: boss ? Math.round(boss.hp) : 0,
        bossMaxHp: boss ? boss.maxHp : 1,
        hasDoubleJump: p.hasDoubleJump,
      });
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
      ctx.fillStyle = "#0d0720";
      ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);

      ctx.fillStyle = "rgba(62,30,90,0.35)";
      for (let i = 0; i < 6; i++) {
        const wx = i * 320 - camX * 0.3;
        ctx.fillRect(wx, 180, 60, 140);
      }

      for (const plat of PLATFORMS) {
        ctx.fillStyle = "#241154";
        ctx.fillRect(plat.x - camX, plat.y, plat.w, plat.h);
        ctx.fillStyle = "rgba(169,159,214,0.25)";
        ctx.fillRect(plat.x - camX, plat.y, plat.w, 3);
      }

      if (!abilityOrbRef.current.collected) {
        const o = abilityOrbRef.current;
        ctx.fillStyle = "#3ee6e0";
        ctx.beginPath();
        ctx.arc(o.x - camX, o.y, 6 + Math.sin(elapsedRef.current * 4) * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const tg of telegraphRef.current) {
        ctx.globalAlpha = Math.max(0, tg.life * 0.6);
        ctx.strokeStyle = "#ff3ea5";
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(tg.x - camX, tg.y, tg.radius, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      for (const e of enemiesRef.current) {
        drawSprite(ctx, e.type, e.x - camX, e.y, 4);
        const barW = 18;
        ctx.fillStyle = "#000";
        ctx.fillRect(e.x - camX - barW / 2, e.y - 20, barW, 3);
        ctx.fillStyle = "#ff3ea5";
        ctx.fillRect(e.x - camX - barW / 2, e.y - 20, barW * (e.hp / e.maxHp), 3);
      }

      const boss = bossRef.current;
      if (boss) {
        drawSprite(ctx, "hollowwarden", boss.x - camX, boss.y, 6);
      }

      for (const proj of projectilesRef.current) {
        ctx.fillStyle = "#ff3ea5";
        ctx.beginPath(); ctx.arc(proj.x - camX, proj.y, 4, 0, Math.PI * 2); ctx.fill();
      }

      for (const pt of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, pt.life);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - camX - 1.5, pt.y - 1.5, 3, 3);
        ctx.globalAlpha = 1;
      }

      const p = playerRef.current;
      const blinking = invulnRef.current > 0 && Math.floor(invulnRef.current / 3) % 2 === 0;
      if (!blinking) {
        drawSprite(ctx, "wanderer", p.x - camX, p.y, 4.5, p.facing < 0);
      }
      const attacking = elapsedRef.current * 1000 < attackActiveUntilRef.current;
      if (attacking) {
        ctx.strokeStyle = accentColor || "#3ee6e0";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x - camX + p.facing * 14, p.y, 16, 0, Math.PI * 2);
        ctx.stroke();
      }

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
      if (e.key === "ArrowUp" || e.key === "w" || e.key === " ") jumpQueuedRef.current = true;
      if (e.key === "j" || e.key === "k") attackQueuedRef.current = true;
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

  function setMove(v) {
    moveInputRef.current = v;
  }
  function queueJump() {
    jumpQueuedRef.current = true;
  }
  function queueAttack() {
    attackQueuedRef.current = true;
  }

  if (deviceOk === null) return null;

  if (!deviceOk) {
    return (
      <div className="text-center py-10">
        <p className="text-3xl mb-4">💻</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">LAPTOP OR DESKTOP REQUIRED</p>
        <p className="text-textDim text-sm max-w-xs mx-auto">
          Shadowfall is built for laptop and desktop play. Please switch to a larger screen to enter Aether Hollow.
        </p>
      </div>
    );
  }

  if (phase === "menu") {
    return (
      <div className="text-center max-w-sm mx-auto">
        <p className="text-3xl mb-4">🌑</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">SHADOWFALL</p>
        <p className="text-textDim text-sm mb-6">
          A↔D or arrow keys to move, W/Up/Space to jump, J to attack. Explore Aether Hollow, find the ability that
          lets you cross the chasm, and face the Hollow Warden at the far end. Falling into a pit costs health, not
          your run — you'll respawn nearby.
        </p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          AWAKEN
        </button>
      </div>
    );
  }

  if (phase === "over") {
    return (
      <div className="text-center">
        <p className="text-3xl mb-3">{outcome === "victory" ? "🌟" : "💀"}</p>
        <p className="font-pixel text-sm mb-2" style={{ color: outcome === "victory" ? "#ffb703" : "#ff3ea5" }}>
          {outcome === "victory" ? "THE HOLLOW WARDEN FALLS" : "CONSUMED BY SHADOW"}
        </p>
        <p className="font-mono text-xs text-textDim">{killsRef.current} enemies defeated</p>
      </div>
    );
  }

  return (
    <div className="text-center relative">
      {abilityFlash && (
        <div className="absolute inset-x-0 -top-2 z-20 flex items-center justify-center pointer-events-none">
          <p className="font-pixel text-sm text-accentCyan ap-blink bg-bgDeep/90 px-4 py-2 rounded-lg">DOUBLE JUMP ACQUIRED</p>
        </div>
      )}
      {bossFlash && (
        <div className="absolute inset-x-0 -top-2 z-20 flex items-center justify-center pointer-events-none">
          <p className="font-pixel text-sm text-accentMagenta ap-blink bg-bgDeep/90 px-4 py-2 rounded-lg">THE HOLLOW WARDEN STIRS</p>
        </div>
      )}
      <div className="flex justify-between font-mono text-[11px] mb-2 text-textDim max-w-[480px] mx-auto">
        <span>❤️ {hud.hp}/{hud.maxHp}</span>
        <span>{hud.hasDoubleJump ? "✨ Double Jump" : ""}</span>
      </div>
      {hud.bossHp > 0 && (
        <div className="max-w-[480px] mx-auto mb-1">
          <div className="h-2 rounded-full bg-bgDeep border border-lineColor overflow-hidden">
            <div className="h-full bg-accentMagenta" style={{ width: `${(hud.bossHp / hud.bossMaxHp) * 100}%` }} />
          </div>
          <p className="font-mono text-[9px] text-textDim mt-0.5">The Hollow Warden</p>
        </div>
      )}

      <div className="relative mx-auto rounded-lg overflow-hidden border border-lineColor" style={{ width: VIEWPORT_W, maxWidth: "94vw" }}>
        <canvas ref={canvasRef} width={VIEWPORT_W} height={VIEWPORT_H} style={{ width: "100%", height: "auto", display: "block" }} />
      </div>

      <div className="flex justify-center gap-2 mt-4">
        <button onMouseDown={() => setMove(-1)} onMouseUp={() => setMove(0)} onMouseLeave={() => setMove(0)} className="px-5 py-3 rounded-md border border-lineColor font-pixel text-xs select-none">◀</button>
        <button onMouseDown={() => setMove(1)} onMouseUp={() => setMove(0)} onMouseLeave={() => setMove(0)} className="px-5 py-3 rounded-md border border-lineColor font-pixel text-xs select-none">▶</button>
        <button onClick={queueJump} className="px-5 py-3 rounded-md font-pixel text-[10px] text-bgDeep" style={{ background: accentColor }}>JUMP</button>
        <button onClick={queueAttack} className="px-5 py-3 rounded-md font-pixel text-[10px] text-bgDeep" style={{ background: "#ff3ea5" }}>ATTACK</button>
      </div>
      <p className="font-mono text-[10px] text-textDim mt-3">A/D or ← → to move, W/Space to jump, J to attack.</p>
    </div>
  );
}
