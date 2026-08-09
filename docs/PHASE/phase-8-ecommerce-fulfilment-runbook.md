# Phase 8 Ecommerce fulfilment and inventory cutover runbook

## Deployment decision and stop condition

Phase 8 delivers the safe self-pickup foundation, but **does not activate Branch Inventory**. The re-audit found unresolved global delivery ownership, legacy ecommerce reservation/release writers, POS writers, monetary refunds without line quantities, and no independently idempotent reservation record. Mixed active/reconciled operation would therefore create dual authority. There is deliberately no `branch-inventory:activate` command in this release and operators must not edit `branch_inventory_cutover_states.status` manually.

The system remains one shared Ecommerce website. Browsing, Product identity, Voucher, Redeem Voucher, Package entitlement, and Points are global. Customers browse and build a cart before choosing fulfilment. No tenant, organization, or `tenant_id` was added.

## Current stock-flow re-audit matrix

| Flow | Current source | Reservation timing | Branch known | Identity / bundle | Release or restore | Idempotency | Phase 8 behavior |
|---|---|---|---|---|---|---|---|
| Public preview | Global Product/Variant | none | pickup only | exact Variant; bundle components | n/a | read-only | whole-cart Product assignment and Branch candidate balance check, then global check |
| Checkout/order creation | Global Product/Variant | before Order insert, in one DB transaction | pickup persisted on Order; delivery unknown | locked exact rows; deterministic component expansion | transaction rollback | one Order transaction | pickup Branch rows locked and revalidated; global reservation remains authoritative |
| Billplz/manual pending | already decremented global balance | order creation | persisted Order fields | Order items snapshot identity | expiry job restores | status transition under Order lock | callbacks never derive Branch from UI; no second stock deduction |
| Paid finalization | reserved global balance | no new reservation | persisted Order | Order items | none | payment transition/handler guards | unchanged; Branch candidate is attribution only |
| Expired/failed/abandoned | global Product/Variant | n/a | persisted pickup fields | exact Order items; bundle components | `orders:expire-pending` | locked eligible status prevents repeat | physical reward lines now restore with other Product lines |
| Customer cancellation | global Product/Variant | n/a | persisted Order | exact Order items | centralized reserve service where invoked | locked status | no Branch inference; known gaps remain blockers |
| Monetary refund | global fields unchanged | n/a | may be known | no line quantities | no automatic restock | payment ledger behavior | intentionally no guessed stock restoration |
| Redeem Product | global claim becomes an Order item | Order creation/physical checkout | pickup known only at fulfilment | exact reward Product/Variant | same Order release path | Order transaction | initial claim stays global; pickup Order persists redemption Branch and reserves global stock |
| POS/CRM adjustments | legacy global fields and movement paths | operation-specific | POS/CRM Branch known | Product/Variant/bundle paths differ | operation-specific | incomplete across writers | unchanged; cutover blocker |

## Self-pickup rules

Only active, pickup-enabled StoreLocations are public choices and their stored names are displayed. The selected location must fulfil the **entire physical cart**; an Order is never split across locations. Checkout requires both the Phase 6A Product-to-Branch assignment (`is_available`) and sufficient exact `store_location_product_inventories` candidate quantity.

Validation is repeated (1) during preview, (2) after server-side totals/items are rebuilt before Order creation, and (3) under row locks inside the Order transaction immediately before the global reservation. Errors are HTTP 422 validation responses with `store_location_id` plus public `unavailable_items` entries containing cart Product/Variant identity, a stable public code, and a non-internal message.

Changing Branch before Order creation performs a fresh validation and creates no persistent reservation, so there is no old Branch hold to leak. Once an Order exists, its Branch is immutable through public checkout; starting another checkout does not rewrite the existing Order.

### Variant and bundle rules

Variant lines use the exact Branch + Product + Variant inventory row. Another Variant or Branch cannot satisfy the requirement. Bundle stock is not authoritative itself: components are expanded, duplicate component requirements are summed, and every component is checked at the one selected Branch. The transaction aborts before an Order can be partially created.

## Reservation, concurrency, callback, and release model

Global `products.stock` / `products.stock_quantity` and `product_variants.stock` remain production authority. `OrderReserveService` obtains row locks and decrements inside the checkout transaction, preventing two transactions from consuming the same last global unit. Pickup candidate inventory rows are also locked for the final whole-cart revalidation but are **not decremented**; doing both would be an unsafe dual write.

