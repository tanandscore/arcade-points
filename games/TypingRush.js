"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const DURATION = 30;
const WORDS_PER_LEVEL = 8;
const LEVEL_BONUS_SECONDS = 6;
const WORDS = [
  "arcade", "score", "pixel", "rush", "combo", "level", "quest", "sprint", "dash", "orbit",
  "flame", "shadow", "cipher", "matrix", "vertex", "nova", "cosmic", "signal", "engine", "vault",
  "puzzle", "spiral", "beacon", "cascade", "circuit", "drift", "echo", "flux", "glide", "haven",
];

function randomWord() {
  return WORDS[Math.floor(Math.random() * WORDS.length)];
}

export default function TypingRush({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [word, setWord] = useState(randomWord);
  const [input, setInput] = useState("");
  const [correct, setCorrect] = useState(0);
  const [level, setLevel] = useState(1);
  const [levelUpFlash, setLevelUpFlash] = useState(false);
  const intervalRef = useRef(null);
  const finishedRef = useRef(false);
  const correctRef = useRef(0);
  const levelRef = useRef(1);
  const inputRef = useRef(null);

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
    setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
  }

  function handleChange(e) {
    const val = e.target.value;
    setInput(val);
    if (val.trim().toLowerCase() === word.toLowerCase()) {
      sfx.correct();
      const nextCorrect = correct + 1;
      setCorrect(nextCorrect);
      setWord(randomWord());
      setInput("");

      const newLevel = Math.floor(nextCorrect / WORDS_PER_LEVEL) + 1;
      if (newLevel > levelRef.current) {
        levelRef.current = newLevel;
        setLevel(newLevel);
        setTimeLeft((t) => t + LEVEL_BONUS_SECONDS);
        sfx.levelUp();
        haptics.success();
        setLevelUpFlash(true);
        setTimeout(() => setLevelUpFlash(false), 1000);
      }
    }
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          30 seconds. Type each word exactly, then it moves on automatically. Every {WORDS_PER_LEVEL} words is a
          level and earns bonus time.
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
        <span>Words: <span className="text-textLight">{correct}</span> · Lvl {level}</span>
        <span style={{ color: timeLeft <= 5 ? "#ff3ea5" : "#a99fd6" }}>Time left: {timeLeft}s</span>
      </div>
      <div className="rounded-xl border border-lineColor py-10 text-center mb-5 bg-bgPanel3">
        <div className="font-pixel text-2xl tracking-wide">{word}</div>
      </div>
      <input
        ref={inputRef}
        value={input}
        onChange={handleChange}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        className="w-full rounded-md px-3 py-2.5 outline-none font-mono text-lg text-center bg-bgDeep border border-lineColor text-textLight"
        placeholder="type here..."
      />
    </div>
  );
}
