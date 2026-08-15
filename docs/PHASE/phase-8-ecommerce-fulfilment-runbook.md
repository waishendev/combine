# Phase 8 Ecommerce fulfilment and inventory cutover runbook

## Deployment decision and stop condition

Phase 8 delivers deterministic pickup and shipping fulfilment and Phase 8C converts the final deterministic POS/CRM writers, but **does not activate Branch Inventory in production**. Activation requires independently reviewed complete physical counts, a write freeze, and the explicit coordinated readiness workflow. Operators must not edit `branch_inventory_cutover_states.status` manually.

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
| POS/CRM adjustments | Branch inventory when active; legacy global before cutover | POS checkout / explicit adjustment | persisted POS cart or required CRM Header Branch | exact Product/Variant; POS bundle components | original movement Branch | Order/line or movement identity | converted in Phase 8C; active paths use the canonical Branch boundary |

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

`ProductStockMovement` is the active-Branch canonical balance ledger and legacy `StockMovement` history is preserved. Legacy global fields become aggregate projections across active inventory locations after canonical mutations. Before coordinated activation, those global fields remain pre-cutover compatibility authority.

## Reconciliation and write-freeze procedure

Do this on a production-like copy first. A maintenance/write-freeze window is required; zero downtime is not promised.

1. Pause Ecommerce checkout, POS Product sales, reward Product fulfilment, CRM adjustments, cancellations/restocks, and inventory jobs.
2. Inventory operators enter and independently approve real physical quantities for every Branch. The current single-Branch backfill command is **not suitable for multi-Branch allocation** because it compares one selected Branch with the complete global balance.
3. Run `php artisan branch-inventory:backfill --store-code=PNG --dry-run` only as a legacy diagnostic, never as allocation instructions.
4. Review Product, exact Variant, bundle-component, open reservation, and both-ledger totals.
5. Resolve every discrepancy; tolerance is zero.
6. Do not run `--force` for multiple physical Branches: it can duplicate the global total into each Branch.
7. Run the Phase 8C coordinated activation readiness dry-run; activate only after reviewed physical initialization and approved change control.
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

The shipped coordinated activation command is documented below. It fails closed unless every active physical Branch has reviewed counts and is reconciled; never use SQL to bypass that guard.

## Rollback

Disable the new deployment and restore the prior application release; no Phase 8 schema rollback is required. Existing Orders retain deterministic pickup attribution. If an Order transaction failed, its stock changes rolled back with it. Before correcting balances, pause stock-changing traffic, reconcile global Product/Variant quantities against Order items and both movement ledgers, and make an audited adjustment through the existing global authority path. Do not copy candidate Branch quantities into global fields automatically.

## Compatibility risks and remaining blockers

- Monetary partial refunds lack line quantities.
- Mixed activation states are unsafe and rejected; coordinated physical initialization is mandatory.
- Full frontend disabled-Branch explanations are not introduced; backend preview is authoritative.

## Phase 9 deferrals

Dashboard and Sales Report aggregation, broad commission reporting, active-Branch low-stock UI, broader Branch-aware CRM/POS reporting displays, stock transfer workflow/approval, per-Branch pricing, and an explicit physical Return/Restock workflow remain deferred. No Phase 9 work, multi-tenancy, organizations, or tenant IDs are included.

## Phase 8C final writer conversion

### Final physical writer matrix

