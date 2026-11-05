import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

// Works from ANY browser or phone mail app (unlike the code flow, it needs no cookie from the device that asked for the email).
// Use it by setting the "Reset password" and "Confirm signup" email templates in Supabase to:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password      (reset)
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/dashboard              (signup)
//
// A password-reset link is NOT checked here. Email programs often open every link in a message to scan it, and a reset
// token works only once, so checking it on this page load would let the scanner use it up before the person ever clicks.
// Instead the person is handed on to /reset-password with the token, and it is checked only when they press "Save".
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/dashboard";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  if (token_hash && type === "recovery") {
    return NextResponse.redirect(`${origin}/reset-password?token_hash=${encodeURIComponent(token_hash)}&type=recovery`);
  }

  const supabase = await createServerSupabase();
  let ok = false;
  let recovery = false;
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    ok = !error;
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
    recovery = data?.redirectType === "recovery";
  }
  if (ok) return NextResponse.redirect(`${origin}${recovery ? "/reset-password" : safeNext}`);
  return NextResponse.redirect(`${origin}${safeNext.startsWith("/reset-password") ? "/forgot-password?error=link" : "/login?error=confirmation_failed"}`);
}
