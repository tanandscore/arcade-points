"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const VIEWPORT_W = 480;
const VIEWPORT_H = 340;
const WORLD_W = 2200;
const WORLD_H = 1400;
const TICK_MS = 33;
const SESSION_SECONDS = 280;
const THRUST = 0.14;
const DRAG = 0.985;
const MAX_SPEED = 4.2;
const SHIP_R = 8;

const DIFFICULTIES = {
  calm: { label: "CALM SPACE", hazardMult: 0.6, scoreMult: 1 },
  turbulent: { label: "TURBULENT", hazardMult: 1, scoreMult: 1.4 },
  chaotic: { label: "CHAOTIC", hazardMult: 1.6, scoreMult: 1.9 },
};

const NAME_A = ["Kel", "Vor", "Nyx", "Thal", "Or", "Cass", "Il", "Um", "Ae", "Zor", "Vesp", "Lyr"];
const NAME_B = ["ara", "enn", "ion", "aris", "eth", "ora", "ynn", "ael", "ust", "ivar", "os", "ith"];
function randomPlanetName() {
  return NAME_A[Math.floor(Math.random() * NAME_A.length)] + NAME_B[Math.floor(Math.random() * NAME_B.length)];
}
const DISCOVERY_LOGS = [
  "Traces of an ancient civilization detected.",
  "A world of endless oceans, untouched.",
  "Silent ruins scatter the surface.",
  "This world sings — the atmosphere itself resonates.",
  "Rings of shattered moons encircle it.",
  "Bioluminescent forests cover the whole surface.",
  "A dead world, but beautiful in its stillness.",
  "Storms the size of continents rage below.",
];

