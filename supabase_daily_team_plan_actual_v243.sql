-- AIS Tracker V2.43: Daily Team Plan vs Actual
-- Additive migration only. Existing history rows, stock values and other tables are preserved.

-- Team A/B/C plan values are stored separately from actual stock movement history.
-- One plan row represents one date + shift + team + profile + item + cut length.
CREATE TABLE IF NOT EXISTS public.daily_team_plans (
  id bigserial PRIMARY KEY,
  plan_date date NOT NULL,
  shift text NOT NULL CHECK (shift IN ('Day','Night')),
  team text NOT NULL CHECK (team IN ('Team A','Team B','Team C')),
  profile text NOT NULL,
  item_code text NOT NULL,
  length text NOT NULL,
  plan_cut_qty bigint NOT NULL DEFAULT 0 CHECK (plan_cut_qty >= 0),
  plan_punch_qty bigint NOT NULL DEFAULT 0 CHECK (plan_punch_qty >= 0),
  plan_wrap_qty bigint NOT NULL DEFAULT 0 CHECK (plan_wrap_qty >= 0),
  plan_box_qty bigint NOT NULL DEFAULT 0 CHECK (plan_box_qty >= 0),
  plan_crate_qty bigint NOT NULL DEFAULT 0 CHECK (plan_crate_qty >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT daily_team_plans_unique_line UNIQUE (plan_date, shift, team, profile, item_code, length)
);

CREATE INDEX IF NOT EXISTS daily_team_plans_date_team_idx
  ON public.daily_team_plans (plan_date, team, shift);

-- This application currently accesses its existing operational tables using the
-- Supabase publishable/anon client and its in-app role gate. Keep this new table's
-- grants consistent with that existing deployment model; review RLS before changing
-- the application's authentication architecture.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_team_plans TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.daily_team_plans_id_seq TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
