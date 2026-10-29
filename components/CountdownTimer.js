"use client";

import { useEffect, useState } from "react";

function getRemaining(targetIso) {
  const diff = new Date(targetIso).getTime() - Date.now();
  if (diff <= 0) return null;
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
    secs: Math.floor((diff % 60000) / 1000),
  };
}

// Reused everywhere a countdown needs to render — the game-lock
// screen, the store front page, and the tournament page — so
// the ticking logic and formatting only exist in one place.
// Upgrade 70: plain bold numbers in the store's heading font instead of pixel digits. align="start" keeps it on the left edge of a card.
export default function CountdownTimer({ targetIso, onComplete, size = "md", align = "center" }) {
  const [remaining, setRemaining] = useState(() => getRemaining(targetIso));

  useEffect(() => {
    const id = setInterval(() => {
      const r = getRemaining(targetIso);
      setRemaining(r);
      if (!r) {
        clearInterval(id);
        if (onComplete) onComplete();
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIso]);

  if (!remaining) return null;

  const numClass = size === "lg" ? "text-4xl" : size === "sm" ? "text-lg" : "text-2xl";
  const gap = size === "lg" ? "gap-6" : "gap-4";

  return (
    <div className={`flex ${align === "start" ? "justify-start" : "justify-center"} ${gap}`} role="timer" aria-label="Time remaining">
      {[
        ["days", remaining.days],
        ["hours", remaining.hours],
        ["min", remaining.mins],
        ["sec", remaining.secs],
      ].map(([label, val]) => (
        <div key={label} className="min-w-[2.4rem] text-center">
          <div className={`${numClass} font-extrabold leading-none tabular-nums text-accentCyan`} style={{ fontFamily: "'Bricolage Grotesque','Space Grotesk',sans-serif" }}>{String(val).padStart(2, "0")}</div>
          <div className="mt-1.5 text-[12px] text-[#a99fd6]">{label}</div>
        </div>
      ))}
    </div>
  );
}
