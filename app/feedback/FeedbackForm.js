"use client";

import { useState } from "react";

export default function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Couldn't send — try again.");
      return;
    }
    setSent(true);
    setMessage("");
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-accentCyan p-6 text-center bg-bgPanel">
        <p className="text-accentCyan text-sm mb-4">Thanks — your feedback was sent.</p>
        <button onClick={() => setSent(false)} className="font-mono text-[11px] text-textDim underline">
          Send more feedback
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-lineColor p-6 bg-bgPanel">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={6}
        maxLength={2000}
        placeholder="What's on your mind?"
        className="w-full rounded-md px-3 py-2.5 mb-4 outline-none text-sm bg-bgDeep border border-lineColor text-textLight focus:border-accentCyan transition-colors resize-none"
      />
      {error && <p className="text-accentMagenta text-xs mb-4">{error}</p>}
      <button
        type="submit"
        disabled={loading || message.trim().length < 3}
        className="w-full rounded-md py-3 font-pixel text-[10px] bg-accentCyan text-bgDeep disabled:opacity-50"
      >
        {loading ? "SENDING..." : "SEND FEEDBACK ▸"}
      </button>
    </form>
  );
}
