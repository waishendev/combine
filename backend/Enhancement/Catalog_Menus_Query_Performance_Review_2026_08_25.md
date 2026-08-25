# CRM Catalog Menus — Query Performance Review (2026-08-25)

**Scope:**  
- `/shop-menu` (list + Create / Edit / Delete / move / CSV)  
- `/services-menu` (list + Create / Edit / Delete / move)  
- `/services-pages` (list)  
- Nested: `/services-pages/create`, `/services-pages/[menuId]` (editor Save / Delete / preview)

**Constraint:** Analysis only — no business logic / API contract / UX changes proposed as required.  
**Environment:** Local Postgres · superadmin · dataset below.

---

## Dataset (local)

| Table | Rows |
|-------|-----:|
| `shop_menu_items` | 11 |
| `services_menu_items` | 3 |
| `services_pages` | 3 |
| `services_page_slides` | 12 |
| `category_shop_menu_items` | **99** |

At this size, Postgres correctly prefers **Seq Scan + Sort** for menu lists. Index recommendations are for **production growth** and for the pivot join already at 99 rows.

---

## Page → API map

| Page / action | Client | Backend |
|---------------|--------|---------|
| Shop list | `GET /ecommerce/shop-menu-items?page&per_page` | `ShopMenuItemController@index` |
| Shop create | `POST .../shop-menu-items` | `store` |
| Shop edit open | `GET .../{id}` | `show` |
| Shop edit save | `PUT .../{id}` | `update` |
| Shop delete | `DELETE .../{id}` | `destroy` |
| Shop move | `POST .../move-up\|move-down` | `moveUp` / `moveDown` |
| Shop CSV | `GET .../export`, `POST .../import` | `exportCsv` / `importCsv` |
| Services menu list | `GET /ecommerce/services-menu-items` | `ServicesMenuItemController@index` |
| Services menu CUD / move | same resource | `store` / `show` / `update` / `destroy` / move |
| **Services pages list** | `GET /ecommerce/services-menu-items?per_page=200` | **same `index`** (uses nested `page`) |
| Pages create wizard | `GET services-menu-items?per_page=200` (+ optional menu create) | `index` / `store` |
| Pages editor | `GET /ecommerce/services-pages/{menuId}` | `ServicesPageController@show` |
| Pages save | `POST .../services-pages/{menuId}` (`_method=PUT`) | `upsert` |
| Pages delete | `DELETE .../services-pages/{id}` | `destroy` |
| Preview chrome | `GET .../services-pages/preview-config` | `previewConfig` |

Note: `ServicesPageController@index` exists but is **not used** by the CRM list UI.

---

## Benchmark (local · median of 5)

| Call | Wall | SQL | Queries | Payload |
|------|-----:|----:|--------:|--------:|
| Shop menu `index` (per_page=50) | **297 ms** | 4.4 ms | 3 | **64.4 KB** |
| Services menu `index` (50) | 37 ms | 6.9 ms | 6 | 17.8 KB |
| Services pages list (`per_page=200`) | 37 ms | 6.9 ms | 6 | 17.8 KB |
| Services page `show` | 25 ms | 3.3 ms | 3 | 8.1 KB |
| `previewConfig` | 16 ms | 4.4 ms | 4 | 2.3 KB |
| Shop menu `show` | 54 ms | 1.6 ms | 1 | **12.9 KB** (1 item + categories) |

**Takeaway:** Shop list SQL is cheap (~4 ms); wall is dominated by **eager-loading + serializing `categories`** the CRM table **never maps** (`shopMenuUtils` drops `categories`).

---

## EXPLAIN ANALYZE (key statements)

### 1) Shop / services list `ORDER BY sort_order LIMIT 50`

```
Limit → Sort → Seq Scan on shop_menu_items
Sort Key: sort_order · Execution Time ≈ 0.07 ms (11 rows)
```

Same pattern on `services_menu_items` (3 rows).  
**Root cause at scale:** no btree on `sort_order` → growing tables stay on Seq Scan + Sort.

### 2) Move neighbor (`WHERE sort_order < $x ORDER BY sort_order DESC LIMIT 1`)

```
Limit → Sort (top-N) → Seq Scan + Filter on sort_order
Execution Time ≈ 0.05 ms locally
```

**At scale:** needs index on `sort_order` for Index Scan / Index Only neighbor lookup.

### 3) Categories eager join (shop list)

`category_shop_menu_items` currently has **only PK** in `pg_indexes` — no btree on `shop_menu_item_id` / `category_id` despite FKs in migration.

```
Hash Semi Join · Seq Scan on category_shop_menu_items (99 rows)
Execution Time ≈ 0.16 ms locally
```

