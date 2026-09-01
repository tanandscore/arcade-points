"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";

const MAX_HP = 100;
const ROUNDS_TO_WIN = 2;
const PUNCH_DMG = 6;
const KICK_DMG = 11;
const PUNCH_COOLDOWN = 350;
const KICK_COOLDOWN = 650;
const DIFFICULTY = {
  1: { label: "CADET", mult: 1, aiActionEvery: 19, blockChance: 0.25, dmgMult: 0.8 },
  2: { label: "ROOKIE", mult: 1.2, aiActionEvery: 16, blockChance: 0.35, dmgMult: 0.9 },
  3: { label: "VETERAN", mult: 1.45, aiActionEvery: 12, blockChance: 0.46, dmgMult: 1 },
  4: { label: "CHAMPION", mult: 1.75, aiActionEvery: 9, blockChance: 0.56, dmgMult: 1.12 },
  5: { label: "MASTER", mult: 2.1, aiActionEvery: 6, blockChance: 0.65, dmgMult: 1.25 },
  6: { label: "LEGEND", mult: 2.5, aiActionEvery: 4, blockChance: 0.72, dmgMult: 1.4 },
};

export default function DuelArena({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [level, setLevel] = useState(1);
  const [distance, setDistance] = useState(60);
  const [myHp, setMyHp] = useState(MAX_HP);
  const [aiHp, setAiHp] = useState(MAX_HP);
  const [myWins, setMyWins] = useState(0);
  const [aiWins, setAiWins] = useState(0);
  const [blocking, setBlocking] = useState(false);
  const [aiBlocking, setAiBlocking] = useState(false);
  const [log, setLog] = useState("Close the distance, then strike.");
  const [gameOver, setGameOver] = useState(false);
  const [flash, setFlash] = useState(null);

  const levelRef = useRef(1);
  const distanceRef = useRef(60);
  const myHpRef = useRef(MAX_HP);
  const aiHpRef = useRef(MAX_HP);
  const myWinsRef = useRef(0);
  const aiWinsRef = useRef(0);
  const blockingRef = useRef(false);
  const aiBlockingRef = useRef(false);
  const moveRef = useRef(0);
  const lastPunchRef = useRef(0);
  const lastKickRef = useRef(0);
  const aiTimerRef = useRef(0);
  const intervalRef = useRef(null);
  const finishedRef = useRef(false);

  function finishMatch() {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(intervalRef.current);
    const won = myWinsRef.current > aiWinsRef.current;
    sfx[won ? "newBest" : "lose"]();
    const score = myWinsRef.current * 200 + Math.round((myHpRef.current / MAX_HP) * 100);
    const mult = DIFFICULTY[levelRef.current].mult;
    setTimeout(() => onFinish(Math.max(0, Math.round(score * mult))), 900);
  }

  function startRound() {
    myHpRef.current = MAX_HP;
    aiHpRef.current = MAX_HP;
    setMyHp(MAX_HP);
    setAiHp(MAX_HP);
    distanceRef.current = 60;
    setDistance(60);
  }

  function begin(chosenLevel) {
    levelRef.current = chosenLevel;
    setLevel(chosenLevel);
    setStarted(true);
    const diff = DIFFICULTY[chosenLevel];
    intervalRef.current = setInterval(() => {
      distanceRef.current = Math.max(0, Math.min(100, distanceRef.current + moveRef.current * 1.4));
      setDistance(distanceRef.current);

      aiTimerRef.current += 1;
      if (aiTimerRef.current > diff.aiActionEvery) {
        aiTimerRef.current = 0;
        if (distanceRef.current > 25) {
          distanceRef.current = Math.max(0, distanceRef.current - 3);
        } else if (Math.random() < diff.blockChance) {
          aiBlockingRef.current = true;
          setAiBlocking(true);
          setTimeout(() => {
            aiBlockingRef.current = false;
            setAiBlocking(false);
          }, 500);
        } else {
          const dmg = Math.round((Math.random() < 0.5 ? PUNCH_DMG : KICK_DMG) * diff.dmgMult);
          const actual = blockingRef.current ? Math.round(dmg * 0.3) : dmg;
          myHpRef.current = Math.max(0, myHpRef.current - actual);
          setMyHp(myHpRef.current);
          setFlash("me");
          setTimeout(() => setFlash(null), 150);
          sfx.hit();
          if (myHpRef.current <= 0) endRound(false);
        }
      }
    }, 55);
  }

  function endRound(playerWon) {
    if (playerWon) {
      myWinsRef.current += 1;
      setMyWins(myWinsRef.current);
      sfx.win();
    } else {
      aiWinsRef.current += 1;
      setAiWins(aiWinsRef.current);
      sfx.wrong();
    }
    if (myWinsRef.current >= ROUNDS_TO_WIN || aiWinsRef.current >= ROUNDS_TO_WIN) {
      setLog(myWinsRef.current > aiWinsRef.current ? "Victory!" : "Defeated.");
      setGameOver(true);
      finishMatch();
    } else {
      setLog(playerWon ? "Round won! Next round." : "Round lost. Next round.");
      setTimeout(startRound, 900);
    }
  }

  useEffect(() => () => clearInterval(intervalRef.current), []);

  function attack(type) {
    if (gameOver) return;
    const now = Date.now();
    const cooldown = type === "punch" ? PUNCH_COOLDOWN : KICK_COOLDOWN;
    const lastRef = type === "punch" ? lastPunchRef : lastKickRef;
    if (now - lastRef.current < cooldown) return;
    if (distanceRef.current > 22) {
      setLog("Get closer first.");
      return;
    }
    lastRef.current = now;
    const dmg = type === "punch" ? PUNCH_DMG : KICK_DMG;
    const actual = aiBlockingRef.current ? Math.round(dmg * 0.3) : dmg;
    aiHpRef.current = Math.max(0, aiHpRef.current - actual);
    setAiHp(aiHpRef.current);
    sfx.correct();
    setLog(type === "punch" ? "Quick punch!" : "Heavy kick!");
    if (aiHpRef.current <= 0) endRound(true);
  }

  function setMove(dir) {
    moveRef.current = dir;
  }

  function setBlock(value) {
    blockingRef.current = value;
    setBlocking(value);
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          Best of 3 rounds. Close the distance, then Punch (fast, light) or Kick (slow, heavy). Hold Block to cut
          incoming damage. The AI attacks and blocks too — watch its stance.
        </p>
        <p className="font-mono text-[10px] text-textDim mb-3">Choose an opponent — tougher fighters score more per point.</p>
        <div className="grid grid-cols-3 gap-2 max-w-[280px] mx-auto">
          {[1, 2, 3, 4, 5, 6].map((lvl) => (
            <button
              key={lvl}
              onClick={() => begin(lvl)}
              className="px-3 py-2.5 rounded-md border font-pixel text-[9px]"
              style={{ borderColor: accentColor, color: accentColor }}
            >
              LVL {lvl}
              <div className="text-[7px] text-textDim mt-1">{DIFFICULTY[lvl].label} ×{DIFFICULTY[lvl].mult}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <p className="font-mono text-xs mb-3 text-textDim">
        Lvl {level} · Wins — You: {myWins} · Opponent: {aiWins}
      </p>
      <div className="flex justify-between mb-2 max-w-xs mx-auto">
        <div className="w-[45%]">
          <div className="h-2.5 rounded-full bg-bgDeep border border-lineColor overflow-hidden">
            <div className="h-full" style={{ width: `${(myHp / MAX_HP) * 100}%`, background: flash === "me" ? "#ff3ea5" : accentColor }} />
          </div>
          <p className="font-mono text-[9px] text-textDim mt-1">YOU {blocking ? "🛡️" : ""}</p>
        </div>
        <div className="w-[45%]">
          <div className="h-2.5 rounded-full bg-bgDeep border border-lineColor overflow-hidden">
            <div className="h-full bg-accentMagenta" style={{ width: `${(aiHp / MAX_HP) * 100}%` }} />
          </div>
          <p className="font-mono text-[9px] text-textDim mt-1">OPPONENT {aiBlocking ? "🛡️" : ""}</p>
        </div>
      </div>
      <div
        className="relative mx-auto rounded-lg overflow-hidden border border-lineColor mb-4"
        style={{ width: "min(90vw, 320px)", height: 140, background: "#0d0720" }}
      >
        <div className="absolute text-3xl" style={{ left: `${50 - distance / 2.2}%`, top: "50%", transform: "translate(-50%,-50%)" }}>
          🥋
        </div>
        <div className="absolute text-3xl" style={{ left: `${50 + distance / 2.2}%`, top: "50%", transform: "translate(-50%,-50%)" }}>
          🤼
        </div>
      </div>
      <p className="font-mono text-[11px] mb-3 h-5" style={{ color: accentColor }}>{log}</p>
      <div className="flex justify-center gap-2 flex-wrap">
        <button
          onMouseDown={() => setMove(-1)}
          onMouseUp={() => setMove(0)}
          onMouseLeave={() => setMove(0)}
          onTouchStart={() => setMove(-1)}
          onTouchEnd={() => setMove(0)}
          className="px-5 py-3 rounded-md border border-lineColor font-pixel text-xs select-none"
        >
          ◀ CLOSE
        </button>
        <button onClick={() => attack("punch")} className="px-5 py-3 rounded-md font-pixel text-[10px] text-bgDeep" style={{ background: accentColor }}>
          PUNCH
        </button>
        <button onClick={() => attack("kick")} className="px-5 py-3 rounded-md font-pixel text-[10px] text-bgDeep" style={{ background: "#ffb703" }}>
          KICK
        </button>
        <button
          onMouseDown={() => setBlock(true)}
          onMouseUp={() => setBlock(false)}
          onMouseLeave={() => setBlock(false)}
          onTouchStart={() => setBlock(true)}
          onTouchEnd={() => setBlock(false)}
          className="px-5 py-3 rounded-md border font-pixel text-[10px] select-none"
          style={{ borderColor: "#3ee6e0", color: "#3ee6e0" }}
        >
          🛡️ BLOCK
        </button>
      </div>
    </div>
  );
}
