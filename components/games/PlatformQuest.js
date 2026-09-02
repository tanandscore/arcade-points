"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const TICK_MS = 30;
const GROUND_Y = 78;
const AIR_THRESHOLD = 55; // player counts as "airborne enough to stomp" above this y%
const GRAVITY = 1.05;
const JUMP_VELOCITY = -14;
const LEVEL_INTERVAL_M = 200;

export default function PlatformQuest({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [playerY, setPlayerY] = useState(GROUND_Y);
  const [entities, setEntities] = useState([]);
  const [distance, setDistance] = useState(0);
  const [coins, setCoins] = useState(0);
  const [stomps, setStomps] = useState(0);
  const [level, setLevel] = useState(1);
  const [levelUpFlash, setLevelUpFlash] = useState(false);
  const velocityRef = useRef(0);
  const playerYRef = useRef(GROUND_Y);
  const finishedRef = useRef(false);
  const intervalRef = useRef(null);
  const spawnCounterRef = useRef(0);
  const speedRef = useRef(3.4);
  const coinsRef = useRef(0);
  const stompsRef = useRef(0);
  const distanceRef = useRef(0);
  const levelRef = useRef(1);
  const bonusRef = useRef(0);

  function jump() {
    if (playerYRef.current >= GROUND_Y - 0.5) {
      velocityRef.current = JUMP_VELOCITY;
      sfx.tap();
    }
  }

  function bounce() {
    velocityRef.current = JUMP_VELOCITY * 0.6;
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

  function finish() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(intervalRef.current);
    const score = Math.round(distanceRef.current) + coinsRef.current * 10 + stompsRef.current * 50 + bonusRef.current;
    sfx.lose();
    onFinish(score);
  }

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

      setEntities((prev) => {
        let next = prev.map((e) => ({ ...e, x: e.x - speedRef.current })).filter((e) => e.x > -10 && !e.gone);

        spawnCounterRef.current += 1;
        if (spawnCounterRef.current > 48) {
          spawnCounterRef.current = 0;
          const roll = Math.random();
          const type = roll < 0.4 ? "pit" : roll < 0.75 ? "enemy" : "coin";
          next = [...next, { id: Math.random(), x: 105, type, gone: false }];
        }

        for (const e of next) {
          const overlapping = e.x > 11 && e.x < 23;
          if (!overlapping || e.gone) continue;

          if (e.type === "pit" && playerYRef.current >= GROUND_Y - 0.5) {
            e.gone = true;
            finish();
          } else if (e.type === "enemy") {
            const airborne = playerYRef.current < AIR_THRESHOLD;
            if (airborne) {
              e.gone = true;
              stompsRef.current += 1;
              setStomps(stompsRef.current);
              sfx.correct();
              bounce();
            } else {
              e.gone = true;
              finish();
            }
          } else if (e.type === "coin") {
            const reachable = playerYRef.current < AIR_THRESHOLD + 10;
            if (reachable) {
              e.gone = true;
              coinsRef.current += 1;
              setCoins(coinsRef.current);
              sfx.select();
            }
          }
        }

        return next.filter((e) => !e.gone);
      });

      distanceRef.current += speedRef.current / 3;
      setDistance(distanceRef.current);
      speedRef.current = Math.min(7.8, speedRef.current + 0.0025);

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
          Tap, click, or press Space to jump. Jump ON enemies to stomp them — walking into one on the ground ends the
          run. Grab coins mid-air. Every {LEVEL_INTERVAL_M}m is a new level with a bonus.
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
        <span>🪙 <span className="text-textLight">{coins}</span></span>
        <span>Distance: <span className="text-textLight">{Math.round(distance)}m</span> · Lvl {level}</span>
        <span>👣 <span className="text-textLight">{stomps}</span></span>
      </div>
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
        {entities.map((e) => (
          <div
            key={e.id}
            className="absolute flex items-center justify-center text-sm rounded-sm"
            style={{
              left: `${e.x}%`,
              width: "7%",
              height: e.type === "pit" ? "5%" : "16%",
              top: e.type === "coin" ? `${AIR_THRESHOLD}%` : `${GROUND_Y}%`,
              background: e.type === "pit" ? "#12092b" : e.type === "enemy" ? "#ff3ea5" : "transparent",
              border: e.type === "pit" ? "2px dashed #ff5a3c" : "none",
              transform: "translateY(-100%)",
            }}
          >
            {e.type === "coin" ? "🪙" : e.type === "enemy" ? "👾" : ""}
          </div>
        ))}
      </div>
      <p className="font-mono text-[10px] mt-3 text-textDim">Tap the box, or press Space</p>
    </div>
  );
}
