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
* `store_location_product_inventories`: Branch, Product, nullable ProductVariant, quantity, and timestamps. PostgreSQL-compatible partial unique indexes independently enforce one Branch/Product row where Variant is NULL and one Branch/Product/Variant row where Variant is present. No generated identity column or fake Variant ID is used. The model rejects variants belonging to another Product.
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

## Phase 6B controlled-cutover foundation and stop decision

### Re-audit mutation matrix

| Flow | Current balance / ledger | Variant and bundle behavior | Restore behavior | Deterministic Branch | Safe Phase 6B target |
|---|---|---|---|---|---|
| CRM adjustment | Product/Variant global fields; `ProductStockMovement` | Variant-aware; bundle direct adjustment prohibited | Revokes global fields using movement | No Branch persisted before 6B | Candidate canonical service after explicit Branch activation |
| POS add/update | Global Product/Variant fields | Bundle availability derived from components | None at cart stage | Yes, persisted cart Branch | Branch inventory reads, but only after cutover blockers resolve |
| POS checkout | Global fields; `ProductStockMovement` | Components are locked one-by-one and clamped with `max(0, …)` | No general inventory restoration in monetary refund/void | Yes, persisted cart/order Branch | Atomic deterministic component mutation service |
| Ecommerce order placement | Global fields through `OrderReserveService` | Variant/component-aware reserve and release | Expiry/cancel release global fields | Pickup may have a Branch; delivery is not deterministic | Phase 8 must define attribution/reservation before global authority can be frozen |
| Ecommerce paid callback | `StockMovement` audit write only | No Variant identity | No corresponding canonical reversal | Not reliably deterministic | Freeze this legacy write only after ecommerce reservation redesign |
| Order refund | Monetary amount only | No refunded line quantities | No inventory restoration; partial refund cannot identify units | Order may have Branch, but quantity is unknowable | Add line-level, idempotent restoration contract before cutover |
| Offline void/cancel | Order/booking/payment state | Product inventory restoration is not centralized | No single idempotent Product restore record | Mixed historical attribution | Central restoration reference required before cutover |
| Loyalty reward claim | Direct global Product decrement | Product-only | Separate flow | No operational Branch source | Must gain deterministic Branch or remain blocked |
| Low-stock | Global Product/Variant fields | Variant-aware, globally aggregated | N/A | None | Phase 6C Branch-specific conversion |

### Confirmed decisions

`store_location_product_inventories` is the intended authoritative balance and `ProductStockMovement` is the **candidate canonical ledger** because it can represent Product/Variant, before/delta/after, actor, reversal, Branch, source reference, and an idempotency key. Phase 6B adds nullable `store_location_id`, polymorphic reference columns, explicit signed `quantity_delta`, and unique `idempotency_key`; historical rows remain intact. `StockMovement` history is retained and its writer is not removed until ecommerce compatibility is resolved.

The atomic `BranchInventoryMutationService` locks rows in deterministic Product/Variant order, validates every result before mutation, updates balances and movements in one transaction, retries deadlocks, rejects missing rows/negative results, and makes operation replay idempotent. Bundle helpers aggregate repeated component requirements and never create bundle balance rows.

### Mandatory stop condition

**Branch inventory authority is not enabled by this release.** The re-audit found three explicit user-defined stop conditions:

1. Ecommerce reserves/releases global fields before payment and delivery orders have no deterministic Branch; switching POS alone would leave two independent authorities.
2. Monetary partial refunds do not identify Product/Variant quantities and current void/cancel paths do not provide one centralized idempotent inventory restoration record.
3. Loyalty reward claims directly decrement global Product stock without a deterministic Branch.

Accordingly, no existing POS, adjustment, revoke, refund, ecommerce, loyalty, or low-stock writer is connected to the new service. `branch_inventory_cutover_states.status` remains `pending` or `reconciled`; the backfill command deliberately cannot set `active`. This reduces ambiguity without pretending a safe cutover occurred.

### Reconciliation command

Zero-write analysis:

```bash
php artisan branch-inventory:backfill --store-code=PNG --dry-run
```

Explicit mapping write (do not run without an approved write freeze, and **do not run as part of deployment automation**):

```bash
php artisan branch-inventory:backfill --store-code=PNG --force
```

