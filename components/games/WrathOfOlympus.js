"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { speak } from "@/lib/voice";
import { haptics } from "@/lib/haptics";

const MAP_W = 900;
const MAP_H = 600;
const TEMPLE = { x: MAP_W / 2, y: MAP_H / 2, r: 55, maxHp: 1000 };
const TOTAL_WAVES = 10;
const TICK_MS = 50;

// Divine powers — a small, genuinely different set rather than a
// full pantheon system. Each has its own real effect, not a
// reskinned damage number: Zeus hits hard in a small radius,
// Poseidon knocks enemies back and slows them, Ares buffs the
// player's own champions instead of hitting enemies directly.
const POWERS = {
  zeus: {
    name: "Zeus's Bolt", icon: "⚡", cooldownMs: 6000, faithCost: 25,
    color: "#ffd23f", radius: 55, damage: 140,
  },
  poseidon: {
    name: "Poseidon's Wave", icon: "🌊", cooldownMs: 9000, faithCost: 35,
    color: "#3ea8ff", radius: 90, damage: 45, knockback: 60, slowMs: 2500,
  },
  ares: {
    name: "Ares's Fury", icon: "🔥", cooldownMs: 14000, faithCost: 45,
    color: "#ff5a3c", durationMs: 6000, damageMult: 1.8, speedMult: 1.3,
  },
};

