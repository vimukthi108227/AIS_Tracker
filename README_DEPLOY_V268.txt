AIS TRACKER V268 — SEPARATE PLANT EXTRUSION IN TAB

NEW FEATURE
- Adds a dedicated "Plant Extrusion IN" tab beside the existing "PO-wise Extrusion IN" tab.
- Entry fields: Date, Trolley No. (typed), Profile, Extrusion Length (from Master Catalog), IN Quantity (whole extrusions), optional Note.
- Profile and extrusion length options are sourced from the existing Master Catalog.
- Saves each physical arrival as movement_type='IN' in the existing public.extrusion_stock_movements ledger, with date, trolley_no, profile, extrusion_length, qty_change and note.
- Shows only Plant IN form records in its dedicated history table (generic stock adjustments are excluded), with Date, Trolley No., Profile, Extrusion Length, IN Quantity and Note.
- Shows total Plant IN quantity and supports Excel export of only Plant IN form records.
- Existing PO-wise Extrusion IN and its receipt records remain unchanged.

AUTOMATIC STOCK UPDATE
- Plant IN is written to the same stock movement ledger already used by Extrusion Stock Summary.
- After a successful save, the app reloads the ledger and refreshes:
  1. Extrusion Stock Summary (Total IN / Available Stock Qty)
  2. Trolley-wise Stock Movement History
  3. PO-wise stock allocation / remaining requirement
  4. Current PL extrusion requirement
- Stock balance formula already used by the app remains: opening balance + PO-linked receipts + stock movement net - cut usage deducted.
- No second stock balance is maintained and no duplicate receipt row is added to the PO receipt table.
- A failed post-insert refresh warns that the record has already been saved and clears the form to prevent accidental duplicate resubmission.

DATABASE / MIGRATIONS
- No new SQL migration is introduced in V268.
- The existing migrations included in this ZIP must already be installed:
  - supabase_extrusion_stock_ledger_v256.sql
  - supabase_extrusion_trolley_stock_v257.sql
  - supabase_extrusion_cut_usage_v261.sql
  - The existing V265 retention/opening-balance migration included in the package, if this project is already using that retention version.
- V257 adds trolley_no to the existing extrusion_stock_movements table. It is additive and preserves prior rows.
- If the table or trolley_no column is missing, run the included V256 and V257 migrations in Supabase SQL Editor in order, then hard refresh.
- Existing PO-linked extrusion_receipts, stock movements, cut usage, PO, shipment, Master Catalog and production records are not deleted or bulk modified.

ACCESS
- Plant IN save follows the existing stock movement permission: Admin or Planner.
- Other roles can view records if they already have read access to the shared stock ledger.

DEPLOY
1. Back up the current GitHub repository and Supabase.
2. Extract this ZIP.
3. Replace index.html, script.js and style.css in the existing AIS_Tracker repository root.
4. Keep all supplied Alumex image assets and existing SQL files.
5. If not already installed, run V256 then V257 in Supabase SQL Editor.
6. Commit and push to the existing GitHub Pages branch.
7. Wait for GitHub Pages deployment and hard refresh using Ctrl+F5.

TEST
1. Open Extrusion > Plant Extrusion IN.
2. Enter a test arrival with date, trolley number, a valid Master Catalog profile + extrusion length and whole-number quantity.
3. Save once; confirm the new row appears in the history table.
4. Open Stock Summary and verify Total IN and Available Stock Qty increase by the entered quantity for that profile/length.
5. Open PO-wise Extrusion IN and Current PL Requirement; confirm available stock allocation / shortage reflects the updated physical stock.
6. Download the Plant Extrusion IN Excel report.
7. Do not use a fake production quantity as a live test; use a real arrival or a controlled test environment.

VALIDATION
- JavaScript syntax check (node --check).
- HTML IDs checked for duplicates.
- New tab, form IDs, profile/length source, insert payload, Plant IN-only history/export filter and shared-ledger refresh paths checked.
- Confirmed the shared stock formula adds movement_type IN quantities to physical stock and that PO FIFO allocation reads the recalculated shared stock.
- ZIP integrity checked.
- This is static source validation. Live GitHub Pages and Supabase end-to-end tests remain to be completed in the user's environment.
