# Phase 4 transaction Branch attribution: production runbook

## Scope and re-audit record

Phase 4 adds nullable business attribution to `orders` and `bookings`; it does not alter pickup attribution. Public Booking completion also adds nullable `booking_carts.store_location_id` so the server, rather than a second client-supplied Order value, owns the checkout attribution context. The current-code audit found public ecommerce creation in `PublicCheckoutController`, public booking cart conversion in `Booking/CartController`, staff/POS booking and order creation in the large `PosController`, and booking deposit order creation in `BookingPaymentLinkService`. Payment callbacks mutate existing transactions rather than choosing their Branch.

| Order path | Current owner | Safe Branch evidence | Phase 4 behavior | Deferred |
|---|---|---|---|---|
| Ecommerce self pickup | `PublicCheckoutController::createOrder` | validated active pickup destination and explicit pickup method | stamps business Branch while retaining pickup destination | confirm whether all future fulfilment models retain this equivalence |
| Ecommerce delivery | `PublicCheckoutController::createOrder` | none | remains NULL | delivery ownership rule |
| Public booking cart order | `Booking/CartController::checkout` | validated Branch persisted on the booking cart | order and every Booking inherit the cart Branch | service/staff/schedule filtering remains Phase 5 |
| CRM/POS appointment deposit | `PosController::createAppointment` | authenticated selected Branch, server-authorized and capability checked | booking and deposit order receive the same Branch | remaining POS cart/order conversion in Phase 6 |
| Booking payment-link deposit | `BookingPaymentLinkService` | persisted Booking attribution | order inherits Booking Branch | NULL Booking produces NULL Order |
| Other POS checkout/manual orders | `PosController` | POS cart is not yet Branch-owned | remains NULL | Phase 6 POS conversion |
| Refund/cancel/webhooks | order/booking payment controllers and services | persisted parent | attribution is immutable/unmodified | none in Phase 4 |

| Booking path | Current owner | Safe Branch evidence | Phase 4 behavior | Deferred |
|---|---|---|---|---|
| CRM/POS appointment | `PosController::createAppointment` | Phase 3 selected Branch | required, authorized, active, booking/POS capable | service/staff schedules by Branch |
| Public hold/cart checkout | `HoldController`, `Booking/CartController` | customer-selected active booking-enabled Branch | cart add validates and persists one Branch; checkout revalidates and stamps every Booking | Phase 5 service/staff/schedule filtering |
| Existing appointment settlement | `PosController` | persisted Booking when available | derived orders inherit where converted; otherwise compatible NULL | full Phase 6 settlement audit |

## Compatibility and authorization

Converted CRM reads use `branch_store_location_id` for a specific Branch and `branch_scope=all` for All Branches. The distinct parameter deliberately preserves the old ecommerce `store_location_id` pickup filter. A specific Branch returns only attributed rows (never NULL). All Branches returns attributed rows in the caller's accessible active Branch IDs plus legacy NULL rows. Direct show permits NULL temporarily under existing action permission, but independently authorizes every attributed transaction through `StoreLocationAccessService`. This temporary NULL exception must be removed only after reconciliation.

Responses add `store_location_id` and the minimal `{id,name,code}` `store_location`. Pickup fields and relationships remain separate. Expenses, reports/KPIs, inventory, staff/service scheduling, public booking selection, and multi-tenancy are deferred.

## Deployment

1. Back up the database and confirm Branch codes/capabilities and `store_location_user` assignments.
2. Deploy backend before the CRM and put workers into the normal deployment restart cycle.
3. Run `php artisan migrate --force`.
4. Confirm the Order, Booking, and Booking-cart attribution columns are nullable and their foreign keys restrict Branch deletion.
5. Run **only** `php artisan branch-transactions:backfill --store-code=PNG --dry-run` (replace `PNG` with the operator-approved existing active Branch code).

Expected output includes selected Branch, already attributed and NULL totals, booking default candidates, orders derived from Booking, safely derived self-pickup orders, ambiguous/default candidates, unresolved and invalid-reference counts, and the explicit ZERO-write banner.

Reconcile samples from every category. In particular, review delivery, public booking-cart, historic POS/manual, and mixed orders. Confirm `pickup_store_id` values before and after are identical. Obtain business approval for the booking default before writes.

The production command is `php artisan branch-transactions:backfill --store-code=PNG --force`. **Do not run it until the dry-run is approved.** It defaults NULL bookings to the operator-selected Branch, assigns orders from linked attributed bookings first, assigns explicit self-pickup orders from their pickup Branch, never defaults ambiguous orders, and never overwrites attribution.

## Verification and rollback

After an approved write, repeat the dry-run; changed categories should be zero while unresolved ambiguous orders remain NULL. Verify counts by Branch, direct access with Branch A/B users, order and booking history, public checkout, booking shop, POS, and that pickup IDs did not change.

Application rollback is safe while columns remain. Do not roll back the migration after attribution writes because dropping the columns discards reconciled attribution. If rollback is required before any writes, run `php artisan migrate:rollback --step=1`. After writes, restore the database backup or retain the additive columns and roll back application code. The backfill is idempotent but intentionally has no destructive "undo" command.

The public Booking Shop now selects Branch attribution before service selection. Changing Branch navigates back to a clean Branch-only URL, which discards service, add-on, date/time, technician, and availability query state. A booking cart can contain appointment lines for only one Branch, and checkout revalidates that Branch. This is attribution only: services, staff, schedules, and availability are deliberately still global until Phase 5 (the Branch ID is carried additively on availability requests but is not used to filter results).

Known unresolved rules: delivery ownership, ambiguous historic POS/manual orders, expenses, and whether every future pickup fulfilment model implies business ownership. No inventory or multi-tenancy work is included, and no production backfill was executed during implementation.
