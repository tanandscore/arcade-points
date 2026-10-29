"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import FungiesSubscribeButton from "@/components/account/FungiesSubscribeButton";

export default function SubscriptionBox({ subscription, planId, planName, userId, fungiesCheckoutUrlMonthly, fungiesCheckoutUrlAnnual, priceDisplayMonthly, priceDisplayAnnual, accent = "#3ee6e0" }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const router = useRouter();

  const periodEndLabel = subscription.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })
    : null;

  // Fungies does NOT document an API call that generates a billing
  // portal link — its own docs describe customers managing a
  // subscription by logging into the storefront itself (avatar menu
  // -> Subscription Management Portal). So "Manage billing" just
  // opens that storefront URL directly; nothing to fetch first. If
  // Fungies adds a real portal-session API later, this is the one
  // place to wire it in.
  function handleManageBilling() {
    // Falls back to the real store address so this works even if the build did not receive the setting.
    const storeUrl = process.env.NEXT_PUBLIC_FUNGIES_STORE_URL || "https://tapandscore.app.fungies.io";
    if (!storeUrl) {
      setError("Billing portal isn't configured yet — missing NEXT_PUBLIC_FUNGIES_STORE_URL.");
      return;
    }
    window.open(storeUrl, "_blank", "noopener,noreferrer");
  }

  async function handleCancel() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/fungies/cancel-subscription", {
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

  // Upgrade 70: the page draws the card and the pass name; this box only says what is going on with the subscription.
  return (
    <div>
      {subscription.cancel_at_period_end ? (
        <>
          <p className="text-[14.5px] text-[#f5f0ff]">Your subscription is cancelled and won&apos;t renew.</p>
          {periodEndLabel && (
            <p className="text-[13.5px] text-accentCyan mt-1.5">
              You still have full access until <span className="text-textLight">{periodEndLabel}</span>.
            </p>
          )}
          <p className="st-muted text-[13.5px] mt-1.5 mb-4 leading-relaxed">Want to keep {planName || "Power Pass"}? Renew below. Your new plan starts when you pay, and your current access stays until then.</p>
          <FungiesSubscribeButton
            fungiesCheckoutUrlMonthly={fungiesCheckoutUrlMonthly}
            fungiesCheckoutUrlAnnual={fungiesCheckoutUrlAnnual}
            priceDisplayMonthly={priceDisplayMonthly}
            priceDisplayAnnual={priceDisplayAnnual}
            planId={planId}
            planName={planName}
            userId={userId}
            accent={accent}
          />
        </>
      ) : (
        <>
          <p className="text-[14.5px] text-[#f5f0ff] leading-relaxed">
            {periodEndLabel ? (
              <>Active. Renews automatically on <span className="font-semibold">{periodEndLabel}</span>.</>
            ) : (
              `Your ${planName || "Power Pass"} subscription is active.`
            )}
          </p>
          {error && <p className="text-accentMagenta text-[13.5px] mt-3">{error}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
            <button type="button" onClick={handleManageBilling} className="st-btn st-btn-ghost st-btn-sm">
              Manage billing
            </button>
            {!confirming && (
              <button type="button" onClick={() => setConfirming(true)} className="text-[13.5px] st-muted underline underline-offset-2 hover:text-white">
                Cancel subscription
              </button>
            )}
          </div>
          <p className="st-muted text-[12.5px] mt-2.5">Opens Fungies, our payment partner, where your invoices and payment method live.</p>
          {confirming && (
            <div className="mt-4 rounded-xl p-4" style={{ background: "rgba(255,62,165,.08)", boxShadow: "inset 0 0 0 1px rgba(255,62,165,.35)" }}>
              <p className="text-[13.5px] text-[#e6e0ff] leading-relaxed">
                You&apos;ll keep access until {periodEndLabel || "the end of your current billing period"}. There is no refund for the remaining days,
                but nothing more will be charged after that.
              </p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={loading}
                  className="st-btn st-btn-sm disabled:opacity-50"
                  style={{ background: "#ff3ea5", color: "#fff" }}
                >
                  {loading ? "Cancelling..." : "Yes, cancel"}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="st-btn st-btn-ghost st-btn-sm">
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
