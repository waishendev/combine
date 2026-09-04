# Wishlist + Product Profit Reports — Query Performance Review (2026-09-05)

**Scope**
- CRM Wishlist report — `WishlistReportPage` → `GET /api/ecommerce/reports/wishlist` (+ inventory-detail)
- CRM Product Profit — `reports/product-profit/page.tsx` → `ProductProfitReportPage` → `GET /api/admin/reports/product-profit` (+ categories list)

**Constraint:** Analysis only — no business logic / API / UX changes applied.  
**Environment:** Local Postgres · products=253 · variants=658 · customer_wishlist=0 · guest_wishlist=3 · orders=1,032 · order_items=2,279 · median of 5 wall.

---

## Executive summary

| Call | Wall | Queries | Verdict |
|------|-----:|--------:|---------|
| `GET /ecommerce/reports/wishlist` page 15 | **~20 ms** | **4** | **OK locally** — tiny wishlist volume; structure will hurt at scale |
| Wishlist + month dates / search | **~20 ms** | **4** | Same pattern |
| Wishlist inventory-detail | **~7 ms** | **3** | OK (eager-loads variants + bundle components) |
| `GET /admin/reports/product-profit` current month (branch) | **~25 ms** | **4** | **OK** (empty Sept window in local DB) |
| Product Profit **90d** (branch) | **~41 ms** | **5** | **Watch** — planner starts from `order_items` not `orders` |
| Product Profit 90d all-branches | **~24 ms** | **3** | Same join-order pattern |

**Main findings**
1. **Wishlist** rebuilds a heavy multi-subquery plan **~3× per request** (summary + top products + paginate). Planner cost is dominated by **variant stock SubPlan** (bundle availability correlated subquery). Image/category aggregates scan **all** products, then filter to the few wishlisted rows.
2. **Wishlist indexes missing** for report shape: no `(product_id [, created_at])` on either wishlist table (PK / unique lead with customer/session).
3. **Product Profit** date path already has `orders_bill_at_coalesce_index` (good). On 90d EXPLAIN, Postgres prefers **Bitmap on `order_items.line_type` → Nested Loop to `orders`**, filtering dates late — fine at ~2k lines, risky when `order_items` grows. No `order_items.product_id` index. Detail drawer **re-runs full list + summary** with `include_details=1&per_page=1`.

---

## Page → API map

### Wishlist
| UI | API | Backend |
|----|-----|---------|
| Table + summary cards | `GET /ecommerce/reports/wishlist?page&per_page&search&date_*` | `WishlistReportController@index` |
| Variant stock drawer | `GET …/wishlist/products/{id}/inventory-detail` | `inventoryDetail` |

### Product Profit (`/reports/product-profit`)
| UI | API | Backend |
|----|-----|---------|
| Table + summary | `GET /admin/reports/product-profit?date_*&branch_*&…` | `ProductProfitReportController@index` |
| Category filter options | `GET /ecommerce/categories?page=1&per_page=500` | Categories list (FE-only) |
| Order-item drawer | Same profit endpoint with `include_details=1&product_id=&per_page=1` | `detailRows()` + full list/summary still run |

---

## Root causes & EXPLAIN

### 1. Wishlist — triple execution of expensive base query (high at scale)

`index()` runs:
1. `fromSub(clone $query)` → summary aggregates  
2. `fromSub(clone $query)` → top products at `max_wishlist_count`  
3. `$query->paginate()` → count + page rows  

Each clone re-materializes customer/guest aggregates, cover image `array_agg`, category `array_agg`, and **variant stock** with bundle SubPlan.

**EXPLAIN (summary / page — local):** Hash Left Join of products × wishlist subs × `vs`; planner **cost ~6,700** for variant SubPlan alone; Execution ~**1.2–2.8 ms** with 3 wishlisted products / 658 variants / 36 bundle SubPlan loops.

**Root cause:** Correct results, but work is repeated and work is sized to **catalog**, not **wishlist hits**.

**Safe recommendations**
- **P0:** Materialize one filtered “wishlist_rows” CTE / temp once per request; derive summary, top, and page from it (same columns / sort / filters).
- **P0:** Restrict `product_media` / `product_categories` / `product_variants` subs to `product_id IN (wishlisted ids)` so aggregates don’t scan the full catalog when few products are wishlisted.
- **P1:** Drive from `FULL OUTER JOIN` of customer+guest aggregates → join `products`, instead of `FROM products` + filter `cw OR gw` (avoids scanning all products when wishlist is sparse).

Trade-offs: CTE refactor is logic-preserving if SELECT list / filters stay identical; needs careful regression on stock_status / date / search filters.

---

### 2. Wishlist — missing indexes on wishlist tables (medium → high as volume grows)

| Table | Existing | Gap |
|-------|----------|-----|
| `customer_wishlist_items` | PK `(customer_id, product_id)` | No leading `product_id`; report does `GROUP BY product_id` + optional `created_at` range |
| `guest_wishlist_items` | Unique `(session_token, product_id)` | Same — `product_id` is not leading |

**EXPLAIN:** Seq Scan + HashAggregate on both tables (empty/tiny locally; planner still expects ~1.5k / 300 rows).

**Recommendation (safe):**
```sql
CREATE INDEX … ON customer_wishlist_items (product_id, created_at);
CREATE INDEX … ON guest_wishlist_items (product_id, created_at);
```
Trade-off: small storage + slightly slower wishlist writes; report / date filters become index-friendly.

---

### 3. Wishlist — variant stock correlated SubPlan (medium)

`variantSub` embeds per-variant bundle availability:

```sql
SELECT MIN(FLOOR(component.stock / GREATEST(bundle_item.quantity, 1)))
FROM product_variant_bundle_items …
WHERE bundle_item.bundle_variant_id = v.id …
```

