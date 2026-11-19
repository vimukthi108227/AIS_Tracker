AIS TRACKER — CURRENT PL EXTRUSION REQUIREMENT UPDATE

Included files:
- index.html
- script.js
- style.css
- Alumex image assets

WHAT CHANGED
- Added a fourth tab under Extrusion: "Current PL Requirement".
- Reads the currently selected Packing List month and container.
- Groups Current PL quantities by Profile + Extrusion Length.
- Calculates required extrusion bars using the same Master Catalog rule already used by AIS Tracker:
  PCS per extrusion = floor(Extrusion Length / Cut Length)
  Required extrusions = ceil(Current PL PCS / PCS per extrusion)
- Reads available extrusion stock from the existing Extrusion Stock Summary (receipts plus stock IN/OUT/adjustment ledger movements).
- Calculates short extrusion = max(0, required extrusion - available stock).
- Provides Excel and PDF downloads, totals, refresh, and a notice for missing Master Catalog mappings or stock-ledger load failures.

DATA SAFETY
- This is a read-only report.
- No Supabase tables, schema, policies, or records are modified.
- No stock is reserved or deducted by this report.
- Existing pages and tabs are retained.

GITHUB PAGES UPDATE
1. Download and extract the ZIP.
2. Back up the current GitHub repository files first.
3. Upload/replace index.html, script.js, and style.css in the repository root.
4. Keep the included Alumex image files in the repository root.
5. Commit the changes and wait for GitHub Pages to publish.
6. Open the website and hard-refresh (Ctrl+F5).

TEST NOTES
- JavaScript syntax check passed.
- HTML parser check passed; no duplicate HTML IDs found.
- A calculation test passed: 13 PCS at 6 PCS per extrusion => 3 required; with 2 available => 1 short.
- Live Supabase/browser testing has not been performed in this environment.
