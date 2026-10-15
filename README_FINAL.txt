AIS Tracker — Final Integrated Update

Included:
- Latest website source and assets from the Crate Stock / Shipment update.
- Safe Supabase refresh behavior: a failed read is treated as a sync error, not as an empty table, to avoid replacing visible in-memory data with empty arrays.
- Paginated table reads for large datasets.
- Crate completion stock flow with live stock re-checks, insufficient-stock validation, persistence checks, and best-effort rollback on failure.
- Reject Tracker month/profile/item-code filters with total rejected PCS, weight, record count, and Clear Filters.
- Existing HTML, CSS, and application data schema retained; no DROP, TRUNCATE, or bulk-delete migration is included.

Important: static source and ZIP integrity checks were run. This environment cannot verify your live Supabase credentials, RLS policies, deployed website, or actual save/read operations against your production database. Please deploy to a test copy first and confirm a small test record saves and reloads before replacing the live deployment. Keep a Supabase backup before testing stock movements.

Reject Tracker update: Month/Profile/Item Code filters now show Total Rejected Pcs, Plant Reject Pcs, Other Reject Pcs, total rejected weight, and record count separately. Display-only calculations use existing reject_logs.location values; no database schema or existing records are changed.

Packing List Summary logic update: PL requested qty is taken from the active uploaded PL lines. Current stock = cut + punch + wrapping + box + crate. Pending Cut = max(0, PL qty - current stock). WIP = cut + punch. Complete = wrapping + box + crate. PL Balance retains the prior signed balance convention (current stock - PL qty). Cardboard balance calculation is retained from the previous logic. Summary is read-only and does not change saved stock or historical records.

Final Packing List Summary adjustment: Removed the separate Pending Cut column. Required Extrusions now uses the shortage represented by a negative PL Balance divided by Pcs / Ex, rounded up to a whole extrusion; when PL Balance is zero or positive, required extrusion quantity is 0. PL Balance keeps the existing signed convention (current stock minus active PL qty). WIP remains Cut + Punch; Complete remains Wrapping + Box + Crate. Cardboard balance calculation is preserved. No stock values or saved records are changed by this summary.


2026-10-13 — Smooth Save / Daily Production Logic / Alumex Theme
- Daily Production save button is disabled and displays Saving... while a save is in progress; concurrent clicks are blocked.
- Empty all-zero movements are rejected, preventing accidental empty/duplicate history entries.
- Quantities must be whole non-negative numbers.
- Production movement checks stage availability in process order: Cut -> Punch -> Wrapping -> Box -> Crate. A downstream stage cannot consume more pieces than its source stage has available (including quantities entered earlier in the same form).
- Box Qty remains entered in boxes and converts to pieces using Master Catalog box capacity.
- Cardboard stock deduction remains capped to actual available cardboard; production entry is allowed during a cardboard shortage and the shortage is reported after save.
- Merged duplicate Master Catalog rows are consolidated on save into the canonical row while preserving the aggregate stage stock totals; undo/rollback restores the prior per-row stage values.
- The Alumex brand palette is updated to the logo's deep teal and leaf-green, with calmer surfaces and less distracting shadows.
- Static checks include JavaScript syntax, HTML asset references, stage formula checks, and ZIP integrity.
- Not end-to-end tested against live Supabase. Database schema was not changed. Back up the existing site/data and test the updated copy before replacing the live website.

2026-10-13 — Cardboard shortage handling refinement
- Daily Production Box Qty is saved as the valid production movement even when profile-matched cardboard stock is less than the entered Box Qty or zero.
- Cardboard deduction rechecks available stock and consumes only min(requested boxes, currently available boxes); shortage does not make the cardboard balance negative and does not block Box Qty.
- The success message states how many boxes were packed with separately prepared cardboard. Upstream Wrapping Pcs validation remains active; cardboard shortage does not bypass production-stage stock validation.
- Alumex UI refinement adds calmer card/table surfaces, consistent focus indicators, refined hover states, and a clearer production save/cardboard status treatment.
- Static QA only; live Supabase end-to-end save/reload was not available in this environment. Back up and test a copy before production deployment.

2026-10-14 — Merged Crate Excel Rows + Manual Add Profile
- Packing List Excel import now fills down merged crate-number cells for contiguous item rows. Multiple profiles under a vertically merged crate number are all assigned to the same crate. Blank separator rows reset the carry-forward so the next group cannot inherit the previous crate number.
- Each crate card has an Admin-only green plus button. It opens a profile/item code/length/PCS form tied to that exact crate, current month, and container.
- Manual add inserts one new packing_list row and reloads the normal Packing List/dashboard summaries. It rejects an identical profile+item+length already in the same crate to prevent accidental duplicate rows. PO is left null (consistent with Excel import allowing optional PO); it reuses the crate's existing PL number where available.
- No existing rows are updated or deleted. Live Supabase insert/permissions were not tested in this build; test with a database backup first.


