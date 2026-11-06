AIS Tracker — Extrusion Stock & PO Planning module

Added a standalone Extrusion tab with three sub-tabs:
1. Stock & Requirements: grouped profile + extrusion length stock, total requirement, received quantity, balance and shortage/extra status.
2. Extrusion IN: receipt date, profile, extrusion length, trolley details, IN quantity and note; supports edit.
3. IN History: receipt records with profile/search filters and edit/delete actions.

PO requirement formula: for each open PO line, required extrusion count = ceil(open PO balance pieces × profile cut length / Master Catalog extrusion length). Open PO balance = PO required quantity minus matching recorded shipments. A PO's requirement uses Master Catalog profile + cut-length matching and its Ex Length value. Requirement is estimated as straight-length yield and does not account for saw kerf, extrusion defects, remnant reuse or special cutting patterns.

SETUP REQUIRED: Run supabase_extrusion_module.sql once in Supabase SQL Editor. It creates a new extrusion_receipts table only and does not modify existing tables or records. The sample policies are permissive to match the current app's public-key pattern; review them for your production security needs.

Validation: JavaScript syntax, HTML IDs, CSS braces, core requirement formula, and ZIP integrity checked. Live Supabase/browser end-to-end testing was not performed. Back up the website and database before deployment.
