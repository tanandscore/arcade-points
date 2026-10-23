import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/supabaseServer";

// Sends the password-reset email OURSELVES, from tapandscore.com, through Cloudflare's Email Service (the same sender the streak reminders use),
// instead of letting Supabase send its own generic message from its own address.
//  - We ask Supabase only for a one-time reset token (admin generateLink), build the link ourselves and email it.
//  - The link goes to /auth/confirm?token_hash=...  which hands on to /reset-password; the token is used up only when the person presses Save,
//    so mail programs that "open links to check them" cannot burn it. No dependence on the Supabase email template or its allowed-address list.
//  - If our sender is not available (binding or domain not set up yet) the route answers { fallback: true } and the page uses Supabase's own email as before,
//    so a reset is never worse than it was.
// The answer never says whether an account exists for the address (so nobody can use this to find out who has an account).
const SENT_RECENTLY = new Map(); // per-server memory: one email per address per minute (a light brake against abuse)

function html(link, code) {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:32px 16px;background:#0d0d16;font-family:Arial,Helvetica,sans-serif;color:#e8e6f0;">
  <div style="max-width:460px;margin:0 auto;background:#171227;border:1px solid #2c2450;border-radius:12px;padding:32px 28px;">
    <p style="font-size:13px;letter-spacing:2px;color:#3ee6e0;margin:0 0 18px;font-family:monospace;">TAP &amp; SCORE</p>
    <h1 style="font-size:20px;margin:0 0 14px;color:#ffffff;">Reset your password</h1>
    <p style="font-size:14px;line-height:1.6;color:#c9c2e6;margin:0 0 22px;">Someone asked to reset the password for your Tap &amp; Score account. If that was you, press the button to choose a new one. The link works once and stops working after about an hour.</p>
    <p style="margin:0 0 24px;"><a href="${link}" style="display:inline-block;background:#3ee6e0;color:#0d0d16;padding:13px 26px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:14px;">Choose a new password</a></p>
    <p style="font-size:12px;line-height:1.6;color:#8d84b5;margin:0 0 6px;">Button not working? Copy this address into your browser:</p>
    <p style="font-size:11px;word-break:break-all;color:#8d84b5;margin:0 0 18px;">${link}</p>
    <p style="font-size:12px;color:#8d84b5;margin:0;">If you didn't ask for this, you can safely ignore this email — your password stays the same.</p>
  </div>
  <p style="max-width:460px;margin:16px auto 0;font-size:11px;color:#6b6485;text-align:center;">Tap &amp; Score · tapandscore.com · Questions? support@tapandscore.com</p>
</body></html>`;
}

export async function POST(request) {
  let email = "";
  try { email = String((await request.json()).email || "").trim().toLowerCase(); } catch {}
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const now = Date.now();
  if (SENT_RECENTLY.size > 500) for (const [k, t] of SENT_RECENTLY) if (now - t > 60000) SENT_RECENTLY.delete(k);
  if (now - (SENT_RECENTLY.get(email) || 0) < 60000) return NextResponse.json({ sent: true }); // quietly treat a repeat within a minute as done
  SENT_RECENTLY.set(email, now);

  // 1. our sender must exist, otherwise let the page use Supabase's email
  let send = null;
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    if (ctx?.env?.EMAIL?.send) send = (m) => ctx.env.EMAIL.send(m);
  } catch {}
  if (!send) return NextResponse.json({ fallback: true });

  // 2. one-time reset token from Supabase (no email is sent by Supabase this way)
  let hashed = "", code = "";
  try {
    const { data, error } = await createServiceSupabase().auth.admin.generateLink({ type: "recovery", email });
    if (error || !data?.properties?.hashed_token) return NextResponse.json({ sent: true }); // no such account: look exactly like success
    hashed = data.properties.hashed_token; code = data.properties.email_otp || "";
  } catch {
    return NextResponse.json({ fallback: true });
  }

  // 3. build the link on the address the person is on (falls back to the live site) and send
  const origin = new URL(request.url).origin;
  const base = /^https:\/\/(www\.)?tapandscore\.com$/.test(origin) ? origin : (process.env.NEXT_PUBLIC_SITE_URL || origin);
  const link = `${base}/auth/confirm?token_hash=${encodeURIComponent(hashed)}&type=recovery&next=/reset-password`;
  try {
    await send({
      to: email,
      from: "Tap & Score <accounts@tapandscore.com>",
      subject: "Reset your Tap & Score password",
      html: html(link, code),
      text: `Reset your Tap & Score password\n\nSomeone asked to reset the password for your account. If that was you, open this link to choose a new one (works once, expires in about an hour):\n${link}\n\nIf you didn't ask for this, ignore this email.`,
    });
  } catch {
    return NextResponse.json({ fallback: true });
  }
  return NextResponse.json({ sent: true, via: "tapandscore" });
}