The report includes non-variant and Variant row counts, legacy and target totals, missing/matching/mismatched/extra rows, and bundle/component implications. Force inserts missing rows once, refuses mismatches or extra rows, verifies the result transactionally, and marks only `reconciled`. It never creates a Branch, overwrites a row, duplicates quantity, or activates authority.

### Required cutover window after blockers are fixed

1. Deploy additive schema, reconciliation tooling, and converted-but-disabled writers.
2. Pause POS, CRM adjustment, ecommerce ordering/payment callbacks, expiry releases, reward claims, refunds, voids, and cancellations.
3. Run the dry-run; archive totals and movement discrepancy output.
4. Resolve every mismatch/extra/missing identity and bundle component anomaly.
5. Run force once; run dry-run again and require zero discrepancies.
6. Verify ecommerce line-level restore/idempotency and deterministic Branch attribution are deployed.
7. In one controlled release, convert all remaining global writers, set the reviewed Branch state to `active`, and make legacy global fields derived compatibility projections only.
8. Resume traffic and verify Branch balances against signed canonical movement sums.

There is no safe zero-downtime promise with the current global reservation writers. After activation, `products.stock`, `products.stock_quantity`, and `product_variants.stock` must be synchronized derived projections for bounded old-reader compatibility, never independent inputs. That projection and activation command are intentionally not implemented until every writer above is converted.

### Rollback and deferrals

Before activation, rollback simply removes the additive cutover-state table and canonical ledger columns; Branch inventory rows produced by an approved force run should be exported before migration rollback. No operational writer depends on them. After a future activation, rollback requires another write freeze, movement-to-balance reconciliation, disabling Branch writers, and restoring a verified global projection before old code resumes.

Phase 6C owns Branch low-stock/UI compatibility. Phase 8 owns public pickup Branch selection, reservations, conflict UX, and deterministic ecommerce attribution. Transfers, cash shifts/pools, printers, pricing, vouchers, packages, points, rewards, broad reporting, Phase 7, and multi-tenancy remain out of scope.

## Phase 6C POS operational Branch foundation

### Cash and printer re-audit

`pos_cash_shifts` stores separate immutable OPEN and CLOSE event records linked by `linked_open_shift_id`. It was previously company-global, and cash sales were calculated only by time window. A shift is clearly an operational Branch parent, so Phase 6C adds nullable `store_location_id`; CLOSE inherits the OPEN Branch, and cash-sale calculation additionally filters `orders.store_location_id`.

`pos_cash_pool_accounts` contains carried physical drawer values (`total_initial_cash` and `total_withdraw`). Open/close shift actions move those balances and immutable `pos_cash_pool_ledger` children reference both the account and shift. Therefore the **account parent is Branch-specific**, while ledger entries inherit Branch through their immutable account/shift parents. No redundant Branch column or cross-Branch transfer behavior was added to the ledger.

Thermal printer connection, enabled state, paper width, copies, and auto-print receipt behavior are operational receipt settings. They now live in one structured `store_location_pos_settings` row per Branch. The previous global `thermal_printer` setting is read only as a legacy fallback when an existing Branch has no structured row; saving creates the Branch row and never creates dynamic setting keys.

### Operational and historical rules

Opening, closing, or querying the current shift requires an explicit existing, active, POS-enabled, actor-accessible Branch. Only one open shift is allowed **per Branch**; different Branches may have open shifts concurrently, and selecting another Branch must neither reinterpret nor close the previous Branch's shift. Open and close requests carry the explicit Branch in their request bodies, while current-shift reads carry it in the query string. A close request for a Branch with no open shift is rejected. POS Orders already inherit the cart Branch, while shift cash totals now include only Orders from the same Branch.

The CRM cash-shift gate is keyed to the Header Branch selection. A Branch change immediately clears the previous shift, cash pools, errors, and open/close modal state before loading the newly selected Branch. Stale asynchronous responses are ignored, and an explicitly attributed request cannot be overwritten by the POS fetch interceptor. The UI exposes only a shift whose `store_location_id` equals the current selection, displays the Branch in the open-shift dialog, and refuses to close a legacy NULL-attributed or different-Branch shift.

