AIS Tracker — Cascading Profile / Item Code Filter + Elegant UI

Changes:
- Filter Item Code is now dependent on the selected Profile.
- If a PO is selected, Profile choices are limited to that PO; Item Code choices are limited to the selected PO and Profile.
- Changing Profile rebuilds the Item Code list and preserves the selected item only if it is still valid.
- No data records, schema, shipment calculations, current PL logic, or chart data are changed.
- Current PL vs Shipment Balance controls, KPI cards, and table receive refined spacing, typography, focus states, and professional styling.
- Existing smart/elegant font settings and previous PO matching / shipment detail functionality are retained.

Validation:
- JavaScript syntax check passed.
- HTML duplicate ID check passed.
- CSS brace balance checked.
- ZIP integrity checked.
- Live Supabase end-to-end testing was not performed.
