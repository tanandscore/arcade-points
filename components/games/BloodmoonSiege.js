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

const ENEMY_TYPES = {
  bat: { sprite: "bat", hp: 8, speed: 1.7, damage: 6, xp: 4, radius: 10 },
  zombie: { sprite: "zombie", hp: 22, speed: 0.8, damage: 10, xp: 8, radius: 13 },
  skeleton: { sprite: "skeleton", hp: 14, speed: 1.2, damage: 8, xp: 6, radius: 12 },
  reaper: { sprite: "reaper", hp: 220, speed: 0.6, damage: 20, xp: 80, radius: 20 },
};

const UPGRADE_POOL = [
  { id: "rapid", name: "Rapid Fire", desc: "-15% attack cooldown", apply: (s) => ({ ...s, cooldown: Math.max(120, s.cooldown * 0.85) }) },
  { id: "pierce", name: "Piercing Shots", desc: "Projectiles hit +1 more enemy", apply: (s) => ({ ...s, pierce: s.pierce + 1 }) },
  { id: "multi", name: "Multi-Shot", desc: "+1 projectile per attack", apply: (s) => ({ ...s, shots: s.shots + 1 }) },
  { id: "power", name: "Raw Power", desc: "+30% damage", apply: (s) => ({ ...s, damage: Math.round(s.damage * 1.3) }) },
  { id: "vitality", name: "Vitality", desc: "+20 max HP, full heal", apply: (s) => ({ ...s, maxHp: s.maxHp + 20, hp: s.maxHp + 20 }) },
  { id: "swift", name: "Swift Boots", desc: "+15% move speed", apply: (s) => ({ ...s, moveSpeed: s.moveSpeed * 1.15 }) },
  { id: "magnet", name: "Gem Magnet", desc: "+40% pickup radius", apply: (s) => ({ ...s, pickupRadius: s.pickupRadius * 1.4 }) },
];

function xpForLevel(level) {
  return 18 + level * 12;
}

function pickUpgrades() {
  const pool = [...UPGRADE_POOL];
  const picks = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(idx, 1)[0]);
  }
  return picks;
}

function initialStats() {
  return {
    hp: 60,
    maxHp: 60,
    moveSpeed: 2.4,
    cooldown: 500,
    damage: 9,
    shots: 1,
    pierce: 0,
    pickupRadius: 32,
  };
}

