# Phase 9 — branch-aware dashboard and reporting runbook

## Production-upgrade migration ordering (2026-08-30)

A pre-Multi-Branch production dump reaches the August 2026 dashboard index migration before the
January 2027 schema migration that adds `orders.store_location_id` and Product/Branch inventory
tables. The early migration therefore treats missing tables **and missing columns** as deferred
prerequisites instead of executing invalid PostgreSQL DDL. The post-foundation
`2027_01_06_000100_add_deferred_branch_query_indexes` migration creates the deferred indexes with
`IF NOT EXISTS` after all required schema exists. Do not manually add the column, edit the production
`migrations` table, or run a data backfill to work around this ordering issue; normal `php artisan
migrate` is the supported upgrade path.

## Audited report matrix

| Surface | Endpoint / source | Attribution | Specific Branch | All Branches / NULL | Export and authorization |
|---|---|---|---|---|---|
| Ecommerce dashboard | `dashboard/analytics/ecommerce`; Products, Branch inventory, Orders, Returns | Inventory Branch and `orders.store_location_id` | Available Products and exact Branch inventory; Branch sales/refunds | Accessible inventory aggregate; order NULL is explicit historical Unassigned activity | Request Branch is authorized by `StoreLocationAccessService` |
| Dashboard overview | dashboard overview; Orders, Returns, Customers | `orders.store_location_id` | Order KPIs/charts/products use selected Branch; Customer creation remains global | Accessible Branches plus explicit Unassigned orders | No export; backend scope is authoritative |
| Sales reports | sales endpoints; Orders, Items, Returns, package sales | persisted transaction Branch | Persisted Branch only | Accessible Branches; NULL is Unassigned | CSV must receive identical Branch parameters |
| Booking reports | booking reports; Bookings, services, staff | `bookings.store_location_id` | Selected Branch only | Accessible Branches; NULL Unassigned | CSV mirrors visible scope |
| POS / cash | POS summaries, Cash Shift report | Order/CashShift/CashPool persisted Branch | Selected Branch only | Accessible Branch breakdown | Direct Branch requests require authorization |
| Benefits | usage transaction tables | nullable transaction Branch | Usage only is filtered | balances/definitions global; unknown events Unassigned/Global | Branch is not eligibility |
| Commission | commission logs and earning parents | Booking/Order Branch when traversable | deterministic parent only | unattributable parent remains Unassigned | never use current Staff assignment |

The audit found concrete rendered-dashboard gaps: ecommerce analytics read legacy global stock and global sales, and overview Orders were unconstrained. These paths are converted. Package liability remains intentionally global. Unsupported deterministic attribution remains Unassigned rather than guessed.

## Semantics, inventory, security, and switching

The shared Header sends `branch_store_location_id=<id>` or `branch_scope=all`. Backend code never accepts a browser-provided ID list. A requested ID is authorized; All Branches is derived from the authenticated user's accessible StoreLocations. Only `infra_core_x1` has the existing bypass. Specific Branch excludes NULL. All includes accessible attributed rows and explicitly historical Unassigned activity.

Sales and Shipping attribution uses immutable `orders.store_location_id`; `pickup_store_id` is only pickup destination. Staff history follows its earning transaction, not current assignment. Customer/Member identity, Points balance, Package entitlement, Voucher/Redeem Voucher/Reward definitions, Product identity, and Category identity stay global.

Inventory analytics reads `store_location_product_inventories`, constrained to accessible Branches, and only available Products. Specific-Branch low stock uses the exact Branch quantity. An All total must not imply every Branch is healthy; operational review preserves per-Branch shortages. Existing Branch-first inventory indexes are reused; no schema/index duplication is needed.

Frontend Branch is request identity: dashboard data/detail are cleared, pagination resets, and late responses are ignored. Orders now reads shared Branch Context at component scope instead of calling a hook inside its icon renderer.

## Final regression matrix

