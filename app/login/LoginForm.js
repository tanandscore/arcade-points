"use client";


import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabaseClient";

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
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <h1 className="font-pixel text-lg text-textLight mb-8">WELCOME BACK</h1>
      <form onSubmit={handleSubmit} className="w-full max-w-xs rounded-xl border border-lineColor p-6 bg-bgPanel">
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
          placeholder="••••••••"
        />
        {error && <p className="text-accentMagenta text-xs mb-4">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md py-2.5 font-pixel text-[10px] bg-accentCyan text-bgDeep disabled:opacity-50"
        >
          {loading ? "LOGGING IN..." : "INSERT COIN ▸"}
        </button>
      </form>
      <p className="mt-6 text-xs text-textDim">
        New here?{" "}
        <Link href="/signup" className="text-accentCyan">
          Create an account
        </Link>
      </p>
    </div>
  );
}
