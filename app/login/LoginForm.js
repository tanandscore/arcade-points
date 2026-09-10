"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabaseClient";
import MarqueeBar from "@/components/MarqueeBar";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-bgDeep text-textLight">
      <MarqueeBar
        rightSlot={
          <Link href="/signup" className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textLight hover:bg-bgPanel3 transition-colors">
            Create account
          </Link>
        }
      />

      <div
        className="flex flex-col items-center justify-center px-4 py-16 sm:py-24"
        style={{ background: "radial-gradient(ellipse at 50% 0%, #241154 0%, #12092b 65%)" }}
      >
        <div className="font-pixel text-[10px] tracking-widest mb-4 text-accentAmber">✦ ✦ ✦ WELCOME BACK ✦ ✦ ✦</div>
        <h1
          className="font-pixel text-xl sm:text-2xl text-textLight mb-8 text-center"
          style={{ textShadow: "2px 2px 0 #ff3ea5, -1px -1px 0 #3ee6e0" }}
        >
          LOG IN TO PLAY
        </h1>

        <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border border-lineColor p-7 bg-bgPanel shadow-xl">
          <label className="block font-mono text-xs mb-2 text-textDim">EMAIL</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-md px-3 py-2.5 mb-4 outline-none text-sm bg-bgDeep border border-lineColor text-textLight focus:border-accentCyan transition-colors"
            placeholder="you@example.com"
          />
          <label className="block font-mono text-xs mb-2 text-textDim">PASSWORD</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-md px-3 py-2.5 mb-2 outline-none text-sm bg-bgDeep border border-lineColor text-textLight focus:border-accentCyan transition-colors"
            placeholder="••••••••"
          />
          <div className="text-right mb-5">
            <Link href="/forgot-password" className="font-mono text-[11px] text-textDim hover:text-accentCyan transition-colors">
              Forgot password?
            </Link>
          </div>
          {error && <p className="text-accentMagenta text-xs mb-4">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md py-3 font-pixel text-[10px] bg-accentCyan text-bgDeep disabled:opacity-50"
          >
            {loading ? "LOGGING IN..." : "INSERT COIN ▸"}
          </button>
        </form>

        <p className="mt-6 text-sm text-textDim">
          New here?{" "}
          <Link href="/signup" className="text-accentCyan font-semibold">
            Create a free account
          </Link>
        </p>
      </div>
    </div>
  );
}
