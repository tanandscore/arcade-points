-- ============================================================
-- Migration: PayU payment integration — schema additions.
--
-- 1. Phone number: PayU's Collect Payment API requires a phone field
--    on every transaction request. This site has never collected one
--    (only username, email, country, password at signup) — rather
--    than silently submit a fake placeholder number on every
--    transaction (which risks PayU's fraud/OTP systems flagging or
--    rejecting real payments), this adds a real nullable column,
--    collected once at first checkout and reused after that.
--
-- 2. PayU transaction reference: subscriptions previously only had a
--    razorpay_subscription_id column. PayU's equivalent reference is
--    a txnid, a genuinely different kind of identifier, not a rename.
-- Run this once in Supabase SQL Editor after migration_050.
-- ============================================================

alter table public.profiles add column if not exists phone text;

-- The subscriptions table only had a razorpay_subscription_id column
-- (see migration_002/migration_003) — PayU's equivalent reference is
-- a txnid, not a subscription object id, so this is a genuinely
-- different identifier, not a rename.
alter table public.subscriptions add column if not exists payu_txnid text;

-- PayU's own transaction reference (mihpayid, returned in the
-- success callback) — distinct from payu_txnid (our own generated
-- id) and needed for any future mandate-cancellation API call.
-- Stored now, not yet used for anything — see the honesty note in
-- app/api/payu/cancel-subscription/route.js.
alter table public.subscriptions add column if not exists payu_mihpayid text;
