-- Migration 084: takes the free "Mumbai Street Racer" game off the site (it disappears from the game list and its page stops opening).
-- Nothing is deleted, so scores are kept and it can be put back any time by running the "put it back" line at the bottom.
-- Paste ALL of this into Supabase > SQL Editor and click Run. Safe to run again.
update public.games set is_active = false where slug = 'mumbaistreetracer';

-- Check: should show is_active = false
select slug, name, is_active from public.games where slug = 'mumbaistreetracer';

-- To put it back later, run this one line by itself:
-- update public.games set is_active = true where slug = 'mumbaistreetracer';
