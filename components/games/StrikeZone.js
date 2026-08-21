"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";

const DURATION = 35;
const MAX_ACTIVE = 2;

function randomTarget() {
  return {
    id: Math.random(),
    x: 10 + Math.random() * 75,
    y: 12 + Math.random() * 70,
    isHostile: Math.random() < 0.7,
    bornAt: performance.now(),
    lifespan: 850 + Math.random() * 500,
  };
}

export default function StrikeZone({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [targets, setTargets] = useState([]);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [flash, setFlash] = useState(null);
  const timerRef = useRef(null);
  const spawnRef = useRef(null);
  const tickRef = useRef(null);
  const finishedRef = useRef(false);
  const hitsRef = useRef(0);
  const missesRef = useRef(0);

  useEffect(() => {
    hitsRef.current = hits;
  }, [hits]);
  useEffect(() => {
    missesRef.current = misses;
  }, [misses]);

  useEffect(
    () => () => {
      clearInterval(timerRef.current);
      clearInterval(spawnRef.current);
      clearInterval(tickRef.current);
    },
    []
  );

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(timerRef.current);
    clearInterval(spawnRef.current);
    clearInterval(tickRef.current);
    const score = Math.max(0, hitsRef.current * 10 - missesRef.current * 15);
    onFinish(score);
  }

  function begin() {
    setStarted(true);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          finish();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    spawnRef.current = setInterval(() => {
      setTargets((prev) => (prev.length < MAX_ACTIVE ? [...prev, randomTarget()] : prev));
    }, 550);

    // expire targets whose lifespan has run out, no penalty either way
    tickRef.current = setInterval(() => {
      const now = performance.now();
      setTargets((prev) => prev.filter((t) => now - t.bornAt < t.lifespan));
    }, 100);
  }

  function handleHit(target) {
    setTargets((prev) => prev.filter((t) => t.id !== target.id));
    if (target.isHostile) {
      sfx.hit();
      setHits((h) => h + 1);
      setFlash("hit");
    } else {
      sfx.wrong();
      setMisses((m) => m + 1);
      setFlash("civilian");
    }
    setTimeout(() => setFlash(null), 150);
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          35 seconds. Tap the red hostile targets fast — but leave the green civilian targets alone, or it'll cost
          you.
        </p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="flex justify-between font-mono text-xs mb-4 text-textDim">
        <span>
          Hits: <span className="text-textLight">{hits}</span> · Civilians hit:{" "}
          <span className="text-accentMagenta">{misses}</span>
        </span>
        <span style={{ color: timeLeft <= 8 ? "#ff3ea5" : "#a99fd6" }}>Time left: {timeLeft}s</span>
      </div>

      <div
        className="relative mx-auto rounded-lg border overflow-hidden"
        style={{
          width: "min(90vw, 340px)",
          height: "300px",
          borderColor: "rgba(169,159,214,0.22)",
          background: flash === "hit" ? "#113a2c" : flash === "civilian" ? "#3a1130" : "#12092b",
          transition: "background 0.1s",
        }}
      >
        {targets.map((t) => (
          <button
            key={t.id}
            onClick={() => handleHit(t)}
            className="absolute rounded-full flex items-center justify-center text-xl border-2"
            style={{
              left: `${t.x}%`,
              top: `${t.y}%`,
              width: "46px",
              height: "46px",
              transform: "translate(-50%, -50%)",
              background: t.isHostile ? "#ff5a3c33" : "#3ee6e033",
              borderColor: t.isHostile ? "#ff5a3c" : "#3ee6e0",
            }}
          >
            {t.isHostile ? "🎯" : "🙂"}
          </button>
        ))}
      </div>
      <p className="font-mono text-[10px] mt-3 text-textDim">
        <span style={{ color: "#ff5a3c" }}>● hostile — shoot</span> &nbsp; <span style={{ color: "#3ee6e0" }}>● civilian — hold fire</span>
      </p>
    </div>
  );
}