function makePlanet(x, y) {
  const hue = Math.floor(Math.random() * 360);
  const hasRing = Math.random() < 0.4;
  return {
    id: Math.random(),
    x, y,
    r: 14 + Math.random() * 16,
    color: `hsl(${hue}, 65%, 55%)`,
    atmoColor: `hsl(${(hue + 30) % 360}, 80%, 65%)`,
    ringColor: hasRing ? `hsl(${(hue + 180) % 360}, 50%, 70%)` : null,
    hasRing,
    name: randomPlanetName(),
    log: DISCOVERY_LOGS[Math.floor(Math.random() * DISCOVERY_LOGS.length)],
    discovered: false,
  };
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export default function TheLastStar({ onFinish, accentColor }) {
  const canvasRef = useRef(null);
  const [deviceOk, setDeviceOk] = useState(null);
  const [phase, setPhase] = useState("menu");
  const [difficulty, setDifficulty] = useState("turbulent");
  const [difficultyBests, setDifficultyBests] = useState({});
  const [hud, setHud] = useState({ hp: 100, maxHp: 100, discovered: 0, total: 8, fragments: 0, timeLeft: SESSION_SECONDS });
  const [outcome, setOutcome] = useState(null);
  const [discoveryFlash, setDiscoveryFlash] = useState(null);

  const shipRef = useRef({ x: 120, y: WORLD_H / 2, vx: 0, vy: 0, hp: 100, maxHp: 100 });
  const thrustRef = useRef({ x: 0, y: 0 });
  const invulnRef = useRef(0);
  const cameraRef = useRef({ x: 0, y: 0 });
  const planetsRef = useRef([]);
  const fragmentsRef = useRef([]);
  const lastStarRef = useRef({ x: WORLD_W - 100, y: WORLD_H / 2, reached: false });
  const asteroidFieldsRef = useRef([]);
  const asteroidsRef = useRef([]);
  const flareRef = useRef({ nextAt: 0, active: false, telegraphUntil: 0 });
  const starsFarRef = useRef([]);
  const starsMidRef = useRef([]);
  const starsNearRef = useRef([]);
  const nebulasRef = useRef([]);
  const particlesRef = useRef([]);
  const floatTextRef = useRef([]);
  const discoveredCountRef = useRef(0);
  const fragmentCountRef = useRef(0);
  const elapsedRef = useRef(0);
  const difficultyRef = useRef("turbulent");
  const finishedRef = useRef(false);

  const simIntervalRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    const isTouchPrimary = window.matchMedia("(pointer: coarse)").matches;
    const isSmall = window.innerWidth < 1024;
    setDeviceOk(!isTouchPrimary && !isSmall);
  }, []);

  useEffect(() => {
    fetch("/api/difficulty-scores?game=thelaststar")
      .then((r) => r.json())
      .then((d) => setDifficultyBests(d.bests || {}))
      .catch(() => {});
  }, []);

  function spawnParticles(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.4 + Math.random() * 1.2;
      particlesRef.current.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color });
    }
  }
  function spawnFloatText(x, y, text, color) {
    floatTextRef.current.push({ x, y, text, color, life: 1 });
  }

  function resetRun() {
    shipRef.current = { x: 120, y: WORLD_H / 2, vx: 0, vy: 0, hp: 100, maxHp: 100 };
    thrustRef.current = { x: 0, y: 0 };
    invulnRef.current = 0;
    cameraRef.current = { x: 0, y: 0 };
    planetsRef.current = Array.from({ length: 8 }, () =>
      makePlanet(300 + Math.random() * (WORLD_W - 700), 100 + Math.random() * (WORLD_H - 200))
    );
    fragmentsRef.current = Array.from({ length: 14 }, () => ({
      id: Math.random(),
      x: 200 + Math.random() * (WORLD_W - 400),
      y: 80 + Math.random() * (WORLD_H - 160),
    }));
    lastStarRef.current = { x: WORLD_W - 100, y: WORLD_H / 2, reached: false };
    asteroidFieldsRef.current = [
      { x: WORLD_W * 0.45, y: WORLD_H * 0.3, r: 160 },
      { x: WORLD_W * 0.65, y: WORLD_H * 0.75, r: 180 },
    ];
    asteroidsRef.current = [];
    for (const field of asteroidFieldsRef.current) {
      for (let i = 0; i < 16; i++) {
        const ang = Math.random() * Math.PI * 2;
        const rad = Math.random() * field.r;
        asteroidsRef.current.push({ x: field.x + Math.cos(ang) * rad, y: field.y + Math.sin(ang) * rad, r: 3 + Math.random() * 4, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, field });
      }
    }
    flareRef.current = { nextAt: Date.now() + 15000 + Math.random() * 15000, active: false, telegraphUntil: 0 };
    starsFarRef.current = Array.from({ length: 90 }, () => ({ x: Math.random() * WORLD_W, y: Math.random() * WORLD_H, r: Math.random() * 1 }));
    starsMidRef.current = Array.from({ length: 60 }, () => ({ x: Math.random() * WORLD_W, y: Math.random() * WORLD_H, r: 0.8 + Math.random() * 1 }));
    starsNearRef.current = Array.from({ length: 35 }, () => ({ x: Math.random() * WORLD_W, y: Math.random() * WORLD_H, r: 1.2 + Math.random() * 1.4, twinkle: Math.random() * Math.PI * 2 }));
    nebulasRef.current = Array.from({ length: 5 }, () => ({
      x: Math.random() * WORLD_W, y: Math.random() * WORLD_H,
      r: 120 + Math.random() * 160,
      color: `hsl(${Math.floor(Math.random() * 360)}, 60%, 50%)`,
    }));
    particlesRef.current = [];
    floatTextRef.current = [];
    discoveredCountRef.current = 0;
    fragmentCountRef.current = 0;
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
    const score = Math.round(
      (discoveredCountRef.current * 60 + fragmentCountRef.current * 15 + (won ? 500 : 0)) * diff.scoreMult
    );
    fetch("/api/difficulty-scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game: "thelaststar", difficulty: difficultyRef.current, score }),
    }).catch(() => {});
    setTimeout(() => onFinish(Math.max(0, score)), 1800);
  }

  function begin() {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    difficultyRef.current = difficulty;
    resetRun();
    setOutcome(null);
    setPhase("flying");

    simIntervalRef.current = setInterval(() => {
      elapsedRef.current += TICK_MS / 1000;
      const s = shipRef.current;
      const now = Date.now();
      const diff = DIFFICULTIES[difficultyRef.current];

      const t = thrustRef.current;
      if (t.x || t.y) {
        const mag = Math.hypot(t.x, t.y) || 1;
        s.vx += (t.x / mag) * THRUST;
        s.vy += (t.y / mag) * THRUST;
        spawnParticles(s.x - (t.x / mag) * 10, s.y - (t.y / mag) * 10, accentColor || "#3ee6e0", 1);
      }
      s.vx *= DRAG;
      s.vy *= DRAG;
      const speed = Math.hypot(s.vx, s.vy);
      if (speed > MAX_SPEED) {
        s.vx = (s.vx / speed) * MAX_SPEED;
        s.vy = (s.vy / speed) * MAX_SPEED;
      }
      s.x = Math.max(SHIP_R, Math.min(WORLD_W - SHIP_R, s.x + s.vx));
      s.y = Math.max(SHIP_R, Math.min(WORLD_H - SHIP_R, s.y + s.vy));

      cameraRef.current = {
        x: Math.max(0, Math.min(WORLD_W - VIEWPORT_W, s.x - VIEWPORT_W / 2)),
        y: Math.max(0, Math.min(WORLD_H - VIEWPORT_H, s.y - VIEWPORT_H / 2)),
      };

      if (invulnRef.current > 0) invulnRef.current -= 1;

      for (const p of planetsRef.current) {
        if (p.discovered) continue;
        if (dist(s.x, s.y, p.x, p.y) < p.r + 30) {
          p.discovered = true;
          discoveredCountRef.current += 1;
          spawnParticles(p.x, p.y, p.color, 24);
          setDiscoveryFlash({ name: p.name, log: p.log });
          setTimeout(() => setDiscoveryFlash(null), 3200);
          sfx.newBest();
          haptics.success();
        }
      }

      fragmentsRef.current = fragmentsRef.current.filter((f) => {
        if (dist(s.x, s.y, f.x, f.y) > 14) return true;
        fragmentCountRef.current += 1;
        spawnParticles(f.x, f.y, "#ffe14d", 8);
        sfx.correct();
        return false;
      });

      for (const a of asteroidsRef.current) {
        a.x += a.vx; a.y += a.vy;
        if (dist(a.x, a.y, a.field.x, a.field.y) > a.field.r) { a.vx *= -1; a.vy *= -1; }
        if (dist(s.x, s.y, a.x, a.y) < a.r + SHIP_R && invulnRef.current === 0) {
          s.hp = Math.max(0, s.hp - Math.round(6 * diff.hazardMult));
          invulnRef.current = 20;
          spawnParticles(s.x, s.y, "#ff3ea5", 6);
          haptics.tap();
          if (s.hp <= 0) { endRun(false); return; }
        }
      }

      const flare = flareRef.current;
      if (!flare.active && now > flare.nextAt) {
        flare.active = true;
        flare.telegraphUntil = now + 1800;
        spawnFloatText(s.x, cameraRef.current.y + 40, "SOLAR FLARE INCOMING", "#ffb703");
      }
      if (flare.active && now > flare.telegraphUntil && now < flare.telegraphUntil + 400) {
        flare.active = false;
        flare.nextAt = now + 18000 + Math.random() * 12000;
        if (Math.random() < 0.5) {
          s.hp = Math.max(0, s.hp - Math.round(14 * diff.hazardMult));
          spawnFloatText(s.x, s.y - 20, "FLARE SCORCH", "#ff3ea5");
          spawnParticles(s.x, s.y, "#ffb703", 14);
          if (s.hp <= 0) { endRun(false); return; }
        }
      }

      const star = lastStarRef.current;
      if (!star.reached && dist(s.x, s.y, star.x, star.y) < 50) {
        star.reached = true;
        spawnParticles(star.x, star.y, "#ffe9b8", 40);
        setTimeout(() => endRun(true), 900);
      }

      for (const sn of starsNearRef.current) sn.twinkle += 0.03;

      particlesRef.current = particlesRef.current.filter((pt) => { pt.x += pt.vx; pt.y += pt.vy; pt.life -= 0.03; return pt.life > 0; });
      floatTextRef.current = floatTextRef.current.filter((ft) => { ft.y -= 0.3; ft.life -= 0.012; return ft.life > 0; });

      setHud({
        hp: Math.round(s.hp),
        maxHp: s.maxHp,
        discovered: discoveredCountRef.current,
        total: planetsRef.current.length,
        fragments: fragmentCountRef.current,
        timeLeft: Math.max(0, Math.ceil(SESSION_SECONDS - elapsedRef.current)),
      });

      if (elapsedRef.current >= SESSION_SECONDS) {
        endRun(discoveredCountRef.current >= planetsRef.current.length);
      }
    }, TICK_MS);
  }

  useEffect(() => () => clearInterval(simIntervalRef.current), []);

  useEffect(() => {
    if (phase !== "flying") return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");

    function render() {
      const cam = cameraRef.current;
      ctx.fillStyle = "#04030a";
      ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);

      for (const nb of nebulasRef.current) {
        const nx = nb.x - cam.x * 0.4, ny = nb.y - cam.y * 0.4;
        if (nx < -nb.r || nx > VIEWPORT_W + nb.r || ny < -nb.r || ny > VIEWPORT_H + nb.r) continue;
        const grad = ctx.createRadialGradient(nx, ny, 0, nx, ny, nb.r);
        grad.addColorStop(0, nb.color.replace(")", ", 0.16)").replace("hsl", "hsla"));
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(nx, ny, nb.r, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = "#a99fd6";
      for (const st of starsFarRef.current) {
        const x = st.x - cam.x * 0.15, y = st.y - cam.y * 0.15;
        if (x >= -2 && x <= VIEWPORT_W + 2 && y >= -2 && y <= VIEWPORT_H + 2) ctx.fillRect(x, y, st.r, st.r);
      }
      ctx.fillStyle = "#c9c9e8";
      for (const st of starsMidRef.current) {
        const x = st.x - cam.x * 0.35, y = st.y - cam.y * 0.35;
        if (x >= -2 && x <= VIEWPORT_W + 2 && y >= -2 && y <= VIEWPORT_H + 2) ctx.fillRect(x, y, st.r, st.r);
      }
      for (const st of starsNearRef.current) {
        const x = st.x - cam.x * 0.6, y = st.y - cam.y * 0.6;
        if (x < -2 || x > VIEWPORT_W + 2 || y < -2 || y > VIEWPORT_H + 2) continue;
        ctx.globalAlpha = 0.6 + Math.sin(st.twinkle) * 0.4;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x, y, st.r, st.r);
        ctx.globalAlpha = 1;
      }

      for (const a of asteroidsRef.current) {
        const x = a.x - cam.x, y = a.y - cam.y;
        if (x < -10 || x > VIEWPORT_W + 10 || y < -10 || y > VIEWPORT_H + 10) continue;
        ctx.fillStyle = "#5a5468";
        ctx.beginPath();
        ctx.arc(x, y, a.r, 0, Math.PI * 2);
        ctx.fill();
      }

      for (const p of planetsRef.current) {
        const x = p.x - cam.x, y = p.y - cam.y;
        if (x < -60 || x > VIEWPORT_W + 60 || y < -60 || y > VIEWPORT_H + 60) continue;
        if (p.hasRing) {
          ctx.save();
          ctx.strokeStyle = p.ringColor;
          ctx.globalAlpha = 0.5;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(x, y, p.r * 1.7, p.r * 0.5, 0.4, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
        ctx.save();
        ctx.shadowColor = p.atmoColor;
        ctx.shadowBlur = p.discovered ? 20 : 10;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        if (p.discovered) {
          ctx.fillStyle = "#e8e2d6";
          ctx.font = "9px monospace";
          ctx.textAlign = "center";
          ctx.fillText(p.name, x, y - p.r - 10);
        }
      }

      for (const f of fragmentsRef.current) {
        const x = f.x - cam.x, y = f.y - cam.y;
        if (x < -10 || x > VIEWPORT_W + 10 || y < -10 || y > VIEWPORT_H + 10) continue;
        ctx.save();
        ctx.shadowColor = "#ffe14d";
        ctx.shadowBlur = 10;
        ctx.fillStyle = "#ffe14d";
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      const star = lastStarRef.current;
      const sx = star.x - cam.x, sy = star.y - cam.y;
      if (sx > -80 && sx < VIEWPORT_W + 80 && sy > -80 && sy < VIEWPORT_H + 80) {
        ctx.save();
        ctx.shadowColor = "#ffe9b8";
        ctx.shadowBlur = 40;
        ctx.fillStyle = "#ffe9b8";
        ctx.beginPath();
        ctx.arc(sx, sy, star.reached ? 30 : 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      const flare = flareRef.current;
      if (flare.active) {
        const now = Date.now();
        if (now < flare.telegraphUntil) {
          ctx.globalAlpha = 0.15 + Math.sin(now * 0.02) * 0.1;
          ctx.fillStyle = "#ffb703";
          ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);
          ctx.globalAlpha = 1;
        } else if (now < flare.telegraphUntil + 400) {
          ctx.fillStyle = "rgba(255,183,3,0.4)";
          ctx.fillRect(0, 0, VIEWPORT_W, VIEWPORT_H);
        }
      }

      for (const pt of particlesRef.current) {
        ctx.globalAlpha = Math.max(0, pt.life);
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.x - cam.x - 1.5, pt.y - cam.y - 1.5, 3, 3);
        ctx.globalAlpha = 1;
      }

      const s = shipRef.current;
      const sxp = s.x - cam.x, syp = s.y - cam.y;
      const angle = Math.atan2(s.vy, s.vx);
      const blinking = invulnRef.current > 0 && Math.floor(invulnRef.current / 3) % 2 === 0;
      if (!blinking) {
        ctx.save();
        ctx.translate(sxp, syp);
        ctx.rotate(Math.hypot(s.vx, s.vy) > 0.3 ? angle : 0);
        ctx.shadowColor = accentColor || "#3ee6e0";
        ctx.shadowBlur = 16;
        ctx.fillStyle = accentColor || "#3ee6e0";
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-8, -7);
        ctx.lineTo(-8, 7);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      for (const ft of floatTextRef.current) {
        ctx.globalAlpha = Math.max(0, ft.life);
        ctx.fillStyle = ft.color;
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(ft.text, ft.x - cam.x, ft.y - cam.y);
        ctx.globalAlpha = 1;
      }

      frameRef.current = requestAnimationFrame(render);
    }
    render();
    return () => cancelAnimationFrame(frameRef.current);
  }, [phase, accentColor]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "s", "a", "d", " "].includes(e.key)) e.preventDefault();
      if (e.key === "ArrowLeft" || e.key === "a") thrustRef.current = { ...thrustRef.current, x: -1 };
      if (e.key === "ArrowRight" || e.key === "d") thrustRef.current = { ...thrustRef.current, x: 1 };
      if (e.key === "ArrowUp" || e.key === "w") thrustRef.current = { ...thrustRef.current, y: -1 };
      if (e.key === "ArrowDown" || e.key === "s") thrustRef.current = { ...thrustRef.current, y: 1 };
    }
    function handleKeyUp(e) {
      if ((e.key === "ArrowLeft" || e.key === "a") && thrustRef.current.x === -1) thrustRef.current = { ...thrustRef.current, x: 0 };
      if ((e.key === "ArrowRight" || e.key === "d") && thrustRef.current.x === 1) thrustRef.current = { ...thrustRef.current, x: 0 };
      if ((e.key === "ArrowUp" || e.key === "w") && thrustRef.current.y === -1) thrustRef.current = { ...thrustRef.current, y: 0 };
      if ((e.key === "ArrowDown" || e.key === "s") && thrustRef.current.y === 1) thrustRef.current = { ...thrustRef.current, y: 0 };
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  function setThrust(x, y) {
    thrustRef.current = { x, y };
  }

  if (deviceOk === null) return null;

  if (!deviceOk) {
    return (
      <div className="text-center py-10">
        <p className="text-3xl mb-4">💻</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">LAPTOP OR DESKTOP REQUIRED</p>
        <p className="text-textDim text-sm max-w-xs mx-auto">The Last Star is built for laptop and desktop play. Please switch to a larger screen.</p>
      </div>
    );
  }

  if (phase === "menu") {
    return (
      <div className="text-center max-w-md mx-auto">
        <p className="text-3xl mb-4">✨</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">THE LAST STAR</p>
        <p className="text-textDim text-sm mb-6">
          WASD or arrow keys to thrust — expect drift, not an instant stop, so plan your approach. Discover all 8
          worlds, collect starlight fragments, avoid asteroid fields and solar flares, and find the Last Star at
          the far edge of the known universe.
        </p>
        <p className="font-mono text-[10px] text-textDim mb-2">CHOOSE SPACE CONDITIONS</p>
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
          LAUNCH
        </button>
      </div>
    );
  }

  if (phase === "over") {
    return (
      <div className="text-center">
        <p className="text-3xl mb-3">{outcome ? "🌟" : "🌑"}</p>
        <p className="font-pixel text-sm mb-2" style={{ color: outcome ? "#ffb703" : "#ff3ea5" }}>
          {outcome ? "YOU FOUND THE LAST STAR" : "DRIFTING, SIGNAL LOST"}
        </p>
        <p className="font-mono text-xs text-textDim">{hud.discovered}/{hud.total} worlds discovered · {hud.fragments} fragments</p>
      </div>
    );
  }

  return (
    <div className="text-center relative">
      {discoveryFlash && (
        <div className="absolute inset-x-0 -top-2 z-20 flex items-center justify-center pointer-events-none">
          <div className="bg-bgDeep/90 px-4 py-2 rounded-lg text-center">
            <p className="font-pixel text-xs text-accentAmber">{discoveryFlash.name} DISCOVERED</p>
            <p className="font-mono text-[10px] text-textDim mt-1">{discoveryFlash.log}</p>
          </div>
        </div>
      )}
      <div className="flex justify-between font-mono text-[11px] mb-2 text-textDim max-w-[480px] mx-auto">
        <span>🪐 {hud.discovered}/{hud.total} · ✨ {hud.fragments}</span>
        <span>⏱️ {Math.floor(hud.timeLeft / 60)}:{String(hud.timeLeft % 60).padStart(2, "0")}</span>
      </div>
      <div className="max-w-[480px] mx-auto mb-1">
        <div className="h-2 rounded-full bg-bgDeep border border-lineColor overflow-hidden">
          <div className="h-full" style={{ width: `${(hud.hp / hud.maxHp) * 100}%`, background: hud.hp < hud.maxHp * 0.3 ? "#ff3ea5" : "#6bff6b" }} />
        </div>
      </div>

      <div className="relative mx-auto rounded-lg overflow-hidden border border-lineColor" style={{ width: VIEWPORT_W, maxWidth: "94vw" }}>
        <canvas ref={canvasRef} width={VIEWPORT_W} height={VIEWPORT_H} style={{ width: "100%", height: "auto", display: "block" }} />
      </div>

      <div className="grid grid-cols-3 gap-2 max-w-[180px] mx-auto mt-4">
        <div />
        <button onMouseDown={() => setThrust(0, -1)} onMouseUp={() => setThrust(0, 0)} onMouseLeave={() => setThrust(0, 0)} className="py-2.5 rounded-md border border-lineColor">▲</button>
        <div />
        <button onMouseDown={() => setThrust(-1, 0)} onMouseUp={() => setThrust(0, 0)} onMouseLeave={() => setThrust(0, 0)} className="py-2.5 rounded-md border border-lineColor">◀</button>
        <button onMouseDown={() => setThrust(0, 1)} onMouseUp={() => setThrust(0, 0)} onMouseLeave={() => setThrust(0, 0)} className="py-2.5 rounded-md border border-lineColor">▼</button>
        <button onMouseDown={() => setThrust(1, 0)} onMouseUp={() => setThrust(0, 0)} onMouseLeave={() => setThrust(0, 0)} className="py-2.5 rounded-md border border-lineColor">▶</button>
      </div>
      <p className="font-mono text-[10px] text-textDim mt-3">WASD or arrow keys to thrust. Expect drift, not an instant stop.</p>
    </div>
  );
}
