AIS Tracker V2.24 — PO cards and manual completion confirmation

- Removed the four summary KPI tiles marked in the supplied screenshot.
- Added compact, date-ascending individual PO cards with search and selection.
- Selecting a card displays only that PO's extrusion requirements in the detail table.
- “Mark complete & remove” asks for confirmation and hides the PO from pending cards by marking it complete in browser localStorage. This does not delete or modify PO, production, shipment, or receipt records. Undo is available by clearing browser site data/localStorage key ais_extrusion_po_confirmed_complete_v1; it is intentionally not a database delete.
- Other PO cards, extrusion stock summary, IN history and receipt records remain available.
- Stock summary excludes manually confirmed complete PO requirements to avoid showing them as pending. The actual receipt ledger remains unchanged.
- Validation: Node syntax check, PO date ordering and completion override logic, HTML IDs/assets/CSS, ZIP integrity.
- Live Supabase/browser end-to-end testing was not performed.
