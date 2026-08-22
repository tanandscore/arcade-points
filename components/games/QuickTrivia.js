"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

const DURATION = 40;
const LEVEL_BONUS_SECONDS = 6;

// General-knowledge facts — original compilation, not sourced from any
// copyrighted trivia game or media property.
const QUESTIONS = [
  { q: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], answer: 1 },
  { q: "How many continents are there on Earth?", options: ["5", "6", "7", "8"], answer: 2 },
  { q: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], answer: 3 },
  { q: "What gas do plants absorb from the air?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], answer: 2 },
  { q: "How many sides does a hexagon have?", options: ["5", "6", "7", "8"], answer: 1 },
  { q: "What is the freezing point of water in Celsius?", options: ["0°C", "10°C", "-10°C", "5°C"], answer: 0 },
  { q: "Which country has the largest population?", options: ["USA", "India", "Brazil", "Russia"], answer: 1 },
  { q: "What is the tallest mountain in the world?", options: ["K2", "Kangchenjunga", "Everest", "Denali"], answer: 2 },
  { q: "How many players are on a standard football (soccer) team on the field?", options: ["9", "10", "11", "12"], answer: 2 },
  { q: "What is the chemical symbol for gold?", options: ["Go", "Gd", "Au", "Ag"], answer: 2 },
  { q: "Which organ pumps blood through the body?", options: ["Lungs", "Liver", "Heart", "Kidney"], answer: 2 },
  { q: "How many minutes are in a full day?", options: ["1240", "1440", "1000", "1600"], answer: 1 },
  { q: "What is the smallest prime number?", options: ["0", "1", "2", "3"], answer: 2 },
  { q: "Which language has the most native speakers worldwide?", options: ["English", "Spanish", "Mandarin Chinese", "Hindi"], answer: 2 },
  { q: "What do bees collect from flowers?", options: ["Water", "Nectar", "Sap", "Pollen only"], answer: 1 },
];

function shuffledQuestions() {
  const arr = [...QUESTIONS];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function QuickTrivia({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [pool, setPool] = useState(shuffledQuestions);
  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [level, setLevel] = useState(1);
  const [picked, setPicked] = useState(null);
  const [levelUpFlash, setLevelUpFlash] = useState(false);
  const intervalRef = useRef(null);
  const finishedRef = useRef(false);
  const correctRef = useRef(0);
  const levelRef = useRef(1);

  useEffect(() => () => clearInterval(intervalRef.current), []);
  useEffect(() => {
    correctRef.current = correct;
  }, [correct]);

  function finish() {
    if (!finishedRef.current) {
      finishedRef.current = true;
      clearInterval(intervalRef.current);
      onFinish(correctRef.current * 10);
    }
  }

  function begin() {
    setStarted(true);
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          finish();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  function choose(optIndex) {
    if (picked !== null) return;
    setPicked(optIndex);
    const isCorrect = optIndex === pool[index].answer;
    let nextCorrect = correct;
    if (isCorrect) {
      sfx.correct();
      nextCorrect = correct + 1;
      setCorrect(nextCorrect);
    } else {
      sfx.wrong();
    }

    setTimeout(() => {
      // Running out of questions doesn't end the game — the pool
      // reshuffles and keeps going. Every 5 correct answers is a
      // level, earning bonus time instead of the clock cutting the
      // streak short.
      const newLevel = Math.floor(nextCorrect / 5) + 1;
      if (newLevel > levelRef.current) {
        levelRef.current = newLevel;
        setLevel(newLevel);
        setTimeLeft((t) => t + LEVEL_BONUS_SECONDS);
        sfx.levelUp();
        haptics.success();
        setLevelUpFlash(true);
        setTimeout(() => setLevelUpFlash(false), 1000);
      }

      if (index + 1 >= pool.length) {
        setPool(shuffledQuestions());
        setIndex(0);
      } else {
        setIndex((i) => i + 1);
      }
      setPicked(null);
    }, 600);
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">
          General knowledge, multiple choice. Answer as many as you can — every 5 correct is a level and earns
          bonus time. 40 seconds to start.
        </p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START
        </button>
      </div>
    );
  }

  const current = pool[index];

  return (
    <div className="relative">
      {levelUpFlash && (
        <div className="absolute inset-x-0 -top-2 z-10 flex items-center justify-center pointer-events-none">
          <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/80 px-4 py-2 rounded-lg">LEVEL {level}! +{LEVEL_BONUS_SECONDS}s</p>
        </div>
      )}
      <div className="flex justify-between font-mono text-xs mb-6 text-textDim">
        <span>Correct: <span className="text-textLight">{correct}</span> · Lvl {level}</span>
        <span style={{ color: timeLeft <= 8 ? "#ff3ea5" : "#a99fd6" }}>Time left: {timeLeft}s</span>
      </div>
      <div className="rounded-xl border border-lineColor p-6 mb-5 bg-bgPanel3 text-center min-h-[70px] flex items-center justify-center">
        <p className="font-mono text-sm">{current.q}</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {current.options.map((opt, i) => {
          const isPicked = picked === i;
          const isRight = picked !== null && i === current.answer;
          return (
            <button
              key={i}
              onClick={() => choose(i)}
              disabled={picked !== null}
              className="rounded-md py-3 px-2 font-mono text-xs border text-textLight transition-colors"
              style={{
                borderColor: isRight ? "#16c784" : isPicked ? "#ff3ea5" : "rgba(169,159,214,0.22)",
                background: isRight ? "#113a2c" : isPicked ? "#3a1130" : "#241154",
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
