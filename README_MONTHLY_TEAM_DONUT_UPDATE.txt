AIS Tracker – Monthly Team Doughnut Chart (Rechecked)

What was rechecked/fixed
- The Team A/B/C doughnut chart now shows a neutral placeholder ring when all team totals are zero, instead of a large blank chart area.
- The centre reads “NO TEAM DATA” and the month total remains 0.00 kg until there are saved Daily Production history rows with Team A/B/C assignments.
- A clear note explains that a Team must be selected in Daily Production Entry and saved for future entries to appear in the chart.
- When team-assigned records exist, the doughnut shows the actual monthly weight share by Team A, Team B and Team C, including kg and percent in tooltips and summary cards.
- The chart uses saved history_logs rows for the selected month and Master Catalog unit weights.

Important data limitation
- The current screenshot showed 432 historical records for the month with no Team assignment. Their team cannot be inferred accurately from the saved data. They are left unchanged and excluded from Team A/B/C totals; no team assignment is fabricated.
- Daily Production Entry already includes a Team selector. New rows save the selected team into history_logs.team.
- If the Supabase history_logs table does not yet have a team column, run supabase_add_team_to_history_logs.sql once in Supabase SQL Editor before saving new team-tagged production entries. It only adds the column if missing and does not delete or rewrite existing rows.

Calculation
- Stage-activity weight = Cut + Punch + Wrapping + Box, using saved daily quantities and Master Catalog unit weights.
- The same physical pieces may be counted at more than one stage, so this is stage-activity contribution, not unique finished-product weight.

Safety/checks
- No existing history rows are deleted or rewritten by this update.
- No table or column is dropped.
- JavaScript syntax check passed.
- ZIP integrity checked.
- Live GitHub/Supabase end-to-end test was not performed.
