"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";

const DURATION = 25;
const HOLE_COUNT = 9;

export default function MoleRush({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [activeHole, setActiveHole] = useState(null);
  const [hits, setHits] = useState(0);
  const intervalRef = useRef(null);
  const moleTimerRef = useRef(null);
  const finishedRef = useRef(false);
  const hitsRef = useRef(0);

  useEffect(() => {
    hitsRef.current = hits;
  }, [hits]);

  useEffect(() => () => {
    clearInterval(intervalRef.current);
    clearTimeout(moleTimerRef.current);
  }, []);

  function popMole() {
    setActiveHole(Math.floor(Math.random() * HOLE_COUNT));
    const upFor = 500 + Math.random() * 500;
    moleTimerRef.current = setTimeout(() => {
      setActiveHole(null);
      moleTimerRef.current = setTimeout(popMole, 200 + Math.random() * 300);
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
    setHits((h) => h + 1);
    clearTimeout(moleTimerRef.current);
    moleTimerRef.current = setTimeout(popMole, 150 + Math.random() * 250);
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">25 seconds. Tap the mole the instant it pops up.</p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="flex justify-between font-mono text-xs mb-5 text-textDim">
        <span>Hits: <span className="text-textLight">{hits}</span></span>
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
