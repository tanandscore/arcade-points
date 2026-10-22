const LIGHT_COLORS = ["#3ee6e0", "#ffb703", "#ff3ea5"];

// Rendered instantly by Next.js while a route's data is still
// loading — this is what makes navigating between pages feel like
// snapping to the next screen in an app instead of waiting on a
// browser tab.
export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-bgDeep flex flex-col items-center justify-center gap-4">
      <div className="flex gap-2">
        {new Array(8).fill(0).map((_, i) => {
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
      <p className="font-pixel text-[10px] text-textDim">LOADING...</p>
    </div>
  );
}
