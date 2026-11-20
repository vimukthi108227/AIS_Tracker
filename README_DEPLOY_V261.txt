AIS TRACKER — EXTRUSION REQUIREMENT + AUTOMATIC CUT USAGE (V261)

WHAT CHANGED
1. Extrusion > Current PL Requirement now follows the Packing List Tracker's
   Req Extrusions calculation exactly:
   - Packing rows are consolidated by Profile + Item Code + Cut Length.
   - Current PCS stock = Cut + Punch + Wrapping + Box + Crate PCS.
   - Pending Cut PCS = max(0, PL PCS - Current PCS stock).
   - PCS per extrusion = floor(Master Catalog Extrusion Length / Cut Length).
   - Req Extrusions per tracker line = ceil(Pending Cut PCS / PCS per extrusion).
   - If multiple Item Code / Cut Length lines share the same Profile and
     Extrusion Length, their already-rounded Req Extrusions are added together.
   - Current PL Available Stock is read from the physical extrusion ledger,
     including the new production-cut deductions.

2. Daily Production Cut now records extrusion usage automatically:
   - Only a saved Cut PCS quantity triggers extrusion usage.
   - Required extrusion quantity = ceil(Cut PCS / PCS per extrusion).
   - A Supabase RPC serializes deductions for each Profile + Extrusion Length and deducts only the quantity available in physical stock, never below 0.
   - If stock is insufficient, the missing quantity is recorded as Short Ex and
     shown in the Cut Usage History. Production Cut PCS are not silently lost.
   - A unique source_history_id makes each saved production history row consumable
     only once; retries cannot create a second deduction for the same history ID.

3. Extrusion > Cut Usage History tab
   - Date, Shift, Team, Profile, Item Code, Cut Length, Extrusion Length,
     Cut PCS, PCS / Extrusion, Required Ex, Deducted Ex and Short Ex.
   - Profile filter, search and Excel export.

DATA SAFETY
- Existing Master Catalog, Production History, Packing List, PO, receipt,
  trolley movement and other application records are not rewritten or deleted.
- The new SQL migration creates one separate additive table:
  public.extrusion_cut_usage.
- No historical production rows are backfilled or deducted. Automatic deductions
  begin only for new Daily Production Cut entries after the V261 migration is run.
- The V305 stock shift snapshot feature and the existing Team Performance fix
  are retained in this package.
- The app disables editing of a production history row once it is linked to an
  extrusion usage row, to prevent stock and history becoming inconsistent.
  Admin deletion of that history row also removes its linked usage row and restores
  the deducted stock quantity.

DEPLOYMENT — IMPORTANT ORDER
1. Back up the existing AIS_Tracker GitHub repository and Supabase database.
2. Confirm the existing extrusion module and stock-ledger migrations have already
   been run (supabase_extrusion_module.sql and supabase_extrusion_stock_ledger_v256.sql).
   The current site already uses these tables; do not recreate or clear them.
3. Open Supabase Dashboard > SQL Editor.
4. Run the new file supabase_extrusion_cut_usage_v261.sql once.
   It creates only the new cut-usage table and an atomic, idempotent RPC. It does
   not alter existing records.
5. Extract this ZIP. Upload/replace index.html, script.js and style.css in the
   root of the existing AIS_Tracker GitHub repository.
6. Keep the supplied Alumex image assets and existing SQL files in the repository.
7. Commit and push to the same GitHub Pages branch.
8. Wait for GitHub Pages to publish, then open:
   https://vimukthi108227.github.io/AIS_Tracker/
9. Hard refresh with Ctrl + F5.

TEST CHECKLIST
A. Current PL Requirement
- Select a known active Month + Container.
- Compare each Profile + Item Code + Cut Length line's Req Extrusions against
  Packing List Summary (Profile Wise).
- Confirm identical Profile + Extrusion Length lines are summed.
- Confirm Available Stock matches Extrusion Stock Summary after cut usage.

B. Automatic Cut Usage
- Use a test/backup copy or a controlled test entry.
- Example: Profile 1037, Cut Length 1727.2 mm, Extrusion Length 5260 mm.
  PCS / Extrusion = floor(5260 / 1727.2) = 3.
  A Cut entry of 100 PCS requires ceil(100 / 3) = 34 extrusions.
- If 34 are available, stock decreases by 34 and history shows 34 deducted.
- If only 10 are available, stock becomes 0 and history shows 34 required,
  10 deducted and 24 short.
- Confirm a repeated save cannot deduct twice for the same history row.
- Confirm Undo removes the linked usage and restores the stock balance.
- Confirm Cut Usage History filters and Excel export work.

VALIDATION
- JavaScript syntax check: passed locally.
- Static HTML ID / asset / CSS checks: run against this package before delivery.
- Formula smoke tests: pending Cut, per-line rounding, grouped extrusion-length
  totals and stock-capped deduction verified with test cases.
- Live Supabase migration execution, authenticated GitHub Pages browser testing,
  and real production transaction testing must be completed in the user's account.
