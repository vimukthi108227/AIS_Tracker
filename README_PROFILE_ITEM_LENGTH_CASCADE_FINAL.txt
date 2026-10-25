AIS Tracker — Profile / Item Code / Length Cascading Filters

Changes:
- Raw Packing List Logs now cascades PO -> Profile -> Item Code -> Length.
- Selecting a profile limits item-code options to that profile; selecting an item code limits length options to that profile/item combination.
- Added a Length filter to Raw Packing List Logs.
- Clear Filters resets the new Length filter too.
- Production Order filters now cascade PO -> Profile -> Item Code.
- Next PL planning filters now cascade PO -> Profile -> Length.
- Existing Current PL vs Shipment Balance, Cardboard Stock, and Reject filters retain their existing dependent-filter logic.
- No database schema, saved records, or operational data was changed.

Validation:
- Node syntax check
- HTML duplicate ID check
- CSS brace balance
- local asset references
- ZIP integrity
Live browser/Supabase end-to-end testing was not performed.
