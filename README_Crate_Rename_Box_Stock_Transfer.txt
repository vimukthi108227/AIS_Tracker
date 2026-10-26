AIS Tracker — Crate Rename + Box Stock Transfer + Undo

Behavior:
- Renaming an incomplete crate changes crate_no only.
- Renaming a manually completed crate moves each profile/item/length's recorded PCS from master_catalog.crate_qty to master_catalog.box_qty.
- The manual-complete state for that crate is cleared, so the renamed crate is not still shown as completed.
- Multi-profile crates are processed by exact Master Catalog row ID; one profile is never substituted for another.
- Rename and undo preserve Packing List PO/profile/item/length/PCS/weight values.
- Duplicate crate numbers are blocked.
- Stock movement validates that Crate Stage contains enough PCS before changing anything.
- Undo restores the old crate number, moves the same PCS from Box Stage back to Crate Stage, and restores the prior manual-complete state.
- If Box Stage stock is insufficient at undo time, the operation stops rather than creating negative stock.
- Undo history is session-only; reloading the page clears the local undo history.
- No database schema migration, table deletion, or old record reset is included.

Validation:
- JavaScript syntax checked with Node.
- Duplicate HTML IDs checked.
- CSS brace balance checked.
- Local asset references checked.
- ZIP integrity checked.

Important:
- Live Supabase end-to-end testing was not performed.
- Back up the current website and database before deployment; test using a non-critical crate first.
