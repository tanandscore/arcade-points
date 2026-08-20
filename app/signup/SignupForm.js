"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabaseClient";
import MarqueeBar from "@/components/MarqueeBar";
import { COUNTRIES } from "@/lib/countries";

export default function SignupForm() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (username.trim().length < 3) {
      setError("Username needs to be at least 3 characters.");
      return;
    }
    if (password.length < 6) {
      setError("Password needs to be at least 6 characters.");
      return;
    }
    if (!country) {
      setError("Please select your country — it's shown next to your name on the leaderboards.");
      return;
    }
    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: username.trim(), country: country || null } },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session) {
      router.push("/dashboard");
      router.refresh();
    } else {
      // Email confirmation is required before a session exists
      setCheckEmail(true);
    }
  }

  if (checkEmail) {
    return (
      <div className="min-h-screen bg-bgDeep text-textLight">
        <MarqueeBar />
        <div className="flex items-center justify-center px-4 py-24 text-center">
          <div className="max-w-sm">
            <div className="font-pixel text-xs text-accentCyan mb-4">CHECK YOUR EMAIL</div>
            <p className="text-textDim text-sm">
              We sent a confirmation link to <span className="text-textLight">{email}</span>. Click it, then come back and log in.
            </p>
            <Link href="/login" className="inline-block mt-6 font-mono text-xs text-accentCyan">
              Go to login ▸
            </Link>
          </div>
        </div>
      </div>
    );
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
        <div className="font-pixel text-[10px] tracking-widest mb-4 text-accentAmber">✦ ✦ ✦ JOIN FREE ✦ ✦ ✦</div>
        <h1
          className="font-pixel text-xl sm:text-2xl text-textLight mb-8 text-center"
          style={{ textShadow: "2px 2px 0 #3ee6e0, -1px -1px 0 #ff3ea5" }}
        >
          CREATE YOUR ACCOUNT
        </h1>

        <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border border-lineColor p-7 bg-bgPanel shadow-xl">
          <label className="block font-mono text-xs mb-2 text-textDim">USERNAME</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={16}
            className="w-full rounded-md px-3 py-2.5 mb-4 outline-none text-sm bg-bgDeep border border-lineColor text-textLight focus:border-accentCyan transition-colors"
            placeholder="PIXELQUEEN"
          />
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
            className="w-full rounded-md px-3 py-2.5 mb-4 outline-none text-sm bg-bgDeep border border-lineColor text-textLight focus:border-accentCyan transition-colors"
            placeholder="At least 6 characters"
          />
          <label className="block font-mono text-xs mb-2 text-textDim">COUNTRY (shown on leaderboards)</label>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            required
            className="w-full rounded-md px-3 py-2.5 mb-5 outline-none text-sm bg-bgDeep border border-lineColor text-textLight focus:border-accentCyan transition-colors"
          >
            <option value="" disabled>
              Select your country
            </option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          {error && <p className="text-accentMagenta text-xs mb-4">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md py-3 font-pixel text-[10px] bg-accentCyan text-bgDeep disabled:opacity-50"
          >
            {loading ? "CREATING..." : "CREATE ACCOUNT ▸"}
          </button>
        </form>

        <p className="mt-6 text-sm text-textDim">
          Already have an account?{" "}
          <Link href="/login" className="text-accentCyan font-semibold">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