New-Branch initialization is distinct from historical reconciliation. StoreLocation creation normally
creates that Branch's zero-balance default Cash Pool; current/open-shift access also idempotently
`firstOrCreate`s the same `(store_location_id, default)` prerequisite to cover Branches created through
older/import paths. It never selects, renames, or reattributes a NULL/PNG account. Therefore no new
initialization command is required: `pos-branch:backfill` remains exclusively the reviewed legacy-data
attribution tool. Open shifts remain one per Branch, so an open PNG shift does not block Branch B.
The existing single operator cart remains safely Branch-fixed while meaningful; an empty cart may be
reattributed, while a non-empty cross-Branch switch is rejected rather than silently reused.

Historical shift reports remain readable for accessible Branches even after POS is disabled. Legacy NULL shift/account history stays explicitly unresolved until backfill; it is never treated as Branch 1, current Header Branch, or All Branches. Cash report All Branches means an overview of accessible attributed Branches, not mutation permission.

Printer configuration can be read and administratively edited for an accessible historical Branch. Auto-print preference changes and test-print operations require an active, POS-enabled Branch. CRM All Branches cannot save printer settings; a specific global Branch Context selection is required.

Printer settings are an optional peripheral dependency and no longer block POS Product checkout or the Appointments workspace. Each workspace schedules an independent, Branch-explicit settings request after its required operational requests, aborts it after eight seconds, and represents `idle`, `loading`, `ready`, `disabled`, `not_configured`, and `error` separately. A Branch switch immediately hides the previous Branch's printer snapshot; late responses cannot leak it into the new Branch. Missing, disabled, failed, or timed-out printer settings disable printing and show a warning/status, but checkout and appointment work continue. Auto-print updates also send the selected Branch explicitly.

### POS appointment Branch scoping

The POS Appointments workspace is scoped to the selected Branch end to end. Appointment list/search, detail, creation, status/hold/completion actions, rescheduling, settlement edits, package apply/release, confirmation email, cancellation review, and payment-link list/create/cancel/approve/reject calls carry `store_location_id`. Backend list queries filter to the authorized selected Branch and single-record actions authorize both actor access and request/Booking Branch equality. Pending cancellation and payment-review counts use the same scope. A mismatched explicit Branch returns not-found rather than exposing the other Branch's Booking; without an explicit Branch, compatibility reads are limited to accessible Branches plus legacy NULL-attributed Bookings.

Appointment responses include Branch ID and Branch name/code so the CRM can retain and display attribution. Branch changes clear list/detail state and invalidate in-flight list/detail responses before reloading, preventing stale results from the previous Branch. Appointment creation is blocked unless a specific Branch is selected; booking services, service details/questions, and active staff choices are requested for that Branch. The staff endpoint applies the requested authorized Branch assignment filter. This closes the Phase 6 POS surface gap without changing the Phase 5 Booking ownership and schedule rules.

### POS operational backfill

```bash
php artisan pos-branch:backfill --store-code=PNG --dry-run
```

```bash
php artisan pos-branch:backfill --store-code=PNG --force
```

Force must not be run automatically. The command reports null/assignable/unresolved shifts, accounts, and ledger entries. It updates only NULL parent attribution, preserves every non-null value, leaves linked-shift or account-code conflicts unresolved, is idempotent, and never creates a Branch. Ledger rows inherit through the attributed parents.

### Inventory read and low-stock compatibility

The authorized Branch Context response exposes only `pending`, `reconciled`, or `active`, an authority boolean, and a plain-language label; it does not expose reconciliation internals. `pending` displays global legacy inventory authority. `reconciled` explicitly says “not yet active.” No Phase 6C endpoint or UI can activate inventory.

Production Product/POS stock and low-stock alerts continue reading global Product/ProductVariant fields. Preparatory Branch balances do not trigger alerts and are not presented as live stock. `BranchInventoryMutationService` remains guarded and disconnected from writers. The Phase 6B ecommerce, partial-refund, void/cancel, and loyalty blockers remain unresolved.

### Fresh install, rollback, and deferrals

Fresh Branch creation and seeding create a zero-valued default physical cash account and default disabled printer row. Rollback requires stopping cash operations, exporting any new Branch cash/printer data, reverting application code, then rolling back the additive migration. Removing Branch attribution does not delete shifts or ledger history, but the rollback recreates the legacy unique global account code and therefore requires consolidating/removing additional Branch account rows first.

