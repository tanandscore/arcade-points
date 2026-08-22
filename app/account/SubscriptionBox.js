"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SubscriptionBox({ subscription, planId, planName }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  const periodEndLabel = subscription.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })
    : null;

  async function handleCancel() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/razorpay/cancel-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Couldn't cancel — try again shortly.");
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-lineColor p-6 bg-bgPanel">
      <h2 className="font-pixel text-[10px] text-accentAmber mb-2">{planName?.toUpperCase() || "PREMIUM"} SUBSCRIPTION</h2>

      {subscription.cancel_at_period_end ? (
        <>
          <p className="text-textDim text-xs mb-1">Your subscription is cancelled and won't renew.</p>
          {periodEndLabel && (
            <p className="text-[11px] text-accentCyan mb-2">
              You still have full access until <span className="text-textLight">{periodEndLabel}</span>.
            </p>
          )}
          <p className="text-textDim text-[11px]">Want to keep {planName || "Power Pass"}? Just subscribe again before that date.</p>
        </>
      ) : (
        <>
          <p className="text-textDim text-xs mb-4">
            {periodEndLabel ? (
              <>Active — renews automatically on <span className="text-textLight">{periodEndLabel}</span>.</>
            ) : (
              `Your ${planName || "Power Pass"} subscription is active.`
            )}
          </p>
          {error && <p className="text-accentMagenta text-xs mb-3">{error}</p>}
          {!confirming ? (
            <button onClick={() => setConfirming(true)} className="font-mono text-[11px] text-textDim underline">
              Cancel subscription
            </button>
          ) : (
            <div>
              <p className="text-[11px] text-textDim mb-3">
                You'll keep access until {periodEndLabel || "the end of your current billing period"} — no refund
                for the remaining days, but nothing more will be charged after that.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  disabled={loading}
                  className="font-mono text-[10px] px-3 py-1.5 rounded-md border text-accentMagenta disabled:opacity-50"
                  style={{ borderColor: "#ff3ea5" }}
                >
                  {loading ? "Cancelling..." : "Yes, cancel"}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="font-mono text-[10px] px-3 py-1.5 rounded-md border border-lineColor text-textDim"
                >
                  Keep subscription
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
