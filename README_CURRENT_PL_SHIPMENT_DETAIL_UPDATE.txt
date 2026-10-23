AIS Tracker — Current Packing List Only + Clickable Shipment Breakdown

Changes:
1. Current PL vs Shipment Balance now displays only PO/Profile/Item Code/Length lines found in the active current Packing List. PO lines not in the current PL are no longer included.
2. Click a Shipment Balance quantity to show saved shipment totals grouped by shipment month and container (1st, 2nd, 3rd Container), including shipment dates, quantity and record count.
3. Shipment detail panel has a dedicated Print Shipment Details button. The main current-PL table retains its own Print option and Excel export.
4. Master Catalog is used to resolve Item Code when the PL or shipment row lacks it, where an unambiguous match exists.
5. No database schema migration, data deletion or data update is included.
6. Previous Day/Night Wrapping chart change is retained.

Calculations:
- Shipment Balance = PO Required - Already Shipped (as recorded in Production Orders / Shipment Tracker).
- Balance After Current PL = Shipment Balance - Current active PL quantity.
- Shipment details are grouped by the saved shipment month and container name; they reflect existing shipment records.

Deploy:
- Back up the repository and database first.
- Extract this ZIP and upload root website files to the GitHub repository root.
- Hard refresh with Ctrl+F5.
- Verify known PO/Profile/Item/Length values against Production Orders and Shipment Tracker before operational use.

Validation:
- JavaScript syntax and ZIP integrity checks passed.
- Live GitHub Pages/Supabase end-to-end test not performed.
