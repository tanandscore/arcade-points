import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";

// Same reasoning as app/api/telemetry/route.js: no auth check since
// errors can happen for signed-out visitors too, and the service
// client is used because there's no user session to write through —
// the table's own INSERT policy (migration_064) already allows
// anyone to write, so this isn't a privilege escalation.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const { path, message, stack, userAgent } = body;
  if (typeof path !== "string" || path.length > 200) {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }
  if (typeof message !== "string" || message.length === 0 || message.length > 2000) {
    return NextResponse.json({ error: "Invalid message." }, { status: 400 });
  }
  if (stack != null && (typeof stack !== "string" || stack.length > 4000)) {
    return NextResponse.json({ error: "Invalid stack." }, { status: 400 });
  }
  if (userAgent != null && (typeof userAgent !== "string" || userAgent.length > 500)) {
    return NextResponse.json({ error: "Invalid userAgent." }, { status: 400 });
  }

  const service = createServiceSupabase();
  const { error } = await service.from("error_events").insert({
    path,
    message,
    stack: stack || null,
    user_agent: userAgent || null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
