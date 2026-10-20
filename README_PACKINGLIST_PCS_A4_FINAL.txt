AIS Tracker - Packing List Profile PCS + A4 PDF Update

Changes:
1. Each profile/item line inside each crate clearly shows its own PCS Qty.
2. Admin can click the PCS Qty value to edit that record using the existing Admin Quick Edit workflow.
3. Existing packing_list schema and stored records are retained; no new tables/columns and no data reset.
4. Packing List PDF paginates by complete crate card on A4 landscape pages, instead of slicing one tall screenshot at arbitrary positions.
5. Browser print CSS requests A4 landscape and prevents crate cards/profile rows from splitting where supported.

Validation:
- JavaScript syntax checked with Node.
- ZIP integrity checked.
- Live Supabase/browser workflow was not exercised in this environment. Back up before publishing and test one crate's PCS Qty edit and PDF print after deployment.

Latest Packing List / smoother save update:
- On a fresh load, Packing List opens the newest saved month/container grouping.
- Dashboard Packing List chart always uses the newest saved Packing List grouping.
- Older PLs remain accessible using the month/container selectors.
- Packing List save buttons are disabled while saving to prevent accidental duplicate clicks and are restored after success/failure.
- Successful save refreshes the Packing List view and dashboard chart.
- No schema migration or data reset was added.

Latest-page behavior refinement:
- Every time the Packing List page is opened, it selects the latest active/incomplete saved Packing List grouping first.
- A completed earlier container (for example, 1st) will not override the active next container (for example, 2nd).
- The page returns to the latest active Packing List after a successful save.
- Historical Packing Lists remain available from the Month/Container selectors.
- Creation/update timestamps are preferred over shipment date when determining the most recently saved records.
- No database schema change, data deletion, or reset was added.

Recheck fix (2026-10-20): Packing List rows now retain created_at/updated_at/timestamp metadata when available, so latest-list selection can use real save/update times instead of relying only on the packing date. This does not alter database schema or stored records.


SAFE UPDATE — ENTER KEY + DUPLICATE SAVE GUARD
- Press Enter in supported data-entry forms to trigger the form primary save action.
- Packing List Enter action adds the selected profile to the current crate; use the explicit button to save/start a new crate.
- Rapid repeat submissions of identical form data are blocked for 5 seconds, and concurrent saves are blocked while the same action is processing.
- Existing HTML/CSS/JS functions and database schema are preserved; no existing records are deleted or migrated.
- Validation performed: JavaScript syntax check and ZIP integrity check. Live Supabase/browser testing was not performed.
