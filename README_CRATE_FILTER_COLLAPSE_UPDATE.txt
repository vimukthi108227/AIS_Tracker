AIS Tracker – Crate Readiness Filters & Compact Cards Update

Updates:
- Raw Packing List Logs filters are dropdown selectors for PO Number, Profile, and Item Code.
- Dropdown values are derived from records in the currently selected active Packing List container.
- Multiple filters work together and use exact matches. Clear Filters resets all three selectors.
- Crate Readiness cards are collapsed by default to make the page shorter and easier to scan.
- Each crate has a View items / Hide items control with a short reveal animation.
- Expand All / Collapse All controls expand or collapse all currently filtered crates.
- Existing data fields, database schema, and saved records were not changed by this UI-only update.

Validation:
- JavaScript syntax check: passed with Node.js.
- ZIP integrity check: performed after packaging.
- Live Supabase / browser end-to-end testing was not performed. Back up the existing site before deployment.
