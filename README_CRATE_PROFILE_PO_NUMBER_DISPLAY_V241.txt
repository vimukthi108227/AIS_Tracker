AIS Tracker – Crate Profile PO Number Display (V2.41)
=====================================================

Packing List > Detailed Crate Production Status (Live View):
- Each crate profile/item/length detail row now also displays its associated
  Production Order number.
- The PO number is taken from the existing Packing List record (poNumber /
  po_number). No PO is inferred from another record.
- The existing profile, length, required PCS, stage quantities, completion
  state, crate rename/undo, and delete actions remain unchanged.
- This is a frontend display-only update. No database schema or existing
  Packing List / Production Order records are modified.

Validation:
- Node JavaScript syntax check passed.
- Existing project assets and SQL files are retained in the package.
- ZIP integrity check passed.

Limitations:
- Live GitHub Pages, browser interaction and Supabase data verification were
  not performed in this environment. If a historical Packing List row has no
  stored PO number, its display will show '-' rather than guessing.
