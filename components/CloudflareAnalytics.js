"use client";

import Script from "next/script";

// Cloudflare Web Analytics — chosen over Google Analytics or a
// custom-built solution because it's free, sets no cookies, and
// doesn't collect personally identifiable data, which means no
// cookie-consent banner is legally required in most jurisdictions
// (still worth a line in the privacy policy, which is a separate,
// small addition). It's also pure client-side script injection, not
// server-side Workers code — unlike next/og's ImageResponse (see the
// per-game-image work earlier), this carries none of the
// Workers-filesystem risk, since it's just a script tag loaded in
// the browser like any other, identical regardless of hosting
// platform.
//
// Renders nothing at all if the token isn't set — this repo doesn't
// know your real Cloudflare Web Analytics token, so this stays
// silent and harmless until you add one, rather than shipping a
// broken script tag. See README.md for the one manual step this
// needs (a token from your own Cloudflare dashboard, the same kind
// of one-time setup as the email service earlier).
export default function CloudflareAnalytics() {
  const token = process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN;
  if (!token) return null;
  return (
    <Script
      defer
      src="https://static.cloudflareinsights.com/beacon.min.js"
      data-cf-beacon={JSON.stringify({ token })}
    />
  );
}
