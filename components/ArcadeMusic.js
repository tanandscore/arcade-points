"use client";

import { useEffect, useRef, useState } from "react";
import { createArcadeMusic, isMuted, toggleMuted } from "@/lib/sound";

// Drop this into a page to play looping retro arcade background music
// with a floating toggle button. Handles the browser-autoplay dance
// itself: music is silent until the first click anywhere on the page
// (or on the toggle), since browsers only allow starting audio in
// direct response to a real user gesture.
export default function ArcadeMusic() {
  const [muted, setMutedState] = useState(true);
  const musicRef = useRef(null);

  useEffect(() => {
    setMutedState(isMuted());
    musicRef.current = createArcadeMusic();

    function handleFirstInteraction() {
      musicRef.current?.resumeIfNeeded();
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
    }
    window.addEventListener("click", handleFirstInteraction);
    window.addEventListener("touchstart", handleFirstInteraction);

    return () => {
      musicRef.current?.stop();
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
    };
  }, []);

  function handleToggle() {
    const nowMuted = toggleMuted();
    setMutedState(nowMuted);
    if (!nowMuted) musicRef.current?.resumeIfNeeded();
  }

  return (
    <button
      onClick={handleToggle}
      aria-label={muted ? "Turn music on" : "Turn music off"}
      className="fixed z-40 bottom-20 sm:bottom-6 right-4 w-11 h-11 rounded-full border flex items-center justify-center text-lg bg-bgPanel shadow-lg"
      style={{ borderColor: muted ? "#3a2a63" : "#ffb703" }}
    >
      <span className={muted ? "" : "ap-blink"}>{muted ? "🔇" : "🔊"}</span>
    </button>
  );
}
