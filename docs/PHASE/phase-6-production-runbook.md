# Phase 6A Product, Inventory and POS Branch Runbook

## Release boundary

Phase 6A adds sellability configuration and attribution only. `store_location_product_inventories` is deliberately empty on deployment and is not read or written by checkout, adjustment, refund, revoke, low-stock, or reporting code. **Inventory cutover has not occurred.**

## Current-code re-audit

* A single Product remains the catalog identity. Non-variant stock is authoritative in `products.stock`; inventory writes synchronize legacy `products.stock_quantity`. `cost_price` and `inventory_value` are maintained by stock-adjustment/POS inventory paths.
* A variant Product owns quantity and cost in each non-bundle `product_variants.stock` / `cost_price`. Bundle variant availability is derived as the minimum component stock divided by required component quantity; bundle checkout deducts component variants. A bundle itself is not directly adjustable.
* CRM stock adjustment, revoke/reversal, and POS checkout write `product_stock_movements`. That ledger includes `product_variant_id`, before/after quantity and value, and explicit reversal links.
* Ecommerce `OrderPaymentService::handlePaid()` also actively writes the older `stock_movements` audit table. It records only Product, delta, reason and reference, has no Variant or reversal fields, and does not itself update quantity. Both ledgers therefore remain live, but they are not equivalent or jointly authoritative.
* POS has one persisted `pos_carts` row per staff user, with Product, Booking Product, service, package, and appointment-settlement child rows. Phase 6A adds nullable Branch attribution and fixes the Branch once any meaningful cart state exists.
* Existing refund/void/revoke and low-stock paths remain global and unchanged. Public shop catalog/cart/checkout remain Branch-context-free and unchanged.

### Phase 6B ledger decision blocker

Do not guess a canonical ledger. Before Phase 6B, reconcile why ecommerce payment writes `StockMovement` while POS/CRM quantity mutations write `ProductStockMovement`, identify every refund/void restoration path, and decide whether ecommerce should write the variant-capable ledger before freezing/deprecating `StockMovement`.

## Schema

* `store_location_product`: Branch, global Product, `is_available`, timestamps, and a unique Branch/Product key. Availability is Product-level; variants inherit it.
* `store_location_product_inventories`: Branch, Product, optional ProductVariant, `variant_identity`, quantity, and timestamps. `variant_identity=0` uniquely identifies the non-variant Product row; otherwise it mirrors the Variant ID, preventing nullable-unique ambiguity. The model rejects variants belonging to another Product.
* `pos_carts.store_location_id`: nullable, indexed, historical-safe FK (`nullOnDelete`). Legacy null carts remain readable and acquire a validated Branch on their next operational use.

## Product availability rollout

Dry-run (zero writes):

```bash
php artisan product-branch:backfill --store-code=PNG --dry-run
```

Production write (do not run until the dry-run is reviewed):

```bash
php artisan product-branch:backfill --store-code=PNG --force
```

Replace `PNG` with the explicit existing immutable Branch code. The command never creates a Branch, never removes or disables an assignment, is idempotent, and never writes inventory quantities. Fresh seeding assigns any seeded global Products to the first active configured Branch.

## POS behavior

The CRM blocks All Branches and POS-disabled selections. Every POS API request carries the selected Branch. The backend independently requires an existing, active, POS-enabled, actor-accessible Branch. A new or empty cart is attributed/re-attributed; a meaningful cart rejects a mismatch. Product search and add-to-cart enforce Product availability only. Existing global stock checks remain in force. The POS order takes `store_location_id` from the persisted cart, never pickup or an unrelated frontend Order value.

## Rollback

1. Stop new POS traffic during application rollback so new application code does not encounter missing Phase 6A columns.
2. Roll back the Phase 6A application release.
3. Roll back the Phase 6A migration to remove the nullable cart FK and the two new tables. This loses availability configuration but does not lose or change authoritative stock/history.
4. If only enforcement must be disabled, deploy the previous application while retaining additive tables; do not delete global Product/Variant stock or movement rows.

## Phase 6B prerequisites

1. Review Product availability dry-run and complete explicit assignments.
2. Inventory-count and reconcile each Branch without assuming all legacy stock belongs to one Branch.
3. Resolve the dual-ledger blocker and choose the canonical variant-capable ledger.
4. Map every POS/ecommerce sale, bundle component deduction, refund, void, revoke and concurrency path.
5. Define atomic decrement/reservation and idempotency semantics.
6. Define cost/value ownership for variant and non-variant Branch balances.
7. Produce dry-run discrepancy reports and an approved, reversible backfill plan.
8. Only then plan branch-aware low-stock, inventory reports, transfers, and stock restoration.

Unresolved decisions include canonical ledger retirement, order/refund restoration unification, negative-stock policy, bundle movement representation, cost valuation per Branch, and historical null-cart treatment. Cash shifts/pools, printers, pricing, ecommerce pickup inventory, Phase 7+, and multi-tenancy are outside Phase 6A.
