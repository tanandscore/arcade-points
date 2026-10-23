"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createResetRequestClient } from "@/lib/supabaseClient";
import MarqueeBar from "@/components/MarqueeBar";

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

  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      <MarqueeBar
        rightSlot={
          <Link href="/login" className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textLight hover:bg-bgPanel3 transition-colors">
            Log in
          </Link>
        }
      />

      <div
        className="flex flex-col items-center justify-center px-4 py-16 sm:py-24"
        style={{ background: "radial-gradient(ellipse at 50% 0%, #241154 0%, #12092b 65%)" }}
      >
        {sent ? (
          <div className="max-w-sm text-center">
            <div className="font-pixel text-xs text-accentCyan mb-4">CHECK YOUR EMAIL</div>
            <p className="text-textDim text-sm">
              If an account exists for <span className="text-textLight">{email}</span>, a password reset link is on
              its way. Click it to set a new password. It works on any device, and only once. If you don't see it in a minute, check your spam folder.
            </p>
            <p className="text-textDim text-xs mt-4">
              Email shows a code instead of (or as well as) a link?{" "}
              <Link href={`/reset-password?mode=code&email=${encodeURIComponent(email.trim())}`} className="text-accentCyan">Enter the code here ▸</Link>
            </p>
            <Link href="/login" className="inline-block mt-6 font-mono text-xs text-accentCyan">
              Back to login ▸
            </Link>
          </div>
        ) : (
          <>
            <div className="font-pixel text-[10px] tracking-widest mb-4 text-accentAmber">✦ ✦ ✦ FORGOT PASSWORD ✦ ✦ ✦</div>
            <h1 className="font-pixel text-xl sm:text-2xl text-textLight mb-3 text-center">RESET YOUR PASSWORD</h1>
            <p className="text-textDim text-sm mb-8 text-center max-w-sm">
              Enter the email on your account and we'll send you a link to set a new password.
            </p>

            <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border border-lineColor p-7 bg-bgPanel shadow-xl">
              <label className="block font-mono text-xs mb-2 text-textDim">EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-md px-3 py-2.5 mb-5 outline-none text-sm bg-bgDeep border border-lineColor text-textLight focus:border-accentCyan transition-colors"
                placeholder="you@example.com"
              />
              {error && <p className="text-accentMagenta text-xs mb-4">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md py-3 font-pixel text-[10px] bg-accentCyan text-bgDeep disabled:opacity-50"
              >
                {loading ? "SENDING..." : "SEND RESET LINK ▸"}
              </button>
            </form>

            <p className="mt-6 text-sm text-textDim">
              Remembered it?{" "}
              <Link href="/login" className="text-accentCyan font-semibold">
                Log in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
