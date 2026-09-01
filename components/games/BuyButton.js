"use client";

import { useState } from "react";
import { startPayuCheckout } from "@/lib/payuCheckout";

// Same reasoning as SubscribeButton/DayPassButton — PayU redirects
// the whole page away and back, so there's no in-page modal handler
// to write here the way Razorpay's JS SDK needed.
export default function BuyButton({ slug, gameName, accessType, priceDisplay }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const isSubscription = accessType === "subscription";

  async function handleClick() {
    setLoading(true);
    setError("");

    const orderUrl = isSubscription ? "/api/payu/subscribe" : "/api/payu/order";
    const body = isSubscription ? { game: slug } : { type: "onetime", game: slug };

    const result = await startPayuCheckout(orderUrl, body);
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
        className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep disabled:opacity-50"
        style={{ background: "#ffb703" }}
      >
        {loading ? "OPENING..." : isSubscription ? `SUBSCRIBE ${priceDisplay || ""}/MONTH ▸` : `UNLOCK ${priceDisplay} ▸`}
      </button>
      {error && <p className="text-accentMagenta text-xs mt-3">{error}</p>}
    </div>
  );
}
