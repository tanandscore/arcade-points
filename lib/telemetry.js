// Shared by PerformanceBeacon.js (page-level Web Vitals) and
// GameRunner.js (game launch timing) so the sendBeacon logic exists
// in exactly one place.
export function sendMetric(path, metric, value) {
  if (typeof window === "undefined" || !navigator.sendBeacon) return;
  try {
    const blob = new Blob([JSON.stringify({ path, metric, value })], { type: "application/json" });
    navigator.sendBeacon("/api/telemetry", blob);
  } catch {
    // telemetry failing silently is fine — it should never affect the thing it's measuring
  }
}
