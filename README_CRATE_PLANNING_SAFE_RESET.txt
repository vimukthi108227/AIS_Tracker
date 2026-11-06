AIS Tracker — Safe Crate Planning Reset Update

What changed
- Added a Reset Crate Planning button in the Crate List Generate workspace.
- Reset requires explicit confirmation and reports the number of crate rows and profile allocations to be cleared.
- Clears saved crate allocations and crate-list state (local + the existing AIS_CRATE_PLAN_V1 cloud record).
- Clears legacy crate-plan cache to prevent old allocations from reappearing.
- Refreshes crate list, allocation totals, crate selectors and preview state.

What is intentionally preserved
- Active Next Planning PL data and source records.
- Production Orders and their quantities/dates.
- Master Catalog and Crate Master Data.
- Existing unrelated application pages and records.

After reset
- The existing Next Planning PL remains selectable.
- The user can reselect its profile/item/length and allocate the remaining PL quantities into new crates.

Safety
- No database schema changes or SQL migration.
- No deletion/update of Next Planning PL, Production Order, Master Catalog, or Crate Master Data records.
- Browser JavaScript syntax and ZIP integrity checks should be completed before deployment.
- Live Supabase synchronization still needs to be confirmed in the deployment environment.
