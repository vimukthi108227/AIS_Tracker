-- AIS Tracker: safe, additive migration for Team A/B/C production tracking.
-- Run this in Supabase SQL Editor ONCE if public.history_logs has no `team` column.
-- Existing rows are preserved; old rows remain NULL/unassigned.
ALTER TABLE public.history_logs
ADD COLUMN IF NOT EXISTS team text;

-- Ask PostgREST/Supabase to refresh its schema cache so inserts see the new column.
NOTIFY pgrst, 'reload schema';