| # | Scenario | Expected result |
|---:|---|---|
| 1–4 | platform bypass; assigned admin; A cannot request B; All | accessible IDs only; unauthorized is 403 |
| 5–8 | Product A/B availability; Category derivation/global master | correct derived views; no Category Branch table |
| 9–13 | Booking A/B; calendar; eligibility; schedule | persisted Branch isolation |
| 14–18 | POS Branch; cart/shift/order; cash/pool/printer | one consistent Branch; isolated data/settings |
| 19–28 | stock writers, variants/bundles, release/reward/projection | exact Branch changes once; projection only after activation |
| 29–34 | browsing, Pickup, Shipping, no split, Voucher, reward UX | shared site; one fulfilment Branch; benefits unchanged |
| 35–37 | Online and Offline A/B Promotions | channel/Offline Branch semantics intact |
| 38–42 | Points/Package balances and usage attribution | balances global; deterministic usage only |
| 43–45 | Dashboard A, B, All | A; B; accessible aggregate plus Unassigned |
| 46 | Sales A/B | `orders.store_location_id`, never pickup destination |
| 47–48 | Inventory/low stock A/B | exact quantity and per-Branch threshold |
| 49–50 | Booking/POS reports A/B | persisted parent Branch |
| 51 | exports | visible authorized Branch/date/status scope |
| 52 | legacy NULL | excluded specific; Unassigned in All |

## Production validation and rollback checklist

1. Back up database/configuration and record rollback checkpoints; run migrations non-destructively.
2. Dry-run/reconcile Product availability backfill separately from inventory initialization.
3. Review physical counts for every active Branch; validate variants, bundles, rewards and legacy projection.
4. Confirm every writer and cancellation/release uses the canonical boundary; coordinate activation only in the approved window.
5. Validate Dashboard A/B/All against control totals, refunds and Unassigned history.
6. Validate Sales, Booking/Appointment, POS, Cash Shift/Pool, inventory, low stock and exports with restricted and platform accounts.
7. Validate POS consistency, Booking eligibility/schedules, non-blocking printer, Pickup and whole-cart Shipping.
8. Validate cancellation/release and reward deduction once; reconcile movements and aggregates.
9. Validate global Voucher/Redeem Voucher, Points/Package balances, and Promotion channels.
10. Attempt B report/detail/export as A-only and require 403; verify authorized inactive-Branch history.
11. On mismatch, stop writes, never guess NULL ownership, restore checkpoint/config, and follow documented pre-activation rollback.

## Limitations and future work

Legacy NULL cannot be allocated. Commission/refund/benefit events without a Branch-bearing parent remain Unassigned/Global. A future UI may add per-Branch comparison without changing authority. Stock transfer, Return/Restock, split/nearest Shipping, warehouses, per-Branch pricing, Voucher Branch eligibility, reward Branch UX, organizations, tenants and `tenant_id` remain out of scope. Readiness is conditional on production-like regression; this phase performs no destructive production action or activation.

## Sales workspace completion (2026-08-30)

- The visual Sales common Order boundary now applies `ReportBranchScope` before every status/date aggregate. Item Type Product, Service and Package use the persisted `orders.store_location_id`; booking settlement/add-on and Package Redemption follow their persisted Order transaction rather than current Staff assignment. This closes the gap where Payment Method was scoped but Item Type and Staff helper queries were not.
- A specific Header Branch is authorized by `StoreLocationAccessService`, includes only that persisted Branch, and excludes legacy NULL. All derives accessible IDs server-side and may include NULL only as explicit **Unassigned**; inaccessible Branches and their names are excluded.
- Staff remains one global identity. Specific-Branch earnings use only that Branch's Order transactions. All adds an earning-Branch breakdown beneath each Staff total, produced by grouped Staff × persisted Order Branch queries (not assignment pivots and not N+1 queries).
- Ecommerce and Booking transaction APIs join StoreLocation in their existing set queries and return compact Branch metadata. Both transaction tables and their loading/empty/totals column counts show Branch only for All; a specific Branch hides the redundant column.
- Ecommerce and Booking CSVs mirror the UI: All includes a Branch column; specific Branch omits it. The same authorized report scope and persisted metadata feeds UI and export.
- Payment Method calculation and display were intentionally preserved. Legitimate reconciliation differences remain for refund timing and the booking settlement/package-redemption definitions described in the cards.
- POS Booking source-write correction ensures new direct appointments and POS Book Service checkout persist a concrete Booking Branch and all deposit/settlement Orders inherit it. Sales Visual continues to read persisted Order transaction Branch; it does not convert historical NULL to the current Header. Newly corrected transactions therefore display their real Branch while legacy unresolved rows remain Unassigned.

