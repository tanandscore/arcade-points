"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ResultOverlay from "@/components/ResultOverlay";
import { GAME_COMPONENTS } from "./GameComponents";
import { sfx, toggleMuted, isMuted } from "@/lib/sound";
import { sendMetric } from "@/lib/telemetry";
import { queueScoreSubmission } from "@/lib/offlineQueue";

export default function GameRunner({ slug, name, accentColor }) {
  const [round, setRound] = useState(0);
  const [result, setResult] = useState(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [muted, setMutedState] = useState(false);
  const router = useRouter();
  const launchStartRef = useRef(null);
  const launchRecordedRef = useRef(false);

  const GameComponent = GAME_COMPONENTS[slug];

  useEffect(() => {
    setMutedState(isMuted());
  }, []);

  // Real cold-launch timing: starts the moment this game's page
  // mounts, ends when GameLoadingInline unmounts (the actual game
  // has replaced it) — see the event dispatch there. A game whose
  // chunk is already cached (a quick "Play Again") never shows the
  // loading state at all, so this specifically measures the
  // meaningful case: how long a fresh launch actually takes.
  useEffect(() => {
    launchStartRef.current = performance.now();
    launchRecordedRef.current = false;

    function handleGameLoaded() {
      if (launchRecordedRef.current || launchStartRef.current == null) return;
      launchRecordedRef.current = true;
      const elapsed = performance.now() - launchStartRef.current;
      sendMetric(`/games/${slug}`, "game_launch", Math.round(elapsed));
    }

    window.addEventListener("ap:game-loaded", handleGameLoaded);
    return () => window.removeEventListener("ap:game-loaded", handleGameLoaded);
  }, [slug, round]);

  async function handleFinish(score) {
    const requestBody = JSON.stringify({ game: slug, score });
    let res;
    try {
      res = await fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
      });
    } catch {
      // fetch() itself threw — genuinely no connectivity, not a
      // server-side error response. Queue it for real, rather than
      // just showing an error and losing the score.
      await queueScoreSubmission("/api/scores", requestBody);
      setResult({ score, isNewBest: false, best: score, offlineQueued: true });
      sfx.lose();
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setResult({ score, isNewBest: false, best: score, error: data.error });
      sfx.lose();
      return;
    }

    // The scores route only returns which achievement IDs just
    // unlocked, not their artwork/name — fetch the full definitions
    // (already cached-ish via a single small table) only when there's
    // actually something new to show, so a normal run doesn't pay for
    // an extra request.
    let newlyUnlockedAchievements = [];
    const unlockedIds = data.newlyUnlockedAchievements || [];
    if (unlockedIds.length > 0) {
      try {
        const achRes = await fetch("/api/achievements");
        const achData = await achRes.json();
        const byId = Object.fromEntries((achData.achievements || []).map((a) => [a.id, a]));
        newlyUnlockedAchievements = unlockedIds.map((id) => byId[id]).filter(Boolean);
      } catch {
        // achievement lookup failing shouldn't block showing the score result
      }
    }

    setResult({
      score,
      isNewBest: !!data.isNewBest,
      best: data.best ?? score,
      becameNumberOneInGame: !!data.becameNumberOneInGame,
      becameNumberOneOverall: !!data.becameNumberOneOverall,
      newlyUnlockedAchievements,
      xpGained: data.xpGained || 0,
    });
    if (data.becameNumberOneInGame || data.becameNumberOneOverall) sfx.celebration();
    else if (newlyUnlockedAchievements.length > 0) sfx.celebration();
    else if (data.isNewBest) sfx.newBest();
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
          becameNumberOneInGame={result.becameNumberOneInGame}
          becameNumberOneOverall={result.becameNumberOneOverall}
          newlyUnlockedAchievements={result.newlyUnlockedAchievements}
          xpGained={result.xpGained}
          error={result.error}
          offlineQueued={result.offlineQueued}
          onPlayAgain={playAgain}
          onBack={() => router.push("/dashboard")}
        />
      )}
    </div>
  );
}
