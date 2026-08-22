"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const DURATION = 25;
const CORRECT_PER_LEVEL = 10;
const LEVEL_BONUS_SECONDS = 5;
const COLORS = [
  { name: "RED", hex: "#ff3ea5" },
  { name: "CYAN", hex: "#3ee6e0" },
  { name: "AMBER", hex: "#ffb703" },
  { name: "LIME", hex: "#b6ff3e" },
];

function randomRound() {
  const word = COLORS[Math.floor(Math.random() * COLORS.length)];
  const isMatch = Math.random() < 0.5;
  const color = isMatch ? word : COLORS.filter((c) => c.name !== word.name)[Math.floor(Math.random() * 3)];
  return { word: word.name, colorHex: color.hex, isMatch };
}

export default function ColorRush({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [round, setRound] = useState(randomRound);
  const [correct, setCorrect] = useState(0);
  const [level, setLevel] = useState(1);
  const [flash, setFlash] = useState(null);
  const [levelUpFlash, setLevelUpFlash] = useState(false);
  const intervalRef = useRef(null);
  const finishedRef = useRef(false);
  const correctRef = useRef(0);
  const levelRef = useRef(1);

  useEffect(() => () => clearInterval(intervalRef.current), []);
  useEffect(() => {
    correctRef.current = correct;
  }, [correct]);

  function begin() {
    setStarted(true);
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current);
          if (!finishedRef.current) {
            finishedRef.current = true;
            onFinish(correctRef.current * 10);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  function answer(choseMatch) {
    if (choseMatch === round.isMatch) {
      sfx.correct();
      const nextCorrect = correct + 1;
      setCorrect(nextCorrect);
      setFlash("correct");

      const newLevel = Math.floor(nextCorrect / CORRECT_PER_LEVEL) + 1;
      if (newLevel > levelRef.current) {
        levelRef.current = newLevel;
        setLevel(newLevel);
        setTimeLeft((t) => t + LEVEL_BONUS_SECONDS);
        sfx.levelUp();
        haptics.success();
        setLevelUpFlash(true);
        setTimeout(() => setLevelUpFlash(false), 1000);
      }
    } else {
      sfx.wrong();
      setFlash("wrong");
    }
    setRound(randomRound());
    setTimeout(() => setFlash(null), 150);
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          A word appears in a color. Does the WORD match its own color? Answer fast. Every {CORRECT_PER_LEVEL}
          {" "}correct is a level and earns bonus time.
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
      <div className="flex justify-between font-mono text-xs mb-6 text-textDim">
        <span>Correct: <span className="text-textLight">{correct}</span> · Lvl {level}</span>
        <span style={{ color: timeLeft <= 5 ? "#ff3ea5" : "#a99fd6" }}>Time left: {timeLeft}s</span>
      </div>
      <div
        className="rounded-xl border py-10 text-center mb-5 border-lineColor transition-colors"
        style={{ background: flash === "correct" ? "#113a2c" : flash === "wrong" ? "#3a1130" : "#2a1560" }}
      >
        <div className="font-pixel text-2xl" style={{ color: round.colorHex }}>
          {round.word}
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={() => answer(true)} className="flex-1 rounded-md py-3 font-pixel text-[10px] text-bgDeep" style={{ background: accentColor }}>
          MATCH
        </button>
        <button onClick={() => answer(false)} className="flex-1 rounded-md py-3 font-mono text-xs border border-lineColor text-textLight">
          NO MATCH
        </button>
      </div>
    </div>
  );
}
