"use client";

import { createBrowserClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";

// These two fallback values are the actual public Project URL and
// publishable/anon key — safe to have directly in code, since they're
// DESIGNED to be public (Supabase's security rules, not secrecy,
// protect your data). They're used only if the environment variable
// isn't set, which covers hosts whose build pipeline doesn't pass
// NEXT_PUBLIC_... values through (as Cloudflare's Workers Builds
// turned out not to, for .env.production files specifically).
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bopgqmomqckinkcezdro.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_UKtSNB2lnCBrHMI84GZpuA_DZ4GGu0o";

// Used inside 'use client' components (login form, game pages, etc.)
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// Used ONLY to ask for a password-reset email. Unlike the client above (which uses the "PKCE" sign-in style that only works in the very browser that
// asked), this one asks for the older "token in the link" style, so the emailed link works from ANY browser or phone - the common case is asking on a
// laptop and opening the email on a phone. It keeps no session of its own and the link it produces is still single-use and short-lived.
export function createResetRequestClient() {
  return createPlainClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}
