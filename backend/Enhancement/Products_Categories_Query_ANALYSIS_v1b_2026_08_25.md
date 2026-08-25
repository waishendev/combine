# Products + Categories Query Enhancement — ANALYSIS v1b (2026-08-25)

Enhancement id: `products-categories-query-v1b` (follow-on to v1)

## Nested pages coverage

| Route | Covered? | Notes |
|-------|----------|-------|
| `/product` list | Yes | `/products/query` now defaults **without** variants |
| `/product/create` | Partial | Category dropdown already `/categories/options/query`. No product GET on blank create; copy-from uses full `show` (needs media/variants/bundles) |
| `/product/[id]/edit` | Intentional full `show` | Edit needs full graph (~28 ms) — not slimmed |
| `/product/stock-movements` | Yes | Re-exports `/products/stock-movements` |
| `/products/stock-movements` | Yes | List API sargable dates + indexes; product picker → `/products/query?include_variants=0` |
| `/products/stock-movements/revoke` | Yes | Same page + `revokable_only` (`whereNotExists` + indexes) |

## What landed in v1b

### Indexes (`2026_08_25_000710_…`)
- `psm_product_id_id_idx`, `psm_created_at_id_idx`
- partial `psm_reversal_of_movement_id_idx`, `psm_revokable_lookup_idx`

### APIs
- `GET /products/{product}/query` — slim stock-modal payload (variants + cover)
- `/products/query` defaults: `include_variants=0`, `include_store_locations=0`
- List stock still correct via branch-inventory sum / `withSum(variants.stock)` + `withMin/Max` price aggregates
- Stock movements: sargable `created_at` ranges; revokable uses `whereNotExists` instead of `whereDoesntHave`

### CRM
- `ProductTable` list no longer embeds variants; stock button lazy-fetches `/products/{id}/query`
- `ProductStockMovementLogsPage` product picker → slim query

## Benchmark (local · median of 5)

| Call | Wall | SQL | Bytes | q |
|------|-----:|----:|------:|--:|
| OLD `/products` per_page=50 | 972 ms | 61 ms | 248 KB | 33 |
| v1 `/products/query` + variants | 716 ms | 43 ms | 133 KB | 27 |
| **v1b `/products/query` no variants** | **267 ms** | **33 ms** | **60 KB** | **18** |
| `/products/{id}/query` (stock modal) | 29 ms | 16 ms | 1.7 KB | 15 |
| `/products/{id}` show (edit) | 39 ms | 24 ms | 2.9 KB | 24 |
| stock-movements list 20 | 183 ms | 85 ms | 23 KB | 81 |
| stock-movements revokable | 189 ms | 93 ms | 23 KB | 78 |
| products picker slim 300 | 1033 ms | 63 ms | 256 KB | 15 |

### vs prior CRM list path

| | v1 (variants on) | v1b (lazy variants) | Δ |
|--|-----------------:|--------------------:|--:|
| Products list wall | 716 ms | **267 ms** | **−63% vs v1 query** / **−73% vs OLD index** |
| Payload | 133 KB | **60 KB** | **−55%** |

## Left alone (on purpose)

- Create/edit still use full `GET /products/{id}` — editor needs media, bundles, package children, meta.
- Stock-movements list still ~80 queries (eager relation graph); indexes help filters; further slim would be a separate pass.
