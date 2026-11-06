AIS Tracker V2.31 — Exact Crate Box Layout

- Box quantity is recalculated using Master Data PCS per box as the authoritative value, falling back to the saved crate-line value only when master capacity is absent.
- Formula: ceil(PCS / PCS per box).
- Front and isometric previews draw only the calculated number of occupied boxes and render remaining crate capacity as a clearly outlined empty slot.
- Top view shows the bottom layer with unoccupied capacity outlined.
- Removed repeated box-quantity captions from the crate drawing itself; dimensions remain visible.
- Example verified: 1,359 PCS / 100 PCS per box = 14 boxes; for 5 boxes per layer the layout is 5 + 5 + 4, with one empty position on the top row.

Safety and validation:
- No SQL or Supabase schema changes.
- No PO, Next Planning PL, crate allocation, or historical receipt records are intentionally deleted.
- JavaScript node --check passed.
- ZIP integrity check passed.
- Live browser rendering and Supabase sync were not tested in this offline package.
