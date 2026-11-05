"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const DURATION = 25;
const HOLE_COUNT = 9;
const HITS_PER_LEVEL = 10;
const LEVEL_BONUS_SECONDS = 5;

export default function MoleRush({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [activeHole, setActiveHole] = useState(null);
  const [hits, setHits] = useState(0);
  const [level, setLevel] = useState(1);
  const [levelUpFlash, setLevelUpFlash] = useState(false);
  const intervalRef = useRef(null);
  const moleTimerRef = useRef(null);
  const finishedRef = useRef(false);
  const hitsRef = useRef(0);
  const levelRef = useRef(1);

  useEffect(() => {
    hitsRef.current = hits;
  }, [hits]);

  useEffect(() => () => {
    clearInterval(intervalRef.current);
    clearTimeout(moleTimerRef.current);
  }, []);

  function popMole() {
    const speedUp = Math.min(300, (levelRef.current - 1) * 45);
    setActiveHole(Math.floor(Math.random() * HOLE_COUNT));
    const upFor = Math.max(220, 500 - speedUp) + Math.random() * Math.max(200, 500 - speedUp);
    moleTimerRef.current = setTimeout(() => {
      setActiveHole(null);
      moleTimerRef.current = setTimeout(popMole, Math.max(80, 200 - speedUp * 0.4) + Math.random() * 300);
    }, upFor);
  }

  function begin() {
    setStarted(true);
    popMole();
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current);
          clearTimeout(moleTimerRef.current);
          if (!finishedRef.current) {
            finishedRef.current = true;
            onFinish(hitsRef.current * 10);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  function whack(idx) {
    if (idx !== activeHole) return;
    sfx.hit();
    setActiveHole(null);
    const nextHits = hits + 1;
    setHits(nextHits);

    const newLevel = Math.floor(nextHits / HITS_PER_LEVEL) + 1;
    if (newLevel > levelRef.current) {
      levelRef.current = newLevel;
      setLevel(newLevel);
      setTimeLeft((t) => t + LEVEL_BONUS_SECONDS);
      sfx.levelUp();
      haptics.success();
      setLevelUpFlash(true);
      setTimeout(() => setLevelUpFlash(false), 900);
    }

    clearTimeout(moleTimerRef.current);
    moleTimerRef.current = setTimeout(popMole, 150 + Math.random() * 250);
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          25 seconds. Tap the mole the instant it pops up. Every {HITS_PER_LEVEL} hits is a level — earns bonus time
          and speeds the moles up.
        </p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START
        </button>
      </div>
    );
  }

  return (
    <div className="text-center relative">
      {levelUpFlash && (
        <div className="absolute inset-x-0 -top-2 z-10 flex items-center justify-center pointer-events-none">
          <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/80 px-4 py-2 rounded-lg">LEVEL {level}! +{LEVEL_BONUS_SECONDS}s</p>
        </div>
      )}
      <div className="flex justify-between font-mono text-xs mb-5 text-textDim">
        <span>Hits: <span className="text-textLight">{hits}</span> · Lvl {level}</span>
        <span style={{ color: timeLeft <= 5 ? "#ff3ea5" : "#a99fd6" }}>Time left: {timeLeft}s</span>
      </div>
      <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
        {Array.from({ length: HOLE_COUNT }).map((_, i) => (
          <button
            key={i}
            onClick={() => whack(i)}
            className="aspect-square rounded-full flex items-center justify-center text-2xl border transition-transform"
            style={{
              background: "#241154",
              borderColor: "rgba(169,159,214,0.22)",
              transform: activeHole === i ? "scale(1.05)" : "scale(1)",
            }}
          >
            {activeHole === i ? "🐹" : ""}
          </button>
        ))}
      </div>
    </div>
  );
}
