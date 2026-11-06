AIS Tracker V2.27 — PO-linked Extrusion IN

Updates
- Production Order chart edit control is now a small pencil-only icon; the date remains visible.
- Extrusion IN requires a PO selection for new receipts, then filters profile and extrusion length to that PO.
- Receipt history now shows PO number, receipt date, profile, extrusion length, trolley/details, and IN quantity.
- Selected PO details show receipts linked to that PO by date/profile and an allocated quantity.
- Extrusion requirements allocate PO-linked receipts to their matching PO/profile/length. Existing receipt records without a PO remain intact and are treated as legacy shared stock allocated by PO date.
- Added nullable po_number column and index through additive SQL migration only; no existing records are deleted or rewritten.

Deployment
1. Back up current website and database.
2. Run the updated supabase_extrusion_module.sql in Supabase SQL Editor to add the po_number column safely.
3. Upload the website files from this ZIP.
4. Test one receipt against a test PO/profile and verify PO-level balance/history before live use.

Validation
- JavaScript syntax check and ZIP integrity check should be run before deployment.
- Live Supabase/browser interaction was not performed in this build environment.
