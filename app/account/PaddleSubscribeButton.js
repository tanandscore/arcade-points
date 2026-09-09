"use client";

import { useEffect, useState } from "react";
import { initializePaddle } from "@paddle/paddle-js";

// International-subscriber counterpart to SubscribeButton.js (which
// stays as-is for the existing PayU flow). Paddle's checkout is a
// real overlay opened directly from the browser via Paddle.js, not a
// server-created order the way Razorpay/PayU work — so this component
// initializes its own Paddle.js instance and opens the checkout
// itself, rather than calling a backend "create order" route first.
//
// Offers both monthly and annual as two separate, clearly-labeled
// buttons rather than a toggle — the existing PayU flow only ever
// offered monthly, so there was no established pattern to match, and
// two buttons is the simplest option that doesn't need its own
// selection state.
//
// Requires two client-exposed env vars, separate from the server-side
// PADDLE_API_KEY/PADDLE_WEBHOOK_SECRET already used by the backend
// routes: NEXT_PUBLIC_PADDLE_CLIENT_TOKEN (a client-side token, safe
// to expose — Paddle > Developer tools > Authentication) and
// NEXT_PUBLIC_PADDLE_ENV ("sandbox" while testing, unset or
// "production" for real payments).
//
// Has NOT been exercised against a real Paddle account from this
// environment — verified against Paddle's current, real
// documentation, but real end-to-end testing (does the overlay
// actually open, does a real sandbox payment complete, does the
// webhook fire) needs to happen with real Paddle credentials.
export default function PaddleSubscribeButton({
  paddlePriceIdMonthly,
  paddlePriceIdAnnual,
  priceDisplayMonthly,
  priceDisplayAnnual,
  planId,
  planName = "Power Pass",
  userId,
  userEmail,
}) {
  const [paddle, setPaddle] = useState(undefined);
  const [loadingPriceId, setLoadingPriceId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (!token) {
      // No token configured yet — this button quietly does nothing
      // rather than throw, since Paddle may not be set up yet on a
      // given deployment (e.g. local dev without the env var set).
      return;
    }
    const environment = process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox" ? "sandbox" : "production";
    initializePaddle({ environment, token })
      .then((instance) => {
        if (instance) setPaddle(instance);
      })
      .catch(() => {
        // Swallow — handleClick's own "not ready" check below covers
        // the user-facing side of this failing.
      });
  }, []);

  function handleClick(priceId) {
    if (!paddle) {
      setError("Payments aren't ready yet — try again in a moment.");
      return;
    }
    if (!priceId) {
      setError("This billing period isn't set up for international payments yet.");
      return;
    }
    setLoadingPriceId(priceId);
    setError("");
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: userEmail ? { email: userEmail } : undefined,
      // Read back out of the subscription webhook's customData —
      // this is what links the Paddle subscription to this user and
      // plan in the subscriptions table. See app/api/paddle/webhook.
      customData: { user_id: userId, plan_id: planId },
    });
    // Paddle's overlay checkout is an in-page iframe, not a redirect —
    // there's no further browser-side step to take here. The webhook
    // is what actually confirms payment and updates subscription
    // state; loading here just reflects "checkout opened", not
    // "payment complete".
    setLoadingPriceId(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          onClick={() => handleClick(paddlePriceIdMonthly)}
          disabled={loadingPriceId === paddlePriceIdMonthly}
          className="flex-1 rounded-md py-3 font-pixel text-[10px] text-bgDeep disabled:opacity-50"
          style={{ background: "#3ee6e0" }}
        >
          {loadingPriceId === paddlePriceIdMonthly ? "OPENING..." : `${priceDisplayMonthly || ""}/MO ▸`}
        </button>
        <button
          onClick={() => handleClick(paddlePriceIdAnnual)}
          disabled={loadingPriceId === paddlePriceIdAnnual}
          className="flex-1 rounded-md py-3 font-pixel text-[10px] text-bgDeep disabled:opacity-50"
          style={{ background: "#3ee6e0" }}
        >
          {loadingPriceId === paddlePriceIdAnnual ? "OPENING..." : `${priceDisplayAnnual || ""}/YR ▸`}
        </button>
      </div>
      <p className="text-[10px] text-textDim">International payments via Paddle</p>
      {error && <p className="text-accentMagenta text-xs">{error}</p>}
    </div>
  );
}
