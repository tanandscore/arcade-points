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

export default {
  fetch: handler.fetch,

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
