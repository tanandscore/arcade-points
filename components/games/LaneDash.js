"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";

const LANES = 3;
const TICK_MS = 40;

export default function LaneDash({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [lane, setLane] = useState(1);
  const [obstacles, setObstacles] = useState([]);
  const [distance, setDistance] = useState(0);
  const [speed, setSpeed] = useState(3.5);
  const laneRef = useRef(1);
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
          .map((o) => ({ ...o, y: o.y + speed }))
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
          onFinish(Math.round(distance));
        }
        return next;
      });
      setDistance((d) => d + speed / 3);
      setSpeed((s) => Math.min(9, s + 0.004));
    }, TICK_MS);
    return () => clearInterval(intervalRef.current);
  }

  useEffect(() => () => clearInterval(intervalRef.current), []);

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">Use ← → (or the buttons below) to switch lanes. Dodge everything coming at you.</p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="font-mono text-xs mb-3 text-textDim">
        Distance: <span className="text-textLight">{Math.round(distance)}m</span>
      </p>
      <div
        className="relative mx-auto rounded-lg overflow-hidden border border-lineColor"
        style={{ width: "min(90vw, 300px)", height: "360px", background: "#12092b" }}
      >
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
