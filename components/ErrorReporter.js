"use client";

import { useEffect } from "react";
import { sendError } from "@/lib/errorReporting";

// Catches uncaught JS errors and unhandled promise rejections across
// the whole site — including inside the canvas-rendered games, which
// is exactly the kind of place a bug like the Wrath of Olympus crash
// (found and fixed earlier this session) would otherwise go silent
// until a real player happened to notice and report it.
export default function ErrorReporter() {
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const path = window.location.pathname;
    // A single repeating error (e.g. one thrown inside a game's
    // per-frame render loop) could otherwise fire hundreds of times
    // a second — dedupe by message so each distinct error is only
    // reported once per page load, not once per occurrence.
    const seen = new Set();

    function report(message, stack) {
      const key = String(message).slice(0, 200);
      if (seen.has(key)) return;
      seen.add(key);
      sendError(path, message, stack);
    }

    function handleError(event) {
      // Cross-origin script errors surface as a bare "Script error."
      // with no real message or stack — not actionable, skip them
      // rather than reporting noise.
      if (event.message === "Script error." && !event.error) return;
      report(event.error?.message || event.message || "Unknown error", event.error?.stack);
    }

    function handleRejection(event) {
      const reason = event.reason;
      const message = reason instanceof Error ? reason.message : String(reason);
      const stack = reason instanceof Error ? reason.stack : undefined;
      report(message, stack);
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
