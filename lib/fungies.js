import crypto from "crypto";

// Fungies is the site's only payment provider and Merchant of Record.
//
// Everything here is written against Fungies' current, official
// documentation (docs.fungies.io and help.fungies.io), verified as
// precisely as that documentation allows. Two things that
// documentation does NOT state outright and had to be inferred from
// indirect evidence:
//   1. The API's version path — one example request in Fungies' own
//      docs hits https://api.fungies.io/v0/products/list, so /v0/ is
//      used as the base path here. If requests start 404ing, check
//      whether Fungies has since dropped or changed that prefix.
//   2. The exact shape of the webhook payload's `data.subscription`
//      object (it's documented as always present on subscription
//      events, but fields beyond `id` weren't listed) — the webhook
//      handler re-fetches the full subscription via GET
//      /subscriptions/{id} rather than trusting webhook payload
//      shape for period-end/cancel-at-period-end, which Fungies'
//      own docs recommend anyway ("fetch current state from
//      GET /v0/subscriptions/{id}" when status matters).
//
// None of this has been exercised against a real Fungies account
// from this environment — there's no way to do that here. Test the
// full flow (checkout, a real test-mode payment, the webhook firing,
// cancellation) against Fungies' Test mode before this goes anywhere
// near production traffic.

const FUNGIES_API_BASE = "https://api.fungies.io/v0";

function keysForEnvironment() {
  // Leave FUNGIES_ENVIRONMENT unset in the real deployment. NOTE: Fungies' sandbox is a SEPARATE environment
  // (app.stage.fungies.net), not a switch in the normal dashboard, so this setting is not used for the normal test plan
  // (test with one small real purchase instead — see claude/upgrade-45).
  if (process.env.FUNGIES_ENVIRONMENT === "sandbox") {
    return {
      publicKey: process.env.FUNGIES_TEST_PUBLIC_KEY,
      secretKey: process.env.FUNGIES_TEST_SECRET_KEY,
    };
  }
  return {
    publicKey: process.env.FUNGIES_PUBLIC_KEY,
    secretKey: process.env.FUNGIES_SECRET_KEY,
  };
}

// Calls the Fungies REST API directly with fetch (no official Node
// SDK is documented), using the two-header key
// scheme Fungies documents: x-fngs-public-key on every request,
// x-fngs-secret-key additionally required for any write (POST/PATCH/
// PUT/DELETE).
export async function fungiesFetch(path, { method = "GET", body } = {}) {
  const { publicKey, secretKey } = keysForEnvironment();
  const headers = {
    "Content-Type": "application/json",
    "x-fngs-public-key": publicKey,
  };
  if (method !== "GET") {
    headers["x-fngs-secret-key"] = secretKey;
  }

  const response = await fetch(`${FUNGIES_API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await response.json().catch(() => null);
  if (!response.ok || json?.status === "error") {
    const message = json?.error?.message || `Fungies API error (${response.status})`;
    throw new Error(message);
  }
  return json?.data;
}

// Verifies the x-fngs-signature header: HMAC-SHA256 over the RAW
// request body (before JSON parsing), keyed with the webhook secret,
// formatted as "sha256_" + hex digest. Confirmed from Fungies' "Set
// Up Webhooks" docs, which explicitly warn that parsing the body
// before verifying causes mismatches — which is why the webhook route
// reads request.text() rather than request.json().
export function verifyFungiesWebhookSignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !signatureHeader.startsWith("sha256_")) return false;
  const provided = signatureHeader.slice("sha256_".length);
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  // Timing-safe compare — both must be equal length for
  // timingSafeEqual, which a mismatched/forged signature usually
  // won't be, so that case is treated as "not equal" rather than
  // thrown.
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

// Fetches the authoritative current state of a subscription straight
// from Fungies rather than trusting webhook payload shape — Fungies'
// own docs recommend this for subscription_created/subscription_updated
// events, since those can arrive with a still-pending first payment or
// out of order relative to one another.
export async function getFungiesSubscription(subscriptionId) {
  return fungiesFetch(`/subscriptions/${subscriptionId}`);
}

// cancelOption: "endPeriod" keeps access through what's already been
// paid for, matching this app's existing cancellation behavior for
// every other provider. refundOption: "noRefund" matches the same
// "no refund for remaining days" copy already shown in
// SubscriptionBox.js.
export async function cancelFungiesSubscription(subscriptionId) {
  return fungiesFetch(`/subscriptions/${subscriptionId}/cancel`, {
    method: "PATCH",
    body: { Id: subscriptionId, cancelOption: "endPeriod", refundOption: "noRefund" },
  });
}
