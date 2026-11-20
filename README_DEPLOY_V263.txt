AIS TRACKER — V263 PO / PHYSICAL STOCK RECONCILIATION

WHY THE TWO SCREENSHOTS CAN SHOW DIFFERENT VALUES
- The Physical Stock Summary shows physical on-hand stock for a Profile + Extrusion Length.
- The PO detail table allocates that physical stock across ALL open POs, not independently
  to each selected PO. PO-linked receipts are prioritized to their matching PO; remaining
  shared stock is allocated in PO-date FIFO order.
- Therefore, stock can show 4 physically available while a later selected PO shows 0
  allocated if those 4 have already been allocated to another open PO.
- V263 makes this visible: the selected PO detail now shows Physical Stock On Hand,
  Allocated to Other PO(s), Allocated to This PO, and Still Required. A second breakdown
  table lists the actual other PO number(s) receiving the stock.
- Example only: physical stock 4; other PO(s) allocated 4; selected PO allocation 0;
  selected PO still required 677. This is a valid FIFO allocation, not a second physical
  deduction. The live database is needed to identify the actual PO number(s) in the user's
  current data.

STOCK / DATA SAFETY
- V263 is a reporting and transparency update. It does not change PO requirements,
  receipts, physical stock movements, Cut usage, or Supabase records.
- No new SQL migration is required.
- The physical stock number continues to come from the same Extrusion Stock ledger
  calculation used by the Stock Summary: receipt IN + movement IN/OUT/SET - saved
  production Cut deductions.
- PO allocation is a planning view only; it does not reserve or deduct stock.
  Actual stock deduction remains tied to saved Daily Production Cut records.

EXCEL
- Selected PO workbook now includes PO Requirement, Stock Allocation and (when available)
  Receipt History sheets.
- The all-pending PO export includes physical stock, allocation to other POs, allocation
  to the selected PO line and still-required quantities.
- Existing stock, current PL, receipt history and Cut usage exports are retained.

DEPLOYMENT
1. Back up the current AIS_Tracker GitHub repository and Supabase database.
2. Do NOT drop, truncate, recreate, or overwrite any Supabase tables.
3. No SQL migration is required for V263.
4. Extract this ZIP and replace index.html, script.js and style.css in the existing
   AIS_Tracker repository. Keep all included Alumex image assets and SQL files.
5. Commit and push to the same GitHub Pages branch.
6. Open https://vimukthi108227.github.io/AIS_Tracker/ and hard refresh with Ctrl+F5.
7. Open Extrusion > PO-wise Extrusion IN, select each pending PO and inspect the new
   Physical Stock Allocation Breakdown. The other PO number(s) and quantities should
   explain any stock already allocated before the selected PO.

VALIDATION
- JavaScript syntax check: run node --check script.js.
- HTML duplicate IDs: check all IDs after inserting the allocation breakdown body.
- Allocation scenario: if stock=4, earlier/other PO allocation=4 and selected PO requirement=677,
  the selected PO must show physical=4, other PO allocation=4, selected PO allocation=0,
  still required=677, unallocated=0.
- If no other PO has allocation, selected PO must receive up to 4 and show still required=673.
- Static source validation does not replace live Supabase testing. Confirm the live database
  and browser after deployment before operational use.
