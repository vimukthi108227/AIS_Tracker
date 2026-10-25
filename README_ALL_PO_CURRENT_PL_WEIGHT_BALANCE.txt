AIS Tracker — All Pending PO Shipment Balance + Current PL Qty/Weight

What changed:
- The Current PL vs Shipment Balance page now includes all open/pending Production Order lines, even if a line has not been added to the active Packing List yet.
- For each PO/Profile/Item Code/Length line it shows required qty/weight, already shipped qty/weight, shipment balance qty/weight, current active PL qty/weight, and balance after the active PL qty/weight.
- Unit weight is read from Master Catalog. Weight = PCS × unit weight (kg/pc).
- Click the Shipment Balance PCS value to inspect saved shipments by month/container.
- Current PL quantities come only from the selected active month/container. Previous/completed Packing Lists are not added.
- Unmatched current PL lines remain visible and are marked No matching PO.
- Existing PO-number normalization (e.g. "PO 363760" matches "363760"), font styling, wrapping chart, other pages, and database schema are retained.
- This is a read-only report change: no database records are inserted, updated, or deleted.

Checks:
- Main JavaScript syntax check.
- Inline JavaScript syntax checks.
- CSS parsing and HTML IDs/references checks.
- ZIP integrity check.
- Live Supabase end-to-end validation still required in deployment environment.
