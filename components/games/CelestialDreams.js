"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const VIEWPORT_W = 480;
const VIEWPORT_H = 320;
const WORLD_W = 2400;
const TICK_MS = 33;
const GRAVITY = 0.48;
const GLIDE_GRAVITY = 0.1;
const JUMP_VELOCITY = -9.5;
const MOVE_SPEED = 2.2;
const PLAYER_R = 9;
const FLIGHT_MAX = 100;
const FLIGHT_DRAIN_PER_TICK = 1.1;
const BLOOM_HOLD_MS = 1200;

const GROUND_SEGMENTS = [
  { x: 0, y: 260, w: 800 },
  { x: 800, y: 250, w: 800 },
  { x: 1600, y: 240, w: 800 },
];

const BIOMES = [
  { id: "dunes", name: "The Grey Dunes", xStart: 0, xEnd: 800, skyTop: [70, 50, 90], skyBottom: [150, 120, 95], groundColor: [130, 108, 74], creature: "bird" },
  { id: "vale", name: "The Drowned Vale", xStart: 800, xEnd: 1600, skyTop: [35, 55, 75], skyBottom: [95, 130, 118], groundColor: [50, 78, 62], hasWater: true, creature: "dragonfly" },
  { id: "peaks", name: "The Aurora Peaks", xStart: 1600, xEnd: 2400, skyTop: [8, 8, 26], skyBottom: [24, 18, 46], groundColor: [180, 190, 205], hasAurora: true, creature: "moth" },
];

function biomeAt(x) {
  return BIOMES.find((b) => x >= b.xStart && x < b.xEnd) || BIOMES[BIOMES.length - 1];
}

function makeBlooms() {
  const pts = [];
  let id = 0;
  for (const b of BIOMES) {
    const count = 4;
    for (let i = 0; i < count; i++) {
      pts.push({
        id: id++,
        x: b.xStart + 120 + (i * (b.xEnd - b.xStart - 240)) / (count - 1),
        y: 200 - (i % 2) * 40,
        activated: false,
      });
    }
  }
  return pts;
}

