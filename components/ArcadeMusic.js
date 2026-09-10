"use client";

import { useEffect, useRef, useState } from "react";
import { createArcadeMusic, isMuted, toggleMuted } from "@/lib/sound";

// Drop this into a page to play looping retro arcade background music
// with a floating toggle button. Handles the browser-autoplay dance
// itself: music is silent until the first click anywhere on the page
// (or on the toggle), since browsers only allow starting audio in
// direct response to a real user gesture — that's expected on every
// website, not a bug, but the button makes it an obvious invitation
// rather than a silent icon that looks broken.
export default function ArcadeMusic() {
  // Starts false (not muted) to match the real default — starting
  // this at true meant the button showed 🔇 on first paint even
  // though sound was actually on, so a visitor's first click often
  // muted it by accident instead of starting it.
  const [muted, setMutedState] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const musicRef = useRef(null);

  useEffect(() => {
    setMutedState(isMuted());
    musicRef.current = createArcadeMusic();

    function handleFirstInteraction() {
      setInteracted(true);
      musicRef.current?.resumeIfNeeded();
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
    }
    window.addEventListener("click", handleFirstInteraction);
    window.addEventListener("touchstart", handleFirstInteraction);
    window.addEventListener("keydown", handleFirstInteraction);

    return () => {
      musicRef.current?.stop();
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
    };
  }, []);

  function handleToggle() {
    setInteracted(true);
    const nowMuted = toggleMuted();
    setMutedState(nowMuted);
    // Called directly inside this click handler (not just relying on
    // the window listener) so the very first tap on this exact button
    // reliably starts audio, regardless of event-ordering quirks.
    if (!nowMuted) musicRef.current?.resumeIfNeeded();
  }

  return (
    <button
      onClick={handleToggle}
      aria-label={muted ? "Turn music on" : "Turn music off"}
      className="fixed z-40 bottom-20 sm:bottom-6 right-4 rounded-full border flex items-center gap-2 bg-bgPanel shadow-lg font-mono text-[10px] text-textLight transition-all"
      style={{
        borderColor: muted ? "#3a2a63" : "#ffb703",
        padding: !interacted && !muted ? "10px 16px" : "12px",
      }}
    >
      <span className={muted ? "text-lg" : "text-lg ap-blink"}>{muted ? "🔇" : "🔊"}</span>
      {!interacted && !muted && <span className="whitespace-nowrap">Tap for music</span>}
    </button>
  );
}
