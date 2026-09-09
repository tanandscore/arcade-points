-- ============================================================
-- Migration: editable subscription plans + per-game plan linking
-- Run this once in Supabase SQL Editor after migration_002.
-- ============================================================

-- ------------------------------------------------------------
-- Subscription tiers. Each row is one monthly plan. To change a
-- subscription's price in the future:
--   1. In Razorpay: Subscriptions -> Plans -> create a NEW plan at
--      the new price (Razorpay plans can't change price once made).
--   2. In this table: edit the matching row's razorpay_plan_id to
--      the new plan's ID, and price_display to match.
-- No code, no GitHub upload, no deploy — just two field edits.
-- ------------------------------------------------------------
create table public.subscription_plans (
  id text primary key,
  name text not null,
  price_paise integer not null,
  price_display text not null,
  razorpay_plan_id text,
  is_active boolean not null default true
);

alter table public.subscription_plans enable row level security;

create policy "subscription plans are viewable by everyone"
  on public.subscription_plans for select using (true);

-- Starter "Premium" tier at ₹100/month. razorpay_plan_id starts NULL —
-- fill it in once you've created the matching Plan in Razorpay's
-- dashboard (Subscriptions -> Plans). Until then, subscribing to a
-- game on this tier will show a friendly "not set up yet" message
-- instead of erroring.
insert into public.subscription_plans (id, name, price_paise, price_display, razorpay_plan_id, is_active)
values ('premium', 'Premium Pass', 10000, '₹100', null, true)
on conflict (id) do update set
  name = excluded.name,
  price_paise = excluded.price_paise,
  price_display = excluded.price_display;

-- ------------------------------------------------------------
-- Link games to a specific subscription tier. A game with
-- access_type = 'subscription' only unlocks for users subscribed to
-- THIS tier — not just any active subscription. This matters once
-- you have more than one tier (e.g. a higher "Elite" tier later).
-- ------------------------------------------------------------
alter table public.games add column if not exists subscription_plan_id text references public.subscription_plans(id);

update public.games set subscription_plan_id = 'premium' where access_type = 'subscription';

-- ------------------------------------------------------------
-- A user's subscription now also records WHICH tier they're on.
-- ------------------------------------------------------------
alter table public.subscriptions add column if not exists plan_id text references public.subscription_plans(id);
