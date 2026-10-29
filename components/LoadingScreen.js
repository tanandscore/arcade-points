// Rendered instantly by Next.js while a route's data is still loading — this is what makes navigating between pages feel like
// snapping to the next screen in an app instead of waiting on a browser tab. (Upgrade 70: the blinking marquee lights are gone;
// it is now the logo and a quiet bar, in the same colours as the rest of the store.)
export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-bgDeep flex flex-col items-center justify-center gap-5" role="status" aria-label="Loading">
      <p className="st-logo" style={{ fontSize: 14 }}>TAP<b>&amp;</b>SCORE</p>
      <div className="w-40 h-1 rounded-full bg-white/10 overflow-hidden">
        <i className="block h-full w-1/3 rounded-full animate-pulse" style={{ background: "linear-gradient(90deg,#3ee6e0,#ff3ea5)" }} />
      </div>
    </div>
  );
}
