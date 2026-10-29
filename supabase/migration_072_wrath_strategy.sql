-- ============================================================
-- Migration: Wrath of Olympus becomes a real-time strategy game
-- (Age of Empires style: gather, build, climb the ages, fight Sparta).
-- The slug stays 'wrathofolympus' so scores and ownership keep working;
-- only the tagline changes. Run in the Supabase SQL Editor.
-- ============================================================
update public.games
set tagline = 'Lead Athens in a real-time strategy war — gather, build a city, climb three ages, raise an army and destroy Sparta. Laptop or desktop only.'
where slug = 'wrathofolympus';
-- ============================================================
