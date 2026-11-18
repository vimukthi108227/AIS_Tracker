AIS Tracker V2.59 — Manual Next PL + Extrusion Stock Fix
======================================================

New Extrusion Stock Summary features
------------------------------------
- Stock rows are generated from Master Catalog Profile + Extrusion Length,
  so lengths remain visible even when there is no open PO or no stock yet.
- Received extrusion receipts already stored in extrusion_receipts remain
  included as opening/current stock.
- New Stock IN records add extrusion quantity.
- Stock OUT records issue extrusion quantity and cannot exceed available stock.
- Click the Stock quantity in the table to set/correct the physical stock
  balance. The difference is recorded as an adjustment; no prior receipt or
  movement record is overwritten.
- Extrusion Balance Qty = Current Stock Qty - Total Required Qty.
- The stock table continues to show Profile, Extrusion Length, Total Required,
  Current Stock, Extrusion Balance Qty and status.

Supabase setup
--------------
Run supabase_extrusion_stock_ledger_v256.sql in Supabase SQL Editor once.
It creates only the new extrusion_stock_movements table and indexes/policies.
It does not modify or delete existing PO, Master Catalog, shipment or
extrusion_receipts records.

You may alternatively run the updated supabase_extrusion_module.sql; it is
idempotent and now includes the new additive stock ledger migration.

Access
------
Stock IN / OUT / balance correction requires Admin or Planner role.
Existing PO-wise receipt workflow and receipt history are retained.

GitHub deployment
-----------------
Upload/replace the root index.html, script.js, style.css and the SQL migration
file(s) from this ZIP. After deployment, run the SQL migration in Supabase,
then hard refresh the website (Ctrl+F5).

Validation
----------
JavaScript syntax and HTML structure checks passed; ZIP integrity checked.
Live Supabase/browser integration was not executed in this environment.


V257 — Clear Next PL → Crate Plan
---------------------------------
- Added a visible "Clear Crate Plan" action beside "Add Selected Next PL to Crate Plan".
- The same clear action is available in the Crate List Generate tab.
- Clear asks for confirmation and clears saved crate allocations / generated crate
  records only. It does NOT delete the selected Next Planning PL quantities,
  Production Orders, Master Catalog, or Crate Master Data.
- The empty crate-plan state is saved to the existing crate-plan cloud storage
  and local cache so it stays cleared after refresh/login.


V259 — Manual Next PL + Extrusion Stock Reliability
----------------------------------------------------
- Added an explicit Manual Planning Mode checkbox before the manual Profile +
  Length planner. Enable it before entering manual Next PL quantities.
- Added a separate review table showing manually added Profile, Item Code,
  Length, PCS, unit weight and calculated total weight.
- Added a Remove action for each manual Profile / Length line. Removing a line
  sets its temporary Next PL allocation to zero; it does not delete PO records.
- Added an 18,000 kg warning based on Current PL weight plus all selected Next
  PL quantities. The warning shows the excess and asks the user to reduce PCS.
- Manual Add / Update re-resolves matching PO lines from live data and allocates
  FIFO, preventing stale row-key submissions and duplicate increments.
- Extrusion stock table now clearly reports when its stock movement ledger
  cannot load. IN / OUT / Edit are blocked until the ledger migration is ready,
  avoiding misleading zero balances.
- Stock movement save verifies that the ledger reload succeeds before showing
  a success message. The actual database error is shown when it fails.
- Stock quantity Edit remains an additive SET adjustment: it records only the
  difference and does not overwrite old receipt or movement records.

Important Supabase step
-----------------------
After uploading, run supabase_extrusion_stock_ledger_v256.sql in Supabase SQL
Editor if it has not already been run. It is safe to run repeatedly and adds
only the stock movement table/indexes/policies/REST grants. Existing data is
not deleted or rewritten. Then refresh the site with Ctrl+F5.


V260 — Extrusion Stock IN / OUT / Edit Dialog Fix
------------------------------------------------
- Fixed the stock IN, OUT and quantity Edit dialog appearing as a dimmed
  screen without its form. The dialog is moved to the document body before
  opening, outside transformed/overflow tab containers, and the form is
  explicitly layered above its backdrop.
- Restored page scrolling when the dialog closes and added Escape-to-close.
- No database schema or existing records are changed by this UI fix.

Validation: JavaScript syntax check and HTML parser check passed; ZIP integrity
was checked. Live Supabase/browser testing was not available in this build.
