AIS Tracker — Safe Multi-profile Crate Rename Fix

Purpose:
- Fix crate renaming so every Packing List row belonging to the selected crate is renamed together.
- Update database rows by exact primary-key ID, not by a broad crate-label filter.
- Preserve PO, profile, item code, length, quantity, weights, date, PL number and all other row values.
- Prevent merging into an already-existing crate number (including labels such as "2" vs "Crate 2").
- Preserve the existing completion marker when possible.
- If a database update fails partway through, attempt to roll back only rows changed by this operation and reload saved data.
- No schema changes, table deletes, or bulk record resets.

Validation:
- JavaScript syntax check passed.
- Duplicate HTML IDs check passed.
- CSS structure check passed.
- Local asset references check passed.
- ZIP integrity check passed.

Important:
- This package fixes future crate-number edits; it does not automatically repair any rows that were already changed in a previous operation.
- Live Supabase/browser end-to-end testing was not performed. Back up website and database before deployment.
