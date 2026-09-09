-- ============================================================
-- Migration: the achievement system's data layer. Three new,
-- additive tables — nothing here touches scores, difficulty_scores,
-- purchases, subscriptions, duels, or profiles. Achievement criteria
-- are evaluated against those existing tables at read/write time
-- (see lib/achievements.js), not duplicated here.
--
-- achievements       — static definitions (16 to start), publicly
--                       readable so completion % and artwork can be
--                       shown even for achievements a viewer hasn't
--                       earned.
-- user_achievements  — per-user unlocks. Writes happen server-side
--                       from the user's own session (same pattern as
--                       difficulty_scores), reads are restricted to
--                       the owning user.
-- activity_days      — one row per user per real calendar day they
--                       submitted a score. This is what makes
--                       "played 7 days in a row" honest and
--                       evaluable — scores.updated_at alone can't
--                       answer that, since it only changes on a new
--                       personal best.
-- Run this once in Supabase SQL Editor after migration_039.
-- ============================================================

create table if not exists public.achievements (
  id text primary key,
  name text not null,
  description text not null,
  icon text not null,
  tier text not null, -- bronze | silver | gold | legendary
  xp_value int not null default 0,
  sort_order int not null default 0
);

alter table public.achievements enable row level security;

create policy "Anyone can view achievement definitions" on public.achievements
  for select using (true);

create table if not exists public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  achievement_id text not null references public.achievements(id) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.user_achievements enable row level security;

create policy "Users can view own achievements" on public.user_achievements
  for select using (auth.uid() = user_id);

create policy "Users can insert own achievements" on public.user_achievements
  for insert with check (auth.uid() = user_id);

create table if not exists public.activity_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  primary key (user_id, activity_date)
);

alter table public.activity_days enable row level security;

create policy "Users can view own activity days" on public.activity_days
  for select using (auth.uid() = user_id);

create policy "Users can insert own activity days" on public.activity_days
  for insert with check (auth.uid() = user_id);

insert into public.achievements (id, name, description, icon, tier, xp_value, sort_order) values
  ('first_steps', 'First Steps', 'Submit a score in any game.', '🎮', 'bronze', 10, 10),
  ('ten_games', 'Ten in a Row', 'Play 10 different games.', '🕹️', 'bronze', 25, 20),
  ('arcade_regular', 'Arcade Regular', 'Play 25 different games.', '🎯', 'silver', 50, 30),
  ('every_arcade_game', 'Every Arcade Game', 'Play every game in the Arcade category.', '🏆', 'gold', 150, 40),
  ('legends_path', 'Legend''s Path', 'Play every game in Legend Pass.', '👑', 'gold', 200, 50),
  ('power_player', 'Power Player', 'Play every game in Power Pass.', '⚡', 'gold', 200, 60),
  ('rising_star', 'Rising Star', 'Reach 10,000 lifetime points.', '⭐', 'bronze', 25, 70),
  ('six_figures', 'Six Figures', 'Reach 100,000 lifetime points.', '💰', 'silver', 75, 80),
  ('seven_figures', 'Seven Figures', 'Reach 1,000,000 lifetime points.', '💎', 'gold', 150, 90),
  ('hall_of_fame', 'Legend of the Boards', 'Reach the Hall of Fame.', '🏛️', 'legendary', 500, 100),
  ('first_duel_won', 'First Blood', 'Win your first duel.', '⚔️', 'bronze', 20, 110),
  ('duelist', 'Duelist', 'Win 10 duels.', '🗡️', 'silver', 60, 120),
  ('duel_master', 'Duel Master', 'Win 50 duels.', '🛡️', 'gold', 150, 130),
  ('on_a_roll', 'On a Roll', 'Play on 3 consecutive days.', '🔥', 'bronze', 30, 140),
  ('devoted', 'Devoted', 'Play on 30 consecutive days.', '🌙', 'gold', 250, 150),
  ('difficulty_seeker', 'Difficulty Seeker', 'Try a difficulty-tiered game at any level.', '🎖️', 'silver', 60, 160)
on conflict (id) do update set
  name = excluded.name, description = excluded.description, icon = excluded.icon,
  tier = excluded.tier, xp_value = excluded.xp_value, sort_order = excluded.sort_order;
