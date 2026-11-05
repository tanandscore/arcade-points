"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ResultOverlay from "@/components/ResultOverlay";
import { GAME_COMPONENTS } from "./GameComponents";
import { sfx, toggleMuted, isMuted } from "@/lib/sound";
import { sendMetric } from "@/lib/telemetry";
import { queueScoreSubmission } from "@/lib/offlineQueue";
import FullscreenStage, { LAPTOP_ONLY, isLaptopLike, useStage } from "./FullscreenStage";
import { boardKey } from "@/lib/boards";
import { isKitSlug } from "@/lib/catalog";

// Sends one score to the leaderboard. Returns what happened in one plain object so both kinds of game can use it:
//   { isNewBest, best, xpGained, becameNumberOneInGame, becameNumberOneOverall, achievements: [...], error?, offlineQueued? }
async function postScore(slug, score, board) {
  const requestBody = JSON.stringify(board ? { game: slug, score, board } : { game: slug, score });
  let res;
  try {
    res = await fetch("/api/scores", { method: "POST", headers: { "Content-Type": "application/json" }, body: requestBody });
  } catch {
    // fetch() itself threw — genuinely no connectivity, not a server-side error response. Queue it for real, rather than just
    // showing an error and losing the score.
    await queueScoreSubmission("/api/scores", requestBody);
    return { offlineQueued: true, isNewBest: false, best: score, xpGained: 0, achievements: [] };
  }
  let data = {};
  try { data = await res.json(); } catch {}
  if (!res.ok) return { error: data.error || "Your score could not be saved.", isNewBest: false, best: score, xpGained: 0, achievements: [] };

  // The scores route only returns which achievement IDs just unlocked, not their artwork/name — fetch the full definitions
  // (a single small table) only when there is actually something new to show, so a normal run doesn't pay for an extra request.
  let achievements = [];
  const unlockedIds = data.newlyUnlockedAchievements || [];
  if (unlockedIds.length > 0) {
    try {
      const achRes = await fetch("/api/achievements");
      const achData = await achRes.json();
      const byId = Object.fromEntries((achData.achievements || []).map((a) => [a.id, a]));
      achievements = unlockedIds.map((id) => byId[id]).filter(Boolean);
    } catch {
      // achievement lookup failing shouldn't block showing the score result
    }
  }
  return {
    isNewBest: !!data.isNewBest,
    best: data.best ?? score,
    xpGained: data.xpGained || 0,
    becameNumberOneInGame: !!data.becameNumberOneInGame,
    becameNumberOneOverall: !!data.becameNumberOneOverall,
    achievements,
  };
}

export default function GameRunner({ slug, name, accentColor, icon = "🎮", tagline = "", related = [], onExit, exitHref = "/dashboard" }) {
  const [round, setRound] = useState(0);
  const [result, setResult] = useState(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [muted, setMutedState] = useState(false);
  const router = useRouter();
  const launchStartRef = useRef(null);
  const launchRecordedRef = useRef(false);

  const GameComponent = GAME_COMPONENTS[slug];
  const kit = isKitSlug(slug);
  const laptopOnly = LAPTOP_ONLY.has(slug);
  const [deviceOk, setDeviceOk] = useState(null);
  // Checked once on open, so shrinking the window mid-match never throws the player out of the game.
  useEffect(() => { if (laptopOnly) setDeviceOk(isLaptopLike()); }, [laptopOnly]);

  useEffect(() => {
    setMutedState(isMuted());
  }, []);

  // Real cold-launch timing: starts the moment this game's page mounts, ends when GameLoadingInline unmounts (the actual game has
  // replaced it) — see the event dispatch there. A game whose chunk is already cached (a quick "Play Again") never shows the
  // loading state at all, so this specifically measures the meaningful case: how long a fresh launch actually takes.
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

  const leave = useCallback(() => { if (onExit) onExit(); else router.push(exitHref); }, [onExit, router, exitHref]);

  // Flagship games: one run ends → show the full result window. `opts.board` names an extra leaderboard inside the game
  // (Midnight Burn: "tokyo"); nothing else passes it, so every other game submits exactly as before.
  async function handleFinish(score, opts) {
    const board = opts && typeof opts.board === "string" ? opts.board : undefined;
    const r = await postScore(slug, score, board);
    if (r.offlineQueued) { setResult({ score, isNewBest: false, best: score, offlineQueued: true }); sfx.lose(); return; }
    if (r.error) { setResult({ score, isNewBest: false, best: score, error: r.error }); sfx.lose(); return; }
    try { localStorage.setItem(`ts-best-${boardKey(slug, board)}`, String(r.best)); } catch {}
    setResult({
      score,
      isNewBest: r.isNewBest,
      best: r.best,
      becameNumberOneInGame: r.becameNumberOneInGame,
      becameNumberOneOverall: r.becameNumberOneOverall,
      newlyUnlockedAchievements: r.achievements,
      xpGained: r.xpGained,
    });
    if (r.becameNumberOneInGame || r.becameNumberOneOverall) sfx.celebration();
    else if (r.achievements.length > 0) sfx.celebration();
    else if (r.isNewBest) sfx.newBest();
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
    return <p className="text-center text-textDim">This game isn&apos;t available yet.</p>;
  }

  if (laptopOnly && deviceOk === false) {
    return (
      <div className="rounded-2xl border border-lineColor p-8 text-center bg-bgPanel max-w-md mx-auto">
        <div className="text-4xl mb-3">💻</div>
        <p className="font-pixel text-xs mb-3" style={{ color: accentColor }}>LAPTOP OR DESKTOP ONLY</p>
        <p className="text-textDim text-sm mb-5">{name} needs a keyboard, a mouse and a big screen. Open it on a laptop or desktop computer to play.</p>
        <button onClick={leave} className="font-mono text-[11px] px-5 py-2.5 rounded-md text-bgDeep" style={{ background: accentColor }}>Back to the store</button>
      </div>
    );
  }
  if (laptopOnly && deviceOk === null) return <div className="h-40" />;

  // ---- the 2D games: scores are saved quietly after every level, the game draws its own result screen ----
  if (kit) {
    return (
      <FullscreenStage hideButton>
        <KitFrame key={round} slug={slug} name={name} icon={icon} accentColor={accentColor} GameComponent={GameComponent} onExit={leave} muted={muted} onMute={handleToggleMute} />
      </FullscreenStage>
    );
  }

  const gameEl = <GameComponent key={round} onFinish={handleFinish} accentColor={accentColor} />;

  return (
    <div className="relative">
      {!result && (
        <div className="flex justify-between mb-3">
          <button onClick={handleToggleMute} className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textDim hover:text-textLight hover:bg-bgPanel3 transition-colors" aria-label={muted ? "Unmute sound" : "Mute sound"}>{muted ? "🔇" : "🔊"}</button>
          {!confirmExit ? (
            <button onClick={() => setConfirmExit(true)} className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textDim hover:text-textLight hover:bg-bgPanel3 transition-colors">✕ Exit</button>
          ) : (
            <div className="flex items-center gap-2 font-mono text-[10px]">
              <span className="text-textDim">Quit this round?</span>
              <button onClick={leave} className="px-2.5 py-1.5 rounded-md border text-accentMagenta" style={{ borderColor: "#ff3ea5" }}>Yes, exit</button>
              <button onClick={() => setConfirmExit(false)} className="px-2.5 py-1.5 rounded-md border border-lineColor text-textDim">Keep playing</button>
            </div>
          )}
        </div>
      )}

      <FullscreenStage>{gameEl}</FullscreenStage>

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
          onBack={leave}
          onClose={() => setResult(null)}
        />
      )}
    </div>
  );
}

