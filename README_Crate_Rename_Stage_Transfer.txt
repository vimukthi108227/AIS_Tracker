AIS Tracker — Crate Number Editing + Manual Completion Stock Transfer

Changes:
1. Added Admin-only Edit No. action beside crate number in Detailed Crate Production Status.
2. Renaming updates all packing_list rows for the selected month/container/old crate number, so Packing List tables, crate chart/cards and derived summaries use the new crate number after refresh.
3. If the renamed crate has a manual-completion flag, its key is moved to the new crate number and saved; rollback is attempted if saving that state fails.
4. Marking a crate complete consumes each profile/item/length quantity in this order:
   Box -> Wrapping -> Punching -> Cutting.
   The same quantity is added to Crate Stage.
5. Unmarking uses the saved movement record to return the exact quantities to the original stages and subtract the same quantity from Crate Stage. It refuses if Crate Stage no longer has enough PCS to reverse safely.
6. If combined stage stock is insufficient, completion is refused before writing that line, instead of creating negative stock.
7. No database schema migration, table deletion, or saved-record reset is included.

Static validation:
- Node JavaScript syntax check
- HTML duplicate-ID check
- CSS brace balance
- Local asset references
- ZIP integrity

Important:
- Live Supabase/browser end-to-end testing was not performed.
- This code expects the existing master_catalog columns cut_qty, punch_qty, wrap_qty, box_qty, crate_qty and packing_list columns shipment_month, container, crate_no.
- Back up the website and database before deployment.
