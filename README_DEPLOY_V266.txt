AIS TRACKER V266 — BOX / PCS CALCULATION FIX

The Daily Production Box entry supports two-way input:
- Enter Boxes: PCS = Boxes × Master Catalog PCS/Box.
- Enter PCS: equivalent Boxes = PCS ÷ Master Catalog PCS/Box.
- Both values are shown before saving.
- Saved Box Stage stock remains stored as PCS, consistent with the existing database.
- Cardboard consumption uses whole physical boxes required (ceil(PCS / PCS per box)).
- Stock Summary Packed Boxes and other box requirement calculations use the same Master Catalog capacity resolver.
- Admin stock edit supports PCS <-> equivalent Box conversion using the same capacity.

Capacity resolver reads explicit pcs_per_box / pcs_for_box / pcs_for_box_qty / pcs_box fields,
then local saved capacity, then existing box_capacity. It falls back to 100 only if no valid
capacity is present. Duplicate catalog keys do not let a 100 fallback mask a real capacity.

Example: Master Catalog capacity = 48 PCS/Box.
- 11 Boxes entered -> 528 PCS preview and saved Box Stage movement.
- 528 PCS entered -> 11.000 equivalent Boxes.
- 500 PCS entered -> 10.417 equivalent Boxes; cardboard required = 11 physical cartons.

IMPORTANT DATA SAFETY:
- Existing Supabase stock/history records are not rewritten or bulk adjusted.
- The 1,100 PCS already stored in the screenshot row is left untouched by this package.
  If that saved balance was created from an earlier incorrect 11 x 100 calculation,
  Admin should confirm the true balance and adjust that one Box Stage balance to 528 PCS.
- All unrelated PO, shipment, crate, stock and history records remain unchanged.
- No SQL migration is required.

DEPLOY:
1. Back up the existing GitHub repository and Supabase database.
2. Replace index.html, script.js, style.css and retain existing image/assets/SQL files.
3. Commit/push to the existing GitHub Pages branch.
4. Hard refresh with Ctrl+F5.
5. Confirm Master Catalog capacity for profile 1047 / RP-M4TC36 is 48.
6. In Production Entry select the exact profile/item/length. Enter 11 in Boxes: PCS must show 528.
7. Alternatively enter 528 PCS: Boxes must show 11.000.
8. Verify Current Stock after a genuine saved production movement. Do not save a test movement in live production unless authorized.

STATIC VALIDATION:
- Node --check script.js
- No duplicate HTML IDs
- Calculation checks: 11*48=528; 528/48=11; 500/48=10.417.
