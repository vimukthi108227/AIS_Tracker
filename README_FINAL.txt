AIS Tracker — Final Integrated Update

Included:
- Latest website source and assets from the Crate Stock / Shipment update.
- Safe Supabase refresh behavior: a failed read is treated as a sync error, not as an empty table, to avoid replacing visible in-memory data with empty arrays.
- Paginated table reads for large datasets.
- Crate completion stock flow with live stock re-checks, insufficient-stock validation, persistence checks, and best-effort rollback on failure.
- Reject Tracker month/profile/item-code filters with total rejected PCS, weight, record count, and Clear Filters.
- Existing HTML, CSS, and application data schema retained; no DROP, TRUNCATE, or bulk-delete migration is included.

Important: static source and ZIP integrity checks were run. This environment cannot verify your live Supabase credentials, RLS policies, deployed website, or actual save/read operations against your production database. Please deploy to a test copy first and confirm a small test record saves and reloads before replacing the live deployment. Keep a Supabase backup before testing stock movements.
