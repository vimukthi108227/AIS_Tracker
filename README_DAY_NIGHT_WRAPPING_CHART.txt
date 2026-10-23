AIS Tracker — Daily Day/Night Wrapping Chart Update

Change made:
- In Dashboard > Monthly Daily Production by Stage (kg), the aggregate Wrapping bars are split into Day Wrapping and Night Wrapping.
- Both datasets use existing saved Daily Production History records and existing shift values.
- The monthly total banner still reports combined wrapping weight; other calculations and chart datasets are unchanged.
- No data/schema migration is included. No old records are edited or deleted.
- Cache-busting version updated in index.html so browsers fetch the revised script.

Deploy:
1. Back up the current repository files first.
2. Extract this ZIP and upload its root files to the GitHub repository root.
3. Hard refresh with Ctrl+F5.
4. Verify a selected month with both day and night production records.

Validation:
- JavaScript syntax check performed.
- ZIP integrity check performed.
- Live GitHub Pages/Supabase end-to-end test not performed.
