import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Same public fallback values as lib/supabaseClient.js — see the
// comment there for why these are safe to have directly in code.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bopgqmomqckinkcezdro.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_UKtSNB2lnCBrHMI84GZpuA_DZ4GGu0o";

// Used inside server components, layouts, and API route handlers.
// Reads the logged-in user's session from cookies, so RLS policies
// (e.g. "users can only insert their own score") are enforced correctly.
// Next.js 15+ made cookies() async, so this function is async too —
// every place that calls it needs to `await createServerSupabase()`.
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get(name) {
        return cookieStore.get(name)?.value;
      },
      set(name, value, options) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // called from a Server Component - middleware handles refresh instead
        }
      },
      remove(name, options) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // same as above
        }
      },
    },
  });
}

// Used ONLY on the server, ONLY for actions that must bypass RLS —
// e.g. granting a purchase after Razorpay confirms payment.
// NEVER import this into a 'use client' file or expose this key to the browser.
// Unlike the URL/anon key above, SUPABASE_SERVICE_ROLE_KEY has NO fallback
// here on purpose — it's genuinely secret and must only ever come from
// Cloudflare's Variables and Secrets (confirmed working for server-side
// runtime values, unlike the client-build-time issue this file also fixes).
import { createClient as createRawClient } from "@supabase/supabase-js";

export function createServiceSupabase() {
  return createRawClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}
