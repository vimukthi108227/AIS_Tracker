AIS Tracker — Extrusion PO Planner V2.25
Changes:
- PO cards show PO date and days elapsed since the PO date.
- PO cards use status-based color styling (orange = outstanding extrusion; green = all required extrusion allocated/confirmed).
- Selecting a PO shows per-profile/item extrusion requirement, allocated quantity, and remaining required quantity.
- Added receipt history by receipt date for matching profile/extrusion lengths, including trolley details and IN quantity.
- Added CSV download for selected PO details and matching receipt history.
- Moved Extrusion Stock Summary to the bottom of the Stock & Requirements section.
- Existing data tables and database schema are unchanged; no database migration is included.
Validation:
- JavaScript syntax check passed with node --check.
- ZIP integrity checked.
Note:
- Receipt records are shared stock by profile + extrusion length and allocations are calculated by PO date order. Confirm actual receipt records before marking a PO complete.
- Live Supabase/browser end-to-end testing was not performed.
