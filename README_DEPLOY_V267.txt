AIS TRACKER V267 — PROFILE/LENGTH-SPECIFIC PUNCHING BYPASS

Scope:
- Updated only the existing AIS Tracker front-end files (index.html, script.js, style.css).
- Preserved the V266 Box/PCS calculation fix and all bundled existing SQL/assets.
- No Supabase schema change or SQL migration is required.

Punching is NOT applicable to:
- Profile 1038: 2438.4 mm only
- Profile 1041: all lengths
- Profile 1042: all lengths
- Profile 1043: all lengths
- Profile 1046: 2438.4 mm only
- Profile 1047: all lengths
- Profile 1048: all lengths
- Profile 1090: all lengths

What changed:
1. Daily Production Entry:
   - Punch Plan input is hidden for the listed profile/lengths.
   - Actual Punching Qty input is hidden for the same combinations.
   - Wrapping is the next stage after Cut; stage labels renumber to 2, 3, 4.
   - Bypassed profile/length plans and production saves force Punch PCS to zero.
   - Existing non-bypassed profiles continue to use the original Cut -> Punch -> Wrap flow.
2. Current Stock Levels:
   - Punch cell displays N/A for the listed profile/length rows.
   - Punch cell is not clickable for those rows.
   - Admin stock edit modal disables the Punch stage option for those rows.
   - A direct attempt to save a Punch stock edit for a bypass row is rejected.
3. Existing data:
   - Existing daily plans, production history and Master Catalog stock are NOT bulk edited.
   - Any old Punch values remain stored. Current Stock total PCS continues to include any legacy Punch balance so existing totals are not silently reduced.
   - New plan/production entries for bypass rows store Punch quantity as zero.
4. Box/PCS:
   - Existing V266 two-way Boxes <-> PCS calculation is retained.

Deployment:
1. Back up the existing AIS_Tracker GitHub repository and Supabase.
2. Extract this ZIP.
3. Replace index.html, script.js and style.css in the existing AIS_Tracker repository root.
4. Keep all included Alumex image assets and existing SQL files.
5. Commit and push to the same GitHub Pages branch.
6. Open https://vimukthi108227.github.io/AIS_Tracker/ and hard-refresh with Ctrl+F5.

Validation performed:
- Node JavaScript syntax check passed.
- HTML ID uniqueness check passed (645 IDs, no duplicates).
- Bypass matrix checked:
  1038/2438.4 yes; 1038/other no;
  1041/1042/1043/1047/1048/1090 all lengths yes;
  1046/2438.4 yes; 1046/other no;
  1049/2438.4 no.
- Static checks passed for plan hide/save, actual hide/save, Current Stock N/A, and Admin edit guard.
- This is static source validation; live browser + Supabase end-to-end testing must be performed after deployment.
