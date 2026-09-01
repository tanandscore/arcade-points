import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function middleware(request) {
  // Anyone reaching the raw workers.dev address gets sent to the
  // real domain instead — both work, but tapandscore.com is the one
  // people should actually be sharing/bookmarking.
  const host = request.headers.get("host") || "";
  if (host.endsWith(".workers.dev")) {
    const url = new URL(request.url);
    url.hostname = "tapandscore.com";
    url.port = "";
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }

  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return request.cookies.get(name)?.value;
        },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  await supabase.auth.getUser();

  // Maintenance mode: checked AFTER auth so a real session is
  // available to test for admin status. Only queries site_settings
  // at all — a cheap single-row lookup — meaning the normal case
  // (maintenance off) costs nothing extra beyond what already ran.
  // /login and /maintenance itself are always exempt — an admin
  // needs to be able to log in during maintenance to turn it back
  // off, and the maintenance page itself can't redirect to itself.
  const pathname = request.nextUrl.pathname;
  const alwaysAllowed = pathname === "/maintenance" || pathname === "/login" || pathname.startsWith("/api/");
  if (!alwaysAllowed) {
    const { data: settings } = await supabase.from("site_settings").select("maintenance_mode").eq("id", 1).maybeSingle();
    if (settings?.maintenance_mode) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      let admin = false;
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
        admin = profile?.is_admin || false;
      }
      if (!admin) {
        const url = new URL("/maintenance", request.url);
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
