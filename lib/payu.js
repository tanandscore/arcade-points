import crypto from "crypto";

// Built lazily from env vars at request time, same reasoning as
// lib/razorpay.js — secrets aren't available at Cloudflare's build
// step, only once the site is actually running.
export function getPayuCredentials() {
  return {
    key: process.env.PAYU_MERCHANT_KEY,
    salt: process.env.PAYU_MERCHANT_SALT,
  };
}

// test.payu.in for the sandbox, secure.payu.in once PAYU_ENV=production
// is set — this is PayU's actual documented environment split, not a
// guess: https://docs.payu.in/docs/prebuilt-checkout-page-integration
export function getPayuCheckoutUrl() {
  return process.env.PAYU_ENV === "production" ? "https://secure.payu.in/_payment" : "https://test.payu.in/_payment";
}

export function generateTxnId(prefix = "TAS") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// PayU's documented request-hash format (verified against their
// current docs, not assumed):
// sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt)
// Five udf slots, then SIX literal empty pipe-separated positions,
// then salt — those six empty slots are required and must not be
// removed even though nothing occupies them.
export function generatePaymentHash({ key, txnid, amount, productinfo, firstname, email, udf1 = "", udf2 = "", udf3 = "", udf4 = "", udf5 = "", salt }) {
  const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${salt}`;
  return crypto.createHash("sha512").update(hashString).digest("hex");
}

// The SI (Standing Instruction / recurring subscription) variant —
// identical to the plain payment hash but with si_details JSON
// inserted right before the salt, per PayU's SI integration docs.
export function generateSiPaymentHash({ key, txnid, amount, productinfo, firstname, email, udf1 = "", udf2 = "", udf3 = "", udf4 = "", udf5 = "", siDetails, salt }) {
  const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|${udf1}|${udf2}|${udf3}|${udf4}|${udf5}||||||${JSON.stringify(siDetails)}|${salt}`;
  return crypto.createHash("sha512").update(hashString).digest("hex");
}

// The REVERSE hash PayU sends back with the surl/furl callback, used
// to verify the response genuinely came from PayU and wasn't forged.
// Per PayU's docs the field order is reversed and salt comes first,
// key comes last — this is not the same order as the request hash.
export function generateVerifyHash({ salt, status, udf1 = "", udf2 = "", udf3 = "", udf4 = "", udf5 = "", email, firstname, productinfo, amount, txnid, key }) {
  const hashString = `${salt}|${status}||||||${udf5}|${udf4}|${udf3}|${udf2}|${udf1}|${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
  return crypto.createHash("sha512").update(hashString).digest("hex");
}
