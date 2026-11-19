AIS TRACKER - TEAM PERFORMANCE V304 VERIFIED FIX

Root cause found from the user's screenshot:
- The Team Performance renderer called periodLabelSafe(), but that helper function
  was missing from the deployed V303 script.
- The monthly detail renderer also called teamPerfEscape(), which was also missing.
- The first ReferenceError stopped the render function before summary, team cards,
  monthly tables and chart updates could be completed.

Corrections:
1. Added the missing periodLabelSafe() helper.
2. Added the missing teamPerfEscape() HTML escaping helper.
3. Kept the existing Team Performance calculation and reporting logic intact.
4. Kept the automatic month default and existing render error handling.
5. Updated HTML cache-busting version to V304 so browsers fetch the corrected JS/CSS.
6. Kept all four existing chart canvases and their chart rendering code.

Data logic retained:
- Planned process quantities and actual process quantities are matched by date, shift,
  team, profile, item code and length.
- If a process has a plan, its actual quantity is compared against that plan:
  actual minus plan = variation. For example, plan 1,000 and actual 800 = -200 PCS
  / -20% shortfall.
- Actual process quantities with no matching planned quantity for that process are
  shown separately as unplanned PCS and weight; they are excluded from plan achievement.
- Team A, Team B and Team C monthly tables remain separate.
- Existing per-team Excel export and inline plan editing remain.
- Weight values continue to use the Master Catalog's unique unit-weight match;
  ambiguous/missing weights are not guessed.

Validation performed:
- Node JavaScript syntax check passed.
- Smoke test using the app's mapped daily_team_plans/history_logs record shapes passed.
- Test verified the monthly summary, all three team cards, all three monthly tables,
  a planned Punch shortfall of 1,000 planned vs 800 actual (-20%), and 200 PCS of
  unplanned Wrapping.
- Chart smoke test verified all four Chart.js chart instances are created when Chart.js
  is available.
- ZIP integrity check passed.

Data safety:
- Frontend-only change. No Supabase records, tables, policies, production history,
  team plans, stock records or SQL files were modified.
- No SQL migration is required.

Deployment:
1. Back up the current GitHub repository first.
2. Replace index.html, script.js and style.css with the V304 files.
3. Keep all image assets and SQL files from the package.
4. Commit and push to GitHub Pages.
5. Wait for GitHub Pages deployment, then hard refresh with Ctrl+F5.
6. Select November 2026 (or the required month), click Refresh, and check the cards,
   charts and Team A/B/C monthly tables.

Note:
This package has passed local static and renderer smoke tests. A live test against the
user's authenticated Supabase account cannot be performed from this local build.
