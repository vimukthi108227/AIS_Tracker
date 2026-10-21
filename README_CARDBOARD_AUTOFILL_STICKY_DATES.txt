AIS Tracker - Cardboard Master Catalog Auto-fill & Sticky Dates Update

Changes:
1. Cardboard Stock > Add / Consume Cardboard Stock Manually:
   - Enter/select Material Code from Master Catalog.
   - If that code maps to one profile, profile is selected automatically.
   - If that profile/material combination maps to one item code, item code is selected automatically.
   - If the selected profile/item/material combination maps to one length, length is selected automatically.
   - If multiple valid choices exist, the app leaves the ambiguous choice for the user to select safely.
   - Material matching ignores leading/trailing spaces and letter case.
2. Cardboard transaction date remains selected after save and is remembered for the browser session.
3. Manual Cardboard Data date remains selected after save/clear and is remembered for the browser session.
4. Reject Entry preserves the manually selected date, shift, team, and location after each successful save; these values are also restored from session state.
5. Existing Enter-key and duplicate-submit protection remains in the source.

Data safety:
- No Supabase schema changes.
- No existing records are deleted or migrated by this update.
- Manual Cardboard Data remains reference-only and does not modify current cardboard stock.

Verification:
- JavaScript syntax check performed with Node.js.
- ZIP integrity check performed.
- Live browser/Supabase transaction testing was not performed in this environment.
