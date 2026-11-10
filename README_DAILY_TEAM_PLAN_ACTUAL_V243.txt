AIS Tracker V2.43 – Daily Team Plan vs Actual Production
=======================================================

What was added
--------------
- A new Production submenu: Team Plan vs Actual.
- Daily Production Entry now accepts plan PCS for Cut, Punch, Wrapping, Box and Crate
  alongside the existing actual stage entry fields. Box plan is entered in PCS; actual
  Box entry remains in boxes and is converted to PCS using the selected Master Catalog
  Pcs/Box capacity.
- Plan data is stored separately in `daily_team_plans`, keyed by date, shift, team,
  profile, item code and length. Re-entering the same key updates only that plan line.
- Existing `history_logs` structure is not changed. Actual weights use a unique
  profile + length Master Catalog match; ambiguous matches are excluded safely.
- Daily / monthly report filters, Team A/B/C cards, stage-wise plan vs actual table,
  variance percentages, red below-plan and green on/above-plan indicators.
- Team comparison charts for PCS and weight (kg).
- Team totals are stage activity totals. The same physical pieces may be counted at
  multiple stages; these are not unique finished-piece totals.

Data safety
-----------
- Existing history rows are not backfilled or assigned an assumed team.
- The existing `history_logs` table and its columns are not altered.
- Existing stock movements and Master Catalog quantities are not changed by this
  feature except through the existing production-entry stock logic.
- Old history rows without an item code remain visible. Their weights are included only
  when the Master Catalog profile + length resolves to one unambiguous unit weight.
- Existing pages and tables are retained. The new table is additive.

Required Supabase setup
-----------------------
1. Before using V2.43, open Supabase SQL Editor.
2. Run `supabase_daily_team_plan_actual_v243.sql` once.
3. Publish the updated website files from this ZIP.
4. Reload the app and enter the planned PCS together with actual production for the
   selected date, shift, team, profile, item code and length.

The existing Team A/B/C assignment in Daily Production Entry is used. Historical
records with no team are not assigned retroactively.

Validation performed
--------------------
- JavaScript syntax check (`node --check`) passed.
- ZIP integrity check passed.
- Static HTML duplicate-ID and relative asset-reference checks passed.
- A focused report aggregation check was run for the three teams and five stages.

Not performed
-------------
- No live browser interaction or live Supabase write/read test was performed.
- No database migration was executed on the user's project. The SQL file is supplied
  for the user to run in their own Supabase project.
