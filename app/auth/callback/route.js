import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

// This app uses @supabase/ssr, whose sign-up confirmation flow uses a PKCE `code` parameter that has to be explicitly
// exchanged for a session server-side. This route does that exchange (sign-up confirmation links, and the older
// password-reset links that are still sitting in people's inboxes; new reset links no longer come through here).
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/dashboard";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (code) {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // a reset link is recognised by what Supabase says it is, so it works even when the page it came back to had no "next" part
      const recovery = data?.redirectType === "recovery";
      return NextResponse.redirect(`${origin}${recovery ? "/reset-password" : safeNext}`);
    }
  }

  // a reset link that could not be used (expired, already clicked, or opened in a different browser than the one that asked for it)
  if (safeNext.startsWith("/reset-password")) return NextResponse.redirect(`${origin}/forgot-password?error=link`);
  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
}
