-- ============================================================
-- Migration: Subscriber perk bundle.
--
-- Merges six things into one real, working set of subscriber-only
-- benefits, not just a marketing label:
--
-- - Animated avatars & Exclusive cosmetics: profiles.avatar_id and
--   profiles.cosmetic_badge, both nullable text referencing a fixed
--   catalog defined in lib/cosmetics.js (not a free-text field — kept
--   to a known set so display code never has to handle garbage).
-- - Premium themes: profiles.theme_id, same pattern, catalog in
--   lib/themes.js.
-- - VIP profiles: no new column needed — computed from subscription
--   status directly at render time in app/players/[username]/page.js,
--   since "is this user currently a subscriber" already has a single
--   source of truth (lib/access.js) and a stored flag would just be
--   one more thing to keep in sync.
-- - Tournament access: no new column either — enforced in
--   app/api/difficulty-scores/route.js at the point tournament scores
--   are written, using that same subscription check.
-- - Achievements: already exist and are already effectively
--   subscriber-gated wherever they're tied to a subscription-tier
--   game, since you can't earn them without playing that game in the
--   first place. Nothing new to add to the schema for this one.
--
-- Run this once in Supabase SQL Editor after migration_056.
-- ============================================================

alter table public.profiles add column if not exists avatar_id text;
alter table public.profiles add column if not exists theme_id text;
alter table public.profiles add column if not exists cosmetic_badge text;