// ───────────────────────── the frame around a 2D game ─────────────────────────
// A slim header (sound, fullscreen, close) above the game's own 16:9 stage. In fullscreen the header goes away and the
// fullscreen stage's own exit tab takes over. Toasts for achievements live in here so they also show in real fullscreen.
function KitFrame({ slug, name, icon, accentColor, GameComponent, onExit, muted, onMute }) {
  const stage = useStage();
  const [confirm, setConfirm] = useState(false);
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const pushToast = useCallback((t) => {
    const id = ++toastId.current;
    setToasts((p) => [...p.slice(-3), { id, ...t }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 5200);
  }, []);

  // Called by the game after every level it wants on the leaderboard. Returns the result so the game can show "new record".
  const onScore = useCallback(async (score) => {
    const r = await postScore(slug, score);
    if (!r.error) {
      for (const a of r.achievements || []) pushToast({ icon: a.icon || "🏆", title: "Achievement unlocked", text: a.name });
      if (r.becameNumberOneInGame) pushToast({ icon: "👑", title: "Number one!", text: `You top the ${name} leaderboard` });
    }
    return r;
  }, [slug, name, pushToast]);

  const btn = "w-9 h-9 rounded-lg border border-lineColor text-sm text-textDim hover:text-textLight hover:bg-bgPanel3 transition-colors flex items-center justify-center";
  return (
    <div className="relative">
      {!stage.isFull && (
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-lg" aria-hidden>{icon}</span>
            <span className="font-display font-bold truncate" style={{ color: accentColor }}>{name}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={onMute} aria-label={muted ? "Unmute sound" : "Mute sound"} title={muted ? "Sound off" : "Sound on"} className={btn}>{muted ? "🔇" : "🔊"}</button>
            <button type="button" onClick={stage.toggle} aria-label="Fullscreen" title="Fullscreen" className={btn}>⛶</button>
            {!confirm ? (
              <button type="button" onClick={() => setConfirm(true)} aria-label="Close game" title="Close game" className={btn}>✕</button>
            ) : (
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <button type="button" onClick={onExit} className="px-3 h-9 rounded-lg border text-accentMagenta" style={{ borderColor: "#ff3ea5" }}>Leave</button>
                <button type="button" onClick={() => setConfirm(false)} className="px-3 h-9 rounded-lg border border-lineColor text-textDim">Stay</button>
              </div>
            )}
          </div>
        </div>
      )}
      <GameComponent onScore={onScore} onFinish={onScore} accentColor={accentColor} onExit={onExit} />
      {toasts.length > 0 && (
        <div className="pointer-events-none fixed right-4 top-4 z-[10050] flex flex-col gap-2 items-end" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className="ap-pop-in flex items-center gap-3 rounded-xl border border-white/15 bg-[#1d1046]/95 backdrop-blur px-4 py-3 shadow-2xl">
              <span className="text-2xl" aria-hidden>{t.icon}</span>
              <span className="leading-tight">
                <span className="block font-mono text-[10px] uppercase tracking-wider text-accentAmber">{t.title}</span>
                <span className="block font-display font-bold text-sm text-textLight">{t.text}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
