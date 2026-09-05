# CRM branch-attributed tables

This audit defines the source and list behavior for the requested CRM tables. `ALL BRANCHES` is a read scope over the authenticated user's accessible locations; it is never an operational location.

| Page | Authoritative branch source | ALL behavior | Specific behavior | NULL policy |
| --- | --- | --- | --- | --- |
| Commission logs | `staff_commission_logs.store_location_id`, persisted when the earning/monthly-sale action is logged | Accessible union plus legacy unassigned rows; show Branch | Authorized selected location only; hide Branch | `Unassigned` in ALL; excluded in specific |
| Staff consumables | Claim Order's `orders.store_location_id` | Accessible Order history; show Branch | Authorized selected Order location only; hide Branch | Existing dedicated flow excludes NULL orders |
| Stock movement revoke | `product_stock_movements.store_location_id` ledger attribution | Accessible movement union under the report scope; show Branch | Authorized selected movement location only; hide Branch | Existing report-scope compatibility policy is preserved |
| Booking logs | Related persisted Booking's `bookings.store_location_id` | Accessible Booking logs plus system/legacy logs whose `booking_id` is NULL; show Branch | Logs for Bookings at the authorized selected location; hide Branch | NULL booking attribution is `Unassigned` in ALL and excluded in specific |
| Leave requests | Global per Staff; no location column in the leave schema | Global leave-domain list; no fabricated Branch | Same global list; no Branch column | Not applicable |
| Leave balances | Global per Staff and leave type | Global leave-domain list; no fabricated Branch | Same global list; no Branch column | Not applicable |
| Leave logs | Global per Staff / leave request | Global leave-domain list; no fabricated Branch | Same global list; no Branch column | Not applicable |

Branch labels use only joined `store_location.name`. A NULL persisted attribution renders `Unassigned` where the compatibility policy includes it. A non-NULL foreign key whose metadata cannot be resolved renders `Unknown Branch`; the header selection is never used as a display fallback. All metadata is eager-loaded with the list query, avoiding per-row branch lookups.

Commission attribution does not use current Staff assignment. Consumables remain on the dedicated Order-item claim query and are not authorized by Staff ID. Stock revocation continues to authorize the selected ledger movement's own location. Booking-log attribution never uses actor, Staff, Customer, or header identity.
