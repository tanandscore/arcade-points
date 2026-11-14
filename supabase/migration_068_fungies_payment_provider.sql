-- ============================================================
-- Migration: Fungies as the site's new Merchant of Record, replacing
-- Paddle (which gave a final rejection on appeal) the same way Paddle
-- itself replaced PayU and Razorpay earlier. Additive, not
-- destructive — the paddle_* columns and historical rows from
-- migration_066/067 are left exactly as they are, so any still-active
-- Paddle subscription keeps working until it naturally lapses or is
-- cancelled; only new subscriptions go through Fungies from here on.
-- Run this once in Supabase SQL Editor after migration_067.
-- ============================================================

-- Allow "fungies" alongside the existing provider values. Postgres
-- can't alter a check constraint directly, so the old one is dropped
-- and replaced, same approach migration_066 used for the status
-- constraint.
alter table public.subscriptions drop constraint if exists subscriptions_provider_check;
alter table public.subscriptions add constraint subscriptions_provider_check
  check (provider in ('razorpay', 'payu', 'paddle', 'fungies'));

-- Fungies' own identifiers for a subscription and its customer —
-- mirrors paddle_subscription_id/paddle_customer_id exactly. Nullable,
-- since only rows created through Fungies will have these.
alter table public.subscriptions add column if not exists fungies_subscription_id text unique;
alter table public.subscriptions add column if not exists fungies_customer_id text;

-- Speeds up the webhook handler's lookup from a Fungies subscription
-- ID back to the row to update (subscription_updated/cancelled events
-- carry only the subscription id, not our user_id).
create index if not exists idx_subscriptions_fungies_subscription_id
  on public.subscriptions (fungies_subscription_id) where fungies_subscription_id is not null;

-- Per-plan, per-billing-period Fungies checkout element URLs. Unlike
-- Paddle's bare price ID (a short string the frontend hands to
-- Paddle.js), Fungies' documented checkout pattern needs the FULL
-- checkout URL from the dashboard (Store Builder -> the product's
-- checkout link) embedded as a data-fungies-checkout-url attribute —
-- so the whole URL is stored here rather than an ID assembled into
-- one at render time. Same "no code, no deploy" editing pattern
-- already used for every other provider's price fields.
alter table public.subscription_plans add column if not exists fungies_checkout_url_monthly text;
alter table public.subscription_plans add column if not exists fungies_checkout_url_annual text;

-- Fungies prices in USD by default, same reasoning as
-- paddle_price_display_monthly/annual — kept separate from the
-- existing INR price_display column.
alter table public.subscription_plans add column if not exists fungies_price_display_monthly text;
alter table public.subscription_plans add column if not exists fungies_price_display_annual text;

-- Fill these in once you've set up the two products/checkout links in
-- the Fungies dashboard (Store Builder -> Products), one per tier,
-- each with monthly and annual checkout links, and a "user_id" +
-- "plan_id" Custom Field added to each product (Products -> the
-- product -> Custom Fields) so the webhook can link a purchase back
-- to the right account — see the README note added alongside this
-- migration for the full one-time dashboard setup.
--
-- update public.subscription_plans set
--   fungies_checkout_url_monthly = 'https://your-store.app.fungies.io/checkout-element/XXXXX',
--   fungies_checkout_url_annual = 'https://your-store.app.fungies.io/checkout-element/YYYYY',
--   fungies_price_display_monthly = '$5',
--   fungies_price_display_annual = '$60'
-- where id = 'premium';
--
-- update public.subscription_plans set
--   fungies_checkout_url_monthly = 'https://your-store.app.fungies.io/checkout-element/ZZZZZ',
--   fungies_checkout_url_annual = 'https://your-store.app.fungies.io/checkout-element/WWWWW',
--   fungies_price_display_monthly = '$8',
--   fungies_price_display_annual = '$96'
-- where id = 'premium_plus';
