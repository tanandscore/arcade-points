"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/lib/countries";

export default function AccountForm({ initialUsername, initialCountry }) {
  const [username, setUsername] = useState(initialUsername);
  const [country, setCountry] = useState(initialCountry);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaved(false);
    setLoading(true);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, country: country || null }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Couldn't save changes.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-lineColor p-7 bg-bgPanel">
      <label className="block font-mono text-xs mb-2 text-textDim">USERNAME</label>
      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        maxLength={16}
        className="w-full rounded-md px-3 py-2.5 mb-4 outline-none text-sm bg-bgDeep border border-lineColor text-textLight focus:border-accentCyan transition-colors"
      />
      <label className="block font-mono text-xs mb-2 text-textDim">COUNTRY</label>
      <select
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        className="w-full rounded-md px-3 py-2.5 mb-5 outline-none text-sm bg-bgDeep border border-lineColor text-textLight focus:border-accentCyan transition-colors"
      >
        <option value="">Prefer not to say</option>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
      {error && <p className="text-accentMagenta text-xs mb-4">{error}</p>}
      {saved && <p className="text-accentCyan text-xs mb-4">Saved.</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-md py-3 font-pixel text-[10px] bg-accentCyan text-bgDeep disabled:opacity-50"
      >
        {loading ? "SAVING..." : "SAVE CHANGES ▸"}
      </button>
    </form>
  );
}
