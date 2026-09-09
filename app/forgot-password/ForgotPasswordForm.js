"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabaseClient";
import MarqueeBar from "@/components/MarqueeBar";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    // window.location.origin (not an env var) so this works correctly
    // no matter which domain the site is actually being viewed from.
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
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
              its way. Click it to set a new password.
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
