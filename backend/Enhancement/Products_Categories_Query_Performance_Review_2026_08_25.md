# CRM Products + Categories — Query Performance Review (2026-08-25)

**Scope:**  
- `/product` (list + Create / Edit / Delete / bulk / stock adjust / CSV / filter)  
- `/categories` (list + Create / Edit / Delete / bulk / CSV)  
- Nested: `/product/create`, `/product/[id]/edit`, stock-movements link from product list  

**Constraint:** Analysis only — no business logic / API / UX changes.  
**Environment:** Local Postgres · superadmin · dataset below.

---

## Dataset (local)

| Table | Rows |
|------:|-----:|
| `products` | 249 |
| `product_variants` | 653 |
| `product_media` | 755 |
| `product_categories` | 402 |
| `categories` | 101 |
| `category_shop_menu_items` | 99 |
| `store_location_product` | 257 |
| `store_location_product_inventories` | 735 |

---

## Page → API map

### `/product` first paint (2 APIs after auth)

| Call | Endpoint | Backend |
|------|----------|---------|
| List | `GET /ecommerce/products?page&per_page=50&is_reward_only=false&…` | `ProductController@index` |
| Category filter options | `GET /ecommerce/categories?page=1&per_page=1000` | `CategoryController@index` |

### Product actions

| Action | API | Notes |
|--------|-----|-------|
| Create / Edit pages | `GET/POST/PUT …/products`, categories `per_page=200` | `show` / `store` / `update` heavy `load` |
| Delete / bulk delete | `DELETE …/products/{id}`, `DELETE …/products/bulk` | Asset cleanup + delete |
| Bulk update | `PUT …/products/bulk` (+ categories 1000) | Per-row sync; SKU prefix → many `exists()` |
| Stock adjust | `POST …/products/{id}/stock-adjustment` | Heavy reload then **full list refetch** |
| Export / Import | `GET …/export`, `POST …/import` | Unbounded `get()` / all-sku pluck |
| Media reorder (edit) | `PUT …/products/{id}/media/reorder` | Per-row saves |
| Column sort | Client-only on current page | No DB sort |

### `/categories` first paint

| Call | Endpoint | Backend |
|------|----------|---------|
| List | `GET /ecommerce/categories?page&per_page&name&is_active&branch…` | `CategoryController@index` |

FE also sends `slug` — **backend ignores it**.

### Category actions

| Action | API |
|--------|-----|
| Create open | `GET /shop-menu-items/query` (already slim) |
| Create / Edit / Delete | `POST/PUT/DELETE …/categories` |
| Edit open | `GET …/categories/{id}` (+ menus query) |
| Bulk / Export / Import | `PUT …/bulk`, `GET …/export`, `POST …/import` |

**No CRM move/reorder/tree UI** for ecommerce categories (`parent_id` / `sort_order` exist in API only). “Move position” style actions on these pages are product **media reorder** (edit form) and list **pagination/filter**, not category tree moves.

---

## Benchmark (local · median of 5)

| Call | Wall | SQL | Queries | Payload |
|------|-----:|----:|--------:|--------:|
| **Products list** `per_page=50` | **772 ms** | 15.5 ms | 12 | **249 KB** |
| Products list (branch scoped) | 822 ms | 17.6 ms | 12 | 249 KB |
| **Categories filter** `per_page=1000` (product page) | **197 ms** | 13.9 ms | 3 | **70 KB** |
| Categories list `per_page=50` | 105 ms | 8.6 ms | 3 | 41 KB |
| Categories list (branch) | 128 ms | 18.3 ms | 5 | 40 KB |
| Product `show` (edit) | 28 ms | 7.1 ms | 7 | 2.9 KB |
| Category `show` | 7 ms | 2.0 ms | 2 | 0.5 KB |

**Takeaway:** Product list wall ≫ SQL — cost is **eager-loading + serializing** full `categories` + **all images/video** + **all variants** + `storeLocations` (+ inventories) for 50 rows (~249 KB). Categories filter dropdown on product page is a second heavy hit (1000 rows + `shopMenus` + `withCount`).

---

## EXPLAIN ANALYZE — root causes

### 1) Product list page (`ORDER BY id DESC LIMIT 50`, `is_reward_only=false`)

```
Index Scan Backward on products_pkey
Filter: (NOT is_reward_only)
Execution Time ≈ 0.09 ms
```

Base page fetch is fine. Missing dedicated `(is_reward_only, id DESC)` means filter is applied after PK scan — OK at n=249; matters when many reward-only rows.

### 2) Name / SKU `LIKE %…%`

```
Index Scan Backward + Filter name ILIKE
SKU path: Seq Scan on product_variants for ILIKE (653 rows)
```

Leading-wildcard LIKE **cannot use** `products_sku_unique` / name btree efficiently. Variant SKU search Seq Scans variants.