Packing List Undo enhancement
- The Packing List page Undo button is scoped to Packing List actions so it does not undo an unrelated change from another page.
- Deleting a crate group registers an undo action with snapshots of all Packing List rows and the selected month/container crate completion state.
- Undo restores every profile/item row belonging to the deleted crate, plus the crate completion state when present. Restored rows receive new database IDs; the original business data fields are preserved.
- Deleting one Packing List line also registers an undo action.
- Crate deletion is scoped to the currently selected shipment month and container, preventing the same crate label in another shipment from being deleted.
- Database errors are no longer silently ignored during individual or group deletion. Partial group deletion attempts to restore already-deleted rows.
- Undo history is session-only (up to 20 changes) and does not persist after browser reload/close.
- Existing database schema and historical rows are not migrated or bulk-modified by this update. Live Supabase end-to-end testing is not available in this build environment; backup and test on a copy before deployment.


Packing List Excel — Number of Crates support
- Excel upload now recognizes Number of Crates / No of Crate / No of Crates, Pcs per Crate, and Total Qty columns.
- For Crate No 2 and Number of Crates 3, each row expands to crate labels Crate 2-i, Crate 2-ii, Crate 2-iii.
- If Pcs per Crate is supplied, that PCS quantity is assigned to each generated crate; when Total Qty is also supplied it must equal Pcs per Crate × Number of Crates.
- If only Total Qty and Number of Crates are supplied, the total is distributed across the requested crates without losing PCS (remainder goes to earlier crates).
- The merged crate number carry-forward logic means multiple profile rows with the same merged crate number expand into matching crate labels, so each crate contains all related profile types.
- Legacy Excel upload with Crate No / Profile / Item Code / Qty remains supported and produces one crate row per profile line.
- Existing duplicate protection remains: conflicting duplicate crate/profile/item rows stop the upload without changing old data.
- No database schema change. Live Supabase upload was not run in this environment; use a backup and test copy before replacing the live website.


2026-10-14 — AIS Production Orders workbook compatibility
- Excel import now carries forward both Crate No and Number of Crates from merged cells in contiguous profile rows.
- The supplied AIS 1st CNT OCT worksheet is supported: each profile row in a merged crate group is allocated to all corresponding generated crate labels.
- Example: Crate No 2, Number of Crates 4, Pcs per Crate 150 creates 2-i, 2-ii, 2-iii and 2-iv with 150 PCS of that profile in each crate.
- Added a separate upload-ready workbook generated from the uploaded source, with merged values expanded, formulas replaced by calculated values, and lengths populated from Production Orders when available.
- Rows without a matching Production Orders length leave Length blank so Master Catalog can resolve unique profile/item code matches. If Master Catalog has multiple matching lengths, add the correct length before upload.
- Existing Packing List rows are not modified by the importer; duplicate checks stop conflicting re-uploads. No database schema change.
- Static checks only; live Supabase upload was not performed.


2026-10-15 — Crate-stage allocation and completion display
- Packing List stage quantities are allocated once across crate lines so the same profile stock is not counted as available for every crate.
- Manually completed crates reserve current Crate-stage stock first; uncompleted crate lines allocate Box, Wrapping, Punch and Cut stock in that order.
- Crate cards now show Crate / Box / Wrapping / Punch / Cut stage quantities and the uncovered Pcs as PENDING CUT.
- A crate is Ready to Pack when each profile line can be supplied by Box + Wrapping; completion consumes Box first and uses Wrapping for any remaining required Pcs.
- The completion tick remains explicit: a crate is marked PACKED & COMPLETED only when the Admin confirms it. Completion stock movement updates master_catalog Box/Wrapping/Crate quantities and persists the existing manual crate state; no schema change.
- Static JavaScript and ZIP checks passed. Live Supabase/browser end-to-end checks were not run; backup and test on a copy before deployment.


Packing List Crate Card UI cleanup (2026-10-15)
- Removed the crate-header metrics "Box + Wrap Available" and "Req Extrusions" to reduce clutter.
- Removed the per-profile columns "Ex L", "Pcs / Ex", "PL Req Pcs", and "Req Ex" from the crate detail list as requested.
- Kept the crate-level "PL Req Total", profile/item details, Cut Length, live stage quantities (Crate/Box/Wrap/Punch/Cut), pending-cut quantity, status, add-profile, pack checkbox, and edit action.
- Increased spacing and label clarity and added responsive layout rules for smaller screens.
- Only the Packing List display template and CSS were changed; no data, database schema, or stock logic was modified in this UI-only update.
