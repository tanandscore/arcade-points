"use client";

import { useState } from "react";
import { startPayuCheckout } from "@/lib/payuCheckout";

// Same reasoning as SubscribeButton — PayU's flow is a full-page
// redirect away and back, not an in-page modal callback.
export default function DayPassButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleClick() {
    setLoading(true);
    setError("");
    const result = await startPayuCheckout("/api/payu/order", { type: "daypass" });
    if (result.error) {
      setError(result.error);
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="w-full rounded-md py-3 font-pixel text-[10px] text-bgDeep disabled:opacity-50"
        style={{ background: "#ffb703" }}
      >
        {loading ? "OPENING..." : "GET 24-HOUR PASS — ₹10 ▸"}
      </button>
      {error && <p className="text-accentMagenta text-xs mt-3">{error}</p>}
    </div>
  );
}
