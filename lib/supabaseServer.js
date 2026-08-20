import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Used inside server components, layouts, and API route handlers.
// Reads the logged-in user's session from cookies, so RLS policies
// (e.g. "users can only insert their own score") are enforced correctly.
// Next.js 15+ made cookies() async, so this function is async too —
// every place that calls it needs to `await createServerSupabase()`.
export async function createServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
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
    }
  );
}

// Used ONLY on the server, ONLY for actions that must bypass RLS —
// e.g. granting a purchase after Stripe confirms payment.
// NEVER import this into a 'use client' file or expose this key to the browser.
import { createClient as createRawClient } from "@supabase/supabase-js";

export function createServiceSupabase() {
  return createRawClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}
