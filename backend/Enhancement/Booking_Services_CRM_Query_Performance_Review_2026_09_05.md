# CRM Booking Services — Query Performance Review (2026-09-05)

**Scope:** CRM page `frontend/ecommerce_gentlegurl_crm/src/app/(dashboard)/booking/services/page.tsx` → `BookingServicesTable` (+ ACTION modals: Edit / Create-Copy / Delete / Allowed staff / Bulk / Import-Export).

**Constraint:** Analysis only — no business logic / API shape / UI / pagination behavior changes in this pass.

**Environment (local Postgres):** booking_services=81 · categories=7 · category_pivot=55 · service_staff=235 · store_pivot=87 · primary_slots=2 · questions=104 · question_options=**956** · staffs=12 · store_locations=2 · median of 5 controller benches.

**Prior related work:** Leave pages, appointment history, shop catalog, etc. **No prior dedicated CRM booking-services list/edit review.**

---

## Executive summary

| Area | Local wall | Queries | Top risk |
|------|-----------:|--------:|----------|
| `GET /admin/booking/services?per_page=50` | **~880–1030 ms** | 12–13 | List uses **full `formatService` graph** (questions + **all options** + linked services + staff + slots + product) — table UI ignores most of it |
| SQL portion of list | ~1–3 ms / statement | — | DB is fine locally; wall time is **PHP hydrate + nested sort/map** over large option sets |
| `GET .../services/{id}` (Edit) | ~23 ms | 7 | Acceptable for modal detail |
| `GET .../categories?all=1` | ~79 ms | 12 | Filter dropdown needs **id/name only**, but loads **all services + storeLocations** + N+1 linked product categories |
| Edit/Create “linked service” picker | **N× full list** | huge | FE pages `services?per_page=200` in a loop using the **same heavy index** just for `{id,name,duration,price}` |
| Table column sort | client-only | 0 | Sorts **current page only**; not a DB issue |

**Priority themes**

1. **P0 BE:** Slim list serialization / eager load for table (keep full graph on `show` / write paths) **if** response keys for unused fields can stay empty arrays or match FE needs.
2. **P0 FE/BE:** Stop Edit/Create picker from calling full `services` index; add slim `options` endpoint (id/name/duration/price only).
3. **P1:** Slim `categories?all=1` (or dedicated options) without `services.storeLocations` + fix linked product-category N+1.
4. **P1 indexes:** reverse pivot `(booking_service_id, …)` on category pivot; optional `(created_at DESC)` on `booking_services` for `latest()`.
5. **P2:** `pg_trgm` / dedicated search for name; denormalized staff counts — recommend only.

---

## ACTION / navigation note

Actions stay **on-page modals** (no route change to `/booking/services/[id]`). Still analyzed because Edit / Create-Copy / Allowed-staff / Delete / Bulk / Import-Export each hit APIs:

| Action | UI | APIs |
|--------|----|------|
| **Edit** | `BookingServiceEditModal` | `GET categories?all=1`, `GET services/{id}`, `GET staffs?per_page=200`, **paged `GET services?per_page=200` loop**, `PUT/POST services/{id}` |
| **Copy / Create** | `BookingServiceCreateModal` | same picker stack + optional `GET services/{id}` for copy source + `POST services` |
| **Allowed staff** | side panel | **no fetch** — uses list payload `allowed_staff_names` |
| **Delete** | modal | `DELETE services/{id}` (+ optional dependency check GET) |
| **Bulk update/delete** | modals | `PUT/DELETE services/bulk` |
| **Import / Export** | toolbar | `GET services/export`, `POST services/import` (full dump — expected heavy) |

No separate Edit page route today; recommendations below still apply to modal mount cost.

---

## A) List page first paint

### A1. Services list over-fetches edit graph (P0)

| # | Item | Detail |
|---|------|--------|
| 1 | Page / action | `/booking/services` table load / page / filter / branch change |
| 2 | Frontend | `BookingServicesTable.fetchServices` → `/api/proxy/admin/booking/services?page&per_page&name&is_active&category_id&branch_*` |
| 3 | API | `GET /admin/booking/services` |
| 4 | Backend | `Admin\Booking\ServiceController@index` → `formatService` |
| 5 | Pattern | `with(allowedStaffs, storeLocations, primarySlots, **questions.options.linkedBookingService**, categories, linkedBookingProduct)` → paginate → per-row `formatService` (sort staff, slots, questions, options) |
| 6 | Why slow | Local page of 50 services pulls **hundreds of question options** (956 total in DB). SQL ~12 queries ~15 ms total; **~880 ms wall** dominated by Eloquent + nested PHP. Table mapper only needs: identity, prices, categories, staff **count/names**, branch names, image, flags — **not** questions/options/slots/product detail |
| 7 | Indexes | `booking_services (is_active)`, `(service_type)`; store pivot OK; category pivot PK is `(category_id, service_id)` only — **no leading `booking_service_id`** for reverse eager; questions indexed by service |
| 8 | EXPLAIN | `ORDER BY created_at DESC LIMIT 50` → Seq Scan 81 rows + Sort · **~0.06 ms**. Fine now; grows with catalog |
| 9 | Recommendations | **P0:** List path: eager only `allowedStaffs:id,name`, `storeLocations`, `categories`, optional `linkedBookingProduct` id fields; omit `questions*` / `primarySlots` **or** return empty `questions`/`primary_slots` arrays while preserving keys. Prefer `withCount('allowedStaffs')` + names if payload must match. **Keep full graph on `show`.** |
| 10 | Benefit | Likely **order-of-magnitude** list wall drop (remove option hydrate); smaller JSON |
| 11 | Trade-off | Must keep response keys FE/other consumers expect; verify nothing else uses list questions |
| 12 | Safe? | **Yes** if keys preserved and Edit still uses `show` |

