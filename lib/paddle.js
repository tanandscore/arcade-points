import { Paddle, Environment } from "@paddle/paddle-node-sdk";

// Lazy-init pattern: built only when actually needed inside a
// request, not at import time, since Cloudflare's build step doesn't
// have secret env vars
// available yet at that point.
let cachedClient = null;

export function getPaddle() {
  if (!cachedClient) {
    // PADDLE_ENVIRONMENT should be unset (or "production") in the
    // real deployment; set it to "sandbox" only in local/staging
    // testing against Paddle's sandbox account. Defaulting to
    // production (by not passing an environment override at all
    // unless explicitly told to use sandbox) avoids the mistake of
    // accidentally shipping a sandbox-mode client to production.
    const options =
      process.env.PADDLE_ENVIRONMENT === "sandbox" ? { environment: Environment.sandbox } : undefined;
    cachedClient = new Paddle(process.env.PADDLE_API_KEY, options);
  }
  return cachedClient;
}
