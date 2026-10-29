"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES } from "@/lib/countries";

// Upgrade 70: same fields and same save call, in the store's look.
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
    <form onSubmit={handleSubmit} className="st-panel p-5 sm:p-6" aria-labelledby="profile-h">
      <h2 id="profile-h" className="st-h3">Profile</h2>
      <p className="st-muted text-[13.5px] mt-1">Your country is shown next to your name on leaderboards.</p>

      <label htmlFor="acc-username" className="st-label mt-5">Username</label>
      <input
        id="acc-username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        maxLength={16}
        autoComplete="username"
        className="st-input"
      />

      <label htmlFor="acc-country" className="st-label mt-4">Country</label>
      <select id="acc-country" value={country} onChange={(e) => setCountry(e.target.value)} className="st-input">
        <option value="">Prefer not to say</option>
        {COUNTRIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>

      <div aria-live="polite" className="min-h-[1.25rem] mt-3 text-[13.5px]">
        {error && <p className="text-accentMagenta">{error}</p>}
        {saved && !error && <p className="text-accentCyan">Saved.</p>}
      </div>

      <button type="submit" disabled={loading} className="st-btn st-btn-primary w-full mt-2 disabled:opacity-60">
        {loading ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
