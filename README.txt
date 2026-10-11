AIS Tracker Crate Plan 3D — V2.13

Updates
- Batch crate creation treats each checked PO quantity as PCS per crate and duplicates those contents across the requested crate count.
- For count > 1, IDs use Roman suffixes (e.g. 4-i, 4-ii, 4-iii, 4-iv); count 1 uses plain crate number.
- Batch preview shows boxes per crate, bottom-layer capacity, layers, Master Data box height, packing height, legs and overall height.
- Crate height follows: boxes = ceil(PCS / PCS per box); layers = ceil(total boxes / boxes per bottom layer); packing height = layers × Master Data box height; overall height = packing height + legs.
- Container Top View supports click crate → click destination and drag-to-move; destination is snapped to a nearest valid non-overlapping position.
- Auto Arrange searches compact edge-aligned positions and considers 90-degree rotations; container colour PDF retains Top, Side, Front and Back views.
- Existing crate records and Supabase schema are retained. No database reset or migration is included.

Example
250 PCS / 15 PCS per box = 17 boxes. With 5 boxes per bottom layer, layers = ceil(17/5) = 4. At 80 mm box height, packing height = 4 × 80 = 320 mm. With 100 mm legs, overall height = 420 mm.
Note: 80 × 4 is 320 mm, not 240 mm.

Safety / deployment
- Take a backup of the current website and database before deploying.
- Test in a separate folder first, including PO balances, multi-crate creation, saved records, click-to-move, Auto Arrange and colour PDF export.
- Browser JavaScript syntax checks do not replace end-to-end testing against live Supabase.
