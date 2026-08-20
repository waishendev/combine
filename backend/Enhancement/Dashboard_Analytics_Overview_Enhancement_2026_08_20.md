# Dashboard Analytics — Overview Enhancement (2026-08-20)

## New API (DONE)

| Method | Path | Enhancement id |
|--------|------|----------------|
| GET | `/api/admin/dashboard/analytics/overview` | `dashboard-analytics-overview-v1` |

First-paint payload for CRM `/dashboard`:

- `ecommerce` — same shape as legacy `/analytics/ecommerce`
- `packages.summary` / `packages.filter_options` / `packages.customer_packages`
- `categories` — lightweight filter dropdown list
- `meta.enhancement` / `meta.includes` / `meta.legacy_endpoints` / `meta.not_yet`

Query: `include=ecommerce,packages,categories` (default). Branch scope same as other report APIs (`branch_store_location_id` or all).

## Legacy APIs (KEPT)

Still used for pagination / filter changes / detail drawer:

- `/admin/dashboard/analytics/ecommerce`
- `/admin/dashboard/analytics/packages/summary`
- `/admin/dashboard/analytics/packages/filter-options`
- `/admin/dashboard/analytics/packages/customer-packages`
- `/admin/dashboard/analytics/packages/customer-packages/{id}`
- `/admin/dashboard/analytics/packages/sales`
- `/admin/dashboard/analytics/packages/redemptions`

## NOT YET in overview

- Package sales list
- Package redemptions list
- Customer-package detail drawer
- Cross-request Redis cache

## Backend changes

1. **Phase C indexes** — `2026_08_20_000100_add_dashboard_analytics_branch_indexes.php`
   - `orders (store_location_id, payment_status, status)`
   - `store_location_product (product_id, store_location_id) WHERE is_available`
   - `store_location_product_inventories (product_id, product_variant_id, store_location_id)`
2. **Inventory single-pass** — temp table materializes UNION once per ecommerce request
3. **Schema listing memo** — request-shared `getColumnListing` / `hasTable` / `hasColumn`
4. **Overview controller** — `DashboardAnalyticsOverviewController`
5. **CRM** — `DashboardAnalyticsContent` loads overview once; children use legacy APIs on filter/page changes

## Routes tracker

See comment block above the overview route in `routes/api.php`.
