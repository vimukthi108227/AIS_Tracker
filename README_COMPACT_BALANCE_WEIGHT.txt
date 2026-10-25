AIS Tracker — Compact Current PL Shipment Balance Table

UI changes:
- Reduced the balance table to 11 columns: PO, Profile, Item Code, Length, Required PCS, Already Shipped PCS, Shipment Balance PCS, Shipment Balance Weight KG, Current PL PCS, Balance After Current PL PCS, Status.
- Removed repeated non-essential weight columns from the table; Shipment Balance Weight (kg) remains prominently highlighted.
- Compact teal/navy theme, clear spacing, tabular numeric alignment, responsive horizontal scrolling, and a highlighted balance-weight column.
- KPI cards now avoid redundant Current PL and post-PL weight figures; pending shipment balance KPI continues to show PCS and KG.
- Shipment Balance PCS remains clickable to open shipment detail.
- No database schema or records are modified.
Validation: JavaScript syntax, HTML duplicate IDs, CSS brace balance, and ZIP integrity checked. Live Supabase end-to-end test not performed.
