-- ============================================================
-- Seed: First changelog entries.
--
-- Not a schema migration — this is real content, ready to run once
-- in the Supabase SQL Editor after migration_062, so the changelog
-- isn't empty the first time a player opens it. Every entry here
-- describes work that was actually built and verified this session,
-- written the way a player would want to hear about it, not
-- internal dev language. Feel free to edit the text before running,
-- or just add more later from /admin/changelog — this is a starting
-- point, not something that needs to be run exactly as-is.
--
-- published_at values are staggered a few minutes apart, oldest
-- first, so they read in a sensible order (most recent at the top
-- of the page, since the changelog sorts newest-first).
-- ============================================================

insert into public.changelog_entries (title, body, game_slug, published_at) values
(
  'Wrath of Olympus is playable again',
  'Tracked down and fixed the crash that was stopping the game from loading for everyone. Sorry for the wait — it''s working now.',
  'wrathofolympus',
  now() - interval '30 minutes'
),
(
  'Six enemy types instead of three',
  'Satyr, Centaur, and Gorgon join the fight — a fast, fragile swarm unit, a mid-game threat, and a genuine glass cannon. The full roster now spans every stage of a run, not just the first two waves.',
  'wrathofolympus',
  now() - interval '25 minutes'
),
(
  'Two maps to choose from',
  'Verdant Vale (the original) and Emberfall Coast, a genuinely different layout — water on the opposite side, every landmark repositioned. Pick one when you found your kingdom.',
  'kingdomsofash',
  now() - interval '20 minutes'
),
(
  'Villagers finally have real personalities',
  'Every villager is now born with a real trait — Green Thumb, Woodwise, Stonecutter, Golden Touch, Diligent, or Swift — that actually changes how they work. Hover over any villager to see theirs.',
  'kingdomsofash',
  now() - interval '15 minutes'
),
(
  'Trade caravans got a real upgrade',
  'Three different deals instead of always the same one, including a reverse trade for when you''re gold-rich but resource-poor. The more you trade, the better rate the merchants offer you.',
  'kingdomsofash',
  now() - interval '10 minutes'
),
(
  'Your squad has names now',
  'Both AI teammates carry real, different weapons — one SMG, one rifle — and deal damage based on what they''re actually holding, instead of being identical clones of each other.',
  'operationblacksite',
  now() - interval '5 minutes'
),
(
  'A real breakdown after every match',
  'See who actually carried the game — kills, headshots, plants, and defuses for you and your squad, plus a real MVP callout, right after the match ends.',
  'operationblacksite',
  now() - interval '2 minutes'
),
(
  'Streak reminders and a real changelog',
  'You''ll now get a reminder email if your streak is about to break — turn it off anytime from your account page. And this page is new too: real updates, as they ship, instead of finding out by accident.',
  null,
  now()
);
