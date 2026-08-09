# Phase 7 benefit Branch rules production runbook

## Confirmed architecture

The re-audit found one global `customers` identity, global FIFO `points_earn_batches`, and a global `points_transactions` ledger. Service packages are global definitions; one `customer_service_packages` ownership row has shared balances locked during reservation/consumption. Vouchers are global definitions with existing date, usage, customer, minimum-spend, product, and category rules. Loyalty rewards point to the global Voucher or Product. Product rewards currently decrement `products.stock`/`stock_quantity`; no cancellation/reversal workflow exists for loyalty claims.

Phase 7 therefore keeps Member identity, point balance, Package catalogue, Package ownership, and remaining entitlement global. It adds nullable attribution only to benefit transactions. Package use inherits its persisted Booking or POS-cart Branch and remains concurrency-safe through the existing locked shared balance. Package purchase records a deterministic Order/Booking Branch without partitioning ownership. There is deliberately no Package-to-Branch applicability UI or table.

Voucher definitions use explicit `voucher_store_location` assignments. Voucher create/update requires one or more active, actor-accessible Branches; the backend additionally rejects a voucher at a deterministic POS Branch when it is not assigned there. A genuinely global ecommerce delivery flow continues to pass no Branch rather than inventing one. Legacy unassigned definitions are not interpreted as “all Branches.”

Voucher-type loyalty rewards use explicit `loyalty_reward_store_location` assignments, separate from the actual claim Branch. Their generated customer voucher retains the underlying global Voucher definition and its Branch assignments. Product-type rewards receive **no** reward-to-Branch applicability: eligibility uses `Product::isAvailableAt()` from Phase 6A and the claim stores the fulfilment Branch. Global Product stock remains authoritative and is still the only quantity mutated.

Point earning from a paid Order stores `orders.store_location_id`; reward spending stores the persisted claim Branch. System/global adjustments may remain NULL. Balance calculations remain company-wide and never group by Branch. An optional customer/idempotency key prevents a submitted claim from deducting twice. The point deduction, claim creation, attribution, voucher generation/cart fulfilment, quota mutation, and existing global-stock mutation remain in one database transaction.

## Deployment and backfill

1. Back up the database and deploy code with the additive migration.
2. Select the operator-approved active legacy Branch code; the command never creates or hardcodes a Branch.
3. Run dry-run and archive its report:
   `php artisan benefit-branch:backfill --store-code=PNG --dry-run`
4. Reconcile definition counts, attributable Package usage, Order-backed points, and Order-backed reward claims. Review unresolved NULLs; NULL never means PNG/current/all.
5. In an approved write window only, run (not run by this implementation):
   `php artisan benefit-branch:backfill --store-code=PNG --force`
6. Re-run dry-run. Existing assignments are preserved and force mode is idempotent. Confirm customer count, sum of point batch remaining quantities, package ownership/balances, Product/Variant global stock, and every Branch inventory row are unchanged except expected benefit attribution tables/columns.

The command assigns legacy Voucher and voucher-reward definitions to the approved Branch, derives Package usage from its Booking, points from their source Order, Voucher usage from its Order, and reward claims from fulfilled reward Order items. It intentionally leaves ambiguous/system records NULL and never changes point balances, Package entitlements, Product stock, or Branch Inventory.

## Rollback

Disable Phase 7 UI/API writes first. Export pivots and new attribution columns for audit retention, then roll back the Phase 7 migration. The rollback removes only additive pivots/columns; it cannot split or merge global identities because none were created. If application-only rollback is needed, keep schema deployed and revert code so historical attribution remains harmless. Never compensate by rewriting NULL to the current Header Branch.

## Compatibility and deferrals

Existing ecommerce delivery flows remain global and do not enforce inventory or invent fulfilment ownership. Public reward redemption may omit a Branch for that compatibility path; operational CRM/POS callers should supply a deterministic Branch. Legacy NULL history remains visible. The current loyalty claim model has no reversal/cancellation path, so original-Branch reversal behavior cannot yet be wired; any future reversal must read `loyalty_redemptions.store_location_id`, restore global points, and restore current global stock.

Deferred to Phase 8/9: Branch Inventory authority/cutover, ecommerce reservation and whole-cart pickup stock enforcement, delivery routing, stock transfers, per-Branch pricing, inventory-based redemption quantity, full reporting aggregation, and any claim reversal lifecycle. No tenant, organization, or `tenant_id` architecture is introduced.
