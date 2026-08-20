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

export default function BuyButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleBuy() {
    setLoading(true);
    setError("");

    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setError("Couldn't load the payment window. Check your connection and try again.");
      setLoading(false);
      return;
    }

    const orderRes = await fetch("/api/razorpay/order", { method: "POST" });
    const order = await orderRes.json();
    if (!order.orderId) {
      setError(order.error || "Couldn't start checkout.");
      setLoading(false);
      return;
    }

    const rzp = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: "Tap & Score",
      description: "Unlock Math Rush",
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
    });

    rzp.on("payment.failed", function () {
      setError("Payment failed. No charge was made — try again.");
      setLoading(false);
    });

    rzp.open();
  }

  return (
    <div>
      <button
        onClick={handleBuy}
        disabled={loading}
        className="font-pixel text-[10px] px-6 py-3 rounded-md text-bgDeep disabled:opacity-50"
        style={{ background: "#ffb703" }}
      >
        {loading ? "OPENING..." : "UNLOCK GAME ▸"}
      </button>
      {error && <p className="text-accentMagenta text-xs mt-3">{error}</p>}
    </div>
  );
}
