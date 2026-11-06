AIS Tracker — PO-wise Extrusion IN Workspace V2.28

Changes
- Extrusion module now opens directly on the PO-wise Extrusion IN workspace.
- Production Orders are shown as separate selectable cards ordered by the received/PO date.
- Selecting a PO shows only that PO's extrusion requirement lines, profile, item code, cut length, extrusion length, open PCS balance, required extrusion count, allocated receipts, and remaining requirement.
- The selected PO is synchronized with the receipt form. Profile and extrusion-length choices are restricted to the selected PO.
- The selected PO's date-wise receipt breakdown remains visible below the requirement table.
- Stock Summary and IN History remain available as separate sub-tabs.
- Existing production order, master catalog, shipment, and receipt records are not deleted or migrated by this UI update.

Deployment
- Replace the website files with the files in this folder.
- This UI-only update uses the existing extrusion_receipts table and existing additive po_number migration from V2.27. Do not rerun or alter database migrations solely for this UI redesign.
- Back up the current website and database before deployment.

Validation
- JavaScript syntax check and ZIP integrity check passed.
- Live Supabase/browser end-to-end save and balance testing has not been performed in this environment.
