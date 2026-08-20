# Tap & Score (tapandscore.com) — Deployment Guide (no coding required)

This folder is a complete, working website: accounts, 3 games, points,
leaderboards, and one paid game unlocked through Razorpay (built for
Indian users — UPI, cards, netbanking, wallets). Follow these steps in
order. Total time: ~20–30 minutes. You will only ever copy/paste — no
terminal commands needed.

---

## Step 1 — Put the code on GitHub

1. Go to [github.com](https://github.com) and create a free account if you don't have one.
2. Click the **+** in the top right → **New repository**. Name it `arcade-points`. Leave it Public or Private, your choice. Click **Create repository**.
3. On the next page, click **uploading an existing file**.
4. Drag this entire `arcade-points` folder's contents into the browser window (drag all the files/folders, not the outer folder itself).
5. Scroll down, click **Commit changes**.

---

## Step 2 — Create your database (Supabase)

1. Go to [supabase.com](https://supabase.com) → sign up (free tier is fine).
2. Click **New project**. Pick any name and password (save the password somewhere). **For Region, choose Mumbai (ap-south-1)** — this keeps your database close to your Indian users, so the site feels fast. Wait ~2 minutes for it to spin up.
3. In the left sidebar, click the **SQL Editor** icon → **New query**.
4. Open the file `supabase/schema.sql` from this project, copy its entire contents, paste into the SQL editor, and click **Run**. This creates your accounts table, scores table, and leaderboard security rules.
5. In the left sidebar, click **Project Settings** (gear icon) → **API**. You'll need three values from this page in Step 4:
   - **Project URL**
   - **anon public** key
   - **service_role** key (click "reveal") — keep this one secret, never share it publicly

6. Optional but recommended: Project Settings → Authentication → under "Email", you can turn OFF "Confirm email" while you're testing, so new signups don't need to click an email link. Turn it back on before you launch for real.

---

## Step 3 — Set up payments (Razorpay)

Razorpay is India's most-used payment gateway — it supports UPI (the
way most Indian users actually pay), along with cards, netbanking, and
wallets. Unlike some international gateways, it accepts individual /
sole-proprietor signup with just your PAN card and Aadhaar — no
registered company required to get started.

1. Go to [razorpay.com](https://razorpay.com) → sign up.
2. Complete the KYC step with your PAN and bank account details (this is what lets Razorpay pay real money into your account — it typically takes a day or two to be approved; you can build and test everything below in **Test Mode** while you wait).
3. In the Dashboard, toggle to **Test Mode** (top right) for now.
4. Go to **Settings** → **API Keys** → **Generate Test Keys**. Copy the **Key Id** and **Key Secret** — you'll need both in Step 4.

That's it for setup — unlike some gateways, Razorpay doesn't require you to pre-create a "product," since this app creates each order dynamically through the API using the price set in `lib/razorpay.js` (₹149 by default — change `MATH_PRICE_PAISE` there if you want a different price; it's in paise, so ₹149 = 14900).

---

## Step 4 — Put it online (Cloudflare, free, commercial use allowed)

Cloudflare's free plan explicitly allows selling things on your site
(unlike some free hosting tiers), with no bandwidth cap. This project
already includes the small adapter Cloudflare recommends for hosting
a real Next.js app (with logins and API routes) on their network.

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → sign up (free, no card required).
2. In the sidebar, go to **Workers & Pages** → **Create** → **Workers** → **Connect to Git** (or "Import a repository" — wording varies slightly by dashboard version).
3. Pick the `arcade-points` GitHub repo you created in Step 1 → authorize access if asked.
4. Set the **Build command** to `npm run cf:build` and the **Deploy command** to `npx wrangler deploy`. Cloudflare should auto-detect most of this from `wrangler.toml`, already included in this project.
5. Before deploying, open the file `wrangler.toml` (either in this project on your computer, or directly on GitHub) and replace the two placeholder lines under `[vars]` with your real Supabase **Project URL** and **anon public** key (from Project Settings → API in Supabase). These two are safe to keep in the file since they're designed to be public — this guarantees they're available however Cloudflare's dashboard happens to be laid out.
6. Then, in Cloudflare, go to **Settings → Variables and Secrets** and add these 3 genuinely secret values (values from Steps 2 & 3):

   | Name | Value |
   |---|---|
   | `SUPABASE_SERVICE_ROLE_KEY` | your Supabase service_role key |
   | `RAZORPAY_KEY_ID` | your Razorpay Key Id |
   | `RAZORPAY_KEY_SECRET` | your Razorpay Key Secret |
   | `NEXT_PUBLIC_SITE_URL` | leave blank for now, you'll add it after deploying |

7. Deploy. You'll get a live URL like `https://arcade-points.yoursubdomain.workers.dev`.
8. Set `NEXT_PUBLIC_SITE_URL` to that exact URL in the Variables and Secrets screen, and redeploy so it picks up the change.

Your site is now live, for $0, and it's fine to actually sell Math
Rush on it — Cloudflare's free tier doesn't restrict commercial use.
Test-purchase it using Razorpay's test card/UPI details (shown in
their dashboard under Test Mode).

### Step 5 — Connect your domain (tapandscore.com)

Right now your domain sits at Hostinger doing nothing, and your site
lives at a free `.workers.dev` address. This step connects them so
`tapandscore.com` shows your actual site.

1. In the Cloudflare dashboard, go to **Websites** (left sidebar, sometimes called "Add a site") → **Add a domain**. Type `tapandscore.com` → **Continue**.
2. Pick the **Free** plan → **Continue**. Cloudflare scans for any existing DNS records (there likely aren't any yet) → **Continue**.
3. Cloudflare now shows you **two nameservers** that look like `xxx.ns.cloudflare.com` and `yyy.ns.cloudflare.com`. Keep this tab open.
4. In a new tab, log into [hpanel.hostinger.com](https://hpanel.hostinger.com) → **Domains** → click on `tapandscore.com` → find **Nameservers** (sometimes under "DNS / Nameservers").
5. Switch it from Hostinger's default nameservers to **Custom nameservers**, and paste in the two Cloudflare gave you in step 3. Save.
6. This can take anywhere from a few minutes to a few hours to fully take effect (Hostinger and Cloudflare will both show a pending/checking status). Cloudflare will email you once `tapandscore.com` is "Active" on their side — you can move on to the next step and just check back.
7. Once Active: back in Cloudflare, go to **Workers & Pages** → your `arcade-points` worker → **Settings** → **Domains & Routes** → **Add Custom Domain** → type `tapandscore.com` → **Add Domain**. Cloudflare configures the routing and SSL certificate automatically (SSL can take a few minutes to provision).
8. Go back to the **Variables and Secrets** screen on the worker and update `NEXT_PUBLIC_SITE_URL` to `https://tapandscore.com`, then redeploy (**Deployments** tab → **Retry deployment** on the latest one, or push any small change to GitHub to trigger a fresh build).

Your site is now live at `https://tapandscore.com`. Test it end to
end: sign up, play a free game, and test-purchase Math Rush with
Razorpay's test card/UPI details before switching Razorpay to Live
Mode.

---

## Going live for real money

1. Once Razorpay approves your KYC, toggle from **Test Mode** to **Live Mode** in their dashboard.
2. Go to Settings → API Keys → generate **Live** keys.
3. In Cloudflare, replace `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` with the live values in the Variables and Secrets screen, then redeploy.

That's the whole switch — no separate product setup needed, since orders are created dynamically.

---

## Moving to a bigger paid host later

See `MIGRATION.md` in this project — it walks through exactly how to
move to Vercel or any other host later without losing users, accounts,
scores, or purchases, and without anyone noticing the switch.

---

## What's already built in

- Email/password accounts (Supabase Auth)
- 3 games: Reflex Tap, Memory Match (free), Math Rush (paid, ₹149)
- Personal best score tracking per game
- Public leaderboards, per-game and overall
- A real paywall: payments are verified on the server using
  Razorpay's cryptographic signature, and the purchase record is only
  ever written by server code with a service-role key — so it can't be
  bypassed from the browser or faked by replaying someone else's
  payment confirmation.

## Adding a new game later

Copy the `app/games/math` folder as a template, change the game key
(`"math"` → your new key) everywhere, add the key to the `check`
constraint in `supabase/schema.sql` (`game in (...)`), and add a
`GameCard` for it on the dashboard (`app/page.js`). If you don't want
to do this yourself, come back and ask — I can build new games into
this same codebase any time.
