AIS Tracker — Crate Box Quantity / 2D-3D Preview Correction (V2.30)

Changes
- Crate preview now derives each profile line's box count from that crate's own PCS and PCS-per-box: ceil(PCS / PCS-per-box).
- Cached/manual `boxes` values are no longer trusted for the final crate geometry calculation or preview.
- Front view draws one cell per calculated physical box and reports boxes per layer and layer count.
- Top view shows only the actual bottom-layer boxes.
- Isometric preview uses the same calculated box inventory and reports the exact total.
- Crate summary and profile detail table display the recalculated box quantities and PCS/box.

Safety
- No Supabase schema or SQL changes.
- No changes to Production Orders, Next Planning PL, Master Catalog, or Crate Master Data.
- Existing crate PCS allocations are retained; only derived box counts and display/geometry calculations are refreshed.
- Existing safe crate-planning reset action is retained.

Validation
- JavaScript `node --check` passed.
- HTML parser check passed.
- ZIP integrity check passed.
- Formula spot checks use ceiling division (e.g. 30 PCS / 12 PCS per box = 3 boxes; 400 / 12 = 34 boxes).
- Live browser rendering and live Supabase synchronization were not available for this offline package check; verify in deployment before operational use.
