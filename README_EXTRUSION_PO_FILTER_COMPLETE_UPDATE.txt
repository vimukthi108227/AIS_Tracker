AIS Tracker — PO-wise Extrusion Pending Filter (V2.23)

- Added PO allocation based on receipt stock grouped by profile + extrusion length.
- Received extrusion stock is allocated in chronological PO date order (oldest PO first), so newer POs cannot appear complete while older open POs still require the same extrusion.
- The PO selector lists pending POs only; choosing a PO shows only its pending extrusion lines.
- Each row shows required extrusions, stock allocated, remaining required qty, and pending status.
- Once receipts cover all extrusion requirements for a PO, its requirements are marked Complete and removed from the pending PO list/table.
- Adding a new PO automatically recalculates requirements when the module refreshes/renders.
- No existing PO, receipt, shipment, production, or stock records are changed; no database schema migration is added.
- Validation: JS syntax, date/allocation logic, HTML duplicate IDs, local asset references, CSS balance, ZIP integrity.
- Live Supabase/browser end-to-end testing was not performed. Back up before deploying.
