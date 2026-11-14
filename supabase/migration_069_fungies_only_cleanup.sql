-- ============================================================
-- Migration: make Fungies the ONLY payment provider in the database.
-- Razorpay, PayU and Paddle were all tried and none approved this
-- site; there are no active subscribers on any of them, so their
-- leftover columns, constraints and test data are removed here
-- instead of being kept around "just in case".
-- Run once in Supabase SQL Editor after migration_068.
--
-- DESTRUCTIVE: drops columns and deletes any non-Fungies
-- subscription rows. Safe only because there are no real paying
-- users on the old providers — don't run this if that ever changes.
-- ============================================================

-- Any leftover test rows from the old providers (never real customers).
delete from public.subscriptions where provider is distinct from 'fungies';

-- Old-provider columns on subscriptions.
alter table public.subscriptions drop column if exists razorpay_subscription_id;
alter table public.subscriptions drop column if exists payu_txnid;
alter table public.subscriptions drop column if exists payu_mihpayid;
drop index if exists public.idx_subscriptions_paddle_subscription_id;
alter table public.subscriptions drop column if exists paddle_subscription_id;
alter table public.subscriptions drop column if exists paddle_customer_id;

-- provider can now only ever be 'fungies'.
alter table public.subscriptions drop constraint if exists subscriptions_provider_check;
alter table public.subscriptions add constraint subscriptions_provider_check check (provider = 'fungies');
alter table public.subscriptions alter column provider set default 'fungies';

-- Fungies' statuses can include "incomplete" mapped to past_due by the
-- webhook; the existing status check from migration_066 already allows
-- active / past_due / cancelled / trialing / paused.

-- Old-provider columns on subscription_plans and games.
alter table public.subscription_plans drop column if exists razorpay_plan_id;
alter table public.subscription_plans drop column if exists paddle_product_id;
alter table public.subscription_plans drop column if exists paddle_price_id_monthly;
alter table public.subscription_plans drop column if exists paddle_price_id_annual;
alter table public.subscription_plans drop column if exists paddle_price_display_monthly;
alter table public.subscription_plans drop column if exists paddle_price_display_annual;
alter table public.subscription_plans drop column if exists paddle_price_id;
alter table public.games drop column if exists paddle_price_id;

-- PayU-only phone number column (PayU required one per transaction;
-- Fungies collects what it needs itself). Nothing in the app reads it.
alter table public.profiles drop column if exists phone;
