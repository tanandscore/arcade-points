"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const VIEWPORT_W = 480;
const VIEWPORT_H = 320;
const HORIZON_Y = 104;
const TICK_MS = 33;
const SEGMENT_LEN = 200;
const DRAW_DISTANCE = 90;
const ROAD_HALF_W = 900;
const LAPS = 2;

function buildCurves(specs) {
  const arr = [];
  for (const s of specs) for (let i = 0; i < s.length; i++) arr.push(s.curve);
  return arr;
}

const TRACKS = [
  {
    id: "gridline",
    name: "Gridline Avenue",
    curves: buildCurves([
      { length: 40, curve: 0 }, { length: 26, curve: 1.6 }, { length: 20, curve: 0 },
      { length: 26, curve: -1.6 }, { length: 40, curve: 0 }, { length: 22, curve: 2.2 },
      { length: 16, curve: 0 }, { length: 22, curve: -2.2 }, { length: 30, curve: 0 },
    ]),
  },
  {
    id: "chicane",
    name: "Chicane District",
    curves: buildCurves([
      { length: 20, curve: 0 }, { length: 14, curve: 2.4 }, { length: 10, curve: -2.4 },
      { length: 14, curve: 2.4 }, { length: 10, curve: -2.4 }, { length: 20, curve: 0 },
      { length: 18, curve: 1.2 }, { length: 18, curve: -1.2 }, { length: 26, curve: 0 },
    ]),
  },
  {
    id: "megaloop",
    name: "Megaloop Highway",
    curves: buildCurves([
      { length: 60, curve: 0 }, { length: 30, curve: 3 }, { length: 10, curve: 0 },
      { length: 60, curve: 0 }, { length: 30, curve: -3 }, { length: 10, curve: 0 },
    ]),
  },
];

const VEHICLES = [
  { id: "viper", name: "Viper", color: "#3ee6e0", maxSpeed: 1.0, accel: 1.0, grip: 1.0 },
  { id: "reaper", name: "Reaper", color: "#ff3ea5", maxSpeed: 1.15, accel: 0.85, grip: 0.82 },
  { id: "specter", name: "Specter", color: "#b45cff", maxSpeed: 0.92, accel: 1.2, grip: 1.1 },
  { id: "titan", name: "Titan", color: "#ffb703", maxSpeed: 0.95, accel: 0.9, grip: 1.22 },
  { id: "razor", name: "Razor", color: "#6bff6b", maxSpeed: 1.08, accel: 1.05, grip: 0.9 },
];

const BASE_SPEED = 5.5;
const BOOST_COOLDOWN_MS = 5000;
const BOOST_DURATION_MS = 1400;

function projectSegment(n, curveShift) {
  const scale = 300 / (300 + n * 42);
  const y = HORIZON_Y + scale * (VIEWPORT_H - HORIZON_Y);
  const roadHalfW = scale * ROAD_HALF_W * 0.014;
  return { scale, y, roadHalfW, curveShift: curveShift * scale };
}