No inventory activation, stock writer conversion, transfer workflow, public ecommerce reservation/pickup behavior, Phase 7/8 feature, reporting conversion, or multi-tenant architecture is included.

## Merged implementation trace

This runbook was reconciled against every commit merged by PR #564 (`codex/implement-phase-6a-for-multi-branch-project`). The trace is intentionally recorded here so later operators do not mistake the original “6A” branch name for the final 6A/6B/6C delivery boundary.

| Commit | Delivered behavior | Runbook coverage |
|---|---|---|
| `95373b6` | Phase 6A Product availability, preparatory Branch inventory schema/model, POS cart/order Branch attribution, backfill/seeding, CRM Branch gates and Product assignments | Release boundary, schema, availability rollout, POS behavior, rollback and 6B prerequisites |
| `7b39885` | Phase 6B cutover-state schema, canonical movement fields, guarded atomic mutation service, reconciliation/backfill command and tests | Re-audit matrix, confirmed decisions, mandatory stop, reconciliation, cutover and rollback |
| `c988711` | Phase 6C Branch cash shifts/pools, printer settings, Branch-context inventory status, backfill/seeding, CRM POS/report/settings integration | Cash/printer re-audit, operational/history rules, POS backfill, inventory compatibility and deferrals |
| `528438b` | PostgreSQL-safe nullable/non-null Variant partial unique indexes and corrected inventory identity handling | PostgreSQL migration compatibility correction |
| `189ffdc` | Explicit selected-Branch cash-shift requests and UI attribution/close safeguards | Operational and historical rules |
| `f6db414` | Concurrent per-Branch shifts, Branch-switch state reset, stale-request protection, and non-overwriting fetch interception | Operational and historical rules |
| `e8abf8a` | Branch-scoped POS appointment reads/actions, cancellation/payment-link review, staff options, service inputs, and stale-response protection | POS appointment Branch scoping |
| `2d56090` | Independent optional printer loading, timeout/error states, Branch snapshot isolation, and non-blocking checkout | Printer operational rules |

The merge commit is `71d3a37`. No Phase 6 operational behavior from those eight commits is intentionally left undocumented; implementation-level method and test details remain discoverable from the commit trace, while this document records the production contract, safety boundaries, rollout, and rollback consequences.

## PostgreSQL migration compatibility correction

Laravel 12.40.2 compiled the former `virtualAs(coalesce(product_variant_id, 0))` definition to MySQL-style `GENERATED ALWAYS AS (...) VIRTUAL`, which PostgreSQL rejects. Phase 6 now uses two PostgreSQL-native partial unique indexes instead: `(store_location_id, product_id) WHERE product_variant_id IS NULL` and `(store_location_id, product_id, product_variant_id) WHERE product_variant_id IS NOT NULL`. `product_variant_id` remains nullable; `variant_identity` was removed entirely.

PostgreSQL normally executes Laravel migrations transactionally, so the failed CREATE TABLE statement should roll back the earlier Phase 6A DDL and leave no migration row. Before retrying, verify rather than assume:

```sql
SELECT to_regclass('public.store_location_product'),
       to_regclass('public.store_location_product_inventories');
SELECT migration FROM migrations
WHERE migration = '2027_01_01_000001_create_product_branch_phase_6a_foundation';
```

If both relations are NULL and the migration row is absent, simply rerun `php artisan migrate`. If an unusual non-transactional/manual run left Phase 6A relations while the migration row is absent, first inspect row counts and ownership. Only when both tables are confirmed empty and created solely by this failed pre-deployment migration, use:

```sql
DROP TABLE store_location_product_inventories;
DROP TABLE store_location_product;
```

Do not run those DROP statements against populated or deployed data. Export/rename and reconcile any non-empty table instead. Phase 6B/6C were also reviewed: their `after()` placement hints are ignored by PostgreSQL, unsigned integer declarations map through Laravel's PostgreSQL grammar, JSON has no incompatible default, index names fit PostgreSQL limits, and FK actions/nullable morphs use supported syntax. No other Phase 6 PostgreSQL-specific blocker was identified.
