AIS TRACKER — FINAL CRATE LIST UPDATE (V3.0)

What changed
- Enhanced the existing Full Crate Details report into a Final Crate List.
- Columns include Crate No., PO Number, Profile, Item Code, Profile Length,
  Crate Width, Crate Height, Crate Length, Number of Crates, PCS / Crate,
  Total Qty (PCS), Boxes / Crate, Total Boxes, Crate Weight (kg), and Total
  Weight (kg).
- Adds summary totals for Total Boxes, Total Crates, Total PCS, and Total Weight.
- Adds Excel and PDF downloads and a landscape A3 print layout.
- Groups repeated Roman-suffix crates only when the base crate number,
  dimensions, and complete crate contents/quantities match.
- Report is read-only. It does not change saved crate records, localStorage
  crate data, Supabase data, table schemas, or existing crate planning flows.
- Crate Weight is calculated from profile unit weight × PCS. Timber tare is
  excluded; enter tare separately in the existing Container Planner if gross
  cargo weight is required.

Installation (GitHub Pages)
1. Download and extract this ZIP.
2. Keep a backup of the currently deployed AIS Tracker folder and database.
3. In the AIS_Tracker GitHub repository, replace index.html, script.js and
   style.css with the files from this package.
4. Upload the included Alumex image assets to the repository root, keeping
   the filenames exactly as provided.
5. Commit and push the changes to the same GitHub Pages branch.
6. Open https://vimukthi108227.github.io/AIS_Tracker/ and hard-refresh
   (Ctrl + F5). Navigate to Crate Planning 2D > Crate List Generate and
   scroll below Saved Crate List to Final Crate List — Complete Details.
7. Test a repeated crate group (e.g. 1-i to 1-iv), a crate with multiple PO
   lines, crates with different PCS, and crates with different dimensions.
   Confirm Excel and PDF totals match the on-screen summary.

Important
- This package contains the updated front-end files; it does not deploy to
  GitHub automatically.
- No Supabase SQL migration is required for this report update.
- Full live Supabase/browser end-to-end testing has not been performed.
- The website references ais_2.jpg as an optional login background image,
  but that image was not among the supplied current assets. The Alumex
  background image is included as alumex-global.png.
