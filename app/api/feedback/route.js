import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

export async function POST(request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { message } = await request.json();
  const trimmed = (message || "").trim();

  if (trimmed.length < 3 || trimmed.length > 2000) {
    return NextResponse.json({ error: "Feedback needs to be between 3 and 2000 characters." }, { status: 400 });
  }

  const { error } = await supabase.from("feedback").insert({ user_id: user.id, message: trimmed });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Also email every piece of feedback to info@tapandscore.com (best effort: the feedback is already saved above, so a mail problem never loses it)
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    if (ctx?.env?.EMAIL?.send) {
      const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const who = user.email || user.id;
      const send = ctx.env.EMAIL.send({
        to: "info@tapandscore.com",
        from: "Tap & Score <accounts@tapandscore.com>",
        replyTo: user.email || undefined,
        subject: "New feedback on Tap & Score",
        text: `New feedback from ${who}\n\n${trimmed}`,
        html: `<p><b>New feedback from ${esc(who)}</b></p><p style="white-space:pre-wrap">${esc(trimmed)}</p>`,
      });
      if (ctx.ctx?.waitUntil) ctx.ctx.waitUntil(send.catch(() => {})); else await send.catch(() => {});
    }
  } catch {}

  return NextResponse.json({ success: true });
}
