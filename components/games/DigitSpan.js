"use client";

import { useEffect, useState } from "react";

function randomDigits(length) {
  let s = "";
  for (let i = 0; i < length; i++) s += Math.floor(Math.random() * 10);
  return s;
}

export default function DigitSpan({ onFinish, accentColor }) {
  const [started, setStarted] = useState(false);
  const [length, setLength] = useState(3);
  const [digits, setDigits] = useState("");
  const [phase, setPhase] = useState("show"); // show | input
  const [input, setInput] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!started || phase !== "show") return;
    const seq = randomDigits(length);
    setDigits(seq);
    const t = setTimeout(() => setPhase("input"), 1000 + length * 500);
    return () => clearTimeout(t);
  }, [started, length, phase]);

  function begin() {
    setStarted(true);
    setPhase("show");
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (input === digits) {
      setLength((l) => l + 1);
      setInput("");
      setPhase("show");
    } else {
      setError(true);
      onFinish(Math.max(10, (length - 3) * 30));
    }
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">Memorize the digits shown, then type them back. Each round adds one more digit.</p>
        <button onClick={begin} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
          START
        </button>
      </div>
    );
  }

  if (error) {
    return <p className="text-center font-mono text-sm text-accentMagenta">Not quite — check your final score below.</p>;
  }

  return (
    <div className="text-center">
      <p className="font-mono text-xs mb-6 text-textDim">Round {length - 2}</p>
      {phase === "show" ? (
        <div className="font-pixel text-3xl tracking-[0.3em]" style={{ color: accentColor }}>
          {digits}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">
          <input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            className="w-full max-w-xs rounded-md px-3 py-2.5 outline-none font-mono text-lg text-center bg-bgDeep border border-lineColor text-textLight"
            placeholder="type the digits"
          />
          <button type="submit" className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
            SUBMIT
          </button>
        </form>
      )}
    </div>
  );
}
