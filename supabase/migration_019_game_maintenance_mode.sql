-- ============================================================
-- Migration: per-game maintenance mode. Distinct from is_active
-- (which removes a game from the site entirely) — this keeps a game
-- visible and its URL working, but shows a friendly "engine updating"
-- message instead of loading the game itself. Use this while pushing
-- a risky update to one specific game, so existing users never see a
-- broken page or 404, only a clear, calm status message.
-- Run this once in Supabase SQL Editor after migration_018.
-- ============================================================

alter table public.games add column if not exists under_maintenance boolean not null default false;

-- To take a single game down for an update, in the Supabase table
-- editor (or via SQL): update public.games set under_maintenance =
-- true where slug = 'your-game-slug'; — then set it back to false the
-- moment the new version is deployed and confirmed working.
