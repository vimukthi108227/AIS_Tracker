AIS TRACKER V2.19 — CRATE STOCK + SHIPMENT STOCK UPDATE
=========================================================

Implemented
- Packing List crate completion now moves stock for each Profile + Item Code + Length.
- When Mark Done is selected, it uses Box Stage first. If Box Stage is insufficient,
  the remaining PCS are taken from Wrapping Stage.
- The full crate PCS quantity is added to Crate Stage.
- The exact Box/Wrapping quantities consumed are stored with the crate-completion state.
- When Mark Done is unchecked, those exact Box/Wrapping quantities are restored and
  the corresponding Crate Stage quantity is removed.
- Legacy completion flags without stock movement details can be unchecked without
  inventing a stock reversal.
- Before changing stock, the app re-reads current quantities from Supabase.
- If a crate's PCS have already been shipped and Crate Stage no longer has enough stock,
  unchecking is blocked rather than making stock negative.
- Shipment entry retains the existing priority deduction order:
  Crate -> Box -> Wrapping -> Punch -> Cut. It will not make any stage negative and
  blocks shipment when total available stock is insufficient.
- After crate completion/uncompletion, Current Stock, Dashboard, Balance Work, and
  Packing List are refreshed.

Data safety
- No SQL migration or schema change is included.
- No existing records are intentionally deleted, reset, or bulk rewritten.
- Stock updates are written to the existing master_catalog fields box_qty, wrap_qty,
  crate_qty. Crate completion state uses the existing SYS_CRATES_SYNC daily_instructions
  record / localStorage pathway.
- Because Supabase does not provide a multi-table transaction through these client calls,
  rollback is best-effort if a later write fails. Check the database after any reported
  error before retrying the same action.
- Back up Supabase tables and test on a staging copy before production deployment.

Validation
- JavaScript syntax check passed with Node.js.
- ZIP integrity check passed.
- A live Supabase end-to-end test and full browser interaction test were not available
  in this environment.
