AIS TRACKER V2.45 — TEAM PLAN VS ACTUAL REPORT UPDATE

Changes:
- Removed the Report View selector and Shift filter from the Team Plan vs Actual report.
- The report defaults to the selected month (current month when no month is selected).
- Selecting a Production Date switches the report to that exact date; changing Month clears the date filter and returns to monthly view.
- Team A, Team B and Team C have separate selectable report sheets with an individual print action.
- Each team report shows Cut, Punch and Wrapping only, including Plan PCS, Actual PCS, Additional PCS, variance, Plan Weight, Actual Weight and Additional Weight.
- Additional production is classified as actual Cut/Punch/Wrapping quantity where the corresponding team/date-period/profile/item/length/shift stage has no plan quantity. It is shown separately in blue.
- Team cards and charts include team-specific plan, actual and additional production. Weight calculations use an unambiguous Master Catalog unit weight.
- New locally inserted history entries now retain itemCode in memory to improve plan-to-actual matching.

Data protection:
- No existing Supabase table, column, row, or migration was changed or added in this update.
- Existing Production, Packing List, Stock, Crate Planning, Extrusion and Reject modules were not intentionally modified.

Checks:
- JavaScript syntax checked with node --check.
- ZIP integrity checked after packaging.
- Static HTML structure and duplicate IDs checked.
- Live Supabase and real-browser testing were not performed in this environment.

Important calculation note:
- Additional production means stage production entered where that stage has no matching plan quantity. It does not automatically classify the amount exceeding a non-zero plan as additional. Stage activity PCS/weight can count the same physical profiles at multiple stages and should not be interpreted as unique finished production.
