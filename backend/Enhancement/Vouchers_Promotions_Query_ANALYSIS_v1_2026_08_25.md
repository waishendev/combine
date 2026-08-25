# Vouchers + Promotions — Query ANALYSIS (v1 apply) · 2026-08-25

**Enhancement tag:** `vouchers-promotions-query-v1`  
**Constraint preserved:** same list/show CRUD flows; Create/Edit dropdowns still id/name/(sku); promo option shape unchanged (`cover_image_url`, disabled flags).  
**Env:** Local Postgres · vouchers=2 · promotions=7 · products=250 · product_media=755 · median of 5.

---

## Before → After (median wall)

| Call | Before | After | Δ |
|------|-------:|------:|--:|
| `GET /vouchers` ×50 | 2.9 ms | **2.4 ms** | ≈ flat |
| `GET /vouchers/{id}` | 8.1 ms | **6.7 ms** | ≈ flat |
| **Voucher Create/Edit products picker** | **4607 ms** (legacy ×200) | **64 ms** (`/products/options/query`) | **~72×** |
| Voucher Create/Edit categories picker | 312 ms (legacy) | **28 ms** (`/categories/options/query`) | **~11×** |
| `GET /promotions` ×20 | **125 ms** / 15 q | **73 ms** / **7 q** | **~1.7×**, N+1 gone |
| `GET /promotions/{id}` | 24 ms | 25 ms | ≈ flat (eager images, no N+1) |
| `promotions-product-options` | **223 ms** | **189 ms** | cover-only DISTINCT ON |

Combined voucher modal open (products + categories parallel): **~4.9 s → ~90 ms**.

---

## What shipped

### Frontend
- `VoucherCreateModal` / `VoucherEditModal` →  
  `GET /products/options/query?per_page=200` + `GET /categories/options/query?per_page=200`

### Backend
- `ProductController@optionsQuery` — select `id,name,sku,is_active`, `setAppends([])` (no cover N+1)
- `PromotionController@index` — slim column select (omit `content_html`); nested products `setAppends([])` (list does not need covers)
- `PromotionController@show|store|update` — shared `loadPromotionRelations()` eager-loads product images once
- `PromotionController@productOptions` — Postgres `DISTINCT ON (product_id)` one cover row per product
- Migration `2026_08_25_000900_add_vouchers_promotions_query_indexes.php`:
  - `vouchers (created_at DESC, id DESC)`
  - `vouchers (is_reward_only, is_active, created_at DESC)`
  - `vouchers (type, created_at DESC)`
  - `promotions (priority DESC, id DESC)`
  - `promotions (is_active, priority DESC, id DESC)`
  - `products (is_active, name)`
  - `product_media (product_id, type, sort_order, id)`

### Routes
- `GET /ecommerce/products/options/query` marked `// NEW ENHANCEMENT — vouchers-promotions-query-v1`
- Promotions admin routes block tagged the same

---

## Query log: promotions list (after)

```text
#01 store_locations (accessible POS)
#02 count(*) promotions
#03 select [slim cols] from promotions …
#04 promotion_products IN (…)
#05 products id,name IN (…)
#06 promotion_tiers IN (…)
#07 promotion_store_location join
```

**Before:** same + **8×** `product_media WHERE product_id = ?` (cover_image_url append).

---

## Trade-offs

| Change | Trade-off |
|--------|-----------|
| Indexes | Slightly slower voucher/promo writes; small storage |
| List omits `content_html` | List JSON no longer includes HTML body (CRM list never used it; show/edit still full) |
| List nested product no `cover_image_url` | List UI only used product counts/names; show still has covers |
| product-options still ~189 ms | Mostly PHP URL building for ~246 covers; DB already slim |

---

## Bench artifact

`storage/app/_bench_vouchers_promotions_review.php`
