# Vouchers + Promotions — Query Performance Review (2026-08-25)

**Scope**
- CRM `/voucher` — `VoucherTable` list + Create / Edit / Details / Delete modals
- CRM `/promotions` — `PromotionsTable` list + Create / Edit / View drawer / Delete
- Related (same voucher APIs): `/rewards/vouchers` (same list flags), `/vouchers/assign-logs` (sibling page)

**Constraint:** Analysis only — no business logic / API / UX changes applied.  
**Environment:** Local Postgres · vouchers=2 · promotions=7 · promotion_products=8 · products=250 · product_media=755 · categories=101 · median of 5 wall.

---

## Executive summary

| Call | Wall | Queries* | Payload | Verdict |
|------|-----:|---------:|--------:|---------|
| `GET /ecommerce/vouchers` ×50 | **~3 ms** | 3 | 0.5 KB | OK |
| `GET /ecommerce/vouchers/{id}` show | **~8 ms** | 6 | 0.4 KB | OK |
| **Create/Edit deps: legacy `products?per_page=200`** | **~4607 ms** | ~189 | **~955 KB** | **Critical** |
| Create/Edit deps: `categories?per_page=200` | ~312 ms | 9 | 72 KB | Slow (already have slim options/query) |
| `GET /ecommerce/promotions` ×20 | **~125 ms** | **~15** | 12 KB | Slow for 7 rows |
| `GET /ecommerce/promotions/{id}` show | ~24 ms | 15 | 1.7 KB | Acceptable; same append N+1 risk |
| `GET /ecommerce/promotions-product-options` | **~223 ms** | ~6 | **61 KB** | Hot on Create/Edit |
| Delete (voucher / promotion) | single `DELETE` | 1–few | — | OK |

\*Single instrumented run for promotions list = **15 queries** (multi-run median showed inflated q from listener stacking).

**Main bottlenecks are not the voucher list itself** — they are (1) voucher Create/Edit loading the **full legacy products index**, and (2) promotions list/options over-fetching + **`Product::$appends['cover_image_url']` N+1**.

---

## Page → API map

### CRM `/voucher`
| UI | API | Notes |
|----|-----|--------|
| List / filter / page | `GET /ecommerce/vouchers` | `code`, `type`, `is_active`, `is_reward_only`; `orderByDesc(created_at)` |
| Create modal open | `GET /products?per_page=200` + `GET /categories?per_page=200` | Scope dropdowns |
| Create submit | `POST /ecommerce/vouchers` | Sync products/categories pivots |
| Edit modal open | show + same products/categories ×200 | |
| Edit submit | `PUT /ecommerce/vouchers/{id}` | |
| Details modal | `GET /ecommerce/vouchers/{id}` | Eager `products`, `categories` |
| Delete | `DELETE /ecommerce/vouchers/{id}` | |

### CRM `/promotions`
| UI | API | Notes |
|----|-----|--------|
| List / filter / page | `GET /ecommerce/promotions` | Eager products + tiers + branches; branch access service |
| Create / Edit form | `GET /promotions-product-options` (+ `editing_promotion_id`) | All active products + all images |
| Form branches | `GET /store-locations?per_page=100` | Offline branch multi-select |
| View drawer / Edit load | `GET /promotions/{id}` | |
| Create / Update | `POST` / `PUT /promotions` | Sync products, tiers, store locations |
| Delete | `DELETE /promotions/{id}` | |

---

## Root causes & EXPLAIN

### 1. Voucher Create/Edit: legacy products list (critical)

`VoucherCreateModal` / `VoucherEditModal` call:

```text
GET /ecommerce/products?page=1&per_page=200
GET /ecommerce/categories?page=1&per_page=200
```

Bench (same stack as Products review):

