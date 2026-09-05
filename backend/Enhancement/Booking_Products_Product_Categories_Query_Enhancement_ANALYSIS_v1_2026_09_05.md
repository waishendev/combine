# CRM Booking Products + Product Categories — Query Enhancement ANALYSIS v1 (2026-09-05)

Enhancement id: `booking-products-crm-query-v1`

**CRM pages**
- `/booking/products` (`BookingProductsTable` + Edit / Create / Delete / Bulk / Import-Export)
- `/booking/product-categories` (`BookingProductCategoriesTable` — already slim from `booking-categories-crm-query-v1`; sort index added here)

**Review:** `Booking_Products_Product_Categories_Query_Performance_Review_2026_09_05.md`  
**Constraint:** No business logic / ACTION navigation / pagination / filter semantics changes. List keeps `questions: []`. Full questions graph still on `show` / create / update / export.

**Environment:** Local Postgres · booking_products=69 · product_categories=9 · product_questions=38 · question_options=165 · median of 5 controller benches.

---

## Verdict

| Call | Before | After | Delta |
|------|--------|-------|-------|
| **Products list** `per_page=50` | **~245–252 ms** / 9–10 q | **~141 ms** / **6 q** | Drop `questions.options` + lean columns + slim linked service |
| Products list + search=`a` | ~243 ms / 9 q | **~139 ms** / 6 q | Same |
| `GET products/{id}` (Edit) | ~16–21 ms / 4–5 q | **~21 ms** / 5 q | Unchanged full graph (correct) |
| Product-categories list | ~14–18 ms / 5–6 q | **~16 ms** / 4 q | Already join-slim; + `(sort_order, id)` index |
| `product-categories?all=1` | ~7–8 ms / 3 q | **~9 ms** / 2 q | Already slim (prior) |

ACTION UX unchanged: Edit / Create / Delete / Bulk stay **on-page modals**. Edit still refetches `show` for questions.

---

## What was wrong

`GET /admin/booking/products` eager-loaded **`questions.options`** for every list row (~38 questions / ~165 options locally) even though the table never renders questions. Edit already calls `GET products/{id}`. List also hydrated full `linkedBookingService.*` when only `store_locations` matter for “Available At”.

Product-categories page was already optimized in `booking-categories-crm-query-v1` (branch join / `all=1` id-name). Remaining win: sort index as rows grow.

---

## What landed

### Backend — products list slim
- `BookingProductController@index`: explicit column `select`; eager `categories:id,name,cn_name` + `linkedBookingService:id,linked_booking_product_id` + filtered `storeLocations`.
- **No** `questions.options` on list; `setRelation('questions', collect())` so payload still has `questions: []`.
- Nested service `setAppends([])` to avoid unused `image_url` on list.
- `show` / `store` / `update` / `exportCsv` still load `categories` + `questions.options`.

### Indexes
Migration: `2026_09_05_000800_add_booking_products_crm_query_indexes.php`

| Index | Table | Why |
|-------|--------|-----|
| `(booking_product_id)` | `booking_product_questions` | Faster Edit/export question hydrate |
| `(booking_product_question_id)` | `booking_product_question_options` | Same for options |
| `(sort_order, id)` | `booking_product_categories` | List / picker order as catalog grows |

Trade-off: small write overhead + storage; safe / reversible.

### Routes tagged
`routes/api.php` — `booking-products-crm-query-v1` on products apiResource; product-categories comment notes sort index.

### Frontend
No FE changes required (Edit already uses `show`; table ignores questions).

---

## ACTION map

### `/booking/products`

| Action | UI | APIs / change |
|--------|----|----------------|
| **Edit** | Modal | `GET products/{id}` still full + questions — **unchanged** |
| **Create** | Modal | `POST products`; categories from slim `product-categories?all=1` |
| **Delete / Bulk** | Modals | Mutations only |
| **Categories cell** | Side panel | Local from list `categories` |
| **Import / Export** | Toolbar | Full dump (still loads questions) |

### `/booking/product-categories`

| Action | UI | Change |
|--------|----|--------|
| Edit / Create / Delete / Bulk | Modals | None (row payload / mutations) |
| Import / Export | Toolbar | Full dump by design |

No separate Edit page routes.

---

## EXPLAIN / SQL after

**List sample:** 6 queries — ACL, count, page products, categories pivot, linked services, store locations. **No** questions / options.

**Sort SQL (69 rows):** Seq Scan + Sort · **~0.3 ms** (expected at this size; wall is PHP hydrate).

---

## Residual / P2

- Products list wall ~141 ms vs ~1 ms SQL — further join-based stores (skip Eloquent nested service) optional.
- `LOWER(... ) LIKE %term%` search → `pg_trgm` if search becomes hot.
- Product-categories deep ACL `whereHas(products.linkedBookingService.storeLocations)` fine at n=9.

---

## Files touched

**BE:** `BookingProductController.php`, `routes/api.php`, migration `000800`  
**Docs:** this ANALYSIS · prior Review unchanged  
**FE:** none
