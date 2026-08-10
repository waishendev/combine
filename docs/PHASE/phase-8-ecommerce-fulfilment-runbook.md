# Phase 8 Ecommerce fulfilment and inventory cutover runbook

## Deployment decision and stop condition

Phase 8 delivers deterministic pickup and shipping fulfilment, but **does not activate Branch Inventory in production**. Shipping ownership is now resolved by configured priority and active-state Ecommerce reservations are Branch-aware and idempotent. POS stock checkout and CRM stock adjustment still contain legacy global writers, so coordinated activation remains blocked. Operators must not edit `branch_inventory_cutover_states.status` manually.

The system remains one shared Ecommerce website. Browsing, Product identity, Voucher, Redeem Voucher, Package entitlement, and Points are global. Customers browse and build a cart before choosing fulfilment. No tenant, organization, or `tenant_id` was added.

## Current stock-flow re-audit matrix

| Flow | Current source | Reservation timing | Branch known | Identity / bundle | Release or restore | Idempotency | Phase 8 behavior |
|---|---|---|---|---|---|---|---|
| Public preview | active Branch inventory | none | pickup selected; shipping routed | exact Variant; bundle components | n/a | read-only | whole-cart Product assignment and Branch balance check |
| Checkout/order creation | Branch inventory when active; legacy global before cutover | inside Order transaction | pickup customer-selected; shipping priority-selected | locked exact rows; deterministic component expansion | transaction rollback | reservation/movement keys use Order + identity | one Branch is persisted and reserved exactly once |
| Billplz/manual pending | already decremented selected Branch | order creation | persisted Order fields | reservation snapshot identity | expiry job restores original Branch | movement/reservation idempotency key | callbacks never infer Branch or deduct twice |
| Paid finalization | selected Branch already reserved | no new reservation | persisted Order | Order items | none | payment transition guards | payment does not make a second physical deduction |
| Expired/failed/abandoned | original reservation Branch | n/a | persisted reservation | exact Product/Variant/components | `ecommerce:expire-pending-orders` | release key and reservation status | release restores the original Branch once |
| Customer/admin cancellation | original reservation Branch | n/a | persisted reservation | exact Product/Variant/components | centralized reserve service | locked Order and reservation status | repeated cancellation cannot restore twice |
| Monetary refund | global fields unchanged | n/a | may be known | no line quantities | no automatic restock | payment ledger behavior | intentionally no guessed stock restoration |
| Redeem Product | no stock mutation at initial claim; final fulfilment authority at checkout | physical checkout | final pickup or shipping Branch | exact reward Product/Variant | same Order release path | Order reservation identity | initial claim stays Branch-free; physical stock is deducted once |
| POS/CRM adjustments | legacy global fields and movement paths | operation-specific | POS/CRM Branch known | Product/Variant/bundle paths differ | operation-specific | incomplete across writers | unchanged; cutover blocker |

## Self-pickup rules

Only active, pickup-enabled StoreLocations are public choices and their stored names are displayed. The selected location must fulfil the **entire physical cart**; an Order is never split across locations. Checkout requires both the Phase 6A Product-to-Branch assignment (`is_available`) and sufficient exact `store_location_product_inventories` candidate quantity.

Validation is repeated (1) during preview, (2) after server-side totals/items are rebuilt before Order creation, and (3) under row locks inside the Order transaction immediately before the canonical Branch reservation. Errors are HTTP 422 validation responses with `store_location_id` plus public `unavailable_items` entries containing cart Product/Variant identity, a stable public code, and a non-internal message.

Changing Branch before Order creation performs a fresh validation and creates no persistent reservation, so there is no old Branch hold to leak. Once an Order exists, its Branch is immutable through public checkout; starting another checkout does not rewrite the existing Order.

### Variant and bundle rules

Variant lines use the exact Branch + Product + Variant inventory row. Another Variant or Branch cannot satisfy the requirement. Bundle stock is not authoritative itself: components are expanded, duplicate component requirements are summed, and every component is checked at the one selected Branch. The transaction aborts before an Order can be partially created.

## Reservation, concurrency, callback, and release model

