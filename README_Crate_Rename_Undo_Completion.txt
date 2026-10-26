AIS Tracker — Crate Number Only Rename + Undo

Changes:
- Editing a crate changes only the crate_no column for each affected Packing List row.
- Each row is updated by its exact primary key ID and scoped to shipment month/container.
- All profile/item/length/PCS/weight/PO/date fields are preserved.
- The manual completion state is not read, moved, written, or toggled by crate rename or undo.
- Added an Admin-only "Undo Crate No. Edit" button. It reverses the latest rename in this browser session only, row-by-row, with exact ID/month/container/current-crate guards.
- Undo history is kept in memory for the current page session and is not persisted to the database. A page reload clears the undo history.
- If a target crate number already exists, the rename is blocked to prevent accidental merging.
- No schema migrations, table deletes, or saved record resets are included.

Validation:
- JavaScript syntax
- Duplicate HTML IDs
- CSS brace balance
- Local asset references
- ZIP integrity

Important:
- Live Supabase/browser end-to-end testing was not performed.
- Back up website and database before deployment.
