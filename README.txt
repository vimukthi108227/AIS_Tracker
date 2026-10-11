AIS Tracker — Crate Planning 2D V2.16

Updates
- Batch crate creation treats each checked PO quantity as PCS per crate and duplicates those contents across the requested crate count.
- For count > 1, IDs use Roman suffixes (e.g. 4-i, 4-ii, 4-iii, 4-iv); count 1 uses plain crate number.
- Batch preview shows boxes per crate, bottom-layer capacity, layers, Master Data box height, packing height, legs and overall height.
- Crate height follows: boxes = ceil(PCS / PCS per box); layers = ceil(total boxes / boxes per bottom layer); packing height = layers × Master Data box height; overall height = packing height + legs.
- Container Top View supports click crate → click destination and drag-to-move; destination is snapped to a nearest valid non-overlapping position.
- Auto Arrange searches compact edge-aligned positions and considers 90-degree rotations; container colour PDF includes Top, Left Side, Right Side, Front and Back views, plus crate position details.
- Existing crate records and Supabase schema are retained. No database reset or migration is included.

Example
250 PCS / 15 PCS per box = 17 boxes. With 5 boxes per bottom layer, layers = ceil(17/5) = 4. At 80 mm box height, packing height = 4 × 80 = 320 mm. With 100 mm legs, overall height = 420 mm.
Note: 80 × 4 is 320 mm, not 240 mm.

Safety / deployment
- Take a backup of the current website and database before deploying.
- Test in a separate folder first, including PO balances, multi-crate creation, saved records, click-to-move, Auto Arrange and colour PDF export.
- Browser JavaScript syntax checks do not replace end-to-end testing against live Supabase.

V2.14 recheck/update
- Container colour PDF/print now contains five views: Top, Left Side, Right Side, Front and Back.
- Container view shortcuts expose Left Side and Right Side separately.
- Existing database schema and saved data are not reset or migrated.
- Live Supabase end-to-end testing must be completed in the deployment environment.


V2.14.1 small usability update
- After Profile + Item Code are selected, Length auto-selects a valid available Next Planning PL length. If the previous length is not valid for the selected pair, the first available numeric length is selected. The Length dropdown remains editable when multiple lengths are available.


V2.15 Container arrangement usability update
- Simplified Top View drag-and-drop: click/hold a floor crate, drag, and release.
- Live drag preview and automatic nearest-valid-position snapping.
- Prevents overlap/out-of-bounds placement through the existing placement validation.
- Added clearer on-page drag instructions and keyboard focus labels for crate shapes.
- Keeps the existing crate records, PO quantities, Master Data and Supabase schema unchanged.
- Existing Auto Arrange, Undo Layout, manual X/Y, rotate and stacking controls remain available.

Please test in a separate copy and back up existing data before deploying to the live site.


V2.16 navigation label update
- Renamed the top navigation tab from “3D Packing Planner” to “Crate Planning 2D”, as requested.
- Updated the browser tab title to Crate Planning 2D V2.16.
- No crate, PO, Master Data, or Supabase records/schema are modified by this label-only change.
- Static checks: JavaScript syntax, duplicate HTML IDs, local asset references and ZIP integrity. These do not replace live browser/Supabase end-to-end testing.
