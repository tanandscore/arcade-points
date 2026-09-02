-- ============================================================
-- Migration: allow multiple concurrent subscriptions per user.
--
-- The subscriptions table previously had user_id alone as its
-- primary key — meaning a user could only ever hold ONE subscription
-- across the whole site. That's why Premium Plus couldn't show up as
-- an independent option on the account page: the schema itself only
-- had room for a single active plan per user. This changes the
-- primary key to (user_id, plan_id), so a user can hold Premium and
-- Premium Plus as two completely separate subscriptions.
-- Run this once in Supabase SQL Editor after migration_019.
-- ============================================================

-- Backfill any legacy rows from before Premium Plus existed, where
-- plan_id may never have been set explicitly.
update public.subscriptions set plan_id = 'premium' where plan_id is null;

alter table public.subscriptions alter column plan_id set not null;

alter table public.subscriptions drop constraint if exists subscriptions_pkey;
alter table public.subscriptions add primary key (user_id, plan_id);
