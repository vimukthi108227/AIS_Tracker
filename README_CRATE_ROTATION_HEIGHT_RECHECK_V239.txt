AIS Tracker – Crate Rotation & Height Recheck (V2.39)
======================================================

Changes/recheck:
- Crate box stacking now uses the selected Master Data orientation:
  * Height vertical: box H is vertical; box W is across crate width.
  * Width vertical (rotated): box W is vertical; box H is across crate width.
- Layer count is calculated from the actual allocated PCS:
  boxes = ceil(PCS / PCS per box)
  boxes per layer = floor((usable crate width - 2 × timber thickness) / across dimension) × lengthwise rows
  layers = ceil(boxes / boxes per layer)
  packing height = layers × vertical box dimension
  overall height = packing height + crate leg height
- Explicit manual boxes-per-layer override is retained.
- Live orientation selector takes priority when explicitly selected; otherwise Master Data orientation is used.
- Maximum packing and overall-height validation remains active.

Example calculation:
Box = 2449 × 307 × 98 mm; rotated Width vertical; usable width = 921 mm;
timber thickness = 20 mm each side; 1 lengthwise row; 1,359 PCS; 100 PCS/box.
Boxes = 14; across dimension = 98 mm; internal width after timber = 881 mm;
boxes/layer = 8; layers = 2; packing height = 614 mm; overall height = 714 mm
(including 100 mm legs). Actual values depend on the saved Master Data and crate setup.

Validation performed:
- Node JavaScript syntax check passed.
- ZIP integrity check passed.
- Static HTML duplicate-ID check passed.
- Relative local asset/reference check passed.
- Isolated geometry test passed for the example above.

Limitations:
- No live browser interaction, GitHub Pages deployment, or Supabase connection/data test
  was performed in this environment. Existing database tables and records were not
  intentionally modified by this frontend-only change.