### 3) `category_id` via `product_categories`

```
Seq Scan on product_categories Filter category_id=…
Unique index is (product_id, category_id) — wrong leading column for reverse lookup
```

**Missing:** `product_categories (category_id)` (or `(category_id, product_id)`).

### 4) Categories `ORDER BY sort_order`

```
Sort → Seq Scan on categories (101 rows)
```

**Missing:** `categories (sort_order)` (optional `(is_active, sort_order)`).

### 5) `withCount(products)` pattern

```
Per-category SubPlan: Seq Scan product_categories Filter category_id
loops=50 → ~2.9 ms locally; scales poorly
```

Same missing `category_id` index; ideally replace correlated count with a single grouped join when shaping a slim list API later.

### 6) Branch-scoped categories

Hash join via `product_categories` × `store_location_product` — OK locally; uses existing pivot uniques. Cost rises with catalog size + double work (`whereHas` filter **and** constrained `withCount`).

---

## Findings by priority

### P0 — Safe indexes (no API/UX change)

| Index | Why | Trade-off |
|-------|-----|-----------|
| `product_categories (category_id)` or `(category_id, product_id)` | Category filter `whereHas`, `withCount`, category→products | Small; faster category attach writes slightly |
| `categories (sort_order)` | List / export ORDER BY | Small |
| `categories (is_active, sort_order)` | Status filter + sort | Small |
| `products (is_reward_only, id DESC)` partial or composite | Default product CRM list always sends `is_reward_only=false` | Small; helps as reward catalog grows |
| Optional `products (is_active, id DESC)` | Status filter | Note: `(is_active, name)` already exists |

Already present (verified): product PK/sku/slug/barcode uniques; `products_is_active_name_index`; variant `(product_id, is_active)`; media `(product_id, type)`; SLP/SLPI uniques; **category pivot FK indexes** (from catalog-menus-v1).

### P1 — Over-fetch (response-shape careful)

| Issue | Evidence | Safe approach later |
|-------|----------|---------------------|
| Product list loads full media + all variants + storeLocations | 772 ms wall / 249 KB / SQL 15 ms | New slim `/products/query` for table; keep legacy `index` |
| Product page loads categories `per_page=1000` full graph | 197 ms / 70 KB | Slim categories options (`id,name,slug` only) endpoint |
| Category index eager `parent` unused in `formatCategory` | Wasted relation | Drop from index query only after confirming no client uses nested parent object (format doesn't expose parent object) |
| Category index loads full `shopMenus` models | Only `id/name/slug` needed in format | `shopMenus:id,name,slug` select — **same keys**, smaller rows (low risk if audited) |
| FE `slug` filter ignored | Dead query param | Wire BE or stop sending (behavior change if wired) |

### P2 — Write / action paths

| Path | Hot spot | Recommendation | Risk |
|------|----------|----------------|------|
| Stock adjust | Response reloads full product graph; FE refetches entire list | Return slim ack; list patch local row | Medium if FE expects full product |
| Bulk update SKU prefix | Per-candidate `exists()` loops | Batch existence set in memory | Low if results identical |
| Export products | Unbounded with variants+bundles | Stream / chunk | Low if CSV columns stable |
| Import products | Pluck all SKUs/slugs; row creates | Keep; index helps uniqueness checks | — |
| Media reorder | N updates | Single CASE/`upsert` | Low |
| Product create/update response | Heavy `load` after save | OK for edit form; don't use for list refresh | — |
| Category import | Multi-pass + all menus in memory | Fine at n=101; watch growth | — |
| Category delete | Simple delete | Light | — |

### P3 — UX / query patterns

- Client-only column sort on both tables (current page only).
- Product first paint = **list + categories×1000** — sequential client waterfalls amplify perceived slowness.
- No category tree move in CRM — out of scope for “move to another position” unless product media reorder.

---

## Recommended apply order (when approved)

1. **P0 indexes** — especially `product_categories(category_id)` + `categories(sort_order)`.  
2. Slim **categories options** query for product filter dropdown (biggest second paint).  
3. Slim **`/products/query`** for ProductTable (largest win).  
4. Tighten category index selects (`shopMenus` columns; drop unused `parent`).  
5. Soften stock-adjust / bulk-prefix / export after measured prod pain.

---

## Controllers / files

- `ProductController::{index,store,show,update,adjustStock,exportCsv,importCsv,bulkUpdate,bulkDelete,destroy}`
- `CategoryController::{index,store,show,update,destroy,bulkUpdate,exportCsv,importCsv,formatCategory}`
- `ProductMediaController::reorder`, `ProductVariantBundleItemController`, `ProductStockMovementController`
- FE: `ProductTable.tsx`, `ProductForm.tsx`, `CategoryTable.tsx`, create/edit/delete/bulk modals
