"use client";

import { useEffect, useRef, useState } from "react";

const TOTAL_ROUNDS = 3;

export default function ReflexTap({ onFinish, accentColor }) {
  const [round, setRound] = useState(1);
  const [stage, setStage] = useState("intro");
  const [times, setTimes] = useState([]);
  const goAtRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function startRound() {
    setStage("waiting");
    const delay = 1000 + Math.random() * 2200;
    timerRef.current = setTimeout(() => {
      goAtRef.current = performance.now();
      setStage("go");
    }, delay);
  }

  function handleTap() {
    if (stage === "waiting") {
      clearTimeout(timerRef.current);
      setStage("early");
      return;
    }
    if (stage === "go") {
      const ms = Math.round(performance.now() - goAtRef.current);
      const newTimes = [...times, ms];
      setTimes(newTimes);
      if (round >= TOTAL_ROUNDS) {
        const best = Math.min(...newTimes);
        onFinish(Math.max(50, Math.round(1000 - best)));
      } else {
        setStage("roundDone");
      }
    }
  }

  function nextRound() {
    setRound((r) => r + 1);
    startRound();
  }

  return (
    <div className="text-center">
      <p className="font-mono text-xs mb-6 text-textDim">
        Round {Math.min(round, TOTAL_ROUNDS)} of {TOTAL_ROUNDS}
      </p>

      {stage === "intro" && (
        <div>
          <p className="mb-6 text-textDim">Tap the box when it turns green. Tap too soon and you'll restart the round.</p>
          <button onClick={startRound} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
            START
          </button>
        </div>
      )}

      {(stage === "waiting" || stage === "go") && (
        <button
          onClick={handleTap}
          className="w-full h-56 rounded-xl font-pixel text-sm transition-colors border border-lineColor"
          style={{ background: stage === "go" ? "#16c784" : "#2a1560", color: stage === "go" ? "#062017" : "#a99fd6" }}
        >
          {stage === "go" ? "TAP NOW!" : "WAIT FOR GREEN..."}
        </button>
      )}

      {stage === "early" && (
        <div>
          <p className="font-mono text-sm mb-4 text-accentMagenta">Too soon! Try that round again.</p>
          <button onClick={startRound} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
            RETRY ROUND
          </button>
        </div>
      )}

      {stage === "roundDone" && (
        <div>
          <p className="font-mono text-sm mb-4">
            Reaction: <span style={{ color: accentColor }}>{times[times.length - 1]}ms</span>
          </p>
          <button onClick={nextRound} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
            NEXT ROUND
          </button>
        </div>
      )}
    </div>
  );
}
