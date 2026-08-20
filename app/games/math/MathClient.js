"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ResultOverlay from "@/components/ResultOverlay";

const ACCENT = "#ffb703";
const DURATION = 30;

function randomProblem() {
  const ops = ["+", "-", "×"];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a, b, answer;
  if (op === "+") {
    a = Math.floor(Math.random() * 60) + 1;
    b = Math.floor(Math.random() * 60) + 1;
    answer = a + b;
  } else if (op === "-") {
    a = Math.floor(Math.random() * 60) + 20;
    b = Math.floor(Math.random() * a);
    answer = a - b;
  } else {
    a = Math.floor(Math.random() * 11) + 2;
    b = Math.floor(Math.random() * 11) + 2;
    answer = a * b;
  }
  return { question: `${a} ${op} ${b}`, answer };
}

export default function MathClient() {
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [problem, setProblem] = useState(randomProblem);
  const [input, setInput] = useState("");
  const [correct, setCorrect] = useState(0);
  const [wrong, setWrong] = useState(0);
  const [flash, setFlash] = useState(null);
  const [result, setResult] = useState(null);
  const intervalRef = useRef(null);
  const finishedRef = useRef(false);
  const correctRef = useRef(0);
  const inputRef = useRef(null);
  const router = useRouter();

  useEffect(() => () => clearInterval(intervalRef.current), []);
  useEffect(() => {
    correctRef.current = correct;
  }, [correct]);

  async function finish() {
    finishedRef.current = true;
    clearInterval(intervalRef.current);
    const score = correctRef.current * 10;
    const res = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game: "math", score }),
    });
    const data = await res.json();
    setResult({ score, isNewBest: !!data.isNewBest, best: data.best ?? score });
  }

  function begin() {
    setStarted(true);
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (!finishedRef.current) finish();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    setTimeout(() => inputRef.current && inputRef.current.focus(), 50);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (input.trim() === "") return;
    const val = Number(input);
    if (val === problem.answer) {
      setCorrect((c) => c + 1);
      setFlash("correct");
    } else {
      setWrong((w) => w + 1);
      setFlash("wrong");
    }
    setInput("");
    setProblem(randomProblem());
    setTimeout(() => setFlash(null), 200);
  }

  function playAgain() {
    finishedRef.current = false;
    setStarted(false);
    setTimeLeft(DURATION);
    setProblem(randomProblem());
    setInput("");
    setCorrect(0);
    setWrong(0);
    setResult(null);
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">30 seconds. Type the answer and hit Enter. Ten points per correct answer.</p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: ACCENT }}>
          START
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="flex justify-between font-mono text-xs mb-6 text-textDim">
        <span>
          Correct: <span className="text-textLight">{correct}</span>
        </span>
        <span style={{ color: timeLeft <= 5 ? "#ff3ea5" : "#a99fd6" }}>Time left: {timeLeft}s</span>
        <span>
          Wrong: <span className="text-textLight">{wrong}</span>
        </span>
      </div>

      <div
        className="rounded-xl border py-10 text-center mb-5 transition-colors border-lineColor"
        style={{ background: flash === "correct" ? "#113a2c" : flash === "wrong" ? "#3a1130" : "#2a1560" }}
      >
        <div className="font-pixel text-2xl">{problem.question}</div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="number"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="?"
          className="flex-1 rounded-md px-3 py-2.5 outline-none font-mono text-lg text-center bg-bgDeep border border-lineColor text-textLight"
        />
        <button type="submit" className="font-pixel text-[9px] px-5 rounded-md text-bgDeep" style={{ background: ACCENT }}>
          GO
        </button>
      </form>

      {result && (
        <ResultOverlay
          gameName="Math Rush"
          accentColor={ACCENT}
          score={result.score}
          isNewBest={result.isNewBest}
          best={result.best}
          onPlayAgain={playAgain}
          onBack={() => router.push("/")}
        />
      )}
    </div>
  );
}
