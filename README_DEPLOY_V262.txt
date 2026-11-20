AIS TRACKER — PO-WISE EXTRUSION STOCK ALLOCATION (V262)

WHAT CHANGED
1. PO-wise Stock Allocated now uses the CURRENT physical on-hand extrusion stock.
   - Physical on-hand stock is read from the existing Extrusion Stock ledger.
   - It includes saved Extrusion IN receipts, trolley Stock IN/OUT/SET movements,
     and saved Daily Production Cut deductions.
   - PO-linked receipt quantities are allocated to their matching PO first,
     capped by the current physical balance.
   - Remaining shared stock is allocated FIFO by PO date, PO number, profile,
     and cut length.
   - Each profile + extrusion length stock balance is allocated only once across
     the open PO lines; the same physical stock cannot be counted for two POs.
   - Still Required = Required Extrusions - Stock Allocated.
   - This is a display/report allocation only. It does not reserve or deduct
     stock. Stock is actually deducted only when a saved Daily Production Cut
     record is processed by the V261 stock-usage RPC.

2. PO-wise Excel exports
   - Selected PO requirement table: Excel workbook with PO Requirement and
     Receipt History sheets (when receipt rows exist).
   - Selected PO receipt-history table: separate Excel export.
   - Download Pending: exports all active PO lines with Required, Available
     Stock Before Allocation, Stock Allocated, Still Required and Status.

3. Other extrusion tables
   - Extrusion IN History now has its own Excel export button.
   - Existing Physical Stock Excel export retains the Trolley Movements sheet.
   - Existing Current PL Requirement and Cut Usage History Excel exports remain.

DATA SAFETY
- No existing database table or record is altered by V262.
- No new SQL migration is required for V262; FIFO allocation and Excel controls
  are frontend/report changes.
- The V261 additive Cut Usage migration must already be applied for the on-hand
  stock figure to include Daily Production Cut deductions.
- If either the stock-movement ledger or Cut Usage ledger has not loaded, PO
  physical-stock allocation is paused and a warning is shown rather than
  displaying potentially incorrect stock allocation.
- Existing PO receipt links are preserved. PO-linked receipts receive priority
  in the report allocation, but allocations are capped by actual stock on hand.

DEPLOYMENT
1. Back up the existing AIS_Tracker GitHub repository and Supabase database.
2. Confirm the following existing migrations have already been applied:
   - supabase_extrusion_module.sql
   - supabase_extrusion_stock_ledger_v256.sql
   - supabase_extrusion_cut_usage_v261.sql
   Do not drop, truncate, or recreate these tables.
3. Extract this ZIP.
4. Replace index.html, script.js and style.css in the root of the existing
   AIS_Tracker GitHub repository. Keep all supplied Alumex image assets and
   existing SQL files.
5. Commit and push to the same GitHub Pages branch.
6. Open https://vimukthi108227.github.io/AIS_Tracker/ and hard-refresh with
   Ctrl + F5.

VALIDATION
- JavaScript syntax check: PASS.
- HTML duplicate-ID check: PASS.
- FIFO allocation smoke test: PASS.
  Example: 1037 / 5260 mm has 4 available extrusions and PO 366753 requires
  677. The table allocates 4 to that PO and shows 673 Still Required. The next
  PO with the same profile and extrusion length receives 0 until the earlier
  PO requirement is covered.
- Different profile/length stock is allocated independently.
- Excel export functions are present for selected PO details, selected PO
  receipt history, all pending PO lines and Extrusion IN History.
- Live Supabase / authenticated GitHub Pages end-to-end testing must still be
  completed in the user's account after deployment.
