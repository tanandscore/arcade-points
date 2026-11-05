// Mirrors lib/telemetry.js's sendMetric — same sendBeacon approach
// (delivers even as the page is closing, unlike a normal fetch that
// could get cancelled mid-flight), same silent-failure philosophy
// (error reporting itself must never throw or break the page it's
// trying to report on).
export function sendError(path, message, stack) {
  if (typeof window === "undefined" || !navigator.sendBeacon) return;
  try {
    const blob = new Blob(
      [JSON.stringify({ path, message: String(message).slice(0, 2000), stack: stack ? String(stack).slice(0, 4000) : null, userAgent: navigator.userAgent })],
      { type: "application/json" }
    );
    navigator.sendBeacon("/api/errors", blob);
  } catch {
    // same reasoning as sendMetric — never let error reporting itself become a source of errors
  }
}

// Server-side read, used only by the admin errors dashboard — the
// table's own RLS policy (migration_064) already restricts SELECT to
// admins, so this is a thin, ordinary query, not a privilege check
// of its own.
export async function getRecentErrors(supabase, limit = 100) {
  const { data } = await supabase
    .from("error_events")
    .select("id, path, message, stack, user_agent, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data || [];
}
