# CRM Booking Products + Product Categories — Query Performance Review (2026-09-05)

**Scope**
- `frontend/.../booking/products/page.tsx` → `BookingProductsTable`
- `frontend/.../booking/product-categories/page.tsx` → `BookingProductCategoriesTable`
- ACTION modals (Edit / Create / Delete / Bulk / Import-Export / categories drawer)

**Constraint:** Analysis only — no business logic / API shape / UI / pagination / user-flow changes in this pass.

**Environment (local Postgres):** booking_products=69 · product_categories=9 · category_pivot=63 · product_questions=38 · question_options=165 · booking_services=81 · median of 5 controller benches.

**Related prior work:** `booking-categories-crm-query-v1` already slimmed `product-categories?all=1` + paginated list branch join. **Products list itself was not slimmed.**

---

## Executive summary

| Area | Local wall | Queries | Top risk |
|------|-----------:|--------:|----------|
| `GET /admin/booking/products?per_page=50` | **~245–252 ms** | 9–10 | List eager-loads **`questions.options`** (+ linked service stores) — table UI does **not** need questions (Edit uses `show`) |
| `GET /admin/booking/products/{id}` (Edit) | ~16 ms | 4 | Appropriate full graph |
| `GET .../product-categories?all=1` | **~7–8 ms** | 3 | Already slim (prior enhancement) |
| `GET .../product-categories?page&per_page=50` | **~14–18 ms** | 5–6 | Already join-based branches (prior enhancement) |
| Products SQL sort / ACL EXISTS | ~0.1–0.2 ms | — | Fine at n≈69; wall is PHP/hydrate |

**Priority themes**

1. **P0 BE (products list):** Drop `questions.options` from `index` eager load; keep on `show` / write responses. Preserve empty `questions: []` if clients expect the key.
2. **P1:** Slim list `linkedBookingService` to store_locations only (or join branches like categories); avoid full `booking_services.*`.
3. **P1 indexes:** `booking_product_questions(booking_product_id)`; reverse useful for eager; optional `(sort_order, id)` on `booking_product_categories`; expression/`name` support for `ORDER BY COALESCE(name,'')` as catalog grows.
4. **P2:** `pg_trgm` / dedicated search for `LOWER(name|barcode) LIKE %…%` + category name `orWhereHas`.

---

## ACTION / navigation note

Both pages keep **on-page modals** (no `/products/[id]` route). Still analyzed because Edit/Create hit APIs:

### Products `/booking/products`

| Action | UI | APIs |
|--------|----|------|
| **Edit** | `BookingProductUpsertModal` | `GET products/{id}` (full + questions) then PUT; categories from mount `product-categories?all=1` |
| **Create** | Same modal | `POST products`; same category options |
| **Delete / Bulk** | Modals | `DELETE` / `PUT|DELETE products/bulk` |
| **Categories cell** | Side panel | Local from list row `categories` — **no fetch** |
| **Import / Export** | Toolbar | Full dump — expected heavy |
| Cross-link | Breadcrumb / filters only | No Edit→other page navigation |

### Product categories `/booking/product-categories`

| Action | UI | APIs |
|--------|----|------|
| **Edit / Create / Delete / Bulk** | Modals | `GET` not required for Edit (row payload) / `PUT` / `POST` / `DELETE` / bulk |
| **Import / Export** | Toolbar | Full dump |
| Cross-link | From `/booking/categories` breadcrumb | Separate page; list already optimized |

---

## A) Booking Products list

### A1. List over-fetches questions graph (P0)

| # | Item | Detail |
|---|------|--------|
| 1 | Page | `/booking/products` first paint / page / filter / branch |
| 2 | Frontend | `BookingProductsTable.fetchProducts` → `/api/proxy/admin/booking/products?...` |
| 3 | API | `GET /admin/booking/products` |
| 4 | Backend | `BookingProductController@index` |
| 5 | Pattern | `with(['categories', '**questions.options**', 'linkedBookingService.storeLocations'])` + `whereHas(linkedBookingService.storeLocations)` + `orderByRaw(COALESCE(name,''))` |
| 6 | Why slow | Table needs price, barcode, categories, image, activity, optional branch names. **Questions only used after Edit `show`**. Eager pulls questions + options for every list row (~165 options locally) → ~250 ms wall while SQL statements are ~1 ms each |
| 7 | Indexes | `booking_products (is_active, name)`, `(barcode)`; **no** `booking_product_questions(booking_product_id)` beyond FK default?; pivot has product↔category unique + category_id index |
| 8 | EXPLAIN | Sort by `COALESCE(name,'')` → Seq Scan 69 + Sort · **~0.14 ms**. ACL EXISTS via linked service + store · **~0.18 ms** |
| 9 | Recommendations | **P0:** Remove `questions.options` from list `with` (or return `questions: []`). **Keep** on `show` (Edit already refetches). **P1:** Select lean product columns; load store locations via join / `linkedBookingService:id` + stores only |
| 10 | Benefit | Similar win to booking **services** list (drop question hydrate) |
| 11 | Trade-off | If any consumer relied on list `questions`, must keep empty array key |
| 12 | Safe? | **Yes** if Edit continues to use `show` |

