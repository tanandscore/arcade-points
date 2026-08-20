export default function ResultOverlay({ gameName, accentColor, score, isNewBest, best, onPlayAgain, onBack }) {
  return (
    <div className="ap-pop-in fixed inset-0 flex items-center justify-center z-40 bg-[rgba(18,9,43,0.9)]">
      <div className="rounded-xl border p-8 text-center max-w-sm w-full mx-4 bg-bgPanel" style={{ borderColor: accentColor }}>
        {isNewBest && <div className="font-pixel text-[10px] mb-2 text-accentAmber">★ NEW BEST ★</div>}
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
