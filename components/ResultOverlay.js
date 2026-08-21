export default function ResultOverlay({
  gameName,
  accentColor,
  score,
  isNewBest,
  best,
  becameNumberOneInGame,
  becameNumberOneOverall,
  onPlayAgain,
  onBack,
}) {
  const celebrating = becameNumberOneInGame || becameNumberOneOverall;

  return (
    <div className="ap-pop-in fixed inset-0 flex items-center justify-center z-40 bg-[rgba(18,9,43,0.9)] overflow-hidden">
      {celebrating && <ConfettiBurst />}
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
        <div className="font-pixel text-2xl mb-4" style={{ color: accentColor }}>
          {score.toLocaleString()}
        </div>
        <div className="font-mono text-[11px] mb-6 text-textDim">Personal best: {best.toLocaleString()}</div>
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
