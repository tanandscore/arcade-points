// The Worker OpenNext generates only exports a fetch handler, and
// that generated file (.open-next/worker.js) is rebuilt fresh on
// every `opennextjs-cloudflare build`, so a scheduled handler can't
// just be added inside it directly. This is the officially
// documented way around that: a small, hand-written entry point that
// re-uses the generated fetch handler untouched and adds the one
// thing this project actually needs alongside it — a scheduled
// handler for the daily streak-reminder cron job. wrangler.toml's
// `main` points here instead of straight at the generated file.
// @ts-ignore `.open-next/worker.js` is generated at build time
import { default as handler } from "./.open-next/worker.js";
import { createClient } from "@supabase/supabase-js";
import { findAtRiskUsers, sendStreakReminderEmail } from "./lib/streakReminders.js";
import { BlacksiteRoom } from "./blacksite/server/room.js";

// Multiplayer rooms for Operation Blacksite live in a Durable Object (one per room code) — exported from here so Cloudflare can find the class,
// and reached at /mp/blacksite/<CODE> before the request ever gets to the Next.js app.
export { BlacksiteRoom };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/mp/blacksite/")) {
      const code = (url.pathname.split("/")[3] || "").toUpperCase();
      if (!/^[A-Z0-9]{5}$/.test(code)) return new Response("Bad room code", { status: 400 });
      if (!env.BLACKSITE_ROOMS) return new Response("Multiplayer is not set up on this deployment", { status: 503 });
      return env.BLACKSITE_ROOMS.get(env.BLACKSITE_ROOMS.idFromName("bs:" + code)).fetch(request);
    }
    return handler.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runStreakReminders(env));
  },
};

async function runStreakReminders(env) {
  // Uses the raw env object passed directly to this scheduled
  // handler, not process.env — that global is populated by OpenNext's
  // request-handling wrapper for normal fetch requests through the
  // Next.js app, which this scheduled handler runs entirely outside
  // of (it's a raw Worker cron invocation, not an HTTP request), so
  // process.env would not be populated here the way it is in
  // lib/supabaseServer.js.
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const atRisk = await findAtRiskUsers(supabase);
  for (const user of atRisk) {
    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(user.userId);
      const email = authUser?.user?.email;
      if (!email) continue;
      await sendStreakReminderEmail(env, email, user.username, user.streak);
    } catch (err) {
      // One failed send (bad address, rate limit, etc.) should never
      // stop the rest of the batch from going out.
      console.error(`Streak reminder failed for ${user.userId}:`, err);
    }
  }
}
