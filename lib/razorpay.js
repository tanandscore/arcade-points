import Razorpay from "razorpay";

// Built lazily (only when actually needed, inside a request) rather than
// the moment this file is imported. Cloudflare's build step doesn't have
// your secret keys available yet at that point — only once the site is
// actually running does it. Creating the client too early is what caused
// the "key_id or oauthToken is mandatory" build error.
let cachedClient = null;

export function getRazorpay() {
  if (!cachedClient) {
    cachedClient = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return cachedClient;
}
