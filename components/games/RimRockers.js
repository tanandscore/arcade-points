"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";

const DURATION = 60;
const TICK_MS = 40;
const HOOP = { x: 50, y: 12 };
const DIFFICULTY = {
  1: { label: "EASY", mult: 1, defenderSpeed: 0.5, meterSpeed: 4.5, tolerance: 78 },
  2: { label: "MEDIUM", mult: 1.35, defenderSpeed: 0.75, meterSpeed: 5.5, tolerance: 84 },
  3: { label: "HARD", mult: 1.8, defenderSpeed: 1.0, meterSpeed: 6.8, tolerance: 89 },
};

export default function RimRockers({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [level, setLevel] = useState(1);
  const [player, setPlayer] = useState({ x: 50, y: 70 });
  const [defender, setDefender] = useState({ x: 50, y: 40 });
  const [shot, setShot] = useState(null);
  const [meterValue, setMeterValue] = useState(0);
  const [aiming, setAiming] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [flash, setFlash] = useState(null);

  const levelRef = useRef(1);
  const playerRef = useRef({ x: 50, y: 70 });
  const moveRef = useRef({ x: 0, y: 0 });
  const meterRef = useRef(0);
  const meterDirRef = useRef(1);
  const aimingRef = useRef(false);
  const scoreRef = useRef(0);
  const streakRef = useRef(0);
  const intervalRef = useRef(null);
  const timerRef = useRef(null);
  const finishedRef = useRef(false);

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(intervalRef.current);
    clearInterval(timerRef.current);
    sfx.lose();
    const mult = DIFFICULTY[levelRef.current].mult;
    onFinish(Math.round(scoreRef.current * mult));
  }

  function begin(chosenLevel) {
    levelRef.current = chosenLevel;
    setLevel(chosenLevel);
    const diff = DIFFICULTY[chosenLevel];
    setStarted(true);
    intervalRef.current = setInterval(() => {
      playerRef.current.x = Math.max(8, Math.min(92, playerRef.current.x + moveRef.current.x * 1.6));
      playerRef.current.y = Math.max(20, Math.min(88, playerRef.current.y + moveRef.current.y * 1.6));
      setPlayer({ ...playerRef.current });

      setDefender((prev) => {
        const dx = playerRef.current.x - prev.x;
        const dy = playerRef.current.y - prev.y;
        const dist = Math.hypot(dx, dy) || 1;
        return { x: prev.x + (dx / dist) * diff.defenderSpeed, y: prev.y + (dy / dist) * diff.defenderSpeed };
      });

      if (aimingRef.current) {
        meterRef.current += meterDirRef.current * diff.meterSpeed;
        if (meterRef.current >= 100) {
          meterRef.current = 100;
          meterDirRef.current = -1;
        } else if (meterRef.current <= 0) {
          meterRef.current = 0;
          meterDirRef.current = 1;
        }
        setMeterValue(meterRef.current);
      }
    }, TICK_MS);

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          finish();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  useEffect(
    () => () => {
      clearInterval(intervalRef.current);
      clearInterval(timerRef.current);
    },
    []
  );

  function startAim() {
    const distToHoop = Math.hypot(playerRef.current.x - HOOP.x, playerRef.current.y - HOOP.y);
    if (distToHoop > 55) return;
    aimingRef.current = true;
    meterRef.current = 0;
    meterDirRef.current = 1;
    setAiming(true);
    setMeterValue(0);
  }

  function releaseShot() {
    if (!aimingRef.current) return;
    aimingRef.current = false;
    setAiming(false);

    const accuracy = 100 - Math.abs(meterRef.current - 62);
    const made = accuracy > DIFFICULTY[levelRef.current].tolerance;
    const three = Math.hypot(playerRef.current.x - HOOP.x, playerRef.current.y - HOOP.y) > 40;

    setShot({ made });
    setTimeout(() => setShot(null), 500);

    if (made) {
      const points = three ? 3 : 2;
      streakRef.current += 1;
      setStreak(streakRef.current);
      const onFire = streakRef.current >= 3;
      const gained = points * (onFire ? 2 : 1);
      scoreRef.current += gained;
      setScore(scoreRef.current);
      sfx.correct();
      if (onFire) sfx.boost();
      setFlash("make");
    } else {
      streakRef.current = 0;
      setStreak(0);
      sfx.wrong();
      setFlash("miss");
    }
    setTimeout(() => setFlash(null), 250);
  }

  function setMove(x, y) {
    moveRef.current = { x, y };
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          Move toward the hoop, hold SHOOT to start the power meter, release at the right moment — the closer to
          the sweet spot, the better your odds. 3+ makes in a row and you're "on fire" for double points. 60
          seconds.
        </p>
        <p className="font-mono text-[10px] text-textDim mb-3">Choose a difficulty — higher levels score more per point.</p>
        <div className="flex justify-center gap-2">
          {[1, 2, 3].map((lvl) => (
            <button
              key={lvl}
              onClick={() => begin(lvl)}
              className="px-4 py-3 rounded-md border font-pixel text-[10px]"
              style={{ borderColor: accentColor, color: accentColor }}
            >
              LVL {lvl}
              <div className="text-[8px] text-textDim mt-1">{DIFFICULTY[lvl].label} ×{DIFFICULTY[lvl].mult}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="flex justify-between font-mono text-xs mb-3 text-textDim">
        <span>Score: <span className="text-textLight">{score}</span> · Lvl {level}</span>
        <span>{streak >= 3 ? "🔥 ON FIRE" : `Streak: ${streak}`}</span>
        <span style={{ color: timeLeft <= 10 ? "#ff3ea5" : "#a99fd6" }}>{timeLeft}s</span>
      </div>
      <div
        className="relative mx-auto rounded-lg overflow-hidden border border-lineColor"
        style={{
          width: "min(90vw, 300px)",
          height: 320,
          background: flash === "make" ? "#1a3a24" : flash === "miss" ? "#3a1a24" : "#0d0720",
        }}
      >
        <div className="absolute text-2xl" style={{ left: `${HOOP.x}%`, top: `${HOOP.y}%`, transform: "translate(-50%,-50%)" }}>
          🏀
        </div>
        <div className="absolute text-xl" style={{ left: `${defender.x}%`, top: `${defender.y}%`, transform: "translate(-50%,-50%)" }}>
          🛡️
        </div>
        <div className="absolute text-xl" style={{ left: `${player.x}%`, top: `${player.y}%`, transform: "translate(-50%,-50%)" }}>
          {shot ? (shot.made ? "🎉" : "😬") : "🏃"}
        </div>
      </div>
      {aiming && (
        <div className="max-w-[220px] mx-auto mt-3 h-3 rounded-full bg-bgPanel3 overflow-hidden border border-lineColor relative">
          <div className="absolute top-0 bottom-0" style={{ left: "58%", width: "8%", background: "rgba(255,183,3,0.4)" }} />
          <div className="h-full transition-none" style={{ width: `${meterValue}%`, background: accentColor }} />
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 max-w-[220px] mx-auto mt-4">
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
          onMouseDown={startAim}
          onMouseUp={releaseShot}
          onTouchStart={startAim}
          onTouchEnd={releaseShot}
          className="py-2.5 rounded-md font-pixel text-[9px] text-bgDeep select-none"
          style={{ background: accentColor }}
        >
          SHOOT
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
