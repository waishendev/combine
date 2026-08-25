# Catalog Menus Query Enhancement — ANALYSIS (2026-08-25)

Enhancement id: `catalog-menus-query-v1`

Covers CRM `/shop-menu`, `/services-menu`, `/services-pages` (+ create / edit / delete / CSV / move / page save).

## What landed

### Indexes (`2026_08_25_000600_…`)
- `shop_menu_items (sort_order)`, `(is_active, sort_order)`
- `services_menu_items (sort_order)`, `(is_active, sort_order)`
- `category_shop_menu_items (shop_menu_item_id)`, `(category_id)`

### New APIs
| Method | Path | Use |
|--------|------|-----|
| GET | `/api/ecommerce/shop-menu-items/query` | Slim CRM / category dropdown list (no categories) |
| GET | `/api/ecommerce/shop-menu-items/{id}/query` | Slim edit open |
| GET | `/api/ecommerce/services-menu-items/query` | Slim services-menu list |
| GET | `/api/ecommerce/services-menu-items/query?include_page=1` | Services-pages list / create wizard |
| GET | `/api/ecommerce/services-menu-items/{id}/query` | Slim edit open |

Legacy `GET …/shop-menu-items` and `GET …/services-menu-items` kept (full graphs).

### Other API / write improvements
- Shop/Services **store/update** return slim fields (no categories / page graph)
- Shop **exportCsv** only list columns + `category_ids` (no nested category objects)
- Shop **importCsv** caches `max(sort_order)` once per batch
- Services page **upsert** skips slide file wipe + `slides` delete/recreate when slide signature unchanged

### CRM wire
- `ShopMenuTable` → `/query`
- `ShopMenuEditModal` → `/{id}/query`
- `ServicesMenuTable` → `/query`
- `ServicesMenuEditModal` → `/{id}/query`
- `ServicesPagesTable` / `ServicesPageCreateForm` → `/query?include_page=1`
- `CategoryCreateModal` / `CategoryEditModal` → shop `/query`

## Benchmark (local · median of 5 · same process OLD vs NEW)

| Call | Before (OLD) | After (NEW) | Δ wall | Δ bytes |
|------|-------------:|------------:|-------:|--------:|
| Shop list | 194 ms / 64.4 KB | **8.7 ms / 3.0 KB** | **−96%** | **−95%** |
| Services menu list | 29 ms / 17.8 KB | **6.7 ms / 1.4 KB** | **−77%** | **−92%** |
| Services-pages list | 29–37 ms* / ~18 KB | **9.8 ms / 1.6 KB** | **~−70%** | **−91%** |
| Shop edit show | 34 ms / 12.9 KB | **0.9 ms / 0.2 KB** | **−97%** | **−98%** |

\*Review baseline for services-pages used OLD `index` at ~37 ms.

Review-time shop list baseline was **297 ms** (categories over-fetch); NEW is **8.7 ms** (**−97%** vs that baseline).

## Why it worked

Shop list wall was never SQL-bound (~4 ms). Cost was assembling **99 pivot + full category models** into JSON the CRM table discarded. Slim `/query` selects menu columns only → 2 queries (count + page) and ~3 KB.

## Trade-offs

| Change | Trade-off |
|--------|-----------|
| New indexes | Slightly slower writes on reorder / category attach |
| Slim create/update response | Clients needing nested `categories`/`page` on mutate must call legacy show |
| Upsert slide skip | Same visible result; fewer disk ops on no-op slide saves |
| Legacy list kept | Old heavy endpoints remain for any non-CRM caller |

## Routes marked

`routes/api.php` — `// NEW ENHANCEMENT` / `// OLD QUERY` / `// END NEW ENHANCEMENT` around catalog menu query routes.
