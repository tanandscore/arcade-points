-- ============================================================
-- Migration: real Paddle product/price IDs for Power Pass and
-- Legend Pass, and a schema fix this needs first.
--
-- migration_066 added a single paddle_price_id column, matching the
-- single-price-per-plan shape razorpay_plan_id already used — that
-- was correct at the time, since Paddle wasn't yet offering monthly
-- AND annual billing. Now that both exist, a single column can't
-- hold both, so it's replaced here with two columns before being
-- populated with the real sandbox IDs you created by hand.
-- Run this once in Supabase SQL Editor after migration_066.
-- ============================================================

alter table public.subscription_plans drop column if exists paddle_price_id;
alter table public.subscription_plans add column if not exists paddle_price_id_monthly text;
alter table public.subscription_plans add column if not exists paddle_price_id_annual text;
-- The product ID isn't used by the checkout flow (Paddle.Checkout.open
-- takes a price ID, not a product ID), but kept for reference/debugging
-- — e.g. to look the product up directly in the Paddle dashboard.
alter table public.subscription_plans add column if not exists paddle_product_id text;
-- Separate from the existing price_display (which is INR, for the
-- PayU flow) — Paddle prices customers in USD as the base currency,
-- so this needs its own display strings rather than reusing that
-- column, matching this table's own "no code changes for a price
-- change" pattern instead of hardcoding these into a component.
alter table public.subscription_plans add column if not exists paddle_price_display_monthly text;
alter table public.subscription_plans add column if not exists paddle_price_display_annual text;

-- Real values from your Paddle sandbox account, matching this
-- table's actual plan ids ('premium' = Power Pass, 'premium_plus' =
-- Legend Pass — renamed by migration_022, not literal id strings).
update public.subscription_plans set
  paddle_product_id = 'pro_01m23dh4b3vhyxqn5tfk5w1rz9',
  paddle_price_id_monthly = 'pri_01m23dwyhn7d5jzfgdxje0rq4x',
  paddle_price_id_annual = 'pri_01m23ecqdzcz9exy1abnr8rw4r',
  paddle_price_display_monthly = '$5',
  paddle_price_display_annual = '$60'
where id = 'premium';

update public.subscription_plans set
  paddle_product_id = 'pro_01m23g6hh73x5xjf1j7vt3rxn8',
  paddle_price_id_monthly = 'pri_01m23gdyns26ry043t2571yebc',
  paddle_price_id_annual = 'pri_01m23gm7pjnyw1hb8n6qg7vb3c',
  paddle_price_display_monthly = '$8',
  paddle_price_display_annual = '$96'
where id = 'premium_plus';
