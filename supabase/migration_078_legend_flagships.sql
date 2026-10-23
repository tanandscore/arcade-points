-- ============================================================
-- Migration: make sure the four flagship games are Legend Pass games.
--   Midnight Burn (Mumbai Drift), Operation Blacksite, Ashtide (Kingdoms of Ash), Wrath of Olympus.
-- Each one needs the Legend Pass tier (plan 'premium_plus'), is never free, and sits in the 'Legend Pass' group.
-- (The website also enforces this in code, so this just keeps the database tidy and in agreement.)
-- Safe to run more than once. Run once in the Supabase SQL Editor after migration_077.
-- ============================================================
update public.games
set category = 'Legend Pass',
    access_type = 'subscription',
    subscription_plan_id = 'premium_plus',
    price_paise = null,
    price_display = null
where slug in ('midnightburn', 'operationblacksite', 'kingdomsofash', 'wrathofolympus');

-- Legend Pass games are laptop/desktop only; the free Mumbai Street Racer stays free.
-- Quick check (should list exactly these four, all subscription / premium_plus):
--   select slug, category, access_type, subscription_plan_id from public.games where slug in ('midnightburn','operationblacksite','kingdomsofash','wrathofolympus');
