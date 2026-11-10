AIS Tracker – Crate Weight Accuracy Update (V2.42)
=================================================

Issue addressed:
Some crate cards could show an incorrect/zero weight because the crate analytics
matched Master Catalog rows only when profile, item code, and displayed length
were exact string matches.

Changes:
- Resolve catalog rows using normalized Profile + Item Code and numeric length
  comparison (tolerance 0.05 mm) to avoid formatting/rounding-only mismatches.
- If the Profile + Item Code identifies exactly one Master Catalog row, use that
  unique row even if the displayed length formatting differs.
- Prefer the Net Weight already stored on each Packing List row. When present,
  derive that line's unit weight from saved net weight / PCS. Otherwise use the
  matched Master Catalog unit weight.
- Use the same resolved line weight for each crate card and the overall Packing
  List weight total/chart, so crate weights aggregate consistently.
- Does not alter Packing List records, stock quantities, completion flags,
  database schema, or existing Supabase data.

Validation:
- Node JavaScript syntax check passed.
- ZIP integrity check passed.

Limitations:
- No live GitHub Pages/browser/Supabase test was performed.
- If a Packing List row has no saved net weight and its Profile + Item Code maps
  to multiple Master Catalog rows with no matching length, the code does not
  guess a weight; that row requires Master Catalog review.
