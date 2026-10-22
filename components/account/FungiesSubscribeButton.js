"use client";


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
// Upgrade 46: the pop-up (overlay) mode was refused by Fungies' store ("refused to connect"), so the buttons now simply open
// Fungies' own checkout page, with our user_id and plan_id added to the link (Fungies' documented "prefilled custom fields" links).
const withFields = (url, userId, planId) => {
  if (!url) return "";
  const u = new URL(url); u.searchParams.set("user_id", userId || ""); u.searchParams.set("plan_id", planId || ""); return u.toString();
};

export default function FungiesSubscribeButton({
  fungiesCheckoutUrlMonthly,
  fungiesCheckoutUrlAnnual,
  priceDisplayMonthly,
  priceDisplayAnnual,
  planId,
  planName = "Power Pass",
  userId,
}) {
  const cls = "flex-1 rounded-md py-3 font-pixel text-[10px] text-bgDeep text-center";
  const off = "flex-1 rounded-md py-3 font-pixel text-[10px] text-bgDeep text-center opacity-50 pointer-events-none";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <a href={withFields(fungiesCheckoutUrlMonthly, userId, planId) || undefined} className={fungiesCheckoutUrlMonthly ? cls : off} style={{ background: "#3ee6e0" }}>
          {priceDisplayMonthly || ""}/MO ▸
        </a>
        <a href={withFields(fungiesCheckoutUrlAnnual, userId, planId) || undefined} className={fungiesCheckoutUrlAnnual ? cls : off} style={{ background: "#3ee6e0" }}>
          {priceDisplayAnnual || ""}/YR ▸
        </a>
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