**Bench:** default ~**880 ms** / 12 q · name=`a` ~800 ms / 12 q · branch filter ~**1028 ms** / 13 q.

### A2. Double `whereHas(storeLocations)` + access lookup (P1)

| # | Item | Detail |
|---|------|--------|
| 5–6 | Pattern | `accessibleStoreLocations` query + `whereHas` accessible + optional second `whereHas` for selected branch |
| 8 | EXPLAIN | EXISTS via store pivot · Hash Semi Join · ~0.08 ms locally |
| 9 | Fold into one EXISTS / `whereIn` service ids from pivot when branch set | Low risk |
| 12 | Safe? | Yes if ACL semantics unchanged |

### A3. Filter categories dropdown heavy (P1)

| # | Item | Detail |
|---|------|--------|
| 1–4 | Mount + Edit/Create | `GET /admin/booking/categories?all=1` · `CategoryController@index` |
| 5 | Pattern | `with(['services.storeLocations'…])` + `whereHas(services.storeLocations)` + `formatCategory` loads **linked product category per row (N+1)** |
| 6 | Why slow | FE maps **id / name / cn_name** only for filters; still pays for all services + branches + 7× product-category lookups (~79 ms / 12 q locally; worse with more categories/services) |
| 9 | **P1:** `all=1` or new `options` select only category columns; drop services eager; batch `linked_booking_product_category` if still required for shape |
| 12 | Safe? | Options endpoint additive = safest; slim `all=1` if response consumers tolerate null nested product category / empty store_locations |

### A4. Client-side column sort (note)

| # | Item | Detail |
|---|------|--------|
| 5 | Pattern | `sortedRows` sorts in-memory current page |
| 9 | If true multi-page sort needed later: server `sort` param — **out of scope** unless product asks; not a slow-query bug today |

---

## B) ACTION — Edit modal

### B1. Edit mount burst (P0)

| Call | Role | Issue |
|------|------|--------|
| `GET services/{id}` | form seed | ~23 ms / 7 q — OK; correct place for full graph |
| `GET categories?all=1` | category multi-select | same as A3 |
| `GET staffs?per_page=200&is_active=true` | allowed staff | separate list; watch payload size |
| **Paged `GET services?page&per_page=200` loop** | linked addon service dropdown | Reuses **heavy list** end-to-end; with 81 services ≈ 1× list cost; with hundreds of services ≈ **many × ~1 s** |

| # | Recommendation | Safe? |
|---|---------------|-------|
| 9 | Slim `GET /admin/booking/services/options` (`id,name,cn_name,duration_min,service_price` + branch ACL) for Create/Edit pickers; stop paging full index | **Yes** (additive) |
| 9b | Share categories/staff options from table parent props to avoid remount refetch | FE-only; Yes |

Edit does **not** navigate to another page; still the hottest ACTION path.

### B2. Create / Copy

Same picker stack as Edit; Copy also `GET services/{id}` for source — appropriate. Same P0 slim-options recommendation.

### B3. Allowed staff panel

Local drawer from list names — **no extra query**. Relies on list including `allowed_staff_names` (keep when sliming list).

### B4. Delete / Bulk / Import-Export

| Action | Note |
|--------|------|
| Delete | Mutation + optional pre-check; not list hot path |
| Bulk | Scoped by selected ids |
| Export/Import | Intentionally full-catalog; optimize later if files grow (streaming already on export) |

---

## C) Indexes — gaps & recommendations

| Index | Why | Trade-off |
|-------|-----|-----------|
| `booking_service_category_service (booking_service_id, booking_service_category_id)` | Eager `categories` / reverse lookup currently only has PK starting with **category_id** | Small extra storage; faster writes negligible |
| `booking_services (created_at DESC)` or `(is_active, created_at DESC)` | Supports `latest()` + active filter as catalog grows past Seq Scan comfort | Low |
| `booking_service_staff (staff_id)` | Only if staff→services reverse queries appear; list uses `service_id` leading unique already | Optional |
| `pg_trgm` on `name`/`cn_name` | Leading-wildcard `LIKE %term%` | Write/storage cost — **P2** |

Store location pivot indexes already good (`booking_service_store_lookup`, unique pair).

---

## D) Sample SQL shape (list)

Observed eager chain (abbreviated):

1. ACL role + accessible `store_locations`
2. `count` + page `booking_services` + `EXISTS` store pivot
3. `staffs` via `booking_service_staff`
4. `store_locations` pivot
5. `primary_slots`
6. `questions` → **`question_options` (large IN)** → linked `booking_services`
7. categories pivot + `booking_products`

Steps 5–6 are unnecessary for the CRM table row.

---

## Residual / out of scope

- Changing Edit into a dedicated route page (not present).
- Server-side table sort / infinite scroll.
- Denormalized `allowed_staff_count` column.
- Public booking shop service APIs (different controllers).

---

## Suggested implementation order (when approved)

1. Slim `ServiceController@index` eager + `formatService` list variant (preserve keys).
2. Slim services options endpoint + wire Edit/Create pickers.
3. Slim `categories?all=1` / options + batch linked product category.
4. Add reverse category-pivot + `created_at` indexes.
5. Re-bench list + Edit mount.
