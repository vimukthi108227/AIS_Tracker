AIS TRACKER V265 — AUTOMATIC 4-MONTH RETENTION

WHAT THIS DOES
- Schedules a Supabase database job to run daily at 02:15 UTC (07:45 Sri Lanka time).
- Uses a four-calendar-month cutoff (current_date - interval '4 months').
- Deletes dated production, team-plan, reject, recovery, cardboard and extrusion history older than the cutoff.
- Deletes Packing List, Shipment and Production Order rows only when ALL lines of a PO are fully shipped and the final shipment date is older than the cutoff. Active / partially shipped POs remain.
- Deletes old shift stock snapshots.
- Keeps master_catalog and its current Cut / Punch / Wrap / Box / Crate quantities untouched.
- Keeps current cardboard and extrusion stock balances by snapshotting the net historical contribution into opening-balance tables before old transactions are deleted. Old Extrusion Receipt rows linked to still-active POs are retained so PO-specific receipt allocation remains correct; unlinked, orphaned, or completed-PO receipts are carried into the opening balance and purged.
- Logs each cleanup run and deleted row counts in public.ais_retention_runs.

IMPORTANT STOCK RULES
- Extrusion balance after retention = opening_qty + remaining receipt IN + remaining movement net - remaining saved Cut deductions.
- Cardboard balance after retention = opening_boxes + remaining incoming - remaining used.
- Opening balance rows are not transaction history; they are retained current-balance carry-forwards.
- Manual Cardboard Data stored in SYS_CARDBOARD_MANUAL is retained. System configuration rows in daily_instructions with SYS_ prefix are retained.
- Completed PO determination is based on shipments: summed shipped_qty must cover summed order_qty for every PO/profile/length line.
- A PO marked extrusion-complete only in one browser's localStorage is NOT considered a completed Shipment PO by this database retention job.

DEPLOYMENT — REQUIRED ORDER
1. Make a full Supabase backup / export first. This job permanently deletes old rows.
2. Run supabase_4_month_retention_v265.sql once in Supabase SQL Editor as postgres. Ensure pg_cron is enabled in Supabase Database > Extensions. If pg_cron is unavailable, enable it and rerun the schedule statements.
3. Verify schedule: SELECT jobid, jobname, schedule, command FROM cron.job WHERE jobname='ais-tracker-4-month-retention';
4. Verify logs: SELECT * FROM public.ais_retention_runs ORDER BY run_at DESC LIMIT 10;
5. Deploy index.html, script.js and style.css from this package to the existing GitHub Pages repository. Keep the image assets and previous SQL files.
6. Hard refresh the website (Ctrl+F5), open Cardboard Stock and Extrusion Stock, and compare current balances with the pre-migration backup / notes.
7. After confirming stock totals, the next scheduled job will automatically remove records older than four months. To run immediately after backup, execute SELECT public.run_ais_4_month_retention();

SAFETY / LIMITATIONS
- The SQL is an additive migration; it does not drop or truncate existing tables.
- It cannot be run from this chat because the Supabase project is not connected here. You must run the SQL migration in your Supabase project.
- The actual schema was checked against the V264 frontend and included SQL migrations. Confirm the exact production database column definitions before running the destructive scheduled job.
- Test first on a Supabase branch/staging copy. Keep an external backup for records that must be retained for legal, audit, or customer requirements.
