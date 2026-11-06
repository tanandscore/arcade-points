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
      setError(data.error || "Couldn't send. Try again.");
      return;
    }
    setSent(true);
    setMessage("");
  }

  if (sent) {
    return (
      <div className="st-panel p-6 text-center sm:p-8" style={{ boxShadow: "inset 0 3px 0 #3ee6e0" }}>
        <p className="st-h3 text-accentCyan">Thanks, your feedback was sent.</p>
        <p className="st-muted mt-1.5 text-[14.5px]">We read every message.</p>
        <button type="button" onClick={() => setSent(false)} className="st-btn st-btn-ghost st-btn-sm mt-5">
          Send more feedback
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="st-panel p-5 sm:p-6">
      <label htmlFor="fb-message" className="st-label">Your message</label>
      <textarea
        id="fb-message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={7}
        maxLength={2000}
        placeholder="What's on your mind?"
        className="st-input !h-auto resize-none py-3 leading-relaxed"
      />
      <div className="mt-1.5 flex items-start justify-between gap-3 text-[13px]">
        <p className="min-h-[1.25rem] text-accentMagenta" aria-live="polite">{error}</p>
        <p className="shrink-0 tabular-nums text-[#a99fd6]">{message.length} / 2000</p>
      </div>
      <button
        type="submit"
        disabled={loading || message.trim().length < 3}
        className="st-btn st-btn-primary mt-3 w-full disabled:opacity-50"
      >
        {loading ? "Sending..." : "Send feedback"}
      </button>
    </form>
  );
}
