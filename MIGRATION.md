# Moving to a bigger host later, without anyone noticing

This project is deliberately built so hosting is swappable. Here's why,
and exactly what to do when the day comes.

## Why a host switch won't disrupt anyone

Three things make this safe:

1. **Your database and accounts live in Supabase, not in Cloudflare.**
   Hosting only serves the website's pages and runs its API routes —
   it never stores any data. Moving hosts never touches a single use...r
   account, score, or purchase record.

2. **The code has no Cloudflare-only parts.** Everything under `app/`,
   `components/`, and `lib/` is plain Next.js. The only
   Cloudflare-specific files are `wrangler.toml` and
   `open-next.config.ts` — moving elsewhere just means those two files
   stop being used, nothing in the app needs to change.

3. **Your web address doesn't change, if you're using a custom domain.**
   This is the part that actually determines whether users "notice."
   A host swap behind the same domain is invisible. A host swap that
   also changes the domain (e.g. `.pages.dev` → `.vercel.app`) is not —
   every bookmark, saved link, and search result breaks. If you
   haven't already, buying a custom domain (any registrar, ~$10–12/yr)
   before you scale is the single highest-leverage thing you can do
   to keep this option open.

## The actual migration steps (e.g. moving to Vercel)

1. **Deploy the same GitHub repo to the new host.** On Vercel: Add New
   → Project → import this repo. Paste in the same environment
   variables you're already using on Cloudflare (Supabase keys,
   Razorpay keys, `NEXT_PUBLIC_SITE_URL`). Vercel runs a completely
   standard `next build` — it ignores `wrangler.toml` and
   `open-next.config.ts` entirely, so no code changes are needed.
2. **Test the new deployment on its temporary URL** (e.g.
   `arcade-points.vercel.app`) before touching anything live. Log in,
   play a game, submit a score — confirm it all talks to the same
   Supabase project correctly.
3. **Re-point your domain's DNS to the new host**, following that
   host's custom-domain instructions (Vercel: Project Settings →
   Domains → add your domain, then update the DNS records it gives
   you at your domain registrar).
4. **DNS changes typically take a few minutes to a few hours to fully
   propagate.** During that window some visitors may briefly land on
   the old host and some on the new — both are fully working copies
   of the same site talking to the same database, so this is
   harmless.
5. Once propagation is done, you can remove the project from
   Cloudflare. Nothing else changes — no user is logged out, no score
   or purchase is lost, because none of that ever lived on the host
   in the first place.

## Moving to somewhere other than Vercel

The same steps apply to any Next.js-friendly host (Netlify, Render,
Railway, AWS, your own server, etc.) — deploy the repo, set the same
env vars, verify, then repoint DNS. Nothing about this project locks
you into Cloudflare or into any particular next stop.
