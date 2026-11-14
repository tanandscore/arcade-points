-- ============================================================
-- Migration: self-service subscription cancellation
-- Run this once in Supabase SQL Editor after migration_012.
-- ============================================================

-- When a user cancels, we set this flag immediately but leave
-- status = 'active' — access continues until current_period_end,
-- matching what they already paid for. Razorpay itself completes the
-- actual cancellation at the end of the billing cycle and fires a
-- webhook at that point, which flips status to 'cancelled'.
alter table public.subscriptions add column if not exists cancel_at_period_end boolean not null default false;
