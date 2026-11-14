"use client";


// Fungies is the site's only payment provider. Its documented React pattern is a vendor <script> with data-auto-init
// that scans the DOM for elements carrying
// data-fungies-checkout-url/data-fungies-mode and wires up the click
// handling itself — confirmed from Fungies' own
// "Example React Checkout" help page, which is written against this
// exact framework. There's no documented manual "open checkout
// programmatically" JS call to fall back on, so this component
// renders plain links rather than calling an SDK method.
//
// data-fungies-checkout-url is a per-plan, per-billing-period
// "checkout element" URL from the Fungies dashboard (Store Builder ->
// the product's checkout link) — NOT a product or price ID by
// itself, which is why these are stored whole in the
// subscription_plans table rather than assembled from a bare ID here
// (see migration_068_fungies_payment_provider.sql).
//
// The user_id and plan_id are carried through to the webhook as Fungies' "prefilled custom fields" — but ONLY if a Custom Field
// with that exact Key ("user_id", "plan_id") has first been created for this product in the Fungies dashboard (Fungies only
// forwards keys it recognizes). See the README note for that one-time setup step.
//
// Upgrade 46: the pop-up (overlay) mode was refused by Fungies' store ("refused to connect"), so the buttons now simply open
// Fungies' own checkout page, with our user_id and plan_id added to the link.
// Upgrade 70: same behaviour, new look — two big buttons (monthly, yearly) in the colour of the pass being bought.
const withFields = (url, userId, planId) => {
  if (!url) return "";
  const u = new URL(url); u.searchParams.set("user_id", userId || ""); u.searchParams.set("plan_id", planId || ""); return u.toString();
};

function Option({ href, price, per, primary, accent }) {
  const on = !!href;
  return (
    <a
      target="_blank"
      rel="noopener"
      href={on ? href : undefined}
      aria-disabled={!on}
      className={`st-btn ${primary ? "st-btn-primary" : "st-btn-ghost"} flex-1 !h-[58px] !px-3 flex-col !gap-0.5 ${on ? "" : "is-off"}`}
      style={{ "--acc": accent }}
    >
      <span className="text-[17px] font-extrabold leading-none">{price || "Choose"}</span>
      <span className="text-[11.5px] font-semibold leading-none opacity-80">{per}</span>
    </a>
  );
}

export default function FungiesSubscribeButton({
  fungiesCheckoutUrlMonthly,
  fungiesCheckoutUrlAnnual,
  priceDisplayMonthly,
  priceDisplayAnnual,
  planId,
  planName = "Power Pass",
  userId,
  accent = "#3ee6e0",
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex gap-2.5">
        <Option href={withFields(fungiesCheckoutUrlMonthly, userId, planId)} price={priceDisplayMonthly} per="per month" primary accent={accent} />
        <Option href={withFields(fungiesCheckoutUrlAnnual, userId, planId)} price={priceDisplayAnnual} per="per year" accent={accent} />
      </div>
      <p className="text-[12px] text-[#a99fd6]">Secure checkout by Fungies. Cancel any time.</p>
      {!fungiesCheckoutUrlMonthly && !fungiesCheckoutUrlAnnual && (
        <p className="text-accentMagenta text-xs">
          {planName} isn&apos;t set up for checkout yet. The checkout links are missing in the subscription_plans table.
        </p>
      )}
    </div>
  );
}
