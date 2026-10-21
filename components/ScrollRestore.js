"use client";

import { useEffect, useRef } from "react";

const KEY = "dashboard-scroll-y";

// Continuously remembers how far down the dashboard you've scrolled,
// and jumps back there the moment you return (e.g. after exiting or
// finishing a game) — instead of dropping you back at the top and
// making you scroll down to find where you were.
export default function ScrollRestore() {
  const restoredRef = useRef(false);

  useEffect(() => {
    if (!restoredRef.current) {
      restoredRef.current = true;
      const saved = sessionStorage.getItem(KEY);
      if (saved) {
        // wait a frame so the full game grid has actually laid out
        // before we try to scroll to a position within it
        requestAnimationFrame(() => {
          window.scrollTo(0, parseInt(saved, 10));
        });
      }
    }

    function handleScroll() {
      sessionStorage.setItem(KEY, String(window.scrollY));
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return null;
}