export default function BloodmoonSiege({ onFinish, accentColor }) {
  const canvasRef = useRef(null);
  const [deviceOk, setDeviceOk] = useState(null);
  const [phase, setPhase] = useState("menu");
  const [hud, setHud] = useState({ hp: 60, maxHp: 60, level: 1, xp: 0, xpNeeded: xpForLevel(1), timeLeft: SESSION_SECONDS, kills: 0 });
  const [upgradeChoices, setUpgradeChoices] = useState([]);
  const [outcome, setOutcome] = useState(null);

  const statsRef = useRef(initialStats());
  const playerPosRef = useRef({ x: ARENA_W / 2, y: ARENA_H / 2 });
  const moveInputRef = useRef({ x: 0, y: 0 });
  const invulnRef = useRef(0);
  const enemiesRef = useRef([]);
  const projectilesRef = useRef([]);
  const gemsRef = useRef([]);
  const particlesRef = useRef([]);
  const floatTextRef = useRef([]);
  const killsRef = useRef(0);
  const xpRef = useRef(0);
  const levelRef = useRef(1);
  const elapsedRef = useRef(0);
  const lastAttackRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const bossSpawnedRef = useRef({});
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
    statsRef.current = initialStats();
    playerPosRef.current = { x: ARENA_W / 2, y: ARENA_H / 2 };
    invulnRef.current = 0;
    enemiesRef.current = [];
    projectilesRef.current = [];
    gemsRef.current = [];
    particlesRef.current = [];
    floatTextRef.current = [];
    killsRef.current = 0;
    xpRef.current = 0;
    levelRef.current = 1;
    elapsedRef.current = 0;
    lastAttackRef.current = 0;
    spawnTimerRef.current = 0;
    bossSpawnedRef.current = {};
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

  function spawnEnemy() {
    const t = elapsedRef.current;
    const pool = t < 30 ? ["bat"] : t < 70 ? ["bat", "zombie"] : ["bat", "zombie", "skeleton"];
    const type = pool[Math.floor(Math.random() * pool.length)];
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    if (edge === 0) { x = Math.random() * ARENA_W; y = -20; }
    else if (edge === 1) { x = ARENA_W + 20; y = Math.random() * ARENA_H; }
    else if (edge === 2) { x = Math.random() * ARENA_W; y = ARENA_H + 20; }
    else { x = -20; y = Math.random() * ARENA_H; }

    const def = ENEMY_TYPES[type];
    const scale = 1 + Math.min(1.2, t / 150);
    enemiesRef.current.push({
      id: Math.random(),
      type,
      x,
      y,
      hp: Math.round(def.hp * scale),
      maxHp: Math.round(def.hp * scale),
      speed: def.speed,
      damage: def.damage,
      xp: def.xp,
      radius: def.radius,
    });
  }

  function spawnBoss() {
    const def = ENEMY_TYPES.reaper;
    enemiesRef.current.push({
      id: Math.random(),
      type: "reaper",
      x: ARENA_W / 2,
      y: -30,
      hp: def.hp,
      maxHp: def.hp,
      speed: def.speed,
      damage: def.damage,
      xp: def.xp,
      radius: def.radius,
      isBoss: true,
    });
    spawnFloatText(ARENA_W / 2, 60, "THE REAPER RISES", "#ff3ea5");
    sfx.levelUp();
  }

  function fireAttack() {
    const stats = statsRef.current;
    const enemies = enemiesRef.current;
    if (!enemies.length) return;
    const p = playerPosRef.current;
    let nearest = null;
    let nearestDist = Infinity;
    for (const e of enemies) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = e;
      }
    }
    if (!nearest) return;
    const baseAngle = Math.atan2(nearest.y - p.y, nearest.x - p.x);
    const spread = 0.22;
    for (let i = 0; i < stats.shots; i++) {
      const offset = (i - (stats.shots - 1) / 2) * spread;
      const angle = baseAngle + offset;
      projectilesRef.current.push({
        x: p.x,
        y: p.y,
        vx: Math.cos(angle) * 5.5,
        vy: Math.sin(angle) * 5.5,
        damage: stats.damage,
        pierceLeft: stats.pierce,
        hitIds: new Set(),
        life: 90,
      });
    }
    sfx.tap();
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
      setUpgradeChoices(pickUpgrades());
      setPhase("levelup");
    }
  }

  function chooseUpgrade(upgrade) {
    statsRef.current = upgrade.apply(statsRef.current);
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
    const score = killsRef.current * 12 + Math.round(elapsedRef.current) * 2 + levelRef.current * 40;
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
      const stats = statsRef.current;
      const p = playerPosRef.current;

      const mv = moveInputRef.current;
      if (mv.x || mv.y) {
        const mag = Math.hypot(mv.x, mv.y) || 1;
        p.x = Math.max(12, Math.min(ARENA_W - 12, p.x + (mv.x / mag) * stats.moveSpeed));
        p.y = Math.max(12, Math.min(ARENA_H - 12, p.y + (mv.y / mag) * stats.moveSpeed));
      }

      const now = elapsedRef.current * 1000;
      if (now - lastAttackRef.current > stats.cooldown) {
        lastAttackRef.current = now;
        fireAttack();
      }

      spawnTimerRef.current += TICK_MS;
      const spawnEvery = Math.max(280, 1100 - elapsedRef.current * 6);
      if (spawnTimerRef.current > spawnEvery) {
        spawnTimerRef.current = 0;
        spawnEnemy();
      }

      [90, 200].forEach((mark) => {
        if (elapsedRef.current >= mark && !bossSpawnedRef.current[mark]) {
          bossSpawnedRef.current[mark] = true;
          spawnBoss();
        }
      });

      if (invulnRef.current > 0) invulnRef.current -= 1;
      for (const e of enemiesRef.current) {
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const dist = Math.hypot(dx, dy) || 1;
        e.x += (dx / dist) * e.speed;
        e.y += (dy / dist) * e.speed;

        if (dist < e.radius + 10 && invulnRef.current === 0) {
          stats.hp = Math.max(0, stats.hp - e.damage);
          invulnRef.current = 18;
          spawnParticles(p.x, p.y, "#ff3ea5", 6);
          haptics.tap();
          if (stats.hp <= 0) {
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

        for (const e of enemiesRef.current) {
          if (proj.hitIds.has(e.id)) continue;
          const d = Math.hypot(proj.x - e.x, proj.y - e.y);
          if (d < e.radius) {
            proj.hitIds.add(e.id);
            e.hp -= proj.damage;
            spawnFloatText(e.x, e.y - 10, `-${proj.damage}`, "#ffb703");
            spawnParticles(proj.x, proj.y, "#3ee6e0", 4);
            if (proj.pierceLeft > 0) {
              proj.pierceLeft -= 1;
            } else {
              return false;
            }
          }
        }
        return true;
      });

      const survivors = [];
      for (const e of enemiesRef.current) {
        if (e.hp <= 0) {
          killsRef.current += 1;
          spawnParticles(e.x, e.y, e.isBoss ? "#ffb703" : "#ff5a3c", e.isBoss ? 24 : 10);
          gemsRef.current.push({ id: Math.random(), x: e.x, y: e.y, value: e.xp });
          if (e.isBoss) {
            spawnFloatText(e.x, e.y - 20, "BOSS DEFEATED!", "#ffb703");
          }
        } else {
          survivors.push(e);
        }
      }
      enemiesRef.current = survivors;

      gemsRef.current = gemsRef.current.filter((g) => {
        const d = Math.hypot(p.x - g.x, p.y - g.y);
        if (d < stats.pickupRadius) {
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

      setHud({
        hp: Math.round(stats.hp),
        maxHp: stats.maxHp,
        level: levelRef.current,
        xp: xpRef.current,
        xpNeeded: xpForLevel(levelRef.current),
        timeLeft: Math.max(0, Math.ceil(SESSION_SECONDS - elapsedRef.current)),
        kills: killsRef.current,
      });

      if (elapsedRef.current >= SESSION_SECONDS) {
        endRun(true);
      }
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
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, ARENA_H);
        ctx.stroke();
      }
      for (let gy = 0; gy < ARENA_H; gy += 40) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(ARENA_W, gy);
        ctx.stroke();
      }

      for (const g of gemsRef.current) {
        ctx.fillStyle = "#3ee6e0";
        ctx.beginPath();
        ctx.arc(g.x, g.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const e of enemiesRef.current) {
        drawSprite(ctx, e.type, e.x, e.y, e.isBoss ? CELL * 1.8 : CELL);
        const barW = e.isBoss ? 60 : 20;
        ctx.fillStyle = "#000";
        ctx.fillRect(e.x - barW / 2, e.y - (e.isBoss ? 34 : 16), barW, 3);
        ctx.fillStyle = e.isBoss ? "#ffb703" : "#ff3ea5";
        ctx.fillRect(e.x - barW / 2, e.y - (e.isBoss ? 34 : 16), barW * (e.hp / e.maxHp), 3);
      }

      for (const proj of projectilesRef.current) {
        ctx.fillStyle = accentColor || "#3ee6e0";
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 2.5, 0, Math.PI * 2);
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
      if (!blinking) drawSprite(ctx, "player", p.x, p.y, CELL);

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
  }, [phase, accentColor]);

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
          Bloodmoon Siege is built for laptop and desktop play. Please switch to a larger screen to enter the siege.
        </p>
      </div>
    );
  }

  if (phase === "menu") {
    return (
      <div className="text-center max-w-sm mx-auto">
        <p className="text-3xl mb-4">🌒</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">BLOODMOON SIEGE</p>
        <p className="text-textDim text-sm mb-6">
          Survive {Math.round(SESSION_SECONDS / 60)} minutes against an endless horde. You attack automatically —
          just move to dodge, collect XP gems, and pick an upgrade every level. Two Reaper bosses rise as the moon
          climbs.
        </p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          ENTER THE SIEGE
        </button>
      </div>
    );
  }

  if (phase === "over") {
    return (
      <div className="text-center">
        <p className="text-3xl mb-3">{outcome === "victory" ? "🌕" : "💀"}</p>
        <p className="font-pixel text-sm mb-2" style={{ color: outcome === "victory" ? "#ffb703" : "#ff3ea5" }}>
          {outcome === "victory" ? "DAWN BREAKS — YOU SURVIVED" : "OVERRUN"}
        </p>
        <p className="font-mono text-xs text-textDim">Level {hud.level} · {hud.kills} kills</p>
      </div>
    );
  }

  return (
    <div className="text-center relative">
      <div className="flex justify-between font-mono text-[11px] mb-2 text-textDim max-w-[480px] mx-auto">
        <span>Lv.{hud.level} · {hud.kills} kills</span>
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

      <div className="relative mx-auto rounded-lg overflow-hidden border border-lineColor" style={{ width: ARENA_W, maxWidth: "94vw" }}>
        <canvas ref={canvasRef} width={ARENA_W} height={ARENA_H} style={{ width: "100%", height: "auto", display: "block" }} />

        {phase === "levelup" && (
          <div className="absolute inset-0 bg-bgDeep/90 flex flex-col items-center justify-center p-4">
            <p className="font-pixel text-xs text-accentAmber mb-4 ap-blink">LEVEL UP — CHOOSE ONE</p>
            <div className="space-y-2 w-full max-w-xs">
              {upgradeChoices.map((u) => (
                <button
                  key={u.id}
                  onClick={() => chooseUpgrade(u)}
                  className="w-full text-left rounded-md border p-3 hover:bg-bgPanel3"
                  style={{ borderColor: accentColor }}
                >
                  <p className="font-mono text-xs text-textLight">{u.name}</p>
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
      <p className="font-mono text-[10px] text-textDim mt-3 hidden sm:block">Move with WASD or the arrow keys — attacks are automatic.</p>
    </div>
  );
}
