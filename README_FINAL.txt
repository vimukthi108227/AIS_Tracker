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
