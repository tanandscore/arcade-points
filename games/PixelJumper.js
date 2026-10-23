"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const TICK_MS = 30;
const GROUND_Y = 78;
const GRAVITY = 1.1;
const JUMP_VELOCITY = -13;
const LEVEL_INTERVAL_M = 200;

export default function PixelJumper({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [playerY, setPlayerY] = useState(GROUND_Y);
  const [obstacles, setObstacles] = useState([]);
  const [distance, setDistance] = useState(0);
  const [level, setLevel] = useState(1);
  const [levelUpFlash, setLevelUpFlash] = useState(false);
  const velocityRef = useRef(0);
  const playerYRef = useRef(GROUND_Y);
  const distanceRef = useRef(0);
  const levelRef = useRef(1);
  const bonusRef = useRef(0);
  const finishedRef = useRef(false);
  const intervalRef = useRef(null);
  const spawnCounterRef = useRef(0);
  const speedRef = useRef(3.2);

  function jump() {
    if (playerYRef.current >= GROUND_Y - 0.5) {
      velocityRef.current = JUMP_VELOCITY;
    }
  }

  useEffect(() => {
    function handleKey(e) {
      if (e.code === "Space" || e.key === "ArrowUp") {
        e.preventDefault();
        jump();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  function begin() {
    setStarted(true);
    intervalRef.current = setInterval(() => {
      velocityRef.current += GRAVITY;
      let nextY = playerYRef.current + velocityRef.current;
      if (nextY > GROUND_Y) {
        nextY = GROUND_Y;
        velocityRef.current = 0;
      }
      playerYRef.current = nextY;
      setPlayerY(nextY);

      setObstacles((prev) => {
        let next = prev.map((o) => ({ ...o, x: o.x - speedRef.current })).filter((o) => o.x > -10);
        spawnCounterRef.current += 1;
        if (spawnCounterRef.current > 55) {
          spawnCounterRef.current = 0;
          next = [...next, { id: Math.random(), x: 105 }];
        }
        const collided = next.some((o) => o.x > 12 && o.x < 24 && playerYRef.current > GROUND_Y - 14);
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
      speedRef.current = Math.min(7.5, speedRef.current + 0.003);

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
  }

  useEffect(() => () => clearInterval(intervalRef.current), []);

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          Tap, click, or press Space to jump over obstacles. Survive as long as you can. Every {LEVEL_INTERVAL_M}m
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
        onClick={jump}
        className="relative mx-auto rounded-lg overflow-hidden border border-lineColor cursor-pointer select-none"
        style={{ width: "min(90vw, 360px)", height: "220px", background: "#12092b" }}
      >
        {levelUpFlash && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/80 px-4 py-2 rounded-lg">LEVEL {level}!</p>
          </div>
        )}
        <div className="absolute left-0 right-0" style={{ top: `${GROUND_Y + 14}%`, height: "1px", background: "rgba(169,159,214,0.3)" }} />
        <div
          className="absolute rounded-sm"
          style={{ left: "12%", width: "9%", aspectRatio: "1/1", top: `${playerY}%`, background: accentColor, transform: "translateY(-100%)" }}
        />
        {obstacles.map((o) => (
          <div
            key={o.id}
            className="absolute rounded-sm"
            style={{ left: `${o.x}%`, width: "6%", height: "18%", top: `${GROUND_Y}%`, background: "#ff3ea5", transform: "translateY(-100%)" }}
          />
        ))}
      </div>
      <p className="font-mono text-[10px] mt-3 text-textDim">Tap the box, or press Space</p>
    </div>
  );
}
