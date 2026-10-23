AIS Tracker — Current PL vs Shipment Balance

New Packing List sub-tab: Current PL vs Shipment Balance.

For each PO + Profile + Master Catalog Item Code + Length:
- PO Required PCS
- Already Shipped PCS
- Shipment Balance = PO Required - Already Shipped
- Current active Packing List PCS
- Balance After Current PL = Shipment Balance - Current PL PCS
- Negative balance is shown as over-packed, not silently clamped.
- PO lines without current PL quantity remain visible.
- Current PL rows without a matching PO are also visible as unmatched.

The view uses existing in-memory Production Orders, Shipment History, Packing List and Master Catalog data. It is read-only and does not alter existing records or schema. Existing Packing List view remains available in its own tab. Day/Night Wrapping chart behavior from the previous update is retained.

Deploy:
1. Back up the repository and database first.
2. Extract this ZIP and upload the root website files to the repository root.
3. Hard refresh with Ctrl+F5.
4. Test in a separate browser session with known PO, shipment and current PL lines.
5. Check the unmatched PO line warning; do not use this table as a replacement for source records.

Validation:
- JavaScript syntax check and ZIP integrity check performed.
- Live GitHub Pages/Supabase end-to-end test not performed.
