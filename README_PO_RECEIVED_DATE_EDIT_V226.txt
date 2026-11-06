AIS Tracker - PO Received Date Edit (V2.26)

Update:
- Production Orders > Individual PO Fulfillment Status cards display the PO date.
- Admin users can click Edit date and enter the date the PO was actually received (YYYY-MM-DD).
- The date update applies to every saved production_orders row with the same PO number, preserving PO quantities, profiles, lengths, shipments, stock and all other records.
- The PO cards, PO filters, Production Order table, Dashboard and Balance Work are refreshed after a successful update.
- The existing Undo Last Change workflow is registered for the date update.
- No database schema changes or data migrations are included.

Validation:
- Run node --check script.js before deployment.
- Back up the current website and database before replacing website files.
- Test the date edit against the live Supabase environment with an Admin account before production use.
