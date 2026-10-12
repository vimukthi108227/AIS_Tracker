AIS TRACKER V2.19 - FINAL SIDE VIEW VISIBILITY FIX

Change in this release:
- Left side elevation draws crates on the far side first and near-side crates last, so crates hidden behind a nearer crate are visually covered.
- Right side elevation uses the opposite depth order, so it shows the crates visible from the right side.
- The same visibility ordering is applied to the exported side-view diagrams used in PDF/print reports.
- Existing crate data, Supabase schema and saved layout records are not migrated or reset by this change.

Deployment: extract the ZIP and keep index.html, script.js, style.css and the image assets in the same folder. Test on a copy before replacing a live deployment.

Validation: JavaScript syntax and ZIP integrity checks performed. Browser visual test and live Supabase round-trip were not performed in this environment.
