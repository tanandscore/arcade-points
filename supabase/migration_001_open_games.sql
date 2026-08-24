-- ============================================================
-- Migration: open up scores.game to support any number of games
-- Run this once in Supabase SQL Editor if your database already
-- exists (i.e. you ran the original schema.sql before this change).
-- Safe to run even if the constraint doesn't exist.
-- ============================================================

alter table public.scores drop constraint if exists scores_game_check;
