"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabaseClient";
import MarqueeBar from "@/components/MarqueeBar";

export default function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Clicking the emailed link briefly establishes a special "recovery"
    // session. We wait for that before showing the form, so someone
    // landing on this page without a valid link sees a clear message
    // instead of a form that will just fail.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => listener.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password needs to be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setDone(true);
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1500);
  }

  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      <MarqueeBar />
      <div
        className="flex flex-col items-center justify-center px-4 py-16 sm:py-24"
        style={{ background: "radial-gradient(ellipse at 50% 0%, #241154 0%, #12092b 65%)" }}
      >
        {done ? (
          <div className="max-w-sm text-center">
            <div className="font-pixel text-xs text-accentCyan mb-4">PASSWORD UPDATED</div>
            <p className="text-textDim text-sm">Taking you to your dashboard...</p>
          </div>
        ) : !ready ? (
          <div className="max-w-sm text-center">
            <div className="font-pixel text-xs text-accentAmber mb-4">CHECKING YOUR LINK...</div>
            <p className="text-textDim text-sm mb-6">
              If this doesn't update in a few seconds, your reset link may have expired — request a new one.
            </p>
            <Link href="/forgot-password" className="font-mono text-xs text-accentCyan">
              Request a new link ▸
            </Link>
          </div>
        ) : (
          <>
            <h1 className="font-pixel text-xl sm:text-2xl text-textLight mb-8 text-center">SET A NEW PASSWORD</h1>
            <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border border-lineColor p-7 bg-bgPanel shadow-xl">
              <label className="block font-mono text-xs mb-2 text-textDim">NEW PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-md px-3 py-2.5 mb-4 outline-none text-sm bg-bgDeep border border-lineColor text-textLight focus:border-accentCyan transition-colors"
                placeholder="At least 6 characters"
              />
              <label className="block font-mono text-xs mb-2 text-textDim">CONFIRM PASSWORD</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                className="w-full rounded-md px-3 py-2.5 mb-5 outline-none text-sm bg-bgDeep border border-lineColor text-textLight focus:border-accentCyan transition-colors"
                placeholder="Type it again"
              />
              {error && <p className="text-accentMagenta text-xs mb-4">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md py-3 font-pixel text-[10px] bg-accentCyan text-bgDeep disabled:opacity-50"
              >
                {loading ? "SAVING..." : "SAVE NEW PASSWORD ▸"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
