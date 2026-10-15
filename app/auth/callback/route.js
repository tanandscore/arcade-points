import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

// The actual missing piece behind "email verification isn't working
// properly": this app uses @supabase/ssr, whose signup confirmation
// flow uses a PKCE `code` parameter that has to be explicitly
// exchanged for a session server-side — it doesn't just work by
// landing on any page with a Supabase client on it, unlike the older
// hash-token flow. Without this route, clicking the confirmation
// link in the email had nowhere to complete that exchange, so
// accounts likely ended up confirmed on Supabase's side but the
// person never actually got signed in.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/dashboard";

  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`);
}
