"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function BuyButton({ slug, gameName, accessType, priceDisplay }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const isSubscription = accessType === "subscription";

  async function handleClick() {
    setLoading(true);
    setError("");

    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setError("Couldn't load the payment window. Check your connection and try again.");
      setLoading(false);
      return;
    }

    const endpoint = isSubscription ? "/api/razorpay/subscribe" : "/api/razorpay/order";
    const body = isSubscription ? undefined : JSON.stringify({ game: slug });

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await res.json();

    if (isSubscription && !data.subscriptionId) {
      setError(data.error || "Couldn't start checkout.");
      setLoading(false);
      return;
    }
    if (!isSubscription && !data.orderId) {
      setError(data.error || "Couldn't start checkout.");
      setLoading(false);
      return;
    }

    const options = {
      key: data.keyId,
      name: "Tap & Score",
      description: isSubscription ? "Premium Pass — monthly" : `Unlock ${gameName}`,
      theme: { color: "#ffb703" },
      handler: async function (response) {
        const verifyRes = await fetch("/api/razorpay/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(response),
        });
        const verifyData = await verifyRes.json();
        if (verifyData.success) {
          router.refresh();
        } else {
          setError(verifyData.error || "Payment could not be verified.");
        }
        setLoading(false);
      },
      modal: {
        ondismiss: function () {
          setLoading(false);
        },
      },
    };

    if (isSubscription) {
      options.subscription_id = data.subscriptionId;
      options.recurring = 1;
    } else {
      options.order_id = data.orderId;
      options.amount = data.amount;
      options.currency = data.currency;
    }

    const rzp = new window.Razorpay(options);
    rzp.on("payment.failed", function () {
      setError("Payment failed. No charge was made — try again.");
      setLoading(false);
    });
    rzp.open();
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
