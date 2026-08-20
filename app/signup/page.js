"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabaseClient";

export default function SignupPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: username.trim() } },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
      return;
    }
    if (data.session) {
      router.push("/");
      router.refresh();
    } else {
      // Email confirmation is required before a session exists
      setCheckEmail(true);
    }
  }

  if (checkEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 text-center">
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
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <h1 className="font-pixel text-lg text-textLight mb-8">CREATE ACCOUNT</h1>
      <form onSubmit={handleSubmit} className="w-full max-w-xs rounded-xl border border-lineColor p-6 bg-bgPanel">
        <label className="block font-mono text-xs mb-2 text-textDim">USERNAME</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={16}
          className="w-full rounded-md px-3 py-2.5 mb-4 outline-none text-sm bg-bgDeep border border-lineColor text-textLight"
          placeholder="PIXELQUEEN"
        />
        <label className="block font-mono text-xs mb-2 text-textDim">EMAIL</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full rounded-md px-3 py-2.5 mb-4 outline-none text-sm bg-bgDeep border border-lineColor text-textLight"
          placeholder="you@example.com"
        />
        <label className="block font-mono text-xs mb-2 text-textDim">PASSWORD</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full rounded-md px-3 py-2.5 mb-4 outline-none text-sm bg-bgDeep border border-lineColor text-textLight"
          placeholder="At least 6 characters"
        />
        {error && <p className="text-accentMagenta text-xs mb-4">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md py-2.5 font-pixel text-[10px] bg-accentCyan text-bgDeep disabled:opacity-50"
        >
          {loading ? "CREATING..." : "CREATE ACCOUNT ▸"}
        </button>
      </form>
      <p className="mt-6 text-xs text-textDim">
        Already have an account?{" "}
        <Link href="/login" className="text-accentCyan">
          Log in
        </Link>
      </p>
    </div>
  );
}
