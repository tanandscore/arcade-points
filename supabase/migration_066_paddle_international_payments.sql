-- ============================================================
-- Migration: Paddle as a second payment provider, for
-- international subscribers, alongside the existing Razorpay/PayU
-- integration (kept in place for domestic users — this is additive,
-- not a replacement).
--
-- Paddle is a Merchant of Record: it is the legal seller to your
-- customer, handles global tax (VAT/GST/sales tax) itself, and pays
-- you net revenue. That's why this only needs a subscription ID and
-- customer ID to track state — no separate tax fields are needed
-- here the way they would be with a plain processor.
-- Run this once in Supabase SQL Editor after migration_065.
-- ============================================================

-- The provider a given subscription row was created through. Existing
-- rows are backfilled based on which provider-specific column is
-- actually populated (payu_txnid vs razorpay_subscription_id), not a
-- single blanket default — the active checkout flow uses PayU (see
-- SubscribeButton.js), so most existing rows are PayU's, not
-- Razorpay's, and a flat default would have mislabeled them.
alter table public.subscriptions add column if not exists provider text check (provider in ('razorpay', 'payu', 'paddle'));
update public.subscriptions set provider = 'payu' where provider is null and payu_txnid is not null;
update public.subscriptions set provider = 'razorpay' where provider is null and razorpay_subscription_id is not null;
-- Any remaining untyped legacy rows (neither id populated) default to
-- razorpay, matching the schema's original assumption before this
-- migration, since that's what the column was implicitly for.
update public.subscriptions set provider = 'razorpay' where provider is null;
alter table public.subscriptions alter column provider set not null;

-- Paddle's own identifiers for a subscription and its customer.
-- Nullable, since only rows created through Paddle will have these —
-- exactly mirroring how razorpay_subscription_id already works for
-- Razorpay-created rows.
alter table public.subscriptions add column if not exists paddle_subscription_id text unique;
alter table public.subscriptions add column if not exists paddle_customer_id text;

-- The Paddle Price ID for each tier — set this in the Supabase Table
-- Editor once you've created the matching Price in the Paddle
-- dashboard (Catalog -> Prices), the same "no code, no deploy" editing
-- pattern already used for razorpay_plan_id.
alter table public.subscription_plans add column if not exists paddle_price_id text;

-- The Paddle Price ID for one-time ("day pass" style, or any
-- access_type = 'onetime') purchases — same editing pattern.
alter table public.games add column if not exists paddle_price_id text;

-- Speeds up the webhook handler's lookup from a Paddle subscription
-- ID back to the row to update.
create index if not exists idx_subscriptions_paddle_subscription_id on public.subscriptions (paddle_subscription_id) where paddle_subscription_id is not null;

-- Paddle's subscription statuses include trialing and paused, which
-- this table's original check constraint (active/past_due/cancelled)
-- has no room for — an unhandled webhook event hitting that
-- constraint would fail the whole upsert silently. Postgres can't
-- alter a check constraint directly, so the old one is dropped and
-- replaced. Kept the app's existing British "cancelled" spelling
-- (not Paddle's American "canceled") for consistency with the
-- existing frontend copy — the webhook handler normalizes Paddle's
-- spelling to match when writing this column.
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check check (status in ('active', 'past_due', 'cancelled', 'trialing', 'paused'));

