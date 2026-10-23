AIS Tracker — Full Static Source Audit (2026-10-23)

Changes made
1. Cache-busting versions were updated for style.css and script.js in index.html. The supplied screenshot showed the older chart label ('MONTH TOTAL') even though the newer source uses 'NO TEAM DATA' for a zero-data state. The old query-string version could let a browser reuse cached JavaScript/CSS after deployment. The new query string forces the browser to request the updated files.
2. Monthly Team A/B/C doughnut chart weight calculation now avoids silently choosing the first Master Catalog row when more than one row matches the same profile and length with different unit weights. Missing/ambiguous unit weights are excluded from totals and counted in a visible warning rather than guessed.
3. Existing data and records are not migrated, deleted, or rewritten by these changes.

Static checks completed
- node --check script.js: PASS
- node --check on each inline JavaScript block in index.html: PASS
- ZIP archive integrity: PASS
- HTML ID uniqueness: 488 IDs checked; no duplicate IDs
- Inline event-handler function references: 167 unique names checked; no missing function references found
- CSS syntax parse: no top-level parse errors; brace counts balanced
- Required website files/assets are included in the ZIP

Important limitations
- This is a static/source-code audit. It does not prove every page works against the live Supabase database.
- A full live end-to-end test of login/roles, CRUD operations, shipment and packing workflows, PDF/Excel export, and container planning has not been performed.
- Supabase schema and production records were not accessed or changed during this audit.
- The monthly team chart needs the `team` column in `public.history_logs`; if absent, run `supabase_add_team_to_history_logs.sql` once in Supabase SQL Editor before entering new Team A/B/C production records. The SQL only adds the column if missing.
- Historical records without a saved Team are deliberately left unchanged and excluded from team totals. Their Team cannot be inferred safely.
- Deploy the ZIP contents to the existing repository, then perform one hard refresh (Ctrl+F5) to bypass browser cache. Back up the current website files and database before deployment.
