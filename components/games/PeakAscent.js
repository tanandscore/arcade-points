"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const LANES = 4;
const TICK_MS = 40;
const LEVEL_INTERVAL_M = 100;

export default function PeakAscent({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [lane, setLane] = useState(1);
  const [barrels, setBarrels] = useState([]);
  const [height, setHeight] = useState(0);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [levelUpFlash, setLevelUpFlash] = useState(false);

  const laneRef = useRef(1);
  const heightRef = useRef(0);
  const levelRef = useRef(1);
  const bonusRef = useRef(0);
  const livesRef = useRef(3);
  const speedRef = useRef(1.6);
  const spawnTimerRef = useRef(0);
  const intervalRef = useRef(null);
  const finishedRef = useRef(false);

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(intervalRef.current);
    sfx.lose();
    onFinish(Math.round(heightRef.current) + bonusRef.current);
  }

  function begin() {
    setStarted(true);
    intervalRef.current = setInterval(() => {
      heightRef.current += speedRef.current / 4;
      setHeight(heightRef.current);
      speedRef.current = Math.min(4.5, speedRef.current + 0.0015);

      const newLevel = Math.floor(heightRef.current / LEVEL_INTERVAL_M) + 1;
      if (newLevel > levelRef.current) {
        levelRef.current = newLevel;
        setLevel(newLevel);
        bonusRef.current += 50 * newLevel;
        sfx.levelUp();
        haptics.success();
        setLevelUpFlash(true);
        setTimeout(() => setLevelUpFlash(false), 1000);
      }

      spawnTimerRef.current += 1;
      const spawnEvery = Math.max(20, 42 - Math.floor(heightRef.current / 40));
      if (spawnTimerRef.current > spawnEvery) {
        spawnTimerRef.current = 0;
        const barrelLane = Math.floor(Math.random() * LANES);
        setBarrels((prev) => [...prev, { id: Math.random(), lane: barrelLane, y: -8 }]);
      }

      setBarrels((prev) => {
        const next = prev.map((b) => ({ ...b, y: b.y + speedRef.current })).filter((b) => b.y < 108);
        const hit = next.find((b) => b.lane === laneRef.current && b.y > 78 && b.y < 92);
        if (hit) {
          sfx.wrong();
          livesRef.current -= 1;
          setLives(livesRef.current);
          if (livesRef.current <= 0) {
            finish();
          }
          return next.filter((b) => b.id !== hit.id);
        }
        return next;
      });
    }, TICK_MS);
  }

  useEffect(() => () => clearInterval(intervalRef.current), []);

  function move(dir) {
    laneRef.current = Math.max(0, Math.min(LANES - 1, laneRef.current + dir));
    setLane(laneRef.current);
    sfx.tap();
  }

  useEffect(() => {
    function handleKey(e) {
      if (!started) return;
      if (e.key === "ArrowLeft") move(-1);
      if (e.key === "ArrowRight") move(1);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          Climb the ladders as high as you can. Barrels roll down every lane — switch lanes to dodge them. Every
          {" "}{LEVEL_INTERVAL_M}m is a new level with a bonus. Height is your score. 3 lives.
        </p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START CLIMB
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="flex justify-between font-mono text-xs mb-3 text-textDim">
        <span>Height: <span className="text-textLight">{Math.round(height)}m</span> · Lvl {level}</span>
        <span>{"❤️".repeat(lives)}</span>
      </div>
      <div
        className="relative mx-auto rounded-lg overflow-hidden border border-lineColor"
        style={{ width: "min(90vw, 320px)", height: 340, background: "#0d0720" }}
      >
        {levelUpFlash && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/80 px-4 py-2 rounded-lg">LEVEL {level}!</p>
          </div>
        )}
        {Array.from({ length: LANES - 1 }).map((_, i) => (
          <div key={i} className="absolute top-0 bottom-0" style={{ left: `${((i + 1) / LANES) * 100}%`, width: 1, background: "rgba(169,159,214,0.15)" }} />
        ))}
        {barrels.map((b) => (
          <div
            key={b.id}
            className="absolute text-lg"
            style={{ left: `${(b.lane + 0.5) * (100 / LANES)}%`, top: `${b.y}%`, transform: "translate(-50%,-50%)" }}
          >
            🛢️
          </div>
        ))}
        <div className="absolute text-2xl" style={{ left: `${(lane + 0.5) * (100 / LANES)}%`, top: "85%", transform: "translate(-50%,-50%)" }}>
          🧗
        </div>
      </div>
      <div className="flex justify-center gap-4 mt-4">
        <button onClick={() => move(-1)} className="px-8 py-3 rounded-md border border-lineColor font-pixel text-xs select-none">
          ◀
        </button>
        <button onClick={() => move(1)} className="px-8 py-3 rounded-md border border-lineColor font-pixel text-xs select-none">
          ▶
        </button>
      </div>
    </div>
  );
}
