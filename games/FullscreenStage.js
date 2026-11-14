"use client";

// One shared "stage" for the big laptop-only games. It owns fullscreen for all four
// so they behave the same way: real browser fullscreen when allowed, and a
// fills-the-whole-window fallback when the browser refuses (for example inside a frame).
// Games ask it "are we full?" and size themselves to fill the screen when yes.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { LAPTOP_ONLY_SLUGS } from "@/lib/flagshipSlugs";

const StageCtx = createContext(null);

// Slugs that are laptop/desktop only.
export const LAPTOP_ONLY = new Set(LAPTOP_ONLY_SLUGS);

export function isLaptopLike() {
  if (typeof window === "undefined") return true;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  return !coarse && !noHover && window.innerWidth >= 900 && window.innerHeight >= 500;
}

function nudgeResize() {
  // Games with their own size watchers re-fit to the new box; this covers the ones that only listen to the window.
  requestAnimationFrame(() => { window.dispatchEvent(new Event("resize")); setTimeout(() => window.dispatchEvent(new Event("resize")), 120); });
}

export function useStage() {
  const c = useContext(StageCtx);
  return c || { isFull: false, enter() {}, exit() {}, toggle() {} };
}

// Style a game's main box with this: normal = fits the screen height and width (16:9), full = covers the whole screen.
export function stageBoxStyle(isFull, extra) {
  if (isFull) return { position: "fixed", inset: 0, width: "100%", height: "100%", maxHeight: "none", aspectRatio: "auto", borderRadius: 0, margin: 0, ...(extra || {}) };
  return { position: "relative", width: "min(100%, calc((100dvh - 150px) * 16 / 9))", aspectRatio: "16 / 9", maxHeight: "calc(100dvh - 150px)", margin: "0 auto", ...(extra || {}) };
}

// hideButton: the 2D games draw their own fullscreen button in a header bar, so the little overlay button is switched off for them.
export default function FullscreenStage({ children, hideButton = false }) {
  const ref = useRef(null);
  const [isFull, setFull] = useState(false);
  const pseudo = useRef(false);

  const sync = useCallback(() => {
    const real = !!document.fullscreenElement;
    setFull(real || pseudo.current);
    nudgeResize();
  }, []);

  useEffect(() => {
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, [sync]);

  // While full, lock page scrolling and let Esc leave the fallback mode too.
  useEffect(() => {
    if (!isFull) return undefined;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape" && pseudo.current && !document.fullscreenElement) { pseudo.current = false; sync(); } };
    window.addEventListener("keydown", onKey);
    return () => { document.documentElement.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [isFull, sync]);

  useEffect(() => () => { if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); }, []);

  const enter = useCallback(() => {
    if (document.fullscreenElement) return;
    const el = ref.current;
    pseudo.current = true; setFull(true); nudgeResize(); // fill the window right away
    if (el?.requestFullscreen) el.requestFullscreen().then(() => { pseudo.current = false; sync(); }).catch(() => {});
  }, [sync]);

  const exit = useCallback(() => {
    pseudo.current = false;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    setFull(false); nudgeResize();
  }, []);

  const toggle = useCallback(() => (document.fullscreenElement || pseudo.current ? exit() : enter()), [enter, exit]);
  const value = useMemo(() => ({ isFull, enter, exit, toggle }), [isFull, enter, exit, toggle]);

  return (
    <StageCtx.Provider value={value}>
      <div ref={ref} style={isFull ? { position: "fixed", inset: 0, zIndex: 9999, background: "#05050a", overflowY: "auto", overflowX: "hidden" } : { position: "relative" }}>
        {children}
        {!isFull && !hideButton && (
          <button type="button" onClick={enter} aria-label="Fullscreen" title="Fullscreen"
            style={{ position: "absolute", bottom: 8, left: 8, zIndex: 40, padding: "5px 10px", borderRadius: 8, opacity: 0.8, border: "1px solid rgba(255,255,255,0.35)", background: "rgba(0,0,0,0.6)", color: "#fff", font: "11px monospace", cursor: "pointer" }}>
            ⛶ Fullscreen
          </button>
        )}
        {isFull && (
          <button type="button" onClick={exit} aria-label="Exit fullscreen"
            style={{ position: "fixed", top: "66%", left: 0, zIndex: 10000, padding: "6px 8px", borderRadius: "0 8px 8px 0", opacity: 0.55, border: "1px solid rgba(255,255,255,0.25)", background: "rgba(0,0,0,0.45)", color: "rgba(255,255,255,0.7)", font: "11px monospace", cursor: "pointer" }}>
            ⛶ Exit
          </button>
        )}
      </div>
    </StageCtx.Provider>
  );
}
