const LIGHT_COLORS = ["#3ee6e0", "#ffb703", "#ff3ea5"];

// Shown only for the moment a game's own code is being fetched —
// with per-game code-splitting, this is what replaces "the whole
// site feels slow" with "this one game takes a beat to appear."
export default function GameLoadingInline() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <div className="flex gap-2">
        {new Array(6).fill(0).map((_, i) => {
          const color = LIGHT_COLORS[i % LIGHT_COLORS.length];
          return (
            <span
              key={i}
              className="ap-marquee-light inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: color, color, animationDelay: `${(i % 6) * 0.12}s` }}
            />
          );
        })}
      </div>
      <p className="font-pixel text-[10px] text-textDim">LOADING GAME...</p>
    </div>
  );
}
