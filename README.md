# AIS Tracker — Audited Website Package

This package contains the current AIS Tracker website source files and the Team column migration required by the Daily Production Team A/B/C feature.

## Deploy safely
1. Back up the existing GitHub repository files and the Supabase database before deploying.
2. Extract this ZIP.
3. Upload the contents of the extracted folder to the **root of the existing AIS_Tracker repository** (do not upload the ZIP file itself).
4. Keep the website files together: `index.html`, `script.js`, `style.css`, and the four Alumex image assets.
5. In Supabase SQL Editor, run `supabase_add_team_to_history_logs.sql` once if `public.history_logs.team` does not exist. This migration only adds the column if missing and asks PostgREST to reload its schema cache; it does not delete or rewrite existing rows.
6. Open the published GitHub Pages URL, press Ctrl+F5, and test one small production entry. Verify it appears in Production History before entering real production data.

## Important limitations
- Historical records without a saved Team remain unassigned; do not guess a team for old records.
- The monthly team chart only counts records with a valid Team and an unambiguous positive Master Catalog unit weight.
- This is a static source audit package. Live Supabase CRUD, login/roles, shipment/packing, exports, and crate/container planning must still be tested in the actual deployment environment.
