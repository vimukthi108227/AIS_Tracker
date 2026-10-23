AIS Tracker — Production Save Error Fix

Why the error happens
The screenshot says Supabase cannot find the `team` column in `public.history_logs` schema cache. The current app writes the selected Production Team to this column, so the history insert is rejected. The app then rolls back stock updates to avoid inconsistent data.

Permanent fix (required if the table has no Team column)
1. Open Supabase Dashboard → SQL Editor.
2. Open/copy `supabase_add_team_to_history_logs.sql` from this ZIP and run it once.
3. It adds `public.history_logs.team` only if missing, then requests a PostgREST schema-cache reload. Existing rows are not deleted or rewritten.
4. Wait a few seconds, reload the website with Ctrl+F5, and save one small valid production entry.
5. Confirm the entry appears in Production History before entering further records.

Compatibility
The website now tries `production_team` only when Supabase specifically reports that `team` is missing. It does not retry arbitrary failures. If neither column exists, it shows a clear migration message and stock/cardboard changes are rolled back rather than leaving inventory changed without a history row.

Safety
- No database migration is run automatically by the website.
- No existing production history is deleted or rewritten.
- Static JavaScript syntax and ZIP integrity checks were run.
- Live Supabase behavior still needs to be verified by running the SQL and testing one entry.
