"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ResultOverlay from "@/components/ResultOverlay";
import { GAME_COMPONENTS } from "./GameComponents";
import { sfx, toggleMuted, isMuted } from "@/lib/sound";

export default function GameRunner({ slug, name, accentColor }) {
  const [round, setRound] = useState(0);
  const [result, setResult] = useState(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [muted, setMutedState] = useState(false);
  const router = useRouter();

  const GameComponent = GAME_COMPONENTS[slug];

  async function handleFinish(score) {
    const res = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game: slug, score }),
    });
    const data = await res.json();
    if (!res.ok) {
      setResult({ score, isNewBest: false, best: score, error: data.error });
      sfx.lose();
      return;
    }
    setResult({ score, isNewBest: !!data.isNewBest, best: data.best ?? score });
    if (data.isNewBest) sfx.newBest();
    else sfx.win();
  }

  function playAgain() {
    setResult(null);
    setRound((r) => r + 1);
  }

  function handleToggleMute() {
    setMutedState(toggleMuted());
  }

  if (!GameComponent) {
    return <p className="text-center text-textDim">This game isn't available yet.</p>;
  }

  return (
    <div className="relative">
      {/* Exit bar — always available during play, so you're never stuck
          finishing a round just to get back to the dashboard. These games
          are quick (well under a minute), so there's no meaningful
          "save and resume later" state to keep — exiting simply abandons
          the current, unfinished attempt without affecting your best score. */}
      {!result && (
        <div className="flex justify-between mb-3">
          <button
            onClick={handleToggleMute}
            className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textDim hover:text-textLight hover:bg-bgPanel3 transition-colors"
            aria-label={muted ? "Unmute sound" : "Mute sound"}
          >
            {muted ? "🔇" : "🔊"}
          </button>
          {!confirmExit ? (
            <button
              onClick={() => setConfirmExit(true)}
              className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textDim hover:text-textLight hover:bg-bgPanel3 transition-colors"
            >
              ✕ Exit
            </button>
          ) : (
            <div className="flex items-center gap-2 font-mono text-[10px]">
              <span className="text-textDim">Quit this round?</span>
              <button
                onClick={() => router.push("/dashboard")}
                className="px-2.5 py-1.5 rounded-md border text-accentMagenta"
                style={{ borderColor: "#ff3ea5" }}
              >
                Yes, exit
              </button>
              <button
                onClick={() => setConfirmExit(false)}
                className="px-2.5 py-1.5 rounded-md border border-lineColor text-textDim"
              >
                Keep playing
              </button>
            </div>
          )}
        </div>
      )}

      <GameComponent key={round} onFinish={handleFinish} accentColor={accentColor} />

      {result && (
        <ResultOverlay
          gameName={name}
          accentColor={accentColor}
          score={result.score}
          isNewBest={result.isNewBest}
          best={result.best}
          onPlayAgain={playAgain}
          onBack={() => router.push("/dashboard")}
        />
      )}
    </div>
  );
}