// Three real enemy archetypes, not one reskinned mob at different
// HP values — each moves and threatens differently.
const ENEMY_TYPES = {
  harpy: { name: "Harpy", hp: 40, speed: 1.6, damage: 8, radius: 8, color: "#b45cff", faithReward: 8 },
  cyclops: { name: "Cyclops", hp: 160, speed: 0.75, damage: 22, radius: 13, color: "#8a6a3c", faithReward: 20 },
  minotaur: { name: "Minotaur", hp: 320, speed: 1.0, damage: 35, radius: 15, color: "#8a1f2b", faithReward: 40 },
};

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export default function WrathOfOlympus({ onFinish, accentColor }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [phase, setPhase] = useState("menu"); // menu | playing | over
  const [outcome, setOutcome] = useState(null); // "victory" | "defeat"
  const [hud, setHud] = useState({ templeHp: TEMPLE.maxHp, faith: 50, wave: 0, enemiesLeft: 0, powerCooldowns: {} });
  const [notice, setNotice] = useState("");
  const [selectedPower, setSelectedPower] = useState(null);
  const selectedPowerRef = useRef(null);

  const templeHpRef = useRef(TEMPLE.maxHp);
  const faithRef = useRef(50);
  const waveRef = useRef(0);
  const enemiesRef = useRef([]);
  const championsRef = useRef([]);
  const projectilesRef = useRef([]);
  const particlesRef = useRef([]);
  const floatTextRef = useRef([]);
  const powerCooldownsRef = useRef({ zeus: 0, poseidon: 0, ares: 0 });
  const furyUntilRef = useRef(0);
  const waveStateRef = useRef("idle"); // idle | spawning | active | cleared
  const nextSpawnAtRef = useRef(0);
  const spawnedThisWaveRef = useRef(0);
  const waveTargetCountRef = useRef(0);
  const finishedRef = useRef(false);
  const simIntervalRef = useRef(null);
  const frameRef = useRef(null);
  const scoreDataRef = useRef({ totalKills: 0, wavesCleared: 0 });

  function spawnChampions() {
    championsRef.current = [0, 1, 2].map((i) => ({
      id: i,
      x: TEMPLE.x + Math.cos((i / 3) * Math.PI * 2) * 75,
      y: TEMPLE.y + Math.sin((i / 3) * Math.PI * 2) * 75,
      hp: 120,
      maxHp: 120,
      target: null,
      lastAttackAt: 0,
    }));
  }

  function resetGame() {
    templeHpRef.current = TEMPLE.maxHp;
    faithRef.current = 50;
    waveRef.current = 0;
    enemiesRef.current = [];
    projectilesRef.current = [];
    particlesRef.current = [];
    floatTextRef.current = [];
    powerCooldownsRef.current = { zeus: 0, poseidon: 0, ares: 0 };
    furyUntilRef.current = 0;
    waveStateRef.current = "idle";
    nextSpawnAtRef.current = Date.now() + 3000;
    spawnedThisWaveRef.current = 0;
    waveTargetCountRef.current = 0;
    finishedRef.current = false;
    scoreDataRef.current = { totalKills: 0, wavesCleared: 0 };
    spawnChampions();
  }

  function spawnParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.5;
      particlesRef.current.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color });
    }
  }
  function spawnFloatText(x, y, text, color) {
    floatTextRef.current.push({ x, y, text, color, life: 1 });
  }

  function startNextWave() {
    waveRef.current += 1;
    waveStateRef.current = "spawning";
    // A real composition curve, not just "more enemies": early waves
    // are almost all Harpies (fast, weak, teach the player to react),
    // Cyclopes phase in from wave 3, Minotaurs — the real threat —
    // only start appearing from wave 6 onward.
    const w = waveRef.current;
    const count = 4 + Math.floor(w * 1.8);
    waveTargetCountRef.current = count;
    spawnedThisWaveRef.current = 0;
    nextSpawnAtRef.current = Date.now() + 400;
    setNotice(`Wave ${w} — ${count} beasts incoming`);
    setTimeout(() => setNotice(""), 2200);
    speak(`Wave ${w}`, { priority: "high" });
  }

  function pickEnemyTypeForWave(w) {
    const roll = Math.random();
    if (w >= 6 && roll < 0.18) return "minotaur";
    if (w >= 3 && roll < 0.45) return "cyclops";
    return "harpy";
  }

  function spawnOneEnemy() {
    const edge = Math.floor(Math.random() * 4);
    const pad = 20;
    const spawn =
      edge === 0 ? { x: -pad, y: Math.random() * MAP_H } :
      edge === 1 ? { x: MAP_W + pad, y: Math.random() * MAP_H } :
      edge === 2 ? { x: Math.random() * MAP_W, y: -pad } :
      { x: Math.random() * MAP_W, y: MAP_H + pad };
    const typeId = pickEnemyTypeForWave(waveRef.current);
    const def = ENEMY_TYPES[typeId];
    const hpMult = 1 + (waveRef.current - 1) * 0.12;
    enemiesRef.current.push({
      id: Math.random(), typeId, x: spawn.x, y: spawn.y,
      hp: Math.round(def.hp * hpMult), maxHp: Math.round(def.hp * hpMult),
      slowUntil: 0, alive: true,
    });
  }

  function endGame(won) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(simIntervalRef.current);
    setOutcome(won ? "victory" : "defeat");
    setPhase("over");
    sfx.newBest();
    const { totalKills, wavesCleared } = scoreDataRef.current;
    const score = Math.round(totalKills * 15 + wavesCleared * 200 + Math.max(0, templeHpRef.current) * 2);
    fetch("/api/difficulty-scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game: "wrathofolympus", difficulty: "veteran", score }),
    }).catch(() => {});
    setTimeout(() => onFinish(Math.max(0, score)), 3500);
  }

  function startGame() {
    resetGame();
    setOutcome(null);
    setPhase("playing");
    // Matches the same fullscreen pattern the other two flagship
    // games use — started here specifically because startGame() only
    // ever runs inside a real click handler, which is the only
    // context browsers allow a fullscreen request from.
    const el = wrapRef.current?.ownerDocument?.documentElement;
    if (el?.requestFullscreen) el.requestFullscreen().catch(() => {});

    simIntervalRef.current = setInterval(() => {
      const now = Date.now();

      // Wave spawning
      if (waveStateRef.current === "spawning") {
        if (spawnedThisWaveRef.current < waveTargetCountRef.current && now > nextSpawnAtRef.current) {
          spawnOneEnemy();
          spawnedThisWaveRef.current += 1;
          nextSpawnAtRef.current = now + 550;
        }
        if (spawnedThisWaveRef.current >= waveTargetCountRef.current) {
          waveStateRef.current = "active";
        }
      }

      const furyActive = now < furyUntilRef.current;

      // Enemy movement + temple damage
      enemiesRef.current = enemiesRef.current.filter((en) => {
        if (!en.alive) return false;
        const slowed = now < en.slowUntil;
        const def = ENEMY_TYPES[en.typeId];
        const speed = def.speed * (slowed ? 0.4 : 1);
        const d = dist(en.x, en.y, TEMPLE.x, TEMPLE.y);
        if (d < TEMPLE.r + 8) {
          templeHpRef.current = Math.max(0, templeHpRef.current - def.damage);
          spawnParticles(en.x, en.y, "#ff3ea5", 10);
          sfx.hit();
          return false;
        }
        // Champions intercept before reaching the temple — a Champion
        // within its own engage range redirects the enemy's movement
        // toward itself instead of straight at the temple.
        let target = { x: TEMPLE.x, y: TEMPLE.y };
        let nearestChamp = null, nearestChampD = Infinity;
        for (const c of championsRef.current) {
          if (c.hp <= 0) continue;
          const cd = dist(en.x, en.y, c.x, c.y);
          if (cd < 70 && cd < nearestChampD) { nearestChampD = cd; nearestChamp = c; }
        }
        if (nearestChamp) target = nearestChamp;
        const ang = Math.atan2(target.y - en.y, target.x - en.x);
        en.x += Math.cos(ang) * speed;
        en.y += Math.sin(ang) * speed;
        return true;
      });

      // Champion auto-combat
      for (const c of championsRef.current) {
        if (c.hp <= 0) continue;
        let target = null, bestD = 85;
        for (const en of enemiesRef.current) {
          const d = dist(c.x, c.y, en.x, en.y);
          if (d < bestD) { bestD = d; target = en; }
        }
        if (target) {
          const atkRate = furyActive ? 420 : 700;
          if (now - c.lastAttackAt > atkRate) {
            c.lastAttackAt = now;
            const dmg = Math.round(18 * (furyActive ? 1.8 : 1));
            target.hp -= dmg;
            projectilesRef.current.push({ x: c.x, y: c.y, tx: target.x, ty: target.y, life: 1, color: furyActive ? "#ff5a3c" : "#ffe14d" });
            if (target.hp <= 0 && target.alive) {
              target.alive = false;
              const def = ENEMY_TYPES[target.typeId];
              faithRef.current = Math.min(200, faithRef.current + def.faithReward);
              scoreDataRef.current.totalKills += 1;
              spawnParticles(target.x, target.y, def.color, 12);
              spawnFloatText(target.x, target.y - 14, `+${def.faithReward} faith`, "#ffd23f");
            }
          }
        } else {
          // drift back toward guard position near the temple when nothing's nearby
          const homeAng = Math.atan2(TEMPLE.y - c.y, TEMPLE.x - c.x);
          const homeD = dist(c.x, c.y, TEMPLE.x, TEMPLE.y);
          if (homeD > 80) { c.x += Math.cos(homeAng) * 0.6; c.y += Math.sin(homeAng) * 0.6; }
        }
      }
      enemiesRef.current = enemiesRef.current.filter((en) => en.alive !== false || en.hp > 0);

      // Wave clear check
      if (waveStateRef.current === "active" && enemiesRef.current.length === 0) {
        waveStateRef.current = "cleared";
        scoreDataRef.current.wavesCleared = waveRef.current;
        faithRef.current = Math.min(200, faithRef.current + 20);
        if (waveRef.current >= TOTAL_WAVES) {
          setTimeout(() => endGame(true), 800);
        } else {
          setNotice(`Wave ${waveRef.current} cleared!`);
          setTimeout(() => setNotice(""), 1800);
          setTimeout(() => startNextWave(), 3500);
        }
      }

      // Effects decay
      particlesRef.current = particlesRef.current.filter((pt) => { pt.x += pt.vx; pt.y += pt.vy; pt.life -= 0.04; return pt.life > 0; });
      projectilesRef.current = projectilesRef.current.filter((p) => { p.life -= 0.15; return p.life > 0; });
      floatTextRef.current = floatTextRef.current.filter((ft) => { ft.y -= 0.4; ft.life -= 0.02; return ft.life > 0; });

      if (templeHpRef.current <= 0) {
        endGame(false);
        return;
      }

      setHud({
        templeHp: Math.round(templeHpRef.current),
        faith: Math.round(faithRef.current),
        wave: waveRef.current,
        enemiesLeft: enemiesRef.current.length,
        powerCooldowns: {
          zeus: Math.max(0, powerCooldownsRef.current.zeus - now),
          poseidon: Math.max(0, powerCooldownsRef.current.poseidon - now),
          ares: Math.max(0, powerCooldownsRef.current.ares - now),
        },
      });
    }, TICK_MS);

    setTimeout(() => startNextWave(), 1500);
  }

  function castPower(powerId, x, y) {
    const now = Date.now();
    const power = POWERS[powerId];
    if (powerCooldownsRef.current[powerId] > now) return;
    if (faithRef.current < power.faithCost) {
      setNotice("Not enough faith");
      setTimeout(() => setNotice(""), 1200);
      return;
    }
    faithRef.current -= power.faithCost;
    powerCooldownsRef.current[powerId] = now + power.cooldownMs;

    if (powerId === "zeus") {
      spawnParticles(x, y, power.color, 24);
      sfx.newBest();
      for (const en of enemiesRef.current) {
        if (dist(en.x, en.y, x, y) < power.radius) {
          en.hp -= power.damage;
          if (en.hp <= 0 && en.alive) {
            en.alive = false;
            const def = ENEMY_TYPES[en.typeId];
            faithRef.current = Math.min(200, faithRef.current + def.faithReward);
            scoreDataRef.current.totalKills += 1;
          }
        }
      }
      spawnFloatText(x, y - 20, "ZEUS'S BOLT", power.color);
    } else if (powerId === "poseidon") {
      spawnParticles(x, y, power.color, 20);
      sfx.correct();
      for (const en of enemiesRef.current) {
        const d = dist(en.x, en.y, x, y);
        if (d < power.radius) {
          en.hp -= power.damage;
          en.slowUntil = now + power.slowMs;
          const ang = Math.atan2(en.y - y, en.x - x);
          en.x += Math.cos(ang) * power.knockback;
          en.y += Math.sin(ang) * power.knockback;
          if (en.hp <= 0 && en.alive) {
            en.alive = false;
            const def = ENEMY_TYPES[en.typeId];
            faithRef.current = Math.min(200, faithRef.current + def.faithReward);
            scoreDataRef.current.totalKills += 1;
          }
        }
      }
      spawnFloatText(x, y - 20, "POSEIDON'S WAVE", power.color);
    } else if (powerId === "ares") {
      furyUntilRef.current = now + power.durationMs;
      spawnParticles(TEMPLE.x, TEMPLE.y, power.color, 20);
      sfx.levelUp();
      speak("Ares grants his fury!", { priority: "high" });
      spawnFloatText(TEMPLE.x, TEMPLE.y - 70, "ARES'S FURY", power.color);
    }
    haptics.select();
  }

  function handleCanvasClick(e) {
    if (phase !== "playing") return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = MAP_W / rect.width;
    const scaleY = MAP_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    if (selectedPowerRef.current) {
      castPower(selectedPowerRef.current, x, y);
      selectedPowerRef.current = null;
      setSelectedPower(null);
    }
  }

  function handlePowerButtonClick(powerId) {
    if (phase !== "playing") return;
    if (Date.now() < powerCooldownsRef.current[powerId]) return;
    // Ares buffs the player's own champions everywhere on the map —
    // there's no location to target, so it casts immediately rather
    // than entering the same click-to-target flow Zeus and Poseidon
    // use.
    if (powerId === "ares") {
      castPower("ares", TEMPLE.x, TEMPLE.y);
      return;
    }
    const next = selectedPowerRef.current === powerId ? null : powerId;
    selectedPowerRef.current = next;
    setSelectedPower(next);
  }

  useEffect(() => {
    if (phase !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    function render() {
      ctx.fillStyle = "#12092b";
      ctx.fillRect(0, 0, MAP_W, MAP_H);
      ctx.strokeStyle = "rgba(169,159,214,0.08)";
      for (let gx = 0; gx < MAP_W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, MAP_H); ctx.stroke(); }
      for (let gy = 0; gy < MAP_H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(MAP_W, gy); ctx.stroke(); }

      // Temple
      const templePct = Math.max(0, templeHpRef.current / TEMPLE.maxHp);
      ctx.fillStyle = "#2a1560";
      ctx.beginPath();
      ctx.arc(TEMPLE.x, TEMPLE.y, TEMPLE.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = templePct > 0.5 ? "#ffd23f" : templePct > 0.25 ? "#ffb703" : "#ff3ea5";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(TEMPLE.x, TEMPLE.y, TEMPLE.r, -Math.PI / 2, -Math.PI / 2 + templePct * Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "#f5f0ff";
      ctx.font = "22px monospace";
      ctx.textAlign = "center";
      ctx.fillText("⛩️", TEMPLE.x, TEMPLE.y + 8);

      // Champions
      for (const c of championsRef.current) {
        if (c.hp <= 0) continue;
        ctx.fillStyle = Date.now() < furyUntilRef.current ? "#ff5a3c" : "#3ee6e0";
        ctx.beginPath();
        ctx.arc(c.x, c.y, 9, 0, Math.PI * 2);
        ctx.fill();
      }

      // Enemies
      for (const en of enemiesRef.current) {
        const def = ENEMY_TYPES[en.typeId];
        ctx.fillStyle = Date.now() < en.slowUntil ? "#3ea8ff" : def.color;
        ctx.beginPath();
        ctx.arc(en.x, en.y, def.radius, 0, Math.PI * 2);
        ctx.fill();
        const barW = def.radius * 2.4;
        ctx.fillStyle = "#000";
        ctx.fillRect(en.x - barW / 2, en.y - def.radius - 8, barW, 3);
        ctx.fillStyle = "#ff3ea5";
        ctx.fillRect(en.x - barW / 2, en.y - def.radius - 8, barW * Math.max(0, en.hp / en.maxHp), 3);
      }

      // Projectiles
      for (const p of projectilesRef.current) {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.tx, p.ty);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Particles
      for (const pt of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, pt.life);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4);
        ctx.globalAlpha = 1;
      }

      // Float text
      for (const ft of floatTextRef.current) {
        ctx.globalAlpha = Math.max(0, ft.life);
        ctx.fillStyle = ft.color;
        ctx.font = "11px monospace";
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
    return () => {
      clearInterval(simIntervalRef.current);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  if (phase === "menu") {
    return (
      <div className="text-center max-w-md mx-auto">
        <p className="text-4xl mb-3">⚡</p>
        <p className="font-pixel text-sm mb-3" style={{ color: accentColor || "#ffd23f" }}>WRATH OF OLYMPUS</p>
        <p className="text-textDim text-sm mb-6">
          Your Champions fight on their own — your job is choosing where and when to strike with divine power.
          Defend the temple through {TOTAL_WAVES} escalating waves of mythological beasts.
        </p>
        <div className="text-left text-textDim text-xs mb-6 space-y-1.5 font-mono">
          <p>⚡ <span className="text-textLight">Zeus's Bolt</span> — heavy damage in a small radius</p>
          <p>🌊 <span className="text-textLight">Poseidon's Wave</span> — knocks back and slows a wide area</p>
          <p>🔥 <span className="text-textLight">Ares's Fury</span> — buffs your Champions' damage and speed</p>
        </div>
        <button
          onClick={startGame}
          className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep"
          style={{ background: accentColor || "#ffd23f" }}
        >
          BEGIN THE DEFENSE ▸
        </button>
      </div>
    );
  }

  if (phase === "over") {
    return (
      <div className="text-center">
        <p className="text-4xl mb-3">{outcome === "victory" ? "🏆" : "💀"}</p>
        <p className="font-pixel text-sm mb-2" style={{ color: outcome === "victory" ? "#ffd23f" : "#ff3ea5" }}>
          {outcome === "victory" ? "OLYMPUS TRIUMPHANT" : "THE TEMPLE HAS FALLEN"}
        </p>
        <p className="font-mono text-xs text-textDim">
          Wave {scoreDataRef.current.wavesCleared} of {TOTAL_WAVES} · {scoreDataRef.current.totalKills} beasts slain
        </p>
      </div>
    );
  }

  return (
    <div className="text-center relative" ref={wrapRef}>
      <div className="flex justify-between font-mono text-[11px] mb-2 text-textDim max-w-[900px] mx-auto flex-wrap gap-1">
        <span>⛩️ Temple: {hud.templeHp}/{TEMPLE.maxHp}</span>
        <span>✨ Faith: {hud.faith}</span>
        <span>🌊 Wave {hud.wave}/{TOTAL_WAVES} · {hud.enemiesLeft} remaining</span>
      </div>

      <div
        className="relative mx-auto rounded-lg overflow-hidden border border-lineColor cursor-crosshair"
        style={{ width: MAP_W, maxWidth: "94vw" }}
      >
        <canvas
          ref={canvasRef}
          width={MAP_W}
          height={MAP_H}
          style={{ width: "100%", height: "auto", display: "block" }}
          onClick={handleCanvasClick}
        />
        {notice && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-bgDeep/90 px-3 py-1.5 rounded-md">
            <p className="font-mono text-[10px] text-accentAmber">{notice}</p>
          </div>
        )}
        {selectedPower && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-bgDeep/90 px-3 py-1.5 rounded-md">
            <p className="font-mono text-[10px] text-accentCyan">Click the battlefield to cast {POWERS[selectedPower].name}</p>
          </div>
        )}
      </div>

      <div className="flex justify-center gap-2 mt-3 max-w-[900px] mx-auto">
        {Object.entries(POWERS).map(([id, power]) => {
          const cooldown = hud.powerCooldowns[id] || 0;
          const onCooldown = cooldown > 0;
          const affordable = hud.faith >= power.faithCost;
          const disabled = onCooldown || !affordable;
          return (
            <button
              key={id}
              onClick={() => handlePowerButtonClick(id)}
              disabled={disabled}
              className="font-mono text-[10px] px-4 py-2.5 rounded-md border disabled:opacity-40 flex flex-col items-center"
              style={{ borderColor: selectedPower === id ? power.color : "rgba(169,159,214,0.3)", color: power.color }}
            >
              <span>{power.icon} {power.name}</span>
              <span className="text-textDim text-[9px] mt-0.5">
                {onCooldown ? `${Math.ceil(cooldown / 1000)}s` : `${power.faithCost} faith`}
              </span>
            </button>
          );
        })}
      </div>
      <p className="font-mono text-[10px] text-textDim mt-3">Click a power, then click the battlefield to target it — Ares casts instantly.</p>
    </div>
  );
}
