# Wishlist + Product Profit — Query Enhancement (2026-09-05)

Enhancement id: `wishlist-product-profit-query-v1`

**CRM pages**
- `/reports/wishlist` — `WishlistReportPage`
- `/reports/product-profit` — `ProductProfitReportPage`

**Constraint:** Same JSON shapes, filters, stock math, costing (`cost_amount_snapshot`), and status allow-lists.

**Environment:** Local Postgres · products=253 · variants=658 · wishlist hits=3 · orders=1,032 · order_items=2,279 · median of 5.

---

## Verdict

| Path | Before | After | Notes |
|------|--------|-------|-------|
| Wishlist page 15 | ~20 ms / **4** q | ~21 ms / **5** q | TEMP materialize adds 1 statement; catalog work no longer ×3 |
| Product Profit 90d branch | **~41 ms** / 5 q | **~23–28 ms** / 5 q | Indexes + orders-first join |
| Product Profit drawer (`include_details`) | ~full report cost | **~14 ms / 3 q** | List + summary skipped |
| Wishlist `total` / `total_wishlist_adds` | 3 / 3 | **3 / 3** | Preserved |
| Product Profit 90d `total_sales` | 339.7 | **339.7** | Preserved |

Local wishlist volume is tiny — wall time is roughly flat. The structural wins (single materialize, scoped side aggregates, indexes) matter as wishlist / catalog grow.

---

## What landed

### Wishlist — P0/P1
- **TEMP materialize** (Postgres): filtered rows written once; summary / top / page read the temp table
- **Hit-scoped** `product_media` / `product_categories` / `product_variants` via wishlist `product_id` UNION
- **Drive from hits** (`whereIn` wishlisted ids) instead of scan-all-products then filter
- **Pre-aggregated bundle stock** (join + `GROUP BY bundle_variant_id`) replaces per-variant correlated SubPlan

### Product Profit — P0/P1
- **Orders-first** `FROM orders JOIN order_items` (same predicates)
- **Drawer-only path:** `include_details` + `product_id` returns details only (empty `data`, zeroed `summary` keys preserved for shape; FE already ignores them)
- FE categories → `/ecommerce/categories/options/query?per_page=500` (slim id/name)

### Indexes — migration `2026_09_05_000100_add_wishlist_product_profit_query_indexes.php`
| Index | Purpose |
|-------|---------|
| `customer_wishlist_items_product_created_idx` | `GROUP BY product_id` + date filter |
| `guest_wishlist_items_product_created_idx` | same |
| `orders_store_bill_at_coalesce_idx` | branch + `COALESCE(placed_at, created_at)` |
| `order_items_product_line_order_idx` | partial `(product_id, order_id)` for product lines |

### Routes marked
`routes/api.php`:
- `GET /admin/reports/product-profit`
- `GET /ecommerce/reports/wishlist` (+ inventory-detail)
- `GET /ecommerce/reports/product-profit`  
`// NEW ENHANCEMENT — wishlist-product-profit-query-v1`

---

## Deploy notes
1. Run migration `2026_09_05_000100_…` on each environment.
2. No data backfill required.
3. Confirm CRM Product Profit category dropdown still loads (options endpoint).

---

## Trade-offs
- Wishlist TEMP table: +1 DDL statement per request; session-scoped; wins when base query is expensive
- Extra indexes: small storage + slightly slower wishlist writes / order inserts
- Drawer response still includes `data`/`summary` keys but zeros them when details-only (FE unchanged)

---

## Review doc
`Wishlist_Product_Profit_Query_Performance_Review_2026_09_05.md`
