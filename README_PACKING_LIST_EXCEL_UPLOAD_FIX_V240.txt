AIS Tracker – Packing List Excel Upload Fix (V2.40)
====================================================

Problem found from the supplied screenshot and workbook:
1. The workbook contains multiple PO lines with the same crate/profile/item/length.
   The previous duplicate key omitted PO Number, so valid rows for different POs
   were incorrectly rejected as duplicate crate/profile/item entries.
2. Excel lengths can be rounded (for example, one decimal place) while Master
   Catalog lengths may retain greater precision. The previous exact length
   comparison could reject an otherwise uniquely identified profile + item.

Changes:
- Excel duplicate detection now includes PO Number as part of the row identity.
  Same crate/profile/item can therefore be recorded for separate POs.
- The duplicate check against existing Packing List records also includes PO
  Number, and selects that field for the read-only check.
- If exact profile + item + length does not match, the importer retries using
  profile + item only, but only accepts it when exactly one Master Catalog row
  exists. The Master Catalog length remains authoritative.
- If no matching Master Catalog item exists, upload still stops safely and
  tells the user to add the missing item to Master Catalog. No guessed unit
  weight or fabricated catalog record is created.
- Existing records are not updated or deleted. The upload remains all-or-nothing
  and checks for duplicates before inserting.

Workbook inspection:
- Supplied workbook has one sheet with 64 used rows.
- 62 data rows were detected after ignoring header/blank/subtotal rows.
- The sample includes repeated crate/profile/item combinations across different
  PO numbers; these are no longer considered duplicates by the updated key.
- The workbook contains a non-standard Excel styles.xml font family value that
  prevented Python openpyxl from reading styles, although its worksheet data
  could be inspected directly. The app's own upload parser had already read it
  far enough to produce row-level validation errors.

Validation:
- JavaScript syntax check passed.
- ZIP integrity check passed.
- Duplicate-key simulation on the supplied workbook passed (0 duplicates when
  PO Number is included).

Important:
- Live browser/Supabase upload was not performed. Missing items that truly do
  not exist in Master Catalog still need to be added there before upload.
- No database schema migration is included.