For an `active` Branch, `store_location_product_inventories` is the sole operational Ecommerce authority. `order_inventory_reservations` records exact Branch/Product/Variant quantities, source Order, expiry, status, and idempotency identity. The canonical mutation boundary locks every row, validates the whole mutation set before changing balances, and projects totals across active inventory locations into legacy global fields for bounded reader compatibility. It does not independently deduct that projection. Before coordinated activation, the legacy global path remains production compatibility behavior.

Billplz and payment handlers use the persisted Order and do not receive Branch from CRM Header state. Repeated paid callbacks must rely on the existing payment-state idempotency and do not perform another reservation. Expiry and eligible cancellation restore exact Order item identities through `OrderReserveService`; Product reward lines now participate in reservation and restoration. Partial monetary refunds remain money-only because current requests do not provide deterministic line quantities.

Redeem Product remains selectable without Branch. In the current lifecycle it becomes a physical checkout Order item. At Order creation, the customer-selected pickup Branch or system-selected shipping Branch is persisted to `loyalty_redemptions.store_location_id` and supplies the one physical stock deduction.

## Delivery decision

Shipping does not expose Branch selection to the customer. Authorized administrators store an ordered list of Branch IDs in `ecommerce.shipping_fulfillment_priority`. The router checks active configured Branches in that exact order and selects the first that can fulfil the entire physical cart. It never queries an unconfigured fallback, combines Branch quantities, uses CRM Header state, or hardcodes PNG. Shipping persists `pickup_store_id = NULL` and the selected fulfilment Branch in `store_location_id`.

## Promotion versus Voucher

Promotion remains one global identity and retains its existing Product, tier, active, priority, and date rules. `is_online_enabled` controls the shared Ecommerce channel; the separate `promotion_store_location` pivot controls the physical POS Branches. POS enforces the persisted cart Branch in the backend. Fulfilment routing never changes Online eligibility. Voucher and Redeem Voucher remain global and use no Promotion pivot or Branch eligibility rule; deterministic Branch is attribution only.

## Ledger and compatibility status

`ProductStockMovement` is the active-Branch canonical balance ledger and legacy `StockMovement` history is preserved. Legacy global fields become aggregate projections across active inventory locations after canonical mutations. Because POS and CRM adjustment writers are not fully converted, activation is still refused operationally and those global fields remain pre-cutover authority until a coordinated later deployment step.

## Reconciliation and write-freeze procedure

Do this on a production-like copy first. A maintenance/write-freeze window is required; zero downtime is not promised.

1. Pause Ecommerce checkout, POS Product sales, reward Product fulfilment, CRM adjustments, cancellations/restocks, and inventory jobs.
2. Inventory operators enter and independently approve real physical quantities for every Branch. The current single-Branch backfill command is **not suitable for multi-Branch allocation** because it compares one selected Branch with the complete global balance.
3. Run `php artisan branch-inventory:backfill --store-code=PNG --dry-run` only as a legacy diagnostic, never as allocation instructions.
4. Review Product, exact Variant, bundle-component, open reservation, and both-ledger totals.
5. Resolve every discrepancy; tolerance is zero.
6. Do not run `--force` for multiple physical Branches: it can duplicate the global total into each Branch.
7. **Stop. Do not activate.** POS/CRM writer conversion remains unresolved.
8. Resume traffic only on the pre-cutover authority and verify balances.

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

- Candidate Branch balances can drift while the remaining POS/CRM legacy writers mutate only global fields; reconciliation and a write freeze are mandatory.
- Monetary partial refunds lack line quantities.
- POS/CRM ledger migration is incomplete; mixed cutover states are unsafe.
- Full frontend disabled-Branch explanations are not introduced; backend preview is authoritative.

## Phase 9 deferrals

Dashboard and Sales Report aggregation, broad commission reporting, active-Branch low-stock UI, Branch-aware CRM/POS display migration, stock transfer workflow/approval, per-Branch pricing, and the final POS/CRM all-writer ledger cutover remain deferred. No Phase 9 work, multi-tenancy, organizations, or tenant IDs are included.