| Endpoint | Wall | Payload | Queries |
|----------|-----:|--------:|--------:|
| Legacy `products` ×200 | **4607 ms** | 955 KB | 189 |
| Slim `products/query` ×200 no variants | 1042 ms | 256 KB | 15 |
| Legacy `categories` ×200 | 312 ms | 72 KB | 9 |
| Slim `categories/options/query` ×200 | **42 ms** | 12 KB | 6 |

**Root cause:** Full product serialization (variants, media, appends, etc.) for a dropdown that only needs **id / name** (and maybe sku). Categories similarly over-fetch vs options/query.

**Recommendation (safe when approved):** Point voucher modals at existing slim query/options endpoints (FE-only). Preserve dropdown behavior and submit payload. **Zero API contract change** if query responses still expose `id`/`name`.

---

### 2. Promotions list: `cover_image_url` N+1 (high)

`PromotionController@index` eager-loads:

```php
'promotionProducts.product:id,name',
'promotionTiers',
'offlineStoreLocations' => …
```

`Product` has `$appends = ['cover_image_url']`. Serializing nested products runs `getCoverImageUrlAttribute()`, which **queries `product_media` per product** when `images` is not loaded.

**Query log (promotions ×20, 7 rows, 8 products):**

```text
#01 store_locations (accessible POS)
#02 count(*) promotions
#03 select * from promotions …          -- full row incl. content_html
#04 promotion_products WHERE promotion_id IN (…)
#05 products id,name WHERE id IN (…)
#06 promotion_tiers WHERE promotion_id IN (…)
#07 promotion_store_location join
#08–#15 product_media WHERE product_id = ?   -- N+1 (one per product)
```

Wall **~125 ms** / SQL **~53 ms** for only 7 promotions — scales with products per page, not promotion count.

**EXPLAIN** base list sort (tiny table today):

```text
Sort → Seq Scan on promotions (7 rows) · Execution Time: 0.109 ms
```

Indexes today: **PK only** on `promotions`. Sort/filter indexes help at scale but are **not** the current 125 ms cause.

**Recommendation:**
- **P0 / safest shape-preserving:** Eager-load cover media with the nested product, **or** `setAppends([])` on nested products for list if FE list does not use `cover_image_url` (list UI uses product **count**, not covers — confirm before removing append).
- Prefer: `with(['promotionProducts.product' => fn ($q) => $q->select(...)->with([...])])` limited images — keeps append if present, kills N+1.
- Trade-off of removing append: response JSON loses `cover_image_url` on nested products (list likely unused; View/Edit may still want it on show).

---

### 3. Promotions list: `SELECT *` + wide `content_html`

EXPLAIN width on promotions ≈ **4156** bytes/row locally. List UI needs name, flags, priority, product/tier counts, branches — **not** HTML body.

**Recommendation:** `select()` only list columns (keep same JSON keys filled / null as today if FE ignores missing HTML). **Medium care** if any client reads `content_html` from list.

---

### 4. Create/Edit: `promotions-product-options` over-fetch

```php
Product::where('is_active', true)
  ->with(['images' => …])   // ALL images per product
  ->orderBy('name')
  ->get(['id','name']);
```

Plus full `promotion_products ⋈ promotions` map.

Bench: **~223 ms** wall · **61 KB** · images eager for **246** products / **755** media rows. SQL ~28 ms; wall dominated by PHP / URL accessors (`thumbnail_url` / `url`).

**EXPLAIN** active products: Seq Scan + Sort · **1.2 ms** (246 rows) — DB is fine; payload/CPU is the cost.

**Recommendation:**
- Limit images to **1 cover** (`limit(1)` / constrained relation).
- Optional: index `(is_active, name)` on products for options sort (minor at 250 rows).
- `promotion_products` already unique on `product_id` — map query is fine.

Trade-off: cover-only still returns same option shape (`cover_image_url` from first image).

---

### 5. Voucher list / show / delete — currently fine

**EXPLAIN** `ORDER BY created_at DESC LIMIT 50`: Seq Scan + Sort · **0.07 ms** (2 rows).

Indexes today: PK + `vouchers_code_unique` only.

