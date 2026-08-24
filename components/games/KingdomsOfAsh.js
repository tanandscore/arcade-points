"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const MAP_W = 640;
const MAP_H = 420;
const TICK_MS = 60;
const SESSION_SECONDS = 300;

const WATER = { x: 480, y: 0, w: 160, h: MAP_H };
const FORESTS = [
  { x: 60, y: 60, r: 60 },
  { x: 110, y: 320, r: 55 },
  { x: 360, y: 55, r: 45 },
];

const BUILDING_TYPES = {
  house: { name: "House", icon: "🏠", cost: { wood: 30 }, w: 26, h: 26, color: "#e8d9c0", capacity: 3 },
  farm: { name: "Farm", icon: "🌾", cost: { wood: 20 }, w: 36, h: 24, color: "#6bff6b", produces: "food", jobSlots: 2, rate: 0.4 },
  lumberCamp: { name: "Lumber Camp", icon: "🪓", cost: { wood: 15 }, w: 28, h: 28, color: "#8a6a3c", produces: "wood", jobSlots: 2, rate: 0.45, needsForest: true },
  quarry: { name: "Stone Quarry", icon: "⛏️", cost: { wood: 35 }, w: 30, h: 30, color: "#9aa0a6", produces: "stone", jobSlots: 2, rate: 0.3 },
  blacksmith: { name: "Blacksmith", icon: "🔨", cost: { wood: 30, stone: 20 }, w: 26, h: 26, color: "#ff5a3c", produces: "gold", jobSlots: 1, rate: 0.2 },
  watchTower: { name: "Watch Tower", icon: "🗼", cost: { wood: 40, stone: 25 }, w: 20, h: 40, color: "#3ee6e0", defense: true, range: 90, damage: 12 },
  market: { name: "Market", icon: "⛺", cost: { wood: 40, stone: 15 }, w: 32, h: 24, color: "#b45cff", produces: "gold", jobSlots: 1, rate: 0.25 },
};

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export default function KingdomsOfAsh({ onFinish, accentColor }) {
  const canvasRef = useRef(null);
  const [deviceOk, setDeviceOk] = useState(null);
  const [phase, setPhase] = useState("menu");
  const [selectedType, setSelectedType] = useState(null);
  const [hud, setHud] = useState({ wood: 60, stone: 20, food: 30, gold: 10, population: 3, timeLeft: SESSION_SECONDS });
  const [outcome, setOutcome] = useState(null);
  const [notice, setNotice] = useState("");

  const resourcesRef = useRef({ wood: 60, stone: 20, food: 30, gold: 10 });
  const buildingsRef = useRef([]);
  const villagersRef = useRef([]);
  const banditsRef = useRef([]);
  const projectilesRef = useRef([]);
  const particlesRef = useRef([]);
  const floatTextRef = useRef([]);
  const rainDropsRef = useRef([]);
  const rainingRef = useRef(false);
  const nextRainAtRef = useRef(0);
  const nextBanditAtRef = useRef(0);
  const elapsedRef = useRef(0);
  const townCenterRef = useRef({ x: 260, y: 200 });
  const selectedTypeRef = useRef(null);
  const finishedRef = useRef(false);

  const simIntervalRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    const isTouchPrimary = window.matchMedia("(pointer: coarse)").matches;
    const isSmall = window.innerWidth < 1024;
    setDeviceOk(!isTouchPrimary && !isSmall);
  }, []);

  useEffect(() => {
    selectedTypeRef.current = selectedType;
  }, [selectedType]);

  function spawnParticles(x, y, color, count = 6) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.3 + Math.random() * 0.8;
      particlesRef.current.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 0.3, life: 1, color });
    }
  }
  function spawnFloatText(x, y, text, color) {
    floatTextRef.current.push({ x, y, text, color, life: 1 });
  }

  function spawnVillager(homeX, homeY) {
    villagersRef.current.push({
      id: Math.random(),
      x: homeX + (Math.random() - 0.5) * 10,
      y: homeY + (Math.random() - 0.5) * 10,
      homeX, homeY,
      state: "idle",
      job: null,
      carrying: 0,
      workTimer: 0,
      bob: Math.random() * Math.PI * 2,
    });
  }

  function resetKingdom() {
    resourcesRef.current = { wood: 60, stone: 20, food: 30, gold: 10 };
    buildingsRef.current = [{ id: "tc", type: "townCenter", x: townCenterRef.current.x, y: townCenterRef.current.y, w: 42, h: 42 }];
    villagersRef.current = [];
    for (let i = 0; i < 3; i++) spawnVillager(townCenterRef.current.x, townCenterRef.current.y);
    banditsRef.current = [];
    projectilesRef.current = [];
    particlesRef.current = [];
    floatTextRef.current = [];
    rainDropsRef.current = Array.from({ length: 70 }, () => ({ x: Math.random() * MAP_W, y: Math.random() * MAP_H }));
    rainingRef.current = false;
    nextRainAtRef.current = Date.now() + 20000 + Math.random() * 20000;
    nextBanditAtRef.current = Date.now() + 45000 + Math.random() * 25000;
    elapsedRef.current = 0;
    finishedRef.current = false;
    setSelectedType(null);
  }

  function nearestForest(x, y) {
    let best = null, bestD = Infinity;
    for (const f of FORESTS) {
      const d = dist(x, y, f.x, f.y);
      if (d < bestD) { bestD = d; best = f; }
    }
    return best;
  }

  function canPlace(type, x, y) {
    const def = BUILDING_TYPES[type];
    if (x - def.w / 2 < 10 || x + def.w / 2 > WATER.x - 10 || y - def.h / 2 < 10 || y + def.h / 2 > MAP_H - 10) return false;
    for (const b of buildingsRef.current) {
      const d = dist(x, y, b.x, b.y);
      if (d < (def.w + (BUILDING_TYPES[b.type]?.w || 42)) / 2 + 6) return false;
    }
    if (def.needsForest) {
      const f = nearestForest(x, y);
      if (!f || dist(x, y, f.x, f.y) > f.r + 50) return false;
    }
    return true;
  }

  function handleCanvasClick(e) {
    if (phase !== "playing") return;
    const type = selectedTypeRef.current;
    if (!type) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = MAP_W / rect.width;
    const scaleY = MAP_H / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const def = BUILDING_TYPES[type];
    const res = resourcesRef.current;
    const affordable = Object.entries(def.cost).every(([k, v]) => res[k] >= v);
    if (!affordable) {
      setNotice("Not enough resources");
      setTimeout(() => setNotice(""), 1200);
      return;
    }
    if (!canPlace(type, x, y)) {
      setNotice(def.needsForest ? "Lumber camps must be near a forest" : "Can't build there");
      setTimeout(() => setNotice(""), 1400);
      return;
    }
    for (const [k, v] of Object.entries(def.cost)) res[k] -= v;
    buildingsRef.current.push({ id: Math.random(), type, x, y, w: def.w, h: def.h, jobsFilled: 0, cooldown: 0 });
    spawnParticles(x, y, "#e8d9c0", 10);
    sfx.correct();
    haptics.tap();
    setSelectedType(null);
  }

  function assignJobs() {
    for (const b of buildingsRef.current) {
      const def = BUILDING_TYPES[b.type];
      if (!def?.jobSlots) continue;
      if ((b.jobsFilled || 0) >= def.jobSlots) continue;
      const free = villagersRef.current.find((v) => v.state === "idle" && !v.job);
      if (free) {
        free.job = b.id;
        b.jobsFilled = (b.jobsFilled || 0) + 1;
      }
    }
  }

  function villagerTick(v) {
    v.bob += 0.15;
    const job = v.job ? buildingsRef.current.find((b) => b.id === v.job) : null;
    const def = job ? BUILDING_TYPES[job.type] : null;

    if (!job) {
      if (v.state !== "idle") v.state = "idle";
      const tc = townCenterRef.current;
      const d = dist(v.x, v.y, tc.x, tc.y);
      if (d > 40) {
        v.x += ((tc.x - v.x) / d) * 0.5;
        v.y += ((tc.y - v.y) / d) * 0.5;
      }
      return;
    }

    if (v.state === "idle") v.state = "toWork";

    if (v.state === "toWork") {
      let targetX = job.x, targetY = job.y;
      if (def.needsForest) {
        const f = nearestForest(job.x, job.y);
        targetX = f.x + (Math.random() - 0.5) * f.r * 0.6;
        targetY = f.y + (Math.random() - 0.5) * f.r * 0.6;
        v.forestSpot = { x: targetX, y: targetY };
      }
      const d = dist(v.x, v.y, targetX, targetY);
      if (d < 4) {
        v.state = "working";
        v.workTimer = 0;
      } else {
        v.x += ((targetX - v.x) / d) * 0.9;
        v.y += ((targetY - v.y) / d) * 0.9;
      }
    } else if (v.state === "working") {
      v.workTimer += TICK_MS;
      if (v.workTimer > 1600) {
        v.carrying = 1;
        v.state = "toDeposit";
      }
    } else if (v.state === "toDeposit") {
      const tc = townCenterRef.current;
      const d = dist(v.x, v.y, tc.x, tc.y);
      if (d < 14) {
        resourcesRef.current[def.produces] = (resourcesRef.current[def.produces] || 0) + def.rate * 20;
        spawnFloatText(tc.x, tc.y - 20, `+${Math.round(def.rate * 20)} ${def.produces}`, "#ffe14d");
        v.carrying = 0;
        v.state = "toWork";
      } else {
        v.x += ((tc.x - v.x) / d) * 0.9;
        v.y += ((tc.y - v.y) / d) * 0.9;
      }
    }
  }

  function tryGrowPopulation() {
    const res = resourcesRef.current;
    const houses = buildingsRef.current.filter((b) => b.type === "house");
    const capacity = 3 + houses.reduce((s) => s + BUILDING_TYPES.house.capacity, 0);
    if (villagersRef.current.length < capacity && res.food > villagersRef.current.length * 4) {
      res.food -= 8;
      const tc = townCenterRef.current;
      spawnVillager(tc.x, tc.y);
      spawnFloatText(tc.x, tc.y - 30, "New villager!", "#3ee6e0");
      sfx.levelUp();
    }
  }

  function endSession() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(simIntervalRef.current);
    setOutcome(true);
    setPhase("over");
    sfx.newBest();
    const res = resourcesRef.current;
    const score = villagersRef.current.length * 30 + buildingsRef.current.length * 25 + Math.round(res.wood + res.stone + res.food + res.gold * 2);
    setTimeout(() => onFinish(Math.max(0, score)), 1500);
  }

  function begin() {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    resetKingdom();
    setOutcome(null);
    setPhase("playing");

    simIntervalRef.current = setInterval(() => {
      elapsedRef.current += TICK_MS / 1000;
      const now = Date.now();

      assignJobs();
      for (const v of villagersRef.current) villagerTick(v);

      if (Math.floor(elapsedRef.current) % 6 === 0) tryGrowPopulation();

      if (!rainingRef.current && now > nextRainAtRef.current) {
        rainingRef.current = true;
        setTimeout(() => { rainingRef.current = false; nextRainAtRef.current = Date.now() + 25000 + Math.random() * 25000; }, 9000);
      }

      if (now > nextBanditAtRef.current && banditsRef.current.length === 0) {
        nextBanditAtRef.current = now + 50000 + Math.random() * 30000;
        const edge = Math.floor(Math.random() * 3);
        const spawn = edge === 0 ? { x: -10, y: Math.random() * MAP_H } : edge === 1 ? { x: Math.random() * WATER.x, y: -10 } : { x: Math.random() * WATER.x, y: MAP_H + 10 };
        banditsRef.current.push({ id: Math.random(), x: spawn.x, y: spawn.y, hp: 30 });
        setNotice("Bandits approaching!");
        setTimeout(() => setNotice(""), 2000);
        sfx.lose();
      }

      const tc = townCenterRef.current;
      banditsRef.current = banditsRef.current.filter((bd) => {
        const d = dist(bd.x, bd.y, tc.x, tc.y);
        if (d < 18) {
          const res = resourcesRef.current;
          const loss = Math.min(res.gold, 15);
          res.gold -= loss;
          spawnFloatText(tc.x, tc.y - 20, `Raided! -${loss} gold`, "#ff3ea5");
          spawnParticles(bd.x, bd.y, "#ff3ea5", 10);
          return false;
        }
        bd.x += ((tc.x - bd.x) / d) * 0.55;
        bd.y += ((tc.y - bd.y) / d) * 0.55;
        return true;
      });

      for (const b of buildingsRef.current) {
        const def = BUILDING_TYPES[b.type];
        if (!def?.defense) continue;
        b.cooldown = (b.cooldown || 0) - TICK_MS;
        if (b.cooldown <= 0) {
          const target = banditsRef.current.find((bd) => dist(bd.x, bd.y, b.x, b.y) < def.range);
          if (target) {
            b.cooldown = 700;
            projectilesRef.current.push({ x: b.x, y: b.y, targetId: target.id, life: 1 });
            target.hp -= def.damage;
          }
        }
      }
      banditsRef.current = banditsRef.current.filter((bd) => {
        if (bd.hp <= 0) {
          spawnParticles(bd.x, bd.y, "#ffb703", 14);
          sfx.hit();
          return false;
        }
        return true;
      });

      for (const drop of rainDropsRef.current) {
        drop.y += 6;
        drop.x -= 1;
        if (drop.y > MAP_H) { drop.y = -10; drop.x = Math.random() * MAP_W; }
      }

      particlesRef.current = particlesRef.current.filter((pt) => { pt.x += pt.vx; pt.y += pt.vy; pt.life -= 0.03; return pt.life > 0; });
      floatTextRef.current = floatTextRef.current.filter((ft) => { ft.y -= 0.3; ft.life -= 0.012; return ft.life > 0; });
      projectilesRef.current = projectilesRef.current.filter((p) => { p.life -= 0.3; return p.life > 0; });

      const res = resourcesRef.current;
      setHud({
        wood: Math.floor(res.wood),
        stone: Math.floor(res.stone),
        food: Math.floor(res.food),
        gold: Math.floor(res.gold),
        population: villagersRef.current.length,
        timeLeft: Math.max(0, Math.ceil(SESSION_SECONDS - elapsedRef.current)),
      });

      if (elapsedRef.current >= SESSION_SECONDS) endSession();
    }, TICK_MS);
  }

  useEffect(() => () => clearInterval(simIntervalRef.current), []);

  useEffect(() => {
    if (phase !== "playing") return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");

    function render() {
      const t = elapsedRef.current;
      const cycle = (Math.sin(t * 0.025) + 1) / 2;
      const seasonT = Math.min(1, t / SESSION_SECONDS);

      const grassSpring = [46, 92, 58];
      const grassAutumn = [126, 92, 40];
      const gr = grassSpring.map((v, i) => Math.round(v + (grassAutumn[i] - v) * seasonT));
      const nightMul = 0.35 + cycle * 0.75;

      ctx.fillStyle = `rgb(${gr[0] * nightMul}, ${gr[1] * nightMul}, ${gr[2] * nightMul})`;
      ctx.fillRect(0, 0, MAP_W, MAP_H);

      ctx.fillStyle = `rgba(${20 * (1 - cycle) + 100 * cycle}, ${16 * (1 - cycle) + 130 * cycle}, ${40 * (1 - cycle) + 170 * cycle}, 0.15)`;
      ctx.fillRect(0, 0, MAP_W, MAP_H);

      const waterGrad = ctx.createLinearGradient(WATER.x, 0, WATER.x + WATER.w, 0);
      waterGrad.addColorStop(0, `rgba(${30 * nightMul},${70 * nightMul},${110 * nightMul},1)`);
      waterGrad.addColorStop(1, `rgba(${20 * nightMul},${50 * nightMul},${90 * nightMul},1)`);
      ctx.fillStyle = waterGrad;
      ctx.fillRect(WATER.x, WATER.y, WATER.w, WATER.h);
      ctx.strokeStyle = `rgba(200,230,255,${0.15 + Math.sin(t * 2) * 0.05})`;
      for (let i = 0; i < 5; i++) {
        const wy = ((t * 20 + i * 90) % (MAP_H + 40)) - 20;
        ctx.beginPath();
        ctx.moveTo(WATER.x + 10, wy);
        ctx.lineTo(WATER.x + WATER.w - 10, wy);
        ctx.stroke();
      }

      for (const f of FORESTS) {
        for (let i = 0; i < 14; i++) {
          const ang = (i / 14) * Math.PI * 2;
          const r = (i % 3) * (f.r / 3.2) + 6;
          const tx = f.x + Math.cos(ang) * r;
          const ty = f.y + Math.sin(ang) * r * 0.6;
          const sway = Math.sin(t * 1.5 + i) * 1.5;
          ctx.fillStyle = `rgb(${28 * nightMul},${(70 - seasonT * 20) * nightMul},${34 * nightMul})`;
          ctx.beginPath();
          ctx.arc(tx + sway, ty, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      for (const b of buildingsRef.current) {
        const def = BUILDING_TYPES[b.type] || { color: "#ffb703" };
        ctx.fillStyle = def.color;
        ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fillRect(b.x - b.w / 2, b.y + b.h / 2 - 4, b.w, 4);
        if (cycle < 0.5) {
          ctx.save();
          ctx.shadowColor = "#ffb703";
          ctx.shadowBlur = 10;
          ctx.fillStyle = "#ffe14d";
          ctx.fillRect(b.x - 3, b.y - 3, 4, 4);
          ctx.restore();
        }
      }

      for (const v of villagersRef.current) {
        const bobY = Math.sin(v.bob) * 1.5;
        ctx.fillStyle = accentColor || "#3ee6e0";
        ctx.beginPath();
        ctx.arc(v.x, v.y + bobY, 3.5, 0, Math.PI * 2);
        ctx.fill();
        if (cycle < 0.5) {
          ctx.save();
          ctx.shadowColor = "#ffb703";
          ctx.shadowBlur = 6;
          ctx.fillStyle = "#ffb703";
          ctx.beginPath();
          ctx.arc(v.x + 2, v.y - 2 + bobY, 1, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      for (const bd of banditsRef.current) {
        ctx.fillStyle = "#8a1f2b";
        ctx.beginPath();
        ctx.arc(bd.x, bd.y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const pr of projectilesRef.current) {
        const target = banditsRef.current.find((bd) => bd.id === pr.targetId);
        if (target) {
          ctx.strokeStyle = "#ffe14d";
          ctx.beginPath();
          ctx.moveTo(pr.x, pr.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
        }
      }

      if (rainingRef.current) {
        ctx.strokeStyle = "rgba(155,232,255,0.35)";
        for (const drop of rainDropsRef.current) {
          ctx.beginPath();
          ctx.moveTo(drop.x, drop.y);
          ctx.lineTo(drop.x - 2, drop.y - 8);
          ctx.stroke();
        }
      }

      for (const pt of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, pt.life);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - 1.5, pt.y - 1.5, 3, 3);
        ctx.globalAlpha = 1;
      }
      for (const ft of floatTextRef.current) {
        ctx.globalAlpha = Math.max(0, ft.life);
        ctx.fillStyle = ft.color;
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(ft.text, ft.x, ft.y);
        ctx.globalAlpha = 1;
      }

      if (cycle < 0.5) {
        ctx.fillStyle = `rgba(5,5,20,${(0.5 - cycle) * 0.9})`;
        ctx.fillRect(0, 0, MAP_W, MAP_H);
      }

      frameRef.current = requestAnimationFrame(render);
    }
    render();
    return () => cancelAnimationFrame(frameRef.current);
  }, [phase, accentColor]);

  if (deviceOk === null) return null;

  if (!deviceOk) {
    return (
      <div className="text-center py-10">
        <p className="text-3xl mb-4">💻</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">LAPTOP OR DESKTOP REQUIRED</p>
        <p className="text-textDim text-sm max-w-xs mx-auto">Kingdoms of Ash is built for laptop and desktop play. Please switch to a larger screen.</p>
      </div>
    );
  }

  if (phase === "menu") {
    return (
      <div className="text-center max-w-sm mx-auto">
        <p className="text-3xl mb-4">🏰</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">KINGDOMS OF ASH</p>
        <p className="text-textDim text-sm mb-6">
          A calm one, for once — no reflexes needed. Place buildings, and villagers walk to work on their own,
          gathering wood, stone, food, and gold. Watch your kingdom grow for 5 minutes, through a full day-night
          cycle, while bandits occasionally test your Watch Towers.
        </p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          FOUND YOUR KINGDOM
        </button>
      </div>
    );
  }

  if (phase === "over") {
    return (
      <div className="text-center">
        <p className="text-3xl mb-3">🏰</p>
        <p className="font-pixel text-sm mb-2" style={{ color: "#ffb703" }}>YOUR KINGDOM AT DUSK</p>
        <p className="font-mono text-xs text-textDim">{hud.population} villagers · {buildingsRef.current.length} buildings</p>
      </div>
    );
  }

  return (
    <div className="text-center relative">
      <div className="flex justify-between font-mono text-[11px] mb-2 text-textDim max-w-[640px] mx-auto flex-wrap gap-1">
        <span>🪵 {hud.wood} · 🪨 {hud.stone} · 🌾 {hud.food} · 🪙 {hud.gold}</span>
        <span>👥 {hud.population} · ⏱️ {Math.floor(hud.timeLeft / 60)}:{String(hud.timeLeft % 60).padStart(2, "0")}</span>
      </div>

      <div className="relative mx-auto rounded-lg overflow-hidden border border-lineColor" style={{ width: MAP_W, maxWidth: "94vw" }}>
        <canvas
          ref={canvasRef}
          width={MAP_W}
          height={MAP_H}
          style={{ width: "100%", height: "auto", display: "block", cursor: selectedType ? "copy" : "default" }}
          onClick={handleCanvasClick}
        />
        {notice && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-bgDeep/90 px-3 py-1.5 rounded-md">
            <p className="font-mono text-[10px] text-accentAmber">{notice}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-1.5 mt-3 max-w-[640px] mx-auto">
        {Object.entries(BUILDING_TYPES).map(([id, def]) => {
          const affordable = Object.entries(def.cost).every(([k, v]) => hud[k] >= v);
          const costStr = Object.entries(def.cost).map(([k, v]) => `${v}${k[0]}`).join(" ");
          return (
            <button
              key={id}
              onClick={() => setSelectedType(selectedType === id ? null : id)}
              disabled={!affordable}
              className="px-2.5 py-2 rounded-md border font-mono text-[9px] disabled:opacity-35"
              style={{ borderColor: selectedType === id ? accentColor : "rgba(169,159,214,0.3)" }}
              title={def.name}
            >
              <div>{def.icon} {def.name}</div>
              <div className="text-textDim">{costStr || "free"}</div>
            </button>
          );
        })}
      </div>
      <p className="font-mono text-[10px] text-textDim mt-3">Pick a building, then click the grass to place it.</p>
    </div>
  );
}
