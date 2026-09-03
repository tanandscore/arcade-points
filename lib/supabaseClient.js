"use client";

import { createBrowserClient } from "@supabase/ssr";

// These two fallback values are the actual public Project URL and
// publishable/anon key — safe to have directly in code, since they're
// DESIGNED to be public (Supabase's security rules, not secrecy,
// protect your data). They're used only if the environment variable
// isn't set, which covers hosts whose build pipeline doesn't pass
// NEXT_PUBLIC_... values through (as Cloudflare's Workers Builds
// turned out not to, for .env.production files specifically).
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bopgqmomqckinkcezdro.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_UKtSNB2lnCBrHMI84GZpuA_DZ4GGu0o";

// Used inside 'use client' components (login form, game pages, etc.)
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
