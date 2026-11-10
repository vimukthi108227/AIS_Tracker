AIS TRACKER – V2.43 FINAL
Daily Team Plan vs Actual Production

This release adds a new Production tab named “Team Plan vs Actual”. It compares Team A, Team B and Team C daily/monthly planned PCS with actual production across Cut, Punch, Wrapping, Box and Crate stages. It includes percentage variance, below-plan red indicators, on/above-plan green indicators, team cards and PCS/weight comparison charts.

IMPORTANT SETUP BEFORE DEPLOYMENT
Run `po_date_edit_work/supabase_daily_team_plan_actual_v243.sql` once in Supabase SQL Editor BEFORE deploying/using the updated website. It creates only the additive `daily_team_plans` table and grants access for the current app's publishable/anon-client model. It does not modify or delete existing production history, Master Catalog, packing list, stock, PO, shipment or other records.

Daily Production Entry
The existing form now includes plan fields for Cut, Punch, Wrapping, Box and Crate. Plan quantities are PCS. Actual Box entry remains in Boxes and is converted to PCS using the selected Master Catalog Pcs/Box capacity. A plan-only row can be saved with all actual quantities at zero, so a team can record a shift target before production begins. Actual production continues to use the existing stock movement rules.

Reports
- Daily or Monthly view
- Optional Day/Night shift filter
- Team A/B/C cards
- Stage-wise plan, actual, PCS difference and percentage variance
- Plan weight and actual weight based on Master Catalog unit weight
- Red below plan; green on/above plan
- Charts compare all three teams in PCS and kg

Calculation notes
Variance % = (Actual PCS − Planned PCS) ÷ Planned PCS × 100.
Weight = PCS × Master Catalog unit weight (kg/pc).
The totals across stages are stage activity totals. The same physical pieces can be counted at more than one stage; do not interpret the sum of Cut + Punch + Wrapping + Box + Crate as unique finished PCS. For actual records without an unambiguous Master Catalog unit weight match, weight is excluded rather than guessed. Historical records without a Team assignment remain unassigned and are not retroactively allocated.

Compatibility and data safety
- Existing `history_logs` table structure is not altered.
- Existing history records are not changed or backfilled.
- Existing Master Catalog quantities and all other stock tables are not changed by this feature.
- Existing pages and workflows remain in place.
- Plan entries are stored separately and upsert only the exact date/shift/team/profile/item/length plan line.
- The existing undo action restores the previous plan line (or removes the newly-created plan line) together with the production movement.

Checks performed
- `node --check script.js` passed.
- HTML duplicate ID check passed.
- Relative local asset/reference check passed.
- ZIP integrity check passed.

Not performed
- No live browser interaction or live Supabase read/write test was performed.
- SQL migration was not run against the user's Supabase project; it is included for the user to execute.
