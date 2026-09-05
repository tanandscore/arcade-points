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
// screen, the homepage, the dashboard, and the tournament page — so
// the ticking logic and formatting only exist in one place.
export default function CountdownTimer({ targetIso, onComplete, size = "md" }) {
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

  const numClass = size === "lg" ? "text-2xl" : size === "sm" ? "text-xs" : "text-base";
  const lblClass = size === "lg" ? "text-[9px]" : "text-[8px]";
  const gap = size === "lg" ? "gap-4" : "gap-2.5";

  return (
    <div className={`flex justify-center ${gap} font-pixel`}>
      {[
        ["DAYS", remaining.days],
        ["HRS", remaining.hours],
        ["MIN", remaining.mins],
        ["SEC", remaining.secs],
      ].map(([label, val]) => (
        <div key={label} className="text-center">
          <div className={`${numClass} text-accentCyan`}>{String(val).padStart(2, "0")}</div>
          <div className={`${lblClass} text-textDim mt-1`}>{label}</div>
        </div>
      ))}
    </div>
  );
}
