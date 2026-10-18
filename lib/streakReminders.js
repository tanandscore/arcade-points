import { currentStreakDays } from "./achievements";

// Minimum streak length worth emailing about — a 1-day "streak" has
// nothing real to lose yet, so reminding someone about it the day
// after their first visit would feel premature and pushy rather than
// like a real, earned nudge.
const MIN_STREAK_TO_REMIND = 2;

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

// Finds every user whose streak is genuinely at risk right now: they
// have activity recorded for yesterday (so their streak is still
// alive) but none yet for today (so it will break if they don't come
// back before the day ends). Two narrow, indexed queries on
// activity_days.activity_date (part of that table's own primary key)
// rather than scanning the whole table or recomputing every user's
// full history — this only does real per-user work for the small
// subset who are actually at risk on a given day.
export async function findAtRiskUsers(supabase) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const [{ data: playedToday }, { data: playedYesterday }] = await Promise.all([
    supabase.from("activity_days").select("user_id").eq("activity_date", isoDate(today)),
    supabase.from("activity_days").select("user_id").eq("activity_date", isoDate(yesterday)),
  ]);

  const safeToday = new Set((playedToday || []).map((r) => r.user_id));
  const atRiskIds = (playedYesterday || []).map((r) => r.user_id).filter((id) => !safeToday.has(id));
  if (atRiskIds.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, streak_email_opt_out")
    .in("id", atRiskIds)
    .eq("streak_email_opt_out", false);

  const results = [];
  for (const profile of profiles || []) {
    const streak = await currentStreakDays(supabase, profile.id);
    if (streak >= MIN_STREAK_TO_REMIND) {
      results.push({ userId: profile.id, username: profile.username, streak });
    }
  }
  return results;
}

function streakEmailHtml(username, streak) {
  return `<!DOCTYPE html>
<html>
<body style="margin:0;padding:32px 16px;background:#0d0d16;font-family:monospace;color:#e8e6f0;">
  <div style="max-width:420px;margin:0 auto;text-align:center;">
    <p style="font-size:40px;margin:0 0 12px;">🔥</p>
    <p style="font-size:18px;font-weight:bold;color:#ffb703;margin:0 0 8px;">
      ${streak}-day streak — don't lose it, ${username}!
    </p>
    <p style="font-size:14px;color:#a99fd6;line-height:1.5;margin:0 0 24px;">
      You haven't played on tapandscore today yet. Jump into any game before your day ends to keep your streak alive.
    </p>
    <a href="https://tapandscore.com" style="display:inline-block;background:#ffb703;color:#0d0d16;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;font-size:13px;">
      PLAY NOW
    </a>
    <p style="font-size:11px;color:#6b6485;margin:32px 0 0;">
      Don't want these reminders? Turn them off anytime from your account page.
    </p>
  </div>
</body>
</html>`;
}

// Sends one streak-protection email via Cloudflare's native Email
// Service binding (env.EMAIL) — not SMTP, which Workers can't use at
// all (no raw TCP socket access in the V8 isolate runtime), and not
// a third-party email API, since Cloudflare's own binding is the
// natural fit for a Worker already deployed on this platform.
// Requires the [[send_email]] binding in wrangler.toml, the sending
// domain onboarded for Email Sending in the Cloudflare dashboard, and
// Email Sending itself is only available on the Workers Paid plan —
// see README.md for the manual setup steps this specific piece
// needs, since none of that can be done from code alone.
export async function sendStreakReminderEmail(env, toEmail, username, streak) {
  await env.EMAIL.send({
    to: toEmail,
    from: "reminders@tapandscore.com",
    subject: `Your ${streak}-day streak is waiting on you`,
    html: streakEmailHtml(username, streak),
    text: `Your ${streak}-day streak on tapandscore is at risk! Play any game today to keep it alive: https://tapandscore.com`,
  });
}
