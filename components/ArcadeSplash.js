"use client";

import { useEffect, useState } from "react";

const LIGHT_COLORS = ["#3ee6e0", "#ffb703", "#ff3ea5"];

// A classic arcade-cabinet "attract mode" gate. The tap or key press
// that dismisses this is a real user gesture — the one thing browsers
// require before any site can play audio — so it doubles as the
// moment the background music actually starts, instead of a silent
// requirement hidden behind a small toggle button.
export default function ArcadeSplash() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    function handleKey(e) {
      if (e.key === "Enter" || e.key === " ") setDismissed(true);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  if (dismissed) return null;

  return (
    <div
      onClick={() => setDismissed(true)}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bgDeep cursor-pointer px-6"
    >
      <div className="flex gap-2 mb-6">
        {new Array(14).fill(0).map((_, i) => {
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
      <p className="font-pixel text-lg sm:text-2xl text-textLight mb-2 text-center">TAP & SCORE</p>
      <p className="font-mono text-xs text-textDim mb-10 text-center">Free arcade games. No downloads. No bloatware.</p>
      <p className="font-pixel text-sm text-accentAmber ap-blink mb-3">PRESS START ▸</p>
      <p className="font-mono text-[10px] text-textDim">🔊 Tap or press any key to enter — turns on the arcade soundtrack</p>
    </div>
  );
}
