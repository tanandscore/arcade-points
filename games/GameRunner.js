"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ResultOverlay from "@/components/ResultOverlay";
import { GAME_COMPONENTS } from "./GameComponents";
import { sfx, toggleMuted, isMuted } from "@/lib/sound";
import { sendMetric } from "@/lib/telemetry";
import { queueScoreSubmission } from "@/lib/offlineQueue";
import FullscreenStage, { LAPTOP_ONLY, isLaptopLike } from "./FullscreenStage";
import PremiumShell from "./PremiumShell";
import { boardKey } from "@/lib/boards";

export default function GameRunner({ slug, name, accentColor, icon = "🎮", tagline = "", related = [] }) {
  const [bestLocal, setBestLocal] = useState(0);
  useEffect(() => { try { const b = slug === "midnightburn" && localStorage.getItem("mb-map") === "tokyo" ? "tokyo" : null; setBestLocal(+localStorage.getItem(`ts-best-${boardKey(slug, b)}`) || 0); } catch {} }, [slug]);
  const [round, setRound] = useState(0);
  const [result, setResult] = useState(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [muted, setMutedState] = useState(false);
  const router = useRouter();
  const launchStartRef = useRef(null);
  const launchRecordedRef = useRef(false);

  const GameComponent = GAME_COMPONENTS[slug];
  const laptopOnly = LAPTOP_ONLY.has(slug);
  const [deviceOk, setDeviceOk] = useState(null);
  // Checked once on open, so shrinking the window mid-match never throws the player out of the game.
  useEffect(() => { if (laptopOnly) setDeviceOk(isLaptopLike()); }, [laptopOnly]);

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

  // `opts.board` names an extra leaderboard inside the game (Midnight Burn: "tokyo"); nothing else passes it, so every other game submits exactly as before
  async function handleFinish(score, opts) {
    const board = opts && typeof opts.board === "string" ? opts.board : undefined;
    const requestBody = JSON.stringify(board ? { game: slug, score, board } : { game: slug, score });
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

    try { localStorage.setItem(`ts-best-${boardKey(slug, board)}`, String(data.best ?? score)); setBestLocal(data.best ?? score); } catch {}
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

  if (laptopOnly && deviceOk === false) {
    return (
      <div className="rounded-xl border border-lineColor p-8 text-center bg-bgPanel max-w-md mx-auto">
        <div className="text-4xl mb-3">💻</div>
        <p className="font-pixel text-xs mb-3" style={{ color: accentColor }}>LAPTOP OR DESKTOP ONLY</p>
        <p className="text-textDim text-sm mb-5">{name} needs a keyboard, a mouse and a big screen. Open it on a laptop or desktop computer to play.</p>
        <button onClick={() => router.push("/dashboard")} className="font-mono text-[11px] px-5 py-2.5 rounded-md text-bgDeep" style={{ background: accentColor }}>Back to games</button>
      </div>
    );
  }
  if (laptopOnly && deviceOk === null) return <div className="h-40" />;

  const gameEl = <GameComponent key={round} onFinish={handleFinish} accentColor={accentColor} />;

  const premium = !laptopOnly;
  return (
    <div className="relative">
      {laptopOnly && !result && (
        <div className="flex justify-between mb-3">
          <button onClick={handleToggleMute} className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textDim hover:text-textLight hover:bg-bgPanel3 transition-colors" aria-label={muted ? "Unmute sound" : "Mute sound"}>{muted ? "🔇" : "🔊"}</button>
          {!confirmExit ? (
            <button onClick={() => setConfirmExit(true)} className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textDim hover:text-textLight hover:bg-bgPanel3 transition-colors">✕ Exit</button>
          ) : (
            <div className="flex items-center gap-2 font-mono text-[10px]">
              <span className="text-textDim">Quit this round?</span>
              <button onClick={() => router.push("/dashboard")} className="px-2.5 py-1.5 rounded-md border text-accentMagenta" style={{ borderColor: "#ff3ea5" }}>Yes, exit</button>
              <button onClick={() => setConfirmExit(false)} className="px-2.5 py-1.5 rounded-md border border-lineColor text-textDim">Keep playing</button>
            </div>
          )}
        </div>
      )}

      {laptopOnly ? <FullscreenStage>{gameEl}</FullscreenStage> : (
        <PremiumShell slug={slug} name={name} icon={icon} tagline={tagline} accentColor={accentColor} best={bestLocal} runKey={round} muted={muted} onMute={handleToggleMute} onExit={() => router.push("/dashboard")} onPlayStart={() => { launchStartRef.current = performance.now(); launchRecordedRef.current = false; }}>{gameEl}</PremiumShell>
      )}

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
          related={related}
          slug={slug}
          onPlayAgain={playAgain}
          onBack={() => router.push("/dashboard")}
        />
      )}
    </div>
  );
}
