"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const TICK_MS = 45;
const START_BARS = 3;

function freshBars(count, speedMult) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 15 + (i * 70) / Math.max(1, count - 1 || 1),
    period: (900 + Math.random() * 500) / speedMult,
    phase: Math.random() * 1000,
    openFor: 0.45,
  }));
}

export default function PulseMaze({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [player, setPlayer] = useState({ x: 8, y: 50 });
  const [bars, setBars] = useState(() => freshBars(START_BARS, 1));
  const [clock, setClock] = useState(0);
  const [lives, setLives] = useState(3);
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [levelUpFlash, setLevelUpFlash] = useState(false);

  const playerRef = useRef({ x: 8, y: 50 });
  const moveRef = useRef({ x: 0, y: 0 });
  const barsRef = useRef(bars);
  const clockRef = useRef(0);
  const livesRef = useRef(3);
  const scoreRef = useRef(0);
  const levelRef = useRef(1);
  const speedMultRef = useRef(1);
  const invulnRef = useRef(0);
  const intervalRef = useRef(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    barsRef.current = bars;
  }, [bars]);

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(intervalRef.current);
    sfx.lose();
    onFinish(scoreRef.current);
  }

  function isBarSafe(bar, t) {
    const phaseProgress = ((t + bar.phase) % bar.period) / bar.period;
    return phaseProgress < bar.openFor;
  }

  function advanceLevel() {
    scoreRef.current += 80 * levelRef.current;
    setScore(scoreRef.current);
    levelRef.current += 1;
    setLevel(levelRef.current);
    speedMultRef.current = Math.min(2.2, speedMultRef.current + 0.12);
    const nextBars = freshBars(START_BARS + Math.min(4, levelRef.current - 1), speedMultRef.current);
    barsRef.current = nextBars;
    setBars(nextBars);
    playerRef.current = { x: 8, y: 50 };
    setPlayer({ x: 8, y: 50 });
    sfx.levelUp();
    haptics.success();
    setLevelUpFlash(true);
    setTimeout(() => setLevelUpFlash(false), 1000);
  }

  function begin() {
    setStarted(true);
    intervalRef.current = setInterval(() => {
      clockRef.current += TICK_MS;
      setClock(clockRef.current);

      playerRef.current.x = Math.max(3, Math.min(97, playerRef.current.x + moveRef.current.x * 2.2));
      playerRef.current.y = Math.max(6, Math.min(94, playerRef.current.y + moveRef.current.y * 2.2));
      setPlayer({ ...playerRef.current });
      if (invulnRef.current > 0) invulnRef.current -= 1;

      if (playerRef.current.x > 93) {
        advanceLevel();
        return;
      }

      if (invulnRef.current === 0) {
        const dangerBar = barsRef.current.find(
          (b) => Math.abs(b.x - playerRef.current.x) < 3.2 && !isBarSafe(b, clockRef.current)
        );
        if (dangerBar) {
          sfx.wrong();
          livesRef.current -= 1;
          setLives(livesRef.current);
          invulnRef.current = 25;
          playerRef.current.x = Math.max(3, playerRef.current.x - 8);
          if (livesRef.current <= 0) {
            finish();
            return;
          }
        }
      }
    }, TICK_MS);
  }

  useEffect(() => () => clearInterval(intervalRef.current), []);

  function setMove(x, y) {
    moveRef.current = { x, y };
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          Cross from left to right. The vertical bars pulse between safe (dim) and dangerous (bright) — time your
          crossing to slip through while each bar is dim. Reach the far side and a harder field starts immediately,
          with your score carried forward.
        </p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="flex justify-between font-mono text-xs mb-3 text-textDim">
        <span>Score: <span className="text-textLight">{score}</span> · Lvl {level}</span>
        <span>{"❤️".repeat(lives)}</span>
      </div>
      <div
        className="relative mx-auto rounded-lg overflow-hidden border border-lineColor"
        style={{ width: "min(90vw, 340px)", height: 300, background: "#0d0720" }}
      >
        {levelUpFlash && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/80 px-4 py-2 rounded-lg">LEVEL {level}!</p>
          </div>
        )}
        {bars.map((b) => {
          const safe = isBarSafe(b, clock);
          return (
            <div
              key={b.id}
              className="absolute top-0 bottom-0 transition-colors"
              style={{ left: `${b.x}%`, width: "6px", marginLeft: "-3px", background: safe ? "rgba(62,230,224,0.25)" : "#ff3ea5" }}
            />
          );
        })}
        <div
          className="absolute w-5 h-5 rounded-full"
          style={{
            left: `${player.x}%`,
            top: `${player.y}%`,
            transform: "translate(-50%,-50%)",
            background: accentColor,
            opacity: invulnRef.current > 0 ? 0.5 : 1,
          }}
        />
        <div className="absolute top-0 bottom-0 right-2 w-1 rounded-full" style={{ background: "#ffb70355" }} />
      </div>
      <div className="grid grid-cols-3 gap-2 max-w-[180px] mx-auto mt-4">
        <div />
        <button
          onMouseDown={() => setMove(0, -1)}
          onMouseUp={() => setMove(0, 0)}
          onMouseLeave={() => setMove(0, 0)}
          onTouchStart={() => setMove(0, -1)}
          onTouchEnd={() => setMove(0, 0)}
          className="py-2.5 rounded-md border border-lineColor"
        >
          ▲
        </button>
        <div />
        <button
          onMouseDown={() => setMove(-1, 0)}
          onMouseUp={() => setMove(0, 0)}
          onMouseLeave={() => setMove(0, 0)}
          onTouchStart={() => setMove(-1, 0)}
          onTouchEnd={() => setMove(0, 0)}
          className="py-2.5 rounded-md border border-lineColor"
        >
          ◀
        </button>
        <button
          onMouseDown={() => setMove(1, 0)}
          onMouseUp={() => setMove(0, 0)}
          onMouseLeave={() => setMove(0, 0)}
          onTouchStart={() => setMove(1, 0)}
          onTouchEnd={() => setMove(0, 0)}
          className="py-2.5 rounded-md border border-lineColor"
        >
          ▶
        </button>
        <div />
        <button
          onMouseDown={() => setMove(0, 1)}
          onMouseUp={() => setMove(0, 0)}
          onMouseLeave={() => setMove(0, 0)}
          onTouchStart={() => setMove(0, 1)}
          onTouchEnd={() => setMove(0, 0)}
          className="py-2.5 rounded-md border border-lineColor"
        >
          ▼
        </button>
        <div />
      </div>
    </div>
  );
}
