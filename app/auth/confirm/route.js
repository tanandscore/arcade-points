import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabaseServer";

// Works from ANY browser or phone mail app (unlike the code flow, it needs no cookie from the device that asked for the email).
// Use it by setting the "Reset password" and "Confirm signup" email templates in Supabase to:
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password      (reset)
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/dashboard              (signup)
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/dashboard";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const supabase = await createServerSupabase();

  let ok = false;
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }
  if (ok) return NextResponse.redirect(`${origin}${safeNext}`);
  return NextResponse.redirect(`${origin}${safeNext.startsWith("/reset-password") ? "/forgot-password?error=link" : "/login?error=confirmation_failed"}`);
}
