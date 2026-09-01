"use client";

import { useState } from "react";
import { startPayuCheckout } from "@/lib/payuCheckout";

// PayU redirects the whole browser away to its hosted checkout page
// and back — there's no in-page success handler to write here like
// Razorpay's JS modal had; router.refresh() isn't needed since the
// page reloads naturally when the user returns via /account?payment=...
export default function SubscribeButton({ priceDisplay, planId = "premium", planName = "Power Pass" }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setLoading(true);
    setError("");
    const result = await startPayuCheckout("/api/payu/subscribe", { planId });
    if (result.error) {
      setError(result.error);
      setLoading(false);
    }
    // on success the browser is already navigating to PayU — nothing left to do here
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full rounded-md py-3 font-pixel text-[10px] text-bgDeep disabled:opacity-50"
        style={{ background: "#ffb703" }}
      >
        {loading ? "OPENING..." : `SUBSCRIBE ${priceDisplay || ""}/MONTH ▸`}
      </button>
      {error && <p className="text-accentMagenta text-xs mt-3">{error}</p>}
    </div>
  );
}
