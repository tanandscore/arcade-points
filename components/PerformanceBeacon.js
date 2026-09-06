"use client";

import { useEffect } from "react";
import { sendMetric } from "@/lib/telemetry";

// Real browser Performance Observer APIs only — nothing here is
// simulated or estimated. Fires small sendBeacon calls (designed
// specifically for "still deliver this even as the page is closing")
// rather than a normal fetch that could get cancelled mid-flight.
export default function PerformanceBeacon() {
  useEffect(() => {
    if (typeof window === "undefined" || !window.performance) return undefined;
    const path = window.location.pathname;

    let lcpValue = null;
    let clsValue = 0;
    let flushed = false; // guards against sending the same pageview's metrics twice across the three exit paths below

    let lcpObserver, clsObserver, fidObserver;
    try {
      lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) lcpValue = last.renderTime || last.loadTime || last.startTime;
      });
      lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      // not supported in every browser — skip silently, never break the page over this
    }

    try {
      clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) clsValue += entry.value;
        }
      });
      clsObserver.observe({ type: "layout-shift", buffered: true });
    } catch {
      // not supported in every browser
    }

    try {
      fidObserver = new PerformanceObserver((list) => {
        const [entry] = list.getEntries();
        if (entry) sendMetric(path, "fid", Math.round(entry.processingStart - entry.startTime));
      });
      fidObserver.observe({ type: "first-input", buffered: true });
    } catch {
      // not supported in every browser
    }

    function flush() {
      if (flushed) return;
      flushed = true;

      const [nav] = performance.getEntriesByType("navigation");
      if (nav) {
        sendMetric(path, "ttfb", Math.round(nav.responseStart));
        sendMetric(path, "load_time", Math.round(nav.loadEventEnd || nav.domContentLoadedEventEnd || 0));
      }
      sendMetric(path, "resource_count", performance.getEntriesByType("resource").length);
      if (lcpValue != null) sendMetric(path, "lcp", Math.round(lcpValue));
      sendMetric(path, "cls", Math.round(clsValue * 1000) / 1000);

      if (lcpObserver) lcpObserver.disconnect();
      if (clsObserver) clsObserver.disconnect();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") flush();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flush);

    // Also flush once the page has had a chance to settle, so a
    // quick bounce that never triggers pagehide/visibilitychange
    // (rare, but possible depending on how the tab closes) still
    // contributes a data point.
    const settleTimer = setTimeout(flush, 8000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flush);
      clearTimeout(settleTimer);
      if (fidObserver) fidObserver.disconnect();
    };
  }, []);

  return null;
}