**Bench:** default ~**252 ms** / 9 q · search=`a` ~243 ms / 9 q · branch ~246 ms / 10 q.

### A2. Search non-sargable (P1/P2)

| # | Detail |
|---|--------|
| 5 | `LOWER(COALESCE(name,'')) LIKE %kw%` OR barcode OR `orWhereHas(categories…)` |
| 8 | Seq Scan + filter · ~0.07 ms at n=69 |
| 9 | P1: keep semantics; P2: `pg_trgm` GIN if search becomes hot |

### A3. Filter categories dropdown (already good)

| # | Detail |
|---|--------|
| 2–3 | Mount `product-categories?all=1` |
| 4–6 | Already slim (~7.5 ms / 3 q) after `booking-categories-crm-query-v1` |
| 12 | No further change required for this page |

### A4. Edit ACTION (appropriate)

| # | Detail |
|---|--------|
| 2 | `openEditModal` → `GET products/{id}` |
| 4 | `show` with `categories` + `questions.options` · ~16 ms / 4 q |
| 9 | Correct place for full graph — do not slim `show` |

---

## B) Booking Product Categories list

### B1. Paginated list (already enhanced)

| # | Item | Detail |
|---|------|--------|
| 1–4 | `/booking/product-categories` | `GET .../product-categories?page&per_page` |
| 5–6 | Prior join for `store_locations`; no products Eloquent graph | ~**14–18 ms** / 5–6 q |
| 8 | `ORDER BY sort_order, id` Seq Scan 9 rows · ~0.02 ms |
| 9 | **P1 optional:** index `(sort_order, id)` when categories grow; reverse pivot already partially covered |
| 12 | Low urgency locally |

### B2. Edit ACTION

| # | Detail |
|---|--------|
| 2 | Edit modal uses **row from list** (no extra GET show) |
| 9 | Fine; mutations only |

### B3. ACL `whereHas(products.linkedBookingService.storeLocations)`

| # | Detail |
|---|--------|
| 6 | Deep EXISTS — necessary for branch ACL; OK at current size |
| 9 | P2: denormalized “has accessible branch” flag only if this becomes slow |

---

## C) Indexes — gaps & recommendations

| Index | Why | Trade-off |
|-------|-----|-----------|
| `booking_product_questions (booking_product_id)` (+ options by question_id if missing) | Faster when `show`/export loads questions; list should stop needing this if P0 lands | Low |
| `booking_product_categories (sort_order, id)` | List/order as rows grow beyond Seq Scan comfort | Low |
| `booking_services (linked_booking_product_id)` | Already **unique** — good for product↔service reverse | — |
| `pg_trgm` on product name/barcode | Leading-wildcard search | Write/storage — **P2** |

Existing useful indexes: `booking_products (is_active, name)`, barcode; category pivot unique + category_id.

---

## D) Sample SQL shape (products list today)

1. ACL + accessible stores  
2. count + page products (`EXISTS` linked service → stores)  
3. categories pivot  
4. **questions** → **question_options** (unnecessary for table)  
5. linked `booking_services` + store_locations  

Steps 4 are the main list cost.

---

## Suggested implementation order (when approved)

1. Slim `BookingProductController@index` eager (no questions; keep keys empty if needed).  
2. Lean select / store-location join for list branches.  
3. Question / category sort indexes.  
4. Re-bench products list + Edit show (must stay correct).  
5. Leave product-categories list as-is unless growth demands sort index.

---

## Residual / out of scope

- Changing Edit into a dedicated route page.  
- Denormalized sold/usage counters.  
- Public booking shop product APIs.
