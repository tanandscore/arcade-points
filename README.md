# Tap & Score (tapandscore.com) — Deployment Guide (no coding required)

This folder is a complete, working website: accounts, 14 games, points,
leaderboards, a public landing page, basic SEO, and one paid game
unlocked through Razorpay (built for Indian users — UPI, cards,
netbanking, wallets). Follow these steps in order. Total time: ~20–30
minutes. You will only ever copy/paste — no terminal commands needed.

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
4b. Then run each of these the same way, **in this exact order** (each is a separate paste-and-run): `supabase/migration_001_open_games.sql`, `supabase/migration_002_games_table_and_subscriptions.sql`, `supabase/migration_003_subscription_plans.sql`, `supabase/migration_004_admin.sql`, `supabase/migration_005_strategy_and_shooter_games.sql`, `supabase/migration_006_country_and_lifetime_points.sql`, `supabase/migration_007_flagship_arcade_games.sql`, `supabase/migration_008_more_classic_arcade_games.sql`, `supabase/migration_009_monetization_and_referrals.sql`, `supabase/migration_010_apex_circuit_3d.sql`, `supabase/migration_011_dominion_and_multiplayer.sql`, `supabase/migration_012_grand_prix_duel.sql`, `supabase/migration_013_subscription_cancellation.sql`, `supabase/migration_014_feedback.sql`, `supabase/migration_015_more_classic_games.sql`, `supabase/migration_016_more_arcade_games_premium.sql`, `supabase/migration_017_final_arcade_batch.sql`, `supabase/migration_018_premium_plus_tier.sql`, `supabase/migration_019_game_maintenance_mode.sql`, `supabase/migration_020_multi_tier_subscriptions.sql`, `supabase/migration_021_original_free_games.sql`. Together these create the `games`, `subscription_plans`, admin, country, and lifetime-points setup — the ones you'll edit directly whenever you want to change a price, add/hide a game, or make someone an admin, with no code involved.
4c. **Make yourself an admin**: Table Editor → `profiles` → find your row (match it by your email if usernames aren't obvious) → set `is_admin` to `true` → save. Admins play every game free and can manage other users at `/admin` once the site is live.
4d. **Turn on password recovery**: Authentication → URL Configuration → set **Site URL** to `https://tapandscore.com`, and add `https://tapandscore.com/reset-password` under **Redirect URLs**. Without this, the "forgot password" email link won't work.
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
4. Go to **Settings** → **API Keys** → **Generate Test Keys**. Copy the **Key Id** and **Key Secret**.

That covers one-time purchases — Razorpay doesn't require pre-creating
a "product" for those, since this app creates each order dynamically
using the price stored in the `games` table (see "Editing prices and
games" below).

### Setting up subscriptions (Premium games)

Subscriptions need one extra thing per tier: a Razorpay **Plan**.

1. In Razorpay, go to **Subscriptions** → **Plans** → **Create Plan**. Set the billing frequency to **Monthly** and the amount to match a tier in your `subscription_plans` table (₹100 for the "premium" tier that ships by default). Save it, then copy its **Plan ID** (starts with `plan_`).
2. In Supabase, go to **Table Editor** → `subscription_plans` → open the `premium` row → paste that Plan ID into `razorpay_plan_id` → save.
3. In Razorpay, go to **Settings** → **Webhooks** → **Add New Webhook**. Set the URL to `https://tapandscore.com/api/razorpay/webhook`, select the `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `subscription.completed`, and `subscription.halted` events, and save. Copy the **Signing Secret** it gives you.
4. Add that secret as `RAZORPAY_WEBHOOK_SECRET` in Cloudflare (Step 4 below).

This webhook is what keeps a subscriber's access accurate automatically
as Razorpay charges (or fails to charge) their monthly mandate — you
never have to check on it manually.

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
6. Then, in Cloudflare, go to **Settings → Variables and Secrets** and add these values (values from Steps 2 & 3):

   | Name | Value |
   |---|---|
   | `SUPABASE_SERVICE_ROLE_KEY` | your Supabase service_role key |
   | `RAZORPAY_KEY_ID` | your Razorpay Key Id |
   | `RAZORPAY_KEY_SECRET` | your Razorpay Key Secret |
   | `RAZORPAY_WEBHOOK_SECRET` | your webhook signing secret (leave blank until you've done the webhook step above) |
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

- **Racing controls eased significantly further** — the track is now over 50% wider (7.4 → 11.5 units), steering is noticeably more responsive, off-track and corner penalties are softer, and the random "loss of control" wobble on hard corners has been removed entirely.
- **Real visual depth added to both racing games** — a distant ring of hills gives the horizon actual depth, a start/finish arch marks the lap line, and the car model itself got mirrors, exhaust pipes, bright wheel rims, and a subtle colored underglow. All of this lives in the shared track-building library, so both Apex Circuit and Grand Prix Duel got it from one set of changes.
- **2 genuinely original free games**: Echo Chase (a live replay of your own past movement becomes a hazard chasing you — not a reskin of any existing genre) and Pulse Maze (cross a field of rhythm-timed gates, a mechanic distinct from the dodge-based Lane Dash). Both have the same auto-continuing level progression as the rest of the free tier.
- **Fixed a real schema gap**: the `subscriptions` table only ever allowed one subscription per user (single-column primary key), which is exactly why Premium Plus couldn't show up as an independent option on the account page — there was no room for a second one. Changed to a composite key `(user_id, plan_id)` so a user can hold Premium and Premium Plus completely independently, and updated every route that touches this table (`hasSubscriptionAccess`, cancel-subscription, subscribe) to be plan-aware.
- **Account page rewritten to be tier-aware** — it now shows a separate card for every subscription tier that has games behind it (Premium, Premium Plus, and any future tier automatically), each with its own status, subscribe button, and cancel flow.
- **Landing page game ordering now matches the dashboard** — same Arcade-first, Premium-Plus-second, Premium-third ordering in both places, so what a visitor sees before signing up matches what they see after.
- **Removed the "100% FREE" corner badge** from the landing page — back to the plain button, per feedback.

## Deployment resilience — how this actually works

**The good news first:** Cloudflare Workers deployments are already atomic. When you run `wrangler deploy`, there is no window where the site is half-updated or down — traffic switches to the new version instantly at the edge. Existing users don't get disrupted by the deploy itself.

**The one real edge case, on any Next.js host:** if someone's page loaded *before* a deploy, and they then click a link to a part of the site they haven't visited yet, their browser tries to fetch a JS chunk that the new deploy has since replaced. Without handling this, it shows up as a hard crash. **`components/DeploymentGuard.js`** (loaded site-wide from the root layout) now catches exactly this failure and shows a calm, dismissible "a newer version is ready — refresh whenever you like" prompt instead — and critically, it never auto-refreshes. Someone mid-game keeps playing on the old code until they choose to refresh. Nothing is ever pulled out from under them.

**For updating one specific game without disrupting the rest of the site:** a new `under_maintenance` flag on the `games` table (separate from `is_active`, which fully removes a game). Set it to `true` before pushing a risky change to one game, and instead of a broken page, players see a calm "🔧 Game engine updating" message — both on that game's page and as a small badge on its dashboard card, so nobody clicks in blind. Flip it back to `false` the moment the new version is confirmed working. Every other game and the rest of the site are completely unaffected the whole time.

**Scaling note:** both Cloudflare Workers and Supabase are already serverless/auto-scaling — there's no fixed server count to manage as traffic grows. The levers that actually matter at higher scale are your Cloudflare Workers plan tier (request limits) and Supabase's plan tier (database connections/compute), not this codebase's architecture.
- **Titan Arena expanded to a full 10-fighter roster**, each with 2 genuinely distinct special abilities (9 different mechanical effects across the roster — ranged, unblockable, guard-break, stun, heal, dash, knockback, poison damage-over-time, lifesteal — not just re-skinned damage numbers)
- **Dedicated battle music** — a separate, more intense track from the site's general arcade music, starting the moment the arena opens (character select), through the whole fight
- **Every fighter has its own combat sound** — punches, kicks, and specials are all built from that character's own sound voice (frequency, waveform, glide direction), so all 10 fighters sound audibly different in a fight, not shared generic sfx
- **New "Premium Plus" tier** (₹199/month) — a separate subscription above Premium, not bundled in. Existing Premium subscribers do NOT get access automatically.
- **Titan Arena** — the Premium Plus flagship: a genuinely full-3D fighting game (real 3D character models built and rigged in Three.js, not the 2D-abstracted combat used elsewhere in the site). Fullscreen on entry, laptop/desktop only (shows a clear message and blocks play on touch-primary or small screens). First-wave roster of 3 original fighters — Kael Ashborn, Nyx Frostwind, Raiju Volt — each with a genuinely distinct special move (ranged, guard-break, and unblockable respectively), not just re-skinned damage numbers. This is an original game, not a reproduction of any existing commercial title or its characters.
- **Every game in the catalog now has difficulty/level progression — 100% coverage.** This batch finished the remaining strategy and racing titles: Colony Rush (building milestones), Empire Command & Dominion (6-level AI difficulty — Dominion's change was deliberately limited to the AI's numeric parameters only, not touching any of its WebGL rendering or click-handling code), Turbo Circuit (distance milestones with a genuinely narrowing timing window), Territory Duel (6-level AI difficulty for its AI-fallback mode, multiplayer matches unaffected), and Apex Circuit (each completed lap is now a real level-up moment with a bonus, not just a counter)
- **5 more free games get level progression** (20 of 21 free games now leveled): Reflex Tap (a real difficulty ladder — the reaction window shrinks each level, run ends when you're too slow), Strike Zone (milestone-based, more targets + faster spawns), Platform Quest (distance milestones), Tic Tac Duel (rewritten as an endless AI ladder — beat the computer and a smarter one steps up, draws just replay, only a loss ends the run), Creature Clash (the 5-battle gauntlet is now endless — every win brings a tougher opponent forever, with "Tier" celebrations every 5 battles)
- **6 more free games get level progression** (15 total now): Neon Snake, Mole Rush, Typing Rush, Color Rush (all milestone-based: hit a target, level up, earn a real reward — bonus time or faster pace), Lane Dash and Pixel Jumper (distance milestones with bonus points)
- **Fixed a real, serious bug in Pixel Jumper**: it was submitting a score of 0 every single run, regardless of actual distance traveled, due to a stale closure capturing the score at game-start instead of game-end. Found and fixed while adding leveling — also fixed the same category of bug in Lane Dash, where the obstacle speed never actually increased in gameplay even though the displayed number did.
- **7 more premium games get real level progression** (13 total now): Star Defender & Shell Squad (explicit wave celebrations added to existing scaling), Peak Ascent (100m milestones), Swarm Breach (worm speed + count scale with level), Fruit Chase (auto-continuing maze, same pattern as Maze Muncher), Horizon Guardian (rescue milestones + scaling abductor spawns), and Iron Fist (a real opponent ladder — beat one rival and a tougher one steps up immediately, score carries, until you actually lose a match)
- **Richer sound across every single game, free or premium** — upgraded the shared sound engine itself (smoother attack envelopes, a layered "chorus" harmony on positive sounds) rather than touching each game file individually, so all ~38 games benefit automatically. Added a dedicated "level up" fanfare, distinct from the personal-best sound.
- **Level progression extended to 6 free games** (now 9 total with Maze Muncher/Brick Blaster/Block Cascade from before): Memory Match (bigger boards each level, 90-second session), Sequence, Digit Span, Word Scramble, Quick Trivia — each with real level-up feedback (sound + flash + haptic) and score that carries forward
- **6 premium games now have 6 difficulty levels instead of 4** (Sky Raiders, Void Drifter, Duel Arena, Rim Rockers, Beat Rush, and Grand Prix Duel's AI mode) — a real, distinct difficulty curve from Cadet through Legend, each with its own score multiplier
- **Auto-continuing level progression on free games** (Maze Muncher, Brick Blaster, Block Cascade) — clearing a maze/board doesn't end the run, it escalates (more critters, faster ball, faster drop) and keeps going with your score carried forward, until you actually lose. A "LEVEL X!" flash + sound + haptic pulse marks each level-up — designed to hook casual visitors into "just one more level" and give them a real taste of depth before they ever consider Premium. More free games will get the same treatment in a follow-up round.
- **No more splash gate** — the "PRESS START" moment is folded directly into the landing page hero (a small blinking prompt above the main button) instead of a separate blocking screen, matching the "no nonsense, no bloatware" positioning
- **Haptic feedback** on mobile — a light tap vibration on bottom-tab navigation, and a distinct celebratory pulse when you hit a new best or take #1 on a leaderboard (silently does nothing on devices without vibration support, like iOS Safari)
- **Instant-feeling page transitions** — dashboard, leaderboard, Hall of Fame, account, and every game page now show a branded loading screen the moment you tap, instead of the browser just sitting on the old page while data loads
- Removed accidental text-selection highlighting on rapid taps (the biggest remaining "this feels like a webpage, not an app" tell during fast game controls)
- **Easier, more forgiving racing controls** — steering is more responsive, the off-track and sharp-corner speed penalties are less punishing, and the random "loss of control" wobble on corners is much smaller — the track still requires real driving skill, but no longer fights the player.
- **AI difficulty levels 1–4** in Grand Prix Duel's "Race vs AI" mode (Rookie/Amateur/Pro/Legend) — each level genuinely changes the bot's top speed, cornering skill, and reaction smoothness, with a real score multiplier (×1 / ×1.3 / ×1.6 / ×2) for beating a tougher opponent
- **"PRESS START" splash screen** on the landing page — a real arcade-cabinet attract-mode gate. Tapping or pressing any key to enter is also the exact gesture browsers require before audio can play, so the soundtrack genuinely starts the instant someone enters the site (true zero-interaction autoplay isn't possible on any website — this is the closest real equivalent, and it's on-theme rather than a hidden technical requirement)
- **Richer, louder background music** — a 4-section evolving chiptune arrangement (not one repeating loop) with a percussive layer, volume more than tripled from before. The toggle button also now correctly shows sound is on by default and invites the first tap ("Tap for music") instead of misleadingly showing muted.
- **Difficulty levels (1/2/3)** on Sky Raiders, Void Drifter, Duel Arena, Rim Rockers, and Beat Rush — each level meaningfully changes the game's actual difficulty parameters (speed, spawn rate, AI toughness, timing windows), and higher levels award a real score multiplier (×1 / ×1.35 / ×1.8) for playing harder
- **Retro arcade background music** on the landing page and dashboard — a looping chiptune bassline + arpeggiated lead, synthesized on the fly (no audio files). A floating 🔊/🔇 toggle sits in the bottom corner of both pages; it's the same mute setting used everywhere else on the site, so turning it off there also silences in-game sound effects, and vice versa.
- **Real racing physics** — the car no longer auto-follows the track. Steering rotates the car's own heading; not turning through a corner drives you straight off it, exactly like a real car. Trees and gravel run-off now line the track too.
- **13 classic-arcade-inspired games** (all Premium): Star Defender, Void Drifter, Swarm Breach, Sky Raiders, Peak Ascent, Horizon Guardian, Duel Arena, Frontline Marksman, Fruit Chase, Iron Fist, Shell Squad, Rim Rockers, Beat Rush — original games inspired by genre classics, spanning shooters, a real 1v1 fighter, a maze chase with power-ups, a brawler, arcade basketball, and a rhythm game
- **Dashboard reordered** — Arcade category shown first, "Most Popular" card grid replaced with a "Most Played" ranked leaderboard list
- **Full account management** (`/account`) — subscription status with cancel, a ₹10/24-hour Premium day pass, complete one-time purchase history, and referral status, all in one place
- **Private feedback form** (`/feedback`) — goes straight to an admin-only panel, never shown to other users or published anywhere
- **Dominion background music** — a soft ambient pad, separate from sound effects, respecting the mute toggle
- **Self-service subscription cancellation** — cancel anytime from `/account`; access continues until the end of the period already paid for (Razorpay is told to stop billing at cycle end, not immediately), then access ends automatically
- **Dominion** — a genuine 3D strategy game (Premium): a real 19-territory hex map, WebGL rendering, tap-to-select/attack via raycasting, resource tiles that create a real "expand vs. develop" strategic choice
- **Territory Duel** — real 1v1 multiplayer (Premium), no AI: matchmaking finds you a live opponent, moves sync instantly via Supabase Realtime, and every move is validated server-side so neither player can cheat by tampering with their own client. Realtime is enabled for the `duels` table automatically by the migration — if live updates ever don't seem to arrive, double-check Supabase → Database → Replication shows `duels` as enabled.
- **Claim win on an inactive opponent** — if your Territory Duel opponent goes quiet mid-match, a "claim win" option appears after 60 seconds of silence on their turn, so no one's stuck waiting forever. Waiting-for-opponent searches can also be cancelled outright.
- **Grand Prix Duel** — live 1v1 multiplayer racing (Premium): a real opponent's car races alongside yours in real time, positions synced ~7x/second over Supabase Realtime's ephemeral Broadcast channels (no database writes for the live race itself, which is what keeps it fast)
- **Apex Circuit** — a genuine 3D racing game (Premium), built with real WebGL via Three.js: a 3D track, a chase camera, steering, and boost pads — not a 2D game with a 3D-sounding name
- **All game IP explicitly owned by Tap & Score** — stated in the site footer
- **Premium tier now has real depth** — the 4 most system-rich games (Colony Rush, Block Cascade, Platform Quest, Creature Clash) moved to the ₹100/month subscription, alongside Empire Command and Turbo Circuit — 6 deep games behind the paywall, not 2
- **👑 Premium badge** next to subscribers' names on every leaderboard — visible status, not just game access
- **Upgrade nudge** shown on free games to non-subscribers (hidden entirely for subscribers — this is what "ad-free" means here, rather than wiring up a third-party ad network)
- **Referral system** — every account gets a shareable invite link (`/account`); a friend signing up through it gives the referrer 30 days of free Premium access, stacking with multiple referrals, entirely independent of Razorpay billing
- **Share my rank** button on the leaderboard page — one tap opens the native share sheet (or copies to clipboard) with a ready-made brag message and link back to the site
- **Installable on phones** — visitors can "Add to Home Screen" (Android/iOS) and it opens full-screen like a real app, with its own icon, no browser address bar
- A bottom tab bar on mobile (Games / Ranks / Fame / Account) — the desktop version still uses the top nav bar
- Email/password accounts (Supabase Auth), with self-serve **forgot password / reset password**
- **Admin accounts** — play every game free, and manage users (add, delete, reset password) from `/admin`. The first admin is set directly in Supabase (see Step 2 above); admins can't be created through the app itself, on purpose
- A public landing page at `tapandscore.com` — visitors see a marketing page and must sign up or log in before touching any game, leaderboard, or score
- 23 games across Reflex, Puzzle, Word, Strategy, Arcade, Shooter, and Premium categories — including 2 Premium games (Empire Command, an original strategy game; Turbo Circuit, an original racing game) behind a monthly subscription, and 5 flagship Arcade games (Platform Quest, Creature Clash, Brick Blaster, Block Cascade, Maze Muncher — all original, none of them clones)
- A dedicated **Leaderboard** page (`/leaderboard`) with Top 10, 11th–50th, and 51st+ shown as separate tiers, filterable by game or overall, with country flags next to every name
- A **Hall of Fame** (`/hall-of-fame`) for players who've earned 1,000,000,000+ lifetime points across every game they've ever played — a genuine career milestone, not a single good round
- A **celebration** (confetti + fanfare) when a score submission pushes a player to #1 in that game or #1 overall
- **Account settings** (`/account`) so any user can set or change their username and country (shown on leaderboards) after signing up
- **Retro sound effects on every game** — synthesized on the fly (no audio files to host), with a persistent mute toggle that remembers your choice
- An **Exit** option always available mid-game, with a confirmation step so it can't be tapped by accident
- A **Most Popular** section on the dashboard, ranked by real player counts
- Personal best score tracking per game
- Public leaderboards, per-game and overall
- Three ways a game can be priced — free, a one-time purchase, or part of a monthly subscription tier — all editable from Supabase's Table Editor, no code involved
- A real paywall: payments are verified on the server using
  Razorpay's cryptographic signature, purchase/subscription records are
  only ever written by server code with a service-role key, and a
  webhook keeps subscription status accurate automatically as Razorpay
  charges (or fails to charge) the monthly mandate
- Basic SEO: page titles, meta description, OpenGraph/Twitter tags, JSON-LD structured data, `robots.txt`, and `sitemap.xml`

## Editing prices and games later (no code, no GitHub)

Two tables in Supabase's **Table Editor** control everything about
what's on the site and what it costs:

- **`games`** — one row per game. Edit `name`, `icon`, `tagline`, or `category` to change how it's presented. Set `access_type` to `free`, `onetime`, or `subscription`. For a one-time game, edit `price_paise` (in paise — ₹125 is 12500) and `price_display` (₹125). For a subscription game, set `subscription_plan_id` to which tier unlocks it. Set `is_active` to `false` to hide a game without deleting it.
- **`subscription_plans`** — one row per subscription tier (a `premium` tier at ₹100/month ships by default). Edit `price_display` to change what's shown on the site. To actually change the charged amount, create a new Plan in Razorpay at the new price (Plans can't be edited once created) and paste its ID into `razorpay_plan_id` — existing subscribers keep their old price until they resubscribe, which is standard practice for recurring billing.

Every edit takes effect immediately — no redeploy needed.

## Adding a brand new game later

Config lives in the database, but gameplay is still real code — a new
game needs one small file:

1. Add a row to the `games` table in Supabase (slug, name, icon, category, accent color, tagline, `component_key`, and pricing as above).
2. Create a component in `components/games/YourGame.js`. It receives exactly two props — `onFinish(score)` (call it once when the game ends) and `accentColor` — and renders whatever gameplay you want. Copy an existing simple one (like `MoleRush.js`) as a starting template.
3. Register it in `components/games/GameComponents.js` — one line, mapping the same `component_key` to your component. This is the one step that needs a GitHub upload and redeploy.

If you'd rather not build the gameplay yourself, come back and ask — I
can keep adding games into this same structure any time; you'd only
need to do the database row yourself if you want to tweak its pricing
afterward.