export default function NeonDrift({ onFinish, accentColor }) {
  const canvasRef = useRef(null);
  const [deviceOk, setDeviceOk] = useState(null);
  const [phase, setPhase] = useState("menu");
  const [vehicleId, setVehicleId] = useState("viper");
  const [trackId, setTrackId] = useState("gridline");
  const [hud, setHud] = useState({ speed: 0, lap: 1, position: 1, boostReady: true, finished: false });
  const [outcome, setOutcome] = useState(null);
  const [finalLapFlash, setFinalLapFlash] = useState(false);

  const playerRef = useRef({ z: 0, x: 0, speed: 0, laps: 0 });
  const steerRef = useRef(0);
  const throttleRef = useRef(false);
  const boostQueuedRef = useRef(false);
  const boostUntilRef = useRef(0);
  const boostCooldownUntilRef = useRef(0);
  const rivalsRef = useRef([]);
  const rainRef = useRef([]);
  const sparksRef = useRef([]);
  const boltRef = useRef({ until: 0, points: [] });
  const nextBoltAtRef = useRef(0);
  const shakeRef = useRef(0);
  const elapsedRef = useRef(0);
  const finishedRef = useRef(false);

  const trackRef = useRef(TRACKS[0]);
  const vehicleRef = useRef(VEHICLES[0]);

  const simIntervalRef = useRef(null);
  const frameRef = useRef(null);

  useEffect(() => {
    const isTouchPrimary = window.matchMedia("(pointer: coarse)").matches;
    const isSmall = window.innerWidth < 1024;
    setDeviceOk(!isTouchPrimary && !isSmall);
  }, []);

  function curveAt(track, segIndex) {
    return track.curves[((segIndex % track.curves.length) + track.curves.length) % track.curves.length];
  }

  function resetRace() {
    const track = TRACKS.find((t) => t.id === trackId) || TRACKS[0];
    const vehicle = VEHICLES.find((v) => v.id === vehicleId) || VEHICLES[0];
    trackRef.current = track;
    vehicleRef.current = vehicle;
    playerRef.current = { z: 0, x: 0, speed: 0, laps: 0 };
    steerRef.current = 0;
    throttleRef.current = false;
    boostQueuedRef.current = false;
    boostUntilRef.current = 0;
    boostCooldownUntilRef.current = 0;
    rivalsRef.current = [
      { id: 1, z: 60, x: -0.3, speedMult: 0.94 + Math.random() * 0.08, color: "#ffe14d", laps: 0 },
      { id: 2, z: -60, x: 0.3, speedMult: 0.94 + Math.random() * 0.08, color: "#9be8ff", laps: 0 },
      { id: 3, z: 120, x: 0, speedMult: 0.94 + Math.random() * 0.08, color: "#ff5a3c", laps: 0 },
    ];
    rainRef.current = Array.from({ length: 90 }, () => ({ x: Math.random() * VIEWPORT_W, y: Math.random() * VIEWPORT_H, speed: 6 + Math.random() * 6 }));
    sparksRef.current = [];
    boltRef.current = { until: 0, points: [] };
    nextBoltAtRef.current = Date.now() + 3000 + Math.random() * 4000;
    shakeRef.current = 0;
    elapsedRef.current = 0;
    finishedRef.current = false;
  }

  function finishRace(place) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(simIntervalRef.current);
    const won = place === 1;
    setOutcome({ won, place });
    setPhase("over");
    sfx[won ? "newBest" : "lose"]();
    const score = Math.max(0, (4 - place) * 220) + 400;
    setTimeout(() => onFinish(Math.max(0, score)), 1500);
  }

  function begin() {
    const el = document.documentElement;
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    resetRace();
    setOutcome(null);
    setPhase("racing");

    simIntervalRef.current = setInterval(() => {
      const p = playerRef.current;
      const vehicle = vehicleRef.current;
      const track = trackRef.current;
      const now = Date.now();
      elapsedRef.current += TICK_MS / 1000;

      const boosting = now < boostUntilRef.current;
      if (boostQueuedRef.current && now > boostCooldownUntilRef.current) {
        boostQueuedRef.current = false;
        boostUntilRef.current = now + BOOST_DURATION_MS;
        boostCooldownUntilRef.current = now + BOOST_COOLDOWN_MS;
        shakeRef.current = 1;
        sfx.boost();
        haptics.success();
      } else {
        boostQueuedRef.current = false;
      }

      const targetSpeed = throttleRef.current ? vehicle.maxSpeed * (boosting ? 1.6 : 1) : vehicle.maxSpeed * 0.25;
      p.speed += (targetSpeed - p.speed) * (throttleRef.current ? 0.06 : 0.03);
      p.speed = Math.max(0, p.speed);

      const segIndex = Math.floor(p.z / SEGMENT_LEN);
      const curve = curveAt(track, segIndex);
      p.x += curve * p.speed * 0.0009;
      p.x += steerRef.current * 0.02 * vehicle.grip;
      const offRoad = Math.abs(p.x) > 1;
      p.x = Math.max(-1.6, Math.min(1.6, p.x));
      const effectiveSpeed = p.speed * (offRoad ? 0.45 : 1) * BASE_SPEED;
      p.z += effectiveSpeed;

      const lapLength = track.curves.length * SEGMENT_LEN;
      if (p.z >= lapLength) {
        p.z -= lapLength;
        p.laps += 1;
        if (p.laps >= LAPS) {
          const playerTotal = p.laps * lapLength + p.z;
          const behind = rivalsRef.current.filter((r) => r.laps * lapLength + r.z < playerTotal).length;
          finishRace(3 - behind);
          return;
        }
        if (p.laps === LAPS - 1) {
          setFinalLapFlash(true);
          setTimeout(() => setFinalLapFlash(false), 1800);
          sfx.levelUp();
        }
      }

      for (const r of rivalsRef.current) {
        const rSeg = Math.floor(r.z / SEGMENT_LEN);
        const rCurve = curveAt(track, rSeg);
        r.x = Math.max(-0.8, Math.min(0.8, r.x + rCurve * 0.0006));
        r.z += BASE_SPEED * vehicle.maxSpeed * r.speedMult * 0.85;
        if (r.z >= lapLength) { r.z -= lapLength; r.laps += 1; }
      }

      if (offRoad && Math.random() < 0.3) {
        sparksRef.current.push({ x: VIEWPORT_W / 2 + (Math.random() - 0.5) * 40, y: VIEWPORT_H - 40, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 2, life: 1 });
      }
      if (boosting && Math.random() < 0.8) {
        sparksRef.current.push({ x: VIEWPORT_W / 2 + (Math.random() - 0.5) * 14, y: VIEWPORT_H - 20, vx: (Math.random() - 0.5) * 1.5, vy: 2 + Math.random() * 2, life: 1, flame: true });
      }

      for (const drop of rainRef.current) {
        drop.y += drop.speed + p.speed * 3;
        drop.x -= 1;
        if (drop.y > VIEWPORT_H) { drop.y = -10; drop.x = Math.random() * VIEWPORT_W; }
      }

      if (now > nextBoltAtRef.current) {
        nextBoltAtRef.current = now + 5000 + Math.random() * 8000;
        const pts = [{ x: 60 + Math.random() * (VIEWPORT_W - 120), y: 0 }];
        for (let i = 0; i < 5; i++) pts.push({ x: pts[i].x + (Math.random() - 0.5) * 40, y: (i + 1) * (HORIZON_Y / 5) });
        boltRef.current = { until: now + 180, points: pts };
        shakeRef.current = Math.max(shakeRef.current, 0.6);
      }

      sparksRef.current = sparksRef.current.filter((s) => { s.x += s.vx; s.y += s.vy; s.life -= 0.05; return s.life > 0; });
      shakeRef.current = Math.max(0, shakeRef.current - 0.06);

      setHud({
        speed: Math.round(p.speed * 220),
        lap: Math.min(LAPS, p.laps + 1),
        position: 1 + rivalsRef.current.filter((r) => r.laps * lapLength + r.z > p.laps * lapLength + p.z).length,
        boostReady: now > boostCooldownUntilRef.current,
        finished: false,
      });
    }, TICK_MS);
  }

  useEffect(() => () => clearInterval(simIntervalRef.current), []);

  useEffect(() => {
    if (phase !== "racing") return undefined;
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");

    function render() {
      const p = playerRef.current;
      const track = trackRef.current;
      const boosting = Date.now() < boostUntilRef.current;
      const shakeX = (Math.random() - 0.5) * shakeRef.current * 6;
      const shakeY = (Math.random() - 0.5) * shakeRef.current * 4;

      ctx.save();
      ctx.translate(shakeX, shakeY);

      const skyGrad = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
      skyGrad.addColorStop(0, "#0a0616");
      skyGrad.addColorStop(1, "#2a1140");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(-20, -20, VIEWPORT_W + 40, HORIZON_Y + 20);

      for (let i = 0; i < 10; i++) {
        const bx = (i * 60 + (p.z * 0.02) % 60) % (VIEWPORT_W + 60) - 30;
        const bh = 30 + (i % 4) * 18;
        ctx.fillStyle = "rgba(20,10,40,0.8)";
        ctx.fillRect(bx, HORIZON_Y - bh, 34, bh);
        ctx.fillStyle = i % 2 === 0 ? "#ff3ea5" : "#3ee6e0";
        ctx.globalAlpha = 0.5 + Math.sin(p.z * 0.01 + i) * 0.3;
        ctx.fillRect(bx + 4, HORIZON_Y - bh + 6, 6, 6);
        ctx.fillRect(bx + 16, HORIZON_Y - bh + 16, 6, 6);
        ctx.globalAlpha = 1;
      }

      if (Date.now() < boltRef.current.until) {
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.fillRect(-20, -20, VIEWPORT_W + 40, VIEWPORT_H + 40);
        ctx.strokeStyle = "#e8e2d6";
        ctx.lineWidth = 2;
        ctx.beginPath();
        boltRef.current.points.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
        ctx.stroke();
      }

      ctx.fillStyle = "#0d0a18";
      ctx.fillRect(-20, HORIZON_Y, VIEWPORT_W + 40, VIEWPORT_H - HORIZON_Y + 20);

      const segIndex0 = Math.floor(p.z / SEGMENT_LEN);
      let curveShift = 0;
      let curveRate = 0;
      const projections = [];
      for (let n = DRAW_DISTANCE - 1; n >= 0; n--) {
        const curve = curveAt(track, segIndex0 + n);
        curveRate += curve;
        curveShift += curveRate * 0.4;
        projections[n] = projectSegment(n, curveShift - p.x * 220);
      }
      for (let n = DRAW_DISTANCE - 1; n >= 1; n--) {
        const a = projections[n];
        const b = projections[n - 1];
        const cx = VIEWPORT_W / 2;
        const ax1 = cx + a.curveShift - a.roadHalfW, ax2 = cx + a.curveShift + a.roadHalfW;
        const bx1 = cx + b.curveShift - b.roadHalfW, bx2 = cx + b.curveShift + b.roadHalfW;
        const band = n % 6 < 3;
        ctx.fillStyle = band ? "#1c1630" : "#221a3a";
        ctx.beginPath();
        ctx.moveTo(ax1, a.y); ctx.lineTo(ax2, a.y); ctx.lineTo(bx2, b.y); ctx.lineTo(bx1, b.y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = band ? accentColor || "#3ee6e0" : "#ff3ea5";
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = Math.max(1, a.scale * 2.5);
        ctx.beginPath(); ctx.moveTo(ax1, a.y); ctx.lineTo(bx1, b.y); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ax2, a.y); ctx.lineTo(bx2, b.y); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      const lapLength = track.curves.length * SEGMENT_LEN;
      for (const r of rivalsRef.current) {
        let dz = r.laps * lapLength + r.z - (p.laps * lapLength + p.z);
        if (dz < -lapLength / 2) dz += lapLength;
        const n = Math.round(dz / SEGMENT_LEN);
        if (n > 0 && n < DRAW_DISTANCE) {
          const proj = projections[n];
          const cx = VIEWPORT_W / 2 + proj.curveShift + r.x * proj.roadHalfW * 0.6;
          const carW = Math.max(3, proj.scale * 26);
          ctx.fillStyle = r.color;
          ctx.fillRect(cx - carW / 2, proj.y - carW * 0.5, carW, carW * 0.5);
        }
      }

      ctx.strokeStyle = "rgba(155,232,255,0.35)";
      ctx.lineWidth = 1;
      for (const drop of rainRef.current) {
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x - 3, drop.y - 10);
        ctx.stroke();
      }

      const speedFrac = Math.min(1, p.speed);
      if (speedFrac > 0.4) {
        ctx.strokeStyle = `rgba(255,255,255,${(speedFrac - 0.4) * 0.5})`;
        const cx = VIEWPORT_W / 2, cy = VIEWPORT_H * 0.55;
        for (let i = 0; i < 16; i++) {
          const ang = (i / 16) * Math.PI * 2;
          const len = 20 + speedFrac * 60 + (boosting ? 40 : 0);
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * 40, cy + Math.sin(ang) * 20);
          ctx.lineTo(cx + Math.cos(ang) * (40 + len), cy + Math.sin(ang) * (20 + len * 0.5));
          ctx.stroke();
        }
      }

      for (const s of sparksRef.current) {
        ctx.globalAlpha = Math.max(0, s.life);
        ctx.fillStyle = s.flame ? "#ff5a3c" : "#ffe14d";
        ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
        ctx.globalAlpha = 1;
      }

      const vehicle = vehicleRef.current;
      const carX = VIEWPORT_W / 2 - steerRef.current * 6;
      const carY = VIEWPORT_H - 46;
      ctx.save();
      ctx.shadowColor = vehicle.color;
      ctx.shadowBlur = boosting ? 30 : 16;
      ctx.fillStyle = vehicle.color;
      ctx.beginPath();
      ctx.moveTo(carX, carY - 20);
      ctx.lineTo(carX - 16, carY + 16);
      ctx.lineTo(carX + 16, carY + 16);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      if (boosting || throttleRef.current) {
        ctx.fillStyle = boosting ? "#ffb703" : "#3ee6e0";
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(carX, carY + 22, boosting ? 10 : 6, 0, Math.PI * 2);
        ctx.fill();
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
      if (e.key === "ArrowLeft" || e.key === "a") steerRef.current = -1;
      if (e.key === "ArrowRight" || e.key === "d") steerRef.current = 1;
      if (e.key === "ArrowUp" || e.key === "w") throttleRef.current = true;
      if (e.key === " " || e.key === "Shift") boostQueuedRef.current = true;
    }
    function handleKeyUp(e) {
      if ((e.key === "ArrowLeft" || e.key === "a") && steerRef.current === -1) steerRef.current = 0;
      if ((e.key === "ArrowRight" || e.key === "d") && steerRef.current === 1) steerRef.current = 0;
      if (e.key === "ArrowUp" || e.key === "w") throttleRef.current = false;
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  function setSteer(v) { steerRef.current = v; }
  function setThrottle(v) { throttleRef.current = v; }
  function queueBoost() { boostQueuedRef.current = true; }

  if (deviceOk === null) return null;

  if (!deviceOk) {
    return (
      <div className="text-center py-10">
        <p className="text-3xl mb-4">💻</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">LAPTOP OR DESKTOP REQUIRED</p>
        <p className="text-textDim text-sm max-w-xs mx-auto">Neon Drift is built for laptop and desktop play. Please switch to a larger screen.</p>
      </div>
    );
  }

  if (phase === "menu") {
    return (
      <div className="text-center max-w-sm mx-auto">
        <p className="text-3xl mb-4">🌆</p>
        <p className="font-pixel text-xs text-accentAmber mb-3">NEON DRIFT</p>
        <p className="text-textDim text-sm mb-6">A rain-soaked cyberpunk city, 3 tracks, 5 cars. ← → steer, ↑ throttle, Space boost.</p>
        <button onClick={() => setPhase("vehicle")} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          ENTER THE CITY
        </button>
      </div>
    );
  }

  if (phase === "vehicle") {
    return (
      <div className="text-center max-w-md mx-auto">
        <p className="font-pixel text-xs text-accentAmber mb-4">CHOOSE YOUR CAR</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
          {VEHICLES.map((v) => (
            <button
              key={v.id}
              onClick={() => setVehicleId(v.id)}
              className="rounded-md border-2 p-3"
              style={{ borderColor: vehicleId === v.id ? v.color : "rgba(169,159,214,0.3)" }}
            >
              <p className="font-mono text-xs" style={{ color: v.color }}>{v.name}</p>
              <p className="font-mono text-[9px] text-textDim">Spd {Math.round(v.maxSpeed * 100)} · Grip {Math.round(v.grip * 100)}</p>
            </button>
          ))}
        </div>
        <button onClick={() => setPhase("track")} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          NEXT ▸
        </button>
      </div>
    );
  }

  if (phase === "track") {
    return (
      <div className="text-center max-w-md mx-auto">
        <p className="font-pixel text-xs text-accentAmber mb-4">CHOOSE YOUR TRACK</p>
        <div className="space-y-2 mb-5">
          {TRACKS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTrackId(t.id)}
              className="w-full rounded-md border-2 p-3 text-left"
              style={{ borderColor: trackId === t.id ? accentColor : "rgba(169,159,214,0.3)" }}
            >
              <p className="font-mono text-xs text-textLight">{t.name}</p>
            </button>
          ))}
        </div>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START RACE ▸
        </button>
      </div>
    );
  }

  if (phase === "over") {
    return (
      <div className="text-center">
        <p className="text-3xl mb-3">{outcome?.won ? "🏆" : "🏁"}</p>
        <p className="font-pixel text-sm mb-2" style={{ color: outcome?.won ? "#ffb703" : "#3ee6e0" }}>
          {outcome?.won ? "1ST PLACE" : `FINISHED ${outcome?.place}${outcome?.place === 2 ? "ND" : "TH"}`}
        </p>
      </div>
    );
  }

  return (
    <div className="text-center relative">
      {finalLapFlash && (
        <div className="absolute inset-x-0 -top-2 z-20 flex items-center justify-center pointer-events-none">
          <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/90 px-4 py-2 rounded-lg">FINAL LAP</p>
        </div>
      )}
      <div className="flex justify-between font-mono text-[11px] mb-2 text-textDim max-w-[480px] mx-auto">
        <span>Lap {hud.lap}/{LAPS} · P{hud.position}</span>
        <span>{hud.speed} km/h</span>
        <span>{hud.boostReady ? "Boost ready" : "Boost recharging..."}</span>
      </div>
      <div className="relative mx-auto rounded-lg overflow-hidden border border-lineColor" style={{ width: VIEWPORT_W, maxWidth: "94vw" }}>
        <canvas ref={canvasRef} width={VIEWPORT_W} height={VIEWPORT_H} style={{ width: "100%", height: "auto", display: "block" }} />
      </div>
      <div className="flex justify-center gap-2 mt-4">
        <button onMouseDown={() => setSteer(-1)} onMouseUp={() => setSteer(0)} onMouseLeave={() => setSteer(0)} className="px-5 py-3 rounded-md border border-lineColor font-pixel text-xs">◀</button>
        <button onMouseDown={() => setThrottle(true)} onMouseUp={() => setThrottle(false)} onMouseLeave={() => setThrottle(false)} className="px-5 py-3 rounded-md font-pixel text-[10px] text-bgDeep" style={{ background: accentColor }}>GAS</button>
        <button onMouseDown={() => setSteer(1)} onMouseUp={() => setSteer(0)} onMouseLeave={() => setSteer(0)} className="px-5 py-3 rounded-md border border-lineColor font-pixel text-xs">▶</button>
        <button onClick={queueBoost} className="px-5 py-3 rounded-md font-pixel text-[10px] text-bgDeep" style={{ background: "#ff3ea5" }}>BOOST</button>
      </div>
      <p className="font-mono text-[10px] text-textDim mt-3">← → steer, ↑ throttle, Space boost.</p>
    </div>
  );
}
