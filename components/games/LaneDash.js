"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const LANES = 3;
const TICK_MS = 40;
const LEVEL_INTERVAL_M = 200;

export default function LaneDash({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [lane, setLane] = useState(1);
  const [obstacles, setObstacles] = useState([]);
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(3.5);
  const [level, setLevel] = useState(1);
  const [levelUpFlash, setLevelUpFlash] = useState(false);
  const laneRef = useRef(1);
  const distanceRef = useRef(0);
  const speedRef = useRef(3.5);
  const levelRef = useRef(1);
  const bonusRef = useRef(0);
  const finishedRef = useRef(false);
  const intervalRef = useRef(null);
  const spawnCounterRef = useRef(0);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "ArrowLeft") moveLane(-1);
      if (e.key === "ArrowRight") moveLane(1);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function moveLane(delta) {
    const next = Math.min(LANES - 1, Math.max(0, laneRef.current + delta));
    laneRef.current = next;
    setLane(next);
  }

  function begin() {
    setStarted(true);
    intervalRef.current = setInterval(() => {
      setObstacles((prev) => {
        let next = prev
          .map((o) => ({ ...o, y: o.y + speedRef.current }))
          .filter((o) => o.y < 110);

        spawnCounterRef.current += 1;
        if (spawnCounterRef.current > 28) {
          spawnCounterRef.current = 0;
          next = [...next, { id: Math.random(), lane: Math.floor(Math.random() * LANES), y: -10 }];
        }

        const collided = next.some((o) => o.lane === laneRef.current && o.y > 70 && o.y < 92);
        if (collided && !finishedRef.current) {
          finishedRef.current = true;
          clearInterval(intervalRef.current);
          sfx.lose();
          onFinish(Math.round(distanceRef.current) + bonusRef.current);
        }
        return next;
      });
      distanceRef.current += speedRef.current / 3;
      setDistance(distanceRef.current);
      speedRef.current = Math.min(9, speedRef.current + 0.004);
      setSpeed(speedRef.current);

      const newLevel = Math.floor(distanceRef.current / LEVEL_INTERVAL_M) + 1;
      if (newLevel > levelRef.current) {
        levelRef.current = newLevel;
        setLevel(newLevel);
        bonusRef.current += 40 * newLevel;
        sfx.levelUp();
        haptics.success();
        setLevelUpFlash(true);
        setTimeout(() => setLevelUpFlash(false), 900);
      }
    }, TICK_MS);
    return () => clearInterval(intervalRef.current);
  }

  useEffect(() => () => clearInterval(intervalRef.current), []);

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          Use ← → (or the buttons below) to switch lanes. Dodge everything coming at you. Every {LEVEL_INTERVAL_M}m
          is a new level with a bonus.
        </p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="font-mono text-xs mb-3 text-textDim">
        Distance: <span className="text-textLight">{Math.round(distance)}m</span> · Lvl {level}
      </p>
      <div
        className="relative mx-auto rounded-lg overflow-hidden border border-lineColor"
        style={{ width: "min(90vw, 300px)", height: "360px", background: "#12092b" }}
      >
        {levelUpFlash && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/80 px-4 py-2 rounded-lg">LEVEL {level}!</p>
          </div>
        )}
        {[0, 1, 2].map((l) => (
          <div key={l} className="absolute top-0 bottom-0" style={{ left: `${(l * 100) / LANES}%`, width: `${100 / LANES}%`, borderLeft: l > 0 ? "1px dashed rgba(169,159,214,0.2)" : "none" }} />
        ))}
        {obstacles.map((o) => (
          <div
            key={o.id}
            className="absolute rounded-md"
            style={{
              left: `calc(${(o.lane * 100) / LANES}% + 10%)`,
              width: `${100 / LANES - 20}%`,
              top: `${o.y}%`,
              height: "10%",
              background: "#ff3ea5",
            }}
          />
        ))}
        <div
          className="absolute rounded-md"
          style={{
            left: `calc(${(lane * 100) / LANES}% + 10%)`,
            width: `${100 / LANES - 20}%`,
            top: "78%",
            height: "10%",
            background: accentColor,
          }}
        />
      </div>
      <div className="flex justify-center gap-4 mt-4">
        <button onClick={() => moveLane(-1)} className="px-6 py-3 rounded-md border border-lineColor font-pixel text-xs">◀</button>
        <button onClick={() => moveLane(1)} className="px-6 py-3 rounded-md border border-lineColor font-pixel text-xs">▶</button>
      </div>
    </div>
  );
}
