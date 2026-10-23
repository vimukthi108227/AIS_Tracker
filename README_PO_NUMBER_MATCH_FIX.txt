AIS Tracker — Production Order / Current PL PO Matching Fix

Issue:
- A Production Order may contain PO number such as "PO 363760", while the Packing List contains "363760".
- Exact string matching incorrectly marked the current PL line as unmatched and showed zero shipment balance.

Fix:
- Normalize PO numbers for matching by removing a leading "PO" prefix and whitespace/separator characters.
- Match still requires the same PO, Profile, Master Catalog Item Code, and Length.
- The current Packing List PO display text remains as entered.
- Shipment detail lookup uses the same PO normalization.
- No database data or schema is modified. The report remains read-only and current-PL-only.
- Existing Day/Night Wrapping chart and other pages are retained.

Deploy:
1. Back up current website and database.
2. Extract ZIP and upload the website root files to GitHub repository root.
3. Hard refresh with Ctrl+F5.
4. Verify PO 363760, Profile 1043, Item Code RP-VSPPIL58, Length 1474.8 mm against Production Orders and Shipment Tracker.
5. Confirm Balance After Current PL equals Shipment Balance minus current PL quantity.

Validation:
- JavaScript syntax check and ZIP integrity check performed.
- Live Supabase end-to-end test not performed.