function makeSongStones() {
  const pts = [];
  let id = 0;
  for (const b of BIOMES) {
    for (let i = 0; i < 3; i++) {
      pts.push({ id: id++, x: b.xStart + 200 + i * ((b.xEnd - b.xStart - 400) / 2), y: 220 });
    }
  }
  return pts;
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export default function CelestialDreams({ onFinish, accentColor }) {
  const canvasRef = useRef(null);
  const [deviceOk, setDeviceOk] = useState(null);
  const [phase, setPhase] = useState("menu");
  const [hud, setHud] = useState({ restored: 0, totalBlooms: 12, flight: FLIGHT_MAX, biomeName: "" });
  const [outcome, setOutcome] = useState(null);
  const [biomeFlash, setBiomeFlash] = useState("");
  const [activatePrompt, setActivatePrompt] = useState(false);

  const playerRef = useRef({ x: 60, y: 240, vx: 0, vy: 0, facing: 1, onGround: false, jumpsBuffered: 0 });
  const moveInputRef = useRef(0);
  const jumpHeldRef = useRef(false);
  const jumpQueuedRef = useRef(false);
  const activateHeldRef = useRef(false);
  const activatingBloomRef = useRef(null);
  const activateStartRef = useRef(0);
  const flightRef = useRef(FLIGHT_MAX);
  const cameraXRef = useRef(0);
  const bloomsRef = useRef([]);
  const stonesRef = useRef([]);
  const restoredCountRef = useRef(0);
  const currentBiomeIdRef = useRef("dunes");
  const ambientRef = useRef([]);
  const creaturesRef = useRef([]);
  const reedsRef = useRef([]);
  const particlesRef = useRef([]);
  const floatTextRef = useRef([]);
  const elapsedRef = useRef(0);
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
      const speed = 0.3 + Math.random() * 0.9;
      particlesRef.current.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 0.2, life: 1, color });
    }
  }
  function spawnFloatText(x, y, text, color) {
    floatTextRef.current.push({ x, y, text, color, life: 1 });
  }

  function groundYAt(x) {
    const seg = GROUND_SEGMENTS.find((s) => x >= s.x && x < s.x + s.w) || GROUND_SEGMENTS[GROUND_SEGMENTS.length - 1];
    return seg.y;
  }

  function resetRun() {
    playerRef.current = { x: 60, y: groundYAt(60) - PLAYER_R, vx: 0, vy: 0, facing: 1, onGround: true, jumpsBuffered: 0 };
    moveInputRef.current = 0;
    jumpHeldRef.current = false;
    jumpQueuedRef.current = false;
    activateHeldRef.current = false;
    activatingBloomRef.current = null;
    flightRef.current = FLIGHT_MAX;
    cameraXRef.current = 0;
    bloomsRef.current = makeBlooms();
    stonesRef.current = makeSongStones();
    restoredCountRef.current = 0;
    currentBiomeIdRef.current = "dunes";
    ambientRef.current = Array.from({ length: 60 }, () => ({
      x: Math.random() * WORLD_W, y: 30 + Math.random() * 240, phase: Math.random() * Math.PI * 2, speed: 0.2 + Math.random() * 0.4,
    }));
    creaturesRef.current = BIOMES.flatMap((b, bi) =>
      Array.from({ length: 2 }, (_, i) => ({ x: b.xStart + 150 + i * 300, y0: 100 + i * 30, phase: Math.random() * Math.PI * 2, biome: bi }))
    );
    reedsRef.current = Array.from({ length: 40 }, () => ({ x: Math.random() * WORLD_W, sway: Math.random() * Math.PI * 2 }));
    particlesRef.current = [];
    floatTextRef.current = [];
    elapsedRef.current = 0;
    finishedRef.current = false;
  }

  function endRun(won) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(simIntervalRef.current);
    setOutcome(won);
    setPhase("over");
    sfx.newBest();
    const score = restoredCountRef.current * 40 + (won ? 400 : 0);
    setTimeout(() => onFinish(Math.max(0, score)), 1800);
  }

  function begin() {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    resetRun();
    setOutcome(null);
    setPhase("walking");
    setBiomeFlash("THE GREY DUNES");
    setTimeout(() => setBiomeFlash(""), 2200);

    simIntervalRef.current = setInterval(() => {
      elapsedRef.current += TICK_MS / 1000;
      const p = playerRef.current;
      const now = Date.now();

      p.vx = moveInputRef.current * MOVE_SPEED;
      if (moveInputRef.current !== 0) p.facing = moveInputRef.current;
      p.x = Math.max(PLAYER_R, Math.min(WORLD_W - PLAYER_R, p.x + p.vx));

      if (jumpQueuedRef.current) {
        jumpQueuedRef.current = false;
        if (p.onGround) {
          p.vy = JUMP_VELOCITY;
          p.onGround = false;
          sfx.tap();
        }
      }

      const gliding = jumpHeldRef.current && p.vy > 0 && !p.onGround && flightRef.current > 0;
      if (gliding) {
        flightRef.current = Math.max(0, flightRef.current - FLIGHT_DRAIN_PER_TICK);
        p.vy += GLIDE_GRAVITY;
        spawnParticles(p.x - p.facing * 8, p.y, accentColor || "#ffe9b8", 1);
      } else {
        p.vy += GRAVITY;
      }
      p.y += p.vy;

      const groundY = groundYAt(p.x);
      if (p.y + PLAYER_R >= groundY) {
        p.y = groundY - PLAYER_R;
        p.vy = 0;
        p.onGround = true;
      } else {
        p.onGround = false;
      }

      cameraXRef.current = Math.max(0, Math.min(WORLD_W - VIEWPORT_W, p.x - VIEWPORT_W / 2));

      for (const s of stonesRef.current) {
        if (dist(p.x, p.y, s.x, s.y) < 26 && flightRef.current < FLIGHT_MAX) {
          flightRef.current = FLIGHT_MAX;
          spawnParticles(s.x, s.y, "#3ee6e0", 10);
        }
      }

      const nearBloom = bloomsRef.current.find((b) => !b.activated && dist(p.x, p.y, b.x, b.y) < 34);
      setActivatePrompt(!!nearBloom && activateHeldRef.current === false);
      if (nearBloom && activateHeldRef.current) {
        if (activatingBloomRef.current !== nearBloom.id) {
          activatingBloomRef.current = nearBloom.id;
          activateStartRef.current = now;
        }
        if (now - activateStartRef.current > BLOOM_HOLD_MS) {
          nearBloom.activated = true;
          restoredCountRef.current += 1;
          activatingBloomRef.current = null;
          spawnParticles(nearBloom.x, nearBloom.y, "#ffe9b8", 30);
          spawnFloatText(nearBloom.x, nearBloom.y - 20, "COLOR RETURNS", "#ffe9b8");
          sfx.levelUp();
          haptics.success();
        }
      } else {
        activatingBloomRef.current = null;
      }

      const currentBiome = biomeAt(p.x);
      if (currentBiome.id !== currentBiomeIdRef.current) {
        currentBiomeIdRef.current = currentBiome.id;
        setBiomeFlash(currentBiome.name.toUpperCase());
        setTimeout(() => setBiomeFlash(""), 2200);
        sfx.select();
      }

      for (const c of creaturesRef.current) c.phase += 0.02;
      for (const a of ambientRef.current) a.phase += a.speed * 0.02;
      for (const r of reedsRef.current) r.sway += 0.03;

      particlesRef.current = particlesRef.current.filter((pt) => { pt.x += pt.vx; pt.y += pt.vy; pt.life -= 0.025; return pt.life > 0; });
      floatTextRef.current = floatTextRef.current.filter((ft) => { ft.y -= 0.3; ft.life -= 0.012; return ft.life > 0; });

      setHud({
        restored: restoredCountRef.current,
        totalBlooms: bloomsRef.current.length,
        flight: Math.round(flightRef.current),
        biomeName: currentBiome.name,
      });

      if (p.x > WORLD_W - 60 && restoredCountRef.current >= bloomsRef.current.length) {
        endRun(true);
      } else if (p.x > WORLD_W - 40) {
        endRun(restoredCountRef.current >= bloomsRef.current.length * 0.6);
      }
    }, TICK_MS);
  }

  useEffect(() => () => clearInterval(simIntervalRef.current), []);

  useEffect(() => {
    if (phase !== "walking") return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");

    function render() {
      const camX = cameraXRef.current;
      const worldXCenter = camX + VIEWPORT_W / 2;
      const biome = biomeAt(worldXCenter);

      const restoredFrac = bloomsRef.current.length ? restoredCountRef.current / bloomsRef.current.length : 0;
      const grayAmount = Math.round((1 - restoredFrac) * 78);
      ctx.filter = `grayscale(${grayAmount}%) saturate(${100 + restoredFrac * 40}%)`;

      const sky = ctx.createLinearGradient(0, 0, 0, VIEWPORT_H);
      sky.addColorStop(0, `rgb(${biome.skyTop.join(",")})`);
      sky.addColorStop(1, `rgb(${biome.skyBottom.join(",")})`);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);

      if (biome.hasAurora) {
        for (let i = 0; i < 3; i++) {
          ctx.save();
          ctx.globalAlpha = 0.18;
          const grad = ctx.createLinearGradient(0, 20 + i * 15, VIEWPORT_W, 60 + i * 15);
          grad.addColorStop(0, "#3ee6e0");
          grad.addColorStop(0.5, "#b45cff");
          grad.addColorStop(1, "#ff3ea5");
          ctx.fillStyle = grad;
          ctx.beginPath();
          for (let x = 0; x <= VIEWPORT_W; x += 20) {
            const y = 40 + i * 20 + Math.sin(elapsedRef.current * 0.6 + x * 0.02 + i) * 12;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.lineTo(VIEWPORT_W, 0);
          ctx.lineTo(0, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      if (biome.id === "peaks") {
        ctx.fillStyle = "#e8e2d6";
        for (let i = 0; i < 30; i++) {
          const sx = (i * 71 - camX * 0.1) % VIEWPORT_W;
          const sy = (i * 47) % 140;
          ctx.fillRect(sx < 0 ? sx + VIEWPORT_W : sx, sy, 1.4, 1.4);
        }
      }

      ctx.fillStyle = "rgba(0,0,0,0.12)";
      for (let i = 0; i < 7; i++) {
        const wx = i * 280 - camX * 0.25;
        ctx.beginPath();
        ctx.ellipse(wx, 240, 110, 45, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const a of ambientRef.current) {
        const ax = a.x - camX;
        if (ax < -10 || ax > VIEWPORT_W + 10) continue;
        const ay = a.y + Math.sin(a.phase) * 10;
        ctx.globalAlpha = 0.4 + Math.sin(a.phase * 2) * 0.2;
        ctx.fillStyle = "#ffe9b8";
        ctx.beginPath();
        ctx.arc(ax, ay, 1.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      for (const seg of GROUND_SEGMENTS) {
        const segBiome = BIOMES.find((b) => seg.x >= b.xStart && seg.x < b.xEnd) || biome;
        ctx.fillStyle = `rgb(${segBiome.groundColor.join(",")})`;
        ctx.fillRect(seg.x - camX, seg.y, seg.w, VIEWPORT_H - seg.y + 40);
      }

      if (biome.hasWater) {
        const waterY = groundYAt(worldXCenter) + 6;
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = "#1a4a5c";
        ctx.fillRect(0, waterY, VIEWPORT_W, VIEWPORT_H - waterY);
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = 0.22;
        ctx.translate(0, waterY * 2);
        ctx.scale(1, -1);
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, VIEWPORT_W, waterY - 20);
        ctx.restore();

        ctx.strokeStyle = "rgba(200,230,255,0.2)";
        for (let i = 0; i < 4; i++) {
          const wy = waterY + 10 + ((elapsedRef.current * 10 + i * 30) % 60);
          ctx.beginPath();
          ctx.moveTo(0, wy);
          ctx.lineTo(VIEWPORT_W, wy);
          ctx.stroke();
        }
      }

      for (const r of reedsRef.current) {
        const rx = r.x - camX;
        if (rx < -10 || rx > VIEWPORT_W + 10) continue;
        const rBiome = biomeAt(r.x);
        if (rBiome.id === "peaks") continue;
        const gy = groundYAt(r.x);
        const sway = Math.sin(r.sway) * 4;
        ctx.strokeStyle = rBiome.id === "vale" ? "#2e6a4a" : "#8a7040";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(rx, gy);
        ctx.quadraticCurveTo(rx + sway, gy - 10, rx + sway * 1.5, gy - 20);
        ctx.stroke();
      }

      for (const c of creaturesRef.current) {
        const cx = c.x - camX;
        if (cx < -20 || cx > VIEWPORT_W + 20) continue;
        const cy = c.y0 + Math.sin(c.phase) * 14;
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = BIOMES[c.biome].id === "peaks" ? "#ffe9b8" : "#e8e2d6";
        ctx.beginPath();
        ctx.ellipse(cx, cy, 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      for (const s of stonesRef.current) {
        const sx = s.x - camX;
        if (sx < -20 || sx > VIEWPORT_W + 20) continue;
        const sy = groundYAt(s.x);
        ctx.save();
        ctx.shadowColor = "#3ee6e0";
        ctx.shadowBlur = 14;
        ctx.fillStyle = "#3ee6e0";
        ctx.fillRect(sx - 3, sy - 30, 6, 30);
        ctx.restore();
      }

      for (const b of bloomsRef.current) {
        const bx = b.x - camX;
        if (bx < -20 || bx > VIEWPORT_W + 20) continue;
        const by = b.y + Math.sin(elapsedRef.current * 2 + b.id) * 3;
        ctx.save();
        ctx.shadowColor = b.activated ? "#ffe9b8" : "#7a7a8a";
        ctx.shadowBlur = b.activated ? 20 : 8;
        ctx.fillStyle = b.activated ? "#ffe9b8" : "#7a7a8a";
        ctx.beginPath();
        ctx.arc(bx, by, 6, 0, Math.PI * 2);
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
      const gliding = jumpHeldRef.current && p.vy > 0 && !p.onGround && flightRef.current > 0;
      ctx.save();
      ctx.shadowColor = accentColor || "#ffe9b8";
      ctx.shadowBlur = 14;
      ctx.fillStyle = accentColor || "#ffe9b8";
      ctx.beginPath();
      ctx.arc(px, p.y, PLAYER_R, 0, Math.PI * 2);
      ctx.fill();
      if (gliding) {
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.moveTo(px - p.facing * 6, p.y);
        ctx.lineTo(px - p.facing * 22, p.y - 6);
        ctx.lineTo(px - p.facing * 22, p.y + 6);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.restore();

      for (const ft of floatTextRef.current) {
        ctx.globalAlpha = Math.max(0, ft.life);
        ctx.fillStyle = ft.color;
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(ft.text, ft.x - camX, ft.y);
        ctx.globalAlpha = 1;
      }

      ctx.filter = "none";
      frameRef.current = requestAnimationFrame(render);
    }
    render();
    return () => cancelAnimationFrame(frameRef.current);
  }, [phase, accentColor]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "s", "a", "d", " ", "e"].includes(e.key)) e.preventDefault();
      if (e.key === "ArrowLeft" || e.key === "a") moveInputRef.current = -1;
      if (e.key === "ArrowRight" || e.key === "d") moveInputRef.current = 1;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === " ") {
        jumpQueuedRef.current = true;
        jumpHeldRef.current = true;
      }
      if (e.key === "e") activateHeldRef.current = true;
    }
    function handleKeyUp(e) {
      if ((e.key === "ArrowLeft" || e.key === "a") && moveInputRef.current === -1) moveInputRef.current = 0;
      if ((e.key === "ArrowRight" || e.key === "d") && moveInputRef.current === 1) moveInputRef.current = 0;
      if (e.key === "ArrowUp" || e.key === "w" || e.key === " ") jumpHeldRef.current = false;
      if (e.key === "e") activateHeldRef.current = false;
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  function setMove(v) { moveInputRef.current = v; }
  function pressJump(down) { if (down) jumpQueuedRef.current = true; jumpHeldRef.current = down; }
  function pressActivate(down) { activateHeldRef.current = down; }

  if (deviceOk === null) return null;

  if (!deviceOk) {
    return (
      <div className="text-center py-10">
        <p className="text-3xl mb-4">💻</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">LAPTOP OR DESKTOP REQUIRED</p>
        <p className="text-textDim text-sm max-w-xs mx-auto">Celestial Dreams is built for laptop and desktop play. Please switch to a larger screen.</p>
      </div>
    );
  }

  if (phase === "menu") {
    return (
      <div className="text-center max-w-sm mx-auto">
        <p className="text-3xl mb-4">🌅</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">CELESTIAL DREAMS</p>
        <p className="text-textDim text-sm mb-6">
          A/D or arrow keys to walk, hold Jump while falling to glide on a limited flight meter, E to restore an
          Ancient Bloom you stand near. There is no combat, no health, no threat — just three fading lands to walk
          through and return to color. Glowing pillars refill your flight.
        </p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          BEGIN THE JOURNEY
        </button>
      </div>
    );
  }

  if (phase === "over") {
    return (
      <div className="text-center">
        <p className="text-3xl mb-3">{outcome ? "🌟" : "🌫️"}</p>
        <p className="font-pixel text-sm mb-2" style={{ color: "#ffe9b8" }}>
          {outcome ? "THE WORLD REMEMBERS ITS COLOR" : "THE JOURNEY ENDS, UNFINISHED"}
        </p>
        <p className="font-mono text-xs text-textDim">{hud.restored}/{hud.totalBlooms} Ancient Blooms restored</p>
      </div>
    );
  }

  return (
    <div className="text-center relative">
      {biomeFlash && (
        <div className="absolute inset-x-0 -top-2 z-20 flex items-center justify-center pointer-events-none">
          <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/90 px-4 py-2 rounded-lg">{biomeFlash}</p>
        </div>
      )}
      {activatePrompt && (
        <div className="absolute inset-x-0 top-8 z-20 flex items-center justify-center pointer-events-none">
          <p className="font-mono text-[10px] text-textLight bg-bgDeep/80 px-3 py-1 rounded-md">Hold E to restore</p>
        </div>
      )}
      <div className="flex justify-between font-mono text-[11px] mb-2 text-textDim max-w-[480px] mx-auto">
        <span>{hud.biomeName}</span>
        <span>🌸 {hud.restored}/{hud.totalBlooms}</span>
      </div>
      <div className="max-w-[480px] mx-auto mb-1">
        <div className="h-1.5 rounded-full bg-bgDeep border border-lineColor overflow-hidden">
          <div className="h-full bg-accentCyan" style={{ width: `${hud.flight}%` }} />
        </div>
        <p className="font-mono text-[9px] text-textDim mt-0.5">Flight</p>
      </div>

      <div className="relative mx-auto rounded-lg overflow-hidden border border-lineColor" style={{ width: VIEWPORT_W, maxWidth: "94vw" }}>
        <canvas ref={canvasRef} width={VIEWPORT_W} height={VIEWPORT_H} style={{ width: "100%", height: "auto", display: "block" }} />
      </div>

      <div className="flex justify-center gap-2 mt-4">
        <button onMouseDown={() => setMove(-1)} onMouseUp={() => setMove(0)} onMouseLeave={() => setMove(0)} className="px-5 py-3 rounded-md border border-lineColor font-pixel text-xs select-none">◀</button>
        <button onMouseDown={() => setMove(1)} onMouseUp={() => setMove(0)} onMouseLeave={() => setMove(0)} className="px-5 py-3 rounded-md border border-lineColor font-pixel text-xs select-none">▶</button>
        <button onMouseDown={() => pressJump(true)} onMouseUp={() => pressJump(false)} onMouseLeave={() => pressJump(false)} className="px-5 py-3 rounded-md font-pixel text-[10px] text-bgDeep" style={{ background: accentColor }}>GLIDE</button>
        <button onMouseDown={() => pressActivate(true)} onMouseUp={() => pressActivate(false)} onMouseLeave={() => pressActivate(false)} className="px-5 py-3 rounded-md font-pixel text-[10px] text-bgDeep" style={{ background: "#ffe9b8" }}>RESTORE</button>
      </div>
      <p className="font-mono text-[10px] text-textDim mt-3">A/D or arrows to walk, hold Jump while falling to glide, E to restore a Bloom.</p>
    </div>
  );
}
