import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";

const ALLOWED_METRICS = new Set(["lcp", "cls", "ttfb", "fid", "load_time", "game_launch", "resource_count"]);

// Deliberately no auth check — this needs to work for signed-out
// visitors on the homepage, not just logged-in users, and it carries
// no sensitive data. The service client is used because an
// unauthenticated request has no user session to write through, and
// the table's own INSERT policy already allows anyone to write
// anyway (see migration_048) — this isn't a privilege escalation,
// just the practical way to write without a session.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const { path, metric, value } = body;
  if (typeof path !== "string" || path.length > 200) {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }
  if (!ALLOWED_METRICS.has(metric)) {
    return NextResponse.json({ error: "Invalid metric." }, { status: 400 });
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value >= 600000) {
    return NextResponse.json({ error: "Invalid value." }, { status: 400 });
  }

  const service = createServiceSupabase();
  const { error } = await service.from("performance_events").insert({ path, metric, value });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