| Path | Persisted Branch source | Before ACTIVE | After coordinated ACTIVE | Canonical movement / reversal |
|---|---|---|---|---|
| Ecommerce pickup Product/Variant/bundle/reward | `Order.store_location_id = pickup_store_id` | legacy global reservation | exact Branch reservation rows | `ProductStockMovement`, Order identity keys; release to original reservation Branch |
| Ecommerce shipping Product/Variant/bundle/reward | priority-selected `Order.store_location_id` | legacy global reservation | exact selected Branch reservation rows | same canonical Order lifecycle; `pickup_store_id` remains NULL |
| POS checkout | persisted `PosCart.store_location_id`, copied to Order | legacy global checkout writer | atomic exact Product/Variant/component mutation | Order-referenced, idempotent `ProductStockMovement`; paid handling skips `StockMovement` duplication |
| POS staff consumable | persisted POS cart Branch, copied to Order | legacy global consumable writer | exact Branch Product/Variant/component mutation | Order/line idempotency keys |
| POS cart add/update | persisted `PosCart.store_location_id` | global compatibility validation | Phase 6A availability plus exact Branch inventory validation | final checkout always revalidates under locks |
| CRM adjustment | required Header-derived `store_location_id`, authorized by `StoreLocationAccessService` | global compatibility write with Branch-attributed history | canonical exact Branch mutation only | `ProductStockMovement` stores Branch/delta/before/after/actor/idempotency |
| CRM movement revoke | original `ProductStockMovement.store_location_id` | reverses legacy balance after authorizing original Branch | canonical inverse mutation at original Branch | unique `stock-movement-reversal:{id}` and reversal relationship |
| Payment success/callback | persisted Order and existing reservation | no second quantity deduction | no second quantity deduction | legacy `StockMovement` is skipped when canonical Order movements/reservations exist |
| Customer/admin cancellation and expiry | original Order reservation | legacy global release | original Branch release | reservation status plus release movement key prevents double restore |
| Monetary refund | monetary Order/return record | no automatic stock change | no automatic stock change | exact return quantities require a future explicit Return/Restock workflow |

`ProductStockMovement` is canonical for every converted ACTIVE writer. Historical `StockMovement` records remain readable. Its only remaining bounded new writer is `OrderPaymentService` for pre-activation Orders that have neither canonical Order movements nor Branch reservation records.

### POS and CRM authority rules

POS never derives an operational Branch after cart creation: add/update and checkout use `PosCart.store_location_id`; the resulting Order persists the same Branch. Active checkout expands bundles, sorts/locks canonical inventory identities, validates all requirements, and changes only that Branch. Purely monetary POS refund/void flows do not invent returned quantities.

CRM Stock Adjustment now requires `store_location_id`. The CRM sends the global Header Branch, shows it read-only, and disables adjustment for All Branches. The backend verifies active Branch access. Revoke always authorizes and mutates the original movement Branch, even if the Header later points elsewhere.

### Independent physical-count initialization

The legacy single-Branch backfill remains diagnostic only. Multi-Branch production initialization uses an explicitly reviewed JSON array:

```json
[
  {"store_code":"A","product_id":1,"product_variant_id":null,"quantity":5},
  {"store_code":"B","product_id":1,"product_variant_id":null,"quantity":10}
]
```

Dry-run validates Branch/Product/Variant identities, non-negative quantities, duplicates, and ACTIVE overwrite protection with zero writes:

```bash
php artisan branch-inventory:initialize --file=/secure/reviewed-physical-counts.json --dry-run
```

Approved initialization (never run by this implementation):

```bash
php artisan branch-inventory:initialize --file=/secure/reviewed-physical-counts.json --force
```

Safe re-runs update the same exact identities while authority is not ACTIVE, record the input SHA-256, and leave each imported Branch RECONCILED.

### Initial single-existing-Branch migration from legacy stock

For the confirmed first Gentlegurls production cutover only, all historical legacy Product/Variant stock physically belongs to the existing Branch whose immutable code is `PNG`. The Branch code remains an operator argument and is not hardcoded by the application:

```bash
php artisan branch-inventory:initialize --store-code=PNG --from-global --dry-run
```

The dry-run resolves an active Branch by `store_locations.code`, maps non-variant Products from the current legacy Product quantity, maps exact non-bundle Variants from `product_variants.stock`, skips derived bundles and untracked identities, and prints target identity, counts, quantities, existing rows, mismatches, skipped identities, and non-zero rows at other active Branches. It performs zero writes.

