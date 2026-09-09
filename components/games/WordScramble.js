"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const DURATION = 45;
const LEVEL_BONUS_SECONDS = 8;
const WORDS = [
  "arcade", "pixel", "score", "puzzle", "rocket", "castle", "dragon", "planet", "wizard", "guitar",
  "garden", "bridge", "candle", "forest", "island", "jungle", "magnet", "mirror", "ocean", "orange",
  "pencil", "rabbit", "shadow", "temple", "thunder", "trophy", "violet", "window", "winter", "yellow",
];

function scramble(word) {
  let arr = word.split("");
  let attempt = word;
  while (attempt === word) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    attempt = arr.join("");
    if (word.length <= 2) break;
  }
  return attempt;
}

function nextPuzzle() {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  return { word, scrambled: scramble(word) };
}

export default function WordScramble({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [puzzle, setPuzzle] = useState(nextPuzzle);
  const [input, setInput] = useState("");
  const [solved, setSolved] = useState(0);
  const [level, setLevel] = useState(1);
  const [flash, setFlash] = useState(null);
  const [levelUpFlash, setLevelUpFlash] = useState(false);
  const intervalRef = useRef(null);
  const finishedRef = useRef(false);
  const solvedRef = useRef(0);
  const levelRef = useRef(1);
  const inputRef = useRef(null);

  useEffect(() => () => clearInterval(intervalRef.current), []);
  useEffect(() => {
    solvedRef.current = solved;
  }, [solved]);

  function begin() {
    setStarted(true);
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(intervalRef.current);
          if (!finishedRef.current) {
            finishedRef.current = true;
            onFinish(solvedRef.current * 10);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (input.trim().toLowerCase() === puzzle.word) {
      const nextSolved = solved + 1;
      sfx.correct();
      setSolved(nextSolved);
      setFlash("correct");
      setPuzzle(nextPuzzle());
      setInput("");

      // Every 5 words is a level — bonus time keeps a hot streak going
      // instead of the clock cutting it short.
      const newLevel = Math.floor(nextSolved / 5) + 1;
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
    setTimeout(() => setFlash(null), 200);
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          45 seconds. Unscramble each word and hit Enter. Every 5 solved is a new level and earns bonus time.
        </p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {levelUpFlash && (
        <div className="absolute inset-x-0 -top-2 z-10 flex items-center justify-center pointer-events-none">
          <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/80 px-4 py-2 rounded-lg">LEVEL {level}! +{LEVEL_BONUS_SECONDS}s</p>
        </div>
      )}
      <div className="flex justify-between font-mono text-xs mb-6 text-textDim">
        <span>Solved: <span className="text-textLight">{solved}</span> · Lvl {level}</span>
        <span style={{ color: timeLeft <= 8 ? "#ff3ea5" : "#a99fd6" }}>Time left: {timeLeft}s</span>
      </div>
      <div
        className="rounded-xl border py-10 text-center mb-5 border-lineColor transition-colors"
        style={{ background: flash === "correct" ? "#113a2c" : flash === "wrong" ? "#3a1130" : "#2a1560" }}
      >
        <div className="font-pixel text-2xl tracking-[0.2em] uppercase">{puzzle.scrambled}</div>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="flex-1 rounded-md px-3 py-2.5 outline-none font-mono text-lg text-center bg-bgDeep border border-lineColor text-textLight"
          placeholder="your answer"
        />
        <button type="submit" className="font-pixel text-[9px] px-5 rounded-md text-bgDeep" style={{ background: accentColor }}>
          GO
        </button>
      </form>
    </div>
  );
}