**Scale recommendations (low risk):**
- `(created_at DESC)` for admin list
- `(is_reward_only, is_active, created_at DESC)` for voucher vs rewards tabs
- Pivot FKs: `voucher_products` / `voucher_categories` have composite unique on `(voucher_id, *)` — show sync OK; optional reverse indexes `(product_id)` / `(category_id)` only if you query “vouchers for product” often (not these pages)

Delete: simple destroy — no performance issue.

---

### 6. Promotion show / create / update / delete

- **Show:** ~24 ms; same append N+1 risk on nested products (query log style).
- **Store/Update:** transactional writes + sync pivots/tiers — not list latency; indexes on `(promotion_id, …)` already exist for tiers/products.
- **Delete:** single row delete (+ cascade if configured) — OK.
- **Branch filter `orWhereHas`:** can get expensive with many promotions × branches; currently 7 rows. Index on `promotion_store_location` PK already covers `(promotion_id, store_location_id)`.

---

### 7. Sibling: assign-logs (related navigation)

`VoucherAssignLogController` uses `with(['admin','customer','voucher'])` + date filters + `whereHas` search. Not opened from the voucher table actions directly, but same product area. Worth indexing `(assigned_at)` / `(voucher_id, assigned_at)` when that page is reviewed — **out of critical path for this review’s two pages**.

---

## Missing indexes (summary)

| Table | Today | Suggested | Why |
|-------|-------|-----------|-----|
| `vouchers` | PK, unique `code` | `(created_at DESC)`; `(is_reward_only, is_active, created_at DESC)` | List sort / tab filters |
| `promotions` | PK only | `(priority DESC, id DESC)`; optional `(is_active)` | List order / active filter |
| `products` | (existing catalog indexes) | `(is_active, name)` | product-options sort |
| `product_media` | `(product_id, type)` | optional `(product_id, type, sort_order, id)` | Cover-first lookups |
| `promotion_products` | unique product_id + (promotion_id, product_id) | OK | — |
| `promotion_tiers` | unique (promotion_id, min_*) | OK | — |
| `promotion_store_location` | PK (promotion_id, store_location_id) | OK | — |

Trade-off for all indexes: small extra storage + slightly slower writes on create/update — acceptable for admin CRM tables.

---

## Recommended safe optimizations (do not apply in this review)

| # | Change | Why | Trade-off | Behavior risk |
|---|--------|-----|-----------|---------------|
| **P0** | Voucher Create/Edit → `products/query` (+ no variants) + `categories/options/query` | −4.6 s / −955 KB on modal open | FE must map same id/name fields | Low if dropdown-only fields |
| **P0** | Kill promotions list `cover_image_url` N+1 (eager 1 image or unset appends on nested product) | −8 queries/page locally; scales with products | Confirm list JSON needs cover | Low–medium |
| **P1** | `productOptions`: load **one** cover image only | −wall / −payload on Create/Edit | Same option shape | None |
| **P1** | Index `promotions (priority, id)` + voucher list indexes | Sort/filter at growth | +storage | None |
| **P2** | Slim promotions list columns (omit `content_html`) | Smaller rows / less I/O | Must keep FE happy | Medium if anything reads HTML from list |
| **P2** | Cache product-options briefly per admin session | Fewer full scans while editing | Stale disable flags if concurrent edits | Medium |

**Already OK / skip:** Voucher list itself; voucher/promotion DELETE; voucher show at current pivot sizes.

---

## Suggested apply order (when approved)

1. FE: voucher Create/Edit slim catalog endpoints (largest user-visible win).
2. BE: promotions list nested-product append / eager cover (fixes N+1 without UX change).
3. BE: productOptions cover-only eager load.
4. Migration: voucher + promotions list indexes.
5. Optional: slim promotions `select` for list.

---

## Bench artifact

`backend/ecommerce_gentlegurl_backend_api/storage/app/_bench_vouchers_promotions_review.php`
