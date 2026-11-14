"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createResetRequestClient } from "@/lib/supabaseClient";
import AuthFrame from "@/components/auth/AuthFrame";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search).get("error");
      if (q === "link") setError("That reset link didn't work. Reset links can be used only once and stop working after about an hour. Some email apps also open links automatically to check them, which uses them up. Request a new one below, then open it straight away.");
    } catch {}
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    // The link in the email brings the person to /reset-password on whatever address they are on right now (window.location.origin, not a setting), so it keeps working on any domain.
    // The address is deliberately plain (no "?next=..." tail): Supabase compares it exactly with its "Redirect URLs" list, and a tail that is not on the list makes it send people to the home page instead.
    let resetError = null;
    // First choice: our own email from tapandscore.com (/api/auth/forgot). If that is not available the page falls back to Supabase's own email, as before.
    let ours = false;
    try {
      const res = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) });
      const j = await res.json().catch(() => ({}));
      if (res.status === 400 && j.error) { setLoading(false); setError(j.error); return; }
      ours = res.ok && j.sent === true;
    } catch {}
    try {
      if (ours) throw Object.assign(new Error("skip"), { skip: true });
      const r = await createResetRequestClient().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
      resetError = r.error;
    } catch (ex) {
      if (ex && ex.skip) { /* our own email already went out */ } else
      resetError = { message: "We couldn't reach the server. Check your connection and try again." };
    }
    setLoading(false);
    if (resetError) {
      const m = String(resetError.message || "");
      setError(/rate limit|too many|seconds/i.test(m) ? "A reset email was requested very recently. Please wait a minute or two, check your spam folder, and try again." : m || "Something went wrong. Please try again.");
      return;
    }
    // remembered for a few hours so that, if the emailed link turns out to be used up, the site can point the person back here (see AUTH_LINK_RESCUE in app/layout.js)
    try { localStorage.setItem("tas_reset_asked", String(Date.now())); } catch {}
    setSent(true);
  }

  const loginButton = <Link href="/login" className="st-btn st-btn-ghost st-btn-sm">Log in</Link>;

  if (sent) {
    return (
      <AuthFrame rightSlot={loginButton} title="Check your email">
        <p className="text-[15px] leading-relaxed text-[#dcd5ff]">
          If an account exists for <strong className="font-semibold text-[#f5f0ff]">{email}</strong>, a password reset link is on
          its way. Click it to set a new password. It works on any device, and only once. If you don&apos;t see it in a minute, check your spam folder.
        </p>
        <p className="mt-4 text-[14px] leading-relaxed text-[#c3bbea]">
          Email shows a code instead of (or as well as) a link?{" "}
          <Link href={`/reset-password?mode=code&email=${encodeURIComponent(email.trim())}`} className="st-link">Enter the code here</Link>
        </p>
        <Link href="/login" className="st-btn st-btn-ghost mt-5 w-full">Back to log in</Link>
      </AuthFrame>
    );
  }

  return (
    <AuthFrame
      rightSlot={loginButton}
      title="Reset your password"
      sub="Enter the email on your account and we'll send you a link to set a new password."
      footer={<>Remembered it? <Link href="/login" className="st-link">Log in</Link></>}
    >
      <form onSubmit={handleSubmit}>
        <label htmlFor="fp-email" className="st-label">Email</label>
        <input
          id="fp-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="st-input"
          placeholder="you@example.com"
        />
        {error && <p className="mt-4 text-[13.5px] leading-relaxed text-accentMagenta" role="alert">{error}</p>}
        <button type="submit" disabled={loading} className="st-btn st-btn-primary mt-5 w-full disabled:opacity-60">
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>
    </AuthFrame>
  );
}
