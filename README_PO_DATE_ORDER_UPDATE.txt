AIS Tracker — Production Order Date Ordering Update (2026-10-27)

Changes:
- Production Order detail rows sort by PO Date, newest first.
- PO Number filter values sort by latest associated PO Date.
- Profile and Item Code filter values sort by latest associated PO Date within current upstream filters.
- Existing cascading filters and selected values are retained when still available.
- Individual PO fulfilment doughnut cards sort newest first.
- Excel and PDF Production Order exports use the same date order.
- Stable order is preserved for same or missing dates.
- No database records, schema, quantities, shipments, or stock values are modified.
- Script and stylesheet cache-busting versions updated.

Verification:
- JavaScript syntax check.
- HTML ID uniqueness.
- CSS brace balance and local asset references.
- ZIP integrity.

Live Supabase/browser end-to-end testing was not performed. Back up before deployment.
