"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/sound";
import { haptics } from "@/lib/haptics";

function thresholdForLevel(level) {
  return Math.max(180, 480 - (level - 1) * 25);
}

export default function ReflexTap({ onFinish, accentColor }) {
  const [level, setLevel] = useState(1);
  const [stage, setStage] = useState("intro");
  const [lastTime, setLastTime] = useState(null);
  const [score, setScore] = useState(0);
  const [levelUpFlash, setLevelUpFlash] = useState(false);
  const goAtRef = useRef(0);
  const timerRef = useRef(null);
  const levelRef = useRef(1);
  const scoreRef = useRef(0);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  function startRound() {
    setStage("waiting");
    const delay = 900 + Math.random() * 2000;
    timerRef.current = setTimeout(() => {
      goAtRef.current = performance.now();
      setStage("go");
    }, delay);
  }

  function handleTap() {
    if (stage === "waiting") {
      clearTimeout(timerRef.current);
      sfx.wrong();
      setStage("early");
      return;
    }
    if (stage === "go") {
      const ms = Math.round(performance.now() - goAtRef.current);
      setLastTime(ms);
      const threshold = thresholdForLevel(levelRef.current);

      if (ms > threshold) {
        // Too slow for this level's threshold — the run ends here,
        // score kept from every level cleared so far.
        sfx.wrong();
        setStage("tooSlow");
        return;
      }

      sfx.correct();
      scoreRef.current += Math.max(20, threshold - ms) + 30 * levelRef.current;
      setScore(scoreRef.current);
      levelRef.current += 1;
      setLevel(levelRef.current);
      sfx.levelUp();
      haptics.success();
      setLevelUpFlash(true);
      setTimeout(() => setLevelUpFlash(false), 800);
      setStage("roundDone");
    }
  }

  function finish() {
    onFinish(scoreRef.current);
  }

  function nextRound() {
    startRound();
  }

  const threshold = thresholdForLevel(level);

  return (
    <div className="text-center relative">
      {levelUpFlash && (
        <div className="absolute inset-x-0 -top-2 z-10 flex items-center justify-center pointer-events-none">
          <p className="font-pixel text-sm text-accentAmber ap-blink bg-bgDeep/80 px-4 py-2 rounded-lg">LEVEL {level}!</p>
        </div>
      )}
      <p className="font-mono text-xs mb-6 text-textDim">
        Level {level} · Score: <span className="text-textLight">{score}</span> · Beat {threshold}ms
      </p>

      {stage === "intro" && (
        <div>
          <p className="mb-6 text-textDim">
            Tap the box when it turns green. Each level gives you less room to react — tap too soon or too slow and
            the run ends. Score carries the whole way.
          </p>
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
          <p className="font-mono text-sm mb-4 text-accentMagenta">Too soon! Run over — check your final score below.</p>
          <button onClick={finish} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
            SEE RESULT
          </button>
        </div>
      )}

      {stage === "tooSlow" && (
        <div>
          <p className="font-mono text-sm mb-1 text-accentMagenta">
            {lastTime}ms — just over the {threshold}ms limit for level {level}.
          </p>
          <p className="font-mono text-xs mb-4 text-textDim">Run over — check your final score below.</p>
          <button onClick={finish} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
            SEE RESULT
          </button>
        </div>
      )}

      {stage === "roundDone" && (
        <div>
          <p className="font-mono text-sm mb-4">
            Reaction: <span style={{ color: accentColor }}>{lastTime}ms</span>
          </p>
          <button onClick={nextRound} className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep" style={{ background: accentColor }}>
            NEXT LEVEL
          </button>
        </div>
      )}
    </div>
  );
}
