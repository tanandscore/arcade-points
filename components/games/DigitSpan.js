"use client";

import { useEffect, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

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
  const [levelUpFlash, setLevelUpFlash] = useState(false);

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
      sfx.levelUp();
      haptics.success();
      setLevelUpFlash(true);
      setTimeout(() => setLevelUpFlash(false), 800);
      setLength((l) => l + 1);
      setInput("");
      setPhase("show");
    } else {
      sfx.wrong();
      setError(true);
      onFinish(Math.max(10, (length - 3) * 30));
    }
  }

  if (!started) {
    return (
      <div className="text-center">
        <p className="mb-6 text-textDim">Memorize the digits shown, then type them back. Each level adds one more digit — keep going as long as your memory holds.</p>
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
    <div className="text-center relative">
      {levelUpFlash && (
        <div className="absolute inset-x-0 -top-2 z-10 flex items-center justify-center pointer-events-none">
          <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/80 px-4 py-2 rounded-lg">LEVEL {length - 1}!</p>
        </div>
      )}
      <p className="font-pixel text-[10px] text-accentCyan mb-1">LEVEL {length - 2}</p>
      {phase === "show" ? (
        <div className="font-pixel text-3xl tracking-[0.3em] mt-4" style={{ color: accentColor }}>
          {digits}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4 mt-4">
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
