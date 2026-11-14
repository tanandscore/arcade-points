"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabaseClient";
import AuthFrame from "@/components/auth/AuthFrame";
import { safeNext } from "@/lib/safeNext";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNext(searchParams.get("next"));
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
    router.push(next);
    router.refresh();
  }

  const signupHref = next === "/dashboard" ? "/signup" : `/signup?next=${encodeURIComponent(next)}`;

  return (
    <AuthFrame
      showcase
      rightSlot={<Link href={signupHref} className="st-btn st-btn-ghost st-btn-sm">Create account</Link>}
      title="Welcome back"
      sub="Log in to pick up where you left off."
      footer={<>New here? <Link href={signupHref} className="st-link">Create a free account</Link></>}
    >
      <form onSubmit={handleSubmit}>
        <label htmlFor="login-email" className="st-label">Email</label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className="st-input"
          placeholder="you@example.com"
        />
        <div className="mb-1.5 mt-4 flex items-baseline justify-between gap-3">
          <label htmlFor="login-password" className="st-label !mb-0">Password</label>
          <Link href="/forgot-password" className="st-link text-[13px] !font-medium">Forgot password?</Link>
        </div>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="st-input"
          placeholder="Your password"
        />
        {error && <p className="mt-4 text-[13.5px] text-accentMagenta" role="alert">{error}</p>}
        <button type="submit" disabled={loading} className="st-btn st-btn-primary mt-5 w-full disabled:opacity-60">
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>
    </AuthFrame>
  );
}
