"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ResultOverlay from "@/components/ResultOverlay";
import { GAME_COMPONENTS } from "./GameComponents";

export default function GameRunner({ slug, name, accentColor }) {
  const [round, setRound] = useState(0);
  const [result, setResult] = useState(null);
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
      return;
    }
    setResult({ score, isNewBest: !!data.isNewBest, best: data.best ?? score });
  }

  function playAgain() {
    setResult(null);
    setRound((r) => r + 1);
  }

  if (!GameComponent) {
    return <p className="text-center text-textDim">This game isn't available yet.</p>;
  }

  return (
    <div className="relative">
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
