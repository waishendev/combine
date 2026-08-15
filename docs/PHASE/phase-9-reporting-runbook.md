# Phase 9 — branch-aware dashboard and reporting runbook

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
