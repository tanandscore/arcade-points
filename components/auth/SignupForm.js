"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabaseClient";
import AuthFrame from "@/components/auth/AuthFrame";
import { COUNTRIES } from "@/lib/countries";
import { MIN_AGE, POLICY_VERSION } from "@/lib/compliance";
import { safeNext } from "@/lib/safeNext";

export default function SignupForm() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [ageOk, setAgeOk] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const [betaSlotsRemaining, setBetaSlotsRemaining] = useState(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const referredByCode = searchParams.get("ref");
  const next = safeNext(searchParams.get("next"));
  const loginHref = next === "/dashboard" ? "/login" : `/login?next=${encodeURIComponent(next)}`;
  const supabase = createClient();

  useEffect(() => {
    supabase
      .from("beta_program")
      .select("is_active, max_slots, slots_used")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.is_active) {
          setBetaSlotsRemaining(Math.max(0, data.max_slots - data.slots_used));
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!ageOk) {
      setError(`You need to be at least ${MIN_AGE} years old to create an account.`);
      return;
    }
    if (!agreed) {
      setError("Please agree to the Terms and the Privacy Policy to continue.");
      return;
    }
    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${next === "/dashboard" ? "/dashboard" : encodeURIComponent(next)}`,
        data: {
          username: username.trim(),
          country: country || null,
          referred_by_code: referredByCode || null,
          // saved with the account as proof of what was agreed, and when
          terms_accepted_at: new Date().toISOString(),
          terms_version: POLICY_VERSION,
          age_confirmed_min: MIN_AGE,
        },
      },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    // Fire-and-forget — never let this affect the signup flow itself,
    // even if it fails. Runs regardless of which branch below fires,
    // since the account row (and any beta grant) already exists the
    // moment signUp() succeeds, confirmed or not.
    if (data.user?.id) {
      fetch("/api/beta-ip-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: data.user.id }),
      }).catch(() => {});
    }
    if (data.session) {
      router.push(next);
      router.refresh();
    } else {
      // Email confirmation is required before a session exists
      setCheckEmail(true);
    }
  }

  if (checkEmail) {
    return (
      <AuthFrame title="Check your email" sub="One more step before you can play.">
        <p className="text-[15px] leading-relaxed text-[#dcd5ff]">
          We sent a confirmation link to <strong className="font-semibold text-[#f5f0ff]">{email}</strong>. Click it, then come back and log in.
        </p>
        <Link href={loginHref} className="st-btn st-btn-primary mt-5 w-full">Go to log in</Link>
      </AuthFrame>
    );
  }

  const betaBanner = betaSlotsRemaining !== null && betaSlotsRemaining > 0 ? (
    <div className="border-b border-accentCyan/30 bg-accentCyan/10 px-4 py-2.5 text-center text-[13.5px] text-accentCyan">
      🎟️ Beta program open — {betaSlotsRemaining} free spot{betaSlotsRemaining === 1 ? "" : "s"} left for full access, no charge
    </div>
  ) : null;

  return (
    <AuthFrame
      showcase
      banner={betaBanner}
      rightSlot={<Link href={loginHref} className="st-btn st-btn-ghost st-btn-sm">Log in</Link>}
      title="Create your account"
      sub="Free to join. Passes are optional."
      footer={<>Already have an account? <Link href={loginHref} className="st-link">Log in</Link></>}
    >
      <form onSubmit={handleSubmit}>
        <label htmlFor="su-username" className="st-label">Username</label>
        <input
          id="su-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={16}
          autoComplete="username"
          className="st-input"
          placeholder="PixelQueen"
        />
        <label htmlFor="su-email" className="st-label mt-4">Email</label>
        <input
          id="su-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="st-input"
          placeholder="you@example.com"
        />
        <label htmlFor="su-password" className="st-label mt-4">Password</label>
        <input
          id="su-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          className="st-input"
          placeholder="At least 6 characters"
        />
        <label htmlFor="su-country" className="st-label mt-4">Country <span className="font-normal text-[#a99fd6]">(shown on leaderboards)</span></label>
        <select
          id="su-country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          required
          className="st-input"
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
        <label className="mt-5 flex cursor-pointer items-start gap-3 text-[13.5px] leading-snug text-[#c3bbea]">
          <input type="checkbox" checked={ageOk} onChange={(e) => setAgeOk(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#3ee6e0]" />
          <span>I am at least {MIN_AGE} years old.</span>
        </label>
        <label className="mt-3 flex cursor-pointer items-start gap-3 text-[13.5px] leading-snug text-[#c3bbea]">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#3ee6e0]" />
          <span>I agree to the <Link href="/terms" target="_blank" className="st-link">Terms of Service</Link> and have read the <Link href="/privacy" target="_blank" className="st-link">Privacy Policy</Link>.</span>
        </label>
        {error && <p className="mt-4 text-[13.5px] text-accentMagenta" role="alert">{error}</p>}
        <button type="submit" disabled={loading} className="st-btn st-btn-primary mt-5 w-full disabled:opacity-60">
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>
    </AuthFrame>
  );
}