**At scale:** missing FK indexes → pivot lookups degrade; this is the highest-value **safe index** for shop menu.

### 4) Services page by menu id

Unique index `services_pages_services_menu_item_id_unique` exists — lookup is fine.  
Local plan still Seq Scan because **n=3**; index is already correct for growth.

### 5) `previewConfig` active menus

```
Seq Scan + Filter is_active → Sort sort_order
```

Composite `(is_active, sort_order)` would help when inactive rows accumulate.

---

## Findings by priority

### P0 — Safe indexes (no behavior change)

| Index | Why | Trade-off |
|-------|-----|-----------|
| `category_shop_menu_items (shop_menu_item_id)` | Eager `with('categories')`, delete cascades, any category sync | Small storage; faster writes slightly |
| `category_shop_menu_items (category_id)` | Reverse lookups / category→menus | Same |
| `shop_menu_items (sort_order)` | List ORDER BY, moveUp/Down neighbor, `max(sort_order)`, CSV export order | Small; write overhead on reorder |
| `services_menu_items (sort_order)` | Same as shop | Same |
| Optional: `(is_active, sort_order)` on both menu tables | `previewConfig` + future active filters | Slightly larger; helps preview/header |

### P1 — Over-fetch (response shape careful)

| Issue | Evidence | Safe approach |
|-------|----------|---------------|
| Shop list always `with('categories')` | FE ignores; **64 KB** for 11 rows; ~99 pivots joined | Prefer **new** slim list endpoint / `?include=` later — **do not strip fields from current `index` without checking other clients** |
| Services menu list `with('page')` | Unused on `/services-menu` table map | Same endpoint powers `/services-pages` which **needs** `page` — cannot drop globally; optional include flag |
| Shop `show` / Edit modal | Re-fetches full categories (~13 KB) even when list already has the row | FE can prefill from list row (no API change); or slim show columns |

### P2 — Write / CUD paths

| Path | Root cause | Recommendation | Risk |
|------|------------|----------------|------|
| Shop `importCsv` | Per created row: `max('sort_order')` inside transaction | Compute / cache `max` once per import batch | Low — same final sort values if sequential |
| Shop `exportCsv` | Loads **all** items + full `categories` graphs | Stream or select only CSV columns | Low if export columns unchanged |
| Shop/Services `store` | Single `max(sort_order)` | Fine; index on `sort_order` helps | — |
| Services menu `update` | Syncs linked `services_pages` slug/title/active | Necessary; already light | — |
| Services menu `destroy` | `page()->exists()` then 409 | Correct; unique FK helps | — |
| Services page **`upsert` (Save)** | Disk I/O + **delete all slides + recreate**; dual write `hero_slides` JSON **and** `services_page_slides`; rewrite full `sections` JSON | Later: incremental slide diff; stop dual-writing if one source of truth | Medium — must preserve response |
| Services page `destroy` | File deletes + slide rows + page | Expected for delete | — |
| Edit open always `GET show` | Extra round-trip | Optional FE reuse of list payload | None if show still available |

### P3 — UX / query patterns (not SQL bugs)

- Column sorting on shop/services tables is **client-only on current page** — cannot use DB indexes; misleading for multi-page sorts.
- Services pages list hard-caps **`per_page=200`** via menu-items API — no server search; fine at n=3, brittle if menus grow large.
- Unused `GET /ecommerce/services-pages` loads all pages + slides + large JSON — leave alone unless something else starts calling it.

---

## Current indexes (verified)

| Table | Indexes present |
|-------|-----------------|
| `shop_menu_items` | PK, `slug` unique — **no sort_order** |
| `services_menu_items` | PK, `slug` unique — **no sort_order** |
| `services_pages` | PK, `slug` unique, `services_menu_item_id` unique |
| `services_page_slides` | PK, `(services_page_id, sort_order)` |
| `category_shop_menu_items` | **PK only** (FK columns unindexed in Postgres) |

---

## Recommended apply order (when approved)

1. Add pivot + `sort_order` indexes (P0) — zero API/UX impact.  
2. Batch `max(sort_order)` in CSV import (P2) — same results, fewer scans.  
3. Only after client audit: slim list includes / new query endpoints (P1).  
4. Defer upsert slide rewrite redesign until measured slow in production (disk + JSON dominate, not missing indexes).

---

## Controllers / files

- `app/Http/Controllers/ShopMenuItemController.php`
- `app/Http/Controllers/ServicesMenuItemController.php`
- `app/Http/Controllers/ServicesPageController.php`
- FE: `ShopMenuTable.tsx`, `ServicesMenuTable.tsx`, `ServicesPagesTable.tsx`, `ServicesPagesEditor.tsx`, create/edit/delete modals