Approved first-cutover initialization (documented, never executed by this implementation):

```bash
php artisan branch-inventory:initialize --store-code=PNG --from-global --force
```

Force fails closed for a missing/inactive/ACTIVE target, unsafe legacy quantity, duplicate identity, conflicting target balance, reviewed inventory from another initialization mode, or any non-zero inventory at another active Branch. Exact matching replays are idempotent. It writes only the named Branch, never changes Product-to-Branch availability, never distributes stock, and leaves authority `RECONCILED`. New Branches must still have their zero/independent physical counts reviewed before coordinated activation readiness can pass. Once more than one Branch owns physical stock, use the reviewed JSON workflow instead.

The inventory initializer deliberately does not create Product availability assignments. For the initial legacy catalogue, first audit and then create only missing PNG assignments with:

```bash
php artisan product-branch:backfill --store-code=PNG --dry-run
php artisan product-branch:backfill --store-code=PNG --force
```

This command resolves an active Branch by code, preserves all existing `store_location_product` rows (including explicit unavailable rows), adds only missing Products as available, leaves every other Branch assignment intact, and never reads or writes inventory quantities. Product listing at a specific Header Branch filters by this availability pivot—not by inventory—so an available zero-stock Product remains visible. All Branches retains the global Product identity view.

Category identity remains global. In a specific CRM/POS Branch context, Category visibility is derived rather than persisted: a Category is returned only when at least one related Product has `store_location_product.is_available = true` at that Branch, and its count uses the same predicate. All Branches and public Ecommerce retain the global Category query. Global Category create/edit remains unchanged; a new empty Category appears globally but not in a specific operational Branch until an available Product is related. Branch selection is part of Product and Category request dependencies, so switching clears stale rows and refetches the new scope.

### Coordinated activation readiness

Mixed ACTIVE/legacy operation is unsafe because shipping may route across Branches and legacy fields become aggregate projections. Phase 8C therefore chooses **all-or-none coordinated activation of every active physical Branch**. Readiness fails closed when any active Branch lacks a reviewed import, is not RECONCILED, lacks an inventory identity for an available Product/Variant, or an ACTIVE mixed state already exists.

Readiness and activation dry-run (zero authority writes):

```bash
php artisan branch-inventory:activate --dry-run
```

Explicit coordinated activation command (implemented, never executed here):

```bash
php artisan branch-inventory:activate --force --confirm=ACTIVATE_BRANCH_INVENTORY
```

Activation changes all active physical Branch states in one transaction and immediately derives legacy Product/Variant aggregate projections. It never redistributes stock.

### Staged production cutover

1. Deploy Phase 8C with Branch Inventory inactive.
2. Verify Product-to-Branch assignments and Shipping priority.
3. For the confirmed initial PNG-only legacy model, approve the `--store-code=PNG --from-global` mapping and separately review new Branches as zero/independent; otherwise prepare complete reviewed JSON counts for every Branch.
4. Pause Ecommerce, POS, reward fulfilment, CRM adjustments/revokes, cancellations, and expiry jobs; zero downtime is not promised.
5. Run initialization `--dry-run`; resolve every error and review every quantity.
6. Run approved initialization `--force`; rerun dry-run/reconciliation.
7. Run activation `--dry-run`; require `ready: true` and review writer checks.
8. Run the explicit confirmed activation command under change control.
9. Verify Branch balances, aggregate projections, canonical movements, POS, Shipping, Pickup, CRM adjustment and release behavior.
10. Resume traffic and monitor canonical balance/movement drift.

Rollback before activation is application rollback plus no authority change. After activation, pause writers, restore the prior application release only if it understands ACTIVE states, reverse the activation state for all Branches together under an approved database runbook, restore legacy projections from Branch totals, and reconcile before resuming. Never copy aggregate stock into each Branch.