## Phase 9B executable completion ledger (2026-08-15)

The labels below describe executable state, not intended behavior.

### IMPLEMENTED

- `ReportBranchScope::current()` is the shared safe operational-report default. It authorizes a specific `branch_store_location_id`; omission or `branch_scope=all` resolves to authenticated accessible StoreLocations plus explicit legacy NULL. The resolved scope is cached only on the current Request.
- Sales overview/daily/category/Product/customer, channel, customer-domain, visual daily/period/yearly, Product Profit, POS summaries, My Staff Sales, ecommerce Staff Commission and their existing Sales CSV paths scope persisted `orders.store_location_id`. Package-sale rows use persisted `purchase_store_location_id`.
- Booking summary, grand totals, Staff aggregation and both Booking report CSVs scope `bookings.store_location_id`. Appointment list/history/daily reporting uses the same safe scope.
- Product stock movements default to accessible All and authorize specific Branch; the CRM sends Header scope. Revoke continues to authorize the movement's persisted Branch.
- Returns list scopes through the parent Order and Return detail/update verifies accessible parent Order Branch.
- Ecommerce dashboard and Product list use only accessible Branch inventory. All-Branches Product inventory includes an accessible per-Branch breakdown after inventory activation.
- Dashboard low stock uses the minimum exact Branch quantity rather than the accessible aggregate. The scheduled low-stock alert uses available Products at ACTIVE Branch inventory and identifies the Branch; legacy Product/Variant stock is a pre-activation fallback only.
- Category table CSV mirrors specific-Branch derived visibility. All-Branches Category CSV remains a global Category master export. Product CSV is explicitly labelled and named as a Global Product Master export.
- Package ownership and remaining entitlement remain global; existing Package dashboard redemption/usage metrics and detail usage rows scope `customer_service_package_usages.store_location_id`.
- Profit/Loss revenue, COGS and refunds follow report Branch scope. Because Expense has no deterministic Branch field, global expenses are excluded from specific/restricted views and included only for the platform bypass's company-wide view.
- Cash Shift/Cash Pool keeps earlier isolation, adds accessible per-Branch pool totals, and exposes legacy NULL Cash Shift count/rows as Unassigned in All.

### AUTOMATED TESTED

No Phase 9B PHPUnit result is recorded in this container because Composer development dependencies are unavailable. Automated coverage was added in `Phase9BReportingScopeTest` for persisted Shipping/Pickup business Branch attribution, specific-Branch NULL exclusion, accessible A+B plus Unassigned aggregation, inaccessible C exclusion/rejection, Booking historical Branch, accessible inventory exclusion, and the A=2/B=20 low-stock regression. `ReportBranchScopeTest` retains query-shape coverage; both must execute in CI before rollout.

### MANUAL TEST REQUIRED

- Visual/report totals and each CSV must be reconciled against production-like A/B/C SQL controls, including refunds, COGS, package-sale snapshots and void modes.
- Branch switching must be exercised under delayed network responses for every converted CRM report.
- Existing public token receipt URLs require possession-token validation and expiry review; Phase 9B did not change customer-facing token semantics.
- PostgreSQL query plans for the largest visual Sales, commission and Return datasets must be checked after deployment.

### GLOBAL BY DESIGN

Customer/Member identity, Staff identity, Product/Category identity, Package catalogue/ownership/remaining entitlement, Point balance, Voucher/Redeem Voucher/Reward definitions, Wishlist intent, Promotion identity/configuration and the shared Ecommerce catalogue remain global. Wishlist is a **GLOBAL CUSTOMER/ECOMMERCE METRIC — NOT BRANCH ATTRIBUTED**. Product CSV is a global master export. No Excel or report-PDF feature exists or was added.

### UNASSIGNED / LEGACY

Specific Branch never includes NULL attribution. Accessible All includes NULL transaction activity as Unassigned; no NULL is rewritten to PNG, a Header Branch or the first Branch. Cash Shift returns NULL rows/count explicitly. Commission, refund, Package usage and system benefit events without a deterministic Branch remain Unassigned/Global.

### DEFERRED

