AIS Tracker – Team Plan vs Actual Update (V2.44)

Changes:
- Team Plan vs Actual report now includes ONLY Cut, Punch and Wrapping stages.
- Team A, Team B and Team C each show stage-by-stage Plan PCS, Actual PCS, Plan Weight (kg), Actual Weight (kg), PCS difference and variance percentage.
- Team cards also show total activity across the three requested stages.
- Existing Daily / Monthly report selector, Production Date selector, Month selector and Shift filter are retained.
- Monthly view aggregates the selected month; Daily view filters the selected production date.
- Existing PCS and weight comparison charts now aggregate only Cut, Punch and Wrapping.

Data protection:
- Existing Supabase tables, rows, history logs, stock logic, packing list, crate planning and extrusion pages are not modified by this update.
- No database migration is required; this is a report/UI calculation change.
- Stage weight is calculated from the matching Master Catalog unit weight. Ambiguous or missing unit weights are excluded and reported in the notice.
- PCS totals are stage activity totals; the same physical PCS may be counted at more than one stage. Do not interpret the sum as unique finished PCS.

Checks:
- Node JavaScript syntax check passed.
- ZIP integrity check passed.
- Live Supabase/browser validation was not performed in this environment.
