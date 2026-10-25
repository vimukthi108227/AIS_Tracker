AIS Tracker — Final Typography & Table Stability Update

Updates:
- Refined navigation/tab typography using a clean system font stack (Inter/Segoe UI/Roboto fallback), improved kerning and antialiasing.
- Removed movement/scale/filter/box-shadow changes from table rows/cells on hover, which can cause the table to jitter or reflow.
- Preserved subtle, non-layout-changing hover color for readability.
- Preserved important bold formatting in Current PL shipment balance and Raw Packing List Logs.
- Removed hover movement from key tab buttons and crate toggle controls.
- Added visible keyboard focus styles and reduced-motion support.
- Bumped CSS/JS query versions to avoid stale GitHub Pages cache.
- No database schema or saved records changed.

Static validation performed:
- Node syntax check for script.js.
- HTML duplicate-ID check.
- CSS brace balance check.
- Local asset reference check (relative local CSS/JS).
- ZIP integrity check.
Live browser and Supabase end-to-end checks were not performed.
