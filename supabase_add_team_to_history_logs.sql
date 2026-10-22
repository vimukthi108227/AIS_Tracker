-- AIS Tracker: additive, data-preserving change for monthly Team A/B/C production chart.
-- Run once in Supabase SQL Editor before deploying the updated website.
-- Existing rows are preserved; their team stays NULL until assigned manually (if desired).
ALTER TABLE public.history_logs
ADD COLUMN IF NOT EXISTS team text;