No dedicated Voucher-usage, Point-transaction or Promotion-usage report page exists. Phase 9B does not invent these product features; existing global eligibility and balance screens remain global. Booking commission snapshot screens need a separately verified deterministic earning-parent traversal before Branch filtering; current ecommerce Staff Commission is safely Order-attributed. Appointment activity logs are scoped through their deterministic Booking parent; orphan/non-Booking logs are not represented as Branch activity.

## Export classification

| Export | Classification | Phase 9B behavior |
|---|---|---|
| Sales and customer-domain CSVs | Operational Branch-scoped | same authorized request scope as visible report |
| Booking summary/Staff CSVs | Operational Branch-scoped | same Booking scope, including All Unassigned |
| Category CSV | Derived operational in specific Branch; global master in All | Header scope mirrored and authorized |
| Product CSV | Global master | explicitly labelled/named Global Product Master |
| Customer, Staff, Package catalogue | Global master | unchanged |
| Schedule/service/Booking Product exports | Existing domain exports | no false physical-inventory ownership introduced |
| Transaction receipts/invoices | Identifier transaction document | existing Order access/token rules; no new report PDF |
| Excel/XLSX | Deferred/nonexistent | not introduced |

## Phase 9C production-readiness hardening

### IMPLEMENTED

- Admin Order invoice generation authorizes persisted `orders.store_location_id` before building the PDF. Historical NULL Orders retain the documented legacy compatibility policy and are never assigned to a Branch.
- The operational Order list always resolves through `ReportBranchScope`; omitted Branch parameters mean authenticated accessible All, not an unrestricted query.
- Global Product Master CSV contains no Product or Variant physical stock. Product identity/configuration remains global; operational inventory remains Branch-scoped.
- Sales and Booking All-Branches responses disclose legacy NULL totals under an explicit `unassigned` object while retaining them in accounting totals. Specific Branch responses exclude NULL.
- Dashboard low stock evaluates each accessible `Product × available StoreLocation` pair. Missing Branch inventory is zero; inaccessible/unavailable Branches are excluded; items expose `branch_inventory_breakdown` and `low_branches`.
- Daily low-stock notification applies the available-Branch rule, names the Branch, and fails safely during mixed cutover state.
- Converted report clients cancel superseded Branch requests; intentional aborts do not surface as errors and stale finalizers cannot clear current loading state.
- Appointment activity-log actors derive from the same Branch-authorized Booking activity set as visible rows.
- Restricted/specific Profit & Loss identifies Branch contribution and states that global expenses are excluded.

### AUTOMATED TEST ADDED

- Regression assertions cover explicit Sales Unassigned totals, exact low Branch identification, missing inventory as zero, inaccessible inventory exclusion, and absence of physical stock from Global Product Master CSV.
- Existing Phase 9B tests cover persisted Sales attribution, accessible-All behavior, inaccessible Branch rejection, Booking history attribution, and shortage preservation.

### AUTOMATED TEST EXECUTED

- Release validation must record the actual PHPUnit/CI command and result. Test source presence is not a pass.

### MANUAL QA REQUIRED

- Exercise invoice, movement revoke, Return update, POS refund/void receipt, commission detail, and loyalty update with A-only, B-only, and `infra_core_x1` accounts.
- Reconcile Sales/Booking Unassigned output against production-shaped NULL fixtures.
- Switch A → B under throttled networking on each converted report and verify late A responses cannot replace B.
- Validate low stock for singles, Variants, missing inventory, unavailable Products, and inaccessible Branch C.
- Confirm all intended Branches are ACTIVE together before production activation.

### GLOBAL BY DESIGN

- Member identity and Point balance; Package catalogue, ownership and remaining entitlement; Voucher and Redeem Voucher definitions/eligibility; Product and Category identity; reward definitions and initial Redeem Product selection; Wishlist/customer Ecommerce intent.

### DEFERRED — DATA MODEL LIMITATION

- `StaffMonthlySale` and commission snapshots without an earning Order/Booking parent remain Unassigned/Unsupported. Current Staff assignment is never used to guess historical Branch.
- Dedicated Points, Voucher, and Promotion historical-usage workspaces do not exist and were not invented.
- Global company Expenses lack deterministic Branch ownership and are not allocated into specific-Branch net profit.
