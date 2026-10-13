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