**EXPLAIN:** SubPlan 1 · **loops=36** · Seq Scan on `product_variant_bundle_items` (table small; unique `(bundle_variant_id, component_variant_id)` exists but seq preferred at tiny size).

**Recommendations**
- **P1:** Pre-aggregate bundle availability once (join + GROUP BY `bundle_variant_id`) and join into variant rollup — same `out_of_stock_variant_count` math, no per-row SubPlan.
- Bundle lookup already covered by unique leading `bundle_variant_id` at larger sizes; optional dedicated index only if EXPLAIN still seq-scans after growth.

---

### 4. Product Profit — join order starts from `order_items` on wider windows (medium)

`baseProductItemsQuery` joins `order_items` → `orders` with:

```sql
WHERE COALESCE(o.placed_at, o.created_at) BETWEEN ? AND ?
  AND o.payment_status / status IN (…)
  AND oi.product_id IS NOT NULL
  AND (oi.line_type IS NULL OR oi.line_type = 'product')
```

**EXPLAIN (current month, empty):** Index Scan `orders_bill_at_coalesce_index` → Nested Loop to `order_items` — ideal.

**EXPLAIN (90d branch):** BitmapOr on `order_items_line_type_order_id_index` (218 product lines) → Nested Loop `orders_pkey` with **date/branch/status Filter** · **654 buffers** · ~1 ms SQL each; controller still does **count + page + summary** (≈3× same shape) → wall **~41 ms**.

**Root cause:** Selective date filter is on `orders`, but planner often starts from `line_type` on items. At production item volume this multiplies.

**Safe recommendations**
- **P0:** Prefer `FROM orders o INNER JOIN order_items oi` (same predicates) so planner is nudged toward date index first — verify EXPLAIN; no response change.
- **P0 (index):** Expression composite supporting branch reports, e.g.  
  `(store_location_id, COALESCE(placed_at, created_at))` — complements existing bare coalesce + `(store_location_id, payment_status, status)`.
- **P1:** Partial index on product lines, e.g.  
  `order_items (order_id) WHERE product_id IS NOT NULL AND (line_type IS NULL OR line_type = 'product')`  
  and/or `(product_id, order_id)` for category / detail filters.

Trade-offs: extra indexes → storage + write cost on order insert/update.

---

### 5. Product Profit — detail drawer re-aggregates the full report (medium, UX latency)

FE `loadDetails` calls the **same** index endpoint with `include_details=1&per_page=1`. Controller still runs:
1. Paginated grouped list  
2. Summary aggregates  
3. `detailRows()` (limit 100)

**Recommendation (safe, shape-preserving):** When `include_details` + `product_id` are set, skip list pagination/summary (or return empty `data`/`summary` only if FE already has them — **do not change JSON keys**; prefer keeping summary if FE depends on it). Lowest risk: skip only the expensive **grouped page query** when `per_page=1` and details requested, if FE ignores `data` on drawer loads. Confirm FE uses only `details` in that path (it does).

---

### 6. Product Profit — always LEFT JOIN products + variants (low)

Even with empty search, query left-joins `products` / `product_variants` for `MAX(cn_name)`. **EXPLAIN 90d:** Seq Scan both tables into Hash (~253 + 658 rows).

**Recommendation:** Keep joins (needed for cn_name in response). Optional: only join when `search` non-empty **and** still select cn_name via subquery for page rows only — higher risk of column drift; treat as **P2**.

---

### 7. FE — categories `per_page=500` on Product Profit mount (low)

Separate request; not an N+1 on the profit query. Prefer a lightweight `/categories/options` if one exists (same pattern as commissions review), or cache client-side across reports.

---

## Index inventory (relevant)

| Object | Present | Notes |
|--------|---------|-------|
| `orders_bill_at_coalesce_index` | Yes | Used on empty month window |
| `orders_store_location_payment_status_index` | Yes | Status/payment filter |
| `order_items` by `product_id` | **No** | Detail / category / future filters |
| Wishlist `(product_id, created_at)` | **No** | Report GROUP BY + date |
| `product_media_product_type_sort_idx` | Yes | Cover image path OK |
| `product_variants_product_id_is_active_index` | Yes | Variant rollup OK |

---

## Priority backlog (safe, behavior-preserving)

| Pri | Item | Expected effect |
|-----|------|-----------------|
| P0 | Wishlist: single CTE / shared subquery for summary+top+page | Cut ~2/3 repeated catalog work |
| P0 | Wishlist: `(product_id, created_at)` indexes on both wishlist tables | Scalable GROUP BY / date filter |
| P0 | Product Profit: join from `orders` first + verify EXPLAIN | Avoid full product-line bitmap as data grows |
| P0 | Product Profit: skip grouped list when drawer-only details | Fewer heavy aggregates on click |
| P1 | Wishlist: scope media/category/variant subs to wishlisted IDs | Catalog-sized → hit-sized |
| P1 | Wishlist: pre-aggregate bundle stock (no correlated SubPlan) | Lower variant rollup cost |
| P1 | Indexes: orders `(store_location_id, COALESCE(placed_at,created_at))`; order_items product-line helpers | Better join selectivity |
| P2 | Categories options / lighter FE fetch | Less noise on page load |

---

## What not to change

- Wishlist identity remains **product-level** (no variant wishlist counts).
- Product Profit costing remains **`cost_amount_snapshot` only**; status / payment allow-lists unchanged.
- Response JSON keys, pagination semantics, and default month range for Product Profit stay as-is.

---

*Local wishlist volume is near-zero; treat Wishlist timings as structural risk, not proof of production latency. Re-run EXPLAIN ANALYZE on a prod-like wishlist + order_items snapshot before picking index CONCURRENTLY windows.*
