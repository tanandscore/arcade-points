"use client";

import { useState } from "react";

export default function ShareRankButton({ rank, total, boardName }) {
  const [copied, setCopied] = useState(false);
  const text = `I'm ranked #${rank} on Tap & Score's ${boardName} leaderboard with ${total.toLocaleString()} points! 🎮 Play free: https://tapandscore.com`;

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {
        // user cancelled the share sheet — nothing to do
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard permission denied — silently ignore, button just won't confirm
    }
  }

  return (
    <button
      onClick={handleShare}
      className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-accentCyan text-accentCyan"
    >
      {copied ? "Copied!" : "📤 Share my rank"}
    </button>
  );
}
