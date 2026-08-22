-- ============================================================
-- Migration: deepen the Premium tier + referral system + subscriber badges
-- Run this once in Supabase SQL Editor after migration_008.
-- ============================================================

-- ------------------------------------------------------------
-- Move the 4 deepest, most system-rich games into Premium.
-- These have real multi-system depth (economy management, physics,
-- rotation/line-clear logic, type-advantage battling) compared to the
-- quick reflex/puzzle games that stay free — a genuine value gap,
-- not just a price tag on an identical experience.
-- ------------------------------------------------------------
update public.games
set access_type = 'subscription', subscription_plan_id = 'premium', category = 'Premium', price_paise = null, price_display = null
where slug in ('colonyrush', 'blockcascade', 'platformquest', 'creatureclash');

-- ------------------------------------------------------------
-- Subscriber status, visible on the (already-public) profiles table,
-- so leaderboards can show a badge without needing to expose the
-- private subscriptions table to other users.
-- ------------------------------------------------------------
alter table public.profiles add column if not exists is_premium boolean not null default false;

-- ------------------------------------------------------------
-- Referral system. bonus_subscription_until acts as free Premium
-- access earned through referrals — checked alongside (not instead
-- of) a real Razorpay subscription, and entirely under this site's
-- own control, with no need to touch Razorpay's billing API.
-- ------------------------------------------------------------
alter table public.profiles add column if not exists referral_code text unique;
alter table public.profiles add column if not exists referred_by uuid references public.profiles(id);
alter table public.profiles add column if not exists bonus_subscription_until timestamptz;

-- Grants EXECUTE so the eventual admin/service routines can call this
-- if ever needed; the trigger below runs as security definer already.
create or replace function public.generate_referral_code()
returns text as $$
begin
  return substr(md5(random()::text || clock_timestamp()::text), 1, 8);
end;
$$ language plpgsql;

-- Extend the signup trigger: generate a referral code for every new
-- user, and if they signed up via someone else's referral link
-- (passed as 'referred_by_code' in signup metadata), credit that
-- referrer with 30 bonus days of Premium access — stacking if they
-- already have unused bonus time.
create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_code text;
  referrer_id uuid;
begin
  new_code := public.generate_referral_code();

  select id into referrer_id
  from public.profiles
  where referral_code = new.raw_user_meta_data->>'referred_by_code'
  limit 1;

  insert into public.profiles (id, username, country, referral_code, referred_by)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'country',
    new_code,
    referrer_id
  );

  if referrer_id is not null then
    update public.profiles
    set bonus_subscription_until = greatest(coalesce(bonus_subscription_until, now()), now()) + interval '30 days'
    where id = referrer_id;
  end if;

  return new;
end;
$$ language plpgsql security definer;
