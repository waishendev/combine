# Dashboard Analytics — Overview Enhancement (2026-08-20)

## New API (DONE)

| Method | Path | Enhancement id |
|--------|------|----------------|
| GET | `/api/admin/dashboard/analytics/overview` | `dashboard-analytics-overview-v1` |

First-paint payload for CRM `/dashboard` (slimmed for first paint):

- `ecommerce` — metrics + page-1 inventory rows (first-paint fields only)
- `packages.summary` / `packages.filter_options` / `packages.customer_packages` (first-paint fields only)
- `categories` — `{id,name}` for the ecommerce filter dropdown
- `meta.enhancement` / `meta.includes`

Query: `include=ecommerce,packages,categories` (default). Branch scope same as other report APIs (`branch_store_location_id` or all).

## Legacy APIs (KEPT — full payloads)

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

## Overview payload slim (2026-08-20)

Traced against CRM first paint (`DashboardAnalyticsContent` → ecommerce/package dashboards).
Removed fields are unused for rendering, conditions, links, filters, or calculations on that first paint.
Filter/page/detail still use legacy APIs with full shapes.

### Ecommerce — kept

- Metrics: `products.*`, `inventory.*`, `sales.*`
- Items: `product_id`, `product`, `sku_variant`, `category`, `current_stock`, `cost_per_unit`, `retail_price`, `inventory_cost`, `retail_value`, `potential_profit`, `missing_cost`, `branch_inventory_breakdown`
- Pagination: `items.{data,current_page,last_page,total}` only

### Ecommerce — removed from overview (safe)

| Field | Why safe |
|-------|----------|
| `items[].status` | Not rendered / filtered on first paint (`status=active` is request-side). |
| `items[].has_branch_low_stock` | Not read by UI; low-stock KPI uses `products.low_stock_count`. |
| `items[].low_branches` | Not rendered; drawer uses `branch_inventory_breakdown` only. |
| Laravel paginator extras (`links`, `*_url`, `path`, `from`, `to`, …) | UI only uses `data` + `current_page` / `last_page` / `total`. |

### Packages summary — kept

- `templates.{total,active,inactive}`
- `customers.active_holders`
- `balances.{remaining_redemptions,outstanding_service_value}`
- `sales.net_package_sales`
- `redemptions.redeemed_value`

### Packages summary — removed from overview (safe)

| Field | Why safe |
|-------|----------|
| `templates.missing_redemption_value_count` | Not shown on dashboard cards. |
| `customers.active_customer_packages` | Card uses `active_holders` only. |
| `sales.gross_package_sales`, `sales.refund_amount` | Card shows net only. |
| `redemptions.redeemed_qty` | Card shows redeemed value only. |
| Entire `status.{expiring_soon,exhausted,expired,cancelled}` | No UI consumer on first paint; **status aggregate SQL skipped**. |

### Liability rows — kept

- `id`, `customer`, `package`, `purchased_from`, `purchase_date`, `expires_at`, `status`, `remaining_qty`, `total_qty`, `used_qty`, `purchase_amount`, `remaining_service_value`, `missing_values`
- Pagination: `{data,current_page,last_page,total}`

### Liability rows — removed from overview (safe)

| Field | Why safe |
|-------|----------|
| `started_at` | Table unused; detail drawer loads `/customer-packages/{id}`. |
| `purchase_reference` | Not in table/types used on dashboard. |
| `reserved_qty` | Not rendered; **`reserved_agg` join skipped** on overview. |
| Paginator extras | Same as ecommerce. |

### Categories / meta

- Categories already `{id,name}` only (kept).
- Meta dropped `status`, `legacy_endpoints`, `not_yet` (frontend only checks optional `enhancement` / `includes`).

## Benchmark (local Postgres · superadmin · median of 5)

| Metric | Overview before slim | Overview after slim | Delta |
|--------|----------------------|---------------------|-------|
| Payload bytes | 16,378 | 10,486 | −36% |
| Wall ms | 121.5 | 97.9 | −19% |
| SQL ms | 86.1 | 70.4 | −18% |
| CPU ms | 46.9 | 31.3 | −33% |
| Query count | 22 | 21 | −1 (status aggregate) |
| Memory delta | ~0 (not meaningful at this scale) | ~0 | — |

Legacy endpoints unchanged (full payloads preserved).

## Backend changes

1. **Phase C indexes** — `2026_08_20_000100_add_dashboard_analytics_branch_indexes.php`
2. **Inventory single-pass** — temp table materializes UNION once per ecommerce request
3. **Schema listing memo** — request-shared `getColumnListing` / `hasTable` / `hasColumn`
4. **Overview controller** — `DashboardAnalyticsOverviewController` with `forOverview` slim builders
5. **CRM** — `DashboardAnalyticsContent` loads overview once; children use legacy APIs on filter/page changes

## Routes tracker

See comment block above the overview route in `routes/api.php`.
