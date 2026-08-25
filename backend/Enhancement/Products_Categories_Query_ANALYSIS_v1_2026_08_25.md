# Products + Categories Query Enhancement — ANALYSIS (2026-08-25)

Enhancement id: `products-categories-query-v1`

## What landed

### Indexes (`2026_08_25_000700_…`)
- `product_categories (category_id)`
- `categories (sort_order)`, `(is_active, sort_order)`
- `products (is_reward_only, id DESC)`

### New / updated APIs
| Method | Path | Use |
|--------|------|-----|
| GET | `/api/ecommerce/products/query` | Slim CRM product list (cover image only, no video/meta/description; variants included for stock modal) |
| GET | `/api/ecommerce/categories/query` | CRM categories table (no unused `parent`; slim `shopMenus`) |
| GET | `/api/ecommerce/categories/options/query` | Dropdown/filter options (`id,name,slug…` only) |

Legacy `GET /products` and `GET /categories` kept (POS still on full products index).  
`CategoryController@index` also drops unused `parent` eager load and selects slim menu columns.

### Other write-path wins
- Stock adjust response: slim reload (no bundles/packageChildren/video)
- Bulk SKU/barcode prefix: batch existence set (no per-candidate `exists()`)
- Media reorder: single `CASE` UPDATE

### CRM wire
- `ProductTable` → `/products/query` + categories `/options/query`
- `CategoryTable` → `/categories/query`
- `ProductForm` / `MultiFieldForm` → `/categories/options/query`

## Benchmark (local · median of 5 · same process)

| Call | Before (OLD) | After (NEW) | Δ wall | Δ bytes |
|------|-------------:|------------:|-------:|--------:|
| Products list `per_page=50` | 918 ms / 249 KB | **763 ms / 144 KB** | **−17%** | **−42%** |
| Categories list `per_page=50` | 146 ms | 145 ms | ~flat | ~flat |
| Categories filter `per_page=1000` | 268 ms / 70 KB | **38 ms / 12.5 KB** (options) | **−86%** | **−82%** |

Review-time baselines (pre-apply): products **772 ms**, categories×1000 **197 ms**, categories list **105 ms**.

### Product page first-paint (list + filter options)

| | Before | After |
|--|-------:|------:|
| Combined wall (approx) | ~772 + 197 ≈ **969 ms** | ~763 + 38 ≈ **801 ms** (**−17%**) |
| Filter payload | 70 KB | **12.5 KB** |

## Why products list wall is still high

SQL stays ~15 ms. Remaining cost is serializing **variants** (needed for stock-adjust modal on the list). Cover-only images + dropping video/meta cut payload **−42%**; further wins need lazy-loading variants on modal open (`include_variants=0` already supported on `/products/query`).

## Trade-offs

| Change | Trade-off |
|--------|-----------|
| Indexes | Slightly slower category attach / product inserts |
| Slim list APIs | Clients needing full media/video/meta must use legacy `index` / `show` |
| Stock adjust slim response | FE already refetches list — OK |
| `include_variants` default true | Keeps stock modal working without extra round-trip |

## Routes marked

`routes/api.php` — `// NEW ENHANCEMENT` / `// OLD QUERY` around products & categories query routes.
