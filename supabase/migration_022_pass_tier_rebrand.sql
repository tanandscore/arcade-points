-- ============================================================
-- Migration: rebrand the two subscription tiers with game-style
-- names instead of generic "Premium" / "Premium Plus", and drop the
-- flagship tier's price to ₹149/month. The internal plan ids
-- ('premium', 'premium_plus') are left unchanged on purpose — they're
-- never shown to users, only referenced internally in code and the
-- database, so changing them would be a much larger, riskier
-- refactor for zero user-visible benefit. Only the displayed name,
-- price, and the games' category field (which IS shown as section
-- headers) change here.
-- Run this once in Supabase SQL Editor after migration_020.
-- ============================================================

update public.subscription_plans set name = 'Power Pass' where id = 'premium';
update public.subscription_plans set name = 'Legend Pass', price_paise = 14900, price_display = '₹149' where id = 'premium_plus';

update public.games set category = 'Power Pass' where category = 'Premium';
update public.games set category = 'Legend Pass' where category = 'Premium Plus';

-- If you already created a ₹199/month Plan in the Razorpay dashboard
-- for the old Premium Plus pricing, you'll need to create a new
-- ₹149/month Plan there (Razorpay plans can't be edited after
-- creation) and update it here:
-- update public.subscription_plans set razorpay_plan_id = 'plan_xxxxx' where id = 'premium_plus';
