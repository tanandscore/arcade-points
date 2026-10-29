-- ============================================================
-- Migration 088 (Upgrade 70): the new store.
--   1. Cloud saves for the new 2D games (table game_saves).
--   2. The old arcade / reflex games and the 14 extra Legend Pass games are switched OFF (nothing is deleted: every old score stays
--      in the database, and a game can be switched back on by setting is_active = true).
--   3. Stage 1 of the new games is added: Kiko Leap and Fluffapult (Free), Skyline Siege (Power Pass).
--   4. The four flagships are tidied (still Legend Pass).
--   5. The three "play every game in a tier" achievements get their new wording.
-- Paste ALL of this into Supabase > SQL Editor and click Run. It is safe to run again.
-- (The website already shows the new games and hides the old ones without this SQL; running it just keeps the database in agreement
--  and switches cloud saves on.)
-- ============================================================

-- 1. Cloud saves --------------------------------------------------------------------------------------------------------------
create table if not exists public.game_saves (
  user_id uuid not null references auth.users(id) on delete cascade,
  game text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, game)
);
alter table public.game_saves enable row level security;
drop policy if exists "game_saves own select" on public.game_saves;
drop policy if exists "game_saves own insert" on public.game_saves;
drop policy if exists "game_saves own update" on public.game_saves;
create policy "game_saves own select" on public.game_saves for select using (auth.uid() = user_id);
create policy "game_saves own insert" on public.game_saves for insert with check (auth.uid() = user_id);
create policy "game_saves own update" on public.game_saves for update using (auth.uid() = user_id);

-- 2. Switch the old games off -------------------------------------------------------------------------------------------------
update public.games
set is_active = false
where slug not in (
  'midnightburn', 'operationblacksite', 'kingdomsofash', 'wrathofolympus',
  'skylinesiege', 'kikoleap', 'fluffapult'
);

-- 3. Stage 1 of the new games -------------------------------------------------------------------------------------------------
insert into public.games (slug, name, icon, category, accent_color, tagline, component_key, access_type, subscription_plan_id, price_paise, price_display, sort_order, is_active)
values
  ('kikoleap',    'Kiko Leap',    '🫧', 'Platformer', '#3ee6e0', 'A bouncy platform adventure across four worlds. Stomp, float and smash your way to the flag!', 'kikoleap',    'free',         null,      null, null, 20, true),
  ('fluffapult',  'Fluffapult',   '🐤', 'Physics',    '#ff3ea5', 'Launch the Fluffs, topple the wobbly forts and pop every Sprocket!',                                    'fluffapult',  'free',         null,      null, null, 21, true),
  ('skylinesiege','Skyline Siege','🔫', 'Action',     '#ff8a1f', 'Port Meridian is under siege. Run, gun and blast through sixteen missions and four towering bosses.',   'skylinesiege','subscription', 'premium', null, null, 10, true)
on conflict (slug) do update set
  name = excluded.name, icon = excluded.icon, category = excluded.category, accent_color = excluded.accent_color,
  tagline = excluded.tagline, component_key = excluded.component_key, access_type = excluded.access_type,
  subscription_plan_id = excluded.subscription_plan_id, sort_order = excluded.sort_order, is_active = excluded.is_active;

-- 4. The four flagships stay Legend Pass ----------------------------------------------------------------------------------------
update public.games
set category = 'Legend Pass', access_type = 'subscription', subscription_plan_id = 'premium_plus', price_paise = null, price_display = null, is_active = true
where slug in ('midnightburn', 'operationblacksite', 'kingdomsofash', 'wrathofolympus');

-- 5. Achievement wording (the store now has about 20 games, so 25 different games is no longer possible) ------------------------------------------------------------------------------------------------------
update public.achievements set name = 'Regular',            description = 'Play 15 different games.'              where id = 'arcade_regular';
update public.achievements set name = 'Every Free Game',  description = 'Play every Free game.'                where id = 'every_arcade_game';
update public.achievements set name = 'Legend''s Path',     description = 'Play all four Legend Pass flagship games.' where id = 'legends_path';
update public.achievements set name = 'Power Player',       description = 'Play every Power Pass game.'            where id = 'power_player';

-- Quick check — should list the 4 flagships + the 3 new games, all active:
--   select slug, category, access_type, subscription_plan_id, is_active from public.games where is_active order by sort_order;