Billplz and payment handlers use the persisted Order and do not receive Branch from CRM Header state. Repeated paid callbacks must rely on the existing payment-state idempotency and do not perform another reservation. Expiry and eligible cancellation restore exact Order item identities through `OrderReserveService`; Product reward lines now participate in reservation and restoration. Partial monetary refunds remain money-only because current requests do not provide deterministic line quantities.

Redeem Product remains selectable without Branch. In the current lifecycle it becomes a physical checkout Order item. At self-pickup Order creation the selected Branch is persisted to both Order attribution fields and `loyalty_redemptions.store_location_id`; delivery redemption attribution remains NULL.

## Delivery decision

Delivery has no deterministic fulfilment Branch rule. Phase 8 does not assign the first Branch, PNG, nearest Branch, pickup Branch, address-derived Branch, or CRM Header Branch. `orders.store_location_id` and `pickup_store_id` remain NULL for delivery. This unresolved global stock ownership is a hard activation blocker.

## Ledger and compatibility status

`ProductStockMovement` remains the candidate canonical Branch-aware ledger and legacy `StockMovement` history is preserved. This phase does not create duplicate ledger writes. Because not all operational writers have moved, the legacy global fields remain mutable authority and Branch inventory is validation-only. Low-stock and CRM global displays therefore retain global semantics; Branch-aware active-state display is deferred.

## Reconciliation and write-freeze procedure

Do this on a production-like copy first. A maintenance/write-freeze window is required; zero downtime is not promised.

1. Pause Ecommerce checkout, POS Product sales, reward Product fulfilment, CRM adjustments, cancellations/restocks, and inventory jobs.
2. Run `php artisan branch-inventory:backfill --store-code=PNG --dry-run`.
3. Review Product, exact Variant, and deterministic bundle-component totals.
4. Reconcile open Orders/reservations and their expiry/release eligibility.
5. Reconcile `ProductStockMovement` and retained `StockMovement` history against global balances.
6. Resolve every discrepancy; tolerance is zero.
7. Run `php artisan branch-inventory:backfill --store-code=PNG --force` only with approved change control.
8. Run `php artisan branch-inventory:backfill --store-code=PNG --dry-run` again and require zero discrepancy.
9. **Stop. Do not activate.** The Phase 8 blocker list above is unresolved.
10. Resume traffic and verify global balances and release jobs.

Apply the same procedure per real Branch code; never assume PNG is the only Branch.

### Commands

Safe read-only command:

```bash
php artisan branch-inventory:backfill --store-code=PNG --dry-run
```

Approved reconciliation write (documented, not executed by this implementation):

```bash
php artisan branch-inventory:backfill --store-code=PNG --force
```

Activation command: **none is shipped while stop conditions remain**. A future guarded command may use `php artisan branch-inventory:activate --store-code=PNG --dry-run` and `--force`, but those are reserved interface proposals, not executable Phase 8 commands. Never use SQL to bypass the guard.

## Rollback

Disable the new deployment and restore the prior application release; no Phase 8 schema rollback is required. Existing Orders retain deterministic pickup attribution. If an Order transaction failed, its stock changes rolled back with it. Before correcting balances, pause stock-changing traffic, reconcile global Product/Variant quantities against Order items and both movement ledgers, and make an audited adjustment through the existing global authority path. Do not copy candidate Branch quantities into global fields automatically.

## Compatibility risks and remaining blockers

- Candidate Branch balances can drift while legacy writers mutate only global fields; reconciliation and a write freeze are mandatory.
- There is no durable per-line reservation table with independent release idempotency keys.
- Delivery ownership is undefined.
- Some cancellation/void paths do not invoke centralized exact-quantity restoration.
- Monetary partial refunds lack line quantities.
- POS/CRM and reward/callback ledger migration is incomplete; mixed cutover states are unsafe.
- Full frontend disabled-Branch explanations are not introduced; backend preview is authoritative.

## Phase 9 deferrals

Dashboard and Sales Report aggregation, broad commission reporting, active-Branch low-stock UI, Branch-aware CRM/POS display migration, stock transfer workflow/approval, per-Branch pricing, a deterministic delivery-routing policy, and the final all-writer ledger/projection cutover remain deferred. No Phase 9 work, multi-tenancy, organizations, or tenant IDs are included.
