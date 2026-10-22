import { useEffect, useState } from "react";
import Link from "next/link";
import { haptics } from "@/lib/haptics";

const TIER_COLORS = {
  bronze: "#cd7f32",
  silver: "#c0c0c0",
  gold: "#ffd700",
  legendary: "#ff3ea5",
};

export default function ResultOverlay({
  gameName,
  accentColor,
  score,
  isNewBest,
  best,
  becameNumberOneInGame,
  becameNumberOneOverall,
  newlyUnlockedAchievements,
  xpGained,
  error,
  offlineQueued,
  onPlayAgain,
  onBack,
  related = [],
  slug,
}) {
  const shown = useCountUp(score);
  const grade = gradeFor(score, best, isNewBest || celebratingProp(becameNumberOneInGame, becameNumberOneOverall));
  const [copied, setCopied] = useState(false);
  const shareText = `I scored ${score.toLocaleString()} on ${gameName} — Tap & Score. Can you beat it?`;
  const shareUrl = typeof window !== "undefined" && slug ? `${window.location.origin}/games/${slug}` : "https://tapandscore.com";
  const share = async () => { try { if (navigator.share) { await navigator.share({ title: gameName, text: shareText, url: shareUrl }); return; } await navigator.clipboard.writeText(shareText + " " + shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch {} };
  const celebrating = becameNumberOneInGame || becameNumberOneOverall;
  const hasNewAchievements = newlyUnlockedAchievements && newlyUnlockedAchievements.length > 0;

  useEffect(() => {
    if (celebrating || hasNewAchievements) haptics.celebrate();
    else if (isNewBest) haptics.success();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="ap-pop-in fixed inset-0 flex items-center justify-center z-40 bg-[rgba(18,9,43,0.9)] overflow-hidden">
      {(celebrating || isNewBest) && <ConfettiBurst />}
      <div
        className="rounded-xl border p-8 text-center max-w-sm w-full mx-4 bg-bgPanel relative z-10"
        style={{ borderColor: celebrating ? "#ffb703" : accentColor }}
      >
        {celebrating ? (
          <div className="mb-3">
            <div className="text-3xl mb-1">👑</div>
            <div className="font-pixel text-[11px] text-accentAmber leading-relaxed">
              {becameNumberOneOverall && becameNumberOneInGame
                ? "#1 OVERALL & #1 IN " + gameName.toUpperCase() + "!"
                : becameNumberOneOverall
                ? "YOU'RE #1 OVERALL!"
                : `YOU'RE #1 IN ${gameName.toUpperCase()}!`}
            </div>
          </div>
        ) : (
          isNewBest && <div className="font-pixel text-[10px] mb-2 text-accentAmber">★ NEW BEST ★</div>
        )}
        <div className="font-mono text-xs uppercase mb-1 text-textDim">{gameName} score</div>
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="font-pixel text-3xl tabular-nums" style={{ color: accentColor, textShadow: `0 0 24px ${accentColor}88` }}>{shown.toLocaleString()}</div>
          <div className="ap-pop-in w-12 h-12 rounded-xl flex items-center justify-center font-pixel text-xl" style={{ border: `2px solid ${grade.color}`, color: grade.color, boxShadow: `0 0 18px -4px ${grade.color}` }} title="Run grade compared with your best">{grade.letter}</div>
        </div>
        <div className="font-mono text-[11px] text-textDim">Personal best: {best.toLocaleString()}{!isNewBest && best > score ? <span className="text-accentAmber"> · {(best - score).toLocaleString()} to beat it</span> : null}</div>
        <div className="mb-6 mt-1 font-mono text-[11px]" style={{ color: "#3ee6e0" }}>
          {xpGained > 0 ? `+${xpGained} XP` : "\u00A0"}
        </div>
        {offlineQueued && (
          <div className="mb-6 rounded-md border p-2.5 text-left" style={{ borderColor: "#3ee6e0", background: "rgba(62,230,224,0.08)" }}>
            <p className="font-mono text-[11px] text-accentCyan">📡 Saved offline — this score will sync automatically once you're back online.</p>
          </div>
        )}
        {error && !offlineQueued && (
          <div className="mb-6 rounded-md border p-2.5 text-left" style={{ borderColor: "#ff3ea5", background: "rgba(255,62,165,0.08)" }}>
            <p className="font-mono text-[11px] text-accentMagenta">{error}</p>
          </div>
        )}
        {newlyUnlockedAchievements && newlyUnlockedAchievements.length > 0 && (
          <div className="mb-6 space-y-2">
            {newlyUnlockedAchievements.map((a) => (
              <div
                key={a.id}
                className="ap-pop-in flex items-center gap-2.5 rounded-md border p-2.5 text-left"
                style={{ borderColor: TIER_COLORS[a.tier] || accentColor, background: "rgba(255,255,255,0.04)" }}
              >
                <span className="text-lg shrink-0">{a.icon}</span>
                <div className="min-w-0">
                  <p className="font-mono text-[9px] uppercase tracking-wide" style={{ color: TIER_COLORS[a.tier] || accentColor }}>
                    Achievement Unlocked
                  </p>
                  <p className="font-mono text-[11px] text-textLight">{a.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2 justify-center mb-4">
          <button type="button" onClick={share} className="font-mono text-[11px] px-3 py-1.5 rounded-full border border-lineColor text-textDim hover:text-textLight">{copied ? "✓ Copied" : "📤 Share score"}</button>
          <a href={`https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`} target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] px-3 py-1.5 rounded-full border border-lineColor text-textDim hover:text-textLight">WhatsApp</a>
        </div>
        <div className="flex gap-3">
          <button
            onClick={onPlayAgain}
            className="flex-1 rounded-md py-2.5 font-pixel text-[9px] text-bgDeep"
            style={{ background: accentColor }}
          >
            PLAY AGAIN
          </button>
          <button onClick={onBack} className="flex-1 rounded-md py-2.5 font-mono text-[11px] border border-lineColor text-textLight">
            Arcade
          </button>
        </div>
        {related.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className="font-mono text-[10px] text-textDim mb-2">TRY NEXT</p>
            <div className="flex gap-2 justify-center flex-wrap">
              {related.map((g) => <Link key={g.slug} href={`/games/${g.slug}`} className="font-mono text-[11px] px-3 py-1.5 rounded-full border border-lineColor text-textLight hover:border-accentCyan">{g.icon} {g.name}</Link>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConfettiBurst() {
  const colors = ["#ffb703", "#3ee6e0", "#ff3ea5", "#b6ff3e"];
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.4,
    duration: 1.6 + Math.random() * 1.2,
    color: colors[i % colors.length],
    size: 6 + Math.random() * 6,
  }));
  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="ap-confetti-piece absolute top-[-5%]"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}


function celebratingProp(a, b) { return !!(a || b); }

// S = a new personal best, then A/B/C/D by how close the run was to your best
function gradeFor(score, best, isBest) {
  if (isBest) return { letter: "S", color: "#ffd700" };
  const r = best > 0 ? score / best : 1;
  if (r >= 0.9) return { letter: "A", color: "#3ee6e0" };
  if (r >= 0.7) return { letter: "B", color: "#b6ff3e" };
  if (r >= 0.45) return { letter: "C", color: "#ffb703" };
  return { letter: "D", color: "#ff3ea5" };
}

// Animated count-up so the score "lands" instead of just appearing
function useCountUp(target, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    let raf, t0;
    const step = (t) => { if (t0 === undefined) t0 = t; const k = Math.min(1, (t - t0) / ms); setV(Math.round(target * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}
