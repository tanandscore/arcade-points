"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";

const DURATION = 40;
const TICK_MS = 40;
const SWEET_START = 62;
const SWEET_END = 88;

export default function TurboCircuit({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [needle, setNeedle] = useState(0);
  const [speed, setSpeed] = useState(30);
  const [distance, setDistance] = useState(0);
  const [flash, setFlash] = useState(null);
  const directionRef = useRef(1);
  const needleRef = useRef(0);
  const speedRef = useRef(30);
  const intervalRef = useRef(null);
  const finishedRef = useRef(false);
  const distanceRef = useRef(0);

  useEffect(() => () => clearInterval(intervalRef.current), []);

  function begin() {
    setStarted(true);
    intervalRef.current = setInterval(() => {
      // sweep the needle back and forth
      needleRef.current += directionRef.current * 3.2;
      if (needleRef.current >= 100) {
        needleRef.current = 100;
        directionRef.current = -1;
      } else if (needleRef.current <= 0) {
        needleRef.current = 0;
        directionRef.current = 1;
      }
      setNeedle(needleRef.current);

      // speed slowly decays, distance accumulates based on current speed
      speedRef.current = Math.max(15, speedRef.current - 0.15);
      setSpeed(speedRef.current);
      distanceRef.current += speedRef.current / 25;
      setDistance(distanceRef.current);
    }, TICK_MS);

    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current);
          clearInterval(timer);
          if (!finishedRef.current) {
            finishedRef.current = true;
            onFinish(Math.round(distanceRef.current));
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  function shift() {
    if (!started || timeLeft === 0) return;
    const inSweetSpot = needleRef.current >= SWEET_START && needleRef.current <= SWEET_END;
    if (inSweetSpot) {
      sfx.boost();
      speedRef.current = Math.min(100, speedRef.current + 18);
      setFlash("boost");
    } else {
      sfx.wrong();
      speedRef.current = Math.max(10, speedRef.current - 12);
      setFlash("skid");
    }
    setSpeed(speedRef.current);
    setTimeout(() => setFlash(null), 200);
  }

  useEffect(() => {
    function handleKey(e) {
      if (e.code === "Space") {
        e.preventDefault();
        shift();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          A needle sweeps the gauge. Tap SHIFT (or press Space) the instant it's in the green zone to boost your
          speed. Miss the zone and you'll skid. 40 seconds — cover as much distance as you can.
        </p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START RACE
        </button>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="flex justify-between font-mono text-xs mb-6 text-textDim">
        <span>Distance: <span className="text-textLight">{Math.round(distance)}m</span></span>
        <span style={{ color: timeLeft <= 8 ? "#ff3ea5" : "#a99fd6" }}>Time left: {timeLeft}s</span>
      </div>

      <div
        className="relative mx-auto rounded-full mb-2"
        style={{ width: "min(85vw, 280px)", height: "24px", background: "#241154", overflow: "hidden" }}
      >
        <div
          className="absolute top-0 bottom-0"
          style={{ left: `${SWEET_START}%`, width: `${SWEET_END - SWEET_START}%`, background: "#16c78455" }}
        />
        <div
          className="absolute top-0 bottom-0 rounded-full"
          style={{ left: `calc(${needle}% - 3px)`, width: "6px", background: accentColor }}
        />
      </div>
      <p className="font-mono text-[10px] mb-6 text-textDim">green zone = boost</p>

      <div
        className="rounded-xl border py-8 text-center mb-5 border-lineColor transition-colors"
        style={{ background: flash === "boost" ? "#113a2c" : flash === "skid" ? "#3a1130" : "#2a1560" }}
      >
        <p className="font-mono text-[10px] text-textDim mb-1">SPEED</p>
        <p className="font-pixel text-2xl" style={{ color: accentColor }}>
          {Math.round(speed)}
        </p>
      </div>

      <button onClick={shift} className="font-pixel text-[10px] px-8 py-3.5 rounded-md text-bgDeep" style={{ background: accentColor }}>
        SHIFT ▸
      </button>
    </div>
  );
}
