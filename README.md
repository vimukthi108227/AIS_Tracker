# AIS Tracker — Professional UI + Full Static Audit Package

Version: V2.20 UI polish

## Included
- Existing AIS Tracker HTML, JavaScript, CSS, Alumex assets and SQL helper retained.
- Refined Inter-based typography, clearer form and button focus states, calmer navigation transitions, subtle page entrance animation, improved table scrolling, and responsive spacing.
- Table/card hover effects are constrained so the table does not jump, shift, change text width, or resize when the pointer moves over rows.
- CSS and JavaScript cache-busting versions updated so the browser fetches the latest files after deployment.
- Existing crate rename / multi-profile stock-transfer / undo code and other existing workflows retained.

## Safe deployment
1. Back up the current GitHub repository and Supabase database before deployment.
2. Extract this ZIP and upload the files inside to the root of the existing AIS_Tracker repository (do not upload the ZIP itself).
3. Keep `index.html`, `script.js`, `style.css`, all Alumex image assets and the SQL helper together.
4. The existing Daily Production Team A/B/C chart requires `public.history_logs.team`. If that column is absent, run `supabase_add_team_to_history_logs.sql` once in Supabase SQL Editor. The SQL adds the column only if missing and requests a schema-cache reload; it does not delete or rewrite existing rows.
5. Open the published GitHub Pages URL and press Ctrl+F5.
6. Verify login/roles, one test Production Entry, history saving, current stock, crate rename + undo, Packing List, shipment balance, Excel/PDF exports, Reject Tracker, and crate/container planning before entering live data.

## Audit scope and limitations
This is a static/source-code and packaging audit. JavaScript syntax, inline JavaScript, HTML ID uniqueness, inline event-handler references, CSS parsing, local asset references and ZIP integrity are checked. No database schema migration, production data rewrite, or record deletion is included.

A live end-to-end test against the user's Supabase project was not performed. Therefore this package does not claim that every database operation is confirmed live. Back up first and test with a non-critical record before deploying to production.
