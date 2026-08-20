"use client";

import { useEffect, useRef, useState } from "react";

const DURATION = 30;
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
  const intervalRef = useRef(null);
  const finishedRef = useRef(false);
  const correctRef = useRef(0);
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
      setCorrect((c) => c + 1);
      setWord(randomWord());
      setInput("");
    }
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">30 seconds. Type each word exactly, then it moves on automatically.</p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between font-mono text-xs mb-6 text-textDim">
        <span>Words: <span className="text-textLight">{correct}</span></span>
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
