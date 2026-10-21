"use client";

import Script from "next/script";

// Fungies is the site's only payment provider. Its documented React pattern is a vendor <script> with data-auto-init
// that scans the DOM for elements carrying
// data-fungies-checkout-url/data-fungies-mode and wires up the click
// handling itself — confirmed from Fungies' own
// "Example React Checkout" help page, which is written against this
// exact framework. There's no documented manual "open checkout
// programmatically" JS call to fall back on, so this component
// renders plain <button>s with those data attributes rather than
// calling an SDK method.
//
// data-fungies-checkout-url is a per-plan, per-billing-period
// "checkout element" URL from the Fungies dashboard (Store Builder ->
// the product's checkout link) — NOT a product or price ID by
// itself, which is why these are stored whole in the
// subscription_plans table rather than assembled from a bare ID here
// (see migration_068_fungies_payment_provider.sql).
//
// data-fungies-custom-fields carries our own user_id/plan_id through
// to the webhook — but ONLY if a Custom Field with that exact Key
// ("user_id", "plan_id") has first been created for this product in
// the Fungies dashboard (Fungies only forwards keys it recognizes).
// See the README note added alongside this file for that one-time
// setup step.
//
// Genuinely unverified, stated plainly: this has NOT been exercised
// against a real Fungies checkout from this environment. Test that
// clicking each button actually opens the overlay and that a test
// payment fires payment_success with the custom fields attached,
// before relying on this in production.
export default function FungiesSubscribeButton({
  fungiesCheckoutUrlMonthly,
  fungiesCheckoutUrlAnnual,
  priceDisplayMonthly,
  priceDisplayAnnual,
  planId,
  planName = "Power Pass",
  userId,
}) {
  const customFields = JSON.stringify({ user_id: userId, plan_id: planId });

  return (
    <div className="flex flex-col gap-2">
      {/* Loaded once per page; data-auto-init scans for the buttons
          below as soon as it runs, so it must load after they're
          already in the DOM — true here since both render together. */}
      <Script
        id="fungies-checkout-script"
        src="https://cdn.jsdelivr.net/npm/@fungies/fungies-js@0.0.6"
        strategy="afterInteractive"
        data-auto-init=""
      />
      <div className="flex gap-2">
        <button
          data-fungies-checkout-url={fungiesCheckoutUrlMonthly}
          data-fungies-custom-fields={customFields}
          data-fungies-mode="overlay"
          disabled={!fungiesCheckoutUrlMonthly}
          className="flex-1 rounded-md py-3 font-pixel text-[10px] text-bgDeep disabled:opacity-50"
          style={{ background: "#3ee6e0" }}
        >
          {priceDisplayMonthly || ""}/MO ▸
        </button>
        <button
          data-fungies-checkout-url={fungiesCheckoutUrlAnnual}
          data-fungies-custom-fields={customFields}
          data-fungies-mode="overlay"
          disabled={!fungiesCheckoutUrlAnnual}
          className="flex-1 rounded-md py-3 font-pixel text-[10px] text-bgDeep disabled:opacity-50"
          style={{ background: "#3ee6e0" }}
        >
          {priceDisplayAnnual || ""}/YR ▸
        </button>
      </div>
      <p className="text-[10px] text-textDim">Payments processed securely via Fungies</p>
      {!fungiesCheckoutUrlMonthly && !fungiesCheckoutUrlAnnual && (
        <p className="text-accentMagenta text-xs">
          {planName} isn't configured for Fungies checkout yet — missing checkout URLs in subscription_plans.
        </p>
      )}
    </div>
  );
}
