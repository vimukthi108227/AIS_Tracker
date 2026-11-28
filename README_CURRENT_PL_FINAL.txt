AIS TRACKER — CURRENT PL / PLANNER ACCESS FINAL UPDATE
======================================================

What changed
------------
1. Admin login:
   - After Supabase data sync, the Packing List page defaults to the latest
     month containing packing-list records and the highest-numbered container
     with records (for example, November / 3rd Container).
   - On a fresh page load, the same Current PL selector is used.
   - Admin can still select another month/container and view completed PL history.

2. Planner login:
   - Planner remains pinned to the Current PL only.
   - Planner sees no completed PL history and cannot switch to older PLs.
   - Planner remains read-only for editing and data-entry controls.

Validation performed
--------------------
- JavaScript syntax check: PASS
- Current PL selection simulation (November 1st + 2nd + 3rd): PASS
  Expected result: November / 3rd Container
- Role access, HTML references and local asset checks: PASS

Deployment
----------
1. Extract the ZIP.
2. Replace the existing repository website files with all extracted files.
3. Commit and push the changes to GitHub.
4. Open the deployed website and hard-refresh (Ctrl + F5).
5. Sign in as Admin and confirm the latest PL is selected.
6. Sign in as Planner and confirm only the Current PL is visible.

Important
---------
The checks above are local code/static and simulated-data checks. A live
Supabase login and production-data verification was not possible here.
No Supabase records or database schema were changed by this update.
