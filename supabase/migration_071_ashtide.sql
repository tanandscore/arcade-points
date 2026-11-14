-- ============================================================
-- Migration: Kingdoms of Ash becomes "Ashtide" — a cozy,
-- Townscaper-style harbour-town builder (3D, laptop/desktop only).
-- The slug stays 'kingdomsofash' so saved scores, ownership and
-- links keep working; only the name, icon and tagline change.
-- Run in the Supabase SQL Editor.
-- ============================================================
update public.games
set name = 'Ashtide',
    icon = '🏘️',
    tagline = 'A cozy harbour-town builder — click the sea to raise colourful houses, towers and gardens. No timer, no enemies.'
where slug = 'kingdomsofash';
